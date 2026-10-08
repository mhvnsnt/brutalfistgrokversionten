#!/usr/bin/env node
/**
 * INTRO FMV ASSET TOOL — builds the placeholder, re-encodes a real render,
 * and (re)writes public/intro/intro.json.
 *
 *   node scripts/intro-movie.mjs placeholder [--music path.wav]
 *       60s 1280x720 30fps labelled placeholder (black slate + timecode burn),
 *       music muxed in when the WAV exists. Writes intro.mp4, intro.webm and
 *       intro.json.
 *
 *   node scripts/intro-movie.mjs swap <render.mp4|mov|mkv>
 *       Drop in the real render: encodes public/intro/intro.mp4 (H.264 High,
 *       yuv420p, AAC, +faststart) and intro.webm (VP9 + Opus) from it, then
 *       rewrites intro.json with placeholder:false.
 *
 *   node scripts/intro-movie.mjs manifest [--placeholder]
 *       Only recompute intro.json (duration, bytes, sha256) from whatever
 *       intro.mp4 / intro.webm are in public/intro. Use this if you replaced
 *       intro.mp4 by hand. A missing intro.webm is simply left out.
 *
 * The runtime never checks the sha256 (hashing 10 MB on a phone to play a
 * cut-scene is waste); it is there so a reviewer can prove which render is
 * shipped. The unit test only checks that it matches the bytes on disk.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'intro');
const MP4 = join(OUT, 'intro.mp4');
const WEBM = join(OUT, 'intro.webm');
const MANIFEST = join(OUT, 'intro.json');
const DEFAULT_MUSIC = '/workspace/intro-movie/music/intro_placeholder_v1.wav';
const FONT_CANDIDATES = [
  '/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf',
  '/System/Library/Fonts/Menlo.ttc',
];

/** Treatment v2 section labels, by frame. 1755-1799 is pure black on purpose. */
const SECTIONS = [
  [0, 299, 'TENSION DROP'],
  [300, 449, 'IGNITION - RIFF DROP f300'],
  [450, 1199, 'ROSTER BLITZ'],
  [1200, 1649, 'CORE CONFLICT - GREAT BANYAN TREE'],
  [1650, 1754, 'MATCH-CUT - f1754 SILENT'],
];

function ff(args) {
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
}

function probeDuration(file) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file]).toString().trim();
  return Math.round(parseFloat(out) * 1000) / 1000;
}

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function encodeWebm(src, hasAudio) {
  ff([
    '-i', src,
    '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '40', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '4',
    '-pix_fmt', 'yuv420p',
    ...(hasAudio ? ['-c:a', 'libopus', '-b:a', '80k'] : ['-an']),
    WEBM,
  ]);
}

function hasAudioStream(file) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', file]).toString().trim();
  return out.length > 0;
}

export function writeManifest({ placeholder }) {
  if (!existsSync(MP4)) throw new Error(`no ${MP4}`);
  const sources = [];
  for (const [file, type] of [['intro.mp4', 'video/mp4'], ['intro.webm', 'video/webm']]) {
    const p = join(OUT, file);
    if (!existsSync(p)) continue;
    sources.push({ file, type, bytes: statSync(p).size, sha256: sha256(p) });
  }
  const duration = probeDuration(MP4);
  const manifest = {
    version: 1,
    enabled: true,
    placeholder: !!placeholder,
    label: placeholder ? 'INTRO FMV PLACEHOLDER (black slate + timecode + intro_placeholder_v1 music)' : 'Brutal Fist intro FMV',
    // The primary file + its hash, as the handoff asked for; `sources` is what the player reads.
    file: 'intro.mp4',
    sha256: sources[0].sha256,
    duration,
    fps: 30,
    frames: Math.round(duration * 30),
    // Treatment v2 beats, informational only (the player just waits for `ended`).
    beats: { blackHoldFrom: 1755, blackHoldTo: 1784, bassDrop: 1785, onEnded: 1800 },
    sources,
  };
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`[intro-movie] wrote ${MANIFEST}`);
  for (const s of sources) console.log(`  ${s.file}  ${(s.bytes / 1024).toFixed(0)} KiB  ${s.sha256}`);
  return manifest;
}

function placeholder(musicArg) {
  const music = musicArg ?? DEFAULT_MUSIC;
  const withMusic = existsSync(music);
  const font = FONT_CANDIDATES.find((f) => existsSync(f));
  const fontOpt = font ? `fontfile='${font}':` : '';
  const live = 'lt(n,1755)';
  const txt = (text, y, size, color, extra = '') =>
    `drawtext=${fontOpt}text='${text}':fontsize=${size}:fontcolor=${color}:x=(w-text_w)/2:y=${y}:enable='${extra || live}'`;
  const filters = [
    txt('INTRO FMV PLACEHOLDER', 200, 64, 'white'),
    txt('BRUTAL FIST - replace public/intro/intro.mp4 with the real render', 290, 24, '0xAAAAAA'),
    ...SECTIONS.map(([a, b, label]) => txt(label, 360, 32, '0xE23D2B', `between(n,${a},${b})`)),
    // Frame counter + SMPTE-style timecode burn (30fps non-drop).
    `drawtext=${fontOpt}text='f%{eif\\:n\\:d\\:4} / 1800':fontsize=40:fontcolor=white:x=(w-text_w)/2:y=450:enable='${live}'`,
    `drawtext=${fontOpt}timecode='00\\:00\\:00\\:00':rate=30:fontsize=40:fontcolor=white:x=(w-text_w)/2:y=510:enable='${live}'`,
    txt('SNARE', 580, 28, 'yellow', `between(n,300,1754)*eq(mod(n,30),15)`),
  ].join(',');
  const tmp = join(OUT, '.placeholder_master.mp4');
  ff([
    '-f', 'lavfi', '-i', 'color=c=black:s=1280x720:r=30:d=60',
    ...(withMusic ? ['-i', music] : []),
    '-vf', filters,
    '-frames:v', '1800',
    '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-preset', 'slow', '-crf', '30', '-tune', 'stillimage',
    '-g', '60',
    ...(withMusic ? ['-c:a', 'aac', '-b:a', '96k', '-ac', '2', '-ar', '48000', '-shortest'] : ['-an']),
    '-movflags', '+faststart',
    tmp,
  ]);
  execFileSync('mv', [tmp, MP4]);
  encodeWebm(MP4, withMusic);
  console.log(`[intro-movie] placeholder built (${withMusic ? `music: ${music}` : 'NO MUSIC — wav not found'})`);
  return writeManifest({ placeholder: true });
}

function swap(src) {
  if (!src || !existsSync(src)) throw new Error(`render not found: ${src}`);
  const audio = hasAudioStream(src);
  const tmp = join(OUT, '.swap_intro.mp4');
  ff([
    '-i', src,
    '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-preset', 'slow', '-crf', '21',
    ...(audio ? ['-c:a', 'aac', '-b:a', '160k'] : ['-an']),
    '-movflags', '+faststart',
    tmp,
  ]);
  execFileSync('mv', [tmp, MP4]);
  if (existsSync(WEBM)) unlinkSync(WEBM);
  encodeWebm(MP4, audio);
  return writeManifest({ placeholder: false });
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const flag = (name) => { const i = rest.indexOf(name); return i >= 0 ? rest[i + 1] : undefined; };
  if (cmd === 'placeholder') placeholder(flag('--music'));
  else if (cmd === 'swap') swap(rest[0]);
  else if (cmd === 'manifest') writeManifest({ placeholder: rest.includes('--placeholder') });
  else {
    console.error('usage: node scripts/intro-movie.mjs placeholder [--music f.wav] | swap <render> | manifest [--placeholder]');
    process.exitCode = 2;
  }
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) main();
