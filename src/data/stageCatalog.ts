// `.ts` extensions on purpose — the repo's test runner resolves them literally.
import {
  ALL_STAGE_IDS, STAGE_CONFIGS, stageBuildStatus,
  type StageBuildStatus, type StageConfig, type StageId,
} from '../engine/combat/StageConfig.ts';

/**
 * THE SELECTABLE STAGE CATALOGUE — every stage the game can load.
 *
 * This file used to list two stages (Training Grid, Urban Night) with its own
 * ids ('training-grid', 'urban-night') that nothing else in the engine used,
 * while StageSelectScreen kept a second, hand-typed list of 15. Now there is
 * one list and it is DERIVED from STAGE_CONFIGS, so a stage added to the
 * engine is selectable the moment it exists, and a stage cannot be selectable
 * without a config behind it.
 */

export type BrutalFistStageId = StageId;

export interface BrutalFistStageDefinition {
  id: BrutalFistStageId;
  name: string;
  shortName: string;
  subtitle: string;
  description: string;
  accent: string;
  bgColor: string;
  badges: string[];
  /** PROCEDURAL (original primitive build) or BLOCKOUT (canon greybox, not final art). */
  buildStatus: StageBuildStatus | 'RANDOM';
  previewKind: 'procedural';
}

/** Hand-written flavour text; everything else is read off the config. */
const DESCRIPTIONS: Partial<Record<Exclude<StageId, 'random'>, string>> = {
  urban_night: 'Neon-lit back alleys. Wall splats welcome.',
  training: 'Infinite void. Perfect for practice.',
  dojo: 'Slam opponents through the wooden floor to the lower dojo.',
  wrestling_ring: 'Throw them over the ropes for a ring-out KO.',
  mma_octagon: 'Eight-sided cage. No escape from wall splats.',
  steel_cage: 'Cold steel walls. Every slam echoes.',
  industrial: 'Break through the catwalk into molten metal below.',
  ghetto_streets: 'Open streets. No boundaries. Ring-out anywhere.',
  junkyard: 'Crash through scrap piles to the lower yard.',
  sky_crane: 'Narrow crane platform high above the city. One slip = ring-out.',
  spike_pit: 'Slam them through the floor into the spike pit below.',
  acid_pit: 'Break the bridge. Watch them dissolve in the acid pool.',
  grinder_pit: 'Catwalk above spinning industrial grinders. One slam ends it.',
  gang_brawl: 'Open streets, multi-level chaos. Anything goes.',
  subway: 'Fight on the platform or the tracks. The train runs on its own schedule — no warnings, just chaos.',
  black_swamp: 'Fog, mud and a gothic ruin on the Island. Fallen cypress logs wall the flats.',
  jpcw_arena: 'Tokyo\'s corporate wrestling cathedral. 7 m ring, big screens, ring-out over the ropes.',
  club_onyx: 'Miami\'s underground club. Neon dance floor, VIP rails for walls, the pole in the corner.',
  kennedy_debate: 'A presidential debate stage at the Kennedy Center. Podiums, pyro, live cameras.',
  void_ring: 'A ring floating in nothing. Go over the ropes and there is no floor.',
  aztec_temple: 'Stone floor between temple pillars, a stepped pyramid and braziers behind.',
  parking_lot: 'Concrete deck, parked cars and sodium lamps. The cars are the walls.',
  banyan_tree: 'The Mother Tree of Sector 7. A 60 x 60 m clearing walled by its roots, lit by fungi.',
};

function badgesFor(cfg: StageConfig): string[] {
  const b: string[] = [];
  if (stageBuildStatus(cfg) === 'BLOCKOUT') b.push('BLOCKOUT');
  if (cfg.levels.length > 1) b.push(`${cfg.levels.length} LEVELS`);
  if (cfg.breakableFloor) b.push('BREAKABLE');
  if (cfg.ringOutEnabled) b.push('RING OUT');
  if (cfg.hasWalls) b.push('WALLS'); else b.push('NO WALLS');
  if (!Number.isFinite(cfg.boundaryX)) b.push('OPEN');
  if (cfg.hazardLabel) b.push(cfg.hazardLabel);
  if (cfg.hasTrainHazard) b.push('VAULT ESCAPE');
  return b;
}

function shortName(name: string): string {
  const words = name.replace(/^THE\s+/, '').split(/\s+/);
  return (words[words.length - 1] ?? name).slice(0, 8);
}

export const RANDOM_STAGE: BrutalFistStageDefinition = {
  id: 'random', name: 'RANDOM', shortName: '?', subtitle: 'FATE DECIDES',
  description: 'Let the arena choose your fate.', accent: '#f59e0b', bgColor: '#1c1400',
  badges: [], buildStatus: 'RANDOM', previewKind: 'procedural',
};

/** Every concrete stage, in engine catalogue order. */
export const SELECTABLE_STAGES: readonly BrutalFistStageDefinition[] = ALL_STAGE_IDS.map((id) => {
  const cfg = STAGE_CONFIGS[id];
  return {
    id,
    name: cfg.name,
    shortName: shortName(cfg.name),
    subtitle: cfg.subtitle,
    description: DESCRIPTIONS[id] ?? cfg.subtitle,
    accent: cfg.accentColor,
    bgColor: cfg.bgColor,
    badges: badgesFor(cfg),
    buildStatus: stageBuildStatus(cfg),
    previewKind: 'procedural',
  };
});

/** RANDOM first, then every stage — what the select screen shows. */
export const BRUTAL_FIST_STAGES: readonly BrutalFistStageDefinition[] = [RANDOM_STAGE, ...SELECTABLE_STAGES];

export function resolveStageId(id: BrutalFistStageId, rand: () => number = Math.random): Exclude<StageId, 'random'> {
  if (id !== 'random') return id;
  return ALL_STAGE_IDS[Math.floor(rand() * ALL_STAGE_IDS.length) % ALL_STAGE_IDS.length];
}
