import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  COMMAND_THROW_MOVE,
  FighterStateMachine,
  type FighterInput,
} from './FighterStateMachine.ts';

const neutral = (): FighterInput => ({
  forward: 0, strafe: 0, light: false, heavy: false, guard: false,
  crouch: false, grapple: false, escape: false,
  lp: false, rp: false, lk: false, rk: false,
  overdrive: false, finisher: false, leftThrow: false, rightThrow: false,
});

describe('command throw follow-ups', () => {
  it('does not autoplay the hardcoded throw route', () => {
    const fsm = new FighterStateMachine();

    // Enter the command throw through its public input path.
    fsm.update({ ...neutral(), forward: 1 }, 0.016);
    fsm.update({ ...neutral(), forward: 1, guard: true }, 0.016);
    assert.equal(fsm.action, 'CommandThrow');

    // Simulate the arena confirming the grab. The follow-up route is now armed.
    fsm.resolveCommandThrow(true);

    // Finish the throw and let more than the old autoplay delay pass.
    fsm.update(neutral(), COMMAND_THROW_MOVE.startup + COMMAND_THROW_MOVE.active + COMMAND_THROW_MOVE.recovery + 0.10);

    assert.equal(fsm.action, 'Idle', 'the throw should finish before its follow-up');
    assert.equal(fsm.getThrowComboState().active, true, 'the authored follow-up should be waiting for input');

    // Waiting must not fire the first route entry by itself.
    fsm.update(neutral(), 0.10);
    assert.equal(fsm.action, 'Idle', 'throw follow-up autoplayed without an input');
  });

  it('fires the authored first follow-up only when the requested button is pressed', () => {
    const fsm = new FighterStateMachine();

    fsm.update({ ...neutral(), forward: 1 }, 0.016);
    fsm.update({ ...neutral(), forward: 1, guard: true }, 0.016);
    fsm.resolveCommandThrow(true);
    fsm.update(neutral(), COMMAND_THROW_MOVE.startup + COMMAND_THROW_MOVE.active + COMMAND_THROW_MOVE.recovery);

    assert.equal(fsm.getThrowComboState().route[0], 'light');

    const motion = fsm.update({ ...neutral(), light: true }, 0.016);
    assert.equal(motion, 'lightAttack');
    assert.equal(fsm.action, 'Attacking');
    assert.equal(fsm.getThrowComboState().index, 1);
  });
});
