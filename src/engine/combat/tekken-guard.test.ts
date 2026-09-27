/**
 * Tekken 7 guard. Holding back blocks high and mid without planting the
 * walk. Crouch ducks highs. Down-back blocks lows. Mids hit a croucher.
 * The walk dies only once the block connects.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  FighterStateMachine,
  DEFAULT_MOVE_WINDOWS,
  resolveTekkenContact,
  type FighterInput,
  type MoveWindow,
} from './FighterStateMachine.ts';

const NEUTRAL: FighterInput = {
  forward: 0, strafe: 0, light: false, heavy: false, guard: false, crouch: false,
};

const input = (over: Partial<FighterInput>): FighterInput => ({ ...NEUTRAL, ...over });

function strike(level: 'high' | 'mid' | 'low', extra: Partial<MoveWindow> = {}): MoveWindow {
  return { ...DEFAULT_MOVE_WINDOWS.lightAttack, attackLevel: level, ...extra };
}

describe('Tekken 7 guard', () => {
  it('names the contact the same way Tekken does', () => {
    const stand = { standingBlock: true, crouchBlock: false, crouching: false, lowParryIntent: false };
    const duck = { standingBlock: false, crouchBlock: false, crouching: true, lowParryIntent: false };
    const db = { standingBlock: false, crouchBlock: true, crouching: true, lowParryIntent: false };
    const open = { standingBlock: false, crouchBlock: false, crouching: false, lowParryIntent: false };
    assert.equal(resolveTekkenContact('high', stand), 'block');
    assert.equal(resolveTekkenContact('mid', stand), 'block');
    assert.equal(resolveTekkenContact('low', stand), 'hit');
    assert.equal(resolveTekkenContact('high', duck), 'whiff');
    assert.equal(resolveTekkenContact('mid', duck), 'hit');
    assert.equal(resolveTekkenContact('low', duck), 'hit');
    assert.equal(resolveTekkenContact('low', db), 'block');
    assert.equal(resolveTekkenContact('mid', db), 'hit');
    assert.equal(resolveTekkenContact('high', open), 'hit');
  });

  it('blocks a high and a mid while still walking backward', () => {
    const fsm = new FighterStateMachine();
    const back = input({ forward: -1 });
    for (let i = 0; i < 10; i++) fsm.update(back, 1 / 60);
    assert.equal(fsm.action, 'Walking');
    assert.ok(fsm.getWalkVelocity().forward < -0.5, 'holding back has to keep the walk');

    const high = fsm.processIncomingHit(strike('high'));
    const mid = fsm.processIncomingHit(strike('mid'));
    assert.equal(high.blocked, true);
    assert.equal(mid.blocked, true);
    assert.equal(high.finalDamage, 0, 'a normal Tekken block does not chip');
    assert.ok(high.blockstun >= 0.12);
    assert.equal(fsm.action, 'Walking', 'the block decision must not plant the walk');
    assert.ok(fsm.getWalkVelocity().forward < -0.5);
  });

  it('lets a low through a standing back-walk', () => {
    const fsm = new FighterStateMachine();
    for (let i = 0; i < 10; i++) fsm.update(input({ forward: -1 }), 1 / 60);
    assert.equal(fsm.action, 'Walking');
    const low = fsm.processIncomingHit(strike('low'));
    assert.equal(low.blocked, false);
    assert.equal(low.whiffed, false);
    assert.ok(low.finalDamage > 0);
  });

  it('locks the walk only for blockstun, then the held back walks again', () => {
    const fsm = new FighterStateMachine();
    for (let i = 0; i < 10; i++) fsm.update(input({ forward: -1 }), 1 / 60);
    assert.equal(fsm.action, 'Walking');
    const mid = fsm.processIncomingHit(strike('mid'));
    fsm.applyBlockStun(mid.blockstun, false);
    assert.equal(fsm.action, 'Guard');
    assert.equal(fsm.getWalkVelocity().forward, 0);
    assert.equal(fsm.update(input({ forward: -1 }), 1 / 60), 'guard');

    for (let i = 0; i < 20; i++) fsm.update(input({ forward: -1 }), 1 / 60);
    assert.equal(fsm.action, 'Walking');
    assert.ok(fsm.getWalkVelocity().forward < 0, 'back held after blockstun has to walk again');
  });

  it('does not block while an attack is out', () => {
    const fsm = new FighterStateMachine();
    fsm.update(input({}), 1 / 60);
    fsm.update(input({ forward: -1, lp: true }), 1 / 60);
    assert.equal(fsm.action, 'Attacking');
    const mid = fsm.processIncomingHit(strike('mid'));
    assert.equal(mid.blocked, false);
    assert.equal(mid.whiffed, false);
  });

  it('ducks highs from a neutral crouch and still eats mids and lows', () => {
    const fsm = new FighterStateMachine();
    fsm.update(input({ crouch: true }), 1 / 60);
    assert.equal(fsm.current, 'crouch');
    assert.equal(fsm.processIncomingHit(strike('high')).whiffed, true);
    const mid = fsm.processIncomingHit(strike('mid'));
    const low = fsm.processIncomingHit(strike('low'));
    assert.equal(mid.blocked, false);
    assert.equal(mid.whiffed, false);
    assert.equal(low.blocked, false);
    assert.equal(fsm.action, 'Idle', 'a whiff must not turn the crouch into a guard plant');
  });

  it('down-back blocks lows, ducks highs, and does not walk', () => {
    const fsm = new FighterStateMachine();
    fsm.update(input({ crouch: true, forward: -1 }), 1 / 60);
    assert.equal(fsm.current, 'guardLow');
    assert.equal(fsm.getWalkVelocity().forward, 0);
    assert.equal(fsm.processIncomingHit(strike('low')).blocked, true);
    assert.equal(fsm.processIncomingHit(strike('high')).whiffed, true);
    const mid = fsm.processIncomingHit(strike('mid'));
    assert.equal(mid.blocked, false);
    assert.equal(mid.whiffed, false);
  });

  it('still treats down-forward as a standing walk, so a high connects', () => {
    const fsm = new FighterStateMachine();
    fsm.update(input({ crouch: true, forward: 1 }), 1 / 60);
    assert.notEqual(fsm.current, 'crouch');
    assert.notEqual(fsm.current, 'guardLow');
    const high = fsm.processIncomingHit(strike('high'));
    assert.equal(high.whiffed, false);
    assert.equal(high.blocked, false);
  });

  it('does not let a backdash block', () => {
    const fsm = new FighterStateMachine();
    fsm.update(input({ backdashing: true, forward: -1 }), 1 / 60);
    assert.equal(fsm.action, 'Backdashing');
    assert.equal(fsm.processIncomingHit(strike('mid')).blocked, false);
  });

  it('does not let a jump block or duck', () => {
    const fsm = new FighterStateMachine();
    fsm.update(input({ jump: true, forward: -1 }), 1 / 60);
    assert.equal(fsm.action, 'Jumping');
    const high = fsm.processIncomingHit(strike('high'));
    assert.equal(high.blocked, false);
    assert.equal(high.whiffed, false);
  });

  it('lets a throw and an unblockable through a standing block', () => {
    const fsm = new FighterStateMachine();
    for (let i = 0; i < 10; i++) fsm.update(input({ forward: -1 }), 1 / 60);
    const thrown = fsm.processIncomingHit(strike('mid', { isThrow: true }));
    const raw = fsm.processIncomingHit(strike('mid', { isUnblockable: true }));
    assert.equal(thrown.blocked, false);
    assert.equal(thrown.guardBroken, true);
    assert.equal(raw.blocked, false);
    assert.equal(raw.guardBroken, true);
  });

  it('keeps the dedicated guard button as a standing plant', () => {
    const fsm = new FighterStateMachine();
    fsm.update(input({ guard: true }), 1 / 60);
    assert.equal(fsm.action, 'Guard');
    assert.equal(fsm.getWalkVelocity().forward, 0);
    assert.equal(fsm.processIncomingHit(strike('mid')).blocked, true);
    assert.equal(fsm.processIncomingHit(strike('low')).blocked, false);
  });

  it('treats the standing jab as a high and the standing kick as a mid', () => {
    const fsm = new FighterStateMachine();
    fsm.update(input({ crouch: true }), 1 / 60);
    assert.equal(fsm.processIncomingHit(DEFAULT_MOVE_WINDOWS.lightAttack).whiffed, true);
    assert.equal(fsm.processIncomingHit(DEFAULT_MOVE_WINDOWS.heavyAttack).whiffed, true);
    const kick = fsm.processIncomingHit(DEFAULT_MOVE_WINDOWS.lightKick);
    assert.equal(kick.whiffed, false);
    assert.equal(kick.blocked, false, 'a standing kick is a mid, so a crouch does not beat it');
  });
});
