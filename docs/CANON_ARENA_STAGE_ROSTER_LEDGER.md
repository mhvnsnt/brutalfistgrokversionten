# Brutal Fist — Canon, Arena, Stage & Roster Production Ledger

Updated: 2026-09-28

## Verified repository facts

- Current game baseline is a browser/PWA fighting-game runtime.
- Current shipped playable roster evidence includes Bannon and Kobra.
- Animation state infrastructure includes attacks, reactions, knockdown/wakeup, grapple/throw states, and paired attacker/receiver preview support.
- Grapple was most recently promoted to a real one-shot animation state with its own crossfade duration on main (commit 5b43bdb8c4ec0909f0adc0f895b341f58bb494fb).
- Animation intake is being standardized so new packs are not attached through one-off code paths: canonical bone aliases -> bind/rest correction -> explicit rest fills -> finite/frozen/body-count gates -> semantic/geometry/runtime certification.
- Quaternius Universal Animation Library 1 and 2 are documented external CC0 sources for future ingestion. Their raw assets are not claimed to be present in the repository until verified.

## Arena / stage specifications

At the time of this ledger pass, the accessible GitHub API search did **not** return authoritative arena/stage names or dimensions from this repository. Therefore no arena name, size, lighting setup, collision dimensions, or stage-specific gameplay rule is promoted to canon here.

**Stage data to capture when source material is found:**
- canonical stage name and alias
- source/book/chapter or owner-authored provenance
- floor dimensions and playable bounds
- wall/ring boundaries and wall-splat rules
- camera framing and arena camera limits
- floor height / fighter origin
- lighting, palette, fog and PS1 rendering constraints
- hazards, destructibles, interactables
- music/audio provenance
- spawn points and round-reset points
- navigation/collision geometry
- screenshot/reference evidence
- status: CANON / DOCUMENTED / UNKNOWN

### Canon stages located (2026-09 pass)

These entries come from owner canon in `mhvnsnt/Bannon` @ d575dd67 and the owner's stage list. All 8 are playable **BLOCKOUT** geometry (graybox, not final art); see `docs/stage_architecture.md` §9.

| Stage id | Canon location | Source | Status |
|---|---|---|---|
| banyan_tree | The Great Banyan Tree, Sector 7: 60 × 60 m open space; the Banyan Ring inside the roots, lit by bioluminescent fungi | Bannon canon/05b_book5_level99_part2.md, canon/06_book6_kayfabe_is_real.md | CANON (dims) / BLOCKOUT |
| black_swamp | Black Swamp, Sector 7 (the Island) | owner stage list; Sector 7 per canon/05b, canon/06 | DOCUMENTED / BLOCKOUT |
| club_onyx | Club Onyx, Miami (stripper-pole club, "The Club God") | Bannon canon/06 | CANON / BLOCKOUT |
| jpcw_arena | JPCW Arena, Tokyo | Bannon canon/00_cast_and_world.md | CANON / BLOCKOUT |
| kennedy_debate | Presidential Debate, Kennedy Center | owner stage list (Book 6 election arc) | DOCUMENTED / BLOCKOUT |
| void_ring | Void Ring | owner stage list | DOCUMENTED / BLOCKOUT |
| aztec_temple | Aztec Temple | owner stage list | DOCUMENTED / BLOCKOUT |
| parking_lot | Parking Lot (corporate district parking structure) | owner stage list; StoryModeScreen location | DOCUMENTED / BLOCKOUT |

Dimensions other than the Banyan's 60 m are engine choices (boundaryX/Z in StageConfig), not canon.

## Story / canon

This repo pass did not expose authoritative book/story text through the available repository search endpoint. Do not invent missing lore.

A number of canon characters are known to exist outside the currently modeled roster according to the production direction supplied by the owner. Those characters are now tracked as **MODEL NEEDED / CANON SOURCE NOT YET RETRIEVED** rather than omitted from the roster or given invented biographies.

For every future canon character:
1. preserve the exact source name/spelling;
2. capture book/source provenance;
3. capture biography, fighting style, skills, affiliations and story role verbatim/paraphrased from the source;
4. mark whether a GLB/model exists;
5. mark skeleton/animation compatibility;
6. create a moveset identity profile;
7. never substitute a generic fighter identity;
8. keep unknown fields explicitly UNKNOWN.

## Expanded roster production fields

Character | Model | Skeleton | Animations | Moveset | Bio | Story role | Provenance | Status

Bannon | existing project asset | measured/canonical pipeline | active | active | existing project canon | existing | owner/project | IN PRODUCTION
Kobra | existing project asset | measured/canonical pipeline | active | active | existing project canon | existing | owner/project | IN PRODUCTION
Additional book canon characters | MODEL NEEDED where absent | TBD | TBD | TBD | SOURCE NEEDED | SOURCE NEEDED | SOURCE NEEDED | MODEL NEEDED / UNKNOWN

## Universal animation production law

Every new animation, regardless of source bone count, naming convention, rest pose, body count, receiver role, back-turn state, root rotation or special movement, enters the universal intake pipeline.

Special cases are represented as metadata/roles rather than hacked into generic strike playback:
- receiver/reaction half
- grapple attacker
- grapple receiver
- back-turned attack/reaction
- rotating/root-motion attack (e.g. Hurricane Kick)
- airborne attack
- knockdown/getup
- locomotion/stance
- multi-performer source (rejected for solo intake)

**UNKNOWN is never PASS.**

## Hurricane Kick recovery

HURRICANE_KICK is historically present in the motion bank but was frozen out of canonical kick routing after measured geometry showed unsafe facing/foot reach. The production requirement is to recover/re-bake it through the universal intake path with explicit rotation/root-motion metadata, then runtime-certify it before promotion. Do not silently replace it and call the Hurricane Kick fixed.

## Open-source intake queue

- Quaternius Universal Animation Library 1 (CC0): ingest, map canonical humanoid aliases, bake against Bannon rigs, certify locomotion/combat/reaction subsets.
- Quaternius Universal Animation Library 2 (CC0): same pipeline; preserve root-motion vs in-place distinction.
- Other open humanoid animation sources: only ingest when license/provenance is explicit and compatible.
- Schwarzerblitz engine architecture: use code/architecture where license permits; do not copy its separately restricted bundled game assets.

## Production status vocabulary

PASS = measured and runtime-certified.
STATIC_SAFE = static gates passed, runtime pending.
RUNTIME_PENDING = loaded but not visually certified.
PARTIAL = retargeted with explicit rest fills; not a visual pass.
BROKEN = measured/runtime failure.
UNKNOWN = insufficient evidence; never PASS.
MODEL_NEEDED = canon character has no production model yet.

## Next production passes

1. Complete CI/PWA run on the universal intake branch.
2. Merge only after typecheck/tests/build/real Chromium playtest are green.
3. Build a Move Certification Lab covering every semantic family.
4. Restore Hurricane Kick as a dedicated rotating/root-motion special, not a generic kick alias.
5. Add paired grapple/receiver certification and contact measurements.
6. Bulk-ingest CC0 Quaternius UAL1/UAL2 through the universal intake path.
7. Expand the roster ledger as each book character's source material is located.
8. Capture exact arena/stage canon from owner-provided books/source files when available.
