/**
 * Hit sparks are a Tekken contact flash, drawn by the arena as slashes.
 *
 * A hit is a white-hot core plus a few short shards in the attacker's color,
 * biased along the attack. A block is a smaller pale slash. A counter is the
 * same spark, a little longer, still gone in a fraction of a second.
 *
 * Nothing here is a disc. The old corona was a radial fill; on a portrait
 * phone the overlay stretched it into the cream rings and the yellow beam.
 * `sparkReachCss` is the longest a shard may be, in CSS pixels of an
 * aspect-correct canvas. The renderer must not stroke a circle with it.
 */

// ── Hit effect types ──────────────────────────────────────────────────────────
export type HitEffectType = 'clean_hit' | 'block' | 'counter_hit' | 'wall_splat' | 'floor_slam';

// ── Hit weight for camera shake ───────────────────────────────────────────────
export type HitWeight = 'light' | 'medium' | 'heavy' | 'counter' | 'super';

// ── Directional streak ────────────────────────────────────────────────────────
export interface DirectionalStreak {
  angle: number;   // radians
  length: number;  // streak length in screen pixels
  width: number;   // streak width
  color: string;   // character color
  alpha: number;   // 0-1
}

// ── Point light flash data ────────────────────────────────────────────────────
export interface PointLightFlash {
  /** World-space position of the impact */
  x: number;
  y: number;
  z: number;
  /** Light color (attacker's character color) */
  color: string;
  /** Current intensity (fades to 0 over 5 frames) */
  intensity: number;
  /** Max intensity */
  maxIntensity: number;
  /** Frames remaining (3-5 frames) */
  framesRemaining: number;
  /** Total frames */
  totalFrames: number;
}

// ── Camera shake state ────────────────────────────────────────────────────────
export interface CameraShakeState {
  active: boolean;
  /** Current X offset in pixels */
  offsetX: number;
  /** Current Y offset in pixels */
  offsetY: number;
  /** Magnitude of shake */
  magnitude: number;
  /** Frames remaining */
  framesRemaining: number;
  /** Total frames */
  totalFrames: number;
}

export function createCameraShakeState(): CameraShakeState {
  return { active: false, offsetX: 0, offsetY: 0, magnitude: 0, framesRemaining: 0, totalFrames: 0 };
}

// ── Hit effect slot (pooled) ──────────────────────────────────────────────────
export interface HitEffectSlot {
  /** Whether this slot is currently active */
  active: boolean;
  /** Type of hit effect */
  type: HitEffectType;
  /** Screen-space X position */
  screenX: number;
  /** Screen-space Y position */
  screenY: number;
  /** World-space position for point light */
  worldX: number;
  worldY: number;
  worldZ: number;
  /** Character color (corona layer) */
  characterColor: string;
  /** Scale multiplier (1.0 = normal, 2.0 = counter-hit) */
  scale: number;
  /** Life remaining (0-1, 1 = just spawned) */
  life: number;
  /** Max life in seconds */
  maxLife: number;
  /** Directional streaks */
  streaks: DirectionalStreak[];
  /** Attack direction angle (radians) for streak orientation */
  attackAngle: number;
  /** Point light flash */
  pointLight: PointLightFlash | null;
}

// ── Hit effect pool ───────────────────────────────────────────────────────────
export const HIT_EFFECT_POOL_SIZE = 5;

export interface HitEffectPool {
  slots: HitEffectSlot[];
  cameraShake: CameraShakeState;
  /** Global screen flash intensity (0-1) */
  screenFlash: number;
}

export function createHitEffectPool(): HitEffectPool {
  const slots: HitEffectSlot[] = [];
  for (let i = 0; i < HIT_EFFECT_POOL_SIZE; i++) {
    slots.push({
      active: false,
      type: 'clean_hit',
      screenX: 0, screenY: 0,
      worldX: 0, worldY: 0, worldZ: 0,
      characterColor: '#ffffff',
      scale: 1.0,
      life: 0,
      maxLife: 0.4,
      streaks: [],
      attackAngle: 0,
      pointLight: null,
    });
  }
  return {
    slots,
    cameraShake: createCameraShakeState(),
    screenFlash: 0,
  };
}

// ── Streak generation ─────────────────────────────────────────────────────────
function generateStreaks(
  type: HitEffectType,
  characterColor: string,
  attackAngle: number,
  scale: number,
): DirectionalStreak[] {
  const streaks: DirectionalStreak[] = [];

  if (type === 'block') {
    // A small pale slash. Not a plus-sign, not a shield the size of the fighter.
    for (let i = 0; i < 3; i++) {
      streaks.push({
        angle: attackAngle + (i - 1) * 0.5,
        length: 6 * scale,
        width: 1.2,
        color: '#d7e6f4',
        alpha: 0.9,
      });
    }
    return streaks;
  }

  // Clean / counter / slam: character-colored shards along the attack,
  // plus a short white core. The spread is a slash, not a starburst.
  const baseCount = type === 'counter_hit' ? 7 : type === 'wall_splat' || type === 'floor_slam' ? 6 : 5;
  const baseLength = type === 'counter_hit' ? 12 * scale : 8 * scale;
  const spread = type === 'wall_splat' || type === 'floor_slam' ? Math.PI * 0.45 : Math.PI * 0.55;

  for (let i = 0; i < baseCount; i++) {
    const angle = attackAngle + (Math.random() - 0.5) * spread;
    const length = baseLength * (0.55 + Math.random() * 0.6);
    streaks.push({
      angle,
      length,
      width: 1.4,
      color: characterColor,
      alpha: 0.9,
    });
  }

  const cores = type === 'counter_hit' ? 3 : 2;
  for (let i = 0; i < cores; i++) {
    streaks.push({
      angle: attackAngle + (Math.random() - 0.5) * 0.4,
      length: baseLength * 0.55,
      width: 1,
      color: '#ffffff',
      alpha: 1,
    });
  }

  return streaks;
}

// ── Spawn hit effect ──────────────────────────────────────────────────────────
export interface SpawnHitEffectParams {
  type: HitEffectType;
  screenX: number;
  screenY: number;
  worldX: number;
  worldY: number;
  worldZ: number;
  characterColor: string;
  attackAngle?: number;
  damage?: number;
}

/**
 * Tekken's hit flash is a contact glint, not a faction-colored orb.
 * A jab is gone in about 5 frames. A counter is a little larger and a
 * little longer, still under a sixth of a second. The old 0.35–0.6s
 * lives and 2× coronas were the circles that sat on screen.
 */
export const HIT_FX_CLEAN_LIFE = 0.09;
export const HIT_FX_HEAVY_LIFE = 0.12;
export const HIT_FX_COUNTER_LIFE = 0.16;
export const HIT_FX_BLOCK_LIFE = 0.07;

/**
 * Longest shard, in CSS pixels, on a canvas whose backing store matches the
 * element. Geometric-mean sizing keeps a phone and a desktop in the same
 * ballpark. The cap is a fraction of the SHORT side so a portrait stretch
 * cannot turn the spark into a beam or a body halo.
 *
 * Measured against the owner's screenshot viewport (675×1500): a clean hit
 * stays under ~80px and a counter under ~110px. The rings that filled the
 * frame were several hundred pixels across.
 */
export function sparkReachCss(cssW: number, cssH: number, type: HitEffectType, scale = 1): number {
  const w = Math.max(1, cssW);
  const h = Math.max(1, cssH);
  const unit = Math.sqrt(w * h);
  const frac = type === 'block' ? 0.045
    : type === 'counter_hit' ? 0.09
    : type === 'wall_splat' || type === 'floor_slam' ? 0.08
    : 0.062;
  const reach = unit * frac * Math.max(0.2, scale);
  const cap = Math.min(w, h) * (type === 'counter_hit' ? 0.16 : 0.12);
  return Math.min(reach, cap);
}

function sparkProfile(type: HitEffectType, damage: number): {
  scale: number;
  life: number;
  lightFrames: number;
  lightIntensity: number;
  flash: number;
  shake: number;
  shakeFrames: number;
} {
  if (type === 'block') {
    return { scale: 0.8, life: HIT_FX_BLOCK_LIFE, lightFrames: 1, lightIntensity: 0.35, flash: 0, shake: 0.4, shakeFrames: 2 };
  }
  if (type === 'counter_hit') {
    return { scale: 1.25, life: HIT_FX_COUNTER_LIFE, lightFrames: 2, lightIntensity: 0.9, flash: 0.05, shake: 2.5, shakeFrames: 6 };
  }
  if (type === 'floor_slam' || type === 'wall_splat') {
    return { scale: 1.3, life: 0.14, lightFrames: 2, lightIntensity: 0.8, flash: 0.04, shake: 3, shakeFrames: 6 };
  }
  const heavy = damage > 150;
  return {
    scale: heavy ? 1.12 : 1,
    life: heavy ? HIT_FX_HEAVY_LIFE : HIT_FX_CLEAN_LIFE,
    lightFrames: 2,
    lightIntensity: heavy ? 0.7 : 0.45,
    flash: heavy ? 0.03 : 0,
    shake: heavy ? 1.6 : 0.6,
    shakeFrames: heavy ? 4 : 2,
  };
}

/**
 * Spawn a hit effect into the pool.
 * Finds the oldest/inactive slot and reuses it.
 */
export function spawnHitEffect(pool: HitEffectPool, params: SpawnHitEffectParams): HitEffectPool {
  const {
    type, screenX, screenY, worldX, worldY, worldZ,
    characterColor, attackAngle = 0, damage = 100,
  } = params;

  // Find inactive slot, or steal the oldest active one
  let slotIdx = pool.slots.findIndex(s => !s.active);
  if (slotIdx === -1) slotIdx = 0; // steal first slot

  const profile = sparkProfile(type, damage);

  const pointLight: PointLightFlash = {
    x: worldX, y: worldY, z: worldZ,
    // The attacker's color, for two frames. A white flood was wiping the
    // roster out; a sustained light was the "lights for no reason".
    color: type === 'block' ? '#d5e2ee' : characterColor,
    intensity: profile.lightIntensity,
    maxIntensity: profile.lightIntensity,
    framesRemaining: profile.lightFrames,
    totalFrames: profile.lightFrames,
  };

  const newSlot: HitEffectSlot = {
    active: true,
    type,
    screenX, screenY,
    worldX, worldY, worldZ,
    characterColor,
    scale: profile.scale,
    life: profile.life,
    maxLife: profile.life,
    streaks: generateStreaks(type, characterColor, attackAngle, profile.scale),
    attackAngle,
    pointLight,
  };

  const newSlots = [...pool.slots];
  newSlots[slotIdx] = newSlot;

  return {
    slots: newSlots,
    cameraShake: {
      active: true,
      offsetX: 0,
      offsetY: 0,
      magnitude: profile.shake,
      framesRemaining: profile.shakeFrames,
      totalFrames: profile.shakeFrames,
    },
    screenFlash: Math.max(pool.screenFlash, profile.flash),
  };
}

// ── Camera shake calculation ──────────────────────────────────────────────────
export function getCameraShakeForHit(type: HitEffectType, damage: number): CameraShakeState {
  if (type === 'block') {
    return { active: true, offsetX: 0, offsetY: 0, magnitude: 1, framesRemaining: 3, totalFrames: 3 };
  }
  if (type === 'counter_hit') {
    return { active: true, offsetX: 0, offsetY: 0, magnitude: 8, framesRemaining: 15, totalFrames: 15 };
  }
  if (type === 'floor_slam' || type === 'wall_splat') {
    return { active: true, offsetX: 0, offsetY: 0, magnitude: 6, framesRemaining: 12, totalFrames: 12 };
  }
  if (damage > 200) {
    return { active: true, offsetX: 0, offsetY: 0, magnitude: 5, framesRemaining: 10, totalFrames: 10 };
  }
  if (damage > 100) {
    return { active: true, offsetX: 0, offsetY: 0, magnitude: 3, framesRemaining: 6, totalFrames: 6 };
  }
  return { active: true, offsetX: 0, offsetY: 0, magnitude: 1, framesRemaining: 3, totalFrames: 3 };
}

// ── Tick hit effect pool ──────────────────────────────────────────────────────
const TICK_DT = 1 / 60; // 60fps tick

/**
 * A HIT EFFECT'S LIFE IS SECONDS, SO IT HAS TO BE SPENT IN SECONDS.
 *
 * Owner: "there's still this issue with the little hit effects ... staying on
 * screen for too long."
 *
 * This subtracted a hardcoded 1/60 per call while being driven off
 * requestAnimationFrame, so an effect's real lifetime was
 * `authored * (60 / actual fps)` — double on a 30fps phone, triple at 20. Same
 * defect as the fixed-timestep one in FighterStateMachine, one system along.
 *
 * `pointLight.framesRemaining` and the camera shake genuinely count in 60fps
 * FRAMES, so they are spent in frames — dt * 60 — rather than being rewritten
 * into seconds. Both are then frame-rate independent for the same reason.
 *
 * dt is clamped: a tab-switch or a several-second stall should end the effects,
 * never leave them mid-flight, and never run the decay backwards.
 */
export const HIT_FX_MAX_DT = 0.25;

export function tickHitEffectPool(pool: HitEffectPool, dtSeconds: number = TICK_DT): HitEffectPool {
  const dt = Math.min(Math.max(dtSeconds, 0), HIT_FX_MAX_DT);
  const framesElapsed = dt * 60;
  // Tick slots
  const newSlots = pool.slots.map(slot => {
    if (!slot.active) return slot;

    const newLife = slot.life - dt;
    if (newLife <= 0) {
      return { ...slot, active: false, life: 0, pointLight: null };
    }

    // Tick point light
    let newPointLight = slot.pointLight;
    if (newPointLight && newPointLight.framesRemaining > 0) {
      const newFrames = newPointLight.framesRemaining - framesElapsed;
      const newIntensity = newFrames <= 0 ? 0 :
        newPointLight.maxIntensity * (newFrames / newPointLight.totalFrames);
      newPointLight = newFrames <= 0 ? null : {
        ...newPointLight,
        framesRemaining: newFrames,
        intensity: newIntensity,
      };
    }

    return { ...slot, life: newLife, pointLight: newPointLight };
  });

  // Tick camera shake
  let newShake = pool.cameraShake;
  if (newShake.active && newShake.framesRemaining > 0) {
    const t = newShake.framesRemaining / newShake.totalFrames;
    const decayedMag = newShake.magnitude * t;
    newShake = {
      ...newShake,
      offsetX: (Math.random() - 0.5) * 2 * decayedMag,
      offsetY: (Math.random() - 0.5) * 2 * decayedMag,
      framesRemaining: newShake.framesRemaining - framesElapsed,
      active: newShake.framesRemaining > framesElapsed,
    };
  } else if (newShake.active) {
    newShake = createCameraShakeState();
  }

  // Fade screen flash
  // 0.82 per frame at 60fps, held to that RATE rather than to per-call, so the
  // flash fades over the same wall-clock time on a phone as on a desktop.
  const newFlash = pool.screenFlash > 0.01 ? pool.screenFlash * Math.pow(0.82, framesElapsed) : 0;

  return { slots: newSlots, cameraShake: newShake, screenFlash: newFlash };
}

// ── Get active point lights ───────────────────────────────────────────────────
export function getActivePointLights(pool: HitEffectPool): PointLightFlash[] {
  return pool.slots
    .filter(s => s.active && s.pointLight !== null)
    .map(s => s.pointLight!);
}

// ── Render data for canvas overlay ───────────────────────────────────────────
export interface HitEffectRenderData {
  screenX: number;
  screenY: number;
  characterColor: string;
  scale: number;
  alpha: number; // life / maxLife
  type: HitEffectType;
  streaks: DirectionalStreak[];
  /** White core radius */
  coreRadius: number;
  /** Corona radius */
  coronaRadius: number;
}

export function getHitEffectRenderData(pool: HitEffectPool): HitEffectRenderData[] {
  return pool.slots
    .filter(s => s.active)
    .map(s => {
      const alpha = s.life / s.maxLife;
      // Screen pixels on the 800-wide overlay. A counter used to be an 80px
      // disc; stretched to a desktop that was a third of the fighter.
      const baseRadius = s.type === 'block' ? 6
        : s.type === 'counter_hit' ? 11
        : s.type === 'wall_splat' || s.type === 'floor_slam' ? 12
        : 8;
      return {
        screenX: s.screenX,
        screenY: s.screenY,
        characterColor: s.characterColor,
        scale: s.scale,
        alpha,
        type: s.type,
        streaks: s.streaks,
        coreRadius: Math.max(0, (baseRadius * 0.35) * s.scale * (0.5 + alpha * 0.5)),
        coronaRadius: Math.max(0, baseRadius * s.scale * (0.4 + alpha * 0.6)),
      };
    });
}
