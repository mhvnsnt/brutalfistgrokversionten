// `.ts` extensions on purpose — the repo's runner resolves them literally.
/**
 * THE STRIKE CLIP POOL — which baked clips may play an attack, decided on
 * MEASUREMENTS from public/motion/baked/index.json, never on names.
 *
 * This was inlined in tools/moves/map_commands.mjs as `attackPool()`. MEASURED
 * on main db752c8: of 455 baked clips, 102 carry an `attack_*` semantic and 30
 * survive the gates, so every fighter's 26 generated slots were drawn from the
 * same 28-30 clips. Two things shrank it:
 *
 *   1. SEMANTIC PRE-FILTER. Only `attack_*` clips were considered. The bake
 *      files a clip by its FIRST measured signature, and 249 clips landed in
 *      `idle` — among them spinning kicks (ARMADA, QUESHADA_2), a double hammer
 *      (TIGERDOUBLEHAMMERCOMBO) and two forward rushes (SHARKNADO, SHAZLOWRUSH)
 *      whose strike measurements are unambiguous.
 *   2. The reach floor and the refusal gates, which are KEPT unchanged.
 *
 * WIDENING, ON MEASUREMENTS ONLY. A non-`attack` clip is admitted when:
 *   - it passes every refusal gate the attack pool uses (team capture,
 *     receiver/thrown body, frozen, inverted spine, starts on the mat, turned
 *     away at contact, over 2.2 s), AND
 *   - its semantic is not a slot another system owns (hit reaction, knockdown,
 *     grapple, block, crouch, walk/run/strafe, getup, taunt), AND
 *   - it is not a MEASUREMENT TWIN of a grapple/receiver clip (same duration
 *     and reach to 1 cm — THROWSTART_STEP is THROWSTART re-filed as idle), AND
 *   - it actually strikes toward the opponent by one of three measured tests:
 *       FORWARD HAND   hand reach ≥ 0.38 m, strike direction `fwd` ≥ 0.5 and
 *                      arms forward ≥ 0.36;
 *       HAMMER/OVERHEAD hand reach ≥ 0.38 m, arms forward ≥ 0.5, facing at
 *                      contact ≥ 0.5 (a downward strike has small `fwd`);
 *       SPIN KICK      foot reach ≥ 0.85 m, facing at contact ≥ 0.3 and the
 *                      clip travels ≥ 0.3 m (spins carry the body; a wake-up
 *                      kick lying in place does not).
 *
 * Nothing here promotes a clip visually. It only widens what the moveset
 * builder may CHOOSE; runtime certification is still UNKNOWN until the PWA
 * shows it.
 */

export interface BakedIndexStrike {
  fwd?: number;
  limb?: string;
  reachLimb?: string;
  reachFace?: number;
  faceMin?: number;
  footLift?: number;
  handReach?: number;
  footReach?: number;
  startUp?: number;
  /** Knee strikes (open-source intake): knee forward of its hip socket, metres. */
  kneeReach?: number;
}

export interface BakedIndexEntry {
  dur?: number;
  semantic?: string;
  owns?: boolean;
  airborne?: boolean;
  receives?: boolean;
  movingBones?: number;
  spineUp?: number;
  travels?: number;
  armForward?: number;
  /** Clip family stamped by the open-source intake (boxing, karate, spin, knee, brawl). */
  family?: string;
  intake?: string;
  strike?: BakedIndexStrike;
}

export interface StrikeClip {
  name: string;
  dur: number;
  hand: number;
  foot: number;
  lift: number;
  kick: boolean;
  airborne: boolean;
  spineUp: number;
  travels: number;
  semantic: string;
  isAttack: boolean;
  notAnAttack: boolean;
  owns: boolean;
  /** How this clip entered the pool — `attack` (bake semantic) or a widening rule. */
  admittedBy: 'attack' | 'forward-hand' | 'hammer' | 'spin-kick' | 'knee';
  /** Motion family: `bank` for the original baked bank, else the intake family. */
  family?: string;
}

export type PoolRejection =
  | 'multi-body' | 'receiver' | 'frozen' | 'inverted' | 'starts-on-mat'
  | 'turned-away' | 'too-long' | 'no-reach' | 'owned-semantic' | 'grapple-twin'
  | 'not-a-strike';

const OWNED_SEMANTIC = /^(hit_reaction|knockdown|grapple|block|guard|crouch|walk|run|strafe|dash|getup|taunt|victory)/;

/** Refusal gates shared by every candidate, attack-filed or not. Unchanged from map_commands. */
function refusal(m: BakedIndexEntry, activeBodies: number): PoolRejection | null {
  const s = m.strike ?? {};
  if (activeBodies >= 3) return 'multi-body';
  if (m.receives) return 'receiver';
  if ((m.movingBones ?? 0) < 3) return 'frozen';
  if ((m.spineUp ?? 1) < 0.75) return 'inverted';
  if ((s.startUp ?? 1) < 0.6) return 'starts-on-mat';
  if ((s.reachFace ?? s.faceMin ?? 1) < 0.15) return 'turned-away';
  if ((m.dur ?? 9) > 2.2) return 'too-long';
  return null;
}

const twinKey = (m: BakedIndexEntry) =>
  `${(m.dur ?? 0).toFixed(2)}|${(m.strike?.handReach ?? 0).toFixed(2)}|${(m.strike?.footReach ?? 0).toFixed(2)}`;

export interface StrikePoolResult {
  pool: StrikeClip[];
  rejected: Record<string, PoolRejection>;
}

export function buildStrikeClipPool(
  index: Record<string, BakedIndexEntry>,
  bodies: Record<string, { active?: number }> = {},
  opts: { widen?: boolean } = {},
): StrikePoolResult {
  const widen = opts.widen ?? true;
  const pool: StrikeClip[] = [];
  const rejected: Record<string, PoolRejection> = {};
  const grappleTwins = new Set(
    Object.values(index).filter((m) => m.receives || /^grapple/.test(m.semantic ?? '')).map(twinKey),
  );

  for (const [name, m] of Object.entries(index)) {
    const semantic = m.semantic ?? '';
    const isAttack = /^attack/.test(semantic);
    if (!isAttack && !widen) continue;
    const s = m.strike ?? {};
    const r = refusal(m, bodies[name]?.active ?? 1);
    if (r) { if (isAttack || widen) rejected[name] = r; continue; }
    const hand = s.handReach ?? 0;
    const foot = s.footReach ?? 0;

    let admittedBy: StrikeClip['admittedBy'] | null = null;
    if (isAttack) {
      // A knee is a close-range strike: it can never reach 0.60 m, so it is
      // admitted on its own measured reach (knee >= 0.20 m ahead of the hip).
      if (hand < 0.35 && foot < 0.60 && (s.kneeReach ?? 0) >= 0.2) admittedBy = 'knee';
      else if (hand < 0.35 && foot < 0.60) { rejected[name] = 'no-reach'; continue; }
      else admittedBy = 'attack';
    } else {
      if (OWNED_SEMANTIC.test(semantic)) { rejected[name] = 'owned-semantic'; continue; }
      if (grappleTwins.has(twinKey(m))) { rejected[name] = 'grapple-twin'; continue; }
      const fwd = s.fwd ?? 0;
      const arm = m.armForward ?? 0;
      const face = s.reachFace ?? s.faceMin ?? 0;
      if (hand >= 0.38 && fwd >= 0.5 && arm >= 0.36) admittedBy = 'forward-hand';
      else if (hand >= 0.38 && arm >= 0.5 && face >= 0.5) admittedBy = 'hammer';
      else if (foot >= 0.85 && face >= 0.3 && (m.travels ?? 0) >= 0.3) admittedBy = 'spin-kick';
      if (!admittedBy) { rejected[name] = 'not-a-strike'; continue; }
    }

    const reachLimb = String(s.reachLimb ?? s.limb ?? '').toLowerCase();
    const kick = admittedBy === 'spin-kick' || admittedBy === 'knee'
      ? true
      : admittedBy === 'forward-hand' || admittedBy === 'hammer'
        ? false
        : /foot|leg/.test(reachLimb) ? true : /hand|arm/.test(reachLimb) ? false : foot > hand;
    pool.push({
      name,
      dur: m.dur ?? 0.5,
      hand,
      foot,
      lift: s.footLift ?? 0,
      kick,
      airborne: Boolean(m.airborne),
      spineUp: m.spineUp ?? 1,
      travels: m.travels ?? 0,
      semantic,
      isAttack: true,
      notAnAttack: false,
      owns: Boolean(m.owns),
      admittedBy,
      family: m.family ?? 'bank',
    });
  }
  pool.sort((a, b) => a.name.localeCompare(b.name));
  return { pool, rejected };
}
