#!/usr/bin/env node
/**
 * WHERE IN A LONG CLIP IS THE MOVE?
 *
 * 61 baked clips are refused from the attack pool for running longer than 2.2s.
 * An attack is not a demo loop, so the gate is right about the WHOLE clip — but
 * a 4-second capture usually holds one move plus the walk-up and the recovery.
 * Refusing it throws away the move as well as the padding.
 *
 * So this finds the move: the dominant burst of motion, measured from the clip's
 * own frames. Same shape as the segmenter used on video — quiet, burst, quiet —
 * and the threshold is RELATIVE to each clip's own distribution, because a mat
 * exchange and a flying kick have completely different absolute speeds.
 *
 * ENERGY is the total angular change across all tracked bones between one key
 * and the next. No name is read and no label is trusted (OWNER LAW).
 *
 *   node tools/motion/active_span.mjs              report the long clips
 *   node tools/motion/active_span.mjs --all        every clip
 *   node tools/motion/active_span.mjs --write      write public/motion/active_spans.json
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BAKED = 'public/motion/baked';
const OUT = 'public/motion/active_spans.json';
/** A key counts as active at this share of the clip's own peak energy. */
const ACTIVE_FRACTION = 0.30;
/** Keys of quiet allowed inside one burst before it is two bursts. */
const BRIDGE_KEYS = 2;
/** Keys of lead-in and follow-through kept around the burst. */
const PAD_KEYS = 2;

const angle = (a, b, i, j) => {
  const d = Math.abs(a[i] * b[j] + a[i + 1] * b[j + 1] + a[i + 2] * b[j + 2] + a[i + 3] * b[j + 3]);
  return 2 * Math.acos(Math.min(1, d));
};

/** The dominant burst of motion in a clip, as a key range and a time range. */
export function activeSpanOf(clip) {
  const names = Object.keys(clip.tracks ?? {});
  if (!names.length || !clip.dur) return null;
  const keys = Math.max(...names.map((n) => (clip.tracks[n].q?.length ?? 0) / 4), 0);
  if (keys < 6) return null;

  const energy = new Array(keys).fill(0);
  for (const n of names) {
    const q = clip.tracks[n].q;
    if (!q) continue;
    for (let k = 1; k < keys && (k + 1) * 4 <= q.length; k++) {
      energy[k] += angle(q, q, k * 4, (k - 1) * 4);
    }
  }
  const peak = Math.max(...energy);
  if (!(peak > 0)) return null;
  const cut = peak * ACTIVE_FRACTION;

  // Longest run above the cut, allowing a short quiet bridge inside it.
  let best = null, start = -1, quiet = 0;
  for (let k = 0; k < keys; k++) {
    if (energy[k] >= cut) {
      if (start < 0) start = k;
      quiet = 0;
    } else if (start >= 0) {
      quiet++;
      if (quiet > BRIDGE_KEYS) {
        const end = k - quiet;
        if (!best || end - start > best[1] - best[0]) best = [start, end];
        start = -1; quiet = 0;
      }
    }
  }
  if (start >= 0) {
    const end = keys - 1 - quiet;
    if (!best || end - start > best[1] - best[0]) best = [start, end];
  }
  if (!best) return null;

  const lo = Math.max(0, best[0] - PAD_KEYS);
  const hi = Math.min(keys - 1, best[1] + PAD_KEYS);
  const perKey = clip.dur / (keys - 1);
  return {
    keys, fromKey: lo, toKey: hi,
    from: +(lo * perKey).toFixed(4),
    to: +(hi * perKey).toFixed(4),
    span: +((hi - lo) * perKey).toFixed(4),
    share: +((hi - lo) / (keys - 1)).toFixed(3),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const all = process.argv.includes('--all');
  const rows = {};
  let long = 0, rescued = 0;
  for (const f of readdirSync(BAKED)) {
    if (!f.endsWith('.json') || f === 'index.json') continue;
    let clip; try { clip = JSON.parse(readFileSync(join(BAKED, f), 'utf8')); } catch { continue; }
    const name = f.replace('.json', '');
    const s = activeSpanOf(clip);
    if (!s) continue;
    if (all || clip.dur > 2.2) rows[name] = { dur: clip.dur, ...s };
    if (clip.dur > 2.2) { long++; if (s.span <= 2.2 && s.span >= 0.15) rescued++; }
  }
  const names = Object.keys(rows).sort((a, b) => rows[b].dur - rows[a].dur);
  console.log('\nACTIVE SPAN — the dominant burst of motion in each clip\n');
  console.log('  clip                            dur     span    window          share');
  for (const n of names.slice(0, 20)) {
    const r = rows[n];
    console.log(`  ${n.padEnd(30)} ${String(r.dur).padStart(6)}s ${String(r.span).padStart(6)}s  ${String(r.from).padStart(6)}-${String(r.to).padEnd(6)}  ${r.share}`);
  }
  console.log(`\n  ${long} clips run longer than 2.2s; ${rescued} have a usable burst inside 2.2s`);
  if (process.argv.includes('--write')) {
    writeFileSync(OUT, `${JSON.stringify({
      generatedBy: 'tools/motion/active_span.mjs',
      what: 'the dominant burst of motion per clip, measured from its own frames. A long capture holds one move plus setup; this is where the move is.',
      activeFraction: ACTIVE_FRACTION,
      clips: rows,
    }, null, 0)}\n`);
    console.log(`  wrote ${OUT}`);
  }
}
