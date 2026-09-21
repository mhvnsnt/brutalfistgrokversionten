import test from 'node:test';
import assert from 'node:assert/strict';
import {
  THROW_CATALOG,
  attemptThrowBreak,
  initiateThrow,
  resolveThrowAttempt,
  tickThrow,
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
