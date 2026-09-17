#!/usr/bin/env node
/**
 * Pull the owner-granted Bannon motion bank into a generated TypeScript module.
 *
 * The source clips are the real assets under mhvnsnt/Bannon/assets/moves/clips.
 * We do not synthesize replacement motion here. The generated module is a
 * cache so the runtime can synchronously build AnimationClips and retarget them.
 *
 * This runs before dev/build. If the network is unavailable and the generated
 * bank already exists, it is left untouched so an existing preview keeps working.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUTPUT = `${ROOT}/src/generated/BannonMotionBank.generated.ts`;
const INDEX_URL = 'https://raw.githubusercontent.com/mhvnsnt/Bannon/81d3b5da72da4dc2b057c8b3989226158c066240/assets/moves/clips/index.json';
const RAW_BASE = 'https://raw.githubusercontent.com/mhvnsnt/Bannon/81d3b5da72da4dc2b057c8b3989226158c066240/assets/moves/clips/';

async function fetchJson(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'brutal-fist-motion-sync/1.0' } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
  return response.json();
}

async function main() {
  let index;
  try {
    index = await fetchJson(INDEX_URL);
  } catch (error) {
    try {
      await readFile(OUTPUT, 'utf8');
      console.warn(`[motion-sync] network unavailable; keeping existing ${OUTPUT}`);
      return;
    } catch {
      throw error;
    }
  }

  const entries = Object.entries(index)
    .filter(([, meta]) => meta && typeof meta.file === 'string' && meta.file.endsWith('.json'));

  const bank = {};
  const concurrency = 8;
  let cursor = 0;
  let failures = 0;

  async function worker() {
    while (cursor < entries.length) {
      const i = cursor++;
      const [id, meta] = entries[i];
      try {
        bank[id] = await fetchJson(`${RAW_BASE}${encodeURIComponent(meta.file)}`);
      } catch (error) {
        failures++;
        console.warn(`[motion-sync] skipped ${id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, entries.length) }, worker));

  if (Object.keys(bank).length === 0) {
    throw new Error('[motion-sync] no motion clips were downloaded');
  }

  await mkdir(dirname(OUTPUT), { recursive: true });
  const source = `/** GENERATED FILE — do not hand edit. Source: mhvnsnt/Bannon/assets/moves/clips. */\n` +
    `export const BANNON_MOTION_BANK = ${JSON.stringify(bank)} as const;\n`;
  await writeFile(OUTPUT, source, 'utf8');
  console.log(`[motion-sync] synced ${Object.keys(bank).length}/${entries.length} Bannon motion clips${failures ? ` (${failures} skipped)` : ''}`);
}

main().catch((error) => {
  console.error(`[motion-sync] ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
  process.exitCode = 1;
});
