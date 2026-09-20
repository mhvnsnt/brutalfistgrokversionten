// `.ts` extensions on purpose — the repo's test runner resolves them literally.
import * as THREE from 'three';

import { assetUrl } from '../../lib/assetBase.ts';

/**
 * CLIPS ALREADY RESOLVED ONTO THE ONE SKELETON.
 *
 * This is the runtime half of scripts/bake-fighter-animations.mjs. Tekken and
 * Schwarzerblitz do not retarget in a match; they have one skeleton and every
 * animation is authored on it. The bake gives us the same thing: bone binding,
 * source-rest conventions, spine redistribution, hinge constraints and joint
 * limits are all resolved ONCE, offline, against the canonical 58-joint rig.
 *
 * So there is nothing to do here but read quaternion tracks and hand them to a
 * mixer. No rest maps, no per-bank conventions, no joint solving between the
 * bell and the first punch.
 *
 * MEASURED at bake time: 366 clips, 166 spine chains redistributed, 1,334
 * hinge corrections and 2,604 joint-limit corrections — all of it work the
 * runtime used to redo on every fighter load. 44 MB of source Euler JSON
 * becomes 7.9 MB of baked quaternions.
 *
 * FALLS BACK SILENTLY. If the bake has not been run, `loadBakedMotionBank`
 * returns an empty map and the pipeline uses the live retarget path exactly
 * as before. A missing build step must not be a broken game.
 */
export interface BakedClipFile {
  name: string;
  bank: string;
  dur: number;
  /** The combat state this clip answers to, decided at bake time. */
  semantic?: string;
  /** True when the bake chose this clip to OWN its semantic state. */
  owns?: boolean;
  tracks: Record<string, { t: number[]; q: number[] }>;
  /**
   * Translation tracks, which for a baked clip means exactly one thing: the
   * hips offset that PLANTS THE FEET. Root motion is still stripped — this is
   * the vertical lock that keeps a fighter standing on the floor instead of
   * 23 cm above it.
   */
  positions?: Record<string, { t: number[]; p: number[] }>;
}

export interface BakedManifestEntry {
  file: string;
  bank: string;
  dur: number;
  bones: number;
  semantic?: string;
  owns?: boolean;
}

const INDEX_URL = '/motion/baked/index.json';
const BASE = '/motion/baked/';

let cached: Map<string, THREE.AnimationClip> | null = null;
let attempted = false;

/** Turn one baked file into a clip. Exported so a test can check it directly. */
export function clipFromBaked(data: BakedClipFile): THREE.AnimationClip | null {
  const tracks: THREE.KeyframeTrack[] = [];
  for (const [bone, track] of Object.entries(data.tracks ?? {})) {
    if (!track?.t?.length || track.q.length !== track.t.length * 4) continue;
    tracks.push(new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, track.t, track.q));
  }
  for (const [bone, track] of Object.entries(data.positions ?? {})) {
    if (!track?.t?.length || track.p.length !== track.t.length * 3) continue;
    tracks.push(new THREE.VectorKeyframeTrack(`${bone}.position`, track.t, track.p));
  }
  if (tracks.length === 0) return null;
  const clip = new THREE.AnimationClip(data.name, data.dur, tracks);
  (clip as THREE.AnimationClip & { userData: Record<string, unknown> }).userData = {
    clipSourceType: 'BAKED_CANONICAL',
    bank: data.bank,
    ownerGranted: true,
    ...(data.semantic ? { semanticState: data.semantic } : {}),
    owns: Boolean(data.owns),
    // Already on the skeleton: nothing downstream should retarget it again.
    baked: true,
  };
  return clip;
}

/**
 * Every baked clip, by name. Cached for the session — the bake is immutable
 * for a given build, and two fighters must not fetch it twice.
 */
export async function loadBakedMotionBank(): Promise<Map<string, THREE.AnimationClip>> {
  if (cached) return cached;
  if (attempted) return new Map();
  attempted = true;

  const out = new Map<string, THREE.AnimationClip>();
  try {
    const res = await fetch(assetUrl(INDEX_URL));
    if (!res.ok) throw new Error(`index HTTP ${res.status}`);
    const manifest = (await res.json()) as Record<string, BakedManifestEntry>;
    // SLOT OWNERS FIRST. Actions register in order and the first clip for a
    // semantic wins, so the clip the bake chose for a combat state has to be
    // seen before any clip that merely infers the same state from its name.
    const names = Object.keys(manifest).sort(
      (a, b) => Number(Boolean(manifest[b].owns)) - Number(Boolean(manifest[a].owns)),
    );
    if (names.length === 0) throw new Error('empty index');

    const loaded = await Promise.allSettled(
      names.map(async (name) => {
        const r = await fetch(assetUrl(BASE + encodeURIComponent(manifest[name].file)));
        if (!r.ok) throw new Error(`${name} HTTP ${r.status}`);
        return clipFromBaked((await r.json()) as BakedClipFile);
      }),
    );
    let failed = 0;
    loaded.forEach((s, i) => {
      if (s.status === 'fulfilled' && s.value) out.set(names[i], s.value);
      else failed++;
    });
    console.log(
      `[BakedMotionBank] ✅ ${out.size} clip(s) already on the skeleton` +
        (failed ? `, ${failed} failed` : ''),
    );
  } catch (e: unknown) {
    // Not an error: a dev checkout that has not run the bake uses the live
    // retarget path, and says so once rather than looking broken.
    console.log(
      `[BakedMotionBank] no baked set (${e instanceof Error ? e.message : String(e)}) — using the live retarget path`,
    );
    cached = null;
    return out;
  }
  cached = out;
  return out;
}

/** For tests and for the pipeline's own reporting. */
export function bakedBankIsLoaded(): boolean {
  return cached !== null && cached.size > 0;
}
