import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { attackPlaybackRate, jumpPlaybackRate, knockdownPlaybackRate, locomotionPlaybackRate } from './ClipPlayback.ts';

describe('clips play at Tekken speed, not fast-forward', () => {
  it('nudges a jab that already matches its window', () => {
    const rate = attackPlaybackRate(0.46, 0.44);
    assert.ok(rate > 0.95 && rate < 1.15, `jab rate ${rate}`);
  });

  it('does not squeeze a long suplex into the throw window', () => {
    assert.equal(attackPlaybackRate(7.83, 0.8), 1);
  });

  it('does not slow a short kick into slow motion', () => {
    assert.equal(attackPlaybackRate(0.25, 0.54), 1);
  });

  it('caps a long jump instead of playing it at 4x', () => {
    assert.equal(jumpPlaybackRate(2.37, 0.55), 2);
  });

  it('matches the feet to the ground: walk 1x, dash 2.5x', () => {
    assert.equal(locomotionPlaybackRate(1.15), 1);
    const dash = locomotionPlaybackRate(3.2);
    assert.ok(Math.abs(dash - (3.2 / 1.15)) < 0.02, `dash rate ${dash}`);
    assert.equal(locomotionPlaybackRate(0), 1);
  });

  it('lets a real fall play out and speeds a long death enough to land', () => {
    const fall = knockdownPlaybackRate(1.57, 1.7);
    assert.ok(fall > 0.85 && fall < 1.1, `fall rate ${fall}`);
    assert.equal(knockdownPlaybackRate(4.77, 1.7), 2.2);
  });
});
