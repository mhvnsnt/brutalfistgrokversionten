/**
 * A BODY CANNOT TURN INSTANTLY, AND OURS COULD.
 *
 * Owner, on the combat looking glitchy. Taken from Tekken 3's own source, in
 * the recompilation sitting in this workspace — tekken3_jun_combat.c, the
 * facing blend:
 *
 *     int frame = ...; if (frame > 8) frame = 8;      // eight-frame blend
 *     int step  = ((axis - facing) * frame) / 8;      // proportional step
 *     if (step >  0x71c) step =  0x71c;               // and CLAMPED
 *     if (step < -0x71c) step = -0x71c;
 *     facing += step;
 *
 * with the comment "match the source camera-plane axis, closest half-turn, and
 * eight-frame blend". The PS1 uses 65536 units for a full turn, so 0x71c is
 * 1820 units — exactly 10.0 DEGREES PER FRAME, hard capped.
 *
 * OURS HAD NO LIMIT AT ALL. `faceOpponentYaw` is an atan2 of the two positions,
 * recomputed every frame and written straight to the mesh, so when the pair
 * cross over or sidestep past each other the body SNAPS through up to 180
 * degrees in a single frame. That is not a subtle thing to watch — it is a
 * fighter instantaneously facing the other way, and it is exactly the kind of
 * pop that reads as buggy.
 *
 * This is the same rule: step toward the target, the short way round, no faster
 * than Tekken allows.
 */

/** Tekken 3's cap: 0x71c of 65536 units per frame. */
export const MAX_TURN_DEG_PER_FRAME = (0x71c / 65536) * 360;
export const MAX_TURN_RAD_PER_FRAME = MAX_TURN_DEG_PER_FRAME * (Math.PI / 180);
/** Tekken blends a facing change over eight frames. */
export const FACING_BLEND_FRAMES = 8;

const TAU = Math.PI * 2;
/** Below this the facing is close enough to snap; half a degree. */
const SETTLE_RAD = 0.5 * (Math.PI / 180);

/** The signed short way from `a` to `b`, in radians, always within +/-PI. */
export function shortestTurn(a: number, b: number): number {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

/**
 * Step a facing toward its target at Tekken's rate.
 *
 * `frames` is how many 60fps frames have passed, so a slow device turns by the
 * same amount of rotation per unit of TIME rather than per rendered frame —
 * otherwise the turn rate would depend on the frame rate, which is the bug this
 * function exists to avoid re-introducing.
 */
export function stepFacing(current: number, target: number, frames: number): number {
  if (!Number.isFinite(current)) return target;
  const delta = shortestTurn(current, target);
  // The eight-frame blend: cover a fraction of the remaining angle, then clamp
  // that to the hard per-frame cap. Both halves are Tekken's.
  const blended = delta * Math.min(1, frames / FACING_BLEND_FRAMES);
  const cap = MAX_TURN_RAD_PER_FRAME * Math.max(1, frames);
  const step = Math.max(-cap, Math.min(cap, blended));
  // The eight-frame blend covers a FRACTION of what remains, which approaches
  // the target without ever reaching it. Below half a degree the difference is
  // invisible, so land on it exactly rather than creeping for ever — a facing
  // that never settles keeps the mesh re-rendering and never quite points at
  // the opponent.
  if (Math.abs(delta) <= Math.abs(step) || Math.abs(delta) < SETTLE_RAD) return target;
  return current + step;
}
