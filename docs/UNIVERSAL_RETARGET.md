# Universal humanoid retargeter

Additive layer, behind a flag: any humanoid clip (baked bank, Euler bank, embedded GLB clips, staged CC0 or CMU-free-use sources) retargets onto any humanoid GLB rig. Existing clips play exactly as before when the retargeter is off, and on the roster it does nothing, because all 27 roster models share the canonical skeleton.

## Files (all new)

| File | Role |
| --- | --- |
| `src/engine/retarget/HumanoidBoneMap.ts` | Rig-agnostic bone map. The limb slots are hips, head, the optional clavicles, arms, hands, legs, feet and the optional toes. Spine and neck chains of any length are derived from the hierarchy. Fingers are optional. Name parsing covers mixamorig / Bip / DEF- / ORG- prefixes, `.L`/`_l`/`Left`/glued suffixes, and KayKit, UAL, Mesh2Motion and CMU names. When names fail, a topology fallback is used: the feet are the lowest leaves, the head is the highest leaf, and the hands are found from lateral clusters. |
| `src/engine/retarget/HumanoidRigOverrides.ts` | Explicit per-rig overrides, such as helper bones that should be ignored. |
| `src/engine/retarget/UniversalRetarget.ts` | Core solver. Each rig gets a measured frame: left from the labels, up = hips→head, forward from ankle→toe, or from the foot-mesh centroid when the rig has no toes. The frame may be **mirror-handed**, in which case source→target is a reflection `C`. Rotations are carried as world deltas, `D = C·Ws(t)·Ws0⁻¹·Cᵀ`, and applied as `Wt = D·A·Wt0`, where `A` aligns rest bone directions (T-pose vs A-pose). The spine and neck are resampled by chain fraction. Hips translation is scaled by the leg-length ratio, with a ground lock. Quaternion continuity is enforced. |
| `src/engine/retarget/RetargetValidation.ts` | Per-cell gates: required bones, no NaN, duration, limb lengths, no flips, foot contact/sinking, effector directions, and skinned deformation at the source's peak-motion time. |
| `src/engine/retarget/UniversalIntakeGate.ts` | #17 intake verdicts: `REJECTED_UNMAPPABLE` and `REJECTED_RETARGET_VALIDATION`. |
| `src/engine/retarget/RuntimeUniversalRetarget.ts` | Runtime hook plus flag. |
| `src/engine/retarget/CanonicalRest.generated.ts` | Canonical rest table (`scripts/retarget/gen-canonical-rest.mjs`). It lets the runtime skip roster models without fetching anything. |
| `scripts/retarget-matrix.mjs` | `npm run retarget:matrix [-- --quick]`. Runs every clip × every skinned GLB (plus staged CC0 targets) and writes `docs/retarget-matrix.{json,md}`. |
| `scripts/retarget/render-proof.mjs` | `npm run retarget:proof`. Software-rasterised renders of contrasting rigs playing the same CMU punch and kick, written to `proof/`. |

## Edits to existing files (minimal, additive)

- `UniversalAnimationPipeline.ts` (#17):
  - One import.
  - Two new verdict literals.
  - One optional `sourceSkeleton` input.
  - One early return when it is supplied. Without `sourceSkeleton`, behaviour is byte-identical.
- `CharacterPipeline.ts`: one guarded call after baked binding. It is a no-op for canonical skeletons and when the flag is `off`. Errors are swallowed and the legacy binding is kept.
- `animation_bridge/retarget.ts`: universal results replace legacy ones only when `userData.universalRetarget === true`.
- `package.json`: two new scripts. The `test` line is not edited; the TS suite runs through `scripts/retarget/universal-retarget.test.mjs`.

## Flag

`localStorage['bf.universalRetarget']` or `VITE_UNIVERSAL_RETARGET` takes `auto` (the default) or `off` (the kill switch).

- In `auto` mode, only non-canonical rigs are retargeted.
- Unmappable clips keep their legacy binding, are tagged `userData.universalRetarget = 'UNMAPPABLE'`, and log a warning. Nothing fails silently.

## Relation to PR #20 (grok/per-fighter-movesets)

This work generalises two pieces of #20 without duplicating them. It merges cleanly in either order.

- **49e54cb** fixed two bugs: the #17 pipeline ignored the source rest pose beyond 17 bones, and it confused the shoulder with the upper arm. Here, rest-pose handling applies to every mapped joint of any rig, including variable spines, necks and fingers. Clavicle and upper arm are distinct slots, and the rest-direction alignment `A` is per joint.
- **`tools/anim-intake/cc0_unarmed_intake.ts`** carries explicit per-rig maps (UAL1, UAL2, KayKit, Mesh2Motion, CMU) and a mirrored rest alignment for Bannon, whose bind faces +X with its left side at +Z.
  - Here, the maps are *detected*. A parity test asserts that detection reproduces #20's maps slot-for-slot.
  - Mirroring is handled generally by measuring each rig's handedness and conjugating with a reflection, so any mirrored rig works, not only Bannon. A mirrored fixture test covers this.
- Neither PR edits the other's files. This PR touches only additive lines in `UniversalAnimationPipeline.ts`, far from the lines #20 changes, and does not touch the `package.json` `test` line.

## Licensing

- Staged third-party sources are read from `/workspace/oss-anim-staging` (override with `--staging` or `OSS_ANIM_STAGING`) and are never committed.
- CMU data is CMU-free-use, not CC0. Proof PNGs are derived renders.
- Procedural or synthetic motion stays `TEST_ONLY`, and that label is propagated through retargeting.
