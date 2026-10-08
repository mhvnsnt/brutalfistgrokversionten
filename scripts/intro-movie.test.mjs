/**
 * Intro FMV gate, picked up by the existing `node --test 'scripts/**\/*.test.mjs'`
 * glob so package.json's test line did not need touching.
 *
 *  1. runs src/lib/introMovie.test.ts (skip / ended / fallback logic) under
 *     --experimental-strip-types, exactly like the TS tests in `npm test`;
 *  2. public/intro/intro.json matches the bytes on disk (file, sha256, size);
 *  3. the service worker never handles (so never caches) the intro video.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const INTRO = join(ROOT, 'public', 'intro');

describe('intro FMV', () => {
  it('logic tests pass (src/lib/introMovie.test.ts)', () => {
    const r = spawnSync(process.execPath, [
      '--experimental-strip-types', '--no-warnings',
      '--import', './scripts/register-ts-resolve.mjs',
      '--test', 'src/lib/introMovie.test.ts',
    ], { cwd: ROOT, encoding: 'utf8' });
    assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
  });

  it('manifest matches the shipped files', () => {
    const manifestPath = join(INTRO, 'intro.json');
    if (!existsSync(manifestPath)) return; // no intro shipped: the app just skips it
    const m = JSON.parse(readFileSync(manifestPath, 'utf8'));
    assert.equal(typeof m.duration, 'number');
    assert.ok(Array.isArray(m.sources) && m.sources.length > 0);
    assert.equal(m.sources[0].type, 'video/mp4', 'H.264 mp4 first, WebM fallback after');
    assert.equal(m.sha256, m.sources.find((s) => s.file === m.file)?.sha256);
    for (const s of m.sources) {
      const p = join(INTRO, s.file);
      assert.ok(existsSync(p), `${s.file} listed but missing`);
      assert.equal(statSync(p).size, s.bytes, `${s.file} size — rerun: node scripts/intro-movie.mjs manifest`);
      const sha = createHash('sha256').update(readFileSync(p)).digest('hex');
      assert.equal(sha, s.sha256, `${s.file} sha256 — rerun: node scripts/intro-movie.mjs manifest`);
    }
    if (m.placeholder) {
      const total = m.sources.reduce((n, s) => n + s.bytes, 0);
      assert.ok(total < 3.3e6, `placeholder should stay small, is ${total} bytes`);
    }
  });

  it('service worker does not handle the intro video, but still handles other media', () => {
    const listeners = {};
    const self = {
      location: new URL('https://mhvnsnt.github.io/brutalfistgrokversionten/sw.js'),
      addEventListener: (t, fn) => { listeners[t] = fn; },
      skipWaiting: () => {},
      clients: { claim: () => {} },
    };
    vm.runInNewContext(readFileSync(join(ROOT, 'public', 'sw.js'), 'utf8'), { self, caches: { open: async () => ({ match: async () => undefined, put: async () => {} }), match: async () => undefined }, fetch: async () => ({ ok: true, clone() { return this; } }), URL, Request: class {}, console });
    const hit = (path) => {
      let responded = false;
      listeners.fetch({
        request: { method: 'GET', url: `https://mhvnsnt.github.io${path}`, mode: 'no-cors', headers: { has: () => false } },
        respondWith: (p) => { responded = true; Promise.resolve(p).catch(() => {}); },
      });
      return responded;
    };
    assert.equal(hit('/brutalfistgrokversionten/intro/intro.mp4'), false);
    assert.equal(hit('/brutalfistgrokversionten/intro/intro.webm'), false);
    assert.equal(hit('/brutalfistgrokversionten/title/title.mp4'), true, 'existing title rules unchanged');
    assert.equal(hit('/brutalfistgrokversionten/intro/intro.json'), true, 'manifest keeps the normal network-first rule');
  });
});
