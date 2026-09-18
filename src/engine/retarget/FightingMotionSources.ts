/**
 * External fighting-game motion sources available to Brutal Fist.
 *
 * These are source banks, not replacement character rigs. Imported clips keep
 * their source names and are retargeted onto the native Bannon skeleton by the
 * existing AnimationRetargeter/bind-relative pipeline.
 */
export const FIGHTING_MOTION_SOURCES = [
  {
    id: 'tekken3-recompiled',
    repository: 'mhvnsnt/BrutalfistbaseofTekken3Recompiled',
    kind: 'tekken',
    romSourceManifest: 'config/tekken3-local-source.json',
    romSourceEnv: 'TEKKEN3_SOURCE_DIR',
  },
  {
    id: 'schwarzer-blitz',
    repository: 'mhvnsnt/SchwarzerblitzEngine',
    kind: 'schwarzer-blitz',
  },
] as const;

export type FightingMotionSourceId = (typeof FIGHTING_MOTION_SOURCES)[number]['id'];

export const FIGHTING_MOTION_CATEGORIES = [
  'idle',
  'stance',
  'walk',
  'run',
  'dash',
  'backdash',
  'crouch',
  'sidestep',
  'jump',
  'punch',
  'kick',
  'guard',
  'parry',
  'hit',
  'knockdown',
  'getup',
  'throw',
  'grapple',
  'special',
  'intro',
  'victory',
  'defeat',
] as const;

export type FightingMotionCategory = (typeof FIGHTING_MOTION_CATEGORIES)[number];
