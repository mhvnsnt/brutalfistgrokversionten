/**
 * The integrity gate counts clips, tracks and resolved tracks. None of those can
 * see a clip that binds every bone and then holds a pose on all of them — which
 * is exactly what HURRICANE_KICK does, and it is the first alias for both
 * attack_2 and attack_rk. These tests pin the measurement that does see it.
 */
import assert from "node:assert/strict";
import test from "node:test";

import * as THREE from "three";

import { runAnimationIntegrityGate } from "../src/engine/combat/AnimationIntegrityGate.ts";

const BONES = ["mixamorigHips", "mixamorigSpine", "mixamorigLeftArm", "mixamorigLeftForeArm"];

/** A skinned figure whose bone names the clips below target. */
function makeRig() {
  const root = new THREE.Group();
  const bones = BONES.map((name) => {
    const bone = new THREE.Bone();
    bone.name = name;
    root.add(bone);
    return bone;
  });
  const skeleton = new THREE.Skeleton(bones);
  const mesh = new THREE.SkinnedMesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
  mesh.name = "body";
  root.add(mesh);
  mesh.bind(skeleton);
  return root;
}

/**
 * @param {string} name
 * @param {(boneIndex: number, keyIndex: number) => THREE.Quaternion} pose
 */
function makeClip(name, pose) {
  const times = [0, 0.5, 1];
  const tracks = BONES.map((bone, boneIndex) => {
    const values = [];
    times.forEach((_, keyIndex) => {
      const q = pose(boneIndex, keyIndex);
      values.push(q.x, q.y, q.z, q.w);
    });
    return new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, times, values);
  });
  return new THREE.AnimationClip(name, 1, tracks);
}

function gate(clips, activeClipName) {
  const scene = makeRig();
  const mixer = new THREE.AnimationMixer(scene);
  /** @type {Record<string, THREE.AnimationAction>} */
  const actions = {};
  for (const clip of clips) actions[clip.name] = mixer.clipAction(clip);
  if (activeClipName) actions[activeClipName].play();
  return runAnimationIntegrityGate({
    characterName: "TESTER",
    clonedScene: scene,
    mixer,
    actions,
    activeClipName,
  });
}

const identity = () => new THREE.Quaternion();
const swinging = (_boneIndex, keyIndex) =>
  new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), keyIndex * 0.6);
/** the HURRICANE_KICK shape: the root sweeps, every other bone is frozen */
const rootOnly = (boneIndex, keyIndex) =>
  boneIndex === 0
    ? new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), keyIndex * 1.5)
    : new THREE.Quaternion();

test("a clip whose every track holds a pose is reported as static", () => {
  const report = gate([makeClip("FROZEN", identity)]);
  assert.deepEqual(report.staticClipNames, ["FROZEN"]);
  assert.equal(report.clipSources[0].trackCount, BONES.length);
  assert.equal(report.clipSources[0].resolvedTracks, BONES.length, "tracks still resolve — that is the trap");
  assert.equal(report.clipSources[0].movingTracks, 0);
  assert.ok(report.warningChecks.includes("STATIC_CLIPS"));
});

test("a clip that actually animates is not reported as static", () => {
  const report = gate([makeClip("SWING", swinging)]);
  assert.deepEqual(report.staticClipNames, []);
  assert.equal(report.clipSources[0].movingTracks, BONES.length);
  assert.ok(!report.warningChecks.includes("STATIC_CLIPS"));
});

test("one moving bone is enough to count as animating", () => {
  // The HURRICANE_KICK shape. It is NOT static by this measure - one track does
  // move - so the gate must not claim otherwise. What it reports is the honest
  // count: 1 of 4 tracks moving, which is what makes the defect visible.
  const report = gate([makeClip("ROOT_ONLY", rootOnly)]);
  assert.deepEqual(report.staticClipNames, []);
  assert.equal(report.clipSources[0].movingTracks, 1);
  assert.equal(report.clipSources[0].trackCount, BONES.length);
});

test("a frozen clip that is PLAYING drops the verdict off PASS", () => {
  const report = gate([makeClip("FROZEN", identity), makeClip("SWING", swinging)], "FROZEN");
  assert.ok(report.warningChecks.includes("ACTIVE_CLIP_IS_STATIC"));
  assert.notEqual(report.verdict, "PASS", "a fighter that cannot move must never read PASS");
  assert.equal(report.verdict, "UNKNOWN");
});

test("an animating clip that is PLAYING still passes", () => {
  const report = gate([makeClip("FROZEN", identity), makeClip("SWING", swinging)], "SWING");
  assert.ok(!report.warningChecks.includes("ACTIVE_CLIP_IS_STATIC"));
  assert.deepEqual(report.staticClipNames, ["FROZEN"], "the unused frozen clip is still reported");
});
