#!/usr/bin/env node
/**
 * HOW FAR FROM ITS REST POSE DOES EACH CLIP PUT THE THIGH?
 *
 * This exists because measuring the ABSOLUTE rotation answers nothing. A
 * Mixamo thigh's bind local rotation is already about 180 degrees — the leg
 * points down while the hips stand upright — so every clip reads ~180 and the
 * number is meaningless. SkeletalLimits says as much in its own comments.
 *
 * The honest measure is the DELTA from bind: how far a clip moves the joint
 * away from where it rests. Measured over all 455 baked clips:
 *
 *     p05 0 deg    median 81 deg    p95 126 deg    max 126 deg
 *     210 of 455 clips exceed 90 degrees
 *
 * 126 is not corruption — it is the joint limiter doing its job, capping the
 * thigh at bend 120 / twist 50, which compose to about 126. But a MEDIAN of 81
 * degrees is a different matter: a standing jab measures 74, and a thigh that
 * far from rest in a standing pose is not anatomy, it is a baseline offset
 * living in the track. That offset is what drives the hip's volume collapse
 * under linear blend skinning (see lbs_in_play.mjs).
 *
 * The range column separates the two causes. A large rotation that never
 * CHANGES is an offset baked in by a rest-pose mismatch during retarget; one
 * that varies is real animation. Only 17 clips are the pure stuck case, so
 * this is a systematic baseline rather than a handful of bad files.
 *
 * Usage: node tools/model_diag/rest_offset.mjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseGlb } from './bind_pose.mjs';

const { json } = parseGlb(readFileSync('public/models/TITAN.glb'));
const skin = json.skins[0];
const bind = new Map();
for (const n of skin.joints) {
  const node = json.nodes[n];
  bind.set((node.name ?? '').replace(':', ''), node.rotation ?? [0, 0, 0, 1]);
}
const qmulinv = (a, b) => { // angle of a^-1 * b, in degrees
  const [ax, ay, az, aw] = a, [bx, by, bz, bw] = b;
  const w = aw * bw + ax * bx + ay * by + az * bz;
  return 2 * Math.acos(Math.min(1, Math.abs(w))) * 180 / Math.PI;
};
const JOINTS = ['mixamorigLeftUpLeg', 'mixamorigRightUpLeg', 'mixamorigRightArm'];
const rows = [];
for (const f of readdirSync('public/motion/baked').filter((x) => x.endsWith('.json') && x !== 'index.json')) {
  let d; try { d = JSON.parse(readFileSync(join('public/motion/baked', f), 'utf8')); } catch { continue; }
  const out = { clip: d.name ?? f.replace('.json', '') };
  for (const j of JOINTS) {
    const t = d.tracks?.[j]; const b = bind.get(j);
    if (!t?.q || !b) continue;
    let mx = 0, mn = 1e9;
    for (let i = 0; i + 3 < t.q.length; i += 4) {
      const v = qmulinv(b, [t.q[i], t.q[i+1], t.q[i+2], t.q[i+3]]);
      if (v > mx) mx = v; if (v < mn) mn = v;
    }
    out[j.replace('mixamorig', '')] = mx;
    out[j.replace('mixamorig', '') + '_range'] = mx - mn;
  }
  rows.push(out);
}
const leg = rows.map((r) => Math.max(r.LeftUpLeg ?? 0, r.RightUpLeg ?? 0)).sort((a, b) => a - b);
const q = (p) => leg[Math.floor(leg.length * p)]?.toFixed(0);
console.log(`\nTHIGH ROTATION AWAY FROM BIND, across ${rows.length} clips\n`);
console.log(`  p05 ${q(0.05)}deg   median ${q(0.5)}deg   p95 ${q(0.95)}deg   max ${leg[leg.length-1]?.toFixed(0)}deg`);
console.log(`  clips over 45deg: ${leg.filter((v) => v > 45).length}   over 90deg: ${leg.filter((v) => v > 90).length}`);
// A LARGE ROTATION THAT NEVER CHANGES is a baked-in offset, not animation.
const stuck = rows.filter((r) => Math.max(r.LeftUpLeg ?? 0, r.RightUpLeg ?? 0) > 60
  && Math.max(r.LeftUpLeg_range ?? 0, r.RightUpLeg_range ?? 0) < 10);
console.log(`\n  clips whose thigh sits over 60deg from bind and BARELY MOVES (<10deg range): ${stuck.length}`);
console.log('  those are a constant offset baked into the track, not animation.\n');
for (const n of ['ALTERNATINGFOREARMS','CHOKESLAM','DDT','IDLE','GRAFQUICKJAB','TPOSE']) {
  const r = rows.find((x) => x.clip === n); if (!r) continue;
  const mx = Math.max(r.LeftUpLeg ?? 0, r.RightUpLeg ?? 0);
  const rg = Math.max(r.LeftUpLeg_range ?? 0, r.RightUpLeg_range ?? 0);
  console.log(`  ${n.padEnd(22)} thigh ${mx.toFixed(0).padStart(4)}deg  varies by ${rg.toFixed(0).padStart(4)}deg   arm ${(r.RightArm ?? 0).toFixed(0).padStart(4)}deg`);
}
