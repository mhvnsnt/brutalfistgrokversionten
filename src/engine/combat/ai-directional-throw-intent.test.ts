import test from 'node:test';
import assert from 'node:assert/strict';
import { selectAIDirectionalThrowId } from './ai-directional-throw-intent';

test('AI stays on ordinary attacks outside directional throw range', () => {
  assert.equal(
    selectAIDirectionalThrowId({
      distance: 1.36,
      distZ: 0,
      cycle: 4,
      powerStyle: true,
      evasiveStyle: false,
    }),
    null,
  );
});

test('AI uses the standard forward throw in close neutral range', () => {
  assert.equal(
    selectAIDirectionalThrowId({
      distance: 1.2,
      distZ: 0.2,
      cycle: 4,
      powerStyle: false,
      evasiveStyle: false,
    }),
    'forward_throw',
  );
});

test('power AI uses the backward throw on its heavy throw cycle', () => {
  assert.equal(
    selectAIDirectionalThrowId({
      distance: 1.2,
      distZ: 0.2,
      cycle: 2,
      powerStyle: true,
      evasiveStyle: false,
    }),
    'backward_throw',
  );
});

test('lateral spacing selects a deterministic side throw', () => {
  assert.equal(
    selectAIDirectionalThrowId({
      distance: 1.2,
      distZ: 0.8,
      cycle: 4,
      powerStyle: false,
      evasiveStyle: false,
    }),
    'side_throw_right',
  );
  assert.equal(
    selectAIDirectionalThrowId({
      distance: 1.2,
      distZ: 0.8,
      cycle: 4,
      powerStyle: false,
      evasiveStyle: true,
    }),
    'side_throw_left',
  );
});

test('non-throw cycles remain non-throw even at point-blank range', () => {
  assert.equal(
    selectAIDirectionalThrowId({
      distance: 0.9,
      distZ: 0,
      cycle: 1,
      powerStyle: true,
      evasiveStyle: false,
    }),
    null,
  );
});
