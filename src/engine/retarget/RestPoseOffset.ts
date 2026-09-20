/**
 * REST-POSE OFFSET — make a T-pose animation land correctly on an A-pose rig.
 *
 * THE DEFECT, measured across the shipped roster by tools/model_diag/bind_pose.mjs:
 * 60 of 77 models rest in an A-POSE, arms a median 57 degrees below horizontal.
 * Both motion banks are keyed on MIXAMO bone names and Mixamo's convention is
 * T-POSE. So the clips were authored with the arms out and are played on rigs
 * whose arms hang down.
 *
 * WHY BIND-RELATIVE ALONE IS NOT ENOUGH. The retarget composes
 *     q(t) = q_bind x q_src(0)^-1 x q_src(t)
 * which preserves the source's motion RELATIVE TO ITS OWN REST. That is why
 * frame 0 is always exactly the character's bind and why nothing explodes. But
 * it also preserves the 57-degree gap: a punch authored to travel from a
 * horizontal arm travels from a hanging arm instead, and finishes at the hip.
 * It is not a weights problem and re-rigging cannot fix it, because both rigs
 * are individually correct — only the CONVENTION differs.
 *
 * THE FIX is the standard one (the same correction Blender's retargeters and
 * three.js's own SkeletonUtils.retargetClip apply): give the retarget a REST
 * THAT MATCHES THE SOURCE'S CONVENTION instead of the model's own. The mesh,
 * the skinning and the bind matrices are untouched — only the reference pose
 * the deltas are measured from changes:
 *
 *     q(t) = (q_bind x q_correction) x q_src(0)^-1 x q_src(t)
 *
 * `q_correction` is the LOCAL rotation that lifts that bone so the arm chain
 * ends up horizontal, derived per model from its own bind geometry — never a
 * hardcoded 57 degrees, because the measured range runs 0 to 77.
 *
 * ONLY THE ARM CHAIN IS CORRECTED. A-pose and T-pose differ at the shoulders
 * and nowhere else: legs, spine and head rest identically in both conventions,
 * so touching them would introduce an error rather than remove one.
 */

import * as THREE from 'three';

/** The bones whose rest differs between an A-pose and a T-pose rig. */
export const ARM_CHAIN_BONES = [
  'mixamorigLeftArm', 'mixamorigRightArm',
] as const;

/** Where each arm's chain ends, for measuring the rest direction. */
const ARM_TIPS: Record<string, string> = {
  mixamorigLeftArm: 'mixamorigLeftHand',
  mixamorigRightArm: 'mixamorigRightHand',
};

/** Below this the rig is already close enough to a T-pose to leave alone. */
export const CORRECTION_THRESHOLD_DEG = 12;

export interface RestCorrection {
  /** bone name -> the local rotation to compose onto its bind. */
  corrections: Map<string, THREE.Quaternion>;
  /** What was measured, so a wrong correction is debuggable rather than magic. */
  measured: Array<{ bone: string; restDeg: number; correctedDeg: number }>;
}

function worldPosition(obj: THREE.Object3D): THREE.Vector3 {
  obj.updateWorldMatrix(true, false);
  return new THREE.Vector3().setFromMatrixPosition(obj.matrixWorld);
}

function normalizedBoneName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Resolve the arm chain universally across common GLB naming conventions. */
function findArmBone(root: THREE.Object3D, side: 'Left' | 'Right'): THREE.Object3D | null {
  const wanted = side === 'Left'
    ? [
        'mixamorigleftarm', 'leftarm', 'leftupperarm', 'upperarml', 'arml',
        'lupperarm', 'larm', 'jshoulderl', 'armaturearmr',
      ]
    : [
        'mixamorightrarm', 'mixamorigrightarm', 'rightarm', 'rightupperarm',
        'upperarmr', 'armr', 'rupperarm', 'rarm', 'jshoulderr', 'armaturearml',
      ];
  let found: THREE.Object3D | null = null;
  root.traverse((child) => {
    if (found || !child.name) return;
    const n = normalizedBoneName(child.name);
    if (wanted.includes(n)) found = child;
  });
  return found;
}

function findArmTip(root: THREE.Object3D, side: 'Left' | 'Right'): THREE.Object3D | null {
  const wanted = side === 'Left'
    ? ['mixamoriglefthand', 'lefthand', 'lhand', 'jwristr', 'armaturewristr']
    : ['mixamorigrighthand', 'righthand', 'rhand', 'jwristr', 'armaturewristl'];
  let found: THREE.Object3D | null = null;
  root.traverse((child) => {
    if (found || !child.name) return;
    const n = normalizedBoneName(child.name);
    if (wanted.includes(n)) found = child;
  });
  return found;
}

/** Angle of a vector BELOW horizontal, in degrees. 0 = level, 90 = straight down. */
export function angleBelowHorizontal(v: THREE.Vector3): number {
  const horizontal = Math.hypot(v.x, v.z);
  if (horizontal < 1e-9 && Math.abs(v.y) < 1e-9) return 0;
  return (Math.atan2(-v.y, horizontal) * 180) / Math.PI;
}

/**
 * Work out, for this specific skeleton, the local rotation each arm bone needs
 * so its chain rests horizontally.
 *
 * Derived from the rig's OWN geometry: the shoulder-to-hand vector is measured
 * in world space, the rotation that takes it to its horizontal projection is
 * computed there, and then brought into the bone's local frame — which is the
 * only place it can be composed onto the bind.
 */
export function measureRestCorrection(scene: THREE.Object3D): RestCorrection {
  const corrections = new Map<string, THREE.Quaternion>();
  const measured: RestCorrection['measured'] = [];

  for (const boneName of ARM_CHAIN_BONES) {
    const side: 'Left' | 'Right' = boneName.includes('Left') ? 'Left' : 'Right';
    const bone = findArmBone(scene, side);
    const tip = findArmTip(scene, side);
    if (!bone || !tip) continue;

    const from = worldPosition(bone);
    const to = worldPosition(tip);
    const v = to.clone().sub(from);
    if (v.lengthSq() < 1e-12) continue;

    const restDeg = angleBelowHorizontal(v);
    if (Math.abs(restDeg) < CORRECTION_THRESHOLD_DEG) {
      measured.push({ bone: boneName, restDeg: +restDeg.toFixed(1), correctedDeg: +restDeg.toFixed(1) });
      continue;
    }

    // The same vector with its vertical component removed — the T-pose direction.
    const flat = new THREE.Vector3(v.x, 0, v.z);
    if (flat.lengthSq() < 1e-12) continue;
    const worldFix = new THREE.Quaternion().setFromUnitVectors(
      v.clone().normalize(),
      flat.clone().normalize(),
    );

    // Bring the world-space rotation into the bone's own local frame:
    // q_local = parentWorld^-1 * worldFix * parentWorld, expressed about the
    // bone's origin. With the parent's world rotation P, that is P^-1 * fix * P.
    const parentWorldQuat = new THREE.Quaternion();
    (bone.parent ?? scene).getWorldQuaternion(parentWorldQuat);
    const localFix = parentWorldQuat.clone().invert().multiply(worldFix).multiply(parentWorldQuat);

    // Store under the ACTUAL target bone name. This is critical for non-Bannon
    // GLBs whose authored Mixamo-equivalent bones have namespaces/synonyms.
    corrections.set(bone.name, localFix);

    // Verify by applying it and re-measuring — the number in `measured` is what
    // the correction ACHIEVES, not what it was asked to achieve.
    const original = bone.quaternion.clone();
    bone.quaternion.copy(original).multiply(localFix);
    bone.updateWorldMatrix(true, true);
    const after = worldPosition(tip).sub(worldPosition(bone));
    const correctedDeg = angleBelowHorizontal(after);
    bone.quaternion.copy(original);
    bone.updateWorldMatrix(true, true);

    measured.push({ bone: boneName, restDeg: +restDeg.toFixed(1), correctedDeg: +correctedDeg.toFixed(1) });
  }

  return { corrections, measured };
}

/**
 * Should this rig be corrected at all? A rig already in a T-pose needs nothing,
 * and applying a correction to it would be the bug in the other direction.
 */
export function needsCorrection(correction: RestCorrection): boolean {
  return correction.corrections.size > 0;
}
