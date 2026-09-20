/**
 * Let `node --experimental-strip-types` resolve this repo's imports.
 *
 * The source uses extensionless relative imports and the `@/` alias, both of
 * which Vite resolves and Node does not. A build-time tool that imports the
 * SHIPPING modules — rather than reimplementing them and drifting from them —
 * needs this hook.
 */
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SRC = new URL('../src/', import.meta.url);

function tryExtensions(path, next, context) {
  for (const cand of [path, `${path}.ts`, `${path}.tsx`, `${path}/index.ts`, `${path}.mjs`, `${path}.js`]) {
    if (!existsSync(cand)) continue;
    try { if (statSync(cand).isDirectory()) continue; } catch { continue; }
    return next(pathToFileURL(cand).href, context);
  }
  return null;
}

export async function resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) {
    const hit = tryExtensions(fileURLToPath(new URL(specifier.slice(2), SRC)), next, context);
    if (hit) return hit;
  }
  try {
    return await next(specifier, context);
  } catch (err) {
    if (!specifier.startsWith('.') && !specifier.startsWith('/')) throw err;
    const base = specifier.startsWith('/')
      ? pathToFileURL(specifier)
      : new URL(specifier, context.parentURL);
    const hit = tryExtensions(fileURLToPath(base), next, context);
    if (hit) return hit;
    throw err;
  }
}
