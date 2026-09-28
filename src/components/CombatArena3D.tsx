'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { FighterMesh } from './FighterMesh';
import { type BannonFighterProfile } from '../data/bannonRoster';
import { getFighterGlbUrl } from '../data/bannonGlbRoster';
import { TrainingStage } from './TrainingStage';
import { UrbanNightStage } from './UrbanNightStage';
import { ProceduralStage } from './ProceduralStage';
import { type StageId, resolveStageConfig } from '../engine/combat/StageConfig';
import { CHARACTER_BLOOM } from './PostMatchScreen';
import { createHitEffectPool, spawnHitEffect, tickHitEffectPool, getHitEffectRenderData, getActivePointLights, sparkReachCss, type HitEffectPool, type HitEffectType, type PointLightFlash,  } from '../engine/combat/HitEffectSystem';
import { COMBAT_P1_YAW, COMBAT_P2_YAW, COMBAT_FIGHTER_Y, HIT_FX_WORLD_Y, HIT_FX_SCREEN_Y, faceOpponentYaw, yawWithBackTurn } from '../engine/V7OrientationContract';
import { stepFacing } from '../engine/motion/FacingRate';

// Stage IDs come from StageConfig — every catalog arena is legal here.


// ── Stage geometry constants ──────────────────────────────────────────────────
const FLOOR_DEPTH = 10;
// Mobile-safe spawn positions — inward to X: ±1.8
const P1_X = -1.8;
const P2_X = 1.8;
const Z_RANGE = 2.0;

/**
 * Pick locomotion presentation from the FSM's semantic state plus the live
 * signed velocity. Combat states remain authoritative; only locomotion states
 * are redirected here. This keeps a grapple receiver/hit reaction from being
 * accidentally replaced by a walk cycle while still giving forward/backward
 * walk, run and dash their own visual lanes.
 */
function resolveLocomotionPresentation(
  state: string,
  velocity: { forward: number; strafe: number } | undefined,
  requested: string,
  airborneY = 0,
): string {
  if (!velocity) return state === 'Walking' ? (requested || 'idle') : (requested || state);
  const f = velocity.forward ?? 0;
  const s = velocity.strafe ?? 0;
  const af = Math.abs(f);
  const as = Math.abs(s);
  const moving = Math.hypot(f, s) > 0.12;

  // Jump input may be released before the 0.55s FSM presentation window ends.
  // The locomotion arc is the authoritative world-space Y, so keep the jump
  // clip alive for the whole airborne interval instead of snapping to idle in
  // mid-flight. This is also what makes the visual lift/fall match the actual
  // capsule height.
  if (airborneY > 0.02 && state !== 'Knockdown' && state !== 'Juggled') {
    return f < -0.12 ? 'jumpBack' : f > 0.12 ? 'jumpForward' : 'jump';
  }

  if (state === 'Backdashing') return 'Backdashing';
  // Explicit combat/throw/wakeup clips come from the caller and must survive
  // this locomotion selector. Grapple receiver clips are deliberately not FSM
  // state names, so returning `state` here would silently replace them.
  if (state !== 'Walking') return requested || state;
  if (!moving) return 'idle';

  // The FSM already distinguishes run/dash from walk. Preserve that request,
  // but choose the signed variant so holding dash backwards does not play a
  // forward run while the capsule travels backwards.
  if (requested === 'dash' || requested === 'dashForward') {
    return f < -0.12 ? 'dashBackward' : 'dashForward';
  }
  if (requested === 'run') {
    return f < -0.12 ? 'runBackward' : 'run';
  }
  // Once we are in the generic Walking state, the signed live velocity is
  // the source of truth. Do not let a stale motion label make a right strafe
  // look like a left strafe (or a retreat look like an advance).
  if (as > af * 1.15) return s < 0 ? 'strafeLeft' : 'strafeRight';
  if (f < -0.12) return 'walkBackward';
  if (f > 0.12) return 'walkForward';
  return requested || 'idle';
}

// ── Cinematic phases ──────────────────────────────────────────────────────────
export type CinematicPhase = 'sweep' | 'intro' | 'fight' | 'victory';

// ── VFX particle types ────────────────────────────────────────────────────────
interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  /**
   * 'ground' is the knockdown pass: a few dust specks at the feet and a flat scuff,
   * replacing the stroked circles that were drawn at twenty times the particle size
   * and stacked into halos bigger than the fighter.
   */
  type: 'impact' | 'burst' | 'trail' | 'ground';
}

// ── Announcer voice lines (Web Speech API) ────────────────────────────────────
function useAnnouncer(enabled: boolean) {
  const speak = useCallback((text: string, pitch = 0.8, rate = 0.9) => {
    if (!enabled) return;
    if (typeof window === 'undefined') return;
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.pitch = pitch;
    utt.rate = rate;
    utt.volume = 0.85;
    synth.speak(utt);
  }, [enabled]);

  return { speak };
}

// ── Camera sweep for pre-fight cinematic ─────────────────────────────────────
function CinematicCamera({
  phase,
  p1X,
  p2X,
  p1Z,
  p2Z,
  fov,
  shakeOffset,
}: {
  phase: CinematicPhase;
  p1X: number;
  p2X: number;
  p1Z: number;
  p2Z: number;
  fov: number;
  shakeOffset?: { x: number; y: number };
}) {
  const { camera, size } = useThree();
  const sweepAngleRef = useRef(0);
  const phaseTimeRef = useRef(0);

  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.fov = fov;
    cam.near = 0.1;
    cam.far = 200;
    cam.updateProjectionMatrix();
  }, [camera, fov]);

  useFrame((state, delta) => {
    const cam = camera as THREE.PerspectiveCamera;
    phaseTimeRef.current += delta;

    if (phase === 'sweep') {
      sweepAngleRef.current += delta * 0.6;
      const angle = sweepAngleRef.current;
      const radius = 10;
      cam.position.x = Math.sin(angle) * radius;
      cam.position.y = 3.5 + Math.sin(angle * 0.5) * 1.5;
      cam.position.z = Math.cos(angle) * radius * 0.6 + 4;
      cam.lookAt(0, 1.5, 0);
      cam.updateProjectionMatrix();
    } else if (phase === 'intro') {
      const t = Math.min(1, phaseTimeRef.current / 1.5);
      // The intro clipped both fighters off the edges for the same reason the
      // fight camera did: they start further apart than a 26 degree horizontal
      // view can hold. Back off to whatever actually fits them.
      const introAspect = Math.max(0.2, size.width / Math.max(1, size.height));
      const introVFov = Math.min(85, Math.max(fov, (2 * Math.atan(Math.tan((38 * (Math.PI / 180)) / 2) / introAspect)) * (180 / Math.PI)));
      if (Math.abs(cam.fov - introVFov) > 0.25) cam.fov = introVFov;
      const introHHalf = Math.atan(Math.tan((introVFov * (Math.PI / 180)) / 2) * introAspect);
      const introSpan = Math.abs(p2X - p1X) / 2 + 0.9;
      const targetX = (p1X + p2X) / 2;
      const targetY = 1.0 + (1 - t) * 2;
      const targetZ = Math.max(6, introSpan / Math.max(0.05, Math.tan(introHHalf))) + (1 - t) * 3;
      cam.position.x += (targetX - cam.position.x) * 0.05;
      cam.position.y += (targetY - cam.position.y) * 0.05;
      cam.position.z += (targetZ - cam.position.z) * 0.05;
      cam.lookAt(targetX, 1.2, (p1Z + p2Z) / 2);
      cam.updateProjectionMatrix();
    } else if (phase === 'fight') {
      const midX = (p1X + p2X) / 2;
      const midZ = (p1Z + p2Z) / 2;
      const lineX = p2X - p1X;
      const lineZ = p2Z - p1Z;
      const dist = Math.max(0.001, Math.hypot(lineX, lineZ));
      // The camera is anchored to the fighters' line, not to world +Z.
      // When the pair radial-sidestep, their combat axis rotates in XZ; the
      // camera follows that axis exactly like a side-on fighting-game camera.
      // Pick the normal that stays on the original camera side (+Z).
      let normalX = -lineZ / dist;
      let normalZ = lineX / dist;
      if (normalZ < 0) {
        normalX = -normalX;
        normalZ = -normalZ;
      }
      // FOLLOW THE AXIS PARTWAY, NOT ALL THE WAY.
      //
      // Owner: "the camera does like a 45 degree tilt towards your
      // character and pretty much stops showing your opponent."
      //
      // MEASURED during a held sidestep: P1 orbits to (-2.31, 1.43) while
      // P2 sits at (-0.91, -0.27), so the pair's axis has swung about 50
      // degrees off the lane — and this camera was perpendicular to that
      // axis at every instant, so it swung the same 50 degrees. That is
      // his 45-degree tilt, and it is the camera doing exactly what it was
      // told to do.
      //
      // The reason it feels wrong is that a fully axis-locked camera makes
      // the WORLD rotate instead of the character moving across the frame.
      // Tekken and Schwarzerblitz keep a broadly side-on shot and let the
      // sidestep read as the fighter travelling around the screen. Blending
      // most of the way back to the lane normal keeps the parallax that
      // sells depth while leaving the stage still.
      const AXIS_FOLLOW = 0.3;
      normalX *= AXIS_FOLLOW;
      normalZ = normalZ * AXIS_FOLLOW + (1 - AXIS_FOLLOW);
      const nLen = Math.max(0.001, Math.hypot(normalX, normalZ));
      normalX /= nLen;
      normalZ /= nLen;
      // ── FRAME BOTH FIGHTERS. THIS IS ARITHMETIC, AND IT WAS WRONG. ──────
      //
      // Owner: "I can't visually really tell that it's a fight or what's
      // happening going on." Looked at, not measured: in a captured frame both
      // fighters were CLIPPED OFF THE LEFT AND RIGHT EDGES with empty floor in
      // the middle.
      //
      // three.js `fov` is VERTICAL. On a portrait phone (412x915, aspect 0.45)
      // a 55 degree vertical fov is only a 26 degree HORIZONTAL one, and the
      // distance rule below was written as if the view were wide:
      //
      //     pair gap   cam distance   half-width visible   fighter at
      //      0.85m       4.50m            1.05m              0.42m   ok
      //      1.50m       4.58m            1.07m              0.75m   CLIPPED
      //      2.50m       5.63m            1.32m              1.25m   CLIPPED
      //      3.60m       6.78m            1.59m              1.80m   CLIPPED
      //
      // So the moment they were not touching, somebody left the screen.
      //
      // The fix is to guarantee a minimum HORIZONTAL field of view by deriving
      // the vertical one from the live aspect, and then to back off far enough
      // that the pair plus a margin fits inside it. On a landscape screen the
      // derived value is smaller than the authored fov, so `Math.max` leaves
      // desktop exactly as it was — only portrait changes.
      const aspect = Math.max(0.2, size.width / Math.max(1, size.height));
      const MIN_HORIZONTAL_FOV = 38 * (Math.PI / 180);
      const neededVFov = 2 * Math.atan(Math.tan(MIN_HORIZONTAL_FOV / 2) / aspect);
      const vFov = Math.min(85 * (Math.PI / 180), Math.max(fov * (Math.PI / 180), neededVFov));
      if (Math.abs(cam.fov - vFov * (180 / Math.PI)) > 0.25) {
        cam.fov = vFov * (180 / Math.PI);
      }
      const hHalf = Math.atan(Math.tan(vFov / 2) * aspect);
      // Half the pair's span, plus a body's width so nobody rides the edge.
      const FRAME_MARGIN_M = 0.75;
      const fitDistance = (dist / 2 + FRAME_MARGIN_M) / Math.max(0.05, Math.tan(hHalf));
      const targetDistance = Math.max(4.5, Math.min(13, Math.max(dist * 1.05 + 3.0, fitDistance)));
      const targetCamX = midX + normalX * targetDistance;
      const targetCamZ = midZ + normalZ * targetDistance;
      const targetCamY = 2.0 + dist * 0.05;
      cam.position.x += (targetCamX - cam.position.x) * 0.1;
      cam.position.y += (targetCamY - cam.position.y) * 0.07;
      cam.position.z += (targetCamZ - cam.position.z) * 0.1;
      // ── Camera shake from hit effect system ──────────────────────────────
      if (shakeOffset && (Math.abs(shakeOffset.x) > 0.001 || Math.abs(shakeOffset.y) > 0.001)) {
        cam.position.x += shakeOffset.x * 0.01;
        cam.position.y += shakeOffset.y * 0.01;
      }
      // LOOK AT WHERE THEY ACTUALLY ARE.
      //
      // Owner: "the camera does like a 45 degree tilt towards your
      // character and pretty much stops showing your opponent."
      //
      // The POSITION above already orbits with the pair's axis and tracks
      // `midZ` in full. The aim did not: `midZ * 0.15` pulled the look
      // target 85% of the way back to the Z=0 lane, so the further the pair
      // sidestepped off it the further the camera aimed past them. The
      // frame swings, and the fighter nearer the lane walks out of it —
      // which is the tilt he is describing, produced by a camera that is
      // standing in the right place and looking somewhere else.
      cam.lookAt(midX, 1.1, midZ);
      // Published so a probe can project the fighters and ask whether both
      // are actually in frame — "stops showing your opponent" is a claim
      // about the FRAME and has to be measured in one.
      (window as unknown as { __BF_CAMERA?: unknown }).__BF_CAMERA = cam;
      // AND THE SCENE, so the skin-bleed probe walks the bodies actually on
      // screen. It was reading `window.__scenes`, which nothing publishes,
      // so it returned "no webbing" for the best possible reason: it never
      // found a body to look at. A probe that cannot fail loudly is worse
      // than no probe.
      // `state.scene`, not `cam.parent` — an R3F default camera is not
      // parented into the scene graph, so the parent is null and the probe
      // reported "no scene" from inside a running match.
      (window as unknown as { __BF_SCENE?: unknown }).__BF_SCENE = state.scene;
      (window as unknown as { THREE?: unknown }).THREE ??= THREE;
      cam.updateProjectionMatrix();
    } else if (phase === 'victory') {
      const targetX = p1X;
      const targetY = 1.8;
      const targetZ = 3.5;
      cam.position.x += (targetX - cam.position.x) * 0.04;
      cam.position.y += (targetY - cam.position.y) * 0.04;
      cam.position.z += (targetZ - cam.position.z) * 0.04;
      cam.lookAt(p1X, 1.5, 0);
      cam.updateProjectionMatrix();
    }
  });

  return null;
}

// ── Blob shadow under each fighter ───────────────────────────────────────────
function BlobShadow({ x, z, scale = 1 }: { x: number; z: number; scale?: number }) {
  return (
    <mesh position={[x, 0.005, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[0.45 * scale, 16]} />
      <meshBasicMaterial color="#000000" transparent opacity={0.55} depthWrite={false} />
    </mesh>
  );
}

// ── Impact particle system (canvas overlay) ───────────────────────────────────
interface VFXOverlayProps {
  particles: Particle[];
  screenFlash: number;
  hitStopActive: boolean;
  hitEffectPool?: HitEffectPool;
}

function drawSlash(ctx: CanvasRenderingContext2D, length: number, color: string) {
  const half = Math.max(1.2, length * 0.13);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(length * 0.28, half);
  ctx.lineTo(length, 0);
  ctx.lineTo(length * 0.28, -half);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(length * 0.62, 0);
  ctx.lineTo(length * 0.78, half * 0.28);
  ctx.lineTo(length, 0);
  ctx.lineTo(length * 0.78, -half * 0.28);
  ctx.closePath();
  ctx.fill();
}

function drawSparkCore(ctx: CanvasRenderingContext2D, radius: number) {
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, -radius);
  ctx.lineTo(radius * 0.28, 0);
  ctx.lineTo(0, radius);
  ctx.lineTo(-radius * 0.28, 0);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-radius * 0.72, 0);
  ctx.lineTo(0, radius * 0.22);
  ctx.lineTo(radius * 0.72, 0);
  ctx.lineTo(0, -radius * 0.22);
  ctx.closePath();
  ctx.fill();
}

function VFXOverlay({ particles, screenFlash, hitEffectPool }: VFXOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!parent) return;
    const watch = () => setViewport({ w: parent.clientWidth, h: parent.clientHeight });
    watch();
    const ro = new ResizeObserver(watch);
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    const cssW = Math.max(1, parent?.clientWidth || viewport.w || 800);
    const cssH = Math.max(1, parent?.clientHeight || viewport.h || 600);
    const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
    const bw = Math.round(cssW * dpr);
    const bh = Math.round(cssH * dpr);
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Backing store matches the element, then we draw in CSS pixels.
    // A fixed 800×600 bitmap stretched over a portrait phone turned every
    // circle into a tall ellipse and the near edge of a ring into a beam.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    const px = (x: number) => (x / 800) * cssW;
    const py = (y: number) => (y / 600) * cssH;

    const totalFlash = Math.max(screenFlash, hitEffectPool?.screenFlash ?? 0);
    if (totalFlash > 0.01) {
      ctx.fillStyle = `rgba(255,255,255,${Math.min(0.2, totalFlash * 0.35)})`;
      ctx.fillRect(0, 0, cssW, cssH);
    }

    for (const p of particles) {
      const alpha = Math.min(1, Math.max(0, p.life / p.maxLife));
      if (p.type === 'ground') {
        const rx = Math.min(cssW * 0.045, 36) * (0.5 + alpha * 0.5);
        ctx.globalAlpha = alpha * 0.4;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(px(p.x), py(p.y), rx, Math.max(2, rx * 0.18), 0, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      ctx.globalAlpha = alpha * 0.85;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(px(p.x), py(p.y), Math.min(4, Math.max(0.5, p.size * alpha)), 0, Math.PI * 2);
      ctx.fill();
    }

    if (hitEffectPool) {
      const renderData = getHitEffectRenderData(hitEffectPool);
      for (const effect of renderData) {
        const { screenX, screenY, scale, alpha, type, streaks } = effect;
        const reach = sparkReachCss(cssW, cssH, type, scale);
        ctx.save();
        ctx.translate(px(screenX), py(screenY));
        for (const streak of streaks) {
          ctx.save();
          ctx.rotate(streak.angle);
          ctx.globalAlpha = Math.min(1, streak.alpha * alpha);
          const len = reach * (0.45 + Math.min(1, streak.length / 14) * 0.55);
          drawSlash(ctx, len, streak.color);
          ctx.restore();
        }
        ctx.globalAlpha = Math.min(1, alpha);
        drawSparkCore(ctx, Math.max(2, reach * (type === 'block' ? 0.16 : 0.22)));
        ctx.restore();
      }
    }

    ctx.globalAlpha = 1;
  });

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-20"
      style={{ mixBlendMode: 'screen' }}
    />
  );
}

// ── Training stage lighting ───────────────────────────────────────────────────
function TrainingLighting({ p1Color, p2Color }: { p1Color: string; p2Color: string }) {
  return (
    <>
      <ambientLight intensity={0.3} color="#c8d0e0" />
      <directionalLight
        position={[0, 8, 4]} intensity={2.5} color="#fff8f0"
        castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024}
      />
      <directionalLight position={[-5, 4, 3]} intensity={0.8} color="#a0b8ff" />
      <directionalLight position={[0, 5, -6]} intensity={1.0} color="#ffffff" />
      <spotLight
        position={[P1_X - 2, 6, 2]}
        intensity={1.5} color={p1Color} angle={0.4} penumbra={0.6} distance={12} decay={2}
      />
      <spotLight
        position={[P2_X + 2, 6, 2]}
        intensity={1.5} color={p2Color} angle={0.4} penumbra={0.6} distance={12} decay={2}
      />
    </>
  );
}

// ── Intro animation overlay ───────────────────────────────────────────────────
function IntroOverlay({
  phase,
  p1Name,
  p2Name,
  speaker,
  speakerName,
}: {
  phase: CinematicPhase;
  p1Name: string;
  p2Name: string;
  /** Whose pre-fight beat is playing. Null between beats and after them. */
  speaker?: { player: 'p1' | 'p2'; line: string } | null;
  speakerName?: string;
}) {
  if (phase !== 'sweep' && phase !== 'intro') return null;

  return (
    <div className="absolute inset-0 z-30 pointer-events-none">
      <div className="absolute top-0 left-0 right-0 h-[12%] bg-black" />
      <div className="absolute bottom-0 left-0 right-0 h-[12%] bg-black" />

      {phase === 'sweep' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-[9px] tracking-[0.6em] text-zinc-500 animate-pulse">LOADING ARENA</div>
            <div className="mt-2 text-2xl font-black tracking-widest text-white">BRUTAL FIST</div>
          </div>
        </div>
      )}

      {/* THE LINE. There is no voice cast, so the intro speaks in text — a
          silent pose with a caption reads as deliberate where a silent pose
          with nothing reads as broken. Attributed and sided, so it is obvious
          WHICH fighter is talking during their own beat. */}
      {speaker && (
        <div
          className={`absolute left-0 right-0 bottom-[13%] px-6 flex ${
            speaker.player === 'p1' ? 'justify-start' : 'justify-end'
          }`}
        >
          <div className="max-w-[62%] bg-black/70 border-l-2 px-3 py-2"
            style={{ borderColor: speaker.player === 'p1' ? '#60a5fa' : '#f87171' }}
          >
            <div className="text-[8px] tracking-[0.35em] text-zinc-400">
              {(speakerName ?? '').toUpperCase()}
            </div>
            <div className="text-sm md:text-base font-semibold text-white leading-snug">
              {speaker.line}
            </div>
          </div>
        </div>
      )}

      {phase === 'intro' && (
        <div className="absolute inset-0 flex items-end justify-between px-8 pb-[14%]">
          <div className="text-left">
            <div className="text-[8px] tracking-[0.4em] text-zinc-500">PLAYER 1</div>
            <div className="text-2xl font-black tracking-widest text-white animate-pulse">
              {p1Name.toUpperCase()}
            </div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-black tracking-[0.3em] text-yellow-400">VS</div>
          </div>
          <div className="text-right">
            <div className="text-[8px] tracking-[0.4em] text-zinc-500">PLAYER 2</div>
            <div className="text-2xl font-black tracking-widest text-white animate-pulse">
              {p2Name.toUpperCase()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Victory cinematic overlay ─────────────────────────────────────────────────
function VictoryOverlay({
  phase,
  winnerName,
}: {
  phase: CinematicPhase;
  winnerName?: string;
}) {
  if (phase !== 'victory' || !winnerName) return null;

  return (
    <div className="absolute inset-0 z-30 pointer-events-none">
      <div className="absolute top-0 left-0 right-0 h-[12%] bg-black" />
      <div className="absolute bottom-0 left-0 right-0 h-[12%] bg-black" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
        <div className="text-[9px] tracking-[0.6em] text-zinc-400">WINNER</div>
        <div
          className="text-4xl font-black tracking-widest text-yellow-400"
          style={{ textShadow: '0 0 40px #facc15, 0 0 80px #facc1544' }}
        >
          {winnerName.toUpperCase()}
        </div>
        <div className="text-sm tracking-[0.4em] text-white mt-1">WINS</div>
      </div>
    </div>
  );
}

// ── Per-character hit bloom config ────────────────────────────────────────────
// Each fighter emits their own color/style on impact — Tekken-style
function getCharacterHitBloom(fighterId: string, factionColor: string) {
  const bloom = CHARACTER_BLOOM[fighterId] ?? CHARACTER_BLOOM.default;
  return bloom.primary ?? factionColor;
}

/** Design-space X (0–800) for an impact on a side-view camera. */
function impactScreenX(worldX: number, otherX: number): number {
  const mid = (worldX + otherX) / 2;
  const frac = Math.min(0.82, Math.max(0.18, 0.5 + (worldX - mid) / 7.2));
  return frac * 800;
}

function spawnKnockdownDust(
  screenX: number,
  screenY: number,
  particleIdRef: React.MutableRefObject<number>,
  tint: string,
): Particle[] {
  const dust: Particle[] = [];
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI * i) / 8;
    const speed = 0.6 + Math.random() * 1.4;
    const life = 0.18 + Math.random() * 0.14;
    dust.push({
      id: ++particleIdRef.current,
      x: screenX + (Math.random() - 0.5) * 16,
      y: screenY,
      vx: Math.cos(angle) * speed,
      vy: -Math.abs(Math.sin(angle) * speed) * 0.4,
      life,
      maxLife: life,
      color: i % 2 === 0 ? '#8a7560' : tint,
      size: 1.5 + Math.random() * 2,
      type: 'impact',
    });
  }
  const scuff = 0.22;
  dust.push({
    id: ++particleIdRef.current,
    x: screenX,
    y: screenY + 8,
    vx: 0,
    vy: 0,
    life: scuff,
    maxLife: scuff,
    color: tint,
    size: 10,
    type: 'ground',
  });
  return dust;
}

// ── AAA Hit Effect Pool (replaces old spawnCharacterBloom) ───────────────────
// Pre-allocated pool of 5 slots — no new mesh creation on every hit
const hitEffectPoolRef = { current: createHitEffectPool() };

// ── Point light flash component (Three.js) ────────────────────────────────────
function HitPointLights({ lights }: { lights: PointLightFlash[] }) {
  return (
    <>
      {lights.map((light, i) => (
        <pointLight
          key={i}
          position={[light.x, light.y, light.z]}
          color={light.color}
          intensity={light.intensity}
          distance={2.2}
          decay={2}
        />
      ))}
    </>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export interface CombatArena3DProps {
  p1Fighter: BannonFighterProfile;
  p2Fighter: BannonFighterProfile;
  p1State: string;
  p2State: string;
  p1Animation: string;
  p2Animation: string;
  /** The clip THIS command plays — see FighterMesh.attackClip. */
  p1AttackClip?: string | null;
  p2AttackClip?: string | null;
  /**
   * Which clip each body ACTUALLY ended up playing, straight from the thing
   * that chose it. The arena needs the deliverer's real clip name to look up
   * the opponent's half of a grapple; asking a second resolver the same
   * question is how two answers start disagreeing.
   */
  onClipResolved?: (who: 'p1' | 'p2', clip: string | null, inputKey: string) => void;
  p1Color: string;
  p2Color: string;
  hitStopActive: boolean;
  p1SkinTint?: string;
  p2SkinTint?: string;
  p1Z?: number;
  p2Z?: number;
  /** Dynamic world-space X positions driven by LocomotionSystem */
  p1X?: number;
  p2X?: number;
  p1Y?: number;
  p2Y?: number;
  /** Cross-up: mesh faces away until the fighter turns or attacks. */
  p1BackTurned?: boolean;
  /**
   * Transient spin from a hit, in RADIANS, added on top of the facing yaw.
   *
   * Tekken keeps a rotation per side in its Reactions struct — a hit landing on
   * your flank turns you. Without it a side hit is a front hit played
   * off-centre, which is the single biggest reason a sidestep does not read as
   * having worked. Decays to zero, so it never fights the facing.
   */
  p1HitYaw?: number;
  p2HitYaw?: number;
  p2BackTurned?: boolean;
  cinematicPhase?: CinematicPhase;
  winnerName?: string;
  cameraFov?: number;
  announcerEnabled?: boolean;
  damageEvent?: { count: number; player: 'p1' | 'p2'; damage: number; isCounter: boolean; factionColor: string; blocked?: boolean };
  /** Knockdown event — triggers dust particle burst */
  knockdownEvent?: { count: number; player: 'p1' | 'p2' };
  /** Stage selection — defaults to 'urban_night' */
  stageId?: StageId;
  /** Animation trigger counters — increment to force re-trigger on repeated same-key attacks */
  p1AnimTrigger?: number;
  p2AnimTrigger?: number;
  /** Current fighter-state attack windows used to retime authored clips. */
  p1AttackDurationSeconds?: number;
  p2AttackDurationSeconds?: number;
  /** Locomotion velocity from FighterStateMachine — used for velocity-gated animation blending */
  p1LocomotionVelocity?: { forward: number; strafe: number };
  p2LocomotionVelocity?: { forward: number; strafe: number };
  /** Metres/second, written by the match loop. Drives foot playback rate. */
  p1GroundSpeedRef?: { current: number };
  p2GroundSpeedRef?: { current: number };
  /** When a grapple receiver is playing, match its authored clip to the deliverer's clock. */
  p1GrappleDurationSeconds?: number;
  p2GrappleDurationSeconds?: number;
  /** Callbacks to receive bone hitbox system references from FighterMesh */
  onP1BoneHitboxReady?: (system: import('../engine/locomotion/BoneHitboxSystem').BoneHitboxSystem) => void;
  onP2BoneHitboxReady?: (system: import('../engine/locomotion/BoneHitboxSystem').BoneHitboxSystem) => void;
  /** Wall-splat event — triggers wall-splat VFX */
  wallSplatEvent?: { count: number; player: 'p1' | 'p2'; wall: 'left' | 'right' };
  /** Overdrive activation event */
  overdriveEvent?: { count: number; player: 'p1' | 'p2' };
  /** Finisher cinematic event */
  finisherEvent?: { count: number; player: 'p1' | 'p2' };
  /** Camera shake offset from hit effect system */
  cameraShakeOffset?: { x: number; y: number };
  /**
   * AGENT LAW: Callback fired when either fighter fails the 14-point
   * deformation integrity test on combat entry. The parent component
   * MUST freeze combat when this fires.
   *
   * @param player - 'p1' or 'p2'
   * @param characterName - The character whose test failed
   * @param failingChecks - The IDs of the failing checks
   */
  onDeformationBlocked?: (player: 'p1' | 'p2', characterName: string, failingChecks: string[]) => void;
  /** Fired once per fighter when its real mesh is on screen (or gave up). */
  onFighterReady?: (player: 'p1' | 'p2', ok: boolean) => void;
  /** Whose pre-fight beat is playing, and what they are saying. */
  introSpeaker?: { player: 'p1' | 'p2'; line: string } | null;
}

export default function CombatArena3D({
  p1Fighter,
  p2Fighter,
  p1State,
  p2State,
  p1Animation,
  p2Animation,
  p1AttackClip,
  p2AttackClip,
  onClipResolved,
  p1Color,
  p2Color,
  hitStopActive,
  p1SkinTint,
  p2SkinTint,
  p1Z = 0,
  p2Z = 0,
  p1X: p1XProp = P1_X,
  p2X: p2XProp = P2_X,
  p1Y: p1YProp = 0,
  p2Y: p2YProp = 0,
  p1BackTurned = false,
  p1HitYaw = 0,
  p2HitYaw = 0,
  p2BackTurned = false,
  cinematicPhase = 'fight',
  winnerName,
  cameraFov = 55,
  announcerEnabled = true,
  damageEvent,
  knockdownEvent,
  stageId = 'urban_night',
  p1AnimTrigger = 0,
  p2AnimTrigger = 0,
  p1AttackDurationSeconds,
  p2AttackDurationSeconds,
  p1LocomotionVelocity,
  p2LocomotionVelocity,
  p1GroundSpeedRef,
  p2GroundSpeedRef,
  p1GrappleDurationSeconds,
  p2GrappleDurationSeconds,
  onP1BoneHitboxReady,
  onP2BoneHitboxReady,
  wallSplatEvent,
  overdriveEvent,
  finisherEvent,
  cameraShakeOffset,
  onDeformationBlocked,
  onFighterReady,
  introSpeaker,
}: CombatArena3DProps) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [screenFlash, setScreenFlash] = useState(0);
  const [hitEffectPool, setHitEffectPool] = useState<HitEffectPool>(() => createHitEffectPool());
  // Rate-limited facing, so a cross-up cannot snap the body round in one frame.
  const p1YawRef = useRef(NaN);
  const p2YawRef = useRef(NaN);
  const facingClockRef = useRef(typeof performance !== 'undefined' ? performance.now() : Date.now());

  const particleIdRef = useRef(0);
  const flashRafRef = useRef<number>(0);
  const hitEffectRafRef = useRef<number>(0);
  /** One loop at a time, however many effects spawn in the same frame. */
  const hitEffectTickingRef = useRef(false);
  /** Last rAF timestamp, so the pool is spent in real seconds. */
  const hitEffectLastTsRef = useRef(0);
  const prevDamageEventRef = useRef<typeof damageEvent>(undefined);
  const prevKnockdownEventRef = useRef<typeof knockdownEvent>(undefined);
  const prevWallSplatEventRef = useRef<typeof wallSplatEvent>(undefined);
  const prevOverdriveEventRef = useRef<typeof overdriveEvent>(undefined);
  const prevFinisherEventRef = useRef<typeof finisherEvent>(undefined);

  const { speak } = useAnnouncer(announcerEnabled);

  useEffect(() => {
    if (cinematicPhase === 'intro') {
      const t1 = setTimeout(() => speak('Round 1', 0.7, 0.85), 800);
      const t2 = setTimeout(() => speak('Fight!', 0.65, 1.0), 2200);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
    if (cinematicPhase === 'victory' && winnerName) {
      const t = setTimeout(() => speak(`${winnerName} wins!`, 0.7, 0.9), 400);
      return () => clearTimeout(t);
    }
  }, [cinematicPhase, winnerName, speak]);

  // ── Knockdown dust effect ─────────────────────────────────────────────────
  useEffect(() => {
    if (!knockdownEvent) return;
    if (prevKnockdownEventRef.current?.count === knockdownEvent.count) return;
    prevKnockdownEventRef.current = knockdownEvent;

    const { player } = knockdownEvent;
    const fighter = player === 'p1' ? p1Fighter : p2Fighter;
    const worldX = player === 'p1' ? p1XProp : p2XProp;
    const otherX = player === 'p1' ? p2XProp : p1XProp;
    const screenX = impactScreenX(worldX, otherX);
    const screenY = 470;

    const dustParticles = spawnKnockdownDust(
      screenX, screenY, particleIdRef, getCharacterHitBloom(fighter.id, '#8a7560'),
    );
    setParticles(prev => [...prev.slice(-50), ...dustParticles]);
  }, [knockdownEvent, p1Fighter, p2Fighter, p1XProp, p2XProp]);

  // ── AAA hit effect pool tick ──────────────────────────────────────────────
  //
  // THIS LOOP WAS DEAD CODE. `tick` was declared, a cleanup was registered, and
  // the first requestAnimationFrame WAS NEVER SCHEDULED — the effect body ran to
  // its `return` and that was that. So the only thing that ever advanced the
  // pool was a one-shot rAF at each spawn site, which ticked exactly once and
  // never re-armed. An orb spawned with 0.4s of life lost 1/60 of it and then
  // sat on screen until the next hit happened to tick it again.
  //
  // Owner: "the little hit effects ... staying on screen for too long." They
  // were not lingering, they were never expiring.
  //
  // It starts now, spends REAL elapsed time (see tickHitEffectPool), and stops
  // itself when nothing is active so an idle match is not paying for a state
  // update every frame. `ensureHitEffectTicking` is what the spawn sites call,
  // guarded so five events in one frame cannot stack five loops.
  const ensureHitEffectTicking = useCallback(() => {
    if (hitEffectTickingRef.current) return;
    hitEffectTickingRef.current = true;
    hitEffectLastTsRef.current = 0;
    const tick = (ts: number) => {
      const last = hitEffectLastTsRef.current;
      hitEffectLastTsRef.current = ts;
      const dt = last ? (ts - last) / 1000 : 1 / 60;
      setHitEffectPool(prev => {
        const next = tickHitEffectPool(prev, dt);
        const hasActive = next.slots.some(s => s.active) || next.cameraShake.active || next.screenFlash > 0.01;
        if (hasActive) {
          hitEffectRafRef.current = requestAnimationFrame(tick);
        } else {
          hitEffectTickingRef.current = false;
        }
        return next;
      });
    };
    hitEffectRafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => () => {
    cancelAnimationFrame(hitEffectRafRef.current);
    hitEffectTickingRef.current = false;
  }, []);

  // ── Per-character bloom hit effect on every damage event ─────────────────
  // This is the core Tekken-style per-character color bloom — fires on every
  // clean hit, block, and counter-hit. NEVER remove this effect.
  useEffect(() => {
    if (!damageEvent) return;
    if (prevDamageEventRef.current?.count === damageEvent.count) return;
    prevDamageEventRef.current = damageEvent;

    const { player, damage, isCounter, factionColor, blocked } = damageEvent;
    if (!blocked && !(damage > 0)) return;
    const attackerFighter = player === 'p2' ? p1Fighter : p2Fighter;
    const bloomColor = getCharacterHitBloom(attackerFighter.id, factionColor);
    const worldX = player === 'p1' ? p1XProp : p2XProp;
    const otherX = player === 'p1' ? p2XProp : p1XProp;
    const screenX = impactScreenX(worldX, otherX);
    const screenY = HIT_FX_SCREEN_Y + Math.random() * 16;
    const effectType: HitEffectType = blocked ? 'block' : isCounter ? 'counter_hit' : 'clean_hit';

    setHitEffectPool(prev => spawnHitEffect(prev, {
      type: effectType,
      screenX,
      screenY,
      worldX,
      worldY: HIT_FX_WORLD_Y,
      worldZ: player === 'p1' ? p1Z : p2Z,
      characterColor: bloomColor,
      attackAngle: player === 'p1' ? Math.PI : 0,
      damage,
    }));

    ensureHitEffectTicking();
  }, [damageEvent, p1Fighter, p2Fighter, p1XProp, p2XProp, p1Z, p2Z]);

  // ── Wall-splat VFX ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!wallSplatEvent) return;
    if (prevWallSplatEventRef.current?.count === wallSplatEvent.count) return;
    prevWallSplatEventRef.current = wallSplatEvent;

    const { player, wall } = wallSplatEvent;
    const worldX = wall === 'left' ? -4.2 : 4.2;
    const screenX = impactScreenX(worldX, 0);
    const screenY = HIT_FX_SCREEN_Y + 10;
    const attackerFighter = player === 'p2' ? p1Fighter : p2Fighter;
    const bloomColor = getCharacterHitBloom(attackerFighter.id, '#ffffff');

    setHitEffectPool(prev => spawnHitEffect(prev, {
      type: 'wall_splat',
      screenX, screenY,
      worldX,
      worldY: HIT_FX_WORLD_Y,
      worldZ: 0,
      characterColor: bloomColor,
      attackAngle: wall === 'left' ? 0 : Math.PI,
      damage: 150,
    }));
    ensureHitEffectTicking();
  }, [wallSplatEvent, p1Fighter, p2Fighter]);

  // ── Overdrive activation VFX ─────────────────────────────────────────────
  useEffect(() => {
    if (!overdriveEvent) return;
    if (prevOverdriveEventRef.current?.count === overdriveEvent.count) return;
    prevOverdriveEventRef.current = overdriveEvent;

    const { player } = overdriveEvent;
    const fighter = player === 'p1' ? p1Fighter : p2Fighter;
    const bloomColor = getCharacterHitBloom(fighter.id, '#ff8800');
    const worldX = player === 'p1' ? p1XProp : p2XProp;
    const otherX = player === 'p1' ? p2XProp : p1XProp;
    const screenX = impactScreenX(worldX, otherX);
    setHitEffectPool(prev => {
      let pool = prev;
      for (const angle of [-Math.PI / 2, -Math.PI / 2 + 0.55]) {
        pool = spawnHitEffect(pool, {
          type: 'clean_hit',
          screenX,
          screenY: HIT_FX_SCREEN_Y - 16,
          worldX,
          worldY: HIT_FX_WORLD_Y + 0.35,
          worldZ: 0,
          characterColor: bloomColor,
          attackAngle: angle,
          damage: 160,
        });
      }
      return pool;
    });
    ensureHitEffectTicking();
  }, [overdriveEvent, p1Fighter, p2Fighter, p1XProp, p2XProp]);

  // ── Finisher cinematic VFX ────────────────────────────────────────────────
  useEffect(() => {
    if (!finisherEvent) return;
    if (prevFinisherEventRef.current?.count === finisherEvent.count) return;
    prevFinisherEventRef.current = finisherEvent;

    const { player } = finisherEvent;
    const fighter = player === 'p1' ? p1Fighter : p2Fighter;
    const bloomColor = getCharacterHitBloom(fighter.id, '#ff0000');
    const worldX = player === 'p1' ? p1XProp : p2XProp;
    const otherX = player === 'p1' ? p2XProp : p1XProp;

    setHitEffectPool(prev => spawnHitEffect(prev, {
      type: 'counter_hit',
      screenX: impactScreenX(worldX, otherX),
      screenY: HIT_FX_SCREEN_Y,
      worldX,
      worldY: HIT_FX_WORLD_Y,
      worldZ: 0,
      characterColor: bloomColor,
      attackAngle: player === 'p1' ? 0 : Math.PI,
      damage: 300,
    }));
    setScreenFlash(0.08);
    ensureHitEffectTicking();
  }, [finisherEvent, p1Fighter, p2Fighter, p1XProp, p2XProp]);

  useEffect(() => {
    if (particles.length === 0) return;
    const interval = setInterval(() => {
      setParticles(prev => {
        const next = prev
          .map(p => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, vy: p.vy + 0.3, life: p.life - 0.016 }))
          .filter(p => p.life > 0);
        return next;
      });
    }, 16);
    return () => clearInterval(interval);
  }, [particles.length]);

  const p1XOffset = 0;
  const p2XOffset = 0;
  const p1FinalX = p1XProp + p1XOffset;
  const p2FinalX = p2XProp + p2XOffset;
  const p1FinalZ = Math.max(-Z_RANGE, Math.min(Z_RANGE, p1Z));
  const p2FinalZ = Math.max(-Z_RANGE, Math.min(Z_RANGE, p2Z));

  // Schwarzerblitz / Tekken: X fighting lane. P1 +90° faces P2, P2 −90° faces P1.
  // Camera at +Z is the 3/4. Select yaw is not used. No rest-align to camera.
  // TURN THE BODY TOWARD THE OPPONENT. These were the two locked constants,
  // so a fighter orbiting his opponent slid sideways without ever looking at
  // him — see `faceOpponentYaw` for the measurement and why this reproduces
  // the image-tested table exactly when the two are level on Z.
  // The hit spin rides ON TOP of the facing, never replaces it: the body is
  // turned by the impact and the facing pulls it back as the spin decays.
  // ── A BODY CANNOT TURN INSTANTLY, AND OURS COULD ────────────────────────
  // faceOpponentYaw is an atan2 of the two positions, written straight to the
  // mesh every frame, so when the pair crossed over or sidestepped past each
  // other a fighter SNAPPED through up to 180 degrees in ONE frame. Tekken 3
  // caps the turn at 10 degrees per frame over an eight-frame blend, always the
  // short way round (tekken3_jun_combat.c). See FacingRate.
  const p1TargetYaw = yawWithBackTurn(
    faceOpponentYaw({ x: p1FinalX, z: p1FinalZ }, { x: p2FinalX, z: p2FinalZ }, COMBAT_P1_YAW),
    p1BackTurned,
  );
  const p2TargetYaw = yawWithBackTurn(
    faceOpponentYaw({ x: p2FinalX, z: p2FinalZ }, { x: p1FinalX, z: p1FinalZ }, COMBAT_P2_YAW),
    p2BackTurned,
  );
  const facingNow = typeof performance !== 'undefined' ? performance.now() : Date.now();
  // Clamped to 8 frames so a tab-out or a stall does not hand the next frame a
  // huge elapsed time and let the body teleport round anyway.
  const facingFrames = Math.max(0.5, Math.min(8, (facingNow - facingClockRef.current) / (1000 / 60)));
  facingClockRef.current = facingNow;
  p1YawRef.current = stepFacing(p1YawRef.current, p1TargetYaw, facingFrames);
  p2YawRef.current = stepFacing(p2YawRef.current, p2TargetYaw, facingFrames);
  // The hit spin rides on top and is already transient, so it is not rate
  // limited — being knocked round is supposed to be sudden.
  const p1RotationY = p1YawRef.current + p1HitYaw;
  const p2RotationY = p2YawRef.current + p2HitYaw;

  // ── Stage-specific fog / clear color (training + urban_night stay locked) ─
  const stageCfg = resolveStageConfig(stageId);
  const fogColor = stageId === 'urban_night' || stageId === 'training' ? '#050508' : stageCfg.bgColor;
  const bgColor = stageId === 'urban_night' ? '#030305' : stageId === 'training' ? '#050508' : stageCfg.bgColor;

  return (
    <div className="relative w-full h-full">
      <Canvas
        shadows={false}
        gl={{ antialias: false, alpha: false }}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', background: bgColor }}
        camera={{ position: [0, 2.2, 7], fov: cameraFov, near: 0.1, far: 200 }}
      >
        <color attach="background" args={[bgColor]} />
        {/* FogExp2 for urban night — dense smoggy atmosphere */}
        {stageId === 'urban_night' ? (
          <fogExp2 attach="fog" args={[fogColor, 0.028]} />
        ) : stageId === 'training' ? (
          <fog attach="fog" args={[fogColor, 18, 40]} />
        ) : (
          <fog attach="fog" args={[fogColor, 28, 70]} />
        )}

        {/* ── Stage switch ── */}
        {stageId === 'urban_night' ? (
          <UrbanNightStage p1Color={p1Color} p2Color={p2Color} />
        ) : stageId === 'training' ? (
          <>
            <TrainingLighting p1Color={p1Color} p2Color={p2Color} />
            <TrainingStage p1Color={p1Color} p2Color={p2Color} />
          </>
        ) : (
          <ProceduralStage stageId={stageId} p1Color={p1Color} p2Color={p2Color} />
        )}

        {/* Blob shadows */}
        <BlobShadow x={p1FinalX} z={p1FinalZ} scale={p1State === 'KO' ? 0.7 : 1} />
        <BlobShadow x={p2FinalX} z={p2FinalZ} scale={p2State === 'KO' ? 0.7 : 1} />

        {/* ── AAA Point light flashes at impact coordinates ── */}
        <HitPointLights lights={getActivePointLights(hitEffectPool)} />

        {/* Combat: P1 yaw 0 (face +X / P2), P2 yaw π (face −X / P1). Not ±90 — that was back-to-cam / face-to-cam. */}
        <FighterMesh
          state={p1State}
          animation={resolveLocomotionPresentation(p1State, p1LocomotionVelocity, p1Animation, p1YProp)}
          modelUrl={getFighterGlbUrl(p1Fighter.id, p1Fighter.model) ?? p1Fighter.portraitUrl}
          position={[p1FinalX, COMBAT_FIGHTER_Y + p1YProp, p1FinalZ]}
          facing={1}
          rotationY={p1RotationY}
          tint={p1SkinTint ?? p1Color}
          characterId={p1Fighter.id}
          fightingStyle={p1Fighter.fightingStyle}
          animationTrigger={p1AnimTrigger}
          attackDurationSeconds={p1AttackDurationSeconds}
          locomotionVelocity={p1LocomotionVelocity}
          groundSpeedRef={p1GroundSpeedRef ?? { current: Math.hypot(p1LocomotionVelocity?.forward ?? 0, p1LocomotionVelocity?.strafe ?? 0) }}
          forcedPlaybackDurationSeconds={p1GrappleDurationSeconds}
          hitStopActive={hitStopActive}
          onBoneHitboxReady={onP1BoneHitboxReady}
          attackClip={p1AttackClip}
          onClipResolved={(clip, inputKey) => onClipResolved?.('p1', clip, inputKey)}
          onModelReady={(ok) => onFighterReady?.('p1', ok)}
          onDeformationBlocked={(characterName, failingChecks) => {
            // AGENT LAW: Log combat freeze — no UI, backend only
            console.error(
              `[CombatArena3D] 🚫 P1 DEFORMATION BLOCKED — ${characterName} | ` +
              `Failing: [${failingChecks.join(', ')}] | Combat frozen.`
            );
            onDeformationBlocked?.('p1', characterName, failingChecks);
          }}
        />

        {/* P2 faces P1 */}
        <FighterMesh
          state={p2State}
          animation={resolveLocomotionPresentation(p2State, p2LocomotionVelocity, p2Animation, p2YProp)}
          modelUrl={getFighterGlbUrl(p2Fighter.id, p2Fighter.model) ?? p2Fighter.portraitUrl}
          position={[p2FinalX, COMBAT_FIGHTER_Y + p2YProp, p2FinalZ]}
          facing={-1}
          rotationY={p2RotationY}
          tint={p2SkinTint ?? p2Color}
          characterId={p2Fighter.id}
          fightingStyle={p2Fighter.fightingStyle}
          animationTrigger={p2AnimTrigger}
          attackDurationSeconds={p2AttackDurationSeconds}
          locomotionVelocity={p2LocomotionVelocity}
          groundSpeedRef={p2GroundSpeedRef ?? { current: Math.hypot(p2LocomotionVelocity?.forward ?? 0, p2LocomotionVelocity?.strafe ?? 0) }}
          forcedPlaybackDurationSeconds={p2GrappleDurationSeconds}
          hitStopActive={hitStopActive}
          onBoneHitboxReady={onP2BoneHitboxReady}
          attackClip={p2AttackClip}
          onClipResolved={(clip, inputKey) => onClipResolved?.('p2', clip, inputKey)}
          onModelReady={(ok) => onFighterReady?.('p2', ok)}
          onDeformationBlocked={(characterName, failingChecks) => {
            // AGENT LAW: Log combat freeze — no UI, backend only
            console.error(
              `[CombatArena3D] 🚫 P2 DEFORMATION BLOCKED — ${characterName} | ` +
              `Failing: [${failingChecks.join(', ')}] | Combat frozen.`
            );
            onDeformationBlocked?.('p2', characterName, failingChecks);
          }}
        />

        <CinematicCamera
          phase={cinematicPhase}
          p1X={p1FinalX}
          p2X={p2FinalX}
          p1Z={p1FinalZ}
          p2Z={p2FinalZ}
          fov={cameraFov}
          shakeOffset={cameraShakeOffset}
        />

      </Canvas>

      <VFXOverlay
        particles={particles}
        screenFlash={screenFlash}
        hitStopActive={hitStopActive}
        hitEffectPool={hitEffectPool}
      />
      <IntroOverlay
        phase={cinematicPhase}
        p1Name={p1Fighter.name}
        p2Name={p2Fighter.name}
        speaker={introSpeaker}
        speakerName={introSpeaker?.player === 'p1' ? p1Fighter.name : p2Fighter.name}
      />
      <VictoryOverlay phase={cinematicPhase} winnerName={winnerName} />
    </div>
  );
}
