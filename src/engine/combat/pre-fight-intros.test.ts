// `.ts` extensions on purpose — the repo's runner resolves them literally.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  demeanourOf, preFightSequence, relationshipBetween, resetIntroCycles,
  introPoseFor, sequenceDurationMs, type IntroFighter,
} from './PreFightIntros.ts';
import {
  applyStandability, resetBakedMotionBankForTest, type BakedManifestEntry,
} from '../retarget/BakedMotionBank.ts';
import { BANNON_ROSTER } from '../../data/bannonRoster.ts';

const INDEX = 'public/motion/baked/index.json';
const hasBake = existsSync(INDEX);

const as = (f: (typeof BANNON_ROSTER)[number]): IntroFighter => ({
  id: f.id, name: f.name, factionAlignment: f.factionAlignment, personality: f.personality,
});

describe('the pre-fight intro', () => {
  it('reads demeanour off the roster prose, not off a per-fighter table', () => {
    assert.equal(demeanourOf('Loose cannon. Hilarious, loud, lives on chaos.'), 'manic');
    assert.equal(demeanourOf('Theatrical and self-absorbed. Demands the spotlight.'), 'theatrical');
    assert.equal(demeanourOf('Cold and calculating. Patient as a predator.'), 'cold');
    assert.equal(demeanourOf('Proud and honorable. Fights with passion and flair.'), 'proud');
    assert.equal(demeanourOf(undefined), 'silent', 'an unwritten personality still gets an intro');
  });

  it('every fighter on the roster resolves to a real demeanour', () => {
    for (const f of BANNON_ROSTER) {
      const d = demeanourOf(f.personality);
      assert.ok(d, `${f.name} has no demeanour`);
    }
  });

  it('reads the relationship off faction alignment', () => {
    const alliance = { id: 'a', factionAlignment: 'alliance' };
    const corporate = { id: 'b', factionAlignment: 'corporate' };
    const chaos = { id: 'c', factionAlignment: 'chaos' };
    const indie = { id: 'd', factionAlignment: 'independent' };
    assert.equal(relationshipBetween(alliance, corporate), 'war');
    assert.equal(relationshipBetween(alliance, { id: 'e', factionAlignment: 'alliance' }), 'civilWar');
    assert.equal(relationshipBetween(chaos, corporate), 'chaos');
    assert.equal(relationshipBetween(indie, corporate), 'mercenary');
  });

  it('an authored feud outranks the derived relationship, both ways round', () => {
    const bannon = { id: 'bannon', factionAlignment: 'independent' };
    const finxsse = { id: 'finxsse', factionAlignment: 'independent' };
    assert.equal(relationshipBetween(bannon, finxsse), 'grudge');
    assert.equal(relationshipBetween(finxsse, bannon), 'grudge');
  });

  it('plays ONE fighter at a time, challenger first', () => {
    resetIntroCycles();
    const [p1, p2] = BANNON_ROSTER;
    const beats = preFightSequence(as(p1), as(p2));
    assert.equal(beats.length, 2);
    assert.equal(beats[0].player, 'p2', 'the challenger opens');
    assert.equal(beats[1].player, 'p1', 'the player closes, so the match starts on them');
    assert.ok(sequenceDurationMs(beats) > 0);
    for (const b of beats) assert.ok(b.line.length > 0 && b.clip.length > 0);
  });

  it('a grudge plays as a call and an answer, in a stable order', () => {
    resetIntroCycles();
    const bannon = BANNON_ROSTER.find((f) => f.id.toLowerCase() === 'bannon');
    const finxsse = BANNON_ROSTER.find((f) => f.id.toLowerCase() === 'finxsse');
    if (!bannon || !finxsse) return;
    const a = preFightSequence(as(bannon), as(finxsse));
    resetIntroCycles();
    const b = preFightSequence(as(finxsse), as(bannon));
    const linesA = a.map((x) => x.line).sort();
    const linesB = b.map((x) => x.line).sort();
    assert.deepEqual(linesA, linesB, 'the same pair says the same two lines either way round');
    assert.notEqual(a[0].line, a[1].line, 'a scene is two different lines');
  });

  it('cycles the pose so a character does not open the same way twice running', () => {
    resetIntroCycles();
    const seen = new Set<string>();
    for (let i = 0; i < 4; i++) seen.add(introPoseFor('someone', 'theatrical'));
    assert.ok(seen.size > 1, 'the intro pose never changed across four matches');
  });

  it('NEVER opens on a T-pose — that is the bug, not the fix', () => {
    resetIntroCycles();
    const poses = new Set<string>();
    for (const f of BANNON_ROSTER) {
      for (let i = 0; i < 6; i++) poses.add(introPoseFor(f.id, demeanourOf(f.personality)));
    }
    assert.equal(poses.has('TPOSE'), false, 'TPOSE is standable and is still never an intro');
  });

  it('never opens on a pose that hovers above the mat', { skip: !hasBake }, () => {
    const manifest = JSON.parse(readFileSync(INDEX, 'utf8')) as Record<string, BakedManifestEntry>;
    const unstandable = applyStandability(manifest);
    try {
      resetIntroCycles();
      const offenders: string[] = [];
      for (const f of BANNON_ROSTER) {
        for (let i = 0; i < 6; i++) {
          const clip = introPoseFor(f.id, demeanourOf(f.personality));
          if (unstandable.has(clip)) offenders.push(`${f.name} -> ${clip}`);
        }
      }
      assert.deepEqual(offenders.slice(0, 5), [], 'a held close-up on a hovering pose');
    } finally {
      resetBakedMotionBankForTest();
    }
  });

  it('every pose a kit can name exists in the shipped bake', { skip: !hasBake }, () => {
    const manifest = JSON.parse(readFileSync(INDEX, 'utf8')) as Record<string, BakedManifestEntry>;
    resetIntroCycles();
    const missing: string[] = [];
    for (const f of BANNON_ROSTER) {
      for (let i = 0; i < 6; i++) {
        const clip = introPoseFor(f.id, demeanourOf(f.personality));
        if (!manifest[clip]) missing.push(`${f.name} -> ${clip}`);
      }
    }
    assert.deepEqual([...new Set(missing)].slice(0, 5), [], 'an intro pose that is not in the bake');
  });
});
