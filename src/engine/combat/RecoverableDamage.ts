/**
 * RECOVERABLE DAMAGE — the white bar, from Tekken 8.
 *
 * The baseline audit had this as WIRED. It was not: the probe matched the word
 * "unrecoverable" in two unrelated comments about a cinematic and about frame
 * pacing. Nothing in the game had a recoverable pool.
 *
 * WHAT IT IS FOR, and why it matters more here than it looks. This game already
 * produces damage that is not a clean hit: armour bleed (a power crush absorbing a
 * mid takes a fraction) and chip. Without a recoverable pool that damage is
 * permanent, which makes armour and chip strictly worse deals than they should be
 * and quietly turns a long round into attrition. Tekken 8's answer is that damage
 * of that kind goes to a pool which REGENERATES while you are not being hit, so
 * the pressure is real but not cumulative.
 *
 * THE RULES, and each one is there to close a way of cheating it:
 *   - only non-clean damage is recoverable. A clean hit is gone for good, or
 *     nothing in the game would be worth landing.
 *   - it regenerates on a delay after the last hit, not immediately, or trading
 *     chip becomes free.
 *   - taking a CLEAN hit converts the outstanding pool to permanent. Otherwise
 *     armouring through everything and running away would launder all of it.
 *   - it never resurrects a fighter: the pool is bounded by what was taken, and
 *     conversion cannot push health below zero twice.
 */

/** Seconds after the last hit before the pool starts coming back. */
export const RECOVER_DELAY_S = 1.2;
/** Health points returned per second once it starts. */
export const RECOVER_RATE_HP_PER_S = 40;

export interface RecoverableState {
  /** Health points currently recoverable — the white part of the bar. */
  pool: number;
  /** Seconds since the last hit of any kind. */
  sinceHitS: number;
}

export function createRecoverableState(): RecoverableState {
  return { pool: 0, sinceHitS: RECOVER_DELAY_S };
}

/**
 * Damage the fighter took that is NOT permanent — armour bleed, chip. Call
 * alongside the health subtraction, with the same number.
 */
export function addRecoverable(state: RecoverableState, amount: number): RecoverableState {
  if (!(amount > 0)) return { ...state, sinceHitS: 0 };
  return { pool: state.pool + amount, sinceHitS: 0 };
}

/**
 * A CLEAN hit. The outstanding pool becomes permanent — this is what stops a
 * fighter laundering chip by armouring through pressure and then walking away.
 * Returns the pool that was locked in, so a caller can show it.
 */
export function lockRecoverable(state: RecoverableState): { state: RecoverableState; locked: number } {
  return { state: { pool: 0, sinceHitS: 0 }, locked: state.pool };
}

/**
 * Advance by dt. Returns the state and how much health to GIVE BACK this tick.
 * The caller adds that to health — this module never touches health itself, so it
 * cannot disagree with whoever owns the number.
 */
export function tickRecoverable(
  state: RecoverableState,
  dt: number,
): { state: RecoverableState; restored: number } {
  const sinceHitS = state.sinceHitS + dt;
  if (state.pool <= 0 || sinceHitS < RECOVER_DELAY_S) {
    return { state: { ...state, sinceHitS }, restored: 0 };
  }
  const restored = Math.min(state.pool, RECOVER_RATE_HP_PER_S * dt);
  return { state: { pool: state.pool - restored, sinceHitS }, restored };
}
