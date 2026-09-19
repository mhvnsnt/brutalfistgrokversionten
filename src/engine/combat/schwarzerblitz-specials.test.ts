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
import { createCommandBuffer, matchCommand, pushInput, type Facing } from './CommandInput.ts';

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

describe('our four buttons drive a three-button command list', () => {
  it('either punch satisfies P, either kick satisfies K', () => {
    assert.deepEqual(commandButtonsFor({ lp: true }), { P: true, K: false, T: false });
    assert.deepEqual(commandButtonsFor({ rp: true }), { P: true, K: false, T: false });
    assert.deepEqual(commandButtonsFor({ lk: true }), { P: false, K: true, T: false });
    assert.deepEqual(commandButtonsFor({ rk: true }), { P: false, K: true, T: false });
    assert.deepEqual(commandButtonsFor({ grapple: true }), { P: false, K: false, T: true });
    assert.deepEqual(commandButtonsFor({}), { P: false, K: false, T: false });
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
      const buttons: Record<string, boolean> = {};
      for (const b of step.buttons) buttons[b] = true;
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
    pushInput(buffer, { x: 0, y: 0 }, { P: true }, P1, 500);
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
