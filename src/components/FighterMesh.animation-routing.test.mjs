import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./FighterMesh.tsx', import.meta.url), 'utf8');

describe('runtime animation routing', () => {
  it('does not let stale attackClip overwrite crouch, locomotion, or grapple receiver animations', () => {
    assert.match(source, /\(isAttack\s*\|\|\s*isGrappleReceiver\)/);
    assert.match(source, /CERTIFIED_RUNTIME_CLIPS\[key\]/);
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

  it('retires every non-current action on urgent combat transitions and locomotion handoffs', () => {
    assert.match(source, /a\.stop\(\);\s*a\.enabled\s*=\s*false;\s*a\.setEffectiveWeight\(0\)/);
    assert.match(source, /previousWasLocomotion/);
    assert.match(source, /cleanLocomotionHandoff/);
    assert.match(source, /nextAction\.reset\(\);/);
    assert.match(source, /nextAction\.play\(\);/);
  });

  it('preserves the already-selected attack through the integrity recovery path', () => {
    assert.match(source, /const recoverClip = clipName;/);
    assert.doesNotMatch(source, /const recoverClip = resolveClipName\(/);
    assert.match(source, /recoverAction\.setEffectiveTimeScale\(/);
    assert.match(source, /recoverAction\.reset\(\)\.play\(\);/);
  });

  it('keeps the certified lane as a fallback rather than overriding authored semantic routing', () => {
    const semantic = source.indexOf('const semanticState = COMBAT_STATE_TO_SEMANTIC[key];');
    const fallback = source.indexOf('const certified = byAliasOrder(CERTIFIED_RUNTIME_CLIPS[key] ?? []);');
    assert.ok(semantic >= 0);
    assert.ok(fallback > semantic, 'certified fallback must not flatten authored semantic ownership');
  });

  it('treats jump/crouch/run attack substates as real attack-owned animation states', () => {
    assert.match(source, /'jumpAttack', 'runAttack', 'crouchLightAttack', 'crouchHeavyAttack'/);
  });

  it('keeps explicit grapple receiver clips authoritative over locomotion routing', () => {
    assert.match(source, /isThrowVictimClip\(inputKey\)/);
    assert.match(source, /if \(state !== 'Walking'\) return requested \|\| state;/);
    assert.match(source, /forcedPlaybackDurationSeconds/);
  });

  it('keeps real grounded recovery clips in the certified lane', () => {
    assert.match(source, /WakeupRollForward:\s*\['LAZORFORWARDROLL'/);
    assert.match(source, /WakeupRollBack:\s*\['LAZORBACKROLL'/);
    assert.match(source, /GroundedFaceUp:\s*\['SUPINE'/);
  });
});
