#!/usr/bin/env node
/**
 * LOOK AT THE ANIMATION PROPERLY, SO HE DOES NOT HAVE TO.
 *
 * Owner: "build a thing so you can accurately, or pull in open source so you
 * can accurately see all of the amount of skeleton joints and movements and
 * all of the shit, so you can see what's happening in each animation better
 * so you can stop guessing ... so you can do half of the work that you're
 * making me do with looking at the animations. You should be able to get
 * better at actually seeing what an animation is doing ... how many models
 * and joints are in it, whether it's a strike or a taunt based on what it
 * looks like plus the name, and whether it's a team move that needs a team
 * thing or not."
 *
 * He is right that I have been asking him to be the instrument. The data was
 * always there and I was reading the BAKED clip, which is the wrong end of
 * the pipe: the bake retargets everything onto ONE 58-joint skeleton, so a
 * capture of three wrestlers arrives as one fighter and every trace of the
 * other two is gone by the time I look at it.
 *
 * THE SOURCE CARRIES IT ALL. Each source clip holds the full authored rig —
 * 600 to 1000 bones — and a separate `J_Hips` root PER BODY. So:
 *
 *   BODIES     count `J_Hips`, `J_Hips_2`, `J_Hips_3`. One is a solo move,
 *              two is attacker + victim, three or more is a TAG move.
 *              `C_*` roots are CLOTH rigs and are excluded — that is the
 *              trap that made HAMMERLOCKDDT look like a crowd in the sibling
 *              project, and the owner made it law: count BODY roots only.
 *   JOINTS     total, and how many actually turn more than 5 degrees. A
 *              "clip" where nothing moves is a pose, not an animation.
 *   WHO MOVES  per body. A second skeleton that never turns is a prop, not a
 *              partner — which is the difference between a real two-man
 *              capture and a mis-flagged solo.
 *   WHAT MOVES arms vs legs vs spine vs head, in degrees. A strike is a limb
 *              doing most of the work; a taunt is arms and head with quiet
 *              legs; locomotion is legs with a quiet upper body.
 *
 * The name is a HINT and never the authority — owner law, and it has been
 * wrong repeatedly (DOUBLE_LEG_TAKEDOWN is one wrestler; CROTCHCHOP is
 * labelled a strike and is a taunt). Where the name and the frames disagree
 * this says so out loud rather than picking one.
 *
 *   node tools/anim/inspect.mjs DOUBLESUPLEX
 *   node tools/anim/inspect.mjs --all --json > /tmp/anim.json
 *   node tools/anim/inspect.mjs --all --tag      (just the team moves)
 */
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = process.env.BF_CLIP_SRC ?? '/home/user/Bannon/assets/moves/clips';
const BAKED_INDEX = 'public/motion/baked/index.json';

const BODY_ROOT = /^J_Hips(_\d+)?$/;
const CLOTH = /^C_/;
/**
 * WHICH BODY A BONE BELONGS TO.
 *
 * The second and third wrestlers are suffixed `_2` and `_3`, so it is
 * tempting to read any trailing number as a body index. That is wrong and it
 * is the kind of wrong that quietly poisons every number downstream:
 * `J_Index_L_01` is the first finger joint of body ONE, and `F_Cheek_L_02`
 * is a cheek. Only a suffix that matches a root actually present in this
 * clip counts — everything else is body 1.
 */
const bodyIndexer = (bodyRoots) => {
  const valid = new Set(
    bodyRoots.map((r) => /_(\d+)$/.exec(r)).filter(Boolean).map((m) => Number(m[1])),
  );
  return (bone) => {
    const m = /_(\d+)$/.exec(bone);
    if (!m) return 1;
    const n = Number(m[1]);
    return valid.has(n) ? n : 1;
  };
};
const GROUP = (b) => {
  const n = b.replace(/_\d+$/, '');
  if (/^F_/.test(n)) return 'face';
  if (/^C_/.test(n)) return 'cloth';
  if (/Hand|Finger|Thumb|Index|Middle|Ring|Pinky/i.test(n)) return 'hands';
  if (/Arm|Shoulder|Elbow|Wrist/i.test(n)) return 'arms';
  if (/Leg|Knee|Foot|Toe|Thigh|Shin|Ankle/i.test(n)) return 'legs';
  if (/Spine|Chest|Hips|Waist|Pelvis|Root/i.test(n)) return 'spine';
  if (/Neck|Head/i.test(n)) return 'head';
  return 'other';
};

/**
 * Total angular travel of one bone across the clip, in degrees.
 *
 * NaN-SAFE ON PURPOSE. The sync notes record that 193 source rotations omit
 * a component, and `undefined - undefined` is NaN, which then poisons every
 * sum it touches — the first run of this printed "hands 1558064%". A missing
 * component means no rotation on that axis, so it reads as 0.
 */
const ax = (v, k) => (Number.isFinite(v?.[k]) ? v[k] : 0);
function travelOf(keys, bone) {
  let total = 0;
  let prev = null;
  for (const k of keys) {
    const v = k.bones?.[bone];
    if (!v) continue;
    if (prev) {
      total += Math.abs(ax(v, 'rx') - ax(prev, 'rx'))
        + Math.abs(ax(v, 'ry') - ax(prev, 'ry'))
        + Math.abs(ax(v, 'rz') - ax(prev, 'rz'));
    }
    prev = v;
  }
  return Number.isFinite(total) ? (total * 180) / Math.PI : 0;
}

export function inspectSource(name) {
  const file = join(SRC, `${name}.json`);
  if (!existsSync(file)) return null;
  const d = JSON.parse(readFileSync(file, 'utf8'));
  const keys = d.keys ?? [];
  if (!keys.length) return { name, error: 'no keyframes' };
  const bones = Object.keys(keys[0].bones ?? {});

  const bodyRoots = bones.filter((b) => BODY_ROOT.test(b)).sort();
  const clothRoots = bones.filter((b) => CLOTH.test(b) && /Hips/i.test(b));

  const bodyOf = bodyIndexer(bodyRoots);
  const travel = {};
  for (const b of bones) travel[b] = travelOf(keys, b);
  const moving = bones.filter((b) => travel[b] > 5);

  // PER BODY: does this skeleton actually do anything?
  const perBody = {};
  for (const b of bones) {
    if (CLOTH.test(b) || /^F_/.test(b)) continue;
    const i = bodyOf(b);
    const p = (perBody[i] = perBody[i] ?? { bones: 0, moving: 0, deg: 0 });
    p.bones++;
    p.deg += travel[b];
    if (travel[b] > 5) p.moving++;
  }

  // WHAT MOVES, on the PRIMARY body only — body 2 and 3 are being done TO.
  const byGroup = {};
  for (const b of bones) {
    if (bodyOf(b) !== 1) continue;
    const g = GROUP(b);
    byGroup[g] = (byGroup[g] ?? 0) + travel[b];
  }
  const bodyTotal = ['arms', 'legs', 'spine', 'head', 'hands'].reduce((s, g) => s + (byGroup[g] ?? 0), 0) || 1;
  const share = (g) => {
    const v = (byGroup[g] ?? 0) / bodyTotal;
    return Number.isFinite(v) ? +v.toFixed(3) : 0;
  };

  const bodies = bodyRoots.length;
  /**
   * Which bodies genuinely perform. A capture can carry a second skeleton
   * that never turns — a bystander baked into the take — and calling that a
   * two-man move is the same class of mistake as reading the name.
   */
  const activeBodies = Object.entries(perBody).filter(([, v]) => v.moving >= 4).length;

  return {
    name,
    dur: d.dur,
    keys: keys.length,
    bones: bones.length,
    moving: moving.length,
    bodies,
    activeBodies,
    bodyRoots,
    clothRoots: clothRoots.length,
    perBody,
    share: {
      arms: share('arms'), legs: share('legs'), spine: share('spine'),
      head: share('head'), hands: share('hands'),
    },
    faceBones: bones.filter((b) => /^F_/.test(b)).length,
  };
}

/** What the frames say this is. The name is only ever a tie-breaker. */
export function readShape(s) {
  if (!s || s.error) return { kind: 'unknown', why: s?.error ?? 'no source' };
  if (s.moving <= 2) return { kind: 'pose', why: `${s.moving} bones turn at all` };
  if (s.activeBodies >= 3) return { kind: 'tag', why: `${s.activeBodies} bodies perform` };
  if (s.activeBodies === 2) return { kind: 'two-man', why: 'attacker and victim' };
  const { arms, legs, head } = s.share;
  if (legs > 0.45 && arms < 0.3) return { kind: 'legwork', why: `legs carry ${Math.round(legs * 100)}%` };
  if (arms > 0.5 && legs < 0.25) return { kind: 'armwork', why: `arms carry ${Math.round(arms * 100)}%` };
  if (head > 0.2) return { kind: 'expressive', why: `head carries ${Math.round(head * 100)}%` };
  return { kind: 'mixed', why: `arms ${Math.round(arms * 100)}% legs ${Math.round(legs * 100)}%` };
}

/**
 * THE SOURCE IS NOT IN THIS REPO AND IS NOT IN CI.
 *
 * The 871-bone captures live in the Bannon checkout; the bake only ever sees
 * the 22-bone reduction, which is why the body count was invisible to it.
 * So this writes what it learned to a small file that IS committed, and the
 * bake reads that. Re-run it whenever the source bank changes.
 */
const BODIES_OUT = 'public/motion/clip-bodies.json';

const args = process.argv.slice(2);
const wantAll = args.includes('--all');
const asJson = args.includes('--json');
const tagOnly = args.includes('--tag');
const named = args.filter((a) => !a.startsWith('--'));

const baked = existsSync(BAKED_INDEX) ? JSON.parse(readFileSync(BAKED_INDEX, 'utf8')) : {};
const list = wantAll
  ? readdirSync(SRC).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')).sort()
  : named;

if (!list.length) {
  console.log('usage: node tools/anim/inspect.mjs <CLIP> [...]   |   --all [--tag] [--json]');
  process.exit(1);
}

const rows = [];
for (const name of list) {
  const s = inspectSource(name);
  if (!s) { if (!wantAll) console.log(`${name}: not in ${SRC}`); continue; }
  const shape = readShape(s);
  const b = baked[name] ?? baked[name.toUpperCase()] ?? null;
  rows.push({ ...s, shape, bakedSemantic: b?.semantic ?? null, isBaked: Boolean(b) });
}

if (args.includes('--write')) {
  const out = {};
  for (const r of rows) {
    if (!r.bodies) continue;
    out[r.name] = { bodies: r.bodies, active: r.activeBodies, bones: r.bones, moving: r.moving };
  }
  writeFileSync(BODIES_OUT, JSON.stringify(out, null, 0));
  const tag = Object.values(out).filter((v) => v.active >= 3).length;
  const duo = Object.values(out).filter((v) => v.active === 2).length;
  console.log(`wrote ${BODIES_OUT}: ${Object.keys(out).length} clips, ${tag} team captures, ${duo} two-man`);
  process.exit(0);
}

if (asJson) { console.log(JSON.stringify(rows, null, 1)); process.exit(0); }

const show = tagOnly ? rows.filter((r) => r.shape.kind === 'tag') : rows;

if (tagOnly) {
  console.log(`\nTEAM MOVES — captures with three or more performing bodies (${show.length} of ${rows.length})\n`);
} else {
  console.log('\nWHAT IS IN THIS ANIMATION\n');
}
console.log('  clip                          dur  bones  moving  bodies  what the frames say        baked as');
for (const r of show) {
  const nameCol = r.name.length > 28 ? `${r.name.slice(0, 27)}…` : r.name;
  console.log(
    `  ${nameCol.padEnd(29)}${String(r.dur ?? '?').padStart(5)}${String(r.bones).padStart(7)}${String(r.moving).padStart(8)}`
    + `${String(r.bodies).padStart(8)}${r.activeBodies !== r.bodies ? `(${r.activeBodies} act)` : '      '}`
    + `  ${(`${r.shape.kind} — ${r.shape.why}`).padEnd(34).slice(0, 34)}`
    + `  ${r.isBaked ? (r.bakedSemantic ?? '?') : 'NOT BAKED'}`,
  );
}

if (!tagOnly && show.length === 1) {
  const r = show[0];
  console.log('\n  per body:');
  for (const [i, v] of Object.entries(r.perBody)) {
    console.log(`    body ${i}: ${String(v.bones).padStart(4)} bones, ${String(v.moving).padStart(3)} of them turn, ${Math.round(v.deg)} deg of travel${v.moving >= 4 ? '' : '   <- barely moves; a prop, not a partner'}`);
  }
  console.log('\n  the primary body spends its motion on:');
  for (const [g, v] of Object.entries(r.share).sort((a, b2) => b2[1] - a[1])) {
    console.log(`    ${g.padEnd(7)} ${String(Math.round(v * 100)).padStart(3)}%  ${'#'.repeat(Math.max(0, Math.min(40, Math.round(v * 40))))}`);
  }
  console.log(`\n  ${r.faceBones} facial bones, ${r.clothRoots} cloth rig(s) — excluded from the body count on purpose.`);
}

if (wantAll && !tagOnly) {
  const tags = rows.filter((r) => r.shape.kind === 'tag');
  const two = rows.filter((r) => r.shape.kind === 'two-man');
  const poses = rows.filter((r) => r.shape.kind === 'pose');
  console.log(`\n  ${rows.length} clips read · ${tags.length} TEAM moves · ${two.length} two-man · ${poses.length} that barely move`);
}
