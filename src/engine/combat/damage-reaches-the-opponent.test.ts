// `.ts` extensions on purpose — the repo's runner resolves them literally.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrameDataHitboxSystem } from './FrameDataHitbox.ts';
import { DEFAULT_MOVE_WINDOWS, FighterStateMachine } from './FighterStateMachine.ts';

/**
 * THE FLOOR UNDER THE WHOLE GAME: PUNCHING SOMEONE HURTS THEM.
 *
 * This exists because main shipped in a state where it did not. A revert took
 * `resolveHitRegionAtHeight` out of FrameDataHitbox.ts and left the call to it
 * on the line that decides whether an attack lands, so every connecting strike
 * threw a ReferenceError from inside checkCollision. Nobody took damage from a
 * strike, on any build carrying that commit. The owner played it and reported
 * "P2's not reacting or taking any damage", and his screenshots show his own
 * bar walking down while the opponent's sat at full for an entire round.
 *
 * CI ALREADY RAN `tsc --noEmit`, WHICH NAMES THAT BUG IN ONE LINE. A typecheck
 * gate that is green somewhere nobody reads is not a gate. But a typecheck is
 * also the narrow answer: it happens to catch this instance because the missing
 * symbol was typed. It would not catch a hitbox that stopped overlapping, a
 * damage value that resolved to zero, a region multiplier that came back
 * undefined, or a guard that swallowed every hit — all of which produce the
 * identical symptom of a fight where nothing lands.
 *
 * So this asserts the SYMPTOM rather than any one cause: drive a real attack
 * through the real state machine into the real hitbox, at a range and height
 * the fighters actually occupy, and require damage out the other end. It is
 * deterministic, it needs no browser, and it fails on the broken code.
 */
const NEUTRAL = {
  forward: 0, strafe: 0, light: false, heavy: false, guard: false, crouch: false,
};

/** Run a real attack and return the first collision it produces. */
function swingAt(gapMetres: number, opts: { blocking?: boolean; defenderY?: number } = {}) {
  const fsm = new FighterStateMachine();
  const hb = new FrameDataHitboxSystem();

  // Settle out of spawn, then throw a real punch through the real input path.
  for (let i = 0; i < 30; i++) fsm.update(NEUTRAL, 1 / 60);
  fsm.update({ ...NEUTRAL, lp: true }, 1 / 60);

  // Walk the move's frames, feeding the hitbox exactly as the arena does.
  for (let i = 0; i < 120; i++) {
    hb.update(fsm.getSweptHitboxWindow());
    const hit = hb.checkCollision(
      0, 0, 1,            // attacker at the origin, facing +X
      gapMetres, 0,       // defender this far along +X
      opts.blocking ?? false,
      i,
      opts.defenderY ?? 0,
      0,                  // attacker on the ground
    );
    if (hit) return hit;
    fsm.update(NEUTRAL, 1 / 60);
  }
  return null;
}

describe('a landed attack takes health off the other fighter', () => {
  it('deals damage at the range fighters actually stand at', () => {
    const hit = swingAt(0.75);
    assert.ok(hit, 'a jab at 0.75m connected with nothing — combat is dead');
    assert.equal(hit.hit, true);
    assert.ok(hit.damage > 0, `a connecting attack dealt ${hit.damage} damage`);
  });

  it('still reports a hit when the defender is blocking, as chip', () => {
    const hit = swingAt(0.75, { blocking: true });
    assert.ok(hit, 'a blocked attack resolved to nothing at all');
    assert.ok(hit.damage >= 0);
  });

  it('whiffs when the defender is out of range, rather than throwing', () => {
    assert.equal(swingAt(6), null);
  });

  /**
   * The move's own frame data has to be intact too: a startup or active window
   * of zero produces a hitbox that never opens, which reads on screen exactly
   * like the missing function did.
   */
  it('the default attacks all have frames in which they can hit', () => {
    for (const [name, move] of Object.entries(DEFAULT_MOVE_WINDOWS)) {
      assert.ok(move.active > 0, `${name} has no active frames, so it can never hit`);
      assert.ok(move.damage === undefined || move.damage > 0, `${name} deals no damage`);
    }
  });
});
