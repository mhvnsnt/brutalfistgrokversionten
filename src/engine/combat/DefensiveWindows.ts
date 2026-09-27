/**
 * ARMOUR, INVINCIBILITY AND LOW PARRY — as per-frame windows on a move.
 *
 * PORTED FROM SchwarzerblitzEngine (cloned and read, not paraphrased). Its
 * design is the one to copy and this project had three half-built alternatives
 * to it. `FK_Character::hasArmor` asks the MOVE, at the CURRENT FRAME, about a
 * SPECIFIC ATTACK TYPE:
 *
 *     bool FK_Character::hasArmor(FK_Attack_Type type) {
 *       if (isBeingThrown()) return false;
 *       if (currentMove != NULL)
 *         moveFlag = currentMove->hasArmor(floor(animatedMesh->getFrameNr()), type);
 *       ...
 *     }
 *
 * with the windows stored on the move itself (`FK_Move.h`):
 *
 *     std::vector<u32> invincibilityFrames;
 *     std::vector<u32> armorFrames;
 *
 * and the coverage expressed as a bitmask of attack types with composite masks
 * (`FK_Database.h`): `HighAtks`, `MidAtks`, `LowAtks`, `HighAndMidAtks`,
 * `MidAndLowAtks`, `AllAtk`, `NoType`.
 *
 * THREE THINGS THAT FALL OUT OF THAT SHAPE, which is why it is worth copying:
 *
 * 1. A power crush is not its own system. It is a move with armour over its
 *    startup covering high and mid but NOT low, which is the documented rule —
 *    and it needs no new state machine, no new flag and no new input.
 * 2. Armour and invincibility differ only in what they do with the hit, so they
 *    are the same window type with two outcomes: armour EATS the damage and
 *    keeps going, invincibility takes NONE and keeps going.
 * 3. A throw goes through both. Schwarzerblitz's first line is
 *    `if (isBeingThrown()) return false;` and that is not an edge case — it is
 *    what stops an armoured move being a free win.
 *
 * WHAT THIS REPLACED. Three separate half-systems existed: OverdriveSystem's
 * `SUPER_ARMOR_ACTIVE_FRAMES` / `SUPER_ARMOR_STARTUP_FRAMES`,
 * `FINISHER_STARTUP_FRAMES` ("super armor startup"), and a `superArmor` motion
 * state. Measured: `SUPER_ARMOR_ACTIVE_FRAMES`, `FINISHER_STARTUP_FRAMES`,
 * `FINISHER_DAMAGE`, `FINISHER_HP_THRESHOLD` and `HEAT_ATTACKS` had ZERO readers
 * outside their own file. The state objects were created and ticked; the numbers
 * that would have made them mean anything were read by nobody.
 */

/** The three heights an attack can strike at, matching MoveWindow.attackLevel. */
export type AttackLevel = 'high' | 'mid' | 'low';

/**
 * Which heights a defensive window covers. The composite sets are the ones
 * FK_Database declares, by the names it uses, so the correspondence is readable.
 */
export const HIGH_ATKS: ReadonlySet<AttackLevel> = new Set<AttackLevel>(['high']);
export const MID_ATKS: ReadonlySet<AttackLevel> = new Set<AttackLevel>(['mid']);
export const LOW_ATKS: ReadonlySet<AttackLevel> = new Set<AttackLevel>(['low']);
/** What a power crush absorbs: everything except a low. */
export const HIGH_AND_MID_ATKS: ReadonlySet<AttackLevel> = new Set<AttackLevel>(['high', 'mid']);
export const MID_AND_LOW_ATKS: ReadonlySet<AttackLevel> = new Set<AttackLevel>(['mid', 'low']);
export const ALL_ATKS: ReadonlySet<AttackLevel> = new Set<AttackLevel>(['high', 'mid', 'low']);
export const NO_TYPE: ReadonlySet<AttackLevel> = new Set<AttackLevel>();

/**
 * A window of frames during which a move resists something, and what it resists.
 * `fromFrame` and `toFrame` are inclusive, counted from the move's own frame 0 —
 * the same frame number the hitbox windows use, so one clock governs both.
 */
export interface DefensiveWindow {
  kind: 'armour' | 'invincible';
  fromFrame: number;
  toFrame: number;
  /** The heights this window resists. A level outside it lands normally. */
  covers: ReadonlySet<AttackLevel>;
  /** Fraction of the absorbed damage still taken. Armour only; 0 for invincible. */
  bleed?: number;
}

/**
 * A POWER CRUSH: armour across the startup, high and mid only, taking reduced
 * damage. The bleed is what stops armour being strictly better than blocking.
 */
export function powerCrushWindow(startupFrames: number, bleed = 0.15): DefensiveWindow {
  // FROM FRAME 0, because frame 0 IS the move's first frame. A 1-based window
  // left the move unarmoured on the frame it came out, which is the frame a
  // trade is most likely to happen on — caught by driving the real state machine
  // rather than the resolver, where a hit on frame 0 read as unarmoured.
  return { kind: 'armour', fromFrame: 0, toFrame: Math.max(1, startupFrames), covers: HIGH_AND_MID_ATKS, bleed };
}

/**
 * A RAGE ART's startup: full invincibility, every height, no damage taken. This
 * is the one window that beats a low, which is what makes a comeback move a
 * comeback move rather than a slower heavy.
 */
export function rageArtWindow(startupFrames: number): DefensiveWindow {
  return { kind: 'invincible', fromFrame: 0, toFrame: Math.max(1, startupFrames), covers: ALL_ATKS };
}

/** A LOW PARRY's window: it beats lows and nothing else. */
export function lowParryWindow(fromFrame: number, toFrame: number): DefensiveWindow {
  return { kind: 'invincible', fromFrame, toFrame, covers: LOW_ATKS };
}

export interface DefensiveHit {
  /** What the defender's active window did with the hit. */
  outcome: 'none' | 'armoured' | 'invincible';
  /** Damage the defender still takes. Full damage when nothing applied. */
  damage: number;
  /** True when the defender keeps acting through it — armour and invincibility both. */
  absorbed: boolean;
}

/**
 * What a defender's windows do with an incoming hit.
 *
 * `isThrow` short-circuits everything, which is Schwarzerblitz's own first line
 * and the rule that keeps an armoured move honest: a throw goes through armour,
 * so armour is answered by grabbing rather than by out-damaging it.
 *
 * When windows overlap, invincibility wins — taking zero is strictly better than
 * taking a fraction, so any other precedence would be a bug the first time two
 * windows were authored on one move.
 */
export function resolveDefensiveWindows(
  windows: readonly DefensiveWindow[] | undefined,
  frame: number,
  level: AttackLevel,
  damage: number,
  isThrow = false,
): DefensiveHit {
  const none: DefensiveHit = { outcome: 'none', damage, absorbed: false };
  if (isThrow || !windows?.length) return none;
  const active = windows.filter(
    (w) => frame >= w.fromFrame && frame <= w.toFrame && w.covers.has(level),
  );
  if (!active.length) return none;
  if (active.some((w) => w.kind === 'invincible')) {
    return { outcome: 'invincible', damage: 0, absorbed: true };
  }
  // Several armour windows on one frame: the kindest bleed applies. Authoring two
  // is unusual, but silently summing their damage would be worse than picking.
  const bleed = Math.min(...active.map((w) => w.bleed ?? 0.15));
  return { outcome: 'armoured', damage: Math.max(0, Math.round(damage * bleed)), absorbed: true };
}

/** Is any window of this kind open on this frame, whatever it covers? */
export function windowOpen(
  windows: readonly DefensiveWindow[] | undefined,
  frame: number,
  kind: DefensiveWindow['kind'],
): boolean {
  return (windows ?? []).some((w) => w.kind === kind && frame >= w.fromFrame && frame <= w.toFrame);
}
