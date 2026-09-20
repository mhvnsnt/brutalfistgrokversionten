// `.ts` extensions on purpose — the repo's runner resolves them literally.
import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';

import {
  markGrapplePairs, receiverClipFor, bakedGrapplePairs, throwVictimPool,
  isThrowVictimClip, resetGrapplePairingForTest, STANDIN_MAX_DURATION_GAP_S,
} from './GrapplePairing.ts';
import type { MoveLabelMap } from '../assets/moveLabels.ts';

/**
 * THE OPPONENT SIDE OF EVERY GRAPPLE.
 *
 * Owner, twice: "neck breaker ... would have two animation parts, one for
 * the deliverer and the receiver", then "Scoop slam is a grapple too that
 * needs the opponent side, and same for all grapples — they need the
 * opponent side hooked up and wired up all areas wise."
 *
 * Run against the REAL baked index, not a fixture, because the whole claim
 * is about what is in the bank.
 */
const INDEX = JSON.parse(readFileSync('public/motion/baked/index.json', 'utf8'));

describe('the opponent half of a grapple', () => {
  beforeEach(() => {
    resetGrapplePairingForTest();
    markGrapplePairs(INDEX);
  });

  it('pairs the halves the bank actually holds', () => {
    const pairs = bakedGrapplePairs();
    assert.ok(pairs.size >= 13, `expected the bake to pair at least 13 throws, got ${pairs.size}`);
    assert.deepEqual(receiverClipFor('KNEETHROW')?.receiver, 'KNEETHROWREACTION');
    assert.deepEqual(receiverClipFor('DDT')?.receiver, 'DDT_REACTION');
    assert.deepEqual(receiverClipFor('TZ_SCOOP_SLAM')?.receiver, 'TZ_SCOOP_SLAM__RECV');
  });

  /**
   * THE DURATIONS ARE THE PROOF, not the names. Five pairs agree to four
   * decimal places, which is one take recorded from two bodies — a name
   * rule getting lucky does not reproduce 2.4583 twice.
   */
  it('is confirmed by the two halves lasting the same time', () => {
    const exact = [...bakedGrapplePairs()].filter(
      ([d, rs]) => rs.some((r) => INDEX[r].dur === INDEX[d].dur));
    assert.ok(exact.length >= 5,
      `expected at least 5 pairs with identical durations, got ${exact.length}`);
  });

  it('never answers a throw with a generic hit flinch', () => {
    const pool = throwVictimPool().map((c) => c.name);
    assert.ok(!pool.includes('REACTION_HITWEAKHIGH'));
    assert.ok(!pool.includes('HIT_REACTION'));
    // and the ones that ARE a body being thrown are in it
    assert.ok(pool.includes('POWERBOMBREACTION'));
  });

  it('marks the receiving halves so they can never be served as an attack', () => {
    assert.equal(isThrowVictimClip('KNEETHROWREACTION'), true);
    assert.equal(isThrowVictimClip('KNEETHROW'), false);
  });

  /**
   * NECKBREAKER, SUPLEX, GERMANSUPLEX, CHOKESLAM and TOMBSTONE have no
   * recorded partner at all. A body thrown for about the right length of
   * time beats a stock knockdown, and it is reported as a STAND-IN so it is
   * never mistaken for a real pair.
   */
  it('stands in for a throw whose partner was never recorded', () => {
    const pick = receiverClipFor('NECKBREAKER');
    assert.ok(pick, 'NECKBREAKER got no opponent half at all');
    assert.equal(pick.source, 'standin');
    assert.ok(Math.abs(pick.dur - INDEX.NECKBREAKER.dur) <= STANDIN_MAX_DURATION_GAP_S);
  });

  it('says nothing rather than guess when nothing is close enough', () => {
    // A 17-second clip has no victim half in the bank of anything like its
    // length, and answering it with a 4.5 s fall would read as the victim
    // teleporting back to his feet.
    assert.equal(receiverClipFor('DOUBLESUPLEX')?.source, undefined);
  });

  it('takes the owner\'s pairing over the bake\'s', () => {
    const labels: MoveLabelMap = { KNEETHROW: { pairedWith: 'POWERBOMBREACTION', at: 1 } };
    const pick = receiverClipFor('KNEETHROW', { labels });
    assert.equal(pick?.receiver, 'POWERBOMBREACTION');
    assert.equal(pick?.source, 'owner');
  });

  it('will not serve a half he called broken', () => {
    const labels: MoveLabelMap = { KNEETHROWREACTION: { verdict: 'broken', at: 1 } };
    const pick = receiverClipFor('KNEETHROW', { labels });
    assert.notEqual(pick?.receiver, 'KNEETHROWREACTION');
  });

  it('will not name a clip the bank has not got', () => {
    const pick = receiverClipFor('KNEETHROW', { available: (c) => c !== 'KNEETHROWREACTION' });
    assert.notEqual(pick?.receiver, 'KNEETHROWREACTION');
  });
});
