// `.ts` extensions on purpose — the repo's runner resolves them literally.
import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import { existsSync, readFileSync } from 'node:fs';

import {
  markGrapplePairs, receiverClipFor, isThrowVictimClip, resetGrapplePairingForTest,
} from './GrapplePairing.ts';
import { NAMED_GRAPPLE_BINDINGS, namedGrappleThrowFor, pairTiming, THIRD_PARTY_APPROVED } from './NamedGrappleBindings.ts';
import { FighterStateMachine } from './FighterStateMachine.ts';
import { BRUTAL_FIST_FULL_CATALOG, getMoveById } from '../BrutalFistMoveCatalog.ts';

/**
 * CHAINSNATCHER: the exact two-body pair captured from the owner's reference
 * clip (third-party TikTok @thatjtawesome3, owner-approved 2026-10-07), bound
 * in place of the KNEETHROW stand-in and fired through the REAL throw path.
 */
const BAKED = JSON.parse(readFileSync('public/motion/baked/index.json', 'utf8'));
const SOURCE = JSON.parse(readFileSync('public/motion/index.json', 'utf8'));
const labels = {};
const b = NAMED_GRAPPLE_BINDINGS.chainsnatcher;
const BASE = { forward: 0, strafe: 0, light: false, heavy: false, guard: false, crouch: false };

describe('Chainsnatcher: exact two-body pair from the owner-supplied reference capture', () => {
  beforeEach(() => { resetGrapplePairingForTest(); markGrapplePairs(BAKED); });

  it('binds CHAINSNATCHER + CHAINSNATCHER__RECV; KNEETHROW is only the fallback, BACKBREAKER_REACTION is retired from it', () => {
    assert.equal(b.status, 'REAL_PAIR');
    assert.equal(b.fidelity, 'exact');
    assert.deepEqual([b.deliverer, b.receiver], ['CHAINSNATCHER', 'CHAINSNATCHER__RECV']);
    assert.deepEqual([b.fallback?.deliverer, b.fallback?.receiver], ['KNEETHROW', 'KNEETHROWREACTION']);
    assert.ok(!b.provenance.some((p) => p.clip === 'BACKBREAKER_REACTION' || p.clip.startsWith('KNEETHROW')));
    assert.ok(b.provenance.every((p) => p.origin === 'AUTHORED_CAPTURE' && !p.mixamo));
    // the bank still has the victim-only half for other throws
    assert.equal(isThrowVictimClip('BACKBREAKER_REACTION'), true);
    const pick = receiverClipFor('CHAINSNATCHER', { labels });
    assert.deepEqual([pick?.receiver, pick?.source], ['CHAINSNATCHER__RECV', 'baked']);
    assert.deepEqual(BAKED.CHAINSNATCHER.pairedWith, ['CHAINSNATCHER__RECV']);
    assert.equal(BAKED.CHAINSNATCHER__RECV.receives, true);
    assert.equal(isThrowVictimClip('CHAINSNATCHER__RECV'), true);
    assert.equal(isThrowVictimClip('CHAINSNATCHER'), false);
    // the stand-in still pairs on its own, as an ordinary bank pair
    assert.equal(receiverClipFor('KNEETHROW', { labels })?.receiver, 'KNEETHROWREACTION');
    // the catalog routes the move to the new deliverer before the old stand-in
    const aliases = BRUTAL_FIST_FULL_CATALOG.chainsnatcher.animationAliases;
    assert.ok(aliases.indexOf('CHAINSNATCHER') >= 0 && aliases.indexOf('CHAINSNATCHER') < aliases.indexOf('KNEETHROW'));
  });

  it('both halves share one take: same duration, same key clock, no NaN, every key drives the body', () => {
    assert.equal(pairTiming(BAKED.CHAINSNATCHER.dur, BAKED.CHAINSNATCHER__RECV.dur).ratio, 1);
    const a = JSON.parse(readFileSync('public/motion/CHAINSNATCHER.json', 'utf8'));
    const r = JSON.parse(readFileSync('public/motion/CHAINSNATCHER__RECV.json', 'utf8'));
    assert.deepEqual(a.keys.map((k: any) => k.t), r.keys.map((k: any) => k.t));
    for (const c of [a, r]) {
      assert.ok(Math.abs(c.dur - 2.0667) < 1e-3, `dur ${c.dur}`);
      assert.doesNotMatch(JSON.stringify(c), /NaN|Infinity|null/);
      for (const k of c.keys) assert.ok(Object.keys(k.bones).length >= 12, 'every key drives the body');
    }
    for (const c of ['CHAINSNATCHER', 'CHAINSNATCHER__RECV']) {
      assert.ok(existsSync(`public/motion/baked/${c}.json`) && existsSync(`public/motion/baked/${c}.json.zst`));
      assert.doesNotMatch(readFileSync(`public/motion/baked/${c}.json`, 'utf8'), /NaN|Infinity/);
    }
    assert.equal(b.pairSeconds, BAKED.CHAINSNATCHER.dur);
  });

  it('records the approval, the credit, every interpolated gap (<= 6 frames) and EXACTLY which frames are solved', () => {
    for (const c of ['CHAINSNATCHER', 'CHAINSNATCHER__RECV']) {
      const p = SOURCE[c].provenance;
      assert.equal(p.origin, 'AUTHORED_CAPTURE');
      assert.equal(p.licenseClass, THIRD_PARTY_APPROVED);
      assert.equal(p.credit, '@thatjtawesome3 (TikTok)');
      assert.equal(p.sourceVideo.originalFootage, 'third-party TikTok (@thatjtawesome3)');
      assert.equal(p.sourceVideo.sha256, 'cc9ad43482b36e164b755be6a8c97156f001aaaba01430d81d1ef5ab2dd2b040');
      for (const g of p.interpolatedGaps) assert.ok(g.frames >= 1 && g.frames <= 6, JSON.stringify(g));
      assert.deepEqual(p.captureWindowSeconds, [3.2, 5.2667]);
    }
    const atk = SOURCE.CHAINSNATCHER.provenance;
    assert.equal(atk.synthetic, 'partial');
    assert.deepEqual([atk.constrainedSolve.fromFrame, atk.constrainedSolve.toFrame, atk.constrainedSolve.frames], [135, 158, 24]);
    assert.equal(atk.trackedFrames, '39/63');
    const rcv = SOURCE.CHAINSNATCHER__RECV.provenance;
    assert.equal(rcv.synthetic, false);
    assert.equal(rcv.constrainedSolve, undefined);
    assert.equal(rcv.trackedFrames, '53/63');
    assert.match(b.note, /@thatjtawesome3/);
    assert.match(b.note, /f135-158/);
  });
});

describe('Chainsnatcher fires through the throw / grapple path', () => {
  beforeEach(() => { resetGrapplePairingForTest(); markGrapplePairs(BAKED); });

  it('the catalog marks it a throw on RP+RK, and the named throw resolves to the exact pair on one clock', () => {
    const move = getMoveById('bf_chainsnatcher');
    assert.equal(move?.throw, true);
    const named = namedGrappleThrowFor('bf_chainsnatcher');
    assert.ok(named);
    assert.equal(named!.button, 'rightThrow');
    assert.deepEqual([named!.deliverer, named!.receiver, named!.usedFallback], ['CHAINSNATCHER', 'CHAINSNATCHER__RECV', false]);
    assert.ok(Math.abs(named!.commitSeconds - 2.0667) < 1e-9);
  });

  it('falls back to KNEETHROW only when the exact pair is not available', () => {
    const named = namedGrappleThrowFor('bf_chainsnatcher', { available: (c) => !c.startsWith('CHAINSNATCHER') });
    assert.deepEqual([named?.deliverer, named?.receiver, named?.usedFallback], ['KNEETHROW', 'KNEETHROWREACTION', true]);
  });

  it('RP+RK on a fighter who owns Chainsnatcher is a command throw that commits with the named pair', () => {
    const fsm = new FighterStateMachine();
    fsm.setCharacterMoveIds({ extraMove1: 'bf_chainsnatcher' });
    assert.equal(fsm.namedThrowFor('rightThrow')?.moveId, 'bf_chainsnatcher');
    for (let i = 0; i < 30; i++) fsm.update(BASE as any, 1 / 60);
    fsm.update({ ...BASE, rightThrow: true } as any, 1 / 60);
    assert.equal((fsm as any).actionState, 'CommandThrow');
    assert.equal(fsm.activeClip(), 'CHAINSNATCHER');
    fsm.resolveCommandThrow(true);
    assert.equal(fsm.throwCommitClip(), 'CHAINSNATCHER');
    assert.equal(receiverClipFor(fsm.throwCommitClip(), { labels })?.receiver, 'CHAINSNATCHER__RECV');
    assert.ok((fsm as any).moveTimer >= 2.0667 - 1e-9, `commit ${(fsm as any).moveTimer}s`);
  });

  it('RP+RK on a fighter without it is still the plain right throw', () => {
    const fsm = new FighterStateMachine();
    fsm.setCharacterMoveIds({});
    for (let i = 0; i < 30; i++) fsm.update(BASE as any, 1 / 60);
    fsm.update({ ...BASE, rightThrow: true } as any, 1 / 60);
    assert.equal((fsm as any).actionState, 'CommandThrow');
    assert.notEqual(fsm.activeClip(), 'CHAINSNATCHER');
  });
});
