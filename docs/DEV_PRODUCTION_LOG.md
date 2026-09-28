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
