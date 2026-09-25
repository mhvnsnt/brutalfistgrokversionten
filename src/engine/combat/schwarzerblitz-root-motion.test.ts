// `.ts` extensions on purpose — the repo's runner resolves them literally.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { SCHWARZERBLITZ_MOVE_GRAPH } from '../../generated/SchwarzerblitzMoveGraph.generated.ts';
import {
  METRES_PER_SB_UNIT, SB_SOURCE_FPS, expandRootMotion, rootMotionBetween, rootMotionTotal,
} from './SchwarzerblitzRootMotion.ts';

describe('authored root motion expands the way the source engine expands it', () => {
  /**
   * The interpolation rule, straight out of FK_MoveFileParser: the numbers are
   * a TOTAL spread evenly over the frames since the previous entry. One line at
   * frame 4 therefore fills frames 1..4 with a quarter each, and frame 0 — which
   * nobody wrote — stays at zero.
   */
  it('spreads an interpolated entry over the frames since the last one', () => {
    const curve = expandRootMotion([{ frame: 4, x: 80, y: 0, z: 0, interpolate: true }], 8);
    assert.equal(curve[0].forward, 0, 'frame 0 was never written and must stay still');
    for (let i = 1; i <= 4; i++) {
      assert.ok(Math.abs(curve[i].forward - 20 * METRES_PER_SB_UNIT) < 1e-9, `frame ${i}`);
    }
    assert.equal(curve[5].forward, 0, 'the move stops travelling after the entry');
    assert.ok(Math.abs(rootMotionTotal(curve).forward - 80 * METRES_PER_SB_UNIT) < 1e-9);
  });

  it('applies a non-interpolated entry to exactly one frame', () => {
    const curve = expandRootMotion([{ frame: 3, x: 80, y: 0, z: 0, interpolate: false }], 8);
    assert.ok(Math.abs(curve[3].forward - 80 * METRES_PER_SB_UNIT) < 1e-9);
    assert.equal(curve[2].forward, 0);
    assert.equal(curve[4].forward, 0);
  });

  /**
   * A back-step then a lunge, with the explicit zero the source writes between
   * them. Getting this wrong — treating the entries as held velocities — makes
   * the fighter keep drifting backwards through the zero.
   */
  it('handles a back-step, a stop and a lunge in one move', () => {
    const curve = expandRootMotion([
      { frame: 4, x: -30, y: 0, z: 0, interpolate: true },
      { frame: 8, x: 0, y: 0, z: 0, interpolate: true },
      { frame: 11, x: 60, y: 0, z: 0, interpolate: true },
    ], 12);
    const total = rootMotionTotal(curve);
    assert.ok(Math.abs(total.forward - 30 * METRES_PER_SB_UNIT) < 1e-9, `net travel ${total.forward}`);
    assert.ok(curve[2].forward < 0, 'the early frames go backwards');
    assert.equal(curve[6].forward, 0, 'the stop really stops');
    assert.ok(curve[10].forward > 0, 'the late frames lunge forward');
  });

  it('keeps the three axes apart — parallel, lateral, vertical', () => {
    const curve = expandRootMotion([{ frame: 2, x: 10, y: 20, z: 30, interpolate: true }], 4);
    const t = rootMotionTotal(curve);
    assert.ok(Math.abs(t.forward - 10 * METRES_PER_SB_UNIT) < 1e-9);
    assert.ok(Math.abs(t.lateral - 20 * METRES_PER_SB_UNIT) < 1e-9);
    assert.ok(Math.abs(t.vertical - 30 * METRES_PER_SB_UNIT) < 1e-9);
  });

  /**
   * The source drops only the frames that fall outside the move — it does not
   * discard the whole entry. `setMovementAtFrame`'s bounds check runs per
   * frame inside the interpolation loop, so an entry reaching past the end
   * still writes the part that fits, at the rate the full span implies.
   * (My first expectation here was that the entry vanished entirely; the
   * parser says otherwise.)
   */
  it('keeps only the in-range frames of an entry that reaches past the end', () => {
    const curve = expandRootMotion([{ frame: 99, x: 100, y: 0, z: 0, interpolate: true }], 4);
    assert.equal(curve.length, 4);
    const perFrame = (100 / 99) * METRES_PER_SB_UNIT;
    assert.equal(curve[0].forward, 0, 'frame 0 is never written by an interpolated entry');
    for (let i = 1; i < 4; i++) {
      assert.ok(Math.abs(curve[i].forward - perFrame) < 1e-9, `frame ${i}`);
    }
  });
});

describe('sampling between two times is frame-rate independent', () => {
  // 13 frames long so the entry at frame 12 lands INSIDE the move. A 12-frame
  // move has frames 0..11, and the source's own size guard in
  // getMovementAtFrame returns zero past the end — so frame 12 would be
  // dropped, which is correct and is covered above.
  const curve = expandRootMotion([{ frame: 12, x: 120, y: 0, z: 0, interpolate: true }], 13);

  it('one big step gives the same travel as many small ones', () => {
    const whole = rootMotionBetween(curve, 0, 13 / SB_SOURCE_FPS).forward;
    let piecewise = 0;
    const step = 1 / 240;
    for (let t = 0; t < 13 / SB_SOURCE_FPS; t += step) {
      piecewise += rootMotionBetween(curve, t, t + step).forward;
    }
    assert.ok(Math.abs(whole - piecewise) < 1e-6, `${whole} vs ${piecewise}`);
    assert.ok(Math.abs(whole - 120 * METRES_PER_SB_UNIT) < 1e-9, `whole ${whole}`);
  });

  it('asking for time before the move has run returns nothing', () => {
    assert.equal(rootMotionBetween(curve, 0, 0).forward, 0);
  });
});

/**
 * THE REAL DATA, NOT A FIXTURE. If the import ever loses the interpolation flag
 * again, these totals collapse and this test says so.
 */
describe('the imported move graph carries usable travel', () => {
  const moves = Object.values(SCHWARZERBLITZ_MOVE_GRAPH).flat();

  it('most moves author some root motion', () => {
    const withMovement = moves.filter((m) => (m.movement ?? []).length > 0);
    assert.ok(withMovement.length > 100, `only ${withMovement.length} moves carry movement`);
  });

  it('the travel lands in a believable range for a fighting game', () => {
    let biggest = 0;
    for (const m of moves) {
      const frames = m.frames ? m.frames[1] : 0;
      if (!frames) continue;
      const total = rootMotionTotal(expandRootMotion(m.movement, frames));
      biggest = Math.max(biggest, Math.abs(total.forward));
    }
    // A lunge should cross something between a step and a dash — not millimetres,
    // and not the width of the stage.
    assert.ok(biggest > 0.2, `the longest authored travel is only ${biggest.toFixed(3)}m`);
    assert.ok(biggest < 4, `the longest authored travel is ${biggest.toFixed(3)}m — check the scale`);
  });
});
