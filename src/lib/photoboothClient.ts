/**
 * THE CLIENT'S DOOR TO THE IMAGE BOOTH, which may have no server behind it.
 *
 * Owner, from the deployed PWA: "ee.AsyncLocalStorage is not a constructor."
 *
 * REPRODUCED against the shipped bundle: opening PHOTO BOOTH replaced the whole
 * game with the error shell. PhotoBoothScreen imported `generateBoothArt`
 * directly, and that module builds a TanStack `createServerFn`, which drags
 * Nitro's Node internals into the browser chunk. `AsyncLocalStorage` does not
 * exist in a browser, so the module threw while being EVALUATED -- before any
 * of its code ran, and before anyone pressed a button.
 *
 * The static PWA build has no server at all, so that function could never have
 * worked there; it was pure crash surface. `__BF_STATIC_BUILD__` is a
 * compile-time constant, so in that build the import below is dead code and the
 * server module is never bundled. In the server build it is imported lazily and
 * behaves exactly as before.
 */
declare const __BF_STATIC_BUILD__: boolean;

/** Mirrors the server function's own call shape so only the import changes. */
export type BoothCall = {
  data: { prompt: string; imageBase64?: string; mode?: 'portrait' | 'stage' };
};

/** True when this build ships with a server to call. */
export const BOOTH_AVAILABLE: boolean =
  typeof __BF_STATIC_BUILD__ === 'undefined' ? true : !__BF_STATIC_BUILD__;

export async function generateBoothArt(call: BoothCall): Promise<{ ok: true; image: string } | { ok: false; error: string }> {
  if (!BOOTH_AVAILABLE) {
    return { ok: false, error: 'Image generation needs the server build — this one ships without it.' };
  }
  try {
    const mod = await import('./photobooth');
    return (await mod.generateBoothArt(call)) as { ok: true; image: string } | { ok: false; error: string };
  } catch (err) {
    // Never let the booth take the whole game down with it again.
    return { ok: false, error: err instanceof Error ? err.message : 'Image booth failed to load.' };
  }
}
