#!/usr/bin/env node
/**
 * ARE THESE ACTUALLY DIFFERENT MOVES?
 *
 * Owner: "you have three taunts up there with three different names, but
 * every taunt is showing the same image. So get that fixed. That also
 * happens with some attacks." And, seeing the four stances side by side:
 * "stance wide, stance bladed, taunt flex, and guard high, they're all
 * happening the same ... making him stretch out into like a T pose and do
 * like a fucking starfish thing."
 *
 * He is right on both counts and they are two separate defects:
 *
 *   DUPLICATES  — several names, one motion. The move list looks deep and
 *                 plays shallow, and a moveset editor full of them is a lie.
 *   DEAD POSES  — a clip that is the RIG rather than a pose. Arms straight
 *                 out, no motion: the starfish. Nobody authored it.
 *
 * MEASURED ON THE BAKED DATA, no rendering and no opinion. Every clip is
 * reduced to a signature — its quaternion tracks resampled onto a common
 * time grid and rounded — so two clips that play the same motion produce the
 * same bytes whatever they are called.
 *
 * Nothing is deleted. Generated content is never deleted (owner law); the
 * point is to know which names are real so the pools can stop offering four
 * doors into one room.
 *
 * Usage: node scripts/audit-duplicate-clips.mjs [--gate] [--json out.json]
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BAKED = 'public/motion/baked';
const ARGS = process.argv.slice(2);
const GATE = ARGS.includes('--gate');
const JSON_OUT = ARGS.includes('--json') ? ARGS[ARGS.indexOf('--json') + 1] : null;

/** Samples per clip. Enough to tell two motions apart, few enough to be fast. */
const SAMPLES = 12;
/** Quaternion components are rounded to this before hashing. */
const PRECISION = 2;

function sampleTrack(track, t) {
  const times = track.t;
  const q = track.q;
  if (!times?.length) return [0, 0, 0, 1];
  let i = 0;
  while (i < times.length - 1 && times[i + 1] < t) i++;
  return [q[i * 4], q[i * 4 + 1], q[i * 4 + 2], q[i * 4 + 3]];
}

/**
 * A clip's fingerprint: every bone it drives, sampled at the same fractions
 * of its own duration, rounded.
 *
 * FRACTIONS OF ITS OWN DURATION, deliberately — the same motion played at two
 * speeds is the same motion under two names, which is exactly the kind of
 * padding this is looking for.
 */
function signature(data) {
  const bones = Object.keys(data.tracks ?? {}).sort();
  const parts = [];
  for (const bone of bones) {
    const track = data.tracks[bone];
    const row = [];
    for (let i = 0; i < SAMPLES; i++) {
      const t = ((data.dur || 1) * i) / (SAMPLES - 1);
      for (const v of sampleTrack(track, t)) row.push(v.toFixed(PRECISION));
    }
    parts.push(bone + ':' + row.join(','));
  }
  return createHash('sha1').update(parts.join('|')).digest('hex');
}

/** How much the clip MOVES: total quaternion travel per bone, summed. */
function motion(data) {
  let total = 0;
  for (const track of Object.values(data.tracks ?? {})) {
    const q = track.q;
    for (let i = 4; i + 3 < q.length; i += 4) {
      const dot = Math.abs(q[i] * q[i - 4] + q[i + 1] * q[i - 3] + q[i + 2] * q[i - 2] + q[i + 3] * q[i - 1]);
      total += Math.acos(Math.min(1, dot)) * 2;
    }
  }
  return total;
}

const files = readdirSync(BAKED).filter((f) => f.endsWith('.json') && f !== 'index.json');
const index = JSON.parse(readFileSync(join(BAKED, 'index.json'), 'utf8'));

const groups = new Map();
const rows = [];
for (const file of files) {
  const data = JSON.parse(readFileSync(join(BAKED, file), 'utf8'));
  const sig = signature(data);
  const row = { name: data.name, sig, motion: +motion(data).toFixed(3), dur: data.dur, semantic: data.semantic };
  rows.push(row);
  if (!groups.has(sig)) groups.set(sig, []);
  groups.get(sig).push(row);
}

const dupes = [...groups.values()].filter((g) => g.length > 1).sort((a, b) => b.length - a.length);
const duplicated = dupes.reduce((n, g) => n + g.length - 1, 0);
/** A clip that barely moves is a POSE; one that does not move at all is a rig. */
const still = rows.filter((r) => r.motion < 0.5).sort((a, b) => a.motion - b.motion);

console.log(`clips: ${rows.length}`);
console.log(`\nDUPLICATE GROUPS: ${dupes.length}  (${duplicated} names are a second door into an existing motion)`);
for (const g of dupes.slice(0, 12)) {
  console.log(`  ${g.length}x  ${g.map((r) => r.name).join(', ')}`);
}
console.log(`\nBARELY MOVES (under 0.5 rad of total bone travel): ${still.length}`);
for (const r of still.slice(0, 12)) console.log(`  ${r.name.padEnd(30)} travel ${r.motion}  dur ${r.dur}`);

if (JSON_OUT) {
  writeFileSync(JSON_OUT, JSON.stringify({ duplicateGroups: dupes, barelyMoves: still }, null, 2));
  console.log(`\nwrote ${JSON_OUT}`);
}

if (GATE && dupes.length > 0) {
  console.error('\nGATE: duplicate motions are being offered under different names.');
  process.exit(1);
}
