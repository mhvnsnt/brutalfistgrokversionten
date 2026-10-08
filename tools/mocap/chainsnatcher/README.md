# Chainsnatcher two-body capture (CHAINSNATCHER + CHAINSNATCHER__RECV)

Reproducible record of how `public/motion/CHAINSNATCHER.json` and `CHAINSNATCHER__RECV.json` were made.
These scripts are capture tooling, not game code; they are not run by the build or tests.

## Source, approval and credit
- `CHAINSNATCHER_src.mp4`, owner-supplied 2026-10-07 (sha256 `cc9ad434…b040`), 576x1024 portrait, 30 fps, 234 frames
  (7.8 s): one handheld, low-angle shot of a live indie match.
- Original footage: third-party TikTok, **credit @thatjtawesome3**. License class:
  **third-party clip, owner-approved for use 2026-10-07** (the owner approved shipping moves captured from third-party
  internet clips on 2026-10-07). The footage is not committed anywhere.
- Watermark masked (it moves at frame 150):
  `ffmpeg -i CHAINSNATCHER_src.mp4 -an -vf "delogo=x=4:y=462:w=212:h=78:enable='lt(n,150)',delogo=x=378:y=785:w=192:h=80:enable='gte(n,150)',fps=30" -crf 14 CHAINSNATCHER.mp4`

## What the take shows
f0-30 receiver bent over; f45-96 clinch; f96-122 attacker BEHIND him, arms over his shoulders; f122-136 jump, knees
tucked; f140-149 landing, receiver driven back onto the knees; f149-158 receiver down; f159+ receiver rolls toward the
camera, cropped (7-frame tracking gap f159-165). The referee is in shot the whole time and the crowd behind the ropes.

## Pipeline (run in this order in a dir holding `CHAINSNATCHER.mp4`; same Python env as tools/mocap/getbackk)
1. `rtmo_rot.py` — RTMO-l 2D (rtmlib, Apache-2.0) on every frame plus 90/270-degree rotated copies; `dets_sheet.py`
   merges duplicate detections (`dedup.pkl`) and draws the candidates.
2. `track_cs.py SEED A,R,F LO HI TH AEND THA` (arguments documented at the top of the script; AEND = 134) — THREE-identity tracker: attacker, receiver and the REFEREE. The ref is
   tracked only so he cannot steal an identity, then dropped. No attacker past f134 (`AEND`): from the jump on he is
   behind and under the receiver and nothing separates him (checked by eye and with RTMW3D on hand-placed boxes,
   `probe_atk.py`). `draw_ids.py` draws the tracking sheet. The A and R identities (referee removed) are saved as `track2.pkl` for step 3.
3. `lift3d.py`, `lift_rot.py` — RTMW3D-x depth ordering per body (as Getbackk).
4. `CAL=96,140 UPV=-0.034,-0.982,-0.172 recon.py` — the Getbackk 3D lift with: bone lengths from the calibration window,
   a per-frame weak-perspective scale (the receiver falls toward the moving camera; the shoulder and hip spans set the
   floor when the limbs are foreshortened), toe outlier drop/cap, and a FACING prior (the 2D nose says which way a
   profile body faces).
5. `lr_swap.py 96 158` — left/right label consistency for frames isolated between two gaps (applied once: receiver f149,
   which agreed with neither tracked neighbour until its labels were exchanged; `lr_swap.json`).
6. `solve.py 96 158` — the FLAGGED CONSTRAINED SOLVE for the attacker, **f135-158 (24 frames), NOT tracked**: each bone
   keeps his own measured length and is slerped (smoothstep) from his last tracked pose (f134) to the canon end pose —
   supine, knees raised, feet planted, hands up holding — reached at the landing frame f142, measured from the receiver
   (first frame his shoulders drop > 0.25 torso in one frame), held after. The supine spine is laid parallel to the
   receiver's measured body axis on the mat (canon: the receiver lies back across his knees). `solve_report.json`.
7. `build_cs.py 96 158 26 <out>` — window f96-158 (3.20-5.27 s), interpolation of gaps of **at most 6 frames** (fails on
   longer), one common yaw per frame removed from BOTH bodies (the handheld camera orbits ~52 degrees: their measured
   facings turn together from -114 to -62 deg; held after f134), the UNCHANGED Bannon `video_to_clip.build_clip` for key
   times / 5-frame smoothing / `pose{}`, then `engine_retarget.py` for `bones{}` (below).
8. `bake_tmp.sh` — bakes ONLY these two clips through the repo's real bake (a source-filtered copy of
   `scripts/bake-fighter-animations.mjs`, not committed: it adds `BAKE_ONLY` / `BAKE_EXTRA` to the source list).
   `validate_cs.py <baked dir>` writes `validation.json`; `baked_sheet.py` draws the proof sheet from the BAKED clips.

## Why engine_retarget.py (bones{} convention)
The versionten bake reads a Bannon-bank clip's `bones{}` Euler as each bone's ABSOLUTE local rotation on
`public/models/BANNON_rigged.glb` (`sourceRest = targetRest = bind`, so q = q_src). `build_clip` writes rest-relative
swings in CAMERA axes for a rig facing +z with its left on +x. BANNON_rigged's toes point +x and its Left bones sit on +z,
and its limbs have non-identity binds. Measured with a synthetic 40-degree forward bend through the real bake: build_clip's
bones came out as a sideways lean with T-pose arms. `engine_retarget.py` solves the absolute local rotations on the
BANNON_rigged bind from the same joints build_clip keys on: hips and chest get a full frame (yaw and twist kept), arms
and legs swing onto the measured segment with the twist chosen so the elbow / knee bends about the bake's hinge axis
(local Z; SkeletalLimits.HINGE_JOINTS) inside its range; clavicles, neck, head, hands and feet keep the bind.
**Note:** the other build_clip pairs in the bank (the Bannon two-body set and GETBACKK) were baked from build_clip's own
bones and are subject to the mismatch described above.

## Result (window f96-158, 3.20-5.27 s, 63 frames -> 26 keys, 2.067 s, both halves on one clock)
- Receiver: 53/63 frames tracked; interpolated 113-114 (2), 145-148 (4), 150-152 (3), 157 (1).
- Attacker: 39/63 tracked (f96-134); **f135-158 solved (24 frames, flagged in provenance: `constrainedSolve`,
  `synthetic: 'partial'`)**.
- Validation (`validation.json`): no NaN (clips, baked, recon); tracked bone-length CV max 0.025 attacker / 0.088 receiver;
  attacker behind the receiver in 30/30 grab frames (f96-125, median 1.61 receiver torsos behind, both facing the same
  way 29/30); 2D knee-to-receiver-upper-back distance closes from 1.97 to 0.73 attacker torsos by his last tracked
  frame (the impact itself is inside the occlusion, so no 3D contact distance is claimed); attacker ends supine (spine
  0 deg, front up 1.0, knees 0.65 above the pelvis in recon units) under a receiver whose measured chest is lifted
  0.21-0.26 above his pelvis once down; receiver back-down at impact (f141-143 front up to 0.70) but on his SIDE by
  f153-158 (front to the camera; the roll starting) and f144 reads front-down; shared timeline (same 26 key times,
  ratio 1.0).
- Not captured: the receiver's roll after f158 (cropped). In game, the bake neutralises each clip's starting hip yaw
  separately and the throw system places the two fighters facing each other, so the from-behind set-up is not
  reproduced by placement.
