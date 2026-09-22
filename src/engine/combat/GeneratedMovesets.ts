// `.ts` extensions on purpose — the repo's runner resolves them literally.
import type { SpecialMoveDefinition } from './FighterStateMachine.ts';

/**
 * A FULL MOVESET PER FIGHTER, ACROSS THE WHOLE DIRECTIONAL MATRIX.
 *
 * Owner: "currently can only fire off 4 attacks and it's the base ones ...
 * not forward P/K, jump RK, back, back-forward. Full movesets and individual
 * movesets so they're not all doing the same attacks. It's boring when all
 * fighters are doing the same 4 attacks the whole fight, that's not like
 * Tekken at all."
 *
 * TWO SEPARATE THINGS WERE WRONG AND ONLY ONE OF THEM WAS THE CLIPS.
 *
 * The first was that 26 imported commands all played three animations, which
 * is fixed by the clip map. That made the moves he HAS look different. It did
 * not give him more of them.
 *
 * The second is inventory. MEASURED: Bannon draws ELEVEN commands from the
 * imported graph, and three of those require Crouch or Air, so EIGHT are
 * reachable standing. The imported corpus is a demo set — `chara_tutor`,
 * `chara_tutor2` — and it was never a moveset. Eight standing attacks is
 * exactly what "the same 4 attacks the whole fight" feels like.
 *
 * So tools/moves/map_commands.mjs fills the matrix out: every direction
 * crossed with punch and kick, in each stance the engine already understands,
 * 26 slots. Neutral is left alone because the engine's base light and heavy
 * own it. Each slot draws a distinct clip from the measured attack pool with
 * a reuse penalty, seeded per fighter — Bannon's set holds 24 distinct clips
 * and shares 27% with Onyx's.
 *
 * NAMED FOR THE MOTION, NEVER FOR A PERSON: the direction plus the limb that
 * does the work — "Forward Hammer", "Rising Kick", "Ducking Knee". That is
 * the owner's naming law and it costs nothing to honour.
 *
 * The frame data comes from each clip's own duration rather than being
 * invented, so a long windup really is slower to come out.
 *
 * Absent the file, nothing is registered and the fighter keeps exactly the
 * imported commands he had.
 */
export interface GeneratedMove {
  id: string;
  name: string;
  command: Array<{ dirs: number[]; buttons: string[] }>;
  stance: string;
  clip: string;
  startup: number;
  active: number;
  recovery: number;
  damage: number;
  /** Measured source-limb reach in metres, used to size the contact envelope. */
  contactReach?: number;
}

let table: Record<string, GeneratedMove[]> = {};

export function setGeneratedMovesets(t: Record<string, GeneratedMove[]>): void {
  table = t ?? {};
}

export function generatedMovesetsLoaded(): number {
  return Object.keys(table).length;
}

/** This fighter's generated commands, as the state machine wants them. */
export function generatedMoveset(fighterId: string): SpecialMoveDefinition[] {
  const rows = table[fighterId?.toLowerCase()] ?? [];
  return rows.map((m) => {
    // Older generated artifacts may label 1/2/3 attacks as Ground. The
    // command itself is authoritative: down-direction attacks are crouch
    // attacks and therefore require the crouch stance at match time.
    const dirs = m.command.flatMap((c) => c.dirs);
    const effectiveStance = /[123]/.test(dirs.join('')) ? 'Crouch' : m.stance;
    return {
    id: m.id,
    name: m.name,
    sequence: [],
    command: m.command as never,
    stance: effectiveStance,
    move: {
      startup: m.startup,
      active: m.active,
      recovery: m.recovery,
      // The generic state keeps every attack behaviour keyed off it —
      // ATTACK_STATES, the root-motion profile, the hit window, the attack
      // lock. The specific animation rides on `clip`, which the mesh takes
      // through `attackClip`. Pushing it through `animation` instead is what
      // silently stopped authored specials being treated as attacks at all.
      animation: m.command.some((c) => c.buttons.includes('K')) ? 'heavyKick' : 'heavyAttack',
      clip: m.clip,
      hitboxStartFrame: Math.max(1, Math.round(m.startup * 60)),
      hitboxEndFrame: Math.max(2, Math.round((m.startup + m.active) * 60)),
      totalFrames: Math.round((m.startup + m.active + m.recovery) * 60),
      damage: m.damage,
      contactReach: m.contactReach,
      isSpecial: true,
      specialName: m.name,
    },
    };
  }) as SpecialMoveDefinition[];
}
