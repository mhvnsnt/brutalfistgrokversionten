// `.ts` extensions on purpose — the repo's runner resolves them literally.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { clipsLabelledFor, labelRefuses, type MoveLabelMap } from './moveLabels.ts';

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
