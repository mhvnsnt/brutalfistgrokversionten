/**
 * HIT STOP — the freeze on impact, in frames, from one table.
 *
 * tools/parity/baseline.ts put the FEEL axis at 50%: hitstop and pushback were
 * both WIRED and neither was proven. Looking properly, the problem was worse than
 * unproven — there were THREE independent hitstop systems with three different
 * scales, and they disagreed about what a heavy hit is worth:
 *
 *   1. HIT_STOP_DURATIONS (BoneHitboxSystem)   milliseconds, per attack key
 *                                              light 80 / heavy 140 / throw 180
 *   2. hitStopFramesForImpact (BannonCombat-    frames, derived from force,
 *      Contract) -> GameEngine.hitStopFrames    clamped to 3..5
 *   3. inline literals in the arena             seconds — 0.045 on a block,
 *                                              0.06 on a parry
 *
 * (2) clamps everything into a 3-5 frame band, so a throw and a jab freeze for
 * almost the same time however hard the throw hits. (3) is a third set of magic
 * numbers next to the table that already had the answer.
 *
 * ONE SOURCE, EXPRESSED IN FRAMES, because the timebase is frames — the same
 * reason blockstun is derived in frames. The authored table stays authoritative
 * for a clean hit; the block and parry cases are named FRACTIONS of the hit they
 * came from rather than their own numbers, so tuning the table tunes everything.
 *
 * WHY A BLOCK STILL FREEZES AT ALL. Without it a blocked hit reads as a whiff and
 * the defender cannot tell they guarded correctly. It is shorter than a clean hit
 * because the point of blocking is that you keep your footing.
 */
import { HIT_STOP_DURATIONS, HIT_STOP_DEFAULT_MS } from '../locomotion/BoneHitboxSystem.ts';
import { FRAMES_PER_SECOND } from './FighterStateMachine.ts';

/** A block freezes for a third of the clean hit — enough to read, not to punish. */
export const BLOCK_HITSTOP_FRACTION = 1 / 3;
/** A parry freezes longer than a block: the attacker is being stopped dead. */
export const PARRY_HITSTOP_FRACTION = 1 / 2;
/** Nothing freezes for less than this, or the impact does not register at all. */
export const MIN_HITSTOP_FRAMES = 2;

const msToFrames = (ms: number) => Math.round((ms / 1000) * FRAMES_PER_SECOND);

/**
 * Frames of freeze for a clean hit by this attack. The key is the move's
 * animation name, which is what HIT_STOP_DURATIONS is keyed on.
 */
export function hitStopFramesFor(attackKey: string | undefined | null): number {
  const ms = (attackKey ? HIT_STOP_DURATIONS[attackKey] : undefined) ?? HIT_STOP_DEFAULT_MS;
  return Math.max(MIN_HITSTOP_FRAMES, msToFrames(ms));
}

/** Frames of freeze when that same attack is blocked. */
export function blockHitStopFramesFor(attackKey: string | undefined | null): number {
  return Math.max(MIN_HITSTOP_FRAMES, Math.round(hitStopFramesFor(attackKey) * BLOCK_HITSTOP_FRACTION));
}

/** Frames of freeze when that same attack is parried. */
export function parryHitStopFramesFor(attackKey: string | undefined | null): number {
  return Math.max(MIN_HITSTOP_FRAMES, Math.round(hitStopFramesFor(attackKey) * PARRY_HITSTOP_FRACTION));
}

/** Seconds, for the arena's timer, which counts in seconds. */
export const hitStopSecondsFor = (k?: string | null) => hitStopFramesFor(k) / FRAMES_PER_SECOND;
export const blockHitStopSecondsFor = (k?: string | null) => blockHitStopFramesFor(k) / FRAMES_PER_SECOND;
export const parryHitStopSecondsFor = (k?: string | null) => parryHitStopFramesFor(k) / FRAMES_PER_SECOND;

/**
 * Does a heavier attack freeze longer? This is the property that makes hitstop
 * READ as weight rather than as lag, and it is the one the force-derived path
 * could not deliver because it clamped everything into a 3-5 frame band.
 */
export function hitStopIsWeighted(keys: readonly string[]): boolean {
  const frames = keys.map(hitStopFramesFor);
  return new Set(frames).size > 1 && frames.every((f, i) => i === 0 || f >= frames[i - 1]);
}
