#!/usr/bin/env node
/**
 * STAMP THE SERVICE WORKER'S CACHE VERSION.
 *
 * WHY THE APP WOULD NOT UPDATE. `sw.js` kept a hardcoded `VERSION`, and
 * `activate` deletes every cache whose key does not start with it. With a
 * constant, no deploy ever purged anything — so every cache-first asset a
 * device picked up on its first install was kept forever, and a re-exported
 * model, portrait or motion clip could never reach it.
 *
 * The version is the commit, so each deploy is its own cache generation and
 * the previous one is dropped on activate.
 *
 * Usage: node scripts/stamp-sw-version.mjs <dist-dir> [version]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const dist = process.argv[2] ?? 'dist';
const swPath = join(dist, 'sw.js');
if (!existsSync(swPath)) {
  console.error(`REFUSED: ${swPath} does not exist — nothing to stamp.`);
  process.exit(1);
}

function version() {
  if (process.argv[3]) return process.argv[3];
  for (const env of ['GITHUB_SHA', 'VERCEL_GIT_COMMIT_SHA', 'COMMIT_SHA']) {
    if (process.env[env]) return process.env[env].slice(0, 12);
  }
  try {
    return execSync('git rev-parse --short=12 HEAD', { encoding: 'utf8' }).trim();
  } catch {
    // No git and no CI variable: fall back to the build time, which still
    // changes per deploy. Never leave the placeholder in a shipped worker.
    return `t${Date.now().toString(36)}`;
  }
}

const PLACEHOLDER = '__BF_SW_VERSION__';
const src = readFileSync(swPath, 'utf8');
if (!src.includes(PLACEHOLDER)) {
  console.error(`REFUSED: ${swPath} has no ${PLACEHOLDER} — it would ship with a stale cache key.`);
  process.exit(1);
}

const v = `bf-${version()}`;
writeFileSync(swPath, src.split(PLACEHOLDER).join(v));
console.log(`✅ ${swPath} cache version = ${v}`);
