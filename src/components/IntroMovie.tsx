import { useCallback, useEffect, useRef, useState } from 'react';

import { assetBase } from '../lib/assetBase';
import {
  INTRO_MANIFEST_PATH,
  createGamepadStartEdge,
  createIntroSession,
  isSkipKey,
  markIntroSeen,
  parseIntroManifest,
  type IntroEndReason,
  type IntroManifest,
  type IntroSession,
} from '../lib/introMovie';

/**
 * THE INTRO FMV — plays once, in front of the title screen.
 *
 * Spec: docs/intro-movie/TREATMENT.md (1800f @ 30fps, black 1755-1784, bass
 * drop 1785, onEnded 1800). Integration notes: docs/intro-movie/INTEGRATION.md.
 *
 * - Autoplay: starts MUTED (the only autoplay every browser allows) behind a
 *   "TAP TO START" gate. The tap restarts it from frame 0 with sound. If even
 *   muted autoplay is refused, the gate is what starts playback.
 * - Skip: the SKIP button, Esc / Enter (on key release, so a held key can't
 *   also press START on the title), or gamepad Start.
 * - End: `ended` -> onDone(). The file's last 45 frames are black and this
 *   overlay is black, so the cut is black -> start screen with no flash.
 * - Never blocks: no manifest, no playable source, a decode error or a stall
 *   all call onDone() and the title screen appears exactly as before.
 *
 * The title screen is deliberately NOT mounted underneath: it installs
 * window-level pointer/key listeners that treat any input as PRESS START, so
 * a tap on this gate would have started the game from behind the movie.
 */
export function IntroMovie({ onDone }: { onDone: (reason: IntroEndReason) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const [manifest, setManifest] = useState<IntroManifest | null>(null);
  const [soundOn, setSoundOn] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [phase, setPhase] = useState<string>('manifest');
  const sessionRef = useRef<IntroSession | null>(null);

  if (!sessionRef.current) {
    sessionRef.current = createIntroSession({
      onDone: (reason) => {
        setPhase(`done:${reason}`);
        try {
          (window as unknown as { __bfIntro?: unknown }).__bfIntro = { done: reason };
        } catch {
          /* ignore */
        }
        onDoneRef.current(reason);
      },
      onSeen: () => {
        try {
          markIntroSeen(window.localStorage);
        } catch {
          /* storage unavailable */
        }
      },
    });
  }
  const session = sessionRef.current;

  // ── 1. Manifest: no manifest (or a bad one) means no intro. ──
  useEffect(() => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2500);
    const base = `${assetBase()}intro/`;
    fetch(`${assetBase()}${INTRO_MANIFEST_PATH}`, { cache: 'no-cache', signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const m = parseIntroManifest(json, base);
        if (!m) {
          session.noManifest();
          return;
        }
        session.begin(performance.now());
        setPhase('loading');
        setManifest(m);
      })
      // 404, offline, timeout, bad JSON: straight to the title screen.
      .catch(() => session.noManifest())
      .finally(() => clearTimeout(timer));
    return () => {
      clearTimeout(timer);
    };
  }, [session]);

  // ── 2. Muted autoplay attempt, once the <video> exists. ──
  useEffect(() => {
    const v = videoRef.current;
    if (!manifest || !v) return;
    v.muted = true;
    const p = v.play();
    if (p && typeof p.catch === 'function') {
      p.catch((err: unknown) => {
        const name = (err as { name?: string })?.name;
        if (name === 'NotAllowedError') {
          session.autoplayBlocked(performance.now());
          setBlocked(true);
          setPhase('gate-blocked');
        } else if (name === 'NotSupportedError') {
          session.error();
        }
        // AbortError etc.: a later play() or the watchdog decides.
      });
    }
  }, [manifest, session]);

  // ── 3. Watchdog + skip inputs + tab visibility. ──
  useEffect(() => {
    if (!manifest) return;
    const watchdog = window.setInterval(() => session.tick(performance.now()), 500);

    let armedKey: string | null = null;
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isSkipKey(e.key)) return;
      e.preventDefault();
      e.stopPropagation();
      armedKey = e.key;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (!isSkipKey(e.key)) return;
      e.preventDefault();
      e.stopPropagation();
      if (armedKey === e.key) session.skip();
      armedKey = null;
    };
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);

    const startEdge = createGamepadStartEdge();
    let raf = 0;
    const pollPads = () => {
      try {
        const pads = navigator.getGamepads?.() ?? [];
        if (startEdge(Array.from(pads))) session.skip();
      } catch {
        /* no gamepad API */
      }
      if (session.phase !== 'done') raf = requestAnimationFrame(pollPads);
    };
    raf = requestAnimationFrame(pollPads);

    const onVis = () => session.hold(performance.now());
    document.addEventListener('visibilitychange', onVis);

    return () => {
      clearInterval(watchdog);
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [manifest, session]);

  // ── 4. Free the decoder when we go (low-end Android keeps it otherwise). ──
  useEffect(() => {
    const v = videoRef.current;
    return () => {
      if (!v) return;
      try {
        v.pause();
        v.removeAttribute('src');
        v.load();
      } catch {
        /* already gone */
      }
    };
  }, [manifest]);

  /** The gate: this tap is the user gesture that lets sound play. */
  const startWithSound = useCallback(() => {
    const v = videoRef.current;
    if (!v || session.phase === 'done') return;
    session.gateTapped(performance.now());
    setBlocked(false);
    setSoundOn(true);
    try {
      v.currentTime = 0;
    } catch {
      /* not seekable yet: plays from wherever it is */
    }
    v.muted = false;
    v.play().catch(() => {
      // Sound still refused (rare): keep the movie going silently.
      v.muted = true;
      setSoundOn(false);
      v.play().catch(() => session.error());
    });
  }, [session]);

  const lastSourceIndex = manifest ? manifest.sources.length - 1 : -1;

  return (
    <div
      className="fixed inset-0 z-[80] overflow-hidden bg-black"
      data-intro-phase={phase}
      data-intro-placeholder={manifest?.placeholder ? '1' : undefined}
      aria-label="Intro movie"
      role="region"
    >
      {manifest && (
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full bg-black object-contain"
          muted
          autoPlay
          playsInline
          // iOS < 10 / some WebViews still read the prefixed attribute.
          {...{ 'webkit-playsinline': 'true' }}
          preload="auto"
          disablePictureInPicture
          disableRemotePlayback
          controls={false}
          onPlaying={() => {
            session.playing(performance.now());
            setPhase(soundOn ? 'playing-sound' : 'playing-muted');
          }}
          onTimeUpdate={(e) => session.progress(e.currentTarget.currentTime, performance.now())}
          onEnded={() => session.ended()}
          onError={() => session.error()}
        >
          {manifest.sources.map((s, i) => (
            <source
              key={s.src}
              src={s.src}
              type={s.type}
              // Only the LAST source failing means nothing is playable.
              onError={i === lastSourceIndex ? () => session.error() : undefined}
            />
          ))}
        </video>
      )}

      {manifest && !soundOn && (
        <button
          type="button"
          data-intro-gate
          onClick={startWithSound}
          className="absolute inset-0 flex w-full flex-col items-center justify-end pb-[22vh] focus:outline-none"
        >
          <span className="bf-plate px-8 py-3">
            <span className="bf-prompt">{blocked ? 'TAP TO START' : 'TAP TO START WITH SOUND'}</span>
          </span>
        </button>
      )}

      {manifest && (
        <button
          type="button"
          data-intro-skip
          onClick={(e) => {
            e.stopPropagation();
            session.skip();
          }}
          className="bf-plate absolute right-[max(1.25rem,env(safe-area-inset-right))] bottom-[max(1.25rem,env(safe-area-inset-bottom))] min-h-11 min-w-11 px-5 py-2 text-sm tracking-[0.3em]"
        >
          SKIP ▸▸
        </button>
      )}
    </div>
  );
}

export default IntroMovie;
