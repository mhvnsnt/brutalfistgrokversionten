import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { referenceRetargetClip } from './SkeletonUtilsReference.ts';

function rig(rootName: string) {
  const root = new THREE.Bone();
  root.name = rootName;
  const child = new THREE.Bone();
  child.name = rootName === 'Hips' ? 'Head' : 'mixamorigHead';
  root.add(child);

  const geometry = new THREE.BufferGeometry();
  const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshBasicMaterial());
  const skeleton = new THREE.Skeleton([root, child]);
  mesh.add(root);
  mesh.bind(skeleton);
  return mesh;
}

test('SkeletonUtils reference retarget maps a canonical clip without dropping tracks', () => {
  const target = rig('Hips');
  const source = rig('mixamorigHips');
  const clip = new THREE.AnimationClip('reference', 0.5, [
    new THREE.QuaternionKeyframeTrack(
      'mixamorigHips.quaternion',
      [0, 0.5],
      [0, 0, 0, 1, 0, Math.SQRT1_2, 0, Math.SQRT1_2],
    ),
  ]);

  const result = referenceRetargetClip(target, source, clip, {
    Hips: 'mixamorigHips',
    Head: 'mixamorigHead',
  });

  assert.equal(result.sourceBones, 2);
  assert.equal(result.targetBones, 2);
  assert.ok(result.mappedTracks > 0);
});
