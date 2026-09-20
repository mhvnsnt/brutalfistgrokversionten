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
/**
 * Is the body shaped like a standing human right now?
 *
 * Deliberately crude and deliberately structural: three facts that are true
 * of every standing pose and false of a folded or inverted one. Nothing here
 * looks at a clip's NAME.
 */
function measurePosture() {
  const head = boneObjects.get('mixamorigHead');
  const hips = boneObjects.get(HIPS);
  if (!head || !hips) return null;
  const h = new THREE.Vector3();
  const p = new THREE.Vector3();
  head.getWorldPosition(h);
  hips.getWorldPosition(p);
  const foot = lowestFootY();
  // WHICH WAY IS THE SPINE POINTING, as a unit vector's Y component. +1 is
  // straight up, 0 is lying flat, -1 is upside down. Taken over the WHOLE
  // clip it separates a convention error (inverted the whole way through)
  // from authored motion (a body that inverts during a move and comes back).
  const spine = h.clone().sub(p);
  const spineUp = spine.lengthSq() > 1e-9 ? spine.normalize().y : 0;
  // WHICH WAY DOES THE LEG HANG? hips -> foot as a unit vector's Y. -1 is a
  // leg hanging straight down, which is what a standing body does. A POSITIVE
  // value means the foot is above the pelvis: the leg is folded up over the
  // torso, which is the defect that reads as "feet above the head" while the
  // spine measures perfectly upright.
  // WHERE ARE THE HANDS RELATIVE TO THE SHOULDERS?
  //
  // TWO AXES, BECAUSE ONE IS NOT ENOUGH AND MY FIRST VERSION USED THE WRONG
  // ONE. This roster faces +X, so a T-pose extends the arms along ±Z and a
  // fighting guard brings them FORWARD along X. Measuring |x| alone scored
  // the real STANCE at 0.62 and the starfish at 0.09 — a usable signal,
  // pointing the opposite way to its name.
  //   armForward  hands out in front, which is what a guard is.
  //   armSpread   hands straight out to the sides and level, which is a
  //               T-pose and is what the owner means by "a starfish".
  let armForward = 0;
  let armSpread = 0;
  let armCount = 0;
  const sh = new THREE.Vector3();
  const hd = new THREE.Vector3();
  for (const [shoulder, hand] of [
    ['mixamorigLeftArm', 'mixamorigLeftHand'],
    ['mixamorigRightArm', 'mixamorigRightHand'],
  ]) {
    const a = boneObjects.get(shoulder);
    const b = boneObjects.get(hand);
    if (!a || !b) continue;
    a.getWorldPosition(sh);
    b.getWorldPosition(hd);
    const arm = hd.clone().sub(sh);
    if (arm.lengthSq() < 1e-9) continue;
    arm.normalize();
    // Sideways share of a level arm: big when the arm is out and flat.
    armForward += Math.abs(arm.x) * (1 - Math.abs(arm.y));
    armSpread += Math.abs(arm.z) * (1 - Math.abs(arm.y));
    armCount++;
  }
  if (armCount) { armForward /= armCount; armSpread /= armCount; }

  let legDown = 0;
  const lf = boneObjects.get('mixamorigLeftFoot');
  const rf = boneObjects.get('mixamorigRightFoot');
  const fp = new THREE.Vector3();
  let n = 0;
  for (const f of [lf, rf]) {
    if (!f) continue;
    f.getWorldPosition(fp);
    const leg = fp.clone().sub(p);
    if (leg.lengthSq() > 1e-9) { legDown += leg.normalize().y; n++; }
  }
  if (n) legDown /= n;
  return {
    spineUp,
    armForward,
    armSpread,
    legDown,
    /** A standing body carries its head above its pelvis. */
    headAboveHips: h.y - p.y,
    /** ...and its feet below it. */
    hipsAboveFeet: p.y - foot,
    /** ...and stands roughly as tall as it is built. */
    height: h.y - foot,
  };
}

/**
 * THE LEGS ARE ON UPSIDE DOWN.
 *
 * MEASURED across the whole bake, as the Y component of the hips->foot
 * direction: a healthy clip hangs its legs at median -0.75, and all 55 clips
 * that could never reach the floor sit at +0.55 to +0.97. Their SPINES
 * measure 0.99-1.00 upright, so the body is standing correctly and the
 * thighs are folded up over it — which is why "the pose is authored too
 * high" looked true and was not. The lowest foot was a metre up because the
 * feet were near the head.
 *
 * This is the same family as the thigh convention twist already removed
 * elsewhere in this bake, and it is the part that pass cannot reach: that one
 * strips a constant axial ROLL about the bone, which leaves the direction
 * alone. This is a flip of the direction itself.
 *
 * THE CORRECTION IS CHOSEN BY MEASUREMENT, NEVER BY REASONING ABOUT THE
 * CONVENTION. There are four plausible ways to express "flip this bone" — a
 * half turn about X or about Z, applied in the parent's space or the bone's
 * own — and which one a given source rig needs depends on how it was
 * authored. So all four are tried, the legs are re-measured after each, and
 * the one that actually puts the feet under the body wins. If none does, the
 * clip is left exactly as it was and named in the report; a correction that
 * does not improve the number is not applied on faith.
 */
const LEG_UP_THRESHOLD = 0.2;
/** Above this the torso is standing, so feet above the pelvis is impossible. */
const SPINE_UPRIGHT_MIN = 0.7;

/** Median over the clip of a posture field, sampled through the real mixer. */
function measurePostureMedian(clip, field) {
  const dur = clip.duration || 0;
  const steps = Math.min(48, Math.max(8, Math.round(dur * 20)));
  restPose();
  const sampler = new THREE.AnimationMixer(skeleton.root);
  const action = sampler.clipAction(clip);
  action.play();
  const values = [];
  for (let i = 0; i <= steps; i++) {
    sampler.setTime((dur * i) / steps);
    skeleton.root.updateMatrixWorld(true);
    const posture = measurePosture();
    if (posture) values.push(posture[field]);
  }
  sampler.stopAllAction();
  sampler.uncacheClip(clip);
  restPose();
  if (!values.length) return 0;
  values.sort((a, b) => a - b);
  return values[Math.floor(values.length / 2)];
}

const THIGHS = ['mixamorigLeftUpLeg', 'mixamorigRightUpLeg'];

function applyThighFlip(clip, axis, side) {
  const flip = new THREE.Quaternion().setFromAxisAngle(
    axis === 'x' ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1),
    Math.PI,
  );
  const q = new THREE.Quaternion();
  for (const track of clip.tracks) {
    if (!track.name.endsWith('.quaternion')) continue;
    const bone = track.name.slice(0, -'.quaternion'.length);
    if (!THIGHS.includes(bone)) continue;
    for (let i = 0; i + 3 < track.values.length; i += 4) {
      q.set(track.values[i], track.values[i + 1], track.values[i + 2], track.values[i + 3]);
      if (side === 'parent') q.premultiply(flip); else q.multiply(flip);
      q.normalize();
      track.values[i] = q.x; track.values[i + 1] = q.y;
      track.values[i + 2] = q.z; track.values[i + 3] = q.w;
    }
  }
}

function correctInvertedLegs(clip) {
  const before = measurePostureMedian(clip, 'legDown');
  if (before <= LEG_UP_THRESHOLD) return null;
  // LEGS UP IS ONLY IMPOSSIBLE IF THE BODY IS STANDING. A suplex victim, a
  // takedown victim and anyone mid-throw legitimately has their legs over
  // their head, and flipping those would break correct animation to fix a
  // measurement. The test that separates them is the SPINE: a torso that is
  // upright while the feet are above the pelvis is a pose no body can make.
  // Anything else is left exactly as authored.
  const spine = measurePostureMedian(clip, 'spineUp');
  if (spine < SPINE_UPRIGHT_MIN) return null;
  let best = null;
  for (const axis of ['x', 'z']) {
    for (const side of ['parent', 'local']) {
      const trial = clip.clone();
      applyThighFlip(trial, axis, side);
      const after = measurePostureMedian(trial, 'legDown');
      if (!best || after < best.after) best = { axis, side, after };
    }
  }
  // Only accept a correction that actually puts the legs underneath the body.
  if (!best || best.after >= before || best.after > -0.2) return { before, rejected: true, best };
  applyThighFlip(clip, best.axis, best.side);
  return { before, after: best.after, axis: best.axis, side: best.side };
}

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
  const postures = [];
  for (const t of sorted) {
    sampler.setTime(t);
    skeleton.root.updateMatrixWorld(true);
    lift.push(lowestFootY() - BIND_FLOOR);
    // WHILE THE CLIP IS STILL POSING THE BODY — not after. My first version
    // took this after stopAllAction()/restPose() and every one of the 55
    // hovering clips reported the IDENTICAL posture, which is the bind pose
    // and the same measurement trap as the sampler bug above. Identical
    // numbers across different inputs is never a finding.
    postures.push(measurePosture());
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
  // The frame where the body is CLOSEST to standing on the floor is the one
  // that decides whether the pose is sound: if it is not human-shaped there,
  // it is not human-shaped anywhere useful.
  const posture = postures[lift.indexOf(minLift)] ?? null;
  // The MEDIAN over every sample, not one frame. A clip that is upside down
  // from end to end has a convention problem; one that dips and recovers is
  // doing its job.
  const ups = postures.filter(Boolean).map((x) => x.spineUp).sort((a, b) => a - b);
  const legs = postures.filter(Boolean).map((x) => x.legDown).sort((a, b) => a - b);
  const arms = postures.filter(Boolean).map((x) => x.armForward).sort((a, b) => a - b);
  const spread = postures.filter(Boolean).map((x) => x.armSpread).sort((a, b) => a - b);
  if (posture) {
    posture.medianSpineUp = ups.length ? ups[Math.floor(ups.length / 2)] : 0;
    posture.medianLegDown = legs.length ? legs[Math.floor(legs.length / 2)] : 0;
    posture.medianArmForward = arms.length ? arms[Math.floor(arms.length / 2)] : 0;
    posture.medianArmSpread = spread.length ? spread[Math.floor(spread.length / 2)] : 0;
  }
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
    posture,
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
  hoverDiagnosis: [],
  legBaseline: [],
  legsFlipped: 0,
  legFixes: [],
  legsUnfixed: [],
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

  // PUT THE LEGS BACK UNDER THE BODY — a convention fix, so it belongs here
  // beside the twist and BEFORE the anatomical limits.
  //
  // ORDER MATTERS AND I GOT IT WRONG FIRST. I ran this after the limits and
  // hinges, where it looked fine and the clips stood up — and the bake's own
  // joint-range test caught 1109 violations, RightUpLeg twisted 116 deg and
  // bent 148. A correction applied after the constraints is a correction
  // nothing constrains. Flip first, then let the limits judge the result.
  const legFix = correctInvertedLegs(relative);
  if (legFix && !legFix.rejected) {
    report.legsFlipped++;
    report.legFixes.push({ name: src.name, ...legFix });
  } else if (legFix?.rejected) {
    report.legsUnfixed.push({ name: src.name, before: legFix.before, bestAfter: legFix.best?.after });
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
  if (ground?.posture && (ground.floorGap ?? 0) <= 0.001) {
    report.legBaseline.push(ground.posture.medianLegDown ?? 0);
  }
  if (ground && (ground.floorGap ?? 0) > 0.08 && ground.posture) {
    report.hoverDiagnosis.push({ name: src.name, gap: ground.floorGap, ...ground.posture });
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
    armForward: ground?.posture?.medianArmForward ?? 0,
    armSpread: ground?.posture?.medianArmSpread ?? 0,
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
console.log(`  LEGS PUT BACK DOWN   ${report.legsFlipped} clip(s) whose thighs were folded up over the torso`);
if (report.legFixes.length) {
  const byFix = {};
  for (const f of report.legFixes) { const k = `${f.axis}/${f.side}`; byFix[k] = (byFix[k] ?? 0) + 1; }
  console.log(`    correction chosen by measurement: ` + Object.entries(byFix).map(([k, v]) => `${v} x ${k}`).join(', '));
  console.log(`    e.g. ` + report.legFixes.slice(0, 4).map((f) => `${f.name} ${f.before.toFixed(2)} -> ${f.after.toFixed(2)}`).join(', '));
}
if (report.legsUnfixed.length) {
  console.log(`    NOT CORRECTED ${report.legsUnfixed.length}: no flip improved them, left exactly as authored`);
  console.log(`      ` + report.legsUnfixed.slice(0, 6).map((f) => `${f.name} ${f.before.toFixed(2)}`).join(', '));
}
{
  const arms = Object.entries(manifest)
    .map(([n, m]) => [n, m.armSpread ?? 0])
    .sort((a, b) => b[1] - a[1]);
  const vals = arms.map((a) => a[1]).sort((a, b) => a - b);
  console.log(`  ARMS SPREAD SIDEWAYS median ${vals[Math.floor(vals.length / 2)].toFixed(2)} (a T-pose starfish is near 1.00)`);
  console.log(`    most splayed: ` + arms.slice(0, 10).map(([n, v]) => `${n} ${v.toFixed(2)}`).join(', '));
}
report.legBaseline.sort((a, b) => a - b);
if (report.legBaseline.length) {
  console.log(`  LEG BASELINE         grounded clips hang their legs at median ${report.legBaseline[Math.floor(report.legBaseline.length / 2)].toFixed(2)} (a standing leg is -1.00)`);
}
if (report.hoverDiagnosis.length) {
  // WHAT IS THIS CLIP ACTUALLY DOING? The 55 are not one thing, and treating
  // them as one is what made "authored too high" look like the answer.
  //   PRONE    lying down — a fall, a ground move. Correct, and it should
  //            still be ON the mat rather than floating above it.
  //   TUCKED   airborne with the knees up — a jump or a spinning kick. Also
  //            correct; it is SUPPOSED to leave the floor.
  //   INVERTED head below the hips at the clip's most grounded frame. No
  //            standing move does that; this one is genuinely broken.
  const classify = (d) => {
    if (d.height < 0.1) return 'INVERTED';
    if (d.headAboveHips < 0.25) return 'PRONE';
    if (d.height < 1.2) return 'TUCKED';
    return 'UPRIGHT';
  };
  const counts = {};
  for (const d of report.hoverDiagnosis) {
    d.kind = classify(d);
    counts[d.kind] = (counts[d.kind] ?? 0) + 1;
  }
  console.log(`  HOVER DIAGNOSIS      ${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ')}`);
  for (const kind of ['UPRIGHT', 'INVERTED', 'PRONE', 'TUCKED']) {
    const group = report.hoverDiagnosis.filter((d) => d.kind === kind).sort((a, b) => b.gap - a.gap);
    if (!group.length) continue;
    console.log(`    ${kind} (${group.length}): ` + group.slice(0, 8).map((d) => `${d.name} ${(d.gap * 100).toFixed(0)}cm spine ${(d.medianSpineUp ?? 0).toFixed(2)} leg ${(d.medianLegDown ?? 0).toFixed(2)}`).join(', '));
  }
}
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
