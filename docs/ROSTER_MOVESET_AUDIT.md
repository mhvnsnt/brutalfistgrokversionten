# Roster Moveset Audit — per-fighter individuality

Updated: 2026-09-28 · branch `grok/per-fighter-movesets` · base `origin/main` db752c8

Regenerate the numbers:

```sh
git show db752c8:public/motion/movesets.json > /tmp/before.json
node tools/moves/roster_moveset_metrics.mjs /tmp/before.json        # BEFORE
node tools/moves/roster_moveset_metrics.mjs                          # AFTER (all 27)
node --experimental-strip-types --import ./scripts/register-ts-resolve.mjs tools/moves/build_style_movesets.mjs   # pool + rejections
```

## What was actually wired on main (verified, not trusted)

| Claim on main | Verified state at db752c8 |
|---|---|
| Directional f/b+LP/RP/LK/RK, df+light/heavy use catalog frame data | **Not true.** `getMoveById('bf_uppercut')` returned `null`: `BRUTAL_FIST_FULL_CATALOG` is keyed by `'uppercut'`, every roster slot stores `'bf_uppercut'`. `characterMoveWindow` therefore always fell back to `DEFAULT_MOVE_WINDOWS`. The two tests added for it (`frame-rate-input.test.ts` → "directional roster moves are gameplay-owned") **failed on main** (`expected 'Uppercut', actual 'lightAttack'`; `bannon.forwardLight === maime.forwardLight === 'bf_jab'`). |
| Had the lookup worked | The catalog is in **frames** with damage on a /10 scale; `MoveWindow` is **seconds** with engine damage. Spreading it in would have made a jab start in 3 s and deal 8 damage. |
| Per-fighter clips bound at match creation / round reset | Binding ran, but it derived clips via the same failing `getMoveById`, so the clip map was **empty for every fighter**. |
| Directional inputs reach the roster slots at runtime | Mostly **shadowed**: the arena also registers `generatedMoveset()` motion commands (6P, 4K, 3P…) and a matching command wins in `detectSpecialMove` before the directional branch. The directional roster slots only fire when `movesets.json` has not loaded. |
| Neutral LP/RP/LK/RK individuality | **None.** Every fighter used the same `DEFAULT_MOVE_WINDOWS` entry; only the (empty) clip override differed. |
| Generated movesets per fighter | Only **11 of 27** fighters were in `public/motion/movesets.json`; the other 16 had no directional moveset. |
| UAL1/UAL2 in the bank | 89 `UAL1_*`/`UAL2_*` entries exist in `public/motion/baked/index.json` (from `scripts/fetch-open-animation-packs.mjs`). **All are broken**: UAL1 entries measure 0 moving bones; UAL2 entries measure negative/inverted spine and reach. None passes the strike gates; none is promoted. |

## Root cause of "every fighter plays the same moveset"

`tools/moves/map_commands.mjs --full` drew 26 slots per fighter from a measured pool of **30** attack clips with a per-fighter **FNV hash** as score jitter and a keyword `styleBias`. Frame data was a pure function of clip duration, so two fighters on one clip were mechanically identical.

## BEFORE vs AFTER (generated directional table)

| Metric | BEFORE (db752c8, 11 fighters) | AFTER, same 11 fighters | AFTER, full roster (27) |
|---|---|---|---|
| Fighters with a generated moveset | 11 / 27 | 11 | **27 / 27** |
| Slots | 286 | 286 | 702 |
| Roster-wide distinct clips | 28 | 35 | 35 |
| Pairwise clip-set overlap, overlap coefficient avg (min–max) | **0.918** (0.875–1.00) | **0.527** (0.133–0.875) | 0.568 (0.063–0.882) |
| Pairwise clip-set overlap, Jaccard avg (min–max) | 0.835 (0.75–1.00) | 0.345 (0.069–0.70) | 0.381 (0.031–0.739) |
| Fighter pairs with identical clip sets | 1 (onyx = cain_elias) | **0** | **0** |
| Rows where another fighter has the same clip in the same slot | **251 / 286** | **80 / 286** | 635 / 702 ¹ |
| Clips whose timing/damage differs by fighter | **0** | 35 / 35 | 35 / 35 |
| Distinct gameplay for the same input (Ground 6P) | 5 signatures / 11 | 11 / 11 | **27 / 27** |
| Damage range (roster) | 60–101 for everyone | 49–140 | 49–165 |
| Explicit 2–3 hit strings | 0 (derived P→K same-direction only) | 11 / 11 | 27 / 27 |

¹ Pigeonhole: 27 fighters share 13 stance/direction cells × 2 limbs over a 35-clip pool (13 airborne, ~10 compatible per cell), so same-cell reuse is unavoidable at full-roster scale. It is **not** mechanically identical reuse — every such row differs in timing/damage/hit data (next row). Fixing this needs more *measured* clips, not more code; see the intake section.

**Same-input example, Ground 6P.** BEFORE: maime, cipher, onyx and hall_nighter all played `DEFAULTJUMPPUNCH2` at 0.200/0.050/0.133 s, 61 dmg. AFTER:

| Fighter | 6P |
|---|---|
| bannon | BASEBALL_HIT 21/5/36f, 119 dmg, −9 on block, armoured |
| maime | HIGHPUNCH 10/2/9f, 61 dmg, +2 |
| onyx | GRAFSURPRISEPUNCHSLOWER 15/4/23f, 97 dmg, −9 |
| viper | HIGHPUNCH 10/2/9f, 67 dmg, +3 |
| kobra | SHAZLOWRUSH 11/3/15f, 78 dmg, −3 |
| hall_nighter | BOXING__5_ 21/6/35f, 101 dmg, −8 |

(All 27 in `node tools/moves/roster_moveset_metrics.mjs` → `sixP`.)

## What changed (extends the existing architecture — no parallel system)

- `BrutalFistMoveCatalog.getMoveById` indexes by `id` as well as key → roster slots, clip bindings and the customizer resolve again.
- `src/engine/combat/StrikeClipPool.ts` — the measured strike pool, lifted out of `map_commands.mjs` and **widened on measurements only**. The old pool considered only `attack_*`-filed clips (102 → 30 after gates). All refusal gates are kept unchanged (team capture ≥3 bodies, receiver/thrown body, frozen <3 moving bones, inverted spine <0.75, starts on the mat, turned away at contact, >2.2 s, reach floor). Non-`attack` clips are admitted only if they pass every gate, are not in a slot another system owns (hit reaction, knockdown, grapple, block, crouch, locomotion, getup, taunt), are not a measurement twin of a grapple clip, and pass a measured strike test (forward hand / hammer / spin kick). Result 30 → **35**: `ARMADA`, `QUESHADA_2` (spin kicks filed `idle`), `GYAKUZUKI_COMBO`, `SHAZLOWRUSH` (forward-hand), `TIGERDOUBLEHAMMERCOMBO` (hammer). `THROWSTART_STEP` is rejected as a grapple twin.
  - The ~40 strike-*named* clips (`BOXING*`, `BODY_JAB_CROSS`, `ILLEGAL_ELBOW_PUNCH*`, `COMBO_PUNCH`, `TIGERDYNAMOPUNCH*` …) mostly fail on **measurement**: hand reach 0.21–0.30 m (below the bake's 0.35 m strike floor) and/or length 2.0–4.2 s (loops, not attacks). `BOXING__5_`, `BODY_JAB_CROSS` pass via foot reach. Names are not evidence; they stay out.
  - Pool rejections (all 455 clips): inverted 117, frozen 72, too-long 63, receiver 54, not-a-strike 38, owned-semantic 29, no-reach 16, multi-body 12, turned-away 11, starts-on-mat 7, grapple-twin 1.
- `src/engine/combat/FighterStyleProfiles.ts` — canon style table for all 27 fighters (primary/secondary archetype from roster `role`/`fightingStyle`, quoted in `canonBasis` and test-locked against the roster text) + roster speed/strength. Archetypes (grappler, powerhouse, striker, speed, aerial, brawler, martial) own measured-feature clip affinity, frame offsets, damage, reach, hitstun, pushback, on-block, launch, power-crush armour, a neutral string and a directional string. Clip choice: style affinity + authored signature clips + a deterministic roster-diversity ledger. **No hash/random seed.**
- `tools/moves/build_style_movesets.mjs` writes `public/motion/movesets.json(.zst)` for all 27 fighters and `src/generated/RosterStyleClips.generated.ts` (neutral-slot clips). `map_commands.mjs --full` now delegates to it so the predev sync chain cannot regenerate the seeded table. Frame data is built inside the Tekken envelope (startup ≥10f, active 2–6f, total ≤62f), so `calibrate_frames.mjs` must **not** be re-run on the new table (it would re-rank onto one curve).
- `GeneratedMovesets.ts` reads per-row `hitstun`, `pushback`, `launch`, `onBlock`, `attackLevel`, `reaction`, `armor` (→ `powerCrushWindow`) and explicit `string` (→ `cancelInto`; `[]` marks an ender). Older tables still load unchanged.
- `MoveWindow` gains optional `hitstun`, `pushback`, `launch`, `stringFollowups`. `buildHitboxFromMove` and `computeHitStunDuration` honour them; absent, behaviour is unchanged.
- `src/engine/combat/RosterMoveWindows.ts` resolves each fighter's neutral LP/RP/LK/RK, d+P/d+K and roster directional fallback slots: catalog move → engine units (frames +7 startup floor 10; damage `6x+30`) → style tuning; attaches the neutral 2–3 hit string. The FSM uses these for the neutral/crouch branches (`slotWindow`) and the directional fallback (`characterMoveWindow`). `GameBattleArena` binds through one `bindFighterMoveset()` at match creation and round reset (the two duplicated blocks are gone).
- Generated moves no longer all inherit `SPECIAL_HITBOX.launch = 0.5`; launch now comes from the row (rising kicks / launchers only). This is a deliberate gameplay change.

## Per-fighter table (AFTER)

"Distinct" = no other fighter has the same slot + clip + gameplay signature. BEFORE neutral buttons were one shared `DEFAULT_MOVE_WINDOWS` entry for every fighter.

| Fighter | Style (primary/secondary) | BEFORE generated slots (distinct gameplay / total) | BEFORE neutral LP/RP/LK/RK/d+P/d+K | AFTER generated slots (distinct / total) | AFTER distinct clips in set | AFTER neutral LP (frames s/a/r, dmg, oB) | Neutral string | Directional string | Neutral clips MISSING_CLIP |
|---|---|---|---|---|---|---|---|---|---|
| bannon | grappler/powerhouse | 3 / 26 | shared DEFAULT_MOVE_WINDOWS (identical for all) | 26 / 26 | 16 | Jab 11/3/10f, 95, -1 | LP,RP | 4P→6P | none |
| maime | speed/striker | 2 / 26 | shared DEFAULT_MOVE_WINDOWS (identical for all) | 26 / 26 | 16 | Jab 10/3/6f, 64, +1 | LP,LP,RK | 3P→6P→6K | none |
| onyx | powerhouse/brawler | 5 / 26 | shared DEFAULT_MOVE_WINDOWS (identical for all) | 26 / 26 | 15 | Dragon Chop 13/5/13f, 136, -3 | RP,RP | 6P→3K | none |
| cain_elias | grappler/striker | 2 / 26 | shared DEFAULT_MOVE_WINDOWS (identical for all) | 26 / 26 | 20 | Elbow Strike 15/4/17f, 171, -5 | LP,RP | 4P→6P | none |
| stick_up | striker/aerial | 3 / 26 | shared DEFAULT_MOVE_WINDOWS (identical for all) | 26 / 26 | 20 | Jab 10/3/7f, 73, +1 | LP,RP,LK | 6P→6K→9K | none |
| cipher | speed/martial | 2 / 26 | shared DEFAULT_MOVE_WINDOWS (identical for all) | 26 / 26 | 18 | Jab 10/3/6f, 66, +1 | LP,LP,RK | 3P→6P→6K | none |
| echo | aerial/speed | 2 / 26 | shared DEFAULT_MOVE_WINDOWS (identical for all) | 26 / 26 | 20 | Jab 10/4/6f, 66, +0 | LK,RK | 6K→9K | none |
| cody | brawler/powerhouse | 1 / 26 | shared DEFAULT_MOVE_WINDOWS (identical for all) | 26 / 26 | 19 | Jab 10/4/9f, 86, -1 | LP,RP,RP | 6P→4P→6K | none |
| hall_nighter | brawler/grappler | 5 / 26 | shared DEFAULT_MOVE_WINDOWS (identical for all) | 26 / 26 | 19 | Dragon Chop 13/5/13f, 128, -2 | LP,RP,RP | 6P→4P→6K | none |
| static | speed/brawler | 8 / 26 | shared DEFAULT_MOVE_WINDOWS (identical for all) | 26 / 26 | 17 | Jab 10/3/6f, 71, +1 | LP,LP,RK | 3P→6P→6K | none |
| viper | striker/speed | 2 / 26 | shared DEFAULT_MOVE_WINDOWS (identical for all) | 26 / 26 | 17 | Jab 10/3/6f, 70, +2 | LP,RP,LK | 6P→6K→9K | none |
| kobra | brawler/speed | — (not in table: 0 generated moves) | shared DEFAULT_MOVE_WINDOWS (identical for all) | 26 / 26 | 17 | Jab 10/4/6f, 77, +0 | LP,RP,RP | 6P→4P→6K | none |
| aaron_ruben | grappler/martial | — (not in table: 0 generated moves) | shared DEFAULT_MOVE_WINDOWS (identical for all) | 26 / 26 | 17 | Jab 11/3/10f, 86, +0 | LP,RP | 4P→6P | none |
| hollow | speed/powerhouse | — (not in table: 0 generated moves) | shared DEFAULT_MOVE_WINDOWS (identical for all) | 26 / 26 | 21 | Jab 10/3/6f, 71, +0 | LP,LP,RK | 3P→6P→6K | none |
| edwin_kennedy | powerhouse/striker | — (not in table: 0 generated moves) | shared DEFAULT_MOVE_WINDOWS (identical for all) | 26 / 26 | 17 | Elbow Strike 16/5/19f, 181, -6 | RP,RP | 6P→3K | none |
| pablo | powerhouse/brawler | — (not in table: 0 generated moves) | shared DEFAULT_MOVE_WINDOWS (identical for all) | 26 / 26 | 17 | Dragon Chop 14/5/15f, 149, -3 | RP,RP | 6P→3K | none |
| tyneshia | brawler/striker | — (not in table: 0 generated moves) | shared DEFAULT_MOVE_WINDOWS (identical for all) | 26 / 26 | 20 | Jab 10/4/7f, 81, +1 | LP,RP,RP | 6P→4P→6K | none |
| triple_xxx | aerial/striker | — (not in table: 0 generated moves) | shared DEFAULT_MOVE_WINDOWS (identical for all) | 26 / 26 | 21 | Jab 10/4/7f, 73, +1 | LK,RK | 6K→9K | none |
| el_toro_de_oro | aerial/powerhouse | — (not in table: 0 generated moves) | shared DEFAULT_MOVE_WINDOWS (identical for all) | 26 / 26 | 20 | Dragon Chop 12/5/13f, 125, -3 | LK,RK | 6K→9K | none |
| stan_combs | striker/brawler | — (not in table: 0 generated moves) | shared DEFAULT_MOVE_WINDOWS (identical for all) | 26 / 26 | 21 | Jab 11/3/9f, 80, +1 | LP,RP,LK | 6P→6K→9K | none |
| brutus | powerhouse/powerhouse | — (not in table: 0 generated moves) | shared DEFAULT_MOVE_WINDOWS (identical for all) | 26 / 26 | 16 | Dragon Chop 16/5/17f, 159, -4 | RP,RP | 6P→3K | none |
| titan | powerhouse/grappler | — (not in table: 0 generated moves) | shared DEFAULT_MOVE_WINDOWS (identical for all) | 26 / 26 | 17 | Dragon Chop 16/5/17f, 155, -4 | RP,RP | 6P→3K | none |
| master_sensei | martial/striker | — (not in table: 0 generated moves) | shared DEFAULT_MOVE_WINDOWS (identical for all) | 26 / 26 | 19 | Jab 10/3/7f, 81, +1 | LK,RK,RK | 6K→3K→9K | none |
| wreck_patterson | grappler/brawler | — (not in table: 0 generated moves) | shared DEFAULT_MOVE_WINDOWS (identical for all) | 26 / 26 | 20 | Dragon Chop 13/4/14f, 136, -3 | LP,RP | 4P→6P | none |
| jager | brawler/martial | — (not in table: 0 generated moves) | shared DEFAULT_MOVE_WINDOWS (identical for all) | 26 / 26 | 20 | Jab 10/4/7f, 85, +0 | LP,RP,RP | 6P→4P→6K | none |
| finxsse | powerhouse/speed | — (not in table: 0 generated moves) | shared DEFAULT_MOVE_WINDOWS (identical for all) | 26 / 26 | 19 | Jab 10/4/8f, 90, -1 | RP,RP | 6P→3K | none |
| tarzanian_devil | aerial/brawler | — (not in table: 0 generated moves) | shared DEFAULT_MOVE_WINDOWS (identical for all) | 26 / 26 | 20 | Dragon Chop 10/5/11f, 111, -2 | LK,RK | 6K→9K | none |

## Still generic / MISSING_CLIP / UNKNOWN

- **Neutral clips:** every fighter has a style-chosen measured clip for LP/RP/LK/RK/d+P/d+K (0 MISSING_CLIP). Their *visual* fit on each rig is **UNKNOWN** until PWA-tested.
- **Roster directional fallback slots** (f/b+buttons, df) have gameplay data but **no verified clip**: they report `MISSING_CLIP` in `RosterMoveWindows.provenance` and play the semantic slot animation. At runtime these slots are shadowed by the generated 6P/4P/3P… commands whenever `movesets.json` is loaded.
- **Catalog animation names** (`jab`, `uppercut`, `powerbomb` …) are still bound as `characterMoveClips`; only 13/58 name a baked clip. The mesh only plays a clip that exists in the rig's actions, so the rest fall back to the semantic state — honest fallback, not an authored clip.
- **Shared (not per-fighter):** throws (`LEFT/RIGHT_THROW_MOVE`), overdrive, finisher, `AIR_LIGHT/HEAVY_MOVE`, DEFAULT_SPECIAL_MOVES button specials, knockdown/wakeup/hit reactions, sidestep. `command-clips.json` (imported Schwarzerblitz commands) is still the old seeded mapping (tests lock its placements).
- **Pool size is the ceiling:** 35 measured strike clips, 13 airborne; no measured knee/elbow family beyond `TIGERKNEEBASHSLOW`/`KNEETHROW_SLOW`. More clips need a real bake through the #17 intake.
- **Runtime PWA:** untested in a browser for this change.
