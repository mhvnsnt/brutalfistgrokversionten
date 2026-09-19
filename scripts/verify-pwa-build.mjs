#!/usr/bin/env node
/**
 * VERIFY A BUILT BUNDLE IS ACTUALLY INSTALLABLE.
 *
 * "Add to Home Screen" is not the same as installing an app. Android only
 * offers a real install when ALL of these hold, and every one of them is easy
 * to break silently in a build:
 *
 *   - a reachable manifest, linked from the HTML
 *   - `display` standalone (or fullscreen/minimal-ui)
 *   - an icon of at least 192x192 AND one of at least 512x512, both of which
 *     must EXIST on disk at the path the manifest gives
 *   - a registered service worker with a fetch handler
 *
 * The repo shipped one 180x180 icon and no service worker, so the app could
 * only ever be bookmarked. This gate is what stops that coming back.
 *
 * It also checks the thing a subpath deploy gets wrong: every manifest path is
 * resolved against the MANIFEST's own URL, not the page's, so an icon listed
 * as `__grok/icon.png` inside `/__grok/manifest.webmanifest` resolves to
 * `/__grok/__grok/icon.png` and silently disappears.
 *
 * USAGE: node scripts/verify-pwa-build.mjs [distDir]
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export function findManifestHref(html) {
  const m = html.match(/<link[^>]+rel=["']manifest["'][^>]*>/i);
  if (!m) return null;
  const href = m[0].match(/href=["']([^"']+)["']/i);
  return href ? href[1] : null;
}

/** Resolve a manifest-relative path the way a browser does. */
export function resolveFromManifest(manifestPath, src) {
  return resolve(dirname(manifestPath), src);
}

export function checkManifest(manifest) {
  const problems = [];
  if (!['standalone', 'fullscreen', 'minimal-ui'].includes(manifest.display)) {
    problems.push(`display is "${manifest.display}" — must be standalone, fullscreen or minimal-ui`);
  }
  if (!manifest.name && !manifest.short_name) problems.push('no name or short_name');
  if (!manifest.start_url) problems.push('no start_url');
  const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
  const px = (i) => Math.max(0, ...String(i.sizes ?? '').split(/\s+/).map((s) => parseInt(s, 10) || 0));
  if (!icons.some((i) => px(i) >= 192)) problems.push('no icon of at least 192x192');
  if (!icons.some((i) => px(i) >= 512)) problems.push('no icon of at least 512x512');
  if (!icons.some((i) => String(i.purpose ?? '').includes('maskable'))) {
    problems.push('no maskable icon — launchers will crop the artwork');
  }
  return problems;
}

function main() {
  const dist = resolve(process.argv[2] ?? 'dist');
  const problems = [];

  const indexPath = join(dist, 'index.html');
  if (!existsSync(indexPath)) {
    console.error(`[pwa-verify] no index.html in ${dist}`);
    process.exitCode = 1;
    return;
  }
  const html = readFileSync(indexPath, 'utf8');

  const href = findManifestHref(html);
  if (!href) problems.push('index.html has no <link rel="manifest">');

  let manifestPath = '';
  if (href) {
    // Strip any base prefix: on disk the file is relative to dist.
    const rel = href.replace(/^https?:\/\/[^/]+/, '').replace(/^\/+/, '');
    const candidates = [join(dist, rel), join(dist, rel.split('/').slice(1).join('/'))];
    manifestPath = candidates.find((p) => existsSync(p)) ?? '';
    if (!manifestPath) problems.push(`manifest "${href}" is not in the bundle`);
  }

  if (manifestPath) {
    let manifest;
    try {
      manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    } catch (e) {
      problems.push(`manifest is not valid JSON: ${e.message}`);
    }
    if (manifest) {
      problems.push(...checkManifest(manifest));
      for (const icon of manifest.icons ?? []) {
        const onDisk = resolveFromManifest(manifestPath, icon.src);
        if (!existsSync(onDisk)) {
          problems.push(`icon "${icon.src}" resolves to ${onDisk.replace(dist, '')} and is not there`);
        } else if (statSync(onDisk).size === 0) {
          problems.push(`icon "${icon.src}" is empty`);
        }
      }
    }
  }

  const swPath = join(dist, 'sw.js');
  if (!existsSync(swPath)) problems.push('no sw.js in the bundle — the app cannot be installed');
  else {
    const sw = readFileSync(swPath, 'utf8');
    // A worker with no fetch handler does not count for installability.
    if (!/addEventListener\(\s*['"]fetch['"]/.test(sw)) {
      problems.push('sw.js has no fetch handler — Android will not offer an install');
    }
  }

  // The bundle must actually register it, or the worker is dead weight.
  const assets = existsSync(join(dist, 'assets'))
    ? readdirSync(join(dist, 'assets')).filter((f) => f.endsWith('.js'))
    : [];
  const registers = assets.some((f) =>
    readFileSync(join(dist, 'assets', f), 'utf8').includes('serviceWorker'),
  );
  if (!registers) problems.push('no bundled code references serviceWorker — nothing registers it');

  // A worker shipped with the placeholder still in it has a cache key that
  // never changes, which is exactly the bug that stopped the app updating.
  const swSrc = existsSync(join(dist, 'sw.js')) ? readFileSync(join(dist, 'sw.js'), 'utf8') : '';
  if (!swSrc) problems.push('no sw.js in the build — the app cannot be installed');
  else if (swSrc.includes('__BF_SW_VERSION__')) {
    problems.push('sw.js still carries __BF_SW_VERSION__ — run scripts/stamp-sw-version.mjs');
  }

  if (problems.length) {
    console.error(`[pwa-verify] NOT INSTALLABLE — ${problems.length} problem(s):`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exitCode = 1;
    return;
  }
  console.log('[pwa-verify] installable: manifest linked, 192 + 512 + maskable icons present, service worker registered with a fetch handler');
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) main();
