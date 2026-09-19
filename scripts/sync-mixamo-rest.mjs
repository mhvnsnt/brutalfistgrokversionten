#!/usr/bin/env node
/**
 * BAKE THE MIXAMO REST POSE — the reference every absolute Mixamo clip is
 * measured from.
 *
 * WHY. The Bannon motion bank ships ABSOLUTE local rotations on a Mixamo
 * skeleton, not deltas. `makeClipBindRelative` needs the rest they are
 * absolute against; without one it falls back to each clip's own frame 0,
 * which forces `q(0) = q_bind` and flattens every POSE in the bank onto the
 * target's bind. That is what made every fighter stand identically.
 *
 * WHERE THE NUMBERS COME FROM — MEASURED, not assumed. `xbot.glb` is the one
 * model in the roster that tools/model_diag/bind_pose.mjs classifies T-POSE,
 * and it is a genuine Mixamo rig (65 `mixamorig:` joints). Its node rotations
 * ARE the Mixamo rest. Two independent checks confirm the bank speaks that
 * same space:
 *   - xbot's LeftUpLeg bind euler is [-0.021, 0, -3.1416]; the bank's
 *     LeftUpLeg rotations have a median magnitude of 164.5 degrees. Both carry
 *     the documented Mixamo leg rest of rz ~= +/-pi.
 *   - xbot's arms rest at 12.2 degrees from identity, and the bank's arms sit
 *     a median 60 degrees off — an arm that has MOVED from a T-pose, which is
 *     what a fighting clip is.
 *
 * Usage: node scripts/sync-mixamo-rest.mjs [path/to/tpose-mixamo.glb]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { parseGlb } from '../tools/model_diag/bind_pose.mjs';

const SOURCE = process.argv[2] ?? 'public/models/xbot.glb';
const OUT = 'src/generated/MixamoRestPose.generated.ts';

const { json } = parseGlb(readFileSync(SOURCE));

/** `mixamorig:LeftArm` and `mixamorigLeftArm` are the same bone. */
const key = (name) => name.replace(/^mixamorig[:._-]*/i, 'mixamorig');

const rest = {};
for (const node of json.nodes ?? []) {
  if (!node.name || !/^mixamorig/i.test(node.name)) continue;
  const k = key(node.name);
  if (k in rest) continue;
  const r = node.rotation ?? [0, 0, 0, 1];
  rest[k] = r.map((v) => +v.toFixed(6));
}

const count = Object.keys(rest).length;
if (count < 20) {
  console.error(`REFUSED: ${SOURCE} yielded only ${count} mixamorig bones — that is not a Mixamo rig.`);
  process.exit(1);
}

const body = Object.entries(rest)
  .map(([k, v]) => `  ${JSON.stringify(k)}: [${v.join(', ')}],`)
  .join('\n');

writeFileSync(OUT, `/** GENERATED FILE — do not hand edit. Run scripts/sync-mixamo-rest.mjs. */
/** Source: ${SOURCE} — the one shipped model measured T-POSE by tools/model_diag/bind_pose.mjs. */
/** These are the Mixamo skeleton's REST local rotations, [x, y, z, w]. */
export const MIXAMO_REST_POSE: Record<string, [number, number, number, number]> = {
${body}
};
`);

console.log(`✅ ${OUT} — ${count} bones from ${SOURCE}`);
