// `.ts` extensions on purpose — the repo's runner resolves them literally.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LocomotionSystem } from './LocomotionSystem.ts';

/**
 * Tekken 7 is an accepted base (3 and 8 play the same rule). The stick does
 * not keep moving the body after a move has started. The move's own travel
 * is a different channel and is not what this checks.
 */
describe('a Tekken commit kills the walk on the same frame', () => {
  it('does not coast a back-walk through the startup of an attack', () => {
    const loco = new LocomotionSystem(0, 0, 1);
    for (let i = 0; i < 30; i++) loco.update(-1, 0, 1 / 60, false, false);
    const started = loco.position.x;
    assert.ok(started < -0.05, `never got up to a walk (x ${started.toFixed(3)})`);

    loco.update(0, 0, 1 / 60, false, false, undefined, false);
    const drifted = Math.abs(loco.position.x - started);
    assert.ok(drifted < 1e-6, `the walk coasted ${drifted.toFixed(3)}m after the attack started`);
  });

  it('still walks while the stick is live', () => {
    const loco = new LocomotionSystem(0, 0, 1);
    for (let i = 0; i < 30; i++) loco.update(1, 0, 1 / 60, false, false);
    assert.ok(loco.position.x > 0.05, `a live stick did not walk (x ${loco.position.x.toFixed(3)})`);
  });
});
