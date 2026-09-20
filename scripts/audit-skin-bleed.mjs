#!/usr/bin/env node
/**
 * ARE THE SKIN WEIGHTS ANATOMICALLY POSSIBLE?
 *
 * Owner, on the shipped roster: "from his wrist to his hip or pelvis area
 * almost like a wrist cuff handcuff shred ... some of them are almost turning
 * into pterodactyl Cronenberg beasts."
 *
 * Drives tools/skinbleed/main.ts through the REAL loader (meshopt and all) and
 * reports, per model, how many vertices are pulled by joints too far apart on
 * the skeleton to share a vertex. See that file for why the measure has to be
 * hop distance and why skinqa cannot see this at all.
 *
 * Usage: npm run dev, then
 *   node scripts/audit-skin-bleed.mjs                 # every wired model
 *   node scripts/audit-skin-bleed.mjs VIPER.glb,JAGER.glb
 *   node scripts/audit-skin-bleed.mjs --gate          # non-zero exit on a regression
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { chromium } from 'playwright';

const ARGS = process.argv.slice(2);
const GATE = ARGS.includes('--gate');
const ONLY = ARGS.find((a) => !a.startsWith('--'));
/** Measure what the GAME loads (after the repair) rather than the raw file. */
const PIPELINE = ARGS.includes('--pipeline');
const BASE = process.env.BF_BASE ?? 'http://127.0.0.1:8080';
/** A model may carry this many bleeding vertices before it is a defect. */
const TOLERANCE = Number(process.env.BF_BLEED_TOLERANCE ?? 0);

/**
 * ONLY THE MODELS THE GAME ACTUALLY BINDS. public/models carries re-rig
 * intermediates and backups; auditing those reports defects in files nothing
 * loads, which is how a real regression gets lost in a long list.
 */
function wiredModels() {
  if (ONLY) return ONLY.split(',').filter(Boolean);
  const all = readdirSync('public/models').filter((f) => f.endsWith('.glb'));
  const roster = existsSync('src/data/bannonRoster.ts')
    ? readFileSync('src/data/bannonRoster.ts', 'utf8')
    : '';
  const extra = existsSync('src/data/bannonGlbRoster.ts')
    ? readFileSync('src/data/bannonGlbRoster.ts', 'utf8')
    : '';
  const haystack = roster + extra;
  return all.filter((f) => haystack.includes(f));
}

const models = wiredModels();
if (models.length === 0) {
  console.error('no wired models found — is this the repo root?');
  process.exit(1);
}

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
page.on('pageerror', (e) => console.error('  [page]', String(e).slice(0, 160)));

const QUERY = `models=${models.join(',')}${PIPELINE ? '&pipeline=1' : ''}`;
await page.goto(`${BASE}/?${QUERY}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1500);
await page.evaluate((qs) => {
  history.replaceState(null, '', `/?${qs}`);
  document.body.innerHTML = '<div id="app"></div>';
  const s = document.createElement('script');
  s.type = 'module';
  s.src = '/tools/skinbleed/main.ts';
  document.body.appendChild(s);
}, QUERY);

await page.waitForFunction('window.__BLEED_READY === true', null, { timeout: 600000 });
const reports = await page.evaluate(() => window.__BLEED);
await browser.close();

const bad = reports.filter((r) => !r.error && r.bleeding > TOLERANCE).sort((a, b) => b.bleeding - a.bleeding);
// A model with NO SKIN has no weights to be wrong. BANNON.glb is the rigid
// 15-piece action-figure build and the game binds BANNON_rigged.glb instead;
// filing it as "unreadable" makes a correct state look like a failure.
const unskinned = reports.filter((r) => r.error === 'no skinned mesh');
const errored = reports.filter((r) => r.error && r.error !== 'no skinned mesh');

console.log(`models audited: ${reports.length}   (${PIPELINE ? 'AFTER the pipeline repair' : 'RAW asset'})`);
console.log('MODEL'.padEnd(30) + 'BLEEDING'.padStart(10) + 'OF'.padStart(10) + 'WORST SPAN'.padStart(12));
for (const r of bad.slice(0, 20)) {
  console.log(
    r.model.padEnd(30) +
    String(r.bleeding).padStart(10) +
    String(r.verts).padStart(10) +
    `${r.worstSpan} hops`.padStart(12),
  );
  for (const p of r.pairs.slice(0, 3)) {
    console.log(`    ${p.a.replace('mixamorig', '')} ~ ${p.b.replace('mixamorig', '')}`.padEnd(48) +
      `${p.hops} hops, ${p.verts} verts, up to ${p.weight.toFixed(2)} weight`);
  }
}
if (errored.length) {
  console.log(`\ncould not read ${errored.length}:`);
  for (const r of errored.slice(0, 6)) console.log(`  ${r.model}: ${r.error}`);
}
const clean = reports.length - bad.length - errored.length - unskinned.length;
console.log(
  `\nCLEAN ${clean}   BLEEDING ${bad.length}   UNSKINNED ${unskinned.length}   UNREADABLE ${errored.length}`,
);
if (unskinned.length) console.log(`  no skin (nothing to be wrong): ${unskinned.map((r) => r.model).join(', ')}`);

if (GATE && (bad.length > 0 || errored.length > 0)) {
  console.error('\nGATE FAILED — a wired model has weights spanning the body.');
  process.exit(1);
}
