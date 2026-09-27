#!/usr/bin/env node
/**
 * HOW FAST DOES EACH LOCOMOTION CLIP THINK IT IS WALKING?
 *
 * Every locomotion clip in this bank has ZERO hips travel — measured, all four
 * slots — because root motion is neutralised at bake time and the engine
 * translates the root itself. That is the normal arrangement, and it has one
 * consequence that is not optional: the STRIDE LENGTH is fixed by the clip while
 * the SPEED is set by the engine, so unless the playback rate scales with the
 * speed, the feet slide. There is no amount of blending that hides it.
 *
 * So the number that matters is the speed the clip was AUTHORED at: how far a
 * planted foot travels backward under the body per second. If that disagrees with
 * WALK_SPEED, the difference is the sliding rate, in metres per second, and it is
 * visible.
 *
 * MEASURED BY FORWARD KINEMATICS, not from the hips. The hips do not move in an
 * in-place cycle; the feet do. Each frame the LOWER foot is taken as the planted
 * one and its horizontal displacement is accumulated while it stays planted. Sum
 * over the cycle, divide by the duration.
 *
 * Usage: node tools/motion/stride_speed.mjs [model.glb] [--write]
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { parseGlb } from '../model_diag/bind_pose.mjs';

const MODEL = process.argv[2]?.endsWith('.glb') ? process.argv[2] : 'public/models/TITAN.glb';
const BAKED = 'public/motion/baked';
const MANIFEST = 'public/motion/stride_speed.json';

const FEET = ['mixamorigLeftFoot', 'mixamorigRightFoot'];

function rig(file) {
  const { json } = parseGlb(readFileSync(file));
  const skin = json.skins[0];
  const names = skin.joints.map((n) => (json.nodes[n]?.name ?? '').replace(':', ''));
  const parentNode = new Map();
  json.nodes.forEach((n, i) => (n.children ?? []).forEach((c) => parentNode.set(c, i)));
  const idx = new Map();
  skin.joints.forEach((n, i) => idx.set(n, i));
  const parentOf = skin.joints.map((n) => {
    const p = parentNode.get(n);
    return p !== undefined && idx.has(p) ? idx.get(p) : -1;
  });
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
  return { names, parentOf, localBind, localT, localS, indexOfName: new Map(names.map((n, i) => [n, i])) };
}

function worldAt(r, quatFor) {
  const out = new Array(r.names.length);
  for (let i = 0; i < r.names.length; i++) {
    const q = quatFor(r.names[i]);
    const local = q ? new THREE.Matrix4().compose(r.localT[i], q, r.localS[i]) : r.localBind[i];
    out[i] = r.parentOf[i] < 0 ? local.clone() : out[r.parentOf[i]].clone().multiply(local);
  }
  return out;
}
const poseAt = (clip, k) => (bone) => {
  const t = clip.tracks?.[bone];
  if (!t?.q || t.q.length < (k + 1) * 4) return null;
  return new THREE.Quaternion(t.q[k * 4], t.q[k * 4 + 1], t.q[k * 4 + 2], t.q[k * 4 + 3]);
};
const posOf = (w, r, name) => {
  const i = r.indexOfName.get(name);
  return i === undefined ? null : new THREE.Vector3().setFromMatrixPosition(w[i]);
};

/**
 * The speed this clip was authored at, in m/s, plus the stride it covers.
 * Returns null when the clip has no usable foot tracks.
 */
export function strideSpeedOf(r, clip) {
  const keys = Math.max(...FEET.map((f) => (clip.tracks?.[f]?.q?.length ?? 0) / 4), 0);
  if (keys < 4 || !clip.dur) return null;
  let covered = 0;
  let planted = null;
  let prev = null;
  for (let k = 0; k < keys; k++) {
    const w = worldAt(r, poseAt(clip, k));
    const p = FEET.map((f) => posOf(w, r, f));
    if (p.some((x) => !x)) return null;
    // The lower foot is the planted one. A cycle with both feet level (a stance
    // clip) simply accumulates nothing, which is the right answer for it.
    const low = p[0].y <= p[1].y ? 0 : 1;
    if (low === planted && prev) {
      covered += Math.hypot(p[low].x - prev.x, p[low].z - prev.z);
    }
    planted = low;
    prev = p[low].clone();
  }
  return { stride: covered, speed: covered / clip.dur, keys };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = rig(MODEL);
  const rows = {};
  for (const f of readdirSync(BAKED)) {
    if (!f.endsWith('.json') || f === 'index.json') continue;
    let clip;
    try { clip = JSON.parse(readFileSync(join(BAKED, f), 'utf8')); } catch { continue; }
    const s = strideSpeedOf(r, clip);
    if (!s) continue;
    rows[clip.name ?? f.replace('.json', '')] = {
      strideM: +s.stride.toFixed(3),
      speedMps: +s.speed.toFixed(3),
      durS: clip.dur,
    };
  }
  const named = ['DWARF_WALK', 'GINGA_BACKWARD', 'DRUNK_RUN_FORWARD', 'DRUNK_WALK', 'WALK', 'WALKFAST', 'RUNNING', 'IDLE', 'TPOSE'];
  console.log(`\nAUTHORED STRIDE SPEED — ${MODEL.split('/').pop()}, by forward kinematics on the planted foot\n`);
  console.log('  clip                       stride    speed      duration');
  for (const n of named) {
    const x = rows[n];
    if (!x) continue;
    console.log(`  ${n.padEnd(24)} ${String(x.strideM).padStart(6)}m  ${String(x.speedMps).padStart(6)} m/s  ${x.durS}s`);
  }
  const speeds = Object.values(rows).map((x) => x.speedMps).sort((a, b) => a - b);
  const q = (p) => speeds[Math.floor(speeds.length * p)] ?? 0;
  console.log(`\n  ${speeds.length} clips measured   p05 ${q(0.05)}  median ${q(0.5)}  p95 ${q(0.95)} m/s`);
  if (process.argv.includes('--write')) {
    writeFileSync(MANIFEST, `${JSON.stringify({
      generatedBy: 'tools/motion/stride_speed.mjs',
      model: MODEL,
      what: 'speedMps is the m/s this clip was authored at, measured from the planted foot by FK. Playback rate = actual speed / speedMps kills foot sliding.',
      clips: rows,
    }, null, 2)}\n`);
    console.log(`\n  wrote ${MANIFEST}`);
  }
}
