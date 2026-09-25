// `.ts` extensions on purpose — the repo's runner resolves them literally.

/**
 * THE AUTHORED TRAVEL IN EVERY MOVE, WHICH NOTHING WAS READING.
 *
 * Owner: "combat is a bit smoother, but it's still not on the level of Tekken …
 * I can tell you're still hand tooling things when I told you to pull in open
 * source for these fixes … actually pull stuff from [the Schwarzerblitz repo]."
 *
 * He was right, and here is the count. The engine decided how far an attack
 * carries a fighter from ATTACK_ROOT_MOTION_PROFILES — a hand-written table of
 * FIVE entries keyed by animation name. Meanwhile the imported Schwarzerblitz
 * move graph carries authored per-frame root motion on 127 of its 133 moves,
 * and not one line of the engine read it. A lunging punch did not lunge unless
 * it happened to be one of the five.
 *
 * WHAT THE NUMBERS MEAN — read out of the engine's own source, not inferred:
 *
 *   - `FK_Move::setMovementAtFrame` builds `vector3df(movementPar, movementSide,
 *     movementVert)`, so the three components are PARALLEL (along facing), SIDE
 *     (lateral) and VERTICAL. `FK_Character` zeroing `.Z` on ground contact is
 *     what pins the third as vertical.
 *   - `movementFrame` is a per-frame array the length of the move, zero-filled
 *     by `resetMovementFrameArray`, so a frame nobody wrote contributes nothing.
 *   - `FK_Character` applies it as
 *         getMovementAtFrame(floor(frame)) * (frame - lastFrame)
 *     so a stored value is a velocity in units PER FRAME.
 *   - `>` at the start of a movement line is the INTERPOLATION FLAG, not a
 *     bullet. `FK_MoveFileParser`'s interpolate branch spreads the line's
 *     numbers evenly over the frames since the previous entry:
 *         each frame in (lastFrame, frame] gets value / (frame - lastFrame)
 *     A line without it writes ONE frame — an impulse.
 *
 * MEASURED over the source files: 165 of 169 movement lines carry `>`. The
 * importer used to discard it as decoration, so every one of those authored
 * travels would have been read as a single-frame teleport. That is fixed in
 * sync-schwarzerblitz-moves.mjs; this module is the consumer.
 *
 * SCALE. Two candidate anchors disagree, and the disagreement is real rather
 * than an error: Schwarzerblitz walks at 80 units/s where we walk at 2.2 m/s
 * (0.0275 m/unit), but its moves are authored with strike ranges of 55-95 units
 * against our measured connect distance of about 0.8 m (0.0125 m/unit). No
 * single scale preserves both, because the two games make different choices
 * about how fast a fighter walks relative to his own reach.
 *
 * Root motion is a SPATIAL quantity — how far a lunge carries you relative to
 * what you can reach — so the range anchor is the right one. 65 units is the
 * modal authored strike range and our jab connects at about 0.8 m, which gives
 * 1 unit = 1/80 m. Under it a 100-unit lunge travels 1.25 m, a -40 backstep
 * half a metre, and a 60 sidestep 0.75 m: all in the band the hand-written
 * table was reaching for, with the per-move variety it could never have.
 */

/** FK_BasicAnimationRate, read out of FK_Database.h. */
export const SB_SOURCE_FPS = 24;

/** See the scale note above. */
export const METRES_PER_SB_UNIT = 1 / 80;

export interface SbMovementEntry {
  frame: number;
  x: number;
  y: number;
  z: number;
  interpolate?: boolean;
}

/** One frame of authored travel, in metres, in THIS engine's axes. */
export interface RootMotionFrame {
  /** Along the fighter's facing. Positive is toward the opponent. */
  forward: number;
  /** Lateral, this engine's Z. */
  lateral: number;
  /** Vertical, this engine's Y. */
  vertical: number;
}

/**
 * Expand the sparse authored entries into the per-frame array the source engine
 * builds, converted to metres in this engine's axes.
 *
 * `frames` is the move's length in SOURCE frames. Entries past it are dropped,
 * exactly as `setMovementAtFrame`'s own bounds check drops them.
 */
export function expandRootMotion(
  entries: readonly SbMovementEntry[] | undefined,
  frames: number,
): RootMotionFrame[] {
  const out: RootMotionFrame[] = [];
  const total = Math.max(0, Math.floor(frames));
  for (let i = 0; i < total; i++) out.push({ forward: 0, lateral: 0, vertical: 0 });
  if (!entries?.length || !total) return out;

  const write = (frame: number, x: number, y: number, z: number) => {
    if (frame < 0 || frame >= total) return;
    out[frame] = {
      forward: x * METRES_PER_SB_UNIT,
      lateral: y * METRES_PER_SB_UNIT,
      vertical: z * METRES_PER_SB_UNIT,
    };
  };

  let lastFrame = 0;
  for (const e of entries) {
    const frame = Math.floor(e.frame);
    if (e.interpolate === false) {
      // An impulse: one frame carries the whole value.
      write(frame, e.x, e.y, e.z);
    } else {
      const span = frame - lastFrame;
      if (span <= 0) {
        write(frame, e.x, e.y, e.z);
      } else {
        for (let k = 1; k <= span; k++) write(lastFrame + k, e.x / span, e.y / span, e.z / span);
      }
    }
    lastFrame = frame;
  }
  return out;
}

/** Total travel of a move, in metres. Useful for gating and for tests. */
export function rootMotionTotal(curve: readonly RootMotionFrame[]): RootMotionFrame {
  return curve.reduce(
    (a, f) => ({ forward: a.forward + f.forward, lateral: a.lateral + f.lateral, vertical: a.vertical + f.vertical }),
    { forward: 0, lateral: 0, vertical: 0 },
  );
}

/**
 * Displacement between two times, in metres — what a variable-dt game loop
 * needs. `from` and `to` are seconds since the move began.
 *
 * Sampling BETWEEN two times rather than reporting a velocity at one is what
 * makes this frame-rate independent: a loop that skips from 0.0s to 0.3s still
 * gets every metre the move authored across that span, instead of one frame's
 * worth multiplied by a large dt.
 */
export function rootMotionBetween(
  curve: readonly RootMotionFrame[],
  from: number,
  to: number,
): RootMotionFrame {
  const acc = { forward: 0, lateral: 0, vertical: 0 };
  if (!curve.length || to <= from) return acc;
  const frameLen = 1 / SB_SOURCE_FPS;
  for (let i = 0; i < curve.length; i++) {
    const start = i * frameLen;
    const end = start + frameLen;
    // How much of THIS source frame falls inside the requested span.
    const overlap = Math.min(end, to) - Math.max(start, from);
    if (overlap <= 0) continue;
    const share = overlap / frameLen;
    acc.forward += curve[i].forward * share;
    acc.lateral += curve[i].lateral * share;
    acc.vertical += curve[i].vertical * share;
  }
  return acc;
}
