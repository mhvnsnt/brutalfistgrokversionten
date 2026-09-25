// `.ts` extensions on purpose — the repo's runner resolves them literally.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

import {
  MIN_MEANINGFUL_TRAVEL_M, isMeaningfulTravel, peakTravel, totalTravel,
  travelBetween, travelFromPerFrame, travelFromPoseKeys,
} from './RootTravel.ts';

/** A clip that walks straight forward one metre over one second. */
const walkForward = (steps = 10, distance = 1) => {
  const keys = [];
  for (let i = 0; i <= steps; i++) {
    const d = (distance * i) / steps;
    keys.push({
      t: i / steps,
      // Facing +X: shoulders lie along Z, so the perpendicular is X.
      pose: { pelvis: [d, 0.9, 0], shL: [d, 1.4, 0.2], shR: [d, 1.4, -0.2] },
    });
  }
  return keys;
};

describe('travel read from a capture is in the fighter\'s own frame', () => {
  it('reads a straight walk as forward travel, not lateral', () => {
    const curve = travelFromPoseKeys(walkForward());
    const total = totalTravel(curve);
    assert.ok(Math.abs(total.forward - 1) < 1e-6, `forward ${total.forward}`);
    assert.ok(Math.abs(total.lateral) < 1e-6, `lateral ${total.lateral}`);
  });

  /**
   * THE SIGN IS THE WHOLE THING. Facing comes from the shoulder axis, and
   * getting its perpendicular backwards would read every advancing move as a
   * retreat — a mistake that looks completely plausible in a table of numbers
   * and is obvious the moment a fighter walks away from his opponent.
   */
  it('reads a body that moves the other way as travelling backwards', () => {
    const keys = walkForward().map((k) => ({
      ...k,
      pose: { ...k.pose, pelvis: [-(k.pose.pelvis[0]), 0.9, 0] },
    }));
    assert.ok(totalTravel(travelFromPoseKeys(keys)).forward < -0.9);
  });

  it('reads a sidestep as lateral travel, not forward', () => {
    const keys = walkForward().map((k) => ({
      ...k,
      pose: { ...k.pose, pelvis: [0, 0.9, k.pose.pelvis[0]] },
    }));
    const total = totalTravel(travelFromPoseKeys(keys));
    assert.ok(Math.abs(total.forward) < 1e-6, `forward ${total.forward}`);
    assert.ok(Math.abs(Math.abs(total.lateral) - 1) < 1e-6, `lateral ${total.lateral}`);
  });

  it('turns the same travel whichever way the capture happened to face', () => {
    // The same one-metre advance, captured with the body facing +Z instead.
    const keys = walkForward().map((k, i) => ({
      t: k.t,
      pose: { pelvis: [0, 0.9, i / 10], shL: [-0.2, 1.4, 0], shR: [0.2, 1.4, 0] },
    }));
    const total = totalTravel(travelFromPoseKeys(keys));
    assert.ok(Math.abs(Math.abs(total.forward) - 1) < 1e-6, `forward ${total.forward}`);
  });

  it('refuses a clip with no pose data rather than inventing zero travel', () => {
    assert.deepEqual(travelFromPoseKeys([{ t: 0 }, { t: 1 }]), { t: [], f: [], l: [] });
  });
});

describe('sampling a travel curve is frame-rate independent', () => {
  const curve = travelFromPoseKeys(walkForward());

  it('one big step equals many small ones', () => {
    const whole = travelBetween(curve, 0, 1).forward;
    let piecewise = 0;
    for (let t = 0; t < 1; t += 1 / 240) piecewise += travelBetween(curve, t, t + 1 / 240).forward;
    assert.ok(Math.abs(whole - piecewise) < 1e-6, `${whole} vs ${piecewise}`);
    assert.ok(Math.abs(whole - 1) < 1e-6);
  });

  it('a span beyond the end does not keep travelling', () => {
    assert.ok(Math.abs(travelBetween(curve, 0, 99).forward - 1) < 1e-6);
    assert.equal(travelBetween(curve, 5, 9).forward, 0);
  });
});

describe('per-frame velocities convert to the same curve type', () => {
  it('accumulates a per-frame array into cumulative metres', () => {
    const curve = travelFromPerFrame([
      { forward: 0.1, lateral: 0 }, { forward: 0.1, lateral: 0 }, { forward: 0.1, lateral: 0.05 },
    ], 24);
    assert.ok(Math.abs(totalTravel(curve).forward - 0.3) < 1e-9);
    assert.ok(Math.abs(totalTravel(curve).lateral - 0.05) < 1e-9);
    assert.ok(Math.abs(curve.t[curve.t.length - 1] - 3 / 24) < 1e-9);
  });
});

describe('drift is not footwork', () => {
  it('rejects a curve that barely moves', () => {
    const curve = travelFromPoseKeys(walkForward(10, MIN_MEANINGFUL_TRAVEL_M / 2));
    assert.equal(isMeaningfulTravel(curve), false);
  });
  it('keeps a curve that plainly travels', () => {
    assert.equal(isMeaningfulTravel(travelFromPoseKeys(walkForward(10, 0.5))), true);
  });
});

/**
 * THE REAL CAPTURES, when a Bannon checkout is attached. A fixture can only
 * prove the maths; this proves the assumption that the source clips carry
 * usable footwork at all.
 */
const CLIPS = '/home/user/Bannon/assets/moves/clips';
describe('the source captures carry real footwork', { skip: !existsSync(CLIPS) }, () => {
  it('a drop kick travels forward, about a metre', () => {
    const d = JSON.parse(readFileSync(`${CLIPS}/DROP_KICK.json`, 'utf8'));
    const curve = travelFromPoseKeys(d.keys);
    assert.ok(peakTravel(curve) > 0.4, `peak ${peakTravel(curve)}`);
    assert.ok(totalTravel(curve).forward > 0.2, `a drop kick should end up forward of where it began`);
  });

  it('a useful share of the corpus travels at all', () => {
    const files = readdirSync(CLIPS).filter((f) => f.endsWith('.json'));
    let moving = 0;
    for (const f of files.slice(0, 300)) {
      try {
        const d = JSON.parse(readFileSync(`${CLIPS}/${f}`, 'utf8'));
        if (isMeaningfulTravel(travelFromPoseKeys(d.keys ?? []))) moving++;
      } catch { /* unreadable source, not this test's business */ }
    }
    assert.ok(moving > 30, `only ${moving} of 300 clips carry footwork — has the pose block changed?`);
  });
});
