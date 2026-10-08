// `.ts` extensions on purpose — the repo's runner resolves them literally.
//
// Synthetic rigs and synthetic motion in this file are TEST_ONLY fixtures:
// they exist to pin the math, they are never a game clip, and every clip made
// here carries userData.clipSourceType = 'TEST_ONLY'.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import * as THREE from 'three';

import { classifyBoneName, detectHumanoidBoneMap, parseBoneName } from './HumanoidBoneMap.ts';
import { buildRetargetRig, eulerKeyFileToClip, eulerTracksToQuaternion, retargetClip, bindClipToRig, poseRig } from './UniversalRetarget.ts';
import { retargetAndValidate, cacheRestSkin } from './RetargetValidation.ts';
import { normalizeUniversalAnimation } from './UniversalAnimationPipeline.ts';
import { retargetClipsForTarget, targetUsesCanonicalSkeleton } from './RuntimeUniversalRetarget.ts';
import { clipFromBaked } from './BakedMotionBank.ts';

// ─── TEST_ONLY fixtures ─────────────────────────────────────────────────────
interface Spec { spine: number; neck?: number; pose?: 'T' | 'A'; mirrored?: boolean; scale?: number; names?: (k: string) => string; clavicles?: boolean; toes?: boolean }
/** A humanoid bone tree facing +Z (or mirrored: facing +X with LEFT at +Z, like the Bannon bind). */
function rig(spec: Spec): THREE.Object3D {
  const s = spec.scale ?? 1;
  // A mirror-handed rig like the Bannon bind: a proper skeleton whose Left/Right
  // LABELS are swapped (bone scales stay +1), turned to face +X.
  const swap = (k: string) => (k.startsWith('Left') ? `Right${k.slice(4)}` : k.startsWith('Right') ? `Left${k.slice(5)}` : k);
  const n = spec.names ?? (spec.mirrored ? swap : (k: string) => k);
  const root = new THREE.Object3D(); root.name = 'Armature';
  const bone = (name: string, parent: THREE.Object3D, p: [number, number, number]) => { const b = new THREE.Bone(); b.name = n(name); b.position.set(p[0] * s, p[1] * s, p[2] * s); parent.add(b); return b; };
  const hips = bone('Hips', root, [0, 1, 0]);
  let top: THREE.Object3D = hips;
  for (let i = 0; i < spec.spine; i++) top = bone(i === 0 ? 'Spine' : `Spine${i}`, top, [0, 0.45 / spec.spine, 0]);
  let neckTop = top;
  for (let i = 0; i < (spec.neck ?? 1); i++) neckTop = bone(i === 0 ? 'Neck' : `Neck${i}`, neckTop, [0, 0.1 / (spec.neck ?? 1), 0]);
  bone('Head', neckTop, [0, 0.1, 0]);
  const armDrop = spec.pose === 'A' ? -0.7071 : 0; const armOut = spec.pose === 'A' ? 0.7071 : 1;
  for (const [side, sx] of [['Left', 1], ['Right', -1]] as const) {
    let base: THREE.Object3D = top;
    if (spec.clavicles !== false) base = bone(`${side}Shoulder`, top, [sx * 0.08, 0.05, 0]);
    const upper = bone(`${side}Arm`, base, [sx * 0.08, 0, 0]);
    const lower = bone(`${side}ForeArm`, upper, [sx * 0.28 * armOut, 0.28 * armDrop, 0]);
    bone(`${side}Hand`, lower, [sx * 0.25 * armOut, 0.25 * armDrop, 0]);
    const thigh = bone(`${side}UpLeg`, hips, [sx * 0.1, -0.05, 0]);
    const shin = bone(`${side}Leg`, thigh, [0, -0.45, 0]);
    const foot = bone(`${side}Foot`, shin, [0, -0.42, 0]);
    if (spec.toes !== false) bone(`${side}ToeBase`, foot, [0, -0.06, 0.12]);
  }
  if (spec.mirrored) root.rotation.y = Math.PI / 2;
  root.updateMatrixWorld(true);
  return root;
}
function testOnly(clip: THREE.AnimationClip): THREE.AnimationClip {
  (clip as THREE.AnimationClip & { userData: Record<string, unknown> }).userData = { clipSourceType: 'TEST_ONLY' };
  return clip;
}
const axis = (x: number, y: number, z: number, deg: number) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(x, y, z).normalize(), THREE.MathUtils.degToRad(deg));
function rotTrack(root: THREE.Object3D, bone: string, delta: THREE.Quaternion, world = false): THREE.QuaternionKeyframeTrack {
  const b = root.getObjectByName(bone)!;
  let local = delta;
  if (world) {
    // Express a world-space delta as a local rotation at the end key.
    const pw = new THREE.Quaternion(); b.parent!.getWorldQuaternion(pw);
    const w = new THREE.Quaternion(); b.getWorldQuaternion(w);
    local = pw.clone().invert().multiply(delta).multiply(w);
  }
  const q = b.quaternion.clone().premultiply(new THREE.Quaternion()).multiply(new THREE.Quaternion());
  const end = world ? local : q.clone().multiply(local);
  return new THREE.QuaternionKeyframeTrack(`${b.name}.quaternion`, [0, 1], [...q.toArray(), ...end.toArray()]);
}
function worldDir(root: THREE.Object3D, from: string, to: string): THREE.Vector3 {
  root.updateMatrixWorld(true);
  const a = new THREE.Vector3(); root.getObjectByName(from)!.getWorldPosition(a);
  const b = new THREE.Vector3(); root.getObjectByName(to)!.getWorldPosition(b);
  return b.sub(a).normalize();
}
function playEnd(root: THREE.Object3D, clip: THREE.AnimationClip) {
  const r = buildRetargetRig(root); poseRig(r, bindClipToRig(clip, r).bound, clip.duration);
}

// ─── Bone map ───────────────────────────────────────────────────────────────
describe('canonical humanoid bone map', () => {
  it('reads sides and roles across Mixamo, CMU, UAL/Unreal, KayKit/Blender, J_ and Bip conventions', () => {
    const cases: Array<[string, string | null, string | null]> = [
      ['mixamorig:LeftUpLeg', 'upperLeg', 'left'], ['mixamorigRightForeArm', 'lowerArm', 'right'],
      ['LHipJoint', 'hipJoint', 'left'], ['LowerBack', 'spine', null], ['LThumb', 'finger', 'left'],
      ['upperarm_l', 'upperArm', 'left'], ['calf_r', 'lowerLeg', 'right'], ['ball_l', 'toes', 'left'],
      ['upperarm.l', 'upperArm', 'left'], ['handl', 'hand', 'left'], ['wristr', 'wrist', 'right'],
      ['J_Shoulder_L', 'shoulderAmbiguous', 'left'], ['Bip01 R Thigh', 'upperLeg', 'right'],
      ['DEF-forearm.R', 'lowerArm', 'right'], ['ball_leaf_l', null, 'left'], ['handslot.r', null, 'right'],
    ];
    for (const [name, kind, side] of cases) {
      assert.equal(classifyBoneName(name)?.kind ?? null, kind, name);
      assert.equal(parseBoneName(name).side, side, name);
    }
  });

  it('resolves variable spine and neck chains from the hierarchy, not names', () => {
    for (const spine of [1, 2, 3, 4, 5]) {
      const m = detectHumanoidBoneMap(rig({ spine, neck: 2 }));
      assert.deepEqual(m.missingRequired, [], `spine ${spine}`);
      assert.equal(m.spine.length, spine);
      assert.equal(m.neck.length, 2);
    }
  });

  it('skips optional clavicles and toes without failing required slots', () => {
    const m = detectHumanoidBoneMap(rig({ spine: 1, clavicles: false, toes: false }));
    assert.deepEqual(m.missingRequired, []);
    assert.equal(m.slots.leftClavicle, undefined);
    assert.equal(m.slots.leftToes, undefined);
  });

  it('falls back to topology when names carry nothing', () => {
    let i = 0;
    const anon = rig({ spine: 3, names: () => `bone_${i++}` });
    const m = detectHumanoidBoneMap(anon);
    assert.deepEqual(m.missingRequired, []);
    assert.equal(m.method.hips, 'topology');
    assert.equal(m.spine.length, 3);
    // Side from facing (ankle -> toe), not from a world-axis guess.
    const lh = anon.getObjectByName(m.slots.leftHand!)!; const p = new THREE.Vector3(); lh.getWorldPosition(p);
    assert.ok(p.x > 0, 'left hand is on the character\'s left (+X for a +Z-facing rig)');
  });

  it('per-rig overrides win over detection', () => {
    const r = rig({ spine: 2 });
    const m = detectHumanoidBoneMap(r, { overrides: [{ match: { anyJoint: ['Spine1'] }, slots: { head: 'Neck' } }] });
    assert.equal(m.slots.head, 'Neck');
    assert.equal(m.method.head, 'override');
  });
});

// ─── Retarget math ──────────────────────────────────────────────────────────
describe('universal retarget', () => {
  it('redistributes a spine bend across 1..5 target bones and keeps the chest direction', () => {
    const src = rig({ spine: 3 });
    const clip = testOnly(new THREE.AnimationClip('bend', 1, ['Spine', 'Spine1', 'Spine2'].map((b) => rotTrack(src, b, axis(1, 0, 0, 20)))));
    playEnd(src, clip);
    const want = worldDir(src, 'Neck', 'Head');
    const srcRig = buildRetargetRig(rig({ spine: 3 }));
    for (const spine of [1, 2, 4, 5]) {
      const tgt = rig({ spine });
      const r = retargetClip(clip, srcRig, buildRetargetRig(tgt));
      assert.equal(r.status, 'RETARGETED');
      playEnd(tgt, r.clip!);
      const got = worldDir(tgt, 'Neck', 'Head');
      assert.ok(THREE.MathUtils.radToDeg(got.angleTo(want)) < 6, `spine ${spine}: ${THREE.MathUtils.radToDeg(got.angleTo(want)).toFixed(1)} deg`);
    }
  });

  it('transfers rest-relative motion from a T-pose source to an A-pose target (and back)', () => {
    for (const [sp, tp] of [['T', 'A'], ['A', 'T']] as const) {
      const src = rig({ spine: 2, pose: sp });
      // Punch: the right arm swings forward (+Z) in world space.
      const clip = testOnly(new THREE.AnimationClip('punch', 1, [rotTrack(src, 'RightArm', axis(0, 1, 0, sp === 'T' ? 90 : 0).multiply(axis(0, 0, 1, 0)), true)]));
      const srcRig = buildRetargetRig(rig({ spine: 2, pose: sp }));
      playEnd(src, clip);
      const want = worldDir(src, 'RightArm', 'RightForeArm');
      const tgt = rig({ spine: 2, pose: tp });
      const r = retargetClip(clip, srcRig, buildRetargetRig(tgt));
      playEnd(tgt, r.clip!);
      const got = worldDir(tgt, 'RightArm', 'RightForeArm');
      assert.ok(THREE.MathUtils.radToDeg(got.angleTo(want)) < 1, `${sp}->${tp}`);
    }
  });

  it('keeps a forward strike forward on a mirror-handed target (the Bannon bind)', () => {
    const src = rig({ spine: 3, pose: 'T' });
    const clip = testOnly(new THREE.AnimationClip('jab', 1, [rotTrack(src, 'RightArm', axis(0, 1, 0, 90), true)]));
    const srcRig = buildRetargetRig(rig({ spine: 3, pose: 'T' }));
    const tgt = rig({ spine: 3, pose: 'T', mirrored: true });
    const tr = buildRetargetRig(tgt);
    assert.equal(tr.handedness, -1);
    const r = retargetClip(clip, srcRig, tr);
    playEnd(tgt, r.clip!);
    // Target forward = ankle -> toe.
    const fwd = worldDir(tgt, 'LeftFoot', 'LeftToeBase').setY(0).normalize();
    const hand = worldDir(tgt, 'RightArm', 'RightHand');
    assert.ok(hand.dot(fwd) > 0.95, `strike points forward: ${hand.dot(fwd).toFixed(2)}`);
  });

  it('scales hips translation by the leg-length ratio', () => {
    const src = rig({ spine: 2 });
    const hips = src.getObjectByName('Hips')!;
    const clip = testOnly(new THREE.AnimationClip('step', 1, [
      new THREE.VectorKeyframeTrack('Hips.position', [0, 1], [0, 1, 0, 0, 1, 0.5]),
      rotTrack(src, 'Spine', axis(1, 0, 0, 10)),
    ]));
    void hips;
    const tgt = rig({ spine: 2, scale: 0.01 });
    const r = retargetClip(clip, buildRetargetRig(rig({ spine: 2 })), buildRetargetRig(tgt), { groundLock: false });
    const pos = r.clip!.tracks.find((t) => t.name === 'Hips.position')!;
    const dz = pos.values[pos.values.length - 1] - pos.values[2];
    assert.ok(Math.abs(dz - 0.005) < 1e-4, `0.5 m at scale 0.01 -> ${dz}`);
  });

  it('accepts Euler rx/ry/rz keys and .rotation tracks as quaternions', () => {
    const clip = eulerKeyFileToClip('e', { dur: 1, keys: [{ t: 0, bones: { Hips: { rx: 0, ry: 0, rz: 0 } } }, { t: 1, bones: { Hips: { rx: 0, ry: 1, rz: 0 }, Spine: { rx: 0, ry: 0, rz: Number.NaN } } }] });
    assert.ok(clip.tracks.every((t) => t.name.endsWith('.quaternion')));
    assert.equal((clip as THREE.AnimationClip & { userData: { droppedNonFiniteKeys: number } }).userData.droppedNonFiniteKeys, 1);
    const rot = new THREE.AnimationClip('r', 1, [new THREE.VectorKeyframeTrack('Hips.rotation', [0, 1], [0, 0, 0, 0, Math.PI / 2, 0])]);
    const q = eulerTracksToQuaternion(rot);
    assert.equal(q.tracks[0].name, 'Hips.quaternion');
    assert.ok(Math.abs(q.tracks[0].values[5] - Math.SQRT1_2) < 1e-6);
  });

  it('reports UNMAPPABLE and MISSING_CLIP instead of faking a clip', () => {
    const noArms = new THREE.Object3D(); const h = new THREE.Bone(); h.name = 'Hips'; noArms.add(h);
    const good = buildRetargetRig(rig({ spine: 2 }));
    const clip = testOnly(new THREE.AnimationClip('x', 1, [new THREE.QuaternionKeyframeTrack('Hips.quaternion', [0, 1], [0, 0, 0, 1, 0, 0, 0, 1])]));
    const r = retargetClip(clip, good, buildRetargetRig(noArms));
    assert.equal(r.status, 'UNMAPPABLE');
    assert.equal(r.clip, null);
    assert.ok(r.reasons.some((x) => x.includes('target rig lacks')));
    assert.equal(retargetClip(new THREE.AnimationClip('empty', 1, []), good, good).status, 'MISSING_CLIP');
  });

  it('keeps TEST_ONLY provenance through the retarget', () => {
    const src = rig({ spine: 2 });
    const r = retargetClip(testOnly(new THREE.AnimationClip('t', 1, [rotTrack(src, 'Spine', axis(1, 0, 0, 30))])), buildRetargetRig(src), buildRetargetRig(rig({ spine: 1 })));
    assert.equal((r.clip as THREE.AnimationClip & { userData: { clipSourceType: string } }).userData.clipSourceType, 'TEST_ONLY');
  });
});

// ─── Real assets ────────────────────────────────────────────────────────────
const HAS_MODELS = existsSync('public/models/BANNON_rigged.glb') && existsSync('public/motion/baked/index.json');
async function load(file: string) {
  const { loadGlbNode } = await import('../../../scripts/retarget/load-glb-node.mjs');
  return loadGlbNode(file) as Promise<{ scene: THREE.Object3D; animations: THREE.AnimationClip[] }>;
}
function baked(name: string): THREE.AnimationClip {
  const index = JSON.parse(readFileSync('public/motion/baked/index.json', 'utf8'));
  return clipFromBaked(JSON.parse(readFileSync(`public/motion/baked/${index[name].file}`, 'utf8')))!;
}

describe('universal retarget on shipped rigs', { skip: !HAS_MODELS && 'models not present' }, () => {
  it('detects the canonical bind on every roster fighter, so their clips stay untouched', async () => {
    const roster = ['BANNON_rigged', 'MAIME_skinned', 'CIPHER_feral', 'TARZANIAN_DEVIL_skinned', 'EDWIN_KENNEDY', 'TYNESHIA'];
    for (const m of roster) assert.ok(targetUsesCanonicalSkeleton((await load(`public/models/${m}.glb`)).scene), m);
    for (const m of ['EDWIN_KENNEDY_unchained', 'wrestler_base', 'xbot']) assert.equal(targetUsesCanonicalSkeleton((await load(`public/models/${m}.glb`)).scene), false, m);
  });

  it('retargets baked clips onto a 1-bone-spine rig with every check passing', async () => {
    const canonical = buildRetargetRig((await load('public/models/BANNON_rigged.glb')).scene, { label: 'canonical' });
    const edwin = buildRetargetRig((await load('public/models/EDWIN_KENNEDY_unchained.glb')).scene, { label: 'edwin' });
    cacheRestSkin(edwin);
    assert.equal(edwin.map.spine.length, 1);
    for (const name of ['JAB', 'ROUNDHOUSEKICK', 'GUARD']) {
      const index = JSON.parse(readFileSync('public/motion/baked/index.json', 'utf8'));
      if (!index[name]) continue;
      const cell = retargetAndValidate(baked(name), canonical, edwin);
      assert.equal(cell.verdict, 'PASS', `${name}: ${cell.reasons.join('; ')}`);
    }
  });

  it('runtime path: off switch and same-skeleton targets leave clips byte-identical', async () => {
    const canonical = buildRetargetRig((await load('public/models/BANNON_rigged.glb')).scene, { label: 'canonical' });
    const clip = baked(Object.keys(JSON.parse(readFileSync('public/motion/baked/index.json', 'utf8')))[0]);
    const same = [clip];
    const s = await retargetClipsForTarget(same, canonical, (await load('public/models/TYNESHIA.glb')).scene);
    assert.equal(s.sameSkeleton, true);
    assert.equal(same[0], clip);
    const store = new Map<string, string>([['bf.universalRetarget', 'off']]);
    (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => store.get(k) ?? null };
    const off = [clip];
    const s2 = await retargetClipsForTarget(off, canonical, (await load('public/models/EDWIN_KENNEDY_unchained.glb')).scene);
    delete (globalThis as { localStorage?: unknown }).localStorage;
    assert.equal(s2.mode, 'off');
    assert.equal(off[0], clip);
    const on = [clip];
    const s3 = await retargetClipsForTarget(on, canonical, (await load('public/models/EDWIN_KENNEDY_unchained.glb')).scene);
    assert.equal(s3.retargeted, 1);
    assert.notEqual(on[0], clip);
  });

  it('#17 intake gate: a source skeleton routes through retarget + validation', async () => {
    const src = await load('public/models/BANNON_rigged.glb');
    const target = (await load('public/models/wrestler_base.glb')).scene;
    const index = JSON.parse(readFileSync('public/motion/baked/index.json', 'utf8'));
    const name = index.JAB ? 'JAB' : Object.keys(index).find((k) => index[k].semantic === 'attack_1')!;
    const ok = normalizeUniversalAnimation({ clip: baked(name), sourceSkeleton: src.scene }, target);
    assert.equal(ok.verdict, 'PASS');
    assert.ok(ok.clip);
    const headless = new THREE.Object3D(); const hb = new THREE.Bone(); hb.name = 'Hips'; headless.add(hb);
    const bad = normalizeUniversalAnimation({ clip: baked(name), sourceSkeleton: headless }, target);
    assert.equal(bad.verdict, 'REJECTED_UNMAPPABLE');
    assert.equal(bad.clip, null);
  });

  it('validation harness: every baked clip onto contrasting rigs — no NaN, nothing unmappable', async () => {
    const canonical = buildRetargetRig((await load('public/models/BANNON_rigged.glb')).scene, { label: 'canonical' });
    const targets = await Promise.all(['EDWIN_KENNEDY_unchained', 'wrestler_base', 'xbot'].map(async (m) => { const r = buildRetargetRig((await load(`public/models/${m}.glb`)).scene, { label: m }); return r; }));
    const index = JSON.parse(readFileSync('public/motion/baked/index.json', 'utf8'));
    let pass = 0; let total = 0;
    for (const name of Object.keys(index)) {
      const clip = baked(name);
      for (const t of targets) {
        const cell = retargetAndValidate(clip, canonical, t, { skipDeform: true, maxSamples: 20 });
        total++;
        assert.notEqual(cell.verdict, 'UNMAPPABLE', `${name} -> ${t.label}`);
        assert.ok(cell.checks.noNaN?.ok, `${name} -> ${t.label} NaN`);
        if (cell.verdict === 'PASS') pass++;
      }
    }
    assert.ok(pass / total > 0.9, `pass rate ${(pass / total).toFixed(3)}`);
  });
});

// ─── Parity with PR #20's explicit per-rig profiles ─────────────────────────
// tools/anim-intake/cc0_unarmed_intake.ts (branch grok/per-fighter-movesets)
// hand-writes bone maps for UAL, Mesh2Motion, KayKit and CMU. Auto-detection
// must land on the same joints (sanitized names, as GLTFLoader delivers them),
// so that table can become an override-free special case of this one.
const STAGING = '/workspace/oss-anim-staging';
describe('auto-detected maps match the explicit #20 rig profiles', { skip: !existsSync(`${STAGING}/MANIFEST.json`) && 'staging absent' }, () => {
  const cases: Array<[string, Record<string, string>]> = [
    ['quaternius-ual-1/extracted/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb', { hips: 'pelvis', head: 'Head', leftClavicle: 'clavicle_l', leftUpperArm: 'upperarm_l', leftLowerArm: 'lowerarm_l', leftHand: 'hand_l', rightUpperLeg: 'thigh_r', rightLowerLeg: 'calf_r', rightFoot: 'foot_r', rightToes: 'ball_r' }],
    ['mesh2motion/files/human-base-animations.glb', { hips: 'pelvis', head: 'head', rightHand: 'hand_r', leftToes: 'ball_l' }],
    ['kaykit-character-animations/extracted/KayKit_Character_Animations_1.1/Animations/gltf/Rig_Medium/Rig_Medium_CombatMelee.glb', { hips: 'hips', head: 'head', leftUpperArm: 'upperarml', leftLowerArm: 'lowerarml', leftHand: 'wristl', rightUpperLeg: 'upperlegr', rightLowerLeg: 'lowerlegr', rightFoot: 'footr', rightToes: 'toesr' }],
    ['cmu-segments/glb/cmu_02_05_seg01_righthand_high_front.glb', { hips: 'Hips', head: 'Head', leftClavicle: 'LeftShoulder', leftUpperArm: 'LeftArm', leftLowerArm: 'LeftForeArm', leftHand: 'LeftHand', rightUpperLeg: 'RightUpLeg', rightLowerLeg: 'RightLeg', rightFoot: 'RightFoot', rightToes: 'RightToeBase' }],
  ];
  for (const [file, want] of cases) {
    it(file.split('/').pop()!, async () => {
      const m = detectHumanoidBoneMap((await load(`${STAGING}/${file}`)).scene);
      assert.deepEqual(m.missingRequired, []);
      for (const [slot, joint] of Object.entries(want)) assert.equal(m.slots[slot as keyof typeof m.slots], joint, `${slot}`);
    });
  }
  it('spine chains: UAL 3, KayKit 2 (spine, chest), CMU 3 (LowerBack, Spine, Spine1)', async () => {
    assert.deepEqual(detectHumanoidBoneMap((await load(`${STAGING}/${cases[2][0]}`)).scene).spine, ['spine', 'chest']);
    assert.deepEqual(detectHumanoidBoneMap((await load(`${STAGING}/${cases[3][0]}`)).scene).spine, ['LowerBack', 'Spine', 'Spine1']);
  });
});
