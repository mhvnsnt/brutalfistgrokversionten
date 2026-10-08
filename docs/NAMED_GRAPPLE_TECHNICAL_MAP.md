# Named grapple technical map

Updated 2026-09-28 after PR20/PR23 reconciliation.

| Canon name | Technical move definition | Current capture state | What footage closes the gap |
|---|---|---|---|
| Flying Headbutt | Top-rope dive, landing headfirst onto a prone opponent | REAL_PAIR / exact | Re-shoot optional because existing pair coverage is low |
| Deadlift German | Rear waistlock, deadlift from standstill, bridging German suplex | REAL_PAIR / stand-in | Film exact rear-waistlock version |
| Chainsnatcher | Jumping double-knee to the opponent's back / jumping backstabber | REAL_PAIR / stand-in; current pair is a knee-bash throw | Film the actual jumping double-knee backstabber with both bodies |
| Getbackk | Fireman's carry into a spinning facebuster, F-5-style; canon wording: fireman's carry tornado slam | DELIVERER_ONLY; F5 attacker exists | Film both attacker + receiver; use --two |
| Hall Street Justice | Street-fight combo ending in a knee | DELIVERER_ONLY; current ILLEGAL_KNEE is only the finishing knee stand-in | Film the complete combo and receiver, not just the knee |
| Titan Fall | Throat grab into a chokeslam | RECEIVER_ONLY; CHOKESLAM victim half exists | Film attacker + receiver chokeslam |
| Cody Buster | UNKNOWN. The current canon/catalog has no technical definition beyond “sober-style buster” | MISSING_CLIP | Do not guess; define/film the actual move first |

## Naming rule

The display name is not treated as the technical move definition. A similarly named clip is explicitly marked stand-in and must not be promoted to exact without owner confirmation or a matching two-body capture.

## Footage intake

For a new two-person capture in mhvnsnt/Bannon, use:

    python3 tools/mocap/video_to_clip.py <video.mp4> --name <KEY> --two

The tool writes the attacker clip and <KEY>__RECV receiver clip from the same take. Trim with --start/--end when needed. After capture, the versionten intake/bake path can import the pair.

Recommended owner keys:
- GETBACKK
- CHAIN_SNATCHER (or the final canonical spelling once confirmed)

Do not upload licensed/reference-only footage as if it were source material. The source video is provenance; the generated JSON pair is what gets imported into the game.
