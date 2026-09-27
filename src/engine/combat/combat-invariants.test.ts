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
import { readFileSync } from 'node:fs';
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

/**
 * THE REACTION CLIP MUST FIT THE HITSTUN THAT HOLDS IT.
 *
 * Measured off the shipped bank, not asserted from a name. The old alias list
 * led with HIT_REACTION at 2.4333s while a jab's hitstun is BASE_STUN 0.28s, so
 * the body began a long Mixamo collapse and was ripped out of it 11% in. That is
 * the reaction the owner called "buggy and glitchy", and it is why bodies looked
 * like they were starting to fall over for no reason.
 *
 * The Schwarzerblitz reactions in the same bank are the Tekken lengths:
 * REACTION_HITWEAKHIGH 0.1667s = 10 frames, REACTION_HITSTRONGHIGH 0.5417s.
 */
describe('a hit reaction fits inside the stun that holds it', () => {
  const read = (): { aliases: string; durOf: (n: string) => number | null } => {
    const aliases = readFileSync('src/engine/retarget/SemanticStateAliases.ts', 'utf8');
    const durOf = (n: string) => {
      try { return JSON.parse(readFileSync(`public/motion/baked/${n}.json`, 'utf8')).dur as number; }
      catch { return null; }
    };
    return { aliases, durOf };
  };
  const leadOf = (aliases: string, key: string): string | null => {
    const m = aliases.match(new RegExp(`${key}:\\s*\\[([^\\]]*)\\]`));
    if (!m) return null;
    const first = m[1].split(',')[0]?.replace(/['\s]/g, '');
    return first || null;
  };

  it('the clip a poke resolves to is no longer than the stun, and it exists', () => {
    const { aliases, durOf } = read();
    const lead = leadOf(aliases, 'hit_reaction');
    assert.ok(lead, 'hit_reaction has no alias list');
    const dur = durOf(lead!);
    assert.ok(dur !== null, `hit_reaction leads with ${lead}, which is not in the baked bank`);
    // BASE_STUN is 0.28s. A flinch that outlasts its own stun gets cut.
    assert.ok(dur! <= 0.30, `hit_reaction leads with ${lead} at ${dur}s — a 0.28s stun cannot play it`);
  });

  it('a strong reaction is longer than a poke but still fits a heavy stun', () => {
    const { aliases, durOf } = read();
    const weak = durOf(leadOf(aliases, 'hit_low') ?? '');
    const strong = durOf(leadOf(aliases, 'hit_strong') ?? '');
    assert.ok(weak !== null && strong !== null, 'hit_low / hit_strong do not resolve to baked clips');
    assert.ok(strong! > weak!, 'a strong reaction should be the longer of the two');
    assert.ok(strong! <= 0.70, `hit_strong is ${strong}s — longer than any stun that holds it`);
  });

  it('each wakeup option has its own clip', () => {
    const { aliases } = read();
    const leads = ['getup_kip', 'getup_roll', 'getup_back'].map((k) => leadOf(aliases, k));
    assert.ok(leads.every(Boolean), 'a wakeup option has no alias list');
    assert.equal(new Set(leads).size, 3, `tech roll, back rise and quick stand share a clip: ${leads.join(', ')}`);
  });
});

/**
 * A GAP FILLER MUST POSE THE WHOLE BODY.
 *
 * BindRelativeMotion synthesises a clip when a character's bank has no capture
 * for a semantic. Those clips are a few authored joint deltas, and a bone with
 * NO TRACK is not held where it was — it sits at its bind rotation. On a rig
 * whose bind is a T-pose (BANNON_rigged's is) that makes the whole clip a
 * T-pose with two or three joints moving.
 *
 * Measured in the browser before the fix: pressing jump put BANNON within 0.71
 * degrees of bind across all 58 bones, with the mixer naming one action at full
 * weight — the synthesised `jump`.
 */
describe('a synthesised clip poses every bone', () => {
  it('no generated clip leaves a bone without a track', async () => {
    const THREE = await import('three');
    const { buildBindRelativeClips } = await import('../retarget/BindRelativeMotion.ts');

    // A minimal Mixamo-named skeleton, the shape these clips are authored for.
    const names = [
      'mixamorigHips', 'mixamorigSpine', 'mixamorigSpine1', 'mixamorigNeck', 'mixamorigHead',
      'mixamorigLeftShoulder', 'mixamorigLeftArm', 'mixamorigLeftForeArm', 'mixamorigLeftHand',
      'mixamorigRightShoulder', 'mixamorigRightArm', 'mixamorigRightForeArm', 'mixamorigRightHand',
      'mixamorigLeftUpLeg', 'mixamorigLeftLeg', 'mixamorigLeftFoot',
      'mixamorigRightUpLeg', 'mixamorigRightLeg', 'mixamorigRightFoot',
    ];
    // Flat is fine: buildBindRelativeClips reads each bone's NAME and rest
    // quaternion, never the hierarchy.
    const root = new THREE.Object3D();
    for (const n of names) {
      const b = new THREE.Bone();
      b.name = n;
      root.add(b);
    }
    const clips = buildBindRelativeClips(root);
    assert.ok(clips.length > 0, 'no clips were generated for a Mixamo-named rig');

    const thin: string[] = [];
    for (const clip of clips) {
      const tracked = new Set(clip.tracks.map((t) => t.name.split('.')[0]));
      if (tracked.size < names.length) {
        thin.push(`${clip.name}: ${tracked.size}/${names.length} bones`);
      }
    }
    assert.deepEqual(thin, [], `generated clips leave bones at the bind pose:\n${thin.join('\n')}`);
  });

  it('the jump semantic prefers a real capture over the synthesised one', async () => {
    const aliases = readFileSync('src/engine/retarget/SemanticStateAliases.ts', 'utf8');
    const m = aliases.match(/\n\s*jump:\s*\[([^\]]*)\]/);
    assert.ok(m, 'no jump alias list');
    const list = m![1].split(',').map((x) => x.replace(/['\s]/g, '')).filter(Boolean);
    const synth = list.indexOf('jump');
    const real = list.indexOf('JUMP');
    assert.ok(real >= 0, 'JUMP is not in the jump alias list');
    assert.ok(real < synth, `the synthesised "jump" (index ${synth}) outranks the capture JUMP (index ${real})`);
  });
});
