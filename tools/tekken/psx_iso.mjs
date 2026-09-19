#!/usr/bin/env node
/**
 * READ A PSX DISC IMAGE — sector layout detection + an ISO9660 directory walk.
 *
 * A PlayStation disc is not a plain ISO. The .cue says MODE2/2352, meaning
 * every sector on disc is 2352 bytes of which only 2048 are user data:
 *
 *   [0..11]   sync pattern 00 FF*10 00
 *   [12..15]  address + mode byte
 *   [16..23]  Mode 2 subheader (8 bytes, duplicated 4+4)
 *   [24..2071] 2048 bytes of USER DATA        <- the only part ISO9660 sees
 *   [2072..]  EDC / ECC
 *
 * Reading the file as if it were a plain ISO therefore finds nothing: the
 * volume descriptor is at USER-DATA sector 16, which lives at byte
 * 16*2352 + 24 in the raw image, not 16*2048.
 *
 * The layout is DETECTED rather than assumed — a 2048-byte-per-sector dump of
 * the same game is also common, and guessing wrong gives an empty file list
 * that looks like a corrupt image.
 *
 * Usage:
 *   node tools/tekken/psx_iso.mjs <image.bin> [--list] [--extract <dir>] [--filter re]
 */

import { closeSync, mkdirSync, openSync, readSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const RAW_SECTOR = 2352;
export const USER_DATA = 2048;
/** Mode 2 Form 1: 16-byte header + 8-byte subheader before the payload. */
export const MODE2_OFFSET = 24;
/** Mode 1: 16-byte header, no subheader. */
export const MODE1_OFFSET = 16;

const SYNC = Buffer.from([0x00, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x00]);

/**
 * Work out how the image is laid out by looking for the ISO9660 volume
 * descriptor ("CD001") where each candidate layout would put it.
 */
export function detectLayout(fd) {
  const candidates = [
    { name: 'MODE2/2352', sectorSize: RAW_SECTOR, offset: MODE2_OFFSET },
    { name: 'MODE1/2352', sectorSize: RAW_SECTOR, offset: MODE1_OFFSET },
    { name: 'ISO/2048', sectorSize: USER_DATA, offset: 0 },
  ];
  const buf = Buffer.alloc(USER_DATA);
  for (const c of candidates) {
    const at = 16 * c.sectorSize + c.offset;
    try {
      readSync(fd, buf, 0, USER_DATA, at);
    } catch {
      continue;
    }
    // A Primary Volume Descriptor is type 1 followed by "CD001".
    if (buf[0] === 1 && buf.subarray(1, 6).toString('latin1') === 'CD001') return c;
  }
  return null;
}

/** Read one 2048-byte user-data sector, whatever the physical layout. */
export function readSector(fd, layout, lba, buf = Buffer.alloc(USER_DATA)) {
  readSync(fd, buf, 0, USER_DATA, lba * layout.sectorSize + layout.offset);
  return buf;
}

/** ISO9660 stores multi-byte numbers little- AND big-endian back to back. */
const both32 = (b, o) => b.readUInt32LE(o);
const both16 = (b, o) => b.readUInt16LE(o);

/** Parse one directory record. Returns null at a terminator. */
export function parseRecord(buf, offset) {
  const len = buf[offset];
  if (!len) return null;
  const extentLba = both32(buf, offset + 2);
  const size = both32(buf, offset + 10);
  const flags = buf[offset + 25];
  const nameLen = buf[offset + 32];
  let name = buf.subarray(offset + 33, offset + 33 + nameLen).toString('latin1');
  // "FILE.EXT;1" — the version suffix is noise for our purposes.
  const semi = name.indexOf(';');
  if (semi > 0) name = name.slice(0, semi);
  return {
    length: len,
    lba: extentLba,
    size,
    isDir: (flags & 0x02) !== 0,
    name,
    raw: buf.subarray(offset + 33, offset + 33 + nameLen),
  };
}

/** Walk the whole directory tree from the root record. */
export function walk(fd, layout, rootLba, rootSize, path = '/', out = [], depth = 0) {
  if (depth > 8) return out;
  const sectors = Math.ceil(rootSize / USER_DATA);
  const buf = Buffer.alloc(USER_DATA);
  for (let s = 0; s < sectors; s++) {
    readSector(fd, layout, rootLba + s, buf);
    let off = 0;
    while (off < USER_DATA) {
      const rec = parseRecord(buf, off);
      if (!rec) break;
      off += rec.length;
      // 0x00 and 0x01 are "." and ".." as single raw bytes.
      if (rec.raw.length === 1 && (rec.raw[0] === 0 || rec.raw[0] === 1)) continue;
      const full = path + rec.name;
      if (rec.isDir) {
        out.push({ path: full + '/', lba: rec.lba, size: rec.size, isDir: true });
        walk(fd, layout, rec.lba, rec.size, full + '/', out, depth + 1);
      } else {
        out.push({ path: full, lba: rec.lba, size: rec.size, isDir: false });
      }
    }
  }
  return out;
}

export function openImage(path) {
  const fd = openSync(path, 'r');
  const layout = detectLayout(fd);
  if (!layout) {
    closeSync(fd);
    throw new Error('no ISO9660 volume descriptor found in any known sector layout');
  }
  const pvd = readSector(fd, layout, 16);
  const volume = pvd.subarray(40, 72).toString('latin1').trim();
  // The root directory record lives at byte 156 of the PVD.
  const rootLba = both32(pvd, 156 + 2);
  const rootSize = both32(pvd, 156 + 10);
  const totalSectors = both32(pvd, 80);
  return { fd, layout, volume, rootLba, rootSize, totalSectors, logicalBlock: both16(pvd, 128) };
}

/** Read a file's bytes out of the image, sector by sector. */
export function readFileBytes(fd, layout, lba, size) {
  const sectors = Math.ceil(size / USER_DATA);
  const out = Buffer.alloc(sectors * USER_DATA);
  const buf = Buffer.alloc(USER_DATA);
  for (let s = 0; s < sectors; s++) {
    readSector(fd, layout, lba + s, buf);
    buf.copy(out, s * USER_DATA);
  }
  return out.subarray(0, size);
}

function main() {
  const [image, ...rest] = process.argv.slice(2);
  if (!image) {
    console.error('usage: psx_iso.mjs <image.bin> [--list] [--extract <dir>] [--filter <regex>]');
    process.exitCode = 1;
    return;
  }
  const disc = openImage(image);
  const raw = statSync(image).size;
  console.log(`[psx-iso] ${image.split('/').pop()}`);
  console.log(`[psx-iso] layout ${disc.layout.name}, ${raw} bytes = ${Math.floor(raw / disc.layout.sectorSize)} sectors`);
  console.log(`[psx-iso] volume "${disc.volume}", ${disc.totalSectors} data sectors, root at LBA ${disc.rootLba}`);

  const files = walk(disc.fd, disc.layout, disc.rootLba, disc.rootSize);
  const filterArg = rest.indexOf('--filter');
  const filter = filterArg >= 0 ? new RegExp(rest[filterArg + 1], 'i') : null;
  const shown = files.filter((f) => !filter || filter.test(f.path));

  const totalBytes = files.filter((f) => !f.isDir).reduce((a, f) => a + f.size, 0);
  console.log(`[psx-iso] ${files.filter((f) => !f.isDir).length} files, ${files.filter((f) => f.isDir).length} dirs, ${(totalBytes / 1048576).toFixed(1)} MB`);

  if (rest.includes('--list')) {
    for (const f of shown) {
      console.log(`  ${f.isDir ? 'd' : '-'} ${String(f.size).padStart(10)}  LBA ${String(f.lba).padStart(7)}  ${f.path}`);
    }
  }

  const exArg = rest.indexOf('--extract');
  if (exArg >= 0) {
    const dir = rest[exArg + 1];
    let n = 0;
    for (const f of shown) {
      if (f.isDir) continue;
      const dest = join(dir, f.path.replace(/^\//, ''));
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, readFileBytes(disc.fd, disc.layout, f.lba, f.size));
      n++;
    }
    console.log(`[psx-iso] extracted ${n} file(s) to ${dir}`);
  }
  closeSync(disc.fd);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) main();
