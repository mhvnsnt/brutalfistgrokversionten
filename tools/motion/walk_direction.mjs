#!/usr/bin/env node
/**
 * WHICH WAY DOES A LOCOMOTION CLIP ACTUALLY WALK?
 *
 * Owner: "The walk was also playing backward for the whole fight. The name
 * `walk` was matching the clip `WALK`, and that clip steps the wrong way while
 * the body faces you."
 *
 * A name cannot answer this and neither can a label — OWNER LAW. The frames can.
 * Root motion is neutralised at bake time, so the body does not travel; the FEET
 * do. In a forward walk the PLANTED foot slides BACKWARD under the body. In a
 * backward walk it slides forward. So:
 *
 *   travel of the planted foot, in the body's own facing frame
 *      negative along facing  ->  the body is going FORWARD
 *      positive along facing  ->  the body is going BACKWARD
 *
 * The facing frame is taken from the hips' own rotation each key, not from a
 * world axis, so a clip captured at any heading measures the same.
 *
 * Usage: node tools/motion/walk_direction.mjs [model.glb] [CLIP ...]
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { parseGlb } from '../model_diag/bind_pose.mjs';

const MODEL = process.argv[2]?.endsWith('.glb') ? process.argv[2] : 'public/models/TITAN.glb';
const BAKED = 'public/motion/baked';
const FEET = ['mixamorigLeftFoot', 'mixamorigRightFoot'];
const HIPS = 'mixamorigHips';

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

/** Signed travel of the planted foot along the body's facing. Negative = walks forward. */
export function walkDirectionOf(r, clip) {
  const keys = Math.max(...FEET.map((f) => (clip.tracks?.[f]?.q?.length ?? 0) / 4), 0);
  if (keys < 4 || !clip.dur) return null;
  let along = 0, lateral = 0, planted = null, prev = null;
  for (let k = 0; k < keys; k++) {
    const w = worldAt(r, poseAt(clip, k));
    const p = FEET.map((f) => posOf(w, r, f));
    const hi = r.indexOfName.get(HIPS);
    if (p.some((x) => !x) || hi === undefined) return null;
    // The body's facing, from the hips' own basis this key. Mixamo hips look
    // down +Z in bind; taking it from the matrix keeps any heading honest.
    const m = w[hi];
    const fwd = new THREE.Vector3(m.elements[8], 0, m.elements[10]);
    if (fwd.lengthSq() < 1e-8) return null;
    fwd.normalize();
    const side = new THREE.Vector3(fwd.z, 0, -fwd.x);
    const low = p[0].y <= p[1].y ? 0 : 1;
    if (low === planted && prev) {
      const d = new THREE.Vector3(p[low].x - prev.x, 0, p[low].z - prev.z);
      along += d.dot(fwd);
      lateral += d.dot(side);
    }
    planted = low; prev = p[low].clone();
  }
  return { along, lateral, dir: along < 0 ? 'FORWARD' : 'BACKWARD', magnitude: Math.abs(along) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = rig(MODEL);
  const want = process.argv.slice(3).filter((a) => !a.startsWith('-'));
  const names = want.length ? want : ['WALK', 'WALKFAST', 'DWARF_WALK', 'DRUNK_WALK', 'GINGA_FORWARD', 'GINGA_BACKWARD', 'LOCO_STRUT', 'LOCO_LIGHT', 'DRUNK_RUN_FORWARD', 'SHAZWALK', 'RUNNING'];
  console.log(`\nWALK DIRECTION — ${MODEL.split('/').pop()}, planted foot in the body's own facing frame`);
  console.log('  negative along-facing travel = the body moves FORWARD\n');
  console.log('  clip                      along     lateral   verdict');
  for (const n of names) {
    let clip; try { clip = JSON.parse(readFileSync(join(BAKED, `${n}.json`), 'utf8')); } catch { console.log(`  ${n.padEnd(24)}   (no baked clip)`); continue; }
    const d = walkDirectionOf(r, clip);
    if (!d) { console.log(`  ${n.padEnd(24)}   (no usable foot tracks)`); continue; }
    console.log(`  ${n.padEnd(24)} ${d.along.toFixed(3).padStart(7)}  ${d.lateral.toFixed(3).padStart(8)}   ${d.dir}`);
  }
}
