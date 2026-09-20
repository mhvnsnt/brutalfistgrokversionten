/**
 * THREE THINGS THE OWNER REPORTED, MEASURED IN ONE MATCH.
 *
 *   1. "they're like almost floating off of the ground"
 *   2. "you can't move forward and get close enough to your opponent, you
 *      can't even hit them, and you can't move back anymore"
 *   3. "the fingers or the hands is stretching towards the pants or the
 *      hips or the thighs"
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
const click = (t) => page.evaluate((s) => {
  const rx = new RegExp(s, 'i');
  const el = [...document.querySelectorAll('button,[role=button],div,span')]
    .find((e) => rx.test((e.innerText || '').trim()) && e.offsetParent !== null && (e.innerText || '').length < 90);
  if (!el) return false; el.click(); return true;
}, t);
await click('^VERSUS$'); await page.waitForTimeout(4000);
await click('^' + (process.env.BF_P1 ?? 'BANNON') + '$'); await page.waitForTimeout(2500);
await click('^' + (process.env.BF_P2 ?? 'VIPER') + '$'); await page.waitForTimeout(2500);
await click('^FIGHT!$'); await page.waitForTimeout(8000);
await click('CONFIRM'); await page.waitForTimeout(28000);

const read = () => page.evaluate(() => {
  const d = window.__BF_DEBUG ?? {};
  return { pos: d.positions ? d.positions() : null, y: d.renderY ? d.renderY() : null };
});

console.log('--- 1 & 2: FLOAT AND APPROACH ---');
const before = await read();
console.log('at rest   ', JSON.stringify(before));
await page.keyboard.down('ArrowRight');
const walk = [];
for (let i = 0; i < 12; i++) { await page.waitForTimeout(150); walk.push(await read()); }
await page.keyboard.up('ArrowRight');
console.log('holding FORWARD, gap and render Y per sample:');
walk.forEach((w, i) => console.log('  ', i, 'gap', w.pos ? w.pos.gap.toFixed(3) : '?',
  ' p1 y', w.y ? Number(w.y.p1).toFixed(3) : '?', ' p1 x', w.pos ? w.pos.p1.x.toFixed(2) : '?'));

await page.keyboard.down('ArrowLeft');
const back = [];
for (let i = 0; i < 8; i++) { await page.waitForTimeout(150); back.push(await read()); }
await page.keyboard.up('ArrowLeft');
console.log('holding BACK:');
back.forEach((w, i) => console.log('  ', i, 'gap', w.pos ? w.pos.gap.toFixed(3) : '?',
  ' p1 x', w.pos ? w.pos.p1.x.toFixed(2) : '?'));

console.log('--- 3: WEBBING ON THE BODIES ACTUALLY ON SCREEN ---');
const bleed = await page.evaluate(() => (window.__BF_DEBUG?.skinBleed ? window.__BF_DEBUG.skinBleed() : null));
console.log(JSON.stringify(bleed, null, 1).slice(0, 900));
await page.screenshot({ path: 'scratchpad/repro/float.png' });
await browser.close();
