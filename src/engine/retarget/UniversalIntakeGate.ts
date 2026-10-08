// `.ts` extensions on purpose — `node --experimental-strip-types` resolves
// them literally, and the offline harness imports these same modules.
import * as THREE from 'three';

import { buildRetargetRig } from './UniversalRetarget.ts';
import { cacheRestSkin, retargetAndValidate, type CellResult } from './RetargetValidation.ts';

/**
 * #17 INTAKE GATE for the universal retargeter.
 *
 * normalizeUniversalAnimation() calls this when the caller supplies the
 * clip's SOURCE SKELETON. With a skeleton the intake no longer has to guess
 * from names: the clip is retargeted by world-space rotation transfer and
 * then MEASURED (required bones, NaN, limb lengths, flips, feet, effectors,
 * duration, skin deformation). A clip that cannot be mapped is rejected as
 * UNMAPPABLE; one that maps but fails a measurement is rejected with the
 * failing checks. Nothing is faked into a PASS.
 *
 * Without a source skeleton the #17 path runs exactly as before.
 */
export interface IntakeGateResult {
  verdict: 'PASS' | 'REJECTED_UNMAPPABLE' | 'REJECTED_RETARGET_VALIDATION';
  clip: THREE.AnimationClip | null;
  cell: CellResult;
}

export function runUniversalIntakeGate(clip: THREE.AnimationClip, sourceSkeleton: THREE.Object3D, targetRoot: THREE.Object3D): IntakeGateResult {
  const src = buildRetargetRig(sourceSkeleton, { label: 'intake-source' });
  const tgt = buildRetargetRig(targetRoot, { label: 'intake-target' });
  let hasSkin = false;
  targetRoot.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) hasSkin = true; });
  // Deformation is measured against the rest skin, so cache it first.
  if (hasSkin) cacheRestSkin(tgt);
  const cell = retargetAndValidate(clip, src, tgt, { fillRest: true, skipDeform: !hasSkin });
  if (cell.verdict === 'UNMAPPABLE' || cell.verdict === 'MISSING_CLIP') return { verdict: 'REJECTED_UNMAPPABLE', clip: null, cell };
  if (cell.verdict !== 'PASS' || !cell.clip) return { verdict: 'REJECTED_RETARGET_VALIDATION', clip: null, cell };
  const ud = ((cell.clip as THREE.AnimationClip & { userData?: Record<string, unknown> }).userData ??= {});
  ud.universalIntake = true;
  ud.intakeGate = 'universal-retarget';
  return { verdict: 'PASS', clip: cell.clip, cell };
}

import type { UniversalAnimationResult } from './UniversalAnimationPipeline.ts';

/** The gate's outcome in the #17 result shape. */
export function universalIntakeResult(clip: THREE.AnimationClip, sourceSkeleton: THREE.Object3D, targetRoot: THREE.Object3D, bodyCount: number, receives: boolean): UniversalAnimationResult {
  const gate = runUniversalIntakeGate(clip, sourceSkeleton, targetRoot);
  const targetBones: string[] = [];
  targetRoot.traverse((o) => { if ((o as THREE.Bone).isBone) targetBones.push(o.name); });
  const tracks = gate.clip?.tracks ?? [];
  let moving = 0;
  for (const t of tracks) {
    if (!t.name.endsWith('.quaternion')) continue;
    const v = t.values;
    let widest = 0;
    for (let i = 4; i + 3 < v.length; i += 4) {
      const dot = Math.min(1, Math.abs(v[i] * v[0] + v[i + 1] * v[1] + v[i + 2] * v[2] + v[i + 3] * v[3]));
      widest = Math.max(widest, (Math.acos(dot) * 2 * 180) / Math.PI);
    }
    if (widest > 5) moving++;
  }
  const verdict = gate.verdict === 'PASS' ? (moving ? 'PASS' : 'REJECTED_NO_MOTION') : gate.verdict;
  if (gate.clip) {
    const ud = ((gate.clip as THREE.AnimationClip & { userData?: Record<string, unknown> }).userData ??= {});
    Object.assign(ud, { bodyCount, receives, retargetChecks: gate.cell.checks });
  }
  return {
    clip: verdict === 'PASS' ? gate.clip : null,
    verdict,
    mappedTracks: tracks.length,
    unresolvedTracks: 0,
    targetCoverage: targetBones.length ? Math.min(1, tracks.length / targetBones.length) : 0,
    missingBones: gate.cell.verdict === 'UNMAPPABLE' ? gate.cell.reasons : [],
    movingBones: moving,
    bodyCount,
    receives,
  };
}
