/**
 * The imported command list, as the engine will actually execute it.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  ENGINE_DAMAGE_MAX, ENGINE_DAMAGE_MIN, SOURCE_FPS, availableMoveSets, commandButtonsFor,
  motionStateFor, moveSetForFighter, moveWindowFor, scaleDamage, schwarzerblitzSpecials,
} from './SchwarzerblitzSpecials.ts';
import { SCHWARZERBLITZ_MOVE_GRAPH } from '../../generated/SchwarzerblitzMoveGraph.generated.ts';
import { buttonSatisfies, createCommandBuffer, matchCommand, pushInput, type Facing } from './CommandInput.ts';

const P1: Facing = 1;
const P2: Facing = -1;

describe('the graph becomes executable specials', () => {
  it('the corpus yields a real command list', () => {
    // MEASURED: chara_tutor 15, chara_tutor2 11, chara_dummy 4 (it is a
    // training dummy), common 0 — `common` is steps, sidesteps and ukemi, all
    // of which have no hitbox, so it correctly contributes no specials.
    const counts = Object.fromEntries(availableMoveSets().map((s) => [s, schwarzerblitzSpecials(s).length]));
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    assert.ok(total >= 25, `only ${total} specials across ${JSON.stringify(counts)}`);
    assert.ok(counts.chara_tutor >= 10, 'the main authored set is thin');
    assert.equal(counts.common, 0, 'common has no hitboxes and must yield no specials');
  });

  it('an unknown set degrades to nothing rather than throwing', () => {
    assert.deepEqual(schwarzerblitzSpecials('no_such_character'), []);
  });

  it('every special carries a real motion, never a bare button', () => {
    // A single bare button would shadow the engine's own jab.
    for (const set of availableMoveSets()) {
      for (const sp of schwarzerblitzSpecials(set)) {
        assert.ok(sp.command && sp.command.length > 0, `${sp.id} has no command`);
        const bare = sp.command!.length === 1 && sp.command![0].dirs.length === 0;
        assert.ok(!bare, `${sp.id} is a bare button and would shadow a normal attack`);
        for (const step of sp.command!) {
          assert.ok(step.dirs.length || step.buttons.length, `${sp.id} has an empty step`);
          for (const d of step.dirs) assert.ok(d >= 1 && d <= 9, `${sp.id}: bad direction ${d}`);
          for (const b of step.buttons) assert.match(b, /^[PKT]$/, `${sp.id}: bad button ${b}`);
        }
      }
    }
  });

  it('every special does damage and has a usable window', () => {
    for (const sp of schwarzerblitzSpecials('chara_tutor')) {
      assert.ok((sp.move.damage ?? 0) > 0, `${sp.id} does no damage`);
      assert.ok(sp.move.startup > 0 && sp.move.active > 0 && sp.move.recovery > 0, `${sp.id} has a broken window`);
      assert.ok(sp.move.startup < 2, `${sp.id} takes ${sp.move.startup}s to start`);
      assert.ok(sp.move.isSpecial, `${sp.id} is not flagged special`);
    }
  });

  it('frame data comes from the source at its own 24 fps', () => {
    const move = (SCHWARZERBLITZ_MOVE_GRAPH.chara_tutor ?? []).find(
      (m) => m.frames && m.frames[0] > 0 && m.hitboxes.length,
    );
    assert.ok(move, 'expected a move with a real active window');
    const w = moveWindowFor(move!);
    assert.ok(Math.abs(w.startup - move!.frames![0] / SOURCE_FPS) < 1e-9, 'startup is not frames/24');
    assert.ok(
      Math.abs(w.active - (move!.frames![1] - move!.frames![0]) / SOURCE_FPS) < 1e-9,
      'active is not (b-a)/24',
    );
  });

  it('damage mapping preserves the source order', () => {
    // Order is what carries the source's balance; the absolute numbers are ours.
    const pairs: Array<[number, number]> = [];
    for (const set of availableMoveSets()) {
      for (const move of SCHWARZERBLITZ_MOVE_GRAPH[set]) {
        if (!move.hitboxes.length) continue;
        const peak = Math.max(...move.hitboxes.map((h) => h.damage || 0));
        if (peak <= 0) continue;
        pairs.push([peak, moveWindowFor(move).damage!]);
      }
    }
    assert.ok(pairs.length >= 20, `only ${pairs.length} damaging moves`);
    pairs.sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < pairs.length; i++) {
      assert.ok(pairs[i][1] >= pairs[i - 1][1], `a weaker source hit scaled higher: ${pairs[i - 1]} vs ${pairs[i]}`);
    }
  });

  it('every mapped hit lands inside a playable band', () => {
    // The multiplier I tried first scaled the corpus maximum to 375 — harder
    // than anything the engine has. Measured, the corpus runs 2..45.
    const all = availableMoveSets().flatMap((s) => SCHWARZERBLITZ_MOVE_GRAPH[s]);
    const damages = all.flatMap((m) => m.hitboxes.map((h) => h.damage || 0)).filter((d) => d > 0);
    assert.ok(damages.length >= 100, `only ${damages.length} hitboxes`);
    assert.equal(Math.max(...damages), 45, 'the corpus maximum moved — re-measure the band');
    for (const d of damages) {
      const scaled = scaleDamage(d);
      assert.ok(scaled >= ENGINE_DAMAGE_MIN && scaled <= ENGINE_DAMAGE_MAX, `${d} scaled to ${scaled}`);
    }
    assert.equal(scaleDamage(45), ENGINE_DAMAGE_MAX);
    assert.equal(scaleDamage(2), ENGINE_DAMAGE_MIN);
    // Out of range still lands somewhere playable.
    assert.equal(scaleDamage(999), ENGINE_DAMAGE_MAX);
    assert.equal(scaleDamage(0), ENGINE_DAMAGE_MIN);
  });

  it('the motion state is read off the HITBOX BONE, not the move name', () => {
    // Light/heavy splits at the corpus's measured p90 of 20.
    const kick = { frames: [2, 5], hitboxes: [{ bone: 'RightFoot', damage: 25 }], input: [] } as never;
    const punch = { frames: [2, 5], hitboxes: [{ bone: 'LeftPunch', damage: 25 }], input: [] } as never;
    const softKick = { frames: [2, 5], hitboxes: [{ bone: 'LeftLeg', damage: 6 }], input: [] } as never;
    const poke = { frames: [2, 5], hitboxes: [{ bone: 'LeftPunch', damage: 3 }], input: [] } as never;
    assert.equal(motionStateFor(kick), 'heavyKick');
    assert.equal(motionStateFor(punch), 'heavyAttack');
    assert.equal(motionStateFor(softKick), 'lightKick', 'a leg bone is a kick whatever it is called');
    assert.equal(motionStateFor(poke), 'lightAttack');
  });

  it('the special carries the SOURCE CLIP so it looks like itself', () => {
    const withClips = schwarzerblitzSpecials('chara_tutor').filter((sp) => sp.move.clip);
    assert.ok(withClips.length >= 5, 'specials lost their authored animation');
    for (const sp of withClips) assert.ok(sp.move.clip!.length > 0);
  });

  it('a fighter is assigned a set deterministically', () => {
    for (const id of ['bannon', 'viper', 'cipher', 'onyx']) {
      assert.equal(moveSetForFighter(id), moveSetForFighter(id), `${id} is not stable`);
      assert.ok(availableMoveSets().includes(moveSetForFighter(id)));
    }
    const spread = new Set(['bannon', 'viper', 'cipher', 'onyx', 'echo', 'kobra'].map(moveSetForFighter));
    assert.ok(spread.size >= 2, 'every fighter got the same command list');
  });
});

describe('our four buttons reach the matcher as four buttons', () => {
  /**
   * Owner: "I can't press back and right kick at the same time to do a
   * different move than just pressing right kick at once."
   *
   * This used to return `{P: lp||rp, K: lk||rk}` — four buttons collapsed
   * into two before anything could tell them apart, so `4+LP` and `4+RP`
   * were one move and half a four-button fighter's vocabulary did not
   * exist. The imported corpus is written in P/K and cannot express the
   * difference; that is a limit of the source, not of our matcher.
   */
  const only = (...on: string[]) => {
    const out: Record<string, boolean> = { LP: false, RP: false, LK: false, RK: false, T: false };
    for (const b of on) out[b] = true;
    return out;
  };

  it('keeps the limbs apart', () => {
    assert.deepEqual(commandButtonsFor({ lp: true }), only('LP'));
    assert.deepEqual(commandButtonsFor({ rp: true }), only('RP'));
    assert.deepEqual(commandButtonsFor({ lk: true }), only('LK'));
    assert.deepEqual(commandButtonsFor({ rk: true }), only('RK'));
    assert.deepEqual(commandButtonsFor({ grapple: true }), only('T'));
    assert.deepEqual(commandButtonsFor({}), only());
  });

  it('still lets either fist satisfy an imported P, and either foot a K', () => {
    assert.equal(buttonSatisfies('P', ['LP']), true);
    assert.equal(buttonSatisfies('P', ['RP']), true);
    assert.equal(buttonSatisfies('K', ['LK']), true);
    assert.equal(buttonSatisfies('K', ['RK']), true);
    // And a per-limb step is exact, which is the whole point.
    assert.equal(buttonSatisfies('RK', ['LK']), false);
    assert.equal(buttonSatisfies('LP', ['RP']), false);
    assert.equal(buttonSatisfies('P', ['LK']), false);
  });
});

describe('an imported special actually comes out when you input it', () => {
  /** Drive a command through the buffer exactly as a player would. */
  function perform(command: { dirs: number[]; buttons: string[] }[], facing: Facing) {
    const buffer = createCommandBuffer();
    let t = 1000;
    for (const step of command) {
      const dir = step.dirs[0] ?? 5;
      const forward = (((dir - 1) % 3) - 1) as -1 | 0 | 1;
      const up = (Math.floor((dir - 1) / 3) - 1) as -1 | 0 | 1;
      // A world stick: for P2 forward is screen-LEFT, so invert.
      const x = (forward * facing) as -1 | 0 | 1;
      // A STEP NAMES A PATTERN; A PLAYER PRESSES A BUTTON. The corpus asks
      // for 'P', and a player answers it with a specific fist — so the test
      // has to choose one, exactly as the pad does.
      const concrete: Record<string, string> = { P: 'RP', K: 'RK' };
      const buttons: Record<string, boolean> = {};
      for (const b of step.buttons) buttons[concrete[b] ?? b] = true;
      pushInput(buffer, { x, y: up }, buttons, facing, (t += 60));
      // Release, so the next step's press is a fresh edge.
      pushInput(buffer, { x, y: up }, {}, facing, (t += 20));
    }
    return { buffer, now: t };
  }

  const specials = schwarzerblitzSpecials('chara_tutor');
  // MEASURED across the corpus: 27 commands are ONE step carrying a direction
  // (`6+P`, `2+K`) and 3 are multi-step motions. A one-step command with a
  // direction is a motion — it is `d/f+2`, not a bare button — so filtering for
  // length >= 2 threw away 90% of the command list.
  const candidates = specials.filter(
    (sp) => sp.command!.every((s) => !s.hold && s.dirs.length <= 1) &&
            (sp.command!.length >= 2 || sp.command![0].dirs.length > 0),
  );

  it('there are real commands to test', () => {
    assert.ok(candidates.length >= 10, `only ${candidates.length} testable commands`);
  });

  for (const facing of [P1, P2] as Facing[]) {
    it(`performing its own command fires the special (facing ${facing})`, () => {
      // The P2 case is the one that breaks when 'forward' is baked as world +X.
      let fired = 0;
      for (const sp of candidates.slice(0, 8)) {
        const { buffer, now } = perform(sp.command!, facing);
        const hit = matchCommand(
          specials.map((x) => ({ name: x.id, input: x.command!, stance: x.stance })),
          buffer,
          { now, stance: sp.stance },
        );
        if (hit) fired++;
      }
      assert.equal(fired, Math.min(8, candidates.length), `only ${fired} of 8 specials came out`);
    });
  }

  it('a lone button does NOT fire a special — the jab still works', () => {
    const buffer = createCommandBuffer();
    pushInput(buffer, { x: 0, y: 0 }, { RP: true }, P1, 500);
    const hit = matchCommand(
      specials.map((x) => ({ name: x.id, input: x.command!, stance: x.stance })),
      buffer,
      { now: 500, stance: 'Ground' },
    );
    assert.equal(hit, null, 'a bare punch fired a special');
  });

  it('a crouching command does not come out while standing', () => {
    const crouchers = specials.filter((sp) => sp.stance === 'Crouch' && sp.command!.length >= 2);
    if (!crouchers.length) return; // the set may have none; not a failure
    const sp = crouchers[0];
    const { buffer, now } = perform(sp.command!, P1);
    const standing = matchCommand(
      specials.map((x) => ({ name: x.id, input: x.command!, stance: x.stance })),
      buffer,
      { now, stance: 'Ground' },
    );
    assert.notEqual(standing?.move.name, sp.id, 'a crouch move came out standing');
  });
});
