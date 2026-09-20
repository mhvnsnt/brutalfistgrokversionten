import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FighterStateMachine } from './FighterStateMachine.ts';

const neutral = () => ({
  forward: 0, strafe: 0, light: false, heavy: false, guard: false,
  crouch: false, grapple: false, escape: false,
  lp: false, rp: false, lk: false, rk: false,
  overdrive: false, finisher: false, leftThrow: false, rightThrow: false,
});

describe('live throw-break state', () => {
  it('lets the defender escape before the throw commits', () => {
    const defender = new FighterStateMachine();
    defender.beginIncomingThrowBreak();

    defender.update(neutral(), 0.05);
    assert.equal(defender.isThrowBreakPending, true);

    const escaped = defender.update({ ...neutral(), escape: true }, 0.016);
    assert.equal(escaped, 'idle');
    assert.equal(defender.isThrowBreakPending, false);
    assert.equal(defender.consumeIncomingThrowBreakOutcome(), 'broken');
    assert.equal(defender.consumeIncomingThrowBreakOutcome(), null);
  });

  it('commits when the reaction window expires', () => {
    const defender = new FighterStateMachine();
    defender.beginIncomingThrowBreak();

    defender.update(neutral(), 0.35);
    assert.equal(defender.isThrowBreakPending, false);
    assert.equal(defender.consumeIncomingThrowBreakOutcome(), 'committed');
  });
});
