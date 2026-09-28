#!/usr/bin/env node
/**
 * THE WHOLE SCHWARZERBLITZ MOVE DATABASE, NOT A PATCH OF IT.
 *
 * Owner: "bring in all its schwarzerblitz data but u need more on top of that"
 * and "stop jerry rig patching".
 *
 * Schwarzerblitz is an open-source 3D fighter whose clips this project already
 * ships. We took its ANIMATIONS and left its MOVE MODEL behind, then
 * hand-authored six move windows and derived the other 286 from clip length.
 * That is why the combat does not behave like a fighting game: the assets are a
 * fighting game's, the data underneath them is not.
 *
 * This reads every moves.txt and keeps the entire schema — measured across the
 * four files, every directive that appears:
 *
 *   #FRAMES #ANIMATION #ANIMATION_RIGHTSIDE #RANGE #STANCE #NEWSTANCE
 *   #HITBOX (bone, start, end, damage, hits, ?, REACTION, HEIGHT)
 *   #CANCEL_INTO (move, from, to)      #FOLLOWUP (move, from, to)
 *   #INVINCIBILITY_FRAMES              #INVINCIBILITY_FRAMES_AGAINST (type, from, to)
 *   #ARMOR_FRAMES_AGAINST (type, from, to)
 *   #MOVEMENT (frame, x, y, z)         #THROW #BULLET
 *   #DELAY_AFTER_MOVE_MS #NO_DELAY #NO_DIRECTION_LOCK #FOLLOWUP_ONLY
 *   #VS_GROUNDED #ANTI_AIR_ONLY #ONLY_WHEN_OPPONENT_ATTACKS
 *   #REQUIRES_PRECISE_INPUT #NO_CANCELS_ON_WHIFF #TRACK_AFTER_ANIMATION
 *   #MAXIMUM_TRACKING_ANGLE #INPUT
 *
 * THE REACTION AND THE HEIGHT ARE THE POINT. Every hitbox names the reaction
 * the victim plays and whether the attack is High, Mid or Low — the two things
 * our imported moves had none of, and the two things ReactionMatrix and the
 * guard layer were built to consume.
 *
 *   node tools/moves/import_schwarzerblitz.mjs           report
 *   node tools/moves/import_schwarzerblitz.mjs --write   write the database
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = [
  '/home/user/SchwarzerblitzEngine/schwarzerblitz_engine/bin/media/characters',
  '/home/user/schwarzerblitzengine/schwarzerblitz_engine/bin/media/characters',
];
const OUT = 'public/motion/schwarzerblitz_moves.json';

const root = ROOTS.find((r) => existsSync(r));
if (!root) { console.error('no Schwarzerblitz media found'); process.exit(1); }

const nums = (parts) => parts.map(Number).filter((n) => Number.isFinite(n));

function parseMoves(text, character) {
  const lines = text.split(/\r?\n/);
  const out = [];
  let cur = null;
  let block = null;
  const open = (name) => { block = name; if (cur && !cur[name]) cur[name] = []; };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#')) {
      const [tag, ...rest] = line.split(/\s+/);
      const arg = rest.join(' ').trim();
      switch (tag) {
        case '#MOVE':
          if (cur) out.push(cur);
          cur = { character, name: arg, followupOnly: false, flags: [] };
          block = null;
          continue;
        case '#END': if (cur) { out.push(cur); cur = null; } block = null; continue;
        default: break;
      }
      if (!cur) continue;
      switch (tag) {
        case '#DISPLAY_NAME': cur.displayName = arg; break;
        case '#ANIMATION': cur.animation = arg; break;
        case '#ANIMATION_RIGHTSIDE': cur.animationRight = arg; break;
        case '#FRAMES': { const n = nums(rest); cur.frameStart = n[0]; cur.frameEnd = n[1]; break; }
        case '#RANGE': { const n = nums(rest); cur.rangeMin = n[0]; cur.rangeMax = n[1]; break; }
        case '#STANCE': cur.stance = arg; break;
        case '#NEWSTANCE': case '#NEW_STANCE': cur.newStance = arg; break;
        case '#DELAY_AFTER_MOVE_MS': cur.delayMs = Number(arg); break;
        case '#MAXIMUM_TRACKING_ANGLE': cur.trackAngle = Number(arg); break;
        case '#MAXIMUM_TRACKING_ANGLE_STARTUP': cur.trackAngleStartup = Number(arg); break;
        case '#MINIMUM_DAMAGE_RATIO_AFTER_SCALING': cur.minDamageRatio = Number(arg); break;
        case '#INVINCIBILITY_FRAMES': { const n = nums(rest); cur.invincible = { from: n[0], to: n[1] }; break; }
        case '#FOLLOWUP_ONLY': cur.followupOnly = true; break;
        case '#NO_DELAY': case '#NO_SOUNDS': case '#NO_DIRECTION_LOCK': case '#VS_GROUNDED':
        case '#ANTI_AIR_ONLY': case '#ONLY_WHEN_OPPONENT_ATTACKS': case '#REQUIRES_PRECISE_INPUT':
        case '#NO_CANCELS_ON_WHIFF': case '#TRACK_AFTER_ANIMATION': case '#REQUIRES_BULLET_COUNTERS':
          cur.flags.push(tag.slice(1)); break;
        case '#HITBOX': open('hitboxes'); break;
        case '#CANCEL_INTO': open('cancelInto'); break;
        case '#FOLLOWUP': open('followups'); break;
        case '#MOVEMENT': open('movement'); break;
        case '#INPUT': open('input'); break;
        case '#SOUNDS': open('sounds'); break;
        case '#THROW': open('throw'); break;
        case '#BULLET': open('bullet'); break;
        case '#INVINCIBILITY_FRAMES_AGAINST': open('invincibleAgainst'); break;
        case '#INVINCIBLE_AGAINST': open('invincibleAgainst'); break;
        case '#ARMOR_FRAMES_AGAINST': open('armorAgainst'); break;
        case '#MODIFY_OBJECT_AT_FRAME': open('modifyObject'); break;
        default:
          if (tag.endsWith('_END')) block = null;
          break;
      }
      continue;
    }
    if (!cur || !block) continue;
    // 16 of the 137 hitbox lines carry a leading '!' marker, which shifted every
    // column by one and parsed the DAMAGE as the reaction. Drop it.
    const parts = line.split(/\s+/).filter((t, i) => !(i === 0 && t === '!'));
    switch (block) {
      case 'hitboxes': {
        // bone start end damage hits ? reaction height
        const [bone, s, e, dmg, hits, extra, reaction, height] = parts;
        cur.hitboxes.push({
          bone, from: Number(s), to: Number(e), damage: Number(dmg),
          hits, extra: Number(extra), reaction, height,
        });
        break;
      }
      case 'cancelInto':
      case 'followups': {
        const [move, from, to] = parts;
        cur[block].push({ move, from: Number(from), to: Number(to) });
        break;
      }
      case 'invincibleAgainst':
      case 'armorAgainst': {
        const [type, from, to] = parts;
        cur[block].push({ type, from: Number(from), to: Number(to) });
        break;
      }
      case 'movement': {
        const n = nums(parts.filter((x) => x !== '>'));
        if (n.length >= 4) cur.movement.push({ frame: n[0], x: n[1], y: n[2], z: n[3] });
        break;
      }
      default:
        cur[block].push(line);
    }
  }
  if (cur) out.push(cur);
  return out;
}

const chars = readdirSync(root).filter((d) => existsSync(join(root, d, 'moves.txt')));
const db = {};
let total = 0;
for (const c of chars) {
  const moves = parseMoves(readFileSync(join(root, c, 'moves.txt'), 'utf8'), c);
  db[c] = moves;
  total += moves.length;
}

const all = Object.values(db).flat();
const hitboxes = all.flatMap((m) => m.hitboxes ?? []);
const reactions = {}, heights = {};
for (const h of hitboxes) {
  if (h.reaction) reactions[h.reaction] = (reactions[h.reaction] ?? 0) + 1;
  if (h.height) heights[h.height] = (heights[h.height] ?? 0) + 1;
}
const count = (k) => all.filter((m) => (m[k] ?? []).length).length;

console.log(`\nSCHWARZERBLITZ MOVE DATABASE — ${chars.length} characters, ${total} moves\n`);
console.log(`  with hitboxes          ${count('hitboxes')}   (${hitboxes.length} hitboxes)`);
console.log(`  with cancel windows    ${count('cancelInto')}`);
console.log(`  with followups         ${count('followups')}`);
console.log(`  with movement curves   ${count('movement')}`);
console.log(`  with i-frames vs type  ${count('invincibleAgainst')}`);
console.log(`  with armour vs type    ${count('armorAgainst')}`);
console.log(`  follow-up only         ${all.filter((m) => m.followupOnly).length}`);
console.log(`\n  REACTIONS the hitboxes name: ${Object.entries(reactions).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}(${v})`).join(' ')}`);
console.log(`  ATTACK HEIGHTS:              ${Object.entries(heights).map(([k, v]) => `${k}(${v})`).join(' ')}`);

if (process.argv.includes('--write')) {
  writeFileSync(OUT, JSON.stringify({
    generatedBy: 'tools/moves/import_schwarzerblitz.mjs',
    source: root,
    characters: chars,
    moves: db,
  }));
  console.log(`\n  wrote ${OUT}`);
}
