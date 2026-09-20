// `.ts` extensions on purpose — the repo's runner resolves them literally.
import type { BakedManifestEntry } from '../retarget/BakedMotionBank.ts';
import { loadMoveLabels, type MoveLabelMap } from '../assets/moveLabels.ts';

/**
 * A GRAPPLE IS TWO PERFORMANCES. THIS IS THE OTHER ONE.
 *
 * Owner, twice, in his own words:
 *   "neck breaker ... would have two animation parts for the one for the
 *    deliverer and the receiver type shit for the grapples"
 *   "Scoop slam is a grapple too that needs the opponent side, and same for
 *    all grapples — they need the opponent side hooked up and wired up all
 *    areas wise where it needs to be with reaction and animation etc."
 *
 * WHAT WAS ACTUALLY HAPPENING. The bank holds 54 clips of a body being
 * thrown. Nothing had ever connected one of them to the throw it belongs to,
 * so a landed throw called `applyKnockdown()` on the victim and he played the
 * generic knockdown — the same fall for a DDT, a giant swing and a scoop
 * slam, at a length unrelated to the throw being performed on him.
 *
 * WHERE THE PAIRS COME FROM, in order of authority:
 *
 *  1. THE OWNER. He is looking at both clips loop side by side in the Move
 *     Library; nothing here beats that.
 *  2. THE BAKE, which derives them from the names actually present and
 *     CONFIRMS them on duration. Five of the thirteen match to four decimal
 *     places — KNEETHROW 0.5417 with KNEETHROWREACTION 0.5417, ORAORAORA
 *     2.4583 with ORAORAORAREACTION 2.4583, RENZOTHROW 2.25, ROADROLLERDAB
 *     4.5417, SHARKNADO 1.125 — which is not a naming coincidence, it is one
 *     take recorded from two bodies.
 *  3. A STAND-IN, drawn from the throw victims whose own deliverer half was
 *     never imported, chosen by length. NECKBREAKER, SUPLEX, GERMANSUPLEX,
 *     CHOKESLAM, TOMBSTONE and the rest have no recorded partner at all, and
 *     a body thrown for about the right length of time is enormously closer
 *     to right than a stock knockdown. It is marked as a stand-in wherever it
 *     is reported so it is never mistaken for a real pair.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO: invent a pairing from a name. That is
 * the failure this project keeps repeating and the owner has made law —
 * `DOUBLE_LEG_TAKEDOWN` sounds like two men and is one, `HAMMERLOCKDDT` has
 * 519 animated bones and is still a singles move. Every link here is either
 * something he said, or two durations agreeing.
 */

export interface GrapplePairChoice {
  /** The clip the victim plays. */
  receiver: string;
  /** Where the link came from — never dress a stand-in up as a real pair. */
  source: 'owner' | 'baked' | 'standin';
  /** How long the victim's half runs, so the caller can hold him for it. */
  dur: number;
}

let pairs = new Map<string, string[]>();
let durOf = new Map<string, number>();
/** Clips of a body being thrown, longest first, generic hit reactions removed. */
let victimPool: Array<{ name: string; dur: number }> = [];
let victims = new Set<string>();

/**
 * A GENERIC HIT REACTION IS NOT A THROW VICTIM.
 *
 * REACTION_HITWEAKHIGH is a sixth of a second of a head snapping back. It
 * carries the word REACTION and it is in no sense somebody being suplexed,
 * so it must never be reached for as one. The bake already decided these
 * belong to the hit-reaction slot; that decision is reused rather than a
 * second name rule being written here.
 */
const HIT_REACTION_SEMANTIC = 'hit_reaction';

/**
 * How far apart two halves may be before a stand-in is worse than nothing.
 * A 4.5 s slam answered by a 0.17 s flinch reads as the victim teleporting
 * back to his feet, which is worse than the stock knockdown it replaces.
 */
export const STANDIN_MAX_DURATION_GAP_S = 1.6;

/** Read the baked index. Called once, where the bank is loaded. */
export function markGrapplePairs(manifest: Record<string, BakedManifestEntry>): void {
  pairs = new Map();
  durOf = new Map();
  victims = new Set();
  const pool: Array<{ name: string; dur: number }> = [];
  for (const [name, m] of Object.entries(manifest)) {
    durOf.set(name, m.dur ?? 0);
    if (m.pairedWith?.length) pairs.set(name, [...m.pairedWith]);
    if (m.receives) {
      victims.add(name);
      if (m.semantic !== HIT_REACTION_SEMANTIC) pool.push({ name, dur: m.dur ?? 0 });
    }
  }
  victimPool = pool.sort((a, b) => b.dur - a.dur);
}

/** True when this clip IS somebody being thrown — never an attacker's half. */
export function isThrowVictimClip(name: string): boolean {
  return victims.has(name);
}

/** Every deliverer the bake could pair, for the probes and the tests. */
export function bakedGrapplePairs(): ReadonlyMap<string, readonly string[]> {
  return pairs;
}

/** The pool a stand-in is drawn from. */
export function throwVictimPool(): ReadonlyArray<{ name: string; dur: number }> {
  return victimPool;
}

/**
 * WHAT DOES THE OTHER MAN PLAY WHILE THIS IS DONE TO HIM?
 *
 * `null` means leave him alone: there is no half worth playing, and the
 * caller falls back to the knockdown it would have used anyway. A wrong
 * answer here is visible on screen, so silence is the right failure.
 */
export function receiverClipFor(
  deliverer: string,
  opts: { labels?: MoveLabelMap; available?: (clip: string) => boolean } = {},
): GrapplePairChoice | null {
  if (!deliverer) return null;
  const labels = opts.labels ?? loadMoveLabels();
  const can = opts.available ?? (() => true);
  const usable = (c: string) => Boolean(c) && labels[c]?.verdict !== 'broken' && can(c);

  const said = labels[deliverer]?.pairedWith;
  if (said && usable(said)) {
    return { receiver: said, source: 'owner', dur: durOf.get(said) ?? 0 };
  }

  for (const r of pairs.get(deliverer) ?? []) {
    if (usable(r)) return { receiver: r, source: 'baked', dur: durOf.get(r) ?? 0 };
  }

  const want = durOf.get(deliverer);
  if (want === undefined || victimPool.length === 0) return null;
  let best: { name: string; dur: number } | null = null;
  for (const c of victimPool) {
    if (!usable(c.name)) continue;
    if (best === null || Math.abs(c.dur - want) < Math.abs(best.dur - want)) best = c;
  }
  if (!best || Math.abs(best.dur - want) > STANDIN_MAX_DURATION_GAP_S) return null;
  return { receiver: best.name, source: 'standin', dur: best.dur };
}

/** For the probes: what every grapple in the bank resolves to right now. */
export function grapplePairingReport(deliverers: readonly string[]) {
  const rows = deliverers.map((d) => ({ deliverer: d, ...(receiverClipFor(d) ?? { receiver: null, source: 'none' as const, dur: 0 }) }));
  const by = (s: string) => rows.filter((r) => r.source === s).length;
  return { rows, owner: by('owner'), baked: by('baked'), standin: by('standin'), none: by('none') };
}

/** For tests: forget what was read from the index. */
export function resetGrapplePairingForTest(): void {
  pairs = new Map();
  durOf = new Map();
  victimPool = [];
  victims = new Set();
}
