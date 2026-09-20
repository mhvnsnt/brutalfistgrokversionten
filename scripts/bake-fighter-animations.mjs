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
  removeConstantConventionTwist,
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
 * Above this PEAK lift, both feet have left the floor and the clip is a jump,
 * a dive or a throw — something that is airborne on purpose and must not be
 * dragged back down.
 *
 * The lift tracked is the LOWEST foot's, so a high kick does not trip this —
 * the support foot stays down. It only rises when BOTH feet leave the floor,
 * which is the definition being reached for. 50 cm is well above any
 * standing move (the idle peaks at 23 cm, a jab at 32) and well below a jump.
 */
const AIRBORNE_PEAK_M = Number(process.env.BF_AIRBORNE_M ?? 0.5);

/**
 * The most the grounding offset may move a body, in metres.
 *
 * A fighter is 1.85 m. No legitimate grounding correction is a large
 * fraction of that, so anything past this is not a grounding problem — it is
 * a clip whose pose is wrong in some other way, and dropping the body a
 * metre and a half to "plant" it buries the fighter and hides the real
 * defect. MEASURED: GUARD_HIGH asked for -1.453 m.
 *
 * Clips that hit the cap are counted and named, not silently smeared.
 */
const MAX_GROUND_SHIFT_M = 0.6;
const MEDIANS = [];
/** Names given in BF_GROUND_DEBUG get their raw floor measurement printed. */
const DEBUG_GROUND = new Set((process.env.BF_GROUND_DEBUG ?? '').split(',').filter(Boolean));

/**
 * ONE CONSTANT vertical offset that puts this clip's feet on the floor.
 *
 * THIS IS NOT THE OLD FLOOR LOCK AND MUST NOT BECOME IT AGAIN. The earlier
 * version emitted a DIFFERENT pelvis height at every key, which translated
 * the whole root while the authored knees and feet were already solving the
 * gait — two systems moving the same body, which is what produced the
 * leaning, sliding legs. It was removed for that reason, and removing it was
 * right about the mechanism and wrong about the remedy: MEASURED with no
 * offset at all, STANCE floats 23.3 cm, GRAFQUICKJAB 31.9 cm and every
 * combat slot 18-32 cm, so nobody's feet touch the ground.
 *
 * A CONSTANT offset has neither problem. The clip is authored at the wrong
 * height; moving it once fixes the height and leaves every frame's relative
 * motion — the bob, the weight shift, the step — exactly as authored. It is
 * the offline equivalent of authoring the clip on the floor in the first
 * place, and it is a single key, so the runtime's constant-translation rule
 * (see BakedMotionBank) keeps it while still rejecting per-frame chasing.
 *
 * WHICH CONSTANT: the clip's MINIMUM lift, so the lowest the foot ever gets
 * is exactly the floor. Using the mean or the max would bury the low frames
 * in the mat. A negative minimum (a foot already through the floor) raises
 * the clip by the same rule, in the same direction.
 *
 * An AIRBORNE clip is only ever LOWERED: a victim dips below the floor at
 * the instant of a slam and that is the animation doing its job; raising the
 * whole throw to accommodate one frame would leave it hovering.
 */
function groundingOffset(clip) {
  // DENSER THAN THE KEYS, still: the minimum has to be the true minimum of
  // the motion, not of the sparse keys, or a clip dips through the mat
  // between two samples.
  const times = new Set([0]);
  for (const track of clip.tracks) for (const t of track.times) times.add(t);
  const dur = clip.duration || 0;
  const steps = Math.min(240, Math.max(24, Math.round(dur * 60)));
  for (let i = 0; i <= steps; i++) times.add((dur * i) / steps);
  const sorted = [...times].sort((a, b) => a - b);
  // RESET TO BIND ONCE, BEFORE THE MIXER EXISTS — never between samples.
  //
  // THE BUG THIS REPLACES, AND IT WAS SILENT. restPose() writes bone
  // quaternions directly, behind the mixer's back. three.js PropertyMixer
  // .apply() keeps a copy of what it last wrote and SKIPS binding.setValue
  // when the new accumulated value matches it — so on any sample where the
  // clip's value happened to equal the previous sample's, the mixer wrote
  // nothing and the measurement read the bind pose I had just forced.
  // MEASURED on QUICKKICK: samples 1-4 came back at exactly 0.0000 lift,
  // which is bind by definition, and that false zero became the clip's
  // minimum — so its grounding offset was computed as 0 and the clip shipped
  // floating 19 cm in the air while the bake reported it planted.
  //
  // A fresh mixer per clip is what stops one clip inheriting another's
  // bones; resetting mid-sample was never what did that.
  restPose();
  const sampler = new THREE.AnimationMixer(skeleton.root);
  const action = sampler.clipAction(clip);
  action.play();

  const lift = [];
  for (const t of sorted) {
    sampler.setTime(t);
    skeleton.root.updateMatrixWorld(true);
    lift.push(lowestFootY() - BIND_FLOOR);
  }
  sampler.stopAllAction();
  sampler.uncacheClip(clip);
  restPose();

  if (DEBUG_GROUND.has(clip.name)) {
    console.log(`  [lift] ${clip.name} first8=${lift.slice(0, 8).map((v) => v.toFixed(4)).join(' ')}`);
  }
  if (!lift.length || lift.some((v) => !Number.isFinite(v))) return null;
  MEDIANS.push([clip.name, Math.max(...lift)]);

  // The VERDICT is returned even when no offset is needed. An airborne clip
  // that happens to touch the floor at one frame needs no correction, and
  // returning null for it used to lose the verdict too — so it was recorded
  // as a grounded clip, and every audit then judged a jump as a failed
  // stance. Measured: BIG_BODY_BLOW at 161 cm, filed as "meant to be on the
  // floor".
  const airborne = Math.max(...lift) > AIRBORNE_PEAK_M;
  const minLift = Math.min(...lift);
  const raw = airborne ? Math.min(0, -minLift) : -minLift;
  const capped = Math.abs(raw) > MAX_GROUND_SHIFT_M;
  const offset = Math.max(-MAX_GROUND_SHIFT_M, Math.min(MAX_GROUND_SHIFT_M, raw));
  return {
    airborne,
    capped,
    offset,
    minLift,
    maxLift: Math.max(...lift),
    // HOW CLOSE THIS CLIP EVER GETS TO THE FLOOR once the offset is applied.
    // Zero for anything the offset could fix; what is LEFT for a clip whose
    // correction hit the cap. It is the number that says "this pose cannot
    // stand on the ground", and nothing else in the pipeline can express that
    // — peakDeg says a clip HOLDS a pose, not that the pose has feet on the
    // floor. STANCE_WIDE passes peakDeg at 10 deg and sits 107 cm in the air.
    floorGap: +(minLift + offset).toFixed(4),
    applied: Math.abs(offset) >= 1e-5,
  };
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
  conventionTwistCorrections: 0,
  limitCorrections: 0,
  spineRedistributed: 0,
  grounded: 0,
  groundedTotal: 0,
  airborne: 0,
  cappedShift: 0,
  cappedClips: [],
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

  // Remove a measured, near-constant thigh roll before anatomical limits.
  // The Bannon bank contains a ~180° axial convention offset on the upper legs
  // in many clips. Clamping that offset as if it were authored motion turns the
  // thighs sideways; normalize the convention first, then constrain true motion.
  const conventionTwists = removeConstantConventionTwist(relative, bind);
  report.conventionTwistCorrections += conventionTwists.length;

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

  // Measure the clip against the canonical floor. The correction is ONE
  // constant key, never a per-frame track — see groundingOffset for why the
  // per-frame version had to go and why removing it outright was not the fix.
  const ground = groundingOffset(relative);
  if (DEBUG_GROUND.has(src.name)) {
    console.log(`  [ground] ${src.name} min=${(ground?.minLift ?? NaN).toFixed(4)} max=${(ground?.maxLift ?? NaN).toFixed(4)} offset=${(ground?.offset ?? 0).toFixed(4)} airborne=${ground?.airborne}`);
  }
  const clipAirborne = Boolean(ground?.airborne);
  if (clipAirborne) report.airborne++;
  if (ground?.capped) {
    report.cappedShift++;
    report.cappedClips.push(src.name);
  }
  if (ground?.applied) {
    report.grounded++;
    report.groundedTotal += Math.abs(ground.offset);
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

  // PUT THE CLIP ON THE FLOOR — once, as a single key. Applied ON TOP of any
  // pelvis translation the clip already authored (a wide stance sits lower on
  // purpose), never instead of it; if that authored track is itself variable
  // the runtime drops the pair and we are no worse off than with no offset.
  if (ground?.applied) {
    const existing = positions[HIPS];
    const baseX = existing ? existing.p[0] : round(hipsBindPosition.x);
    const baseY = existing ? existing.p[1] : round(hipsBindPosition.y);
    const baseZ = existing ? existing.p[2] : round(hipsBindPosition.z);
    positions[HIPS] = { t: [0], p: [baseX, round(baseY + ground.offset), baseZ] };
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
      airborne: clipAirborne,
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
    airborne: clipAirborne,
    floorGap: ground?.floorGap ?? 0,
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
console.log(`  convention twist    ${report.conventionTwistCorrections} track(s)`);
console.log(`  limit corrections    ${report.limitCorrections} track(s)`);
console.log(`  combat slots owned   ${report.slotOwners ?? 0}`);
console.log(`  planted on the floor ${report.grounded} clip(s) moved, avg shift ${
  report.grounded ? ((report.groundedTotal / report.grounded) * 100).toFixed(1) : '0'} cm (ONE constant key each)`);
if (process.env.BF_MEDIANS) {
  const sorted = MEDIANS.map(([, m]) => m).sort((a, b) => a - b);
  const q = (f) => (sorted[Math.floor(sorted.length * f)] * 100).toFixed(1);
  console.log(`  peak-lift distribution (cm): p10 ${q(0.1)}  p25 ${q(0.25)}  p50 ${q(0.5)}  p75 ${q(0.75)}  p90 ${q(0.9)}  max ${(sorted[sorted.length-1]*100).toFixed(1)}`);
}
console.log(`  kept airborne        ${report.airborne} clip(s) (peak lift over ${AIRBORNE_PEAK_M * 100} cm)`);
// NAME THE CLIPS THAT STILL HOVER. A clip the offset could not bring down is
// not a grounding problem, it is a pose authored at the wrong height, and it
// must not quietly become somebody's stance — the runtime refuses it, and
// this is where the source fix gets its target list.
const stillHovering = Object.entries(manifest)
  .filter(([, m]) => (m.floorGap ?? 0) > 0.08)
  .sort((a, b) => b[1].floorGap - a[1].floorGap);
if (stillHovering.length) {
  console.log(`  NEVER REACH THE MAT  ${stillHovering.length} clip(s) — pose authored at the wrong height, refused as stances`);
  console.log('    ' + stillHovering.slice(0, 8).map(([n, m]) => `${n} ${(m.floorGap * 100).toFixed(0)}cm`).join(', '));
}
if (report.cappedShift > 0) {
  console.log(`  SHIFT CAPPED         ${report.cappedShift} clip(s) asked for more than ${MAX_GROUND_SHIFT_M * 100} cm — their pose is wrong for another reason`);
  console.log(`    ${report.cappedClips.slice(0, 8).join(', ')}`);
}
console.log(`  on disk              ${(bytes / 1e6).toFixed(1)} MB`);
for (const s of report.skipped.slice(0, 8)) console.log(`    skipped ${s.name}: ${s.why}`);

if (gate && report.baked === 0) {
  console.error('FAILED: nothing baked.');
  process.exit(1);
}
