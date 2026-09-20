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

/**
 * THE COMBAT SLOTS THAT MUST BE A SINGLE STRIKE, NOT A DEMONSTRATION LOOP.
 *
 * MEASURED — this is why "it's the same moves for every button". The Bannon
 * bank is Mixamo, and the clips that had claimed the attack slots are
 * multi-second demo loops of somebody shadowboxing:
 *
 *   attack_1  BOXING        1.73s   ("Boxing.fbx")
 *   attack_rp BOXING__2_    4.23s   ("Boxing (2).fbx")  -- four seconds
 *   attack_rk CROSS_JUMPS   2.03s   ("Cross Jumps.fbx") -- jumping jacks
 *   block     CENTER_BLOCK  1.77s
 *
 * A move's window is a few hundred milliseconds, so only the first fraction
 * of the loop ever plays — and the first fraction of one shadowboxing clip
 * looks like the first fraction of another. RENDERED, attack_rk folded the
 * fighter double because that is what frame 12 of a jumping jack looks like.
 *
 * The Schwarzerblitz set is authored single strikes at fighting-game lengths,
 * and every one of these was sitting in the pool unused. Durations measured
 * from the bank, not assumed.
 *
 * Only slots where the Mixamo pick is demonstrably wrong are overridden;
 * attack_2 keeps HURRICANE_KICK, which is a real spinning kick.
 */
export const SCHWARZERBLITZ_COMBAT_SLOTS: Record<string, string> = {
  // THE IDLE. Owner, looking at it: "his feet are like really close together,
  // he's leaning like he's doing the Michael Jackson lean, one of his arms are
  // out forward and one of his arms are like weirdly out backward."
  //
  // MEASURED, hand position relative to the hips (this rig's forward is +X):
  //   BOX_IDLE  LH [ 0.229, 0.232, 0.311]   RH [-0.225, -0.025, 0.036]
  //   STANCE    LH [ 0.307, 0.505, 0.219]   RH [ 0.215,  0.278, -0.141]
  //
  // BOX_IDLE puts one hand 0.23 FORWARD and the other 0.23 BEHIND him, at hip
  // height — his description exactly. It is a Mixamo shadowboxing loop being
  // sampled at a moment that happens to look like that, on a bank that is
  // mixed-convention (its legs measure closer to the Mixamo rest, its
  // shoulders closer to ours). STANCE is an authored fighting stance: both
  // hands forward, both at chest height, feet planted.
  idle:      'STANCE',
  attack_1:  'GRAFQUICKJAB',    // 0.46s jab, vs BOXING's 1.73s loop
  attack_rp: 'GYAKUZUKI',       // 0.42s reverse punch, vs BOXING__2_'s 4.23s
  attack_lk: 'QUICKKICK',       // 0.25s
  // ROUNDHOUSEKICK WAS HERE AND IS THE KICK THE OWNER REPORTED: "it's going
  // off to the side, off to the left of the character ... he's not rotating
  // his body to do it towards the character he's fighting." The bake was
  // refusing the claim by accident — on a peak-SPEED measure that reads a
  // snappy strike's retraction and false-positives half the bank — so the
  // correction survived only as long as that bug did.
  //
  // TRACED frame by frame (scratchpad/trace-strike.mjs), right foot forward
  // of the hips, and the body's own facing:
  //   ROUNDHOUSEKICK  t 0.48-0.78  foot -0.57 m (BEHIND)  face 0.55
  //                   t 0.90       foot +0.59            face 0.94
  //   HEAVYKICK       t 0.17-0.34  foot +0.43            face 0.94
  // The roundhouse chambers behind a half-turned body for two thirds of its
  // length and lands in the last twentieth; the engine's hit frame comes
  // long before the leg gets there. HEAVYKICK lands in the first third, is
  // half the length, and measures clean on every gate — reach +0.546 with
  // the body facing +0.936 at the moment it lands.
  attack_rk: 'HEAVYKICK',       // 0.54s, lands at t 0.17-0.34
  block:     'GUARD',           // 0.17s hold, vs CENTER_BLOCK's 1.77s
};
