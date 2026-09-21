# Agent Continuation Log

This is a durable handoff log for long-running agent sessions. It is not a substitute
for the living systems backlog; it records why the current workstream changed.

## 2026-09-20 / 2026-09-21 UTC — continuation after Claude session limit

Owner directive:
- Continue directly from the repository state; do not reset or throw away prior work.
- The active editor regression is the first blocker.
- Keep the PWA testable while work continues.
- Treat the repository as the durable memory of requirements and agent behavior.
- Keep improving the game with concrete engineering, measured verification, and
  compatible open-source components where they materially improve the result.
- Any newly discovered requirement, gap, regression, or measurement correction must
  be added to GAME_SYSTEMS_GAP_BACKLOG.md.

Work completed:
1. Identified a Move Library partial-render regression: the derived model list can
   be empty during the first render, while useState captures that empty result once.
   The editor could therefore render its controls/list while receiving no valid GLB
   model URL.
2. Fixed model selection to synchronize after the model list becomes available and
   prefer BANNON_rigged when present.
3. Isolated the selection rule in moveLibraryModelSelection.ts.
4. Added regression tests for preferred-model selection, fallback selection, and the
   empty-first-render case.
5. Added the regression test to the package test gate.
6. Updated AGENTS.md with the durable operating standard: active blockers first,
   measure before visual/animation changes, verify through the real pipeline,
   regression guards, UNKNOWN is never PASS, preserve authored content, and record
   open-source provenance.
7. Updated GAME_SYSTEMS_GAP_BACKLOG.md with the corrected JAGER/TARZANIAN verdict,
   MAIME's separate structural rig defect, the Move Library regression, and the
   agent operating contract.

Relevant commits:
- e5acb4c73486c2ef9fe71228c37e57dd15233d13 — editor model-state repair
- 5edd1390f4b8b96f3716b0b8df490a972c2555b0 — selection contract
- fcd121d0ea43a15a6def44d3ce26d247536c526d — component uses contract
- fdf70fc3628021b33856ab49c5854030a8145bae — regression tests
- 3ccca53fb53c5d50fa8bae7745b4949dee7d82d6 — test-gate inclusion
- 7baed8f116ca28390e0e3c893b19af16a935674b — agent operating standard
- 6497eca90424d91899a58511151f013549a2dc62 — backlog evidence update

Verification note:
GitHub reports no Actions runs attached to the new commits. Do not claim the
test suite, typecheck, production build, or PWA runtime is green until an actual
run or runtime probe supplies evidence. The owner is testing the PWA concurrently.
