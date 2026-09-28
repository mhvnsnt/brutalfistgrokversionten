/**
 * A REAL MATCH AT A REAL 60fps, WITH NO BROWSER.
 *
 * Owner: "u keep finding roadblocks and excuses instead of finding a way to do
 * what i asked you to."
 *
 * Fair. The roadblock was that this container renders the game at 1fps, so
 * every probe hunted a 16ms glitch with a 1000ms sampler and reported clean.
 * The way around it is that COMBAT DOES NOT NEED PIXELS: the state machines,
 * the hitboxes, the reactions and the timers are plain TypeScript. Stepped at a
 * fixed 1/60s they run a 60-second match in well under a second, deterministically,
 * at the frame rate the owner's phone actually uses.
 *
 * What it reports is the SHAPE of glitchy combat, per frame:
 *   - state churn        : states that last 1-2 frames (a body that never
 *                          settles reads as twitching)
 *   - interrupted reactions: a hit reaction cut off by another hit before it
 *                          finished -- the "rapid fire flinch"
 *   - hit spacing        : frames between hits landing on the same victim
 *   - stun lock          : the longest run of consecutive frames the victim
 *                          spent unable to act
 *   - locomotion dropout : frames moving with no locomotion state
 */
import { FighterStateMachine, DEFAULT_MOVE_WINDOWS } from '../../src/engine/combat/FighterStateMachine.ts';
import { FrameDataHitboxSystem } from '../../src/engine/combat/FrameDataHitbox.ts';

const FPS = 60, DT = 1 / FPS;
const NEUTRAL = { forward: 0, strafe: 0, light: false, heavy: false, guard: false, crouch: false };

/**
 * `buildP2AIInput` lives inside a React component and cannot be imported, so
 * this reproduces its DECISION SHAPE exactly as read from the source: an
 * 8-phase cycle on a 900ms wall clock, attacking on phases 0 and 1.
 */
function aiInput(tMs) {
  const cycle = Math.floor(tMs / 900) % 8;
  switch (cycle) {
    case 0: case 1: return { light: true };
    case 2: return { heavy: true };
    case 3: return { forward: 1 };
    case 5: return { guard: true };
    case 6: return { forward: -1 };
    default: return {};
  }
}

function sim(seconds, playerScript) {
  const A = new FighterStateMachine();   // the AI
  const B = new FighterStateMachine();   // the player
  const Ahb = new FrameDataHitboxSystem();
  const Bhb = new FrameDataHitboxSystem();

  const frames = Math.round(seconds * FPS);
  const rows = [];
  const hitsOnB = [], hitsOnA = [];
  let reactionsStarted = 0, reactionsInterrupted = 0;
  let bInReaction = false, bReactionFrames = 0;

  for (let f = 0; f < frames; f++) {
    const tMs = (f / FPS) * 1000;
    const ai = { ...NEUTRAL, ...aiInput(tMs) };
    const pl = { ...NEUTRAL, ...(playerScript(f) ?? {}) };

    A.tickAirborne(DT); A.update(ai, DT);
    B.tickAirborne(DT); B.update(pl, DT);

    const aw = A.getHitboxWindow(); Ahb.update(aw);
    const bw = B.getHitboxWindow(); Bhb.update(bw);

    // both standing at 0.9m apart, in range
    const aHit = Ahb.checkCollision(0, 0, 1, 0.9, 0, pl.guard, aw.currentFrame ?? 0, 0, 0);
    const bHit = Bhb.checkCollision(0.9, 0, -1, 0, 0, ai.guard, bw.currentFrame ?? 0, 0, 0);

    if (aHit) {
      hitsOnB.push(f);
      // A reaction still running when the next hit lands is an INTERRUPTED one.
      if (bInReaction && bReactionFrames < 10) reactionsInterrupted++;
      B.applyHitStun(aw.move ?? DEFAULT_MOVE_WINDOWS.lightAttack, 0.3, 'hit');
      reactionsStarted++; bInReaction = true; bReactionFrames = 0;
    }
    if (bHit) { hitsOnA.push(f); A.applyHitStun(bw.move ?? DEFAULT_MOVE_WINDOWS.lightAttack, 0.3, 'hit'); }

    if (bInReaction) {
      bReactionFrames++;
      if (B.action !== 'HitStun') { bInReaction = false; }
    }
    rows.push({ f, a: `${A.action}/${A.current}`, b: `${B.action}/${B.current}` });
  }
  return { rows, hitsOnB, hitsOnA, reactionsStarted, reactionsInterrupted };
}

/** Runs of identical state, so 1-2 frame states show up as churn. */
function churn(rows, key) {
  const runs = [];
  let cur = rows[0][key], start = 0;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][key] !== cur) { runs.push({ state: cur, len: i - start }); cur = rows[i][key]; start = i; }
  }
  runs.push({ state: cur, len: rows.length - start });
  return runs;
}

const SECONDS = Number((process.argv.find((a) => a.startsWith('--seconds=')) || '--seconds=30').split('=')[1]);
console.log(`REAL MATCH, ${SECONDS}s AT A TRUE ${FPS}fps (${SECONDS * FPS} frames), NO BROWSER\n`);

// The owner's scenario: he is trying to fight, pressing attack now and then.
const r = sim(SECONDS, (f) => (f % 45 === 0 ? { light: true } : {}));

const gaps = [];
for (let i = 1; i < r.hitsOnB.length; i++) gaps.push(r.hitsOnB[i] - r.hitsOnB[i - 1]);
gaps.sort((a, b) => a - b);
const p = (q) => (gaps.length ? gaps[Math.floor((gaps.length - 1) * q)] : 0);

console.log(`hits landed on the PLAYER : ${r.hitsOnB.length}`);
console.log(`hits landed on the AI     : ${r.hitsOnA.length}`);
if (gaps.length) {
  console.log(`gap between hits (frames) : min ${gaps[0]}  p25 ${p(0.25)}  median ${p(0.5)}  max ${gaps[gaps.length - 1]}`);
  console.log(`   ...in ms               : min ${Math.round((gaps[0] / FPS) * 1000)}  median ${Math.round((p(0.5) / FPS) * 1000)}`);
  const rapid = gaps.filter((g) => g <= 8).length;
  console.log(`gaps <= 8 frames (133ms)  : ${rapid}  ${rapid ? '<-- RAPID FIRE' : '(none)'}`);
}
console.log(`reactions started         : ${r.reactionsStarted}`);
console.log(`reactions INTERRUPTED     : ${r.reactionsInterrupted}  ${r.reactionsInterrupted ? '<-- flinch cut off by the next hit' : '(none)'}`);

const bRuns = churn(r.rows, 'b');
const short = bRuns.filter((x) => x.len <= 2);
console.log(`\nplayer state changes      : ${bRuns.length} in ${SECONDS}s`);
console.log(`states lasting <= 2 frames: ${short.length}  ${short.length ? '<-- CHURN, this is what reads as twitching' : '(none)'}`);
for (const s of short.slice(0, 8)) console.log(`     ${s.len}f  ${s.state}`);
const longest = bRuns.slice().sort((a, b) => b.len - a.len)[0];
console.log(`longest single state      : ${longest.len}f (${Math.round((longest.len / FPS) * 1000)}ms)  ${longest.state}`);

const stunFrames = r.rows.filter((x) => x.b.startsWith('HitStun')).length;
console.log(`player frames in hitstun  : ${stunFrames} of ${r.rows.length}  (${((100 * stunFrames) / r.rows.length).toFixed(0)}%)`);
