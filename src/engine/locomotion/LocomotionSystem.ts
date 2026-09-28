/**
 * LocomotionSystem — Tekken-style locomotion architecture
 *
 * Two completely separate movement systems:
 *
 * 1. PROGRAMMATIC LOCOMOTION (walking/dashing):
 *    - Code manually pushes the root position along X/Z axes
 *    - Walk/dash animations are purely cosmetic — they loop while code moves the capsule
 *    - Root bone stays at floor zero; position is driven by velocity math
 *
 * 2. ROOT MOTION (lunging attacks):
 *    - Code stops pushing the position
 *    - The GLB animation clip contains forward displacement on the root bone
 *    - Engine reads the root bone delta each frame and applies it to the collision capsule
 *    - Prevents skating/sliding during complex strikes like Paul's Death Fist
 *
 * Root Bone Convention:
 *    - Root sits at absolute zero on the floor between the character's feet
 *    - Pelvis/Hips is the center of gravity — all weight-shift animations drive from here
 *    - Distance between P1 and P2 is calculated from their root positions
 */

import * as THREE from 'three';

// ── Locomotion mode ───────────────────────────────────────────────────────────
import { type RootTravelCurve, travelBetween, totalTravel } from '../motion/RootTravel.ts';

export type LocomotionMode = 'programmatic' | 'rootMotion';

// ── Root motion data extracted from a GLB animation frame ────────────────────
export interface RootMotionDelta {
  /** World-space X displacement this frame */
  dx: number;
  /** World-space Z displacement this frame */
  dz: number;
  /** Whether this frame has meaningful root motion (above threshold) */
  hasMotion: boolean;
}

// ── Locomotion state for a single fighter ────────────────────────────────────
export interface LocomotionState {
  /** Current world-space position of the root (floor level) */
  rootX: number;
  rootZ: number;
  /** Current velocity (programmatic mode only) */
  velocityX: number;
  velocityZ: number;
  /** Active locomotion mode */
  mode: LocomotionMode;
  /** Facing direction: 1 = right (+X), -1 = left (-X) */
  facing: 1 | -1;
}

// ── Attack root motion profiles ───────────────────────────────────────────────
/**
 * Root motion profiles for attacks that contain forward displacement.
 * These are used when the GLB clip does NOT have root motion baked in —
 * we synthesize the displacement from the move's frame data.
 *
 * Values are in world units per second of the active window.
 */
export const ATTACK_ROOT_MOTION_PROFILES: Record<string, { forwardDisplacement: number; hasRootMotion: boolean }> = {
  // Standard attacks — no root motion (stationary)
  lightAttack:   { forwardDisplacement: 0.0,  hasRootMotion: false },
  heavyAttack:   { forwardDisplacement: 0.35, hasRootMotion: true  }, // slight lunge
  CommandThrow:  { forwardDisplacement: 0.50, hasRootMotion: true  }, // grab lunge
  // Special moves — strong root motion
  power_surge:   { forwardDisplacement: 0.80, hasRootMotion: true  }, // Death Fist equivalent
  quick_combo:   { forwardDisplacement: 0.20, hasRootMotion: true  },
};

// ── Movement constants ────────────────────────────────────────────────────────
// ── PACE, TAKEN FROM THE GENRE RATHER THAN GUESSED ───────────────────────────
//
// Owner, after playing: "when you press back and attack it's making you keep
// walking back, so none of those attacks ever hit. In Tekken and Schwarzerblitz
// it's more specific than that."
//
// MEASURED IN THE HARNESS FIRST, and it corrected the obvious reading. The
// attack does NOT carry you: movement measured strictly between the start and
// end of the attack is 0.000m on every input, back included. What actually
// happens is that holding back walks you out of range BEFORE the attack's
// active frames arrive, so the move is dead however good its frame data is.
//
// THE COMPARISON THAT SETTLES IT NEEDS NO UNIT CONVERSION. How many of his own
// strike-reaches does a fighter cross in a second of walking? Both numbers come
// from the same game each time, so the scale cancels:
//
//     Schwarzerblitz   80 units/s over a 65-unit modal strike range  =  1.23
//     Brutal Fist      2.2 m/s over a MEASURED 1.40 m reach          =  1.57
//
// AND THE REACH HAD TO BE MEASURED, NOT ASSUMED. The first pass of this took
// 0.8 m from the distance a test happened to swing at, made the gap look like
// 2.2x, and set the walk to 1.0 m/s — which is not "more deliberate", it is
// sluggish. Driving every attack out to its furthest connecting distance says
// all four reach 1.40 m, so the real gap was 1.28x.
//
// The pace is therefore 1.23 reaches/second over that measured reach: 1.72 m/s.
// Schwarzerblitz's running speed is its walk x2.5 (runningSpeed = walkingSpeed
// * 2.5f, read from FK_Character), and the backdash and sidestep keep their
// existing proportions, so only the PACE changes and none of the relationships
// between the moves do.
export const WALK_SPEED = 0.90;  // metres/sec — deliberately readable combat walk
export const DASH_SPEED = 2.25;    // metres/sec — controlled forward dash/run tier
const BACKDASH_SPEED = 2.05;       // metres/sec — controlled retreat tier
const SIDESTEP_SPEED = 1.0;       // metres/sec — controlled lateral step

/**
 * THE ONE PLACE THAT DECIDES HOW FAST THE BODY MOVES. Exported because the
 * animation side needs the same number to scale playback against — the stride is
 * the clip's and the speed is the engine's, so if these two disagree the feet
 * slide by the difference (measured: 0.77 m/s on the back-walk, 1.02 on the dash).
 * See src/engine/motion/DistanceMatching.ts.
 */
export function groundSpeedCap(isDashing: boolean, isBackdashing: boolean): number {
  return isDashing ? DASH_SPEED : isBackdashing ? BACKDASH_SPEED : WALK_SPEED;
}

const WALK_ACCEL = 12.0;         // acceleration rate
const WALK_DECEL = 18.0;         // deceleration rate
const ROOT_MOTION_THRESHOLD = 0.005; // minimum displacement to count as root motion

// ── Stage boundary ────────────────────────────────────────────────────────────
//
// THE DEFAULTS, AND WHY THEY WERE WRONG ON ALMOST EVERY STAGE.
//
// These were the ONLY bounds this system knew. It is the thing that actually
// moves a fighter, and it had no idea which stage it was in, so a fighter
// walked to +/-4.5 x +/-2.0 everywhere. Measured against the 15 shipped stages:
//
//   wrestling_ring  boundaryX 3.8  -> the fighter walked 0.7 units PAST the
//                                     ropes. That is "walking through ropes".
//   sky_crane       boundaryX 3.0  -> 1.5 units past the end of the crane.
//   dojo / steel_cage 4.0, mma_octagon 4.2 -> through the wall or the cage.
//   ring / octagon  boundaryZ 3.8 / 4.2 -> the Z clamp stopped them 1.8 units
//                                     SHORT of the ropes instead.
//   open streets    boundaryX Infinity -> clamped at 4.5, so the ring-out those
//                                     stages enable could never be reached.
//
// setBounds() is how a stage tells this system where its floor ends. The
// defaults below reproduce the old behaviour exactly, so a caller that never
// sets bounds is unchanged.
const DEFAULT_X_MIN = -4.5;
const DEFAULT_X_MAX = 4.5;
const DEFAULT_Z_MIN = -2.0;
const DEFAULT_Z_MAX = 2.0;

export interface LocomotionBounds {
  /** The HARD backstop: nothing may ever be beyond this, however it got there. */
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /**
   * WHERE WALKING STOPS — which is not the same place.
   *
   * Owner: "the ring outs are still happening too easy because you can just
   * walk through the walls and walk through the ropes." Those are one bug.
   *
   * MEASURED across the 15 shipped stages: wrestling_ring declares
   * boundaryX 3.8 and hasWalls:false, and hasWalls:false was read as "no
   * boundary at all", so the walk clamp jumped to the open-street backstop of
   * +/-10 while ringOutEdgeX for that stage is 3.8. You WALKED to 3.81 and
   * rang yourself out — 6.2 units past the ropes, on foot. sky_crane has the
   * identical shape at 3.0 and walks 7 units off the end of the crane. The
   * three street stages carry boundaryX Infinity and are genuinely unbounded,
   * so +/-10 is right for them and they are unchanged.
   *
   * hasWalls only ever meant "is the edge something you splat against". It
   * never meant the edge is not there. A wrestling ring has ropes: you cannot
   * STROLL through them, but you can be thrown over them, and a ring-out
   * should cost somebody a throw.
   *
   * So there are two limits. WHAT A FIGHTER DOES TO HIMSELF — walking,
   * running, a lunging attack, a clip's own root motion — stops here. WHAT IS
   * DONE TO HIM — a hit's pushback, a throw landing, a ledge throw — is
   * clamped only by the hard backstop above, which is what leaves the
   * ring-out reachable.
   */
  walkMinX: number;
  walkMaxX: number;
  /**
   * false = an open stage: there is no wall to splat against, and X is bounded
   * only by a distant backstop past the ring-out line, so walking off the edge
   * rings you out instead of stopping you dead. Clamping at the old 4.5 is
   * precisely what made that unreachable.
   */
  hasWalls: boolean;
}

/**
 * The ring-out line of an open stage, mirrored from StageConfig so this module
 * stays free of engine-module cycles. Kept in step by a test.
 */
export const OPEN_STAGE_RING_OUT_X = 8;
/** How far past the ring-out line a body may travel before it is stopped dead. */
export const OPEN_STAGE_OVERRUN = 2;

export const DEFAULT_LOCOMOTION_BOUNDS: LocomotionBounds = {
  minX: DEFAULT_X_MIN, maxX: DEFAULT_X_MAX,
  minZ: DEFAULT_Z_MIN, maxZ: DEFAULT_Z_MAX,
  walkMinX: DEFAULT_X_MIN, walkMaxX: DEFAULT_X_MAX,
  hasWalls: true,
};

/** Read a stage's real floor off its config. Structural, to avoid a cycle. */
export function locomotionBoundsFromStage(
  cfg: { boundaryX: number; boundaryZ: number; hasWalls: boolean } | null | undefined,
): LocomotionBounds {
  if (!cfg) return DEFAULT_LOCOMOTION_BOUNDS;
  const hasWalls = cfg.hasWalls && Number.isFinite(cfg.boundaryX);
  const z = Number.isFinite(cfg.boundaryZ) ? cfg.boundaryZ : DEFAULT_Z_MAX;
  // An open stage still gets a HARD LIMIT, just a distant one. Leaving X
  // unbounded would let a fighter walk away forever if the ring-out somehow did
  // not fire — a body drifting off screen, which is the other half of the bug
  // this fixes. The limit sits BEYOND the ring-out line so the ring-out always
  // wins; it is the backstop, not the rule.
  const openLimit = OPEN_STAGE_RING_OUT_X + OPEN_STAGE_OVERRUN;

  // A WALLED stage: the wall is both the edge and the backstop.
  if (hasWalls) {
    return {
      minX: -cfg.boundaryX, maxX: cfg.boundaryX,
      walkMinX: -cfg.boundaryX, walkMaxX: cfg.boundaryX,
      minZ: -z, maxZ: z, hasWalls: true,
    };
  }
  // AN EDGE THAT IS NOT A WALL BUT IS STILL AN EDGE — the ring ropes, the end
  // of the crane. Walking stops at it; a throw carries you past it, far
  // enough for the arc to read, and the ring-out fires the moment it is
  // crossed. See walkMaxX above for the measurement that made this necessary.
  if (Number.isFinite(cfg.boundaryX)) {
    const backstop = cfg.boundaryX + OPEN_STAGE_OVERRUN;
    return {
      minX: -backstop, maxX: backstop,
      walkMinX: -cfg.boundaryX, walkMaxX: cfg.boundaryX,
      minZ: -z, maxZ: z, hasWalls: false,
    };
  }
  // A GENUINELY OPEN STAGE (boundaryX Infinity — the three street stages).
  // Unchanged: the distant backstop is the only limit there is.
  return {
    minX: -openLimit, maxX: openLimit,
    walkMinX: -openLimit, walkMaxX: openLimit,
    minZ: -z, maxZ: z, hasWalls: false,
  };
}

/**
 * LocomotionSystem — manages a single fighter's position using the
 * Tekken dual-system architecture.
 */
/**
 * How long a hit carries the body backwards, in frames at 60fps.
 *
 * Tekken authors a `duration` per pushback per victim state; 8 frames is the
 * middle of the range its light hits sit in and is short enough that the slide
 * is over before the victim can act again.
 */
export const PUSHBACK_FRAMES = 8;

export class LocomotionSystem {
  private state: LocomotionState;
  private bounds: LocomotionBounds = DEFAULT_LOCOMOTION_BOUNDS;

  // Root motion tracking
  /** The move's own authored travel, when it has one. See beginRootMotionAttack. */
  private authoredRootMotion: RootTravelCurve | null = null;
  private rootMotionAccumX = 0;
  private rootMotionAccumZ = 0;
  private prevRootBonePos = new THREE.Vector3();
  private rootBoneInitialized = false;

  // Attack root motion synthesis (when GLB has no baked root motion)
  private attackRootMotionActive = false;
  private attackRootMotionProfile: { forwardDisplacement: number; hasRootMotion: boolean } | null = null;
  private attackRootMotionElapsed = 0;
  private attackRootMotionDuration = 0;
  private jumpY = 0;
  private jumpV = 0;
  private jumpArmed = true;

  constructor(initialX: number, initialZ: number, facing: 1 | -1) {
    this.state = {
      rootX: initialX,
      rootZ: initialZ,
      velocityX: 0,
      velocityZ: 0,
      mode: 'programmatic',
      facing,
    };
  }

  get position(): { x: number; z: number } {
    return { x: this.state.rootX, z: this.state.rootZ };
  }

  get airborneY(): number {
    return this.jumpY;
  }

  beginJump() {
    if (this.jumpArmed && this.jumpY <= 0.02) {
      this.jumpV = 5.8;
      this.jumpArmed = false;
    }
  }

  /** Re-arm after the jump button is released and the fighter is on the floor. */
  armJump() {
    if (this.jumpY <= 0.02 && this.jumpV === 0) this.jumpArmed = true;
  }

  get velocity(): { x: number; z: number } {
    return { x: this.state.velocityX, z: this.state.velocityZ };
  }

  get mode(): LocomotionMode {
    return this.state.mode;
  }

  /**
   * Switch to root motion for an attack that travels.
   *
   * `authored` is the move's own per-frame travel, imported from the
   * Schwarzerblitz move graph — 127 of its 133 moves carry one. When it is
   * present it WINS, because it is the move's real motion rather than a
   * synthesized bell curve, and because the alternative is the five-entry
   * hand-written table below, which is what made every attack that was not one
   * of those five stand perfectly still. A move with an authored curve needs no
   * profile at all: the curve is the permission.
   */
  beginRootMotionAttack(attackKey: string, activeDuration: number, authored?: RootTravelCurve | null) {
    const profile = ATTACK_ROOT_MOTION_PROFILES[attackKey];
    const hasAuthored = Boolean(authored?.t?.length);
    if (!hasAuthored && (!profile || !profile.hasRootMotion)) return;

    this.authoredRootMotion = hasAuthored ? authored ?? null : null;
    this.state.mode = 'rootMotion';
    this.state.velocityX = 0;
    this.state.velocityZ = 0;
    this.attackRootMotionActive = true;
    this.attackRootMotionProfile = profile;
    this.attackRootMotionElapsed = 0;
    this.attackRootMotionDuration = activeDuration;

    // `profile` is OPTIONAL now — an authored curve is its own permission, and
    // this line read `profile.forwardDisplacement` unconditionally, so every
    // authored-only move threw here before it could move a centimetre. Found by
    // scripts/probe-root-motion.mjs reporting six page errors next to zero
    // travel; the travel was the symptom and this was the cause.
    if (hasAuthored) {
      const total = totalTravel(authored).forward;
      console.log(`[Locomotion] 🥊 Authored root motion: "${attackKey}" travels ${total.toFixed(2)}m over ${activeDuration.toFixed(3)}s`);
    } else {
      console.log(`[Locomotion] 🥊 Root motion attack: "${attackKey}" displacement=${profile?.forwardDisplacement ?? 0}u over ${activeDuration.toFixed(3)}s`);
    }
  }

  // ── Return to programmatic locomotion ─────────────────────────────────────
  endRootMotionAttack() {
    this.state.mode = 'programmatic';
    this.authoredRootMotion = null;
    this.attackRootMotionActive = false;
    this.attackRootMotionProfile = null;
    this.attackRootMotionElapsed = 0;
    this.rootBoneInitialized = false; // reset bone tracking for next attack
  }

  // ── Update from GLB root bone world position (for baked root motion) ───────
  updateFromRootBone(rootBoneWorldPos: THREE.Vector3): RootMotionDelta {
    if (!this.rootBoneInitialized) {
      this.prevRootBonePos.copy(rootBoneWorldPos);
      this.rootBoneInitialized = true;
      return { dx: 0, dz: 0, hasMotion: false };
    }

    const dx = rootBoneWorldPos.x - this.prevRootBonePos.x;
    const dz = rootBoneWorldPos.z - this.prevRootBonePos.z;
    this.prevRootBonePos.copy(rootBoneWorldPos);

    const hasMotion = Math.abs(dx) > ROOT_MOTION_THRESHOLD || Math.abs(dz) > ROOT_MOTION_THRESHOLD;

    if (hasMotion && this.state.mode === 'rootMotion') {
      this.state.rootX = this.clampWalkX(this.state.rootX + dx);
      this.state.rootZ = this.clampToZ(this.state.rootZ + dz);
    }

    return { dx, dz, hasMotion };
  }

  // ── Main update — call every frame ────────────────────────────────────────
  update(
    forwardInput: number,
    strafeInput: number,
    dt: number,
    isDashing: boolean,
    isBackdashing: boolean,
    target?: { x: number; z: number },
    /**
     * Tekken (7, and the same in 3 and 8): the stick dies the frame a move
     * starts. Only the move's own authored travel may continue, and that
     * path is `rootMotion` above. Coasting the walk through startup is what
     * makes back+attack leave range before the hit comes out. Brutal Fist's
     * extra clips stay; they just are not allowed to keep the walk alive.
     */
    stickLive = true,
  ): void {
    // A pushback in flight is something DONE TO this body, so it runs before and
    // independently of whatever the stick is asking for.
    this.tickPushback(dt);

    // Vertical travel has one owner. It must continue even while an attack is
    // using root-motion mode; otherwise entering an attack during a jump freezes
    // the body at its last sampled Y.
    this.updateJumpArc(dt);

    if (this.state.mode === 'rootMotion') {
      this.updateRootMotion(dt);
      return;
    }

    if (!stickLive) {
      this.state.velocityX = 0;
      this.state.velocityZ = 0;
      return;
    }

    this.updateProgrammatic(forwardInput, strafeInput, dt, isDashing, isBackdashing, target);
  }

  private updateProgrammatic(
    forwardInput: number,
    strafeInput: number,
    dt: number,
    isDashing: boolean,
    isBackdashing: boolean,
    target?: { x: number; z: number },
  ): void {
    const maxSpeed = groundSpeedCap(isDashing, isBackdashing);
    const strafeMax = SIDESTEP_SPEED;

    // Target velocities from input
    const hasSidestep = Math.abs(strafeInput) > 0.1;
    const sidestepVector = hasSidestep && target
      ? this.targetedSidestepVelocity(target, Math.sign(strafeInput), strafeMax)
      : null;
    // WALK TOWARD THE OPPONENT, INCLUDING IN Z. Stepping along the facing lane
    // alone means a sidestepped opponent can never be walked into, which is the
    // "sometimes you can't reach them" the owner reported. With no target — tests,
    // a spawn — the old lane step remains.
    let targetVX = 0;
    let targetVZ = 0;
    const forwardLive = Math.abs(forwardInput) > 0.1;
    if (forwardLive && target) {
      const dx = target.x - this.state.rootX;
      const dz = target.z - this.state.rootZ;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.05) {
        const sign = Math.sign(forwardInput);
        targetVX = (dx / dist) * maxSpeed * sign;
        targetVZ = (dz / dist) * maxSpeed * sign;
      }
    } else if (forwardLive) {
      targetVX = Math.sign(forwardInput) * maxSpeed * this.state.facing;
    }
    if (sidestepVector) {
      targetVX += sidestepVector.x;
      targetVZ += sidestepVector.z;
    }

    // Smooth velocity with acceleration/deceleration
    this.state.velocityX = this.smoothVel(this.state.velocityX, targetVX, dt);
    this.state.velocityZ = this.smoothVel(this.state.velocityZ, targetVZ, dt);

    // Apply to root position
    this.state.rootX = this.clampWalkX(this.state.rootX + this.state.velocityX * dt);
    this.state.rootZ = this.clampToZ(this.state.rootZ + this.state.velocityZ * dt);

  }

  /** Advance the world-space jump arc independently of X/Z locomotion. */
  private updateJumpArc(dt: number) {
    if (!(this.jumpY > 0 || this.jumpV > 0)) return;
    this.jumpV -= 22 * dt;
    this.jumpY += this.jumpV * dt;
    if (this.jumpY <= 0) {
      this.jumpY = 0;
      this.jumpV = 0;
      this.jumpArmed = true;
    }
  }

  /** Force a real floor landing for knockdown/get-up transitions. */
  land() {
    this.jumpY = 0;
    this.jumpV = 0;
    this.jumpArmed = true;
  }

  private updateRootMotion(dt: number): void {
    if (!this.attackRootMotionActive) return;

    const previous = this.attackRootMotionElapsed;
    this.attackRootMotionElapsed += dt;

    // ── The move's own authored travel ──────────────────────────────────
    // Sampled BETWEEN the two times rather than as a velocity at one, so a
    // dropped frame still moves the fighter every centimetre the move
    // authored across the gap instead of one frame's worth times a large dt.
    if (this.authoredRootMotion) {
      const step = travelBetween(this.authoredRootMotion, previous, this.attackRootMotionElapsed);
      this.state.rootX = this.clampWalkX(this.state.rootX + step.forward * this.state.facing);
      this.state.rootZ = this.clampToZ(this.state.rootZ + step.lateral);
      // Vertical is deliberately not applied here: jump height is owned by the
      // jump arc, and two systems writing Y is how a fighter ends up hovering.
      if (this.attackRootMotionElapsed >= this.attackRootMotionDuration) this.endRootMotionAttack();
      return;
    }

    if (!this.attackRootMotionProfile) return;
    const progress = Math.min(1, this.attackRootMotionElapsed / Math.max(0.001, this.attackRootMotionDuration));

    // Synthesized root motion: bell-curve displacement (peak at 50% of active window)
    const bellCurve = Math.sin(progress * Math.PI);
    const frameDisplacement = this.attackRootMotionProfile.forwardDisplacement * bellCurve * dt / Math.max(0.001, this.attackRootMotionDuration);

    this.state.rootX = this.clampWalkX(
      this.state.rootX + frameDisplacement * this.state.facing
    );

    if (progress >= 1.0) {
      this.endRootMotionAttack();
    }
  }

  /**
   * Tekken-style sidestep follows the opponent rather than moving on a fixed
   * world-Z rail. The primary component is tangent to the fighter-to-target
   * line; a small radial correction keeps the pair in a useful fighting gap.
   * It is bounded and never homes an attack or changes facing by itself.
   */
  private targetedSidestepVelocity(
    target: { x: number; z: number },
    side: number,
    speed: number,
  ): { x: number; z: number } {
    const dx = target.x - this.state.rootX;
    const dz = target.z - this.state.rootZ;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.001) return { x: 0, z: side * speed };

    const nx = dx / distance;
    const nz = dz / distance;
    const tangentX = -nz * side;
    const tangentZ = nx * side;

    // 0.82m, NOT 2.8. The longest authored strike reach in the moveset is 0.937m
    // (measured across 286 moves), so a 2.8m separation put every fighter three
    // times further apart than their longest attack can travel — nothing could
    // reach anything. This is the "you can't get close enough" defect.
    const desiredGap = 0.82;
    const radial = Math.max(-0.65, Math.min(0.65, (distance - desiredGap) * 0.5));
    return {
      x: tangentX * speed + nx * radial,
      z: tangentZ * speed + nz * radial,
    };
  }

  private smoothVel(current: number, target: number, dt: number): number {
    if (Math.abs(target) < 0.01) {
      const decel = WALK_DECEL * dt;
      if (current > 0) return Math.max(0, current - decel);
      if (current < 0) return Math.min(0, current + decel);
      return 0;
    }
    const accel = WALK_ACCEL * dt;
    if (current < target) return Math.min(target, current + accel);
    if (current > target) return Math.max(target, current - accel);
    return current;
  }

  // ── Set position directly (teleport / round reset) ────────────────────────
  setPosition(x: number, z: number) {
    // Clamped like every other write. It was not, so a teleport, a round reset
    // or a throw landing could place a fighter outside the stage and nothing
    // downstream would pull them back — a body drifting off screen.
    this.state.rootX = this.clampToX(x);
    this.state.rootZ = this.clampToZ(z);
    this.state.velocityX = 0;
    this.state.velocityZ = 0;
    this.endRootMotionAttack();
  }

  // ── Update facing direction ────────────────────────────────────────────────
  setFacing(facing: 1 | -1) {
    this.state.facing = facing;
  }

  // ── Stop all movement (hit stun, knockdown) ───────────────────────────────
  halt() {
    this.state.velocityX = 0;
    this.state.velocityZ = 0;
    this.endRootMotionAttack();
  }

  // ── Apply pushback from a hit ─────────────────────────────────────────────
  private push: { remaining: number; framesLeft: number; totalFrames: number; dir: number } | null = null;

  applyPushback(amount: number, durationFrames = PUSHBACK_FRAMES) {
    if (!(Math.abs(amount) > 0)) return;
    // Pushback is always away from the attacker (opposite to facing)
    const dir = -this.state.facing;
    if (durationFrames <= 1) {
      // The old behaviour, kept for callers that want an instant displacement.
      this.state.rootX = this.clampToX(this.state.rootX + dir * amount);
      return;
    }
    // A SECOND PUSH DURING ONE ALREADY RUNNING ADDS TO IT rather than replacing
    // it, so the second hit of a string does not cancel the first one's slide.
    const carry = this.push && Math.sign(this.push.dir) === Math.sign(dir) ? this.push.remaining : 0;
    this.push = {
      remaining: amount + carry,
      framesLeft: durationFrames,
      totalFrames: durationFrames,
      dir,
    };
  }

  /**
   * A PUSHBACK IS A DISPLACEMENT OVER TIME, NOT A TELEPORT.
   *
   * Tekken stores it as `Pushback {duration, displacement, num_of_loops,
   * extradata}` — the extradata being a per-frame horizontal offset. The
   * displacement is spread across `duration` frames. Ours moved the root the
   * whole distance in ONE frame, which is why being hit read as a snap rather
   * than as being knocked back: the body arrives before the reaction animation
   * has started, so nothing on screen connects the two.
   *
   * The curve here decelerates: speed starts at 2A/T and falls linearly to zero,
   * so the area under it is exactly the authored distance A and the body covers
   * most of it early. That is what a shove looks like.
   */
  private tickPushback(dt: number) {
    const p = this.push;
    if (!p) return;
    const frames = Math.max(0, Math.min(p.framesLeft, dt * 60));
    if (frames <= 0) return;
    const t0 = 1 - p.framesLeft / p.totalFrames;
    p.framesLeft -= frames;
    const t1 = 1 - p.framesLeft / p.totalFrames;
    // Fraction of the total distance covered between t0 and t1 under a linearly
    // decaying speed: the integral of 2(1-t) is 2t - t^2.
    const covered = (2 * t1 - t1 * t1) - (2 * t0 - t0 * t0);
    const step = p.remaining * covered;
    this.state.rootX = this.clampToX(this.state.rootX + p.dir * step);
    if (p.framesLeft <= 1e-4) this.push = null;
  }

  /** True while a hit is still carrying this body backwards. */
  get isBeingPushed(): boolean { return this.push !== null; }

  /** Cancel any pushback in flight — a throw or a round reset owns the position. */
  clearPushback() { this.push = null; }

  // ── Clamp X position (used for fighter separation enforcement) ────────────
  /**
   * Tell this fighter where the stage ends. Called when a match loads; without
   * it the module defaults apply and behaviour is exactly as before.
   */
  setBounds(bounds: LocomotionBounds) {
    this.bounds = bounds;
    // Anything already outside the new stage is pulled in, so a stage swap
    // cannot strand a fighter beyond a wall that did not exist a moment ago.
    this.state.rootX = this.clampToX(this.state.rootX);
    this.state.rootZ = this.clampToZ(this.state.rootZ);
  }

  getBounds(): LocomotionBounds {
    return this.bounds;
  }

  /** The HARD backstop. Used for what is DONE TO a fighter, never for a walk. */
  private clampToX(x: number): number {
    // Open stages clamp too — just at the distant backstop, past the ring-out
    // line, so the ring-out fires first and nobody can drift off screen.
    return Math.max(this.bounds.minX, Math.min(this.bounds.maxX, x));
  }

  /**
   * WHERE A FIGHTER'S OWN MOVEMENT STOPS. See LocomotionBounds.walkMaxX: on
   * the wrestling ring this is the ropes at 3.8 while the backstop is 5.8,
   * which is what stops you walking yourself out of the ring while still
   * leaving a throw somewhere to put you.
   */
  private clampWalkX(x: number): number {
    const lo = this.bounds.walkMinX ?? this.bounds.minX;
    const hi = this.bounds.walkMaxX ?? this.bounds.maxX;
    return Math.max(lo, Math.min(hi, x));
  }

  private clampToZ(z: number): number {
    return Math.max(this.bounds.minZ, Math.min(this.bounds.maxZ, z));
  }

  /**
   * The separation fix-up and the hazard bounce. WALK-limited on purpose:
   * being nudged out of the ring because two bodies overlapped is not a
   * ring-out anybody earned. A throw uses setPosition and a hit uses
   * applyPushback, and both of those keep the hard backstop.
   */
  clampX(x: number) {
    this.state.rootX = this.clampWalkX(x);
    const lo = this.bounds.walkMinX ?? this.bounds.minX;
    const hi = this.bounds.walkMaxX ?? this.bounds.maxX;
    if ((x <= lo && this.state.velocityX < 0) ||
        (x >= hi && this.state.velocityX > 0)) {
      this.state.velocityX = 0;
    }
  }
}
