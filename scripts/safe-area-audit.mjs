#!/usr/bin/env node
/**
 * MOBILE SAFE-AREA AUDIT — every full-screen layer must keep its content clear
 * of the camera cutout, the browser URL strip and the home-gesture bar.
 *
 * WHY THIS IS A GATE, NOT A STYLE NOTE
 *   index.html sets `viewport-fit=cover`. That is what lets the game paint edge
 *   to edge — and it means the viewport EXTENDS UNDER the cutouts. A layer that
 *   is `fixed inset-0` with no safe-area handling therefore puts its top row
 *   under the camera and its bottom row under the gesture bar ON EVERY NOTCHED
 *   PHONE. Measured when this was written: 22 of 27 full-screen screens had no
 *   safe-area handling at all.
 *
 *   `env(safe-area-inset-*)` resolves to 0 on desktop and on a phone with no
 *   cutout, so this costs nothing where it is not needed — and CANNOT be caught
 *   by looking at a desktop preview or a headless screenshot, because the
 *   browser reports no insets there either. A static gate is the only
 *   instrument that sees it.
 *
 * WHAT COUNTS AS HANDLED
 *   The file uses one of the safe utilities from src/styles.css (screen-safe /
 *   p-safe / pt-safe / pb-safe / px-safe / top-safe-N / bottom-safe-N), or it
 *   uses env(safe-area-inset-*) directly.
 *
 * USAGE
 *   node scripts/safe-area-audit.mjs            report
 *   node scripts/safe-area-audit.mjs --gate     exit 1 on any unhandled screen
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** A layer that covers the viewport, so its edges land on the phone's chrome. */
export const FULLSCREEN = /className=(?:"|\{`)[^"`]*\bfixed\s+inset-0\b/;
/** Non-fixed screens that still fill the viewport. */
export const FULLHEIGHT = /className=(?:"|\{`)[^"`]*\b(?:min-h-screen|h-screen|h-dvh|h-\[100dvh\])\b/;
export const SAFE_CLASS = /\b(?:screen-safe|p-safe|pt-safe|pb-safe|px-safe|top-safe-\d+|bottom-safe-\d+)\b/;
export const SAFE_ENV = /env\(\s*safe-area-inset-/;

/** Not screens: providers, hosts and preview plumbing. */
export const NOT_A_SCREEN = new Set(['preview-host-bridge.tsx']);

export function listTsxFiles(dir) {
  let out = [];
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const entry of entries) {
    if (entry === 'generated' || entry === 'node_modules') continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out = out.concat(listTsxFiles(p));
    else if (entry.endsWith('.tsx')) out.push(p);
  }
  return out;
}

/**
 * Classify one file. Pure: takes the source, returns the finding or null.
 * @param {string} source
 * @returns {{kind: 'fixed inset-0' | 'full height', handled: boolean} | null}
 */
export function classifySource(source) {
  const fullscreen = FULLSCREEN.test(source);
  const fullheight = FULLHEIGHT.test(source);
  if (!fullscreen && !fullheight) return null;
  return {
    kind: fullscreen ? 'fixed inset-0' : 'full height',
    handled: SAFE_CLASS.test(source) || SAFE_ENV.test(source),
  };
}

/**
 * Audit a source tree. `root` is explicit so a test can point at a fixture —
 * an audit that defaults to process.cwd() reads the repo itself as its fixture
 * and passes for the wrong reason.
 */
export function auditSafeArea(root) {
  const findings = [];
  for (const file of listTsxFiles(join(root, 'src'))) {
    const base = file.split(sep).pop();
    if (NOT_A_SCREEN.has(base)) continue;
    const verdict = classifySource(readFileSync(file, 'utf8'));
    if (!verdict) continue;
    findings.push({ file: relative(root, file), ...verdict });
  }
  findings.sort((a, b) => Number(a.handled) - Number(b.handled) || a.file.localeCompare(b.file));
  return findings;
}

function main() {
  const root = dirname(dirname(fileURLToPath(import.meta.url)));
  const findings = auditSafeArea(root);
  const unhandled = findings.filter((f) => !f.handled);

  for (const f of findings) console.log(`${f.handled ? 'ok  ' : 'MISS'}  ${f.kind.padEnd(14)}  ${f.file}`);
  console.log(
    `\n[safe-area] ${findings.length - unhandled.length}/${findings.length} full-screen layers keep clear of the phone's chrome`,
  );
  if (unhandled.length) {
    console.log(
      `[safe-area] ${unhandled.length} would render under the camera cutout or the gesture bar:\n` +
      unhandled.map((f) => `  - ${f.file}`).join('\n'),
    );
  }
  if (process.argv.includes('--gate') && unhandled.length) {
    console.error(`\n[safe-area] GATE FAILED — ${unhandled.length} unhandled full-screen layers`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) main();
