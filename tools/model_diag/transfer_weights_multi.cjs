#!/usr/bin/env node
/**
 * RE-WEIGHT A SEVERED, MULTI-MATERIAL BODY FROM A WHOLE DONOR RIG.
 *
 * Owner, with a screenshot of MAIME as a fan of exploded geometry: "This is
 * just broken bullshit worse than beforehand."
 *
 * MEASURED with rig_continuity across all 77 models: 62 whole, 1 mixed,
 * 12 unskinned, and exactly TWO severed -- both of them MAIME.
 *
 *   MAIME_skinned.glb           15 skinned prims, 22 joints, widest piece 1 joint
 *   MAIME_tattered_skinned.glb  14 skinned prims, 22 joints, widest piece 1 joint
 *
 * "Widest piece spans 1 joint" is the whole defect: every vertex has exactly ONE
 * bone influence, and the pieces are named after the joints they are welded to
 * (pelvis, chest, head, shL, shR, elL, elR, haL, haR, hipL, hipR, knL, knR,
 * ftL, ftR). Nothing blends across a joint, so nothing bends -- the parts rotate
 * past each other and separate. An action figure, which is exactly what the
 * screenshot shows, while BANNON beside him renders correctly.
 *
 * WHY NEITHER EXISTING TOOL COULD DO IT, both of which refused honestly:
 *   sew_rig.cjs        "primitives use different materials — sewing would drop one"
 *   transfer_weights   "target must be a single mesh / single primitive"
 * MAIME's pieces carry DIFFERENT MATERIALS (skin, jacket, trousers, boots), so
 * concatenating them is lossy and the single-primitive transfer cannot run.
 * Merging is the wrong fix anyway: the materials are real and worth keeping.
 *
 * WHAT THIS DOES INSTEAD. The pieces stay separate and keep their materials;
 * only the WEIGHTS change. Each target vertex takes the K nearest donor vertices
 * (in a shared bind space) and blends their joint influences by inverse
 * distance. Because the donor's weights are spatially continuous, two vertices
 * that sit on top of each other at a seam -- one on the forearm piece, one on
 * the upper-arm piece -- receive near-identical blends, so the seam bends
 * together instead of tearing apart. The body gains the donor's full skeleton.
 *
 * The math is transfer_weights.cjs's, unchanged; what is new is iterating every
 * primitive and aligning on the WHOLE body's bounding box rather than one piece.
 *
 *   node tools/model_diag/transfer_weights_multi.cjs <donor.glb> <target.glb> [out.glb]
 *
 * Non-destructive. Gate the result with rig_continuity before promoting.
 */
const fs = require('fs');

const SRC = process.argv[2], TGT = process.argv[3];
if (!SRC || !TGT) { console.error('usage: transfer_weights_multi.cjs <donor.glb> <target.glb> [out.glb]'); process.exit(1); }
const OUT = process.argv[4] || TGT.replace(/\.glb$/i, '') + '_xfer.glb';
const K = 6;

const NCOMP = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const CSIZE = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };

/**
 * REFUSE A COMPRESSED FILE LOUDLY. The raw reader below cannot see through
 * EXT_meshopt_compression, and the single-primitive tool once read compressed
 * bytes as float32, computed a source height of 6.74e+38, and still printed
 * "wrote ... 58 joints ... texture preserved" and exited 0 -- a total success
 * message on pure garbage. Decompress first (tools in the Bannon repo do this
 * via gltf-transform) and pass the raw file.
 */
function requireRaw(p, role) {
  const b = fs.readFileSync(p);
  const jl = b.readUInt32LE(12);
  const j = JSON.parse(b.slice(20, 20 + jl).toString('utf8'));
  const bad = (j.extensionsUsed || []).filter((e) => /meshopt|draco/i.test(e));
  if (bad.length) {
    console.error(`REFUSED: ${role} ${p.split('/').pop()} is compressed (${bad.join(', ')}).`);
    console.error('  This reader would misread the accessors as raw floats and report success on garbage.');
    console.error('  Decompress it first and pass the raw .glb.');
    process.exit(2);
  }
  return p;
}

function readGLB(path) {
  const b = fs.readFileSync(path);
  const jl = b.readUInt32LE(12);
  const json = JSON.parse(b.slice(20, 20 + jl).toString('utf8'));
  const bin = b.slice(20 + jl + 8);
  return { json, bin };
}

function accessor(g, i) {
  const a = g.json.accessors[i];
  const bv = g.json.bufferViews[a.bufferView];
  const nc = NCOMP[a.type], cs = CSIZE[a.componentType];
  const stride = bv.byteStride || nc * cs;
  const base = (bv.byteOffset || 0) + (a.byteOffset || 0);
  const rd = { 5120: (o) => g.bin.readInt8(o), 5121: (o) => g.bin.readUInt8(o), 5122: (o) => g.bin.readInt16LE(o),
               5123: (o) => g.bin.readUInt16LE(o), 5125: (o) => g.bin.readUInt32LE(o), 5126: (o) => g.bin.readFloatLE(o) }[a.componentType];
  const out = [];
  for (let v = 0; v < a.count; v++) {
    const row = [];
    for (let c = 0; c < nc; c++) row.push(rd(base + v * stride + c * cs));
    out.push(row);
  }
  return { data: out, comp: a.componentType, type: a.type, count: a.count };
}

const S = readGLB(requireRaw(SRC, 'donor')), T = readGLB(requireRaw(TGT, 'target'));
if (!S.json.skins || !S.json.skins.length) { console.error('donor has no skin — nothing to transfer'); process.exit(2); }

// ── every donor skinned vertex
const srcPos = [], srcJoints = [], srcWeights = [];
for (const mesh of S.json.meshes) for (const prim of mesh.primitives) {
  if (prim.attributes.JOINTS_0 == null || prim.attributes.WEIGHTS_0 == null) continue;
  const P = accessor(S, prim.attributes.POSITION), J = accessor(S, prim.attributes.JOINTS_0), W = accessor(S, prim.attributes.WEIGHTS_0);
  for (let v = 0; v < P.count; v++) { srcPos.push(P.data[v]); srcJoints.push(J.data[v]); srcWeights.push(W.data[v]); }
}
if (!srcPos.length) { console.error('donor has no skinned vertices'); process.exit(2); }

// ── every target primitive, in order, with its material
const tprims = [];
for (const mesh of T.json.meshes) for (const prim of mesh.primitives) {
  if (prim.attributes.POSITION == null) continue;
  tprims.push({ prim, pos: accessor(T, prim.attributes.POSITION).data });
}
if (!tprims.length) { console.error('target has no geometry'); process.exit(2); }
const totalVerts = tprims.reduce((a, p) => a + p.pos.length, 0);
console.log('target: ' + tprims.length + ' primitives, ' + totalVerts + ' verts, ' +
  (T.json.materials ? T.json.materials.length : 0) + ' materials');

// ── align on the WHOLE body, not one piece: bbox centre in X/Z, feet in Y, height scaled
function bbox(list) {
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (const p of list) for (let k = 0; k < 3; k++) { if (p[k] < mn[k]) mn[k] = p[k]; if (p[k] > mx[k]) mx[k] = p[k]; }
  return { mn, mx };
}
const allTgt = [];
for (const t of tprims) for (const p of t.pos) allTgt.push(p);
const sb = bbox(srcPos), tb = bbox(allTgt);
const shift = [
  ((sb.mn[0] + sb.mx[0]) / 2) - ((tb.mn[0] + tb.mx[0]) / 2),
  sb.mn[1] - tb.mn[1],
  ((sb.mn[2] + sb.mx[2]) / 2) - ((tb.mn[2] + tb.mx[2]) / 2),
];
const sH = sb.mx[1] - sb.mn[1], tH = tb.mx[1] - tb.mn[1];
const yScale = (tH > 1e-6) ? (sH / tH) : 1;
console.log('align: shift [' + shift.map((v) => v.toFixed(3)) + '], yScale ' + yScale.toFixed(4) +
  '  (donor H ' + sH.toFixed(3) + ', target H ' + tH.toFixed(3) + ')');
const mapped = (p) => [p[0] + shift[0], sb.mn[1] + (p[1] - tb.mn[1]) * yScale, p[2] + shift[2]];

// ── uniform spatial hash (brute force would be millions x millions)
const CELL = Math.max(0.02, sH / 60);
const grid = new Map();
const key = (x, y, z) => x + ',' + y + ',' + z;
const cellOf = (p) => [Math.floor(p[0] / CELL), Math.floor(p[1] / CELL), Math.floor(p[2] / CELL)];
for (let i = 0; i < srcPos.length; i++) {
  const c = cellOf(srcPos[i]), k = key(c[0], c[1], c[2]);
  let a = grid.get(k); if (!a) { a = []; grid.set(k, a); }
  a.push(i);
}
console.log('spatial hash: ' + grid.size + ' cells over ' + srcPos.length + ' donor verts (cell ' + CELL.toFixed(3) + 'm)');

function nearest(p, k) {
  const c = cellOf(p);
  let found = [], ring = 0;
  while (found.length < k && ring <= 6) {
    found = [];
    for (let dx = -ring; dx <= ring; dx++) for (let dy = -ring; dy <= ring; dy++) for (let dz = -ring; dz <= ring; dz++) {
      const a = grid.get(key(c[0] + dx, c[1] + dy, c[2] + dz));
      if (a) for (const i of a) found.push(i);
    }
    ring++;
  }
  return found.map((i) => {
    const q = srcPos[i];
    const dx = q[0] - p[0], dy = q[1] - p[1], dz = q[2] - p[2];
    return { i, d2: dx * dx + dy * dy + dz * dz };
  }).sort((a, b) => a.d2 - b.d2).slice(0, k);
}

function weightsFor(pos) {
  const outJ = [], outW = [];
  let worst = 0, sumD = 0;
  for (const raw of pos) {
    const p = mapped(raw);
    const nn = nearest(p, K);
    if (!nn.length) { outJ.push([0, 0, 0, 0]); outW.push([1, 0, 0, 0]); continue; }
    const d0 = Math.sqrt(nn[0].d2); if (d0 > worst) worst = d0; sumD += d0;
    const acc = new Map();
    for (const n of nn) {
      const w = 1 / (Math.sqrt(n.d2) + 1e-4);
      const J = srcJoints[n.i], W = srcWeights[n.i];
      for (let c = 0; c < 4; c++) { const jw = W[c]; if (!jw) continue; acc.set(J[c], (acc.get(J[c]) || 0) + jw * w); }
    }
    const top = [...acc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    const tot = top.reduce((s, e) => s + e[1], 0) || 1;
    const js = [0, 0, 0, 0], ws = [0, 0, 0, 0];
    top.forEach((e, i) => { js[i] = e[0]; ws[i] = e[1] / tot; });
    outJ.push(js); outW.push(ws);
  }
  return { outJ, outW, worst, mean: pos.length ? sumD / pos.length : 0 };
}

// ── write: target geometry + ALL target materials + donor skeleton
const parts = [], views = [], accs = [];
function align4() { const o = parts.reduce((a, x) => a + x.length, 0); const p = (4 - o % 4) % 4; if (p) parts.push(Buffer.alloc(p)); }
function push(rows, comp, type, target, minmax) {
  align4();
  const nc = NCOMP[type], cs = CSIZE[comp];
  const buf = Buffer.alloc(rows.length * nc * cs);
  const wr = { 5121: (o, v) => buf.writeUInt8(v, o), 5123: (o, v) => buf.writeUInt16LE(v, o),
               5125: (o, v) => buf.writeUInt32LE(v, o), 5126: (o, v) => buf.writeFloatLE(v, o) }[comp];
  let o = 0; for (const r of rows) for (let c = 0; c < nc; c++) { wr(o, r[c]); o += cs; }
  const boff = parts.reduce((a, x) => a + x.length, 0); parts.push(buf);
  views.push({ buffer: 0, byteOffset: boff, byteLength: buf.length, ...(target ? { target } : {}) });
  const acc = { bufferView: views.length - 1, componentType: comp, count: rows.length, type };
  if (minmax) {
    const mn = [], mx = [];
    for (let c = 0; c < nc; c++) { mn[c] = Infinity; mx[c] = -Infinity; }
    for (const r of rows) for (let c = 0; c < nc; c++) { if (r[c] < mn[c]) mn[c] = r[c]; if (r[c] > mx[c]) mx[c] = r[c]; }
    acc.min = mn; acc.max = mx;
  }
  accs.push(acc); return accs.length - 1;
}
function copyRaw(g, byteOffset, byteLength, target) {
  align4();
  const buf = Buffer.from(g.bin.slice(byteOffset, byteOffset + byteLength));
  const boff = parts.reduce((a, x) => a + x.length, 0); parts.push(buf);
  views.push({ buffer: 0, byteOffset: boff, byteLength, ...(target ? { target } : {}) });
  return views.length - 1;
}

const outPrims = [];
let meanSum = 0, worstAll = 0;
for (const t of tprims) {
  const { outJ, outW, worst, mean } = weightsFor(t.pos);
  meanSum += mean * t.pos.length; if (worst > worstAll) worstAll = worst;
  const attrs = {};
  attrs.POSITION = push(t.pos, 5126, 'VEC3', 34962, true);
  if (t.prim.attributes.NORMAL != null)     attrs.NORMAL     = push(accessor(T, t.prim.attributes.NORMAL).data, 5126, 'VEC3', 34962, false);
  if (t.prim.attributes.TEXCOORD_0 != null) attrs.TEXCOORD_0 = push(accessor(T, t.prim.attributes.TEXCOORD_0).data, 5126, 'VEC2', 34962, false);
  attrs.JOINTS_0  = push(outJ, 5123, 'VEC4', 34962, false);
  attrs.WEIGHTS_0 = push(outW, 5126, 'VEC4', 34962, false);
  const p = { attributes: attrs };
  if (t.prim.indices != null) p.indices = push(accessor(T, t.prim.indices).data.map((e) => [e[0]]), 5125, 'SCALAR', 34963, false);
  if (t.prim.material != null) p.material = t.prim.material;   // materials copied verbatim, indices stay valid
  outPrims.push(p);
}
console.log('transferred ' + totalVerts + ' verts across ' + outPrims.length + ' primitives  (mean nearest-donor ' +
  (meanSum / totalVerts).toFixed(4) + 'm, worst ' + worstAll.toFixed(4) + 'm)');

const sSkin = S.json.skins[0];
const ibmA = S.json.accessors[sSkin.inverseBindMatrices];
const ibmBV = S.json.bufferViews[ibmA.bufferView];
const ibmView = copyRaw(S, (ibmBV.byteOffset || 0) + (ibmA.byteOffset || 0), ibmA.count * 64, 0);
const ibmAcc = accs.push({ bufferView: ibmView, componentType: 5126, count: ibmA.count, type: 'MAT4' }) - 1;

let images, textures, samplers;
if (T.json.images && T.json.images.length) {
  images = T.json.images.map((img) => {
    if (img.bufferView != null) {
      const bv = T.json.bufferViews[img.bufferView];
      return { mimeType: img.mimeType, bufferView: copyRaw(T, bv.byteOffset || 0, bv.byteLength) };
    }
    return Object.assign({}, img);
  });
  textures = T.json.textures ? JSON.parse(JSON.stringify(T.json.textures)) : undefined;
  samplers = T.json.samplers ? JSON.parse(JSON.stringify(T.json.samplers)) : undefined;
}

const nodes = JSON.parse(JSON.stringify(S.json.nodes));
nodes.forEach((n) => { delete n.mesh; delete n.skin; });
const meshNodeIndex = nodes.length;
// Named for the CHARACTER, not the donor. The old single-primitive tool hardcoded
// BANNON_XFER_MESH, which is why a scene walk reports two BANNON_* rigs in a
// BANNON vs VIPER match and reads as the wrong model being loaded.
const charName = (TGT.split('/').pop() || 'mesh').replace(/\.glb$/i, '').toUpperCase();
nodes.push({ mesh: 0, skin: 0, name: charName + '_XFER' });

let roots = (S.json.scenes && S.json.scenes[S.json.scene || 0] && S.json.scenes[S.json.scene || 0].nodes) || [];
roots = roots.slice(); roots.push(meshNodeIndex);

const g = {
  asset: { version: '2.0', generator: 'brutalfist transfer_weights_multi (donor rig -> multi-material target, K=' + K + ')' },
  scene: 0, scenes: [{ nodes: roots }],
  nodes,
  meshes: [{ name: charName + '_xfer', primitives: outPrims }],
  materials: T.json.materials ? JSON.parse(JSON.stringify(T.json.materials)) : [{ pbrMetallicRoughness: { baseColorFactor: [0.83, 0.62, 0.5, 1] } }],
  skins: [{ joints: sSkin.joints.slice(), inverseBindMatrices: ibmAcc, ...(sSkin.skeleton != null ? { skeleton: sSkin.skeleton } : {}) }],
  bufferViews: views, accessors: accs,
};
if (images) g.images = images;
if (textures) g.textures = textures;
if (samplers) g.samplers = samplers;

let blob = Buffer.concat(parts); const bp = (4 - blob.length % 4) % 4; if (bp) blob = Buffer.concat([blob, Buffer.alloc(bp)]);
g.buffers = [{ byteLength: blob.length }];
let js = Buffer.from(JSON.stringify(g)); const jp = (4 - js.length % 4) % 4; if (jp) js = Buffer.concat([js, Buffer.alloc(jp, 0x20)]);
const head = Buffer.alloc(12); head.write('glTF', 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + blob.length, 8);
const jh = Buffer.alloc(8); jh.writeUInt32LE(js.length, 0); jh.writeUInt32LE(0x4E4F534A, 4);
const bh = Buffer.alloc(8); bh.writeUInt32LE(blob.length, 0); bh.writeUInt32LE(0x004E4942, 4);
fs.writeFileSync(OUT, Buffer.concat([head, jh, js, bh, blob]));

console.log('wrote ' + OUT + '  ' + (fs.statSync(OUT).size / 1024 | 0) + ' KB, ' + totalVerts + ' verts, ' +
  outPrims.length + ' primitives, ' + (g.materials.length) + ' materials, ' + sSkin.joints.length + ' joints (from donor)');
console.log('NEXT: gate it -> rig_continuity.cjs ' + OUT + '   (must read WHOLE, not SEVERED)');
