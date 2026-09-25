#!/usr/bin/env node
/**
 * Import the Schwarzerblitz MOVE GRAPH — the command inputs, stances, followup
 * strings, cancels, hitboxes and per-frame movement that make a fighting game
 * a fighting game rather than four buttons.
 *
 * SOURCE  mhvnsnt/SchwarzerblitzEngine, bin/media/characters/<char>/moves.txt.
 *         Owner-granted; the grant is recorded in
 *         src/engine/retarget/AnimationSourceRegistry.ts and the animation
 *         half of this corpus already ships via sync-schwarzerblitz-motion.mjs.
 *
 * WHY — measured, not assumed
 *   This game's attacks are four raw buttons (lp/rp/lk/rk), each firing one
 *   fixed move. `BrutalFistMove` has carried an `inputSequence?: string` field
 *   from the start and NOT ONE of its 58 moves populates it. There is no
 *   command buffer, no motion input, no string, no stance gating. Measured
 *   across the 27-fighter roster, `idle`, `guard`, `walkForward`,
 *   `walkBackward`, `crouch`, `grappleInitiate` and `ko` each have exactly ONE
 *   distinct value — every character stands, walks, crouches and guards
 *   identically.
 *
 *   The Schwarzerblitz corpus is the opposite: 131 moves, 129 of them with a
 *   real command, 71 with followup windows, 31 with cancels, 98 with framed
 *   hitboxes carrying a guard height and a hit reaction, all gated by six
 *   stances. That is the system, already authored and already licensed.
 *
 * THE FORMAT, read off the files rather than from documentation
 *   #MOVE <name>              a name may carry a leading `!` flag token
 *   #STANCE / #NEWSTANCE      which stance it comes FROM and leads TO
 *   #INPUT .. #INPUT_END      the command: numpad 1-9, arrows < > ^ v,
 *                             buttons P K T, `+` for simultaneous, whitespace
 *                             for sequence, H<dir> for a hold
 *   #FRAMES a b               active window
 *   #FOLLOWUP .. _END         `<Move> <winStart> <winEnd>` — the combo strings
 *   #CANCEL_INTO .. _END      same shape, cancels rather than links
 *   #HITBOX .. _END           `<bone> <f0> <f1> <dmg> <class> <n> <reaction> <height>`
 *   #MOVEMENT .. _END         `> <frame> <x> <y> <z>` displacement
 *
 * NOTHING IS DROPPED. A directive this script does not model is still carried
 * through in `unknown`, and the run reports every distinct one, so an import
 * can never quietly lose authored content.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUTPUT = `${ROOT}/src/generated/SchwarzerblitzMoveGraph.generated.ts`;
const REL = 'schwarzerblitz_engine/bin/media/characters';

function sourceCandidates() {
  const fromEnv = process.env.SCHWARZERBLITZ_REPO ? [resolve(process.env.SCHWARZERBLITZ_REPO)] : [];
  return [
    ...fromEnv,
    join(ROOT, '..', 'SchwarzerblitzEngine'),
    join(ROOT, '..', 'schwarzerblitzengine'),
    join(ROOT, 'vendor', 'SchwarzerblitzEngine'),
  ].map((base) => join(base, ...REL.split('/')));
}

/** Directives that are a bare flag with no value. */
const FLAGS = new Set([
  'FOLLOWUP_ONLY', 'NO_SOUNDS', 'NO_DELAY', 'NO_DIRECTION_LOCK', 'VS_GROUNDED',
  'ANTI_AIR_ONLY', 'ONLY_WHEN_OPPONENT_ATTACKS', 'REQUIRES_PRECISE_INPUT',
  'NO_CANCELS_ON_WHIFF', 'TRACK_AFTER_ANIMATION', 'REQUIRES_BULLET_COUNTERS',
]);

/** Directives that open a block terminated by `<NAME>_END`. */
const BLOCKS = new Set([
  'INPUT', 'MOVEMENT', 'HITBOX', 'FOLLOWUP', 'CANCEL_INTO', 'SOUNDS', 'THROW',
  'BULLET', 'INVINCIBILITY_FRAMES_AGAINST', 'ARMOR_FRAMES_AGAINST', 'INVINCIBLE_AGAINST',
]);

/**
 * Parse one command string into ordered steps.
 *
 * `2 1 4 P` is a quarter-circle-back punch: three directions then a button.
 * `6 + P` is forward AND punch at once. `> >` is a double tap. `H6` is a hold.
 * Directions are stored as NUMPAD, because numpad is already relative to the
 * way a fighter faces — which is the whole point: 6 means TOWARD THE OPPONENT
 * for both players, so a command list cannot make P2 attack backwards.
 */
const ARROW_TO_NUMPAD = { '>': 6, '<': 4, '^': 8, 'v': 2 };

export function parseCommand(text) {
  const steps = [];
  for (const chunk of text.trim().split(/\s*\n\s*|\s{2,}/).join(' ').split(/\s+/).join(' ').split(' ')) {
    if (!chunk) continue;
    steps.push(chunk);
  }
  // Re-join around `+` so `6 + P` is ONE simultaneous step.
  const merged = [];
  for (let i = 0; i < steps.length; i++) {
    if (steps[i] === '+') {
      const prev = merged.pop();
      const next = steps[++i];
      merged.push(`${prev}+${next}`);
    } else merged.push(steps[i]);
  }

  return merged.map((token) => {
    const parts = token.split('+');
    const dirs = [];
    const buttons = [];
    let hold = false;
    for (const part of parts) {
      let p = part;
      if (/^H/i.test(p) && p.length > 1) { hold = true; p = p.slice(1); }
      if (/^[1-9]$/.test(p)) dirs.push(Number(p));
      else if (p in ARROW_TO_NUMPAD) dirs.push(ARROW_TO_NUMPAD[p]);
      else if (/^[PKT]$/i.test(p)) buttons.push(p.toUpperCase());
      else if (p) buttons.push(p.toUpperCase()); // keep anything unrecognised rather than dropping it
    }
    return { dirs, buttons, hold };
  });
}

function parseMovesFile(text, stats) {
  const moves = [];
  let move = null;
  let block = null;
  const lines = text.split(/\r?\n/);

  const finish = () => { if (move) moves.push(move); move = null; };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith('#')) {
      const body = line.slice(1).trim();
      if (!body) continue; // a bare `#` is a comment separator
      const [tagRaw, ...rest] = body.split(/\s+/);
      const tag = tagRaw.toUpperCase();
      const value = rest.join(' ').trim();

      // INSIDE A BLOCK, A `#` LINE IS BLOCK CONTENT, NOT A MOVE DIRECTIVE.
      // The #BULLET block carries LOWERCASE sub-directives (#mesh, #range,
      // #velocity, #hitbox_radius) and this parser upper-cases the tag, so
      // without this guard `#range` was read as the move's own #RANGE with an
      // empty value and overwrote it with [0, NaN] — measured on 4 moves
      // (Megiddo, PhotonBurst, PhotonWave, SlowPhotonWave), which is exactly
      // what JSON.stringify then wrote out as `null`.
      if (block) {
        if (tag === `${block}_END` || tag === 'END') { block = null; continue; }
        (move.unknown[block] ??= []).push(line);
        continue;
      }

      if (tag === 'MOVE') {
        finish();
        // A leading `!` is a flag on the name, not part of it.
        const flagged = /^!\s+/.test(value);
        move = {
          name: flagged ? value.replace(/^!\s+/, '') : value,
          hidden: flagged,
          flags: [], input: [], rawInput: '', followups: [], cancelInto: [],
          hitboxes: [], movement: [], unknown: {},
        };
        continue;
      }
      if (!move) continue;

      if (BLOCKS.has(tag)) { block = tag; if (tag === 'INPUT' && value) move.rawInput = value; continue; }
      if (FLAGS.has(tag)) { move.flags.push(tag); continue; }

      switch (tag) {
        case 'DISPLAY_NAME': move.displayName = value; break;
        case 'ANIMATION': move.animation = value; break;
        case 'ANIMATION_RIGHTSIDE': move.animationRightSide = value; break;
        case 'RANGE': { const [a, b] = value.split(/\s+/).map(Number); move.range = [a, b]; break; }
        case 'FRAMES': { const [a, b] = value.split(/\s+/).map(Number); move.frames = [a, b]; break; }
        case 'STANCE': move.stance = value; break;
        case 'NEWSTANCE': case 'NEW_STANCE': move.newStance = value; break;
        case 'DELAY_AFTER_MOVE_MS': move.delayAfterMs = Number(value); break;
        case 'INVINCIBILITY_FRAMES': { const [a, b] = value.split(/\s+/).map(Number); move.invincible = [a, b]; break; }
        default:
          stats.unknownTags.set(tag, (stats.unknownTags.get(tag) ?? 0) + 1);
          move.unknown[tag] = value;
      }
      continue;
    }

    if (!move || !block) continue;

    switch (block) {
      case 'INPUT': move.rawInput = move.rawInput ? `${move.rawInput} ${line}` : line; break;
      case 'FOLLOWUP': case 'CANCEL_INTO': {
        const [target, a, b] = line.split(/\s+/);
        const entry = { move: target, window: [Number(a), Number(b)] };
        (block === 'FOLLOWUP' ? move.followups : move.cancelInto).push(entry);
        break;
      }
      case 'HITBOX': {
        const parts = line.split(/\s+/).filter(Boolean);
        // A leading `!` is a flag token, exactly as on a move name.
        const optional = parts[0] === '!';
        const f = optional ? parts.slice(1) : parts;
        if (f.length < 8) { stats.badHitboxes.push(line); break; }
        move.hitboxes.push({
          bone: f[0], start: Number(f[1]), end: Number(f[2]), damage: Number(f[3]),
          hitClass: f[4], param: Number(f[5]), reaction: f[6], height: f[7],
          optional,
        });
        break;
      }
      case 'MOVEMENT': {
        // `>` IS THE INTERPOLATION FLAG, NOT A BULLET.
        //
        // This read it as optional decoration and threw it away. Read from the
        // engine's own parser (FK_MoveFileParser.cpp, the `if (interpolate)`
        // branch), `>` means the numbers are a TOTAL to spread evenly over the
        // frames since the previous entry:
        //
        //     interpolationDuration = frame - lastMoveFrame
        //     each frame in between gets value / interpolationDuration
        //
        // A line WITHOUT it sets one frame and leaves the rest of the move's
        // per-frame array at zero — an impulse, not a travel.
        //
        // MEASURED over the source: 165 of 169 movement lines carry `>`. So
        // dropping the flag turned almost every authored travel into a
        // single-frame teleport, which is what a consumer of this data would
        // have produced.
        //
        // AXIS ORDER is (parallel, side, vertical) — FK_Move::setMovementAtFrame
        // builds vector3df(movementPar, movementSide, movementVert), and
        // FK_Character zeroes `.Z` on ground contact, which is what pins the
        // third component as the VERTICAL one. Carried through unchanged here;
        // mapping it onto this engine's axes is the consumer's job.
        const parts = line.split(/\s+/).filter(Boolean);
        const interpolate = parts[0] === '>';
        const f = interpolate ? parts.slice(1) : parts;
        if (f.length < 4 || f.some((v) => !Number.isFinite(Number(v)))) { stats.badMovement.push(line); break; }
        move.movement.push({
          frame: Number(f[0]), x: Number(f[1]), y: Number(f[2]), z: Number(f[3]), interpolate,
        });
        break;
      }
      default:
        (move.unknown[block] ??= []).push(line);
    }
  }
  finish();

  for (const m of moves) {
    m.input = m.rawInput ? parseCommand(m.rawInput) : [];
  }
  return moves;
}

/**
 * Check every followup / cancel target against the moves that exist.
 *
 * MEASURED: the source data has genuine typos. `chara_tutor` links to
 * `Crouching_Kick` where the move is named `CrouchingKick` — the underscore
 * spelling is never defined. A dangling link is a DEAD COMBO STRING: the move
 * exists, the route into it does not.
 *
 * Only an EXACT match after stripping underscores is repaired, and every repair
 * is reported by name. Anything still dangling is reported and left in place
 * rather than deleted, so no authored content disappears on import.
 */
function resolveLinks(graph, stats) {
  for (const [char, moves] of Object.entries(graph)) {
    const byName = new Map(moves.map((m) => [m.name, m]));
    for (const m of graph.common ?? []) if (!byName.has(m.name)) byName.set(m.name, m);
    const byLoose = new Map();
    for (const name of byName.keys()) {
      const loose = name.replace(/_/g, '').toLowerCase();
      if (!byLoose.has(loose)) byLoose.set(loose, name);
    }

    for (const move of moves) {
      for (const link of [...move.followups, ...move.cancelInto]) {
        // A `*` target is a WILDCARD CLASS, not a move name. Measured, the only
        // one used is `*ALL_DAMAGING_ROOT_MOVES` on the six step/cancel moves —
        // which is how a sidestep or backstep cancels into anything that hits.
        // Treating it as a dangling name would have thrown away the most
        // general cancel route in the whole corpus.
        if (link.move.startsWith('*')) { link.wildcard = link.move.slice(1); continue; }
        if (byName.has(link.move)) continue;
        const loose = link.move.replace(/_/g, '').toLowerCase();
        const resolved = byLoose.get(loose);
        if (resolved) {
          stats.normalised.push(`${char}/${move.name} -> ${link.move} = ${resolved}`);
          link.move = resolved;
        } else {
          stats.dangling.push(`${char}/${move.name} -> ${link.move}`);
        }
      }
    }
  }
}

async function main() {
  const dir = sourceCandidates().find((p) => existsSync(p));
  if (!dir) {
    const message = '[sb-moves] no SchwarzerblitzEngine checkout found';
    if (existsSync(OUTPUT)) { console.warn(`${message}; keeping the existing graph`); return; }
    console.warn(`${message}; writing an empty graph`);
    await write({}, '(none)', { unknownTags: new Map(), badHitboxes: [], badMovement: [], dangling: [], normalised: [] });
    return;
  }

  const stats = { unknownTags: new Map(), badHitboxes: [], badMovement: [], dangling: [], normalised: [] };
  const graph = {};
  for (const entry of readdirSync(dir)) {
    const file = join(dir, entry, 'moves.txt');
    if (!existsSync(file)) continue;
    graph[entry] = parseMovesFile(readFileSync(file, 'utf8'), stats);
  }

  resolveLinks(graph, stats);
  await write(graph, dir, stats);
}

async function write(graph, source, stats) {
  const serialized = JSON.stringify(graph);
  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(
    OUTPUT,
    `/** GENERATED FILE — do not hand edit. Source: SchwarzerblitzEngine ${REL}/<char>/moves.txt. */\n` +
    `/** Owner-granted; see src/engine/retarget/AnimationSourceRegistry.ts. */\n` +
    `/** Regenerate with: node scripts/sync-schwarzerblitz-moves.mjs */\n\n` +
    `/** One step of a command. \`dirs\` are NUMPAD, already relative to facing. */\n` +
    `export interface SbCommandStep { dirs: number[]; buttons: string[]; hold: boolean }\n` +
    `export interface SbHitbox {\n` +
    `  bone: string; start: number; end: number; damage: number;\n` +
    `  hitClass: string; param: number; reaction: string; height: string; optional: boolean;\n` +
    `}\n` +
    `/** \`wildcard\` names a CLASS of moves (e.g. ALL_DAMAGING_ROOT_MOVES) rather than one move. */\n` +
    `export interface SbLink { move: string; window: [number, number]; wildcard?: string }\n` +
    `export interface SbMove {\n` +
    `  name: string;\n` +
    `  displayName?: string;\n` +
    `  hidden: boolean;\n` +
    `  flags: string[];\n` +
    `  animation?: string;\n` +
    `  animationRightSide?: string;\n` +
    `  range?: [number, number];\n` +
    `  frames?: [number, number];\n` +
    `  stance?: string;\n` +
    `  newStance?: string;\n` +
    `  delayAfterMs?: number;\n` +
    `  invincible?: [number, number];\n` +
    `  rawInput: string;\n` +
    `  input: SbCommandStep[];\n` +
    `  followups: SbLink[];\n` +
    `  cancelInto: SbLink[];\n` +
    `  hitboxes: SbHitbox[];\n` +
    `  /** interpolate spreads x/y/z evenly from the previous entry's frame to this one. */\n  movement: Array<{ frame: number; x: number; y: number; z: number; interpolate: boolean }>;\n` +
    `  /** Directives this import does not model, carried through rather than dropped. */\n` +
    `  unknown: Record<string, string | string[]>;\n` +
    `}\n` +
    `export const SCHWARZERBLITZ_MOVE_GRAPH: Record<string, SbMove[]> = ${serialized};\n`,
    'utf8',
  );

  const sets = Object.entries(graph);
  const total = sets.reduce((a, [, m]) => a + m.length, 0);
  const withInput = sets.reduce((a, [, m]) => a + m.filter((x) => x.input.length).length, 0);
  const withFollow = sets.reduce((a, [, m]) => a + m.filter((x) => x.followups.length).length, 0);
  const withHit = sets.reduce((a, [, m]) => a + m.filter((x) => x.hitboxes.length).length, 0);
  const stances = new Set(sets.flatMap(([, m]) => m.flatMap((x) => [x.stance, x.newStance].filter(Boolean))));

  console.log(`[sb-moves] ${total} moves across ${sets.length} move sets from ${source}`);
  console.log(`[sb-moves] ${withInput} carry a command, ${withFollow} have followup strings, ${withHit} have framed hitboxes`);
  console.log(`[sb-moves] stances: ${[...stances].sort().join(', ')}`);
  console.log(`[sb-moves] cached ${(serialized.length / 1024).toFixed(1)} KB`);
  if (stats.unknownTags.size) {
    const list = [...stats.unknownTags].sort((a, b) => b[1] - a[1]).map(([t, c]) => `${t}(${c})`);
    console.log(`[sb-moves] carried through unmodelled: ${list.join(' ')}`);
  }
  if (stats.normalised.length) {
    console.log(`[sb-moves] ${stats.normalised.length} followup targets differed only by underscores and were matched to the real move: ${stats.normalised.join(', ')}`);
  }
  if (stats.dangling.length) {
    // Kept, not deleted — a dead route is the source's to fix, not ours to hide.
    console.warn(`[sb-moves] ${stats.dangling.length} followup targets name a move that does not exist (dead combo routes, kept as-is): ${stats.dangling.join(', ')}`);
  }
  if (stats.badHitboxes.length) console.warn(`[sb-moves] ${stats.badHitboxes.length} hitbox lines did not parse: ${stats.badHitboxes.slice(0, 3).join(' | ')}`);
  if (stats.badMovement.length) console.warn(`[sb-moves] ${stats.badMovement.length} movement lines did not parse: ${stats.badMovement.slice(0, 3).join(' | ')}`);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`[sb-moves] ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
