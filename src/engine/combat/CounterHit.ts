/**
 * COUNTER HIT — the punishment for pressing at the wrong time.
 *
 * The baseline audit had this as WIRED, and it was: `isCounter` is derived in the
 * arena from `prevP2State === Startup || Active`, and it plays a bigger spark and
 * a different sound. Measured, that is ALL it does — no damage bonus, no stronger
 * reaction. So the feedback exists and the mechanic behind it does not.
 *
 * In the lineage a counter hit is one of the core loops: it is how the game
 * punishes a player for attacking into an attack, and a large part of the move
 * list only launches ON counter hit. Without a consequence, the spark is telling
 * the player something happened when nothing did.
 *
 * WHERE THE DETECTION BELONGS. It was derived twice in the arena, once per side,
 * from a state snapshot taken before the tick. The DEFENDER already knows whether
 * it is mid-startup of its own move — that is `ownMoveFrame()` — so the engine can
 * answer it, once, and the arena can read the answer instead of re-deriving it.
 *
 * A counter hit is NOT a critical hit. It multiplies a modest amount and, more
 * importantly, upgrades the REACTION, because being interrupted mid-swing is what
 * turns a poke into a punish opportunity. Damage alone would be the boring half.
 */
import type { MoveWindow } from './FighterStateMachine.ts';

/** Damage multiplier on a counter hit. Modest on purpose — the reaction is the prize. */
export const COUNTER_HIT_DAMAGE_MULTIPLIER = 1.25;
/**
 * Extra hitstun, in seconds, on a counter hit. This is the part that turns a
 * counter into a combo opening rather than a louder normal hit.
 */
export const COUNTER_HIT_BONUS_HITSTUN_S = 0.12;

export type CounterWindow = 'none' | 'startup' | 'active';

/**
 * Was the defender attacking, and how far in? Startup is the true counter — the
 * swing had not come out yet. Being hit during your own ACTIVE frames is a trade,
 * which the lineage treats as a counter too but is worth naming separately so a
 * caller can tell them apart.
 */
export function counterWindowOf(
  own: { move: MoveWindow; frame: number } | null,
  fps = 60,
): CounterWindow {
  if (!own) return 'none';
  const startupFrames = own.move.hitboxStartFrame ?? Math.round(own.move.startup * fps);
  const activeEnd = own.move.hitboxEndFrame
    ?? Math.round((own.move.startup + own.move.active) * fps);
  if (own.frame < startupFrames) return 'startup';
  if (own.frame <= activeEnd) return 'active';
  // Recovery is not a counter — it is just being open, which the frame
  // advantage system already accounts for.
  return 'none';
}

export const isCounterWindow = (w: CounterWindow): boolean => w !== 'none';

/** Damage after a counter hit. A non-counter is exactly the damage passed in. */
export function counterScaledDamage(window: CounterWindow, damage: number): number {
  return isCounterWindow(window) ? Math.round(damage * COUNTER_HIT_DAMAGE_MULTIPLIER) : damage;
}

/** Extra hitstun a counter hit buys the attacker, in seconds. */
export function counterBonusHitstun(window: CounterWindow): number {
  return isCounterWindow(window) ? COUNTER_HIT_BONUS_HITSTUN_S : 0;
}
