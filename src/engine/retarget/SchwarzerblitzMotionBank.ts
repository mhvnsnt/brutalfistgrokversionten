// `.ts` / explicit extensions on purpose: they are what let the repo's own
// runner (`node --experimental-strip-types --test`) resolve this module.
// tsconfig sets allowImportingTsExtensions and Vite/esbuild resolve them
// unchanged. Without them these invariants cannot be tested at all.
import * as THREE from 'three';

import { SCHWARZERBLITZ_MOTION_BANK } from '../../generated/SchwarzerblitzMotionBank.generated.ts';
import {
  buildClipsFromEulerBank,
  eulerBankRestPose,
  type BannonMotionClipData,
} from './BannonMotionBank.ts';

/**
 * The owner-granted Schwarzerblitz fighting set, imported from
 * mhvnsnt/SchwarzerblitzEngine `bin/media/common/animations/*.x` by
 * scripts/sync-schwarzerblitz-motion.mjs. The grant is recorded in
 * AnimationSourceRegistry.ts; the engine itself is BSD-3-Clause.
 *
 * These are real authored fighting animations - stances, walk, run, sidesteps,
 * jumps, guards, strikes, throws with their receiver halves, hit reactions and
 * getups - not synthesized motion.
 *
 * The rig drives 19 of the 22 runtime bones. It has a two-segment spine against
 * Mixamo's three and no clavicle, so mixamorigSpine1 and both shoulders take
 * nothing from this source and hold their bind rotation.
 */
export const SCHWARZERBLITZ_CLIP_NAMES = new Set(Object.keys(SCHWARZERBLITZ_MOTION_BANK));

export function buildSchwarzerblitzMotionClips(): THREE.AnimationClip[] {
  return buildClipsFromEulerBank(
    SCHWARZERBLITZ_MOTION_BANK as Record<string, BannonMotionClipData>,
    {
      clipSourceType: 'SCHWARZERBLITZ_MOTION',
      source: 'mhvnsnt/SchwarzerblitzEngine/bin/media/common/animations',
      sourceConvention: 'schwarzerblitz',
    },
  );
}

/** The reference clip that holds the source skeleton's rest pose. */
export const SCHWARZERBLITZ_REST_CLIP = 'TPOSE';

/**
 * The Schwarzerblitz rig's OWN rest, so an absolute pose stays absolute.
 *
 * MEASURED: `TPOSE` holds RightArm rx -1.5720 and LeftArm rx +1.5859 — a clean
 * +/-pi/2 about the forward axis, i.e. arms straight out. Every other clip in
 * the bank is an absolute local rotation on that same skeleton, so this is the
 * rest they are relative to. Without it the deltas are measured from each
 * clip's own frame 0 and every STANCE, GUARD and CROUCH in the set flattens
 * onto the target's bind — which is exactly why eleven distinct stances all
 * looked like one.
 *
 * Empty map (rather than a throw) if the reference clip is ever absent: the
 * bank then behaves exactly as it did before, instead of taking the game down.
 */
export function schwarzerblitzSourceRest(): Map<string, THREE.Quaternion> {
  const rest = SCHWARZERBLITZ_MOTION_BANK[SCHWARZERBLITZ_REST_CLIP] as BannonMotionClipData | undefined;
  return rest ? eulerBankRestPose(rest) : new Map<string, THREE.Quaternion>();
}
