#!/usr/bin/env node
/**
 * UNIVERSAL INTAKE, STEP 0: bring real two-body grapple captures from the
 * Bannon repo into the versionten motion source bank WITH PROVENANCE.
 *
 * This script only copies source clips that already exist in
 * mhvnsnt/Bannon/assets/moves/clips and records where each one came from.
 * Nothing here synthesises, time-warps or edits motion. The copied clips then
 * go through the normal universal bake (`npm run bake`), which derives the
 * deliverer <-> receiver pairing from the `__RECV` suffix like every other
 * pair in the bank.
 *
 * Usage:
 *   node scripts/intake-bannon-grapple-pairs.mjs [--bannon /workspace/ref-repos/Bannon] [--dry]
 */
import { copyFileSync, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const BANNON = flag('bannon', '/workspace/ref-repos/Bannon');
const DRY = argv.includes('--dry');
const SRC_DIR = join(BANNON, 'assets', 'moves', 'clips');
const DST_DIR = join('public', 'motion');

/** Bannon main at the time of intake. */
export const BANNON_SOURCE_COMMIT = 'd575dd6766c9585354f70caad23cdd3e37e924af';

const TWO_BODY = 'video_to_clip/mediapipe/two-body';
const ONE_BODY = 'video_to_clip/mediapipe/single-body';
const OWNER_VIDEO = 'owner reference video (footage not committed to Bannon)';
// Capture commits, from `gh api repos/mhvnsnt/Bannon/commits?path=...`.
const TWO_BODY_COMMIT = '6adb55108c (Two-body motion capture: the receiver gets a clip too) / de17ebc1d7 / 2f84b6d530 re-capture';
const F5_COMMIT = '94f78a2450 (owner videos: POWERBOMB, POWERBOMB_SYCO, POWERBOMB_SITOUT, POWERBOMB_CHOKELIFT, F5)';

/**
 * `cover` is the tracked-frame fraction BANNON_OWNER_MOVES records for the
 * capture (BANNON_v150.html, CAPTURES table). Low cover is flagged, never used
 * to discard (owner law: bank and flag).
 */
export const INTAKE = [
  // [deliverer, receiver|null, label, cover, bodies]
  ['FLYING_HEADBUTT', 'FLYING_HEADBUTT__RECV', 'Flying Headbutt (spread-arm, top rope onto prone man)', 0.37, 2],
  ['PUMPHANDLE_GERMAN_DOUBLE', 'PUMPHANDLE_GERMAN_DOUBLE__RECV', 'Double Pumphandle German (bridging)', 0.38, 2],
  ['BACKDROP_360_FACE', 'BACKDROP_360_FACE__RECV', '360 Backdrop (face first)', 0.98, 2],
  ['FALCON_ARROW_STANDING', 'FALCON_ARROW_STANDING__RECV', 'Falcon Arrow', 0.84, 2],
  ['FALCON_ARROW_GROUNDED', 'FALCON_ARROW_GROUNDED__RECV', 'Falcon Arrow (grounded)', 0.78, 2],
  ['SOMERSAULT_TORNADO_DDT', 'SOMERSAULT_TORNADO_DDT__RECV', 'Somersault Tornado DDT', 0.51, 2],
  ['STALLING_SUPLEX_STEPS', 'STALLING_SUPLEX_STEPS__RECV', 'Stalling Vertical Suplex (up the steps)', 0.57, 2],
  ['TAG_POWERBOMB_GERMAN', 'TAG_POWERBOMB_GERMAN__RECV', 'Powerbomb Toss / German (tag, 3 bodies)', 0.5, 3],
  // Deliverer halves whose receiver was never captured.
  ['F5', null, 'F5 (fireman carry spinning facebuster), single-body capture', null, 1],
  ['DIVING_HEADBUTT_GABLE', null, 'Diving Headbutt (Gable); declared __RECV was never banked', 0.69, 1],
];

function entryFor(name, role, label, cover, bodies, partner) {
  const file = `${name}.json`;
  const src = JSON.parse(readFileSync(join(SRC_DIR, file), 'utf8'));
  const k0 = src.keys?.[0] ?? {};
  return {
    file,
    bytes: statSync(join(SRC_DIR, file)).size,
    dur: src.dur,
    keys: src.keys?.length ?? 0,
    bones: Object.keys(k0.bones ?? {}).length,
    src: OWNER_VIDEO,
    via: partner || role === 'receiver' ? TWO_BODY : ONE_BODY,
    role,
    ...(partner ? { pairedWith: partner } : {}),
    ...(cover != null ? { coverFrac: cover, lowCoverage: cover < 0.45 } : {}),
    bodies,
    label,
    provenance: {
      origin: 'AUTHORED_CAPTURE',
      repo: 'mhvnsnt/Bannon',
      path: `assets/moves/clips/${file}`,
      commit: BANNON_SOURCE_COMMIT,
      captureCommit: name === 'F5' ? F5_COMMIT : TWO_BODY_COMMIT,
      tool: 'tools/mocap/video_to_clip.py (MediaPipe Pose Landmarker, Apache-2.0)',
      mixamo: false,
      synthetic: false,
    },
  };
}

const indexPath = join(DST_DIR, 'index.json');
const index = JSON.parse(readFileSync(indexPath, 'utf8'));
let added = 0;
for (const [del, recv, label, cover, bodies] of INTAKE) {
  const halves = [[del, recv ? 'attacker' : 'attacker', recv]];
  if (recv) halves.push([recv, 'receiver', null]);
  for (const [name, role, partner] of halves) {
    const from = join(SRC_DIR, `${name}.json`);
    if (!existsSync(from)) throw new Error(`intake source missing: ${from}`);
    const entry = entryFor(name, role, label, cover, bodies, partner);
    if (!DRY) copyFileSync(from, join(DST_DIR, entry.file));
    if (!index[name]) added++;
    index[name] = entry;
    console.log(`${DRY ? '[dry] ' : ''}${name.padEnd(34)} ${role.padEnd(9)} dur=${entry.dur} bones=${entry.bones}`);
  }
}
if (!DRY) writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n');
console.log(`${added} new source clips; index now ${Object.keys(index).length}`);
