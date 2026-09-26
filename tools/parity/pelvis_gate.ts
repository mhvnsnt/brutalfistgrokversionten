/**
 * THE GATE THE OWNER'S COMPLAINT DESERVES: "A punch should not cause a
 * 90-degree pelvic torsion."
 *
 * This drives the REAL AnimationController over the REAL baked
 * ALTERNATINGFOREARMS clip and measures how far the pelvis ends up from the pose
 * the fighter stands in. Nothing synthetic: the same clip JSON the game ships,
 * the same controller the game builds, the same mask.
 *
 * The control is in the same run. The identical clip is also registered as a
 * KICK, which the mask deliberately leaves alone, so one run prints both the
 * masked and unmasked pelvis figure and the difference is not taken on trust.
 *
 * No hierarchy is built and none is needed — the mixer writes LOCAL rotations
 * per bone by name, and the pelvis figure is a local rotation.
 *
 * Usage:
 *   node --experimental-strip-types --import ./scripts/register-ts-resolve.mjs \
 *     tools/parity/pelvis_gate.ts [--clip NAME]
 */
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { buildAnimationController, type FighterMotionState } from '../../src/engine/retarget/AnimationController.ts';

const PELVIS = 'mixamorigHips';
/** Gemini's number, and a good one: past this the hips are visibly not in the stance. */
export const PELVIS_TOLERANCE_DEG = 15;

interface Baked { name?: string; dur?: number; tracks: Record<string, { t: number[]; q: number[] }> }

const read = (name: string): Baked => JSON.parse(readFileSync(`public/motion/baked/${name}.json`, 'utf8'));

function toClip(data: Baked, name: string): THREE.AnimationClip {
  const tracks: THREE.KeyframeTrack[] = [];
  for (const [bone, t] of Object.entries(data.tracks ?? {})) {
    if (!t?.q || !t?.t || t.t.length < 2) continue;
    tracks.push(new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, t.t, t.q));
  }
  return new THREE.AnimationClip(name, data.dur ?? -1, tracks);
}

function rigFor(clips: THREE.AnimationClip[]) {
  const root = new THREE.Object3D();
  const seen = new Set<string>();
  for (const c of clips) {
    for (const t of c.tracks) {
      const bone = t.name.slice(0, t.name.lastIndexOf('.'));
      if (seen.has(bone)) continue;
      seen.add(bone);
      const b = new THREE.Bone();
      b.name = bone;
      root.add(b);
    }
  }
  return root;
}

const angleDeg = (a: THREE.Quaternion, b: THREE.Quaternion) =>
  THREE.MathUtils.radToDeg(2 * Math.acos(Math.min(1, Math.abs(a.dot(b)))));

/**
 * THE STANCE IS AN ENVELOPE, NOT A POSE. A first pass compared the pelvis with a
 * single frame of IDLE and reported 64.5 degrees even with the mask working. That
 * figure was the measurement's fault: IDLE's own pelvis sways 55 degrees over its
 * cycle, so any single frame of it is up to ~50 degrees from the rest of the same
 * clip. Comparing a held stance with one instant of that stance measures the
 * sway, not the defect.
 *
 * So the reference is every pose the idle pelvis passes through, and the question
 * is how far OUTSIDE that envelope the strike pushes it. Inside the envelope by
 * definition means the pelvis is somewhere the fighter stands.
 */
function idlePelvisEnvelope(idle: Baked): THREE.Quaternion[] {
  const t = idle.tracks[PELVIS];
  const out: THREE.Quaternion[] = [];
  for (let i = 0; i + 3 < t.q.length; i += 4) out.push(new THREE.Quaternion(t.q[i], t.q[i + 1], t.q[i + 2], t.q[i + 3]));
  return out;
}

/** Worst pelvis departure from the stance over the whole strike. */
export function measure(strikeName: string, state: FighterMotionState) {
  const idle = read('IDLE');
  const strike = read(strikeName);
  const idleClip = toClip(idle, 'idle');
  const strikeClip = toClip(strike, strikeName);
  const clips = new Map<FighterMotionState, THREE.AnimationClip>([
    ['idle', idleClip],
    [state, strikeClip],
  ]);
  const root = rigFor([idleClip, strikeClip]);
  const mixer = new THREE.AnimationMixer(root);
  const controller = buildAnimationController(root, mixer, { clips });
  const pelvis = root.getObjectByName(PELVIS) as THREE.Bone;
  const envelope = idlePelvisEnvelope(idle);
  const outsideStance = (q: THREE.Quaternion) => Math.min(...envelope.map((e) => angleDeg(q, e)));

  controller.update(0.3);            // settle into idle
  controller.play(state);
  let worst = 0;
  const frames = Math.ceil((strikeClip.duration + 0.2) * 60);
  for (let i = 0; i < frames; i++) {
    controller.update(1 / 60);
    worst = Math.max(worst, outsideStance(pelvis.quaternion));
  }
  return { worst, mask: controller.mask, stance: controller.stance };
}

const clipArg = process.argv.indexOf('--clip');
const CLIP = clipArg > 0 ? process.argv[clipArg + 1] : 'ALTERNATINGFOREARMS';

const masked = measure(CLIP, 'lightAttack');
const control = measure(CLIP, 'lightKick');

console.log('\nWHERE DOES A PUNCH LEAVE THE PELVIS?\n');
console.log(`  clip ${CLIP}, driven through the real controller against the real IDLE.\n  the figure is how far outside every pose the idle pelvis passes through it gets.\n`);
console.log(`  as a hand strike   ${masked.worst.toFixed(1).padStart(6)} deg outside the stance  mask ${masked.mask}, legs held at ${masked.stance}`);
console.log(`  as a kick          ${control.worst.toFixed(1).padStart(6)} deg outside the stance  mask ${control.mask} (the control — kicks keep their own legs)`);
console.log(`\n  tolerance ${PELVIS_TOLERANCE_DEG} deg`);

if (masked.worst > PELVIS_TOLERANCE_DEG) {
  console.error(`\n  GATE FAIL — a hand strike puts the pelvis ${masked.worst.toFixed(1)} deg outside the stance. That is the reported defect.`);
  process.exitCode = 1;
} else if (control.worst <= PELVIS_TOLERANCE_DEG) {
  console.error(`\n  GATE FAIL — the control passed too (${control.worst.toFixed(1)} deg), so this run measured nothing.`);
  console.error('  Pick a clip whose lower body is actually bad; lower_body_credibility.json names 190.');
  process.exitCode = 1;
} else {
  console.log(`\n  GATE OK — the mask holds the pelvis, and the unmasked control proves the clip really is that bad.`);
}
