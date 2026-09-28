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
export const WALK_PLAYBACK_MPS = 0.90;

/**
 * A NUDGE IS 12%, NOT 45%.
 *
 * Owner: "the animation plays very quickly ... it doesn't play long enough for
 * the full animation to play out. The move never looks like it makes contact."
 *
 * The band above this used to be `fit >= 0.8 && fit <= 1.45`, which called a
 * 45% fast-forward a nudge -- the exact twitch the comment at the top of this
 * file warns about. MEASURED on the clips that actually play in a match:
 *
 *   GRAFQUICKJAB  0.458s in a 0.333s light window -> fit 1.375 -> played 1.38x
 *   GYAKUZUKI     0.417s                          -> fit 1.25  -> played 1.25x
 *   HEAVYKICK     0.542s                          -> fit 1.63  -> 1x, then cut
 *
 * So every light attack ran a quarter to nearly two-fifths faster than it was
 * authored, and the one that did not was truncated instead. Both read as a body
 * that starts a punch and never lands it.
 *
 * THE DEEPER SHAPE, and it is the difference from the game this is measured
 * against: a Schwarzerblitz move IS a slice of its animation -- the move
 * carries `animation`, `frameStart` and `frameEnd`, so the window cannot
 * disagree with the motion. Ours are two independent numbers: the window is
 * `startup + active + recovery`, authored, and the clip is imported mocap, and
 * nothing ever reconciled them. The speedup was the seam absorbing the
 * difference, all of it on the animation's side.
 *
 * So the speedup is capped at a real nudge and the ANIMATION LAYER holds the
 * strike long enough to finish instead (see `attackHoldSeconds`). Startup and
 * active are untouched, so when a move hits and what it is worth on block do
 * not move -- only how long the body is given to show the motion.
 */
/** The most a strike may be sped up before it reads as a twitch, not a punch. */
export const ATTACK_MAX_SPEEDUP = 1.0;
/**
 * Past this, the clip is simply the wrong length for the slot — a long demo
 * resolved onto a jab — and that is a data problem, not a playback one. It
 * keeps the old behaviour: play at 1x and let the state machine cut it.
 */
export const ATTACK_RECONCILE_MAX_FIT = 2.2;

export function attackPlaybackRate(clipDuration: number, windowSeconds: number): number {
  if (!(clipDuration > 0) || !(windowSeconds > 0)) return 1;
  const fit = clipDuration / windowSeconds;
  if (fit > ATTACK_RECONCILE_MAX_FIT) return 1;
  // A clip SHORTER than its window is not slowed. Stretching it is slow motion;
  // Tekken plays it at its authored speed and the last frame holds through
  // recovery. Only a clip that overruns its window needs reconciling at all.
  if (fit <= 1) return 1;
  return Math.min(ATTACK_MAX_SPEEDUP, fit);
}

/**
 * How long the animation layer must hold the strike for the motion to finish.
 *
 * The state machine's own window is unchanged -- this only stops the body being
 * yanked off the swing before the arm arrives. A clip too far from its window
 * to reconcile keeps the old behaviour and is cut.
 */
export function attackHoldSeconds(clipDuration: number, windowSeconds: number): number {
  if (!(windowSeconds > 0)) return 0;
  if (!(clipDuration > 0)) return windowSeconds;
  if (clipDuration / windowSeconds > ATTACK_RECONCILE_MAX_FIT) return windowSeconds;
  const rate = attackPlaybackRate(clipDuration, windowSeconds);
  return Math.max(windowSeconds, clipDuration / rate);
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
  // Unmeasured clips stay authored-speed at the deliberate walk tier. Dash/run
  // is different: its engine tier is intentionally faster, so an unmeasured
  // locomotion clip must advance by the same tier ratio or its feet visibly lag.
  return speedMps > WALK_PLAYBACK_MPS * 1.15 ? speedMps / WALK_PLAYBACK_MPS : 1;
}
