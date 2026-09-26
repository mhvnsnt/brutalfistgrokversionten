'use client';

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { BoneHitboxSystem } from '../engine/locomotion/BoneHitboxSystem';
import { AutoRigDetector, type RigDiagnosticReport } from '../engine/locomotion/AutoRigDetector';
import { ATTACK_ROOT_MOTION_PROFILES } from '../engine/locomotion/LocomotionSystem';
import { blendDurationFor } from '../engine/motion/BlendDuration';
import {
  runDeformationIntegrityTest,
  type DeformationIntegrityInput,
} from '../engine/debug/DeformationIntegrityLogger';
import {
  runCharacterPipeline,
} from '../engine/pipeline/CharacterPipeline';
import {
  runAnimationIntegrityGate,
  type AnimationIntegrityReport,
} from '../engine/combat/AnimationIntegrityGate';
import { COMBAT_STATE_TO_SEMANTIC, SEMANTIC_STATE_ALIASES, inferSemanticStateFromClipName } from '../engine/retarget/SemanticStateAliases';
import { clipAnimates, clipIsTeamCapture, clipKeepsFacing, clipStandsUpright, clipStartsStanding, clipStrikesForward, slotOwnerFor } from '../engine/retarget/BakedMotionBank';
import { clipsLabelledFor, isReceivingClip, labelRefuses } from '../engine/assets/moveLabels';
import { isThrowVictimClip } from '../engine/combat/GrapplePairing';
import { AnimationBridge } from '../../animation_bridge/retarget';

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────
import { stanceKitFor, stancePreferences } from '../engine/combat/CharacterStances';

export interface FighterMeshProps {
  /** FighterStateMachine motion state key — drives animation playback */
  state: string;
  /** Optional explicit animation override (takes priority over state) */
  animation?: string;
  /** GLB URL — null renders nothing */
  modelUrl: string | null;
  /** World-space position — set by parent screen, never hardcoded here */
  position: [number, number, number];
  /** Facing direction — used only for hitbox offset math, NOT for rotation */
  facing: 1 | -1;
  /**
   * World-space Y rotation — set by parent screen.
   * CharacterSelect: 0 for both (face camera)
   * CombatArena3D:   P1=0, P2=Math.PI
   * FighterMesh itself is COMPLETELY DUMB about rotation — it just applies what it receives.
   */
  rotationY?: number;
  tint?: string;
  /**
   * Who this is, so the fighter can use HIS OWN stance and guard rather than
   * the one clip everybody shared. Optional: with no id the generic alias table
   * decides exactly as before. See engine/combat/CharacterStances.
   */
  characterId?: string;
  /** The roster's authored `fightingStyle`, which picks the stance shortlist. */
  fightingStyle?: string;
  showHitbox?: boolean;
  hitboxGeometry?: { offsetX: number; offsetZ: number; width: number; depth: number } | null;
  /**
   * Monotonically-increasing counter — forces re-trigger even when animation key
   * string hasn't changed (e.g. two consecutive lightAttacks).
   */
  animationTrigger?: number;
  /**
   * Fighter-state attack window in seconds. Long authored clips are retimed
   * to this window so the full clip is visible without stretching the move
   * into a multi-second demo.
   */
  attackDurationSeconds?: number;
  /**
   * Current locomotion velocity from FighterStateMachine.getWalkVelocity().
   * Used for velocity-weighted blend gating to prevent jitter on micro-inputs.
   */
  locomotionVelocity?: { forward: number; strafe: number };
  /**
   * Hit-stop freeze: when true, the animation mixer is paused.
   * Set by GameBattleArena when a heavy attack lands.
   */
  hitStopActive?: boolean;
  /**
   * Callback fired once the rig diagnostic report is ready.
   * Used by DebugOverlayHUD to show rig quality.
   */
  onRigDiagnostic?: (report: RigDiagnosticReport) => void;
  /**
   * Callback fired each frame with the bone hitbox system reference.
   * Used by GameBattleArena for bone-parented collision checks.
   */
  onBoneHitboxReady?: (system: BoneHitboxSystem) => void;
  /**
   * AGENT LAW: Callback fired when the 14-point deformation integrity test
   * returns BLOCKED on combat entry. The caller (CombatArena3D / GameBattleArena)
   * MUST freeze combat when this fires.
   *
   * @param characterName - The character whose deformation test failed
   * @param failingChecks - The IDs of the failing checks
   */
  onDeformationBlocked?: (characterName: string, failingChecks: string[]) => void;
  /**
   * Callback fired with the animation integrity gate report on first combat entry.
   * Reports PASS/BLOCKED/UNKNOWN with bone travel measurement, clip count,
   * resolved/unresolved track counts, and mixer root validation.
   * Use this to display the per-fighter animation status in DebugOverlayHUD.
   */
  onAnimationIntegrityReport?: (report: AnimationIntegrityReport) => void;
  /**
   * THE BODY IS ON SCREEN — fired once, when the GLB has finished loading AND
   * normalizing and a real mesh is being drawn instead of the wireframe
   * placeholder. `ok` is false when the asset was rejected outright, so a
   * caller waiting on this can stop waiting rather than hang.
   *
   * This exists because the pre-fight camera pan was running over an EMPTY
   * arena: the sweep phase is literally labelled "LOADING ARENA" and did not
   * wait for the loading. A multi-megabyte GLB takes seconds to parse and the
   * cinematic is 2.5s, so the shot the owner asked for — the one that shows
   * the fighters — showed two wireframe boxes or nothing at all.
   */
  onModelReady?: (ok: boolean) => void;
  /**
   * WHICH CLIP IS ACTUALLY PLAYING, reported by the thing that chose it.
   *
   * The arena needs the deliverer's real clip name to look up the opponent's
   * half of a grapple, and re-deriving it there would be a second copy of
   * this resolution that can disagree with this one. That disagreement is
   * the exact class of bug this project keeps paying for, so the resolver
   * says what it picked instead of being asked again.
   */
  onClipResolved?: (clip: string | null, inputKey: string) => void;
  /**
   * THE CLIP THIS PARTICULAR COMMAND PLAYS.
   *
   * Owner: "it's boring when all fighters are doing the same 4 attacks the
   * whole fight." MEASURED: 26 directional commands resolved to THREE
   * animations, because every one of them named a generic motion state.
   *
   * Deliberately SEPARATE from `state` and `animation`. Those two decide
   * what the fighter is DOING — and `ATTACK_STATES`, the root-motion
   * profiles, the hit window and the attack lock are all keyed off them. If
   * the specific clip were pushed through the same channel, a punch would
   * stop being recognised as a punch. This only swaps which animation is
   * played for a move that is otherwise unchanged.
   */
  attackClip?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Animation alias table — maps FighterStateMachine states → GLB clip names
// Sources: Schwarzerblitz engine, mhvnsnt/BrutalfistbaseofTekken3Recompiled,
//          mhvnsnt/Bannon, Mixamo standard names, Blender defaults
// ─────────────────────────────────────────────────────────────────────────────
const ANIMATION_ALIASES: Record<string, string[]> = {
  // ── Idle / Neutral ──────────────────────────────────────────────────────────
  idle:              ['idle', 'Idle', 'neutral', 'Neutral', 'standing', 'Standing', 'stance', 'Stance', 'bind', 'T-pose', 'TPose', 'tpose', 'rest', 'Rest', 'combatIdle', 'CombatIdle', 'fightingStance', 'FightingStance', 'readyStance', 'ReadyStance'],
  Neutral:           ['idle', 'Idle', 'neutral', 'Neutral', 'standing', 'Standing', 'stance', 'Stance'],
  // ── Walk Forward ────────────────────────────────────────────────────────────
  walk:              ['walk', 'Walk', 'walking', 'Walking', 'run', 'Run', 'walkForward', 'WalkForward', 'walk_fwd', 'SBW_walk_fwd', 'T_walk_fwd', 'bf_walk_fwd'],
  Walking:           ['walk', 'Walk', 'walking', 'Walking', 'run', 'Run', 'walkForward', 'WalkForward'],
  walkForward:       ['walkForward', 'WalkForward', 'walk', 'Walk', 'walking', 'Walking', 'forward', 'Forward', 'run', 'Run', 'walk_fwd', 'walk_forward', 'SBW_walk_fwd', 'T_walk_fwd', 'bf_walk_fwd', 'advance', 'approach', 'movingForward'],
  // ── Walk Backward ───────────────────────────────────────────────────────────
  walkBackward:      ['walkBack', 'WalkBack', 'walkBackward', 'WalkBackward', 'walk', 'Walk', 'backward', 'Backward', 'retreat', 'Retreat', 'walk_back', 'walk_bwd', 'SBW_walk_back', 'T_walk_back', 'bf_walk_back', 'movingBackward'],
  // ── Strafe ──────────────────────────────────────────────────────────────────
  strafeLeft:        ['strafeLeft', 'StrafeLeft', 'sidestepLeft', 'SidestepLeft', 'walk', 'Walk', 'moveLeft', 'MoveLeft', 'stepLeft', 'StepLeft', 'SBW_strafe_left', 'T_sidestep_left'],
  strafeRight:       ['strafeRight', 'StrafeRight', 'sidestepRight', 'SidestepRight', 'walk', 'Walk', 'moveRight', 'MoveRight', 'stepRight', 'StepRight', 'SBW_strafe_right', 'T_sidestep_right'],
  sidestepLeft:      ['sidestepLeft', 'SidestepLeft', 'strafeLeft', 'StrafeLeft', 'T_sidestep_left', 'T_ssl'],
  sidestepRight:     ['sidestepRight', 'SidestepRight', 'strafeRight', 'StrafeRight', 'T_sidestep_right', 'T_ssr'],
  // ── Backdash ────────────────────────────────────────────────────────────────
  Backdashing:       ['backdash', 'Backdash', 'backDash', 'BackDash', 'walkBack', 'WalkBack', 'walkBackward', 'WalkBackward', 'walk', 'Walk', 'backstep', 'Backstep', 'quickRetreat', 'QuickRetreat', 'SBW_backdash', 'T_backdash'],
  // ── Crouch ──────────────────────────────────────────────────────────────────
  crouch:            ['crouch', 'Crouch', 'duck', 'Duck', 'lowStance', 'LowStance', 'crouching', 'Crouching', 'crouchStance', 'CrouchStance', 'lowGuard', 'LowGuard', 'SBW_crouch', 'T_crouch', 'bf_crouch'],
  crouchWalk:        ['crouchWalk', 'CrouchWalk', 'crouchForward', 'CrouchForward', 'crouch', 'Crouch'],
  // ── Guard / Block ───────────────────────────────────────────────────────────
  guard:             ['guard', 'Guard', 'block', 'Block', 'defend', 'Defend', 'parry', 'Parry', 'blocking', 'Blocking', 'highBlock', 'HighBlock', 'standingBlock', 'StandingBlock', 'SBW_guard', 'T_guard', 'bf_guard'],
  Guard:             ['guard', 'Guard', 'block', 'Block', 'defend', 'Defend'],
  Blockstun:         ['block', 'Block', 'guard', 'Guard', 'blockstun', 'Blockstun'],
  guardLow:          ['guardLow', 'GuardLow', 'lowBlock', 'LowBlock', 'crouchBlock', 'CrouchBlock', 'guard', 'Guard', 'block', 'Block'],
  // ── Light Attack ────────────────────────────────────────────────────────────
  light:             ['light', 'Light', 'punch', 'Punch', 'attack', 'Attack', 'jab', 'Jab', 'lightAttack', 'LightAttack', 'LP', 'lp'],
  lightAttack:       ['lightAttack', 'LightAttack', 'light', 'Light', 'punch', 'Punch', 'jab', 'Jab', 'attack', 'Attack', 'strike', 'Strike', 'quickPunch', 'QuickPunch', 'punch1', 'Punch1', 'LP', 'lp', 'SBW_lightAttack', 'SBW_jab', 'T_jab', 'T_1', 'bf_jab', 'bf_chop', 'punchingLeft', 'punchingRight', 'attack_1'],
  Startup:           ['lightAttack', 'LightAttack', 'attack', 'Attack', 'punch', 'Punch', 'jab', 'Jab', 'attack_1'],
  Active:            ['lightAttack', 'LightAttack', 'attack', 'Attack', 'punch', 'Punch', 'kick', 'Kick'],
  crouchLightAttack: ['crouchLightAttack', 'CrouchLightAttack', 'crouchPunch', 'CrouchPunch', 'lowPunch', 'LowPunch', 'lightAttack', 'LightAttack', 'jab', 'Jab'],
  // ── Heavy Attack / kicks ────────────────────────────────────────────────────
  heavy:             ['heavy', 'Heavy', 'strong', 'Strong', 'heavyAttack', 'HeavyAttack', 'cross', 'Cross'],
  heavyAttack:       ['heavyAttack', 'HeavyAttack', 'heavy', 'Heavy', 'strong', 'Strong', 'cross', 'Cross', 'attack_rp', 'ILLEGAL_ELBOW_PUNCH', 'RP', 'rp', 'SBW_heavyAttack', 'SBW_cross', 'T_cross', 'T_2', 'bf_cross', 'bf_elbow', 'bf_uppercut'],
  lightKick:         ['lightKick', 'LightKick', 'attack_lk', 'DROP_KICK', 'ILLEGAL_KNEE', 'TIGER_FEINT_KICK', 'LK', 'lk', 'T_3', 'kick', 'Kick', 'kickingLeft'],
  heavyKick:         ['heavyKick', 'HeavyKick', 'attack_rk', 'HURRICANE_KICK', 'AU', 'CAPOEIRA', 'BASH', 'RK', 'rk', 'T_4', 'kickingRight', 'kickingForward'],
  crouchHeavyAttack: ['crouchHeavyAttack', 'CrouchHeavyAttack', 'crouchKick', 'CrouchKick', 'lowKick', 'LowKick', 'heavyAttack', 'HeavyAttack', 'kick', 'Kick'],
  jumpAttack:        ['jumpAttack', 'JumpAttack', 'airAttack', 'AirAttack', 'jumpingPunch', 'JumpingPunch', 'heavyAttack', 'HeavyAttack'],
  runAttack:         ['runAttack', 'RunAttack', 'dashAttack', 'DashAttack', 'runningAttack', 'RunningAttack', 'heavyAttack', 'HeavyAttack'],
  // ── Tekken Specials ─────────────────────────────────────────────────────────
  // Distinct clips, not a second name for the heavy kick — see the finisher
  // and overdrive entries in SemanticStateAliases for how they were chosen.
  overdrive:         ['overdrive', 'Overdrive', 'GYAKUZUKI_COMBO', 'TIGER_HEAVYKICKCOMBO', 'special', 'Special', 'heavyAttack', 'HeavyAttack'],
  finisher:          ['finisher', 'Finisher', 'finisher_move', 'Finisher_Move', 'ORAORAORA', 'TIGER_HEAVYKICKCOMBO', 'GYAKUZUKI_COMBO', 'heavyAttack', 'HeavyAttack'],
  superArmor:        ['superArmor', 'SuperArmor', 'power_crush', 'armorMove', 'ArmorMove', 'heavyAttack', 'HeavyAttack'],
  // ── Command Throw ───────────────────────────────────────────────────────────
  CommandThrow:      ['heavyAttack', 'HeavyAttack', 'heavy', 'Heavy', 'grab', 'Grab', 'throw', 'Throw', 'grapple', 'Grapple', 'suplex', 'Suplex', 'slam', 'Slam', 'SBW_throw', 'T_1_3', 'T_2_4', 'bf_grab', 'bf_beastMode'],
  ThrowWhiff:        ['idle', 'Idle', 'neutral', 'Neutral'],
  // ── Hit Reactions ───────────────────────────────────────────────────────────
  hit:               ['hit', 'Hit', 'hurt', 'Hurt', 'flinch', 'Flinch', 'hitstun', 'Hitstun', 'damage', 'Damage', 'react', 'React', 'stagger', 'Stagger', 'recoil', 'Recoil', 'SBW_hit', 'T_hit', 'bf_hit_reaction', 'gettingHit', 'hitImpact'],
  Hitstun:           ['hit', 'Hit', 'hurt', 'Hurt', 'flinch', 'Flinch', 'damage', 'Damage', 'hitstun', 'Hitstun'],
  HitStun:           ['hit', 'Hit', 'hurt', 'Hurt', 'flinch', 'Flinch', 'damage', 'Damage'],
  Stunned:           ['hit', 'Hit', 'hurt', 'Hurt', 'flinch', 'Flinch', 'damage', 'Damage'],
  hitLow:            ['hitLow', 'HitLow', 'lowHit', 'LowHit', 'hit', 'Hit', 'hurt', 'Hurt'],
  hitHigh:           ['hitHigh', 'HitHigh', 'highHit', 'HighHit', 'hit', 'Hit', 'hurt', 'Hurt'],
  // ── Knockdown ───────────────────────────────────────────────────────────────
  knockdown:         ['knockdown', 'Knockdown', 'ko', 'KO', 'knockout', 'Knockout', 'death', 'Death', 'fall', 'Fall', 'down', 'Down', 'fallingBack', 'FallingBack', 'fallingForward', 'FallingForward', 'knockedDown', 'KnockedDown', 'SBW_knockdown', 'T_knockdown', 'bf_knockdown', 'bf_hard_knockdown'],
  Knockdown:         ['knockdown', 'Knockdown', 'ko', 'KO', 'fall', 'Fall', 'down', 'Down'],
  ko:                ['ko', 'KO', 'knockout', 'Knockout', 'death', 'Death', 'fall', 'Fall', 'knockdown', 'Knockdown'],
  KO:                ['ko', 'KO', 'knockout', 'Knockout', 'death', 'Death', 'fall', 'Fall', 'knockdown', 'Knockdown'],
  Crumple:           ['ko', 'KO', 'knockdown', 'Knockdown', 'fall', 'Fall', 'death', 'Death', 'crumple', 'Crumple'],
  // ── Wakeup ──────────────────────────────────────────────────────────────────
  WakeupTechRoll:    ['techRoll', 'TechRoll', 'roll', 'Roll', 'rollForward', 'RollForward', 'forwardRoll', 'ForwardRoll', 'walkForward', 'WalkForward', 'walk', 'Walk', 'SBW_techroll', 'T_techroll'],
  WakeupBackrise:    ['backrise', 'Backrise', 'getUp', 'GetUp', 'rollBack', 'RollBack', 'walkBackward', 'WalkBackward', 'walk', 'Walk', 'T_backrise'],
  WakeupQuickStand:  ['quickStand', 'QuickStand', 'getUp', 'GetUp', 'gettingUp', 'GettingUp', 'idle', 'Idle', 'standing', 'Standing', 'T_quickstand'],
  // ── Post-match ──────────────────────────────────────────────────────────────
  victory:           ['victory', 'Victory', 'win', 'Win', 'celebrate', 'Celebrate', 'taunt_win', 'TauntWin', 'victoryPose', 'VictoryPose', 'winPose', 'WinPose'],
  defeat:            ['defeat', 'Defeat', 'lose', 'Lose', 'knockdown', 'Knockdown', 'ko', 'KO', 'fall', 'Fall'],
  taunt:             ['taunt', 'Taunt', 'idle', 'Idle', 'victory', 'Victory'],
  intro:             ['intro', 'Intro', 'entrance', 'Entrance', 'idle', 'Idle'],
  // ── Run / Dash ──────────────────────────────────────────────────────────────
  run:               ['run', 'Run', 'running', 'Running', 'sprint', 'Sprint', 'dash', 'Dash', 'walkForward', 'WalkForward', 'walk', 'Walk', 'DRUNK_RUN_FORWARD'],
  dash:              ['dash', 'Dash', 'dashForward', 'DashForward', 'run', 'Run', 'walkForward', 'WalkForward', 'dash_forward'],
  dashForward:       ['dashForward', 'DashForward', 'dash', 'Dash', 'run', 'Run', 'walkForward', 'WalkForward', 'dash_forward'],
  // Real authored jump clips first. CROSS_JUMPS is a source clip but reads as
  // a jumping-jack loop, so it is a last-resort fallback rather than the normal
  // jump. World-space forward/back travel comes from LocomotionSystem.
  jump:              ['BIG_JUMP', 'jump', 'Jump', 'jumpForward', 'jumpBack', 'CROSS_JUMPS'],
  jumpForward:       ['BIG_JUMP', 'jumpForward', 'JumpForward', 'jump', 'Jump', 'CROSS_JUMPS'],
  jumpBack:          ['BIG_JUMP', 'jumpBack', 'JumpBack', 'jump', 'Jump', 'CROSS_JUMPS'],
  Jumping:           ['BIG_JUMP', 'jump', 'Jump', 'CROSS_JUMPS'],
};

// ─────────────────────────────────────────────────────────────────────────────
// Crossfade durations per state key (in seconds)
// Frame counts at 60fps: 6f=0.100s, 4f=0.067s, 3f=0.050s, 2f=0.033s
// ─────────────────────────────────────────────────────────────────────────────
/** The first skinned skeleton under a root — what the body is posed by. */
function skeletonOf(root: THREE.Object3D | null | undefined) {
  if (!root) return null;
  let found: { bones: Array<{ name: string; quaternion: THREE.Quaternion }> } | null = null;
  root.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (!found && m.isSkinnedMesh && m.skeleton?.bones?.length) found = m.skeleton;
  });
  return found;
}

const FADE_DURATIONS: Record<string, number> = {
  // Locomotion — gentle blends
  idle:              0.100,  // 6 frames
  Neutral:           0.100,
  walk:              0.100,
  walkForward:       0.100,
  walkBackward:      0.100,
  Walking:           0.100,
  strafeLeft:        0.100,
  strafeRight:       0.100,
  run:               0.060,
  dash:              0.050,
  dashForward:       0.050,
  jump:              0.040,
  jumpForward:       0.040,
  jumpBack:          0.040,
  Jumping:           0.040,
  crouch:            0.070,
  lightKick:         0.030,
  heavyKick:         0.040,
  // Backdash — slightly faster snap (4 frames)
  Backdashing:       0.067,
  // Wakeup
  WakeupTechRoll:    0.083,
  WakeupBackrise:    0.083,
  WakeupQuickStand:  0.067,
  // Attacks — fast snaps
  light:             0.050,
  lightAttack:       0.050,
  Startup:           0.050,
  Active:            0.033,
  heavy:             0.067,
  heavyAttack:       0.067,
  CommandThrow:      0.067,
  // Hit reactions — very fast
  hit:               0.033,
  Hitstun:           0.033,
  HitStun:           0.033,
  Stunned:           0.033,
  // Knockdown
  knockdown:         0.067,
  Knockdown:         0.067,
  ko:                0.067,
  KO:                0.067,
  Crumple:           0.067,
  // Guard
  guard:             0.083,
  Guard:             0.083,
  block:             0.083,
  Blockstun:         0.083,
  // Throw whiff
  ThrowWhiff:        0.083,
};
const DEFAULT_FADE = 0.083;

// ─────────────────────────────────────────────────────────────────────────────
// States that loop continuously
// ─────────────────────────────────────────────────────────────────────────────
const LOOP_STATES = new Set([
  // Only states whose source clips are authored as continuous loops belong here.
  // Guard/block/knockdown/wakeup are held or one-shot actions: looping their
  // short authored clips makes GUARD fire "guard, guard, guard" and makes a
  // knockdown replay its fall instead of holding the final pose.
  'idle', 'Neutral', 'walk', 'walkForward', 'walkBackward', 'Walking',
  'strafeLeft', 'strafeRight', 'sidestepLeft', 'sidestepRight',
  'run', 'dash', 'dashForward', 'crouch',
  'Backdashing',
]);

const ATTACK_STATES = new Set([
  'lightAttack', 'heavyAttack', 'lightKick', 'heavyKick',
  'light', 'heavy', 'Startup', 'Active', 'CommandThrow',
]);

// ─────────────────────────────────────────────────────────────────────────────
// Velocity threshold — below this magnitude, don't trigger walk animation
// Prevents jitter from micro-inputs that don't reach full walk speed
// ─────────────────────────────────────────────────────────────────────────────
const VELOCITY_ANIM_THRESHOLD = 0.12;

/**
 * Minimum time (seconds) a crossfade must be held before another can begin.
 * Prevents rapid state oscillation (walk→idle→walk in <3 frames) from
 * stacking crossfades and causing visual jitter.
 */
const MIN_CROSSFADE_HOLD_S = 0.05; // 3 frames at 60fps

// ─────────────────────────────────────────────────────────────────────────────
// FORWARD DIRECTION NOTE
// ─────────────────────────────────────────────────────────────────────────────
// Forward direction detection is handled by CharacterPipeline.determineForwardCorrection().
// It uses GEOMETRY CENTROID ONLY — no bone position inference (head Z vs hips Z).
// The pose-based heuristic was removed because a fighting stance can put the
// head forward without the character's actual forward axis being +Z.
// See src/engine/pipeline/CharacterPipeline.ts for the authoritative implementation.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Resolve the best matching clip name from available actions
// ─────────────────────────────────────────────────────────────────────────────
function buildClipsByState(actions: Record<string, THREE.AnimationAction>): Map<string, THREE.AnimationClip> {
  // Ownership is explicit. The baked bank marks the measured source-of-truth
  // clip for a combat semantic with userData.owns=true. Do not let object
  // insertion order accidentally select BOXING/COMBO_PUNCH/CROSS_JUMPS before
  // the authored single-strike GUARD/JAB/ROUNDHOUSE owner.
  const clipsByState = new Map<string, THREE.AnimationClip>();
  const owned = new Map<string, THREE.AnimationClip>();
  for (const [name, action] of Object.entries(actions)) {
    const clip = action.getClip();
    const semantic = (clip as any).userData?.semanticState
      ?? inferSemanticStateFromClipName(clip.name || name)
      ?? inferSemanticStateFromClipName(name);
    if (!semantic) continue;
    if ((clip as any).userData?.owns === true && !owned.has(semantic)) {
      owned.set(semantic, clip);
    }
    if (!clipsByState.has(semantic)) clipsByState.set(semantic, clip);
  }
  for (const [semantic, clip] of owned) clipsByState.set(semantic, clip);
  return clipsByState;
}

function resolveClipName(
  key: string,
  actions: Record<string, THREE.AnimationAction>,
  /**
   * This fighter's own clips for this state, tried BEFORE anything else.
   * Falls straight through when his rig does not carry them, so a preference
   * can only ever add variety — it can never take away a character's own
   * animation or block the generic table.
   */
  preferred: string[] = [],
): string | null {
  const availableClips = Object.keys(actions);

  /**
   * A CLIP NAMED OUTRIGHT IS AN INSTRUCTION, NOT A SUGGESTION.
   *
   * The gates below exist to stop a thrown body leaking into an ATTACK slot.
   * When the arena asks for the victim's half of a grapple BY NAME, those
   * same gates refuse it for exactly the reason it was chosen — it goes
   * horizontal, it can start off its feet, it is somebody being thrown. So a
   * caller that names a real clip gets that clip.
   *
   * The owner's BROKEN verdict still wins, because he looked at it.
   *
   * It is deliberately NOT taken for a combat state or a semantic slot.
   * Those go through the table, where the preference order, the slot owner
   * and the gates all still apply — otherwise a clip that happened to be
   * named after a state would jump the queue and skip every check.
   */
  const isVocabulary = key in COMBAT_STATE_TO_SEMANTIC || key in SEMANTIC_STATE_ALIASES;
  if (!isVocabulary && actions[key] && !labelRefuses(key)) return key;

  const clipsByState = buildClipsByState(actions);

  /**
   * A FROZEN CLIP IS NEVER THE ANSWER IF ANYTHING ELSE MATCHES.
   *
   * MEASURED at bake time: 15 clips move two bones or fewer. Eight are
   * Mixamo character REST POSES shipped as clips; the important one is
   * HURRICANE_KICK, which moves exactly ONE bone of 22 — the hips sweep 172
   * degrees while every other joint sits inside half a degree, so it is a
   * statue spinning on the spot. It is the FIRST alias for attack_2 and
   * attack_rk, so two of the game's core kicks played it.
   *
   * The alias table already carried a note about this defect and left it
   * alone, calling the reorder a design decision. Deciding it by MEASUREMENT
   * instead catches every other frozen clip at the same time.
   *
   * A frozen clip still beats NO clip — that would be a bind pose — so this
   * only ever reorders preferences, never removes the last option.
   */
  /**
   * Usable = it moves, the body is the right way up, and — WHEN THE SLOT
   * BEING FILLED IS AN ATTACK — it contains a strike that reaches out.
   *
   * THE STRIKE RULE IS NOT UNIVERSAL, and applying it universally was a
   * regression the resolution probe caught before it shipped. Clips are
   * given a semantic by NAME at bake time, so CROSS_JUMPS (a jumping-jack
   * loop) and TAUNT are both filed under attack slots; refusing them as
   * attacks is right, and refusing them as a JUMP and a TAUNT is not. With
   * the rule applied everywhere, pressing jump played JUMPAXEKICK and
   * taunting played BREAKDANCE_READY.
   */
  // A VERDICT FROM THE OWNER OUTRANKS EVERY MEASUREMENT HERE, because the
  // measurements keep missing what he sees at a glance: a severed rig
  // scores a PERFECT deformation number, a 17-second T-pose passed the
  // T-pose gate at 0.49 against 0.50, and two taunts that play lying flat
  // passed everything but the eye. Marking a clip BROKEN in the Move
  // Library takes it out of the game.
  const usable = (c: string, forAttack = true) =>
    !labelRefuses(c)
    && clipAnimates(c)
    // A CAPTURE OF THREE WRESTLERS IS NOT A MOVE ONE MAN CAN DO. Twelve of
    // these are in the game, eight of them filling the IDLE slot, and a
    // fighter playing one performs his partner's and his victim's motion at
    // the same time. That is the weird twisting, and no rig work fixes it.
    && !clipIsTeamCapture(c)
    && clipStandsUpright(c)
    && clipStartsStanding(c)
    // A CLIP HE TAGGED AS A REACTION IS NEVER AN ATTACK. This is the one
    // question no measurement here can answer — a thrown body extends a
    // limb forward exactly like a punching one, which is why filtering all
    // 366 clips on reach, plant, facing and uprightness still returns
    // SHARKNADO_REACTION and GRAFTHROWREACTION among the "punches".
    && (!forAttack || (!isReceivingClip(c) && clipStrikesForward(c) && clipKeepsFacing(c)));
  const attackSlot = /^attack|finisher|overdrive/.test(COMBAT_STATE_TO_SEMANTIC[key] ?? key);
  const pick = (test: (c: string) => boolean): string | undefined =>
    availableClips.find((c) => test(c) && usable(c, attackSlot)) ?? availableClips.find(test);

  /**
   * ALIAS ORDER IS PRIORITY, AND IT WAS BEING IGNORED.
   *
   * The lookup was `availableClips.find(c => aliases.some(a => c === a))` —
   * it walks the AVAILABLE CLIPS in whatever order the bank loaded them and
   * returns the first that matches ANY alias. The alias list's order, which
   * is the entire point of an ordered preference list, did nothing.
   *
   * MEASURED on attack_rk: the alias list prefers ROUNDHOUSEKICK, the bake
   * names ROUNDHOUSEKICK as that slot's OWNER, and resolution returned
   * CROSS_JUMPS — a jump clip — because it happened to sit earlier in the
   * bank. Walking the aliases in order instead is what makes a preference
   * mean anything.
   */
  const byAliasOrder = (aliases: string[]): string | undefined => {
    for (const pass of [true, false]) {
      for (const alias of aliases) {
        const hit = availableClips.find(
          (c) => c.toLowerCase() === alias.toLowerCase() && (!pass || usable(c, attackSlot)),
        );
        if (hit) return hit;
      }
    }
    return undefined;
  };

  for (const want of preferred) {
    if (actions[want] && usable(want, attackSlot)) return want;
    const ci = pick((c) => c.toLowerCase() === want.toLowerCase());
    if (ci) return ci;
  }

  const bridged = AnimationBridge.getClipForCombatState(key, clipsByState);
  if (bridged) {
    const clipName = Object.keys(actions).find((n) => actions[n].getClip() === bridged) ?? bridged.name;
    if (actions[clipName]) return clipName;
  }

  const semanticState = COMBAT_STATE_TO_SEMANTIC[key];
  if (semanticState) {
    // THE BAKE'S OWN CHOICE WINS. It measured the candidates and marked one
    // as this slot's owner — GRAFQUICKJAB, a 0.46 s jab, over BOXING, a
    // 1.73 s shadowboxing LOOP. Nothing at runtime was reading that, so a
    // jab played BOXING inside an attack window a fraction of its length.
    // THE OWNER'S OWN ASSIGNMENT COMES FIRST. A human who looked at the
    // clip beats the bake's heuristic, which is the entire reason the Move
    // Library has a "where does it go?" field.
    for (const picked of clipsLabelledFor(semanticState)) {
      if (actions[picked] && usable(picked, attackSlot)) return picked;
    }
    // THE BAKE'S PICK STILL HAS TO BE PLAYABLE. This returned the slot
    // owner unchecked, so a clip the gates refuse everywhere else could
    // still reach the screen by owning a slot.
    const owner = slotOwnerFor(semanticState);
    if (owner && actions[owner] && usable(owner, attackSlot)) return owner;
    if (actions[semanticState] && usable(semanticState, attackSlot)) return semanticState;
    const aliases = SEMANTIC_STATE_ALIASES[semanticState] ?? [semanticState];
    const semanticFound = byAliasOrder(aliases);
    if (semanticFound) return semanticFound;
  }

  const aliases = ANIMATION_ALIASES[key] ?? [key];
  let found = byAliasOrder(aliases);
  if (found) return found;

  if (key === 'idle' || key === 'Neutral') {
    found = pick((c) => c.toLowerCase().includes('idle'));
    if (found) return found;
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalized scene result
// ─────────────────────────────────────────────────────────────────────────────
interface NormalizedResult {
  scene: THREE.Group;
  /** Y rotation to apply to the inner scene to correct forward direction */
  forwardCorrectionY: number;
  /** AnimationMixer bound to the normalized scene's actual bones */
  mixer: THREE.AnimationMixer;
  /** Actions map: clip name → AnimationAction */
  actions: Record<string, THREE.AnimationAction>;
  /** SkeletonHelper for visual bone display (null if no bones) */
  skeletonHelper: THREE.SkeletonHelper | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// AGENT LAW: Universal GLB normalization
//
// Delegates to the shared CharacterPipeline (src/engine/pipeline/CharacterPipeline.ts).
// Both Character Select and Combat use the same pipeline — no divergence.
//
// Pipeline:
//   SkeletonUtils.clone() → frustum culling disabled → skin weights normalized
//   → Box3 floor normalization (instance, not bones) → geometry-centroid forward detection
//   → AnimationMixer on cloned scene → name-based clip binding
//
// AUTHORED SKELETON LAW:
//   - NO synthetic rig generation for bone-less models
//   - NO character-specific corrections
//   - Characters that fail validation return null (BLOCKED)
//   - The caller (FighterMeshInner) must handle null as BLOCKED
//
// NEVER use per-character manual Y offsets.
// NEVER hardcode rotation corrections per character.
// NEVER bind the mixer to the outer group — it must target the cloned scene.
// ─────────────────────────────────────────────────────────────────────────────
async function normalizeGLB(
  scene: THREE.Group,
  animations: THREE.AnimationClip[],
  gltfUrl: string,
  _report: RigDiagnosticReport,
): Promise<NormalizedResult | null> {
  // Delegate to the universal CharacterPipeline.
  // applyPSXShader=true for combat renderer.
  const result = await runCharacterPipeline(scene, animations, gltfUrl, true);

  if (!result) {
    // BLOCKED — asset failed pre-clone validation.
    // DO NOT secretly re-rig. DO NOT generate synthetic bones.
    // The caller must handle null as BLOCKED — ASSET DEFORMATION INTEGRITY FAILURE.
    console.error(
      `[FighterMesh] 🚫 BLOCKED — "${gltfUrl.split('/').pop()}" failed CharacterPipeline validation. ` +
      `Combat entry blocked. Fix the source GLB asset.`
    );
    return null;
  }

  // Map PipelineResult to NormalizedResult (same shape, just aliased)
  return {
    scene: result.scene,
    forwardCorrectionY: result.forwardCorrectionY,
    mixer: result.mixer,
    actions: result.actions,
    skeletonHelper: result.skeletonHelper,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Inner component — loaded inside Suspense, receives the GLTF scene + animations
// ─────────────────────────────────────────────────────────────────────────────
function FighterMeshInner({
  gltfUrl,
  state,
  animation,
  position,
  facing,
  rotationY = 0,
  tint,
  characterId,
  fightingStyle,
  showHitbox = false,
  hitboxGeometry = null,
  animationTrigger = 0,
  attackDurationSeconds,
  locomotionVelocity,
  hitStopActive = false,
  onRigDiagnostic,
  onBoneHitboxReady,
  onDeformationBlocked,
  onAnimationIntegrityReport,
  onModelReady,
  onClipResolved,
  attackClip,
}: {
  gltfUrl: string;
  state: string;
  animation?: string;
  position: [number, number, number];
  facing: 1 | -1;
  rotationY?: number;
  tint?: string;
  characterId?: string;
  fightingStyle?: string;
  showHitbox?: boolean;
  hitboxGeometry?: FighterMeshProps['hitboxGeometry'];
  animationTrigger?: number;
  attackDurationSeconds?: number;
  locomotionVelocity?: { forward: number; strafe: number };
  hitStopActive?: boolean;
  onRigDiagnostic?: (report: RigDiagnosticReport) => void;
  onBoneHitboxReady?: (system: BoneHitboxSystem) => void;
  onDeformationBlocked?: (characterName: string, failingChecks: string[]) => void;
  onAnimationIntegrityReport?: (report: AnimationIntegrityReport) => void;
  onModelReady?: (ok: boolean) => void;
  onClipResolved?: (clip: string | null, inputKey: string) => void;
  attackClip?: string | null;
}) {
  const groupRef = useRef<THREE.Group>(null);
  /**
   * Held in a ref on purpose. The clip-resolution effect lists its
   * dependencies explicitly, and a callback that changes identity every
   * render would re-run the whole resolution — which restarts the
   * animation — once per frame.
   */
  const onClipResolvedRef = useRef(onClipResolved);
  onClipResolvedRef.current = onClipResolved;
  const [normalized, setNormalized] = useState<NormalizedResult | null>(null);

  /**
   * This fighter's own stance, guard, crouch and walk. Deterministic from his
   * id, so it is a signature rather than a roll. With no id every preference
   * list is empty and the generic alias table decides exactly as before.
   */
  const stanceKit = useMemo(
    () => (characterId ? stanceKitFor(characterId, fightingStyle) : null),
    [characterId, fightingStyle],
  );

  // ── Jitter-prevention refs ────────────────────────────────────────────────
  /** The clip name that is currently playing (or crossfading to) */
  const activeClipRef = useRef<string | null>(null);
  /** Timestamp of the last crossfade start — enforces MIN_CROSSFADE_HOLD_S */
  const lastCrossfadeTimeRef = useRef<number>(0);
  /** The resolved clip name of the last state we committed to */
  const committedClipRef = useRef<string | null>(null);
  const lastPlayedTriggerRef = useRef(0);
  /** Attack owns the mixer until its authored state-machine window expires. */
  const attackLockUntilRef = useRef(0);

  /**
   * RE-RUN THE ANIMATION EFFECT WHEN A REFUSED TRANSITION BECOMES LEGAL.
   *
   * Owner: "freezing and sticky combat animations, like being stuck in an
   * end punch frame while I'm trying to attack, and with other moves too."
   *
   * THE BUG IS A DROPPED TRANSITION, NOT A STUCK STATE MACHINE. The effect
   * below refuses a transition for two timing reasons — an attack still owns
   * the mixer (`attackLockUntilRef`), or the last crossfade was under
   * MIN_CROSSFADE_HOLD_S ago — and in both cases it just `return`ed. A React
   * effect only re-runs when its inputs change, so a refusal THREW THE
   * TRANSITION AWAY. Nothing ever retried it.
   *
   * The attack lock runs for the whole attack window, and the state machine
   * publishes `idle` at exactly that boundary, so whether idle lands inside
   * or outside the lock is a RACE — which is precisely why it is sticky
   * sometimes and fine other times. When idle loses that race, the attack's
   * clamped final frame holds forever, which is the end-punch pose.
   *
   * Bumping this counter when the lock expires re-runs the effect with the
   * same inputs, and the transition it refused a moment ago now happens.
   */
  const [deferTick, setDeferTick] = useState(0);
  const deferTimerRef = useRef<number | null>(null);
  const deferUntil = useCallback((seconds: number) => {
    const ms = Math.max(8, Math.ceil(seconds * 1000) + 8);
    if (deferTimerRef.current !== null) return; // one pending retry is enough
    deferTimerRef.current = window.setTimeout(() => {
      deferTimerRef.current = null;
      setDeferTick((n) => n + 1);
    }, ms);
  }, []);
  useEffect(() => () => {
    if (deferTimerRef.current !== null) window.clearTimeout(deferTimerRef.current);
  }, []);

  // ── Bone hitbox system ────────────────────────────────────────────────────
  const boneHitboxRef = useRef<BoneHitboxSystem>(new BoneHitboxSystem());

  // ── Active attack key for root motion ────────────────────────────────────
  const activeAttackKeyRef = useRef<string | null>(null);

  // ── Deformation integrity: track whether combat-entry check has run ───────
  // AGENT LAW: The 14-point deformation integrity test runs ONCE per fighter
  // load when the first combat-active state is entered. It never runs on
  // select-screen idle states. If the test returns BLOCKED, combat is frozen
  // by logging the failure — the caller (CombatArena3D) reads the ref.
  const combatEntryCheckedRef = useRef<boolean>(false);
  /**
   * Set to true if the deformation integrity test PASSED.
   * Set to false if BLOCKED — CombatArena3D should freeze combat.
   * Exposed via onDeformationBlocked callback if provided.
   */
  const deformationPassedRef = useRef<boolean>(true);

  // useGLTF caches the result — Meshopt + Draco MUST be on (Bannon GLBs are Meshopt).
  // drei only enables them when the flags are passed; defaults on the helper are unused.
  const { scene, animations } = useGLTF(gltfUrl, true, true);

  // ── Universal normalization + mixer creation ──────────────────────────────
  useEffect(() => {
    if (!scene) return;

    // Run rig diagnostic on the original scene
    const report = AutoRigDetector.analyze(scene, animations);
    onRigDiagnostic?.(report);

    // Normalize and create mixer bound to the cloned visible scene
    let cancelled = false;
    normalizeGLB(scene as THREE.Group, animations, gltfUrl, report).then(result => {
      if (cancelled) return;

      // BLOCKED — asset failed CharacterPipeline validation.
      // DO NOT secretly re-rig. Fire the blocked callback and stop.
      if (!result) {
        const characterName = gltfUrl.split('/').pop()?.replace('.glb', '') ?? gltfUrl;
        console.error(
          `[FighterMesh] 🚫 BLOCKED — "${characterName}" failed CharacterPipeline validation. ` +
          `ASSET DEFORMATION INTEGRITY FAILURE. Fix the source GLB.`
        );
        onDeformationBlocked?.(characterName, ['PIPELINE_VALIDATION_FAILED']);
        onModelReady?.(false);
        return;
      }

      // Initialize bone hitbox system from the normalized scene
      result.scene.updateMatrixWorld(true);
      boneHitboxRef.current.initFromSkeleton(result.scene);
      onBoneHitboxReady?.(boneHitboxRef.current);

      setNormalized(result);
      onModelReady?.(true);
    });

    // Cleanup: stop all actions when model changes
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, gltfUrl]);

  // ── Bind FighterStateMachine state → AnimationMixer playback ─────────────
  useEffect(() => {
    if (!normalized) return;
    const { actions, mixer } = normalized;

    const availableClips = Object.keys(actions);
    if (availableClips.length === 0) {
      console.warn(`[FighterMesh] ⚠️ No animation clips available for "${gltfUrl.split('/').pop()}"`);
      return;
    }

    const inputKey = animation ?? state;
    let clipName = resolveClipName(
      inputKey,
      actions,
      stanceKit ? stancePreferences(stanceKit, inputKey) : [],
    ) as string | null;

    // THE COMMAND'S OWN ANIMATION WINS. See `attackClip`: the move keeps its
    // state, its windows and its root motion, and only the clip changes —
    // which is the whole difference between a moveset and four swings.
    // Refused clips are still refused: his BROKEN verdict and the team-capture
    // gate both apply, so this can never smuggle one back in.
    if (attackClip && actions[attackClip] && !labelRefuses(attackClip) && !clipIsTeamCapture(attackClip)) {
      clipName = attackClip;
    }

    const isAttack = ATTACK_STATES.has(inputKey);
    if (isAttack) {
      const profile = ATTACK_ROOT_MOTION_PROFILES[inputKey];
      if (profile?.hasRootMotion) {
        activeAttackKeyRef.current = inputKey;
        boneHitboxRef.current.activateAttack(inputKey);
      } else {
        activeAttackKeyRef.current = null;
      }
    } else if (activeAttackKeyRef.current) {
      boneHitboxRef.current.deactivateAll();
      activeAttackKeyRef.current = null;
    }

    console.log(
      `[FighterMesh] 🎬 input="${inputKey}" → clip="${clipName ?? 'NONE'}" trigger=${animationTrigger}`,
    );
    onClipResolvedRef.current?.(clipName, inputKey);

    // ── COMBAT ENTRY: Run 14-point deformation integrity test ─────────────────
    // AGENT LAW: The deformation integrity test runs ONCE when the first
    // non-idle combat state is entered. This is DIAGNOSTIC ONLY — it logs
    // warnings but NEVER blocks animation playback. The mixer is always
    // recovered after the FIRST_FRAME_DISPLACEMENT check resets it.
    //
    // onDeformationBlocked is only fired for truly unrenderable assets
    // (NO_VISIBLE_MESH) — not for skeleton-type classification mismatches.
    const isCombatActiveState = inputKey !== 'idle' && inputKey !== 'Neutral' && inputKey !== 'bind';
    if (isCombatActiveState && !combatEntryCheckedRef.current && normalized) {
      combatEntryCheckedRef.current = true;

      const integrityInput: DeformationIntegrityInput = {
        characterName: gltfUrl.split('/').pop()?.replace('.glb', '') ?? gltfUrl,
        modelUrl: gltfUrl,
        clonedScene: normalized.scene,
        mixer: normalized.mixer,
        actions: normalized.actions,
        forwardCorrectionY: normalized.forwardCorrectionY,
      };

      const report = runDeformationIntegrityTest(integrityInput);

      // ── Run Animation Integrity Gate (per-fighter pre-combat report) ────────
      // This produces the structured PASS/BLOCKED/UNKNOWN report documenting:
      //   VISIBLE MESHES, SKINNED MESHES, SKELETON BONES, ANIMATION CLIPS,
      //   TRACKS, RESOLVED TRACKS, UNRESOLVED TRACKS, ACTIVE CLIP,
      //   MIXER ROOT, BONE TRAVEL
      const animIntegrityReport = runAnimationIntegrityGate({
        characterName: integrityInput.characterName.toUpperCase(),
        clonedScene: normalized.scene,
        mixer: normalized.mixer,
        actions: normalized.actions,
        activeClipName: activeClipRef.current,
      });
      // Fire callback so parent (CombatArena3D / GameBattleArena) can display the report
      (onAnimationIntegrityReport as ((r: AnimationIntegrityReport) => void) | undefined)?.(animIntegrityReport);

      // DIAGNOSTIC ONLY: log the result but never block animation playback.
      // NOTE: FIRST_FRAME_DISPLACEMENT only calls mixer.stopAllAction() when
      // SkinnedMeshes with valid skeletons are present. For static-mesh GLBs,
      // the mixer is NOT stopped — so we only need to recover when the test
      // actually ran the destructive path (i.e., skinnedMeshes with skeletons exist).
      if (report.verdict === 'BLOCKED') {
        // Only fire the blocked callback for truly unrenderable assets
        const isUnrenderable = report.failingChecks.includes('NO_VISIBLE_MESH');
        if (isUnrenderable) {
          console.error(
            `[FighterMesh] 🚫 COMBAT FROZEN — ${integrityInput.characterName} ` +
            `has NO_VISIBLE_MESH: nothing to render. Fix the GLB asset.`
          );
          onDeformationBlocked?.(integrityInput.characterName, report.failingChecks);
          return; // Truly unrenderable — stop here
        }
        // For all other failures (SKELETON_EXISTS, SKINNED_MESH_SKELETON, etc.)
        // these are diagnostic warnings — the model may still animate correctly
        // via Three.js internal skinning even without standard Bone/SkinnedMesh types.
        console.warn(
          `[FighterMesh] ⚠️ Deformation integrity warnings for ${integrityInput.characterName}: ` +
          `[${report.failingChecks.join(', ')}] — animation playback continues (diagnostic only).`
        );
      }

      // Check if FIRST_FRAME_DISPLACEMENT ran the destructive path (stopped the mixer).
      // It only does so when SkinnedMeshes with valid skeletons exist.
      // We detect this by checking if any action is currently running — if none are,
      // the mixer was stopped and we must recover.
      const anyActionRunning = Object.values(normalized.actions).some(a => a?.isRunning());
      if (!anyActionRunning) {
        // Mixer was stopped by FIRST_FRAME_DISPLACEMENT — recover ONLY the requested clip.
        // Never silently substitute idle for a missing combat semantic state.
        const recoverClip = resolveClipName(
          inputKey,
          normalized.actions,
          stanceKit ? stancePreferences(stanceKit, inputKey) : [],
        );
        if (recoverClip && normalized.actions[recoverClip]) {
          const recoverAction = normalized.actions[recoverClip];
          const isRecoverLoop = LOOP_STATES.has(inputKey);
          recoverAction.setLoop(isRecoverLoop ? THREE.LoopRepeat : THREE.LoopOnce, isRecoverLoop ? Infinity : 1);
          recoverAction.clampWhenFinished = !isRecoverLoop;
          recoverAction.reset().play();
          activeClipRef.current = recoverClip;
          committedClipRef.current = recoverClip;
          lastCrossfadeTimeRef.current = performance.now() / 1000;
          console.log(`[FighterMesh] 🔄 Mixer recovered after integrity test — playing "${recoverClip}" for "${integrityInput.characterName}"`);
        } else if (inputKey !== 'idle' && inputKey !== 'Neutral') {
          console.warn(
            `[FighterMesh] ⚠️ MISSING_CLIP after integrity recovery: combatState="${inputKey}" — not substituting idle`,
          );
        }
      } else {
        console.log(`[FighterMesh] ✅ Mixer still running after integrity test (static mesh path) — no recovery needed for "${integrityInput.characterName}"`);
      }

      // Integrity test handled — proceed to normal animation logic below
      deformationPassedRef.current = true;
    }

    // Only block animation for truly unrenderable assets (NO_VISIBLE_MESH)
    if (!deformationPassedRef.current) {
      return;
    }

    if (!clipName || !actions[clipName]) {
      const semantic = COMBAT_STATE_TO_SEMANTIC[inputKey];
      if (semantic && semantic !== 'idle' && actions[semantic]) {
        clipName = semantic;
      } else if (inputKey === 'idle' || inputKey === 'Neutral') {
        clipName = availableClips.find((n) => /idle/i.test(n)) ?? availableClips[0] ?? null;
      }
    }
    if (!clipName || !actions[clipName]) {
      console.warn(`[FighterMesh] ⚠️ No matching clip for state="${state}" animation="${animation}" on "${gltfUrl.split('/').pop()}"`);
      return;
    }

    const nextAction = actions[clipName];
    /**
     * THE BLEND IS A PROPERTY OF THE PAIR, NOT OF THE DESTINATION.
     *
     * FADE_DURATIONS is keyed only by where you are GOING, so a snap out of a
     * hit reaction and a long settle out of a run got the same number entering
     * the same idle. Measured over 714 real clip transitions, the pose distance
     * between them spans 20 to 68 degrees — a genuine spread that one key
     * cannot express.
     *
     * So the distance is measured against the live skeleton and the duration
     * follows it, inside the range this table already used. The table stays as
     * the fallback for any transition that cannot be measured, which keeps
     * unmeasurable cases behaving exactly as before rather than as an average.
     */
    const tabled = FADE_DURATIONS[inputKey] ?? DEFAULT_FADE;
    const fadeDuration = blendDurationFor(
      skeletonOf(normalized.scene),
      nextAction.getClip(),
      tabled,
    );
    const isLoop = LOOP_STATES.has(inputKey);
    const isUrgent = isAttack || isThrowVictimClip(inputKey)
      || ['hit', 'Hitstun', 'HitStun', 'Stunned', 'knockdown', 'Knockdown', 'ko', 'KO', 'Crumple', 'jump', 'jumpForward', 'jumpBack', 'Jumping'].includes(inputKey);
    /**
     * BEING THROWN OUTRANKS WHATEVER HE WAS DOING.
     *
     * This list is keyed on the STATE name, and the opponent's half of a
     * grapple arrives as a CLIP name — so a body mid-punch when the throw
     * committed would have had his half deferred behind his own attack lock
     * and the crossfade hold, or dropped. A knockdown interrupts; so does
     * the thing that causes it.
     */
    const isDefensiveInterrupt = ['hit', 'Hitstun', 'HitStun', 'Stunned', 'knockdown', 'Knockdown', 'ko', 'KO', 'Crumple'].includes(inputKey)
      || isThrowVictimClip(inputKey);
    const isSameClip = clipName === committedClipRef.current;
    const now = performance.now() / 1000;

    // State machines can publish idle/walk transitions while an input-driven
    // attack is still inside its committed move window. Ignore those passive
    // transitions; the attack action itself owns the mixer until the window
    // expires. A real hit/KO remains an explicit interrupt.
    if (!isAttack && !isDefensiveInterrupt && now < attackLockUntilRef.current) {
      // DEFER, do not drop. Come back the moment the attack releases the
      // mixer, or this transition is lost and the last frame holds.
      deferUntil(attackLockUntilRef.current - now);
      return;
    }

    if (isSameClip && isAttack) {
      if (animationTrigger <= lastPlayedTriggerRef.current) return;
      lastPlayedTriggerRef.current = animationTrigger;
    } else if (!isUrgent && isSameClip) {
      return;
    } else if (!isUrgent && now - lastCrossfadeTimeRef.current < MIN_CROSSFADE_HOLD_S) {
      deferUntil(MIN_CROSSFADE_HOLD_S - (now - lastCrossfadeTimeRef.current));
      return;
    }
    if (isAttack) lastPlayedTriggerRef.current = animationTrigger;

    nextAction.enabled = true;
    nextAction.paused = false;
    nextAction.setLoop(isLoop ? THREE.LoopRepeat : THREE.LoopOnce, isLoop ? Infinity : 1);
    nextAction.clampWhenFinished = !isLoop;
    nextAction.reset();
    // Attacks are authored at mixed source rates (including long Mixamo
    // boxing demonstrations). Fit the entire authored clip to the fighter's
    // state-machine window instead of cutting it off when recovery ends.
    // LoopOnce + clampWhenFinished then holds the final pose until the state
    // machine explicitly transitions away; idle cannot interrupt the swing.
    const clipDuration = Math.max(0.001, nextAction.getClip().duration);
    const attackWindow = isAttack && attackDurationSeconds && attackDurationSeconds > 0
      ? attackDurationSeconds
      : null;
    const jumpWindow = ['jump', 'jumpForward', 'jumpBack', 'Jumping'].includes(inputKey) ? 0.55 : null;
    nextAction.setEffectiveTimeScale(
      attackWindow ? clipDuration / attackWindow : jumpWindow ? clipDuration / jumpWindow : 1,
    );
    nextAction.setEffectiveWeight(1);
    if (isAttack && attackWindow) {
      attackLockUntilRef.current = now + attackWindow;
    }

    const seen = new Set<THREE.AnimationAction>();
    for (const name of availableClips) {
      const a = actions[name];
      if (!a || a === nextAction || seen.has(a)) continue;
      seen.add(a);
      // Hard-cut idle off whenever a real combat/locomotion clip plays so
      // breathing-idle cannot win the blend and leave a "living statue".
      if (isUrgent || (inputKey !== 'idle' && inputKey !== 'Neutral')) {
        a.stop();
        a.enabled = false;
        a.setEffectiveWeight(0);
      } else if (a.isRunning()) {
        a.fadeOut(fadeDuration);
      }
    }
    nextAction.play();
    console.log(`[FighterMesh] ▶️ "${inputKey}" → "${clipName}" urgent=${isUrgent}`);

    activeClipRef.current = clipName;
    committedClipRef.current = clipName;
    lastCrossfadeTimeRef.current = now;
  // `deferTick` is here so a transition refused for a TIMING reason gets
  // another go. Without it a refusal is permanent, because an effect does not
  // re-run on unchanged inputs — see deferUntil.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, animation, attackClip, animationTrigger, attackDurationSeconds, normalized, gltfUrl, deferTick]);

  // Idle kickstart is handled by the bind effect when `normalized` first lands.
  // A second auto-play effect was overwriting punches with breathing idle.

  // ── Hit-stop: pause/resume mixer time scale ───────────────────────────────
  useEffect(() => {
    if (!normalized) return;
    const { mixer } = normalized;
    // AGENT LAW: Use timeScale=0 to freeze animation during hit-stop.
    // We still call mixer.update() every frame — timeScale=0 means no time advances.
    // This is correct Three.js hit-stop pattern: freeze in place, not skip updates.
    if (hitStopActive) {
      mixer.timeScale = 0;
    } else {
      mixer.timeScale = 1;
    }
  }, [hitStopActive, normalized]);

  // ── Toggle skeleton helper visibility with showHitbox ────────────────────
  useEffect(() => {
    if (!normalized?.skeletonHelper) return;
    normalized.skeletonHelper.visible = showHitbox;
  }, [showHitbox, normalized]);

  // ── useFrame: position + rotation + mixer update + bone hitbox ───────────
  useFrame((_, delta) => {
    if (!groupRef.current) return;

    const attacking = state === 'Startup' || state === 'Active' || ATTACK_STATES.has(state);
    groupRef.current.position.set(position[0], position[1], position[2]);

    // Rotation — driven entirely by rotationY prop from parent screen
    groupRef.current.rotation.y = rotationY;

    // Attack pulse — uniform scale, no mirroring
    const attackScale = attacking ? 1.03 : 1.0;
    groupRef.current.scale.set(attackScale, attackScale, attackScale);

    // AGENT LAW: ALWAYS call mixer.update() every frame.
    // Hit-stop is handled by mixer.timeScale = 0 (set in useEffect above).
    // Skipping mixer.update() entirely causes animation state to desync —
    // the mixer's internal clock stops tracking and crossfades break on resume.
    if (normalized) {
      normalized.mixer.update(delta);
      // Update skeleton helper world matrices so bone lines track correctly
      if (normalized.skeletonHelper && showHitbox) {
        normalized.skeletonHelper.updateMatrixWorld(true);
      }
    }

    // Update bone hitbox system (tracks bone world positions)
    // Always update so hitbox positions stay in sync with skeleton
    boneHitboxRef.current.update(delta);
  });

  if (!normalized) return null;

  const activeSpheres = boneHitboxRef.current.getActiveSpheres();

  return (
    <group ref={groupRef} position={position}>
      {/*
        AGENT LAW: The inner group applies the forward correction rotation.
        This is SEPARATE from the outer group's rotationY (P1/P2 orientation).
        forwardCorrectionY is 0 for correctly-exported models (Bannon, Maime).
        forwardCorrectionY is Math.PI for models exported facing +Z (most others).
        This is detected automatically — never hardcoded per character.
      */}
      <group rotation={[0, normalized.forwardCorrectionY, 0]}>
        <primitive object={normalized.scene} />
        {/* Skeleton helper — shows bones/joints as green wireframe lines when showHitbox=true */}
        {normalized.skeletonHelper && showHitbox && (
          <primitive object={normalized.skeletonHelper} />
        )}
      </group>

      {/* Legacy AABB hitbox (shown when bone hitboxes are unavailable) */}
      {showHitbox && hitboxGeometry && activeSpheres.length === 0 && (
        <mesh
          position={[
            hitboxGeometry.offsetX * (facing < 0 ? -1 : 1),
            1.0,
            hitboxGeometry.offsetZ,
          ]}
        >
          <boxGeometry args={[hitboxGeometry.width, 1.6, hitboxGeometry.depth]} />
          <meshBasicMaterial color="#ff2222" wireframe transparent opacity={0.6} />
        </mesh>
      )}

      {/* Bone-parented hitbox spheres — rendered at bone world positions */}
      {showHitbox && activeSpheres.map((sphere, i) => (
        <mesh
          key={`bone-hitbox-${sphere.boneSlot}-${i}`}
          position={[
            sphere.worldCenter.x - position[0],
            sphere.worldCenter.y - position[1],
            sphere.worldCenter.z - position[2],
          ]}
        >
          <sphereGeometry args={[sphere.radius, 8, 8]} />
          <meshBasicMaterial
            color={sphere.attackLevel === 'high' ? '#ff4400' : sphere.attackLevel === 'low' ? '#ffaa00' : '#ff2222'}
            wireframe
            transparent
            opacity={0.7}
          />
        </mesh>
      ))}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Fallback placeholder while GLB loads
// ─────────────────────────────────────────────────────────────────────────────
function FighterPlaceholder({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.925, 0]}>
        <boxGeometry args={[0.5, 1.85, 0.3]} />
        <meshBasicMaterial color="#333333" wireframe />
      </mesh>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Public export — wraps inner component in Suspense
// ─────────────────────────────────────────────────────────────────────────────
export function FighterMesh({
  modelUrl,
  position,
  facing,
  rotationY = 0,
  state,
  animation,
  tint,
  showHitbox = false,
  hitboxGeometry = null,
  animationTrigger = 0,
  locomotionVelocity,
  hitStopActive = false,
  onRigDiagnostic,
  onBoneHitboxReady,
  onDeformationBlocked,
  onAnimationIntegrityReport,
  onModelReady,
  onClipResolved,
  attackClip,
}: FighterMeshProps) {
  // NO MODEL TO WAIT FOR. Say so immediately, or a caller holding the
  // cinematic open for this fighter waits for something that never arrives.
  useEffect(() => { if (!modelUrl) onModelReady?.(false); }, [modelUrl, onModelReady]);
  if (!modelUrl) return <FighterPlaceholder position={position} />;

  return (
    <Suspense fallback={<FighterPlaceholder position={position} />}>
      <FighterMeshInner
        gltfUrl={modelUrl}
        state={state}
        animation={animation}
        position={position}
        facing={facing}
        rotationY={rotationY}
        tint={tint}
        showHitbox={showHitbox}
        hitboxGeometry={hitboxGeometry}
        animationTrigger={animationTrigger}
        locomotionVelocity={locomotionVelocity}
        hitStopActive={hitStopActive}
        onRigDiagnostic={onRigDiagnostic}
        onBoneHitboxReady={onBoneHitboxReady}
        onDeformationBlocked={onDeformationBlocked}
        onAnimationIntegrityReport={onAnimationIntegrityReport}
        onModelReady={onModelReady}
        onClipResolved={onClipResolved}
        attackClip={attackClip}
      />
    </Suspense>
  );
}
