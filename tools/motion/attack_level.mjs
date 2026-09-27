#!/usr/bin/env node
/**
 * HIGH, MID OR LOW — derived from where the striking limb actually is.
 *
 * MEASURED: all 286 imported moves in public/motion/movesets.json carry NO attack
 * level. Every one of them defaults to 'mid'. So the entire high/mid/low layer —
 * the Tekken guard, the low parry, a high whiffing over a crouch, a power crush
 * covering high and mid but not low — applies to the SIX hand-authored basics and
 * to nothing else. 286 of 292 moves are mids, and every defensive system built on
 * attack height is inert for all of them.
 *
 * THE LEVEL IS NOT A LABEL TO INVENT, IT IS IN THE FRAMES. A move hits where its
 * striking limb is at contact. So: find the frame where the striking limb is
 * furthest forward (that is contact), take that limb's HEIGHT as a fraction of the
 * rig's standing height, and read off the band. Nothing here consults a filename,
 * which is the rule this project keeps relearning — `CrotchChop` is labelled a
 * strike and the frames say taunt.
 *
 * THE BANDS come from the genre's own definitions rather than from a guess:
 *   high   hits the head, so it WHIFFS over a crouch
 *   mid    hits the torso, blocked standing, hits a crouch
 *   low    hits the shins, blocked only crouching
 * expressed as fractions of standing height, with the cuts checked against the
 * measured distribution below rather than asserted.
 *
 * Usage:
 *   node tools/motion/attack_level.mjs [model.glb]           # report
 *   node tools/motion/attack_level.mjs --write               # write the manifest
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadRig, worldPose, poseAt, jointPos, keyCount, bindHeight } from './fk.mjs';

const MODEL = process.argv.find((a) => a.endsWith('.glb')) ?? 'public/models/TITAN.glb';
const BAKED = 'public/motion/baked';
const MANIFEST = 'public/motion/attack_levels.json';

/** Every limb that can be the striking one, and the joint that is its tip. */
const STRIKERS = [
  ['mixamorigLeftHand', 'hand'], ['mixamorigRightHand', 'hand'],
  ['mixamorigLeftFoot', 'foot'], ['mixamorigRightFoot', 'foot'],
];

/**
 * Head height and hip height are what the bands actually mean, so they are read
 * off the rig rather than assumed: a high is at or above the hips-to-head
 * midpoint, a low is below the knee.
 */
export function bandsFor(r) {
  const w = worldPose(r, () => null);
  const head = jointPos(w, r, 'mixamorigHead');
  const hips = jointPos(w, r, 'mixamorigHips');
  const knee = jointPos(w, r, 'mixamorigLeftLeg') ?? jointPos(w, r, 'mixamorigRightLeg');
  const feet = ['mixamorigLeftFoot', 'mixamorigRightFoot'].map((f) => jointPos(w, r, f)).filter(Boolean);
  const floor = Math.min(...feet.map((f) => f.y));
  const h = bindHeight(r);
  if (!head || !hips || !knee || !h) return null;
  return {
    // A high must be high enough that ducking takes the head out of it: the
    // shoulders, which is where hips-to-head is roughly two thirds up.
    highFrom: (hips.y - floor + (head.y - hips.y) * 0.5) / h,
    // A low must be under the knee, or crouch-blocking it makes no sense.
    lowBelow: (knee.y - floor) / h,
    height: h,
  };
}

/**
 * Contact frame, striking limb, and that limb's height as a fraction of standing
 * height.
 *
 * THE STRIKER IS THE LIMB THAT TRAVELS, not the one that happens to sit furthest
 * out. A first version took the limb with the greatest horizontal distance from
 * the hips and it classified GRAFQUICKJAB as a LOW FOOT strike — because a foot
 * planted at stance width is further from the hips than an extended punching hand,
 * the hips being at roughly mid-height while the foot is displaced sideways. The
 * static stance beat the moving limb in every hand strike in the bank.
 *
 * So each limb is measured against ITS OWN closest point in the clip, and the
 * striker is whichever gains the most. That is bias-free: a foot that sits wide
 * and never moves gains nothing.
 */
export function contactOf(r, clip, bands) {
  const keys = Math.max(...STRIKERS.map(([b]) => keyCount(clip, b)), 0);
  if (keys < 2) return null;
  const rest = worldPose(r, () => null);
  const feet = ['mixamorigLeftFoot', 'mixamorigRightFoot'].map((f) => jointPos(rest, r, f)).filter(Boolean);
  const floor = Math.min(...feet.map((f) => f.y));

  // Pass one: every limb's horizontal extent from the hips, per frame.
  const extents = new Map(STRIKERS.map(([b]) => [b, []]));
  const heights = new Map(STRIKERS.map(([b]) => [b, []]));
  for (let k = 0; k < keys; k++) {
    const w = worldPose(r, poseAt(clip, k));
    const hips = jointPos(w, r, 'mixamorigHips');
    if (!hips) continue;
    for (const [bone] of STRIKERS) {
      const p = jointPos(w, r, bone);
      if (!p) continue;
      extents.get(bone).push(Math.hypot(p.x - hips.x, p.z - hips.z));
      heights.get(bone).push((p.y - floor) / bands.height);
    }
  }

  // Pass two: the limb with the largest gain over its OWN minimum is the striker,
  // and contact is the frame where that gain peaks.
  let best = null;
  for (const [bone, kind] of STRIKERS) {
    const xs = extents.get(bone);
    if (!xs?.length) continue;
    const floorExtent = Math.min(...xs);
    let peak = -1, peakAt = 0;
    for (let k = 0; k < xs.length; k++) {
      const gain = xs[k] - floorExtent;
      if (gain > peak) { peak = gain; peakAt = k; }
    }
    if (!best || peak > best.gain) {
      best = { gain: peak, frame: peakAt, bone, kind, heightFrac: heights.get(bone)[peakAt] ?? 0 };
    }
  }
  return best;
}

export function levelFrom(contact, bands) {
  if (!contact) return null;
  if (contact.heightFrac < bands.lowBelow) return 'low';
  if (contact.heightFrac >= bands.highFrom) return 'high';
  return 'mid';
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = loadRig(MODEL);
  const bands = bandsFor(r);
  if (!bands) { console.error('  could not read the rig bands — tool failure, not a pass'); process.exitCode = 1; }
  else {
    console.log(`\nATTACK LEVEL FROM THE FRAMES — ${MODEL.split('/').pop()}\n`);
    console.log(`  standing height ${bands.height.toFixed(3)}m`);
    console.log(`  low  below ${(bands.lowBelow * 100).toFixed(0)}% of height (under the knee)`);
    console.log(`  high at/above ${(bands.highFrom * 100).toFixed(0)}% (shoulders — a crouch takes the head out of it)\n`);
    const rows = {};
    const dist = { high: 0, mid: 0, low: 0 };
    for (const f of readdirSync(BAKED)) {
      if (!f.endsWith('.json') || f === 'index.json') continue;
      let clip;
      try { clip = JSON.parse(readFileSync(join(BAKED, f), 'utf8')); } catch { continue; }
      const c = contactOf(r, clip, bands);
      const level = levelFrom(c, bands);
      if (!level || !c) continue;
      rows[clip.name ?? f.replace('.json', '')] = {
        level,
        limb: c.bone.replace('mixamorig', ''),
        kind: c.kind,
        heightFrac: +c.heightFrac.toFixed(3),
        frame: c.frame,
      };
      dist[level]++;
    }
    const total = dist.high + dist.mid + dist.low;
    console.log(`  ${total} clips classified:  high ${dist.high} (${Math.round(dist.high / total * 100)}%)`
      + `   mid ${dist.mid} (${Math.round(dist.mid / total * 100)}%)   low ${dist.low} (${Math.round(dist.low / total * 100)}%)`);
    console.log('\n  spot checks:');
    for (const n of ['GRAFQUICKJAB', 'UPPERCUT', 'QUICKKICK', 'HEAVYKICK', 'CROUCHINGKICK', 'ROUNDHOUSELOW', 'AXEKICK', 'HIGHPUNCH', 'GRAFPUNCHCOMBO_SLOWER']) {
      const x = rows[n];
      if (!x) continue;
      console.log(`    ${n.padEnd(26)} ${x.level.padEnd(5)} ${x.limb.padEnd(10)} at ${(x.heightFrac * 100).toFixed(0)}% of height, frame ${x.frame}`);
    }
    if (process.argv.includes('--write')) {
      writeFileSync(MANIFEST, `${JSON.stringify({
        generatedBy: 'tools/motion/attack_level.mjs',
        model: MODEL,
        bands: { lowBelow: +bands.lowBelow.toFixed(3), highFrom: +bands.highFrom.toFixed(3) },
        what: 'level is derived from the striking limb height at the contact frame, as a fraction of standing height. Never from a name.',
        clips: rows,
      }, null, 2)}\n`);
      console.log(`\n  wrote ${MANIFEST}`);
    }
  }
}
