// `.ts` extensions on purpose — the repo's runner resolves them literally.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  JUGGLE_GRAVITY, JUGGLE_SCALING_FLOOR, allLaunchers, allThrows, applyAirHit,
  applyLaunch, freshJuggle, juggleScale, moveIsAvailable, movePropertiesOf,
  reactionFor, tickJuggle,
} from './HitReactions.ts';

describe('hit reactions read off the imported Schwarzerblitz data', () => {
  it('finds the launchers that were shipped and never read', () => {
    const launchers = allLaunchers();
    assert.ok(launchers.length >= 20, `expected the 20+ Flight moves, got ${launchers.length}`);
  });

  it('finds the throws — the capture grapples', () => {
    assert.ok(allThrows().length >= 5, 'the Throw-height moves are the grapple material');
  });

  it('maps Flight to a launch and Weak hits to stagger', () => {
    assert.equal(reactionFor('Flight').kind, 'launch');
    assert.ok(reactionFor('Flight').launchY > 0);
    assert.equal(reactionFor('WeakMid').kind, 'hitstun');
    assert.equal(reactionFor('StrongMid').kind, 'crumple');
    assert.equal(reactionFor('Smackdown').kind, 'smackdown');
    assert.ok(reactionFor('Smackdown').launchY < 0, 'a smackdown drives DOWN');
    assert.equal(reactionFor('None').kind, 'none');
  });

  it('falls back rather than throwing on a reaction it has never seen', () => {
    assert.equal(reactionFor('SomethingNew').kind, 'hitstun');
    assert.equal(reactionFor(undefined).kind, 'hitstun');
  });
});

describe('the juggle', () => {
  it('a launcher puts the body in the air and gravity brings it down', () => {
    const j = freshJuggle();
    applyLaunch(j, reactionFor('Flight'));
    assert.equal(j.airborne, true);
    assert.ok(j.vy > 0);

    let landed = false;
    let t = 0;
    for (let i = 0; i < 600 && !landed; i++) { landed = tickJuggle(j, 1 / 60); t += 1 / 60; }
    assert.ok(landed, 'the body never came down');
    assert.equal(j.airborne, false);
    assert.equal(j.y, 0);
    // A juggle has to be long enough to combo in and short enough to read.
    assert.ok(t > 0.3 && t < 1.6, `airborne for ${t.toFixed(2)}s`);
  });

  it('scales damage down across the string, and never to nothing', () => {
    assert.equal(juggleScale(0), 1);
    assert.ok(juggleScale(1) < juggleScale(0));
    assert.ok(juggleScale(4) < juggleScale(1));
    assert.equal(juggleScale(99), JUGGLE_SCALING_FLOOR);
    assert.ok(JUGGLE_SCALING_FLOOR > 0, 'a long combo must still do something');
  });

  it('IS NOT AN INFINITE — re-launching tops up, it does not reset', () => {
    const j = freshJuggle();
    applyLaunch(j, reactionFor('Flight'));
    const firstVy = j.vy;
    for (let i = 0; i < 20; i++) tickJuggle(j, 1 / 60);
    applyLaunch(j, reactionFor('Flight'));
    assert.ok(j.vy < firstVy, 'a re-launch restored full height, so the juggle never ends');

    // And it does still land, however many times it is re-launched.
    let landed = false;
    for (let i = 0; i < 2000 && !landed; i++) {
      landed = tickJuggle(j, 1 / 60);
      if (i % 30 === 0 && !landed) applyLaunch(j, reactionFor('Flight'));
    }
    assert.ok(landed, 'repeated re-launches kept the body up forever');
  });

  it('a smackdown drives an airborne body straight down', () => {
    const j = freshJuggle();
    applyLaunch(j, reactionFor('Flight'));
    for (let i = 0; i < 5; i++) tickJuggle(j, 1 / 60);
    const before = j.y;
    applyAirHit(j, reactionFor('Smackdown'));
    assert.ok(j.vy < 0, 'a smackdown must send them down, not up');
    tickJuggle(j, 1 / 60);
    assert.ok(j.y < before, 'the body did not move downward');
  });

  it('an air hit on a grounded fighter does nothing and scales nothing', () => {
    const j = freshJuggle();
    assert.equal(applyAirHit(j, reactionFor('WeakMid')), 1);
    assert.equal(j.airborne, false);
  });

  it('gravity is heavier than the real thing, on purpose', () => {
    assert.ok(JUGGLE_GRAVITY > 9.81, 'a realistic arc hangs too long to read as a fight');
  });
});

describe('move availability — three rules the graph states and the engine ignored', () => {
  const base = { reactions: [], launches: false, isThrow: false, followupOnly: false };

  it('a ground-only move refuses a standing opponent', () => {
    const p = { ...base, groundOnly: true, antiAirOnly: false, counterOnly: false };
    assert.equal(moveIsAvailable(p, { opponentGrounded: false, opponentAirborne: false, opponentAttacking: false }), false);
    assert.equal(moveIsAvailable(p, { opponentGrounded: true, opponentAirborne: false, opponentAttacking: false }), true);
  });

  it('an anti-air refuses a grounded opponent', () => {
    const p = { ...base, groundOnly: false, antiAirOnly: true, counterOnly: false };
    assert.equal(moveIsAvailable(p, { opponentGrounded: true, opponentAirborne: false, opponentAttacking: false }), false);
    assert.equal(moveIsAvailable(p, { opponentGrounded: false, opponentAirborne: true, opponentAttacking: false }), true);
  });

  it('a counter only comes out against an attack', () => {
    const p = { ...base, groundOnly: false, antiAirOnly: false, counterOnly: true };
    assert.equal(moveIsAvailable(p, { opponentGrounded: true, opponentAirborne: false, opponentAttacking: false }), false);
    assert.equal(moveIsAvailable(p, { opponentGrounded: true, opponentAirborne: false, opponentAttacking: true }), true);
  });
});

describe('reading a real move out of the graph', () => {
  it('returns properties for a move that exists, and null for one that does not', () => {
    const launcher = allLaunchers()[0];
    const props = movePropertiesOf(launcher.set, launcher.move);
    assert.ok(props, `${launcher.set}/${launcher.move} did not resolve`);
    assert.equal(props.launches, true, 'a move found BY its launch reaction must report launching');
    assert.equal(movePropertiesOf('chara_tutor', '__no_such_move__'), null);
  });

  it('a throw is marked as a throw', () => {
    const t = allThrows()[0];
    const props = movePropertiesOf(t.set, t.move);
    assert.ok(props?.isThrow, `${t.set}/${t.move} has a Throw hitbox and did not report one`);
  });
});

describe('the state machine actually juggles', () => {
  it('a launcher puts the fighter in Juggled and gravity lands them in Knockdown', async () => {
    const { FighterStateMachine } = await import('./FighterStateMachine.ts');
    const fsm = new FighterStateMachine();
    assert.equal(fsm.isAirborne, false);

    fsm.applyReaction('Flight');
    assert.equal(fsm.isAirborne, true, 'a Flight reaction did not launch');
    assert.equal(fsm.actionState, 'Juggled');
    assert.ok(fsm.juggleHeight >= 0);

    let landed = false;
    for (let i = 0; i < 600 && !landed; i++) landed = fsm.tickAirborne(1 / 60);
    assert.ok(landed, 'the fighter never came down');
    assert.equal(fsm.isAirborne, false);
    assert.equal(fsm.actionState, 'Knockdown', 'a juggle must END on the mat, not standing');
  });

  it('scales damage down as the string goes on, and resets after landing', async () => {
    const { FighterStateMachine } = await import('./FighterStateMachine.ts');
    const fsm = new FighterStateMachine();
    assert.equal(fsm.juggleDamageScale(), 1, 'a grounded fighter takes full damage');

    fsm.applyReaction('Flight');
    const first = fsm.juggleDamageScale();
    fsm.applyReaction('WeakMid');
    const second = fsm.juggleDamageScale();
    assert.ok(second < first, `combo scaling did not apply: ${first} -> ${second}`);

    let landed = false;
    for (let i = 0; i < 600 && !landed; i++) landed = fsm.tickAirborne(1 / 60);
    assert.equal(fsm.juggleDamageScale(), 1, 'scaling did not reset after landing');
  });

  it('a normal hit on a grounded fighter still staggers, not launches', async () => {
    const { FighterStateMachine } = await import('./FighterStateMachine.ts');
    const fsm = new FighterStateMachine();
    fsm.applyReaction('WeakMid');
    assert.equal(fsm.isAirborne, false);
    assert.equal(fsm.actionState, 'HitStun');
  });

  it('a heavy hit CONTINUES a juggle instead of dropping into a standing stagger', async () => {
    const { FighterStateMachine } = await import('./FighterStateMachine.ts');
    const fsm = new FighterStateMachine();
    fsm.applyReaction('Flight');
    fsm.applyReaction('StrongMid');
    assert.equal(fsm.isAirborne, true, 'a heavy hit knocked them out of the air state');
    assert.equal(fsm.actionState, 'Juggled');
  });

  it('a smackdown on a grounded fighter is just a knockdown', async () => {
    const { FighterStateMachine } = await import('./FighterStateMachine.ts');
    const fsm = new FighterStateMachine();
    fsm.applyReaction('Smackdown');
    assert.equal(fsm.actionState, 'Knockdown');
    assert.equal(fsm.isAirborne, false);
  });

  it('ticking airborne on a grounded fighter is a no-op', async () => {
    const { FighterStateMachine } = await import('./FighterStateMachine.ts');
    const fsm = new FighterStateMachine();
    assert.equal(fsm.tickAirborne(1 / 60), false);
    assert.equal(fsm.actionState !== 'Knockdown', true, 'a no-op tick knocked someone down');
  });
});
