// `.ts` extensions on purpose — the repo runs these under
// `node --experimental-strip-types --test`, which resolves them literally.
import * as THREE from 'three';

/**
 * THE BRUTAL FIST SKELETON, and what a joint on it is allowed to do.
 *
 * WHY THIS EXISTS. Tekken and Schwarzerblitz do not retarget: they have ONE
 * skeleton and every animation is authored on it. We measured that we already
 * have one — all 65 skinned models in public/models are the same 58-joint
 * Mixamo rig, same bone names, same bind convention (toes +X, left hand +Z,
 * hand span 0.75). What we did not have was the discipline of treating it as
 * the only skeleton, so clips from three source conventions were adapted live
 * and each one bent the body in its own way.
 *
 * MEASURED, and it is exactly what the owner reported as twisting "like an
 * owl" (tools: the joint audit, decomposing each frame's local rotation
 * relative to bind into swing and twist):
 *
 *   JOINT   CLIP              max bend   max twist
 *   Head    attack_rk              19 deg     111 deg
 *   Head    ROUNDHOUSEKICK         19 deg     111 deg
 *   Spine   attack_rk              28 deg      57 deg
 *   Spine2  attack_rk               3 deg      34 deg
 *
 * A cervical spine rotates about 80 degrees each way IN TOTAL, shared between
 * neck and head. 111 degrees at the head alone is three times the range.
 *
 * TWO CAUSES, both structural, neither fixable by choosing a better clip:
 *
 *  1. CHAIN GAP. The Schwarzerblitz source drives 19 bones: a TWO-segment
 *     spine and NO clavicle. Our skeleton has Spine -> Spine1 -> Spine2 and
 *     both shoulders. Spine1 and the clavicles receive nothing and hold bind,
 *     so a bend authored across three joints is forced through two, and the
 *     shoulder movement baked into the source's upper arm has to come out of
 *     our shoulder joint instead of our clavicle.
 *
 *  2. NO CEILING. Nothing anywhere refused a rotation for being impossible.
 *     A bad frame in a source clip became a bad frame on the fighter.
 *
 * This module is the ceiling and the redistribution. It is written to be used
 * at BAKE time — resolve a clip onto this skeleton once, offline, and ship the
 * result — and works unchanged in the live pipeline while that bake is built.
 */

/** The spine, root first. A bend belongs to the whole chain, not one joint. */
export const SPINE_CHAIN = [
  'mixamorigSpine',
  'mixamorigSpine1',
  'mixamorigSpine2',
] as const;

/** Clavicle -> upper arm. A source with no clavicle bakes its motion into the arm. */
export const SHOULDER_CHAINS: ReadonlyArray<readonly [clavicle: string, upperArm: string]> = [
  ['mixamorigLeftShoulder', 'mixamorigLeftArm'],
  ['mixamorigRightShoulder', 'mixamorigRightArm'],
];

export interface JointLimit {
  /** Maximum bend (swing) away from bind, degrees. */
  bend: number;
  /** Maximum axial roll (twist) about the bone's own length, degrees. */
  twist: number;
}

/**
 * Anatomical ranges, degrees, per joint, relative to that model's OWN bind.
 *
 * These are ranges of human motion, not taste. The cervical spine yields
 * roughly 80 degrees of rotation to each side in total and the thoracolumbar
 * spine roughly 35, spread over its segments — so a single spine segment in a
 * three-segment chain carries about a third. Elbows and knees are hinges:
 * they have essentially no axial roll of their own, and any that arrives is
 * the candy-wrapper that has no twist bone to absorb it.
 *
 * Deliberately generous. This is a CEILING that stops the impossible, not a
 * style filter — a clip that sits inside these is untouched, and every clip
 * that shipped before this existed stays byte-identical unless it was over.
 */
export const JOINT_LIMITS: Readonly<Record<string, JointLimit>> = {
  mixamorigNeck:          { bend: 55, twist: 60 },
  mixamorigHead:          { bend: 30, twist: 35 },
  mixamorigSpine:         { bend: 35, twist: 20 },
  mixamorigSpine1:        { bend: 30, twist: 18 },
  mixamorigSpine2:        { bend: 30, twist: 18 },
  mixamorigLeftForeArm:   { bend: 150, twist: 12 },
  mixamorigRightForeArm:  { bend: 150, twist: 12 },
  mixamorigLeftLeg:       { bend: 150, twist: 12 },
  mixamorigRightLeg:      { bend: 150, twist: 12 },
  mixamorigLeftShoulder:  { bend: 35, twist: 25 },
  mixamorigRightShoulder: { bend: 35, twist: 25 },
  // A hip rotates about 45 degrees in and out. MEASURED on the Bannon bank's
  // BOX_IDLE, which is what the owner was looking at when he said the idle
  // "twists his body all up": RightUpLeg carried 171 degrees of AXIAL roll and
  // LeftUpLeg 165, near-constant across the whole clip (range under 4). That
  // is not motion, it is a convention offset — and because the twist axis IS
  // the bone's length, it does not move the knee at all. The leg looks placed
  // correctly in silhouette while the thigh mesh is wound almost backwards.
  // Nothing caught it because neither thigh had a limit.
  mixamorigLeftUpLeg:     { bend: 120, twist: 50 },
  mixamorigRightUpLeg:    { bend: 120, twist: 50 },
  mixamorigLeftFoot:      { bend: 55, twist: 30 },
  mixamorigRightFoot:     { bend: 55, twist: 30 },
  // The shoulder joint itself swings almost anywhere, but its axial range is
  // about 90 degrees each way; past that the deltoid shears.
  mixamorigLeftArm:       { bend: 170, twist: 90 },
  mixamorigRightArm:      { bend: 170, twist: 90 },
};

const _p = new THREE.Vector3();
const _proj = new THREE.Vector3();

/**
 * Split a rotation into the roll about `axis` and the bend that remains.
 *
 * The standard swing-twist decomposition: project the quaternion's vector part
 * onto the twist axis, and what is left over is the swing. Doing it this way
 * rather than with Euler angles matters — an Euler triple hits gimbal lock and
 * reports a wild number for a rotation that is perfectly ordinary.
 */
export function swingTwist(
  q: THREE.Quaternion,
  axis: THREE.Vector3,
): { swing: THREE.Quaternion; twist: THREE.Quaternion } {
  _p.set(q.x, q.y, q.z);
  _proj.copy(axis).multiplyScalar(_p.dot(axis));
  const twist = new THREE.Quaternion(_proj.x, _proj.y, _proj.z, q.w);
  if (twist.lengthSq() < 1e-12) twist.set(0, 0, 0, 1);
  else twist.normalize();
  const swing = q.clone().multiply(twist.clone().invert());
  return { swing, twist };
}

/** A quaternion's rotation angle in degrees, 0..180. */
export function angleDeg(q: THREE.Quaternion): number {
  return (2 * Math.acos(Math.min(1, Math.abs(q.w))) * 180) / Math.PI;
}

/** Scale a rotation down to at most `maxDeg`, keeping its axis. */
function capped(q: THREE.Quaternion, maxDeg: number): THREE.Quaternion {
  const deg = angleDeg(q);
  if (deg <= maxDeg || deg < 1e-6) return q;
  // Slerp from identity: the axis is preserved exactly, only the angle moves.
  return new THREE.Quaternion().slerp(q, maxDeg / deg);
}

/**
 * Remove a source-convention roll that is effectively constant across a clip.
 *
 * Some Bannon motion-bank thigh channels carry an approximately 180° axial
 * offset in every frame. Treating that as animation and then clamping it to a
 * 50° anatomical ceiling rotates the whole leg sideways. It is a rest-space
 * convention mismatch, not authored motion.
 *
 * We only remove it when the evidence is strong:
 *   - the median signed twist is > 120° from zero, and
 *   - 90% of frames stay within 25° of that baseline.
 * Dynamic kicks/spins therefore remain untouched.
 */
export function removeConstantConventionTwist(
  clip: THREE.AnimationClip,
  restMap: Map<string, THREE.Quaternion>,
  bones: readonly string[] = ['mixamorigLeftUpLeg', 'mixamorigRightUpLeg'],
): Array<{ bone: string; baselineDeg: number; keys: number }> {
  const out: Array<{ bone: string; baselineDeg: number; keys: number }> = [];

  for (const track of clip.tracks) {
    if (!track.name.endsWith('.quaternion')) continue;
    const bone = track.name.slice(0, -'.quaternion'.length);
    if (!bones.includes(bone)) continue;
    const bind = restMap.get(bone);
    if (!bind) continue;

    const bindInv = bind.clone().invert();
    const axis = new THREE.Vector3(0, 1, 0);
    const angles: number[] = [];
    for (let i = 0; i + 3 < track.values.length; i += 4) {
      const q = new THREE.Quaternion(
        track.values[i], track.values[i + 1], track.values[i + 2], track.values[i + 3],
      );
      const rel = bindInv.clone().multiply(q);
      angles.push(signedAngleAbout(swingTwist(rel, axis).twist, axis));
    }
    if (!angles.length) continue;

    // Circular mean handles a baseline sitting at +180/-180 without treating
    // the wrap as a 360° animation.
    let sx = 0;
    let sy = 0;
    for (const deg of angles) {
      const r = THREE.MathUtils.degToRad(deg);
      sx += Math.cos(r);
      sy += Math.sin(r);
    }
    const baseline = THREE.MathUtils.radToDeg(Math.atan2(sy, sx));
    const deviations = angles
      .map((deg) => Math.abs(((deg - baseline + 180) % 360 + 360) % 360 - 180))
      .sort((a, b) => a - b);
    const p90 = deviations[Math.min(deviations.length - 1, Math.floor(deviations.length * 0.9))];

    if (Math.abs(baseline) <= 120 || p90 > 25) continue;

    const remove = new THREE.Quaternion().setFromAxisAngle(
      axis, THREE.MathUtils.degToRad(-baseline),
    );
    for (let i = 0; i + 3 < track.values.length; i += 4) {
      const q = new THREE.Quaternion(
        track.values[i], track.values[i + 1], track.values[i + 2], track.values[i + 3],
      );
      // q = bind * swing * twist. Axial twists commute, so subtract the
      // convention offset on the relative side before restoring the bind.
      const rel = bindInv.clone().multiply(q);
      const parts = swingTwist(rel, axis);
      const fixed = bind.clone().multiply(parts.swing).multiply(parts.twist).multiply(remove);
      track.values[i] = fixed.x;
      track.values[i + 1] = fixed.y;
      track.values[i + 2] = fixed.z;
      track.values[i + 3] = fixed.w;
    }
    out.push({ bone, baselineDeg: +baseline.toFixed(1), keys: angles.length });
  }

  return out;
}

export interface LimitViolation {
  bone: string;
  /** Worst bend seen, degrees, before clamping. */
  bend: number;
  /** Worst twist seen, degrees, before clamping. */
  twist: number;
}

/**
 * Hold every limited joint inside its range, measured from the model's bind.
 *
 * Operates on the FINAL, bind-relative clip, so the reference is the pose the
 * fighter actually rests in rather than some source rig's idea of neutral.
 * The clip is modified in place and the violations are returned, so a bake can
 * report what it had to correct instead of silently repairing bad data.
 */
export function clampToJointLimits(
  clip: THREE.AnimationClip,
  restMap: Map<string, THREE.Quaternion>,
  limits: Readonly<Record<string, JointLimit>> = JOINT_LIMITS,
  /**
   * Bones a hinge constraint already owns. A HINGE IS THE COMPLETE
   * CONSTRAINT for that joint, and the two rules disagree about the axis:
   * this one decomposes about the bone's length (Y) while a hinge decomposes
   * about its own axis (Z). MEASURED — running both left the knees 20 to 22
   * degrees off their hinge, because capping the Y-twist afterwards
   * reintroduced exactly the off-axis rotation the hinge had just removed.
   */
  ownedByHinge: Readonly<Record<string, unknown>> = HINGE_JOINTS,
): LimitViolation[] {
  const violations: LimitViolation[] = [];
  const axis = new THREE.Vector3(0, 1, 0); // bone length runs up the local Y on this rig
  for (const track of clip.tracks) {
    if (!track.name.endsWith('.quaternion')) continue;
    const bone = track.name.slice(0, -'.quaternion'.length);
    if (ownedByHinge[bone]) continue;
    const limit = limits[bone];
    const bind = restMap.get(bone);
    if (!limit || !bind) continue;

    const bindInv = bind.clone().invert();
    const values = track.values;
    let worstBend = 0;
    let worstTwist = 0;
    let touched = false;

    for (let i = 0; i + 3 < values.length; i += 4) {
      const q = new THREE.Quaternion(values[i], values[i + 1], values[i + 2], values[i + 3]);
      const rel = bindInv.clone().multiply(q);
      const { swing, twist } = swingTwist(rel, axis);
      const bendDeg = angleDeg(swing);
      const twistDeg = angleDeg(twist);
      if (bendDeg > worstBend) worstBend = bendDeg;
      if (twistDeg > worstTwist) worstTwist = twistDeg;
      if (bendDeg <= limit.bend && twistDeg <= limit.twist) continue;

      // ITERATE. A swing and a twist only recompose exactly when the swing
      // has no component along the twist axis, which is not guaranteed — so
      // capping both at once can leave the result over. MEASURED on
      // CAPITALPUNISHMENT: a shoulder still reading 161 degrees of twist
      // against a 90 limit after a single pass. This runs offline in the
      // bake, so converging costs nothing.
      let fixed = bind.clone()
        .multiply(capped(swing, limit.bend))
        .multiply(capped(twist, limit.twist));
      for (let pass = 0; pass < 4; pass++) {
        const check = swingTwist(bindInv.clone().multiply(fixed), axis);
        const b = angleDeg(check.swing);
        const t = angleDeg(check.twist);
        if (b <= limit.bend + 0.25 && t <= limit.twist + 0.25) break;
        fixed = bind.clone()
          .multiply(capped(check.swing, limit.bend))
          .multiply(capped(check.twist, limit.twist));
      }
      values[i] = fixed.x;
      values[i + 1] = fixed.y;
      values[i + 2] = fixed.z;
      values[i + 3] = fixed.w;
      touched = true;
    }

    if (touched) violations.push({ bone, bend: +worstBend.toFixed(1), twist: +worstTwist.toFixed(1) });
  }
  return violations;
}

/**
 * Share a chain's rotation across every segment the target skeleton has.
 *
 * A source with a two-segment spine leaves Spine1 at bind and pushes its whole
 * bend through Spine and Spine2. Nothing is wrong with the DATA; there is
 * simply one fewer joint to spend it on, and a joint asked to do another
 * joint's work is what a body folding in the wrong place looks like.
 *
 * Takes the rotation already on the driven segments, measured from bind, and
 * re-spreads it evenly over the whole chain. Total rotation is preserved, so
 * the pose the animator authored is the pose that comes out — it just arrives
 * through three joints instead of two.
 *
 * Does nothing when the source already drives the whole chain, so the Bannon
 * bank (which has Spine1) is untouched.
 */
export function redistributeChain(
  clip: THREE.AnimationClip,
  chain: readonly string[],
  restMap: Map<string, THREE.Quaternion>,
): boolean {
  const tracks = new Map<string, THREE.QuaternionKeyframeTrack>();
  for (const track of clip.tracks) {
    if (!(track instanceof THREE.QuaternionKeyframeTrack)) continue;
    const bone = track.name.slice(0, -'.quaternion'.length);
    if (chain.includes(bone)) tracks.set(bone, track);
  }
  const missing = chain.filter((b) => !tracks.has(b) && restMap.has(b));
  if (missing.length === 0 || tracks.size === 0) return false;

  // Every segment in the chain must share the same key times before their
  // rotations can be combined; resampling here would invent data, so a chain
  // whose driven segments disagree is left alone and reported by the caller.
  const first = tracks.values().next().value!;
  const times = first.times;
  for (const t of tracks.values()) {
    if (t.times.length !== times.length) return false;
  }

  const driven = [...tracks.entries()];
  const share = 1 / chain.length;
  const out = new Map<string, Float32Array>();
  for (const bone of chain) out.set(bone, new Float32Array(times.length * 4));

  for (let k = 0; k < times.length; k++) {
    // Total rotation the chain performs at this key, measured from bind.
    const total = new THREE.Quaternion();
    for (const [bone, track] of driven) {
      const bind = restMap.get(bone);
      if (!bind) continue;
      const q = new THREE.Quaternion(
        track.values[k * 4], track.values[k * 4 + 1], track.values[k * 4 + 2], track.values[k * 4 + 3],
      );
      total.multiply(bind.clone().invert().multiply(q));
    }
    // An equal share for each segment, composed back onto its own bind.
    const part = new THREE.Quaternion().slerp(total, share);
    for (const bone of chain) {
      const bind = restMap.get(bone) ?? new THREE.Quaternion();
      const q = bind.clone().multiply(part);
      const arr = out.get(bone)!;
      arr[k * 4] = q.x; arr[k * 4 + 1] = q.y; arr[k * 4 + 2] = q.z; arr[k * 4 + 3] = q.w;
    }
  }

  clip.tracks = clip.tracks.filter((t) => !chain.includes(t.name.slice(0, -'.quaternion'.length)));
  for (const bone of chain) {
    clip.tracks.push(new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, Array.from(times), out.get(bone)!));
  }
  return true;
}

/**
 * ELBOWS AND KNEES ARE HINGES. They bend one way, about one axis.
 *
 * Owner, on the BOXING clip: "his arm is folding backwards towards his
 * shoulder blade ... and then the other arm is like twisting out towards the
 * wrong direction." That is a hinge with no hinge constraint. Capping the
 * MAGNITUDE of a bend, which clampToJointLimits does, cannot stop a fold in
 * the wrong direction or a knee bending sideways — only a 1-DOF constraint can.
 *
 * DERIVED FROM THE DATA, not assumed. Across both banks (9,647 samples per
 * bone), the rotation of every forearm and shin concentrates on LOCAL Z:
 *
 *   LeftForeArm   Z 51%  X 28%  Y 22%        LeftLeg   Z 44%  X 34%  Y 22%
 *   RightForeArm  Z 55%  X 34%  Y 12%        RightLeg  Z 50%  X 32%  Y 18%
 *
 * So Z is the hinge. And the signed range over the banks was -180 to +180 —
 * these joints were bending the whole way round, in both directions.
 *
 * WHICH DIRECTION IS FLEXION had to be measured too, because THE TWO BANKS
 * DISAGREE, and that disagreement is the bug:
 *
 *   LeftForeArm   Bannon 62% positive   Schwarzerblitz 85% negative
 *   LeftLeg       Bannon 77% negative   Schwarzerblitz 94% positive
 *
 * One of them is hinging backwards. Schwarzerblitz is the reference: it is
 * authored fighting animation on one consistent rig, and it is the set whose
 * stances and strikes the owner confirmed look right, while the Bannon-bank
 * BOXING is the clip he reported folding backwards. So flexion is NEGATIVE
 * about Z at the elbow and POSITIVE about Z at the knee, and a clip that
 * disagrees is corrected rather than believed.
 *
 * OFF-AXIS is capped hard as well: measured p95 of the off-hinge swing ran
 * 44 to 116 degrees, and a knee has essentially none.
 *
 * THE DIRECTION IS CONFIRMED FROM THE BODY, not from whichever bank was
 * trusted. A hinge flexes when the far end comes TOWARD the joint above it:
 * bending an elbow brings the hand closer to the shoulder. Rotating each bone
 * 45 degrees each way about Z in the bind pose and measuring that distance on
 * the shipped rig:
 *
 *   joint          Z +45      Z -45     flexion
 *   LeftForeArm   -2.2 cm    -4.5 cm    NEGATIVE
 *   RightForeArm  -0.7 cm    -6.1 cm    NEGATIVE
 *   LeftLeg      -11.8 cm    -2.6 cm    POSITIVE
 *   RightLeg     -12.3 cm    -2.2 cm    POSITIVE
 *
 * Y moves the tip 0.0 cm either way, which is the same answer as the twist
 * decomposition: Y is the bone's length. So the geometry and Schwarzerblitz
 * agree, and the Bannon bank is the one whose forearms are sign-flipped.
 *
 * WHICH IS WHY A CLAMP IS NOT ENOUGH. Clamping a flipped elbow pins it at the
 * boundary — a straight, locked arm, which is what the owner saw as "the left
 * arm is doing like an elbow strike". A fold that is clearly on the wrong
 * side is REFLECTED instead: the joint bends the same amount, the way the
 * joint actually bends. Small over-travel is still clamped, because a few
 * degrees past straight is slack, not a sign error.
 */
export interface HingeJoint {
  /** The joint's one axis of rotation, in its own local space. */
  axis: THREE.Vector3;
  /** Signed flexion range about that axis, degrees. */
  min: number;
  max: number;
  /** How far off the hinge the joint may swing at all, degrees. */
  maxOffAxis: number;
}

const HINGE_Z = () => new THREE.Vector3(0, 0, 1);

/**
 * Past this, a bend on the wrong side of a hinge is treated as a flipped sign
 * rather than over-travel. Below it, a few degrees past straight is the slack
 * in a straight limb and is simply clamped.
 */
export const WRONG_SIDE_DEG = 25;

export const HINGE_JOINTS: Readonly<Record<string, HingeJoint>> = {
  // Elbow: flexion is negative about Z here; a few degrees the other way is
  // the normal slack in a straight arm, not hyperextension.
  mixamorigLeftForeArm:  { axis: HINGE_Z(), min: -150, max: 8, maxOffAxis: 18 },
  mixamorigRightForeArm: { axis: HINGE_Z(), min: -150, max: 8, maxOffAxis: 18 },
  // Knee: flexion is positive about Z.
  mixamorigLeftLeg:      { axis: HINGE_Z(), min: -8, max: 150, maxOffAxis: 18 },
  mixamorigRightLeg:     { axis: HINGE_Z(), min: -8, max: 150, maxOffAxis: 18 },
};

/** Signed rotation about `axis`, degrees, in (-180, 180]. */
export function signedAngleAbout(q: THREE.Quaternion, axis: THREE.Vector3): number {
  const v = new THREE.Vector3(q.x, q.y, q.z).dot(axis);
  let deg = (2 * Math.atan2(v, q.w) * 180) / Math.PI;
  while (deg > 180) deg -= 360;
  while (deg <= -180) deg += 360;
  return deg;
}

export interface HingeViolation {
  bone: string;
  /** Worst signed flexion seen before correction, degrees. */
  worstAngle: number;
  /** Worst off-hinge swing seen before correction, degrees. */
  worstOffAxis: number;
  /** How many keys were outside the hinge. */
  keys: number;
}

/**
 * Hold every hinge joint on its own axis and inside its own direction.
 *
 * Runs on the FINAL bind-relative clip, so the reference is the fighter's own
 * rest. Modified in place; the violations are returned so a bake can report
 * what it corrected rather than silently repairing bad data.
 */
export function constrainHinges(
  clip: THREE.AnimationClip,
  restMap: Map<string, THREE.Quaternion>,
  hinges: Readonly<Record<string, HingeJoint>> = HINGE_JOINTS,
): HingeViolation[] {
  const out: HingeViolation[] = [];
  for (const track of clip.tracks) {
    if (!track.name.endsWith('.quaternion')) continue;
    const bone = track.name.slice(0, -'.quaternion'.length);
    const hinge = hinges[bone];
    const bind = restMap.get(bone);
    if (!hinge || !bind) continue;

    const bindInv = bind.clone().invert();
    const values = track.values;
    let worstAngle = 0;
    let worstOffAxis = 0;
    let keys = 0;

    for (let i = 0; i + 3 < values.length; i += 4) {
      const rel = bindInv.clone().multiply(
        new THREE.Quaternion(values[i], values[i + 1], values[i + 2], values[i + 3]),
      );
      const { swing, twist } = swingTwist(rel, hinge.axis);
      const angle = signedAngleAbout(twist, hinge.axis);
      const offAxis = angleDeg(swing);
      if (Math.abs(angle) > Math.abs(worstAngle)) worstAngle = angle;
      if (offAxis > worstOffAxis) worstOffAxis = offAxis;

      // A fold clearly on the wrong side is a SIGN ERROR, not over-travel:
      // reflect it so the joint bends the same amount the way it really
      // bends. Clamping it instead pins the limb straight at the boundary.
      const flipped = -angle;
      const wrongSide =
        Math.abs(angle) > WRONG_SIDE_DEG &&
        (angle < hinge.min || angle > hinge.max) &&
        flipped >= hinge.min && flipped <= hinge.max;
      const corrected = wrongSide ? flipped : angle;
      const wanted = Math.min(hinge.max, Math.max(hinge.min, corrected));
      const overOff = offAxis > hinge.maxOffAxis;
      if (wanted === angle && !overOff) continue;

      // ITERATE. Capping the swing and recomposing it with a DIFFERENT twist
      // reintroduces a little off-axis rotation — measured at 1 to 4 degrees
      // over, which is enough to fail the bake's own gate. Two more passes
      // converge it; this runs offline, so the cost is nothing.
      let off = overOff ? capped(swing, hinge.maxOffAxis) : swing;
      let flex = new THREE.Quaternion().setFromAxisAngle(hinge.axis, (wanted * Math.PI) / 180);
      let fixed = bind.clone().multiply(off).multiply(flex);
      for (let pass = 0; pass < 3; pass++) {
        const check = swingTwist(bindInv.clone().multiply(fixed), hinge.axis);
        const checkOff = angleDeg(check.swing);
        const checkAngle = signedAngleAbout(check.twist, hinge.axis);
        if (checkOff <= hinge.maxOffAxis && checkAngle >= hinge.min && checkAngle <= hinge.max) break;
        off = capped(check.swing, hinge.maxOffAxis);
        flex = new THREE.Quaternion().setFromAxisAngle(
          hinge.axis,
          (Math.min(hinge.max, Math.max(hinge.min, checkAngle)) * Math.PI) / 180,
        );
        fixed = bind.clone().multiply(off).multiply(flex);
      }
      values[i] = fixed.x;
      values[i + 1] = fixed.y;
      values[i + 2] = fixed.z;
      values[i + 3] = fixed.w;
      keys++;
    }

    if (keys > 0) {
      out.push({
        bone,
        worstAngle: +worstAngle.toFixed(1),
        worstOffAxis: +worstOffAxis.toFixed(1),
        keys,
      });
    }
  }
  return out;
}
