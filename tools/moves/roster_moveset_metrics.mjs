#!/usr/bin/env node
/**
 * ROSTER MOVESET DIVERSITY METRICS over a movesets.json table.
 *
 *   node tools/moves/roster_moveset_metrics.mjs [path]           (default public/motion/movesets.json)
 *   git show <sha>:public/motion/movesets.json > /tmp/before.json && node tools/moves/roster_moveset_metrics.mjs /tmp/before.json
 *
 * Reports: fighters, slots, roster-wide distinct clips, pairwise clip-set overlap
 * (Jaccard, and overlap coefficient |A∩B|/min) avg/min/max, identical clip sets, same-slot/same-clip collisions,
 * clips whose timing differs by fighter, per-fighter damage range, the 6P
 * same-input example, and string (cancel) links.
 */
import { readFileSync } from 'node:fs';

export function metrics(table) {
  const fighters = Object.keys(table).filter((k) => Array.isArray(table[k]));
  const rows = fighters.flatMap((f) => table[f].map((m) => ({ f, ...m, slot: m.id.replace(`bf_${f}_`, '') })));
  const sets = Object.fromEntries(fighters.map((f) => [f, new Set(table[f].map((m) => m.clip))]));
  const pairs = [];
  const coeff = [];
  const identical = [];
  for (let i = 0; i < fighters.length; i++) for (let j = i + 1; j < fighters.length; j++) {
    const A = sets[fighters[i]], B = sets[fighters[j]];
    const inter = [...A].filter((c) => B.has(c)).length;
    const union = new Set([...A, ...B]).size;
    pairs.push(inter / union);
    coeff.push(inter / Math.min(A.size, B.size));
    if (inter === A.size && inter === B.size) identical.push(`${fighters[i]}=${fighters[j]}`);
  }
  const bySlot = new Map();
  for (const r of rows) {
    const k = `${r.slot}|${r.clip}`;
    bySlot.set(k, (bySlot.get(k) ?? 0) + 1);
  }
  const collisions = rows.filter((r) => bySlot.get(`${r.slot}|${r.clip}`) > 1).length;
  const timingByClip = new Map();
  for (const r of rows) {
    const sig = `${r.startup.toFixed(4)}/${r.active.toFixed(4)}/${r.recovery.toFixed(4)}/${r.damage}`;
    if (!timingByClip.has(r.clip)) timingByClip.set(r.clip, new Set());
    timingByClip.get(r.clip).add(sig);
  }
  const clipsVaryingByFighter = [...timingByClip.values()].filter((s) => s.size > 1).length;
  const sharedClips = [...timingByClip.keys()].filter((c) => new Set(rows.filter((r) => r.clip === c).map((r) => r.f)).size > 1).length;
  const dmg = Object.fromEntries(fighters.map((f) => {
    const d = table[f].map((m) => m.damage);
    return [f, [Math.min(...d), Math.max(...d)]];
  }));
  const sixP = Object.fromEntries(fighters.map((f) => {
    const m = table[f].find((x) => /_Ground_6P$/.test(x.id));
    return [f, m ? `${m.clip} ${m.startup.toFixed(3)}/${m.active.toFixed(3)}/${m.recovery.toFixed(3)}s ${m.damage}dmg${m.onBlock !== undefined ? ` ${m.onBlock >= 0 ? '+' : ''}${m.onBlock}oB` : ''}` : '-'];
  }));
  const sixPSig = new Set(Object.values(sixP));
  const strings = Object.fromEntries(fighters.map((f) => [f, table[f].filter((m) => (m.string ?? []).length).length]));
  const avg = pairs.reduce((a, b) => a + b, 0) / (pairs.length || 1);
  return {
    fighters: fighters.length,
    slots: rows.length,
    distinctClips: new Set(rows.map((r) => r.clip)).size,
    overlap: { avg: +avg.toFixed(3), min: +Math.min(...pairs).toFixed(3), max: +Math.max(...pairs).toFixed(3) },
    overlapCoefficient: {
      avg: +(coeff.reduce((a, b) => a + b, 0) / (coeff.length || 1)).toFixed(3),
      min: +Math.min(...coeff).toFixed(3),
      max: +Math.max(...coeff).toFixed(3),
    },
    identicalSets: identical,
    sameSlotSameClipRows: collisions,
    clipsUsedByMultipleFighters: sharedClips,
    clipsWithFighterDependentTiming: clipsVaryingByFighter,
    distinct6PGameplay: sixPSig.size,
    damageRange: dmg,
    sixP,
    explicitStringLinks: strings,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const path = process.argv[2] ?? 'public/motion/movesets.json';
  console.log(JSON.stringify(metrics(JSON.parse(readFileSync(path, 'utf8'))), null, 2));
}
