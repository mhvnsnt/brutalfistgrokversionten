// `.ts` / explicit extensions on purpose: they are what let the repo's own
// runner (`node --experimental-strip-types --test`) resolve this module.
// tsconfig sets allowImportingTsExtensions and Vite/esbuild resolve them
// unchanged. Without them these invariants cannot be tested at all.
import * as THREE from 'three';

import { SCHWARZERBLITZ_MOTION_BANK } from '../../generated/SchwarzerblitzMotionBank.generated.ts';
import { buildClipsFromEulerBank, type BannonMotionClipData } from './BannonMotionBank.ts';

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
