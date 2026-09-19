#!/usr/bin/env node
/**
 * RENDER THE POSE SHEET AND LOOK AT IT.
 *
 * Numbers alone cannot tell you a stance reads as a stance. This drives the
 * real pipeline in a real browser and writes one PNG contact sheet.
 *
 * Usage:
 *   npm run dev           # or any server for this repo on :8080
 *   node scripts/render-pose-sheet.mjs out.png "idle,block,GRAFQUICKJAB" [model.glb]
 */
import { chromium } from 'playwright';

const OUT = process.argv[2] ?? 'posesheet.png';
const CLIPS = process.argv[3] ?? 'idle,block,attack_1';
const MODEL = process.argv[4] ?? 'BANNON_rigged.glb';
const TIMES = process.argv[5] ?? '0,0.25';
const VIEWS = process.argv[6] ?? '0,90';
const BASE = process.env.BF_BASE ?? 'http://127.0.0.1:8080';

const browser = await chromium.launch({
  executablePath: process.env.BF_CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--no-sandbox', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

// The app's router owns every path, so a standalone .html is 404'd. Load any
// real page for its module graph, then replace the document with the sheet's
// own root and entry module — Vite still transforms /tools/posesheet/main.ts.
const url = `${BASE}/?model=${MODEL}&clips=${encodeURIComponent(CLIPS)}&t=${TIMES}&views=${VIEWS}`;
console.log('→', url);
await page.goto(url, { waitUntil: 'domcontentloaded' });
// Let the app hydrate FIRST — React replaces document.body on hydration and
// would delete the sheet's root out from under it.
await page.waitForLoadState('networkidle').catch(() => {});
await page.waitForTimeout(2500);
await page.evaluate(() => {
  document.body.innerHTML = '<div id="app"></div>';
  document.body.style.cssText = 'margin:0;background:#12151b;color:#cfd6e4;font:12px monospace';
  const s = document.createElement('script');
  s.type = 'module';
  s.src = '/tools/posesheet/main.ts';
  document.body.appendChild(s);
});
await page.waitForFunction('window.__POSESHEET_READY === true', null, { timeout: 180000 });
await page.waitForTimeout(500);
await page.locator('#app').screenshot({ path: OUT });
console.log(`✅ ${OUT}`);
if (errors.length) console.log('page errors:\n  ' + errors.slice(0, 12).join('\n  '));
await browser.close();
