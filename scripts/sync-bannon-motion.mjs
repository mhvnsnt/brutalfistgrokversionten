#!/usr/bin/env node
/**
 * Pull the owner-granted Bannon motion bank into a generated TypeScript module.
 *
 * The source clips are the real assets under mhvnsnt/Bannon/assets/moves/clips.
 * We do not synthesize replacement motion here. The generated module is a
 * cache so the runtime can synchronously build AnimationClips and retarget them.
 *
 * SOURCE ORDER
 *   1. A local mhvnsnt/Bannon checkout, when one is attached to the workspace
 *      (BANNON_REPO, or a sibling directory). No network, and a clip listed in
 *      index.json but missing on disk is reported by name instead of as a 404.
 *   2. raw.githubusercontent.com at the pinned commit.
 *   3. An already-generated cache, left untouched so an existing preview keeps
 *      working when neither source is reachable.
 *
 * WHAT IS CACHED — measured, not assumed
 *   src/engine/retarget/BannonMotionBank.ts builds one QuaternionKeyframeTrack
 *   per bone in RUNTIME_BONE_NAMES and ignores every other field. The source
 *   clips also carry a `pose` block (19 IK joint world positions, read by
 *   nothing) and, on tag/cloth captures, up to 1003 bone entries for second
 *   bodies and cloth rigs that the target skeleton does not have.
 *
 *   Measured over the 201 clips the index resolves: full JSON 42.4 MB, of
 *   which the runtime's bones are 2.8 MB (6.5%). Caching the whole file put
 *   ~40 MB of tracks that makeClip discards at load into the browser bundle
 *   (the combat chunk measured 75.7 MB). The AnimationClips built from the
 *   pruned cache are identical — the same bones, times and values.
 *
 *   Nothing is deleted: the source clips in mhvnsnt/Bannon are untouched and
 *   the full data stays available there. This only bounds what ships.
 */

import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMeaningfulTravel, travelFromPoseKeys } from '../src/engine/motion/RootTravel.ts';

import { RUNTIME_BONE_NAMES, resolveRuntimeBone } from '../src/engine/retarget/boneNameMap.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUTPUT = `${ROOT}/src/generated/BannonMotionBank.generated.ts`;
const PINNED_COMMIT = '81d3b5da72da4dc2b057c8b3989226158c066240';
const CLIPS_PATH = 'assets/moves/clips';
const RAW_BASE = `https://raw.githubusercontent.com/mhvnsnt/Bannon/${PINNED_COMMIT}/${CLIPS_PATH}/`;

/** Local checkouts of mhvnsnt/Bannon this workspace may already have attached. */
function localClipDirCandidates() {
  const fromEnv = process.env.BANNON_REPO ? [resolve(process.env.BANNON_REPO)] : [];
  const siblings = [
    join(ROOT, '..', 'Bannon'),
    join(ROOT, '..', 'bannon'),
    join(ROOT, 'vendor', 'Bannon'),
  ];
  return [...fromEnv, ...siblings].map((base) => join(base, ...CLIPS_PATH.split('/')));
}

function findLocalClipDir() {
  return localClipDirCandidates().find((dir) => existsSync(join(dir, 'index.json'))) ?? '';
}

const NETWORK_TIMEOUT_MS = Number(process.env.BANNON_SYNC_TIMEOUT_MS ?? 5000);

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'brutal-fist-motion-sync/1.0' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
    return response.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Keep only what the runtime reads: duration, key times, and the runtime bones'
 * Euler rotations. Values are copied verbatim — nothing is rounded or re-encoded.
 */
function pruneClip(clip, stats) {
  const keys = [];
  /** runtime bone -> [min, max] per Euler component, to tell motion from a held pose */
  const span = new Map();
  for (const key of clip?.keys ?? []) {
    const bones = {};
    for (const [rawName, rotation] of Object.entries(key?.bones ?? {})) {
      const name = resolveRuntimeBone(rawName);
      if (!name) continue;
      if (name !== rawName) stats.renamedBones.add(`${rawName} -> ${name}`);
      // 73 of 48,048 source entries omit a component (4 clips). THREE.Euler
      // already defaults a missing argument to 0, so writing the 0 explicitly
      // changes no rotation — it just makes the cached triple complete.
      bones[name] = { rx: rotation.rx ?? 0, ry: rotation.ry ?? 0, rz: rotation.rz ?? 0 };
      if (rotation.rx === undefined || rotation.ry === undefined || rotation.rz === undefined) {
        stats.filledComponents++;
      }
      const seen = span.get(name);
      const next = [bones[name].rx, bones[name].ry, bones[name].rz];
      if (!seen) span.set(name, [next.slice(), next.slice()]);
      else for (let i = 0; i < 3; i++) {
        if (next[i] < seen[0][i]) seen[0][i] = next[i];
        if (next[i] > seen[1][i]) seen[1][i] = next[i];
      }
      stats.seen.add(name);
    }
    keys.push({ t: key.t, bones });
  }
  // ~2 degrees. Below that a bone is holding a pose, not animating.
  let movingBones = 0;
  for (const [min, max] of span.values()) {
    if (Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]) > 0.035) movingBones++;
  }
  /**
   * THE FOOTWORK THE CLIP WAS CAPTURED WITH.
   *
   * This cache stored ROTATIONS ONLY, so every clip arrived at the engine with
   * its feet nailed to one spot and displacement was faked from a hand-written
   * table of five profiles. The source clips carry joint world positions in a
   * `pose` block that nothing read — measured over the 973 of them, 273 travel
   * more than 15 cm horizontally and DROP_KICK crosses 1.12 m.
   *
   * Read here, at import, so it is cached once rather than recomputed per load,
   * and so EVERY future clip picks it up by existing. Drift is filtered out:
   * an idle that slides the fighter across the ring is worse than one that
   * stands still.
   */
  const travelCurve = travelFromPoseKeys(clip?.keys ?? []);
  const travel = isMeaningfulTravel(travelCurve)
    ? { t: travelCurve.t.map(round4), f: travelCurve.f.map(round4), l: travelCurve.l.map(round4) }
    : undefined;
  return { clip: { dur: clip?.dur ?? 0, keys, ...(travel ? { travel } : {}) }, boneCount: span.size, movingBones, travelled: Boolean(travel) };
}

const round4 = (v) => Math.round(v * 1e4) / 1e4;

async function main() {
  const localDir = findLocalClipDir();

  let index;
  try {
    index = localDir
      ? JSON.parse(await readFile(join(localDir, 'index.json'), 'utf8'))
      : await fetchJson(`${RAW_BASE}index.json`);
  } catch (error) {
    try {
      await readFile(OUTPUT, 'utf8');
      console.warn(`[motion-sync] source unavailable; keeping existing ${OUTPUT}`);
      return;
    } catch {
      throw error;
    }
  }

  const entries = Object.entries(index)
    .filter(([, meta]) => meta && typeof meta.file === 'string' && meta.file.endsWith('.json'));

  const bank = {};
  const stats = { seen: new Set(), filledComponents: 0, emptyClips: [], staticClips: [], renamedBones: new Set() };
  const concurrency = localDir ? 16 : 8;
  let cursor = 0;
  const skipped = [];
  let rawBytes = 0;

  async function readClip(file) {
    if (localDir) {
      const path = join(localDir, file);
      if (!existsSync(path)) throw new Error(`listed in index.json but not in the checkout: ${file}`);
      const text = await readFile(path, 'utf8');
      rawBytes += text.length;
      return JSON.parse(text);
    }
    return fetchJson(`${RAW_BASE}${encodeURIComponent(file)}`);
  }

  async function worker() {
    while (cursor < entries.length) {
      const i = cursor++;
      const [id, meta] = entries[i];
      try {
        const { clip, boneCount, movingBones } = pruneClip(await readClip(meta.file), stats);
        if (boneCount === 0) stats.emptyClips.push(id);
        else if (movingBones <= 1) stats.staticClips.push(`${id} (${movingBones}/${boneCount} bones move)`);
        bank[id] = clip;
      } catch (error) {
        skipped.push(id);
        console.warn(`[motion-sync] skipped ${id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, entries.length) }, worker));

  if (Object.keys(bank).length === 0) {
    throw new Error('[motion-sync] no motion clips were read');
  }

  const serialized = JSON.stringify(bank);
  await mkdir(dirname(OUTPUT), { recursive: true });
  const source =
    `/** GENERATED FILE — do not hand edit. Source: mhvnsnt/Bannon/${CLIPS_PATH}. */\n` +
    `/** Pruned to the bones src/engine/retarget/BannonMotionBank.ts builds tracks for. */\n` +
    `export const BANNON_MOTION_BANK_BONES: string[] = ${JSON.stringify(RUNTIME_BONE_NAMES)};\n` +
    `export const BANNON_MOTION_BANK: Record<string, {\n` +
    `  dur: number;\n` +
    `  keys: Array<{ t: number; bones: Record<string, { rx: number; ry: number; rz: number }> }>;\n` +
    `  /** Cumulative root travel in metres, in the fighter's own frame. Absent when the clip stands still. */\n` +
    `  travel?: { t: number[]; f: number[]; l: number[] };\n` +
    `}> = ${serialized};\n`;
  await writeFile(OUTPUT, source, 'utf8');

  const mb = (bytes) => `${(bytes / 1048576).toFixed(1)} MB`;
  console.log(
    `[motion-sync] synced ${Object.keys(bank).length}/${entries.length} Bannon motion clips` +
    ` from ${localDir ? `local checkout ${localDir}` : `raw.githubusercontent.com@${PINNED_COMMIT.slice(0, 7)}`}` +
    `${skipped.length ? ` (${skipped.length} skipped: ${skipped.join(', ')})` : ''}`,
  );
  console.log(
    `[motion-sync] cached ${mb(serialized.length)}` +
    `${rawBytes ? ` of ${mb(rawBytes)} read (${((100 * serialized.length) / rawBytes).toFixed(1)}%)` : ''}` +
    ` — ${stats.seen.size}/${RUNTIME_BONE_NAMES.length} runtime bones present`,
  );
  const absent = RUNTIME_BONE_NAMES.filter((bone) => !stats.seen.has(bone));
  if (absent.length) console.warn(`[motion-sync] runtime bones absent from every clip: ${absent.join(', ')}`);
  if (stats.renamedBones.size) {
    const vocabularies = new Set(
      [...stats.renamedBones].map((pair) => {
        const raw = pair.split(' -> ')[0];
        const mixamo = raw.match(/^mixamorig[^A-Z]*/);
        return mixamo ? `${mixamo[0]}*` : `${raw.split('_')[0]}_*`;
      }),
    );
    console.log(`[motion-sync] translated ${stats.renamedBones.size} source bone names onto the fight rig from: ${[...vocabularies].join(', ')}`);
  }
  if (stats.filledComponents) {
    console.log(`[motion-sync] ${stats.filledComponents} source rotations omitted a component; written as an explicit 0 (THREE.Euler's own default).`);
  }
  if (stats.staticClips.length) {
    // A clip can bind every bone and still animate nothing. Most of these are
    // bind-pose character exports (Y_BOT, the CH##_NONPBR reference models) and
    // are correctly inert, but a named MOVE in this list is a broken capture.
    console.warn(
      `[motion-sync] ${stats.staticClips.length} cached clips bind bones but hold a pose: ${stats.staticClips.join(', ')}`,
    );
  }
  if (stats.emptyClips.length) {
    console.warn(
      `[motion-sync] ${stats.emptyClips.length}/${Object.keys(bank).length} cached clips carry no runtime bone and build ZERO tracks` +
      ` — their source uses a different skeleton naming convention: ${stats.emptyClips.slice(0, 8).join(', ')}` +
      `${stats.emptyClips.length > 8 ? ', …' : ''}`,
    );
  }

  if (localDir) {
    const onDisk = (await readdir(localDir)).filter((f) => f.endsWith('.json') && f !== 'index.json').length;
    const unindexed = onDisk - entries.length;
    if (unindexed > 0) {
      console.log(`[motion-sync] note: ${unindexed} clip files in the checkout are not listed in index.json and were not cached.`);
    }
  }
}

main().catch((error) => {
  console.error(`[motion-sync] ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
  process.exitCode = 1;
});
