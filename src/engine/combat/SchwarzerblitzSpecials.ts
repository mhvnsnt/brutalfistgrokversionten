/**
 * Turn the imported Schwarzerblitz move graph into specials the fight engine
 * can actually execute — with their OWN animations and their OWN commands.
 *
 * WHAT THIS CLOSES. The engine's special-move system existed but was
 * BUTTON-ONLY: `sequence: ['heavy','heavy','light']`. There was no `d/f+2`, no
 * `b,f+P`, no motion of any kind, and `BrutalFistMove.inputSequence` was
 * declared and never filled on any of its 58 moves. Meanwhile 128 authored
 * commands sat in the imported graph with nothing reading them.
 *
 * FRAME DATA IS DERIVED FROM THE SOURCE, not invented:
 *   #FRAMES a b is the ACTIVE window in frames at the engine's own 24 fps
 *   (FK_BasicAnimationRate = 24.0, read out of FK_Database.h). So startup is
 *   a/24 seconds, active is (b-a)/24, and recovery comes from the move's own
 *   #DELAY_AFTER_MOVE_MS where it has one.
 *
 * DAMAGE IS MAPPED, NOT MULTIPLIED, and the numbers are measured.
 *   MEASURED over all 132 hitboxes in the corpus: min 2, median 10, p90 20,
 *   max 45. This engine's own band is narrow by comparison — light 80, heavy
 *   150 — so a single multiplier cannot serve both ends: anchoring on the max
 *   makes a median hit weaker than a jab, and anchoring on the median makes
 *   the hardest hit a one-shot. (I tried the multiplier first, on a partial
 *   sample that looked like it topped out at 18. It scaled the real maximum to
 *   375. The test caught it.)
 *
 *   So the source range is mapped LINEARLY onto a playable band: the weakest
 *   hit lands like this engine's light, the hardest like a strong special.
 *   Ordering is preserved exactly, so the source keeps its own balance.
 *
 * THE ANIMATION IS THE POINT. `move.animation` is the Schwarzerblitz clip's
 * own name, so a matched command plays the motion it was authored with rather
 * than a generic punch — which is what makes two characters' specials look
 * like different moves.
 */

// Explicit extensions on purpose: they are what let the repo's own runner
// (`node --experimental-strip-types --test`) resolve these modules. tsconfig
// sets allowImportingTsExtensions and Vite/esbuild resolve them unchanged.
import type { SpecialMoveDefinition } from './FighterStateMachine.ts';
import { expandRootMotion } from './SchwarzerblitzRootMotion.ts';
import type { CommandButton, CommandStep } from './CommandInput.ts';
import type { MoveLink } from './FighterStateMachine.ts';
import {
  SCHWARZERBLITZ_MOVE_GRAPH,
  type SbMove,
} from '../../generated/SchwarzerblitzMoveGraph.generated.ts';

/** The engine's own animation rate, read from FK_Database.h. */
export const SOURCE_FPS = 24;

/** The corpus's own hitbox damage range, measured across all 132 of them. */
export const SOURCE_DAMAGE_MIN = 2;
export const SOURCE_DAMAGE_MAX = 45;
/** The band they map onto: this engine's light attack, up to a strong special. */
export const ENGINE_DAMAGE_MIN = 80;
export const ENGINE_DAMAGE_MAX = 280;

/**
 * Map a source hitbox's damage onto the engine's band, preserving order.
 * Clamped at both ends so a future import outside the measured range still
 * lands somewhere playable rather than doing 7 damage or 900.
 */
export function scaleDamage(sourceDamage: number): number {
  const span = SOURCE_DAMAGE_MAX - SOURCE_DAMAGE_MIN;
  const t = Math.min(1, Math.max(0, (sourceDamage - SOURCE_DAMAGE_MIN) / span));
  return Math.round(ENGINE_DAMAGE_MIN + t * (ENGINE_DAMAGE_MAX - ENGINE_DAMAGE_MIN));
}

/** A move with no #DELAY_AFTER_MOVE_MS still has to recover from something. */
export const DEFAULT_RECOVERY_S = 0.3;

/**
 * Our four attack buttons against Schwarzerblitz's three.
 *
 * Schwarzerblitz has ONE punch, ONE kick and a throw; this engine has a light
 * and a heavy of each. A command written for `P` therefore accepts EITHER
 * punch, which is what keeps the imported commands playable on this pad
 * instead of silently requiring a button the player does not have.
 */
export const BUTTON_ALIASES: Record<string, string[]> = {
  P: ['P'],
  K: ['K'],
  T: ['T'],
};

/** Which of our inputs satisfies a Schwarzerblitz button. */
/**
 * THE FOUR BUTTONS REACH THE MATCHER AS FOUR BUTTONS.
 *
 * This used to return `{P: lp||rp, K: lk||rk, T: grapple}` — the four
 * buttons on the HUD collapsed into two before anything could tell them
 * apart, which is why `forward + right punch` and `forward + left punch`
 * were the same move and why the owner could not build a command list.
 * A step asking for the imported corpus's 'P' or 'K' still matches either
 * fist or either foot, so nothing that worked stops working.
 */
export function commandButtonsFor(input: {
  lp?: boolean; rp?: boolean; lk?: boolean; rk?: boolean; grapple?: boolean;
}): Partial<Record<CommandButton, boolean>> {
  return {
    LP: Boolean(input.lp),
    RP: Boolean(input.rp),
    LK: Boolean(input.lk),
    RK: Boolean(input.rk),
    T: Boolean(input.grapple),
  };
}

/** The hardest hitbox on a move decides how heavy it reads. */
function peakDamage(move: SbMove): number {
  return move.hitboxes.reduce((max, h) => Math.max(max, h.damage || 0), 0);
}

function isPlayable(move: SbMove): boolean {
  // A command with no steps cannot be input, and a move with no hitbox is a
  // stance change or a step — real, but not a special the player "does".
  if (!move.input.length) return false;
  if (!move.hitboxes.length) return false;
  // FOLLOWUP_ONLY moves ARE imported now that cancel windows are modelled —
  // they are most of what a cancel points at, and excluding them left 18 of
  // 30 authored links in chara_tutor pointing at nothing. They carry
  // `followupOnly`, so only a cancel window can reach them and a combo ender
  // still cannot be thrown from neutral.
  // A single bare button is not a command — it is the jab the engine already
  // has, and registering it would shadow every normal attack.
  const steps = move.input;
  if (steps.length === 1 && steps[0].dirs.length === 0) return false;
  return true;
}

/**
 * Which motion state a move reads as — DERIVED FROM THE HITBOX, not the name.
 *
 * Schwarzerblitz names hitboxes by the bone that carries them, so a hit on a
 * foot or a leg is a kick and a hit on a hand or an arm is a punch. That is the
 * data telling us what the move is; the move's own NAME is only a hint, and the
 * corpus has names like "Megiddo" that say nothing about the limb.
 *
 * The motion state is a FALLBACK anyway: the real clip is carried in `clip` and
 * tried first. This only decides what plays if the fighter's rig lacks it.
 */
export function motionStateFor(move: SbMove): 'lightAttack' | 'heavyAttack' | 'lightKick' | 'heavyKick' {
  const bones = move.hitboxes.map((h) => h.bone.toLowerCase()).join(' ');
  const kick = /foot|leg|knee|shin|toe|ankle/.test(bones);
  const heavy = peakDamage(move) >= 20; // the corpus's p90; max is 45
  if (kick) return heavy ? 'heavyKick' : 'lightKick';
  return heavy ? 'heavyAttack' : 'lightAttack';
}

/**
 * The source's frame windows, in seconds from the start of the move.
 *
 * `#FOLLOWUP` and `#CANCEL_INTO` in moves.txt each carry a frame range at the
 * engine's own 24 fps. Those ranges are the whole cancel system: a move with
 * no links cannot be interrupted, and one with links can only be interrupted
 * by the moves it names, inside the frames it names. 133 moves carry this and
 * nothing read it until now.
 */
function linksOf(
  list: SbMove['followups'] | SbMove['cancelInto'],
  /**
   * The set the link's target lives in. A link names a RAW move name
   * ('Rotary_Kick') while a special's id is namespaced by its set
   * ('sb_chara_tutor_Rotary_Kick'); without this the ids never match and
   * every authored cancel window is silently dead.
   */
  setName: string,
): MoveLink[] {
  const out: MoveLink[] = [];
  for (const link of list ?? []) {
    const [a, b] = link.window ?? [0, 0];
    if (!link.move) continue;
    out.push({
      move: `sb_${setName}_${link.move}`,
      from: Math.max(0, a / SOURCE_FPS),
      // A zero-length window would never be open on any frame; give a link
      // with no range the rest of the move rather than dropping it.
      to: b > a ? b / SOURCE_FPS : Number.POSITIVE_INFINITY,
    });
  }
  return out;
}

export function moveWindowFor(move: SbMove, setName = '') {
  const [a, b] = move.frames ?? [0, 4];
  const startup = Math.max(0.04, a / SOURCE_FPS);
  const active = Math.max(0.04, (b - a) / SOURCE_FPS);
  const recovery = move.delayAfterMs ? move.delayAfterMs / 1000 : DEFAULT_RECOVERY_S;
  const damage = scaleDamage(peakDamage(move));
  return {
    startup,
    active,
    recovery,
    // A typed motion state for every existing consumer...
    animation: motionStateFor(move),
    // ...and the clip the move was actually authored with, tried first.
    clip: move.animation,
    hitboxStartFrame: a,
    hitboxEndFrame: Math.max(a + 1, b),
    totalFrames: Math.round((startup + active + recovery) * 60),
    damage,
    isSpecial: true,
    specialName: (move.displayName ?? move.name).replace(/_/g, ' '),
    cancelInto: linksOf(move.cancelInto, setName),
    followups: linksOf(move.followups, setName),
    // THE TRAVEL THE MOVE WAS AUTHORED WITH. 127 of the 133 imported moves
    // carry per-frame root motion and nothing read it, so a lunging punch
    // stood still unless it was one of five names in a hand-written table.
    // Expanded over the move's WHOLE length, not just its active window: a
    // move that steps back before it strikes authors that step in its startup.
    rootMotion: expandRootMotion(move.movement, Math.max(b, a + 1)),
  };
}

/** Normalise a parsed command step to the buttons the matcher will see. */
function normaliseStep(step: CommandStep): CommandStep {
  return {
    dirs: step.dirs.filter((d) => d >= 1 && d <= 9),
    // 'P' and 'K' are kept as WILDCARDS, not widened here: the matcher
    // satisfies them with either fist or either foot. Per-limb steps ('LP',
    // 'RK') pass through for commands we author ourselves.
    buttons: step.buttons.filter((b) => ['LP', 'RP', 'LK', 'RK', 'P', 'K', 'T'].includes(b)),
    hold: step.hold,
  };
}

/**
 * Build the special list for a move set. `setName` is a key of the imported
 * graph ('common' plus the authored character sets); an unknown name yields an
 * empty list rather than throwing, so a missing set degrades to button-only
 * specials instead of breaking a match.
 */
/**
 * WHICH ANIMATION EACH COMMAND PLAYS.
 *
 * Owner: "currently can only fire off 4 attacks and it's the base ones ...
 * not forward P/K, jump RK, back, back-forward. Full movesets and individual
 * movesets so they're not all doing the same attacks — it's boring when all
 * fighters are doing the same 4 attacks the whole fight."
 *
 * THE INPUTS WERE NEVER MISSING. MEASURED: 26 reachable directional commands
 * across the two imported sets, and every one of them resolved to one of
 * THREE animations — `lightAttack`, `lightKick`, `heavyKick`. Five different
 * punches all played `lightAttack`. The moveset was real and rendered as the
 * same swing, which is exactly what he was describing.
 *
 * tools/moves/map_commands.mjs assigns a DISTINCT clip per command on the
 * bake's own measurements — which limb reaches and how far, whether the clip
 * leaves the floor, how long it is, and the slot the bake already filed it
 * under — never on the name. It is seeded per fighter, so two men on the same
 * source set share 18% of their clips instead of 100%.
 *
 * Absent, every move keeps the clip the source authored and the behaviour is
 * exactly as it was.
 */
let commandClips: { sets?: Record<string, Record<string, string>>; fighters?: Record<string, Record<string, string>> } = {};

export function setCommandClipMap(map: typeof commandClips): void {
  commandClips = map ?? {};
}

function clipForCommand(id: string, setName: string, fighterId?: string): string | undefined {
  if (fighterId) {
    const own = commandClips.fighters?.[fighterId.toLowerCase()]?.[id];
    if (own) return own;
  }
  return commandClips.sets?.[setName]?.[id];
}

export function schwarzerblitzSpecials(
  setName = 'chara_tutor',
  fighterId?: string,
): SpecialMoveDefinition[] {
  const set = SCHWARZERBLITZ_MOVE_GRAPH[setName] ?? [];
  const common = SCHWARZERBLITZ_MOVE_GRAPH.common ?? [];
  const seen = new Set<string>();
  const out: SpecialMoveDefinition[] = [];

  for (const move of [...set, ...common]) {
    if (!isPlayable(move)) continue;
    const id = `sb_${setName}_${move.name}`;
    if (seen.has(id)) continue;
    seen.add(id);

    const command = move.input.map(normaliseStep).filter((s) => s.dirs.length || s.buttons.length);
    if (!command.length) continue;

    out.push({
      id,
      name: (move.displayName ?? move.name).replace(/_/g, ' '),
      sequence: [], // motion-only: the button path is not how this is reached
      command,
      stance: move.stance,
      followupOnly: move.flags.includes('FOLLOWUP_ONLY'),
      move: (() => {
        const w = moveWindowFor(move, setName);
        const mapped = clipForCommand(id, setName, fighterId);
        return mapped ? { ...w, clip: mapped } : w;
      })(),
    });
  }
  return out;
}

/** Every set the graph carries, for the moveset editor and for tests. */
export function availableMoveSets(): string[] {
  return Object.keys(SCHWARZERBLITZ_MOVE_GRAPH);
}

/**
 * Which imported set a fighter draws from.
 *
 * The corpus ships three authored sets plus `common`. Spreading the roster
 * across them deterministically means two fighters do not share a command list
 * purely by accident — and it is a seam: when a character gets his own
 * authored set, this is the one place that has to change.
 */
export function moveSetForFighter(fighterId: string): string {
  // Do not hash characters into an arbitrary source set. The old hash could
  // route a power wrestler into the dummy corpus (randomSquareRotation2,
  // facepalm, randomFlight), which made the roster look like it shared broken
  // or nonsensical moves. Select from the two authored fighting sets using the
  // character's canonical style, while keeping a deterministic explicit seam
  // for future per-character source sets.
  const id = fighterId.toLowerCase();
  const styleById: Record<string, string> = {
    bannon: 'chara_tutor2',
    maime: 'chara_tutor',
    cipher: 'chara_tutor2',
  };
  if (styleById[id]) return styleById[id];

  // Character IDs are stable roster data, so these style families are
  // character-specific without inventing moves at runtime.
  const fighterStyles: Record<string, string> = {
    onyx: 'chara_tutor2',
    cain_elias: 'chara_tutor2',
    hall_nighter: 'chara_tutor2',
    cody: 'chara_tutor2',
    echo: 'chara_tutor',
    stick_up: 'chara_tutor',
    static: 'chara_tutor2',
  };
  if (fighterStyles[id]) return fighterStyles[id];

  // Unknown/new roster members use the stable technical set rather than the
  // dummy corpus. Their own defaultMoveSet remains authoritative for core
  // attacks and the source graph only supplies additional commands.
  return 'chara_tutor';
}
