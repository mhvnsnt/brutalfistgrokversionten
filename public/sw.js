/**
 * BRUTAL FIST SERVICE WORKER
 *
 * WHY IT EXISTS
 *   1. INSTALLABILITY. Android will not offer "Install app" without a service
 *      worker that has a fetch handler, alongside a manifest carrying 192 and
 *      512 icons. The app had no service worker at all, so it could never be
 *      installed to a home screen — only bookmarked.
 *   2. THE SECOND LAUNCH. A fighting game is a multi-megabyte bundle plus GLB
 *      models. Re-downloading that on mobile data every time is why a match
 *      takes so long to start; cached, the second launch is local.
 *
 * THE CACHING RULES, and why each one is what it is:
 *   - NAVIGATIONS are network-first with a cache fallback. A game that will
 *     not update is worse than one that loads a second slower, and the
 *     fallback is what makes it work with no signal.
 *   - HASHED BUILD ASSETS (/assets/*) are cache-first and immutable. Vite puts
 *     a content hash in the filename, so a given URL can never change meaning.
 *   - MODELS, MOTION AND MEDIA are cache-first too — they are large, static,
 *     and the whole point of caching.
 *   - EVERYTHING ELSE is network-first. Anything dynamic stays correct.
 *
 * SCOPE-RELATIVE ON PURPOSE. The scope is wherever the worker is served from,
 * so the same file works at a domain root and under a GitHub Pages
 * subdirectory. Nothing here hardcodes a leading slash.
 */

/**
 * STAMPED AT BUILD TIME. This was a constant, and a constant is why the app
 * would not update: `activate` deletes every cache whose key does not start
 * with VERSION, so with a fixed VERSION no deploy ever purged anything and a
 * cache-first asset from the first install was kept forever.
 *
 * scripts/stamp-sw-version.mjs rewrites the placeholder with the commit's
 * short SHA during the Pages build. Left as-is in dev, where nothing is
 * cached long enough to matter.
 */
const VERSION = '__BF_SW_VERSION__';
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;

/** Resolved against the worker's own scope, so a subpath deploy still works. */
const SHELL = ['./', './index.html', './manifest.webmanifest', './favicon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(async (cache) => {
      // One bad URL must not fail the whole install, or the app silently never
      // becomes installable. Add them individually and tolerate misses.
      await Promise.all(SHELL.map((u) => cache.add(new Request(u, { cache: 'reload' })).catch(() => {})));
      await self.skipWaiting();
    }),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

/** Content-addressed: the URL itself changes when the bytes do, so never re-check. */
const IMMUTABLE = /\/assets\/[^/]+-[A-Za-z0-9_-]{6,}\.(js|css|woff2?|png|jpe?g|svg|webp)$/;

/** Long-lived, content-addressed or simply large and static. */
function isCacheFirst(url) {
  return (
    /\/assets\/[^/]+-[A-Za-z0-9_-]{6,}\.(js|css|woff2?|png|jpe?g|svg|webp)$/.test(url.pathname) ||
    /\.(glb|gltf|bin|ktx2|mp3|ogg|wav|jgz)$/.test(url.pathname) ||
    /\/(models|motion|portraits|title|__grok)\//.test(url.pathname)
  );
}

/**
 * Cache-first, but REVALIDATE IN THE BACKGROUND.
 *
 * Plain cache-first never looks again, which is correct for a content-hashed
 * bundle file and wrong for everything else this rule covers: a portrait, a
 * model or a motion clip lives at a STABLE path, so a re-exported one would
 * never reach a device that had already cached the old bytes. The viewer
 * still gets the instant cached answer; the next launch gets the new file.
 */
async function cacheFirst(request) {
  const cache = await caches.open(ASSET_CACHE);
  const hit = await cache.match(request);
  if (hit) {
    if (!IMMUTABLE.test(new URL(request.url).pathname)) {
      // Never awaited: revalidation must not delay the hit it is refreshing.
      fetch(request)
        .then((fresh) => {
          if (fresh && fresh.ok) return cache.put(request, fresh.clone());
          return undefined;
        })
        .catch(() => {});
    }
    return hit;
  }
  const response = await fetch(request);
  // Opaque responses are cached too: a cross-origin CDN asset is still worth
  // keeping, and an opaque hit is better than a second round trip.
  if (response && (response.ok || response.type === 'opaque')) {
    cache.put(request, response.clone()).catch(() => {});
  }
  return response;
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    // BYPASS THE BROWSER'S OWN HTTP CACHE for navigations. GitHub Pages
    // serves index.html with a max-age, so a plain fetch here can be answered
    // from the HTTP cache with the PREVIOUS build's HTML — network-first that
    // is not actually reaching the network. 'reload' is what makes the
    // navigation rule mean what it says.
    const response = await fetch(
      request.mode === 'navigate' ? new Request(request, { cache: 'reload' }) : request,
    );
    if (response && response.ok) cache.put(request, response.clone()).catch(() => {});
    return response;
  } catch (err) {
    const hit = await cache.match(request);
    if (hit) return hit;
    // A navigation with no signal and no exact match still gets the shell.
    if (request.mode === 'navigate') {
      const shell = await cache.match('./index.html') || await caches.match('./index.html');
      if (shell) return shell;
    }
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Only GET is cacheable, and a range request must reach the network or media
  // seeking breaks.
  if (request.method !== 'GET' || request.headers.has('range')) return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin && !isCacheFirst(url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, SHELL_CACHE));
    return;
  }
  event.respondWith(isCacheFirst(url) ? cacheFirst(request) : networkFirst(request, ASSET_CACHE));
});

/** Lets the page trigger an immediate update instead of waiting a navigation. */
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
