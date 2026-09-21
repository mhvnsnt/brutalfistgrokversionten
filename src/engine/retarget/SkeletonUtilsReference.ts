/**
 * Open-source skeleton reference lane.
 *
 * Three.js ships SkeletonUtils as an independent implementation of skeleton
 * cloning and animation retargeting. The game keeps its measured Bannon
 * retargeter authoritative; this adapter exists to cross-check the same source
 * clip against an established open-source implementation before a new motion
 * family is promoted.
 */
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

export interface SkeletonReferenceResult {
  clip: THREE.AnimationClip;
  sourceBones: number;
  targetBones: number;
  mappedTracks: number;
}

/**
 * Retarget one clip through Three.js's open-source reference implementation.
 * This is intentionally not the shipping path: disagreement is evidence to
 * investigate, never permission to silently swap animation implementations.
 */
export function referenceRetargetClip(
  target: THREE.Object3D,
  source: THREE.Object3D | THREE.Skeleton,
  clip: THREE.AnimationClip,
  names: Record<string, string>,
): SkeletonReferenceResult {
  const sourceSkeleton = source instanceof THREE.Skeleton ? source : findSkeleton(source);
  const targetSkeleton = findSkeleton(target);
  if (!sourceSkeleton || !targetSkeleton) {
    throw new Error('Skeleton reference retarget requires source and target skeletons');
  }

  const retargeted = SkeletonUtils.retargetClip(target, sourceSkeleton, clip, {
    names,
    preserveBoneMatrix: true,
    preserveBonePositions: true,
    useFirstFramePosition: false,
  });

  return {
    clip: retargeted,
    sourceBones: sourceSkeleton.bones.length,
    targetBones: targetSkeleton.bones.length,
    mappedTracks: retargeted.tracks.length,
  };
}

function findSkeleton(root: THREE.Object3D): THREE.Skeleton | null {
  let result: THREE.Skeleton | null = null;
  root.traverse((node) => {
    if (!result && node instanceof THREE.SkinnedMesh) result = node.skeleton;
  });
  return result;
}
