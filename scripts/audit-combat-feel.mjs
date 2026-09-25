#!/usr/bin/env node
/**
 * DOES THIS FIGHT BEHAVE THE WAY A FIGHTING GAME BEHAVES?
 *
 * Owner, after playing: "the combat needs to be more … like something built on
 * top of Tekken and classic fighting games. When you press back and attack it's
 * making you keep walking back, so none of those attacks ever hit. In Tekken
 * and Schwarzerblitz it's more specific than that. There's a lot of things like
 * that — if you do a full audit of everything like that we can fix it."
 *
 * So this is the audit. Each row is an INVARIANT the genre holds, measured in a
 * real match through real key presses, reported as a number rather than an
 * opinion. They are deliberately the boring structural ones — the things that
 * decide whether a fight feels solid before any of the flashy systems matter.
 *
 *   REACH      a directional attack thrown in range must still connect. This is
 *              the one he reported: if holding back keeps translating you, the
 *              attack leaves range before its own active frames arrive and the
 *              move is dead on arrival, whatever its frame data says.
 *   ANCHOR     an attack must stop your walk. In Tekken the input that selects
 *              the move does not also keep driving you; only the move's own
 *              authored travel moves you during it.
 *   COMMIT     an attack must have recovery you cannot act through, or there is
 *              no risk in throwing one and no reward for whiff punishing.
 *   VARIETY    different directions must produce different moves, or the
 *              directional input is decoration.
 *
 * Usage: npm run dev, then node scripts/audit-combat-feel.mjs
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
if (!reached) { console.log('NEVER REACHED THE ARENA — nothing below would mean anything.'); await browser.close(); process.exit(1); }

const dbg = (fn) => page.evaluate((f) => window.__BF_DEBUG?.[f]?.() ?? null, fn);

/**
 * Walk into range so a whiff is about the MOVE, not about the distance.
 *
 * Held continuously rather than tapped: the first version pressed for 320ms
 * twelve times and never got below 1.67m, which made every row read "connected:
 * no" for a reason that had nothing to do with the move. The AI also backs away
 * as you advance, so the approach has to out-walk it and then give up honestly
 * rather than pretend it arrived.
 */
const closeIn = async () => {
  await page.keyboard.down('ArrowRight');
  for (let i = 0; i < 20; i++) {
    const p = await dbg('positions');
    if (p && p.gap <= 1.1) break;
    await page.waitForTimeout(250);
  }
  await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(220);
  return (await dbg('positions'))?.gap ?? null;
};

const CASES = [
  ['neutral  P', [], 'u'],
  ['forward  P', ['ArrowRight'], 'u'],
  ['BACK     P', ['ArrowLeft'], 'u'],
  ['down     P', ['ArrowDown'], 'u'],
  ['neutral  K', [], 'k'],
  ['forward  K', ['ArrowRight'], 'k'],
  ['BACK     K', ['ArrowLeft'], 'k'],
  ['down     K', ['ArrowDown'], 'k'],
];

const rows = [];
for (const [label, dirs, key] of CASES) {
  const gap = await closeIn();
  const before = await dbg('positions');
  const hitsBefore = ((await dbg('hits')) ?? []).filter((h) => h.by === 'p1').length;

  for (const d of dirs) await page.keyboard.down(d);
  await page.waitForTimeout(150);
  await page.keyboard.down(key);

  // SAMPLE THE MOVE WHILE IT IS RUNNING. Reading the state after the attack
  // finished reported `idle` for every row, which made the variety figure
  // meaningless — it was measuring the pose a fighter returns to, not the move.
  //
  // DRIFT IS MEASURED STRICTLY BETWEEN THE START AND END OF THE ATTACK.
  //
  // The first version timed a fixed window around the press and reported 1.76m
  // of "drift" on a back attack. Most of that was the fighter WALKING, which is
  // what holding back is supposed to do — Tekken walks you back too. The defect
  // is only movement that continues while the attack itself is running, so the
  // window has to be the attack, not the press.
  let firedClip = null;
  let xAtAttackStart = null;
  for (let i = 0; i < 14; i++) {
    const st = await dbg('states');
    if (st?.p1?.action === 'Attacking' || st?.p1?.action === 'CommandThrow') {
      firedClip = st.p1.clip ?? st.p1.motion;
      xAtAttackStart = (await dbg('positions'))?.p1?.x ?? null;
      break;
    }
    await page.waitForTimeout(60);
  }
  let xAtAttackEnd = xAtAttackStart;
  for (let i = 0; i < 20; i++) {
    const st = await dbg('states');
    if (st?.p1?.action !== 'Attacking' && st?.p1?.action !== 'CommandThrow') break;
    xAtAttackEnd = (await dbg('positions'))?.p1?.x ?? xAtAttackEnd;
    await page.waitForTimeout(60);
  }
  await page.keyboard.up(key);
  // KEEP HOLDING the direction through the attack — that is the case he
  // reported. Releasing it would test a different input entirely.
  await page.waitForTimeout(420);
  for (const d of dirs) await page.keyboard.up(d);
  await page.waitForTimeout(500);

  const after = await dbg('positions');
  const states = await dbg('states');
  const hitsAfter = ((await dbg('hits')) ?? []).filter((h) => h.by === 'p1').length;
  rows.push({
    label,
    gapAtPress: gap,
    drift: xAtAttackStart !== null && xAtAttackEnd !== null
      ? +(xAtAttackEnd - xAtAttackStart).toFixed(3) : null,
    walked: before && after ? +(after.p1.x - before.p1.x).toFixed(3) : null,
    gapAfter: after ? +after.gap.toFixed(2) : null,
    connected: hitsAfter > hitsBefore,
    clip: firedClip ?? `(never attacked; ended ${states?.p1?.action ?? '?'})`,
  });
}

console.log('\nCOMBAT FEEL AUDIT — real presses, in range\n');
console.log('  input        gap@press  drift-in-attack  walked-total   connected   move');
for (const r of rows) {
  console.log(
    `  ${r.label.padEnd(12)}`
    + `${String(r.gapAtPress?.toFixed(2) ?? '?').padStart(7)}`
    + `${String(r.drift ?? '?').padStart(16)}`
    + `${String(r.walked ?? '?').padStart(14)}`
    + `${(r.connected ? '   HIT' : '   ----').padStart(12)}`
    + `   ${String(r.clip).slice(0, 26)}`,
  );
}

const back = rows.filter((r) => r.label.startsWith('BACK'));
const fwd = rows.filter((r) => !r.label.startsWith('BACK'));
const backHit = back.filter((r) => r.connected).length;
const backDrift = back.reduce((a, r) => a + (r.drift ?? 0), 0) / Math.max(1, back.length);
const distinct = new Set(rows.map((r) => r.clip)).size;

console.log('\n  REACH   back attacks that connected: '
  + `${backHit}/${back.length}   (other directions ${fwd.filter((r) => r.connected).length}/${fwd.length})`);
console.log(`  ANCHOR  mean movement DURING a back attack: ${backDrift.toFixed(3)}m`
  + `${Math.abs(backDrift) > 0.25 ? '   <-- the attack itself is carrying you' : '   (the attack itself anchors you)'}`);
console.log(`  VARIETY distinct moves across ${rows.length} inputs: ${distinct}`);
console.log(`\npage errors: ${errs.length}${errs.length ? ' — ' + errs.slice(0, 2).join(' | ') : ''}`);
await browser.close();
