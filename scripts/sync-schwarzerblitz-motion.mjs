#!/usr/bin/env node
/**
 * Import the owner-granted Schwarzerblitz fighting animations into the same
 * cached clip format the Bannon motion bank uses.
 *
 * SOURCE: mhvnsnt/SchwarzerblitzEngine, `bin/media/common/animations/*.x`.
 * The owner has stated permission for these assets; the grant is recorded in
 * src/engine/retarget/AnimationSourceRegistry.ts. The engine itself is
 * BSD-3-Clause. Nothing is synthesized here — every clip is a real authored
 * animation from that checkout, and only clips actually present are imported.
 *
 * WHY .x PARSES DIRECTLY
 *   Schwarzerblitz's skeletal format is DirectX .x, and these files are the
 *   TEXT flavour (`xof 0303txt 0032`), so they need no converter and no Blender.
 *   Measured: 236 of the 245 .x files in the checkout carry an AnimationSet, and
 *   the 166 under common/animations are the fighting set — stances, walk, run,
 *   sidesteps, jumps, guards, strikes, throws with their receiver halves, hit
 *   reactions and getups.
 *
 * THE CONVENTION, MEASURED RATHER THAN ASSUMED
 *   A .x AnimationKey of type 0 stores a quaternion as (w, x, y, z), and in the
 *   DirectX convention it is the CONJUGATE of the rotation. Getting this wrong
 *   does not fail loudly — it plays every motion mirrored, which is exactly the
 *   failure docs/mocap_orientation_master_prompt.md warns about.
 *
 *   So it was checked against the data instead of trusted: each bone's first
 *   rotation key was compared with the rotation decomposed from that same bone's
 *   own FrameTransformMatrix, as-is and conjugated. Over axeKick.x's 41 bones,
 *   39 matched ONLY as the conjugate (dot 1.000 against 0.000). The two that did
 *   not are the root frames, whose rest matrix carries the armature transform.
 *
 * FRAME RATE
 *   24 fps, read from the engine: `FK_BasicAnimationRate = 24.0` in
 *   SchwarzerblitzEngine/FK_Database.h, used as the default animation rate in
 *   FK_Character.cpp and FK_DatabaseAccessor.cpp.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { RUNTIME_BONE_NAMES, resolveRuntimeBone } from '../src/engine/retarget/boneNameMap.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUTPUT = `${ROOT}/src/generated/SchwarzerblitzMotionBank.generated.ts`;
const MEDIA = ['schwarzerblitz_engine', 'bin', 'media'];
const FPS = 24;

function sourceCandidates() {
  const fromEnv = process.env.SCHWARZERBLITZ_REPO ? [resolve(process.env.SCHWARZERBLITZ_REPO)] : [];
  return [
    ...fromEnv,
    join(ROOT, '..', 'SchwarzerblitzEngine'),
    join(ROOT, '..', 'schwarzerblitz'),
    join(ROOT, 'vendor', 'SchwarzerblitzEngine'),
  ].map((base) => join(base, ...MEDIA));
}

/** Directories of .x animations worth importing, relative to bin/media. */
const ANIMATION_DIRS = ['common/animations'];

/**
 * Minimal reader for the text .x flavour: pulls each animated bone's rotation
 * keys out of the AnimationSet. Geometry, materials and the frame hierarchy are
 * not needed — only bone rotations reach the fight rig.
 */
function parseRotationKeys(text) {
  const anims = new Map();
  const setIndex = text.indexOf('AnimationSet');
  if (setIndex < 0) return anims;
  const blocks = text.slice(setIndex).split(/\n\s*Animation\s*\{/).slice(1);
  for (const block of blocks) {
    const boneMatch = block.match(/\{\s*([A-Za-z0-9_]+)\s*\}/);
    if (!boneMatch) continue;
    // key type 0 is rotation; 1 is scale and 2 is position, neither of which is used
    const rotation = block.match(/AnimationKey\s*\{[^}]*?\n\s*0;\s*\n\s*(\d+);([\s\S]*?)\n\s*\}/);
    if (!rotation) continue;
    const keys = [];
    for (const m of rotation[2].matchAll(
      /(\d+);4;\s*([-\d.eE]+),\s*([-\d.eE]+),\s*([-\d.eE]+),\s*([-\d.eE]+)/g,
    )) {
      keys.push({ frame: +m[1], w: +m[2], x: +m[3], y: +m[4], z: +m[5] });
    }
    if (keys.length) anims.set(boneMatch[1], keys);
  }
  return anims;
}

/** Conjugated .x quaternion -> XYZ Euler, the form the clip cache stores. */
function keyToEuler(key) {
  // conjugate: negate the vector part (see the convention note above)
  const x = -key.x, y = -key.y, z = -key.z, w = key.w;
  const len = Math.hypot(x, y, z, w) || 1;
  const qx = x/len, qy = y/len, qz = z/len, qw = w/len;
  // XYZ-order extraction, matching THREE.Euler.setFromQuaternion(q, 'XYZ')
  const m11 = 1 - 2*(qy*qy + qz*qz), m12 = 2*(qx*qy - qz*qw), m13 = 2*(qx*qz + qy*qw);
  const m22 = 1 - 2*(qx*qx + qz*qz), m23 = 2*(qy*qz - qx*qw);
  const m32 = 2*(qy*qz + qx*qw), m33 = 1 - 2*(qx*qx + qy*qy);
  const clamp = (v) => Math.min(1, Math.max(-1, v));
  let rx, ry, rz;
  ry = Math.asin(clamp(m13));
  if (Math.abs(m13) < 0.9999999) {
    rx = Math.atan2(-m23, m33);
    rz = Math.atan2(-m12, m11);
  } else {
    rx = Math.atan2(m32, m22);
    rz = 0;
  }
  const round = (v) => Math.round(v * 1e4) / 1e4;
  return { rx: round(rx), ry: round(ry), rz: round(rz) };
}

/** A file name becomes the clip id the engine addresses it by. */
function clipId(fileName) {
  return fileName.replace(/\.x$/i, '').replace(/[^A-Za-z0-9]+/g, '_').toUpperCase();
}

async function main() {
  const mediaRoot = sourceCandidates().find((dir) => existsSync(dir));
  if (!mediaRoot) {
    const message = '[sbz-sync] no SchwarzerblitzEngine checkout found; leaving the existing bank alone';
    if (existsSync(OUTPUT)) { console.warn(message); return; }
    console.warn(`${message} (and none is generated yet)`);
    await writeBank({}, { seen: new Set(), skipped: [], emptyClips: [] }, '(none)');
    return;
  }

  const bank = {};
  const stats = { seen: new Set(), skipped: [], emptyClips: [], unmapped: new Map(), frames: 0 };

  for (const relative of ANIMATION_DIRS) {
    const dir = join(mediaRoot, ...relative.split('/'));
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.x')).sort()) {
      const id = clipId(file);
      let anims;
      try {
        anims = parseRotationKeys(readFileSync(join(dir, file), 'utf8'));
      } catch (error) {
        stats.skipped.push(`${id} (${error instanceof Error ? error.message : String(error)})`);
        continue;
      }
      if (!anims.size) { stats.skipped.push(`${id} (no AnimationSet)`); continue; }

      /** frame index -> runtime bone -> euler */
      const byFrame = new Map();
      for (const [rawBone, keys] of anims) {
        const bone = resolveRuntimeBone(rawBone);
        if (!bone) {
          stats.unmapped.set(rawBone, (stats.unmapped.get(rawBone) ?? 0) + 1);
          continue;
        }
        stats.seen.add(bone);
        for (const key of keys) {
          let frame = byFrame.get(key.frame);
          if (!frame) byFrame.set(key.frame, (frame = {}));
          frame[bone] = keyToEuler(key);
        }
      }

      const frames = [...byFrame.keys()].sort((a, b) => a - b);
      if (!frames.length) { stats.emptyClips.push(id); continue; }
      const keysOut = frames.map((f) => ({ t: Math.round((f / FPS) * 1e4) / 1e4, bones: byFrame.get(f) }));
      bank[id] = { dur: Math.round((frames[frames.length - 1] / FPS) * 1e4) / 1e4, keys: keysOut };
      stats.frames += frames.length;
    }
  }

  if (!Object.keys(bank).length) throw new Error('[sbz-sync] no Schwarzerblitz clips were read');
  await writeBank(bank, stats, mediaRoot);
}

async function writeBank(bank, stats, mediaRoot) {
  const serialized = JSON.stringify(bank);
  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(
    OUTPUT,
    `/** GENERATED FILE — do not hand edit. Source: mhvnsnt/SchwarzerblitzEngine ${ANIMATION_DIRS.join(', ')}. */\n` +
    `/** Owner-granted; see src/engine/retarget/AnimationSourceRegistry.ts. Imported at ${FPS} fps. */\n` +
    `export const SCHWARZERBLITZ_MOTION_BANK: Record<string, {\n` +
    `  dur: number;\n` +
    `  keys: Array<{ t: number; bones: Record<string, { rx: number; ry: number; rz: number }> }>;\n` +
    `}> = ${serialized};\n`,
    'utf8',
  );

  const count = Object.keys(bank).length;
  const mb = (bytes) => `${(bytes / 1048576).toFixed(2)} MB`;
  console.log(`[sbz-sync] imported ${count} Schwarzerblitz clips from ${mediaRoot}`);
  console.log(
    `[sbz-sync] cached ${mb(serialized.length)}, ${stats.frames} keyframes, ` +
    `${stats.seen.size}/${RUNTIME_BONE_NAMES.length} runtime bones driven`,
  );
  const absent = RUNTIME_BONE_NAMES.filter((b) => !stats.seen.has(b));
  if (absent.length) {
    console.log(`[sbz-sync] not driven by this rig (stays at rest): ${absent.join(', ')}`);
  }
  if (stats.skipped.length) console.warn(`[sbz-sync] skipped ${stats.skipped.length}: ${stats.skipped.slice(0, 6).join(', ')}`);
  if (stats.emptyClips.length) console.warn(`[sbz-sync] ${stats.emptyClips.length} clips mapped no runtime bone: ${stats.emptyClips.slice(0, 6).join(', ')}`);
  if (stats.unmapped?.size) {
    const top = [...stats.unmapped.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([n, c]) => `${n} x${c}`);
    console.log(`[sbz-sync] source bones with no counterpart on the fight rig: ${top.join(', ')}`);
  }
}

main().catch((error) => {
  console.error(`[sbz-sync] ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
  process.exitCode = 1;
});
