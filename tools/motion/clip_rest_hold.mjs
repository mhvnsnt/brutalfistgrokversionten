#!/usr/bin/env node
/**
 * DOES A CLIP START OR END SITTING AT THE REST POSE?
 *
 * The baked format stores a LOCAL rotation per bone per key, and that rotation
 * REPLACES the bone's bind rotation. So a key whose quaternion equals the bind
 * rotation is a bone that has not moved from rest.
 *
 * On a rig whose rest is a stance this is invisible. On one whose rest is a
 * literal T-pose — BANNON_rigged's is, the pipeline logs "T-pose rest available
 * ... LeftArm 66.1->1deg" — every frame like that is a T-POSE ON SCREEN.
 *
 * Found by the browser probe: BANNON sat within 0.3 degrees of bind on frames
 * 91, 94-96 and 220-225 of a 322-frame match, and the mixer said the active clip
 * was the jump, at times 0.089 / 0.330 / 0.412 — the HEAD of the clip. VIPER,
 * whose rest is a stance, never went near bind on the same clips.
 *
 * Usage: node tools/motion/clip_rest_hold.mjs [model.glb] [--all] [CLIP ...]
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { parseGlb } from '../model_diag/bind_pose.mjs';

const MODEL = process.argv[2]?.endsWith('.glb') ? process.argv[2] : 'public/models/TITAN.glb';
const BAKED = 'public/motion/baked';
/** A bone within this many degrees of its bind rotation has not moved. */
const AT_REST_DEG = 2.0;
/** A key with at least this share of its bones at rest is a rest-pose frame. */
const REST_FRAME_SHARE = 0.8;

function bindRotations(file) {
  const { json } = parseGlb(readFileSync(file));
  const skin = json.skins[0];
  const out = new Map();
  for (const n of skin.joints) {
    const node = json.nodes[n];
    const name = (node?.name ?? '').replace(':', '');
    out.set(name, new THREE.Quaternion().fromArray(node.rotation ?? [0, 0, 0, 1]));
  }
  return out;
}
const angleBetween = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(a.dot(b)))) * 180 / Math.PI;

/** Per key: the share of tracked bones sitting at their bind rotation. */
export function restHoldOf(bind, clip) {
  const names = Object.keys(clip.tracks ?? {});
  if (!names.length) return null;
  const keys = Math.max(...names.map((n) => (clip.tracks[n].q?.length ?? 0) / 4), 0);
  if (keys < 2) return null;
  const share = [];
  const q = new THREE.Quaternion();
  for (let k = 0; k < keys; k++) {
    let atRest = 0, counted = 0;
    for (const n of names) {
      const b = bind.get(n);
      const t = clip.tracks[n].q;
      if (!b || !t || t.length < (k + 1) * 4) continue;
      q.set(t[k * 4], t[k * 4 + 1], t[k * 4 + 2], t[k * 4 + 3]);
      counted++;
      if (angleBetween(q, b) <= AT_REST_DEG) atRest++;
    }
    share.push(counted ? atRest / counted : 0);
  }
  let head = 0;
  while (head < share.length && share[head] >= REST_FRAME_SHARE) head++;
  let tail = 0;
  while (tail < share.length && share[share.length - 1 - tail] >= REST_FRAME_SHARE) tail++;
  const total = share.filter((s) => s >= REST_FRAME_SHARE).length;
  const perKey = clip.dur / Math.max(1, share.length - 1);
  return { keys: share.length, head, tail, total, headS: +(head * perKey).toFixed(3), totalS: +(total * perKey).toFixed(3) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const bind = bindRotations(MODEL);
  const want = process.argv.slice(3).filter((a) => !a.startsWith('-'));
  const all = process.argv.includes('--all');
  const files = all
    ? readdirSync(BAKED).filter((f) => f.endsWith('.json') && f !== 'index.json')
    : (want.length ? want : ['BIG_JUMP', 'CROSS_JUMPS', 'WALK', 'IDLE', 'REACTION_HITWEAKHIGH', 'KIP_UP', 'LOCO_STRUT']).map((n) => `${n}.json`);
  const rows = [];
  for (const f of files) {
    let clip; try { clip = JSON.parse(readFileSync(join(BAKED, f), 'utf8')); } catch { continue; }
    const r = restHoldOf(bind, clip);
    if (r) rows.push([f.replace('.json', ''), r]);
  }
  if (all) {
    const held = rows.filter(([, r]) => r.head > 0).sort((a, b) => b[1].head - a[1].head);
    console.log(`\nCLIPS THAT OPEN HELD AT THE REST POSE — ${MODEL.split('/').pop()}`);
    console.log(`  a rest frame = ${Math.round(REST_FRAME_SHARE * 100)}% of tracked bones within ${AT_REST_DEG} deg of bind\n`);
    console.log(`  ${held.length} of ${rows.length} clips open at rest\n`);
    console.log('  clip                          head keys   head seconds');
    for (const [n, r] of held.slice(0, 25)) {
      console.log(`  ${n.padEnd(30)} ${String(r.head).padStart(4)}       ${String(r.headS).padStart(6)}s`);
    }
  } else {
    console.log(`\nREST HOLD — ${MODEL.split('/').pop()}\n`);
    console.log('  clip                      keys   head   tail   total at rest');
    for (const [n, r] of rows) {
      console.log(`  ${n.padEnd(24)} ${String(r.keys).padStart(5)} ${String(r.head).padStart(6)} ${String(r.tail).padStart(6)} ${String(r.total).padStart(8)}   (head ${r.headS}s)`);
    }
  }
}
