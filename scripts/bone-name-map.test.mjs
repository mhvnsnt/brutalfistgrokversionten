import assert from "node:assert/strict";
import test from "node:test";

import {
  ALT_BONE_NAMES,
  RUNTIME_BONE_NAMES,
  canonicalBoneName,
  resolveRuntimeBone,
} from "../src/engine/retarget/boneNameMap.mjs";

test("every canonical runtime bone resolves to itself", () => {
  for (const bone of RUNTIME_BONE_NAMES) {
    assert.equal(resolveRuntimeBone(bone), bone, bone);
    assert.equal(canonicalBoneName(bone), bone, bone);
  }
});

test("an exporter namespace is collapsed, not rejected", () => {
  // Maya/FBX writes the rig namespace with a colon; Mixamo auto-numbers a
  // second rig. 50 clips built zero tracks over exactly this.
  assert.equal(resolveRuntimeBone("mixamorig:Hips"), "mixamorigHips");
  assert.equal(resolveRuntimeBone("mixamorig9Hips"), "mixamorigHips");
  assert.equal(resolveRuntimeBone("mixamorig:LeftForeArm"), "mixamorigLeftForeArm");
  assert.equal(resolveRuntimeBone("mixamorig9RightToeBase"), "mixamorigRightToeBase");
});

test("the J_ rig maps onto the fight rig", () => {
  assert.equal(resolveRuntimeBone("J_Hips"), "mixamorigHips");
  assert.equal(resolveRuntimeBone("J_Spine1"), "mixamorigSpine");
  assert.equal(resolveRuntimeBone("J_Spine2"), "mixamorigSpine1");
  assert.equal(resolveRuntimeBone("J_Chest"), "mixamorigSpine2");
  assert.equal(resolveRuntimeBone("J_Neck"), "mixamorigNeck");
  assert.equal(resolveRuntimeBone("J_Head"), "mixamorigHead");
});

test("J_Clavicle is the clavicle and J_Shoulder is the upper arm", () => {
  // The correspondence a name alone would not settle: swapping these two puts
  // the upper-arm rotation on the collarbone.
  assert.equal(resolveRuntimeBone("J_Clavicle_L"), "mixamorigLeftShoulder");
  assert.equal(resolveRuntimeBone("J_Shoulder_L"), "mixamorigLeftArm");
  assert.equal(resolveRuntimeBone("J_Elbow_R"), "mixamorigRightForeArm");
  assert.equal(resolveRuntimeBone("J_Wrist_R"), "mixamorigRightHand");
});

test("J_Knee is the shin, with the thigh above it, under either leg spelling", () => {
  assert.equal(resolveRuntimeBone("J_Leg_L"), "mixamorigLeftUpLeg");
  assert.equal(resolveRuntimeBone("J_Thigh_L"), "mixamorigLeftUpLeg");
  assert.equal(resolveRuntimeBone("J_Knee_L"), "mixamorigLeftLeg");
  assert.equal(resolveRuntimeBone("J_Foot_R"), "mixamorigRightFoot");
  assert.equal(resolveRuntimeBone("J_Ankle_R"), "mixamorigRightFoot");
  assert.equal(resolveRuntimeBone("J_Toe_R"), "mixamorigRightToeBase");
});

test("Root is never treated as the pelvis", () => {
  // 46 clips carry BOTH Root and J_Hips, and none carry Root without a hips
  // bone. In SUPLEX, Root sweeps a full 2π on rx - it is the world transform.
  // Mapping it onto the hips would spin the whole body, and which one won would
  // depend on key iteration order.
  assert.equal(resolveRuntimeBone("Root"), "");
  assert.equal(resolveRuntimeBone("root"), "");
});

test("bones with no counterpart on the fight rig resolve to nothing", () => {
  for (const bone of [
    "F_Eyebow_L_01", // facial
    "N_Latissimus_AIM_L", // aim null
    "H_Upperarm_L", // helper
    "IK_Hand_L", // IK target
    "C_Hips_2", // a cloth rig
    "J_Tongue1",
    "",
  ]) {
    assert.equal(resolveRuntimeBone(bone), "", bone);
  }
});

test("no two mapped source names collide on one runtime bone within a rig", () => {
  // A collision means one source bone silently overwrites another, so the map
  // must stay injective per vocabulary. J_Leg/J_Thigh and J_Foot/J_Ankle are
  // alternative spellings of one segment; measured across the bank, no clip
  // carries both spellings, which is what makes them safe to share a target.
  const spellingPairs = new Set(["jlegl:jthighl", "jlegr:jthighr", "janklel:jfootl", "jankler:jfootr"]);
  const byTarget = new Map();
  for (const [source, target] of Object.entries(ALT_BONE_NAMES)) {
    const existing = byTarget.get(target);
    if (existing) {
      const pair = [existing, source].sort().join(":");
      assert.ok(spellingPairs.has(pair), `unexpected collision on ${target}: ${pair}`);
    }
    byTarget.set(target, source);
  }
});

test("every mapped target is a real runtime bone", () => {
  const runtime = new Set(RUNTIME_BONE_NAMES);
  for (const [source, target] of Object.entries(ALT_BONE_NAMES)) {
    assert.ok(runtime.has(target), `${source} -> ${target} is not a runtime bone`);
  }
});
