import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildStrikeClipPool } from './StrikeClipPool.ts';

const index = JSON.parse(readFileSync('public/motion/baked/index.json', 'utf8'));
const oss = Object.entries(index).filter(([, e]: [string, any]) => e?.intake === 'oss-universal-intake');

test('every open-source intake clip carries licence class and provenance', () => {
  assert.ok(oss.length > 0, 'no intake clips in the bake');
  for (const [name, e] of oss as [string, any][]) {
    assert.ok(['CC0-1.0', 'CMU-free-use (not CC0)'].includes(e.provenance?.license), `${name} licence ${e.provenance?.license}`);
    assert.ok(e.provenance?.file && e.provenance?.intakeVerdict, `${name} missing provenance`);
    assert.equal(e.bodies, 1, `${name} must be a solo capture`);
    if (name.startsWith('OSS_CMU_')) assert.equal(e.provenance.license, 'CMU-free-use (not CC0)');
  }
});

test('the strike pool admits intake clips only through its own gates, and knees by knee reach', () => {
  const { pool, rejected } = buildStrikeClipPool(index);
  const admitted = pool.filter((c) => c.name.startsWith('OSS_'));
  assert.ok(admitted.length > 0);
  for (const c of admitted) assert.ok(c.hand >= 0.35 || c.foot >= 0.6 || c.admittedBy === 'knee', `${c.name} slipped past the reach gate`);
  for (const c of pool.filter((x) => x.admittedBy === 'knee')) assert.equal(c.kick, true);
  // Refusals still apply to intake clips.
  assert.ok(Object.keys(rejected).some((n) => n.startsWith('OSS_')), 'expected some intake clips refused by the pool gates');
});
