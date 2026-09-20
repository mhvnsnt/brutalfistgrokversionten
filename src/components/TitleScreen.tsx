import { useEffect, useRef, useState } from 'react';

import { assetUrl } from '../lib/assetBase';
import { startAssetWarmup, type WarmupProgress } from '../engine/assets/AssetWarmup';
import { warmupUrls } from '../engine/assets/warmupPlan';

/**
 * THE TITLE SCREEN — the owner's own 1280x720 title video.
 *
 * SILENT BY DESIGN AND BY NECESSITY. A phone will not autoplay a video that
 * carries sound, so the audio track is stripped from the FILE at bake time
 * and the element is muted and playsInline. The theme is a separate audio
 * file started on the viewer's first interaction, which is the only moment a
 * browser will allow it.
 *
 * SOURCE 23.7 MB -> 7.3 MB h264 + a VP9 copy. Both ship, and the browser
 * downloads only the one it can play: Android's WebView takes the mp4, and
 * the webm exists because Playwright's bundled Chromium has no proprietary
 * codecs, so without it the title screen could not be tested here at all.
 *
 * The poster frame shows instantly so the screen is never black while 7 MB
 * arrives, and if the video never arrives the wordmark underneath is still a
 * working title screen.
 */
export function TitleScreen({ onStart }: { onStart: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const themeRef = useRef<HTMLAudioElement | null>(null);
  const [videoUp, setVideoUp] = useState(false);
  const [warm, setWarm] = useState<WarmupProgress | null>(null);

  /**
   * START PULLING THE GAME DOWN WHILE THE TITLE PLAYS.
   *
   * The title screen is the one moment a player is reliably sitting still,
   * and it is the whole reason a match used to open on an empty stage: the
   * first request for a 45 MB roster happened when the fight started. Nothing
   * waits on this — pressing START mid-warm is fine.
   */
  useEffect(() => {
    // NO ABORT ON CLEANUP, AND THAT IS THE FIX, NOT AN OVERSIGHT.
    //
    // React's development double-effect mounts, unmounts and remounts. The
    // unmount aborted the warm, the browser reuses an in-flight request for
    // the same URL, and index.json came back ERR_ABORTED to the BAKED BANK
    // as well — which used to latch that failure for the whole session and
    // leave every fighter with none of its 366 clips.
    //
    // A prefetch has nothing to cancel: it only fills the HTTP cache, every
    // failure inside it is already swallowed, and letting it finish costs a
    // few background requests. Progress is dropped once the screen is gone.
    let live = true;
    startAssetWarmup(warmupUrls(), {
      concurrency: 3,
      onProgress: (p) => { if (live) setWarm(p); },
    });
    return () => { live = false; };
  }, []);

  // Autoplay can still be refused; the poster and the wordmark cover that.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.play().catch(() => {});
  }, []);

  /** The first interaction is the only moment a browser will start audio. */
  const armTheme = () => {
    const a = themeRef.current;
    if (!a || !a.paused) return;
    a.volume = 0.6;
    a.play().catch(() => {});
  };

  const start = () => {
    themeRef.current?.pause();
    onStart();
  };

  return (
    <div
      className="fixed inset-0 bg-black text-white font-mono overflow-hidden"
      onPointerDown={armTheme}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ' || e.code === 'Space') {
          e.preventDefault();
          armTheme();
          start();
        }
      }}
    >
      <video
        ref={videoRef}
        /*
         * FIT THE WHOLE FRAME WHEN THE PHONE IS UPRIGHT.
         *
         * Owner: "when I have it horizontal the whole start screen shows,
         * that's good. But when I have it vertical, the video I sent you for
         * the start screen is cropped. It needs to sense and understand and
         * fit to my screen ... so if they have it in vertical they can also
         * still see the whole title screen, full movie thing." And,
         * explicitly: "I'm not asking you to lock it into horizontal or
         * vertical."
         *
         * The video is 1280x720. `object-cover` scales it to FILL, so in a
         * portrait viewport of roughly 412x915 it matches the height and
         * throws away most of the width — his art, cropped to a letterbox
         * slice of itself. `object-contain` shows the whole frame and pillar-
         * boxes instead, which is the thing he actually asked for. Landscape
         * already looked right, so landscape keeps `cover` and fills the
         * screen edge to edge.
         *
         * This is an ORIENTATION query, not a width breakpoint: a tablet in
         * portrait is wide enough to trip `md:` and would still crop.
         */
        className={`absolute inset-0 h-full w-full object-contain landscape:object-cover transition-opacity duration-700 ${videoUp ? 'opacity-100' : 'opacity-0'}`}
        poster={assetUrl('/title/title_poster.jpg')}
        muted
        loop
        playsInline
        preload="auto"
        onPlaying={() => setVideoUp(true)}
        aria-hidden
      >
        <source src={assetUrl('/title/title.mp4')} type="video/mp4" />
        <source src={assetUrl('/title/title.webm')} type="video/webm" />
      </video>

      <audio ref={themeRef} loop preload="auto" aria-hidden>
        <source src={assetUrl('/title/title_theme.m4a')} type="audio/mp4" />
        <source src={assetUrl('/title/title_theme.ogg')} type="audio/ogg" />
      </audio>

      {/* The wordmark stands alone until the video is up, then steps back so
          the owner's art is the title screen rather than a backdrop to ours. */}
      <button
        autoFocus
        onClick={start}
        className="absolute inset-0 flex flex-col items-center justify-end w-full pb-safe px-safe"
      >
        <span
          className={`text-4xl font-black italic tracking-[0.18em] transition-opacity duration-700 ${videoUp ? 'opacity-0' : 'opacity-100'}`}
        >
          BRUTAL FIST
        </span>
        <span className="mt-8 text-sm tracking-[0.45em] text-yellow-400 animate-pulse drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
          PRESS START
        </span>
        {/* Honest about what it is doing, and never a gate: the player can
            start at any point and the warm simply stops. */}
        <span className="mt-3 mb-[18vh] h-3 text-[9px] tracking-[0.3em] text-white/45 drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
          {warm && warm.done < warm.total ? `LOADING ${warm.done}/${warm.total}` : ''}
        </span>
      </button>
    </div>
  );
}
