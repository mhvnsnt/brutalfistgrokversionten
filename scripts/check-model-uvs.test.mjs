import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

/**
 * A compressor that prunes "unused" UVs takes MAIME's face paint with them, and
 * the failure is silent — the model loads and the texture has nowhere to land.
 * Measured on brutalfist11's MAIME_skinned: seams 2954 -> 0, attribute gone.
 */
test('no shipped model has lost its texture coordinates', { skip: !existsSync('public/models') }, () => {
  let out = '';
  let failed = false;
  try {
    out = execFileSync('node', ['scripts/check-model-uvs.mjs', '--gate'], { encoding: 'utf8' });
  } catch (e) {
    out = `${e.stdout ?? ''}${e.stderr ?? ''}`;
    failed = true;
  }
  assert.match(out, /\d+ models checked/, 'the gate did not report a count — it looked at nothing');
  assert.ok(!/ 0 models checked/.test(out), 'zero models checked is a tool failure, not a pass');
  assert.equal(failed, false, out.split('\n').filter((l) => /FAIL|MIXED/.test(l)).slice(0, 4).join(' | '));
});
