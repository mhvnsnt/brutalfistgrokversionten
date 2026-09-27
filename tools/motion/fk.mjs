#!/usr/bin/env node
/**
 * FORWARD KINEMATICS ON A BAKED CLIP — the shared one.
 *
 * This block has now been written three times: stance_gap.mjs (bind versus the
 * fighting stance), stride_speed.mjs (authored stride from the planted foot) and
 * attack_level.mjs (contact height of the striking limb). Three copies of the
 * same 40 lines is how they drift apart, and the whole point of measuring in
 * WORLD space is that every measurement agrees about where a joint is.
 *
 * Everything here reads the rig's AUTHORED hierarchy — node translation, rotation
 * and scale straight off the glTF nodes — and composes a clip's per-bone
 * quaternions onto it. No inverse bind matrices are involved, because a bind
 * matrix answers "where is this vertex" and the question here is always "where is
 * this joint".
 */
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { parseGlb } from '../model_diag/bind_pose.mjs';

/** Load a rig: names, parents, bind locals, and a name -> index map. */
export function loadRig(file) {
  const { json } = parseGlb(readFileSync(file));
  const skin = json.skins[0];
  const names = skin.joints.map((n) => (json.nodes[n]?.name ?? '').replace(':', ''));
  const parentNode = new Map();
  json.nodes.forEach((n, i) => (n.children ?? []).forEach((c) => parentNode.set(c, i)));
  const jointIndexOf = new Map();
  skin.joints.forEach((n, i) => jointIndexOf.set(n, i));
  const parentOf = skin.joints.map((n) => {
    const p = parentNode.get(n);
    return p !== undefined && jointIndexOf.has(p) ? jointIndexOf.get(p) : -1;
  });
  const localBind = skin.joints.map((n) => {
    const node = json.nodes[n];
    return new THREE.Matrix4().compose(
      new THREE.Vector3().fromArray(node.translation ?? [0, 0, 0]),
      new THREE.Quaternion().fromArray(node.rotation ?? [0, 0, 0, 1]),
      new THREE.Vector3().fromArray(node.scale ?? [1, 1, 1]),
    );
  });
  const localT = skin.joints.map((n) => new THREE.Vector3().fromArray(json.nodes[n].translation ?? [0, 0, 0]));
  const localS = skin.joints.map((n) => new THREE.Vector3().fromArray(json.nodes[n].scale ?? [1, 1, 1]));
  return { json, names, parentOf, localBind, localT, localS, indexOfName: new Map(names.map((n, i) => [n, i])) };
}

/** World matrices for a pose. `quatFor(boneName)` returns a quaternion or null for bind. */
export function worldPose(r, quatFor) {
  const out = new Array(r.names.length);
  for (let i = 0; i < r.names.length; i++) {
    const q = quatFor(r.names[i]);
    const local = q ? new THREE.Matrix4().compose(r.localT[i], q, r.localS[i]) : r.localBind[i];
    out[i] = r.parentOf[i] < 0 ? local.clone() : out[r.parentOf[i]].clone().multiply(local);
  }
  return out;
}

/** A clip's quaternion lookup at key index k. */
export const poseAt = (clip, k) => (bone) => {
  const t = clip.tracks?.[bone];
  if (!t?.q || t.q.length < (k + 1) * 4) return null;
  return new THREE.Quaternion(t.q[k * 4], t.q[k * 4 + 1], t.q[k * 4 + 2], t.q[k * 4 + 3]);
};

export const jointPos = (world, r, name) => {
  const i = r.indexOfName.get(name);
  return i === undefined ? null : new THREE.Vector3().setFromMatrixPosition(world[i]);
};

/** How many keys a clip holds for a given bone. */
export const keyCount = (clip, bone) => (clip.tracks?.[bone]?.q?.length ?? 0) / 4;

/**
 * The rig's standing height in bind: the head top above the lower foot. Every
 * height here is reported as a FRACTION of this, so a tall model and a short one
 * classify the same way.
 */
export function bindHeight(r) {
  const w = worldPose(r, () => null);
  const head = jointPos(w, r, 'mixamorigHead') ?? jointPos(w, r, 'mixamorigNeck');
  const feet = ['mixamorigLeftFoot', 'mixamorigRightFoot'].map((f) => jointPos(w, r, f)).filter(Boolean);
  if (!head || !feet.length) return null;
  const floor = Math.min(...feet.map((f) => f.y));
  return head.y - floor;
}
