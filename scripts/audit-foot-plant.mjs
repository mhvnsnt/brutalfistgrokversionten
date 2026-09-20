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

/** The bake records which clips leave the floor on purpose. */
const manifest = JSON.parse(
  (await import('node:fs')).readFileSync('public/motion/baked/index.json', 'utf8'),
);
const airborne = new Set(Object.entries(manifest).filter(([, m]) => m.airborne).map(([k]) => k));

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
    // THE NUMBER THAT MEANS "PLANTED". lift is the PEAK — a jab that steps
    // has a peak and should. What says a fighter is hovering is that he never
    // comes DOWN: the closest his lowest foot ever gets to the floor over the
    // whole clip. Judging on the peak alone condemns every clip with a step
    // in it and misses a stance that floats at a constant 23 cm.
    let closest = Infinity;
    for (let k = 0; k <= 16; k++) {
      resetBind();
      act.reset().play();
      mixer.setTime((dur * k) / 16);
      scene.updateMatrixWorld(true);
      const d = lowest() - floor;
      if (d > lift) lift = d;
      if (d < sink) sink = d;
      if (d < closest) closest = d;
    }
    // An action name is often an ALIAS ('grapple', 'throw'); the clip's own
    // name is what the bake recorded, and it is what decides intent.
    out.push({
      clip: name,
      source: act.getClip().name,
      lift: +lift.toFixed(3),
      sink: +sink.toFixed(3),
      closest: +(Number.isFinite(closest) ? closest : 0).toFixed(3),
    });
  }
  return { floor: +floor.toFixed(3), out };
}, { only: CLIPS.split(',').filter(Boolean) });

if (rows.error) { console.error(rows.error); await browser.close(); process.exit(1); }
rows.out.sort((a, b) => b.closest - a.closest);
console.log(`bind floor at y = ${rows.floor}`);
console.log('CLIP'.padEnd(34) + 'NEVER CLOSER'.padStart(14) + 'peak LIFT'.padStart(12) + 'foot SINK'.padStart(12));
for (const r of rows.out.slice(0, 15)) {
  console.log(
    r.clip.padEnd(34) +
    `${(r.closest * 100).toFixed(1)} cm`.padStart(14) +
    `${(r.lift * 100).toFixed(1)} cm`.padStart(12) +
    `${(r.sink * 100).toFixed(1)} cm`.padStart(12),
  );
}
// Split by what the bake INTENDED. A jump in the air and a victim dipping at
// impact are not defects; a standing move doing either is.
const grounded = rows.out.filter((r) => !airborne.has(r.source ?? r.clip));
const floating = grounded.filter((r) => r.closest > TOLERANCE_M);
const sinking = grounded.filter((r) => r.sink < -TOLERANCE_M);
console.log(`\nactions measured: ${rows.out.length}  (${grounded.length} meant to be on the floor)`);
console.log(`GROUNDED clips that NEVER touch the floor:     ${floating.length}`);
console.log(`GROUNDED clips more than 4 cm through it:      ${sinking.length}`);
for (const r of [...floating, ...sinking].slice(0, 8)) {
  console.log(`  ${r.clip.padEnd(28)} ${(r.source ?? '').padEnd(26)} closest ${(r.closest * 100).toFixed(1)}  peak ${(r.lift * 100).toFixed(1)}  sink ${(r.sink * 100).toFixed(1)}`);
}
console.log(`(airborne by design, not counted: ${rows.out.length - grounded.length})`);
await browser.close();
