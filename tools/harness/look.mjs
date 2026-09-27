/**
 * LOOK AT IT.
 *
 * Every probe in this repo measures a number. None of them shows what the owner
 * sees. This drives a real fight and captures frames DURING the moments that
 * matter — the swing, the contact, the reaction — so they can be looked at
 * rather than inferred from bone angles.
 */
import { chromium } from 'playwright';
const SP = process.argv[2];
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const p = await b.newPage({ viewport:{width:412,height:915} });
const errs=[]; p.on('pageerror', e=>errs.push(e.message));
await p.goto('http://localhost:8080/', { waitUntil:'domcontentloaded', timeout:120000 });
await p.waitForTimeout(9000);
await p.mouse.click(206, 457); await p.waitForTimeout(4000);
await p.evaluate(()=>{const c=Array.from(document.querySelectorAll('*')).filter(e=>(e.textContent||'').trim()==='VERSUS'&&e.children.length<=1);c[c.length-1]?.dispatchEvent(new MouseEvent('click',{bubbles:true}));});
await p.waitForTimeout(7000);
const pick=async(n)=>{ await p.evaluate((n)=>{const t=Array.from(document.querySelectorAll('button')).find(b=>(b.textContent||'').trim()===n); t&&t.click();},n); await p.waitForTimeout(2500); };
await pick('BANNON'); await pick('VIPER'); await pick('FIGHT!');
await p.waitForTimeout(3500); await pick('TRAINING GRID'); await pick('▶ CONFIRM STAGE');
let live=false;
for(let i=0;i<40;i++){ await p.waitForTimeout(3000); live=await p.evaluate(()=>!!window.__controlsTest); if(live) break; }
console.log('MATCH LIVE:', live);
if(!live){ await p.screenshot({path:`${SP}/look_stuck.png`}); await b.close(); process.exit(1); }
await p.waitForTimeout(5000);

// PRESS THE REAL KEYS.
//
// window.__controlsTest.setKeys handles MOVEMENT ONLY — left/right/up/down and
// the two sidesteps. It has no attack buttons at all, so every probe in this
// session that "pressed J and K" was two men walking around. The game's own
// keyboard handler is the real input path: U=1(LP), I=2(RP), J=3(LK), K=4(RK),
// C=guard, V=grapple.
const tap = async (key, holdMs = 60) => {
  await p.keyboard.down(key);
  await p.waitForTimeout(holdMs);
  await p.keyboard.up(key);
};
await p.evaluate(()=>window.__controlsTest?.setKeys(['KeyD']));
await p.waitForTimeout(1200);
await p.evaluate(()=>window.__controlsTest?.setKeys([]));
await p.waitForTimeout(500);

let n = 0;
const shot = async (tag) => { await p.screenshot({ path:`${SP}/look_${String(n).padStart(2,'0')}_${tag}.png` }); n++; };
const state = () => p.evaluate(() => {
  const t = document.body.innerText;
  const m = t.match(/IDLE|Attacking|HitStun|Knockdown|Guard|Walking|Juggled|Crumple/g);
  return m ? m.slice(0, 2).join('/') : '?';
});

await shot('stance');
console.log('before LP:', await state());
await tap('KeyU', 70);
for (let i = 0; i < 7; i++) { await p.waitForTimeout(100); await shot('lp'); }
console.log('after  LP:', await state());

await p.waitForTimeout(500);
await tap('KeyK', 70);
for (let i = 0; i < 7; i++) { await p.waitForTimeout(110); await shot('rk'); }
console.log('after  RK:', await state());

await p.waitForTimeout(600);
await tap('KeyI', 70);
for (let i = 0; i < 6; i++) { await p.waitForTimeout(110); await shot('rp'); }
console.log('after  RP:', await state());

console.log('frames:', n, 'PAGEERRORS:', errs.length);
await b.close();
