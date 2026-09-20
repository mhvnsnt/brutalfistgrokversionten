// `.ts` extensions on purpose — the repo's runner resolves them literally.
import { SCHWARZERBLITZ_MOVE_GRAPH } from '../../generated/SchwarzerblitzMoveGraph.generated.ts';

/**
 * WHAT A HIT DOES TO THE BODY IT LANDS ON.
 *
 * Owner: "being able to juggle your opponents and do capture grapples and
 * the grapples to actually work like they do in Tekken and Schwarzerblitz
 * ... combos, combo grapples, different inputs of moves ... all the other
 * gaps and things we're missing."
 *
 * THE DATA WAS ALREADY SHIPPED AND ENTIRELY UNREAD. The imported
 * Schwarzerblitz move graph carries a `reaction` on every hitbox, and
 * MEASURED across its 133 moves:
 *
 *     Flight 20   StandFlight 3   Smackdown 1      <- launchers and the slam
 *     StrongHigh/Mid/Low 34       WeakHigh/Mid/Low 46
 *     height Throw 5                               <- capture grapples
 *     flag VS_GROUNDED 24         ANTI_AIR_ONLY 2
 *     flag ONLY_WHEN_OPPONENT_ATTACKS 12           <- counters
 *
 * `grep -rn "Flight\|Smackdown\|VS_GROUNDED\|ANTI_AIR" src/engine` returned
 * NOTHING outside the generated file and a test. The engine had no juggle,
 * no launcher, no anti-air and no grounded-only move, while the numbers that
 * define all four sat in the bundle.
 *
 * THIS FILE IS THE READER. It does not invent a reaction table — it maps
 * what the graph says onto engine effects, so a move imported tomorrow
 * behaves correctly without anyone touching a list.
 */

/** Reaction names as the Schwarzerblitz data spells them. */
export type SbReaction =
  | 'None'
  | 'WeakHigh' | 'WeakMid' | 'WeakMedium' | 'WeakLow'
  | 'StrongHigh' | 'StrongMid' | 'StrongMedium' | 'StrongLow'
  | 'Flight' | 'StandFlight' | 'Smackdown';

/** What the engine does with a hit. */
export type ReactionKind =
  /** Brief stagger; the fighter keeps their feet. */
  | 'hitstun'
  /** Heavy stagger — longer, and it can be juggled out of on the ground. */
  | 'crumple'
  /** Feet leave the floor. This is what starts a juggle. */
  | 'launch'
  /** Slams an airborne body straight down. Ends the juggle. */
  | 'smackdown'
  /** No reaction at all — the move passes through. */
  | 'none';

export interface ReactionEffect {
  kind: ReactionKind;
  /** Seconds the victim is unable to act. */
  stun: number;
  /** Upward velocity in m/s. Non-zero only for a launch. */
  launchY: number;
  /** Pushback along the attacker's facing, in metres. */
  pushback: number;
}

/**
 * The mapping, and every number in it is a RATIO of one base so the feel can
 * be tuned in one place rather than twelve.
 *
 * WEAK vs STRONG is the data's own distinction and it is the only one needed:
 * weak keeps the opponent close and combo-able, strong pushes them out. HIGH
 * / MID / LOW ride on top and change the pushback, not the stun, because the
 * height decides where you can be hit from, not how long it hurts.
 */
const BASE_STUN = 0.28;

export const REACTIONS: Record<SbReaction, ReactionEffect> = {
  None:        { kind: 'none',      stun: 0,               launchY: 0,   pushback: 0 },
  WeakHigh:    { kind: 'hitstun',   stun: BASE_STUN,       launchY: 0,   pushback: 0.10 },
  WeakMid:     { kind: 'hitstun',   stun: BASE_STUN,       launchY: 0,   pushback: 0.09 },
  WeakMedium:  { kind: 'hitstun',   stun: BASE_STUN,       launchY: 0,   pushback: 0.09 },
  WeakLow:     { kind: 'hitstun',   stun: BASE_STUN * 0.9, launchY: 0,   pushback: 0.07 },
  StrongHigh:  { kind: 'crumple',   stun: BASE_STUN * 1.9, launchY: 0,   pushback: 0.26 },
  StrongMid:   { kind: 'crumple',   stun: BASE_STUN * 1.8, launchY: 0,   pushback: 0.24 },
  StrongMedium:{ kind: 'crumple',   stun: BASE_STUN * 1.8, launchY: 0,   pushback: 0.24 },
  StrongLow:   { kind: 'crumple',   stun: BASE_STUN * 1.7, launchY: 0,   pushback: 0.20 },
  // A LAUNCH IS NOT A BIG HITSTUN. The victim leaves the floor and stays
  // actionable-to-nobody until they land, which is what makes a juggle a
  // juggle rather than a long stagger.
  Flight:      { kind: 'launch',    stun: 0.9,             launchY: 4.2, pushback: 0.18 },
  StandFlight: { kind: 'launch',    stun: 0.7,             launchY: 3.0, pushback: 0.12 },
  Smackdown:   { kind: 'smackdown', stun: 1.1,             launchY: -6.0, pushback: 0.10 },
};

export function reactionFor(name: string | undefined): ReactionEffect {
  return REACTIONS[(name ?? 'WeakMid') as SbReaction] ?? REACTIONS.WeakMid;
}

// ─────────────────────────────────────────────────────────────────────────────
// Juggles
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Gravity on an airborne body, m/s². Deliberately heavier than real gravity:
 * a juggle at 9.8 hangs far too long to read as a fight, and every fighting
 * game in this lineage exaggerates it for the same reason.
 */
export const JUGGLE_GRAVITY = 16;

/**
 * DIMINISHING RETURNS, which is the rule that stops a juggle being an
 * infinite. Each successive hit in one airborne string does less, so a long
 * combo beats a short one but never by as much as its length suggests.
 * Tekken calls it combo scaling; the shape is the same here.
 */
export const JUGGLE_SCALING = [1.0, 0.8, 0.7, 0.6, 0.5, 0.45, 0.4, 0.35, 0.3];
/** Nothing scales below this, or a long juggle stops doing anything at all. */
export const JUGGLE_SCALING_FLOOR = 0.25;

export function juggleScale(hitIndex: number): number {
  if (hitIndex <= 0) return JUGGLE_SCALING[0];
  return JUGGLE_SCALING[hitIndex] ?? JUGGLE_SCALING_FLOOR;
}

/**
 * How high an already-airborne body may be re-launched, as a share of the
 * original launch.
 *
 * WITHOUT THIS A JUGGLE IS AN INFINITE: every launcher would restore full
 * height and the victim never comes down. Re-launching lifts them a little,
 * enough to extend the string, never enough to reset it.
 */
export const RELAUNCH_SHARE = 0.35;

export interface JuggleState {
  airborne: boolean;
  /** Metres above the floor. */
  y: number;
  /** Vertical velocity, m/s. */
  vy: number;
  /** How many hits have connected during this airborne string. */
  hits: number;
}

export function freshJuggle(): JuggleState {
  return { airborne: false, y: 0, vy: 0, hits: 0 };
}

/** Start or extend a juggle. Returns the damage multiplier for this hit. */
export function applyLaunch(state: JuggleState, effect: ReactionEffect): number {
  const scale = juggleScale(state.hits);
  if (!state.airborne) {
    state.airborne = true;
    state.y = Math.max(state.y, 0.01);
    state.vy = effect.launchY;
  } else {
    // Already up: top them up rather than resetting the arc.
    state.vy = Math.max(state.vy, effect.launchY * RELAUNCH_SHARE);
  }
  state.hits++;
  return scale;
}

/** A hit that is not a launcher, landing on someone already airborne. */
export function applyAirHit(state: JuggleState, effect: ReactionEffect): number {
  if (!state.airborne) return 1;
  const scale = juggleScale(state.hits);
  state.hits++;
  if (effect.kind === 'smackdown') {
    // Straight down, hard. This is how a juggle is meant to end.
    state.vy = effect.launchY;
  } else {
    // A normal hit keeps them up a fraction longer without extending forever.
    state.vy = Math.max(state.vy, -1.0);
  }
  return scale;
}

/**
 * Advance the arc. Returns true on the frame the body LANDS, which is the
 * signal to hand off to the knockdown.
 */
export function tickJuggle(state: JuggleState, dt: number): boolean {
  if (!state.airborne) return false;
  state.vy -= JUGGLE_GRAVITY * dt;
  state.y += state.vy * dt;
  if (state.y <= 0) {
    state.y = 0;
    state.vy = 0;
    state.airborne = false;
    state.hits = 0;
    return true;
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// What the graph says about a move
// ─────────────────────────────────────────────────────────────────────────────

export interface MoveProperties {
  /** Every reaction this move's hitboxes can produce, in frame order. */
  reactions: SbReaction[];
  /** True when any hitbox launches. */
  launches: boolean;
  /** A throw: unblockable, needs range, and grabs rather than strikes. */
  isThrow: boolean;
  /** Only usable while the opponent is on the ground. */
  groundOnly: boolean;
  /** Only usable while the opponent is airborne. */
  antiAirOnly: boolean;
  /** A counter — only comes out if the opponent is attacking. */
  counterOnly: boolean;
  /** Only reachable as a follow-up, never started on its own. */
  followupOnly: boolean;
  /** Frames [start, end] of invincibility, if any. */
  invincible?: [number, number];
}

type GraphMove = {
  flags?: string[];
  hitboxes?: Array<{ reaction?: string; height?: string }>;
  invincible?: [number, number];
};

function movesOf(set: unknown): Record<string, GraphMove> {
  const s = set as { moves?: Record<string, GraphMove> } | Record<string, GraphMove>;
  return (s as { moves?: Record<string, GraphMove> }).moves ?? (s as Record<string, GraphMove>);
}

/** Read a move's combat properties straight off the imported graph. */
export function movePropertiesOf(characterSet: string, moveName: string): MoveProperties | null {
  const graph = SCHWARZERBLITZ_MOVE_GRAPH as unknown as Record<string, unknown>;
  const set = graph[characterSet] ?? graph.common;
  if (!set) return null;
  const move = movesOf(set)[moveName] ?? movesOf(graph.common ?? {})[moveName];
  if (!move) return null;
  const flags = move.flags ?? [];
  const hitboxes = move.hitboxes ?? [];
  const reactions = hitboxes.map((h) => (h.reaction ?? 'WeakMid') as SbReaction);
  return {
    reactions,
    launches: reactions.some((r) => REACTIONS[r]?.kind === 'launch'),
    isThrow: hitboxes.some((h) => h.height === 'Throw'),
    groundOnly: flags.includes('VS_GROUNDED'),
    antiAirOnly: flags.includes('ANTI_AIR_ONLY'),
    counterOnly: flags.includes('ONLY_WHEN_OPPONENT_ATTACKS'),
    followupOnly: flags.includes('FOLLOWUP_ONLY'),
    invincible: move.invincible,
  };
}

/**
 * Can this move come out right now?
 *
 * The graph states three availability rules and the engine honoured none of
 * them, so a ground-only stomp could be thrown at a standing man and an
 * anti-air could be thrown at nobody.
 */
export function moveIsAvailable(
  props: MoveProperties,
  ctx: { opponentGrounded: boolean; opponentAirborne: boolean; opponentAttacking: boolean },
): boolean {
  if (props.groundOnly && !ctx.opponentGrounded) return false;
  if (props.antiAirOnly && !ctx.opponentAirborne) return false;
  if (props.counterOnly && !ctx.opponentAttacking) return false;
  return true;
}

/** Every launcher in the imported data, for the moveset editor and for tests. */
export function allLaunchers(): Array<{ set: string; move: string }> {
  const graph = SCHWARZERBLITZ_MOVE_GRAPH as unknown as Record<string, unknown>;
  const out: Array<{ set: string; move: string }> = [];
  for (const [set, data] of Object.entries(graph)) {
    for (const [name, move] of Object.entries(movesOf(data))) {
      const reactions = (move.hitboxes ?? []).map((h) => h.reaction as SbReaction);
      if (reactions.some((r) => REACTIONS[r]?.kind === 'launch')) out.push({ set, move: name });
    }
  }
  return out;
}

/** Every throw in the imported data. */
export function allThrows(): Array<{ set: string; move: string }> {
  const graph = SCHWARZERBLITZ_MOVE_GRAPH as unknown as Record<string, unknown>;
  const out: Array<{ set: string; move: string }> = [];
  for (const [set, data] of Object.entries(graph)) {
    for (const [name, move] of Object.entries(movesOf(data))) {
      if ((move.hitboxes ?? []).some((h) => h.height === 'Throw')) out.push({ set, move: name });
    }
  }
  return out;
}
