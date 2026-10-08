# Airborne / Dive Attack System

Updated 2026-09-28.

## Rule
Brutal Fist's Up input already creates a jump. Diving moves use that jump system rather than a separate dive button.

- Up + attack: neutral jump attack.
- Up + Forward + attack: forward airborne attack.
- Up + Back + attack: back-direction airborne attack.
- Attack pressed later while still airborne: valid; it does not have to happen on the jump frame.
- High/climbable stage position + attack while falling: stage-origin dive.
- Kick inputs can use the same airborne routing; named elbow drops, moonsaults, flying headbutts, and similar moves require authored bindings.

## Stage relationship
Stage metadata should expose climbable/high launch points as traversal geometry. Those points become sources for airborne attacks rather than a separate combat system.

## Animation law
NEUTRAL_DIVE, FORWARD_DIVE, and BACK_DIVE are routing categories, not animation claims. A named move becomes exact only when an authored clip is present, validated, and bound to that fighter.

## Capture relationship
Getbackk and Chainsnatcher remain separate two-body capture jobs using the existing video_to_clip.py --two path.