/**
 * RAGE — the comeback state, built ON the Finisher shell that already existed.
 *
 * tools/parity/baseline.ts flagged rage as DECLARED and dead, and it was half
 * right. There is no `RageSystem` in the history of this repo, but there IS a
 * health-gated cinematic super with armoured startup, and it is called
 * `Finisher`:
 *
 *     FINISHER_HP_THRESHOLD   = 0.25    // available below 25% HP
 *     FINISHER_DAMAGE         = 350
 *     FINISHER_STARTUP_FRAMES = 15      // "super armor startup"
 *
 * That is a Rage Art. Measured, though: `FINISHER_HP_THRESHOLD`,
 * `FINISHER_DAMAGE`, `FINISHER_STARTUP_FRAMES` and `HEAT_ATTACKS` had ZERO
 * readers outside OverdriveSystem. `createOverdriveState` was called and ticked,
 * so the state existed and advanced; the numbers that would have made it mean
 * something were read by nobody.
 *
 * SO THIS DOES NOT INVENT A SECOND MODIFIER SYSTEM, which is the standing rule
 * across these projects and the reason this file imports its threshold and its
 * damage rather than declaring new ones. What was genuinely absent is the half
 * of rage that is not the super move: BEING enraged. In the lineage, crossing the
 * threshold gives a damage bonus and a visible state for the whole time you are
 * under it — that is what makes a comeback feel possible before you spend
 * anything, and it is the part nothing here had.
 *
 * WHY THE DAMAGE BONUS IS SMALL. A comeback mechanic that swings a round on its
 * own reads as the game deciding the match. The multiplier is a nudge to the
 * arithmetic of a punish, not a new tier of damage.
 */
import {
  FINISHER_HP_THRESHOLD,
  FINISHER_DAMAGE,
  FINISHER_STARTUP_FRAMES,
} from './OverdriveSystem.ts';
import { rageArtWindow, type DefensiveWindow } from './DefensiveWindows.ts';

/** Health fraction at or below which a fighter is enraged. */
export const RAGE_THRESHOLD = FINISHER_HP_THRESHOLD;
/** Outgoing damage multiplier while enraged. A nudge, not a new tier. */
export const RAGE_DAMAGE_MULTIPLIER = 1.12;
/** The Rage Art costs the state: you get one, and being enraged ends with it. */
export const RAGE_ART_DAMAGE = FINISHER_DAMAGE;
export const RAGE_ART_STARTUP_FRAMES = FINISHER_STARTUP_FRAMES;

export interface RageState {
  /** Under the threshold right now. */
  enraged: boolean;
  /** The Rage Art is still unspent. Enraged and unspent means it is available. */
  artAvailable: boolean;
  /** Set on the frame rage begins, so presentation can fire once. */
  justEntered: boolean;
}

export function createRageState(): RageState {
  return { enraged: false, artAvailable: true, justEntered: false };
}

/**
 * Advance rage from the fighter's health. Called every tick; cheap and pure.
 *
 * Rage does NOT come back when health does. A round where health is restored
 * mid-match would otherwise hand out a second Rage Art, and `artAvailable` is
 * what stops that — it is cleared by spending, never by healing.
 */
export function tickRage(state: RageState, hp: number, maxHp: number): RageState {
  const fraction = maxHp > 0 ? hp / maxHp : 0;
  const enraged = hp > 0 && fraction <= RAGE_THRESHOLD;
  return {
    enraged,
    artAvailable: state.artAvailable,
    justEntered: enraged && !state.enraged,
  };
}

/** Outgoing damage after rage. Not enraged is exactly the damage passed in. */
export function rageScaledDamage(state: RageState, damage: number): number {
  return state.enraged ? Math.round(damage * RAGE_DAMAGE_MULTIPLIER) : damage;
}

/** May this fighter spend a Rage Art right now? */
export function rageArtAvailable(state: RageState): boolean {
  return state.enraged && state.artAvailable;
}

/**
 * Spend it. The state stays `enraged` — health has not changed — but the art is
 * gone, which is what makes it a decision about WHEN rather than a button that
 * is simply on below 25%.
 */
export function spendRageArt(state: RageState): RageState {
  return { ...state, artAvailable: false, justEntered: false };
}

/**
 * The Rage Art's own defensive window: invincible through startup, every height.
 * This is the only window in the game that beats a low, which is what makes it a
 * genuine reversal rather than a slower heavy. See DefensiveWindows.
 */
export function rageArtDefence(): DefensiveWindow[] {
  return [rageArtWindow(RAGE_ART_STARTUP_FRAMES)];
}

/** A fresh round: health is back, so rage is off — and the art is back with it. */
export function resetRageForRound(): RageState {
  return createRageState();
}
