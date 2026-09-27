/**
 * RAGE, LOW PARRY AND ARMOUR — the three the baseline audit called declared and
 * dead, now measured.
 *
 * The design is ported from SchwarzerblitzEngine, which was cloned and read.
 * `FK_Character::hasArmor(type)` asks the MOVE, at the CURRENT FRAME, about a
 * SPECIFIC ATTACK TYPE, with the windows stored on the move (`armorFrames`,
 * `invincibilityFrames`) and coverage as a bitmask of attack types. Copying that
 * shape is what collapses power crush, Rage Art invincibility and low parry into
 * ONE mechanism instead of the three half-systems that were here.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveDefensiveWindows, windowOpen,
  powerCrushWindow, rageArtWindow, lowParryWindow,
  HIGH_AND_MID_ATKS, LOW_ATKS, ALL_ATKS, NO_TYPE,
  type DefensiveWindow,
} from './DefensiveWindows.ts';
import {
  createRageState, tickRage, rageScaledDamage, rageArtAvailable, spendRageArt,
  resetRageForRound, rageArtDefence,
  RAGE_THRESHOLD, RAGE_DAMAGE_MULTIPLIER, RAGE_ART_DAMAGE, RAGE_ART_STARTUP_FRAMES,
} from './RageSystem.ts';
import {
  FINISHER_HP_THRESHOLD, FINISHER_DAMAGE, FINISHER_STARTUP_FRAMES,
} from './OverdriveSystem.ts';
import { WALL_SPLAT_BONUS_FRAMES } from './WallSystem.ts';
import {
  createComboState, registerHit, COMBO_WINDOW_MS, WALL_SPLAT_COMBO_EXTENSION_MS,
} from './ComboSystem.ts';
import {
  resolveTekkenContact, LOW_PARRY_ATTACKER_STAGGER_S,
  FighterStateMachine, DEFAULT_MOVE_WINDOWS,
  type TekkenGuardStance, type FighterInput,
} from './FighterStateMachine.ts';

const NEUTRAL: FighterInput = {
  forward: 0, strafe: 0, light: false, heavy: false, guard: false, crouch: false,
} as FighterInput;
const input = (over: Partial<FighterInput>): FighterInput => ({ ...NEUTRAL, ...over });

const stance = (over: Partial<TekkenGuardStance> = {}): TekkenGuardStance => ({
  standingBlock: false, crouchBlock: false, crouching: false, lowParryIntent: false, ...over,
});

describe('defensive windows, per frame and per attack height', () => {
  it('a power crush absorbs a high and a mid but NOT a low', () => {
    const w = [powerCrushWindow(15)];
    assert.equal(resolveDefensiveWindows(w, 8, 'high', 100).outcome, 'armoured');
    assert.equal(resolveDefensiveWindows(w, 8, 'mid', 100).outcome, 'armoured');
    assert.equal(resolveDefensiveWindows(w, 8, 'low', 100).outcome, 'none',
      'a low going under a power crush is the documented rule and the whole counterplay');
  });

  it('armour still takes a bleed, so it is not strictly better than blocking', () => {
    const hit = resolveDefensiveWindows([powerCrushWindow(15, 0.15)], 8, 'mid', 200);
    assert.ok(hit.damage > 0 && hit.damage < 200, `bleed should be a fraction, took ${hit.damage} of 200`);
    assert.ok(hit.absorbed, 'and the body keeps coming');
  });

  it('is closed outside its own frames', () => {
    const w = [powerCrushWindow(15)];
    assert.equal(resolveDefensiveWindows(w, 16, 'mid', 100).outcome, 'none', 'closed after the startup ends');
    assert.equal(resolveDefensiveWindows(w, 0, 'mid', 100).outcome, 'armoured',
      'frame 0 IS the first frame of the move, and a trade is most likely there');
    assert.ok(windowOpen(w, 8, 'armour'));
    assert.ok(!windowOpen(w, 40, 'armour'));
  });

  it('lets a throw through armour AND invincibility', () => {
    // Schwarzerblitz's own first line is `if (isBeingThrown()) return false;`.
    // Without it an armoured move is a free win.
    for (const w of [[powerCrushWindow(15)], rageArtDefence()]) {
      const hit = resolveDefensiveWindows(w, 5, 'mid', 150, true);
      assert.equal(hit.outcome, 'none', 'a throw must beat armour');
      assert.equal(hit.damage, 150);
    }
  });

  it('takes nothing at all under invincibility, at every height', () => {
    for (const level of ['high', 'mid', 'low'] as const) {
      const hit = resolveDefensiveWindows(rageArtDefence(), 5, level, 300);
      assert.equal(hit.outcome, 'invincible', `${level} should be beaten by a Rage Art startup`);
      assert.equal(hit.damage, 0);
    }
  });

  it('prefers invincibility when two windows overlap', () => {
    const both: DefensiveWindow[] = [powerCrushWindow(15), rageArtWindow(15)];
    assert.equal(resolveDefensiveWindows(both, 8, 'mid', 100).outcome, 'invincible');
  });

  it('a low parry window beats lows and nothing else', () => {
    const w = [lowParryWindow(1, 12)];
    assert.equal(resolveDefensiveWindows(w, 6, 'low', 100).outcome, 'invincible');
    assert.equal(resolveDefensiveWindows(w, 6, 'mid', 100).outcome, 'none');
    assert.equal(resolveDefensiveWindows(w, 6, 'high', 100).outcome, 'none');
  });

  it('names the coverage sets the reference declares', () => {
    assert.deepEqual([...HIGH_AND_MID_ATKS].sort(), ['high', 'mid']);
    assert.deepEqual([...LOW_ATKS], ['low']);
    assert.equal(ALL_ATKS.size, 3);
    assert.equal(NO_TYPE.size, 0);
  });

  it('does nothing when a move declares no windows', () => {
    assert.equal(resolveDefensiveWindows(undefined, 5, 'mid', 100).outcome, 'none');
    assert.equal(resolveDefensiveWindows([], 5, 'mid', 100).damage, 100);
  });
});

describe('rage', () => {
  it('is built on the Finisher constants rather than beside them', () => {
    // The standing rule across these projects: never build a second modifier
    // system next to the real one. If these drift apart, two systems exist.
    assert.equal(RAGE_THRESHOLD, FINISHER_HP_THRESHOLD);
    assert.equal(RAGE_ART_DAMAGE, FINISHER_DAMAGE);
    assert.equal(RAGE_ART_STARTUP_FRAMES, FINISHER_STARTUP_FRAMES);
  });

  it('switches on under the threshold and not above it', () => {
    let r = createRageState();
    r = tickRage(r, 100, 100);
    assert.equal(r.enraged, false);
    r = tickRage(r, 24, 100);
    assert.equal(r.enraged, true);
    assert.equal(r.justEntered, true, 'the entry frame is flagged once so presentation can fire');
    r = tickRage(r, 20, 100);
    assert.equal(r.justEntered, false, 'and only once');
  });

  it('is not enraged when dead', () => {
    assert.equal(tickRage(createRageState(), 0, 100).enraged, false);
  });

  it('scales outgoing damage, but only a nudge', () => {
    const enraged = tickRage(createRageState(), 20, 100);
    const calm = tickRage(createRageState(), 90, 100);
    assert.equal(rageScaledDamage(calm, 100), 100, 'not enraged must be exactly the damage passed in');
    assert.ok(rageScaledDamage(enraged, 100) > 100);
    assert.ok(RAGE_DAMAGE_MULTIPLIER < 1.3, 'a comeback bonus that swings a round on its own is the game deciding the match');
  });

  it('gives one Rage Art, and healing does not give a second', () => {
    let r = tickRage(createRageState(), 20, 100);
    assert.ok(rageArtAvailable(r));
    r = spendRageArt(r);
    assert.equal(rageArtAvailable(r), false);
    r = tickRage(r, 90, 100);   // healed out of rage
    r = tickRage(r, 20, 100);   // and back down again
    assert.equal(r.enraged, true);
    assert.equal(rageArtAvailable(r), false, 'the art is spent, and only a new round returns it');
    assert.ok(rageArtAvailable(tickRage(resetRageForRound(), 20, 100)));
  });

  it('cannot spend a Rage Art at full health', () => {
    assert.equal(rageArtAvailable(tickRage(createRageState(), 100, 100)), false);
  });
});

describe('the low parry, through the real contact resolution', () => {
  it('parries a low when down-forward is held', () => {
    assert.equal(resolveTekkenContact('low', stance({ lowParryIntent: true })), 'parry');
  });

  it('eats a mid and a high for reaching', () => {
    // This asymmetry IS the mechanic. Down-forward does not block.
    assert.equal(resolveTekkenContact('mid', stance({ lowParryIntent: true })), 'hit');
    assert.equal(resolveTekkenContact('high', stance({ lowParryIntent: true })), 'hit');
  });

  it('beats a crouch block rather than falling back to it', () => {
    const both = stance({ lowParryIntent: true, crouchBlock: true, crouching: true });
    assert.equal(resolveTekkenContact('low', both), 'parry', 'the parry must win, or holding down-back would shadow it');
  });

  it('leaves the attacker worse off than a block does', () => {
    assert.ok(LOW_PARRY_ATTACKER_STAGGER_S > 0.3,
      `a parried attacker must be wide open, is ${LOW_PARRY_ATTACKER_STAGGER_S}s`);
  });

  it('does not fire on a low when nothing is reaching for it', () => {
    assert.equal(resolveTekkenContact('low', stance()), 'hit');
    assert.equal(resolveTekkenContact('low', stance({ crouchBlock: true, crouching: true })), 'block');
  });
});

describe('armour through the real state machine, not just the resolver', () => {
  it('makes the heavy punch a power crush while its startup runs', () => {
    // The defender is mid-heavy-punch; the attacker pokes them. The armour is on
    // the DEFENDER's own move, indexed by the DEFENDER's own frame.
    const fsm = new FighterStateMachine();
    fsm.update(input({}), 1 / 60);
    fsm.update(input({ heavy: true }), 1 / 60);
    const own = fsm.ownMoveFrame();
    assert.ok(own, 'the fighter should be mid-move after pressing heavy');
    assert.equal(own!.move.animation, 'heavyAttack');
    assert.ok(own!.move.defence?.length, 'the heavy punch must carry a power crush window');

    const poke = { ...DEFAULT_MOVE_WINDOWS.lightAttack, attackLevel: 'mid' as const, damage: 100 };
    const r = fsm.processIncomingHit(poke);
    assert.equal(r.armoured, 'armoured', `a mid into a power crush should be absorbed, got ${r.armoured}`);
    assert.ok(r.finalDamage > 0 && r.finalDamage < 100, `and bleed, took ${r.finalDamage}`);
    assert.equal(r.blocked, false, 'armour is not a block — the body keeps attacking');
  });

  it('lets a LOW through the power crush', () => {
    const fsm = new FighterStateMachine();
    fsm.update(input({}), 1 / 60);
    fsm.update(input({ heavy: true }), 1 / 60);
    const low = { ...DEFAULT_MOVE_WINDOWS.lightAttack, attackLevel: 'low' as const, damage: 100 };
    const r = fsm.processIncomingHit(low);
    assert.notEqual(r.armoured, 'armoured', 'a low under a power crush is the counterplay');
    assert.equal(r.finalDamage, 100);
  });

  it('carries no armour when standing still', () => {
    const fsm = new FighterStateMachine();
    fsm.update(input({}), 1 / 60);
    assert.equal(fsm.ownMoveFrame(), null);
    const r = fsm.processIncomingHit({ ...DEFAULT_MOVE_WINDOWS.lightAttack, attackLevel: 'mid', damage: 100 });
    assert.notEqual(r.armoured, 'armoured');
  });

  it('lets a throw through the power crush', () => {
    const fsm = new FighterStateMachine();
    fsm.update(input({}), 1 / 60);
    fsm.update(input({ heavy: true }), 1 / 60);
    const grab = { ...DEFAULT_MOVE_WINDOWS.lightAttack, attackLevel: 'mid' as const, damage: 100, isThrow: true };
    const r = fsm.processIncomingHit(grab);
    assert.equal(r.guardBroken, true, 'a throw beats armour — that is what keeps armour honest');
    assert.notEqual(r.armoured, 'armoured');
  });
});

describe('a wall splat buys the attacker frames', () => {
  it('extends the combo window by the frames WallSystem declares', () => {
    // WALL_SPLAT_BONUS_FRAMES = 18, "extra frames attacker gets to chain combo",
    // was written into every splat and read by nobody. A wall carry that buys no
    // frames is scenery.
    assert.ok(WALL_SPLAT_COMBO_EXTENSION_MS > 0);
    assert.equal(Math.round(WALL_SPLAT_COMBO_EXTENSION_MS), Math.round((WALL_SPLAT_BONUS_FRAMES / 60) * 1000),
      'derived from the constant, not declared beside it');

    const start = createComboState('p1');
    const first = registerHit(start, 100, 0).newState;
    // A gap LONGER than the normal window but inside the extension.
    const late = COMBO_WINDOW_MS + WALL_SPLAT_COMBO_EXTENSION_MS / 2;
    assert.equal(registerHit(first, 100, late, 0).newState.count, 1,
      'with no splat, a late hit starts a new combo');
    assert.equal(registerHit(first, 100, late, WALL_SPLAT_BONUS_FRAMES).newState.count, 2,
      'against a splatted opponent the same hit continues the combo');
  });

  it('changes nothing when no splat is open', () => {
    const first = registerHit(createComboState('p1'), 100, 0).newState;
    const inWindow = registerHit(first, 100, 500, 0);
    const inWindowSplat = registerHit(first, 100, 500, 0);
    assert.deepEqual(inWindow.newState, inWindowSplat.newState);
    assert.equal(registerHit(first, 100, COMBO_WINDOW_MS + 5000, 0).newState.count, 1);
  });
});
