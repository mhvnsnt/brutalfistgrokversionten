import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FrameDataHitboxSystem, type HitboxGeometry } from './FrameDataHitbox.ts';
import type { MoveWindow } from './FighterStateMachine.ts';

const move = (reach: number): MoveWindow => ({
  startup: 0.1, active: 0.1, recovery: 0.2, totalFrames: 24,
  animation: 'heavyAttack', hitboxStartFrame: 1, hitboxEndFrame: 12,
  damage: 100, isSpecial: false, contactReach: reach,
});

describe('measured contact envelope', () => {
  it('rejects an early hit outside the fighter-scale hurtbox envelope', () => {
    const system = new FrameDataHitboxSystem();
    system.update({ active: true, currentFrame: 1, move: move(0.55) });
    // Reach-based hitbox center is ~0.40m forward and width is ~0.31m;
    // with a 0.42m defender half-width, 1.0m separation is outside the envelope.
    assert.equal(system.checkCollision(0, 0, 1, 1.0, 0, false, 1), null);
  });

  it('accepts contact when the defender enters the measured envelope', () => {
    const system = new FrameDataHitboxSystem();
    system.update({ active: true, currentFrame: 1, move: move(0.8) });
    assert.ok(system.checkCollision(0, 0, 1, 0.75, 0, false, 1));
  });
});
