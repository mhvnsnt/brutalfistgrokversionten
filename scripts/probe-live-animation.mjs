#!/usr/bin/env node
/**
 * Measure whether fighters ACTUALLY animate in a live match, and whether their
 * world placement holds still while they do.
 *
 * This project keeps hitting the same failure: a clip binds, resolves every
 * track, reports PASS, and the body does not move. Counting clips or tracks
 * cannot see that. The only honest test is to read a bone's WORLD position out
 * of the running scene, repeatedly, during a real fight.
 *
 * HOW IT REACHES THE SCENE WITHOUT TOUCHING THE APP
 *   three.js dispatches every Scene and WebGLRenderer it constructs to
 *   `__THREE_DEVTOOLS__` when that object exists (three.core.js). Installing an
 *   EventTarget under that name BEFORE any app code runs hands over the live
 *   scene with no source change and no debug hook left in the shipped build.
 *   R3F v9 keeps no handle on the canvas element, and the React fiber does not
 *   carry the store on a reachable path, so both of those were tried first and
 *   do not work.
 *
 * WHAT THE NUMBERS MEAN
 *   Hips travel ~0 is CORRECT, not a failure: the orientation contract pins the
 *   fighter's root (COMBAT_FIGHTER_Y = 0, root motion neutralised, the instance
 *   owns facing and position). Hips moving would mean root motion had leaked
 *   back in and the fighter was drifting off his mark.
 *   Hands, feet and head travelling is the animation actually reaching the
 *   skeleton. An idle fighter shows centimetres; a fighting one shows tens.
 *
 * MEASURED BASELINE (2026-09-18, BANNON idle vs VIPER fighting, 6 s):
 *   p1 Hips 0.00cm  Head 2.20cm   RightHand 2.50cm   LeftFoot 8.22cm
 *   p2 Hips 0.00cm  Head 39.75cm  RightHand 31.60cm  LeftFoot 125.66cm
 *
 * Usage: npm run dev, then node scripts/probe-live-animation.mjs
 */
import { chromium } from 'playwright';
const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const p=await b.newPage({viewport:{width:1280,height:800}});
const errs=[]; p.on('pageerror',e=>errs.push(String(e.message).slice(0,140)));
// three.js dispatches every Scene and WebGLRenderer it constructs to
// __THREE_DEVTOOLS__ if that object exists. Installing it before any app code
// runs gives a real handle on the live scene without touching the source.
await p.addInitScript(() => {
  const target = new EventTarget();
  window.__observed = [];
  target.addEventListener('observe', (e) => { window.__observed.push(e.detail); });
  Object.defineProperty(window, '__THREE_DEVTOOLS__', { value: target, writable: false });
});
await p.goto(process.env.BF_BASE || 'http://127.0.0.1:8080/',{waitUntil:'domcontentloaded',timeout:120000});
await p.waitForTimeout(8000);
await p.click('body'); await p.keyboard.press('Enter'); await p.waitForTimeout(5000);
const click=(s)=>p.evaluate((src)=>{const rx=new RegExp(src,'i');
  const el=[...document.querySelectorAll('button,[role=button],div,span')].find(e=>rx.test((e.innerText||'').trim())&&e.offsetParent!==null&&(e.innerText||'').length<90);
  if(!el) return false; el.click(); return true;},s);
await click('^VERSUS$'); await p.waitForTimeout(5000);
await click('^BANNON$'); await p.waitForTimeout(3000);
await click('^VIPER$'); await p.waitForTimeout(3000);
await click('^FIGHT!$'); await p.waitForTimeout(9000);
await click('CONFIRM'); await p.waitForTimeout(30000);

// Reach the three.js scene through R3F's fiber handle on the canvas element.
const setup = await p.evaluate(() => {
  const scenes = (window.__observed || []).filter(o => o && o.isScene);
  if (!scenes.length) return 'no Scene observed (' + (window.__observed || []).length + ' objects)';
  // the combat scene is the one holding skinned fighters
  let scene = scenes[scenes.length - 1];
  for (const s of scenes) { let n = 0; s.traverse(o => { if (o.isSkinnedMesh) n++; }); if (n >= 2) scene = s; }
  window.__scene = scene;
  const bones = []; const skinned = [];
  scene.traverse(o => { if (o.isBone) bones.push(o); if (o.isSkinnedMesh) skinned.push(o.name || '(unnamed)'); });
  return { scenesObserved: scenes.length, bones: bones.length, skinned };
});
console.log('SCENE:', JSON.stringify(setup));
if (typeof setup === 'string') { console.log('ERRORS:', errs.length); await b.close(); process.exit(0); }

// Sample named bone world positions over ~6 seconds of live combat.
const samples = [];
for (let i = 0; i < 12; i++) {
  samples.push(await p.evaluate(() => {
    const out = {};
    const want = ['mixamorigRightHand','mixamorigLeftFoot','mixamorigHips','mixamorigHead'];
    let idx = 0;
    window.__scene.traverse(o => {
      if (!o.isBone || !want.includes(o.name)) return;
      o.updateWorldMatrix(true, false);
      const p = new (o.matrixWorld.constructor)();
      const m = o.matrixWorld.elements;
      out[(idx++ < 4 ? 'p1_' : 'p2_') + o.name.replace('mixamorig','')] = [ +m[12].toFixed(4), +m[13].toFixed(4), +m[14].toFixed(4) ];
    });
    return out;
  }));
  await p.waitForTimeout(500);
}
const keys = Object.keys(samples[0] || {});
console.log('sampled bones:', keys.length);
for (const k of keys) {
  const xs = samples.map(s => s[k]).filter(Boolean);
  if (xs.length < 2) continue;
  let maxd = 0;
  for (let i = 1; i < xs.length; i++) {
    const d = Math.hypot(xs[i][0]-xs[0][0], xs[i][1]-xs[0][1], xs[i][2]-xs[0][2]);
    if (d > maxd) maxd = d;
  }
  console.log(`  ${k.padEnd(26)} max world travel over 6s: ${(maxd*100).toFixed(2)} cm`);
}
console.log('ERRORS:', errs.length); errs.slice(0,4).forEach(e=>console.log('  ',e));
await b.close();
