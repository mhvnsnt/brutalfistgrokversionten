// `.ts` extensions on purpose — `node --experimental-strip-types --test`
// resolves them literally.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';

import {
  JOINT_LIMITS,
  SPINE_CHAIN,
  angleDeg,
  clampToJointLimits,
  redistributeChain,
  swingTwist,
} from './SkeletalLimits.ts';

const Y = new THREE.Vector3(0, 1, 0);

function quatTrack(bone: string, qs: THREE.Quaternion[]): THREE.QuaternionKeyframeTrack {
  const v: number[] = [];
  for (const q of qs) v.push(q.x, q.y, q.z, q.w);
  return new THREE.QuaternionKeyframeTrack(
    `${bone}.quaternion`,
    qs.map((_, i) => i / Math.max(1, qs.length - 1)),
    v,
  );
}

test('swing-twist separates an axial roll from a bend', () => {
  const roll = new THREE.Quaternion().setFromAxisAngle(Y, THREE.MathUtils.degToRad(50));
  const bend = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(20));
  const { swing, twist } = swingTwist(roll.clone().multiply(bend), Y);
  assert.ok(Math.abs(angleDeg(twist) - 50) < 0.5, `twist read ${angleDeg(twist).toFixed(1)}, expected 50`);
  assert.ok(Math.abs(angleDeg(swing) - 20) < 0.5, `swing read ${angleDeg(swing).toFixed(1)}, expected 20`);
});

test('a 111 degree head twist is held at the cervical limit', () => {
  // MEASURED before this existed: attack_rk and ROUNDHOUSEKICK both put 111
  // degrees of axial rotation on the head. A cervical spine gives about 80 to
  // each side IN TOTAL, shared with the neck. That is the owl-neck the owner
  // reported, and it is what this refuses.
  const bone = 'mixamorigHead';
  const bind = new THREE.Quaternion();
  const owl = new THREE.Quaternion().setFromAxisAngle(Y, THREE.MathUtils.degToRad(111));
  const clip = new THREE.AnimationClip('OWL', 1, [quatTrack(bone, [bind.clone(), owl])]);

  const violations = clampToJointLimits(clip, new Map([[bone, bind]]));
  assert.equal(violations.length, 1);
  assert.ok(violations[0].twist > 110, 'the violation must report what it actually saw');

  const v = clip.tracks[0].values;
  const after = new THREE.Quaternion(v[4], v[5], v[6], v[7]);
  const { twist } = swingTwist(after, Y);
  assert.ok(
    angleDeg(twist) <= JOINT_LIMITS[bone].twist + 0.5,
    `head twist still ${angleDeg(twist).toFixed(1)} after clamping`,
  );
  // The AXIS must survive — the head still turns the way it was turning.
  assert.ok(after.y * owl.y > 0, 'clamping must not reverse the direction of the turn');
});

test('a pose already inside its range is left byte-identical', () => {
  const bone = 'mixamorigNeck';
  const bind = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.1);
  const gentle = bind.clone().multiply(new THREE.Quaternion().setFromAxisAngle(Y, THREE.MathUtils.degToRad(20)));
  const clip = new THREE.AnimationClip('OK', 1, [quatTrack(bone, [bind.clone(), gentle])]);
  const before = Array.from(clip.tracks[0].values);

  const violations = clampToJointLimits(clip, new Map([[bone, bind]]));
  assert.equal(violations.length, 0);
  assert.deepEqual(Array.from(clip.tracks[0].values), before);
});

test('an unlimited joint is never touched', () => {
  const bone = 'mixamorigLeftHand'; // no entry in JOINT_LIMITS
  const bind = new THREE.Quaternion();
  const wild = new THREE.Quaternion().setFromAxisAngle(Y, THREE.MathUtils.degToRad(170));
  const clip = new THREE.AnimationClip('WILD', 1, [quatTrack(bone, [bind.clone(), wild])]);
  const before = Array.from(clip.tracks[0].values);
  assert.equal(clampToJointLimits(clip, new Map([[bone, bind]])).length, 0);
  assert.deepEqual(Array.from(clip.tracks[0].values), before);
});

test('a two-segment source spine is spread over all three of ours, total preserved', () => {
  // The Schwarzerblitz source drives Spine and Spine2 and has no Spine1, so a
  // bend authored across three joints was forced through two. MEASURED on
  // attack_rk before this: Spine carried 28 degrees and Spine2 carried 3.
  const rest = new Map(SPINE_CHAIN.map((b) => [b, new THREE.Quaternion()]));
  const halfA = new THREE.Quaternion().setFromAxisAngle(Y, THREE.MathUtils.degToRad(30));
  const halfB = new THREE.Quaternion().setFromAxisAngle(Y, THREE.MathUtils.degToRad(15));
  const clip = new THREE.AnimationClip('BEND', 1, [
    quatTrack('mixamorigSpine', [new THREE.Quaternion(), halfA]),
    quatTrack('mixamorigSpine2', [new THREE.Quaternion(), halfB]),
  ]);

  assert.equal(redistributeChain(clip, SPINE_CHAIN, rest), true);
  const byBone = new Map(clip.tracks.map((t) => [t.name.slice(0, -'.quaternion'.length), t]));
  for (const bone of SPINE_CHAIN) assert.ok(byBone.has(bone), `${bone} must now be driven`);

  // Each segment carries an equal third...
  const each = SPINE_CHAIN.map((b) => {
    const v = byBone.get(b)!.values;
    return angleDeg(new THREE.Quaternion(v[4], v[5], v[6], v[7]));
  });
  for (const deg of each) assert.ok(Math.abs(deg - 15) < 0.5, `segment carries ${deg.toFixed(1)}, expected 15`);

  // ...and the chain still reaches the same total the animator authored.
  const total = new THREE.Quaternion();
  for (const b of SPINE_CHAIN) {
    const v = byBone.get(b)!.values;
    total.multiply(new THREE.Quaternion(v[4], v[5], v[6], v[7]));
  }
  assert.ok(Math.abs(angleDeg(total) - 45) < 0.5, `chain totals ${angleDeg(total).toFixed(1)}, expected 45`);
});

test('a chain the source already drives in full is left alone', () => {
  const rest = new Map(SPINE_CHAIN.map((b) => [b, new THREE.Quaternion()]));
  const q = new THREE.Quaternion().setFromAxisAngle(Y, 0.2);
  const clip = new THREE.AnimationClip('FULL', 1,
    SPINE_CHAIN.map((b) => quatTrack(b, [new THREE.Quaternion(), q])));
  const before = clip.tracks.map((t) => Array.from(t.values));
  assert.equal(redistributeChain(clip, SPINE_CHAIN, rest), false);
  assert.deepEqual(clip.tracks.map((t) => Array.from(t.values)), before);
});
