import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  DEFAULT_LIMIT_DEG_PER_SEC, angleBetween, auditBanks, auditClip, eulerToQuat,
} from './animation-continuity-audit.mjs';

const clip = (keys) => ({ dur: keys.at(-1)?.t ?? 0, keys });
const bone = (rx = 0, ry = 0, rz = 0) => ({ hips: { rx, ry, rz } });

test('a 2pi Euler jump is the SAME rotation and must not be reported', () => {
  // The trap this tool exists to avoid. sin/cos are 2pi-periodic.
  const a = eulerToQuat(0, 0, 0.3);
  const b = eulerToQuat(0, 0, 0.3 + 2 * Math.PI);
  assert.ok(angleBetween(a, b) < 1e-6, 'a 2pi wrap is not a rotation');

  const findings = auditClip(clip([
    { t: 0, bones: bone(0, 0, 0.3) },
    { t: 0.0417, bones: bone(0, 0, 0.3 + 2 * Math.PI) },
  ]));
  assert.deepEqual(findings, [], 'a wrap must not be a finding');
});

test('q and -q are the same rotation', () => {
  const q = eulerToQuat(0.4, -0.2, 1.1);
  assert.ok(angleBetween(q, q.map((v) => -v)) < 1e-6);
});

test('a genuinely impossible rotation IS reported', () => {
  const findings = auditClip(clip([
    { t: 0, bones: bone(0, 0, 0) },
    { t: 0.0417, bones: bone(0, 0, Math.PI) }, // 180 deg in one 24fps frame
  ]));
  assert.equal(findings.length, 1);
  assert.equal(findings[0].bone, 'hips');
  assert.ok(findings[0].degPerSec > DEFAULT_LIMIT_DEG_PER_SEC);
});

test('the SAME rotation over a longer gap is fine — real key times matter', () => {
  // A sparsely sampled capture is not violent motion. Using a uniform dt here
  // is what made the first pass over-report by roughly 30x.
  const findings = auditClip(clip([
    { t: 0, bones: bone(0, 0, 0) },
    { t: 0.5, bones: bone(0, 0, Math.PI) },
  ]));
  assert.deepEqual(findings, []);
});

test('a bone missing from the previous key is skipped, not counted as a jump', () => {
  const findings = auditClip(clip([
    { t: 0, bones: {} },
    { t: 0.0417, bones: bone(0, 0, Math.PI) },
  ]));
  assert.deepEqual(findings, []);
});

test('the threshold is honoured', () => {
  const keys = [
    { t: 0, bones: bone(0, 0, 0) },
    { t: 0.0417, bones: bone(0, 0, Math.PI) },
  ];
  assert.equal(auditClip(clip(keys), 100).length, 1);
  assert.equal(auditClip(clip(keys), 100000).length, 0);
});

test('THE GATE: the shipped banks stay within budget', () => {
  const banks = auditBanks();
  assert.ok(Object.keys(banks).length >= 1, 'no motion banks found to audit');
  const pairs = Object.values(banks).reduce((a, b) => a + b.pairs, 0);
  const clips = Object.values(banks).reduce((a, b) => a + b.total, 0);
  assert.ok(clips >= 300, `expected the synced banks, saw ${clips} clips`);
  // 195 when written — a thin tail in fast reaction clips, not broken data.
  // The budget catches an import that regresses, not today's data.
  assert.ok(pairs <= 400, `${pairs} impossible key pairs — an import has regressed`);
});
