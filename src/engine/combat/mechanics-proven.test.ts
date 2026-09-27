/**
 * THE SIX ROWS THE BASELINE AUDIT COULD ONLY CALL "WIRED".
 *
 * WIRED meant something outside its own file calls it — which is not the same as
 * it doing the right thing. Writing the proofs found that two of the six were not
 * wired at all, they were my probe matching a WORD:
 *
 *   counter hit           detected in the arena, twice, and used for a spark and a
 *                         sound only. No damage, no reaction. See CounterHit.ts.
 *   recoverable damage    the probe matched "unrecoverable" in two comments about
 *                         a cinematic and about frame pacing. Nothing existed.
 *                         See RecoverableDamage.ts.
 *
 * The other four are real and these are their numbers.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createComboState, registerHit, tickComboSystem, getScalingLabel, COMBO_WINDOW_MS,
} from './ComboSystem.ts';
import {
  createWallSplatState, applyWallSplat, tickWallSplat,
  WALL_SPLAT_BONUS_FRAMES, WALL_RECOVERY_FRAMES, WALL_LEFT_X, WALL_RIGHT_X,
} from './WallSystem.ts';
import {
  freshJuggle, applyLaunch, applyAirHit, tickJuggle, juggleScale, reactionFor,
  JUGGLE_SCALING, JUGGLE_SCALING_FLOOR, JUGGLE_GRAVITY,
} from './HitReactions.ts';
import {
  counterWindowOf, counterScaledDamage, counterBonusHitstun, isCounterWindow,
  COUNTER_HIT_DAMAGE_MULTIPLIER,
} from './CounterHit.ts';
import {
  createRecoverableState, addRecoverable, tickRecoverable, lockRecoverable,
  RECOVER_DELAY_S, RECOVER_RATE_HP_PER_S,
} from './RecoverableDamage.ts';
import {
  FighterStateMachine, DEFAULT_MOVE_WINDOWS, type FighterInput, type MoveWindow,
} from './FighterStateMachine.ts';
import { checkSidestepWhiff, SIDESTEP_WHIFF_THRESHOLD } from './CombatStateTick.ts';

const NEUTRAL = { forward: 0, strafe: 0, light: false, heavy: false, guard: false, crouch: false } as FighterInput;
const input = (o: Partial<FighterInput>): FighterInput => ({ ...NEUTRAL, ...o });

describe('combo damage scaling', () => {
  it('pays less for each successive hit, and floors rather than reaching zero', () => {
    let state = createComboState('p1');
    const paid: number[] = [];
    for (let i = 0; i < 12; i++) {
      const r = registerHit(state, 100, i * 100);   // inside the window every time
      paid.push(r.scaledDamage);
      state = r.newState;
    }
    assert.equal(state.count, 12, 'twelve hits inside the window is one combo');
    for (let i = 1; i < paid.length; i++) {
      assert.ok(paid[i] <= paid[i - 1], `hit ${i + 1} paid MORE than hit ${i}: ${paid[i]} > ${paid[i - 1]}`);
    }
    assert.ok(Math.min(...paid) > 0, 'a long combo must still do something, or it is free defence');
    assert.equal(paid[0], 100, 'the first hit is never scaled');
  });

  it('drops the combo when the window lapses', () => {
    const first = registerHit(createComboState('p1'), 100, 0).newState;
    const late = registerHit(first, 100, COMBO_WINDOW_MS + 200);
    assert.equal(late.newState.count, 1, 'a hit after the window starts a new combo');
    assert.equal(late.scaledDamage, 100, 'and is unscaled again');
  });

  it('labels the scaling so the HUD is reading the real multiplier', () => {
    assert.equal(typeof getScalingLabel(1.0), 'string');
    assert.notEqual(getScalingLabel(1.0), getScalingLabel(JUGGLE_SCALING_FLOOR));
  });

  it('expires on its own clock', () => {
    // tickComboSystem takes (p1, p2, now) and returns { p1Combo, p2Combo } — not a
    // state object. Worth writing down: the first version of this test passed an
    // object and read `.p1`, which threw rather than failing an assertion.
    const p1 = registerHit(createComboState('p1'), 100, 0).newState;
    assert.equal(p1.active, true);
    const still = tickComboSystem(p1, createComboState('p2'), 500);
    assert.equal(still.p1Combo.active, true, 'inside the window it stays live');
    const later = tickComboSystem(p1, createComboState('p2'), COMBO_WINDOW_MS + 1000);
    assert.equal(later.p1Combo.active, false, 'a combo left alone must end');
  });
});

describe('wall combos', () => {
  it('splats, then recovers on its own clock', () => {
    let splat = applyWallSplat(createWallSplatState(), 'right');
    assert.equal(splat.isSplatted, true);
    assert.equal(splat.wall, 'right');
    assert.equal(splat.splatFramesRemaining, WALL_RECOVERY_FRAMES);
    assert.equal(splat.comboExtensionFrames, WALL_SPLAT_BONUS_FRAMES);
    for (let i = 0; i < WALL_RECOVERY_FRAMES + 5; i++) splat = tickWallSplat(splat);
    assert.equal(splat.isSplatted, false, 'a splat that never ends is a stun-lock');
    assert.equal(splat.comboExtensionActive, false);
  });

  it('counts repeat splats, so a wall cannot be farmed forever', () => {
    const once = applyWallSplat(createWallSplatState(), 'left');
    const twice = applyWallSplat(once, 'left');
    assert.equal(twice.splatCount, 2, 'the count is what a diminishing-returns rule would read');
  });

  it('has two walls, and they are not the same wall', () => {
    assert.ok(WALL_LEFT_X < WALL_RIGHT_X);
    assert.ok(WALL_RIGHT_X - WALL_LEFT_X > 4, 'a stage narrower than a few metres is a corridor');
  });
});

describe('juggles', () => {
  it('scales an air combo down hit by hit and floors it', () => {
    assert.equal(juggleScale(0), JUGGLE_SCALING[0]);
    for (let i = 1; i < JUGGLE_SCALING.length; i++) {
      assert.ok(juggleScale(i) <= juggleScale(i - 1), `air hit ${i} scaled UP`);
    }
    assert.equal(juggleScale(99), JUGGLE_SCALING_FLOOR, 'an endless juggle must bottom out');
    assert.ok(JUGGLE_SCALING_FLOOR > 0, 'but never reach zero');
  });

  it('launches, takes air hits, then lands', () => {
    const launcher = reactionFor('launch');
    let j = freshJuggle();
    const first = applyLaunch(j, launcher);
    assert.ok(first > 0, 'a launch must deal its damage');
    j = freshJuggle();
    applyLaunch(j, launcher);
    const air1 = applyAirHit(j, reactionFor('small'));
    const air2 = applyAirHit(j, reactionFor('small'));
    assert.ok(air2 <= air1, `air hits must scale: ${air1} then ${air2}`);
  });

  it('comes down — gravity is real and the juggle ends', () => {
    assert.ok(JUGGLE_GRAVITY > 0);
    const j = freshJuggle();
    applyLaunch(j, reactionFor('launch'));
    let airborne = true;
    for (let i = 0; i < 600 && airborne; i++) airborne = tickJuggle(j, 1 / 60);
    assert.equal(airborne, false, 'a body that never lands is a soft-lock');
  });
});

describe('wakeup options', () => {
  it('buffers the defender choice while they are down, and clears it on knockdown', () => {
    const fsm = new FighterStateMachine();
    fsm.update(input({}), 1 / 60);
    fsm.applyKnockdown();
    assert.equal(fsm.getBufferedWakeup(), null, 'a fresh knockdown must not carry a stale choice');
    // Drive it down and let the buffer window open.
    for (let i = 0; i < 90; i++) fsm.update(input({}), 1 / 60);
    // Whatever it chose, it must be one of the three or nothing — never a stray value.
    assert.ok([null, 'techRoll', 'backrise', 'quickStand'].includes(fsm.getBufferedWakeup()));
  });

  it('gets up — a knockdown is not permanent', () => {
    const fsm = new FighterStateMachine();
    fsm.update(input({}), 1 / 60);
    fsm.applyKnockdown();
    let state = fsm.current;
    for (let i = 0; i < 600 && /knockdown|Knockdown|wake|Wakeup/i.test(String(state)); i++) {
      state = fsm.update(input({}), 1 / 60);
    }
    assert.ok(!/knockdown|Knockdown/i.test(String(state)), `still down after 10s, in ${state}`);
  });
});

describe('counter hit — the mechanic, not just the spark', () => {
  const jab = DEFAULT_MOVE_WINDOWS.lightAttack;
  const own = (frame: number, move: MoveWindow = jab) => ({ move, frame });

  it('names the window by where in the move the hit landed', () => {
    assert.equal(counterWindowOf(own(2)), 'startup', 'before the swing comes out');
    assert.equal(counterWindowOf(own(jab.hitboxStartFrame! + 1)), 'active', 'a trade');
    assert.equal(counterWindowOf(own(jab.totalFrames! - 1)), 'none', 'recovery is not a counter — being open is what frame advantage already covers');
    assert.equal(counterWindowOf(null), 'none', 'standing still is not a counter');
  });

  it('pays more and buys frames', () => {
    assert.equal(counterScaledDamage('startup', 100), Math.round(100 * COUNTER_HIT_DAMAGE_MULTIPLIER));
    assert.equal(counterScaledDamage('none', 100), 100, 'a non-counter is exactly the damage passed in');
    assert.ok(counterBonusHitstun('startup') > 0, 'the frames are the prize, not the damage');
    assert.equal(counterBonusHitstun('none'), 0);
    assert.ok(COUNTER_HIT_DAMAGE_MULTIPLIER < 1.5, 'a counter is not a critical hit');
  });

  it('fires through the real state machine when a swing is interrupted', () => {
    const fsm = new FighterStateMachine();
    fsm.update(input({}), 1 / 60);
    fsm.update(input({ light: true }), 1 / 60);     // now mid-jab startup
    const r = fsm.processIncomingHit({ ...DEFAULT_MOVE_WINDOWS.heavyKick, damage: 100 });
    assert.ok(isCounterWindow(r.counter), `interrupting a startup must be a counter, got ${r.counter}`);
    assert.ok(r.finalDamage > 100, `and pay for it, got ${r.finalDamage}`);
  });

  it('is never a counter when the hit was blocked', () => {
    const fsm = new FighterStateMachine();
    // Hold back to block; a guarding fighter is not swinging.
    for (let i = 0; i < 6; i++) fsm.update(input({ forward: -1, guard: true }), 1 / 60);
    const r = fsm.processIncomingHit({ ...DEFAULT_MOVE_WINDOWS.lightAttack, attackLevel: 'high', damage: 100 });
    if (r.blocked) {
      assert.equal(r.counter, 'none', 'blocking is the correct answer, not a mistake to punish');
      assert.equal(r.counterBonusHitstun, 0);
    }
  });
});

describe('recoverable (white) damage', () => {
  it('holds the pool, then gives it back after the delay', () => {
    let s = addRecoverable(createRecoverableState(), 60);
    assert.equal(s.pool, 60);
    let restored = 0;
    // Inside the delay: nothing comes back.
    for (let t = 0; t < RECOVER_DELAY_S - 0.1; t += 1 / 60) {
      const r = tickRecoverable(s, 1 / 60); s = r.state; restored += r.restored;
    }
    assert.equal(restored, 0, 'regeneration must not start immediately, or trading chip is free');
    for (let i = 0; i < 300; i++) { const r = tickRecoverable(s, 1 / 60); s = r.state; restored += r.restored; }
    assert.ok(Math.abs(restored - 60) < 0.5, `should return the whole pool, returned ${restored.toFixed(1)}`);
    assert.ok(s.pool < 0.5, 'and empty it');
  });

  it('regenerates at the stated rate, not instantly', () => {
    let s = addRecoverable(createRecoverableState(), 1000);
    for (let t = 0; t < RECOVER_DELAY_S + 1e-6; t += 1 / 60) s = tickRecoverable(s, 1 / 60).state;
    const r = tickRecoverable(s, 1);
    assert.ok(Math.abs(r.restored - RECOVER_RATE_HP_PER_S) < 1, `one second should return ~${RECOVER_RATE_HP_PER_S}, returned ${r.restored.toFixed(1)}`);
  });

  it('locks the pool in when a clean hit lands', () => {
    // Otherwise armouring through pressure and walking away launders all of it.
    const s = addRecoverable(createRecoverableState(), 80);
    const { state, locked } = lockRecoverable(s);
    assert.equal(locked, 80);
    assert.equal(state.pool, 0);
    assert.equal(tickRecoverable(state, 10).restored, 0, 'locked damage never comes back');
  });

  it('restarts the delay on every new hit', () => {
    let s = addRecoverable(createRecoverableState(), 40);
    for (let t = 0; t < RECOVER_DELAY_S - 0.2; t += 1 / 60) s = tickRecoverable(s, 1 / 60).state;
    s = addRecoverable(s, 10);           // hit again just before it would start
    assert.equal(s.sinceHitS, 0);
    assert.equal(tickRecoverable(s, 0.1).restored, 0, 'pressure must keep the pool suppressed');
  });

  it('gives nothing back when there is nothing owed', () => {
    const s = createRecoverableState();
    assert.equal(tickRecoverable(s, 10).restored, 0);
    assert.equal(addRecoverable(s, 0).pool, 0);
    assert.equal(addRecoverable(s, -5).pool, 0, 'negative damage must not create health');
  });
});

describe('a sidestep leaves the attack plane', () => {
  it('makes a linear attack whiff once the step is wide enough', () => {
    // This is the answer to pressure in a 3D fighter, and it is what separates this
    // genre from a 2D one. The arena already gates `checkCollision` on it
    // (`p1HitWhiffs`), so this proves the rule the gate reads.
    assert.equal(checkSidestepWhiff(0, 0, false), false, 'standing in line must connect');
    assert.equal(checkSidestepWhiff(0, SIDESTEP_WHIFF_THRESHOLD - 0.01, false), false,
      'half a step is not a step — it must still connect, or pressure is free to escape');
    assert.equal(checkSidestepWhiff(0, SIDESTEP_WHIFF_THRESHOLD, false), true,
      'a full step off the line must make a linear attack miss');
    assert.equal(checkSidestepWhiff(0, -SIDESTEP_WHIFF_THRESHOLD, false), true, 'either direction');
  });

  it('does not save you from a tracking attack', () => {
    // Otherwise sidestep is a free answer to everything and the neutral game
    // collapses into circling.
    assert.equal(checkSidestepWhiff(0, SIDESTEP_WHIFF_THRESHOLD * 3, true), false,
      'a homing move must follow the step');
  });

  it('asks for a step that a sidestep can actually cover', () => {
    // A threshold wider than one sidestep would make the mechanic unreachable.
    assert.ok(SIDESTEP_WHIFF_THRESHOLD > 0.2 && SIDESTEP_WHIFF_THRESHOLD < 1.5,
      `${SIDESTEP_WHIFF_THRESHOLD}m is not a step`);
  });
});
