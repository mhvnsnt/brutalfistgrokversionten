/**
 * ATTACK LEVELS FOR THE 286 MOVES THAT NEVER HAD ONE.
 *
 * MEASURED: every imported move in public/motion/movesets.json carries no attack
 * level, so all 286 default to 'mid'. That makes the entire high/mid/low layer
 * inert for everything but the six hand-authored basics — the Tekken guard, the low
 * parry, a high whiffing over a crouch, a power crush covering high and mid but not
 * low. Six moves had a height game and 286 did not.
 *
 * DERIVED FROM THE FRAMES, by tools/motion/attack_level.mjs: the striking limb is
 * the one that travels furthest from its own rest, contact is where that travel
 * peaks, and the level is that limb's height as a fraction of standing height
 * against bands read off the rig — under the knee is low, at or above the shoulders
 * is high. Nothing consults a filename.
 *
 * AUTHORED WINS. The derivation fills a GAP; it does not overrule a human. The six
 * basics declare their own levels and keep them, and so does any imported move that
 * ever gains one. The boundary cases are why: CROUCHINGKICK measures 32% of
 * standing height against a 31% knee cut and comes out 'mid' by one point, while
 * the crouch move window authors it 'low' deliberately. Tuning the threshold until
 * that one clip agreed would be fitting the measure to the answer.
 */
import type { AttackLevel } from './DefensiveWindows.ts';

let derived: ReadonlyMap<string, AttackLevel> = new Map();

/** Load the measured levels. Nothing loaded = nothing filled in. */
export function setDerivedAttackLevels(levels: Iterable<readonly [string, AttackLevel]>): void {
  derived = new Map(levels);
}

export function derivedAttackLevelCount(): number {
  return derived.size;
}

export function derivedAttackLevel(clipName: string | undefined | null): AttackLevel | null {
  if (!clipName) return null;
  return derived.get(clipName.replace(/__(upper|lower)$/, '')) ?? null;
}

/**
 * The level to use for a move: its own if it has one, otherwise the level derived
 * from its clip, otherwise 'mid' — which is what everything silently was before.
 */
export function attackLevelFor(
  authoredLevel: AttackLevel | undefined | null,
  clipName: string | undefined | null,
): AttackLevel {
  return authoredLevel ?? derivedAttackLevel(clipName) ?? 'mid';
}

/** Did this move get a real height, from either source? Used by the audit. */
export function hasRealAttackLevel(
  authoredLevel: AttackLevel | undefined | null,
  clipName: string | undefined | null,
): boolean {
  return Boolean(authoredLevel ?? derivedAttackLevel(clipName));
}
