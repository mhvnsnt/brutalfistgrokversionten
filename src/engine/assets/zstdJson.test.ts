import assert from 'node:assert/strict';
import { test } from 'node:test';
import { zstdCompressSync } from 'node:zlib';

import { decodeZstdJson, isZstd } from './zstdJson.ts';

test('zstd json round-trips through fzstd', () => {
  const payload = { clip: 'APRONJAYKICK', bones: [1, 2, 3] };
  const packed = new Uint8Array(zstdCompressSync(Buffer.from(JSON.stringify(payload))));
  assert.equal(isZstd(packed), true);
  assert.deepEqual(decodeZstdJson(packed), payload);
});

test('plain json bytes still decode', () => {
  const raw = new TextEncoder().encode('{"ok":true}');
  assert.equal(isZstd(raw), false);
  assert.deepEqual(decodeZstdJson(raw), { ok: true });
});
