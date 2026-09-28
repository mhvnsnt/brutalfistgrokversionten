/**
 * ONE PUNCH, HOW MANY HITS?
 *
 * Owner: "they are visible doing 1 punch, but somehow hitting me like 7 times
 * really fast and making my character float in place doing the hit reaction
 * rapid fire ... fighting games don't usually do that."
 *
 * Three hypotheses were measured and DISPROVED before this: the hitbox latch
 * works (one press = one hit at every frame rate), a held button fires exactly
 * one attack, and reactions are LoopOnce so they cannot replay themselves. So
 * the count has to be read from a real match instead of reasoned about.
 *
 * This stands still and lets the AI attack, then reads the arena's own hit log
 * (window.__BF_DEBUG.hits) and reports the SPACING between hits. Hits closer
 * together than a move's recovery are the machine gun he is describing.
 */
import { chromium } from 'playwright';

const URL = process.env.PLAYTEST_URL || 'http://localhost:8080/';
const SECONDS = Number((process.argv.find((a) => a.startsWith('--seconds=')) || '--seconds=40').split('=')[1]);

const click = (t) => `(()=>{const w=${JSON.stringify(t)};
 const ex=[...document.querySelectorAll('button,[role=button]')].filter(e=>(e.textContent||'').trim()===w);
 const lf=[...document.querySelectorAll('*')].filter(e=>e.children.length===0&&(e.textContent||'').trim()===w);
 const el=ex[0]||lf[0]; if(!el) return false; let n=el; for(let i=0;i<4&&n;i++){n.click?.();n=n.parentElement;} return true;})()`;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message || e)));

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(6000);
await page.mouse.click(206, 458); await page.waitForTimeout(2500);
await page.evaluate(click('VERSUS')); await page.waitForTimeout(2200);
await page.evaluate(click('BANNON')); await page.waitForTimeout(1300);
await page.evaluate(click('SWITCH')); await page.waitForTimeout(1000);
await page.evaluate(click('VIPER')); await page.waitForTimeout(1500);
// Same retry as playtest.mjs: tapping a roster tile moves the CURSOR, it does
// not fill the slot, and FIGHT! is only rendered once both sides are picked.
for (let i = 0; i < 8; i++) {
  const ok = await page.evaluate(() => [...document.querySelectorAll('button')].some((b) => /^FIGHT!?$/i.test((b.textContent || '').trim())));
  if (ok) break;
  await page.evaluate(click('SWITCH')); await page.waitForTimeout(800);
  await page.evaluate(click('VIPER')); await page.waitForTimeout(1200);
}
await page.evaluate(click('FIGHT!')); await page.waitForTimeout(3000);
if (!(await page.evaluate(click('CONFIRM STAGE')))) await page.evaluate(click('\u25b6 CONFIRM STAGE'));
await page.waitForTimeout(2500);
// Wait for the ARENA the way playtest.mjs does (proven), then look for the
// debug surface -- otherwise a failed menu walk reads as "no debug hook".
let rigs = 0;
for (let i = 0; i < 50; i++) {
  try { rigs = await page.evaluate(() => { const s = window.__BF_SCENE; if (!s) return 0; let n = 0; s.traverse((o) => { if (o.isSkinnedMesh) n++; }); return n; }); } catch {}
  if (rigs > 0) break;
  await page.waitForTimeout(2000);
}
const dbg = await page.evaluate(() => {
  const d = window.__BF_DEBUG;
  return { present: !!d, keys: d ? Object.keys(d).slice(0, 24) : [] };
});
const where = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 90));
console.log(`arena rigs: ${rigs}   __BF_DEBUG: ${dbg.present ? 'present' : 'ABSENT'}   screen: ${where}`);
if (dbg.present) console.log(`  keys: ${dbg.keys.join(', ')}`);
if (!rigs || !dbg.present) { console.log('run is void'); await browser.close(); process.exit(1); }

// STAND STILL. Walk into range once, then take it, exactly as he described.
await page.keyboard.down('d'); await page.waitForTimeout(900); await page.keyboard.up('d');
console.log(`standing still for ${SECONDS}s while the AI attacks\n`);
await page.waitForTimeout(SECONDS * 1000);

const R = await page.evaluate(() => {
  const hits = window.__BF_DEBUG.hits();
  const st = window.__BF_DEBUG.states ? window.__BF_DEBUG.states() : null;
  const tr = window.__BF_DEBUG.triggers ? window.__BF_DEBUG.triggers() : null;
  return { hits, st, tr };
});

const onPlayer = R.hits.filter((h) => h.target === 'p1');
console.log(`hits landed on the PLAYER: ${onPlayer.length}`);
if (R.tr) console.log(`p2 attackStarts: ${R.tr.p2?.attackStarts}   p1 attackStarts: ${R.tr.p1?.attackStarts}`);
if (R.tr && onPlayer.length) {
  const per = onPlayer.length / Math.max(1, R.tr.p2?.attackStarts || 1);
  console.log(`HITS PER AI ATTACK: ${per.toFixed(2)}   ${per > 1.3 ? '<-- ONE SWING IS LANDING MORE THAN ONCE' : '(one swing, one hit)'}`);
}
if (onPlayer.length > 1) {
  const gaps = [];
  for (let i = 1; i < onPlayer.length; i++) gaps.push(Math.round(onPlayer[i].t - onPlayer[i - 1].t));
  gaps.sort((a, b) => a - b);
  const p = (q) => gaps[Math.floor((gaps.length - 1) * q)];
  console.log(`\ngap between consecutive hits (ms): min ${gaps[0]}  p25 ${p(0.25)}  median ${p(0.5)}  max ${gaps[gaps.length - 1]}`);
  const machineGun = gaps.filter((g) => g < 120).length;
  console.log(`gaps under 120ms: ${machineGun}  ${machineGun ? '<-- RAPID FIRE' : '(none — spacing is human)'}`);
  console.log(`\nfirst 12 hits (t ms, by, dmg, via):`);
  for (const h of onPlayer.slice(0, 12)) console.log(`   ${String(Math.round(h.t)).padStart(7)}  ${h.by}  ${String(h.dmg).padStart(4)}  ${h.via}${h.blocked ? ' [blocked]' : ''}`);
}
if (R.st) console.log(`\nstates at the end: p1 ${R.st.p1?.action}/${R.st.p1?.motion} clip=${R.st.p1?.clip}   p2 ${R.st.p2?.action}/${R.st.p2?.motion}`);
console.log(`page errors: ${errs.length}`);
await browser.close();
