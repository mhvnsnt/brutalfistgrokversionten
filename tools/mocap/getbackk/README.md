# Getbackk two-body capture (GETBACKK + GETBACKK__RECV)

Reproducible record of how `public/motion/GETBACKK.json` and `GETBACKK__RECV.json` were made.
These scripts are capture tooling, not game code; they are not run by the build or tests.

## Source
- `GETBACKK_src.mp4`, owner-supplied reference video (sha256 `185e4d2a…0112`), 576x1024, 30 fps, 11.5 s.
  The original footage is a third-party TikTok, credit @mackeymcqui. License class:
  **third-party clip, owner-approved for use 2026-10-07**. The footage is not committed anywhere.
- Prepared with ffmpeg: trimmed to 0.0–7.0 s (TikTok outro removed), comment overlay and watermark masked:
  `ffmpeg -i GETBACKK_src.mp4 -t 7.0 -an -vf "delogo=x=47:y=127:w=290:h=100,delogo=x=6:y=465:w=132:h=94,fps=30" -crf 14 GETBACKK.mp4`

## Why not the stock `video_to_clip.py --two` front end
It was run first (Bannon `tools/mocap/video_to_clip.py GETBACKK.mp4 --name GETBACKK --two`). YOLOX-tiny merged
the two bodies into ONE box from about frame 22 to frame 180 (the whole carry and toss), so the receiver was tracked in
57/189 frames, and both tracks swapped identity (verify sheet: the "attacker" track starts on the receiver). That
output was not banked.

## Pipeline used (run in this order from a dir holding `GETBACKK.mp4`; Python 3.12 with
`mediapipe opencv-python-headless rtmlib onnxruntime numpy scipy pygltflib`)
1. `rtmo_rot.py` — RTMO-l (bottom-up multi-person 2D, rtmlib, Apache-2.0) on every frame, plus 90°/270° rotated copies
   for the inverted/horizontal receiver.
2. `track2.py` — merges duplicates, tracks the two identities with constant-velocity matching.
3. `lift3d.py` — fixes the ONE identity swap found by eye on the tracking sheet (`SWAP=121`, where the attacker turns his
   back for the corkscrew), then runs RTMW3D-x (top-down 3D whole body) per body box and measures its 2D agreement with
   the RTMO track. `lift_rot.py` retries disagreeing frames on torso-aligned rotated crops.
4. `recon.py` — 3D lift: bone-length-constrained depth (Taylor 2000, weak perspective) from the RTMO 2D, depth SIGN per
   bone by Viterbi (temporal smoothness + RTMW3D depth ordering where RTMW3D agrees with the 2D track, + a weak upright
   prior for torso/legs), face-forward rule for the head, left/right label continuity, and world levelling for the
   camera's downward pitch (measured from the standing attacker). A frame counts as tracked only with >=11 confident
   keypoints and confident shoulders and hips.
5. `build.py 0 209 84 <out>` — linear interpolation of untracked gaps of **at most 6 frames** (fails on longer gaps), then
   the UNCHANGED Bannon `video_to_clip.build_clip` (same retarget, 5-frame smoothing), 84 keys. Pose targets get one
   global scale per clip instead of the per-key head-height scale, which pumped body size whenever the head tucked.
6. `validate.py <out> 0`, `rig_sheet.py` — checks and the contact sheet on BANNON_rigged.glb.

## Result (window 0.0–6.97 s, both halves on one clock)
- Attacker: 207/210 frames tracked; interpolated 25–26, 31.
- Receiver: 191/210 frames tracked; interpolated 129, 157–158, 160–163, 167, 175–176, 179–180, 183, 188, 196–197,
  204, 206–207 (all ≤ 6 frames). The impact (157–167) and the post-impact roll are the least certain part.
