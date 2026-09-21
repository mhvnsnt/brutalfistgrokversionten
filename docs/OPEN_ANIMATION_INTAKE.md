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
