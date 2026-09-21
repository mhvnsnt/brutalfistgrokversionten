# Open Animation Intake

This lane adds large redistributable animation libraries without turning them into unverified game moves.

## Current CC0 sources
- Quaternius Universal Animation Library 1 — 120+ animations, CC0-1.0.
- Quaternius Universal Animation Library 2 — 130+ animations, CC0-1.0.

Source URLs and provenance are recorded in `docs/open-source-animation-sources.json`.

## Local intake
Place extracted pack contents under `vendor/quaternius-ual-1/` and `vendor/quaternius-ual-2/`, then run `node scripts/sync-open-animation-sources.mjs`. The scanner records only files that actually exist; it does not generate or silently substitute animation bytes.

## Acceptance pipeline
1. provenance/license;
2. skeleton/bone inspection;
3. independent Three.js retarget cross-check;
4. bind/rest-pose validation;
5. skin/joint/weight/non-finite checks;
6. root-motion/floor/facing checks;
7. anatomical/joint-limit checks;
8. semantic owner classification;
9. body-count/partner-motion gate;
10. promotion into a playable move/state.

A filename match is only a candidate role. A `Throw_Reaction` clip cannot become an attack or throw deliverer merely because its geometry resembles one. Bannon-authored clips remain higher priority.

## Reproducible pack fetch

A fresh checkout no longer depends on somebody manually copying archives. `npm run predev` and `npm run prebuild` call `scripts/fetch-open-animation-packs.mjs` before scanning/baking. It fetches only the public STANDARD/free CC0 distributions into `vendor/quaternius-ual-1/` and `vendor/quaternius-ual-2/` when those directories do not already contain supported animation files, then `sync-open-animation-sources.mjs` inventories the real files.

The free distributions are intentionally used here; the repository does not silently fetch paid/proprietary source packages. The official Quaternius pages describe UAL1 as 120+ total animations and UAL2 as 130+ total animations, while public standard distributions contain only a subset. The game pipeline therefore treats the pack as an expandable intake source, not as a claim that every advertised clip is already shipped.

## Promotion rule

Imported clips do not automatically become moves. A candidate must survive the existing bake/retarget/body-count/contact gates and then be promoted into a character-specific move slot. This prevents a generic animation library from flattening the roster into one moveset.


The public UAL1/UAL2 downloads used by the fetcher are the OpenGameArt standard distributions, both explicitly listed as CC0 and attributed to Quaternius. UAL1's public standard package contains 45 of the 120+ advertised animations; UAL2's public standard package is the 130+ library's standard distribution. The fetcher therefore records actual downloaded bytes rather than assuming the full advertised catalog is present. citeturn1view0turn1view1