// `.ts` extensions on purpose — the repo's runner resolves them literally.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as THREE from 'three';

import {
  MAX_JOINT_SPAN_HOPS, jointHopMatrix, repairSkinnedMesh,
} from './SkinWeightRepair.ts';

/**
 * A chain long enough to hold a real defect: hips -> spine -> spine1 ->
 * spine2 -> shoulder -> arm -> forearm -> hand is 7 hops end to end, which is
 * exactly the wrist-to-hip span measured on the shipped roster.
 */
function makeSkeleton(): THREE.Bone[] {
  const names = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Shoulder', 'Arm', 'ForeArm', 'Hand'];
  const bones = names.map((n) => { const b = new THREE.Bone(); b.name = n; return b; });
  for (let i = 1; i < bones.length; i++) bones[i - 1].add(bones[i]);
  return bones;
}

/** One vertex, four influences, so a whole case fits in a line. */
function makeMesh(bones: THREE.Bone[], idx: number[], wts: number[]): THREE.SkinnedMesh {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(wts, 4));
  const mesh = new THREE.SkinnedMesh(geo, new THREE.MeshBasicMaterial());
  mesh.bind(new THREE.Skeleton(bones));
  return mesh;
}

function weightsOf(mesh: THREE.SkinnedMesh): number[] {
  const a = mesh.geometry.attributes.skinWeight;
  return [0, 1, 2, 3].map((k) => +a.getComponent(0, k).toFixed(4));
}

describe('skin weight repair — the wrist-to-hip webbing', () => {
  const bones = makeSkeleton();
  const hops = jointHopMatrix(bones);

  it('measures hop distance along the real bone parent links', () => {
    assert.equal(hops[0][0], 0);
    assert.equal(hops[0][1], 1, 'Hips to Spine is one joint');
    assert.equal(hops[5][6], 1, 'Arm to ForeArm is one joint');
    assert.equal(hops[0][7], 7, 'Hips to Hand is the span the owner described');
  });

  it('cuts a hip vertex that is also being pulled by the hand', () => {
    // 0.75 Hips, 0.20 Spine, 0.05 Hand — the hand is what makes the membrane.
    const mesh = makeMesh(bones, [0, 1, 7, 0], [0.75, 0.2, 0.05, 0]);
    const r = repairSkinnedMesh(mesh, hops);
    assert.equal(r.repaired, 1);
    const w = weightsOf(mesh);
    assert.equal(w[2], 0, 'the hand influence on a hip vertex is gone');
    assert.ok(Math.abs(w[0] + w[1] + w[2] + w[3] - 1) < 1e-4, 'weights must still sum to 1');
    assert.ok(w[0] > 0.75, 'the vertex stays a hip vertex and gets heavier, not lighter');
  });

  it('leaves a legitimate elbow blend completely alone', () => {
    // Arm + ForeArm is ONE hop. This is what skinning is for.
    const mesh = makeMesh(bones, [5, 6, 0, 0], [0.5, 0.5, 0, 0]);
    const before = weightsOf(mesh);
    const r = repairSkinnedMesh(mesh, hops);
    assert.equal(r.repaired, 0, 'a one-hop blend is not a defect');
    assert.deepEqual(weightsOf(mesh), before);
  });

  it('leaves a shoulder blending across the clavicle chain alone', () => {
    // Shoulder + Arm + Spine2 spans 2 hops — inside the anatomical budget.
    const mesh = makeMesh(bones, [3, 4, 5, 0], [0.3, 0.4, 0.3, 0]);
    const r = repairSkinnedMesh(mesh, hops);
    assert.equal(r.repaired, 0);
  });

  it('enforces the PAIRWISE span, not the distance from the heaviest', () => {
    // THE BUG MY FIRST VERSION HAD. Anchor on Spine2 (heaviest): Hips is 3
    // hops away and Hand is 4, so anchoring keeps both — while Hips and Hand
    // are SEVEN apart from each other, which is the membrane. It cut JAGER
    // from 1409 to 391 and stalled there.
    const mesh = makeMesh(bones, [3, 0, 7, 0], [0.5, 0.3, 0.2, 0]);
    const r = repairSkinnedMesh(mesh, hops);
    assert.equal(r.repaired, 1, 'the worst PAIR has to be what is judged');
    const w = weightsOf(mesh);
    const kept = [0, 1, 2, 3].filter((k) => w[k] > 0);
    for (const a of kept) {
      for (const b of kept) {
        const ia = mesh.geometry.attributes.skinIndex.getComponent(0, a);
        const ib = mesh.geometry.attributes.skinIndex.getComponent(0, b);
        assert.ok(hops[ia][ib] <= MAX_JOINT_SPAN_HOPS, 'a bad pair survived the repair');
      }
    }
  });

  it('re-checks after renormalising, because pruning RAISES the survivors', () => {
    // THE SECOND BUG, measured: 24 JAGER vertices survived because a stray
    // sat under the 0.02 threshold on the first pass and climbed over it once
    // the weights were renormalised. 0.94 Hips / 0.04 Spine1 / 0.019 Hand:
    // the hand is dust until the other two are cut back.
    const mesh = makeMesh(bones, [0, 2, 7, 6], [0.94, 0.04, 0.019, 0.001]);
    repairSkinnedMesh(mesh, hops);
    const w = weightsOf(mesh);
    const idxAttr = mesh.geometry.attributes.skinIndex;
    for (let a = 0; a < 4; a++) {
      for (let b = a + 1; b < 4; b++) {
        if (w[a] <= 0.02 || w[b] <= 0.02) continue;
        const d = hops[idxAttr.getComponent(0, a)][idxAttr.getComponent(0, b)];
        assert.ok(d <= MAX_JOINT_SPAN_HOPS, `pair survived at ${d} hops after renormalising`);
      }
    }
  });

  it('never leaves a vertex with no weight at all', () => {
    // A zero-weight skinned vertex renders at the model origin — a spike
    // through the middle of the body, far worse than the membrane.
    const mesh = makeMesh(bones, [0, 7, 0, 0], [0.5, 0.5, 0, 0]);
    repairSkinnedMesh(mesh, hops);
    const w = weightsOf(mesh);
    assert.ok(w.reduce((a, b) => a + b, 0) > 0.99, 'the vertex lost all its weight');
  });

  it('does nothing to a mesh with no skin attributes', () => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
    const mesh = new THREE.SkinnedMesh(geo, new THREE.MeshBasicMaterial());
    mesh.bind(new THREE.Skeleton(bones));
    const r = repairSkinnedMesh(mesh, hops);
    assert.equal(r.repaired, 0);
    assert.equal(r.verts, 0);
  });
});
