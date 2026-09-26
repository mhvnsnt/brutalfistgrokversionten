// `.ts` extensions on purpose — the repo's runner resolves them literally.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { SCHWARZERBLITZ_MOVE_GRAPH } from '../../generated/SchwarzerblitzMoveGraph.generated.ts';
import { type StickReading, createCommandBuffer, pushInput } from './CommandInput.ts';
import {
  DEFAULT_MOVE_WINDOWS, FighterStateMachine,
  type FighterInput, type MoveWindow,
} from './FighterStateMachine.ts';
import { moveWindowFor } from './SchwarzerblitzSpecials.ts';

const NEUTRAL: FighterInput = {
  forward: 0, strafe: 0, light: false, heavy: false, guard: false, crouch: false,
};

/**
 * Throw a move through the REAL path — registered as a special, fed through
 * the motion-input buffer, and fired by a real directional press — rather than
 * reaching past the input system.
 *
 * That distinction is not pedantry here. The first version of this test called
 * the state machine without attaching a command buffer, so the special could
 * never match and a bare LP fell through to the DEFAULT light attack, which
 * carries no end stance. The test failed, the implementation was correct, and
 * the only thing wrong was that the move under test never ran.
 */
function throwMove(fsm: FighterStateMachine, move: MoveWindow) {
  const buffer = createCommandBuffer();
  fsm.attachCommandBuffer(buffer);
  fsm.registerSpecialMoves([{
    id: 'stance_test', name: 'stance_test', sequence: [],
    command: [{ dirs: [6], buttons: ['P'] }], move,
  } as never]);

  let now = 1000;
  const step = (stick: StickReading, buttons: Record<string, boolean>, input = NEUTRAL) => {
    now += 16;
    pushInput(buffer, stick, buttons, 1, now);
    fsm.setCommandStance('Ground');
    fsm.update(input, 1 / 60);
  };

  for (let i = 0; i < 20; i++) step({ x: 0, y: 0 }, {});
  step({ x: 1, y: 0 }, {}, { ...NEUTRAL, forward: 1 });
  step({ x: 1, y: 0 }, { LP: true }, { ...NEUTRAL, forward: 1, lp: true });

  let attacked = false;
  for (let i = 0; i < 400; i++) {
    step({ x: 0, y: 0 }, {});
    if (fsm.action === 'Attacking') attacked = true;
    if (attacked && fsm.action === 'Idle') break;
  }
  assert.ok(attacked, 'the move under test never ran — the test is measuring nothing');
}

describe('a move can leave you in a different stance', () => {
  /**
   * Stance was read off the pad every frame, so a move could never leave you
   * anywhere: let go of down and you were standing again on the next frame.
   * That made #NEWSTANCE — 50 authored transitions, and the whole grounded,
   * rising and wake-up layer of the genre — unreadable by construction.
   */
  it('a move that ends crouching leaves the fighter crouching', () => {
    const fsm = new FighterStateMachine();
    throwMove(fsm, { ...DEFAULT_MOVE_WINDOWS.lightAttack, endStance: 'Crouch' });
    assert.equal(fsm.stance, 'Crouch');
  });

  it('a move with no end stance leaves the pad in charge', () => {
    const fsm = new FighterStateMachine();
    throwMove(fsm, DEFAULT_MOVE_WINDOWS.lightAttack);
    assert.equal(fsm.stance, 'Ground');
  });

  /**
   * THE PLAYER IS NEVER STUCK. A stance a move chose survives a neutral pad,
   * but any deliberate input takes it back — otherwise a sweep that ends
   * crouching would be a trap rather than a position.
   */
  it('a deliberate input takes the stance back from the move', () => {
    const fsm = new FighterStateMachine();
    throwMove(fsm, { ...DEFAULT_MOVE_WINDOWS.lightAttack, endStance: 'Crouch' });
    assert.equal(fsm.stance, 'Crouch');
    fsm.setCommandStance('Running');
    assert.equal(fsm.stance, 'Running');
    fsm.setCommandStance('Ground');
    assert.equal(fsm.stance, 'Ground', 'Running was the pad, so releasing it stands you up');
  });

  it('a move that ends on the ground clears a stance it was thrown from', () => {
    const fsm = new FighterStateMachine();
    throwMove(fsm, { ...DEFAULT_MOVE_WINDOWS.lightAttack, endStance: 'Crouch' });
    throwMove(fsm, { ...DEFAULT_MOVE_WINDOWS.lightAttack, endStance: 'Ground' });
    assert.equal(fsm.stance, 'Ground');
  });
});

describe('the imported transitions survive into move windows', () => {
  const moves = Object.values(SCHWARZERBLITZ_MOVE_GRAPH).flat();

  it('carries an end stance for every move that authors one', () => {
    const authored = moves.filter((m) => m.newStance && m.newStance !== m.stance);
    assert.ok(authored.length > 30, `only ${authored.length} authored transitions found`);
    const carried = authored.filter((m) => moveWindowFor(m).endStance === m.newStance);
    assert.equal(carried.length, authored.length, 'some authored transitions are dropped building the move window');
  });

  it('does not invent one for a move that stays put', () => {
    const same = moves.find((m) => m.newStance && m.newStance === m.stance);
    if (same) assert.equal(moveWindowFor(same).endStance, undefined);
  });

  /** The wake-up layer specifically — the reason this is worth having. */
  it('carries the getting-up moves', () => {
    const named = ['Ukemi', 'SupineReversal'];
    for (const name of named) {
      const m = moves.find((x) => x.name === name);
      if (!m) continue;
      assert.equal(moveWindowFor(m).endStance, 'Ground', `${name} should stand you up`);
    }
  });
});
