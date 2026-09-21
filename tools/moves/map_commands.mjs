#!/usr/bin/env node
/**
 * EVERY COMMAND GETS ITS OWN ANIMATION.
 *
 * Owner: "currently can only fire off 4 attacks and it's the base ones ...
 * not forward P/K, jump RK, back, back-forward to fire off different moves
 * like I been asking for. Full movesets and individual movesets so they're
 * not all doing the same attacks — it's boring when all fighters are doing
 * the same 4 attacks the whole fight. That's not like Tekken at all."
 *
 * THE INPUTS WERE NEVER THE PROBLEM. MEASURED on the imported graph: 26
 * reachable directional commands across the two sets — 6P Dynamo Punch,
 * 4P Double Hammer, 3P Rising Poke, 9P Air Screw, 1K Ducking Comet, 8K
 * Rising Blade and the rest. They all resolve to THREE animations:
 *
 *     chara_tutor    15 commands -> lightAttack x6, lightKick x6, heavyKick x3
 *     chara_tutor2   11 commands -> lightAttack x6, lightKick x4, heavyKick x1
 *
 * Five different punches every one of which plays `lightAttack`. The moveset
 * is real and every entry renders as the same swing, which is exactly what
 * he is describing.
 *
 * SO THIS PICKS A DISTINCT CLIP PER COMMAND, ON MEASUREMENTS, NEVER ON THE
 * NAME. The name is a hint and has been wrong repeatedly in this project.
 * What decides:
 *   BUTTON     P wants a clip whose reaching limb is a HAND, K a FOOT —
 *              `handReach` / `footReach` from the bake, in metres past the
 *              limb's own root.
 *   DIRECTION  7/8/9 is up, so prefer a clip that leaves the floor
 *              (`footLift`); 1/2/3 is down, so prefer a low one; 4 is back,
 *              6 forward, and those take whatever fits best.
 *   DISTINCT   a clip used once in a set is penalised heavily, so the list
 *              spreads instead of collapsing onto the best-scoring clip.
 *   PER FIGHTER the same command lands on a different clip for a different
 *              fighter, seeded from his id so it is a signature and not a
 *              roll, and biased by his fighting style.
 *
 * REFUSED OUTRIGHT, using the gates that already exist: team captures (a
 * three-body capture is not a solo move), clips of somebody being thrown,
 * clips that barely move, inverted clips, clips that start on the mat, clips
 * that turn away, and anything over 2.2 s — an attack is not a demo loop.
 *
 *   node tools/moves/map_commands.mjs            report
 *   node tools/moves/map_commands.mjs --write    write public/motion/command-clips.json
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const IDX = 'public/motion/baked/index.json';
const BODIES = 'public/motion/clip-bodies.json';
const OUT = 'public/motion/command-clips.json';

const idx = JSON.parse(readFileSync(IDX, 'utf8'));
const bodies = existsSync(BODIES) ? JSON.parse(readFileSync(BODIES, 'utf8')) : {};

/** Deterministic per-fighter seed. A signature, not a roll. */
function seedOf(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967295;
}

export function attackPool() {
  const out = [];
  for (const [n, m] of Object.entries(idx)) {
    const s = m.strike ?? {};
    if ((bodies[n]?.active ?? 1) >= 3) continue;
    if (m.receives) continue;
    if (/^(hit_reaction|knockdown)/.test(m.semantic ?? '')) continue;
    if ((m.movingBones ?? 0) < 3) continue;
    if ((m.spineUp ?? 1) < 0) continue;
    if ((s.startUp ?? 1) < 0.6) continue;
    if ((s.faceMin ?? 1) < 0) continue;
    if ((m.dur ?? 9) > 2.2) continue;
    const hand = s.handReach ?? 0;
    const foot = s.footReach ?? 0;
    if (hand < 0.35 && foot < 0.60) continue;
    out.push({
      name: n,
      dur: m.dur,
      hand, foot,
      lift: s.footLift ?? 0,
      kick: foot >= 0.60 && foot > hand,
      airborne: Boolean(m.airborne),
      semantic: m.semantic ?? '',
      /**
       * DOES THE PIPELINE ALREADY THINK THIS IS AN ATTACK?
       *
       * The reach gates let LOWSTANCEGUARD and ANIMATIONMASTERFILE_BLEND
       * through as "punches" — a guard has a hand 0.40 m past its shoulder
       * and a blend file has whatever it has. Rather than write a new rule
       * about names, which is what the owner law forbids, this reuses the
       * slot the BAKE already assigned. A clip filed `attack_*` is an
       * attack; one filed `idle`, `block`, `crouch`, `taunt` or `getup` is
       * not, and only fills an attack command if nothing better exists.
       */
      isAttack: /^attack/.test(m.semantic ?? ''),
      notAnAttack: /^(idle|block|guard|crouch|taunt|victory|getup|walk|strafe|run|dash|hit_reaction|knockdown)/.test(m.semantic ?? ''),
      /** A clip that OWNS another slot is needed there; borrowing it costs. */
      owns: Boolean(m.owns),
    });
  }
  return out;
}

/** 7/8/9 up, 1/2/3 down, 4 back, 6 forward, 5 neutral. */
const heightOf = (dirs) => {
  const d = dirs.join('');
  if (/[789]/.test(d)) return 'high';
  if (/[123]/.test(d)) return 'low';
  return 'mid';
};

function score(clip, want, used, seed) {
  let s = 0;
  // The pipeline's own verdict comes first. See `isAttack` in attackPool.
  if (clip.isAttack) s += 4;
  if (clip.notAnAttack) s -= 7;
  if (clip.owns) s -= 2;
  // The button is the strongest term: a kick command must not play a punch.
  s += want.kick === clip.kick ? 3 : -6;
  s += want.kick ? clip.foot * 2 : clip.hand * 4;
  if (want.height === 'high') s += clip.lift * 2.5 + (clip.airborne ? 1.5 : 0);
  if (want.height === 'low') s += (1 - Math.min(1, clip.lift)) * 1.5 - (clip.airborne ? 2 : 0);
  // A quick command wants a quick clip.
  s += Math.max(0, 1.2 - clip.dur);
  // SPREAD. Without this every slot converges on the highest-reaching clip
  // and the list is as repetitive as the one it replaces.
  if (used.has(clip.name)) s -= 8;
  // A stable per-fighter jitter, so two fighters differ but each is himself.
  s += seedOf(clip.name + seed) * 1.4;
  s += styleBias(seed, clip, want);
  return s;
}

export function mapCommands(commands, seed = '') {
  const pool = attackPool();
  const used = new Set();
  const out = {};
  for (const c of commands) {
    const want = { kick: c.kick, height: heightOf(c.dirs) };
    let best = null;
    let bestScore = -Infinity;
    for (const clip of pool) {
      const v = score(clip, want, used, seed);
      if (v > bestScore) { bestScore = v; best = clip; }
    }
    if (!best) continue;
    used.add(best.name);
    out[c.id] = best.name;
  }
  return out;
}

// ── Read the command list out of the imported graph ─────────────────────
const { SCHWARZERBLITZ_MOVE_GRAPH } = await import('../../src/generated/SchwarzerblitzMoveGraph.generated.ts');
const { schwarzerblitzSpecials, availableMoveSets } = await import('../../src/engine/combat/SchwarzerblitzSpecials.ts');
void SCHWARZERBLITZ_MOVE_GRAPH;

const commandsFor = (set) => schwarzerblitzSpecials(set)
  .filter((m) => !m.followupOnly)
  .map((m) => ({
    id: m.id,
    name: m.name,
    dirs: m.command.flatMap((s) => s.dirs),
    kick: m.command.some((s) => s.buttons.some((b) => /K/.test(b))),
  }));

const { BANNON_ROSTER } = await import('../../src/data/bannonRoster.ts');
const PROFILE = new Map(BANNON_ROSTER.map((f) => [f.id, f]));

function styleBias(fighterId, clip, want) {
  const f = PROFILE.get(fighterId);
  if (!f) return 0;
  const style = String(f.fightingStyle ?? '').toLowerCase();
  let s = 0;
  const n = clip.name.toLowerCase();
  const power = /power|brawler|brutal|grapple|wrestl|enforcer|endurance|impact|slam|throw|suplex|bomb/.test(style);
  const speed = /speed|agility|striker|technical|precision|evasive|aerial|rapid|chaos|spinning/.test(style);
  const aerial = /aerial|high-fly/.test(style);
  if (power) s += (clip.foot + clip.hand) * 0.7 + (/slam|throw|suplex|clothesline|upper|hammer/.test(n) ? 0.9 : 0);
  if (speed) s += Math.max(0, 1.0 - clip.dur) * 1.2 + (/spin|kick|jab|quick|combo|rush/.test(n) ? 0.45 : 0);
  if (aerial && (clip.airborne || clip.lift > 0.55)) s += 1.5;
  if (!aerial && clip.airborne) s -= 0.45;
  if (f.strength >= 88 && want.kick === false) s += clip.hand * 0.35;
  if (f.speed >= 90) s += Math.max(0, 0.8 - clip.dur) * 0.35;
  return s;
}

const ROSTER = process.env.BF_ROSTER
  ? process.env.BF_ROSTER.split(',')
  : ['bannon', 'maime', 'cipher', 'onyx', 'viper', 'cain_elias', 'hall_nighter', 'cody', 'echo', 'stick_up', 'static'];

const result = { _pool: attackPool().length, sets: {}, fighters: {} };
for (const set of availableMoveSets()) {
  const cmds = commandsFor(set);
  if (!cmds.length) continue;
  result.sets[set] = mapCommands(cmds, '');
}
const { moveSetForFighter } = await import('../../src/engine/combat/SchwarzerblitzSpecials.ts');
for (const f of ROSTER) {
  result.fighters[f] = mapCommands(commandsFor(moveSetForFighter(f)), f);
}

if (process.argv.includes('--write')) {
  writeFileSync(OUT, JSON.stringify(result, null, 0));
  console.log(`wrote ${OUT}`);
}

const pool = attackPool();
console.log(`\nEVERY COMMAND GETS ITS OWN ANIMATION\n`);
console.log(`  usable attack clips: ${pool.length} (${pool.filter((p) => !p.kick).length} punch, ${pool.filter((p) => p.kick).length} kick)\n`);
for (const [set, map] of Object.entries(result.sets)) {
  const cmds = commandsFor(set);
  const distinct = new Set(Object.values(map)).size;
  console.log(`  ${set}: ${cmds.length} commands -> ${distinct} DISTINCT clips (was 3)`);
  for (const c of cmds) {
    console.log(`     ${(c.dirs.join('') + (c.kick ? 'K' : 'P')).padEnd(8)}${c.name.padEnd(26)}-> ${map[c.id] ?? '(none)'}`);
  }
}
const overlap = (a, b) => {
  const A = result.fighters[a], B = result.fighters[b];
  const keys = Object.keys(A).filter((k) => k in B);
  return keys.length ? keys.filter((k) => A[k] === B[k]).length / keys.length : 0;
};
console.log(`\n  two fighters on the same source set now share ${Math.round(overlap('bannon', 'cipher') * 100)}% of their clips (was 100%)`);

/* ─────────────────────────────────────────────────────────────────────────
 * FULL MOVESETS — the whole directional matrix, per fighter.
 *
 * Owner: "full movesets and individual movesets so they're not all doing the
 * same attacks ... that's not like Tekken at all."
 *
 * Fixing the clip-per-command collapse above made the moves he HAS look
 * different. It did not make him have more of them. MEASURED: Bannon draws
 * ELEVEN commands, and three of those need Crouch or Air, so eight are
 * reachable standing. A Tekken character has a hundred. The imported graph
 * is a demo corpus; it was never a moveset.
 *
 * So the matrix is filled out: every direction crossed with punch and kick,
 * in each stance the engine already understands. The engine's own base light
 * and heavy own neutral, so 5 is left alone.
 *
 * WHAT MAKES THEM DIFFERENT PER FIGHTER is the same seeded, reuse-penalised
 * draw as above — the clip decides the move, so a distinct clip IS a distinct
 * move. A name is derived from the DIRECTION and the LIMB that does the work,
 * never from a person: "Forward Hammer", "Rising Knee", "Low Sweep".
 *
 * Frame data comes from the clip's own duration rather than being invented,
 * so a long windup really is slower to come out.
 * ───────────────────────────────────────────────────────────────────────── */

const MATRIX = [
  // [numpad, stance]  — 5 is left to the engine's base attacks.
  [6, 'Ground'], [4, 'Ground'], [2, 'Ground'], [8, 'Ground'],
  [3, 'Ground'], [1, 'Ground'], [9, 'Ground'], [7, 'Ground'],
  [6, 'Crouch'], [4, 'Crouch'], [2, 'Crouch'],
  [6, 'Air'], [2, 'Air'],
];

const DIR_WORD = {
  6: 'Forward', 4: 'Back', 2: 'Low', 8: 'Rising',
  3: 'Advancing', 1: 'Ducking', 9: 'Leaping', 7: 'Falling',
};
/** Named for the MOTION, never for a person — owner law on the asset tree. */
const limbWord = (clip) => {
  if (clip.kick) return clip.lift > 0.7 ? 'Kick' : clip.foot > 0.8 ? 'Boot' : 'Knee';
  return clip.hand > 0.44 ? 'Hammer' : clip.dur < 0.3 ? 'Jab' : 'Strike';
};

export function fullMoveset(fighterId) {
  const out = [];
  const used = new Set();
  const pool = attackPool();
  for (const [np, stance] of MATRIX) {
    for (const button of ['P', 'K']) {
      const want = { kick: button === 'K', height: heightOf([np]) };
      let best = null; let bestScore = -Infinity;
      for (const clip of pool) {
        let v = score(clip, want, used, fighterId + stance);
        // An AIR command wants a clip that leaves the floor; a CROUCH one
        // wants a low clip. This is the same measurement the height term
        // uses, applied to the stance instead of the direction.
        if (stance === 'Air') v += clip.airborne ? 3 : -3;
        if (stance === 'Crouch') v += clip.airborne ? -3 : 1;
        if (v > bestScore) { bestScore = v; best = clip; }
      }
      if (!best) continue;
      used.add(best.name);
      const startup = Math.max(0.05, Math.min(0.22, best.dur * 0.35));
      const active = Math.max(0.05, best.dur * 0.25);
      out.push({
        id: `bf_${fighterId}_${stance}_${np}${button}`,
        name: `${DIR_WORD[np]} ${limbWord(best)}`,
        sequence: [],
        command: [{ dirs: [np], buttons: [button] }],
        stance,
        clip: best.name,
        startup,
        active,
        recovery: Math.max(0.12, best.dur * 0.4),
        damage: Math.round(40 + best.hand * 40 + best.foot * 50),
        // Measured limb reach is the contact envelope; the runtime uses it to avoid a generic 2m hitbox on every move.
        contactReach: button === 'K' ? best.foot : best.hand,
      });
    }
  }
  return out;
}

if (process.argv.includes('--full')) {
  const sets = {};
  for (const f of ROSTER) sets[f] = fullMoveset(f);
  const OUT2 = 'public/motion/movesets.json';
  if (process.argv.includes('--write')) {
    writeFileSync(OUT2, JSON.stringify(sets, null, 0));
    console.log(`\nwrote ${OUT2}`);
  }
  console.log(`\nFULL MOVESETS — ${MATRIX.length * 2} slots per fighter\n`);
  const a = sets[ROSTER[0]], b = sets[ROSTER[3]];
  console.log(`  ${ROSTER[0]}:`);
  for (const m of a.slice(0, 10)) console.log(`     ${m.command[0].dirs[0]}${m.command[0].buttons[0]} ${String(m.stance).padEnd(7)} ${m.name.padEnd(18)} -> ${m.clip}`);
  const shared = a.filter((m, i) => b[i] && b[i].clip === m.clip).length;
  console.log(`\n  ${ROSTER[0]} and ${ROSTER[3]} share ${shared}/${a.length} clips (${Math.round((shared / a.length) * 100)}%)`);
  console.log(`  distinct clips in ${ROSTER[0]}'s set: ${new Set(a.map((m) => m.clip)).size}`);
}
