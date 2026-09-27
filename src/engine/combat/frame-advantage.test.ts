/**
 * IS ANY MOVE PLUS OR MINUS ON BLOCK?
 *
 * tools/parity/baseline.ts found this was the biggest gap against the genre
 * baseline, and the one that matters most: blockstun was a flat per-animation
 * duration that was never compared against the attacker's own recovery, so every
 * move came out NEUTRAL. With no move plus and no move minus there is no reason
 * to press after one and wait after another — which is the entire mind game.
 *
 * These cases check the arithmetic AND the realised behaviour, because the whole
 * failure mode of an authored frame-data table is claiming +1 while the engine
 * plays -6.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_MOVE_WINDOWS, CROUCH_MOVE_WINDOWS,
  FRAMES_PER_SECOND, BLOCKSTUN_CLAMP_FRAMES,
  blockstunFramesFor, realisedAdvantageOnBlock, tekkenBlockstunSeconds,
  type MoveWindow,
} from './FighterStateMachine.ts';

const ALL: Record<string, MoveWindow> = { ...DEFAULT_MOVE_WINDOWS, ...CROUCH_MOVE_WINDOWS };

describe('frame advantage on block', () => {
  it('realises exactly the advantage each move authors', () => {
    for (const [name, move] of Object.entries(ALL)) {
      assert.equal(typeof move.onBlock, 'number', `${name} authors no advantage at all`);
      assert.equal(
        realisedAdvantageOnBlock(move), move.onBlock,
        `${name} authors ${move.onBlock} and realises ${realisedAdvantageOnBlock(move)} — the clamp is biting, so its recovery cannot support that advantage`,
      );
    }
  });

  it('gives the jab an advantage and the heavy a penalty', () => {
    // The shape is the point. Without it every move is interchangeable.
    assert.ok(realisedAdvantageOnBlock(DEFAULT_MOVE_WINDOWS.lightAttack) > 0, 'a jab must be plus on block or there is no reason to throw it');
    assert.ok(realisedAdvantageOnBlock(DEFAULT_MOVE_WINDOWS.heavyAttack) <= -8, 'a heavy must be punishable or it is free');
    assert.ok(realisedAdvantageOnBlock(CROUCH_MOVE_WINDOWS.crouchHeavyAttack) <= -10, 'a low must be minus or it is a free poke');
  });

  it('is not neutral across the board — which was the defect', () => {
    const advs = Object.values(ALL).map(realisedAdvantageOnBlock);
    assert.ok(new Set(advs).size >= 4, `only ${new Set(advs).size} distinct advantages across ${advs.length} moves`);
    assert.ok(Math.max(...advs) > 0 && Math.min(...advs) < 0, 'nothing is plus and/or nothing is minus');
  });

  it('keeps every blockstun inside a playable range', () => {
    for (const [name, move] of Object.entries(ALL)) {
      const f = blockstunFramesFor(move);
      assert.ok(f >= BLOCKSTUN_CLAMP_FRAMES.min && f <= BLOCKSTUN_CLAMP_FRAMES.max, `${name} blockstun ${f} frames`);
      assert.ok(Math.abs(tekkenBlockstunSeconds(move) - f / FRAMES_PER_SECOND) < 1e-9, `${name} seconds and frames disagree`);
    }
  });

  it('derives the stun from the advantage, so changing the advantage moves the stun', () => {
    const base = DEFAULT_MOVE_WINDOWS.lightAttack;
    const plusFive: MoveWindow = { ...base, onBlock: 5 };
    const minusFive: MoveWindow = { ...base, onBlock: -5 };
    assert.equal(blockstunFramesFor(plusFive) - blockstunFramesFor(minusFive), 10,
      'a 10-frame swing in advantage must be a 10-frame swing in stun, or the two are authored independently again');
    assert.equal(realisedAdvantageOnBlock(plusFive), 5);
    assert.equal(realisedAdvantageOnBlock(minusFive), -5);
  });

  it('says so instead of lying when a move cannot support its advantage', () => {
    // A move with 40 frames of recovery after contact cannot be +1 without a
    // 41-frame blockstun, which the clamp refuses. The honest outcome is a
    // realised advantage that DIFFERS from the authored one, which the first
    // case above turns into a failure — never a silent wrong number.
    const absurd: MoveWindow = {
      startup: 10 / 60, active: 3 / 60, recovery: 60 / 60,
      animation: 'heavyAttack', hitboxStartFrame: 10, totalFrames: 73, onBlock: 1,
    };
    assert.equal(blockstunFramesFor(absurd), BLOCKSTUN_CLAMP_FRAMES.max, 'the clamp should bite');
    assert.notEqual(realisedAdvantageOnBlock(absurd), absurd.onBlock, 'and the realised advantage must expose it');
  });

  it('holds the basics at the frame counts the baseline audit checks', () => {
    // Whole frames, at 60fps, so the table and the ticker cannot drift apart.
    const frames = (s: number) => s * FRAMES_PER_SECOND;
    for (const [name, move] of Object.entries(ALL)) {
      for (const part of ['startup', 'active', 'recovery'] as const) {
        const n = frames(move[part]);
        assert.ok(Math.abs(n - Math.round(n)) < 1e-6, `${name}.${part} is ${n} frames, not a whole frame`);
      }
      assert.equal(move.totalFrames, Math.round(frames(move.startup + move.active + move.recovery)),
        `${name} totalFrames disagrees with its own startup+active+recovery`);
    }
    assert.equal(frames(DEFAULT_MOVE_WINDOWS.lightAttack.startup), 10, 'the jab is the i10 the baseline expects');
  });
});
