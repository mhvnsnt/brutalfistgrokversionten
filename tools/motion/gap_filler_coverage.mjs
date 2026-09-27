#!/usr/bin/env node
/**
 * HOW MUCH OF THE BODY DOES EACH SYNTHESISED CLIP ACTUALLY POSE?
 *
 * BindRelativeMotion generates a clip whenever a character's bank has no
 * capture for a semantic. A bone with NO TRACK is not "left alone" — it sits at
 * its BIND rotation. On a rig whose bind is a T-pose, every unposed bone is a
 * limb sticking straight out.
 *
 * Measured before the stance base landed, on a 19-bone Mixamo rig:
 *     idle 3/19   jump 6/19   hit_reaction 5/19   knockdown 5/19
 * so the procedural idle was a T-pose with a nodding head, and pressing jump
 * showed a T-pose with the knees tucked. The browser probe caught it in play:
 * BANNON within 0.71 degrees of bind across all 58 bones while the mixer named
 * the synthesised `jump` at full weight.
 *
 * Usage: node tools/motion/gap_filler_coverage.mjs [--gate]
 */
import * as THREE from 'three';
import { buildBindRelativeClips } from '../../src/engine/retarget/BindRelativeMotion.ts';

const BONES = [
  'mixamorigHips', 'mixamorigSpine', 'mixamorigSpine1', 'mixamorigNeck', 'mixamorigHead',
  'mixamorigLeftShoulder', 'mixamorigLeftArm', 'mixamorigLeftForeArm', 'mixamorigLeftHand',
  'mixamorigRightShoulder', 'mixamorigRightArm', 'mixamorigRightForeArm', 'mixamorigRightHand',
  'mixamorigLeftUpLeg', 'mixamorigLeftLeg', 'mixamorigLeftFoot',
  'mixamorigRightUpLeg', 'mixamorigRightLeg', 'mixamorigRightFoot',
];

const root = new THREE.Object3D();
for (const n of BONES) { const b = new THREE.Bone(); b.name = n; root.add(b); }
const clips = buildBindRelativeClips(root);

console.log('\nGAP-FILLER COVERAGE — bones posed by each synthesised clip\n');
const thin = [];
for (const c of clips) {
  const posed = new Set(c.tracks.map((t) => t.name.split('.')[0])).size;
  const ok = posed >= BONES.length;
  if (!ok) thin.push(`${c.name} ${posed}/${BONES.length}`);
  console.log(`  ${ok ? '  ' : '!!'} ${c.name.padEnd(16)} ${String(posed).padStart(3)} / ${BONES.length}`);
}
console.log(`\n  ${clips.length} generated clips, ${thin.length} leave bones at the bind pose`);
if (process.argv.includes('--gate') && thin.length) {
  console.error(`\nGATE FAILED — these would show the rest pose on the bones they skip:\n  ${thin.join('\n  ')}\n`);
  process.exit(1);
}
