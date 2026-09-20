import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FighterStateMachine } from './FighterStateMachine.ts';

/**
 * Regression: the special catalog contains light,light,heavy and the real
 * controls feed those presses while the first attack is still animating.
 * The old 167ms buffer expired before a 440ms light attack reached recovery,
 * so the sequence could never become a special.
 */
describe('special input survives the move that is buffering it', () => {
  it('fires L,L,H as a special after the first light finishes', () => {
    const fsm = new FighterStateMachine();

    const base = {
      forward: 0, strafe: 0, light: false, heavy: false,
      guard: false, crouch: false,
    };

    // Press/release each button as a player would.
    assert.equal(fsm.update({ ...base, light: true }, 1 / 60), 'lightAttack');
    fsm.update(base, 1 / 60);

    fsm.update({ ...base, light: true }, 1 / 60);
    fsm.update(base, 1 / 60);

    fsm.update({ ...base, heavy: true }, 1 / 60);
    fsm.update(base, 1 / 60);

    // Light attack recovery begins at 0.22s. Advance past the end while the
    // buffered L,L,H sequence is still inside the bounded 600ms window.
    const motion = fsm.update(base, 0.40);

    assert.equal(motion, 'lightAttack');
    assert.equal(fsm.action, 'Attacking');
    assert.equal(fsm.activeMoveName(), 'Quick Combo', 'L,L,H must resolve to the special, not a buffered jab');
  });
});
