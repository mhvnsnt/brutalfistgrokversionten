// `.ts` extensions on purpose — the repo's runner resolves them literally.
import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import { existsSync, readFileSync } from 'node:fs';

import {
  markGrapplePairs, receiverClipFor, isThrowVictimClip, resetGrapplePairingForTest, pairPlaybackRate,
} from './GrapplePairing.ts';
import { NAMED_GRAPPLE_BINDINGS, DELIVERER_ONLY_CAPTURES, pairTiming, namedGrappleBinding } from './NamedGrappleBindings.ts';
import { BRUTAL_FIST_FULL_CATALOG } from '../BrutalFistMoveCatalog.ts';

/**
 * EVERY BOUND PAIR: BOTH HALVES RESOLVE, AND THEY RUN ON ONE CLOCK.
 * Run against the REAL baked index and the REAL source index.
 */
const BAKED = JSON.parse(readFileSync('public/motion/baked/index.json', 'utf8'));
const SOURCE = JSON.parse(readFileSync('public/motion/index.json', 'utf8'));
const labels = {}; // no owner overrides: prove the BAKE pairs them

const BANNON_TWO_BODY = [
  'FLYING_HEADBUTT', 'PUMPHANDLE_GERMAN_DOUBLE', 'BACKDROP_360_FACE', 'FALCON_ARROW_STANDING',
  'FALCON_ARROW_GROUNDED', 'SOMERSAULT_TORNADO_DDT', 'STALLING_SUPLEX_STEPS', 'TAG_POWERBOMB_GERMAN',
];
const SYNTHETIC_VARIANT = /_(DELAYED|HARD|KNEELING|MIRROR|SITOUT|SLOW|SNAP)$/;

describe('Bannon two-body grapple pairs came through the universal intake', () => {
  beforeEach(() => { resetGrapplePairingForTest(); markGrapplePairs(BAKED); });

  for (const d of BANNON_TWO_BODY) {
    const r = `${d}__RECV`;
    it(`${d}: both halves are baked, sourced with provenance, and paired by the bake`, () => {
      for (const c of [d, r]) {
        assert.ok(BAKED[c], `${c} not in the baked index`);
        assert.ok(existsSync(`public/motion/baked/${c}.json`) && existsSync(`public/motion/baked/${c}.json.zst`), `${c} baked file missing`);
        const src = SOURCE[c];
        assert.ok(src, `${c} not in the source index`);
        assert.equal(src.provenance?.origin, 'AUTHORED_CAPTURE');
        assert.equal(src.provenance?.repo, 'mhvnsnt/Bannon');
        assert.equal(src.provenance?.synthetic, false);
        assert.equal(src.via, 'video_to_clip/mediapipe/two-body');
      }
      assert.deepEqual(BAKED[d].pairedWith, [r]);
      assert.equal(BAKED[r].receives, true);
      const pick = receiverClipFor(d, { labels });
      assert.equal(pick?.receiver, r);
      assert.equal(pick?.source, 'baked');
      assert.equal(isThrowVictimClip(r), true);
      assert.equal(isThrowVictimClip(d), false);
    });

    it(`${d}: deliverer and receiver timing align`, () => {
      const t = pairTiming(BAKED[d].dur, BAKED[r].dur);
      assert.ok(t.aligned, `${d}: ${BAKED[d].dur}s vs ${BAKED[r].dur}s (ratio ${t.ratio.toFixed(3)})`);
      const rate = pairPlaybackRate(d, r);
      assert.ok(Math.abs(rate - t.receiverTimeScale) < 1e-9);
      // at that rate the victim's half ends on the deliverer's last frame
      assert.ok(Math.abs(BAKED[r].dur / rate - BAKED[d].dur) < 1e-6);
    });
  }
});

describe('the owner\'s named grapples are bound to real clips, or honestly MISSING_CLIP', () => {
  beforeEach(() => { resetGrapplePairingForTest(); markGrapplePairs(BAKED); });

  for (const b of Object.values(NAMED_GRAPPLE_BINDINGS)) {
    it(`${b.displayName}: ${b.status}`, () => {
      const move = BRUTAL_FIST_FULL_CATALOG[b.moveKey];
      assert.ok(move, `${b.moveKey} missing from the catalog`);
      assert.equal(move.id, b.moveId);
      assert.equal(namedGrappleBinding(b.moveId), b);

      for (const c of [b.deliverer, b.receiver]) {
        if (!c) continue;
        assert.ok(BAKED[c], `${c} is bound but not baked`);
        assert.doesNotMatch(c, SYNTHETIC_VARIANT, `${c} is a synthetic time-warp variant, TEST_ONLY`);
        assert.ok(b.provenance.some((p) => p.clip === c), `${c} has no provenance`);
      }
      if (b.deliverer) assert.ok(move.animationAliases.includes(b.deliverer), `${b.moveKey} does not route to ${b.deliverer}`);
      // a receiver half must never be served as the attacker's animation
      if (b.receiver) assert.ok(!move.animationAliases.includes(b.receiver));

      switch (b.status) {
        case 'REAL_PAIR': {
          assert.ok(b.deliverer && b.receiver);
          const pick = receiverClipFor(b.deliverer!, { labels });
          assert.equal(pick?.receiver, b.receiver);
          assert.equal(pick?.source, 'baked');
          assert.ok(pairTiming(BAKED[b.deliverer!].dur, BAKED[b.receiver!].dur).aligned);
          break;
        }
        case 'DELIVERER_ONLY':
          assert.ok(b.deliverer); assert.equal(b.receiver, null);
          assert.ok(!BAKED[b.deliverer!].pairedWith?.length, 'a deliverer-only move grew a baked partner — upgrade it to REAL_PAIR');
          break;
        case 'RECEIVER_ONLY':
          assert.ok(b.receiver); assert.equal(b.deliverer, null);
          break;
        case 'MISSING_CLIP':
          assert.equal(b.deliverer, null); assert.equal(b.receiver, null);
          break;
      }
      if (b.provenance.some((p) => p.mixamo)) assert.match(JSON.stringify(b.provenance), /Mixamo/);
    });
  }

  it('the real pairs are Flying Headbutt, Getbackk (exact) and Deadlift German, Chainsnatcher (stand-ins)', () => {
    const real = Object.values(NAMED_GRAPPLE_BINDINGS).filter((b) => b.status === 'REAL_PAIR').map((b) => b.moveKey).sort();
    assert.deepEqual(real, ['chainsnatcher', 'deadliftGerman', 'flyingHeadbutt', 'getbackk']);
    assert.equal(NAMED_GRAPPLE_BINDINGS.deadliftGerman.fidelity, 'stand_in');
    assert.equal(NAMED_GRAPPLE_BINDINGS.chainsnatcher.fidelity, 'stand_in');
    assert.equal(NAMED_GRAPPLE_BINDINGS.flyingHeadbutt.fidelity, 'exact');
    assert.equal(NAMED_GRAPPLE_BINDINGS.getbackk.fidelity, 'exact');
  });

  it('the victim-only halves the bake already knew are still victims', () => {
    assert.equal(isThrowVictimClip('BACKBREAKER_REACTION'), true);
  });
});

describe('Getbackk: exact two-body pair from the owner-supplied reference capture', () => {
  beforeEach(() => { resetGrapplePairingForTest(); markGrapplePairs(BAKED); });
  const b = NAMED_GRAPPLE_BINDINGS.getbackk;

  it('binds GETBACKK + GETBACKK__RECV, replacing the F5 deliverer-only stand-in', () => {
    assert.equal(b.status, 'REAL_PAIR');
    assert.equal(b.deliverer, 'GETBACKK');
    assert.equal(b.receiver, 'GETBACKK__RECV');
    assert.notEqual(b.deliverer, 'F5');
    const pick = receiverClipFor('GETBACKK', { labels });
    assert.deepEqual([pick?.receiver, pick?.source], ['GETBACKK__RECV', 'baked']);
    assert.deepEqual(BAKED.GETBACKK.pairedWith, ['GETBACKK__RECV']);
    assert.equal(BAKED.GETBACKK__RECV.receives, true);
    assert.equal(isThrowVictimClip('GETBACKK__RECV'), true);
    assert.equal(isThrowVictimClip('GETBACKK'), false);
    // the catalog routes the move to the new deliverer before the old F5 fallback
    const aliases = BRUTAL_FIST_FULL_CATALOG.getbackk.animationAliases;
    assert.ok(aliases.indexOf('GETBACKK') >= 0 && aliases.indexOf('GETBACKK') < aliases.indexOf('F5'));
  });

  it('both halves share one take: same duration, same key clock, no NaN', () => {
    const t = pairTiming(BAKED.GETBACKK.dur, BAKED.GETBACKK__RECV.dur);
    assert.equal(t.ratio, 1);
    const a = JSON.parse(readFileSync('public/motion/GETBACKK.json', 'utf8'));
    const r = JSON.parse(readFileSync('public/motion/GETBACKK__RECV.json', 'utf8'));
    assert.equal(a.keys.length, r.keys.length);
    assert.deepEqual(a.keys.map((k: any) => k.t), r.keys.map((k: any) => k.t));
    for (const c of [a, r]) {
      assert.ok(c.dur > 6 && c.dur < 7.5, `dur ${c.dur}`);
      assert.doesNotMatch(JSON.stringify(c), /NaN|Infinity|null/);
      for (const k of c.keys) assert.ok(Object.keys(k.bones).length >= 12, 'every key drives the body');
    }
    for (const c of ['GETBACKK', 'GETBACKK__RECV']) {
      assert.ok(existsSync(`public/motion/baked/${c}.json`) && existsSync(`public/motion/baked/${c}.json.zst`));
    }
  });

  it('records the third-party provenance and every interpolated gap (none longer than 6 frames)', () => {
    for (const c of ['GETBACKK', 'GETBACKK__RECV']) {
      const p = SOURCE[c].provenance;
      assert.equal(p.origin, 'AUTHORED_CAPTURE');
      assert.equal(p.synthetic, false);
      assert.equal(p.licenseClass, 'owner-supplied reference capture (third-party footage)');
      assert.equal(p.sourceVideo.originalFootage, 'third-party TikTok (@mackeymcqui)');
      assert.match(p.sourceVideo.supplied, /owner-supplied reference video/);
      for (const g of p.interpolatedGaps) assert.ok(g.frames >= 1 && g.frames <= 6, JSON.stringify(g));
      assert.ok(SOURCE[c].coverFrac >= 0.9, `${c} coverage ${SOURCE[c].coverFrac}`);
    }
    assert.equal(SOURCE.GETBACKK.pairedWith, 'GETBACKK__RECV');
    assert.match(b.note, /@mackeymcqui/);
    assert.match(b.note, /owner must confirm/);
  });

  it('F5 stays a deliverer-only capture and never borrows a stand-in victim', () => {
    assert.ok(DELIVERER_ONLY_CAPTURES.F5);
    assert.equal(receiverClipFor('F5', { labels }), null);
    assert.ok(!BAKED.F5.pairedWith?.length);
  });
});
