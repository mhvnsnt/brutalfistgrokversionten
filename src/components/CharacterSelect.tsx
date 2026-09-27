'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { getAllBannonFighters, getBannonFighter, type BannonFighterProfile } from '../data/bannonRoster';
import { getPlayableAttires } from '../data/bannonGlbRoster';
import { resolveGlbUrl } from '../data/bannonGlbUrl';
import { getCharacterMoveSet } from '../engine/CharacterMoveSetSystem';
import { cardArtUrlFor, getCardArtStyle, setCardArtStyle, CARD_ART_LABELS, type CardArtStyle } from '../lib/cardArt';
import { getGraphicsQuality, setGraphicsQuality, GRAPHICS_QUALITY_LABELS, type GraphicsQuality } from '../lib/graphicsSettings';
import { warmupImages, warmupGLTF } from '../engine/pipeline/glbCache';
import CharacterPortrait3D from './CharacterPortrait3D';
import dynamic from 'next/dynamic';

const MoveSetCustomizer = dynamic(() => import('./MoveSetCustomizer'), { ssr: false });

interface CharacterSelectProps {
  onSelectP1?: (fighter: BannonFighterProfile) => void;
  onSelectP2?: (fighter: BannonFighterProfile) => void;
  onStartMatch?: (p1: BannonFighterProfile, p2: BannonFighterProfile) => void;
}

const FACTION_COLOR: Record<string, string> = {
  alliance:    '#1d4ed8',
  corporate:   '#dc2626',
  chaos:       '#7c3aed',
  independent: '#d97706',
};

const FACTION_BG: Record<string, string> = {
  alliance:    'from-blue-950 to-blue-900',
  corporate:   'from-red-950 to-red-900',
  chaos:       'from-purple-950 to-purple-900',
  independent: 'from-yellow-950 to-yellow-900',
};

/** Deduplicated character list — one entry per unique character id */
function getUniqueCharacters(fighters: readonly BannonFighterProfile[]): BannonFighterProfile[] {
  const seen = new Set<string>();
  const result: BannonFighterProfile[] = [];
  for (const f of fighters) {
    if (!seen.has(f.id)) {
      seen.add(f.id);
      result.push(f);
    }
  }
  return result;
}

/** Get all attires for a character from the GLB roster */
function getCharacterAttires(characterId: string): Array<{ attire: string; model: string; portraitUrl: string }> {
  const entries = getPlayableAttires(characterId);
  if (entries.length === 0) return [];
  return entries.map(e => ({
    attire: e.attire ?? 'Default',
    model: e.model,
    portraitUrl: resolveGlbUrl(e.model, e.overrideUrl),
  }));
}

// ── Large portrait panel (P1 or P2 side) ─────────────────────────────────────
function FighterPortrait({
  fighter,
  attirePortraitUrl,
  slot,
  active,
}: {
  fighter: BannonFighterProfile | null;
  attirePortraitUrl?: string;
  slot: 'P1' | 'P2';
  active: boolean;
}) {
  const isP1 = slot === 'P1';

  if (!fighter) {
    return (
      <div className={`relative flex flex-col items-center justify-end h-full w-full overflow-hidden`}>
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-900 to-zinc-950" />
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.4) 2px, rgba(0,0,0,0.4) 4px)'
        }} />
        <div className="relative z-10 flex flex-col items-center justify-center h-full w-full gap-3 px-6">
          <div className="bf-plate px-5 py-4 text-center">
            <div className="bf-prompt text-3xl">{isP1 ? 'SELECT FIGHTER' : 'PUSH P2 START'}</div>
          </div>
        </div>
        <div className={`absolute top-3 ${isP1 ? 'left-3' : 'right-3'} z-20`}>
          <span className={`bf-side ${isP1 ? 'bf-side-p1' : 'bf-side-p2'}`}>{slot}</span>
        </div>
      </div>
    );
  }

  const factionBg = FACTION_BG[fighter.factionAlignment];
  const factionColor = FACTION_COLOR[fighter.factionAlignment];
  const concept = cardArtUrlFor(fighter.id, {
    likenessUrl: fighter.likenessUrl,
    paintedUrl: fighter.paintedUrl,
    conceptArtUrl: fighter.conceptArtUrl,
    pixelPortrait: fighter.pixelPortrait,
    selectMugUrl: fighter.selectMugUrl,
    gridPortrait: fighter.gridPortrait,
  });
  const portraitUrl = attirePortraitUrl ?? fighter.portraitUrl;

  return (
    <div className="relative flex flex-col items-center justify-end h-full w-full overflow-hidden">
      <div className={`absolute inset-0 bg-gradient-to-b ${factionBg}`} />
      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.4) 2px, rgba(0,0,0,0.4) 4px)'
      }} />
      <div className="absolute inset-0 animate-pulse opacity-20 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at center, ${factionColor}55 0%, transparent 70%)` }}
      />
      <div className="absolute inset-0 z-[1]">
        <img
          src={concept}
          alt=""
          draggable={false}
          className="h-full w-full object-cover object-top opacity-80"
          style={{ imageRendering: "auto" }}
          onError={(e) => {
            const el = e.currentTarget;
            const step = Number(el.dataset.fallback ?? '0');
            const current = el.getAttribute('src') ?? '';
            const chain = [
              `/portraits/concept/${fighter.id}.jpg?v=ai3`,
              `/portraits/concept/${fighter.id}.jpg`,
              `/portraits/likeness/${fighter.id}.png`,
              `/portraits/painted/${fighter.id}.jpg`,
              `/portraits/select/${fighter.id}.jpg`,
              `/portraits/concept/${fighter.id}.png`,
              `/portraits/${fighter.id}.png`,
            ];
            for (let i = step; i < chain.length; i++) {
              if (!current.endsWith(chain[i].slice(chain[i].lastIndexOf('/')))) {
                el.dataset.fallback = String(i + 1);
                el.src = chain[i];
                return;
              }
            }
          }}
        />
      </div>
      <div className="absolute inset-0 z-10">
        <CharacterPortrait3D
          modelUrl={portraitUrl}
          factionColor={factionColor}
          mode="bust"
          side={isP1 ? 1 : -1}
        />
      </div>
      <div className="relative z-20 w-full flex justify-center pb-3 pointer-events-none">
        <div className="bf-plate px-3 py-1 text-[0.7rem] tracking-[0.22em] uppercase text-[var(--color-fg)]">
          {fighter.role.split('/')[0].trim()}
        </div>
      </div>
      <div className={`absolute top-3 ${isP1 ? 'left-3' : 'right-3'} z-30`}>
        <span className={`bf-side ${isP1 ? 'bf-side-p1' : 'bf-side-p2'}`}>{slot}</span>
      </div>
      {active && (
        <div className="absolute inset-0 z-20 pointer-events-none border-2 animate-pulse"
          style={{ borderColor: factionColor }}
        />
      )}
    </div>
  );
}

// ── Attire selector strip (shown below portrait when a character is selected) ─
function CardArtPicker({ characterId }: { characterId: string }) {
  const [, bump] = useState(0);
  const current = getCardArtStyle(characterId);
  const styles: CardArtStyle[] = ['likeness', 'painted', 'concept', 'pixel'];
  return (
    <div className="flex flex-wrap items-center gap-1 px-2 py-1">
      <span className="text-[10px] tracking-[0.18em] text-[var(--color-muted)]">CARD</span>
      {styles.map((style) => (
        <button
          key={style}
          type="button"
          onClick={() => { setCardArtStyle(characterId, style); bump((n) => n + 1); }}
          className={`bf-chip ${current === style ? 'on' : ''}`}
        >
          {CARD_ART_LABELS[style]}
        </button>
      ))}
    </div>
  );
}

function GraphicsQualityBar({
  quality,
  onChange,
}: {
  quality: GraphicsQuality;
  onChange: (q: GraphicsQuality) => void;
}) {
  const modes: GraphicsQuality[] = ['ps1', 'retro8', 'native'];
  return (
    <div className="flex items-center gap-1">
      {modes.map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => {
            setGraphicsQuality(mode);
            onChange(mode);
          }}
          className={`bf-chip ${quality === mode ? 'on' : ''}`}
        >
          {GRAPHICS_QUALITY_LABELS[mode]}
        </button>
      ))}
    </div>
  );
}

function AttireSelector({
  characterId,
  selectedAttire,
  onSelectAttire,
  slot,
}: {
  characterId: string;
  selectedAttire: string;
  onSelectAttire: (attire: string, portraitUrl: string) => void;
  slot: 'P1' | 'P2';
}) {
  const attires = useMemo(() => getCharacterAttires(characterId), [characterId]);
  if (attires.length <= 1) return null;
  const isP1 = slot === 'P1';

  return (
    <div className={`flex gap-1 px-2 py-1 ${isP1 ? 'justify-start' : 'justify-end'}`}>
      {attires.map((a) => (
        <button
          key={a.model}
          onClick={() => onSelectAttire(a.attire, a.portraitUrl)}
          className={`bf-chip truncate max-w-[96px] ${
            selectedAttire === a.attire ? (isP1 ? 'on-p1' : 'on-p2') : ''
          }`}
          title={a.attire}
        >
          {a.attire.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

// ── Single character slot in the Tekken-style roster grid ────────────────────
function RosterSlot({
  fighter,
  p1Selected,
  p2Selected,
  cursorOn,
  onClick,
}: {
  fighter: BannonFighterProfile;
  p1Selected: boolean;
  p2Selected: boolean;
  cursorOn: boolean;
  onClick: () => void;
}) {
  const moveSet = useMemo(() => getCharacterMoveSet(fighter.id), [fighter.id]);
  const isCustomized = moveSet?.isCustomized ?? false;
  const face = cardArtUrlFor(fighter.id, {
    likenessUrl: fighter.likenessUrl,
    paintedUrl: fighter.paintedUrl,
    conceptArtUrl: fighter.conceptArtUrl,
    pixelPortrait: fighter.pixelPortrait,
    selectMugUrl: fighter.selectMugUrl,
    gridPortrait: fighter.gridPortrait,
  });

  return (
    <button
      onClick={onClick}
      className={`bf-slot relative flex flex-col items-center justify-center w-full aspect-square overflow-hidden group
        ${cursorOn ? 'scale-105 z-10' : 'scale-100'}
      `}
      style={{
        background: '#140f0c',
        boxShadow: cursorOn
          ? '0 0 0 2px #e23d2b, 0 10px 18px rgba(0,0,0,0.45)'
          : p1Selected
            ? 'inset 0 0 0 2px #7ec8c3'
            : p2Selected
              ? 'inset 0 0 0 2px #e08a6d'
              : 'inset 0 0 0 1px rgba(243,234,223,0.16)',
      }}
    >
      {/* High-res concept plate — Tekken-style HQ mug, never the in-game pixel sprite */}
      <img
        src={face}
        alt=""
        draggable={false}
        className="absolute inset-0 z-0 w-full h-full object-cover object-top"
        style={{ imageRendering: "auto" }}
        onError={(e) => {
          const el = e.currentTarget;
          const step = Number(el.dataset.fallback ?? '0');
          const current = el.getAttribute('src') ?? '';
          const chain = [
            `/portraits/concept/${fighter.id}.jpg?v=ai3`,
            `/portraits/concept/${fighter.id}.jpg`,
            `/portraits/likeness/${fighter.id}.png`,
            `/portraits/painted/${fighter.id}.jpg`,
            `/portraits/select/${fighter.id}.jpg`,
            `/portraits/concept/${fighter.id}.png`,
            `/portraits/${fighter.id}.png`,
          ];
          for (let i = step; i < chain.length; i++) {
            if (!current.endsWith(chain[i].slice(chain[i].lastIndexOf('/')))) {
              el.dataset.fallback = String(i + 1);
              el.src = chain[i];
              return;
            }
          }
        }}
      />

      {/* Scanlines over the sprite */}
      <div className="absolute inset-0 z-[1] opacity-[0.08] pointer-events-none" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,0,0,0.55) 1px, rgba(0,0,0,0.55) 2px)'
      }} />

      {/* Name label overlay */}
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-[rgba(16,12,10,0.82)] py-0.5">
        <div className="bf-slot-name truncate w-full text-center px-1">
          {fighter.name.toUpperCase()}
        </div>
      </div>
      {p1Selected && (
        <div className="bf-side bf-side-p1 absolute top-0.5 left-0.5 z-20 text-sm">P1</div>
      )}
      {p2Selected && (
        <div className="bf-side bf-side-p2 absolute top-0.5 right-0.5 z-20 text-sm">P2</div>
      )}
      {/* Customized dot */}
      {isCustomized && (
        <div className="absolute bottom-4 right-0.5 z-20 w-1.5 h-1.5 rounded-full bg-green-400" />
      )}
    </button>
  );
}

// ── Main CharacterSelect ──────────────────────────────────────────────────────
export default function CharacterSelect({ onSelectP1, onSelectP2, onStartMatch }: CharacterSelectProps) {
  const allFighters = useMemo(() => getAllBannonFighters(), []);
  // Deduplicated: one slot per character
  const characters = useMemo(() => getUniqueCharacters(allFighters), [allFighters]);

  const [p1Id, setP1Id] = useState<string | null>(null);
  const [p2Id, setP2Id] = useState<string | null>(null);
  // Selected attires per slot
  const [p1Attire, setP1Attire] = useState<string>('Default');
  const [p2Attire, setP2Attire] = useState<string>('Default');
  const [p1PortraitUrl, setP1PortraitUrl] = useState<string | undefined>(undefined);
  const [p2PortraitUrl, setP2PortraitUrl] = useState<string | undefined>(undefined);

  const [activeSlot, setActiveSlot] = useState<'p1' | 'p2'>('p1');
  const [cursorIndex, setCursorIndex] = useState(0);
  const [countdown, setCountdown] = useState(60);
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [customizerCharId, setCustomizerCharId] = useState<string | null>(null);
  const [, setMugTick] = useState(0);
  const [quality, setQuality] = useState<GraphicsQuality>(getGraphicsQuality());

  useEffect(() => {
    warmupImages(characters.map((f) => `/portraits/concept/${f.id}.jpg?v=ai3`));
    void import('./StageSelectScreen');
    void import('./GameBattleArena');
    void import('./CharacterPortrait3D');
  }, [characters]);

  useEffect(() => {
    const bump = () => setMugTick((n) => n + 1);
    window.addEventListener("bf-select-mugs", bump);
    window.addEventListener("storage", bump);
    window.addEventListener("bf-card-art", bump);
    return () => {
      window.removeEventListener("bf-select-mugs", bump);
      window.removeEventListener("storage", bump);
      window.removeEventListener("bf-card-art", bump);
    };
  }, []);

  useEffect(() => {
    if (p1Id) {
      const attires = getCharacterAttires(p1Id);
      const matched = attires.find((a) => a.attire === p1Attire) ?? attires[0];
      if (matched) setP1PortraitUrl(matched.portraitUrl);
    }
    if (p2Id) {
      const attires = getCharacterAttires(p2Id);
      const matched = attires.find((a) => a.attire === p2Attire) ?? attires[0];
      if (matched) setP2PortraitUrl(matched.portraitUrl);
    }
  }, [quality, p1Id, p2Id, p1Attire, p2Attire]);

  const p1Fighter = p1Id ? getBannonFighter(p1Id) : null;
  const p2Fighter = p2Id ? getBannonFighter(p2Id) : null;
  const cursorFighter = characters[cursorIndex] ?? null;

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) {
      if (!p1Id && characters.length > 0) setP1Id(characters[0].id);
      if (!p2Id && characters.length > 1) setP2Id(characters[1].id);
      return;
    }
    const t = window.setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [countdown, p1Id, p2Id, characters]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const cols = 9;
    if (e.key === 'ArrowRight') setCursorIndex(i => Math.min(characters.length - 1, i + 1));
    else if (e.key === 'ArrowLeft') setCursorIndex(i => Math.max(0, i - 1));
    else if (e.key === 'ArrowDown') setCursorIndex(i => Math.min(characters.length - 1, i + cols));
    else if (e.key === 'ArrowUp') setCursorIndex(i => Math.max(0, i - cols));
    else if (e.key === 'Enter' || e.key === ' ') {
      if (cursorFighter) handleFighterSelect(cursorFighter);
    }
  }, [cursorIndex, characters, cursorFighter]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleFighterSelect = (fighter: BannonFighterProfile) => {
    const attires = getCharacterAttires(fighter.id);
    const matched = attires.find(a => a.model === fighter.model) ?? attires[0];
    const defaultAttire = matched?.attire ?? fighter.attire ?? 'Default';
    const defaultPortrait = matched?.portraitUrl ?? fighter.portraitUrl;

    if (activeSlot === 'p1') {
      setP1Id(fighter.id);
      setP1Attire(defaultAttire);
      setP1PortraitUrl(defaultPortrait);
      if (onSelectP1) onSelectP1(fighter);
      setActiveSlot('p2');
      warmupGLTF(defaultPortrait);
      if (!p2Id) {
        const cpu = characters.find((c) => c.id !== fighter.id) ?? characters[1] ?? characters[0];
        if (cpu) {
          const cpuAttires = getCharacterAttires(cpu.id);
          const cpuMatch = cpuAttires.find((a) => a.model === cpu.model) ?? cpuAttires[0];
          setP2Id(cpu.id);
          setP2Attire(cpuMatch?.attire ?? cpu.attire ?? 'Default');
          setP2PortraitUrl(cpuMatch?.portraitUrl ?? cpu.portraitUrl);
          if (onSelectP2) onSelectP2(cpu);
          warmupGLTF(cpuMatch?.portraitUrl ?? cpu.portraitUrl);
        }
      }
    } else {
      setP2Id(fighter.id);
      setP2Attire(defaultAttire);
      setP2PortraitUrl(defaultPortrait);
      if (onSelectP2) onSelectP2(fighter);
      warmupGLTF(defaultPortrait);
    }
  };

  const handleStartMatch = () => {
    const f1 = p1Id ? getBannonFighter(p1Id) : null;
    const f2 = p2Id ? getBannonFighter(p2Id) : null;
    if (f1 && f2 && onStartMatch) {
      const a1 = getCharacterAttires(f1.id).find(a => a.attire === p1Attire);
      const a2 = getCharacterAttires(f2.id).find(a => a.attire === p2Attire);
      onStartMatch(
        { ...f1, attire: p1Attire, model: a1?.model ?? f1.model, portraitUrl: p1PortraitUrl || f1.portraitUrl },
        { ...f2, attire: p2Attire, model: a2?.model ?? f2.model, portraitUrl: p2PortraitUrl || f2.portraitUrl },
      );
    }
  };

  const canStart = !!(p1Id && p2Id);

  // Tekken-3 block grid: 9 columns × 3 rows = 27 (Bannon roster + Finxsse + Tarzanian Devil)
  const SLOTS_PER_ROW = 9;
  const rosterRows: BannonFighterProfile[][] = [];
  for (let i = 0; i < characters.length; i += SLOTS_PER_ROW) {
    rosterRows.push(characters.slice(i, i + SLOTS_PER_ROW));
  }

  return (
    <div className="bf-select fixed inset-0 screen-safe overflow-hidden select-none flex flex-col">
      {/* ── Industrial metallic background texture ── */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.07]" style={{
        backgroundImage: `
          repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 40px),
          repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 40px)
        `
      }} />
      <div className="absolute inset-0 pointer-events-none opacity-20" style={{
        backgroundImage: 'radial-gradient(circle, #555 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />

      {/* ── PLAYER SELECT watermark ── */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
        <div className="bf-display text-[8vw] tracking-[0.2em] text-[var(--color-fg)] uppercase select-none"
          style={{ opacity: 0.05 }}
        >
          PLAYER SELECT
        </div>
      </div>

      {/* ── TOP ZONE: Two player portrait busts (fills remaining space above grid) ── */}
      <div className="relative z-10 flex flex-1 min-h-0">
        {/* P1 Portrait + attire strip */}
        <div className="flex flex-col flex-1 border-r border-zinc-800/60 min-w-0">
          <div className="flex-1 min-h-0">
            <FighterPortrait fighter={p1Fighter} attirePortraitUrl={p1PortraitUrl} slot="P1" active={activeSlot === 'p1'} />
          </div>
          {p1Fighter && (
            <>
              <AttireSelector
                characterId={p1Fighter.id}
                selectedAttire={p1Attire}
                onSelectAttire={(attire, url) => { setP1Attire(attire); setP1PortraitUrl(url); }}
                slot="P1"
              />
              <CardArtPicker characterId={p1Fighter.id} />
            </>
          )}
        </div>

        {/* Center divider with countdown */}
        <div className="relative flex flex-col items-center justify-center w-14 md:w-18 shrink-0 z-20"
          style={{ background: 'linear-gradient(180deg, #0a0a0a 0%, #111 50%, #0a0a0a 100%)' }}
        >
          <div className="absolute top-2 left-1/2 -translate-x-1/2 flex flex-col items-center gap-0.5">
            {'PLAYER SELECT'.split('').map((ch, i) => (
              <span key={i} className="text-[6px] text-zinc-600 font-black tracking-widest leading-tight">{ch}</span>
            ))}
          </div>
          <div className="flex flex-col items-center mt-4">
            <div className="bf-timer">{String(countdown).padStart(2, '0')}</div>
            <div className="text-[7px] text-zinc-600 tracking-widest mt-0.5">TIME</div>
          </div>
          <div className="mt-3 text-xs font-black text-zinc-700 tracking-widest">VS</div>
        </div>

        {/* P2 Portrait + attire strip */}
        <div className="flex flex-col flex-1 border-l border-zinc-800/60 min-w-0">
          <div className="flex-1 min-h-0">
            <FighterPortrait fighter={p2Fighter} attirePortraitUrl={p2PortraitUrl} slot="P2" active={activeSlot === 'p2'} />
          </div>
          {p2Fighter && (
            <>
              <AttireSelector
                characterId={p2Fighter.id}
                selectedAttire={p2Attire}
                onSelectAttire={(attire, url) => { setP2Attire(attire); setP2PortraitUrl(url); }}
                slot="P2"
              />
              <CardArtPicker characterId={p2Fighter.id} />
            </>
          )}
        </div>
      </div>

      {/* ── CHARACTER NAME BAR ── */}
      <div className="relative z-10 flex h-8 border-t border-b border-zinc-800 shrink-0"
        style={{ background: 'linear-gradient(90deg, #0a0a0a 0%, #111 50%, #0a0a0a 100%)' }}
      >
        <div className="flex-1 flex items-center px-4">
          <span className="bf-display text-lg tracking-[0.14em] uppercase truncate">
            {p1Fighter?.name ?? '———'}
          </span>
          {p1Fighter && p1Attire !== 'Default' && (
            <span className="ml-2 text-[9px] text-zinc-500 tracking-widest truncate">{p1Attire.toUpperCase()}</span>
          )}
        </div>
        <div className="w-14 md:w-18 flex items-center justify-center shrink-0">
          <div className="w-px h-full bg-zinc-700" />
        </div>
        <div className="flex-1 flex items-center justify-end px-4">
          {p2Fighter && p2Attire !== 'Default' && (
            <span className="mr-2 text-[9px] text-zinc-500 tracking-widest truncate">{p2Attire.toUpperCase()}</span>
          )}
          <span className="bf-display text-lg tracking-[0.14em] uppercase truncate text-right">
            {p2Fighter?.name ?? '———'}
          </span>
        </div>
      </div>

      {/* ── BOTTOM ZONE: Tekken-style two-row character grid ── */}
      <div className="relative z-10 shrink-0"
        style={{ background: 'linear-gradient(180deg, #0d0d0f 0%, #080808 100%)' }}
      >
        {/* Controls bar */}
        <div className="flex items-center justify-between px-3 py-1 border-b border-zinc-800/50">
          <div className="flex items-center gap-2">
            <span className="text-[8px] text-zinc-600 tracking-[0.3em]">SELECTING FOR</span>
            <span className={`bf-side ${activeSlot === 'p1' ? 'bf-side-p1' : 'bf-side-p2'}`}>
              {activeSlot === 'p1' ? 'PLAYER 1' : 'PLAYER 2'}
            </span>
            <button
              onClick={() => setActiveSlot(activeSlot === 'p1' ? 'p2' : 'p1')}
              className="bf-chip"
            >
              SWITCH
            </button>
          </div>
          <div className="flex items-center gap-2">
            <GraphicsQualityBar quality={quality} onChange={setQuality} />
            {cursorFighter && (
              <button
                onClick={() => { setCustomizerCharId(cursorFighter.id); setCustomizerOpen(true); }}
                className="bf-chip"
              >
                CUSTOMIZE
              </button>
            )}
            {canStart && (
              <button
                onClick={handleStartMatch}
                className="bf-fight"
              >
                FIGHT!
              </button>
            )}
          </div>
        </div>

        {/* Roster rows — Tekken-3 bottom-anchored block grid */}
        <div className="flex flex-col gap-0.5 px-1 py-1">
          {rosterRows.map((row, rowIdx) => (
            <div
              key={`row-${rowIdx}`}
              className="grid gap-0.5"
              style={{ gridTemplateColumns: `repeat(${SLOTS_PER_ROW + 2}, 1fr)` }}
            >
              <button
                type="button"
                className="bf-chip aspect-square min-h-0 p-0"
                onClick={() => {
                  const pick = characters[Math.floor(Math.random() * characters.length)];
                  if (pick) { setCursorIndex(characters.indexOf(pick)); handleFighterSelect(pick); }
                }}
              >
                ?
              </button>
              {row.map((fighter, i) => {
                const index = rowIdx * SLOTS_PER_ROW + i;
                return (
                  <RosterSlot
                    key={fighter.id}
                    fighter={fighter}
                    p1Selected={fighter.id === p1Id}
                    p2Selected={fighter.id === p2Id}
                    cursorOn={cursorIndex === index}
                    onClick={() => { setCursorIndex(index); handleFighterSelect(fighter); }}
                  />
                );
              })}
              {Array.from({ length: Math.max(0, SLOTS_PER_ROW - row.length) }).map((_, i) => (
                <div key={`empty-${rowIdx}-${i}`} className="aspect-square border border-zinc-900/30 bg-zinc-950/30" />
              ))}
              <button
                type="button"
                className="bf-chip aspect-square min-h-0 p-0"
                onClick={() => {
                  const pick = characters[Math.floor(Math.random() * characters.length)];
                  if (pick) { setCursorIndex(characters.indexOf(pick)); handleFighterSelect(pick); }
                }}
              >
                ?
              </button>
            </div>
          ))}
        </div>

        {/* Bottom info bar */}
        <div className="flex items-center justify-between px-3 py-1 border-t border-zinc-800/50">
          <div className="text-[8px] text-zinc-700 tracking-[0.3em]">
            {cursorFighter
              ? `${cursorFighter.name.toUpperCase()} · ${cursorFighter.fightingStyle.split('.')[0].toUpperCase()}`
              : 'MOVE CURSOR TO SELECT'}
          </div>
          <div className="text-[8px] text-zinc-700 tracking-[0.3em]">
            {characters.length} FIGHTERS · BANNON ROSTER
          </div>
        </div>
      </div>

      {/* ── Move Set Customizer overlay ── */}
      {customizerOpen && customizerCharId && (
        <MoveSetCustomizer
          initialCharacterId={customizerCharId}
          onClose={() => setCustomizerOpen(false)}
          onConfirm={() => setCustomizerOpen(false)}
        />
      )}
    </div>
  );
}
