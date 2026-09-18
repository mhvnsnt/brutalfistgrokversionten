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
const WALK_SPEED = 2.2;          // world units/sec
const DASH_SPEED = 4.5;          // world units/sec
const BACKDASH_SPEED = 3.8;      // world units/sec
const SIDESTEP_SPEED = 1.8;      // world units/sec (Z axis)
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
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
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
  return {
    minX: hasWalls ? -cfg.boundaryX : -openLimit,
    maxX: hasWalls ? cfg.boundaryX : openLimit,
    minZ: -z,
    maxZ: z,
    hasWalls,
  };
}

/**
 * LocomotionSystem — manages a single fighter's position using the
 * Tekken dual-system architecture.
 */
export class LocomotionSystem {
  private state: LocomotionState;
  private bounds: LocomotionBounds = DEFAULT_LOCOMOTION_BOUNDS;

  // Root motion tracking
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

  // ── Switch to root motion mode (attack with forward displacement) ──────────
  beginRootMotionAttack(attackKey: string, activeDuration: number) {
    const profile = ATTACK_ROOT_MOTION_PROFILES[attackKey];
    if (!profile || !profile.hasRootMotion) return;

    this.state.mode = 'rootMotion';
    this.state.velocityX = 0;
    this.state.velocityZ = 0;
    this.attackRootMotionActive = true;
    this.attackRootMotionProfile = profile;
    this.attackRootMotionElapsed = 0;
    this.attackRootMotionDuration = activeDuration;

    console.log(`[Locomotion] 🥊 Root motion attack: "${attackKey}" displacement=${profile.forwardDisplacement}u over ${activeDuration.toFixed(3)}s`);
  }

  // ── Return to programmatic locomotion ─────────────────────────────────────
  endRootMotionAttack() {
    this.state.mode = 'programmatic';
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
      this.state.rootX = this.clampToX(this.state.rootX + dx);
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
  ): void {
    if (this.state.mode === 'rootMotion') {
      this.updateRootMotion(dt);
      return;
    }

    // Programmatic locomotion
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
    const maxSpeed = isDashing ? DASH_SPEED : isBackdashing ? BACKDASH_SPEED : WALK_SPEED;
    const strafeMax = SIDESTEP_SPEED;

    // Target velocities from input
    const hasSidestep = Math.abs(strafeInput) > 0.1;
    const sidestepVector = hasSidestep && target
      ? this.targetedSidestepVelocity(target, Math.sign(strafeInput), strafeMax)
      : null;
    const targetVX = Math.abs(forwardInput) > 0.1
      ? Math.sign(forwardInput) * maxSpeed * this.state.facing
      : sidestepVector?.x ?? 0;
    const targetVZ = sidestepVector?.z ?? 0;

    // Smooth velocity with acceleration/deceleration
    this.state.velocityX = this.smoothVel(this.state.velocityX, targetVX, dt);
    this.state.velocityZ = this.smoothVel(this.state.velocityZ, targetVZ, dt);

    // Apply to root position
    this.state.rootX = this.clampToX(this.state.rootX + this.state.velocityX * dt);
    this.state.rootZ = this.clampToZ(this.state.rootZ + this.state.velocityZ * dt);

    if (this.jumpY > 0 || this.jumpV > 0) {
      this.jumpV -= 22 * dt;
      this.jumpY += this.jumpV * dt;
      if (this.jumpY <= 0) {
        this.jumpY = 0;
        this.jumpV = 0;
      }
    }
  }

  private updateRootMotion(dt: number): void {
    if (!this.attackRootMotionActive || !this.attackRootMotionProfile) return;

    this.attackRootMotionElapsed += dt;
    const progress = Math.min(1, this.attackRootMotionElapsed / Math.max(0.001, this.attackRootMotionDuration));

    // Synthesized root motion: bell-curve displacement (peak at 50% of active window)
    const bellCurve = Math.sin(progress * Math.PI);
    const frameDisplacement = this.attackRootMotionProfile.forwardDisplacement * bellCurve * dt / Math.max(0.001, this.attackRootMotionDuration);

    this.state.rootX = this.clampToX(
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

    const desiredGap = 2.8;
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
  applyPushback(amount: number) {
    // Pushback is always away from the attacker (opposite to facing)
    const pushX = -this.state.facing * amount;
    this.state.rootX = this.clampToX(this.state.rootX + pushX);
  }

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

  private clampToX(x: number): number {
    // Open stages clamp too — just at the distant backstop, past the ring-out
    // line, so the ring-out fires first and nobody can drift off screen.
    return Math.max(this.bounds.minX, Math.min(this.bounds.maxX, x));
  }

  private clampToZ(z: number): number {
    return Math.max(this.bounds.minZ, Math.min(this.bounds.maxZ, z));
  }

  clampX(x: number) {
    this.state.rootX = this.clampToX(x);
    // Kill velocity toward the clamped direction
    if ((x <= this.bounds.minX && this.state.velocityX < 0) ||
        (x >= this.bounds.maxX && this.state.velocityX > 0)) {
      this.state.velocityX = 0;
    }
  }
}
