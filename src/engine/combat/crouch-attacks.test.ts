/**
 * DOWN + BUTTON. Owner: "if I press forward and kick, that it's crouching and
 * doing a kick when that should be at the down and kick."
 *
 * Two halves, both real. The standing light kick resolved to a crouched clip
 * (covered by the posture gate in baked-motion.test.ts), and NOTHING IN THE
 * ENGINE COULD EVER ENTER crouchLightAttack OR crouchHeavyAttack — both have had
 * frame data since MoveLibrary was written and the standing attack checks came
 * first, matching on the button alone. These cases fail if that ordering comes
 * back.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FighterStateMachine, CROUCH_MOVE_WINDOWS, type FighterInput } from './FighterStateMachine.ts';

const NEUTRAL: FighterInput = {
  forward: 0, strafe: 0, light: false, heavy: false, guard: false, crouch: false,
  grapple: false, escape: false,
} as FighterInput;

const input = (over: Partial<FighterInput>): FighterInput => ({ ...NEUTRAL, ...over });

/** A press is a RISING edge, so a released frame has to come first. */
function press(fsm: FighterStateMachine, held: Partial<FighterInput>) {
  fsm.update(input({ crouch: held.crouch ?? false }), 1 / 60);
  return fsm.update(input(held), 1 / 60);
}

describe('down + button', () => {
  it('gives a crouching kick, not the standing one', () => {
    const fsm = new FighterStateMachine();
    const state = press(fsm, { crouch: true, lk: true });
    assert.equal(state, 'crouchHeavyAttack', `down+kick landed on ${state}`);
  });

  it('gives a low punch on down + punch', () => {
    const fsm = new FighterStateMachine();
    const state = press(fsm, { crouch: true, light: true });
    assert.equal(state, 'crouchLightAttack', `down+punch landed on ${state}`);
  });

  it('still gives the standing kick when not crouching', () => {
    const fsm = new FighterStateMachine();
    const state = press(fsm, { lk: true });
    assert.equal(state, 'lightKick', `a standing kick landed on ${state}`);
  });

  it('reads down-forward as movement, not as a crouch', () => {
    // Otherwise every walking attack becomes a low, and the owner's report was
    // that a FORWARD press was already giving him a crouching kick.
    const fsm = new FighterStateMachine();
    const state = press(fsm, { crouch: true, forward: 1, lk: true });
    assert.equal(state, 'lightKick', `down-forward + kick landed on ${state}`);
  });

  it('strikes low, so a low genuinely passes under a jump', () => {
    assert.equal(CROUCH_MOVE_WINDOWS.crouchLightAttack.attackLevel, 'low');
    assert.equal(CROUCH_MOVE_WINDOWS.crouchHeavyAttack.attackLevel, 'low');
  });

  it('is faster than the standing attack it replaces', () => {
    const crouch = CROUCH_MOVE_WINDOWS.crouchHeavyAttack;
    assert.ok(crouch.startup < 0.14, `a crouching kick should beat the standing kick's 0.14s startup, has ${crouch.startup}`);
    assert.ok(crouch.damage! < 170, 'and pay for it in damage');
  });
});
