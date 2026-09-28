/**
 * EVERY MOVE SITS INSIDE TEKKEN'S FRAME ENVELOPE.
 *
 * Owner: "the combat looking incoherent, buggy, and glitchy" and "cut out all
 * of the hand tooling".
 *
 * MEASURED across the 286 imported moves before this, in frames at 60fps:
 *
 *                 min   p25   median   p75   max
 *     startup       4     9      12     13    13
 *     active        3     6       9     14    33
 *     TOTAL        15    25      35     51    98
 *
 * Against Tekken 7's published frame data — jab startup 10, mids 13-16,
 * launchers 15-20, and active frames of 2-6 on essentially everything — that
 * put 75 moves faster than any Tekken jab and left 211 of 286 with a hitbox
 * live for more than 6 frames, one of them for 33. A hitbox that stays out for
 * half a second connects after the move has visually finished, which is a large
 * part of what reads as incoherent.
 *
 * The numbers were derived from CLIP LENGTH — how long an animation happens to
 * run — rather than from fighting-game frame data. tools/moves/calibrate_frames
 * maps each move's RANK onto Tekken's range, so nothing is hand-tuned and no
 * move changes its position relative to any other.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const F = 60;
const moves = (() => {
  const raw = JSON.parse(readFileSync('public/motion/movesets.json', 'utf8')) as Record<string, Array<Record<string, number>>>;
  return Object.values(raw).flat().filter((m) => typeof m.startup === 'number');
})();

const frames = (s: number) => Math.round(s * F);

describe('the frame envelope', () => {
  it('there are moves to check', () => {
    assert.ok(moves.length > 200, `only ${moves.length} moves parsed`);
  });

  it('nothing comes out faster than a Tekken jab', () => {
    const fast = moves.filter((m) => frames(m.startup) < 10);
    assert.equal(fast.length, 0,
      `${fast.length} moves have startup under 10 frames — unreactable`);
  });

  it('no hitbox stays out longer than Tekken allows', () => {
    // This is the one that matters most: a long active window is a move that
    // keeps hitting after it looks finished.
    const sticky = moves.filter((m) => frames(m.active) > 6);
    assert.equal(sticky.length, 0,
      `${sticky.length} moves keep a hitbox live for more than 6 frames`);
  });

  it('every hitbox is live for at least 2 frames', () => {
    const ghost = moves.filter((m) => frames(m.active) < 2);
    assert.equal(ghost.length, 0,
      `${ghost.length} moves have a hitbox too short to connect reliably`);
  });

  it('no move is longer than a Tekken power move', () => {
    const slow = moves.filter((m) => frames(m.startup + m.active + m.recovery) > 62);
    assert.equal(slow.length, 0, `${slow.length} moves run longer than 62 frames`);
  });

  it('the fastest move is still slower than the slowest is fast — the set has range', () => {
    const totals = moves.map((m) => frames(m.startup + m.active + m.recovery));
    const min = Math.min(...totals), max = Math.max(...totals);
    assert.ok(max - min >= 20,
      `every move totals between ${min} and ${max} frames — the calibration flattened the set`);
  });
});
