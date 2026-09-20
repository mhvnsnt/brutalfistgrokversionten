/**
 * LOCKED YAW TABLE — image-tested 2026-09-16 (MAIME_skinned.glb, camera at +Z).
 * Do not invert from vector math. Select and combat are independent.
 *
 * Camera at +Z looks at origin. P1 is −X (left), P2 is +X (right).
 *
 * Captured yaws (same for Mixamo rest: they look +X at yaw 0):
 *   +45 / +90 / +135 = BACK (away from camera)
 *   −90              = FACE straight at camera
 *   −45              = FACE 3/4 toward camera and P2 (right)
 *   −135             = FACE 3/4 toward camera and P1 (left)
 *   0                = FACE profile toward P2 (right)  ← combat P1
 *   180              = FACE profile toward P1 (left)  ← combat P2
 *
 * Select Mixamo: P1 +π/4, P2 −π/4
 * Select Maime:  P1 −π/4, P2 −3π/4
 *
 * Combat (Tekken / Schwarzerblitz, X = fighting lane):
 *   P1  0     face +X / P2. Camera sees the side, NOT the back.
 *   P2  π     face −X / P1. Camera sees the side, NOT the face-on statue.
 * Old +π/2 / −π/2 was 90° off: P1 back-to-cam, P2 face-to-cam.
 */
export interface Vec3Like { x: number; y: number; z: number }

export const BF_WORLD_UP: Vec3Like = { x: 0, y: 1, z: 0 };

/** @deprecated Outer screens use selectYaw/combatYaw. */
export const FACE_CAMERA_YAW = 0;

export const PRESENTATION_YAW = Math.PI / 4;

export const SELECT_P1_YAW = PRESENTATION_YAW;
export const SELECT_P2_YAW = -PRESENTATION_YAW;

/** Image-tested: face toward camera and P2 (right). */
export const SELECT_MAIME_P1_YAW = -Math.PI / 4;
/** Image-tested: face toward camera and P1 / Bannon (left). */
export const SELECT_MAIME_P2_YAW = (-3 * Math.PI) / 4;

/** Frozen until the user says otherwise. Do not retune yaw / Y / scale. */
export const ORIENTATION_LOCKED = true;
export const COMBAT_P1_YAW = 0;
/** Image-tested: face P1, side to camera. NOT −π/2 (that is face-to-cam). LOCKED. */
export const COMBAT_P2_YAW = Math.PI;

/**
 * FACE THE OPPONENT WHEREVER HE ACTUALLY IS, not just left or right.
 *
 * Owner, twice: "the sidestepping is not radial ... when they sidestep they
 * still do a straight sidestep."
 *
 * MEASURED in a live match while holding sidestep: the PATH is already a
 * real orbit — P1 travels z 0.09 -> 1.38 while x holds near -2.2 and the
 * gap to his opponent stays 1.5-1.9 m, which is exactly what
 * `targetedSidestepVelocity` is written to do. What never changes is the
 * BODY: `p1RotationY` was the constant COMBAT_P1_YAW, so the fighter crabs
 * sideways around his opponent without ever turning to look at him. An arc
 * you cannot see is a straight line.
 *
 * THIS IS THE LOCKED TABLE GENERALISED, not a replacement for it. A yaw of
 * theta about Y sends the body's local +X to (cos theta, 0, -sin theta), so
 * pointing +X down the bearing to the opponent is atan2(-dz, dx) — and with
 * the fighters level on Z that returns 0 for an opponent at +X and PI for
 * one at -X, the two image-tested values above, exactly.
 *
 * COMBAT FACING IS UNCHANGED AND STILL BINARY. Hitboxes, strike direction
 * and the command matcher all read the +/-1 lane facing; this turns the
 * mesh only. They agree whenever the fighters are on the lane and diverge
 * only while someone is orbiting, which is the case the +/-1 facing has no
 * answer for anyway.
 */
export function faceOpponentYaw(
  self: { x: number; z: number },
  opponent: { x: number; z: number },
  fallback: number,
): number {
  const dx = opponent.x - self.x;
  const dz = opponent.z - self.z;
  // Too close to read a bearing from: keep the lane yaw rather than spin.
  if (Math.hypot(dx, dz) < 0.05) return fallback;
  return Math.atan2(-dz, dx);
}

/**
 * Combat group Y is 0. The clone plants feet with plantFeetOnFloor.
 * Extra group lifts stacked fallback clones into the floor.
 */
export const MIXAMO_HIP_Y = 0.91;
export const COMBAT_FIGHTER_Y = 0;

/** Standing torso after feet are on the floor — not the sky above busts. */
export const HIT_FX_WORLD_Y = 1.05;
export const HIT_FX_SCREEN_Y = 250;

/** Select-only sole sink. Combat does not use this. */
export const FOOT_PLANT_SINK = 0.02;

export function selectYaw(side: 1 | -1, pluginBindPose = false): number {
  if (pluginBindPose) {
    return side === -1 ? SELECT_MAIME_P2_YAW : SELECT_MAIME_P1_YAW;
  }
  return side === 1 ? SELECT_P1_YAW : SELECT_P2_YAW;
}

export function combatYaw(side: 1 | -1): number {
  return side === 1 ? COMBAT_P1_YAW : COMBAT_P2_YAW;
}

export function normalizeXZ(x: number, z: number) {
  const length = Math.hypot(x, z);
  if (!Number.isFinite(length) || length < 1e-8) return { x: 0, z: 0 };
  return { x: x / length, z: z / length };
}

export function meshForwardBasis(forwardX: number, forwardZ: number) {
  const f = normalizeXZ(forwardX, forwardZ);
  return { rightX: -f.z, rightZ: f.x, forwardX: f.x, forwardZ: f.z };
}

export function cameraForwardBasis(forwardX: number, forwardZ: number) {
  const f = normalizeXZ(forwardX, forwardZ);
  return { rightX: f.z, rightZ: -f.x, forwardX: f.x, forwardZ: f.z };
}

export function boundedDeltaSeconds(deltaSeconds: number) {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return 0;
  return Math.min(deltaSeconds, 0.1);
}

export function fixedStepCount(accumulatorSeconds: number, fixedStepSeconds = 1 / 60) {
  if (!Number.isFinite(accumulatorSeconds) || accumulatorSeconds <= 0) return 0;
  if (!Number.isFinite(fixedStepSeconds) || fixedStepSeconds <= 0) return 0;
  return Math.floor(accumulatorSeconds / fixedStepSeconds);
}
