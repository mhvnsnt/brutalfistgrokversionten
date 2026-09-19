/**
 * Does the correction actually put the arm where the animation meant it to go?
 *
 * Built on a synthetic A-pose rig so the expected answer is known exactly,
 * then checked against the real numbers measured off the shipped roster.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import {
  ARM_CHAIN_BONES, CORRECTION_THRESHOLD_DEG, angleBelowHorizontal,
  measureRestCorrection, needsCorrection,
} from './RestPoseOffset.ts';
import { applyBindRelativeQuaternionTracks } from './BannonMotionBank.ts';

/**
 * A two-bone arm on each side, resting `armDeg` below horizontal.
 * Built by rotating the shoulder about Z, which is how an A-pose differs from
 * a T-pose: the arm hangs, everything else is identical.
 */
function makeRig(armDeg: number): THREE.Object3D {
  const root = new THREE.Bone();
  root.name = 'mixamorigHips';
  for (const side of ['Left', 'Right'] as const) {
    const sign = side === 'Left' ? 1 : -1;
    const arm = new THREE.Bone();
    arm.name = `mixamorig${side}Arm`;
    arm.position.set(0.2 * sign, 1.4, 0);
    // Negative Z-rotation drops the +X arm; mirror it for the other side.
    arm.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), (-armDeg * Math.PI) / 180 * sign);
    const hand = new THREE.Bone();
    hand.name = `mixamorig${side}Hand`;
    hand.position.set(0.6 * sign, 0, 0); // straight out along the arm's local X
    arm.add(hand);
    root.add(arm);
  }
  root.updateMatrixWorld(true);
  return root;
}

function armAngle(root: THREE.Object3D, side: 'Left' | 'Right'): number {
  root.updateMatrixWorld(true);
  const arm = root.getObjectByName(`mixamorig${side}Arm`)!;
  const hand = root.getObjectByName(`mixamorig${side}Hand`)!;
  const a = new THREE.Vector3().setFromMatrixPosition(arm.matrixWorld);
  const b = new THREE.Vector3().setFromMatrixPosition(hand.matrixWorld);
  return angleBelowHorizontal(b.sub(a));
}

describe('the rig fixture behaves like a real A-pose', () => {
  it('a 57-degree rig measures 57 degrees on both sides', () => {
    const rig = makeRig(57);
    assert.ok(Math.abs(armAngle(rig, 'Left') - 57) < 0.5, `left ${armAngle(rig, 'Left')}`);
    assert.ok(Math.abs(armAngle(rig, 'Right') - 57) < 0.5, `right ${armAngle(rig, 'Right')}`);
  });

  it('a T-pose rig measures ~0', () => {
    const rig = makeRig(0);
    assert.ok(Math.abs(armAngle(rig, 'Left')) < 0.5);
  });
});

describe('the correction lifts an A-pose rest to horizontal', () => {
  it('57 degrees becomes ~0, measured by re-applying it', () => {
    const rig = makeRig(57);
    const c = measureRestCorrection(rig);
    assert.ok(needsCorrection(c), 'a 57-degree A-pose must be corrected');
    assert.equal(c.corrections.size, 2, 'both arms');
    for (const m of c.measured) {
      assert.ok(Math.abs(m.restDeg - 57) < 1, `${m.bone} measured ${m.restDeg}`);
      assert.ok(Math.abs(m.correctedDeg) < 1, `${m.bone} corrected to ${m.correctedDeg}, not level`);
    }
  });

  it('works across the whole measured range of the roster (0..77 degrees)', () => {
    for (const deg of [20, 35, 45, 57, 70, 77]) {
      const c = measureRestCorrection(makeRig(deg));
      for (const m of c.measured) {
        assert.ok(Math.abs(m.correctedDeg) < 1, `${deg}-degree rig corrected to ${m.correctedDeg}`);
      }
    }
  });

  it('a rig ALREADY in a T-pose is left completely alone', () => {
    // Correcting a T-pose rig would be the same bug in the other direction.
    const c = measureRestCorrection(makeRig(0));
    assert.equal(needsCorrection(c), false);
    assert.equal(c.corrections.size, 0);
  });

  it('a rig just inside the threshold is left alone', () => {
    const c = measureRestCorrection(makeRig(CORRECTION_THRESHOLD_DEG - 2));
    assert.equal(c.corrections.size, 0, 'a near-T rig must not be touched');
  });

  it('only the arm chain is corrected — legs and spine rest identically', () => {
    const c = measureRestCorrection(makeRig(57));
    for (const bone of c.corrections.keys()) {
      assert.ok((ARM_CHAIN_BONES as readonly string[]).includes(bone), `${bone} must not be corrected`);
    }
  });
});

describe('THE POINT: a T-pose punch no longer lands at the hip', () => {
  /** A clip that holds the arm horizontal — a straight punch from a T-pose. */
  function horizontalArmClip(): THREE.AnimationClip {
    const identity = [0, 0, 0, 1];
    return new THREE.AnimationClip('punch', 1, [
      new THREE.QuaternionKeyframeTrack(
        'mixamorigLeftArm.quaternion',
        [0, 1],
        new Float32Array([...identity, ...identity]),
      ),
    ]);
  }

  /** Where the hand ends up once the clip's last frame is applied. */
  function handAngleAfter(rig: THREE.Object3D, clip: THREE.AnimationClip): number {
    const track = clip.tracks[0] as THREE.QuaternionKeyframeTrack;
    const n = track.values.length;
    const arm = rig.getObjectByName('mixamorigLeftArm')!;
    arm.quaternion.set(track.values[n - 4], track.values[n - 3], track.values[n - 2], track.values[n - 1]);
    return armAngle(rig, 'Left');
  }

  it('WITHOUT the correction the arm stays at the A-pose angle', () => {
    const rig = makeRig(57);
    const bound = applyBindRelativeQuaternionTracks(horizontalArmClip(), rig);
    const deg = handAngleAfter(rig, bound);
    assert.ok(deg > 50, `arm finished at ${deg.toFixed(0)} deg — expected it still hanging near 57`);
  });

  it('WITH the correction the arm reaches horizontal', () => {
    const rig = makeRig(57);
    const c = measureRestCorrection(rig);
    const bound = applyBindRelativeQuaternionTracks(horizontalArmClip(), rig, c.corrections);
    const deg = handAngleAfter(rig, bound);
    assert.ok(Math.abs(deg) < 2, `arm finished at ${deg.toFixed(0)} deg — expected level`);
  });

  it('the correction is worth ~57 degrees of reach, which is the whole defect', () => {
    const rigA = makeRig(57);
    const rigB = makeRig(57);
    const without = handAngleAfter(rigA, applyBindRelativeQuaternionTracks(horizontalArmClip(), rigA));
    const c = measureRestCorrection(rigB);
    const withIt = handAngleAfter(rigB, applyBindRelativeQuaternionTracks(horizontalArmClip(), rigB, c.corrections));
    assert.ok(without - withIt > 50, `only ${(without - withIt).toFixed(0)} deg recovered`);
  });

  it('a T-pose rig is unchanged by the correction path', () => {
    // Non-destructive: the 1 T-pose model in the roster must render identically.
    const rig = makeRig(0);
    const c = measureRestCorrection(rig);
    const a = handAngleAfter(makeRig(0), applyBindRelativeQuaternionTracks(horizontalArmClip(), makeRig(0)));
    const b = handAngleAfter(rig, applyBindRelativeQuaternionTracks(horizontalArmClip(), rig, c.corrections));
    assert.ok(Math.abs(a - b) < 1e-6, `T-pose changed: ${a} vs ${b}`);
  });
});
