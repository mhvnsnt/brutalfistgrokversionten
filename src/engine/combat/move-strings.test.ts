// `.ts` extensions on purpose — the repo's runner resolves them literally.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { existsSync, readFileSync } from 'node:fs';

import { SCHWARZERBLITZ_MOVE_GRAPH } from '../../generated/SchwarzerblitzMoveGraph.generated.ts';
import { CANCEL_OPENS_AT, generatedMoveset, setGeneratedMovesets } from './GeneratedMovesets.ts';

const TABLE = 'public/motion/movesets.json';
const hasTable = existsSync(TABLE);
if (hasTable) setGeneratedMovesets(JSON.parse(readFileSync(TABLE, 'utf8')));

describe('the moves a player fires can continue into a string', () => {
  /**
   * `detectCancel` reads cancelInto/followups off the CURRENT move. Generated
   * slots carried neither, so no attack in the game could be interrupted by
   * another: throw one, sit through its whole recovery, throw the next. This
   * is the regression test for "the combat doesn't flow".
   */
  it('every generated move with a partner carries a cancel window', { skip: !hasTable }, () => {
    const set = generatedMoveset('bannon');
    assert.ok(set.length >= 20, `expected a full matrix, got ${set.length}`);
    const withCancel = set.filter((m) => (m.move?.cancelInto ?? []).length > 0);
    assert.ok(
      withCancel.length >= set.length * 0.8,
      `only ${withCancel.length}/${set.length} generated moves can be cancelled`,
    );
  });

  it('a punch continues into the kick on the same direction, and back', { skip: !hasTable }, () => {
    const set = generatedMoveset('bannon');
    const punch = set.find((m) => /_6P$/.test(m.id));
    const kick = set.find((m) => /_6K$/.test(m.id));
    if (!punch || !kick) return;
    assert.equal(punch.move?.cancelInto?.[0]?.move, kick.id, '6P should chain into 6K');
    assert.equal(kick.move?.cancelInto?.[0]?.move, punch.id, '6K should chain back into 6P');
  });

  it('never chains a move into itself', { skip: !hasTable }, () => {
    for (const m of generatedMoveset('bannon')) {
      for (const link of m.move?.cancelInto ?? []) {
        assert.notEqual(link.move, m.id, `${m.id} cancels into itself — that is a mash, not a string`);
      }
    }
  });

  it('only names partners that actually exist in the set', { skip: !hasTable }, () => {
    const set = generatedMoveset('bannon');
    const ids = new Set(set.map((m) => m.id));
    for (const m of set) {
      for (const link of m.move?.cancelInto ?? []) {
        assert.ok(ids.has(link.move), `${m.id} chains into ${link.move}, which is not in the set`);
      }
    }
  });

  /**
   * The window has to be reachable: open after the move has committed but
   * before it ends, or the link exists and can never be used.
   */
  it('opens the window inside the move', { skip: !hasTable }, () => {
    for (const m of generatedMoveset('bannon')) {
      const total = (m.move?.startup ?? 0) + (m.move?.active ?? 0) + (m.move?.recovery ?? 0);
      for (const link of m.move?.cancelInto ?? []) {
        assert.ok(link.from > 0, `${m.id} opens its cancel at 0 — the move could be skipped outright`);
        assert.ok(link.from < link.to, `${m.id} has an empty cancel window`);
        assert.ok(link.to <= total + 1e-6, `${m.id} cancels past its own end`);
      }
    }
  });
});

describe('the window shape comes from the source', () => {
  it('matches what Schwarzerblitz authors', () => {
    const rel: number[] = [];
    for (const m of Object.values(SCHWARZERBLITZ_MOVE_GRAPH).flat()) {
      const end = m.frames?.[1];
      if (!end) continue;
      for (const l of [...(m.cancelInto ?? []), ...(m.followups ?? [])]) {
        if (l.window?.[0] != null) rel.push(l.window[0] / end);
      }
    }
    assert.ok(rel.length > 100, `only ${rel.length} authored windows found`);
    rel.sort((a, b) => a - b);
    const median = rel[Math.floor(rel.length / 2)];
    assert.ok(
      Math.abs(median - CANCEL_OPENS_AT) < 0.12,
      `the source opens its windows at ${median.toFixed(2)} of the move, we use ${CANCEL_OPENS_AT}`,
    );
  });
});
