#!/usr/bin/env node
/**
 * DOES THE LIMB COLLAPSE DURING THE ANIMATIONS WE ACTUALLY SHIP?
 *
 * The synthetic twist test proves linear blend skinning loses volume — thigh
 * radius down to 0.29-0.49 at 180 degrees. What it cannot say is whether the
 * game ever gets there. A swing-twist decomposition suggested it does, in 74%
 * of clips, but that decomposition has a singularity near 180 degrees and will
 * report a large SWING as a large twist, so it is not evidence.
 *
 * This asks the question with no decomposition in it at all: drive the rig with
 * the REAL baked clip, skin the band of vertices around the thigh with the same
 * maths the GPU uses, and measure the radius against its own bind value. A
 * ratio near 1 means the limb held; a low one is the candy wrapper, in play.
 *
 * Usage: node tools/model_diag/lbs_in_play.mjs [model.glb] [--clips N]
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
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
    const get = (at) => acc.componentType === 5126 ? src.readFloatLE(at)
      : acc.componentType === 5125 ? src.readUInt32LE(at)
      : acc.componentType === 5123 ? src.readUInt16LE(at)
      : acc.componentType === 5122 ? src.readInt16LE(at)
      : acc.componentType === 5121 ? src.readUInt8(at) : src.readInt8(at);
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
const mul = (a, b) => {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let v = 0; for (let k = 0; k < 4; k++) v += a[k * 4 + r] * b[c * 4 + k];
    o[c * 4 + r] = v;
  }
  return o;
};
const apply = (m, p) => [
  m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
  m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
  m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
];
function trs(t, q) {
  const [x, y, z, w] = q;
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  return [
    1 - (yy + zz), xy + wz, xz - wy, 0,
    xy - wz, 1 - (xx + zz), yz + wx, 0,
    xz + wy, yz - wx, 1 - (xx + yy), 0,
    t[0], t[1], t[2], 1,
  ];
}
function invertAffine(m) {
  const r = [m[0], m[4], m[8], 0, m[1], m[5], m[9], 0, m[2], m[6], m[10], 0, 0, 0, 0, 1];
  const t = apply(r, [m[12], m[13], m[14]]);
  r[12] = -t[0]; r[13] = -t[1]; r[14] = -t[2];
  return r;
}

/**
 * DUAL QUATERNION SKINNING, for comparison.
 *
 * LBS averages MATRICES, and two matrices that differ by a rotation average to
 * something shorter than either — that is the volume loss. DQS averages the
 * ROTATIONS as quaternions instead, which cannot shorten, so the limb keeps
 * its width through the same pose. Implemented here purely to answer whether
 * it fixes the measured collapse, before any shader is written for it.
 */
function matToDualQuat(m) {
  // Rotation part -> unit quaternion (Shepperd's method, stable near 180).
  const t = m[0] + m[5] + m[10];
  let x, y, z, w;
  if (t > 0) {
    const s = Math.sqrt(t + 1) * 2;
    w = 0.25 * s; x = (m[6] - m[9]) / s; y = (m[8] - m[2]) / s; z = (m[1] - m[4]) / s;
  } else if (m[0] > m[5] && m[0] > m[10]) {
    const s = Math.sqrt(1 + m[0] - m[5] - m[10]) * 2;
    w = (m[6] - m[9]) / s; x = 0.25 * s; y = (m[4] + m[1]) / s; z = (m[8] + m[2]) / s;
  } else if (m[5] > m[10]) {
    const s = Math.sqrt(1 + m[5] - m[0] - m[10]) * 2;
    w = (m[8] - m[2]) / s; x = (m[4] + m[1]) / s; y = 0.25 * s; z = (m[9] + m[6]) / s;
  } else {
    const s = Math.sqrt(1 + m[10] - m[0] - m[5]) * 2;
    w = (m[1] - m[4]) / s; x = (m[8] + m[2]) / s; y = (m[9] + m[6]) / s; z = 0.25 * s;
  }
  const tx = m[12], ty = m[13], tz = m[14];
  // dual = 0.5 * t * r
  const dw = -0.5 * (tx * x + ty * y + tz * z);
  const dx = 0.5 * (tx * w + ty * z - tz * y);
  const dy = 0.5 * (-tx * z + ty * w + tz * x);
  const dz = 0.5 * (tx * y - ty * x + tz * w);
  return [x, y, z, w, dx, dy, dz, dw];
}
function dqsPoint(dqs, idx, wts, p) {
  let r = [0, 0, 0, 0], d = [0, 0, 0, 0];
  let pivot = null;
  for (let c = 0; c < 4; c++) {
    const w = wts[c];
    if (w <= 0) continue;
    const q = dqs[idx[c]];
    if (!pivot) pivot = q;
    // Antipodality: a quaternion on the far hemisphere must be negated or the
    // blend cancels itself out — the same q vs -q trap as everywhere else.
    const sign = (q[0] * pivot[0] + q[1] * pivot[1] + q[2] * pivot[2] + q[3] * pivot[3]) < 0 ? -w : w;
    for (let k = 0; k < 4; k++) { r[k] += q[k] * sign; d[k] += q[k + 4] * sign; }
  }
  const len = Math.hypot(r[0], r[1], r[2], r[3]) || 1;
  for (let k = 0; k < 4; k++) { r[k] /= len; d[k] /= len; }
  // Apply: v' = v + 2*cross(r.xyz, cross(r.xyz, v) + r.w*v) + trans
  const [rx, ry, rz, rw] = r;
  const c1 = [ry * p[2] - rz * p[1] + rw * p[0], rz * p[0] - rx * p[2] + rw * p[1], rx * p[1] - ry * p[0] + rw * p[2]];
  const c2 = [ry * c1[2] - rz * c1[1], rz * c1[0] - rx * c1[2], rx * c1[1] - ry * c1[0]];
  const rot = [p[0] + 2 * c2[0], p[1] + 2 * c2[1], p[2] + 2 * c2[2]];
  const tr = [
    2 * (-d[3] * rx + d[0] * rw - d[1] * rz + d[2] * ry),
    2 * (-d[3] * ry + d[0] * rz + d[1] * rw - d[2] * rx),
    2 * (-d[3] * rz - d[0] * ry + d[1] * rx + d[2] * rw),
  ];
  return [rot[0] + tr[0], rot[1] + tr[1], rot[2] + tr[2]];
}

export async function measureInPlay(file, clipNames, jointRe = /UpLeg$/i, mode = 'lbs') {
  const { json, bin } = parseGlb(readFileSync(file));
  const read = await makeReader(json, bin);
  const skin = json.skins[0];
  const ibms = await read(skin.inverseBindMatrices);
  if (!ibms) return null;
  const names = skin.joints.map((n) => json.nodes[n]?.name ?? '');
  const bindWorld = ibms.map(invertAffine);
  const parentNode = new Map();
  json.nodes.forEach((n, i) => (n.children ?? []).forEach((c) => parentNode.set(c, i)));
  const jointIndexOf = new Map();
  skin.joints.forEach((n, i) => jointIndexOf.set(n, i));
  const parentOf = skin.joints.map((n) => {
    const p = parentNode.get(n);
    return p !== undefined && jointIndexOf.has(p) ? jointIndexOf.get(p) : -1;
  });
  // Bind LOCAL transforms, so a clip's rotation can replace the rotation only.
  const localBind = skin.joints.map((n, i) => {
    const p = parentOf[i];
    return p < 0 ? bindWorld[i] : mul(invertAffine(bindWorld[p]), bindWorld[i]);
  });
  const localT = localBind.map((m) => [m[12], m[13], m[14]]);

  const child = names.findIndex((n) => jointRe.test(n));
  if (child < 0) return null;
  const parent = parentOf[child];
  if (parent < 0) return null;
  const a = [bindWorld[parent][12], bindWorld[parent][13], bindWorld[parent][14]];
  const b = [bindWorld[child][12], bindWorld[child][13], bindWorld[child][14]];
  const axis = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(...axis) || 1;
  const unit = axis.map((v) => v / len);
  const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];

  const node = json.nodes.find((n) => n.mesh !== undefined && n.skin !== undefined);
  const prim = json.meshes[node.mesh].primitives[0];
  const P = await read(prim.attributes.POSITION);
  const J = await read(prim.attributes.JOINTS_0);
  const W = await read(prim.attributes.WEIGHTS_0);
  if (!P || !J || !W) return null;

  const band = [];
  for (let i = 0; i < P.length; i++) {
    const d = [P[i][0] - mid[0], P[i][1] - mid[1], P[i][2] - mid[2]];
    const along = d[0] * unit[0] + d[1] * unit[1] + d[2] * unit[2];
    if (Math.abs(along) > len * 0.3) continue;
    let touches = 0;
    for (let c = 0; c < 4; c++) if (W[i][c] > 0.01 && J[i][c] === child) touches += W[i][c];
    if (touches < 0.2) continue;
    band.push(i);
  }
  if (band.length < 30) return null;

  const radiusOf = (skinMat) => {
    const dqs = mode === 'dqs' ? skinMat.map(matToDualQuat) : null;
    let sum = 0;
    for (const i of band) {
      let x = 0, y = 0, z = 0;
      if (dqs) {
        const p = dqsPoint(dqs, J[i], W[i], P[i]);
        x = p[0]; y = p[1]; z = p[2];
      } else
      for (let c = 0; c < 4; c++) {
        const w = W[i][c];
        if (w <= 0) continue;
        const p = apply(skinMat[J[i][c]], P[i]);
        x += p[0] * w; y += p[1] * w; z += p[2] * w;
      }
      const d = [x - mid[0], y - mid[1], z - mid[2]];
      const al = d[0] * unit[0] + d[1] * unit[1] + d[2] * unit[2];
      sum += Math.hypot(d[0] - unit[0] * al, d[1] - unit[1] * al, d[2] - unit[2] * al);
    }
    return sum / band.length;
  };
  const base = radiusOf(ibms.map((m, i) => mul(bindWorld[i], m)));

  const rows = [];
  for (const clipName of clipNames) {
    let clip;
    try { clip = JSON.parse(readFileSync(join('public/motion/baked', `${clipName}.json`), 'utf8')); } catch { continue; }
    const tracks = clip.tracks ?? {};
    const keyCount = Math.max(...Object.values(tracks).map((t) => (t?.q?.length ?? 0) / 4), 0);
    if (!keyCount) continue;
    let worst = 1;
    for (let k = 0; k < keyCount; k += Math.max(1, Math.floor(keyCount / 24))) {
      const world = new Array(names.length);
      for (let i = 0; i < names.length; i++) {
        const t = tracks[names[i].replace(':', '')] ?? tracks[names[i]];
        const q = t?.q && t.q.length >= (k + 1) * 4
          ? [t.q[k * 4], t.q[k * 4 + 1], t.q[k * 4 + 2], t.q[k * 4 + 3]]
          : null;
        const local = q ? trs(localT[i], q) : localBind[i];
        world[i] = parentOf[i] < 0 ? local : mul(world[parentOf[i]], local);
      }
      const r = radiusOf(world.map((m, i) => mul(m, ibms[i])));
      worst = Math.min(worst, r / base);
    }
    rows.push({ clip: clipName, worst: +worst.toFixed(3) });
  }
  return { joint: names[child], band: band.length, rows };
}

async function main() {
  const file = process.argv[2]?.endsWith('.glb') ? process.argv[2] : 'public/models/TITAN.glb';
  const n = Number(process.argv[process.argv.indexOf('--clips') + 1]) || 60;
  const clips = readdirSync('public/motion/baked')
    .filter((f) => f.endsWith('.json') && f !== 'index.json').slice(0, n)
    .map((f) => f.replace('.json', ''));
  const r = await measureInPlay(file, clips);
  if (!r) { console.log('could not measure'); return; }
  r.rows.sort((a, b) => a.worst - b.worst);
  const vals = r.rows.map((x) => x.worst);
  const q = (p) => vals[Math.floor(vals.length * p)];
  console.log(`\nLBS IN PLAY — ${file.split('/').pop()}  joint ${r.joint}  (${r.band} vertices)\n`);
  console.log(`  clips measured: ${vals.length}`);
  console.log(`  worst thigh radius as a fraction of bind:`);
  console.log(`    p05 ${q(0.05)?.toFixed(2)}   median ${q(0.5)?.toFixed(2)}   p95 ${q(0.95)?.toFixed(2)}`);
  console.log(`  clips that pinch below 0.85: ${vals.filter((v) => v < 0.85).length}`
    + `   below 0.70: ${vals.filter((v) => v < 0.70).length}`);
  console.log('\n  worst offenders:');
  for (const row of r.rows.slice(0, 8)) console.log(`    ${row.clip.padEnd(30).slice(0, 30)} ${row.worst.toFixed(2)}`);
}
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e?.stack ?? e); process.exitCode = 1; });
}
