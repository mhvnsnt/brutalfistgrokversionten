// `.ts` extensions on purpose — the repo's runner resolves them literally.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FighterStateMachine } from './FighterStateMachine.ts';

/**
 * DOES A PRESS STILL COME OUT WHEN THE FRAME RATE DROPS?
 *
 * Owner, after playing: "P2's not reacting or taking any damage. And I think
 * all of my attacks are hitting myself."
 *
 * Attribution was measured first and is CORRECT — scripts/probe-damage-attribution.mjs
 * records zero self-hits and P1's damage landing on P2 every time. What the
 * same run found instead is that SIXTEEN attack presses produced FOUR attacks,
 * and the counters say the game saw all sixteen. A player who mashes and gets
 * one attack in four, while the AI attacks freely and his own bar drops, is
 * looking at exactly what he described.
 *
 * BUT THAT RUN WAS AT 3.8 FPS. Under swiftshader each 420ms press occupied
 * exactly ONE loop frame, where on a phone it would occupy about twenty-five.
 * This repo has already nearly shipped a fix for a harness artifact once, so
 * the frame rate has to be ruled in or out before anything is changed — and
 * the only way to do that honestly is off the renderer entirely, driving the
 * state machine directly at a dt we choose.
 *
 * Each press here is one frame down and one frame up, spaced as the probe
 * spaced them, so the ONLY variable between the cases is dt.
 */
const BASE = {
  forward: 0, strafe: 0, light: false, heavy: false, guard: false, crouch: false,
};

/**
 * A CLOCK THAT AGREES WITH dt.
 *
 * The state machine advances its move timers on `dt` but reads
 * `performance.now()` for every input WINDOW — the simultaneous-press
 * detector, the input buffer, the special matcher. In the real game those two
 * clocks agree, because dt IS the time since the last frame. In a test that
 * only passes dt they do not: sixteen presses land at the same wall-clock
 * instant however large a dt is claimed, so every press looks simultaneous and
 * every window looks open.
 *
 * The first version of this test did exactly that and passed 16/16 at every
 * frame rate — which was not evidence of anything. Driving the clock forward
 * with dt is what makes the test faithful, and is what reproduces what the
 * browser probe measured.
 */
function withClock<T>(run: (advance: (seconds: number) => void) => T): T {
  const real = globalThis.performance;
  let ms = 1000;
  (globalThis as { performance: unknown }).performance = {
    ...real,
    now: () => ms,
  };
  try {
    return run((seconds) => { ms += seconds * 1000; });
  } finally {
    (globalThis as { performance: unknown }).performance = real;
  }
}

/** Press each limb in turn, `gapSeconds` apart, advancing time in `dt` steps. */
function mash(dt: number, presses: number, gapSeconds: number) {
  return withClock((advance) => mashWith(dt, presses, gapSeconds, advance));
}

function mashWith(dt: number, presses: number, gapSeconds: number, advance: (s: number) => void) {
  const fsm = new FighterStateMachine();
  const buttons: Array<'lp' | 'rp' | 'lk' | 'rk'> = ['lp', 'rp', 'lk', 'rk'];
  // Settle out of the spawn state before measuring.
  const step = (input: typeof BASE) => { advance(dt); fsm.update(input, dt); };
  for (let i = 0; i < Math.ceil(0.5 / dt); i++) step(BASE);
  const before = fsm.attackStarts;

  for (let p = 0; p < presses; p++) {
    const btn = buttons[p % buttons.length];
    step({ ...BASE, [btn]: true });   // one frame down
    step(BASE);                       // one frame up
    // …then idle out the rest of the gap.
    const idle = Math.max(0, Math.round((gapSeconds - 2 * dt) / dt));
    for (let i = 0; i < idle; i++) step(BASE);
  }
  return fsm.attackStarts - before;
}

describe('an attack press comes out at any frame rate', () => {
  it('lands every press at 60fps', () => {
    assert.equal(mash(1 / 60, 16, 1.07), 16);
  });

  it('lands every press at 30fps', () => {
    assert.equal(mash(1 / 30, 16, 1.07), 16);
  });

  /**
   * The case the probe was actually measuring. A press visible for a single
   * 0.26s frame is still a press, and dropping it is frame-rate dependence in
   * the input path rather than anything the player did.
   */
  it('lands every press at the 3.8fps the headless harness runs at', () => {
    assert.equal(mash(1 / 3.8, 16, 1.07), 16);
  });
});

/**
 * A timed window must last the same length however the time arrives. The throw
 * break window is exactly 0.35s and the sub-stepper divides a large frame into
 * sixteen, which is where a float residue turns "expired" into "still open".
 */
describe('a timed window does not depend on how the time is delivered', () => {
  it('closes the throw break window at one step and at sixteen', () => {
    for (const steps of [1, 2, 16]) {
      const fsm = new FighterStateMachine();
      fsm.beginIncomingThrowBreak();
      for (let i = 0; i < steps; i++) fsm.update(BASE, 0.35 / steps);
      assert.equal(
        fsm.isThrowBreakPending, false,
        `the window was still open after 0.35s delivered as ${steps} step(s)`,
      );
    }
  });
});
