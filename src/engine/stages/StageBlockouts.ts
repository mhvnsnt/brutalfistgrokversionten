// `.ts` extensions on purpose — the repo's test runner resolves them literally.
import { STAGE_CONFIGS, stageSpawnPoints, type StageId, type StageSpawnPoints } from '../combat/StageConfig.ts';
import { HIT_FX_WORLD_Y } from '../V7OrientationContract.ts';

/**
 * CANON STAGE BLOCKOUTS — FIRST PLAYABLE GREYBOX. NOT FINAL ART.
 *
 * Eight canon stages the owner listed (Black Swamp, JPCW Arena, Club Onyx, the
 * Presidential Debate at the Kennedy Center, Void Ring, Aztec Temple, Parking
 * Lot, the Great Banyan Tree) had no geometry at all. Each is described here
 * as plain data: primitives, practical lights, the combat floor and spawns.
 * `blockoutToObject3D` (stageBlockoutThree.ts) turns it into a THREE.Group and
 * `ProceduralStage` renders that, so a test builds exactly what the game draws.
 *
 * THE ENGINE CONTRACT EVERY BLOCKOUT KEEPS
 *  - Combat floor top at y = 0 (StageConfig levels[0].floorY). Anything lower
 *    (arena floor round a ring, audience pit) sits BELOW 0, never above.
 *  - Fight plane z = 0. The lane |x| < boundaryX, |z| <= FIGHT_LANE_HALF_DEPTH,
 *    0 < y < FIGHT_LANE_HEIGHT is kept clear of props, so a hit spark at
 *    HIT_FX_WORLD_Y (1.05) is never buried inside scenery.
 *  - Spawns at x = ±STAGE_SPAWN_X on the fight plane.
 *  - Ring stages: 3.5 m half-width canvas, ropes on the boundary.
 *  - A FIXED count of practical lights per stage (three.js recompiles every
 *    material when the light count changes, see ProceduralStage).
 */

export const BLOCKOUT_STATUS = 'BLOCKOUT' as const;
/** The engine's hit-spark height (CombatArena3D reads the same constant). */
export { HIT_FX_WORLD_Y };
export const FIGHT_LANE_HALF_DEPTH = 0.6;
export const FIGHT_LANE_HEIGHT = 2.2;
/** Canon ring half-width. */
export const RING_HALF = 3.5;
/** Practical lights per blockout. Constant on purpose. */
export const BLOCKOUT_LIGHTS = 4;

type V3 = [number, number, number];

/** `role` lets the tests tell scenery from the floor and the ring boundary. */
export type PrimRole = 'floor' | 'under' | 'boundary' | 'prop' | 'fx';

export type BlockoutPrim =
  | { kind: 'box'; p: V3; s: V3; c: string; e?: string; ei?: number; rot?: V3; role: PrimRole; opacity?: number }
  | { kind: 'cyl'; p: V3; args: [number, number, number, number]; c: string; e?: string; ei?: number; rot?: V3; role: PrimRole }
  | { kind: 'sphere'; p: V3; r: number; c: string; e?: string; ei?: number; scale?: V3; role: PrimRole }
  | { kind: 'plane'; p: V3; size: [number, number]; c: string; opacity?: number; e?: string; ei?: number; role: PrimRole };

export interface BlockoutLight { p: V3; color: string; intensity: number; distance: number }

export interface StageBlockout {
  id: BlockoutStageId;
  status: typeof BLOCKOUT_STATUS;
  /** The walkable combat floor: top surface y and its half extents. */
  floor: { y: number; halfW: number; halfD: number };
  /** Full visual ground footprint in metres (Banyan: 60 x 60). */
  ground: { w: number; d: number; c: string };
  /** Sky dome radius — must enclose the ground. */
  skyRadius: number;
  prims: BlockoutPrim[];
  lights: BlockoutLight[];
  spawn: StageSpawnPoints;
  fightPlaneZ: 0;
  hitFxY: number;
}

export const BLOCKOUT_STAGE_IDS = [
  'black_swamp', 'jpcw_arena', 'club_onyx', 'kennedy_debate',
  'void_ring', 'aztec_temple', 'parking_lot', 'banyan_tree',
] as const satisfies readonly Exclude<StageId, 'random'>[];
export type BlockoutStageId = typeof BLOCKOUT_STAGE_IDS[number];

export function isBlockoutStage(id: string): id is BlockoutStageId {
  return (BLOCKOUT_STAGE_IDS as readonly string[]).includes(id);
}

// ── tiny builders ───────────────────────────────────────────────────────────
const box = (p: V3, s: V3, c: string, o: Partial<Extract<BlockoutPrim, { kind: 'box' }>> = {}): BlockoutPrim =>
  ({ kind: 'box', p, s, c, role: 'prop', ...o });
const cyl = (p: V3, args: [number, number, number, number], c: string, o: Partial<Extract<BlockoutPrim, { kind: 'cyl' }>> = {}): BlockoutPrim =>
  ({ kind: 'cyl', p, args, c, role: 'prop', ...o });
const sph = (p: V3, r: number, c: string, o: Partial<Extract<BlockoutPrim, { kind: 'sphere' }>> = {}): BlockoutPrim =>
  ({ kind: 'sphere', p, r, c, role: 'prop', ...o });
const plane = (p: V3, size: [number, number], c: string, o: Partial<Extract<BlockoutPrim, { kind: 'plane' }>> = {}): BlockoutPrim =>
  ({ kind: 'plane', p, size, c, role: 'fx', ...o });
const light = (p: V3, color: string, intensity: number, distance: number): BlockoutLight => ({ p, color, intensity, distance });

/** A floor slab whose TOP is exactly y = 0. */
const floorSlab = (w: number, d: number, c: string, thick = 0.1): BlockoutPrim =>
  box([0, -thick / 2, 0], [w, thick, d], c, { role: 'floor' });

/** Deterministic PRNG so a blockout is identical every build. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A 7 m wrestling ring: canvas top at y = 0, ropes/posts on ±RING_HALF. */
function ring(accent: string, canvas: string, apronBelow = 1.0): BlockoutPrim[] {
  const out: BlockoutPrim[] = [];
  const W = RING_HALF * 2;
  out.push(box([0, -0.05, 0], [W, 0.1, W], canvas, { role: 'floor' }));
  out.push(box([0, -0.1 - apronBelow / 2, 0], [W + 0.6, apronBelow, W + 0.6], '#18181b', { role: 'under', e: accent, ei: 0.06 }));
  for (const [i, y] of [0.42, 0.82, 1.22].entries()) {
    const c = i === 1 ? '#f4f4f5' : accent;
    for (const s of [-1, 1]) {
      out.push(box([0, y, RING_HALF * s], [W, 0.045, 0.045], c, { role: 'boundary', e: accent, ei: 0.2 }));
      out.push(box([RING_HALF * s, y, 0], [0.045, 0.045, W], c, { role: 'boundary', e: accent, ei: 0.2 }));
    }
  }
  for (const x of [-1, 1]) for (const z of [-1, 1]) {
    out.push(cyl([RING_HALF * x, 0.72, RING_HALF * z], [0.1, 0.12, 1.44, 8], '#d4d4d8', { role: 'boundary' }));
    out.push(box([RING_HALF * x, 1.4, RING_HALF * z], [0.3, 0.2, 0.3], accent, { role: 'boundary', e: accent, ei: 0.4 }));
  }
  return out;
}

/** Tiered crowd blocks round a ring, standing on the arena floor below it. */
function crowd(floorY: number, radius: number, seed: number, tint: string): BlockoutPrim[] {
  const r = rng(seed);
  const out: BlockoutPrim[] = [];
  for (let tier = 0; tier < 3; tier++) {
    const rr = radius + tier * 1.4;
    const h = 0.6 + tier * 0.7;
    for (const side of [-1, 1]) {
      out.push(box([side * rr, floorY + h / 2, 0], [1.2, h, rr * 2], '#141418', { role: 'prop' }));
      for (let i = 0; i < 9; i++) {
        const z = -rr + 0.8 + (i / 8) * (rr * 2 - 1.6);
        out.push(cyl([side * rr, floorY + h + 0.45, z], [0.18, 0.2, 0.9, 6], r() > 0.7 ? tint : '#27272a', { role: 'prop' }));
      }
    }
    out.push(box([0, floorY + h / 2, -rr], [rr * 2, h, 1.2], '#141418', { role: 'prop' }));
  }
  return out;
}

// ── the eight stages ────────────────────────────────────────────────────────

function blackSwamp(): Omit<StageBlockout, 'id' | 'status' | 'spawn' | 'fightPlaneZ' | 'hitFxY'> {
  const r = rng(7001);
  const prims: BlockoutPrim[] = [floorSlab(14, 9, '#2a2014')];
  // puddles of standing water on the mud (flush, a hair above so no z-fight)
  for (let i = 0; i < 7; i++) {
    prims.push(plane([(r() - 0.5) * 12, 0.004, (r() - 0.5) * 7], [0.8 + r() * 1.6, 0.5 + r() * 1.2], '#0b1410', { opacity: 0.85, role: 'floor' }));
  }
  // dead cypress trees framing the lane (outside |x| > 5.6 or behind z < -3.6)
  for (let i = 0; i < 16; i++) {
    const behind = i < 8;
    const x = behind ? (r() - 0.5) * 18 : (i % 2 ? 1 : -1) * (5.8 + r() * 4);
    const z = behind ? -3.8 - r() * 6 : (r() - 0.5) * 8;
    const h = 4 + r() * 5;
    prims.push(cyl([x, h / 2, z], [0.12, 0.35, h, 7], '#1c1a14'));
    prims.push(box([x + 0.5, h * 0.72, z], [1.4, 0.1, 0.1], '#1c1a14', { rot: [0, r() * 3, 0.5] }));
    prims.push(box([x - 0.4, h * 0.55, z], [1.1, 0.08, 0.08], '#1c1a14', { rot: [0, r() * 3, -0.6] }));
  }
  // gothic ruin: a broken chapel wall with pointed arches behind the fight
  prims.push(box([0, 2.5, -8.5], [12, 5, 0.6], '#262a2c'));
  for (const x of [-4, 0, 4]) {
    prims.push(box([x, 2.0, -8.15], [1.4, 3.0, 0.2], '#0a0d0c'));
    prims.push(box([x, 3.8, -8.15], [1.0, 1.0, 0.2], '#0a0d0c', { rot: [0, 0, Math.PI / 4] }));
  }
  for (const x of [-6.3, 6.3]) prims.push(box([x, 3.5, -8.5], [0.9, 7, 0.9], '#1f2325'));
  prims.push(box([-5.4, 5.6, -8.5], [1.2, 1.2, 0.6], '#262a2c', { rot: [0, 0, Math.PI / 4] }));
  // fallen cypress logs at both ends of the lane — the walls a fighter splats on
  for (const sx of [-1, 1]) prims.push(cyl([sx * 5.45, 0.35, 0], [0.35, 0.4, 8, 10], '#241d14', { rot: [Math.PI / 2, 0, 0] }));
  // iron graveyard fence at the back of the lane
  for (let i = 0; i < 15; i++) prims.push(box([-7 + i, 0.6, -4.2], [0.05, 1.2, 0.05], '#111315'));
  prims.push(box([0, 1.05, -4.2], [14.2, 0.05, 0.05], '#111315'));
  // low fog banks — translucent, below the knee, never in front of the hit height
  for (const [y, o] of [[0.25, 0.22], [0.6, 0.14]] as const) {
    prims.push(plane([0, y, -1.5], [30, 16], '#a7b8a0', { opacity: o }));
  }
  const lights = [
    light([-4.5, 1.8, -3.2], '#7cff9a', 2.2, 9),
    light([4.5, 1.8, -3.2], '#4ade80', 2.2, 9),
    light([0, 4.5, -7.5], '#9fb58a', 1.6, 12),
    light([0, 0.6, 2.5], '#6b8f3a', 1.2, 8),
  ];
  // bioluminescent marsh lanterns at the two side lights
  prims.push(sph([-4.5, 1.8, -3.2], 0.14, '#7cff9a', { e: '#7cff9a', ei: 2 }));
  prims.push(sph([4.5, 1.8, -3.2], 0.14, '#4ade80', { e: '#4ade80', ei: 2 }));
  return { floor: { y: 0, halfW: 7, halfD: 4.5 }, ground: { w: 40, d: 30, c: '#15110b' }, skyRadius: 42, prims, lights };
}

function jpcwArena(accent: string) {
  const ARENA_FLOOR = -1.1;
  const prims: BlockoutPrim[] = [...ring(accent, '#e7e5e4', 1.0)];
  // JPCW logo ring on the canvas
  prims.push(plane([0, 0.004, 0], [2.6, 2.6], accent, { opacity: 0.35, role: 'floor', e: accent, ei: 0.3 }));
  // arena floor round the ring, and the barricade
  prims.push(box([0, ARENA_FLOOR - 0.05, 0], [26, 0.1, 22], '#111114', { role: 'under' }));
  for (const s of [-1, 1]) {
    prims.push(box([s * 5.4, ARENA_FLOOR + 0.55, 0], [0.12, 1.1, 11], '#27272a', { role: 'under' }));
    prims.push(box([0, ARENA_FLOOR + 0.55, s * 5.4], [11, 1.1, 0.12], '#27272a', { role: 'under' }));
  }
  prims.push(...crowd(ARENA_FLOOR, 7.5, 7002, accent));
  // the big screens: titantron and two side screens, emissive
  prims.push(box([0, 5.2, -11.5], [9, 4.2, 0.3], '#050507', { e: '#38bdf8', ei: 0.9 }));
  prims.push(box([0, 2.2, -11.5], [11, 1.4, 1.0], '#18181b'));
  for (const s of [-1, 1]) prims.push(box([s * 8.5, 5.5, -9.5], [4, 2.4, 0.2], '#050507', { e: accent, ei: 0.8, rot: [0, -s * 0.5, 0] }));
  // entrance ramp to the ring
  prims.push(box([0, ARENA_FLOOR + 0.3, -8.2], [2.2, 0.6, 5], '#1c1917'));
  // lighting truss over the ring
  prims.push(box([0, 7.5, 0], [9, 0.3, 0.3], '#3f3f46'));
  prims.push(box([0, 7.5, 0], [0.3, 0.3, 9], '#3f3f46'));
  const lights = [
    light([0, 6.8, 0], '#ffffff', 3.2, 14),
    light([-3, 5, 3], accent, 1.6, 12),
    light([3, 5, 3], '#38bdf8', 1.6, 12),
    light([0, 5, -10.5], '#38bdf8', 2.0, 10),
  ];
  return { floor: { y: 0, halfW: RING_HALF, halfD: RING_HALF }, ground: { w: 30, d: 28, c: '#0c0c0e' }, skyRadius: 42, prims, lights };
}

function clubOnyx(palette: string[]) {
  const prims: BlockoutPrim[] = [floorSlab(12, 8, '#141016')];
  // lit dance-floor tiles (flush with the floor top)
  for (let x = -4; x <= 4; x++) for (let z = -2; z <= 2; z++) {
    const c = palette[(x + z + 20) % palette.length];
    prims.push(plane([x * 1.05, 0.003, z * 1.05], [1.0, 1.0], c, { opacity: 0.55, e: c, ei: 0.45, role: 'floor' }));
  }
  // back wall with the CLUB ONYX neon sign
  prims.push(box([0, 2.5, -4.6], [14, 5, 0.3], '#0b0710'));
  prims.push(box([0, 3.6, -4.4], [4.2, 0.7, 0.08], palette[0], { e: palette[0], ei: 1.6 }));
  prims.push(box([0, 2.9, -4.4], [2.6, 0.18, 0.06], palette[1], { e: palette[1], ei: 1.4 }));
  // DJ booth (upstage centre, behind the lane)
  prims.push(box([0, 0.55, -3.6], [2.4, 1.1, 0.8], '#1f1a24', { e: palette[2], ei: 0.25 }));
  // bar counter (stage left, beyond the wall line) and bottles
  prims.push(box([-6.2, 0.55, 0], [0.9, 1.1, 6], '#2a1d14'));
  for (let i = 0; i < 8; i++) prims.push(cyl([-6.3, 1.25, -2.6 + i * 0.75], [0.05, 0.06, 0.3, 6], palette[i % palette.length], { e: palette[i % palette.length], ei: 0.8 }));
  // the pole (canon: the Messiah's Drop off the stripper pole) — stage right, off the lane
  prims.push(cyl([5.2, 2.2, -1.8], [0.05, 0.05, 4.4, 10], '#e5e7eb'));
  prims.push(cyl([5.2, 0.1, -1.8], [0.6, 0.6, 0.2, 16], '#27272a'));
  // VIP booths along the right wall
  for (const z of [-2.2, 0, 2.2]) prims.push(box([6.4, 0.45, z], [1.2, 0.9, 1.6], '#3b0a2a'));
  for (const s of [-1, 1]) prims.push(box([s * 7.2, 2.5, 0], [0.3, 5, 9], '#0b0710'));
  // VIP railings: the walls of the dance floor at ±4.5
  for (const sx of [-1, 1]) prims.push(box([sx * 4.75, 0.5, 0], [0.1, 1.0, 6], '#d4d4d8', { e: palette[1], ei: 0.3 }));
  // mirror ball
  prims.push(sph([0, 4.6, 0], 0.35, '#e5e7eb', { e: '#ffffff', ei: 0.4 }));
  const lights = [
    light([-3.5, 3.2, -3.8], palette[0], 3.0, 10),
    light([3.5, 3.2, -3.8], palette[1], 3.0, 10),
    light([0, 4.2, 0], palette[2], 2.2, 10),
    light([-6, 1.6, 0], palette[3 % palette.length], 1.6, 7),
  ];
  return { floor: { y: 0, halfW: 6, halfD: 4 }, ground: { w: 24, d: 18, c: '#07050a' }, skyRadius: 42, prims, lights };
}

function kennedyDebate() {
  const AUD = -1.2;
  const prims: BlockoutPrim[] = [floorSlab(13, 7.5, '#1e2a4a', 0.12)];
  // stage apron down to the audience floor
  prims.push(box([0, AUD / 2 - 0.06, 0], [13, -AUD, 7.5], '#141c33', { role: 'under' }));
  prims.push(box([0, AUD - 0.05, 8], [30, 0.1, 12], '#10131c', { role: 'under' }));
  // the seal on the stage
  prims.push(plane([0, 0.004, 0], [2.4, 2.4], '#c9a227', { opacity: 0.5, role: 'floor' }));
  // two podiums upstage, clear of the fight lane
  for (const s of [-1, 1]) {
    prims.push(box([s * 2.6, 0.6, -2.3], [0.9, 1.2, 0.6], '#e5e7eb'));
    prims.push(box([s * 2.6, 0.9, -2.0], [0.6, 0.3, 0.05], '#1d4ed8', { e: '#1d4ed8', ei: 0.3 }));
    prims.push(cyl([s * 2.6, 1.3, -2.1], [0.01, 0.01, 0.35, 4], '#111827', { rot: [0.5, 0, 0] }));
  }
  // moderator desk in front of the stage, down in the pit
  prims.push(box([0, AUD + 0.45, 4.8], [3.2, 0.9, 0.9], '#0f172a'));
  // backdrop: flag bands and stars
  prims.push(box([0, 3.2, -3.9], [13, 6.4, 0.2], '#0b1f4d'));
  for (let i = 0; i < 6; i++) prims.push(box([0, 0.8 + i * 0.5, -3.78], [13, 0.22, 0.04], i % 2 ? '#f8fafc' : '#b91c1c'));
  for (let i = 0; i < 18; i++) prims.push(sph([-6 + (i % 9) * 1.5, 4.6 + Math.floor(i / 9) * 0.9, -3.75], 0.1, '#f8fafc', { e: '#f8fafc', ei: 0.6 }));
  // set flats at the stage wings — the walls at ±5.0
  for (const sx of [-1, 1]) prims.push(box([sx * 5.2, 1.6, -0.4], [0.4, 3.2, 5.5], '#15213f', { e: '#3b82f6', ei: 0.08 }));
  // pyro columns at the stage corners
  for (const s of [-1, 1]) {
    prims.push(cyl([s * 6.0, 0.5, -3.2], [0.35, 0.4, 1.0, 10], '#27272a'));
    prims.push(cyl([s * 6.0, 1.9, -3.2], [0.05, 0.3, 1.8, 10], '#ff7a18', { e: '#ff7a18', ei: 1.8 }));
  }
  // broadcast cameras on tripods, downstage in the pit
  for (const x of [-4.5, 0, 4.5]) {
    const z = x === 0 ? 6.5 : 5.2;
    prims.push(cyl([x, AUD + 0.7, z], [0.04, 0.08, 1.4, 6], '#111827'));
    prims.push(box([x, AUD + 1.55, z], [0.35, 0.3, 0.6], '#1f2937'));
    prims.push(cyl([x, AUD + 1.55, z - 0.36], [0.09, 0.09, 0.14, 10], '#0ea5e9', { rot: [Math.PI / 2, 0, 0], e: '#0ea5e9', ei: 0.5 }));
  }
  // audience rows
  for (let row = 0; row < 3; row++) prims.push(box([0, AUD + 0.35 + row * 0.4, 9 + row * 1.2], [16, 0.7 + row * 0.8, 0.9], '#1f2937'));
  const lights = [
    light([-6, 2.2, -3.2], '#ff7a18', 2.4, 9),
    light([6, 2.2, -3.2], '#ff7a18', 2.4, 9),
    light([0, 6, 2], '#f8fafc', 2.6, 14),
    light([0, 3.5, -3.4], '#3b82f6', 1.4, 9),
  ];
  return { floor: { y: 0, halfW: 6.5, halfD: 3.75 }, ground: { w: 32, d: 26, c: '#0a0d16' }, skyRadius: 42, prims, lights };
}

function voidRing(accent: string) {
  const r = rng(7005);
  const prims: BlockoutPrim[] = [...ring(accent, '#1e1b2e', 0.6)];
  prims.push(plane([0, 0.004, 0], [6.6, 6.6], accent, { opacity: 0.12, role: 'floor', e: accent, ei: 0.4 }));
  // glowing ring skirt edge floating over nothing
  for (const s of [-1, 1]) {
    prims.push(box([0, -0.12, s * (RING_HALF + 0.32)], [RING_HALF * 2 + 0.7, 0.04, 0.04], accent, { role: 'under', e: accent, ei: 1.4 }));
    prims.push(box([s * (RING_HALF + 0.32), -0.12, 0], [0.04, 0.04, RING_HALF * 2 + 0.7], accent, { role: 'under', e: accent, ei: 1.4 }));
  }
  // drifting shards of structure in the void, far from the ring
  for (let i = 0; i < 22; i++) {
    const a = r() * Math.PI * 2;
    const d = 9 + r() * 16;
    prims.push(box([Math.cos(a) * d, -4 + r() * 12, Math.sin(a) * d - 4], [0.4 + r() * 1.5, 0.4 + r() * 2.5, 0.4 + r() * 1.5], '#0f0d1a',
      { rot: [r() * 3, r() * 3, r() * 3], e: r() > 0.6 ? '#22d3ee' : accent, ei: 0.25 }));
  }
  const lights = [
    light([0, 5.5, 0], '#ede9fe', 2.8, 12),
    light([-4, 2, 4], accent, 1.6, 10),
    light([4, 2, 4], '#22d3ee', 1.6, 10),
    light([0, -2.5, 0], accent, 1.4, 8),
  ];
  return { floor: { y: 0, halfW: RING_HALF, halfD: RING_HALF }, ground: { w: 0, d: 0, c: '#000000' }, skyRadius: 42, prims, lights };
}

function aztecTemple() {
  const r = rng(7006);
  const prims: BlockoutPrim[] = [floorSlab(13, 8.5, '#5b4a36', 0.2)];
  for (let x = -6; x <= 6; x += 1.5) for (let z = -3.75; z <= 3.75; z += 1.5) {
    prims.push(plane([x, 0.003, z], [1.42, 1.42], r() > 0.5 ? '#6b5842' : '#4e3f2e', { opacity: 1, role: 'floor' }));
  }
  // pillars both sides, outside the walls
  for (const s of [-1, 1]) for (const z of [-3, 0, 3]) {
    prims.push(box([s * 5.25, 2.2, z], [0.9, 4.4, 0.9], '#6b5a44'));
    prims.push(box([s * 5.25, 4.55, z], [1.2, 0.3, 1.2], '#7a6850'));
    prims.push(box([s * 5.4, 0.15, z], [0.9, 0.3, 1.2], '#7a6850'));
  }
  // lintels
  for (const s of [-1, 1]) prims.push(box([s * 5.25, 4.85, 0], [1.0, 0.35, 7.2], '#5b4a36'));
  // stepped pyramid behind the arena
  for (let i = 0; i < 6; i++) prims.push(box([0, 0.6 + i * 1.2, -9 - i * 0.2], [14 - i * 2, 1.2, 6 - i * 0.8], i % 2 ? '#5b4a36' : '#6b5842'));
  prims.push(box([0, 8.2, -10.2], [2.2, 1.6, 1.8], '#3f3326'));
  // stair up the front of the pyramid
  prims.push(box([0, 3.2, -6.4], [2, 0.3, 6.5], '#7a6850', { rot: [0.72, 0, 0] }));
  // serpent heads flanking the stair, braziers at the four lights
  for (const s of [-1, 1]) prims.push(box([s * 1.6, 0.6, -5.8], [0.8, 0.8, 1.2], '#4e5b3a'));
  for (const [x, z] of [[-4.6, -3.8], [4.6, -3.8]] as const) {
    prims.push(cyl([x, 0.6, z], [0.35, 0.25, 1.2, 8], '#3f3326'));
    prims.push(sph([x, 1.35, z], 0.28, '#ff9a3c', { e: '#ff9a3c', ei: 2 }));
  }
  const lights = [
    light([-4.6, 1.6, -3.8], '#ff9a3c', 2.6, 10),
    light([4.6, 1.6, -3.8], '#ff9a3c', 2.6, 10),
    light([0, 9.5, -10], '#ffd166', 2.0, 14),
    light([0, 3, 3.5], '#fde68a', 1.2, 10),
  ];
  return { floor: { y: 0, halfW: 6.5, halfD: 4.25 }, ground: { w: 36, d: 30, c: '#2e2519' }, skyRadius: 42, prims, lights };
}

function parkingLot() {
  const r = rng(7007);
  const prims: BlockoutPrim[] = [floorSlab(16, 10, '#3a3a3c')];
  // painted bay lines and a fire lane
  for (let i = -3; i <= 3; i++) {
    prims.push(plane([i * 2.6, 0.003, -3.9], [0.1, 2.2], '#e5e7eb', { opacity: 0.8, role: 'floor' }));
    prims.push(plane([i * 2.6, 0.003, 3.9], [0.1, 2.2], '#e5e7eb', { opacity: 0.8, role: 'floor' }));
  }
  prims.push(plane([0, 0.003, 0], [11, 0.12], '#facc15', { opacity: 0.7, role: 'floor' }));
  // parked cars in the bays — never in the fight lane
  const carColors = ['#7f1d1d', '#1e3a8a', '#e5e7eb', '#111827', '#065f46', '#78350f'];
  const bays = [-6.5, -3.9, -1.3, 1.3, 3.9, 6.5];
  for (const [i, x] of bays.entries()) for (const z of [-4.2, 4.2]) {
    if (r() < 0.25) continue;
    const c = carColors[(i + (z > 0 ? 3 : 0)) % carColors.length];
    prims.push(box([x, 0.55, z], [1.8, 0.7, 4.2], c));
    prims.push(box([x, 1.15, z + (z > 0 ? 0.3 : -0.3)], [1.6, 0.55, 2.2], '#0f172a'));
    for (const wx of [-0.85, 0.85]) for (const wz of [-1.3, 1.3]) {
      prims.push(cyl([x + wx, 0.32, z + wz], [0.32, 0.32, 0.22, 10], '#09090b', { rot: [0, 0, Math.PI / 2] }));
    }
  }
  // a car sideways at each end: these ARE the walls the fighters splat against
  for (const s of [-1, 1]) {
    prims.push(box([s * 7.6, 0.55, 0], [4.2, 0.7, 1.8], s < 0 ? '#52525b' : '#991b1b'));
    prims.push(box([s * 7.6, 1.15, 0], [2.2, 0.55, 1.6], '#0f172a'));
  }
  // concrete pillars and the deck above
  for (const x of [-7.8, 0, 7.8]) for (const z of [-6.5, 6.5]) prims.push(box([x, 1.8, z], [0.6, 3.6, 0.6], '#52525b'));
  prims.push(box([0, 3.75, -6.5], [17, 0.3, 1.2], '#3f3f46'));
  // sodium lamp posts
  for (const x of [-5, 5]) {
    prims.push(cyl([x, 2.4, -2.9], [0.06, 0.08, 4.8, 6], '#27272a'));
    prims.push(box([x, 4.8, -2.6], [0.5, 0.12, 0.8], '#27272a', { e: '#fcd34d', ei: 1.4 }));
  }
  // parking barrier arm
  prims.push(box([0, 0.9, -6.0], [4, 0.1, 0.1], '#facc15', { e: '#facc15', ei: 0.3 }));
  const lights = [
    light([-5, 4.6, -2.6], '#fcd34d', 3.0, 11),
    light([5, 4.6, -2.6], '#fcd34d', 3.0, 11),
    light([0, 3.4, -6.2], '#94a3b8', 1.4, 9),
    light([0, 1.2, 4.5], '#f0d080', 1.0, 8),
  ];
  return { floor: { y: 0, halfW: 8, halfD: 5 }, ground: { w: 34, d: 26, c: '#232325' }, skyRadius: 42, prims, lights };
}

/**
 * THE GREAT BANYAN TREE — the biggest stage. Canon: a 60 x 60 m open space in
 * Sector 7, a Mother Tree whose roots the final battles are fought among, and
 * the Banyan Ring lit by bioluminescent fungi. The fight lane is the clearing
 * in front of the trunk; the buttress roots curl round both ends of it.
 */
function banyanTree() {
  const r = rng(7008);
  const SIZE = 60;
  const prims: BlockoutPrim[] = [floorSlab(SIZE, SIZE, '#1f2a17', 0.2)];
  // packed-earth clearing where the fights happen
  prims.push(plane([0, 0.003, 0], [16, 9], '#3a2e1f', { opacity: 1, role: 'floor' }));
  // THE TRUNK: a fused column of stems, far upstage
  const TZ = -16;
  prims.push(cyl([0, 11, TZ], [3.2, 4.6, 22, 14], '#3b2a1c'));
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    prims.push(cyl([Math.cos(a) * 3.4, 9, TZ + Math.sin(a) * 3.0], [0.7, 1.2, 18, 8], '#35251a'));
  }
  // canopy: broad flattened domes
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const d = i === 0 ? 0 : 9 + r() * 6;
    prims.push(sph([Math.cos(a) * d, 21 + r() * 4, TZ + Math.sin(a) * d * 0.8], 8 + r() * 5, i % 2 ? '#1e3b1f' : '#244a25', { scale: [1.4, 0.45, 1.2] }));
  }
  // big limbs reaching out over the clearing
  for (let i = 0; i < 6; i++) {
    const s = i % 2 ? 1 : -1;
    prims.push(box([s * (6 + i * 1.2), 15 - i * 0.6, TZ + 4 + i * 1.5], [12, 0.9, 0.9], '#3b2a1c', { rot: [0, s * 0.3, s * 0.22] }));
  }
  // aerial prop roots hanging to the ground all round (never in the lane)
  for (let i = 0; i < 70; i++) {
    const x = (r() - 0.5) * 44;
    const z = TZ + 10 - r() * 20;
    if (Math.abs(x) < 8.5 && z > -5) continue;
    const h = 6 + r() * 11;
    prims.push(cyl([x, h / 2, z], [0.08, 0.18, h, 5], '#4a3626'));
  }
  // BUTTRESS ROOTS: ridges radiating from the trunk; two big ones curl round
  // the ends of the lane at |x| ~ 7.6 and form the arena walls.
  for (let i = 0; i < 14; i++) {
    const a = Math.PI * (0.05 + (i / 13) * 0.9);
    // stop every root short of the clearing (z > -4.5), measured along its own direction
    const len = Math.min(14 + r() * 8, 11.0 / Math.max(Math.sin(a), 0.05) - 3);
    const cx = Math.cos(a) * (len / 2 + 3);
    const cz = TZ + Math.sin(a) * (len / 2 + 3);
    prims.push(box([cx, 0.5, cz], [len, 1.0 + r() * 0.8, 0.9], '#3b2a1c', { rot: [0, -a, 0] }));
  }
  for (const s of [-1, 1]) {
    prims.push(box([s * 7.7, 0.8, 0], [1.2, 1.6, 9.5], '#3b2a1c'));
    prims.push(box([s * 7.4, 1.8, -3.2], [1.0, 0.9, 3.2], '#35251a', { rot: [0, s * 0.4, 0] }));
    prims.push(cyl([s * 8.4, 0.6, 4.4], [0.5, 0.8, 1.2, 8], '#35251a'));
  }
  // bioluminescent fungi clustered on the roots
  const fungi = ['#5eead4', '#a7f3d0', '#86efac'];
  for (let i = 0; i < 60; i++) {
    const s = r() > 0.5 ? 1 : -1;
    const onWall = i < 24;
    const x = onWall ? s * (7.2 + r() * 0.9) : (r() - 0.5) * 30;
    const z = onWall ? (r() - 0.5) * 9 : TZ + 8 - r() * 14;
    const c = fungi[i % fungi.length];
    prims.push(sph([x, onWall ? 0.3 + r() * 1.4 : 0.15 + r() * 0.8, z], 0.06 + r() * 0.1, c, { e: c, ei: 2.2 }));
  }
  const lights = [
    light([-7.4, 1.2, 0], '#5eead4', 2.6, 11),
    light([7.4, 1.2, 0], '#86efac', 2.6, 11),
    light([0, 14, TZ + 6], '#d9f99d', 2.4, 30),
    light([0, 2.5, TZ + 4], '#a7f3d0', 2.0, 16),
  ];
  return { floor: { y: 0, halfW: SIZE / 2, halfD: SIZE / 2 }, ground: { w: SIZE, d: SIZE, c: '#1a2413' }, skyRadius: 70, prims, lights };
}

/** Build the blockout for one canon stage. Pure; deterministic; never throws for a listed id. */
export function buildStageBlockout(id: BlockoutStageId): StageBlockout {
  const cfg = STAGE_CONFIGS[id];
  const accent = cfg.accentColor;
  const body = (() => {
    switch (id) {
      case 'black_swamp': return blackSwamp();
      case 'jpcw_arena': return jpcwArena(accent);
      case 'club_onyx': return clubOnyx(cfg.neonPalette ?? [accent]);
      case 'kennedy_debate': return kennedyDebate();
      case 'void_ring': return voidRing(accent);
      case 'aztec_temple': return aztecTemple();
      case 'parking_lot': return parkingLot();
      case 'banyan_tree': return banyanTree();
    }
  })();
  return { id, status: BLOCKOUT_STATUS, ...body, spawn: stageSpawnPoints(cfg), fightPlaneZ: 0, hitFxY: HIT_FX_WORLD_Y };
}

/** Rotate v by Euler XYZ (three.js default order). */
function rotXYZ(v: V3, r: V3): V3 {
  const [a, b, c] = r;
  const [ca, sa, cb, sb, cc, sc] = [Math.cos(a), Math.sin(a), Math.cos(b), Math.sin(b), Math.cos(c), Math.sin(c)];
  // R = Rx * Ry * Rz
  const m = [
    [cb * cc, -cb * sc, sb],
    [ca * sc + sa * sb * cc, ca * cc - sa * sb * sc, -sa * cb],
    [sa * sc - ca * sb * cc, sa * cc + ca * sb * sc, ca * cb],
  ];
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ];
}

/** World axis-aligned bounds of a primitive, rotation included. */
export function primBounds(p: BlockoutPrim): { min: V3; max: V3 } {
  const half: V3 = p.kind === 'box' ? [p.s[0] / 2, p.s[1] / 2, p.s[2] / 2]
    : p.kind === 'cyl' ? [Math.max(p.args[0], p.args[1]), p.args[2] / 2, Math.max(p.args[0], p.args[1])]
    : p.kind === 'sphere' ? [p.r * (p.scale?.[0] ?? 1), p.r * (p.scale?.[1] ?? 1), p.r * (p.scale?.[2] ?? 1)]
    : [p.size[0] / 2, 0, p.size[1] / 2];
  const rot = (p.kind === 'box' || p.kind === 'cyl') ? p.rot : undefined;
  const min: V3 = [Infinity, Infinity, Infinity];
  const max: V3 = [-Infinity, -Infinity, -Infinity];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const local: V3 = [half[0] * sx, half[1] * sy, half[2] * sz];
    const w = rot ? rotXYZ(local, rot) : local;
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], p.p[k] + w[k]);
      max[k] = Math.max(max[k], p.p[k] + w[k]);
    }
  }
  return { min, max };
}
