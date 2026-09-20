/**
 * The stance kit, and the two things that make it real rather than a table:
 * every clip it names must EXIST in a shipped bank, and every stance must
 * MEASURE as a held pose. Metadata is a hint; the frames are the authority.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  CROUCH_POOL, GUARD_POOL, STANCE_POOL, STANCE_PEAK_LIMIT_DEG, WALK_POOL,
  allKitClips, archetypeForStyle, stanceKitFor, stancePreferences,
} from './CharacterStances.ts';
import { SCHWARZERBLITZ_MOTION_BANK } from '../../generated/SchwarzerblitzMotionBank.generated.ts';
import { BANNON_MOTION_BANK } from '../../generated/BannonMotionBank.generated.ts';
import { existsSync, readFileSync } from 'node:fs';
import {
  applyStandability, markTPoses, resetBakedMotionBankForTest, type BakedManifestEntry,
} from '../retarget/BakedMotionBank.ts';

const BANKS: Record<string, Record<string, unknown>> = {
  schwarzerblitz: SCHWARZERBLITZ_MOTION_BANK as Record<string, unknown>,
  bannon: BANNON_MOTION_BANK as Record<string, unknown>,
};
const DEG = 180 / Math.PI;

// Inlined rather than imported from scripts/animation-continuity-audit.mjs: a
// .ts test importing that .mjs pulls it into tsc's program, where an untyped
// build script fails noImplicitAny. Same maths, kept honest by the assertions
// below measuring the SHIPPED banks.
function eulerToQuat(x: number, y: number, z: number): [number, number, number, number] {
  const c1 = Math.cos(x / 2), c2 = Math.cos(y / 2), c3 = Math.cos(z / 2);
  const s1 = Math.sin(x / 2), s2 = Math.sin(y / 2), s3 = Math.sin(z / 2);
  return [
    s1 * c2 * c3 + c1 * s2 * s3,
    c1 * s2 * c3 - s1 * c2 * s3,
    c1 * c2 * s3 + s1 * s2 * c3,
    c1 * c2 * c3 - s1 * s2 * s3,
  ];
}
/** |dot| because q and -q are the same rotation. */
function angleBetween(a: number[], b: number[]): number {
  const d = Math.min(1, Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]));
  return 2 * Math.acos(d);
}
const ALL_POOLS = [...STANCE_POOL, ...GUARD_POOL, ...CROUCH_POOL, ...WALK_POOL];

/** Largest rotation any bone reaches away from the clip's first key. */
function peakDegOf(clip: { keys?: Array<{ bones?: Record<string, { rx?: number; ry?: number; rz?: number }> }> }): number {
  const keys = clip.keys ?? [];
  const first = keys[0]?.bones ?? {};
  let peak = 0;
  for (const k of keys) {
    for (const [bone, r] of Object.entries(k.bones ?? {})) {
      const f = first[bone];
      if (!f) continue;
      const d = angleBetween(
        eulerToQuat(f.rx ?? 0, f.ry ?? 0, f.rz ?? 0),
        eulerToQuat(r.rx ?? 0, r.ry ?? 0, r.rz ?? 0),
      );
      if (d > peak) peak = d;
    }
  }
  return peak * DEG;
}

describe('every pooled clip actually exists in a shipped bank', () => {
  for (const entry of ALL_POOLS) {
    it(`${entry.clip} is in the ${entry.bank} bank`, () => {
      assert.ok(BANKS[entry.bank][entry.clip], `${entry.clip} is not in ${entry.bank}`);
    });
  }

  it('no clip is claimed by two banks under different numbers', () => {
    const seen = new Map<string, string>();
    for (const e of ALL_POOLS) {
      const prev = seen.get(e.clip);
      assert.ok(!prev || prev === e.bank, `${e.clip} claimed by ${prev} and ${e.bank}`);
      seen.set(e.clip, e.bank);
    }
  });
});

describe('the recorded peakDeg matches the frames, not the name', () => {
  for (const entry of ALL_POOLS) {
    it(`${entry.clip} measures what the pool claims`, () => {
      const measured = peakDegOf(BANKS[entry.bank][entry.clip] as never);
      assert.ok(
        Math.abs(measured - entry.peakDeg) <= 2,
        `${entry.clip}: pool says ${entry.peakDeg} deg, frames say ${measured.toFixed(0)}`,
      );
    });
  }

  it('every NEUTRAL stance is a held pose, not a move wearing a stance name', () => {
    for (const entry of STANCE_POOL) {
      const measured = peakDegOf(BANKS[entry.bank][entry.clip] as never);
      assert.ok(
        measured <= STANCE_PEAK_LIMIT_DEG,
        `${entry.clip} travels ${measured.toFixed(0)} deg — that is a move, not a stance`,
      );
    }
  });

  it('no pooled clip contains a physically impossible key pair', () => {
    // A fast human limb peaks near 2000 deg/s; 3000 is the generous ceiling
    // scripts/animation-continuity-audit.mjs gates the whole corpus at.
    for (const entry of ALL_POOLS) {
      const clip = BANKS[entry.bank][entry.clip] as {
        keys?: Array<{ t?: number; bones?: Record<string, { rx?: number; ry?: number; rz?: number }> }>;
      };
      const keys = clip.keys ?? [];
      for (let i = 1; i < keys.length; i++) {
        const a = keys[i - 1].bones ?? {};
        const b = keys[i].bones ?? {};
        const dt = Math.max(1e-3, (keys[i].t ?? 0) - (keys[i - 1].t ?? 0));
        for (const boneName of Object.keys(b)) {
          const prev = a[boneName];
          if (!prev) continue;
          const cur = b[boneName];
          const deg = angleBetween(
            eulerToQuat(prev.rx ?? 0, prev.ry ?? 0, prev.rz ?? 0),
            eulerToQuat(cur.rx ?? 0, cur.ry ?? 0, cur.rz ?? 0),
          ) * DEG;
          assert.ok(deg / dt <= 3000, `${entry.clip}: ${boneName} moves ${Math.round(deg / dt)} deg/s`);
        }
      }
    }
  });
});

describe('style decides the shortlist, identity decides the pick', () => {
  const ROSTER: Array<[string, string]> = [
    ['bannon', 'Power Wrestling / Technical Hybrid'],
    ['maime', 'Technical Striking / Speed'],
    ['onyx', 'Power Brawler'],
    ['cipher', 'Speed / Agility'],
    ['echo', 'Psychological / Aerial'],
    ['kobra', 'Street Fighter / Chaos'],
    ['triple_xxx', 'Showman / High-Flying'],
    ['brutus', 'Juggernaut / Pure Power'],
    ['titan', 'Colossus / Immovable'],
    ['master_sensei', 'Martial Arts Master / Precision'],
    ['viper', 'Assassin / Precision Striker'],
    ['hollow', 'Phantom / Psychological'],
    ['el_toro_de_oro', 'Luchador / Power'],
    ['tyneshia', 'Street Queen / Technical Brawler'],
    ['stan_combs', 'Corporate Architect / Dirty Fighter'],
    ['aaron_ruben', 'Technical Grappler / Ring General'],
    ['jager', 'Predator / Hunter'],
    ['wreck_patterson', 'Wrecking Machine / Demolition'],
    ['static', 'Electric Striker / Speed Brawler'],
    ['pablo', 'Mythic Power / Bull Rush'],
    ['tarzanian_devil', 'Lucha libre / hardcore hybrid'],
    ['cody', 'Brawler / Interference'],
    ['finxsse', 'Power + speed hybrid'],
    ['cain_elias', 'Technical Power / Vindictive'],
    ['stick_up', 'Technical/Brutal Hybrid'],
    ['hall_nighter', 'Power Brawler / Endurance'],
    ['edwin_kennedy', 'Corporate Power / Calculated Brutality'],
  ];

  it('a fighter keeps the same stance every time — a signature, not a roll', () => {
    for (const [id, style] of ROSTER) {
      const a = stanceKitFor(id, style);
      const b = stanceKitFor(id, style);
      assert.deepEqual(a, b, `${id} is not stable`);
    }
  });

  it('the roster is genuinely spread across the stance pool', () => {
    const idles = new Set(ROSTER.map(([id, s]) => stanceKitFor(id, s).idle));
    const guards = new Set(ROSTER.map(([id, s]) => stanceKitFor(id, s).guard));
    // The measured starting point was ONE of each across all 27.
    assert.ok(idles.size >= 7, `only ${idles.size} distinct stances: ${[...idles].join(', ')}`);
    assert.ok(guards.size >= 4, `only ${guards.size} distinct guards: ${[...guards].join(', ')}`);
  });

  it('no single stance swallows the roster', () => {
    const counts = new Map<string, number>();
    for (const [id, style] of ROSTER) {
      const k = stanceKitFor(id, style).idle;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const [top, n] = [...counts].sort((a, b) => b[1] - a[1])[0];
    assert.ok(n / ROSTER.length <= 0.35, `${top} takes ${n}/${ROSTER.length} of the roster`);
  });

  it('fighters of the same style still differ', () => {
    // Six power fighters in one pose is the problem this file exists to solve.
    const power = ROSTER.filter(([, s]) => archetypeForStyle(s) === 'power');
    assert.ok(power.length >= 3, `expected several power fighters, saw ${power.length}`);
    const stances = new Set(power.map(([id, s]) => stanceKitFor(id, s).idle));
    assert.ok(stances.size >= 2, 'every power fighter got the same stance');
  });

  it('style maps to a sensible archetype', () => {
    assert.equal(archetypeForStyle('Juggernaut / Pure Power'), 'power');
    assert.equal(archetypeForStyle('Speed / Agility'), 'speed');
    assert.equal(archetypeForStyle('Showman / High-Flying'), 'aerial');
    assert.equal(archetypeForStyle('Phantom / Psychological'), 'phantom');
    assert.equal(archetypeForStyle('Electric Striker / Speed Brawler'), 'striker');
    assert.equal(archetypeForStyle(undefined), 'technical', 'an unknown style still gets a kit');
  });

  it('every kit names clips that are in the pool', () => {
    const pool = new Set(allKitClips());
    for (const [id, style] of ROSTER) {
      const kit = stanceKitFor(id, style);
      for (const clip of [kit.idle, kit.guard, kit.crouch, kit.walk]) {
        assert.ok(pool.has(clip), `${id} was given ${clip}, which is not pooled`);
      }
    }
  });
});

describe('preferences are additive', () => {
  const kit = stanceKitFor('bannon', 'Power Wrestling / Technical Hybrid');

  it('a known state returns the fighter\'s own clip', () => {
    assert.deepEqual(stancePreferences(kit, 'idle'), [kit.idle]);
    assert.deepEqual(stancePreferences(kit, 'guard'), [kit.guard]);
    assert.deepEqual(stancePreferences(kit, 'crouch'), [kit.crouch]);
  });

  it('an unknown state returns nothing, so the generic table still decides', () => {
    assert.deepEqual(stancePreferences(kit, 'lightAttack'), []);
    assert.deepEqual(stancePreferences(kit, 'knockdown'), []);
  });
});

/**
 * A KIT MUST NEVER HAND OUT A CLIP THE FIGHTER CANNOT STAND IN.
 *
 * The pool's original gate, peakDeg, asks whether a clip HOLDS a pose and is
 * silent about where the pose is. MEASURED on the shipped bake: STANCE_WIDE
 * scores 10 deg — the second stillest entry in the pool — and its lowest foot
 * never comes within 107 cm of the mat. It is the FIRST choice for the
 * `power` archetype, so six roster fighters stood a metre in the air.
 *
 * The table still lists it (generated content is not deleted), and the kit
 * refuses it, on the bake's measurement rather than on its name.
 */
describe('a stance kit only ever names clips with feet on the floor', () => {
  const INDEX = 'public/motion/baked/index.json';
  const hasBake = existsSync(INDEX);

  it('skips a hovering clip and still returns a stance', { skip: !hasBake }, () => {
    const manifest = JSON.parse(readFileSync(INDEX, 'utf8')) as Record<string, BakedManifestEntry>;
    const unstandable = applyStandability(manifest);
    try {
      assert.ok(unstandable.size > 0, 'the bake measured nothing as unstandable');
      const styles = [
        'Power Wrestling', 'Technical Hybrid', 'Speed Assassin', 'Electric Striker',
        'Aerial Showman', 'Street Chaos', 'Phantom Psychology',
      ];
      const offenders: string[] = [];
      for (const style of styles) {
        for (let i = 0; i < 40; i++) {
          const kit = stanceKitFor(`fighter_${style}_${i}`, style);
          for (const [slot, clip] of Object.entries(kit)) {
            if (slot === 'archetype') continue;
            if (unstandable.has(clip)) offenders.push(`${style} ${slot} -> ${clip}`);
          }
        }
      }
      assert.deepEqual(offenders.slice(0, 5), [], 'a kit named a clip that cannot reach the floor');
    } finally {
      resetBakedMotionBankForTest();
    }
  });

  it('falls back to the full list when nothing has been measured', () => {
    resetBakedMotionBankForTest();
    const kit = stanceKitFor('BANNON', 'Power Wrestling');
    assert.ok(kit.idle.length > 0, 'a checkout with no bake must still get a stance');
  });
});

/**
 * A STANCE MUST BE A POSE, NOT THE RIG WITH ITS ARMS OUT.
 *
 * Owner, looking at four stances rendered side by side: "stance wide, stance
 * bladed, taunt flex, and guard high, they're all happening the same ...
 * making him stretch out into like a T pose and do like a fucking starfish
 * thing." He was right, and it is a SECOND defect on top of the floor one —
 * those four stand perfectly on the mat and are still a starfish.
 */
describe('a stance kit never hands out a T-pose', () => {
  const INDEX = 'public/motion/baked/index.json';
  const hasBake = existsSync(INDEX);

  it('measures the starfish clips as T-poses and the real stances as poses', { skip: !hasBake }, () => {
    const manifest = JSON.parse(readFileSync(INDEX, 'utf8')) as Record<string, BakedManifestEntry>;
    const tposes = markTPoses(manifest);
    for (const name of ['TPOSE', 'STANCE_WIDE', 'STANCE_BLADED', 'TAUNT_FLEX', 'GUARD_HIGH']) {
      if (!manifest[name]) continue;
      assert.ok(tposes.has(name), `${name} is a starfish and was not caught`);
    }
    // GRAFSTANCE2 spreads as wide as GUARD_HIGH and is a REAL pose, because
    // the hands are forward. It is the case that proves one axis is not
    // enough, so it is asserted by name.
    for (const name of ['STANCE', 'GUARD', 'LOWSTANCE', 'JOHNSON_STANCE', 'TIGERSTANCE', 'GRAFSTANCE2']) {
      if (!manifest[name]) continue;
      assert.equal(tposes.has(name), false, `${name} is a real pose and was thrown away`);
    }
  });

  it('no fighter is ever assigned one', { skip: !hasBake }, () => {
    const manifest = JSON.parse(readFileSync(INDEX, 'utf8')) as Record<string, BakedManifestEntry>;
    const tposes = markTPoses(manifest);
    applyStandability(manifest);
    try {
      const offenders: string[] = [];
      const styles = ['Power Wrestling', 'Technical Hybrid', 'Speed Assassin', 'Electric Striker',
        'Aerial Showman', 'Street Chaos', 'Phantom Psychology'];
      for (const style of styles) {
        for (let i = 0; i < 40; i++) {
          const kit = stanceKitFor(`fighter_${style}_${i}`, style);
          for (const [slot, clip] of Object.entries(kit)) {
            if (slot === 'archetype') continue;
            if (tposes.has(clip)) offenders.push(`${style} ${slot} -> ${clip}`);
          }
        }
      }
      assert.deepEqual([...new Set(offenders)].slice(0, 5), [], 'a kit handed out a starfish');
    } finally {
      resetBakedMotionBankForTest();
    }
  });
});
