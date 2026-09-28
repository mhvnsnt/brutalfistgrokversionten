/**
 * HOW MANY TIMES DOES ONE PUNCH HIT?
 *
 * Owner: "they are visible doing 1 punch, but somehow hitting me like 7 times
 * really fast and making my character float in place doing the hit reaction
 * rapid fire ... fighting games don't usually do that."
 *
 * He is right that they do not. One swing lands once. This drives the REAL
 * FighterStateMachine and the REAL FrameDataHitboxSystem at a fixed step and
 * counts registered hits per attack, at 60fps and at the low frame rates a
 * phone actually hits -- because the latch that prevents a double hit is reset
 * whenever the active window closes, and a large dt changes when that happens.
 */
import { FighterStateMachine, DEFAULT_MOVE_WINDOWS } from '../../src/engine/combat/FighterStateMachine.ts';
import { FrameDataHitboxSystem } from '../../src/engine/combat/FrameDataHitbox.ts';

const NEUTRAL = { forward: 0, strafe: 0, light: false, heavy: false, guard: false, crouch: false };

/** One attack, held in range, counting how many hits it registers. */
function swing(fps, moveKey, frames = 90) {
  const dt = 1 / fps;
  const fsm = new FighterStateMachine();
  const hb = new FrameDataHitboxSystem();
  let hits = 0;
  const hitFrames = [];
  for (let f = 0; f < frames; f++) {
    // press on the first frame only: ONE attack
    const input = { ...NEUTRAL, light: f === 0 && moveKey === 'light', heavy: f === 0 && moveKey === 'heavy' };
    fsm.tickAirborne(dt);
    fsm.update(input, dt);
    const w = fsm.getHitboxWindow();
    hb.update(w);
    // attacker at 0, opponent at 0.9m — inside any normal hitbox
    const hit = hb.checkCollision(0, 0, 1, 0.9, 0, false, w.currentFrame ?? 0, 0, 0);
    if (hit) { hits++; hitFrames.push(f); }
  }
  return { hits, hitFrames };
}

console.log('HITS REGISTERED BY A SINGLE PRESS\n');
console.log('  fps    move     hits   on frames');
let bad = 0;
for (const fps of [60, 30, 20, 12, 8, 5, 3]) {
  for (const mv of ['light', 'heavy']) {
    const r = swing(fps, mv);
    const flag = r.hits > 1 ? '   <-- ONE PRESS, MANY HITS' : '';
    if (r.hits > 1) bad++;
    console.log(`  ${String(fps).padStart(3)}    ${mv.padEnd(7)} ${String(r.hits).padStart(4)}   ${r.hitFrames.slice(0, 10).join(',')}${flag}`);
  }
}
console.log(`\n${bad === 0 ? 'PASS — every press lands exactly once.' : `FAIL — ${bad} of 14 cases register more than one hit per press.`}`);
