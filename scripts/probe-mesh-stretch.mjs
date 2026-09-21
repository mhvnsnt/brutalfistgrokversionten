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
console.log('  model                         worst   grew by    >1.6x    >2.0x   where');
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
  let wBadAll = 0; let wZeroAll = 0; let wNAll = 0; let wWorstAll = 1; let worstCmAll = 0;
  let farNAll = 0; let farTotalAll = 0; let farWorstAll = 0; let farBoneAll = '-';
  for (const clip of CLIPS) {
    // WAIT FOR THE SCREEN RATHER THAN ASSUMING IT. Swapping the model
    // rebuilds the preview, and a fixed sleep left this calling page.fill on
    // a search box that had not come back yet — a 30 s timeout that reads
    // like a broken selector.
    let up = false;
    for (let i = 0; i < 60 && !up; i++) {
      up = await page.evaluate(() => Boolean(document.querySelector('input[placeholder="search"]'))
        && Boolean(window.__BF_PREVIEW_MESH?.()));
      if (!up) await page.waitForTimeout(500);
    }
    if (!up) break;
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
      // THE PREVIEW PUBLISHES ITS OWN RIG. The first version of this looked
      // on `__BF_SCENE`, which the COMBAT ARENA publishes and this screen
      // does not, so it found nothing and reported "(no sample)" for every
      // model — a clean-looking sweep that had measured nothing at all.
      const mesh = w.__BF_PREVIEW_MESH ? w.__BF_PREVIEW_MESH() : null;
      if (!mesh || !mesh.isSkinnedMesh) return null;
      const g = mesh.geometry;
      const pos = g.attributes.position;
      const index = g.index;
      const tmpA = new mesh.position.constructor();
      const tmpB = new mesh.position.constructor();
      const bindA = new mesh.position.constructor();
      const bindB = new mesh.position.constructor();
      const count = index ? index.count : pos.count;
      const step = Math.max(3, Math.floor(count / 6000) * 3);
      let worst = 0; let o16 = 0; let o20 = 0; let n = 0; let worstCm = 0;
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
        /**
         * A RATIO IS MEANINGLESS ON A MICROSCOPIC EDGE.
         *
         * The first version of this skipped only degenerate edges (under
         * 0.1 mm) and reported a worst stretch of 258x on JAGER. A dense
         * mesh is full of sub-millimetre edges around the face and fingers,
         * and a 0.1 mm edge that moves 2.6 cm IS a ratio of 258 while being
         * invisible. The number was real arithmetic on the wrong edges.
         *
         * Only edges a person could see are measured — 5 mm and up — and the
         * growth is also reported in CENTIMETRES, because "this edge grew
         * 4 cm" is a statement about the screen and "it grew 3x" is not.
         */
        if (rest < 0.005) continue;
        tmpA.fromBufferAttribute(pos, i0);
        tmpB.fromBufferAttribute(pos, i1);
        mesh.applyBoneTransform(i0, tmpA);
        mesh.applyBoneTransform(i1, tmpB);
        const now = tmpA.distanceTo(tmpB);
        const ratio = now / rest;
        n++;
        if (ratio > 1.6) o16++;
        if (ratio > 2.0) o20++;
        const grewCm = (now - rest) * 100;
        if (grewCm > worstCm) worstCm = grewCm;
        if (ratio > worst) { worst = ratio; worstWhere = region(bindA.y - g.boundingBox.min.y, h); }
      }
      /**
       * DO THE WEIGHTS SUM TO ONE?
       *
       * A vertex whose four influences sum to 0.2 is dragged a fifth of the
       * way toward the origin by skinning; one summing to 4 is flung out.
       * Either reads on screen as a stretched triangle, and NEITHER SHOWS IN
       * BIND POSE, because in bind the joint transforms cancel their own
       * inverse bind matrices and the error multiplies by a matrix that is
       * the identity. Read off the LIVE mesh because every shipped model is
       * meshopt-compressed and the file cannot be read directly.
       */
      /**
       * IS A VERTEX BOUND TO A BONE NOWHERE NEAR IT?
       *
       * The skin-bleed audit measures PAIRS of influences too far apart on
       * the skeleton to share a vertex, and the load repair drops the
       * stray one. A vertex with a SINGLE influence has no pair, so neither
       * can see it — and a chest vertex weighted 100% to a shin is exactly
       * the thing that flies a metre across the room when the leg kicks.
       *
       * Measured in BIND: how far the vertex sits from the bind position of
       * its heaviest joint. A vertex belongs within arm's reach of the bone
       * that carries it.
       */
      const swI = g.attributes.skinIndex;
      const swW = g.attributes.skinWeight;
      let farN = 0; let farWorst = 0; let farTotal = 0; let farBone = '-';
      if (swI && swW && mesh.skeleton?.boneInverses) {
        /**
         * MEASURED IN BIND SPACE, WHERE BOTH THINGS ACTUALLY LIVE.
         *
         * The first version posed the vertex with `applyBoneTransform`,
         * which returns MESH-LOCAL coordinates, and compared it against
         * `bone.matrixWorld`, which is WORLD. Two different spaces, so the
         * error was whatever the model's group transform happened to be —
         * it reported 100% of ONYX's and VIPER's vertices as far-bound and
         * a vertex SIX METRES from its bone, while BANNON under a different
         * transform read 0.39%. Nonsense, and the third frame-of-reference
         * mistake in this session.
         *
         * A bone's BIND position is the translation of the inverse of its
         * inverse-bind matrix, and that is the same space the position
         * attribute is in. No posing, no world transform, nothing to
         * mismatch.
         */
        const bones = mesh.skeleton.bones;
        const inv = mesh.skeleton.boneInverses;
        const M = new (mesh.matrixWorld.constructor)();
        const bp = inv.map((m2) => {
          M.copy(m2).invert();
          const e = M.elements;
          return [e[12], e[13], e[14]];
        });
        const vtmp = new mesh.position.constructor();
        const stepV = Math.max(1, Math.floor(swI.count / 6000));
        for (let v = 0; v < swI.count; v += stepV) {
          let best = -1; let bw = 0;
          for (let k = 0; k < 4; k++) {
            const w2 = swW.getComponent(v, k);
            if (w2 > bw) { bw = w2; best = swI.getComponent(v, k); }
          }
          if (best < 0 || !bp[best]) continue;
          vtmp.fromBufferAttribute(pos, v);
          // THROUGH bindMatrix, which is the space the inverse-bind matrices
          // are expressed in. Without it a model whose skin node carries a
          // transform — JAGER's mesh is authored feet-at-origin while his
          // skeleton is centred, 0.85 m apart — reads as 100% far-bound
          // when the offset is legitimately absorbed here. `applyBoneTransform`
          // does exactly this internally, which is why the STRETCH number
          // was unaffected and trustworthy while this one was not.
          vtmp.applyMatrix4(mesh.bindMatrix);
          const b2 = bp[best];
          const d = Math.hypot(vtmp.x - b2[0], vtmp.y - b2[1], vtmp.z - b2[2]);
          farTotal++;
          if (d > 0.45) farN++;
          if (d > farWorst) { farWorst = d; farBone = (bones[best]?.name || '').replace('mixamorig', ''); }
        }
      }
      const sw = g.attributes.skinWeight;
      let wBad = 0; let wZero = 0; let wWorst = 1; let wN = 0;
      if (sw) {
        for (let v = 0; v < sw.count; v += Math.max(1, Math.floor(sw.count / 8000))) {
          let sum = 0;
          for (let k = 0; k < 4; k++) sum += sw.getComponent(v, k);
          wN++;
          if (sum < 1e-6) { wZero++; wBad++; continue; }
          if (Math.abs(sum - 1) > 0.02) wBad++;
          if (Math.abs(sum - 1) > Math.abs(wWorst - 1)) wWorst = sum;
        }
      }
      return { worst, o16, o20, n, worstWhere, worstCm, wBad, wZero, wWorst, wN, farN, farWorst, farTotal, farBone };
    });
    if (!r) continue;
    total += r.n; over16 += r.o16; over20 += r.o20;
    wBadAll += r.wBad ?? 0; wZeroAll += r.wZero ?? 0; wNAll += r.wN ?? 0;
    if (Math.abs((r.wWorst ?? 1) - 1) > Math.abs(wWorstAll - 1)) wWorstAll = r.wWorst;
    if (r.worstCm > worstCmAll) worstCmAll = r.worstCm;
    farNAll += r.farN ?? 0; farTotalAll += r.farTotal ?? 0;
    if ((r.farWorst ?? 0) > farWorstAll) { farWorstAll = r.farWorst; farBoneAll = r.farBone; }
    if (r.worst > worstAll) { worstAll = r.worst; where = `${r.worstWhere} (${clip})`; }
  }
  if (!total) { console.log(`  ${model.padEnd(30)} (no sample)`); continue; }
  const p16 = ((over16 / total) * 100).toFixed(2);
  const p20 = ((over20 / total) * 100).toFixed(2);
  const flag = over20 / total > 0.002;
  if (flag) bad.push(model);
  const wPct = wNAll ? ((wBadAll / wNAll) * 100).toFixed(2) : '0.00';
  void wPct; void wWorstAll; void wZeroAll;
  const farPct = farTotalAll ? ((farNAll / farTotalAll) * 100).toFixed(2) : '0.00';
  console.log(`  ${model.replace(/\.glb$/, '').padEnd(28)}${worstAll.toFixed(1).padStart(7)}x${worstCmAll.toFixed(1).padStart(8)}cm${p16.padStart(8)}%${p20.padStart(8)}%  far-bound ${farPct.padStart(6)}% worst ${farWorstAll.toFixed(2)}m@${farBoneAll}   ${where}${flag ? '  <-- STRETCHING' : ''}`);
}
console.log(`\n  ${list.length} models · ${bad.length} with visible stretching`);
if (bad.length) console.log(`  ${bad.join(', ')}`);
console.log(`\npage errors: ${errs.length}${errs.length ? ' — ' + errs.slice(0, 2).join(' | ') : ''}`);
await browser.close();
