#!/usr/bin/env node
/**
 * DOES THE LIMB COLLAPSE WHEN IT TWISTS? (the "candy wrapper")
 *
 * Owner: "get all the bugs with model stretching and tearing fixed."
 *
 * Three measurements have now cleared the RIG: the rendered bodies carry zero
 * cross-body weights, bone-segment distances are the same on the models he
 * reports and the ones he does not, and every quaternion interpolation in the
 * repo already slerps. What is left is the skinning METHOD itself.
 *
 * Linear blend skinning averages bone MATRICES. Two matrices that differ by a
 * rotation average to something SHORTER than either — so a vertex weighted
 * between a forearm and a wrist is pulled toward the bone axis as the wrist
 * twists, and the limb pinches to a point near 180 degrees. It is the standard
 * failure of the method, it is invisible in bind pose, and no amount of
 * re-rigging fixes it, which is exactly the shape of a defect that survives
 * every check this project has thrown at it.
 *
 * THE MEASUREMENT. Twist one joint about its own bone axis, skin the mesh by
 * hand with the same maths the GPU uses, and watch the RADIUS of the limb at
 * the midpoint of that bone. A method that preserves volume holds the radius;
 * LBS loses it. Reported as a fraction of the untwisted radius, so it is
 * comparable across models of different sizes.
 *
 * Usage: node tools/model_diag/lbs_twist.mjs [glb...]
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
    const comps = COMPS[acc.type];
    const csize = CSIZE[acc.componentType];
    if (!comps || !csize) return null;
    let src = bin;
    let viewOffset = bv.byteOffset ?? 0;
    let stride = bv.byteStride ?? comps * csize;
    const mo = bv.extensions?.EXT_meshopt_compression;
    if (mo) {
      if (!cache.has(acc.bufferView)) cache.set(acc.bufferView, await decodeMeshopt(bin, mo));
      src = cache.get(acc.bufferView); viewOffset = 0; stride = mo.byteStride;
    } else if (bv.extensions && Object.keys(bv.extensions).length) return null;
    const start = viewOffset + (acc.byteOffset ?? 0);
    const get = (at) => {
      switch (acc.componentType) {
        case 5126: return src.readFloatLE(at);
        case 5125: return src.readUInt32LE(at);
        case 5123: return src.readUInt16LE(at);
        case 5122: return src.readInt16LE(at);
        case 5121: return src.readUInt8(at);
        default: return src.readInt8(at);
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

// ── 4x4 column-major helpers ────────────────────────────────────────────────
const mul = (a, b) => {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let v = 0;
    for (let k = 0; k < 4; k++) v += a[k * 4 + r] * b[c * 4 + k];
    o[c * 4 + r] = v;
  }
  return o;
};
const apply = (m, p) => [
  m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
  m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
  m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
];
/** Rotation of `deg` about a unit axis, translated to pivot through `at`. */
function rotationAbout(axis, deg, at) {
  const [x, y, z] = axis;
  const t = (deg * Math.PI) / 180;
  const c = Math.cos(t), s = Math.sin(t), k = 1 - c;
  const R = [
    c + x * x * k, y * x * k + z * s, z * x * k - y * s, 0,
    x * y * k - z * s, c + y * y * k, z * y * k + x * s, 0,
    x * z * k + y * s, y * z * k - x * s, c + z * z * k, 0,
    0, 0, 0, 1,
  ];
  const back = apply(R, [-at[0], -at[1], -at[2]]);
  R[12] = at[0] + back[0]; R[13] = at[1] + back[1]; R[14] = at[2] + back[2];
  return R;
}
function invert(m) {
  // Affine inverse: transpose the 3x3, negate the translation through it.
  const r = [
    m[0], m[4], m[8], 0,
    m[1], m[5], m[9], 0,
    m[2], m[6], m[10], 0,
    0, 0, 0, 1,
  ];
  const t = apply(r, [m[12], m[13], m[14]]);
  r[12] = -t[0]; r[13] = -t[1]; r[14] = -t[2];
  return r;
}

/** Twist one joint about its own bone axis and report how the limb's radius holds. */
export async function measureTwist(file, jointPattern, angles = [0, 45, 90, 135, 180]) {
  const { json, bin } = parseGlb(readFileSync(file));
  if (!json.skins?.length) return null;
  const read = await makeReader(json, bin);
  const skin = json.skins[0];
  const ibms = await read(skin.inverseBindMatrices);
  if (!ibms) return null;
  const names = skin.joints.map((n) => json.nodes[n]?.name ?? '');
  const bindWorld = ibms.map(invert);

  const child = names.findIndex((n) => jointPattern.test(n));
  if (child < 0) return null;
  // Its parent inside the skin, for the bone axis and the pivot.
  const parentNode = new Map();
  json.nodes.forEach((n, i) => (n.children ?? []).forEach((c) => parentNode.set(c, i)));
  const jointIndexOf = new Map();
  skin.joints.forEach((n, i) => jointIndexOf.set(n, i));
  const pNode = parentNode.get(skin.joints[child]);
  const parent = pNode !== undefined ? jointIndexOf.get(pNode) : undefined;
  if (parent === undefined) return null;

  const a = [bindWorld[parent][12], bindWorld[parent][13], bindWorld[parent][14]];
  const b = [bindWorld[child][12], bindWorld[child][13], bindWorld[child][14]];
  const axis = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(...axis);
  if (len < 1e-4) return null;
  const unit = axis.map((v) => v / len);
  const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];

  // Descendants of the twisted joint move with it.
  const moves = new Set([child]);
  let grew = true;
  while (grew) {
    grew = false;
    for (let i = 0; i < skin.joints.length; i++) {
      if (moves.has(i)) continue;
      const pn = parentNode.get(skin.joints[i]);
      const pi = pn !== undefined ? jointIndexOf.get(pn) : undefined;
      if (pi !== undefined && moves.has(pi)) { moves.add(i); grew = true; }
    }
  }

  const node = json.nodes.find((n) => n.mesh !== undefined && n.skin !== undefined);
  const prim = json.meshes[node.mesh].primitives[0];
  const P = await read(prim.attributes.POSITION);
  const J = await read(prim.attributes.JOINTS_0);
  const W = await read(prim.attributes.WEIGHTS_0);
  if (!P || !J || !W) return null;

  // The band of vertices around the middle of this bone — where the pinch is.
  const band = [];
  for (let i = 0; i < P.length; i++) {
    const d = [P[i][0] - mid[0], P[i][1] - mid[1], P[i][2] - mid[2]];
    const along = d[0] * unit[0] + d[1] * unit[1] + d[2] * unit[2];
    if (Math.abs(along) > len * 0.25) continue;
    let touches = 0;
    for (let c = 0; c < 4; c++) if (W[i][c] > 0.01 && moves.has(J[i][c])) touches += W[i][c];
    if (touches < 0.2) continue;   // must be driven by the twisting chain
    band.push(i);
  }
  if (band.length < 30) return null;

  const radii = [];
  for (const deg of angles) {
    const R = rotationAbout(unit, deg, b);
    const world = bindWorld.map((m, i) => (moves.has(i) ? mul(R, m) : m));
    const skinMat = world.map((m, i) => mul(m, ibms[i]));
    let sum = 0;
    for (const i of band) {
      let x = 0, y = 0, z = 0;
      for (let c = 0; c < 4; c++) {
        const w = W[i][c];
        if (w <= 0) continue;
        const p = apply(skinMat[J[i][c]], P[i]);
        x += p[0] * w; y += p[1] * w; z += p[2] * w;
      }
      // Radius = distance from the bone axis.
      const d = [x - mid[0], y - mid[1], z - mid[2]];
      const along = d[0] * unit[0] + d[1] * unit[1] + d[2] * unit[2];
      sum += Math.hypot(d[0] - unit[0] * along, d[1] - unit[1] * along, d[2] - unit[2] * along);
    }
    radii.push(sum / band.length);
  }
  const base = radii[0] || 1;
  return { joint: names[child], verts: band.length, angles, ratio: radii.map((r) => +(r / base).toFixed(3)) };
}

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const files = args.length ? args : readdirSync('public/models').filter((f) => f.endsWith('.glb')).slice(0, 8).map((f) => join('public/models', f));
  const JOINTS = [
    [/ForeArm$/i, 'forearm (wrist twist)'],
    [/UpLeg$/i, 'thigh (hip twist)'],
    [/:?LeftArm$|LeftArm$/i, 'upper arm (shoulder twist)'],
  ];
  console.log('\nLBS TWIST — limb radius as a joint rotates about its own bone axis');
  console.log('  1.00 means the limb held its volume; lower means it pinched.\n');
  console.log('  model                     joint                      0deg   45    90   135   180');
  for (const file of files) {
    for (const [re, label] of JOINTS) {
      let r = null;
      try { r = await measureTwist(file, re); } catch { /* unreadable */ }
      if (!r) continue;
      console.log(`  ${file.split('/').pop().replace('.glb', '').padEnd(24).slice(0, 24)} ${label.padEnd(24)}`
        + r.ratio.map((v) => v.toFixed(2).padStart(6)).join(''));
    }
  }
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e?.stack ?? e); process.exitCode = 1; });
}
