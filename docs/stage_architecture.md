# Stage & arena architecture — the measured state of the repository

Every number here was read out of the shipped code, not transcribed from a
design note. The table is generated from `STAGE_CONFIGS` itself; the "what
exists" claims come from grepping the renderers and counting call sites.

Answering the standing directive: *"Extract the current state of all stage and
arena architecture in the repository. Detail the exact specifications, layout,
collision data, and current build status."*

**Every stage named in the directive already exists and is configured.**
Crane Level → `sky_crane`. Subway Transit → `subway`. Acid Pit → `acid_pit`.
Spike Pit → `spike_pit`. Standard Wrestling Ring → `wrestling_ring`. Dojo →
`dojo`. Steel Cage → `steel_cage`. Neon / Crowded Streets → `urban_night` and
`ghetto_streets`. There are 15 in total, not 2.

---

## 1. Where a stage lives

A stage is four things in three places. Nothing loads from disk — there is no
stage GLB anywhere in the repo (`public/stages`, `public/models/stages` and
`public/arenas` do not exist). Every arena is built from Three.js primitives at
runtime.

| Layer | File | What it owns |
|---|---|---|
| Catalogue | `src/engine/combat/StageConfig.ts` | The record: boundaries, levels, hazards, lighting, audio. Pure data + `tickArenaState` (ring-out, floor-break, hazard detection). |
| Mechanics | `src/engine/combat/StageManager.ts` | Floor break, ledge throw, destructible walls, hazard bounce, train hazard. Pure state machines, ~719 lines, no Three.js. |
| Geometry | `src/components/ProceduralStage.tsx` (13 stages), `UrbanNightStage.tsx`, `TrainingStage.tsx` | The meshes. Dispatched from `CombatArena3D.tsx`. |
| Driver | `src/components/GameBattleArena.tsx` | The frame loop that calls all of the above. |

`CombatArena3D` picks the renderer: `urban_night` → `UrbanNightStage`,
`training` → `TrainingStage`, everything else → `ProceduralStage`.
`ProceduralStage` then groups them: `INDOOR` = dojo, wrestling_ring,
mma_octagon, steel_cage, subway; `UNIQUE_OUTDOOR` = industrial,
ghetto_streets, junkyard, sky_crane, spike_pit, acid_pit, grinder_pit,
gang_brawl. Each has its own geometry function (`DojoHall`, `WrestlingRing`,
`OctagonCage`, `SteelCage`, `SubwayStation`, `SkyCrane`, `GhettoStreet`,
`IndustrialFloor`, `Junkyard`, `SpikePit`, `AcidPit`, `GrinderPit`,
`GangBrawl`).

---

## 2. The catalogue, in full

`bX`/`bZ` are half-extents in world units. `∞` = open stage, the edge is a
ring-out. `brkDmg` = single-hit damage needed to smash through to the next
level. `hazVol` = crowd/fence bounce zone (trigger X, chip damage).

| id | name | bX | bZ | ringOut | walls | destr | lv | floorY | brkDmg | hazard | hazVol | train | edge | neon | amb | bgm |
|----|------|----|----|---------|-------|-------|----|--------|--------|--------|--------|-------|------|------|-----|-----|
| urban_night | URBAN NIGHT | 4.5 | 3 | · | Y | · | 1 | 0 | · | · | · | · | 1.5 | 11 | 0.25 | urban_night |
| training | TRAINING GRID | 4.5 | 3 | · | Y | · | 1 | 0 | · | · | · | · | 1.5 | 0 | 0.35 | training |
| dojo | DOJO | 4 | 3 | · | Y | Y | 2 | 0 / -3.5 | 60 | · | · | · | 1.5 | 0 | 0.3 | dojo |
| wrestling_ring | WRESTLING RING | 3.8 | 3.8 | Y | · | · | 1 | 0 | · | · | x>3.5 5% | · | 1.5 | 0 | 0.2 | wrestling_ring |
| mma_octagon | MMA OCTAGON | 4.2 | 4.2 | · | Y | · | 1 | 0 | · | · | · | · | 1.5 | 0 | 0.3 | mma_octagon |
| steel_cage | STEEL CAGE | 4 | 4 | · | Y | · | 1 | 0 | · | · | · | · | 1.5 | 0 | 0.15 | steel_cage |
| industrial | INDUSTRIAL | 5 | 3.5 | · | Y | Y | 2 | 0 / -4 | 50 | 5/s MOLTEN METAL | · | · | 1.5 | 3 | 0.2 | industrial |
| ghetto_streets | GHETTO STREETS | ∞ | ∞ | Y | · | · | 1 | 0 | · | · | x>8 5% | · | 1.5 | 3 | 0.2 | ghetto_streets |
| junkyard | JUNKYARD | ∞ | ∞ | Y | · | · | 2 | 0 / -3 | 55 | · | · | · | 1.5 | 2 | 0.15 | junkyard |
| sky_crane | SKY CRANE | 3 | 2.5 | Y | · | · | 2 | 0 / -6 | 45 | · | · | · | 1.5 | 2 | 0.4 | sky_crane |
| spike_pit | SPIKE PIT | 4.5 | 3 | · | Y | · | 2 | 0 / -4 | 40 | 30/s ⚠ SPIKE PIT | · | · | 1.5 | 2 | 0.1 | spike_pit |
| acid_pit | ACID PIT | 4.5 | 3 | · | Y | · | 2 | 0 / -3.5 | 40 | 25/s ☣ ACID PIT | · | · | 1.5 | 2 | 0.15 | acid_pit |
| grinder_pit | GRINDER PIT | 4.5 | 3 | · | Y | · | 2 | 0 / -4.5 | 35 | 40/s ⚙ GRINDER | · | · | 1.5 | 2 | 0.1 | grinder_pit |
| gang_brawl | GANG BRAWL | ∞ | ∞ | Y | · | · | 2 | 0 / -3 | 50 | · | x>8 5% | · | 1.5 | 2 | 0.2 | gang_brawl |
| subway | SUBWAY | 4.5 | 3 | · | Y | · | 2 | 0 / -1.5 | · | · | · | Y | 1.5 | 3 | 0.15 | subway |

Regenerate it with the script in `scripts/` rather than editing by hand — a
transcribed table goes stale the first time someone adds a stage.

---

## 3. Collision data — what actually stops a fighter

There is **no collision mesh anywhere**. Collision is four scalar rules, all
driven off the numbers above:

1. **Wall clamp + splat** — `WallSystem.checkWallCollision`. A fighter past
   `±boundaryX` while in hit-stun splats (stagger + `WALL_SPLAT_BONUS_FRAMES`
   of combo extension for the attacker); otherwise he is clamped. An open stage
   (`hasWalls: false`, or `boundaryX: Infinity`) does neither — walking off is
   the ring-out.
2. **Ring-out** — `tickArenaState`, only when `ringOutEnabled` and the boundary
   is finite.
3. **Floor break** — `tickArenaState` promotes the fighter's level index when
   he is slammed for at least `floorBreakThreshold`; `StageManager
   .triggerFloorBreak` then runs a four-phase transition (20 frames of debris,
   90 of tracked fall, 30 of landing, flat 30 landing damage).
4. **Hazard floor** — a level with `hazardDamagePerSec > 0` ticks damage while
   the fighter stands on it.

`boundaryZ` is read by `ProceduralStage` for floor sizing only. **Nothing
clamps a fighter in Z.** The depth boundary is decorative today; sidestep
depth is bounded by the locomotion system, not the stage.

---

## 4. Multi-tier transitions

Eight stages are two-level. `LevelZone` carries its own `floorY`, `boundaryX`,
`boundaryZ`, `hazardDamagePerSec` and `label`, so a lower tier can be wider and
more dangerous than the one above it — and several are: dojo 4.0 → 5.0,
industrial 5.0 → (see config), sky_crane 3.0 → a 6-metre drop.

Two shapes exist, and they are not the same mechanic:

- **Smash-through** (dojo, industrial, junkyard, sky_crane, spike_pit,
  acid_pit, grinder_pit, gang_brawl) — `breakableFloor: true`, gated on a
  single-hit damage threshold.
- **Vault-down** (subway) — `breakableFloor: false`, two levels anyway. The
  platform (`TRAIN_PLATFORM_Y = 0`) and the tracks (`TRAIN_TRACK_Y = -1.5`) are
  tiers you move between by choice, under a train on a 10–25 second RNG timer
  with a 2-second warning, a 1-second crossing, a 30-frame vault window and 40%
  unblockable damage on a hit.

**Open question, not a bug yet:** junkyard, sky_crane and gang_brawl declare
BOTH a ring-out and a breakable floor. Which wins on a slam at the edge is
currently whichever check runs first in the frame. Worth deciding deliberately.

---

## 5. Destructible walls

`hasDestructibleWalls` is true on dojo and industrial only. The machinery is
real and wired: `checkWallBreak` (force threshold 180, computed from the
victim's knockback velocity at the moment of wall-splat) → `applyWallBreak` →
`tickDestructibleWalls` (45-frame shatter). It runs from `GameBattleArena`.

What is missing is the *visual*: no geometry function reacts to a broken wall,
so the wall shatters in state and stands unchanged on screen.

---

## 6. Ropes — the honest status

**There is no rope physics in this repository.** `Verlet` appears zero times in
`src/`. `rope` appears three times, all of them prose: a stage-select blurb
("Throw them over the ropes for a ring-out KO"), and two lines of roster text.

`WrestlingRing` builds its ropes as **12 static boxes** — three heights
(0.42 / 0.82 / 1.22) × four sides, each a 0.045-thick `Box` primitive. They
have no collision, no sag, no rebound and no relationship to the fighters. The
ring-out on that stage is the generic `boundaryX 3.8` check plus a 5% chip
hazard volume at x > 3.5; the ropes are scenery the check happens near.

A Verlet rope solver with rebound is therefore net-new work, not a repair.

---

## 7. What is wired, and what is declared but inert

Measured by counting property accesses in `src/`, excluding declarations.

**Live:** `ringOutEnabled`, `boundaryX`, `boundaryZ`, `levels`,
`breakableFloor`, `floorBreakThreshold`, `hazardDamagePerSec`,
`hasDestructibleWalls`, `hazardVolume`, `accentColor`, `subtitle`, `bgmTrack`,
and — as of this pass — `hasWalls`, `hasTrainHazard`, `edgeZoneDistance`,
`neonPalette`/`ambientIntensity`/`ambientColor`/`primaryLightColor`/
`fillLightColor` on `urban_night`.

Those last four groups had **zero readers** until recently. The engine used
module constants (`WALL_LEFT_X`/`WALL_RIGHT_X` = ±4.5, `LEDGE_THROW_PROXIMITY`
= 1.5) or a hardcoded stage id (`stageId === 'subway'`), so editing the
catalogue moved nothing. Only 6 of 15 stages have `boundaryX` 4.5, so the wall
splat was measuring against the wrong surface on 9 of them.

**Still inert:** nothing in `StageConfig` — but see §5 (broken walls have no
visual), §3 (`boundaryZ` does not clamp), and §4 (the ring-out / floor-break
race).

---

## 8. Build status

| Area | Status |
|---|---|
| Stage catalogue | 15 stages, complete, typed, now fully consumed |
| Stage mechanics | 5 state machines, all called from the live loop |
| Stage geometry | 15 procedural builders, no external assets |
| Stage art (GLB/textures) | **none** — no `public/stages` directory exists |
| Rope physics | **none** |
| Broken-wall visuals | **none** — state only |
| Z-axis collision | **none** |
| Tests | 46 cases in `src/engine/combat/stage-boundaries.test.ts`, driven off the real catalogue so a new stage is covered as soon as it is added |

### Next, in the order that buys the most

1. **Broken-wall geometry.** The state machine already fires; only the mesh
   swap is missing. Smallest gap between "declared" and "visible".
2. **Decide the ring-out / floor-break race** on the three stages that declare
   both.
3. **Verlet ropes** for `wrestling_ring` — genuinely new, and the one thing a
   wrestling game is judged on.
4. **Z-axis bounds**, so `boundaryZ` means something and sidestep has a stage
   to be bounded by.
5. **Stage art pipeline.** Nothing loads from disk today; a CC0 prop drop needs
   a `public/stages` directory and a loader before it can land.
