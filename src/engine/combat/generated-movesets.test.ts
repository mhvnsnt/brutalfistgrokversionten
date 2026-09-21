// `.ts` extensions on purpose — the repo's runner resolves them literally.
import assert from 'node:assert/strict';
import { describe, it, before } from 'node:test';
import { readFileSync, existsSync } from 'node:fs';

import { createCommandBuffer, pushInput, matchCommand } from './CommandInput.ts';
import { generatedMoveset, setGeneratedMovesets } from './GeneratedMovesets.ts';

/**
 * A FULL MOVESET, MATCHED FROM THE COMMAND BUFFER.
 *
 * Owner: "I can only fire off 4 attacks and it's the base ones ... not
 * forward P/K, jump RK, back, back-forward. Full movesets and individual
 * movesets so they're not all doing the same attacks."
 *
 * DRIVEN STRAIGHT INTO THE BUFFER, with no browser. The live probe could not
 * settle this: at the ~2 fps swiftshader manages, a 260 ms directional hold
 * can fall entirely between two frames, so "the command did not match" and
 * "the harness never saw the direction" look identical. Here they do not.
 */
const FILE = 'public/motion/movesets.json';
const has = existsSync(FILE);

const DIRS: Record<number, { x: number; y: number }> = {
  5: { x: 0, y: 0 }, 6: { x: 1, y: 0 }, 4: { x: -1, y: 0 },
  2: { x: 0, y: -1 }, 8: { x: 0, y: 1 }, 3: { x: 1, y: -1 },
  1: { x: -1, y: -1 }, 9: { x: 1, y: 1 }, 7: { x: -1, y: 1 },
};

describe('a generated moveset is reachable from the stick', () => {
  before(() => {
    if (has) setGeneratedMovesets(JSON.parse(readFileSync(FILE, 'utf8')));
  });

  const fire = (moves: ReturnType<typeof generatedMoveset>, numpad: number, button: 'LP' | 'RK', stance: string) => {
    const candidates = moves
      .filter((m) => m.command?.length)
      .map((m) => ({ name: m.id, input: m.command!, stance: m.stance }));
    const buf = createCommandBuffer();
    let t = 1000;
    pushInput(buf, DIRS[numpad], {}, 1, t);
    t += 120;
    pushInput(buf, DIRS[numpad], { [button]: true }, 1, t);
    return matchCommand(candidates, buf, { now: t, stance });
  };

  it('gives a fighter far more than the eight standing commands he had', function () {
    if (!has) return;
    const set = generatedMoveset('bannon');
    assert.ok(set.length >= 20, `expected a full matrix, got ${set.length}`);
    const ground = set.filter((m) => m.stance === 'Ground');
    assert.ok(ground.length >= 14, `expected 8 directions x 2 buttons standing, got ${ground.length}`);
  });

  it('every standing direction, both buttons, actually matches', function () {
    if (!has) return;
    const set = generatedMoveset('bannon');
    const missed: string[] = [];
    for (const np of [6, 4, 2, 8, 3, 1, 9, 7]) {
      for (const b of ['LP', 'RK'] as const) {
        if (!fire(set, np, b, 'Ground')) missed.push(`${np}${b}`);
      }
    }
    assert.deepEqual(missed, [], `these directions fire nothing: ${missed.join(', ')}`);
  });

  /**
   * THE POINT OF THE WHOLE EXERCISE. Different inputs must produce different
   * ANIMATIONS — 26 commands that all played `lightAttack` is what "the same
   * 4 attacks the whole fight" actually was.
   */
  it('and each one plays a different animation', function () {
    if (!has) return;
    const set = generatedMoveset('bannon');
    const clips = new Set<string>();
    for (const np of [6, 4, 2, 8, 3, 1, 9, 7]) {
      for (const b of ['LP', 'RK'] as const) {
        const hit = fire(set, np, b, 'Ground');
        const def = set.find((m) => m.id === hit?.move.name);
        if (def?.move?.clip) clips.add(def.move.clip);
      }
    }
    assert.ok(clips.size >= 12, `only ${clips.size} distinct animations across 16 inputs`);
  });

  it('two fighters do not share a moveset', function () {
    if (!has) return;
    const a = generatedMoveset('bannon');
    const b = generatedMoveset('onyx');
    assert.ok(a.length && b.length);
    const same = a.filter((m, i) => b[i]?.move?.clip === m.move?.clip).length;
    assert.ok(same / a.length < 0.6, `they share ${Math.round((same / a.length) * 100)}% of their clips`);
  });

  it('a move keeps a generic attack state, so it is still treated as an attack', function () {
    if (!has) return;
    // Pushing the specific clip through `animation` is what silently stopped
    // authored specials being recognised as attacks at all.
    for (const m of generatedMoveset('bannon')) {
      assert.ok(['heavyAttack', 'heavyKick'].includes(m.move!.animation), `${m.id} -> ${m.move!.animation}`);
      assert.ok(m.move!.clip, `${m.id} carries no clip`);
    }
  });
});
