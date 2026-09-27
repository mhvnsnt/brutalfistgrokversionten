import * as THREE from 'three';
import { retargetClipByRestPose, validateRetargetedClip } from './ClipRetarget';
import { maskForClip, upperBodyHalf, lowerBodyHalf, isSplittable, STANCE_STATES, type BoneMask } from '../motion/BoneMask';
import { playbackRateFor, residualSlideMps } from '../motion/DistanceMatching';

export type FighterMotionState =
  | 'idle' | 'walkForward' | 'walkBackward' | 'strafeLeft' | 'strafeRight' |'crouch'| 'crouchWalk' | 'guard' | 'guardLow' |'lightAttack'| 'heavyAttack' | 'lightKick' | 'heavyKick' | 'crouchLightAttack' | 'crouchHeavyAttack' |'jumpAttack'| 'runAttack' |'hit' | 'hitLow' | 'hitHigh' | 'knockdown' | 'wake'
  // ── Extended locomotion states ────────────────────────────────────────────
  | 'walk' | 'run' | 'dash' | 'dashForward' |'Walking' | 'Backdashing' | 'Guard' | 'Knockdown'
  | 'WakeupTechRoll'| 'WakeupBackrise' | 'WakeupQuickStand' |'HitStun' | 'Stunned' | 'Crumple' | 'CommandThrow' | 'ThrowWhiff'
  // ── Extended combat states ────────────────────────────────────────────────
  | 'Startup' | 'Active' | 'Blockstun' | 'Hitstun'
  // ── Tekken-specific states ────────────────────────────────────────────────
  | 'overdrive' | 'finisher' | 'superArmor' | 'sidestepLeft' | 'sidestepRight'
  | 'jump' | 'jumpForward' | 'jumpBack'
  // ── Post-match states ─────────────────────────────────────────────────────
  | 'victory' | 'defeat' | 'taunt' | 'intro';

export interface RetargetedAnimationSet {
  clips: Map<FighterMotionState, THREE.AnimationClip>;
}

export type AnimationController = ReturnType<typeof buildAnimationController>;

// ── Crossfade durations per transition (seconds) ─────────────────────────────
// Frame counts at 60fps: 6f=0.100s, 4f=0.067s, 3f=0.050s, 2f=0.033s
const CROSSFADE_DURATIONS: Partial<Record<FighterMotionState, number>> = {
  // Locomotion — gentle blends
  idle:              0.100,  // 6 frames — gentle deceleration to idle
  walk:              0.100,
  run:               0.083,
  dash:              0.067,
  dashForward:       0.067,
  Walking:           0.100,
  walkForward:       0.100,
  walkBackward:      0.100,
  strafeLeft:        0.100,
  strafeRight:       0.100,
  sidestepLeft:      0.067,
  sidestepRight:     0.067,
  crouch:            0.083,
  crouchWalk:        0.100,
  Backdashing:       0.067,  // 4 frames — snappy backdash entry
  // Wakeup
  WakeupTechRoll:    0.083,
  WakeupBackrise:    0.083,
  WakeupQuickStand:  0.067,
  // Attacks — fast snaps
  lightAttack:       0.050,  // 3 frames — fast snap into attack
  heavyAttack:       0.067,
  crouchLightAttack: 0.050,
  crouchHeavyAttack: 0.067,
  jumpAttack:        0.050,
  runAttack:         0.050,
  CommandThrow:      0.067,
  Startup:           0.050,
  Active:            0.033,
  // Tekken specials
  overdrive:         0.050,
  finisher:           0.067,
  superArmor:        0.067,
  // Hit reactions — very fast
  hit:               0.033,  // 2 frames — snap into hit reaction
  hitLow:            0.033,
  hitHigh:           0.033,
  HitStun:           0.033,
  Stunned:           0.033,
  Hitstun:           0.033,
  Blockstun:         0.050,
  // Knockdown
  knockdown:         0.067,
  Knockdown:         0.067,
  Crumple:           0.067,
  // Guard
  guard:             0.083,
  guardLow:          0.083,
  Guard:             0.083,
  // Wakeup
  wake:              0.100,
  // Throw whiff
  ThrowWhiff:        0.083,
  // Post-match
  victory:           0.150,
  defeat:            0.150,
  taunt:             0.150,
  intro:             0.150,
};

const DEFAULT_FADE = 0.083;

// ── States that should loop continuously ─────────────────────────────────────
const LOOP_STATES = new Set<FighterMotionState>([
  'idle', 'walk', 'run', 'Walking', 'walkForward', 'walkBackward',
  'strafeLeft', 'strafeRight', 'sidestepLeft', 'sidestepRight',
  'crouch', 'crouchWalk', 'guard', 'guardLow', 'Guard',
  'Backdashing', 'Knockdown',
  'WakeupTechRoll', 'WakeupBackrise', 'WakeupQuickStand',
]);

// ── States that play once and return to idle ──────────────────────────────────
const ONESHOT_STATES = new Set<FighterMotionState>([
  'lightAttack', 'heavyAttack', 'lightKick', 'heavyKick', 'crouchLightAttack', 'crouchHeavyAttack',
  'jumpAttack', 'runAttack', 'CommandThrow', 'ThrowWhiff',
  'overdrive', 'finisher', 'superArmor',
  'hit', 'hitLow', 'hitHigh', 'HitStun', 'Stunned', 'Hitstun',
  'knockdown', 'Crumple',
  'victory', 'defeat', 'taunt', 'intro',
]);

/**
 * buildAnimationController — wraps THREE.AnimationMixer with crossfading.
 *
 * Key behaviours:
 * - play(next) crossfades from the current action to the next using
 *   .crossFadeTo(nextAction, duration, true) so transitions are smooth.
 * - The fade duration is tuned per state (attacks snap in fast, locomotion
 *   blends gently).
 * - update(delta) must be called every frame (inside useFrame).
 * - Loop states loop continuously; one-shot states play once.
 *
 * AGENT LAW: The mixer MUST be created on the cloned scene (not the outer group).
 * This ensures animation transforms drive the actual visible mesh bones.
 */
export function buildAnimationController(
  root: THREE.Object3D,
  mixer: THREE.AnimationMixer,
  clips: RetargetedAnimationSet,
) {
  let currentAction: THREE.AnimationAction | null = null;
  let currentState: FighterMotionState = 'idle';
  /**
   * THE BASE LAYER. While a masked upper-body state plays, this action holds the
   * pelvis and both legs at the stance the fighter is actually in, so a jab
   * cannot rotate the hips 101 degrees the way its capture wants to. See
   * src/engine/motion/BoneMask.ts for the measurements behind this.
   */
  let stanceAction: THREE.AnimationAction | null = null;
  let stanceState: FighterMotionState = 'idle';
  let masked = false;
  /**
   * DISTANCE MATCHING. The clip name and the live ground speed, so playback can be
   * scaled to the stride the clip was authored with — otherwise the feet slide by
   * the difference, measured at 0.77 m/s on the back-walk and 1.02 on the dash.
   * Both start neutral, so a caller that never reports a speed gets rate 1 and
   * exactly the behaviour from before this existed.
   */
  let playingClipName: string | null = null;
  let groundSpeedMps = 0;

  const applyPlaybackRate = () => {
    if (!currentAction) return;
    const rate = LOOP_STATES.has(currentState) ? playbackRateFor(playingClipName, groundSpeedMps) : 1;
    currentAction.setEffectiveTimeScale(rate);
  };

  /**
   * DOES THIS CLIP ACTUALLY DRIVE THIS SKELETON?
   *
   * An AnimationClip whose track names do not match any bone on the rig binds to
   * NOTHING. three.js does not complain — the mixer runs, the action reports a
   * weight of 1, and every bone is left exactly where the skeleton's rest pose
   * put it. On a rig whose rest is a literal T-pose that is a T-pose on screen
   * for the whole length of the clip.
   *
   * MEASURED: over a 300-frame match sample BANNON sat within 0.71 degrees of
   * bind across all 58 bones on frames 84, 87-89, 208, 210-211 — two bursts of
   * about 0.4s each, mid-fight, while VIPER (whose rest is a stance) never went
   * near bind. Not at boot, so it was not the bank arriving late.
   *
   * So coverage is checked before a clip is allowed on the mixer. Below the
   * threshold the clip is refused and the body keeps what it is already playing,
   * which is always better than the bind pose.
   */
  const boneNames = (() => {
    const names = new Set<string>();
    root.traverse((o) => { if ((o as THREE.Bone).isBone) names.add(o.name); });
    return names;
  })();
  const BIND_COVERAGE_MIN = 0.34;
  const refusedClips = new Set<string>();
  const bindCoverage = (clip: THREE.AnimationClip): number => {
    if (!clip.tracks.length || !boneNames.size) return 1;
    let hit = 0;
    for (const t of clip.tracks) {
      const dot = t.name.indexOf('.');
      const target = dot > 0 ? t.name.slice(0, dot) : t.name;
      if (boneNames.has(target)) hit++;
    }
    return hit / clip.tracks.length;
  };
  /** True when the clip binds well enough to be worth playing. Logs once per clip. */
  const drivesThisRig = (clip: THREE.AnimationClip): boolean => {
    const cov = bindCoverage(clip);
    if (cov >= BIND_COVERAGE_MIN) return true;
    if (!refusedClips.has(clip.name)) {
      refusedClips.add(clip.name);
      console.warn(`[AnimationController] 🚫 "${clip.name}" binds ${(cov * 100).toFixed(0)}% of its ${clip.tracks.length} tracks to this rig — refused, it would have shown the rest pose`);
    }
    return false;
  };

  const resolveClip = (state: FighterMotionState): THREE.AnimationClip | undefined => {
    // Try exact state match first. A clip that cannot bind to this rig is
    // treated as absent, so the fallback chain gets a chance instead of the
    // body dropping to its rest pose.
    const usable = (c: THREE.AnimationClip | undefined) => (c && drivesThisRig(c) ? c : undefined);
    let clip = usable(clips.clips.get(state));
    // Fallback chain for combat states
    if (!clip) {
      const fallbacks: Partial<Record<FighterMotionState, FighterMotionState[]>> = {
        crouchLightAttack: ['lightAttack', 'crouch'],
        crouchHeavyAttack: ['heavyAttack', 'crouch'],
        jumpAttack:        ['heavyAttack', 'lightAttack'],
        runAttack:         ['heavyAttack', 'lightAttack'],
        overdrive:         ['heavyAttack'],
        finisher:           ['heavyAttack'],
        superArmor:        ['heavyAttack'],
        hitLow:            ['hit'],
        hitHigh:           ['hit'],
        guardLow:          ['guard'],
        crouchWalk:        ['crouch', 'walkForward'],
        sidestepLeft:      ['strafeLeft', 'walkBackward'],
        sidestepRight:     ['strafeRight', 'walkForward'],
        dashForward:       ['walkForward', 'walk'],
        dash:              ['walkForward', 'walk'],
        run:               ['walkForward', 'walk'],
        Hitstun:           ['hit', 'HitStun'],
        Blockstun:         ['guard', 'Guard'],
        Startup:           ['lightAttack'],
        Active:            ['lightAttack'],
        victory:           ['idle'],
        defeat:            ['knockdown', 'Knockdown'],
        taunt:             ['idle'],
        intro:             ['idle'],
      };
      const chain = fallbacks[state] ?? [];
      for (const fb of chain) {
        clip = usable(clips.clips.get(fb));
        if (clip) break;
      }
    }
    // Final fallback: idle
    if (!clip) clip = usable(clips.clips.get('idle'));
    return clip;
  };

  /**
   * Bring up the lower-body half of the stance clip, or leave it up if it is
   * already the right one. The legs keep looping on their own clock — they are a
   * stance being held, not a phase of the strike.
   */
  const raiseStanceLayer = (fade: number) => {
    const stanceClip = resolveClip(stanceState);
    const lower = stanceClip ? lowerBodyHalf(validateRetargetedClip(stanceClip)) : null;
    if (!lower) { masked = false; return false; }
    const action = mixer.clipAction(lower, root);
    if (stanceAction && stanceAction !== action) stanceAction.fadeOut(fade);
    action.setLoop(THREE.LoopRepeat, Infinity);
    if (!action.isRunning()) action.reset().play();
    action.fadeIn(fade);
    stanceAction = action;
    masked = true;
    return true;
  };

  const lowerStanceLayer = (fade: number) => {
    if (stanceAction) stanceAction.fadeOut(fade);
    masked = false;
  };

  const play = (next: FighterMotionState, overrideFade?: number) => {
    if (next === currentState && currentAction) return;

    const clip = resolveClip(next);
    if (!clip) return;
    const validated = validateRetargetedClip(clip);

    // The mask comes from WHAT WAS PRESSED, never from measuring the clip's own
    // leg tracks — measuring corrupt data to decide whether to trust it is
    // circular, and it puts ALTERNATINGFOREARMS in the safe pile.
    // The clip matters as well as the button: a kick keeps its own legs, unless
    // those legs are measurably impossible (see maskForClip).
    const wantMask = maskForClip(next, validated.name) === 'UPPER_BODY' && isSplittable(validated);
    const fadeDuration = overrideFade ?? CROSSFADE_DURATIONS[next] ?? DEFAULT_FADE;

    // Raise the legs BEFORE choosing the clip: if the stance has no lower-body
    // half to lend, the strike keeps its own legs rather than losing them.
    const legsHeld = wantMask ? raiseStanceLayer(fadeDuration) : false;
    if (!legsHeld) lowerStanceLayer(fadeDuration);

    const playedClip = legsHeld ? upperBodyHalf(validated) : validated;
    playingClipName = validated.name;
    const nextAction = mixer.clipAction(playedClip, root);

    // Configure loop mode
    if (LOOP_STATES.has(next)) {
      nextAction.setLoop(THREE.LoopRepeat, Infinity);
    } else if (ONESHOT_STATES.has(next)) {
      nextAction.setLoop(THREE.LoopOnce, 1);
      nextAction.clampWhenFinished = true;
    } else {
      nextAction.setLoop(THREE.LoopRepeat, Infinity);
    }

    if (currentAction && currentAction !== nextAction) {
      // Crossfade: blend out current, blend in next
      nextAction.reset();
      nextAction.setEffectiveTimeScale(1);
      nextAction.setEffectiveWeight(1);
      currentAction.crossFadeTo(nextAction, fadeDuration, true);
      nextAction.play();
    } else {
      // No current action — just start
      nextAction.reset().fadeIn(fadeDuration).play();
    }

    currentAction = nextAction;
    currentState = next;
    // AFTER currentState is set, because the rate depends on whether this state
    // loops — a one-shot attack is never rate-scaled.
    applyPlaybackRate();
    // Remember the stance to hold the legs at next time a strike is masked. Only
    // an unmasked stance qualifies: a masked strike never owned the legs, so it
    // has nothing to hand on.
    if (!legsHeld && STANCE_STATES.has(next)) stanceState = next;
  };

  // Boot into idle immediately
  const bootClip = resolveClip('idle');
  if (bootClip) {
    const idleAction = mixer.clipAction(validateRetargetedClip(bootClip), root);
    idleAction.setLoop(THREE.LoopRepeat, Infinity);
    idleAction.reset().play();
    currentAction = idleAction;
  }

  return {
    get state() { return currentState; },
    /**
     * Tell the controller how fast the body is actually moving over the ground, in
     * m/s. Scales a looping locomotion clip's playback so its stride covers that
     * ground. Never called = rate 1 everywhere, which is the old behaviour.
     */
    setGroundSpeed(mps: number) {
      if (Math.abs(mps - groundSpeedMps) < 0.01) return;
      groundSpeedMps = mps;
      applyPlaybackRate();
    },
    /** The rate in force, for the audit and for tests. */
    get playbackRate() { return LOOP_STATES.has(currentState) ? playbackRateFor(playingClipName, groundSpeedMps) : 1; },
    /** How fast the feet still slide, m/s. Non-zero means the wrong clip for this speed. */
    get footSlide() { return LOOP_STATES.has(currentState) ? residualSlideMps(playingClipName, groundSpeedMps) : 0; },
    /** Which half of the body the playing clip is allowed to drive. */
    get mask(): BoneMask { return masked ? 'UPPER_BODY' : 'FULL_BODY'; },
    /** The stance currently holding the pelvis and legs. */
    get stance() { return stanceState; },
    play,
    update(delta: number) { mixer.update(delta); },
  };
}

export function retargetAnimationSet(
  clips: THREE.AnimationClip[],
  sourceRoot: THREE.Object3D,
  destinationRoot: THREE.Object3D,
  sourceRest: Parameters<typeof retargetClipByRestPose>[1]['sourceRest'],
  destinationRest: Parameters<typeof retargetClipByRestPose>[1]['destinationRest'],
): THREE.AnimationClip[] {
  return clips.map(clip =>
    retargetClipByRestPose(clip, { sourceRoot, destinationRoot, sourceRest, destinationRest })
  );
}
