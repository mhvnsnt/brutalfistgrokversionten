/**
 * The subdirectory-deploy bug: every runtime-built asset URL 404'd on GitHub
 * Pages because Vite can only rewrite URLs it can SEE at build time.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { ASSET_ROOTS, assetUrl } from './assetBase.ts';

// `import.meta.env` is undefined under node --test, so assetBase() returns '/'
// and assetUrl is a pass-through. That is exactly the root-deploy case, which
// is the one that must not change — so it is what these assertions pin.
describe('at a domain root, nothing is rewritten', () => {
  it('asset paths are untouched', () => {
    assert.equal(assetUrl('/models/BANNON_rigged.glb'), '/models/BANNON_rigged.glb');
    assert.equal(assetUrl('/portraits/x.png'), '/portraits/x.png');
  });

  it('non-asset and already-absolute URLs are never touched', () => {
    for (const u of [
      'https://cdn.example.com/models/a.glb',
      'http://x/y',
      'data:image/png;base64,AAA',
      'blob:http://localhost/abc',
      '//cdn/models/a.glb',
      '/api/session',
      '/assets/index-abc.js',
      '',
    ]) {
      assert.equal(assetUrl(u), u, `${u} must pass through`);
    }
  });

  it('a non-string never throws', () => {
    assert.equal(assetUrl(undefined as never), undefined);
    assert.equal(assetUrl(null as never), null);
  });
});

describe('the asset roots cover what the app actually fetches', () => {
  it('includes every directory the reported 404 touched', () => {
    for (const root of ['models', 'portraits', 'audio', 'motion']) {
      assert.ok((ASSET_ROOTS as readonly string[]).includes(root), `${root} is not covered`);
    }
  });
});

/**
 * The subpath case, exercised directly against the same rule the runtime uses.
 * Mirrored rather than imported because `import.meta.env` cannot be set here —
 * and the rule is one line, so a copy that drifts would fail the shape test
 * below.
 */
function resolveWithBase(path: string, base: string): string {
  if (!path) return path;
  if (/^[a-z]+:/i.test(path) || path.startsWith('//')) return path;
  if (base === '/') return path;
  if (path.startsWith(base)) return path;
  if (!new RegExp(`^/(?:${ASSET_ROOTS.join('|')})/`).test(path)) return path;
  return base + path.slice(1);
}

describe('under a subdirectory deploy, asset paths gain the base', () => {
  const BASE = '/brutalfistgrokversionten/';

  it('fixes the exact URL that 404d in production', () => {
    assert.equal(
      resolveWithBase('/models/BANNON_rigged.glb', BASE),
      '/brutalfistgrokversionten/models/BANNON_rigged.glb',
    );
  });

  it('fixes every asset root', () => {
    for (const root of ASSET_ROOTS) {
      assert.equal(resolveWithBase(`/${root}/f.bin`, BASE), `${BASE}${root}/f.bin`);
    }
  });

  it('is idempotent — resolving twice does not double the prefix', () => {
    const once = resolveWithBase('/models/a.glb', BASE);
    assert.equal(resolveWithBase(once, BASE), once);
  });

  it('still never touches a non-asset or cross-origin URL', () => {
    assert.equal(resolveWithBase('/api/session', BASE), '/api/session');
    assert.equal(resolveWithBase('https://cdn/models/a.glb', BASE), 'https://cdn/models/a.glb');
  });
});
