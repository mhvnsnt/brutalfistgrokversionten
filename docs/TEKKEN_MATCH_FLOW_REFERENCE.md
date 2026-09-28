# Tekken Bell-to-Bell Combat Flow Reference and Engine Gap Audit

Updated: 2026-09-28
Engine snapshot audited: `origin/main` @ `db752c8` (a read-only clone; no code was changed)
Recompiled-repo snapshot: `mhvnsnt/BrutalfistbaseofTekken3Recompiled` @ `8a23a51` (sparse, read-only clone; no ROM, disc image, BIOS or `.bin`/`.rom` asset was checked out or used)

This document covers one Tekken round, bell to bell, and then the match around it. For each stage it gives:

1. **What Tekken does**, with a citation.
2. **What Brutal Fist does today**, with `file:line` evidence from `db752c8`.
3. A **status**: `IMPLEMENTED`, `PARTIAL`, `MISSING` or `UNKNOWN`.

Status law (same as `docs/PRODUCTION_GAPS.md:54-56`): the statuses here come from **reading the code statically**. `IMPLEMENTED` means a code path exists and is wired into `GameBattleArena`. It does **not** mean the stage has been seen working in the PWA. No stage in this audit has been runtime-certified, so the runtime column reads `UNKNOWN` in every row. **UNKNOWN is never PASS.**

No frame number in this file is invented. Every Tekken number is quoted from a cited page. Every engine number is a constant quoted from our own source. Where the public docs gave no number (for example, the numeric distance between fighters at round start), the entry says so.

---

## 0. Sources

### 0.1 Recompiled repo (user-authorized, read-only)

`mhvnsnt/BrutalfistbaseofTekken3Recompiled` is a **PSX static-recompilation framework**, not a decompilation of Tekken 3's game logic. The original match, round and KO logic still runs as translated guest MIPS code, which is generated from the user's own legal disc at build time. None of that generated code is in the repo.

| Evidence | What it shows |
|---|---|
| `game.toml:4-9,30` | The game is built from the user's disc (`exe = "disc/SLUS_004.02"`). The recompiler is seeded from `seeds/ghidra_funcs.txt`. |
| `seeds/ghidra_funcs.txt:1-3` | The seed file is a list of "Auto-scanned JAL targets", about 1,350 bare addresses with no names. |
| `symbols.toml:1-11` | The "partial decomp" symbol map names exactly one function, `BootEntry`. There are **no named round, timer, KO or health routines**. |
| `native/README.md:3-15` | `native/` is a "clean-room, host-native port" whose "first vertical slice is intentionally procedural … It is not yet a content-complete port." |
| `native/src/game.cpp:21-31` | `reset_round()` keeps `round_number` and places the fighters at x = −2.4 / +2.4, facing each other. |
| `native/src/game.cpp:91-106` | While `round_over` is set, `end_delay` accumulates. At ≥ 2.2 s the round number increments and the round resets. |
| `native/src/game.cpp:140-142` | The round ends when `round_time <= 0` **or** either fighter's `health <= 0` (both timeout and KO). |
| `native/src/game.cpp:84` | The procedural slice deals a flat 15 (heavy) or 8 (light) damage out of 100. |
| `native/tests/native_core_test.cpp:46-48` | The test asserts that damage reduces health below 100.0 and that "fixed-step match timer advances" (`round_time < 60.0f`). The struct header that holds the initial value is not in the repo, so the starting value is UNKNOWN. |
| `native/src/renderer_gl.cpp:553-575` | The HUD draws a two-digit timer clamped to 0-99, round pips (max 5) and a round-over banner. |
| `src/tekken3_jun_combat.c:380,407,420` | The P1 actor base is `0x800a9228`, with P2 at a `0x188c` stride. |
| `tools/test_jun_solo.py:10,29-30,39,127,133` | Live fixtures read HP as 16.16 fixed point at actor `+0x3f4` and the throw state as signed `+0x74` (>0 attacker, <0 victim). They seed 130 HP, and they force a KO by writing 1 HP. |
| `tools/JUN_IMPORT.md:45` | Throws/reversals: "paired attacker/victim clips, throw locks, **escape links**, timed damage and releases". |
| `tools/JUN_IMPORT.md:46,50` + `tools/convert_jun_moves.py:183-185` | The **PS1 native round controller** owns defeat and victory. TTT1's round-defeat signal is deliberately skipped because "the PS1 round controller enters native D6C/D6D". |
| `tools/jun_solo_semantics.py:85-86` | "The PS1 inserts a reserved state before the paired throw states." |
| `tools/JUN_IMPORT.md:58` | This is the repo's own measurement: Jun's jab has "base damage 4 and becomes active at frame 10", and native hit-location scaling makes it 5 HP (130%). "Neutral high guard blocks the jab." |
| `tools/JUN_IMPORT.md:121,123` | These are the repo's own captures. 1+3 and 2+4 throws deal 30 HP. Left, right and back throws deal 40/40/45 HP. The fixtures also record a natural throw KO "followed by the native replay/win sequence". |
| `src/tekken3_fight_camera.h:11-12` | Battle modes 0-5 are regular fights (5 = Practice). Camera 1 is the throw/replay inset. |

**Consequence.** The recompiled repo confirms the *shape* of Tekken 3's flow:

- a native round controller with win and lose states;
- a KO leading into the replay and win sequence;
- paired throws with lock and escape links;
- per-actor HP in fixed point;
- a jab active on frame 10.

It **cannot** supply Tekken 3's actual timer value, round-start distance, throw-break window, wake-up timings or KO rules as source code. Those live only in the untranslated disc code, which this audit did not touch. Where this document needs those values, it uses the public Tekken documentation (§0.2) and says so.

### 0.2 Public documentation

| Key | Source |
|---|---|
| W-Frame | Wavu Wiki, *Frame / Frame advantage*: https://wavu.wiki/t/Frame_advantage (oldid 31502) |
| W-Attack | Wavu Wiki, *Attack* (counter hit, launcher, tornado, homing, power crush, wall splat): https://wavu.wiki/t/Attack (served from `/t/Power_crush`) |
| W-Throw | Wavu Wiki, *Throw*: https://wavu.wiki/t/Throw (oldid 48666) |
| W-Wake | Wavu Wiki, *Wake-up*: https://wavu.wiki/t/Wake-up |
| W-Tech | Wavu Wiki, *Tech recovery*: https://wavu.wiki/t/Tech_recovery |
| W-Oki | Wavu Wiki, *Okizeme*: https://wavu.wiki/t/Okizeme |
| W-Step | Wavu Wiki, *Sidestep*: https://wavu.wiki/t/Sidestep |
| W-Combo | Wavu Wiki, *Combo* (launch, scaling, wall combo, breaks): https://wavu.wiki/t/Combo (oldid 59938) |
| W-Wall | Wavu Wiki, *Wall*: https://wavu.wiki/t/Wall (oldid 59937) |
| W-Heat | Wavu Wiki, *Heat*: https://wavu.wiki/t/Heat |
| W-Rage | Wavu Wiki, *Rage*: https://wavu.wiki/t/Rage |
| W-Neutral | Wavu Wiki, *Neutral*: https://wavu.wiki/t/Neutral (oldid 11490) |
| W-Stage | Wavu Wiki, *Stage*: https://wavu.wiki/t/Stage (oldid 53254) |
| BN-T8 | Bandai Namco Europe, *TEKKEN 8: new info about gameplay mechanics, Rage and Heat*: https://en.bandainamcoent.eu/tekken/news/tekken-8-new-info-about-gameplay-mechanics-rage-and-heat-systems-new-control-schemes |
| BN-TWT | Bandai Namco America, TWT official rules: https://www.bandainamcoent.com/legal/community-events/official-rules-twt |
| TO-Vanta | Vanta KB, Tekken match rules (Round Duration 60, first to 3 rounds): https://help.vanta.gg/article/402-what-are-the-match-rules-for-tekken |
| TO-TMG | The Middle Ground, Tekken 8 rules (60 s, 3/5 rounds): https://www.themiddleground.gg/rules/tekken-8 |
| FW-DKO | Tekken Fandom wiki, *Double K.O.* (community wiki, lower confidence): https://tekken.fandom.com/wiki/Double_K.O. |

---

## 1. Stage-by-stage flow

Engine paths are relative to the repo root: `FSM` = `src/engine/combat/FighterStateMachine.ts` and `Arena` = `src/components/GameBattleArena.tsx`.

### 1. Pre-round intro and start distance: **PARTIAL**

- **Tekken.** Each round starts from fixed marks. Some stages start on a diagonal axis, and on at least one stage the players start 10 units from one edge. [W-Stage, stage table and footnote 1] The recompiled repo shows the same "reset to marks" shape: `native/src/game.cpp:21-31` resets both fighters to ±2.4 facing each other (procedural slice only). **No public source we found gives the numeric Tekken round-start distance**, so numeric parity is UNKNOWN.
- **Brutal Fist.**
  - The cinematic waits until both bodies have loaded, with an 8 s ceiling (`Arena:336-383`).
  - It runs per-fighter intro beats from `preFightSequence` (`Arena:386-404`, `PreFightIntros.ts`).
  - The sweep and intro take 2000 ms + 2500 ms (`Arena:163-164`). Control unlocks at the end of the intro (`Arena:553-555`).
  - The fighters start at x = −1.8 / +1.8, which is 3.6 m apart (`Arena:492-497`, `Arena:445`).
- **Gap.** The start distance is not derived from any Tekken reference and is not per-stage. The stage bounds are applied (`Arena:498`), but nothing places the fighters relative to the stage centre or offers diagonal starts.

### 2. Round call ("Round N / Final Round / Fight"): **IMPLEMENTED** (runtime UNKNOWN)

- **Tekken.** The HUD shows round-win dots, and "You win the match when you win the amount of rounds represented by the number of dots." [BN-T8]
- **Brutal Fist.**
  - `announcementFor` in `RoundSystem.ts:54-62` returns `round1`/`round2`/`round3`, or `finalRound` when `isMatchPoint` (`RoundSystem.ts:69-74`).
  - The Arena fires the `getReady` → round line → `fight` calls once each (`Arena:1039-1068`).
  - They are re-armed on every round reset (`Arena:551-552`).

### 3. Round timer: **PARTIAL**

- **Tekken.** Competitive rulesets use a **60 second** round [TO-Vanta, TO-TMG, and the PS5 T8 tournament rules "Round Timer: 60 Seconds"]. Tekken's logic runs at 60 frames per second. [W-Frame]
- **Brutal Fist.**
  - The timer starts at **99** (`Arena:313,484,882`). `CombatStateTick.ts:182` also seeds 99.
  - It ticks from a **wall-clock `setInterval(…, 1000)`** (`Arena:3116-3177`), not from the 60 Hz simulation step (`FSM` `FIXED_STEP_S`, around line 831). So hit-stop, dropped frames and sub-stepping do not freeze or scale it.
  - `isPausedRef` is written (`Arena:730-733`) but never read. Neither the timer effect nor the sim loop checks it, so the clock appears to keep running under the pause overlay. This is a static read; runtime is UNKNOWN.
- **Gap.** Tekken does not document a 99 s default. The competitive standard is 60 s. The timer is not driven by simulation frames, and pause does not stop it.

### 4. Neutral spacing and movement: **PARTIAL**

- **Tekken.** Neutral is "when both players can act freely". It is a rock-paper-scissors between:
  - waiting out of range, which beats keepout;
  - keepout, which beats running in;
  - a running-in mixup, which beats waiting.

  Pokes, whiff punishers and keepout moves are chosen by speed, range, tracking and recovery. [W-Neutral]
- **Brutal Fist.**
  - Movement primitives exist:
    - tap up = jump;
    - double-tap up or down = sidestep;
    - f,f = dash (hold = run);
    - b,b = backdash (hold = run back).

    Source: `TekkenInput.ts:5-11,71-114`.
  - Walk acceleration and backdash constants are in `FSM:789-794`.
  - Per-move reach exists as `contactReach` (`GeneratedMovesets.ts:53-54`, `FrameDataHitbox.ts:141-147`).
- **Gap.** Neutral only works if moves differ in range, speed and recovery. The generated movesets (§3) have startups compressed into 10-19 frames (median 18 across all 286 moves in `public/motion/movesets.json`). They are derived from clip length rather than authored, and they carry no tracking or recovery-stance data. So "whiff punisher", "keepout" and "poke" roles cannot be designed per fighter.

### 5. Pokes and whiff punish: **PARTIAL**

- **Tekken.**
  - Attacks have startup, active and recovery frames, and the attacker cannot guard in any of them. A generic jab is quoted as i10 (9 startup + 1 active) with 17 recovery frames (19 in T8). [W-Frame]
  - Hitting an opponent during their whiff recovery is a *whiff punish*. [W-Frame §Punishment]
  - The recompiled repo's own measurement agrees: Jun's jab is active on frame 10 (`tools/JUN_IMPORT.md:58`).
- **Brutal Fist.**
  - The six basics are authored in frames: jab i10, 3 active, 7 recovery, 20 total (`FSM:261-292`, table at `FSM:248-253`).
  - Recovery is real time in which the attacker is locked.
  - The input buffer keeps presses for 20 frames (`FSM:773`).
- **Gap.**
  - Generated moves get startup, active and recovery from clip duration (`GeneratedMovesets.ts:37-38,147-159`), not from authored data.
  - There is no distinct "whiff" outcome. A missed throw has `ThrowWhiff` (`FSM:18`), but a whiffed strike is just recovery.
  - Whether hits in recovery count as counter hits in Tekken is **UNKNOWN** here: W-Attack defines CH as interrupting or trading with an attack and does not settle the recovery case. Ours explicitly says "Recovery is not a counter" (`CounterHit.ts:51-53`).

### 6. Block and on-block frame advantage: **PARTIAL**

- **Tekken.**
  - Frame advantage is the difference between the attacker's recovery and the defender's blockstun or hitstun.
  - −10 or worse is punishable, because most characters' fastest attack is 10 frames. −9 or better is "safe". −15 or worse is launch-punishable, because the fastest launcher is 15 frames.
  - "Beyond −5" makes sidestepping difficult or impossible.
  - Source: [W-Frame §Frame advantage, general frame situations table]
- **Brutal Fist.**
  - Guard follows Tekken rules (`FSM:646-666`, `resolveTekkenContact`):
    - holding back blocks high and mid;
    - down-back blocks low;
    - highs whiff over a crouch;
    - down-forward is the low parry.
  - On-block advantage is a first-class field, `MoveWindow.onBlock` (`FSM:116-125`).
  - Blockstun is **derived** from it: `blockstun = (total − contact) + onBlock`, clamped to 3-30 frames (`FSM:693-716`).
  - Blocks do not chip (`FSM:1554-1564`).
- **Gap: the flow-breaking one.**
  - Only the six hand-authored basics and the crouch moves carry `onBlock` (`FSM:261-323`).
  - The generated moves carry **no `onBlock` field** (`GeneratedMovesets.ts:43-55,146-187`), so `onBlock` defaults to 0.
  - Running the engine's own formula over all 286 generated moves gives **241 at exactly ±0 on block**. The rest are −2 to −5, and only where the 30-frame clamp bites. **None is punishable (≤ −10) and none is plus.** This is a static computation from `public/motion/movesets.json` and `FSM:701-716`.
  - Every launcher is therefore safe on block, and there is no reason to block-punish.

### 7. On-hit advantage and hitstun: **MISSING** (as an authored quantity)

- **Tekken.** "To reward players for landing a hit, hitstun is typically longer than blockstun," so attacking after being hit is usually a bad idea. Mids tend to be plus on hit, and lows are more minus on block and less plus on hit. [W-Frame; W-Attack §Block, Hit and CH Frames]
- **Brutal Fist.**
  - There is **no `onHit` field** anywhere in `src/engine/combat` (a repo-wide grep for `onHit` finds zero hits).
  - For hitstun-kind reactions, `applyReaction` calls `applyHitStun(sourceMove, …)` (`FSM:1451`). Hitstun then comes from `computeHitStunDuration` = the attacker's **active** seconds, clamped to 0.18-0.65 s (`FSM:784-786,2519-2522`). The reaction table's `stun` is only used when there is no source move (`FSM:1286-1289`).
- **Gap.**
  - Hitstun ignores the attacker's recovery, so on-hit advantage is emergent.
  - Static estimate from our own formulas over the 193 generated moves with "Weak*" reactions: on-hit advantage ranges from **−24 to +1 (median −6)**, and **132 of 193 are negative on hit**.
  - The basic heavy punch comes out about −13 on hit against −9 on block: hitstun is 0.18 s ≈ 11 f, against 24 f of recovery after contact.
  - This inverts Tekken's rule. Runtime is UNKNOWN, because counter-hit bonus, hit-stop and `MIN_REACTION_FRAMES` (`FSM:782`) could modify it in play.

### 8. Counter hit: **PARTIAL**

- **Tekken.**
  - A counter hit happens when an attack interrupts or trades with an opponent's attack.
  - "All moves inflict slightly more damage on CH (… scaled by 120%)", and some gain unique CH properties: a launch, extra advantage or a knockdown, or a string becoming a natural combo.
  - CH landed from the side or back does not grant special CH properties.
  - Source: [W-Attack §Counter Hit]
- **Brutal Fist.**
  - `counterWindowOf` flags startup or active frames of the defender's own move (`CounterHit.ts:41-54`).
  - A counter multiplies damage by **1.25** (`CounterHit.ts:26`) and adds 0.12 s of hitstun (`CounterHit.ts:31`).
  - It is applied inside `processIncomingHit` (`FSM:1505-1513`), and a block is never a counter (`FSM:1557-1564`).
- **Gap.**
  - The multiplier differs from Tekken's cited 120%.
  - There are **no per-move CH properties** (CH launch, CH knockdown, CH natural combo).
  - There is no side/back exclusion.

### 9. Launch and juggle combos: **PARTIAL**

- **Tekken.**
  - A launcher puts the opponent airborne on hit or CH. A typical combo is launcher → 3-5 filler hits → combo extender (Tornado in T8, Tailspin in T7) → ender (→ wall combo). Only one extender is allowed per combo.
  - Airborne-hit scaling after the launcher is 70% / 50% / 40% / 30%+.
  - Source: [W-Combo §Launcher, §Combo Extender, §Scaling; W-Attack §Launcher, §Tornado]
- **Brutal Fist.**
  - The `Flight` reaction launches (`HitReactions.ts:85-87`): it puts the victim in the `Juggled` state and applies the launch (`FSM:1410-1416`).
  - Air hits add juggle hits (`FSM:1426,1436-1441`).
  - Juggle scaling is `[1.0, 0.8, 0.7, 0.6, 0.5, 0.45, 0.4, 0.35, 0.3]` with a 0.25 floor (`HitReactions.ts:112-120`, used at `FSM:1459`).
  - Relaunch height is capped at 35% (`HitReactions.ts:129`).
- **Gap.**
  - There is **no `launcher` flag** on moves. Launching is decided by a heuristic on generated moves: kick + an up direction, or a JUMP/AXE/SPIN clip name, gives `Flight` (`GeneratedMovesets.ts:117-127`). That makes **68 of 286 generated moves launchers**, all ±0 on block (§6).
  - There is no combo-extender (tornado) state and no one-per-combo rule.
  - The scaling curve differs from W-Combo's.
  - `docs/PRODUCTION_GAPS.md:34` still lists "launcher/juggle routes that preserve airborne state" as open.

### 10. Wall (splat, wall combo): **PARTIAL**

- **Tekken.**
  - An airborne opponent hitting the wall, or specific knockdown moves near it, causes a wall splat. That allows a few further hits with a wall-hit counter, and resplats are possible. After a wall hit, all later hits get a further 80% scaling.
  - After sliding off, the opponent is briefly intangible, then has 6 frames of wall slump before a tech roll is possible.
  - Moves can be flagged Wall Splat, Balcony Break or Wall Crush.
  - Source: [W-Combo §Wall Combo, §Scaling for Wall Combos; W-Wall; W-Attack §Wall Splat, §Wall Crush]
- **Brutal Fist.**
  - Wall bounds are at ±4.5 by default, with a splat bonus of 18 frames and recovery of 22 frames (`WallSystem.ts:20-25`).
  - The collision is checked and the splat applied in `CombatStateTick.ts:384-406`. The Arena consumes it (`Arena:1514-1527,2011,2126-2129`).
- **Gap.**
  - The splat is triggered by velocity into the wall, not by per-move wall properties. There is no Balcony Break or Wall Crush flag.
  - `getWallSplatDamageScale` and `canChainWallCombo` have **no callers** outside `WallSystem.ts`, so wall scaling is not applied.
  - There is no wall-slump → tech sequence.
  - `combatStateRef` is not recreated on a round reset (`Arena:576-578` versus `Arena:477-556`), so wall and heat state may carry over between rounds.

### 11. Floor and stage breaks: **PARTIAL**

- **Tekken.**
  - A floor break happens when a spike- or slam-type move hits an airborne opponent on a breakable floor. Both players move to the next floor and the opponent ground-bounces.
  - A balcony break resets both players to a set distance and advantage.
  - Stage hazards add their own scaling (70% / 60% / 50%).
  - Source: [W-Combo §Break, §Scaling for Stage Hazards; W-Attack §Spike, §Slam; W-Stage]
- **Brutal Fist.**
  - `StageConfig.ts` has `breakableFloor` and `floorBreakThreshold` (`StageConfig.ts:55-67`); 8 stage entries set `breakableFloor: true`.
  - `triggerFloorBreak` and `tickFloorBreak` are wired (`Arena:1413-1433,2047-2060`), triggered by a slam on P2.
  - Ring-out is an instant KO (`Arena:1302-1310`), and so is the ledge throw (`Arena:1444-1454`).
- **Gap.**
  - There is no per-move spike or slam flag. The trigger is a damage threshold plus the slam path.
  - There is no stage-hazard scaling.
  - Ring-out KO has **no cited Tekken counterpart**. It is a Brutal Fist design choice and should be labelled as one, not as Tekken parity.

### 12. Knockdown, okizeme and wake-up: **PARTIAL**

- **Tekken.**
  - A grounded player can neither guard nor use standing moves. There are four grounded positions: FUFT, FUFA, FDFT, FDFA.
  - Non-attacking options: back get-up (b), quickstand (u/db), side roll (1 / d+1), front roll (f).
  - Attacking options: low and mid wake-up kicks (3 = low, 4 = mid), spring kick (FUFT 3+4), toe kick (FUFT d+3/4). [W-Wake]
  - The *tech roll* (ukemi) is done by pressing an attack button as you land. It has a 10-frame input window, and most tech rolls take 32 frames, intangible for 20 and able to guard for 12. [W-Tech]
  - Okizeme is the attacker pressuring a grounded defender. Staying down, teching and wake-up kicks are the counterplay. [W-Oki]
  - Grounded hits scale at 80%. [W-Combo §Scaling for Grounded Hits]
- **Brutal Fist.**
  - `Knockdown` lasts a flat 1.2 s. A wake-up option can be buffered in the last 0.8 s: forward = quickStand, back or strafe = techRoll, guard = backrise. With no input, the fighter quickstands (`FSM:741-745,1989-2008,2771-2800`).
  - Tech roll and backrise are throw-invincible (`FSM:1694-1698`).
  - A downed victim state exists (`FSM:1584`).
- **Gap.**
  - There is no landing-time ukemi window (the tech happens after a fixed timer, not "as you land").
  - There is no stay-down or delayed get-up, no side roll distinct from tech, and no face-up/face-down × feet-towards/away positions.
  - There are **no wake-up kicks**, no spring kick and no toe kick.
  - There is no grounded-hit scaling and no ground-hit move flag.
  - `docs/PRODUCTION_GAPS.md:33,51` list "while-standing / rising attack branches" and a knockdown/wake-up PWA test as open.

### 13. Throws and throw breaks: **PARTIAL**

- **Tekken.**
  - Throws are high and breakable on reaction with **1, 2 or 1+2**. Any incorrect press locks the defender out of breaking.
  - Generic 1+3 and 2+4 throws are i12~14 and "broken by either 1 or 2" (not 1+2).
  - Command throws follow the hands rule: left hand = 1, right hand = 2, both hands = 1+2.
  - Throws that connect on the side have a shorter window, broken by 1 (left) or 2 (right). Throws on the back are unbreakable.
  - The break window is **20 frames** by default. It is **14** if the throw lands as a counter hit, and **9** for most chain-throw links.
  - Throws that land on an armored move (power crush or parry) are unbreakable.
  - Source: [W-Throw §Types, §Breaking throws, §Break window, §Unbreakable throws]
  - The recompiled repo confirms paired throw locks and escape links (`tools/JUN_IMPORT.md:45,121-123`).
- **Brutal Fist.**
  - `THROW_CATALOG` defines forward (1+3, break with `'1'`), backward (2+4, break with `'2'`) and side left/right (break with `'either'`) (`DirectionalThrowSystem.ts:71-140`).
  - The live break window is `THROW_BREAK_WINDOW = 0.35 s` (about 21 f), or 0.22 s for chain links (`ThrowChains.ts:142,149`), and runs through `FSM:1885-1910`.
  - `DirectionalThrowSystem.THROW_BREAK_WINDOW_FRAMES = 12` (`DirectionalThrowSystem.ts:26`) is **not read** by the FSM or the Arena.
  - The break accepts `risingEscape` for **any** throw, in addition to the matched limb (`FSM:1890-1894`).
  - Whiff recovery is 38 f (`DirectionalThrowSystem.ts:27`). Throws beat guard and armor (`FSM:1516-1518`).
- **Gap.**
  - The generic-throw break buttons are inverted from Tekken, which breaks generic throws with either 1 or 2.
  - There is no 1+2 break class, and no wrong-button lockout (a universal Escape button breaks everything).
  - There is no CH break-window shortening, no back-throw unbreakability, and no "unbreakable when landed on armor".
  - Two conflicting break-window constants exist.
  - `docs/PRODUCTION_GAPS.md:36-37` still has throw-damage and grapple-sync verification open.

### 14. Low and mid mixups: **PARTIAL**

- **Tekken.**
  - The core mixup is a low plus a safe-on-block mid [W-Neutral §Mixup].
  - Lows are typically more minus on block and less plus on hit than mids [W-Attack].
  - High crush (cs) and low crush (js) are hard-coded crush states [W-Attack §Crush].
- **Brutal Fist.**
  - The guard matrix is correct (see §6).
  - The low parry beats lows only and pays out a 0.6 s attacker stagger (`FSM:646-673`).
  - Attack levels are authored for the basics (`FSM:261-323`). For imported and generated moves they are **derived from clip geometry** (`DerivedAttackLevels.ts:1-50`, applied at `FSM:1500-1504`), falling back to `mid`.
- **Gap.**
  - A generated low is ±0 on block (§6), so lows carry no risk.
  - There are no high-crush or low-crush frame windows on moves (only armor and invincibility kinds in `DefensiveWindows.ts:67-101`).
  - Hit levels come from geometry, not authoring. `DerivedAttackLevels.ts:18-21` documents a one-point boundary miss.

### 15. Sidestep, sidewalk and homing: **PARTIAL**

- **Tekken.**
  - A sidestep (u~n / d~n) makes an opponent's move whiff regardless of distance. A sidewalk (u~n~U / d~n~D) extends it indefinitely.
  - Sidestep is a temporary stance with SS-only moves; the stance lingers for 42 frames.
  - Many moves track to one side, and homing moves "automatically realign … catch sidesteps in virtually every scenario".
  - Source: [W-Step; W-Attack §Homing]
- **Brutal Fist.**
  - Double-tap up or down gives a 280 ms sidestep, and Q/E give lateral steps (`TekkenInput.ts:71-104`).
  - The Z offset decays back toward the line (`CombatStateTick.ts:358-360`). A Z gap of ≥ 0.6 makes a linear attack whiff (`CombatStateTick.ts:134,244-252`).
- **Gap.**
  - **Homing is a blanket flag.** Any `isSpecial` move counts as tracking (`Arena:1915`), and **every generated move is `isSpecial: true`** (`GeneratedMovesets.ts:163`). So only P1's six basic moves can be sidestepped.
  - **The sidestep gate is one-sided.** `checkSidestepWhiff` is called for P1's attacks only (`Arena:1915-1916`). P2's attack goes straight to `p2Hb.checkCollision` (`Arena:2382-2388`), leaving only geometric Z overlap.
  - There is no sidewalk hold, no SS stance and no SS attacks. `docs/PRODUCTION_GAPS.md:32` lists "Add sidestep + attack branches" as open.

### 16. Power crush: **PARTIAL**

- **Tekken.**
  - A power crush armors through mids and highs, **not lows or throws**. Absorbing a hit freezes the animation for 15 frames.
  - In T8, power-crush armor typically starts within 7 frames.
  - Throws that land during a power crush are inescapable.
  - Source: [W-Attack §Power Crush]
- **Brutal Fist.**
  - `powerCrushWindow` gives armor from frame 0 to startup, covering high and mid, with a 15% bleed (`DefensiveWindows.ts:81-87`). It is resolved before guard (`FSM:1523-1536`).
  - Throws are resolved before armor, so throws beat it (`FSM:1516-1518`).
  - **Only the basic heavy punch carries one** (`FSM:273-276`).
- **Gap.**
  - No per-fighter power-crush moves.
  - No absorb freeze.
  - No "throw during power crush is unbreakable".

### 17. Comeback mechanic 1 (Heat, Tekken 8): **MISSING**

- **Tekken.**
  - Heat is granted once per round. It is activated by a Heat Burst (2+3, a power crush that cannot KO) or by a character-specific Heat Engager.
  - During Heat, blocked attacks deal chip damage and there are new or enhanced moves. Heat Smash and Heat Dash spend it.
  - The gauge lasts 900 frames.
  - Source: [W-Heat]. BN-T8 describes it as "once per round for 10 seconds", with the timer stopping while the opponent is hit or down.
- **Brutal Fist.**
  - An Overdrive/"heat" state exists and is ticked every frame (`CombatStateTick.ts:107,170,367-368`; `OverdriveSystem.ts:29-33,104-135`).
  - `activateHeat`, `breakHeat` and `extendHeat` (`OverdriveSystem.ts:195-237`) have **no callers** anywhere outside `OverdriveSystem.ts`.
- **Gap.** The state is dead: there is no activation input, no engager moves, no chip-on-block and no per-round grant.

### 18. Comeback mechanic 2 (Rage and Rage Art): **PARTIAL**

- **Tekken.**
  - Rage activates at a low-HP threshold (T8 season 3: 45 HP or lower) and adds 10% damage.
  - The Rage Art (T8: df+1+2, universal mid, i20, −18 on block) consumes Rage. It has special armor from frame 8 that powers through lows and throws and reduces damage by 25%, and it deals a base of 55.
  - Source: [W-Rage §Rage, §Rage Art/Tekken 8]
- **Brutal Fist.**
  - Enraged state at ≤ 25% HP adds ×1.12 outgoing damage (`RageSystem.ts:39-41,66-79`). It is ticked and applied in the Arena (`Arena:1896-1907,1976,2420`).
  - A `Finisher` (d/f+1+2, available at ≤ 25% HP, 350 damage, **unblockable**) is wired (`FSM:386-399,1169-1170,2187-2189`, `Arena:1573,1826-1832,1898-1899`).
- **Gap.**
  - `spendRageArt`, `rageArtDefence` and `resetRageForRound` have **no callers**, so the finisher has no armor window and is not consumed.
  - `setFinisherAvailable(hpPct)` recomputes availability from HP every frame (`Arena:1573`, `FSM:1169-1170`), so it can be used more than once per round.
  - It is unblockable where Tekken's Rage Art is blockable (−18 on block).
  - The threshold is a percentage rather than an HP value.

### 19. Round end by KO: **IMPLEMENTED** (runtime UNKNOWN)

- **Tekken.** "If your opponent's Health Gauge reaches 0, you win the round." [BN-T8] The recompiled repo's fixtures also show a natural throw KO leading into "the native replay/win sequence" (`tools/JUN_IMPORT.md:123`). The procedural slice ends the round at `health <= 0` (`native/src/game.cpp:140-142`).
- **Brutal Fist.**
  - `GameEngine.isMatchOver()` means either HP ≤ 0 (`src/engine/GameEngine.ts:108`).
  - The Arena resolves the winner and plays the `ko` call, with a `perfect` follow-up at ≥ 99% HP or `great` at ≤ 5%.
  - It records a round result with `PERFECT`/`KO` and calls `resolveRound` (`Arena:3026-3105`).

### 20. Round end by time out: **PARTIAL**

- **Tekken.** "When [the time limit] reaches 0 … the player with the fullest Health Gauge wins." [BN-T8]
- **Brutal Fist.**
  - At 0 the fighter with higher absolute HP wins, and equal HP is a draw.
  - It plays `timeUp`, then the winner or `draw`, and records `TIMEOUT` (`Arena:3119-3172`).
  - Absolute HP equals percentage today, because all 27 roster entries use `hp: 10000` (`src/data/bannonRoster.ts`).
- **Gap.** The timer's length and clock source are wrong (§3). The comparison would silently break if fighters were ever given different max HP.

### 21. Double KO: **PARTIAL**

- **Tekken.**
  - The community wiki states that on a Double K.O. "one round for each of the fighters is won". [FW-DKO, lower confidence]
  - In official tournament rules, a set tied by a Double K.O. or timeout "will not be scored" and is replayed. [BN-TWT]
- **Brutal Fist.**
  - Both HP ≤ 0 is detected. It plays `doubleKo` then `draw` (`Arena:3028-3051`).
  - `resolveRound` treats the result as `draw`, which "burn[s] a round without moving either player" (`RoundSystem.ts:15-18,85-86`), with a 5-round ceiling (`RoundSystem.ts:27,92`).
- **Gap.** Brutal Fist awards nothing where the (community-sourced) Tekken convention awards each player a round. Pick one rule deliberately and cite it.

### 22. Round transition and reset: **PARTIAL**

- **Tekken.**
  - Heat is "granted to all characters at the start of each round" and is unavailable for the rest of the round once consumed. [W-Heat]
  - The recompiled slice resets positions and state but keeps the round number (`native/src/game.cpp:21-31`), after a 2.2 s end delay (`native/src/game.cpp:98-103`).
- **Brutal Fist.** `resetForRound(false)` runs 1800 ms after a non-final round (`Arena:3095,3162`). It restores:
  - HP and the timer;
  - start marks and locomotion;
  - fresh FSMs;
  - movesets and the command buffer;
  - hitboxes and combo state;
  - the announcer flags and the intro cinematic.

  Source: `Arena:477-556`.
- **Gap.**
  - `combatStateRef` (wall splat, heat, momentum) and the rage refs are not reset (`Arena:215-216,576-578`).
  - There is no per-round Heat grant, because Heat does not exist (§17).

### 23. Match end: **IMPLEMENTED** (runtime UNKNOWN)

- **Tekken.**
  - The match is won on reaching the required number of round wins [BN-T8].
  - The competitive standard is first to 3 rounds [TO-Vanta; TO-TMG "3/5 Rounds"].
  - T8 online uses a best-of-3 set structure [Bandai Namco Europe, "What to expect from TEKKEN 8"].
- **Brutal Fist.**
  - `resolveRound` decides the match at `roundsToWin` (default **2**, i.e. best of 3) or at the 5-round ceiling (`RoundSystem.ts:24-27,80-116`).
  - The victory cinematic plays after 800 ms, then `onMatchEnd` and the post-match screen after 3600 ms (`Arena:166,3098-3106,3164-3172`).
- **Gap.** `createRoundState()` is always called with the default (`Arena:440,488`). There is no first-to-3 option, although `CombatArchitectureContract.ts:59` defines a `roundsToWin` rule that the Arena does not read.

---

## 2. Stage table summary

| # | Stage | Status | Runtime |
|---|---|---|---|
| 1 | Pre-round intro and start distance | PARTIAL | UNKNOWN |
| 2 | Round call | IMPLEMENTED | UNKNOWN |
| 3 | Round timer | PARTIAL | UNKNOWN |
| 4 | Neutral spacing and movement | PARTIAL | UNKNOWN |
| 5 | Pokes and whiff punish | PARTIAL | UNKNOWN |
| 6 | Block and on-block advantage | PARTIAL | UNKNOWN |
| 7 | On-hit advantage and hitstun | MISSING | UNKNOWN |
| 8 | Counter hit | PARTIAL | UNKNOWN |
| 9 | Launch and juggle | PARTIAL | UNKNOWN |
| 10 | Wall | PARTIAL | UNKNOWN |
| 11 | Floor and stage breaks | PARTIAL | UNKNOWN |
| 12 | Knockdown, okizeme and wake-up | PARTIAL | UNKNOWN |
| 13 | Throws and breaks | PARTIAL | UNKNOWN |
| 14 | Low and mid mixups | PARTIAL | UNKNOWN |
| 15 | Sidestep, sidewalk and homing | PARTIAL | UNKNOWN |
| 16 | Power crush | PARTIAL | UNKNOWN |
| 17 | Heat (comeback 1) | MISSING | UNKNOWN |
| 18 | Rage and Rage Art (comeback 2) | PARTIAL | UNKNOWN |
| 19 | Round end: KO | IMPLEMENTED | UNKNOWN |
| 20 | Round end: time out | PARTIAL | UNKNOWN |
| 21 | Round end: double KO | PARTIAL | UNKNOWN |
| 22 | Round transition and reset | PARTIAL | UNKNOWN |
| 23 | Match end | IMPLEMENTED | UNKNOWN |

**Counts (code status):** IMPLEMENTED 3 · PARTIAL 18 · MISSING 2 · UNKNOWN 0.
**Counts (runtime status):** UNKNOWN 23 of 23. Nothing is runtime-certified, so nothing here is a PASS.

---

## 3. Prioritized gap list, tied to per-fighter individuality

Most of the flow problems above share one root cause: **the per-fighter moveset data does not carry the fields the flow reads.** `public/motion/movesets.json` covers **11 of the 27** roster fighters, each with 26 moves. Every move has exactly these fields:

```
id, name, command, sequence, stance, clip, startup, active, recovery, damage, contactReach
```

`GeneratedMovesets.ts:43-55` mirrors them. Everything below except P2-3 and P2-4 either needs new fields in that schema, or needs the engine to read a field it already has.

### 3.1 Required per-move frame-data fields

Each fighter's moveset needs these fields for the bell-to-bell flow to work. The **Consumer** column is the engine code that would read the field.

| Field | Meaning (Tekken source) | Consumer today / needed | Present? |
|---|---|---|---|
| `startup` (i-frame, first active frame) | i10 convention [W-Frame] | `hitboxStartFrame`: yes | derived from clip length, not authored |
| `active` | active frames [W-Frame] | `hitboxEndFrame`: yes | derived |
| `recovery` / `total` | recovery [W-Frame] | `totalFrames`: yes | derived |
| `onBlock` | block advantage; −10 punishable, −15 launch-punishable [W-Frame] | `blockstunFramesFor` (`FSM:701`): **field exists, never populated for generated moves** | **no** |
| `onHit` | hit advantage; hitstun > blockstun [W-Frame] | **no consumer**; hitstun = active seconds (`FSM:2519`) | **no** |
| `onCounterHit` + CH property (`launch` / `knockdown` / `naturalCombo`) | CH 120% plus unique CH properties [W-Attack] | `CounterHit.ts` has damage and stun only | **no** |
| `hitLevel` per hit (`high` / `mid` / `low` / `smid` / `throw` / `unblockable`) | guard matrix [W-Attack §Crush; W-Neutral] | `attackLevel` (`FSM:131`): field exists; generated moves rely on geometry derivation | **no (derived)** |
| `launcher` (bool) + `launchType` (`normal` / `high` / `crumple` / …) | [W-Combo §Launcher] | heuristic `reactionForGenerated` (`GeneratedMovesets.ts:117`) | **no** |
| `homing` / `tracking` (`none` / `left` / `right` / `homing`) | [W-Attack §Homing; W-Step] | blanket `isSpecial` → tracking (`Arena:1915`) | **no** |
| `crush` windows: `cs` (high crush), `js` (low crush) frame ranges | [W-Attack §Crush] | `DefensiveWindows` kinds are armor and invincible only | **no** |
| `powerCrush` window (armor frames, levels) | armor from ~frame 7, beats high and mid, not low or throw [W-Attack §Power Crush] | `defence` (`FSM:114`): field exists; only the basic heavy uses it | **no** |
| `wallSplat` / `balconyBreak` / `wallCrush` / `floorBreak` (`spike` / `slam`) | [W-Attack; W-Combo §Break] | velocity-based wall, damage-threshold floor | **no** |
| `tornado` (combo extender, one per combo) | [W-Combo §Combo Extender; W-Attack §Tornado] | none | **no** |
| `knockdown` + resulting ground position (FUFT / FUFA / FDFT / FDFA), `techable` | [W-Wake; W-Tech] | flat `Knockdown` state | **no** |
| `groundHit` (hits downed opponents) | grounded hit, 80% scaling [W-Combo] | none | **no** |
| `stanceFrom` / `stanceTo` (incl. `SS`, `WS`, `FC`, `BT`) | SS stance 42 f [W-Step] | `stance` and `endStance` exist; no SS or WS | partial |
| `throwBreak` (`1` / `2` / `1+2` / `either` / `none`) + `breakWindow` | 20 f default / 14 f CH / 9 f chain [W-Throw] | `breakButton` on 4 catalog throws; universal Escape | partial |
| `heatEngager`, `heatSmash`, `heatBurst` | [W-Heat] | none | **no** |
| `string` links (`cancelInto` / `followups`) with natural-combo / CH-combo flags | [W-Combo §On land combos] | `cancelInto` exists; generated moves get a synthetic P→K partner (`GeneratedMovesets.ts:105-110,180-186`) | partial |

### 3.2 Top gaps, in priority order

**P0: the flow cannot work without these**

1. **Author `onBlock` for every move of every fighter** (§6). Today 241 of 286 generated moves are ±0 on block and none is punishable. Nothing enforces the Tekken ladder (safe at −9, punishable at −10, launchable at −15; W-Frame). Without it there is no block punishment, no pressure and no risk on lows or launchers.
2. **Add an `onHit` field and derive hitstun from it** the same way blockstun is derived from `onBlock` (`FSM:693-716`). Today hitstun = the attacker's active seconds (`FSM:2519-2522`). By our static estimate, 132 of 193 generated weak-reaction hits are *minus on hit*, which inverts Tekken's rule that hitstun exceeds blockstun (W-Frame).
3. **Replace the launcher heuristic with an authored `launcher`/`launchType` flag** (§9). Today 68 of 286 generated moves launch because of their direction or clip name, and all of them are ±0 on block. Tekken launchers are a small, deliberately unsafe or conditional set (W-Combo, W-Frame).
4. **Make homing per move and apply the sidestep gate to both players** (§15). Today every generated move tracks (`GeneratedMovesets.ts:163` + `Arena:1915`), and P2's strikes skip `checkSidestepWhiff` (`Arena:2382-2388`). As a result, sidestep, which is "the defining factor in it being a 3D fighting game" (W-Step), cannot beat most attacks.
5. **Fix throw-break semantics** (§13):
   - generic 1+3 and 2+4 break with either 1 or 2;
   - add a 1+2 break class;
   - lock out on a wrong button, and remove the universal Escape break;
   - one break window, 20 f default, 14 f on CH, 9 f on chain links;
   - back throws unbreakable;
   - throws landed on armor unbreakable (W-Throw).
   Delete or wire the dead `THROW_BREAK_WINDOW_FRAMES = 12`.

**P1: flow depth**

6. **Wake-up and okizeme set** (§12):
   - a landing-time tech-roll window (W-Tech: 10 f input, 32 f roll, 20 f intangible);
   - stay down, side roll, back get-up and quickstand as separate choices;
   - low and mid wake-up kicks (W-Wake);
   - a `groundHit` flag with grounded scaling (W-Combo).
7. **Round timer** (§3): default to 60 s (TO-Vanta, TO-TMG), count simulation frames at 60 Hz instead of `setInterval`, and stop on pause (`isPausedRef` is never read).
8. **Per-move counter-hit properties plus the 120% multiplier** (§8): `onCounterHit`, CH launch, CH knockdown and CH natural combo (W-Attack). Today there is a flat ×1.25 and +0.12 s for every move.
9. **Rage Art correctness** (§18): consume it once per round (wire `spendRageArt`), give it an armor or invincibility window (wire `rageArtDefence`), and make it blockable and punishable rather than unblockable (W-Rage: −18 on block). Tie availability to rage state instead of recomputing from HP every frame.
10. **Heat** (§17): wire `activateHeat` to a 2+3 Heat Burst (a power crush that cannot KO), grant it once per round, add chip on block during Heat, and let each fighter author `heatEngager` moves (W-Heat, BN-T8).

**P2: fidelity**

11. Wall and break properties per move (`wallSplat` / `balconyBreak` / `floorBreak` spike or slam), wall-hit 80% scaling, and the wall-slump → tech sequence (W-Combo, W-Wall). Wire `getWallSplatDamageScale`.
12. A tornado/extender state limited to one per combo, and a juggle scaling curve checked against W-Combo's 70/50/40/30.
13. Power-crush moves per fighter, a 15-frame absorb freeze, and "throw during power crush is unbreakable" (W-Attack).
14. High-crush and low-crush windows as a new `DefensiveWindow` kind (W-Attack §Crush).
15. SS stance, SS attacks and sidewalk hold (W-Step; `PRODUCTION_GAPS.md:32`).
16. Double-KO round-award rule, chosen and documented (§21). Also reset `combatStateRef` and the rage refs per round (§22).
17. A configurable `roundsToWin` (first to 3 for competitive play) read from `CombatArchitectureContract` (§23).
18. Movesets for the remaining **16 of 27** roster fighters. `PRODUCTION_GAPS.md:12-14` already tracks full per-fighter move graphs and identity sets.
19. Label ring-out and ledge-throw KOs as Brutal Fist mechanics, not Tekken parity (§11).

---

## 4. Provenance: which claims come from where

**From the recompiled repo (`mhvnsnt/BrutalfistbaseofTekken3Recompiled` @ `8a23a51`), all cited above in §0.1:**

- It is a recompilation framework whose game logic is generated from the user's disc. The symbol map names only `BootEntry`, and no round, timer or KO routines are named.
- There is a PS1 native round controller with defeat and victory states that replace TTT1's.
- A throw KO leads into the native replay and win sequence.
- Throws are paired, with throw locks, escape links and timed damage. Its own measurements give 30 HP for the 1+3 and 2+4 throws and 40/40/45 HP for left, right and back throws.
- There is a reserved state before paired throw states.
- HP is 16.16 fixed point at actor `+0x3f4` and throw state is at `+0x74`. The actor base is `0x800a9228` with a `0x188c` stride. Fixtures seed 130 HP.
- Jun's jab is active on frame 10 with base damage 4, and 5 HP after 130% hit-location scaling.
- The procedural clean-room slice has a round reset to ±2.4 marks, round end on `time <= 0 || health <= 0`, a 2.2 s end delay, a 0-99 HUD timer and max 5 round pips. This slice is explicitly *not* authentic Tekken 3 logic.

**From public documentation (§0.2):** every Tekken system rule and number in this document. That includes:

- the 60 fps timebase, the i10 jab and the −10 / −15 thresholds (W-Frame);
- counter hit at 120% (W-Attack);
- throw break inputs and the 20 / 14 / 9 frame windows (W-Throw);
- wake-up options and the tech roll's 10 / 32 / 20 frames (W-Wake, W-Tech);
- sidestep, sidewalk and the 42 f SS stance (W-Step);
- homing, power crush (~7 f armor, 15 f freeze), wall splat and tornado (W-Attack);
- combo, wall, grounded and hazard scaling (W-Combo);
- wall slump (W-Wall);
- Heat (W-Heat, BN-T8) and Rage and the Rage Art (W-Rage);
- the timeout rule (BN-T8);
- the 60 s round and first to 3 rounds (TO-Vanta, TO-TMG);
- the double-KO convention (FW-DKO, community) and the tournament tie rule (BN-TWT);
- stage shapes and diagonal starts (W-Stage).

**From our engine (`db752c8`):** every "Brutal Fist" statement, with `file:line`. The on-block and on-hit distributions in §6, §7 and §3 are a static computation that applies the engine's own formulas (`FSM:701-716`, `FSM:2519-2522`, `GeneratedMovesets.ts:117-163`) to `public/motion/movesets.json`. They are **not** runtime measurements.

**Not established by any source here (UNKNOWN):** Tekken's numeric round-start distance; Tekken 3's actual timer, break window and wake-up timings as source code; whether hits during recovery count as counter hits in Tekken; and runtime behaviour of every stage in the PWA.
