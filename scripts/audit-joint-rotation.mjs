#!/usr/bin/env node
/**
 * HOW FAR DOES EACH JOINT ACTUALLY GO?
 *
 * The owner's recurring report is "twisting like an owl" / "contorting". That
 * is not a vague complaint — it is a joint exceeding its range, and it has a
 * number. This decomposes every frame's local rotation, relative to the
 * MODEL'S OWN BIND, into swing (bend) and twist (axial roll) and reports the
 * worst per joint per clip.
 *
 * Euler angles cannot do this job: a triple hits gimbal lock and reports a
 * wild number for a perfectly ordinary pose. Swing-twist is exact.
 *
 * Runs the SHIPPING pipeline in a real browser, so it measures what the game
 * plays, not what a source file contains.
 *
 * Usage:
 *   npm run dev
 *   node scripts/audit-joint-rotation.mjs [clip,clip,...] [model.glb]
 *   ALL=1 node scripts/audit-joint-rotation.mjs idle     # every joint, not just offenders
 */
import { chromium } from 'playwright';

const CLIPS = process.argv[2] ?? 'idle,attack_1,attack_rp,attack_lk,attack_rk,block,HURRICANE_KICK,STANCE';
const MODEL = process.argv[3] ?? 'BANNON_rigged.glb';
const BASE = process.env.BF_BASE ?? 'http://127.0.0.1:8080';
const SHOW_ALL = !!process.env.ALL;

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

const rows = await page.evaluate(
  async ({ clips, showAll }) => {
    const H = window.__POSESHEET;
    if (!H) return { error: 'pose sheet did not publish its handles' };
    const { THREE, scene, mixer, actionFor, limits } = H;
    const Y = new THREE.Vector3(0, 1, 0);
    const deg = (q) => (2 * Math.acos(Math.min(1, Math.abs(q.w))) * 180) / Math.PI;
    const split = (q) => {
      const p = new THREE.Vector3(q.x, q.y, q.z);
      const proj = Y.clone().multiplyScalar(p.dot(Y));
      let t = new THREE.Quaternion(proj.x, proj.y, proj.z, q.w);
      if (t.lengthSq() < 1e-12) t = new THREE.Quaternion();
      else t.normalize();
      return { twist: deg(t), swing: deg(q.clone().multiply(t.clone().invert())) };
    };
    mixer.stopAllAction();
    const bind = new Map();
    scene.traverse((o) => { if (o.isBone) bind.set(o.name, o.quaternion.clone()); });

    const out = [];
    for (const name of clips) {
      const act = actionFor(name);
      if (!act) { out.push({ clip: name, missing: true }); continue; }
      const dur = act.getClip().duration || 1;
      const worst = new Map();
      for (let i = 0; i <= 24; i++) {
        mixer.stopAllAction();
        act.reset().play();
        mixer.setTime((dur * i) / 24);
        for (const [b, q0] of bind) {
          if (!showAll && !limits[b]) continue;
          const bone = scene.getObjectByName(b);
          if (!bone) continue;
          const { swing, twist } = split(q0.clone().invert().multiply(bone.quaternion));
          const cur = worst.get(b) ?? { swing: 0, twist: 0, minTwist: 1e9, minSwing: 1e9 };
          worst.set(b, {
            swing: Math.max(cur.swing, swing), twist: Math.max(cur.twist, twist),
            minSwing: Math.min(cur.minSwing, swing), minTwist: Math.min(cur.minTwist, twist),
          });
        }
      }
      for (const [b, v] of worst) {
        const lim = limits[b];
        out.push({
          clip: name, bone: b,
          bend: +v.swing.toFixed(1), twist: +v.twist.toFixed(1),
          twistRange: +(v.twist - v.minTwist).toFixed(1), minTwist: +v.minTwist.toFixed(1),
          limBend: lim?.bend ?? null, limTwist: lim?.twist ?? null,
          over: !!lim && (v.swing > lim.bend + 0.5 || v.twist > lim.twist + 0.5),
        });
      }
    }
    return { out };
  },
  { clips: CLIPS.split(','), showAll: SHOW_ALL },
);

if (rows.error) { console.error(rows.error); await browser.close(); process.exit(1); }
console.log('CLIP'.padEnd(18) + 'JOINT'.padEnd(20) + 'bend'.padStart(7) + 'twist'.padStart(8) + 'twistMin'.padStart(9) + 'range'.padStart(7) + '   limit');
let over = 0;
for (const r of rows.out) {
  if (r.missing) { console.log(`${r.clip.padEnd(18)}(no action)`); continue; }
  if (!SHOW_ALL && !r.over && r.twist < (r.limTwist ?? 1e9) * 0.75) continue;
  if (r.over) over++;
  console.log(
    r.clip.padEnd(18) + r.bone.replace('mixamorig', '').padEnd(20) +
    String(r.bend).padStart(7) + String(r.twist).padStart(8) +
    String(r.minTwist).padStart(9) + String(r.twistRange).padStart(7) +
    (r.limBend != null ? `   ${r.limBend}/${r.limTwist}` : '   —') + (r.over ? '  <-- OVER' : ''),
  );
}
console.log(`\njoints over their range: ${over}`);
await browser.close();
