// `.ts` extensions on purpose — the repo's runner resolves them literally.
import * as THREE from 'three';

/**
 * THE WEBBING BETWEEN THE WRIST AND THE HIP.
 *
 * Owner, on the shipped roster: "he had from his wrist to his hip or pelvis
 * area almost like a wrist cuff handcuff shred going from his waist to his
 * wrist on each side, and that's happening with a lot of the characters —
 * some of them are almost turning into pterodactyl Cronenberg beasts."
 *
 * He was right that it is universal and right about which characters are
 * worst. It is not the A-pose/T-pose correction, which is a RETARGET concern
 * and was genuinely fixed. This is SKIN WEIGHTS on the asset.
 *
 * MEASURED across the 56 wired models with scripts/audit-skin-bleed.mjs,
 * counting vertices pulled by two joints too far apart on the skeleton to
 * share one:
 *
 *     JAGER_beard  2209 / 37780      ECHO             608 / 12819
 *     JAGER        1409 / 33917      CIPHER_minion    513 / 11563
 *     WRECK_P...    687 / 12637      BANNON_rigged    186 / 23885
 *
 * 53 of 56 models. The top offending pair on EVERY one of them is
 * `Hips ~ Arm` or `Hips ~ ForeArm` — which is the shred he described, and
 * the ordering is why BANNON looks right to him and JAGER looks like a
 * creature.
 *
 * WHERE IT COMES FROM. These rigs were produced by transferring a proven
 * donor skeleton onto a new mesh by SPATIAL nearest neighbour. In an A-pose
 * bind the hands and forearms hang beside the hips, centimetres away, so the
 * lookup picks up hip-weighted source vertices for arm verts and arm-weighted
 * ones for hip verts. The repo already documents this exact hazard for
 * welding — "in bind pose a hand rests against a hip and 32 of those pairs
 * are coincidental, not a seam" — and it applies identically here.
 *
 * WHY NOTHING CAUGHT IT. Bind pose hides it perfectly: the membrane only
 * appears once the arm leaves the bind. And skinqa, the deformation gate,
 * measures how far a vertex drifts from where ITS OWN WEIGHTS predict — so
 * weights that are anatomically absurd still predict themselves exactly and
 * score a clean pass. Same trap as the severed rig: a metric that cannot
 * express the failure you are hunting will vouch for it.
 *
 * THE REPAIR runs at LOAD, not on the files, on purpose:
 *   - it covers the 53 shipped models AND anything imported later (the
 *     creation suite, Tripo drops, a device import) with one rule;
 *   - it cannot desync from the assets the way a one-off asset pass can;
 *   - it needs no re-encode of 53 meshopt-compressed binaries, which is its
 *     own risk for zero gain.
 * It is a single pass over the skin attributes — no geometry, no skeleton, no
 * inverse bind matrices touched.
 */

/**
 * Past this many skeleton hops apart, two joints cannot legitimately share a
 * vertex.
 *
 * DERIVED FROM ANATOMY, not tuned to a result. A vertex spans ONE joint:
 * elbow verts are ForeArm+Arm (1 hop), a shoulder blends Arm+Shoulder+Spine2
 * (2 hops), a hip blends UpLeg+Hips+Spine (2 hops). 4 is already generous —
 * it permits a shoulder-to-chest blend across the whole clavicle chain. The
 * defects measured sit at 5, 6 and 11.
 */
export const MAX_JOINT_SPAN_HOPS = 4;

/** Below this an influence is numerical dust, not something anyone authored. */
export const MIN_INFLUENCE = 0.02;

export interface SkinRepairReport {
  /** Vertices whose influence set spanned the body and was pruned. */
  repaired: number;
  /** Total vertices examined. */
  verts: number;
  /** Widest span found, in hops, before repair. */
  worstSpan: number;
}

/**
 * Hop distance between every pair of joints, from the bone parent links.
 *
 * The skeleton is a tree of at most ~60 joints, so the full matrix is a few
 * thousand numbers and one breadth-first search per joint. Computed once per
 * skeleton and reused across every mesh bound to it.
 */
export function jointHopMatrix(bones: THREE.Bone[]): number[][] {
  const index = new Map<THREE.Object3D, number>();
  bones.forEach((b, i) => index.set(b, i));
  const adjacency: number[][] = bones.map(() => []);
  bones.forEach((bone, i) => {
    const parent = bone.parent;
    if (parent && index.has(parent)) {
      const j = index.get(parent)!;
      adjacency[i].push(j);
      adjacency[j].push(i);
    }
  });
  return bones.map((_, start) => {
    const dist = new Array<number>(bones.length).fill(Infinity);
    dist[start] = 0;
    const queue = [start];
    for (let head = 0; head < queue.length; head++) {
      const cur = queue[head];
      for (const next of adjacency[cur]) {
        if (dist[next] === Infinity) {
          dist[next] = dist[cur] + 1;
          queue.push(next);
        }
      }
    }
    return dist;
  });
}

/**
 * Prune influences that cannot belong to this vertex, and renormalise.
 *
 * THE INVARIANT IS PAIRWISE: no two joints influencing one vertex may be more
 * than `maxSpan` hops apart. It is enforced directly, by repeatedly dropping
 * the LIGHTEST participant in the worst remaining pair until the condition
 * holds. With at most four influences that is a handful of comparisons.
 *
 * MEASURING FROM AN ANCHOR IS NOT ENOUGH, and my first version did exactly
 * that — dropped anything more than `maxSpan` from the heaviest influence.
 * It cut JAGER from 1409 bleeding vertices to 391 and stopped, because a
 * vertex can have every influence within 4 hops of a Spine1 anchor while
 * Spine and RightForeArm sit 5 apart FROM EACH OTHER. The audit measures the
 * worst pair, the membrane is made by the worst pair, so the repair has to
 * be about the worst pair.
 *
 * DROPPING THE LIGHTER ONE is what keeps this from hollowing out a real
 * blend: a hip vertex with 0.9 on the hip and 0.1 on the hand stays a hip
 * vertex and simply stops being told it is also a hand.
 *
 * A vertex left with only one influence becomes rigid to that joint. Fair
 * trade: rigid is what a vertex 6 hops from everything else was going to look
 * like anyway, and it is not a membrane.
 */
export function repairSkinnedMesh(
  mesh: THREE.SkinnedMesh,
  hops: number[][],
  maxSpan: number = MAX_JOINT_SPAN_HOPS,
): SkinRepairReport {
  const report: SkinRepairReport = { repaired: 0, verts: 0, worstSpan: 0 };
  // A SKELETON THAT IS NOT ONE TREE CANNOT BE JUDGED BY HOP DISTANCE.
  //
  // MEASURED on xbot.glb, the Mixamo test asset: it reports LeftArm and
  // LeftShoulder as NINE hops apart when they are adjacent on any normal
  // rig. Its bones are not parented into a single connected hierarchy, so
  // every distance is meaningless and the repair would happily prune a
  // shoulder's own blend. Refuse rather than mangle — this matters most for
  // a model nobody has looked at yet, which is every new drop.
  if (!skeletonIsConnected(hops)) return report;
  const skinIndex = mesh.geometry.attributes.skinIndex;
  const skinWeight = mesh.geometry.attributes.skinWeight;
  if (!skinIndex || !skinWeight) return report;

  const idx = new Array<number>(4);
  const wts = new Array<number>(4);

  for (let v = 0; v < skinIndex.count; v++) {
    report.verts++;
    let heaviest = 0;
    for (let k = 0; k < 4; k++) {
      idx[k] = skinIndex.getComponent(v, k);
      wts[k] = skinWeight.getComponent(v, k);
      if (wts[k] > heaviest) heaviest = wts[k];
    }
    if (heaviest <= 0) continue;

    let dropped = false;
    // NORMALISE BEFORE JUDGING, EVERY ROUND. Dropping an influence and
    // renormalising RAISES the survivors, so a stray that sat under the
    // threshold on the first pass can climb over it on the second — measured
    // on JAGER, 24 vertices survived the repair for exactly this reason and
    // the audit, which reads the final normalised weights, still saw them.
    // Judging the same numbers the audit judges is what closes it.
    //
    // Each round drops one influence, so at most three run.
    for (let round = 0; round < 4; round++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += wts[k];
      if (sum <= 0) break;
      for (let k = 0; k < 4; k++) wts[k] /= sum;

      let worst = 0;
      let victim = -1;
      for (let a = 0; a < 4; a++) {
        if (wts[a] <= MIN_INFLUENCE) continue;
        for (let b = a + 1; b < 4; b++) {
          if (wts[b] <= MIN_INFLUENCE) continue;
          const raw = hops[idx[a]]?.[idx[b]];
          if (raw === undefined) continue;
          // UNREACHABLE IS THE WORST SPAN THERE IS, NOT AN UNKNOWN ONE.
          // Skipping it is what left every vertex tied to a stray prop bone
          // in place — the two joints are in different components, so the
          // triangle between them stretches to wherever that bone sits.
          const d = Number.isFinite(raw) ? raw : UNREACHABLE_SPAN;
          if (d > report.worstSpan) report.worstSpan = d;
          if (d > worst) {
            worst = d;
            victim = wts[a] <= wts[b] ? a : b;
          }
        }
      }
      if (worst <= maxSpan || victim < 0) break;
      wts[victim] = 0;
      dropped = true;
    }
    if (!dropped) continue;

    let total = 0;
    for (let k = 0; k < 4; k++) total += wts[k];
    report.repaired++;
    // RENORMALISE, or the vertex shrinks toward the origin. A skinned vertex
    // is a weighted SUM of bone transforms; weights that no longer sum to 1
    // scale the result, which is a different and much more obvious defect
    // than the one being removed.
    if (total > 0) {
      for (let k = 0; k < 4; k++) skinWeight.setComponent(v, k, wts[k] / total);
    } else {
      // Everything was pruned. Fall back to rigid on whichever influence was
      // heaviest BEFORE the pruning, rather than leaving a zero-weight vertex
      // — that renders at the model's origin, which is a spike through the
      // middle of the body and far worse than the membrane.
      let best = 0;
      let bestW = -1;
      for (let k = 0; k < 4; k++) {
        const w = skinWeight.getComponent(v, k);
        if (w > bestW) { bestW = w; best = k; }
      }
      for (let k = 0; k < 4; k++) skinWeight.setComponent(v, k, k === best ? 1 : 0);
    }
  }

  if (report.repaired > 0) skinWeight.needsUpdate = true;
  return report;
}

/**
 * How big is the skeleton's LARGEST connected component, as a share of its
 * bones? 1.0 is one clean tree.
 */
export function largestComponentShare(hops: number[][]): number {
  if (hops.length < 2) return 0;
  let best = 0;
  for (const row of hops) {
    let reach = 0;
    for (const d of row) if (Number.isFinite(d)) reach++;
    if (reach > best) best = reach;
  }
  return best / hops.length;
}

/**
 * Is this skeleton a BODY with some bits attached, or is it shattered?
 *
 * THIS GUARD IS WHY THE REPAIR NEVER LANDED, AND THE OWNER WAS RIGHT ABOUT
 * IT: "a lot of the models are still stretching. You didn't do the universal
 * fix. You didn't get it obvious on the front end on the actual models."
 *
 * It required 90% of every joint PAIR to be mutually reachable, and then
 * refused the whole mesh when that failed — silently, with no log line.
 * MEASURED on ONYX_straightjacket, one of the models in his screenshots:
 * 58 bones, of which six are stray props named `bone_10`, `bone_11`,
 * `bone_12`, `bone_17`, `bone_18`, `bone_19`, parented outside the body.
 * 52 of 58 bones reach each other, which is 52x52 of 58x58 = 0.80, under
 * the bar — so the repair bailed out and the plank stayed on her chest.
 * The audit names the culprit outright: `RightUpLeg ~ bone_12, 11 hops`.
 *
 * A STRAY BONE IS NOT A REASON TO GIVE UP; IT IS THE DEFECT. A vertex
 * weighted to both a thigh and a bone floating outside the hierarchy has an
 * INFINITE span, not an unknown one, and it drags a triangle to wherever
 * that bone sits. Cross-component pairs are pruned now, not skipped.
 *
 * The case the old guard was written for is different and still refused:
 * xbot.glb's bones are not parented into a hierarchy AT ALL, so every
 * distance is meaningless and there is no body to prune against. That shows
 * up as no dominant component, which is what this measures.
 */
export const MIN_BODY_COMPONENT = 0.6;

/** The span reported for two joints in different components. */
export const UNREACHABLE_SPAN = 99;

export function skeletonIsConnected(hops: number[][]): boolean {
  return largestComponentShare(hops) >= MIN_BODY_COMPONENT;
}

/**
 * Repair every skinned mesh under a root. Safe to call on anything — a scene
 * with no skinning reports zero and touches nothing.
 */
export function repairSkinWeights(
  root: THREE.Object3D,
  maxSpan: number = MAX_JOINT_SPAN_HOPS,
): SkinRepairReport {
  const total: SkinRepairReport = { repaired: 0, verts: 0, worstSpan: 0 };
  const bySkeleton = new Map<THREE.Skeleton, number[][]>();
  root.traverse((o) => {
    const mesh = o as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh || !mesh.skeleton?.bones?.length) return;
    let hops = bySkeleton.get(mesh.skeleton);
    if (!hops) {
      hops = jointHopMatrix(mesh.skeleton.bones);
      bySkeleton.set(mesh.skeleton, hops);
    }
    const r = repairSkinnedMesh(mesh, hops, maxSpan);
    total.repaired += r.repaired;
    total.verts += r.verts;
    total.worstSpan = Math.max(total.worstSpan, r.worstSpan);
  });
  return total;
}
