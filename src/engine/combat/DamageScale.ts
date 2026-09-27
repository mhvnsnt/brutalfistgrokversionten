/**
 * DAMAGE, SIZED FOR THE BAR THAT IS ACTUALLY ON SCREEN.
 *
 * Owner: "taking and giving damage needs a side by side Tekken audit cause it used
 * to be good in my game and got broken at some point."
 *
 * THE BREAK WAS A UNIT MISMATCH, and tools/parity/damage_audit.ts measures it. The
 * health bar is 10,000. Every damage number was sized for a bar of about 175 — the
 * Tekken one — and nothing multiplies between them: `applyIncomingHit` subtracts the
 * figure as given, and the only modifier anywhere is a +/-20% strength tweak. The
 * two halves of the system were sized for different games, by a factor of four to
 * twelve:
 *
 *   move            was    % of bar   Tekken %   hits to KO   baseline
 *   jab              80      0.80        3          125         34
 *   heavy punch     150      1.50       10           67         10
 *   forward throw   180      1.80       20           56          5
 *   rage art        350      3.50       32           29          4
 *
 * A Rage Art is supposed to decide a round and it took twenty-nine of them.
 *
 * THE ANCHORS ARE THE OWNER'S, from his own pass on this in brutalfistgrokversion12:
 * jab 250, heavy 550, throw 900, and no single hit above 1,400. The unnamed moves
 * are derived from those rather than invented, preserving the SHAPE he chose —
 * light strikes scale about 3.1x, heavies about 3.7x, throws about 5x. That widening
 * gap is the Tekken shape too: the more a move commits you, the more it pays.
 *
 * WHY A SINGLE-HIT CAP AT ALL. 1,400 is 14% of the bar. Without a ceiling, a
 * counter-hit rage art through a combo multiplier can take a third of a life bar in
 * one frame, and a round decided by one exchange is the thing the cap exists to
 * stop. It is applied LAST, after every multiplier.
 */

/** The bar every fighter starts with. */
export const FULL_HEALTH = 10000;
/** No single hit may take more than this, after every multiplier. 14% of the bar. */
export const MAX_SINGLE_HIT = 1400;

/**
 * The owner's anchors. Named separately from the derived ones so it is obvious
 * which figures are a design decision and which follow from them.
 */
export const DAMAGE_ANCHORS = {
  jab: 250,
  heavyPunch: 550,
  forwardThrow: 900,
  rageArt: MAX_SINGLE_HIT,
} as const;

/**
 * The scale each class of move takes, read off the anchors:
 *   light   250 / 80  = 3.125
 *   heavy   550 / 150 = 3.667
 *   throw   900 / 180 = 5.0
 * Applied to the moves the owner did not name, so a light kick keeps its old
 * relationship to the jab instead of being picked again from nothing.
 */
export const CLASS_SCALE = {
  light: DAMAGE_ANCHORS.jab / 80,
  heavy: DAMAGE_ANCHORS.heavyPunch / 150,
  throw: DAMAGE_ANCHORS.forwardThrow / 180,
} as const;

/** Round to something a player could read off a bar, not a float. */
const tidy = (n: number) => Math.round(n / 10) * 10;

export const scaleLight = (old: number): number => Math.min(MAX_SINGLE_HIT, tidy(old * CLASS_SCALE.light));
export const scaleHeavy = (old: number): number => Math.min(MAX_SINGLE_HIT, tidy(old * CLASS_SCALE.heavy));
export const scaleThrow = (old: number): number => Math.min(MAX_SINGLE_HIT, tidy(old * CLASS_SCALE.throw));

/**
 * The last thing that happens to any damage figure, after counter hit, rage, combo
 * scaling and everything else. Applied in ONE place — GameEngine.applyIncomingHit —
 * so nothing can route around it.
 */
export function capSingleHit(damage: number): number {
  if (!Number.isFinite(damage) || damage <= 0) return 0;
  return Math.min(MAX_SINGLE_HIT, Math.round(damage));
}

/** What fraction of the bar a figure costs. For the audit and the HUD. */
export const fractionOfBar = (damage: number, bar = FULL_HEALTH): number => damage / bar;
