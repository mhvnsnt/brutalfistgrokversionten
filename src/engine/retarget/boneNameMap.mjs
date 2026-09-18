/**
 * boneNameMap.mjs — the single translation layer between a source clip's bone
 * vocabulary and the bones the fight rig is driven by.
 *
 * Imported by BOTH `src/engine/retarget/BannonMotionBank.ts` (runtime) and
 * `scripts/sync-bannon-motion.mjs` (build-time cache) so the two can never
 * disagree about which source bone is which.
 *
 * WHY THIS EXISTS — measured, not assumed
 *   110 of the 201 clips in the indexed Bannon bank built ZERO tracks, because
 *   the runtime bone set is exact-match and the clips speak three vocabularies:
 *
 *     mixamorigHips      91 clips   already canonical
 *     mixamorig:Hips     49 clips   Maya/FBX namespace separator
 *     mixamorig9Hips      1 clip    Mixamo's auto-number for a second rig
 *     J_Hips             59 clips   a different rig entirely
 *     other               1 clip    SHELBYIKRIG_ARREGLADO, unmapped (see below)
 *
 *   Two rigs, two vocabularies, no translation layer. This is that layer.
 */

/**
 * The bones the runtime builds QuaternionKeyframeTracks for. A source bone that
 * does not resolve to one of these never reaches the fight rig.
 * @type {string[]}
 */
export const RUNTIME_BONE_NAMES = [
  'mixamorigHips', 'mixamorigSpine', 'mixamorigSpine1', 'mixamorigSpine2',
  'mixamorigNeck', 'mixamorigHead',
  'mixamorigLeftShoulder', 'mixamorigLeftArm', 'mixamorigLeftForeArm', 'mixamorigLeftHand',
  'mixamorigRightShoulder', 'mixamorigRightArm', 'mixamorigRightForeArm', 'mixamorigRightHand',
  'mixamorigLeftUpLeg', 'mixamorigLeftLeg', 'mixamorigLeftFoot', 'mixamorigLeftToeBase',
  'mixamorigRightUpLeg', 'mixamorigRightLeg', 'mixamorigRightFoot', 'mixamorigRightToeBase',
];

const RUNTIME_BONES = new Set(RUNTIME_BONE_NAMES);

/**
 * Collapse a Mixamo namespace onto the canonical bone name.
 *
 * Exporters stamp the rig's namespace into every bone: Maya/FBX writes
 * `mixamorig:Hips`, and Mixamo auto-numbers a second rig as `mixamorig9Hips`.
 * Already-canonical names are returned unchanged (verified against all 22).
 *
 * @param {string} name
 * @returns {string}
 */
export function canonicalBoneName(name) {
  return name.replace(/^mixamorig[0-9:_\-.\s]*(?=[A-Z])/, 'mixamorig');
}

/** @param {string} name @returns {string} */
function normalize(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * CROSS-RIG NAME MAP for the `J_` rig.
 *
 * PROVENANCE: this is the owner's own translation layer, lifted from
 * `mhvnsnt/Bannon` `tools/mocap/move_sheet.py` (`ALT_BONE_NAMES`), where it was
 * derived against a reference skeleton rather than guessed. Its comment records
 * the same failure seen here: "Feeding those names to a Mixamo reference
 * skeleton matches nothing, so every key came back as the untouched rest pose".
 *
 * It settles the two correspondences a name alone would not:
 *   - `J_Clavicle` is the clavicle and `J_Shoulder` is the UPPER ARM
 *     (-> mixamorigLeftArm), not the other way round.
 *   - `J_Knee` is the SHIN segment (-> mixamorigLeftLeg), with the thigh above
 *     it (-> mixamorigLeftUpLeg).
 *
 * Extended here for the variant these clips actually use — the source map names
 * the legs `J_Thigh`/`J_Ankle` while the clips in this bank name the same
 * segments `J_Leg`/`J_Foot` — plus `J_Toe`, which the source map has no slot
 * for. Both spellings are accepted; measured across the bank, no clip carries
 * both spellings of one segment, so they cannot collide.
 *
 * A rotation is relative to its bone's rest orientation, so a name map alone
 * would not be enough across two rigs. It is correct here because the clip is
 * then re-based onto the target's own bind pose by
 * `applyBindRelativeQuaternionTracks` (q_bind x q_src(0)^-1 x q_src(t)), which
 * is the project's locked contract for exactly this.
 *
 * @type {Record<string, string>}
 */
export const ALT_BONE_NAMES = {
  // NOT `root`: the source map carries it, but measured across this bank 46 clips
  // hold BOTH `Root` and `J_Hips`, and 0 hold `Root` without a real hips bone. In
  // SUPLEX, `Root` sweeps a full 2π on rx while `J_Hips` reads like a pelvis — it
  // is the world transform, so mapping it onto the hips would spin the whole body,
  // non-deterministically, depending on which key was iterated last.
  jhips: 'mixamorigHips',
  jspine1: 'mixamorigSpine', jspine2: 'mixamorigSpine1', jchest: 'mixamorigSpine2',
  jneck: 'mixamorigNeck', jhead: 'mixamorigHead',
  jclaviclel: 'mixamorigLeftShoulder', jclavicler: 'mixamorigRightShoulder',
  jshoulderl: 'mixamorigLeftArm', jshoulderr: 'mixamorigRightArm',
  jelbowl: 'mixamorigLeftForeArm', jelbowr: 'mixamorigRightForeArm',
  jwristl: 'mixamorigLeftHand', jwristr: 'mixamorigRightHand',
  jthighl: 'mixamorigLeftUpLeg', jthighr: 'mixamorigRightUpLeg',
  jlegl: 'mixamorigLeftUpLeg', jlegr: 'mixamorigRightUpLeg',
  jkneel: 'mixamorigLeftLeg', jkneer: 'mixamorigRightLeg',
  janklel: 'mixamorigLeftFoot', jankler: 'mixamorigRightFoot',
  jfootl: 'mixamorigLeftFoot', jfootr: 'mixamorigRightFoot',
  jtoel: 'mixamorigLeftToeBase', jtoer: 'mixamorigRightToeBase',
};

/**
 * CROSS-RIG NAME MAP for the Schwarzerblitz `Armature_` rig
 * (mhvnsnt/SchwarzerblitzEngine, owner-granted — the grant is recorded in
 * AnimationSourceRegistry.ts).
 *
 * DERIVED FROM THE HIERARCHY IN THE FILES, not from the names. Read off
 * common/animations/*.x, where the Frame tree is:
 *
 *   Armature_Hips_001            a root offset above the pelvis
 *     Armature_Hips              the real pelvis: BOTH legs and the spine branch here
 *       Armature_Leg_L           thigh
 *         Armature_Leg_L_001     shin
 *           Armature_Foot_L      foot
 *             Armature_Foot_L_001  toe
 *       Armature_Spine
 *         Armature_Torso         the chest: both arms AND the neck branch here
 *           Armature_Arm_L       upper arm
 *             Armature_Forearm_L
 *               Armature_Wrist_L
 *           Armature_Neck
 *             Armature_Head
 *
 * So `Armature_Torso` is the chest (-> mixamorigSpine2) and `Armature_Hips_001`
 * is NOT the pelvis and is deliberately left unmapped, as are the eight IK
 * helper frames (Wrist_IK, Elbow_IK, Knee_IK, Leg_IK) and the finger/thumb
 * chains, none of which the fight rig drives.
 *
 * This rig has a two-segment spine against Mixamo's three, and no clavicle, so
 * mixamorigSpine1 and both mixamorig*Shoulder bones take nothing and stay at
 * rest: 20 of the 22 runtime bones are driven.
 *
 * @type {Record<string, string>}
 */
export const SCHWARZERBLITZ_BONE_NAMES = {
  armaturehips: 'mixamorigHips',
  armaturespine: 'mixamorigSpine',
  armaturetorso: 'mixamorigSpine2',
  armatureneck: 'mixamorigNeck',
  armaturehead: 'mixamorigHead',
  armaturearml: 'mixamorigLeftArm', armaturearmr: 'mixamorigRightArm',
  armatureforearml: 'mixamorigLeftForeArm', armatureforearmr: 'mixamorigRightForeArm',
  armaturewristl: 'mixamorigLeftHand', armaturewristr: 'mixamorigRightHand',
  armaturelegl: 'mixamorigLeftUpLeg', armaturelegr: 'mixamorigRightUpLeg',
  armaturelegl001: 'mixamorigLeftLeg', armaturelegr001: 'mixamorigRightLeg',
  armaturefootl: 'mixamorigLeftFoot', armaturefootr: 'mixamorigRightFoot',
  armaturefootl001: 'mixamorigLeftToeBase', armaturefootr001: 'mixamorigRightToeBase',
};

/**
 * Resolve any source bone name to the runtime bone it drives, or '' when the
 * bone has no counterpart on the fight rig (facial bones, cloth rigs, helper
 * and aim nulls, a second body's skeleton in a tag capture).
 *
 * @param {string} name
 * @returns {string}
 */
export function resolveRuntimeBone(name) {
  const canonical = canonicalBoneName(name);
  if (RUNTIME_BONES.has(canonical)) return canonical;
  const key = normalize(name);
  return ALT_BONE_NAMES[key] ?? SCHWARZERBLITZ_BONE_NAMES[key] ?? '';
}
