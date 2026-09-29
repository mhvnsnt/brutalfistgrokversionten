// `.ts` extensions on purpose — the repo's runner resolves them literally.
/**
 * ROSTER MOVE WINDOWS — the FSM-side half of per-fighter movesets.
 *
 * The generated directional table (public/motion/movesets.json) covers the 26
 * motion-command slots. The engine's NEUTRAL buttons (LP / RP / LK / RK), the
 * down+button crouch attacks and the roster's directional fallback slots are
 * resolved here, from:
 *   - the fighter's roster move IDs (CharacterMoveSet → BrutalFistMoveCatalog),
 *     converted from catalog frames to engine seconds on a documented scale;
 *   - the fighter's style profile (FighterStyleProfiles) — startup/active/
 *     recovery offsets, damage, reach, hitstun, pushback, launch, on-block,
 *     power-crush armour — and his roster speed/strength;
 *   - the style's neutral 2–3 hit string (MoveWindow.stringFollowups);
 *   - a style-chosen baked clip for neutral/crouch slots
 *     (src/generated/RosterStyleClips.generated.ts). A slot with no chosen clip
 *     is reported MISSING_CLIP and plays the semantic slot animation; it is
 *     never relabelled as authored.
 *
 * Nothing here is visual certification. It is gameplay data + routing.
 */
import { getMoveById, type BrutalFistMove } from '../BrutalFistMoveCatalog.ts';
import { getBannonFighter } from '../../data/bannonRoster.ts';
import { getCharacterMoveSet } from '../CharacterMoveSetSystem.ts';
import { resolveStyle, type ResolvedStyle, type StringButton } from './FighterStyleProfiles.ts';
import { ROSTER_STYLE_CLIPS } from '../../generated/RosterStyleClips.generated.ts';
import { DEFAULT_MOVE_WINDOWS, CROUCH_MOVE_WINDOWS, type MoveWindow, type CharacterMoveClipSlot } from './FighterStateMachine.ts';
import type { FighterMotionState } from '../retarget/AnimationController.ts';
import { powerCrushWindow } from './DefensiveWindows.ts';

export type ClipStatus = 'STYLE_CLIP' | 'MISSING_CLIP';

export interface SlotProvenance {
  slot: CharacterMoveClipSlot;
  moveId: string | null;
  clip: string | null;
  clipStatus: ClipStatus;
}

export interface RosterMoveResolution {
  fighterId: string;
  style: string;
  windows: Partial<Record<CharacterMoveClipSlot, MoveWindow>>;
  ids: Partial<Record<CharacterMoveClipSlot, string>>;
  provenance: SlotProvenance[];
  neutralString: StringButton[];
}

const CANCEL_OPENS_AT = 0.2;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Which engine semantic slot a roster slot fires as, and its default window. */
const SLOT_SEMANTIC: Partial<Record<CharacterMoveClipSlot, { state: FighterMotionState; base: MoveWindow }>> = {
  lightAttack: { state: 'lightAttack', base: DEFAULT_MOVE_WINDOWS.lightAttack },
  heavyAttack: { state: 'heavyAttack', base: DEFAULT_MOVE_WINDOWS.heavyAttack },
  lowKick: { state: 'lightKick', base: DEFAULT_MOVE_WINDOWS.lightKick },
  highKick: { state: 'heavyKick', base: DEFAULT_MOVE_WINDOWS.heavyKick },
  forwardLight: { state: 'lightAttack', base: DEFAULT_MOVE_WINDOWS.lightAttack },
  forwardHeavy: { state: 'heavyAttack', base: DEFAULT_MOVE_WINDOWS.heavyAttack },
  forwardLowKick: { state: 'lightKick', base: DEFAULT_MOVE_WINDOWS.lightKick },
  forwardHighKick: { state: 'heavyKick', base: DEFAULT_MOVE_WINDOWS.heavyKick },
  backLight: { state: 'lightAttack', base: DEFAULT_MOVE_WINDOWS.lightAttack },
  backHeavy: { state: 'heavyAttack', base: DEFAULT_MOVE_WINDOWS.heavyAttack },
  backLowKick: { state: 'lightKick', base: DEFAULT_MOVE_WINDOWS.lightKick },
  backHighKick: { state: 'heavyKick', base: DEFAULT_MOVE_WINDOWS.heavyKick },
  downForwardLight: { state: 'crouchLightAttack', base: CROUCH_MOVE_WINDOWS.crouchLightAttack },
  downForwardHeavy: { state: 'crouchHeavyAttack', base: CROUCH_MOVE_WINDOWS.crouchHeavyAttack },
};

const HEAVY_STATES = new Set<FighterMotionState>(['heavyAttack', 'heavyKick', 'crouchHeavyAttack']);

function finalize(w: MoveWindow, startupF: number, activeF: number, recoveryF: number): MoveWindow {
  return {
    ...w,
    startup: startupF / 60,
    active: activeF / 60,
    recovery: recoveryF / 60,
    hitboxStartFrame: startupF,
    hitboxEndFrame: startupF + activeF,
    totalFrames: startupF + activeF + recoveryF,
  };
}

/**
 * Catalog damage is on a small scale (jab 8, cross 16, uppercut 28, hook 22);
 * the engine's basics are jab 80 / heavy punch 150 / heavy kick 170. A linear
 * ×10 made an uppercut 280 — nearly two heavy kicks. 6x+30 lands jab 78,
 * cross 126, hook 162, uppercut 198, keeping the catalog's ORDER and the
 * engine's SCALE.
 */
export const catalogDamageToEngine = (d: number) => d * 6 + 30;

/**
 * Catalog move (frames, small-scale damage) + style → engine MoveWindow.
 * Frames are clamped to the lineage envelope the engine basics already obey:
 * startup ≥ 10 (i10 jab), active 2–6.
 */
export function catalogWindowForStyle(move: BrutalFistMove, state: FighterMotionState, base: MoveWindow, style: ResolvedStyle): MoveWindow {
  const t = style.tuning;
  const startupF = Math.round(clamp(move.startup + 7 + t.startupFrames, 10, 30));
  const activeF = Math.round(clamp(move.active + 1 + t.activeFrames, 2, 6));
  const recoveryF = Math.round(clamp(move.recovery + t.recoveryFrames, 6, 60));
  const damage = Math.round(catalogDamageToEngine(move.damage) * t.damage);
  const catalogLaunch = move.hitbox?.launch ?? 0;
  const launch = catalogLaunch > 0 ? catalogLaunch + t.launch : 0;
  const lowState = state === 'crouchLightAttack' || state === 'crouchHeavyAttack';
  const attackLevel: MoveWindow['attackLevel'] = lowState || move.low ? 'low' : move.mid || move.overhead ? 'mid' : (base.attackLevel ?? 'high');
  const reaction = launch >= 0.5 ? 'Flight' : damage >= 170 ? (attackLevel === 'low' ? 'StrongLow' : 'StrongMid') : undefined;
  const w: MoveWindow = {
    ...base,
    animation: state,
    damage,
    onBlock: Math.round((move.blockAdvantage ?? base.onBlock ?? 0) + t.onBlock),
    hitstun: +clamp(((move.hitstun ?? 18) / 60) * t.hitstun, 0.18, 0.65).toFixed(3),
    pushback: +((move.pushback ?? 0.5) * t.pushback).toFixed(3),
    launch: +launch.toFixed(3),
    contactReach: +clamp(move.maxRange * 0.45 * t.reach, 0.45, 1.2).toFixed(3),
    attackLevel,
    ...(reaction ? { reaction } : {}),
    ...(t.armorHeavy && HEAVY_STATES.has(state) ? { defence: [powerCrushWindow(startupF)] } : { defence: undefined }),
    specialName: move.displayName,
    clip: undefined,
  };
  return finalize(w, startupF, activeF, recoveryF);
}

/** Base engine window (seconds) + style, for slots with no catalog move (crouch). */
export function baseWindowForStyle(base: MoveWindow, style: ResolvedStyle): MoveWindow {
  const t = style.tuning;
  const startupF = Math.round(clamp(base.startup * 60 + t.startupFrames, 10, 30));
  const activeF = Math.round(clamp(base.active * 60 + t.activeFrames, 2, 6));
  const recoveryF = Math.round(clamp(base.recovery * 60 + t.recoveryFrames, 6, 60));
  return finalize({
    ...base,
    damage: Math.round((base.damage ?? 80) * t.damage),
    onBlock: Math.round((base.onBlock ?? 0) + t.onBlock),
    hitstun: +clamp((0.22 + (base.damage ?? 80) / 700) * t.hitstun, 0.18, 0.65).toFixed(3),
    pushback: +(0.35 * t.pushback).toFixed(3),
  }, startupF, activeF, recoveryF);
}

const BUTTON_SLOT: Record<StringButton, CharacterMoveClipSlot> = {
  lp: 'lightAttack', rp: 'heavyAttack', lk: 'lowKick', rk: 'highKick',
};

/** Attach the style's neutral string to the opener's window. */
function attachNeutralString(windows: Partial<Record<CharacterMoveClipSlot, MoveWindow>>, style: ResolvedStyle): void {
  const steps = style.tuning.neutralString;
  if (steps.length < 2) return;
  // Build from the END so each step owns only its successor.
  let next: MoveWindow | null = null;
  for (let i = steps.length - 1; i >= 1; i--) {
    const src = windows[BUTTON_SLOT[steps[i]]];
    if (!src) return;
    const startupF = Math.max(10, Math.round(src.startup * 60) - 3);
    const activeF = Math.round(src.active * 60);
    const recoveryF = Math.round(src.recovery * 60);
    const isEnder = i === steps.length - 1;
    let step: MoveWindow = finalize({
      ...src,
      specialName: `${src.specialName ?? 'String'} (${i + 1}/${steps.length})`,
      ...(isEnder ? { reaction: style.tuning.enderReaction, damage: Math.round((src.damage ?? 80) * 1.1) } : {}),
      stringFollowups: undefined,
    }, startupF, activeF, recoveryF);
    if (next) {
      step = { ...step, stringFollowups: [{ button: steps[i + 1], from: (step.startup + step.active) * CANCEL_OPENS_AT, to: step.startup + step.active + step.recovery, next }] };
    }
    next = step;
  }
  const openerSlot = BUTTON_SLOT[steps[0]];
  const opener = windows[openerSlot];
  if (!opener || !next) return;
  windows[openerSlot] = {
    ...opener,
    stringFollowups: [{ button: steps[1], from: (opener.startup + opener.active) * CANCEL_OPENS_AT, to: opener.startup + opener.active + opener.recovery, next }],
  };
}

export function resolveRosterMoveWindows(fighterId: string): RosterMoveResolution | null {
  const fighter = getBannonFighter(fighterId);
  const set = getCharacterMoveSet(fighterId);
  if (!fighter || !set) return null;
  const style = resolveStyle(fighter.id, { speed: fighter.speed, strength: fighter.strength });
  if (!style) return null;
  const clips = ROSTER_STYLE_CLIPS[fighter.id] ?? null;
  const windows: Partial<Record<CharacterMoveClipSlot, MoveWindow>> = {};
  const ids: Partial<Record<CharacterMoveClipSlot, string>> = {};
  const provenance: SlotProvenance[] = [];

  for (const [slot, sem] of Object.entries(SLOT_SEMANTIC) as Array<[CharacterMoveClipSlot, { state: FighterMotionState; base: MoveWindow }]>) {
    const moveId = (set as unknown as Record<string, string | undefined>)[slot];
    const move = moveId ? getMoveById(moveId) : null;
    // A slot that resolves to a non-attack (throw/counter/combo used as a
    // directional default) keeps the style-tuned engine default rather than
    // borrowing a grapple's frame data for a strike.
    const usable = move && (move.category === 'strike' || move.category === 'kick' || move.category === 'combo' || move.category === 'counter' || move.category === 'signature') && !move.throw;
    const w = usable ? catalogWindowForStyle(move!, sem.state, sem.base, style) : baseWindowForStyle(sem.base, style);
    // NEUTRAL SAFETY LAW: the original authored LP/RP/LK/RK animations are
    // already the known-good baseline. The large style-intake bank is allowed
    // to expand directional moves, but it must not replace a certified basic
    // punch/kick merely because a candidate passed static measurements.
    // Visual certification belongs to the PWA/runtime pass, not this table.
    const directionalSlot = /^forward|^back|^downForward/.test(slot);
    const candidateClip = (clips as Record<string, string | null> | null)?.[slot] ?? null;
    const clip = directionalSlot ? candidateClip : null;
    windows[slot] = clip ? { ...w, clip } : w;
    if (moveId) ids[slot] = moveId;
    provenance.push({ slot, moveId: usable ? moveId! : null, clip, clipStatus: clip ? 'STYLE_CLIP' : 'MISSING_CLIP' });
  }
  for (const [slot, base] of [['crouchLight', CROUCH_MOVE_WINDOWS.crouchLightAttack], ['crouchKick', CROUCH_MOVE_WINDOWS.crouchHeavyAttack]] as const) {
    const w = baseWindowForStyle(base, style);
    // Crouch basics remain on the authored semantic baseline until a visual
    // PWA certification promotes a replacement.
    const clip = null;
    windows[slot] = w;
    provenance.push({ slot, moveId: null, clip, clipStatus: clip ? 'STYLE_CLIP' : 'MISSING_CLIP' });
  }
  attachNeutralString(windows, style);
  return {
    fighterId: fighter.id,
    style: `${style.primary}/${style.secondary}`,
    windows,
    ids,
    provenance,
    neutralString: style.tuning.neutralString,
  };
}
