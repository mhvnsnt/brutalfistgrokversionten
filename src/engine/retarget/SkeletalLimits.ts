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
): LimitViolation[] {
  const violations: LimitViolation[] = [];
  const axis = new THREE.Vector3(0, 1, 0); // bone length runs up the local Y on this rig
  for (const track of clip.tracks) {
    if (!track.name.endsWith('.quaternion')) continue;
    const bone = track.name.slice(0, -'.quaternion'.length);
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

      const fixed = bind.clone()
        .multiply(capped(swing, limit.bend))
        .multiply(capped(twist, limit.twist));
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
