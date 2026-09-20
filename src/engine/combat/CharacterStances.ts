/**
 * CHARACTER STANCES — a fighter's neutral, guard, crouch and walk, per fighter.
 *
 * WHAT WAS WRONG, measured across the 27-fighter roster before this existed:
 * `idle`, `guard`, `walkForward`, `walkBackward` and `crouch` each had EXACTLY
 * ONE distinct value. Every character stood, guarded, walked and crouched
 * identically, because `BrutalFistMoveCatalog` contains exactly one idle, one
 * guard, one crouch and two walks — there was nothing else to pick.
 *
 * The material was already synced and simply unreachable: eleven distinct
 * fighting stances and two guards sit in the Schwarzerblitz bank, whose builder
 * had ZERO CALLERS, and eight more in the Bannon set.
 *
 * THE POOL CARRIES ITS OWN EVIDENCE. `peakDeg` is the largest rotation any bone
 * reaches away from the clip's first key, measured on the shipped bank with
 * QUATERNION angles (a Euler range is inflated by harmless 2pi wraps — see
 * scripts/animation-continuity-audit.mjs). A neutral stance is a HELD POSE: it
 * breathes, it does not travel. Anything past STANCE_PEAK_LIMIT is a move
 * wearing a stance's name, and the test rejects it — metadata is a hint, the
 * frames are the authority.
 *
 * ORIENTATION: nothing here touches facing, yaw or position. A kit is four clip
 * NAMES. The pipeline binds them to the target's bones and makes them
 * bind-relative, which is what keeps a borrowed animation pointing the right
 * way on a rig it was not authored for.
 */

/** Largest rotation from the first key that still reads as a held pose. */
export const STANCE_PEAK_LIMIT_DEG = 50;

export interface StanceClip {
  /** The clip name as the motion bank exposes it. */
  clip: string;
  /** Which synced bank it comes from. */
  bank: 'schwarzerblitz' | 'bannon';
  /** Measured peak bone displacement from the first key, in degrees. */
  peakDeg: number;
  /** What the stance reads as, for the moveset editor. */
  label: string;
}

/**
 * Neutral stances. Twelve distinct, all measured as held poses.
 *
 * KRAVESTANCE (peak 90) and IDLE (peak 71) are deliberately NOT here: both
 * travel far enough to read as a movement rather than a neutral, and IDLE is
 * the generic every fighter already shared. Leaving them out is what makes the
 * set distinct rather than merely longer.
 */
/**
 * BOX_IDLE IS DELIBERATELY NOT HERE, and it used to be.
 *
 * `peakDeg` only asks whether a clip HOLDS a pose, and BOX_IDLE holds one
 * beautifully — 11 degrees, the second stillest in the pool. It is still the
 * wrong pose. MEASURED, hand position relative to the hips on a rig whose
 * forward is +X:
 *   BOX_IDLE  LH [ 0.229, 0.232, 0.311]   RH [-0.225, -0.025, 0.036]
 * One hand 23 cm in FRONT and the other 23 cm BEHIND, both at hip height. The
 * owner described it exactly: "his feet are really close together, he's
 * leaning like he's doing the Michael Jackson lean, one of his arms are out
 * forward and one of his arms are like weirdly out backward." It is a Mixamo
 * shadowboxing loop sampled mid-swing, not a fighting stance.
 *
 * A PASSING METRIC IS NOT A PASSING CLIP — peakDeg cannot express "the arms
 * are in the wrong places", so it had to be looked at.
 */
export const STANCE_POOL: StanceClip[] = [
  { clip: 'STANCE_WIDE',        bank: 'bannon',        peakDeg: 10, label: 'Wide Base' },
  { clip: 'GRAFSTANCE3',        bank: 'schwarzerblitz', peakDeg: 15, label: 'Still Guard' },
  { clip: 'TIGERSTANCEUPDATED', bank: 'schwarzerblitz', peakDeg: 20, label: 'Tiger' },
  { clip: 'STANCE_BLADED',      bank: 'bannon',        peakDeg: 24, label: 'Bladed' },
  { clip: 'GRAFSTANCE2',        bank: 'schwarzerblitz', peakDeg: 26, label: 'Loose Guard' },
  { clip: 'STANCE',             bank: 'schwarzerblitz', peakDeg: 27, label: 'Orthodox' },
  { clip: 'LOWSTANCENEW',       bank: 'schwarzerblitz', peakDeg: 34, label: 'Low Coil' },
  { clip: 'SHAZSTANCE',         bank: 'schwarzerblitz', peakDeg: 34, label: 'Southpaw' },
  { clip: 'TIGERSTANCE',        bank: 'schwarzerblitz', peakDeg: 40, label: 'Tiger Open' },
  { clip: 'JOHNSON_STANCE',     bank: 'schwarzerblitz', peakDeg: 42, label: 'Unorthodox' },
  { clip: 'LOWSTANCE',          bank: 'schwarzerblitz', peakDeg: 46, label: 'Crouched Coil' },
];

/** Five guards. The two short Schwarzerblitz ones snap into the pose and hold. */
export const GUARD_POOL: StanceClip[] = [
  { clip: 'GUARD',          bank: 'schwarzerblitz', peakDeg: 74,  label: 'Standard Guard' },
  { clip: 'LOWSTANCEGUARD', bank: 'schwarzerblitz', peakDeg: 127, label: 'Low Guard' },
  { clip: 'GUARD_HIGH',     bank: 'bannon',         peakDeg: 105, label: 'High Guard' },
  { clip: 'GUARD_LOW',      bank: 'bannon',         peakDeg: 75,  label: 'Body Guard' },
  { clip: 'CENTER_BLOCK',   bank: 'bannon',         peakDeg: 64,  label: 'Centre Block' },
];

export const CROUCH_POOL: StanceClip[] = [
  { clip: 'CROUCHING',     bank: 'schwarzerblitz', peakDeg: 74,  label: 'Duck' },
  { clip: 'STANCE_CROUCH', bank: 'bannon',         peakDeg: 107, label: 'Deep Crouch' },
];

export const WALK_POOL: StanceClip[] = [
  { clip: 'WALK',       bank: 'schwarzerblitz', peakDeg: 56, label: 'Step' },
  { clip: 'WALKFAST',   bank: 'schwarzerblitz', peakDeg: 56, label: 'Quick Step' },
  { clip: 'SHAZWALK',   bank: 'schwarzerblitz', peakDeg: 56, label: 'Prowl' },
  { clip: 'DRUNK_WALK', bank: 'bannon',         peakDeg: 77, label: 'Swagger' },
];

/**
 * The archetypes a fighting style resolves to. Derived from the roster's OWN
 * `fightingStyle` text, which is authored data, rather than invented per
 * fighter — so a new character classifies itself the moment it is added.
 */
export type StanceArchetype =
  | 'power' | 'technical' | 'speed' | 'striker' | 'aerial' | 'street' | 'phantom';

/** Ordered: the FIRST pattern that matches wins, so specific beats generic. */
const STYLE_PATTERNS: Array<[StanceArchetype, RegExp]> = [
  ['phantom',   /phantom|psycholog|mythic|ghost/i],
  ['aerial',    /aerial|high[- ]?fly|lucha|showman|acrobat/i],
  ['speed',     /speed|agility|assassin|predator|precision strik/i],
  ['striker',   /strik|boxer|electric|martial arts|precision/i],
  ['power',     /power|juggernaut|colossus|brawler|wrecking|bull|immovable|demolition/i],
  ['technical', /technical|grappler|ring general|calculated|architect/i],
  ['street',    /street|chaos|interference|dirty|hardcore|hybrid/i],
];

export function archetypeForStyle(fightingStyle: string | undefined): StanceArchetype {
  const style = fightingStyle ?? '';
  // THE PRIMARY SEGMENT WINS. Styles are authored as "<primary> / <secondary>"
  // and the primary is what the character mainly is. Matching the whole string
  // at once let a secondary term outrank the primary: "Electric Striker / Speed
  // Brawler" resolved to SPEED on the word "Speed", when the man is a striker.
  const primary = style.split('/')[0] ?? '';
  for (const [archetype, pattern] of STYLE_PATTERNS) {
    if (pattern.test(primary)) return archetype;
  }
  for (const [archetype, pattern] of STYLE_PATTERNS) {
    if (pattern.test(style)) return archetype;
  }
  return 'technical';
}

/**
 * Which stances suit an archetype, most characteristic first. Every archetype
 * lists several so two fighters sharing a style still differ — the roster has
 * six power fighters and a single "power stance" would put them all in one pose,
 * which is the problem this file exists to solve.
 */
const ARCHETYPE_STANCES: Record<StanceArchetype, string[]> = {
  power:     ['STANCE_WIDE', 'GRAFSTANCE2', 'JOHNSON_STANCE', 'STANCE'],
  technical: ['STANCE_BLADED', 'GRAFSTANCE3', 'STANCE', 'TIGERSTANCEUPDATED'],
  speed:     ['LOWSTANCENEW', 'LOWSTANCE', 'SHAZSTANCE', 'TIGERSTANCE'],
  // 'STANCE' where BOX_IDLE used to be: an orthodox upright guard is what a
  // striker stands in, and BOX_IDLE is a shadowboxing loop, not a stance.
  striker:   ['STANCE', 'SHAZSTANCE', 'STANCE_BLADED', 'GRAFSTANCE3'],
  aerial:    ['TIGERSTANCE', 'TIGERSTANCEUPDATED', 'LOWSTANCE', 'LOWSTANCENEW'],
  street:    ['JOHNSON_STANCE', 'GRAFSTANCE2', 'LOWSTANCE', 'STANCE_WIDE'],
  phantom:   ['GRAFSTANCE3', 'STANCE', 'TIGERSTANCEUPDATED', 'STANCE_BLADED'],
};

const ARCHETYPE_GUARDS: Record<StanceArchetype, string[]> = {
  power:     ['CENTER_BLOCK', 'GUARD_LOW'],
  technical: ['GUARD_HIGH', 'GUARD'],
  speed:     ['LOWSTANCEGUARD', 'GUARD_HIGH'],
  striker:   ['GUARD', 'GUARD_HIGH'],
  aerial:    ['LOWSTANCEGUARD', 'GUARD'],
  street:    ['GUARD_LOW', 'CENTER_BLOCK'],
  phantom:   ['GUARD_HIGH', 'CENTER_BLOCK'],
};

const ARCHETYPE_WALKS: Record<StanceArchetype, string[]> = {
  power:     ['WALK', 'SHAZWALK'],
  technical: ['WALK', 'WALKFAST'],
  speed:     ['WALKFAST', 'SHAZWALK'],
  striker:   ['WALKFAST', 'WALK'],
  aerial:    ['WALKFAST', 'SHAZWALK'],
  street:    ['DRUNK_WALK', 'SHAZWALK'],
  phantom:   ['SHAZWALK', 'WALK'],
};

/**
 * A stable hash of the fighter's id. Deterministic so a fighter keeps the same
 * stance across sessions and devices — a stance that changes per match is not a
 * signature, and that is the entire reason a wrestler reads as himself.
 */
function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface StanceKit {
  archetype: StanceArchetype;
  idle: string;
  guard: string;
  crouch: string;
  walk: string;
}

/**
 * The fighter's kit. Style picks the shortlist, the id picks from within it, so
 * two power fighters get different stances while both still read as powerful.
 */
export function stanceKitFor(fighterId: string, fightingStyle?: string): StanceKit {
  const archetype = archetypeForStyle(fightingStyle);
  const h = hashId(fighterId);
  const pick = (list: string[], salt: number) => list[(h >>> salt) % list.length];
  return {
    archetype,
    idle: pick(ARCHETYPE_STANCES[archetype], 0),
    guard: pick(ARCHETYPE_GUARDS[archetype], 7),
    crouch: pick(CROUCH_POOL.map((c) => c.clip), 13),
    walk: pick(ARCHETYPE_WALKS[archetype], 19),
  };
}

/**
 * The kit as a clip-preference list for one combat state. Consulted BEFORE the
 * generic alias table, and falling through to it when the fighter's rig does
 * not carry the clip — so this can only ever add variety, never remove a
 * character's own animation.
 */
export function stancePreferences(kit: StanceKit, state: string): string[] {
  switch (state) {
    case 'idle': case 'Idle': case 'neutral': return [kit.idle];
    case 'guard': case 'block': case 'blocking': return [kit.guard];
    case 'crouch': case 'crouching': case 'duck': return [kit.crouch];
    case 'walkForward': case 'walkBackward': case 'walk': return [kit.walk];
    default: return [];
  }
}

/** Every clip any kit can name — for warm-loading and for the gate. */
export function allKitClips(): string[] {
  return [
    ...new Set([
      ...STANCE_POOL.map((c) => c.clip),
      ...GUARD_POOL.map((c) => c.clip),
      ...CROUCH_POOL.map((c) => c.clip),
      ...WALK_POOL.map((c) => c.clip),
    ]),
  ];
}
