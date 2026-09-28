/**
 * Owner: "they are visible doing 1 punch, but somehow hitting me like 7 times
 * really fast and making my character float in place doing the hit reaction
 * rapid fire ... movement turning into floating, gliding."
 *
 * MEASURED at a true 60fps against a fighter trying to WALK (tools/harness):
 *
 *    hit every   hits   flinches played   walking frames of 600
 *      20f         29         29                  222
 *      12f         49         49                   11
 *       8f         74         74                    7
 *       5f        119        119                    4
 *
 * Every hit restarted the reaction from frame zero, so below ~8 frames apart
 * the animation NEVER rendered -- a body frozen mid-twitch that cannot move.
 * These pin the floor that fixes it.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FighterStateMachine, DEFAULT_MOVE_WINDOWS, MIN_REACTION_FRAMES } from './FighterStateMachine.ts';

const FPS = 60, DT = 1 / FPS;
const NEUTRAL = { forward: 0, strafe: 0, light: false, heavy: false, guard: false, crouch: false };

/** Hit a fighter every `every` frames for `frames`, return what his body did. */
function pummel(every: number, frames = 600) {
  const f = new FighterStateMachine();
  let hits = 0;
  for (let i = 0; i < frames; i++) {
    f.tickAirborne(DT);
    f.update({ ...NEUTRAL, forward: 1 }, DT);
    if (every > 0 && i > 0 && i % every === 0) {
      f.applyHitStun(DEFAULT_MOVE_WINDOWS.lightAttack, 0.3, 'hit');
      hits++;
    }
  }
  return { hits, played: f.reactionStarts };
}

describe('a hit reaction is allowed to be seen', () => {
  it('does not restart the flinch on every hit when they arrive faster than the floor', () => {
    const r = pummel(2);   // a hit every 33ms — the machine-gun case
    assert.ok(r.hits > 200, 'the scenario must actually land a lot of hits');
    assert.ok(r.played < r.hits / 2,
      `${r.hits} hits restarted the animation ${r.played} times — the flinch never renders`);
  });

  it('gives each reaction at least its minimum window', () => {
    const r = pummel(1, 600);
    // 600 frames / 8-frame floor is the ceiling on how many CAN play.
    const ceiling = Math.ceil(600 / MIN_REACTION_FRAMES) + 1;
    assert.ok(r.played <= ceiling, `${r.played} animations in 600 frames exceeds the ${MIN_REACTION_FRAMES}-frame floor`);
  });

  it('does NOT throttle hits that are already far enough apart', () => {
    // Combos must keep working. At 20 frames apart every hit is its own reaction.
    const r = pummel(20);
    assert.equal(r.played, r.hits, 'a normal combo lost reactions it should have kept');
  });

  it('still applies the damage and the stun from a throttled hit', () => {
    // The hit is not ignored — only the ANIMATION restart is suppressed.
    const f = new FighterStateMachine();
    f.tickAirborne(DT); f.update({ ...NEUTRAL }, DT);
    f.applyHitStun(DEFAULT_MOVE_WINDOWS.lightAttack, 0.3, 'hit');
    const first = f.action;
    f.applyHitStun(DEFAULT_MOVE_WINDOWS.heavyAttack, 0.5, 'hit');   // inside the window
    assert.equal(first, 'HitStun');
    assert.equal(f.action, 'HitStun', 'a throttled hit must still hold the victim in hitstun');
    assert.equal(f.reactionStarts, 1, 'the second hit must not have restarted the animation');
  });

  it('the floor is expressed in FRAMES, so it means the same at any frame rate', () => {
    const at60 = pummel(2, 600);
    // Same wall-clock scenario at 30fps: half the frames, hits every frame.
    const f = new FighterStateMachine();
    const dt30 = 1 / 30;
    let hits = 0;
    for (let i = 0; i < 300; i++) {
      f.tickAirborne(dt30);
      f.update({ ...NEUTRAL, forward: 1 }, dt30);
      if (i > 0) { f.applyHitStun(DEFAULT_MOVE_WINDOWS.lightAttack, 0.3, 'hit'); hits++; }
    }
    assert.ok(f.reactionStarts < hits / 2, 'the floor stopped working at 30fps');
    assert.ok(at60.played < at60.hits / 2, 'the floor stopped working at 60fps');
  });
});
