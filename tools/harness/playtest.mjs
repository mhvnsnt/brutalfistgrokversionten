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
/**
 * --nodraw: stub the rasterizer and keep everything else running.
 *
 * THIS IS THE WHOLE POINT OF THE HARNESS. swiftshader is a SOFTWARE rasterizer
 * and it renders this scene at 1-2 fps. Every per-frame measurement then
 * averages over a ~780ms window, which smooths away precisely the one-frame
 * T-pose, snap and dropped input the owner is reporting. "0 glitches at 1.9fps"
 * is not evidence of a clean game; it is an instrument with 1.9 samples a
 * second looking for a defect that lasts 16ms.
 *
 * The rAF loop, the animation mixers, the state machines and the physics do not
 * need pixels. Stubbing WebGLRenderer.render takes this to ~50fps, which CAN
 * resolve a single frame. Screenshots are meaningless in this mode -- look at
 * the game with --shots and measure it with --nodraw, never both at once.
 */
const NODRAW = args.includes('--nodraw');

fs.mkdirSync(OUT, { recursive: true });
const shot = async (page, name) => {
  if (!SHOTS) return;
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log(`   [shot] ${name}.png`);
};

const executablePath = process.env.PLAYTEST_BROWSER || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({
  ...(fs.existsSync(executablePath) ? { executablePath } : {}),
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
page.on('requestfailed', (r) => {
  const reason = r.failure()?.errorText || 'failed';
  // Chromium reports ERR_ABORTED when navigation tears down an in-flight
  // media request. That is not a missing asset or runtime failure.
  if (reason === 'net::ERR_ABORTED') return;
  failed.push(`${reason}  ${r.url()}`);
});
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
// SWITCH to player 2 explicitly. Tapping a second roster tile moves the CURSOR;
// it does not fill the other slot, so without this the run sits on player
// select forever and FIGHT! never appears (measured: three runs lost this way).
await go('to P2', 'SWITCH', 1200);
await go('P2', 'VIPER', 1600);
// Only start once the button really exists -- it is rendered by `canStart`.
for (let i = 0; i < 8; i++) {
  const ready = await page.evaluate(() => [...document.querySelectorAll('button')].some((b) => /^FIGHT!?$/i.test((b.textContent || '').trim())));
  if (ready) break;
  await go('to P2 (retry)', 'SWITCH', 800);
  await go('P2 (retry)', 'VIPER', 1200);
}
await go('start', 'FIGHT!', 3000);
await go('stage', 'CONFIRM STAGE', 3000) || await go('stage', '\u25b6 CONFIRM STAGE', 3000);
// Wait for the arena to actually be live: a scene with skinned rigs in it.
// swiftshader runs this at a few fps, so a fixed sleep is a coin flip.
let ready = null;
for (let i = 0; i < 60; i++) {
  try {
  ready = await page.evaluate(() => {
    const sc = window.__BF_SCENE;
    if (sc) { let n = 0; sc.traverse((o) => { if (o.isSkinnedMesh) n++; }); if (n > 0) return { rigs: n }; }
    return null;
  });
  } catch { ready = null; }   // the arena is a real route change; the context dies mid-poll
  if (ready) break;
  await page.waitForTimeout(2000);
}
const where = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 100));
console.log(`   arena ready: ${ready ? ready.rigs + ' skinned rigs' : 'NO -- never got rigs'}   screen: ${where}`);

if (!ready) console.log('   (continuing anyway so the run still reports what it can)');
if (NODRAW) {
  const ok = await page.evaluate(() => {
    const T = window.THREE;
    if (!T || !T.WebGLRenderer) return false;
    const proto = T.WebGLRenderer.prototype;
    if (proto.__bfRealRender) return true;
    proto.__bfRealRender = proto.render;
    proto.render = function () { /* rasterization is the bottleneck, not the game */ };
    return true;
  });
  console.log(`   --nodraw: rasterizer ${ok ? 'STUBBED (screenshots are now meaningless)' : 'NOT stubbed -- window.THREE missing'}`);
  await page.waitForTimeout(1200);
}

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
  // A PER-FRAME DISTANCE IS NOT A DEFECT -- it is a distance divided by the
  // harness frame rate. swiftshader renders this at 1-3 fps, so a body walking
  // normally covers half a metre between frames and reads as a teleport. The
  // frame-rate-independent question is SPEED: no human joint, in any strike in
  // any fighting game, travels faster than about 12 m/s. Past that it is not
  // fast animation, it is the body being somewhere else.
  const SNAP_MS = 12;          // metres per second

  const prev = new Map();      // rig uuid -> Float32Array of last world positions
  // matrixWorld elements 12,13,14 ARE the world translation -- no THREE global needed.

  const tick = () => {
    const now = performance.now();
    const dt = now - (S.lastT || now);
    S.lastT = now;
    const dtS = Math.max(1e-3, dt / 1000);
    S.frames++;
    if (dt > 120) S.longFrames.push(Math.round(dt));

    try {
      if (!S.scene && w.__BF_SCENE) { S.scene = w.__BF_SCENE; S.foundVia = '__BF_SCENE'; }
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
            const speed = frameMax / dtS;
            if (speed > SNAP_MS) S.snaps.push({ f: S.frames, d: +frameMax.toFixed(3), v: +speed.toFixed(1), dt: Math.round(dt), rig: o.name || 'rig' });
            if (speed > S.maxStep) S.maxStep = speed;
            S.stepHist.push(speed);
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

// ── THE REAL QUESTION: DOES THE MOVE PLAY ALL THE WAY THROUGH? ───────────
//
// Owner: "the real thing that says if it works or not is did the animation play
// all the way through or like completely how it's supposed to like it does in
// Schwarzer Blitz."
//
// He is right and every earlier probe in this session measured the wrong thing.
// "The press registered" (12/12) and "the health bar moved" are both true while
// the body plays four frames of a jab and snaps back to idle. THAT is the bug.
//
// This is EVENT-based, not sampled, so the harness frame rate cannot hide it:
// every AnimationAction records where it was when something cut it off. An
// action that reaches its end fires the mixer's 'finished' event; one that is
// stopped, halted or faded early is recorded with the exact fraction of the
// clip that got to play.
await page.evaluate(() => {
  const T = window.THREE;
  const S = (window.__PT = window.__PT || {});
  S.anim = { started: 0, finished: 0, cut: [], byClip: {}, hooked: false };
  if (!T || !T.AnimationAction || S.anim.hooked) return;
  const A = S.anim;
  const AP = T.AnimationAction.prototype;

  const note = (action, via) => {
    try {
      const clip = action.getClip && action.getClip();
      if (!clip || !(clip.duration > 0)) return;
      if (!action.isRunning || !action.isRunning()) return;
      const frac = action.time / clip.duration;
      // A clip that has effectively finished is not a cut.
      if (frac >= 0.97) return;
      const rec = A.byClip[clip.name] || (A.byClip[clip.name] = { starts: 0, cuts: 0, worst: 1, sum: 0 });
      rec.cuts++; rec.sum += frac; if (frac < rec.worst) rec.worst = frac;
      A.cut.push({ clip: clip.name, frac: +frac.toFixed(3), t: +action.time.toFixed(3), dur: +clip.duration.toFixed(3), via, w: +(action.getEffectiveWeight?.() ?? 1).toFixed(2) });
    } catch (e) { /* never break the game to measure it */ }
  };

  for (const m of ['stop', 'fadeOut', 'halt', 'crossFadeTo', 'crossFadeFrom']) {
    const real = AP[m];
    if (typeof real !== 'function') continue;
    AP[m] = function (...a) { note(this, m); return real.apply(this, a); };
  }
  const realPlay = AP.play;
  AP.play = function (...a) {
    try {
      const clip = this.getClip && this.getClip();
      if (clip && clip.duration > 0) {
        A.started++;
        const rec = A.byClip[clip.name] || (A.byClip[clip.name] = { starts: 0, cuts: 0, worst: 1, sum: 0 });
        rec.starts++;
      }
    } catch (e) {}
    return realPlay.apply(this, a);
  };
  // A mixer fires 'finished' when a LoopOnce action reaches its end -- that is
  // the definition of "played all the way through". Attach on first update.
  const MP = T.AnimationMixer.prototype;
  const realUpdate = MP.update;
  MP.update = function (...a) {
    if (!this.__bfListening) {
      this.__bfListening = true;
      this.addEventListener('finished', () => { A.finished++; });
    }
    return realUpdate.apply(this, a);
  };
  A.hooked = true;
});
console.log('   animation-completion hook installed');

// ── PLAY. Real presses, the way a thumb plays. ────────────────────────────
console.log(`\nPLAYING ${SECONDS}s -- real KeyboardEvents`);
const KEY = { LP: 'u', RP: 'i', LK: 'j', RK: 'k', G: 'c', THROW: 'v' };
// A 45ms tap is a real jab on a phone at 60fps. In swiftshader the page
// renders at 1-3 fps, so a 45ms press lands entirely BETWEEN two frames and the
// game never samples it -- which looks exactly like "my button did nothing".
// Hold for at least two frame intervals, measured, so a miss means the GAME
// dropped it. __bfInputStats says which of the two actually happened.
let frameMs = 60;
const measureFrame = async () => {
  frameMs = await page.evaluate(() => new Promise((res) => {
    let n = 0; const t0 = performance.now();
    const f = () => (++n < 8 ? requestAnimationFrame(f) : res((performance.now() - t0) / n));
    requestAnimationFrame(f);
  }));
  return frameMs;
};
await measureFrame();
console.log(`   harness frame time: ${frameMs.toFixed(0)}ms (${(1000 / frameMs).toFixed(1)} fps) -- presses held to suit`);
const HOLD = Math.max(45, Math.round(frameMs * 2.5));
const press = async (k, ms = HOLD) => {
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
console.log('   (attack-heavy script: the question is whether ATTACK clips complete)');
while ((Date.now() - t0) / 1000 < SECONDS) {
  const [label, fn] = SCRIPT[beat % SCRIPT.length];
  await fn();
  await page.waitForTimeout(320);

  // Read the same mixer-owned animation ledger the runtime exposes. This is
  // deliberately post-settle: a legitimate crossfade may have two actions
  // for a few frames, but a persistent second locomotion owner is the visual
  // double/ghost-body failure we are trying to catch.
  const routeSample = await page.evaluate(() => {
    const rigs = window.__BF_ANIM ? Object.entries(window.__BF_ANIM) : [];
    const samples = rigs.map(([rig, probe]) => {
      try {
        const r = probe();
        return {
          rig,
          active: r?.active ?? null,
          distinctActions: Number(r?.distinctActions ?? 0),
          totalWeight: Number(r?.totalWeight ?? 0),
          rows: Array.isArray(r?.rows) ? r.rows.map((x) => x.clip) : [],
        };
      } catch { return null; }
    }).filter(Boolean);
    return samples;
  });
  const routeLedger = (window.__PT = window.__PT || {}).routing || ((window.__PT.routing = {
    samples: [], byBeat: [], locomotionMultiOwner: 0,
  }));
  routeLedger.samples.push(...routeSample);
  routeLedger.byBeat.push({ beat, label, samples: routeSample });
  if (routeSample.some((r) => r.distinctActions > 1)) {
    routeLedger.locomotionMultiOwner++;
  }

  if (beat % SCRIPT.length === 0) await shot(page, `play-${String(beat).padStart(2, '0')}`);
  beat++;
}
console.log(`   ran ${beat} input beats`);
await shot(page, '03-after-play');

const ANIM = await page.evaluate(() => {
  const a = (window.__PT || {}).anim;
  if (!a) return null;
  const clips = Object.entries(a.byClip)
    .map(([name, r]) => ({ name, starts: r.starts, cuts: r.cuts, worst: +r.worst.toFixed(3), mean: r.cuts ? +(r.sum / r.cuts).toFixed(3) : 1 }))
    .sort((x, y) => x.worst - y.worst);
  return { started: a.started, finished: a.finished, cutCount: a.cut.length, cuts: a.cut.slice(-10), clips: clips.slice(0, 40), hooked: a.hooked };
});
const INP = await page.evaluate(() => (window.__bfInputStats ? window.__bfInputStats() : null));
const ROUTING = await page.evaluate(() => {
  const r = (window.__PT || {}).routing || {};
  const samples = Array.isArray(r.samples) ? r.samples : [];
  const multi = samples.filter((x) => Number(x.distinctActions) > 1);
  const activeCounts = samples.map((x) => Number(x.distinctActions) || 0);
  return {
    samples: samples.length,
    multiOwnerSamples: multi.length,
    maxDistinctActions: activeCounts.length ? Math.max(...activeCounts) : 0,
    recent: samples.slice(-12),
  };
});
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
console.log(`joint SPEED (m/s) :  p50 ${S.p50}   p95 ${S.p95}   p99 ${S.p99}   max ${S.maxStep}   over ${S.steps} samples`);
console.log(`TELEPORTS >12 m/s : ${S.snapCount}   (frame-rate independent; a per-frame DISTANCE is not a defect at ${(S.frames / SECONDS).toFixed(1)} fps)`);
for (const s2 of S.snaps) console.log(`      ! f${s2.f}  ${s2.v} m/s  (${s2.d}m in ${s2.dt}ms)  ${s2.rig}`);
console.log(`frames >120ms     : ${S.longCount}  ${S.longFrames.join(' ')}`);
if (INP) {
  const seen = INP.lp + INP.rp + INP.lk + INP.rk;
  console.log(`\nINPUT LEDGER  (does a press reach the engine, and does it become a move?)`);
  console.log(`  engine frames   : ${INP.frames}`);
  console.log(`  attack btn seen : ${INP.anyAttackBtn} frames   lp ${INP.lp}  rp ${INP.rp}  lk ${INP.lk}  rk ${INP.rk}`);
  console.log(`  press EDGES     : ${INP.edges}   (${INP.edgesDuringHitStop} during hitstop)`);
  console.log(`  ATTACKS STARTED : ${INP.attackStarts}`);
  const verdict = seen === 0
    ? 'INSTRUMENT: the engine never saw a press -- the harness is at fault, not the game.'
    : INP.attackStarts === 0
      ? 'GAME: presses reached the engine and NONE became an attack.'
      : INP.edges > 0 && INP.attackStarts < INP.edges * 0.5
        ? `GAME: ${INP.attackStarts} attacks from ${INP.edges} presses -- over half the presses were dropped.`
        : `OK: ${INP.attackStarts} attacks from ${INP.edges} presses.`;
  console.log(`  VERDICT         : ${verdict}`);
} else {
  console.log(`\nINPUT LEDGER      : unavailable (never reached the arena)`);
}
if (S.instrErr) console.log(`instrument error  : ${S.instrErr}`);

console.log(`\nRUNTIME ROUTING LEDGER`);
console.log(`  mixer samples    : ${ROUTING.samples}`);
console.log(`  >1 action samples: ${ROUTING.multiOwnerSamples}`);
console.log(`  max actions      : ${ROUTING.maxDistinctActions}`);
for (const r of ROUTING.recent) {
  console.log(`    ${r.rig}: active=${r.active ?? 'NONE'} actions=${r.distinctActions} weight=${r.totalWeight} [${r.rows.join(', ')}]`);
}

const uniq = [...new Set(failed)];
if (ANIM && ANIM.hooked) {
  console.log(`\nDID THE MOVE PLAY ALL THE WAY THROUGH?  (event-based -- frame rate cannot hide this)`);
  console.log(`  clips started   : ${ANIM.started}`);
  console.log(`  ran to the end  : ${ANIM.finished}`);
  console.log(`  CUT SHORT       : ${ANIM.cutCount}`);
  if (ANIM.clips.length) {
    console.log(`  every clip that played  (worst%  mean%  cut/starts  name):`);
    for (const c of ANIM.clips) {
      const pct = (v) => (v * 100).toFixed(0).padStart(4) + '%';
      const flag = c.cuts === 0 ? ' ok  ' : (c.worst < 0.9 ? ' CUT ' : ' ~   ');
      console.log(`    ${flag} ${pct(c.worst)} ${pct(c.mean)}  ${String(c.cuts)}/${String(c.starts)}   ${c.name}`);
    }
  }
  for (const c of ANIM.cuts.slice(-6)) console.log(`     ! ${c.clip} cut at ${(c.frac * 100).toFixed(0)}% (${c.t}s of ${c.dur}s) via ${c.via}, weight ${c.w}`);
} else {
  console.log(`\nANIMATION COMPLETION: hook not installed (THREE missing or arena never reached)`);
}
console.log(`\nfailed requests   : ${uniq.length}`);
for (const f of uniq.slice(0, 14)) console.log('   x ' + f);
console.log(`page errors       : ${pageErrors.length}`);
for (const e of pageErrors.slice(0, 8)) console.log('   ! ' + e);
console.log('============================================');

const fatal = !ready || pageErrors.length > 0 || (INP && INP.attackStarts === 0);
if (fatal) {
  console.error(`PLAYTEST FAIL: arena=${ready ? 'ready' : 'missing'}, pageErrors=${pageErrors.length}, attacks=${INP ? INP.attackStarts : 'unavailable'}`);
  process.exitCode = 1;
} else {
  console.log('PLAYTEST PASS: real arena reached, real attack input observed, no page errors.');
}

await browser.close();
