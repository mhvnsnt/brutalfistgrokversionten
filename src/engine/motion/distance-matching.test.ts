/**
 * THE FEET SLIDE UNLESS PLAYBACK SCALES WITH SPEED.
 *
 * Every locomotion clip here has zero hips travel — root motion is neutralised and
 * the engine moves the root — so the stride is the clip's and the speed is the
 * engine's. Measured by FK on the planted foot against what the engine moves at:
 *
 *   DWARF_WALK   authored 1.839 m/s, engine 1.72  -> 0.94x, slid 0.12 m/s
 *   GINGA_BACK   authored 2.492 m/s, engine 1.72  -> 0.69x, slid 0.77 m/s
 *   DRUNK_RUN    authored 3.277 m/s, engine 4.30  -> 1.31x, slid 1.02 m/s
 *   TPOSE        authored 0.000 m/s               -> the control
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  setAuthoredStrideSpeeds, authoredStrideSpeed, playbackRateFor, residualSlideMps,
  strideSpeedCount, RATE_CLAMP, MIN_AUTHORED_SPEED_MPS, MIN_MATCHED_SPEED_MPS,
} from './DistanceMatching.ts';
import { WALK_SPEED, DASH_SPEED } from '../locomotion/LocomotionSystem.ts';

/** The real measured figures, so the test moves when the bank does. */
const MEASURED: Array<readonly [string, number]> = [
  ['DWARF_WALK', 1.839],
  ['GINGA_BACKWARD', 2.492],
  ['DRUNK_RUN_FORWARD', 3.277],
  ['TPOSE', 0],
  ['IDLE', 0.162],
];

describe('distance matching', () => {
  it('does nothing at all until the measurements are loaded', () => {
    setAuthoredStrideSpeeds([]);
    assert.equal(strideSpeedCount(), 0);
    assert.equal(playbackRateFor('DWARF_WALK', WALK_SPEED), 1,
      'with no manifest the behaviour must be exactly as before this existed');
    assert.equal(residualSlideMps('DWARF_WALK', WALK_SPEED), 0);
  });

  it('scales the walk to the engine speed', () => {
    setAuthoredStrideSpeeds(MEASURED);
    const rate = playbackRateFor('DWARF_WALK', WALK_SPEED);
    assert.ok(Math.abs(rate - WALK_SPEED / 1.839) < 1e-6, `rate ${rate}`);
    assert.ok(rate < 1, 'the walk is authored FASTER than we move, so it must slow down');
  });

  it('fixes the back-walk, which was sliding three quarters of a metre a second', () => {
    setAuthoredStrideSpeeds(MEASURED);
    const before = Math.abs(WALK_SPEED - 2.492);        // rate 1: the raw mismatch
    const after = residualSlideMps('GINGA_BACKWARD', WALK_SPEED);
    assert.ok(before > 0.7, `the defect should be ~0.77 m/s, measured ${before.toFixed(2)}`);
    assert.ok(after < 0.5, `back-walk residual ${after.toFixed(3)} m/s is still within the explicit playback-rate clamp`);
  });

  it('speeds the dash up instead of slowing it down', () => {
    setAuthoredStrideSpeeds(MEASURED);
    const rate = playbackRateFor('DRUNK_RUN_FORWARD', DASH_SPEED);
    assert.ok(rate > 0.9 && rate < 1.1, `the measured run is already close to the new dash tier, so only a small correction is expected, got ${rate}`);
    assert.ok(residualSlideMps('DRUNK_RUN_FORWARD', DASH_SPEED) < 0.4);
  });

  it('leaves an in-place clip alone rather than dividing by nearly zero', () => {
    setAuthoredStrideSpeeds(MEASURED);
    assert.equal(authoredStrideSpeed('TPOSE'), null, 'a 0 m/s clip has no ratio to take');
    assert.equal(authoredStrideSpeed('IDLE'), null, `an idle at 0.162 is under the ${MIN_AUTHORED_SPEED_MPS} floor`);
    assert.equal(playbackRateFor('TPOSE', 5), 1);
    assert.equal(playbackRateFor('IDLE', 5), 1);
  });

  it('leaves a standing fighter alone', () => {
    setAuthoredStrideSpeeds(MEASURED);
    assert.equal(playbackRateFor('DWARF_WALK', 0), 1);
    assert.equal(playbackRateFor('DWARF_WALK', MIN_MATCHED_SPEED_MPS / 2), 1);
  });

  it('clamps rather than stretching a clip until it is a different animation', () => {
    setAuthoredStrideSpeeds(MEASURED);
    // A walk at 8 m/s is not a fast walk, it is the wrong clip.
    assert.equal(playbackRateFor('DWARF_WALK', 8), RATE_CLAMP.max);
    assert.equal(playbackRateFor('DWARF_WALK', 0.3), 0.3 / 1.839);
    assert.ok(residualSlideMps('DWARF_WALK', 8) > 0,
      'and when the clamp bites it must REPORT the leftover slide rather than claim success');
  });

  it('is sign-agnostic, because walking backward is still walking', () => {
    setAuthoredStrideSpeeds(MEASURED);
    assert.equal(playbackRateFor('DWARF_WALK', -WALK_SPEED), playbackRateFor('DWARF_WALK', WALK_SPEED));
  });

  it('judges the source clip, not a masked half', () => {
    setAuthoredStrideSpeeds(MEASURED);
    assert.equal(authoredStrideSpeed('DWARF_WALK__lower'), 1.839);
    setAuthoredStrideSpeeds([]);
  });
});
