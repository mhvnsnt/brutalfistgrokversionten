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

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUTPUT = `${ROOT}/src/generated/BannonMotionBank.generated.ts`;
const PINNED_COMMIT = '81d3b5da72da4dc2b057c8b3989226158c066240';
const CLIPS_PATH = 'assets/moves/clips';
const RAW_BASE = `https://raw.githubusercontent.com/mhvnsnt/Bannon/${PINNED_COMMIT}/${CLIPS_PATH}/`;

/**
 * The bones src/engine/retarget/BannonMotionBank.ts turns into tracks.
 * Keep in step with QUATERNION_BONE_NAMES there — a bone missing from this
 * list simply never reaches the runtime, so the sync reports its coverage.
 */
const RUNTIME_BONE_NAMES = [
  'mixamorigHips', 'mixamorigSpine', 'mixamorigSpine1', 'mixamorigSpine2',
  'mixamorigNeck', 'mixamorigHead',
  'mixamorigLeftShoulder', 'mixamorigLeftArm', 'mixamorigLeftForeArm', 'mixamorigLeftHand',
  'mixamorigRightShoulder', 'mixamorigRightArm', 'mixamorigRightForeArm', 'mixamorigRightHand',
  'mixamorigLeftUpLeg', 'mixamorigLeftLeg', 'mixamorigLeftFoot', 'mixamorigLeftToeBase',
  'mixamorigRightUpLeg', 'mixamorigRightLeg', 'mixamorigRightFoot', 'mixamorigRightToeBase',
];
const RUNTIME_BONES = new Set(RUNTIME_BONE_NAMES);

/**
 * Collapse a Mixamo namespace onto the canonical bone name.
 *
 * Exporters stamp the rig's namespace into every bone: Maya/FBX writes
 * `mixamorig:Hips`, and Mixamo auto-numbers a second rig as `mixamorig9Hips`.
 * MEASURED over the indexed bank: 50 clips were rejected on this alone and
 * animated nothing — CH06_NONPBR (22 bones) plus the 49 `mixamorig:` clips,
 * which are the project's own ZONE_ ring transitions, the LOCO_, STANCE_ and
 * GUARD_ sets, the four TAUNT_ entries, and the owner's own TIGER_FEINT_KICK,
 * JUNGLE_JUICE and TZ_ captures with their __RECV halves.
 *
 * Verified before applying: no clip in the bank has two distinct raw bones that
 * collapse onto the same runtime bone (0 collisions), so this cannot merge an
 * attacker's and a receiver's skeleton. Already-canonical names are untouched.
 *
 * The same rule is applied in src/engine/retarget/BannonMotionBank.ts so a clip
 * that reaches makeClip by any other route binds identically.
 */
function canonicalBoneName(name) {
  return name.replace(/^mixamorig[0-9:_\-.\s]*(?=[A-Z])/, 'mixamorig');
}

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

async function fetchJson(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'brutal-fist-motion-sync/1.0' } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
  return response.json();
}

/**
 * Keep only what the runtime reads: duration, key times, and the runtime bones'
 * Euler rotations. Values are copied verbatim — nothing is rounded or re-encoded.
 */
function pruneClip(clip, stats) {
  const keys = [];
  for (const key of clip?.keys ?? []) {
    const bones = {};
    for (const [rawName, rotation] of Object.entries(key?.bones ?? {})) {
      const name = canonicalBoneName(rawName);
      if (!RUNTIME_BONES.has(name)) continue;
      if (name !== rawName) stats.renamedBones.add(`${rawName} -> ${name}`);
      // 73 of 48,048 source entries omit a component (4 clips). THREE.Euler
      // already defaults a missing argument to 0, so writing the 0 explicitly
      // changes no rotation — it just makes the cached triple complete.
      bones[name] = { rx: rotation.rx ?? 0, ry: rotation.ry ?? 0, rz: rotation.rz ?? 0 };
      if (rotation.rx === undefined || rotation.ry === undefined || rotation.rz === undefined) {
        stats.filledComponents++;
      }
      stats.seen.add(name);
    }
    keys.push({ t: key.t, bones });
  }
  return { dur: clip?.dur ?? 0, keys };
}

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
  const stats = { seen: new Set(), filledComponents: 0, emptyClips: [], renamedBones: new Set() };
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
        const clip = pruneClip(await readClip(meta.file), stats);
        if (!clip.keys.some((key) => Object.keys(key.bones).length > 0)) stats.emptyClips.push(id);
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
    const prefixes = new Set([...stats.renamedBones].map((pair) => pair.split(' -> ')[0].match(/^mixamorig[^A-Z]*/)[0]));
    console.log(`[motion-sync] collapsed Mixamo namespaces onto canonical bone names: ${[...prefixes].join(', ')}`);
  }
  if (stats.filledComponents) {
    console.log(`[motion-sync] ${stats.filledComponents} source rotations omitted a component; written as an explicit 0 (THREE.Euler's own default).`);
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
