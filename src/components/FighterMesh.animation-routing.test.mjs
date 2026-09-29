import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./FighterMesh.tsx', import.meta.url), 'utf8');

describe('runtime animation routing', () => {
  it('does not let stale attackClip overwrite crouch, locomotion, or grapple receiver animations', () => {
    assert.match(source, /isAttack\s*&&\s*attackClip\s*&&/);
    assert.match(source, /CERTIFIED_RUNTIME_CLIPS\[inputKey\]/);
  });

  it('has a certified baseline for crouch and core locomotion', () => {
    assert.match(source, /crouch:\s*\['STANCE_CROUCH'/);
    assert.match(source, /walkForward:\s*\['WALK'/);
    assert.match(source, /strafeRight:\s*\['SIDESTEPF'/);
  });

  it('has certified strike fallbacks instead of unverified style clips', () => {
    assert.match(source, /lightAttack:\s*\['TIGERQUICKPUNCH'/);
    assert.match(source, /heavyAttack:\s*\['GYAKUZUKI'/);
    assert.match(source, /lightKick:\s*\['QUICKKICK'/);
    assert.match(source, /heavyKick:\s*\['ROUNDHOUSEKICK'/);
  });

  it('keeps real grounded recovery clips in the certified lane', () => {
    assert.match(source, /WakeupRollForward:\s*\['LAZORFORWARDROLL'/);
    assert.match(source, /WakeupRollBack:\s*\['LAZORBACKROLL'/);
    assert.match(source, /GroundedFaceUp:\s*\['SUPINE'/);
  });
});
