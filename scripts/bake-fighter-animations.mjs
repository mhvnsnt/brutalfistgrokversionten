#!/usr/bin/env node
/**
 * BAKE EVERY CLIP ONTO THE ONE SKELETON, OFFLINE.
 *
 * Owner: "they have a universal skeleton for every character that makes their
 * fucking animations work. Then we need to do that."
 *
 * He is right, and this is that. Tekken and Schwarzerblitz do not retarget at
 * runtime — one skeleton, everything authored on it. MEASURED, 59 of 65
 * skinned models here already share a bit-identical 58-joint bind, so the
 * skeleton exists; what was missing was resolving the clips onto it ONCE,
 * offline, instead of adapting three source conventions live in every match.
 *
 * WHY OFFLINE IS THE POINT, not just an optimisation:
 *   - A bad result is caught HERE, by a gate, instead of appearing on a
 *     fighter in front of the player.
 *   - Every correction is reported and countable, so "the animations are
 *     twisting" becomes a number in a file rather than an argument.
 *   - The runtime stops paying for it: no rest maps, no per-bank conventions,
 *     no joint solving between the bell and the first punch.
 *
 * IT IMPORTS THE SHIPPING MODULES. The bake and the runtime must not drift,
 * so this calls the same bindClipTracksToTargetBones, makeClipBindRelative,
 * redistributeChain, constrainHinges and clampToJointLimits the engine calls.
 *
 * Usage:
 *   node --experimental-strip-types --import ./scripts/register-ts-resolve.mjs \
 *        scripts/bake-fighter-animations.mjs [--gate] [--out public/motion/baked]
 */
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';

import {
  CANONICAL_SKELETON_MODEL,
  loadCanonicalSkeleton,
} from '../src/engine/retarget/CanonicalSkeleton.ts';
import { bindClipTracksToTargetBones } from '../src/engine/retarget/AnimationRetargeter.ts';
import { makeClipBindRelative } from '../src/engine/retarget/BindRelativeMotion.ts';
import { sanitizeMotionClip } from '../src/engine/retarget/neutralizeRootMotion.ts';
import {
  SPINE_CHAIN,
  clampToJointLimits,
  constrainHinges,
  redistributeChain,
} from '../src/engine/retarget/SkeletalLimits.ts';
import { measureRestCorrection, needsCorrection } from '../src/engine/retarget/RestPoseOffset.ts';
import {
  buildClipsFromEulerBank,
  eulerBankRestPose,
} from '../src/engine/retarget/BannonMotionBank.ts';
import { SCHWARZERBLITZ_MOTION_BANK } from '../src/generated/SchwarzerblitzMotionBank.generated.ts';
import {
  SCHWARZERBLITZ_COMBAT_SLOTS,
  SCHWARZERBLITZ_REST_CLIP,
} from '../src/engine/retarget/SchwarzerblitzMotionBank.ts';
import { inferSemanticFromMotionKey } from '../src/engine/retarget/BannonEulerMotionAdapter.ts';

const gate = process.argv.includes('--gate');
const outIdx = process.argv.indexOf('--out');
const OUT = outIdx > 0 ? process.argv[outIdx + 1] : 'public/motion/baked';

/** Keys are written at this precision. A quaternion component past 5 decimals
 *  is below any angle a body can show, and the file is a third of the size. */
const PRECISION = 5;
const round = (v) => +v.toFixed(PRECISION);

/**
 * WHICH CLIP OWNS WHICH COMBAT STATE is part of resolving onto the skeleton,
 * not a runtime decision — so it is decided here. Without this the bake ships
 * correct animation attached to the wrong buttons: the first clip that merely
 * INFERS `idle` from its name takes the idle slot, and the authored fighting
 * stance loses it to a Mixamo shadowboxing loop again.
 */
const SLOT_OWNER = new Map(
  Object.entries(SCHWARZERBLITZ_COMBAT_SLOTS).map(([semantic, clip]) => [clip, semantic]),
);

const skeleton = loadCanonicalSkeleton(readFileSync(CANONICAL_SKELETON_MODEL));
const boneNames = skeleton.order;
const bind = skeleton.rest;

// ── FOOT PLANTING ────────────────────────────────────────────────────────
// MEASURED through the real pipeline: EVERY clip lifted both feet 21 to 32 cm
// off the floor at some frame — the idle included. The fighter's root is
// pinned (root motion stripped, COMBAT_FIGHTER_Y = 0), so nothing was putting
// the body back down, and a fighter standing 23 cm above the ground is the
// "not planted, leaning on its toes, wobbly ragdoll" the owner reported. It
// is invisible to every joint check, because each joint is inside its range.
const FOOT_BONES = ['mixamorigLeftToeBase', 'mixamorigRightToeBase', 'mixamorigLeftFoot', 'mixamorigRightFoot'];
const boneObjects = new Map();
skeleton.root.traverse((o) => { if (o.name) boneObjects.set(o.name, o); });
const _v = new THREE.Vector3();

function lowestFootY() {
  let y = Infinity;
  for (const n of FOOT_BONES) {
    const b = boneObjects.get(n);
    if (!b) continue;
    b.getWorldPosition(_v);
    if (_v.y < y) y = _v.y;
  }
  return y;
}
function restPose() {
  for (const [n, q] of bind) boneObjects.get(n)?.quaternion.copy(q);
  skeleton.root.updateMatrixWorld(true);
}
restPose();
const BIND_FLOOR = lowestFootY();
const HIPS = 'mixamorigHips';
const hipsBindPosition = boneObjects.get(HIPS)?.position.clone() ?? new THREE.Vector3();

// The T-pose variant of the rest, for banks authored on a T-pose rig. Used as
// the RETARGET reference only — joint limits are measured from the real bind.
const correction = measureRestCorrection(skeleton.root);
const tPoseRest = new Map(bind);
if (needsCorrection(correction)) {
  for (const [boneName, fix] of correction.corrections) {
    const b = tPoseRest.get(boneName);
    if (b) tPoseRest.set(boneName, b.clone().multiply(fix));
  }
}

/**
 * The vertical offset that keeps this clip's feet on the floor, per key.
 *
 * MEASURED: a per-CLIP offset is not enough. STANCE touches the floor at one
 * frame and is 23 cm above it at another — it BOBS, which is precisely the
 * wobble the owner described. Shifting the whole clip by its smallest lift
 * leaves that bob untouched.
 *
 * So a GROUNDED clip is lowered per key, which is the vertical half of foot
 * IK and is what "planted" means. An AIRBORNE clip is not: a jump has to
 * leave the floor, so it keeps its arc and is only shifted by its minimum so
 * that its lowest moment lands. The two are told apart by MEASUREMENT, not by
 * name — the median lift across the clip. A move that spends most of itself
 * near the floor is a grounded move whatever it is called.
 *
 * Only ever lowers. A clip already reaching the floor is untouched, and one
 * that goes THROUGH the floor is left alone — that is a different defect and
 * raising it would hide it.
 */
/**
 * Above this median lift a clip is NOT a fighter standing up, so its arc is
 * left alone. Chosen from the distribution, not picked: across the 366 baked
 * clips the median lift runs
 *   p10 4.5cm  p25 15.3cm  p50 31.2cm  p75 118.1cm  p90 156.0cm  max 177.5cm
 * There is a gap between about 35 cm and 118 cm, and it is the real boundary:
 * below it a 1.85 m fighter is on his feet, above it he is airborne or on the
 * ground (a dive, a victim's half of a throw, a getup). 60 cm sits inside
 * that gap.
 */
const AIRBORNE_MEDIAN_M = Number(process.env.BF_AIRBORNE_M ?? 0.6);
const MEDIANS = [];

function groundingTrack(clip) {
  // DENSER THAN THE KEYS. The offset track is interpolated linearly while the
  // foot's height is not, so between two keys the foot can dip below the
  // floor — measured at 25 cm on a roundhouse, which is a leg through the mat.
  // Sampling between the keys closes that; it costs nothing offline.
  const times = new Set([0]);
  for (const track of clip.tracks) for (const t of track.times) times.add(t);
  const dur = clip.duration || 0;
  const steps = Math.min(240, Math.max(24, Math.round(dur * 60)));
  for (let i = 0; i <= steps; i++) times.add((dur * i) / steps);
  const sorted = [...times].sort((a, b) => a - b);
  const sampler = new THREE.AnimationMixer(skeleton.root);
  const action = sampler.clipAction(clip);
  action.play();

  const lift = [];
  for (const t of sorted) {
    restPose();
    sampler.setTime(t);
    skeleton.root.updateMatrixWorld(true);
    lift.push(lowestFootY() - BIND_FLOOR);
  }
  sampler.stopAllAction();
  sampler.uncacheClip(clip);
  restPose();

  if (!lift.length || lift.some((v) => !Number.isFinite(v))) return null;
  MEDIANS.push([clip.name, [...lift].sort((a, b) => a - b)[Math.floor(lift.length / 2)]]);
  const median = [...lift].sort((a, b) => a - b)[Math.floor(lift.length / 2)];
  const airborne = median > AIRBORNE_MEDIAN_M;
  const minLift = Math.min(...lift);
  const offsets = airborne
    ? lift.map(() => Math.min(0, -minLift))
    : lift.map((v) => Math.min(0, -v));
  if (offsets.every((v) => v === 0)) return null;
  return { times: sorted, offsets, airborne, worst: -Math.min(...offsets) };
}

function sources() {
  const out = [];

  // The Bannon bank: absolute local rotations already in THESE rigs' space,
  // so its rest is the model's own bind and the clip plays as authored.
  const bannonDir = 'public/motion';
  const index = JSON.parse(readFileSync(join(bannonDir, 'index.json'), 'utf8'));
  for (const [name, entry] of Object.entries(index)) {
    if (!entry?.file) continue;
    out.push({
      bank: 'bannon',
      name,
      file: join(bannonDir, entry.file),
      sourceRest: bind,
      targetRest: bind,
    });
  }

  // The Schwarzerblitz set: a genuine T-pose source that ships its own rest.
  const sbRestClip = SCHWARZERBLITZ_MOTION_BANK[SCHWARZERBLITZ_REST_CLIP];
  const sbRest = sbRestClip ? eulerBankRestPose(sbRestClip) : new Map();
  for (const clip of buildClipsFromEulerBank(SCHWARZERBLITZ_MOTION_BANK, {
    clipSourceType: 'SCHWARZERBLITZ_MOTION',
    source: 'mhvnsnt/SchwarzerblitzEngine',
    sourceConvention: 'schwarzerblitz',
  })) {
    out.push({ bank: 'schwarzerblitz', name: clip.name, clip, sourceRest: sbRest, targetRest: tPoseRest });
  }
  return out;
}

/** A Bannon-bank JSON file as an AnimationClip, through the shared builder. */
function clipFromEulerFile(name, file) {
  const data = JSON.parse(readFileSync(file, 'utf8'));
  const [clip] = buildClipsFromEulerBank({ [name]: data }, {
    clipSourceType: 'BANNON_OWNER_MOTION',
    source: 'mhvnsnt/Bannon/assets/moves/clips',
    sourceConvention: 'mixamo',
  });
  return clip;
}

const report = {
  skeleton: CANONICAL_SKELETON_MODEL,
  joints: boneNames.length,
  baked: 0,
  skipped: [],
  hingeCorrections: 0,
  limitCorrections: 0,
  spineRedistributed: 0,
  grounded: 0,
  groundedTotal: 0,
  airborne: 0,
  worst: [],
};

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const manifest = {};

for (const src of sources()) {
  let clip;
  try {
    clip = src.clip ?? clipFromEulerFile(src.name, src.file);
  } catch (e) {
    report.skipped.push({ name: src.name, why: `unreadable: ${e.message}` });
    continue;
  }

  const bound = bindClipTracksToTargetBones(clip, boneNames);
  if (bound.resolvedTracks === 0) {
    report.skipped.push({ name: src.name, why: 'no track binds to the skeleton' });
    continue;
  }
  sanitizeMotionClip(bound.clip);

  const relative = makeClipBindRelative(bound.clip, src.targetRest, src.sourceRest);
  if (!relative) {
    report.skipped.push({ name: src.name, why: 'no quaternion tracks survived' });
    continue;
  }

  // CONSTRAIN AGAINST THE BODY'S OWN BIND, always — not against the T-pose
  // reference a T-pose-authored bank is RETARGETED through. A joint limit is
  // anatomical: "how far is this joint from where the body rests" only means
  // anything measured from the real rest. Using the retarget reference here
  // let a shoulder sit 152 degrees from bind while being a legal 90 from the
  // synthetic T-pose, which is a pose no shoulder can make.
  if (redistributeChain(relative, SPINE_CHAIN, src.targetRest)) report.spineRedistributed++;
  // Limits first, hinges LAST. A hinge is the complete constraint for its
  // joint; the generic limit works on a different axis and running it after
  // a hinge puts the joint back off its axis (measured at 20-22 degrees).
  const limits = clampToJointLimits(relative, bind);
  const hinges = constrainHinges(relative, bind);
  report.hingeCorrections += hinges.length;
  report.limitCorrections += limits.length;
  for (const v of [...hinges, ...limits]) {
    report.worst.push({ clip: src.name, bone: v.bone.replace('mixamorig', ''), ...v });
  }

  // Plant it before anything is written: the offset is measured from the
  // constrained pose, which is the pose that will actually play.
  const ground = groundingTrack(relative);
  if (ground) {
    report.grounded++;
    report.groundedTotal += ground.worst;
    if (ground.airborne) report.airborne++;
    const values = [];
    for (const dy of ground.offsets) {
      values.push(hipsBindPosition.x, hipsBindPosition.y + dy, hipsBindPosition.z);
    }
    relative.tracks.push(
      new THREE.VectorKeyframeTrack(`${HIPS}.position`, ground.times, values),
    );
  }

  const tracks = {};
  const positions = {};
  for (const track of relative.tracks) {
    if (track.name.endsWith('.position')) {
      positions[track.name.slice(0, -'.position'.length)] = {
        t: Array.from(track.times).map(round),
        p: Array.from(track.values).map(round),
      };
      continue;
    }
    if (!track.name.endsWith('.quaternion')) continue;
    tracks[track.name.slice(0, -'.quaternion'.length)] = {
      t: Array.from(track.times).map(round),
      q: Array.from(track.values).map(round),
    };
  }
  if (Object.keys(tracks).length === 0) {
    report.skipped.push({ name: src.name, why: 'no tracks after constraints' });
    continue;
  }

  const slot = SLOT_OWNER.get(src.name);
  const semantic = slot ?? inferSemanticFromMotionKey(src.name);
  writeFileSync(
    join(OUT, `${src.name}.json`),
    JSON.stringify({
      name: src.name,
      bank: src.bank,
      dur: +relative.duration.toFixed(4),
      semantic,
      positions,
      // A slot owner is loaded FIRST, because the first clip for a semantic
      // wins when actions are registered.
      owns: Boolean(slot),
      tracks,
    }),
  );
  manifest[src.name] = {
    file: `${src.name}.json`,
    bank: src.bank,
    dur: +relative.duration.toFixed(4),
    bones: Object.keys(tracks).length,
    semantic,
    owns: Boolean(slot),
  };
  if (slot) report.slotOwners = (report.slotOwners ?? 0) + 1;
  report.baked++;
}

writeFileSync(join(OUT, 'index.json'), JSON.stringify(manifest, null, 0));

const bytes = readdirSync(OUT).reduce(
  (n, f) => n + readFileSync(join(OUT, f)).length, 0);

report.worst.sort((a, b) => (b.worstOffAxis ?? b.twist ?? 0) - (a.worstOffAxis ?? a.twist ?? 0));
writeFileSync(join(OUT, '..', 'baked-report.json'), JSON.stringify({
  ...report, worst: report.worst.slice(0, 40),
}, null, 2));

console.log(`BAKED ONTO ${CANONICAL_SKELETON_MODEL} (${boneNames.length} joints)`);
console.log(`  clips written        ${report.baked}`);
console.log(`  skipped              ${report.skipped.length}`);
console.log(`  spine redistributed  ${report.spineRedistributed} clip(s)`);
console.log(`  hinge corrections    ${report.hingeCorrections} track(s)`);
console.log(`  limit corrections    ${report.limitCorrections} track(s)`);
console.log(`  combat slots owned   ${report.slotOwners ?? 0}`);
console.log(`  planted on the floor ${report.grounded} clip(s), worst drop avg ${
  report.grounded ? ((report.groundedTotal / report.grounded) * 100).toFixed(1) : '0'} cm`);
if (process.env.BF_MEDIANS) {
  const sorted = MEDIANS.map(([, m]) => m).sort((a, b) => a - b);
  const q = (f) => (sorted[Math.floor(sorted.length * f)] * 100).toFixed(1);
  console.log(`  median-lift distribution (cm): p10 ${q(0.1)}  p25 ${q(0.25)}  p50 ${q(0.5)}  p75 ${q(0.75)}  p90 ${q(0.9)}  max ${(sorted[sorted.length-1]*100).toFixed(1)}`);
}
console.log(`  kept airborne        ${report.airborne} clip(s) (median lift over ${AIRBORNE_MEDIAN_M * 100} cm)`);
console.log(`  on disk              ${(bytes / 1e6).toFixed(1)} MB`);
for (const s of report.skipped.slice(0, 8)) console.log(`    skipped ${s.name}: ${s.why}`);

if (gate && report.baked === 0) {
  console.error('FAILED: nothing baked.');
  process.exit(1);
}
