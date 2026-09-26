#!/usr/bin/env node
/**
 * THE LOOP. What is unblocked, who owns it, and what the numbers say.
 *
 * The delegation half of the OpenCognit pattern: a goal is split into tasks,
 * each task carries a specialist and its dependencies, and a task whose
 * dependencies are unmet is BLOCKED rather than offered. Their DAG resolver
 * does exactly this — unblock on completion, then assign.
 *
 * It deliberately does NOT spawn anything. The value of that architecture here
 * is the discipline, not the daemon: every task names the measurement that
 * closes it and the number it is at today, so nothing can be called done on a
 * feeling.
 *
 * Usage: node tools/parity/loop.mjs [--critic]
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const { tasks } = JSON.parse(readFileSync('tools/parity/tasks.json', 'utf8'));
const { verified, traps } = JSON.parse(readFileSync('tools/parity/memory.json', 'utf8'));
const done = new Set(tasks.filter((t) => t.status === 'done').map((t) => t.id));

const ready = tasks.filter((t) => t.status === 'open' && (t.needs ?? []).every((n) => done.has(n)));
const blocked = tasks.filter((t) => t.status === 'open' && !(t.needs ?? []).every((n) => done.has(n)));

console.log('\nMECHANICAL PARITY — the standing goal\n');
console.log(`  ${verified.length} things measured and settled, ${traps.length} traps written down`);
console.log(`  ${done.size} done · ${ready.length} ready · ${blocked.length} blocked\n`);

const byRole = new Map();
for (const t of ready) {
  if (!byRole.has(t.specialist)) byRole.set(t.specialist, []);
  byRole.get(t.specialist).push(t);
}
for (const [role, list] of byRole) {
  console.log(`  ${role.toUpperCase()}`);
  for (const t of list) {
    console.log(`    ${t.title}`);
    console.log(`      now:  ${t.now}`);
    console.log(`      done when: ${t.measure}`);
  }
}
if (blocked.length) {
  console.log('\n  BLOCKED');
  for (const t of blocked) {
    const missing = (t.needs ?? []).filter((n) => !done.has(n));
    console.log(`    ${t.title}  — waiting on ${missing.join(', ')}`);
  }
}
if (process.argv.includes('--critic')) {
  try { execFileSync('node', ['tools/parity/critic.mjs'], { stdio: 'inherit' }); } catch { /* the critic reports itself */ }
}
