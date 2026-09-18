# Brutal Fist — dev conversation

## 2026-09-18 — The repo could not install; the motion cache shipped 40 MB the runtime discards

Four measurements, four fixes. Every CI gate (`npm install` / `typecheck` / `test` / `build`) was red
before this pass, starting with the first one.

**1. `package.json` asked for seven versions that do not exist on npm.** `npm install` and `npm ci`
both died on `@radix-ui/react-alert-dialog@^1.2.12`. Measured against the registry: 1.1.23 is the
*latest published* version — there is no 1.2.x. The same for react-avatar (^1.3.3 → 1.2.6 latest),
react-collapsible (^1.2.12 → 1.1.20), react-dropdown-menu (^2.2.0 → 2.1.24), react-popover (^1.2.3 →
1.1.23), react-toggle-group (^1.3.3 → 1.1.19) and @tanstack/router-plugin (^1.170.0 → 1.168.40).
`package-lock.json` already held the real (latest) versions, which is why the two files disagreed and
`npm ci` refused. Ranges corrected to the published versions; `next` was also in `package.json` but
never in the lockfile, so the lockfile is regenerated with it.

**2. Two copies of three-mesh-bvh, each augmenting `THREE.BufferGeometry`.** drei pins ^0.8.3
(`computeBoundsTree` returns `MeshBVH`), the app uses 0.9.15 (returns `GeometryBVH`). Both global
augmentations merge, so the property has an intersection type no single implementation satisfies —
one TS2322 in `BoneHitboxSystem.ts`. Verified 0.9.15 still exports every symbol drei imports
(`shaderStructs`, `shaderIntersectFunction`, `MeshBVHUniformStruct`, `SAH`, `acceleratedRaycast`) and
deduped with an `overrides` entry. One copy, one augmentation, no cast needed.

**3. Eight share-card tests failed because they read this repo as their fixture.** `injectGrokPwaHead`
defaults `cwd` to `process.cwd()`, so `src/lib/og/site.json` ("Brutal Fist"), `public/og.jpg` and
`public/x-banner.jpg` were picked up as the baked site identity — a test asserting the document title
wins got the branded title instead. The implementation is correct (a game named Brutal Fist *should*
share as Brutal Fist); the tests simply lacked isolation, while the same file already used
`cwd: mkdtempSync(...)` elsewhere. They now read from an empty workspace. No shipping behaviour moved.

**4. The generated motion cache shipped 42.4 MB, of which the runtime reads 2.8 MB.**
`BannonMotionBank.makeClip` builds one QuaternionKeyframeTrack per bone in a 22-name list and ignores
everything else. The source clips also carry a `pose` block (19 IK joint positions, read by nothing —
`MixamoFightingMotionBank`'s `key.pose` is its own authored data, not this) and, on tag and cloth
captures, up to **1003** bone entries for second bodies and cloth rigs the target skeleton does not
have. The sync cached whole files, so ~40 MB of tracks that `makeClip` discards at load went into the
browser bundle.

`scripts/sync-bannon-motion.mjs` now caches exactly what the runtime consumes. **Proven lossless, not
assumed:** the 201 clips were rebuilt through `makeClip`'s exact algorithm from both the full source
and the pruned cache and compared track-by-track — 201/201 identical, 2002 tracks, same names, times,
values and durations. Nothing is deleted; the full clips are untouched in `mhvnsnt/Bannon`.

    client combat chunk   36,476 kB (gzip 4,487 kB)  ->  2,428 kB (gzip 487 kB)
    generated cache       44.4 MB                    ->  2.8 MB
    client build          48.3 s                     ->  2.5 s

The sync also reads a **local `mhvnsnt/Bannon` checkout** when the workspace has one attached
(`BANNON_REPO` or a sibling directory) and falls back to the pinned raw.githubusercontent commit, then
to the existing cache. Local: 1.3 s and no network; a clip listed in `index.json` but absent is now
named instead of reported as a 404.

### Measured and left open, deliberately — do not re-derive

- **110 of the 201 indexed clips build ZERO tracks.** Their source skeletons are not `mixamorig*`
  named (TAUNT, CROTCHCHOP, CARTWHEEL, TAU_*, RAPIDCHESTBEATING…), so every bone is filtered out and
  the clip animates nothing. The sync now warns with the names. This is the next system.
- **770 clip files in the Bannon checkout are not listed in `index.json`** and therefore never reach
  the game at all (973 on disk, 202 indexed).
- `ZONE_SLIDE_IN_TEST` is in `index.json` with no file behind it, in the checkout and at the pinned
  commit alike.
- 73 of 48,048 source rotations (4 clips) omit an Euler component. `THREE.Euler` already defaults a
  missing argument to 0, so this was **not** producing NaN; the cache now writes the 0 explicitly so
  the triple is complete and typed.
- `npx eslint .` reports 114 problems (21 errors). Identical count before and after this pass — all
  pre-existing, and lint is not part of the CI gate.

## 2026-09-16 — Don't touch unrequested axes; raise fighters not FX; un-statue

Historical note from the earlier v8 work. The values in this entry are superseded by the locked v10 project contract in `AGENTS.project.md` / `src/engine/V7OrientationContract.ts`: combat fighter Y is **0**, hit FX worldY is **1.05**, and combat yaw remains P1 **0** / P2 **π**. Do not resurrect the older Y/FX values.

## 2026-09-16 evening — reattach bank clips, Tekken stick, unique arenas

Living-statue: idle auto-play + attack-reset-every-frame were killing punches. Hard-cut other mixer actions on combat/locomotion; lastPlayedTriggerRef only restarts on trigger increment; auto-play idle effect removed. Bank clips still bind-relative (`q_bind * q_src(0)^-1 * q_src(t)`). Mixer indexes SEMANTIC_STATE_ALIASES + COMBAT_STATE_TO_SEMANTIC.

Tekken stick: tap up = jump (after 220ms double-tap window); double-up sidestep −Z (away); double-down +Z (toward cam); f,f dash / hold run; b,b Korean backdash; hold down crouch; air control after jump. Jump Y now actually updates the mesh (was copying the ref before comparing). Training arena locked. Other arenas unique geometry + stage-colored fog (was all `#050508`).

## 2026-09-16 — Brutal Fist Grok v10 export verification

Repository `mhvnsnt/brutalfistgrokversionten` is now the active exported workspace on `main`. The project retains the Bannon GLB roster, PS1/Tekken presentation, native skeletal animation path, and locked combat orientation contract. `vite.config.ts` already provides the Vite compatibility shim for `next/dynamic` and the required `0.0.0.0:8080` preview contract.

Added `.github/workflows/brutal-fist-ci.yml` to verify Node 22 dependency installation, TypeScript, tests, and the production build on pushes and pull requests to `main`. This is verification infrastructure only; no fighter assets, authored skeletal data, yaws, floor placement, FX positions, or presentation values were changed.

## 2026-09-16 — v10 contract cleanup

The first imported historical log entry contained stale v8-era combat Y/FX values. It has been corrected above so future agents do not mistake those historical numbers for the current locked v10 contract.

## 2026-09-16 — Reattach the real Bannon motion bank without moving fighters

The old `SOURCE_REGISTRY.json` referenced `/motion/*.json`, but those files were not actually present in the v10 export. The source clips do exist in the owner-granted `mhvnsnt/Bannon/assets/moves/clips` bank; the index records real durations, 24-key samples, and 52-bone Mixamo motion for clips such as `BOXING`, `HURRICANE_KICK`, `CENTER_BLOCK`, `HIT_REACTION`, `FALLING_FLAT_IMPACT`, `SUPLEX`, and `DWARF_WALK`.

Added `scripts/sync-bannon-motion.mjs` to pull the real owner-granted clip bank at dev/build time and cache it as `src/generated/BannonMotionBank.generated.ts`. This is not a replacement procedural animation system: the source motion is the existing Bannon motion bank.

Added `src/engine/retarget/BannonMotionBank.ts` and wired `animation_bridge/retarget.ts` so the source clips are converted to quaternion tracks, retargeted by bone-name identity, and then applied with the locked bind-relative formula:

`q(t) = q_bind × q_src(0)⁻¹ × q_src(t)`

The correction is local to bone rotation tracks. It does not modify fighter world position, world yaw, scale, floor placement, camera, or FX. Every imported clip is also kept addressable by its exact authored name so character-specific move slots can request their individual clips instead of collapsing everything into one generic attack.

The semantic table already contains aliases for locomotion, punches, kicks, guard, hit reactions, knockdowns, getup, grapples, run/dash/backdash, and several of the Bannon clip names.

## 2026-09-16 — Fix the first-tap directional bug

`src/engine/combat/TekkenInput.ts` had a real edge-case bug: the first `UP` press could be interpreted as a double-tap because the previous-tap timestamp started at `0` and the opening game clock can also be below the 220 ms double-tap threshold. The detector now requires `last > 0` before a second tap can count.

The directional contract remains: single UP = jump, UP+forward/back = directional jump, forward/back can be pressed after takeoff for air control, double-UP = sidestep away from camera, double-DOWN = sidestep toward camera, F,F = dash, hold after F,F = run, B,B = Korean backdash, hold after B,B = fast backward run, and held DOWN = crouch.

## 2026-09-16 — Rocket compatibility surface

Added a minimal Next.js application surface (`app/layout.tsx`, `app/page.tsx`, `next.config.ts`) and the Next.js dependency/scripts while retaining the existing Vite 0.0.0.0:8080 preview as the primary live game path. `app/page.tsx` exposes the existing `src/App.tsx` rather than creating a second game implementation. This is specifically to give Rocket a recognized Next.js + TypeScript project surface without replacing the working PWA architecture.
