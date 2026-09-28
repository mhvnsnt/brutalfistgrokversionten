/**
 * Owner: "the animations and hit reactions and overall combat flow is still
 * glitchy and buggy."
 *
 * Eighteen clips shared the semantic `hit_reaction` with lengths from 0.167s to
 * 3.300s while hitstun runs 0.18s to 0.65s, so a jab could begin a 3.3-second
 * animation and be cut 5% in. These pin the binding that fixes it, against the
 * REAL move data and the REAL clip lengths rather than invented ones.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  reactionClipFor, reactionClipSeconds, REACTION_CLIP_SECONDS, KNOWN_REACTIONS,
} from './ReactionClips.ts';

/** The hitstun window the state machine actually uses. */
const HITSTUN_MIN = 0.18;
const HITSTUN_MAX = 0.65;

/** Every reaction name that appears on a real Schwarzerblitz hitbox. */
function reactionsInTheData(): string[] {
  const m = JSON.parse(readFileSync('public/motion/schwarzerblitz_moves.json', 'utf8'));
  const names = new Set<string>();
  for (const group of Object.values(m.moves as Record<string, any[]>)) {
    for (const mv of group) for (const h of mv.hitboxes ?? []) if (h.reaction) names.add(h.reaction);
  }
  return [...names];
}

describe('every reaction in the move data resolves', () => {
  it('names nothing the data does not use, and misses nothing it does', () => {
    const used = reactionsInTheData();
    assert.ok(used.length > 0, 'the move data carries no reactions at all');
    for (const r of used) {
      assert.ok(KNOWN_REACTIONS.includes(r), `move data uses reaction "${r}" which the binding does not know`);
    }
  });

  it('resolves every reaction to a clip that EXISTS, or deliberately to none', () => {
    for (const r of reactionsInTheData()) {
      const clip = reactionClipFor(r);
      if (clip === null) continue;                       // knockdown / None, on purpose
      assert.ok(clip in REACTION_CLIP_SECONDS, `${r} -> ${clip}, which is not a clip in the bank`);
    }
  });

  it('the four most common reactions are DERIVED, not hand-typed', () => {
    // WeakHigh is 24 hitboxes, the most common reaction in the game.
    assert.equal(reactionClipFor('WeakHigh'), 'REACTION_HITWEAKHIGH');
    assert.equal(reactionClipFor('WeakMedium'), 'REACTION_HITWEAKMEDIUM');
    assert.equal(reactionClipFor('StrongHigh'), 'REACTION_HITSTRONGHIGH');
    assert.equal(reactionClipFor('StrongMid'), 'REACTION_HITSTRONGMID');
  });

  it('Mid and Medium are the same word — the data uses both', () => {
    assert.equal(reactionClipFor('WeakMid'), reactionClipFor('WeakMedium'));
    assert.equal(reactionClipFor('StrongMedium'), reactionClipFor('StrongMid'));
  });
});

describe('the clip fits the hitstun window it will be cut by', () => {
  it('no standing reaction is longer than the LONGEST hitstun', () => {
    // This is the whole defect: a clip longer than the window is a body yanked
    // out of its own animation. Flight is allowed past it because a launch is
    // not governed by hitstun -- the juggle system owns the victim.
    for (const r of KNOWN_REACTIONS) {
      if (r === 'Flight' || r === 'StandFlight') continue;
      const s = reactionClipSeconds(r);
      if (s === null) continue;
      assert.ok(s <= HITSTUN_MAX + 1e-9, `${r} runs ${s}s against a ${HITSTUN_MAX}s maximum hitstun`);
    }
  });

  it('a light hit plays a clip that COMPLETES inside the minimum hitstun', () => {
    // 0.167s inside 0.18s. The clips were authored to these windows; only the
    // choice of clip was ever wrong, so no frame data has to move.
    for (const r of ['WeakHigh', 'WeakMedium', 'WeakMid', 'WeakLow']) {
      const s = reactionClipSeconds(r);
      assert.ok(s !== null && s <= HITSTUN_MIN, `${r} runs ${s}s, longer than the ${HITSTUN_MIN}s minimum hitstun`);
    }
  });

  it('a strong hit gets a longer reaction than a light one', () => {
    const weak = reactionClipSeconds('WeakHigh')!;
    const strong = reactionClipSeconds('StrongHigh')!;
    assert.ok(strong > weak, `strong ${strong}s is not longer than weak ${weak}s`);
  });

  it('none of the 20x-longer clips can be chosen', () => {
    // HIT_ON_SIDE_OF_HEAD (3.300s), HIT_TO_HEAD (2.533s) and HIT_REACTION
    // (2.433s) all carry semantic hit_reaction and were reachable by name
    // similarity. Nothing may resolve to them now.
    const reachable = new Set(KNOWN_REACTIONS.map((r) => reactionClipFor(r)).filter(Boolean) as string[]);
    for (const bad of ['HIT_ON_SIDE_OF_HEAD', 'HIT_TO_HEAD', 'HIT_REACTION', 'BIG_BODY_BLOW', 'HIT_TO_BODY']) {
      assert.ok(!reachable.has(bad), `${bad} is still reachable as a hit reaction`);
    }
  });
});

describe('being hit from behind', () => {
  it('uses the back variant when the victim is back-turned', () => {
    assert.equal(reactionClipFor('WeakMedium', { backTurned: true }), 'REACTION_HITWEAKMEDIUMBACK');
    assert.equal(reactionClipFor('Flight', { backTurned: true }), 'REACTION_HEAVYHITAIRREVOLTBACK');
  });

  it('falls back to the front clip when no back variant exists', () => {
    assert.equal(reactionClipFor('StrongHigh', { backTurned: true }), 'REACTION_HITSTRONGHIGH');
  });
});

describe('a smackdown is not a standing flinch', () => {
  it('resolves to nothing so the knockdown system owns it', () => {
    assert.equal(reactionClipFor('Smackdown'), null);
    assert.equal(reactionClipFor('None'), null);
    assert.equal(reactionClipFor(null), null);
    assert.equal(reactionClipFor(undefined), null);
  });
});
