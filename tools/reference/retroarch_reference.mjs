#!/usr/bin/env node
/**
 * RetroArch reference runner for the owner's external Tekken 3 copy.
 *
 * This is a REFERENCE/MEASUREMENT tool only. It never downloads, stores, or
 * commits the disc, BIOS, or copyrighted game assets.
 *
 * It uses libretro's documented keyboard bindings instead of scraping a GUI.
 * PCSX-ReARMed is preferred when present because it can run with its HLE BIOS;
 * a real Sony BIOS is never fetched or bundled.
 *
 * Usage:
 *   node tools/reference/retroarch_reference.mjs --cue="/path/Tekken 3 (USA).cue"
 *   node tools/reference/retroarch_reference.mjs --cue="..." --seconds=45
 */
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const cue = arg('cue', path.join(os.homedir(), 'scratch/rom/Tekken 3 (USA).cue'));
const seconds = Number(arg('seconds', '45'));
const display = arg('display', ':77');
const out = arg('out', path.join(os.tmpdir(), 'brutal-fist-retroarch-reference'));
const retroarchCandidates = [
  process.env.RETROARCH,
  'retroarch',
  '/usr/bin/retroarch',
  '/usr/games/retroarch',
].filter(Boolean);

function which(candidates) {
  for (const candidate of candidates) {
    try {
      execFileSync(candidate, ['--version'], { stdio: 'ignore', timeout: 5000 });
      return candidate;
    } catch {}
  }
  return null;
}

function findCore() {
  const roots = [
    process.env.LIBRETRO_CORE,
    path.join(os.homedir(), '.config/retroarch/cores/pcsx_rearmed_libretro.so'),
    '/usr/lib/x86_64-linux-gnu/libretro/pcsx_rearmed_libretro.so',
    '/usr/lib/libretro/pcsx_rearmed_libretro.so',
    '/usr/lib/x86_64-linux-gnu/libretro/mednafen_psx_hw_libretro.so',
  ].filter(Boolean);
  return roots.find((p) => fs.existsSync(p)) || null;
}

if (!fs.existsSync(cue)) {
  console.error(`[retroarch-reference] no cue file: ${cue}`);
  console.error('The owner\'s disc stays outside git; pass --cue=<path>.');
  process.exit(2);
}

const retroarch = which(retroarchCandidates);
if (!retroarch) {
  console.error('[retroarch-reference] RetroArch is not installed.');
  console.error('This tool does not install binaries or fetch BIOS files.');
  process.exit(3);
}

const core = findCore();
if (!core) {
  console.error('[retroarch-reference] no compatible libretro PSX core found.');
  console.error('Expected PCSX-ReARMed first; install/provide the core externally and retry.');
  process.exit(4);
}

fs.mkdirSync(out, { recursive: true });
const cfg = path.join(out, 'reference.cfg');
const keymap = [
  'input_player1_up = "up"',
  'input_player1_down = "down"',
  'input_player1_left = "left"',
  'input_player1_right = "right"',
  'input_player1_a = "x"',
  'input_player1_b = "z"',
  'input_player1_x = "s"',
  'input_player1_y = "a"',
  'input_player1_l = "q"',
  'input_player1_r = "w"',
  'input_player1_start = "enter"',
  'input_player1_select = "rshift"',
  'input_exit_emulator = "escape"',
  'video_fullscreen = "false"',
  'video_windowed_fullscreen = "false"',
  'video_driver = "gl"',
].join('\n') + '\n';
fs.writeFileSync(cfg, keymap);

const log = path.join(out, 'retroarch.log');
const args = [
  '--verbose',
  '--config', cfg,
  '--libretro', core,
  '--appendconfig', cfg,
  cue,
];
console.log(`[retroarch-reference] core=${core}`);
console.log(`[retroarch-reference] cue=${path.basename(cue)}`);
console.log(`[retroarch-reference] keyboard: WASD=move, X/Z/S/A=face buttons, Q/W=shoulders, Enter=Start`);
console.log(`[retroarch-reference] output=${out}`);

const child = spawn(retroarch, args, {
  env: { ...process.env, DISPLAY: display },
  stdio: ['ignore', 'pipe', 'pipe'],
});
const stream = fs.createWriteStream(log);
child.stdout.pipe(stream);
child.stderr.pipe(stream);
const stop = setTimeout(() => child.kill('SIGTERM'), Math.max(1, seconds) * 1000);
child.on('exit', (code, signal) => {
  clearTimeout(stop);
  stream.end();
  console.log(`[retroarch-reference] exit=${code ?? 'null'} signal=${signal ?? 'none'}`);
  console.log(`[retroarch-reference] log=${log}`);
});
