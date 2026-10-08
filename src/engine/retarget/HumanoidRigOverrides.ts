import type { HumanoidRigOverride } from './HumanoidBoneMap.ts';

/**
 * PER-RIG OVERRIDE TABLES for the canonical humanoid bone map.
 *
 * Auto-detection (names, then topology) resolves every rig staged today, so
 * this table is deliberately small. An entry here WINS over detection; add one
 * only when a measurement shows detection picked the wrong joint, and record
 * the measurement next to it.
 */
export const HUMANOID_RIG_OVERRIDES: readonly HumanoidRigOverride[] = [
  {
    // KayKit Rig_Medium/Rig_Large carry `handslot.*` weapon attachments under
    // the hand. Never a humanoid joint.
    match: { anyJoint: ['handslot.l', 'handslot.r'] },
    ignore: ['handslot.l', 'handslot.r', 'handslotl', 'handslotr'],
  },
  {
    // The shipped roster's 58-joint Bannon bind carries three unnamed helper
    // joints per hand (bone_10..12, bone_17..19). They are hand-mesh helpers,
    // never fingers or slots.
    match: { anyJoint: ['bone_10', 'bone_17'] },
    ignore: ['bone_10', 'bone_11', 'bone_12', 'bone_17', 'bone_18', 'bone_19'],
  },
];
