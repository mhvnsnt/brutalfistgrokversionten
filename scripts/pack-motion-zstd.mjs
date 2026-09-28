#!/usr/bin/env node
/**
 * Wrap baked motion JSON in Zstandard. Plain .json stays so tools that read
 * the bake on disk keep working; the runtime prefers the .zst sibling.
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { zstdCompressSync } from 'node:zlib';

const roots = ['public/motion/baked'];
const extras = ['public/motion/movesets.json', 'public/motion/command-clips.json', 'public/motion/lower_body_credibility.json', 'public/motion/stride_speed.json', 'public/motion/attack_levels.json', 'public/motion/schwarzerblitz_moves.json'];
let files = 0;
let before = 0;
let after = 0;

function pack(path) {
  const raw = readFileSync(path);
  const packed = zstdCompressSync(raw);
  writeFileSync(`${path}.zst`, packed);
  files += 1;
  before += raw.length;
  after += packed.length;
}

for (const root of roots) {
  for (const name of readdirSync(root)) {
    if (!name.endsWith('.json')) continue;
    pack(join(root, name));
  }
}
for (const path of extras) {
  if (statSync(path, { throwIfNoEntry: false })) pack(path);
}

console.log(
  `[zstd] ${files} motion files ${Math.round(before / 1e6)}MB → ${Math.round(after / 1e6)}MB`,
);
