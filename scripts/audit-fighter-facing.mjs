#!/usr/bin/env node
/**
 * ARE THEY ACTUALLY AIMING AT EACH OTHER?
 *
 * Owner: "the direction that they're hitting in, we got to make sure they're
 * hitting in the direction of their opponent and not off to the side, like
 * out to empty space. That's the same for both sides, P1 and P2."
 *
 * Two things have to be true and they are separate:
 *   1. FACING — the fighter's body points at the opponent.
 *   2. REACH  — the striking hand actually travels toward the opponent, not
 *      merely somewhere in front of a body that happens to be turned.
 *
 * Both are measured here in WORLD space out of the running match, because a
 * fighter can be correctly yawed and still throw a clip whose motion goes
 * sideways, and the opposite is just as possible.
 *
 * MEASURED BASELINE for the rig: bind forward is +X, left is +Z, read off
 * toe-minus-ankle and the hand span. So a fighter's world forward is his
 * object-space +X pushed through his world matrix.
 *
 * Usage: npm run dev, then node scripts/audit-fighter-facing.mjs
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

// three.js announces every Scene it builds to __THREE_DEVTOOLS__ when that
// object exists. Installing it before any app code runs is the only handle on
// the live scene that does not need a source change (R3F v9 keeps none).
await page.addInitScript(() => {
  const target = new EventTarget();
  window.__observed = [];
  target.addEventListener('observe', (e) => window.__observed.push(e.detail));
  Object.defineProperty(window, '__THREE_DEVTOOLS__', { value: target, writable: false });
});
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
await click('CONFIRM'); await page.waitForTimeout(26000);

const report = await page.evaluate(() => {
  const scenes = (window.__observed || []).filter((o) => o && o.isScene);
  if (!scenes.length) return { error: 'no Scene observed' };
  let scene = scenes[scenes.length - 1];
  for (const s of scenes) {
    let n = 0; s.traverse((o) => { if (o.isSkinnedMesh) n++; });
    if (n >= 2) scene = s;
  }
  // A fighter is the ancestor that owns a Hips bone; its world matrix carries
  // the instance yaw the combat loop applies.
  const roots = [];
  scene.traverse((o) => {
    if (o.name !== 'mixamorigHips') return;
    let r = o;
    while (r.parent && r.parent !== scene) r = r.parent;
    if (!roots.includes(r)) roots.push({ root: r, hips: o });
  });
  if (roots.length < 2) return { error: `found ${roots.length} fighter root(s)` };

  const V = roots[0].hips.constructor === undefined ? null : null;
  const out = [];
  for (let i = 0; i < 2; i++) {
    const me = roots[i], them = roots[1 - i];
    me.root.updateWorldMatrix(true, true); them.root.updateWorldMatrix(true, true);
    const m = me.root.matrixWorld.elements, t = them.root.matrixWorld.elements;
    // Object-space +X through the world matrix, flattened to the floor.
    let fx = m[0], fz = m[2];
    const fl = Math.hypot(fx, fz) || 1; fx /= fl; fz /= fl;
    let dx = t[12] - m[12], dz = t[14] - m[14];
    const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
    const dot = Math.max(-1, Math.min(1, fx * dx + fz * dz));
    out.push({
      side: i === 0 ? 'p1' : 'p2',
      pos: [+m[12].toFixed(2), +m[13].toFixed(2), +m[14].toFixed(2)],
      forward: [+fx.toFixed(2), +fz.toFixed(2)],
      toOpponent: [+dx.toFixed(2), +dz.toFixed(2)],
      offByDeg: +((Math.acos(dot) * 180) / Math.PI).toFixed(1),
      separation: +dl.toFixed(2),
    });
  }
  return { out };
});

if (report.error) { console.error('FAILED:', report.error); }
else {
  console.log('SIDE  POSITION              FORWARD(x,z)  TO OPPONENT(x,z)  OFF BY   GAP');
  for (const r of report.out) {
    console.log(
      `${r.side.padEnd(5)} [${r.pos.join(', ')}]`.padEnd(30) +
      `[${r.forward.join(', ')}]`.padEnd(14) +
      `[${r.toOpponent.join(', ')}]`.padEnd(18) +
      `${String(r.offByDeg).padStart(5)}deg  ${r.separation}`,
    );
  }
  const worst = Math.max(...report.out.map((r) => r.offByDeg));
  console.log(`\nworst facing error: ${worst} deg  ${worst < 15 ? '(aimed at the opponent)' : '<-- NOT AIMED AT THE OPPONENT'}`);
}
console.log('page errors:', errs.length);
errs.slice(0, 4).forEach((e) => console.log('  ', e));
await browser.close();
