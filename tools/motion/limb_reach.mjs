#!/usr/bin/env node
/**
 * ELBOW AND KNEE EXTENSION — AND WHY IT IS NOT YET A STRIKE TEST.
 *
 * THE PROBLEM IS REAL. The bake measures `handReach` and `footReach` only, so
 * the attack pool asks "does a HAND or a FOOT go forward". An elbow strike does
 * not extend the hand and a knee does not extend the foot — being short is the
 * whole point of both. So every elbow and every knee in the bank is invisible to
 * the picker, and 69 clips are refused for "reach too short".
 *
 * THIS TOOL DOES NOT SOLVE IT YET, AND THAT IS WRITTEN DOWN SO THE NEXT PASS
 * DOES NOT REPEAT THE TWO DEAD ENDS:
 *
 *   ATTEMPT 1, joint past its own PARENT. That is just the upper arm's length
 *   projected forward, and it saturates the moment the arm points anywhere
 *   forward: elbow p50 0.209, max 0.234 across 409 clips — no spread at all,
 *   and the top-ranked clips were a T-pose, a rope climb and breakdancing.
 *
 *   ATTEMPT 2 (what it does now), joint forward of the HIPS as a change from
 *   the clip's own first frame. Real spread this time — elbow p50 0.158, p90
 *   0.415, max 0.933 — but the top hits are ZONE_ROLL_OUT, FALLING_FLAT_IMPACT,
 *   slides, KIP_UP and a throw victim. It measures "the joint travelled a long
 *   way relative to the hips", which a roll or a tuck does as much as a strike.
 *
 * WHAT IS MISSING is direction AND timing: a strike drives the joint forward
 * FAST and then RETRACTS, while a roll displaces it slowly as part of a posture
 * change. Peak forward velocity with the body's own translation removed, plus a
 * retraction test, is the measure to build. Until then this is NOT wired into
 * the attack gates — a number that cannot separate a knee strike from a kip-up
 * has no business deciding what is a move.
 *
 *   node tools/motion/limb_reach.mjs [model.glb] [--write]
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { parseGlb } from '../model_diag/bind_pose.mjs';

const MODEL = process.argv[2]?.endsWith('.glb') ? process.argv[2] : 'public/models/TITAN.glb';
const BAKED = 'public/motion/baked';
const OUT = 'public/motion/limb_reach.json';
const HIPS = 'mixamorigHips';
const PAIRS = [
  ['elbow', 'mixamorigLeftForeArm'],
  ['elbow', 'mixamorigRightForeArm'],
  ['knee', 'mixamorigLeftLeg'],
  ['knee', 'mixamorigRightLeg'],
];

function rig(file) {
  const { json } = parseGlb(readFileSync(file));
  const skin = json.skins[0];
  const names = skin.joints.map((n) => (json.nodes[n]?.name ?? '').replace(':', ''));
  const parentNode = new Map();
  json.nodes.forEach((n, i) => (n.children ?? []).forEach((c) => parentNode.set(c, i)));
  const idx = new Map(); skin.joints.forEach((n, i) => idx.set(n, i));
  const parentOf = skin.joints.map((n) => { const p = parentNode.get(n); return p !== undefined && idx.has(p) ? idx.get(p) : -1; });
  const localBind = skin.joints.map((n) => {
    const node = json.nodes[n];
    return new THREE.Matrix4().compose(
      new THREE.Vector3().fromArray(node.translation ?? [0, 0, 0]),
      new THREE.Quaternion().fromArray(node.rotation ?? [0, 0, 0, 1]),
      new THREE.Vector3().fromArray(node.scale ?? [1, 1, 1]));
  });
  const localT = skin.joints.map((n) => new THREE.Vector3().fromArray(json.nodes[n].translation ?? [0, 0, 0]));
  const localS = skin.joints.map((n) => new THREE.Vector3().fromArray(json.nodes[n].scale ?? [1, 1, 1]));
  return { names, parentOf, localBind, localT, localS, indexOfName: new Map(names.map((n, i) => [n, i])) };
}
const worldAt = (r, quatFor) => {
  const out = new Array(r.names.length);
  for (let i = 0; i < r.names.length; i++) {
    const q = quatFor(r.names[i]);
    const local = q ? new THREE.Matrix4().compose(r.localT[i], q, r.localS[i]) : r.localBind[i];
    out[i] = r.parentOf[i] < 0 ? local.clone() : out[r.parentOf[i]].clone().multiply(local);
  }
  return out;
};
const poseAt = (clip, k) => (bone) => {
  const t = clip.tracks?.[bone];
  if (!t?.q || t.q.length < (k + 1) * 4) return null;
  return new THREE.Quaternion(t.q[k * 4], t.q[k * 4 + 1], t.q[k * 4 + 2], t.q[k * 4 + 3]);
};
const posOf = (w, r, n) => { const i = r.indexOfName.get(n); return i === undefined ? null : new THREE.Vector3().setFromMatrixPosition(w[i]); };

/** Peak forward extension of an elbow or knee past its own parent joint. */
export function limbReachOf(r, clip) {
  const names = Object.keys(clip.tracks ?? {});
  if (!names.length) return null;
  const keys = Math.max(...names.map((n) => (clip.tracks[n].q?.length ?? 0) / 4), 0);
  if (keys < 2) return null;
  const hi = r.indexOfName.get(HIPS);
  if (hi === undefined) return null;
  let elbow = -9, knee = -9, elbowFace = 0, kneeFace = 0;
  const base = new Map();
  for (let k = 0; k < keys; k++) {
    const w = worldAt(r, poseAt(clip, k));
    const m = w[hi];
    const fwd = new THREE.Vector3(m.elements[8], 0, m.elements[10]);
    if (fwd.lengthSq() < 1e-8) continue;
    fwd.normalize();
    // FORWARD OF THE HIPS, AS A CHANGE FROM THE CLIP'S OWN REST.
    //
    // The first version measured the joint past its own PARENT, which is just
    // the upper arm's length projected forward — it saturates the moment the arm
    // points anywhere forward, so a T-pose and a rope climb scored as high as a
    // strike (elbow p50 0.209, max 0.234, no spread at all). A strike is the
    // joint DRIVEN OUT past where the body normally carries it, so the baseline
    // is this clip's own first frame and the reference is the HIPS.
    const hips = posOf(w, r, HIPS);
    if (!hips) continue;
    for (const [kind, joint] of PAIRS) {
      const a = posOf(w, r, joint);
      if (!a) continue;
      const ext = new THREE.Vector3().subVectors(a, hips).dot(fwd);
      const key = `${kind}:${joint}`;
      if (k === 0) { base.set(key, ext); continue; }
      const drive = ext - (base.get(key) ?? ext);
      if (kind === 'elbow' && drive > elbow) { elbow = drive; elbowFace = fwd.z; }
      if (kind === 'knee' && drive > knee) { knee = drive; kneeFace = fwd.z; }
    }
  }
  if (elbow < -8 && knee < -8) return null;
  return { elbow: +elbow.toFixed(4), knee: +knee.toFixed(4), elbowFace: +elbowFace.toFixed(3), kneeFace: +kneeFace.toFixed(3) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = rig(MODEL);
  const rows = {};
  for (const f of readdirSync(BAKED)) {
    if (!f.endsWith('.json') || f === 'index.json') continue;
    let clip; try { clip = JSON.parse(readFileSync(join(BAKED, f), 'utf8')); } catch { continue; }
    const v = limbReachOf(r, clip);
    if (v) rows[f.replace('.json', '')] = v;
  }
  const es = Object.values(rows).map((v) => v.elbow).sort((a, b) => a - b);
  const ks = Object.values(rows).map((v) => v.knee).sort((a, b) => a - b);
  const q = (arr, p) => arr[Math.floor(arr.length * p)] ?? 0;
  console.log(`\nELBOW AND KNEE REACH — ${MODEL.split('/').pop()}, ${Object.keys(rows).length} clips\n`);
  console.log(`  elbow   p50 ${q(es, 0.5).toFixed(3)}  p90 ${q(es, 0.9).toFixed(3)}  max ${es[es.length - 1].toFixed(3)}`);
  console.log(`  knee    p50 ${q(ks, 0.5).toFixed(3)}  p90 ${q(ks, 0.9).toFixed(3)}  max ${ks[ks.length - 1].toFixed(3)}`);
  const top = Object.entries(rows).sort((a, b) => Math.max(b[1].elbow, b[1].knee) - Math.max(a[1].elbow, a[1].knee)).slice(0, 12);
  console.log('\n  furthest-extending elbow/knee clips:');
  for (const [n, v] of top) console.log(`    ${n.padEnd(30)} elbow ${String(v.elbow).padStart(7)}  knee ${String(v.knee).padStart(7)}`);
  if (process.argv.includes('--write')) {
    writeFileSync(OUT, `${JSON.stringify({ generatedBy: 'tools/motion/limb_reach.mjs', model: MODEL, what: 'peak forward extension of each elbow and knee past its own parent joint, by FK in the body facing frame', clips: rows }, null, 0)}\n`);
    console.log(`\n  wrote ${OUT}`);
  }
}
