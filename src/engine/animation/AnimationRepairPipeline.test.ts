import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { diagnoseAnimation } from './AnimationRepairPipeline.ts';

describe('AnimationRepairPipeline', () => {
  it('keeps a healthy authored strike when the measured evidence is clean', () => {
    const d = diagnoseAnimation({
      clipName: 'DEFAULT_JAB',
      semantic: 'attack_1',
      source: 'AUTHORED',
      movingBones: 18,
      boneCount: 22,
      spineUp: 0.99,
      startUp: 1,
      faceMin: 0.7,
      bodies: 1,
      unresolvedTracks: 0,
      lowerBodyCredible: true,
      hasRootTravel: false,
      loopable: true,
      owner: true,
    });
    assert.equal(d.repairClass, 'KEEP');
    assert.deepEqual(d.faults, []);
  });

  it('blocks a clip whose semantic evidence is missing instead of passing it', () => {
    const d = diagnoseAnimation({
      clipName: 'UNLABELED_MOTION',
      semantic: null,
      source: 'AUTHORED',
      movingBones: 20,
      boneCount: 22,
      spineUp: 0.98,
      startUp: 1,
      faceMin: 0.9,
      bodies: 1,
      unresolvedTracks: 0,
      lowerBodyCredible: true,
      hasRootTravel: false,
      loopable: true,
      owner: false,
    });
    assert.equal(d.repairClass, 'BLOCK');
    assert.ok(d.faults.includes('WRONG_SEMANTIC'));
  });

  it('rebakes a frozen clip rather than trying to repair it with playback speed', () => {
    const d = diagnoseAnimation({
      clipName: 'BROKEN_WALK',
      semantic: 'walk_forward',
      source: 'RETARGETED',
      movingBones: 1,
      boneCount: 22,
      spineUp: 0.99,
      startUp: 1,
      faceMin: 0.9,
      bodies: 1,
      unresolvedTracks: 0,
      lowerBodyCredible: false,
      hasRootTravel: false,
      loopable: true,
      owner: false,
    });
    assert.equal(d.repairClass, 'REBAKE');
    assert.ok(d.faults.includes('STATIC'));
    assert.ok(d.faults.includes('LOWER_BODY_UNCREDIBLE'));
  });

  it('blocks multi-body captures from solo fighter playback', () => {
    const d = diagnoseAnimation({
      clipName: 'DOUBLE_SUPERKICK',
      semantic: 'attack_1',
      source: 'AUTHORED',
      movingBones: 20,
      boneCount: 22,
      spineUp: 0.99,
      startUp: 1,
      faceMin: 0.8,
      bodies: 3,
      unresolvedTracks: 0,
      lowerBodyCredible: true,
      hasRootTravel: false,
      owner: false,
    });
    assert.equal(d.repairClass, 'BLOCK');
    assert.ok(d.faults.includes('TEAM_CAPTURE'));
  });
  it('rebakes a locomotion clip that cannot safely loop', () => {
    const d = diagnoseAnimation({
      clipName: 'BROKEN_LOOP',
      semantic: 'walk_forward',
      source: 'RETARGETED',
      movingBones: 18,
      boneCount: 22,
      spineUp: 0.99,
      startUp: 1,
      faceMin: 0.8,
      bodies: 1,
      unresolvedTracks: 0,
      lowerBodyCredible: true,
      hasRootTravel: false,
      loopable: false,
      owner: false,
    });
    assert.equal(d.repairClass, 'REBAKE');
    assert.ok(d.faults.includes('LOOP_UNSAFE'));
  });

});
