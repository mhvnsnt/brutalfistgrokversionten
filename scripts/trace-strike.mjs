// Per-frame trace of one baked clip: where the body faces and where each limb
// is, in the body's own frame. Written because reading a contact sheet could
// not settle whether ROUNDHOUSEKICK turns its back to kick.
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { loadCanonicalSkeleton } from '../src/engine/retarget/CanonicalSkeleton.ts';
import { clipFromBaked } from '../src/engine/retarget/BakedMotionBank.ts';

const NAMES = (process.argv[2] ?? 'ROUNDHOUSEKICK').split(',');
const sk = loadCanonicalSkeleton(readFileSync('public/models/BANNON_rigged.glb'));
const bones = new Map();
sk.root.traverse((o) => { if (o.name) bones.set(o.name, o); });

for (const name of NAMES) {
  const data = JSON.parse(readFileSync(`public/motion/baked/${name}.json`, 'utf8'));
  const clip = clipFromBaked(data);
  if (!clip) { console.log(name, 'no clip'); continue; }
  const mixer = new THREE.AnimationMixer(sk.root);
  mixer.clipAction(clip).play();
  const dur = clip.duration;
  console.log(`\n${name}  dur ${dur.toFixed(2)}`);
  console.log('   t     face   LHand   RHand   LFoot   RFoot      (forward offset from hips, metres)');
  const hp = new THREE.Vector3(), lp = new THREE.Vector3(), ls = new THREE.Vector3(), rs = new THREE.Vector3();
  for (let i = 0; i <= 16; i++) {
    mixer.setTime((dur * i) / 16);
    sk.root.updateMatrixWorld(true);
    bones.get('mixamorigHips').getWorldPosition(hp);
    bones.get('mixamorigLeftShoulder').getWorldPosition(ls);
    bones.get('mixamorigRightShoulder').getWorldPosition(rs);
    const across = rs.clone().sub(ls);
    const face = new THREE.Vector3(-across.z, 0, across.x).normalize();
    const cols = ['mixamorigLeftHand', 'mixamorigRightHand', 'mixamorigLeftFoot', 'mixamorigRightFoot']
      .map((b) => { bones.get(b).getWorldPosition(lp); return (lp.x - hp.x).toFixed(2).padStart(7); });
    console.log(`${((dur * i) / 16).toFixed(2).padStart(5)}  ${face.x.toFixed(2).padStart(6)} ${cols.join(' ')}`);
  }
  mixer.stopAllAction();
}
