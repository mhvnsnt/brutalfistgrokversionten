// `.ts` extensions on purpose — the repo's runner resolves them literally.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FighterStateMachine } from './FighterStateMachine.ts';

/**
 * THE GRAPPLE BUTTON.
 *
 * The HUD tells the player "V: GRAPPLE" and the button did nothing.
 * MEASURED by grep: `risingGrapple` appeared exactly twice in the whole
 * state machine — pushed into the input buffer, and queued during recovery
 * as `{ type: 'grapple' }`. The switch that executes a queued action had
 * cases for light, heavy, guard and commandThrow, so 'grapple' fell through
 * to `default`, which sets Idle. There was no neutral path at all.
 *
 * Throws were reachable only through Forward+Guard or the two-button
 * combinations, which is why the throw system read as half-built.
 */
const tick = (sm: FighterStateMachine, input: Record<string, unknown>, dt = 1 / 60) =>
  sm.update({ forward: 0, strafe: 0, light: false, heavy: false, guard: false, crouch: false, jump: false, ...input } as never, dt);

describe('the grapple button starts a throw', () => {
  it('fires on a rising grapple press from neutral', () => {
    const sm = new FighterStateMachine();
    tick(sm, {});
    tick(sm, { grapple: true });
    assert.equal(sm.action, 'CommandThrow', 'pressing grapple did not start a throw');
  });

  it('does not re-fire while the button is held', () => {
    const sm = new FighterStateMachine();
    tick(sm, {});
    tick(sm, { grapple: true });
    const first = sm.action;
    tick(sm, { grapple: true });
    assert.equal(first, 'CommandThrow');
    assert.equal(sm.action, 'CommandThrow');
  });
});
