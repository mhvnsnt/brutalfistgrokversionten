import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import { checkManifest, findManifestHref, resolveFromManifest } from './verify-pwa-build.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = join(ROOT, 'scripts/verify-pwa-build.mjs');

const GOOD_MANIFEST = {
  name: 'Brutal Fist', start_url: '../', display: 'standalone',
  icons: [
    { src: 'icon-192.png', sizes: '192x192', purpose: 'any' },
    { src: 'icon-512.png', sizes: '512x512', purpose: 'any' },
    { src: 'icon-512-maskable.png', sizes: '512x512', purpose: 'maskable' },
  ],
};

test('finds a manifest link however it is quoted', () => {
  assert.equal(findManifestHref('<link rel="manifest" href="/m.webmanifest">'), '/m.webmanifest');
  assert.equal(findManifestHref("<link rel='manifest' href='/m.json'>"), '/m.json');
  assert.equal(findManifestHref('<link rel="icon" href="/f.svg">'), null);
});

test('manifest paths resolve against the MANIFEST, not the page', () => {
  // The subpath trap: `__grok/icon.png` inside `/__grok/manifest.webmanifest`
  // resolves to `/__grok/__grok/icon.png` and silently disappears.
  const m = '/site/__grok/manifest.webmanifest';
  assert.equal(resolveFromManifest(m, 'icon-192.png'), '/site/__grok/icon-192.png');
  assert.equal(resolveFromManifest(m, '__grok/icon-192.png'), '/site/__grok/__grok/icon-192.png');
  assert.equal(resolveFromManifest(m, '../index.html'), '/site/index.html');
});

test('a complete manifest passes', () => {
  assert.deepEqual(checkManifest(GOOD_MANIFEST), []);
});

test('an install-blocking manifest is rejected with the reason', () => {
  const browserTab = { ...GOOD_MANIFEST, display: 'browser' };
  assert.match(checkManifest(browserTab).join(' '), /display is "browser"/);

  const tooSmall = { ...GOOD_MANIFEST, icons: [{ src: 'i.png', sizes: '180x180' }] };
  const problems = checkManifest(tooSmall).join(' ');
  assert.match(problems, /192x192/);
  assert.match(problems, /512x512/);
  assert.match(problems, /maskable/);

  assert.match(checkManifest({ ...GOOD_MANIFEST, start_url: undefined }).join(' '), /start_url/);
});

test('the largest declared size wins when several are listed', () => {
  const multi = { ...GOOD_MANIFEST, icons: [{ src: 'i.png', sizes: '192x192 512x512', purpose: 'any maskable' }] };
  assert.deepEqual(checkManifest(multi), []);
});

/** A dist tree the gate can be pointed at. */
function bundle({ sw = true, fetchHandler = true, registers = true, icons = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'pwa-'));
  mkdirSync(join(dir, '__grok'), { recursive: true });
  mkdirSync(join(dir, 'assets'), { recursive: true });
  writeFileSync(join(dir, 'index.html'),
    '<html><head><link rel="manifest" href="/__grok/manifest.webmanifest"></head><body></body></html>');
  writeFileSync(join(dir, '__grok', 'manifest.webmanifest'), JSON.stringify(GOOD_MANIFEST));
  if (icons) for (const f of ['icon-192.png', 'icon-512.png', 'icon-512-maskable.png']) {
    writeFileSync(join(dir, '__grok', f), 'x');
  }
  if (sw) {
    writeFileSync(join(dir, 'sw.js'), fetchHandler ? "addEventListener('fetch', () => {});" : '// nothing');
  }
  writeFileSync(join(dir, 'assets', 'index-abc123.js'), registers ? 'navigator.serviceWorker.register()' : 'console.log(1)');
  return dir;
}

const run = (dir) => spawnSync(process.execPath, [SCRIPT, dir], { encoding: 'utf8' });

test('a complete bundle passes the gate', () => {
  const r = run(bundle());
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /installable/);
});

test('no service worker fails the gate', () => {
  const r = run(bundle({ sw: false }));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /no sw\.js/);
});

test('a service worker with no fetch handler fails the gate', () => {
  // This is the exact case Android silently refuses to install.
  const r = run(bundle({ fetchHandler: false }));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /no fetch handler/);
});

test('a worker nothing registers fails the gate', () => {
  const r = run(bundle({ registers: false }));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /nothing registers it/);
});

test('an icon listed but missing on disk fails the gate', () => {
  const r = run(bundle({ icons: false }));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /is not there/);
});

test('THE GATE: the repo\'s own shipped manifest is installable', () => {
  const manifest = JSON.parse(
    readFileSync(join(ROOT, 'public/__grok/manifest.webmanifest'), 'utf8'),
  );
  assert.deepEqual(checkManifest(manifest), []);
});
