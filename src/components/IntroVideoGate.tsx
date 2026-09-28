'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface IntroVideoGateProps {
  onComplete: () => void;
  src?: string;
}

// The legacy MP4 is not shipped in the static PWA. Keep the gate usable
// without issuing a guaranteed 404; pre-fight animation is handled by the
// actual combat scene below it.

export default function IntroVideoGate({ onComplete, src = '' }: IntroVideoGateProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const completedRef = useRef(false);
  const [started, setStarted] = useState(false);
  const [playError, setPlayError] = useState(false);

  const complete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  }, [onComplete]);

  const start = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    setStarted(true);
    setPlayError(false);
    video.muted = false;
    try {
      await video.play();
    } catch {
      // A gamepad/keyboard event is not guaranteed to satisfy every browser's
      // media gesture policy. Keep the gate visible so a physical tap can retry.
      setPlayError(true);
      setStarted(false);
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        complete();
        return;
      }
      if (!started && (event.key === 'Enter' || event.key === ' ' || event.key.toLowerCase() === 's')) {
        event.preventDefault();
        void start();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [complete, start, started]);

  useEffect(() => {
    let frame = 0;
    let previousStart = false;

    const pollGamepad = () => {
      const pads = navigator.getGamepads?.() ?? [];
      const pressed = pads.some((pad) => Boolean(pad?.buttons?.[9]?.pressed));
      if (pressed && !previousStart) {
        void start();
      }
      previousStart = pressed;
      frame = requestAnimationFrame(pollGamepad);
    };

    frame = requestAnimationFrame(pollGamepad);
    return () => cancelAnimationFrame(frame);
  }, [start]);

  return (
    <div
      className="fixed inset-0 z-[100] bg-black text-white overflow-hidden"
      role="dialog"
      aria-label="Brutal Fist intro"
      onClick={() => {
        if (!started) void start();
      }}
    >
      {src && (
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          src={src}
          playsInline
          preload="auto"
          onEnded={complete}
          onError={complete}
          aria-hidden="true"
        />
      )}

      {!started && (
        <div className="absolute inset-0 flex items-end justify-center bg-black/25 p-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
          <div className="text-center">
            <div className="mb-3 text-[9px] tracking-[0.45em] text-white/60">BRUTAL FIST</div>
            <button
              type="button"
              autoFocus
              onClick={(event) => {
                event.stopPropagation();
                void start();
              }}
              className="border border-white/60 bg-black/75 px-8 py-4 text-sm font-black tracking-[0.3em] hover:bg-white hover:text-black"
            >
              TAP TO START
            </button>
            <div className="mt-3 text-[8px] tracking-[0.2em] text-white/50">
              SOUND ENABLES ON START · ESC TO SKIP
            </div>
            {playError && (
              <div className="mt-2 text-[8px] tracking-[0.15em] text-white/70">
                TAP AGAIN TO ENABLE INTRO AUDIO
              </div>
            )}
          </div>
        </div>
      )}

      {started && (
        <button
          type="button"
          aria-label="Skip intro"
          onClick={(event) => {
            event.stopPropagation();
            complete();
          }}
          className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] border border-white/40 bg-black/60 px-4 py-2 text-[9px] tracking-[0.25em] text-white/80 hover:bg-white hover:text-black"
        >
          SKIP
        </button>
      )}
    </div>
  );
}
