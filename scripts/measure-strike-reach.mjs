// Compare candidate "does this clip contain a strike" measures side by side
// before wiring one into the gate. Every earlier attempt was wired first and
// found wrong afterwards.
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { loadCanonicalSkeleton } from '../src/engine/retarget/CanonicalSkeleton.ts';
import { clipFromBaked } from '../src/engine/retarget/BakedMotionBank.ts';

const sk = loadCanonicalSkeleton(readFileSync('public/models/BANNON_rigged.glb'));
const bones = new Map();
sk.root.traverse((o) => { if (o.name) bones.set(o.name, o); });
const PAIRS = [
  ['mixamorigLeftHand', 'mixamorigLeftArm'],
  ['mixamorigRightHand', 'mixamorigRightArm'],
  ['mixamorigLeftFoot', 'mixamorigLeftUpLeg'],
  ['mixamorigRightFoot', 'mixamorigRightUpLeg'],
];

export function measure(name) {
  const data = JSON.parse(readFileSync(`public/motion/baked/${name}.json`, 'utf8'));
  const clip = clipFromBaked(data);
  if (!clip) return null;
  const mixer = new THREE.AnimationMixer(sk.root);
  mixer.clipAction(clip).play();
  const dur = clip.duration;
  const steps = Math.min(72, Math.max(16, Math.round(dur * 40)));
  const hp = new THREE.Vector3(), lp = new THREE.Vector3(), rp = new THREE.Vector3();
  const ls = new THREE.Vector3(), rs = new THREE.Vector3();
  let handRoot = -Infinity, footRoot = -Infinity;
  const lo = new Map(), hi = new Map();
  for (let i = 0; i <= steps; i++) {
    mixer.setTime((dur * i) / steps);
    sk.root.updateMatrixWorld(true);
    bones.get('mixamorigHips').getWorldPosition(hp);
    bones.get('mixamorigLeftShoulder').getWorldPosition(ls);
    bones.get('mixamorigRightShoulder').getWorldPosition(rs);
    const across = rs.clone().sub(ls);
    const f = new THREE.Vector3(-across.z, 0, across.x);
    if (f.lengthSq() < 1e-9) continue;
    f.normalize();
    for (const [limb, root] of PAIRS) {
      bones.get(limb).getWorldPosition(lp);
      bones.get(root).getWorldPosition(rp);
      const fromRoot = (lp.x - rp.x) * f.x + (lp.z - rp.z) * f.z;
      const fromHip = (lp.x - hp.x) * f.x + (lp.z - hp.z) * f.z;
      void fromHip;
      lo.set(limb, Math.min(lo.get(limb) ?? Infinity, fromRoot));
      hi.set(limb, Math.max(hi.get(limb) ?? -Infinity, fromRoot));
      if (/Hand$/.test(limb)) handRoot = Math.max(handRoot, fromRoot);
      else footRoot = Math.max(footRoot, fromRoot);
    }
  }
  mixer.stopAllAction();
  let handTravel = 0, footTravel = 0;
  for (const [limb, h] of hi) {
    const t = h - (lo.get(limb) ?? 0);
    if (/Hand$/.test(limb)) handTravel = Math.max(handTravel, t);
    else footTravel = Math.max(footTravel, t);
  }
  return { handRoot, footRoot, handTravel, footTravel };
}

if (process.argv[2]) {
  console.log('clip                    handOut  footOut  handTrv  footTrv');
  for (const n of process.argv[2].split(',')) {
    const m = measure(n);
    if (!m) { console.log(n, 'no clip'); continue; }
    console.log(n.padEnd(24) + Object.values(m).map((v) => v.toFixed(2).padStart(8)).join(' '));
  }
}
