import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bindPositionFromIBM, classifyArmAngle, measureBindPose } from './bind_pose.mjs';
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

test('an identity inverse-bind matrix means the joint sits at the origin', () => {
  const identity = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
  assert.deepEqual(bindPositionFromIBM(identity), [-0, -0, -0]);
});

test('the bind position is the inverse of the IBM translation', () => {
  // A pure translation of (1, 2, 3): its inverse translates by (-1,-2,-3), so
  // the joint's BIND position is (1, 2, 3).
  const ibm = [1,0,0,0, 0,1,0,0, 0,0,1,0, -1,-2,-3,1];
  const p = bindPositionFromIBM(ibm);
  assert.ok(Math.abs(p[0] - 1) < 1e-6 && Math.abs(p[1] - 2) < 1e-6 && Math.abs(p[2] - 3) < 1e-6, `got ${p}`);
});

test('arm angle classifies the three rest poses', () => {
  assert.equal(classifyArmAngle(0), 'T-POSE');
  assert.equal(classifyArmAngle(12), 'T-POSE');
  assert.equal(classifyArmAngle(45), 'A-POSE');
  assert.equal(classifyArmAngle(57), 'A-POSE');
  assert.equal(classifyArmAngle(80), 'I-POSE');
  assert.equal(classifyArmAngle(null), 'unknown');
});

test('THE FINDING: the shipped roster is overwhelmingly A-pose', async () => {
  // This is the measurement behind the reported "wrist stuck to the hip".
  // The motion banks use Mixamo bone names, and Mixamo's convention is T-pose,
  // so almost every model in the game has a rest pose ~57 degrees away from
  // the pose its borrowed animation was authored in.
  const dir = join(ROOT, 'public', 'models');
  const files = readdirSync(dir).filter((f) => f.endsWith('.glb'));
  assert.ok(files.length > 50, `expected the shipped roster, saw ${files.length}`);

  const poses = new Map();
  let measured = 0;
  for (const f of files) {
    const r = await measureBindPose(join(dir, f));
    if (r.armDeg === null || r.armDeg === undefined) continue;
    measured++;
    poses.set(r.pose, (poses.get(r.pose) ?? 0) + 1);
  }
  assert.ok(measured >= 50, `only ${measured} models had a readable bind — meshopt decoding regressed`);
  assert.ok((poses.get('A-POSE') ?? 0) >= 50, `A-pose count fell to ${poses.get('A-POSE')} — re-check the finding`);
});
