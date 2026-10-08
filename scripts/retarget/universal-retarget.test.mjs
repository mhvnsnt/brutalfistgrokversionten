/**
 * Runs the universal-retarget suite (src/engine/retarget/universal-retarget.test.ts)
 * under the existing `node --test 'scripts/**\/*.test.mjs'` glob, so `npm test`
 * picks it up without editing the shared test list in package.json (which
 * other branches edit too). Node >= 22.18 strips TypeScript types natively;
 * the resolve hook handles the repo's extensionless imports.
 */
import { register } from 'node:module';

register('../ts-resolve.mjs', import.meta.url);
await import('../../src/engine/retarget/universal-retarget.test.ts');
