import test from 'node:test';
import assert from 'node:assert/strict';
import {
  THROW_CATALOG,
  attemptThrowBreak,
  initiateThrow,
  resolveThrowAttempt,
  tickThrow,
  detectThrowInput,
} from './DirectionalThrowSystem';

test('directional throw enters a real break window instead of committing immediately', () => {
  let state = initiateThrow('forward_throw');
  for (let i = 0; i < THROW_CATALOG.forward_throw.startupFrames; i++) state = tickThrow(state);
  assert.equal(state.phase, 'active');

  state = resolveThrowAttempt(state, true, false);
  assert.equal(state.phase, 'connected');
  assert.equal(state.breakWindowOpen, true);
  assert.ok(state.breakWindowFrames > 0);

  const broken = attemptThrowBreak(state, '1');
  assert.equal(broken.success, true);
  assert.equal(broken.newState.phase, 'broken');
});

test('wrong directional throw break input does not steal the throw', () => {
  let state = initiateThrow('forward_throw');
  for (let i = 0; i < THROW_CATALOG.forward_throw.startupFrames; i++) state = tickThrow(state);
  state = resolveThrowAttempt(state, true, false);

  const result = attemptThrowBreak(state, '2');
  assert.equal(result.success, false);
  assert.equal(result.newState.phase, 'connected');
  assert.equal(result.newState.breakWindowOpen, true);
});

test('out-of-range directional throw whiffs instead of damaging', () => {
  let state = initiateThrow('side_throw_left');
  for (let i = 0; i < THROW_CATALOG.side_throw_left.startupFrames; i++) state = tickThrow(state);
  state = resolveThrowAttempt(state, false, false);
  assert.equal(state.phase, 'whiff');
  assert.equal(state.connected, false);
  assert.equal(state.whiffed, true);
});


test('forward and backward inputs select directional throws instead of side substitutions', () => {
  assert.equal(detectThrowInput({ lp: true, rp: false, lk: true, rk: false, forward: true, backward: false }), 'forward_throw');
  assert.equal(detectThrowInput({ lp: false, rp: true, lk: false, rk: true, forward: false, backward: true }), 'backward_throw');
});

test('directional throws use real grab/commit/receiver clips and bounded damage', () => {
  assert.equal(THROW_CATALOG.forward_throw.attackerAnimation, 'THROWSTART');
  assert.equal(THROW_CATALOG.forward_throw.commitAnimation, 'KNEETHROW');
  assert.equal(THROW_CATALOG.forward_throw.defenderAnimation, 'KNEETHROWREACTION');
  assert.equal(THROW_CATALOG.backward_throw.attackerAnimation, 'RENZOTHROW');
  assert.equal(THROW_CATALOG.backward_throw.commitAnimation, 'RENZOTHROW');
  assert.equal(THROW_CATALOG.backward_throw.defenderAnimation, 'RENZOTHROWREACTION');
  assert.ok(THROW_CATALOG.forward_throw.damage < 150);
  assert.ok(THROW_CATALOG.backward_throw.damage < 150);
});
