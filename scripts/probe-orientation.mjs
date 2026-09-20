#!/usr/bin/env node
/**
 * DOES THE SCREEN FIT THE PHONE, WHICHEVER WAY UP IT IS?
 *
 * Owner: "they kind of need to sense my phone's orientation so they don't go
 * off my screen ... I'm not asking you to make it or to lock it into
 * horizontal or vertical." Two specific symptoms:
 *   MOVE LIBRARY  in horizontal the preview "is real small ... I gotta zoom
 *                 in and look real close"; and "to scroll down the move list
 *                 I have to turn my phone, but that makes the preview window
 *                 go away."
 *   TITLE SCREEN  "when I have it vertical ... the video is cropped."
 *
 * This drives a real phone-sized viewport both ways up and MEASURES it: the
 * preview canvas in CSS pixels, whether the clip list can scroll while the
 * preview stays put, and how much of the 16:9 title video is actually on
 * screen. A layout claim from reading Tailwind classes is not a measurement.
 *
 * Usage: npm run dev, then node scripts/probe-orientation.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.BF_BASE ?? 'http://127.0.0.1:8080';
const PORTRAIT = { width: 412, height: 915 };
const LANDSCAPE = { width: 915, height: 412 };

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});

const errs = [];
const out = {};

for (const [label, viewport] of [['portrait', PORTRAIT], ['landscape', LANDSCAPE]]) {
  const page = await browser.newPage({ viewport, isMobile: true, hasTouch: true });
  page.on('pageerror', (e) => errs.push(`${label}: ${String(e.message).slice(0, 120)}`));
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(7000);

  // ── TITLE SCREEN: how much of the video is on screen? ────────────────
  out[label] = out[label] ?? {};
  out[label].title = await page.evaluate(() => {
    const v = document.querySelector('video');
    if (!v) return null;
    const r = v.getBoundingClientRect();
    const fit = getComputedStyle(v).objectFit;
    const vw = v.videoWidth || 1280, vh = v.videoHeight || 720;
    // With object-fit, the share of the SOURCE frame that survives.
    const boxAR = r.width / Math.max(1, r.height);
    const srcAR = vw / vh;
    const shown = fit === 'contain'
      ? 1
      : (srcAR > boxAR ? boxAR / srcAR : srcAR / boxAR);
    return { fit, box: [Math.round(r.width), Math.round(r.height)], shown: +shown.toFixed(3) };
  });
  out[label].startVisible = await page.evaluate(() => {
    const el = [...document.querySelectorAll('span')].find((e) => /PRESS START/.test(e.textContent ?? ''));
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.top >= 0 && r.bottom <= window.innerHeight && r.left >= 0 && r.right <= window.innerWidth;
  });

  // ── MOVE LIBRARY ─────────────────────────────────────────────────────
  const click = (src) => page.evaluate((s) => {
    const rx = new RegExp(s, 'i');
    const el = [...document.querySelectorAll('button,[role=button],div,span')]
      .find((e) => rx.test((e.innerText || '').trim()) && e.offsetParent !== null && (e.innerText || '').length < 90);
    if (!el) return false;
    el.click();
    return true;
  }, src);

  await page.click('body');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3500);
  await click('MOVE LIBRARY'); await page.waitForTimeout(2500);
  await click('^BANNON$'); await page.waitForTimeout(2000);
  await click('ANIMATION POOL'); await page.waitForTimeout(1500);
  // WAIT FOR THE CLIPS, DO NOT ASSUME THEM. The first run of this measured a
  // list with ONE row in it and reported "does not scroll" — which was true
  // and meaningless: the baked index had not arrived yet, so it was timing
  // the fetch, not the layout.
  for (let i = 0; i < 40; i++) {
    const n = await page.evaluate(() => document.querySelector('[data-cliplist]')?.children.length ?? 0);
    if (n > 20) break;
    await page.waitForTimeout(500);
  }

  out[label].lib = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    if (!c) return { found: false };
    const r = c.getBoundingClientRect();
    // the clip list is the scroller holding the clip buttons
    // THE CLIP LIST BY NAME, not "the biggest scroller on the page".
    // The first version of this picked whichever element had the most
    // overflow and got the per-fighter COMMAND list instead — so it reported
    // 331px of healthy scrolling for a clip list that was 8 pixels tall.
    const list = document.querySelector('[data-cliplist]');
    return {
      found: true,
      canvas: [Math.round(r.width), Math.round(r.height)],
      canvasOnScreen: r.top >= -1 && r.bottom <= window.innerHeight + 1 && r.width > 40 && r.height > 40,
      listScrollable: Boolean(list) && list.scrollHeight > list.clientHeight + 20,
      listHeight: list ? Math.round(list.clientHeight) : 0,
      rows: list ? list.children.length : 0,
      listRoom: list ? Math.round(list.scrollHeight - list.clientHeight) : 0,
      pageScroll: document.documentElement.scrollHeight - window.innerHeight,
    };
  });

  // SCROLL THE LIST AND CHECK THE PREVIEW HAS NOT MOVED. This is the actual
  // complaint — not "does it fit" but "can I do both at once".
  out[label].afterScroll = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    const before = c ? c.getBoundingClientRect().top : null;
    const list = document.querySelector('[data-cliplist]');
    if (!list) return { scrolled: 0, canvasMoved: null, canvasStillOnScreen: false, noList: true };
    list.scrollTop = Math.min(600, list.scrollHeight - list.clientHeight);
    const after = c ? c.getBoundingClientRect().top : null;
    const r = c ? c.getBoundingClientRect() : null;
    return {
      scrolled: Math.round(list.scrollTop),
      canvasMoved: before === null || after === null ? null : Math.round(Math.abs(after - before)),
      canvasStillOnScreen: r ? (r.bottom > 0 && r.top < window.innerHeight && r.height > 40) : false,
    };
  });

  await page.screenshot({ path: `/tmp/claude-0/lib-${label}.png` });
  await page.close();
}

const pct = (v) => `${Math.round(v * 100)}%`;
console.log('\nORIENTATION — DOES IT FIT, EITHER WAY UP?\n');
for (const k of ['portrait', 'landscape']) {
  const o = out[k];
  console.log(`  ${k.toUpperCase()}`);
  console.log(`    title video   object-fit ${o.title?.fit}  box ${o.title?.box?.join('x')}  frame shown ${pct(o.title?.shown ?? 0)}`);
  console.log(`    PRESS START   ${o.startVisible ? 'on screen' : 'OFF SCREEN'}`);
  console.log(`    preview       ${o.lib?.canvas?.join('x')} px  ${o.lib?.canvasOnScreen ? 'fully on screen' : 'CUT OFF'}`);
  console.log(`    clip list     ${o.lib?.listHeight}px tall, ${o.lib?.rows} rows, ${o.lib?.listScrollable ? `scrolls (${o.lib.listRoom}px of travel)` : 'DOES NOT SCROLL'}`);
  console.log(`    scrolled it   ${o.afterScroll?.scrolled}px -> preview moved ${o.afterScroll?.canvasMoved}px, ${o.afterScroll?.canvasStillOnScreen ? 'still visible' : 'GONE'}`);
}
console.log(`\npage errors: ${errs.length}${errs.length ? ' — ' + errs.slice(0, 3).join(' | ') : ''}`);
await browser.close();
