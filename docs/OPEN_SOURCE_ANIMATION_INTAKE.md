# Open-Source Animation Intake — Bannon / Brutal Fist

Updated: 2026-09-28

## Source priority

### Quaternius Universal Animation Library 1 (UAL1)
- Official source: https://quaternius.com/packs/universalanimationlibrary.html
- Official page currently identifies the pack as March 2025, with 120+ animations, FBX/GLB/Blend formats, and CC0 licensing.
- The pack uses a universal humanoid rig intended for retargeting and covers locomotion in 8 directions plus combat, crawling, swimming, sitting, death and other actions.
- Do not claim a Root Motion export or a later 2026 release from the source page unless a downloaded release artifact and version record verifies it.
- Intake rule: treat any downloaded export variant as its own measured source family; ordinary in-place motion and authored displacement must not be conflated.

### Quaternius Universal Animation Library 2 (UAL2)
- Official source: https://quaternius.com/packs/universalanimationlibrary2.html
- Official page currently identifies the pack as January 2026, with 130+ animations, FBX/GLB/Blend formats, and CC0 licensing.
- It complements UAL1 with melee/armed combos, parkour, farming, fishing, zombie locomotion and other actions; the author specifically advertises 3- and 4-hit combos split into individual hits/recoveries as well as full combo animations.
- Do not infer root-motion availability, directional-step fixes, or other release-specific details unless the exact downloaded artifact/version is recorded and measured.
- Intake rule: do not bulk-promote the library. Every candidate must pass the same source → retarget → bake → measure → runtime certification pipeline as existing motion.

## Current repo status

- UAL1/UAL2 are not currently represented as a dedicated checked-in source-bank manifest in this repository.
- Existing BakedMotionBank selection must remain authoritative; simply adding filenames to the bank is not promotion.
- The repository's current runtime already supports semantic resolution, fighter-owned clip preferences, retargeting, animation integrity checks, and measured clip ownership.
- A clip is not PASS merely because it loads, animates a skeleton, or has a plausible filename.

## Required intake pipeline

1. Record exact source pack/version and license.
2. Preserve source naming and rig metadata.
3. Import Standard and Root Motion variants as separate source families.
4. Normalize/retarget through the existing character pipeline.
5. Measure bone travel, facing, uprightness, root travel, duration and semantic suitability.
6. Reject team/multi-person captures from single-fighter slots.
7. Reject reaction/victim clips from attacker slots.
8. Keep airborne, rotating, back-turned and receiver-role clips semantically separate.
9. Bake only measured candidates.
10. Runtime-test on at least one real Bannon fighter and one contrasting fighter.
11. Promote only after PWA/browser evidence confirms the actual move, contact, timing and landing/recovery behavior.

## Immediate integration targets

- Locomotion: idle, forward/back walk, crouch/crouch-walk, jump, landing.
- Basic combat: LP/RP/LK/RK equivalents, low attacks, high attacks, launch/rising attacks.
- Airborne: jump punch, jump kick, landing/recovery.
- Combat utility: guard, hit reactions, knockdown, wakeup.
- Grapple: attacker and receiver pairs must be retained as separate roles.
- Specials: spinning/rotating/root-motion moves need dedicated handling.
- Character identity: a shared source library may supply candidates, but each fighter's canonical moveset must select its own validated clips.

## Non-negotiable status law

UNKNOWN remains UNKNOWN until measured/runtime evidence exists. Static code/tests can establish routing and invariants; they cannot certify that a 3D clip visually reads correctly in the PWA.

## External reference

A public GitHub project demonstrates a no-Blender Quaternius UAL1+UAL2 GLB-combination workflow. It is reference material only; it is not automatically trusted or imported into this project. The Bannon pipeline still owns validation and promotion.


## Additional CC0 source candidate — KayKit Character Animations

- Official source: https://kaylousberg.itch.io/kaykit-character-animations
- License: CC0; the author states free for personal and commercial use with no attribution required.
- The pack includes humanoid locomotion, melee combat, blocking, jumping, dodging/dashes and other animation categories, with GLTF available.
- This is a candidate source bank, not yet promoted into Bannon runtime. It is particularly useful for filling current gaps in punch/kick variety, directional movement, dodge/step, and combat utility.
- Do not commit raw third-party binaries until the intake job records the exact downloaded version/hash and the retarget/measurement pass has produced usable clip evidence.

## Current architecture change — fighter individuality

- The roster now exposes directional move slots in addition to the generic six-button semantic slots.
- Directional roster choices are resolved to the catalog's actual frame data, so a character-owned move changes gameplay properties as well as the clip.
- The runtime keeps semantic combat state separate from the selected authored clip; this preserves hitbox/root-motion classification while allowing fighter-specific moves.
- A fighter's authored extraMove1/extraMove2, counter, combo and core kicks are now eligible to populate directional branches instead of every directional input falling through to the same generic jab/cross/kick.
- This is a first expansion layer, not the final Tekken-scale moveset. The next intake target is a larger per-character move graph with validated standing, directional, crouching, launcher, airborne, sidestep, and grapple branches.
