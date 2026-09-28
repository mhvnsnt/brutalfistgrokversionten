/**
 * DOES THE MOVE WINDOW LET THE ANIMATION FINISH?
 *
 * Owner: "the animation plays very quickly. It really doesn't play long enough
 * to do a contact for real. It doesn't play long enough for the full animation
 * to play out. The move never looks like it makes contact."
 *
 * That is a duration mismatch and it is measurable with no browser at all, so
 * the harness frame rate cannot confound it. For every semantic attack slot:
 * how long is the clip the bake chose to own it, and how long does the state
 * machine let that move run before it moves on?
 *
 * A clip longer than its window is cut off mid-swing every single time it is
 * thrown -- the body starts the motion and is yanked to the next state before
 * the arm arrives, which is exactly "it never looks like it makes contact".
 */
import { DEFAULT_MOVE_WINDOWS } from '../../src/engine/combat/FighterStateMachine.ts';
import { SCHWARZERBLITZ_MOTION_BANK } from '../../src/generated/SchwarzerblitzMotionBank.generated.ts';
import { slotOwnerFor } from '../../src/engine/retarget/BakedMotionBank.ts';

const F = 1 / 60;
const dur = (name) => SCHWARZERBLITZ_MOTION_BANK?.[name]?.dur ?? null;

// The engine's four base attacks, and the semantic slot each one plays from.
const SLOTS = [
  ['lightAttack', 'attack_lp'],
  ['heavyAttack', 'attack_rp'],
  ['lightKick',   'attack_lk'],
  ['heavyKick',   'attack_rk'],
];

console.log('MOVE WINDOW vs CLIP LENGTH\n');
console.log('  move          window         clip                              clip len   plays   verdict');
let bad = 0;
for (const [move, semantic] of SLOTS) {
  const w = DEFAULT_MOVE_WINDOWS[move];
  if (!w) { console.log(`  ${move}: no window`); continue; }
  const frames = w.totalFrames ?? Math.round((w.startup + w.active + w.recovery) * 60);
  const windowS = frames * F;
  const owner = slotOwnerFor(semantic);
  const clipS = owner ? dur(owner) : null;
  const pct = clipS ? (windowS / clipS) * 100 : null;
  const verdict = clipS == null ? 'no clip resolved'
    : pct >= 98 ? 'ok -- the clip finishes'
    : `CUT: only ${pct.toFixed(0)}% of the animation plays`;
  if (pct != null && pct < 98) bad++;
  console.log(`  ${move.padEnd(13)} ${String(frames + 'f ' + windowS.toFixed(3) + 's').padEnd(14)} ${String(owner ?? '-').padEnd(33)} ${String(clipS != null ? clipS.toFixed(3) + 's' : '-').padEnd(10)} ${String(pct != null ? pct.toFixed(0) + '%' : '-').padEnd(7)} ${verdict}`);
}

// And the same question across every attack clip the bake owns, so this is not
// judged on four rows.
const all = [];
for (const [name, c] of Object.entries(SCHWARZERBLITZ_MOTION_BANK ?? {})) {
  if (typeof c?.dur === 'number') all.push({ name, dur: c.dur });
}
all.sort((a, b) => a.dur - b.dur);
const lightW = (DEFAULT_MOVE_WINDOWS.lightAttack.totalFrames ?? 20) * F;
const heavyW = (DEFAULT_MOVE_WINDOWS.heavyAttack.totalFrames ?? 39) * F;
const longerThanLight = all.filter((c) => c.dur > lightW).length;
const longerThanHeavy = all.filter((c) => c.dur > heavyW).length;
console.log(`\n  clips in the bank                : ${all.length}`);
console.log(`  median clip length               : ${all.length ? all[Math.floor(all.length / 2)].dur.toFixed(3) + 's' : '-'}`);
console.log(`  longer than the LIGHT window (${lightW.toFixed(3)}s): ${longerThanLight}  (${((100 * longerThanLight) / all.length).toFixed(0)}%)`);
console.log(`  longer than the HEAVY window (${heavyW.toFixed(3)}s): ${longerThanHeavy}  (${((100 * longerThanHeavy) / all.length).toFixed(0)}%)`);
console.log(`\n${bad ? `${bad} of ${SLOTS.length} base attacks are cut off before the animation finishes.` : 'every base attack lets its clip finish.'}`);
