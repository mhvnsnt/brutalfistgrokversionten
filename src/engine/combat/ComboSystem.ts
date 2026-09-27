/**
 * ComboSystem — detects consecutive hits within a 2-second window,
 * tracks live combo count, and computes damage scaling per successive hit.
 *
 * Damage scaling: 10–25% reduction per successive hit (capped at 75% total reduction).
 * Hit 1: 100%, Hit 2: 90%, Hit 3: 80%, Hit 4: 75%, Hit 5+: 75%
 */
import { WALL_SPLAT_BONUS_FRAMES } from './WallSystem.ts';

export interface ComboState {
  count: number;
  /** Damage multiplier for the NEXT hit (0.75–1.0) */
  damageMultiplier: number;
  /** Timestamp of the last registered hit */
  lastHitTime: number;
  /** Whether the combo is still active (within 2s window) */
  active: boolean;
  /** Total combo damage accumulated */
  totalDamage: number;
  /** Player this combo belongs to */
  player: 'p1' | 'p2';
}

export interface ComboSystemState {
  p1Combo: ComboState;
  p2Combo: ComboState;
}

export const COMBO_WINDOW_MS = 2000; // 2-second window
/**
 * EXTRA MILLISECONDS A WALL SPLAT BUYS THE ATTACKER.
 *
 * WallSystem declares `WALL_SPLAT_BONUS_FRAMES = 18` — "extra frames attacker
 * gets to chain combo" — and builds it into `comboExtensionFrames` on every
 * splat. Measured: NOTHING outside WallSystem ever read that field, so the splat
 * staggered the defender and gave the attacker nothing. A wall carry that buys no
 * frames is scenery; the free frames ARE the point of a wall.
 *
 * Derived from that constant rather than declared beside it, so the two cannot
 * drift apart.
 */
export const WALL_SPLAT_COMBO_EXTENSION_MS = (WALL_SPLAT_BONUS_FRAMES / 60) * 1000;
const BASE_SCALING_PER_HIT = 0.10; // 10% reduction per hit
const MIN_MULTIPLIER = 0.75; // floor at 75% damage

export function createComboState(player: 'p1' | 'p2'): ComboState {
  return {
    count: 0,
    damageMultiplier: 1.0,
    lastHitTime: 0,
    active: false,
    totalDamage: 0,
    player,
  };
}

/**
 * Register a new hit and update combo state.
 * Returns the scaled damage value and updated combo state.
 */
export function registerHit(
  state: ComboState,
  rawDamage: number,
  now: number,
  /**
   * The attacker's wall-splat extension window, if one is open. Pass the
   * defender's `wallSplat.comboExtensionFrames` — the field WallSystem has always
   * written and nothing has ever read. Absent or 0 is exactly the old behaviour.
   */
  wallExtensionFrames = 0,
): { scaledDamage: number; newState: ComboState } {
  const timeSinceLast = now - state.lastHitTime;
  const window = COMBO_WINDOW_MS + (wallExtensionFrames > 0 ? WALL_SPLAT_COMBO_EXTENSION_MS : 0);
  const withinWindow = state.active && timeSinceLast <= window;

  let newCount: number;
  let newMultiplier: number;

  if (withinWindow) {
    // Extend combo
    newCount = state.count + 1;
    // Each successive hit reduces damage by 10–25% (we use 10% per hit)
    newMultiplier = Math.max(MIN_MULTIPLIER, 1.0 - (newCount - 1) * BASE_SCALING_PER_HIT);
  } else {
    // New combo
    newCount = 1;
    newMultiplier = 1.0;
  }

  const scaledDamage = Math.round(rawDamage * newMultiplier);

  const newState: ComboState = {
    count: newCount,
    damageMultiplier: newMultiplier,
    lastHitTime: now,
    active: true,
    totalDamage: withinWindow ? state.totalDamage + scaledDamage : scaledDamage,
    player: state.player,
  };

  return { scaledDamage, newState };
}

/**
 * Tick the combo system — expire combos that exceed the 2s window.
 * Call this every frame.
 */
export function tickComboSystem(
  p1Combo: ComboState,
  p2Combo: ComboState,
  now: number,
): { p1Combo: ComboState; p2Combo: ComboState } {
  const expireCombo = (combo: ComboState): ComboState => {
    if (!combo.active) return combo;
    if (now - combo.lastHitTime > COMBO_WINDOW_MS) {
      return { ...combo, active: false };
    }
    return combo;
  };

  return {
    p1Combo: expireCombo(p1Combo),
    p2Combo: expireCombo(p2Combo),
  };
}

/** Get display label for damage scaling */
export function getScalingLabel(multiplier: number): string {
  const pct = Math.round(multiplier * 100);
  if (pct >= 100) return '';
  return `${pct}% DMG`;
}
