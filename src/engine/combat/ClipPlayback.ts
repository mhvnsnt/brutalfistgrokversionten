/**
 * How fast a clip is allowed to play.
 *
 * Tekken plays a strike at the speed it was authored. Fitting whatever clip
 * happened to resolve — a 7s suplex, a 3s demo — into a half-second window
 * is the fast-forward twitch. A clip already close to the window is nudged
 * so the strike still meets the active frames. Anything else plays at 1x
 * and the state machine cuts it; the last frame holds, it does not blur.
 *
 * Walk clips are in-place. Their cycle is authored against the walk pace,
 * so a dash at 2.5x walk has to play the feet at 2.5x or they skate.
 */

import { playbackRateFor, authoredStrideSpeed } from '../motion/DistanceMatching.ts';

/** Fallback pace for any clip whose authored stride has not been measured. */
export const WALK_PLAYBACK_MPS = 1.72;

export function attackPlaybackRate(clipDuration: number, windowSeconds: number): number {
  if (!(clipDuration > 0) || !(windowSeconds > 0)) return 1;
  const fit = clipDuration / windowSeconds;
  if (fit >= 0.8 && fit <= 1.45) return fit;
  return 1;
}

/** A jump is a full arc. Cap the speedup so a long clip still leaves the ground
 *  without becoming a blur. */
export function jumpPlaybackRate(clipDuration: number, windowSeconds: number): number {
  if (!(clipDuration > 0) || !(windowSeconds > 0)) return 1;
  const fit = clipDuration / windowSeconds;
  return Math.min(2, Math.max(0.85, fit));
}

/** A knockdown has to reach the ground. A fall that already fits plays
 *  as authored. A long death demo is sped up enough to land, never into a blur. */
export function knockdownPlaybackRate(clipDuration: number, downSeconds = 1.7): number {
  if (!(clipDuration > 0) || !(downSeconds > 0)) return 1;
  const fit = clipDuration / downSeconds;
  if (fit <= 1.35) return Math.max(0.85, fit);
  return Math.min(2.2, fit);
}

/**
 * THE DIVISOR IS THE CLIP'S OWN AUTHORED SPEED, NOT A CONSTANT.
 *
 * Dividing by a flat WALK_PLAYBACK_MPS assumes every locomotion clip was authored
 * at the walk pace. Measured by forward kinematics on the planted foot
 * (tools/motion/stride_speed.mjs), they were not:
 *
 *   DWARF_WALK         1.839 m/s   the forward walk — close to 1.72 by luck
 *   GINGA_BACKWARD     2.492 m/s   the back-walk, 45% off the constant
 *   DRUNK_RUN_FORWARD  3.277 m/s   the dash clip, 90% off
 *
 * So a flat divisor fixes the forward walk and leaves the back-walk skating at
 * 0.77 m/s and the dash at 1.02. `playbackRateFor` reads the measured speed for
 * the clip actually playing and falls back to this constant for any clip the
 * measurement does not cover — which is also exactly the old behaviour when no
 * manifest is loaded.
 */
export function locomotionPlaybackRate(speedMps: number, clipName?: string | null): number {
  if (!(speedMps > 0.2)) return 1;
  const measured = authoredStrideSpeed(clipName);
  if (measured !== null) return playbackRateFor(clipName, speedMps);
  const rate = speedMps / WALK_PLAYBACK_MPS;
  return Math.min(2.6, Math.max(0.75, rate));
}
