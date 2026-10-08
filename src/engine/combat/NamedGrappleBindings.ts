// `.ts` extensions on purpose — the repo's runner resolves them literally.

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
 * motion is TEST_ONLY and is never bound here.
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
}

const BANNON_CAPTURE = 'mhvnsnt/Bannon assets/moves/clips @ d575dd6 — owner reference video via tools/mocap/video_to_clip.py (MediaPipe, two-body)';

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
    status: 'DELIVERER_ONLY', deliverer: 'F5', receiver: null,
    fidelity: 'stand_in',
    note: 'F5 is a real owner capture (Bannon commit 94f78a2450) but from the single-body era of video_to_clip, so only the attacker was tracked. Receiver is MISSING_CLIP. The source video is not in the Bannon repo, so `video_to_clip.py --two` cannot re-run it.',
    provenance: [
      { clip: 'F5', origin: 'AUTHORED_CAPTURE', source: 'mhvnsnt/Bannon assets/moves/clips @ d575dd6 — owner video via video_to_clip.py (single-body, commit 94f78a2450)', mixamo: false },
    ],
  },
  chainsnatcher: {
    moveKey: 'chainsnatcher', moveId: 'bf_chainsnatcher', displayName: 'Chainsnatcher',
    technical: 'jumping double knee to the back / backstabber (canon, Bannon canon/characters/finxsse_match_notes.txt: "double knee to back jumping backbreaker"; BANNON_v150.html: "jumping double-knee backstabber")',
    status: 'REAL_PAIR', deliverer: 'KNEETHROW', receiver: 'KNEETHROWREACTION',
    fidelity: 'stand_in',
    note: 'Best real pair: Schwarzerblitz kneeThrow.x + kneeThrowReaction.x, one authored take (both 0.5417 s), used by the TW_KneeBash throw in chara_tutor/chara_dummy moves.txt (starting_distance 34). It is a knee-bash THROW, not a jumping double knee to the back, so it is a stand-in. The exact receiver exists: BACKBREAKER_REACTION (Schwarzerblitz common/animations/backbreaker_reaction.x, 2.0417 s, referenced by no moves.txt), but its deliverer is MISSING_CLIP. No BACKSTABBER, DOUBLE_KNEE, KNEE_BACK or CODEBREAKER clip exists in versionten, Bannon or Schwarzerblitz. Bannon BannonMDickieMoves.cpp maps only "Kidney Breaker" -> backbreaker and "Lateral Breaker" -> side backbreaker, as names with no animation.',
    provenance: [
      { clip: 'KNEETHROW', origin: 'AUTHORED_SCHWARZERBLITZ', source: 'mhvnsnt/SchwarzerblitzEngine @ 83287a2e bin/media/common/animations/kneeThrow.x', mixamo: false },
      { clip: 'KNEETHROWREACTION', origin: 'AUTHORED_SCHWARZERBLITZ', source: 'mhvnsnt/SchwarzerblitzEngine @ 83287a2e bin/media/common/animations/kneeThrowReaction.x', mixamo: false },
      { clip: 'BACKBREAKER_REACTION', origin: 'AUTHORED_SCHWARZERBLITZ', source: 'mhvnsnt/SchwarzerblitzEngine bin/media/common/animations/backbreaker_reaction.x (exact receiver, unbound: deliverer MISSING_CLIP)', mixamo: false },
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
