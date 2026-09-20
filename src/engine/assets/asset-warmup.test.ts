// `.ts` extensions on purpose — the repo's runner resolves them literally.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { warmAssets, resetAssetWarmupForTest, startAssetWarmup } from './AssetWarmup.ts';
import { warmupUrls } from './warmupPlan.ts';

/** Swap `fetch` for the duration of one test and always put it back. */
async function withFetch(
  impl: (url: string) => Promise<Response> | Response,
  run: () => Promise<void>,
): Promise<void> {
  const original = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL) =>
    Promise.resolve(impl(String(input)))) as typeof fetch;
  try {
    await run();
  } finally {
    globalThis.fetch = original;
  }
}

const ok = () => new Response(new ArrayBuffer(8), { status: 200 });

test('the plan puts the motion set before the models', () => {
  // Order is the design: a warm can be interrupted the moment the player
  // presses START, so the thing every fighter needs has to land first.
  const urls = warmupUrls();
  assert.equal(urls[0], '/motion/baked/index.json');
  assert.ok(urls.length > 50, `only ${urls.length} assets planned`);
  assert.ok(urls.slice(1).every((u) => u.startsWith('/models/')), 'the rest should be models');
  assert.equal(new Set(urls).size, urls.length, 'the plan must not fetch anything twice');
});

test('a favourite is warmed before the rest of the roster', () => {
  const all = warmupUrls();
  const last = all[all.length - 1];
  const favourite = decodeURIComponent(last.replace('/models/', ''));
  const planned = warmupUrls([favourite]);
  assert.equal(planned[1], last, 'a named favourite should come first among the models');
});

test('every asset is fetched, with the body drained', async () => {
  const seen: string[] = [];
  let drained = 0;
  await withFetch(
    (url) => {
      seen.push(url);
      return new Response(new ArrayBuffer(4), { status: 200 });
    },
    async () => {
      const res = await warmAssets(['/models/a.glb', '/models/b.glb', '/models/c.glb'], {
        concurrency: 2,
        onProgress: () => { drained++; },
      });
      assert.equal(res.warmed, 3);
      assert.equal(res.failed, 0);
    },
  );
  assert.equal(seen.length, 3);
  assert.equal(drained, 3, 'progress must be reported once per asset');
});

test('a failing asset is counted, never thrown', async () => {
  // A warm that fails must leave the game exactly as it was.
  await withFetch(
    (url) => (url.includes('bad') ? Promise.reject(new Error('offline')) : ok()),
    async () => {
      const res = await warmAssets(['/models/good.glb', '/models/bad.glb'], { concurrency: 1 });
      assert.equal(res.warmed, 1);
      assert.equal(res.failed, 1);
    },
  );
});

test('a non-200 is a failure, not a warm', async () => {
  await withFetch(
    () => new Response('', { status: 404 }),
    async () => {
      const res = await warmAssets(['/models/missing.glb']);
      assert.equal(res.warmed, 0);
      assert.equal(res.failed, 1);
    },
  );
});

test('an abort stops the warm without throwing', async () => {
  const abort = new AbortController();
  await withFetch(ok, async () => {
    abort.abort();
    const res = await warmAssets(['/models/a.glb', '/models/b.glb'], {
      concurrency: 1,
      signal: abort.signal,
    });
    assert.equal(res.warmed + res.failed, 0, 'an aborted warm should fetch nothing');
  });
});

test('the warm starts once per session', async () => {
  resetAssetWarmupForTest();
  let calls = 0;
  await withFetch(
    () => { calls++; return ok(); },
    async () => {
      startAssetWarmup(['/models/a.glb']);
      startAssetWarmup(['/models/b.glb']);
      await new Promise((r) => setTimeout(r, 20));
    },
  );
  assert.equal(calls, 1, 'a second start must be ignored');
  resetAssetWarmupForTest();
});
