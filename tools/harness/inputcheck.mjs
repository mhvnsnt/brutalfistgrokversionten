/**
 * DOES PRESSING A BUTTON MAKE THE BODY DO ANYTHING?
 *
 * The HUD label is not the answer — it is React state and a 10-frame jab can be
 * over before it re-renders. The answer is which CLIP the mixer is playing,
 * which FighterMesh publishes through __BF_ANIM.
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
for(let i=0;i<40;i++){ await p.waitForTimeout(3000); live=await p.evaluate(()=>!!window.__BF_ANIM); if(live) break; }
console.log('ANIM HOOK LIVE:', live);
if(!live){ await b.close(); process.exit(1); }
await p.waitForTimeout(4000);

// Record every clip P1 plays, sampled fast, while we press each attack.
await p.evaluate(() => {
  const w = window;
  w.__seen = [];
  const key = Object.keys(w.__BF_ANIM)[0];
  w.__tick = setInterval(() => {
    try {
      const s = w.__BF_ANIM[key]();
      const last = w.__seen[w.__seen.length - 1];
      if (!last || last.clip !== s.active) w.__seen.push({ clip: s.active, t: Date.now() });
    } catch (e) { /* ignore */ }
  }, 40);
});
const press = async (k, label) => {
  await p.evaluate((l)=>{ window.__seen.push({ clip:'--- pressed '+l+' ---', t:Date.now() }); }, label);
  await p.keyboard.down(k); await p.waitForTimeout(80); await p.keyboard.up(k);
  await p.waitForTimeout(900);
};
await press('KeyU','U = 1 LP');
await press('KeyI','I = 2 RP');
await press('KeyJ','J = 3 LK');
await press('KeyK','K = 4 RK');
await press('KeyZ','Z = legacy light');
await press('KeyC','C = guard');
const seen = await p.evaluate(()=>{ clearInterval(window.__tick); return window.__seen; });
console.log('\nCLIP TIMELINE (only changes are logged):');
for (const s of seen) console.log('   ' + s.clip);
console.log('\nPAGEERRORS:', errs.length);
await b.close();
