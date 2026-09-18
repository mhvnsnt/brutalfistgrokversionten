/**
 * THE TWO GUARANTEES THAT LET ONE CHARACTER USE ANOTHER'S ANIMATION.
 *
 * Borrowing motion across rigs is exactly where a fighting game goes wrong:
 * a kick fires backwards, a punch goes sideways, or a limb stretches off the
 * body. Both failures have a structural cause, and both are prevented by
 * properties of the data path rather than by luck — so both are pinned here.
 *
 * 1. ROTATION ONLY, SO NOTHING CAN STRETCH.
 *    Bone lengths live in the rest pose and the inverse bind matrices. A clip
 *    that carries only `.quaternion` tracks cannot change a bone's length, its
 *    parent offset or its scale — the geometry is mathematically untouchable.
 *    A single `.position` or `.scale` track would break that, so no clip built
 *    from a bank is allowed to have one.
 *
 * 2. BIND-RELATIVE, SO NOTHING FIRES BACKWARDS.
 *    q(t) = q_bind x q_src(0)^-1 x q_src(t). The borrowed motion is re-based
 *    onto the TARGET's own bind pose, so frame 0 is exactly where that fighter
 *    already stands and every later frame is a DELTA from it. A clip authored
 *    on a rig that faced the other way therefore plays forwards on this one.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { buildSchwarzerblitzMotionClips } from './SchwarzerblitzMotionBank.ts';
import { buildBannonMotionClips, applyBindRelativeQuaternionTracks } from './BannonMotionBank.ts';
import { RUNTIME_BONE_NAMES } from './boneNameMap.mjs';

const RUNTIME = new Set(RUNTIME_BONE_NAMES as string[]);

const BANKS: Array<[string, () => THREE.AnimationClip[]]> = [
  ['schwarzerblitz', buildSchwarzerblitzMotionClips],
  ['bannon', buildBannonMotionClips],
];

describe('a borrowed clip cannot stretch the model it is played on', () => {
  for (const [name, build] of BANKS) {
    it(`${name}: every track is a rotation, never a position or a scale`, () => {
      const clips = build();
      assert.ok(clips.length > 0, `${name} built no clips`);
      const offenders: string[] = [];
      for (const clip of clips) {
        for (const track of clip.tracks) {
          if (!track.name.endsWith('.quaternion')) offenders.push(`${clip.name}: ${track.name}`);
          else if (!(track instanceof THREE.QuaternionKeyframeTrack)) {
            offenders.push(`${clip.name}: ${track.name} is not a QuaternionKeyframeTrack`);
          }
        }
      }
      assert.deepEqual(offenders.slice(0, 5), [], `${offenders.length} non-rotation tracks would move geometry`);
    });

    it(`${name}: every track drives a bone the fight rig actually has`, () => {
      const unknown = new Set<string>();
      for (const clip of build()) {
        for (const track of clip.tracks) {
          const bone = track.name.slice(0, track.name.lastIndexOf('.')).split('|').pop() ?? '';
          if (!RUNTIME.has(bone)) unknown.add(bone);
        }
      }
      assert.deepEqual([...unknown], [], 'a track names a bone the rig does not have');
    });

    it(`${name}: every quaternion key is normalised`, () => {
      // A non-unit quaternion applied to a bone scales it — the other way a
      // rotation track can deform geometry.
      let checked = 0;
      for (const clip of build()) {
        for (const track of clip.tracks) {
          const v = track.values;
          for (let i = 0; i + 3 < v.length; i += 4) {
            const len = Math.hypot(v[i], v[i + 1], v[i + 2], v[i + 3]);
            assert.ok(Math.abs(len - 1) < 1e-3, `${clip.name}/${track.name} key ${i / 4} has |q| = ${len}`);
            checked++;
          }
        }
      }
      assert.ok(checked > 1000, `only ${checked} keys checked — the bank did not load`);
    });
  }
});

describe('a borrowed clip starts from the fighter\'s own bind pose', () => {
  /** A minimal target rig whose bind pose is deliberately NOT the identity. */
  function makeTarget(): THREE.Object3D {
    const root = new THREE.Object3D();
    for (const name of RUNTIME_BONE_NAMES as string[]) {
      const bone = new THREE.Bone();
      bone.name = name;
      // A distinctive rest orientation per bone, so "did it re-base?" is visible.
      bone.quaternion.setFromEuler(new THREE.Euler(0.11, -0.23, 0.37, 'XYZ'));
      root.add(bone);
    }
    root.updateMatrixWorld(true);
    return root;
  }

  it('frame 0 of a re-based clip IS the target bind, not the source pose', () => {
    const target = makeTarget();
    const clips = buildSchwarzerblitzMotionClips();
    const clip = clips.find((c) => c.tracks.length > 4);
    assert.ok(clip, 'expected a Schwarzerblitz clip with several tracks');

    const rebased = applyBindRelativeQuaternionTracks(clip!.clone(), target);
    let checked = 0;
    for (const track of rebased.tracks) {
      const boneName = track.name.slice(0, track.name.lastIndexOf('.')).split('|').pop() ?? '';
      const bone = target.getObjectByName(boneName);
      if (!bone) continue;
      const v = track.values;
      const first = new THREE.Quaternion(v[0], v[1], v[2], v[3]);
      // angleTo handles the q/-q double cover.
      assert.ok(
        first.angleTo(bone.quaternion) < 1e-4,
        `${boneName}: frame 0 is ${first.angleTo(bone.quaternion).toFixed(4)} rad from the bind pose — ` +
        `the borrowed clip would snap the fighter into the SOURCE rig's pose`,
      );
      checked++;
    }
    assert.ok(checked >= 4, `only ${checked} bones checked`);
  });

  it('later frames are a DELTA from the bind, so motion still happens', () => {
    // Re-basing must not flatten the animation into a held pose.
    const target = makeTarget();
    const clip = buildSchwarzerblitzMotionClips().find((c) => c.tracks.length > 4)!;
    const rebased = applyBindRelativeQuaternionTracks(clip.clone(), target);
    let moved = 0;
    for (const track of rebased.tracks) {
      const v = track.values;
      if (v.length < 8) continue;
      const a = new THREE.Quaternion(v[0], v[1], v[2], v[3]);
      let peak = 0;
      for (let i = 4; i + 3 < v.length; i += 4) {
        peak = Math.max(peak, a.angleTo(new THREE.Quaternion(v[i], v[i + 1], v[i + 2], v[i + 3])));
      }
      if (peak > 0.02) moved++;
    }
    assert.ok(moved >= 2, `re-basing flattened the clip: only ${moved} bones move`);
  });

  it('re-basing is idempotent in shape — track count and names are preserved', () => {
    const target = makeTarget();
    const clip = buildSchwarzerblitzMotionClips().find((c) => c.tracks.length > 4)!;
    const rebased = applyBindRelativeQuaternionTracks(clip.clone(), target);
    assert.equal(rebased.tracks.length, clip.tracks.length);
    assert.deepEqual(rebased.tracks.map((t) => t.name).sort(), clip.tracks.map((t) => t.name).sort());
  });
});
