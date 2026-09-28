/**
 * RECORD THE FIGHT AND WATCH IT.
 *
 * Owner: "why don't you just have a video thing that lets you see video wise
 * that when you play the fucking thing ... because you would see exactly why
 * the animations don't look like they're doing the actual fight."
 *
 * He is right that picking at per-clip statistics one at a time was the wrong
 * shape of work. This plays a real round and writes an actual video of it, plus
 * a contact sheet of frames across the attacks, so the motion can be LOOKED at
 * as motion rather than inferred from counters.
 *
 * Usage: node tools/harness/record.mjs [--seconds=N] [--quality=low|high]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const URL = process.env.PLAYTEST_URL || 'http://localhost:8080/';
const OUT = process.env.REC_OUT || '/tmp/claude-0/-home-user/24d89c3d-4d02-5673-80e7-7cb3458dd0ee/scratchpad/video';
const args = process.argv.slice(2);
const SECONDS = Number((args.find((a) => a.startsWith('--seconds=')) || '--seconds=30').split('=')[1]);
const LOWQ = !args.includes('--quality=high');

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox',
         '--disable-frame-rate-limit', '--disable-gpu-vsync'],
});
const context = await browser.newContext({
  viewport: { width: 412, height: 915 },
  deviceScaleFactor: 1,          // 1, not 2 -- a software rasterizer pays for every pixel
  isMobile: true, hasTouch: true,
  recordVideo: { dir: OUT, size: { width: 412, height: 915 } },
});
const page = await context.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message || e)));

const click = (t) => `(()=>{
  const want=${JSON.stringify(t)};
  const ex=[...document.querySelectorAll('button,[role=button]')].filter(e=>(e.textContent||'').trim()===want);
  const lf=[...document.querySelectorAll('*')].filter(e=>e.children.length===0&&(e.textContent||'').trim()===want);
  const el=ex[0]||lf[0]; if(!el) return false;
  let n=el; for(let i=0;i<4&&n;i++){n.click?.();n=n.parentElement;} return true;})()`;

console.log(`RECORDING -> ${OUT}`);
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(5000);
await page.mouse.click(206, 458); await page.waitForTimeout(2500);
await page.evaluate(click('VERSUS')); await page.waitForTimeout(2200);
await page.evaluate(click('BANNON')); await page.waitForTimeout(1300);
await page.evaluate(click('VIPER'));  await page.waitForTimeout(1500);
if (LOWQ) { await page.evaluate(click('8-BIT')); await page.waitForTimeout(900); console.log('   quality: 8-BIT (fastest, so the capture is closest to real time)'); }
await page.evaluate(click('FIGHT!')); await page.waitForTimeout(3000);
await page.evaluate(click('▶ CONFIRM STAGE')); await page.waitForTimeout(2000);

// wait for the arena
let ready = false;
for (let i = 0; i < 60; i++) {
  try {
    ready = await page.evaluate(() => {
      const sc = window.__BF_SCENE; if (!sc) return false;
      let n = 0; sc.traverse((o) => { if (o.isSkinnedMesh) n++; }); return n > 0;
    });
  } catch { ready = false; }
  if (ready) break;
  await page.waitForTimeout(2000);
}
const fps = await page.evaluate(() => new Promise((r) => {
  let n = 0; const t0 = performance.now();
  const f = () => (++n < 20 ? requestAnimationFrame(f) : r(1000 / ((performance.now() - t0) / n)));
  requestAnimationFrame(f);
}));
console.log(`   arena ${ready ? 'ready' : 'NOT ready'} -- live frame rate ${fps.toFixed(1)} fps`);

const HOLD = Math.max(60, Math.round((1000 / fps) * 2.2));
const press = async (k, ms = HOLD) => { await page.keyboard.down(k); await page.waitForTimeout(ms); await page.keyboard.up(k); };
const gap = Math.max(200, HOLD);

console.log(`   playing ${SECONDS}s (hold ${HOLD}ms)`);
const t0 = Date.now();
const beats = [
  async () => { await page.keyboard.down('d'); await page.waitForTimeout(500); await page.keyboard.up('d'); },
  async () => { await press('u'); },
  async () => { await press('u'); await page.waitForTimeout(gap); await press('i'); },
  async () => { await press('i'); },
  async () => { await press('k'); },
  async () => { await press('j'); },
  async () => { await page.keyboard.down('c'); await page.waitForTimeout(600); await page.keyboard.up('c'); },
];
let i = 0;
while ((Date.now() - t0) / 1000 < SECONDS) { await beats[i % beats.length](); await page.waitForTimeout(gap); i++; }
console.log(`   ${i} beats`);

await page.waitForTimeout(800);
const vpath = await page.video()?.path();
await context.close();   // finalises the video
await browser.close();
console.log(`   errors: ${errs.length}`);
console.log(`VIDEO: ${vpath}`);
fs.writeFileSync(`${OUT}/meta.json`, JSON.stringify({ fps, ready, beats: i, seconds: SECONDS }, null, 2));
