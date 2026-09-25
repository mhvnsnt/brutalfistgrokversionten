// `.ts` extensions on purpose — the repo's runner resolves them literally.
import * as THREE from 'three';

/**
 * THE BODY AND ITS SKELETON WERE NOT IN THE SAME PLACE.
 *
 * Owner, repeatedly: "a lot of character models, GLBs and attires still
 * having stretching and deformation on certain parts of their body", and
 * separately "their body twisting all around".
 *
 * WHY EVERY EXISTING CHECK VOUCHES FOR THIS DEFECT. Three.js skins a vertex
 * as
 *
 *     skinned(v) = bindMatrixInverse · SUM w (boneWorld · IBM) · bindMatrix · v
 *
 * In bind pose boneWorld is exactly inverse(IBM), so the sum collapses to the
 * IDENTITY and the result is v — whatever the weights say, whatever the
 * matrices say, and however far the mesh is from the skeleton. A model bound
 * a metre away from its own bones therefore renders PERFECTLY at rest. A
 * viewer looks right. skinqa, which asks how far a vertex drifts from where
 * its own weights predict, scores it clean. The bind-pose gate passes it.
 * Nothing in the repo could see it, which is why it shipped.
 *
 * Under pose the sum is not the identity. A vertex sitting 0.85 m from the
 * bone that carries it rides a 0.85 m LEVER: five degrees of shoulder
 * rotation drags it 7 cm. That is the stretching, and on a whole body at
 * once it is the twisting.
 *
 * MEASURED offline over all 77 shipped GLBs with tools/model_diag/bind_space.mjs,
 * as the mean distance from a vertex to the bind position of its dominant
 * joint:
 *
 *     healthy        VIPER 18.6 cm   BANNON_rigged 17.8 cm   TITAN 23.4 cm
 *     BROKEN         JAGER 85.7 cm (100% of the body past 40 cm)
 *                    JAGER_beard 80.3 cm            (100%)
 *                    TARZANIAN_DEVIL_skinned 87.6 cm (100%)
 *
 * The broken ones share one shape: the mesh sits FEET-AT-ORIGIN (Y 0..1.9)
 * while the skeleton is HIP-CENTRED (Y -0.93..0.68), the two spaces the
 * weight-transfer re-rig pipeline mixes up. It is the same family of defect
 * as the bone/mesh SCALE mismatch this repo has shipped twice before
 * (TARZANIAN_DEVIL 1.936, CODY_gear 1.944) — a rigid error rather than a
 * scale one.
 *
 * IT IS A PURE RIGID OFFSET, and that is measured, not assumed. Fitting the
 * single translation that minimises the lever arms and re-measuring:
 *
 *     JAGER                    85.7 cm / 100%   ->  17.4 cm / 0%
 *     JAGER_beard              80.3 cm / 100%   ->  16.6 cm / 0%
 *     TARZANIAN_DEVIL_skinned  87.6 cm / 100%   ->  21.8 cm / 2.1%
 *
 * — better than VIPER, from a translation alone. On healthy models the same
 * fit comes out at 4-13 cm and changes essentially nothing, which is what
 * makes the size of the fit a safe discriminator rather than a guess.
 *
 * WHY MOVE THE MESH RATHER THAN PATCH bindMatrix. Patching bindMatrix would
 * also fix the lever arms and would leave bind rendering pixel-identical
 * (bindMatrix and its inverse cancel at rest) — but it leaves the SKELETON
 * outside the body, and a skeleton outside the body is wrong for everything
 * that reads a bone: attachment points, IK, anything aimed at a hand. The
 * engine plants a fighter from the mesh Box3 ("feet on Y=0 from mesh Box3"),
 * which is recomputed here, so moving the mesh costs nothing on screen and
 * puts the bones back inside the body.
 *
 * IT RUNS AT LOAD, NOT ON THE FILES, for the same reasons SkinWeightRepair
 * does: it covers imported models too, and project law forbids rewriting
 * generated assets without asking.
 */

/**
 * How far the fitted offset must be before this is treated as a defect.
 *
 * Measured headroom: the worst HEALTHY model fits at 0.13 m and the mildest
 * BROKEN one at 0.38 m, so the line sits in an empty gap rather than through
 * a distribution.
 */
export const MIN_OFFSET_M = 0.30;

/** A repair that cannot get the body this close to its own skeleton is refused. */
export const MAX_RESIDUAL_M = 0.30;

/** …and it must be at least this much better than doing nothing. */
export const MIN_IMPROVEMENT = 2.0;

export interface BindSpaceRepairReport {
  /** Skinned meshes actually moved. */
  moved: number;
  /** Largest correction applied, in metres. */
  offsetM: number;
  /** Mean lever arm before and after, in metres. */
  beforeM: number;
  afterM: number;
  /**
   * Skeletons that looked displaced but where a rigid move did NOT help.
   * Reported rather than forced — a model whose rig is wrong in some other
   * way must not be quietly shoved around until a number improves.
   */
  refused: number;
}

interface Group {
  skeleton: THREE.Skeleton;
  meshes: THREE.SkinnedMesh[];
}

/** Bind-space position of every joint: the translation of inverse(IBM). */
function boneBindPositions(skeleton: THREE.Skeleton): THREE.Vector3[] {
  const m = new THREE.Matrix4();
  return skeleton.boneInverses.map((inv) => {
    m.copy(inv).invert();
    return new THREE.Vector3().setFromMatrixPosition(m);
  });
}

/**
 * Walk every vertex of a group, handing back the vertex in BIND space and
 * the bind position of the joint that dominates it.
 *
 * Dominant joint, not the weighted average of all four: the question is
 * which bone actually swings this vertex, and a 0.9-weighted hand plus a
 * 0.1-weighted forearm is a hand vertex.
 */
function eachVertex(
  group: Group,
  bindPos: THREE.Vector3[],
  visit: (v: THREE.Vector3, bone: THREE.Vector3) => void,
): void {
  const v = new THREE.Vector3();
  for (const mesh of group.meshes) {
    const pos = mesh.geometry.getAttribute('position');
    const idx = mesh.geometry.getAttribute('skinIndex');
    const wgt = mesh.geometry.getAttribute('skinWeight');
    if (!pos || !idx || !wgt) continue;
    for (let i = 0; i < pos.count; i++) {
      let best = -1;
      let bestW = 0;
      for (let c = 0; c < 4; c++) {
        const w = wgt.getComponent(i, c);
        if (w > bestW) { bestW = w; best = idx.getComponent(i, c); }
      }
      const bone = bindPos[best];
      if (bestW <= 0 || !bone) continue;
      v.fromBufferAttribute(pos as THREE.BufferAttribute, i).applyMatrix4(mesh.bindMatrix);
      visit(v, bone);
    }
  }
}

type GroupResult =
  | { kind: 'fine' }
  | { kind: 'refused'; offsetM: number }
  | { kind: 'moved'; offset: THREE.Vector3; before: number; after: number };

/** Repair one skeleton's meshes. */
function repairGroup(group: Group): GroupResult {
  const bindPos = boneBindPositions(group.skeleton);
  if (!bindPos.length) return { kind: 'fine' };

  // Pass 1 — the offset that minimises the summed squared lever is simply the
  // mean of (bone - vertex).
  const sum = new THREE.Vector3();
  let n = 0;
  let before = 0;
  eachVertex(group, bindPos, (v, bone) => {
    sum.x += bone.x - v.x; sum.y += bone.y - v.y; sum.z += bone.z - v.z;
    before += v.distanceTo(bone);
    n++;
  });
  if (!n) return { kind: 'fine' };
  const offset = sum.divideScalar(n);
  before /= n;
  if (offset.length() < MIN_OFFSET_M) return { kind: 'fine' };

  // Pass 2 — PROVE it helps before touching anything. A model whose rig is
  // wrong in some other way (a coat bound to the pelvis, say) also fits a
  // large offset, and shoving it will not fix it.
  let after = 0;
  eachVertex(group, bindPos, (v, bone) => {
    after += Math.hypot(v.x + offset.x - bone.x, v.y + offset.y - bone.y, v.z + offset.z - bone.z);
  });
  after /= n;
  if (after > MAX_RESIDUAL_M || after * MIN_IMPROVEMENT > before) {
    return { kind: 'refused', offsetM: offset.length() };
  }

  // Apply. The offset is in BIND space; each mesh may sit under a different
  // bindMatrix, so convert through that mesh's linear part — the same
  // correction in bind space keeps the parts of a multi-mesh body together.
  const linear = new THREE.Matrix3();
  const local = new THREE.Vector3();
  for (const mesh of group.meshes) {
    linear.setFromMatrix4(mesh.bindMatrix).invert();
    local.copy(offset).applyMatrix3(linear);
    const pos = mesh.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (!pos) continue;
    for (let i = 0; i < pos.count; i++) {
      pos.setXYZ(i, pos.getX(i) + local.x, pos.getY(i) + local.y, pos.getZ(i) + local.z);
    }
    pos.needsUpdate = true;
    mesh.geometry.computeBoundingBox();
    mesh.geometry.computeBoundingSphere();
  }
  return { kind: 'moved', offset, before, after };
}

/**
 * Put every skinned body back on its own skeleton. Safe to call on anything —
 * a scene with no skinning, or one already in the right place, reports zero
 * and touches nothing.
 */
export function repairBindSpace(root: THREE.Object3D): BindSpaceRepairReport {
  const groups = new Map<THREE.Skeleton, Group>();
  root.traverse((o) => {
    const mesh = o as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh || !mesh.skeleton?.bones?.length) return;
    let g = groups.get(mesh.skeleton);
    if (!g) { g = { skeleton: mesh.skeleton, meshes: [] }; groups.set(mesh.skeleton, g); }
    g.meshes.push(mesh);
  });

  const report: BindSpaceRepairReport = { moved: 0, offsetM: 0, beforeM: 0, afterM: 0, refused: 0 };
  for (const g of groups.values()) {
    let fit: GroupResult;
    try {
      fit = repairGroup(g);
    } catch {
      continue;
    }
    if (fit.kind === 'refused') {
      // Displaced, but a rigid move does not fix it. Say so rather than
      // shoving the body around until a number improves.
      report.refused++;
      report.offsetM = Math.max(report.offsetM, +fit.offsetM.toFixed(3));
      continue;
    }
    if (fit.kind === 'fine') continue;
    report.moved += g.meshes.length;
    report.offsetM = Math.max(report.offsetM, +fit.offset.length().toFixed(3));
    report.beforeM = Math.max(report.beforeM, +fit.before.toFixed(3));
    report.afterM = Math.max(report.afterM, +fit.after.toFixed(3));
  }
  return report;
}
