// `.ts` extensions on purpose — the repo's runner resolves them literally.
import { assetUrl } from '../../lib/assetBase.ts';

/**
 * GET THE ASSETS ON THE DEVICE BEFORE THEY ARE NEEDED.
 *
 * Owner: "all the models should already be preloaded before I get onto the
 * character select screen or the fight ... the models take forever to appear
 * during the select screen and during the fight."
 *
 * MEASURED: nothing warmed anything. The roster is 55 playable GLBs totalling
 * 45.4 MB, and the first request for one happened when a match started —
 * the worst possible moment, with the player watching an empty stage while a
 * multi-megabyte model downloads.
 *
 * WHAT THIS DOES AND DOES NOT DO. It FETCHES, so the bytes land in the HTTP
 * cache and the service worker's cache-first store; it does not parse GLTF or
 * build scenes. Parsing is per-fighter work the pipeline already does, and
 * doing it here for 55 models would cost far more memory than it saves. On a
 * phone the expensive part is the network, and that is what this removes.
 *
 * IT IS BACKGROUND WORK AND BEHAVES LIKE IT: a small concurrency so the title
 * screen's own video still gets bandwidth, and every failure is swallowed —
 * a warm that fails must leave the game exactly as it was.
 */
export interface WarmupProgress {
  done: number;
  total: number;
  /** The last asset that finished, for a status line. */
  label: string;
}

export interface WarmupOptions {
  /** How many requests at once. Low on purpose: this is background work. */
  concurrency?: number;
  onProgress?: (p: WarmupProgress) => void;
  signal?: AbortSignal;
}

/** Fetch one URL into the cache, and never throw. */
async function warmOne(url: string, signal?: AbortSignal): Promise<boolean> {
  try {
    const res = await fetch(assetUrl(url), { signal, cache: 'force-cache' });
    if (!res.ok) return false;
    // The body must be drained, or the connection is held open and the
    // service worker never sees a complete response to cache.
    await res.arrayBuffer();
    return true;
  } catch {
    return false;
  }
}

/**
 * Warm a list of URLs, in order, with a bounded number in flight.
 *
 * Order matters: the caller puts what is needed soonest first, so an
 * interrupted warm has still done the most useful part.
 */
export async function warmAssets(
  urls: readonly string[],
  { concurrency = 3, onProgress, signal }: WarmupOptions = {},
): Promise<{ warmed: number; failed: number }> {
  const queue = [...urls];
  const total = queue.length;
  let done = 0;
  let warmed = 0;
  let failed = 0;

  const worker = async () => {
    for (;;) {
      if (signal?.aborted) return;
      const url = queue.shift();
      if (!url) return;
      const ok = await warmOne(url, signal);
      done++;
      if (ok) warmed++;
      else failed++;
      onProgress?.({ done, total, label: url.slice(url.lastIndexOf('/') + 1) });
    }
  };

  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
  return { warmed, failed };
}

let started = false;

/**
 * Start the warm once per session, from the title screen.
 *
 * Deliberately fire-and-forget: nothing waits on it, and the player can walk
 * into a match mid-warm — the worst case then is the old behaviour, for the
 * one model that had not landed yet.
 */
export function startAssetWarmup(urls: readonly string[], options: WarmupOptions = {}): void {
  if (started || urls.length === 0) return;
  started = true;
  const t0 = Date.now();
  void warmAssets(urls, options).then(({ warmed, failed }) => {
    console.log(
      `[AssetWarmup] ${warmed}/${urls.length} asset(s) resident in ${((Date.now() - t0) / 1000).toFixed(1)}s` +
        (failed ? `, ${failed} failed` : ''),
    );
  });
}

/** For tests: forget that a warm has run. */
export function resetAssetWarmupForTest(): void {
  started = false;
}
