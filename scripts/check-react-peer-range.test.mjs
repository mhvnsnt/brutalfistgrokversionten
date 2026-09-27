import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { versionsOursAdmitsTheirsRejects } from './react-peer-range.mjs';

/**
 * React 19.3.0 is published and @react-three/fiber@9.7.0 declares
 * `react: ">=19 <19.3"`. With `^19.2.0` a fresh install picks 19.3 and the
 * peer check fails. This fails if the range is ever widened back.
 */
test('our react range cannot admit a version @react-three/fiber rejects', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  let peer;
  try {
    peer = JSON.parse(readFileSync('node_modules/@react-three/fiber/package.json', 'utf8')).peerDependencies ?? {};
  } catch {
    return;   // not installed in this environment
  }
  for (const dep of ['react', 'react-dom']) {
    const theirs = peer[dep];
    const ours = pkg.dependencies?.[dep];
    if (!theirs || !ours) continue;
    const bad = versionsOursAdmitsTheirsRejects(ours, theirs);
    assert.deepEqual(bad, [], `${dep} ${ours} admits ${bad.slice(0, 3).join(', ')}, outside fiber's ${theirs}`);
  }
});

/** And the probe must be able to SEE the failure it exists to catch. */
test('the probe finds the exact version that broke the install', () => {
  const bad = versionsOursAdmitsTheirsRejects('^19.2.0', '>=19 <19.3');
  assert.ok(bad.includes('19.3.0'), `the probe missed 19.3.0; it found ${bad.slice(0, 5).join(', ')}`);
  assert.deepEqual(versionsOursAdmitsTheirsRejects('>=19.2.0 <19.3.0', '>=19 <19.3'), [], 'the pinned range should be clean');
});

/**
 * And the fix must stay a CONSTRAINT. An override here would tell npm to ignore
 * what fiber's author said it supports, moving the failure from install time
 * into the arena.
 */
test('no override silences the fiber react peer constraint', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.equal(pkg.overrides?.['@react-three/fiber'], undefined,
    'react-three/fiber peer deps are overridden — narrow our own range instead');
  for (const key of Object.keys(pkg.overrides ?? {})) {
    assert.ok(!key.includes('>'), `overrides key ${key} uses the unsupported flat "a>b" syntax; npm wants a nested object`);
  }
});
