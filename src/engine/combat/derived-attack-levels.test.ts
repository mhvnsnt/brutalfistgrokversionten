/**
 * 286 OF 292 MOVES HAD NO ATTACK HEIGHT.
 *
 * Measured on public/motion/movesets.json: every imported move carries no attack
 * level, so all 286 silently defaulted to 'mid'. The Tekken guard, the low parry, a
 * high whiffing over a crouch and a power crush covering high-and-mid-but-not-low
 * were all inert for them — six moves had a height game and 286 did not.
 *
 * The level is derived from the frames (tools/motion/attack_level.mjs), and an
 * AUTHORED level always wins, because the derivation fills a gap rather than
 * overruling a human.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  setDerivedAttackLevels, derivedAttackLevel, attackLevelFor,
  hasRealAttackLevel, derivedAttackLevelCount,
} from './DerivedAttackLevels.ts';
import { FighterStateMachine, DEFAULT_MOVE_WINDOWS, CROUCH_MOVE_WINDOWS, type FighterInput } from './FighterStateMachine.ts';

const MANIFEST = 'public/motion/attack_levels.json';
const NEUTRAL = { forward: 0, strafe: 0, light: false, heavy: false, guard: false, crouch: false } as FighterInput;
const input = (o: Partial<FighterInput>): FighterInput => ({ ...NEUTRAL, ...o });

describe('attack levels derived from the frames', () => {
  it('does nothing at all until the measurements are loaded', () => {
    setDerivedAttackLevels([]);
    assert.equal(derivedAttackLevelCount(), 0);
    assert.equal(derivedAttackLevel('ROUNDHOUSELOW'), null);
    assert.equal(attackLevelFor(undefined, 'ROUNDHOUSELOW'), 'mid',
      'with no manifest everything falls to mid, which is exactly the old behaviour');
  });

  it('lets an authored level win over the derived one', () => {
    // CROUCHINGKICK measures 32% of standing height against a 31% knee cut and
    // comes out 'mid' by one point, while the crouch window authors it 'low'
    // deliberately. Tuning the threshold until that clip agreed would be fitting
    // the measure to the answer.
    setDerivedAttackLevels([['CROUCHINGKICK', 'mid']]);
    assert.equal(attackLevelFor('low', 'CROUCHINGKICK'), 'low', 'the human wins');
    assert.equal(attackLevelFor(undefined, 'CROUCHINGKICK'), 'mid', 'and the derivation fills the gap');
  });

  it('fills a move that has no level of its own', () => {
    setDerivedAttackLevels([['ROUNDHOUSELOW', 'low'], ['HIGHPUNCH', 'high']]);
    assert.equal(attackLevelFor(undefined, 'ROUNDHOUSELOW'), 'low');
    assert.equal(attackLevelFor(undefined, 'HIGHPUNCH'), 'high');
    assert.ok(hasRealAttackLevel(undefined, 'ROUNDHOUSELOW'));
    assert.ok(!hasRealAttackLevel(undefined, 'SOMETHING_UNMEASURED'));
    setDerivedAttackLevels([]);
  });

  it('reaches the guard through the real state machine', () => {
    // The point of all of it: a derived LOW must be duckable-through and
    // crouch-blockable, exactly as an authored one is.
    setDerivedAttackLevels([['ROUNDHOUSELOW', 'low']]);
    const fsm = new FighterStateMachine();
    // Stand and block: a low must get through a standing guard.
    for (let i = 0; i < 6; i++) fsm.update(input({ forward: -1, guard: true }), 1 / 60);
    const derivedLow = { ...DEFAULT_MOVE_WINDOWS.lightAttack, attackLevel: undefined, clip: 'ROUNDHOUSELOW', damage: 100 };
    const r = fsm.processIncomingHit(derivedLow as never);
    assert.equal(r.blocked, false, 'a standing guard must not block a derived low');
    setDerivedAttackLevels([]);
  });

  it('judges the source clip, not a masked half', () => {
    setDerivedAttackLevels([['ROUNDHOUSELOW', 'low']]);
    assert.equal(derivedAttackLevel('ROUNDHOUSELOW__upper'), 'low');
    setDerivedAttackLevels([]);
  });
});

describe('the shipped manifest', { skip: !existsSync(MANIFEST) }, () => {
  const data = existsSync(MANIFEST)
    ? JSON.parse(readFileSync(MANIFEST, 'utf8')) as {
      bands: { lowBelow: number; highFrom: number };
      clips: Record<string, { level: string; limb: string; heightFrac: number }>;
    }
    : null;

  it('covers most of the bank and spans all three heights', () => {
    const clips = Object.values(data!.clips);
    assert.ok(clips.length > 300, `only ${clips.length} clips classified`);
    const dist = { high: 0, mid: 0, low: 0 } as Record<string, number>;
    for (const c of clips) dist[c.level] = (dist[c.level] ?? 0) + 1;
    for (const level of ['high', 'mid', 'low']) {
      assert.ok(dist[level] > 20, `only ${dist[level]} ${level}s — a moveset needs all three or the guard game is one-dimensional`);
    }
  });

  it('puts hands high and feet low, which is the sanity check on the whole derivation', () => {
    // Not a rule the tool enforces — a consequence of measuring real frames. If
    // this inverts, the striker selection has regressed (it once picked a
    // stance-width FOOT as the striker of every hand strike).
    const clips = Object.entries(data!.clips);
    const handHeights = clips.filter(([, c]) => c.limb.includes('Hand')).map(([, c]) => c.heightFrac);
    const footHeights = clips.filter(([, c]) => c.limb.includes('Foot')).map(([, c]) => c.heightFrac);
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
    assert.ok(handHeights.length > 30 && footHeights.length > 30, 'not enough of each limb to compare');
    assert.ok(mean(handHeights) > mean(footHeights),
      `hands average ${mean(handHeights).toFixed(2)} and feet ${mean(footHeights).toFixed(2)} — the striker selection has inverted`);
  });

  it('keeps the bands where the body says they are', () => {
    assert.ok(data!.bands.lowBelow > 0.15 && data!.bands.lowBelow < 0.45, `low cut at ${data!.bands.lowBelow}`);
    assert.ok(data!.bands.highFrom > 0.7 && data!.bands.highFrom < 0.95, `high cut at ${data!.bands.highFrom}`);
    assert.ok(data!.bands.highFrom > data!.bands.lowBelow);
  });
});
