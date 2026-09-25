#!/usr/bin/env node
/**
 * IS EACH VERTEX ANYWHERE NEAR THE BONE THAT CARRIES IT?
 *
 * Owner, repeatedly: "a lot of character models, GLBs and attires still
 * having stretching and deformation on certain parts of their body."
 *
 * THE MATHS THAT HIDES THIS DEFECT FROM EVERY OTHER CHECK:
 *
 *     skinned(v) = bindMatrixInverse · SUM w (boneWorld · IBM) · bindMatrix · v
 *
 * In bind pose boneWorld == inverse(IBM), so the sum collapses to the
 * identity and the result is v EXACTLY — whatever the weights say, whatever
 * the matrices say, however far the mesh is from the skeleton. That is why a
 * broken rig renders perfectly at rest, why a viewer looks fine, and why
 * skinqa (which measures a vertex against its own weights) scores it clean.
 *
 * Under pose the sum is NOT the identity. A vertex sitting 0.85 m from the
 * bone that carries it is on a 0.85 m lever: rotate that bone five degrees
 * and the vertex travels 7 cm. That is the stretching.
 *
 * So the honest measure is the LEVER ARM: the distance, in the skeleton's own
 * bind space, from a vertex to the bind position of its dominant joint. This
 * reads the glTF directly — no renderer, no browser — so it sweeps the whole
 * roster in seconds.
 *
 * Usage: node tools/model_diag/bind_space.mjs [dir-or-file...] [--json] [--gate]
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parseGlb, bindPositionFromIBM } from './bind_pose.mjs';

/** A lever this long turns a small joint rotation into visible tearing. */
export const LEVER_FAIL_M = 0.40;
/** Share of the body past it before the model counts as off its skeleton. */
export const LEVER_FAIL_SHARE = 0.10;
/**
 * THE VERDICT IS THE RESIDUAL, NOT THE RAW NUMBER, and that matters.
 *
 * The raw lever arm is a CONTINUUM: the healthy roster runs 17-24 cm and a
 * handful of models sit at 25-33 cm because of a coat or long hair bound to
 * a distant bone. Drawing the line through the middle of that and shouting
 * "needs a re-rig" at eight models would be an arbitrary threshold dressed
 * up as a finding — the first pass of this tool did exactly that.
 *
 * What actually separates a broken rig from a busy one is what survives the
 * best possible rigid correction, which is the correction the engine already
 * applies at load. After it, the whole healthy population lands at 17-25 cm.
 * A model still past 30 cm is wrong in a way no repair reaches.
 */
export const RESIDUAL_FAIL_M = 0.30;
/** A skeleton whose joints all sit within this of each other is degenerate. */
export const DEGENERATE_SPAN_M = 0.05;

const COMPS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const CSIZE = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };

async function decodeMeshopt(bin, ext) {
  const { MeshoptDecoder } = await import('three/examples/jsm/libs/meshopt_decoder.module.js');
  await MeshoptDecoder.ready;
  const src = bin.subarray(ext.byteOffset ?? 0, (ext.byteOffset ?? 0) + ext.byteLength);
  const out = new Uint8Array(ext.count * ext.byteStride);
  MeshoptDecoder.decodeGltfBuffer(out, ext.count, ext.byteStride, src, ext.mode, ext.filter);
  return Buffer.from(out.buffer, out.byteOffset, out.byteLength);
}

/**
 * Read any accessor, of any component type, compressed or not.
 *
 * NOTE the decode CACHE. The older reader in bind_pose.mjs rewrote
 * `bv.byteOffset = 0` on the shared JSON after decompressing — correct once,
 * and silently wrong for every later accessor that shares the buffer view,
 * which for an interleaved mesh is most of them.
 */
async function makeReader(json, bin) {
  const cache = new Map();
  return async function read(index) {
    const acc = json.accessors?.[index];
    if (!acc || acc.bufferView === undefined) return null;
    const bv = json.bufferViews[acc.bufferView];
    const comps = COMPS[acc.type];
    const csize = CSIZE[acc.componentType];
    if (!comps || !csize) return null;

    let src = bin;
    let viewOffset = bv.byteOffset ?? 0;
    let stride = bv.byteStride ?? comps * csize;
    const meshopt = bv.extensions?.EXT_meshopt_compression;
    if (meshopt) {
      if (!cache.has(acc.bufferView)) cache.set(acc.bufferView, await decodeMeshopt(bin, meshopt));
      src = cache.get(acc.bufferView);
      viewOffset = 0;
      stride = meshopt.byteStride;
    } else if (bv.extensions && Object.keys(bv.extensions).length) {
      return null; // some other compression we do not speak
    }

    const start = viewOffset + (acc.byteOffset ?? 0);
    const get = (at) => {
      switch (acc.componentType) {
        case 5126: return src.readFloatLE(at);
        case 5125: return src.readUInt32LE(at);
        case 5123: return src.readUInt16LE(at);
        case 5122: return src.readInt16LE(at);
        case 5121: return src.readUInt8(at);
        case 5120: return src.readInt8(at);
        default: return 0;
      }
    };
    const out = new Array(acc.count);
    for (let i = 0; i < acc.count; i++) {
      const row = new Array(comps);
      for (let c = 0; c < comps; c++) {
        const at = start + i * stride + c * csize;
        if (at + csize > src.length) return null;
        row[c] = get(at);
      }
      out[i] = row;
    }
    return out;
  };
}

function mul(a, b) {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let v = 0;
    for (let k = 0; k < 4; k++) v += a[k * 4 + r] * b[c * 4 + k];
    o[c * 4 + r] = v;
  }
  return o;
}
function trsOf(n) {
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
function apply(m, p) {
  return [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
  ];
}

/** World matrix per node, by walking the scene roots. */
function worldMatrices(json) {
  const world = new Array(json.nodes?.length ?? 0).fill(null);
  const roots = json.scenes?.[json.scene ?? 0]?.nodes ?? json.nodes?.map((_, i) => i) ?? [];
  const walk = (i, parent) => {
    const n = json.nodes[i];
    const m = mul(parent, trsOf(n));
    world[i] = m;
    for (const c of n.children ?? []) walk(c, m);
  };
  const IDENT = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  for (const r of roots) walk(r, IDENT);
  for (let i = 0; i < world.length; i++) if (!world[i]) world[i] = IDENT.slice();
  return world;
}

export async function measureBindSpace(file) {
  const { json, bin } = parseGlb(readFileSync(file));
  if (!json.skins?.length) return { file, skinned: false };
  const read = await makeReader(json, bin);
  const world = worldMatrices(json);

  let verts = 0, far = 0, sum = 0, max = 0;
  const levers = [];
  /** Running sum of (bone - vertex): its mean is the least-squares rigid fit. */
  const fitSum = [0, 0, 0];
  const pairs = [];
  const meshBox = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  const boneBox = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  let joints = 0;
  let unreadable = 0;

  for (let ni = 0; ni < (json.nodes?.length ?? 0); ni++) {
    const node = json.nodes[ni];
    if (node.mesh === undefined || node.skin === undefined) continue;
    const skin = json.skins[node.skin];
    const ibms = await read(skin.inverseBindMatrices);
    if (!ibms) { unreadable++; continue; }
    joints = Math.max(joints, skin.joints.length);
    const bindPos = ibms.map(bindPositionFromIBM);
    for (const p of bindPos) for (let k = 0; k < 3; k++) {
      boneBox[k] = Math.min(boneBox[k], p[k]);
      boneBox[k + 3] = Math.max(boneBox[k + 3], p[k]);
    }
    // THE BIND MATRIX is the mesh node's world transform: what maps mesh
    // space into the space the inverse bind matrices are expressed in.
    const bindMatrix = world[ni];

    for (const prim of json.meshes[node.mesh].primitives ?? []) {
      const P = await read(prim.attributes?.POSITION);
      const J = await read(prim.attributes?.JOINTS_0);
      const W = await read(prim.attributes?.WEIGHTS_0);
      if (!P || !J || !W) { unreadable++; continue; }
      for (let i = 0; i < P.length; i++) {
        const v = apply(bindMatrix, P[i]);
        for (let k = 0; k < 3; k++) {
          meshBox[k] = Math.min(meshBox[k], v[k]);
          meshBox[k + 3] = Math.max(meshBox[k + 3], v[k]);
        }
        // Dominant joint: the one actually responsible for this vertex.
        let bi = 0, bw = -1;
        for (let c = 0; c < 4; c++) if (W[i][c] > bw) { bw = W[i][c]; bi = J[i][c]; }
        if (bw <= 0) continue;
        const b = bindPos[bi];
        if (!b) continue;
        const d = Math.hypot(v[0] - b[0], v[1] - b[1], v[2] - b[2]);
        verts++; sum += d; if (d > max) max = d;
        if (d > LEVER_FAIL_M) far++;
        if (levers.length < 400000) levers.push(d);
        for (let k = 0; k < 3; k++) fitSum[k] += b[k] - v[k];
        if (pairs.length < 200000) pairs.push([v[0] - b[0], v[1] - b[1], v[2] - b[2]]);
      }
    }
  }
  if (!verts) return { file, skinned: true, readable: false, unreadable };
  levers.sort((a, b) => a - b);
  // THE RIGID FIT. The single translation minimising the summed squared lever
  // is the mean of (bone - vertex). Re-measuring with it applied separates the
  // two defects that look identical in the table above: a body authored in the
  // wrong SPACE, which the load-time repair corrects exactly, from a rig that
  // is wrong in some other way, which no amount of moving will fix.
  const fit = fitSum.map((x) => x / verts);
  let fitted = 0, fittedFar = 0;
  for (const d of pairs) {
    const r = Math.hypot(d[0] + fit[0], d[1] + fit[1], d[2] + fit[2]);
    fitted += r;
    if (r > LEVER_FAIL_M) fittedFar++;
  }
  fitted /= Math.max(1, pairs.length);
  const meshH = meshBox[4] - meshBox[1];
  const boneH = boneBox[4] - boneBox[1];
  return {
    file,
    skinned: true,
    readable: true,
    joints,
    verts,
    meanLeverCm: +(100 * sum / verts).toFixed(1),
    p95LeverCm: +(100 * levers[Math.floor(levers.length * 0.95)]).toFixed(1),
    maxLeverCm: +(100 * max).toFixed(1),
    farShare: +(far / verts).toFixed(4),
    meshY: [+meshBox[1].toFixed(2), +meshBox[4].toFixed(2)],
    boneY: [+boneBox[1].toFixed(2), +boneBox[4].toFixed(2)],
    /** Mesh centre minus skeleton centre, in Y. A rig and its body should share a centre. */
    centreGapM: +(((meshBox[1] + meshBox[4]) / 2) - ((boneBox[1] + boneBox[4]) / 2)).toFixed(3),
    heightRatio: boneH > 1e-6 ? +(meshH / boneH).toFixed(3) : null,
    offSkeleton: far / verts > LEVER_FAIL_SHARE,
    fitM: +Math.hypot(...fit).toFixed(3),
    fittedMeanCm: +(100 * fitted).toFixed(1),
    fittedFarShare: +(fittedFar / Math.max(1, pairs.length)).toFixed(4),
    /** True when moving the body onto its skeleton is enough — what the engine does at load. */
    repairable: Math.hypot(...fit) >= 0.30 && fitted <= RESIDUAL_FAIL_M && fitted * 2 <= sum / verts,
    /**
     * Every joint at the same place. Then the inverse bind matrices carry no
     * bind pose at all, so each bone rotates the geometry welded to it about
     * the WORLD ORIGIN, and the body comes apart the moment anything animates.
     */
    degenerateSkeleton: Math.max(boneBox[3] - boneBox[0], boneBox[4] - boneBox[1], boneBox[5] - boneBox[2]) < DEGENERATE_SPAN_M,
    broken: fitted > RESIDUAL_FAIL_M
      || Math.max(boneBox[3] - boneBox[0], boneBox[4] - boneBox[1], boneBox[5] - boneBox[2]) < DEGENERATE_SPAN_M,
  };
}

function collect(paths) {
  const files = [];
  for (const p of paths) {
    if (statSync(p).isDirectory()) { for (const f of readdirSync(p)) if (f.endsWith('.glb')) files.push(join(p, f)); }
    else files.push(p);
  }
  return files.sort();
}

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const rows = [];
  for (const file of collect(args.length ? args : ['public/models'])) {
    try { rows.push(await measureBindSpace(file)); }
    catch (e) { rows.push({ file, error: String(e?.message ?? e) }); }
  }
  if (process.argv.includes('--json')) { console.log(JSON.stringify(rows, null, 2)); return; }

  const measured = rows.filter((r) => r.readable);
  const listed = measured.filter((r) => r.offSkeleton || r.broken)
    .sort((a, b) => b.fittedMeanCm - a.fittedMeanCm);
  const bad = measured.filter((r) => r.broken);
  console.log('\nBIND SPACE — how far is a vertex from the bone that moves it?\n');
  console.log('  model                              mean   p95    max   >40cm  meshY        boneY        fit    after');
  for (const r of [...listed, ...measured.filter((r) => !r.offSkeleton && !r.broken)
    .sort((a, b) => b.fittedMeanCm - a.fittedMeanCm).slice(0, 5)]) {
    const n = r.file.split('/').pop().replace(/\.glb$/, '');
    console.log(
      `  ${(r.broken ? '! ' : '  ') + n.padEnd(32).slice(0, 32)}`
      + `${String(r.meanLeverCm).padStart(5)} ${String(r.p95LeverCm).padStart(5)} ${String(r.maxLeverCm).padStart(6)}`
      + `  ${(100 * r.farShare).toFixed(1).padStart(5)}%`
      + `  ${`${r.meshY[0]}..${r.meshY[1]}`.padEnd(12)} ${`${r.boneY[0]}..${r.boneY[1]}`.padEnd(12)}`
      + ` ${String(r.fitM).padStart(5)}m ${String(r.fittedMeanCm).padStart(5)}cm`
      + `${r.degenerateSkeleton ? '  DEGENERATE SKELETON — RE-RIG'
        : r.broken ? '  NEEDS RE-RIG'
        : r.repairable ? '  repaired at load'
        : r.offSkeleton ? '  busy rig, in band once fitted' : ''}`,
    );
  }
  const repaired = listed.filter((r) => r.repairable && !r.broken);
  console.log(`\n[bind-space] ${measured.length} skinned models measured — ${bad.length} genuinely broken`
    + ` (residual over ${Math.round(100 * RESIDUAL_FAIL_M)}cm after the best rigid fit, or a degenerate skeleton),`
    + ` ${repaired.length} corrected at load by BindSpaceRepair`
    + `${rows.filter((r) => r.error).length ? `, ${rows.filter((r) => r.error).length} errored` : ''}`
    + `${rows.filter((r) => r.skinned && !r.readable).length ? `, ${rows.filter((r) => r.skinned && r.readable === false).length} unreadable` : ''}`);
  // The gate fails only on what the engine CANNOT fix for itself. A model the
  // load-time repair handles exactly is not a shipping defect.
  if (process.argv.includes('--gate') && bad.length) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e?.stack ?? e); process.exitCode = 1; });
}
