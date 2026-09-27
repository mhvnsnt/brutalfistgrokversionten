# Reference implementations

NOT SHIPPED, AND NOT UNDER `src/` ON PURPOSE — TWICE OVER.

The first attempt put this in `src/vendor/`, which failed two ways at once and
both are worth writing down. `tsc --noEmit` rejected it immediately: the file's
JSDoc uses `@param options.srcPoseMode` with no leading `@param {object} options`,
which is TS8032 under `checkJs`. And `.gitignore` carries `vendor/`, so the commit
that said it had vendored the file had in fact committed nothing — the claim was
false and the repo was unchanged. Reference code that is READ rather than executed
has no business in the typechecked source tree, and a path the repo ignores is not
a place to put something you want kept.

## upf-gti-retargeting.js — `upf-gti/retargeting-threejs`, Apache-2.0

Kept for its **bind-pose handling**, which is the part this project kept getting
wrong by hand. Its README states the governing rule outright:

> Both skeletons must have the same bind pose (same orientation for each mapped
> bone) in order to properly work. Use optional parameters to adjust the bind pose.

and it names the mechanism as an option rather than a special case:

```
BindPoseModes = { DEFAULT: 0, CURRENT: 1 }
  DEFAULT   uses the skeleton's actual bind pose
  CURRENT   uses the skeleton's current pose as the bind pose
```

`CURRENT` is exactly what this repo's own `RestPoseOffset` reinvented for the arm
chain, and exactly what the leg chain needed and never got — retarget against the
pose the character is actually standing in, not the pose the file was exported
in. `precomputeRetargetingQuats` is the general form:

```
left  = invBindTrgWorldParent * invTrgEmbedded * srcEmbedded * bindSrcWorldParent
right = invBindSrcWorld       * invSrcEmbedded * trgEmbedded * bindTrgWorld
```

WHY IT IS NOT WIRED IN AS THE LIVE RETARGETER: this bank is already baked into
target-rig space (`CharacterPipeline` hands the Bannon bank the model's own bind
as BOTH source and target rest, and TPOSE measures 0 degrees against it), so
there is no live source-to-target retarget left to replace. Measuring the leg
problem against this file's model is what established that — see
`tools/model_diag/stance_gap.mjs`. It stays here as the reference the next
re-rig or foreign-bank import is built against, instead of a fourth hand-rolled
correction.
