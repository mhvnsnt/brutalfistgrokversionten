#!/usr/bin/env node
/**
 * Skip the remote motion sync when the generated banks are already in the
 * tree. Set BF_FORCE_SYNC=1 to pull Bannon / Schwarzerblitz again.
 */
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const REQUIRED = [
  'src/generated/BannonMotionBank.generated.ts',
  'src/generated/SchwarzerblitzMotionBank.generated.ts',
  'public/motion/baked/index.json',
];

if (process.env.BF_FORCE_SYNC === '1' || REQUIRED.some((p) => !existsSync(p))) {
  const chain = [
    'node scripts/sync-bannon-motion.mjs',
    'node scripts/sync-schwarzerblitz-motion.mjs',
    'node scripts/sync-fighting-motion-sources.mjs',
    'node scripts/fetch-open-animation-packs.mjs',
    'node scripts/sync-open-animation-sources.mjs',
    'node scripts/sync-schwarzerblitz-moves.mjs',
    'node --experimental-strip-types --import ./scripts/register-ts-resolve.mjs scripts/bake-fighter-animations.mjs --gate',
    'node --experimental-strip-types --import ./scripts/register-ts-resolve.mjs tools/moves/map_commands.mjs --full --write',
  ];
  for (const cmd of chain) {
    const result = spawnSync(cmd, { stdio: 'inherit', shell: true });
    if (result.status) process.exit(result.status ?? 1);
  }
} else {
  console.log('[predev] generated motion banks present — skipping remote sync');
}
