/**
 * THE REACTION MATRIX — what the body does when it is hit, and why ours looked
 * like one thing happening over and over.
 *
 * Owner: "the blends of animations, when the juggle should happen, when they
 * get hit, how far back they should go, the hit reactions, when they get
 * slammed and they do the little thing like they react to getting slammed on
 * the ground ... all that little in between shit in Tekken that make the game
 * funner and smoother and actually feel like a fight."
 *
 * That cluster has a name and a shape, and Tekken's own data layout is the
 * clearest statement of it. Every HitCondition of every move points at a
 * `Reactions` struct, and that struct is NOT one reaction — read off
 * TKMovesets' Structs_t7.h / Structs_t8.h, it holds:
 *
 *     15 victim ANIMATIONS      standing · default · crouch · counterhit ·
 *                               crouch_counterhit · left_side ·
 *                               crouch_left_side · right_side ·
 *                               crouch_right_side · backturned ·
 *                               crouch_backturned · block · crouch_block ·
 *                               wallslump · downed
 *      7 PUSHBACKS              front · backturned · left_side · right_side ·
 *                               front_counterhit · downed · block
 *      6 DIRECTIONS             one per side, plus counterhit and downed
 *      6 ROTATIONS              the same again — a hit SPINS the victim
 *
 * and a Pushback is itself `{duration, displacement, num_of_loops, extradata}`,
 * a displacement over TIME, not a single shove.
 *
 * The comment Tekken's own reversers left on `front_counterhit_pushback` says
 * the whole thing out loud: "If you ever wondered why your CH launcher didn't
 * launch after a sidestep, that's why." The reaction is a function of WHAT THE
 * VICTIM WAS DOING, not just of the move that hit them.
 *
 * OURS WAS ONE-DIMENSIONAL. `reactionFor(name)` took the attack's name and
 * returned one effect: 12 named entries collapsing to 5 kinds, one scalar
 * pushback, no direction, no rotation, and the victim's state consulted exactly
 * once — `if (juggle.airborne)`. So a jab to a standing man, a jab to a
 * crouching man, a jab to a man facing away and a jab to a man already in the
 * air all played the same flinch and shoved him the same distance. That is why
 * it reads as one thing happening on a loop instead of a fight.
 *
 * This is the second dimension. It does not replace HitReactions — that still
 * owns the attack's side of it (how hard, how long, launch or not). This owns
 * the VICTIM's side: which animation, how far, which way, and how much of the
 * stun actually applies.
 *
 * WHAT WE CAN ACTUALLY PLAY. Every state below maps to a clip the bank already
 * holds and the engine was never asking for:
 *     REACTION_HEAVYHITAIRREVOLT       0.833s   the airborne hit
 *     REACTION_HEAVYHITAIRREVOLTBACK   0.333s   airborne, from behind
 *     REACTION_HITWEAKMEDIUMBACK       0.167s   standing, from behind
 *     FALLING_FLAT_IMPACT              1.567s   the slam landing
 */
import type { FighterMotionState } from '../retarget/AnimationController.ts';

/**
 * The victim states Tekken picks a different reaction for. Named after its own
 * fields so the two can be compared without a translation step.
 */
export type VictimState =
  | 'standing'
  | 'crouch'
  | 'airborne'
  | 'backTurned'
  | 'crouchBackTurned'
  | 'sideLeft'
  | 'sideRight'
  | 'block'
  | 'crouchBlock'
  | 'wallSlump'
  | 'downed';

/** The attack's half of the reaction, as HitReactions already classifies it. */
export type ReactionKind = 'none' | 'hitstun' | 'crumple' | 'launch' | 'smackdown';

export interface ResolvedReaction {
  /** The animation the VICTIM plays. */
  motion: FighterMotionState;
  /** Multiplier on the attack's authored stun. */
  stunScale: number;
  /** Multiplier on the attack's authored pushback. */
  pushbackScale: number;
  /**
   * How many frames the push is spread over. Tekken authors a `duration` per
   * pushback per victim state — a blocked hit is a short sharp shove, a
   * back-turned one carries further and longer, a downed body barely moves at
   * all. A displacement over time is what reads as being knocked back; the same
   * distance in one frame reads as a teleport.
   */
  pushbackFrames: number;
  /**
   * Degrees the hit spins the victim about their own up axis. Tekken stores a
   * rotation per side because a hit landing on your flank turns you; without it
   * a side hit reads as a front hit played off-centre.
   */
  rotationDeg: number;
  /** Where the push goes, in the attacker's frame. */
  direction: 'back' | 'backLeft' | 'backRight' | 'down' | 'up';
  /** True when this reaction keeps the victim off the mat (a juggle continues). */
  keepsAirborne: boolean;
}

/** A hit that lands while the attacker was still swinging is a counter hit. */
export interface ReactionQuery {
  kind: ReactionKind;
  victim: VictimState;
  counterHit?: boolean;
}

const R = (
  motion: FighterMotionState,
  stunScale: number,
  pushbackScale: number,
  rotationDeg: number,
  direction: ResolvedReaction['direction'],
  keepsAirborne = false,
  pushbackFrames = 8,
): ResolvedReaction => ({ motion, stunScale, pushbackScale, rotationDeg, direction, keepsAirborne, pushbackFrames });

/**
 * AIRBORNE BEATS EVERYTHING. A body already off the mat cannot crouch, cannot
 * block and cannot turn, so every attack kind resolves to the air reaction and
 * the juggle continues. This is the row that makes a juggle look like a juggle
 * instead of a man being shoved sideways in mid air.
 */
const AIRBORNE: Record<ReactionKind, ResolvedReaction> = {
  none:      R('hit',      0,    0,    0,  'back', true),
  // A light hit in the air barely moves them: that is what keeps a combo going.
  hitstun:   R('hitAir',   0.55, 0.35, 8,  'back', true, 14),
  crumple:   R('hitAir',   0.80, 0.55, 14, 'back', true, 16),
  // Re-launching an airborne body lifts them a little rather than resetting the
  // arc, so a juggle cannot be held up forever.
  launch:    R('hitAir',   0.90, 0.40, 10, 'up',   true),
  // The slam that ENDS a juggle. This is the "little thing when they get
  // slammed" — the body is driven down and lands on the mat.
  smackdown: R('hitGround', 1.0, 0.25, 0,  'down', false, 4),
};

const STANDING: Record<ReactionKind, ResolvedReaction> = {
  none:      R('hit',       0,    0,    0, 'back'),
  hitstun:   R('hit',       1.0,  1.0,  0, 'back'),
  crumple:   R('hitHigh',   1.0,  1.0,  4, 'back'),
  launch:    R('hitAir',    1.0,  1.0,  0, 'up', true),
  smackdown: R('hitGround', 1.0,  0.6,  0, 'down'),
};

const CROUCH: Record<ReactionKind, ResolvedReaction> = {
  none:      R('hit',       0,    0,    0, 'back'),
  // A crouching body is already low and braced: it absorbs more of the push.
  hitstun:   R('hitLow',    1.0,  0.7,  0, 'back'),
  crumple:   R('hitLow',    1.05, 0.8,  0, 'back'),
  // A launcher on a crouching opponent is the classic full launch.
  launch:    R('hitAir',    1.15, 1.0,  0, 'up', true),
  smackdown: R('hitGround', 1.0,  0.5,  0, 'down'),
};

/**
 * BACK-TURNED. You cannot brace against what you cannot see, so the stun and
 * the push are both larger and the victim is spun back round to face the
 * attacker — which is also how the back-turn state ends.
 */
const BACK_TURNED: Record<ReactionKind, ResolvedReaction> = {
  none:      R('hit',       0,    0,     0,   'back'),
  hitstun:   R('hitBack',   1.25, 1.35, 60,   'back', false, 12),
  crumple:   R('hitBack',   1.35, 1.5,  90,   'back', false, 14),
  launch:    R('hitAir',    1.3,  1.2,  75,   'up', true),
  smackdown: R('hitGround', 1.1,  0.7,  45,   'down'),
};

/**
 * A HIT FROM THE FLANK TURNS YOU. Tekken keeps a whole rotation per side for
 * this; without it a side hit is a front hit played off-centre, which is the
 * single biggest reason a sidestep does not read as having worked.
 */
const sideRow = (sign: 1 | -1): Record<ReactionKind, ResolvedReaction> => ({
  none:      R('hit',       0,    0,    0,          'back'),
  hitstun:   R('hit',       1.05, 0.85, 35 * sign,  sign > 0 ? 'backRight' : 'backLeft'),
  crumple:   R('hitHigh',   1.15, 1.0,  50 * sign,  sign > 0 ? 'backRight' : 'backLeft'),
  launch:    R('hitAir',    1.1,  0.9,  40 * sign,  'up', true),
  smackdown: R('hitGround', 1.0,  0.5,  25 * sign,  'down'),
});

/**
 * GROUNDED. A body on the mat does not flinch upright and does not slide — it
 * takes the hit where it lies. Tekken keeps a separate downed pushback and
 * downed direction for exactly this.
 */
const DOWNED: Record<ReactionKind, ResolvedReaction> = {
  none:      R('knockdown',  0,   0,    0, 'down'),
  hitstun:   R('hitGround',  0.6, 0.15, 0, 'down', false, 4),
  crumple:   R('hitGround',  0.8, 0.2,  0, 'down', false, 4),
  // You cannot launch someone who is already on the floor.
  launch:    R('hitGround',  0.8, 0.2,  0, 'down'),
  smackdown: R('hitGround',  1.0, 0.1,  0, 'down'),
};

/** Pinned against the wall: nowhere to be pushed, so the stun carries it. */
const WALL_SLUMP: Record<ReactionKind, ResolvedReaction> = {
  none:      R('hit',       0,    0,    0, 'back'),
  hitstun:   R('hit',       1.2,  0.15, 0, 'back'),
  crumple:   R('hitHigh',   1.35, 0.15, 0, 'back'),
  launch:    R('hitAir',    1.2,  0.2,  0, 'up', true),
  smackdown: R('hitGround', 1.0,  0.1,  0, 'down'),
};

const BLOCK: Record<ReactionKind, ResolvedReaction> = {
  none:      R('guard',     0,    0,    0, 'back'),
  hitstun:   R('guard',     0.45, 0.8,  0, 'back', false, 5),
  crumple:   R('guard',     0.55, 1.0,  0, 'back', false, 6),
  launch:    R('guard',     0.5,  0.9,  0, 'back'),
  smackdown: R('guard',     0.5,  0.7,  0, 'back'),
};

const CROUCH_BLOCK: Record<ReactionKind, ResolvedReaction> = {
  none:      R('guardLow',  0,    0,    0, 'back'),
  hitstun:   R('guardLow',  0.45, 0.6,  0, 'back'),
  crumple:   R('guardLow',  0.55, 0.75, 0, 'back'),
  launch:    R('guardLow',  0.5,  0.7,  0, 'back'),
  smackdown: R('guardLow',  0.5,  0.5,  0, 'back'),
};

const MATRIX: Record<VictimState, Record<ReactionKind, ResolvedReaction>> = {
  standing:         STANDING,
  crouch:           CROUCH,
  airborne:         AIRBORNE,
  backTurned:       BACK_TURNED,
  crouchBackTurned: BACK_TURNED,
  sideLeft:         sideRow(-1),
  sideRight:        sideRow(1),
  block:            BLOCK,
  crouchBlock:      CROUCH_BLOCK,
  wallSlump:        WALL_SLUMP,
  downed:           DOWNED,
};

/**
 * COUNTER HIT IS A ROW, NOT A MULTIPLIER.
 *
 * Tekken gives counter hit its own reaction animation AND its own pushback, and
 * only from the FRONT — which is the whole content of that comment about a CH
 * launcher failing after a sidestep. So it applies to the states where the
 * victim was coming forward, and is ignored on a body that is already airborne,
 * downed or blocking.
 */
const COUNTER_APPLIES: ReadonlySet<VictimState> = new Set(['standing', 'crouch', 'backTurned', 'crouchBackTurned']);
const COUNTER_STUN = 1.3;
const COUNTER_PUSHBACK = 1.15;

/** The victim's animation, stun, push, spin and direction for one hit. */
export function resolveReaction({ kind, victim, counterHit = false }: ReactionQuery): ResolvedReaction {
  const row = MATRIX[victim] ?? STANDING;
  const base = row[kind] ?? row.hitstun;
  if (!counterHit || !COUNTER_APPLIES.has(victim)) return base;
  return {
    ...base,
    stunScale: base.stunScale * COUNTER_STUN,
    pushbackScale: base.pushbackScale * COUNTER_PUSHBACK,
    // A counter-hit crumple is what turns a poke into a launcher in Tekken.
    motion: kind === 'crumple' ? 'hitAir' : base.motion,
    keepsAirborne: base.keepsAirborne || kind === 'crumple',
  };
}

/** Every state the matrix covers, for the audit and the tests. */
export const VICTIM_STATES: readonly VictimState[] = Object.keys(MATRIX) as VictimState[];
export const REACTION_KINDS: readonly ReactionKind[] = ['none', 'hitstun', 'crumple', 'launch', 'smackdown'];

/**
 * How many DISTINCT outcomes the matrix can produce. The audit reports this
 * against Tekken's 15 animations x 7 pushbacks.
 */
export function distinctOutcomes(): number {
  const seen = new Set<string>();
  for (const v of VICTIM_STATES) {
    for (const k of REACTION_KINDS) {
      for (const ch of [false, true]) {
        const r = resolveReaction({ kind: k, victim: v, counterHit: ch });
        seen.add(`${r.motion}|${r.stunScale}|${r.pushbackScale}|${r.rotationDeg}|${r.direction}|${r.pushbackFrames}`);
      }
    }
  }
  return seen.size;
}
