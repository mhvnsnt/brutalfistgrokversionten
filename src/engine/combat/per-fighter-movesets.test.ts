// `.ts` extensions on purpose — the repo's runner resolves them literally.
/**
 * EVERY FIGHTER PLAYS HIS OWN MOVESET.
 *
 * Regression locks for the per-fighter moveset pass. Before it (main db752c8):
 * 11 fighters × 26 generated slots drew 28 clips, onyx and cain_elias had
 * identical clip sets, frame data was a pure function of the clip, and every
 * neutral LP/RP/LK/RK was the same DEFAULT_MOVE_WINDOWS entry for every
 * fighter. getMoveById could not resolve a single `bf_*` roster id, so the
 * directional roster slots fell back to the generic jab too.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';

import { FighterStateMachine, type MoveWindow } from './FighterStateMachine.ts';
import { resolveRosterMoveWindows } from './RosterMoveWindows.ts';
import { FIGHTER_STYLE_TABLE, resolveStyle, buildStyledMoveset, newRosterDiversity } from './FighterStyleProfiles.ts';
import { buildStrikeClipPool } from './StrikeClipPool.ts';
import { buildHitboxFromMove } from './FrameDataHitbox.ts';
import { generatedMoveset, setGeneratedMovesets } from './GeneratedMovesets.ts';
import { getMoveById } from '../BrutalFistMoveCatalog.ts';
import { BANNON_ROSTER } from '../../data/bannonRoster.ts';
import { ROSTER_STYLE_CLIPS } from '../../generated/RosterStyleClips.generated.ts';

type Row = { id: string; clip: string; startup: number; active: number; recovery: number; damage: number; onBlock?: number; hitstun?: number; pushback?: number; contactReach?: number; string?: string[]; style?: string };
const TABLE = JSON.parse(readFileSync('public/motion/movesets.json', 'utf8')) as Record<string, Row[]>;
const INDEX = JSON.parse(readFileSync('public/motion/baked/index.json', 'utf8'));
const BODIES = JSON.parse(readFileSync('public/motion/clip-bodies.json', 'utf8'));
const POOL = buildStrikeClipPool(INDEX, BODIES).pool;
const POOL_NAMES = new Set(POOL.map((c) => c.name));
const ROSTER_IDS = BANNON_ROSTER.map((f) => f.id);

const sig = (m: Pick<Row, 'startup' | 'active' | 'recovery' | 'damage' | 'onBlock' | 'hitstun' | 'pushback'>) =>
  [m.startup, m.active, m.recovery, m.damage, m.onBlock, m.hitstun, m.pushback].map((v) => (v ?? 'x').toString()).join('/');

function withClock<T>(run: (advance: (seconds: number) => void) => T): T {
  const real = globalThis.performance;
  let ms = 1000;
  (globalThis as { performance: unknown }).performance = { ...real, now: () => ms };
  try { return run((s) => { ms += s * 1000; }); } finally { (globalThis as { performance: unknown }).performance = real; }
}
const BASE = { forward: 0, strafe: 0, light: false, heavy: false, guard: false, crouch: false };

describe('the generated directional table is per fighter', () => {
  it('covers the whole roster', () => {
    for (const id of ROSTER_IDS) assert.ok(TABLE[id]?.length >= 20, `${id} has no generated moveset`);
  });

  it('no two fighters have identical clip sets', () => {
    const keyed = new Map<string, string>();
    for (const id of ROSTER_IDS) {
      const key = [...new Set(TABLE[id].map((m) => m.clip))].sort().join(',');
      assert.ok(!keyed.has(key), `${id} has the same clip set as ${keyed.get(key)}`);
      keyed.set(key, id);
    }
  });

  it('the same input (Ground 6P) yields different gameplay data for every fighter', () => {
    const seen = new Map<string, string>();
    for (const id of ROSTER_IDS) {
      const m = TABLE[id].find((r) => r.id === `bf_${id}_Ground_6P`);
      assert.ok(m, `${id} has no 6P`);
      const s = sig(m!);
      assert.ok(!seen.has(s), `${id} 6P plays exactly like ${seen.get(s)}'s (${s})`);
      seen.set(s, id);
    }
  });

  it('frame data is not a pure function of the clip — style changes it', () => {
    const byClip = new Map<string, Set<string>>();
    for (const id of ROSTER_IDS) for (const m of TABLE[id]) {
      if (!byClip.has(m.clip)) byClip.set(m.clip, new Set());
      byClip.get(m.clip)!.add(sig(m));
    }
    const shared = [...byClip.values()].filter((s) => s.size > 1).length;
    assert.ok(shared >= byClip.size * 0.8, `only ${shared}/${byClip.size} clips play differently for different fighters`);
  });

  it('every clip is from the measured strike pool (nothing promoted by name)', () => {
    for (const id of ROSTER_IDS) for (const m of TABLE[id]) {
      assert.ok(POOL_NAMES.has(m.clip), `${m.id} plays ${m.clip}, which is not in the measured strike pool`);
    }
  });

  it('stays inside the Tekken frame envelope', () => {
    for (const id of ROSTER_IDS) for (const m of TABLE[id]) {
      const f = (s: number) => Math.round(s * 60);
      assert.ok(f(m.startup) >= 10 && f(m.active) >= 2 && f(m.active) <= 6 && f(m.startup + m.active + m.recovery) <= 62, `${m.id} is outside the envelope`);
    }
  });

  it('building twice gives the same table — style-driven, not a roll', () => {
    const d1 = newRosterDiversity();
    const d2 = newRosterDiversity();
    for (const f of BANNON_ROSTER.slice(0, 5)) {
      const st = resolveStyle(f.id, { speed: f.speed, strength: f.strength })!;
      assert.deepEqual(buildStyledMoveset(st, POOL, d1), buildStyledMoveset(st, POOL, d2));
    }
  });
});

describe('strings', () => {
  it('every fighter has a 2–3 hit directional string with no loop, and the runtime wires it', () => {
    setGeneratedMovesets(TABLE as never);
    for (const id of ROSTER_IDS) {
      const rows = TABLE[id];
      const byId = new Map(rows.map((r) => [r.id, r]));
      const starts = rows.filter((r) => (r.string ?? []).length && !rows.some((o) => (o.string ?? []).includes(r.id)));
      assert.equal(starts.length, 1, `${id} should have exactly one string opener`);
      let len = 1;
      const seen = new Set<string>([starts[0].id]);
      let cur = starts[0];
      while ((cur.string ?? []).length) {
        const next = byId.get(cur.string![0])!;
        assert.ok(next && !seen.has(next.id), `${id} string loops at ${cur.id}`);
        seen.add(next.id); cur = next; len++;
      }
      assert.ok(len >= 2 && len <= 3, `${id} string is ${len} hits`);
      const gen = generatedMoveset(id).find((m) => m.id === starts[0].id);
      assert.equal(gen?.move.cancelInto?.[0]?.move, starts[0].string![0], `${id} string not wired into cancelInto`);
    }
  });

  it('a neutral string continues on the right button and ends where the style says', () => {
    withClock((advance) => {
      const r = resolveRosterMoveWindows('maime')!; // speed: LP, LP, RK
      assert.deepEqual(r.neutralString, ['lp', 'lp', 'rk']);
      const fsm = new FighterStateMachine();
      fsm.setCharacterMoveWindows(r.windows);
      const step = (input: typeof BASE & Record<string, unknown>) => { advance(1 / 60); fsm.update(input as never, 1 / 60); };
      step(BASE);
      step({ ...BASE, lp: true });
      const first = fsm.activeMoveName();
      for (let i = 0; i < 6; i++) step(BASE);
      step({ ...BASE, lp: true });
      assert.match(fsm.activeMoveName() ?? '', /\(2\/3\)/, `after ${first}, LP should continue the string`);
      for (let i = 0; i < 6; i++) step(BASE);
      step({ ...BASE, rk: true });
      assert.match(fsm.activeMoveName() ?? '', /\(3\/3\)/, 'RK should end the string');
    });
  });
});

describe('neutral buttons resolve per fighter', () => {
  it('the same LP input gives different gameplay data for Bannon, Maime, Onyx, Kobra and Viper', () => {
    const seen = new Map<string, string>();
    for (const id of ['bannon', 'maime', 'onyx', 'kobra', 'viper']) {
      withClock((advance) => {
        const fsm = new FighterStateMachine();
        fsm.setCharacterMoveWindows(resolveRosterMoveWindows(id)!.windows);
        advance(1 / 60); fsm.update({ ...BASE, lp: true } as never, 1 / 60);
        assert.equal(fsm.current, 'lightAttack');
        const w = fsm.characterWindowFor('lightAttack') as MoveWindow;
        const s = [w.startup, w.recovery, w.damage, w.onBlock, w.hitstun, w.pushback, w.contactReach].join('/');
        assert.ok(!seen.has(s), `${id} LP plays exactly like ${seen.get(s)}'s`);
        seen.set(s, id);
      });
    }
  });

  it('style shows in the numbers: Maime (speed) is faster and lighter than Bannon (grappler/power)', () => {
    const b = resolveRosterMoveWindows('bannon')!.windows.lightAttack!;
    const m = resolveRosterMoveWindows('maime')!.windows.lightAttack!;
    assert.ok(m.startup + m.recovery < b.startup + b.recovery);
    assert.ok((m.damage ?? 0) < (b.damage ?? 0));
    assert.ok((m.onBlock ?? 0) > (b.onBlock ?? 0));
  });

  it('power styles armour their heavy; speed styles do not', () => {
    assert.ok(resolveRosterMoveWindows('bannon')!.windows.heavyAttack!.defence?.length);
    assert.ok(!resolveRosterMoveWindows('maime')!.windows.heavyAttack!.defence?.length);
  });

  it('the hitbox carries the fighter-specific hitstun and pushback', () => {
    const hb = (id: string) => buildHitboxFromMove(resolveRosterMoveWindows(id)!.windows.heavyAttack!);
    assert.notEqual(hb('onyx').pushback, hb('maime').pushback);
    assert.notEqual(hb('onyx').hitstun, hb('maime').hitstun);
  });

  it('crouch attacks stay low for every fighter', () => {
    for (const id of ROSTER_IDS) {
      const r = resolveRosterMoveWindows(id)!;
      assert.equal(r.windows.crouchLight?.attackLevel, 'low', id);
      assert.equal(r.windows.crouchKick?.attackLevel, 'low', id);
    }
  });
});

describe('honesty', () => {
  it('roster move ids resolve in the catalog (bf_* ids used to return null)', () => {
    assert.equal(getMoveById('bf_jab')?.displayName, 'Jab');
    assert.equal(getMoveById('jab')?.id, 'bf_jab');
  });

  it('every roster fighter has a canon-derived style whose basis quotes his roster text', () => {
    for (const f of BANNON_ROSTER) {
      const entry = FIGHTER_STYLE_TABLE[f.id];
      assert.ok(entry, `${f.id} has no style profile`);
      for (const part of entry.canonBasis.split('...').map((p) => p.trim()).filter(Boolean)) {
        assert.ok(f.fightingStyle.includes(part), `${f.id} canonBasis "${part}" is not in the roster fightingStyle`);
      }
    }
  });

  it('style clips are real measured clips or reported MISSING_CLIP — never a silent substitute', () => {
    for (const id of ROSTER_IDS) {
      const r = resolveRosterMoveWindows(id)!;
      for (const p of r.provenance) {
        if (p.clipStatus === 'STYLE_CLIP') assert.ok(p.clip && POOL_NAMES.has(p.clip), `${id}.${p.slot} claims ${p.clip}`);
        else assert.equal(p.clip, null);
      }
      for (const clip of Object.values(ROSTER_STYLE_CLIPS[id] ?? {})) if (clip) assert.ok(POOL_NAMES.has(clip));
    }
  });

  it('the broken UAL1/UAL2 bake entries are not promoted into any moveset', () => {
    for (const id of ROSTER_IDS) for (const m of TABLE[id]) assert.ok(!/^UAL[12]_/.test(m.clip), `${m.id} promotes ${m.clip}`);
    assert.ok(!POOL.some((c) => /^UAL[12]_/.test(c.name)));
  });
});
