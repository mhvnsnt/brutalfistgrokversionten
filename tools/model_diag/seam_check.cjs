/**
 * DO THE SEAMS MOVE TOGETHER?
 *
 * A multi-material body is many primitives by design, so "counts as severed"
 * by primitive count is the wrong question for it. The question that decides
 * whether it bends or tears: two vertices sitting at the SAME POSITION in
 * DIFFERENT primitives -- one on the forearm piece, one on the upper arm --
 * must carry near-identical joint influences, or the pieces separate.
 */
const fs = require('fs');
const NCOMP = { SCALAR:1, VEC2:2, VEC3:3, VEC4:4, MAT4:16 };
const CSIZE = { 5120:1, 5121:1, 5122:2, 5123:2, 5125:4, 5126:4 };
function readGLB(p){const b=fs.readFileSync(p);const jl=b.readUInt32LE(12);
  return {json:JSON.parse(b.slice(20,20+jl).toString('utf8')),bin:b.slice(20+jl+8)};}
function accessor(g,i){const a=g.json.accessors[i],bv=g.json.bufferViews[a.bufferView];
  const nc=NCOMP[a.type],cs=CSIZE[a.componentType],stride=bv.byteStride||nc*cs;
  const base=(bv.byteOffset||0)+(a.byteOffset||0);
  const rd={5121:o=>g.bin.readUInt8(o),5123:o=>g.bin.readUInt16LE(o),5125:o=>g.bin.readUInt32LE(o),5126:o=>g.bin.readFloatLE(o)}[a.componentType];
  const out=[];for(let v=0;v<a.count;v++){const r=[];for(let c=0;c<nc;c++)r.push(rd(base+v*stride+c*cs));out.push(r);}return out;}

const file = process.argv[2];
const g = readGLB(file);
const verts = [];   // {pos, prim, J, W}
let pi = 0;
for (const mesh of g.json.meshes) for (const prim of mesh.primitives) {
  if (prim.attributes.POSITION == null) continue;
  const P = accessor(g, prim.attributes.POSITION);
  const J = prim.attributes.JOINTS_0 != null ? accessor(g, prim.attributes.JOINTS_0) : null;
  const W = prim.attributes.WEIGHTS_0 != null ? accessor(g, prim.attributes.WEIGHTS_0) : null;
  for (let v = 0; v < P.length; v++) verts.push({ p: P[v], prim: pi, J: J ? J[v] : null, W: W ? W[v] : null });
  pi++;
}
// hash by rounded position to find coincident pairs across different primitives
const grid = new Map();
const key = (p) => p.map((c) => Math.round(c * 2000)).join(',');   // 0.5mm
for (let i = 0; i < verts.length; i++) {
  const k = key(verts[i].p);
  let a = grid.get(k); if (!a) { a = []; grid.set(k, a); }
  a.push(i);
}
/** influence map for a vertex, joint -> weight */
const infl = (v) => { const m = new Map(); if (!v.J) return m;
  for (let c = 0; c < 4; c++) if (v.W[c] > 0.001) m.set(v.J[c], v.W[c]); return m; };
/** how much two influence maps agree: sum of min(w) over shared joints, 0..1 */
function agree(a, b) { let s = 0; for (const [j, w] of a) if (b.has(j)) s += Math.min(w, b.get(j)); return s; }

let pairs = 0, sum = 0, bad = 0;
for (const idxs of grid.values()) {
  if (idxs.length < 2) continue;
  for (let x = 0; x < idxs.length; x++) for (let y = x + 1; y < idxs.length; y++) {
    const A = verts[idxs[x]], B = verts[idxs[y]];
    if (A.prim === B.prim) continue;           // same piece: not a seam
    const s = agree(infl(A), infl(B));
    pairs++; sum += s; if (s < 0.5) bad++;
  }
}
console.log(`${file.split('/').pop()}`);
console.log(`  coincident cross-primitive vertex pairs (the seams): ${pairs}`);
if (pairs) {
  console.log(`  mean influence agreement : ${(sum / pairs).toFixed(3)}   (1.0 = identical, they move as one)`);
  console.log(`  pairs disagreeing >50%   : ${bad}  (${((100 * bad) / pairs).toFixed(1)}%)  <- these tear`);
} else {
  console.log('  no coincident pairs found — pieces do not share a boundary ring');
}
