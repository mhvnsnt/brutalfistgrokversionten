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
