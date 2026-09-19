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

export function stripRootPositionTracks(clip: THREE.AnimationClip): THREE.AnimationClip {
  clip.tracks = clip.tracks.filter((track) => {
    if (!track.name.endsWith('.position')) return true;
    return !isRootBone(boneFromTrack(track.name));
  });
  return clip;
}

/** Zero hip yaw so the instance yaw is the only facing. Keeps X/Z lean. */
export function neutralizeHipYaw(clip: THREE.AnimationClip): THREE.AnimationClip {
  for (const track of clip.tracks) {
    if (!track.name.endsWith('.quaternion')) continue;
    if (!isRootBone(boneFromTrack(track.name))) continue;
    const values = track.values;
    for (let i = 0; i + 3 < values.length; i += 4) {
      _q.set(values[i], values[i + 1], values[i + 2], values[i + 3]);
      _e.setFromQuaternion(_q, 'YXZ');
      _e.y = 0;
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
