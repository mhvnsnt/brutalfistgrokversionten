/**
 * OverdriveSystem — Tekken 8-style Overdrive stance mode
 *
 * Overdrive (2+3 / RP+LK):
 *  - Activates Overdrive state (stance mode) for OVERDRIVE_DURATION_FRAMES
 *  - During Overdrive state, fighter gets access to stance-specific attacks
 *  - Overdrive state can be broken by opponent landing a super armor or specific moves
 *  - Overdrive itself is an attack — if it connects, it deals damage and activates Heat
 *  - If Overdrive is blocked, Overdrive state still activates but with reduced duration
 *  - Overdrive state has recovery frames when it expires naturally
 *
 * SuperArmor (passive super armor):
 *  - Activated by specific input (hold back + heavy)
 *  - Absorbs incoming attacks without flinching (super armor)
 *  - But takes reduced health bleed (chip damage) while absorbing
 *  - super armor is broken if hit by a throw or a grab
 *  - super armor has a limited active window (SUPER_ARMOR_ACTIVE_FRAMES)
 *
 * Finisher (cinematic super move):
 *  - Only available when HP < 25% (Finisher threshold)
 *  - Triggers a cinematic camera sequence
 *  - Deals massive damage (FINISHER_DAMAGE)
 *  - Fires announcer event on activation
 *  - Can only be used ONCE per match
 *  - Has super armor during startup frames
 */

// ── Overdrive constants ──────────────────────────────────────────────────────
export const OVERDRIVE_DURATION_FRAMES = 300;        // ~5 seconds at 60fps
export const OVERDRIVE_DAMAGE = 120;           // damage if Overdrive connects
export const OVERDRIVE_BLOCKED_DURATION = 180; // reduced Heat duration if blocked
export const HEAT_RECOVERY_FRAMES = 30;         // recovery frames when Heat expires
export const HEAT_BREAK_STAGGER_FRAMES = 25;    // stagger frames when Heat is broken

// ── Heat stance-specific attack definitions ───────────────────────────────────
export interface HeatAttack {
  id: string;
  name: string;
  damage: number;
  startupFrames: number;
  activeFrames: number;
  recoveryFrames: number;
  animation: string;
  /** Whether this attack is only available in Overdrive state */
  heatOnly: boolean;
  /** Whether this attack extends Heat duration on hit */
  extendsHeat: boolean;
  heatExtensionFrames: number;
}

export const HEAT_ATTACKS: HeatAttack[] = [
  {
    id: 'heat_smash',
    name: 'Heat Smash',
    damage: 200,
    startupFrames: 14,
    activeFrames: 8,
    recoveryFrames: 28,
    animation: 'heavyAttack',
    heatOnly: true,
    extendsHeat: false,
    heatExtensionFrames: 0,
  },
  {
    id: 'heat_dash',
    name: 'Heat Dash',
    damage: 80,
    startupFrames: 8,
    activeFrames: 12,
    recoveryFrames: 18,
    animation: 'lightAttack',
    heatOnly: true,
    extendsHeat: true,
    heatExtensionFrames: 60,
  },
  {
    id: 'heat_engager',
    name: 'Heat Engager',
    damage: 150,
    startupFrames: 18,
    activeFrames: 10,
    recoveryFrames: 35,
    animation: 'heavyAttack',
    heatOnly: true,
    extendsHeat: true,
    heatExtensionFrames: 90,
  },
];

// ── super armor constants ─────────────────────────────────────────────────────
export const SUPER_ARMOR_ACTIVE_FRAMES = 45;    // frames of super armor
export const SUPER_ARMOR_HEALTH_BLEED_PCT = 0.15; // 15% of incoming damage taken as chip
export const SUPER_ARMOR_STARTUP_FRAMES = 12;   // frames before armor activates
export const SUPER_ARMOR_RECOVERY_FRAMES = 38;  // recovery after super armor ends

// ── Finisher constants ────────────────────────────────────────────────────────
export const FINISHER_HP_THRESHOLD = 0.25;      // available below 25% HP
export const FINISHER_DAMAGE = 350;             // cinematic super damage
export const FINISHER_STARTUP_FRAMES = 15;      // super armor startup
export const FINISHER_CINEMATIC_DURATION_MS = 2200; // cinematic sequence duration
export const FINISHER_RECOVERY_FRAMES = 60;     // recovery after Finisher

// ── Overdrive state ────────────────────────────────────────────────────────────────
export interface OverdriveState {
  /** Whether Overdrive state is currently active */
  active: boolean;
  /** Frames remaining in Overdrive state */
  framesRemaining: number;
  /** Whether Overdrive was blocked (reduced duration) */
  activatedOnBlock: boolean;
  /** Whether Overdrive state was broken by opponent */
  broken: boolean;
  /** Stagger frames remaining after Heat break */
  breakStaggerFrames: number;
  /** Whether fighter is in Heat recovery (just expired) */
  inRecovery: boolean;
  /** Recovery frames remaining */
  recoveryFrames: number;
  /** Whether Overdrive has been used this round */
  used: boolean;
}

export function createOverdriveState(): OverdriveState {
  return {
    active: false,
    framesRemaining: 0,
    activatedOnBlock: false,
    broken: false,
    breakStaggerFrames: 0,
    inRecovery: false,
    recoveryFrames: 0,
    used: false,
  };
}

// ── super armor State ─────────────────────────────────────────────────────────
export interface SuperArmorState {
  /** Whether super armor is currently active */
  active: boolean;
  /** Whether super armor is currently absorbing */
  armorActive: boolean;
  /** Frames remaining in active armor window */
  armorFramesRemaining: number;
  /** Startup frames remaining before armor activates */
  startupFramesRemaining: number;
  /** Recovery frames remaining after super armor */
  recoveryFramesRemaining: number;
  /** Total chip damage absorbed this super armor */
  chipDamageAbsorbed: number;
}

export function createSuperArmorState(): SuperArmorState {
  return {
    active: false,
    armorActive: false,
    armorFramesRemaining: 0,
    startupFramesRemaining: 0,
    recoveryFramesRemaining: 0,
    chipDamageAbsorbed: 0,
  };
}

// ── Finisher State ────────────────────────────────────────────────────────────
export interface FinisherState {
  /** Whether Finisher is currently executing */
  executing: boolean;
  /** Whether Finisher has been used this match (one use per match) */
  usedThisMatch: boolean;
  /** Whether Finisher is available (HP below threshold) */
  available: boolean;
  /** Whether cinematic sequence is playing */
  cinematicActive: boolean;
  /** Startup frames remaining (super armor window) */
  startupFramesRemaining: number;
  /** Recovery frames remaining after Finisher */
  recoveryFramesRemaining: number;
}

export function createFinisherState(): FinisherState {
  return {
    executing: false,
    usedThisMatch: false,
    available: false,
    cinematicActive: false,
    startupFramesRemaining: 0,
    recoveryFramesRemaining: 0,
  };
}

// ── Overdrive activation ─────────────────────────────────────────────────────
/**
 * Activate Overdrive state.
 * @param onBlock - true if Overdrive was blocked (reduced duration)
 */
export function activateHeat(heat: OverdriveState, onBlock: boolean): OverdriveState {
  if (heat.used) return heat; // can only use once per round
  return {
    ...heat,
    active: true,
    framesRemaining: onBlock ? OVERDRIVE_BLOCKED_DURATION : OVERDRIVE_DURATION_FRAMES,
    activatedOnBlock: onBlock,
    broken: false,
    breakStaggerFrames: 0,
    inRecovery: false,
    recoveryFrames: 0,
    used: true,
  };
}

/**
 * Break Overdrive state (opponent landed super armor or specific move).
 */
export function breakHeat(heat: OverdriveState): OverdriveState {
  if (!heat.active) return heat;
  return {
    ...heat,
    active: false,
    framesRemaining: 0,
    broken: true,
    breakStaggerFrames: HEAT_BREAK_STAGGER_FRAMES,
  };
}

/**
 * Extend Heat duration when a Heat Engager connects.
 */
export function extendHeat(heat: OverdriveState, extensionFrames: number): OverdriveState {
  if (!heat.active) return heat;
  return {
    ...heat,
    framesRemaining: Math.min(heat.framesRemaining + extensionFrames, OVERDRIVE_DURATION_FRAMES),
  };
}

/**
 * Tick Overdrive state each frame.
 */
export function tickHeat(heat: OverdriveState): OverdriveState {
  if (heat.breakStaggerFrames > 0) {
    return { ...heat, breakStaggerFrames: heat.breakStaggerFrames - 1 };
  }
  if (heat.inRecovery) {
    const newRecovery = heat.recoveryFrames - 1;
    return { ...heat, recoveryFrames: newRecovery, inRecovery: newRecovery > 0 };
  }
  if (!heat.active) return heat;

  const newFrames = heat.framesRemaining - 1;
  if (newFrames <= 0) {
    // Heat expired — enter recovery
    return {
      ...heat,
      active: false,
      framesRemaining: 0,
      inRecovery: true,
      recoveryFrames: HEAT_RECOVERY_FRAMES,
    };
  }
  return { ...heat, framesRemaining: newFrames };
}

// ── super armor activation ────────────────────────────────────────────────────
export function activateSuperArmor(pc: SuperArmorState): SuperArmorState {
  if (pc.active || pc.recoveryFramesRemaining > 0) return pc;
  return {
    ...pc,
    active: true,
    armorActive: false,
    armorFramesRemaining: SUPER_ARMOR_ACTIVE_FRAMES,
    startupFramesRemaining: SUPER_ARMOR_STARTUP_FRAMES,
    recoveryFramesRemaining: 0,
    chipDamageAbsorbed: 0,
  };
}

/**
 * Process incoming damage through super armor armor.
 * Returns { absorbed: true, chipDamage } if armor absorbs the hit.
 * Returns { absorbed: false } if armor is not active or hit is a throw.
 */
export function processSuperArmorHit(
  pc: SuperArmorState,
  incomingDamage: number,
  isThrow: boolean,
): { absorbed: boolean; chipDamage: number; newState: SuperArmorState } {
  if (!pc.armorActive || isThrow) {
    return { absorbed: false, chipDamage: incomingDamage, newState: pc };
  }
  const chipDamage = Math.floor(incomingDamage * SUPER_ARMOR_HEALTH_BLEED_PCT);
  return {
    absorbed: true,
    chipDamage,
    newState: {
      ...pc,
      chipDamageAbsorbed: pc.chipDamageAbsorbed + chipDamage,
    },
  };
}

/**
 * Tick super armor state each frame.
 */
export function tickSuperArmor(pc: SuperArmorState): SuperArmorState {
  if (!pc.active) return pc;

  if (pc.startupFramesRemaining > 0) {
    const newStartup = pc.startupFramesRemaining - 1;
    return {
      ...pc,
      startupFramesRemaining: newStartup,
      armorActive: newStartup === 0,
    };
  }

  if (pc.armorActive) {
    const newArmor = pc.armorFramesRemaining - 1;
    if (newArmor <= 0) {
      return {
        ...pc,
        armorActive: false,
        armorFramesRemaining: 0,
        active: false,
        recoveryFramesRemaining: SUPER_ARMOR_RECOVERY_FRAMES,
      };
    }
    return { ...pc, armorFramesRemaining: newArmor };
  }

  if (pc.recoveryFramesRemaining > 0) {
    const newRecovery = pc.recoveryFramesRemaining - 1;
    return { ...pc, recoveryFramesRemaining: newRecovery };
  }

  return { ...pc, active: false };
}

// ── Finisher activation ───────────────────────────────────────────────────────
/**
 * Update Finisher availability based on current HP percentage.
 */
export function updateFinisherAvailability(finisher: FinisherState, hpPercent: number): FinisherState {
  return {
    ...finisher,
    available: !finisher.usedThisMatch && hpPercent <= FINISHER_HP_THRESHOLD,
  };
}

/**
 * Activate Finisher cinematic super.
 * Returns null if not available.
 */
export function activateFinisher(finisher: FinisherState): FinisherState | null {
  if (!finisher.available || finisher.usedThisMatch) return null;
  return {
    ...finisher,
    executing: true,
    usedThisMatch: true,
    available: false,
    cinematicActive: true,
    startupFramesRemaining: FINISHER_STARTUP_FRAMES,
    recoveryFramesRemaining: 0,
  };
}

/**
 * Complete Finisher cinematic — called after cinematic sequence ends.
 */
export function completeFinisherCinematic(finisher: FinisherState): FinisherState {
  return {
    ...finisher,
    cinematicActive: false,
    executing: false,
    recoveryFramesRemaining: FINISHER_RECOVERY_FRAMES,
  };
}

/**
 * Tick Finisher state each frame.
 */
export function tickFinisher(finisher: FinisherState): FinisherState {
  if (finisher.startupFramesRemaining > 0) {
    return { ...finisher, startupFramesRemaining: finisher.startupFramesRemaining - 1 };
  }
  if (finisher.recoveryFramesRemaining > 0) {
    const newRecovery = finisher.recoveryFramesRemaining - 1;
    return { ...finisher, recoveryFramesRemaining: newRecovery };
  }
  return finisher;
}

/**
 * Check if Finisher super armor is active (during startup frames).
 */
export function isFinisherArmorActive(finisher: FinisherState): boolean {
  return finisher.executing && finisher.startupFramesRemaining > 0;
}
