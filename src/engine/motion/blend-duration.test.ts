// `.ts` extensions on purpose — the repo's runner resolves them literally.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as THREE from 'three';

import {
  FAST_BLEND_DEGREES, MAX_BLEND_S, MIN_BLEND_S, SLOW_BLEND_DEGREES,
  blendDurationFor, blendDurationForDistance, poseDistanceDegrees,
} from './BlendDuration.ts';

/** A skeleton whose bones are all at a given rotation about X. */
function skeletonAt(degrees: number, names = ['a', 'b', 'c']) {
  const q = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(1, 0, 0), (degrees * Math.PI) / 180,
  );
  return { bones: names.map((name) => ({ name, quaternion: q.clone() })) };
}

/** A clip whose first frame puts those bones at another rotation. */
function clipAt(degrees: number, names = ['a', 'b', 'c']) {
  const q = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(1, 0, 0), (degrees * Math.PI) / 180,
  );
  return new THREE.AnimationClip('c', 1, names.map((n) => new THREE.QuaternionKeyframeTrack(
    `${n}.quaternion`, [0, 1], [q.x, q.y, q.z, q.w, q.x, q.y, q.z, q.w],
  )));
}

/**
 * A keyframe track stores Float32 while a bone's quaternion is a double, so an
 * IDENTICAL pose measures about 0.02 degrees apart rather than exactly zero.
 * That is storage precision, not error — the tolerance has to be looser than
 * the format, and a threshold tighter than it fails against correct code.
 */
const FLOAT32_NOISE_DEGREES = 0.05;

describe('pose distance is the real angle between where you are and where you are going', () => {
  it('reads zero when the body is already in the clip\'s first pose', () => {
    const d = poseDistanceDegrees(skeletonAt(30), clipAt(30)) ?? 99;
    assert.ok(d < FLOAT32_NOISE_DEGREES, `measured ${d} degrees from itself`);
  });

  it('reads the angle between them', () => {
    const d = poseDistanceDegrees(skeletonAt(0), clipAt(40)) ?? 0;
    assert.ok(Math.abs(d - 40) < 0.5, `measured ${d}`);
  });

  /**
   * q and -q are the SAME orientation. Without the absolute value on the dot
   * product half of all pairs measure as nearly a full turn, and every one of
   * them would ask for the slowest blend in the table — a systematic sludge
   * that would look like the engine lagging rather than like a bug.
   */
  it('is not fooled by a quaternion written on the opposite hemisphere', () => {
    const clip = clipAt(10);
    const track = clip.tracks[0] as THREE.QuaternionKeyframeTrack;
    for (let i = 0; i < track.values.length; i++) track.values[i] *= -1;
    const d = poseDistanceDegrees(skeletonAt(10), clip) ?? 99;
    assert.ok(d < FLOAT32_NOISE_DEGREES, `a negated quaternion measured ${d} degrees away from itself`);
  });

  it('returns null when nothing can be compared', () => {
    assert.equal(poseDistanceDegrees(null, clipAt(0)), null);
    assert.equal(poseDistanceDegrees(skeletonAt(0), null), null);
    assert.equal(poseDistanceDegrees(skeletonAt(0, ['x']), clipAt(0, ['y'])), null,
      'no shared bone means no measurement, not a measurement of zero');
  });
});

describe('the duration follows the distance, inside the range the game already used', () => {
  it('gives the shortest blend to a near pose and the longest to a far one', () => {
    assert.ok(Math.abs(blendDurationForDistance(FAST_BLEND_DEGREES) - MIN_BLEND_S) < 1e-9);
    assert.ok(Math.abs(blendDurationForDistance(SLOW_BLEND_DEGREES) - MAX_BLEND_S) < 1e-9);
  });

  it('never leaves that range, however extreme the pose', () => {
    for (const d of [0, 5, 90, 180, 1000]) {
      const v = blendDurationForDistance(d);
      assert.ok(v >= MIN_BLEND_S - 1e-9 && v <= MAX_BLEND_S + 1e-9, `${d} deg -> ${v}s`);
    }
  });

  it('is monotonic — further is never quicker', () => {
    let prev = -1;
    for (let d = 0; d <= 120; d += 5) {
      const v = blendDurationForDistance(d);
      assert.ok(v >= prev, `${d} deg went backwards`);
      prev = v;
    }
  });

  /**
   * A transition that cannot be measured must behave EXACTLY as it did before,
   * not as an average. Otherwise adding this changes clips it cannot even see.
   */
  it('falls back to the caller\'s own value when it cannot measure', () => {
    assert.equal(blendDurationFor(null, null, 0.077), 0.077);
    assert.equal(blendDurationFor(skeletonAt(0, ['x']), clipAt(0, ['y']), 0.077), 0.077);
  });

  it('uses the measurement when it can', () => {
    assert.notEqual(blendDurationFor(skeletonAt(0), clipAt(68), 0.077), 0.077);
  });
});
