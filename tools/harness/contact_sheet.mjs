/**
 * A CONTACT SHEET OF THE FIGHT, so motion can be looked at as motion.
 *
 * Playwright's bundled ffmpeg is a minimal build with no `fps` or `tile`
 * filter, so the sheet is laid out in the browser that is already here and
 * screenshotted. Frames are extracted one seek at a time, which that build
 * does support.
 *
 * node tools/harness/contact_sheet.mjs <video.webm> <startSec> <count> <stepSec>
 */
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const FF = '/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux';
const [video, startS = '80', countS = '24', stepS = '0.4'] = process.argv.slice(2);
const start = Number(startS), count = Number(countS), step = Number(stepS);
if (!video || !fs.existsSync(video)) { console.error('usage: contact_sheet.mjs <video.webm> [start] [count] [step]'); process.exit(1); }

const dir = path.join(path.dirname(video), 'frames');
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });

const shots = [];
for (let i = 0; i < count; i++) {
  const t = +(start + i * step).toFixed(2);
  const out = path.join(dir, `f${String(i).padStart(3, '0')}.png`);
  try {
    execFileSync(FF, ['-hide_banner', '-loglevel', 'error', '-ss', String(t), '-i', video, '-frames:v', '1', '-y', out], { stdio: 'pipe' });
    if (fs.existsSync(out)) shots.push({ t, b64: fs.readFileSync(out).toString('base64') });
  } catch { /* past the end */ }
}
console.log(`extracted ${shots.length} frames from ${start}s, step ${step}s`);

const cols = Math.min(6, Math.ceil(Math.sqrt(shots.length)));
const html = `<!doctype html><meta charset=utf-8><style>
  body{margin:0;background:#111;font:11px/1.2 monospace;color:#9f9}
  .g{display:grid;grid-template-columns:repeat(${cols},1fr);gap:2px}
  .c{position:relative}.c img{width:100%;display:block}
  .t{position:absolute;left:2px;top:2px;background:#000a;padding:1px 3px;color:#6f6}
</style><div class=g>${shots.map((s, i) => `<div class=c><img src="data:image/png;base64,${s.b64}"><div class=t>${i} · ${s.t}s</div></div>`).join('')}</div>`;

const file = path.join(path.dirname(video), 'sheet.html');
fs.writeFileSync(file, html);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
await page.goto('file://' + file);
await page.waitForTimeout(1200);
const outPng = path.join(path.dirname(video), 'sheet.png');
await page.screenshot({ path: outPng, fullPage: true });
await browser.close();
console.log('SHEET: ' + outPng);
