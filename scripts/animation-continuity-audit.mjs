#!/usr/bin/env node
/**
 * ANIMATION CONTINUITY AUDIT — find keyframe pairs no body could perform.
 *
 * WHY IT EXISTS: "twisted bodies" is a real reported symptom, and the cheap way
 * to look for it is to ask whether any bone rotates faster than a human limb can
 * between two adjacent keys.
 *
 * TWO MEASUREMENTS THAT LOOK THE SAME AND ARE NOT. Both were run; only the
 * second one means anything, and this is written down so nobody repeats the first.
 *
 *   1. EULER DELTA. 253 of 367 clips have a Euler component that jumps ~2pi
 *      between adjacent keys, which looks alarming and IS NOTHING: sin and cos
 *      are 2pi-periodic, so Euler(x, y, z + 2pi) is the SAME ROTATION. The
 *      runtime converts each key to a quaternion, where that difference
 *      disappears entirely. A wrap is not a discontinuity.
 *
 *   2. QUATERNION ANGLE PER SECOND. Convert both keys to quaternions, take the
 *      angle between them (q and -q are the same rotation, so use |dot|), and
 *      divide by the REAL time between those keys — not a uniform dt, which
 *      misreads a sparsely sampled capture as violent motion. THIS is the
 *      physical quantity.
 *
 * THE THRESHOLD: a fast human limb peaks near 2000 deg/s at the extremity.
 * 3000 is the default here — generous on purpose, so a stylised fighting-game
 * whip still passes and only genuine impossibilities are reported.
 *
 * WHAT IT FOUND WHEN WRITTEN, stated honestly: 195 key pairs over 367 clips,
 * roughly 0.2% of all pairs, concentrated in Schwarzerblitz reaction and
 * launcher clips where very fast motion is plausible. That is a thin tail, NOT
 * evidence that the animation data is broken. The gate exists to catch a future
 * import that IS broken.
 *
 * USAGE
 *   node scripts/animation-continuity-audit.mjs
 *   node scripts/animation-continuity-audit.mjs --gate [--max-pairs N] [--limit DEG_PER_SEC]
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const GENERATED = join(ROOT, 'src', 'generated');
const DEG = 180 / Math.PI;

/** Default ceiling in degrees per second. See the note above. */
export const DEFAULT_LIMIT_DEG_PER_SEC = 3000;

/** THREE's default Euler order is XYZ; this must match or the angle is wrong. */
export function eulerToQuat(x, y, z) {
  const c1 = Math.cos(x / 2), c2 = Math.cos(y / 2), c3 = Math.cos(z / 2);
  const s1 = Math.sin(x / 2), s2 = Math.sin(y / 2), s3 = Math.sin(z / 2);
  return [
    s1 * c2 * c3 + c1 * s2 * s3,
    c1 * s2 * c3 - s1 * c2 * s3,
    c1 * c2 * s3 + s1 * s2 * c3,
    c1 * c2 * c3 - s1 * s2 * s3,
  ];
}

/** Angle between two rotations. |dot| because q and -q are the same rotation. */
export function angleBetween(a, b) {
  const d = Math.min(1, Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]));
  return 2 * Math.acos(d);
}

/** Audit one clip. Returns every key pair whose angular velocity is impossible. */
export function auditClip(clip, limit = DEFAULT_LIMIT_DEG_PER_SEC) {
  const keys = clip?.keys ?? [];
  const findings = [];
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1].bones ?? {};
    const b = keys[i].bones ?? {};
    // Keys carry their own timestamps. A uniform dt reads a sparse capture as
    // violent motion, which is how the first pass over-reported by 30x.
    const dt = Math.max(1e-3, (keys[i].t ?? 0) - (keys[i - 1].t ?? 0));
    for (const bone of Object.keys(b)) {
      if (!a[bone]) continue;
      const qa = eulerToQuat(a[bone].rx ?? 0, a[bone].ry ?? 0, a[bone].rz ?? 0);
      const qb = eulerToQuat(b[bone].rx ?? 0, b[bone].ry ?? 0, b[bone].rz ?? 0);
      const degPerSec = (angleBetween(qa, qb) * DEG) / dt;
      if (degPerSec > limit) {
        findings.push({ bone, key: i, degPerSec: Math.round(degPerSec), dt: +dt.toFixed(4) });
      }
    }
  }
  return findings;
}

function loadBank(file) {
  const s = readFileSync(file, 'utf8');
  const i = s.indexOf('= {');
  if (i < 0) return null;
  try {
    return JSON.parse(s.slice(s.indexOf('{', i), s.lastIndexOf('};') + 1));
  } catch {
    return null;
  }
}

export function auditBanks(dir = GENERATED, limit = DEFAULT_LIMIT_DEG_PER_SEC) {
  const banks = {};
  if (!existsSync(dir)) return banks;
  for (const file of readdirSync(dir)) {
    if (!/MotionBank\.generated\.ts$/.test(file)) continue;
    const data = loadBank(join(dir, file));
    if (!data) continue;
    const clips = [];
    let pairs = 0;
    for (const [name, clip] of Object.entries(data)) {
      const findings = auditClip(clip, limit);
      if (findings.length) {
        pairs += findings.length;
        const worst = findings.reduce((m, f) => (f.degPerSec > m.degPerSec ? f : m));
        clips.push({ name, count: findings.length, worst });
      }
    }
    clips.sort((a, b) => b.count - a.count);
    banks[file.replace('.generated.ts', '')] = { total: Object.keys(data).length, clips, pairs };
  }
  return banks;
}

function main() {
  const argv = process.argv.slice(2);
  const readNum = (flag, fallback) => {
    const i = argv.indexOf(flag);
    return i >= 0 && argv[i + 1] ? Number(argv[i + 1]) : fallback;
  };
  const limit = readNum('--limit', DEFAULT_LIMIT_DEG_PER_SEC);
  const maxPairs = readNum('--max-pairs', 400);

  const banks = auditBanks(GENERATED, limit);
  let totalPairs = 0;
  let totalClips = 0;

  for (const [bank, report] of Object.entries(banks)) {
    totalPairs += report.pairs;
    totalClips += report.total;
    console.log(`\n${bank}: ${report.clips.length}/${report.total} clips exceed ${limit} deg/s (${report.pairs} key pairs)`);
    for (const c of report.clips.slice(0, 8)) {
      console.log(`   ${c.name.padEnd(32)} ${String(c.count).padStart(3)}x, peak ${c.worst.degPerSec} deg/s on ${c.worst.bone} over ${c.worst.dt}s`);
    }
  }
  console.log(`\n[continuity] ${totalPairs} impossible key pairs across ${totalClips} clips (limit ${limit} deg/s)`);
  console.log('[continuity] a ~2pi EULER jump is not a finding — it is the same rotation. See the header.');

  if (argv.includes('--gate') && totalPairs > maxPairs) {
    console.error(`[continuity] GATE FAILED — ${totalPairs} pairs exceeds the budget of ${maxPairs}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) main();
