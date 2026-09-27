#!/usr/bin/env node
/**
 * EVERY SHIPPED MODEL KEEPS ITS TEXTURE COORDINATES.
 *
 * Caught while merging brutalfist11's meshopt-compressed models. Fifteen of the
 * seventeen were lossless — identical triangles, identical joints, every UV seam
 * intact, 10 MB saved. Two were not: MAIME_skinned and MAIME_tattered_skinned
 * came back with TEXCOORD_0 REMOVED ENTIRELY, seams 2954 -> 0 and 1011 -> 0.
 *
 * gltfpack did the right thing by its own lights — those files' materials
 * reference no texture, so the UVs looked unused. They are not. MAIME's whole
 * look is the white skull paint, and it is assigned IN CODE at runtime
 * (`__maimePaintTex`), long after the pruner has decided nothing needs UVs. A
 * body with no UVs can never be painted, and the failure is silent: the model
 * loads, the skeleton binds, and the texture simply has nowhere to land.
 *
 * So the invariant is not "has a material with a texture" — it is that a mesh
 * which HAD texture coordinates must keep them. Nothing in this repo authors a
 * fighter without UVs, so any model missing them has been through a lossy tool.
 *
 * Usage: node scripts/check-model-uvs.mjs [--gate]
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseGlb } from '../tools/model_diag/bind_pose.mjs';

const DIR = 'public/models';
/**
 * Proxies and references, not fighters. Named individually so each exemption is
 * a decision rather than a pattern that quietly swallows the next regression.
 *
 * xbot            the Mixamo T-pose reference MIXAMO_REST_POSE is read from.
 * wrestler_base   a 2,420-triangle / 1,248-vertex proxy with no UVs in ANY
 * wrestler_base_  version (checked back through git), and neither name appears
 *   rig28         anywhere in src/, so nothing loads them. Pre-existing, not a
 *                 compressor loss — but if either is ever wired as the CAW base
 *                 mesh, the missing UVs are a real defect and this line is where
 *                 that gets noticed.
 */
const NOT_A_FIGHTER = new Set(['xbot.glb', 'wrestler_base.glb', 'wrestler_base_rig28.glb']);

const rows = [];
for (const name of readdirSync(DIR)) {
  if (!name.endsWith('.glb') || NOT_A_FIGHTER.has(name)) continue;
  let json;
  try { ({ json } = parseGlb(readFileSync(join(DIR, name)))); } catch { rows.push({ name, unreadable: true }); continue; }
  let withUv = 0, without = 0;
  for (const mesh of json.meshes ?? []) {
    for (const prim of mesh.primitives ?? []) {
      if (prim.attributes?.TEXCOORD_0 !== undefined) withUv++; else without++;
    }
  }
  rows.push({ name, withUv, without, prims: withUv + without });
}

const bad = rows.filter((r) => !r.unreadable && r.prims > 0 && r.withUv === 0);
const mixed = rows.filter((r) => !r.unreadable && r.withUv > 0 && r.without > 0);
const unreadable = rows.filter((r) => r.unreadable);

console.log(`\n  ${rows.length} models checked`);
if (unreadable.length) console.log(`  ${unreadable.length} unreadable: ${unreadable.map((r) => r.name).join(', ')}`);
for (const r of mixed) console.log(`  MIXED  ${r.name} — ${r.withUv} primitive(s) with UVs, ${r.without} without`);
for (const r of bad) console.log(`  FAIL   ${r.name} — no primitive carries TEXCOORD_0; it cannot be textured, including at runtime`);

if (!rows.length) {
  console.error('\n  NOTHING WAS CHECKED — that is a tool failure, not a pass.');
  process.exitCode = 1;
} else if (bad.length || mixed.length) {
  console.error(`\n  ${bad.length + mixed.length} model(s) are missing texture coordinates.`);
  console.error('  A compressor pruned them as unused. Re-export with UVs kept — do not ship the smaller file.');
  if (process.argv.includes('--gate')) process.exitCode = 1;
} else {
  console.log('\n  Every model keeps its texture coordinates.');
}
