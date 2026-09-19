#!/usr/bin/env node
/**
 * Generate the PWA icon set from public/favicon.svg.
 *
 * WHY: Android will not offer "Install app" without a manifest icon of at
 * least 192x192 AND one of 512x512, plus a maskable variant so the launcher
 * can crop it to the device's icon shape without clipping artwork. The repo
 * shipped exactly one 180x180 icon, which satisfies iOS's apple-touch-icon and
 * nothing else — so the app was never installable on Android.
 *
 * MASKABLE NEEDS PADDING. A maskable icon is cropped to a circle on many
 * launchers, and the safe zone is the centre 80%. Rendering the same square
 * artwork edge to edge gets its corners shaved off, so the maskable variants
 * are drawn at 80% on a background-coloured plate.
 *
 * Idempotent: run it as often as you like, it just rewrites the PNGs.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SRC = join(ROOT, 'public', 'favicon.svg');
const OUT = join(ROOT, 'public', '__grok');
/** Matches the manifest's background_color so the plate is invisible. */
const BACKGROUND = { r: 10, g: 10, b: 11, alpha: 1 };

/** [size, maskable] — the sizes a manifest needs to be installable. */
export const ICON_SPECS = [
  [180, false], // iOS apple-touch-icon
  [192, false], // Android minimum
  [512, false], // Android splash + store listing
  [192, true],  // maskable, safe-zone padded
  [512, true],
];

export function iconFileName(size, maskable) {
  return maskable ? `icon-${size}-maskable.png` : `icon-${size}.png`;
}

async function main() {
  const svg = await readFile(SRC);
  await mkdir(OUT, { recursive: true });

  for (const [size, maskable] of ICON_SPECS) {
    const file = join(OUT, iconFileName(size, maskable));
    if (maskable) {
      // 80% safe zone: the launcher may crop everything outside it.
      const inner = Math.round(size * 0.8);
      const art = await sharp(svg, { density: 512 }).resize(inner, inner).png().toBuffer();
      await sharp({ create: { width: size, height: size, channels: 4, background: BACKGROUND } })
        .composite([{ input: art, gravity: 'center' }])
        .png()
        .toFile(file);
    } else {
      await sharp(svg, { density: 512 })
        .resize(size, size)
        .flatten({ background: BACKGROUND })
        .png()
        .toFile(file);
    }
    console.log(`[pwa-icons] ${iconFileName(size, maskable)}`);
  }
  console.log(`[pwa-icons] ${ICON_SPECS.length} icons written to public/__grok`);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(`[pwa-icons] ${e?.stack ?? e}`); process.exitCode = 1; });
}
