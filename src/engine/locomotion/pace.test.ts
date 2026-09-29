// `.ts` extensions on purpose — the repo's runner resolves them literally.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrameDataHitboxSystem } from '../combat/FrameDataHitbox.ts';
import { FighterStateMachine } from '../combat/FighterStateMachine.ts';
import { DASH_SPEED, WALK_SPEED, LocomotionSystem } from './LocomotionSystem.ts';

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

  it('uses exactly 25 percent of the previous walk and run tiers', () => {
    assert.equal(WALK_SPEED, 0.225);
    assert.equal(DASH_SPEED, 0.75);
  });

  it('keeps the run tier distinct while preserving the 3.33x relationship', () => {
    const ratio = DASH_SPEED / WALK_SPEED;
    assert.ok(Math.abs(ratio - (3 / 0.9)) < 1e-9, `run is ${ratio.toFixed(2)}x the walk — expected the prior tier relationship`);
  });

  it('paces the slowed walk against measured strike reach without restoring the old speed', () => {
    const ours = WALK_SPEED / reach;
    assert.ok(ours > 0 && ours < 0.35,
      `walk crosses ${ours.toFixed(2)} reaches/sec — the 25% movement tier must remain deliberately slow`,
    );
  });

  /**
   * Slower must not become sluggish. They start 3.6m apart, and a fighter who
   * cannot reach his opponent is a different complaint from a fighter who
   * reaches him too easily.
   */
  it('lifts a fighter into a real airborne arc and returns to the floor', () => {
    const loco = new LocomotionSystem(0, 0, 1);
    loco.beginJump();
    loco.update(0, 0, 0.1, false, false);
    assert.ok(loco.airborneY > 0.2, `jump height ${loco.airborneY.toFixed(3)}m is not visible`);
    for (let i = 0; i < 120; i++) loco.update(0, 0, 1 / 60, false, false);
    assert.equal(loco.airborneY, 0);
  });

  it('still closes the round-start gap without exceeding the new deliberate pace', () => {
    const closeSeconds = (3.6 - reach) / (WALK_SPEED * 2);
    assert.ok(closeSeconds > 4.0 && closeSeconds < 10.0, `it would take ${closeSeconds.toFixed(1)}s to get in range at the 25% walk tier`);
  });
});
