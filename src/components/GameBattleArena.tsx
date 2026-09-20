'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

import { preFightSequence, type IntroBeat } from '../engine/combat/PreFightIntros';
import { reactionFor, resolveHitReaction } from '../engine/combat/HitReactions';
import { type BannonFighterProfile } from '../data/bannonRoster';
import { GameEngine } from '../engine/GameEngine';
import { getCharacterMoveSet } from '../engine/CharacterMoveSetSystem';
import { getMoveById } from '../engine/BrutalFistMoveCatalog';
import { FighterState, type InputBitmask } from '../types';
import MoveExecutionFeedback from './MoveExecutionFeedback';
import { MobileControls } from './MobileControls';
import { useSoundEffects } from '../hooks/useSoundEffects';
import { type CinematicPhase } from './CombatArena3D';
import { type TournamentSettings, DEFAULT_TOURNAMENT_SETTINGS } from './TournamentSettingsScreen';
import dynamic from 'next/dynamic';
import PostMatchScreen, { type RoundResult } from './PostMatchScreen';

// ── New combat systems ────────────────────────────────────────────────────────
import {
  FighterStateMachine,
  type FighterInput as SMInput,
  DEFAULT_SPECIAL_MOVES,
  COMMAND_THROW_MOVE,
} from '../engine/combat/FighterStateMachine';
import { FrameDataHitboxSystem } from '../engine/combat/FrameDataHitbox';
import {
  createComboState,
  registerHit,
  tickComboSystem,
  type ComboState,
} from '../engine/combat/ComboSystem';
import type { DebugOverlaySettings, FighterDebugData, ImpactMarker } from '../engine/debug/DebugOverlay';
import { DEFAULT_DEBUG_SETTINGS, computeFrameWindowData, computeRigState } from '../engine/debug/DebugOverlay';
import ComboCounterHUD from './ComboCounterHUD';
import DebugOverlayHUD from './DebugOverlayHUD';
import { useMatchRecorder, PauseMenuRecorder, saveReplayToSupabase } from './MatchRecorder';
import { InputStringRecorder } from './InputStringRecorder';
import { useAuth } from '../contexts/AuthContext';
// ── Locomotion + bone hitbox systems ─────────────────────────────────────────
import { LocomotionSystem, ATTACK_ROOT_MOTION_PROFILES, locomotionBoundsFromStage } from '../engine/locomotion/LocomotionSystem';
import { createTekkenStick } from '../engine/combat/TekkenInput';
import { receiverClipFor } from '../engine/combat/GrapplePairing';
import { bakedClipNames } from '../engine/retarget/BakedMotionBank';
import { BoneHitboxSystem, HIT_STOP_DURATIONS, HIT_STOP_DEFAULT_MS } from '../engine/locomotion/BoneHitboxSystem';
// ── Announcer system ──────────────────────────────────────────────────────────
import { getAnnouncerSystem } from '../engine/announcer/AnnouncerSystem';
// ── Momentum system ──────────────────────────────────────────────────────────
import { createMomentumChargeState, tickMomentumCharge, applyMomentumChargeCounterHit, type MomentumChargeState,  } from '../engine/combat/MomentumSystem';
// ── Decoupled combat state tick ───────────────────────────────────────────────
import { createCombatMatchState, tickCombatState, checkSidestepWhiff, type CombatMatchState,  } from '../engine/combat/CombatStateTick';
// ── Wall system ───────────────────────────────────────────────────────────────
// ── Stage config & arena state ────────────────────────────────────────────────
import {
  resolveStageConfig,
  createArenaCombatState,
  tickArenaState,
  type ArenaCombatState,
  type StageId,
} from '../engine/combat/StageConfig';
// ── Stage Manager — multi-tier transitions, train hazard, ledge throws, wall breaks ──
import { createStageManagerState, tickTrainHazard, tickFloorBreak, tickLedgeThrow, tickDestructibleWalls, tickHazardBounce, triggerFloorBreak, executeLedgeThrow, applyWallBreak, applyHazardBounce, checkLedgeThrowOverride, checkWallBreak, checkHazardVolume, TRAIN_HIT_DAMAGE, TRAIN_PLATFORM_Y, type StageManagerState,  } from '../engine/combat/StageManager';
import { wallBoundsFromStage } from '../engine/combat/WallSystem';
// ── Motion commands (d/f+2, b,f+P, quarter-circles) ──────────────────────────
import { createCommandBuffer, pushInput, type Facing } from '../engine/combat/CommandInput';
import {
  createRoundState, openingAnnouncement, resolveRound, type RoundState,
} from '../engine/combat/RoundSystem';
import { commandButtonsFor, moveSetForFighter, schwarzerblitzSpecials } from '../engine/combat/SchwarzerblitzSpecials';
// ── Overdrive / super armor / Finisher ──────────────────────────────────────
import { type OverdriveState, type SuperArmorState, type FinisherState,  } from '../engine/combat/OverdriveSystem';
// ── Directional throw system ──────────────────────────────────────────────────
import { checkThrowRange, detectThrowInput, getThrowDamage, THROW_CATALOG,  } from '../engine/combat/DirectionalThrowSystem';
// ── Global Audio Manager ──────────────────────────────────────────────────────
import { getGlobalAudioManager } from '../engine/audio/GlobalAudioManager';
// ── Hit Effect System ─────────────────────────────────────────────────────────
import { type HitEffectPool } from '../engine/combat/HitEffectSystem';

// ── 3D combat arena — loaded client-side only ─────────────────────────────────
const CombatArena3D = dynamic(() => import('./CombatArena3D'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-black">
      <div className="text-yellow-400 text-xs tracking-widest animate-pulse font-mono">LOADING ARENA...</div>
    </div>
  ),
});

interface GameBattleArenaProps {
  p1Fighter: BannonFighterProfile;
  p2Fighter: BannonFighterProfile;
  onMatchEnd?: (winner: 'p1' | 'p2' | 'draw') => void;
  onBack?: () => void;
  roundLabel?: string;
  p1SkinTint?: string;
  p2SkinTint?: string;
  /** Tournament settings (difficulty, FOV, audio toggles) */
  settings?: TournamentSettings;
  /** Stage to load in the combat arena */
  stageId?: import('./StageSelectScreen').StageId;
  /** Debug overlay settings — only passed from practice mode */
  debugSettings?: DebugOverlaySettings;
  /** When true, shows practice-mode label and enables debug settings panel */
  isPracticeMode?: boolean;
}

const EMPTY_INPUT: InputBitmask = {
  up: false, down: false, left: false, right: false,
  light: false, heavy: false, guard: false,
  grapple: false, escape: false, pin: false,
};

const FACTION_COLOR: Record<string, string> = {
  alliance:    '#1d4ed8',
  corporate:   '#dc2626',
  chaos:       '#7c3aed',
  independent: '#d97706',
};

// ── Cinematic timing constants ────────────────────────────────────────────────
const SWEEP_DURATION_MS = 2000;
const INTRO_DURATION_MS = 2500;
// Post-match screen delay after KO/victory cinematic
const POST_MATCH_DELAY_MS = 3600;

export default function GameBattleArena({
  p1Fighter,
  p2Fighter,
  onMatchEnd,
  onBack,
  roundLabel,
  p1SkinTint,
  p2SkinTint,
  settings = DEFAULT_TOURNAMENT_SETTINGS,
  stageId = 'urban_night',
  debugSettings = DEFAULT_DEBUG_SETTINGS,
  isPracticeMode = false,
}: GameBattleArenaProps) {
  const engineRef = useRef<GameEngine | null>(null);
  const inputRef = useRef<InputBitmask>({ ...EMPTY_INPUT });
  const rafRef = useRef<number>(0);
  const [frame, setFrame] = useState(0);
  const [p1Health, setP1Health] = useState(p1Fighter.hp);
  const [p2Health, setP2Health] = useState(p2Fighter.hp);
  const [p1State, setP1State] = useState<string>('Neutral');
  const [p2State, setP2State] = useState<string>('Neutral');
  const [p1Animation, setP1Animation] = useState<string>('idle');
  const [p2Animation, setP2Animation] = useState<string>('idle');

  /**
   * THE OPPONENT'S HALF OF A GRAPPLE.
   *
   * Owner, twice: "neck breaker ... would have two animation parts, one for
   * the deliverer and the receiver", and "Scoop slam is a grapple too that
   * needs the opponent side, and same for all grapples."
   *
   * A landed throw used to call `applyKnockdown()` on the victim and leave
   * it there, so the same stock fall answered a DDT, a giant swing and a
   * scoop slam — at a length that had nothing to do with the throw being
   * done to him. This holds the victim on the paired clip for exactly as
   * long as that clip runs, then hands him back to the knockdown he was
   * going to play anyway.
   *
   * Which clip each body is REALLY playing comes from the resolver itself
   * (`onClipResolved`), not from a second copy of the lookup here.
   */
  const [grappleBeat, setGrappleBeat] = useState<{ victim: 'p1' | 'p2'; clip: string; source: string } | null>(null);
  const grappleBeatTimer = useRef<number | null>(null);
  /** Mirrored for the probe: state is not readable from outside React. */
  const grappleBeatRef = useRef<{ victim: 'p1' | 'p2'; clip: string; source: string } | null>(null);
  const liveClipRef = useRef<{ p1: string | null; p2: string | null }>({ p1: null, p2: null });
  /** The clip the attacker was playing when the grab connected. */
  const throwDelivererRef = useRef<{ p1: string | null; p2: string | null }>({ p1: null, p2: null });

  const playOpponentHalf = useCallback((victim: 'p1' | 'p2', deliverer: string | null) => {
    if (!deliverer) return;
    const pick = receiverClipFor(deliverer, { available: (c) => bakedClipNames().has(c) });
    if (!pick) return;
    if (grappleBeatTimer.current !== null) window.clearTimeout(grappleBeatTimer.current);
    grappleBeatRef.current = { victim, clip: pick.receiver, source: pick.source };
    setGrappleBeat({ victim, clip: pick.receiver, source: pick.source });
    console.log(
      `[Arena] 🤼 opponent half — ${deliverer} -> ${pick.receiver} (${pick.source}, ${pick.dur}s) on ${victim}`,
    );
    // Held for the clip's own length. A fixed timeout would cut a 2.5 s DDT
    // reaction short and leave a 0.5 s knee throw standing in a pose.
    grappleBeatTimer.current = window.setTimeout(
      () => { grappleBeatRef.current = null; setGrappleBeat(null); grappleBeatTimer.current = null; },
      Math.max(250, Math.round((pick.dur || 0.8) * 1000)),
    );
  }, []);

  useEffect(() => () => {
    if (grappleBeatTimer.current !== null) window.clearTimeout(grappleBeatTimer.current);
  }, []);
  const [ko, setKo] = useState(false);
  const [winner, setWinner] = useState<'p1' | 'p2' | 'draw' | null>(null);
  const [roundTimer, setRoundTimer] = useState(99);
  const [hitStopActive, setHitStopActive] = useState(false);
  const [arenaReady, setArenaReady] = useState(false);

  /**
   * WHEN THE PRE-FIGHT CINEMATIC IS ALLOWED TO START — null while the bodies
   * are still loading.
   *
   * Owner: "it seems like you deleted the intro scene camera pan thing where
   * it shows the fighters and stuff before the fight." The pan was never
   * deleted; it was running over an EMPTY ARENA. MEASURED in the shipped
   * build: at the intro frame the only thing in shot is FighterPlaceholder,
   * the grey wireframe box drawn while a GLB loads. The sweep card literally
   * reads "LOADING ARENA" and the sequence did not wait for the loading — a
   * multi-megabyte GLB takes seconds to parse and the whole cinematic is
   * 4.5 s, so the one shot that is supposed to show the fighters showed a
   * wireframe and a room.
   *
   * So the clock starts when the bodies are on screen, and every beat of the
   * sequence — camera, announcer, bell, control unlock — is measured from
   * there. Holding in 'sweep' is not a stall: that phase exists for this.
   */
  const [cinematicStart, setCinematicStart] = useState<number | null>(null);
  const bodiesUpRef = useRef<{ p1: boolean; p2: boolean }>({ p1: false, p2: false });

  /**
   * A CEILING, ALWAYS. A fighter whose model never arrives must not be able to
   * hold the match shut — a late body is a blemish, a bell that never rings is
   * unrecoverable. Past this the cinematic runs regardless.
   */
  const CINEMATIC_BODY_WAIT_CEILING_MS = 8000;

  const handleFighterReady = useCallback((player: 'p1' | 'p2') => {
    bodiesUpRef.current = { ...bodiesUpRef.current, [player]: true };
    if (bodiesUpRef.current.p1 && bodiesUpRef.current.p2) {
      setCinematicStart((t) => t ?? Date.now());
    }
  }, []);

  /**
   * THE INTRO PLAYING RIGHT NOW — one fighter at a time, a pose and a line.
   *
   * Owner: "sometimes the fighters do show, but they'll be frozen in T pose
   * or in A pose ... like statues ... I kind of want a cycle of taunts ...
   * like how Tekken does, and Mortal Kombat and Street Fighter ... one at a
   * time ... depending on the character relationship."
   *
   * The statue was two things at once: the bodies were still loading (see
   * cinematicStart), and even once loaded NOTHING drove them during the
   * cinematic — no clip was requested until the fight began, so the mixer sat
   * on the bind pose. Now the intro requests a real pose per fighter, so the
   * pan has something to pan across.
   */
  const [introBeat, setIntroBeat] = useState<IntroBeat | null>(null);
  const introBeatsRef = useRef<IntroBeat[]>([]);

  useEffect(() => {
    bodiesUpRef.current = { p1: false, p2: false };
    setCinematicStart(null);
    setIntroBeat(null);
    const ceiling = window.setTimeout(
      () => setCinematicStart((t) => t ?? Date.now()),
      CINEMATIC_BODY_WAIT_CEILING_MS,
    );
    return () => window.clearTimeout(ceiling);
  }, [p1Fighter.id, p2Fighter.id]);

  /**
   * Run the beats. Starts when the bodies are on screen, ends before the
   * bell — the whole sequence is sized to the sweep plus the intro so it can
   * never delay the match, and each beat clears itself so a fighter is only
   * ever posing during their own moment.
   */
  useEffect(() => {
    if (cinematicStart === null) return;
    const beats = preFightSequence(
      { id: p1Fighter.id, name: p1Fighter.name, factionAlignment: p1Fighter.factionAlignment, personality: p1Fighter.personality },
      { id: p2Fighter.id, name: p2Fighter.name, factionAlignment: p2Fighter.factionAlignment, personality: p2Fighter.personality },
    );
    introBeatsRef.current = beats;
    // Fit the sequence into the cinematic rather than extending it. The bell
    // is scheduled off the same constants and must not move.
    const budget = SWEEP_DURATION_MS + INTRO_DURATION_MS;
    const each = Math.max(600, Math.floor(budget / Math.max(1, beats.length)));
    const timers: number[] = [];
    beats.forEach((beat, i) => {
      timers.push(window.setTimeout(() => setIntroBeat(beat), i * each));
    });
    timers.push(window.setTimeout(() => setIntroBeat(null), beats.length * each));
    return () => { for (const t of timers) window.clearTimeout(t); };
  }, [cinematicStart, p1Fighter, p2Fighter]);

  // ── Post-match screen state ───────────────────────────────────────────────
  const [showPostMatch, setShowPostMatch] = useState(false);
  const [matchCondition, setMatchCondition] = useState<'KO' | 'TIMEOUT' | 'PERFECT'>('KO');
  const [roundResults, setRoundResults] = useState<RoundResult[]>([]);
  const roundStartTimeRef = useRef<number>(Date.now());

  // ── Knockdown event for dust VFX ─────────────────────────────────────────
  const [knockdownEvent, setKnockdownEvent] = useState<{ count: number; player: 'p1' | 'p2' } | undefined>(undefined);
  const knockdownEventCountRef = useRef(0);

  const koHandledRef = useRef(false);
  const roundStartedRef = useRef(false);

  const sfx = useSoundEffects();

  const [feedbackEvents, setFeedbackEvents] = useState<Array<{
    id: number; moveId: string; moveName: string; damage: number;
    isBlocked: boolean; isCounter: boolean; player: 'p1' | 'p2'; x: number; y: number;
  }>>([]);
  const feedbackIdRef = useRef(0);

  // ── Action state machines (one per fighter) ──────────────────────────────
  const p1SMRef = useRef<FighterStateMachine>(new FighterStateMachine());
  const p2SMRef = useRef<FighterStateMachine>(new FighterStateMachine());
  const p1HitboxRef = useRef<FrameDataHitboxSystem>(new FrameDataHitboxSystem());
  const p2HitboxRef = useRef<FrameDataHitboxSystem>(new FrameDataHitboxSystem());

  // ── Locomotion systems (one per fighter) ─────────────────────────────────
  /**
   * Motion-input buffers. Owned here because this is the only place that knows
   * BOTH the raw stick and each fighter's facing — and numpad notation is
   * defined relative to facing, which is what stops P2's command list coming
   * out mirrored.
   */
  /** Best-of-three bookkeeping. Every round decision lives in RoundSystem. */
  const roundStateRef = useRef<RoundState>(createRoundState());

  const p1CommandRef = useRef(createCommandBuffer());
  const p2CommandRef = useRef(createCommandBuffer());

  const p1LocoRef = useRef<LocomotionSystem>(new LocomotionSystem(-1.8, 0, 1));
  const p2LocoRef = useRef<LocomotionSystem>(new LocomotionSystem(1.8, 0, -1));

  /**
   * Tell both fighters where THIS stage's floor ends.
   *
   * LocomotionSystem is the thing that actually moves a body, and it used to
   * clamp to its own module constants (+/-4.5 x +/-2.0) on every stage. That is
   * why fighters walked through the ring ropes (boundaryX 3.8), off the crane
   * (3.0) and through the cage (4.0), while the Z clamp stopped them 1.8 units
   * SHORT of the ropes on the ring and the octagon.
   *
   * Called after every construction as well as on stage change: a missed call
   * means walking through walls again, and the cost of calling twice is nil.
   */
  const applyStageBounds = useCallback((id: StageId) => {
    const bounds = locomotionBoundsFromStage(resolveStageConfig(id));
    p1LocoRef.current.setBounds(bounds);
    p2LocoRef.current.setBounds(bounds);
  }, []);

  // A stage swap without a fresh match still has to move the walls.
  useEffect(() => { applyStageBounds(stageId as StageId); }, [stageId, applyStageBounds]);

  /**
   * Put both fighters back on their marks and replay the intro.
   *
   * Used for BOTH a rematch and a round transition — the only difference is
   * whether the score survives. Before this, the two round-result sites wrote
   * `round: 1` and went straight to the post-match screen, so a match was
   * always exactly one round.
   */
  const resetForRound = useCallback((clearScore: boolean) => {
    const engine = engineRef.current;
    if (!engine) return;
    setP1Health(p1Fighter.hp);
    setP2Health(p2Fighter.hp);
    setKo(false);
    setWinner(null);
    setRoundTimer(99);
    koHandledRef.current = false;
    roundStartedRef.current = false;
    if (clearScore) {
      roundStateRef.current = createRoundState();
      setRoundResults([]);
    }
    roundStartTimeRef.current = Date.now();
    setP1X(-1.8); setP2X(1.8);
    setP1Y(0); setP2Y(0);
    p1YRef.current = 0; p2YRef.current = 0;
    p1XRef.current = -1.8; p2XRef.current = 1.8;
    p1LocoRef.current = new LocomotionSystem(-1.8, 0, 1);
    p2LocoRef.current = new LocomotionSystem(1.8, 0, -1);
    applyStageBounds(stageId as StageId);
    p1SMRef.current = new FighterStateMachine();
    p2SMRef.current = new FighterStateMachine();
    p1SMRef.current.registerSpecialMoves(schwarzerblitzSpecials(moveSetForFighter(p1Fighter.id)));
    p2SMRef.current.registerSpecialMoves(schwarzerblitzSpecials(moveSetForFighter(p2Fighter.id)));
    p1SMRef.current.attachCommandBuffer(p1CommandRef.current);
    p2SMRef.current.attachCommandBuffer(p2CommandRef.current);
    p1HitboxRef.current.reset();
    p2HitboxRef.current.reset();
    const freshP1Combo = createComboState('p1');
    const freshP2Combo = createComboState('p2');
    p1ComboRef.current = freshP1Combo;
    p2ComboRef.current = freshP2Combo;
    setP1Combo(freshP1Combo);
    setP2Combo(freshP2Combo);
    // Re-arm the announcer so the NEXT round gets its own call.
    announcerFiredRef.current = { ...announcerFiredRef.current, round: false, fight: false, ko: false };
    setCinematicPhase('sweep');
    setArenaReady(false);
    window.setTimeout(() => setCinematicPhase('intro'), SWEEP_DURATION_MS);
    window.setTimeout(() => { setCinematicPhase('fight'); setArenaReady(true); }, SWEEP_DURATION_MS + INTRO_DURATION_MS);
  }, [applyStageBounds, p1Fighter.hp, p1Fighter.id, p2Fighter.hp, p2Fighter.id, stageId]);
  const p1StickRef = useRef(createTekkenStick());
  const p1JumpYRef = useRef(0);

  // ── Bone hitbox systems (populated by FighterMesh callbacks) ─────────────
  const p1BoneHitboxRef = useRef<BoneHitboxSystem | null>(null);
  const p2BoneHitboxRef = useRef<BoneHitboxSystem | null>(null);

  // ── Hit-stop state ────────────────────────────────────────────────────────
  const hitStopTimerRef = useRef<number>(0);
  const hitStopActiveRef = useRef<boolean>(false);

  // ── Momentum state (one per fighter) ────────────────────────────────────
  const [p1MomentumCharge, setP1MomentumCharge] = useState<MomentumChargeState>(createMomentumChargeState());
  const [p2MomentumCharge, setP2MomentumCharge] = useState<MomentumChargeState>(createMomentumChargeState());
  const p1MomentumChargeRef = useRef<MomentumChargeState>(createMomentumChargeState());
  const p2MomentumChargeRef = useRef<MomentumChargeState>(createMomentumChargeState());

  // ── Decoupled combat state (Night Sky Engine pattern) ────────────────────
  const combatStateRef = useRef<CombatMatchState>(
    createCombatMatchState(p1Fighter.hp, p2Fighter.hp)
  );

  // ── Arena combat state — wiped and rebuilt on every stage load ────────────
  const arenaCombatStateRef = useRef<ArenaCombatState>(createArenaCombatState(stageId));
  const [arenaState, setArenaState] = useState<ArenaCombatState>(() => createArenaCombatState(stageId));
  const [ringOutNotice, setRingOutNotice] = useState<{ player: 'p1' | 'p2'; count: number } | null>(null);
  const ringOutNoticeCountRef = useRef(0);
  const [floorBreakNotice, setFloorBreakNotice] = useState<{ player: 'p1' | 'p2'; level: string; count: number } | null>(null);
  const floorBreakNoticeCountRef = useRef(0);
  const [hazardNotice, setHazardNotice] = useState<string>('');

  // ── Stage Manager — multi-tier, train, ledge throws, wall breaks ──────────
  const stageManagerRef = useRef<StageManagerState>(
    createStageManagerState(stageId, p1Fighter.hp, p2Fighter.hp)
  );
  const [trainWarningActive, setTrainWarningActive] = useState(false);
  const [trainCrossing, setTrainCrossing] = useState(false);
  const [trainX, setTrainX] = useState(-20);
  const [p1OnTracks, setP1OnTracks] = useState(false);
  const [p2OnTracks, setP2OnTracks] = useState(false);
  const [p1VaultPrompt, setP1VaultPrompt] = useState(false);
  const [p2VaultPrompt, setP2VaultPrompt] = useState(false);
  const [floorBreakPhase, setFloorBreakPhase] = useState<string>('idle');
  const [debrisPositions, setDebrisPositions] = useState<Array<{ x: number; y: number; z: number }>>([]);
  const [ledgeThrowActive, setLedgeThrowActive] = useState(false);
  const [wallShatterLeft, setWallShatterLeft] = useState(false);
  const [wallShatterRight, setWallShatterRight] = useState(false);
  const [hazardBounceNotice, setHazardBounceNotice] = useState<string>('');

  /**
   * HOW LONG AN EVENT BANNER STAYS ON SCREEN.
   *
   * Owner: "ring out pops up on screen, and when you break through the
   * floor, it pops up ... give it a fade out timer so it actually goes away
   * because it gets stuck on the screen and covers up the whole fight."
   *
   * MEASURED IN THE CODE: `hazardBounceNotice` already cleared itself after
   * 1.5 s at both of its call sites. `ringOutNotice` and `floorBreakNotice`
   * are set at SIX call sites between them and cleared at NONE — the only
   * `setRingOutNotice(null)` in the file is the round reset. So a ring-out
   * banner sat over the middle of the fight until the round ended.
   *
   * Cleared HERE rather than at each call site on purpose: six setters is
   * six chances to forget, and a seventh is one more. One effect per notice
   * covers every site including any added later.
   */
  const NOTICE_DURATION_MS = 1800;
  /** The tail of that window spent fading, so it leaves rather than blinks. */
  const NOTICE_FADE_MS = 400;

  useEffect(() => {
    if (!ringOutNotice) return;
    const t = window.setTimeout(() => setRingOutNotice(null), NOTICE_DURATION_MS);
    return () => window.clearTimeout(t);
    // Keyed on count, not identity: a second ring-out restarts the clock.
  }, [ringOutNotice?.count]);

  useEffect(() => {
    if (!floorBreakNotice) return;
    const t = window.setTimeout(() => setFloorBreakNotice(null), NOTICE_DURATION_MS);
    return () => window.clearTimeout(t);
  }, [floorBreakNotice?.count]);
  const hazardBounceNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // P1 Y position for track detection (subway stage)
  const p1YRef = useRef(0);
  const p2YRef = useRef(0);

  // ── Announcer system ──────────────────────────────────────────────────────
  const announcerRef = useRef(getAnnouncerSystem({
    p1Name: p1Fighter.name,
    p2Name: p2Fighter.name,
    enabled: settings.soundEnabled,
  }));

  // Track announcer state to avoid double-firing
  const announcerFiredRef = useRef({
    getReady: false,
    round: false,
    fight: false,
    ko: false,
  });

  // ── Z-axis sidestep state ─────────────────────────────────────────────────
  const p1SidestepZRef = useRef(0);
  const p2SidestepZRef = useRef(0);

  // ── Special move notification state ──────────────────────────────────────
  const [specialMoveNotice, setSpecialMoveNotice] = useState<{
    name: string; player: 'p1' | 'p2'; id: number;
  } | null>(null);
  const specialNoticeIdRef = useRef(0);

  // ── Queued action display state (read from SM each frame) ─────────────────
  const [p1QueuedAction, setP1QueuedAction] = useState<{ type: string; label: string } | null>(null);
  const [p1RecoveryProgress, setP1RecoveryProgress] = useState(0);
  // ── Wakeup buffer display state ───────────────────────────────────────────
  const [p1WakeupBuffered, setP1WakeupBuffered] = useState<string | null>(null);

  // ── Combo system state ────────────────────────────────────────────────────
  const [p1Combo, setP1Combo] = useState<ComboState>(() => createComboState('p1'));
  const [p2Combo, setP2Combo] = useState<ComboState>(() => createComboState('p2'));
  const p1ComboRef = useRef<ComboState>(createComboState('p1'));
  const p2ComboRef = useRef<ComboState>(createComboState('p2'));

  // ── Debug overlay state ───────────────────────────────────────────────────
  const [p1DebugData, setP1DebugData] = useState<FighterDebugData | null>(null);
  const [p2DebugData, setP2DebugData] = useState<FighterDebugData | null>(null);
  const p1ImpactMarkersRef = useRef<ImpactMarker[]>([]);
  const p2ImpactMarkersRef = useRef<ImpactMarker[]>([]);
  const impactMarkerIdRef = useRef(0);

  // ── Animation trigger counters — increment on each new attack to force re-trigger ──
  const [p1AnimTrigger, setP1AnimTrigger] = useState(0);
  const [p2AnimTrigger, setP2AnimTrigger] = useState(0);
  const p1AnimTriggerRef = useRef(0);
  /** Reactions counted separately from attacks; together they make the trigger. */
  const p1ReactionCountRef = useRef(0);
  const p2ReactionCountRef = useRef(0);
  const p2AnimTriggerRef = useRef(0);
  const prevP1AnimRef = useRef<string>('idle');
  const prevP2AnimRef = useRef<string>('idle');

  // ── Locomotion velocity state — fed from FSM each frame for velocity-gated blending ──
  const [p1LocomotionVelocity, setP1LocomotionVelocity] = useState<{ forward: number; strafe: number }>({ forward: 0, strafe: 0 });
  const [p2LocomotionVelocity, setP2LocomotionVelocity] = useState<{ forward: number; strafe: number }>({ forward: 0, strafe: 0 });
  const p1VelRef = useRef<{ forward: number; strafe: number }>({ forward: 0, strafe: 0 });
  const p2VelRef = useRef<{ forward: number; strafe: number }>({ forward: 0, strafe: 0 });

  // ── Match recorder ────────────────────────────────────────────────────────
  const { startRecording, stopRecording, recordFrame, getBuffer, isRecording } = useMatchRecorder();
  const { user } = useAuth();

  // ── Cinematic phase state ─────────────────────────────────────────────────
  const [cinematicPhase, setCinematicPhase] = useState<CinematicPhase>('sweep');

  // ── Pause menu state ──────────────────────────────────────────────────────
  const [isPaused, setIsPaused] = useState(false);
  const [pauseTab, setPauseTab] = useState<'menu' | 'replay'>('menu');

  // ESC key toggles pause (only during fight phase, not during KO)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && cinematicPhase === 'fight' && !ko) {
        setIsPaused(p => !p);
        setPauseTab('menu');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cinematicPhase, ko]);

  // Pause/resume game loop via ref flag
  const isPausedRef = useRef(false);
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  // ── Position state (X and Z axes) ────────────────────────────────────────
  const [p1X, setP1X] = useState(-1.8);
  const [p1Y, setP1Y] = useState(0);
  const [p2X, setP2X] = useState(1.8);
  const [p2Y, setP2Y] = useState(0);
  const [p1Z, setP1Z] = useState(0);
  const [p2Z, setP2Z] = useState(0);
  const p1XRef = useRef(-1.8);
  const p2XRef = useRef(1.8);
  const p1ZRef = useRef(0);
  const p2ZRef = useRef(0);

  useEffect(() => {
    const held = new Set<string>();
    const apply = () => {
      const i = inputRef.current as any;
      i.left = held.has("KeyA") || held.has("ArrowLeft");
      i.right = held.has("KeyD") || held.has("ArrowRight");
      i.up = held.has("KeyW") || held.has("ArrowUp");
      i.down = held.has("KeyS") || held.has("ArrowDown");
      i.sidestepLeft = held.has("KeyQ");
      i.sidestepRight = held.has("KeyE");
    };
    window.__controlsTest = {
      getYaw: () => -p1XRef.current,
      getSpeed: () =>
        Math.abs(p1VelRef.current.forward) +
        Math.abs(p1VelRef.current.strafe) +
        Math.abs(p1XRef.current + 1.8) +
        Math.abs(p1ZRef.current),
      setKeys: (codes: string[]) => {
        held.clear();
        for (const c of codes) held.add(c);
        apply();
      },
    };
    return () => {
      delete window.__controlsTest;
    };
  }, []);

  // ── Damage event state ────────────────────────────────────────────────────
  const [damageEvent, setDamageEvent] = useState<{
    count: number; player: 'p1' | 'p2'; damage: number; isCounter: boolean; factionColor: string;
  } | undefined>(undefined);
  const damageEventCountRef = useRef(0);

  // ── Wall-splat event state ────────────────────────────────────────────────
  const [wallSplatEvent, setWallSplatEvent] = useState<{
    count: number; player: 'p1' | 'p2'; wall: 'left' | 'right';
  } | undefined>(undefined);
  const wallSplatEventCountRef = useRef(0);

  // ── Overdrive event state ────────────────────────────────────────────────
  const [overdriveEvent, setOverdriveEvent] = useState<{
    count: number; player: 'p1' | 'p2';
  } | undefined>(undefined);
  const overdriveEventCountRef = useRef(0);

  // ── Finisher event state ──────────────────────────────────────────────────
  const [finisherEvent, setFinisherEvent] = useState<{
    count: number; player: 'p1' | 'p2';
  } | undefined>(undefined);
  const finisherEventCountRef = useRef(0);

  // ── Camera shake offset from hit effect system ────────────────────────────
  const [cameraShakeOffset, setCameraShakeOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // ── Overdrive / super armor / Finisher HUD state ───────────────────────────────
  const [p1HeatActive, setP1HeatActive] = useState(false);
  const [p2HeatActive, setP2HeatActive] = useState(false);
  const [p1FinisherAvailable, setP1FinisherAvailable] = useState(false);
  const [p2FinisherAvailable, setP2FinisherAvailable] = useState(false);
  const [p1SuperArmorActive, setP1SuperArmorActive] = useState(false);
  const [p2SuperArmorActive, setP2SuperArmorActive] = useState(false);

  // ── Global Audio Manager ──────────────────────────────────────────────────
  const audioManagerRef = useRef(getGlobalAudioManager());

  // Build engine
  useEffect(() => {
    const p1MoveSet = getCharacterMoveSet(p1Fighter.id);
    const p2MoveSet = getCharacterMoveSet(p2Fighter.id);
    const engine = new GameEngine(p1Fighter, p2Fighter);
    if (p1MoveSet?.isCustomized) {
      const lightMove = getMoveById(p1MoveSet.lightAttack);
      const heavyMove = getMoveById(p1MoveSet.heavyAttack);
      if (lightMove) (engine as any)._p1LightOverride = lightMove;
      if (heavyMove) (engine as any)._p1HeavyOverride = heavyMove;
    }
    engineRef.current = engine;
    setP1Health(p1Fighter.hp);
    setP2Health(p2Fighter.hp);
    setFrame(0);
    setKo(false);
    setWinner(null);
    setRoundTimer(99);
    koHandledRef.current = false;
    roundStartedRef.current = false;
    setShowPostMatch(false);
    roundStartTimeRef.current = Date.now();
    setRoundResults([]);
    setP1Z(0); setP2Z(0);
    p1ZRef.current = 0; p2ZRef.current = 0;
    // Reset fighter positions
    setP1X(-1.8); setP2X(1.8);
    p1XRef.current = -1.8; p2XRef.current = 1.8;
    p1LocoRef.current = new LocomotionSystem(-1.8, 0, 1);
    p2LocoRef.current = new LocomotionSystem(1.8, 0, -1);
    applyStageBounds(stageId as StageId);

    // Reset state machines and hitbox systems for new match
    p1SMRef.current = new FighterStateMachine();
    p2SMRef.current = new FighterStateMachine();
    // The imported command list, plus the engine's own button specials
    // (registerSpecialMoves appends DEFAULT_SPECIAL_MOVES itself, so the
    // button sequences that already worked keep working).
    p1SMRef.current.registerSpecialMoves(schwarzerblitzSpecials(moveSetForFighter(p1Fighter.id)));
    p2SMRef.current.registerSpecialMoves(schwarzerblitzSpecials(moveSetForFighter(p2Fighter.id)));
    p1SMRef.current.attachCommandBuffer(p1CommandRef.current);
    p2SMRef.current.attachCommandBuffer(p2CommandRef.current);
    p1HitboxRef.current.reset();
    p2HitboxRef.current.reset();

    // Reset combo system
    const freshP1Combo = createComboState('p1');
    const freshP2Combo = createComboState('p2');
    p1ComboRef.current = freshP1Combo;
    p2ComboRef.current = freshP2Combo;
    setP1Combo(freshP1Combo);
    setP2Combo(freshP2Combo);

    // Reset impact markers
    p1ImpactMarkersRef.current = [];
    p2ImpactMarkersRef.current = [];

    // ── Wipe and rebuild arena combat state for this stage ─────────────────
    const freshArenaState = createArenaCombatState(stageId);
    arenaCombatStateRef.current = freshArenaState;
    setArenaState(freshArenaState);
    setRingOutNotice(null);
    setFloorBreakNotice(null);
    setHazardNotice(freshArenaState.config.hazardLabel);

    // ── Wipe and rebuild Stage Manager state ──────────────────────────────
    const freshStageManager = createStageManagerState(stageId, p1Fighter.hp, p2Fighter.hp);
    stageManagerRef.current = freshStageManager;
    setTrainWarningActive(false);
    setTrainCrossing(false);
    setTrainX(-20);
    setP1OnTracks(false);
    setP2OnTracks(false);
    setP1VaultPrompt(false);
    setP2VaultPrompt(false);
    setFloorBreakPhase('idle');
    setDebrisPositions([]);
    setLedgeThrowActive(false);
    setWallShatterLeft(false);
    setWallShatterRight(false);
    setHazardBounceNotice('');

    // ── Init Global Audio Manager ──────────────────────────────────────────
    const audioManager = audioManagerRef.current;
    audioManager.init({ enabled: settings.soundEnabled }).then(() => {
      // Play character select BGM during sweep/intro
      audioManager.playBGM('character_select', 800);
    });

    // ── Cinematic sequence: sweep → intro → fight ──────────────────────────────
    // HOLD IN 'sweep' UNTIL THE BODIES ARE ON SCREEN. See cinematicStart: the
    // pan used to run over an empty arena because nothing waited for the GLBs.
    setCinematicPhase('sweep');
    setArenaReady(false);
    if (cinematicStart === null) {
      return () => {
        cancelAnimationFrame(rafRef.current);
        stopRecording();
        audioManager.stopBGM(500);
      };
    }

    // Start recording when fight begins
    const tRecord = window.setTimeout(() => {
      startRecording();
    }, SWEEP_DURATION_MS + INTRO_DURATION_MS);

    const t1 = window.setTimeout(() => {
      setCinematicPhase('intro');
      // Preload combat audio during VS/intro screen
      audioManager.preloadCombatAudio(stageId);
    }, SWEEP_DURATION_MS);

    const t2 = window.setTimeout(() => {
      setCinematicPhase('fight');
      setArenaReady(true);
      // Crossfade to stage BGM — use stage config track key
      const stageCfg = resolveStageConfig(stageId);
      audioManager.playBGM(`stage_${stageCfg.bgmTrack}`, 1200);
    }, SWEEP_DURATION_MS + INTRO_DURATION_MS);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(tRecord);
      stopRecording();
      audioManager.stopBGM(500);
    };
  }, [p1Fighter, p2Fighter, cinematicStart]);

  // Round start bell
  useEffect(() => {
    if (cinematicStart === null) return;
    if (roundStartedRef.current) return;
    roundStartedRef.current = true;
    const t = window.setTimeout(() => {
      if (settings.soundEnabled) sfx.playRoundStart();
    }, SWEEP_DURATION_MS + INTRO_DURATION_MS + 300);
    return () => window.clearTimeout(t);
  }, [sfx, settings.soundEnabled, cinematicStart]);

  // ── Announcer: fire "Get Ready" on mount, "Round X" on intro, "Fight!" on fight ──
  useEffect(() => {
    if (cinematicStart === null) return;
    const announcer = announcerRef.current;
    announcer.updateConfig({ enabled: settings.soundEnabled, p1Name: p1Fighter.name, p2Name: p2Fighter.name });

    // Reset fired flags on new match
    announcerFiredRef.current = { getReady: false, round: false, fight: false, ko: false };

    // "Get ready for the next battle." — fires immediately on VS/loading screen
    const tGetReady = window.setTimeout(() => {
      if (!announcerFiredRef.current.getReady) {
        announcerFiredRef.current.getReady = true;
        announcer.fire('getReady');
      }
    }, 200);

    // The round it is ACTUALLY on. This fired 'round1' literally, so every
    // round of every match announced as Round 1 — and round2, round3 and
    // finalRound had no callers at all.
    const tRound = window.setTimeout(() => {
      if (!announcerFiredRef.current.round) {
        announcerFiredRef.current.round = true;
        const line = openingAnnouncement(roundStateRef.current);
        if (line) announcer.fire(line);
      }
    }, SWEEP_DURATION_MS + 300);

    // "Fight!" — fires when player control is unlocked
    const tFight = window.setTimeout(() => {
      if (!announcerFiredRef.current.fight) {
        announcerFiredRef.current.fight = true;
        announcer.fire('fight');
      }
    }, SWEEP_DURATION_MS + INTRO_DURATION_MS + 600);

    return () => {
      window.clearTimeout(tGetReady);
      window.clearTimeout(tRound);
      window.clearTimeout(tFight);
    };
  }, [p1Fighter, p2Fighter, settings.soundEnabled, cinematicStart]);

  const prevP1StateRef = useRef<string>('Neutral');
  const prevP2StateRef = useRef<string>('Neutral');
  const prevP1HealthRef = useRef<number>(p1Fighter.hp);
  const prevP2HealthRef = useRef<number>(p2Fighter.hp);

  const p1Color = FACTION_COLOR[p1Fighter.factionAlignment] ?? '#facc15';
  const p2Color = FACTION_COLOR[p2Fighter.factionAlignment] ?? '#facc15';

  // ── Grab range visualization state ───────────────────────────────────────
  const [p1GrabRangeVisible, setP1GrabRangeVisible] = useState(false);
  const [p1GrabRangeRadius, setP1GrabRangeRadius] = useState(1.4);
  const [p1GrabRangeHit, setP1GrabRangeHit] = useState(false);

  // Game loop — only runs during 'fight' phase
  useEffect(() => {
    if (cinematicPhase !== 'fight') return;
    let lastTime = 0;
    const FRAME_MS = 1000 / 60;

    const loop = (now: number) => {
      rafRef.current = requestAnimationFrame(loop);
      const engine = engineRef.current;
      if (!engine) return;
      if (now - lastTime < FRAME_MS - 1) return;
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      const prevP1Health = prevP1HealthRef.current;
      const prevP2Health = prevP2HealthRef.current;
      const prevP1State = prevP1StateRef.current;
      const prevP2State = prevP2StateRef.current;

      // ── Build SM input from bitmask ────────────────────────────────────
      const bitmask = inputRef.current;
      const cmd = p1StickRef.current.resolve(
        {
          left: !!bitmask.left,
          right: !!bitmask.right,
          up: !!bitmask.up,
          down: !!bitmask.down,
          sidestepLeft: !!(bitmask as any).sidestepLeft,
          sidestepRight: !!(bitmask as any).sidestepRight,
        },
        now,
      );
      const smInput: SMInput = {
        forward: cmd.forward,
        strafe: cmd.strafe,
        light: bitmask.light ?? false,
        heavy: bitmask.heavy ?? false,
        guard: bitmask.guard ?? false,
        crouch: cmd.crouch,
        grapple: bitmask.grapple ?? false,
        escape: bitmask.escape ?? false,
        lp: (bitmask as any).lp ?? false,
        rp: (bitmask as any).rp ?? false,
        lk: (bitmask as any).lk ?? false,
        rk: (bitmask as any).rk ?? false,
        overdrive: (bitmask as any).overdrive ?? false,
        finisher: (bitmask as any).finisher ?? false,
        leftThrow: (bitmask as any).leftThrow ?? false,
        rightThrow: (bitmask as any).rightThrow ?? false,
        jump: cmd.jump,
        dashing: cmd.dashing,
        backdashing: cmd.backdashing,
        running: cmd.running,
      };
      if (!smInput.strafe) {
        if ((bitmask as any).sidestepBg) smInput.strafe = -1;
        else if ((bitmask as any).sidestepFg) smInput.strafe = 1;
      }

      // ── Feed the motion-command buffer ────────────────────────────────
      // WORLD-AXIS stick in, facing-relative numpad out. The buffer records
      // EDGES, so holding forward does not flood it and turn a held direction
      // into a dash the player never asked for.
      // Facing is READ from where the two fighters stand, never written here:
      // P1 faces +X while he is left of P2. V7OrientationContract remains the
      // only authority on the actual yaw; this just tells the matcher which way
      // "forward" points so 6 means toward the opponent.
      const p1Facing: Facing = p1XRef.current <= p2XRef.current ? 1 : -1;
      pushInput(
        p1CommandRef.current,
        {
          x: bitmask.right ? 1 : bitmask.left ? -1 : 0,
          y: bitmask.up ? 1 : bitmask.down ? -1 : 0,
        },
        commandButtonsFor({
          lp: smInput.lp, rp: smInput.rp, lk: smInput.lk, rk: smInput.rk,
          grapple: smInput.grapple,
        }),
        p1Facing,
        now,
      );
      p1SMRef.current.setCommandStance(smInput.crouch ? 'Crouch' : cmd.running ? 'Running' : cmd.jump ? 'Air' : 'Ground');

      // ── Momentum detection (1+2+3+4 = all four limbs) ────────────────
      const p1MomentumInput = {
        lp: smInput.lp, rp: smInput.rp, lk: smInput.lk, rk: smInput.rk,
      };
      const prevP1MomentumActive = p1MomentumChargeRef.current.active;
      const newP1MomentumCharge = tickMomentumCharge(
        p1MomentumChargeRef.current,
        p1MomentumInput,
        false, // attackLanded resolved below
        dt,
      );
      if (!prevP1MomentumActive && newP1MomentumCharge.active) {
        // Just activated Momentum — fire announcer
        announcerRef.current.fire('momentumCharge');
        setSpecialMoveNotice({ name: 'MOMENTUM!', player: 'p1', id: ++specialNoticeIdRef.current });
        setTimeout(() => setSpecialMoveNotice(null), 2000);
        console.log('[Arena] ⚡ P1 Momentum activated');
      }
      p1MomentumChargeRef.current = newP1MomentumCharge;
      setP1MomentumCharge({ ...newP1MomentumCharge });

      // ── Tick decoupled combat state (Night Sky Engine pattern) ─────────
      combatStateRef.current = tickCombatState(
        combatStateRef.current,
        p1MomentumInput,
        {},
        dt,
        // The stage's REAL barrier. Without this the wall splat fired at the
        // module default of +/-4.5 on every stage — wrong on 9 of 15, and an
        // invisible wall in the three open-street stages.
        wallBoundsFromStage(stageManagerRef.current.config),
      );

      // ── Tick arena combat state (stage boundaries, ring-out, floor-break, hazard) ──
      const p1X = p1XRef.current;
      const p2X = p2XRef.current;
      const prevArena = arenaCombatStateRef.current;
      const newArena = tickArenaState(
        prevArena,
        p1X,
        p2X,
        0, // hit damage passed per-hit below
        0,
        false,
        false,
      );
      arenaCombatStateRef.current = newArena;

      // Ring-out KO detection
      if (newArena.p1RingOut && !prevArena.p1RingOut) {
        setRingOutNotice({ player: 'p1', count: ++ringOutNoticeCountRef.current });
        // Treat ring-out as instant KO for P1
        setP1Health(0);
      }
      if (newArena.p2RingOut && !prevArena.p2RingOut) {
        setRingOutNotice({ player: 'p2', count: ++ringOutNoticeCountRef.current });
        setP2Health(0);
      }

      // Floor-break notification
      if (newArena.p1FloorBreakPending && !prevArena.p1FloorBreakPending) {
        const lvl = newArena.config.levels[newArena.p1LevelIndex];
        setFloorBreakNotice({ player: 'p1', level: lvl?.label ?? 'LOWER LEVEL', count: ++floorBreakNoticeCountRef.current });
        arenaCombatStateRef.current = { ...newArena, p1FloorBreakPending: false };
      }
      if (newArena.p2FloorBreakPending && !prevArena.p2FloorBreakPending) {
        const lvl = newArena.config.levels[newArena.p2LevelIndex];
        setFloorBreakNotice({ player: 'p2', level: lvl?.label ?? 'LOWER LEVEL', count: ++floorBreakNoticeCountRef.current });
        arenaCombatStateRef.current = { ...newArena, p2FloorBreakPending: false };
      }

      // Hazard damage (applied per second)
      if (newArena.p1InHazard) {
        const hazardDmg = newArena.config.levels[newArena.p1LevelIndex]?.hazardDamagePerSec ?? 0;
        if (hazardDmg > 0) {
          setP1Health(h => Math.max(0, h - hazardDmg * dt));
        }
      }
      if (newArena.p2InHazard) {
        const hazardDmg = newArena.config.levels[newArena.p2LevelIndex]?.hazardDamagePerSec ?? 0;
        if (hazardDmg > 0) {
          setP2Health(h => Math.max(0, h - hazardDmg * dt));
        }
      }

      // ── Stage Manager tick — train hazard, floor break, ledge throw, wall breaks ──
      const sm = stageManagerRef.current;
      const stageCfg = sm.config;

      // ── Train hazard tick (Subway stage — MDickie-style independent RNG) ──
      if (sm.trainHazard.enabled) {
        const p1InputUp = (inputRef.current as any).up ?? false;
        const trainResult = tickTrainHazard(
          sm.trainHazard,
          dt,
          p1YRef.current,
          p2YRef.current,
          p1InputUp,
          false, // P2 AI vault handled below
        );
        stageManagerRef.current = { ...sm, trainHazard: trainResult.state };

        // Sync HUD state
        setTrainWarningActive(trainResult.state.warningActive);
        setTrainCrossing(trainResult.state.trainCrossing);
        setTrainX(trainResult.state.trainX);
        setP1OnTracks(trainResult.state.p1OnTracks);
        setP2OnTracks(trainResult.state.p2OnTracks);
        setP1VaultPrompt(trainResult.state.p1OnTracks && !trainResult.state.p1VaultActive);
        setP2VaultPrompt(trainResult.state.p2OnTracks && !trainResult.state.p2VaultActive);

        // Fire warning audio/visual
        if (trainResult.fireWarning) {
          audioManagerRef.current.playSFX('train_horn');
          console.log('[Train] 🚇 WARNING — train incoming in 2 seconds!');
        }

        // Train hit — apply massive unblockable damage
        if (trainResult.p1TrainHit) {
          const trainDmg = Math.round(p1Fighter.hp * TRAIN_HIT_DAMAGE);
          setP1Health(h => Math.max(0, h - trainDmg));
          audioManagerRef.current.playSFX('heavy_hit');
          audioManagerRef.current.playVOX('pain_grunt');
          setDamageEvent({
            count: ++damageEventCountRef.current,
            player: 'p1',
            damage: trainDmg,
            isCounter: false,
            factionColor: '#f59e0b',
          });
          // Force P1 back to platform
          p1YRef.current = TRAIN_PLATFORM_Y;
          p1SMRef.current.applyKnockdown();
          console.log('[Train] 🚇 P1 HIT BY TRAIN — damage:', trainDmg);
        }
        if (trainResult.p2TrainHit) {
          const trainDmg = Math.round(p2Fighter.hp * TRAIN_HIT_DAMAGE);
          setP2Health(h => Math.max(0, h - trainDmg));
          audioManagerRef.current.playSFX('heavy_hit');
          audioManagerRef.current.playVOX('pain_grunt');
          setDamageEvent({
            count: ++damageEventCountRef.current,
            player: 'p2',
            damage: trainDmg,
            isCounter: false,
            factionColor: '#f59e0b',
          });
          p2YRef.current = TRAIN_PLATFORM_Y;
          p2SMRef.current.applyKnockdown();
          console.log('[Train] 🚇 P2 HIT BY TRAIN — damage:', trainDmg);
        }

        if (trainResult.crossingEnded) {
          console.log('[Train] 🚇 Train passed. Next crossing in', Math.round(trainResult.state.nextCrossingInterval), 's');
        }
      }

      // ── Floor break tick ──────────────────────────────────────────────────
      if (sm.floorBreak.phase !== 'idle') {
        const fbResult = tickFloorBreak(sm.floorBreak, dt);
        stageManagerRef.current = { ...stageManagerRef.current, floorBreak: fbResult.state };
        setFloorBreakPhase(fbResult.state.phase);
        setDebrisPositions(fbResult.state.debrisPositions.map(d => ({ x: d.x, y: d.y, z: d.z })));

        if (fbResult.applyLandingDamage && sm.floorBreak.triggerFighter) {
          const victim = sm.floorBreak.triggerFighter;
          const landDmg = fbResult.state.landingDamage;
          if (victim === 'p1') {
            setP1Health(h => Math.max(0, h - landDmg));
            setDamageEvent({ count: ++damageEventCountRef.current, player: 'p1', damage: landDmg, isCounter: false, factionColor: '#f97316' });
          } else {
            setP2Health(h => Math.max(0, h - landDmg));
            setDamageEvent({ count: ++damageEventCountRef.current, player: 'p2', damage: landDmg, isCounter: false, factionColor: '#f97316' });
          }
          audioManagerRef.current.playSFX('floor_slam');
          console.log('[FloorBreak] 💥 Landing damage applied to', victim, ':', landDmg);
        }

        if (fbResult.transitionComplete) {
          console.log('[FloorBreak] ✅ Stage transition complete — input restored');
        }
      }

      // ── Ledge throw tick ──────────────────────────────────────────────────
      if (sm.ledgeThrow.active) {
        const ltResult = tickLedgeThrow(sm.ledgeThrow);
        stageManagerRef.current = { ...stageManagerRef.current, ledgeThrow: ltResult.state };
        setLedgeThrowActive(ltResult.state.active);

        if (ltResult.koVictim) {
          // Ledge throw KO — instant ring-out
          if (ltResult.koVictim === 'p1') {
            setP1Health(0);
            setRingOutNotice({ player: 'p1', count: ++ringOutNoticeCountRef.current });
          } else {
            setP2Health(0);
            setRingOutNotice({ player: 'p2', count: ++ringOutNoticeCountRef.current });
          }
          audioManagerRef.current.playSFX('floor_slam');
          announcerRef.current.fire('ko');
          console.log('[LedgeThrow] 🎯 Ring-out KO:', ltResult.koVictim);
        }
      }

      // ── Destructible wall tick ────────────────────────────────────────────
      {
        const newWalls = tickDestructibleWalls(sm.destructibleWalls);
        stageManagerRef.current = { ...stageManagerRef.current, destructibleWalls: newWalls };
        setWallShatterLeft(newWalls.leftShatterActive);
        setWallShatterRight(newWalls.rightShatterActive);
      }

      // ── Hazard bounce tick ────────────────────────────────────────────────
      {
        const newBounce = tickHazardBounce(sm.hazardBounce);
        stageManagerRef.current = { ...stageManagerRef.current, hazardBounce: newBounce };

        // Apply bounce position correction — shove fighters back to center
        if (newBounce.p1BounceActive && newBounce.p1BounceFrames > 0) {
          const lerpSpeed = 0.15;
          const newX = p1XRef.current + (newBounce.p1TargetX - p1XRef.current) * lerpSpeed;
          p1XRef.current = newX;
          p1LocoRef.current.clampX(newX);
          setP1X(newX);
        }
        if (newBounce.p2BounceActive && newBounce.p2BounceFrames > 0) {
          const lerpSpeed = 0.15;
          const newX = p2XRef.current + (newBounce.p2TargetX - p2XRef.current) * lerpSpeed;
          p2XRef.current = newX;
          p2LocoRef.current.clampX(newX);
          setP2X(newX);
        }
      }

      // ── Proximity ledge-throw override check ──────────────────────────────
      // Before executing a standard throw, check if attacker is near the ring-out edge
      if (!sm.ledgeThrow.active && stageCfg.ringOutEnabled && isFinite(stageCfg.boundaryX)) {
        const throwInputDetected = (inputRef.current as any).grapple ?? false;
        if (throwInputDetected && p1SMRef.current.action === 'Idle') {
          const isLedgeOverride = checkLedgeThrowOverride(
            p1XRef.current, p2XRef.current,
            stageCfg.boundaryX, stageCfg.ringOutEnabled,
            stageCfg.edgeZoneDistance,
          );
          if (isLedgeOverride) {
            const ledgeState = executeLedgeThrow('p2');
            stageManagerRef.current = { ...stageManagerRef.current, ledgeThrow: ledgeState };
            setLedgeThrowActive(true);
            setSpecialMoveNotice({ name: 'LEDGE THROW!', player: 'p1', id: ++specialNoticeIdRef.current });
            setTimeout(() => setSpecialMoveNotice(null), 2000);
            audioManagerRef.current.playSFX('throw_connect');
            console.log('[LedgeThrow] 🎯 Ledge throw override activated!');
          }
        }
      }

      // ── Destructible wall break check ─────────────────────────────────────
      if (stageCfg.hasDestructibleWalls) {
        const smSnap = stageManagerRef.current;
        // Check if P2 was just knocked into a wall with high force
        const p2WallState = combatStateRef.current.p2.wallSplat;
        if (p2WallState.isSplatted && p2WallState.wall) {
          const knockbackForce = Math.abs(combatStateRef.current.p2.velocityX ?? 0) * 1000;
          if (checkWallBreak(knockbackForce, p2WallState.wall, smSnap.destructibleWalls, true)) {
            const newWalls = applyWallBreak(smSnap.destructibleWalls, p2WallState.wall);
            stageManagerRef.current = { ...stageManagerRef.current, destructibleWalls: newWalls };
            setSpecialMoveNotice({ name: 'WALL BREAK!', player: 'p1', id: ++specialNoticeIdRef.current });
            setTimeout(() => setSpecialMoveNotice(null), 2000);
            audioManagerRef.current.playSFX('wall_splat');
            console.log('[WallBreak] 💥 Wall broken:', p2WallState.wall);
          }
        }
        // Same for P1
        const p1WallState = combatStateRef.current.p1.wallSplat;
        if (p1WallState.isSplatted && p1WallState.wall) {
          const knockbackForce = Math.abs(combatStateRef.current.p1.velocityX ?? 0) * 1000;
          if (checkWallBreak(knockbackForce, p1WallState.wall, smSnap.destructibleWalls, true)) {
            const newWalls = applyWallBreak(smSnap.destructibleWalls, p1WallState.wall);
            stageManagerRef.current = { ...stageManagerRef.current, destructibleWalls: newWalls };
            setSpecialMoveNotice({ name: 'WALL BREAK!', player: 'p2', id: ++specialNoticeIdRef.current });
            setTimeout(() => setSpecialMoveNotice(null), 2000);
            audioManagerRef.current.playSFX('wall_splat');
          }
        }
      }

      // ── Crowd / fence hazard bounce check ─────────────────────────────────
      if (stageCfg.hazardVolume) {
        const smSnap = stageManagerRef.current;
        const hv = stageCfg.hazardVolume;
        const p1InKnockback = combatStateRef.current.p1.stun.isHitStun;
        const p2InKnockback = combatStateRef.current.p2.stun.isHitStun;

        if (!smSnap.hazardBounce.p1BounceActive && checkHazardVolume(p1XRef.current, hv.triggerX, p1InKnockback)) {
          const newBounce = applyHazardBounce(smSnap.hazardBounce, 'p1', p1XRef.current);
          stageManagerRef.current = { ...stageManagerRef.current, hazardBounce: newBounce };
          const chipDmg = Math.round(p1Fighter.hp * hv.chipDamage);
          setP1Health(h => Math.max(0, h - chipDmg));
          setHazardBounceNotice(hv.label);
          if (hazardBounceNoticeTimerRef.current) clearTimeout(hazardBounceNoticeTimerRef.current);
          hazardBounceNoticeTimerRef.current = setTimeout(() => setHazardBounceNotice(''), 1500);
          audioManagerRef.current.playSFX('wall_splat');
          console.log('[HazardBounce] 🔥 P1 bounced by hazard volume:', hv.label);
        }
        if (!smSnap.hazardBounce.p2BounceActive && checkHazardVolume(p2XRef.current, hv.triggerX, p2InKnockback)) {
          const newBounce = applyHazardBounce(smSnap.hazardBounce, 'p2', p2XRef.current);
          stageManagerRef.current = { ...stageManagerRef.current, hazardBounce: newBounce };
          const chipDmg = Math.round(p2Fighter.hp * hv.chipDamage);
          setP2Health(h => Math.max(0, h - chipDmg));
          setHazardBounceNotice(hv.label);
          if (hazardBounceNoticeTimerRef.current) clearTimeout(hazardBounceNoticeTimerRef.current);
          hazardBounceNoticeTimerRef.current = setTimeout(() => setHazardBounceNotice(''), 1500);
          audioManagerRef.current.playSFX('wall_splat');
          console.log('[HazardBounce] 🔥 P2 bounced by hazard volume:', hv.label);
        }
      }

      // ── Update finisher availability based on P1 HP ────────────────────
      const p1HpPct = prevP1HealthRef.current / p1Fighter.hp;
      p1SMRef.current.setFinisherAvailable(p1HpPct);

      // ── Update P1 state machine ────────────────────────────────────────
      const p1SM = p1SMRef.current;
      const p1Hb = p1HitboxRef.current;
      const prevP1Action = p1SM.action;

      // ADVANCE THE JUGGLE BEFORE THE STATE MACHINE READS ITS OWN STATE.
      // Landing hands off to applyKnockdown inside tickAirborne, so a body
      // that hits the mat this frame is already knocked down by the time
      // update() runs — rather than spending one frame standing.
      // ── A WAY TO TRIGGER A JUGGLE WITHOUT LANDING ONE ──────────────────
      //
      // Verifying the juggle end to end meant landing a SPECIAL, and the
      // only launcher in the move table is the special's hitbox. Driving
      // that through a headless harness cost four runs and never connected:
      // keyboard does nothing (this build is touch-first, the pad binds
      // pointer events) and the button sequence never came out. 77 state
      // machine events, 2 hits, 0 launches.
      //
      // So the chain gets an instrument instead of another guess.
      // `__BF_DEBUG.launch('p2')` exercises the real path — the same
      // applyReaction the hit code calls — so a test can prove FSM -> arc ->
      // renderer Y without fighting the input system. It is a debug hook in
      // a fighting game, not a security surface, and it is also the quickest
      // way for the owner to see a juggle on his own device.
      (window as unknown as { __BF_DEBUG?: Record<string, unknown> }).__BF_DEBUG = {
        launch: (who: 'p1' | 'p2' = 'p2') => {
          (who === 'p1' ? p1SMRef : p2SMRef).current?.applyReaction('Flight');
        },
        airborne: () => ({
          p1: { airborne: p1SMRef.current?.isAirborne, y: p1SMRef.current?.juggleHeight, hits: p1SMRef.current?.juggleHits },
          p2: { airborne: p2SMRef.current?.isAirborne, y: p2SMRef.current?.juggleHeight, hits: p2SMRef.current?.juggleHits },
        }),
        renderY: () => ({ p1: p1YRef.current, p2: p2YRef.current }),
        /**
         * WHERE THE BODIES ARE AND WHICH WAY THEY POINT.
         *
         * Owner, twice: "the sidestepping is not radial ... when they
         * sidestep they still do a straight sidestep. And the camera does
         * like a 45 degree tilt towards your character and pretty much
         * stops showing your opponent." Reading the code cannot settle
         * that — `targetedSidestepVelocity` computes a real tangent around
         * the opponent, so the PATH should already arc. What decides
         * whether it READS as radial is the path, the facing and the shot
         * together, so all three are reported here.
         */
        positions: () => ({
          // FACING IS DERIVED AND BINARY. There is no yaw state anywhere —
          // it is recomputed as +/-1 from who is left of whom, which is the
          // ORIENTATION LOCKED rule this codebase is built on. Reported as
          // it really is, because a body that can only face +X or -X cannot
          // turn to keep an orbiting opponent in front of it however
          // correct the sidestep PATH is.
          p1: {
            x: p1XRef.current, z: p1ZRef.current, y: p1YRef.current,
            facing: p1XRef.current <= p2XRef.current ? 1 : -1,
          },
          p2: {
            x: p2XRef.current, z: p2ZRef.current, y: p2YRef.current,
            facing: p2XRef.current <= p1XRef.current ? 1 : -1,
          },
          gap: Math.hypot(p2XRef.current - p1XRef.current, p2ZRef.current - p1ZRef.current),
        }),
        /**
         * ARE BOTH FIGHTERS ACTUALLY ON SCREEN?
         *
         * "Pretty much stops showing your opponent" is a claim about the
         * FRAME, so it has to be measured in the frame. Each body is
         * projected to normalised device coordinates: |x| and |y| under 1
         * is on screen, and anything past that is out of shot.
         */
        onScreen: () => {
          const THREE_NS = (window as unknown as { THREE?: typeof import('three') }).THREE;
          const cam = (window as unknown as { __BF_CAMERA?: { projectionMatrix: unknown } }).__BF_CAMERA;
          if (!THREE_NS || !cam) return null;
          const project = (x: number, z: number) =>
            new THREE_NS.Vector3(x, 1.0, z).project(cam as never);
          const a = project(p1XRef.current, p1ZRef.current);
          const b = project(p2XRef.current, p2ZRef.current);
          return {
            p1: { x: +a.x.toFixed(3), y: +a.y.toFixed(3), onScreen: Math.abs(a.x) <= 1 && Math.abs(a.y) <= 1 },
            p2: { x: +b.x.toFixed(3), y: +b.y.toFixed(3), onScreen: Math.abs(b.x) <= 1 && Math.abs(b.y) <= 1 },
          };
        },
        /**
         * COUNT WEBBED VERTICES ON THE BODIES ACTUALLY ON SCREEN.
         *
         * Every previous check ran runCharacterPipeline directly in a test
         * harness and reported clean. The owner says he still sees the
         * wrist-to-hip webbing, so the question is not whether the repair
         * works — it is whether the mesh being RENDERED went through it.
         * This walks the live scene.
         */
        skinBleed: () => {
          type Bone = { parent: unknown; name: string };
          const hops = (bones: Bone[]): number[][] => {
            const idx = new Map<unknown, number>();
            bones.forEach((b, i) => idx.set(b, i));
            const adj: number[][] = bones.map(() => []);
            bones.forEach((b, i) => {
              const par = b.parent;
              if (par && idx.has(par)) { const j = idx.get(par) as number; adj[i].push(j); adj[j].push(i); }
            });
            return bones.map((_, start) => {
              const d = new Array<number>(bones.length).fill(Infinity);
              d[start] = 0; const q = [start];
              for (let h = 0; h < q.length; h++) for (const n of adj[q[h]]) if (d[n] === Infinity) { d[n] = d[q[h]] + 1; q.push(n); }
              return d;
            });
          };
          const out: Array<Record<string, unknown>> = [];
          const seen = new Set<unknown>();
          type Walkable = { traverse?: (f: (o: unknown) => void) => void };
          const w = window as unknown as { __BF_SCENE?: Walkable; __scenes?: Walkable[] };
          const scene = w.__BF_SCENE ?? w.__scenes?.[w.__scenes.length - 1];
          if (!scene?.traverse) return { error: 'no scene published — start a match first' };
          scene?.traverse?.((raw: unknown) => {
            const o = raw as Record<string, unknown>;
            if (!o.isSkinnedMesh || seen.has(o.uuid)) return;
            seen.add(o.uuid);
            const sk = o.skeleton as { bones: Array<{ parent: unknown; name: string }> } | undefined;
            const geo = o.geometry as { attributes: Record<string, { count: number; getComponent: (i: number, k: number) => number }> };
            if (!sk?.bones?.length || !geo?.attributes?.skinIndex) return;
            const H = hops(sk.bones);
            let bleeding = 0;
            const worst: Record<string, number> = {};
            for (let v = 0; v < geo.attributes.skinIndex.count; v++) {
              const ix: number[] = []; const wt: number[] = [];
              for (let k = 0; k < 4; k++) {
                const w = geo.attributes.skinWeight.getComponent(v, k);
                if (w > 0.02) { ix.push(geo.attributes.skinIndex.getComponent(v, k)); wt.push(w); }
              }
              let mx = 0; let pair = '';
              for (let a = 0; a < ix.length; a++) for (let b = a + 1; b < ix.length; b++) {
                const d = H[ix[a]]?.[ix[b]];
                // UNREACHABLE IS THE WORST SPAN, NOT A PAIR TO SKIP.
                // This probe had the identical bug the repair had: it
                // ignored joints in different components, which is exactly
                // the case that drags a triangle from a hand to a stray
                // prop bone — the "stick through the torso" the owner
                // keeps seeing. Skipping it made this report 0 webbing on
                // models that visibly have it.
                const span = Number.isFinite(d) ? d : 99;
                if (span > mx) { mx = span; pair = `${sk.bones[ix[a]].name}~${sk.bones[ix[b]].name}`; }
              }
              if (mx > 4) { bleeding++; worst[pair] = (worst[pair] ?? 0) + 1; }
            }
            out.push({ name: o.name, verts: geo.attributes.skinIndex.count, bleeding,
              worst: Object.entries(worst).sort((a, b) => b[1] - a[1]).slice(0, 2) });
          });
          return out;
        },
        /** Attack starts vs the replay trigger the renderer is handed. */
        triggers: () => ({
          p1: { attackStarts: p1SMRef.current?.attackStarts ?? 0, trigger: p1AnimTriggerRef.current },
          p2: { attackStarts: p2SMRef.current?.attackStarts ?? 0, trigger: p2AnimTriggerRef.current },
        }),
        /**
         * WHAT EACH BODY IS REALLY PLAYING, and the grapple half in flight.
         * Read from the resolver's own report, so a probe measures the clip
         * that is on screen rather than the one the state table implies.
         */
        clips: () => ({
          p1: liveClipRef.current.p1,
          p2: liveClipRef.current.p2,
          grappleBeat: grappleBeatRef.current,
          lastDeliverer: { ...throwDelivererRef.current },
        }),
        /** What each side's state machine says it is doing, for the stuck-pose probe. */
        states: () => ({
          p1: { action: p1SMRef.current?.action, motion: p1SMRef.current?.current, clip: p1SMRef.current?.activeClip() },
          p2: { action: p2SMRef.current?.action, motion: p2SMRef.current?.current, clip: p2SMRef.current?.activeClip() },
        }),
      };

      p1SM.tickAirborne(dt);
      const p1NextMotion = p1SM.update(smInput, dt);
      const p1HbWindow = p1SM.getHitboxWindow();
      p1Hb.update(p1HbWindow);

      // ── Command throw grab range detection ────────────────────────────
      if (p1SM.action === 'CommandThrow' && prevP1Action !== 'CommandThrow') {
        // Just entered command throw — check grab range
        const grabResult = p1SM.checkGrabRange(p1XRef.current, p2XRef.current, p2SMRef.current.action);
        setP1GrabRangeVisible(true);
        setP1GrabRangeRadius(grabResult.grabRange);
        setP1GrabRangeHit(grabResult.throwSucceeded);
        p1SM.resolveCommandThrow(grabResult.throwSucceeded);
        if (grabResult.throwSucceeded) {
          // Do NOT apply damage here. The defender now owns a real reaction
          // window. P2's FSM consumes Escape during that window; only after it
          // expires does the arena commit the throw.
          p2SMRef.current.beginIncomingThrowBreak(0);
          // WHAT HE IS THROWING WITH, captured NOW. By the time the break
          // window closes the attacker may already be out of the throw, and
          // the victim's half has to match the throw that was performed.
          throwDelivererRef.current.p1 = liveClipRef.current.p1;
          console.log('[Arena] 🤲 Command throw connected — break window opened');
        }
        // Hide grab range visualization after 400ms
        setTimeout(() => setP1GrabRangeVisible(false), 400);
      }

      // Detect special move activation for notification
      if (p1SM.action === 'Attacking' && prevP1Action !== 'Attacking') {
        const move = p1HbWindow.move;
        if (move?.isSpecial && move.specialName) {
          setSpecialMoveNotice({
            name: move.specialName,
            player: 'p1',
            id: ++specialNoticeIdRef.current,
          });
          setTimeout(() => setSpecialMoveNotice(null), 1800);

          // ── Overdrive activation ─────────────────────────────────────
          if (move.specialName === 'Overdrive') {
            const audioMgrOverdrive = audioManagerRef.current;
            audioMgrOverdrive.playSFX('overdrive_activate');
            audioMgrOverdrive.playVOX('overdrive_yell');
            setOverdriveEvent({ count: ++overdriveEventCountRef.current, player: 'p1' });
            setP1HeatActive(true);
            // Overdrive expires after ~5 seconds
            setTimeout(() => setP1HeatActive(false), 5000);
          }

          // ── Finisher activation ───────────────────────────────────────
          if (move.specialName === 'Finisher') {
            const audioMgrRage = audioManagerRef.current;
            audioMgrRage.playSFX('finisher_move_activate');
            audioMgrRage.playVOX('finisher_move_yell');
            audioMgrRage.playAnnouncer('ki_charge'); // announcer reacts to Finisher
            setFinisherEvent({ count: ++finisherEventCountRef.current, player: 'p1' });
            setP1FinisherAvailable(false);
          }
        }
      }

      // ── Directional throw input detection ─────────────────────────────
      const throwInput = {
        lp: smInput.lp ?? false,
        rp: smInput.rp ?? false,
        lk: smInput.lk ?? false,
        rk: smInput.rk ?? false,
        forward: smInput.forward > 0,
        backward: smInput.forward < 0,
      };
      const detectedThrowId = detectThrowInput(throwInput);
      if (detectedThrowId && p1SM.action === 'Idle') {
        const inRange = checkThrowRange(p1XRef.current, p1ZRef.current, p2XRef.current, p2ZRef.current);
        if (inRange) {
          // Throw connects — apply damage and knockdown
          const throwDef = THROW_CATALOG[detectedThrowId];
          if (throwDef) {
            const throwDmg = getThrowDamage(detectedThrowId, false);
            p2SMRef.current.applyKnockdown();
            p2LocoRef.current.halt();
            audioManagerRef.current.playSFX('throw_connect');
            audioManagerRef.current.playVOX('attack_grunt');
            setDamageEvent({
              count: ++damageEventCountRef.current,
              player: 'p2',
              damage: throwDmg,
              isCounter: false,
              factionColor: p2Color,
            });
            setSpecialMoveNotice({ name: throwDef.name, player: 'p1', id: ++specialNoticeIdRef.current });
            setTimeout(() => setSpecialMoveNotice(null), 1500);
            setKnockdownEvent({ count: ++knockdownEventCountRef.current, player: 'p2' });
          }
        } else {
          // Throw whiffed — play whiff sound
          audioManagerRef.current.playSFX('whiff');
        }
      }

      // ── Update Finisher availability HUD ──────────────────────────────
      const p1HpPctForRage = prevP1HealthRef.current / p1Fighter.hp;
      const p2HpPctForRage = prevP2HealthRef.current / p2Fighter.hp;
      setP1FinisherAvailable(p1HpPctForRage <= 0.25);
      setP2FinisherAvailable(p2HpPctForRage <= 0.25);

      // ── Check P1 hitbox vs P2 ──────────────────────────────────────────
      const p2SM = p2SMRef.current;
      const prevP2Action = p2SM.action;
      const p2IsBlocking = p2SM.action === 'Guard' && !p2MomentumChargeRef.current.blockingDisabled;

      // ── Z-axis sidestep whiff check ────────────────────────────────────
      const p1AttackIsLinear = !(p1HbWindow.move?.isSpecial); // specials track
      const p1HitWhiffs = checkSidestepWhiff(p1ZRef.current, p2ZRef.current, !p1AttackIsLinear);

      const p1Hit = p1HitWhiffs ? null : p1Hb.checkCollision(
        p1XRef.current, p1ZRef.current, 1,
        p2XRef.current, p2ZRef.current,
        p2IsBlocking,
        p1HbWindow.currentFrame,
      );

      if (p1Hit) {
        // ── Momentum: apply counter-hit bonus and consume charge ─────────
        const p1MomentumActive = p1MomentumChargeRef.current.active;
        const isMomentumCounter = p1MomentumActive;
        if (p1MomentumActive) {
          // Consume the Momentum
          p1MomentumChargeRef.current = { ...p1MomentumChargeRef.current, active: false, framesRemaining: 0, nextAttackIsCounter: false, blockingDisabled: false };
          setP1MomentumCharge({ ...p1MomentumChargeRef.current });
        }

        // ── Guard system: check if P2 blocks, apply chip damage or full damage ──
        const p1HitMove = p1HbWindow.move;
        const guardResult = p1HitMove
          ? p2SMRef.current.processIncomingHit(p1HitMove)
          : { blocked: false, chipDamage: 0, guardBroken: false, finalDamage: p1Hit.damage };

        // Momentum chip damage on block
        let effectiveDamage = guardResult.blocked
          ? (p1MomentumActive
              ? Math.round(p1Hit.damage * p1MomentumChargeRef.current.chipDamageMultiplier)
              : guardResult.finalDamage)
          : p1Hit.damage;

        // Momentum counter-hit bonus
        if (p1MomentumActive && !guardResult.blocked) {
          effectiveDamage = applyMomentumChargeCounterHit(effectiveDamage);
        }

        // ── Combo system: register hit and apply damage scaling ──────────
        const { scaledDamage: p1ScaledDmg, newState: newP1Combo } = registerHit(
          p1ComboRef.current, effectiveDamage, now,
        );
        p1ComboRef.current = newP1Combo;
        setP1Combo({ ...newP1Combo });
        if (!guardResult.blocked) {
          // COMBO SCALING ON TOP OF THE EXISTING SCALING. registerHit already
          // scales a ground combo; this is the AIRBORNE scaling, which is a
          // separate rule and the one that stops a juggle being an infinite.
          // It is 1.0 for anyone standing, so nothing off the ground changes.
          const p1Air = p2SMRef.current.juggleDamageScale();
          engine.applyIncomingHit('p2', Math.max(1, Math.round(p1ScaledDmg * p1Air)), false, p1Hit.hitstun || 0.3);
        }

        // Apply the move's REACTION to P2 — launch, knockdown or stagger.
        //
        // This used to be one test, `launch > 0.3`, straight to
        // applyKnockdown: the hardest hits in the game put people flat on
        // the mat, so a juggle was impossible. resolveHitReaction splits it
        // and prefers the move's own authored reaction when it has one.
        const p2WasAirborne = p2SMRef.current.isAirborne;
        const p2Reaction = resolveHitReaction(
          { launch: p1Hit.launch, reaction: (p1HbWindow.move as { reaction?: string } | undefined)?.reaction },
          p2WasAirborne,
        );
        const p2Effect = reactionFor(p2Reaction);
        const isCrumple = !guardResult.blocked && p2Effect.kind === 'smackdown' && !p2WasAirborne;
        if (!guardResult.blocked && p2Effect.kind === 'launch') {
          p2SMRef.current.applyReaction(p2Reaction);
          p2LocoRef.current.halt();
        } else if (isCrumple) {
          p2SMRef.current.applyKnockdown();
          p2LocoRef.current.halt();
          // Trigger dust VFX on knockdown
          setKnockdownEvent({ count: ++knockdownEventCountRef.current, player: 'p2' });

          // ── Floor-break: slam sends P2 crashing through to next level ──
          const slamDmg = p1Hit.damage ?? 0;
          const prevArenaSnap = arenaCombatStateRef.current;
          const afterSlam = tickArenaState(prevArenaSnap, p1XRef.current, p2XRef.current, 0, slamDmg, false, true);
          arenaCombatStateRef.current = afterSlam;
          if (afterSlam.p2FloorBreakPending && !prevArenaSnap.p2FloorBreakPending) {
            const lvl = afterSlam.config.levels[afterSlam.p2LevelIndex];
            setFloorBreakNotice({ player: 'p2', level: lvl?.label ?? 'LOWER LEVEL', count: ++floorBreakNoticeCountRef.current });
            arenaCombatStateRef.current = { ...afterSlam, p2FloorBreakPending: false };
            audioManagerRef.current.playSFX('floor_slam');
            // ── Trigger StageManager floor break transition ──────────────
            const fbState = triggerFloorBreak('p2', afterSlam.p2LevelIndex, slamDmg);
            stageManagerRef.current = { ...stageManagerRef.current, floorBreak: fbState };
            setFloorBreakPhase('floor_break_debris');
          }
        } else if (!guardResult.blocked) {
          p2SMRef.current.applyReaction(p2Reaction, p1HbWindow.move ?? null);
          // A body in the air is not pushed along the floor.
          if (!p2SMRef.current.isAirborne) p2LocoRef.current.applyPushback(p1Hit.pushback ?? 0.3);
        }
        if (guardResult.guardBroken) {
          p2SMRef.current.applyStun(p1Hit.hitstun || 0.3, false);
        }
        p2HitboxRef.current.reset();

        // ── Hit Stop: freeze both fighters' animations ────────────────────
        // Duration scales with attack weight (heavy = longer freeze)
        if (!guardResult.blocked) {
          const attackKey = p1HbWindow.move?.animation ?? 'lightAttack';
          const isHeavy = p1Hit.damage > 120 || p1HbWindow.move?.isSpecial;
          const stopMs = isHeavy
            ? (HIT_STOP_DURATIONS[attackKey] ?? HIT_STOP_DEFAULT_MS)
            : HIT_STOP_DURATIONS.lightAttack;
          hitStopTimerRef.current = stopMs / 1000;
          hitStopActiveRef.current = true;
          setHitStopActive(true);
          console.log(`[Arena] ❄️ Hit stop triggered: ${stopMs}ms for "${attackKey}"`);
        }

        const isBlocked = guardResult.blocked;
        const isCounter = prevP2State === FighterState.Startup || prevP2State === FighterState.Active;
        if (settings.soundEnabled) {
          if (isBlocked) sfx.playBlock();
          else if (isCounter) sfx.playCounter();
          else if (p1Hit.damage > 200) sfx.playHeavyHit();
          else sfx.playLightHit();
        }
        // ── Global Audio Manager SFX ──────────────────────────────────────
        const audioMgr = audioManagerRef.current;
        if (isBlocked) audioMgr.playSFX('block');
        else if (isCounter) { audioMgr.playSFX('counter_hit'); audioMgr.playVOX('pain_grunt'); }
        else if (p1Hit.damage > 200) { audioMgr.playSFX('heavy_hit'); audioMgr.playVOX('pain_grunt'); }
        else audioMgr.playSFX('light_hit');
        if (p1Hit.damage > 100 && !isBlocked) audioMgr.playVOX('attack_grunt');

        // ── Wall-splat detection: check if P2 is in hit-stun near a wall ─
        const p2CombatState = combatStateRef.current.p2;
        if (p2CombatState.wallSplat.isSplatted && !p2CombatState.wallSplat.chainedDuringWindow) {
          const wall = p2CombatState.wallSplat.wall;
          if (wall) {
            setWallSplatEvent({ count: ++wallSplatEventCountRef.current, player: 'p2', wall });
            audioMgr.playSFX('wall_splat');
            setSpecialMoveNotice({ name: 'WALL SPLAT!', player: 'p1', id: ++specialNoticeIdRef.current });
            setTimeout(() => setSpecialMoveNotice(null), 1500);
          }
        }
        setDamageEvent({
          count: ++damageEventCountRef.current,
          player: 'p2',
          damage: p1ScaledDmg,
          isCounter,
          factionColor: p2Color,
        });
        setFeedbackEvents(prev => [...prev.slice(-6), {
          id: ++feedbackIdRef.current,
          moveId: p1HbWindow.move?.animation ?? 'hit',
          moveName: p1HbWindow.move?.specialName ?? (p1HbWindow.move?.animation === 'heavyAttack' ? 'Heavy' : 'Light'),
          damage: p1ScaledDmg,
          isBlocked,
          isCounter,
          player: 'p1',
          x: 65 + Math.random() * 10,
          y: 20 + Math.random() * 20,
        }]);

        // ── Debug: add impact marker for P1 hit ──────────────────────────
        if (debugSettings.enabled && debugSettings.showImpactMarkers) {
          const marker: ImpactMarker = {
            id: ++impactMarkerIdRef.current,
            x: 60 + Math.random() * 10,
            y: 25 + Math.random() * 30,
            frame: p1HbWindow.currentFrame,
            timestamp: now,
            damage: p1ScaledDmg,
            isBlocked,
          };
          p1ImpactMarkersRef.current = [...p1ImpactMarkersRef.current.slice(-4), marker];
        }
      }

      // ── Update P2 state machine (AI: simple reactive) ─────────────────
      // ── Commit or break the live command throw ────────────────────────
      // P1 armed this window before P2's update. This runs after P2 has had
      // the frame to press Escape, so a real break is possible in the match.
      const throwBreakOutcome = p2SMRef.current.consumeIncomingThrowBreakOutcome();
      if (throwBreakOutcome === 'broken') {
        p1SMRef.current.resolveCommandThrow(false);
        p2LocoRef.current.applyPushback(0.35);
        p2HitboxRef.current.reset();
        audioManagerRef.current.playSFX('throw_break');
        setSpecialMoveNotice({ name: 'THROW BREAK!', player: 'p2', id: ++specialNoticeIdRef.current });
        setTimeout(() => setSpecialMoveNotice(null), 900);
      } else if (throwBreakOutcome === 'committed') {
        const throwDmg = COMMAND_THROW_MOVE.damage ?? 220;
        p2SMRef.current.applyKnockdown();
        // THE OTHER MAN'S HALF. applyKnockdown still runs underneath, so the
        // physics, the damage and the wake-up are untouched — this only
        // decides what his body is seen doing while it happens.
        playOpponentHalf('p2', throwDelivererRef.current.p1);
        p2LocoRef.current.halt();
        p2HitboxRef.current.reset();
        console.log('[Arena] ✅ Command throw committed — damage:', throwDmg);
        engineRef.current?.applyIncomingHit('p2', throwDmg, false, 0.3);
        if (settings.soundEnabled) sfx.playHeavyHit();
        audioManagerRef.current.playSFX('throw_connect');
        setDamageEvent({
          count: ++damageEventCountRef.current,
          player: 'p2',
          damage: throwDmg,
          isCounter: false,
          factionColor: p2Color,
        });
        setFeedbackEvents(prev => [...prev.slice(-6), {
          id: ++feedbackIdRef.current,
          moveId: 'commandThrow',
          moveName: 'Command Throw',
          damage: throwDmg,
          isBlocked: false,
          isCounter: false,
          player: 'p1',
          x: 60 + Math.random() * 10,
          y: 20 + Math.random() * 20,
        }]);
      }

      // ── THE SAME THING, WITH THE PLAYER AS THE VICTIM ─────────────────
      // Armed by the AI's throw above. Escape breaks it exactly as it does
      // for the AI, and a committed throw puts the player through the
      // opponent's half of whatever the AI threw with.
      const p1ThrowBreakOutcome = p1SMRef.current.consumeIncomingThrowBreakOutcome();
      if (p1ThrowBreakOutcome === 'broken') {
        p2SMRef.current.resolveCommandThrow(false);
        p1LocoRef.current.applyPushback(0.35);
        p1HitboxRef.current.reset();
        audioManagerRef.current.playSFX('throw_break');
        setSpecialMoveNotice({ name: 'THROW BREAK!', player: 'p1', id: ++specialNoticeIdRef.current });
        setTimeout(() => setSpecialMoveNotice(null), 900);
      } else if (p1ThrowBreakOutcome === 'committed') {
        const throwDmg = COMMAND_THROW_MOVE.damage ?? 220;
        p1SMRef.current.applyKnockdown();
        p1LocoRef.current.halt();
        p1HitboxRef.current.reset();
        playOpponentHalf('p1', throwDelivererRef.current.p2);
        engineRef.current?.applyIncomingHit('p1', throwDmg, false, 0.3);
        if (settings.soundEnabled) sfx.playHeavyHit();
        audioManagerRef.current.playSFX('throw_connect');
        setDamageEvent({
          count: ++damageEventCountRef.current,
          player: 'p1',
          damage: throwDmg,
          isCounter: false,
          factionColor: p1Color,
        });
      }

      const p2Hb = p2HitboxRef.current;

      const p2AIInput: SMInput = buildP2AIInput(
        mapActionToDisplayState(p2SMRef.current.action, p2SMRef.current.current, engine.p2State),
        engine.p1Health, engine.p2Health, p2XRef.current, p1XRef.current,
        p2ZRef.current, p1ZRef.current, p2Fighter,
      );
      const p2Facing: Facing = p2XRef.current <= p1XRef.current ? 1 : -1;
      pushInput(
        p2CommandRef.current,
        { x: ((p2AIInput.forward ?? 0) > 0 ? p2Facing : (p2AIInput.forward ?? 0) < 0 ? -p2Facing : 0) as Facing, y: 0 },
        commandButtonsFor({
          lp: p2AIInput.lp ?? p2AIInput.light,
          rp: p2AIInput.rp ?? p2AIInput.heavy,
          lk: p2AIInput.lk,
          rk: p2AIInput.rk,
          grapple: p2AIInput.grapple,
        }),
        p2Facing, now,
      );
      p2SMRef.current.setCommandStance(p2AIInput.crouch ? 'Crouch' : p2AIInput.jump ? 'Air' : 'Ground');
      p2SM.tickAirborne(dt);
      const p2NextMotion = p2SM.update(p2AIInput, dt);
      const p2HbWindow = p2SM.getHitboxWindow();
      p2Hb.update(p2HbWindow);

      // ── THE AI'S THROW, WHICH HAD NEVER RESOLVED ──────────────────────
      //
      // TWO THINGS WERE MISSING AND EITHER ALONE WAS ENOUGH.
      //
      // The input side reads `p2AIInput.grapple` and passes it to the command
      // buffer — but `buildP2AIInput` NEVER SET IT, on any branch, so the AI
      // had no way to ask for a throw in the first place (fixed there, in the
      // close-range cycle). And on this side `p1SM.action === 'CommandThrow'`
      // was the ONLY occurrence in the file: nothing ever checked the AI's
      // grab range, called `resolveCommandThrow`, opened a break window or
      // dealt the damage. So the player could not be thrown by anybody.
      //
      // Owner: the opponent side has to be "wired up all areas wise." A
      // grapple only the player can perform is half a system.
      if (p2SM.action === 'CommandThrow' && prevP2Action !== 'CommandThrow') {
        const grabResult = p2SM.checkGrabRange(p2XRef.current, p1XRef.current, p1SMRef.current.action);
        p2SM.resolveCommandThrow(grabResult.throwSucceeded);
        if (grabResult.throwSucceeded) {
          p1SMRef.current.beginIncomingThrowBreak(0);
          throwDelivererRef.current.p2 = liveClipRef.current.p2;
          console.log('[Arena] 🤲 AI command throw connected — break window opened');
        }
      }

      // ── Check P2 hitbox vs P1 ──────────────────────────────────────────
      const p1IsBlocking = p1SM.action === 'Guard';
      const p2Hit = p2Hb.checkCollision(
        p2XRef.current, p2ZRef.current, -1,
        p1XRef.current, p1ZRef.current,
        p1IsBlocking,
        p2HbWindow.currentFrame,
      );

      if (p2Hit) {
        // ── Guard system: check if P1 blocks, apply chip damage or full damage ──
        const p2HitMove = p2HbWindow.move;
        const p1GuardResult = p2HitMove
          ? p1SMRef.current.processIncomingHit(p2HitMove)
          : { blocked: false, chipDamage: 0, guardBroken: false, finalDamage: p2Hit.damage };

        const p1EffectiveDamage = p1GuardResult.blocked ? p1GuardResult.finalDamage : p2Hit.damage;

        // ── Combo system: register hit and apply damage scaling ──────────
        const { scaledDamage: p2ScaledDmg, newState: newP2Combo } = registerHit(
          p2ComboRef.current, p1EffectiveDamage, now,
        );
        p2ComboRef.current = newP2Combo;
        setP2Combo({ ...newP2Combo });
        if (!p1GuardResult.blocked) {
          engine.applyIncomingHit('p1', Math.max(1, Math.round(p2ScaledDmg * p1SMRef.current.juggleDamageScale())), false, p2Hit.hitstun || 0.3);
        }

        const isCrumple = !p1GuardResult.blocked && p2Hit.launch > 0.3;
        if (isCrumple) {
          p1SMRef.current.applyKnockdown();
          p1LocoRef.current.halt();
          // Trigger dust VFX on knockdown
          setKnockdownEvent({ count: ++knockdownEventCountRef.current, player: 'p1' });

          // ── Floor-break: slam sends P1 crashing through to next level ──
          const slamDmg = p2Hit.damage ?? 0;
          const prevArenaSnap = arenaCombatStateRef.current;
          const afterSlam = tickArenaState(prevArenaSnap, p1XRef.current, p2XRef.current, slamDmg, 0, true, false);
          arenaCombatStateRef.current = afterSlam;
          if (afterSlam.p1FloorBreakPending && !prevArenaSnap.p1FloorBreakPending) {
            const lvl = afterSlam.config.levels[afterSlam.p1LevelIndex];
            setFloorBreakNotice({ player: 'p1', level: lvl?.label ?? 'LOWER LEVEL', count: ++floorBreakNoticeCountRef.current });
            arenaCombatStateRef.current = { ...afterSlam, p1FloorBreakPending: false };
            audioManagerRef.current.playSFX('floor_slam');
            // ── Trigger StageManager floor break transition ──────────────
            const fbState = triggerFloorBreak('p1', afterSlam.p1LevelIndex, slamDmg);
            stageManagerRef.current = { ...stageManagerRef.current, floorBreak: fbState };
            setFloorBreakPhase('floor_break_debris');
          }
        } else if (!p1GuardResult.blocked) {
          p1SMRef.current.applyReaction(
            resolveHitReaction(
              { launch: p2Hit.launch, reaction: (p2HbWindow.move as { reaction?: string } | undefined)?.reaction },
              p1SMRef.current.isAirborne,
            ),
            p2HbWindow.move ?? null,
          );
          p1LocoRef.current.applyPushback(p2Hit.pushback ?? 0.3);
        }
        if (p1GuardResult.guardBroken) {
          p1SMRef.current.applyStun(p2Hit.hitstun || 0.3, false);
        }
        p1HitboxRef.current.reset();

        // ── Hit Stop for P2 attacks ───────────────────────────────────────
        if (!p1GuardResult.blocked) {
          const attackKey = p2HbWindow.move?.animation ?? 'lightAttack';
          const isHeavy = p2Hit.damage > 120 || p2HbWindow.move?.isSpecial;
          const stopMs = isHeavy
            ? (HIT_STOP_DURATIONS[attackKey] ?? HIT_STOP_DEFAULT_MS)
            : HIT_STOP_DURATIONS.lightAttack;
          hitStopTimerRef.current = stopMs / 1000;
          hitStopActiveRef.current = true;
          setHitStopActive(true);
        }

        const isBlocked = p1GuardResult.blocked;
        const isCounter = prevP1State === FighterState.Startup || prevP1State === FighterState.Active;
        if (settings.soundEnabled) {
          if (isBlocked) sfx.playBlock();
          else if (isCounter) sfx.playCounter();
          else if (p2Hit.damage > 200) sfx.playHeavyHit();
          else sfx.playLightHit();
        }
        // ── Global Audio Manager SFX (P2 hits P1) ────────────────────────
        const audioMgr2 = audioManagerRef.current;
        if (isBlocked) audioMgr2.playSFX('block');
        else if (isCounter) { audioMgr2.playSFX('counter_hit'); audioMgr2.playVOX('pain_grunt'); }
        else if (p2Hit.damage > 200) { audioMgr2.playSFX('heavy_hit'); audioMgr2.playVOX('pain_grunt'); }
        else audioMgr2.playSFX('light_hit');
        if (p2Hit.damage > 100 && !isBlocked) audioMgr2.playVOX('attack_grunt');

        // ── Wall-splat detection for P1 ───────────────────────────────────
        const p1CombatState = combatStateRef.current.p1;
        if (p1CombatState.wallSplat.isSplatted && !p1CombatState.wallSplat.chainedDuringWindow) {
          const wall = p1CombatState.wallSplat.wall;
          if (wall) {
            setWallSplatEvent({ count: ++wallSplatEventCountRef.current, player: 'p1', wall });
            audioMgr2.playSFX('wall_splat');
          }
        }

        setDamageEvent({
          count: ++damageEventCountRef.current,
          player: 'p1',
          damage: p2ScaledDmg,
          isCounter,
          factionColor: p1Color,
        });
        setFeedbackEvents(prev => [...prev.slice(-6), {
          id: ++feedbackIdRef.current,
          moveId: p2HbWindow.move?.animation ?? 'hit',
          moveName: p2HbWindow.move?.specialName ?? (p2HbWindow.move?.animation === 'heavyAttack' ? 'Heavy' : 'Light'),
          damage: p2ScaledDmg,
          isBlocked,
          isCounter,
          player: 'p2',
          x: 25 + Math.random() * 10,
          y: 20 + Math.random() * 20,
        }]);

        // ── Debug: add impact marker for P2 hit ──────────────────────────
        if (debugSettings.enabled && debugSettings.showImpactMarkers) {
          const marker: ImpactMarker = {
            id: ++impactMarkerIdRef.current,
            x: 28 + Math.random() * 10,
            y: 25 + Math.random() * 30,
            frame: p2HbWindow.currentFrame,
            timestamp: now,
            damage: p2ScaledDmg,
            isBlocked,
          };
          p2ImpactMarkersRef.current = [...p2ImpactMarkersRef.current.slice(-4), marker];
        }
      }

      // ── Tick combo expiry ──────────────────────────────────────────────
      const { p1Combo: tickedP1, p2Combo: tickedP2 } = tickComboSystem(
        p1ComboRef.current, p2ComboRef.current, now,
      );
      if (tickedP1 !== p1ComboRef.current) {
        p1ComboRef.current = tickedP1;
        setP1Combo({ ...tickedP1 });
      }
      if (tickedP2 !== p2ComboRef.current) {
        p2ComboRef.current = tickedP2;
        setP2Combo({ ...tickedP2 });
      }

      // ── Update debug overlay data ──────────────────────────────────────
      if (debugSettings.enabled) {
        const p1Action = mapActionToDisplayState(p1SM.action, p1NextMotion, engine.state);
        const p2Action = mapActionToDisplayState(p2SM.action, p2NextMotion, engine.p2State);

        const p1Fw = computeFrameWindowData(p1HbWindow, p1SM.action);
        const p2Fw = computeFrameWindowData(p2HbWindow, p2SM.action);

        const p1Geom = p1Hb.geometry;
        const p2Geom = p2Hb.geometry;

        // ── Compute rig state for debug overlay ──────────────────────────
        const p1CrossfadeState = p1SM.getCrossfadeState();
        const p2CrossfadeState = p2SM.getCrossfadeState();

        // Compute clip duration from current move or default locomotion clip
        const p1ClipDuration = p1HbWindow.move
          ? (p1HbWindow.move.startup + p1HbWindow.move.active + p1HbWindow.move.recovery)
          : 1.0; // default locomotion clip ~1s
        const p2ClipDuration = p2HbWindow.move
          ? (p2HbWindow.move.startup + p2HbWindow.move.active + p2HbWindow.move.recovery)
          : 1.0;

        const p1RigState = computeRigState(
          p1NextMotion,
          p1HbWindow.move ? (p1ClipDuration - (p1HbWindow.move.startup + p1HbWindow.move.active + p1HbWindow.move.recovery - (p1HbWindow.currentFrame / 60))) : 0,
          p1ClipDuration,
          1.0,
          p1CrossfadeState.isCrossfading,
          p1CrossfadeState.progress,
        );

        const p2RigState = computeRigState(
          p2NextMotion,
          p2HbWindow.move ? (p2ClipDuration - (p2HbWindow.move.startup + p2HbWindow.move.active + p2HbWindow.move.recovery - (p2HbWindow.currentFrame / 60))) : 0,
          p2ClipDuration,
          1.0,
          p2CrossfadeState.isCrossfading,
          p2CrossfadeState.progress,
        );

        setP1DebugData({
          player: 'p1',
          frameWindow: p1Fw,
          aabb: p1Geom ? {
            centerX: p1XRef.current + p1Geom.offsetX,
            centerZ: p1ZRef.current + p1Geom.offsetZ,
            width: p1Geom.width,
            depth: p1Geom.depth,
            isActive: p1Hb.isActive,
          } : null,
          impactMarkers: p1ImpactMarkersRef.current,
          actionState: p1Action,
          rigState: p1RigState,
          hurtboxRegions: p1Hb.getHurtboxRegions(),
        });

        setP2DebugData({
          player: 'p2',
          frameWindow: p2Fw,
          aabb: p2Geom ? {
            centerX: p2XRef.current - p2Geom.offsetX,
            centerZ: p2ZRef.current + p2Geom.offsetZ,
            width: p2Geom.width,
            depth: p2Geom.depth,
            isActive: p2Hb.isActive,
          } : null,
          impactMarkers: p2ImpactMarkersRef.current,
          actionState: p2Action,
          rigState: p2RigState,
          hurtboxRegions: p2Hb.getHurtboxRegions(),
        });
      }

      // ── Tick legacy engine for health/state tracking ───────────────────
      engine.tick(inputRef.current);

      const p1Dmg = prevP1Health - engine.p1Health;
      const p2Dmg = prevP2Health - engine.p2Health;

      prevP1HealthRef.current = engine.p1Health;
      prevP2HealthRef.current = engine.p2Health;

      // ── Map SM action state → display state ───────────────────────────
      const p1DisplayState = mapActionToDisplayState(p1SM.action, p1NextMotion, engine.state);
      const p2DisplayState = mapActionToDisplayState(p2SM.action, p2NextMotion, engine.p2State);

      prevP1StateRef.current = p1DisplayState;
      prevP2StateRef.current = p2DisplayState;

      setFrame(engine.currentFrame);
      setP1Health(engine.p1Health);
      setP2Health(engine.p2Health);
      setP1State(p1DisplayState);
      setP2State(p2DisplayState);
      // A special plays the animation it was AUTHORED with. Without this every
      // imported move looks like the same generic heavy, which is most of what
      // "all the characters do the same thing" looked like on screen.
      setP1Animation(p1SMRef.current.activeClip() ?? p1NextMotion);
      setP2Animation(p2SMRef.current.activeClip() ?? p2NextMotion);
      setHitStopActive(engine.hitStopFrames > 0);

      // ── Record frame to match recorder ────────────────────────────────────
      recordFrame({
        timestamp: now,
        p1State: p1DisplayState,
        p2State: p2DisplayState,
        p1Animation: p1NextMotion,
        p2Animation: p2NextMotion,
        p1Health: engine.p1Health,
        p2Health: engine.p2Health,
        p1X: p1XRef.current,
        p2X: p2XRef.current,
        p1Z: p1ZRef.current,
        p2Z: p2ZRef.current,
        p1Input: {
          light: inputRef.current.light ?? false,
          heavy: inputRef.current.heavy ?? false,
          guard: inputRef.current.guard ?? false,
          left: inputRef.current.left ?? false,
          right: inputRef.current.right ?? false,
          up: inputRef.current.up ?? false,
          down: inputRef.current.down ?? false,
        },
        roundTimer,
      });

      // ── Tell the renderer to replay a clip ───────────────────────────────
      //
      // THIS USED TO COMPARE MOTION-STATE STRINGS and it could not see a
      // repeat. `nextMotion !== prevMotion` is false when you throw the same
      // attack twice, so the trigger never advanced, and FighterMesh — which
      // replays a clip only on a fresh trigger — silently dropped the second
      // attack while the mixer held the first one's clamped final frame.
      // That is the owner's "stuck in an end punch frame while I'm trying to
      // attack", and it is why 24 deliberate presses in the harness produced
      // 2 hits.
      //
      // An attack STARTING is a fact the state machine owns, so it counts
      // them and we read the count. No comparison, nothing to miss.
      // Reactions still need the string test: being hit twice in a row is
      // also a repeat, and the FSM has no equivalent counter for it.
      const REACTION_STATES = new Set(['hit', 'Hitstun', 'HitStun', 'knockdown', 'Knockdown', 'ko', 'KO', 'Crumple', 'WakeupTechRoll', 'WakeupBackrise', 'WakeupQuickStand', 'jump', 'jumpForward', 'jumpBack']);
      const p1Reaction = p1NextMotion !== prevP1AnimRef.current
        && (REACTION_STATES.has(p1NextMotion) || REACTION_STATES.has(prevP1AnimRef.current));
      const p2Reaction = p2NextMotion !== prevP2AnimRef.current
        && (REACTION_STATES.has(p2NextMotion) || REACTION_STATES.has(prevP2AnimRef.current));
      // TWO MONOTONIC COUNTERS ADDED, never a value folded back into itself:
      // the trigger must only ever go UP, or the renderer's
      // `trigger <= lastPlayed` test starts swallowing clips again.
      if (p1Reaction) p1ReactionCountRef.current += 1;
      if (p2Reaction) p2ReactionCountRef.current += 1;
      const p1Wanted = p1SM.attackStarts + p1ReactionCountRef.current;
      const p2Wanted = p2SM.attackStarts + p2ReactionCountRef.current;
      if (p1Wanted !== p1AnimTriggerRef.current) {
        p1AnimTriggerRef.current = p1Wanted;
        setP1AnimTrigger(p1Wanted);
      }
      if (p2Wanted !== p2AnimTriggerRef.current) {
        p2AnimTriggerRef.current = p2Wanted;
        setP2AnimTrigger(p2Wanted);
      }
      prevP1AnimRef.current = p1NextMotion;
      prevP2AnimRef.current = p2NextMotion;

      // ── Hit-stop countdown ────────────────────────────────────────────
      if (hitStopActiveRef.current) {
        hitStopTimerRef.current -= dt;
        if (hitStopTimerRef.current <= 0) {
          hitStopActiveRef.current = false;
          hitStopTimerRef.current = 0;
          setHitStopActive(false);
        }
      }

      // ── Locomotion system update ──────────────────────────────────────
      // Only update locomotion when not in hit-stop
      if (!hitStopActiveRef.current) {
        const p1Vel = p1SMRef.current.getWalkVelocity();
        const p2Vel = p2SMRef.current.getWalkVelocity();
        const p1IsDashing = cmd.dashing || cmd.running;
        const p1IsBackdashing = cmd.backdashing || p1SMRef.current.action === 'Backdashing';
        const p2IsBackdashing = p2SMRef.current.action === 'Backdashing';

        // Begin root motion for lunging attacks
        if (p1SMRef.current.action === 'Attacking' || p1SMRef.current.action === 'CommandThrow') {
          const attackKey = p1NextMotion;
          const profile = ATTACK_ROOT_MOTION_PROFILES[attackKey];
          if (profile?.hasRootMotion && p1LocoRef.current.mode === 'programmatic') {
            const move = p1HbWindow.move;
            p1LocoRef.current.beginRootMotionAttack(attackKey, move?.active ?? 0.14);
          }
        } else if (p1LocoRef.current.mode === 'rootMotion') {
          p1LocoRef.current.endRootMotionAttack();
        }

        if (cmd.jump) p1LocoRef.current.beginJump();
        else p1LocoRef.current.armJump();
        p1LocoRef.current.update(
          p1Vel.forward, p1Vel.strafe, dt, p1IsDashing, p1IsBackdashing,
          { x: p2XRef.current, z: p2ZRef.current },
        );
        if (p2AIInput.jump) p2LocoRef.current.beginJump();
        else p2LocoRef.current.armJump();
        p2LocoRef.current.update(
          p2Vel.forward, p2Vel.strafe, dt, false, p2IsBackdashing,
          { x: p1XRef.current, z: p1ZRef.current },
        );

        // ── Feed locomotion positions back to visual state ────────────────
        // Enforce minimum separation so fighters can't overlap
        // KEEPING THEM APART MUST NOT PUSH THEM APART.
        //
        // Owner: "you can't move forward and get close enough to your
        // opponent, you can't even hit them, and you can't move back
        // anymore."
        //
        // MEASURED holding forward in a live match: the gap closes 2.395 ->
        // 1.200 and then BOUNCES BACK to 1.435 on the next sample. This
        // clamp recentred BOTH fighters on their midpoint, so the instant
        // they touched the limit it teleported each of them half the
        // overlap outward — and with the AI walking in as well, both get
        // shoved every frame and the pair jitters instead of closing.
        // Walking into someone should stop you, not launch you both.
        //
        // The one who is CLOSING gives way. The other is not moved at all,
        // so there is nothing to bounce off and no shove to fight.
        const MIN_SEPARATION = 0.85;
        let newP1X = p1LocoRef.current.position.x;
        let newP2X = p2LocoRef.current.position.x;

        const overlap = MIN_SEPARATION - (newP2X - newP1X);
        if (overlap > 0) {
          // NOBODY IS MOVED AGAINST THEIR OWN INPUT.
          //
          // Stopping only "the one closing" was still wrong and the probe
          // caught it: with the AI walking in, P1 lost that contest and got
          // clamped BACKWARD while the player held forward — his x went
          // -1.59 -> -1.80 -> -1.71 -> -1.51 while pressing toward his
          // opponent. Being shoved backwards by your own advance is worse
          // than not closing.
          //
          // Each fighter only ever gives back the ground he took THIS
          // frame, in proportion to how much of the overlap he caused, and
          // never ends up behind where he started. Two fighters walking
          // into each other simply both stop.
          const p1Gained = Math.max(0, newP1X - p1XRef.current);
          const p2Gained = Math.max(0, p2XRef.current - newP2X);
          const caused = p1Gained + p2Gained;
          if (caused <= 1e-6) {
            // Neither moved in — they were already overlapping (a throw, a
            // spawn, a round reset). Ease apart rather than snapping.
            const ease = Math.min(overlap, 0.05);
            newP1X -= ease / 2;
            newP2X += ease / 2;
          } else {
            newP1X -= Math.min(p1Gained, (overlap * p1Gained) / caused);
            newP2X += Math.min(p2Gained, (overlap * p2Gained) / caused);
          }
          p1LocoRef.current.clampX(newP1X);
          p2LocoRef.current.clampX(newP2X);
          // READ THE CLAMP BACK. These two lines fixed the locomotion
          // system's own rootX and the arena then carried on using the
          // UNCLAMPED numbers for the refs, the React state and everything
          // downstream — so the body and the position the rest of the game
          // believed in disagreed, and at the ropes that disagreement is the
          // difference between standing against them and being outside them.
          newP1X = p1LocoRef.current.position.x;
          newP2X = p2LocoRef.current.position.x;
        }

        // Only trigger React re-render when position changes meaningfully (>0.01 units)
        if (Math.abs(newP1X - p1XRef.current) > 0.01) {
          p1XRef.current = newP1X;
          setP1X(newP1X);
        }
        // ONE OWNER OF Y AT A TIME. There are two airborne systems — the
        // locomotion jump arc and the juggle — and a launched fighter is not
        // jumping, so this is a switch rather than a sum. Without it the
        // juggle is invisible: the FSM lifts the body and the renderer keeps
        // drawing it on the floor.
        const jy = p1SM.isAirborne ? p1SM.juggleHeight : p1LocoRef.current.airborneY;
        if (Math.abs(jy - p1YRef.current) > 0.005) {
          p1YRef.current = jy;
          p1JumpYRef.current = jy;
          setP1Y(jy);
        }
        if (Math.abs(newP2X - p2XRef.current) > 0.01) {
          p2XRef.current = newP2X;
          setP2X(newP2X);
        }
        const p2JumpY = p2SM.isAirborne ? p2SM.juggleHeight : p2LocoRef.current.airborneY;
        if (Math.abs(p2JumpY - p2YRef.current) > 0.005) {
          p2YRef.current = p2JumpY;
          setP2Y(p2JumpY);
        }

        const newP1Z = p1LocoRef.current.position.z;
        const newP2Z = p2LocoRef.current.position.z;
        if (Math.abs(newP1Z - p1ZRef.current) > 0.01) {
          p1ZRef.current = newP1Z;
          setP1Z(newP1Z);
        }
        if (Math.abs(newP2Z - p2ZRef.current) > 0.01) {
          p2ZRef.current = newP2Z;
          setP2Z(newP2Z);
        }

        // Update locomotion velocity for animation blending
        const p1VelMag = Math.abs(p1Vel.forward) + Math.abs(p1Vel.strafe);
        const p2VelMag = Math.abs(p2Vel.forward) + Math.abs(p2Vel.strafe);
        if (Math.abs(p1VelMag - p1VelRef.current.forward) > 0.03) {
          p1VelRef.current = p1Vel;
          setP1LocomotionVelocity({ ...p1Vel });
        }
        if (Math.abs(p2VelMag - p2VelRef.current.forward) > 0.03) {
          p2VelRef.current = p2Vel;
          setP2LocomotionVelocity({ ...p2Vel });
        }
      }

      // ── Update queued action HUD display ──────────────────────────────────
      setP1QueuedAction(p1SM.getQueuedAction());
      setP1RecoveryProgress(p1SM.getRecoveryProgress());
      setP1WakeupBuffered(p1SM.getBufferedWakeup());

      if (engine.isMatchOver() && !koHandledRef.current) {
        koHandledRef.current = true;
        setKo(true);
        const w = engine.p1Health <= 0 && engine.p2Health <= 0 ? 'draw'
          : engine.p1Health <= 0 ? 'p2' : 'p1';
        setWinner(w);
        cancelAnimationFrame(rafRef.current);
        if (settings.soundEnabled) sfx.playKO();

        // ── Auto-save replay ──────────────────────────────────────────────
        triggerAutoSaveReplay(w);

        // ── Announcer: K.O. / Double K.O. / Perfect / Great ──────────────
        const announcer = announcerRef.current;
        if (!announcerFiredRef.current.ko) {
          announcerFiredRef.current.ko = true;
          const isDoubleKo = engine.p1Health <= 0 && engine.p2Health <= 0;
          const winnerHealth = w === 'p1' ? engine.p1Health : engine.p2Health;
          const winnerMaxHp = w === 'p1' ? p1Fighter.hp : p2Fighter.hp;
          const winnerHpPct = winnerHealth / winnerMaxHp;

          if (isDoubleKo) {
            // Double K.O. fires first, then Draw
            announcer.fire('doubleKo');
            setTimeout(() => announcer.fire('draw'), 1200);
          } else if (winnerHpPct >= 0.99) {
            // Perfect — winner took no damage
            announcer.fire('ko');
            setTimeout(() => announcer.fire('perfect'), 800);
          } else if (winnerHpPct <= 0.05) {
            // Great — pixel health comeback
            announcer.fire('ko');
            setTimeout(() => announcer.fire('great'), 800);
          } else {
            announcer.fire('ko');
          }

          // "[Name] Wins!" fires during victory cinematic
          if (!isDoubleKo) {
            setTimeout(() => {
              const winnerName = w === 'p1' ? p1Fighter.name : p2Fighter.name;
              announcer.fire(w === 'p1' ? 'p1Wins' : 'p2Wins', winnerName);
            }, 2200);
          }
        }

        // Determine condition
        const isPerfect = (w === 'p1' && engine.p1Health >= p1Fighter.hp * 0.99) ||
                          (w === 'p2' && engine.p2Health >= p2Fighter.hp * 0.99);
        const cond: 'KO' | 'TIMEOUT' | 'PERFECT' = isPerfect ? 'PERFECT' : 'KO';
        setMatchCondition(cond);

        // Build round result
        const elapsed = Math.round((Date.now() - roundStartTimeRef.current) / 1000);
        const outcome = resolveRound(roundStateRef.current, w, cond);
        const roundResult: RoundResult = {
          round: outcome.state.history[outcome.state.history.length - 1].round,
          winner: w,
          condition: cond,
          p1HealthRemaining: Math.max(0, engine.p1Health),
          p2HealthRemaining: Math.max(0, engine.p2Health),
          durationSeconds: elapsed,
        };
        roundStateRef.current = outcome.state;
        // APPEND, do not replace: replacing is why a match was one round.
        setRoundResults((prev) => [...prev, roundResult]);

        if (!outcome.matchOver) {
          // Another round to play: back to the marks rather than post-match.
          setTimeout(() => resetForRound(false), 1800);
          return;
        }

        // Switch to victory cinematic
        setTimeout(() => {
          setCinematicPhase('victory');
          if (w !== 'draw' && settings.soundEnabled) sfx.playVictory();
        }, 800);
        setTimeout(() => {
          onMatchEnd?.(outcome.matchWinner ?? w);
          setShowPostMatch(true);
        }, POST_MATCH_DELAY_MS);
      }
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [ko, onMatchEnd, sfx, settings, cinematicPhase, p1Color, p2Color, p1Fighter, p2Fighter, debugSettings]);

  // Round timer
  useEffect(() => {
    if (ko || cinematicPhase !== 'fight') return;
    const t = window.setInterval(() => {
      setRoundTimer(prev => {
        if (prev <= 1) {
          const engine = engineRef.current;
          if (engine && !koHandledRef.current) {
            koHandledRef.current = true;
            const w = engine.p1Health > engine.p2Health ? 'p1'
              : engine.p2Health > engine.p1Health ? 'p2' : 'draw';
            setKo(true);
            setWinner(w);
            cancelAnimationFrame(rafRef.current);
            if (settings.soundEnabled) sfx.playKO();

            // ── Auto-save replay on timeout ───────────────────────────────
            triggerAutoSaveReplay(w);

            // ── Announcer: Time Up! + Draw/Winner ─────────────────────────
            const announcer = announcerRef.current;
            announcer.fire('timeUp');
            setTimeout(() => {
              if (w === 'draw') {
                announcer.fire('draw');
              } else {
                const winnerName = w === 'p1' ? p1Fighter.name : p2Fighter.name;
                announcer.fire(w === 'p1' ? 'p1Wins' : 'p2Wins', winnerName);
              }
            }, 1200);

            setMatchCondition('TIMEOUT');
            const elapsed = Math.round((Date.now() - roundStartTimeRef.current) / 1000);
            const toOutcome = resolveRound(roundStateRef.current, w, 'TIMEOUT');
            setRoundResults((prev) => [...prev, {
              round: toOutcome.state.history[toOutcome.state.history.length - 1].round,
              winner: w,
              condition: 'TIMEOUT' as const,
              p1HealthRemaining: Math.max(0, engine.p1Health),
              p2HealthRemaining: Math.max(0, engine.p2Health),
              durationSeconds: elapsed,
            }]);
            roundStateRef.current = toOutcome.state;
            if (!toOutcome.matchOver) {
              // This block runs inside a setRoundTimer updater, so it has to
              // return the new timer value — a bare `return` would set it to
              // undefined. 0 is correct: the clock has run out.
              setTimeout(() => resetForRound(false), 1800);
              return 0;
            }
            setTimeout(() => {
              setCinematicPhase('victory');
              if (w !== 'draw' && settings.soundEnabled) sfx.playVictory();
            }, 800);
            setTimeout(() => {
              onMatchEnd?.(toOutcome.matchWinner ?? w);
              setShowPostMatch(true);
            }, POST_MATCH_DELAY_MS);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [ko, onMatchEnd, sfx, settings, cinematicPhase]);

  // Keyboard input — includes Q/E for Z-axis sidestep and Tekken 4-limb keys
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const i = inputRef.current as any;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') i.left = true;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') i.right = true;
      if (e.code === 'ArrowUp' || e.code === 'KeyW') i.up = true;
      if (e.code === 'ArrowDown' || e.code === 'KeyS') i.down = true;
      if (e.key === 'ArrowLeft') i.left = true;
      if (e.key === 'ArrowRight') i.right = true;
      if (e.key === 'ArrowUp') i.up = true;
      if (e.key === 'ArrowDown') i.down = true;
      // Legacy L/H/G/GR mapping (kept for compatibility)
      if (e.key === 'z' || e.key === 'Z') { i.light = true; i.lp = true; }
      if (e.key === 'x' || e.key === 'X') { i.heavy = true; i.rp = true; }
      if (e.key === 'c' || e.key === 'C') i.guard = true;
      if (e.key === 'v' || e.key === 'V') i.grapple = true;
      // Tekken 4-limb keys: U=1(LP), I=2(RP), J=3(LK), K=4(RK)
      if (e.key === 'u' || e.key === 'U') i.lp = true;
      if (e.key === 'i' || e.key === 'I') i.rp = true;
      if (e.key === 'j' || e.key === 'J') i.lk = true;
      if (e.key === 'k' || e.key === 'K') i.rk = true;
      // Q/E = held sidestep (away / toward camera). Double-tap up/down still uses the stick.
      if (e.key === 'q' || e.key === 'Q') i.sidestepBg = true;
      if (e.key === 'e' || e.key === 'E') i.sidestepFg = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const i = inputRef.current as any;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') i.left = false;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') i.right = false;
      if (e.code === 'ArrowUp' || e.code === 'KeyW') i.up = false;
      if (e.code === 'ArrowDown' || e.code === 'KeyS') i.down = false;
      if (e.key === 'ArrowLeft') i.left = false;
      if (e.key === 'ArrowRight') i.right = false;
      if (e.key === 'ArrowUp') i.up = false;
      if (e.key === 'ArrowDown') i.down = false;
      if (e.key === 'z' || e.key === 'Z') { i.light = false; i.lp = false; }
      if (e.key === 'x' || e.key === 'X') { i.heavy = false; i.rp = false; }
      if (e.key === 'c' || e.key === 'C') i.guard = false;
      if (e.key === 'v' || e.key === 'V') i.grapple = false;
      if (e.key === 'u' || e.key === 'U') i.lp = false;
      if (e.key === 'i' || e.key === 'I') i.rp = false;
      if (e.key === 'j' || e.key === 'J') i.lk = false;
      if (e.key === 'k' || e.key === 'K') i.rk = false;
      if (e.key === 'q' || e.key === 'Q') i.sidestepBg = false;
      if (e.key === 'e' || e.key === 'E') i.sidestepFg = false;
    };
    // Z return is handled by locomotion, not a lerp that fights sidestep.
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  const p1MaxHealth = p1Fighter.hp;
  const p2MaxHealth = p2Fighter.hp;
  const p1Pct = Math.max(0, Math.min(100, (p1Health / p1MaxHealth) * 100));
  const p2Pct = Math.max(0, Math.min(100, (p2Health / p2MaxHealth) * 100));

  const getHealthBarColor = (pct: number) => {
    if (pct > 50) return '#facc15';
    if (pct > 25) return '#f97316';
    return '#ef4444';
  };

  const getStateLabel = (state: string, anim: string) => {
    if (state === 'KO') return 'KO';
    if (state === 'Hitstun' || state === 'Stunned') return 'HIT';
    if (state === 'Crumple' || state === 'Knockdown') return 'DOWN';
    if (state === 'WakeupTechRoll') return 'ROLL';
    if (state === 'WakeupBackrise') return 'RISE';
    if (state === 'WakeupQuickStand') return 'STAND';
    if (state === 'Blockstun' || state === 'Guard') return 'BLOCK';
    if (state === 'Startup' || state === 'Attacking') return 'ATK';
    if (state === 'Active') return 'ACTIVE';
    if (state === 'Grappled') return 'GRAPPLE';
    if (state === 'Backdashing') return 'DASH';
    if (state === 'Walking') return 'WALK';
    return anim.toUpperCase();
  };

  const winnerName = winner === 'p1' ? p1Fighter.name : winner === 'p2' ? p2Fighter.name : undefined;

  // ── Auto-save replay to Supabase on match end ─────────────────────────────
  const autoSaveReplayRef = useRef(false);

  const triggerAutoSaveReplay = useCallback(async (
    winnerPlayer: 'p1' | 'p2' | 'draw',
  ) => {
    if (autoSaveReplayRef.current) return; // Only save once per match
    autoSaveReplayRef.current = true;

    stopRecording();
    const frames = getBuffer();
    if (frames.length === 0) return;

    const clip = {
      id: `auto_${Date.now()}`,
      label: `${p1Fighter.name} vs ${p2Fighter.name} — ${stageId ?? 'urban_night'} [AUTO]`,
      p1Name: p1Fighter.name,
      p2Name: p2Fighter.name,
      stageName: stageId ?? 'urban_night',
      frames,
      inPoint: 0,
      outPoint: frames.length - 1,
      speedMultiplier: 1.0,
      exportedAt: new Date().toISOString(),
      totalFrames: frames.length,
      durationMs: frames.length > 1
        ? (frames[frames.length - 1]?.timestamp ?? 0) - (frames[0]?.timestamp ?? 0)
        : 0,
    };

    if (user?.id) {
      const result = await saveReplayToSupabase(clip, user.id);
      if (result.success) {
        console.log('[Arena] ☁ Auto-saved replay to Supabase:', clip.id, `(${frames.length} frames)`);
      } else {
        console.warn('[Arena] ⚠ Auto-save replay failed:', result.error);
      }
    } else {
      console.log('[Arena] ℹ Auto-save skipped — user not signed in');
    }
  }, [p1Fighter.name, p2Fighter.name, stageId, user?.id, stopRecording, getBuffer]);

  // Reset autoSaveReplayRef on new match
  useEffect(() => {
    autoSaveReplayRef.current = false;
  }, [p1Fighter, p2Fighter]);

  return (
    <div className="fixed inset-0 bg-black text-white overflow-hidden touch-none select-none font-mono">

      {/* ── FULL-SCREEN 3D COMBAT VIEWPORT — background layer ── */}
      <div className="absolute inset-0 z-0" style={{ width: '100%', height: '100%' }}>
        <CombatArena3D
          onFighterReady={(player, ok) => { if (ok) handleFighterReady(player); }}
          introSpeaker={introBeat ? { player: introBeat.player, line: introBeat.line } : null}
          p1Fighter={p1Fighter}
          p2Fighter={p2Fighter}
          p1State={p1State}
          p2State={p2State}
          p1Animation={grappleBeat?.victim === 'p1' ? grappleBeat.clip
            : introBeat?.player === 'p1' ? introBeat.clip : p1Animation}
          p2Animation={grappleBeat?.victim === 'p2' ? grappleBeat.clip
            : introBeat?.player === 'p2' ? introBeat.clip : p2Animation}
          onClipResolved={(who, clip) => { liveClipRef.current[who] = clip; }}
          p1Color={p1Color}
          p2Color={p2Color}
          hitStopActive={hitStopActive}
          p1SkinTint={p1SkinTint}
          p2SkinTint={p2SkinTint}
          p1Z={p1Z}
          p2Z={p2Z}
          cinematicPhase={cinematicPhase}
          winnerName={winnerName}
          cameraFov={settings.cameraFov}
          announcerEnabled={settings.soundEnabled}
          damageEvent={damageEvent}
          knockdownEvent={knockdownEvent}
          stageId={stageId ?? 'urban_night'}
          p1AnimTrigger={p1AnimTrigger}
          p2AnimTrigger={p2AnimTrigger}
          p1AttackDurationSeconds={(() => {
            const move = p1SMRef.current.getHitboxWindow().move;
            return move ? move.startup + move.active + move.recovery : undefined;
          })()}
          p2AttackDurationSeconds={(() => {
            const move = p2SMRef.current.getHitboxWindow().move;
            return move ? move.startup + move.active + move.recovery : undefined;
          })()}
          p1LocomotionVelocity={p1LocomotionVelocity}
          p2LocomotionVelocity={p2LocomotionVelocity}
          p1X={p1X}
          p2X={p2X}
          p1Y={p1Y}
          p2Y={p2Y}
          onP1BoneHitboxReady={(sys: BoneHitboxSystem) => { p1BoneHitboxRef.current = sys; }}
          onP2BoneHitboxReady={(sys: BoneHitboxSystem) => { p2BoneHitboxRef.current = sys; }}
          wallSplatEvent={wallSplatEvent}
          overdriveEvent={overdriveEvent}
          finisherEvent={finisherEvent}
          cameraShakeOffset={cameraShakeOffset}
        />
      </div>

      {/* ── HUD OVERLAY: transparent, only visible during fight phase ── */}
      {cinematicPhase === 'fight' && (
        <>
          {/* Health bars + timer — semi-transparent background only on bar rows */}
          <div className="absolute top-0 left-0 right-0 z-30 px-safe pt-safe pb-1 pointer-events-none">
            <div className="flex items-center gap-2">
              <img
                src={p1Fighter.pixelPortrait ?? `/portraits/pixel/${p1Fighter.id}.png`}
                alt=""
                className="h-12 w-12 max-[380px]:h-10 max-[380px]:w-10 shrink-0 border border-zinc-700 object-cover"
                style={{ imageRendering: "pixelated" }}
              />
              {/* P1 health bar */}
              <div className="flex-1 flex flex-col gap-0.5">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[9px] font-black tracking-[0.3em]" style={{ color: p1Color }}>
                    {p1Fighter.name.toUpperCase()}
                  </span>
                  <span className="text-[8px] text-zinc-400">{Math.ceil(p1Health).toLocaleString()}</span>
                </div>
                <div className="h-4 border border-zinc-700/60 bg-black/50 relative overflow-hidden">
                  <div
                    className="absolute left-0 top-0 h-full transition-all duration-75"
                    style={{ width: `${p1Pct}%`, background: getHealthBarColor(p1Pct), boxShadow: `0 0 8px ${getHealthBarColor(p1Pct)}88` }}
                  />
                  {p1Pct <= 25 && <div className="absolute inset-0 animate-pulse bg-red-500/10" />}
                </div>
                <div className="text-[7px] text-zinc-300 tracking-widest h-3">{getStateLabel(p1State, p1Animation)}</div>
              </div>

              {/* Center: Timer + Round */}
              <div className="flex flex-col items-center shrink-0 w-20">
                <div className="text-[7px] text-zinc-300 tracking-widest text-center leading-tight">{roundLabel ?? 'ROUND 1'}</div>
                <div
                  className="text-2xl font-black tabular-nums leading-none"
                  style={{ color: roundTimer <= 10 ? '#ef4444' : '#facc15', textShadow: roundTimer <= 10 ? '0 0 12px #ef4444' : '0 0 12px #facc15' }}
                >
                  {String(roundTimer).padStart(2, '0')}
                </div>
                <div className="text-[7px] text-zinc-400 tracking-widest">F{frame}</div>
              </div>

              {/* P2 health bar */}
              <div className="flex-1 flex flex-col gap-0.5">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[8px] text-zinc-400 text-right w-full">{Math.ceil(p2Health).toLocaleString()}</span>
                  <span className="text-[9px] font-black tracking-[0.3em] ml-2 whitespace-nowrap" style={{ color: p2Color }}>
                    {p2Fighter.name.toUpperCase()}
                  </span>
                </div>
                <div className="h-4 border border-zinc-700/60 bg-black/50 relative overflow-hidden">
                  <div
                    className="absolute right-0 top-0 h-full transition-all duration-75"
                    style={{ width: `${p2Pct}%`, background: getHealthBarColor(p2Pct), boxShadow: `0 0 8px ${getHealthBarColor(p2Pct)}88` }}
                  />
                  {p2Pct <= 25 && <div className="absolute inset-0 animate-pulse bg-red-500/10" />}
                </div>
                <div className="text-[7px] text-zinc-300 tracking-widest h-3 text-right">{getStateLabel(p2State, p2Animation)}</div>
              </div>
              <img
                src={p2Fighter.pixelPortrait ?? `/portraits/pixel/${p2Fighter.id}.png`}
                alt=""
                className="h-12 w-12 shrink-0 border border-zinc-700 object-cover"
                style={{ imageRendering: "pixelated" }}
              />
            </div>
          </div>

          {/* ── Combo Counter HUD ── */}
          <ComboCounterHUD
            p1Combo={p1Combo}
            p2Combo={p2Combo}
            p1Color={p1Color}
            p2Color={p2Color}
          />

          {/* ── Momentum HUD — glowing aura indicator ── */}
          {p1MomentumCharge.active && (
            <div className="absolute z-40 pointer-events-none" style={{ bottom: '28%', left: '12%' }}>
              <div
                className="px-3 py-1 text-[9px] font-black tracking-widest uppercase animate-pulse"
                style={{
                  color: '#a78bfa',
                  textShadow: '0 0 16px #a78bfa, 0 0 32px #a78bfa88',
                  border: '1px solid #a78bfa44',
                  background: 'rgba(0,0,0,0.75)',
                }}
              >
                ⚡ MOMENTUM · {Math.ceil(p1MomentumCharge.framesRemaining / 60 * 10) / 10}s
              </div>
              <div className="text-[6px] text-purple-300/70 tracking-widest mt-0.5 text-center">
                NEXT HIT = COUNTER · NO BLOCK
              </div>
            </div>
          )}

          {/* ── Overdrive HUD — stance mode indicator ── */}
          {p1HeatActive && (
            <div className="absolute z-40 pointer-events-none" style={{ bottom: '22%', left: '8%' }}>
              <div
                className="px-3 py-1 text-[9px] font-black tracking-widest uppercase animate-pulse"
                style={{
                  color: '#f97316',
                  textShadow: '0 0 16px #f97316, 0 0 32px #f9731688',
                  border: '1px solid #f9731644',
                  background: 'rgba(0,0,0,0.75)',
                }}
              >
                ⚡ OVERDRIVE
              </div>
            </div>
          )}
          {p2HeatActive && (
            <div className="absolute z-40 pointer-events-none" style={{ bottom: '22%', right: '8%' }}>
              <div
                className="px-3 py-1 text-[9px] font-black tracking-widest uppercase animate-pulse"
                style={{
                  color: '#f97316',
                  textShadow: '0 0 16px #f97316, 0 0 32px #f9731688',
                  border: '1px solid #f9731644',
                  background: 'rgba(0,0,0,0.75)',
                }}
              >
                ⚡ OVERDRIVE
              </div>
            </div>
          )}

          {/* ── Finisher available indicator ── */}
          {p1FinisherAvailable && (
            <div className="absolute z-40 pointer-events-none" style={{ bottom: '16%', left: '8%' }}>
              <div
                className="px-3 py-1 text-[9px] font-black tracking-widest uppercase animate-pulse"
                style={{
                  color: '#ef4444',
                  textShadow: '0 0 16px #ef4444, 0 0 32px #ef444488',
                  border: '1px solid #ef444444',
                  background: 'rgba(0,0,0,0.75)',
                }}
              >
                💢 FINISHER READY
              </div>
            </div>
          )}
          {p2FinisherAvailable && (
            <div className="absolute z-40 pointer-events-none" style={{ bottom: '16%', right: '8%' }}>
              <div
                className="px-3 py-1 text-[9px] font-black tracking-widest uppercase animate-pulse"
                style={{
                  color: '#ef4444',
                  textShadow: '0 0 16px #ef4444, 0 0 32px #ef444488',
                  border: '1px solid #ef444444',
                  background: 'rgba(0,0,0,0.75)',
                }}
              >
                💢 FINISHER READY
              </div>
            </div>
          )}

          {/* ── Ring-Out Notice ── */}
          {ringOutNotice && (
            <div
              key={ringOutNotice.count}
              className="absolute z-50 pointer-events-none inset-0 flex items-center justify-center"
              style={{
                animation: `bfNoticeOut ${NOTICE_DURATION_MS}ms ease-out forwards`,
              }}
            >
              <div
                className="px-6 py-3 text-2xl font-black tracking-[0.3em] uppercase animate-bounce"
                style={{
                  color: '#facc15',
                  textShadow: '0 0 30px #facc15, 0 0 60px #facc1588',
                  border: '2px solid #facc1566',
                  background: 'rgba(0,0,0,0.85)',
                }}
              >
                {ringOutNotice.player === 'p1' ? 'P1' : 'P2'} RING OUT!
              </div>
            </div>
          )}

          {/* ── Floor Break Notice ── */}
          {floorBreakNotice && (
            <div
              key={floorBreakNotice.count}
              className="absolute z-50 pointer-events-none inset-0 flex items-center justify-center"
              style={{
                animation: `bfNoticeOut ${NOTICE_DURATION_MS}ms ease-out forwards`,
              }}
            >
              <div
                className="px-6 py-3 text-xl font-black tracking-[0.25em] uppercase"
                style={{
                  color: '#f97316',
                  textShadow: '0 0 24px #f97316, 0 0 48px #f9731688',
                  border: '2px solid #f9731666',
                  background: 'rgba(0,0,0,0.85)',
                  animation: 'ping 0.4s ease-out',
                }}
              >
                💥 FLOOR BREAK → {floorBreakNotice.level}
              </div>
            </div>
          )}

          {/* ── Hazard Warning ── */}
          {hazardNotice && arenaState.config.hazardDamagePerSec > 0 && (
            <div className="absolute z-40 pointer-events-none top-[18%] left-1/2 -translate-x-1/2">
              <div
                className="px-3 py-1 text-[8px] font-black tracking-widest uppercase animate-pulse"
                style={{
                  color: '#ef4444',
                  textShadow: '0 0 12px #ef4444',
                  border: '1px solid #ef444466',
                  background: 'rgba(0,0,0,0.75)',
                }}
              >
                {hazardNotice}
              </div>
            </div>
          )}

          {/* ── Train Warning HUD (Subway stage) ── */}
          {trainWarningActive && (
            <div className="absolute z-50 pointer-events-none inset-0 flex items-center justify-center">
              <div
                className="px-8 py-4 text-2xl font-black tracking-[0.3em] uppercase animate-pulse"
                style={{
                  color: '#f59e0b',
                  textShadow: '0 0 30px #f59e0b, 0 0 60px #f59e0b88',
                  border: '2px solid #f59e0b66',
                  background: 'rgba(0,0,0,0.9)',
                }}
              >
                🚇 TRAIN INCOMING!
              </div>
            </div>
          )}

          {/* ── Train Crossing Flash ── */}
          {trainCrossing && (
            <div
              className="absolute z-50 pointer-events-none inset-0"
              style={{ background: 'rgba(245,158,11,0.08)', boxShadow: 'inset 0 0 80px rgba(245,158,11,0.3)' }}
            />
          )}

          {/* ── Vault Prompt (P1 on tracks) ── */}
          {p1OnTracks && !trainCrossing && (
            <div className="absolute z-40 pointer-events-none" style={{ bottom: '35%', left: '10%' }}>
              <div
                className="px-3 py-1.5 text-[9px] font-black tracking-widest uppercase animate-bounce"
                style={{
                  color: '#22d3ee',
                  textShadow: '0 0 16px #22d3ee',
                  border: '1px solid #22d3ee66',
                  background: 'rgba(0,0,0,0.85)',
                }}
              >
                ↑ VAULT UP!
              </div>
              <div className="text-[6px] text-cyan-400/60 tracking-widest text-center mt-0.5">PRESS UP TO ESCAPE TRACKS</div>
            </div>
          )}

          {/* ── Hazard Bounce Notice ── */}
          {hazardBounceNotice && (
            <div className="absolute z-50 pointer-events-none top-[30%] left-1/2 -translate-x-1/2">
              <div
                className="px-4 py-2 text-sm font-black tracking-widest uppercase animate-pulse"
                style={{
                  color: '#f97316',
                  textShadow: '0 0 20px #f97316',
                  border: '1px solid #f9731666',
                  background: 'rgba(0,0,0,0.85)',
                }}
              >
                {hazardBounceNotice}
              </div>
            </div>
          )}

          {/* ── Floor Break Phase Indicator ── */}
          {floorBreakPhase === 'floor_break_fall' && (
            <div
              className="absolute z-50 pointer-events-none inset-0"
              style={{ background: 'rgba(249,115,22,0.06)', boxShadow: 'inset 0 0 60px rgba(249,115,22,0.2)' }}
            />
          )}

          {/* ── Wall Shatter VFX (left/right) ── */}
          {wallShatterLeft && (
            <div
              className="absolute z-40 pointer-events-none left-0 top-0 bottom-0 w-16 animate-pulse"
              style={{ background: 'linear-gradient(to right, rgba(148,163,184,0.3), transparent)' }}
            />
          )}
          {wallShatterRight && (
            <div
              className="absolute z-40 pointer-events-none right-0 top-0 bottom-0 w-16 animate-pulse"
              style={{ background: 'linear-gradient(to left, rgba(148,163,184,0.3), transparent)' }}
            />
          )}

          {/* ── Ledge Throw Active Indicator ── */}
          {ledgeThrowActive && (
            <div className="absolute z-50 pointer-events-none inset-0 flex items-center justify-center">
              <div
                className="px-6 py-3 text-xl font-black tracking-[0.3em] uppercase"
                style={{
                  color: '#ef4444',
                  textShadow: '0 0 24px #ef4444, 0 0 48px #ef444488',
                  border: '2px solid #ef444466',
                  background: 'rgba(0,0,0,0.9)',
                  animation: 'pulse 0.5s ease-in-out infinite',
                }}
              >
                🎯 LEDGE THROW!
              </div>
            </div>
          )}

          {/* ── Stage Level Indicator ── */}
          {arenaState.config.levels.length > 1 && (
            <div className="absolute z-40 pointer-events-none top-[22%] left-1/2 -translate-x-1/2 flex gap-3">
              <span
                className="text-[7px] tracking-widest font-black"
                style={{ color: arenaState.config.accentColor, opacity: 0.7 }}
              >
                P1: {arenaState.config.levels[arenaState.p1LevelIndex]?.label ?? 'LEVEL 1'}
              </span>
              <span className="text-[7px] text-zinc-600">|</span>
              <span
                className="text-[7px] tracking-widest font-black"
                style={{ color: arenaState.config.accentColor, opacity: 0.7 }}
              >
                P2: {arenaState.config.levels[arenaState.p2LevelIndex]?.label ?? 'LEVEL 1'}
              </span>
            </div>
          )}

          {/* ── Debug Overlay HUD (practice mode only) ── */}
          <DebugOverlayHUD
            settings={debugSettings}
            p1Debug={p1DebugData}
            p2Debug={p2DebugData}
          />

          {/* ── Input String Recorder ── */}
          <InputStringRecorder inputRef={inputRef} />

          {/* ── Special Move Notification ── */}
          {specialMoveNotice && (
            <div
              key={specialMoveNotice.id}
              className="absolute z-40 pointer-events-none"
              style={{
                top: '18%',
                left: specialMoveNotice.player === 'p1' ? '8%' : 'auto',
                right: specialMoveNotice.player === 'p2' ? '8%' : 'auto',
              }}
            >
              <div
                className="px-3 py-1 text-xs font-black tracking-widest uppercase animate-pulse"
                style={{
                  color: '#facc15',
                  textShadow: '0 0 20px #facc15, 0 0 40px #facc1566',
                  border: '1px solid #facc1544',
                  background: 'rgba(0,0,0,0.7)',
                }}
              >
                ⚡ {specialMoveNotice.name}
              </div>
            </div>
          )}

          {/* ── Input Queue / Recovery HUD ── */}
          <div className="absolute bottom-32 left-4 z-40 pointer-events-none flex flex-col gap-1">
            {/* Recovery progress bar */}
            {p1RecoveryProgress > 0 && p1RecoveryProgress < 1 && (
              <div className="flex items-center gap-1.5">
                <div className="text-[7px] text-orange-400/80 tracking-widest font-black">REC</div>
                <div className="w-16 h-1.5 bg-zinc-800/80 border border-zinc-700/60 overflow-hidden">
                  <div
                    className="h-full transition-all duration-75"
                    style={{ width: `${p1RecoveryProgress * 100}%`, background: '#f97316' }}
                  />
                </div>
              </div>
            )}
            {/* Queued action badge */}
            {p1QueuedAction && (
              <div className="flex items-center gap-1.5 animate-pulse">
                <div className="text-[7px] text-yellow-400/80 tracking-widest">QUEUED</div>
                <div
                  className="px-2 py-0.5 text-[9px] font-black tracking-widest border"
                  style={{
                    color: p1QueuedAction.type === 'light' ? '#60a5fa'
                         : p1QueuedAction.type === 'heavy' ? '#f87171'
                         : p1QueuedAction.type === 'guard'? '#a1a1aa' :'#c084fc',
                    borderColor: p1QueuedAction.type === 'light' ? '#3b82f680'
                               : p1QueuedAction.type === 'heavy' ? '#ef444480'
                               : p1QueuedAction.type === 'guard'? '#52525b80' :'#a855f780',
                    background: 'rgba(0,0,0,0.75)',
                  }}
                >
                  {p1QueuedAction.label}
                </div>
              </div>
            )}
            {/* Wakeup buffer badge — shown during knockdown */}
            {p1WakeupBuffered && (
              <div className="flex items-center gap-1.5 animate-pulse">
                <div className="text-[7px] text-cyan-400/80 tracking-widest">WAKEUP</div>
                <div
                  className="px-2 py-0.5 text-[9px] font-black tracking-widest border border-cyan-500/50"
                  style={{ color: '#22d3ee', background: 'rgba(0,0,0,0.75)' }}
                >
                  {p1WakeupBuffered === 'techRoll' ? 'ROLL'
                   : p1WakeupBuffered === 'backrise'? 'RISE' :'STAND'}
                </div>
              </div>
            )}
          </div>

          {/* Move Execution Feedback — training mode only, never during real fights */}
          {isPracticeMode && (
            <MoveExecutionFeedback
              events={feedbackEvents}
              onExpire={(id) => setFeedbackEvents(prev => prev.filter(e => e.id !== id))}
            />
          )}

          {/* KO overlay */}
          {ko && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center pointer-events-none">
              <div
                className="font-black tracking-widest animate-pulse"
                style={{ fontSize: 'clamp(4rem, 15vw, 10rem)', color: '#facc15', textShadow: '0 0 40px #facc15, 0 0 80px #facc1544', fontFamily: 'monospace' }}
              >
                {roundTimer <= 0 ? 'TIME' : 'K.O.'}
              </div>
            </div>
          )}

          {/* Hit stop flash */}
          {hitStopActive && <div className="absolute inset-0 z-40 pointer-events-none bg-white/5 animate-pulse" />}

          {/* Mobile touch controls — transparent overlay on top of 3D arena */}
          {!ko && <MobileControls inputRef={inputRef} />}

          {/* Controls legend */}
          <div className="absolute bottom-safe-1 left-3 z-30 text-[7px] text-zinc-500 space-y-0.5 pointer-events-none pr-2">
            <div>ARROWS: MOVE · Z/U: 1(LP) · X/I: 2(RP) · J: 3(LK) · K: 4(RK) · C: GUARD · V: GRAPPLE · Q/E: SIDESTEP</div>
            <div className="text-zinc-600">COMBOS: U+J=THROW · I+K=THROW · I+J=OVERDRIVE · →+C=CMD THROW · SPECIAL: L+L+H or H+H+L</div>
            <div className="text-purple-500/60">MOMENTUM: U+X+J+K (1+2+3+4) — NEXT HIT = COUNTER · NO BLOCK</div>
          </div>

          {/* ── Grab Range Visualization ── */}
          {p1GrabRangeVisible && (
            <div
              className="absolute z-40 pointer-events-none"
              style={{
                bottom: '28%',
                left: '20%',
                transform: 'translateX(-50%)',
              }}
            >
              <div
                className="rounded-full border-2 flex items-center justify-center transition-all duration-200"
                style={{
                  width: `${p1GrabRangeRadius * 60}px`,
                  height: `${p1GrabRangeRadius * 60}px`,
                  borderColor: p1GrabRangeHit ? '#22c55e' : '#ef4444',
                  background: p1GrabRangeHit ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.08)',
                  boxShadow: p1GrabRangeHit
                    ? '0 0 20px rgba(34,197,94,0.5)'
                    : '0 0 16px rgba(239,68,68,0.4)',
                }}
              >
                <div
                  className="text-[7px] font-black tracking-widest"
                  style={{ color: p1GrabRangeHit ? '#22c55e' : '#ef4444' }}
                >
                  {p1GrabRangeHit ? 'GRAB!' : 'WHIFF'}
                </div>
              </div>
              <div
                className="text-center text-[6px] mt-1 font-black tracking-widest"
                style={{ color: p1GrabRangeHit ? '#22c55e' : '#ef4444' }}
              >
                CMD THROW · {p1GrabRangeRadius.toFixed(1)}u
              </div>
            </div>
          )}
        </>
      )}

      {/* Back button */}
      {onBack && cinematicPhase === 'fight' && (
        <button
          onClick={onBack}
          className="absolute top-safe-16 left-3 z-40 text-[8px] text-zinc-400 hover:text-zinc-200 border border-zinc-700/60 hover:border-zinc-500 px-2 py-1 transition-colors bg-black/50"
        >
          ← BACK
        </button>
      )}

      {/* ── Pause button (ESC hint) ── */}
      {cinematicPhase === 'fight' && !ko && (
        <button
          onClick={() => { setIsPaused(p => !p); setPauseTab('menu'); }}
          className="absolute top-safe-3 right-3 z-40 text-[8px] text-zinc-500 hover:text-zinc-200 border border-zinc-700/40 hover:border-zinc-500 px-2 py-1 transition-colors bg-black/50 font-mono tracking-widest"
        >
          ⏸ ESC
        </button>
      )}

      {/* ── Pause Menu Overlay ── */}
      {isPaused && cinematicPhase === 'fight' && !ko && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center p-safe mobile-menu-scroll"
          style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(6px)' }}
        >
          <div
            className="w-[calc(100%-1.5rem)] max-w-sm max-h-[calc(100dvh-2rem)] overflow-y-auto border border-zinc-700 bg-zinc-950 font-mono"
            style={{ boxShadow: '0 0 40px rgba(250,204,21,0.08)' }}
          >
            {/* Pause header */}
            <div className="border-b border-zinc-800 px-4 py-2 flex items-center justify-between">
              <div className="text-[10px] text-yellow-400 tracking-widest font-black">⏸ PAUSED</div>
              <div className="text-[7px] text-zinc-600">{p1Fighter.name} vs {p2Fighter.name}</div>
            </div>

            {/* Tab bar */}
            <div className="flex border-b border-zinc-800">
              <button
                onClick={() => setPauseTab('menu')}
                className={`flex-1 text-[8px] tracking-widest py-1.5 transition-colors ${pauseTab === 'menu' ? 'text-yellow-400 border-b border-yellow-600' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                MENU
              </button>
              <button
                onClick={() => setPauseTab('replay')}
                className={`flex-1 text-[8px] tracking-widest py-1.5 transition-colors ${pauseTab === 'replay' ? 'text-yellow-400 border-b border-yellow-600' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                ⏺ REPLAY
              </button>
            </div>

            <div className="p-4">
              {pauseTab === 'menu' && (
                <div className="space-y-2">
                  <button
                    onClick={() => setIsPaused(false)}
                    className="w-full text-[9px] font-black tracking-widest border border-yellow-700 text-yellow-400 hover:bg-yellow-900/30 py-2 transition-colors"
                  >
                    ▶ RESUME FIGHT
                  </button>
                  {onBack && (
                    <button
                      onClick={() => { setIsPaused(false); onBack(); }}
                      className="w-full text-[9px] font-black tracking-widest border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 py-2 transition-colors"
                    >
                      ← QUIT MATCH
                    </button>
                  )}
                  <div className="text-[6px] text-zinc-700 text-center pt-1">
                    Press ESC to resume
                  </div>
                </div>
              )}

              {pauseTab === 'replay' && (
                <PauseMenuRecorder
                  p1Name={p1Fighter.name}
                  p2Name={p2Fighter.name}
                  stageName={stageId ?? 'urban_night'}
                  getBuffer={getBuffer}
                  isRecording={isRecording}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Post-Match Screen ── */}
      {showPostMatch && winner && (
        <div className="absolute inset-0 z-50">
          <PostMatchScreen
            p1Fighter={p1Fighter}
            p2Fighter={p2Fighter}
            winner={winner}
            condition={matchCondition}
            roundResults={roundResults}
            p1Color={p1Color}
            p2Color={p2Color}
            onRematch={() => {
              setShowPostMatch(false);
              // One reset, shared with the round transition. This used to be a
              // second copy of the same twenty lines, which is how the two
              // drifted apart.
              resetForRound(true);
            }}
            onCharacterSelect={() => {
              setShowPostMatch(false);
              onBack?.();
            }}
            onExit={() => {
              setShowPostMatch(false);
              onBack?.();
            }}
          />
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Map SM ActionState + motion to a display state string */
function mapActionToDisplayState(
  action: import('../engine/combat/FighterStateMachine').ActionState,
  motion: string,
  legacyState: string,
): string {
  switch (action) {
    case 'Attacking':          return motion || 'lightAttack';
    case 'Stunned':            return 'Hitstun';
    case 'Crumple':            return 'Hitstun';
    case 'Guard':              return motion || 'guard';
    case 'Walking':            return motion || 'Walking';
    case 'Backdashing':        return 'Backdashing';
    case 'Jumping':            return motion || 'jump';
    case 'Knockdown':          return 'Knockdown';
    case 'WakeupTechRoll':     return 'WakeupTechRoll';
    case 'WakeupBackrise':     return 'WakeupBackrise';
    case 'WakeupQuickStand':   return 'WakeupQuickStand';
    case 'Idle':               return motion === 'crouch' ? 'crouch' : (legacyState === 'KO' ? 'KO' : 'Neutral');
    default:                   return motion || legacyState;
  }
}

/** Character-authored P2 combat brain. */
function buildP2AIInput(
  p2State: string, p1Health: number, p2Health: number,
  p2X: number, p1X: number, p2Z: number, p1Z: number,
  fighter: BannonFighterProfile,
): SMInput {
  const now = performance.now();
  const style = fighter.fightingStyle.toLowerCase();
  const personality = fighter.personality.toLowerCase();
  const distance = Math.hypot(p2X - p1X, p2Z - p1Z);
  const distZ = Math.abs(p2Z - p1Z);
  const healthPressure = p2Health < p1Health;
  const speedStyle = /speed|agility|aerial|electric|technical striking/.test(style);
  const powerStyle = /power|wrestling|brawler|enforcer|endurance/.test(style);
  const aerialStyle = /aerial|high-flying|high flying/.test(style);
  const evasiveStyle = /evasive|misdirection|psychological|agility|speed/.test(style);
  const aggressive = /aggressive|manic|volatile|relentless|territorial|never stops/.test(personality);
  if (['Hitstun','Stunned','Knockdown','WakeupTechRoll','WakeupBackrise','WakeupQuickStand'].includes(p2State))
    return {forward:0,strafe:0,light:false,heavy:false,guard:false,crouch:false,jump:false};
  if (p2State === 'Blockstun')
    return {forward:0,strafe:0,light:false,heavy:false,guard:true,crouch:false,jump:false};
  const cycle = Math.floor(now / 900) % 8;
  const orbit = evasiveStyle && distZ < 1.25 && cycle % 3 === 0 ? (cycle % 2 === 0 ? 1 : -1) : 0;
  const preferredGap = speedStyle ? 1.7 : powerStyle ? 1.9 : 1.6;
  // LOCAL forward: LocomotionSystem multiplies by facing. +1 therefore means
  // toward the opponent for both P1 and P2; the old P2 AI incorrectly used -1.
  if (distance > preferredGap)
    return {forward:1,strafe:orbit,light:false,heavy:false,guard:false,crouch:false,jump:false};
  if ((aerialStyle || speedStyle) && cycle === 6)
    return {forward:1,strafe:orbit,light:false,heavy:false,guard:false,crouch:false,jump:true};
  if (powerStyle && cycle === 5)
    return {forward:-1,strafe:0,light:false,heavy:false,guard:true,crouch:false,jump:false};
  if (healthPressure && cycle === 4)
    return {forward:0,strafe:orbit,light:false,heavy:false,guard:true,crouch:false,jump:false};
  /**
   * THE AI CAN THROW YOU NOW.
   *
   * Owner: the grapple needs "the opponent side hooked up and wired up all
   * areas wise." MEASURED: not one branch of this function ever set
   * `grapple`, on any cycle, for any style or personality — so the field the
   * command buffer reads was permanently false and only the player could
   * ever attempt a throw. A grapple only one side can perform is half a
   * system, and it is why nobody had ever seen the victim's half of one.
   *
   * Inside grab range (1.4 m), and weighted to the styles that would: a
   * wrestler or brawler reaches for it, everyone else does it occasionally.
   * The player gets the same 0.35 s break window the AI does.
   */
  if (distance <= 1.35 && (cycle === 4 || (powerStyle && cycle === 2)))
    return {forward:0,strafe:0,light:false,heavy:false,guard:false,crouch:false,jump:false,grapple:true};
  switch (cycle) {
    case 0: case 1: return {forward:0,strafe:orbit,light:true,heavy:false,guard:false,crouch:false,jump:false};
    case 2: return {forward:0,strafe:orbit,light:false,heavy:true,guard:false,crouch:false,jump:false};
    case 3: return {forward:aggressive ? 1 : 0,strafe:orbit,light:true,heavy:false,guard:false,crouch:false,jump:false};
    case 7: return {forward:-1,strafe:orbit,light:false,heavy:false,guard:true,crouch:false,jump:false};
    default: return {forward:0,strafe:orbit,light:false,heavy:false,guard:false,crouch:false,jump:false};
  }
}