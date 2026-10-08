import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { locomotionPlaybackRate } from './ClipPlayback.ts';
import { setAuthoredStrideSpeeds, playbackRateFor } from '../motion/DistanceMatching.ts';

describe('locomotion animation timing', () => {
  it('slows an unmeasured walk loop to the same 25% movement tier', () => {
    assert.ok(Math.abs(locomotionPlaybackRate(0.225, 'UNKNOWN_WALK') - 1) > 0.7);
    assert.ok(Math.abs(locomotionPlaybackRate(0.225, 'UNKNOWN_WALK') - 1) < 0.8);
  });

  it('slows measured authored strides instead of forcing the old 0.4x floor', () => {
    setAuthoredStrideSpeeds([['TEST_WALK', 1.839]]);
    const rate = playbackRateFor('TEST_WALK', 0.225);
    assert.ok(rate > 0.1 && rate < 0.14, `measured walk rate was ${rate.toFixed(3)}x`);
  });

  it('keeps the run loop below authored 1x while the engine moves at 25% of the old run tier', () => {
    setAuthoredStrideSpeeds([['TEST_RUN', 3.277]]);
    const rate = playbackRateFor('TEST_RUN', 0.75);
    assert.ok(rate > 0.2 && rate < 0.24, `measured run rate was ${rate.toFixed(3)}x`);
  });
});
