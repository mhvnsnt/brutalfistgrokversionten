#!/usr/bin/env node
/**
 * DOES A DIFFERENT INPUT PRODUCE A DIFFERENT MOVE?
 *
 * Owner, after playing: "Directional things and combos don't do anything
 * different. It's like the same moves for every button in every direction."
 * Reading the state machine cannot settle that — the command matcher, the
 * special list and the clip hand-off all exist in the source. The only honest
 * test is to press the real keys in a real match and record what comes out.
 *
 * WHAT IT READS. `beginAttack` logs one `[FSM] ... STATE TRANSITION` line per
 * move with the move's name, and GameBattleArena hands `activeClip()` to the
 * mesh, so the console carries both the move that was chosen and the clip that
 * was played. This collects them per input and prints the distinct count.
 *
 * A PASS is: each input yields its own move, and the set of distinct clips is
 * close to the set of distinct inputs. A FAIL is every row reading the same.
 *
 * Usage: npm run dev, then node scripts/probe-command-moves.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.BF_BASE ?? 'http://127.0.0.1:8080';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const lines = [];
page.on('console', (m) => { const t = m.text(); if (t.includes('STATE TRANSITION') || t.includes('[FSM]')) lines.push(t); });
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
await click('CONFIRM'); await page.waitForTimeout(28000);

/**
 * Numpad notation relative to facing. P1 starts on the left facing right, so
 * forward is ArrowRight. Each row is [label, held direction keys, button].
 */
const INPUTS = [
  ['5 P  (neutral jab)',      [],             'u'],
  ['6 P  (forward punch)',    ['ArrowRight'], 'u'],
  ['4 P  (back punch)',       ['ArrowLeft'],  'u'],
  ['2 P  (down punch)',       ['ArrowDown'],  'u'],
  ['8 P  (up punch)',         ['ArrowUp'],    'u'],
  ['5 RP (neutral strong)',   [],             'i'],
  ['6 RP (forward strong)',   ['ArrowRight'], 'i'],
  ['5 LK (neutral kick)',     [],             'j'],
  ['6 LK (forward kick)',     ['ArrowRight'], 'j'],
  ['2 LK (down kick)',        ['ArrowDown'],  'j'],
  ['5 RK (neutral heavy kick)', [],           'k'],
  ['6 RK (forward heavy kick)', ['ArrowRight'], 'k'],
];

/**
 * WAIT FOR THE FIGHTER TO BE FREE BEFORE PRESSING ANYTHING.
 *
 * THIS PROBE WAS LYING. Two back-to-back runs of the identical build
 * reported 0 of 12 inputs firing and then 4 of 12 — the game had not
 * changed between them. A fixed 1.4 s sleep is not long enough for every
 * move's recovery, so each input landed at a random point in the previous
 * move's animation and was swallowed; whether an input "worked" was mostly
 * whether the one before it happened to be short.
 *
 * Reading the HUD's own state line is what makes a run repeatable. It is
 * the same text the player sees, so the probe waits for exactly what a
 * player waits for.
 */
async function waitForFree(timeoutMs = 4000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const busy = await page.evaluate(() => {
      const txt = document.body.innerText;
      // The P1 state label sits under the left health bar.
      return /ATTACK|KICK|PUNCH|THROW|HITSTUN|KNOCKDOWN|RECOVER|GUARD/i.test(txt);
    }).catch(() => false);
    if (!busy) return true;
    await page.waitForTimeout(80);
  }
  return false;
}

const results = [];
for (const [label, dirs, button] of INPUTS) {
  await waitForFree();
  lines.length = 0;
  for (const d of dirs) await page.keyboard.down(d);
  if (dirs.length) await page.waitForTimeout(220);
  await page.keyboard.down(button);
  await page.waitForTimeout(90);
  await page.keyboard.up(button);
  // Long enough for the SLOWEST move in the corpus to finish, then confirm
  // by reading the state rather than assuming the sleep was enough.
  await page.waitForTimeout(600);
  for (const d of dirs) await page.keyboard.up(d);
  await waitForFree();
  await page.waitForTimeout(250);

  const transitions = lines.filter((l) => l.includes('STATE TRANSITION'));
  const move = transitions.length
    ? (transitions[0].match(/\[([^\]]+)\]\s+startup/)?.[1] ?? transitions[0].slice(0, 90))
    : '(nothing fired)';
  const state = transitions.length ? (transitions[0].match(/"(\w+)"\s*→\s*"(\w+)"/)?.[2] ?? '?') : '-';
  results.push({ label, move, state, fired: transitions.length });
}

console.log('\nINPUT                          MOTION STATE     MOVE');
for (const r of results) {
  console.log(`${r.label.padEnd(30)} ${String(r.state).padEnd(16)} ${r.move}`);
}
const moves = new Set(results.map((r) => r.move).filter((m) => m !== '(nothing fired)'));
const states = new Set(results.map((r) => r.state));
console.log(`\ndistinct moves: ${moves.size} / ${results.length} inputs`);
console.log(`distinct motion states: ${states.size}`);
console.log(`inputs that produced nothing: ${results.filter((r) => !r.fired).length}`);
if (errs.length) console.log('page errors:', errs.length, errs.slice(0, 4));
await browser.close();
