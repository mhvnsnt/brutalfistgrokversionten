/**
 * WHAT DOES A COMMAND THROW ACTUALLY PLAY, ON BOTH BODIES?
 *
 * Owner, from the phone: "he's visibly doing 1 punch, but somehow hitting me
 * like 7 times ... it's not throwing my character horizontal it's making them
 * do the launch and everything vertically ... he's doing the hit reaction, the
 * throw reaction and the spin all vertically ... when he should be blending
 * into the horizontal and actually receiving the grapple."
 *
 * A throw is the one move in the game that needs TWO clips on TWO bodies at the
 * same instant. This drives the REAL FighterStateMachine into a command throw
 * and then asks the REAL pairing module what the victim would be handed, using
 * the REAL baked manifest. No browser, no pixels -- the answer is all names.
 *
 * Read it as three lines:
 *   DELIVERER PLAYS : what the thrower's body does
 *   RECEIVER PLAYS  : what the victim's body does  (`null` = generic knockdown)
 *   VICTIM PHYSICS  : horizontal throw arc, or the vertical knockdown launch
 */
import fs from 'node:fs';
import { FighterStateMachine, COMMAND_THROW_MOVE, THROW_COMMIT_CLIP, THROW_SEPARATION_M } from '../../src/engine/combat/FighterStateMachine.ts';
import { markGrapplePairs, receiverClipFor, bakedGrapplePairs } from '../../src/engine/combat/GrapplePairing.ts';
import { SEMANTIC_STATE_ALIASES, COMBAT_STATE_TO_SEMANTIC } from '../../src/engine/retarget/SemanticStateAliases.ts';

const manifest = JSON.parse(fs.readFileSync('public/motion/baked/index.json', 'utf8'));
markGrapplePairs(manifest);
const inBank = (c) => Boolean(manifest[c]);

/** The mesh's own resolution: a state name -> a semantic slot -> the first clip present. */
function clipForState(state) {
  const slot = COMBAT_STATE_TO_SEMANTIC[state] ?? state;
  const cands = SEMANTIC_STATE_ALIASES[slot] ?? [];
  return { slot, clip: cands.find(inBank) ?? null, candidates: cands.filter(inBank) };
}

const NEUTRAL = { forward: 0, strafe: 0, light: false, heavy: false, guard: false, crouch: false };
const DT = 1 / 60;

// ── drive a real command throw ───────────────────────────────────────────────
const sm = new FighterStateMachine();
let motion = null;
sm.update({ ...NEUTRAL, grapple: true }, DT);
for (let i = 0; i < 6; i++) motion = sm.update({ ...NEUTRAL, grapple: false }, DT);

console.log('COMMAND THROW, driven through the real state machine');
console.log('   actionState          :', sm.action);
console.log('   motionState (drives the mesh):', sm.current);
console.log('   activeClip()         :', sm.activeClip());
console.log('   move.animation       :', COMMAND_THROW_MOVE.animation);
console.log('   move.clip            :', COMMAND_THROW_MOVE.clip ?? '(none declared)');
console.log('   damage               :', COMMAND_THROW_MOVE.damage,
            '+ auto combo route', JSON.stringify(COMMAND_THROW_MOVE.throwComboRoute ?? []));

// ── what each name resolves to ───────────────────────────────────────────────
const viaMotion = clipForState(sm.current);
const viaAction = clipForState(sm.action);
console.log('\nRESOLUTION');
console.log(`   by motionState "${sm.current}" -> slot ${viaMotion.slot} -> ${viaMotion.clip}`);
console.log('        semantic of that clip:', viaMotion.clip ? manifest[viaMotion.clip].semantic : '-');
console.log(`   by actionState "${sm.action}" -> slot ${viaAction.slot} -> ${viaAction.clip}`);
console.log('        semantic of that clip:', viaAction.clip ? manifest[viaAction.clip].semantic : '-');

// ── the victim's half ────────────────────────────────────────────────────────
console.log('\nTHE VICTIM');
for (const [label, clip] of [['what it plays now', viaMotion.clip], ['if it used the grapple slot', viaAction.clip]]) {
  const pick = clip ? receiverClipFor(clip, { available: inBank }) : null;
  console.log(`   deliverer ${String(clip).padEnd(22)} (${label})`);
  console.log(`      -> receiver: ${pick ? pick.receiver + '  [' + pick.kind + ']' : 'null  ==> GENERIC KNOCKDOWN (vertical launch + spin)'}`);
}

// ── and once the grab has CAUGHT ────────────────────────────────────────────
sm.resolveCommandThrow(true);
const committed = sm.activeClip();
const cpick = committed ? receiverClipFor(committed, { available: inBank }) : null;
console.log('\nAFTER THE GRAB CATCHES (resolveCommandThrow(true))');
console.log('   deliverer plays :', committed, committed ? '(' + manifest[committed].semantic + ', ' + manifest[committed].dur + 's)' : '');
console.log('   victim plays    :', cpick ? cpick.receiver + '  [' + cpick.source + ', ' + cpick.dur + 's]' : 'null  <== STILL BROKEN');
console.log('   separation      :', THROW_SEPARATION_M, 'm horizontal (Schwarzerblitz #starting_distance 34)');
console.log('   commit clip is a paired deliverer?', bakedGrapplePairs().has(THROW_COMMIT_CLIP) ? 'YES' : 'NO');

console.log('\nPAIRED DELIVERERS IN THE BANK:', bakedGrapplePairs().size);
const grappleSlot = (SEMANTIC_STATE_ALIASES.grapple ?? []).filter(inBank);
console.log('   grapple slot clips present:', grappleSlot.join(', ') || '(none)');
console.log('   ...of those, PAIRED       :',
  grappleSlot.filter((c) => bakedGrapplePairs().has(c)).join(', ') || '(none)');
