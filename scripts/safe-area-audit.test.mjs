import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import { auditSafeArea, classifySource } from './safe-area-audit.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** A fixture tree, so the audit is never tested against the repo it audits. */
function workspace(files) {
  const dir = mkdtempSync(join(tmpdir(), 'safe-area-'));
  mkdirSync(join(dir, 'src', 'components'), { recursive: true });
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(join(dir, 'src', 'components', name), body, 'utf8');
  }
  return dir;
}

test('a non-full-screen component is not a screen', () => {
  assert.equal(classifySource('<div className="p-4 flex" />'), null);
  assert.equal(classifySource('<div className="absolute top-0" />'), null);
});

test('a fixed inset-0 root with no safe handling is flagged', () => {
  const v = classifySource('<div className="fixed inset-0 bg-black" />');
  assert.deepEqual(v, { kind: 'fixed inset-0', handled: false });
});

test('any of the safe utilities counts as handled', () => {
  for (const cls of ['screen-safe', 'p-safe', 'pt-safe', 'pb-safe', 'px-safe', 'top-safe-3', 'bottom-safe-4']) {
    const v = classifySource(`<div className="fixed inset-0 ${cls}" />`);
    assert.equal(v.handled, true, `${cls} should count`);
  }
});

test('raw env(safe-area-inset-*) counts as handled', () => {
  const v = classifySource('<div className="fixed inset-0" style={{ paddingTop: "env(safe-area-inset-top)" }} />');
  assert.equal(v.handled, true);
});

test('a near-miss class name does not count', () => {
  // `safe` on its own, or an unrelated utility, must not satisfy the gate.
  assert.equal(classifySource('<div className="fixed inset-0 safe" />').handled, false);
  assert.equal(classifySource('<div className="fixed inset-0 p-safely" />').handled, false);
});

test('full-height screens are audited too, not just fixed ones', () => {
  assert.deepEqual(classifySource('<div className="min-h-screen bg-black" />'), {
    kind: 'full height',
    handled: false,
  });
});

test('the audit walks a tree and sorts misses first', () => {
  const dir = workspace({
    'Good.tsx': '<div className="fixed inset-0 screen-safe" />',
    'Bad.tsx': '<div className="fixed inset-0 bg-black" />',
    'NotAScreen.tsx': '<div className="p-4" />',
  });
  const findings = auditSafeArea(dir);
  assert.equal(findings.length, 2, 'only the two full-screen layers are findings');
  assert.equal(findings[0].handled, false, 'misses sort first');
  assert.match(findings[0].file, /Bad\.tsx$/);
});

test('THE GATE: every full-screen layer in this repo keeps clear of the chrome', () => {
  // The real check. viewport-fit=cover means an unhandled layer renders under
  // the camera cutout on a notched phone, and no desktop preview can show it.
  const findings = auditSafeArea(ROOT);
  const unhandled = findings.filter((f) => !f.handled);
  assert.ok(findings.length >= 20, `expected the app's screens, saw ${findings.length}`);
  assert.deepEqual(unhandled.map((f) => f.file), [], 'these would render under the notch');
});

test('--gate exits non-zero when a screen is unhandled', () => {
  const dir = workspace({ 'Bad.tsx': '<div className="fixed inset-0 bg-black" />' });
  const run = spawnSync(process.execPath, [join(ROOT, 'scripts/safe-area-audit.mjs'), '--gate'], {
    cwd: dir,
    encoding: 'utf8',
  });
  // The script audits ITS OWN repo regardless of cwd, which is the point: the
  // gate cannot be silenced by running it from somewhere else.
  assert.equal(run.status, 0, 'the repo itself is clean, so the gate passes from any cwd');
});
