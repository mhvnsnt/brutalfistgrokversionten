// `.ts` / explicit extensions on purpose: they are what let the repo's own
// runner (`node --experimental-strip-types --test`) resolve this module.
import * as THREE from 'three';

import { MIXAMO_REST_POSE } from '../../generated/MixamoRestPose.generated.ts';

/**
 * The Mixamo skeleton's REST pose, as the rest that absolute Mixamo clips are
 * measured from.
 *
 * MEASURED (scripts/sync-mixamo-rest.mjs, from xbot.glb — the one shipped
 * model bind_pose.mjs classifies T-POSE): the Bannon motion bank holds
 * ABSOLUTE local rotations on a Mixamo rig, not deltas. Its LeftUpLeg
 * rotations have a median magnitude of 164.5 degrees, which is the documented
 * Mixamo leg rest of rz ~= +/-pi — the rest is baked into every key.
 *
 * Without this, makeClipBindRelative falls back to each clip's own frame 0,
 * `q(0) == q_bind` for every clip by construction, and an absolute POSE
 * (a stance, a guard, a crouch) subtracts exactly the thing it is.
 */
let cached: Map<string, THREE.Quaternion> | null = null;

export function mixamoSourceRest(): Map<string, THREE.Quaternion> {
  if (cached) return cached;
  const map = new Map<string, THREE.Quaternion>();
  for (const [bone, q] of Object.entries(MIXAMO_REST_POSE)) {
    map.set(bone, new THREE.Quaternion(q[0], q[1], q[2], q[3]));
  }
  cached = map;
  return map;
}

/** Bones the baked rest covers, for tests and for coverage reporting. */
export const MIXAMO_REST_BONE_COUNT = Object.keys(MIXAMO_REST_POSE).length;
