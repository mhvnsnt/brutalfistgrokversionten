#!/usr/bin/env node
/**
 * Fetch the redistributable STANDARD/free CC0 animation packs into the local
 * intake cache. Paid/proprietary source packs are never fetched by this file.
 *
 * The packs remain under vendor/ and are regenerated/indexed by
 * sync-open-animation-sources.mjs. A fresh checkout can therefore reproduce
 * the same intake without requiring a human to copy ZIPs into the repo.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const packs = [
  {
    id: 'quaternius-ual-1',
    root: 'vendor/quaternius-ual-1',
    // Public mirror of Quaternius' CC0 standard/free release.
    url: 'https://opengameart.org/sites/default/files/universal_animation_librarystandard.zip',
    archive: '.cache/open-animation/ual1.zip',
  },
  {
    id: 'quaternius-ual-2',
    root: 'vendor/quaternius-ual-2',
    // OpenGameArt distribution of Quaternius' CC0 standard/free release.
    url: 'https://opengameart.org/sites/default/files/universal_animation_library_2standard.zip',
    archive: '.cache/open-animation/ual2.zip',
  },
];

function command(name, args) {
  execFileSync(name, args, { cwd: root, stdio: 'inherit' });
}
function download(url, out) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  command(process.platform === 'win32' ? 'curl.exe' : 'curl',
    ['-L', '--fail', '--retry', '3', '--connect-timeout', '15', '-o', out, url]);
}
function unzip(archive, destination) {
  fs.mkdirSync(destination, { recursive: true });
  command(process.platform === 'win32' ? 'tar.exe' : 'unzip',
    process.platform === 'win32'
      ? ['-xf', archive, '-C', destination]
      : ['-q', archive, '-d', destination]);
}
function hasSupportedFiles(dir) {
  if (!fs.existsSync(dir)) return false;
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (/\.(glb|gltf|fbx|bvh)$/i.test(entry.name)) return true;
    }
  }
  return false;
}
function flattenSingleDirectory(from, to) {
  if (!fs.existsSync(from)) return;
  const entries = fs.readdirSync(from, { withFileTypes: true });
  if (entries.length !== 1 || !entries[0].isDirectory()) return;
  const only = path.join(from, entries[0].name);
  const tmp = to + '.flat';
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.renameSync(only, tmp);
  fs.rmSync(from, { recursive: true, force: true });
  fs.renameSync(tmp, from);
}
for (const pack of packs) {
  const destination = path.join(root, pack.root);
  if (hasSupportedFiles(destination)) {
    console.log('[open-animation] present:', pack.id);
    continue;
  }
  const archive = path.join(root, pack.archive);
  console.log('[open-animation] fetching:', pack.id);
  download(pack.url, archive);
  const staging = path.join(root, '.cache/open-animation', pack.id);
  fs.rmSync(staging, { recursive: true, force: true });
  unzip(archive, staging);
  flattenSingleDirectory(staging, staging);
  fs.rmSync(destination, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.renameSync(staging, destination);
  if (!hasSupportedFiles(destination)) {
    throw new Error(`Downloaded ${pack.id}, but no supported animation files were found`);
  }
  console.log('[open-animation] ready:', pack.id);
}
