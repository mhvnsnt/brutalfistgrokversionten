/**
 * TAKING AND GIVING DAMAGE — side by side with the Tekken bar.
 *
 * OWNER DECISION, 2026-09-27, AND IT IS FINAL. The numbers in the game NOW are the
 * ones he wants:
 *
 *   "No the amount of damage and attacks are good here cause after they were
 *    changed the fight ends too fast. So keep that the same and work on everything
 *    else."
 *
 * This has now been changed and reverted TWICE. It is not a bug and it is not a
 * mismatch to correct: a longer round is a design choice, and he is the one playing
 * it. THIS TOOL REPORTS AND DOES NOT GATE. Nothing here should ever be turned into
 * a failing check, and no future pass should "fix" these numbers toward the Tekken
 * fraction without him asking for it in those words.
 *
 * What it is still good for: the numbers BELOW the headline. If a throw ever stops
 * paying more than a jab, or a Rage Art stops paying more than a heavy, the SHAPE
 * has broken even though the totals are his — and that is worth seeing.
 *
 * Owner: "taking and giving damage needs a side by side Tekken audit cause it used
 * to be good in my game and got broken at some point."
 *
 * IT IS BROKEN, AND THE BREAK IS A UNIT MISMATCH. The health bar is 10,000. Every
 * damage number in the game is sized for a bar of about 175, which is the Tekken
 * one. Nothing multiplies between them — `applyIncomingHit` subtracts the figure as
 * it is given, and the only modifier anywhere is `scaledDamage`, a +/-20% strength
 * tweak. So the two halves of the system disagree by a factor of roughly fifty.
 *
 * THE ONLY HONEST WAY TO COMPARE TWO GAMES' DAMAGE IS AS A FRACTION OF THE BAR.
 * An absolute number means nothing across different health totals; "a jab costs
 * three percent of your life" transfers exactly. So every row here is a
 * percentage, and the reference column is the Tekken fraction:
 *
 *   jab                ~3%    of the bar
 *   mid-tier heavy    ~10%
 *   launcher combo    ~35-40%   (the whole combo, not the launcher)
 *   throw             ~20%
 *   rage art          ~30%+     it is supposed to decide a round
 *
 * and the number a player actually feels is HITS TO KO, which falls out of it.
 *
 * Usage:
 *   node --experimental-strip-types --import ./scripts/register-ts-resolve.mjs \
 *     tools/parity/damage_audit.ts
 */
import { readFileSync } from 'node:fs';
import { DEFAULT_MOVE_WINDOWS, CROUCH_MOVE_WINDOWS } from '../../src/engine/combat/FighterStateMachine.ts';
import { THROW_FORWARD_DAMAGE, THROW_BACKWARD_DAMAGE } from '../../src/engine/combat/DirectionalThrowSystem.ts';
import { FINISHER_DAMAGE, OVERDRIVE_DAMAGE } from '../../src/engine/combat/OverdriveSystem.ts';

/** The bar every fighter in the roster actually starts with. */
function rosterHealth(): number[] {
  const src = readFileSync('src/data/bannonRoster.ts', 'utf8');
  return [...src.matchAll(/hp:\s*(\d+)/g)].map((m) => Number(m[1]));
}

/** What a fraction of the bar the lineage spends on each thing. */
const TEKKEN_FRACTION: Record<string, [number, string]> = {
  'light punch (jab)':      [0.03, 'the cheapest poke in the game'],
  'light kick':             [0.035, ''],
  'heavy punch':            [0.10, 'a mid-tier heavy or launcher'],
  'heavy kick':             [0.10, ''],
  'crouch punch':           [0.025, 'a low poke'],
  'crouch kick':            [0.06, 'a low that is worth the risk of being parried'],
  'forward throw':          [0.20, 'a throw is a commitment and pays like one'],
  'back throw':             [0.24, 'harder to break, so it pays more'],
  'rage art':               [0.32, 'it is meant to decide a round'],
  'overdrive':              [0.12, ''],
};

const hp = rosterHealth();
const bar = hp.length ? hp[0] : 10000;
const sameBar = new Set(hp).size === 1;

const rows: Array<{ name: string; dmg: number; want: number; note: string }> = [
  ['light punch (jab)', DEFAULT_MOVE_WINDOWS.lightAttack.damage ?? 0],
  ['light kick', DEFAULT_MOVE_WINDOWS.lightKick.damage ?? 0],
  ['heavy punch', DEFAULT_MOVE_WINDOWS.heavyAttack.damage ?? 0],
  ['heavy kick', DEFAULT_MOVE_WINDOWS.heavyKick.damage ?? 0],
  ['crouch punch', CROUCH_MOVE_WINDOWS.crouchLightAttack.damage ?? 0],
  ['crouch kick', CROUCH_MOVE_WINDOWS.crouchHeavyAttack.damage ?? 0],
  ['forward throw', THROW_FORWARD_DAMAGE],
  ['back throw', THROW_BACKWARD_DAMAGE],
  ['rage art', FINISHER_DAMAGE],
  ['overdrive', OVERDRIVE_DAMAGE],
].map(([name, dmg]) => {
  const [want, note] = TEKKEN_FRACTION[name as string] ?? [0, ''];
  return { name: name as string, dmg: dmg as number, want, note };
});

console.log('\nDAMAGE, AS A FRACTION OF THE BAR — this game against the Tekken baseline\n');
console.log(`  bar: ${bar}${sameBar ? ' for every fighter' : ` (roster ranges ${Math.min(...hp)}-${Math.max(...hp)})`}`);
console.log(`  Tekken's bar is about 175, so an absolute number transfers between them only as a PERCENTAGE.\n`);
console.log('  move                  damage   % of bar   baseline   off by    hits to KO   want');
let worstFactor = 1;
for (const r of rows) {
  const frac = r.dmg / bar;
  const factor = r.want > 0 ? r.want / frac : 1;
  if (Number.isFinite(factor) && factor > worstFactor) worstFactor = factor;
  const hits = Math.ceil(bar / Math.max(1, r.dmg));
  const wantHits = r.want > 0 ? Math.ceil(1 / r.want) : 0;
  console.log(
    `  ${r.name.padEnd(20)} ${String(r.dmg).padStart(6)}   ${(frac * 100).toFixed(2).padStart(7)}%`
    + `   ${(r.want * 100).toFixed(0).padStart(7)}%   ${(`${factor.toFixed(1)}x`).padStart(6)}`
    + `   ${String(hits).padStart(10)}   ${String(wantHits).padStart(4)}`,
  );
}
console.log(`\n  worst mismatch: ${worstFactor.toFixed(1)}x too small`);
console.log(`  a round of jabs: ${Math.ceil(bar / (DEFAULT_MOVE_WINDOWS.lightAttack.damage ?? 1))} hits`
  + `  (baseline about ${Math.ceil(1 / TEKKEN_FRACTION['light punch (jab)'][0])})`);
console.log(`  a round of heavies: ${Math.ceil(bar / (DEFAULT_MOVE_WINDOWS.heavyAttack.damage ?? 1))} hits`
  + `  (baseline about ${Math.ceil(1 / TEKKEN_FRACTION['heavy punch'][0])})`);

// THE SHAPE, not the totals — this is the part that can actually be wrong.
// A longer round is the owner's call; a throw that pays less than a jab is not.
const by = (n: string) => rows.find((r) => r.name === n)?.dmg ?? 0;
const shape: Array<[string, boolean]> = [
  ['a heavy pays more than a jab', by('heavy punch') > by('light punch (jab)')],
  ['a throw pays more than a heavy', by('forward throw') > by('heavy punch')],
  ['a back throw pays more than a forward throw', by('back throw') > by('forward throw')],
  ['a rage art pays more than a throw', by('rage art') > by('forward throw')],
  ['a low poke pays less than a heavy', by('crouch punch') < by('heavy punch')],
];
console.log('\n  THE SHAPE — the totals are the owner\'s decision, the ordering is not:');
let broken = 0;
for (const [what, ok] of shape) {
  if (!ok) broken++;
  console.log(`    ${ok ? 'ok  ' : 'WRONG'} ${what}`);
}
console.log(`\n  Round length is a DESIGN CHOICE and the current numbers are the owner's, confirmed twice.`);
console.log('  The percentages above are information. Do not "fix" them toward the baseline unasked.');
if (broken) {
  console.error(`\n  ${broken} ordering(s) are wrong — that is a real defect even though the totals are intentional.`);
  process.exitCode = 1;
}
