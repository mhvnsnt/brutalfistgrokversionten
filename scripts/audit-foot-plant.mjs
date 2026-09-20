#!/usr/bin/env node
/**
 * ARE THE FEET ON THE FLOOR?
 *
 * Owner: "the legs are not planted and stable. It's doing this real weird
 * extending at the hips and waist and like leaning on its toes into the
 * punch and that's so unstable and ragdoll wobbly."
 *
 * A measurable claim. The fighter's root is pinned — root motion is stripped
 * and COMBAT_FIGHTER_Y is 0 — so the ONLY thing holding a foot on the floor
 * is the pose. If a clip's hips pitch forward and the legs do not
 * compensate, the heel lifts and the body pivots onto its toes. Every joint
 * involved can be inside its range while that happens, which is why joint
 * clamping cannot fix it and why it has to be measured separately.
 *
 * DRIVEN THROUGH THE REAL PIPELINE IN A REAL BROWSER, deliberately: a
 * standalone sampler that re-implements posing gets its own answer, and the
 * first version of this script did exactly that and reported a foot 195 cm
 * above the floor. The mixer is the authority on what a clip does.
 *
 * Usage: npm run dev, then
 *   node scripts/audit-foot-plant.mjs [clip,clip,...] [model.glb]
 */
import { chromium } from 'playwright';

const CLIPS = process.argv[2] ?? '';
const MODEL = process.argv[3] ?? 'BANNON_rigged.glb';
const BASE = process.env.BF_BASE ?? 'http://127.0.0.1:8080';
/** Beyond this a foot is not "planted" by any reading. */
const TOLERANCE_M = 0.04;

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
await page.goto(`${BASE}/?model=${MODEL}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForLoadState('networkidle').catch(() => {});
await page.waitForTimeout(2500);
await page.evaluate(() => {
  document.body.innerHTML = '<div id="app"></div>';
  const s = document.createElement('script');
  s.type = 'module';
  s.src = '/tools/posesheet/main.ts';
  document.body.appendChild(s);
});
await page.waitForFunction('window.__POSESHEET_READY === true', null, { timeout: 300000 });

const rows = await page.evaluate(async ({ only }) => {
  const H = window.__POSESHEET;
  if (!H) return { error: 'pose sheet published no handles' };
  const { THREE, scene, mixer, actionFor, clipNames } = H;
  const FEET = ['mixamorigLeftToeBase', 'mixamorigRightToeBase', 'mixamorigLeftFoot', 'mixamorigRightFoot'];
  const v = new THREE.Vector3();
  const lowest = () => {
    let y = Infinity;
    for (const n of FEET) {
      const b = scene.getObjectByName(n);
      if (!b) continue;
      b.getWorldPosition(v);
      if (v.y < y) y = v.y;
    }
    return y;
  };
  // RESET TO BIND BETWEEN CLIPS. stopAllAction does not restore a bone, so a
  // clip that drives 20 bones inherits the previous clip's other 38 and the
  // measurement becomes order-dependent. The first version of this script had
  // that bug and blamed a roundhouse for 25 cm of sink it did not cause.
  const bindPose = new Map();
  scene.traverse((o) => { if (o.isBone) bindPose.set(o, o.quaternion.clone()); });
  const bindPos = new Map();
  scene.traverse((o) => { if (o.isBone) bindPos.set(o, o.position.clone()); });
  const resetBind = () => {
    mixer.stopAllAction();
    for (const [b, q] of bindPose) b.quaternion.copy(q);
    for (const [b, p] of bindPos) b.position.copy(p);
    scene.updateMatrixWorld(true);
  };

  mixer.stopAllAction();
  scene.updateMatrixWorld(true);
  const floor = lowest();

  const names = only.length ? only : clipNames();
  const out = [];
  for (const name of names) {
    const act = actionFor(name);
    if (!act) continue;
    const dur = act.getClip().duration || 1;
    let lift = 0;
    let sink = 0;
    for (let k = 0; k <= 16; k++) {
      resetBind();
      act.reset().play();
      mixer.setTime((dur * k) / 16);
      scene.updateMatrixWorld(true);
      const d = lowest() - floor;
      if (d > lift) lift = d;
      if (d < sink) sink = d;
    }
    out.push({ clip: name, lift: +lift.toFixed(3), sink: +sink.toFixed(3) });
  }
  return { floor: +floor.toFixed(3), out };
}, { only: CLIPS.split(',').filter(Boolean) });

if (rows.error) { console.error(rows.error); await browser.close(); process.exit(1); }
rows.out.sort((a, b) => b.lift - a.lift);
console.log(`bind floor at y = ${rows.floor}`);
console.log('CLIP'.padEnd(34) + 'foot LIFT'.padStart(12) + 'foot SINK'.padStart(12));
for (const r of rows.out.slice(0, 15)) {
  console.log(r.clip.padEnd(34) + `${(r.lift * 100).toFixed(1)} cm`.padStart(12) + `${(r.sink * 100).toFixed(1)} cm`.padStart(12));
}
const floating = rows.out.filter((r) => r.lift > TOLERANCE_M);
const sinking = rows.out.filter((r) => r.sink < -TOLERANCE_M);
console.log(`\nclips measured: ${rows.out.length}`);
console.log(`both feet more than 4 cm off the floor at some frame: ${floating.length}`);
console.log(`lowest foot more than 4 cm through the floor:         ${sinking.length}`);
await browser.close();
