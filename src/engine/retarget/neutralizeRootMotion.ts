/**
 * Universal Mixamo / mocap clip sanitizer.
 *
 * Fighting-game instances own facing (outer yaw) and floor plant (outer Y).
 * Clips must be in-place and face the skeleton's bind forward (+Z for Mixamo).
 *
 * Why AI always breaks this:
 *   1. Copying Mixamo hip quaternion as-is leaves ~40–90° of yaw in IDLE
 *      (our IDLE.json hips.ry ≈ −0.75). Stack that with outer yaw and the
 *      abs face away from the opponent while the neck still looks at them.
 *   2. pose.pelvis Y (~0.91m) applied as Hips.position on a mesh already
 *      planted at bind-pose height double-counts hip height → hover.
 *   3. Procedural Euler banks written as ABSOLUTE local quaternions replace
 *      Mixamo rest (legs rz ≈ ±π) with made-up angles → truck-hit twist.
 *
 * Legal operations: drop root translation, zero hip yaw, keep lean/pitch.
 * Illegal: rest-pose-ignorant track rename, hip Y-π "align", bone-snap floor.
 */
import * as THREE from 'three';

const _q = new THREE.Quaternion();
const _e = new THREE.Euler();

function boneFromTrack(trackName: string): string {
  const dot = trackName.lastIndexOf('.');
  const withoutProp = dot === -1 ? trackName : trackName.slice(0, dot);
  const pipe = withoutProp.lastIndexOf('|');
  const raw = pipe === -1 ? withoutProp : withoutProp.slice(pipe + 1);
  return raw.replace(/^mixamorig:?/i, '');
}

function isRootBone(bone: string): boolean {
  return /^(hips?|pelvis|root|armature)$/i.test(bone);
}

/**
 * DROP THE ROOT'S TRAVEL, KEEP ITS BOB.
 *
 * Owner, watching an idle: "instead of doing like an idle bob, kind of up
 * and down of the knees and the hips ... what it's actually doing is the
 * feet are going up. So instead of the pelvis doing a natural bob, it's
 * like the pelvis is locked in position and the idle motion is picking the
 * feet up off the ground."
 *
 * He read it exactly, and this function is where it happened: it DELETED
 * the whole hips position track. "Drop root translation" is supposed to
 * mean horizontal travel — the instance owns where the fighter stands —
 * but the same track carries the VERTICAL motion an animator put in the
 * pelvis, and that is not the instance's business. MEASURED: 324 of 324
 * grounded clips reached the bake with no pelvis motion at all, so nothing
 * in the game could bob. The leg rotations still ask the body to drop, and
 * with the pelvis pinned the only way the rig can answer is to lift the
 * feet off the floor.
 *
 * X AND Z GO, Y STAYS — AS A DELTA FROM THE FIRST FRAME, never as the
 * clip's absolute hip height. That is the double-count in note 2 of this
 * file's header: a mesh already planted at bind-pose height plus an
 * authored 0.91 m pelvis equals a fighter hovering. A delta starts at zero
 * by construction, so frame 0 lands exactly where the bind does and only
 * the MOTION survives.
 */
export function stripRootPositionTracks(clip: THREE.AnimationClip): THREE.AnimationClip {
  for (const track of clip.tracks) {
    if (!track.name.endsWith('.position')) continue;
    if (!isRootBone(boneFromTrack(track.name))) continue;
    const v = track.values;
    if (v.length < 3) continue;
    const y0 = v[1];
    for (let i = 0; i + 2 < v.length; i += 3) {
      v[i] = 0;
      v[i + 1] = v[i + 1] - y0;
      v[i + 2] = 0;
    }
  }
  return clip;
}

/**
 * Remove the hip yaw the clip was AUTHORED with, keep the yaw it PERFORMS.
 *
 * The instance owns facing, so a constant yaw baked into a clip stacks with it
 * and the fighter ends up facing away from his opponent while his neck still
 * looks at him (our IDLE.json rests at hips.ry ~= -0.75). That offset has to
 * go.
 *
 * BUT ZEROING IT OUTRIGHT DELETES EVERY SPIN. Measured and then RENDERED:
 * HURRICANE_KICK — the spinning kick — held one pose with the leg stuck out
 * sideways for all 24 frames, because the spin IS hips yaw and every frame's
 * was being set to zero. The clip was never broken; 71 radians of motion are
 * in it, more than BOXING's 54.
 *
 * So subtract the FIRST FRAME'S yaw from every frame instead of subtracting
 * all of it. Frame 0 still lands on the instance's facing, which is the whole
 * point of the rule, and yaw CHANGE within the clip survives — a spinning
 * kick spins, a turn turns, an idle that drifts and returns still returns.
 * X/Z lean is untouched either way.
 */
export function neutralizeHipYaw(clip: THREE.AnimationClip): THREE.AnimationClip {
  for (const track of clip.tracks) {
    if (!track.name.endsWith('.quaternion')) continue;
    if (!isRootBone(boneFromTrack(track.name))) continue;
    const values = track.values;
    if (values.length < 4) continue;
    _q.set(values[0], values[1], values[2], values[3]);
    _e.setFromQuaternion(_q, 'YXZ');
    const baseYaw = _e.y;
    for (let i = 0; i + 3 < values.length; i += 4) {
      _q.set(values[i], values[i + 1], values[i + 2], values[i + 3]);
      _e.setFromQuaternion(_q, 'YXZ');
      _e.y -= baseYaw;
      _q.setFromEuler(_e);
      values[i] = _q.x;
      values[i + 1] = _q.y;
      values[i + 2] = _q.z;
      values[i + 3] = _q.w;
    }
  }
  return clip;
}

/**
 * The same Y-zeroing `neutralizeHipYaw` does to a track, applied to ONE
 * quaternion — so a REST can be brought into the same space as the tracks
 * whose deltas are measured from it.
 *
 * WHY THIS HAS TO EXIST. `makeClipBindRelative` subtracts a source rest from
 * every key. The tracks reaching it have already been neutralized; a rest read
 * straight out of the bank has not. MEASURED on the Schwarzerblitz set, whose
 * skeleton carries a -90 degree coordinate yaw in its hips: the mismatch left
 * exactly that yaw in the delta, so every clip in the set spun the whole
 * fighter 90 degrees off his facing — punches thrown across his own chest
 * instead of at the opponent. Whatever is done to the tracks must be done to
 * the rest, or the subtraction is between two different spaces.
 *
 * Non-root bones are returned untouched: only the root's yaw is neutralized.
 */
export function neutralizeRootRestQuaternion(
  boneName: string,
  q: THREE.Quaternion,
): THREE.Quaternion {
  if (!isRootBone(boneFromTrack(boneName))) return q;
  _e.setFromQuaternion(q, 'YXZ');
  _e.y = 0;
  return new THREE.Quaternion().setFromEuler(_e);
}

export function sanitizeMotionClip(clip: THREE.AnimationClip): THREE.AnimationClip {
  stripRootPositionTracks(clip);
  neutralizeHipYaw(clip);
  return clip;
}
