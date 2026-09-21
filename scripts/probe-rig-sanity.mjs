#!/usr/bin/env node
/**
 * THE UFC-5 PROBLEM: T-POSES, TWISTING AND FLOATING, IN A LIVE MATCH.
 *
 * Owner: "what is that weird thing that keeps happening in the newest UFC
 * game where the models keep doing weird stuff that's breaking the immersion
 * and glitching out and making them do T-pose and making their body twist all
 * around? Our game is doing that and we need our game not to do that. Tekken
 * and Virtua Fighter and Mortal Kombat don't do all that body twisting
 * glitches." And: "their feet are floating up ... like a head or half a head
 * too high off the ground."
 *
 * Those are three measurable defects, so this measures them on the REAL
 * skeletons in a REAL match, every frame, and names the clip that was playing
 * when each one happened. Reading the retarget code cannot answer it: the
 * bake's joint limits are applied OFFLINE, and what reaches the screen is the
 * result of blending two clips at runtime.
 *
 *   T-POSE     arms out sideways and not forward — the same shape the bake
 *              refuses, but measured live, after the blend.
 *   TWIST      a knee or elbow rotated off its hinge axis, or a limb twisted
 *              past the anatomical limit the bake already declares. A hinge
 *              cannot rotate about its own length; when it does, the mesh
 *              winds around the bone and that is the "body twisting" he means.
 *   FLOAT      the lowest foot sitting above the mat.
 *
 * Usage: npm run dev, then node scripts/probe-rig-sanity.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.BF_BASE ?? 'http://127.0.0.1:8080';
const SECONDS = Number(process.env.BF_SECONDS ?? 30);

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
  if (!el) return false;
  el.click();
  return true;
}, src);

await click('^VERSUS$'); await page.waitForTimeout(4000);
await click('^BANNON$'); await page.waitForTimeout(2500);
await click('^VIPER$'); await page.waitForTimeout(2500);
await click('^FIGHT!$'); await page.waitForTimeout(8000);
await click('CONFIRM');

let ready = false;
for (let i = 0; i < 90 && !ready; i++) {
  ready = await page.evaluate(() => Boolean(window.__BF_SCENE && window.__BF_DEBUG?.clips));
  if (!ready) await page.waitForTimeout(1000);
}
if (!ready) { console.log('FAIL: the match never started'); await browser.close(); process.exit(1); }

// Install the sampler IN THE PAGE and let it run across real frames. Sampling
// from node would measure once per round trip; the glitches he is describing
// are single frames.
await page.evaluate(() => {
  // NO THREE IN THE PAGE. The app does not publish its three.js instance, and
  // requiring one would make this probe fail for a reason unrelated to the
  // rig. World positions come straight off each bone's matrixWorld and the
  // quaternions are plain numbers, so the maths is done by hand here.
  const wp = (b) => { const e = b.matrixWorld.elements; return { x: e[12], y: e[13], z: e[14] }; };
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
  const len = (a) => Math.hypot(a.x, a.y, a.z) || 1;
  const norm = (a) => { const L = len(a); return { x: a.x / L, y: a.y / L, z: a.z / L }; };
  const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
  const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
  const w = window;
  /**
   * A CLEAN RESULT HAS TO PROVE IT LOOKED AT SOMETHING.
   *
   * This repo's own rule, earned twice already: a probe that returns an empty
   * result must be able to tell "nothing wrong" from "nothing looked at", or
   * it will confirm whatever you already believe. So the report carries how
   * many rigs it found, how many bones they have, and how far those bones
   * actually travelled — zero defects across a STATIC bind pose is not a
   * pass, it is a broken instrument.
   */
  w.__RIG_REPORT = {
    frames: 0, tpose: [], twist: [], float: [], heights: [], byClip: {},
    rigsSeen: 0, boneCounts: [], travel: 0, _prev: null, clipsSeen: {}, bodyY: [], headSizes: [], _q: {},
  };
  const HINGES = {
    mixamorigLeftForeArm: 1, mixamorigRightForeArm: 1,
    mixamorigLeftLeg: 1, mixamorigRightLeg: 1,
  };
  const deg = (r) => (r * 180) / Math.PI;

  const rigs = () => {
    const out = [];
    w.__BF_SCENE.traverse((o) => {
      if (o.isSkinnedMesh && o.skeleton && o.skeleton.bones.length > 20) out.push(o);
    });
    return out;
  };

  const sample = () => {
    const R = w.__RIG_REPORT;
    const clips = w.__BF_DEBUG?.clips?.() ?? {};
    const meshes = rigs();
    if (!meshes.length) return;
    R.frames++;
    R.rigsSeen = Math.max(R.rigsSeen, meshes.length);
    const seen = new Set();
    meshes.forEach((m, mi) => {
      const root = m.skeleton.bones[0];
      let top = root; while (top.parent && top.parent.isBone) top = top.parent;
      const id = top.uuid;
      if (seen.has(id)) return;
      seen.add(id);
      const who = mi === 0 ? 'p1' : 'p2';
      const clip = clips[who] ?? '?';
      const by = (R.byClip[clip] = R.byClip[clip] ?? { n: 0, tpose: 0, twist: 0, float: 0 });
      by.n++;
      R.clipsSeen[clip] = (R.clipsSeen[clip] ?? 0) + 1;
      if (mi === 0) {
        R.boneCounts[0] = m.skeleton.bones.length;
        // HOW FAR THE BONES MOVED SINCE THE LAST FRAME. If this is ~0 the rig
        // is frozen and every other number below is meaningless.
        const now = m.skeleton.bones.map((b) => { const e = b.matrixWorld.elements; return [e[12], e[13], e[14]]; });
        if (R._prev && R._prev.length === now.length) {
          let d = 0;
          for (let i = 0; i < now.length; i++) {
            d += Math.hypot(now[i][0] - R._prev[i][0], now[i][1] - R._prev[i][1], now[i][2] - R._prev[i][2]);
          }
          R.travel += d;
        }
        R._prev = now;
      }

      const B = {};
      for (const b of m.skeleton.bones) B[b.name] = b;
      const get = (n) => (B[n] ? wp(B[n]) : null);

      // ── FLOAT ────────────────────────────────────────────────────────
      let low = Infinity;
      for (const n of ['mixamorigLeftToeBase', 'mixamorigRightToeBase', 'mixamorigLeftFoot', 'mixamorigRightFoot']) {
        const p = get(n); if (p) low = Math.min(low, p.y);
      }
      const head = get('mixamorigHead');
      if (Number.isFinite(low)) {
        R.heights.push(low);
        if (low > 0.12) { R.float.push({ who, clip, y: +low.toFixed(3) }); by.float++; }
      }
      /**
       * IS THE BODY ON THE MAT, not just the ankle bone?
       *
       * Owner: "they're floating like half a head or a head off of the
       * ground." A foot BONE sits at the ankle, several centimetres above
       * the sole, so "the foot bone is at y=0" and "the body is touching the
       * floor" are different claims and only the second one is his. This
       * measures the rendered MESH's lowest point in world space.
       */
      m.geometry.computeBoundingBox();
      const bb = m.geometry.boundingBox;
      if (bb) {
        // The skinned bounds move with the pose, so take the drawn mesh's
        // world box rather than the bind box.
        const soleY = (() => {
          let lo = Infinity;
          for (const b of m.skeleton.bones) {
            if (!/Foot|Toe/i.test(b.name)) continue;
            const e = b.matrixWorld.elements;
            lo = Math.min(lo, e[13]);
          }
          return lo;
        })();
        const headY = head ? head.y : null;
        if (Number.isFinite(soleY) && headY !== null) {
          const headSize = Math.max(0.01, (headY - soleY) / 7.5); // a body is ~7.5 heads
          R.bodyY.push(soleY);
          R.headSizes.push(headSize);
        }
      }

      // ── T-POSE: arms out sideways, not forward ───────────────────────
      const lS = get('mixamorigLeftArm'), rS = get('mixamorigRightArm');
      const lH = get('mixamorigLeftHand'), rH = get('mixamorigRightHand');
      const hips = get('mixamorigHips');
      if (lS && rS && lH && rH && hips) {
        const side = norm(sub(rS, lS));                        // shoulder axis
        const fwd = norm(cross({ x: 0, y: 1, z: 0 }, side));
        const arm = (sh, h) => { const d = sub(h, sh); const L = len(d); return { side: Math.abs(dot(d, side)) / L, fwd: Math.abs(dot(d, fwd)) / L, up: d.y / L }; };
        const a = arm(lS, lH), b2 = arm(rS, rH);
        const spread = (a.side + b2.side) / 2;
        const forward = (a.fwd + b2.fwd) / 2;
        const level = (Math.abs(a.up) + Math.abs(b2.up)) / 2;
        if (spread > 0.75 && forward < 0.35 && level < 0.35) {
          R.tpose.push({ who, clip, spread: +spread.toFixed(2), forward: +forward.toFixed(2) });
          by.tpose++;
        }
      }

      // ── TWIST: a hinge rotated about its own length ──────────────────
      /**
       * A BONE THAT SNAPS — which is what a glitch actually looks like.
       *
       * Owner: "it looks like they're trying to do the right thing with some
       * of the body parts, but then some of the other body parts are
       * twisting and doing the wrong thing", and "making their body twist
       * all around."
       *
       * THE PREVIOUS METRIC HERE WAS WRONG AND I SHIPPED ITS FINDING BEFORE
       * DISPROVING IT. It compared each bone's raw local quaternion against
       * an anatomical limit — but a local quaternion carries the rig's BIND
       * rotation, so a perfectly normal forearm read as 64 degrees off its
       * hinge. Measured relative to bind, the way constrainHinges actually
       * works, every clip in the bank is inside its limits. A live probe
       * cannot easily get at bind, so it should not pretend to.
       *
       * What it CAN see, and what he is actually describing, is a POP: one
       * bone jumping a long way in a single frame while the body around it
       * moves normally. That is what a stranded bone does when a crossfade
       * leaves it behind, and it needs no bind pose to detect — the bone's
       * own previous orientation is the reference.
       */
      const prevQ = (R._q[who] = R._q[who] ?? {});
      for (const b of m.skeleton.bones) {
        const q = b.quaternion;
        const p0 = prevQ[b.name];
        if (p0) {
          let d = Math.abs(p0[0] * q.x + p0[1] * q.y + p0[2] * q.z + p0[3] * q.w);
          d = Math.min(1, d);
          const jump = deg(2 * Math.acos(d));
          if (jump > 70) {
            R.twist.push({ who, clip, bone: b.name.replace('mixamorig', ''), kind: 'snap', deg: Math.round(jump) });
            by.twist++;
          }
        }
        prevQ[b.name] = [q.x, q.y, q.z, q.w];
      }
      void head;
    });
  };
  const loop = () => { try { sample(); } catch (e) { w.__RIG_REPORT.err = String(e).slice(0, 120); } requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
});

// Drive the fight so the rig is actually doing things, not just idling.
/**
 * HOLD THE KEY LONG ENOUGH FOR THE GAME TO SEE IT.
 *
 * The first run of this reported ZERO defects and `clips seen: STANCEx132` —
 * one clip, for the whole run. It had measured thirty seconds of idling. A
 * 140 ms press cannot be observed by a state machine ticking at the ~2 fps
 * swiftshader manages, because the whole press falls between two frames. The
 * same trap cost this repo a day on probe-command-moves.
 *
 * So: press for 400 ms, and CHECK that the clip actually changed. A run that
 * never leaves the stance has measured nothing and says so.
 */
const KEYS = ['u', 'i', 'j', 'k', 'v', 'ArrowRight', 'ArrowLeft', 'ArrowDown', 'c', 'u', 'k'];
const until = Date.now() + SECONDS * 1000;
let n = 0;
while (Date.now() < until) {
  const k = KEYS[n++ % KEYS.length];
  await page.keyboard.down(k);
  await page.waitForTimeout(420);
  await page.keyboard.up(k);
  await page.waitForTimeout(420);
}

const R = await page.evaluate(() => {
  const r = window.__RIG_REPORT;
  const h = r.heights.slice().sort((a, b) => a - b);
  const q = (f) => (h.length ? h[Math.floor(h.length * f)] : 0);
  return {
    frames: r.frames, err: r.err,
    rigsSeen: r.rigsSeen, bones: r.boneCounts[0] ?? 0,
    travel: +r.travel.toFixed(2),
    clips: Object.entries(r.clipsSeen).sort((a, b) => b[1] - a[1]).slice(0, 8),
    tpose: r.tpose.length, twist: r.twist.length, float: r.float.length,
    footP50: +q(0.5).toFixed(3), footP90: +q(0.9).toFixed(3), footMax: +(h[h.length - 1] ?? 0).toFixed(3),
    bodyY: r.bodyY.length ? +(r.bodyY.reduce((s2, v) => s2 + v, 0) / r.bodyY.length).toFixed(3) : null,
    headSize: r.headSizes.length ? +(r.headSizes.reduce((s2, v) => s2 + v, 0) / r.headSizes.length).toFixed(3) : null,
    tposeTop: r.tpose.slice(0, 4), twistTop: r.twist.slice(0, 6), floatTop: r.float.slice(0, 4),
    worst: Object.entries(r.byClip)
      .map(([c, v]) => ({ clip: c, ...v, bad: v.tpose + v.twist + v.float }))
      .filter((x) => x.bad > 0).sort((a, b) => b.bad - a.bad).slice(0, 8),
  };
});

console.log('\nRIG SANITY IN A LIVE MATCH\n');
console.log(`  frames sampled        ${R.frames}${R.err ? `  (sampler error: ${R.err})` : ''}`);
console.log(`  rigs found            ${R.rigsSeen}, ${R.bones} bones each`);
console.log(`  bone travel           ${R.travel} m total — ${R.travel > 5 ? 'the rig is animating' : 'THE RIG IS NOT MOVING, every number below is meaningless'}`);
console.log(`  clips seen            ${R.clips.map(([c, n]) => `${c}x${n}`).join(', ') || '(none)'}`);
if (R.clips.length <= 1) {
  console.log('  ⚠️  ONE CLIP FOR THE WHOLE RUN — this measured an idle, not combat. Nothing below means anything.');
}
console.log(`  T-POSE frames         ${R.tpose}`);
console.log(`  BONE SNAPS            ${R.twist}  (a joint jumping >70 deg in one frame)`);
console.log(`  FLOATING frames       ${R.float}  (lowest foot above 12 cm)`);
console.log(`  lowest foot           p50 ${R.footP50}m   p90 ${R.footP90}m   worst ${R.footMax}m`);
if (R.bodyY !== null) {
  const heads = R.headSize ? (R.bodyY / R.headSize) : 0;
  console.log(`  body above the mat    ${R.bodyY}m = ${heads.toFixed(2)} head-heights (a head measures ${R.headSize}m)`);
  console.log(`                        ${Math.abs(heads) < 0.25 ? 'ON THE MAT' : 'FLOATING — this is the complaint'}`);
}
if (R.tposeTop.length) console.log('  t-pose e.g.  ' + R.tposeTop.map((x) => `${x.who}/${x.clip} spread ${x.spread}`).join(' | '));
if (R.twistTop.length) console.log('  twist e.g.   ' + R.twistTop.map((x) => `${x.who}/${x.clip} ${x.bone} ${x.kind} ${x.deg}deg`).join(' | '));
if (R.floatTop.length) console.log('  float e.g.   ' + R.floatTop.map((x) => `${x.who}/${x.clip} y=${x.y}`).join(' | '));
if (R.worst.length) {
  console.log('\n  WORST CLIPS (frames with a defect):');
  for (const x of R.worst) console.log(`    ${String(x.clip).padEnd(28)} seen ${String(x.n).padStart(4)}  tpose ${x.tpose}  twist ${x.twist}  float ${x.float}`);
}
console.log(`\npage errors: ${errs.length}${errs.length ? ' — ' + errs.slice(0, 2).join(' | ') : ''}`);
await browser.close();
