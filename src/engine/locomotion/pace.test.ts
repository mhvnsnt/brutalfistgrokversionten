// `.ts` extensions on purpose — the repo's runner resolves them literally.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrameDataHitboxSystem } from '../combat/FrameDataHitbox.ts';
import { FighterStateMachine } from '../combat/FighterStateMachine.ts';
import { DASH_SPEED, WALK_SPEED } from './LocomotionSystem.ts';

/**
 * Schwarzerblitz walks at 80 units/s and its modal authored strike range is 65
 * units, so a fighter crosses 1.23 of his own reaches per second. Both numbers
 * come from the same game, so the scale cancels — which is the only reason this
 * is comparable to ours at all.
 */
const GENRE_REACHES_PER_SECOND = 80 / 65;

const NEUTRAL = {
  forward: 0, strafe: 0, light: false, heavy: false, guard: false, crouch: false,
};

/**
 * THE REACH IS MEASURED, NOT ASSERTED.
 *
 * The first version of this test hardcoded 0.8m, taken from the distance
 * another test happened to swing at. That made the pace gap look like 2.2x when
 * it was 1.28x, and the "fix" set the walk to 1.0 m/s — sluggish rather than
 * deliberate. Driving a real attack out to its furthest connecting distance is
 * the only honest input, and it keeps this test correct if the hitboxes change.
 */
function measuredReach(): number {
  let best = 0;
  for (let gap = 0.4; gap <= 2.5; gap += 0.05) {
    const fsm = new FighterStateMachine();
    const hb = new FrameDataHitboxSystem();
    for (let i = 0; i < 30; i++) fsm.update(NEUTRAL, 1 / 60);
    fsm.update({ ...NEUTRAL, lp: true }, 1 / 60);
    let hit = false;
    for (let i = 0; i < 120 && !hit; i++) {
      hb.update(fsm.getSweptHitboxWindow());
      if (hb.checkCollision(0, 0, 1, gap, 0, false, i, 0, 0)) hit = true;
      fsm.update(NEUTRAL, 1 / 60);
    }
    if (hit) best = gap;
  }
  return best;
}

describe('the fight is paced like the genre it is built on', () => {
  const reach = measuredReach();

  it('a jab reaches far enough to be measurable at all', () => {
    assert.ok(reach > 0.5, `a jab connects no further than ${reach.toFixed(2)}m`);
  });

  /**
   * THIS IS THE NUMBER THAT MADE BACK ATTACKS WHIFF. Walking fast relative to
   * your own reach means any moment spent holding back puts you outside your
   * range before your active frames arrive — the attack was never the problem.
   */
  it('crosses its own reach at roughly the rate Schwarzerblitz does', () => {
    const ours = WALK_SPEED / reach;
    assert.ok(
      Math.abs(ours - GENRE_REACHES_PER_SECOND) < 0.3,
      `we cross ${ours.toFixed(2)} reaches/sec against the genre's ${GENRE_REACHES_PER_SECOND.toFixed(2)}`
      + ` (walk ${WALK_SPEED}, measured reach ${reach.toFixed(2)}m)`,
    );
  });

  /** runningSpeed = walkingSpeed * 2.5f, read out of FK_Character. */
  it('dashes at the source engine\'s multiple of its own walk', () => {
    assert.ok(
      Math.abs(DASH_SPEED / WALK_SPEED - 2.5) < 0.25,
      `dash is ${(DASH_SPEED / WALK_SPEED).toFixed(2)}x the walk, not 2.5x`,
    );
  });

  /**
   * Slower must not become sluggish. They start 3.6m apart, and a fighter who
   * cannot reach his opponent is a different complaint from a fighter who
   * reaches him too easily.
   */
  it('still closes the round-start gap in a couple of seconds', () => {
    const closeSeconds = (3.6 - reach) / (WALK_SPEED * 2);
    assert.ok(closeSeconds < 1.5, `it would take ${closeSeconds.toFixed(1)}s to get in range`);
  });
});
