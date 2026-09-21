#!/usr/bin/env node
/**
 * IS THE SKELETON THE SAME SIZE AS THE BODY?
 *
 * Owner: "a lot of character models, GLBs and attires still have stretching
 * and deformation on certain parts of their body."
 *
 * Skin bleed is measured and repaired elsewhere and comes back CLEAN at
 * runtime for every shipped model, so this is looking for the other defect
 * that makes a body look wrong: a GLB whose BIND MESH and whose SKELETON
 * were authored at different scales.
 *
 * It is a known failure of weight-transfer re-rigging — the donor skeleton
 * and the target mesh disagree — and this project has shipped it twice
 * before (TARZANIAN_DEVIL at 1.936, CODY_gear at 1.944). It is invisible to
 * every other check: bind rendering is exact, because the inverse bind
 * matrices cancel the joint transforms, and a deformation gate measures a
 * vertex against its own weights, which still predict themselves perfectly.
 *
 * What it does on screen: the engine sizes a fighter by the BONE span, so a
 * skeleton twice the body's height gets scaled down to fit and the visible
 * mesh ends up half height — and because this engine drives joint POSITIONS,
 * a skeleton at the wrong scale relative to the mesh tears it apart the
 * moment physics touches it.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseGlb } from './bind_pose.mjs';

const DIR = 'public/models';
const files = (process.argv.slice(2).filter((a) => !a.startsWith('--')).length
  ? process.argv.slice(2).filter((a) => !a.startsWith('--'))
  : readdirSync(DIR).filter((f) => f.endsWith('.glb')));

/**
 * World position of a node, walking its ancestors WITH ROTATION.
 *
 * THE FIRST VERSION OF THIS ACCUMULATED TRANSLATION AND SCALE ONLY, and
 * reported a bone span of 1.268 for almost every model in the roster — the
 * same number for a heavyweight and a cruiserweight, which is impossible.
 * A Mixamo bone's translation is expressed in its PARENT'S ROTATED FRAME, so
 * dropping the rotation makes the chain fold up arbitrarily and the span is
 * meaningless. It then flagged 60 of 63 models as broken, which was my
 * arithmetic and not the assets.
 */
function mul(a, b) {
  // 4x4 column-major multiply, a*b.
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let v = 0;
      for (let k = 0; k < 4; k++) v += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = v;
    }
  }
  return o;
}
function trs(n) {
  if (n.matrix) return n.matrix.slice();
  const [x, y, z, w] = n.rotation ?? [0, 0, 0, 1];
  const [sx, sy, sz] = n.scale ?? [1, 1, 1];
  const [tx, ty, tz] = n.translation ?? [0, 0, 0];
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  return [
    (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
    (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
    (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
    tx, ty, tz, 1,
  ];
}
function worldOf(json, i, parent, cache) {
  if (cache.has(i)) return cache.get(i);
  const local = trs(json.nodes[i] ?? {});
  const p = parent.get(i);
  const m = p === undefined ? local : mul(worldOf(json, p, parent, cache), local);
  cache.set(i, m);
  return m;
}

const rows = [];
for (const f of files) {
  const name = f.includes('/') ? f : join(DIR, f);
  let json;
  try { ({ json } = parseGlb(readFileSync(name))); } catch (e) { rows.push({ f, err: String(e).slice(0, 60) }); continue; }
  const skin = json.skins?.[0];
  if (!skin) { rows.push({ f, skip: 'no skin' }); continue; }

  const parent = new Map();
  json.nodes.forEach((n, i) => (n.children ?? []).forEach((c) => parent.set(c, i)));
  const cache = new Map();
  let lo = Infinity, hi = -Infinity;
  for (const j of skin.joints) {
    const w = worldOf(json, j, parent, cache);
    lo = Math.min(lo, w[13]); hi = Math.max(hi, w[13]);
  }
  const boneSpan = hi - lo;

  // The bind mesh's own height, from the POSITION accessor's declared min/max.
  let mLo = Infinity, mHi = -Infinity;
  for (const mesh of json.meshes ?? []) {
    for (const prim of mesh.primitives ?? []) {
      const acc = json.accessors?.[prim.attributes?.POSITION];
      if (!acc?.min || !acc?.max) continue;
      mLo = Math.min(mLo, acc.min[1]); mHi = Math.max(mHi, acc.max[1]);
    }
  }
  const meshSpan = mHi - mLo;
  if (!Number.isFinite(boneSpan) || !Number.isFinite(meshSpan) || meshSpan <= 0) {
    rows.push({ f, skip: 'no measurable span' });
    continue;
  }
  rows.push({ f, boneSpan, meshSpan, ratio: boneSpan / meshSpan });
}

const bad = rows.filter((r) => r.ratio && (r.ratio > 1.25 || r.ratio < 0.8));
console.log('\nBONE SPAN vs BIND MESH HEIGHT — a ratio near 1.00 is consistent\n');
console.log('  model                                bone      mesh    ratio');
for (const r of rows.sort((a, b) => Math.abs((b.ratio ?? 1) - 1) - Math.abs((a.ratio ?? 1) - 1))) {
  if (r.skip || r.err) continue;
  const flag = r.ratio > 1.25 || r.ratio < 0.8 ? '   <-- INCONSISTENT' : '';
  if (!flag && rows.length > 12 && Math.abs(r.ratio - 1) < 0.1) continue;
  console.log(`  ${r.f.replace(/^.*\//, '').padEnd(34)}${r.boneSpan.toFixed(3).padStart(7)}${r.meshSpan.toFixed(3).padStart(10)}${r.ratio.toFixed(3).padStart(9)}${flag}`);
}
console.log(`\n  ${rows.filter((r) => r.ratio).length} measured · ${bad.length} INCONSISTENT · ${rows.filter((r) => r.skip).length} skipped`);
if (bad.length) console.log(`  inconsistent: ${bad.map((b) => b.f.replace(/^.*\//, '')).join(', ')}`);
if (process.argv.includes('--gate') && bad.length) process.exit(1);
