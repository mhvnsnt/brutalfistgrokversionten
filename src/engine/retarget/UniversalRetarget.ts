// `.ts` extensions on purpose — `node --experimental-strip-types` resolves
// them literally, and the offline harness imports these same modules.
import * as THREE from 'three';

import {
  collectJoints,
  detectHumanoidBoneMap,
  FINGER_NAMES,
  type HumanoidBoneMap,
  type HumanoidRigOverride,
  type LimbSlot,
  OPTIONAL_SLOTS,
  REQUIRED_SLOTS,
} from './HumanoidBoneMap.ts';
import { HUMANOID_RIG_OVERRIDES } from './HumanoidRigOverrides.ts';

/**
 * UNIVERSAL RETARGET — rest-relative, world-space rotation transfer.
 *
 * The existing lanes (bindClipTracksToTargetBones + makeClipBindRelative)
 * rewrite track NAMES and re-base LOCAL rotations. That is exact when source
 * and target share a skeleton, and wrong the moment they do not: a local
 * rotation means nothing under a different parent chain, a different rest
 * pose, a different bone count or a different axis convention.
 *
 * This lane transfers each mapped joint's WORLD rotation change instead:
 *
 *   C     = target rig frame * source rig frame^-1   (facing / axis convention)
 *   D(t)  = C * Ws(t) * Ws(rest)^-1 * C^-1           (source world delta)
 *   A     = min rotation taking the target rest bone direction onto the
 *           source rest bone direction, both in target space (T vs A pose)
 *   Wt(t) = D(t) * A * Wt(rest)
 *   local = parentWorld(t)^-1 * Wt(t)                 (solved top-down)
 *
 * Spine and neck chains of any length are resampled by chain fraction, so a
 * 1-bone spine gets the whole bend and a 5-bone spine shares it. Optional
 * joints absent on either side are skipped; target joints no slot claims keep
 * their rest. Hips translation is carried as a world displacement scaled by
 * the leg-length ratio, so metres, centimetres and chibi proportions all land
 * on the floor.
 */

export type RetargetStatus = 'RETARGETED' | 'UNMAPPABLE' | 'MISSING_CLIP';

export interface RetargetRig {
  root: THREE.Object3D;
  map: HumanoidBoneMap;
  joints: THREE.Object3D[];
  byName: Map<string, THREE.Object3D>;
  /** Rest local transforms, captured at construction. */
  restLocal: Map<THREE.Object3D, { p: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3 }>;
  /** Rest world rotation / position of every joint. */
  restWorldQ: Map<THREE.Object3D, THREE.Quaternion>;
  restWorldP: Map<THREE.Object3D, THREE.Vector3>;
  /**
   * Rig frame: columns (left, up, forward). Forward comes from anatomy (ankle
   * -> toes), left from the rig's own L/R labels. MEASURED (PR #20,
   * cc0_unarmed_intake): the Bannon bind faces +X with its LEFT-labelled side
   * at +Z, the mirror image of UAL/KayKit/Mesh2Motion/CMU. So this basis may be
   * left-handed (det -1); source->target is then a reflection, and rotations
   * are carried by conjugation C R C^T, which stays a proper rotation.
   */
  frame: THREE.Matrix4;
  /** +1 for a right-handed (left = up x forward) rig, -1 for a mirrored one. */
  handedness: number;
  legLength: number;
  height: number;
  label: string;
}

export interface RetargetOptions {
  /** Sampling rate for the output clip. Default 30. */
  fps?: number;
  /** Write constant rest tracks for target joints the clip does not drive. Default false. */
  fillRest?: boolean;
  /** Carry hips translation. Default true. */
  rootMotion?: boolean;
  /**
   * Ground lock: per frame, shift the hips along the target's up axis so its
   * lowest foot sits as high above its own rest as the source's does (in leg
   * lengths). Different leg proportions otherwise sink or float the feet even
   * when every joint angle is right. Default true.
   */
  groundLock?: boolean;
}

export interface UniversalRetargetResult {
  status: RetargetStatus;
  clip: THREE.AnimationClip | null;
  reasons: string[];
  missingSource: LimbSlot[];
  missingTarget: LimbSlot[];
  drivenJoints: string[];
  skippedOptional: string[];
}

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _q1 = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _m1 = new THREE.Matrix4();
const _m2 = new THREE.Matrix4();
const _m3 = new THREE.Matrix4();

/**
 * The lowest foot joint's height above its own rest height, in leg lengths.
 * Feet and toes both count; the planted one is the lowest.
 */
export function lowestFootLift(rig: RetargetRig, up: THREE.Vector3): number {
  let lift = Infinity;
  for (const slot of ['leftFoot', 'rightFoot', 'leftToes', 'rightToes'] as LimbSlot[]) {
    const name = rig.map.slots[slot];
    const j = name ? rig.byName.get(name) : undefined;
    if (!j) continue;
    const h = _v1.setFromMatrixPosition(j.matrixWorld).dot(up) - rig.restWorldP.get(j)!.dot(up);
    lift = Math.min(lift, h);
  }
  return lift / rig.legLength;
}

/** Source-space -> target-space basis change (rotation or reflection). */
export function sourceToTargetFrame(src: RetargetRig, tgt: RetargetRig): THREE.Matrix4 {
  return tgt.frame.clone().multiply(src.frame.clone().transpose());
}

/** out = C * R(q) * C^T as a quaternion. Valid for reflections too. */
export function conjugateRotation(C: THREE.Matrix4, Ct: THREE.Matrix4, q: THREE.Quaternion, out: THREE.Quaternion): THREE.Quaternion {
  _m2.makeRotationFromQuaternion(q);
  _m1.multiplyMatrices(C, _m2).multiply(Ct);
  return out.setFromRotationMatrix(_m1).normalize();
}

/** Three's PropertyBinding strips `:` etc.; GLTFLoader already applied it. */
export function sanitizeJointName(name: string): string {
  return THREE.PropertyBinding.sanitizeNodeName(name);
}

function mixKey(name: string): string {
  return name.toLowerCase().replace(/^mixamorig[0-9:_\-.\s]*/, 'mixamorig');
}

export function buildRetargetRig(
  root: THREE.Object3D,
  opts: { label?: string; file?: string; overrides?: readonly HumanoidRigOverride[]; map?: HumanoidBoneMap } = {},
): RetargetRig {
  root.updateMatrixWorld(true);
  const joints = collectJoints(root);
  const byName = new Map<string, THREE.Object3D>();
  for (const j of joints) {
    for (const key of [j.name, sanitizeJointName(j.name), mixKey(j.name)]) if (!byName.has(key)) byName.set(key, j);
  }
  const map = opts.map ?? detectHumanoidBoneMap(root, { file: opts.file ?? opts.label, overrides: opts.overrides ?? HUMANOID_RIG_OVERRIDES });
  const restLocal = new Map<THREE.Object3D, { p: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3 }>();
  const restWorldQ = new Map<THREE.Object3D, THREE.Quaternion>();
  const restWorldP = new Map<THREE.Object3D, THREE.Vector3>();
  for (const j of joints) {
    restLocal.set(j, { p: j.position.clone(), q: j.quaternion.clone(), s: j.scale.clone() });
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    j.matrixWorld.decompose(p, q, _v1);
    restWorldQ.set(j, q);
    restWorldP.set(j, p);
  }
  const get = (slot: LimbSlot) => (map.slots[slot] ? byName.get(map.slots[slot]!) : undefined);
  const P = (slot: LimbSlot) => { const j = get(slot); return j ? restWorldP.get(j)! : null; };
  // Frame: up = hips -> head, left = right leg -> left leg (arms if legs missing).
  const hips = P('hips');
  const head = P('head');
  const up = hips && head ? head.clone().sub(hips) : new THREE.Vector3(0, 1, 0);
  if (up.lengthSq() < 1e-12) up.set(0, 1, 0);
  up.normalize();
  const l = P('leftUpperLeg') ?? P('leftUpperArm');
  const r = P('rightUpperLeg') ?? P('rightUpperArm');
  const left = l && r ? l.clone().sub(r) : new THREE.Vector3(1, 0, 0);
  left.addScaledVector(up, -left.dot(up));
  if (left.lengthSq() < 1e-12) left.set(1, 0, 0);
  left.normalize();
  // Forward from the feet when the rig has toes; otherwise assume the rig is
  // right-handed (left = up x forward  =>  forward = left x up).
  const fwd = new THREE.Vector3();
  for (const side of ['left', 'right'] as const) {
    const foot = P(`${side}Foot`); const toe = P(`${side}Toes`);
    if (foot && toe) fwd.add(toe.clone().sub(foot));
  }
  // No toe joints (EDWIN_KENNEDY_unchained, wrestler_base): the foot MESH still
  // points where the character faces. Centroid of the vertices the foot bone
  // dominates, minus the ankle.
  if (fwd.lengthSq() < 1e-10) {
    for (const side of ['left', 'right'] as const) {
      const foot = get(`${side}Foot`);
      const c = foot ? dominantVertexCentroid(root, foot) : null;
      if (foot && c) fwd.add(c.sub(restWorldP.get(foot)!));
    }
  }
  fwd.addScaledVector(up, -fwd.dot(up));
  if (fwd.lengthSq() < 1e-10) fwd.crossVectors(left, up);
  // Keep the measured facing, re-orthogonalize left against it.
  fwd.normalize();
  left.addScaledVector(fwd, -left.dot(fwd)).normalize();
  const handedness = Math.sign(new THREE.Vector3().crossVectors(up, fwd).dot(left)) || 1;
  const frame = new THREE.Matrix4().makeBasis(left, up, fwd);
  let legLength = 0;
  for (const side of ['left', 'right'] as const) {
    const a = P(`${side}UpperLeg`); const b = P(`${side}LowerLeg`); const c = P(`${side}Foot`);
    if (a && b && c) legLength = Math.max(legLength, a.distanceTo(b) + b.distanceTo(c));
  }
  let minY = Infinity; let maxY = -Infinity;
  for (const p of restWorldP.values()) { minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
  const height = Number.isFinite(maxY - minY) ? maxY - minY : 0;
  if (!legLength) legLength = height * 0.5 || 1;
  return { root, map, joints, byName, restLocal, restWorldQ, restWorldP, frame, handedness, legLength, height, label: opts.label ?? root.name ?? 'rig' };
}

/** World centroid (rest pose) of the skinned vertices whose dominant influence is `bone`. */
export function dominantVertexCentroid(root: THREE.Object3D, bone: THREE.Object3D): THREE.Vector3 | null {
  const sum = new THREE.Vector3();
  let count = 0;
  const v = new THREE.Vector3();
  root.traverse((o) => {
    const mesh = o as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh || !mesh.skeleton) return;
    const bi = mesh.skeleton.bones.indexOf(bone as THREE.Bone);
    if (bi < 0) return;
    const pos = mesh.geometry.getAttribute('position');
    const si = mesh.geometry.getAttribute('skinIndex');
    const sw = mesh.geometry.getAttribute('skinWeight');
    if (!pos || !si || !sw) return;
    mesh.skeleton.update();
    for (let i = 0; i < pos.count; i++) {
      let best = -1; let bw = 0;
      for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > bw) { bw = w; best = si.getComponent(i, k); } }
      if (best !== bi) continue;
      mesh.getVertexPosition(i, v);
      sum.add(v.applyMatrix4(mesh.matrixWorld));
      count++;
    }
  });
  return count ? sum.divideScalar(count) : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Euler / quaternion normalization
// ─────────────────────────────────────────────────────────────────────────────

export interface EulerKeyFile {
  dur: number;
  keys: Array<{ t: number; bones: Record<string, { rx: number; ry: number; rz: number }> }>;
}

/** The Bannon rx/ry/rz bank as quaternion tracks. Order defaults to XYZ, as the runtime reads it. */
export function eulerKeyFileToClip(name: string, data: EulerKeyFile, order: THREE.EulerOrder = 'XYZ'): THREE.AnimationClip {
  const bones = new Set<string>();
  for (const k of data.keys) for (const b of Object.keys(k.bones)) bones.add(b);
  const tracks: THREE.KeyframeTrack[] = [];
  const e = new THREE.Euler();
  const q = new THREE.Quaternion();
  let dropped = 0;
  for (const bone of bones) {
    const times: number[] = [];
    const values: number[] = [];
    let prev: THREE.Quaternion | null = null;
    for (const key of data.keys) {
      const r = key.bones[bone];
      if (!r) continue;
      // MEASURED in the shipped bank: some keys carry only `rz` (e.g.
      // BREAKDANCE_FOOTWORK_3 finger keys). A missing component is not zero;
      // the key is dropped and counted, never filled in.
      if (!Number.isFinite(r.rx) || !Number.isFinite(r.ry) || !Number.isFinite(r.rz)) { dropped++; continue; }
      q.setFromEuler(e.set(r.rx, r.ry, r.rz, order));
      if (prev && prev.dot(q) < 0) q.set(-q.x, -q.y, -q.z, -q.w);
      times.push(key.t);
      values.push(q.x, q.y, q.z, q.w);
      prev = (prev ?? new THREE.Quaternion()).copy(q);
    }
    if (times.length) tracks.push(new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, times, values));
  }
  const clip = new THREE.AnimationClip(name, data.dur, tracks);
  (clip as THREE.AnimationClip & { userData: Record<string, unknown> }).userData = { sourceFormat: 'euler-rx-ry-rz', eulerOrder: order, droppedNonFiniteKeys: dropped };
  return clip;
}

/** `.rotation` (Euler vector) tracks -> `.quaternion` tracks. Other tracks pass through. */
export function eulerTracksToQuaternion(clip: THREE.AnimationClip, order: THREE.EulerOrder = 'XYZ'): THREE.AnimationClip {
  if (!clip.tracks.some((t) => t.name.endsWith('.rotation'))) return clip;
  const e = new THREE.Euler();
  const q = new THREE.Quaternion();
  const tracks = clip.tracks.map((t) => {
    if (!t.name.endsWith('.rotation') || t.getValueSize() !== 3) return t;
    const values: number[] = [];
    let prev: THREE.Quaternion | null = null;
    for (let i = 0; i < t.times.length; i++) {
      q.setFromEuler(e.set(t.values[i * 3], t.values[i * 3 + 1], t.values[i * 3 + 2], order));
      if (prev && prev.dot(q) < 0) q.set(-q.x, -q.y, -q.z, -q.w);
      values.push(q.x, q.y, q.z, q.w);
      prev = (prev ?? new THREE.Quaternion()).copy(q);
    }
    return new THREE.QuaternionKeyframeTrack(t.name.replace(/\.rotation$/, '.quaternion'), Array.from(t.times), values);
  });
  const out = new THREE.AnimationClip(clip.name, clip.duration, tracks);
  (out as THREE.AnimationClip & { userData?: unknown }).userData = (clip as THREE.AnimationClip & { userData?: unknown }).userData;
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sampling
// ─────────────────────────────────────────────────────────────────────────────

interface BoundTrack { joint: THREE.Object3D; prop: 'quaternion' | 'position' | 'scale'; interp: THREE.Interpolant }

function trackBoneName(trackName: string): { bone: string; prop: string } {
  const dot = trackName.lastIndexOf('.');
  const withoutProp = dot >= 0 ? trackName.slice(0, dot) : trackName;
  const prop = dot >= 0 ? trackName.slice(dot + 1) : '';
  const pipe = withoutProp.lastIndexOf('|');
  return { bone: pipe >= 0 ? withoutProp.slice(pipe + 1) : withoutProp, prop };
}

export function bindClipToRig(clip: THREE.AnimationClip, rig: RetargetRig): { bound: BoundTrack[]; unresolved: string[] } {
  const normalized = eulerTracksToQuaternion(clip);
  const bound: BoundTrack[] = [];
  const unresolved: string[] = [];
  for (const track of normalized.tracks) {
    const { bone, prop } = trackBoneName(track.name);
    if (prop !== 'quaternion' && prop !== 'position' && prop !== 'scale') continue;
    const joint = rig.byName.get(bone) ?? rig.byName.get(sanitizeJointName(bone)) ?? rig.byName.get(mixKey(bone));
    if (!joint) { unresolved.push(track.name); continue; }
    bound.push({ joint, prop, interp: (track as unknown as { createInterpolant(): THREE.Interpolant }).createInterpolant() });
  }
  return { bound, unresolved };
}

/** Pose a rig at time t: rest everywhere, then the clip's tracks. */
export function poseRig(rig: RetargetRig, bound: BoundTrack[], t: number): void {
  for (const [j, r] of rig.restLocal) { j.position.copy(r.p); j.quaternion.copy(r.q); j.scale.copy(r.s); }
  for (const b of bound) {
    const v = b.interp.evaluate(t) as ArrayLike<number>;
    if (b.prop === 'quaternion') b.joint.quaternion.set(v[0], v[1], v[2], v[3]).normalize();
    else if (b.prop === 'position') b.joint.position.set(v[0], v[1], v[2]);
    else b.joint.scale.set(v[0], v[1], v[2]);
  }
  rig.root.updateMatrixWorld(true);
}

export function restoreRest(rig: RetargetRig): void {
  for (const [j, r] of rig.restLocal) { j.position.copy(r.p); j.quaternion.copy(r.q); j.scale.copy(r.s); }
  rig.root.updateMatrixWorld(true);
}

export function sampleTimes(duration: number, fps: number): number[] {
  const n = Math.max(1, Math.ceil(duration * fps - 1e-6));
  const out: number[] = [];
  for (let i = 0; i <= n; i++) out.push(Math.min(duration, (i / n) * duration));
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Correspondence
// ─────────────────────────────────────────────────────────────────────────────

/** A target joint's driver: a source joint, or a fraction along a source chain. */
type Driver =
  | { kind: 'joint'; source: THREE.Object3D; dirFrom?: THREE.Object3D; dirTo?: THREE.Object3D; tDirFrom?: THREE.Object3D; tDirTo?: THREE.Object3D }
  | { kind: 'chain'; chain: THREE.Object3D[]; fraction: number };

interface Plan {
  drivers: Map<THREE.Object3D, Driver>;
  missingSource: LimbSlot[];
  missingTarget: LimbSlot[];
  skippedOptional: string[];
}

const LIMB_CHILD: Partial<Record<LimbSlot, LimbSlot>> = {
  leftClavicle: 'leftUpperArm', leftUpperArm: 'leftLowerArm', leftLowerArm: 'leftHand',
  rightClavicle: 'rightUpperArm', rightUpperArm: 'rightLowerArm', rightLowerArm: 'rightHand',
  leftUpperLeg: 'leftLowerLeg', leftLowerLeg: 'leftFoot', leftFoot: 'leftToes',
  rightUpperLeg: 'rightLowerLeg', rightLowerLeg: 'rightFoot', rightFoot: 'rightToes',
};

function planCorrespondence(src: RetargetRig, tgt: RetargetRig): Plan {
  const drivers = new Map<THREE.Object3D, Driver>();
  const sj = (slot: LimbSlot) => (src.map.slots[slot] ? src.byName.get(src.map.slots[slot]!) : undefined);
  const tj = (slot: LimbSlot) => (tgt.map.slots[slot] ? tgt.byName.get(tgt.map.slots[slot]!) : undefined);
  const missingSource = REQUIRED_SLOTS.filter((s) => !sj(s));
  const missingTarget = REQUIRED_SLOTS.filter((s) => !tj(s));
  const skippedOptional: string[] = [];
  for (const slot of [...REQUIRED_SLOTS, ...OPTIONAL_SLOTS]) {
    const s = sj(slot); const t = tj(slot);
    if (!s || !t) { if (s || t) skippedOptional.push(slot); continue; }
    const child = LIMB_CHILD[slot];
    const sc = child ? sj(child) : undefined;
    const tc = child ? tj(child) : undefined;
    drivers.set(t, sc && tc ? { kind: 'joint', source: s, dirFrom: s, dirTo: sc, tDirFrom: t, tDirTo: tc } : { kind: 'joint', source: s });
  }
  // Spine: source chain = [hips, ...spine]; target spine joint k of m sits at fraction k/m.
  const sHips = sj('hips');
  const sSpine = src.map.spine.map((n) => src.byName.get(n)!).filter(Boolean);
  const tSpine = tgt.map.spine.map((n) => tgt.byName.get(n)!).filter(Boolean);
  if (sHips && tSpine.length) {
    const chain = [sHips, ...sSpine];
    tSpine.forEach((t, k) => drivers.set(t, { kind: 'chain', chain, fraction: sSpine.length ? (k + 1) / tSpine.length : 0 }));
  }
  // Neck: source chain = [spineTop, ...neck, head]; target neck joints at k/(m+1).
  const sHead = sj('head');
  const sNeck = src.map.neck.map((n) => src.byName.get(n)!).filter(Boolean);
  const tNeck = tgt.map.neck.map((n) => tgt.byName.get(n)!).filter(Boolean);
  const sTop = sSpine[sSpine.length - 1] ?? sHips;
  if (sTop && sHead && tNeck.length) {
    const chain = [sTop, ...sNeck, sHead];
    tNeck.forEach((t, k) => drivers.set(t, { kind: 'chain', chain, fraction: (k + 1) / (tNeck.length + 1) }));
  }
  // Fingers: optional, matched by side/finger/segment.
  for (const [key, tName] of Object.entries(tgt.map.fingers)) {
    const sName = src.map.fingers[key];
    const t = tgt.byName.get(tName);
    const s = sName ? src.byName.get(sName) : undefined;
    if (t && s) drivers.set(t, { kind: 'joint', source: s });
    else if (t) skippedOptional.push(key);
  }
  void FINGER_NAMES;
  return { drivers, missingSource, missingTarget, skippedOptional };
}

// ─────────────────────────────────────────────────────────────────────────────
// Retarget
// ─────────────────────────────────────────────────────────────────────────────

/** World delta of a source chain at a fraction: slerp between neighbouring joints. */
function chainDelta(chain: THREE.Object3D[], fraction: number, deltas: Map<THREE.Object3D, THREE.Quaternion>, out: THREE.Quaternion): THREE.Quaternion {
  const n = chain.length - 1;
  if (n <= 0) return out.copy(deltas.get(chain[0])!);
  const x = Math.min(1, Math.max(0, fraction)) * n;
  const i = Math.min(n - 1, Math.floor(x));
  const f = x - i;
  return out.copy(deltas.get(chain[i])!).slerp(deltas.get(chain[i + 1])!, f);
}

export function retargetClip(
  clip: THREE.AnimationClip,
  src: RetargetRig,
  tgt: RetargetRig,
  options: RetargetOptions = {},
): UniversalRetargetResult {
  const fps = options.fps ?? 30;
  const reasons: string[] = [];
  if (!clip || !clip.tracks.length) {
    return { status: 'MISSING_CLIP', clip: null, reasons: ['MISSING_CLIP: no tracks'], missingSource: [], missingTarget: [], drivenJoints: [], skippedOptional: [] };
  }
  const plan = planCorrespondence(src, tgt);
  if (plan.missingSource.length) reasons.push(`UNMAPPABLE: source rig lacks ${plan.missingSource.join(',')}`);
  if (plan.missingTarget.length) reasons.push(`UNMAPPABLE: target rig lacks ${plan.missingTarget.join(',')}`);
  const { bound } = bindClipToRig(clip, src);
  if (!bound.length) reasons.push('UNMAPPABLE: no clip track resolves to a source joint');
  if (reasons.length) {
    return { status: 'UNMAPPABLE', clip: null, reasons, missingSource: plan.missingSource, missingTarget: plan.missingTarget, drivenJoints: [], skippedOptional: plan.skippedOptional };
  }

  // C: source-space -> target-space (a rotation, or a reflection when one rig
  // is mirror-handed). Orthonormal, so C^-1 = C^T.
  const C = sourceToTargetFrame(src, tgt);
  const Ct = C.clone().transpose();
  // A per driven target joint, from rest bone directions.
  const align = new Map<THREE.Object3D, THREE.Quaternion>();
  const inheritFrom = (t: THREE.Object3D): THREE.Quaternion => {
    for (let p = t.parent; p; p = p.parent) { const a = align.get(p); if (a) return a; }
    return new THREE.Quaternion();
  };
  const order: THREE.Object3D[] = [];
  tgt.root.traverse((o) => { if (tgt.restLocal.has(o)) order.push(o); });
  for (const t of order) {
    const d = plan.drivers.get(t);
    if (d && d.kind === 'joint' && d.dirFrom && d.dirTo && d.tDirFrom && d.tDirTo) {
      const sd = _v1.copy(src.restWorldP.get(d.dirTo)!).sub(src.restWorldP.get(d.dirFrom)!).applyMatrix4(C);
      const td = _v2.copy(tgt.restWorldP.get(d.tDirTo)!).sub(tgt.restWorldP.get(d.tDirFrom)!);
      if (sd.lengthSq() > 1e-12 && td.lengthSq() > 1e-12) {
        align.set(t, new THREE.Quaternion().setFromUnitVectors(td.normalize(), sd.normalize()));
        continue;
      }
    }
    if (d) align.set(t, inheritFrom(t).clone());
  }

  const times = sampleTimes(clip.duration, fps);
  const drivenOrder = order.filter((t) => plan.drivers.has(t));
  const values = new Map<THREE.Object3D, number[]>();
  for (const t of drivenOrder) values.set(t, []);
  const hipsPos: number[] = [];
  const sHips = src.byName.get(src.map.slots.hips!)!;
  const tHips = tgt.byName.get(tgt.map.slots.hips!)!;
  const scale = tgt.legLength / src.legLength;
  const sourceJoints = new Set<THREE.Object3D>();
  for (const d of plan.drivers.values()) {
    if (d.kind === 'joint') sourceJoints.add(d.source);
    else d.chain.forEach((j) => sourceJoints.add(j));
  }
  const deltas = new Map<THREE.Object3D, THREE.Quaternion>();
  for (const j of sourceJoints) deltas.set(j, new THREE.Quaternion());
  const worldT = new Map<THREE.Object3D, THREE.Quaternion>();
  const tParentStatic = new Map<THREE.Object3D, THREE.Quaternion>();
  // World rotation of each target joint's non-joint ancestry (armature nodes), fixed.
  for (const t of order) {
    let p = t.parent;
    while (p && !tgt.restLocal.has(p)) p = p.parent;
    if (!p) {
      const q = new THREE.Quaternion();
      if (t.parent) { t.parent.updateWorldMatrix(true, false); t.parent.matrixWorld.decompose(_v1, q, _v2); }
      tParentStatic.set(t, q);
    }
  }
  const hipsParentInv = new THREE.Matrix4();
  if (tHips.parent) { tHips.parent.updateWorldMatrix(true, false); }
  let moved = false;
  const groundLock = options.groundLock !== false && options.rootMotion !== false;
  const sUp = new THREE.Vector3().setFromMatrixColumn(src.frame, 1).normalize();
  const tUp = new THREE.Vector3().setFromMatrixColumn(tgt.frame, 1).normalize();
  const prevQ = new Map<THREE.Object3D, THREE.Quaternion>();
  const qW = new THREE.Quaternion();
  const qD = new THREE.Quaternion();
  const qL = new THREE.Quaternion();
  const parentJointOf = new Map<THREE.Object3D, THREE.Object3D | null>();
  for (const t of order) { let p = t.parent; while (p && !tgt.restLocal.has(p)) p = p.parent; parentJointOf.set(t, p); }
  for (const time of times) {
    poseRig(src, bound, time);
    for (const j of sourceJoints) {
      j.matrixWorld.decompose(_v1, qW, _v2);
      // D = C * (W(t) * W(rest)^-1) * C^T
      _q1.copy(qW).multiply(_q2.copy(src.restWorldQ.get(j)!).invert());
      conjugateRotation(C, Ct, _q1, deltas.get(j)!);
    }
    worldT.clear();
    for (const t of order) {
      const parentJoint = parentJointOf.get(t);
      const parentWorld = parentJoint ? worldT.get(parentJoint)! : tParentStatic.get(t)!;
      const d = plan.drivers.get(t);
      let world: THREE.Quaternion;
      if (d) {
        if (d.kind === 'joint') qD.copy(deltas.get(d.source)!);
        else chainDelta(d.chain, d.fraction, deltas, qD);
        world = qD.clone().multiply(align.get(t)!).multiply(tgt.restWorldQ.get(t)!);
        qL.copy(parentWorld).invert().multiply(world).normalize();
        const prev = prevQ.get(t);
        if (prev && prev.dot(qL) < 0) qL.set(-qL.x, -qL.y, -qL.z, -qL.w);
        prevQ.set(t, qL.clone());
        values.get(t)!.push(qL.x, qL.y, qL.z, qL.w);
      } else {
        world = parentWorld.clone().multiply(tgt.restLocal.get(t)!.q);
      }
      worldT.set(t, world);
    }
    if (options.rootMotion !== false) {
      sHips.matrixWorld.decompose(_v1, qW, _v2);
      const delta = _v1.clone().sub(src.restWorldP.get(sHips)!).applyMatrix4(C).multiplyScalar(scale);
      if (delta.lengthSq() > 1e-10) moved = true;
      const world = delta.add(tgt.restWorldP.get(tHips)!);
      if (groundLock) {
        // Pose the target with this frame's solution and compare foot lift.
        const k = values.get(drivenOrder[0]!)!.length / 4 - 1;
        for (const [j, r] of tgt.restLocal) { j.position.copy(r.p); j.quaternion.copy(r.q); j.scale.copy(r.s); }
        for (const t of drivenOrder) { const v = values.get(t)!; t.quaternion.set(v[k * 4], v[k * 4 + 1], v[k * 4 + 2], v[k * 4 + 3]); }
        tHips.position.copy(world).applyMatrix4(tHips.parent ? _m3.copy(tHips.parent.matrixWorld).invert() : _m3.identity());
        tgt.root.updateMatrixWorld(true);
        const ls = lowestFootLift(src, sUp);
        const lt = lowestFootLift(tgt, tUp);
        if (Number.isFinite(ls) && Number.isFinite(lt)) {
          const shift = (ls - lt) * tgt.legLength;
          if (Math.abs(shift) > 1e-6) { world.addScaledVector(tUp, shift); moved = true; }
        }
      }
      if (tHips.parent) hipsParentInv.copy(tHips.parent.matrixWorld).invert();
      else hipsParentInv.identity();
      world.applyMatrix4(hipsParentInv);
      hipsPos.push(world.x, world.y, world.z);
    }
  }
  restoreRest(src);
  restoreRest(tgt);

  const tracks: THREE.KeyframeTrack[] = [];
  const drivenJoints: string[] = [];
  for (const t of drivenOrder) {
    tracks.push(new THREE.QuaternionKeyframeTrack(`${t.name}.quaternion`, times, values.get(t)!));
    drivenJoints.push(t.name);
  }
  if (moved && hipsPos.length) tracks.push(new THREE.VectorKeyframeTrack(`${tHips.name}.position`, times, hipsPos));
  if (options.fillRest) {
    for (const t of order) {
      if (plan.drivers.has(t)) continue;
      const q = tgt.restLocal.get(t)!.q;
      tracks.push(new THREE.QuaternionKeyframeTrack(`${t.name}.quaternion`, [0, clip.duration], [q.x, q.y, q.z, q.w, q.x, q.y, q.z, q.w]));
    }
  }
  const out = new THREE.AnimationClip(clip.name, clip.duration, tracks);
  const srcUd = (clip as THREE.AnimationClip & { userData?: Record<string, unknown> }).userData ?? {};
  const testOnly = srcUd.clipSourceType === 'TEST_ONLY' || srcUd.testOnly === true || srcUd.procedural === true;
  (out as THREE.AnimationClip & { userData: Record<string, unknown> }).userData = {
    ...srcUd,
    universalRetarget: true,
    clipSourceType: testOnly ? 'TEST_ONLY' : 'RETARGETED_AUTHORED_CLIP',
    sourceRig: src.label,
    targetRig: tgt.label,
    legScale: scale,
    drivenJoints: drivenJoints.length,
    skippedOptional: plan.skippedOptional,
  };
  return { status: 'RETARGETED', clip: out, reasons: [], missingSource: [], missingTarget: [], drivenJoints, skippedOptional: plan.skippedOptional };
}

/**
 * Are two rigs the same skeleton for playback purposes? Same joint names and
 * rest local rotations within `toleranceDeg`. When true, a clip authored on
 * one plays on the other untouched, and the retargeter is not needed.
 */
export function rigsShareSkeleton(a: RetargetRig, b: RetargetRig, toleranceDeg = 2): boolean {
  const key = (n: string) => mixKey(sanitizeJointName(n));
  const bByKey = new Map<string, THREE.Object3D>();
  for (const j of b.joints) bByKey.set(key(j.name), j);
  const mapped = [...Object.values(a.map.slots), ...a.map.spine, ...a.map.neck].filter(Boolean) as string[];
  if (!mapped.length) return false;
  const tol = THREE.MathUtils.degToRad(toleranceDeg);
  for (const name of mapped) {
    const ja = a.byName.get(name);
    const jb = bByKey.get(key(name));
    if (!ja || !jb) return false;
    if (a.restLocal.get(ja)!.q.angleTo(b.restLocal.get(jb)!.q) > tol) return false;
  }
  return true;
}
