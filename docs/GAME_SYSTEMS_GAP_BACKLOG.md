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

- [ ] **Live command-input integration** — `PARTIAL`. The graph reaches the
      matcher and directional commands fire in a live match (see below), but
      only 3 authored sets exist for the whole roster and several inputs
      still resolve to a generic `lightAttack` rather than a character move.
- [ ] **Per-character movelist authority** — each fighter owns a complete move
      table. MEASURED: 27 roster fighters share exactly TWO command lists —
      20 of them are byte-identical — because `moveSetForFighter` routes the
      whole roster into `chara_tutor` (16 commands) or `chara_tutor2` (17).
      That is the owner's "you still have all the fighters doing the exact
      same moves", quantified.
      BLOCKED ON A CLEAN "IS THIS AN ATTACK" CLASSIFIER, and this is worth
      knowing before anyone tries again: filtering the 366 baked clips on
      every physical gate that exists (animates, plants, upright, starts
      standing, faces forward, a hand 0.35 m past its shoulder or a foot
      0.60 m past its hip, under 1.6 s) yields 59 "punches" and 34 "kicks"
      — and the list is full of `SHARKNADO_REACTION`, `AMYTHROW_REACTION`,
      `GRAFTHROWREACTION`, `HIT_TO_BODY`, `BIG_RIB_HIT`, `GINGA_BACKWARD`
      and `CROUCH_WALK_FORWARD`. A body being THROWN extends a limb forward
      just like a body punching. Generating movelists from that pool would
      give every fighter a distinct set of wrong moves.
      THE UNBLOCK IS THE OWNER'S OWN LABELS, now wired (see below).
- [x] **Four distinct limb inputs** — `IMPLEMENTED / VERIFIED`. They were
      collapsing: `commandButtonsFor` returned `{P: lp||rp, K: lk||rk}`, so
      `4+LP` and `4+RP` were one command and half a four-button vocabulary
      did not exist. Buttons are per-limb now; the imported corpus's `P`/`K`
      survive as WILDCARDS (either fist / either foot) so all 16-17 imported
      commands per fighter keep working.
      EVIDENCE: `scripts/probe-command-moves.mjs` in a live match —
      `4+P -> Double Hammer`, `6+P -> Dynamo Punch`, `6+RK -> Knee Commando`,
      `2+LK -> Left Kick`; 0 of 12 inputs dead, 7 distinct moves.
      INSTRUMENT WARNING, worth keeping: that probe USED TO LIE. Two runs of
      one unchanged build reported 0/12 and 4/12 because it slept a fixed
      1.4 s between inputs, so each press landed at a random point in the
      previous move's recovery. It waits for the fighter to be free now.
      Never quote a number from it from before that fix.
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
- [x] **Sidestep path is a real orbit** — `IMPLEMENTED / VERIFIED`.
      `LocomotionSystem.targetedSidestepVelocity` walks the tangent around the
      opponent and holds a target gap. MEASURED live while holding sidestep:
      P1 travelled z 0.09 -> 1.38 with x near -2.2 and the gap held 1.5-1.9 m.
- [x] **The body turns to face the opponent** — `IMPLEMENTED`, needs a
      render check at other angles. Owner: "it doesn't keep making them face
      straight ahead when they sidestep ... right now it's kind of like
      chessboard pieces, like a piece going to the side looking straight
      forward." `p1RotationY` / `p2RotationY` were the CONSTANTS
      `COMBAT_P1_YAW` / `COMBAT_P2_YAW`, so the arc above was invisible.
      `faceOpponentYaw` points the body down the real bearing and reproduces
      the image-tested locked table exactly when the pair are level on Z
      (`src/engine/v7-orientation.test.ts`).
      OPEN: combat facing is still binary +/-1 and hitboxes read it, so a
      deep orbit has the mesh and the hitbox disagreeing. See section 2's
      side/back-turn items — that is the same gap.
- [x] **The camera no longer swings with the axis** — `IMPLEMENTED`, needs
      the owner's eye. Owner: "the camera does like a 45 degree tilt towards
      your character and pretty much stops showing your opponent." TWO
      causes, both measured: the camera aimed at `midZ * 0.15`, 85% of the
      way back to the lane, while its POSITION tracked `midZ` in full; and
      it sat perpendicular to the pair's axis at every instant, so a 50 deg
      axis swing during a sidestep rotated the shot 50 deg. The aim follows
      the real midpoint now and the axis is followed 30% of the way, which
      is closer to how Tekken and Schwarzerblitz keep a side-on shot while
      the fighter travels across the frame.
      EVIDENCE: `__BF_DEBUG.onScreen()` projects both bodies to NDC; both
      read IN for every frame of a held sidestep.
- [ ] **Sidestep / evade** — the rest of it (below) is still missing.
- [ ] **Sidestep tracking rules**
- [ ] **Linear attack classification**
- [ ] **Half-circular left/right tracking**
- [ ] **Full-circular tracking**
- [ ] **Successful vs failed evade states**
- [ ] **Evade advantage calculation**
- [ ] **Evade cancel rules**
- [ ] **Dash/evade movement chains**
- [ ] **Offensive sidestep/attack movement where appropriate**
- [x] **Body separation no longer shoves fighters apart** — `IMPLEMENTED`.
      Owner: "you can't move forward and get close enough to your opponent,
      you can't even hit them, and you can't move back anymore." MEASURED
      holding forward: the gap closed 2.395 -> 1.200 and then BOUNCED to
      1.435. The clamp recentred BOTH fighters on their midpoint, so the
      instant they touched the limit each was teleported half the overlap
      outward — and with the AI walking in too, both got shoved every
      frame. Now each fighter only gives back the ground he took THIS
      frame, in proportion to how much of the overlap he caused, and never
      ends up behind where he started. MIN_SEPARATION 1.2 -> 0.85.
      AFTER: closes to 1.071, back-up reaches 2.86, no teleport.
      STILL OPEN: the gap oscillates around 1.1-1.3 under AI pressure. That
      looks like the receiver's give-ground on hits rather than the clamp,
      but it is NOT isolated yet — do not call the approach fixed.
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
- [x] **Command throw** — resolves for BOTH sides now. The AI's grapple input entered CommandThrow and nothing ever checked its range, so it could never land; the player could not be thrown by anybody. Both directions wired, both with a break window. See 21d.
- [ ] **Directional throws**
- [ ] **Side throws**
- [ ] **Back throws**
- [ ] **Character-specific throws**
- [ ] **Throw startup/active/break window**
- [ ] **Unified throw transaction** — the victim now plays the opponent's half of the throw rather than a stock knockdown (21d), but attacker and victim are still two independent playbacks, not one transaction with shared timing and position.
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

## 21a. The owner's labels are an authority in combat

`IMPLEMENTED`. The Move Library (main menu -> MOVE LIBRARY) plays all 366
baked clips on a real fighter and has always collected his judgement — and
`moveLabels.ts` used to say, in its own header, "nothing in combat reads
it". It was a suggestion box.

Two fields are wired into clip resolution now:

- **verdict `broken`** refuses the clip everywhere, immediately. A verdict
  beats every measurement in this repo, because the measurements keep
  missing what he sees at a glance: a severed rig scores a PERFECT
  deformation number, a T-pose that lasts 17 seconds passed the T-pose gate
  at 0.49 against 0.50, and two taunts that play lying flat passed
  everything but the eye.
- **slot** makes the clip the PREFERRED pick for that slot, ahead of the
  bake's own choice.

`name` and `note` stay notes and change nothing, so writing down what a move
IS never removes it from the game.

Typed slots resolve through the engine's OWN tables (combat-state names plus
every alias each semantic answers to), so "Heavy Kick", "heavy kick",
"attack_rk" and "RK" all land on `attack_rk`. The editor says which slot it
resolved to, or warns that it resolved to none — a free-text box on a phone
that silently ignores four spellings in five is worse than no box.

NEXT, and this is the path off the blocker above: as he labels, the
labelled clips become the ground truth an "is this an attack" classifier and
a per-character movelist generator can be built from.

## 21a2. Hover-to-preview in the moveset creator

`IMPLEMENTED / VERIFIED`. Owner: "when I am hovering over a move, like WWE
games, it shows the animation from start to finish and keeps replaying it,
while I'm hovering over each move and animation so I can know what move I'm
looking at while I'm doing the checkbox list — and then I'll also be able to
tell you which animations actually look like the animation they're supposed
to and what parts are being messed up on the ones that don't."

Hovering a clip row previews it immediately and loops it; tapping still
SELECTS, so scrubbing the list never loses the clip being tagged. On a phone
there is no hover, so the finger is the pointer — `onPointerEnter` fires for
a mouse and for a drag down the list.

Two details that matter for the job it has to do:
- `setLoop(LoopRepeat, Infinity)` is named rather than left to the default.
  A clip carrying LoopOnce stops on its last frame and reads as a frozen
  statue — indistinguishable from the broken clips he is here to find.
- A playhead readout and bar. A looping clip and a frozen one look identical
  in a still frame, and telling those apart is the whole point. If the bar
  does not sweep, that is a finding.

EVIDENCE, driven in a browser: 366 clip rows; hovering shows the
"preview · tap to tag" banner; the playhead advances and WRAPS
(0.93 -> 0.31 on a 1.42 s clip), which is start-to-finish looping.

## 21e. LOGGED, NOT STARTED — 41 Bannon clips are baked lying down

Found while pairing grapples; NOT touched, because the repo's own law is to
finish one system before starting another. Written down so the next pass has
the numbers instead of re-deriving them.

Owner: "Crotch chop and rapid chest beating are taunts. I can see those aren't
firing off in your thing."

They are not firing, and the gate is right to refuse them. MEASURED across the
baked index: **41 clips start AND end with the head on the floor**
(`strike.startUp` and `strike.endUp` both under 0.2, where 1.0 is standing).
All 41 are from the `bannon` bank; the schwarzerblitz bank has none. They
include every single one of these, which are all STANDING performances:

    CROTCHCHOP 0.042   RAPIDCHESTBEATING 0.043   TAUNT 0.041
    TAU_BUTTSLAP 0.07  TAU_GENERALFEMALE 0.098   TAUNT_KOFIKINGSTON 0.043
    TAU_GAMEOVER       TAU_DIVA                  TAU_HEADCRACK
    SPINNINGARMSSPREAD WBTC                      CARTWHEEL

For contrast, in the same bank TAUNT_FLEX reads 0.995 and TAUNT_POINT 0.997 —
so it is a subset, not the whole bank, which is what makes it look like an
import-side orientation problem rather than one global axis being wrong.

`clipStartsStanding` (STANDING_START_MIN 0.6) refuses them, and it should: a
taunt performed flat on the mat is not a taunt. The defect is in the asset, not
the gate, and the fix belongs in the source sync or the bake's orientation
pass, not in loosening the threshold.

DO NOT reach for `correctWholeBodyPitch` — it was written for exactly this,
measured WORSE (it "fixed" three clips that were already correct, including a
takedown victim and a kip-up), and was reverted with the reason recorded in
scripts/bake-fighter-animations.mjs. Whatever is done here has to be measured
per clip and RENDERED before banking, per the owner law.

## 21d. The opponent's half of a grapple

Owner, twice, and the second time was a repeat because the first was not done:

> "neck breaker ... would have two animation parts for the one for the deliverer
> and the receiver type shit for the fucking grapples"

> "Scoop slam is a grapple too that needs the opponent side, and same for all
> grapple they need the opponent side hooked up and wired up all areas wise
> where it needs to be with reaction and animation etc"

### What was actually happening

MEASURED, not read: the bank holds **54 clips of a body being thrown** and
nothing had ever connected one of them to the throw it belongs to. A landed
throw called `applyKnockdown()` on the victim and stopped there, so the same
stock fall answered a DDT, a giant swing and a scoop slam, at a length with no
relation to the throw being performed on him.

And the other half of "all areas wise" was worse. `p1SM.action ===
'CommandThrow'` was **the only occurrence in GameBattleArena**. `buildP2AIInput`
has carried a `grapple` field the whole time and the AI's state machine entered
CommandThrow on it — but nothing ever checked its grab range, resolved it,
opened a break window or dealt damage. **The AI could not land a throw at all,
and the player could never be thrown by anybody.** Both sides are wired now,
including a throw break for the player.

### Where a pairing comes from, in order of authority

1. **The owner**, in the Move Library, watching both clips loop side by side.
2. **The bake**, which derives pairs from the names that are actually present
   and CONFIRMS them on duration. Five of the thirteen agree to four decimal
   places — KNEETHROW 0.5417 with KNEETHROWREACTION 0.5417, ORAORAORA 2.4583,
   RENZOTHROW 2.25, ROADROLLERDAB 4.5417, SHARKNADO 1.125. That is one take
   recorded from two bodies, not a name rule getting lucky.
3. **A stand-in** drawn from the throw victims whose own deliverer half was
   never imported, chosen by length and **reported as a stand-in** so it is
   never mistaken for a real pair. It refuses rather than answer a throw with
   something more than 1.6 s away from it.

A generic hit flinch is never in that pool: REACTION_HITWEAKHIGH is a sixth of
a second of a head snapping back and is in no sense somebody being suplexed.
The bake already files those under `hit_reaction`; that decision is reused
rather than a second name rule being invented.

### 37 receiver halves have no deliverer, and that is the import list

AMYTHROW_REACTION, CYPHRTHROWREACTION, ELENATHROWREACTION, KIYOKOTHROWREACTION,
LAZORTHROWREACTION, MIRATHROWREACTION, NIGHTTHROWREACTION, WALLYTHROWREACTION,
BACKBREAKER_REACTION, JENNLEGLOCKREACTION, SKELETONFACEPRESSREACTION,
THUNDERGODREACTION and the rest: the victim's half was imported and the throw
itself never was. Nothing is deleted (owner law on generated content) — they
are the pool the stand-in draws from, and they are exactly what to go and find.

Going the other way, these grapples have no recorded partner at all and are on
stand-ins: NECKBREAKER, SUPLEX, GERMANSUPLEX, POPUPGERMANSUPLEX, CHOKESLAM,
TOMBSTONE, BRAINBUSTER, VERTICALBRAINBUSTER, SNAPPILEDRIVERS, HURRICANERANA,
DRAGONSCREW, SPINTORTURERACKBOMB, HAMMERTHROW, FENCETHROW.

### TZ_SCOOP_SLAM's deliverer half is the whole source reel

`TZ_SCOOP_SLAM` and `TZ_TILT_WHIRL_SLAM` both measure **17.4333 s** — the same
duration, to four decimals, for two different moves — while their `__RECV`
halves are a sane 2.8 s and 1.8 s. That is the capture bug already written down
in CLAUDE.md, where `capture_two` read `--start/--end` and then never applied
the window, so the bank got the entire video. The receiving halves were
captured correctly; the delivering halves need re-cutting at the source. It is
also why both render as a 17-second T-pose, which is a source defect and not a
rig one.

### A gate that refused the thing it was asked for

`resolveClipName` applies "starts standing" and "stands upright" to every
lookup. A throw victim is SUPPOSED to go horizontal and can start off his feet,
so naming one by hand got it refused for exactly the reason it was chosen. A
clip named outright is an instruction now, not a suggestion — except for a
combat state or a semantic slot, which still go through the table so nothing
can jump the queue by being named after a state. The owner's BROKEN verdict
still wins, because he looked at it.

### And the grapple button did nothing

Third finding of the pass, and the one a player would hit first. The HUD says
`V: GRAPPLE`. MEASURED by grep: `risingGrapple` appeared exactly TWICE in the
whole state machine — pushed into the input buffer, and queued during recovery
as `{ type: 'grapple' }`. The switch that executes a queued action has cases
for light, heavy, guard and commandThrow, so `'grapple'` fell through to
`default`, which sets Idle. And there was no neutral path at all.

So throws were reachable only through Forward+Guard or the two-button
combinations, and buffering the throw button during recovery — exactly when a
player buffers a throw — threw the input away. Both fixed, with a test that
was confirmed FAILING on the unfixed code first (2 fail -> 2 pass).

### THE ANIMATION POOL WAS STORING NOTHING

Found on the way through, and it is the more urgent of the two:

`setMoveLabel` deletes a label it considers empty so a mistake can be taken
back. That test listed **four** fields and the label has six. A tap on a clip
with no typed name, slot, note or verdict produced a label carrying `kinds` and
nothing else, so the emptiness test threw it away on the way to storage —
`kindsOf` came back `[]` immediately after `toggleMoveKind`.

On a fresh clip, which is every clip at the start of a sweep, **the checkbox
screen he asked for stored nothing at all.** He would have tagged hundreds of
clips and lost every one. Fixed, with a regression test that taps a kind on a
clip with nothing else written on it, and an explicit note in the code that a
field added later has to be added to that test too.

RULE THIS EARNED: a "delete when empty" rule has to be derived from the type,
or it silently discards whichever field was added last.

## 21c. Two probes of mine that could not fail, and one that lied

Written down because all three produced a confident answer that was wrong,
and two of them carried the SAME bug the code they were auditing had.

- **`__BF_DEBUG.skinBleed()` never found a body.** It walked
  `window.__scenes`, which nothing in this codebase publishes, and returned
  `[]` — which reads exactly like "no webbing". It also SKIPPED joint pairs
  in different components, the identical bug that made the skin repair
  refuse every model with a prop bone. So the one instrument pointed at the
  owner's most-reported visual defect was blind to that defect twice over.
  Fixed: the live scene is published, unreachable pairs count as the worst
  span there is, and it now returns an explicit error instead of an empty
  list when there is no scene. MEASURED after, on the owner's own pairing
  (ONYX vs CIPHER, in a live match): **0 bleeding vertices on both bodies.**
  His screenshots showing the stick through the torso are from a build
  predating the repair-guard fix.

- **`scripts/probe-command-moves.mjs` reported different results for the
  same build.** 0 of 12 inputs firing, then 4 of 12, on an unchanged game:
  it slept a fixed 1.4 s between inputs, so each press landed at a random
  point in the previous move's recovery. It waits for the fighter to be
  free now. No number from before that fix means anything.

- A camera published as `cam.parent` was null, because an R3F default
  camera is not parented into the scene graph. `state.scene` is the answer.

RULE THIS PASS EARNED: a probe that returns an empty result must be able to
distinguish "nothing wrong" from "nothing looked at", or it will confirm
whatever you already believe.

## 21b. Findings banked this pass (measured, with the instrument named)

Recorded here rather than left in chat, per the rule below.

- **The pelvis was pinned and the feet paddled.** Owner: "instead of the
  pelvis doing a natural bob, it's like the pelvis is locked in position and
  the idle motion is picking the feet up off the ground." The banks are
  ROTATION-ONLY — no authored hips translation anywhere in the corpus — and
  the bake wrote the floor offset as ONE constant key from the first sample,
  so 324 of 324 grounded clips had a pelvis that could not move vertically.
  In pure FK the pelvis is the root, so the legs could only answer by lifting
  the feet. Grounding follows the floor per frame now, clamped to 2 m/s so a
  run's flight phase cannot haul the hips up after the lowest foot.
  MEASURED after: STANCE 4.9 cm bob, GUARD 4.6, BOX_IDLE 4.0, WALK 2.5;
  172 clips have a moving pelvis where none did.

- **A "universal fix" that refused most of the roster, silently.**
  `skeletonIsConnected` required 90% of joint PAIRS to be mutually reachable
  and returned from the repair without a log line when they were not.
  ONYX_straightjacket carries six stray prop bones outside the hierarchy —
  52 of 58 bones reach each other, 0.80, under the bar — so one of the
  models in the owner's screenshots was never repaired at all. Cross-component
  pairs are the WORST span, not an unknown one. After: 468 webbed vertices
  pruned on that model.
  STILL OPEN: the plank across ONYX's chest is NOT skin webbing. Reproduced,
  repaired, re-rendered — identical.

- **One dropped request killed every animation for a session.**
  `loadBakedMotionBank` latched `attempted` on its first call and returned an
  empty Map for the rest of the session, so a single flaky fetch of
  index.json left every fighter with none of its 366 baked clips and no way
  back. A running load is joined; a failed one is retried; only success is
  permanent.

- **DEV AND THE BUILD DISAGREED ABOUT WHERE ASSETS LIVE.** `/motion/...`
  404'd on the dev server while `/public/motion/...` returned 200. The built
  output was always correct, so this was dev-only — and it meant every local
  probe of models, clips and manifests was measuring a game with no assets
  in it. `publicDir` is pinned now. Suspect this before believing any local
  "the asset is missing" result.

- **CLIPS THE OWNER NAMED, MEASURED.** NECKBREAKER starts with its head at
  0.02 of standing height — it is a grapple's RECEIVING half, exactly as he
  said. CROTCHCHOP and RAPIDCHESTBEATING are taunts and play HORIZONTAL
  (spine -0.03 and -0.06); a whole-body rotation does not stand them up, so
  they need a different source. DROP_KICK and AU are 2.90 s multi-action
  DEMONSTRATION clips where the fighter turns his back partway.

- **A CORRECTION THAT MEASURED CLEAN AND WAS WRONG.** Rotating the root to
  stand up flat clips, keeping only results that raised the spine AND hung
  the legs down, "fixed" three clips that were already right — a takedown
  victim and a kip-up, both of which belong on the floor. Reverted. A
  self-verifying correction is only as good as the thing it verifies
  against.

- **MAIN ARRIVED RED and was repaired in the merge.** `incomingThrowBreak`
  was assigned and never declared, so the file did not typecheck; and the
  throw-combo router ran ABOVE the CommandThrow tick, found a queued route
  with an unarmed timer, binned it, and left the fighter stuck in
  CommandThrow. Both verified failing on a clean checkout of origin/main
  before being touched.

## 22. Agent instruction

**Before starting substantial work:** read this file.

**After discovering a new gap:** update this file in the same workstream/PR.

**Before declaring a system complete:** update status and attach evidence.

**Never let chat-only requirements disappear.**

**If a user says “add this to the list,” this file is the list.**
