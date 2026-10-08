#!/usr/bin/env node
/**
 * END-TO-END PROOF for the intro FMV against a BUILT bundle (not part of
 * `npm test` — needs a browser).
 *
 *   PUBLIC_BASE_PATH=/brutalfistgrokversionten/ ROCKET_PREVIEW=1 npm run build
 *   node scripts/intro-movie-e2e.mjs [distDir] [--chrome /usr/bin/google-chrome] [--out proof/intro-fmv] [--full]
 *
 * Serves dist under the Pages base path (with HTTP Range support, as Pages
 * has), then drives Chromium via playwright-core:
 *   A. ?intro=1: intro plays muted behind the gate, tap starts with sound,
 *      a seek to the black hold, `ended` hands off to the title screen
 *      (--full plays the whole 60s in real time instead of seeking)
 *   B. ?intro=1: SKIP button -> title screen
 *   C. ?intro=1: Esc -> title screen; Enter -> title screen
 *   D. ?intro=1 with play() refused (autoplay blocked): gate starts playback
 *   E. ?intro=1 with intro.json 404: straight to the title screen
 *   F. ?intro=1 with the video files 404: straight to the title screen
 *   G. no query under automation: straight to the title screen (as before)
 *   H. seen-once: after B, a normal (non-automation) launch skips the intro
 */
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const DIST = resolve(args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1]?.startsWith('--') !== true) ?? 'dist');
const OUT = resolve(opt('--out', 'proof/intro-fmv'));
const CHROME = opt('--chrome', ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((p) => existsSync(p)));
const FULL = args.includes('--full');
const BASE = '/brutalfistgrokversionten/';
mkdirSync(OUT, { recursive: true });

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.mp4': 'video/mp4', '.webm': 'video/webm', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.glb': 'model/gltf-binary', '.woff2': 'font/woff2' };

const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (!url.pathname.startsWith(BASE)) { res.writeHead(404).end(); return; }
  let p = join(DIST, decodeURIComponent(url.pathname.slice(BASE.length)));
  if (!existsSync(p) || statSync(p).isDirectory()) p = existsSync(join(p, 'index.html')) ? join(p, 'index.html') : join(DIST, 'index.html');
  const size = statSync(p).size;
  const type = TYPES[extname(p)] ?? 'application/octet-stream';
  const range = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
  if (range) {
    const start = range[1] ? +range[1] : 0;
    const end = range[2] ? Math.min(+range[2], size - 1) : size - 1;
    res.writeHead(206, { 'content-type': type, 'accept-ranges': 'bytes', 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': end - start + 1 });
    createReadStream(p, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { 'content-type': type, 'accept-ranges': 'bytes', 'content-length': size });
    createReadStream(p).pipe(res);
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const ORIGIN = `http://127.0.0.1:${server.address().port}`;
const APP = `${ORIGIN}${BASE}`;

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };

const INTRO = '[data-intro-phase]';
const TITLE = 'text=PRESS START';

async function newPage(ctx) {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
  return page;
}
async function videoState(page) {
  return page.evaluate(() => {
    const v = document.querySelector('[data-intro-phase] video');
    return v ? { t: v.currentTime, paused: v.paused, muted: v.muted, src: v.currentSrc.split('/').pop(), ended: v.ended } : null;
  });
}
async function waitTitle(page, timeout = 15000) {
  await page.waitForSelector(TITLE, { timeout });
  return (await page.locator(INTRO).count()) === 0;
}

try {
  // A. play -> gate -> sound -> ended -> title
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await newPage(ctx);
    await page.goto(`${APP}?intro=1`);
    await page.waitForSelector(INTRO);
    await page.waitForFunction(() => { const v = document.querySelector('[data-intro-phase] video'); return v && v.currentTime > 1; }, null, { timeout: 20000 });
    const s0 = await videoState(page);
    check('A1 intro autoplays muted', !!s0 && !s0.paused && s0.muted, JSON.stringify(s0));
    check('A2 gate visible', await page.locator('[data-intro-gate]').isVisible());
    check('A3 skip visible', await page.locator('[data-intro-skip]').isVisible());
    await page.screenshot({ path: join(OUT, '01_intro_muted_gate.png') });
    await page.locator('[data-intro-gate]').click();
    await page.waitForTimeout(1500);
    const s1 = await videoState(page);
    check('A4 gate tap restarts with sound', !!s1 && !s1.muted && !s1.paused && s1.t < 3, JSON.stringify(s1));
    check('A5 gate hidden after tap', (await page.locator('[data-intro-gate]').count()) === 0);
    await page.waitForTimeout(3500);
    await page.screenshot({ path: join(OUT, '02_intro_playing_sound.png') });
    if (FULL) {
      await page.waitForFunction(() => { const v = document.querySelector('[data-intro-phase] video'); return v && v.currentTime > 58.8; }, null, { timeout: 70000 });
    } else {
      await page.evaluate(() => { document.querySelector('[data-intro-phase] video').currentTime = 58.2; });
      await page.waitForFunction(() => { const v = document.querySelector('[data-intro-phase] video'); return v && v.currentTime > 58.8; }, null, { timeout: 10000 });
    }
    // Pixel check: the black hold really is black on screen.
    const shot = await page.screenshot({ path: join(OUT, '03_intro_black_hold.png') });
    const black = await page.evaluate(() => {
      const v = document.querySelector('[data-intro-phase] video');
      const c = document.createElement('canvas'); c.width = 64; c.height = 36;
      const g = c.getContext('2d'); g.drawImage(v, 0, 0, 64, 36);
      const d = g.getImageData(0, 0, 64, 36).data; let max = 0;
      for (let i = 0; i < d.length; i += 4) max = Math.max(max, d[i], d[i + 1], d[i + 2]);
      return max;
    });
    check('A6 frames after 1755 are black', black <= 24, `max channel ${black}, ${shot.length}B shot`);
    // Watch the handoff: record every DOM state until the title shows.
    const seq = await page.evaluate(() => new Promise((resolveSeq) => {
      const log = [];
      const t0 = performance.now();
      const tick = () => {
        const intro = document.querySelector('[data-intro-phase]');
        const title = [...document.querySelectorAll('.bf-prompt')].some((n) => n.textContent.includes('PRESS START'));
        const state = intro ? `intro:${intro.getAttribute('data-intro-phase')}` : title ? 'title' : `other:${document.body.innerText.slice(0, 40)}`;
        if (log[log.length - 1] !== state) log.push(state);
        if (state === 'title' || performance.now() - t0 > 8000) resolveSeq({ log, done: window.__bfIntro });
        else requestAnimationFrame(tick);
      };
      tick();
    }));
    check('A7 ended hands off straight to the title (intro -> title, nothing between)', seq.log[seq.log.length - 1] === 'title' && seq.log.every((s) => s.startsWith('intro:') || s === 'title') && seq.done?.done === 'ended', JSON.stringify(seq));
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(OUT, '04_title_after_ended.png') });
    check('A8 seen flag stored', (await page.evaluate(() => localStorage.getItem('bf.intro.seen'))) === '1');
    await ctx.close();
  }

  // B. Skip button
  {
    const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
    const page = await newPage(ctx);
    await page.goto(`${APP}?intro=1`);
    await page.waitForFunction(() => { const v = document.querySelector('[data-intro-phase] video'); return v && v.currentTime > 1; }, null, { timeout: 20000 });
    await page.screenshot({ path: join(OUT, '05_intro_portrait_mobile.png') });
    await page.locator('[data-intro-skip]').tap();
    check('B1 SKIP button -> title', await waitTitle(page));
    const mainMenu = await page.locator('text=ARCADE').count();
    check('B2 skip tap did not fall through into the main menu', mainMenu === 0, `ARCADE buttons: ${mainMenu}`);
    await page.screenshot({ path: join(OUT, '06_title_after_skip_button.png') });
    await ctx.close();
  }

  // C. Keyboard Esc / Enter
  for (const key of ['Escape', 'Enter']) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await newPage(ctx);
    await page.goto(`${APP}?intro=1`);
    await page.waitForFunction(() => { const v = document.querySelector('[data-intro-phase] video'); return v && v.currentTime > 0.5; }, null, { timeout: 20000 });
    await page.keyboard.press(key);
    const ok = await waitTitle(page);
    await page.waitForTimeout(500);
    const menu = await page.locator('text=ARCADE').count();
    check(`C ${key} skips to the title (and does not press START)`, ok && menu === 0, `menu=${menu}`);
    if (key === 'Escape') await page.screenshot({ path: join(OUT, '07_title_after_esc.png') });
    await ctx.close();
  }

  // D. Autoplay blocked: gate starts playback
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    await ctx.addInitScript(() => {
      const real = HTMLMediaElement.prototype.play;
      let gesture = false;
      addEventListener('pointerdown', () => { gesture = true; }, true);
      HTMLMediaElement.prototype.play = function () {
        if (!gesture) { this.pause(); return Promise.reject(new DOMException('blocked', 'NotAllowedError')); }
        return real.call(this);
      };
      // autoplay attribute would bypass play(); strip it the way a strict browser refuses it.
      const obs = new MutationObserver(() => document.querySelectorAll('video[autoplay]').forEach((v) => { v.autoplay = false; v.removeAttribute('autoplay'); if (!gesture) v.pause(); }));
      obs.observe(document, { subtree: true, childList: true });
    });
    const page = await newPage(ctx);
    await page.goto(`${APP}?intro=1`);
    await page.waitForSelector('[data-intro-phase="gate-blocked"]', { timeout: 20000 });
    await page.waitForTimeout(1000);
    const s0 = await videoState(page);
    check('D1 blocked autoplay shows TAP TO START, video paused', !!s0 && s0.paused && (await page.locator('text=TAP TO START').first().isVisible()), JSON.stringify(s0));
    await page.screenshot({ path: join(OUT, '08_autoplay_blocked_gate.png') });
    await page.locator('[data-intro-gate]').click();
    await page.waitForTimeout(2000);
    const s1 = await videoState(page);
    check('D2 gate tap starts playback with sound', !!s1 && !s1.paused && !s1.muted && s1.t > 0.5, JSON.stringify(s1));
    await ctx.close();
  }

  // E. No manifest
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    await ctx.route('**/intro/intro.json', (r) => r.fulfill({ status: 404, body: 'nope' }));
    const page = await newPage(ctx);
    const t0 = Date.now();
    await page.goto(`${APP}?intro=1`);
    const ok = await waitTitle(page);
    check('E manifest 404 -> title screen', ok, `${Date.now() - t0}ms`);
    await page.screenshot({ path: join(OUT, '09_title_no_manifest.png') });
    await ctx.close();
  }

  // F. Video files missing
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    await ctx.route(/\/intro\/intro\.(mp4|webm)/, (r) => r.fulfill({ status: 404, body: 'nope' }));
    const page = await newPage(ctx);
    const t0 = Date.now();
    await page.goto(`${APP}?intro=1`);
    const ok = await waitTitle(page, 20000);
    const reason = await page.evaluate(() => window.__bfIntro?.done);
    check('F video 404 -> title screen', ok && reason === 'error', `reason=${reason}, ${Date.now() - t0}ms`);
    await page.screenshot({ path: join(OUT, '10_title_video_missing.png') });
    await ctx.close();
  }

  // G. Automation default: unchanged
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    let introFetched = false;
    ctx.on('request', (r) => { if (r.url().includes('/intro/')) introFetched = true; });
    const page = await newPage(ctx);
    await page.goto(APP);
    const ok = await waitTitle(page);
    check('G no query under automation -> title screen, intro never requested', ok && !introFetched);
    await ctx.close();
  }

  // H. Seen once: pretend to be a real browser (webdriver=false)
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    await ctx.addInitScript(() => Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }));
    const page = await newPage(ctx);
    await page.goto(APP);
    await page.waitForSelector(INTRO, { timeout: 10000 });
    check('H1 first real launch plays the intro', true);
    await page.waitForFunction(() => { const v = document.querySelector('[data-intro-phase] video'); return v && v.currentTime > 0.5; }, null, { timeout: 20000 });
    await page.locator('[data-intro-skip]').click();
    await waitTitle(page);
    await page.goto(APP);
    const ok = await waitTitle(page);
    check('H2 second launch skips it (seen once)', ok);
    await page.goto(`${APP}?intro=1`);
    await page.waitForSelector(INTRO, { timeout: 10000 });
    check('H3 ?intro=1 forces it back on', true);
    await page.goto(`${APP}?intro=0`);
    check('H4 ?intro=0 forces it off', await waitTitle(page));
    await ctx.close();
  }
} catch (e) {
  check('harness', false, e.stack || String(e));
} finally {
  await browser.close();
  server.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed; screenshots in ${OUT}`);
process.exitCode = failed.length ? 1 : 0;
