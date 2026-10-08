#!/usr/bin/env node
/**
 * UNIVERSAL RETARGET MATRIX — every clip in the game's pool, plus a
 * representative CMU / UAL / KayKit / Mesh2Motion sample, retargeted onto
 * EVERY fighter rig and measured (see src/engine/retarget/RetargetValidation).
 *
 *   node --experimental-strip-types --import ./scripts/register-ts-resolve.mjs \
 *     scripts/retarget-matrix.mjs [--staging /workspace/oss-anim-staging] [--quick] [--out docs/retarget-matrix]
 *
 * Writes <out>.json (clip x fighter -> PASS/FAIL/UNMAPPABLE/MISSING_CLIP +
 * reasons) and <out>.md (summary). Staged third-party sources are READ from
 * the staging directory and never copied into the repo; when it is absent
 * those rows are recorded as not run, never as PASS.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

import { loadGlbNode } from './retarget/load-glb-node.mjs';
import { buildRetargetRig, eulerKeyFileToClip } from '../src/engine/retarget/UniversalRetarget.ts';
import { cacheRestSkin, retargetAndValidate } from '../src/engine/retarget/RetargetValidation.ts';
import { clipFromBaked } from '../src/engine/retarget/BakedMotionBank.ts';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const QUICK = process.argv.includes('--quick');
const STAGING = arg('--staging', '/workspace/oss-anim-staging');
const OUT = arg('--out', 'docs/retarget-matrix');
const HAS_STAGING = existsSync(join(STAGING, 'MANIFEST.json'));
const t0 = Date.now();
const log = (...a) => console.log(`[retarget-matrix ${((Date.now() - t0) / 1000).toFixed(0)}s]`, ...a);

// ── Targets: every skinned fighter GLB in public/models, plus staged CC0 rigs ──
const targetFiles = readdirSync('public/models').filter((f) => f.endsWith('.glb')).sort().map((f) => ({ id: f.replace(/\.glb$/, ''), file: join('public/models', f), group: 'roster-glb' }));
if (HAS_STAGING) {
  targetFiles.push(
    { id: 'EXT_KayKit_Knight', file: join(STAGING, 'kaykit-adventurers/extracted/KayKit_Adventurers_2.0_FREE/Characters/gltf/Knight.glb'), group: 'external-cc0' },
    { id: 'EXT_UAL2_Mannequin_F', file: join(STAGING, 'quaternius-ual-2/extracted/Universal Animation Library 2[Standard]/Female Mannequin/Unreal-Godot/Mannequin_F.glb'), group: 'external-cc0' },
  );
}
const targets = [];
const skippedTargets = [];
for (const t of (QUICK ? targetFiles.filter((x) => /^(BANNON_rigged|EDWIN_KENNEDY_unchained|wrestler_base|CIPHER_rigged|xbot|EXT_)/.test(x.id)) : targetFiles)) {
  const g = await loadGlbNode(t.file);
  let skinned = false;
  g.scene.traverse((o) => { if (o.isSkinnedMesh) skinned = true; });
  if (!skinned) { skippedTargets.push({ id: t.id, why: 'NO_SKINNED_MESH (static mesh, not a fighter rig)' }); continue; }
  const rig = buildRetargetRig(g.scene, { label: t.id, file: basename(t.file) });
  cacheRestSkin(rig);
  targets.push({ ...t, rig, animations: g.animations });
}
log(`targets: ${targets.length} (skipped ${skippedTargets.length} static)`);

// ── Sources ────────────────────────────────────────────────────────────────
const canonicalGltf = await loadGlbNode('public/models/BANNON_rigged.glb');
const canonical = buildRetargetRig(canonicalGltf.scene, { label: 'BANNON_rigged (canonical 58-joint bind)', file: 'BANNON_rigged.glb' });
const sourceRigs = { canonical: { id: 'canonical', label: canonical.label, rig: canonical } };
const rows = []; // { id, family, sourceRig, clip | null, note }

// 1. The baked bank — the clips the runtime actually plays.
const baked = JSON.parse(readFileSync('public/motion/baked/index.json', 'utf8'));
for (const [name, entry] of Object.entries(baked)) {
  const file = join('public/motion/baked', entry.file ?? `${name}.json`);
  let clip = null;
  try { clip = clipFromBaked(JSON.parse(readFileSync(file, 'utf8'))); } catch { clip = null; }
  rows.push({ id: `baked/${name}`, family: `baked:${entry.bank}`, sourceRig: 'canonical', clip, note: clip ? '' : 'baked file unreadable' });
}
// 2. The raw Bannon Euler (rx/ry/rz) motion bank.
for (const f of readdirSync('public/motion').filter((x) => x.endsWith('.json')).sort()) {
  let data;
  try { data = JSON.parse(readFileSync(join('public/motion', f), 'utf8')); } catch { continue; }
  if (!Array.isArray(data?.keys) || !data.keys.length) continue;
  const first = Object.keys(data.keys[0].bones ?? {});
  const mixamo = first.some((b) => /^mixamorig/i.test(b));
  const clip = eulerKeyFileToClip(f.replace(/\.json$/, ''), data);
  rows.push({
    id: `euler/${f.replace(/\.json$/, '')}`,
    family: mixamo ? 'euler:mixamo-space' : `euler:${first[0] ?? 'unknown'}-rig`,
    sourceRig: mixamo ? 'canonical' : null,
    clip,
    note: mixamo ? '' : `SOURCE_RIG_UNAVAILABLE: ${first.length}-joint "${first[0]}" rig; no rest skeleton ships with this bank`,
  });
}
// 3. Clips embedded in shipped GLBs (Mixamo-named xbot etc.).
for (const t of targets) {
  if (!t.animations.length) continue;
  sourceRigs[`glb:${t.id}`] = { id: `glb:${t.id}`, label: t.id, rig: buildRetargetRig((await loadGlbNode(t.file)).scene, { label: t.id, file: basename(t.file) }) };
  for (const clip of t.animations) rows.push({ id: `glb/${t.id}/${clip.name}`, family: 'glb-embedded', sourceRig: `glb:${t.id}`, clip, note: '' });
}
// 4. Staged external sources — a representative sample.
const external = [];
if (HAS_STAGING) {
  const manifest = JSON.parse(readFileSync(join(STAGING, 'MANIFEST.json'), 'utf8'));
  const addGlbSource = async (key, file, pick, family) => {
    if (!existsSync(file)) return;
    const g = await loadGlbNode(file);
    sourceRigs[key] = { id: key, label: basename(file), rig: buildRetargetRig(g.scene, { label: basename(file), file: basename(file) }) };
    for (const clip of g.animations.filter(pick)) rows.push({ id: `${family}/${clip.name}`, family, sourceRig: key, clip, note: '' });
    external.push({ family, file: file.replace(STAGING, '<staging>'), clips: g.animations.filter(pick).length });
  };
  const all = () => true;
  const every = (n) => { let i = 0; return () => (i++ % n) === 0; };
  await addGlbSource('ual1', join(STAGING, 'quaternius-ual-1/extracted/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb'), QUICK ? every(8) : all, 'ual1');
  await addGlbSource('ual2', join(STAGING, 'quaternius-ual-2/extracted/Universal Animation Library 2[Standard]/Unreal-Godot/UAL2_Standard.glb'), QUICK ? every(8) : all, 'ual2');
  const kk = join(STAGING, 'kaykit-character-animations/extracted/KayKit_Character_Animations_1.1/Animations/gltf');
  for (const f of ['Rig_Medium/Rig_Medium_CombatMelee.glb', 'Rig_Medium/Rig_Medium_MovementBasic.glb', 'Rig_Medium/Rig_Medium_General.glb', 'Rig_Large/Rig_Large_CombatMelee.glb']) {
    await addGlbSource(`kaykit:${f}`, join(kk, f), QUICK ? every(6) : all, `kaykit/${basename(f, '.glb')}`);
  }
  await addGlbSource('m2m', join(STAGING, 'mesh2motion/files/human-mocap-animations.glb'), QUICK ? every(6) : all, 'mesh2motion-mocap');
  await addGlbSource('m2m-base', join(STAGING, 'mesh2motion/files/human-base-animations.glb'), QUICK ? every(20) : every(4), 'mesh2motion-base');
  // CMU: deterministic per-category sample of solo segments.
  const segs = (manifest.cmu_segments?.segments ?? []).filter((s) => !s.paired && s.glb).sort((a, b) => a.id.localeCompare(b.id));
  const per = { 'strike-punch': 6, 'strike-kick': 6, knee: 3, block: 3, 'dodge/sidestep': 3, knockdown: 2, wakeup: 2, 'hit-react': 2 };
  let cmuCount = 0;
  for (const [cat, n0] of Object.entries(per)) {
    const n = QUICK ? Math.min(2, n0) : n0;
    const list = segs.filter((s) => s.category === cat);
    for (let k = 0; k < n && list.length; k++) {
      const s = list[Math.floor((k * list.length) / n)];
      const file = join(STAGING, s.glb);
      if (!existsSync(file)) continue;
      const g = await loadGlbNode(file);
      const key = `cmu:${s.id}`;
      sourceRigs[key] = { id: key, label: 'CMU 31-joint BVH skeleton (metres)', rig: buildRetargetRig(g.scene, { label: s.id, file: basename(file) }) };
      rows.push({ id: `cmu/${s.id}`, family: `cmu:${cat}`, sourceRig: key, clip: g.animations[0] ?? null, note: '' });
      cmuCount++;
    }
  }
  external.push({ family: 'cmu', file: '<staging>/cmu-segments/glb', clips: cmuCount });
}
log(`rows: ${rows.length}`);

// ── Run ────────────────────────────────────────────────────────────────────
const cells = {};
const totals = { PASS: 0, FAIL: 0, UNMAPPABLE: 0, MISSING_CLIP: 0 };
const reasonCounts = {};
const perFighter = {};
const perFamily = {};
const bump = (o, k, v) => { o[k] ??= { PASS: 0, FAIL: 0, UNMAPPABLE: 0, MISSING_CLIP: 0 }; o[k][v]++; };
const reasonKey = (r) => r.replace(/\(.*?\)/g, '').replace(/[0-9.]+/g, 'N').replace(/: .*/, (m) => (m.length > 60 ? m.slice(0, 60) : m)).trim();
let done = 0;
for (const row of rows) {
  const src = row.sourceRig ? sourceRigs[row.sourceRig]?.rig : null;
  cells[row.id] = {};
  for (const t of targets) {
    let verdict; let reasons;
    if (!row.clip || !row.clip.tracks.length) { verdict = 'MISSING_CLIP'; reasons = [row.note || 'MISSING_CLIP: no tracks']; }
    else if (!src) { verdict = 'UNMAPPABLE'; reasons = [row.note || 'UNMAPPABLE: source rig unknown']; }
    else {
      try {
        const r = retargetAndValidate(row.clip, src, t.rig, { fps: 30, maxSamples: QUICK ? 30 : 60 });
        verdict = r.verdict; reasons = r.reasons;
      } catch (e) { verdict = 'FAIL'; reasons = [`EXCEPTION: ${e instanceof Error ? e.message : String(e)}`]; }
    }
    totals[verdict]++;
    bump(perFighter, t.id, verdict);
    bump(perFamily, row.family, verdict);
    for (const r of reasons) { const k = `${verdict}: ${reasonKey(r)}`; reasonCounts[k] = (reasonCounts[k] ?? 0) + 1; }
    cells[row.id][t.id] = verdict === 'PASS' ? 'PASS' : `${verdict}|${reasons.join('; ')}`;
  }
  if (++done % 50 === 0) log(`${done}/${rows.length} clips`);
}

// ── Bone-map coverage per rig ──────────────────────────────────────────────
const coverage = {};
const describe = (rig) => ({
  joints: rig.map.jointCount,
  coverage: Math.round(rig.map.coverage * 100) / 100,
  missingRequired: rig.map.missingRequired,
  spine: rig.map.spine.length,
  neck: rig.map.neck.length,
  clavicles: ['leftClavicle', 'rightClavicle'].filter((s) => rig.map.slots[s]).length,
  toes: ['leftToes', 'rightToes'].filter((s) => rig.map.slots[s]).length,
  fingers: Object.keys(rig.map.fingers).length,
  handedness: rig.handedness === -1 ? 'mirrored' : 'right-handed',
  legLength: Math.round(rig.legLength * 1000) / 1000,
  methods: [...new Set(Object.values(rig.map.method))].join('+'),
});
for (const t of targets) coverage[t.id] = { role: 'target', ...describe(t.rig) };
for (const s of Object.values(sourceRigs)) {
  const key = s.id.startsWith('cmu:') ? 'source:cmu (31-joint BVH)' : `source:${s.id}`;
  if (!coverage[key]) coverage[key] = { role: 'source', label: s.label, ...describe(s.rig) };
}

const topReasons = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1]).slice(0, 25);
const out = {
  generatedAt: new Date().toISOString(),
  mode: QUICK ? 'quick' : 'full',
  staging: HAS_STAGING ? 'present' : 'ABSENT — external rows not run',
  law: 'PASS = every check passed. UNKNOWN is never PASS. UNMAPPABLE/MISSING_CLIP are failures shown, not hidden.',
  checks: ['requiredBones', 'noNaN', 'duration', 'limbLengths', 'noFlips', 'feet', 'effectors', 'deforms'],
  totals, cellCount: rows.length * targets.length, clips: rows.length, fighters: targets.map((t) => t.id), skippedTargets,
  external, coverage, perFighter, perFamily, topReasons, cells,
};
writeFileSync(`${OUT}.json`, JSON.stringify(out));

// ── Markdown summary ───────────────────────────────────────────────────────
const pct = (o) => { const n = o.PASS + o.FAIL + o.UNMAPPABLE + o.MISSING_CLIP; return n ? `${((100 * o.PASS) / n).toFixed(1)}%` : '-'; };
const md = [];
md.push('# Universal retarget matrix', '');
md.push(`Generated ${new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })} CT by \`scripts/retarget-matrix.mjs\` (${out.mode}). Machine-readable: \`${basename(OUT)}.json\` (clip × fighter → verdict + reasons).`, '');
md.push('Status law: PASS means every measured check passed on a headless FK + skinning evaluation. It is NOT visual/PWA certification — that stays UNKNOWN until a browser run confirms it. UNMAPPABLE and MISSING_CLIP are shown as failures, never faked.', '');
md.push(`Checks per cell: ${out.checks.join(', ')}.`, '');
md.push('## Totals', '', `${rows.length} clips × ${targets.length} fighter rigs = ${out.cellCount} cells.`, '');
md.push('| PASS | FAIL | UNMAPPABLE | MISSING_CLIP |', '|---|---|---|---|', `| ${totals.PASS} | ${totals.FAIL} | ${totals.UNMAPPABLE} | ${totals.MISSING_CLIP} |`, '');
md.push('## Top failure reasons', '', '| cells | reason |', '|---|---|');
for (const [k, n] of topReasons) if (!k.startsWith('PASS')) md.push(`| ${n} | ${k.replace(/\|/g, '/')} |`);
md.push('', '## By clip family', '', '| family | PASS | FAIL | UNMAPPABLE | MISSING_CLIP | pass rate |', '|---|---|---|---|---|---|');
for (const [k, v] of Object.entries(perFamily).sort()) md.push(`| ${k} | ${v.PASS} | ${v.FAIL} | ${v.UNMAPPABLE} | ${v.MISSING_CLIP} | ${pct(v)} |`);
md.push('', '## By fighter rig', '', '| fighter | joints | map coverage | spine | neck | clav | toes | fingers | handedness | PASS | FAIL | UNMAPPABLE | MISSING | pass rate |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const t of targets) { const c = coverage[t.id]; const v = perFighter[t.id]; md.push(`| ${t.id} | ${c.joints} | ${c.coverage} | ${c.spine} | ${c.neck} | ${c.clavicles} | ${c.toes} | ${c.fingers} | ${c.handedness} | ${v.PASS} | ${v.FAIL} | ${v.UNMAPPABLE} | ${v.MISSING_CLIP} | ${pct(v)} |`); }
md.push('', '## Source rigs (bone-map coverage)', '', '| source | joints | coverage | missing required | spine | neck | clav | toes | fingers | handedness | detection |', '|---|---|---|---|---|---|---|---|---|---|---|');
for (const [k, c] of Object.entries(coverage)) if (c.role === 'source') md.push(`| ${k} | ${c.joints} | ${c.coverage} | ${c.missingRequired.join(',') || '-'} | ${c.spine} | ${c.neck} | ${c.clavicles} | ${c.toes} | ${c.fingers} | ${c.handedness} | ${c.methods} |`);
if (skippedTargets.length) { md.push('', '## GLBs not treated as fighter rigs', ''); for (const s of skippedTargets) md.push(`- ${s.id}: ${s.why}`); }
md.push('', '## External sample', '', HAS_STAGING ? external.map((e) => `- ${e.family}: ${e.clips} clip(s) from \`${e.file}\``).join('\n') : '- staging absent: NOT RUN (not PASS)', '');
md.push('Third-party sources are read from the staging directory only; none are committed. CMU segments are CMU-free-use (not CC0).', '');
writeFileSync(`${OUT}.md`, md.join('\n'));
log(`done: ${JSON.stringify(totals)} -> ${OUT}.json / ${OUT}.md`);
