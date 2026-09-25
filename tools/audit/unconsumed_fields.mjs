#!/usr/bin/env node
/**
 * WHAT DID WE IMPORT AND THEN NEVER LOOK AT?
 *
 * Owner: "make universal fixes for any solutions so we have sturdy pipelines
 * robust going forward."
 *
 * THIS EXACT SHAPE OF BUG HAPPENED THREE TIMES IN ONE SESSION:
 *
 *   - The CC0 Quaternius animation library was fetched, unpacked, listed in a
 *     generated module, and contributed ZERO clips. A path filter required a
 *     literal backslash, so it matched nothing and reported no skips and no
 *     errors.
 *   - The Schwarzerblitz move graph carried authored per-frame root motion on
 *     127 of its 133 moves. No line of the engine read it, and displacement
 *     came from a hand-written table of five profiles instead.
 *   - Our own captures carried joint world positions in a `pose` block, which
 *     nothing had ever opened, so every clip arrived with its feet nailed down.
 *
 * All three are the same failure: an import SUCCEEDS, the data is present and
 * correct, and nothing downstream consumes it. Nobody notices, because there is
 * no error — the game simply does less than the data allows. A test suite
 * cannot catch this, because the code that would fail does not exist.
 *
 * SO COUNT THE CONSUMERS. For every field an imported record declares, look for
 * somewhere in src/ that reads it. A field with zero readers is either a gap
 * worth closing or a deliberate carry-through, and the difference has to be
 * WRITTEN DOWN rather than assumed — which is what the baseline is for.
 *
 * It is a REPORT, and `--gate` fails only on a field that is newly unread. An
 * import that adds unconsumed data is normal; one that does so silently is the
 * thing being prevented.
 *
 * IT UNDER-REPORTS, ON PURPOSE. A field is called read when anything anywhere
 * in src/ dereferences that NAME, so a generic name like `range` or `damage`
 * can be credited to unrelated code. That makes the error one-sided: a field it
 * LISTS is genuinely unread, a field it omits may still be. A gate that cries
 * wolf gets switched off, so the bias is toward silence — which is the right
 * trade for a guard whose whole job is to be believed when it does fire.
 *
 * Usage: node tools/audit/unconsumed_fields.mjs [--gate] [--update]
 */
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const BASELINE = 'tools/audit/unconsumed-baseline.json';

/** The record shapes worth auditing, and where their fields are declared. */
const SOURCES = [
  {
    id: 'schwarzerblitz-moves',
    file: 'src/generated/SchwarzerblitzMoveGraph.generated.ts',
    interfaces: ['SbMove', 'SbHitbox', 'SbLink'],
    note: 'mhvnsnt/SchwarzerblitzEngine moves.txt',
  },
];

/** Read `field: type;` names out of an interface declaration. */
function fieldsOf(text, name) {
  const start = text.indexOf(`export interface ${name}`);
  if (start < 0) return [];
  const open = text.indexOf('{', start);
  let depth = 0;
  let end = open;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') { depth--; if (!depth) { end = i; break; } }
  }
  const body = text.slice(open + 1, end);
  const out = [];
  for (const line of body.split('\n')) {
    const m = /^\s*\/?\*?\s*([A-Za-z_][A-Za-z0-9_]*)\??\s*:/.exec(line);
    if (m && !line.trim().startsWith('*') && !line.trim().startsWith('//')) out.push(m[1]);
  }
  return [...new Set(out)];
}

/** Every non-generated, non-test source file the engine actually runs. */
function engineText() {
  const chunks = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!/\.(ts|tsx)$/.test(entry.name)) continue;
      if (entry.name.includes('.test.')) continue;
      if (full.includes('src/generated/')) continue;
      chunks.push(readFileSync(full, 'utf8'));
    }
  };
  walk('src');
  return chunks.join('\n');
}

const haystack = engineText();

/** A field counts as read when something dereferences it by name. */
function isRead(field) {
  const patterns = [
    new RegExp(`\\.${field}\\b`),
    new RegExp(`\\b${field}\\s*:\\s*[A-Za-z_{[]`),
    new RegExp(`\\[['"\`]${field}['"\`]\\]`),
    new RegExp(`\\{[^}\\n]*\\b${field}\\b[^}\\n]*\\}\\s*=`),
  ];
  return patterns.some((re) => re.test(haystack));
}

const found = {};
const rows = [];
for (const src of SOURCES) {
  if (!existsSync(src.file)) continue;
  const text = readFileSync(src.file, 'utf8');
  const unread = [];
  for (const iface of src.interfaces) {
    for (const field of fieldsOf(text, iface)) {
      if (!isRead(field)) unread.push(`${iface}.${field}`);
    }
  }
  found[src.id] = unread.sort();
  rows.push({ ...src, unread });
}

const baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : {};
if (process.argv.includes('--update')) {
  writeFileSync(BASELINE, `${JSON.stringify({ unread: found }, null, 2)}\n`);
  console.log(`wrote ${BASELINE}`);
}

console.log('\nIMPORTED BUT NEVER READ\n');
let regressions = 0;
for (const r of rows) {
  const known = new Set(baseline.unread?.[r.id] ?? []);
  console.log(`  ${r.id}  (${r.note})`);
  if (!r.unread.length) { console.log('    everything this import declares is read somewhere.'); continue; }
  for (const f of r.unread) {
    const isNew = !known.has(f);
    if (isNew) regressions++;
    console.log(`    ${isNew ? 'NEW  ' : '     '}${f}`);
  }
}
console.log(`\n[unconsumed] ${rows.reduce((a, r) => a + r.unread.length, 0)} field(s) with no reader`
  + `${regressions ? `, ${regressions} of them NEW since the baseline` : ''}`);
if (regressions && process.argv.includes('--gate')) {
  console.error('\nAn import added data nothing reads. Either consume it, or record it in the baseline\n'
    + 'with `node tools/audit/unconsumed_fields.mjs --update` and say in the commit why it is carried.');
  process.exitCode = 1;
}
