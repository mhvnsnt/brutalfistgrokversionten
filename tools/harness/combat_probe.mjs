/**
 * COMBAT GLITCH PROBE — the instrument for what the owner can see and I cannot.
 *
 * Boots the real game in a real browser, walks the real menus, presses the REAL
 * buttons (window.__controlsTest.setKeys), and samples EVERY FRAME:
 *
 *   T-POSE     mean angle between each bone's live quaternion and its BIND
 *              quaternion. A body at bind is a T-pose. Measured per fighter, per
 *              frame, from the scene graph — not inferred from the state machine.
 *   FLOATING   the skinned root's world Y against the mat.
 *   FREEZE     frames where the skeleton does not move at all.
 *
 * Nothing here is inferred from a name or a state: it reads the transforms the
 * GPU is about to draw.
 */
import { chromium } from 'playwright';
const SP = process.argv[2] || '.';
const SECONDS = Number(process.argv[3] || 40);

const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const p = await b.newPage({ viewport:{width:412,height:915} });
const errs=[]; p.on('pageerror', e=>errs.push(e.message));
const warn=[]; p.on('console', m=>{ const t=m.text(); if(/BANNON_RETARGET|refused|binds |Cannot read|undefined is not/i.test(t)) warn.push(t.slice(0,180)); });

await p.goto('http://localhost:8080/', { waitUntil:'domcontentloaded', timeout:120000 });
await p.waitForTimeout(9000);
await p.mouse.click(206, 457); await p.waitForTimeout(4000);
await p.evaluate(()=>{ const c=Array.from(document.querySelectorAll('*')).filter(e=>(e.textContent||'').trim()==='VERSUS'&&e.children.length<=1); c[c.length-1]?.dispatchEvent(new MouseEvent('click',{bubbles:true})); });
await p.waitForTimeout(7000);

const pick = async (name) => {
  const ok = await p.evaluate((n)=>{ const t=Array.from(document.querySelectorAll('button')).find(b=>(b.textContent||'').trim()===n); if(!t) return false; t.click(); return true; }, name);
  console.log(`  pick ${name}: ${ok}`);
  await p.waitForTimeout(2500);
};
await pick('BANNON');
await pick('VIPER');
await pick('FIGHT!');
await p.waitForTimeout(3500);
await pick('TRAINING GRID');
await p.waitForTimeout(2000);
await pick('\u25b6 CONFIRM STAGE');

// Wait for the match to be live
let live=false;
for (let i=0;i<40;i++){
  await p.waitForTimeout(3000);
  live = await p.evaluate(()=>!!window.__controlsTest && !!window.__BF_SCENE);
  if (live) break;
}
console.log('MATCH LIVE:', live);
if (!live) { console.log('TEXT:', await p.evaluate(()=>document.body.innerText.replace(/\n+/g,' | ').slice(0,300))); await p.screenshot({path:`${SP}/probe_stuck.png`}); await b.close(); process.exit(1); }
await p.waitForTimeout(4000);

// Install the per-frame sampler INSIDE the page.
await p.evaluate(() => {
  const THREEQ = (a,b) => { // angle between two quaternions (radians)
    const d = Math.abs(a[0]*b[0]+a[1]*b[1]+a[2]*b[2]+a[3]*b[3]);
    return 2*Math.acos(Math.min(1, d));
  };
  const scene = window.__BF_SCENE;
  const rigs = [];
  scene.traverse(o => { if (o.isSkinnedMesh && o.skeleton && o.skeleton.bones.length > 8) rigs.push(o); });
  // BIND quaternion per bone, captured once, from the skeleton's own bind matrices.
  // THE BIND POSE, NOT THE POSE IT HAPPENED TO BE IN.
  // Reading bn.quaternion at install time records whatever frame the fighter was
  // on, so "deviation from bind" would measure deviation from a random pose and a
  // T-pose would score as normal. skeleton.pose() puts the bones back on the
  // inverse bind matrices, which IS the bind pose; the live pose is saved first
  // and restored immediately, inside one frame, so nothing is disturbed.
  for (const r of rigs) {
    const live = r.skeleton.bones.map(b => [b.quaternion.x,b.quaternion.y,b.quaternion.z,b.quaternion.w]);
    r.skeleton.pose();
    r.__bind = r.skeleton.bones.map(b => [b.quaternion.x,b.quaternion.y,b.quaternion.z,b.quaternion.w]);
    r.skeleton.bones.forEach((b,i) => b.quaternion.set(live[i][0],live[i][1],live[i][2],live[i][3]));
  }
  const S = { frames:0, rigs: rigs.length, samples: [], prev: new Map() };
  window.__probe = S;
  const tick = () => {
    S.frames++;
    const row = { f:S.frames, per: [] };
    for (let i=0;i<rigs.length;i++){
      const r = rigs[i];
      const bones = r.skeleton.bones;
      // deviation from the REST pose the rig booted with
      let sum=0, n=0, move=0;
      const key = 'r'+i;
      const prev = S.prev.get(key);
      const cur = [];
      for (let j=0;j<bones.length;j++){
        const q = bones[j].quaternion; const c=[q.x,q.y,q.z,q.w]; cur.push(c);
        sum += THREEQ(c, r.__bind[j]); n++;
        if (prev) move += THREEQ(c, prev[j]);
      }
      S.prev.set(key, cur);
      const wp = { y: 0 };
      try { const v = bones[0].getWorldPosition(new bones[0].position.constructor()); wp.y = v.y; } catch(e) {}
      const dev = n ? sum/n : 0;
      // On a frame where the whole skeleton is at bind, ask the mixer what it
      // thinks it is playing. That is the difference between "a clip is driving
      // the body to a pose that happens to look like bind" and "nothing is
      // driving the body at all".
      let anim = null;
      if (dev * 180 / Math.PI < 3) {
        try {
          const fns = Object.values(window.__BF_ANIM || {});
          anim = fns[i] ? fns[i]() : null;
        } catch (e) { anim = { err: String(e).slice(0, 80) }; }
      }
      row.per.push({ dev, move: prev? move/n : 0, y: wp.y, bones: n, anim });
    }
    S.samples.push(row);
    if (S.samples.length > 4000) S.samples.shift();
    S.raf = requestAnimationFrame(tick);
  };
  tick();
});

// PRESS THE REAL BUTTONS. A combat sequence, not idling.
const seq = [
  [[], 600], [['KeyD'], 900], [['KeyJ'], 500], [[], 300], [['KeyK'], 600], [[], 300],
  [['KeyA'], 700], [['KeyJ'], 400], [['KeyJ'], 400], [['KeyK'], 700], [[], 400],
  [['KeyS','KeyJ'], 500], [[], 300], [['KeyW'], 500], [['KeyK'], 600], [[], 500],
  [['KeyE'], 500], [['KeyJ'], 400], [['KeyQ'], 500], [['KeyK'], 800], [[], 800],
];
const t0 = Date.now();
while ((Date.now()-t0) < SECONDS*1000) {
  for (const [keys, ms] of seq) {
    await p.evaluate((k)=>window.__controlsTest?.setKeys(k), keys);
    await p.waitForTimeout(ms);
    if ((Date.now()-t0) >= SECONDS*1000) break;
  }
}
await p.evaluate(()=>window.__controlsTest?.setKeys([]));

const out = await p.evaluate(() => {
  const S = window.__probe;
  const R = [];
  for (let i=0;i<S.rigs;i++){
    const devs = S.samples.map(s=>s.per[i]?.dev ?? 0);
    const moves = S.samples.map(s=>s.per[i]?.move ?? 0);
    const ys = S.samples.map(s=>s.per[i]?.y ?? 0);
    const DEG = 180/Math.PI;
    const nearBind = devs.filter(d=>d*DEG < 3).length;
    const frozen = moves.filter(m=>m*DEG < 0.02).length;
    R.push({
      rig:i, frames:devs.length, bones:S.samples[0]?.per[i]?.bones ?? 0,
      devMeanDeg: +(devs.reduce((a,b)=>a+b,0)/devs.length*DEG).toFixed(2),
      devMinDeg: +(Math.min(...devs)*DEG).toFixed(2),
      nearBindFrames: nearBind, nearBindPct: +(100*nearBind/devs.length).toFixed(1),
      // WHERE the near-bind frames fall is the whole diagnosis: a run at the
      // start is the clip bank arriving late, scattered singles during combat
      // are a state that resolves to no clip.
      nearBindAt: devs.map((d,i)=>[i,d*DEG]).filter(([,d])=>d<3).map(([i])=>i).slice(0,40),
      devFirst10: devs.slice(0,10).map(d=>+(d*DEG).toFixed(2)),
      atBindMixer: S.samples.filter(s=>s.per[i]?.anim).slice(0,4).map(s=>s.per[i].anim),
      frozenFrames: frozen, frozenPct: +(100*frozen/moves.length).toFixed(1),
      yMin: +Math.min(...ys).toFixed(3), yMax: +Math.max(...ys).toFixed(3),
    });
  }
  return { frames:S.frames, rigs:S.rigs, rows:R };
});
console.log('--- PROBE ---');
console.log(JSON.stringify(out, null, 1));
console.log('PAGEERRORS:', errs.length, errs.slice(0,5).join(' | '));
console.log('WARNINGS:', warn.length, warn.slice(0,5).join(' | '));
await p.screenshot({ path:`${SP}/probe_fight.png` });
await b.close();
