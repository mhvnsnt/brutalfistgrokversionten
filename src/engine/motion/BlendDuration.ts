// `.ts` extensions on purpose — the repo's runner resolves them literally.
import * as THREE from 'three';

/**
 * HOW LONG A BLEND SHOULD TAKE, FROM HOW FAR THE BODY HAS TO MOVE.
 *
 * Owner: "ours are keyed by destination rather than by from→to pair — worth
 * doing." He is right, and it is the shape Namco's own moveset data uses: a
 * transition is a property of the PAIR, not of where you are going. A fast
 * snap out of a hit reaction and a long settle out of a run are different
 * transitions into the same idle.
 *
 * WHY THIS IS COMPUTED RATHER THAN TABULATED. A from-to table over 455 clips
 * is 200,000 cells, and filling it means inventing 200,000 numbers — which is
 * the hand-tooling this project keeps having to undo. The distance is already
 * knowable: compare the pose the body is in RIGHT NOW against the first frame
 * of the clip it is blending to, and let the duration follow.
 *
 * Sampling the live skeleton rather than the outgoing clip's last frame is
 * deliberate. A blend usually begins mid-clip — a jab interrupted at frame 4
 * is nowhere near where that jab ends — so the outgoing clip's end pose is the
 * wrong question.
 *
 * CALIBRATED ON THE REAL CORPUS. Measured over 714 sampled clip transitions,
 * the mean per-joint angle between the end of one clip and the start of the
 * next runs:
 *
 *     p05 20 deg   median 47 deg   p95 68 deg   max 75 deg
 *
 * so the mapping anchors the fast end at 20 degrees and the slow end at 68,
 * and the duration range is kept to the one the hand table already used
 * (0.030s to 0.100s). Nothing becomes snappier or more sluggish than the game
 * already allowed; the choice between them is simply made by measurement
 * instead of by which state you happen to be entering.
 */

/** The pose distance that earns the shortest blend. Corpus p05. */
export const FAST_BLEND_DEGREES = 20;
/** …and the one that earns the longest. Corpus p95. */
export const SLOW_BLEND_DEGREES = 68;

/** The range the hand-authored table already spanned, in seconds. */
export const MIN_BLEND_S = 0.030;
export const MAX_BLEND_S = 0.100;

/** Shortest-arc angle between two quaternions, in degrees. */
function angleDegrees(a: THREE.Quaternion, bx: number, by: number, bz: number, bw: number): number {
  // |dot| takes the short arc: q and -q are the same orientation, and without
  // the absolute value half of all pairs measure as nearly a full turn.
  const dot = Math.min(1, Math.abs(a.x * bx + a.y * by + a.z * bz + a.w * bw));
  return (2 * Math.acos(dot) * 180) / Math.PI;
}

/**
 * The mean per-joint angle between the skeleton's current pose and the first
 * frame of `clip`, in degrees. Returns null when they share no bone, which is
 * a real case — a clip retargeted onto a rig that does not carry its joints.
 */
export function poseDistanceDegrees(
  skeleton: { bones: Array<{ name: string; quaternion: THREE.Quaternion }> } | null | undefined,
  clip: THREE.AnimationClip | null | undefined,
): number | null {
  if (!skeleton?.bones?.length || !clip?.tracks?.length) return null;
  const byName = new Map<string, THREE.Quaternion>();
  for (const b of skeleton.bones) byName.set(b.name, b.quaternion);

  let total = 0;
  let counted = 0;
  for (const track of clip.tracks) {
    if (!track.name.endsWith('.quaternion')) continue;
    const bone = byName.get(track.name.slice(0, -'.quaternion'.length));
    const v = track.values;
    if (!bone || !v || v.length < 4) continue;
    total += angleDegrees(bone, v[0], v[1], v[2], v[3]);
    counted++;
  }
  return counted ? total / counted : null;
}

/** Map a pose distance onto a blend duration, clamped to the usable range. */
export function blendDurationForDistance(degrees: number): number {
  const span = SLOW_BLEND_DEGREES - FAST_BLEND_DEGREES;
  const k = Math.max(0, Math.min(1, (degrees - FAST_BLEND_DEGREES) / span));
  return MIN_BLEND_S + (MAX_BLEND_S - MIN_BLEND_S) * k;
}

/**
 * The blend duration for this particular transition.
 *
 * `fallback` is the destination-keyed value the caller would otherwise have
 * used, and it is returned unchanged whenever the distance cannot be measured
 * — a missing skeleton, a clip with no shared bones. A transition that cannot
 * be measured must behave exactly as it did before, not as an average.
 */
export function blendDurationFor(
  skeleton: { bones: Array<{ name: string; quaternion: THREE.Quaternion }> } | null | undefined,
  clip: THREE.AnimationClip | null | undefined,
  fallback: number,
): number {
  const degrees = poseDistanceDegrees(skeleton, clip);
  if (degrees === null) return fallback;
  return blendDurationForDistance(degrees);
}
