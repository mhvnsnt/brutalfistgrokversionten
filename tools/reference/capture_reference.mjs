#!/usr/bin/env node
/**
 * CAPTURE A REFERENCE FIGHTER, SO OURS IS COMPARED AGAINST A REAL ONE.
 *
 * Owner: "do a side-by-side audit playthrough of a working fighting game versus
 * ours" ... "I didn't download the Tekken rom for nothing."
 *
 * Boots the owner's own disc image in PCSX-Reloaded on a virtual display and
 * captures frames at a stated interval, then lays them out as a contact sheet.
 * See README.md in this directory for what is measured (timing) and what is
 * never taken (assets).
 *
 *   node tools/reference/capture_reference.mjs --cue="<path>.cue" --frames=12 --every=0.5
 *
 * Defaults assume the disc is at ~/scratch/rom, OUTSIDE the repository.
 */
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).split('=').slice(1).join('=');
const CUE = arg('cue', `${process.env.HOME}/scratch/rom/Tekken 3 (USA).cue`);
const FRAMES = Number(arg('frames', 12));
const EVERY = Number(arg('every', 0.5));
const BOOT = Number(arg('boot', 40));
const DISPLAY = arg('display', ':77');
const OUT = arg('out', '/tmp/reference');

if (!fs.existsSync(CUE)) {
  console.error(`no disc image at ${CUE}`);
  console.error('The ROM is the owner\'s own copy and is deliberately NOT in the repo. Pass --cue=<path>.');
  process.exit(2);
}
fs.mkdirSync(OUT, { recursive: true });

/** pcsxr -nogui REFUSES to start without a config, so make sure one exists. */
const cfg = `${process.env.HOME}/.pcsxr/pcsxr.cfg`;
if (!fs.existsSync(cfg)) {
  console.log('no pcsxr config — generating one by launching the GUI once under Xvfb');
  try { execFileSync('xvfb-run', ['-a', '/usr/games/pcsxr'], { timeout: 25000, stdio: 'ignore' }); } catch { /* the timeout IS the plan */ }
}
if (fs.existsSync(cfg) && !/Bios\s*=\s*HLE/.test(fs.readFileSync(cfg, 'utf8'))) {
  console.warn('WARNING: pcsxr is not set to the HLE BIOS. A real Sony BIOS is not ours to supply.');
}

const sh = (cmd, args, opts = {}) => spawn(cmd, args, { detached: true, stdio: 'ignore', ...opts }).unref();
sh('Xvfb', [DISPLAY, '-screen', '0', '640x480x24']);
await new Promise((r) => setTimeout(r, 2500));
sh('/usr/games/pcsxr', ['-nogui', '-cdfile', CUE], { env: { ...process.env, DISPLAY } });

console.log(`booting ${path.basename(CUE)} — ${BOOT}s`);
await new Promise((r) => setTimeout(r, BOOT * 1000));

const shots = [];
for (let i = 0; i < FRAMES; i++) {
  const p = path.join(OUT, `f${String(i).padStart(3, '0')}.png`);
  try {
    execFileSync('import', ['-window', 'root', p], { env: { ...process.env, DISPLAY }, timeout: 15000 });
    shots.push({ p, t: +(i * EVERY).toFixed(2) });
  } catch (e) { console.error(`capture ${i} failed: ${String(e).slice(0, 80)}`); }
  await new Promise((r) => setTimeout(r, EVERY * 1000));
}
console.log(`captured ${shots.length} frames into ${OUT}`);

// Contact sheet, composed in the browser that is already here (Playwright's
// bundled ffmpeg has no tile filter — see tools/harness/contact_sheet.mjs).
if (shots.length) {
  const { chromium } = await import('playwright');
  const cols = Math.min(4, Math.ceil(Math.sqrt(shots.length)));
  const html = `<!doctype html><meta charset=utf-8><style>body{margin:0;background:#111;font:12px monospace;color:#6f6}
.g{display:grid;grid-template-columns:repeat(${cols},1fr);gap:3px}.c{position:relative}.c img{width:100%;display:block}
.t{position:absolute;left:3px;top:3px;background:#000b;padding:2px 5px}</style><div class=g>${
    shots.map((s) => `<div class=c><img src="data:image/png;base64,${fs.readFileSync(s.p).toString('base64')}"><div class=t>t+${s.t}s</div></div>`).join('')}</div>`;
  const hp = path.join(OUT, 'sheet.html');
  fs.writeFileSync(hp, html);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const pg = await b.newPage({ viewport: { width: 1400, height: 900 } });
  await pg.goto('file://' + hp);
  await pg.waitForTimeout(900);
  await pg.screenshot({ path: path.join(OUT, 'sheet.png'), fullPage: true });
  await b.close();
  console.log(`SHEET: ${path.join(OUT, 'sheet.png')}`);
}
