#!/usr/bin/env node
/**
 * MEASURE A MODEL'S BIND POSE: T-pose, A-pose, or something else.
 *
 * WHY IT MATTERS. An animation authored on a T-pose rig, retargeted onto an
 * A-pose bind without correction, lands every arm roughly 45 degrees off — and
 * what that looks like on screen is a wrist stuck to the hip and an arm that
 * will not leave the body. It reads as "twisted bodies", and it is not a
 * weights problem, so re-rigging never fixes it.
 *
 * THE MEASUREMENT. A skinned GLB's bind pose is recoverable exactly: a joint's
 * bind world transform is the INVERSE of its inverse-bind matrix. So take
 * shoulder -> hand in bind space and measure that vector's angle below
 * horizontal:
 *
 *     ~0 deg   arms straight out          T-POSE
 *     ~45 deg  arms down at forty-five    A-POSE
 *     ~90 deg  arms at the sides          I-POSE / relaxed
 *
 * This reads the glTF directly — no three.js, no renderer — so it runs over a
 * whole model directory in seconds.
 *
 * Usage: node tools/model_diag/bind_pose.mjs <dir-or-file...> [--json]
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const GLB_MAGIC = 0x46546c67; // 'glTF'

/** Parse a .glb into its JSON chunk and binary chunk. */
export function parseGlb(buf) {
  if (buf.readUInt32LE(0) !== GLB_MAGIC) throw new Error('not a GLB');
  let off = 12;
  let json = null;
  let bin = null;
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32LE(off);
    const type = buf.readUInt32LE(off + 4);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(data.toString('utf8'));
    else if (type === 0x004e4942) bin = data;
    off += 8 + len + ((4 - (len % 4)) % 4);
  }
  if (!json) throw new Error('no JSON chunk');
  return { json, bin };
}

/**
 * Decode an EXT_meshopt_compression buffer view.
 *
 * 60 of the 77 shipped models use meshopt, so without this the sweep can only
 * see 17 of them — and "most models unreadable" is not an answer.
 * three.js already vendors the decoder, so nothing new is pulled in.
 */
async function meshoptDecode(bin, ext) {
  const { MeshoptDecoder } = await import('three/examples/jsm/libs/meshopt_decoder.module.js');
  await MeshoptDecoder.ready;
  const src = bin.subarray(ext.byteOffset ?? 0, (ext.byteOffset ?? 0) + ext.byteLength);
  const out = new Uint8Array(ext.count * ext.byteStride);
  MeshoptDecoder.decodeGltfBuffer(out, ext.count, ext.byteStride, src, ext.mode, ext.filter);
  return Buffer.from(out.buffer, out.byteOffset, out.byteLength);
}

/** Read a float32 accessor, decompressing a meshopt view when needed. */
export async function readAccessor(json, bin, index) {
  const acc = json.accessors?.[index];
  if (!acc || acc.componentType !== 5126 || acc.sparse) return null;
  const bv = json.bufferViews?.[acc.bufferView];
  if (!bv) return null;
  const meshopt = bv.extensions?.EXT_meshopt_compression;
  if (bv.extensions && !meshopt) return null; // some other compression
  if (meshopt) {
    try {
      bin = await meshoptDecode(bin, meshopt);
    } catch {
      return null;
    }
    // A decoded view is dense and starts at zero.
    bv.byteOffset = 0;
    bv.byteStride = meshopt.byteStride;
  }
  const comps = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[acc.type];
  if (!comps || !bin) return null;
  const start = (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0);
  const stride = bv.byteStride ?? comps * 4;
  const out = [];
  for (let i = 0; i < acc.count; i++) {
    const row = [];
    for (let c = 0; c < comps; c++) {
      const at = start + i * stride + c * 4;
      if (at + 4 > bin.length) return null;
      row.push(bin.readFloatLE(at));
    }
    out.push(row);
  }
  return out;
}

/** Translation of the inverse of a column-major 4x4 — the joint's bind position. */
export function bindPositionFromIBM(m) {
  const t = [m[12], m[13], m[14]];
  // -R^T * t, with R the upper-left 3x3 in column-major order.
  return [
    -(m[0] * t[0] + m[1] * t[1] + m[2] * t[2]),
    -(m[4] * t[0] + m[5] * t[1] + m[6] * t[2]),
    -(m[8] * t[0] + m[9] * t[1] + m[10] * t[2]),
  ];
}

const NAME_RE = {
  shoulderL: /(leftarm|left_arm|arm_l\b|l_arm|leftshoulder|mixamorigleftarm)/i,
  handL: /(lefthand|left_hand|hand_l\b|l_hand|wrist_l|mixamoriglefthand)/i,
  shoulderR: /(rightarm|right_arm|arm_r\b|r_arm|rightshoulder|mixamorigrightarm)/i,
  handR: /(righthand|right_hand|hand_r\b|r_hand|wrist_r|mixamorigrighthand)/i,
};
const EXCLUDE = /toe|foot|leg|thumb|index|middle|ring|pinky|_end$|forearm/i;

function findJoint(names, re) {
  for (let i = 0; i < names.length; i++) {
    if (EXCLUDE.test(names[i])) continue;
    if (re.test(names[i].replace(/[:\s]/g, ''))) return i;
  }
  return -1;
}

export function classifyArmAngle(deg) {
  if (deg === null || deg === undefined) return 'unknown';
  if (deg < 22) return 'T-POSE';
  if (deg < 62) return 'A-POSE';
  return 'I-POSE';
}

/** Measure one model. */
export async function measureBindPose(file) {
  const { json, bin } = parseGlb(readFileSync(file));
  const skin = json.skins?.[0];
  if (!skin || skin.inverseBindMatrices === undefined) return { file, skinned: false };
  const ibms = await readAccessor(json, bin, skin.inverseBindMatrices);
  if (!ibms) return { file, skinned: true, readable: false };

  const names = skin.joints.map((n) => json.nodes?.[n]?.name ?? '');
  const positions = ibms.map(bindPositionFromIBM);

  const measure = (sRe, hRe) => {
    const s = findJoint(names, sRe);
    const h = findJoint(names, hRe);
    if (s < 0 || h < 0) return null;
    const a = positions[s];
    const b = positions[h];
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const horizontal = Math.hypot(dx, dz);
    if (horizontal < 1e-6 && Math.abs(dy) < 1e-6) return null;
    // Angle BELOW horizontal: 0 = straight out, 90 = straight down.
    return (Math.atan2(-dy, horizontal) * 180) / Math.PI;
  };

  const left = measure(NAME_RE.shoulderL, NAME_RE.handL);
  const right = measure(NAME_RE.shoulderR, NAME_RE.handR);
  const avg = left !== null && right !== null ? (left + right) / 2 : (left ?? right);
  return {
    file,
    skinned: true,
    readable: true,
    joints: names.length,
    leftDeg: left === null ? null : Math.round(left),
    rightDeg: right === null ? null : Math.round(right),
    armDeg: avg === null || avg === undefined ? null : Math.round(avg),
    pose: classifyArmAngle(avg),
    /** A big left/right difference means the bind itself is asymmetric. */
    asymmetryDeg: left !== null && right !== null ? Math.round(Math.abs(left - right)) : null,
  };
}

function collect(paths) {
  const files = [];
  for (const p of paths) {
    if (statSync(p).isDirectory()) {
      for (const f of readdirSync(p)) if (f.endsWith('.glb')) files.push(join(p, f));
    } else files.push(p);
  }
  return files.sort();
}

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  if (!args.length) {
    console.error('usage: bind_pose.mjs <dir-or-file...> [--json]');
    process.exitCode = 1;
    return;
  }
  const rows = [];
  for (const file of collect(args)) {
    try { rows.push(await measureBindPose(file)); }
    catch (e) { rows.push({ file, error: String(e.message ?? e) }); }
  }
  if (process.argv.includes('--json')) { console.log(JSON.stringify(rows, null, 2)); return; }

  const counts = new Map();
  for (const r of rows) {
    const label = r.error ? 'error' : !r.skinned ? 'unskinned' : !r.readable ? 'compressed' : r.pose;
    counts.set(label, (counts.get(label) ?? 0) + 1);
    if (label === 'T-POSE' || label === 'unknown') continue; // list only the interesting ones
    const name = r.file.split('/').pop();
    const deg = r.armDeg === null || r.armDeg === undefined ? '  -- ' : `${String(r.armDeg).padStart(4)}°`;
    const asym = r.asymmetryDeg ? ` asym ${r.asymmetryDeg}°` : '';
    console.log(`${label.padEnd(10)} ${deg}  ${name}${asym}`);
  }
  console.log(`\n[bind-pose] ${rows.length} models: ${[...counts].sort((a,b)=>b[1]-a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}`);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e?.stack ?? e); process.exitCode = 1; });
}
