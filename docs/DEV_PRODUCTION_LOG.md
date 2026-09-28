# Dev Production Log — 2026-09-28

- User requested continued combat/animation work, aggressive open-source intake, and a universal pipeline so new animations work across differently rigged models.
- Implemented universal animation intake and model-aware recovery on PR #17: canonical bone aliases, source-rest to target-bind conversion, explicit rest tracks for missing joints, multi-body rejection, non-finite/frozen gates, receiver metadata, and recovery against the actual target fighter rig.
- Typecheck, tests, imported-data audit, Next compatibility build, production build and Rocket production build passed on CI before the real Chromium playtest stage.
- Real PWA playtest reached the actual browser combat stage; CI was still running that playtest at the time of this log update, so runtime certification is not claimed yet.
- Grapple animation state is now a true one-shot with dedicated crossfade timing on main (5b43bdb8c4ec0909f0adc0f895b341f58bb494fb).
- Added the canon/arena/stage/roster ledger. It records Bannon and Kobra as current project fighters and reserves explicit MODEL NEEDED slots for additional book-canon characters rather than inventing missing models or lore.
- Arena/stage names and exact specifications were not promoted to canon in this pass because the accessible GitHub search did not expose authoritative source data. Unknown remains UNKNOWN.
- Hurricane Kick is tracked for dedicated recovery: it must be reintroduced as a rotating/root-motion special and runtime-certified, not silently mapped to a normal kick.
- Open-source queue explicitly includes Quaternius Universal Animation Library 1 and 2, with root-motion/in-place distinctions preserved and license/provenance gates.


## Continuation pass — 2026-09-28 13:14 CDT

- Merged PR #18 (611332e): combat animation startup is now arena-first. Required combat owners and explicit paired receivers load before the rest of the baked bank; remaining clips hydrate in the background. This directly addresses the measured real-playtest startup bottleneck where the arena was reached with 0 rigs at roughly 2.3 fps while the full baked corpus was loading.
- Merged PR #19 (924fdd4): canon/arena/stage/roster ledger and production rules are now on main, including MODEL_NEEDED placeholders for book-canon characters and UNKNOWN gates for unverified stage facts.
- Production law remains: static gates can reject bad work, but they cannot promote runtime animation to PASS. Runtime PWA evidence is still required.
- Next repair lane: rerun the real Chromium PWA gate against the arena-first loader, isolate the remaining runtime failure from its captured evidence, then restore Hurricane Kick as an actual rotating/root-motion special and certify it in-browser.
- Grapples remain two-body events: attacker and receiver roles must be paired; receiver reactions cannot fall back to unrelated solo attack clips.
- Open-source animation intake remains bulk-oriented but fail-closed: source -> retarget -> bake -> measure -> runtime PWA test -> promotion. No unverified clip is promoted merely because its filename/reach resembles an attack.


## Combat startup correction — 2026-09-28

- Found a concrete reason the first arena-first loader could still be effectively a full-bank preload: the 455-entry manifest has only 6 explicit `owns` clips, while semantic labels cover 444 entries, largely because 249 clips are labelled `idle`. Treating every required semantic as core therefore selected 444 clips.
- Corrected `selectCoreBakedNames` so startup loads the 6 authoritative owners plus at most one measured candidate per required semantic, with non-UAL/project material preferred and ordinary grounded/full-body clips preferred. Grapple owners additionally pull their paired receiver clips.
- Static manifest replay now selects **20 core clips out of 455**, instead of 444, while preserving attacker/receiver pairing. The remaining bank stays available for background hydration.
- This is a startup/performance correction only; it does not certify any animation visually. Runtime PWA evidence remains mandatory.
