// `.ts` extensions on purpose — the repo's runner resolves them literally.
import { getMoveById } from '../BrutalFistMoveCatalog.ts';

/**
 * THE OWNER'S NAMED GRAPPLES, BOUND TO REAL CLIPS — OR HONESTLY NOT.
 *
 * Each named move is matched on its TECHNICAL description, never on its name,
 * against clips that actually exist in the baked bank. Sources, in order:
 *  1. two-body owner captures from mhvnsnt/Bannon (tools/mocap/video_to_clip.py
 *     --two writes <NAME> and <NAME>__RECV from ONE video, so the halves share
 *     a take) brought in by scripts/intake-bannon-grapple-pairs.mjs;
 *  2. single halves already in the bank (Bannon FBX rips, Schwarzerblitz .x).
 *
 * VOCABULARY
 *  REAL_PAIR       both halves are real authored motion from the same take.
 *  DELIVERER_ONLY  the attacker half is real; the receiver is MISSING_CLIP.
 *  RECEIVER_ONLY   the victim half is real; the deliverer is MISSING_CLIP.
 *  MISSING_CLIP    nothing real exists yet.
 * `fidelity: 'stand_in'` means the clip is a real recording of a CLOSE move,
 * not the exact one — the note says what differs. Procedural or synthetic
 * motion is TEST_ONLY and is never bound here. The one exception is a FLAGGED
 * CONSTRAINED SOLVE inside a real capture: frames where a performer is hidden
 * behind his partner, posed from his own last tracked frame and measured bone
 * lengths toward the canon end pose, with every solved frame listed in
 * public/motion/index.json provenance (constrainedSolve, synthetic: 'partial').
 * A whole move is never solved.
 */

export type NamedPairStatus = 'REAL_PAIR' | 'DELIVERER_ONLY' | 'RECEIVER_ONLY' | 'MISSING_CLIP';
export const MISSING_CLIP = 'MISSING_CLIP' as const;

export interface ClipProvenance {
  clip: string;
  origin: 'AUTHORED_CAPTURE' | 'AUTHORED_FBX' | 'AUTHORED_SCHWARZERBLITZ';
  source: string;
  mixamo: boolean;
}

export interface NamedGrappleBinding {
  /** Key in BrutalFistMoveCatalog SIGNATURE_MOVES. */
  moveKey: string;
  moveId: string;
  displayName: string;
  /** What the move physically is — the thing that was matched. */
  technical: string;
  status: NamedPairStatus;
  deliverer: string | null;
  receiver: string | null;
  fidelity: 'exact' | 'stand_in' | 'none';
  note: string;
  provenance: ClipProvenance[];
  /**
   * Length of the recorded take both halves share, seconds (REAL_PAIR owner
   * captures). A named grapple commits for this long, so neither half is cut.
   */
  pairSeconds?: number;
  /**
   * The previous binding, kept ONLY as a fallback: what plays if the exact
   * pair's clips are not baked (GrapplePairing falls back to it by name).
   */
  fallback?: { deliverer: string; receiver: string; note: string };
}

const BANNON_CAPTURE = 'mhvnsnt/Bannon assets/moves/clips @ d575dd6 — owner reference video via tools/mocap/video_to_clip.py (MediaPipe, two-body)';

/** Owner approval for third-party clips, 2026-10-07. */
export const THIRD_PARTY_APPROVED = 'third-party clip, owner-approved for use 2026-10-07';

const GETBACKK_CAPTURE = 'owner-supplied reference video (original footage: third-party TikTok, credit @mackeymcqui; license class: third-party clip, owner-approved for use 2026-10-07) via Bannon tools/mocap/video_to_clip.py build_clip with an RTMO + RTMW3D two-body front end (tools/mocap/getbackk)';

const CHAINSNATCHER_CAPTURE = 'owner-supplied reference video (original footage: third-party TikTok, credit @thatjtawesome3; license class: third-party clip, owner-approved for use 2026-10-07) via tools/mocap/chainsnatcher (RTMO + RTMW3D two-body front end, referee rejected, watermark masked; attacker f135-158 is a flagged constrained solve) and Bannon tools/mocap/video_to_clip.py build_clip, bones in the bake\'s BANNON_rigged convention';

/**
 * Real deliverer captures that have NO receiver and are not the clip a named
 * move is bound to. They must never borrow a generic duration stand-in victim
 * (GrapplePairing.receiverClipFor returns null for them).
 */
export const DELIVERER_ONLY_CAPTURES: Readonly<Record<string, string>> = {
  F5: 'Owner F5 capture from the single-body era of video_to_clip (Bannon 94f78a2450); the receiver was never tracked. Getbackk is now bound to the GETBACKK two-body pair instead.',
};

export const NAMED_GRAPPLE_BINDINGS: Record<string, NamedGrappleBinding> = {
  deadliftGerman: {
    moveKey: 'deadliftGerman', moveId: 'bf_deadlift_german', displayName: 'Deadlift German Suplex',
    technical: 'rear waistlock, deadlift from a standstill, bridging German suplex',
    status: 'REAL_PAIR', deliverer: 'PUMPHANDLE_GERMAN_DOUBLE', receiver: 'PUMPHANDLE_GERMAN_DOUBLE__RECV',
    fidelity: 'stand_in',
    note: 'Real two-body take of a bridging German suplex, but with a PUMPHANDLE grip, not a rear waistlock, and two throws in the take. Capture coverage 0.38 (low). The exact waistlock German exists only as a victim half (GERMANSUPLEX, Bannon FBX) with no deliverer.',
    provenance: [
      { clip: 'PUMPHANDLE_GERMAN_DOUBLE', origin: 'AUTHORED_CAPTURE', source: BANNON_CAPTURE, mixamo: false },
      { clip: 'PUMPHANDLE_GERMAN_DOUBLE__RECV', origin: 'AUTHORED_CAPTURE', source: BANNON_CAPTURE, mixamo: false },
    ],
  },
  flyingHeadbutt: {
    moveKey: 'flyingHeadbutt', moveId: 'bf_flying_headbutt', displayName: 'Flying Headbutt',
    technical: 'top-rope dive, landing headfirst onto a prone opponent',
    status: 'REAL_PAIR', deliverer: 'FLYING_HEADBUTT', receiver: 'FLYING_HEADBUTT__RECV',
    fidelity: 'exact',
    note: 'Spread-arm (Benoit/Bryan) flying headbutt, owner-filmed, both bodies tracked from one video. Keeps the crash and both men laid out afterwards (attacker sells). Coverage 0.37 (low) — re-shoot candidate. DIVING_HEADBUTT_GABLE is a second real deliverer take whose receiver was never banked.',
    provenance: [
      { clip: 'FLYING_HEADBUTT', origin: 'AUTHORED_CAPTURE', source: BANNON_CAPTURE, mixamo: false },
      { clip: 'FLYING_HEADBUTT__RECV', origin: 'AUTHORED_CAPTURE', source: BANNON_CAPTURE, mixamo: false },
    ],
  },
  getbackk: {
    moveKey: 'getbackk', moveId: 'bf_getbackk', displayName: 'Getbackk',
    technical: 'fireman\'s carry into a spinning facebuster (F-5); canon: fireman\'s carry tornado slam',
    status: 'REAL_PAIR', deliverer: 'GETBACKK', receiver: 'GETBACKK__RECV',
    fidelity: 'exact',
    note: 'Exact real pair: both bodies captured from ONE take of the owner-supplied Getbackk reference (receiver jumps in, fireman\'s carry with the left arm hooking the left thigh, ~180 degree corkscrew toss to the attacker\'s left, impact at 5.3 s, both men down). Same window and clock for both halves (6.97 s, 84 keys, ratio 1.0). Coverage: attacker 207/210 frames, receiver 191/210; every gap is <= 6 frames and linearly interpolated (listed in public/motion/index.json provenance). Original footage is a third-party TikTok, credit @mackeymcqui; license class "third-party clip, owner-approved for use 2026-10-07" (the owner approved shipping motion captured from third-party clips on 2026-10-07). Replaces the F5 deliverer-only stand-in; F5 stays deliverer-only (see DELIVERER_ONLY_CAPTURES).',
    provenance: [
      { clip: 'GETBACKK', origin: 'AUTHORED_CAPTURE', source: GETBACKK_CAPTURE, mixamo: false },
      { clip: 'GETBACKK__RECV', origin: 'AUTHORED_CAPTURE', source: GETBACKK_CAPTURE, mixamo: false },
    ],
  },
  chainsnatcher: {
    moveKey: 'chainsnatcher', moveId: 'bf_chainsnatcher', displayName: 'Chainsnatcher',
    technical: 'jumping double knee to the back / backstabber (canon, Bannon canon/characters/finxsse_match_notes.txt: "double knee to back jumping backbreaker"; BANNON_v150.html: "jumping double-knee backstabber")',
    status: 'REAL_PAIR', deliverer: 'CHAINSNATCHER', receiver: 'CHAINSNATCHER__RECV',
    fidelity: 'exact',
    note: 'Exact real pair: both bodies captured from ONE take of the owner-supplied Chainsnatcher reference (live indie match, one handheld low-angle shot): attacker behind the receiver with his arms over the shoulders, jumps with the knees tucked, lands on his back with the knees up, receiver driven back-down onto the knees. Window 3.20-5.27 s (63 frames, 26 keys, 2.067 s, same clock for both halves). Receiver: 53/63 frames tracked, 10 interpolated in gaps of <= 6 frames. Attacker: 39/63 tracked (f96-134); f135-158 (24 frames) is a FLAGGED CONSTRAINED SOLVE, because he is hidden behind and under the receiver from the jump on: his own bone lengths, last tracked pose -> supine with knees raised, landing frame measured from the receiver, spine parallel to the receiver on the mat. The receiver\'s roll after he lands is cropped in the source and not captured. Original footage is a third-party TikTok, credit @thatjtawesome3; license class "third-party clip, owner-approved for use 2026-10-07". Replaces the KNEETHROW / KNEETHROWREACTION stand-in, which stays as the fallback only.',
    pairSeconds: 2.0667,
    fallback: {
      deliverer: 'KNEETHROW', receiver: 'KNEETHROWREACTION',
      note: 'Schwarzerblitz kneeThrow.x + kneeThrowReaction.x (one authored take, 0.5417 s), a knee-bash throw: the previous stand-in. BACKBREAKER_REACTION is retired from this binding (it stays in the bank for other throws).',
    },
    provenance: [
      { clip: 'CHAINSNATCHER', origin: 'AUTHORED_CAPTURE', source: CHAINSNATCHER_CAPTURE, mixamo: false },
      { clip: 'CHAINSNATCHER__RECV', origin: 'AUTHORED_CAPTURE', source: CHAINSNATCHER_CAPTURE, mixamo: false },
    ],
  },
  hallStreetJustice: {
    moveKey: 'hallStreetJustice', moveId: 'bf_hall_street_justice', displayName: 'Hall Street Justice',
    technical: 'street combo ending in a knee',
    status: 'DELIVERER_ONLY', deliverer: 'ILLEGAL_KNEE', receiver: null,
    fidelity: 'stand_in',
    note: 'ILLEGAL_KNEE (Mixamo "Illegal Knee.fbx") is the real finishing knee; the combo lead-in and a recorded receiver do not exist. Receiver is MISSING_CLIP (a generic hit reaction is not a pair).',
    provenance: [
      { clip: 'ILLEGAL_KNEE', origin: 'AUTHORED_FBX', source: 'mhvnsnt/Bannon assets/mocap/drive/Illegal Knee.fbx (Mixamo, 52 mixamorig bones)', mixamo: true },
    ],
  },
  titanFall: {
    moveKey: 'titanFall', moveId: 'bf_titan_fall', displayName: 'Titan Fall',
    technical: 'throat grab into a chokeslam',
    status: 'RECEIVER_ONLY', deliverer: null, receiver: 'CHOKESLAM',
    fidelity: 'exact',
    note: 'CHOKESLAM (Bannon FBX, one J_ face-rig skeleton) is the victim half only, per GrapplePairing. Deliverer is MISSING_CLIP. POWERBOMB_CHOKELIFT is a real single-body capture of a chokelift POWERBOMB, not a chokeslam, and is not bound.',
    provenance: [
      { clip: 'CHOKESLAM', origin: 'AUTHORED_FBX', source: 'mhvnsnt/Bannon assets/mocap/drive/Chokeslam.fbx', mixamo: false },
    ],
  },
  codyBuster: {
    moveKey: 'codyBuster', moveId: 'bf_cody_buster', displayName: 'Cody Buster',
    technical: 'UNKNOWN — no technical description in canon or catalog ("sober-style buster")',
    status: 'MISSING_CLIP', deliverer: null, receiver: null, fidelity: 'none',
    note: 'No canon description of the move and no clip in either repo. Stays MISSING_CLIP until the owner defines it.',
    provenance: [],
  },
};

/** The two halves may differ by this factor before they are "not aligned". */
export const PAIR_DURATION_TOLERANCE = 1.25;

export interface PairTiming {
  delivererDur: number;
  receiverDur: number;
  /** receiver / deliverer. */
  ratio: number;
  /** Play the receiver at this rate so both halves finish on the same frame. */
  receiverTimeScale: number;
  aligned: boolean;
}

/**
 * Two halves of one take are phase-aligned: BANNON_OWNER_MOVES drives the
 * victim "for the same phase the attacker is driven by his". The capture trims
 * each body to where it was tracked, so durations differ slightly; the victim
 * is time-scaled onto the deliverer's clock.
 */
export function pairTiming(delivererDur: number, receiverDur: number): PairTiming {
  const ratio = delivererDur > 0 ? receiverDur / delivererDur : 0;
  return {
    delivererDur, receiverDur, ratio,
    receiverTimeScale: ratio,
    aligned: ratio > 0 && ratio <= PAIR_DURATION_TOLERANCE && ratio >= 1 / PAIR_DURATION_TOLERANCE,
  };
}

export function namedGrappleBinding(moveKeyOrId: string): NamedGrappleBinding | null {
  return NAMED_GRAPPLE_BINDINGS[moveKeyOrId]
    ?? Object.values(NAMED_GRAPPLE_BINDINGS).find((b) => b.moveId === moveKeyOrId) ?? null;
}

/**
 * A named owner grapple as the THROW it is, for FighterStateMachine.
 *
 * Only a REAL_PAIR whose catalog entry is a throw qualifies: the attacker plays
 * `deliverer`, the commit clip is `deliverer` (so GrapplePairing resolves the
 * victim's half to `receiver`), and the commit lasts the recorded take.
 * `button` is the two-button throw the catalog's inputSequence names
 * (RP+RK -> rightThrow, LP+LK -> leftThrow); null when it names neither.
 * Frame data is the catalog's, in seconds at 60 fps.
 */
export interface NamedGrappleThrow {
  moveKey: string;
  moveId: string;
  displayName: string;
  deliverer: string;
  receiver: string;
  button: 'leftThrow' | 'rightThrow' | null;
  startup: number;
  active: number;
  recovery: number;
  /** Engine damage, the same mapping as RosterMoveWindows.catalogDamageToEngine. */
  damage: number;
  commitSeconds: number;
  /** True when the exact pair was not available and the binding's fallback pair is playing. */
  usedFallback: boolean;
}

export function namedGrappleThrowFor(
  moveKeyOrId: string,
  /** Is this clip baked and playable? Default: yes. When either exact half is not, the binding's fallback pair plays. */
  opts: { available?: (clip: string) => boolean } = {},
): NamedGrappleThrow | null {
  const b = namedGrappleBinding(moveKeyOrId);
  if (!b || b.status !== 'REAL_PAIR' || !b.deliverer || !b.receiver) return null;
  const move = getMoveById(b.moveId);
  if (!move || !move.throw) return null;
  const can = opts.available ?? (() => true);
  const useFallback = Boolean(b.fallback) && !(can(b.deliverer) && can(b.receiver));
  const deliverer = useFallback ? b.fallback!.deliverer : b.deliverer;
  const receiver = useFallback ? b.fallback!.receiver : b.receiver;
  const seq = (move.inputSequence ?? '').replace(/\s+/g, '').toUpperCase();
  const button = /^RP\+RK(\(|$)/.test(seq) ? 'rightThrow' : /^LP\+LK(\(|$)/.test(seq) ? 'leftThrow' : null;
  return {
    moveKey: b.moveKey, moveId: b.moveId, displayName: b.displayName,
    deliverer, receiver, button,
    startup: move.startup / 60, active: move.active / 60, recovery: move.recovery / 60,
    damage: move.damage * 6 + 30,
    commitSeconds: useFallback ? (move.active + move.recovery) / 60 : (b.pairSeconds ?? (move.active + move.recovery) / 60),
    usedFallback: useFallback,
  };
}
