#!/usr/bin/env node
/**
 * IS THE SOURCE'S LEG STANCE BEING THROWN AWAY AT BAKE TIME?
 *
 * The retarget composes q(t) = q_bind x q_src(0)^-1 x q_src(t), so — as
 * RestPoseOffset.ts states plainly — "frame 0 is always exactly the character's
 * bind". Whatever pose the animator authored at frame 0 is subtracted out and
 * replaced by the rig's own bind.
 *
 * For the ARMS that is corrected: q_bind is pre-multiplied by a per-model
 * correction that lifts the arm to the horizontal the Mixamo source assumes.
 * For the LEGS nothing is corrected, on the stated grounds that "legs, spine and
 * head rest identically" in an A-pose and a T-pose. That is true of A-vs-T. It is
 * NOT the mismatch that matters here: the question is bind versus the FIGHTING
 * STANCE the source clip was authored from. A bind has the legs straight and the
 * feet together; no fighting game stands like that.
 *
 * So the measure is direct: the angle between the SOURCE clip's frame-0 thigh
 * local rotation and the TARGET rig's bind thigh local rotation. Same bone name,
 * same Mixamo convention, both local — apples to apples.
 *
 *   small  ->  the source rests near bind, and forcing frame 0 to bind costs
 *              nothing. The 81-degree median is real leg motion, not an offset.
 *   large  ->  every clip's legs start from a pose the animator never authored,
 *              and travel from there.
 *
 * Usage: node tools/model_diag/source_stance.mjs [model.glb]
 */
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { parseGlb } from './bind_pose.mjs';

const MODEL = process.argv[2]?.endsWith('.glb') ? process.argv[2] : 'public/models/TITAN.glb';
const JOINTS = [
  'mixamorigLeftUpLeg', 'mixamorigRightUpLeg',
  'mixamorigLeftLeg', 'mixamorigRightLeg',
  'mixamorigHips', 'mixamorigSpine',
  'mixamorigLeftArm', 'mixamorigRightArm',
];

const { json } = parseGlb(readFileSync(MODEL));
const bind = new Map();
for (const n of json.skins[0].joints) {
  const node = json.nodes[n];
  bind.set((node.name ?? '').replace(':', ''), node.rotation ?? [0, 0, 0, 1]);
}

/** The source bank stores XYZ Euler radians per bone per key (see BannonMotionBank). */
function sourceQuat(rot) {
  return new THREE.Quaternion().setFromEuler(
    new THREE.Euler(rot.rx ?? 0, rot.ry ?? 0, rot.rz ?? 0, 'XYZ'),
  );
}
const angleDeg = (a, b) => THREE.MathUtils.radToDeg(2 * Math.acos(Math.min(1, Math.abs(a.dot(b)))));

/** Pull `"NAME":{"dur":..,"keys":[{...}]}` entries out of the generated bank. */
function readBank(file) {
  const text = readFileSync(file, 'utf8');
  const start = text.indexOf('{', text.indexOf('BANNON_MOTION_BANK:') >= 0
    ? text.indexOf('BANNON_MOTION_BANK:')
    : text.lastIndexOf('= {'));
  const out = [];
  const re = /"([A-Za-z0-9_.\-]+)":\{"dur":[\d.]+,"keys":\[\{"t":0,"bones":(\{.*?\})\}[,\]]/g;
  let m;
  while ((m = re.exec(text.slice(start))) !== null) {
    try { out.push({ name: m[1], bones: JSON.parse(m[2]) }); } catch { /* keep going */ }
  }
  return out;
}

const clips = readBank('src/generated/BannonMotionBank.generated.ts');
if (!clips.length) {
  console.error('  NO CLIPS PARSED — that is a tool failure, not a pass.');
  process.exitCode = 1;
} else {
  const per = new Map(JOINTS.map((j) => [j, []]));
  for (const clip of clips) {
    for (const j of JOINTS) {
      const src = clip.bones[j];
      const b = bind.get(j);
      if (!src || !b) continue;
      per.get(j).push(angleDeg(sourceQuat(src), new THREE.Quaternion(b[0], b[1], b[2], b[3])));
    }
  }
  const q = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length * p)] ?? 0; };
  console.log(`\nHOW FAR IS THE SOURCE'S FRAME 0 FROM THE RIG'S BIND?  (${clips.length} source clips, ${MODEL.split('/').pop()})\n`);
  console.log('  joint                      p05   median    p95     over 30deg');
  for (const j of JOINTS) {
    const xs = per.get(j);
    if (!xs.length) { console.log(`  ${j.replace('mixamorig', '').padEnd(24)} no data`); continue; }
    const over = xs.filter((v) => v > 30).length;
    console.log(`  ${j.replace('mixamorig', '').padEnd(24)} ${q(xs, 0.05).toFixed(0).padStart(4)}  ${q(xs, 0.5).toFixed(0).padStart(5)}  ${q(xs, 0.95).toFixed(0).padStart(5)}    ${String(over).padStart(4)} of ${xs.length}`);
  }
  console.log('\n  The ARM rows are the control: that mismatch is real and is already corrected');
  console.log('  per model by RestPoseOffset. The leg rows are the question.');
}
