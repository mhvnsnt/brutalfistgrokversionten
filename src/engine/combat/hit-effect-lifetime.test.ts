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
import { createHitEffectPool, spawnHitEffect, tickHitEffectPool, getHitEffectRenderData, HIT_FX_MAX_DT, HIT_FX_CLEAN_LIFE, sparkReachCss } from './HitEffectSystem.ts';

const CLEAN_HIT_LIFE = HIT_FX_CLEAN_LIFE;

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
    // A clean hit's glint is 2 frames. What matters is that those frames are
    // spent at a rate, so the flash is ~33ms on any device.
    const p = tickHitEffectPool(hit(), 2 / 60);
    assert.equal(p.slots.find((s) => s.active)?.pointLight, null, 'a 2-frame flash should be over after 33ms');
    const slow = tickHitEffectPool(hit(), 1 / 60);
    assert.ok(slow.slots.find((s) => s.active)?.pointLight, 'and should still be lit after 16ms');
  });

  it('a stall longer than the spark clears it, and never spends more than the clamp', () => {
    // Hit sparks are shorter than the stall clamp now, so a backgrounded tab
    // comes back to an empty pool instead of a disc frozen mid-flight.
    const one = tickHitEffectPool(hit(), 30);
    assert.equal(live(one), 0, 'a 30s stall left the spark on screen');
    // The clamp is still the ceiling: a spark cannot be rewound, and a
    // single tick cannot subtract more than HIT_FX_MAX_DT even if asked.
    const paused = tickHitEffectPool(hit(), HIT_FX_MAX_DT);
    const slot = paused.slots.find((s) => s.active);
    const spent = CLEAN_HIT_LIFE - (slot?.life ?? 0);
    assert.ok(spent <= HIT_FX_MAX_DT + 1e-9, `a tick spent ${spent}s, over the clamp`);
  });

  it('never runs the decay backwards on a negative dt', () => {
    const p = tickHitEffectPool(hit(), -5);
    const slot = p.slots.find((s) => s.active);
    assert.ok(slot && slot.life <= CLEAN_HIT_LIFE, 'a negative dt gave the effect MORE life');
  });

  it('is a contact glint, not a faction-colored disc', () => {
    const spark = (type: 'clean_hit' | 'counter_hit' | 'block', damage = 80) =>
      getHitEffectRenderData(spawnHitEffect(createHitEffectPool(), {
        type, screenX: 0, screenY: 0, worldX: 0, worldY: 1, worldZ: 0,
        characterColor: '#facc15', damage,
      }))[0];
    const clean = spark('clean_hit');
    const counter = spark('counter_hit');
    const block = spark('block');
    assert.ok(clean.coronaRadius <= 12, `clean corona ${clean.coronaRadius}px is still a disc`);
    assert.ok(clean.coreRadius < clean.coronaRadius);
    assert.ok(counter.coronaRadius > clean.coronaRadius, 'a counter should read bigger than a jab');
    assert.ok(counter.coronaRadius <= 18, `counter corona ${counter.coronaRadius}px is still a disc`);
    assert.ok(block.coronaRadius < clean.coronaRadius, 'a block spark is smaller than a hit');
    const pool = spawnHitEffect(createHitEffectPool(), {
      type: 'clean_hit', screenX: 0, screenY: 0, worldX: 0, worldY: 1, worldZ: 0,
      characterColor: '#facc15', damage: 80,
    });
    const light = pool.slots.find((s) => s.active)?.pointLight;
    assert.ok(light && light.intensity < 1.5, `point light ${light?.intensity} still floods the stage`);
    assert.equal(light?.color.toLowerCase(), '#facc15', 'the spark lost the attacker color');
    const shards = pool.slots.find((s) => s.active)?.streaks ?? [];
    assert.ok(shards.some((s) => s.color.toLowerCase() === '#facc15'), 'no shard carries the fighter color');
    assert.ok(pool.screenFlash < 0.08, `screen flash ${pool.screenFlash} whites the frame out`);

    // The owner's screenshot was 675×1500. A spark there has to read, and it
    // must not be able to become the ring that filled the frame.
    const phone = { w: 675, h: 1500 };
    const cleanReach = sparkReachCss(phone.w, phone.h, 'clean_hit', 1);
    const counterReach = sparkReachCss(phone.w, phone.h, 'counter_hit', 1.25);
    const blockReach = sparkReachCss(phone.w, phone.h, 'block', 0.8);
    assert.ok(cleanReach > 40 && cleanReach < 90, `clean shard ${cleanReach}px`);
    assert.ok(counterReach > cleanReach && counterReach < 120, `counter shard ${counterReach}px`);
    assert.ok(blockReach < cleanReach, 'a block slash is smaller than a hit');
    assert.ok(cleanReach <= Math.min(phone.w, phone.h) * 0.12 + 0.01);
  });
});
