// `.ts` extensions on purpose — the repo's test runner resolves them literally.
import * as THREE from 'three';

import { assetUrl } from '../../lib/assetBase.ts';

/**
 * CLIPS ALREADY RESOLVED ONTO THE ONE SKELETON.
 *
 * This is the runtime half of scripts/bake-fighter-animations.mjs. Tekken and
 * Schwarzerblitz do not retarget in a match; they have one skeleton and every
 * animation is authored on it. The bake gives us the same thing: bone binding,
 * source-rest conventions, spine redistribution, hinge constraints and joint
 * limits are all resolved ONCE, offline, against the canonical 58-joint rig.
 *
 * So there is nothing to do here but read quaternion tracks and hand them to a
 * mixer. No rest maps, no per-bank conventions, no joint solving between the
 * bell and the first punch.
 *
 * MEASURED at bake time: 366 clips, 166 spine chains redistributed, 1,334
 * hinge corrections and 2,604 joint-limit corrections — all of it work the
 * runtime used to redo on every fighter load. 44 MB of source Euler JSON
 * becomes 7.9 MB of baked quaternions.
 *
 * FALLS BACK SILENTLY. If the bake has not been run, `loadBakedMotionBank`
 * returns an empty map and the pipeline uses the live retarget path exactly
 * as before. A missing build step must not be a broken game.
 */
export interface BakedClipFile {
  name: string;
  bank: string;
  dur: number;
  /** The combat state this clip answers to, decided at bake time. */
  semantic?: string;
  /** True when the bake chose this clip to OWN its semantic state. */
  owns?: boolean;
  /**
   * The clip leaves the floor on purpose — a jump, a dive, or the victim's
   * half of a throw. The floor lock only lowers these; it never raises them,
   * because a dip at the moment of impact is the animation doing its job.
   */
  airborne?: boolean;
  tracks: Record<string, { t: number[]; q: number[] }>;
  /**
   * Translation tracks, which for a baked clip means exactly one thing: the
   * hips offset that PLANTS THE FEET. Root motion is still stripped — this is
   * the vertical lock that keeps a fighter standing on the floor instead of
   * 23 cm above it.
   */
  positions?: Record<string, { t: number[]; p: number[] }>;
}

export interface BakedManifestEntry {
  file: string;
  bank: string;
  dur: number;
  bones: number;
  semantic?: string;
  owns?: boolean;
  airborne?: boolean;
  /**
   * How close this clip's lowest foot EVER gets to the floor, in metres,
   * after the constant grounding offset has been applied. 0 for anything the
   * offset could fix; what is left over for a clip whose correction hit the
   * cap because its pose is wrong in some other way.
   */
  floorGap?: number;
  /** Median sideways reach of the arms. A T-pose starfish approaches 1. */
  armSpread?: number;
  /** Median forward reach of the arms. A guard is up; a T-pose is not. */
  armForward?: number;
  /** How many of this clip's bones turn more than 5 degrees across it. */
  movingBones?: number;
  /** How many bones it drives at all. */
  boneCount?: number;
  /**
   * Which way the strike travels in the body's own frame: +1 is straight at
   * the opponent, 0 square sideways, -1 directly away.
   */
  strike?: {
    /**
     * Peak-SPEED direction. KEPT FOR THE RECORD AND NO LONGER THE GATE: a
     * strike's fastest frame is often its RETRACTION, so a jab that visibly
     * punches forward measures -0.97. RENDERED against 10 clips, this
     * disagreed with what is on screen 4 times. Use `reach`.
     */
    fwd: number;
    limb?: string;
    /** Body facing averaged over the whole clip. Use `reachFace`. */
    body?: number;
    /**
     * WHERE THE STRIKE REACHES: the direction from the striking limb's
     * most-tucked frame to its most-extended one, in the body's own frame.
     * The limb is picked by extension x peak speed, because extension alone
     * names a punch's stepping FOOT and speed alone names the right limb
     * and the wrong direction.
     */
    reach?: number;
    reachLimb?: string;
    /** Body facing at the frame the strike lands, not averaged over the clip. */
    reachFace?: number;
    /** Share of the clip the striking limb spends behind the body. */
    reachBehind?: number;
    reachExtent?: number;
    /** How far the higher foot leaves the floor: a kick, or a step. */
    footLift?: number;
    /**
     * THE GATE'S MEASUREMENTS, in metres: how far the hand gets in front of
     * its shoulder and the foot in front of its hip, projected onto the
     * body's own forward vector. See HAND_STRIKE_REACH_M.
     */
    handReach?: number;
    footReach?: number;
  };
  /**
   * WHICH WAY IS UP FOR THIS BODY, median over the clip. +1 stands, 0 is
   * horizontal, -1 is upside down. Measured at bake time for the leg-flip
   * pass and never carried to the runtime until now.
   */
  spineUp?: number;
  /** Which way the legs hang, median over the clip. -1 is a standing leg. */
  legDown?: number;
}

/** Past this, a clip's feet never reach the ground and it cannot be a stance. */
export const STANDABLE_FLOOR_GAP_M = 0.08;

/**
 * A clip is THE RIG STANDING THERE, not a pose, when the arms are flung
 * sideways and level and the hands are not out in front.
 *
 * Owner, looking at four stances side by side: "stance wide, stance bladed,
 * taunt flex, and guard high, they're all happening the same ... making him
 * stretch out into like a T pose and do like a fucking starfish thing."
 *
 * MEASURED at bake time, median over each clip (sideways reach / forward
 * reach):
 *     TPOSE          0.97 / 0.14      STANCE         0.13 / 0.62
 *     STANCE_WIDE    0.90 / 0.10      JOHNSON_STANCE 0.11 / 0.63
 *     STANCE_BLADED  0.89 / 0.09      LOWSTANCE      0.11 / 0.61
 *     TAUNT_POINT    0.82 / 0.22      TIGERSTANCE    0.14 / 0.51
 *     GUARD_HIGH     0.56 / 0.30      GRAFSTANCE2    0.50 / 0.67
 *
 * BOTH CONDITIONS, and GRAFSTANCE2 is why: it spreads as wide as GUARD_HIGH
 * and is a real pose, because the hands are FORWARD. Spread alone would
 * throw away a good stance.
 */
export const TPOSE_SPREAD_MIN = 0.5;
export const TPOSE_FORWARD_MAX = 0.35;

/**
 * A clip driving at least this many bones must move more than
 * MIN_MOVING_BONES of them, or it is not an animation.
 *
 * MEASURED across the bake: 15 clips fail this. Eight are Mixamo CHARACTER
 * REST POSES shipped as clips (Y_BOT, PALADIN_J_NORDSTROM, CH44_NONPBR and
 * friends), plus TPOSE, SUPINE and the SPINJUMP family — and
 * HURRICANE_KICK, which moves exactly ONE bone of 22. Its hips sweep 172
 * degrees while every other joint sits inside half a degree, so it plays as
 * a statue spinning on the spot. It is the FIRST alias for attack_2 and
 * attack_rk, which means two of the game's core kicks were that statue.
 *
 * The alias table already carried a note about this and left it: "moving
 * them ahead of it is a design decision, so the order is left as it is and
 * the gate reports the defect instead." The owner has since asked for the
 * frozen animations and the redundant attacks fixed, so it is decided — and
 * decided by MEASUREMENT rather than by re-ordering one list by hand, so
 * every other frozen clip is caught with it.
 */
export const ANIMATED_MIN_BONES = 8;
export const MIN_MOVING_BONES = 3;

/**
 * A STANDING MOVE IS THROWN BY A BODY THAT IS THE RIGHT WAY UP.
 *
 * Found looking for a finisher clip. Filtering the bake on every gate it
 * had — animates, plants on the floor, faces forward, strikes forward —
 * returned FACEGOUGE, CARTWHEEL and HURRICANERANA near the top. RENDERED,
 * all three are inverted: FACEGOUGE is head-down for its whole five
 * seconds. Every existing gate passed them, because `floorGap` says the
 * lowest point touches the mat and cannot say WHICH END is down.
 *
 * MEASURED across the bake, median spine-up per clip:
 *     GRAFQUICKJAB   0.999   attack_1 owner      CARTWHEEL     -0.297
 *     GYAKUZUKI      0.995   attack_rp owner     FACEGOUGE     -0.720
 *     QUICKKICK      0.994   attack_lk owner     TIGERSCARLETSCREW -0.690
 *     STANCE         0.995   idle owner          TAUNT2        -0.439
 * Every clip the bake CHOSE for a standing slot sits above 0.99. The whole
 * roster's distribution has its 25th percentile at 0.678, so the population
 * is bimodal and the gap between the two lobes is wide.
 *
 * THE THRESHOLD IS ZERO — at or below horizontal, for the MEDIAN of the
 * clip — and it is deliberately generous rather than tight. Real standing
 * attacks do dip: CROUCHINGKICK measures 0.507, DROP_KICK 0.655 and the
 * capoeira AU 0.453, and all three are the move doing its job. A median is
 * what separates them from a body that never comes back up.
 */
export const UPRIGHT_SPINE_MIN = 0;

/**
 * HOW FAR A LIMB MUST GET OUT IN FRONT BEFORE THE CLIP CONTAINS A STRIKE.
 *
 * The gate this replaced asked which way the FASTEST limb travelled, and a
 * strike's fastest frame is usually its retraction — so a jab that visibly
 * punches forward measured -0.97 and EVERY jump attack and crouch attack in
 * the bank was refused as backwards. Three more attempts at nominating the
 * one striking limb each failed on a different clip: furthest extension
 * names a punching combination's stepping FOOT; extension x speed does the
 * same; foot LIFT does not separate them either, because GYAKUZUKI_COMBO's
 * step lifts 0.62 m and QUICKKICK's kick lifts 0.607 m.
 *
 * Nominating a striker was the mistake. Every limb is asked instead, and
 * hands and feet are judged apart, because they reach different distances
 * and one shared number lets a stride stand in for a punch.
 *
 * MEASURED — how far the limb gets in front of ITS OWN ROOT (hand past
 * shoulder, foot past hip), projected onto the body's own forward vector:
 *
 *              hand   foot                       hand   foot
 *   ORAORAORA  0.46   0.40      BOXING           0.26   0.53   <- the clip
 *   GYAK_COMBO 0.43   0.26      BOXING__1_       0.25   0.22      the owner
 *   DEFAULTJP  0.42   0.06      BOXING__2_       0.19   0.37      reported
 *   GYAKUZUKI  0.40   0.23      COMBO_PUNCH      0.29   0.37
 *   GRAFQUICKJAB 0.38 0.14      ILLEGAL_ELBOW    0.23   0.42
 *   HIGHPUNCH  0.37   0.40      HURRICANE_KICK   0.18  -0.38
 *   AXEKICK    0.33   0.91      (and for scale, holding still:)
 *   QUICKKICK  0.36   0.85      STANCE           0.33   0.18
 *   HEAVYKICK  0.33   0.68      WALK             0.33   0.26
 *   CROUCHKICK 0.17   0.69      RUNNING          0.21   0.46
 *
 * BOXING is the case that decides the shape of this. Its hands never leave
 * the guard — 0.26, less than a man standing still — while its feet score
 * 0.53 on a step. One combined number passes it; two do not, which is the
 * answer the owner already gave by looking at it.
 *
 * The margins are honest rather than comfortable: the lowest real punch is
 * 0.37 against 0.35, and the lowest real kick 0.68 against 0.60. An ELBOW
 * strike is the known cost — ILLEGAL_ELBOW_PUNCH keeps the hand tucked by
 * design and scores 0.23, so it is refused as an attack. It was refused by
 * the old gate too; this does not make it worse, and a dedicated elbow
 * measure (forearm, not hand) is the fix if it ever matters.
 */
export const HAND_STRIKE_REACH_M = 0.35;
export const FOOT_STRIKE_REACH_M = 0.60;

/**
 * The semantic slots where the engine hands the clip a fighter who is
 * standing up and expects one back. Grapples, knockdowns, getups and the
 * victim halves of throws are all SUPPOSED to invert and are not judged.
 */
const UPRIGHT_SEMANTICS = /^(attack|idle|block|walk|strafe|run|dash|backdash|crouch|guard|victory|taunt)/;

const INDEX_URL = '/motion/baked/index.json';
const BASE = '/motion/baked/';

let cached: Map<string, THREE.AnimationClip> | null = null;
let attempted = false;
/** Clips the bake measured as unable to stand on the floor. */
let notStandable: Set<string> = new Set();
/** Clips the bake measured as a T-pose rather than an authored pose. */
let notAPose: Set<string> = new Set();
/** Clips the bake measured as not moving at all. */
let notAnimated: Set<string> = new Set();
/** semantic state -> the clip the bake chose to OWN it. */
let slotOwners: Map<string, string> = new Map();
/** Attack clips whose strike travels away from the way the body faces. */
let strikesBackwards: Set<string> = new Set();
/** Standing-slot clips whose body spends the clip at or past horizontal. */
let inverted: Set<string> = new Set();

/**
 * DOES THIS CLIP'S STRIKE GO THE WAY THE BODY IS FACING?
 *
 * Owner, on attack_rk: "it's going off to the side, off to the left of the
 * character ... he's not rotating his body to do it towards the character
 * he's fighting."
 *
 * MEASURED as the fastest limb's travel direction against the direction the
 * shoulders say the body faces. When those disagree, the fighter is facing
 * you and swinging behind himself:
 *
 *     ROUNDHOUSEKICK  strike -0.96  body +0.74
 *
 * CORRECTED 2026-09-20: the number above is the PEAK-SPEED direction, and
 * that measure is wrong about 4 clips in 10. A snappy strike retracts faster
 * than it extends, so the fastest frame points backwards — DEFAULTJUMPPUNCH
 * measured -0.97 and CROUCHINGKICK -1.00 while both visibly strike forward,
 * which is why every jump attack and crouch attack in the bank was refused.
 * The gate now reads `reach` (tucked -> extended) with the body's facing at
 * the frame it lands. Verified against 10 rendered clips: 10 of 10.
 *     BOXING          strike -1.00  body +0.91
 *     COMBO_PUNCH     strike -1.00  body +0.93
 *
 * 50 of 94 attack clips do this. It is the same defect the owner reported
 * in the shadowboxing loop long ago — "the right arm is going backwards
 * towards the shoulder blade".
 *
 * I FIRST TRIED TO ROTATE THEM and it was wrong: yawing the clip 180
 * degrees made the strike forward and the BODY backward, so the fighter
 * turned his back and punched over his shoulder. The measurement caught it.
 * A clip whose strike fights its own body is not a facing convention, it is
 * a broken attack, and it is refused as one.
 *
 * ONLY ATTACKS ARE JUDGED. A backward run or a hit reaction moves limbs
 * backwards because that is the move.
 */
export function clipStrikesForward(name: string): boolean {
  return !strikesBackwards.has(name);
}

/** For tests: the attack clips ruled out for striking the wrong way. */
export function backwardStrikes(): ReadonlySet<string> {
  return strikesBackwards;
}

/** Decide, from a manifest, which attacks strike away from their own facing. */
export function markBackwardStrikes(manifest: Record<string, BakedManifestEntry>): Set<string> {
  const out = new Set<string>();
  for (const [name, entry] of Object.entries(manifest)) {
    if (!/^attack/.test(entry.semantic ?? '')) continue;
    const hand = entry.strike?.handReach;
    const foot = entry.strike?.footReach;
    if (hand === undefined || foot === undefined) {
      // An older bake has neither. Fall back to the peak-speed rule rather
      // than letting everything through on a stale manifest.
      const fwd = entry.strike?.fwd;
      const body = entry.strike?.body;
      if (fwd === undefined || body === undefined) continue;
      if (Math.abs(fwd) > 0.3 && fwd * body < 0) out.add(name);
      continue;
    }
    if (hand < HAND_STRIKE_REACH_M && foot < FOOT_STRIKE_REACH_M) out.add(name);
  }
  return out;
}

/**
 * IS THE BODY THE RIGHT WAY UP IN THIS CLIP?
 *
 * See UPRIGHT_SPINE_MIN. Separate from `clipCanStand`, which asks whether
 * the lowest point reaches the mat — a cartwheel touches the mat with its
 * HANDS and passes that gate perfectly.
 *
 * Unknown clips are allowed, so a checkout with no bake behaves as before.
 */
export function clipStandsUpright(name: string): boolean {
  return !inverted.has(name);
}

/** For tests: the standing-slot clips ruled out for being upside down. */
export function invertedClips(): ReadonlySet<string> {
  return inverted;
}

/** Decide, from a manifest, which standing-slot clips are inverted. */
export function markInverted(manifest: Record<string, BakedManifestEntry>): Set<string> {
  const out = new Set<string>();
  for (const [name, entry] of Object.entries(manifest)) {
    if (!UPRIGHT_SEMANTICS.test(entry.semantic ?? '')) continue;
    const up = entry.spineUp;
    if (up === undefined) continue;
    if (up <= UPRIGHT_SPINE_MIN) out.add(name);
  }
  return out;
}

/**
 * THE CLIP THE BAKE CHOSE FOR THIS COMBAT STATE.
 *
 * The bake already decides this, by measuring: it picked GRAFQUICKJAB
 * (0.46 s, a single jab) over BOXING (1.73 s, a shadowboxing LOOP) for
 * attack_1, and marked it `owns: true` in the manifest. The runtime
 * resolver never looked — it walked an alias list and landed on BOXING, so
 * a jab played a second and three quarters of shadowboxing inside an attack
 * window a few hundred milliseconds long.
 *
 * Consulting the owner first is what makes the bake's measurement mean
 * something at runtime.
 */
export function slotOwnerFor(semantic: string): string | null {
  const owner = slotOwners.get(semantic);
  if (!owner) return null;
  // EVEN THE BAKE'S OWN PICK HAS TO PASS THE GATES. ROUNDHOUSEKICK is the
  // named owner of attack_rk and strikes away from the way the body faces,
  // which is precisely the kick the owner reported going the wrong way.
  if (strikesBackwards.has(owner) || notAnimated.has(owner)) return null;
  if (inverted.has(owner)) return null;
  return owner;
}

/** Decide, from a manifest, which clip owns each semantic state. */
export function markSlotOwners(manifest: Record<string, BakedManifestEntry>): Map<string, string> {
  const out = new Map<string, string>();
  for (const [name, entry] of Object.entries(manifest)) {
    if (entry.owns && entry.semantic && !out.has(entry.semantic)) out.set(entry.semantic, name);
  }
  return out;
}

/**
 * DOES THIS CLIP ANIMATE? A separate question from whether it stands or
 * whether it is a pose — a clip can plant perfectly, hold a real pose, and
 * still be a single frozen frame.
 *
 * Unknown clips are allowed, so a checkout with no bake behaves as before.
 */
export function clipAnimates(name: string): boolean {
  return !notAnimated.has(name);
}

/** For tests: the clips the last manifest ruled out as frozen. */
export function frozenClips(): ReadonlySet<string> {
  return notAnimated;
}

/** Decide, from a manifest, which clips never move. */
export function markFrozen(manifest: Record<string, BakedManifestEntry>): Set<string> {
  const out = new Set<string>();
  for (const [name, entry] of Object.entries(manifest)) {
    const bones = entry.boneCount;
    const moving = entry.movingBones;
    if (bones === undefined || moving === undefined) continue;
    if (bones >= ANIMATED_MIN_BONES && moving < MIN_MOVING_BONES) out.add(name);
  }
  return out;
}

/**
 * IS THIS AN AUTHORED POSE, or the rig with its arms out?
 *
 * Kept separate from `clipCanStand` on purpose: they are different defects.
 * A clip can stand perfectly on the mat and still be a starfish, which is
 * exactly what the four stances the owner spotted were doing after the leg
 * correction put them on the floor.
 *
 * Unknown clips are allowed, so a checkout with no bake behaves as before.
 */
export function clipIsAuthoredPose(name: string): boolean {
  return !notAPose.has(name);
}

/** For tests: the clips the last manifest ruled out as T-poses. */
export function tposeClips(): ReadonlySet<string> {
  return notAPose;
}

/** Decide, from a manifest, which clips are the rig rather than a pose. */
export function markTPoses(manifest: Record<string, BakedManifestEntry>): Set<string> {
  const out = new Set<string>();
  for (const [name, entry] of Object.entries(manifest)) {
    const spread = entry.armSpread;
    const forward = entry.armForward;
    if (spread === undefined || forward === undefined) continue;
    if (spread > TPOSE_SPREAD_MIN && forward < TPOSE_FORWARD_MAX) out.add(name);
  }
  return out;
}

/**
 * CAN A FIGHTER STAND IN THIS CLIP?
 *
 * The one thing `peakDeg` — the stance pool's only other measurement — cannot
 * express. peakDeg asks whether a clip HOLDS a pose; it says nothing about
 * where that pose is. MEASURED: STANCE_WIDE scores 10 deg, the second
 * stillest clip in the pool, and floats 107 cm above the mat. It is the
 * default idle for every power fighter on the roster.
 *
 * Answered from the bake's own numbers so a new clip classifies itself and
 * nothing has to be struck off a list by hand. Unknown clips are allowed:
 * a checkout with no bake must behave exactly as before.
 */
export function clipCanStand(name: string): boolean {
  return !notStandable.has(name);
}

/** For tests: the clips the last loaded manifest ruled out, and why. */
export function unstandableClips(): ReadonlySet<string> {
  return notStandable;
}

/** Install a manifest's standability verdicts. Used by the loader and by tests. */
export function applyStandability(manifest: Record<string, BakedManifestEntry>): Set<string> {
  notStandable = markStandability(manifest);
  notAPose = markTPoses(manifest);
  notAnimated = markFrozen(manifest);
  slotOwners = markSlotOwners(manifest);
  strikesBackwards = markBackwardStrikes(manifest);
  inverted = markInverted(manifest);
  return notStandable;
}

/** Decide standability from a manifest without needing the network. */
export function markStandability(manifest: Record<string, BakedManifestEntry>): Set<string> {
  const out = new Set<string>();
  for (const [name, entry] of Object.entries(manifest)) {
    // floorGap ONLY. `airborne` is a PEAK — the highest the lowest foot ever
    // gets — and my first version of this rule used it, which was wrong and
    // the stance test caught it: CROUCHING, LOWSTANCE, LOWSTANCENEW and
    // LOWSTANCEGUARD all plant perfectly (gap 0.0-4.1 cm) and were being
    // thrown out for lifting a foot past 50 cm somewhere in the clip, which
    // is what a crouch does. What disqualifies a stance is never coming DOWN.
    if ((entry.floorGap ?? 0) > STANDABLE_FLOOR_GAP_M) out.add(name);
  }
  return out;
}

/** Turn one baked file into a clip. Exported so a test can check it directly. */
export function clipFromBaked(data: BakedClipFile): THREE.AnimationClip | null {
  const tracks: THREE.KeyframeTrack[] = [];
  for (const [bone, track] of Object.entries(data.tracks ?? {})) {
    if (!track?.t?.length || track.q.length !== track.t.length * 4) continue;
    tracks.push(new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, track.t, track.q));
  }
  // Legacy baked files can contain Hips.position floor-lock tracks. The
  // old runtime rule dropped ALL translations, but that is too blunt: some
  // authored poses carry a CONSTANT pelvis offset (for example a wide stance)
  // that is part of the pose, not per-frame floor chasing. Dropping that
  // constant offset leaves the pelvis tens of centimetres too high and makes
  // the knees/feet look like they are shooting sideways even though the
  // quaternion tracks are correct.
  //
  // Rule:
  //   - CONSTANT translation (<= 2 mm total variation) -> keep it.
  //   - VARIABLE translation -> drop it; world locomotion owns dynamic root
  //     travel and the old per-key grounding track must never fight it.
  //
  // This preserves authored static pelvis placement without resurrecting the
  // per-frame floor-lock bug.
  let constantPositionTracks = 0;
  for (const [bone, track] of Object.entries(data.positions ?? {})) {
    if (!track?.t?.length || track.p.length !== track.t.length * 3) continue;
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (let i = 0; i + 2 < track.p.length; i += 3) {
      const x = track.p[i], y = track.p[i + 1], z = track.p[i + 2];
      if (![x, y, z].every(Number.isFinite)) continue;
      minX = Math.min(minX, x); minY = Math.min(minY, y); minZ = Math.min(minZ, z);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); maxZ = Math.max(maxZ, z);
    }
    const variation = Math.max(maxX - minX, maxY - minY, maxZ - minZ);
    if (!Number.isFinite(variation) || variation > 0.002) continue;
    const p = track.p.slice(0, 3);
    tracks.push(new THREE.VectorKeyframeTrack(
      `${bone}.position`,
      [track.t[0] ?? 0],
      p,
    ));
    constantPositionTracks++;
  }
  if (tracks.length === 0) return null;
  const clip = new THREE.AnimationClip(data.name, data.dur, tracks);
  (clip as THREE.AnimationClip & { userData: Record<string, unknown> }).userData = {
    clipSourceType: 'BAKED_CANONICAL',
    bank: data.bank,
    ownerGranted: true,
    ...(data.semantic ? { semanticState: data.semantic } : {}),
    owns: Boolean(data.owns),
    constantPositionTracks,
    // Already on the skeleton: nothing downstream should retarget it again.
    baked: true,
  };
  return clip;
}

/**
 * Every baked clip, by name. Cached for the session — the bake is immutable
 * for a given build, and two fighters must not fetch it twice.
 */
export async function loadBakedMotionBank(): Promise<Map<string, THREE.AnimationClip>> {
  if (cached) return cached;
  if (attempted) return new Map();
  attempted = true;

  const out = new Map<string, THREE.AnimationClip>();
  try {
    const res = await fetch(assetUrl(INDEX_URL));
    if (!res.ok) throw new Error(`index HTTP ${res.status}`);
    const manifest = (await res.json()) as Record<string, BakedManifestEntry>;
    applyStandability(manifest);
    // SLOT OWNERS FIRST. Actions register in order and the first clip for a
    // semantic wins, so the clip the bake chose for a combat state has to be
    // seen before any clip that merely infers the same state from its name.
    const names = Object.keys(manifest).sort(
      (a, b) => Number(Boolean(manifest[b].owns)) - Number(Boolean(manifest[a].owns)),
    );
    if (names.length === 0) throw new Error('empty index');

    const loaded = await Promise.allSettled(
      names.map(async (name) => {
        const r = await fetch(assetUrl(BASE + encodeURIComponent(manifest[name].file)));
        if (!r.ok) throw new Error(`${name} HTTP ${r.status}`);
        return clipFromBaked((await r.json()) as BakedClipFile);
      }),
    );
    let failed = 0;
    loaded.forEach((s, i) => {
      if (s.status === 'fulfilled' && s.value) out.set(names[i], s.value);
      else failed++;
    });
    console.log(
      `[BakedMotionBank] ✅ ${out.size} clip(s) already on the skeleton` +
        (failed ? `, ${failed} failed` : ''),
    );
  } catch (e: unknown) {
    // Not an error: a dev checkout that has not run the bake uses the live
    // retarget path, and says so once rather than looking broken.
    console.log(
      `[BakedMotionBank] no baked set (${e instanceof Error ? e.message : String(e)}) — using the live retarget path`,
    );
    cached = null;
    return out;
  }
  cached = out;
  return out;
}

/** For tests and for the pipeline's own reporting. */
export function bakedBankIsLoaded(): boolean {
  return cached !== null && cached.size > 0;
}

/** For tests: forget the loaded bank and its standability verdicts. */
export function resetBakedMotionBankForTest(): void {
  cached = null;
  attempted = false;
  notStandable = new Set();
  notAPose = new Set();
  notAnimated = new Set();
  slotOwners = new Map();
  strikesBackwards = new Set();
  inverted = new Set();
}
