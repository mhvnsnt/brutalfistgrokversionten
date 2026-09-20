// `.ts` extensions on purpose — the repo's runner resolves them literally.
import { clipCanStand, clipIsAuthoredPose } from '../retarget/BakedMotionBank.ts';

/**
 * THE INTRO BEFORE THE BELL — one fighter at a time, with a pose and a line.
 *
 * Owner: "sometimes the fighters do show, but they'll be frozen in T pose or
 * in A pose ... like statues ... I kind of want to set up where they have a
 * cycle of taunts ... kind of like how Tekken does, and Mortal Kombat and
 * Street Fighter with its characters when you choose them at the beginning ...
 * one at a time ... sometimes a kind of interactive multi-scene type of thing,
 * depending on the character relationship."
 *
 * THE MATERIAL WAS ALREADY SHIPPED AND UNREACHABLE. The Schwarzerblitz bank
 * carries real character INTRO POSES — JOHNSONINTROPOSE 1/2/3, TIGERINTROPOSE
 * 1/2, the win poses, the breakdance set, RAPIDCHESTBEATING, TAU_DIVA — and
 * nothing in the game had ever played one. The pre-fight camera pan ran over
 * fighters standing in bind pose, which is the statue.
 *
 * NOTHING HERE IS INVENTED PER CHARACTER. A fighter's demeanour is read off
 * the `personality` prose the roster already authors, exactly the way
 * CharacterStances reads an archetype off `fightingStyle`, and the
 * relationship between two fighters is read off their `factionAlignment`.
 * So a character added tomorrow gets an intro the day it is added, and no
 * table has to grow by one row per fighter.
 *
 * NAMING LAW: every clip key names the MOTION. No real person's name reaches
 * an asset key from here.
 */

/** What a fighter is like when the camera finds them. Derived, never authored. */
export type Demeanour =
  | 'silent' | 'theatrical' | 'cold' | 'feral' | 'proud' | 'manic' | 'analytical';

/** How two fighters stand in relation to each other, from their alignments. */
export type Relationship =
  | 'war'        // alliance vs corporate — the canon conflict
  | 'civilWar'   // same banner, forced to fight
  | 'chaos'      // one of them does not care what this is
  | 'mercenary'  // an independent taking a booking
  | 'grudge';    // an authored, named feud

export interface IntroBeat {
  /** Whose beat this is. */
  player: 'p1' | 'p2';
  /** The clip the body plays. Always checked against the floor before use. */
  clip: string;
  /** What appears on screen. There is no voice cast; the line is text. */
  line: string;
  /** How long this beat holds, in ms. */
  ms: number;
}

/**
 * Ordered: the FIRST pattern that matches the personality prose wins, so a
 * specific read beats a generic one. Same shape as STYLE_PATTERNS in
 * CharacterStances, for the same reason — the roster's own words decide.
 */
const DEMEANOUR_PATTERNS: Array<[Demeanour, RegExp]> = [
  ['manic',      /manic|volatile|loose cannon|chaos|laughs|never stops|shouts|hilarious/i],
  ['theatrical', /theatrical|performance|spotlight|self-absorbed|showman|charisma|promo|flair/i],
  ['feral',      /fury|charging bull|territorial|brutal|ferocious|fierce|savage|rage/i],
  ['cold',       /cold|calculating|ruthless|predator|clinical|surgical|no pain|detached/i],
  ['analytical', /analytical|methodical|studies|technique|observes|patient|precision|numerolog/i],
  ['proud',      /proud|honorable|honourable|loyal|heritage|respected|unapologetic/i],
  ['silent',     /silent|quiet|speaks little|through action|ghost|stares|imposing|stoic/i],
];

export function demeanourOf(personality: string | undefined): Demeanour {
  const text = personality ?? '';
  // THE FIRST SENTENCE WINS — the same trap CharacterStances already
  // documents for fightingStyle, and my own test caught it here. These are
  // written headline-first: "Proud and honorable. Fights with passion and
  // flair." Matching the whole string at once let `flair` make a proud
  // fighter theatrical. The opening sentence is what the character IS; the
  // rest is detail.
  const headline = text.split(/[.!?]/)[0] ?? '';
  for (const [d, pattern] of DEMEANOUR_PATTERNS) if (pattern.test(headline)) return d;
  for (const [d, pattern] of DEMEANOUR_PATTERNS) if (pattern.test(text)) return d;
  return 'silent';
}

/**
 * The intro pose pool per demeanour, most characteristic first.
 *
 * SEVERAL EACH, ON PURPOSE. A single pose per demeanour would put every
 * silent fighter in one shot, which is the exact failure CharacterStances
 * exists to fix. The cycle (see `introBeatFor`) then moves through them so the
 * same character does not open the same way twice running.
 *
 * TPOSE IS DELIBERATELY ABSENT and must never be added. It is in the baked
 * bank, it is perfectly standable, and it is the literal thing the owner is
 * complaining about.
 */
const INTRO_POSES: Record<Demeanour, string[]> = {
  silent:     ['JOHNSONINTROPOSE', 'JOHNSON_STANCE', 'GRAFSTANCE3', 'JOHNSONINTROPOSE3'],
  theatrical: ['TAU_DIVA', 'JOHNSONWINPOSE', 'BREAKDANCE_READY', 'JOHNSONINTROPOSE2'],
  cold:       ['GRAFSTANCE3', 'JOHNSONINTROPOSE3', 'SHAZSTANCE', 'JOHNSON_STANCE'],
  feral:      ['RAPIDCHESTBEATING', 'TIGERINTROPOSE', 'TIGERWINPOSE', 'TIGERSTANCE'],
  proud:      ['TIGERINTROPOSE2', 'TIGERWINPOSE', 'JOHNSONWINPOSE', 'GRAFSTANCE2'],
  manic:      ['BREAKDANCE_READY', 'BREAKDANCE_FOOTWORK_3', 'TAU_DIVA', 'RAPIDCHESTBEATING'],
  analytical: ['GRAFSTANCE2', 'TIGERSTANCEUPDATED', 'GRAFSTANCE3', 'JOHNSONINTROPOSE'],
};

/**
 * Authored feuds, from the books rather than derived.
 *
 * SMALL ON PURPOSE — this is the exception list, not the mechanism. The
 * relationship for every other pairing falls out of faction alignment, so
 * this never needs a row per pairing. Keys are sorted-id pairs.
 */
const AUTHORED_GRUDGES: Record<string, [string, string]> = {
  // Finxsse's own bio: he "calls Bannon a corporate sell-out" and a traitor.
  'bannon|finxsse': [
    'You wore the mask so long you forgot the face under it.',
    'You talk. I build. Neither of us stops tonight.',
  ],
};

function grudgeKey(a: string, b: string): string {
  return [a.toLowerCase(), b.toLowerCase()].sort().join('|');
}

export function relationshipBetween(
  a: { id: string; factionAlignment: string },
  b: { id: string; factionAlignment: string },
): Relationship {
  if (AUTHORED_GRUDGES[grudgeKey(a.id, b.id)]) return 'grudge';
  if (a.factionAlignment === 'chaos' || b.factionAlignment === 'chaos') return 'chaos';
  if (a.factionAlignment === b.factionAlignment) return 'civilWar';
  const pair = new Set([a.factionAlignment, b.factionAlignment]);
  if (pair.has('alliance') && pair.has('corporate')) return 'war';
  return 'mercenary';
}

/**
 * What a fighter says, by who they are and who is across from them.
 *
 * Text, not voice: there is no cast, and a silent intro with a caption reads
 * as deliberate where a silent intro with nothing reads as broken.
 */
const LINES: Record<Relationship, Record<Demeanour, string>> = {
  war: {
    silent:     'Nothing you own is in this ring.',
    theatrical: 'They paid for a show. You are the show.',
    cold:       'A contract is not a spine. Yours will learn the difference.',
    feral:      'Bring the whole building. I will still be standing on it.',
    proud:      'I fight for people with names. You fight for a letterhead.',
    manic:      'Oh, they sent YOU. Wonderful. Wonderful!',
    analytical: 'I have read your last nine matches. You repeat at minute four.',
  },
  civilWar: {
    silent:     'No hard feelings. No soft ones either.',
    theatrical: 'Same colours, better angles. Watch.',
    cold:       'Loyalty is a schedule. Tonight it has a gap.',
    feral:      'I like you. That has never slowed me down.',
    proud:      'We shake after. Not before.',
    manic:      'Friends! Friends. This is going to hurt SO much.',
    analytical: 'I know your tells. That is the problem with training together.',
  },
  chaos: {
    silent:     'Do what you like. I am still here at the end.',
    theatrical: 'Finally — someone who understands a set piece.',
    cold:       'Disorder is just a system nobody bothered to map.',
    feral:      'Good. No rules to slow either of us down.',
    proud:      'There is a right way to do this. You will not use it.',
    manic:      'YES. Yes yes yes. No script. No leash.',
    analytical: 'Unpredictable is not the same as unbeatable.',
  },
  mercenary: {
    silent:     'This is work. Let us get to it.',
    theatrical: 'No banner, no boss, no ceiling. Just me.',
    cold:       'I was paid to be here. You were not paid enough.',
    feral:      'Nobody owns me. Nobody survives me either.',
    proud:      'I came a long way for this. Make it worth the trip.',
    manic:      'Free agent! No curfew, no manager, no mercy!',
    analytical: 'Independent means I choose. I chose you.',
  },
  grudge: {
    silent:     'We both know why we are here.',
    theatrical: 'Everybody sit down. This one is personal.',
    cold:       'I have waited. Waiting is the easy part.',
    feral:      'Say it again. Say it to my face this time.',
    proud:      'You made this personal. I am making it permanent.',
    manic:      'I have been DREAMING about this. Ask anyone!',
    analytical: 'I have had a long time to work out exactly how this ends.',
  },
};

/** Cycles per fighter, so the same character does not open the same way twice. */
const cycle = new Map<string, number>();

/** For tests, and for a fresh save: forget where every fighter's cycle is. */
export function resetIntroCycles(): void {
  cycle.clear();
}

/**
 * The pose this fighter opens with NOW, advancing their cycle.
 *
 * Every candidate is checked against the bake's floor measurement, because a
 * pose that hovers is worse in a held close-up than it is mid-combat — the
 * camera is pointed straight at it. Falls back to the unfiltered list rather
 * than returning nothing: a fighter posing slightly high still beats the
 * statue this exists to remove.
 */
export function introPoseFor(fighterId: string, demeanour: Demeanour): string {
  const all = INTRO_POSES[demeanour];
  // A HELD CLOSE-UP IS THE WORST PLACE FOR A STARFISH. Both gates: on the
  // mat, and an authored pose rather than the rig with its arms out.
  const usable = all.filter((c) => clipCanStand(c) && clipIsAuthoredPose(c));
  const pool = usable.length ? usable : all;
  const n = cycle.get(fighterId) ?? 0;
  cycle.set(fighterId, n + 1);
  return pool[n % pool.length];
}

export interface IntroFighter {
  id: string;
  name: string;
  factionAlignment: string;
  personality?: string;
}

/** How long a single beat holds. Long enough to read the line, short enough to skip. */
export const INTRO_BEAT_MS = 2200;

/**
 * THE SEQUENCE. One fighter at a time — never both at once, which is what
 * both Tekken and MDickie do and what the owner asked for twice.
 *
 * ORDER: challenger first, headliner last. P2 opens, P1 closes, so the shot
 * the match starts from is the player's own fighter.
 *
 * AN AUTHORED GRUDGE GETS THE TWO-HANDER: both lines are written as a
 * call and an answer, so the pairing plays as a scene rather than two
 * unrelated poses. Everything else derives its line and still reads as
 * addressed to the man across the ring.
 */
export function preFightSequence(p1: IntroFighter, p2: IntroFighter): IntroBeat[] {
  const rel = relationshipBetween(p1, p2);
  const grudge = AUTHORED_GRUDGES[grudgeKey(p1.id, p2.id)];
  const d1 = demeanourOf(p1.personality);
  const d2 = demeanourOf(p2.personality);

  // A grudge's two lines are a call and an answer, and they are written in
  // roster order — so whichever of the pair sorts first says the call.
  const firstIsP1 = [p1.id.toLowerCase(), p2.id.toLowerCase()].sort()[0] === p1.id.toLowerCase();
  const line1 = grudge ? (firstIsP1 ? grudge[0] : grudge[1]) : LINES[rel][d1];
  const line2 = grudge ? (firstIsP1 ? grudge[1] : grudge[0]) : LINES[rel][d2];

  return [
    { player: 'p2', clip: introPoseFor(p2.id, d2), line: line2, ms: INTRO_BEAT_MS },
    { player: 'p1', clip: introPoseFor(p1.id, d1), line: line1, ms: INTRO_BEAT_MS },
  ];
}

/** Total length of a sequence, for whoever schedules the bell after it. */
export function sequenceDurationMs(beats: IntroBeat[]): number {
  return beats.reduce((t, b) => t + b.ms, 0);
}
