// `.ts` extensions on purpose — the repo's runner resolves them literally.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import * as THREE from 'three';

import { clipFromBaked, type BakedClipFile, type BakedManifestEntry } from './BakedMotionBank.ts';
import { HINGE_JOINTS, JOINT_LIMITS, angleDeg, signedAngleAbout, swingTwist } from './SkeletalLimits.ts';
import { loadCanonicalSkeleton } from './CanonicalSkeleton.ts';

const BAKED = 'public/motion/baked';
const hasBake = existsSync(join(BAKED, 'index.json'));

/**
 * The bake is the whole point of having one skeleton: a clip is resolved onto
 * it ONCE, offline, so the runtime plays it and nothing else. These check the
 * output, not the code that made it — if the bake regresses, a fighter bends
 * wrong, and that has to fail here rather than in front of the player.
 */

test('the bake exists and covers both source banks', { skip: !hasBake && 'bake not run' }, () => {
  const manifest = JSON.parse(readFileSync(join(BAKED, 'index.json'), 'utf8')) as Record<string, BakedManifestEntry>;
  const names = Object.keys(manifest);
  assert.ok(names.length > 300, `only ${names.length} clips baked`);
  const banks = new Set(names.map((n) => manifest[n].bank));
  assert.ok(banks.has('bannon'), 'the Bannon bank is missing from the bake');
  assert.ok(banks.has('schwarzerblitz'), 'the Schwarzerblitz set is missing from the bake');
  for (const n of names) {
    assert.ok(existsSync(join(BAKED, manifest[n].file)), `${n} is indexed but not written`);
  }
});

test('every baked clip names bones that exist on the canonical skeleton', { skip: !hasBake && 'bake not run' }, () => {
  const skeleton = loadCanonicalSkeleton(readFileSync('public/models/BANNON_rigged.glb'));
  const known = new Set(skeleton.order);
  const files = readdirSync(BAKED).filter((f) => f.endsWith('.json') && f !== 'index.json');
  let checked = 0;
  for (const f of files) {
    const data = JSON.parse(readFileSync(join(BAKED, f), 'utf8')) as BakedClipFile;
    for (const bone of Object.keys(data.tracks)) {
      assert.ok(known.has(bone), `${f} drives "${bone}", which is not on the skeleton`);
    }
    checked++;
  }
  assert.ok(checked > 300, `only ${checked} clips checked`);
});

test('no baked clip exceeds a joint limit or bends a hinge backwards', { skip: !hasBake && 'bake not run' }, () => {
  // The constraints ran at bake time; this is the proof they took. A failure
  // here means a fighter WILL twist in play.
  const skeleton = loadCanonicalSkeleton(readFileSync('public/models/BANNON_rigged.glb'));
  const files = readdirSync(BAKED).filter((f) => f.endsWith('.json') && f !== 'index.json');
  const SLACK = 1.5; // degrees, for the rounding the bake writes at
  const offenders: string[] = [];

  for (const f of files) {
    const data = JSON.parse(readFileSync(join(BAKED, f), 'utf8')) as BakedClipFile;
    for (const [bone, track] of Object.entries(data.tracks)) {
      const bind = skeleton.rest.get(bone);
      if (!bind) continue;
      const bindInv = bind.clone().invert();
      const limit = JOINT_LIMITS[bone];
      const hinge = HINGE_JOINTS[bone];
      if (!limit && !hinge) continue;

      for (let i = 0; i + 3 < track.q.length; i += 4) {
        const rel = bindInv.clone().multiply(
          new THREE.Quaternion(track.q[i], track.q[i + 1], track.q[i + 2], track.q[i + 3]),
        );
        if (hinge) {
          const { swing, twist } = swingTwist(rel, hinge.axis);
          const angle = signedAngleAbout(twist, hinge.axis);
          if (angle > hinge.max + SLACK || angle < hinge.min - SLACK) {
            offenders.push(`${f} ${bone} hinge ${angle.toFixed(1)}deg`);
          }
          if (angleDeg(swing) > hinge.maxOffAxis + SLACK) {
            offenders.push(`${f} ${bone} off-axis ${angleDeg(swing).toFixed(1)}deg`);
          }
        } else if (limit) {
          const { swing, twist } = swingTwist(rel, new THREE.Vector3(0, 1, 0));
          if (angleDeg(swing) > limit.bend + SLACK) offenders.push(`${f} ${bone} bend ${angleDeg(swing).toFixed(1)}deg`);
          if (angleDeg(twist) > limit.twist + SLACK) offenders.push(`${f} ${bone} twist ${angleDeg(twist).toFixed(1)}deg`);
        }
      }
    }
  }
  assert.equal(offenders.length, 0, `joints outside their range after baking:\n  ${offenders.slice(0, 10).join('\n  ')}`);
});

test('the combat slots are owned by the clip the bake chose', { skip: !hasBake && 'bake not run' }, () => {
  // Owning a slot is part of resolving onto the skeleton. Without it the bake
  // ships correct animation attached to the wrong button — the authored
  // stance loses `idle` to whatever Mixamo loop merely infers the name.
  const manifest = JSON.parse(readFileSync(join(BAKED, 'index.json'), 'utf8')) as Record<string, BakedManifestEntry>;
  const owners = Object.entries(manifest).filter(([, m]) => m.owns);
  assert.ok(owners.length >= 5, `only ${owners.length} combat slots are owned`);
  const semantics = new Set(owners.map(([, m]) => m.semantic));
  for (const needed of ['idle', 'attack_1', 'block']) {
    assert.ok(semantics.has(needed), `no baked clip owns "${needed}"`);
  }
});

test('a baked file becomes a playable clip', { skip: !hasBake && 'bake not run' }, () => {
  const manifest = JSON.parse(readFileSync(join(BAKED, 'index.json'), 'utf8')) as Record<string, BakedManifestEntry>;
  const [name] = Object.keys(manifest);
  const data = JSON.parse(readFileSync(join(BAKED, manifest[name].file), 'utf8')) as BakedClipFile;
  const clip = clipFromBaked(data);
  assert.ok(clip, 'the clip did not build');
  assert.ok(clip.duration > 0);
  assert.ok(clip.tracks.length > 0);
  for (const t of clip.tracks) {
    // Rotation everywhere, and exactly one kind of translation: the hips
    // offset that plants the feet. Root motion is still stripped, so any
    // OTHER position track would be drift leaking back in.
    assert.ok(
      t.name.endsWith('.quaternion') || t.name === 'mixamorigHips.position',
      `unexpected track ${t.name}`,
    );
  }
  const ud = (clip as THREE.AnimationClip & { userData: Record<string, unknown> }).userData;
  assert.equal(ud.clipSourceType, 'BAKED_CANONICAL');
  assert.equal(ud.baked, true);
});

test('the floor lock moves only the hips, and only an airborne clip is protected from being raised', { skip: !hasBake && 'bake not run' }, () => {
  // MEASURED before it existed: every clip lifted both feet 21 to 32 cm off
  // the floor, the idle included — a fighter standing on air, which is the
  // "not planted, wobbly ragdoll" the owner reported. The lock is the
  // vertical half of foot IK, resolved at bake time.
  //
  // A GROUNDED clip is corrected BOTH ways: the floor is the floor, and a
  // foot through the mat is as wrong as a foot in the air. An AIRBORNE clip
  // is only ever lowered — a victim dips below the floor at the moment of
  // impact and that is the animation doing its job; raising the whole throw
  // for one frame would float it.
  const skeleton = loadCanonicalSkeleton(readFileSync('public/models/BANNON_rigged.glb'));
  const hipsBindY = skeleton.root.getObjectByName('mixamorigHips')?.position.y ?? 0;
  const manifest = JSON.parse(readFileSync(join(BAKED, 'index.json'), 'utf8')) as Record<string, BakedManifestEntry>;
  const files = readdirSync(BAKED).filter((f) => f.endsWith('.json') && f !== 'index.json');

  let withLock = 0;
  let airborneLocked = 0;
  for (const f of files) {
    const data = JSON.parse(readFileSync(join(BAKED, f), 'utf8')) as BakedClipFile;
    const positions = data.positions ?? {};
    for (const bone of Object.keys(positions)) {
      assert.equal(bone, 'mixamorigHips', `${f} moves ${bone} — only the hips may carry the floor lock`);
    }
    const hips = positions.mixamorigHips;
    if (!hips) continue;
    withLock++;
    const airborne = manifest[data.name]?.airborne ?? data.airborne;
    if (airborne) airborneLocked++;
    for (let i = 1; i < hips.p.length; i += 3) {
      const dy = hips.p[i] - hipsBindY;
      if (airborne) {
        assert.ok(dy <= 1e-4, `${f} is airborne and raises the hips by ${dy.toFixed(4)}`);
      }
      // Either way the offset has to be a plausible body movement, not a
      // solver blowing up: nothing legitimately shifts a fighter a metre.
      assert.ok(Math.abs(dy) < 1.0, `${f} shifts the hips by ${dy.toFixed(3)} m`);
    }
  }
  assert.ok(withLock > 200, `only ${withLock} clips carry a floor lock`);
  assert.ok(airborneLocked > 0, 'no airborne clip was lowered — the airborne path is untested');
});

test('the airborne verdict survives a clip that needs no correction', { skip: !hasBake && 'bake not run' }, () => {
  // An airborne clip that happens to touch the floor at one frame needs no
  // offset, and returning early for it used to lose the VERDICT as well — so
  // it was recorded as grounded, and every audit then judged a jump as a
  // failed stance. Measured: BIG_BODY_BLOW, peaking at 161 cm, filed as
  // "meant to be on the floor".
  const manifest = JSON.parse(readFileSync(join(BAKED, 'index.json'), 'utf8')) as Record<string, BakedManifestEntry>;
  const entries = Object.values(manifest);
  const airborne = entries.filter((m) => m.airborne);
  assert.ok(airborne.length > 50, `only ${airborne.length} clips marked airborne`);
  assert.ok(airborne.length < entries.length, 'everything cannot be airborne');
  // The clips a fight is actually made of must be on the floor.
  for (const name of ['STANCE', 'GRAFQUICKJAB', 'GUARD']) {
    if (manifest[name]) assert.equal(manifest[name].airborne, false, `${name} should be grounded`);
  }
});
