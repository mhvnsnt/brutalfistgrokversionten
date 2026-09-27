#!/usr/bin/env node
/**
 * HOW FAR FROM THE FIGHTING STANCE DOES EVERY CLIP START ITS LEGS?
 *
 * The retarget composes q(t) = q_bind x q_src(0)^-1 x q_src(t), so frame 0 of
 * every baked clip IS the rig's bind pose. That is not a measurement, it is
 * algebra — q(0) = q_bind exactly. The question worth measuring is whether that
 * COSTS anything, and the answer is the angle between the bind and the stance the
 * game actually stands in.
 *
 * A PREVIOUS ATTEMPT AT THIS WAS CONFOUNDED AND IS WORTH RECORDING. Comparing the
 * SOURCE clip's frame-0 thigh LOCAL rotation against the target rig's bind local
 * rotation gave a median 161-168 degrees on every one of 200 clips, which looks
 * damning next to the arms' already-corrected 47-68. It is not comparable: two
 * rigs can point a thigh in the same WORLD direction while their local rotations
 * differ by 180, because their bone rest axes differ — rest_offset.mjs says as
 * much about the Mixamo thigh's ~180-degree bind. Local rotations across two
 * skeletons are not apples to apples.
 *
 * So everything here is measured in WORLD space ON ONE RIG, where directions are
 * directly comparable and no convention can creep in: the hip-to-knee and
 * knee-to-ankle directions under full forward kinematics.
 *
 * Usage: node tools/model_diag/stance_gap.mjs [model.glb] [--stance IDLE]
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { parseGlb } from './bind_pose.mjs';

const MODEL = process.argv[2]?.endsWith('.glb') ? process.argv[2] : 'public/models/TITAN.glb';
const si = process.argv.indexOf('--stance');
const STANCE = si > 0 ? process.argv[si + 1] : 'IDLE';
const BAKED = 'public/motion/baked';

const CHAINS = [
  ['mixamorigLeftUpLeg', 'mixamorigLeftLeg', 'left thigh'],
  ['mixamorigRightUpLeg', 'mixamorigRightLeg', 'right thigh'],
  ['mixamorigLeftLeg', 'mixamorigLeftFoot', 'left shin'],
  ['mixamorigRightLeg', 'mixamorigRightFoot', 'right shin'],
  ['mixamorigSpine', 'mixamorigSpine2', 'spine'],
  ['mixamorigLeftArm', 'mixamorigLeftForeArm', 'left upper arm'],
];

/** Build the rig: bind world matrices, parents, and bind LOCAL transforms. */
function rig(file) {
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
  // Local bind TRS straight off the nodes — the authored hierarchy, no inversion.
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
  const indexOfName = new Map(names.map((n, i) => [n, i]));
  return { names, parentOf, localBind, localT, localS, indexOfName };
}

/** World matrices for a pose: per-bone quaternion override, bind elsewhere. */
function world(r, quatFor) {
  const out = new Array(r.names.length);
  for (let i = 0; i < r.names.length; i++) {
    const q = quatFor(r.names[i]);
    const local = q
      ? new THREE.Matrix4().compose(r.localT[i], q, r.localS[i])
      : r.localBind[i];
    out[i] = r.parentOf[i] < 0 ? local.clone() : out[r.parentOf[i]].clone().multiply(local);
  }
  return out;
}
const posOf = (m) => new THREE.Vector3().setFromMatrixPosition(m);
const dirBetween = (w, r, a, b) => {
  const ia = r.indexOfName.get(a), ib = r.indexOfName.get(b);
  if (ia === undefined || ib === undefined) return null;
  const d = posOf(w[ib]).sub(posOf(w[ia]));
  return d.lengthSq() > 1e-9 ? d.normalize() : null;
};
const angleDeg = (a, b) => THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1)));

/** A clip's quaternion at a given key index, as a lookup by bone name. */
function poseAt(clip, k) {
  return (bone) => {
    const t = clip.tracks?.[bone];
    if (!t?.q || t.q.length < (k + 1) * 4) return null;
    return new THREE.Quaternion(t.q[k * 4], t.q[k * 4 + 1], t.q[k * 4 + 2], t.q[k * 4 + 3]);
  };
}

const r = rig(MODEL);
const stance = JSON.parse(readFileSync(join(BAKED, `${STANCE}.json`), 'utf8'));
const stanceKeys = (stance.tracks?.mixamorigHips?.q?.length ?? 0) / 4;
const wBind = world(r, () => null);
const wStance = world(r, poseAt(stance, Math.floor(stanceKeys / 2)));

console.log(`\nBIND VERSUS THE FIGHTING STANCE — world limb directions on ${MODEL.split('/').pop()}\n`);
console.log(`  stance clip: ${STANCE}, middle key of ${stanceKeys}\n`);
let worstLeg = 0;
for (const [a, b, label] of CHAINS) {
  const dB = dirBetween(wBind, r, a, b);
  const dS = dirBetween(wStance, r, a, b);
  if (!dB || !dS) { console.log(`  ${label.padEnd(16)} not on this rig`); continue; }
  const gap = angleDeg(dB, dS);
  if (/thigh|shin/.test(label)) worstLeg = Math.max(worstLeg, gap);
  console.log(`  ${label.padEnd(16)} ${gap.toFixed(1).padStart(6)} deg from bind`);
}

// Named clips: where do their legs actually sit, in world space, against the
// stance? This is the check that settles whether the 81-degree bind-relative
// median is a defect or just a poor proxy.
const NAMED = process.argv.includes('--all') ? null : [
  'TPOSE', 'IDLE', 'BOX_IDLE', 'GRAFQUICKJAB', 'GRAFSTANCE', 'QUICKKICK', 'UPPERCUT',
  'HEAVYKICK', 'ALTERNATINGFOREARMS', 'HURRICANE_KICK', 'CHOKESLAM', 'SUPINE',
];
const rows = [];
for (const f of readdirSync(BAKED)) {
  if (!f.endsWith('.json') || f === 'index.json') continue;
  let clip;
  try { clip = JSON.parse(readFileSync(join(BAKED, f), 'utf8')); } catch { continue; }
  const name = clip.name ?? f.replace('.json', '');
  if (NAMED && !NAMED.includes(name)) continue;
  const keys = (clip.tracks?.mixamorigLeftUpLeg?.q?.length ?? 0) / 4;
  if (keys < 1) continue;
  // The clip's own MEDIAN leg placement, not just its first frame — a clip that
  // passes through the stance is doing nothing wrong.
  const gaps = [];
  for (let k = 0; k < keys; k += Math.max(1, Math.floor(keys / 12))) {
    const w = world(r, poseAt(clip, k));
    const d = dirBetween(w, r, 'mixamorigLeftUpLeg', 'mixamorigLeftLeg');
    const dS = dirBetween(wStance, r, 'mixamorigLeftUpLeg', 'mixamorigLeftLeg');
    if (d && dS) gaps.push(angleDeg(d, dS));
  }
  if (!gaps.length) continue;
  gaps.sort((a, b) => a - b);
  rows.push({ name, first: gaps[0], med: gaps[Math.floor(gaps.length / 2)], max: gaps[gaps.length - 1] });
}
if (NAMED) {
  console.log('\n  LEFT THIGH AGAINST THE STANCE, in world space');
  console.log('  clip                      closest   median      max');
  for (const n of NAMED) {
    const x = rows.find((y) => y.name === n);
    if (!x) continue;
    console.log(`  ${n.padEnd(24)} ${x.first.toFixed(0).padStart(6)}   ${x.med.toFixed(0).padStart(6)}   ${x.max.toFixed(0).padStart(6)} deg`);
  }
} else {
  const meds = rows.map((x) => x.med).sort((a, b) => a - b);
  const p = (q2) => meds[Math.floor(meds.length * q2)] ?? 0;
  console.log(`\n  ${rows.length} clips, median leg placement against the stance:`);
  console.log(`    p05 ${p(0.05).toFixed(0)}  median ${p(0.5).toFixed(0)}  p95 ${p(0.95).toFixed(0)} deg`);
  console.log(`    clips whose legs never come within 25 deg of the stance: ${rows.filter((x) => x.first > 25).length}`);
}
