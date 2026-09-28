/**
 * WHAT IS THAT THING ON THE SCREEN, AND HOW LONG HAS IT BEEN THERE?
 *
 * Watching a recording of the fight showed a green burst at head height that
 * stayed for over five seconds. Five seconds is not a hit spark. Rather than
 * guess which system owns it, this walks the live scene every frame, and
 * reports every visible object together with HOW MANY CONSECUTIVE FRAMES it
 * has been visible -- so a thing that should flash and a thing that is stuck
 * are told apart by measurement.
 */
import { chromium } from 'playwright';

const URL = process.env.PLAYTEST_URL || 'http://localhost:8080/';
const SECONDS = Number((process.argv.find((a) => a.startsWith('--seconds=')) || '--seconds=25').split('=')[1]);

const click = (t) => `(()=>{const want=${JSON.stringify(t)};
  const ex=[...document.querySelectorAll('button,[role=button]')].filter(e=>(e.textContent||'').trim()===want);
  const lf=[...document.querySelectorAll('*')].filter(e=>e.children.length===0&&(e.textContent||'').trim()===want);
  const el=ex[0]||lf[0]; if(!el) return false;
  let n=el; for(let i=0;i<4&&n;i++){n.click?.();n=n.parentElement;} return true;})()`;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(5000);
await page.mouse.click(206, 458); await page.waitForTimeout(2400);
await page.evaluate(click('VERSUS')); await page.waitForTimeout(2200);
await page.evaluate(click('BANNON')); await page.waitForTimeout(1300);
await page.evaluate(click('VIPER'));  await page.waitForTimeout(1400);
await page.evaluate(click('FIGHT!')); await page.waitForTimeout(3000);
await page.evaluate(click('▶ CONFIRM STAGE')); await page.waitForTimeout(2000);
for (let i = 0; i < 50; i++) {
  let ok = false;
  try { ok = await page.evaluate(() => { const s = window.__BF_SCENE; if (!s) return false; let n = 0; s.traverse((o) => { if (o.isSkinnedMesh) n++; }); return n > 0; }); } catch {}
  if (ok) break;
  await page.waitForTimeout(2000);
}
console.log('arena up; watching the scene');

await page.evaluate(() => {
  const S = (window.__WOS = { run: {}, peak: {}, frames: 0 });
  const tick = () => {
    const sc = window.__BF_SCENE;
    S.frames++;
    if (sc) {
      const seen = new Set();
      sc.traverse((o) => {
        if (!o.visible) return;
        if (!(o.isMesh || o.isSprite || o.isPoints || o.isLight)) return;
        // only things that are actually shown: skip zero-scale hides
        const sx = Math.abs(o.scale?.x ?? 1);
        if (sx < 1e-4) return;
        let p = o, vis = true;
        while (p) { if (!p.visible) { vis = false; break; } p = p.parent; }
        if (!vis) return;
        const key = `${o.type}:${o.name || '(unnamed)'}`;
        seen.add(key);
        S.run[key] = (S.run[key] || 0) + 1;
        if (!S.peak[key] || S.run[key] > S.peak[key]) S.peak[key] = S.run[key];
      });
      for (const k of Object.keys(S.run)) if (!seen.has(k)) S.run[k] = 0;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});

const press = async (k, ms = 700) => { await page.keyboard.down(k); await page.waitForTimeout(ms); await page.keyboard.up(k); };
const t0 = Date.now(); let i = 0;
const keys = ['u', 'i', 'j', 'k'];
while ((Date.now() - t0) / 1000 < SECONDS) { await press(keys[i % keys.length]); await page.waitForTimeout(400); i++; }

const R = await page.evaluate(() => {
  const S = window.__WOS;
  const rows = Object.entries(S.peak).map(([k, peak]) => ({ k, peak, now: S.run[k] || 0 }));
  rows.sort((a, b) => b.peak - a.peak);
  return { frames: S.frames, rows };
});
const secPerFrame = SECONDS / Math.max(1, R.frames);
console.log(`\n${R.frames} frames watched (~${(1 / secPerFrame).toFixed(1)} fps)`);
console.log('longest UNBROKEN visible run, per object:\n');
console.log('  frames   seconds   still up?   object');
for (const r of R.rows.slice(0, 26)) {
  console.log(`  ${String(r.peak).padStart(6)}   ${(r.peak * secPerFrame).toFixed(1).padStart(7)}   ${r.now > 0 ? 'YES' : '   '}         ${r.k}`);
}
await browser.close();
