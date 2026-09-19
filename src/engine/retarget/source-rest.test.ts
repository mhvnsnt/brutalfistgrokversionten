// `.ts` extensions on purpose — the repo runs these under
// `node --experimental-strip-types --test`, which resolves them literally.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';

import { makeClipBindRelative } from './BindRelativeMotion.ts';
import { neutralizeRootRestQuaternion } from './neutralizeRootMotion.ts';
import {
  SCHWARZERBLITZ_REST_CLIP,
  schwarzerblitzSourceRest,
  buildSchwarzerblitzMotionClips,
} from './SchwarzerblitzMotionBank.ts';
import { mixamoSourceRest, MIXAMO_REST_BONE_COUNT } from './MixamoRestPose.ts';

const BONE = 'mixamorigLeftArm';

/** A one-bone clip holding a single absolute rotation — a POSE, not a motion. */
function poseClip(q: THREE.Quaternion): THREE.AnimationClip {
  const v = [q.x, q.y, q.z, q.w, q.x, q.y, q.z, q.w];
  return new THREE.AnimationClip('POSE', 1, [
    new THREE.QuaternionKeyframeTrack(`${BONE}.quaternion`, [0, 1], v),
  ]);
}

function firstKey(clip: THREE.AnimationClip): THREE.Quaternion {
  const t = clip.tracks[0];
  return new THREE.Quaternion(t.values[0], t.values[1], t.values[2], t.values[3]);
}

test('without a source rest, an absolute POSE collapses onto the bind', () => {
  // This is the defect the owner saw as "stuck in T-pose while they're
  // fighting": with the clip's own frame 0 as the reference, q(0) == q_bind by
  // construction, so every stance, guard and crouch in a bank renders as the
  // bind and all of them look identical.
  const bind = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.3);
  const pose = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 1.2);
  const out = makeClipBindRelative(poseClip(pose), new Map([[BONE, bind]]));
  assert.ok(out);
  assert.ok(firstKey(out).angleTo(bind) < 1e-5, 'frame 0 should equal the bind — that is the bug');
});

test('with the source rest, the same POSE survives as an absolute pose', () => {
  const bind = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.3);
  const srcRest = new THREE.Quaternion(); // source rig rests at identity here
  const pose = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 1.2);
  const out = makeClipBindRelative(
    poseClip(pose),
    new Map([[BONE, bind]]),
    new Map([[BONE, srcRest]]),
  );
  assert.ok(out);
  const expected = bind.clone().multiply(srcRest.clone().invert()).multiply(pose);
  assert.ok(firstKey(out).angleTo(expected) < 1e-5);
  assert.ok(firstKey(out).angleTo(bind) > 1.0, 'the pose must NOT be flattened onto the bind');
});

test('a root rest is yaw-neutralized to match the tracks; other bones are not', () => {
  // sanitizeMotionClip strips hip yaw from every track. A rest read straight
  // out of a bank has not been through that, and subtracting one from the
  // other leaves the difference in the delta. MEASURED on Schwarzerblitz,
  // whose skeleton carries a -90 degree coordinate yaw: it spun the whole
  // fighter 90 degrees off his facing.
  const yawed = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2, 1.4, -0.1, 'YXZ'));
  const root = neutralizeRootRestQuaternion('mixamorigHips', yawed);
  const e = new THREE.Euler().setFromQuaternion(root, 'YXZ');
  assert.ok(Math.abs(e.y) < 1e-6, 'root yaw must be zero');
  assert.ok(Math.abs(e.x - 0.2) < 1e-6, 'root pitch must survive');

  const arm = neutralizeRootRestQuaternion(BONE, yawed);
  assert.equal(arm, yawed, 'a non-root bone is returned untouched');
});

test('the Schwarzerblitz bank ships its rest, and that rest is a T-pose', () => {
  const rest = schwarzerblitzSourceRest();
  assert.ok(rest.size >= 19, `expected the full SB rig, got ${rest.size} bones`);
  // MEASURED: TPOSE holds RightArm rx -1.5720 and LeftArm rx +1.5859. Arms
  // rotated a quarter turn about the forward axis = straight out to the sides.
  for (const [bone, sign] of [['mixamorigLeftArm', 1], ['mixamorigRightArm', -1]] as const) {
    const e = new THREE.Euler().setFromQuaternion(rest.get(bone)!, 'XYZ');
    assert.ok(
      Math.abs(e.x - sign * Math.PI / 2) < 0.15,
      `${bone} rest rx ${e.x.toFixed(3)} is not the ${sign > 0 ? '+' : '-'}pi/2 of a T-pose`,
    );
  }
  const names = new Set(buildSchwarzerblitzMotionClips().map((c) => c.name));
  assert.ok(names.has(SCHWARZERBLITZ_REST_CLIP), 'the rest clip must be in the bank');
});

test('the Schwarzerblitz stances are distinct poses, not one pose repeated', () => {
  // Eleven stances that all resolve to the same rotations are eleven fighters
  // standing identically, which is what the owner reported.
  const rest = schwarzerblitzSourceRest();
  const clips = new Map(buildSchwarzerblitzMotionClips().map((c) => [c.name, c]));
  const stances = ['STANCE', 'GRAFSTANCE', 'TIGERSTANCE', 'KRAVESTANCE', 'LOWSTANCE', 'SHAZSTANCE'];
  const seen: Array<{ name: string; q: THREE.Quaternion }> = [];
  for (const name of stances) {
    const clip = clips.get(name);
    if (!clip) continue;
    const track = clip.tracks.find((t) => t.name === `${BONE}.quaternion`);
    assert.ok(track, `${name} has no ${BONE} track`);
    const q = new THREE.Quaternion(track.values[0], track.values[1], track.values[2], track.values[3]);
    assert.ok(
      q.angleTo(rest.get(BONE)!) > 0.2,
      `${name} is indistinguishable from the rest pose`,
    );
    seen.push({ name, q });
  }
  assert.ok(seen.length >= 5, `expected the stance set, found ${seen.length}`);
  const distinct = seen.filter((a, i) => seen.every((b, j) => i === j || a.q.angleTo(b.q) > 0.05));
  assert.ok(distinct.length >= 3, `only ${distinct.length} of ${seen.length} stances are distinct`);
});

test('the roster rigs are NOT in raw Mixamo space — which is why the Mixamo rest is not the Bannon bank rest', () => {
  // The banked Mixamo rest is real and measured (xbot.glb, the one shipped
  // model classified T-POSE). It is kept precisely because it PROVES the
  // Bannon bank cannot be in that space: subtracting it laid the fighter on
  // his side. Mixamo rests its legs at rz ~= +/-pi and its arms near
  // identity; anything that disagrees is a different convention.
  const rest = mixamoSourceRest();
  assert.equal(rest.size, MIXAMO_REST_BONE_COUNT);
  assert.ok(rest.size >= 58, `expected a full Mixamo rig, got ${rest.size}`);
  const leg = new THREE.Euler().setFromQuaternion(rest.get('mixamorigLeftUpLeg')!, 'XYZ');
  assert.ok(Math.abs(Math.abs(leg.z) - Math.PI) < 0.05, `Mixamo leg rest rz ${leg.z} is not +/-pi`);
  const arm = rest.get('mixamorigLeftArm')!;
  assert.ok(arm.angleTo(new THREE.Quaternion()) < 0.5, 'Mixamo arms rest close to identity (T-pose)');
});
