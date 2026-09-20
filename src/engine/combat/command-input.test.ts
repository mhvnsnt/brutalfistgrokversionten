/**
 * The command layer, and above all the thing it exists to prevent: a command
 * list that makes P2 attack backwards because 'forward' was baked as world +X.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  BUFFER_SIZE,
  STEP_WINDOW_MS,
  consumeCommand,
  createCommandBuffer,
  matchCommand,
  numpadFor,
  numpadParts,
  pushInput,
  scoreMove,
  type Facing,
  type MatchableMove,
} from './CommandInput.ts';
import { SCHWARZERBLITZ_MOVE_GRAPH } from '../../generated/SchwarzerblitzMoveGraph.generated.ts';

const P1: Facing = 1;
const P2: Facing = -1;

// ─────────────────────────────────────────────────────────────────────────────
describe('numpad is relative to facing — the orientation guarantee', () => {
  it('6 is toward the opponent for BOTH players', () => {
    // P1 faces +X, so screen-right is forward.
    assert.equal(numpadFor({ x: 1, y: 0 }, P1), 6);
    // P2 faces -X, so screen-LEFT is forward. Baking world +X as "forward" is
    // exactly the bug where one side's whole command list comes out reversed.
    assert.equal(numpadFor({ x: -1, y: 0 }, P2), 6);
  });

  it('4 is away from the opponent for both players', () => {
    assert.equal(numpadFor({ x: -1, y: 0 }, P1), 4);
    assert.equal(numpadFor({ x: 1, y: 0 }, P2), 4);
  });

  it('the same world stick reads as MIRRORED numpads for the two sides', () => {
    for (const x of [-1, 0, 1] as const) {
      for (const y of [-1, 0, 1] as const) {
        const a = numpadFor({ x, y }, P1);
        const b = numpadFor({ x, y }, P2);
        // Up/down are shared; forward/back invert.
        assert.equal(numpadParts(a).up, numpadParts(b).up, `up must not flip (${x},${y})`);
        // `-0 !== 0` under strict equality, and a neutral column is legitimately 0.
        assert.equal(numpadParts(a).forward, -numpadParts(b).forward || 0, `forward must flip (${x},${y})`);
      }
    }
  });

  it('neutral is 5, and the numpad grid round-trips', () => {
    assert.equal(numpadFor({ x: 0, y: 0 }, P1), 5);
    assert.equal(numpadFor({ x: 0, y: 0 }, P2), 5);
    assert.deepEqual(numpadFor({ x: 1, y: -1 }, P1), 3);  // down-forward
    assert.deepEqual(numpadFor({ x: -1, y: 1 }, P1), 7);  // up-back
    for (let n = 1; n <= 9; n++) {
      const { forward, up } = numpadParts(n);
      assert.equal(5 + forward + 3 * up, n, `numpad ${n} round-trip`);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('the buffer records edges, not frames', () => {
  const neutral = { x: 0, y: 0 } as const;

  it('holding a direction does not flood the buffer', () => {
    const b = createCommandBuffer();
    let t = 0;
    pushInput(b, { x: 1, y: 0 }, {}, P1, (t += 16));
    for (let i = 0; i < 30; i++) pushInput(b, { x: 1, y: 0 }, {}, P1, (t += 16));
    assert.equal(b.events.length, 1, 'one edge, not thirty frames');
  });

  it('a button press is an edge; holding it is not', () => {
    const b = createCommandBuffer();
    let t = 0;
    pushInput(b, neutral, { RP: true }, P1, (t += 16));
    pushInput(b, neutral, { RP: true }, P1, (t += 16));
    pushInput(b, neutral, { RP: true }, P1, (t += 16));
    assert.equal(b.events.length, 1);
    // Release and press again is a second edge.
    pushInput(b, neutral, { RP: false }, P1, (t += 16));
    pushInput(b, neutral, { RP: true }, P1, (t += 16));
    assert.equal(b.events.length, 2);
  });

  it('the buffer is bounded', () => {
    const b = createCommandBuffer();
    let t = 0;
    for (let i = 0; i < 100; i++) {
      pushInput(b, { x: i % 2 ? 1 : -1, y: 0 }, {}, P1, (t += 5));
    }
    assert.ok(b.events.length <= BUFFER_SIZE, `buffer grew to ${b.events.length}`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
const JAB: MatchableMove = { name: 'Jab', input: [{ dirs: [], buttons: ['P'], hold: false }] };
const FWD_PUNCH: MatchableMove = { name: 'FwdPunch', input: [{ dirs: [6], buttons: ['P'], hold: false }] };
const QCB_PUNCH: MatchableMove = {
  name: 'QcbPunch',
  input: [
    { dirs: [2], buttons: [], hold: false },
    { dirs: [1], buttons: [], hold: false },
    { dirs: [4], buttons: [], hold: false },
    { dirs: [], buttons: ['P'], hold: false },
  ],
};
const ALL = [JAB, FWD_PUNCH, QCB_PUNCH];

describe('matching picks the move the player earned', () => {
  it('a bare punch is a jab', () => {
    const b = createCommandBuffer();
    pushInput(b, { x: 0, y: 0 }, { RP: true }, P1, 100);
    const hit = matchCommand(ALL, b, { now: 100 });
    assert.equal(hit?.move.name, 'Jab');
  });

  it('forward + punch beats the jab — longest match wins', () => {
    const b = createCommandBuffer();
    pushInput(b, { x: 1, y: 0 }, { RP: true }, P1, 100);
    const hit = matchCommand(ALL, b, { now: 100 });
    assert.equal(hit?.move.name, 'FwdPunch');
  });

  it('the quarter-circle beats both', () => {
    const b = createCommandBuffer();
    let t = 100;
    pushInput(b, { x: 0, y: -1 }, {}, P1, (t += 50));  // 2
    pushInput(b, { x: -1, y: -1 }, {}, P1, (t += 50)); // 1
    pushInput(b, { x: -1, y: 0 }, {}, P1, (t += 50));  // 4
    pushInput(b, { x: -1, y: 0 }, { RP: true }, P1, (t += 50));
    const hit = matchCommand(ALL, b, { now: t });
    assert.equal(hit?.move.name, 'QcbPunch');
    assert.equal(hit?.steps, 4);
  });

  it('P2 performs the SAME motion with a mirrored stick', () => {
    // The identical command, driven from the other side. If forward were world
    // +X this would not match at all — which is the reported symptom.
    const b = createCommandBuffer();
    let t = 100;
    pushInput(b, { x: 0, y: -1 }, {}, P2, (t += 50));  // 2
    pushInput(b, { x: 1, y: -1 }, {}, P2, (t += 50));  // 1 (world +X = back for P2)
    pushInput(b, { x: 1, y: 0 }, {}, P2, (t += 50));   // 4
    pushInput(b, { x: 1, y: 0 }, { RP: true }, P2, (t += 50));
    const hit = matchCommand(ALL, b, { now: t });
    assert.equal(hit?.move.name, 'QcbPunch');
  });

  it('a motion that goes cold falls back to the plain button', () => {
    const b = createCommandBuffer();
    let t = 100;
    pushInput(b, { x: 0, y: -1 }, {}, P1, (t += 50));
    pushInput(b, { x: -1, y: -1 }, {}, P1, (t += 50));
    pushInput(b, { x: -1, y: 0 }, {}, P1, (t += 50));
    t += STEP_WINDOW_MS * 2; // too slow
    pushInput(b, { x: 0, y: 0 }, { RP: true }, P1, t);
    const hit = matchCommand(ALL, b, { now: t });
    assert.equal(hit?.move.name, 'Jab', 'a late button is just a jab');
  });

  it('consuming the buffer stops one motion firing twice', () => {
    const b = createCommandBuffer();
    let t = 100;
    pushInput(b, { x: 0, y: -1 }, {}, P1, (t += 50));
    pushInput(b, { x: -1, y: -1 }, {}, P1, (t += 50));
    pushInput(b, { x: -1, y: 0 }, {}, P1, (t += 50));
    pushInput(b, { x: -1, y: 0 }, { RP: true }, P1, (t += 50));
    assert.equal(matchCommand(ALL, b, { now: t })?.move.name, 'QcbPunch');
    consumeCommand(b);
    pushInput(b, { x: -1, y: 0 }, { RP: false }, P1, (t += 20));
    pushInput(b, { x: -1, y: 0 }, { RP: true }, P1, (t += 20));
    assert.equal(matchCommand(ALL, b, { now: t })?.move.name, 'Jab');
  });
});

describe('stance and followup gating', () => {
  const air: MatchableMove = { name: 'AirPunch', input: [{ dirs: [], buttons: ['P'], hold: false }], stance: 'Air' };
  const ground: MatchableMove = { name: 'Jab', input: [{ dirs: [], buttons: ['P'], hold: false }], stance: 'Ground' };
  const link: MatchableMove = {
    name: 'Link2', input: [{ dirs: [], buttons: ['P'], hold: false }], flags: ['FOLLOWUP_ONLY'],
  };

  it('a move only comes out in its own stance', () => {
    const b = createCommandBuffer();
    pushInput(b, { x: 0, y: 0 }, { RP: true }, P1, 100);
    assert.equal(matchCommand([air, ground], b, { now: 100, stance: 'Ground' })?.move.name, 'Jab');
    assert.equal(matchCommand([air, ground], b, { now: 100, stance: 'Air' })?.move.name, 'AirPunch');
  });

  it('a FOLLOWUP_ONLY move needs the window to be open', () => {
    const b = createCommandBuffer();
    pushInput(b, { x: 0, y: 0 }, { RP: true }, P1, 100);
    assert.equal(matchCommand([link], b, { now: 100 }), null, 'not reachable cold');
    const open = matchCommand([link], b, { now: 100, availableFollowups: new Set(['Link2']) });
    assert.equal(open?.move.name, 'Link2');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('the imported Schwarzerblitz move graph is usable as a command list', () => {
  const sets = Object.entries(SCHWARZERBLITZ_MOVE_GRAPH);

  it('imported something', () => {
    assert.ok(sets.length >= 1, 'no move sets imported');
    const total = sets.reduce((a, [, m]) => a + m.length, 0);
    assert.ok(total >= 100, `expected the corpus, saw ${total} moves`);
  });

  it('most moves carry a parsed command', () => {
    const all = sets.flatMap(([, m]) => m);
    const withInput = all.filter((m) => m.input.length > 0);
    assert.ok(withInput.length / all.length > 0.9, `only ${withInput.length}/${all.length} have a command`);
  });

  it('every command step is a real numpad direction and/or a real button', () => {
    for (const [char, moves] of sets) {
      for (const move of moves) {
        for (const step of move.input) {
          for (const d of step.dirs) {
            assert.ok(d >= 1 && d <= 9, `${char}/${move.name}: direction ${d} is not numpad`);
          }
          for (const b of step.buttons) {
            assert.match(b, /^[A-Z0-9_]+$/, `${char}/${move.name}: odd button ${b}`);
          }
          assert.ok(step.dirs.length || step.buttons.length, `${char}/${move.name}: empty step`);
        }
      }
    }
  });

  it('no numeric field came through as null — the #BULLET sub-directive trap', () => {
    // #BULLET carries LOWERCASE #range / #velocity, and upper-casing the tag
    // made them overwrite the move's own #RANGE with [0, NaN].
    for (const [char, moves] of sets) {
      for (const move of moves) {
        for (const key of ['range', 'frames', 'invincible'] as const) {
          const v = move[key];
          if (!v) continue;
          for (const n of v) assert.ok(Number.isFinite(n), `${char}/${move.name}.${key} has ${n}`);
        }
        if (move.delayAfterMs !== undefined) assert.ok(Number.isFinite(move.delayAfterMs));
      }
    }
  });

  it('followup and cancel targets resolve, apart from the source\'s own typos', () => {
    // Three targets are dangling IN THE SOURCE DATA and are kept rather than
    // deleted — a dead route is the source's to fix, not ours to hide. Two more
    // differ only by underscores (`Crouching_Kick` vs `CrouchingKick`) and the
    // importer matches those to the real move, reporting each one.
    const KNOWN_DANGLING = new Set(['Right_Punch_Kick', 'RoundhouseLow', 'Rising_Comet_Follower']);
    const common = new Set((SCHWARZERBLITZ_MOVE_GRAPH.common ?? []).map((m) => m.name));
    const unresolved: string[] = [];
    let wildcards = 0;

    for (const [char, moves] of sets) {
      const names = new Set(moves.map((m) => m.name));
      for (const move of moves) {
        for (const link of [...move.followups, ...move.cancelInto]) {
          assert.ok(Number.isFinite(link.window[0]) && Number.isFinite(link.window[1]),
            `${char}/${move.name} -> ${link.move} has a broken window`);
          if (link.wildcard) { wildcards++; continue; }
          if (names.has(link.move) || common.has(link.move)) continue;
          if (KNOWN_DANGLING.has(link.move)) continue;
          unresolved.push(`${char}/${move.name} -> ${link.move}`);
        }
      }
    }
    assert.deepEqual(unresolved, [], 'new dangling combo routes appeared');
    // `*ALL_DAMAGING_ROOT_MOVES` is how a sidestep cancels into anything that
    // hits. Reading it as a move name would have thrown that route away.
    assert.ok(wildcards >= 6, `expected the wildcard cancel routes, saw ${wildcards}`);
  });

  it('the graph carries real stances, followup strings and framed hitboxes', () => {
    const all = sets.flatMap(([, m]) => m);
    const stances = new Set(all.map((m) => m.stance).filter(Boolean));
    assert.ok(stances.size >= 4, `expected several stances, saw ${[...stances].join(',')}`);
    assert.ok(all.filter((m) => m.followups.length).length >= 40, 'expected combo strings');
    const hits = all.flatMap((m) => m.hitboxes);
    assert.ok(hits.length >= 80, `expected framed hitboxes, saw ${hits.length}`);
    // A guard height on every hitbox is what makes high/mid/low blocking real.
    for (const h of hits) assert.match(h.height, /^(High|Mid|Low|Throw|None|Smackdown)$/, `odd height ${h.height}`);
  });

  it('a real imported command scores against a real buffer', () => {
    // End to end: take an actual imported move with a multi-step command and
    // drive it through the buffer as a player would.
    const all = sets.flatMap(([, m]) => m);
    const multi = all.find((m) => m.input.length >= 3 && m.input.every((s) => s.dirs.length <= 1 && !s.hold));
    assert.ok(multi, 'expected at least one multi-step command in the corpus');

    const b = createCommandBuffer();
    let t = 0;
    for (const step of multi!.input) {
      const dir = step.dirs[0] ?? 5;
      const forward = ((dir - 1) % 3) - 1;
      const up = Math.floor((dir - 1) / 3) - 1;
      const buttons: Record<string, boolean> = {};
      // A step names a PATTERN ('P'); a player presses a BUTTON ('RP').
      const concrete: Record<string, string> = { P: 'RP', K: 'RK' };
      for (const btn of step.buttons) buttons[concrete[btn] ?? btn] = true;
      pushInput(b, { x: forward as -1 | 0 | 1, y: up as -1 | 0 | 1 }, buttons, P1, (t += 60));
    }
    assert.equal(scoreMove(multi as MatchableMove, b, { now: t }), multi!.input.length,
      `${multi!.name} (${multi!.rawInput.trim()}) did not score its own command`);
  });
});
