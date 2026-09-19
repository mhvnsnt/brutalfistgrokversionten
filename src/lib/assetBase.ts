/**
 * RESOLVE ASSET URLS AGAINST THE DEPLOY BASE.
 *
 * THE BUG THIS FIXES, reported from the live build: every model, texture,
 * portrait and audio file 404'd on GitHub Pages —
 *   `https://mhvnsnt.github.io/models/BANNON_rigged.glb` (404)
 * instead of
 *   `https://mhvnsnt.github.io/brutalfistgrokversionten/models/...`
 *
 * WHY. Vite rewrites absolute URLs it can SEE — in index.html, in CSS, in
 * imported asset references. It cannot rewrite a string the code builds at
 * RUNTIME, and this codebase has 71 of those: '/models/…', '/portraits/…',
 * '/audio/…', '/motion/…'. At a domain root they were correct by accident.
 * Under a subdirectory deploy every one of them points at the wrong origin
 * path.
 *
 * THE FIX IS ONE RESOLVER, INSTALLED ONCE, rather than 71 edited call sites —
 * because a call site added tomorrow would silently reintroduce the bug, and a
 * resolver catches it.
 *
 *   - `assetUrl()` for code that wants to be explicit.
 *   - `installAssetBase()` patches three.js's loading manager (which covers
 *     every GLB, GLTF and texture, including drei's useGLTF) and `fetch`
 *     (which covers the JSON manifests and motion clips).
 *
 * IT ONLY TOUCHES KNOWN ASSET ROOTS. A URL that is not one of ours is passed
 * through untouched, so nothing else in the app can be affected by this.
 */

/** The roots this app serves its own assets from. */
export const ASSET_ROOTS = ['models', 'motion', 'portraits', 'audio', 'stages', '__grok'] as const;

const ROOT_RE = new RegExp(`^/(?:${ASSET_ROOTS.join('|')})/`);

/** Vite's deploy base: '/' at a domain root, '/<repo>/' on project Pages. */
export function assetBase(): string {
  const base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
  return base.endsWith('/') ? base : `${base}/`;
}

/**
 * Prefix an app-absolute asset path with the deploy base.
 * Anything already absolute (http, data:, blob:) or not an asset root is
 * returned unchanged.
 */
export function assetUrl(path: string): string {
  if (typeof path !== 'string' || !path) return path;
  if (/^[a-z]+:/i.test(path) || path.startsWith('//')) return path;
  const base = assetBase();
  if (base === '/') return path;
  if (path.startsWith(base)) return path; // already resolved
  if (!ROOT_RE.test(path)) return path;
  return base + path.slice(1);
}

let installed = false;

/**
 * Install the resolver globally. Idempotent, and a no-op when the app is
 * served from a domain root — where these paths were already correct, so
 * there is nothing to rewrite and no behaviour to change.
 */
export function installAssetBase(three?: { DefaultLoadingManager?: { setURLModifier?: (fn: (u: string) => string) => void } }): boolean {
  if (installed) return true;
  if (assetBase() === '/') return false;
  installed = true;

  // Covers every three.js load: GLTFLoader, TextureLoader, drei's useGLTF.
  try {
    three?.DefaultLoadingManager?.setURLModifier?.((url: string) => assetUrl(url));
  } catch {
    /* a loader that refuses a modifier must not break boot */
  }

  // Covers the JSON manifests and motion clips, which go through fetch.
  try {
    const original = globalThis.fetch?.bind(globalThis);
    if (original) {
      globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
        if (typeof input === 'string') return original(assetUrl(input), init);
        if (input instanceof Request && input.url) {
          // Only rebuild the Request when the URL actually changes.
          const u = new URL(input.url, globalThis.location?.href ?? 'http://localhost');
          const fixed = assetUrl(u.pathname) + u.search;
          if (fixed !== u.pathname + u.search) return original(new Request(fixed, input), init);
        }
        return original(input as RequestInfo, init);
      }) as typeof fetch;
    }
  } catch {
    /* leave fetch alone rather than break the app */
  }
  return true;
}
