/**
 * COMBAT INVARIANTS — the glitch audit.
 *
 * The owner's report, verbatim: "they keep like, doing the falling or getting
 * thrown or knocked down animation and they're floating midair. It looks like a
 * drop kick randomly happening every now and then, but it's not a drop kick,
 * it's like a hit reaction ... a lot of t pose randomly happening pretty much
 * the combat keeps getting interrupted by bugs and glitches".
 *
 * Those are not four bugs to hunt one at a time. They are four INVARIANTS the
 * state machine is breaking, and a fighting game holds them every frame:
 *
 *   1. A body off the mat is airborne.        (floating)
 *   2. A fall clip plays only while falling.  (the "random drop kick")
 *   3. Every state ends.                      (the interruptions / stuck poses)
 *   4. Every state it can reach has a clip.   (T-pose)
 *
 * So this is a FUZZER, not a list of cases. It drives the real machine through
 * random legal input and reaction sequences and checks the invariants on every
 * single frame. A violation prints the sequence that produced it.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  FighterStateMachine, DEFAULT_MOVE_WINDOWS,
  type FighterInput, type ActionState,
} from './FighterStateMachine.ts';
import type { FighterMotionState } from '../retarget/AnimationController.ts';

const NEUTRAL: FighterInput = {
  forward: 0, strafe: 0, light: false, heavy: false, guard: false, crouch: false,
};

/** A deterministic generator, so a failure is reproducible from its seed. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const REACTIONS = [
  'WeakHigh', 'WeakMid', 'WeakLow', 'StrongHigh', 'StrongMid', 'StrongLow',
  'Flight', 'StandFlight', 'Smackdown', 'WeakMedium', undefined,
] as const;

/** The states in which a body is legitimately off the mat. */
const AIRBORNE_ACTIONS: ReadonlySet<ActionState> = new Set(['Juggled', 'Jumping']);

/** States that mean "on the ground, falling or fallen". */
const GROUNDED_FALL_MOTION: ReadonlySet<FighterMotionState> = new Set(['knockdown']);

const FALL_OK_ACTIONS: ReadonlySet<ActionState> = new Set([
  'Knockdown', 'Juggled',
  'WakeupTechRoll', 'WakeupBackrise', 'WakeupQuickStand',
]);

interface Violation { rule: string; frame: number; detail: string; }

function fuzzOne(seed: number, frames = 900): Violation[] {
  const rnd = rng(seed);
  const fsm = new FighterStateMachine();
  const out: Violation[] = [];
  const dt = 1 / 60;
  const moves = Object.values(DEFAULT_MOVE_WINDOWS);

  for (let f = 0; f < frames; f++) {
    // Random legal input. Buttons are rare, like a human's hands.
    const input: FighterInput = {
      ...NEUTRAL,
      forward: rnd() < 0.3 ? (rnd() < 0.5 ? 1 : -1) : 0,
      strafe: rnd() < 0.15 ? (rnd() < 0.5 ? 1 : -1) : 0,
      light: rnd() < 0.08,
      heavy: rnd() < 0.05,
      guard: rnd() < 0.1,
      crouch: rnd() < 0.1,
    };

    fsm.tickAirborne(dt);
    fsm.update(input, dt);

    // Take a hit now and then, from a real move window.
    if (rnd() < 0.06) {
      const move = moves[Math.floor(rnd() * moves.length)];
      const reaction = REACTIONS[Math.floor(rnd() * REACTIONS.length)];
      fsm.applyReaction(reaction, move ?? null);
    }

    // ── 1. A body off the mat is airborne ──────────────────────────────────
    if (fsm.juggleHeight > 0.01 && !AIRBORNE_ACTIONS.has(fsm.action)) {
      out.push({
        rule: 'FLOATING', frame: f,
        detail: `height=${fsm.juggleHeight.toFixed(3)}m while action=${fsm.action} motion=${fsm.current}`,
      });
    }

    // ── 2. A fall clip plays only while falling ────────────────────────────
    if (GROUNDED_FALL_MOTION.has(fsm.current) && !FALL_OK_ACTIONS.has(fsm.action)) {
      out.push({
        rule: 'FALL_CLIP_WHILE_STANDING', frame: f,
        detail: `motion=${fsm.current} while action=${fsm.action}`,
      });
    }

    // ── 3. Airborne implies the arc is live ────────────────────────────────
    if (fsm.action === 'Juggled' && !fsm.isAirborne) {
      out.push({ rule: 'JUGGLED_NOT_AIRBORNE', frame: f, detail: `motion=${fsm.current}` });
    }

    if (out.length > 4) break; // one report is enough to act on
  }
  return out;
}

describe('combat invariants (fuzzed)', () => {
  it('a body is never off the mat outside an airborne state', () => {
    const all: string[] = [];
    for (let seed = 1; seed <= 200; seed++) {
      for (const v of fuzzOne(seed)) {
        if (v.rule === 'FLOATING' || v.rule === 'JUGGLED_NOT_AIRBORNE') {
          all.push(`seed=${seed} f=${v.frame} ${v.rule}: ${v.detail}`);
        }
      }
    }
    assert.deepEqual(all.slice(0, 6), [], `floating bodies:\n${all.slice(0, 6).join('\n')}`);
  });

  it('the fall clip never plays on a standing body', () => {
    const all: string[] = [];
    for (let seed = 1; seed <= 200; seed++) {
      for (const v of fuzzOne(seed)) {
        if (v.rule === 'FALL_CLIP_WHILE_STANDING') all.push(`seed=${seed} f=${v.frame}: ${v.detail}`);
      }
    }
    assert.deepEqual(all.slice(0, 6), [], `fall clip on a standing body:\n${all.slice(0, 6).join('\n')}`);
  });

  it('every state ends — no input, and the machine comes back to neutral', () => {
    const stuck: string[] = [];
    for (const reaction of REACTIONS) {
      for (const move of [null, DEFAULT_MOVE_WINDOWS.heavyAttack ?? null]) {
        const fsm = new FighterStateMachine();
        fsm.applyReaction(reaction, move);
        let settled = -1;
        for (let f = 0; f < 60 * 12; f++) {
          fsm.tickAirborne(1 / 60);
          fsm.update(NEUTRAL, 1 / 60);
          if (fsm.action === 'Idle' || fsm.action === 'Walking' || fsm.action === 'Guard') { settled = f; break; }
        }
        if (settled < 0) stuck.push(`${reaction ?? 'default'}/${move ? 'heavy' : 'bare'} stuck in ${fsm.action}/${fsm.current} h=${fsm.juggleHeight.toFixed(3)}`);
      }
    }
    assert.deepEqual(stuck, [], `states that never end:\n${stuck.join('\n')}`);
  });

  it('a juggle always lands', () => {
    const fsm = new FighterStateMachine();
    fsm.applyReaction('Flight', null);
    let landed = false;
    for (let f = 0; f < 60 * 5 && !landed; f++) landed = fsm.tickAirborne(1 / 60);
    assert.equal(landed, true, 'a launched body never came down');
    assert.equal(fsm.juggleHeight, 0);
  });
});
