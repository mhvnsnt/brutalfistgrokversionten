/**
 * THE SYMPTOM TEST. The owner's report was "a punch should not cause a
 * 90-degree pelvic torsion". These cases drive a real THREE.AnimationMixer with
 * a clip that rotates the pelvis 90 degrees during a punch — the same thing
 * ALTERNATINGFOREARMS measurably does — and assert the pelvis does not follow it.
 *
 * Deleting the mask makes the first case fail with a pelvis near 90 degrees,
 * which is the whole point of writing it this way round: it fails on the bug,
 * not on the fix.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  LOWER_BODY_BONES, UPPER_BODY_STATES, STANCE_STATES,
  maskForState, normalizeBoneName, isLowerBodyTrack,
  upperBodyHalf, lowerBodyHalf, isSplittable,
} from './BoneMask.ts';
import { buildAnimationController, type FighterMotionState } from '../retarget/AnimationController.ts';

const HIPS = 'mixamorigHips';
const SPINE = 'mixamorigSpine';
const THIGH = 'mixamorigLeftUpLeg';
const ARM = 'mixamorigRightArm';

/** A four-bone rig with the names the bank uses. */
function makeRig() {
  const bones: Record<string, THREE.Bone> = {};
  for (const name of [HIPS, SPINE, THIGH, ARM]) {
    const b = new THREE.Bone();
    b.name = name;
    bones[name] = b;
  }
  bones[HIPS].add(bones[SPINE]);
  bones[HIPS].add(bones[THIGH]);
  bones[SPINE].add(bones[ARM]);
  const root = new THREE.Object3D();
  root.add(bones[HIPS]);
  return { root, bones };
}

/** A clip holding each named bone at a constant rotation about Y, in degrees. */
function holdClip(name: string, held: Record<string, number>) {
  const tracks = Object.entries(held).map(([bone, deg]) => {
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(deg));
    return new THREE.QuaternionKeyframeTrack(
      `${bone}.quaternion`,
      [0, 1],
      [q.x, q.y, q.z, q.w, q.x, q.y, q.z, q.w],
    );
  });
  return new THREE.AnimationClip(name, 1, tracks);
}

function degOf(bone: THREE.Bone) {
  const axis = new THREE.Vector3();
  let angle = 0;
  // Rotation magnitude is enough here — every track in these fixtures is about Y.
  angle = 2 * Math.acos(Math.min(1, Math.abs(bone.quaternion.w)));
  void axis;
  return THREE.MathUtils.radToDeg(angle);
}

/** Play a state and let the crossfade finish. */
function settle(rig: ReturnType<typeof makeRig>, clips: Map<FighterMotionState, THREE.AnimationClip>, states: FighterMotionState[]) {
  const mixer = new THREE.AnimationMixer(rig.root);
  const controller = buildAnimationController(rig.root, mixer, { clips });
  controller.update(0.2);
  for (const s of states) {
    controller.play(s);
    for (let i = 0; i < 30; i++) controller.update(1 / 60);
  }
  return controller;
}

describe('the hips mask', () => {
  it('names the pelvis and both leg chains as the lower body', () => {
    assert.ok(LOWER_BODY_BONES.has(HIPS));
    assert.ok(LOWER_BODY_BONES.has(THIGH));
    assert.ok(!LOWER_BODY_BONES.has(SPINE), 'the spine is the upper body — that is where the boundary sits');
    assert.ok(!LOWER_BODY_BONES.has(ARM));
  });

  it('reads a bone out of any of the track-name shapes the bank produces', () => {
    assert.equal(normalizeBoneName('mixamorigHips.quaternion'), HIPS);
    assert.equal(normalizeBoneName('Armature|mixamorig:Hips.quaternion'), HIPS);
    assert.equal(normalizeBoneName('mixamorigHips.position'), HIPS);
    assert.ok(isLowerBodyTrack('Armature|mixamorig:LeftUpLeg.quaternion'));
    assert.ok(!isLowerBodyTrack('mixamorigSpine.quaternion'));
  });

  it('takes the hips POSITION with the legs, not with the strike', () => {
    // A masked strike that kept its own hip translation would still walk the
    // body around, which is the same defect one rung down.
    assert.ok(isLowerBodyTrack('mixamorigHips.position'));
  });

  it('masks hand strikes and leaves whole-body motions alone', () => {
    for (const s of ['lightAttack', 'heavyAttack', 'crouchLightAttack', 'crouchHeavyAttack'] as FighterMotionState[]) {
      assert.equal(maskForState(s), 'UPPER_BODY', `${s} is the hands' work`);
    }
    for (const s of ['lightKick', 'heavyKick', 'jumpAttack', 'runAttack', 'CommandThrow', 'knockdown', 'hit', 'taunt', 'idle'] as FighterMotionState[]) {
      assert.equal(maskForState(s), 'FULL_BODY', `${s} is the whole body and keeps its legs`);
    }
    assert.ok(!UPPER_BODY_STATES.has('lightKick'));
    assert.ok(STANCE_STATES.has('crouch'), 'a crouching strike must be able to borrow the crouch legs');
  });

  it('splits a clip into halves that keep the source duration', () => {
    const clip = holdClip('x', { [HIPS]: 90, [THIGH]: 90, [SPINE]: 45, [ARM]: 60 });
    assert.ok(isSplittable(clip));
    const upper = upperBodyHalf(clip);
    const lower = lowerBodyHalf(clip);
    assert.deepEqual(upper.tracks.map((t) => normalizeBoneName(t.name)).sort(), [ARM, SPINE].sort());
    assert.deepEqual(lower!.tracks.map((t) => normalizeBoneName(t.name)).sort(), [HIPS, THIGH].sort());
    assert.equal(upper.duration, clip.duration);
    assert.equal(lower!.duration, clip.duration);
  });

  it('hands back the same split object twice so the mixer does not mint an action per frame', () => {
    const clip = holdClip('x', { [HIPS]: 90, [SPINE]: 45 });
    assert.equal(upperBodyHalf(clip), upperBodyHalf(clip));
  });

  it('returns an all-upper-body clip whole rather than emptying it', () => {
    const clip = holdClip('armsOnly', { [SPINE]: 20, [ARM]: 40 });
    assert.ok(!isSplittable(clip));
    assert.equal(upperBodyHalf(clip), clip);
    assert.equal(lowerBodyHalf(clip), null);
  });
});

describe('a punch driving the pelvis 90 degrees', () => {
  /** idle stands square; the punch capture rotates pelvis and thigh 90. */
  const clips = () => new Map<FighterMotionState, THREE.AnimationClip>([
    ['idle', holdClip('idle', { [HIPS]: 0, [THIGH]: 0, [SPINE]: 0, [ARM]: 0 })],
    ['lightAttack', holdClip('punch', { [HIPS]: 90, [THIGH]: 90, [SPINE]: 40, [ARM]: 70 })],
    ['lightKick', holdClip('kick', { [HIPS]: 90, [THIGH]: 90, [SPINE]: 40, [ARM]: 70 })],
    ['crouch', holdClip('crouch', { [HIPS]: 10, [THIGH]: 55, [SPINE]: 5, [ARM]: 0 })],
  ]);

  it('leaves the pelvis in the stance instead of following the punch', () => {
    const rig = makeRig();
    settle(rig, clips(), ['lightAttack']);
    assert.ok(degOf(rig.bones[HIPS]) < 15, `pelvis should hold the stance, measured ${degOf(rig.bones[HIPS]).toFixed(1)} deg`);
    assert.ok(degOf(rig.bones[THIGH]) < 15, `thigh should hold the stance, measured ${degOf(rig.bones[THIGH]).toFixed(1)} deg`);
  });

  it('still plays the punch on the upper body', () => {
    const rig = makeRig();
    settle(rig, clips(), ['lightAttack']);
    assert.ok(degOf(rig.bones[ARM]) > 60, `the arm must still throw the punch, measured ${degOf(rig.bones[ARM]).toFixed(1)} deg`);
    assert.ok(degOf(rig.bones[SPINE]) > 30, `the spine twist is what gives a punch its power, measured ${degOf(rig.bones[SPINE]).toFixed(1)} deg`);
  });

  it('reports which half of the body the playing clip owns', () => {
    const rig = makeRig();
    const c = settle(rig, clips(), ['lightAttack']);
    assert.equal(c.mask, 'UPPER_BODY');
    assert.equal(c.stance, 'idle');
  });

  it('lets a KICK move the pelvis, because that is the whole body', () => {
    const rig = makeRig();
    const c = settle(rig, clips(), ['lightKick']);
    assert.equal(c.mask, 'FULL_BODY');
    assert.ok(degOf(rig.bones[HIPS]) > 60, `a kick keeps its own hips, measured ${degOf(rig.bones[HIPS]).toFixed(1)} deg`);
  });

  it('borrows the CROUCH legs for a crouching strike', () => {
    const rig = makeRig();
    const c = settle(rig, clips(), ['crouch', 'crouchLightAttack']);
    assert.equal(c.stance, 'crouch');
    const thigh = degOf(rig.bones[THIGH]);
    assert.ok(thigh > 40 && thigh < 70, `the thigh should read the live crouch (55 deg), measured ${thigh.toFixed(1)}`);
  });

  it('hands the legs back when the strike is over', () => {
    const rig = makeRig();
    const c = settle(rig, clips(), ['lightAttack', 'idle']);
    assert.equal(c.mask, 'FULL_BODY');
    assert.ok(degOf(rig.bones[HIPS]) < 10);
  });
});
