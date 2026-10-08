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
 * OWNER CAPTURES made outside Bannon (OWNER_CAPTURES below) come in the same
 * way, each from its own capture directory (`dir`): the two halves written by
 * the capture run documented in tools/mocap/getbackk/README.md (and
 * tools/mocap/chainsnatcher/README.md), with that run's own coverage,
 * interpolation and constrained-solve record copied into provenance.
 * `--owner-captures-root <dir>` replaces the /workspace/mocap-src root.
 *
 * Usage:
 *   node scripts/intake-bannon-grapple-pairs.mjs [--bannon /workspace/ref-repos/Bannon]
 *        [--owner-captures-root /workspace/mocap-src] [--dry]
 */
import { copyFileSync, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const BANNON = flag('bannon', '/workspace/ref-repos/Bannon');
const DRY = argv.includes('--dry');
const SRC_DIR = join(BANNON, 'assets', 'moves', 'clips');
const OWNER_ROOT = flag('owner-captures-root', '/workspace/mocap-src');
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

/**
 * Two-body captures of owner-supplied reference video made with Bannon's
 * clip builder (tools/mocap/video_to_clip.py build_clip) behind an RTMO +
 * RTMW3D tracking front end, because the stock YOLOX + BlazePose front end
 * lost the receiver for the whole carry. Footage is NOT committed anywhere.
 */
/** The owner approved shipping motion captured from third-party clips on 2026-10-07. */
export const THIRD_PARTY_APPROVED = 'third-party clip, owner-approved for use 2026-10-07';

export const OWNER_CAPTURES = [
  {
    deliverer: 'GETBACKK', receiver: 'GETBACKK__RECV', bodies: 2, dir: 'getbackk_capture',
    label: 'Getbackk (fireman carry, corkscrew toss, F-5 style) — owner-supplied reference',
    sourceVideo: {
      file: 'GETBACKK_src.mp4',
      sha256: '185e4d2a2a22054f7637f7b133c6d1e8b209d7ee5300e931d5ffaacda60a0112',
      format: '576x1024 portrait, 30 fps, 11.5 s; trimmed to 0.0-7.0 s (TikTok outro removed); comment overlay and watermark masked (ffmpeg delogo)',
      supplied: 'owner-supplied reference video, 2026-10-04',
      originalFootage: 'third-party TikTok (@mackeymcqui)',
    },
    licenseClass: THIRD_PARTY_APPROVED,
    credit: '@mackeymcqui (TikTok)',
    tool: 'Bannon tools/mocap/video_to_clip.py build_clip (unchanged retarget, 84 keys, smooth 5) fed by tools/mocap/getbackk: RTMO-l 2D tracking (rtmlib, Apache-2.0) + RTMW3D-x depth ordering + bone-length-constrained 3D lift',
  },
  {
    deliverer: 'CHAINSNATCHER', receiver: 'CHAINSNATCHER__RECV', bodies: 2, dir: 'chainsnatcher_capture',
    label: 'Chainsnatcher (jumping double-knee backbreaker / backstabber) — owner-supplied reference',
    sourceVideo: {
      file: 'CHAINSNATCHER_src.mp4',
      sha256: 'cc9ad43482b36e164b755be6a8c97156f001aaaba01430d81d1ef5ab2dd2b040',
      format: '576x1024 portrait, 30 fps, 7.8 s, one handheld low-angle shot of live indie wrestling; TikTok watermark masked (ffmpeg delogo, two positions); capture window 3.20-5.27 s',
      supplied: 'owner-supplied reference video, 2026-10-07',
      originalFootage: 'third-party TikTok (@thatjtawesome3)',
    },
    licenseClass: THIRD_PARTY_APPROVED,
    credit: '@thatjtawesome3 (TikTok)',
    tool: 'tools/mocap/chainsnatcher: the Getbackk RTMO-l + RTMW3D-x front end with a three-identity tracker (the referee is tracked and dropped), a FLAGGED constrained solve for the attacker\'s occluded landing, Bannon tools/mocap/video_to_clip.py build_clip (unchanged: key times, smoothing, pose{}) and engine_retarget.py for bones{}',
    extra: {
      boneConvention: 'bones{} are ABSOLUTE local rotations on public/models/BANNON_rigged.glb (the convention scripts/bake-fighter-animations.mjs reads for the Bannon bank: sourceRest = targetRest = bind), solved by tools/mocap/chainsnatcher/engine_retarget.py from the same joints build_clip keys on; build_clip\'s own camera-axis, rest-relative bones would play yawed 90 degrees with T-pose arms through this bake',
      cameraYaw: 'handheld camera orbits ~52 degrees during the take; one common yaw per frame (mean facing of both men, smoothed, held after the attacker\'s last tracked frame) is removed from BOTH bodies',
      labelFixes: 'receiver f149 (isolated between two gaps): left/right labels exchanged to agree with both tracked neighbours (lr_swap rule in the README)',
    },
  },
];

function ownerEntryFor(c, name, role, partner) {
  const file = `${name}.json`;
  const dir = join(OWNER_ROOT, c.dir);
  const src = JSON.parse(readFileSync(join(dir, file), 'utf8'));
  const report = JSON.parse(readFileSync(join(dir, 'capture_report.json'), 'utf8'))[name];
  const solved = report.solved_count > 0;
  const k0 = src.keys?.[0] ?? {};
  return {
    file,
    bytes: statSync(join(dir, file)).size,
    dur: src.dur,
    keys: src.keys?.length ?? 0,
    bones: Object.keys(k0.bones ?? {}).length,
    src: `${c.sourceVideo.supplied}; original footage: ${c.sourceVideo.originalFootage}`,
    via: 'video_to_clip/build_clip/two-body (RTMO+RTMW3D front end)',
    role,
    ...(partner ? { pairedWith: partner } : {}),
    coverFrac: report.coverFrac,
    lowCoverage: report.coverFrac < 0.45,
    bodies: c.bodies,
    label: c.label,
    provenance: {
      origin: 'AUTHORED_CAPTURE',
      repo: null,
      licenseClass: c.licenseClass,
      credit: c.credit,
      sourceVideo: c.sourceVideo,
      captureWindowSeconds: report.window_s,
      trackedFrames: `${report.tracked}/${report.total}`,
      interpolatedGaps: report.interpolated_gaps.map(([a, b, n]) => ({ fromFrame: a, toFrame: b, frames: n })),
      interpolationRule: 'linear, gaps of at most 6 frames only; longer gaps would have failed the capture',
      ...(solved ? {
        constrainedSolve: {
          fromFrame: report.solved_frames[0], toFrame: report.solved_frames[1], frames: report.solved_count,
          rule: 'NOT TRACKED: the body is occluded behind and under the partner; posed by a constrained solve (own bone lengths, last tracked pose -> canon end pose, landing frame measured from the partner). See the capture README.',
        },
      } : {}),
      tool: c.tool,
      ...(c.extra ?? {}),
      mixamo: false,
      synthetic: solved ? 'partial' : false,
    },
  };
}

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
for (const c of OWNER_CAPTURES) {
  for (const [name, role, partner] of [[c.deliverer, 'attacker', c.receiver], [c.receiver, 'receiver', null]]) {
    const from = join(OWNER_ROOT, c.dir, `${name}.json`);
    if (!existsSync(from)) throw new Error(`owner capture missing: ${from}`);
    const entry = ownerEntryFor(c, name, role, partner);
    if (!DRY) copyFileSync(from, join(DST_DIR, entry.file));
    if (!index[name]) added++;
    index[name] = entry;
    console.log(`${DRY ? '[dry] ' : ''}${name.padEnd(34)} ${role.padEnd(9)} dur=${entry.dur} bones=${entry.bones} (owner capture)`);
  }
}
if (!DRY) writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n');
console.log(`${added} new source clips; index now ${Object.keys(index).length}`);
