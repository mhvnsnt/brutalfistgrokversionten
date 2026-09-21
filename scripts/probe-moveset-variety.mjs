#!/usr/bin/env node
/**
 * DOES A DIFFERENT INPUT PLAY A DIFFERENT ANIMATION?
 *
 * Owner: "currently can only fire off 4 attacks and it's the base ones ...
 * not forward P/K, jump RK, back, back-forward to fire off different moves.
 * Full movesets and individual movesets so they're not all doing the same
 * attacks — it's boring when all fighters are doing the same 4 attacks the
 * whole fight. That's not like Tekken at all."
 *
 * The inputs were never missing: 26 directional commands exist in the
 * imported graph. They all resolved to THREE animations. So the honest test
 * is not "did a move fire" but "did a DIFFERENT ANIMATION play", read off
 * the mesh's own resolver rather than from the move table.
 *
 * Usage: npm run dev, then node scripts/probe-moveset-variety.mjs
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
await page.waitForTimeout(4000);
const click = (src) => page.evaluate((s) => {
  const rx = new RegExp(s, 'i');
  const el = [...document.querySelectorAll('button,[role=button],div,span')]
    .find((e) => rx.test((e.innerText || '').trim()) && e.offsetParent !== null && (e.innerText || '').length < 90);
  if (!el) return false; el.click(); return true;
}, src);
await click('^VERSUS$'); await page.waitForTimeout(4000);
await click('^BANNON$'); await page.waitForTimeout(2500);
await click('^VIPER$'); await page.waitForTimeout(2500);
await click('^FIGHT!$'); await page.waitForTimeout(8000);
await click('CONFIRM');
let ready = false;
for (let i = 0; i < 90 && !ready; i++) {
  ready = await page.evaluate(() => Boolean(window.__BF_DEBUG?.clips));
  if (!ready) await page.waitForTimeout(1000);
}
if (!ready) { console.log('FAIL: the match never started'); await browser.close(); process.exit(1); }

/**
 * Numpad relative to facing. P1 starts on the left facing right, so forward
 * is ArrowRight. Keys: z/u=LP, x/i=RP, j=LK, k=RK.
 *
 * HELD LONG ENOUGH TO BE SEEN. A 140 ms press is invisible to a 2 fps
 * harness and this repo has been burned by that twice.
 */
const INPUTS = [
  ['5 P  neutral punch', [], 'u'],
  ['6 P  forward punch', ['ArrowRight'], 'u'],
  ['4 P  back punch', ['ArrowLeft'], 'u'],
  ['2 P  down punch', ['ArrowDown'], 'u'],
  ['8 P  up punch', ['ArrowUp'], 'u'],
  ['3 P  down-fwd punch', ['ArrowDown', 'ArrowRight'], 'u'],
  ['5 K  neutral kick', [], 'k'],
  ['6 K  forward kick', ['ArrowRight'], 'k'],
  ['4 K  back kick', ['ArrowLeft'], 'k'],
  ['2 K  down kick', ['ArrowDown'], 'k'],
  ['8 K  up kick', ['ArrowUp'], 'k'],
  ['1 K  down-back kick', ['ArrowDown', 'ArrowLeft'], 'k'],
];

const seen = [];
for (const [label, dirs, btn] of INPUTS) {
  for (const d of dirs) await page.keyboard.down(d);
  await page.waitForTimeout(260);
  await page.keyboard.down(btn);
  await page.waitForTimeout(420);
  await page.keyboard.up(btn);
  // Sample through the move, keeping the clip that is NOT the idle/walk.
  let got = null;
  for (let i = 0; i < 18; i++) {
    const c = await page.evaluate(() => window.__BF_DEBUG?.clips?.()?.p1 ?? null).catch(() => null);
    if (c && !/^(STANCE|WALK|IDLE|BOX_IDLE)/i.test(c)) { got = c; break; }
    await page.waitForTimeout(90);
  }
  for (const d of dirs) await page.keyboard.up(d);
  await page.waitForTimeout(700);
  seen.push({ label, clip: got });
}

console.log('\nDOES A DIFFERENT INPUT PLAY A DIFFERENT ANIMATION?\n');
for (const s of seen) console.log(`  ${s.label.padEnd(24)} -> ${s.clip ?? '(stayed on idle/walk)'}`);
const fired = seen.filter((s) => s.clip);
const distinct = new Set(fired.map((s) => s.clip));
console.log(`\n  ${fired.length} of ${seen.length} inputs produced an attack animation`);
console.log(`  ${distinct.size} DISTINCT animations across them`);
console.log(distinct.size >= 5
  ? '  PASS — the moveset is varied, not four swings.'
  : `  NOT THERE YET — ${distinct.size} distinct is still repetitive.`);
console.log(`\npage errors: ${errs.length}${errs.length ? ' — ' + errs.slice(0, 2).join(' | ') : ''}`);
await browser.close();
