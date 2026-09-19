/**
 * Register the service worker that makes Brutal Fist installable and makes the
 * second launch fast.
 *
 * WHY THE GUARDS ARE WHAT THEY ARE — each one is a way this goes wrong:
 *
 *   NOT IN DEV. A caching worker in front of a dev server serves yesterday's
 *   bundle and looks like the game ignoring your edits.
 *
 *   NOT UNDER ROCKET'S EMBEDDED PREVIEW, AND NOT IN AN IFRAME. That preview is
 *   an iframe over a proxy; a worker there would cache the preview shell and
 *   fight the host.
 *
 *   NOT ON file://. `navigator.serviceWorker` is undefined there, and the APK
 *   build runs from file:// — touching the property is enough to throw.
 *
 *   SCOPE-RELATIVE URL. `./sw.js` resolves against the page, so the same code
 *   works at a domain root and under a GitHub Pages subdirectory. A leading
 *   slash would register at the origin root and silently control nothing on a
 *   project-pages deploy.
 *
 * Failure is never fatal: a game that will not start because a cache layer
 * failed is strictly worse than a game with no cache layer.
 */

export interface RegisterResult {
  registered: boolean;
  reason?: string;
}

export function serviceWorkerSupported(): boolean {
  try {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
    if (!('serviceWorker' in navigator)) return false;
    // A worker needs a secure context; localhost counts as one.
    return window.isSecureContext === true;
  } catch {
    return false;
  }
}

/** Environments where a caching worker would do harm rather than good. */
export function shouldRegister(env: {
  dev?: boolean;
  rocketPreview?: boolean;
  protocol?: string;
  inIframe?: boolean;
}): RegisterResult {
  if (env.dev) return { registered: false, reason: 'dev server — a cache would serve stale bundles' };
  if (env.protocol === 'file:') return { registered: false, reason: 'file:// has no service workers' };
  if (env.rocketPreview) return { registered: false, reason: 'embedded preview owns its own shell' };
  if (env.inIframe) return { registered: false, reason: 'embedded in an iframe' };
  return { registered: true };
}

export async function registerServiceWorker(): Promise<RegisterResult> {
  const dev = Boolean((import.meta as { env?: { DEV?: boolean } }).env?.DEV);
  let inIframe = false;
  try { inIframe = window.self !== window.top; } catch { inIframe = true; }

  const verdict = shouldRegister({
    dev,
    rocketPreview: Boolean((window as { __ROCKET_PREVIEW__?: boolean }).__ROCKET_PREVIEW__),
    protocol: window.location?.protocol,
    inIframe,
  });
  if (!verdict.registered) return verdict;
  if (!serviceWorkerSupported()) return { registered: false, reason: 'no service worker support' };

  try {
    const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
    // A new worker waiting behind an old one means the player keeps getting the
    // previous build until every tab closes. Take over as soon as it is ready.
    reg.addEventListener('updatefound', () => {
      const next = reg.installing;
      if (!next) return;
      next.addEventListener('statechange', () => {
        if (next.state === 'installed' && navigator.serviceWorker.controller) {
          next.postMessage('SKIP_WAITING');
        }
      });
    });
    return { registered: true };
  } catch (err) {
    // Never fatal. The game runs fine with no cache layer.
    console.warn('[pwa] service worker registration failed:', err);
    return { registered: false, reason: String(err) };
  }
}
