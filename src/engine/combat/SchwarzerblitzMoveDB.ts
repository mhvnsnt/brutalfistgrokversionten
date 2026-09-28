/**
 * THE WHOLE SCHWARZERBLITZ MOVE MODEL, NOT JUST ITS ANIMATIONS.
 *
 * Owner: "bring in all its schwarzerblitz data but u need more on top of that",
 * and "stop jerry rig patching".
 *
 * This project already ships Schwarzerblitz's CLIPS. It left the move model
 * behind — so six move windows were hand-authored and the other 286 had their
 * timings derived from clip length, which is how long an animation happens to
 * run rather than fighting-game frame data. The assets were a fighting game's;
 * the data underneath them was not.
 *
 * tools/moves/import_schwarzerblitz.mjs reads every moves.txt and keeps the
 * entire schema. What came across, measured:
 *
 *     133 moves across 4 characters
 *     137 hitboxes, each naming a REACTION and an ATTACK HEIGHT
 *      31 cancel windows with frame ranges
 *      71 followups with frame ranges
 *     127 per-move movement curves
 *      33 invincibility windows, several keyed to an attack TYPE
 *      16 armour windows, likewise
 *      44 follow-up-only moves
 *
 * THE REACTION AND THE HEIGHT ARE WHY THIS MATTERS. Every hitbox says which
 * reaction the victim plays (WeakHigh, Flight, StrongMid, Smackdown...) and
 * whether the attack is High, Mid, Low or a Throw. Those are the two fields our
 * 286 imported moves had NONE of, and they are exactly what ReactionMatrix and
 * the guard layer were built to consume — the reaction names already match
 * because HitReactions was ported from this same game.
 */

export interface SbHitbox {
  bone: string;
  /** Active window, in frames. */
  from: number;
  to: number;
  damage: number;
  hits: string;
  extra: number;
  /** The reaction the VICTIM plays — feeds ReactionMatrix directly. */
  reaction: string;
  /** High / Mid / Low / Throw — feeds the guard layer. */
  height: string;
}

export interface SbWindow { move: string; from: number; to: number }
export interface SbTyped { type: string; from: number; to: number }
export interface SbStep { frame: number; x: number; y: number; z: number }

export interface SbMove {
  character: string;
  name: string;
  displayName?: string;
  animation?: string;
  animationRight?: string;
  frameStart?: number;
  frameEnd?: number;
  rangeMin?: number;
  rangeMax?: number;
  stance?: string;
  newStance?: string;
  delayMs?: number;
  trackAngle?: number;
  followupOnly: boolean;
  flags: string[];
  invincible?: { from: number; to: number };
  hitboxes?: SbHitbox[];
  cancelInto?: SbWindow[];
  followups?: SbWindow[];
  invincibleAgainst?: SbTyped[];
  armorAgainst?: SbTyped[];
  movement?: SbStep[];
  input?: string[];
}

interface SbDatabase {
  characters: string[];
  moves: Record<string, SbMove[]>;
}

let db: SbDatabase | null = null;
const listeners = new Set<() => void>();

/** Hand the database in. The loader calls this; tests call it directly. */
export function setSchwarzerblitzMoves(next: SbDatabase | null): void {
  db = next;
  for (const fn of listeners) fn();
}
export function onSchwarzerblitzMoves(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function schwarzerblitzCharacters(): string[] {
  return db?.characters ?? [];
}

export function schwarzerblitzMoves(character?: string): SbMove[] {
  if (!db) return [];
  if (character) return db.moves[character] ?? [];
  return Object.values(db.moves).flat();
}

/** Every move that can actually be thrown, i.e. not a follow-up-only entry. */
export function startableMoves(character?: string): SbMove[] {
  return schwarzerblitzMoves(character).filter((m) => !m.followupOnly);
}

/**
 * The attack height a move strikes at, from its FIRST damaging hitbox.
 *
 * Authored data always wins over anything derived from a clip's frames, which
 * is what DerivedAttackLevels falls back to. 'Throw' is reported as such
 * because a throw bypasses the guard layer entirely rather than being a height.
 */
export function attackHeightOf(move: SbMove): 'high' | 'mid' | 'low' | 'throw' | null {
  const hit = (move.hitboxes ?? []).find((h) => h.damage > 0 && h.height && h.height !== 'None');
  if (!hit) return null;
  const h = hit.height.toLowerCase();
  if (h === 'high' || h === 'mid' || h === 'low' || h === 'throw') return h;
  return null;
}

/** The reaction the victim plays, from the move's first damaging hitbox. */
export function reactionOf(move: SbMove): string | null {
  const hit = (move.hitboxes ?? []).find((h) => h.damage > 0 && h.reaction && h.reaction !== 'None');
  return hit ? hit.reaction : null;
}

/**
 * The move's frame data, derived from its OWN hitbox rather than its clip.
 *
 * startup = the frame the first hitbox opens
 * active  = how long it stays open
 * recovery = whatever is left of the move afterwards
 */
export function frameDataOf(move: SbMove): { startup: number; active: number; recovery: number } | null {
  const hits = (move.hitboxes ?? []).filter((h) => h.damage > 0);
  if (!hits.length) return null;
  const from = Math.min(...hits.map((h) => h.from));
  const to = Math.max(...hits.map((h) => h.to));
  const end = Math.max(to, move.frameEnd ?? to);
  return { startup: Math.max(1, from), active: Math.max(1, to - from + 1), recovery: Math.max(0, end - to) };
}

/** Can this move be cancelled into another on `frame`? */
export function cancelsAt(move: SbMove, frame: number): SbWindow[] {
  return (move.cancelInto ?? []).filter((c) => frame >= c.from && frame <= c.to);
}
/** The follow-ups available on `frame`. */
export function followupsAt(move: SbMove, frame: number): SbWindow[] {
  return (move.followups ?? []).filter((c) => frame >= c.from && frame <= c.to);
}
/** Is the move invincible or armoured against `type` on `frame`? */
export function defenceAt(move: SbMove, frame: number, type: string): { invincible: boolean; armoured: boolean } {
  const inRange = (w: SbTyped) => frame >= w.from && frame <= w.to
    && (w.type === 'Full' || w.type === type || type === 'Full');
  const plain = move.invincible && frame >= move.invincible.from && frame <= move.invincible.to;
  return {
    invincible: Boolean(plain) || (move.invincibleAgainst ?? []).some(inRange),
    armoured: (move.armorAgainst ?? []).some(inRange),
  };
}
