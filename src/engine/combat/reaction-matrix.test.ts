/**
 * THE REACTION MATRIX — the second dimension.
 *
 * Tekken's own data layout (TKMovesets Structs_t7.h / Structs_t8.h) attaches a
 * `Reactions` struct to every HitCondition of every move, holding 15 victim
 * ANIMATIONS, 7 PUSHBACKS, 6 DIRECTIONS and 6 ROTATIONS, selected by what the
 * victim was doing. Ours resolved the attack's name to one effect and consulted
 * the victim exactly once.
 *
 * These are the properties that make the difference visible in play.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveReaction, distinctOutcomes, VICTIM_STATES, REACTION_KINDS,
} from './ReactionMatrix.ts';
import { FighterStateMachine } from './FighterStateMachine.ts';

describe('the reaction matrix', () => {
  it('the same attack reads differently on a different body', () => {
    const seen = new Map<string, string>();
    for (const victim of VICTIM_STATES) {
      const r = resolveReaction({ kind: 'hitstun', victim });
      seen.set(victim, `${r.motion}|${r.pushbackScale}|${r.rotationDeg}`);
    }
    // A jab to a standing man, a crouching man and a man facing away must not
    // be the same event. That sameness is what read as one thing on a loop.
    assert.notEqual(seen.get('standing'), seen.get('crouch'), 'a crouching body takes a jab the same as a standing one');
    assert.notEqual(seen.get('standing'), seen.get('backTurned'), 'a back-turned body takes a jab the same as a facing one');
    assert.notEqual(seen.get('standing'), seen.get('airborne'), 'an airborne body takes a jab the same as a standing one');
    assert.notEqual(seen.get('standing'), seen.get('downed'), 'a downed body takes a jab the same as a standing one');
    assert.equal(new Set(seen.values()).size >= 7, true, `only ${new Set(seen.values()).size} distinct outcomes across 11 victim states`);
  });

  it('a body off the mat plays the air reaction and stays off the mat', () => {
    for (const kind of ['hitstun', 'crumple', 'launch'] as const) {
      const r = resolveReaction({ kind, victim: 'airborne' });
      assert.equal(r.motion, 'hitAir', `${kind} on an airborne body does not play the air reaction`);
      assert.equal(r.keepsAirborne, true, `${kind} on an airborne body drops the juggle`);
    }
    // The slam is the one that ENDS it.
    const slam = resolveReaction({ kind: 'smackdown', victim: 'airborne' });
    assert.equal(slam.motion, 'hitGround');
    assert.equal(slam.keepsAirborne, false, 'a smackdown should put them on the mat');
    assert.equal(slam.direction, 'down');
  });

  it('a light hit in the air barely moves them, which is what keeps a combo going', () => {
    const air = resolveReaction({ kind: 'hitstun', victim: 'airborne' });
    const ground = resolveReaction({ kind: 'hitstun', victim: 'standing' });
    assert.ok(air.pushbackScale < ground.pushbackScale * 0.6,
      `air pushback ${air.pushbackScale} is not meaningfully smaller than standing ${ground.pushbackScale}`);
  });

  it('you cannot brace against what you cannot see', () => {
    const back = resolveReaction({ kind: 'hitstun', victim: 'backTurned' });
    const front = resolveReaction({ kind: 'hitstun', victim: 'standing' });
    assert.ok(back.stunScale > front.stunScale, 'a back-turned hit should stun longer');
    assert.ok(back.pushbackScale > front.pushbackScale, 'a back-turned hit should push further');
    assert.ok(Math.abs(back.rotationDeg) > 30, 'a back-turned hit should spin them back round');
  });

  it('a hit from the flank spins the victim, and the two flanks spin opposite ways', () => {
    const l = resolveReaction({ kind: 'hitstun', victim: 'sideLeft' });
    const r = resolveReaction({ kind: 'hitstun', victim: 'sideRight' });
    assert.ok(Math.abs(l.rotationDeg) > 10 && Math.abs(r.rotationDeg) > 10, 'a side hit does not spin');
    assert.equal(Math.sign(l.rotationDeg), -Math.sign(r.rotationDeg), 'both flanks spin the same way');
    assert.notEqual(l.direction, r.direction, 'both flanks push the same way');
  });

  it('a body on the mat is not shoved along it', () => {
    const downed = resolveReaction({ kind: 'crumple', victim: 'downed' });
    const standing = resolveReaction({ kind: 'crumple', victim: 'standing' });
    assert.ok(downed.pushbackScale < standing.pushbackScale * 0.3, 'a grounded hit slides them like a standing one');
    assert.equal(downed.motion, 'hitGround');
    // You cannot launch a man who is already on the floor.
    assert.equal(resolveReaction({ kind: 'launch', victim: 'downed' }).keepsAirborne, false);
  });

  it('a wall gives nothing back', () => {
    const wall = resolveReaction({ kind: 'crumple', victim: 'wallSlump' });
    const open = resolveReaction({ kind: 'crumple', victim: 'standing' });
    assert.ok(wall.pushbackScale < open.pushbackScale * 0.3, 'a body against the wall is still being shoved');
    assert.ok(wall.stunScale > open.stunScale, 'the push that cannot happen should become stun');
  });

  it('counter hit is a row, not a multiplier, and only from the front', () => {
    const ch = resolveReaction({ kind: 'crumple', victim: 'standing', counterHit: true });
    const plain = resolveReaction({ kind: 'crumple', victim: 'standing' });
    assert.ok(ch.stunScale > plain.stunScale, 'a counter hit does not stun longer');
    // The Tekken source comment: a CH launcher does not launch after a sidestep.
    const sideCh = resolveReaction({ kind: 'crumple', victim: 'sideRight', counterHit: true });
    const sidePlain = resolveReaction({ kind: 'crumple', victim: 'sideRight' });
    assert.deepEqual(sideCh, sidePlain, 'counter hit applied from the flank');
    // A counter-hit crumple is what turns a poke into a launcher.
    assert.equal(ch.keepsAirborne, true, 'a counter-hit crumple should lift them');
  });

  it('the matrix produces far more outcomes than the old one-dimensional table', () => {
    // The old system had 5 kinds and one scalar pushback: 5 outcomes.
    assert.ok(distinctOutcomes() >= 40, `only ${distinctOutcomes()} distinct outcomes`);
    assert.equal(VICTIM_STATES.length, 11);
    assert.equal(REACTION_KINDS.length, 5);
  });

  it('the state machine derives the victim state and routes the hit through it', () => {
    const fsm = new FighterStateMachine();
    assert.equal(fsm.victimState(), 'standing');
    fsm.applyReaction('WeakMid');
    assert.equal(fsm.lastReaction?.victim, 'standing');

    // Airborne wins over everything.
    const air = new FighterStateMachine();
    air.applyReaction('Flight');
    assert.equal(air.victimState(), 'airborne');
    air.applyReaction('WeakMid');
    assert.equal(air.lastReaction?.victim, 'airborne');
    assert.equal(air.current, 'hitAir', 'an airborne hit does not play the air reaction clip');

    // Knocked down.
    const down = new FighterStateMachine();
    down.applyKnockdown();
    assert.equal(down.victimState(), 'downed');

    // Geometry arrives as a hint.
    const side = new FighterStateMachine();
    assert.equal(side.victimState('sideRight'), 'sideRight');
    assert.equal(side.victimState('wallSlump'), 'wallSlump');
  });
});
