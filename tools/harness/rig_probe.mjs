/**
 * WHICH BODIES ARE ON SCREEN, AND IS EACH ONE ACTUALLY ANIMATING?
 *
 * Owner: animations and combat, nothing else. A scene walk during a live match
 * showed TWO skinned meshes for one fighter (BANNON_SEWN and BANNON_XFER_MESH)
 * both visible on every frame. Two overlapping bodies, or one body that does
 * not move under a second that does, reads exactly as broken animation.
 *
 * Per rig, per frame: is it visible, how many of its bones moved since the last
 * frame, and how far. A rig drawn every frame whose bones never move is a
 * statue standing inside the fighter.
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
for (let i = 0; i < 50; i++) { let ok=false;
  try { ok = await page.evaluate(() => { const s=window.__BF_SCENE; if(!s) return false; let n=0; s.traverse(o=>{if(o.isSkinnedMesh)n++;}); return n>0; }); } catch {}
  if (ok) break; await page.waitForTimeout(2000); }

await page.evaluate(() => {
  const S = (window.__RIG = { frames: 0, rigs: {} });
  const prev = new Map();
  const tick = () => {
    const sc = window.__BF_SCENE;
    S.frames++;
    if (sc) sc.traverse((o) => {
      if (!o.isSkinnedMesh || !o.skeleton) return;
      let vis = true, p = o; while (p) { if (!p.visible) { vis = false; break; } p = p.parent; }
      const key = o.name || o.uuid.slice(0, 8);
      const r = S.rigs[key] || (S.rigs[key] = { seen: 0, visible: 0, bones: o.skeleton.bones.length, movedFrames: 0, totalMoved: 0, maxMove: 0, verts: o.geometry?.attributes?.position?.count ?? 0, parent: o.parent?.name || '(no name)', root: null });
      r.seen++; if (vis) r.visible++;
      // where the body actually is, and whether its bones changed
      const bones = o.skeleton.bones;
      const cur = new Float64Array(bones.length * 3);
      for (let i = 0; i < bones.length; i++) { const m = bones[i].matrixWorld.elements; cur[i*3]=m[12]; cur[i*3+1]=m[13]; cur[i*3+2]=m[14]; }
      const last = prev.get(key);
      if (last) {
        let moved = 0, mx = 0;
        for (let i = 0; i < bones.length; i++) {
          const dx=cur[i*3]-last[i*3], dy=cur[i*3+1]-last[i*3+1], dz=cur[i*3+2]-last[i*3+2];
          const d=Math.sqrt(dx*dx+dy*dy+dz*dz);
          if (d > 0.002) moved++;
          if (d > mx) mx = d;
        }
        if (moved > 0) r.movedFrames++;
        r.totalMoved += moved; if (mx > r.maxMove) r.maxMove = mx;
      }
      prev.set(key, cur);
      const rm = bones[0]?.matrixWorld?.elements;
      if (rm) r.root = [ +rm[12].toFixed(2), +rm[13].toFixed(2), +rm[14].toFixed(2) ];
    });
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
const press = async (k, ms = 700) => { await page.keyboard.down(k); await page.waitForTimeout(ms); await page.keyboard.up(k); };
const t0 = Date.now(); let i = 0; const keys = ['u','i','j','k'];
while ((Date.now()-t0)/1000 < SECONDS) { await press(keys[i%keys.length]); await page.waitForTimeout(350); i++; }

const R = await page.evaluate(() => window.__RIG);
console.log(`\n${R.frames} frames watched\n`);
console.log(' visible  bones  verts   framesWithMotion  meanBonesMoving  maxStep  rootXYZ           name  (parent)');
for (const [k, r] of Object.entries(R.rigs)) {
  const motionPct = r.seen > 1 ? (100 * r.movedFrames / (r.seen - 1)).toFixed(0) : '0';
  const meanMoving = r.movedFrames ? (r.totalMoved / r.movedFrames).toFixed(1) : '0';
  console.log(` ${String(r.visible).padStart(3)}/${String(r.seen).padEnd(3)} ${String(r.bones).padStart(5)} ${String(r.verts).padStart(6)}   ${String(motionPct+'%').padStart(15)}  ${String(meanMoving).padStart(14)}  ${r.maxMove.toFixed(3).padStart(7)}  ${JSON.stringify(r.root).padEnd(18)} ${k}  (${r.parent})`);
}
await browser.close();
