// `.ts` extensions on purpose — the repo's runner resolves them literally.
import { BANNON_GLB_PLAYABLE_MODELS } from '../../data/bannonGlbRoster.ts';
import { resolveGlbUrl } from '../../data/bannonGlbUrl.ts';

/**
 * WHAT TO WARM, AND IN WHAT ORDER.
 *
 * Order is the whole design. A warm can be interrupted at any moment — the
 * player presses START — so the most useful thing has to be first:
 *
 *   1. THE BAKED MOTION SET. Every fighter needs it, it is one index plus
 *      366 small files, and without it a fighter stands still.
 *   2. THE SELECT-SCREEN ART. Small, and it is the very next thing on screen.
 *   3. THE MODELS. 55 GLBs, 45.4 MB — the big one, and the reason a match
 *      used to start with an empty stage.
 */
export function warmupUrls(favourites: readonly string[] = []): string[] {
  const urls: string[] = ['/motion/baked/index.json'];

  const models = [...new Set(BANNON_GLB_PLAYABLE_MODELS.map((m) => m.model))];
  // A fighter the player has already picked is worth having before the rest.
  const first = models.filter((m) => favourites.includes(m));
  const rest = models.filter((m) => !favourites.includes(m));

  for (const m of [...first, ...rest]) urls.push(resolveGlbUrl(m));
  return urls;
}
