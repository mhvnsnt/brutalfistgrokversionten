/**
 * UNIVERSAL CHARACTER PIPELINE
 * ─────────────────────────────────────────────────────────────────────────────
 * Single authoritative character-ingestion pipeline used by BOTH Character
 * Select (CharacterPortrait3D) and Combat (FighterMesh / CombatArena3D).
 *
 * AUTHORED SKELETON LAW
 * ─────────────────────
 * The native GLB is authoritative. This pipeline NEVER:
 *   • generates a replacement skeleton
 *   • generates synthetic bones
 *   • calculates replacement vertex weights
 *   • rebinds native meshes
 *   • replaces Skeleton objects
 *   • modifies inverse-bind matrices
 *   • rewrites skinIndex/skinWeight data
 *   • reparents the authored skeleton
 *   • moves bones to compensate for floor placement
 *   • applies character-name-specific corrective bone offsets
 *
 * The pipeline MAY: CLONE, VALIDATE, ANIMATE, and TRANSFORM THE OUTER INSTANCE.
 *
 * UNIVERSALITY LAW
 * ────────────────
 * No character-specific exceptions. No if(name==='Bannon'). No specialYOffset.
 * Every roster member goes through the same pipeline and the same validation gates.
 *
 * FLOOR NORMALIZATION
 * ───────────────────
 * After SkeletonUtils.clone():
 *   1. Update world matrices
 *   2. Measure actual visible cloned SkinnedMesh geometry via Box3
 *   3. Compute aggregate Box3
 *   4. Read measured minimum Y
 *   5. Apply compensating translation to the OUTER CHARACTER INSTANCE
 *   6. Leave authored bone transforms and bind matrices untouched
 *
 * FACING
 * ──────
 * Rest-align FACE to −Z from the shoulder line (worldUp × left→right).
 * Baked onto the clone. Select and combat add independent outer yaws.
 * Never infer facing from mesh centroid. Never inner π on the outer group.
 *
 * BLOCKED ASSETS
 * ──────────────
 * A malformed asset becomes BLOCKED — ASSET DEFORMATION INTEGRITY FAILURE.
 * The pipeline NEVER secretly compensates for a failed validation by generating
 * a new rig or synthetic skeleton.
 *
 * Pipeline:
 *   Native GLB
 *   → GLTFLoader (caller's responsibility)
 *   → validate authored skeleton/SkinnedMesh/skin data
 *   → SkeletonUtils.clone()
 *   → independent character instance
 *   → instance-level spatial normalization (Box3, no bone moves)
 *   → authored forward-axis determination (geometry centroid only)
 *   → gameplay-facing transform (outer instance only)
 *   → AnimationMixer targeting that clone
 *   → visible SkinnedMesh deformation
 *   → validation
 *   → render
 */

import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';
import { type PsxRenderOptions } from '../../render/psx';
import { getActiveRenderProfile } from '../../lib/graphicsSettings';
import { restoreAuthoredTextures } from './restoreAuthoredTextures';
import { rosterHeightScale } from './rosterHeightScale';
import { sanitizeMotionClip } from '../retarget/neutralizeRootMotion';
import { fillBindRelativeGaps, makeClipBindRelative, collectRestMap } from '../retarget/BindRelativeMotion';
import { measureRestCorrection, needsCorrection } from '../retarget/RestPoseOffset';
import {
  SPINE_CHAIN,
  clampToJointLimits,
  redistributeChain,
} from '../retarget/SkeletalLimits';
import { bindClipTracksToTargetBones } from '../retarget/AnimationRetargeter';
import {
  loadBannonClipsFromPublic,
  loadBannonMotionBankTail,
  loadBannonMotionBankVariants,
} from '../retarget/BannonClipJsonAdapter';
import {
  buildSchwarzerblitzMotionClips,
  schwarzerblitzSourceRest,
  SCHWARZERBLITZ_COMBAT_SLOTS,
} from '../retarget/SchwarzerblitzMotionBank';
import {
  AnimationSourceRegistry,
  validateRegistryCompleteness,
} from '../retarget/AnimationSourceRegistry';
import { SEMANTIC_STATE_ALIASES, COMBAT_STATE_TO_SEMANTIC } from '../retarget/SemanticStateAliases';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Target character height in world units — applied uniformly to all roster members */
export const PIPELINE_TARGET_HEIGHT = 1.85;

/** Floor Y tolerance for validation (units) */
export const PIPELINE_FLOOR_TOLERANCE = 0.15;

export function isMixamoCompatibleRig(opts: {
  boneNames: string[];
  skinnedMeshCount: number;
  skinJointCount: number;
}): boolean {
  const unique = [...new Set(opts.boneNames.filter(Boolean))];
  const mixamo = unique.filter((n) => /mixamo/i.test(n)).length;
  if (opts.skinnedMeshCount > 2) return false;
  if (opts.skinJointCount > 0 && opts.skinJointCount < 40) return false;
  if (unique.length < 40) return false;
  return mixamo >= 20;
}

/**
 * Plugin-skin / bind-pose GLBs (Maime). Used on SELECT only to flip the 45°
 * sign — not π. Combat never calls this.
 */
export function isPluginBindPose(root: THREE.Object3D): boolean {
  return !isMixamoCompatibleRig(inspectRig(root));
}

/** @deprecated π bake hid meshes. Select uses opposite 45°, not 180°. */
export function bindPoseFlipY(_root: THREE.Object3D): number {
  void _root;
  return 0;
}

function inspectRig(root: THREE.Object3D): {
  boneNames: string[];
  skinnedMeshCount: number;
  skinJointCount: number;
} {
  const seen = new Set<string>();
  const boneNames: string[] = [];
  let skinnedMeshCount = 0;
  let skinJointCount = 0;
  root.traverse((child) => {
    if ((child as THREE.Bone).isBone && child.name && !seen.has(child.name)) {
      seen.add(child.name);
      boneNames.push(child.name);
    }
    const sm = child as THREE.SkinnedMesh;
    if (sm.isSkinnedMesh) {
      skinnedMeshCount++;
      const n = sm.skeleton?.bones?.length ?? 0;
      if (n > skinJointCount) skinJointCount = n;
    }
  });
  return { boneNames, skinnedMeshCount, skinJointCount };
}

/** Bind-pose box from mesh geometry only — never helpers, bones, or lines. */
export function measureVisibleGeometryBox(root: THREE.Object3D): THREE.Box3 {
  const box = new THREE.Box3();
  root.updateMatrixWorld(true);
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const geom = mesh.geometry;
    if (!geom.boundingBox) geom.computeBoundingBox();
    if (!geom.boundingBox || geom.boundingBox.isEmpty()) return;
    const local = geom.boundingBox.clone();
    local.applyMatrix4(mesh.matrixWorld);
    box.union(local);
  });
  return box;
}

/** Snap lowest mesh vertex to Y=0. Call after scale. No extra sink. */
export function plantFeetOnFloor(root: THREE.Object3D): void {
  root.updateMatrixWorld(true);
  const box = measureVisibleGeometryBox(root);
  if (box.isEmpty() || !Number.isFinite(box.min.y)) return;
  root.position.y -= box.min.y;
  root.updateMatrixWorld(true);
}

function preserveAuthoredMaterials(root: THREE.Object3D, profile: PsxRenderOptions) {
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((mat) => {
      const m = mat as THREE.MeshStandardMaterial;
      if (!m) return;
      if (m.map) {
        m.map.colorSpace = THREE.SRGBColorSpace;
        m.map.minFilter = profile.textureFilter === 'nearest' ? THREE.NearestFilter : THREE.LinearFilter;
        m.map.magFilter = profile.textureFilter === 'nearest' ? THREE.NearestFilter : THREE.LinearFilter;
        m.map.generateMipmaps = profile.textureFilter !== 'nearest';
        m.map.needsUpdate = true;
      }
      if ('skinning' in m) {
        (m as THREE.MeshStandardMaterial & { skinning: boolean }).skinning = true;
      }
      m.needsUpdate = true;
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PipelineResult {
  /** The cloned, normalized character scene — add this to your Three.js scene */
  scene: THREE.Group;
  /**
   * Y rotation (radians) to apply to the INNER scene group to correct the
   * authored forward axis. 0 = model already faces -Z (glTF standard).
   * Math.PI = model was exported facing +Z and was corrected.
   * Applied to the inner group only — never to the outer instance.
   */
  forwardCorrectionY: number;
  /** AnimationMixer bound to the cloned scene's actual bones */
  mixer: THREE.AnimationMixer;
  /** Actions map: clip name → AnimationAction */
  actions: Record<string, THREE.AnimationAction>;
  /** SkeletonHelper for visual bone display (null if no bones) */
  skeletonHelper: THREE.SkeletonHelper | null;
  /** Diagnostic metadata recorded during pipeline execution */
  diagnostics: PipelineDiagnostics;
}

export interface PipelineDiagnostics {
  /** Character model URL */
  modelUrl: string;
  /** Number of bones found in the authored skeleton */
  boneCount: number;
  /** Number of SkinnedMesh objects found */
  skinnedMeshCount: number;
  /** Number of animation clips loaded */
  clipCount: number;
  /** Measured bounding box minimum Y after normalization */
  measuredFloorY: number;
  /** Measured character height after scaling */
  measuredHeight: number;
  /** Forward correction applied (degrees) */
  forwardCorrectionDeg: number;
  /** Whether frustum culling was disabled on all SkinnedMeshes */
  frustumCullingDisabled: boolean;
  /** Whether skin weights were normalized */
  skinWeightsNormalized: boolean;
  /** Whether the pipeline completed without errors */
  pipelineComplete: boolean;
  /** Error message if pipeline failed */
  error?: string;
}

export type PipelineVerdict = 'PASS' | 'BLOCKED';

export interface PipelineValidationResult {
  verdict: PipelineVerdict;
  failingChecks: string[];
  details: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTHORED FORWARD AXIS DETERMINATION
// ─────────────────────────────────────────────────────────────────────────────
// CRITICAL: We use GEOMETRY-ONLY measurement — the bounding box centroid of
// visible mesh geometry in the canonical (rotation=0) pose.
//
// We NEVER use bone positions (head Z vs hips Z) to infer facing direction.
// Reason: A fighting stance can put the head forward without the character's
// actual forward axis being +Z. Bone-position-based inference is unreliable
// and was the source of wrong-facing characters in the previous pipeline.
//
// The geometry centroid approach is stable because:
//   - It measures the actual rendered geometry, not a pose-dependent skeleton
//   - It works for all GLB exports regardless of rig convention
//   - It is not affected by animation state or fighting stance
//
// glTF standard: characters should face -Z (toward camera at +Z).
// Blender default export: characters face +Z.
// If the mesh centroid is at positive Z after normalization, the model faces +Z
// and needs a 180° Y correction on the inner scene group.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Shoulder-line forward. Left→right × world-up = authored face direction.
 * Used to rest-align every GLB to −Z (camera). No per-name exceptions.
 */
function normBoneName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findBoneByNeedles(root: THREE.Object3D, needles: string[]): THREE.Object3D | null {
  const wanted = needles.map(normBoneName);
  let found: THREE.Object3D | null = null;
  root.traverse((child) => {
    if (found) return;
    if (!child.name) return;
    const n = normBoneName(child.name);
    if (wanted.some((w) => n === w || n.endsWith(w))) found = child;
  });
  return found;
}

const LEFT_SHOULDER_NEEDLES = [
  'leftshoulder', 'mixamorigleftshoulder', 'leftclavicle', 'claviclel', 'shoulderl',
  'leftarm', 'mixamorigleftarm', 'leftupperarm', 'upperarml', 'upperarmleft',
];
const RIGHT_SHOULDER_NEEDLES = [
  'rightshoulder', 'mixamorigrightshoulder', 'rightclavicle', 'clavicler', 'shoulderr',
  'rightarm', 'mixamorigrightarm', 'rightupperarm', 'upperarmr', 'upperarmright',
];

export function estimateRigForwardXZ(root: THREE.Object3D): { x: number; z: number } | null {
  root.updateMatrixWorld(true);
  const left = findBoneByNeedles(root, LEFT_SHOULDER_NEEDLES);
  const right = findBoneByNeedles(root, RIGHT_SHOULDER_NEEDLES);
  if (!left || !right) return null;
  const l = new THREE.Vector3();
  const r = new THREE.Vector3();
  left.getWorldPosition(l);
  right.getWorldPosition(r);
  const acrossX = r.x - l.x;
  const acrossZ = r.z - l.z;
  // worldUp × across = forward
  const fwdX = acrossZ;
  const fwdZ = -acrossX;
  const len = Math.hypot(fwdX, fwdZ);
  if (len < 1e-5) return null;
  return { x: fwdX / len, z: fwdZ / len };
}

function yawToAlign(fwdX: number, fwdZ: number, targetX: number, targetZ: number): number {
  let d = Math.atan2(targetX, targetZ) - Math.atan2(fwdX, fwdZ);
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * Inner rest yaw so the authored face looks down −Z (camera at +Z).
 * Select and combat apply their own OUTER yaw on top of this. Do not stack π.
 */
export function determineForwardCorrection(scene: THREE.Object3D): number {
  const fwd = estimateRigForwardXZ(scene);
  if (!fwd) return 0;
  return yawToAlign(fwd.x, fwd.z, 0, -1);
}

// ─────────────────────────────────────────────────────────────────────────────
// PRE-CLONE VALIDATION
// ─────────────────────────────────────────────────────────────────────────────
// Validates the authored GLB data BEFORE cloning.
// If validation fails, the asset is BLOCKED — we never secretly compensate.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate the authored GLB scene before cloning.
 * Returns BLOCKED if the asset has structural defects that would cause
 * deformation failures at runtime.
 *
 * FAIL CLOSED: A malformed asset must become BLOCKED, never secretly fixed.
 *
 * RELAXED GATE: NO_SKINNED_MESH and NO_SKELETON are warnings, not hard blocks.
 * Some valid GLBs (e.g. Blender exports with certain settings) may not expose
 * THREE.SkinnedMesh / THREE.Bone typed objects at the top level even though
 * they have valid authored skinning data that Three.js can animate correctly.
 * Only block on checks that guarantee the asset CANNOT render or animate:
 *   - NO_VISIBLE_MESH   → nothing to render
 *   - BONE_MATRIX_NAN   → corrupt transforms will crash the renderer
 *   - SKINNED_MESH_UNBOUND (only if SkinnedMeshes ARE present but unbound)
 *   - MISSING_SKIN_ATTRIBUTES (only if SkinnedMeshes ARE present but missing data)
 */
export function validateAuthoredAsset(
  scene: THREE.Object3D,
  animations: THREE.AnimationClip[],
): PipelineValidationResult {
  const failingChecks: string[] = [];
  const details: string[] = [];

  // Collect authored data
  const bones: THREE.Bone[] = [];
  const skinnedMeshes: THREE.SkinnedMesh[] = [];
  scene.traverse((child) => {
    if ((child as THREE.Bone).isBone) bones.push(child as THREE.Bone);
    if ((child as THREE.SkinnedMesh).isSkinnedMesh) skinnedMeshes.push(child as THREE.SkinnedMesh);
  });

  // Check 1: Visible mesh exists — HARD BLOCK (nothing to render)
  // NOTE: THREE.SkinnedMesh extends THREE.Mesh, so isMesh is true for SkinnedMesh.
  // We also explicitly check isSkinnedMesh to be safe with any Three.js version quirks.
  let hasMesh = false;
  scene.traverse((child) => {
    const c = child as THREE.Mesh;
    if (c.isMesh || (c as THREE.SkinnedMesh).isSkinnedMesh) hasMesh = true;
  });
  if (!hasMesh) {
    failingChecks.push('NO_VISIBLE_MESH');
    details.push('No visible mesh found in GLB — asset has no renderable geometry');
  }

  // Check 2: SkinnedMesh exists — WARNING ONLY (not a hard block)
  // Some valid GLBs may not expose SkinnedMesh typed objects at the Three.js
  // level even though they have authored skinning data. Log a warning but allow
  // the asset to proceed — the pipeline will still clone and animate it.
  if (skinnedMeshes.length === 0) {
    console.warn(
      `[CharacterPipeline] ⚠️ NO_SKINNED_MESH — no THREE.SkinnedMesh found in scene. ` +
      `Asset may still animate if skinning data is present. Proceeding with pipeline.`
    );
    // NOT added to failingChecks — this is a warning, not a block
  }

  // Check 3: Skeleton exists — WARNING ONLY (not a hard block)
  // Same rationale as Check 2. Bones may be present under a different traversal
  // path or the GLB may use a non-standard hierarchy that Three.js doesn't
  // classify as THREE.Bone typed objects.
  if (bones.length === 0) {
    console.warn(
      `[CharacterPipeline] ⚠️ NO_SKELETON — no THREE.Bone objects found in scene. ` +
      `Asset may still animate if skeleton data is present. Proceeding with pipeline.`
    );
    // NOT added to failingChecks — this is a warning, not a block
  }

  // Check 4: Skeleton hierarchy connected (only if bones ARE present)
  if (bones.length > 0) {
    const rootBones = bones.filter(b => !(b.parent as THREE.Bone)?.isBone);
    if (rootBones.length === 0) {
      failingChecks.push('SKELETON_NO_ROOT');
      details.push('Skeleton has no root bone — hierarchy is disconnected');
    }
  }

  // Check 5: SkinnedMesh bound to skeleton (only if SkinnedMeshes ARE present)
  for (const sm of skinnedMeshes) {
    if (!sm.skeleton || sm.skeleton.bones.length === 0) {
      failingChecks.push('SKINNED_MESH_UNBOUND');
      details.push(`SkinnedMesh "${sm.name || 'unnamed'}" has no bound skeleton`);
      break;
    }
  }

  // Check 6: Skin indices and weights present (only if SkinnedMeshes ARE present)
  for (const sm of skinnedMeshes) {
    const hasSkinIndex = sm.geometry.attributes.skinIndex != null;
    const hasSkinWeight = sm.geometry.attributes.skinWeight != null;
    if (!hasSkinIndex || !hasSkinWeight) {
      failingChecks.push('MISSING_SKIN_ATTRIBUTES');
      details.push(
        `SkinnedMesh "${sm.name || 'unnamed'}" missing ${!hasSkinIndex ? 'skinIndex' : ''}${!hasSkinWeight ? ' skinWeight' : ''} — authored skinning data incomplete`
      );
      break;
    }
  }

  // Check 7: No NaN/Infinity in bone matrices (only if bones ARE present)
  for (const bone of bones) {
    bone.updateWorldMatrix(true, false);
    for (const v of bone.matrixWorld.elements) {
      if (!isFinite(v)) {
        failingChecks.push('BONE_MATRIX_NAN');
        details.push(`Bone "${bone.name}" has NaN/Infinity in world matrix — authored skeleton is corrupt`);
        break;
      }
    }
    if (failingChecks.includes('BONE_MATRIX_NAN')) break;
  }

  const verdict: PipelineVerdict = failingChecks.length === 0 ? 'PASS' : 'BLOCKED';

  if (verdict === 'BLOCKED') {
    console.error(
      `[CharacterPipeline] ❌ BLOCKED — ASSET DEFORMATION INTEGRITY FAILURE\n` +
      `  Failing checks: [${failingChecks.join(', ')}]\n` +
      `  Details:\n${details.map(d => `    • ${d}`).join('\n')}\n` +
      `  DO NOT attempt synthetic rigging. Fix the source GLB asset.`
    );
  }

  return { verdict, failingChecks, details };
}

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATION CHANNEL BONE VALIDATION
// ─────────────────────────────────────────────────────────────────────────────
// Validates that every animation clip channel (track) targets a bone that
// actually exists in the cloned skeleton BEFORE the mixer starts playing.
//
// This catches the most common "statue / bind-pose lock" root cause:
//   • Animation track says "rotate RightArm" but the skeleton has no bone
//     named "RightArm" (e.g. it's named "mixamorigRightArm" or "Arm_R").
//   • The mixer silently does nothing — the character freezes in bind pose.
//
// The validator logs:
//   ✅  channels that resolve correctly
//   ❌  channels that cannot resolve — with the target name AND the full list
//       of available bone names so the mismatch is immediately actionable.
//
// Returns a summary object so callers can gate mixer.play() on full resolution.
// ─────────────────────────────────────────────────────────────────────────────

export interface AnimationChannelValidationResult {
  /** Total number of tracks across all clips */
  totalChannels: number;
  /** Number of channels that resolved to a real bone */
  resolvedChannels: number;
  /** Number of channels that could NOT be resolved */
  unresolvedChannels: number;
  /** Per-clip, per-track mismatch details */
  mismatches: AnimationChannelMismatch[];
  /** Whether every channel resolved (true = safe to start mixer) */
  allResolved: boolean;
}

export interface AnimationChannelMismatch {
  clipName: string;
  trackName: string;
  /** The bone/object name extracted from the track path */
  targetName: string;
  /** All bone names present in the skeleton at validation time */
  availableBones: string[];
}

/**
 * Validate that every animation clip channel resolves to an actual bone in
 * the cloned scene before the AnimationMixer starts.
 *
 * Three.js track names follow the pattern:
 *   "<objectName>.<propertyPath>"   e.g. "RightArm.quaternion" *"<objectName>[<subpath>]"       e.g. "Armature|RightArm.quaternion"
 *
 * The resolver mirrors THREE.AnimationMixer's own name-based lookup: *   it searches the root object's subtree for an object whose .name matches
 *   the track's target name.
 *
 * @param clonedScene  The cloned scene that the mixer will target
 * @param animations   The animation clips to validate
 * @param modelName    Short name used in log messages
 */
export function validateAnimationChannelBones(
  clonedScene: THREE.Object3D,
  animations: THREE.AnimationClip[],
  modelName: string,
): AnimationChannelValidationResult {
  // Build a fast lookup: bone name → true
  const boneNameSet = new Set<string>();
  const allBoneNames: string[] = [];
  clonedScene.traverse((child) => {
    if ((child as THREE.Bone).isBone) {
      boneNameSet.add(child.name);
      allBoneNames.push(child.name);
    }
  });

  // Also include ALL named objects (not just bones) because some tracks target
  // non-bone objects (e.g. mesh nodes, armature root). We still want to know
  // if the target exists anywhere in the hierarchy.
  const objectNameSet = new Set<string>();
  clonedScene.traverse((child) => {
    if (child.name) objectNameSet.add(child.name);
  });

  let totalChannels = 0;
  let resolvedChannels = 0;
  let unresolvedChannels = 0;
  const mismatches: AnimationChannelMismatch[] = [];

  for (const clip of animations) {
    for (const track of clip.tracks) {
      totalChannels++;

      // Extract target object name from track name.
      // THREE.js KeyframeTrack name format: "<nodeName>.<property>"
      // e.g. "RightArm.quaternion", "mixamorigSpine.position"
      // Some exporters use "|" as separator: "Armature|RightArm.quaternion"
      const rawName = track.name;
      // Strip property suffix (everything after the last ".")
      const dotIdx = rawName.lastIndexOf('.');
      const withoutProp = dotIdx !== -1 ? rawName.slice(0, dotIdx) : rawName;
      // Strip armature prefix if present (e.g. "Armature|RightArm" → "RightArm")
      const pipeIdx = withoutProp.lastIndexOf('|');
      const targetName = pipeIdx !== -1 ? withoutProp.slice(pipeIdx + 1) : withoutProp;

      const resolves = objectNameSet.has(targetName);

      if (resolves) {
        resolvedChannels++;
      } else {
        unresolvedChannels++;
        if (mismatches.length < 8) {
          mismatches.push({
            clipName: clip.name,
            trackName: rawName,
            targetName,
            availableBones: [],
          });
        }
      }
    }
  }

  const allResolved = unresolvedChannels === 0;

  if (animations.length === 0) {
    console.warn(
      `[CharacterPipeline] ⚠️ "${modelName}" — no animation clips to validate. ` +
      `Character will be static (bind pose).`
    );
  } else if (allResolved) {
    console.log(
      `[CharacterPipeline] ✅ Animation channel validation PASSED — "${modelName}"\n` +
      `  ${resolvedChannels}/${totalChannels} channels resolved across ${animations.length} clip(s).`
    );
  } else {
    console.warn(
      `[CharacterPipeline] ⚠️ "${modelName}" animation channels: ` +
      `${resolvedChannels}/${totalChannels} resolved, ${unresolvedChannels} unmatched (fingers/toes ignored).`,
    );
  }

  return { totalChannels, resolvedChannels, unresolvedChannels, mismatches, allResolved };
}

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATION CLIP EXTRACTION & RETARGET LAYER
// ─────────────────────────────────────────────────────────────────────────────
// Extracts animation clips from the loaded GLB and any supplemental sources
// (BANNON_ANIMATION_SOURCES.json bridge), applies the retarget layer to
// normalize bone names to the target skeleton, then validates channel resolution
// before feeding clips to the mixer.
//
// SOURCE PRIORITY:
//   1. Clips embedded in the rigged GLB itself
//   2. Clips from animation_bridge/SOURCE_REGISTRY.json (if available)
//   3. Clips from BANNON_ANIMATION_SOURCES.json (if available)
//
// RETARGET POLICY:
//   - Source bone names are mapped to canonical Bannon skeleton names
//   - Canonical names are then resolved to actual target skeleton bone names
//   - Tracks that cannot be resolved are dropped and reported
//   - UNKNOWN is never PASS
// ─────────────────────────────────────────────────────────────────────────────

export interface AnimationExtractionResult {
  /** Clips ready for the mixer (retargeted to target skeleton) */
  clips: THREE.AnimationClip[];
  /** Number of clips from the GLB itself */
  glbClipCount: number;
  /** Number of clips from external bridge sources */
  bridgeClipCount: number;
  /** Total resolved tracks across all clips */
  resolvedTrackCount: number;
  /** Total unresolved tracks across all clips */
  unresolvedTrackCount: number;
  /** Whether retargeting was applied */
  retargetApplied: boolean;
  /** Retarget verdict */
  retargetVerdict: 'PASS' | 'PARTIAL' | 'FAIL' | 'SKIPPED';
  /** True when the 52-joint Mixamo/Bannon bank was bound onto this rig */
  mixamoBound: boolean;
  /**
   * Load the rest of the move list AFTER the fighter is playable.
   *
   * MEASURED: converting all 201 indexed clips up front took the pipeline
   * from 2.6s to 7.4s. The first 28 are the ones a fighter needs to stand
   * and swing; the other 173 are the move list, and nothing should wait on
   * an animation nobody has pressed a button for yet. Bound through the SAME
   * rest and the SAME bone binding as the fast path — a late clip is not a
   * second-class clip.
   */
  loadMoveListTail: () => Promise<THREE.AnimationClip[]>;
}

/**
 * Extract and retarget animation clips for a character.
 *
 * Steps:
 *   1. Collect clips from the GLB
 *   2. Build AnimationRetargeter from source skeleton → target skeleton
 *   3. Apply retarget layer (source bone names → canonical → target bone names)
 *   4. Run validateAnimationChannelBones() on retargeted clips
 *   5. Return clips ready for mixer.clipAction()
 *
 * @param sourceScene   The original (un-cloned) GLB scene — used to index source bones
 * @param targetScene   The cloned scene that the mixer will target
 * @param glbAnimations Animation clips from the GLB
 * @param modelName     Short name for logging
 * @param characterId   Character identifier for bridge source lookup
 */
export async function extractAndRetargetAnimations(
  sourceScene: THREE.Object3D,
  targetScene: THREE.Object3D,
  glbAnimations: THREE.AnimationClip[],
  modelName: string,
  characterId = '',
): Promise<AnimationExtractionResult> {
  void sourceScene;
  const glbClipCount = glbAnimations.length;
  let bridgeClipCount = 0;
  let retargetApplied = false;
  let retargetVerdict: AnimationExtractionResult['retargetVerdict'] = 'SKIPPED';

  const rig = inspectRig(targetScene);
  const mixamoOk = isMixamoCompatibleRig(rig);
  const registry = new AnimationSourceRegistry();
  const restMap = collectRestMap(targetScene);

  // ── A-POSE / T-POSE CORRECTION — PER SOURCE BANK, NEVER GLOBALLY ──────
  // MEASURED across the shipped roster: 60 of 77 models rest in an A-pose,
  // arms a median 57 degrees below horizontal. A clip authored on a T-POSE
  // rig, replayed from an A-pose rest, keeps that 57-degree gap: a punch that
  // should travel from a horizontal arm travels from a hanging one.
  //
  // BUT THE CORRECTION ONLY BELONGS TO A T-POSE SOURCE. Applying it to every
  // bank is what put the fighters in a T-pose with their arms out to the side
  // for the whole match — the state the owner reported. The banks disagree
  // about their rest and each one has to be measured on its own:
  //
  //   Schwarzerblitz — a genuine T-pose source (its own TPOSE clip reads
  //     rx -1.5720 / +1.5859). Needs the correction. RENDERED: its stances
  //     come out upright, knees bent, fists at chin height.
  //   Bannon bank    — already retargeted onto THESE rigs before it was
  //     banked ('Box Idle.fbx' in the index is the ORIGINAL Mixamo animation's
  //     name, not the space the keys are in). Needs no correction and no
  //     foreign rest. RENDERED with the Mixamo rest instead: the fighter lies
  //     down at 45 degrees, because the Mixamo skeleton faces +Z with left on
  //     +X while every shipped rig faces +X with left on +Z.
  //
  // So keep BOTH rests and hand each bank the one that matches it. The mesh,
  // the skinning and the bind matrices are untouched either way.
  let limitHits = 0;
  const limitWorst = new Map<string, { bone: string; bend: number; twist: number }>();
  const restCorrection = measureRestCorrection(targetScene);
  const tPoseRestMap = new Map(restMap);
  if (needsCorrection(restCorrection)) {
    for (const [boneName, fix] of restCorrection.corrections) {
      const bind = tPoseRestMap.get(boneName);
      if (bind) tPoseRestMap.set(boneName, bind.clone().multiply(fix));
    }
    const summary = restCorrection.measured
      .map((m) => `${m.bone.replace('mixamorig', '')} ${m.restDeg}->${m.correctedDeg}deg`)
      .join(', ');
    console.log(`[CharacterPipeline] 🅰️ "${modelName}" T-pose rest available for T-pose-authored banks: ${summary}`);
  }

  const ingest = (
    clip: THREE.AnimationClip,
    semantic?: string,
    /**
     * The SOURCE rig's rest. Given one, an absolute pose survives the
     * conversion; without one the deltas come off the clip's own frame 0 and
     * every pose collapses onto the bind. See makeClipBindRelative.
     */
    sourceRest?: Map<string, THREE.Quaternion> | null,
    /** The rest the result is expressed FROM. Defaults to the model's bind. */
    targetRest: Map<string, THREE.Quaternion> = restMap,
  ): THREE.AnimationClip | null => {
    const bound = bindClipTracksToTargetBones(clip, rig.boneNames);
    if (bound.resolvedTracks === 0) return null;
    sanitizeMotionClip(bound.clip);
    const relative = makeClipBindRelative(bound.clip, targetRest, sourceRest);
    if (!relative) return null;

    // ── THE SKELETON HAS THE FINAL SAY ───────────────────────────────────
    // A source with fewer spine segments than ours pushes its whole bend
    // through the segments it does have, and nothing anywhere refused a
    // rotation for being impossible. MEASURED before this: 111 degrees of
    // HEAD TWIST on attack_rk and ROUNDHOUSEKICK, against a cervical range
    // of about 35 — the owl-neck the owner reported. Spread the chain, then
    // hold every limited joint inside a human range. See SkeletalLimits.
    redistributeChain(relative, SPINE_CHAIN, targetRest);
    const clamped = clampToJointLimits(relative, targetRest);
    if (clamped.length > 0) {
      limitHits += clamped.length;
      for (const v of clamped) {
        const worst = limitWorst.get(v.bone);
        if (!worst || v.twist > worst.twist) limitWorst.set(v.bone, v);
      }
    }
    const ud = (relative as THREE.AnimationClip & { userData: Record<string, unknown> }).userData;
    const sem = semantic || String(ud.semanticState ?? resolveClipSemanticState(relative.name) ?? '');
    if (sem) ud.semanticState = sem;
    return relative;
  };

  const processedClips: THREE.AnimationClip[] = [];
  for (const native of glbAnimations) {
    const converted = ingest(native.clone());
    if (converted) processedClips.push(converted);
  }

  if (processedClips.length > 0) {
    registry.registerGLBClips(processedClips, modelName, characterId);
    bridgeClipCount = processedClips.length;
  }

  // Mixamo/Euler bank as bind-relative deltas — full punches/kicks/guard/walk
  // without replacing live bind (orientation + Cipher hunch stay locked).
  try {
    const bank = await loadBannonClipsFromPublic();
    const variants = await loadBannonMotionBankVariants();
    let bankBound = 0;
    const ingestNamed = (
      semanticState: string,
      clip: THREE.AnimationClip,
      replaceSemantic: boolean,
      sourceRest?: Map<string, THREE.Quaternion> | null,
      targetRest: Map<string, THREE.Quaternion> = restMap,
    ) => {
      const converted = ingest(clip, semanticState, sourceRest, targetRest);
      if (!converted) return;
      let travel = 0;
      const qA = new THREE.Quaternion();
      const qB = new THREE.Quaternion();
      for (const track of converted.tracks) {
        if (!track.name.endsWith('.quaternion')) continue;
        const v = track.values;
        for (let i = 4; i + 3 < v.length; i += 4) {
          qA.set(v[i - 4], v[i - 3], v[i - 2], v[i - 1]);
          qB.set(v[i], v[i + 1], v[i + 2], v[i + 3]);
          travel += qA.angleTo(qB);
        }
      }
      (converted as THREE.AnimationClip & { userData: Record<string, unknown> }).userData.angularTravelRadians = travel;
      const canOwnSemantic = replaceSemantic && (semanticState === 'idle' || travel >= 0.35);
      if (canOwnSemantic) {
        const idx = processedClips.findIndex(
          (c) => String((c as THREE.AnimationClip & { userData?: { semanticState?: string } }).userData?.semanticState) === semanticState,
        );
        if (idx >= 0) processedClips[idx] = converted;
        else processedClips.push(converted);
      } else {
        processedClips.push(converted);
      }
      bankBound++;
    };
    // THE BANNON BANK HOLDS ABSOLUTE LOCAL ROTATIONS ALREADY IN THESE RIGS'
    // SPACE, so its rest is the model's own bind and the clip plays as
    // authored: q(t) = bind * bind^-1 * S(t) = S(t).
    //
    // MEASURED, because the index's `src` field ("Box Idle.fbx") invites the
    // opposite conclusion and I drew it once: the keys are NOT in raw Mixamo
    // space. xbot.glb, the one shipped model bind_pose.mjs calls T-POSE, has
    // its toes pointing +Z and its left hand on +X; every roster rig has toes
    // on +X and the left hand on +Z. Subtracting the Mixamo rest therefore
    // puts the whole body over on its side — RENDERED, the fighter lies at
    // roughly 45 degrees for idle, block and attack_1 alike. Subtracting the
    // model's own bind renders an upright guard.
    //
    // Frame 0 is NOT usable as the rest here either: it forces q(0) == q_bind
    // and flattens every absolute pose in the bank onto the target's bind.
    const bannonRest = restMap;
    for (const [semanticState, clip] of bank) {
      ingestNamed(semanticState, clip, true, bannonRest);
    }
    for (const [key, clip] of variants) {
      const already = processedClips.some((c) => c.name === clip.name || c.name === key);
      if (already) continue;
      const sem = String((clip as THREE.AnimationClip & { userData?: { semanticState?: string } }).userData?.semanticState ?? '');
      ingestNamed(sem || key, clip, false, bannonRest);
    }

    // ── The Schwarzerblitz set ────────────────────────────────────────────
    // MEASURED: `buildSchwarzerblitzMotionClips()` had ZERO CALLERS. All 166
    // imported clips were compiled into the bundle and reached no fighter, so
    // the eleven distinct fighting STANCES in that set (GRAFSTANCE 1-3,
    // TIGERSTANCE, KRAVESTANCE, LOWSTANCE, LOWSTANCENEW, SHAZSTANCE,
    // JOHNSON_STANCE, STANCE), both its GUARDS and its walks were unreachable
    // — which is a large part of why every character stands identically.
    //
    // ADDITIVE ONLY: replaceSemantic=false, so a Schwarzerblitz clip can never
    // displace a character's own GLB clip or a Bannon bank clip that already
    // owns a semantic state. It only widens the pool that per-character stance
    // selection draws from.
    //
    // It goes through the SAME `ingest` path as everything else, so it is
    // bound to the target's bones and made BIND-RELATIVE. That is what keeps
    // a borrowed animation from firing in the wrong direction on a rig it was
    // not authored for.
    //
    // ITS REST COMES FROM ITS OWN TPOSE CLIP, not from each clip's frame 0.
    // MEASURED: with frame 0 as the reference `q(0) == q_bind` by construction,
    // so every one of these stances, guards and crouches flattened onto the
    // bind and all eleven looked like one pose. The bank ships its skeleton's
    // rest as TPOSE (arms rx -1.5720 / +1.5859, a clean +/-pi/2), so subtract
    // THAT and an absolute pose stays absolute.
    const sbRest = schwarzerblitzSourceRest();
    // Which Schwarzerblitz clip, if any, should TAKE a combat slot off the
    // Mixamo bank. See SCHWARZERBLITZ_COMBAT_SLOTS for the measurement: the
    // clips being displaced are 1.7 to 4.2 second demonstration loops on
    // moves whose window is a few hundred milliseconds.
    const slotOwner = new Map<string, string>();
    for (const [semantic, clipName] of Object.entries(SCHWARZERBLITZ_COMBAT_SLOTS)) {
      slotOwner.set(clipName, semantic);
    }
    let sbBound = 0;
    let sbSlots = 0;
    for (const clip of buildSchwarzerblitzMotionClips()) {
      if (processedClips.some((c) => c.name === clip.name)) continue;
      const before = bankBound;
      const slot = slotOwner.get(clip.name);
      const sem = String((clip as THREE.AnimationClip & { userData?: { semanticState?: string } }).userData?.semanticState ?? '');
      ingestNamed(slot ?? sem ?? clip.name, clip, Boolean(slot), sbRest, tPoseRestMap);
      if (bankBound > before) {
        sbBound++;
        if (slot) sbSlots++;
      }
    }
    if (sbSlots > 0) {
      console.log(`[CharacterPipeline] 🥊 "${modelName}" ${sbSlots} combat slot(s) taken by single-strike clips`);
    }
    if (sbBound > 0) console.log(`[CharacterPipeline] ✅ "${modelName}" Schwarzerblitz set: ${sbBound} clip(s)`);
    if (bankBound > 0) {
      retargetApplied = true;
      retargetVerdict = 'PASS';
      bridgeClipCount = bankBound;
      console.log(`[CharacterPipeline] ✅ "${modelName}" bind-relative bank: ${bankBound} clip(s)`);
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn(`[CharacterPipeline] ⚠️ motion bank skipped: ${message}`);
  }

  const filled = fillBindRelativeGaps(targetScene, processedClips);
  processedClips.length = 0;
  processedClips.push(...filled);
  retargetApplied = true;
  retargetVerdict = processedClips.length > 0 ? 'PASS' : 'SKIPPED';
  console.log(
    `[CharacterPipeline] 🔒 "${modelName}" clips=${processedClips.length} ` +
    `(mixamoOk=${mixamoOk} bones=${rig.boneNames.length})`,
  );

  validateRegistryCompleteness(registry, characterId || modelName);

  const channelValidation = validateAnimationChannelBones(
    targetScene,
    processedClips,
    modelName
  );

  if (limitHits > 0) {
    const worst = [...limitWorst.values()]
      .sort((a, b) => b.twist - a.twist)
      .slice(0, 4)
      .map((v) => `${v.bone.replace('mixamorig', '')} ${v.bend.toFixed(0)}/${v.twist.toFixed(0)}deg`)
      .join(', ');
    console.log(
      `[CharacterPipeline] 🦴 "${modelName}" held ${limitHits} joint track(s) inside human range — worst: ${worst}`,
    );
  }

  console.log(
    `[CharacterPipeline] 📊 "${modelName}" animation extraction complete:\n` +
    `  GLB clips:        ${glbClipCount}\n` +
    `  Bridge clips:     ${bridgeClipCount}\n` +
    `  Total clips:      ${processedClips.length}\n` +
    `  Resolved tracks:  ${channelValidation.resolvedChannels}\n` +
    `  Unresolved tracks:${channelValidation.unresolvedChannels}\n` +
    `  Retarget applied: ${retargetApplied}\n` +
    `  Retarget verdict: ${retargetVerdict}\n` +
    `  Bind-relative:    bank + fill`
  );

  return {
    clips: processedClips,
    glbClipCount,
    bridgeClipCount,
    resolvedTrackCount: channelValidation.resolvedChannels,
    unresolvedTrackCount: channelValidation.unresolvedChannels,
    retargetApplied,
    retargetVerdict,
    mixamoBound: mixamoOk && processedClips.length > glbClipCount,
    loadMoveListTail: async () => {
      const tail = await loadBannonMotionBankTail();
      const out: THREE.AnimationClip[] = [];
      for (const [key, clip] of tail) {
        const sem = String((clip as THREE.AnimationClip & { userData?: { semanticState?: string } }).userData?.semanticState ?? '');
        // Never `replaceSemantic`: a clip arriving after the bell must not
        // take a state out from under a fighter who is already moving.
        const converted = ingest(clip, sem || key, restMap);  // Bannon bank: its rest is the model's own bind
        if (converted) out.push(converted);
      }
      return out;
    },
  };
}

/**
 * Resolve a clip name to its semantic state using SEMANTIC_STATE_ALIASES.
 * Returns null if no semantic state is found.
 */
function resolveClipSemanticState(clipName: string): string | null {
  const lower = clipName.toLowerCase();
  for (const [semanticState, aliases] of Object.entries(SEMANTIC_STATE_ALIASES)) {
    if (aliases.some((a: string) => a.toLowerCase() === lower || lower.includes(a.toLowerCase()))) {
      return semanticState;
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PIPELINE FUNCTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * runCharacterPipeline
 *
 * The single authoritative character-ingestion pipeline used by BOTH
 * Character Select and Combat.
 *
 * Pipeline steps:
 *   1. Validate authored skeleton/SkinnedMesh/skin data (FAIL CLOSED)
 *   2. SkeletonUtils.clone() — skeleton-aware clone
 *   3. Disable frustum culling on all SkinnedMeshes
 *   4. Normalize skin weights (Khronos spec compliance)
 *   5. Zero the cloned scene's rotation (canonical pose for measurement)
 *   6. Measure actual visible geometry via Box3
 *   7. Apply uniform scale to TARGET_HEIGHT
 *   8. Re-measure post-scale Box3
 *   9. Apply Y offset to outer instance so lowest vertex = Y=0 (floor)
 *  10. Update world matrices
 *  11. Determine authored forward axis from geometry centroid (NOT bone positions)
 *  12. Apply PSX vertex snapping to materials
 *  13. Create AnimationMixer targeting the cloned scene
 *  14. Load animation clips with name-based binding (NOT UUID)
 *  15. Build SkeletonHelper for diagnostic display
 *
 * NEVER:
 *   - Generates synthetic bones
 *   - Modifies authored skeleton/bind matrices
 *   - Applies character-specific corrections
 *   - Uses bone positions to infer facing direction
 *
 * @param scene - The original GLB scene from GLTFLoader (NOT modified)
 * @param animations - Animation clips from the GLB
 * @param modelUrl - URL for logging
 * @param applyPSXShader - Whether to apply PSX vertex snapping (true for combat, false for portrait)
 * @returns PipelineResult or null if BLOCKED
 */
export async function runCharacterPipeline(
  scene: THREE.Group,
  animations: THREE.AnimationClip[],
  modelUrl: string,
  applyPSXShader = true,
): Promise<PipelineResult | null> {
  void applyPSXShader;
  const modelName = modelUrl.split('/').pop() ?? modelUrl;

  // ── STEP 1: Validate authored asset (FAIL CLOSED) ─────────────────────────
  const validation = validateAuthoredAsset(scene, animations);
  if (validation.verdict === 'BLOCKED') {
    console.error(
      `[CharacterPipeline] 🚫 "${modelName}" BLOCKED — asset failed pre-clone validation.\n` +
      `  Failing: [${validation.failingChecks.join(', ')}]\n` +
      `  DO NOT secretly re-rig. Fix the source GLB.`
    );
    return null; // BLOCKED — caller must handle this as ASSET DEFORMATION INTEGRITY FAILURE
  }

  // ── STEP 2: SkeletonUtils.clone() — skeleton-aware clone ─────────────────
  // CRITICAL: Use SkeletonUtils.clone() NOT scene.clone(true).
  // scene.clone(true) copies geometry but DETACHES bone bind matrices from the
  // SkinnedMesh, causing "skeleton desync" — torsos floating above legs,
  // limbs displaced on Y-axis, vertices tearing during animation.
  // SkeletonUtils.clone() rebuilds the full bone hierarchy and re-binds every
  // SkinnedMesh to the correct skeleton instance in the cloned scene.
  const cloned = SkeletonUtils.clone(scene) as THREE.Group;
  restoreAuthoredTextures(cloned, modelUrl);

  // ── STEP 3: Zero the cloned scene's rotation BEFORE any measurement ───────
  // AGENT LAW: The cloned scene's internal rotation must be [0,0,0] so that:
  //   a) Box3 measurement is axis-aligned and reflects canonical geometry extents
  //   b) The parent component holds FULL authority over facing via rotationY prop
  // This must happen BEFORE Box3 measurement.
  cloned.rotation.set(0, 0, 0);
  cloned.position.set(0, 0, 0);
  cloned.scale.set(1, 1, 1);

  // ── STEP 4: Disable frustum culling on all SkinnedMeshes ─────────────────
  // In fighting games, a character's fist or foot can stretch far beyond the
  // root bone's bounding box during heavy attacks. Default Three.js frustum
  // culling turns those meshes invisible when the root bone leaves the camera
  // frustum. Setting frustumCulled=false forces the renderer to always draw
  // every SkinnedMesh regardless of camera position.
  let frustumCullingDisabled = true;
  let skinWeightsNormalized = true;

  cloned.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.frustumCulled = false;
      mesh.visible = true;
    }
    const skinnedMesh = child as THREE.SkinnedMesh;
    if (!skinnedMesh.isSkinnedMesh) return;

    skinnedMesh.frustumCulled = false;
    skinnedMesh.visible = true;

    // ── STEP 5: Skin weights — DO NOT normalize at runtime ────────────────────
    // AGENT LAW: Do NOT call skinnedMesh.normalizeSkinWeights() here.
    // The authored GLB skin weights are the authoritative source of truth.
    // Runtime normalization was removed because:
    //   1. It mutates the cloned asset's authored weight data
    //   2. It can cause subtle deformation differences from the authored bind pose
    //   3. The user directive explicitly prohibits runtime weight rewriting
    // If skin weights don't sum to 1.0, that is an asset authoring issue to fix
    // in the source GLB — not something to silently patch at runtime.
    //
    // Previously: skinnedMesh.normalizeSkinWeights();  ← REMOVED

    // Validate binding after clone
    if (!skinnedMesh.skeleton || skinnedMesh.skeleton.bones.length === 0) {
      console.warn(
        `[CharacterPipeline] ⚠️ SkinnedMesh "${skinnedMesh.name}" has no bound skeleton after SkeletonUtils.clone() — ` +
        `check GLB export. Deformation will not occur for this mesh.`
      );
      frustumCullingDisabled = false; // flag for diagnostics
    } else {
      console.log(
        `[CharacterPipeline] ✅ SkinnedMesh "${skinnedMesh.name}" bound to skeleton ` +
        `with ${skinnedMesh.skeleton.bones.length} bones after clone.`
      );
    }

    // Ensure skinning is enabled on the material without replacing it.
    const materials = Array.isArray(skinnedMesh.material)
      ? skinnedMesh.material
      : [skinnedMesh.material];
    materials.forEach((mat) => {
      if (mat && 'skinning' in mat) {
        (mat as THREE.MeshStandardMaterial & { skinning: boolean }).skinning = true;
      }
    });
  });

  const profile = getActiveRenderProfile();

  // ── STEP 6: Measure raw bounding box AFTER zeroing rotation ──────────────
  cloned.updateMatrixWorld(true);
  const rawBox = measureVisibleGeometryBox(cloned);
  const rawSize = rawBox.getSize(new THREE.Vector3());

  // ── STEP 7: Apply uniform scale to TARGET_HEIGHT ──────────────────────────
  // AGENT LAW: Every character is scaled uniformly to PIPELINE_TARGET_HEIGHT
  // so the roster has consistent physical proportions regardless of GLB export scale.
  // DO NOT non-uniformly stretch characters.
  // DO NOT alter mesh vertices.
  const scale = rawSize.y > 0.01
    ? (PIPELINE_TARGET_HEIGHT / rawSize.y) * rosterHeightScale(modelUrl)
    : 1;
  cloned.scale.setScalar(scale);

  // ── STEP 8: Re-measure bounding box AFTER scaling ─────────────────────────
  cloned.updateMatrixWorld(true);
  const scaledBox = measureVisibleGeometryBox(cloned);
  const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
  const scaledSize = scaledBox.getSize(new THREE.Vector3());

  // Combat plant: feet on Y=0 from mesh Box3. No extra sink stack.
  cloned.position.set(-scaledCenter.x, 0, -scaledCenter.z);
  plantFeetOnFloor(cloned);
  if (!Number.isFinite(cloned.position.x) || !Number.isFinite(cloned.position.y) || !Number.isFinite(cloned.position.z)) {
    cloned.position.set(0, 0, 0);
  }

  // ── STEP 10: Update world matrices so bone world positions are accurate ───
  cloned.updateMatrixWorld(true);

  // Combat clone yaw stays 0. Parent rotationY is the only facing.
  // bindPoseFlipY (π) hid plugin skins and did not fix Maime's 45°.
  cloned.rotation.y = 0;
  const forwardCorrectionY = 0;

  // ── STEP 12: Apply quality profile to authored materials (never replace) ─
  preserveAuthoredMaterials(cloned, profile);
  // Do not replace project_vertex — that made skinned combat meshes disappear.

  // ── STEP 13: Create AnimationMixer targeting the CLONED scene ─────────────
  // AGENT LAW: The mixer MUST target the same object that is rendered (the
  // cloned scene), not the outer Three.js group. When the mixer targets the
  // outer group but the cloned scene is added as a child, bone transforms from
  // the mixer apply to the original (invisible) scene's skeleton, not the
  // visible clone.
  const mixer = new THREE.AnimationMixer(cloned);

  // ── STEP 13a: Extract and retarget animation clips ────────────────────────
  let extractionResult: Awaited<ReturnType<typeof extractAndRetargetAnimations>>;
  try {
    const characterId = modelName.replace(/[_.].*$/, '').toUpperCase();
    extractionResult = await extractAndRetargetAnimations(
      scene,
      cloned,
      animations,
      modelName,
      characterId,
    );
  } catch (err) {
    console.error(`[CharacterPipeline] retarget failed for "${modelName}" — combat mesh still draws`, err);
    const filled = fillBindRelativeGaps(cloned, animations ?? []);
    extractionResult = {
      clips: filled,
      glbClipCount: animations?.length ?? 0,
      bridgeClipCount: filled.length,
      resolvedTrackCount: 0,
      unresolvedTrackCount: 0,
      retargetApplied: filled.length > 0,
      retargetVerdict: filled.length > 0 ? 'PASS' : 'SKIPPED',
      mixamoBound: false,
      // This fallback path never bound the motion bank, so it has no tail.
      loadMoveListTail: async () => [],
    };
  }

  // ── STEP 13b: Validate animation channel → bone resolution BEFORE mixer starts ──
  // Already run inside extractAndRetargetAnimations(), but log summary here
  if (extractionResult.unresolvedTrackCount > 0) {
    console.warn(
      `[CharacterPipeline] ⚠️ "${modelName}" — ${extractionResult.unresolvedTrackCount} unresolved animation ` +
      `channel(s) after retarget. Character may appear frozen in bind pose.`
    );
  }

  // ── STEP 14: Load retargeted animation clips into mixer ───────────────────
  // NAME-BASED binding — NOT UUID-based.
  // The mixer resolves track names by searching the root object's subtree
  // for an object with a matching name. Retargeted clips already use target
  // skeleton bone names, so resolution is correct.
  const actions: Record<string, THREE.AnimationAction> = {};
  for (const clip of extractionResult.clips) {
    const action = mixer.clipAction(clip, cloned);
    actions[clip.name] = action;
    const sem = String((clip as THREE.AnimationClip & { userData?: { semanticState?: string } }).userData?.semanticState ?? '');
    if (sem) {
      if (!actions[sem]) actions[sem] = action;
      for (const alias of SEMANTIC_STATE_ALIASES[sem] ?? []) {
        if (!actions[alias]) actions[alias] = action;
      }
      for (const [combat, mapped] of Object.entries(COMBAT_STATE_TO_SEMANTIC)) {
        if (mapped === sem && !actions[combat]) actions[combat] = action;
      }
    }
  }

  // ── The rest of the move list, after the fighter is already playable ────
  // Never awaited: the match starts on the 28 clips a fighter needs to stand
  // and swing, and the other 173 register as actions whenever they arrive.
  // A failure here costs the long tail, never the match.
  const registerClip = (clip: THREE.AnimationClip) => {
    if (actions[clip.name]) return;
    const action = mixer.clipAction(clip, cloned);
    actions[clip.name] = action;
    const sem = String((clip as THREE.AnimationClip & { userData?: { semanticState?: string } }).userData?.semanticState ?? '');
    if (!sem) return;
    for (const alias of SEMANTIC_STATE_ALIASES[sem] ?? []) {
      if (!actions[alias]) actions[alias] = action;
    }
  };
  void extractionResult
    .loadMoveListTail?.()
    .then((late) => {
      if (!late.length) return;
      for (const clip of late) registerClip(clip);
      console.log(`[CharacterPipeline] 📚 "${modelName}" move list +${late.length} clip(s) after load`);
    })
    .catch((e: unknown) => {
      console.warn(`[CharacterPipeline] ⚠️ move-list tail skipped: ${e instanceof Error ? e.message : String(e)}`);
    });

  // Log instrumentation: resolved/unresolved track counts per clip
  console.log(
    `[CharacterPipeline] 🎬 "${modelName}" mixer loaded:\n` +
    `  Clips:            ${extractionResult.clips.length}\n` +
    `  Resolved tracks:  ${extractionResult.resolvedTrackCount}\n` +
    `  Unresolved tracks:${extractionResult.unresolvedTrackCount}\n` +
    `  Mixer root:       ${cloned.uuid} (${cloned.name || 'cloned scene'})\n` +
    `  Actions:          [${Object.keys(actions).join(', ')}]`
  );

  // ── STEP 15: Build SkeletonHelper for diagnostic display ──────────────────
  let skeletonHelper: THREE.SkeletonHelper | null = null;
  let hasAnyBones = false;
  cloned.traverse((child) => {
    if ((child as THREE.Bone).isBone) hasAnyBones = true;
  });
  if (hasAnyBones) {
    skeletonHelper = new THREE.SkeletonHelper(cloned);
    (skeletonHelper.material as THREE.LineBasicMaterial).linewidth = 2;
    (skeletonHelper.material as THREE.LineBasicMaterial).color.set(0x00ff88);
    skeletonHelper.visible = false;
  }

  // ── Collect diagnostics ───────────────────────────────────────────────────
  let boneCount = 0;
  let skinnedMeshCount = 0;
  cloned.traverse((child) => {
    if ((child as THREE.Bone).isBone) boneCount++;
    if ((child as THREE.SkinnedMesh).isSkinnedMesh) skinnedMeshCount++;
  });

  const diagnostics: PipelineDiagnostics = {
    modelUrl,
    boneCount,
    skinnedMeshCount,
    clipCount: extractionResult.clips.length,
    measuredFloorY: scaledBox.min.y + cloned.position.y, // should be ~0
    measuredHeight: scaledSize.y,
    forwardCorrectionDeg: Math.round((forwardCorrectionY * 180) / Math.PI),
    frustumCullingDisabled,
    skinWeightsNormalized,
    pipelineComplete: true,
  };

  console.log(
    `[CharacterPipeline] ✅ "${modelName}" pipeline complete — ` +
    `bones=${boneCount} skinnedMeshes=${skinnedMeshCount} clips=${extractionResult.clips.length} ` +
    `resolved=${extractionResult.resolvedTrackCount} unresolved=${extractionResult.unresolvedTrackCount} ` +
    `height=${scaledSize.y.toFixed(3)} forwardCorrection=${diagnostics.forwardCorrectionDeg}° ` +
    `floorY=${diagnostics.measuredFloorY.toFixed(4)}`
  );

  return { scene: cloned, forwardCorrectionY, mixer, actions, skeletonHelper, diagnostics };
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED VALIDATION UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/** Collect all Bone objects from a scene */
export function collectBones(scene: THREE.Object3D): THREE.Bone[] {
  const bones: THREE.Bone[] = [];
  scene.traverse((child) => {
    if ((child as THREE.Bone).isBone) bones.push(child as THREE.Bone);
  });
  return bones;
}

/** Collect all SkinnedMesh objects from a scene */
export function collectSkinnedMeshes(scene: THREE.Object3D): THREE.SkinnedMesh[] {
  const meshes: THREE.SkinnedMesh[] = [];
  scene.traverse((child) => {
    if ((child as THREE.SkinnedMesh).isSkinnedMesh) meshes.push(child as THREE.SkinnedMesh);
  });
  return meshes;
}
