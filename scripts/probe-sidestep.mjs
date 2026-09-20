/**
 * IS THE SIDESTEP RADIAL ON SCREEN?
 *
 * Owner, twice: "the sidestepping is not radial ... when they sidestep they
 * still do a straight sidestep. And the camera does like a 45 degree tilt
 * towards your character and pretty much stops showing your opponent."
 *
 * LocomotionSystem.targetedSidestepVelocity computes a real tangent around
 * the opponent, so the path SHOULD arc. This records where both fighters
 * actually are, which way each is facing, and where the camera is looking,
 * every frame of a held sidestep — the three things that decide whether it
 * READS as radial.
 */
import { chromium } from 'playwright';

const BASE = process.env.BF_BASE ?? 'http://127.0.0.1:8080';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(8000);
await page.click('body');
await page.keyboard.press('Enter');
await page.waitForTimeout(5000);
// The same navigation probe-command-moves.mjs uses — it is the one that works.
const click = (src) => page.evaluate((t) => {
  const rx = new RegExp(t, 'i');
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

const sample = () => page.evaluate(() => {
  const d = window.__BF_DEBUG ?? {};
  return {
    pos: d.positions ? d.positions() : null,
    scr: d.onScreen ? d.onScreen() : null,
    yaw: (() => {
      const out = [];
      const s3 = window.__BF_SCENE;
      return out;
    })(),
    keys: Object.keys(d),
  };
});
console.log('debug keys:', JSON.stringify((await sample()).keys));

const rows = [];
await page.keyboard.down('e');           // sidestep foreground
for (let i = 0; i < 14; i++) {
  await page.waitForTimeout(120);
  rows.push(await sample());
}
await page.screenshot({ path: 'scratchpad/repro/sidestep_mid.png' });
await page.keyboard.up('e');
console.log('t    p1(x,z)        p2(x,z)      gap    on-screen');
rows.forEach((r, i) => {
  const p = r.pos; if (!p) { console.log(i, 'no positions'); return; }
  const sc = r.scr;
  console.log(String(i).padStart(2),
    p.p1.x.toFixed(2).padStart(6), p.p1.z.toFixed(2).padStart(6),
    '  ', p.p2.x.toFixed(2).padStart(6), p.p2.z.toFixed(2).padStart(6),
    '  gap', p.gap.toFixed(2),
    sc ? `  screen p1 ${sc.p1.x.toFixed(2)} ${sc.p1.onScreen ? 'IN ' : 'OUT'}  p2 ${sc.p2.x.toFixed(2)} ${sc.p2.onScreen ? 'IN ' : 'OUT'}` : '  (no camera)');
});
await page.screenshot({ path: 'scratchpad/repro/sidestep.png' });
await browser.close();
