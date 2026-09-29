import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';

const meshSource = readFileSync(new URL('../../components/FighterMesh.tsx', import.meta.url), 'utf8');
const baked = JSON.parse(readFileSync(new URL('../../../public/motion/baked/index.json', import.meta.url), 'utf8'));
const sb = JSON.parse(readFileSync(new URL('../../../public/motion/schwarzerblitz_moves.json', import.meta.url), 'utf8'));

const clipNames = new Set(Object.keys(baked));
const moves = Object.values(sb.moves).flatMap((group) => Array.isArray(group) ? group : Object.values(group).flat());

describe('grounded animation contract', () => {
  it('ships the real Schwarzerblitz grounded recovery clips used by the resolver', () => {
    for (const name of [
      'SUPINE',
      'PRONEROTATION',
      'PRONE_HOLD',
      'ROLLOUT',
      'ROLLOUTRIGHT',
      'LAZORBACKROLL',
      'LAZORFORWARDROLL',
      'WAKEUPANIMATION',
      'KIP_UP',
      'CORKSCREW_KIP_UP',
    ]) {
      assert.ok(clipNames.has(name), name + ' is missing from the baked bank');
    }
  });

  it('does not apply standing-only gates to grounded recovery states', () => {
    assert.match(meshSource, /const GROUNDED_ANIMATION_STATES = new Set\(\[/);
    assert.match(meshSource, /allowGroundedStart = false/);
    assert.match(meshSource, /allowGroundedStart \|\| \(clipStandsUpright\(c\) && clipStartsStanding\(c\)\)/);
    assert.match(meshSource, /WakeupRollSide:\s+\['ROLLOUTRIGHT'/);
    assert.match(meshSource, /GroundedFaceUp:\s+\['SUPINE'/);
    assert.match(meshSource, /GroundedFaceDown:\s+\['PRONE_HOLD', 'PRONEROTATION'\]/);
  });

  it('keeps the fighter prone when there is no wakeup input', () => {
    assert.match(meshSource, /No input means STAY DOWN/);
    assert.match(meshSource, /GroundedFaceDown/);
    assert.match(meshSource, /GroundedFaceUp/);
  });

  it('keeps real Schwarzerblitz grounded contracts visible as production work', () => {
    const grounded = moves.filter((m) =>
      m.stance === 'Supine' || m.stance === 'Landing' ||
      m.name === 'Ukemi' || m.name === 'Gbackroll' || m.name === 'Gforeroll' ||
      m.name === 'BackgroundUkemi',
    );
    assert.ok(grounded.some((m) => m.name === 'Ukemi'), 'Ukemi contract missing');
    assert.ok(grounded.some((m) => m.name === 'Gbackroll'), 'Gbackroll contract missing');
    assert.ok(grounded.some((m) => m.name === 'Gforeroll'), 'Gforeroll contract missing');
    assert.ok(grounded.some((m) => m.name === 'BackgroundUkemi'), 'BackgroundUkemi contract missing');
  });
});
