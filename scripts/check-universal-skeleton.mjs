#!/usr/bin/env node
/**
 * ONE SKELETON. Every fighter must be rigged to it.
 *
 * Tekken and Schwarzerblitz do not retarget: they have a single skeleton and
 * every animation is authored on it. That is the architecture, and MEASURED,
 * we already almost have it — 59 of the 65 skinned models in public/models
 * share a bit-identical 58-joint bind (max per-joint difference under one
 * degree, no missing joints).
 *
 * What we did not have was a gate, so the six that DON'T match were quietly
 * adapted at runtime instead of being fixed at the asset. A model that is not
 * on this skeleton cannot play a baked clip correctly, and no amount of
 * runtime cleverness changes that — it gets re-rigged offline
 * (tools/model_diag/transfer_weights.cjs, the same tool that fixed CODY_gear
 * and TARZANIAN_DEVIL) or it does not ship as a fighter.
 *
 * Usage:
 *   node scripts/check-universal-skeleton.mjs            report
 *   node scripts/check-universal-skeleton.mjs --gate     exit 1 on a new offender
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseGlb } from '../tools/model_diag/bind_pose.mjs';

const DIR = 'public/models';
const REFERENCE = 'BANNON_rigged.glb';
const TOLERANCE_DEG = 1;

/**
 * Known off-skeleton models, with why each is allowed for now. A fighter on
 * this list is a re-rig that has not happened yet, NOT an accepted exception.
 */
const KNOWN = {
  'xbot.glb': 'the Mixamo T-pose reference, not a fighter — it is what MIXAMO_REST_POSE is read from',
  'wrestler_base.glb': 'a 284-vertex proxy, not a fighter',
  'EDWIN_KENNEDY_unchained.glb': 'RE-RIG NEEDED — 46 joints, no finger chain',
  'CIPHER_rigged.glb': 'RE-RIG NEEDED — 52 joints, neck 33.6deg off the skeleton',
  'MAIME_skinned.glb': 'RE-RIG NEEDED — 22 joints, thigh 168.7deg off the skeleton',
  'MAIME_tattered_skinned.glb': 'RE-RIG NEEDED — 22 joints, thigh 168.7deg off the skeleton',
};

const key = (n) => n.replace(/^mixamorig[:._-]*/i, 'mixamorig');

/** Angle between two quaternions, degrees. |dot| because q and -q are the same rotation. */
function angleDeg(a, b) {
  const dot = Math.min(1, Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]));
  return (2 * Math.acos(dot) * 180) / Math.PI;
}

function bindOf(file) {
  const { json } = parseGlb(readFileSync(join(DIR, file)));
  if (!json.skins?.length) return null;
  const out = new Map();
  for (const j of json.skins[0].joints) {
    const n = json.nodes[j]?.name;
    if (n && !out.has(key(n))) out.set(key(n), json.nodes[j].rotation ?? [0, 0, 0, 1]);
  }
  return out;
}

const gate = process.argv.includes('--gate');
const ref = bindOf(REFERENCE);
if (!ref) {
  console.error(`REFUSED: ${REFERENCE} has no skin — the reference skeleton is missing.`);
  process.exit(1);
}

const offenders = [];
let onSkeleton = 0;
let unskinned = 0;
for (const file of readdirSync(DIR).filter((f) => f.endsWith('.glb')).sort()) {
  const bind = bindOf(file);
  if (!bind) { unskinned++; continue; }
  let worstDeg = 0;
  let worstBone = '';
  let missing = 0;
  for (const [bone, q] of ref) {
    const other = bind.get(bone);
    if (!other) { missing++; continue; }
    const d = angleDeg(q, other);
    if (d > worstDeg) { worstDeg = d; worstBone = bone; }
  }
  if (worstDeg < TOLERANCE_DEG && missing === 0) { onSkeleton++; continue; }
  offenders.push({ file, joints: bind.size, worstDeg, worstBone, missing });
}

console.log(`ONE SKELETON: ${REFERENCE}, ${ref.size} joints`);
console.log(`  on skeleton : ${onSkeleton}`);
console.log(`  unskinned   : ${unskinned}`);
console.log(`  off skeleton: ${offenders.length}`);
let unexpected = 0;
for (const o of offenders) {
  const why = KNOWN[o.file];
  if (!why) unexpected++;
  console.log(
    `  ${why ? '•' : '✗ NEW'} ${o.file.padEnd(32)} ${String(o.joints).padStart(3)} joints` +
    `  worst ${o.worstDeg.toFixed(1)}deg${o.worstBone ? ' on ' + o.worstBone.replace('mixamorig', '') : ''}` +
    `  missing ${o.missing}` + (why ? `\n      ${why}` : ''),
  );
}
const stale = Object.keys(KNOWN).filter((f) => !offenders.some((o) => o.file === f));
for (const f of stale) console.log(`  (KNOWN entry no longer needed: ${f})`);

if (gate && unexpected > 0) {
  console.error(`\nFAILED: ${unexpected} model(s) off the skeleton and not listed. Re-rig them or say why in KNOWN.`);
  process.exit(1);
}
