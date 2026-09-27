#!/usr/bin/env node
/**
 * A REAL CAPTURE OUTRANKS A SYNTHESISED STAND-IN.
 *
 * SEMANTIC_ALIASES is a preference list per semantic: the first name present in
 * a character's loaded set wins. The synthesised gap-filler clips
 * (BindRelativeMotion) are named after the semantics themselves — `idle`,
 * `attack_1`, `knockdown`, `jump` — so they sort to the FRONT of their own
 * lists and beat every motion capture behind them.
 *
 * MEASURED: 15 of 22 semantics led with the placeholder, among them idle, all
 * five attacks, walk, run, crouch, knockdown and getup. A gap filler poses a
 * stance with a few joints moving; a capture is a performance. The capture
 * should always win.
 *
 * THE ORDER IS DECIDED BY THE BAKE, NOT BY THE NAME (owner law). Each baked
 * clip carries a `semantic` the bake derived from its own frames. A clip is
 * promoted only when ITS OWN tag matches the list it sits in — so a mis-tagged
 * entry like UPPERCUT (the bake calls it `idle`) is left exactly where it is.
 *
 * Conservative on purpose: it REORDERS existing entries and never adds one, so
 * no clip enters a slot it was not already a candidate for.
 *
 *   node tools/moves/order_aliases.mjs           report
 *   node tools/moves/order_aliases.mjs --write   rewrite the alias lists
 *   node tools/moves/order_aliases.mjs --gate    fail if a placeholder leads
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const FILE = 'src/engine/retarget/SemanticStateAliases.ts';
const IDX = 'public/motion/baked/index.json';
/** The clips BindRelativeMotion synthesises; each is named after its semantic. */
const SYNTH = new Set(['idle', 'guard', 'attack_1', 'attack_rp', 'attack_2', 'attack_lk',
  'attack_rk', 'hit_reaction', 'walk_forward', 'walk_back', 'run', 'dash_forward',
  'strafe_left', 'strafe_right', 'knockdown', 'crouch', 'getup', 'jump']);

const idx = JSON.parse(readFileSync(IDX, 'utf8'));
const baked = new Set(readdirSync('public/motion/baked').filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', '')));
let src = readFileSync(FILE, 'utf8');

const LIST_RE = /^(\s{2})([a-z_0-9]+):(\s*)\[([^\]]*)\],$/gm;
const rows = [];
src = src.replace(LIST_RE, (whole, indent, key, gap, body) => {
  const items = body.split(',').map((s) => s.trim()).filter(Boolean);
  const nameOf = (q) => q.replace(/['\s]/g, '');
  // A clip the BAKE itself files under this semantic — AND that can actually
  // stand in for it. Agreement is necessary and not sufficient: the bake files
  // COMBO_PUNCH under `attack_rp` and it runs 2.97s, which is a string, not a
  // button. baked-motion.test.ts already encodes the standing-attack rule and
  // caught this the moment the reorder promoted it; these are its numbers.
  const STANDING_ATTACK_MAX_SECONDS = 1.6;
  const STANDING_ATTACK_SPINE_MIN = 0.85;
  const playable = (n) => {
    if (!/^attack_/.test(key)) return true;
    const m = idx[n] ?? {};
    return (m.dur ?? 9) <= STANDING_ATTACK_MAX_SECONDS && (m.spineUp ?? 0) >= STANDING_ATTACK_SPINE_MIN;
  };
  const agrees = (q) => { const n = nameOf(q); return baked.has(n) && idx[n]?.semantic === key && playable(n); };
  const lead = nameOf(items[0] ?? '');
  const promoted = items.filter(agrees);
  const rest = items.filter((q) => !agrees(q));
  if (!promoted.length) return whole;
  const next = [...promoted, ...rest];
  if (next.join(',') === items.join(',')) return whole;
  rows.push({ key, was: lead, now: nameOf(next[0]), placeholderLed: SYNTH.has(lead), promoted: promoted.length });
  return `${indent}${key}:${gap}[${next.join(', ')}],`;
});

console.log('\nALIAS ORDER — a real capture outranks a synthesised stand-in\n');
if (!rows.length) console.log('  nothing to reorder; every list already leads with a clip the bake agrees about');
for (const r of rows) {
  console.log(`  ${r.key.padEnd(16)} ${r.was.padEnd(26)} -> ${r.now.padEnd(26)} ${r.placeholderLed ? '(placeholder was leading)' : ''}`);
}
const stillBad = rows.filter((r) => SYNTH.has(r.now));
console.log(`\n  ${rows.length} lists reordered, ${stillBad.length} still led by a placeholder`);

if (process.argv.includes('--write')) {
  writeFileSync(FILE, src);
  console.log(`  wrote ${FILE}`);
}
if (process.argv.includes('--gate') && rows.some((r) => r.placeholderLed)) {
  console.error('\nGATE FAILED — a synthesised gap filler is outranking a motion capture\n');
  process.exit(1);
}
