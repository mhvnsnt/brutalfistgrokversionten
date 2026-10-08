import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('animation transition timing', () => {

  it('retires faded actions so locomotion cannot accumulate ghost layers', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'src/engine/retarget/AnimationController.ts'), 'utf8');
    assert.match(
      source,
      /retiringActions\.set\(action, Math\.max\(retiringActions\.get\(action\) \?\? 0, fade\)\)/,
      'faded actions must be tracked for deterministic retirement',
    );
    assert.match(
      source,
      /action\.stop\(\);[\s\S]*action\.enabled = false;/,
      'retired actions must be stopped and disabled rather than left scheduled',
    );
  });

  it('does not enable Three.js crossfade time-warping', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'src/engine/retarget/AnimationController.ts'), 'utf8');
    assert.match(
      source,
      /currentAction\.crossFadeTo\(nextAction, fadeDuration, false\)/,
      'combat animation transitions must blend without retiming the authored clip',
    );
    assert.doesNotMatch(
      source,
      /currentAction\.crossFadeTo\(nextAction, fadeDuration, true\)/,
      'warp=true silently changes clip timing during combat',
    );
  });
});
