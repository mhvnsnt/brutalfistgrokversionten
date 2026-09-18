// `.ts` / explicit extensions on purpose: they are what let the repo's own
// runner (`node --experimental-strip-types --test`) resolve this module.
// tsconfig sets allowImportingTsExtensions and Vite/esbuild resolve them
// unchanged. Without them these invariants cannot be tested at all.
import * as THREE from 'three';
import { BANNON_MOTION_BANK } from '../../generated/BannonMotionBank.generated.ts';
import { resolveRuntimeBone } from './boneNameMap.mjs';

export interface BannonMotionClipData {
  dur: number;
  keys: Array<{
    t: number;
    bones: Record<string, { rx: number; ry: number; rz: number }>;
  }>;
}

export const BANNON_MOTION_CLIP_NAMES = new Set(Object.keys(BANNON_MOTION_BANK));

/** Provenance stamped onto every clip a Euler bank produces. */
export interface EulerBankSource {
  clipSourceType: string;
  source: string;
  sourceConvention: string;
}

function makeClip(
  name: string,
  data: BannonMotionClipData,
  provenance: EulerBankSource = BANNON_SOURCE,
): THREE.AnimationClip {
  /**
   * runtime bone -> the raw key it came from in this clip.
   *
   * The source clips speak three vocabularies (canonical Mixamo, a namespaced
   * Mixamo export, and the `J_` rig); boneNameMap.mjs is the single translation
   * layer, shared with scripts/sync-bannon-motion.mjs so the cache and the
   * runtime cannot disagree. Measured across the bank, no clip has two raw
   * bones resolving to the same runtime bone, so this cannot merge two rigs.
   */
  const boneNames = new Map<string, string>();
  for (const key of data.keys) {
    for (const bone of Object.keys(key.bones)) {
      const runtimeBone = resolveRuntimeBone(bone);
      if (runtimeBone) boneNames.set(runtimeBone, bone);
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
    ...provenance,
    ownerGranted: true,
    loop: false,
  };
  return clip;
}

const BANNON_SOURCE: EulerBankSource = {
  clipSourceType: 'BANNON_OWNER_MOTION',
  source: 'mhvnsnt/Bannon/assets/moves/clips',
  sourceConvention: 'mixamo',
};

/**
 * Build AnimationClips from any bank in the cached Euler format.
 *
 * Shared so a second owner-granted source cannot drift from the first: the same
 * bone resolution, the same XYZ Euler order and the same track construction.
 */
export function buildClipsFromEulerBank(
  bank: Record<string, BannonMotionClipData>,
  provenance: EulerBankSource,
): THREE.AnimationClip[] {
  return Object.entries(bank).map(([name, data]) => makeClip(name, data, provenance));
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
