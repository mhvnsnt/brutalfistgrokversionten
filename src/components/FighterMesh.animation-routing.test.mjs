import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./FighterMesh.tsx', import.meta.url), 'utf8');

describe('runtime animation routing — Claude baseline contract', () => {
  it('lets an explicit authored command clip win while still rejecting broken/team captures', () => {
    assert.match(source, /if \(attackClip && actions\[attackClip\] && !labelRefuses\(attackClip\) && !clipIsTeamCapture\(attackClip\)\)/);
    assert.match(source, /const isAttack = ATTACK_STATES\.has\(inputKey\);/);
  });

  it('keeps ordered semantic ownership and measured usability gates', () => {
    assert.match(source, /const usable = \(c: string, forAttack = true\)/);
    assert.match(source, /const byAliasOrder = \(aliases: string\[\]\)/);
    assert.match(source, /clipsLabelledFor\(semanticState\)/);
    assert.match(source, /slotOwnerFor\(semanticState\)/);
  });

  it('does not introduce a global certified-clip override table into runtime resolution', () => {
    assert.doesNotMatch(source, /CERTIFIED_RUNTIME_CLIPS/);
  });

  it('does not hard-cut every transition into a single-pose regime', () => {
    assert.match(source, /if \(isUrgent \|\| \(inputKey !== 'idle' && inputKey !== 'Neutral'\)\)/);
    assert.match(source, /a\.fadeOut\(fadeDuration\)/);
  });

  it('keeps integrity diagnostics diagnostic and never silently substitutes idle', () => {
    assert.match(source, /Never silently substitute idle for a missing combat semantic state/);
    assert.match(source, /if \(inputKey !== 'idle' && inputKey !== 'Neutral'\)/);
  });
});
