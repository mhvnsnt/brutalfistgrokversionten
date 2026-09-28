/**
 * THE MOVE MODEL CAME ACROSS, NOT JUST THE ANIMATIONS.
 *
 * This project already shipped Schwarzerblitz's clips while hand-authoring six
 * move windows and deriving the other 286 from clip length. These assert the
 * data that was left behind is now here and usable.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  setSchwarzerblitzMoves, schwarzerblitzMoves, startableMoves, schwarzerblitzCharacters,
  attackHeightOf, reactionOf, frameDataOf, cancelsAt, followupsAt, defenceAt,
} from './SchwarzerblitzMoveDB.ts';
import { REACTIONS } from './HitReactions.ts';

setSchwarzerblitzMoves(JSON.parse(readFileSync('public/motion/schwarzerblitz_moves.json', 'utf8')));

describe('the Schwarzerblitz move database', () => {
  it('loaded every character and move', () => {
    assert.ok(schwarzerblitzCharacters().length >= 4, 'characters missing');
    assert.ok(schwarzerblitzMoves().length >= 130, `only ${schwarzerblitzMoves().length} moves`);
    assert.ok(startableMoves().length >= 80, 'almost everything parsed as follow-up-only');
  });

  it('every hitbox names a reaction our matrix already understands', () => {
    // The names line up because HitReactions was ported from this same game —
    // so the imported data feeds ReactionMatrix with no translation step.
    const unknown = new Set<string>();
    for (const m of schwarzerblitzMoves()) {
      for (const h of m.hitboxes ?? []) {
        if (h.reaction && h.reaction !== 'None' && !(h.reaction in REACTIONS)) unknown.add(h.reaction);
      }
    }
    assert.deepEqual([...unknown], [], `reactions our matrix has never heard of: ${[...unknown].join(', ')}`);
  });

  it('attack heights are real heights, which our 286 imported moves had none of', () => {
    const heights = new Set(schwarzerblitzMoves().map(attackHeightOf).filter(Boolean));
    assert.ok(heights.has('high') && heights.has('mid') && heights.has('low'),
      `missing a height: got ${[...heights].join(', ')}`);
    const withHeight = schwarzerblitzMoves().filter((m) => attackHeightOf(m) !== null);
    assert.ok(withHeight.length >= 80, `only ${withHeight.length} moves carry an attack height`);
  });

  it('frame data comes from the hitbox, not from how long a clip runs', () => {
    const framed = schwarzerblitzMoves().map(frameDataOf).filter(Boolean) as Array<{ startup: number; active: number; recovery: number }>;
    assert.ok(framed.length >= 80, `only ${framed.length} moves have hitbox-derived frame data`);
    // And it lands in a fighting game's range rather than a clip's.
    const active = framed.map((f) => f.active).sort((a, b) => a - b);
    const median = active[Math.floor(active.length / 2)];
    assert.ok(median <= 8, `median active window is ${median} frames — that is clip length, not frame data`);
  });

  it('cancels and followups are frame-ranged, so they open and close', () => {
    const withCancel = schwarzerblitzMoves().filter((m) => (m.cancelInto ?? []).length);
    assert.ok(withCancel.length >= 20, `only ${withCancel.length} moves have cancel windows`);
    const m = withCancel[0];
    const w = m.cancelInto![0];
    assert.equal(cancelsAt(m, w.from).length > 0, true, 'a cancel window does not open on its first frame');
    assert.equal(cancelsAt(m, w.to + 1).length, 0, 'a cancel window never closes');
    const withFollow = schwarzerblitzMoves().filter((m2) => (m2.followups ?? []).length);
    assert.ok(withFollow.length >= 40, `only ${withFollow.length} moves have followups`);
    const f = withFollow[0];
    assert.ok(followupsAt(f, f.followups![0].from).length > 0);
  });

  it('invincibility and armour are per attack type, not a single flag', () => {
    const typed = schwarzerblitzMoves().filter((m) => (m.invincibleAgainst ?? []).length || (m.armorAgainst ?? []).length);
    assert.ok(typed.length >= 30, `only ${typed.length} moves carry typed defensive windows`);
    const m = typed.find((x) => (x.invincibleAgainst ?? []).length)!;
    const w = m.invincibleAgainst![0];
    assert.equal(defenceAt(m, w.from, w.type).invincible, true, 'a typed i-frame window does not apply on its own frame');
    assert.equal(defenceAt(m, w.to + 1, w.type).invincible, false, 'a typed i-frame window never ends');
  });

  it('movement curves came across so a move can carry the body', () => {
    const moving = schwarzerblitzMoves().filter((m) => (m.movement ?? []).length);
    assert.ok(moving.length >= 100, `only ${moving.length} moves have a movement curve`);
  });

  it('a move that deals damage names both what it does and how it is blocked', () => {
    const damaging = schwarzerblitzMoves().filter((m) => (m.hitboxes ?? []).some((h) => h.damage > 0));
    const incomplete = damaging.filter((m) => !reactionOf(m) || !attackHeightOf(m));
    // Throws and a handful of utility hits legitimately have neither.
    assert.ok(incomplete.length < damaging.length * 0.25,
      `${incomplete.length} of ${damaging.length} damaging moves lack a reaction or a height`);
  });
});
