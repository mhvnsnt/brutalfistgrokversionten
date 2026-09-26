#!/usr/bin/env node
/**
 * IS THE BODY ON SCREEN THE ONE THE REPAIR FIXED?
 *
 * Owner, for weeks and again now: "on Wreck Patterson and Titan they still have
 * parts of their arms attached to parts of their hips and legs."
 *
 * Every check so far has run runCharacterPipeline in a test harness and come
 * back clean — 4 of 4 models, zero bleeding vertices after the load-time prune.
 * The repo already warns about exactly this gap: the question is not whether
 * the repair works, it is whether the mesh BEING RENDERED went through it.
 *
 * So this walks the LIVE scene of a real match between the two fighters he
 * named, using __BF_DEBUG.skinBleed(), and counts vertices pulled by joints too
 * far apart on the skeleton to share one. A clean result here means something
 * the harness result did not.
 *
 * Usage: npm run dev, then node scripts/probe-live-skin.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.BF_BASE ?? 'http://127.0.0.1:8080';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));

await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(8000);
await page.click('body');
await page.keyboard.press('Enter');
await page.waitForTimeout(5000);
const click = (s) => page.evaluate((x) => {
  const rx = new RegExp(x, 'i');
  const el = [...document.querySelectorAll('button,[role=button],div,span')]
    .find((e) => rx.test((e.innerText || '').trim()) && e.offsetParent !== null && (e.innerText || '').length < 90);
  if (!el) return false; el.click(); return true;
}, s);

await click('^VERSUS$'); await page.waitForTimeout(4000);
// THE TWO HE NAMED, not whichever two are first in the list.
const p1 = await click('WRECK');
await page.waitForTimeout(2500);
const p2 = await click('^TITAN$');
await page.waitForTimeout(2500);
await click('^FIGHT!$'); await page.waitForTimeout(8000);
await click('CONFIRM');

let live = false;
for (let i = 0; i < 90; i++) {
  if (await page.evaluate(() => typeof window.__BF_DEBUG?.skinBleed === 'function'
    && typeof window.__BF_DEBUG?.positions?.().p1?.x === 'number')) { live = true; break; }
  await page.waitForTimeout(1000);
}
if (!live) {
  console.log('NEVER REACHED THE ARENA — nothing below would mean anything.');
  console.log(`  picked p1 WRECK: ${p1}   p2 TITAN: ${p2}`);
  console.log('  visible buttons:', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('button,[role=button]')]
    .filter((e) => e.offsetParent && (e.innerText || '').trim()).map((e) => (e.innerText || '').trim().slice(0, 22)).slice(0, 22))));
  console.log('  __BF_DEBUG keys:', await page.evaluate(() => Object.keys(window.__BF_DEBUG ?? {})));
  await browser.close(); process.exit(1);
}
// Give the models time to bind; a procedural body has no skin to measure.
await page.waitForTimeout(12000);

const report = await page.evaluate(() => window.__BF_DEBUG.skinBleed());
console.log(`\nLIVE SCENE SKIN BLEED — WRECK PATTERSON vs TITAN  (picked p1 ${p1}, p2 ${p2})\n`);
if (!Array.isArray(report)) {
  console.log('  ', JSON.stringify(report));
} else if (!report.length) {
  console.log('  NO SKINNED MESH IN THE LIVE SCENE — the bodies on screen are not skinned at all.');
} else {
  let total = 0;
  for (const m of report) {
    total += m.bleeding ?? 0;
    console.log(`  ${String(m.name ?? '?').padEnd(26).slice(0, 26)} ${String(m.bleeding ?? 0).padStart(6)} bleeding of ${String(m.verts ?? '?').padStart(7)}`
      + `   worst ${JSON.stringify(m.worst ?? [])}`);
  }
  console.log(`\n  ${total === 0
    ? 'CLEAN — the bodies actually on screen carry no cross-body weights.'
    : `${total} bleeding vertices ARE on screen — the repair is not reaching the rendered mesh.`}`);
}
console.log(`\npage errors: ${errs.length}${errs.length ? ' — ' + errs.slice(0, 2).join(' | ') : ''}`);
await browser.close();
