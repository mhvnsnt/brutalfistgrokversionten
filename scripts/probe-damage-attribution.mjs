#!/usr/bin/env node
/**
 * WHOSE HEALTH GOES DOWN WHEN P1 ATTACKS?
 *
 * Owner, after playing: "I'm P1 and I'm trying to fight P2 and it's like P2's
 * not reacting or taking any damage. And I think all of my attacks are hitting
 * myself. I don't know what's happening."
 *
 * That is two separate claims and they need separating, because they have
 * different causes and one of them can masquerade as the other:
 *
 *   A. P1's attacks land damage on P1        -> attribution is inverted
 *   B. P1's attacks land on nobody           -> the hitbox never connects
 *
 * B looks like A from the sofa: if P2 never flinches and P1's own bar drifts
 * down from the AI's hits, it reads as hitting yourself. So this measures
 * BOTH: the health of each fighter, and the ledger of who hit whom
 * (__BF_DEBUG.hits(), added for this), which records the fighter whose hitbox
 * connected AND the fighter the damage was applied to.
 *
 * WHY IT PRESSES THE REAL KEYS. This project's standing rule — "if we can find
 * a way to see and press buttons we do it" — and its recurring lesson that
 * calling the function behind a control proves nothing about the control. The
 * hitbox path only opens from a real attack, so a real attack is what gets
 * pressed.
 *
 * A HELD PRESS, NOT A TAP. The harness renders at a few frames a second under
 * swiftshader, so a 100ms keypress can fall entirely between two frames and
 * the input is never sampled. Presses here are held long enough to survive
 * that, which is a property of the harness and not of the game.
 *
 * Usage: npm run dev, then node scripts/probe-damage-attribution.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.BF_BASE ?? 'http://127.0.0.1:8080';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));

await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(8000);
await page.click('body');
await page.keyboard.press('Enter');
await page.waitForTimeout(5000);

const click = (src) => page.evaluate((s) => {
  const rx = new RegExp(s, 'i');
  const el = [...document.querySelectorAll('button,[role=button],div,span')]
    .find((e) => rx.test((e.innerText || '').trim()) && e.offsetParent !== null && (e.innerText || '').length < 90);
  if (!el) return false;
  el.click();
  return true;
}, src);

await click('^VERSUS$'); await page.waitForTimeout(4000);
await click('^BANNON$'); await page.waitForTimeout(2500);
await click('^VIPER$'); await page.waitForTimeout(2500);
await click('^FIGHT!$'); await page.waitForTimeout(8000);
await click('CONFIRM');

// POLL FOR THE BELL, DO NOT TIME IT. The intro, the walk-in and the round
// banner all take as long as the harness's frame rate makes them take, and a
// fixed wait that was long enough yesterday reads as "never reached the arena"
// today. Waiting on the engine being live is the honest condition.
let live = null;
for (let i = 0; i < 90; i++) {
  live = await page.evaluate(() => {
    const d = window.__BF_DEBUG;
    return d && typeof d.health === 'function' ? d.health() : null;
  });
  if (live && typeof live.p1 === 'number') break;
  await page.waitForTimeout(1000);
}

const dbg = (fn) => page.evaluate((f) => {
  const d = window.__BF_DEBUG;
  return d && typeof d[f] === 'function' ? d[f]() : null;
}, fn);

if (!live || typeof live.p1 !== 'number') {
  console.log('NOT IN A MATCH — the run never reached the arena, so nothing below would mean anything.');
  console.log('  health():', JSON.stringify(live));
  console.log('  __BF_DEBUG keys:', await page.evaluate(() => Object.keys(window.__BF_DEBUG ?? {})).catch(() => []));
  await browser.close();
  process.exit(1);
}

// THE IDLE BASELINE. Thirty seconds of the menu flow already cost P1 health in
// one exploratory run while P2 sat untouched, so how much each side loses while
// NOBODY presses anything is part of the measurement, not noise to skip past.
const idleStart = await dbg('health');
await page.waitForTimeout(6000);
const idleEnd = await dbg('health');
const idleHits = (await dbg('hits')) ?? [];

// WALK INTO RANGE FIRST. A hitbox that never overlaps proves nothing about
// attribution, and the fighters start further apart than a jab reaches.
const startPos = await dbg('positions');
await page.keyboard.down('ArrowRight');
await page.waitForTimeout(2600);
await page.keyboard.up('ArrowRight');
await page.waitForTimeout(600);
const closed = await dbg('positions');

const before = await dbg('health');
const PRESSES = [['LP', 'u'], ['RP', 'i'], ['LK', 'j'], ['RK', 'k']];
for (let round = 0; round < 4; round++) {
  for (const [, key] of PRESSES) {
    await page.keyboard.down(key);
    await page.waitForTimeout(420);
    await page.keyboard.up(key);
    await page.waitForTimeout(650);
  }
}
const after = await dbg('health');
const stats = await dbg('inputStats');
const hits = (await dbg('hits')) ?? [];
const states = await dbg('states');
const triggers = await dbg('triggers');

const byP1 = hits.filter((h) => h.by === 'p1');
const byP2 = hits.filter((h) => h.by === 'p2');
const selfHits = hits.filter((h) => h.by === h.target);

console.log('\nDAMAGE ATTRIBUTION — P1 pressed 16 attacks in range\n');
console.log(`  IDLE 6s, nobody pressing: P1 ${idleStart.p1} -> ${idleEnd.p1} (lost ${idleStart.p1 - idleEnd.p1}), `
  + `P2 ${idleStart.p2} -> ${idleEnd.p2} (lost ${idleStart.p2 - idleEnd.p2}), ${idleHits.length} hit(s) logged`);
console.log(`  gap        ${startPos?.gap?.toFixed(2)}m at the bell -> ${closed?.gap?.toFixed(2)}m after walking in`);
console.log(`  P1 health  ${before.p1} -> ${after.p1}   (lost ${before.p1 - after.p1})`);
console.log(`  P2 health  ${before.p2} -> ${after.p2}   (lost ${before.p2 - after.p2})`);
console.log(`  P1 attacks started: ${triggers?.p1?.attackStarts ?? '?'}   P2: ${triggers?.p2?.attackStarts ?? '?'}`);
if (stats) {
  console.log('');
  console.log(`  loop frames seen by the game: ${stats.frames}`);
  console.log(`  frames with an attack button down: ${stats.anyAttackBtn}`
    + `  (lp ${stats.lp}, rp ${stats.rp}, lk ${stats.lk}, rk ${stats.rk})`);
  console.log(`  rising edges the loop saw: ${stats.edges}  (${stats.edgesDuringHitStop} arrived during hit stop)`);
  console.log(`  fighter state at each edge: ${Object.entries(stats.atEdge).map(([k, v]) => `${k} x${v}`).join(', ') || '(none)'}`);
  console.log(`  -> ${stats.anyAttackBtn === 0
    ? 'THE GAME NEVER SAW A PRESS. That is the harness, not the game.'
    : `the game saw the presses on ${stats.anyAttackBtn} frames and started ${stats.attackStarts} attacks.`}`);
}
console.log('');
console.log(`  hits by P1: ${byP1.length}  (${byP1.reduce((a, h) => a + h.dmg, 0)} damage, all to ${[...new Set(byP1.map((h) => h.target))].join('/') || '-'})`);
console.log(`  hits by P2: ${byP2.length}  (${byP2.reduce((a, h) => a + h.dmg, 0)} damage, all to ${[...new Set(byP2.map((h) => h.target))].join('/') || '-'})`);
console.log(`  SELF-HITS : ${selfHits.length}`);
console.log('');
console.log(`  states     p1 ${states?.p1?.action}/${states?.p1?.motion}   p2 ${states?.p2?.action}/${states?.p2?.motion}`);

const verdict = selfHits.length > 0
  ? 'BROKEN — attribution is inverted: a fighter is damaging himself.'
  : byP1.length === 0
    ? 'BROKEN — P1 landed nothing. The hitbox never connected, which from the sofa reads as "hitting myself".'
    : before.p2 - after.p2 <= 0
      ? 'BROKEN — P1 landed hits but P2 lost no health.'
      : 'P1 -> P2 damage flows.';
console.log(`\n  ${verdict}`);
if (hits.length) {
  console.log('\n  ledger (last 12):');
  for (const h of hits.slice(-12)) console.log(`    ${h.by} -> ${h.target}  ${String(h.dmg).padStart(4)}  ${h.blocked ? 'blocked' : '       '}  ${h.via}`);
}
console.log(`\npage errors: ${errs.length}${errs.length ? ' — ' + errs.slice(0, 2).join(' | ') : ''}`);
await browser.close();
