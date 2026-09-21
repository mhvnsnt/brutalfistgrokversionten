import test from 'node:test';
import assert from 'node:assert/strict';
import { preferredMoveLibraryModel } from './moveLibraryModelSelection';

test('prefers BANNON_rigged when the model list is populated', () => {
  assert.equal(
    preferredMoveLibraryModel(['VIPER.glb', 'BANNON_rigged.glb', 'PABLO.glb']),
    'BANNON_rigged.glb',
  );
});

test('falls back when the preferred model is absent', () => {
  assert.equal(preferredMoveLibraryModel(['VIPER.glb', 'PABLO.glb']), 'VIPER.glb');
});

test('does not capture an undefined first-render model', () => {
  assert.equal(preferredMoveLibraryModel([]), '');
  assert.equal(preferredMoveLibraryModel(['BANNON_rigged.glb']), 'BANNON_rigged.glb');
});
