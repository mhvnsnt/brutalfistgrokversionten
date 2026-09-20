// `.ts` extensions on purpose — the repo's runner resolves them literally.
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

import { exportMoveLabels, loadMoveLabels, setMoveLabel, unlabelled } from './moveLabels.ts';

/** A localStorage that behaves like the real one, including throwing. */
function installStorage(throwOnWrite = false) {
  const data = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (throwOnWrite) throw new Error('QuotaExceededError');
      data.set(k, v);
    },
    removeItem: (k: string) => { data.delete(k); },
  };
  return data;
}

beforeEach(() => { installStorage(); });

test('a label round-trips', () => {
  setMoveLabel('HURRICANE_KICK', { name: 'the spinning kick', slot: 'attack_rk', verdict: 'good' });
  const all = loadMoveLabels();
  assert.equal(all.HURRICANE_KICK.name, 'the spinning kick');
  assert.equal(all.HURRICANE_KICK.slot, 'attack_rk');
  assert.equal(all.HURRICANE_KICK.verdict, 'good');
  assert.ok(all.HURRICANE_KICK.at > 0, 'a label records when it was written');
});

test('a second pass merges rather than replaces', () => {
  // He will label a move "good" on one sweep and name it on another; the
  // first pass must not be thrown away by the second.
  setMoveLabel('BOXING', { verdict: 'broken' });
  setMoveLabel('BOXING', { note: 'arm folds backwards' });
  const l = loadMoveLabels().BOXING;
  assert.equal(l.verdict, 'broken');
  assert.equal(l.note, 'arm folds backwards');
});

test('emptying a label deletes it, so a mistake can be taken back', () => {
  setMoveLabel('STANCE', { name: 'typo' });
  assert.ok(loadMoveLabels().STANCE);
  setMoveLabel('STANCE', { name: '', slot: '', note: '', verdict: undefined });
  assert.equal(loadMoveLabels().STANCE, undefined);
});

test('a blocked or full store never loses the rest of the session', () => {
  installStorage(true);
  assert.doesNotThrow(() => setMoveLabel('X', { name: 'y' }));
  assert.deepEqual(loadMoveLabels(), {});
});

test('corrupt storage reads as empty rather than throwing', () => {
  const data = installStorage();
  data.set('bf_move_labels_v1', '{not json');
  assert.deepEqual(loadMoveLabels(), {});
});

test('the export is readable text, because it gets pasted into a message', () => {
  setMoveLabel('GRAFQUICKJAB', { name: 'quick jab', slot: 'attack_1', verdict: 'good' });
  setMoveLabel('CROTCHCHOP', { verdict: 'broken', note: 'taunt, not a strike' });
  const text = exportMoveLabels();
  assert.match(text, /2 move\(s\) labelled/);
  assert.match(text, /GRAFQUICKJAB.*\[good\].*quick jab.*attack_1/);
  assert.match(text, /CROTCHCHOP.*\[broken\].*taunt, not a strike/);
  // Sorted, so two exports of the same set are comparable.
  assert.ok(text.indexOf('CROTCHCHOP') < text.indexOf('GRAFQUICKJAB'));
});

test('an empty export says so instead of returning nothing', () => {
  assert.equal(exportMoveLabels(), 'No moves labelled yet.');
});

test('the queue is whatever has not been looked at', () => {
  setMoveLabel('A', { verdict: 'good' });
  assert.deepEqual(unlabelled(['A', 'B', 'C']), ['B', 'C']);
});
