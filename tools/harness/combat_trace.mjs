/**
 * WHAT ACTUALLY HAPPENS, FRAME BY FRAME, WHEN YOU PRESS A BUTTON.
 *
 * Owner: "the combat looking incoherent, buggy, and glitchy."
 *
 * A browser run costs twelve minutes and shows pictures. This drives the real
 * FighterStateMachine at a fixed 60fps and logs EVERY frame: the action state,
 * the motion state, the move, and the frame within it. Incoherent combat has a
 * shape in that log — states that last one frame, moves cancelled before they
 * come out, transitions that fire twice, a body that goes back to idle in the
 * middle of a swing.
 */
import { FighterStateMachine, DEFAULT_MOVE_WINDOWS } from '../../src/engine/combat/FighterStateMachine.ts';

const NEUTRAL = { forward: 0, strafe: 0, light: false, heavy: false, guard: false, crouch: false };
const F = 1 / 60;

function trace(label, script, frames = 90) {
  const fsm = new FighterStateMachine();
  const rows = [];
  for (let f = 0; f < frames; f++) {
    const input = { ...NEUTRAL, ...(script(f) ?? {}) };
    fsm.tickAirborne(F);
    fsm.update(input, F);
    const w = fsm.getHitboxWindow?.() ?? {};
    rows.push({
      f,
      action: fsm.action,
      motion: fsm.current,
      move: fsm.currentMove?.name ?? fsm.currentMove?.animation ?? '-',
      active: !!w.active,
    });
  }
  // Collapse to transitions so the log is readable.
  const changes = [];
  for (let i = 0; i < rows.length; i++) {
    const a = rows[i], b = rows[i - 1];
    if (!b || a.action !== b.action || a.motion !== b.motion || a.active !== b.active) {
      changes.push(a);
    }
  }
  console.log(`\n=== ${label} ===`);
  for (const c of changes) {
    console.log(`  f${String(c.f).padStart(3)}  ${c.action.padEnd(12)} ${c.motion.padEnd(14)} ${c.active ? 'ACTIVE' : '      '}  ${c.move}`);
  }
  // The shapes that read as glitchy.
  const oneFrame = [];
  for (let i = 1; i < changes.length; i++) {
    const span = changes[i].f - changes[i - 1].f;
    if (span === 1) oneFrame.push(`${changes[i - 1].action}/${changes[i - 1].motion} lasted 1 frame at f${changes[i - 1].f}`);
  }
  const activeFrames = rows.filter((r) => r.active).length;
  console.log(`  -> ${changes.length} transitions, ${activeFrames} active frames, ${oneFrame.length} one-frame states`);
  for (const o of oneFrame.slice(0, 6)) console.log(`     ! ${o}`);
  return { rows, changes, oneFrame, activeFrames };
}

console.log('COMBAT TRACE — the real state machine at a fixed 60fps\n');
console.log('move windows available:', Object.keys(DEFAULT_MOVE_WINDOWS).join(', '));

trace('single LIGHT press, then nothing', (f) => (f === 5 ? { light: true } : {}));
trace('single HEAVY press, then nothing', (f) => (f === 5 ? { heavy: true } : {}));
trace('LIGHT held for 30 frames', (f) => (f >= 5 && f < 35 ? { light: true } : {}));
trace('LIGHT, LIGHT, LIGHT — a string', (f) => ({ light: f === 5 || f === 20 || f === 35 }));
trace('LIGHT then HEAVY 8 frames later', (f) => ({ light: f === 5, heavy: f === 13 }));
trace('crouch + LIGHT', (f) => ({ crouch: f >= 4, light: f === 6 }));
trace('walk forward then LIGHT mid-stride', (f) => ({ forward: f >= 2 && f < 40 ? 1 : 0, light: f === 20 }));
