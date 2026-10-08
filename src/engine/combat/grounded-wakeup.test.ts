import assert from 'node:assert/strict';
import test from 'node:test';
import { FighterStateMachine } from './FighterStateMachine.ts';

const neutral = () => ({
  forward: 0, strafe: 0, light: false, heavy: false,
  guard: false, crouch: false, jump: false, grapple: false, escape: false,
});

test('grounded knockdown stays prone instead of auto-standing', () => {
  const f = new FighterStateMachine();
  f.applyKnockdown('faceUp');
  assert.equal(f.current, 'GroundedFaceUp');

  f.update(neutral(), 1 / 60);
  assert.equal(f.current, 'GroundedFaceUp');

  f.update(neutral(), 1.5);
  assert.equal(f.current, 'GroundedFaceUp');
  assert.equal(f.isGrounded(), true);
});

test('grounded wakeup routes are distinct', () => {
  const f = new FighterStateMachine();
  f.applyKnockdown('faceDown');
  f.update(neutral(), 1.5);

  f.update({ ...neutral(), forward: 1 }, 1 / 60);
  assert.equal(f.current, 'WakeupRollForward');
});

test('grounded wake attack starts from a button edge', () => {
  const f = new FighterStateMachine();
  f.applyKnockdown('faceUp');
  f.update(neutral(), 1.5);

  f.update({ ...neutral(), heavy: true }, 1 / 60);
  assert.equal(f.current, 'WakeupAttack');
});
