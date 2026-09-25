// `.ts` extensions on purpose — the repo's runner resolves them literally.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, test } from 'node:test';
import * as THREE from 'three';

import { UPRIGHT_SPINE_MIN, clipFromBaked, clipIsTeamCapture, markTeamCaptures, markBackwardStrikes, markFrozen, markInverted, markSlotOwners, markStandability, type BakedClipFile, type BakedManifestEntry } from './BakedMotionBank.ts';
import { COMBAT_STATE_TO_SEMANTIC, SEMANTIC_STATE_ALIASES } from './SemanticStateAliases.ts';
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

/**
 * THE SECOND HALF OF THIS USED TO ASSERT THE BUG.
 *
 * It required a VARYING hips track to be dropped entirely — "world
 * locomotion owns dynamic root travel". That is true of X and Z and false of
 * Y: the per-frame Y is the grounding that lowers the pelvis when the knees
 * bend, and dropping it is why a crouch lifted the feet instead of lowering
 * the body. Measured on the live rig: hips travel 0.000 m through a crouch
 * whose baked file carried 0.376 m of it. The contract is now keep Y, pin X
 * and Z — the horizontal concern the original rule was written for still
 * holds, without taking the vertical fix with it.
 */
test('baked clips keep an authored pelvis offset, and keep the grounding bob', () => {
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
  const vTrack = variable.tracks.find((t) => t.name === 'mixamorigHips.position');
  assert.ok(vTrack, 'the per-frame grounding track was dropped — that is the crouch bug');
  assert.equal(
    (variable as THREE.AnimationClip & { userData: Record<string, unknown> }).userData.constantPositionTracks,
    0,
  );
  assert.equal(
    (variable as THREE.AnimationClip & { userData: Record<string, unknown> }).userData.groundedPositionTracks,
    1,
  );
  // Y varies; X and Z do not.
  const ys = [...vTrack.values].filter((_, i) => i % 3 === 1);
  assert.ok(Math.abs(ys[0] - (-0.435)) < 1e-4 && Math.abs(ys[1] - (-0.20)) < 1e-4, `Y was ${ys}`);
  assert.ok([...vTrack.values].filter((_, i) => i % 3 === 0).every((v) => v === 0));
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
 * THE FLOOR, AND THE THREE WAYS IT HAS GONE WRONG.
 *
 * First a per-frame Hips.position track planted the feet and fought the
 * authored gait. Then that track was deleted outright and NOBODY'S FEET
 * TOUCHED THE GROUND: STANCE floated 23.3 cm, GRAFQUICKJAB 31.9 cm. Then a
 * single constant key fixed the float — and pinned the pelvis.
 *
 * Owner, watching an idle: "instead of doing like an idle bob, kind of up
 * and down of the knees and the hips ... what it's actually doing is the
 * feet are going up. So instead of the pelvis doing a natural bob, it's
 * like the pelvis is locked in position and the idle motion is picking the
 * feet up off the ground."
 *
 * He read it exactly. THE BANKS ARE ROTATION-ONLY — measured, there is no
 * authored hips translation anywhere in the corpus — so in pure FK the
 * pelvis is the ROOT and bending the knees lifts the FEET rather than
 * lowering the body. A constant offset can only be right at ONE instant of
 * a clip, the deepest one, and every other frame floats by the difference.
 *
 * The shape that is none of the three: follow the floor PER FRAME, which
 * turns the leg bend back into pelvis motion, and clamp the pelvis to a
 * speed a body can move at, which is what stops a running gait's flight
 * phase hauling the hips up after the lowest foot.
 */
test('a grounded clip carries a pelvis that follows the floor', { skip: !hasBake }, () => {
  const files = readdirSync(BAKED).filter((f) => f.endsWith('.json') && f !== 'index.json');
  assert.ok(files.length > 100, 'expected a full bake');
  let animated = 0;
  let single = 0;
  const jittery: string[] = [];
  // SPEED, NOT DISTANCE BETWEEN KEYS — my first version measured the gap and
  // failed four long clips whose keys are 45-72 ms apart rather than 13. The
  // bake clamps to 2 m/s; the test allows a little over it for rounding.
  const MAX_SPEED_MPS = 2.2;
  for (const f of files) {
    const data = JSON.parse(readFileSync(join(BAKED, f), 'utf8')) as BakedClipFile;
    for (const [bone, track] of Object.entries(data.positions ?? {})) {
      if (track.t.length <= 1) { single++; continue; }
      animated++;
      for (let i = 4, k = 1; i + 2 < track.p.length; i += 3, k++) {
        const dt = Math.max(1 / 240, track.t[k] - track.t[k - 1]);
        const speed = Math.abs(track.p[i] - track.p[i - 3]) / dt;
        if (speed > MAX_SPEED_MPS) {
          jittery.push(`${data.name}:${bone} moves at ${speed.toFixed(1)} m/s`);
          break;
        }
      }
    }
  }
  assert.deepEqual(jittery.slice(0, 5), [], 'the pelvis is moving faster than a pelvis can');
  assert.ok(animated > 100, `only ${animated} clips have a pelvis that moves — is the floor follow off?`);
  assert.ok(single > 0, 'airborne clips should still carry a single constant key');
});

test('the idle bob is the pelvis, not the feet', { skip: !hasBake }, () => {
  const manifest = JSON.parse(readFileSync(join(BAKED, 'index.json'), 'utf8')) as Record<string, BakedManifestEntry>;
  // The clips a fight spends most of its time in. If these do not bob, the
  // owner is looking at a statue whose feet paddle.
  for (const name of ['STANCE', 'GUARD', 'BOX_IDLE', 'WALK']) {
    const entry = manifest[name];
    if (!entry) continue;
    const data = JSON.parse(readFileSync(join(BAKED, entry.file), 'utf8')) as BakedClipFile;
    const hips = data.positions?.mixamorigHips;
    assert.ok(hips && hips.t.length > 1, `${name} has a pinned pelvis`);
    const ys: number[] = [];
    for (let i = 1; i + 1 < hips!.p.length; i += 3) ys.push(hips!.p[i]);
    const bob = Math.max(...ys) - Math.min(...ys);
    // A real idle bob is centimetres, not millimetres and not a squat.
    assert.ok(bob > 0.005, `${name} bobs only ${(bob * 1000).toFixed(1)} mm`);
    assert.ok(bob < 0.35, `${name} bobs ${(bob * 100).toFixed(1)} cm — that is not an idle`);
  }
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

/** Clips imported from the Quaternius CC0 packs, which retarget separately. */
const isImportedPack = (name: string) => /^UAL[12]_/.test(name);

test('the frozen set stays small — a wide net here would mute real moves', { skip: !hasBake }, () => {
  const manifest = JSON.parse(readFileSync(join(BAKED, 'index.json'), 'utf8')) as Record<string, BakedManifestEntry>;
  const frozen = markFrozen(manifest);
  assert.ok(frozen.size > 0, 'nothing was measured as frozen — is movingBones being written?');

  // MEASURED OVER THE ESTABLISHED CORPUS. This guard is about the THRESHOLD
  // being too wide, and that question is only answerable against clips whose
  // retarget is known good. Importing a pack that arrives badly retargeted
  // would otherwise push the ratio up and "prove" the threshold wrong, which
  // is backwards — so a new pack cannot silently relax it.
  const own = Object.keys(manifest).filter((n) => !isImportedPack(n));
  const ownFrozen = own.filter((n) => frozen.has(n));
  assert.ok(
    ownFrozen.length < own.length * 0.1,
    `${ownFrozen.length}/${own.length} of our own clips called frozen — the threshold is too wide`,
  );
});

/**
 * HOW MUCH OF THE IMPORTED CC0 LIBRARY ACTUALLY SURVIVES THE RETARGET.
 *
 * The Quaternius Universal Animation Library reached the bake for the first
 * time once two bugs were fixed — a path filter requiring a literal backslash,
 * which silently dropped 100% of it, and a retarget target that had to carry a
 * `.skeleton`. 89 clips now bake with zero errors.
 *
 * But 57 of those 89 come out moving two bones or fewer, and `Dance_Loop`,
 * `Death01` and `Crouch_Fwd_Loop` are not static animations. The import runs;
 * its QUALITY does not yet. The engine already protects itself — a frozen clip
 * is muted rather than played — so this records the number instead of hiding
 * it, and holds the line so it can only get better.
 */
test('the imported CC0 pack does not get worse', { skip: !hasBake }, () => {
  const manifest = JSON.parse(readFileSync(join(BAKED, 'index.json'), 'utf8')) as Record<string, BakedManifestEntry>;
  const imported = Object.keys(manifest).filter(isImportedPack);
  if (!imported.length) return;
  const frozen = markFrozen(manifest);
  const dead = imported.filter((n) => frozen.has(n)).length;
  assert.ok(
    dead <= 57,
    `${dead}/${imported.length} imported clips retarget to nothing (was 57) — the import regressed`,
  );
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
test('a slot owner, where there is one, is a real forward single strike', { skip: !hasBake }, () => {
  const manifest = JSON.parse(readFileSync(join(BAKED, 'index.json'), 'utf8')) as Record<string, BakedManifestEntry>;
  const owners = markSlotOwners(manifest);
  const frozen = markFrozen(manifest);
  const backward = markBackwardStrikes(manifest);

  // NOT "every slot has an owner" — that was the earlier assertion and it is
  // wrong. SCHWARZERBLITZ_COMBAT_SLOTS names ROUNDHOUSEKICK for attack_rk and
  // ROUNDHOUSEKICK strikes at -0.96 against a body facing +0.74, so the bake
  // now REFUSES that ownership and the runtime falls through to alias order,
  // which lands on HEAVYKICK. A slot with no owner is a slot whose named
  // owner failed the measurement, and that is the system working.
  assert.ok(owners.size > 0, 'no slot has an owner at all — is `owns` being written?');
  for (const [slot, owner] of owners) {
    assert.equal(frozen.has(owner), false, `${slot} is owned by a frozen clip: ${owner}`);
    assert.equal(backward.has(owner), false, `${slot} is owned by a backward-striking clip: ${owner}`);
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

/**
 * AN ATTACK MUST TRAVEL TOWARD THE OPPONENT.
 *
 * Owner, on attack_rk: "it's going off to the side, off to the left of the
 * character ... he's not rotating his body to do it towards the character
 * he's fighting."
 *
 * MEASURED as the direction the fastest limb travels at its quickest frame,
 * expressed in the body's own frame — +1 is straight down the fighter's
 * forward axis. ROUNDHOUSEKICK struck at -0.962, BOXING at -0.999,
 * COMBO_PUNCH at -1.00: directly AWAY from the opponent, which from a
 * fighter facing right reads as a kick off to the left.
 */
test('an attack whose strike fights its own body is refused, not shipped', { skip: !hasBake }, () => {
  const manifest = JSON.parse(readFileSync(join(BAKED, 'index.json'), 'utf8')) as Record<string, BakedManifestEntry>;
  const backward = markBackwardStrikes(manifest);

  // THE CLIPS ARE STILL THERE ON PURPOSE. Generated content is never deleted,
  // and I tried the other thing first: yawing them 180 degrees made the
  // strike forward and the BODY backward, so the fighter turned his back and
  // punched over his shoulder. 50 of 94 attack clips went that way. They are
  // refused as attacks instead.
  assert.ok(backward.has('BOXING'), 'BOXING strikes at -1.00 against a body facing +0.91 and was not caught');
  assert.ok(backward.size >= 20, `only ${backward.size} caught — has the measurement stopped working?`);

  // And a known-good clip must NOT be caught, or the rule is too wide.
  for (const good of ['GRAFQUICKJAB', 'GYAKUZUKI', 'QUICKKICK']) {
    if (!manifest[good]) continue;
    assert.equal(backward.has(good), false, `${good} is a clean forward strike and was refused`);
  }
});

test('every slot owner strikes forward, moves, and is short', { skip: !hasBake }, () => {
  const manifest = JSON.parse(readFileSync(join(BAKED, 'index.json'), 'utf8')) as Record<string, BakedManifestEntry>;
  for (const [name, m] of Object.entries(manifest)) {
    if (!m.owns || !/^attack/.test(m.semantic ?? '')) continue;
    assert.ok((m.strike?.fwd ?? 0) > 0.3, `${m.semantic} owner ${name} strikes at ${m.strike?.fwd}`);
    assert.ok((m.movingBones ?? 0) >= 3, `${m.semantic} owner ${name} barely moves`);
    assert.ok((m.dur ?? 9) <= 1.2, `${m.semantic} owner ${name} is ${m.dur}s — a demonstration, not a strike`);
  }
});

/**
 * A STANDING MOVE IS THROWN BY A BODY THAT IS THE RIGHT WAY UP.
 *
 * Found looking for a finisher clip. Filtering the bake on every gate it had
 * — animates, plants, faces forward, strikes forward — put FACEGOUGE,
 * CARTWHEEL and HURRICANERANA near the top of the list. RENDERED, all three
 * are inverted; FACEGOUGE is head-down for its whole five seconds. Every
 * gate passed them because `floorGap` says the lowest point touches the mat
 * and cannot say which END is down: a cartwheel touches it with its hands.
 */
test('a clip that spends itself upside down cannot be a standing move', { skip: !hasBake }, () => {
  const manifest = JSON.parse(readFileSync(join(BAKED, 'index.json'), 'utf8')) as Record<string, BakedManifestEntry>;
  for (const [, m] of Object.entries(manifest)) {
    assert.ok(typeof m.spineUp === 'number', 'the bake stopped writing spineUp — the gate is blind without it');
    break;
  }
  const upsideDown = markInverted(manifest);

  // Caught. Each of these passed every other gate and renders inverted.
  for (const bad of ['FACEGOUGE', 'CARTWHEEL']) {
    if (!manifest[bad]) continue;
    assert.ok(upsideDown.has(bad), `${bad} measures spineUp ${manifest[bad].spineUp} and was not caught`);
  }

  // NOT caught, or the rule is too tight. These three dip hard and are the
  // move doing its job: a crouching kick leans, a dropkick goes horizontal,
  // and the capoeira AU is a cartwheel kick that comes back up.
  for (const good of ['GRAFQUICKJAB', 'GYAKUZUKI', 'QUICKKICK', 'STANCE', 'CROUCHINGKICK', 'DROP_KICK', 'AU']) {
    if (!manifest[good]) continue;
    assert.equal(upsideDown.has(good), false,
      `${good} measures spineUp ${manifest[good].spineUp} and was refused as a standing move`);
  }

  // A grapple, a knockdown or a getup is SUPPOSED to invert and is not judged.
  for (const [name, m] of Object.entries(manifest)) {
    if (!upsideDown.has(name)) continue;
    assert.ok(/^(attack|idle|block|walk|strafe|run|dash|backdash|crouch|guard|victory|taunt)/.test(m.semantic ?? ''),
      `${name} is a ${m.semantic} clip and should never have been judged for uprightness`);
  }
});

test('no slot owner is upside down', { skip: !hasBake }, () => {
  const manifest = JSON.parse(readFileSync(join(BAKED, 'index.json'), 'utf8')) as Record<string, BakedManifestEntry>;
  const upsideDown = markInverted(manifest);
  for (const [slot, owner] of markSlotOwners(manifest)) {
    assert.equal(upsideDown.has(owner), false,
      `${slot} is owned by ${owner}, which measures spineUp ${manifest[owner]?.spineUp}`);
  }
});

/**
 * THE FINISHER IS NOT A SECOND NAME FOR THE HEAVY KICK.
 *
 * Both `finisher` and `overdrive` mapped onto attack_rk, so spending a full
 * meter played the same animation as pressing heavy kick. The owner calls
 * these FINISHERS and has reported the redundant attacks repeatedly; the two
 * moves that are meant to be the payoff were the worst case of it.
 */
test('finisher, overdrive and the heavy attacks are four different moves', () => {
  const slots = ['finisher', 'overdrive', 'attack_rk', 'attack_rp'];
  const semantics = slots.map((s) => COMBAT_STATE_TO_SEMANTIC[s] ?? s);
  assert.equal(COMBAT_STATE_TO_SEMANTIC.finisher, 'finisher');
  assert.equal(COMBAT_STATE_TO_SEMANTIC.overdrive, 'overdrive');
  assert.equal(new Set(semantics).size, slots.length, `these still collapse onto each other: ${semantics.join(', ')}`);

  // Each slot must exist and must lead with its own clip, not borrow the
  // first choice of another slot.
  const firstReal = (slot: string) =>
    (SEMANTIC_STATE_ALIASES[slot] ?? []).find((a) => /^[A-Z0-9_]+$/.test(a));
  const leads = semantics.map(firstReal);
  for (let i = 0; i < slots.length; i++) {
    assert.ok(leads[i], `${semantics[i]} names no real clip at all`);
  }
  assert.equal(new Set(leads).size, leads.length, `two slots lead with the same clip: ${leads.join(', ')}`);
});

test('every clip the finisher and overdrive slots name is real, upright and animated', { skip: !hasBake }, () => {
  const manifest = JSON.parse(readFileSync(join(BAKED, 'index.json'), 'utf8')) as Record<string, BakedManifestEntry>;
  const upsideDown = markInverted(manifest);
  const frozen = markFrozen(manifest);
  const backward = markBackwardStrikes(manifest);
  let checked = 0;
  for (const slot of ['finisher', 'overdrive']) {
    for (const alias of SEMANTIC_STATE_ALIASES[slot] ?? []) {
      const m = manifest[alias];
      if (!m) continue;   // lowercase GLB-clip fallbacks are not in the bake
      checked++;
      assert.equal(frozen.has(alias), false, `${slot} names ${alias}, which does not move`);
      assert.equal(backward.has(alias), false, `${slot} names ${alias}, which strikes backwards`);
      assert.equal(upsideDown.has(alias), false, `${slot} names ${alias}, which is upside down`);
      assert.ok((m.floorGap ?? 0) <= 0.08, `${slot} names ${alias}, which floats ${m.floorGap} m off the mat`);
      assert.ok((m.spineUp ?? 0) > UPRIGHT_SPINE_MIN, `${slot} names ${alias} at spineUp ${m.spineUp}`);
    }
  }
  assert.ok(checked >= 4, `only ${checked} named clips exist in the bake — did they get renamed?`);
});

/**
 * THE PELVIS BOB SURVIVES THE LOADER.
 *
 * Owner, across several passes: "instead of the pelvis doing a natural bob,
 * it's like the pelvis is locked in position and the idle motion is picking
 * the feet up off the ground", and "at a crouch it should be moving the
 * torso and pelvis down towards the feet while the knees bend."
 *
 * The bake had been writing per-frame hips Y for a while — CROUCHING carries
 * 30 keys and 0.376 m of travel — and `clipFromBaked` DELETED every one of
 * them on the way in, because its rule was "constant translation, keep;
 * variable translation, drop". Measured on the live rig before the fix: the
 * hips travelled 0.000 m through the whole crouch while the lowest foot
 * travelled 0.392 m. After: hips 0.359 m, foot 0.081 m.
 *
 * The rule was right about X and Z — world locomotion owns those — so the
 * loader keeps Y and pins the horizontal.
 */
describe('a per-frame hips track reaches the clip', () => {
  const clipWith = (p: number[], t: number[]) => clipFromBaked({
    name: 'T', bank: 'test', dur: t[t.length - 1] ?? 1,
    tracks: { mixamorigHips: { t: [0, 1], q: [0, 0, 0, 1, 0, 0, 0, 1] } },
    positions: { mixamorigHips: { t, p } },
  });

  it('keeps a varying Y instead of dropping the whole track', () => {
    const clip = clipWith([0, 1.0, 0, 0, 0.7, 0, 0, 1.0, 0], [0, 0.5, 1]);
    const pos = clip?.tracks.find((tr) => tr.name === 'mixamorigHips.position');
    assert.ok(pos, 'the per-frame grounding track was dropped');
    assert.equal(pos.times.length, 3);
    // Float32 keyframe storage: compare with a tolerance, not deep-equal.
    const ys = [...pos.values].filter((_, i) => i % 3 === 1);
    [1.0, 0.7, 1.0].forEach((want, i) => assert.ok(Math.abs(ys[i] - want) < 1e-5, `key ${i} was ${ys[i]}`));
  });

  it('pins X and Z, because locomotion owns those', () => {
    const clip = clipWith([0.5, 1.0, 9, 3.0, 0.7, -9, -4, 1.0, 2], [0, 0.5, 1]);
    const pos = clip?.tracks.find((tr) => tr.name === 'mixamorigHips.position');
    assert.ok(pos);
    assert.ok([...pos.values].filter((_, i) => i % 3 === 0).every((v) => Math.abs(v - 0.5) < 1e-5));
    assert.ok([...pos.values].filter((_, i) => i % 3 === 2).every((v) => Math.abs(v - 9) < 1e-4));
  });

  it('still keeps a constant offset as one key', () => {
    const clip = clipWith([0, 0.93, 0, 0, 0.93, 0], [0, 1]);
    const pos = clip?.tracks.find((tr) => tr.name === 'mixamorigHips.position');
    assert.ok(pos);
    assert.equal(pos.times.length, 1);
  });
});

/**
 * A TEAM MOVE IS NOT A SOLO MOVE.
 *
 * Owner: "most of the moves, some of them will say like double superkick or
 * assisted cutter or assisted diving senton — those are tag team moves."
 *
 * He was right about every clip he named. MEASURED by tools/anim/inspect.mjs
 * on the 871-bone source captures, which carry one `J_Hips` root per body:
 * 68 have three or more PERFORMING bodies, and twelve of those are baked
 * into the game — EIGHT of them into the `idle` slot. The bake squashes
 * every capture onto one skeleton, so a fighter playing one performs his
 * partner's and his victim's motion simultaneously.
 */
describe('a three-body capture cannot fill a solo slot', () => {
  const manifest: Record<string, BakedManifestEntry> = {
    DOUBLESUPLEX: { file: 'a', bank: 'b', dur: 1, bones: 22, bodies: 3 },
    SUPLEX: { file: 'b', bank: 'b', dur: 1, bones: 22, bodies: 2 },
    STANCE: { file: 'c', bank: 'b', dur: 1, bones: 22, bodies: 1 },
    LEGACY: { file: 'd', bank: 'b', dur: 1, bones: 22 },
  };

  it('marks only the captures with three or more bodies', () => {
    const team = markTeamCaptures(manifest);
    assert.deepEqual([...team], ['DOUBLESUPLEX']);
    assert.equal(clipIsTeamCapture('DOUBLESUPLEX'), true);
    // Attacker-and-victim is a normal move: one man performs it.
    assert.equal(clipIsTeamCapture('SUPLEX'), false);
    assert.equal(clipIsTeamCapture('STANCE'), false);
  });

  it('treats a clip with no count as one body, so an old bake is unchanged', () => {
    markTeamCaptures(manifest);
    assert.equal(clipIsTeamCapture('LEGACY'), false);
  });

  if (hasBake) {
    it('the shipped bake still carries them, and they are all refused', () => {
      const idx = JSON.parse(readFileSync(join(BAKED, 'index.json'), 'utf8')) as Record<string, BakedManifestEntry>;
      const team = markTeamCaptures(idx);
      // Nothing is deleted — the captures stay banked for a real tag system.
      assert.ok(team.size >= 10, `expected the team captures to still be baked, saw ${team.size}`);
      assert.ok(team.has('DOUBLESUPLEX') && team.has('STEREOSUPERKICK') && team.has('ASSISTEDDIVSENTON'),
        'the clips the owner named must be among them');
      // And none of them may own a combat slot.
      for (const n of team) {
        assert.equal(idx[n].owns ?? false, false, `${n} owns a slot and is a three-body capture`);
      }
    });
  }
});
