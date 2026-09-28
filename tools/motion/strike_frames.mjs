#!/usr/bin/env node
/**
 * THE MOVE IS A SLICE OF ITS ANIMATION. Derive that slice from the clip itself.
 *
 * Owner: "the animation plays very quickly ... it doesn't play long enough for
 * the full animation to play out. The move never looks like it makes contact."
 * And: "just pull in a whole system ... I'm tired of this animation issue."
 *
 * THE SYSTEM, taken from the three working engines rather than invented here.
 * MUGEN/Ikemen GO bind hitboxes to ANIMATION FRAMES (AIR: CLSN1/CLSN2 per
 * frame). Schwarzerblitz binds a move to `animation` + `frameStart` + `frameEnd`.
 * In both, a move cannot end before its motion does, and nothing is ever sped up
 * or truncated, because the window IS the animation.
 *
 * Ours is the only one of the four where the window (`startup + active +
 * recovery`, hand-authored) and the clip (imported mocap) are unrelated numbers.
 * Measured: median clip 0.792s inside a 0.333s light window, 87% of clips longer
 * than the window they play in. The playback rate was silently absorbing the
 * whole disagreement.
 *
 * This generates the missing binding for every attack clip, from the clip's own
 * geometry. No clip name is read and no label is trusted (OWNER LAW).
 *
 * WHAT IS MEASURED, and why this is not the reach test that already exists:
 * limb_reach.mjs says its own dead ends out loud -- a joint's distance from its
 * parent saturates, and its travel relative to the hips ranks a kip-up above a
 * knee strike. The note there names what was missing: "direction AND timing: a
 * strike drives the joint forward FAST and then RETRACTS." That is what this
 * measures.
 *
 *   forward      the body's OWN facing per key, from the hips' world matrix, so
 *                a turning body does not read as a strike
 *   extension    striking joint forward of the hips, along that facing, as a
 *                fraction of the rig's bind height (tall and short rigs agree)
 *   CONTACT      the key of peak extension -- this is the hit frame
 *   RETRACTION   how much of that extension is given back afterwards. A punch
 *                returns; a lunge, a roll and a fall do not. This is what
 *                separates a strike from a displacement.
 *
 *   node tools/motion/strike_frames.mjs            report
 *   node tools/motion/strike_frames.mjs --write    write public/motion/strike_frames.json
 *   node tools/motion/strike_frames.mjs --all      include non-attack clips
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadRig, worldPose, poseAt, jointPos, keyCount, bindHeight } from './fk.mjs';

const BAKED = 'public/motion/baked';
const OUT = 'public/motion/strike_frames.json';
const RIG = process.env.STRIKE_RIG || 'public/models/BANNON.glb';
const WRITE = process.argv.includes('--write');
const ALL = process.argv.includes('--all');

/** The joints a strike can land with. */
const STRIKERS = [
  ['handR', 'mixamorigRightHand'], ['handL', 'mixamorigLeftHand'],
  ['elbowR', 'mixamorigRightForeArm'], ['elbowL', 'mixamorigLeftForeArm'],
  ['footR', 'mixamorigRightFoot'], ['footL', 'mixamorigLeftFoot'],
  ['kneeR', 'mixamorigRightLeg'], ['kneeL', 'mixamorigLeftLeg'],
];
const HIPS = 'mixamorigHips';
/** A strike gives back at least this share of its extension. */
const MIN_RETRACTION = 0.25;
/** Active frames are held while extension is within this of the peak. */
const ACTIVE_BAND = 0.88;

const rig = loadRig(RIG);
const H = bindHeight(rig) || 1;

/** Per-key extension of every striking joint along the body's own facing. */
function extensions(clip) {
  const keys = Math.max(0, ...Object.keys(clip.tracks ?? {}).map((b) => keyCount(clip, b)));
  if (keys < 4) return null;
  const series = new Map(STRIKERS.map(([k]) => [k, []]));
  for (let k = 0; k < keys; k++) {
    const world = worldPose(rig, poseAt(clip, k));
    const hips = jointPos(world, rig, HIPS);
    if (!hips) return null;
    // The body's OWN forward this key, from the hips' basis -- not a world axis.
    const hi = rig.indexOfName.get(HIPS);
    const e = world[hi].elements;
    // glTF characters face -Z in bind; the hips' third basis column is that axis.
    const fwd = { x: -e[8], y: -e[9], z: -e[10] };
    const len = Math.hypot(fwd.x, fwd.y, fwd.z) || 1;
    fwd.x /= len; fwd.y /= len; fwd.z /= len;
    for (const [key, bone] of STRIKERS) {
      const p = jointPos(world, rig, bone);
      if (!p) { series.get(key).push(0); continue; }
      const dx = p.x - hips.x, dy = p.y - hips.y, dz = p.z - hips.z;
      series.get(key).push((dx * fwd.x + dy * fwd.y + dz * fwd.z) / H);
    }
  }
  return { keys, series };
}

/** The contact frame, the active band around it, and whether it retracts. */
export function strikeFramesOf(clip) {
  const ex = extensions(clip);
  if (!ex) return null;
  const { keys, series } = ex;

  let best = null;
  for (const [limb, s] of series) {
    const base = s[0];
    let peak = -Infinity, at = 0;
    for (let k = 0; k < s.length; k++) if (s[k] - base > peak) { peak = s[k] - base; at = k; }
    if (!(peak > 0)) continue;
    // How much of the extension comes back after the peak -- the retraction.
    let after = -Infinity;
    for (let k = at + 1; k < s.length; k++) after = Math.max(after, -(s[k] - base - peak));
    const retraction = after === -Infinity ? 0 : Math.max(0, after) / peak;
    const score = peak * (0.5 + 0.5 * Math.min(1, retraction / MIN_RETRACTION));
    if (!best || score > best.score) best = { limb, peak, at, retraction, score, series: s, base };
  }
  if (!best) return null;

  // The active band: keys held near the peak extension.
  const { series: s, base, peak, at } = best;
  const cut = base + peak * ACTIVE_BAND;
  let from = at, to = at;
  while (from > 0 && s[from - 1] >= cut) from--;
  while (to < keys - 1 && s[to + 1] >= cut) to++;

  const perKey = clip.dur / Math.max(1, keys - 1);
  return {
    limb: best.limb,
    keys,
    contactKey: at,
    activeFromKey: from,
    activeToKey: to,
    // …and the same thing as a 60fps frame window, which is what the engine speaks.
    startupFrames: Math.round(from * perKey * 60),
    activeFrames: Math.max(1, Math.round((to - from + 1) * perKey * 60)),
    recoveryFrames: Math.max(0, Math.round((keys - 1 - to) * perKey * 60)),
    totalFrames: Math.round(clip.dur * 60),
    contactSeconds: +(at * perKey).toFixed(4),
    durSeconds: +clip.dur.toFixed(4),
    extension: +peak.toFixed(4),
    retraction: +best.retraction.toFixed(3),
    isStrike: best.retraction >= MIN_RETRACTION && peak > 0.05,
  };
}

if (!existsSync(BAKED)) { console.error(`no ${BAKED}`); process.exit(1); }
const files = readdirSync(BAKED).filter((f) => f.endsWith('.json'));
const out = {};
let attacks = 0, strikes = 0, skipped = 0;
for (const f of files) {
  let clip;
  try { clip = JSON.parse(readFileSync(join(BAKED, f), 'utf8')); } catch { skipped++; continue; }
  const isAttack = /^attack/.test(clip.semantic ?? '');
  if (!ALL && !isAttack) continue;
  attacks++;
  const r = strikeFramesOf(clip);
  if (!r) { skipped++; continue; }
  if (r.isStrike) strikes++;
  out[clip.name ?? f.replace(/\.json$/, '')] = r;
}

const rows = Object.entries(out);
console.log(`rig ${RIG}  bind height ${H.toFixed(3)}m`);
console.log(`${attacks} attack clips, ${rows.length} measured, ${strikes} retract like a strike, ${skipped} skipped\n`);
const shown = rows.filter(([, r]) => r.isStrike).sort((a, b) => b[1].extension - a[1].extension).slice(0, 14);
console.log('  limb    ext   retr  contact   startup active recovery total   clip');
for (const [name, r] of shown) {
  console.log(`  ${r.limb.padEnd(7)} ${r.extension.toFixed(3)} ${r.retraction.toFixed(2)}  ${String(r.contactSeconds + 's').padStart(7)}  ${String(r.startupFrames).padStart(7)} ${String(r.activeFrames).padStart(6)} ${String(r.recoveryFrames).padStart(8)} ${String(r.totalFrames).padStart(5)}   ${name}`);
}
if (rows.length) {
  const su = rows.filter(([, r]) => r.isStrike).map(([, r]) => r.startupFrames).sort((a, b) => a - b);
  const tot = rows.filter(([, r]) => r.isStrike).map(([, r]) => r.totalFrames).sort((a, b) => a - b);
  const p = (a, q) => (a.length ? a[Math.floor((a.length - 1) * q)] : 0);
  console.log(`\n  startup frames  p10 ${p(su, .1)}  median ${p(su, .5)}  p90 ${p(su, .9)}`);
  console.log(`  total frames    p10 ${p(tot, .1)}  median ${p(tot, .5)}  p90 ${p(tot, .9)}`);
  console.log(`  (engine today: lightAttack startup 10, total 20 -- hand-authored, clip-blind)`);
}
if (WRITE) { writeFileSync(OUT, JSON.stringify(out, null, 1)); console.log(`\nwrote ${OUT} (${rows.length} clips)`); }
