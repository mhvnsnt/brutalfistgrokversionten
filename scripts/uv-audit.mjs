#!/usr/bin/env node
/**
 * Audit a model's UV layout. This is the measurement that found the defect in
 * BANNON_rigged.glb, where the skin and the trunks were painted from the same
 * texels and the body was covered in dark crack-like strikes.
 *
 * A texture cannot show two different things at one texel, so the number that
 * matters is not the image, it is how many triangles share a texel.
 *
 * MEASURED BASELINE — healthy models, for comparison:
 *
 *   model                  UV area/sheet   overlap   max tris/texel   stretch >20x
 *   VIPER.glb                   0.64x        0.2%          3              0.26%
 *   BRUTUS.glb                  0.64x        0.4%          5                 -
 *   BANNON.glb (15 parts)       0.64x        0.1%          5                 -
 *   BANNON_rigged.glb BEFORE   27.81x       98.6%         83             13.58%
 *   BANNON_rigged.glb AFTER     0.63x       18.5%         17              1.26%
 *
 * "UV area/sheet" is the summed area of every triangle's UV footprint over the
 * area of the sheet: 1.0 means the mesh is laid out once. 27.81x means the sheet
 * is covered nearly 28 times over, which is only possible if islands sit on top
 * of each other.
 *
 * Usage: node scripts/uv-audit.mjs <glb> [more.glb ...]
 */
import { readFileSync } from 'node:fs';

import { GLTFLoader } from 'three-stdlib';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const SHEET = 1024;

/** Drop material/texture refs: only geometry is read, and node has no Image. */
function geometryOnly(buf) {
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
  return Buffer.concat([header, jsonBytes, rest]);
}

export async function auditUv(path) {
  const patched = geometryOnly(readFileSync(path));
  const loader = new GLTFLoader();
  await MeshoptDecoder.ready;
  loader.setMeshoptDecoder(MeshoptDecoder);
  const ab = patched.buffer.slice(patched.byteOffset, patched.byteOffset + patched.byteLength);
  const gltf = await new Promise((res, rej) => loader.parse(ab, '', res, rej));

  const meshes = [];
  gltf.scene.traverse((o) => { if (o.isMesh && o.geometry.attributes.uv) meshes.push(o); });
  if (!meshes.length) return { path, error: 'no UV-bearing mesh' };

  const count = new Uint16Array(SHEET * SHEET);
  let triangles = 0, uvArea = 0;
  const ratios = [];

  for (const mesh of meshes) {
    const { position, uv } = mesh.geometry.attributes;
    const index = mesh.geometry.index;
    const n = index ? index.count : uv.count;
    for (let t = 0; t < n; t += 3) {
      const ids = [0, 1, 2].map((k) => (index ? index.getX(t + k) : t + k));
      const P = ids.map((i) => [position.getX(i), position.getY(i), position.getZ(i)]);
      const U = ids.map((i) => [uv.getX(i) * SHEET, (1 - uv.getY(i)) * SHEET]);
      triangles++;

      const area = Math.abs((U[1][0]-U[0][0])*(U[2][1]-U[0][1]) - (U[2][0]-U[0][0])*(U[1][1]-U[0][1])) / 2;
      uvArea += area;

      const ax = P[1][0]-P[0][0], ay = P[1][1]-P[0][1], az = P[1][2]-P[0][2];
      const bx = P[2][0]-P[0][0], by = P[2][1]-P[0][1], bz = P[2][2]-P[0][2];
      const worldArea = Math.hypot(ay*bz-az*by, az*bx-ax*bz, ax*by-ay*bx) / 2;
      if (worldArea > 1e-9) ratios.push(area / worldArea);

      const minx = Math.max(0, Math.floor(Math.min(U[0][0], U[1][0], U[2][0])));
      const maxx = Math.min(SHEET-1, Math.ceil(Math.max(U[0][0], U[1][0], U[2][0])));
      const miny = Math.max(0, Math.floor(Math.min(U[0][1], U[1][1], U[2][1])));
      const maxy = Math.min(SHEET-1, Math.ceil(Math.max(U[0][1], U[1][1], U[2][1])));
      const [[x1,y1],[x2,y2],[x3,y3]] = U;
      const d = (y2-y3)*(x1-x3) + (x3-x2)*(y1-y3);
      if (Math.abs(d) < 1e-12) continue;
      for (let y = miny; y <= maxy; y++) for (let x = minx; x <= maxx; x++) {
        const px = x + 0.5, py = y + 0.5;
        const a = ((y2-y3)*(px-x3) + (x3-x2)*(py-y3)) / d;
        const b = ((y3-y1)*(px-x3) + (x1-x3)*(py-y3)) / d;
        if (a >= 0 && b >= 0 && (1-a-b) >= 0 && count[y*SHEET + x] < 65535) count[y*SHEET + x]++;
      }
    }
  }

  let covered = 0, overlapping = 0, maxPerTexel = 0;
  for (const c of count) {
    if (c > 0) covered++;
    if (c > 1) overlapping++;
    if (c > maxPerTexel) maxPerTexel = c;
  }
  ratios.sort((a, b) => a - b);
  const median = ratios[Math.floor(ratios.length / 2)] || 0;
  const stretched = ratios.filter((r) => r > median * 20 || r < median / 20).length;

  return {
    path, meshes: meshes.length, triangles,
    coverage: covered / (SHEET * SHEET),
    overlap: covered ? overlapping / covered : 0,
    maxPerTexel,
    areaRatio: uvArea / (SHEET * SHEET),
    stretched: ratios.length ? stretched / ratios.length : 0,
  };
}

const files = process.argv.slice(2);
if (!files.length) {
  console.error('usage: node scripts/uv-audit.mjs <glb> [more.glb ...]');
  process.exit(1);
}
let worst = 0;
for (const f of files) {
  const r = await auditUv(f);
  if (r.error) { console.log(`${f}: ${r.error}`); continue; }
  console.log(
    `${r.path}\n` +
    `  meshes ${r.meshes}  triangles ${r.triangles}\n` +
    `  UV area/sheet ${r.areaRatio.toFixed(2)}x   coverage ${(100*r.coverage).toFixed(1)}%   ` +
    `overlap ${(100*r.overlap).toFixed(1)}%   max tris/texel ${r.maxPerTexel}   stretched ${(100*r.stretched).toFixed(2)}%`,
  );
  if (r.areaRatio > worst) worst = r.areaRatio;
}
