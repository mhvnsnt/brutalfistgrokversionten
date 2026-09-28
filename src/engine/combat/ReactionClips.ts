/**
 * WHICH ANIMATION A HIT REACTION PLAYS. Bound by NAME, the way the game this
 * is measured against does it.
 *
 * Owner: "the animations and hit reactions and overall combat flow is still
 * glitchy and buggy and something hard to explain."
 *
 * MEASURED. Eighteen clips in the bank all carry the semantic `hit_reaction`,
 * and their lengths span TWENTY-FOLD:
 *
 *     REACTION_HITWEAKHIGH     0.167s   Schwarzerblitz's own flinch
 *     REACTION_HITSTRONGMID    0.542s   ...and its heavy
 *     UAL2_..._Hit_Knockback   0.833s   a generic vendor asset-pack clip
 *     HIT_TO_HEAD              2.533s   a long mocap capture
 *     HIT_ON_SIDE_OF_HEAD      3.300s
 *     HIT_REACTION             2.433s   and this name fuzzy-matches "hit" best
 *
 * Hitstun runs 0.18s to 0.65s. Nothing constrained the pick to a clip that fits
 * that window, so a jab could start a 3.3-second reaction and be yanked back to
 * idle 5% in. That is the "glitchy hit reaction": the body twitches a fraction
 * of a flinch and snaps upright.
 *
 * THE BINDING WAS ALREADY THERE AND UNUSED. Every Schwarzerblitz hitbox names
 * the reaction it causes -- WeakHigh, StrongMid, Flight -- and the imported
 * clips are NAMED AFTER THOSE REACTIONS. `WeakHigh` and `REACTION_HITWEAKHIGH`
 * are the same fact written twice. So this resolves by name instead of by
 * similarity, which is exactly what Schwarzerblitz does and what MUGEN's AIR
 * does: the move says which reaction, the reaction IS a specific animation.
 *
 * AND THE TIMING ALREADY FITS. 0.167s against a 0.18s minimum hitstun, 0.542s
 * against a 0.65s maximum -- these clips were authored to these windows. No
 * frame data changes; only the clip choice was ever wrong.
 */

/** The reaction names that appear on Schwarzerblitz hitboxes. */
export type ReactionName =
  | 'WeakHigh' | 'WeakMid' | 'WeakMedium' | 'WeakLow'
  | 'StrongHigh' | 'StrongMid' | 'StrongMedium' | 'StrongLow'
  | 'Flight' | 'StandFlight' | 'Smackdown' | 'None';

/** Reaction clips actually present in the baked bank, with their real lengths. */
export const REACTION_CLIP_SECONDS: Readonly<Record<string, number>> = {
  REACTION_HITWEAKHIGH: 0.167,
  REACTION_HITWEAKMEDIUM: 0.167,
  REACTION_HITWEAKMEDIUMBACK: 0.167,
  REACTION_HITSTRONGHIGH: 0.542,
  REACTION_HITSTRONGMID: 0.542,
  REACTION_HEAVYHITAIRREVOLT: 0.833,
  REACTION_HEAVYHITAIRREVOLTBACK: 0.333,
};

/**
 * The derivation, tried first: `REACTION_HIT` + the reaction name upper-cased,
 * with Mid and Medium treated as the same word because the data uses both.
 * WeakHigh -> REACTION_HITWEAKHIGH lands exactly, and so do WeakMedium,
 * StrongHigh and StrongMid -- four of the five most common reactions, derived
 * rather than typed.
 */
function derived(reaction: string): string | null {
  const bare = reaction.replace(/[^A-Za-z]/g, '').toUpperCase();
  for (const candidate of [`REACTION_HIT${bare}`, `REACTION_HIT${bare.replace('MID', 'MEDIUM')}`, `REACTION_HIT${bare.replace('MEDIUM', 'MID')}`]) {
    if (candidate in REACTION_CLIP_SECONDS) return candidate;
  }
  return null;
}

/**
 * Reactions the bank has no clip of its own for. Each falls back to the nearest
 * reaction of the SAME STRENGTH rather than to a generic clip, so a strong hit
 * never plays a light flinch.
 *
 * There is no low-hit reaction clip in the bank at all -- the low variants fall
 * back to the medium of their own strength, and that gap is stated here rather
 * than hidden, because the honest fix is to capture one.
 */
const FALLBACK: Readonly<Record<string, string | null>> = {
  WeakLow: 'REACTION_HITWEAKMEDIUM',
  StrongLow: 'REACTION_HITSTRONGMID',
  StrongMedium: 'REACTION_HITSTRONGMID',
  Flight: 'REACTION_HEAVYHITAIRREVOLT',
  StandFlight: 'REACTION_HEAVYHITAIRREVOLT',
  // A smackdown puts the victim on the floor: that is the knockdown system's
  // job, not a standing flinch, so this deliberately resolves to nothing.
  Smackdown: null,
  None: null,
};

/** Back-turned variants, used when the victim is hit from behind. */
const BACK_VARIANT: Readonly<Record<string, string>> = {
  REACTION_HITWEAKMEDIUM: 'REACTION_HITWEAKMEDIUMBACK',
  REACTION_HITWEAKHIGH: 'REACTION_HITWEAKMEDIUMBACK',
  REACTION_HEAVYHITAIRREVOLT: 'REACTION_HEAVYHITAIRREVOLTBACK',
};

/**
 * The clip a reaction plays, or null when the reaction is not a standing
 * flinch (a knockdown, or no reaction at all).
 */
export function reactionClipFor(reaction: string | null | undefined, opts: { backTurned?: boolean } = {}): string | null {
  if (!reaction) return null;
  if (reaction in FALLBACK && FALLBACK[reaction] === null) return null;
  const base = derived(reaction) ?? FALLBACK[reaction] ?? null;
  if (!base) return null;
  if (opts.backTurned && base in BACK_VARIANT) return BACK_VARIANT[base];
  return base;
}

/** How long that clip runs, so hitstun can be checked against it. */
export function reactionClipSeconds(reaction: string | null | undefined, opts: { backTurned?: boolean } = {}): number | null {
  const clip = reactionClipFor(reaction, opts);
  return clip ? REACTION_CLIP_SECONDS[clip] ?? null : null;
}

/** Every reaction name the move data actually uses, for the gate. */
export const KNOWN_REACTIONS: readonly string[] = [
  'WeakHigh', 'WeakMid', 'WeakMedium', 'WeakLow',
  'StrongHigh', 'StrongMid', 'StrongMedium', 'StrongLow',
  'Flight', 'StandFlight', 'Smackdown', 'None',
];
