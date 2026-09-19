/**
 * COVERAGE: how much of the synced animation can the game actually reach?
 *
 * MEASURED BEFORE THIS WORK: 157 of 367 clips resolved to a motion state and
 * 210 reached NOTHING — more than half the animation in the game was dead.
 * Every spinning kick, combo and hit reaction was in that dead half, because
 * the resolver matched generic English words and these clips are named for the
 * MOVE: TIGERSCARLETSCREW, JOHNSONWAVESWEEPER, GRAFHAMMERCOMBO, GYAKUZUKI.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveClipAlias } from './MoveLibrary.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

function clipNames(file: string): string[] {
  const s = readFileSync(join(ROOT, 'src/generated', file), 'utf8');
  return [...s.matchAll(/"([A-Za-z0-9_\-.]+)":\{"dur"/g)].map((m) => m[1]);
}

const ALL = [
  ...clipNames('SchwarzerblitzMotionBank.generated.ts'),
  ...clipNames('BannonMotionBank.generated.ts'),
];

describe('the synced banks are reachable', () => {
  it('both banks loaded', () => {
    assert.ok(ALL.length >= 350, `expected the full corpus, saw ${ALL.length}`);
  });

  it('at least 300 clips resolve to a motion state', () => {
    // Was 157. Anything that drops this is a regression in the vocabulary.
    const resolved = ALL.filter((n) => resolveClipAlias(n));
    assert.ok(resolved.length >= 300, `only ${resolved.length}/${ALL.length} clips resolve`);
  });

  it('the game reaches a broad spread of states, not four of them', () => {
    const states = new Set(ALL.map((n) => resolveClipAlias(n)?.motionState).filter(Boolean));
    assert.ok(states.size >= 18, `only ${states.size} distinct states: ${[...states].join(', ')}`);
    // The families a fighting game needs, each of which was measured present.
    for (const needed of ['lightAttack', 'heavyAttack', 'CommandThrow', 'hit', 'knockdown', 'jump', 'idle', 'taunt', 'victory']) {
      assert.ok(states.has(needed as never), `nothing reaches ${needed}`);
    }
  });
});

describe('the specific clips that used to reach nothing', () => {
  const CASES: Array<[string, string]> = [
    ['TIGERSCARLETSCREW', 'heavyAttack'],   // the spinning kick
    ['JOHNSONWAVESWEEPER', 'heavyAttack'],
    ['GRAFHAMMERCOMBO', 'heavyAttack'],
    ['SHARKNADO_REACTION', 'hit'],
    ['BACKBREAKER_REACTION', 'hit'],
    ['DDT_REACTION', 'hit'],
    ['GYAKUZUKI', 'lightAttack'],           // Japanese: reverse punch
    ['LAZORBACKROLL', 'WakeupTechRoll'],
    ['SUPINE', 'knockdown'],
    ['SHAZWALK', 'walkForward'],            // 'walk' not at a word boundary
    ['DRUNK_WALK', 'walkForward'],
    // A jump KICK is an attack first: the original 'kick' rule fires before
    // the new 'jump' one, and that ordering is right — losing the strike to
    // classify it as locomotion would be the worse answer.
    ['DEFAULTJUMPKICK', 'heavyAttack'],
    ['ZOMBIE_DYING', 'defeat'],
    ['TAU_BUTTSLAP', 'taunt'],
    ['RAPIDCHESTBEATING', 'taunt'],
  ];
  for (const [clip, expected] of CASES) {
    it(`${clip} -> ${expected}`, () => {
      const r = resolveClipAlias(clip);
      assert.ok(r, `${clip} still reaches nothing`);
      assert.equal(r!.motionState, expected);
    });
  }
});

describe('the extension cannot break what already worked', () => {
  it('the original keywords still win', () => {
    // The new rules run LAST, so an already-resolving name is untouched.
    assert.equal(resolveClipAlias('idle')?.motionState, 'idle');
    assert.equal(resolveClipAlias('guard')?.motionState, 'guard');
    assert.equal(resolveClipAlias('crouch')?.motionState, 'crouch');
    assert.equal(resolveClipAlias('knockdown')?.motionState, 'knockdown');
  });

  it("'run' keeps its word boundary, or DRUNK becomes a run", () => {
    // DRUNK contains 'run'. This is why that one rule is anchored and 'walk'
    // deliberately is not.
    assert.notEqual(resolveClipAlias('DRUNK_WALK')?.motionState, 'run');
    assert.equal(resolveClipAlias('DRUNK_RUN_FORWARD')?.motionState, 'run');
  });

  it('non-combat library clips stay unmapped ON PURPOSE', () => {
    // Mapping a rope climb into combat would be worse than leaving it out.
    for (const clip of ['CLIMBING_A_ROPE', 'CLIMBING_UP_WALL', 'Y_BOT', 'ANIMATIONMASTERFILE_BLEND']) {
      assert.equal(resolveClipAlias(clip), null, `${clip} should not be combat`);
    }
  });

  it('every rule reports what matched, so a wrong call is debuggable', () => {
    const r = resolveClipAlias('TIGERSCARLETSCREW');
    assert.ok(r?.matched, 'no reason recorded for the match');
  });
});
