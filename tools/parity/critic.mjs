#!/usr/bin/env node
/**
 * THE CRITIC. Nothing is done until the numbers say so.
 *
 * Owner: "someone built an open source AI agent OS called OpenCognit … the CEO
 * agent breaks it into tasks, assigns them to specialists, reviews their work,
 * and sends failed tasks back for another attempt … a critic checks outputs
 * before they're marked done."
 *
 * Taken from OpenCognit (github.com/OpenCognit/opencognit, Community Edition
 * v0.9.0, AGPL-3.0). Its own DAG engine puts the rule plainly: "Output
 * validation between every step is non-negotiable." Its server is a
 * docker/drizzle deployment and standing that up would not make this game
 * better, so what is taken is the LOOP — and the critic is wired to the gates
 * this repo already has, so it rejects on measurements rather than on opinion.
 *
 * Every gate here fails LOUDLY and says the number, because a gate that is
 * green somewhere nobody reads is not a gate — this project shipped four days
 * of a dead combat system behind exactly that.
 *
 * Usage: node tools/parity/critic.mjs [--quick]
 */
import { execFileSync } from 'node:child_process';

const QUICK = process.argv.includes('--quick');

/** Run a command; a non-zero exit is a rejection, not a crash. */
function run(cmd, args, { timeout = 900_000 } = {}) {
  try {
    const out = execFileSync(cmd, args, { encoding: 'utf8', timeout, stdio: ['ignore', 'pipe', 'pipe'] });
    return { ok: true, out };
  } catch (e) {
    return { ok: false, out: `${e.stdout ?? ''}${e.stderr ?? ''}` || String(e.message ?? e) };
  }
}

const gates = [
  {
    name: 'types',
    why: 'A type error shipped four days of combat that could not deal damage.',
    check: () => {
      const r = run('npx', ['tsc', '--noEmit']);
      return { pass: r.ok, detail: r.ok ? 'clean' : r.out.split('\n').filter(Boolean).slice(0, 3).join(' | ') };
    },
  },
  {
    name: 'tests',
    why: 'Including the one that asserts punching someone still hurts them.',
    check: () => {
      const r = run('npm', ['test']);
      const m = /# pass (\d+)[\s\S]*?# fail (\d+)/.exec(r.out);
      const pass = Number(m?.[1] ?? 0), fail = Number(m?.[2] ?? 1);
      return { pass: r.ok && fail === 0, detail: `${pass} passed, ${fail} failed` };
    },
  },
  {
    name: 'imported data has a reader',
    why: 'Four times this session, data was imported, listed, and consumed by nothing.',
    check: () => {
      const r = run('node', ['tools/audit/unconsumed_fields.mjs', '--gate']);
      const m = /(\d+) field\(s\) with no reader/.exec(r.out);
      return { pass: r.ok, detail: `${m?.[1] ?? '?'} unread (baseline allows the known ones)` };
    },
  },
  {
    name: 'a punch stays out of the pelvis',
    why: 'Owner, verbatim: "A punch should not cause a 90-degree pelvic torsion." Measured at 94.6.',
    check: () => {
      const r = run('node', ['--experimental-strip-types', '--import', './scripts/register-ts-resolve.mjs', 'tools/parity/pelvis_gate.ts']);
      const m = /as a hand strike\s+([\d.]+) deg/.exec(r.out);
      const c = /as a kick\s+([\d.]+) deg/.exec(r.out);
      return { pass: r.ok, detail: `${m?.[1] ?? '?'} deg outside the stance, unmasked control ${c?.[1] ?? '?'} deg (want <= 15)` };
    },
  },
  {
    name: 'no clip smuggles in a fake lower body',
    why: 'A leg track faster than the bank fastest real kick is not footwork, it is corruption.',
    check: () => {
      const r = run('node', ['tools/motion/bone_mask_audit.mjs', '--gate']);
      const m = /(\d+) have a lower body/.exec(r.out);
      return { pass: r.ok, detail: `${m?.[1] ?? '?'} of 455 not credible, and the manifest agrees` };
    },
  },
  ...(QUICK ? [] : [{
    name: 'hip volume under real clips',
    why: 'The thigh pinching to a quarter of its width is the visible tearing.',
    /**
     * Gated on the MASKED path, because that is what a hand strike now plays,
     * and reported beside the unmasked figure so the remaining full-body
     * exposure stays visible instead of sitting behind a permanently red gate
     * nobody reads. Measured: masked 0.92, the clips' own legs 0.65 — the
     * collapse was overwhelmingly the corrupt leg tracks, not linear blend
     * skinning. DQS on the same 60 clips only reaches 0.42 on the worst of
     * them, so the shader would have been the expensive fix for a data problem.
     */
    check: () => {
      const masked = run('node', ['tools/model_diag/lbs_in_play.mjs', 'public/models/TITAN.glb', '--clips', '40', '--masked']);
      const raw = run('node', ['tools/model_diag/lbs_in_play.mjs', 'public/models/TITAN.glb', '--clips', '40']);
      const num = (r) => Number(/median (\d+\.\d+)/.exec(r.out)?.[1] ?? 0);
      const m = num(masked);
      return { pass: m >= 0.85, detail: `${m || '?'} with the legs held at the stance (want >= 0.85); ${num(raw) || '?'} when a full-body clip drives them` };
    },
  }]),
];

console.log('\nCRITIC — nothing is done until the numbers say so\n');
let rejected = 0;
for (const g of gates) {
  let r;
  try { r = g.check(); } catch (e) { r = { pass: false, detail: String(e?.message ?? e).slice(0, 120) }; }
  if (!r.pass) rejected++;
  console.log(`  ${r.pass ? 'PASS  ' : 'REJECT'}  ${g.name.padEnd(30)} ${r.detail}`);
  if (!r.pass) console.log(`          ${g.why}`);
}
console.log(`\n  ${rejected === 0 ? 'Accepted.' : `${rejected} gate(s) rejected — back to the specialist.`}`);
process.exitCode = rejected ? 1 : 0;
