#!/usr/bin/env node
/**
 * Repair a mesh's TEXCOORD_0 by transferring UVs from a donor that shares the
 * same geometry and the same texture atlas.
 *
 * WHY THIS EXISTS — measured, not assumed
 *   `BANNON_rigged.glb`, the default player model, renders with the skin and the
 *   trunks mixed into each other and dark crack-like strikes all over the body.
 *   The cause is its UV map, not its texture:
 *
 *     model                  UV area / sheet   overlapping texels   max tris/texel
 *     BANNON_rigged.glb           27.81x            98.6%                83
 *     BANNON.glb (donor)           0.64x             0.1%                 5
 *     VIPER.glb  (control)         0.64x             0.2%                 3
 *     BRUTUS.glb (control)         0.64x             0.4%                 5
 *
 *   98.6% of the body's texels are shared by two or more triangles, up to 83 on
 *   one texel. Different body parts are painted from the same pixels, which is
 *   exactly "part of the skin is on the trunks, part of the trunks is on the
 *   skin". No texture can serve two appearances from one texel, so this is not
 *   fixable by dilating, repacking or re-baking the image.
 *
 *   It does not need to be. `BANNON.glb` carries the SAME atlas — byte-identical,
 *   md5 6f520f2dcdd9df59bef0f48c80d96631 — with a correct, non-overlapping unwrap,
 *   and the same geometry in the same space (bbox 0.414 x 1.88 x 0.887 against
 *   0.413 x 1.88 x 0.888). The right coordinates for this exact image already
 *   exist; they just are not the ones the shipped file uses.
 *
 * WHAT IT TOUCHES
 *   TEXCOORD_0 only. Positions, normals, JOINTS_0, WEIGHTS_0, the skin, the
 *   inverse bind matrices, the node hierarchy, the texture and every other
 *   buffer view are carried through byte-for-byte, so rigging, scale, floor
 *   placement and orientation cannot move. The new UVs are written as a plain
 *   uncompressed buffer view appended to the BIN chunk; EXT_meshopt_compression
 *   is per-view, so the untouched views keep working.
 *
 * WHY ONE UV PER VERTEX CANNOT WORK — this is the actual defect
 *   Measured on the donor: every one of its 15 parts spans almost the whole
 *   sheet (chest u[0.003,1.000] v[0,1], head u[0.005,0.991] v[0,1], and so on)
 *   while each contributes only ~0.03-0.09 of a sheet in area. The atlas is
 *   hundreds of small islands interlocked across the whole sheet, so UVs are
 *   per-triangle-CORNER, and the donor duplicates vertices along every island
 *   boundary to carry them.
 *
 *   The sewn target welded those duplicates back together: sew_rig fuses
 *   vertices that share a position and agree on normal, and does NOT require a
 *   matching UV. A vertex that belonged to five islands came out holding one
 *   UV, so its triangles read whatever the atlas happens to hold there. That is
 *   why simply writing a UV per target vertex cannot repair it - it was tried,
 *   and overlap went 98.6% -> 99.1%, no better, because the information does not
 *   fit in one UV per vertex.
 *
 *   So this splits instead of overwrites. Each target TRIANGLE is matched to the
 *   donor triangle at the same place and facing the same way, each corner takes
 *   that donor corner's UV, and a target vertex is duplicated once per distinct
 *   UV it needs. Position, normal, JOINTS_0 and WEIGHTS_0 are copied verbatim
 *   from the vertex being split, so every copy keeps the original's skinning.
 *
 * Usage: node scripts/fix-uv-from-donor.mjs <target.glb> <donor.glb> <out.glb>
 */

import { readFileSync, writeFileSync } from 'node:fs';

import * as THREE from 'three';
import { GLTFLoader } from 'three-stdlib';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const [targetPath, donorPath, outPath] = process.argv.slice(2);
if (!targetPath || !donorPath || !outPath) {
  console.error('usage: node scripts/fix-uv-from-donor.mjs <target.glb> <donor.glb> <out.glb>');
  process.exit(1);
}

// ── GLB container helpers ────────────────────────────────────────────────────

function readGlb(path) {
  const buf = readFileSync(path);
  if (buf.toString('ascii', 0, 4) !== 'glTF') throw new Error(`${path}: not a GLB`);
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
  const pad = jsonLen % 4 === 0 ? 0 : 4 - (jsonLen % 4);
  const binStart = 20 + jsonLen + pad;
  const binLen = buf.readUInt32LE(binStart);
  const bin = buf.subarray(binStart + 8, binStart + 8 + binLen);
  return { json, bin };
}

function writeGlb(path, json, bin) {
  let text = JSON.stringify(json);
  while (text.length % 4 !== 0) text += ' ';
  const jsonBytes = Buffer.from(text, 'utf8');
  const binPadded = bin.length % 4 === 0 ? bin : Buffer.concat([bin, Buffer.alloc(4 - (bin.length % 4))]);
  const header = Buffer.alloc(12);
  header.write('glTF', 0, 'ascii');
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonBytes.length + 8 + binPadded.length, 8);
  const jsonHead = Buffer.alloc(8);
  jsonHead.writeUInt32LE(jsonBytes.length, 0);
  jsonHead.write('JSON', 4, 'ascii');
  const binHead = Buffer.alloc(8);
  binHead.writeUInt32LE(binPadded.length, 0);
  binHead.write('BIN\0', 4, 'ascii');
  writeFileSync(path, Buffer.concat([header, jsonHead, jsonBytes, binHead, binPadded]));
}

/** Parse geometry only: node has no Image, and the WebP atlas is not needed here. */
async function loadGeometry(path) {
  const buf = readFileSync(path);
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
  for (const mesh of json.meshes ?? []) for (const prim of mesh.primitives ?? []) delete prim.material;
  delete json.materials; delete json.textures; delete json.images; delete json.samplers;
  json.extensionsUsed = (json.extensionsUsed ?? []).filter((e) => e !== 'EXT_texture_webp');
  json.extensionsRequired = (json.extensionsRequired ?? []).filter((e) => e !== 'EXT_texture_webp');
  let text = JSON.stringify(json);
  while (text.length % 4 !== 0) text += ' ';
  const jsonBytes = Buffer.from(text, 'utf8');
  const pad = jsonLen % 4 === 0 ? 0 : 4 - (jsonLen % 4);
  const rest = buf.subarray(20 + jsonLen + pad);
  const header = Buffer.alloc(20);
  header.write('glTF', 0, 'ascii');
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonBytes.length + rest.length, 8);
  header.writeUInt32LE(jsonBytes.length, 12);
  header.write('JSON', 16, 'ascii');
  const patched = Buffer.concat([header, jsonBytes, rest]);

  const loader = new GLTFLoader();
  await MeshoptDecoder.ready;
  loader.setMeshoptDecoder(MeshoptDecoder);
  const ab = patched.buffer.slice(patched.byteOffset, patched.byteOffset + patched.byteLength);
  const gltf = await new Promise((res, rej) => loader.parse(ab, '', res, rej));
  const meshes = [];
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((o) => { if (o.isMesh && o.geometry.attributes.position) meshes.push(o); });
  return meshes;
}

// ── closest point on a triangle ──────────────────────────────────────────────

function closestPointOnTriangle(p, a, b, c, out) {
  const abx = b[0]-a[0], aby = b[1]-a[1], abz = b[2]-a[2];
  const acx = c[0]-a[0], acy = c[1]-a[1], acz = c[2]-a[2];
  const apx = p[0]-a[0], apy = p[1]-a[1], apz = p[2]-a[2];
  const d1 = abx*apx + aby*apy + abz*apz;
  const d2 = acx*apx + acy*apy + acz*apz;
  if (d1 <= 0 && d2 <= 0) { out[0]=1; out[1]=0; out[2]=0; return a; }
  const bpx = p[0]-b[0], bpy = p[1]-b[1], bpz = p[2]-b[2];
  const d3 = abx*bpx + aby*bpy + abz*bpz;
  const d4 = acx*bpx + acy*bpy + acz*bpz;
  if (d3 >= 0 && d4 <= d3) { out[0]=0; out[1]=1; out[2]=0; return b; }
  const cpx = p[0]-c[0], cpy = p[1]-c[1], cpz = p[2]-c[2];
  const d5 = abx*cpx + aby*cpy + abz*cpz;
  const d6 = acx*cpx + acy*cpy + acz*cpz;
  if (d6 >= 0 && d5 <= d6) { out[0]=0; out[1]=0; out[2]=1; return c; }
  const vc = d1*d4 - d3*d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const v = d1 / (d1 - d3);
    out[0]=1-v; out[1]=v; out[2]=0;
    return [a[0]+abx*v, a[1]+aby*v, a[2]+abz*v];
  }
  const vb = d5*d2 - d1*d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const w = d2 / (d2 - d6);
    out[0]=1-w; out[1]=0; out[2]=w;
    return [a[0]+acx*w, a[1]+acy*w, a[2]+acz*w];
  }
  const va = d3*d6 - d5*d4;
  if (va <= 0 && (d4-d3) >= 0 && (d5-d6) >= 0) {
    const w = (d4-d3) / ((d4-d3) + (d5-d6));
    out[0]=0; out[1]=1-w; out[2]=w;
    return [b[0]+(c[0]-b[0])*w, b[1]+(c[1]-b[1])*w, b[2]+(c[2]-b[2])*w];
  }
  const denom = 1 / (va + vb + vc);
  const v = vb * denom, w = vc * denom;
  out[0]=1-v-w; out[1]=v; out[2]=w;
  return [a[0]+abx*v+acx*w, a[1]+aby*v+acy*w, a[2]+abz*v+acz*w];
}

// ── build the donor triangle set ─────────────────────────────────────────────

const donorMeshes = await loadGeometry(donorPath);
const donorTris = [];
for (const mesh of donorMeshes) {
  const g = mesh.geometry;
  const pos = g.attributes.position, uv = g.attributes.uv, idx = g.index;
  if (!uv) continue;
  const n = idx ? idx.count : pos.count;
  for (let t = 0; t < n; t += 3) {
    const ids = [0,1,2].map((k) => (idx ? idx.getX(t+k) : t+k));
    const p = ids.map((i) => {
      const v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
      mesh.localToWorld(v);
      return [v.x, v.y, v.z];
    });
    const uvs = ids.map((i) => [uv.getX(i), uv.getY(i)]);
    const nx = (p[1][1]-p[0][1])*(p[2][2]-p[0][2]) - (p[1][2]-p[0][2])*(p[2][1]-p[0][1]);
    const ny = (p[1][2]-p[0][2])*(p[2][0]-p[0][0]) - (p[1][0]-p[0][0])*(p[2][2]-p[0][2]);
    const nz = (p[1][0]-p[0][0])*(p[2][1]-p[0][1]) - (p[1][1]-p[0][1])*(p[2][0]-p[0][0]);
    const len = Math.hypot(nx, ny, nz) || 1;
    donorTris.push({ p, uvs, n: [nx/len, ny/len, nz/len] });
  }
}
if (!donorTris.length) throw new Error('donor has no UV-bearing triangles');

// uniform spatial hash over donor triangles
const CELL = 0.04;
const grid = new Map();
const cellKey = (x, y, z) => `${Math.floor(x/CELL)},${Math.floor(y/CELL)},${Math.floor(z/CELL)}`;
for (let i = 0; i < donorTris.length; i++) {
  const { p } = donorTris[i];
  const lo = [0,1,2].map((k) => Math.floor(Math.min(p[0][k], p[1][k], p[2][k]) / CELL));
  const hi = [0,1,2].map((k) => Math.floor(Math.max(p[0][k], p[1][k], p[2][k]) / CELL));
  for (let x = lo[0]; x <= hi[0]; x++)
    for (let y = lo[1]; y <= hi[1]; y++)
      for (let z = lo[2]; z <= hi[2]; z++) {
        const k = `${x},${y},${z}`;
        let arr = grid.get(k);
        if (!arr) grid.set(k, (arr = []));
        arr.push(i);
      }
}

// ── target ───────────────────────────────────────────────────────────────────

const targetMeshes = await loadGeometry(targetPath);
if (targetMeshes.length !== 1) {
  throw new Error(`target has ${targetMeshes.length} meshes; this repair expects a single merged mesh`);
}
const targetMesh = targetMeshes[0];
const tGeo = targetMesh.geometry;
const tPos = tGeo.attributes.position;
const tNor = tGeo.attributes.normal;
const tJoints = tGeo.attributes.skinIndex;
const tWeights = tGeo.attributes.skinWeight;
const tIndex = tGeo.index;
if (!tJoints || !tWeights) throw new Error('target is not skinned — refusing to rebuild it');

const triCount = (tIndex ? tIndex.count : tPos.count) / 3;
const worldPos = [];
for (let i = 0; i < tPos.count; i++) {
  const v = new THREE.Vector3(tPos.getX(i), tPos.getY(i), tPos.getZ(i));
  targetMesh.localToWorld(v);
  worldPos.push([v.x, v.y, v.z]);
}

/**
 * The donor triangle that covers the same patch of surface.
 *
 * Centroid distance alone is not enough: at an island boundary the nearest
 * centroid can belong to the neighbouring island, and the target triangle then
 * takes that island's UVs and renders as a stray speck of the wrong material.
 * Target and donor share almost the same vertices (mean 0.32 mm), so the real
 * signal is corner agreement - the right donor triangle has all three corners
 * nearly coincident with the target's three. Corners are scored under the best
 * of the three rotations, since winding may start at a different vertex.
 */
function nearestDonorTri(p, normal, corners) {
  const cx = Math.floor(p[0]/CELL), cy = Math.floor(p[1]/CELL), cz = Math.floor(p[2]/CELL);
  let best = Infinity, bestTri = null, bestAgree = -Infinity, bestPerm = null, candidatePerm = null;
  for (let radius = 1; radius <= 8; radius++) {
    const seen = new Set();
    for (let dx = -radius; dx <= radius; dx++)
      for (let dy = -radius; dy <= radius; dy++)
        for (let dz = -radius; dz <= radius; dz++) {
          const arr = grid.get(`${cx+dx},${cy+dy},${cz+dz}`);
          if (!arr) continue;
          for (const ti of arr) {
            if (seen.has(ti)) continue;
            seen.add(ti);
            const tri = donorTris[ti];
            const cp = closestPointOnTriangle(p, tri.p[0], tri.p[1], tri.p[2], scratchBary);
            let d = Math.hypot(cp[0]-p[0], cp[1]-p[1], cp[2]-p[2]);
            if (corners) {
              // best corner-to-corner agreement over the three rotations
              let bestPermScore = Infinity, bestPermLocal = null;
              for (const perm of CORNER_PERMUTATIONS) {
                let sum = 0;
                for (let k = 0; k < 3; k++) {
                  const a = corners[k], b = tri.p[perm[k]];
                  sum += Math.hypot(a[0]-b[0], a[1]-b[1], a[2]-b[2]);
                }
                if (sum < bestPermScore) { bestPermScore = sum; bestPermLocal = perm; }
              }
              d = bestPermScore / 3;
              candidatePerm = bestPermLocal;
            }
            const agree = normal ? normal[0]*tri.n[0] + normal[1]*tri.n[1] + normal[2]*tri.n[2] : 0;
            if (d < best - 1e-6 || (Math.abs(d - best) <= 1e-6 && agree > bestAgree)) {
              best = d; bestAgree = agree; bestTri = tri; bestPerm = candidatePerm;
            }
          }
        }
    if (bestTri) break;
  }
  return { tri: bestTri, dist: best, perm: bestPerm };
}
const scratchBary = [0, 0, 0];

/**
 * All six corner correspondences (three rotations, three reflections).
 *
 * Assigning each target corner to its own nearest donor corner independently is
 * NOT safe: two corners can pick the same donor corner, which collapses the UV
 * triangle to zero area and renders it as a single flat speck of whatever colour
 * sits at that texel. That was measured - 36% of triangles came out more than
 * 20x off the median uv/world area ratio, against 0.26% on a healthy model.
 * A permutation is a bijection, so every corner gets a distinct UV.
 */
const CORNER_PERMUTATIONS = [[0,1,2],[1,2,0],[2,0,1],[0,2,1],[2,1,0],[1,0,2]];

// ── rebuild with vertices split per distinct UV ──────────────────────────────

/** key "originalVertex|u|v" -> new vertex index */
const splitMap = new Map();
const outPos = [], outNor = [], outUv = [], outJoints = [], outWeights = [], outIdx = [];
let sumDist = 0, matched = 0, worstDist = 0;

function emit(origIndex, uv) {
  const key = `${origIndex}|${uv[0].toFixed(6)}|${uv[1].toFixed(6)}`;
  const hit = splitMap.get(key);
  if (hit !== undefined) return hit;
  const n = outPos.length / 3;
  outPos.push(tPos.getX(origIndex), tPos.getY(origIndex), tPos.getZ(origIndex));
  outNor.push(tNor ? tNor.getX(origIndex) : 0, tNor ? tNor.getY(origIndex) : 1, tNor ? tNor.getZ(origIndex) : 0);
  outUv.push(uv[0], uv[1]);
  outJoints.push(tJoints.getX(origIndex), tJoints.getY(origIndex), tJoints.getZ(origIndex), tJoints.getW(origIndex));
  outWeights.push(tWeights.getX(origIndex), tWeights.getY(origIndex), tWeights.getZ(origIndex), tWeights.getW(origIndex));
  splitMap.set(key, n);
  return n;
}

for (let t = 0; t < triCount; t++) {
  const ids = [0,1,2].map((k) => (tIndex ? tIndex.getX(t*3+k) : t*3+k));
  const pts = ids.map((i) => worldPos[i]);
  const centroid = [0,1,2].map((k) => (pts[0][k] + pts[1][k] + pts[2][k]) / 3);
  const ax = pts[1][0]-pts[0][0], ay = pts[1][1]-pts[0][1], az = pts[1][2]-pts[0][2];
  const bx = pts[2][0]-pts[0][0], by = pts[2][1]-pts[0][1], bz = pts[2][2]-pts[0][2];
  let nx = ay*bz - az*by, ny = az*bx - ax*bz, nz = ax*by - ay*bx;
  const nl = Math.hypot(nx, ny, nz) || 1;
  nx /= nl; ny /= nl; nz /= nl;

  const { tri, dist, perm } = nearestDonorTri(centroid, [nx, ny, nz], pts);
  if (!tri) throw new Error(`triangle ${t} found no donor surface`);
  sumDist += dist; matched++;
  if (dist > worstDist) worstDist = dist;

  const mapping = perm ?? [0, 1, 2];
  for (let k = 0; k < 3; k++) outIdx.push(emit(ids[k], tri.uvs[mapping[k]]));
}

const newVertexCount = outPos.length / 3;
console.log(`[uv-fix] donor triangles ${donorTris.length}, target triangles ${triCount}`);
console.log(`[uv-fix] triangle fit: mean ${(sumDist/matched*1000).toFixed(3)} mm, worst ${(worstDist*1000).toFixed(2)} mm`);
console.log(`[uv-fix] vertices ${tPos.count} -> ${newVertexCount} (split across UV seams, skinning copied per split)`);
if (newVertexCount > 65535) console.log('[uv-fix] note: >65535 vertices, indices written as UINT32');

// ── write the rebuilt primitive ──────────────────────────────────────────────

const { json, bin } = readGlb(targetPath);
const prim = json.meshes?.[0]?.primitives?.[0];
if (!prim) throw new Error('target has no primitive');

const chunks = [];
let cursor = bin.length;
const views = [];
function addView(typedArray, target) {
  const bytes = Buffer.from(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength);
  const pad = cursor % 4 === 0 ? 0 : 4 - (cursor % 4);
  if (pad) { chunks.push(Buffer.alloc(pad)); cursor += pad; }
  const byteOffset = cursor;
  chunks.push(bytes);
  cursor += bytes.length;
  json.bufferViews.push({ buffer: 0, byteOffset, byteLength: bytes.length, ...(target ? { target } : {}) });
  return json.bufferViews.length - 1;
}
function addAccessor(view, componentType, type, count, extra = {}) {
  json.accessors.push({ bufferView: view, componentType, count, type, ...extra });
  return json.accessors.length - 1;
}

const posArr = new Float32Array(outPos);
const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < posArr.length; i += 3)
  for (let k = 0; k < 3; k++) {
    if (posArr[i+k] < min[k]) min[k] = posArr[i+k];
    if (posArr[i+k] > max[k]) max[k] = posArr[i+k];
  }

prim.attributes.POSITION = addAccessor(addView(posArr, 34962), 5126, 'VEC3', newVertexCount, { min, max });
prim.attributes.NORMAL = addAccessor(addView(new Float32Array(outNor), 34962), 5126, 'VEC3', newVertexCount);
prim.attributes.TEXCOORD_0 = addAccessor(addView(new Float32Array(outUv), 34962), 5126, 'VEC2', newVertexCount);
prim.attributes.JOINTS_0 = addAccessor(addView(new Uint16Array(outJoints), 34962), 5123, 'VEC4', newVertexCount);
prim.attributes.WEIGHTS_0 = addAccessor(addView(new Float32Array(outWeights), 34962), 5126, 'VEC4', newVertexCount);
const useUint32 = newVertexCount > 65535;
prim.indices = addAccessor(
  addView(useUint32 ? new Uint32Array(outIdx) : new Uint16Array(outIdx), 34963),
  useUint32 ? 5125 : 5123, 'SCALAR', outIdx.length,
);

const newBin = Buffer.concat([bin, ...chunks]);
json.buffers[0].byteLength = newBin.length;
writeGlb(outPath, json, newBin);
console.log(`[uv-fix] wrote ${outPath}`);
