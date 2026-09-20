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
import { FACE_AWAY_MIN, FOOT_STRIKE_REACH_M, HAND_STRIKE_REACH_M, STANDING_START_MIN } from '../src/engine/retarget/BakedMotionBank.ts';
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
/**
 * A SLOT OWNER HAS TO PASS THE SAME GATES AS ANY OTHER CANDIDATE.
 *
 * SCHWARZERBLITZ_COMBAT_SLOTS names ROUNDHOUSEKICK as attack_rk's owner, and
 * ROUNDHOUSEKICK strikes at -0.96 while its body faces +0.74 — the fighter
 * faces you and kicks behind himself. That is exactly the kick the owner
 * reported going "off to the left". A hand-written table is a preference,
 * not a guarantee; the measurement decides.
 *
 * A FUNCTION, not an inline expression, because the first version read
 * `boneCount` and `movingBones` before they were declared and the bake died
 * with a temporal-dead-zone error — after deleting its output directory, so
 * the test suite silently SKIPPED its 20 bake-gated tests and still reported
 * green. Declaration order is not something to leave to luck.
 */
function ownerFailsMeasurement(name, strike, movingBones, boneCount, claimed) {
  if (!claimed) return null;
  if (strike?.startUp !== undefined && strike.startUp < STANDING_START_MIN
      && !/^(getup|knockdown|hit_reaction|defeat)/.test(claimed)) {
    return `starts on the mat (head at ${strike.startUp.toFixed(2)} of standing) — a receiving half`;
  }
  if (/^attack/.test(claimed) && strike?.faceMin !== undefined && strike.faceMin < FACE_AWAY_MIN) {
    return `turns away from the opponent (facing ${strike.faceMin.toFixed(2)})`;
  }
  if (/^attack/.test(claimed) && strike?.handReach !== undefined
      && strike.handReach < HAND_STRIKE_REACH_M && (strike.footReach ?? 0) < FOOT_STRIKE_REACH_M) {
    return `no limb reaches out (hand ${strike.handReach.toFixed(2)} m, foot ${(strike.footReach ?? 0).toFixed(2)} m)`;
  }
  if (boneCount >= 8 && movingBones < 3) return `${movingBones}/${boneCount} bones move`;
  return null;
}

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

/** The lowest point of the WHOLE skeleton, not just the feet. */
function lowestBoneY() {
  let y = Infinity;
  for (const b of boneObjects.values()) {
    b.getWorldPosition(_v);
    if (_v.y < y) y = _v.y;
  }
  return y;
}
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
const BIND_BODY_FLOOR = lowestBoneY();
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
 * RAISED 0.6 -> 0.9 BECAUSE ITS ORIGINAL JOB IS DONE. The cap existed to stop
 * a clip whose pose was wrong in some other way from being buried in the mat
 * to "plant" it — and the thing that was actually wrong has since been found
 * and fixed upstream: the thighs were folded up over the torso, so the whole
 * body measured a metre too high. With the legs put back down and T-poses
 * refused, what remains is genuine authored height.
 *
 * MEASURED across the three candidates:
 *     0.6 m   26 clips capped, 8 never reach the mat
 *     0.9 m    1 clip capped,  0 never reach the mat
 *     1.2 m    0 clips capped
 * 0.9 is where the curve flattens, and it is still under half the height of
 * a 1.85 m fighter, so the cap can still catch a genuinely broken pose.
 *
 * Clips that hit it are counted and named, not silently smeared.
 */
const MAX_GROUND_SHIFT_M = Number(process.env.BF_MAX_SHIFT ?? 0.9);
const MEDIANS = [];
const strikeOf = new Map();
/** A bone that turns less than this across a whole clip has not moved. */
const MOVING_BONE_DEG = 5;
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
/** How fast a pelvis may travel vertically, in metres per second. */
const PELVIS_MAX_SPEED_MPS = 2.0;
/** Above this the torso is standing, so feet above the pelvis is impossible. */
const SPINE_UPRIGHT_MIN = 0.7;

/**
 * WHICH WAY DOES THE STRIKE ACTUALLY GO?
 *
 * Owner, on attack_rk: "it's going off to the side, off to the left of the
 * character, pretty much he's doing like a super kick off to the left, but
 * off to the left isn't towards the character — he's not rotating his body
 * to do it towards the left, towards the character he's fighting."
 *
 * A strike is a limb travelling fast in one direction. This finds the frame
 * where the fastest hand or foot is moving quickest, and reports that
 * direction in the BODY'S OWN FRAME: +1 is straight down the fighter's
 * forward axis (this roster faces +X), 0 is square sideways, -1 is
 * backwards. A clip whose strike runs sideways will read near 0 however
 * good it looks in isolation, because the fighter does not turn to throw it.
 *
 * Measured on the limb, not the hips, on purpose: the hips can face forward
 * while the leg swings across the body, which is exactly the super-kick
 * silhouette described.
 */
function measureStrikeDirection(clip) {
  const dur = clip.duration || 0;
  const steps = Math.min(60, Math.max(12, Math.round(dur * 30)));
  restPose();
  const sampler = new THREE.AnimationMixer(skeleton.root);
  sampler.clipAction(clip).play();
  const LIMBS = ['mixamorigLeftHand', 'mixamorigRightHand', 'mixamorigLeftFoot', 'mixamorigRightFoot'];
  const LIMB_ROOT = {
    mixamorigLeftHand: 'mixamorigLeftArm',
    mixamorigRightHand: 'mixamorigRightArm',
    mixamorigLeftFoot: 'mixamorigLeftUpLeg',
    mixamorigRightFoot: 'mixamorigRightUpLeg',
  };
  const rp = new THREE.Vector3();
  const prev = new Map();
  const hp = new THREE.Vector3();
  const lp = new THREE.Vector3();
  let best = { speed: 0, forward: 0, limb: null, bodyFaces: 0 };
  // THE SECOND MEASUREMENT: WHERE THE LIMB REACHES, not where it moves
  // fastest. Peak speed is ambiguous on a snappy strike — a jab is pulled
  // back faster than it is pushed out, so the fastest frame is the
  // RETRACTION and the direction reads backwards. RENDERED and confirmed:
  // DEFAULTJUMPPUNCH measures fwd -0.97 and visibly punches forward;
  // CROUCHINGKICK measures -1.00 and visibly kicks forward. Reach cannot
  // say that: a strike goes OUT, and the frame where the limb is farthest
  // from the body is the frame the strike lands.
  const track = new Map();
  // WHICH WAY THE BODY FACES, from the shoulder line: a human is far wider
  // across the shoulders than front-to-back, so the body faces perpendicular
  // to that line. Measured alongside the strike because turning a clip round
  // must not trade a backwards strike for a backwards BODY.
  const ls = new THREE.Vector3();
  const rs = new THREE.Vector3();
  let faceSum = 0;
  let faceN = 0;
  // THE WORST THE FACING EVER GETS. A standing attack keeps the opponent in
  // front of it the whole way through; a multi-action demonstration clip
  // turns the fighter round partway. See FACE_AWAY_MIN.
  let faceMin = Infinity;
  // IS THIS THE DELIVERER'S HALF OR THE RECEIVER'S? A man throwing a move
  // starts on his feet. A man taking one starts, or finishes, on the mat.
  // Taken as head height at the first and last frame against the tallest
  // the clip ever stands.
  let startHead = null;
  let endHead = null;
  let maxHead = 0;
  const hdp = new THREE.Vector3();
  const bp = new THREE.Vector3();
  for (let i = 0; i <= steps; i++) {
    sampler.setTime((dur * i) / steps);
    skeleton.root.updateMatrixWorld(true);
    const hips = boneObjects.get(HIPS);
    if (!hips) break;
    hips.getWorldPosition(hp);
    const L = boneObjects.get('mixamorigLeftShoulder');
    const R = boneObjects.get('mixamorigRightShoulder');
    let faceNow = null;
    let faceVec = null;
    if (L && R) {
      L.getWorldPosition(ls); R.getWorldPosition(rs);
      const across = rs.clone().sub(ls);
      // Forward is the shoulder line turned 90 deg about Y.
      const fwd = new THREE.Vector3(-across.z, 0, across.x);
      if (fwd.lengthSq() > 1e-9) {
        fwd.normalize();
        faceVec = fwd.clone();
        faceNow = fwd.x;
        faceSum += faceNow;
        faceN++;
        if (faceNow < faceMin) faceMin = faceNow;
      }
    }
    const headBone = boneObjects.get('mixamorigHead');
    if (headBone) {
      headBone.getWorldPosition(hdp);
      // HOW TALL IS HE STANDING RIGHT NOW: the head above the LOWEST point
      // of the body, not a raw world Y. My first version used world Y and
      // it was meaningless — the skeleton's origin is not the floor, head Y
      // is negative for a third of the bank, and CROTCHCHOP (a standing
      // taunt) scored 0.076 as if it were lying down. The lowest point is
      // taken over every bone rather than the feet, because a body on the
      // mat rests on a shoulder and a hip.
      let low = Infinity;
      for (const b of boneObjects.values()) {
        b.getWorldPosition(bp);
        if (bp.y < low) low = bp.y;
      }
      const tall = hdp.y - low;
      if (startHead === null) startHead = tall;
      endHead = tall;
      if (tall > maxHead) maxHead = tall;
    }
    for (const name of LIMBS) {
      const b = boneObjects.get(name);
      if (!b) continue;
      b.getWorldPosition(lp);
      // RELATIVE TO THE HIPS, so walking the body across the floor does not
      // read as a strike.
      const rel = lp.clone().sub(hp);
      const before = prev.get(name);
      prev.set(name, rel.clone());
      if (!before) continue;
      // EXTENSION FROM THE LIMB'S OWN ROOT, not from the hips. Measuring it
      // hips-relative compares a hand against a foot on a scale a leg always
      // wins, and it picked the stepping LeftFoot for GYAKUZUKI — a reverse
      // PUNCH — and the idle RightHand for GRAFQUICKJAB, a left jab.
      const rootName = LIMB_ROOT[name];
      const root = rootName ? boneObjects.get(rootName) : null;
      if (root) {
        root.getWorldPosition(rp);
        const arm = lp.clone().sub(rp);
        const t = track.get(name) ?? { near: null, far: null, nearD: Infinity, farD: -Infinity, speed: 0, behind: 0, frames: 0, lowY: Infinity, highY: -Infinity, projMin: Infinity, projMax: -Infinity };
        if (lp.y < t.lowY) t.lowY = lp.y;
        if (lp.y > t.highY) t.highY = lp.y;
        const span = Math.hypot(arm.x, arm.z);
        // HOW MUCH OF THE MOVE IS SPENT GOING THE WRONG WAY. A kick that
        // chambers behind the body for two thirds of its length and lands in
        // the last fifth reads, in play, as a kick thrown backwards — which
        // is what the owner saw in ROUNDHOUSEKICK: 12 of 17 samples have the
        // striking foot behind the hips, against 4 of 17 for HEAVYKICK.
        t.frames++;
        if (rel.x * (faceNow ?? 1) < 0) t.behind++;
        // HOW FAR THIS LIMB GETS OUT IN FRONT OF ITS OWN ROOT — the hand
        // past its shoulder, the foot past its hip — projected onto the
        // body's OWN forward vector, so the clip's authored facing does not
        // matter and the body's girth is not counted as reach. This is the
        // measurement the gate reads; every other number here is kept for
        // the record. See HAND_STRIKE_REACH_M / FOOT_STRIKE_REACH_M.
        if (faceVec) {
          const out = (lp.x - rp.x) * faceVec.x + (lp.z - rp.z) * faceVec.z;
          if (out > t.projMax) t.projMax = out;
        }
        if (span < t.nearD) { t.nearD = span; t.near = lp.clone().sub(hp); }
        if (span > t.farD) { t.farD = span; t.far = lp.clone().sub(hp); t.farFace = faceNow; }
        track.set(name, t);
      }
      const step = rel.clone().sub(before);
      const tt = track.get(name);
      if (tt) tt.speed = Math.max(tt.speed, step.length());
      const speed = step.length();
      if (speed <= best.speed) continue;
      const flat = new THREE.Vector3(step.x, 0, step.z);
      if (flat.lengthSq() < 1e-9) continue;
      flat.normalize();
      best = { speed, forward: flat.x, limb: name.replace('mixamorig', '') };
    }
  }
  sampler.stopAllAction();
  sampler.uncacheClip(clip);
  restPose();
  best.bodyFaces = faceN ? faceSum / faceN : 0;
  // The limb that EXTENDS the furthest is the one throwing the strike, and
  // the direction from its most-tucked frame to its most-extended one is
  // where the strike goes.
  //
  // SPEED PICKS THE LIMB, REACH SAYS WHERE IT GOES. Neither alone is right:
  //   - peak speed names the striking limb correctly (the jab's LeftHand,
  //     the axe kick's RightFoot) and then reports the RETRACTION direction,
  //     which is how a forward punch measured -0.97.
  //   - extension alone gets the direction right and names the wrong limb:
  //     GYAKUZUKI is a reverse PUNCH and its stepping LeftFoot out-extends
  //     the hand (0.277 m against 0.25 m), so the whole clip read backwards.
  // The product of the two is what a strike is — a limb that goes out fast.
  //
  // A FOOT THAT ONLY STEPS IS NOT THROWING THE STRIKE. Extension x speed
  // still lost GYAKUZUKI_COMBO to its own footwork: traced, both hands
  // punch to +0.5 m forward while the left foot STEPS BACK 0.78 m, which
  // out-scores them, so a forward punching combination measured reach -1.00.
  // A kick lifts the foot; a step does not, so a foot is only eligible as
  // the striking limb once it leaves the floor by more than a stride.
  let reach = { forward: 0, limb: null, extent: 0, score: 0 };
  for (const [name, t] of track) {
    if (!t.near || !t.far) continue;
    const extent = t.farD - t.nearD;
    const score = extent * t.speed;
    if (score <= reach.score) continue;
    const out = t.far.clone().sub(t.near);
    const flat = new THREE.Vector3(out.x, 0, out.z);
    if (flat.lengthSq() < 1e-9) continue;
    flat.normalize();
    reach = {
      forward: flat.x,
      limb: name.replace('mixamorig', ''),
      extent,
      score,
      // WHICH WAY THE BODY FACES AT THE MOMENT THE STRIKE LANDS, not
      // averaged over the clip. ROUNDHOUSEKICK is why: it faces forward at
      // the start and the end and TURNS ITS BACK to throw the kick, so the
      // mean reads a healthy 0.738 while the frame that matters is negative.
      // That is exactly what the owner described — "he's not rotating his
      // body to do it towards the character he's fighting."
      face: t.farFace,
      behind: t.frames ? t.behind / t.frames : 0,
    };
  }
  best.reach = reach.forward;
  best.reachLimb = reach.limb;
  best.reachExtent = reach.extent;
  best.reachFace = reach.face ?? best.bodyFaces;
  best.reachBehind = reach.behind ?? 0;
  // DOES THIS CLIP CONTAIN A STRIKE THAT GOES AT THE OPPONENT?
  //
  // Asked of EVERY limb rather than of one chosen limb, which is what three
  // earlier versions of this got wrong: peak speed names the right limb and
  // the wrong DIRECTION, furthest extension names a punch's stepping FOOT,
  // and foot LIFT does not separate those either — GYAKUZUKI_COMBO's step
  // lifts 0.62 m, higher than QUICKKICK's kick at 0.607. A clip does not
  // need a nominated striker; it needs one limb that goes out in front,
  // which is a question each limb can answer for itself.
  //
  // HANDS AND FEET ARE JUDGED SEPARATELY because they reach different
  // distances from their own roots, and a single number lets a stride stand
  // in for a punch: BOXING scores 0.53 on the foot while its hands never
  // leave the guard, which is exactly the clip the owner reported.
  let handOut = -Infinity;
  let footOut = -Infinity;
  for (const [name, t] of track) {
    if (!Number.isFinite(t.projMax)) continue;
    if (/Hand$/.test(name)) handOut = Math.max(handOut, t.projMax);
    else footOut = Math.max(footOut, t.projMax);
  }
  best.faceMin = Number.isFinite(faceMin) ? faceMin : 0;
  best.startUp = startHead === null || maxHead <= 1e-6 ? 1 : startHead / maxHead;
  best.endUp = endHead === null || maxHead <= 1e-6 ? 1 : endHead / maxHead;
  best.handReach = Number.isFinite(handOut) ? handOut : 0;
  best.footReach = Number.isFinite(footOut) ? footOut : 0;
  best.footLift = Math.max(
    ...[...track].filter(([n]) => /Foot$/.test(n)).map(([, t]) => t.highY - t.lowY),
    0,
  );
  return best;
}

/**
 * A BACKWARD STRIKE IS A BROKEN CLIP, NOT A FACING CONVENTION.
 *
 * Owner, on attack_rk: "it's going off to the side, off to the left of the
 * character ... he's not rotating his body to do it towards the character
 * he's fighting."
 *
 * MY FIRST FIX WAS WRONG AND THE MEASUREMENT CAUGHT IT. I read
 * ROUNDHOUSEKICK at -0.962, BOXING at -0.999 and COMBO_PUNCH at -1.00 and
 * assumed a facing convention — clips authored the other way round — so I
 * yawed them 180 degrees. Measuring the BODY as well as the strike showed
 * what that actually did:
 *
 *     BOXING   before  body +0.91  strike -1.00
 *              after   body -0.91  strike +1.00
 *
 * The body and the strike DISAGREE in these clips either way round. Before,
 * the fighter faced you and punched behind himself; after, he had his back
 * to you and punched over his shoulder. 50 of 94 attack clips went that way.
 * Turning them round traded one wrong thing for a worse one.
 *
 * (It is the same defect the owner reported long ago in the shadowboxing
 * loop: "the right arm is going backwards towards the shoulder blade.")
 *
 * So the correction is not a rotation. A clip whose strike travels away from
 * the direction its own body faces is simply not an attack, and is refused
 * as one — the same gate shape as a frozen clip or a T-pose. Nothing is
 * deleted; it stays in the library and cannot win an attack slot.
 */
const BACKWARD_STRIKE = -0.3;

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

/**
 * A WHOLE-BODY PITCH CORRECTION WAS TRIED HERE AND REVERTED. WRITE IT DOWN.
 *
 * Owner: "crotch chop and rapid chest beating are taunts. I can see those
 * aren't firing off in your thing." Rendered, they DO fire — they play
 * HORIZONTAL, the fighter flat out for all five seconds of a crotch chop.
 *
 * MEASURED: 50 clips sit within 0.3 of horizontal while animating, and 40
 * of those ALSO have the feet above the pelvis. A torso flat out with its
 * feet above its hips is not a pose a body can hold, so the obvious reading
 * is one whole-body rotation, and correctInvertedLegs refuses exactly these
 * because its guard requires an upright spine.
 *
 * THE READING WAS WRONG AND THE ATTEMPT MADE THINGS WORSE. Rotating the root
 * by +/-90 degrees about X or Z, keeping only results that stood the spine
 * up AND hung the legs down, corrected THREE clips — and all three were
 * already right: DOUBLE_LEG_TAKEDOWN___VICTIM (a takedown victim's legs ARE
 * over his head) and KIP_UP (a getup DOES start on the floor). CROTCHCHOP
 * and RAPIDCHESTBEATING, the two the owner actually named, were among the
 * eight it could not stand up at all.
 *
 * So those clips are not rotated — they are flat in the source data, and no
 * rigid transform of the root fixes them. They need a different source or a
 * fresh capture, and the Move Library is where they get marked BROKEN.
 *
 * THE LESSON IS THE GUARD, NOT THE ROTATION: a self-verifying correction
 * that only keeps results passing a measurement still "fixed" three clips
 * that needed nothing, because the measurement it verified against could
 * not tell a prone VICTIM from a broken taunt.
 */
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
  const bodyLift = [];
  const postures = [];
  for (const t of sorted) {
    sampler.setTime(t);
    skeleton.root.updateMatrixWorld(true);
    // GROUND BY WHATEVER IS ACTUALLY TOUCHING, not by the feet.
    //
    // Owner: "when they get knocked down, they float in the air. They don't
    // fall down to the ground." MEASURED: FALL_B_LOOP, semantic KNOCKDOWN,
    // has its body 42 cm BELOW its lowest foot — a man on his back is on his
    // shoulders and hips with his feet in the air. Planting that clip by the
    // feet lifts the whole body 42 cm off the mat, which is the float.
    //
    // For a standing pose the lowest bone IS a foot, so this changes nothing
    // there; it only matters for the bodies that are down, which is exactly
    // where it was wrong.
    const foot = lowestFootY() - BIND_FLOOR;
    const body = lowestBoneY() - BIND_BODY_FLOOR;
    lift.push(Math.min(foot, body));
    bodyLift.push(body);
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
  // WHAT IS ACTUALLY TOUCHING THE MAT. A standing body's lowest point is a
  // foot; a body lying on its back is on its shoulders and hips, with the
  // feet somewhere in the air. Planting a prone clip by its FEET lifts the
  // whole body off the floor, which is precisely "they float when they get
  // knocked down".
  const minBody = Math.min(...bodyLift);
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
    minLiftFoot: +minLift.toFixed(4),
    minLiftBody: +minBody.toFixed(4),
    applied: Math.abs(offset) >= 1e-5,
    /**
     * THE PELVIS BOB, DERIVED. The banks are rotation-only — there is no
     * authored hips translation anywhere in the corpus — so in pure FK the
     * pelvis is the ROOT and bending the knees lifts the FEET instead of
     * lowering the body. That is exactly what the owner reported: "the
     * pelvis is locked in position and the idle motion is picking the feet
     * up off the ground instead of doing the downward bob."
     *
     * Following the floor PER FRAME turns the leg bend back into pelvis
     * motion: at every sample the body drops by however far its lowest
     * contact sits above the mat. A single constant offset can only be
     * right at one instant of the clip — the deepest one — and every other
     * frame floats by the difference.
     */
    perFrame: sorted.map((t, i) => ({ t, y: -lift[i] })),
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
  turnedAround: 0,
  turnedList: [],
  turnRejected: [],
  rejectedOwners: [],
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
  strikeOf.set(src.name, measureStrikeDirection(relative));
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

  // HOW MANY BONES ACTUALLY MOVE. A clip where nothing moves is not an
  // animation, and several are shipped as if they were: eight Mixamo
  // character rest poses (Y_BOT, PALADIN_J_NORDSTROM, CH44_NONPBR and
  // friends), TPOSE, SUPINE, the SPINJUMP family — and HURRICANE_KICK,
  // which moves exactly ONE bone of 22: the hips sweep 172 deg while every
  // other joint sits inside half a degree. It plays as a statue spinning on
  // the spot, and it is the FIRST alias for attack_2 and attack_rk, so two
  // of the game's core kicks were that statue.
  let movingBones = 0;
  const boneCount = Object.keys(tracks).length;
  for (const t of Object.values(tracks)) {
    let widest = 0;
    for (let i = 4; i + 3 < t.q.length; i += 4) {
      const dot = Math.abs(t.q[i] * t.q[0] + t.q[i + 1] * t.q[1] + t.q[i + 2] * t.q[2] + t.q[i + 3] * t.q[3]);
      widest = Math.max(widest, Math.acos(Math.min(1, dot)) * 2 * 180 / Math.PI);
    }
    if (widest > MOVING_BONE_DEG) movingBones++;
  }


  // PUT THE CLIP ON THE FLOOR BY SHIFTING THE PELVIS, NOT BY PINNING IT.
  //
  // Owner, watching an idle: "instead of doing like an idle bob, kind of up
  // and down of the knees and the hips ... what it's actually doing is the
  // feet are going up. So instead of the pelvis doing a natural bob, it's
  // like the pelvis is locked in position and the idle motion is picking the
  // feet up off the ground."
  //
  // He read the defect exactly. This wrote ONE key built from the FIRST
  // sample of the authored track — `existing.p[0..2]` — and threw the rest
  // of the track away. MEASURED after that: 324 of 324 clips with a hips
  // position track had it collapsed to a single key, so the pelvis could
  // not move vertically in ANY clip in the game. The leg rotations still
  // ask the body to drop, and with the pelvis pinned the only way the rig
  // can answer is to lift the feet.
  //
  // The offset is a CONSTANT; it belongs on every key, not instead of them.
  if (ground?.applied) {
    // FOLLOW THE FLOOR EVERY FRAME, unless the clip means to leave it.
    // An airborne clip's feet are SUPPOSED to be off the ground, so it keeps
    // the single constant offset; pinning a jump to the mat would delete the
    // jump. Everything that stays grounded gets the bob back.
    const pf = ground.perFrame;
    if (!clipAirborne && pf && pf.length > 2) {
      // A PELVIS CANNOT MOVE FASTER THAN A PELVIS.
      //
      // Following the lowest contact every frame is right while a foot is
      // down, and wrong for the instant a running gait has BOTH feet off
      // the floor: the lowest contact rises with the body, and the offset
      // would haul the pelvis up after it. `airborne` is a per-CLIP flag
      // and cannot see that instant.
      //
      // MEASURED per key before the clamp: STANCE moves 2.9 mm, WALK 2.2,
      // BOX_IDLE 2.2 — a real idle bob, already smooth. RUNNING moves
      // 64 mm in 13 ms, which is 4.9 m/s of pelvis, and GINGA_SIDEWAYS_2
      // 110 mm. A person squatting fast moves their hips at well under
      // 2 m/s, so the cap leaves every idle and walk untouched and only
      // bites where the curve had stopped being a body.
      const t = [];
      const p = [];
      let prevY = null;
      let prevT = 0;
      for (const k of pf) {
        let y = k.y;
        if (prevY !== null) {
          const dt = Math.max(1 / 240, k.t - prevT);
          const limit = PELVIS_MAX_SPEED_MPS * dt;
          y = Math.max(prevY - limit, Math.min(prevY + limit, y));
        }
        prevY = y;
        prevT = k.t;
        t.push(round(k.t));
        p.push(round(hipsBindPosition.x), round(hipsBindPosition.y + y), round(hipsBindPosition.z));
      }
      positions[HIPS] = { t, p };
    } else {
    const existing = positions[HIPS];
    if (existing && existing.t.length) {
      // The track `stripRootPositionTracks` leaves is a pure DELTA — zero on
      // X and Z, and Y measured from the clip's own first frame. The bind
      // position is the base, the grounding offset rides on top, and the
      // authored bob survives because it is added per key rather than
      // sampled once.
      const p = existing.p.slice();
      for (let i = 0; i + 2 < p.length; i += 3) {
        p[i] = round(hipsBindPosition.x + p[i]);
        p[i + 1] = round(hipsBindPosition.y + p[i + 1] + ground.offset);
        p[i + 2] = round(hipsBindPosition.z + p[i + 2]);
      }
      positions[HIPS] = { t: existing.t, p };
    } else {
      positions[HIPS] = {
        t: [0],
        p: [round(hipsBindPosition.x), round(hipsBindPosition.y + ground.offset), round(hipsBindPosition.z)],
      };
    }
    }
  }


  const claimedOwner = SLOT_OWNER.get(src.name);
  const ownerFault = ownerFailsMeasurement(
    src.name, strikeOf.get(src.name), movingBones, boneCount, claimedOwner,
  );
  if (ownerFault) report.rejectedOwners.push(`${claimedOwner}:${src.name} ${ownerFault}`);
  const slot = ownerFault ? undefined : claimedOwner;
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
    movingBones,
    boneCount,
    file: `${src.name}.json`,
    bank: src.bank,
    dur: +relative.duration.toFixed(4),
    bones: Object.keys(tracks).length,
    semantic,
    owns: Boolean(slot),
    airborne: clipAirborne,
    floorGap: ground?.floorGap ?? 0,
    minLiftFoot: ground?.minLiftFoot ?? 0,
    minLiftBody: ground?.minLiftBody ?? 0,
    strike: (() => {
      const d = strikeOf.get(src.name);
      if (!d) return undefined;
      return {
        fwd: +d.forward.toFixed(3),
        limb: d.limb,
        body: +d.bodyFaces.toFixed(3),
        // Where the strike REACHES. See measureStrikeDirection: `fwd` is the
        // peak-SPEED direction and reads a snappy jab's retraction, so it
        // false-positives every short attack in the bank.
        reach: +(d.reach ?? 0).toFixed(3),
        reachLimb: d.reachLimb ?? undefined,
        reachExtent: +(d.reachExtent ?? 0).toFixed(4),
        /** Body facing at the frame the strike lands, not averaged. */
        reachFace: +(d.reachFace ?? 0).toFixed(3),
        /** Share of the clip the striking limb spends behind the body. */
        reachBehind: +(d.reachBehind ?? 0).toFixed(3),
        /** How far the higher foot leaves the floor: a kick, or a step. */
        footLift: +(d.footLift ?? 0).toFixed(3),
        /**
         * THE GATE'S MEASUREMENTS, in metres: how far the hand gets in
         * front of its shoulder, and the foot in front of its hip.
         */
        handReach: +(d.handReach ?? 0).toFixed(3),
        footReach: +(d.footReach ?? 0).toFixed(3),
        /** The worst the body's facing gets at any frame of the clip. */
        faceMin: +(d.faceMin ?? 0).toFixed(3),
        /** Head height at the first and last frame, over the clip's tallest. */
        startUp: +(d.startUp ?? 1).toFixed(3),
        endUp: +(d.endUp ?? 1).toFixed(3),
      };
    })(),
    armForward: ground?.posture?.medianArmForward ?? 0,
    armSpread: ground?.posture?.medianArmSpread ?? 0,
    // THE BODY'S OWN UP-VECTOR, MEDIAN OVER THE CLIP. Already measured for
    // the leg-flip pass and never carried to the runtime, which is how
    // FACEGOUGE, CARTWHEEL and HURRICANERANA came back as "planted, faces
    // forward, strikes forward" finisher candidates while RENDERING fully
    // inverted. floorGap says the lowest point touches the mat; it cannot
    // say WHICH END is down. +1 is standing, 0 is horizontal, -1 is upside
    // down.
    spineUp: +(ground?.posture?.medianSpineUp ?? 0).toFixed(3),
    legDown: +(ground?.posture?.medianLegDown ?? 0).toFixed(3),
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
  report.grounded ? ((report.groundedTotal / report.grounded) * 100).toFixed(1) : '0'} cm, added to every pelvis key)`);
if (process.env.BF_MEDIANS) {
  const sorted = MEDIANS.map(([, m]) => m).sort((a, b) => a - b);
  const q = (f) => (sorted[Math.floor(sorted.length * f)] * 100).toFixed(1);
  console.log(`  peak-lift distribution (cm): p10 ${q(0.1)}  p25 ${q(0.25)}  p50 ${q(0.5)}  p75 ${q(0.75)}  p90 ${q(0.9)}  max ${(sorted[sorted.length-1]*100).toFixed(1)}`);
}
{
  const dead = Object.entries(manifest).filter(([, m]) => (m.boneCount ?? 0) >= 8 && (m.movingBones ?? 0) <= 2);
  console.log(`  NOTHING MOVES        ${dead.length} clip(s) where 2 or fewer bones turn at all — not animations`);
  if (dead.length) console.log('    ' + dead.slice(0, 8).map(([n, m]) => `${n} ${m.movingBones}/${m.boneCount}`).join(', '));
}
{
  const bad = Object.entries(manifest).filter(([, m]) =>
    /^attack/.test(m.semantic ?? '') && m.strike
    && (m.strike.handReach ?? 9) < HAND_STRIKE_REACH_M
    && (m.strike.footReach ?? 9) < FOOT_STRIKE_REACH_M);
  const down = Object.entries(manifest).filter(([, m]) =>
    /^(attack|idle|block|walk|strafe|run|dash|backdash|crouch|guard|victory|taunt|grapple|finisher|overdrive)/.test(m.semantic ?? '')
    && m.strike && (m.strike.startUp ?? 9) < STANDING_START_MIN);
  console.log(`  STARTS ON THE MAT    ${down.length} clip(s) that begin with the head on the floor — somebody's RECEIVING half`);
  if (down.length) console.log('    ' + down.slice(0, 8).map(([n, m]) => `${n} ${m.strike.startUp}`).join(', '));
  const turned = Object.entries(manifest).filter(([, m]) =>
    /^attack/.test(m.semantic ?? '') && m.strike && (m.strike.faceMin ?? 9) < FACE_AWAY_MIN);
  console.log(`  TURNS AWAY           ${turned.length} attack clip(s) where the fighter turns past square — refused as attacks`);
  if (turned.length) console.log('    ' + turned.slice(0, 8).map(([n, m]) => `${n} ${m.strike.faceMin}`).join(', '));
  console.log(`  NO STRIKE IN IT      ${bad.length} attack clip(s) where no hand or foot reaches out — refused as attacks`);
  if (bad.length) console.log('    ' + bad.slice(0, 8).map(([n, m]) => `${n} h${m.strike.handReach} f${m.strike.footReach}`).join(', '));
}
if (report.rejectedOwners.length) {
  console.log(`  OWNER REJECTED       ${report.rejectedOwners.length} named slot owner(s) failed the measurement`);
  console.log('    ' + report.rejectedOwners.join(', '));
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
