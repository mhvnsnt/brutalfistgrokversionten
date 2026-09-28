/**
 * Owner: "the animation plays very quickly. It really doesn't play long enough
 * to do a contact for real ... The move never looks like it makes contact, but
 * the game is reading that a fight is happening."
 *
 * These pin the two halves of that, on the REAL clip lengths measured from the
 * motion bank rather than on invented numbers:
 *   1. a strike is never fast-forwarded far enough to read as a twitch
 *   2. the animation layer holds it long enough for the motion to finish
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  attackPlaybackRate, attackHoldSeconds,
  ATTACK_MAX_SPEEDUP, ATTACK_RECONCILE_MAX_FIT,
} from './ClipPlayback.ts';

/** The light-attack window, 20 frames at 60fps, and the clips that play in it. */
const LIGHT_WINDOW = 20 / 60;
const HEAVY_WINDOW = 39 / 60;
const REAL_CLIPS: Array<[string, number]> = [
  ['GRAFQUICKJAB', 0.458],
  ['GYAKUZUKI', 0.417],
  ['HEAVYKICK', 0.542],
];

describe('a strike is never fast-forwarded into a twitch', () => {
  for (const [name, dur] of REAL_CLIPS) {
    it(`${name} plays no faster than ${ATTACK_MAX_SPEEDUP}x in the light window`, () => {
      const rate = attackPlaybackRate(dur, LIGHT_WINDOW);
      assert.ok(rate <= ATTACK_MAX_SPEEDUP + 1e-9, `${name} played at ${rate}x`);
      assert.ok(rate >= 1, `${name} played at ${rate}x -- a strike is never slowed`);
    });
  }

  it('the old band called a 45% fast-forward a nudge; this one does not', () => {
    // 0.458 / 0.333 = 1.375, which the previous `fit <= 1.45` returned verbatim.
    assert.ok(attackPlaybackRate(0.458, LIGHT_WINDOW) < 1.375);
  });

  it('a clip far too long for the slot is left alone, not crushed', () => {
    // A 7s suplex or a 3s demo resolved onto a jab is a DATA problem. Playing it
    // at 1x and letting the state machine cut it is the honest failure.
    const absurd = LIGHT_WINDOW * (ATTACK_RECONCILE_MAX_FIT + 1);
    assert.equal(attackPlaybackRate(absurd, LIGHT_WINDOW), 1);
    assert.equal(attackHoldSeconds(absurd, LIGHT_WINDOW), LIGHT_WINDOW);
  });
});

describe('the body is given long enough to finish the motion', () => {
  for (const [name, dur] of REAL_CLIPS) {
    it(`${name} is held until its motion completes`, () => {
      const hold = attackHoldSeconds(dur, LIGHT_WINDOW);
      const rate = attackPlaybackRate(dur, LIGHT_WINDOW);
      const needed = dur / rate;
      assert.ok(hold >= needed - 1e-9, `${name} held ${hold}s, motion needs ${needed}s`);
      assert.ok(hold >= LIGHT_WINDOW, 'the hold never shortens the authored window');
    });
  }

  it('a clip that already fits is not stretched', () => {
    assert.equal(attackHoldSeconds(LIGHT_WINDOW, LIGHT_WINDOW), LIGHT_WINDOW);
  });

  it('a short clip plays at its authored speed, not in slow motion', () => {
    // Stretching a 0.208s clip across a 0.333s window is slow motion. It plays
    // as authored and the last frame holds through recovery, which is what the
    // game this is measured against does.
    assert.equal(attackPlaybackRate(0.208, LIGHT_WINDOW), 1);
    assert.equal(attackHoldSeconds(0.208, LIGHT_WINDOW), LIGHT_WINDOW);
  });

  it('holds in the heavy window too', () => {
    for (const [, dur] of REAL_CLIPS) {
      assert.ok(attackHoldSeconds(dur, HEAVY_WINDOW) >= HEAVY_WINDOW);
    }
  });

  it('never returns a hold for a window that does not exist', () => {
    assert.equal(attackHoldSeconds(0.5, 0), 0);
  });
});
