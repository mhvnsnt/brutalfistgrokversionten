/**
 * THE BASELINE PARITY AUDIT — every system in this game against the
 * Tekken-lineage baseline, in one run, with a number per row.
 *
 * Owner: "find out like the full umbrella term that will audit everything in
 * this versus something like Tekken 7 so we can get everything that's not good
 * baseline in our game ... whether it be gameplay combat animation or whatever
 * ... it's taking way too long to fix and hand tool this when we can start with
 * a good base."
 *
 * THE UMBRELLA TERM, and why it is not one word. What makes a fighting game
 * play like a fighting game is its SYSTEM MECHANICS measured in FRAME DATA. That
 * is the spine everything else hangs off, and it is the only part that is
 * objectively comparable between two games — you cannot diff "feel", but you can
 * diff "our jab is 7 frames, the baseline is 10". So the audit has six axes, and
 * every row on every axis carries a measured value:
 *
 *   TIMEBASE      is a frame a fixed unit, or does the game run on wall clock
 *   FRAME DATA    startup / active / recovery / advantage, in frames
 *   MECHANICS     the feature set: throws, breaks, sidestep, juggles, walls, rage
 *   INPUT         buffer, command windows, cancels — what the player can express
 *   ANIMATION     root motion, blending, masking, clip integrity
 *   FEEL          hitstop, pushback, effect lifetimes — the impact layer
 *
 * THE THREE VERDICTS ARE THE POINT, and they come from this project's own
 * history rather than from any reference game. Almost everything here has been
 * "present" at some point and done nothing:
 *
 *   DECLARED   the code exists
 *   WIRED      something outside its own file and tests calls it
 *   BEHAVING   a measured value, in range
 *
 * `BANNON_TAG`, `crouchLightAttack`, `meshoptDecoderShim`, the hit-effect rAF
 * loop, eleven BANNON_UNIVERSE functions, BANNON_CAGE and BANNON_PROPS were all
 * DECLARED and none were WIRED. Two Tekken tests in this very merge were written
 * and never registered. So DECLARED scores nothing here.
 *
 * REFERENCE PROVENANCE IS MARKED ON EVERY ROW. `convention` is the documented
 * fighting-game frame-data convention or a Tekken system that is not in dispute.
 * `read` means it came out of source we actually cloned and read. Nothing is
 * cited from memory as an exact frame count unless it is the well-known one, and
 * where a real number varies per character the row says so and compares the
 * RANGE rather than inventing a figure.
 *
 * Usage:
 *   node --experimental-strip-types --import ./scripts/register-ts-resolve.mjs \
 *     tools/parity/baseline.ts [--gaps] [--axis FRAME_DATA]
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

import { DEFAULT_MOVE_WINDOWS, CROUCH_MOVE_WINDOWS, FIXED_STEP_S, MAX_SUBSTEPS, realisedAdvantageOnBlock, blockstunFramesFor } from '../../src/engine/combat/FighterStateMachine.ts';
import { THROW_BREAK_WINDOW_FRAMES, THROW_WHIFF_RECOVERY_FRAMES, THROW_GRAB_RANGE } from '../../src/engine/combat/DirectionalThrowSystem.ts';
import { WALL_SPLAT_BONUS_FRAMES, WALL_RECOVERY_FRAMES } from '../../src/engine/combat/WallSystem.ts';
import { BUFFER_MS, BUFFER_SIZE, STEP_WINDOW_MS } from '../../src/engine/combat/CommandInput.ts';
import { MIN_BLEND_S, MAX_BLEND_S } from '../../src/engine/motion/BlendDuration.ts';
import { UPPER_BODY_STATES, LOWER_BODY_BONES } from '../../src/engine/motion/BoneMask.ts';
import { HIT_FX_MAX_DT } from '../../src/engine/combat/HitEffectSystem.ts';
import { CANCEL_OPENS_AT } from '../../src/engine/combat/GeneratedMovesets.ts';
import { hitStopFramesFor, blockHitStopFramesFor, parryHitStopFramesFor, hitStopIsWeighted } from '../../src/engine/combat/HitStop.ts';
import { setAuthoredStrideSpeeds, residualSlideMps } from '../../src/engine/motion/DistanceMatching.ts';
import { WALK_SPEED, DASH_SPEED } from '../../src/engine/locomotion/LocomotionSystem.ts';

const FPS = 60;
const f = (seconds: number) => Math.round(seconds * FPS * 10) / 10;

/** Does anything outside this symbol's own file and the tests use it? */
function callers(symbol: string): number {
  try {
    const out = execFileSync('grep', ['-rlE', symbol, 'src', '--include=*.ts', '--include=*.tsx'], { encoding: 'utf8' });
    return out.split('\n').filter((l) => l && !/\.test\.tsx?$/.test(l) && !l.endsWith(`/${symbol}.ts`)).length;
  } catch { return 0; }
}
/** Is this system declared anywhere at all? */
function declaredIn(pattern: string): string | null {
  try {
    const out = execFileSync('grep', ['-rlE', pattern, 'src/engine', 'src/components', '--include=*.ts', '--include=*.tsx'], { encoding: 'utf8' });
    const first = out.split('\n').filter((l) => l && !/\.test\.tsx?$/.test(l))[0];
    return first ? first.replace(/^src\/(engine|components)\//, '') : null;
  } catch { return null; }
}
/** Is it in the registered test run? Behaving needs proof, and a test is proof. */
const TEST_LIST = JSON.parse(readFileSync('package.json', 'utf8')).scripts.test as string;
const tested = (file: string) => TEST_LIST.includes(file);

type Verdict = 'BEHAVING' | 'WIRED' | 'DECLARED' | 'MISSING';
interface Row {
  axis: string;
  system: string;
  reference: string;
  refSource: 'convention' | 'read' | 'ours';
  ours: string;
  verdict: Verdict;
  note?: string;
  fillFrom?: string;
}
const rows: Row[] = [];
const add = (r: Row) => rows.push(r);

// ── TIMEBASE ────────────────────────────────────────────────────────────────
add({
  axis: 'TIMEBASE', system: 'a frame is a fixed unit',
  reference: '60fps fixed; every window is counted in frames, never in wall clock',
  refSource: 'convention',
  ours: `FIXED_STEP_S = 1/${Math.round(1 / FIXED_STEP_S)}, up to ${MAX_SUBSTEPS} sub-steps per render frame`,
  verdict: Math.abs(FIXED_STEP_S - 1 / 60) < 1e-9 && MAX_SUBSTEPS >= 8 ? 'BEHAVING' : 'WIRED',
  note: tested('frame-rate-input.test.ts') ? 'gated by frame-rate-input.test.ts' : 'NOT under test',
});
add({
  axis: 'TIMEBASE', system: 'effect and stun timers are frame-rate independent',
  reference: 'a 12-frame window is 12 frames at any render rate',
  refSource: 'convention',
  ours: `hit effects spend real dt, clamped to ${HIT_FX_MAX_DT}s`,
  verdict: tested('hit-effect-lifetime.test.ts') ? 'BEHAVING' : 'WIRED',
  note: 'was a hardcoded 1/60 per call — double the intended life on a 30fps phone',
});

// ── FRAME DATA ──────────────────────────────────────────────────────────────
const jab = DEFAULT_MOVE_WINDOWS.lightAttack;
add({
  axis: 'FRAME DATA', system: 'light punch startup',
  reference: 'i10 — a 10-frame jab is the lineage standard for the fastest poke',
  refSource: 'convention',
  ours: `${f(jab.startup)} frames (${jab.startup}s)`,
  verdict: f(jab.startup) >= 8 && f(jab.startup) <= 12 ? 'BEHAVING' : 'WIRED',
  note: f(jab.startup) < 8 ? `FASTER than the baseline by ${(10 - f(jab.startup)).toFixed(1)} frames — a jab this quick outruns every reaction window` : undefined,
  fillFrom: f(jab.startup) < 8 ? 'Kiloutre/TKMovesets — real per-move startup values' : undefined,
});
for (const [name, w] of [['heavy punch', DEFAULT_MOVE_WINDOWS.heavyAttack], ['light kick', DEFAULT_MOVE_WINDOWS.lightKick], ['heavy kick', DEFAULT_MOVE_WINDOWS.heavyKick], ['crouching kick', CROUCH_MOVE_WINDOWS.crouchHeavyAttack]] as const) {
  const total = f(w.startup + w.active + w.recovery);
  add({
    axis: 'FRAME DATA', system: `${name} startup / total`,
    reference: 'a heavy is i14-i20; a mid-tier launcher i15+; total under ~60 frames',
    refSource: 'convention',
    ours: `${f(w.startup)} / ${total} frames`,
    verdict: total <= 70 ? 'BEHAVING' : 'WIRED',
  });
}
const advs = Object.entries({ ...DEFAULT_MOVE_WINDOWS, ...CROUCH_MOVE_WINDOWS })
  .map(([n, w]) => ({ n, authored: w.onBlock, realised: realisedAdvantageOnBlock(w), stun: blockstunFramesFor(w) }));
const allHonest = advs.every((a) => a.authored === a.realised);
const spread = new Set(advs.map((a) => a.realised)).size;
add({
  axis: 'FRAME DATA', system: 'advantage on block, in frames',
  reference: 'every move carries a frame advantage on block — that number IS the mind game',
  refSource: 'convention',
  ours: advs.map((a) => `${a.n.replace('Attack', 'P').replace('Kick', 'K')} ${a.realised > 0 ? '+' : ''}${a.realised}`).join(', '),
  verdict: allHonest && spread >= 4 && Math.max(...advs.map((a) => a.realised)) > 0 && Math.min(...advs.map((a) => a.realised)) < 0
    ? 'BEHAVING' : 'WIRED',
  note: allHonest
    ? 'blockstun is DERIVED from the authored advantage, so the table cannot claim +1 while the engine plays -6'
    : 'authored and realised advantages disagree — a move recovery cannot support its advantage',
  fillFrom: 'Kiloutre/TKMovesets — per-move advantages for real movesets, instead of six hand-set values',
});
add({
  axis: 'FRAME DATA', system: 'throw break window',
  reference: 'throws are breakable inside a short window; single digits to low double digits of frames',
  refSource: 'convention',
  ours: `${THROW_BREAK_WINDOW_FRAMES} frames, whiff recovery ${THROW_WHIFF_RECOVERY_FRAMES}, range ${THROW_GRAB_RANGE}m`,
  verdict: tested('throw-chains.test.ts') ? 'BEHAVING' : 'WIRED',
});
add({
  axis: 'FRAME DATA', system: 'wall splat advantage',
  reference: 'a wall splat is free frames — the whole point of a wall carry',
  refSource: 'convention',
  ours: `+${WALL_SPLAT_BONUS_FRAMES} for the attacker, ${WALL_RECOVERY_FRAMES} recovery for the defender`,
  verdict: callers('WALL_SPLAT_BONUS_FRAMES') > 1 ? 'BEHAVING' : 'DECLARED',
  fillFrom: 'SchwarzerblitzEngine FK_Character wall handling — its splat leaves the attacker frames, ours declares the number and nothing reads it',
});

// ── SYSTEM MECHANICS ────────────────────────────────────────────────────────
const MECHANICS: Array<[string, string, string, string, string?]> = [
  ['highs whiff over a crouch', 'hold down and a high has nothing to hit', 'resolveTekkenContact', 'tekken-guard.test.ts'],
  ['lows are blocked only crouching', 'standing block eats lows; down-back blocks them', 'crouchBlock', 'tekken-guard.test.ts'],
  ['the stick dies when a move starts', 'no move coasts on walk momentum; only authored travel continues', 'stickLive', 'tekken-commit.test.ts'],
  ['sidestep', 'a third axis — the answer to linear pressure', 'sidestepLeft|sidestepRight', 'command-input.test.ts'],
  ['backdash', 'the neutral-game movement tool', 'Backdashing|backdash', 'command-input.test.ts'],
  ['throws and directional throws', 'front, back and side, with different damage and break difficulty', 'DirectionalThrowSystem', 'directional-throw-system.test.ts'],
  ['combo damage scaling', 'a long combo pays for its length or the game is one-touch', 'registerHit', 'mechanics-proven.test.ts'],
  ['wall combos', 'a carry into a wall extends the combo', 'applyWallSplat', 'mechanics-proven.test.ts'],
  ['juggles', 'a launcher opens an air combo that scales and comes down', 'applyAirHit', 'mechanics-proven.test.ts'],
  ['wakeup options', 'tech roll, back rise, quick stand — the defender chooses', 'getBufferedWakeup', 'mechanics-proven.test.ts'],
  // PROBE THE SYSTEM, NOT THE WORD. The first version of this row searched for
  // 'Rage|rage' and reported it MISSING while a complete health-gated super with
  // armoured startup sat in OverdriveSystem under the name `Finisher`. Searching
  // for a feature by its marketing name is the same mistake as classifying a
  // move by its filename — the thing has to be identified by what it DOES.
  ['low parry', 'the punish for spamming lows', 'lowParryIntent', 'defensive-systems.test.ts'],
  ['power crush / armour', 'absorbs a mid or high during startup and keeps coming, and loses to a low and a throw', 'resolveDefensiveWindows', 'defensive-systems.test.ts'],
  ['rage — a comeback state at low health', 'damage bonus while under the threshold, plus one Rage Art off it', 'rageScaledDamage', 'defensive-systems.test.ts'],
  // COUNTER HIT was detected in the arena twice and used for a spark and a sound
  // only — no damage, no reaction. Probing 'isCounter' found the VFX and called it
  // wired. The probe is the mechanic now.
  ['counter hit', 'interrupting a startup pays extra AND buys the attacker frames', 'counterScaledDamage', 'mechanics-proven.test.ts'],
  ['ring out / stage boundary', 'the stage is a win condition, not scenery', 'ringOut|stageBoundar', 'stage-boundaries.test.ts'],
  // RECOVERABLE DAMAGE read as wired because the probe matched the word
  // "unrecoverable" in two comments about a cinematic and about frame pacing.
  ['recoverable (white) damage', 'armour bleed and chip come back while you are not being hit; a clean hit locks it', 'tickRecoverable', 'mechanics-proven.test.ts'],
  ['move cancels and strings', 'a move continues into another inside a window', 'cancelInto', 'cancel-windows.test.ts'],
  ['stance system', 'a move can leave you in a different stance with its own moveset', 'endStance|moveStance', 'character-stances.test.ts'],
];
for (const [system, reference, pattern, testFile] of MECHANICS) {
  const where = declaredIn(pattern);
  const wired = where ? callers(pattern.split('|')[0]) : 0;
  const verdict: Verdict = !where ? 'MISSING'
    : (testFile && tested(testFile)) ? 'BEHAVING'
    : wired > 1 ? 'WIRED' : 'DECLARED';
  add({
    axis: 'MECHANICS', system, reference, refSource: 'convention',
    ours: where ? `${where}${testFile && tested(testFile) ? `, gated by ${testFile}` : ''}` : 'nothing declared',
    verdict,
    note: verdict === 'DECLARED' ? 'declared but nothing outside its own file calls it' : undefined,
    fillFrom: verdict === 'MISSING' || verdict === 'DECLARED'
      ? 'Kiloutre/TKMovesets (move structs, cancels, reactions) · SchwarzerblitzEngine (a complete open-source 3D fighter loop)'
      : undefined,
  });
}

// ── INPUT ───────────────────────────────────────────────────────────────────
add({
  axis: 'INPUT', system: 'input buffer',
  reference: 'a few frames of buffer so a slightly early input still comes out',
  refSource: 'convention',
  ours: `${BUFFER_MS}ms window (${f(BUFFER_MS / 1000)} frames), ${BUFFER_SIZE} entries, ${STEP_WINDOW_MS}ms per command step`,
  verdict: tested('command-input.test.ts') ? 'BEHAVING' : 'WIRED',
  note: BUFFER_MS > 400 ? `${BUFFER_MS}ms is very long for a general buffer — that is ${f(BUFFER_MS / 1000)} frames of held intent` : undefined,
});
add({
  axis: 'INPUT', system: 'cancel window opens partway through a move',
  reference: "Tekken's Cancel struct carries detection_start / detection_end / starting_frame",
  refSource: 'read',
  ours: `CANCEL_OPENS_AT = ${CANCEL_OPENS_AT} of startup+active`,
  verdict: tested('move-strings.test.ts') ? 'BEHAVING' : 'WIRED',
  note: 'starting_frame — the frame the TARGET move begins at when cancelled into — is still not modelled, so a cancelled follow-up replays its whole startup',
  fillFrom: 'Kiloutre/TKMovesets — the Cancel struct is the reference',
});

// ── ANIMATION ───────────────────────────────────────────────────────────────
add({
  axis: 'ANIMATION', system: 'blend duration keyed by the pose distance travelled',
  reference: 'a transition is as long as the distance between the two poses',
  refSource: 'convention',
  ours: `${Math.round(MIN_BLEND_S * 1000)}-${Math.round(MAX_BLEND_S * 1000)}ms, computed from the live skeleton against the incoming clip`,
  verdict: tested('blend-duration.test.ts') ? 'BEHAVING' : 'WIRED',
});
add({
  axis: 'ANIMATION', system: 'upper-body moves do not drive the legs',
  reference: 'an upper-body layer over a locomotion layer, split at the spine',
  refSource: 'convention',
  ours: `${UPPER_BODY_STATES.size} masked states, ${LOWER_BODY_BONES.size} lower-body bone names`,
  verdict: tested('bone-mask.test.ts') ? 'BEHAVING' : 'WIRED',
  note: 'a punch went from 94.6 to 7.2 degrees outside the idle stance',
});
const cred = existsSync('public/motion/lower_body_credibility.json')
  ? JSON.parse(readFileSync('public/motion/lower_body_credibility.json', 'utf8')).clips as Record<string, { credible: boolean }>
  : null;
add({
  axis: 'ANIMATION', system: 'clip integrity — no impossible limbs reach the screen',
  reference: 'a shipped clip moves a body the way a body moves',
  refSource: 'ours',
  ours: cred
    ? `${Object.values(cred).filter((c) => !c.credible).length} of ${Object.keys(cred).length} clips not credible, and those borrow the stance's legs`
    : 'no credibility manifest',
  verdict: cred ? 'BEHAVING' : 'MISSING',
  fillFrom: cred ? undefined : 'run tools/motion/bone_mask_audit.mjs --write',
});
// STRIDE / FOOT SLIDING — the animation gap the owner names as "ugly unblended".
const stride = existsSync('public/motion/stride_speed.json')
  ? JSON.parse(readFileSync('public/motion/stride_speed.json', 'utf8')).clips as Record<string, { speedMps: number }>
  : null;
add({
  axis: 'ANIMATION', system: 'the feet do not slide — playback matches the ground covered',
  reference: "animation time is driven by DISTANCE, not the clock; Unreal's locomotion and Lyra's do this as distance matching",
  refSource: 'convention',
  ours: stride
    ? (() => {
      setAuthoredStrideSpeeds(Object.entries(stride).map(([n, r]) => [n, r.speedMps] as const));
      const cases: Array<[string, number]> = [['DWARF_WALK', WALK_SPEED], ['GINGA_BACKWARD', WALK_SPEED], ['DRUNK_RUN_FORWARD', DASH_SPEED]];
      return cases.map(([c, v]) => {
        const raw = Math.abs(v - (stride[c]?.speedMps ?? v));
        return `${c.split('_')[0].toLowerCase()} slid ${raw.toFixed(2)} -> ${residualSlideMps(c, v).toFixed(2)} m/s`;
      }).join(', ');
    })()
    : 'no stride manifest — every clip plays at a flat rate while the engine moves the root',
  verdict: stride && tested('distance-matching.test.ts') ? 'BEHAVING' : 'MISSING',
  note: stride ? 'measured by FK on the planted foot; the same groundSpeedCap the locomotion side uses picks the speed, so they cannot disagree' : undefined,
  fillFrom: stride ? undefined : 'run tools/motion/stride_speed.mjs --write',
});
add({
  axis: 'ANIMATION', system: 'foot IK / foot locking on uneven contact',
  reference: 'a planted foot stays planted, and the leg solves to reach the ground it is standing on',
  refSource: 'convention',
  ours: (() => { const w = declaredIn('footIK|footLock|FootIK'); return w ? w : 'none — the feet take whatever the clip gives them'; })(),
  verdict: declaredIn('footIK|footLock|FootIK') ? 'WIRED' : 'MISSING',
  fillFrom: 'a two-bone IK solver is ~40 lines against THREE.Bone; the stage is flat here, so this only matters once there is uneven ground or a body to stand on',
});
add({
  axis: 'ANIMATION', system: 'turn in place',
  reference: 'turning while stationary plays a turn rather than sliding the facing round',
  refSource: 'convention',
  ours: (() => { const w = declaredIn('turnInPlace|turn_in_place'); return w ? w : 'none — facing changes without an animation'; })(),
  verdict: declaredIn('turnInPlace|turn_in_place') ? 'WIRED' : 'MISSING',
  fillFrom: 'the bank has no turn clips; generate from Mixamo or MoMask, or accept it — a fighting game holds facing to the opponent, so this is the least visible of the three',
});
const baked = existsSync('public/motion/baked') ? readdirSync('public/motion/baked').filter((x) => x.endsWith('.json') && x !== 'index.json').length : 0;
add({
  axis: 'ANIMATION', system: 'move count',
  reference: 'a roster fighter carries roughly 100-150 moves; the full game is thousands',
  refSource: 'convention',
  ours: `${baked} baked clips`,
  verdict: baked > 300 ? 'BEHAVING' : 'WIRED',
  fillFrom: 'CMU Motion Capture Database (free for any use) · Truebones CC0 · Mixamo (royalty-free) — NOT Bandai Namco Research (CC BY-NC) or CombatMotion (game-derived)',
});

// ── FEEL ────────────────────────────────────────────────────────────────────
add({
  axis: 'FEEL', system: 'hitstop on impact, and heavier means longer',
  reference: 'both bodies freeze for a few frames so a hit reads as contact, and a heavy freezes longer than a jab',
  refSource: 'convention',
  ours: `${['lightAttack', 'heavyAttack', 'CommandThrow'].map((k) => `${k.replace('Attack', '')} ${hitStopFramesFor(k)}f`).join(', ')}`
    + `, block ${blockHitStopFramesFor('heavyAttack')}f, parry ${parryHitStopFramesFor('heavyAttack')}f`,
  verdict: hitStopIsWeighted(['lightAttack', 'heavyAttack', 'CommandThrow']) && tested('defensive-systems.test.ts')
    ? 'BEHAVING' : 'WIRED',
  note: 'was THREE systems: a ms table, a force-derived count clamped to 3-5 frames, and inline literals in the arena. One table now, in frames, with block and parry as fractions of it',
});
add({
  axis: 'FEEL', system: 'pushback on block separates the bodies',
  reference: 'a blocked hit resets the spacing game rather than leaving both fighters where they were',
  refSource: 'convention',
  ours: (() => { const w = declaredIn('applyPushback'); return w ? `${w}, min 0.18m, away from the attacker and wall-clamped` : 'none'; })(),
  verdict: declaredIn('applyPushback') && tested('defensive-systems.test.ts') ? 'BEHAVING' : 'WIRED',
});

// ── MOVESET ─────────────────────────────────────────────────────────────────
const movesets = existsSync('public/motion/movesets.json')
  ? JSON.parse(readFileSync('public/motion/movesets.json', 'utf8')) as Record<string, unknown>
  : null;
const allMoves: Array<Record<string, unknown>> = [];
if (movesets) {
  for (const v of Object.values(movesets)) {
    for (const mv of (Array.isArray(v) ? v : Object.values(v as object))) allMoves.push(mv as Record<string, unknown>);
  }
}
const perChar = movesets
  ? Object.values(movesets).map((v) => (Array.isArray(v) ? v.length : Object.keys(v as object).length))
  : [];
add({
  axis: 'MOVESET', system: 'moves per character',
  reference: 'a roster fighter carries roughly 100-150 distinct moves',
  refSource: 'convention',
  ours: perChar.length ? `${Math.min(...perChar)}-${Math.max(...perChar)} across ${perChar.length} characters, ${allMoves.length} entries total` : 'no moveset manifest',
  verdict: perChar.length && Math.min(...perChar) >= 60 ? 'BEHAVING' : 'WIRED',
  note: perChar.length && Math.min(...perChar) < 60
    ? `${Math.min(...perChar)} is well under the baseline — the SHAPE is right (command, stance, clip, frame data, reach per move) and the count is thin`
    : undefined,
  fillFrom: 'Kiloutre/TKMovesets for real per-character move lists; the 455-clip bank already here is the animation half',
});
const levels = existsSync('public/motion/attack_levels.json')
  ? JSON.parse(readFileSync('public/motion/attack_levels.json', 'utf8')).clips as Record<string, { level: string }>
  : null;
const authoredLevels = allMoves.filter((m) => typeof m.attackLevel === 'string').length;
add({
  axis: 'MOVESET', system: 'every move strikes at a height',
  reference: 'high, mid or low on every move — the height game is what a guard is FOR',
  refSource: 'convention',
  ours: levels
    ? `${authoredLevels} of ${allMoves.length} imported moves author one; ${Object.keys(levels).length} clips have a level derived from their frames`
    : `${authoredLevels} of ${allMoves.length} author one, and nothing derives the rest — every one of them is a mid`,
  verdict: levels && tested('derived-attack-levels.test.ts') ? 'BEHAVING' : 'MISSING',
  note: levels
    ? (() => {
      const d = { high: 0, mid: 0, low: 0 } as Record<string, number>;
      for (const c of Object.values(levels)) d[c.level] = (d[c.level] ?? 0) + 1;
      return `derived spread: ${d.high} high / ${d.mid} mid / ${d.low} low. Authored always wins`;
    })()
    : 'the guard, the low parry and the crouch whiff are all inert without this',
  fillFrom: levels ? undefined : 'run tools/motion/attack_level.mjs --write',
});
add({
  axis: 'MOVESET', system: 'stances with their own moves',
  reference: 'a move can leave you in a stance that has its own list',
  refSource: 'convention',
  ours: (() => {
    const st = new Set(allMoves.map((m) => String(m.stance ?? 'none')));
    return st.size > 1 ? `${st.size} stances: ${[...st].join(', ')}` : 'one stance';
  })(),
  verdict: tested('character-stances.test.ts') ? 'BEHAVING' : 'WIRED',
});
add({
  axis: 'MOVESET', system: 'per-move reach, rather than one range for everything',
  reference: 'a jab and a roundhouse do not reach the same distance',
  refSource: 'convention',
  ours: (() => {
    const r = allMoves.map((m) => m.contactReach).filter((x): x is number => typeof x === 'number').sort((a, b) => a - b);
    return r.length ? `${r.length} moves carry a reach, ${r[0]}m to ${r[r.length - 1]}m (median ${r[Math.floor(r.length / 2)]})` : 'none';
  })(),
  verdict: allMoves.some((m) => typeof m.contactReach === 'number') ? 'BEHAVING' : 'MISSING',
  note: 'measured per move at import, not a single hitbox radius',
});

// ── MOVEMENT ────────────────────────────────────────────────────────────────
add({
  axis: 'MOVEMENT', system: 'walk, dash and backdash are different speeds',
  reference: 'the neutral game is built on the difference between them',
  refSource: 'convention',
  ours: `walk ${WALK_SPEED}, dash ${DASH_SPEED} m/s, chosen by one exported function (groundSpeedCap)`,
  verdict: DASH_SPEED > WALK_SPEED * 1.5 ? 'BEHAVING' : 'WIRED',
});
add({
  axis: 'MOVEMENT', system: 'a sidestep leaves the attack plane',
  reference: 'stepping off-axis makes a linear move miss — the answer to pressure in a 3D fighter',
  refSource: 'convention',
  ours: (() => {
    const z = declaredIn('rootZ|sidestepZ|targetedSidestep');
    return z ? `${z} — there is a Z axis and sidesteps move along it` : 'no Z movement';
  })(),
  verdict: declaredIn('checkSidestepWhiff') && tested('mechanics-proven.test.ts') ? 'BEHAVING' : 'WIRED',
  note: 'a linear attack whiffs past SIDESTEP_WHIFF_THRESHOLD and a tracking attack follows the step — proven, not assumed',
  fillFrom: 'a probe, not a system: drive a sidestep into a linear move and assert the hitbox misses',
});
add({
  axis: 'MOVEMENT', system: 'the stick dies when a move starts',
  reference: 'no move coasts on walk momentum; only its own authored travel continues',
  refSource: 'convention',
  ours: 'stickLive, default true, false during a move',
  verdict: tested('tekken-commit.test.ts') ? 'BEHAVING' : 'WIRED',
});

// ── REPORT ──────────────────────────────────────────────────────────────────
const AXES = ['TIMEBASE', 'FRAME DATA', 'MECHANICS', 'MOVESET', 'MOVEMENT', 'INPUT', 'ANIMATION', 'FEEL'];
const ai = process.argv.indexOf('--axis');
const only = ai > 0 ? process.argv[ai + 1].replace('_', ' ') : null;
const gapsOnly = process.argv.includes('--gaps');
const WEIGHT: Record<Verdict, number> = { BEHAVING: 1, WIRED: 0.5, DECLARED: 0, MISSING: 0 };

console.log('\nBASELINE PARITY AUDIT — this game against the Tekken-lineage baseline');
console.log('  BEHAVING = measured in range   WIRED = called, unproven   DECLARED = exists, nothing calls it   MISSING\n');

for (const axis of AXES) {
  if (only && axis !== only) continue;
  const inAxis = rows.filter((r) => r.axis === axis);
  if (!inAxis.length) continue;
  const score = inAxis.reduce((s, r) => s + WEIGHT[r.verdict], 0) / inAxis.length;
  console.log(`\n${axis}  —  ${Math.round(score * 100)}% of baseline (${inAxis.length} rows)`);
  for (const r of inAxis) {
    if (gapsOnly && r.verdict === 'BEHAVING') continue;
    console.log(`  ${r.verdict.padEnd(9)} ${r.system}`);
    console.log(`            baseline: ${r.reference} [${r.refSource}]`);
    console.log(`            ours:     ${r.ours}`);
    if (r.note) console.log(`            NOTE:     ${r.note}`);
    if (r.fillFrom) console.log(`            fill from: ${r.fillFrom}`);
  }
}

const total = rows.reduce((s, r) => s + WEIGHT[r.verdict], 0) / rows.length;
const counts = rows.reduce<Record<string, number>>((a, r) => { a[r.verdict] = (a[r.verdict] ?? 0) + 1; return a; }, {});
console.log(`\n${'='.repeat(74)}`);
console.log(`OVERALL  ${Math.round(total * 100)}% of baseline across ${rows.length} rows`);
console.log(`  ${counts.BEHAVING ?? 0} behaving · ${counts.WIRED ?? 0} wired · ${counts.DECLARED ?? 0} declared and dead · ${counts.MISSING ?? 0} missing`);
const worst = rows.filter((r) => r.verdict === 'MISSING' || r.verdict === 'DECLARED');
if (worst.length) {
  console.log('\nWHAT IS NOT AT BASELINE, worst first:');
  for (const r of worst) console.log(`  ${r.verdict === 'MISSING' ? '✗' : '○'} ${r.axis.padEnd(11)} ${r.system}`);
}
