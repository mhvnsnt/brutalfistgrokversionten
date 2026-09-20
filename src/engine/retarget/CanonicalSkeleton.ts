// `.ts` extensions on purpose — `node --experimental-strip-types` resolves
// them literally, and the offline bake imports these same modules.
import * as THREE from 'three';

import { parseGlb, type GlbJson } from '../../../tools/model_diag/bind_pose.mjs';

/**
 * THE BRUTAL FIST SKELETON.
 *
 * Tekken and Schwarzerblitz do not retarget. They have ONE skeleton, every
 * animation is authored on it, and that is why their limbs never argue with
 * their clips. MEASURED here: 59 of the 65 skinned models in public/models
 * already share a bit-identical 58-joint bind — max per-joint difference
 * under one degree, no missing joints. The skeleton existed; the discipline
 * did not, so clips from three source conventions were adapted live and each
 * one bent the body in its own way.
 *
 * This module makes that skeleton explicit so it can be read WITHOUT a
 * renderer — the offline bake needs the bind rotations and the bone
 * hierarchy, and nothing else.
 *
 * scripts/check-universal-skeleton.mjs gates every model against it.
 */
export const CANONICAL_SKELETON_MODEL = 'public/models/BANNON_rigged.glb';

/** `mixamorig:LeftArm` and `mixamorigLeftArm` are the same bone. */
export function canonicalBoneKey(name: string): string {
  return name.replace(/^mixamorig[:._-]*/i, 'mixamorig');
}

export interface CanonicalSkeleton {
  /** Bone name -> its local bind rotation. */
  rest: Map<string, THREE.Quaternion>;
  /** Bone name -> parent bone name, absent for the root. */
  parent: Map<string, string>;
  /** A bone-only Object3D tree in bind pose, for anything needing world space. */
  root: THREE.Object3D;
  /** Joint order as the skin declares it. */
  order: string[];
}

/**
 * Read the skeleton straight out of the GLB's node table.
 *
 * Deliberately NOT through GLTFLoader: the loader needs a DOM for textures,
 * and a build step that cannot run without a browser is a build step that
 * will not run. The node table carries everything a skeleton is.
 */
export function loadCanonicalSkeleton(glbBytes: Uint8Array): CanonicalSkeleton {
  const { json } = parseGlb(glbBytes);
  const skin = json.skins?.[0];
  if (!skin) throw new Error('the canonical model has no skin');

  const nameOf = (i: number) => canonicalBoneKey(json.nodes[i]?.name ?? `node${i}`);
  const parentIndex = new Map<number, number>();
  json.nodes.forEach((n, i) => (n.children ?? []).forEach((c) => parentIndex.set(c, i)));

  const rest = new Map<string, THREE.Quaternion>();
  const parent = new Map<string, string>();
  const order: string[] = [];
  const objects = new Map<number, THREE.Object3D>();

  for (const j of skin.joints) {
    const name = nameOf(j);
    if (rest.has(name)) continue;
    const n = json.nodes[j];
    order.push(name);
    rest.set(name, new THREE.Quaternion(...(n.rotation ?? [0, 0, 0, 1])));

    const bone = new THREE.Bone();
    bone.name = name;
    bone.position.fromArray(n.translation ?? [0, 0, 0]);
    bone.quaternion.fromArray(n.rotation ?? [0, 0, 0, 1]);
    bone.scale.fromArray(n.scale ?? [1, 1, 1]);
    objects.set(j, bone);
  }

  const root = new THREE.Object3D();
  root.name = 'CANONICAL_SKELETON';
  for (const j of skin.joints) {
    const bone = objects.get(j);
    if (!bone) continue;
    const p = parentIndex.get(j);
    const parentBone = p !== undefined ? objects.get(p) : undefined;
    if (parentBone) {
      parentBone.add(bone);
      parent.set(nameOf(j), nameOf(p!));
    } else {
      root.add(bone);
    }
  }
  root.updateMatrixWorld(true);

  return { rest, parent, root, order };
}
