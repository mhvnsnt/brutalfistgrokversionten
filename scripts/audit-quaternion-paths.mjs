#!/usr/bin/env node
/**
 * DO ANY BONES TAKE THE LONG WAY ROUND BETWEEN KEYFRAMES?
 *
 * Owner: "get all fixed and bugs with model stretching tearing and ugly
 * unblended animations or incorrectly and buggy coded animations fixed."
 *
 * A quaternion and its negation describe the SAME orientation, so a keyframe
 * pair whose dot product is negative is two ways of writing the same thing —
 * but an interpolator reading them literally sweeps the bone almost all the way
 * around instead of taking the short arc. On screen that is a limb that whips
 * through the body and snaps back at the next key: exactly "tearing" and
 * "animations doing the wrong thing with some body parts".
 *
 * three.js's own QuaternionLinearInterpolant corrects the sign as it goes, so
 * this is not automatically a defect — which is why it is MEASURED here rather
 * than assumed. What matters is how many flips there are and whether anything
 * in our pipeline consumes the raw values without correcting them.
 *
 * Usage: node scripts/audit-quaternion-paths.mjs [--json]
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const BAKED = 'public/motion/baked';
const files = readdirSync(BAKED).filter((f) => f.endsWith('.json') && f !== 'index.json');

let totalPairs = 0;
let totalFlips = 0;
const perClip = [];

for (const file of files) {
  let data;
  try { data = JSON.parse(readFileSync(join(BAKED, file), 'utf8')); } catch { continue; }
  let pairs = 0;
  let flips = 0;
  const bones = [];
  for (const [bone, track] of Object.entries(data.tracks ?? {})) {
    const q = track?.q;
    if (!Array.isArray(q) || q.length < 8) continue;
    let boneFlips = 0;
    for (let i = 0; i + 7 < q.length; i += 4) {
      const dot = q[i] * q[i + 4] + q[i + 1] * q[i + 5] + q[i + 2] * q[i + 6] + q[i + 3] * q[i + 7];
      pairs++;
      if (dot < 0) { flips++; boneFlips++; }
    }
    if (boneFlips) bones.push([bone, boneFlips]);
  }
  totalPairs += pairs;
  totalFlips += flips;
  if (flips) {
    bones.sort((a, b) => b[1] - a[1]);
    perClip.push({ clip: data.name ?? file.replace('.json', ''), flips, pairs, worst: bones.slice(0, 3) });
  }
}

perClip.sort((a, b) => b.flips - a.flips);
if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ totalPairs, totalFlips, perClip }, null, 2));
} else {
  console.log('\nQUATERNION PATHS — keyframe pairs written on opposite hemispheres\n');
  console.log(`  clips: ${files.length}   keyframe pairs: ${totalPairs}   sign flips: ${totalFlips}`
    + `  (${(100 * totalFlips / Math.max(1, totalPairs)).toFixed(2)}%)`);
  console.log(`  clips containing at least one: ${perClip.length}\n`);
  for (const c of perClip.slice(0, 10)) {
    console.log(`    ${c.clip.padEnd(30).slice(0, 30)} ${String(c.flips).padStart(5)} of ${String(c.pairs).padStart(5)}`
      + `   worst: ${c.worst.map(([b, n]) => `${b.replace('mixamorig', '')} x${n}`).join(', ')}`);
  }
  console.log(`\n  ${totalFlips === 0
    ? 'Every bone takes the short arc between its keys.'
    : 'Any consumer that interpolates these WITHOUT correcting the sign sweeps the bone the long way.'}`);
}
