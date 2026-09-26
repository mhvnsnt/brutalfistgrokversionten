/**
 * BONE MASKING AT THE HIPS — a hand strike must not move the legs.
 *
 * THE DEFECT, MEASURED. tools/motion/bone_mask_audit.mjs walks all 455 baked
 * clips. On ALTERNATINGFOREARMS the pelvis rotation away from the clip's own
 * first frame, frame by frame, is:
 *
 *     0 10 11 30 33 32 46 71 100 84 40 10 38 76 103 102 112 111 101 121 108 105 101 101
 *
 * A forearm strike rotates the pelvis past a right angle and leaves it 101
 * degrees out. CHOKESLAM leaves it 117 out, DDT 86. IDLE, by contrast, sways to
 * 55 and returns to 0. 190 of 455 clips have a lower body that is either faster
 * than the bank's fastest real kick (HURRICANE_KICK, 786 deg/s) or does not
 * return the pelvis to a stance.
 *
 * WHY NOT FIX THE 455 CLIPS. The offset is a rest-pose mismatch the retargeter
 * baked in, with real animation layered on top, so there is nothing to subtract
 * cleanly — and rebuilding the bank by hand is 455 files of guesswork. The
 * engine can simply decline to read the part of the clip that is wrong.
 *
 * WHY THE DECISION IS NOT PER CLIP. An earlier pass tried to tag clips by
 * measuring their leg tracks, and the obvious rule — a large offset that barely
 * varies is a baked-in constant — puts ALTERNATINGFOREARMS in the SAFE pile,
 * because its legs travel 174 degrees, which reads as footwork until you notice
 * it is travelled at 998 deg/s. Measuring corrupt data to decide whether to
 * trust it is circular. The engine already knows something better: WHAT THE
 * PLAYER PRESSED. A jab is a jab whatever its clip contains. So the mask comes
 * from the motion state, and the audit is the evidence and the gate.
 *
 * HOW IT WORKS IN THREE.JS, which has no per-bone evaluate loop to skip inside.
 * THREE.AnimationMixer accumulates per BINDING: a bone with no track in any
 * playing action is never written, and a bone with tracks in two actions gets
 * their weighted blend. So the mask is a SPLIT, not a skip — the attack clip is
 * rebuilt without its lower-body tracks, and a second action plays the current
 * stance clip's lower-body half underneath it. Each bone then has exactly one
 * action driving it: arms and spine from the strike, pelvis and legs from the
 * stance. That is the same result as skipping the leg tracks in an evaluate
 * loop, expressed the way this engine actually runs.
 */
import * as THREE from 'three';
import type { FighterMotionState } from '../retarget/AnimationController';

/**
 * The boundary. The pelvis and both leg chains are the lower body; the first
 * spine joint up is the upper body. Bone names as this bank writes them —
 * `normalizeBoneName` handles the `mixamorig:` and `Armature|` variants.
 */
export const LOWER_BODY_BONES: ReadonlySet<string> = new Set([
  'mixamorigHips',
  'mixamorigLeftUpLeg', 'mixamorigLeftLeg', 'mixamorigLeftFoot', 'mixamorigLeftToeBase',
  'mixamorigRightUpLeg', 'mixamorigRightLeg', 'mixamorigRightFoot', 'mixamorigRightToeBase',
  // Non-Mixamo rigs that reach this code through the canonical map.
  'Hips', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase',
  'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase',
]);

export type BoneMask = 'FULL_BODY' | 'UPPER_BODY';

/**
 * The states where the hands do the work and the legs must hold the stance.
 *
 * Deliberately narrow. A kick, a jump attack, a running attack, a throw, a hit
 * reaction, a knockdown and a taunt are all whole-body motions and keep their
 * own legs however bad their tracks are — masking those would replace a wrong
 * leg with a missing one. Crouching attacks ARE masked, and that is the case
 * that shows why this is right: the legs then come from the live crouch stance
 * instead of whatever crouch the strike capture happened to contain.
 */
export const UPPER_BODY_STATES: ReadonlySet<FighterMotionState> = new Set<FighterMotionState>([
  'lightAttack', 'heavyAttack',
  'crouchLightAttack', 'crouchHeavyAttack',
  'Startup', 'Active',
]);

/**
 * The states whose legs are allowed to own the pelvis — the stances and gaits a
 * fighter is actually standing in when he throws a punch. The last one played is
 * what the base layer holds.
 */
export const STANCE_STATES: ReadonlySet<FighterMotionState> = new Set<FighterMotionState>([
  'idle', 'walk', 'walkForward', 'walkBackward', 'Walking',
  'strafeLeft', 'strafeRight', 'sidestepLeft', 'sidestepRight',
  'run', 'dash', 'dashForward', 'Backdashing',
  'crouch', 'crouchWalk',
  'guard', 'guardLow', 'Guard',
]);

export function maskForState(state: FighterMotionState): BoneMask {
  return UPPER_BODY_STATES.has(state) ? 'UPPER_BODY' : 'FULL_BODY';
}

/**
 * `Armature|mixamorig:LeftUpLeg.quaternion` -> `mixamorigLeftUpLeg`.
 * Track names arrive in several shapes depending on how the clip was authored.
 */
export function normalizeBoneName(trackName: string): string {
  const dot = trackName.lastIndexOf('.');
  const path = dot < 0 ? trackName : trackName.slice(0, dot);
  return (path.split('|').pop() ?? '').replace(/:/g, '');
}

export function isLowerBodyTrack(trackName: string): boolean {
  return LOWER_BODY_BONES.has(normalizeBoneName(trackName));
}

/**
 * Two derived clips per source clip, built once and reused. The mixer keys its
 * actions on the clip OBJECT, so handing it a fresh split every frame would mint
 * a new action every frame and leak; the cache is what makes this safe to call
 * from play().
 */
const splitCache = new WeakMap<THREE.AnimationClip, { upper: THREE.AnimationClip | null; lower: THREE.AnimationClip | null }>();

function buildSplit(clip: THREE.AnimationClip) {
  const upperTracks = clip.tracks.filter((t) => !isLowerBodyTrack(t.name));
  const lowerTracks = clip.tracks.filter((t) => isLowerBodyTrack(t.name));
  // The duration is carried across explicitly. Letting three re-derive it from
  // the surviving tracks would shorten a half whose last keyframe lands early,
  // and the two layers would then drift out of step.
  // A split is only built when there is something on BOTH sides of the boundary.
  // A clip with no lower-body tracks has nothing to mask, so it is handed back
  // whole rather than duplicated into an identical object the mixer would have
  // to keep a second action for.
  const worthSplitting = upperTracks.length > 0 && lowerTracks.length > 0;
  return {
    upper: worthSplitting ? new THREE.AnimationClip(`${clip.name}__upper`, clip.duration, upperTracks) : null,
    lower: lowerTracks.length ? new THREE.AnimationClip(`${clip.name}__lower`, clip.duration, lowerTracks) : null,
  };
}

function splitOf(clip: THREE.AnimationClip) {
  let cached = splitCache.get(clip);
  if (!cached) { cached = buildSplit(clip); splitCache.set(clip, cached); }
  return cached;
}

/**
 * The clip with its lower-body tracks removed, or the clip itself when the split
 * would leave nothing to play. A clip that is ALL lower body (a footwork-only
 * capture) is returned whole rather than emptied — a silent empty action is
 * worse than an unmasked one, because nothing moves and nothing says why.
 */
export function upperBodyHalf(clip: THREE.AnimationClip): THREE.AnimationClip {
  return splitOf(clip).upper ?? clip;
}

/** The lower-body half, or null when the clip has no lower-body tracks to lend. */
export function lowerBodyHalf(clip: THREE.AnimationClip): THREE.AnimationClip | null {
  return splitOf(clip).lower;
}

/** True when masking this clip would actually remove something. */
export function isSplittable(clip: THREE.AnimationClip): boolean {
  const { upper, lower } = splitOf(clip);
  return upper !== null && lower !== null;
}
