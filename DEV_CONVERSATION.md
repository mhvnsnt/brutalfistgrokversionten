# Brutal Fist — dev conversation

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
