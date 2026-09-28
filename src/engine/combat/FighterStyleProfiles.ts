// `.ts` extensions on purpose — the repo's runner resolves them literally.
/**
 * PER-FIGHTER STYLE PROFILES — the root cause of "every fighter plays the same
 * moveset".
 *
 * MEASURED on main db752c8 (public/motion/movesets.json): 11 fighters × 26
 * generated slots drew from 28 clips; pairwise clip-set overlap averaged 0.92;
 * onyx and cain_elias had identical sets; 251/286 fighter-slot rows had another
 * fighter on the exact same clip in the exact same slot; frame data was a pure
 * function of the clip, so two fighters on one clip had identical timing and
 * damage. The per-fighter difference was an FNV hash of the fighter id added to
 * the clip score — a seed, not a style.
 *
 * THIS MODULE REPLACES THE SEED WITH THE FIGHTER. Every fighter in the roster
 * carries a primary and secondary archetype derived from his roster
 * `role` / `fightingStyle` text (quoted in `canonBasis`), plus his roster
 * `speed` / `strength` stats. The archetypes own:
 *   - CLIP SELECTION  measured-feature affinities (quick vs heavy, hand vs foot,
 *                     airborne, travel) — never clip names — plus a small set of
 *                     authored signature clips per fighter;
 *   - GAMEPLAY DATA   startup / active / recovery offsets, damage, reach,
 *                     hitstun, pushback, on-block, launch and armour;
 *   - STRINGS         a 2–3 hit neutral string and a 2–3 hit directional string.
 *
 * The data is gameplay. It does not certify any clip visually — runtime/PWA
 * evidence is still required before a clip is called PASS.
 */
import type { StrikeClip } from './StrikeClipPool.ts';

export type StyleArchetype = 'grappler' | 'powerhouse' | 'striker' | 'speed' | 'aerial' | 'brawler' | 'martial';
export type StringButton = 'lp' | 'rp' | 'lk' | 'rk';

export interface ArchetypeTuning {
  /** Frame offsets at 60 fps, added to the move's base windows. */
  startupFrames: number;
  activeFrames: number;
  recoveryFrames: number;
  /** Multipliers. */
  damage: number;
  reach: number;
  hitstun: number;
  pushback: number;
  /** Added to the move's frame advantage on block. */
  onBlock: number;
  /** Added to launch on rising/launcher moves. */
  launch: number;
  /** Heavy moves carry power-crush armour through startup. */
  armorHeavy: boolean;
  /** Measured-feature clip affinity. */
  clipAffinity: { quick: number; heavy: number; hand: number; foot: number; air: number; travel: number };
  /** Neutral string, first button is the opener. */
  neutralString: StringButton[];
  /** Directional string over generated slots (numpad + P/K, Ground stance). */
  directionalString: string[];
  /** Reaction the last hit of a string produces. */
  enderReaction: 'StrongMid' | 'StrongHigh' | 'StrongLow' | 'Flight';
}

export const ARCHETYPES: Record<StyleArchetype, ArchetypeTuning> = {
  grappler: {
    startupFrames: 1, activeFrames: 0, recoveryFrames: 2,
    damage: 1.12, reach: 0.9, hitstun: 1.1, pushback: 0.65, onBlock: -1, launch: 0,
    armorHeavy: true,
    clipAffinity: { quick: 0.2, heavy: 1.2, hand: 2.2, foot: 0.4, air: -1.6, travel: 0.6 },
    neutralString: ['lp', 'rp'],
    directionalString: ['4P', '6P'],
    enderReaction: 'StrongMid',
  },
  powerhouse: {
    startupFrames: 2, activeFrames: 1, recoveryFrames: 3,
    damage: 1.25, reach: 1.0, hitstun: 1.2, pushback: 1.35, onBlock: -2, launch: 0.15,
    armorHeavy: true,
    clipAffinity: { quick: -0.4, heavy: 1.6, hand: 1.6, foot: 1.2, air: -1.2, travel: 0.4 },
    neutralString: ['rp', 'rp'],
    directionalString: ['6P', '3K'],
    enderReaction: 'StrongHigh',
  },
  striker: {
    startupFrames: -1, activeFrames: 0, recoveryFrames: -1,
    damage: 1.0, reach: 1.08, hitstun: 1.0, pushback: 1.0, onBlock: 2, launch: 0,
    armorHeavy: false,
    clipAffinity: { quick: 1.0, heavy: 0.2, hand: 2.6, foot: 0.6, air: -0.8, travel: 0 },
    neutralString: ['lp', 'rp', 'lk'],
    directionalString: ['6P', '6K', '9K'],
    enderReaction: 'StrongMid',
  },
  speed: {
    startupFrames: -2, activeFrames: 0, recoveryFrames: -3,
    damage: 0.85, reach: 0.95, hitstun: 0.9, pushback: 0.8, onBlock: 1, launch: 0.05,
    armorHeavy: false,
    clipAffinity: { quick: 2.4, heavy: -1.0, hand: 1.2, foot: 1.0, air: 0.2, travel: 0 },
    neutralString: ['lp', 'lp', 'rk'],
    directionalString: ['3P', '6P', '6K'],
    enderReaction: 'StrongMid',
  },
  aerial: {
    startupFrames: 0, activeFrames: 1, recoveryFrames: 1,
    damage: 0.95, reach: 1.12, hitstun: 1.0, pushback: 1.1, onBlock: 0, launch: 0.3,
    armorHeavy: false,
    clipAffinity: { quick: 0.4, heavy: 0.4, hand: 0.4, foot: 1.8, air: 2.6, travel: 0.4 },
    neutralString: ['lk', 'rk'],
    directionalString: ['6K', '9K'],
    enderReaction: 'Flight',
  },
  brawler: {
    startupFrames: 0, activeFrames: 1, recoveryFrames: 0,
    damage: 1.08, reach: 1.0, hitstun: 1.15, pushback: 1.15, onBlock: 0, launch: 0.05,
    armorHeavy: false,
    clipAffinity: { quick: 0.6, heavy: 0.8, hand: 2.0, foot: 0.8, air: -0.6, travel: 0.8 },
    neutralString: ['lp', 'rp', 'rp'],
    directionalString: ['6P', '4P', '6K'],
    enderReaction: 'StrongHigh',
  },
  martial: {
    startupFrames: -1, activeFrames: 0, recoveryFrames: -1,
    damage: 1.02, reach: 1.1, hitstun: 1.0, pushback: 1.0, onBlock: 1, launch: 0.1,
    armorHeavy: false,
    clipAffinity: { quick: 1.0, heavy: 0.4, hand: 0.8, foot: 2.4, air: 0, travel: 0.9 },
    neutralString: ['lk', 'rk', 'rk'],
    directionalString: ['6K', '3K', '9K'],
    enderReaction: 'StrongLow',
  },
};

export interface FighterStyleProfile {
  id: string;
  primary: StyleArchetype;
  secondary: StyleArchetype;
  /** The roster text this was derived from (role / fightingStyle excerpt). */
  canonBasis: string;
  /** Authored signature clips — must exist in the strike pool or they are reported MISSING_CLIP. */
  signatureClips: string[];
}

/**
 * Canon-derived style table. `canonBasis` quotes src/data/bannonRoster.ts —
 * change the roster text and this table must be revisited.
 */
export const FIGHTER_STYLE_TABLE: Record<string, Omit<FighterStyleProfile, 'id'>> = {
  bannon:          { primary: 'grappler',   secondary: 'powerhouse', canonBasis: 'Power Wrestling / Technical Hybrid. Explosive grapples, heavy strikes, and high-impact throws.', signatureClips: ['TIGERDOUBLEHAMMERCOMBO', 'BASEBALL_HIT'] },
  maime:           { primary: 'speed',      secondary: 'striker',    canonBasis: 'Technical Striking / Speed. Fast combos, precise counters, and quick throws.', signatureClips: ['GYAKUZUKI', 'HIGHPUNCH'] },
  onyx:            { primary: 'powerhouse', secondary: 'brawler',    canonBasis: 'Power Brawler. Heavy strikes, crushing throws, and endurance-based combat.', signatureClips: ['GRAFSURPRISEPUNCHSLOWER', 'TIGERKNEEBASHSLOW'] },
  cain_elias:      { primary: 'grappler',   secondary: 'striker',    canonBasis: 'Technical Power / Vindictive. Combines submission holds with devastating power moves.', signatureClips: ['KNEETHROW_SLOW', 'GRAFSURPRISEPUNCHLONGER'] },
  stick_up:        { primary: 'striker',    secondary: 'aerial',     canonBasis: 'Technical/Brutal Hybrid. Machine-like precision strikes ... theatrical high-flying finishers.', signatureClips: ['GRAFQUICKJAB', 'JUMPAXEKICK'] },
  cipher:          { primary: 'speed',      secondary: 'martial',    canonBasis: 'Speed / Agility. Rapid multi-hit combos, quick counters, and evasive movement.', signatureClips: ['QUICKKICK', 'SHAZLOWRUSH'] },
  echo:            { primary: 'aerial',     secondary: 'speed',      canonBasis: 'Psychological / Aerial. Misdirection, rapid dodges, and unexpected aerial attacks.', signatureClips: ['GRAFJUMPKICK2', 'DEFAULTJUMPPUNCH'] },
  cody:            { primary: 'brawler',    secondary: 'powerhouse', canonBasis: 'Brawler / Interference. Dirty tactics ... explosive power moves.', signatureClips: ['BASEBALL_HIT', 'GRAFSURPRISEPUNCH'] },
  hall_nighter:    { primary: 'brawler',    secondary: 'grappler',   canonBasis: 'Power Brawler / Endurance. Absorbs damage and delivers crushing impact.', signatureClips: ['TIGERDOUBLEHAMMERCOMBO', 'BOXING__5_'] },
  static:          { primary: 'speed',      secondary: 'brawler',    canonBasis: 'Electric Striker / Speed Brawler. Rapid-fire strikes, spinning attacks, and chaotic combos.', signatureClips: ['ARMADA', 'GYAKUZUKI_COMBO'] },
  viper:           { primary: 'striker',    secondary: 'speed',      canonBasis: 'Assassin / Precision Striker. Lightning-fast strikes, evasive movement, and lethal counters.', signatureClips: ['HIGHPUNCH', 'TIGER_HEAVYKICK'] },
  kobra:           { primary: 'brawler',    secondary: 'speed',      canonBasis: 'Street Fighter / Chaos. Dirty tactics, unpredictable combos, and raw aggression.', signatureClips: ['SHAZLOWRUSH', 'PUNCHKICKCOMBO'] },
  aaron_ruben:     { primary: 'grappler',   secondary: 'martial',    canonBasis: 'Technical Grappler / Ring General. Submission holds, precise strikes, and ring control.', signatureClips: ['GRAFSURPRISEPUNCHLOW', 'GYAKUZUKI'] },
  hollow:          { primary: 'speed',      secondary: 'powerhouse', canonBasis: 'Phantom / Psychological. Unpredictable movement, mind games, and sudden explosive attacks.', signatureClips: ['GRAFSURPRISEPUNCH', 'QUESHADA_2'] },
  edwin_kennedy:   { primary: 'powerhouse', secondary: 'striker',    canonBasis: 'Corporate Power / Calculated Brutality. Deliberate, powerful strikes and throws.', signatureClips: ['GRAFSURPRISEPUNCHLONGER', 'HEAVYKICK'] },
  pablo:           { primary: 'powerhouse', secondary: 'brawler',    canonBasis: 'Mythic Power / Bull Rush. Charging attacks, devastating throws, and raw physical dominance.', signatureClips: ['BASEBALL_HIT', 'ROUNDHOUSEKICK'] },
  tyneshia:        { primary: 'brawler',    secondary: 'striker',    canonBasis: 'Street Queen / Technical Brawler. Street-smart combos, technical counters, and raw power.', signatureClips: ['GYAKUZUKI_COMBO', 'TIGER_HEAVYKICK'] },
  triple_xxx:      { primary: 'aerial',     secondary: 'striker',    canonBasis: 'Showman / High-Flying. Aerial attacks, theatrical combos, and crowd-pleasing finishers.', signatureClips: ['JUMPSPIN', 'GRAFJUMPPUNCH'] },
  el_toro_de_oro:  { primary: 'aerial',     secondary: 'powerhouse', canonBasis: 'Luchador / Power. Aerial attacks, power slams, and spectacular finishers.', signatureClips: ['TIGER_HEAVYKICKCOMBO', 'GRAFSURPRISEPUNCHSLOWER'] },
  stan_combs:      { primary: 'striker',    secondary: 'brawler',    canonBasis: 'Corporate Architect / Dirty Fighter. Underhanded tactics, calculated strikes', signatureClips: ['GRAFQUICKJAB', 'KNEETHROW_SLOW'] },
  brutus:          { primary: 'powerhouse', secondary: 'powerhouse', canonBasis: 'Juggernaut / Pure Power. Overwhelming force, crushing throws, and unstoppable charges.', signatureClips: ['BOXING__5_', 'TIGERKNEEBASHSLOW'] },
  titan:           { primary: 'powerhouse', secondary: 'grappler',   canonBasis: 'Colossus / Immovable. Slow but devastating attacks, unbreakable defense, and earth-shaking throws.', signatureClips: ['TIGERDOUBLEHAMMERCOMBO', 'BODY_JAB_CROSS'] },
  master_sensei:   { primary: 'martial',    secondary: 'striker',    canonBasis: 'Martial Arts Master / Precision. Perfect technique, devastating counters, and disciplined strikes.', signatureClips: ['GYAKUZUKI', 'AXEKICK'] },
  wreck_patterson: { primary: 'grappler',   secondary: 'brawler',    canonBasis: 'Wrecking Machine / Demolition. Systematic destruction, power throws, and relentless pressure.', signatureClips: ['BASEBALL_HIT', 'GRAFSURPRISEPUNCHLOW2'] },
  jager:           { primary: 'brawler',    secondary: 'martial',    canonBasis: 'Predator / Hunter. Patient stalking, explosive bursts, and devastating finishing sequences.', signatureClips: ['SHAZLOWRUSH', 'TIGER_HEAVYKICK'] },
  finxsse:         { primary: 'powerhouse', secondary: 'speed',      canonBasis: 'Power + speed hybrid. Signature Chainsnatcher (jumping double-knee backstabber).', signatureClips: ['GRAFJUMPPUNCH', 'KNEETHROW_SLOW'] },
  tarzanian_devil: { primary: 'aerial',     secondary: 'brawler',    canonBasis: 'Lucha libre / hardcore hybrid. Hurricanranas, springboards, and deathmatch grit.', signatureClips: ['JUMPAXEKICK', 'ARMADA'] },
};

export interface FighterStats { speed: number; strength: number }

export interface ResolvedStyle extends FighterStyleProfile {
  stats: FighterStats;
  tuning: ArchetypeTuning;
}

/** Blend primary (weight 1) and secondary (weight 0.5) into one tuning, then fold in stats. */
export function resolveStyle(id: string, stats: FighterStats): ResolvedStyle | null {
  const entry = FIGHTER_STYLE_TABLE[id];
  if (!entry) return null;
  const p = ARCHETYPES[entry.primary];
  const s = ARCHETYPES[entry.secondary];
  const mix = (a: number, b: number) => (a + b * 0.5) / 1.5;
  const tuning: ArchetypeTuning = {
    ...p,
    startupFrames: mix(p.startupFrames, s.startupFrames),
    activeFrames: mix(p.activeFrames, s.activeFrames),
    recoveryFrames: mix(p.recoveryFrames, s.recoveryFrames),
    damage: mix(p.damage, s.damage),
    reach: mix(p.reach, s.reach),
    hitstun: mix(p.hitstun, s.hitstun),
    pushback: mix(p.pushback, s.pushback),
    onBlock: mix(p.onBlock, s.onBlock),
    launch: mix(p.launch, s.launch),
    armorHeavy: p.armorHeavy || (s.armorHeavy && entry.primary !== 'speed'),
    clipAffinity: {
      quick: mix(p.clipAffinity.quick, s.clipAffinity.quick),
      heavy: mix(p.clipAffinity.heavy, s.clipAffinity.heavy),
      hand: mix(p.clipAffinity.hand, s.clipAffinity.hand),
      foot: mix(p.clipAffinity.foot, s.clipAffinity.foot),
      air: mix(p.clipAffinity.air, s.clipAffinity.air),
      travel: mix(p.clipAffinity.travel, s.clipAffinity.travel),
    },
  };
  // STATS: roster speed 76–93, strength 78–97. Speed takes frames off startup
  // and recovery; strength scales damage and pushback. These are what make two
  // fighters of the same archetype pair still play differently.
  const speedFrames = (85 - stats.speed) / 4;
  tuning.startupFrames += speedFrames;
  tuning.recoveryFrames += speedFrames;
  tuning.damage *= stats.strength / 86;
  tuning.pushback *= 0.85 + (stats.strength - 78) / 120;
  return { id, ...entry, stats, tuning };
}

// ── Style-driven clip selection ────────────────────────────────────────────

/** 7/8/9 up, 1/2/3 down, 4 back, 6 forward. */
export const heightOf = (np: number): 'high' | 'low' | 'mid' =>
  np >= 7 ? 'high' : np <= 3 ? 'low' : 'mid';

export const MOVESET_MATRIX: ReadonlyArray<readonly [number, 'Ground' | 'Crouch' | 'Air']> = [
  [6, 'Ground'], [4, 'Ground'], [2, 'Ground'], [8, 'Ground'],
  [3, 'Ground'], [1, 'Ground'], [9, 'Ground'], [7, 'Ground'],
  [6, 'Crouch'], [4, 'Crouch'], [2, 'Crouch'],
  [6, 'Air'], [2, 'Air'],
];

const DIR_WORD: Record<number, string> = {
  6: 'Forward', 4: 'Back', 2: 'Low', 8: 'Rising',
  3: 'Advancing', 1: 'Ducking', 9: 'Leaping', 7: 'Falling', 5: 'Standing',
};

/** Named for the MOTION, never for a person — owner law on the asset tree. */
const limbWord = (clip: StrikeClip) => {
  if (clip.kick) return clip.lift > 0.7 ? 'Kick' : clip.foot > 0.8 ? 'Boot' : 'Knee';
  return clip.hand > 0.44 ? 'Hammer' : clip.dur < 0.3 ? 'Jab' : 'Strike';
};

export function styleAffinity(style: ResolvedStyle, clip: StrikeClip): number {
  const a = style.tuning.clipAffinity;
  let v = a.quick * Math.max(0, 1.2 - clip.dur)
    + a.heavy * Math.min(1.5, clip.dur)
    + a.hand * clip.hand
    + a.foot * clip.foot
    + a.air * (clip.airborne ? 1 : 0)
    + a.travel * Math.min(1, clip.travels * 2);
  v += ((style.stats.speed - 85) / 8) * Math.max(0, 1 - clip.dur);
  v += ((style.stats.strength - 85) / 8) * (clip.hand + clip.foot) * 0.5;
  return v;
}

export interface Want {
  kick: boolean;
  height: 'high' | 'low' | 'mid';
  stance: 'Ground' | 'Crouch' | 'Air';
  /** Neutral slots: a light button wants a quick clip, a heavy one a committed clip. */
  tempo?: 'light' | 'heavy';
}

function compatible(clip: StrikeClip, want: Want): boolean {
  if (want.kick !== clip.kick) return false;
  if (want.height === 'low' && clip.airborne) return false;
  if (want.stance === 'Crouch' && clip.airborne) return false;
  // A neutral grounded button never plays a clip that leaves the floor.
  if (want.tempo && clip.airborne) return false;
  if (clip.spineUp < 0.75) return false;
  return true;
}

function baseFit(clip: StrikeClip, want: Want): number {
  let s = want.kick ? clip.foot * 2 : clip.hand * 4;
  if (want.height === 'high') s += clip.lift * 2.5 + (clip.airborne ? 1.5 : 0);
  if (want.height === 'low') s += (1 - Math.min(1, clip.lift)) * 1.5;
  if (want.stance === 'Air') s += clip.airborne ? 3 : -3;
  if (want.stance === 'Crouch') s += 1;
  if (clip.owns) s -= 2;
  if (want.tempo === 'light') s += 7 * Math.max(0, 1 - clip.dur) - (clip.dur > 1.2 ? 4 : 0);
  if (want.tempo === 'heavy') s += 1.2 * Math.min(1.5, clip.dur);
  return s;
}

/**
 * ROSTER DIVERSITY LEDGER. The measured strike pool is small (35 clips), so
 * pure affinity sends every heavy-style fighter to the same heavy clips. The
 * ledger records which clips already anchor other fighters' repertoires and
 * which slot/clip pairs are taken, and charges for reuse. Deterministic: the
 * roster is processed in roster order, and the style affinity still dominates.
 */
export interface RosterDiversity {
  clipUse: Map<string, number>;
  slotUse: Map<string, number>;
}
export const newRosterDiversity = (): RosterDiversity => ({ clipUse: new Map(), slotUse: new Map() });

const REPERTOIRE_REUSE_COST = 0.9;
const SLOT_REUSE_COST = 1.6;

/** The fighter's REPERTOIRE: the clips his style would reach for, per limb. */
export function styleRepertoire(style: ResolvedStyle, pool: StrikeClip[], perLimb = 7, diversity?: RosterDiversity): Set<string> {
  const byLimb = (kick: boolean) => pool
    .filter((c) => c.kick === kick)
    .map((c) => ({
      c,
      v: styleAffinity(style, c)
        + (style.signatureClips.includes(c.name) ? 10 : 0)
        - (diversity?.clipUse.get(c.name) ?? 0) * REPERTOIRE_REUSE_COST,
    }))
    .sort((x, y) => y.v - x.v || x.c.name.localeCompare(y.c.name))
    .slice(0, perLimb)
    .map((x) => x.c.name);
  return new Set([...byLimb(false), ...byLimb(true)]);
}

export function pickStyleClip(
  style: ResolvedStyle, pool: StrikeClip[], want: Want, used: Map<string, number>, repertoire: Set<string>,
  slotKey?: string, diversity?: RosterDiversity,
): StrikeClip | null {
  let best: StrikeClip | null = null;
  let bestScore = -Infinity;
  for (const clip of pool) {
    if (!compatible(clip, want)) continue;
    let v = baseFit(clip, want) + styleAffinity(style, clip);
    if (style.signatureClips.includes(clip.name)) v += 3;
    if (!repertoire.has(clip.name)) v -= 4;
    v -= (used.get(clip.name) ?? 0) * 3.5;
    if (slotKey && diversity) v -= (diversity.slotUse.get(`${slotKey}|${clip.name}`) ?? 0) * SLOT_REUSE_COST;
    if (v > bestScore || (v === bestScore && best && clip.name < best.name)) { bestScore = v; best = clip; }
  }
  return best;
}

// ── Style-driven gameplay data ─────────────────────────────────────────────

export interface StyledGeneratedMove {
  id: string;
  name: string;
  sequence: [];
  command: Array<{ dirs: number[]; buttons: string[] }>;
  stance: string;
  clip: string;
  startup: number;
  active: number;
  recovery: number;
  damage: number;
  contactReach: number;
  hitstun: number;
  pushback: number;
  launch: number;
  onBlock: number;
  attackLevel: 'high' | 'mid' | 'low';
  reaction: string;
  armor?: boolean;
  /** Explicit string links (ids in this fighter's set). */
  string?: string[];
  style: string;
}

const F = (frames: number) => frames / 60;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

export function styledMoveData(style: ResolvedStyle, clip: StrikeClip, np: number, stance: string, button: 'P' | 'K') {
  const t = style.tuning;
  const height = stance === 'Crouch' ? 'low' : heightOf(np);
  const heavyClip = clip.dur >= 0.8;
  // TEKKEN FRAME ENVELOPE (frame-envelope.test.ts): startup ≥ 10, active 2–6,
  // total ≤ 62. The clip's length sets where in the envelope a move sits (a
  // long wind-up is slower); the style profile and stats then move it. This
  // replaces the set-wide rank calibration, which would flatten per-fighter
  // offsets back onto one curve.
  const len = Math.max(0, Math.min(1, (clip.dur - 0.2) / 1.8));
  const startupF = Math.round(Math.max(10, Math.min(22, 10 + len * 9 + t.startupFrames + 1)));
  const activeF = Math.round(Math.max(2, Math.min(6, 2 + len * 3 + t.activeFrames)));
  const recoveryF = Math.round(Math.max(8, Math.min(62 - startupF - activeF, 12 + len * 24 + t.recoveryFrames)));
  const startup = F(startupF);
  const active = F(activeF);
  const recovery = F(recoveryF);
  const baseDamage = 40 + clip.hand * 40 + clip.foot * 50;
  const damage = Math.round(baseDamage * t.damage * (heavyClip ? 1.1 : 1));
  const rising = np >= 7 || (np === 8);
  const launch = Math.max(0, (rising && button === 'K' ? 0.45 : 0) + (rising ? t.launch : 0));
  const hitstun = Math.max(0.18, Math.min(0.65, (0.22 + damage / 700) * t.hitstun));
  const pushback = Math.max(0.15, (0.3 + (button === 'K' ? 0.1 : 0) + (heavyClip ? 0.15 : 0)) * t.pushback);
  const onBlock = Math.round(t.onBlock + (heavyClip ? -8 : clip.dur < 0.45 ? 1 : -3) + (height === 'low' ? -3 : 0));
  const attackLevel: 'high' | 'mid' | 'low' = height === 'low' ? 'low' : button === 'K' || np === 8 || np === 9 || stance === 'Air' ? 'mid' : 'high';
  let reaction = button === 'K'
    ? (launch >= 0.4 ? 'Flight' : damage >= 110 ? 'StrongMid' : 'WeakMid')
    : height === 'low' ? 'WeakLow' : damage >= 105 ? 'StrongHigh' : 'WeakHigh';
  if (height === 'low' && button === 'K' && launch < 0.4) reaction = damage >= 110 ? 'StrongLow' : 'WeakLow';
  return {
    startup: round3(startup), active: round3(active), recovery: round3(recovery),
    damage, contactReach: round3((button === 'K' ? clip.foot : clip.hand) * t.reach),
    hitstun: round3(hitstun), pushback: round3(pushback), launch: round3(launch), onBlock,
    attackLevel, reaction,
    armor: t.armorHeavy && heavyClip && stance !== 'Air' ? true : undefined,
  };
}

/** The whole 26-slot directional matrix for one fighter, style-driven. */
export function buildStyledMoveset(style: ResolvedStyle, pool: StrikeClip[], diversity?: RosterDiversity): StyledGeneratedMove[] {
  const out: StyledGeneratedMove[] = [];
  const used = new Map<string, number>();
  const repertoire = styleRepertoire(style, pool, 7, diversity);
  for (const [np, stance] of MOVESET_MATRIX) {
    for (const button of ['P', 'K'] as const) {
      const want: Want = { kick: button === 'K', height: stance === 'Crouch' ? 'low' : heightOf(np), stance };
      const slotKey = `${stance}_${np}${button}`;
      const clip = pickStyleClip(style, pool, want, used, repertoire, slotKey, diversity);
      if (!clip) continue;
      used.set(clip.name, (used.get(clip.name) ?? 0) + 1);
      if (diversity) diversity.slotUse.set(`${slotKey}|${clip.name}`, (diversity.slotUse.get(`${slotKey}|${clip.name}`) ?? 0) + 1);
      out.push({
        id: `bf_${style.id}_${stance}_${np}${button}`,
        name: `${DIR_WORD[np]} ${limbWord(clip)}`,
        sequence: [],
        command: [{ dirs: [np], buttons: [button] }],
        stance,
        clip: clip.name,
        ...styledMoveData(style, clip, np, stance, button),
        style: `${style.primary}/${style.secondary}`,
      });
    }
  }
  if (diversity) for (const name of new Set(out.map((m) => m.clip))) diversity.clipUse.set(name, (diversity.clipUse.get(name) ?? 0) + 1);
  // DIRECTIONAL STRING: chain the style's template across Ground slots. Each
  // step names only the NEXT step, so the ender cannot loop back.
  const chain = style.tuning.directionalString
    .map((k) => out.find((m) => m.id === `bf_${style.id}_Ground_${k}`))
    .filter((m): m is StyledGeneratedMove => Boolean(m));
  for (let i = 0; i < chain.length; i++) {
    const next = chain[i + 1];
    if (next) chain[i].string = [next.id];
    else if (i > 0) {
      chain[i].reaction = style.tuning.enderReaction;
      chain[i].damage = Math.round(chain[i].damage * 1.1);
    }
  }
  return out;
}
