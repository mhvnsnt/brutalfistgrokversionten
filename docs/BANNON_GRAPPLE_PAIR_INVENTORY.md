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
| Chainsnatcher | REAL_PAIR | CHAINSNATCHER | CHAINSNATCHER__RECV | exact (third-party clip, owner-approved; credit @thatjtawesome3; receiver 53/63 tracked, attacker 39/63 tracked + f135-158 flagged constrained solve). Fallback only: KNEETHROW / KNEETHROWREACTION. BACKBREAKER_REACTION retired from the binding (kept in the bank) |
| Getbackk | REAL_PAIR | GETBACKK | GETBACKK__RECV | exact (third-party clip, owner-approved; credit @mackeymcqui; coverage 0.99 / 0.91) |
| Hall Street Justice | DELIVERER_ONLY | ILLEGAL_KNEE (Mixamo) | MISSING_CLIP | stand-in |
| Titan Fall | RECEIVER_ONLY | MISSING_CLIP | CHOKESLAM | exact |
| Cody Buster | MISSING_CLIP | — | — | no technical definition in canon |

## Getbackk owner capture (2026-10-04)

- Source: owner-supplied reference video `GETBACKK_src.mp4`; the original footage is a third-party TikTok, credit @mackeymcqui. License class **third-party clip, owner-approved for use 2026-10-07** (the owner approved shipping moves captured from third-party internet clips). Footage is not committed.
- Window 0.0–6.97 s (outro trimmed), 84 keys, both halves on one clock (ratio 1.0): receiver jumps in, fireman's carry, ~180° corkscrew toss to the attacker's left, impact ~5.3 s, both down.
- Tracking: attacker 207/210 frames, receiver 191/210. Every untracked gap is ≤ 6 frames and linearly interpolated (attacker 3 frames, receiver 19 frames, listed per gap in `public/motion/index.json` provenance). The impact and the roll after it are the least certain part.
- Made with Bannon's `video_to_clip.build_clip` (unchanged retarget) behind an RTMO + RTMW3D two-body front end: the stock `--two` front end merged both bodies into one detection for the whole carry. Full method: `tools/mocap/getbackk/README.md`. Intake: `scripts/intake-bannon-grapple-pairs.mjs` (`OWNER_CAPTURES`).
- F5 stays a deliverer-only capture (`DELIVERER_ONLY_CAPTURES`) and never gets a generic stand-in victim; it is kept as the last fallback alias for Getbackk.

## Chainsnatcher capture (2026-10-07)

- Canon: double-knee jumping backbreaker / backstabber. From behind, the attacker hooks the receiver's shoulders, jumps,
  drives both knees into his upper back and lands supine; the receiver is driven back-down across the knees.
- Source: owner-supplied `CHAINSNATCHER_src.mp4` (sha256 `cc9ad434…b040`), a third-party TikTok, **credit
  @thatjtawesome3**. License class **third-party clip, owner-approved for use 2026-10-07**. Watermark masked, referee and
  crowd rejected (the ref is tracked as a third identity and dropped). Footage is not committed.
- Window f96-158 (3.20-5.27 s), 26 keys, 2.067 s, both halves on one clock.
  - Receiver: 53/63 frames tracked, gaps interpolated 113-114, 145-148, 150-152, 157 (all ≤ 6, logged in provenance).
  - Attacker: 39/63 tracked (f96-134). He is fully hidden behind/under the receiver from the jump on, so **f135-158 is a
    flagged constrained solve** (`constrainedSolve`, `synthetic: 'partial'`): his own bone lengths, slerped to the canon
    supine end pose at the measured landing frame (f142), laid along the receiver's measured body axis.
- Validation: no NaN; tracked bone-length CV ≤ 0.025 / 0.088; attacker behind at the grab 30/30 frames; 2D knee-to-upper-back
  closes 1.97 → 0.73 torsos before the occlusion; attacker supine at the end; receiver back-down at impact (f141-143),
  on his side by f153-158 (the roll toward the camera starts; f159+ is cropped and not captured).
- Proof: `mocap-src/chainsnatcher_proof/chainsnatcher_bannon_rig_sheet.png` (the BAKED clips on BANNON_rigged next to the
  source frames). Method: `tools/mocap/chainsnatcher/README.md`.
- Engine: `chainsnatcher` is a catalog throw. FSM `rightThrow` → `beginNamedGrapple` → CommandThrow with CHAINSNATCHER;
  on commit the opponent plays CHAINSNATCHER__RECV via GrapplePairing. `namedGrappleThrowFor(..., { available })` drops to
  the KNEETHROW pair only when an exact half is missing.

## Known issue: build_clip bones{} vs the versionten bake

The bake (`scripts/bake-fighter-animations.mjs`) reads a Bannon-bank clip's `bones{}` as absolute local rotations on
`BANNON_rigged.glb` (sourceRest = targetRest = bind). Bannon's `video_to_clip.build_clip` writes camera-axis,
rest-relative swings for a rig facing +z. BANNON_rigged faces +x with its Left bones on +z, so a build_clip forward bend
bakes as a sideways lean with T-pose arms. CHAINSNATCHER's `bones{}` are solved for the bake's convention by
`tools/mocap/chainsnatcher/engine_retarget.py`. **GETBACKK and the build_clip pairs already in the bank were not
re-processed and play with this mismatch.** That is a pre-existing issue, not introduced by the Chainsnatcher work.

## Animation creator status

- `tools/mocap/video_to_clip.py` (Bannon) is the real two-body creator: MediaPipe Pose, `--two`, video → `<KEY>.json` + `<KEY>__RECV.json`. **It was not run.** The owner's source videos are not in any repo, so no missing half can be regenerated. To close a gap, film the move and run `python tools/mocap/video_to_clip.py <video.mp4> <KEY> --two`, then re-run the intake and bake.
- `bake_clips.cjs` (FBX → clip) and `ingest.cjs` work on FBX/BVH that already exist.
- `text_to_clip.py` (MoMask/MDM) would produce generated motion, which is TEST_ONLY and never bound.

## Caveats

- `src/generated/BannonMotionBank.generated.ts` is not regenerated. It is keyed off Bannon's own index.json, which lacks these clips. At runtime the baked bank (`public/motion/baked`) is what GrapplePairing reads.
- Only the 18 new baked entries (plus GETBACKK and GETBACKK__RECV) were merged. The local bake lacks the vendor Quaternius packs, so a full re-bake would have dropped them.
