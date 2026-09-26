#!/usr/bin/env node
/**
 * IS EACH CLIP'S LOWER BODY CREDIBLE?
 *
 * The owner's words: "A punch should not cause a 90-degree pelvic torsion."
 * Measured on ALTERNATINGFOREARMS, per frame, the pelvis rotation away from the
 * clip's own first frame:
 *
 *     0 10 11 30 33 32 46 71 100 84 40 10 38 76 103 102 112 111 101 121 108 105 101 101
 *
 * It peaks at 121 degrees and ENDS at 101. A forearm strike rotates the pelvis
 * more than a right angle and never brings it back. He was not exaggerating and
 * he was not describing a skinning artifact.
 *
 * IDLE over the same 24 frames, for contrast: 0 1 1 2 11 25 47 55 50 40 26 11 10
 * 27 37 38 32 20 8 1 3 2 1 0 — a smooth sway out and back to zero. That is what
 * a real capture looks like.
 *
 * THE MEASURE THAT SEPARATES THEM IS SPEED, NOT SIZE. The earlier attempt at
 * this compared each clip's leg placement against IDLE's and asked how far it
 * sat and how far it travelled. That tags 126 clips and puts ALTERNATINGFOREARMS
 * in the SAFE pile, because its legs travel 174 degrees, which reads as footwork.
 * They do not travel it smoothly. Frame to frame the thigh jumps 34, 22 then 59
 * degrees at 24fps — 998 deg/s.
 *
 * THE CONTROL IS IN THE BANK, so no outside number has to be trusted:
 * HURRICANE_KICK is a real kick capture and its fastest lower-body joint peaks
 * at 786 deg/s. ALTERNATINGFOREARMS moves its THIGH faster than the bank's
 * fastest kick moves anything. (Corroborating, for whoever wants it: the
 * biomechanics literature puts peak pelvis rotation for a throwing athlete
 * around 700-900 deg/s and a soccer instep kick's thigh around 1000.)
 *
 * WHAT THIS TOOL IS FOR. It does not decide the runtime mask — the engine does
 * that from what the player pressed, because a hand strike has no business
 * driving the legs whatever its clip contains (see src/engine/motion/BoneMask.ts).
 * This is the evidence and the gate: it names every clip whose lower body is not
 * credible, so a corrupt leg track cannot ride into a move that keeps its legs.
 *
 * Usage:
 *   node tools/motion/bone_mask_audit.mjs            # report
 *   node tools/motion/bone_mask_audit.mjs --write    # write public/motion/lower_body_credibility.json
 *   node tools/motion/bone_mask_audit.mjs --gate     # fail if the manifest is stale
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const BAKED = 'public/motion/baked';
const MANIFEST = 'public/motion/lower_body_credibility.json';

/**
 * The hierarchy boundary. The pelvis and both leg chains are the LOWER body;
 * the first spine joint up is the UPPER body. This is the Spine_01 split, in
 * the bone names this bank actually uses.
 */
export const LOWER_BODY_BONES = [
  'mixamorigHips',
  'mixamorigLeftUpLeg', 'mixamorigLeftLeg', 'mixamorigLeftFoot', 'mixamorigLeftToeBase',
  'mixamorigRightUpLeg', 'mixamorigRightLeg', 'mixamorigRightFoot', 'mixamorigRightToeBase',
];

/**
 * The fastest lower-body joint in HURRICANE_KICK, the bank's own reference for
 * what a real kick capture does. A clip over this is moving its legs faster
 * than the bank's fastest kick, which no strike and no walk should.
 */
export const KICK_REFERENCE_DEG_S = 786;
/** Leave headroom over the reference rather than gating on it exactly. */
export const IMPLAUSIBLE_DEG_S = 900;
/** How far a clip may leave the pelvis from where it started and still be a stance. */
export const PELVIS_RETURN_DEG = 25;

const angle = (a, b) => {
  const d = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]);
  return 2 * Math.acos(Math.min(1, d)) * 180 / Math.PI;
};
const frames = (track) => {
  const out = [];
  if (!track?.q) return out;
  for (let i = 0; i + 3 < track.q.length; i += 4) out.push([track.q[i], track.q[i + 1], track.q[i + 2], track.q[i + 3]]);
  return out;
};

/** Peak angular speed of any lower-body joint, and the joint that set it. */
export function measureClip(clip) {
  let peak = 0, peakBone = '';
  let pelvisEnd = 0;
  for (const bone of LOWER_BODY_BONES) {
    const track = clip.tracks?.[bone];
    const q = frames(track);
    if (q.length < 2 || !track.t) continue;
    for (let i = 1; i < q.length; i++) {
      const dt = track.t[i] - track.t[i - 1];
      if (!(dt > 0)) continue;
      const v = angle(q[i - 1], q[i]) / dt;
      if (v > peak) { peak = v; peakBone = bone; }
    }
    if (bone === 'mixamorigHips') pelvisEnd = angle(q[0], q[q.length - 1]);
  }
  return { peakDegS: peak, peakBone: peakBone.replace('mixamorig', ''), pelvisEndDeg: pelvisEnd };
}

export function judge(m) {
  const reasons = [];
  if (m.peakDegS > IMPLAUSIBLE_DEG_S) {
    reasons.push(`${m.peakBone} peaks at ${m.peakDegS.toFixed(0)} deg/s, past the ${KICK_REFERENCE_DEG_S} the bank's fastest kick reaches`);
  }
  if (m.pelvisEndDeg > PELVIS_RETURN_DEG) {
    reasons.push(`leaves the pelvis ${m.pelvisEndDeg.toFixed(0)} deg from where it started`);
  }
  return { credible: reasons.length === 0, reasons };
}

export function auditAll(dir = BAKED) {
  const out = {};
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.json') || f === 'index.json') continue;
    let d;
    try { d = JSON.parse(readFileSync(join(dir, f), 'utf8')); } catch { continue; }
    const name = d.name ?? f.replace('.json', '');
    const m = measureClip(d);
    const { credible, reasons } = judge(m);
    out[name] = {
      credible,
      peakDegS: Math.round(m.peakDegS),
      peakBone: m.peakBone,
      pelvisEndDeg: Math.round(m.pelvisEndDeg),
      reasons,
    };
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const rows = auditAll();
  const names = Object.keys(rows);
  const bad = names.filter((n) => !rows[n].credible);
  console.log('\nLOWER BODIES THAT ARE NOT CREDIBLE\n');
  console.log(`  ${names.length} clips measured. ${bad.length} have a lower body no body could produce.`);
  console.log(`  reference: HURRICANE_KICK, a real kick capture, peaks at ${KICK_REFERENCE_DEG_S} deg/s.\n`);
  for (const n of ['IDLE', 'BOX_IDLE', 'TPOSE', 'HURRICANE_KICK', 'GRAFQUICKJAB', 'DDT', 'CHOKESLAM', 'ALTERNATINGFOREARMS']) {
    const r = rows[n];
    if (!r) continue;
    console.log(`  ${n.padEnd(22)} ${(r.credible ? 'ok' : 'NOT CREDIBLE').padEnd(13)} peak ${String(r.peakDegS).padStart(4)} deg/s (${r.peakBone})  pelvis ends ${String(r.pelvisEndDeg).padStart(3)} deg out`);
  }
  const peaks = names.map((n) => rows[n].peakDegS).sort((a, b) => a - b);
  const p = (q) => peaks[Math.floor(peaks.length * q)];
  console.log(`\n  peak lower-body speed   p05 ${p(0.05)}  median ${p(0.5)}  p95 ${p(0.95)}  max ${peaks[peaks.length - 1]} deg/s`);

  if (process.argv.includes('--write')) {
    writeFileSync(MANIFEST, `${JSON.stringify({
      generatedBy: 'tools/motion/bone_mask_audit.mjs',
      kickReferenceDegS: KICK_REFERENCE_DEG_S,
      implausibleDegS: IMPLAUSIBLE_DEG_S,
      pelvisReturnDeg: PELVIS_RETURN_DEG,
      clips: rows,
    }, null, 2)}\n`);
    console.log(`\n  wrote ${MANIFEST}`);
  }
  if (process.argv.includes('--gate')) {
    if (!existsSync(MANIFEST)) { console.error(`\n  GATE FAIL — ${MANIFEST} missing. Run with --write.`); process.exit(1); }
    const have = JSON.parse(readFileSync(MANIFEST, 'utf8')).clips ?? {};
    const drift = names.filter((n) => (have[n]?.credible ?? null) !== rows[n].credible);
    if (drift.length) {
      console.error(`\n  GATE FAIL — ${drift.length} clips disagree with the manifest: ${drift.slice(0, 8).join(', ')}`);
      process.exit(1);
    }
    console.log('\n  GATE OK — the manifest matches what the clips measure.');
  }
}
