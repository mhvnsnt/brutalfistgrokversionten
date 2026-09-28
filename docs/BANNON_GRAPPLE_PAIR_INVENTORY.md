# Bannon grapple-pair inventory and named-move bindings

Source: `mhvnsnt/Bannon` @ `d575dd6766c9585354f70caad23cdd3e37e924af`, assets/moves/clips.

## Inventory

- 973 clip files. 244 are base clips; the rest are `_DELAYED/_HARD/_KNEELING/_MIRROR/_SITOUT/_SLOW/_SNAP` variants made by `tools/moves/gen_move_variants.cjs`. Those variants are synthetic time-warps and **TEST_ONLY**.
- **14 deliverer + `__RECV` pairs.** Each is a two-body owner video capture from `tools/mocap/video_to_clip.py --two` (MediaPipe, 14 mixamorig bones, 28 keys). Provenance commits: 6adb55108c, de17ebc1d7, 2f84b6d530.
  - 2 are locomotion, not grapples (CIPHER_FERAL_RUN, CIPHER_FERAL_RUN_2), which leaves **12 grapple/aerial pairs**.
  - Versionten already had 4: TZ_SCOOP_SLAM, TZ_TILT_WHIRL_SLAM, JUNGLE_JUICE, TIGER_FEINT_KICK.
  - **8 imported in this PR** by `scripts/intake-bannon-grapple-pairs.mjs`: FLYING_HEADBUTT, PUMPHANDLE_GERMAN_DOUBLE, BACKDROP_360_FACE, FALCON_ARROW_STANDING, FALCON_ARROW_GROUNDED, SOMERSAULT_TORNADO_DDT, STALLING_SUPLEX_STEPS, TAG_POWERBOMB_GERMAN.
- Also imported as deliverer-only captures: F5 (commit 94f78a2450, single-body era) and DIVING_HEADBUTT_GABLE (listed as a pair in BANNON_v150.html, but its `__RECV` was never banked).
- The FBX grapples (GERMANSUPLEX, CHOKESLAM, SUPLEX, DDT, NECKBREAKER, …) each carry a single skeleton, so they are one-body clips. The game uses them as victim halves.

## Named moves (`src/engine/combat/NamedGrappleBindings.ts`)

| Move | Status | Deliverer | Receiver | Fidelity |
|---|---|---|---|---|
| Flying Headbutt | REAL_PAIR | FLYING_HEADBUTT | FLYING_HEADBUTT__RECV | exact (coverage 0.37) |
| Deadlift German | REAL_PAIR | PUMPHANDLE_GERMAN_DOUBLE | __RECV | stand-in (pumphandle grip) |
| Chainsnatcher | REAL_PAIR | KNEETHROW (Schwarzerblitz) | KNEETHROWREACTION | stand-in (knee-bash throw); exact receiver BACKBREAKER_REACTION has no deliverer |
| Getbackk | DELIVERER_ONLY | F5 | MISSING_CLIP | stand-in |
| Hall Street Justice | DELIVERER_ONLY | ILLEGAL_KNEE (Mixamo) | MISSING_CLIP | stand-in |
| Titan Fall | RECEIVER_ONLY | MISSING_CLIP | CHOKESLAM | exact |
| Cody Buster | MISSING_CLIP | — | — | no technical definition in canon |

## Animation creator status

- `tools/mocap/video_to_clip.py` (Bannon) is the real two-body creator: MediaPipe Pose, `--two`, video → `<KEY>.json` + `<KEY>__RECV.json`. **It was not run.** The owner's source videos are not in any repo, so no missing half can be regenerated. To close a gap, film the move and run `python tools/mocap/video_to_clip.py <video.mp4> <KEY> --two`, then re-run the intake and bake.
- `bake_clips.cjs` (FBX → clip) and `ingest.cjs` work on FBX/BVH that already exist.
- `text_to_clip.py` (MoMask/MDM) would produce generated motion, which is TEST_ONLY and never bound.

## Caveats

- `src/generated/BannonMotionBank.generated.ts` is not regenerated. It is keyed off Bannon's own index.json, which lacks these clips. At runtime the baked bank (`public/motion/baked`) is what GrapplePairing reads.
- Only the 18 new baked entries were merged. The local bake lacks the vendor Quaternius packs, so a full re-bake would have dropped them.
