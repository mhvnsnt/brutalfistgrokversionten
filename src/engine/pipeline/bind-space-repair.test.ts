// `.ts` extensions on purpose — the repo's runner resolves them literally.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as THREE from 'three';

import { MIN_OFFSET_M, repairBindSpace } from './BindSpaceRepair.ts';

/**
 * Build a two-bone skeleton and a mesh bound to it, with the mesh optionally
 * displaced from the skeleton by `offset`.
 *
 * The displacement goes into the VERTEX POSITIONS, which is exactly how the
 * real defect arrives: the re-rig wrote the mesh in one space and the inverse
 * bind matrices in another. Bind rendering cancels it, so a test that only
 * rendered would see nothing — the assertion has to be on the lever arm.
 */
function rig(offset: THREE.Vector3, spread = 0.1) {
  const lower = new THREE.Bone();
  const upper = new THREE.Bone();
  lower.position.set(0, 0, 0);
  upper.position.set(0, 1, 0);
  lower.add(upper);
  lower.updateMatrixWorld(true);

  const skeleton = new THREE.Skeleton([lower, upper]);

  // Two vertices per bone, sitting `spread` away from it, plus the offset.
  const pos: number[] = [];
  const idx: number[] = [];
  const wgt: number[] = [];
  const at = (bone: number, y: number, dx: number) => {
    pos.push(dx + offset.x, y + offset.y, offset.z);
    idx.push(bone, 0, 0, 0);
    wgt.push(1, 0, 0, 0);
  };
  at(0, 0, spread); at(0, 0, -spread);
  at(1, 1, spread); at(1, 1, -spread);

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geom.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4));
  geom.setAttribute('skinWeight', new THREE.Float32BufferAttribute(wgt, 4));

  const mesh = new THREE.SkinnedMesh(geom, new THREE.MeshBasicMaterial());
  const root = new THREE.Group();
  root.add(lower);
  root.add(mesh);
  root.updateMatrixWorld(true);
  mesh.bind(skeleton, mesh.matrixWorld);
  return { root, mesh };
}

/** Mean distance from a vertex to the bind position of the bone that moves it. */
function meanLever(mesh: THREE.SkinnedMesh): number {
  const pos = mesh.geometry.getAttribute('position');
  const idx = mesh.geometry.getAttribute('skinIndex');
  const m = new THREE.Matrix4();
  const v = new THREE.Vector3();
  const b = new THREE.Vector3();
  let sum = 0;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos as THREE.BufferAttribute, i).applyMatrix4(mesh.bindMatrix);
    m.copy(mesh.skeleton.boneInverses[idx.getComponent(i, 0)]).invert();
    b.setFromMatrixPosition(m);
    sum += v.distanceTo(b);
  }
  return sum / pos.count;
}

describe('repairBindSpace', () => {
  it('puts a displaced body back on its skeleton', () => {
    const { root, mesh } = rig(new THREE.Vector3(0, 0.85, 0));
    assert.ok(meanLever(mesh) > 0.8, 'the displaced rig should start with a huge lever');

    const report = repairBindSpace(root);

    assert.equal(report.moved, 1);
    assert.equal(report.refused, 0);
    assert.ok(Math.abs(report.offsetM - 0.85) < 0.01, `offset ${report.offsetM}`);
    // Back to the vertex's own distance from its bone, and nothing more.
    assert.ok(Math.abs(meanLever(mesh) - 0.1) < 0.001, `lever ${meanLever(mesh)}`);
  });

  it('leaves a body that is already on its skeleton alone', () => {
    const { root, mesh } = rig(new THREE.Vector3(0, 0, 0));
    const before = mesh.geometry.getAttribute('position').array.slice();

    const report = repairBindSpace(root);

    assert.equal(report.moved, 0);
    assert.deepEqual(mesh.geometry.getAttribute('position').array, before);
  });

  it('leaves a small offset alone rather than chasing the last centimetre', () => {
    // Healthy shipped models fit 4-13cm. Moving them would be churn, not repair.
    const { root } = rig(new THREE.Vector3(0, MIN_OFFSET_M - 0.05, 0));
    assert.equal(repairBindSpace(root).moved, 0);
  });

  it('refuses to shove a body whose rig is wrong in some other way', () => {
    // Vertices scattered a metre from their bones in every direction: the mean
    // offset is large but no single translation can fix it.
    const { root, mesh } = rig(new THREE.Vector3(0, 0.85, 0), 1.2);
    const before = mesh.geometry.getAttribute('position').array.slice();

    const report = repairBindSpace(root);

    assert.equal(report.moved, 0);
    assert.equal(report.refused, 1);
    assert.deepEqual(mesh.geometry.getAttribute('position').array, before);
  });

  it('reports zero on a scene with no skinning at all', () => {
    const root = new THREE.Group();
    root.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()));
    assert.deepEqual(repairBindSpace(root), { moved: 0, offsetM: 0, beforeM: 0, afterM: 0, refused: 0 });
  });
});
