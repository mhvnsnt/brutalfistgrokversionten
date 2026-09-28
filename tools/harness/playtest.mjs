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
const failed = [];
page.on('requestfailed', (r) => failed.push(`${r.failure()?.errorText || 'failed'}  ${r.url()}`));
page.on('response', (r) => { if (r.status() >= 400) failed.push(`HTTP ${r.status()}  ${r.url()}`); });

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
const byText = (t) => `(()=>{
  const want = ${JSON.stringify(t)};
  const exact = [...document.querySelectorAll('button,[role=button]')].filter(e=>(e.textContent||'').trim()===want);
  const leaf  = [...document.querySelectorAll('*')].filter(e=>e.children.length===0 && (e.textContent||'').trim()===want);
  const el = exact[0] || leaf[0];
  if(!el) return false;
  let n = el;                       // the control may be an ancestor of the label
  for(let i=0;i<4&&n;i++){ n.click?.(); n = n.parentElement; }
  return true;
})()`;
const go = async (label, t, ms = 2200) => {
  const ok = await page.evaluate(byText(t));
  await page.waitForTimeout(ms);
  console.log(`   ${ok ? '[tap] ' : '[miss]'} ${label}: ${t}`);
  return ok;
};
await page.mouse.click(206, 458); await page.waitForTimeout(2500);   // PRESS START
await go('mode', 'VERSUS');
await go('P1', 'BANNON', 1400);
await go('P2', 'VIPER', 1600);
await go('start', 'FIGHT!', 3000);
await go('stage', 'CONFIRM STAGE', 3000) || await go('stage', '\u25b6 CONFIRM STAGE', 3000);
// Wait for the arena to actually be live: a scene with skinned rigs in it.
// swiftshader runs this at a few fps, so a fixed sleep is a coin flip.
let ready = null;
for (let i = 0; i < 60; i++) {
  ready = await page.evaluate(() => {
    for (const c of document.querySelectorAll('canvas')) {
      const r3f = c.__r3f;
      const st = r3f && (r3f.root?.getState?.() ?? r3f.store?.getState?.() ?? r3f.getState?.());
      if (st && st.scene) {
        let n = 0; st.scene.traverse((o) => { if (o.isSkinnedMesh) n++; });
        if (n > 0) return { rigs: n };
      }
    }
    return null;
  });
  if (ready) break;
  await page.waitForTimeout(2000);
}
const where = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 100));
console.log(`   arena ready: ${ready ? ready.rigs + ' skinned rigs' : 'NO -- never got rigs'}   screen: ${where}`);

// ── INSTRUMENT: what the owner reports, measured per frame ────────────────
await page.evaluate(() => {
  const w = window;
  const S = {
    frames: 0, longFrames: [], tpose: 0, samples: 0, rigs: 0,
    snaps: [], maxStep: 0, stepHist: [], airFall: 0, airSamples: 0, instrErr: null,
  };
  w.__PT = S;
  const NEAR_BIND_DEG = 6;     // a bone within 6deg of bind is un-animated
  const TPOSE_SHARE = 0.75;    // most of the body un-animated = a T-pose
  const SNAP_M = 0.18;         // a joint moving >18cm in ONE frame is a snap, not motion

  const prev = new Map();      // rig uuid -> Float32Array of last world positions
  // matrixWorld elements 12,13,14 ARE the world translation -- no THREE global needed.

  const tick = () => {
    const now = performance.now();
    const dt = now - (S.lastT || now);
    S.lastT = now;
    S.frames++;
    if (dt > 120) S.longFrames.push(Math.round(dt));

    try {
      if (!S.scene) {
        for (const c of document.querySelectorAll('canvas')) {
          const r3f = c.__r3f;
          const st = r3f && (r3f.root?.getState?.() ?? r3f.store?.getState?.() ?? r3f.getState?.());
          if (st && st.scene) { S.scene = st.scene; S.foundVia = 'r3f'; break; }
        }
        if (!S.scene && w.__scene) { S.scene = w.__scene; S.foundVia = '__scene'; }
      }
      const sc = S.scene;
      if (sc) {
        let rigs = 0;
        sc.traverse((o) => {
          if (!o.isSkinnedMesh || !o.skeleton || !o.visible) return;
          rigs++;
          const bones = o.skeleton.bones;
          let nearBind = 0, counted = 0;
          const cur = new Float32Array(bones.length * 3);
          let frameMax = 0;
          for (let i = 0; i < bones.length; i++) {
            const b = bones[i];
            const q = b.quaternion;
            const ang = 2 * Math.acos(Math.min(1, Math.abs(q.w))) * 180 / Math.PI;
            counted++; if (ang < NEAR_BIND_DEG) nearBind++;
            const m = b.matrixWorld.elements;
            cur[i * 3] = m[12]; cur[i * 3 + 1] = m[13]; cur[i * 3 + 2] = m[14];
          }
          const last = prev.get(o.uuid);
          if (last && last.length === cur.length) {
            for (let i = 0; i < bones.length; i++) {
              const dx = cur[i*3] - last[i*3], dy = cur[i*3+1] - last[i*3+1], dz = cur[i*3+2] - last[i*3+2];
              const d = Math.sqrt(dx*dx + dy*dy + dz*dz);
              if (d > frameMax) frameMax = d;
            }
            if (frameMax > SNAP_M) S.snaps.push({ f: S.frames, d: +frameMax.toFixed(3), rig: o.name || 'rig' });
            if (frameMax > S.maxStep) S.maxStep = frameMax;
            S.stepHist.push(frameMax);
          }
          prev.set(o.uuid, cur);
          if (counted) { S.samples++; if (nearBind / counted > TPOSE_SHARE) S.tpose++; }
        });
        S.rigs = rigs;
      }
    } catch (e) { S.instrErr = String(e).slice(0, 160); }
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
  const h = (s.stepHist || []).slice().sort((a, b) => a - b);
  const pct = (p) => (h.length ? +h[Math.floor((h.length - 1) * p)].toFixed(4) : 0);
  return {
    frames: s.frames, rigs: s.rigs, samples: s.samples, tpose: s.tpose, foundVia: s.foundVia || 'NONE',
    longFrames: (s.longFrames || []).slice(0, 10), longCount: (s.longFrames || []).length,
    snapCount: (s.snaps || []).length, snaps: (s.snaps || []).slice(0, 8),
    maxStep: +(s.maxStep || 0).toFixed(3), p50: pct(0.5), p95: pct(0.95), p99: pct(0.99),
    steps: h.length, instrErr: s.instrErr,
  };
});

console.log('\n================ WHAT I SAW ================');
console.log(`frames rendered   : ${S.frames}  (~${(S.frames / SECONDS).toFixed(1)} fps)`);
console.log(`skinned rigs      : ${S.rigs}   (scene via ${S.foundVia})`);
console.log(`near-BIND (T-pose): ${S.tpose} / ${S.samples} samples  (${S.samples ? ((100*S.tpose)/S.samples).toFixed(1) : '0'}%)`);
console.log(`per-frame joint travel (m):  p50 ${S.p50}   p95 ${S.p95}   p99 ${S.p99}   max ${S.maxStep}   over ${S.steps} steps`);
console.log(`POSE SNAPS >18cm  : ${S.snapCount}   <-- this is what "glitchy" looks like`);
for (const s2 of S.snaps) console.log(`      ! f${s2.f}  ${s2.d}m  ${s2.rig}`);
console.log(`frames >120ms     : ${S.longCount}  ${S.longFrames.join(' ')}`);
if (S.instrErr) console.log(`instrument error  : ${S.instrErr}`);
const uniq = [...new Set(failed)];
console.log(`failed requests   : ${uniq.length}`);
for (const f of uniq.slice(0, 14)) console.log('   x ' + f);
console.log(`page errors       : ${pageErrors.length}`);
for (const e of pageErrors.slice(0, 8)) console.log('   ! ' + e);
console.log('============================================');

await browser.close();
