import * as THREE from 'three';
import { BANNON_MOTION_BANK } from '../../generated/BannonMotionBank.generated';

export interface BannonMotionClipData {
  dur: number;
  keys: Array<{
    t: number;
    bones: Record<string, { rx: number; ry: number; rz: number }>;
  }>;
}

export const BANNON_MOTION_CLIP_NAMES = new Set(Object.keys(BANNON_MOTION_BANK));

const QUATERNION_BONE_NAMES = new Set<string>([
  'mixamorigHips', 'mixamorigSpine', 'mixamorigSpine1', 'mixamorigSpine2',
  'mixamorigNeck', 'mixamorigHead',
  'mixamorigLeftShoulder', 'mixamorigLeftArm', 'mixamorigLeftForeArm', 'mixamorigLeftHand',
  'mixamorigRightShoulder', 'mixamorigRightArm', 'mixamorigRightForeArm', 'mixamorigRightHand',
  'mixamorigLeftUpLeg', 'mixamorigLeftLeg', 'mixamorigLeftFoot', 'mixamorigLeftToeBase',
  'mixamorigRightUpLeg', 'mixamorigRightLeg', 'mixamorigRightFoot', 'mixamorigRightToeBase',
]);

/**
 * Collapse a Mixamo namespace onto the canonical bone name.
 *
 * Exporters stamp the rig's namespace into every bone: Maya/FBX writes
 * `mixamorig:Hips`, and Mixamo auto-numbers a second rig as `mixamorig9Hips`.
 * Measured over the indexed Bannon bank, 50 clips matched no bone at all for
 * this reason and built zero tracks — including the project's own ZONE_ ring
 * transitions and the owner's TIGER_FEINT_KICK / JUNGLE_JUICE captures.
 *
 * Verified before applying: no clip carries two distinct raw bones that collapse
 * onto the same canonical bone, so an attacker's and a receiver's skeleton can
 * never be merged by this. Already-canonical names are returned unchanged.
 *
 * scripts/sync-bannon-motion.mjs applies the identical rule when building the
 * generated cache; this keeps direct callers of makeClip in step with it.
 */
function canonicalBoneName(name: string): string {
  return name.replace(/^mixamorig[0-9:_\-.\s]*(?=[A-Z])/, 'mixamorig');
}

function makeClip(name: string, data: BannonMotionClipData): THREE.AnimationClip {
  /** canonical bone name -> the raw key it came from in this clip */
  const boneNames = new Map<string, string>();
  for (const key of data.keys) {
    for (const bone of Object.keys(key.bones)) {
      const canonical = canonicalBoneName(bone);
      if (QUATERNION_BONE_NAMES.has(canonical)) boneNames.set(canonical, bone);
    }
  }

  const tracks: THREE.KeyframeTrack[] = [];
  for (const [bone, rawBone] of boneNames) {
    const times: number[] = [];
    const values: number[] = [];
    for (const key of data.keys) {
      const e = key.bones[rawBone] ?? key.bones[bone];
      if (!e) continue;
      const q = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(e.rx, e.ry, e.rz, 'XYZ'),
      );
      times.push(key.t);
      values.push(q.x, q.y, q.z, q.w);
    }
    if (times.length >= 2) {
      tracks.push(new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, times, values));
    }
  }

  const clip = new THREE.AnimationClip(name, data.dur, tracks);
  (clip as THREE.AnimationClip & { userData: Record<string, unknown> }).userData = {
    clipSourceType: 'BANNON_OWNER_MOTION',
    source: 'mhvnsnt/Bannon/assets/moves/clips',
    sourceConvention: 'mixamo',
    ownerGranted: true,
    loop: false,
  };
  return clip;
}

/** Build the real owner-granted Bannon motion bank synchronously from the generated cache. */
export function buildBannonMotionClips(): THREE.AnimationClip[] {
  return Object.entries(BANNON_MOTION_BANK).map(([name, data]) => makeClip(name, data as BannonMotionClipData));
}

/**
 * Preserve the target GLB's locked rest pose while importing source motion.
 * For every quaternion track:
 *   q(t) = q_bind × q_src(0)^-1 × q_src(t)
 *
 * The world-space fighter transform is never touched here; only local bone
 * rotation tracks are rewritten. This is the orientation-safe Mixamo/Euler bank.
 */
export function applyBindRelativeQuaternionTracks(
  clip: THREE.AnimationClip,
  targetScene: THREE.Object3D,
): THREE.AnimationClip {
  const tracks = clip.tracks.map((track) => {
    if (!(track instanceof THREE.QuaternionKeyframeTrack)) return track;

    const dot = track.name.lastIndexOf('.');
    if (dot < 0 || track.name.slice(dot + 1) !== 'quaternion') return track;
    const boneName = track.name.slice(0, dot).split('|').pop() ?? '';
    const bone = targetScene.getObjectByName(boneName) as THREE.Bone | undefined;
    if (!bone || track.values.length < 4) return track;

    const qBind = bone.quaternion.clone();
    const qSrc0 = new THREE.Quaternion(
      track.values[0], track.values[1], track.values[2], track.values[3],
    );
    const qSrc0Inv = qSrc0.clone().invert();
    const values = new Float32Array(track.values.length);

    for (let i = 0; i < track.values.length; i += 4) {
      const qSrc = new THREE.Quaternion(
        track.values[i], track.values[i + 1], track.values[i + 2], track.values[i + 3],
      );
      const q = qBind.clone().multiply(qSrc0Inv).multiply(qSrc).normalize();
      values[i] = q.x;
      values[i + 1] = q.y;
      values[i + 2] = q.z;
      values[i + 3] = q.w;
    }

    return new THREE.QuaternionKeyframeTrack(track.name, track.times, values, track.getInterpolation());
  });

  const out = new THREE.AnimationClip(clip.name, clip.duration, tracks);
  out.userData = { ...clip.userData, bindRelative: true };
  return out;
}
