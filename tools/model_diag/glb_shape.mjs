import { readFileSync, statSync } from 'node:fs';
import { parseGlb } from './bind_pose.mjs';
const files = process.argv.slice(2);
for (const f of files) {
  try {
    const { json } = parseGlb(readFileSync(f));
    const prims = (json.meshes ?? []).flatMap((m) => m.primitives ?? []);
    const drawn = new Set();
    const walk = (i) => { const n = json.nodes[i]; if (n.mesh !== undefined) drawn.add(n.mesh); (n.children ?? []).forEach(walk); };
    (json.scenes?.[json.scene ?? 0]?.nodes ?? []).forEach(walk);
    let tris = 0, verts = 0;
    for (const mi of drawn) for (const p of json.meshes[mi].primitives ?? []) {
      const idx = p.indices !== undefined ? json.accessors[p.indices].count : json.accessors[p.attributes.POSITION].count;
      tris += idx / 3; verts += json.accessors[p.attributes.POSITION].count;
    }
    console.log(`${f.padEnd(52)} ${String((statSync(f).size/1024).toFixed(0)+'KB').padStart(8)}  prims ${String(prims.length).padStart(3)}  tris ${String(Math.round(tris)).padStart(7)}  verts ${String(verts).padStart(7)}  joints ${String(json.skins?.[0]?.joints?.length ?? 0).padStart(3)}  morphs ${json.meshes?.[0]?.primitives?.[0]?.targets?.length ?? 0}  ext ${(json.extensionsUsed ?? []).join(',')}`);
  } catch (e) { console.log(`${f.padEnd(52)} ERROR ${String(e.message).slice(0, 60)}`); }
}
