// `.ts` extensions on purpose — the repo's runner resolves them literally.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  clipsLabelledFor, clipsTagged, isReceivingClip, labelRefuses, taggingProgress,
  type MoveLabelMap,
} from './moveLabels.ts';

/**
 * THE LABELS HAVE TO REACH THE GAME.
 *
 * Owner: "if you can set it up where I can see all of that visually in the
 * move creator ... I can help you figure out what animations should go in
 * what categories." The screen existed and this module's own header used to
 * end with "nothing in combat reads it", which made it a suggestion box.
 */
describe('what the owner says a clip is', () => {
  const labels: MoveLabelMap = {
    CROTCHCHOP: { verdict: 'broken', note: 'plays lying down', at: 1 },
    TZ_SCOOP_SLAM: { verdict: 'broken', at: 2 },
    HEAVYKICK: { slot: 'attack_rk', verdict: 'good', at: 3 },
    AXEKICK: { slot: 'Heavy Kick', at: 9 },
    NECKBREAKER: { slot: 'grapple', verdict: 'broken', at: 4 },
    ORAORAORA: { name: 'the flurry', at: 5 },
  };

  it('refuses a clip he called broken', () => {
    assert.equal(labelRefuses('CROTCHCHOP', labels), true);
    assert.equal(labelRefuses('TZ_SCOOP_SLAM', labels), true);
    assert.equal(labelRefuses('HEAVYKICK', labels), false);
    assert.equal(labelRefuses('NEVER_SEEN', labels), false);
  });

  it('a name or a note alone changes nothing', () => {
    // Writing down what a move IS must not take it out of the game.
    assert.equal(labelRefuses('ORAORAORA', labels), false);
    assert.deepEqual(clipsLabelledFor('taunt', labels), []);
  });

  it('serves the clips he assigned to a slot, newest judgement first', () => {
    // He types "attack_rk", "Heavy Kick" or "RK" and means one slot.
    assert.deepEqual(clipsLabelledFor('attack_rk', labels), ['AXEKICK', 'HEAVYKICK']);
    assert.deepEqual(clipsLabelledFor('heavykick', labels), ['AXEKICK', 'HEAVYKICK']);
  });

  it('never serves a clip he assigned and then called broken', () => {
    assert.deepEqual(clipsLabelledFor('grapple', labels), []);
  });

  it('an empty or unknown slot asks for nothing', () => {
    assert.deepEqual(clipsLabelledFor('', labels), []);
    assert.deepEqual(clipsLabelledFor('   ', labels), []);
    assert.deepEqual(clipsLabelledFor('no_such_slot', labels), []);
  });
});

/**
 * THE ANIMATION POOL — the tap that unblocks the pipeline.
 *
 * Owner: "add a thing at the bottom ... an animation pool, and if you put
 * like a little check boxes for every type of move or animation we have ...
 * I'll literally be able to just tap the checkbox of what kind of animation
 * it is, and that'll help the whole pipeline."
 */
describe('what kind of animation this is', () => {
  const labels: MoveLabelMap = {
    GRAFQUICKJAB:       { kinds: ['attack', 'punch'], at: 1 },
    HEAVYKICK:          { kinds: ['attack', 'kick'], at: 2 },
    SHARKNADO_REACTION: { kinds: ['reaction'], at: 3 },
    FALLING_FLAT:       { kinds: ['knockdown'], at: 4 },
    KIP_UP:             { kinds: ['getup'], at: 5 },
    WALK:               { kinds: ['locomotion'], at: 6 },
    // A capture that carries both halves on one skeleton. The attacking
    // reading is the one an attack slot wants.
    TIGER_FEINT_KICK:   { kinds: ['attack', 'kick', 'reaction'], at: 7 },
    NOT_TAGGED_YET:     { name: 'no idea', at: 8 },
    BROKEN_ONE:         { kinds: ['attack', 'punch'], verdict: 'broken', at: 9 },
  };

  it('knows a body being hit from a body hitting', () => {
    assert.equal(isReceivingClip('SHARKNADO_REACTION', labels), true);
    assert.equal(isReceivingClip('FALLING_FLAT', labels), true);
    assert.equal(isReceivingClip('KIP_UP', labels), true);
    assert.equal(isReceivingClip('GRAFQUICKJAB', labels), false);
    assert.equal(isReceivingClip('HEAVYKICK', labels), false);
  });

  it('lets an attack tag win when a capture carries both halves', () => {
    assert.equal(isReceivingClip('TIGER_FEINT_KICK', labels), false);
  });

  it('treats an untagged clip as unknown, never as refused', () => {
    // Refusing everything he has not got to yet would empty the game.
    assert.equal(isReceivingClip('NOT_TAGGED_YET', labels), false);
    assert.equal(isReceivingClip('NEVER_SEEN_AT_ALL', labels), false);
  });

  it('collects the pool a classifier can be built from', () => {
    assert.deepEqual(clipsTagged(['attack', 'kick'], labels), ['HEAVYKICK', 'TIGER_FEINT_KICK']);
    assert.deepEqual(clipsTagged(['locomotion'], labels), ['WALK']);
    // A broken clip never joins a pool, whatever it is tagged.
    assert.deepEqual(clipsTagged(['attack', 'punch'], labels), ['GRAFQUICKJAB']);
  });

  it('reports how much of the pool has been judged', () => {
    const all = ['GRAFQUICKJAB', 'WALK', 'NOT_TAGGED_YET', 'NEVER_SEEN_AT_ALL'];
    assert.deepEqual(taggingProgress(all, labels), { tagged: 2, total: 4 });
  });
});

/**
 * THE CHECKBOX HAS TO SURVIVE THE WRITE.
 *
 * Owner asked for the animation pool specifically so a sweep could be done
 * with taps and no typing: "I'll literally be able to just tap the checkbox
 * of what kind of animation it is, and that'll help the whole pipeline."
 *
 * MEASURED the day after it shipped: a tap on a clip with no typed name,
 * slot, note or verdict produced a label carrying `kinds` and nothing else,
 * and the "an emptied label is a delete" test — which listed four of the
 * six fields — threw it away on the way to storage. `kindsOf` came back
 * empty immediately after `toggleMoveKind`. On a fresh clip, which is every
 * clip at the start of a sweep, the screen stored NOTHING.
 */
describe('a tapped kind is kept', () => {
  const store = new Map<string, string>();
  const before = globalThis.localStorage;

  it('survives on a clip with nothing else written on it', async () => {
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => { store.set(k, String(v)); },
      removeItem: (k: string) => { store.delete(k); },
    };
    const m = await import('./moveLabels.ts');
    try {
      m.toggleMoveKind('CROTCHCHOP', 'taunt');
      assert.deepEqual([...m.kindsOf('CROTCHCHOP')], ['taunt'],
        'the tap was discarded on the way to storage');
      m.toggleMoveKind('CROTCHCHOP', 'idle');
      assert.deepEqual([...m.kindsOf('CROTCHCHOP')], ['idle', 'taunt']);
      // Untapping everything still clears the entry, so a mistake is takeable back.
      m.toggleMoveKind('CROTCHCHOP', 'idle');
      m.toggleMoveKind('CROTCHCHOP', 'taunt');
      assert.deepEqual(m.loadMoveLabels(), {});
    } finally {
      (globalThis as { localStorage?: unknown }).localStorage = before;
    }
  });

  it('keeps a pairing written on its own', async () => {
    store.clear();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => { store.set(k, String(v)); },
      removeItem: (k: string) => { store.delete(k); },
    };
    const m = await import('./moveLabels.ts');
    try {
      m.setMoveLabel('NECKBREAKER', { pairedWith: 'POWERBOMBREACTION' });
      assert.equal(m.loadMoveLabels().NECKBREAKER?.pairedWith, 'POWERBOMBREACTION');
    } finally {
      (globalThis as { localStorage?: unknown }).localStorage = before;
    }
  });
});
