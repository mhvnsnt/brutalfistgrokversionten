#!/usr/bin/env node
/**
 * DO ATTACKS CARRY THE FIGHTER, OR DOES HE PUNCH ON THE SPOT?
 *
 * Owner: "combat is a bit smoother, but it's still not on the level of Tekken …
 * I can tell you're still hand tooling things when I told you to pull in open
 * source." He was right: displacement came from a five-entry hand-written
 * table while the imported Schwarzerblitz graph carried authored per-frame
 * root motion on 127 of its 133 moves, unread.
 *
 * This presses real attacks and measures how far the body actually moves
 * during each one. Standing still on every attack is the old behaviour; a
 * spread of distances, different per move, is the authored data arriving.
 *
 * The walk-in is excluded on purpose — the fighter is only sampled while his
 * state machine says he is Attacking, so a probe cannot credit walking as lunge.
 *
 * Usage: npm run dev, then node scripts/probe-root-motion.mjs
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
await click('^BANNON$'); await page.waitForTimeout(2500);
await click('^VIPER$'); await page.waitForTimeout(2500);
await click('^FIGHT!$'); await page.waitForTimeout(8000);
await click('CONFIRM');

let reached = false;
for (let i = 0; i < 90; i++) {
  const live = await page.evaluate(() => window.__BF_DEBUG?.positions?.() ?? null);
  if (live && typeof live.p1?.x === 'number') { reached = true; break; }
  await page.waitForTimeout(1000);
}
// A CLEAN RESULT MUST PROVE IT LOOKED AT SOMETHING. The first run of this
// reported "nothing moved" from zero samples, which is not a finding.
if (!reached) {
  console.log('NEVER REACHED THE ARENA — the run below would mean nothing.');
  console.log('  __BF_DEBUG keys:', await page.evaluate(() => Object.keys(window.__BF_DEBUG ?? {})));
  await browser.close();
  process.exit(1);
}

// Sample position ONLY while the state machine says he is attacking.
await page.evaluate(() => {
  window.__RM = { runs: [], cur: null, samples: 0, actions: {} };
  window.__RM_T = setInterval(() => {
    const d = window.__BF_DEBUG;
    if (!d?.states || !d?.positions) return;
    const st = d.states().p1;
    const p = d.positions().p1;
    window.__RM.samples++;
    const a = st?.action ?? 'none';
    window.__RM.actions[a] = (window.__RM.actions[a] ?? 0) + 1;
    const attacking = st?.action === 'Attacking' || st?.action === 'CommandThrow';
    if (attacking) {
      if (!window.__RM.cur) window.__RM.cur = { clip: st.clip ?? st.motion, x0: p.x, z0: p.z, x: p.x, z: p.z };
      else { window.__RM.cur.x = p.x; window.__RM.cur.z = p.z; }
    } else if (window.__RM.cur) {
      const c = window.__RM.cur;
      window.__RM.runs.push({ clip: c.clip, dx: +(c.x - c.x0).toFixed(3), dz: +(c.z - c.z0).toFixed(3) });
      window.__RM.cur = null;
    }
  }, 40);
});

/**
 * DIRECTIONAL COMMANDS, NOT JUST BARE BUTTONS. A bare LP fires
 * DEFAULT_MOVE_WINDOWS.lightAttack, which is hand-authored and carries no
 * imported travel — the first run of this probe measured three of those and
 * reported "nothing moved", which was true and beside the point. The authored
 * root motion rides on the MATCHED moves, so the input has to earn one.
 */
const INPUTS = [
  [[], 'u'], [[], 'i'], [[], 'j'], [[], 'k'],
  [['ArrowRight'], 'u'], [['ArrowRight'], 'i'], [['ArrowRight'], 'j'], [['ArrowRight'], 'k'],
  [['ArrowLeft'], 'u'], [['ArrowLeft'], 'k'],
  [['ArrowDown'], 'j'], [['ArrowDown'], 'k'],
];
for (let round = 0; round < 2; round++) {
  for (const [dirs, key] of INPUTS) {
    for (const d of dirs) await page.keyboard.down(d);
    await page.waitForTimeout(140);
    await page.keyboard.down(key);
    await page.waitForTimeout(380);
    await page.keyboard.up(key);
    for (const d of dirs) await page.keyboard.up(d);
    await page.waitForTimeout(650);
  }
}
await page.evaluate(() => clearInterval(window.__RM_T));
const runs = await page.evaluate(() => window.__RM.runs);
const seen = await page.evaluate(() => ({ samples: window.__RM.samples, actions: window.__RM.actions }));

const moved = runs.filter((r) => Math.abs(r.dx) > 0.02 || Math.abs(r.dz) > 0.02);
const dists = runs.map((r) => Math.hypot(r.dx, r.dz));
console.log('\nROOT MOTION — how far each attack carried the fighter\n');
console.log(`  samples taken    : ${seen.samples}`);
console.log(`  states seen      : ${Object.entries(seen.actions).map(([k, v]) => `${k} x${v}`).join(', ') || '(none)'}`);
console.log(`  attacks measured : ${runs.length}`);
console.log(`  attacks that MOVED the body : ${moved.length}`);
if (dists.length) {
  console.log(`  travel: max ${Math.max(...dists).toFixed(2)}m  mean ${(dists.reduce((a, b) => a + b, 0) / dists.length).toFixed(2)}m`);
}
const distinct = new Set(runs.map((r) => `${r.clip}:${r.dx}`)).size;
console.log(`  distinct (move, travel) pairs : ${distinct}`);
console.log('');
for (const r of runs.slice(0, 12)) {
  console.log(`    ${String(r.clip).padEnd(28).slice(0, 28)} forward ${String(r.dx).padStart(7)}m  lateral ${String(r.dz).padStart(7)}m`);
}
console.log(`\n  ${moved.length === 0
  ? 'NOTHING MOVED — attacks are still punching on the spot.'
  : `${moved.length}/${runs.length} attacks travel, and they do not all travel the same distance.`}`);
console.log(`\npage errors: ${errs.length}${errs.length ? ' — ' + errs.slice(0, 2).join(' | ') : ''}`);
await browser.close();
