#!/usr/bin/env node
/**
 * Import the GrappleMap grappling database — a graph of real grappling
 * positions and the transitions between them, for two bodies at once.
 *
 * SOURCE: github.com/Eelis/GrappleMap, `GrappleMap.txt`.
 * LICENCE: **public domain**, stated in its own README — "the GrappleMap code
 * and data is released into the public domain". Of every source surveyed for
 * this game it is the only one with no redistribution constraint at all, so it
 * is the one that can ship without qualification.
 *
 * WHY IT MATTERS HERE
 *   A wrestling game's hard problem is the GROUND GAME and the two-body
 *   grapple: where both bodies are, whose limb is where, and which position
 *   leads to which. This database is exactly that — named positions carrying
 *   tags (side_control, half_guard, mount, turtle, crossface, kimura…), the
 *   transitions between them as multi-keyframe sequences, and the joint
 *   coordinates of BOTH players in every frame.
 *
 * THE ENCODING, read from the source rather than guessed
 *   `src/persistence.cpp` `decodePosition` and `src/players.hpp`:
 *     - base62 digits are a-z = 0-25, A-Z = 26-51, 0-9 = 52-61
 *     - every coordinate is TWO digits: (d0 * 62 + d1) / 1000
 *     - x and z are then offset by -2; y is taken raw
 *     - joints run player0's 23 then player1's 23, in the JOINTS order below
 *   So one position is 23 * 2 * 3 * 2 = 276 characters, which is exactly the
 *   four ~69-character lines each entry carries.
 *
 * A PARSING TRAP WORTH KEEPING
 *   Entries may carry a `ref:` line (a citation) between `tags:` and the
 *   coordinates. Treating any unindented line as the next entry's name makes
 *   `ref:` swallow the coordinate block, and the real entry decodes to nothing.
 *   Measured: that alone accounted for 2,801 of 4,887 entries reading empty.
 *
 * WHAT THIS DOES NOT DO
 *   These are joint POSITIONS on GrappleMap's own 23-joint skeleton (it has
 *   toes, heels and fingers; it has no spine chain), while the fight rig is
 *   driven by bone ROTATIONS. Turning a position into a pose for our skeleton
 *   is an IK solve, and that is deliberately not attempted here — this lands
 *   the graph and the coordinates as data, verifiably, and the retarget is its
 *   own piece of work with its own verification.
 */

import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUTPUT = `${ROOT}/src/generated/GrappleMapGraph.generated.ts`;

/** GrappleMap's joint order — src/players.hpp, the JOINTS macro. */
const JOINTS = [
  'LeftToe', 'RightToe', 'LeftHeel', 'RightHeel', 'LeftAnkle', 'RightAnkle',
  'LeftKnee', 'RightKnee', 'LeftHip', 'RightHip', 'LeftShoulder', 'RightShoulder',
  'LeftElbow', 'RightElbow', 'LeftWrist', 'RightWrist', 'LeftHand', 'RightHand',
  'LeftFingers', 'RightFingers', 'Core', 'Neck', 'Head',
];
const COORDS_PER_POSITION = JOINTS.length * 2 * 3 * 2;

/** Lines that are entry metadata, not the start of a new entry. */
const META_PREFIX = /^(tags|ref|description|line_nr|properties):/;

function sourceCandidates() {
  const fromEnv = process.env.GRAPPLEMAP_REPO ? [resolve(process.env.GRAPPLEMAP_REPO)] : [];
  return [
    ...fromEnv,
    join(ROOT, '..', 'srcrepos', 'Eelis_GrappleMap'),
    join(ROOT, '..', 'GrappleMap'),
    join(ROOT, 'vendor', 'GrappleMap'),
  ].map((base) => join(base, 'GrappleMap.txt'));
}

function fromBase62(code) {
  if (code >= 97 && code <= 122) return code - 97;        // a-z
  if (code >= 65 && code <= 90) return code - 65 + 26;    // A-Z
  if (code >= 48 && code <= 57) return code - 48 + 52;    // 0-9
  return -1;
}

/** One 276-character run -> both players' 23 joints. */
function decodePosition(digits, offset) {
  let i = offset;
  const next = () => (digits[i++] * 62 + digits[i++]) / 1000;
  const players = [[], []];
  for (let p = 0; p < 2; p++) {
    for (let j = 0; j < JOINTS.length; j++) {
      const x = next() - 2, y = next(), z = next() - 2;
      players[p].push([+x.toFixed(4), +y.toFixed(4), +z.toFixed(4)]);
    }
  }
  return players;
}

function parse(text) {
  const entries = [];
  let current = null;
  for (const raw of text.split('\n')) {
    if (/^\s{4}\S/.test(raw)) { if (current) current.encoded += raw.trim(); continue; }
    const line = raw.trimEnd();
    if (!line) continue;
    if (META_PREFIX.test(line)) {
      if (!current) continue;
      const [key, ...rest] = line.split(':');
      const value = rest.join(':').trim();
      if (key === 'tags') current.tags = value.split(/\s+/).filter(Boolean);
      else if (key === 'ref') current.ref = value;
      continue;
    }
    if (current) entries.push(current);
    // Names carry a literal backslash-n as a layout hint for the viewer.
    current = { name: line.replace(/\\n/g, ' ').trim(), tags: [], encoded: '' };
  }
  if (current) entries.push(current);
  return entries;
}

async function main() {
  const file = sourceCandidates().find((p) => existsSync(p));
  if (!file) {
    const message = '[grapplemap] no GrappleMap checkout found';
    if (existsSync(OUTPUT)) { console.warn(`${message}; keeping the existing graph`); return; }
    console.warn(`${message}; writing an empty graph`);
    await write({ positions: [], transitions: [], tags: {} }, '(none)');
    return;
  }

  const entries = parse(readFileSync(file, 'utf8'));
  const positions = [];
  const transitions = [];
  const tagCounts = {};
  let noCoords = 0;

  for (const entry of entries) {
    const digits = [];
    for (let i = 0; i < entry.encoded.length; i++) {
      const d = fromBase62(entry.encoded.charCodeAt(i));
      if (d >= 0) digits.push(d);
    }
    const frameCount = Math.floor(digits.length / COORDS_PER_POSITION);
    if (frameCount === 0) { noCoords++; continue; }

    for (const tag of entry.tags) tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;

    const frames = [];
    for (let f = 0; f < frameCount; f++) frames.push(decodePosition(digits, f * COORDS_PER_POSITION));

    const record = { name: entry.name, tags: entry.tags, frames };
    if (entry.ref) record.ref = entry.ref;
    // One keyframe is a static position; several are a transition between two.
    (frameCount === 1 ? positions : transitions).push(record);
  }

  await write({ positions, transitions, tags: tagCounts }, file, noCoords);
}

async function write(graph, source, noCoords = 0) {
  const serialized = JSON.stringify(graph);
  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(
    OUTPUT,
    `/** GENERATED FILE — do not hand edit. Source: Eelis/GrappleMap GrappleMap.txt (public domain). */\n` +
    `/** Joint order: ${JOINTS.join(', ')} — for BOTH players, player0 then player1. */\n` +
    `export const GRAPPLEMAP_JOINTS: string[] = ${JSON.stringify(JOINTS)};\n` +
    `export interface GrappleMapEntry {\n` +
    `  name: string;\n` +
    `  tags: string[];\n` +
    `  ref?: string;\n` +
    `  /** [frame][player][joint] = [x, y, z] */\n` +
    `  frames: number[][][][];\n` +
    `}\n` +
    `export const GRAPPLEMAP_GRAPH: {\n` +
    `  positions: GrappleMapEntry[];\n` +
    `  transitions: GrappleMapEntry[];\n` +
    `  tags: Record<string, number>;\n` +
    `} = ${serialized};\n`,
    'utf8',
  );

  const mb = (bytes) => `${(bytes / 1048576).toFixed(2)} MB`;
  const frames = [...graph.positions, ...graph.transitions].reduce((a, e) => a + e.frames.length, 0);
  console.log(`[grapplemap] ${graph.positions.length} positions, ${graph.transitions.length} transitions from ${source}`);
  console.log(`[grapplemap] ${frames} two-body keyframes, ${Object.keys(graph.tags).length} distinct tags, cached ${mb(serialized.length)}`);
  if (noCoords) console.log(`[grapplemap] ${noCoords} entries carried no coordinates and were skipped`);
  const top = Object.entries(graph.tags).sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (top.length) console.log(`[grapplemap] most common: ${top.map(([t, c]) => `${t}(${c})`).join(' ')}`);
}

main().catch((error) => {
  console.error(`[grapplemap] ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
  process.exitCode = 1;
});
