# Tekken 3 disc tooling — what is in the image, measured

Owner-supplied `Tekken 3 (Everything Unlocked).zip` (Drive), used with the
permission he has stated from the creators and the repo he forked from.

`psx_iso.mjs` reads a PlayStation disc image: it detects the sector layout,
walks the ISO9660 tree, lists and extracts files.

```
node tools/tekken/psx_iso.mjs "<Track 1>.bin" --list
node tools/tekken/psx_iso.mjs "<Track 1>.bin" --extract out --filter '\.BNS$'
```

## The disc, as measured

A PSX disc is **MODE2/2352**: 2352 bytes per sector of which only 2048 are user
data, at offset 24. Reading the file as a plain ISO finds nothing at all — the
volume descriptor is at byte `16*2352+24`, not `16*2048`. The tool detects this
rather than assuming it, because guessing wrong yields an empty file list that
looks exactly like a corrupt image.

Volume `TEKKEN3`, root at LBA 22, 6 files:

| file | LBA range | size | in this rip? |
|---|---|---|---|
| `/SYSTEM.CNF` | 23..24 | 67 B | yes |
| `/TEKKEN3/SLUS_004.02` | 25..604 | 1.1 MB | yes |
| `/TEKKEN3/TEKKEN3.XAS` | 604..250156 | 487.4 MB | yes |
| `/TEKKEN3/TEKKEN3.BNS` | 250156..268784 | 36.4 MB | yes |
| `/TEKKEN3/TEKKEN3.DA` | 269084..280712 | 22.7 MB | **beyond the end of the image** |
| `/TEKKEN3/TEKKEN3.DMY` | 280862..292635 | 23.0 MB | **beyond the end of the image** |

The image holds 268,934 physical sectors while the volume descriptor claims
292,635. `.DMY` is disc padding and rippers routinely drop it; `.DA` going with
it is a property of **this rip**, not of the game. Anything in `.DA` cannot be
recovered from this file.

## TEKKEN3.BNS — where the assets are

36.4 MB. Header is the Namco copyright string, then a pointer table of PS1 RAM
addresses (`0x800d2668`, `0x800d29d8`, …) — `0x800xxxxx` is main RAM, so this
is a loadable bank with an address table rather than a file archive.

Sector-aligned signatures found by scanning all 18,628 sectors:

| count | signature |
|---|---|
| 48 | `pBAV` — VAB audio banks |
| 16 | TIM textures |
| 15 | TMD models |
| 9 | PMD models |
| 58 | `UUUU` (fill / alignment) |

## TEKKEN3.XAS — not a conventional container

487.4 MB, 83.4% non-zero, and scanning **all 249,552 sectors** found exactly
ONE sector-aligned PS1 signature. Its head is dense nibble-packed data
consistent with XA ADPCM, and the executable's only asset-path string is
`\TEKKEN3\TEKKEN3.XAS` itself — so the game seeks into it by computed offset,
not by name.

Searching the executable for the offset table found **no ascending run of 24+
plausible u32 sector values**, so the table is not a flat array of sector
numbers in the main binary. It is likely 16-bit, relative, or built at runtime.

## What this does and does not get us

**Reachable now:** the disc filesystem, the executable, and the BNS bank with
its VABs, TIMs, TMDs and PMDs.

**Not solved:** Tekken 3's fighters are not stored as plain TMD — the animated,
skinned character models and their motion use Namco's own formats, and none of
the 24 sector-aligned models is likely to be a fighter. Extracting character
ANIMATION specifically needs that format reverse-engineered, or the XAS offset
table recovered from the executable's code rather than its data.

That is a real project, not a next step. The systems work — notation, stance
gating, frame data, ring-out behaviour — is what has actually been moving the
game forward, and it comes from Schwarzerblitz, where the data is readable.
