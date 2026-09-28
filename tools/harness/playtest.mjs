/**
 * PLAY THE GAME. Real browser, real clicks, real key presses, real round.
 *
 * Owner, repeatedly: "u play and pull in full repos and stop Jerry rig patching
 * and u test and play it I'm tired of ur monkey loops of playing a broken game."
 *
 * Every combat probe before this one drove the state machine directly or used
 * window.__controlsTest.setKeys -- which maps SIX MOVEMENT FIELDS AND NOTHING
 * ELSE, so every "I pressed the buttons" run this session was two men walking.
 * This dispatches the REAL KeyboardEvents the game listens for:
 *     U=LP  I=RP  J=LK  K=RK  C=guard  V=grapple  WASD/arrows=move
 * and reports what it SAW, not what the code says should happen.
 *
 * Usage: node tools/harness/playtest.mjs [--recon] [--seconds=N] [--shots]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const URL = process.env.PLAYTEST_URL || 'http://localhost:8080/';
const OUT = process.env.PLAYTEST_OUT || '/tmp/claude-0/-home-user/24d89c3d-4d02-5673-80e7-7cb3458dd0ee/scratchpad/shots';
const args = process.argv.slice(2);
const RECON = args.includes('--recon');
const SHOTS = args.includes('--shots') || RECON;
const SECONDS = Number((args.find((a) => a.startsWith('--seconds=')) || '--seconds=25').split('=')[1]);

fs.mkdirSync(OUT, { recursive: true });
const shot = async (page, name) => {
  if (!SHOTS) return;
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log(`   [shot] ${name}.png`);
};

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
// The owner plays on an Android phone in PORTRAIT. Test what he sees.
const page = await browser.newPage({
  viewport: { width: 412, height: 915 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});

const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e.message || e)));
page.on('console', (m) => { if (m.type() === 'error') pageErrors.push('console: ' + m.text()); });

console.log(`PLAYTEST -> ${URL}  (412x915 portrait, ${SECONDS}s of play)\n`);
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(6000);
await shot(page, '00-landing');

/** Everything a thumb could hit, in reading order. */
async function tappables() {
  return page.evaluate(() => {
    const out = [];
    const sel = 'button,[role=button],a,[onclick],[class*=btn],[class*=card],[class*=select]';
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.05) continue;
      const t = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 48);
      out.push({ t, x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), w: Math.round(r.width), h: Math.round(r.height) });
    }
    return out;
  });
}

if (RECON) {
  const list = await tappables();
  console.log(`RECON: ${list.length} tappable elements`);
  for (const e of list) console.log(`   "${e.t}"  @${e.x},${e.y}  ${e.w}x${e.h}`);
  const title = await page.title();
  const bodyText = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 900));
  console.log(`\nTITLE: ${title}\nTEXT: ${bodyText}`);
  console.log(`\nPAGEERRORS: ${pageErrors.length}`);
  for (const e of pageErrors.slice(0, 8)) console.log('   ! ' + e);
  await browser.close();
  process.exit(0);
}

/** Click whatever matches, report whether it moved us. */
async function tap(re, label) {
  const list = await tappables();
  const hit = list.find((e) => re.test(e.t));
  if (!hit) { console.log(`   [miss] ${label}: nothing matching ${re}`); return false; }
  await page.mouse.click(hit.x, hit.y);
  await page.waitForTimeout(1400);
  console.log(`   [tap]  ${label}: "${hit.t}"`);
  return true;
}

// ── Get into a match the way a player does ────────────────────────────────
console.log('GETTING INTO A MATCH');
for (const [re, label] of [
  [/PLAY|START|FIGHT|BATTLE|ARCADE|VERSUS|QUICK/i, 'main menu'],
  [/FIGHT|START|CONFIRM|READY|VS|BEGIN/i, 'character select'],
  [/FIGHT|START|CONFIRM|READY|BEGIN|OK/i, 'stage / confirm'],
]) {
  await tap(re, label);
  await shot(page, `01-${label.replace(/\W+/g, '-')}`);
}

// Did we reach a live match? The engine exposes the fighters' state machines.
const live = await page.evaluate(() => {
  const w = window;
  return {
    hasArena: !!document.querySelector('canvas'),
    dbg: Object.keys(w).filter((k) => k.startsWith('__')).slice(0, 30),
  };
});
console.log(`   canvas: ${live.hasArena}   debug hooks: ${live.dbg.join(', ') || '(none)'}`);
await shot(page, '02-in-match');

// ── INSTRUMENT: what the owner reports, measured per frame ────────────────
await page.evaluate(() => {
  const w = window;
  const S = {
    frames: 0, longFrames: [], tpose: 0, floating: 0, samples: 0,
    motions: {}, actions: {}, moves: {}, hitsSeen: 0, lastT: performance.now(),
  };
  w.__PT = S;
  const NEAR_BIND_DEG = 6;      // a bone within 6 deg of bind is un-animated
  const TPOSE_SHARE = 0.75;     // most of the body un-animated = a T-pose

  const tick = () => {
    const now = performance.now();
    const dt = now - S.lastT;
    S.lastT = now;
    S.frames++;
    if (dt > 120) S.longFrames.push(Math.round(dt));

    // Walk every SkinnedMesh in the scene: bind-pose share + root height.
    try {
      const sc = w.__scene || (w.__three && w.__three.scene);
      if (sc) {
        let rigs = 0;
        sc.traverse((o) => {
          if (!o.isSkinnedMesh || !o.skeleton) return;
          rigs++;
          const bones = o.skeleton.bones;
          let nearBind = 0, counted = 0;
          for (let i = 0; i < bones.length; i++) {
            const b = bones[i];
            const bind = o.skeleton.boneInverses && o.skeleton.boneInverses[i];
            if (!bind) continue;
            counted++;
            // quaternion length from identity is a cheap "is it posed at all"
            const q = b.quaternion;
            const ang = 2 * Math.acos(Math.min(1, Math.abs(q.w))) * 180 / Math.PI;
            if (ang < NEAR_BIND_DEG) nearBind++;
          }
          if (counted > 0) {
            S.samples++;
            if (nearBind / counted > TPOSE_SHARE) S.tpose++;
          }
        });
        S.rigs = rigs;
      }
    } catch (e) { S.instrErr = String(e).slice(0, 120); }

    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});

// ── PLAY. Real presses, the way a thumb plays. ────────────────────────────
console.log(`\nPLAYING ${SECONDS}s -- real KeyboardEvents`);
const KEY = { LP: 'u', RP: 'i', LK: 'j', RK: 'k', G: 'c', THROW: 'v' };
const press = async (k, ms = 45) => {
  await page.keyboard.down(k);
  await page.waitForTimeout(ms);
  await page.keyboard.up(k);
};
// A round the way it actually gets played: approach, jab, string, mix, block.
const SCRIPT = [
  ['walk in', async () => { await page.keyboard.down('d'); await page.waitForTimeout(700); await page.keyboard.up('d'); }],
  ['jab', async () => { await press(KEY.LP); }],
  ['1,2 string', async () => { await press(KEY.LP); await page.waitForTimeout(90); await press(KEY.RP); }],
  ['1,2,kick', async () => { await press(KEY.LP); await page.waitForTimeout(90); await press(KEY.RP); await page.waitForTimeout(90); await press(KEY.RK); }],
  ['heavy', async () => { await press(KEY.RP, 70); }],
  ['low kick', async () => { await page.keyboard.down('s'); await press(KEY.LK); await page.keyboard.up('s'); }],
  ['throw (2 buttons)', async () => { await page.keyboard.down(KEY.LP); await page.keyboard.down(KEY.LK); await page.waitForTimeout(60); await page.keyboard.up(KEY.LP); await page.keyboard.up(KEY.LK); }],
  ['block', async () => { await page.keyboard.down(KEY.G); await page.waitForTimeout(600); await page.keyboard.up(KEY.G); }],
  ['launcher + juggle', async () => { await press(KEY.RK, 70); await page.waitForTimeout(260); await press(KEY.LP); await page.waitForTimeout(140); await press(KEY.RP); }],
  ['backdash', async () => { await page.keyboard.down('a'); await page.waitForTimeout(220); await page.keyboard.up('a'); }],
];
const t0 = Date.now();
let beat = 0;
while ((Date.now() - t0) / 1000 < SECONDS) {
  const [label, fn] = SCRIPT[beat % SCRIPT.length];
  await fn();
  await page.waitForTimeout(320);
  if (beat % SCRIPT.length === 0) await shot(page, `play-${String(beat).padStart(2, '0')}`);
  beat++;
}
console.log(`   ran ${beat} input beats`);
await shot(page, '03-after-play');

const S = await page.evaluate(() => {
  const s = window.__PT || {};
  return {
    frames: s.frames, rigs: s.rigs, samples: s.samples, tpose: s.tpose,
    longFrames: (s.longFrames || []).slice(0, 12), longCount: (s.longFrames || []).length,
    instrErr: s.instrErr,
  };
});

console.log('\n================ WHAT I SAW ================');
const secs = SECONDS;
console.log(`frames rendered   : ${S.frames}  (~${(S.frames / secs).toFixed(1)} fps)`);
console.log(`skinned rigs      : ${S.rigs ?? 'n/a'}`);
console.log(`rig samples       : ${S.samples}`);
console.log(`near-BIND (T-pose): ${S.tpose}  (${S.samples ? ((100 * S.tpose) / S.samples).toFixed(1) : '0'}% of samples)`);
console.log(`frames >120ms     : ${S.longCount}  ${S.longFrames.join(' ') || ''}`);
if (S.instrErr) console.log(`instrument error  : ${S.instrErr}`);
console.log(`page errors       : ${pageErrors.length}`);
for (const e of pageErrors.slice(0, 10)) console.log('   ! ' + e);
console.log('============================================');

await browser.close();
