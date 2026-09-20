# Brutal Fist — Game Systems Gap Backlog / Living Master List

> **Purpose:** This is the persistent backlog for agents working on the game. It is a living source of truth for systems, mechanics, content, animation, rigging, presentation, tooling, QA, and research we have identified as missing, incomplete, fragile, or worth adding.
>
> **Maintenance law:** When a user, agent, test, research pass, or code review identifies a new requirement, gap, regression, dependency, or useful system, ADD IT HERE. Do not rely on chat memory. Keep status, priority, and evidence current. Do not delete an item merely because it is not currently scheduled.
>
> **Status vocabulary:** `MISSING`, `PARTIAL`, `IN PROGRESS`, `IMPLEMENTED`, `VERIFIED`, `RESEARCH`.
>
> **Evidence law:** Do not mark a system VERIFIED from code existence alone. Require tests/probes or measured runtime evidence where applicable. UNKNOWN is not PASS.

## 0. Current direction

The target is a real 3D fighting game with the systemic depth of classic/mid-era Tekken, Virtua Fighter, Street Fighter, and Mortal Kombat, while retaining its own terminology, characters, art direction, and mechanics. We should borrow proven *systems principles*, not copy protected game content.

Core architectural principle:

`input -> command matcher -> character move definition -> combat authority -> hit/defense/position state -> animation/rig -> camera/audio/VFX -> presentation`

Animation/rig correctness is gameplay infrastructure, not cosmetic polish.

---

# 1. Highest-priority fighting-game spine

- [ ] **Live command-input integration** — connect imported command/move data to actual runtime combat; do not leave authored move graphs as inert data.
- [ ] **Per-character movelist authority** — each fighter owns a complete move table.
- [ ] **Four distinct limb inputs** — LP/RP/LK/RK must remain distinct through matching, buffering, move resolution, UI, and tests.
- [ ] **Directional normals** — standing, crouching, forward, back, down-forward, down-back and other authored directional attacks.
- [ ] **Input priority rules** — deterministic precedence for simultaneous/special/string/normal commands.
- [ ] **Simultaneous-input buffering** — prevent multi-button commands from collapsing into independent normals.
- [ ] **Input history** — show raw input and resolved command in Training/diagnostic mode.
- [ ] **Frame-accurate command buffer** — configurable per command; tested at boundary conditions.
- [ ] **High/mid/low/throw rules** — authoritative defense matrix.
- [ ] **Startup/active/recovery** — authoritative frame windows for every move.
- [ ] **Hit/block advantage** — explicit on-hit, counter-hit, block and whiff outcomes.
- [ ] **Hitstop** — attack-specific and reaction-specific timing.
- [ ] **Pushback** — hit/block/whiff/throw pushback as move data.
- [ ] **Counter-hit system** — consistent state, damage/reaction/advantage modifiers.
- [ ] **Whiff punishment** — recovery windows must be mechanically exploitable.
- [ ] **Block punishment** — guaranteed punish windows based on frame advantage and range.
- [ ] **Guaranteed-hit logic** — frame advantage + startup + range + state validation.
- [ ] **Cancel windows** — normal/special/stance/movement cancel rules.
- [ ] **String system** — authored multi-hit routes, branch conditions, interruption rules.
- [ ] **Character-specific command moves** — no generic one-size-fits-all move resolution.
- [ ] **Character-specific combo routes** — launcher/juggle/wall/ender data per fighter.

## 2. Movement / 3D positioning

- [ ] **Forward/back walk**
- [ ] **Forward dash**
- [ ] **Backdash**
- [ ] **Run / running state**
- [ ] **Crouch**
- [ ] **Crouch walk**
- [ ] **Jump / landing**
- [ ] **Sidestep / evade**
- [ ] **Sidestep tracking rules**
- [ ] **Linear attack classification**
- [ ] **Half-circular left/right tracking**
- [ ] **Full-circular tracking**
- [ ] **Successful vs failed evade states**
- [ ] **Evade advantage calculation**
- [ ] **Evade cancel rules**
- [ ] **Dash/evade movement chains**
- [ ] **Offensive sidestep/attack movement where appropriate**
- [ ] **Side-switch prevention / arena bounds**
- [ ] **Side-turn state**
- [ ] **Back-turn state**
- [ ] **Turn-around recovery**
- [ ] **Side/back-specific attacks**
- [ ] **Side/back-specific throws**
- [ ] **Character-specific movement styles**
- [ ] **Character-specific special movement / crouch-dash where authored**
- [ ] **Movement collision and wall interaction**
- [ ] **Movement consistency at all frame rates**

## 3. Defense

- [ ] **Standing guard**
- [ ] **Crouch guard**
- [ ] **High/mid/low guard matrix**
- [ ] **Guard pushback**
- [ ] **Guard stun / guard disadvantage**
- [ ] **Guard crush / guard break**
- [ ] **Perfect/just guard (optional)**
- [ ] **Parry system**
- [ ] **Reversal system**
- [ ] **Armor / super armor**
- [ ] **Invulnerability windows**
- [ ] **Fuzzy defense rules**
- [ ] **Throw/strike defensive option interactions**
- [ ] **Defensive resource interactions**
- [ ] **Character-specific defensive moves**

## 4. Throws / grappling

- [ ] **Normal throw**
- [ ] **Command throw**
- [ ] **Directional throws**
- [ ] **Side throws**
- [ ] **Back throws**
- [ ] **Character-specific throws**
- [ ] **Throw startup/active/break window**
- [ ] **Unified throw transaction**
- [ ] **Throw-break window for every throw family**
- [ ] **Throw-break input matching**
- [ ] **Directional throw breaks**
- [ ] **Throw chain follow-ups**
- [ ] **Input-driven follow-up timing**
- [ ] **Unbreakable/catch throws where authored**
- [ ] **Throw whiff/recovery**
- [ ] **Throw side/back positioning**
- [ ] **Throw camera/audio/VFX**
- [ ] **Throw training scenarios**
- [ ] **ETE/advanced evade-throw interactions (research/optional)**

## 5. Launchers / combos / juggles

- [ ] **Launcher classification**
- [ ] **Juggle state authority**
- [ ] **Airborne hit validation**
- [ ] **Juggle scaling**
- [ ] **Juggle gravity/velocity rules**
- [ ] **Air-to-air**
- [ ] **Air combo routes**
- [ ] **Ground bounce**
- [ ] **Wall bounce**
- [ ] **Bound/Tailspin-style extension (our own terminology/mechanics)**
- [ ] **Combo damage scaling**
- [ ] **Hit-count scaling**
- [ ] **Combo drop/recovery rules**
- [ ] **Combo enders**
- [ ] **Character-specific launchers**
- [ ] **Character-specific juggle routes**
- [ ] **Combo route validation tests**

## 6. Wall / stage interaction

- [ ] **Wall splat**
- [ ] **Wall stun**
- [ ] **Wall slump**
- [ ] **Wall bounce**
- [ ] **Wall combo**
- [ ] **Wall carry**
- [ ] **Wall throw**
- [ ] **Wall escape**
- [ ] **Wall break**
- [ ] **Floor break**
- [ ] **Ledge interaction**
- [ ] **Stage transition**
- [ ] **Destructible stage elements**
- [ ] **Stage hazard combat rules**
- [ ] **Post-break state reset/continuation**
- [ ] **Wall/floor camera transitions**
- [ ] **Wall/floor combo scaling**

## 7. Wakeup / grounded combat

- [ ] **Knockdown authority**
- [ ] **Quick rise**
- [ ] **Back rise**
- [ ] **Side roll**
- [ ] **Tech roll**
- [ ] **Delayed wakeup**
- [ ] **Stay-down state**
- [ ] **Wakeup attack**
- [ ] **Low wakeup attack**
- [ ] **Get-up kick**
- [ ] **Wakeup invulnerability**
- [ ] **Grounded hit**
- [ ] **Grounded low**
- [ ] **OTG / grounded attack**
- [ ] **Ground throw**
- [ ] **Ground pound**
- [ ] **Ground bounce**
- [ ] **Grounded hit scaling**
- [ ] **Wakeup mixup test coverage**

## 8. Resources / comeback / special systems

- [ ] **Momentum resource rules**
- [ ] **Momentum gain/spend events**
- [ ] **Momentum UI**
- [ ] **Overdrive activation**
- [ ] **Overdrive state duration**
- [ ] **Overdrive-enhanced moves**
- [ ] **Overdrive cancel rules**
- [ ] **Finisher threshold**
- [ ] **Finisher activation rules**
- [ ] **Character-specific Finisher**
- [ ] **Finisher cinematic**
- [ ] **Low-health state**
- [ ] **Optional recoverable health**
- [ ] **Resource interaction with defense/offense**
- [ ] **Resource anti-loop/anti-infinite rules**

## 9. Move-definition schema

Every authoritative move should be able to express, as applicable:

- command / aliases
- stance
- startup / active / recovery / total
- hit level
- damage
- chip damage
- hitstun
- blockstun
- on-hit advantage
- on-counter-hit advantage
- on-block advantage
- whiff recovery
- range
- pushback
- tracking class
- hitbox
- hurtbox interaction
- counter-hit reaction
- launch / bounce / splat / knockdown
- armor
- invulnerability
- cancel windows
- followups
- stance transitions
- throw type
- wall/floor behavior
- camera behavior
- audio/VFX event IDs
- combo scaling behavior

## 10. Animation / rig / skin pipeline

- [ ] **Skeleton normalization**
- [ ] **Bone-chain validation**
- [ ] **Bind/rest-pose validation**
- [ ] **Source/rest-pose consistency**
- [ ] **Skin-weight validation**
- [ ] **Influence-count validation**
- [ ] **Bone-length validation**
- [ ] **Joint-limit validation**
- [ ] **Retarget validation**
- [ ] **Mirroring validation**
- [ ] **Non-finite transform validation**
- [ ] **Pelvis-motion validation**
- [ ] **Ground-contact validation**
- [ ] **Foot-slide detection**
- [ ] **T-pose/starfish detection**
- [ ] **Attack-limb direction validation**
- [ ] **Opponent-facing validation**
- [ ] **Attack range/contact validation**
- [ ] **Crouch/jump/landing pose validation**
- [ ] **Clip identity validation**
- [ ] **Duplicate-clip detection**
- [ ] **Wrong-animation assignment detection**
- [ ] **Animation coverage audit**
- [ ] **Borrowed-motion safety gates**
- [ ] **Mesh deformation / stretching gates**
- [ ] **Vertex-weight repair pipeline**
- [ ] **Automatic reject/quarantine for bad assets**
- [ ] **Per-character animation manifest**
- [ ] **Authoritative animation provenance**
- [ ] **Runtime animation fallback policy**
- [ ] **No silent fallback to visually invalid clips**

## 11. Combat-to-animation integration

- [ ] Move ID -> animation ID is authoritative.
- [ ] Animation -> combat frame timing is deterministic.
- [ ] Hitboxes follow authored move timing, not arbitrary animation guesses.
- [ ] Attack limb/socket alignment is measured.
- [ ] Hit reaction selection is move/result driven.
- [ ] Guard reaction selection is move/result driven.
- [ ] Counter-hit animation selection is result driven.
- [ ] Launch/juggle animation state is synchronized with combat state.
- [ ] Throw animations are synchronized with throw transactions.
- [ ] Finisher/Overdrive animations are dedicated assets.
- [ ] Camera/VFX/audio events fire from combat events.
- [ ] Animation interruptions respect cancel windows.
- [ ] Animation completion cannot override authoritative combat state.

## 12. Presentation

- [ ] Combat camera
- [ ] Distance framing
- [ ] Side-switch reframing
- [ ] Wall framing
- [ ] Throw camera
- [ ] Finisher camera
- [ ] Overdrive camera
- [ ] Stage transition camera
- [ ] Hit-stop presentation
- [ ] Hit sparks by hit type
- [ ] Counter-hit effects
- [ ] Guard effects
- [ ] Armor effects
- [ ] Wall/floor impact effects
- [ ] Audio event synchronization
- [ ] Footstep/landing audio
- [ ] Character-specific taunts
- [ ] Character-specific intros
- [ ] Character-specific victory/defeat
- [ ] KO presentation
- [ ] Announcer/event presentation

## 13. Training / QA tools

- [ ] Training mode
- [ ] Dummy record/playback
- [ ] Dummy guard modes
- [ ] Dummy crouch/stand modes
- [ ] Dummy counter-hit mode
- [ ] Throw-break practice
- [ ] Frame-step
- [ ] Input history
- [ ] Frame-data display
- [ ] Hitbox display
- [ ] Hurtbox display
- [ ] Pushbox display
- [ ] Throwbox display
- [ ] Attack trajectory display
- [ ] Position/facing display
- [ ] Move/state ID display
- [ ] Damage/combo counter
- [ ] Advantage display
- [ ] Infinite health
- [ ] Infinite resource
- [ ] Reset position
- [ ] Reset stage
- [ ] Deterministic combat probe suite
- [ ] Asset validation suite
- [ ] Runtime smoke suite
- [ ] No-UNKNOWN PASS policy in validation

## 14. AI

- [ ] AI obeys the same combat authority as players.
- [ ] AI uses actual move definitions.
- [ ] AI understands range.
- [ ] AI understands frame advantage.
- [ ] AI can punish whiffs.
- [ ] AI can punish unsafe blocks.
- [ ] AI can guard.
- [ ] AI can crouch guard.
- [ ] AI can sidestep.
- [ ] AI can throw.
- [ ] AI can break throws.
- [ ] AI can use launchers/juggles.
- [ ] AI can use wakeup options.
- [ ] AI can interact with walls.
- [ ] AI can use Momentum/Overdrive/Finisher.
- [ ] AI difficulty changes decision quality, not hidden damage/cheating.

## 15. Mobile / PWA controls

- [ ] Four-button touch layout
- [ ] Directional control
- [ ] Guard
- [ ] Throw
- [ ] Escape
- [ ] Momentum
- [ ] Overdrive
- [ ] Finisher
- [ ] Configurable button positions
- [ ] Safe-area handling
- [ ] Browser gesture prevention where appropriate
- [ ] Touch input buffering
- [ ] Optional assisted controls
- [ ] Classic/full control mode
- [ ] Input display for touch
- [ ] Controller support
- [ ] Keyboard support

## 16. Match / game modes

- [ ] Character select
- [ ] Stage select
- [ ] Versus
- [ ] Arcade progression
- [ ] Training
- [ ] Practice/mission challenges
- [ ] Replay
- [ ] Rematch
- [ ] Tournament/match flow
- [ ] Pause/options
- [ ] Accessibility options
- [ ] Control customization
- [ ] Match result persistence
- [ ] Deterministic replay

## 17. Replay / determinism

- [ ] Record normalized inputs by frame.
- [ ] Record facing/position where required for deterministic recovery.
- [ ] Record RNG seed.
- [ ] Replay through combat authority rather than animation outcomes.
- [ ] Detect desync.
- [ ] Version replay format.
- [ ] Store move/state identifiers for diagnostics.
- [ ] Reproduce bugs from recorded inputs.

## 18. Data/content pipeline

- [ ] Per-character manifest
- [ ] Per-move manifest
- [ ] Animation provenance
- [ ] Asset SHA/hash receipts
- [ ] Generated-data provenance
- [ ] Import validation
- [ ] Runtime validation
- [ ] Generated Schwarzerblitz data reconciliation
- [ ] Explicit distinction between imported source data and Brutal Fist authored data
- [ ] No accidental overwriting of authored moves by generated data
- [ ] Migration/versioning for move definitions
- [ ] Safe asset fallback/quarantine

## 19. Research backlog — keep digging

Research and compare current/authoritative documentation for:

- [ ] Tekken 1–6 / Tag movement, strings, throws, launchers, wall systems, wakeup and combo architecture.
- [ ] Tekken 8 Heat, Rage, recoverable health, stage destruction and character-specific Heat behavior. Official Bandai Namco material confirms Heat as a core system with character-specific abilities and interactive/destructible stages. citeturn0search6turn0search14
- [ ] Virtua Fighter movement, evade tracking, frame advantage, throw escape, side/back positioning and advanced defensive option architecture. Current VF documentation explicitly describes linear/half-circular/full-circular evade rules, evade advantage and throw escape windows. citeturn0search0turn0search2turn0search3
- [ ] Virtua Fighter advanced evade/throw interactions (ETE and related techniques) as optional inspiration, not mandatory replication. citeturn0search8turn0search12
- [ ] Street Fighter 6 Drive system, control modes, parry/impact/rush resource interactions.
- [ ] Mortal Kombat 1 Kameo/assist architecture and mode structure; Kameo Fighters are a separate assist roster with match gameplay implications. citeturn0search1
- [ ] Mortal Kombat grounded combat, wakeup, stage interaction and cinematic presentation.
- [ ] Modern fighter rollback/determinism/training-mode architecture.
- [ ] Fighting-game animation validation and motion-retargeting QA.
- [ ] Skin deformation/weight validation for GLB/GLTF/FBX pipelines.
- [ ] Character-specific locomotion and stance architecture.
- [ ] Touch/mobile fighting-game control design.
- [ ] Accessibility control architectures that preserve competitive depth.

## 20. New requirement capture rules

Every future agent MUST add newly discovered requirements here.

### Add an item when:
1. The user explicitly asks for a feature/system.
2. The user says something is missing or should not be forgotten.
3. Research identifies a relevant system absent or incomplete.
4. A test/probe exposes a missing mechanic or validation gate.
5. An asset/animation/rig failure reveals a reusable pipeline requirement.
6. An agent discovers a dependency needed for a previously listed item.

### Each new item should record:
- **What:** exact requirement.
- **Why:** gameplay/pipeline reason.
- **Status:** MISSING/PARTIAL/IN PROGRESS/IMPLEMENTED/VERIFIED/RESEARCH.
- **Priority:** P0/P1/P2/P3.
- **Evidence:** test, source, commit, measurement, or research link/reference.
- **Dependencies:** related backlog items.
- **Owner:** agent/workstream if known.

### Completion rule
Do not remove completed work. Change its status and add:
- implementation commit
- tests/probes
- verification evidence
- known limitations

## 21. Current execution order

### P0 — make the core fighter authoritative
1. Live command matcher integration.
2. Per-character move definitions.
3. Frame/advantage authority.
4. High/mid/low + guard.
5. Unified throws + throw breaks.
6. Sidestep tracking + side/back turns.
7. Launcher/juggle/wall/wakeup rules.
8. Combat-to-animation authority.
9. Rig/skin/animation acceptance gates.

### P1 — make fighters meaningfully different
10. Stances and stance transitions.
11. Character-specific locomotion.
12. Character-specific strings/commands/throws.
13. Character-specific combo/wall routes.
14. Momentum/Overdrive/Finisher depth.
15. Training/frame-data/hitbox tools.

### P2 — deepen the system
16. Parry/reversal/fuzzy/advanced defense.
17. Grounded/OTG systems.
18. Bounce/bound/tailspin-style systems.
19. Advanced wall/floor transitions.
20. Advanced AI.
21. Replay/determinism.
22. Mobile/accessibility control layers.

### P3 — production/presentation expansion
23. Cinematic presentation.
24. Advanced stage interaction.
25. More modes.
26. Advanced audio/VFX.
27. Optional assist/partner systems.
28. Additional experimental mechanics.

## 22. Agent instruction

**Before starting substantial work:** read this file.

**After discovering a new gap:** update this file in the same workstream/PR.

**Before declaring a system complete:** update status and attach evidence.

**Never let chat-only requirements disappear.**

**If a user says “add this to the list,” this file is the list.**
