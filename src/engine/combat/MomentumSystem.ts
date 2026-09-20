/**
 * MomentumSystem — the special meter.
 *
 * Owner: "ki will be momentum/special meter". Previously named for Tekken's
 * Ki; the mechanic is unchanged, the vocabulary is ours.
 *
 * Triggered by pressing all four limb buttons simultaneously.
 * Effects:
 *  - Visual: glowing aura on hands (communicated via state flags)
 *  - Buff: next attack is guaranteed Counter Hit
 *  - Penalty: cannot block while charge is active
 *  - Chip: if opponent blocks a momentum-charged attack, they take chip damage
 *
 * Duration: ~2 seconds (120 frames at 60fps) or until next attack lands.
 */

export interface MomentumChargeState {
  /** Whether Momentum is currently active */
  active: boolean;
  /** Frames remaining in the charge window */
  framesRemaining: number;
  /** Whether the next attack will be a guaranteed counter hit */
  nextAttackIsCounter: boolean;
  /** Cannot block while active */
  blockingDisabled: boolean;
  /** Chip damage multiplier when opponent blocks a momentum-charged attack */
  chipDamageMultiplier: number;
}

export const MOMENTUM_CHARGE_DURATION_FRAMES = 120; // 2 seconds at 60fps
export const MOMENTUM_CHARGE_CHIP_MULTIPLIER = 0.15; // 15% chip damage on block

export function createMomentumChargeState(): MomentumChargeState {
  return {
    active: false,
    framesRemaining: 0,
    nextAttackIsCounter: false,
    blockingDisabled: false,
    chipDamageMultiplier: 0,
  };
}

/**
 * Check if all four limb buttons are pressed simultaneously (1+2+3+4).
 * lp=1, rp=2, lk=3, rk=4
 */
export function isMomentumChargeInput(input: {
  lp?: boolean; rp?: boolean; lk?: boolean; rk?: boolean;
}): boolean {
  return !!(input.lp && input.rp && input.lk && input.rk);
}

/**
 * Tick the Momentum state machine.
 * Call every frame (dt in seconds).
 * Returns updated state.
 */
export function tickMomentumCharge(
  state: MomentumChargeState,
  input: { lp?: boolean; rp?: boolean; lk?: boolean; rk?: boolean },
  attackLanded: boolean,
  dt: number,
): MomentumChargeState {
  // Activate on 1+2+3+4 press (only when not already active)
  if (!state.active && isMomentumChargeInput(input)) {
    return {
      active: true,
      framesRemaining: MOMENTUM_CHARGE_DURATION_FRAMES,
      nextAttackIsCounter: true,
      blockingDisabled: true,
      chipDamageMultiplier: MOMENTUM_CHARGE_CHIP_MULTIPLIER,
    };
  }

  if (!state.active) return state;

  // Consume on attack landing
  if (attackLanded) {
    return createMomentumChargeState();
  }

  // Tick down
  const framesRemaining = state.framesRemaining - dt * 60;
  if (framesRemaining <= 0) {
    return createMomentumChargeState();
  }

  return { ...state, framesRemaining };
}

/**
 * Apply Momentum counter-hit bonus to damage.
 * Counter hits deal 1.25x damage in Tekken.
 */
export function applyMomentumChargeCounterHit(baseDamage: number): number {
  return Math.round(baseDamage * 1.25);
}
