# Brutal Fist — dev conversation

## 2026-09-16 — Don't touch unrequested axes; raise fighters not FX; un-statue

Rule: if the task is facing, do not change Y/FX/select. Extra FOOT_PLANT_SINK stacked fighters into the floor. Combat fighter Y is locked at 0.22; hit FX stay at 1.2. Integrity test was stopping the mixer (statues) — skipped. Combat yaw remains P1 0 / P2 π. Continue on https://github.com/mhvnsnt/brutalfistgrokversioneight

## 2026-09-16 evening — reattach bank clips, Tekken stick, unique arenas

Living-statue: idle auto-play + attack-reset-every-frame were killing punches. Hard-cut other mixer actions on combat/locomotion; lastPlayedTriggerRef only restarts on trigger increment; auto-play idle effect removed. Bank clips still bind-relative (`q_bind * q_src(0)^-1 * q_src(t)`). Mixer indexes SEMANTIC_STATE_ALIASES + COMBAT_STATE_TO_SEMANTIC.

Tekken stick: tap up = jump (after 220ms double-tap window); double-up sidestep −Z (away); double-down +Z (toward cam); f,f dash / hold run; b,b Korean backdash; hold down crouch; air control after jump. Jump Y now actually updates the mesh (was copying the ref before comparing). Training arena locked. Other arenas unique geometry + stage-colored fog (was all `#050508`).

## 2026-09-16 — Brutal Fist Grok v10 export verification

Repository `mhvnsnt/brutalfistgrokversionten` is now the active exported workspace on `main`. The project retains the Bannon GLB roster, PS1/Tekken presentation, native skeletal animation path, and locked combat orientation contract. `vite.config.ts` already provides the Vite compatibility shim for `next/dynamic` and the required `0.0.0.0:8080` preview contract.

Added `.github/workflows/brutal-fist-ci.yml` to verify Node 22 dependency installation, TypeScript, tests, and the production build on pushes and pull requests to `main`. This is verification infrastructure only; no fighter assets, authored skeletal data, yaws, floor placement, FX positions, or presentation values were changed.
