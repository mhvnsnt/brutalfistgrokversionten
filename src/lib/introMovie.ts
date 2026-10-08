/**
 * INTRO FMV — the decisions, kept free of React and the DOM so they can be
 * unit tested under plain `node --test` (see src/lib/introMovie.test.ts).
 *
 * The one rule everything here serves: THE INTRO MUST NEVER BLOCK THE START
 * SCREEN. No manifest, a bad manifest, no playable source, a decode error, a
 * stalled network — every one of them ends in `onDone()` and the title screen
 * exactly as it was before the intro existed.
 *
 * Treatment v2 (docs/intro-movie/TREATMENT.md): 1800 frames at 30fps = 60s,
 * smash to black 1755-1784, bass drop on 1785, `onEnded` at 1800 hands off to
 * the live start screen. The last 45 frames of the file are black, so the
 * handoff is black -> start screen with no flash.
 */

export const INTRO_MANIFEST_PATH = 'intro/intro.json';
/** Set once the intro has actually been played (ended or skipped after it started). */
export const INTRO_SEEN_KEY = 'bf.intro.seen';
/** Player setting: 'always' | 'never' | anything else (= auto: play until seen once). */
export const INTRO_PREF_KEY = 'bf.intro.pref';

export type IntroPref = 'always' | 'never' | 'auto';

export type IntroDecisionReason =
  | 'query-on'
  | 'query-off'
  | 'pref-always'
  | 'pref-never'
  | 'automation'
  | 'reduced-motion'
  | 'seen'
  | 'first-launch';

export interface IntroDecision {
  play: boolean;
  reason: IntroDecisionReason;
}

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface IntroDecisionInput {
  /** `location.search`, e.g. '?intro=1'. */
  search?: string;
  storage?: KeyValueStore | null;
  /** `navigator.webdriver` — Playwright/puppeteer harnesses. */
  webdriver?: boolean;
  /** `prefers-reduced-motion: reduce` (the FMV has white flashes). */
  reducedMotion?: boolean;
}

function safeGet(storage: KeyValueStore | null | undefined, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null; // Safari private mode / disabled storage
  }
}

function safeSet(storage: KeyValueStore | null | undefined, key: string, value: string): void {
  try {
    storage?.setItem(key, value);
  } catch {
    /* storage refused: the intro will simply play again next launch */
  }
}

export function readIntroPref(storage?: KeyValueStore | null): IntroPref {
  const v = safeGet(storage, INTRO_PREF_KEY);
  return v === 'always' || v === 'never' ? v : 'auto';
}

export function writeIntroPref(storage: KeyValueStore | null | undefined, pref: IntroPref): void {
  safeSet(storage, INTRO_PREF_KEY, pref);
}

export function markIntroSeen(storage?: KeyValueStore | null): void {
  safeSet(storage, INTRO_SEEN_KEY, '1');
}

/**
 * Should the intro be attempted at all? Precedence, highest first:
 *   1. ?intro=1 / ?intro=0 (one load only; also on|off|true|false)
 *      ?intro=always|never|auto additionally PERSISTS the setting
 *   2. the stored setting (bf.intro.pref = always | never)
 *   3. automation (navigator.webdriver): skipped so every existing Playwright
 *      harness still lands on the title screen exactly as before
 *   4. prefers-reduced-motion
 *   5. seen once already (bf.intro.seen)
 *   6. otherwise: first launch, play it
 *
 * "Play" only means TRY: the manifest and the video still have to load.
 */
export function decideIntro(input: IntroDecisionInput = {}): IntroDecision {
  const { search = '', storage, webdriver = false, reducedMotion = false } = input;
  let q: string | null = null;
  try {
    q = new URLSearchParams(search).get('intro');
  } catch {
    q = null;
  }
  const qv = q?.trim().toLowerCase() ?? null;
  if (qv === 'always' || qv === 'never' || qv === 'auto') writeIntroPref(storage, qv);
  if (qv === '1' || qv === 'on' || qv === 'true' || qv === 'always') return { play: true, reason: 'query-on' };
  if (qv === '0' || qv === 'off' || qv === 'false' || qv === 'never') return { play: false, reason: 'query-off' };

  const pref = readIntroPref(storage);
  if (pref === 'always') return { play: true, reason: 'pref-always' };
  if (pref === 'never') return { play: false, reason: 'pref-never' };
  if (webdriver) return { play: false, reason: 'automation' };
  if (reducedMotion) return { play: false, reason: 'reduced-motion' };
  if (safeGet(storage, INTRO_SEEN_KEY)) return { play: false, reason: 'seen' };
  return { play: true, reason: 'first-launch' };
}

/** Reads the live browser state; `false` wherever there is no window (SSR). */
export function decideIntroFromBrowser(): IntroDecision {
  if (typeof window === 'undefined') return { play: false, reason: 'automation' };
  let storage: KeyValueStore | null = null;
  try {
    storage = window.localStorage;
  } catch {
    storage = null;
  }
  let reducedMotion = false;
  try {
    reducedMotion = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  } catch {
    reducedMotion = false;
  }
  return decideIntro({
    search: window.location?.search ?? '',
    storage,
    webdriver: !!window.navigator?.webdriver,
    reducedMotion,
  });
}

// ── Manifest ────────────────────────────────────────────────────────────────

export interface IntroSource {
  src: string;
  type: string;
}

export interface IntroManifest {
  placeholder: boolean;
  duration: number;
  sources: IntroSource[];
}

const PLAYABLE_TYPES = /^video\/(mp4|webm)\b/;

/**
 * Validate public/intro/intro.json. Returns null for anything unusable, which
 * the component treats as "no intro". Relative files resolve against `baseUrl`
 * (the deploy base + 'intro/'). Only same-directory relative names or
 * absolute http(s) URLs are accepted.
 */
export function parseIntroManifest(raw: unknown, baseUrl: string): IntroManifest | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;
  if (m.enabled === false) return null;
  const list = Array.isArray(m.sources)
    ? m.sources
    : typeof m.file === 'string'
      ? [{ file: m.file, type: 'video/mp4' }]
      : [];
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const sources: IntroSource[] = [];
  for (const s of list) {
    if (!s || typeof s !== 'object') continue;
    const file = (s as Record<string, unknown>).file;
    const type = (s as Record<string, unknown>).type;
    if (typeof file !== 'string' || !file || typeof type !== 'string' || !PLAYABLE_TYPES.test(type)) continue;
    if (/^https?:\/\//i.test(file)) sources.push({ src: file, type });
    else if (/^[A-Za-z0-9._-]+$/.test(file)) sources.push({ src: base + file, type });
  }
  if (!sources.length) return null;
  const duration = typeof m.duration === 'number' && m.duration > 0 ? m.duration : 60;
  return { placeholder: m.placeholder === true, duration, sources };
}

// ── Skip inputs ─────────────────────────────────────────────────────────────

/** Esc / Enter skip. Space is left for the "tap to start" gate button. */
export function isSkipKey(key: string): boolean {
  return key === 'Escape' || key === 'Esc' || key === 'Enter';
}

/** Standard Gamepad mapping: 9 = Start (also "Options"/"Menu"/"+"). */
export const GAMEPAD_START_BUTTON = 9;

/**
 * Edge detector for the Start button: true on the frame it goes down, never
 * for a button that was already held when the intro appeared.
 */
export function createGamepadStartEdge(button = GAMEPAD_START_BUTTON) {
  const held = new Map<number, boolean>();
  let primed = false;
  return (pads: ReadonlyArray<{ index: number; buttons: ReadonlyArray<{ pressed: boolean }> } | null | undefined>): boolean => {
    let fired = false;
    for (const p of pads) {
      if (!p) continue;
      const down = !!p.buttons[button]?.pressed;
      const was = held.get(p.index);
      if (down && was === false && primed) fired = true;
      held.set(p.index, down);
    }
    primed = true;
    return fired;
  };
}

// ── Session: once-only finish + watchdog ───────────────────────────────────

export type IntroEndReason =
  | 'ended'
  | 'skip'
  | 'error'
  | 'stall'
  | 'no-manifest';

export interface IntroSessionOptions {
  onDone: (reason: IntroEndReason) => void;
  /** Called once when the viewer has genuinely seen (part of) the movie. */
  onSeen?: () => void;
  /** Time until first frame before we give up (ms). */
  loadTimeoutMs?: number;
  /** Time with no playback progress mid-movie before we give up (ms). */
  stallTimeoutMs?: number;
}

export type IntroPhase = 'loading' | 'playing' | 'gate-blocked' | 'done';

/**
 * The state machine behind <IntroMovie>. The component forwards media events
 * and inputs; this decides when the intro is over. `onDone` fires exactly once.
 *
 *   loading --playing--> playing --ended/skip--> done (seen)
 *   loading --autoplay refused--> gate-blocked --gate tap--> loading
 *   any --error / stall / skip--> done
 *
 * The watchdog is driven by `tick(now)` so tests control the clock.
 */
export function createIntroSession(opts: IntroSessionOptions) {
  const loadTimeoutMs = opts.loadTimeoutMs ?? 8000;
  const stallTimeoutMs = opts.stallTimeoutMs ?? 8000;
  let phase: IntroPhase = 'loading';
  let started = false;
  let lastProgressAt = 0;
  let lastMediaTime = -1;
  let phaseSince = 0;

  const finish = (reason: IntroEndReason) => {
    if (phase === 'done') return false;
    phase = 'done';
    if (started && (reason === 'ended' || reason === 'skip')) opts.onSeen?.();
    opts.onDone(reason);
    return true;
  };

  return {
    get phase() {
      return phase;
    },
    get started() {
      return started;
    },
    begin(now: number) {
      phaseSince = now;
      lastProgressAt = now;
    },
    /** `playing` event (or first `timeupdate` that advanced). */
    playing(now: number) {
      if (phase === 'done') return;
      started = true;
      phase = 'playing';
      lastProgressAt = now;
    },
    /** `timeupdate`: any forward movement resets the stall clock. */
    progress(mediaTime: number, now: number) {
      if (phase === 'done') return;
      if (mediaTime !== lastMediaTime) {
        lastMediaTime = mediaTime;
        lastProgressAt = now;
        if (mediaTime > 0 && phase === 'loading') {
          started = true;
          phase = 'playing';
        }
      }
    },
    /** play() rejected with NotAllowedError: wait for the gate, no watchdog. */
    autoplayBlocked(now: number) {
      if (phase === 'done') return;
      phase = 'gate-blocked';
      phaseSince = now;
    },
    /** The viewer tapped the gate; playback is being (re)started. */
    gateTapped(now: number) {
      if (phase === 'done') return;
      if (phase === 'gate-blocked') phase = 'loading';
      phaseSince = now;
      lastProgressAt = now;
    },
    /** Explicit pause by the page (e.g. tab hidden): don't count as a stall. */
    hold(now: number) {
      lastProgressAt = now;
      phaseSince = now;
    },
    ended: () => finish('ended'),
    skip: () => finish('skip'),
    error: () => finish('error'),
    noManifest: () => finish('no-manifest'),
    /** Watchdog. Returns true if it ended the intro. */
    tick(now: number) {
      if (phase === 'loading' && now - Math.max(phaseSince, lastProgressAt) > loadTimeoutMs) return finish('stall');
      if (phase === 'playing' && now - lastProgressAt > stallTimeoutMs) return finish('stall');
      return false;
    },
  };
}

export type IntroSession = ReturnType<typeof createIntroSession>;
