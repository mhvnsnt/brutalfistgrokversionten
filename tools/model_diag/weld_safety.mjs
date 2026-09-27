#!/usr/bin/env node
/**
 * DID THE WELD MERGE A UV SEAM?
 *
 * gltfpack / meshopt shrink a mesh by fusing vertices that are duplicates. Same
 * triangle count with fewer vertices is exactly that, and it is lossless — as
 * long as the fused vertices really were identical. Fuse two vertices that share
 * a POSITION but carry DIFFERENT texture coordinates and you have welded a UV
 * seam shut, which renders as the texture stretching across the join. That is
 * one of the defects the owner reports by eye, so it is not something to take on
 * trust from a file-size win.
 *
 * THE MEASURE IS THE SEAM COUNT, NOT THE VERTEX COUNT.
 *
 * A first pass compared the welded vertex count against the number of vertices
 * that differ in (position, normal, uv) at 1e-5 and called any shortfall a
 * failure. That was too blunt in one direction and confounded in another: a weld
 * that fuses two vertices 0.02 mm apart with the same UV is harmless, and if the
 * compressor had quantised attributes the comparison would have been against a
 * finer resolution than the file can even represent. (Checked: gltfpack left
 * POSITION, NORMAL and TEXCOORD_0 as float32 here and only quantised JOINTS_0
 * and WEIGHTS_0, so the resolution was not the issue — but the bluntness was.)
 *
 * A UV SEAM IS A POSITION THAT CARRIES MORE THAN ONE TEXTURE COORDINATE. That is
 * what a seam IS: the same point on the body appearing twice in the texture,
 * once on each side of the cut. Fuse those two vertices and the surface can only
 * hold one of the two UVs, so the texture stretches across the join. So:
 *
 *   count positions holding 2+ distinct UVs, before and after
 *   after == before  ->  every seam survived, the weld only fused real duplicates
 *   after <  before  ->  seams were closed, and the texture will stretch there
 *
 * Positions bucket at 1e-5 m and UVs at 1e-4, comfortably finer than a texel on
 * a 4K map and coarse enough to absorb a float32 round-trip.
 *
 * Usage: node tools/model_diag/weld_safety.mjs <original.glb> <welded.glb>
 */
import { readFileSync } from 'node:fs';
import { parseGlb } from './bind_pose.mjs';

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

/** Accessor reader that understands EXT_meshopt_compression, with a decode cache. */
async function makeReader(json, bin) {
  const cache = new Map();
  return async (index) => {
    const acc = json.accessors?.[index];
    if (!acc || acc.bufferView === undefined) return null;
    const bv = json.bufferViews[acc.bufferView];
    const comps = COMPS[acc.type], csize = CSIZE[acc.componentType];
    if (!comps || !csize) return null;
    let src = bin, viewOffset = bv.byteOffset ?? 0, stride = bv.byteStride ?? comps * csize;
    const mo = bv.extensions?.EXT_meshopt_compression;
    if (mo) {
      if (!cache.has(acc.bufferView)) cache.set(acc.bufferView, await decodeMeshopt(bin, mo));
      src = cache.get(acc.bufferView); viewOffset = 0; stride = mo.byteStride;
    } else if (bv.extensions && Object.keys(bv.extensions).length) return null;
    const start = viewOffset + (acc.byteOffset ?? 0);
    const norm = acc.normalized === true;
    const get = (at) => {
      switch (acc.componentType) {
        case 5126: return src.readFloatLE(at);
        case 5125: return src.readUInt32LE(at);
        case 5123: return norm ? src.readUInt16LE(at) / 65535 : src.readUInt16LE(at);
        case 5122: return norm ? Math.max(-1, src.readInt16LE(at) / 32767) : src.readInt16LE(at);
        case 5121: return norm ? src.readUInt8(at) / 255 : src.readUInt8(at);
        default: return norm ? Math.max(-1, src.readInt8(at) / 127) : src.readInt8(at);
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

const drawnMeshes = (json) => {
  const out = new Set();
  const walk = (i) => {
    const n = json.nodes[i];
    if (!n) return;
    if (n.mesh !== undefined) out.add(n.mesh);
    (n.children ?? []).forEach(walk);
  };
  (json.scenes?.[json.scene ?? 0]?.nodes ?? []).forEach(walk);
  return out;
};

const POS_Q = 1e5;   // 1e-5 m position buckets
const UV_Q = 1e4;    // 1e-4 uv buckets

/**
 * Per primitive: the vertex count, the triangle count, and the number of
 * POSITIONS that carry more than one distinct UV — the seam count.
 */
export async function primitiveShape(file) {
  const { json, bin } = parseGlb(readFileSync(file));
  const read = await makeReader(json, bin);
  const rows = [];
  for (const mi of drawnMeshes(json)) {
    for (const [pi, prim] of (json.meshes[mi].primitives ?? []).entries()) {
      const P = await read(prim.attributes.POSITION);
      if (!P) { rows.push({ mesh: mi, prim: pi, unreadable: true }); continue; }
      const T = prim.attributes.TEXCOORD_0 !== undefined ? await read(prim.attributes.TEXCOORD_0) : null;
      const uvsAt = new Map();
      if (T) {
        for (let i = 0; i < P.length; i++) {
          const key = P[i].map((v) => Math.round(v * POS_Q)).join(',');
          const uv = T[i].map((v) => Math.round(v * UV_Q)).join(',');
          let set = uvsAt.get(key);
          if (!set) { set = new Set(); uvsAt.set(key, set); }
          set.add(uv);
        }
      }
      let seams = 0;
      for (const set of uvsAt.values()) if (set.size > 1) seams++;
      const idx = prim.indices !== undefined ? json.accessors[prim.indices].count : P.length;
      rows.push({ mesh: mi, prim: pi, verts: P.length, tris: Math.round(idx / 3), seams, hasUv: Boolean(T), positions: uvsAt.size });
    }
  }
  return rows;
}

async function main() {
  const [before, after] = process.argv.slice(2);
  if (!before || !after) {
    console.error('usage: node tools/model_diag/weld_safety.mjs <original.glb> <welded.glb>');
    process.exitCode = 1;
    return;
  }
  const A = await primitiveShape(before);
  const B = await primitiveShape(after);
  if (A.length !== B.length) {
    console.error(`  FAIL  primitive count changed: ${A.length} -> ${B.length}`);
    process.exitCode = 1;
    return;
  }
  let broken = 0, checked = 0, unreadable = 0;
  let vBefore = 0, vAfter = 0, sBefore = 0, sAfter = 0;
  for (let i = 0; i < A.length; i++) {
    if (A[i].unreadable || B[i].unreadable) { unreadable++; continue; }
    checked++;
    vBefore += A[i].verts; vAfter += B[i].verts;
    sBefore += A[i].seams; sAfter += B[i].seams;
    if (A[i].tris !== B[i].tris) {
      console.log(`  FAIL  prim ${i}: triangles changed ${A[i].tris} -> ${B[i].tris}`);
      broken++;
      continue;
    }
    // A MISSING UV CHANNEL IS NOT A CLOSED SEAM, AND SAYING SO MATTERS.
    // gltfpack prunes TEXCOORD_0 when no material references a texture, which is
    // correct for a file whose look is baked into vertex colours and wrong for one
    // textured at RUNTIME — MAIME's face paint is assigned in code, so stripping
    // his UVs leaves a body that can never be painted. Measured: seams 2954 -> 0
    // with the attribute gone entirely, not welded shut.
    if (A[i].hasUv && !B[i].hasUv) {
      console.log(`  FAIL  prim ${i}: TEXCOORD_0 was REMOVED (${A[i].seams} seams in the source).`
        + ' Correct only if nothing textures this mesh, including at runtime.');
      broken++;
    } else if (B[i].seams < A[i].seams) {
      console.log(`  FAIL  prim ${i}: ${A[i].seams - B[i].seams} UV seam(s) closed (${A[i].seams} -> ${B[i].seams})`
        + ' — the texture will stretch across those joins');
      broken++;
    }
  }
  console.log(`\n  ${checked} primitives checked${unreadable ? `, ${unreadable} unreadable` : ''}`);
  console.log(`  vertices   ${vBefore} -> ${vAfter}`);
  console.log(`  UV seams   ${sBefore} -> ${sAfter}`);
  if (broken) {
    console.error(`\n  ${broken} primitive(s) lost geometry or seams. Do not promote this file.`);
    process.exitCode = 1;
  } else if (!checked) {
    console.error('\n  NOTHING WAS CHECKED — that is a tool failure, not a pass.');
    process.exitCode = 1;
  } else if (!sBefore) {
    console.log('\n  WELD KEPT EVERY TRIANGLE. No UV seams in the source to lose.');
  } else {
    console.log('\n  WELD IS SEAM-SAFE — every position that carried two UVs still does.');
  }
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e?.stack ?? e); process.exitCode = 1; });
}
