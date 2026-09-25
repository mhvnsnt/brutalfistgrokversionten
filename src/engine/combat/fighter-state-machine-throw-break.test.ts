import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FighterStateMachine } from './FighterStateMachine.ts';

const neutral = () => ({
  forward: 0, strafe: 0, light: false, heavy: false, guard: false,
  crouch: false, grapple: false, escape: false,
  lp: false, rp: false, lk: false, rk: false,
  overdrive: false, finisher: false, leftThrow: false, rightThrow: false,
  jump: false, dashing: false, backdashing: false, running: false,
  tekkenLp: false, tekkenRp: false, tekkenLk: false, tekkenRk: false,
});

describe('authored directional throw-break buttons', () => {
  it('requires the authored 1 break button for a forward directional throw', () => {
    const defender = new FighterStateMachine();
    defender.beginIncomingThrowBreak(0, '1');
    defender.update(neutral(), 0.05);
    defender.update({ ...neutral(), rp: true }, 0.016);
    assert.equal(defender.isThrowBreakPending, true);
    defender.update({ ...neutral(), lp: true }, 0.016);
    assert.equal(defender.isThrowBreakPending, false);
    assert.equal(defender.consumeIncomingThrowBreakOutcome(), 'broken');
  });

  it('requires the authored 2 break button for a backward directional throw', () => {
    const defender = new FighterStateMachine();
    defender.beginIncomingThrowBreak(0, '2');
    defender.update(neutral(), 0.05);
    defender.update({ ...neutral(), lp: true }, 0.016);
    assert.equal(defender.isThrowBreakPending, true);
    defender.update({ ...neutral(), rp: true }, 0.016);
    assert.equal(defender.isThrowBreakPending, false);
    assert.equal(defender.consumeIncomingThrowBreakOutcome(), 'broken');
  });

  it('accepts either limb button for a side directional throw', () => {
    const defender = new FighterStateMachine();
    defender.beginIncomingThrowBreak(0, 'either');
    defender.update(neutral(), 0.05);
    defender.update({ ...neutral(), rp: true }, 0.016);
    assert.equal(defender.isThrowBreakPending, false);
    assert.equal(defender.consumeIncomingThrowBreakOutcome(), 'broken');
  });
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
