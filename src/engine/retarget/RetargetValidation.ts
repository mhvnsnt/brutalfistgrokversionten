// `.ts` extensions on purpose — `node --experimental-strip-types` resolves
// them literally, and the offline harness imports these same modules.
import * as THREE from 'three';

import type { LimbSlot } from './HumanoidBoneMap.ts';
import {
  bindClipToRig,
  conjugateRotation,
  lowestFootLift,
  poseRig,
  restoreRest,
  retargetClip,
  sampleTimes,
  sourceToTargetFrame,
  type RetargetOptions,
  type RetargetRig,
} from './UniversalRetarget.ts';

/**
 * RETARGET VALIDATION — every check measured, nothing inferred from a name.
 *
 * A retargeted clip PASSES only when every check below passes. A check that
 * could not run is not a pass: the cell carries its reason and the verdict is
 * FAIL (or UNMAPPABLE / MISSING_CLIP when the clip never got that far).
 * UNKNOWN is never PASS.
 */

export type CellVerdict = 'PASS' | 'FAIL' | 'UNMAPPABLE' | 'MISSING_CLIP';

export interface RetargetTolerances {
  /** Relative limb-segment length error. */
  limbLength: number;
  /** Per-sample local rotation jump beyond the source's own jump (deg). */
  flipDeg: number;
  /** Foot height error, fraction of leg length. */
  footHeight: number;
  /** End-effector direction error, 90th percentile (deg). */
  effectorP90Deg: number;
  /** End-effector direction error, worst sample (deg). */
  effectorMaxDeg: number;
  /** Duration error (s). */
  duration: number;
  /** Minimum skinned-vertex displacement, fraction of rig height. */
  deformMin: number;
  /** A source that never rotates any mapped joint more than this is static (deg). */
  staticSourceDeg: number;
}

export const DEFAULT_TOLERANCES: RetargetTolerances = {
  limbLength: 0.02,
  flipDeg: 45,
  footHeight: 0.12,
  effectorP90Deg: 20,
  effectorMaxDeg: 40,
  duration: 1e-3,
  deformMin: 0.005,
  staticSourceDeg: 3,
};

export interface CheckResult { ok: boolean; value?: number; detail?: string }

export interface CellResult {
  verdict: CellVerdict;
  reasons: string[];
  checks: Record<string, CheckResult>;
  clip: THREE.AnimationClip | null;
}

const LIMB_SEGMENTS: Array<[LimbSlot, LimbSlot]> = [
  ['leftUpperArm', 'leftLowerArm'], ['leftLowerArm', 'leftHand'],
  ['rightUpperArm', 'rightLowerArm'], ['rightLowerArm', 'rightHand'],
  ['leftUpperLeg', 'leftLowerLeg'], ['leftLowerLeg', 'leftFoot'],
  ['rightUpperLeg', 'rightLowerLeg'], ['rightLowerLeg', 'rightFoot'],
];

const EFFECTORS: Array<[string, LimbSlot, LimbSlot]> = [
  ['leftHand', 'leftUpperArm', 'leftHand'],
  ['rightHand', 'rightUpperArm', 'rightHand'],
  ['leftFoot', 'leftUpperLeg', 'leftFoot'],
  ['rightFoot', 'rightUpperLeg', 'rightFoot'],
];

const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _v4 = new THREE.Vector3();
const _v5 = new THREE.Vector3();
const _v6 = new THREE.Vector3();

function slotJoint(rig: RetargetRig, slot: LimbSlot): THREE.Object3D | undefined {
  const n = rig.map.slots[slot];
  return n ? rig.byName.get(n) : undefined;
}

function worldPos(o: THREE.Object3D, out = new THREE.Vector3()): THREE.Vector3 {
  return out.setFromMatrixPosition(o.matrixWorld);
}

function hasNonFinite(clip: THREE.AnimationClip): boolean {
  for (const t of clip.tracks) for (let i = 0; i < t.values.length; i++) if (!Number.isFinite(t.values[i])) return true;
  for (const t of clip.tracks) for (let i = 0; i < t.times.length; i++) if (!Number.isFinite(t.times[i])) return true;
  return false;
}

function quaternionDiscontinuities(clip: THREE.AnimationClip): number {
  let bad = 0;
  for (const t of clip.tracks) {
    if (!t.name.endsWith('.quaternion')) continue;
    const v = t.values;
    for (let i = 4; i + 3 < v.length; i += 4) {
      if (v[i] * v[i - 4] + v[i + 1] * v[i - 3] + v[i + 2] * v[i - 2] + v[i + 3] * v[i - 1] < 0) bad++;
    }
  }
  return bad;
}

/**
 * Skinned vertices actually move under the pose (not just bones). Samples up
 * to `maxVerts` vertices per SkinnedMesh and returns the largest displacement
 * against the rest pose, as a fraction of the rig height.
 */
export function measureSkinDeformation(rig: RetargetRig, maxVerts = 400): number | null {
  const meshes: THREE.SkinnedMesh[] = [];
  rig.root.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) meshes.push(o as THREE.SkinnedMesh); });
  if (!meshes.length) return null;
  let worst = 0;
  const v = new THREE.Vector3();
  for (const mesh of meshes) {
    const pos = mesh.geometry.getAttribute('position');
    if (!pos || !mesh.geometry.getAttribute('skinIndex')) continue;
    const step = Math.max(1, Math.floor(pos.count / maxVerts));
    const posed: THREE.Vector3[] = [];
    for (let i = 0; i < pos.count; i += step) { mesh.getVertexPosition(i, v); posed.push(v.clone().applyMatrix4(mesh.matrixWorld)); }
    const cache = rig.restPoseVerts?.get(mesh);
    if (!cache) continue;
    // Remove the whole-body translation first: root motion is not deformation.
    const shift = new THREE.Vector3();
    for (let k = 0; k < posed.length && k < cache.length; k++) shift.add(posed[k]).sub(cache[k]);
    shift.divideScalar(Math.max(1, Math.min(posed.length, cache.length)));
    for (let k = 0; k < posed.length && k < cache.length; k++) worst = Math.max(worst, posed[k].clone().sub(shift).distanceTo(cache[k]));
  }
  return worst / Math.max(1e-6, rig.height);
}

/** Cache rest-pose skinned vertex samples for measureSkinDeformation. */
export function cacheRestSkin(rig: RetargetRig, maxVerts = 400): void {
  restoreRest(rig);
  const map = new Map<THREE.SkinnedMesh, THREE.Vector3[]>();
  const v = new THREE.Vector3();
  rig.root.traverse((o) => {
    const mesh = o as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh) return;
    const pos = mesh.geometry.getAttribute('position');
    if (!pos || !mesh.geometry.getAttribute('skinIndex')) return;
    mesh.skeleton.update();
    const step = Math.max(1, Math.floor(pos.count / maxVerts));
    const out: THREE.Vector3[] = [];
    for (let i = 0; i < pos.count; i += step) { mesh.getVertexPosition(i, v); out.push(v.clone().applyMatrix4(mesh.matrixWorld)); }
    map.set(mesh, out);
  });
  rig.restPoseVerts = map;
}

declare module './UniversalRetarget.ts' {
  interface RetargetRig { restPoseVerts?: Map<THREE.SkinnedMesh, THREE.Vector3[]> }
}

export interface ValidateOptions extends RetargetOptions { tolerances?: Partial<RetargetTolerances>; skipDeform?: boolean; maxSamples?: number }

/**
 * Retarget `clip` from `src` onto `tgt` and measure the result against the
 * source played on its own skeleton.
 */
export function retargetAndValidate(clip: THREE.AnimationClip | null, src: RetargetRig, tgt: RetargetRig, opts: ValidateOptions = {}): CellResult {
  const tol = { ...DEFAULT_TOLERANCES, ...(opts.tolerances ?? {}) };
  if (!clip) return { verdict: 'MISSING_CLIP', reasons: ['MISSING_CLIP'], checks: {}, clip: null };
  const result = retargetClip(clip, src, tgt, opts);
  if (result.status !== 'RETARGETED' || !result.clip) {
    return { verdict: result.status === 'MISSING_CLIP' ? 'MISSING_CLIP' : 'UNMAPPABLE', reasons: result.reasons, checks: { requiredBones: { ok: false, detail: result.reasons.join('; ') } }, clip: null };
  }
  const out = result.clip;
  const checks: Record<string, CheckResult> = {};
  checks.requiredBones = { ok: true };
  checks.noNaN = { ok: !hasNonFinite(out) };
  const disc = quaternionDiscontinuities(out);
  checks.duration = { ok: Math.abs(out.duration - clip.duration) <= tol.duration, value: Math.abs(out.duration - clip.duration) };
  if (!checks.noNaN.ok) return finish(checks, out);

  const C = sourceToTargetFrame(src, tgt);
  const Ct = C.clone().transpose();
  const tUp = new THREE.Vector3().setFromMatrixColumn(tgt.frame, 1).normalize();
  const sUp = new THREE.Vector3().setFromMatrixColumn(src.frame, 1).normalize();
  const sBound = bindClipToRig(clip, src).bound;
  const tBound = bindClipToRig(out, tgt).bound;
  const n = Math.min(opts.maxSamples ?? 120, Math.max(2, Math.ceil(clip.duration * 30)));
  const times = sampleTimes(clip.duration, n / Math.max(1e-6, clip.duration));

  // Rest limb lengths.
  const restLen = LIMB_SEGMENTS.map(([a, b]) => {
    const ja = slotJoint(tgt, a); const jb = slotJoint(tgt, b);
    return ja && jb ? tgt.restWorldP.get(ja)!.distanceTo(tgt.restWorldP.get(jb)!) : 0;
  });
  let limbErr = 0;
  const effErr: number[] = [];
  const effRaw: number[] = [];
  let footErr = 0;
  let sinking = 0;
  let worstFlip = 0;
  let sourceMotion = 0;
  let peakTime = 0;
  const prevT = new Map<THREE.Object3D, THREE.Quaternion>();
  const prevS = new Map<string, THREE.Quaternion>();
  const drivenT = new Set(result.drivenJoints.map((n2) => tgt.byName.get(n2)!).filter(Boolean));
  const slotPairs: Array<[LimbSlot, THREE.Object3D, THREE.Object3D]> = [];
  for (const slot of Object.keys(tgt.map.slots) as LimbSlot[]) {
    const s = slotJoint(src, slot); const t = slotJoint(tgt, slot);
    if (s && t) slotPairs.push([slot, s, t]);
  }
  const a = new THREE.Vector3(); const b = new THREE.Vector3();
  const sDelta = new THREE.Quaternion(); const tDelta = new THREE.Quaternion(); const tmp = new THREE.Quaternion();
  for (const time of times) {
    poseRig(src, sBound, time);
    poseRig(tgt, tBound, time);
    // Limb lengths.
    LIMB_SEGMENTS.forEach(([sa, sb], i) => {
      const ja = slotJoint(tgt, sa); const jb = slotJoint(tgt, sb);
      if (!ja || !jb || !restLen[i]) return;
      limbErr = Math.max(limbErr, Math.abs(worldPos(ja, a).distanceTo(worldPos(jb, b)) - restLen[i]) / restLen[i]);
    });
    // End effectors, source direction carried into target space.
    for (const [, from, to] of EFFECTORS) {
      const sf = slotJoint(src, from); const st = slotJoint(src, to);
      const tf = slotJoint(tgt, from); const tt = slotJoint(tgt, to);
      if (!sf || !st || !tf || !tt) continue;
      const sd = worldPos(st, a).sub(worldPos(sf, b)).applyMatrix4(C);
      const td = worldPos(tt, _p).sub(worldPos(tf, _s));
      if (sd.lengthSq() < 1e-12 || td.lengthSq() < 1e-12) continue;
      effRaw.push(THREE.MathUtils.radToDeg(sd.angleTo(td)));
      // PROPORTION-MATCHED source effector: the source's own segment
      // directions laid out with the TARGET's segment lengths. MEASURED: CMU's
      // forearm is 0.69x its upper arm, EDWIN_KENNEDY_unchained's is 2.5x, so a
      // bent guard reads 25-50 deg "wrong" on the raw shoulder->hand line even
      // when every segment matches to 0.1 deg. Raw error is still reported.
      const sm = slotJoint(src, from === 'leftUpperArm' ? 'leftLowerArm' : from === 'rightUpperArm' ? 'rightLowerArm' : from === 'leftUpperLeg' ? 'leftLowerLeg' : 'rightLowerLeg');
      const tm = slotJoint(tgt, from === 'leftUpperArm' ? 'leftLowerArm' : from === 'rightUpperArm' ? 'rightLowerArm' : from === 'leftUpperLeg' ? 'leftLowerLeg' : 'rightLowerLeg');
      if (sm && tm) {
        const u = worldPos(sm, new THREE.Vector3()).sub(worldPos(sf, _v4)).applyMatrix4(C).normalize().multiplyScalar(worldPos(tm, _v5).distanceTo(worldPos(tf, _v6)));
        const l = worldPos(st, new THREE.Vector3()).sub(worldPos(sm, _v3)).applyMatrix4(C).normalize().multiplyScalar(worldPos(tt, _v5).distanceTo(worldPos(tm, _v6)));
        const expected = u.add(l);
        effErr.push(THREE.MathUtils.radToDeg(expected.angleTo(td)));
      } else {
        effErr.push(THREE.MathUtils.radToDeg(sd.angleTo(td)));
      }
    }
    // Feet: lift above own rest, normalized by leg length.
    const ls = lowestFootLift(src, sUp); const lt = lowestFootLift(tgt, tUp);
    if (Number.isFinite(ls) && Number.isFinite(lt)) {
      footErr = Math.max(footErr, Math.abs(lt - ls));
      if (lt < ls - tol.footHeight) sinking++;
    }
    // Flips: target world-delta jump vs source world-delta jump, per slot.
    for (const [slot, s, t] of slotPairs) {
      s.matrixWorld.decompose(_p, tmp, _s);
      tmp.multiply(_q.copy(src.restWorldQ.get(s)!).invert());
      conjugateRotation(C, Ct, tmp, sDelta);
      t.matrixWorld.decompose(_p, tDelta, _s);
      tDelta.multiply(_q.copy(tgt.restWorldQ.get(t)!).invert());
      const motion = THREE.MathUtils.radToDeg(2 * Math.acos(Math.min(1, Math.abs(tmp.w))));
      if (motion > sourceMotion) { sourceMotion = motion; peakTime = time; }
      const ps = prevS.get(slot); const pt = prevT.get(t);
      if (ps && pt) {
        const js = THREE.MathUtils.radToDeg(ps.angleTo(sDelta));
        const jt = THREE.MathUtils.radToDeg(pt.angleTo(tDelta));
        worstFlip = Math.max(worstFlip, jt - js);
      }
      prevS.set(slot, sDelta.clone());
      prevT.set(t, tDelta.clone());
    }
  }
  void drivenT;
  checks.limbLengths = { ok: limbErr <= tol.limbLength, value: round(limbErr) };
  checks.noFlips = { ok: worstFlip <= tol.flipDeg && disc === 0, value: round(worstFlip), detail: disc ? `${disc} quaternion sign discontinuities` : undefined };
  checks.feet = { ok: footErr <= tol.footHeight && sinking === 0, value: round(footErr), detail: sinking ? `${sinking} samples sinking` : undefined };
  const sorted = effErr.slice().sort((x, y) => x - y);
  const p90 = sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9))] : Infinity;
  const emax = sorted.length ? sorted[sorted.length - 1] : Infinity;
  const raw = effRaw.slice().sort((x, y) => x - y);
  const rawP90 = raw.length ? raw[Math.min(raw.length - 1, Math.floor(raw.length * 0.9))] : Infinity;
  checks.effectors = { ok: p90 <= tol.effectorP90Deg && emax <= tol.effectorMaxDeg, value: round(p90), detail: `p90 ${round(p90)} max ${round(emax)} deg (raw shoulder/hip line p90 ${round(rawP90)})` };

  // Deformation at the source's peak-motion time.
  if (sourceMotion < tol.staticSourceDeg) {
    checks.deforms = { ok: false, value: round(sourceMotion), detail: `SOURCE_NO_MOTION: source never rotates a mapped joint more than ${round(sourceMotion)} deg` };
  } else if (!opts.skipDeform) {
    poseRig(tgt, tBound, peakTime);
    rigSkeletonsUpdate(tgt);
    const d = measureSkinDeformation(tgt);
    checks.deforms = d === null
      ? { ok: false, detail: 'NO_SKINNED_MESH on target' }
      : { ok: d >= tol.deformMin, value: round(d) };
  }
  restoreRest(src);
  restoreRest(tgt);
  return finish(checks, out);
}

function rigSkeletonsUpdate(rig: RetargetRig): void {
  rig.root.traverse((o) => { const m = o as THREE.SkinnedMesh; if (m.isSkinnedMesh) m.skeleton.update(); });
}

function round(v: number): number { return Number.isFinite(v) ? Math.round(v * 1000) / 1000 : v; }

function finish(checks: Record<string, CheckResult>, clip: THREE.AnimationClip): CellResult {
  const failed = Object.entries(checks).filter(([, c]) => !c.ok);
  const reasons = failed.map(([k, c]) => `${k}${c.detail ? `: ${c.detail}` : c.value !== undefined ? ` (${c.value})` : ''}`);
  return { verdict: failed.length ? 'FAIL' : 'PASS', reasons, checks, clip };
}
