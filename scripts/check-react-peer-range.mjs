#!/usr/bin/env node
/**
 * REACT CANNOT DRIFT PAST WHAT @react-three/fiber ACCEPTS.
 *
 * Found in Grok's rocket-update branch, and the report was accurate. React
 * 19.3.0 is published. Our range was `^19.2.0`, which admits it.
 * @react-three/fiber@9.7.0 declares `react: ">=19 <19.3"`. Reproduced here:
 *
 *   npm install react@19.3.0 --dry-run
 *   npm warn Could not resolve dependency:
 *   npm warn peer react@">=19 <19.3" from @react-three/fiber@9.7.0
 *
 * The lockfile pins 19.2.8, so the build works today and breaks the moment
 * anyone installs without the lock, runs `npm update`, or bumps React.
 *
 * THE FIX IS A CONSTRAINT, NOT AN OVERRIDE. rocket-update solved it with
 * `overrides: { "@react-three/fiber": { react: "^19.0.0" } }`, which tells npm
 * to ignore what fiber's own author says it supports. That ships the entire 3D
 * renderer against a React it excluded, and the failure lands in the fighting
 * arena instead of at install time. Narrowing OUR range keeps the constraint
 * honest: the resolver can never pick a React fiber rejects, and the day fiber
 * widens its peer range this gate says so.
 *
 * Usage: node scripts/check-react-peer-range.mjs
 */
import { readFileSync } from 'node:fs';
import { versionsOursAdmitsTheirsRejects } from './react-peer-range.mjs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
/** Packages whose React peer range we must stay inside. */
const GUARDED = ['@react-three/fiber'];

let failed = 0;
let checked = 0;
for (const name of GUARDED) {
  let peer;
  try {
    peer = JSON.parse(readFileSync(`node_modules/${name}/package.json`, 'utf8')).peerDependencies ?? {};
  } catch {
    console.log(`  SKIP  ${name} is not installed`);
    continue;
  }
  for (const dep of ['react', 'react-dom']) {
    const theirs = peer[dep];
    const ours = pkg.dependencies?.[dep] ?? pkg.devDependencies?.[dep];
    if (!theirs || !ours) continue;
    checked++;
    const bad = versionsOursAdmitsTheirsRejects(ours, theirs);
    console.log(`  ${bad.length ? 'FAIL ' : 'OK   '} ${dep} ${ours}  must stay inside ${name}'s ${theirs}`);
    if (bad.length) {
      failed++;
      console.log(`         our range admits ${dep}@${bad.slice(0, 4).join(', ')}${bad.length > 4 ? ` and ${bad.length - 4} more` : ''}, which ${name} excludes`);
    }
  }
}
if (!checked) {
  console.log('\n  Nothing to check — no guarded package is installed.');
} else if (failed) {
  console.error(`\n  ${failed} range(s) can drift past a peer constraint. Narrow the range in package.json —`);
  console.error('  do NOT add an override telling npm to ignore what the package says it supports.');
  process.exitCode = 1;
} else {
  console.log('\n  React stays inside every guarded peer range.');
}
