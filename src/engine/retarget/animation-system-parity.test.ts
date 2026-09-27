/**
 * THE TWO ANIMATION SYSTEMS MUST AGREE ON WHAT A STATE IS.
 *
 * This repo has two, and that split is where nearly every animation defect in
 * this project has hidden:
 *
 *   AnimationController   SemanticStateAliases, the FighterMotionState union,
 *                         its own crossfade table
 *   FighterMesh           its OWN CLIP_ALIASES, its own fade table, its own
 *                         urgency lists — AND IT IS THE LIVE PLAYBACK PATH in a
 *                         match, confirmed by the browser probe reading its
 *                         actions at weight 1
 *
 * Adding a motion state to one and not the other produces a state that
 * resolves, type-checks, passes its own unit tests, and CANNOT PLAY. That is
 * exactly what happened to hitAir / hitBack / hitGround, which shipped into the
 * union, the semantic table, the fallback chain and the frame data while
 * FighterMesh had never heard of them — and to `wake`, which MoveLibrary files
 * clips under ('Getting Up', 'bf_wakeup', 'SBW_wakeup') and which had no clip
 * list here at all.
 *
 * So this is a PARITY gate, not a list of states. It reads the union and asks
 * both systems about every member. A state added in future is covered the day
 * it is added.
 *
 * Read from source on purpose: FighterMesh is a React component that pulls in
 * three.js and the whole renderer, and a parity check must not need a GPU.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const CTRL = 'src/engine/retarget/AnimationController.ts';
const ALIAS = 'src/engine/retarget/SemanticStateAliases.ts';
const MESH = 'src/components/FighterMesh.tsx';

/** Every value of the FighterMotionState union, read off the union itself. */
function motionStates(): string[] {
  const src = readFileSync(CTRL, 'utf8');
  const start = src.indexOf('export type FighterMotionState');
  assert.ok(start >= 0, 'FighterMotionState union not found');
  const end = src.indexOf("'intro';", start);
  assert.ok(end > start, 'the union no longer ends at intro — update this reader');
  const body = src.slice(start, end + "'intro';".length);
  return [...new Set([...body.matchAll(/'([A-Za-z_][A-Za-z0-9_]*)'/g)].map((m) => m[1]))];
}

const keyed = (src: string, state: string, value: string) =>
  new RegExp(`\\n\\s*${state}:\\s*${value}`).test(src);

describe('the two animation systems agree on every motion state', () => {
  const states = motionStates();
  const alias = readFileSync(ALIAS, 'utf8');
  const mesh = readFileSync(MESH, 'utf8');

  it('the union is not empty and has not drifted out of reach of this test', () => {
    assert.ok(states.length > 40, `only ${states.length} motion states parsed — the reader is broken`);
  });

  it('every state maps to a semantic in SemanticStateAliases', () => {
    const missing = states.filter((s) => !keyed(alias, s, "'"));
    assert.deepEqual(missing, [], `no semantic mapping for: ${missing.join(', ')}`);
  });

  it('every state has a clip list in FighterMesh, which is what actually plays', () => {
    const missing = states.filter((s) => !keyed(mesh, s, '\\['));
    assert.deepEqual(missing, [],
      `FighterMesh cannot resolve a clip for: ${missing.join(', ')}. `
      + 'A state known only to AnimationController type-checks and cannot play.');
  });

  /**
   * NOT GATED, AND THE REASON IS WORTH WRITING DOWN.
   *
   * 17 states carry no entry in FighterMesh's FADE_DURATIONS. That is NOT the
   * same defect as a missing clip list. The blend is measured first
   * (BlendDuration, from the pose distance between the live skeleton and the
   * incoming clip's first frame) and the table is only the fallback for a
   * transition that cannot be measured — where DEFAULT_FADE is a reasonable
   * answer. Requiring an entry per state would be inventing a rule and then
   * filling 17 cells with numbers nobody measured, which is the hand-tooling
   * this project keeps having to undo.
   *
   * So this reports and does not fail. If one of these ever looks wrong in
   * play, measure that transition and author THAT cell.
   */
  it('reports which states fall back to the default blend', () => {
    const defaulted = states.filter((s) => !keyed(mesh, s, '0?\\.\\d'));
    assert.ok(Array.isArray(defaulted));
    if (defaulted.length) {
      console.log(`      [parity] ${defaulted.length} states use DEFAULT_FADE: ${defaulted.join(', ')}`);
    }
  });
});
