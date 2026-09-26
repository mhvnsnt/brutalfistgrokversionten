import * as THREE from 'three';
import { retargetClipByRestPose, validateRetargetedClip } from './ClipRetarget';
import { maskForState, upperBodyHalf, lowerBodyHalf, isSplittable, STANCE_STATES, type BoneMask } from '../motion/BoneMask';

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

  const resolveClip = (state: FighterMotionState): THREE.AnimationClip | undefined => {
    // Try exact state match first
    let clip = clips.clips.get(state);
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
        clip = clips.clips.get(fb);
        if (clip) break;
      }
    }
    // Final fallback: idle
    if (!clip) clip = clips.clips.get('idle');
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
    const wantMask = maskForState(next) === 'UPPER_BODY' && isSplittable(validated);
    const fadeDuration = overrideFade ?? CROSSFADE_DURATIONS[next] ?? DEFAULT_FADE;

    // Raise the legs BEFORE choosing the clip: if the stance has no lower-body
    // half to lend, the strike keeps its own legs rather than losing them.
    const legsHeld = wantMask ? raiseStanceLayer(fadeDuration) : false;
    if (!legsHeld) lowerStanceLayer(fadeDuration);

    const nextAction = mixer.clipAction(legsHeld ? upperBodyHalf(validated) : validated, root);

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
