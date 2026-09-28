import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  stepFacing, shortestTurn, MAX_TURN_DEG_PER_FRAME, FACING_BLEND_FRAMES,
} from './FacingRate.ts';

const DEG = Math.PI / 180;

describe('facing rate', () => {
  it('matches the rate Tekken 3 caps at', () => {
    // 0x71c of 65536 units per frame, from tekken3_jun_combat.c.
    assert.ok(Math.abs(MAX_TURN_DEG_PER_FRAME - 10.0) < 0.02,
      `cap is ${MAX_TURN_DEG_PER_FRAME.toFixed(3)} deg/frame, Tekken's is 10.0`);
    assert.equal(FACING_BLEND_FRAMES, 8);
  });

  it('a half turn takes many frames instead of happening at once', () => {
    let yaw = 0;
    let frames = 0;
    while (Math.abs(shortestTurn(yaw, Math.PI)) > 0.01 && frames < 200) {
      yaw = stepFacing(yaw, Math.PI, 1);
      frames++;
    }
    // At 10 deg/frame a 180 degree turn cannot be quicker than 18 frames.
    assert.ok(frames >= 18, `a 180 degree turn took ${frames} frames — faster than the cap allows`);
    assert.ok(frames < 200, 'the turn never completed');
  });

  it('never moves more than the cap in one frame', () => {
    let yaw = 0;
    for (let f = 0; f < 60; f++) {
      const next = stepFacing(yaw, Math.PI, 1);
      const moved = Math.abs(shortestTurn(yaw, next)) / DEG;
      assert.ok(moved <= MAX_TURN_DEG_PER_FRAME + 1e-6,
        `turned ${moved.toFixed(2)} degrees in one frame`);
      yaw = next;
    }
  });

  it('takes the short way round rather than the long way', () => {
    // Target just anticlockwise of the wrap point: the step must be negative.
    const yaw = 3.0;
    const target = -3.0;
    assert.ok(stepFacing(yaw, target, 1) > yaw,
      'crossed the wrap the long way instead of stepping through PI');
    assert.ok(Math.abs(shortestTurn(3.0, -3.0)) < 0.6, 'shortestTurn did not wrap');
  });

  it('settles exactly on the target instead of creeping', () => {
    const yaw = stepFacing(1.0, 1.0005, 1);
    assert.equal(yaw, 1.0005, 'a tiny remaining angle did not land on the target');
  });

  it('turns by time, not by rendered frame, so a slow device is not slower to turn', () => {
    const oneBig = stepFacing(0, Math.PI, 4);
    let four = 0;
    for (let i = 0; i < 4; i++) four = stepFacing(four, Math.PI, 1);
    assert.ok(Math.abs(oneBig - four) < 0.02,
      `one 4-frame step (${oneBig.toFixed(3)}) and four 1-frame steps (${four.toFixed(3)}) disagree`);
  });
});
