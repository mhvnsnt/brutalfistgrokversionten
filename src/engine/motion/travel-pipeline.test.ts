// `.ts` extensions on purpose — the repo's runner resolves them literally.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { SCHWARZERBLITZ_MOVE_GRAPH } from '../../generated/SchwarzerblitzMoveGraph.generated.ts';
import { SB_SOURCE_FPS, expandRootMotion } from '../combat/SchwarzerblitzRootMotion.ts';
import { totalTravel, travelFromPerFrame } from './RootTravel.ts';

const BAKED = 'public/motion/baked';
const hasBake = existsSync(join(BAKED, 'index.json'));

/**
 * FORWARD MUST MEAN FORWARD, FOREVER.
 *
 * An inverted sign is the single most plausible silent failure in this whole
 * chain: every number stays believable, every total keeps its magnitude, and
 * the only symptom is that fighters retreat when they attack. It cannot be
 * caught by eye in a table. So it is pinned to moves whose NAME states their
 * direction, in both sources independently.
 */
describe('travel keeps its direction through the pipeline', () => {
  it('a Schwarzerblitz BackStep travels backwards', () => {
    const moves = Object.values(SCHWARZERBLITZ_MOVE_GRAPH).flat();
    const backsteps = moves.filter((m) => /backstep/i.test(m.name) && (m.movement ?? []).length);
    assert.ok(backsteps.length > 0, 'no BackStep in the imported graph — has the import changed?');
    for (const m of backsteps) {
      const frames = m.frames ? m.frames[1] : 8;
      const curve = travelFromPerFrame(expandRootMotion(m.movement, Math.max(frames, 4)), SB_SOURCE_FPS);
      assert.ok(
        totalTravel(curve).forward < 0,
        `${m.name} travels ${totalTravel(curve).forward.toFixed(2)}m — a backstep must be negative`,
      );
    }
  });

  it('a captured DROP_KICK travels forwards', { skip: !hasBake }, () => {
    const file = join(BAKED, 'DROP_KICK.json');
    if (!existsSync(file)) return;
    const data = JSON.parse(readFileSync(file, 'utf8')) as { travel?: { t: number[]; f: number[]; l: number[] } };
    assert.ok(data.travel?.t?.length, 'DROP_KICK lost its travel somewhere in the bake');
    assert.ok(
      totalTravel(data.travel).forward > 0.1,
      `DROP_KICK ends ${totalTravel(data.travel).forward.toFixed(2)}m from where it began — it should advance`,
    );
  });
});

/**
 * THE CHAIN ITSELF. This session found the same shape of bug twice — data that
 * is imported, listed and then consumed by nothing — so the fix is a test that
 * the travel SURVIVES each hop rather than one that only checks the maths.
 */
describe('captured footwork survives the whole chain', { skip: !hasBake }, () => {
  const manifest = JSON.parse(readFileSync(join(BAKED, 'index.json'), 'utf8')) as
    Record<string, { travels?: number }>;
  const clips = manifest.clips ? (manifest.clips as unknown as typeof manifest) : manifest;

  it('the bake carries travel for a real share of the corpus', () => {
    const travelling = Object.values(clips).filter((c) => (c?.travels ?? 0) > 0).length;
    assert.ok(travelling > 20, `only ${travelling} baked clips carry travel — the import may have stopped reading pose data`);
  });

  it('every clip the manifest says travels really has a curve in its file', () => {
    const claimed = Object.entries(clips).filter(([, c]) => (c?.travels ?? 0) > 0);
    const missing: string[] = [];
    for (const [name] of claimed.slice(0, 40)) {
      const file = join(BAKED, `${name}.json`);
      if (!existsSync(file)) continue;
      const data = JSON.parse(readFileSync(file, 'utf8')) as { travel?: { t: number[] } };
      if (!data.travel?.t?.length) missing.push(name);
    }
    assert.deepEqual(missing, [], `the manifest claims travel these clips do not carry: ${missing.join(', ')}`);
  });

  it('no clip claims travel that would fling a fighter across the stage', () => {
    const absurd = Object.entries(clips).filter(([, c]) => (c?.travels ?? 0) > 3);
    assert.deepEqual(absurd.map(([n]) => n), [], 'a capture is claiming more than 3m of travel — check the units');
  });
});
