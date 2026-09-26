/**
 * Owner: "there's still this issue with the little hit effects ... staying on
 * screen for too long."
 *
 * They were not lingering, they were NEVER EXPIRING. Two defects, one on each
 * side of the seam:
 *
 * 1. The rAF loop in CombatArena3D declared `tick`, registered a cleanup, and
 *    never scheduled the first frame. Dead code. The only thing that advanced
 *    the pool was a one-shot rAF at each spawn site, which ticked ONCE.
 * 2. tickHitEffectPool subtracted a hardcoded 1/60 per call while being driven
 *    off rAF, so even with the loop running an effect's real lifetime was
 *    `authored * (60 / actual fps)` — double on a 30fps phone.
 *
 * These cases pin the second half, which is the one that lives in the engine.
 * The measure is TIME, not calls: a 0.35s effect is gone after 0.35s of wall
 * clock whether that took 6 frames or 60.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHitEffectPool, spawnHitEffect, tickHitEffectPool, HIT_FX_MAX_DT } from './HitEffectSystem.ts';

const CLEAN_HIT_LIFE = 0.35;

const hit = () => spawnHitEffect(createHitEffectPool(), {
  type: 'clean_hit', screenX: 0.5, screenY: 0.5,
  worldX: 0, worldY: 1, worldZ: 0, characterColor: '#ff0000', damage: 100,
});

/** Advance `seconds` of wall clock in steps of `dt`. */
function advance(pool: ReturnType<typeof hit>, seconds: number, dt: number) {
  let p = pool;
  for (let t = 0; t < seconds - 1e-9; t += dt) p = tickHitEffectPool(p, Math.min(dt, seconds - t));
  return p;
}
const live = (p: ReturnType<typeof hit>) => p.slots.filter((s) => s.active).length;

describe('a hit effect lives for as long as it was authored', () => {
  it('is gone after its life, at 60fps', () => {
    assert.equal(live(hit()), 1);
    assert.equal(live(advance(hit(), CLEAN_HIT_LIFE + 0.02, 1 / 60)), 0);
  });

  it('is gone after the SAME time at 30fps, not twice as long', () => {
    // This is the owner's phone. With the old fixed 1/60 subtraction, 0.37s of
    // wall clock at 30fps spent only 0.185s of the effect's life and it was
    // still on screen.
    assert.equal(live(advance(hit(), CLEAN_HIT_LIFE + 0.02, 1 / 30)), 0);
  });

  it('is gone after the same time at 20fps', () => {
    assert.equal(live(advance(hit(), CLEAN_HIT_LIFE + 0.02, 1 / 20)), 0);
  });

  it('is still there just before its life runs out, at every frame rate', () => {
    // Without this the previous cases would pass on a tick that simply wipes
    // the pool on contact.
    for (const dt of [1 / 60, 1 / 30, 1 / 20]) {
      assert.equal(live(advance(hit(), CLEAN_HIT_LIFE - 0.05, dt)), 1, `${Math.round(1 / dt)}fps killed it early`);
    }
  });

  it('spends the point light and the shake in real time too', () => {
    // Both count in 60fps frames on purpose; what matters is that the frames
    // are spent at a rate, so a 3-frame flash is 50ms on any device.
    const p = tickHitEffectPool(hit(), 3 / 60);
    assert.equal(p.slots.find((s) => s.active)?.pointLight, null, 'a 3-frame flash should be over after 50ms');
    const slow = tickHitEffectPool(hit(), 1 / 60);
    assert.ok(slow.slots.find((s) => s.active)?.pointLight, 'and should still be lit after 16ms');
  });

  it('spends at most the clamp on a long stall, and clears within two frames', () => {
    // A backgrounded tab hands back a dt of seconds. The clamp stops that from
    // being spent in one go — which is deliberate, because a clamp that could
    // absorb any dt would be no clamp at all — so the guarantee is that the
    // stall moves the effect FORWARD by the clamp and it is gone immediately
    // after, not that one tick finishes it.
    const one = tickHitEffectPool(hit(), 30);
    const spent = CLEAN_HIT_LIFE - (one.slots.find((s) => s.active)?.life ?? 0);
    assert.ok(Math.abs(spent - HIT_FX_MAX_DT) < 1e-6, `a 30s stall spent ${spent}s, not the ${HIT_FX_MAX_DT}s clamp`);
    assert.equal(live(tickHitEffectPool(one, 30)), 0, 'and the next frame clears it');
  });

  it('never runs the decay backwards on a negative dt', () => {
    const p = tickHitEffectPool(hit(), -5);
    const slot = p.slots.find((s) => s.active);
    assert.ok(slot && slot.life <= CLEAN_HIT_LIFE, 'a negative dt gave the effect MORE life');
  });
});
