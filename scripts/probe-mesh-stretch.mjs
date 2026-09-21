#!/usr/bin/env node
/**
 * WHICH MODELS STRETCH, AND WHERE — measured on the posed mesh.
 *
 * Owner: "a lot of character models, GLBs and attires still have stretching
 * and deformation on certain parts of their body that needs to be fixed ...
 * you keep saying you fixed it universally and it's fixed on some of Pablo's
 * attires, it's fixed on Bannon's attires, but a lot still have it."
 *
 * EVERY EXISTING CHECK LOOKS AT THE FILE AT REST, AND STRETCHING IS A THING
 * THAT HAPPENS IN MOTION. Measured already and come back clean: skin bleed
 * (56 of 59 models, 0 bleeding vertices after the load repair), bone-to-mesh
 * scale (no shipped model inconsistent once the maths was right), rig
 * continuity, joint limits relative to bind. None of them can see a triangle
 * that is fine in bind and three times its length mid-kick.
 *
 * So this poses the mesh and measures the TRIANGLE EDGES. `applyBoneTransform`
 * is three.js's own CPU skinning, so the number is exactly what the GPU
 * draws — not an approximation of it.
 *
 *   STRETCH   an edge's length in the pose over its length in bind. 1.0 is
 *             rigid, and skin legitimately stretches somewhat at a bend, so
 *             the interesting figure is the WORST edge and the share of the
 *             body past a threshold.
 *
 * It reports per model AND per body region, because "which parts" is the
 * actual question — a shoulder that stretches is a different asset problem
 * from a hip that does.
 *
 * Usage: npm run dev, then node scripts/probe-mesh-stretch.mjs [MODEL...]
 */
import { chromium } from 'playwright';

const BASE = process.env.BF_BASE ?? 'http://127.0.0.1:8080';
const ONLY = process.argv.slice(2).filter((a) => !a.startsWith('--'));

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));

await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(7000);
const click = (s) => page.evaluate((x) => {
  const rx = new RegExp(x, 'i');
  const el = [...document.querySelectorAll('button,[role=button],div,span')]
    .find((e) => rx.test((e.innerText || '').trim()) && e.offsetParent !== null && (e.innerText || '').length < 90);
  if (!el) return false; el.click(); return true;
}, s);
await page.click('body'); await page.keyboard.press('Enter'); await page.waitForTimeout(3500);
await click('MOVE LIBRARY'); await page.waitForTimeout(2500);
await click('^BANNON$'); await page.waitForTimeout(2000);
for (let i = 0; i < 60; i++) {
  const ok = await page.evaluate(() => Boolean(document.querySelector('input[placeholder="search"]'))
    && (document.querySelector('[data-cliplist]')?.children.length ?? 0) > 20);
  if (ok) break;
  await page.waitForTimeout(500);
}

const models = await page.evaluate(() => {
  const sel = [...document.querySelectorAll('select')].find((s) => [...s.options].some((o) => /\.glb|rigged|VIPER|BANNON/i.test(o.value)));
  return sel ? [...sel.options].map((o) => o.value) : [];
});
const list = ONLY.length ? ONLY : models;
if (!list.length) { console.log('FAIL: no model picker found'); await browser.close(); process.exit(1); }

/** A demanding pose set: a kick, a punch, a crouch, a grapple. */
const CLIPS = ['AXEKICK', 'GRAFPUNCHCOMBO', 'CROUCHING', 'NECKBREAKER'];

console.log('\nMESH STRETCH UNDER A POSE — worst triangle edge vs its length in bind\n');
console.log('  model                          worst   >1.6x   >2.0x   where it is worst');
const bad = [];
for (const model of list) {
  await page.evaluate((m) => {
    const sel = [...document.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.value === m));
    if (!sel) return;
    sel.value = m;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  }, model);
  await page.waitForTimeout(3500);

  let worstAll = 0; let over16 = 0; let over20 = 0; let total = 0; let where = '-';
  for (const clip of CLIPS) {
    await page.fill('input[placeholder="search"]', clip);
    await page.waitForTimeout(500);
    const picked = await page.evaluate((c) => {
      const b = [...document.querySelectorAll('[data-cliplist] button')].find((x) => (x.textContent || '').trim().startsWith(c));
      if (!b) return false; b.click(); return true;
    }, clip);
    if (!picked) continue;
    await page.waitForTimeout(1400);

    const r = await page.evaluate(() => {
      const w = window;
      let mesh = null;
      // The preview rig is the only skinned mesh on this screen.
      (w.__BF_PREVIEW_SCENE ?? null);
      const findIn = (o) => { o?.traverse?.((x) => { if (x.isSkinnedMesh && !mesh) mesh = x; }); };
      for (const k of ['__BF_SCENE']) findIn(w[k]);
      if (!mesh) {
        // fall back to any renderer scene reachable from the canvas
        const c = document.querySelector('canvas');
        findIn(c && c.__r3f && c.__r3f.root && c.__r3f.root.getState && c.__r3f.root.getState().scene);
      }
      if (!mesh || !mesh.isSkinnedMesh) return null;
      const g = mesh.geometry;
      const pos = g.attributes.position;
      const index = g.index;
      const THREE = mesh.constructor;
      const a = new (pos.constructor === Float32Array ? Object : Object)();
      void a; void THREE;
      const V = (n) => ({ x: 0, y: 0, z: 0, n });
      void V;
      const tmpA = new mesh.position.constructor();
      const tmpB = new mesh.position.constructor();
      const bindA = new mesh.position.constructor();
      const bindB = new mesh.position.constructor();
      const count = index ? index.count : pos.count;
      const step = Math.max(3, Math.floor(count / 6000) * 3);
      let worst = 0; let o16 = 0; let o20 = 0; let n = 0;
      const region = (y, h) => (y > h * 0.75 ? 'head/neck' : y > h * 0.55 ? 'chest/arms' : y > h * 0.35 ? 'waist/hips' : 'legs/feet');
      g.computeBoundingBox();
      const h = g.boundingBox.max.y - g.boundingBox.min.y || 1;
      let worstWhere = '-';
      for (let i = 0; i + 2 < count; i += step) {
        const i0 = index ? index.getX(i) : i;
        const i1 = index ? index.getX(i + 1) : i + 1;
        bindA.fromBufferAttribute(pos, i0);
        bindB.fromBufferAttribute(pos, i1);
        const rest = bindA.distanceTo(bindB);
        if (rest < 1e-4) continue;
        tmpA.fromBufferAttribute(pos, i0);
        tmpB.fromBufferAttribute(pos, i1);
        mesh.applyBoneTransform(i0, tmpA);
        mesh.applyBoneTransform(i1, tmpB);
        const now = tmpA.distanceTo(tmpB);
        const ratio = now / rest;
        n++;
        if (ratio > 1.6) o16++;
        if (ratio > 2.0) o20++;
        if (ratio > worst) { worst = ratio; worstWhere = region(bindA.y - g.boundingBox.min.y, h); }
      }
      return { worst, o16, o20, n, worstWhere };
    });
    if (!r) continue;
    total += r.n; over16 += r.o16; over20 += r.o20;
    if (r.worst > worstAll) { worstAll = r.worst; where = `${r.worstWhere} (${clip})`; }
  }
  if (!total) { console.log(`  ${model.padEnd(30)} (no sample)`); continue; }
  const p16 = ((over16 / total) * 100).toFixed(2);
  const p20 = ((over20 / total) * 100).toFixed(2);
  const flag = over20 / total > 0.002;
  if (flag) bad.push(model);
  console.log(`  ${model.replace(/\.glb$/, '').padEnd(30)}${worstAll.toFixed(2).padStart(6)}x${p16.padStart(8)}%${p20.padStart(8)}%   ${where}${flag ? '   <-- STRETCHING' : ''}`);
}
console.log(`\n  ${list.length} models · ${bad.length} with visible stretching`);
if (bad.length) console.log(`  ${bad.join(', ')}`);
console.log(`\npage errors: ${errs.length}${errs.length ? ' — ' + errs.slice(0, 2).join(' | ') : ''}`);
await browser.close();
