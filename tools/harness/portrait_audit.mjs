/**
 * NOTHING THE PLAYER MUST TAP MAY SIT OFF THE EDGE OF A PORTRAIT PHONE.
 *
 * Owner: "I keep my phone vertical ... you see when it's in vertical, I can't
 * see or press or tap the fight button."
 *
 * He was right, and it was measured: on a 412px viewport the FIGHT! button laid
 * out at x=473 -- 61px past the right edge -- with document.scrollWidth equal to
 * innerWidth, so there was no scroll that could reach it. The match could not be
 * started by tapping at all.
 *
 * This walks the real screens at real phone widths and reports EVERY interactive
 * element whose box leaves the viewport, plus anything that fails a hit test
 * (covered by something else). --gate exits non-zero so it can block a push.
 */
import { chromium } from 'playwright';

const URL = process.env.PLAYTEST_URL || 'http://localhost:8080/';
const GATE = process.argv.includes('--gate');
const WIDTHS = [[360, 800], [390, 844], [412, 915]];

const click = (t) => `(()=>{for(const el of document.querySelectorAll('button,[role=button],div')){if((el.textContent||'').trim()===${JSON.stringify(t)}){el.click();return true;}}return false;})()`;

/** Every visible interactive box, and whether it is actually reachable. */
const AUDIT = `(() => {
  const out = [];
  const sel = 'button,[role=button],a[href],input,select,textarea';
  for (const el of document.querySelectorAll(sel)) {
    const r = el.getBoundingClientRect();
    if (r.width < 6 || r.height < 6) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity < 0.05) continue;
    if (el.disabled) continue;
    // An ancestor that scrolls horizontally makes an off-edge child reachable.
    let n = el.parentElement, scrollX = false, scrollY = false;
    while (n && n !== document.body) {
      const c = getComputedStyle(n);
      if (n.scrollWidth  > n.clientWidth  + 2 && /auto|scroll/.test(c.overflowX)) scrollX = true;
      if (n.scrollHeight > n.clientHeight + 2 && /auto|scroll/.test(c.overflowY)) scrollY = true;
      n = n.parentElement;
    }
    const offX = r.right > innerWidth + 1 || r.x < -1;
    const offY = r.bottom > innerHeight + 1 || r.y < -1;
    const pageScrollsY = document.documentElement.scrollHeight > innerHeight + 2;
    const pageScrollsX = document.documentElement.scrollWidth > innerWidth + 2;
    if (!offX && !offY) continue;
    out.push({
      t: (el.textContent || el.value || el.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim().slice(0, 34),
      x: Math.round(r.x), right: Math.round(r.right), y: Math.round(r.y), bottom: Math.round(r.bottom),
      offX, offY, scrollX, scrollY, pageScrollsX, pageScrollsY,
      // unreachable = off the edge with no scroll on the MATCHING axis that reaches it
      unreachable: (offX && !scrollX && !pageScrollsX) || (offY && !scrollY && !pageScrollsY),
    });
  }
  return out;
})()`;

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});

let bad = 0;
console.log('PORTRAIT AUDIT — can a thumb reach everything?\n');

for (const [w, h] of WIDTHS) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(5000);

  const screens = [
    ['title', async () => { await page.mouse.click(Math.round(w / 2), Math.round(h / 2)); }],
    ['mode menu', async () => {}],
    ['player select', async () => { await page.evaluate(click('VERSUS')); }],
    ['both picked', async () => { await page.evaluate(click('BANNON')); await page.waitForTimeout(900); await page.evaluate(click('VIPER')); }],
    ['stage select', async () => { await page.evaluate(click('FIGHT!')); }],
  ];

  for (const [name, go] of screens) {
    await go();
    await page.waitForTimeout(1800);
    const found = await page.evaluate(AUDIT);
    const hard = found.filter((f) => f.unreachable);
    const soft = found.filter((f) => !f.unreachable);
    const tag = hard.length ? 'UNREACHABLE' : (soft.length ? 'off-edge but scrollable' : 'ok');
    console.log(`${w}x${h}  ${name.padEnd(14)} ${String(hard.length).padStart(2)} unreachable, ${String(soft.length).padStart(2)} scrollable   ${tag}`);
    for (const f of hard.slice(0, 8)) {
      console.log(`      !! "${f.t}"  x${f.x}..${f.right} y${f.y}..${f.bottom}  ${f.offX ? 'OFF-X' : ''}${f.offY ? 'OFF-Y' : ''}`);
      bad++;
    }
  }
  await page.close();
}

console.log(`\n${bad === 0 ? 'PASS — every control is reachable in portrait.' : `FAIL — ${bad} unreachable control(s).`}`);
await browser.close();
if (GATE && bad > 0) process.exit(1);
