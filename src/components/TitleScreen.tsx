import { useEffect, useRef, useState } from 'react';

import { assetUrl } from '../lib/assetBase';

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
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${videoUp ? 'opacity-100' : 'opacity-0'}`}
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
        <span className="mt-8 mb-[18vh] text-sm tracking-[0.45em] text-yellow-400 animate-pulse drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
          PRESS START
        </span>
      </button>
    </div>
  );
}
