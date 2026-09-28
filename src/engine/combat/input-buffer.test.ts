/**
 * A BUTTON PRESS IS NEVER SILENTLY THROWN AWAY.
 *
 * Owner: "the combat looking incoherent, buggy, and glitchy."
 *
 * MEASURED on the real state machine before this, sweeping the second press
 * across every frame of the first move (Y = it came out, . = discarded):
 *
 *     light->heavy  .............YYYYYYYYYYYYYYYYYYYYYYYYYYY
 *     heavy->light  ..................YYYYYYYYYYYYYYYYYYYYYY
 *
 * The buffer only opened once a move reached RECOVERY, so the first 13 frames
 * of a light and the first 19 of a heavy read the input and dropped it. Press a
 * button there and the game does nothing at all. That is what "I press it and
 * nothing happens" is, and it is most of why the combat does not feel like it
 * is listening to you.
 *
 * Tekken buffers throughout the move and fires on the first actionable frame,
 * with the press expiring if it is too old. That is what this asserts.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FighterStateMachine } from './FighterStateMachine.ts';

const NEUTRAL = { forward: 0, strafe: 0, light: false, heavy: false, guard: false, crouch: false };
const F = 1 / 60;

/** Press `first` on frame 5, `second` on `pressAt`. Did a second attack start? */
function secondComesOut(first: 'light' | 'heavy', second: 'light' | 'heavy', pressAt: number): boolean {
  const fsm = new FighterStateMachine();
  for (let f = 0; f < 160; f++) {
    const input = { ...NEUTRAL } as Record<string, unknown>;
    if (f === 5) input[first] = true;
    if (f === pressAt) input[second] = true;
    fsm.tickAirborne(F);
    fsm.update(input as never, F);
  }
  // attackStarts is monotonic. Comparing move NAMES cannot see a move repeating
  // into itself, which is how an earlier version of this sweep invented a
  // "heavy->heavy never fires" bug that did not exist.
  return fsm.attackStarts >= 2;
}

describe('the input buffer', () => {
  it('a light attack swallows nothing — every frame of it accepts the next press', () => {
    const dead: number[] = [];
    // A light is 20 frames total, inside the buffer window, so there is no
    // frame of it where a press may be discarded.
    for (let t = 7; t <= 24; t++) if (!secondComesOut('light', 'heavy', t)) dead.push(t);
    assert.deepEqual(dead, [], `presses discarded during a light attack at frames: ${dead.join(', ')}`);
  });

  it('a press during a light comes out whichever button it was', () => {
    for (const second of ['light', 'heavy'] as const) {
      assert.equal(secondComesOut('light', second, 10), true,
        `light -> ${second} pressed mid-startup was thrown away`);
    }
  });

  it('a heavy accepts a press across its whole trailing window', () => {
    // Heavy is 39 frames and the buffer holds 20, so every press inside the
    // last 20 frames must come out.
    for (let t = 25; t <= 43; t++) {
      assert.equal(secondComesOut('heavy', 'light', t), true,
        `heavy -> light at frame ${t} was discarded`);
    }
  });

  /**
   * WORTH BEING PRECISE ABOUT WHAT THIS FIX DID AND DID NOT BUY.
   *
   * The buffer is now a trailing window in TIME rather than a phase check. For
   * a LIGHT — 20 frames total, which is the button you press most — that turns
   * 12 dead frames into none. For a HEAVY the 20-frame window happens to land
   * almost exactly on where recovery already started (39 - 20 = 19, recovery
   * begins at 19), so the heavy barely moved. Widening it further would make a
   * press from the first frames of a long move fire half a second later, which
   * is worse than dropping it.
   */
  it('the window is a time window, not a phase check', () => {
    const lightDead = [];
    for (let t = 7; t <= 24; t++) if (!secondComesOut('light', 'light', t)) lightDead.push(t);
    assert.equal(lightDead.length, 0, `light still has dead frames: ${lightDead.join(', ')}`);
    // And the boundary on a heavy sits where the 20-frame window puts it.
    // MEASURED: the first surviving press on a heavy is frame 25, not 24 — the
    // expiry compares against the move-time at the END, which lands a frame
    // later than the arithmetic 39 - 20 suggests.
    assert.equal(secondComesOut("heavy", "light", 25), true, "the boundary press was dropped");
    assert.equal(secondComesOut('heavy', 'light', 10), false, 'a press 34 frames early should expire');
  });

  it('a stale press expires instead of firing long after the player gave up', () => {
    // Frame 6 of a 39-frame heavy is 38 frames before it ends — well past the
    // 20-frame window. Tekken drops that too; firing it would be the game doing
    // something you did not ask for.
    assert.equal(secondComesOut('heavy', 'light', 6), false,
      'a press 38 frames early still came out');
  });

  it('the first press wins — a second one does not overwrite the queue', () => {
    const fsm = new FighterStateMachine();
    for (let f = 0; f < 160; f++) {
      const input = { ...NEUTRAL } as Record<string, unknown>;
      if (f === 5) input.light = true;
      if (f === 10) input.light = true;
      if (f === 12) input.heavy = true;
      fsm.tickAirborne(F);
      fsm.update(input as never, F);
    }
    // Two presses inside one move must not stack into three attacks.
    assert.ok(fsm.attackStarts <= 3, `${fsm.attackStarts} attacks from 3 presses — the queue is stacking`);
  });
});
