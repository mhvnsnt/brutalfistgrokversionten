import test from 'node:test';
import assert from 'node:assert/strict';
import { classify, signatureOf } from './classify-clip-motion.mjs';

test('motion classifier recognizes measured leg-led and arm-led clips', () => {
  const kick = classify({ dur: 0.8, totalDeg: 2400, armShare: 0.18, legShare: 0.62, hipYaw: 2 }, 'SYNTH_KICK');
  assert.equal(kick?.state, 'lightKick');

  const punch = classify({ dur: 0.8, totalDeg: 2400, armShare: 0.70, legShare: 0.15, hipYaw: 2 }, 'SYNTH_PUNCH');
  assert.equal(punch?.state, 'lightAttack');
});

test('reaction naming remains receiver-safe', () => {
  const reaction = classify({ dur: 0.9, totalDeg: 2600, armShare: 0.2, legShare: 0.5, hipYaw: 1 }, 'SYNTH_REACT_RECV');
  assert.equal(reaction?.state, 'hit');
});

test('signature measures actual quaternion travel instead of trusting clip names', () => {
  const sig = signatureOf({
    dur: 1,
    keys: [
      { t: 0, bones: { mixamorigRightArm: { rx: 0, ry: 0, rz: 0 } } },
      { t: 1, bones: { mixamorigRightArm: { rx: Math.PI / 2, ry: 0, rz: 0 } } },
    ],
  });
  assert.ok(sig);
  assert.ok(sig.totalDeg > 80 && sig.totalDeg < 100);
  assert.equal(sig.armShare, 1);
});
