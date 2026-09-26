import { readFileSync } from 'node:fs';
import { markBackwardStrikes, markFrozen, markInverted, type BakedManifestEntry } from '../../src/engine/retarget/BakedMotionBank.ts';
const m = JSON.parse(readFileSync('public/motion/baked/index.json', 'utf8')) as Record<string, BakedManifestEntry>;
const back = markBackwardStrikes(m), frozen = markFrozen(m), inv = markInverted(m);
type Row = { n: string; up: number; dur: number; limb: string; reach: number; fwd: number; gap: number };
const rows: Row[] = [];
for (const [n, e] of Object.entries(m)) {
  const s = (e as any).strike ?? {};
  if (back.has(n) || frozen.has(n) || inv.has(n)) continue;
  if ((e.spineUp ?? 0) < 0.85) continue;
  if ((e.dur ?? 9) > 1.6 || (e.dur ?? 0) < 0.15) continue;
  if (((e as any).floorGap ?? 0) > 0.08) continue;
  if ((e as any).airborne) continue;
  if (n.startsWith('UAL')) continue;      // vendor library, not fighting
  rows.push({ n, up: e.spineUp ?? 0, dur: e.dur ?? 0, limb: s.limb ?? '-', reach: s.reach ?? 0, fwd: s.fwd ?? 0, gap: (e as any).floorGap ?? 0 });
}
const hand = rows.filter((r) => /Hand/.test(r.limb)).sort((a, b) => b.reach - a.reach);
const foot = rows.filter((r) => /Foot|Toe/.test(r.limb)).sort((a, b) => b.reach - a.reach);
console.log(`\n${rows.length} clips are upright, forward-striking, animated, on the floor and under 1.6s`);
const show = (t: string, xs: Row[]) => {
  console.log(`\n${t} — ${xs.length}, best reach first`);
  for (const r of xs.slice(0, 12)) console.log(`  ${r.n.padEnd(28)} up ${r.up.toFixed(3)}  ${r.dur.toFixed(3)}s  ${r.limb.padEnd(10)} reach ${r.reach.toFixed(3)}  fwd ${r.fwd.toFixed(3)}`);
};
show('HAND STRIKES (punches)', hand);
show('FOOT STRIKES (kicks)', foot);
