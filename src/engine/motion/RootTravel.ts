// `.ts` extensions on purpose — the repo's runner resolves them literally.

/**
 * HOW FAR A MOVE CARRIES THE FIGHTER — ONE CURVE, WHATEVER AUTHORED IT.
 *
 * Owner: "preserve hips translation at import so all clips carry their own
 * footwork — the real fix. And the fix for all future clips and animations."
 *
 * TWO INDEPENDENT SOURCES OF TRAVEL EXIST IN THIS PROJECT AND NEITHER REACHED
 * THE GAME:
 *
 *   1. The Schwarzerblitz move files author it explicitly in #MOVEMENT, because
 *      that engine's animations are ROTATION-ONLY and the travel lives beside
 *      them. 127 of its 133 moves carry one.
 *   2. Our own captured clips have it in the motion itself — the pelvis simply
 *      moves. MEASURED over the 973 source clips: 273 travel more than 15 cm
 *      horizontally, up to 1.22 m, and DROP_KICK crosses 1.12 m.
 *
 * Source (2) was discarded at import: both generated motion banks store
 * rotations only, so every clip arrived with its feet nailed to one spot and
 * the engine faked displacement from a hand-written table of five profiles.
 *
 * ONE REPRESENTATION FOR BOTH, on purpose. A per-frame array at some fixed rate
 * is what the Schwarzerblitz data looks like and a time-keyed sampling is what a
 * capture looks like, and a game loop wants neither — it wants "how far between
 * these two instants". So both are converted to CUMULATIVE displacement against
 * time, and the loop asks for a span. That makes the result frame-rate
 * independent by construction: a loop that jumps 0.0s to 0.3s gets every
 * centimetre in that span rather than one frame's worth times a large dt.
 *
 * AXES are the fighter's own: `forward` along his facing, `lateral` across it.
 * Vertical is deliberately absent — jump height is owned by the jump arc, and
 * two systems writing Y is how a fighter ends up hovering.
 */

export interface RootTravelCurve {
  /** Sample times in seconds from the start of the move, ascending. */
  t: number[];
  /** Cumulative forward displacement in metres at each time. */
  f: number[];
  /** Cumulative lateral displacement in metres at each time. */
  l: number[];
}

export const EMPTY_TRAVEL: RootTravelCurve = { t: [], f: [], l: [] };

/** Linear sample of a cumulative curve at one time. */
function at(curve: RootTravelCurve, time: number): { forward: number; lateral: number } {
  const n = curve.t.length;
  if (!n) return { forward: 0, lateral: 0 };
  if (time <= curve.t[0]) return { forward: curve.f[0], lateral: curve.l[0] };
  if (time >= curve.t[n - 1]) return { forward: curve.f[n - 1], lateral: curve.l[n - 1] };
  // Ascending times, so a scan is fine at these lengths (tens of keys).
  let i = 1;
  while (i < n && curve.t[i] < time) i++;
  const t0 = curve.t[i - 1];
  const t1 = curve.t[i];
  const span = t1 - t0;
  const k = span > 1e-9 ? (time - t0) / span : 0;
  return {
    forward: curve.f[i - 1] + (curve.f[i] - curve.f[i - 1]) * k,
    lateral: curve.l[i - 1] + (curve.l[i] - curve.l[i - 1]) * k,
  };
}

/**
 * Displacement between two instants — what a variable-dt loop needs.
 *
 * Because the curve is CUMULATIVE, this is a subtraction rather than a sum over
 * frames, so it cannot drift and cannot miss a frame however large the step.
 */
export function travelBetween(
  curve: RootTravelCurve | null | undefined,
  from: number,
  to: number,
): { forward: number; lateral: number } {
  if (!curve?.t.length || to <= from) return { forward: 0, lateral: 0 };
  const a = at(curve, from);
  const b = at(curve, to);
  return { forward: b.forward - a.forward, lateral: b.lateral - a.lateral };
}

/** Net travel of the whole move, in metres. */
export function totalTravel(curve: RootTravelCurve | null | undefined): { forward: number; lateral: number } {
  if (!curve?.t.length) return { forward: 0, lateral: 0 };
  const n = curve.t.length - 1;
  return { forward: curve.f[n], lateral: curve.l[n] };
}

/** The largest distance from the start reached at any point, in metres. */
export function peakTravel(curve: RootTravelCurve | null | undefined): number {
  if (!curve?.t.length) return 0;
  let peak = 0;
  for (let i = 0; i < curve.t.length; i++) peak = Math.max(peak, Math.hypot(curve.f[i], curve.l[i]));
  return peak;
}

/** Build a cumulative curve from per-frame velocities at a fixed rate. */
export function travelFromPerFrame(
  frames: ReadonlyArray<{ forward: number; lateral: number }>,
  fps: number,
): RootTravelCurve {
  const out: RootTravelCurve = { t: [0], f: [0], l: [0] };
  let f = 0;
  let l = 0;
  for (let i = 0; i < frames.length; i++) {
    f += frames[i].forward;
    l += frames[i].lateral;
    out.t.push((i + 1) / fps);
    out.f.push(f);
    out.l.push(l);
  }
  return out;
}

type Vec = readonly number[] | { x: number; y: number; z: number };
const cx = (v: Vec) => (Array.isArray(v) ? v[0] : (v as { x: number }).x);
const cz = (v: Vec) => (Array.isArray(v) ? v[2] : (v as { z: number }).z);

export interface PoseKey {
  t: number;
  pose?: Record<string, Vec | undefined>;
}

/**
 * Travel of a captured clip, read from the joint world positions it already
 * carries. The pelvis says where the body went; the SHOULDER AXIS says which
 * way "forward" was, so the result is in the fighter's own frame rather than
 * the capture's world.
 *
 * ORIENTATION BEFORE MAGNITUDE — the project's binding rule for any motion
 * work. A human is far wider across the shoulders than front-to-back, so the
 * shoulder line is the across-axis and facing is its perpendicular. Verified on
 * DROP_KICK: its pelvis moves +0.58 m along the facing derived this way, which
 * is what a drop kick does. Had the sign been inverted it would have measured
 * a drop kick travelling backwards.
 *
 * Facing is taken ONCE, at the first frame, because the engine applies the
 * result along the fighter's facing at the moment the move starts. Using a
 * per-frame facing would double-count any turn the clip performs.
 */
export function travelFromPoseKeys(
  keys: ReadonlyArray<PoseKey>,
  opts: { pelvis?: string; left?: string; right?: string } = {},
): RootTravelCurve {
  const pelvisKey = opts.pelvis ?? 'pelvis';
  const leftKey = opts.left ?? 'shL';
  const rightKey = opts.right ?? 'shR';
  if (keys.length < 2) return { t: [], f: [], l: [] };

  const first = keys[0]?.pose;
  const p0 = first?.[pelvisKey];
  const sl = first?.[leftKey];
  const sr = first?.[rightKey];
  if (!p0 || !sl || !sr) return { t: [], f: [], l: [] };

  const ax = cx(sr) - cx(sl);
  const az = cz(sr) - cz(sl);
  const len = Math.hypot(ax, az);
  if (len < 1e-6) return { t: [], f: [], l: [] };
  // Perpendicular to the shoulder line, in the ground plane.
  const fx = -az / len;
  const fz = ax / len;
  // Lateral is the shoulder line itself, so the pair is a right-handed basis.
  const lx = ax / len;
  const lz = az / len;

  const ox = cx(p0);
  const oz = cz(p0);
  const out: RootTravelCurve = { t: [], f: [], l: [] };
  for (const k of keys) {
    const p = k.pose?.[pelvisKey];
    if (!p) continue;
    const dx = cx(p) - ox;
    const dz = cz(p) - oz;
    out.t.push(k.t);
    out.f.push(dx * fx + dz * fz);
    out.l.push(dx * lx + dz * lz);
  }
  return out.t.length >= 2 ? out : { t: [], f: [], l: [] };
}

/**
 * A capture can drift, and a drifting IDLE that slides the fighter across the
 * ring is worse than one that stands still. This keeps a curve only when it
 * looks like deliberate footwork.
 */
export const MIN_MEANINGFUL_TRAVEL_M = 0.08;

export function isMeaningfulTravel(curve: RootTravelCurve | null | undefined): boolean {
  return peakTravel(curve) >= MIN_MEANINGFUL_TRAVEL_M;
}
