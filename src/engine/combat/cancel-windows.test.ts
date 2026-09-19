// `.ts` extensions on purpose — `node --experimental-strip-types --test`
// resolves them literally.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { schwarzerblitzSpecials, availableMoveSets } from './SchwarzerblitzSpecials.ts';

/**
 * Owner: "we need to do a thing where we don't interrupt the animations
 * unless they're meant to be interrupted."
 *
 * Schwarzerblitz authors exactly that per move — `#FOLLOWUP` and
 * `#CANCEL_INTO` with frame ranges — and 133 moves carry it. Until this went
 * in, nothing in the engine read either field.
 */

test('authored cancel windows reach the move definitions', () => {
  const sp = schwarzerblitzSpecials('chara_tutor');
  const withLinks = sp.filter(
    (s) => (s.move.cancelInto?.length ?? 0) + (s.move.followups?.length ?? 0) > 0,
  );
  assert.ok(withLinks.length >= 10, `only ${withLinks.length} moves carry a cancel window`);
});

test('a window is a real span of seconds, converted from the source 24 fps', () => {
  for (const set of availableMoveSets()) {
    for (const s of schwarzerblitzSpecials(set)) {
      for (const l of [...(s.move.cancelInto ?? []), ...(s.move.followups ?? [])]) {
        assert.ok(l.from >= 0, `${s.id} -> ${l.move} opens at ${l.from}`);
        assert.ok(l.to > l.from, `${s.id} -> ${l.move} has an empty window [${l.from}, ${l.to}]`);
        // 24 fps: a frame is 1/24 s, and no authored window runs past a few
        // seconds. Infinity is the deliberate "no range given" case.
        assert.ok(
          l.to === Number.POSITIVE_INFINITY || l.to < 5,
          `${s.id} -> ${l.move} closes at ${l.to}s, which is not a frame window`,
        );
      }
    }
  }
});

test('a link names a special that exists, not a raw move name', () => {
  // A link in the source names a RAW move ('Rotary_Kick') while a special's
  // id is namespaced by its set. Without the namespace every window was dead
  // on arrival — the ids could never match.
  const sp = schwarzerblitzSpecials('chara_tutor');
  const ids = new Set(sp.map((s) => s.id));
  let links = 0;
  let resolved = 0;
  for (const s of sp) {
    for (const l of [...(s.move.cancelInto ?? []), ...(s.move.followups ?? [])]) {
      links++;
      if (ids.has(l.move)) resolved++;
      assert.ok(l.move.startsWith('sb_'), `${l.move} is not namespaced`);
    }
  }
  assert.ok(links > 0, 'no links at all');
  assert.ok(resolved >= links * 0.4, `only ${resolved}/${links} links resolve to a real special`);
});

test('followup-only moves are imported but cannot be thrown from neutral', () => {
  // They are most of what a cancel points at — excluding them left 18 of 30
  // authored links in chara_tutor pointing at nothing. They carry the flag so
  // only a cancel window can reach them.
  const sets = availableMoveSets();
  const all = sets.flatMap((s) => schwarzerblitzSpecials(s));
  const followupOnly = all.filter((s) => s.followupOnly);
  assert.ok(followupOnly.length > 0, 'no followup-only moves were imported');
  for (const s of followupOnly) {
    assert.ok(s.command?.length, `${s.id} has no command, so a cancel could not match it`);
  }
});

test('a move with no authored links cannot be cancelled at all', () => {
  // The default matters more than the exception: a move plays to its end
  // unless it was authored otherwise. An empty array, not undefined-as-open.
  const sp = schwarzerblitzSpecials('chara_dummy');
  const plain = sp.filter(
    (s) => (s.move.cancelInto?.length ?? 0) + (s.move.followups?.length ?? 0) === 0,
  );
  assert.ok(plain.length > 0, 'expected at least one uncancellable move in the set');
  for (const s of plain) {
    assert.deepEqual(s.move.cancelInto, []);
    assert.deepEqual(s.move.followups, []);
  }
});
