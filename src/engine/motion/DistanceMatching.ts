/**
 * DISTANCE MATCHING — stop the feet sliding.
 *
 * Every locomotion clip in this bank has ZERO hips travel: root motion is
 * neutralised at bake time and the engine translates the root itself. That is the
 * normal arrangement and it has one unavoidable consequence — the STRIDE is fixed
 * by the clip while the SPEED is set by the engine, so unless playback scales with
 * speed the feet skate across the floor. No amount of blending hides it, which is
 * why Unreal's locomotion (Lyra's included) drives animation time from DISTANCE
 * rather than from the clock.
 *
 * MEASURED, by forward kinematics on the planted foot
 * (tools/motion/stride_speed.mjs), against what the engine actually moves at:
 *
 *   clip                 authored   engine   plays    slides
 *   DWARF_WALK   walk      1.839     1.72    0.94x   0.12 m/s   near enough
 *   GINGA_BACK   back      2.492     1.72    0.69x   0.77 m/s   visible
 *   DRUNK_RUN    dash      3.277     4.30    1.31x   1.02 m/s   visible
 *   TPOSE                  0.000        —        —        —     the control
 *
 * So the forward walk was nearly right by luck and the back-walk and the dash
 * were not. The rate is the ratio, and the ratio is all it is:
 *
 *     playbackRate = actualSpeed / authoredSpeed
 *
 * CLAMPED, because past a point a rate change is a different animation rather
 * than the same one going faster: a walk at 2x is not a run, it is a walk played
 * wrong. Outside the band the clip is the wrong clip and the honest response is to
 * play it at the edge and let the audit say so, not to stretch it until it breaks.
 */

/** Below this a clip is effectively in place and a ratio against it is nonsense. */
export const MIN_AUTHORED_SPEED_MPS = 0.25;
/** Outside this band a rate change stops reading as the same motion. */
export const RATE_CLAMP = { min: 0.1, max: 1.8 } as const;
/** Anything slower than this is standing still, so the clip plays at its own rate. */
export const MIN_MATCHED_SPEED_MPS = 0.05;

let authored: ReadonlyMap<string, number> = new Map();

/** Load the measured authored speeds. Nothing loaded = no rate changes at all. */
export function setAuthoredStrideSpeeds(speeds: Iterable<readonly [string, number]>): void {
  authored = new Map(speeds);
}

export function authoredStrideSpeed(clipName: string | undefined | null): number | null {
  if (!clipName) return null;
  const base = clipName.replace(/__(upper|lower)$/, '');
  const v = authored.get(base);
  return v !== undefined && v >= MIN_AUTHORED_SPEED_MPS ? v : null;
}

export function strideSpeedCount(): number {
  return authored.size;
}

/**
 * The playback rate that makes this clip's stride cover the ground the engine is
 * actually covering. 1 means leave it alone, which is also what an unmeasured
 * clip, an in-place clip and a standing fighter all get.
 */
export function playbackRateFor(clipName: string | undefined | null, speedMps: number): number {
  const own = authoredStrideSpeed(clipName);
  if (own === null) return 1;
  const speed = Math.abs(speedMps);
  if (speed < MIN_MATCHED_SPEED_MPS) return 1;
  const rate = speed / own;
  return Math.min(RATE_CLAMP.max, Math.max(RATE_CLAMP.min, rate));
}

/**
 * How fast the feet still slide at this rate, in m/s. Zero when the rate lands
 * inside the band; positive when the clamp bit, which means the wrong clip is
 * being used for that speed and no rate can fix it.
 */
export function residualSlideMps(clipName: string | undefined | null, speedMps: number): number {
  const own = authoredStrideSpeed(clipName);
  if (own === null) return 0;
  const speed = Math.abs(speedMps);
  if (speed < MIN_MATCHED_SPEED_MPS) return 0;
  return Math.abs(speed - own * playbackRateFor(clipName, speedMps));
}
