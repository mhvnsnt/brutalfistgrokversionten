// `.ts` extensions on purpose — `node --experimental-strip-types` resolves
// them literally, and the offline harness imports these same modules.
import * as THREE from 'three';

import { buildRetargetRig, retargetClip, rigsShareSkeleton, type RetargetRig } from './UniversalRetarget.ts';

/**
 * RUNTIME ENTRY for the universal retargeter.
 *
 * Wired into CharacterPipeline (the path FighterMesh plays through) and
 * AnimationBridge.build. It only ever acts on a clip whose SOURCE rig differs
 * from the TARGET rig:
 *
 *   - The 61 roster GLBs that share the canonical 58-joint bind are detected
 *     as the same skeleton (names + rest rotations within 2 deg) and their
 *     clips pass through UNTOUCHED — byte-for-byte what played before.
 *   - A target that differs (EDWIN_KENNEDY_unchained's 1-bone spine,
 *     wrestler_base, a CC0 rig) gets each baked clip retargeted by world-space
 *     rotation transfer instead of the name rewrite, which binds nothing when
 *     the bone names differ.
 *   - A clip that cannot be mapped keeps its previous (legacy) binding and is
 *     LABELLED `universalRetarget: 'UNMAPPABLE'` with a console warning. It is
 *     never silently passed off as retargeted.
 *
 * Kill switch: localStorage `bf.universalRetarget = 'off'`, or
 * VITE_UNIVERSAL_RETARGET=off at build time. Off means every clip plays
 * exactly as before this module existed.
 */

export type UniversalRetargetMode = 'off' | 'auto';

export function universalRetargetMode(): UniversalRetargetMode {
  try {
    const ls = (globalThis as { localStorage?: Storage }).localStorage?.getItem('bf.universalRetarget');
    if (ls === 'off' || ls === 'auto') return ls;
  } catch {
    // storage blocked (private mode) — fall through to the build flag
  }
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_UNIVERSAL_RETARGET;
  return env === 'off' ? 'off' : 'auto';
}

type SceneLoader = () => Promise<THREE.Object3D | null>;
let canonicalLoader: SceneLoader | null = null;
let canonicalRig: Promise<RetargetRig | null> | null = null;

/** Override how the canonical source rig is loaded (tests, offline tools). */
export function setCanonicalRigLoader(loader: SceneLoader | null): void {
  canonicalLoader = loader;
  canonicalRig = null;
}

/** The skeleton every baked clip is authored on: public/models/BANNON_rigged.glb. */
export function loadCanonicalSourceRig(): Promise<RetargetRig | null> {
  canonicalRig ??= (async () => {
    try {
      let scene: THREE.Object3D | null;
      if (canonicalLoader) scene = await canonicalLoader();
      else {
        const [{ loadGLTF }, { assetUrl }] = await Promise.all([import('../pipeline/glbCache.ts'), import('../../lib/assetBase.ts')]);
        scene = (await loadGLTF(assetUrl('/models/BANNON_rigged.glb'))).scene;
      }
      if (!scene) return null;
      // A private copy: posing it for sampling must never touch a shared scene.
      return buildRetargetRig(scene.clone(true), { label: 'BANNON_rigged (canonical)', file: 'BANNON_rigged.glb' });
    } catch (e) {
      console.warn(`[UniversalRetarget] canonical rig unavailable: ${e instanceof Error ? e.message : String(e)}`);
      return null;
    }
  })();
  return canonicalRig;
}

export interface RuntimeRetargetSummary {
  mode: UniversalRetargetMode;
  sameSkeleton: boolean;
  retargeted: number;
  unmappable: number;
  untouched: number;
  reasons: string[];
}

type ClipWithData = THREE.AnimationClip & { userData?: Record<string, unknown> };

/**
 * Retarget, in place, every clip in `clips` that `isSourceClip` says was
 * authored on `sourceRig`, onto `targetScene` — only when the two rigs differ.
 * Yields to the event loop every few clips so a large bank does not freeze a
 * frame on a phone.
 */
export async function retargetClipsForTarget(
  clips: THREE.AnimationClip[],
  sourceRig: RetargetRig | null,
  targetScene: THREE.Object3D,
  opts: { label?: string; isSourceClip?: (c: THREE.AnimationClip) => boolean; fps?: number } = {},
): Promise<RuntimeRetargetSummary> {
  const mode = universalRetargetMode();
  const summary: RuntimeRetargetSummary = { mode, sameSkeleton: false, retargeted: 0, unmappable: 0, untouched: clips.length, reasons: [] };
  if (mode === 'off' || !sourceRig || !clips.length) return summary;
  const target = buildRetargetRig(targetScene, { label: opts.label });
  if (rigsShareSkeleton(sourceRig, target)) { summary.sameSkeleton = true; return summary; }
  const reasonSet = new Set<string>();
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    if (opts.isSourceClip && !opts.isSourceClip(clip)) continue;
    const r = retargetClip(clip, sourceRig, target, { fps: opts.fps ?? 30, fillRest: true });
    if (r.status === 'RETARGETED' && r.clip) {
      clips[i] = r.clip;
      summary.retargeted++;
      summary.untouched--;
    } else {
      const ud = ((clip as ClipWithData).userData ??= {});
      ud.universalRetarget = r.status;
      ud.universalRetargetReasons = r.reasons;
      summary.unmappable++;
      r.reasons.forEach((x) => reasonSet.add(x));
    }
    if (i % 24 === 23) await new Promise((res) => setTimeout(res, 0));
  }
  summary.reasons = [...reasonSet];
  if (summary.unmappable) {
    console.warn(`[UniversalRetarget] ⚠️ "${opts.label ?? 'target'}" ${summary.unmappable} clip(s) UNMAPPABLE, kept on legacy binding: ${summary.reasons.slice(0, 3).join(' | ')}`);
  }
  if (summary.retargeted) console.log(`[UniversalRetarget] 🦴 "${opts.label ?? 'target'}" ${summary.retargeted} clip(s) retargeted from ${sourceRig.label}`);
  return summary;
}

/** Synchronous variant for a source SCENE (AnimationBridge.build). Returns null when not applicable. */
export function retargetFromSourceScene(
  sourceScene: THREE.Object3D,
  targetScene: THREE.Object3D,
  clips: THREE.AnimationClip[],
  label?: string,
): { clips: THREE.AnimationClip[]; retargeted: number; unmappable: number } | null {
  if (universalRetargetMode() === 'off' || sourceScene === targetScene || !clips.length) return null;
  const src = buildRetargetRig(sourceScene, { label: `${label ?? ''}_source` });
  const tgt = buildRetargetRig(targetScene, { label: `${label ?? ''}_target` });
  if (src.map.missingRequired.length || tgt.map.missingRequired.length) return null;
  if (rigsShareSkeleton(src, tgt)) return null;
  let retargeted = 0; let unmappable = 0;
  const out = clips.map((clip) => {
    const r = retargetClip(clip, src, tgt, { fillRest: true });
    if (r.status === 'RETARGETED' && r.clip) { retargeted++; return r.clip; }
    unmappable++;
    const ud = ((clip as ClipWithData).userData ??= {});
    ud.universalRetarget = r.status;
    ud.universalRetargetReasons = r.reasons;
    return clip;
  });
  return { clips: out, retargeted, unmappable };
}

import { CANONICAL_REST_LOCAL } from './CanonicalRest.generated.ts';

/**
 * Does `targetScene` carry the canonical skeleton the baked bank is authored
 * on? Every canonical humanoid joint present by name (Mixamo `:` spelling
 * insensitive) with its rest local rotation within `toleranceDeg`. Answered
 * from a generated table, so the 61 roster rigs never trigger a GLB fetch.
 */
export function targetUsesCanonicalSkeleton(targetScene: THREE.Object3D, toleranceDeg = 2): boolean {
  const key = (n: string) => THREE.PropertyBinding.sanitizeNodeName(n).toLowerCase().replace(/^mixamorig[0-9:_\-.\s]*/, 'mixamorig');
  const byKey = new Map<string, THREE.Object3D>();
  targetScene.traverse((o) => { if ((o as THREE.Bone).isBone) byKey.set(key(o.name), o); });
  const tol = THREE.MathUtils.degToRad(toleranceDeg);
  const q = new THREE.Quaternion();
  for (const [name, rest] of Object.entries(CANONICAL_REST_LOCAL)) {
    const j = byKey.get(key(name));
    if (!j) return false;
    if (j.quaternion.angleTo(q.set(rest[0], rest[1], rest[2], rest[3])) > tol) return false;
  }
  return true;
}

/**
 * CharacterPipeline hook: retarget the BAKED clips (authored on the canonical
 * rig) onto a fighter whose rig differs. Same-skeleton fighters return
 * immediately with nothing touched.
 */
export async function retargetBakedClipsForTarget(
  clips: THREE.AnimationClip[],
  targetScene: THREE.Object3D,
  label: string,
): Promise<RuntimeRetargetSummary> {
  const mode = universalRetargetMode();
  const none: RuntimeRetargetSummary = { mode, sameSkeleton: false, retargeted: 0, unmappable: 0, untouched: clips.length, reasons: [] };
  if (mode === 'off') return none;
  if (targetUsesCanonicalSkeleton(targetScene)) return { ...none, sameSkeleton: true };
  const source = await loadCanonicalSourceRig();
  if (!source) return { ...none, reasons: ['canonical rig unavailable — clips kept on legacy binding'] };
  return retargetClipsForTarget(clips, source, targetScene, {
    label,
    isSourceClip: (c) => {
      const ud = (c as ClipWithData).userData ?? {};
      // Baked clips only; a clip already rebuilt onto THIS rig is left alone.
      return Boolean(ud.bank) && !ud.recoveredFromSource && !ud.universalRetarget;
    },
  });
}
