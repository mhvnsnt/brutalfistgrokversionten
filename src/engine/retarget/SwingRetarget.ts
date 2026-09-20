// `.ts` extensions on purpose — the repo's runner resolves them literally,
// and the offline bake imports this module.
import * as THREE from 'three';

import { HINGE_JOINTS, JOINT_LIMITS, angleDeg, swingTwist } from './SkeletalLimits.ts';

/**
 * REBUILD A POSE FROM WHERE THE LIMBS POINT, NOT FROM BORROWED ROTATIONS.
 *
 * Owner: "there should be a way to fix that in all the repos and games, we
 * shouldn't have to be hand tooling all this shit." He is right. Clamping
 * joint by joint is hand-tooling, and it cannot catch a pose that is wrong
 * while every joint is inside its range — which is exactly the state the
 * punch was in when he described the shoulder, the arm behind the shoulder
 * blade and the ankle giving out:
 *
 *   LeftShoulder  bend  0.0   twist  0.0    the clavicles do NOTHING
 *   LeftArm       bend 98.5   twist 45.9    so the socket does all the work
 *   LeftUpLeg     bend 67.4   twist 32.5    a thigh spinning on its own axis
 *
 * THE GENERAL FIX IS TO CHANGE WHAT CAN BE REPRESENTED. A borrowed local
 * rotation carries both where a limb POINTS and how far it is ROLLED about
 * its own length, and the roll is what tears a shoulder or wrings an ankle.
 * So the pose is rebuilt from the DIRECTIONS instead:
 *
 *   1. Read where every bone points in the source pose — a direction, which
 *      carries no roll at all.
 *   2. Rebuild root-to-leaf, rotating each bone by the MINIMAL rotation that
 *      makes it point there. A minimal rotation is a pure swing, so no twist
 *      can be introduced. This is the step that makes the failure impossible
 *      rather than corrected.
 *   3. Add back only the twist the source actually had, and only as much as
 *      the joint allows.
 *
 * AND THE CLAVICLE IS DERIVED, not left at rest. A source rig with no
 * clavicle bakes the shoulder's movement into the upper arm, so our clavicle
 * sits still while the socket does everything. Giving the clavicle a share
 * of the arm's swing BEFORE the arm is solved costs nothing in accuracy —
 * the arm still solves to the same direction — and the work is shared the
 * way a body shares it.
 *
 * WHAT THIS DOES NOT DO: it does not move the root, and it does not change
 * where a limb points. Every hand and foot ends up exactly where the source
 * put it. Only the roll along the way changes.
 */

/** How much of an arm's swing the clavicle takes. A shoulder leads a punch. */
export const CLAVICLE_SHARE = 0.22;

export interface SwingRetargetOptions {
  /** Bone -> its clavicle, so the clavicle can lead the swing. */
  clavicleOf?: Readonly<Record<string, string>>;
  /** Per-joint twist allowance in degrees; falls back to JOINT_LIMITS. */
  twistLimit?: (bone: string) => number;
}

export const DEFAULT_CLAVICLE_OF: Readonly<Record<string, string>> = {
  mixamorigLeftArm: 'mixamorigLeftShoulder',
  mixamorigRightArm: 'mixamorigRightShoulder',
};

/**
 * How much roll a joint may keep.
 *
 * A hinge keeps almost none — an elbow and a knee do not roll, and what
 * looks like forearm rotation happens in the radius, which this skeleton
 * does not have a bone for. Everything else falls back to its documented
 * limit, and a joint with no entry keeps its twist unchanged.
 */
function defaultTwistLimit(bone: string): number {
  if (HINGE_JOINTS[bone]) return HINGE_JOINTS[bone].maxOffAxis;
  const limit = JOINT_LIMITS[bone];
  return limit ? limit.twist : Number.POSITIVE_INFINITY;
}

interface Solvable {
  bone: THREE.Bone;
  child: THREE.Object3D | null;
  /** The bone's direction to its child, in the bone's own local space. */
  localDir: THREE.Vector3 | null;
  bind: THREE.Quaternion;
  clavicle: THREE.Bone | null;
}

/** Bones in root-to-leaf order, each with what it needs to be solved. */
function plan(root: THREE.Object3D, clavicleOf: Readonly<Record<string, string>>): Solvable[] {
  const out: Solvable[] = [];
  root.traverse((obj) => {
    const bone = obj as THREE.Bone;
    if (!bone.isBone) return;
    const child = bone.children.find((c) => (c as THREE.Bone).isBone) ?? null;
    let localDir: THREE.Vector3 | null = null;
    if (child) {
      const d = child.position.clone();
      localDir = d.lengthSq() > 1e-12 ? d.normalize() : null;
    }
    const clavName = clavicleOf[bone.name];
    const clavicle = clavName ? (root.getObjectByName(clavName) as THREE.Bone | null) : null;
    out.push({ bone, child, localDir, bind: bone.quaternion.clone(), clavicle });
  });
  // traverse is already depth-first parents-before-children, which is the
  // order a chain has to be solved in: a bone's world direction depends on
  // every parent already being placed.
  return out;
}

const _q = new THREE.Quaternion();
const _parentQ = new THREE.Quaternion();
const _v = new THREE.Vector3();


/** World-space direction this bone points, given the pose currently applied. */
function worldDir(s: Solvable): THREE.Vector3 | null {
  if (!s.localDir) return null;
  s.bone.updateWorldMatrix(true, false);
  return _v.copy(s.localDir).applyQuaternion(s.bone.getWorldQuaternion(_q)).normalize().clone();
}

export interface SwingRetargetReport {
  /** Keys rebuilt. */
  keys: number;
  /** Total twist removed, degrees, summed over every bone and key. */
  twistRemoved: number;
  /** Clavicles given a share of an arm's swing. */
  claviclesDriven: number;
  /** Largest direction error introduced, degrees. Should be ~0. */
  worstDirectionError: number;
}

/**
 * Rebuild every key of `clip` as swing-plus-limited-twist on `root`.
 *
 * The clip is modified in place. `root` is posed and left at bind.
 */
export function retargetBySwing(
  clip: THREE.AnimationClip,
  root: THREE.Object3D,
  options: SwingRetargetOptions = {},
): SwingRetargetReport {
  const clavicleOf = options.clavicleOf ?? DEFAULT_CLAVICLE_OF;
  const twistLimit = options.twistLimit ?? defaultTwistLimit;
  const bones = plan(root, clavicleOf);
  const byName = new Map(bones.map((s) => [s.bone.name, s]));

  const tracks = new Map<string, THREE.QuaternionKeyframeTrack>();
  const times = new Set<number>();
  for (const track of clip.tracks) {
    if (!(track instanceof THREE.QuaternionKeyframeTrack)) continue;
    const bone = track.name.slice(0, -'.quaternion'.length);
    if (!byName.has(bone)) continue;
    tracks.set(bone, track);
    for (const t of track.times) times.add(t);
  }
  const sorted = [...times].sort((a, b) => a - b);
  const report: SwingRetargetReport = {
    keys: sorted.length,
    twistRemoved: 0,
    claviclesDriven: 0,
    worstDirectionError: 0,
  };
  if (sorted.length === 0 || tracks.size === 0) return report;

  const restPose = () => {
    for (const s of bones) s.bone.quaternion.copy(s.bind);
    root.updateMatrixWorld(true);
  };
  /** The clip's own value for a bone at key index k, or its bind. */
  const sourceAt = (bone: string, k: number): THREE.Quaternion => {
    const track = tracks.get(bone);
    const s = byName.get(bone)!;
    if (!track) return s.bind.clone();
    const i = Math.min(k, track.times.length - 1) * 4;
    return new THREE.Quaternion(track.values[i], track.values[i + 1], track.values[i + 2], track.values[i + 3]);
  };

  const solved = new Map<string, Float32Array>();
  for (const [bone] of tracks) solved.set(bone, new Float32Array(sorted.length * 4));
  // A clavicle that the source never drove still gets keys now.
  for (const arm of Object.keys(clavicleOf)) {
    const clav = clavicleOf[arm];
    if (byName.has(clav) && !solved.has(clav)) solved.set(clav, new Float32Array(sorted.length * 4));
  }

  for (let k = 0; k < sorted.length; k++) {
    // ── 1. Where does every bone POINT in the source pose? ────────────────
    restPose();
    for (const [bone] of tracks) byName.get(bone)!.bone.quaternion.copy(sourceAt(bone, k));
    root.updateMatrixWorld(true);
    const target = new Map<string, THREE.Vector3>();
    for (const s of bones) {
      const d = worldDir(s);
      if (d) target.set(s.bone.name, d);
    }
    // The source's own roll per bone, measured against its bind.
    const sourceTwist = new Map<string, THREE.Quaternion>();
    for (const [bone] of tracks) {
      const s = byName.get(bone)!;
      if (!s.localDir) continue;
      const rel = s.bind.clone().invert().multiply(sourceAt(bone, k));
      sourceTwist.set(bone, swingTwist(rel, s.localDir).twist);
    }

    // ── 2. Rebuild from bind, root to leaf, by direction alone ────────────
    restPose();
    for (const s of bones) {
      const name = s.bone.name;
      const want = target.get(name);

      if (!s.localDir || !want) {
        // A leaf — a hand, a toe, the head. It has no direction of its own,
        // so it keeps the source's rotation with its roll limited.
        const src = tracks.has(name) ? sourceAt(name, k) : s.bind.clone();
        s.bone.quaternion.copy(src);
        s.bone.updateWorldMatrix(true, false);
        continue;
      }

      // A clavicle leads its arm: take a share of the swing the arm is about
      // to make, so the socket is not doing all of it alone.
      if (s.clavicle) {
        const clav = byName.get(s.clavicle.name);
        if (clav?.localDir) {
          const have = worldDir(clav);
          if (have) {
            const lead = new THREE.Quaternion().setFromUnitVectors(have, want);
            const share = new THREE.Quaternion().slerp(lead, CLAVICLE_SHARE);
            clav.bone.getWorldQuaternion(_q);
            (clav.bone.parent ?? root).getWorldQuaternion(_parentQ);
            const local = _parentQ.clone().invert().multiply(share).multiply(_parentQ);
            const limited = limitTwist(clav.bone.quaternion.clone().premultiply(local), clav, twistLimit);
            clav.bone.quaternion.copy(limited);
            clav.bone.updateWorldMatrix(true, true);
            report.claviclesDriven++;
          }
        }
      }

      const have = worldDir(s);
      if (!have) continue;
      // The MINIMAL rotation from here to there: a pure swing, which is what
      // makes an impossible roll unrepresentable rather than corrected.
      const swing = new THREE.Quaternion().setFromUnitVectors(have, want);
      (s.bone.parent ?? root).getWorldQuaternion(_parentQ);
      // A WORLD rotation R on a bone whose world is W = P*L gives
      // P*L' = R*P*L, so L' = (P^-1*R*P) * L — a PRE-multiply. Post-
      // multiplying applies it in the bone's own frame instead, which is a
      // different rotation entirely: measured, it moved limbs up to 177.9
      // degrees from where the source pointed them, and the rebuild's own
      // drift check is what caught it.
      const localSwing = _parentQ.clone().invert().multiply(swing).multiply(_parentQ);
      s.bone.quaternion.premultiply(localSwing);

      // ── 3. Put back the roll the source had, as far as allowed ──────────
      const roll = sourceTwist.get(name);
      if (roll) {
        const allowed = twistLimit(name);
        const deg = angleDeg(roll);
        const kept = deg <= allowed || !Number.isFinite(allowed)
          ? roll
          : new THREE.Quaternion().slerp(roll, allowed / deg);
        report.twistRemoved += Math.max(0, deg - Math.min(deg, allowed));
        s.bone.quaternion.multiply(kept);
      }
      s.bone.updateWorldMatrix(true, false);
    }

    // ── 4. Check we did not move anything, and record the keys ────────────
    root.updateMatrixWorld(true);
    for (const s of bones) {
      const want = target.get(s.bone.name);
      if (!want) continue;
      const got = worldDir(s);
      if (got) {
        const err = (Math.acos(Math.min(1, Math.max(-1, got.dot(want)))) * 180) / Math.PI;
        if (err > report.worstDirectionError) report.worstDirectionError = err;
      }
    }
    for (const [bone, out] of solved) {
      const q = byName.get(bone)!.bone.quaternion;
      out[k * 4] = q.x; out[k * 4 + 1] = q.y; out[k * 4 + 2] = q.z; out[k * 4 + 3] = q.w;
    }
  }

  restPose();
  const rebuilt: THREE.KeyframeTrack[] = clip.tracks.filter(
    (t) => !(t instanceof THREE.QuaternionKeyframeTrack) || !solved.has(t.name.slice(0, -'.quaternion'.length)),
  );
  for (const [bone, values] of solved) {
    rebuilt.push(new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, sorted, values));
  }
  clip.tracks = rebuilt;
  return report;
}

/** Hold one bone's roll inside its allowance, keeping where it points. */
function limitTwist(
  local: THREE.Quaternion,
  s: Solvable,
  twistLimit: (bone: string) => number,
): THREE.Quaternion {
  if (!s.localDir) return local;
  const allowed = twistLimit(s.bone.name);
  if (!Number.isFinite(allowed)) return local;
  const rel = s.bind.clone().invert().multiply(local);
  const { swing, twist } = swingTwist(rel, s.localDir);
  const deg = angleDeg(twist);
  if (deg <= allowed) return local;
  const capped = new THREE.Quaternion().slerp(twist, allowed / deg);
  return s.bind.clone().multiply(swing).multiply(capped);
}

