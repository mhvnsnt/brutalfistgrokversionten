#!/usr/bin/env node
/**
 * Print the stage catalogue as a markdown table, read out of the real
 * STAGE_CONFIGS record.
 *
 * docs/stage_architecture.md embeds this table. Regenerate with
 *   node scripts/print-stage-table.mjs
 * rather than editing the doc by hand — a transcribed table goes stale the
 * first time someone adds a stage, and this project's standing rule is that a
 * fact you can measure is never written from memory.
 */

import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const scratch = mkdtempSync(join(tmpdir(), 'stage-table-'));

try {
  // StageConfig is pure data + pure functions, so stripping the types is all
  // that is needed to read it from plain node.
  const js = join(scratch, 'StageConfig.mjs');
  execSync(
    `npx --yes esbuild ${JSON.stringify(join(ROOT, 'src/engine/combat/StageConfig.ts'))}` +
    ` --format=esm --outfile=${JSON.stringify(js)} --log-level=error`,
    { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] },
  );
  const { STAGE_CONFIGS } = await import(`file://${js}`);

  const n = (v) => (v === Infinity ? '∞' : String(v));
  const head = ['id', 'name', 'bX', 'bZ', 'ringOut', 'walls', 'destr', 'lv', 'floorY',
                'brkDmg', 'hazard', 'hazVol', 'train', 'edge', 'neon', 'amb', 'bgm'];
  const rows = Object.values(STAGE_CONFIGS).map((s) => [
    s.id,
    s.name,
    n(s.boundaryX),
    n(s.boundaryZ),
    s.ringOutEnabled ? 'Y' : '·',
    s.hasWalls ? 'Y' : '·',
    s.hasDestructibleWalls ? 'Y' : '·',
    String(s.levels.length),
    s.levels.map((l) => n(l.floorY)).join(' / '),
    s.breakableFloor ? String(s.floorBreakThreshold) : '·',
    s.hazardDamagePerSec ? `${s.hazardDamagePerSec}/s ${s.hazardLabel}` : '·',
    s.hazardVolume ? `x>${s.hazardVolume.triggerX} ${Math.round(s.hazardVolume.chipDamage * 100)}%` : '·',
    s.hasTrainHazard ? 'Y' : '·',
    String(s.edgeZoneDistance),
    s.neonPalette ? String(s.neonPalette.length) : '0',
    String(s.ambientIntensity),
    s.bgmTrack,
  ]);

  const w = head.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const line = (cells) => `| ${cells.map((v, i) => v.padEnd(w[i])).join(' | ')} |`;
  console.log(line(head));
  console.log(`|${w.map((x) => '-'.repeat(x + 2)).join('|')}|`);
  for (const r of rows) console.log(line(r));
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
