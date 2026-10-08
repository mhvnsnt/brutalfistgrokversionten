/**
 * Visual proof for the universal retargeter.
 *
 * Renders contrasting target rigs playing the SAME source clip (CMU punch and
 * kick by default) at several time fractions, with a software z-buffer
 * rasterizer over the actual skinned meshes (no GPU / browser needed). The
 * left column is the source skeleton drawn as sticks, in the same view.
 *
 *   npm run retarget:proof -- [--out proof] [--staging <dir>]
 *
 * Third-party sources are read from the staging directory; only the rendered
 * PNGs are written. CMU segments are CMU-free-use (not CC0).
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import * as THREE from 'three';
import sharp from 'sharp';
import { loadGlbNode } from './load-glb-node.mjs';
import { buildRetargetRig, retargetClip, poseRig, bindClipToRig, restoreRest } from '../../src/engine/retarget/UniversalRetarget.ts';

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const STAGING = arg('--staging', process.env.OSS_ANIM_STAGING ?? '/workspace/oss-anim-staging');
const OUT = resolve(ROOT, arg('--out', 'proof'));
mkdirSync(OUT, { recursive: true });

const TARGETS = [
  { id: 'BANNON_rigged', file: join(ROOT, 'public/models/BANNON_rigged.glb'), note: '58 joints, mirror-handed bind', color: [200, 120, 90] },
  { id: 'EDWIN_KENNEDY_unchained', file: join(ROOT, 'public/models/EDWIN_KENNEDY_unchained.glb'), note: '46 joints, 1-bone spine, no clavicles/toes', color: [110, 160, 210] },
  { id: 'KayKit_Knight', file: join(STAGING, 'kaykit-adventurers/extracted/KayKit_Adventurers_2.0_FREE/Characters/gltf/Knight.glb'), note: 'KayKit rig (CC0), chibi proportions', color: [150, 190, 110] },
  { id: 'UAL2_Mannequin_F', file: join(STAGING, 'quaternius-ual-2/extracted/Universal Animation Library 2[Standard]/Female Mannequin/Unreal-Godot/Mannequin_F.glb'), note: 'UAL2 rig (CC0), T-pose bind', color: [200, 180, 120] },
];
const CLIPS = [
  { id: 'cmu_02_05_seg01_righthand_high_front', label: 'CMU punch (right hand, high)' },
  { id: 'cmu_74_03_seg01_rightfoot_low_front', label: 'CMU kick (right foot, low)' },
];
const FRACTIONS = [0.0, 0.3, 0.5, 0.7, 0.9];
const CELL = 220;
const YAW = (35 * Math.PI) / 180; // 3/4 view from the character's front-right

/** View basis from the rig's own frame: camera looks at the character's front, yawed. */
function viewBasis(rig) {
  const e = rig.frame.elements;
  const left = new THREE.Vector3(e[0], e[1], e[2]);
  const up = new THREE.Vector3(e[4], e[5], e[6]);
  const fwd = new THREE.Vector3(e[8], e[9], e[10]);
  // Viewer facing the character: character's left is screen right.
  const sx = left.clone().multiplyScalar(Math.cos(YAW)).addScaledVector(fwd, Math.sin(YAW));
  const sz = fwd.clone().multiplyScalar(Math.cos(YAW)).addScaledVector(left, -Math.sin(YAW)); // toward camera
  return { sx, sy: up, sz };
}

/** Fit the cell to the first frame's pose: world points (skinned vertices or joints) projected on the view basis. */
function restFrameBox(rig, basis, root) {
  root.updateMatrixWorld(true);
  const pts = [];
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    const pos = o.geometry.attributes.position; const step = Math.max(1, Math.floor(pos.count / 2000));
    for (let i = 0; i < pos.count; i += step) {
      const v = new THREE.Vector3();
      if (o.isSkinnedMesh) o.getVertexPosition(i, v); else v.fromBufferAttribute(pos, i);
      pts.push(v.applyMatrix4(o.matrixWorld));
    }
  });
  if (!pts.length) for (const j of rig.joints) if (j.parent && rig.joints.includes(j.parent)) pts.push(new THREE.Vector3().setFromMatrixPosition(j.matrixWorld));
  let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity;
  for (const p of pts) { const x = p.dot(basis.sx); const y = p.dot(basis.sy); minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  const scale = (CELL * 0.62) / Math.max(maxY - minY, (maxX - minX) * 0.7, 1e-6);
  return { cx: (minX + maxX) / 2, minY, scale };
}

function project(p, basis, box) {
  return [CELL / 2 + (p.dot(basis.sx) - box.cx) * box.scale, CELL * 0.85 - (p.dot(basis.sy) - box.minY) * box.scale, p.dot(basis.sz)];
}

function newCell() { return { rgb: new Uint8Array(CELL * CELL * 3).fill(245), z: new Float32Array(CELL * CELL).fill(-Infinity) }; }

function drawTri(cell, a, b, c, col) {
  const minX = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]))); const maxX = Math.min(CELL - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
  const minY = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]))); const maxY = Math.min(CELL - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
  const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  if (Math.abs(area) < 1e-9) return;
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    const px = x + 0.5; const py = y + 0.5;
    const w0 = ((b[0] - px) * (c[1] - py) - (b[1] - py) * (c[0] - px)) / area;
    const w1 = ((c[0] - px) * (a[1] - py) - (c[1] - py) * (a[0] - px)) / area;
    const w2 = 1 - w0 - w1;
    if (w0 < 0 || w1 < 0 || w2 < 0) continue;
    const z = w0 * a[2] + w1 * b[2] + w2 * c[2];
    const i = y * CELL + x;
    if (z <= cell.z[i]) continue;
    cell.z[i] = z; cell.rgb[i * 3] = col[0]; cell.rgb[i * 3 + 1] = col[1]; cell.rgb[i * 3 + 2] = col[2];
  }
}

function drawLine(cell, a, b, col, r = 2) {
  const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1])) + 1;
  for (let k = 0; k <= n; k++) {
    const t = k / n; const x0 = a[0] + (b[0] - a[0]) * t; const y0 = a[1] + (b[1] - a[1]) * t;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const x = Math.round(x0 + dx); const y = Math.round(y0 + dy);
      if (x < 0 || y < 0 || x >= CELL || y >= CELL) continue;
      const i = y * CELL + x; cell.rgb[i * 3] = col[0]; cell.rgb[i * 3 + 1] = col[1]; cell.rgb[i * 3 + 2] = col[2];
    }
  }
}

const _p = new THREE.Vector3(); const _q = new THREE.Vector3(); const _r = new THREE.Vector3(); const _n = new THREE.Vector3();
function renderMesh(root, basis, box, col) {
  const cell = newCell();
  root.updateMatrixWorld(true);
  const light = basis.sz.clone().multiplyScalar(0.8).addScaledVector(basis.sy, 0.5).normalize();
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    const g = o.geometry; const pos = g.attributes.position; const n = pos.count;
    const world = new Array(n);
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3();
      if (o.isSkinnedMesh) o.getVertexPosition(i, v); else v.fromBufferAttribute(pos, i);
      world[i] = v.applyMatrix4(o.matrixWorld);
    }
    const scr = world.map((v) => project(v, basis, box));
    const idx = g.index ? g.index.array : Array.from({ length: n }, (_, i) => i);
    for (let t = 0; t + 2 < idx.length; t += 3) {
      const ia = idx[t]; const ib = idx[t + 1]; const ic = idx[t + 2];
      _p.subVectors(world[ib], world[ia]); _q.subVectors(world[ic], world[ia]); _n.crossVectors(_p, _q);
      if (_n.lengthSq() < 1e-20) continue;
      _n.normalize();
      const shade = 0.35 + 0.65 * Math.abs(_n.dot(light));
      drawTri(cell, scr[ia], scr[ib], scr[ic], col.map((c) => Math.min(255, Math.round(c * shade))));
    }
  });
  return cell;
}

function renderSticks(rig, basis, box) {
  const cell = newCell();
  rig.root.updateMatrixWorld(true);
  const mapped = new Set(Object.values(rig.map.slots).filter(Boolean));
  for (const j of rig.joints) {
    const p = j.parent;
    if (!p || !rig.joints.includes(p) || !rig.joints.includes(p.parent)) continue;
    const a = project(_r.setFromMatrixPosition(p.matrixWorld), basis, box);
    const b = project(_r.setFromMatrixPosition(j.matrixWorld), basis, box);
    const side = /left|^l|_l$|\.l$/i.test(j.name) ? [40, 90, 200] : /right|^r|_r$|\.r$/i.test(j.name) ? [200, 50, 50] : [60, 60, 60];
    drawLine(cell, a, b, mapped.has(j.name) ? side : [150, 150, 150], 2);
  }
  return cell;
}

async function main() {
  const targets = [];
  for (const t of TARGETS) {
    if (!existsSync(t.file)) { console.warn(`[proof] missing target ${t.file}; skipped`); continue; }
    const g = await loadGlbNode(t.file);
    targets.push({ ...t, scene: g.scene, rig: buildRetargetRig(g.scene, { label: t.id, file: t.id }) });
  }
  const written = [];
  for (const c of CLIPS) {
    const file = join(STAGING, 'cmu-segments/glb', `${c.id}.glb`);
    if (!existsSync(file)) { console.warn(`[proof] missing clip ${file}; skipped`); continue; }
    const sg = await loadGlbNode(file);
    const src = buildRetargetRig(sg.scene, { label: c.id, file: c.id });
    const clip = sg.animations[0];
    const rows = [];
    // Source row (sticks).
    const sBasis = viewBasis(src); const sBound = bindClipToRig(clip, src).bound;
    poseRig(src, sBound, 0); const sBox = restFrameBox(src, sBasis, src.root);
    rows.push({ label: 'SOURCE CMU 31-joint skeleton', cells: FRACTIONS.map((f) => { poseRig(src, sBound, f * clip.duration); return renderSticks(src, sBasis, sBox); }), status: '' });
    restoreRest(src);
    for (const t of targets) {
      const res = retargetClip(clip, src, t.rig, { fps: 30 });
      restoreRest(t.rig);
      if (res.status !== 'RETARGETED') { console.warn(`[proof] ${t.id}: ${res.status} ${res.reasons.join('; ')}`); continue; }
      const bound = bindClipToRig(res.clip, t.rig).bound;
      const basis = viewBasis(t.rig); poseRig(t.rig, bound, 0); const box = restFrameBox(t.rig, basis, t.scene);
      const cells = FRACTIONS.map((f) => { poseRig(t.rig, bound, f * res.clip.duration); return renderMesh(t.scene, basis, box, t.color); });
      restoreRest(t.rig);
      rows.push({ label: `${t.id} (${t.note}; handedness ${t.rig.handedness > 0 ? '+1' : '-1 mirrored'})`, cells });
    }
    // Compose: label strip above each row.
    const LABEL = 22; const HEAD = 30;
    const W = CELL * FRACTIONS.length; const H = HEAD + rows.length * (CELL + LABEL);
    const canvas = Buffer.alloc(W * H * 3, 255);
    rows.forEach((r, ri) => r.cells.forEach((cell, ci) => {
      for (let y = 0; y < CELL; y++) {
        const dst = ((HEAD + ri * (CELL + LABEL) + LABEL + y) * W + ci * CELL) * 3;
        canvas.set(cell.rgb.subarray(y * CELL * 3, (y + 1) * CELL * 3), dst);
      }
    }));
    const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const svg = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`,
      `<text x="6" y="20" font-family="sans-serif" font-size="15" font-weight="bold">${esc(c.label)}  [${esc(c.id)}]  t = ${FRACTIONS.map((f) => `${Math.round(f * 100)}%`).join(' / ')}</text>`,
      ...rows.map((r, ri) => `<text x="6" y="${HEAD + ri * (CELL + LABEL) + 16}" font-family="sans-serif" font-size="12">${esc(r.label)}</text>`),
      ...FRACTIONS.map((_, ci) => `<line x1="${ci * CELL}" y1="${HEAD}" x2="${ci * CELL}" y2="${H}" stroke="#ccc"/>`), '</svg>'].join('');
    const out = join(OUT, `retarget-proof-${c.id}.png`);
    await sharp(canvas, { raw: { width: W, height: H, channels: 3 } }).composite([{ input: Buffer.from(svg) }]).png().toFile(out);
    written.push(out);
    console.log(`[proof] wrote ${out}`);
  }
  writeFileSync(join(OUT, 'README.md'), [
    '# Universal retarget visual proof', '',
    'Generated by `npm run retarget:proof` (software rasterizer over the real skinned meshes; no GPU).',
    'Each image: the same CMU source clip; top row = source skeleton (blue = left, red = right), other rows = contrasting target rigs, sampled at the listed time fractions, 3/4 view from each rig\'s own front (derived from its measured frame, so mirrored binds are shown facing the camera too).', '',
    'The view is fixed per rig (its rest front), so when the clip turns the body the figures are seen from behind; all rows turn the same way as the source.', '',
    'Known asset artifact: EDWIN_KENNEDY_unchained\'s mesh has triangles welded between the forearms/hands and the hips/thighs (about 500 bridging triangles in the bind pose, plus arm vertices carrying ~0.1 Hips weight), so any arm raise stretches those triangles into streaks. The skeleton pose is correct; the stretching is from the skin weights, not from the retargeter.', '',
    'CMU source data is CMU-free-use (not CC0) and is not committed; these PNGs are derived renders.', '',
    ...written.map((w) => `- ![](${w.split('/').pop()})`), ''].join('\n'));
}
main().catch((e) => { console.error(e); process.exit(1); });
