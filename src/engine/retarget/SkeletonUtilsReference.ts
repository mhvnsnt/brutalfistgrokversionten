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

  // `preserveBonePositions` IS the real option — three 0.186.0's own
  // implementation reads it (and documents it, defaulting to true). The
  // installed @types/three is a separate, older package that renamed it to
  // `preserveHipPosition`, so the types disagree with the code they describe.
  // Casting keeps the BAKE's behaviour exactly as it is; switching to the name
  // the stale types want would silently change every retargeted clip, which is
  // not a typecheck fix.
  // THE TARGET HAS TO CARRY A `.skeleton`, AND A BONE TREE DOES NOT.
  //
  // three's retargetClip reads `target.skeleton.bones` unconditionally and then
  // hands the same `target` to retarget(), so it wants a SkinnedMesh — not a
  // bone root (what the canonical skeleton is) and not a Skeleton either. Both
  // die on "Cannot read properties of undefined (reading 'bones')"; that is the
  // stack, not a reading of the source.
  //
  // So when the caller passes a bare hierarchy, bind a throwaway SkinnedMesh to
  // its skeleton and retarget against that. The bones are the real ones, so the
  // result is identical to what a rigged target would produce — the carrier
  // exists only to satisfy the property lookup, owns no geometry, and is
  // discarded here.
  const skinnedTarget = (target as THREE.SkinnedMesh).skeleton
    ? (target as THREE.SkinnedMesh)
    : (() => {
        const carrier = new THREE.SkinnedMesh();
        carrier.bind(targetSkeleton);
        return carrier;
      })();

  const retargeted = SkeletonUtils.retargetClip(skinnedTarget, sourceSkeleton, clip, {
    names,
    preserveBoneMatrix: true,
    preserveBonePositions: true,
    useFirstFramePosition: false,
  } as unknown as Parameters<typeof SkeletonUtils.retargetClip>[3]);

  return {
    clip: retargeted,
    sourceBones: sourceSkeleton.bones.length,
    targetBones: targetSkeleton.bones.length,
    mappedTracks: retargeted.tracks.length,
  };
}

/**
 * A SKELETON IS A HIERARCHY OF BONES, NOT NECESSARILY A MESH.
 *
 * This looked for a SkinnedMesh and gave up if there was not one, which meant
 * the canonical retarget target — a bare bone tree, with no geometry anywhere
 * under it, because it exists to be posed and measured rather than drawn — was
 * reported as having no skeleton at all. Every caller passing it got
 * "Skeleton reference retarget requires source and target skeletons".
 *
 * MEASURED: that rejected all 89 clips of the CC0 Quaternius animation library
 * the moment they became visible to the bake. The pack is fetched, unpacked and
 * listed, and not one frame of it could reach the game.
 *
 * So fall back to the bones themselves. A Skeleton built from them computes its
 * inverse bind matrices from their current world matrices, which for a
 * rest-posed canonical root IS the bind pose — the same skeleton a SkinnedMesh
 * would have handed back. This is strictly more permissive: every tree that
 * resolved before still resolves the same way, by the same first branch.
 */
function findSkeleton(root: THREE.Object3D): THREE.Skeleton | null {
  let result: THREE.Skeleton | null = null;
  root.traverse((node) => {
    if (!result && node instanceof THREE.SkinnedMesh) result = node.skeleton;
  });
  if (result) return result;

  const bones: THREE.Bone[] = [];
  root.traverse((node) => { if ((node as THREE.Bone).isBone) bones.push(node as THREE.Bone); });
  if (!bones.length) return null;
  root.updateMatrixWorld(true);
  return new THREE.Skeleton(bones);
}
