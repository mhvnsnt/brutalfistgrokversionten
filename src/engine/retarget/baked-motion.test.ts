// `.ts` extensions on purpose — the repo's runner resolves them literally.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import * as THREE from 'three';

import { clipFromBaked, markFrozen, markSlotOwners, markStandability, type BakedClipFile, type BakedManifestEntry } from './BakedMotionBank.ts';
import { HINGE_JOINTS, JOINT_LIMITS, angleDeg, signedAngleAbout, swingTwist, removeConstantConventionTwist } from './SkeletalLimits.ts';
import { loadCanonicalSkeleton } from './CanonicalSkeleton.ts';

const BAKED = 'public/motion/baked';
const hasBake = existsSync(join(BAKED, 'index.json'));

/**
 * The bake is the whole point of having one skeleton: a clip is resolved onto
 * it ONCE, offline, so the runtime plays it and nothing else. These check the
 * output, not the code that made it — if the bake regresses, a fighter bends
 * wrong, and that has to fail here rather than in front of the player.
 */

test('constant thigh convention twist is removed without flattening dynamic motion', () => {
  const rest = new Map<string, THREE.Quaternion>([
    ['mixamorigLeftUpLeg', new THREE.Quaternion()],
  ]);
  const times = [0, 0.5, 1];
  const values: number[] = [];
  for (const deg of [170, 175, 165]) {
    const q = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      THREE.MathUtils.degToRad(deg),
    );
    values.push(q.x, q.y, q.z, q.w);
  }
  const clip = new THREE.AnimationClip('THIGH_CONVENTION', 1, [
    new THREE.QuaternionKeyframeTrack('mixamorigLeftUpLeg.quaternion', times, values),
  ]);
  const corrected = removeConstantConventionTwist(clip, rest);
  assert.equal(corrected.length, 1);
  const track = clip.tracks[0] as THREE.QuaternionKeyframeTrack;
  const first = new THREE.Quaternion(track.values[0], track.values[1], track.values[2], track.values[3]);
  assert.ok(Math.abs(signedAngleAbout(swingTwist(first, new THREE.Vector3(0, 1, 0)).twist, new THREE.Vector3(0, 1, 0))) < 15);

  const dynamic = new THREE.AnimationClip('DYNAMIC_THIGH', 1, [
    new THREE.QuaternionKeyframeTrack('mixamorigLeftUpLeg.quaternion', times, [
      ...new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(170)).toArray(),
      ...new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(80)).toArray(),
      ...new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(-80)).toArray(),
    ]),
  ]);
  assert.equal(removeConstantConventionTwist(dynamic, rest).length, 0);
});

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

test('baked clips keep constant authored pelvis offsets but drop variable floor-lock motion', () => {
  const base: BakedClipFile = {
    name: 'POSITION_POLICY',
    bank: 'bannon',
    dur: 1,
    tracks: {
      mixamorigHips: {
        t: [0, 1],
        q: [0, 0, 0, 1, 0, 0, 0, 1],
      },
    },
    positions: {
      mixamorigHips: {
        t: [0, 1],
        p: [0, -0.435, 0, 0, -0.435, 0],
      },
    },
  };
  const constant = clipFromBaked(base);
  assert.ok(constant);
  assert.ok(constant.tracks.some((t) => t.name === 'mixamorigHips.position'));
  assert.equal(
    (constant as THREE.AnimationClip & { userData: Record<string, unknown> }).userData.constantPositionTracks,
    1,
  );

  const variable = clipFromBaked({
    ...base,
    positions: {
      mixamorigHips: {
        t: [0, 1],
        p: [0, -0.435, 0, 0, -0.20, 0],
      },
    },
  });
  assert.ok(variable);
  assert.equal(variable.tracks.some((t) => t.name === 'mixamorigHips.position'), false);
  assert.equal(
    (variable as THREE.AnimationClip & { userData: Record<string, unknown> }).userData.constantPositionTracks,
    0,
  );
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

/**
 * THE FLOOR, AND THE TWO WAYS IT HAS ALREADY GONE WRONG.
 *
 * First a per-frame Hips.position track planted the feet and fought the
 * authored gait — the pelvis being translated at every sample while the knees
 * were already solving their own step. Then that track was deleted outright
 * and NOBODY'S FEET TOUCHED THE GROUND: measured on the shipped bake, STANCE
 * floated 23.3 cm, GRAFQUICKJAB 31.9 cm, every combat slot 18-32 cm.
 *
 * The shape that is neither: ONE constant key. It moves the clip to the right
 * height once and leaves every frame's relative motion alone.
 */
test('grounding is a single constant key, never a per-frame track', { skip: !hasBake }, () => {
  const files = readdirSync(BAKED).filter((f) => f.endsWith('.json') && f !== 'index.json');
  assert.ok(files.length > 100, 'expected a full bake');
  const offenders: string[] = [];
  let withOffset = 0;
  for (const f of files) {
    const data = JSON.parse(readFileSync(join(BAKED, f), 'utf8')) as BakedClipFile;
    for (const [bone, track] of Object.entries(data.positions ?? {})) {
      if (track.t.length > 1) offenders.push(`${data.name}:${bone} has ${track.t.length} keys`);
      else withOffset++;
    }
  }
  assert.deepEqual(offenders.slice(0, 5), [], 'a multi-key translation track is the old floor lock');
  assert.ok(withOffset > 100, `expected most clips to carry a grounding offset, got ${withOffset}`);
});

/**
 * A clip whose feet never reach the floor cannot be somebody's stance, and
 * the pool's only other measurement cannot say so: peakDeg asks whether a
 * clip HOLDS a pose, not where the pose is. STANCE_WIDE scores 10 deg and
 * stands 107 cm in the air.
 */
test('standability is decided by the measured floor gap, not by name', () => {
  const manifest: Record<string, BakedManifestEntry> = {
    ON_THE_FLOOR: { file: 'a.json', bank: 'b', dur: 1, bones: 20, floorGap: 0 },
    A_LITTLE_HIGH: { file: 'b.json', bank: 'b', dur: 1, bones: 20, floorGap: 0.02 },
    HOVERING: { file: 'c.json', bank: 'b', dur: 1, bones: 20, floorGap: 1.07 },
    A_JUMP: { file: 'd.json', bank: 'b', dur: 1, bones: 20, airborne: true, floorGap: 0 },
    A_CROUCH: { file: 'f.json', bank: 'b', dur: 1, bones: 20, airborne: true, floorGap: 0.041 },
    UNMEASURED: { file: 'e.json', bank: 'b', dur: 1, bones: 20 },
  };
  const out = markStandability(manifest);
  assert.equal(out.has('ON_THE_FLOOR'), false);
  assert.equal(out.has('A_LITTLE_HIGH'), false);
  assert.equal(out.has('HOVERING'), true, 'a clip a metre off the mat is not a stance');
  assert.equal(out.has('A_JUMP'), false, 'a peak lift says nothing — only never coming down does');
  assert.equal(out.has('A_CROUCH'), false, 'a crouch lifts a foot past the airborne peak and still plants');
  assert.equal(out.has('UNMEASURED'), false, 'an unmeasured clip must behave exactly as before');
});

/** The shipped bake must agree: every clip a stance pool can hand out stands. */
test('no shipped stance clip is left hovering', { skip: !hasBake }, () => {
  const manifest = JSON.parse(readFileSync(join(BAKED, 'index.json'), 'utf8')) as Record<string, BakedManifestEntry>;
  const unstandable = markStandability(manifest);
  // EMPTY, AND IT USED TO NAME FIVE. GUARD_HIGH, GUARD_LOW, STANCE_BLADED,
  // STANCE_CROUCH and STANCE_WIDE were all "authored too high" — they were
  // not. Their thighs were folded up over the torso, so the lowest foot sat
  // a metre in the air. The bake puts the legs back down (see
  // correctInvertedLegs) and all five now stand on the mat.
  //
  // This stays as a GATE: any stance-pool clip that cannot reach the floor
  // is a regression, and the list is the evidence.
  const KNOWN_HOVERING: string[] = [];
  const posePools = new Set([...KNOWN_HOVERING, 'STANCE', 'GUARD', 'CENTER_BLOCK', 'CROUCHING',
    'GRAFSTANCE2', 'GRAFSTANCE3', 'JOHNSON_STANCE', 'LOWSTANCE', 'LOWSTANCENEW', 'LOWSTANCEGUARD',
    'SHAZSTANCE', 'TIGERSTANCE', 'TIGERSTANCEUPDATED', 'WALK', 'WALKFAST', 'SHAZWALK', 'DRUNK_WALK']);
  const hovering = [...unstandable].filter((n) => posePools.has(n)).sort();
  assert.deepEqual(hovering, KNOWN_HOVERING, 'the set of hovering stance clips changed');
});

/**
 * A CLIP THAT DOES NOT MOVE IS NOT AN ANIMATION.
 *
 * HURRICANE_KICK is the case that matters: it moves exactly ONE bone of 22.
 * The hips sweep 172 degrees while every other joint sits inside half a
 * degree, so it plays as a statue spinning on the spot — and it is the
 * FIRST alias for attack_2 and attack_rk, so two of the game's core kicks
 * were that statue. The alias table carried a written note about it and
 * left it, calling the reorder a design decision.
 */
test('frozen clips are identified by measurement, not by name', () => {
  const manifest: Record<string, BakedManifestEntry> = {
    A_REAL_KICK:   { file: 'a', bank: 'b', dur: 1, bones: 22, boneCount: 22, movingBones: 14 },
    SPINNING_STATUE: { file: 'b', bank: 'b', dur: 1, bones: 22, boneCount: 22, movingBones: 1 },
    A_REST_POSE:   { file: 'c', bank: 'b', dur: 1, bones: 22, boneCount: 22, movingBones: 0 },
    A_SUBTLE_POSE: { file: 'd', bank: 'b', dur: 1, bones: 22, boneCount: 22, movingBones: 3 },
    TINY_RIG:      { file: 'e', bank: 'b', dur: 1, bones: 4, boneCount: 4, movingBones: 0 },
    UNMEASURED:    { file: 'f', bank: 'b', dur: 1, bones: 22 },
  };
  const frozen = markFrozen(manifest);
  assert.equal(frozen.has('SPINNING_STATUE'), true, 'one bone of 22 is not an animation');
  assert.equal(frozen.has('A_REST_POSE'), true);
  assert.equal(frozen.has('A_REAL_KICK'), false);
  assert.equal(frozen.has('A_SUBTLE_POSE'), false, 'three moving bones is a real, small motion');
  assert.equal(frozen.has('TINY_RIG'), false, 'a 4-bone rig is not judged by this rule');
  assert.equal(frozen.has('UNMEASURED'), false, 'an unmeasured clip behaves exactly as before');
});

test('the shipped bake still flags the hurricane kick as frozen', { skip: !hasBake }, () => {
  const manifest = JSON.parse(readFileSync(join(BAKED, 'index.json'), 'utf8')) as Record<string, BakedManifestEntry>;
  const hk = manifest.HURRICANE_KICK;
  if (!hk) return;
  assert.ok((hk.movingBones ?? 99) <= 2, `HURRICANE_KICK moves ${hk.movingBones} bones — has the source been replaced?`);
  assert.equal(markFrozen(manifest).has('HURRICANE_KICK'), true);
});

test('the frozen set stays small — a wide net here would mute real moves', { skip: !hasBake }, () => {
  const manifest = JSON.parse(readFileSync(join(BAKED, 'index.json'), 'utf8')) as Record<string, BakedManifestEntry>;
  const frozen = markFrozen(manifest);
  const total = Object.keys(manifest).length;
  assert.ok(frozen.size > 0, 'nothing was measured as frozen — is movingBones being written?');
  assert.ok(frozen.size < total * 0.1, `${frozen.size}/${total} clips called frozen — the threshold is too wide`);
});

/**
 * THE BAKE'S CHOICE MUST REACH THE RUNTIME.
 *
 * The bake measures the candidates for each combat slot and marks a winner
 * — GRAFQUICKJAB, a 0.46 s jab, over BOXING, a 1.73 s shadowboxing LOOP.
 * Nothing at runtime read that, so a jab played BOXING inside an attack
 * window a fraction of its length, and both kick slots played
 * HURRICANE_KICK, which moves one bone of 22.
 */
test('every combat slot has an owner, and it is a real single strike', { skip: !hasBake }, () => {
  const manifest = JSON.parse(readFileSync(join(BAKED, 'index.json'), 'utf8')) as Record<string, BakedManifestEntry>;
  const owners = markSlotOwners(manifest);
  const frozen = markFrozen(manifest);

  for (const slot of ['attack_1', 'attack_rp', 'attack_rk', 'block', 'idle']) {
    const owner = owners.get(slot);
    assert.ok(owner, `${slot} has no owner — the runtime will fall back to alias order`);
    assert.equal(frozen.has(owner), false, `${slot} is owned by a frozen clip: ${owner}`);
  }
});

test('an attack slot is never owned by a multi-second demonstration clip', { skip: !hasBake }, () => {
  const manifest = JSON.parse(readFileSync(join(BAKED, 'index.json'), 'utf8')) as Record<string, BakedManifestEntry>;
  const owners = markSlotOwners(manifest);
  // A single strike is well under a second. BOXING is 1.73 s and is a LOOP;
  // that mismatch is what made every punch read as shadowboxing.
  const LONGEST_SINGLE_STRIKE_S = 1.2;
  for (const slot of ['attack_1', 'attack_rp', 'attack_lk', 'attack_rk']) {
    const owner = owners.get(slot);
    if (!owner) continue;
    const dur = manifest[owner]?.dur ?? 0;
    assert.ok(dur <= LONGEST_SINGLE_STRIKE_S, `${slot} owner ${owner} is ${dur}s — that is a demonstration, not a strike`);
  }
});
