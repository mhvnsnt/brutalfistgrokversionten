// `.ts` extensions on purpose: node --experimental-strip-types resolves them literally.
/**
 * UNARMED OPEN-SOURCE CLIP INTAKE (CC0 staging bank, later CMU)
 *
 * This runs every staged unarmed strike, hit reaction, knockdown, wakeup,
 * dodge/sidestep and block clip through the #17 universal intake,
 * normalizeUniversalAnimation(), against BANNON_rigged.glb (the canonical
 * skeleton). It then MEASURES the result instead of trusting the clip name.
 *
 * Every clip goes through two paths:
 *   A. "as-shipped": the raw source clip plus its source rest go straight into
 *      normalizeUniversalAnimation(). That is exactly what #17 does today:
 *      the alias layer, then local bind-relative deltas.
 *   B. "rig-profile": an explicit per-rig bone map, then a world-space
 *      rest conversion (world delta plus swing to the source bone direction).
 *      The result is expressed in Bannon's local space and then handed to the
 *      SAME normalizeUniversalAnimation() for rest fills and its verdict.
 *
 * Both outputs are played on Bannon by forward kinematics and compared frame
 * by frame with the source played on its OWN skeleton. The main number is
 * effector direction error: the angle between where the source puts its
 * hands, feet and head relative to the hips and where Bannon does, after
 * aligning the two rest frames. A clip only passes if the retarget is faithful
 * AND it measures as the category it is filed under.
 *
 * Usage:
 *   node --experimental-strip-types --import ./scripts/register-ts-resolve.mjs \
 *     tools/anim-intake/cc0_unarmed_intake.ts [--staging /workspace/oss-anim-staging]
 * Writes tools/anim-intake/cc0-unarmed-intake.json.
 * Nothing is promoted into a combat slot by this tool.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';

import { loadCanonicalSkeleton } from '../../src/engine/retarget/CanonicalSkeleton.ts';
import { normalizeUniversalAnimation, type UniversalAnimationResult } from '../../src/engine/retarget/UniversalAnimationPipeline.ts';
import { parseGlb } from '../model_diag/bind_pose.mjs';
import { SPINE_CHAIN, JOINT_LIMITS, clampToJointLimits, constrainHinges, redistributeChain, removeConstantConventionTwist } from '../../src/engine/retarget/SkeletalLimits.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const argStaging = process.argv.indexOf('--staging');
const STAGING = argStaging > 0 ? process.argv[argStaging + 1] : '/workspace/oss-anim-staging';
const OUT = join(ROOT, 'tools/anim-intake/cc0-unarmed-intake.json');

const CATEGORIES = /^(strike-punch|strike-kick|knee|elbow|grapple|hit-react|knockdown|wakeup|dodge|block)/;

// ---------------------------------------------------------------- rig profiles
type Mode = 'delta';
interface BoneMapEntry { target: string; child?: string; targetChild?: string }
interface RigProfile {
  id: string;
  match: (boneNames: Set<string>) => boolean;
  map: Record<string, BoneMapEntry>;
  keypoints: Record<Keypoint, string>;
}
type Keypoint = 'hips' | 'head' | 'lHand' | 'rHand' | 'lArm' | 'rArm' | 'lUpLeg' | 'rUpLeg' | 'lFoot' | 'rFoot' | 'lToe' | 'rToe' | 'lKnee' | 'rKnee';
const M = 'mixamorig';
const BANNON_KP: Record<Keypoint, string> = {
  hips: `${M}Hips`, head: `${M}Head`, lHand: `${M}LeftHand`, rHand: `${M}RightHand`, lArm: `${M}LeftArm`, rArm: `${M}RightArm`,
  lUpLeg: `${M}LeftUpLeg`, rUpLeg: `${M}RightUpLeg`, lFoot: `${M}LeftFoot`, rFoot: `${M}RightFoot`, lToe: `${M}LeftToeBase`, rToe: `${M}RightToeBase`, lKnee: `${M}LeftLeg`, rKnee: `${M}RightLeg`,
};

function ueMannequin(head: string): Record<string, BoneMapEntry> {
  const m: Record<string, BoneMapEntry> = {
    pelvis: { target: `${M}Hips` },
    spine_01: { target: `${M}Spine`, child: 'spine_02', targetChild: `${M}Spine1` },
    spine_02: { target: `${M}Spine1`, child: 'spine_03', targetChild: `${M}Spine2` },
    spine_03: { target: `${M}Spine2`, child: 'neck_01', targetChild: `${M}Neck` },
    neck_01: { target: `${M}Neck`, child: head, targetChild: `${M}Head` },
    [head]: { target: `${M}Head` },
  };
  for (const [s, T] of [['l', 'Left'], ['r', 'Right']] as const) {
    m[`clavicle_${s}`] = { target: `${M}${T}Shoulder`, child: `upperarm_${s}`, targetChild: `${M}${T}Arm` };
    m[`upperarm_${s}`] = { target: `${M}${T}Arm`, child: `lowerarm_${s}`, targetChild: `${M}${T}ForeArm` };
    m[`lowerarm_${s}`] = { target: `${M}${T}ForeArm`, child: `hand_${s}`, targetChild: `${M}${T}Hand` };
    m[`hand_${s}`] = { target: `${M}${T}Hand` };
    m[`thigh_${s}`] = { target: `${M}${T}UpLeg`, child: `calf_${s}`, targetChild: `${M}${T}Leg` };
    m[`calf_${s}`] = { target: `${M}${T}Leg`, child: `foot_${s}`, targetChild: `${M}${T}Foot` };
    m[`foot_${s}`] = { target: `${M}${T}Foot`, child: `ball_${s}`, targetChild: `${M}${T}ToeBase` };
    m[`ball_${s}`] = { target: `${M}${T}ToeBase` };
    for (const [f, F] of [['thumb', 'Thumb'], ['index', 'Index'], ['middle', 'Middle'], ['ring', 'Ring'], ['pinky', 'Pinky']] as const) {
      for (let i = 1; i <= 3; i++) m[`${f}_0${i}_${s}`] = { target: `${M}${T}Hand${F}${i}` };
    }
  }
  return m;
}
function ueKeypoints(head: string): Record<Keypoint, string> {
  return { hips: 'pelvis', head, lHand: 'hand_l', rHand: 'hand_r', lArm: 'upperarm_l', rArm: 'upperarm_r', lUpLeg: 'thigh_l', rUpLeg: 'thigh_r', lFoot: 'foot_l', rFoot: 'foot_r', lToe: 'ball_l', rToe: 'ball_r', lKnee: 'calf_l', rKnee: 'calf_r' };
}
function kaykitMap(): Record<string, BoneMapEntry> {
  const m: Record<string, BoneMapEntry> = {
    hips: { target: `${M}Hips` },
    spine: { target: `${M}Spine`, child: 'chest', targetChild: `${M}Spine1` },
    chest: { target: `${M}Spine2`, child: 'head', targetChild: `${M}Neck` },
    head: { target: `${M}Head` },
  };
  for (const [s, T] of [['l', 'Left'], ['r', 'Right']] as const) {
    m[`upperarm.${s}`] = { target: `${M}${T}Arm`, child: `lowerarm.${s}`, targetChild: `${M}${T}ForeArm` };
    m[`lowerarm.${s}`] = { target: `${M}${T}ForeArm`, child: `wrist.${s}`, targetChild: `${M}${T}Hand` };
    m[`wrist.${s}`] = { target: `${M}${T}Hand` };
    m[`upperleg.${s}`] = { target: `${M}${T}UpLeg`, child: `lowerleg.${s}`, targetChild: `${M}${T}Leg` };
    m[`lowerleg.${s}`] = { target: `${M}${T}Leg`, child: `foot.${s}`, targetChild: `${M}${T}Foot` };
    m[`foot.${s}`] = { target: `${M}${T}Foot`, child: `toes.${s}`, targetChild: `${M}${T}ToeBase` };
    m[`toes.${s}`] = { target: `${M}${T}ToeBase` };
  }
  return m;
}
const PROFILES: RigProfile[] = [
  { id: 'ue-mannequin-65 (UAL1/UAL2)', match: (b) => b.has('pelvis') && b.has('Head'), map: ueMannequin('Head'), keypoints: ueKeypoints('Head') },
  { id: 'ue-mannequin-66 (Mesh2Motion, lowercase head)', match: (b) => b.has('pelvis') && b.has('head'), map: ueMannequin('head'), keypoints: ueKeypoints('head') },
  {
    id: 'kaykit-23 (no neck/clavicle/fingers)', match: (b) => b.has('hips') && b.has('upperarm.l'), map: kaykitMap(),
    keypoints: { hips: 'hips', head: 'head', lHand: 'hand.l', rHand: 'hand.r', lArm: 'upperarm.l', rArm: 'upperarm.r', lUpLeg: 'upperleg.l', rUpLeg: 'upperleg.r', lFoot: 'foot.l', rFoot: 'foot.r', lToe: 'toes.l', rToe: 'toes.r', lKnee: 'lowerleg.l', rKnee: 'lowerleg.r' },
  },
  { id: 'cmu-31 (cgspeed BVH->GLB)', match: (b) => b.has('LHipJoint') && b.has('LowerBack'), map: cmuMap(),
    keypoints: { hips: 'Hips', head: 'Head', lHand: 'LeftHand', rHand: 'RightHand', lArm: 'LeftArm', rArm: 'RightArm', lUpLeg: 'LeftUpLeg', rUpLeg: 'RightUpLeg', lFoot: 'LeftFoot', rFoot: 'RightFoot', lToe: 'LeftToeBase', rToe: 'RightToeBase', lKnee: 'LeftLeg', rKnee: 'RightLeg' } },
];
function cmuMap(): Record<string, BoneMapEntry> {
  const m: Record<string, BoneMapEntry> = {
    Hips: { target: `${M}Hips` },
    LowerBack: { target: `${M}Spine`, child: 'Spine', targetChild: `${M}Spine1` },
    Spine: { target: `${M}Spine1`, child: 'Spine1', targetChild: `${M}Spine2` },
    Spine1: { target: `${M}Spine2`, child: 'Neck', targetChild: `${M}Neck` },
    Neck: { target: `${M}Neck`, child: 'Head', targetChild: `${M}Head` },
    Head: { target: `${M}Head` },
  };
  for (const T of ['Left', 'Right']) {
    m[`${T}Shoulder`] = { target: `${M}${T}Shoulder`, child: `${T}Arm`, targetChild: `${M}${T}Arm` };
    m[`${T}Arm`] = { target: `${M}${T}Arm`, child: `${T}ForeArm`, targetChild: `${M}${T}ForeArm` };
    m[`${T}ForeArm`] = { target: `${M}${T}ForeArm`, child: `${T}Hand`, targetChild: `${M}${T}Hand` };
    m[`${T}Hand`] = { target: `${M}${T}Hand` };
    m[`${T}UpLeg`] = { target: `${M}${T}UpLeg`, child: `${T}Leg`, targetChild: `${M}${T}Leg` };
    m[`${T}Leg`] = { target: `${M}${T}Leg`, child: `${T}Foot`, targetChild: `${M}${T}Foot` };
    m[`${T}Foot`] = { target: `${M}${T}Foot`, child: `${T}ToeBase`, targetChild: `${M}${T}ToeBase` };
    m[`${T}ToeBase`] = { target: `${M}${T}ToeBase` };
  }
  return m;
}

// ---------------------------------------------------------------- GLB reading
interface SrcTrack { node: string; path: 'rotation' | 'translation' | 'scale'; times: Float32Array; values: Float32Array; interp: string }
interface SrcFile { json: any; nodes: THREE.Object3D[]; byName: Map<string, THREE.Object3D>; joints: string[]; rest: Map<string, { q: THREE.Quaternion; p: THREE.Vector3; s: THREE.Vector3 }>; anims: Map<string, { tracks: SrcTrack[]; duration: number }> }
const fileCache = new Map<string, SrcFile>();
const COMP: Record<number, [any, number]> = { 5126: [Float32Array, 1], 5122: [Int16Array, 32767], 5123: [Uint16Array, 65535], 5120: [Int8Array, 127], 5121: [Uint8Array, 255] };
const NCOMP: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
function readAccessor(json: any, bin: Buffer, idx: number): Float32Array {
  const a = json.accessors[idx]; const bv = json.bufferViews[a.bufferView];
  const [Ctor, norm] = COMP[a.componentType]; const n = NCOMP[a.type]; const esz = Ctor.BYTES_PER_ELEMENT;
  const stride = bv.byteStride ?? n * esz; const base = (bv.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const out = new Float32Array(a.count * n); const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
  for (let i = 0; i < a.count; i++) for (let k = 0; k < n; k++) {
    const off = base + i * stride + k * esz; let v: number;
    switch (a.componentType) { case 5126: v = dv.getFloat32(off, true); break; case 5122: v = dv.getInt16(off, true); break; case 5123: v = dv.getUint16(off, true); break; case 5120: v = dv.getInt8(off); break; default: v = dv.getUint8(off); }
    out[i * n + k] = a.componentType === 5126 ? v : (a.normalized ? Math.max(v / norm, -1) : v);
  }
  return out;
}
function loadSource(path: string): SrcFile {
  const hit = fileCache.get(path); if (hit) return hit;
  const { json, bin } = parseGlb(readFileSync(path));
  const nodes = json.nodes.map((n: any, i: number) => { const o = new THREE.Object3D(); o.name = n.name ?? `node${i}`; if (n.translation) o.position.fromArray(n.translation); if (n.rotation) o.quaternion.fromArray(n.rotation); if (n.scale) o.scale.fromArray(n.scale); return o; });
  const scene = new THREE.Object3D();
  const hasParent = new Set<number>();
  json.nodes.forEach((n: any, i: number) => (n.children ?? []).forEach((c: number) => { nodes[i].add(nodes[c]); hasParent.add(c); }));
  nodes.forEach((o: THREE.Object3D, i: number) => { if (!hasParent.has(i)) scene.add(o); });
  scene.updateMatrixWorld(true);
  const byName = new Map<string, THREE.Object3D>(); for (const o of nodes) if (!byName.has(o.name)) byName.set(o.name, o);
  // Skeleton-only exports (the CMU segments) have no skin: every node is a joint.
  const joints = json.skins?.[0]?.joints ? json.skins[0].joints.map((j: number) => nodes[j].name) : nodes.map((o: THREE.Object3D) => o.name);
  const rest = new Map<string, any>(); for (const o of nodes) rest.set(o.name, { q: o.quaternion.clone(), p: o.position.clone(), s: o.scale.clone() });
  const anims = new Map<string, any>();
  for (const an of json.animations ?? []) {
    const tracks: SrcTrack[] = []; let duration = 0;
    for (const ch of an.channels) {
      const s = an.samplers[ch.sampler]; if (ch.target.node === undefined || ch.target.path === 'weights') continue;
      const times = readAccessor(json, bin, s.input); let values = readAccessor(json, bin, s.output);
      const n = ch.target.path === 'rotation' ? 4 : 3;
      if (s.interpolation === 'CUBICSPLINE') { const v = new Float32Array(times.length * n); for (let i = 0; i < times.length; i++) for (let k = 0; k < n; k++) v[i * n + k] = values[i * 3 * n + n + k]; values = v; }
      duration = Math.max(duration, times[times.length - 1] ?? 0);
      tracks.push({ node: nodes[ch.target.node].name, path: ch.target.path, times, values, interp: s.interpolation ?? 'LINEAR' });
    }
    anims.set(an.name, { tracks, duration });
  }
  const f = { json, nodes, byName, joints, rest, anims }; fileCache.set(path, f); return f;
}

// ---------------------------------------------------------------- sampling
const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion();
function sampleInto(times: ArrayLike<number>, values: ArrayLike<number>, n: number, t: number, out: number[], step = false) {
  const last = times.length - 1;
  if (t <= times[0] || last === 0) { for (let k = 0; k < n; k++) out[k] = values[k]; return; }
  if (t >= times[last]) { for (let k = 0; k < n; k++) out[k] = values[last * n + k]; return; }
  let lo = 0, hi = last; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (times[mid] <= t) lo = mid; else hi = mid; }
  const a = step ? 0 : (t - times[lo]) / (times[hi] - times[lo]);
  if (n === 4) { _qa.fromArray(values as any, lo * 4); _qb.fromArray(values as any, hi * 4); _qa.slerp(_qb, a); out[0] = _qa.x; out[1] = _qa.y; out[2] = _qa.z; out[3] = _qa.w; }
  else for (let k = 0; k < n; k++) out[k] = values[lo * n + k] * (1 - a) + values[hi * n + k] * a;
}
function poseSource(f: SrcFile, tracks: SrcTrack[], t: number, withTranslation: boolean) {
  for (const o of f.nodes) { const r = f.rest.get(o.name)!; o.quaternion.copy(r.q); o.position.copy(r.p); o.scale.copy(r.s); }
  const buf = [0, 0, 0, 0];
  for (const tr of tracks) {
    const o = f.byName.get(tr.node); if (!o) continue;
    if (tr.path === 'rotation') { sampleInto(tr.times, tr.values, 4, t, buf, tr.interp === 'STEP'); o.quaternion.set(buf[0], buf[1], buf[2], buf[3]).normalize(); }
    else if (tr.path === 'translation' && withTranslation) { sampleInto(tr.times, tr.values, 3, t, buf, tr.interp === 'STEP'); o.position.set(buf[0], buf[1], buf[2]); }
  }
  let top = f.nodes[0]; while (top.parent) top = top.parent; top.updateMatrixWorld(true);
}
function poseTarget(root: THREE.Object3D, bones: Map<string, THREE.Object3D>, rest: Map<string, THREE.Quaternion>, clip: THREE.AnimationClip, t: number) {
  for (const [n, q] of rest) bones.get(n)?.quaternion.copy(q);
  const buf = [0, 0, 0, 0];
  for (const tr of clip.tracks) {
    if (!tr.name.endsWith('.quaternion')) continue;
    const b = bones.get(tr.name.slice(0, -11)); if (!b) continue;
    sampleInto(tr.times, tr.values, 4, t, buf); b.quaternion.set(buf[0], buf[1], buf[2], buf[3]).normalize();
  }
  root.updateMatrixWorld(true);
}

// ---------------------------------------------------------------- rest frames
function wp(o: THREE.Object3D) { return new THREE.Vector3().setFromMatrixPosition(o.matrixWorld); }
function wq(o: THREE.Object3D) { const q = new THREE.Quaternion(); o.matrixWorld.decompose(new THREE.Vector3(), q, new THREE.Vector3()); return q; }
/**
 * Body basis at rest: up = hips->head, fwd = where the toes point, left =
 * L-R shoulder line. Built from anatomy, NOT from a handedness assumption:
 * MEASURED, Bannon's bind faces +X with its LEFT side at +Z (left = fwd x up),
 * while UAL/KayKit/Mesh2Motion face +Z with left at +X (left = up x fwd).
 * The two skeletons are mirror images, so the source->target alignment is a
 * reflection (det -1) and a pure rotation would play every clip backwards
 * or mirrored. `hand` is +1 for up x (R-L) = fwd, -1 for the mirrored rig.
 */
function bodyBasis(get: (k: Keypoint) => THREE.Vector3) {
  const up = get('head').sub(get('hips')).normalize();
  const toe = get('lToe').sub(get('lFoot')).add(get('rToe').sub(get('rFoot')));
  toe.addScaledVector(up, -toe.dot(up));
  const fwd = toe.normalize();
  const leftRaw = get('lArm').sub(get('rArm'));
  leftRaw.addScaledVector(up, -leftRaw.dot(up)).addScaledVector(fwd, -leftRaw.dot(fwd));
  const left = leftRaw.normalize();
  const across = get('rArm').sub(get('lArm'));
  const hand = Math.sign(new THREE.Vector3().crossVectors(up, across).dot(fwd)) || 1;
  return { up, fwd, left, hand, right: left.clone().negate(), m: new THREE.Matrix4().makeBasis(left, up, fwd) };
}
function conjugate(A: THREE.Matrix4, q: THREE.Quaternion) {
  const R = new THREE.Matrix4().makeRotationFromQuaternion(q);
  const out = new THREE.Matrix4().multiplyMatrices(A, R).multiply(A.clone().transpose());
  return new THREE.Quaternion().setFromRotationMatrix(out);
}

// ---------------------------------------------------------------- measurement
interface Frame { footOut0: [number, number]; kneeUp: number; kneeOut0: number; headFromHips: THREE.Vector3; eff: Record<string, THREE.Vector3>; torsoUp: number; height: number; handOut: [number, number]; footOut: [number, number]; yaw: number; hipsLocal: THREE.Vector3 }
function measureFrame(get: (k: Keypoint) => THREE.Vector3, H: number, upAxis: THREE.Vector3, fwd0: THREE.Vector3, hand: number): Frame {
  const hips = get('hips');
  const eff: Record<string, THREE.Vector3> = {};
  // Each effector is taken from its own limb root (hand from shoulder socket,
  // foot from hip socket, head from pelvis). Measuring from the pelvis made
  // KayKit's chibi hip width look like 30-50 deg of foot error on a static guard.
  eff.head = get('head').sub(hips);
  eff.lHand = get('lHand').sub(get('lArm')); eff.rHand = get('rHand').sub(get('rArm'));
  eff.lFoot = get('lFoot').sub(get('lUpLeg')); eff.rFoot = get('rFoot').sub(get('rUpLeg'));
  const torsoUp = eff.head.clone().normalize().dot(upAxis);
  const ys = (['head', 'lHand', 'rHand', 'lFoot', 'rFoot', 'hips', 'lArm', 'rArm'] as Keypoint[]).map((k) => get(k).dot(upAxis));
  const height = (Math.max(...ys) - Math.min(...ys)) / H;
  const across = get('rArm').sub(get('lArm')); across.addScaledVector(upAxis, -across.dot(upAxis));
  const f = new THREE.Vector3().crossVectors(upAxis, across).normalize().multiplyScalar(hand);
  const out = (a: Keypoint, b: Keypoint) => get(a).sub(get(b)).dot(f) / H;
  const yaw = Math.atan2(new THREE.Vector3().crossVectors(fwd0, f).dot(upAxis), fwd0.dot(f)) * 180 / Math.PI;
  // Against the OPENING facing (where the opponent is): a side kick turns the
  // shoulders 90 deg, so a per-frame facing reads its extension as sideways.
  const f0h = fwd0.clone().addScaledVector(upAxis, -fwd0.dot(upAxis)).normalize();
  const out0 = (a: Keypoint, b: Keypoint) => get(a).sub(get(b)).dot(f0h) / H;
  const kneeUp = Math.max(get('lKnee').sub(hips).dot(upAxis), get('rKnee').sub(hips).dot(upAxis)) / H;
  const kneeOut0 = Math.max(out0('lKnee', 'lUpLeg'), out0('rKnee', 'rUpLeg'));
  return { footOut0: [out0('lFoot', 'lUpLeg'), out0('rFoot', 'rUpLeg')], kneeUp, kneeOut0, headFromHips: get('head').sub(hips).divideScalar(H), eff, torsoUp, height, handOut: [out('lHand', 'lArm'), out('rHand', 'rArm')], footOut: [out('lFoot', 'lUpLeg'), out('rFoot', 'rUpLeg')], yaw, hipsLocal: hips };
}
function summarize(frames: Frame[], dur: number) {
  const r = (v: number) => Math.round(v * 1000) / 1000;
  const hand = frames.map((f) => Math.max(...f.handOut)); const foot = frames.map((f) => Math.max(...f.footOut));
  const lhand = frames.map((f) => f.handOut[0]), rhand = frames.map((f) => f.handOut[1]);
  const travel = (xs: number[]) => Math.max(...xs) - Math.min(...xs);
  const n = frames.length - 1;
  return {
    dur: r(dur),
    handOutMax: r(Math.max(...hand)), handTravel: r(Math.max(travel(lhand), travel(rhand))),
    leadHand: travel(lhand) > travel(rhand) ? 'left' : 'right',
    footOutMax: r(Math.max(...foot)), footTravel: r(Math.max(travel(frames.map((f) => f.footOut[0])), travel(frames.map((f) => f.footOut[1])))),
    torsoUpStart: r(frames[0].torsoUp), torsoUpEnd: r(frames[n].torsoUp), torsoUpMin: r(Math.min(...frames.map((f) => f.torsoUp))),
    heightStart: r(frames[0].height), heightEnd: r(frames[n].height), heightMin: r(Math.min(...frames.map((f) => f.height))),
    yawDriftMax: r(Math.max(...frames.map((f) => Math.abs(f.yaw)))),
    peakFrac: r(hand.indexOf(Math.max(...hand)) / Math.max(1, n)),
    faceAtHandPeak: r(Math.cos((frames[hand.indexOf(Math.max(...hand))].yaw * Math.PI) / 180)),
    faceAtFootPeak: (() => { const f0 = frames.map((f) => Math.max(f.footOut[0], f.footOut[1], ...f.footOut0)); return r(Math.cos((frames[f0.indexOf(Math.max(...f0))].yaw * Math.PI) / 180)); })(),
    spineUpMedian: r([...frames.map((f) => f.torsoUp)].sort((a, b) => a - b)[Math.floor(frames.length / 2)]),
    footLeadLimb: Math.max(...frames.map((f) => Math.max(f.footOut[0], f.footOut0[0]))) >= Math.max(...frames.map((f) => Math.max(f.footOut[1], f.footOut0[1]))) ? 'LeftFoot' : 'RightFoot',
    footOut0Max: r(Math.max(...frames.map((f) => Math.max(...f.footOut0)))),
    kneeUpMax: r(Math.max(...frames.map((f) => f.kneeUp))), kneeOut0Max: r(Math.max(...frames.map((f) => f.kneeOut0))),
    headDispMax: r(Math.max(...frames.map((f) => f.headFromHips.distanceTo(frames[0].headFromHips)))),
    fallTime: (() => { const i = frames.findIndex((f) => f.height <= 0.5); if (i < 0) return null; let j = i; while (j > 0 && frames[j].height < 0.8) j--; return r(((i - j) / Math.max(1, n)) * dur); })(),
  };
}
type Summary = ReturnType<typeof summarize>;

// ---------------------------------------------------------------- main
const manifest = JSON.parse(readFileSync(join(STAGING, 'MANIFEST.json'), 'utf8'));
const sk = loadCanonicalSkeleton(readFileSync(join(ROOT, 'public/models/BANNON_rigged.glb')));
const tBones = new Map<string, THREE.Object3D>(); sk.root.traverse((o) => { if (o.name) tBones.set(o.name, o); });
const tRest = new Map<string, THREE.Quaternion>(); for (const [n, q] of sk.rest) tRest.set(n, q.clone());
const tOrder: THREE.Object3D[] = []; sk.root.traverse((o) => { if ((o as THREE.Bone).isBone) tOrder.push(o); });
poseTarget(sk.root, tBones, tRest, new THREE.AnimationClip('rest', 0, []), 0);
/**
 * normalizeUniversalAnimation() reads the target REST from the live bone
 * quaternions, so the rig must be back in bind before every call. Posing
 * the rig for measurement and then calling the intake would silently hand it
 * the last sampled frame as its "rest". That happened once while this tool was
 * being built, and it cost 40-90 degrees of effector error.
 */
function resetTarget() { for (const [n, q] of tRest) tBones.get(n)?.quaternion.copy(q); sk.root.updateMatrixWorld(true); }
const tGet = (k: Keypoint) => wp(tBones.get(BANNON_KP[k])!);
const tBasis = bodyBasis(tGet);
const tH = tGet('head').dot(tBasis.up) - Math.min(tGet('lFoot').dot(tBasis.up), tGet('rFoot').dot(tBasis.up));
const tRestWorld = new Map<string, THREE.Quaternion>(); for (const b of tOrder) tRestWorld.set(b.name, wq(b));

// Licence CLASS per clip. Mesh2Motion's manifest string is
// "CC0-1.0 for 3D models/rigs/animations; MIT for code (not staged)", and only the
// animation is used, so its class is CC0-1.0. The full string is kept as licenseNote.
const licenseOf = (source: string) => {
  if (/cmu/i.test(source)) return 'CMU-free-use (not CC0)';
  const raw = String(manifest.sources?.[source]?.license ?? 'UNKNOWN');
  return /^CC0-1\.0/.test(raw) ? 'CC0-1.0' : raw;
};
const candidates: any[] = (manifest.clips as any[]).filter((c) => CATEGORIES.test(c.category) && c.unique_motion);
/**
 * CMU SUBSET (owner-approved; licence class 'CMU-free-use (not CC0)').
 * Representative and style-diverse, per the lead's list:
 *   135_07 Mawashigeri roundhouses, 135_11 Yokogeri side kicks, 5 spin kicks,
 *   the 3 real knees in 86_06, boxing jabs/crosses from subject 14, and every
 *   unpaired sidestep, knockdown and wakeup.
 * Skipped: 135_01/02 kata knee lifts, 86_05 jumping jacks, PAIRED captures
 * (two bodies: #17 refuses them as REJECTED_MULTI_BODY; grapple-only).
 */
const CMU_SPIN = ['cmu_87_01_seg01', 'cmu_88_06_seg01', 'cmu_90_05_seg01', 'cmu_90_06_seg01', 'cmu_90_07_seg01'];
const CMU_KNEE_STARTS = [6219, 6464, 6710];
const cmuSegs: any[] = manifest.cmu_segments?.segments ?? [];
const cmuPick = cmuSegs.filter((g) => {
  if (!g.glb || /^(135_01|135_02|86_05)$/.test(g.take)) return false;
  if (g.paired) return true; // recorded as REJECTED_MULTI_BODY
  if (g.take === '135_07' || g.take === '135_11') return g.category === 'strike-kick';
  if (CMU_SPIN.some((p) => g.id.startsWith(p + '_'))) return true;
  if (g.take === '86_06' && g.category === 'knee') return CMU_KNEE_STARTS.some((f) => Math.abs(g.start_frame - f) <= 30);
  if (/^14_/.test(g.take) && g.category === 'strike-punch') return true;
  return /^(dodge|knockdown|wakeup)/.test(g.category);
});
for (const g of cmuPick) candidates.push({
  source: 'cmu-mocap-bvh', file: g.glb, clip: null, category: g.category, subcategory: [g.limb, g.height, g.direction].filter(Boolean).join('/'),
  variant: 'segment', flags: [...(g.mods ?? []), ...(g.paired ? ['paired'] : [])], cmu: g,
});
const shaByFile = new Map<string, string>((manifest.files as any[]).map((f) => [f.file, f.sha256]));

const results: any[] = [];
for (const c of candidates) {
  const path = join(STAGING, c.file);
  const rec: any = { id: c.cmu ? `cmu:${c.cmu.id}` : `${c.source}:${c.file.split('/').pop()}:${c.clip}`, source: c.source, file: c.file, fileSha256: c.cmu ? null : (shaByFile.get(c.file) ?? null), bvhSha256: c.cmu?.bvh_sha256, cmuTake: c.cmu ? `${c.cmu.take} (${c.cmu.take_description}) frames ${c.cmu.start_frame}-${c.cmu.end_frame}` : undefined, clip: c.clip ?? c.cmu?.id, cmu: c.cmu ? { take: c.cmu.take, limb: c.cmu.limb, height: c.cmu.height, direction: c.cmu.direction, reach_m: c.cmu.reach_m, peak_speed_mps: c.cmu.peak_speed_mps } : undefined, license: licenseOf(c.source), licenseNote: c.cmu ? undefined : manifest.sources?.[c.source]?.license, filedCategory: c.category, filedSubcategory: c.subcategory || null, variant: c.variant, flags: c.flags ?? [] };
  results.push(rec);
  if (!existsSync(path)) { rec.verdict = 'REJECT'; rec.reasons = ['source file missing from staging']; continue; }
  const f = loadSource(path);
  const anim = c.cmu ? [...f.anims.values()][0] : f.anims.get(c.clip);
  if (c.cmu?.paired) { rec.verdict = 'REJECT'; rec.intakeVerdict = 'REJECTED_MULTI_BODY'; rec.reasons = ['paired two-person capture: #17 refuses multi-body clips for solo slots (grapple-only)']; continue; }
  if (!anim) { rec.verdict = 'REJECT'; rec.reasons = ['clip not found in GLB']; continue; }
  const boneSet = new Set(f.joints);
  const prof = PROFILES.find((p) => p.match(boneSet));
  rec.rig = prof?.id ?? 'UNKNOWN_RIG';
  rec.sourceBones = f.joints.length;
  if (!prof) { rec.verdict = 'REJECT'; rec.reasons = ['no rig profile for this skeleton']; continue; }
  const dur = anim.duration;
  const steps = Math.min(120, Math.max(12, Math.round(dur * 30)));
  const times = Array.from({ length: steps + 1 }, (_, i) => (dur * i) / steps);

  // Source rest frame
  poseSource(f, [], 0, false);
  const sGet = (k: Keypoint) => wp(f.byName.get(prof.keypoints[k])!);
  const sBasis = bodyBasis(sGet);
  const sH = sGet('head').dot(sBasis.up) - Math.min(sGet('lFoot').dot(sBasis.up), sGet('rFoot').dot(sBasis.up));
    // A: source world -> target world (rest bodies aligned)
  const A = new THREE.Matrix4().multiplyMatrices(tBasis.m, sBasis.m.clone().transpose());
  
  // Mocap segments start facing wherever the performer stood. Yaw the source so
  // frame 0 faces the rest forward (the engine owns facing). Y0inv is applied
  // to every source world quantity before the rest alignment A.
  poseSource(f, anim.tracks, 0, true);
  const f0 = (() => { const a = sGet('rArm').sub(sGet('lArm')); a.addScaledVector(sBasis.up, -a.dot(sBasis.up)); return new THREE.Vector3().crossVectors(sBasis.up, a).normalize().multiplyScalar(sBasis.hand); })();
  const restF = sBasis.fwd.clone().addScaledVector(sBasis.up, -sBasis.fwd.dot(sBasis.up)).normalize();
  const y0 = new THREE.Quaternion().setFromUnitVectors(restF, f0.lengthSq() > 0.5 ? f0 : restF);
  const y0inv = y0.clone().invert();
  rec.startYawDeg = +(2 * Math.acos(Math.min(1, Math.abs(y0.w))) * 180 / Math.PI).toFixed(1);
  const AY = A.clone().multiply(new THREE.Matrix4().makeRotationFromQuaternion(y0inv));
  poseSource(f, [], 0, false);
  const sRestWorld = new Map<string, THREE.Quaternion>(); for (const n of Object.keys(prof.map)) { const o = f.byName.get(n); if (o) sRestWorld.set(n, wq(o)); }
  rec.restCheck = { sourceHeight: +sH.toFixed(3), targetHeight: +tH.toFixed(3), sourceHandedness: sBasis.hand, targetHandedness: tBasis.hand, alignmentDet: +A.determinant().toFixed(3) };

  // Source frames (native FK, translation included)
  const srcFrames: Frame[] = []; const srcRootTravel: THREE.Vector3[] = [];
  const sourceSamples: Map<string, { q: THREE.Quaternion; p: THREE.Vector3 }>[] = [];
  let fwd0s: THREE.Vector3 | null = null;
  for (const t of times) {
    poseSource(f, anim.tracks, t, true);
    const up = sBasis.up;
    if (!fwd0s) { const a = sGet('rArm').sub(sGet('lArm')); a.addScaledVector(up, -a.dot(up)); fwd0s = new THREE.Vector3().crossVectors(up, a).normalize().multiplyScalar(sBasis.hand); }
    const fr = measureFrame(sGet, sH, up, fwd0s, sBasis.hand); srcFrames.push(fr);
    srcRootTravel.push(sGet('hips'));
    const snap = new Map<string, { q: THREE.Quaternion; p: THREE.Vector3 }>();
    for (const n of Object.keys(prof.map)) { const o = f.byName.get(n); if (o) snap.set(n, { q: wq(o), p: wp(o) }); }
    sourceSamples.push(snap);
  }
  rec.sourceMeasured = summarize(srcFrames, dur);
  const rt0 = srcRootTravel[0], rtN = srcRootTravel[srcRootTravel.length - 1];
  const d = rtN.clone().sub(rt0);  // replaced by the twin's travel below when in-place
  // In-place exports carry no travel. Measure direction from the root-motion twin when the pack ships one.
  const twin = (manifest.clips as any[]).find((x) => x.source === c.source && x.clip !== c.clip && x.variant === 'root-motion' && (x.clip === `${c.clip}_RM` || (x.clip === c.clip && x.file !== c.file)));
  if (twin && existsSync(join(STAGING, twin.file))) {
    const tf = loadSource(join(STAGING, twin.file)); const ta = tf.anims.get(twin.clip);
    if (ta) {
      const tp = (tt: number) => { poseSource(tf, ta.tracks, tt, true); return wp(tf.byName.get(prof.keypoints.hips)!); };
      const p0 = tp(0); const pts = times.map((tt) => tp(Math.min(tt, ta.duration)).sub(p0));
      srcRootTravel.length = 0; for (const q of pts) srcRootTravel.push(q.add(rt0));
      d.copy(pts[pts.length - 1]);
      rec.rootMotionTwin = `${twin.file.split('/').pop()}:${twin.clip}`;
      poseSource(f, [], 0, false);
    }
  }
  const fwdB = sBasis.fwd.clone().applyQuaternion(y0), rightB = sBasis.right.clone().applyQuaternion(y0);
  rec.sourceMeasured.rootTravel = { fwd: +(d.dot(fwdB) / sH).toFixed(3), right: +(d.dot(rightB) / sH).toFixed(3), up: +(d.dot(sBasis.up) / sH).toFixed(3) };
  const lat = srcRootTravel.map((p) => p.clone().sub(rt0).dot(rightB) / sH);
  const fb = srcRootTravel.map((p) => p.clone().sub(rt0).dot(fwdB) / sH);
  rec.sourceMeasured.rootLateralPeak = +Math.max(...lat.map(Math.abs)).toFixed(3) * Math.sign(lat[lat.map(Math.abs).indexOf(Math.max(...lat.map(Math.abs)))] || 1);
  rec.sourceMeasured.rootFwdPeak = +Math.max(...fb.map(Math.abs)).toFixed(3) * Math.sign(fb[fb.map(Math.abs).indexOf(Math.max(...fb.map(Math.abs)))] || 1);

  const evalTarget = (clip: THREE.AnimationClip | null) => {
    if (!clip) return null;
    const frames: Frame[] = []; let fwd0: THREE.Vector3 | null = null;
    for (const t of times) {
      poseTarget(sk.root, tBones, tRest, clip, t);
      if (!fwd0) { const a = tGet('rArm').sub(tGet('lArm')); a.addScaledVector(tBasis.up, -a.dot(tBasis.up)); fwd0 = new THREE.Vector3().crossVectors(tBasis.up, a).normalize().multiplyScalar(tBasis.hand); }
      frames.push(measureFrame(tGet, tH, tBasis.up, fwd0, tBasis.hand));
    }
    // fidelity: effector directions vs source (rotated by A)
    let sum = 0, cnt = 0, worst = 0; const per: Record<string, number> = {};
    for (let i = 0; i < frames.length; i++) for (const k of Object.keys(frames[i].eff)) {
      const s = srcFrames[i].eff[k].clone().applyMatrix4(AY).normalize(); const tt = frames[i].eff[k].clone().normalize();
      const ang = Math.acos(Math.max(-1, Math.min(1, s.dot(tt)))) * 180 / Math.PI;
      sum += ang; cnt++; worst = Math.max(worst, ang); per[k] = Math.max(per[k] ?? 0, ang);
    }
    const heightErr = frames.reduce((a, fr, i) => a + Math.abs(fr.height - srcFrames[i].height), 0) / frames.length;
    const torsoErr = frames.reduce((a, fr, i) => a + Math.abs(fr.torsoUp - srcFrames[i].torsoUp), 0) / frames.length;
    return { summary: summarize(frames, dur), fidelity: { effDirErrMeanDeg: +(sum / cnt).toFixed(1), effDirErrMaxDeg: +worst.toFixed(1), perEffectorMaxDeg: Object.fromEntries(Object.entries(per).map(([k, v]) => [k, +v.toFixed(1)])), heightCurveErr: +heightErr.toFixed(3), torsoUpCurveErr: +torsoErr.toFixed(3) } };
  };
  const pack = (r: UniversalAnimationResult) => ({ verdict: r.verdict, mappedTracks: r.mappedTracks, unresolvedTracks: r.unresolvedTracks, targetCoverage: +r.targetCoverage.toFixed(3), restFilledBones: r.missingBones.length, movingBones: r.movingBones });

  // Path A: as-shipped #17 (alias layer + local deltas)
  {
    const tracks: THREE.KeyframeTrack[] = [];
    for (const tr of anim.tracks) {
      if (tr.path === 'rotation') tracks.push(new THREE.QuaternionKeyframeTrack(`${tr.node}.quaternion`, Array.from(tr.times), Array.from(tr.values)));
      else if (tr.path === 'translation') tracks.push(new THREE.VectorKeyframeTrack(`${tr.node}.position`, Array.from(tr.times), Array.from(tr.values)));
    }
    const sourceRest = new Map<string, THREE.Quaternion>(); for (const j of f.joints) sourceRest.set(j, f.rest.get(j)!.q.clone());
    resetTarget();
    const r = normalizeUniversalAnimation({ clip: new THREE.AnimationClip(rec.clip, dur, tracks), sourceRest, bodies: 1 }, sk.root);
    rec.asShipped = { intake: pack(r), measured: evalTarget(r.clip) };
  }

  // Path B: rig profile + world-space rest conversion, then the same #17 call
  {
    const mapped = Object.entries(prof.map).filter(([s, e]) => f.byName.has(s) && tBones.has(e.target));
    const byTarget = new Map(mapped.map(([s, e]) => [e.target, { s, e }]));
    const out = new Map<string, number[]>();
    for (const [, e] of mapped) out.set(e.target, []);
    for (let i = 0; i < times.length; i++) {
      const snap = sourceSamples[i];
      for (const [n, q] of tRest) tBones.get(n)?.quaternion.copy(q);
      sk.root.updateMatrixWorld(true);
      for (const b of tOrder) {
        const m = byTarget.get(b.name);
        const parentW = b.parent ? wq(b.parent) : new THREE.Quaternion();
        if (m) {
          const sNow = snap.get(m.s)!; const sRest = sRestWorld.get(m.s)!;
          // world delta from rest, carried into the target frame
          const delta = conjugate(A, y0inv.clone().multiply(sNow.q).multiply(sRest.clone().invert()));
          let W = delta.multiply(tRestWorld.get(b.name)!);
          if (m.e.child && m.e.targetChild && snap.has(m.e.child) && tBones.has(m.e.targetChild)) {
            const want = snap.get(m.e.child)!.p.clone().sub(sNow.p).applyMatrix4(AY).normalize();
            const childLocal = tBones.get(m.e.targetChild)!.position.clone().normalize();
            const have = childLocal.applyQuaternion(W).normalize();
            if (want.lengthSq() > 0.5 && have.lengthSq() > 0.5) W = new THREE.Quaternion().setFromUnitVectors(have, want).multiply(W);
          }
          const local = parentW.clone().invert().multiply(W).normalize();
          b.quaternion.copy(local);
          const arr = out.get(b.name)!; arr.push(local.x, local.y, local.z, local.w);
        }
        b.updateMatrixWorld(true);
      }
    }
    const tracks = [...out].map(([n, v]) => new THREE.QuaternionKeyframeTrack(`${n}.quaternion`, times, v));
    // sourceRest = Bannon rest: the conversion already produced Bannon-local rotations.
    resetTarget();
    const r = normalizeUniversalAnimation({ clip: new THREE.AnimationClip(rec.clip, dur, tracks), sourceRest: new Map(tRest), bodies: 1 }, sk.root);
    // THE BAKE'S OWN CONSTRAINT CHAIN, in the bake's order (convention twist,
    // spine redistribution, joint limits, then hinges LAST), applied BEFORE
    // measuring. The pass/reject decision is made on the clip that would
    // actually ship, and baked-motion.test.ts's joint-range proof holds for it.
    let constraints: any = null;
    if (r.clip) {
      const conv = removeConstantConventionTwist(r.clip, tRest);
      const spine = redistributeChain(r.clip, SPINE_CHAIN, tRest);
      const limits = clampToJointLimits(r.clip, tRest);
      const hinges = constrainHinges(r.clip, tRest);
      const excess = limits.map((v) => Math.max(v.bend - (JOINT_LIMITS[v.bone]?.bend ?? v.bend), v.twist - (JOINT_LIMITS[v.bone]?.twist ?? v.twist)));
      constraints = { conventionTwists: conv.length, spineRedistributed: spine, limitCorrections: limits.length, hingeCorrections: hinges.length,
        worstLimitExcessDeg: +Math.max(0, ...excess).toFixed(1), worstHingeOffAxisDeg: +Math.max(0, ...hinges.map((h) => h.worstOffAxis)).toFixed(1),
        bones: [...new Set([...limits, ...hinges].map((v) => v.bone.replace(M, '')))] };
    }
    rec.rigProfile = { intake: pack(r), constraints, mappedSourceBones: mapped.length, measured: evalTarget(r.clip), preIntakeFidelity: evalTarget(new THREE.AnimationClip(rec.clip, dur, tracks))?.fidelity };
    rec._clip = r.clip;
  }
  classify(rec);
}

// ---------------------------------------------------------------- classification
function classify(rec: any) {
  const reasons: string[] = []; const notes: string[] = [];
  const B = rec.rigProfile; const m: Summary | undefined = B?.measured?.summary; const fid = B?.measured?.fidelity; const s: any = rec.sourceMeasured;
  const A = rec.asShipped;
  if (A?.measured) notes.push(`as-shipped #17 path: ${A.intake.verdict}, ${A.intake.mappedTracks} tracks mapped, effector error mean ${A.measured.fidelity.effDirErrMeanDeg} deg / max ${A.measured.fidelity.effDirErrMaxDeg} deg`);
  else if (A) notes.push(`as-shipped #17 path: ${A.intake.verdict} (${A.intake.mappedTracks} tracks mapped)`);
  if (!B || !m) { rec.verdict = 'REJECT'; rec.reasons = ['rig-profile retarget produced no clip']; rec.notes = notes; return; }
  if (B.intake.verdict.startsWith('REJECTED')) reasons.push(`intake ${B.intake.verdict}`);
  const faithful = fid.effDirErrMeanDeg <= 12 && fid.effDirErrMaxDeg <= 40;
  if (!faithful) reasons.push(`retarget not faithful: effector error mean ${fid.effDirErrMeanDeg} deg, max ${fid.effDirErrMaxDeg} deg (gate mean<=12, max<=40)`);
  let measured = 'UNCLASSIFIED';
  const upright = (x: number) => x >= 0.8;
  const cat = rec.filedCategory as string;
  // Whole-body outcomes are measured FIRST, whatever the clip is filed under:
  // a "hit reaction" that ends lying down is a knockdown, not a hitstun.
  const endsLying = upright(m.torsoUpStart) && m.heightEnd <= 0.5 && m.torsoUpEnd <= 0.5;
  const floorToStand = m.heightStart <= 0.55 && m.heightEnd >= 0.85 && upright(m.torsoUpEnd);
  if (cat !== 'knockdown' && cat !== 'wakeup' && endsLying) {
    measured = 'knockdown/lands-lying';
    notes.push(`filed ${cat}, measured knockdown (start torso ${m.torsoUpStart}, end height ${m.heightEnd}H)`);
  } else if (cat !== 'knockdown' && cat !== 'wakeup' && floorToStand) {
    measured = 'wakeup/floor-to-stand';
    notes.push(`filed ${cat}, measured wakeup`);
  } else if (cat === 'strike-punch') {
    measured = m.handOutMax >= 0.19 && m.handTravel >= 0.08 ? (m.handOutMax >= 0.26 ? 'strike-punch/long' : 'strike-punch/short') : 'no-reach';
    if (measured === 'no-reach') reasons.push(`hand reach ${m.handOutMax}H / travel ${m.handTravel}H below the punch gate (reach>=0.19H ~0.35 m, travel>=0.08H)`);
    if (m.dur > 2.2) reasons.push(`too long for a strike slot (${m.dur}s > 2.2s)`);
    if (m.yawDriftMax > 100) reasons.push(`body turns ${m.yawDriftMax} deg (facing lost)`);
    if (!upright(m.torsoUpMin + 0.15)) reasons.push(`torso drops to ${m.torsoUpMin} (not a standing strike)`);
  } else if (cat === 'strike-kick') {
    const reach = Math.max(m.footOutMax, m.footOut0Max);
    measured = reach >= 0.33 ? (m.yawDriftMax > 150 ? 'strike-kick/spin' : m.footOut0Max > m.footOutMax + 0.05 ? 'strike-kick/side' : 'strike-kick/front-or-round') : 'no-reach';
    if (measured === 'no-reach') reasons.push(`foot reach ${reach}H (per-frame ${m.footOutMax}H, opening facing ${m.footOut0Max}H) below the kick gate (>=0.33H ~0.6 m)`);
    if (m.dur > 2.2) reasons.push(`too long for a strike slot (${m.dur}s > 2.2s)`);
  } else if (cat === 'knee') {
    measured = m.kneeUpMax >= -0.06 && m.kneeOut0Max >= 0.15 ? 'strike-knee' : 'no-knee-strike';
    if (measured !== 'strike-knee') reasons.push(`knee rises to ${m.kneeUpMax}H of hips (gate >= -0.06H) and forward ${m.kneeOut0Max}H (gate >= 0.15H)`);
    if (m.dur > 2.2) reasons.push(`too long for a strike slot (${m.dur}s > 2.2s)`);
  } else if (cat === 'hit-react') {
    const recover = upright(m.torsoUpEnd);
    measured = m.torsoUpMin >= 0.5 ? (recover ? 'hit-react/standing' : 'hit-react/no-recovery') : 'falls-over';
    if (measured !== 'hit-react/standing') reasons.push(`measured ${measured}: torso min ${m.torsoUpMin}, end ${m.torsoUpEnd}`);
    if (m.dur > 1.2) reasons.push(`too long for a hitstun reaction (${m.dur}s > 1.2s); loop/stagger use only`);
    if (m.headDispMax < 0.04) reasons.push(`no measurable recoil (head moves ${m.headDispMax}H < 0.04H)`);
  } else if (cat === 'knockdown') {
    measured = upright(m.torsoUpStart) && m.heightEnd <= 0.5 && m.torsoUpEnd <= 0.5 ? 'knockdown/lands-lying' : m.heightEnd <= 0.5 && m.torsoUpEnd <= 0.5 ? 'lying-hold' : m.heightEnd <= 0.5 ? 'ends-crouched (torso upright)' : 'does-not-reach-floor';
    if (measured !== 'knockdown/lands-lying') reasons.push(`measured ${measured}: start torso ${m.torsoUpStart}, end height ${m.heightEnd}H`);
  } else if (cat === 'wakeup') {
    measured = m.heightStart <= 0.55 && m.heightEnd >= 0.85 && upright(m.torsoUpEnd) ? 'wakeup/floor-to-stand' : 'not-a-floor-wakeup';
    if (measured !== 'wakeup/floor-to-stand') reasons.push(`measured ${measured}: start height ${m.heightStart}H, end height ${m.heightEnd}H, end torso ${m.torsoUpEnd}`);
    if (m.dur > 2.5) reasons.push(`too long for a wakeup (${m.dur}s > 2.5s)`);
  } else if (cat.startsWith('dodge')) {
    const lat = Math.abs(s.rootLateralPeak), fwdp = Math.abs(s.rootFwdPeak);
    if (m.torsoUpMin < 0.3) measured = 'roll';
    else if (lat >= 0.12 && lat >= fwdp) measured = s.rootLateralPeak > 0 ? 'sidestep/right' : 'sidestep/left';
    else if (fwdp >= 0.12) measured = s.rootFwdPeak > 0 ? 'dash/forward' : 'dash/back';
    else measured = 'in-place (no measurable root travel; direction not certifiable)';
    if (measured.startsWith('in-place')) reasons.push('no source root travel: cannot certify dodge direction');
    if (measured === 'roll') notes.push('roll goes through the floor plane unless runtime grounding lifts the pelvis');
    if (m.dur > 1.2 && !measured.startsWith('roll')) reasons.push(`too long for a sidestep/dodge (${m.dur}s > 1.2s)`);
  } else if (cat === 'block') {
    measured = m.handOutMax >= 0.05 && upright(m.torsoUpMin) ? 'block/guard-up' : 'no-guard';
    if (measured !== 'block/guard-up') reasons.push(`measured ${measured}`);
  }
  if (measured === 'knockdown/lands-lying') {
    if (m.fallTime !== null && m.fallTime > 1.2) reasons.push(`controlled lie-down, not a knockdown: upright-to-floor takes ${m.fallTime}s (> 1.2s)`);
    if (m.dur > 2.6) notes.push(`long floor settle (${m.dur}s): the knockdown slot must cut or blend out after landing`);
  }
  if (rec.filedSubcategory === 'weapon-block') reasons.push('weapon block (shield/sword guard): the pose holds a prop the fighters do not carry');
  if (rec.flags.includes('kaykit-special/skeleton-character-style')) reasons.push('stylised skeleton-monster performance (semantic mismatch for human fighters)');
  if (/Zombie/i.test(rec.clip)) reasons.push('zombie performance (semantic mismatch)');
  if (/Strafe/i.test(rec.clip) && cat.startsWith('dodge')) reasons.push('locomotion strafe cycle, not a Tekken sidestep');
  if (/Slide/i.test(rec.clip) && cat.startsWith('dodge')) reasons.push('feet-first floor slide (running-slide set), not a fighting evasion');
  notes.push('fingers: ' + (rec.rig.startsWith('kaykit') ? 'KayKit has none, Bannon fingers rest-filled (open hand)' : 'mapped 1-3 per finger'));
  if (B.constraints && (B.constraints.limitCorrections || B.constraints.hingeCorrections)) notes.push(`bake constraints corrected ${B.constraints.limitCorrections} limit / ${B.constraints.hingeCorrections} hinge track(s) (worst limit excess ${B.constraints.worstLimitExcessDeg} deg on ${B.constraints.bones.join(', ')}); measured AFTER correction`);
  notes.push('root translation dropped by #17 (bindClipTracksToTargetBones); runtime owns travel and grounding');
  if (measured === 'UNCLASSIFIED' || measured.startsWith('in-place')) { if (!reasons.some((r) => r.includes('certify'))) reasons.push(`measured ${measured}`); }
  rec.measuredCategory = measured;
  rec.verdict = reasons.length ? 'REJECT' : 'PASS_INTAKE';
  rec.intakeVerdict = B.intake.verdict;
  rec.reasons = reasons; rec.notes = notes;
}

// ---------------------------------------------------------------- output
const clips: Record<string, THREE.AnimationClip> = {};
for (const r of results) { if (r._clip && r.verdict === 'PASS_INTAKE') clips[r.id] = r._clip; delete r._clip; }
const summary = {
  generatedBy: 'tools/anim-intake/cc0_unarmed_intake.ts', staging: STAGING, target: 'public/models/BANNON_rigged.glb (58 joints)',
  targetHeightUnits: +tH.toFixed(3),
  gates: { faithful: 'effector direction error mean<=12 deg and max<=40 deg vs source-on-own-skeleton', punch: 'handOut>=0.19H (StrikeClipPool reach floor 0.35 m at 1.8 m) and travel>=0.08H (static-guard floor), dur<=2.2s, torso min>=0.65', kick: 'foot reach>=0.33H against per-frame OR opening facing, dur<=2.2s', knee: 'knee rises to >=-0.06H of hips and >=0.15H forward', hitReact: 'torso min>=0.5, end>=0.8, dur<=1.2s', knockdown: 'starts upright, ends height<=0.5H with torso<=0.5 (lying), upright-to-floor<=1.2s', wakeup: 'starts height<=0.55H, ends >=0.85H upright, dur<=2.5s', dodge: 'source root travel >=0.12H; lateral dominant = sidestep; dur<=1.2s' },
  counts: {
    candidates: results.length,
    passIntake: results.filter((r) => r.verdict === 'PASS_INTAKE').length,
    reject: results.filter((r) => r.verdict === 'REJECT').length,
    byCategory: Object.fromEntries([...new Set(results.map((r) => r.filedCategory))].map((c) => [c, { candidates: results.filter((r) => r.filedCategory === c).length, pass: results.filter((r) => r.filedCategory === c && r.verdict === 'PASS_INTAKE').length }])),
    asShippedFaithful: results.filter((r) => r.asShipped?.measured && r.asShipped.measured.fidelity.effDirErrMeanDeg <= 12 && r.asShipped.measured.fidelity.effDirErrMaxDeg <= 40).length,
  },
  results,
};
// ---------------------------------------------------------------- bake (--bake)
/**
 * STRIKE CLIPS INTO THE BAKED BANK. Only PASS_INTAKE clips measured as a
 * strike (punch, kick, knee) are written. Hit reactions, knockdowns,
 * wakeups and sidesteps are recorded as passes in the JSON but NOT baked,
 * because those slots are owned by other systems (StrikeClipPool refuses them).
 * Each file carries provenance and licence class, and every index entry is
 * stamped `intake: 'oss-universal-intake'` so the full bake keeps it.
 * StrikeClipPool's own refusal and reach gates still decide admission; this
 * step only makes the clips visible to it.
 */
const BAKE = process.argv.includes('--bake');
const bakedNames: string[] = [];
if (BAKE) {
  const bakedDir = join(ROOT, 'public/motion/baked');
  const indexPath = join(bakedDir, 'index.json');
  const index = JSON.parse(readFileSync(indexPath, 'utf8'));
  for (const k of Object.keys(index)) if (index[k]?.intake === 'oss-universal-intake') delete index[k];
  for (const f of readdirSync(bakedDir)) if (/^OSS_/.test(f)) unlinkSync(join(bakedDir, f));
  const tag = (src: string) => ({ 'quaternius-ual-1': 'UAL1', 'quaternius-ual-2': 'UAL2', 'kaykit-character-animations': 'KAYKIT', mesh2motion: 'M2M', 'cmu-mocap-bvh': 'CMU' } as Record<string, string>)[src] ?? 'OSS';
  const familyOf = (r: any): string => {
    if (r.source === 'cmu-mocap-bvh') {
      const take = r.cmu?.take ?? '';
      if (/^14_/.test(take)) return 'boxing';
      if (/^135_/.test(take)) return 'karate';
      if (/^(87|88|90)_/.test(take)) return 'spin';
      if (/^86_/.test(take)) return 'knee';
      return 'mocap';
    }
    if (r.source.startsWith('kaykit') || /Kick_Breach/.test(r.clip)) return 'brawl';
    return 'boxing';
  };
  const hipsBind = tBones.get(`${M}Hips`)!.position;
  for (const r of results) {
    if (r.verdict !== 'PASS_INTAKE' || !/^strike-/.test(r.measuredCategory ?? '')) continue;
    const clip: THREE.AnimationClip | undefined = clips[r.id];
    if (!clip) continue;
    const name = `OSS_${tag(r.source)}_${String(r.clip).replace(/^cmu_/, '').replace(/[^A-Za-z0-9]+/g, '_').toUpperCase()}`;
    const tracks: Record<string, { t: number[]; q: number[] }> = {};
    for (const tr of clip.tracks) {
      if (!tr.name.endsWith('.quaternion')) continue;
      tracks[tr.name.slice(0, -11)] = { t: Array.from(tr.times, (v) => +v.toFixed(4)), q: Array.from(tr.values, (v) => +v.toFixed(5)) };
    }
    const m = r.rigProfile.measured.summary;
    const kick = /kick|knee/.test(r.measuredCategory);
    const semantic = kick ? 'attack_2' : 'attack_1';
    const provenance = { pack: r.source, license: r.license, file: r.file, fileSha256: r.fileSha256 ?? undefined, bvhSha256: r.bvhSha256 ?? undefined, clip: r.clip, cmuTake: r.cmuTake, intakeVerdict: r.intakeVerdict, measuredCategory: r.measuredCategory, tool: 'tools/anim-intake/cc0_unarmed_intake.ts' };
    const dur = +clip.duration.toFixed(4);
    writeFileSync(join(bakedDir, `${name}.json`), JSON.stringify({ name, bank: `oss-${tag(r.source).toLowerCase()}`, dur, semantic, airborne: false, positions: { [`${M}Hips`]: { t: [0], p: [+hipsBind.x.toFixed(5), +hipsBind.y.toFixed(5), +hipsBind.z.toFixed(5)] } }, owns: false, tracks, provenance }));
    const trav = r.sourceMeasured.rootTravel;
    index[name] = {
      travels: +(Math.hypot(trav.fwd, trav.right) * tH).toFixed(3), movingBones: r.rigProfile.intake.movingBones, boneCount: Object.keys(tracks).length,
      file: `${name}.json`, bank: `oss-${tag(r.source).toLowerCase()}`, dur, bones: Object.keys(tracks).length, semantic, owns: false, airborne: false,
      provenance, bodies: 1, intake: 'oss-universal-intake', family: familyOf(r),
      strike: {
        limb: kick ? m.footLeadLimb : (m.leadHand === 'left' ? 'LeftHand' : 'RightHand'),
        reachLimb: kick ? m.footLeadLimb : (m.leadHand === 'left' ? 'LeftHand' : 'RightHand'),
        reachFace: kick ? m.faceAtFootPeak : m.faceAtHandPeak,
        faceMin: +Math.cos((Math.min(180, m.yawDriftMax) * Math.PI) / 180).toFixed(3),
        handReach: +(m.handOutMax * tH).toFixed(3),
        footReach: +(Math.max(m.footOutMax, m.footOut0Max) * tH).toFixed(3),
        ...(/knee/.test(r.measuredCategory) ? { kneeReach: +(m.kneeOut0Max * tH).toFixed(3), kneeRise: m.kneeUpMax } : {}),
        footLift: 0,
        startUp: upright1(m.torsoUpStart), endUp: upright1(m.torsoUpEnd),
      },
      armForward: 0, spineUp: m.spineUpMedian,
    };
    bakedNames.push(name);
  }
  writeFileSync(indexPath, JSON.stringify(index));
  console.log(`baked ${bakedNames.length} strike clips into public/motion/baked (index entries stamped oss-universal-intake)`);
}
function upright1(x: number) { return +Math.max(0, Math.min(1, x)).toFixed(3); }
(summary as any).baked = bakedNames;
writeFileSync(OUT, JSON.stringify(summary, null, 1) + '\n');
(globalThis as any).__cc0Clips = clips;
export const passedClips = clips;
console.log(JSON.stringify(summary.counts, null, 1));
for (const r of results) console.log(`${r.verdict.padEnd(11)} ${r.id.padEnd(80)} ${String(r.measuredCategory ?? '').padEnd(28)} A:${r.asShipped?.measured?.fidelity.effDirErrMeanDeg ?? '-'} B:${r.rigProfile?.measured?.fidelity.effDirErrMeanDeg ?? '-'}/${r.rigProfile?.measured?.fidelity.effDirErrMaxDeg ?? '-'} | ${(r.reasons ?? []).join('; ')}`);
