#!/usr/bin/env node
/**
 * PUT EVERY MOVE INSIDE TEKKEN'S FRAME ENVELOPE, IN ONE PASS.
 *
 * Owner: "the combat looking incoherent, buggy, and glitchy" and "cut out all
 * of the hand tooling".
 *
 * MEASURED across the 286 imported moves, in frames at 60fps:
 *
 *                 min   p25   median   p75   max
 *     startup       4     9      12     13    13
 *     active        3     6       9     14    33
 *     recovery      7    10      14     23    52
 *     TOTAL        15    25      35     51    98
 *
 * Against Tekken 7's published frame data:
 *
 *     startup   jab 10 · mid 13-16 · launcher 15-20 · slow power 20-30
 *     active    2-6 on almost everything
 *     TOTAL     jab ~20 · mid ~30 · launcher ~45 · power ~60
 *
 * So 61 moves come out faster than any Tekken jab — unreactable — and 148 of
 * 286 keep a hitbox live for more than 8 frames, with one at 33. A hitbox that
 * stays out for half a second hits you after the move has visually finished.
 * That is the incoherence: the numbers were derived from CLIP LENGTH, which is
 * how long an animation happens to run, not from fighting-game frame data.
 *
 * THIS DOES NOT INVENT NUMBERS PER MOVE. It preserves each move's RANK within
 * the set — whatever was fastest stays fastest — and maps that rank onto
 * Tekken's range. No move is hand-tuned and no ordering is changed.
 *
 *   node tools/moves/calibrate_frames.mjs           report
 *   node tools/moves/calibrate_frames.mjs --write   rewrite public/motion/movesets.json
 */
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = 'public/motion/movesets.json';
const F = 60;

/** Tekken's envelope, in frames. */
const STARTUP = { min: 10, max: 26 };
const ACTIVE = { min: 2, max: 6 };
const RECOVERY = { min: 8, max: 30 };

const movesets = JSON.parse(readFileSync(FILE, 'utf8'));
const all = [];
for (const [char, list] of Object.entries(movesets)) {
  for (const mv of list) if (typeof mv.startup === 'number') all.push({ char, mv });
}

/** Rank in [0,1] by a field, ties sharing a rank. Preserves ordering exactly. */
function ranks(values) {
  const sorted = [...values].slice().sort((a, b) => a - b);
  const index = new Map();
  sorted.forEach((v, i) => { if (!index.has(v)) index.set(v, i); });
  const n = Math.max(1, sorted.length - 1);
  return values.map((v) => index.get(v) / n);
}
const lerp = (r, { min, max }) => Math.round(min + r * (max - min));

const sRank = ranks(all.map(({ mv }) => mv.startup));
const aRank = ranks(all.map(({ mv }) => mv.active));
const rRank = ranks(all.map(({ mv }) => mv.recovery));

const before = { s: [], a: [], r: [], t: [] };
const after = { s: [], a: [], r: [], t: [] };
all.forEach(({ mv }, i) => {
  const bs = Math.round(mv.startup * F), ba = Math.round(mv.active * F), br = Math.round(mv.recovery * F);
  before.s.push(bs); before.a.push(ba); before.r.push(br); before.t.push(bs + ba + br);
  const s = lerp(sRank[i], STARTUP);
  const a = lerp(aRank[i], ACTIVE);
  const r = lerp(rRank[i], RECOVERY);
  after.s.push(s); after.a.push(a); after.r.push(r); after.t.push(s + a + r);
  mv.startup = s / F;
  mv.active = a / F;
  mv.recovery = r / F;
});

const q = (arr, p) => [...arr].sort((x, y) => x - y)[Math.floor(arr.length * p)];
const line = (name, b, a) =>
  console.log(`  ${name.padEnd(9)} ${String(Math.min(...b)).padStart(3)}-${String(Math.max(...b)).padEnd(3)} med ${String(q(b, 0.5)).padStart(3)}   ->   ${String(Math.min(...a)).padStart(3)}-${String(Math.max(...a)).padEnd(3)} med ${String(q(a, 0.5)).padStart(3)}`);

console.log(`\nFRAME CALIBRATION — ${all.length} moves, frames at 60fps\n`);
console.log('              BEFORE                AFTER');
line('startup', before.s, after.s);
line('active', before.a, after.a);
line('recovery', before.r, after.r);
line('TOTAL', before.t, after.t);
console.log(`\n  faster than a Tekken jab (startup < 10):  ${before.s.filter((x) => x < 10).length}  ->  ${after.s.filter((x) => x < 10).length}`);
console.log(`  hitbox out longer than 6 frames:          ${before.a.filter((x) => x > 6).length}  ->  ${after.a.filter((x) => x > 6).length}`);
console.log(`  longer than a Tekken power move (> 60):   ${before.t.filter((x) => x > 60).length}  ->  ${after.t.filter((x) => x > 60).length}`);

if (process.argv.includes('--write')) {
  writeFileSync(FILE, JSON.stringify(movesets));
  console.log(`\n  wrote ${FILE}`);
}
