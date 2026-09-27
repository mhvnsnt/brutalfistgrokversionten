import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createSerialLane } from './serialLane.ts';

test('a stream lane never runs two loads at once', async () => {
  const lane = createSerialLane();
  let active = 0;
  let max = 0;
  const job = () =>
    lane(async () => {
      active += 1;
      max = Math.max(max, active);
      await new Promise((r) => setTimeout(r, 15));
      active -= 1;
    });
  await Promise.all([job(), job(), job()]);
  assert.equal(max, 1);
  assert.equal(active, 0);
});
