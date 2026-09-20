// `.ts` extensions on purpose — the repo's runner resolves them literally.
import { SCHWARZERBLITZ_MOVE_GRAPH } from '../../generated/SchwarzerblitzMoveGraph.generated.ts';

/**
 * CAPTURE GRAPPLES — a grab that leads into another grab, and the escape.
 *
 * Owner: "being able to juggle your opponents and do capture grapples and
 * the grapples to actually work like they do in Tekken and Schwarzerblitz
 * ... combos, combo grapples."
 *
 * THE CHAIN IS IN THE IMPORTED DATA, spelled out. MEASURED on chara_tutor:
 *
 *   12  Customer_Service           input T, Throw hitbox,
 *                                  followup -> TW_KneeBash   window [0,8]
 *   13  Customer_Service_T         FOLLOWUP_ONLY, input T,
 *                                  followup -> TW_KneeBash_CRC window [0,8]
 *   14  Customer_Service_(Chain)   FOLLOWUP_ONLY,
 *                                  followup -> TW_KneeBash_CRC window [2,7]
 *
 * Press the throw button, grab, press it again inside eight frames, and the
 * grab chains. That is a capture grapple, and it is what those FOLLOWUP_ONLY
 * flags are for.
 *
 * WHAT THE ENGINE DID INSTEAD. `throwComboQueue` was a hardcoded
 * `['light','heavy']` route that ADVANCED ITSELF ON A TIMER — the chain
 * played out whether or not anyone pressed anything, and the opponent could
 * do nothing about it. Both halves of what makes a chain throw interesting
 * were missing: the attacker never had to earn the follow-up, and the
 * defender never got to break it.
 *
 * FRAMES, NOT SECONDS. The windows above are frames at 60fps, which is how
 * the source authors them and how anyone reading a frame-data table expects
 * to see them. They are converted once, here, rather than at each use.
 */

/** The source data is authored at 60fps. */
export const SOURCE_FPS = 60;

export interface ThrowChainLink {
  /** The move this chains into. */
  move: string;
  /** When the input window opens, in seconds from the start of the grab. */
  from: number;
  /** When it closes. */
  to: number;
  /** The original frame window, kept so frame data can be shown as frames. */
  frames: [number, number];
}

export interface ThrowMove {
  set: string;
  id: string;
  displayName: string;
  /** The raw input, as the source spells it — "T" is the throw button. */
  rawInput: string;
  /** True when this move can only be reached as a link from another. */
  followupOnly: boolean;
  /** What it chains into, and when. */
  chain: ThrowChainLink[];
}

type GraphMove = {
  displayName?: string;
  rawInput?: string;
  flags?: string[];
  hitboxes?: Array<{ height?: string }>;
  followups?: Array<{ move: string; window: [number, number] }>;
};

function movesOf(set: unknown): Record<string, GraphMove> {
  const s = set as { moves?: Record<string, GraphMove> };
  return s.moves ?? (set as Record<string, GraphMove>);
}

function linkOf(l: { move: string; window: [number, number] }): ThrowChainLink {
  const [a, b] = l.window ?? [0, 0];
  return { move: l.move, from: a / SOURCE_FPS, to: b / SOURCE_FPS, frames: [a, b] };
}

/** Every throw in the imported data, with its chain resolved. */
export function throwMoves(): ThrowMove[] {
  const graph = SCHWARZERBLITZ_MOVE_GRAPH as unknown as Record<string, unknown>;
  const out: ThrowMove[] = [];
  for (const [set, data] of Object.entries(graph)) {
    for (const [id, move] of Object.entries(movesOf(data))) {
      if (!(move.hitboxes ?? []).some((h) => h.height === 'Throw')) continue;
      out.push({
        set,
        id,
        displayName: move.displayName ?? id,
        rawInput: move.rawInput ?? '',
        followupOnly: (move.flags ?? []).includes('FOLLOWUP_ONLY'),
        chain: (move.followups ?? []).map(linkOf),
      });
    }
  }
  return out;
}

/** The throws a player can START — the ones that are not follow-ups. */
export function throwStarters(): ThrowMove[] {
  return throwMoves().filter((t) => !t.followupOnly);
}

/** Resolve one throw by set and id. */
export function throwMove(set: string, id: string): ThrowMove | null {
  return throwMoves().find((t) => t.set === set && t.id === id) ?? null;
}

/**
 * Is the chain input open right now?
 *
 * `elapsed` is seconds since the grab started. A window of [0,8] frames is
 * 0 to 0.133 s — deliberately tight, because a chain throw you cannot drop
 * is not a chain throw, it is a cutscene.
 */
export function chainWindowOpen(link: ThrowChainLink, elapsed: number): boolean {
  return elapsed >= link.from && elapsed <= link.to;
}

/** The link available at this moment, if any. */
export function activeChainLink(t: ThrowMove, elapsed: number): ThrowChainLink | null {
  return t.chain.find((l) => chainWindowOpen(l, elapsed)) ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Throw breaks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * HOW LONG THE DEFENDER HAS TO BREAK A THROW, in seconds.
 *
 * There was NO throw break in this engine at all — `grep -rn "throwBreak\|
 * breakThrow\|escapeThrow"` returned nothing. A grab was simply damage you
 * watched happen, which is the single biggest reason grapples did not feel
 * like Tekken's: there, every normal throw is escapable on reaction and that
 * is what makes throwing a read rather than a free hit.
 *
 * 0.35 s is about 21 frames. Tekken's break window is in that region and it
 * has to be generous enough to be a reaction rather than a guess.
 */
export const THROW_BREAK_WINDOW = 0.35;

/**
 * A CHAIN throw's break window is shorter — you are already caught, and
 * escaping a chain should be harder than not being grabbed in the first
 * place.
 */
export const CHAIN_BREAK_WINDOW = 0.22;

export interface ThrowBreakState {
  /** Seconds left to break. Zero means the throw is committed. */
  remaining: number;
  /** How many links deep the chain is, which shortens each later window. */
  depth: number;
  broken: boolean;
}

export function openThrowBreak(depth = 0): ThrowBreakState {
  return {
    remaining: depth === 0 ? THROW_BREAK_WINDOW : CHAIN_BREAK_WINDOW,
    depth,
    broken: false,
  };
}

/** Advance the break window. Returns true while it is still open. */
export function tickThrowBreak(state: ThrowBreakState, dt: number): boolean {
  if (state.broken || state.remaining <= 0) return false;
  state.remaining = Math.max(0, state.remaining - dt);
  return state.remaining > 0;
}

/**
 * The defender pressed a break. Succeeds only inside the window.
 *
 * Returns whether the throw was broken, so the caller can put both fighters
 * into the pushed-apart recovery a broken throw gives — which is what makes
 * a failed throw a punishable mistake rather than a free retry.
 */
export function attemptThrowBreak(state: ThrowBreakState): boolean {
  if (state.broken || state.remaining <= 0) return false;
  state.broken = true;
  return true;
}
