#!/usr/bin/env node
/**
 * DOES THE OTHER MAN PLAY HIS HALF OF THE THROW?
 *
 * Owner, twice: "neck breaker ... would have two animation parts, one for the
 * deliverer and the receiver", then "Scoop slam is a grapple too that needs
 * the opponent side, and same for all grapples — they need the opponent side
 * hooked up and wired up all areas wise."
 *
 * Reading the code cannot answer this. The only honest test is to throw
 * somebody in a real match and read what the victim's body was told to play,
 * FROM THE RESOLVER ITSELF rather than from the state table — `__BF_DEBUG
 * .clips()` reports the clip each mesh actually chose.
 *
 * A PASS is: the throw connects, it commits, and the victim's animation is
 * the paired half of the deliverer's clip — not `knockdown`.
 *
 * RUN IT AGAINST THE BUILD, NOT THE DEV SERVER. Two runs died on
 * "Execution context was destroyed, most likely because of a navigation":
 * Vite's watcher full-reloads the page when ANY watched file changes, and
 * editing a doc in another terminal while the probe is mid-match is enough.
 * A probe that dies for a reason unrelated to the thing it measures is a
 * probe you stop believing.
 *
 * Usage: npm run build && npx vite preview --port 8081, then
 *        BF_BASE=http://127.0.0.1:8081 node scripts/probe-grapple-pairing.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.BF_BASE ?? 'http://127.0.0.1:8080';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const log = [];
page.on('console', (m) => {
  const t = m.text();
  if (/🤲|🤼|opponent half|Command throw|BakedMotionBank/.test(t)) log.push(t);
});
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
 * WAIT FOR THE MATCH, DO NOT ASSUME IT. A fixed sleep after CONFIRM was
 * enough on one run and not the next — the same trap this repo has already
 * paid for twice, most recently in probe-command-moves.
 */
let ready = false;
for (let i = 0; i < 60 && !ready; i++) {
  ready = await page.evaluate(() => Boolean(window.__BF_DEBUG?.clips));
  if (!ready) await page.waitForTimeout(1000);
}
if (!ready) { console.log('FAIL: no __BF_DEBUG.clips — the match never started'); await browser.close(); process.exit(1); }

/** Close the distance first: a throw out of range is a whiff, not a test. */
const attempts = [];
for (let n = 0; n < 9 && attempts.filter((a) => a.committed).length === 0; n++) {
  // GRAB RANGE IS 1.4 AND THE FIRST RUN WHIFFED THREE TIMES OUT OF FOUR at
  // gaps of 2.09, 1.62 and 1.48. Walk in longer, and only press once the gap
  // is actually inside the range rather than after a fixed hold.
  await page.keyboard.down('ArrowRight');
  for (let w = 0; w < 30; w++) {
    const g = await page.evaluate(() => {
      const q = window.__BF_DEBUG?.positions?.();
      return q ? Math.abs((q.p2?.x ?? 0) - (q.p1?.x ?? 0)) : null;
    }).catch(() => null);
    if (g !== null && g <= 1.15) break;
    await page.waitForTimeout(120);
  }
  const gap = await page.evaluate(() => {
    const p = window.__BF_DEBUG?.positions?.();
    return p ? Math.abs((p.p2?.x ?? 0) - (p.p1?.x ?? 0)) : null;
  });
  await page.keyboard.up('ArrowRight');

  const before = log.length;
  // The HUD lists three ways in: GRAPPLE (v), and the two-button throws
  // 1+3 (z+j) and 2+4 (x+k). Alternated so one dead route cannot read as
  // "grapples do not work".
  const route = n % 3;
  if (route === 0) {
    await page.keyboard.down('v'); await page.waitForTimeout(90); await page.keyboard.up('v');
  } else if (route === 1) {
    await page.keyboard.down('z'); await page.keyboard.down('j');
    await page.waitForTimeout(90);
    await page.keyboard.up('z'); await page.keyboard.up('j');
  } else {
    await page.keyboard.down('x'); await page.keyboard.down('k');
    await page.waitForTimeout(90);
    await page.keyboard.up('x'); await page.keyboard.up('k');
  }

  // Sample every 60 ms through the break window and the throw itself, so the
  // victim's half is caught while it is playing rather than after it ends.
  let seen = null;
  for (let i = 0; i < 40; i++) {
    const c = await page.evaluate(() => window.__BF_DEBUG?.clips?.() ?? null).catch(() => null);
    if (c?.grappleBeat) {
      seen = c;
      // THE BEAT AND THE BODY ARE NOT THE SAME FRAME. Setting the beat is a
      // React state change; the mesh picks the clip up on the next commit,
      // and on a 3fps software rasteriser that is not instant. Reading the
      // body in the same tick as the beat reports the clip he was playing
      // BEFORE the throw, which reads exactly like the pairing not working.
      const want = c.grappleBeat.clip;
      const who = c.grappleBeat.victim;
      for (let j = 0; j < 25; j++) {
        const after = await page.evaluate(() => window.__BF_DEBUG?.clips?.() ?? null).catch(() => null);
        if (after?.[who] === want) { seen = { ...after, grappleBeat: c.grappleBeat, lastDeliverer: c.lastDeliverer }; break; }
        await page.waitForTimeout(60);
      }
      break;
    }
    await page.waitForTimeout(60);
  }
  const fresh = log.slice(before);
  // WHICH SIDE WAS THROWN IS SOMETHING THE BEAT SAYS, NOT SOMETHING TO ASSUME.
  // The first version of this printed p1's deliverer and p2's clip no matter
  // who threw whom, and reported "- -> KNEETHROWREACTION_NEW, victim playing
  // GYAKUZUKI" for a run that had worked — GYAKUZUKI being the ATTACKER's
  // clip, read off the wrong body. Now that the AI can throw too, either
  // fighter can be the victim and the probe has to follow the beat.
  const victim = seen?.grappleBeat?.victim ?? null;
  const thrower = victim === 'p1' ? 'p2' : 'p1';
  attempts.push({
    route: ['v', '1+3', '2+4'][n % 3],
    gap,
    connected: fresh.some((l) => /connected/.test(l)),
    committed: Boolean(seen),
    victim,
    deliverer: victim ? (seen?.lastDeliverer?.[thrower] ?? null) : null,
    victimClip: seen?.grappleBeat?.clip ?? null,
    source: seen?.grappleBeat?.source ?? null,
    victimPlaying: victim ? (seen?.[victim] ?? null) : null,
  });
  await page.waitForTimeout(2500);
}

console.log('\nGRAPPLE — DOES THE OPPONENT PLAY HIS HALF?\n');
for (const [i, a] of attempts.entries()) {
  console.log(
    `  try ${i + 1}  ${String(a.route).padEnd(4)} gap ${a.gap === null ? '?' : a.gap.toFixed(2)}  ` +
    `connected ${a.connected ? 'yes' : 'no '}  committed ${a.committed ? 'yes' : 'no '}  ` +
    `victim ${a.victim ?? '- '}  ${a.deliverer ?? '-'} -> ${a.victimClip ?? '-'} (${a.source ?? '-'}) ` +
    `his body is playing: ${a.victimPlaying ?? '-'}`,
  );
}
const win = attempts.find((a) => a.committed);
console.log('');
if (win && win.victimClip && win.victimPlaying === win.victimClip) {
  console.log(`PASS — the throw committed and the victim's body played ${win.victimClip} (${win.source}), not the stock knockdown.`);
} else if (win) {
  console.log(`PARTIAL — the half was chosen (${win.victimClip}) but the body reported ${win.victimPlaying}.`);
} else {
  console.log('FAIL — no throw committed in six attempts.');
}
console.log(`page errors: ${errs.length}${errs.length ? ' — ' + errs.slice(0, 3).join(' | ') : ''}`);
await browser.close();
