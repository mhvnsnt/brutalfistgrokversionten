/**
 * Owner, from the phone: "he's visibly doing 1 punch, but somehow hitting me
 * like 7 times really fast ... it's not throwing my character horizontal it's
 * making them do the launch and everything vertically ... he's doing the hit
 * reaction the throw reaction and the spin all vertically when he should be
 * blending into the horizontal and actually receiving the grapple."
 *
 * He was reading the screen correctly, and all of it came from one line:
 * `beginCommandThrow` hard-set `motionState = 'heavyAttack'`, which resolves
 * through the semantic slot table to attack_rp -> UPPERCUT. So the throw played
 * a PUNCH, and because UPPERCUT is not a deliverer the bake paired, the victim's
 * half never resolved and he fell back to the generic vertical knockdown.
 *
 * These are the invariants that stop it coming back.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FighterStateMachine,
  COMMAND_THROW_MOVE,
  THROW_COMMIT_MOVE,
  THROW_COMMIT_CLIP,
  THROW_SEPARATION_M,
} from './FighterStateMachine.ts';
import { COMBAT_STATE_TO_SEMANTIC, SEMANTIC_STATE_ALIASES } from '../retarget/SemanticStateAliases.ts';

const NEUTRAL = {
  forward: 0, strafe: 0, light: false, heavy: false, guard: false, crouch: false,
};
const DT = 1 / 60;

/** Drive a real grab through the real state machine. */
function grabbing() {
  const sm = new FighterStateMachine();
  sm.update({ ...NEUTRAL, grapple: true }, DT);
  for (let i = 0; i < 6; i++) sm.update({ ...NEUTRAL }, DT);
  return sm;
}

test('the grab does not play a punch', () => {
  const sm = grabbing();
  assert.equal(sm.action, 'CommandThrow');
  assert.notEqual(sm.current, 'heavyAttack', 'the throw was playing a punch again');
  assert.equal(sm.current, 'grapple');
});

test('the grab names its own clip instead of leaving it to a fuzzy slot lookup', () => {
  assert.equal(COMMAND_THROW_MOVE.clip, 'THROWSTART');
  assert.equal(grabbing().activeClip(), 'THROWSTART');
});

test('the grab resolves to a grapple slot, never to attack_rp', () => {
  const slot = COMBAT_STATE_TO_SEMANTIC[grabbing().current] ?? grabbing().current;
  assert.equal(slot, 'grapple');
  assert.notEqual(slot, 'attack_rp');
  // and the slot it lands in must actually offer throw clips
  assert.ok((SEMANTIC_STATE_ALIASES.grapple ?? []).includes('THROWSTART'));
});

test('a caught grab hands off to the throw itself', () => {
  const sm = grabbing();
  sm.resolveCommandThrow(true);
  assert.equal(sm.activeClip(), THROW_COMMIT_CLIP,
    'the thrower stood in the grab pose while the victim was already down');
  assert.equal(sm.current, 'grapple');
});

test('the commit clip is the one the victim half is looked up by', () => {
  assert.equal(THROW_COMMIT_MOVE.clip, THROW_COMMIT_CLIP);
  // The commit bills no damage of its own -- the grab that caught already did.
  assert.equal(THROW_COMMIT_MOVE.damage, 0);
});

test('a whiffed grab still cancels into recovery and plays no throw', () => {
  const sm = grabbing();
  sm.resolveCommandThrow(false);
  assert.equal(sm.action, 'ThrowWhiff');
  assert.notEqual(sm.activeClip(), THROW_COMMIT_CLIP);
});

test('the separation is horizontal and non-zero', () => {
  // Schwarzerblitz `#starting_distance 34` for kneeThrow_slow. A thrown man
  // travels sideways by this much; zero is what made him launch straight up.
  assert.ok(THROW_SEPARATION_M > 0, 'no horizontal separation = a vertical launch');
  assert.equal(THROW_SEPARATION_M, 0.34);
});

test('a throw with its own animation is not overridden by the generic path', () => {
  // beginCommandThrowWithMove used to hard-set 'heavyAttack' too, throwing away
  // whatever animation the specific throw declared.
  const sm = new FighterStateMachine();
  const custom = { ...COMMAND_THROW_MOVE, animation: 'grapple' as const, clip: 'DDT' };
  // @ts-expect-error -- reaching the private starter is the point of the test
  sm.beginCommandThrowWithMove(custom);
  assert.equal(sm.current, 'grapple');
  assert.equal(sm.activeClip(), 'DDT');
});
