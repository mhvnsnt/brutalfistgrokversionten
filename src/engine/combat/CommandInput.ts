/**
 * COMMAND INPUT — the Tekken / Schwarzerblitz motion-input layer.
 *
 * WHAT WAS MISSING, measured before this was written
 *   Attacks were four raw buttons (lp/rp/lk/rk), each firing one fixed move.
 *   `BrutalFistMove` has carried an `inputSequence?: string` field from the
 *   start and NOT ONE of its 58 moves filled it in. `TekkenInput.ts` parses
 *   dashes, backdashes, sidesteps and crouch — MOVEMENT ONLY. There was no
 *   command buffer, no `d/f+2`, no `b,f+P`, no string, and no stance gating
 *   anywhere in the engine.
 *
 * ORIENTATION IS THE WHOLE POINT OF NUMPAD
 *   A command is stored in NUMPAD notation, which is defined relative to the
 *   way a fighter faces: 6 is always TOWARD THE OPPONENT, for both players.
 *   `numpadFor()` is the single place that turns a world-axis stick reading
 *   into that, and it takes `facing` as an argument.
 *
 *   This module is PURE and READ-ONLY with respect to orientation. It never
 *   sets a yaw, never writes a facing, never moves a fighter. It only reads
 *   `facing` to decide what the player asked for. That is deliberate: the
 *   symptom this system is built to avoid is the one where a command list
 *   makes P2 attack backwards because 'forward' was baked as world +X.
 *   V7OrientationContract stays the only authority on which way a body points.
 *
 *          7 8 9        8 = up (away from camera)
 *          4 5 6        6 = toward the opponent
 *          1 2 3        2 = down / crouch
 */

/** +1 faces +X (P1's combat facing), -1 faces -X (P2's). */
export type Facing = 1 | -1;

/**
 * THE FOUR BUTTONS THE PLAYER ACTUALLY HAS, PLUS THROW.
 *
 * Owner: "I can't press back and right kick at the same time to do a
 * different move than just pressing right kick at once. Or I can't press
 * forward and right kick or forward and right punch ... You're making my
 * game simple and boring and unplayable."
 *
 * He is describing a real hole. The HUD has four attack buttons — 1 LP,
 * 2 RP, 3 LK, 4 RK, the Tekken layout — and `commandButtonsFor` collapsed
 * them into two before the matcher ever saw them:
 *     P: lp || rp      K: lk || rk
 * So `4+LP` and `4+RP` were the same command, and half the vocabulary of a
 * four-button fighter did not exist. The imported Schwarzerblitz corpus is
 * written in P/K/T and CANNOT express the difference — that is a limit of
 * the source, not a reason to keep the limit in our matcher.
 *
 * 'P' and 'K' stay, as WILDCARDS: a step asking for 'P' is satisfied by
 * either fist, 'K' by either foot. Every imported move keeps working
 * unchanged, and a per-limb command can now be written on top.
 */
export type CommandButton = 'LP' | 'RP' | 'LK' | 'RK' | 'T';

/** A button a command STEP may ask for: a specific limb, or either of a pair. */
export type CommandButtonPattern = CommandButton | 'P' | 'K';

/** Which concrete buttons satisfy a step's button. */
const BUTTON_ALTERNATIVES: Record<string, readonly CommandButton[]> = {
  LP: ['LP'], RP: ['RP'], LK: ['LK'], RK: ['RK'], T: ['T'],
  P: ['LP', 'RP'],
  K: ['LK', 'RK'],
};

/** Does a pressed button satisfy what a step asked for? */
export function buttonSatisfies(pattern: string, pressed: readonly CommandButton[]): boolean {
  const alts = BUTTON_ALTERNATIVES[pattern];
  if (!alts) return false;
  return alts.some((b) => pressed.includes(b));
}

export interface StickReading {
  /** World X: +1 = screen right (+X), -1 = screen left, 0 = neutral. */
  x: -1 | 0 | 1;
  /** +1 = up/away from camera, -1 = down/toward camera, 0 = neutral. */
  y: -1 | 0 | 1;
}

export interface CommandEvent {
  /** Numpad direction at the moment of the event, relative to facing. */
  numpad: number;
  /** Buttons that went DOWN on this event. Empty for a pure direction change. */
  buttons: CommandButton[];
  /** Milliseconds. */
  t: number;
}

/** One step of a stored command — the shape the move graph emits. */
export interface CommandStep {
  dirs: number[];
  buttons: string[];
  hold: boolean;
}

/**
 * Turn a world-axis stick reading into a facing-relative numpad direction.
 *
 * 5 is neutral. Forward is `x * facing`, so P1 (facing +1) reads screen-right
 * as 6 and P2 (facing -1) reads screen-LEFT as 6 — both of them "toward the
 * opponent", which is what a command list means.
 */
export function numpadFor(stick: StickReading, facing: Facing): number {
  const forward = stick.x * facing; // -1 back, 0 neutral, +1 forward
  return 5 + forward + 3 * stick.y;
}

/** Numpad -> the facing-relative components it encodes. */
export function numpadParts(numpad: number): { forward: -1 | 0 | 1; up: -1 | 0 | 1 } {
  const idx = numpad - 1;
  const col = idx % 3;      // 0 back, 1 neutral, 2 forward
  const row = Math.floor(idx / 3); // 0 down, 1 neutral, 2 up
  return { forward: (col - 1) as -1 | 0 | 1, up: (row - 1) as -1 | 0 | 1 };
}

/**
 * How long a step stays live in the buffer. Tekken's own window is about 15
 * frames; 250ms at 60fps is 15 frames, which is also long enough to be usable
 * on a touchscreen without making every stray tap part of a motion.
 */
export const STEP_WINDOW_MS = 250;

/** How long the whole buffer remembers. Longer than any single command needs. */
export const BUFFER_MS = 1200;

/** Most events a buffer keeps. A 4-step motion plus slop fits comfortably. */
export const BUFFER_SIZE = 24;

/**
 * Ground input law: attack buttons never implicitly become crouching attacks.
 * Crouch commands must contain 2 (down) or an explicit hold of 2. Jump attacks
 * require an actual 8/up event or an airborne stance. This keeps the default
 * control board predictable while preserving authored command exceptions.
 */
export const DEFAULT_GROUND_INPUT_RULES = {
  neutralButtons: ['LP','RP','LK','RK'] as const,
  crouchDirection: 2,
  forwardDirection: 6,
  backDirection: 4,
  jumpDirection: 8,
} as const;

export function commandRequiresExplicitDirection(step: CommandStep): boolean {
  return step.dirs.includes(2) || step.dirs.includes(8) || step.dirs.includes(1) || step.dirs.includes(3) || step.dirs.includes(7) || step.dirs.includes(9);
}


export interface CommandBuffer {
  events: CommandEvent[];
  /** The last numpad pushed, so a held direction does not spam events. */
  lastNumpad: number;
  /** Buttons currently held, for edge detection. */
  heldButtons: Set<CommandButton>;
  /** When the current direction started being held, for `H<dir>` steps. */
  numpadSince: number;
}

export function createCommandBuffer(): CommandBuffer {
  return { events: [], lastNumpad: 5, heldButtons: new Set(), numpadSince: 0 };
}

/**
 * Feed one frame of input. Events are recorded on EDGES — a direction change
 * or a button going down — never every frame, so holding forward does not
 * flood the buffer and turn `6 6` into a dash the player never asked for.
 *
 * Returns the event pushed, or null when nothing changed.
 */
export function pushInput(
  buffer: CommandBuffer,
  stick: StickReading,
  buttons: Partial<Record<CommandButton, boolean>>,
  facing: Facing,
  now: number,
): CommandEvent | null {
  const numpad = numpadFor(stick, facing);
  const pressed: CommandButton[] = [];
  for (const b of ['LP', 'RP', 'LK', 'RK', 'T'] as const) {
    const down = buttons[b] === true;
    if (down && !buffer.heldButtons.has(b)) pressed.push(b);
    if (down) buffer.heldButtons.add(b);
    else buffer.heldButtons.delete(b);
  }

  const dirChanged = numpad !== buffer.lastNumpad;
  if (dirChanged) {
    buffer.lastNumpad = numpad;
    buffer.numpadSince = now;
  }
  if (!dirChanged && pressed.length === 0) return null;

  const event: CommandEvent = { numpad, buttons: pressed, t: now };
  buffer.events.push(event);

  // Trim by age and by size, oldest first.
  while (buffer.events.length && now - buffer.events[0].t > BUFFER_MS) buffer.events.shift();
  while (buffer.events.length > BUFFER_SIZE) buffer.events.shift();
  return event;
}

/** A move as far as matching is concerned. The move graph's shape, narrowed. */
export interface MatchableMove {
  name: string;
  input: CommandStep[];
  /** Stance the move is available FROM. Undefined = any stance. */
  stance?: string;
  flags?: string[];
}

export interface MatchContext {
  /** The fighter's stance right now, e.g. 'Ground' / 'Crouch' / 'Air'. */
  stance?: string;
  /** Names reachable as a followup this frame. A FOLLOWUP_ONLY move needs one. */
  availableFollowups?: ReadonlySet<string>;
  /** How long the current direction has been held, for `H<dir>` steps. */
  numpadHeldMs?: number;
  now: number;
}

function stepMatches(step: CommandStep, event: CommandEvent): boolean {
  // A step's direction list is alternatives (`6` or, for a loose step, several).
  if (step.dirs.length && !step.dirs.includes(event.numpad)) return false;
  // Every button the step names must have gone down on this same event, which
  // is what makes `6+P` a simultaneous press rather than a sequence.
  for (const b of step.buttons) {
    if (!buttonSatisfies(b, event.buttons)) return false;
  }
  return true;
}

/**
 * Score one move against the buffer. Returns the number of steps matched, or
 * -1 for no match.
 *
 * Matching runs BACKWARDS from the newest event: the final step is the one the
 * player just pressed, and each earlier step must be found within
 * STEP_WINDOW_MS of the step after it. Intervening events are skipped, so a
 * sloppy extra direction between two halves of a motion does not break it.
 */
export function scoreMove(move: MatchableMove, buffer: CommandBuffer, ctx: MatchContext): number {
  const steps = move.input;
  if (!steps.length) return -1;

  // A hold step is about the CURRENT state, not a past edge.
  const lastStep = steps[steps.length - 1];
  if (lastStep.hold) {
    const heldLongEnough = (ctx.numpadHeldMs ?? 0) >= STEP_WINDOW_MS;
    if (!heldLongEnough) return -1;
    if (lastStep.dirs.length && !lastStep.dirs.includes(buffer.lastNumpad)) return -1;
    if (steps.length === 1) return 1;
  }

  let stepIndex = steps.length - 1;
  let eventIndex = buffer.events.length - 1;
  let matched = 0;
  // NOT Infinity: `Infinity - STEP_WINDOW_MS` is still Infinity, so every event
  // reads as "older than the deadline" and even a bare `P` scores -1. The
  // newest step has no deadline at all — the window only binds BETWEEN steps.
  let deadline: number | null = null;

  if (lastStep.hold) stepIndex--; // already satisfied above

  while (stepIndex >= 0 && eventIndex >= 0) {
    const step = steps[stepIndex];
    const event = buffer.events[eventIndex];
    if (deadline !== null && event.t < deadline - STEP_WINDOW_MS) return -1; // the chain went cold
    if (stepMatches(step, event)) {
      matched++;
      deadline = event.t;
      stepIndex--;
    }
    eventIndex--;
  }
  if (stepIndex >= 0) return -1;
  return matched + (lastStep.hold ? 1 : 0);
}

export interface MatchResult<T extends MatchableMove> {
  move: T;
  /** How many command steps matched — the reason this beat the others. */
  steps: number;
}

/**
 * Pick the move the player asked for.
 *
 * LONGEST MATCH WINS. A four-step motion beats `6+P` beats a bare `P`, which is
 * the rule every fighting game uses and the reason a command list feels like
 * one: the special comes out instead of the jab when you earned it.
 */
export function matchCommand<T extends MatchableMove>(
  moves: readonly T[],
  buffer: CommandBuffer,
  ctx: MatchContext,
): MatchResult<T> | null {
  let best: MatchResult<T> | null = null;

  for (const move of moves) {
    if (move.stance && ctx.stance && move.stance !== ctx.stance) continue;
    if (move.flags?.includes('FOLLOWUP_ONLY') && !ctx.availableFollowups?.has(move.name)) continue;

    const steps = scoreMove(move, buffer, ctx);
    if (steps <= 0) continue;

    if (
      !best ||
      steps > best.steps ||
      // Same length: the MORE SPECIFIC command wins. `6+P` asks for a direction
      // AND a button, a bare `P` asks for one thing — so forward+punch must beat
      // the jab even though both are a single step. Counting buttons alone left
      // that tie to iteration order, which made the directional move unreachable.
      (steps === best.steps && specificity(move) > specificity(best.move))
    ) {
      best = { move, steps };
    }
  }
  return best;
}

/** How much a command asks for: every direction and every button in it. */
function specificity(move: MatchableMove): number {
  return move.input.reduce((a, s) => a + s.dirs.length + s.buttons.length, 0);
}

/**
 * Clear the buffer after a command is consumed, so one motion cannot fire the
 * same special twice on the next button press.
 */
export function consumeCommand(buffer: CommandBuffer): void {
  buffer.events.length = 0;
}
