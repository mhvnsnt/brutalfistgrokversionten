#!/usr/bin/env node
/**
 * DOES THE BODY GO DOWN, OR DO THE FEET COME UP?
 *
 * Owner, more than once: "the feet lifting off of the ground instead of the
 * pelvis and torso moving down towards the feet at times where it's like a
 * crouch. It should be crouching down, moving the torso and pelvis and all
 * the body parts down towards the feet while the knees bend ... moving all
 * the body down in world space." And "they're kind of levitating off the
 * ground too."
 *
 * The banks are rotation-only, so the pelvis is the FK ROOT: bending the
 * knees lifts the FEET unless something lowers the hips. This samples the
 * LIVE rig in the Move Library preview and reports, per clip, how far the
 * hips travel vertically and how far the lowest foot does. A crouch that is
 * working moves the HIPS and leaves the feet roughly where they are.
 *
 * Usage: npm run dev, then node scripts/probe-crouch-grounding.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.BF_BASE ?? 'http://127.0.0.1:8080';
const CLIPS = ['CROUCHING', 'SHAZLOWRUSH_CROUCH', 'GRAFCROUCHEXTENDARM', 'DUCKINGCOMET', 'JUMP', 'STANCE'];

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 915, height: 412 }, isMobile: true, hasTouch: true });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));

await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(7000);
const click = (src) => page.evaluate((s) => {
  const rx = new RegExp(s, 'i');
  const el = [...document.querySelectorAll('button,[role=button],div,span')]
    .find((e) => rx.test((e.innerText || '').trim()) && e.offsetParent !== null && (e.innerText || '').length < 90);
  if (!el) return false;
  el.click();
  return true;
}, src);

await page.click('body');
await page.keyboard.press('Enter');
await page.waitForTimeout(3500);
await click('MOVE LIBRARY'); await page.waitForTimeout(2500);
await click('^BANNON$'); await page.waitForTimeout(2000);
// WAIT FOR THE SCREEN, DO NOT ASSUME IT. A fixed sleep after the fighter
// click left this probe calling page.fill on a search box that did not exist
// yet, and it died with a 30s timeout that looked like a broken selector.
let ready = false;
for (let i = 0; i < 60; i++) {
  ready = await page.evaluate(() =>
    Boolean(document.querySelector('input[placeholder="search"]'))
    && (document.querySelector('[data-cliplist]')?.children.length ?? 0) > 20);
  if (ready) break;
  await page.waitForTimeout(500);
}
if (!ready) { console.log('FAIL: the clip list never arrived'); await browser.close(); process.exit(1); }

console.log('\nCROUCH — DOES THE BODY GO DOWN, OR DO THE FEET COME UP?\n');
console.log('  clip                     hips travel   lowest-foot travel   verdict');
for (const clip of CLIPS) {
  // Select it by typing into the search box, which is the same route a
  // person uses — not by reaching into React state.
  await page.fill('input[placeholder="search"]', clip);
  await page.waitForTimeout(700);
  const picked = await page.evaluate((c) => {
    const btn = [...document.querySelectorAll('[data-cliplist] button')]
      .find((b) => (b.textContent || '').trim().startsWith(c));
    if (!btn) return false;
    btn.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
    btn.click();
    return true;
  }, clip);
  if (!picked) { console.log(`  ${clip.padEnd(24)} (not in the list)`); continue; }
  await page.waitForTimeout(1200);

  // Sample the live skeleton through one pass of the clip.
  const s = await page.evaluate(async () => {
    const hips = [];
    const feet = [];
    const t0 = performance.now();
    while (performance.now() - t0 < 2500) {
      const r = (window.__BF_PREVIEW_SAMPLE ?? (() => null))();
      if (r) { hips.push(r.hipsY); feet.push(r.footY); }
      await new Promise((res) => requestAnimationFrame(res));
    }
    const span = (a) => (a.length ? Math.max(...a) - Math.min(...a) : 0);
    return { n: hips.length, hips: +span(hips).toFixed(3), feet: +span(feet).toFixed(3) };
  });
  if (!s.n) { console.log(`  ${clip.padEnd(24)} (no sampler on the page)`); continue; }
  const verdict = s.hips > 0.10 && s.hips >= s.feet
    ? 'body moves — correct'
    : s.feet > 0.10 && s.feet > s.hips
      ? 'FEET COME UP — the defect'
      : 'little vertical motion';
  console.log(`  ${clip.padEnd(24)} ${String(s.hips).padStart(6)}m      ${String(s.feet).padStart(6)}m         ${verdict}`);
}
console.log(`\npage errors: ${errs.length}${errs.length ? ' — ' + errs.slice(0, 2).join(' | ') : ''}`);
await browser.close();
