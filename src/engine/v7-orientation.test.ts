// `.ts` extensions on purpose — the repo's runner resolves them literally.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { COMBAT_P1_YAW, COMBAT_P2_YAW, faceOpponentYaw } from './V7OrientationContract.ts';


/**
 * THE BODY MUST TURN WITH THE ORBIT.
 *
 * Owner, twice: "the sidestepping is not radial ... when they sidestep they
 * still do a straight sidestep." Measured live, the PATH already orbits —
 * P1 travelled z 0.09 -> 1.38 holding a 1.5-1.9 m gap — while the mesh yaw
 * was the constant COMBAT_P1_YAW the whole way. An arc you cannot see is a
 * straight line.
 */
describe('facing the opponent, not the lane', () => {
  const near = (a: number, b: number, msg: string) =>
    assert.ok(Math.abs(a - b) < 1e-6, `${msg}: ${a} vs ${b}`);

  it('reproduces the image-tested table when the pair are level on Z', () => {
    // These two values are the locked contract; the generalisation must not
    // move them, or every existing render is off by whatever it changed.
    near(faceOpponentYaw({ x: -2, z: 0 }, { x: 2, z: 0 }, 99), COMBAT_P1_YAW, 'P1 faces +X');
    near(Math.abs(faceOpponentYaw({ x: 2, z: 0 }, { x: -2, z: 0 }, 99)), COMBAT_P2_YAW, 'P2 faces -X');
  });

  it('turns to follow an opponent who moves off the lane', () => {
    // Opponent directly toward the camera (+Z) is a quarter turn.
    near(faceOpponentYaw({ x: 0, z: 0 }, { x: 0, z: 1 }, 99), -Math.PI / 2, 'toward +Z');
    near(faceOpponentYaw({ x: 0, z: 0 }, { x: 0, z: -1 }, 99), Math.PI / 2, 'toward -Z');
    // And a 45 degree bearing is 45 degrees, not snapped back to the lane.
    near(faceOpponentYaw({ x: 0, z: 0 }, { x: 1, z: -1 }, 99), Math.PI / 4, 'toward +X-Z');
  });

  it('keeps the lane yaw when the two are on top of each other', () => {
    // No bearing to read; spinning here would look like a glitch, not a turn.
    assert.equal(faceOpponentYaw({ x: 0, z: 0 }, { x: 0.01, z: 0 }, COMBAT_P1_YAW), COMBAT_P1_YAW);
  });
});
