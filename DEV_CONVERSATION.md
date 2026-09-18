# Brutal Fist — dev conversation

## 2026-09-18 — Schwarzerblitz's fighting set imported; what the Tekken 3 repo actually holds

Owner: "let's get all the um animations and combat and movement and locomotion from night sky engine
and Schwarzer blitz and my tekken repo and all that all pulled in i got permission to use all of
that stuff." Surveyed all three against what is actually in them, rather than assuming.

### SCHWARZERBLITZ — 166 clips imported, the real win

`bin/media/common/animations/*.x`. Measured: 236 of the 245 `.x` files in the checkout carry an
`AnimationSet`, and they are the TEXT flavour (`xof 0303txt 0032`), so they parse directly — no
Blender, no converter. The 166 under `common/animations` are a complete fighting set: stances, walk,
walkFast, running, four sidesteps, jumps and jump attacks, guards, strikes, throws **with their
receiver halves**, hit reactions, landings, rollouts and a wake-up.

**The quaternion convention was measured, not trusted.** A `.x` rotation key is `(w, x, y, z)` and in
the DirectX convention is the CONJUGATE of the rotation — get it wrong and every motion plays
mirrored, silently, which is the failure `docs/mocap_orientation_master_prompt.md` warns about. So
each bone's first rotation key was compared against the rotation decomposed from that same bone's own
`FrameTransformMatrix`, as-is and conjugated. Over axeKick.x's 41 bones, **39 matched only as the
conjugate** (dot 1.000 against 0.000); the two that did not are the root frames carrying the armature
transform.

**Frame rate read from the engine, not guessed:** `FK_BasicAnimationRate = 24.0` in
`SchwarzerblitzEngine/FK_Database.h`, used as the default in `FK_Character.cpp` and
`FK_DatabaseAccessor.cpp`.

**The bone map was derived from the Frame hierarchy in the files**, which settles what names cannot:
`Armature_Hips` is the true pelvis (both legs AND the spine branch from it), `Armature_Torso` is the
chest (both arms AND the neck branch from it, so it maps to mixamorigSpine2), and `Armature_Hips_001`
is a root offset above the pelvis and is deliberately left unmapped — as are the eight IK helper
frames and the finger and thumb chains. This rig has a two-segment spine against Mixamo's three and no
clavicle, so **19 of the 22 runtime bones are driven** and mixamorigSpine1 plus both shoulders hold
their bind rotation. It went into `boneNameMap.mjs`, the same single translation layer, so the sync
and the runtime cannot disagree.

Verified the import is semantically right, per clip, by which bones actually travel:

    WALK       RightUpLeg 359° LeftUpLeg 41°      RUNNING    both legs + arm swing
    HIGHPUNCH  LeftArm 329° LeftForeArm 84°       UPPERCUT   LeftArm 351° Forearm 122°
    AXEKICK    LeftUpLeg 359° LeftLeg 106°        GUARD      RightArm 334° both forearms
    JUMP       both legs                          THROWSTART both arms

Punches move arms, kicks move legs, guards move both arms, jumps move both legs. Nothing is inverted.

`buildClipsFromEulerBank` was extracted from `BannonMotionBank` so both banks share one bone
resolution, one Euler order and one track construction, and both go through
`applyBindRelativeQuaternionTracks` — their rest pose is not this GLB's, so the motion is re-based
onto the target's bind pose rather than written onto it absolutely. The locked orientation contract
is unchanged.

**Aliases are appended, never reordered.** Resolution takes the first alias whose NAME is present, so
inserting these ahead would silently change which move a state plays. They sit at the end as
fallbacks; 75 entries added across 22 states.

VERIFIED IN THE RUNNING GAME, not on paper: clips reaching a fighter **244 -> 307**, authored 236 ->
299, `height=1.850 forwardCorrection=0° floorY=0.0000` unchanged, verdict PASS, 0 page errors.

COST, stated plainly: the cached bank is 4.92 MB and the client combat chunk went **5,056 kB -> 9,319
kB (gzip 1,034 -> 1,531 kB)**. That is still far below the 36,476 kB (gzip 4,487 kB) this arc started
at, but 166 clips are not free and this should be split or lazily loaded before it ships to a phone.

### NIGHTSKY ENGINE — nothing importable, and that is not a failure

2,236 `.uasset` files and no FBX, BVH, GLB or `.x` anywhere. Unreal binary assets cannot be read
without Unreal to export them, so there is no animation here to pull into a Three.js runtime. Its
value is what `AnimationSourceRegistry.ts` already records: an MIT-licensed fighting **framework** —
architecture, state machines, frame data — reference rather than assets. Porting that is a separate
piece of work with a different shape, not an import.

### TEKKEN 3 RECOMPILED — the repo contains the DECODER, not the animation

`mhvnsnt/BrutalfistbaseofTekken3Recompiled`, cloned and surveyed (361 MB): 308 `.py`, 247 `.h`,
225 `.c`, 132 `.cpp`. It is a PS1 recompilation project. `src/tekken3_jun_motion.c` and
`tools/ttt1_motion.py` decode "System 12 TTT1 joint motion from a verified local ROM bank" — 57
channels to an 18-bone skeleton — and `tools/prepare_jun_import.py` reads
`verified(work / "ttt1/bankedroms.bin", BANK_SHA)`.

**That ROM is not in the repository, and no decoded pose data is committed.** So there is nothing to
import from it today: the animation lives in a dump the owner would have to supply locally, and the
repo holds the format knowledge and the decoder. This matches what the registry already says —
"TEKKEN_TOOLING — importer/retargeting reference, NO proprietary bytes". If the owner puts his own
`ttt1/bankedroms.bin` in place, that decoder is the path, and the 57-channel / 18-bone pose format is
the seam to retarget from.

## 2026-09-18 — BANNON's skin and trunks were painted from the same texels

Owner: "that model of Bannon, it has like parts on the texture ... part of the skin is on the trunks,
part of the trunks is on the skin, it's like making weird jacket like vein or lightning like crack
strikes all over him and he's not supposed to look like that." He was exactly right, and the cause is
the UV map, not the texture or the rig.

**MEASURED, with a control group** (`scripts/uv-audit.mjs`, banked):

    model                     UV area/sheet   overlap   max tris/texel   stretched
    BANNON_rigged.glb BEFORE      27.81x       98.6%          83           13.58%
    VIPER.glb      (control)       0.64x        0.2%           3            0.26%
    BRUTUS.glb     (control)       0.64x        0.4%           5              -
    BANNON.glb     (donor)         0.64x        0.1%           5              -

98.6% of the body's texels were shared by two or more triangles, up to **83 triangles on one texel**,
and the sheet was covered nearly 28 times over. Different body parts were literally reading the same
pixels. No texture can show two things at one texel, so this was never fixable by dilating, repacking
or re-baking the image — and the "cracks" were island edges, not paint.

`BANNON_rigged.glb` was the only model in the set with this defect, and it is the default player model.

### The correct UVs already existed

`BANNON.glb` — the 15-part rigid model `BANNON_rigged` was sewn from — carries the **same atlas**,
byte-identical (md5 `6f520f2dcdd9df59bef0f48c80d96631`), with a clean unwrap and the same geometry in
the same space (bbox 0.414 x 1.88 x 0.887 against 0.413 x 1.88 x 0.888).

### WHY ONE UV PER VERTEX CANNOT FIX IT — the actual mechanism

First attempt wrote one repaired UV per target vertex. **Overlap went 98.6% -> 99.1%: no better.**
Measuring the donor explained why. Every one of its 15 parts spans nearly the whole sheet
(chest u[0.003,1.000] v[0,1], head u[0.005,0.991] v[0,1]) while contributing only ~0.03-0.09 of a
sheet in area — the atlas is hundreds of small islands interlocked across the whole sheet, so UVs are
per-triangle-CORNER and the donor duplicates vertices along every island boundary to carry them.

The sew welded those duplicates back together. `sew_rig` fuses vertices sharing a position and
agreeing on normal, and **does not require a matching UV**, so a vertex that belonged to five islands
came out holding one. That information does not fit in one UV per vertex.

So `scripts/fix-uv-from-donor.mjs` **splits instead of overwrites**: each target triangle is matched to
the donor triangle at the same place and facing the same way, each corner takes that donor corner's UV,
and a vertex is duplicated once per distinct UV it needs. Position, normal, JOINTS_0 and WEIGHTS_0 are
copied verbatim from the vertex being split, so every copy keeps its skinning.

**A bijection, not three independent nearest-corner lookups.** Assigning each corner its own nearest
donor corner lets two corners pick the same one, which collapses the UV triangle to zero area and
renders it as a flat speck of whatever colour sits there. Measured: 36.18% of triangles came out more
than 20x off the median uv/world area ratio. Scoring all six corner permutations and taking the best:
**36.18% -> 1.26%** (VIPER 0.26%).

    BANNON_rigged.glb   UV area 27.81x -> 0.63x   overlap 98.6% -> 18.5%   max tris/texel 83 -> 17
                        stretched 13.58% -> 1.26%   vertices 14,050 -> 23,885   4.2 MB -> 5.65 MB

**Rigging, scale and orientation are untouched by construction** — only the vertex buffer and indices
are rewritten, from the model's own data. Verified in the running game, not just on paper:
`SkinnedMesh "BANNON_SEWN" bound to skeleton with 58 bones`, 1397/1397 channels resolved across 30
clips, `height=1.850 forwardCorrection=0° floorY=0.0000` — identical to before — verdict PASS, 0 page
errors, and the body deforms correctly mid-attack.

**Looked at it, before and after** (owner law): the lightning-crack strikes across the chest, abs, arms
and thighs are gone, the trunks are solid black instead of smeared with skin, and the knee pads, boots
and wrist tape are clean.

HONEST RESIDUAL, not buried: about a dozen small dark specks remain on the abs and thighs — individual
triangles whose nearest donor triangle belongs to a neighbouring island, because the sewn mesh and the
donor are not the same triangulation (17,998 vs 17,984). Overlap at 18.5% is still above a healthy
model's 0.2%. The file also grew 1.4 MB because the repaired attributes are written uncompressed and
the superseded meshopt buffer views are left in place; stripping those is worth doing before this ships
in the APK bundle.

### Also fixed on the way: the arena reported MISSING_CLIP for a clip that was playing

Driving the real screen, state 1 of 12 showed "MISSING_CLIP — no animation for this state" while states
2-12 were fine. The load path hardcoded `idle`, played it, and never called `onClipChange`; the
state-change effect is what reports, and it only runs when the state CHANGES — the model arriving is a
ref mutation, which re-renders nothing. So the panel claimed no animation existed for the state whose
clip was running the whole time. A false "no animation" in the screen built to judge animation health
is the mirror of the false-success problem this project keeps hitting. The load path now resolves and
reports whatever state is actually being shown, and claims it so the effect does not restart it.

## 2026-09-18 — the gate could not see a frozen clip; now it can

`AnimationIntegrityGate` counts clips, tracks, resolved tracks and bone travel. **None of those can
see a clip that binds every bone, resolves every track, and then holds a pose on all of them.** That
is the `HURRICANE_KICK` shape found in the previous entry, and it passes every count-based check there
is. Extended the project's existing instrument rather than writing a fourth one.

- `ClipSourceSummary.movingTracks` — per clip, how many tracks' values actually change. Quaternion
  tracks are compared as an angle (~2°) so the threshold means the same thing on every track.
- `staticClipNames` + a `STATIC_CLIPS` warning naming every clip that binds tracks and animates nothing.
- `ACTIVE_CLIP_IS_STATIC` when the clip that is *playing* is one of them — the fighter visibly frozen,
  which is the symptom this project keeps chasing.

**Deliberately a warning, not a failing check.** `BLOCKED` means "no usable authored animation" and has
its own caller path in `FighterMesh`; a usable clip that happens to animate nothing is not that. Instead
it drops the verdict to `UNKNOWN`, which honours the gate's own rule — *UNKNOWN is never PASS* — so a
frozen fighter can never be reported as a pass. Nothing about playback changes; the gate is diagnostic.

`scripts/animation-integrity-static.test.mjs` builds a real skinned rig and three clips: fully frozen,
fully animating, and the root-only shape. It asserts the trap explicitly — the frozen clip's tracks
still *resolve*, which is why resolution counts never caught this — and that a playing frozen clip
cannot read PASS. Note the root-only clip is correctly **not** called static: one track does move, and
the gate reports the honest 1-of-4 rather than overstating it.

### Checked and closed: the 770 unindexed clips are not a gap

Before chasing them, measured what the game actually asks for. Across `SEMANTIC_STATE_ALIASES` and
`BannonEulerMotionAdapter`, 132 clip-name aliases: **127 reachable through the index, 0 on disk but
unindexed**, and 5 absent — `T_1`, `T_2`, `T_3`, `T_4`, `T_1_3`, which are Tekken-source naming, not
Bannon clips. So the 770 unindexed files are not what the game is missing, and indexing them would only
add unused weight to the bundle. Nothing to do here; recorded so nobody re-derives it.

## 2026-09-18 — the last dead clips: one translation layer, and the owner's own map

The previous entry left 59 clips on a `J_` rig and one outlier. Rather than derive the cross-rig
correspondence from the bone names, found that **the owner had already measured it**: `ALT_BONE_NAMES`
in `mhvnsnt/Bannon` `tools/mocap/move_sheet.py`, written against a reference skeleton, with a comment
recording the identical failure — *"Feeding those names to a Mixamo reference skeleton matches nothing,
so every key came back as the untouched rest pose."* Same bug, same repo, already solved once.

It settles the two correspondences a name alone does not: `J_Clavicle` is the clavicle and `J_Shoulder`
is the **upper arm**; `J_Knee` is the **shin** with the thigh above it. Extended for the spelling this
bank actually uses (`J_Leg`/`J_Foot` where the source map says `J_Thigh`/`J_Ankle`) plus `J_Toe`.

A name map alone would not be enough across two rigs — a rotation is relative to its bone's rest
orientation. It is correct here only because the clip is then re-based onto the target's bind pose by
`applyBindRelativeQuaternionTracks` (`q_bind x q_src(0)^-1 x q_src(t)`), the project's locked contract.

**`src/engine/retarget/boneNameMap.mjs` is now the single translation layer**, imported by the runtime
(`BannonMotionBank.ts`) and the build-time sync alike, so the cache and the runtime cannot drift. The
repo already imports a shared `.mjs` into TypeScript this way (`src/lib/db.ts`).

### THE MAP SHIPPED WITH A LANDMINE IN IT, AND THE COLLISION CHECK CAUGHT IT

The source map contains `'root': 'mixamorighips'`. Measured across this bank: **46 clips carry BOTH
`Root` and `J_Hips`**, and **0 carry `Root` without a real hips bone**. In `SUPLEX`, `Root` sweeps a
full 2π on rx while `J_Hips` reads like a pelvis — `Root` is the world transform. Taking it as the
pelvis would have spun the whole body, and *which of the two won would depend on key iteration order*.
Dropped, with the measurement written next to it. Re-verified: **0 collisions** bank-wide.

This is the second time the collision check earned its place. Run it before adding any bone mapping.

    clips building real tracks     141 -> 200 of 201
    clips building zero tracks      60 -> 1  (SHELBYIKRIG_ARREGLADO, its own convention)
    clips with all 22 bones                 151
    generated cache                4.1 MB -> 5.8 MB (still 7.6x under the original 44.4 MB)
    client combat chunk            2,428 kB -> 5,056 kB (vs 36,476 kB before this arc)

Verified as real angular travel per bone, not as tracks that merely exist: CARTWHEEL 22/22 moving,
peak 174° on Hips; SUPLEX 22/22, 171°; TOMBSTONE 22/22, 171°; CROTCHCHOP 22/22, 92° on RightHand;
TAUNT 22/22, 116°. `BOXING` unchanged at 22/22 as the control.

`scripts/bone-name-map.test.mjs` locks all of it, including the `Root` guard.

### A SECOND DEFECT CLASS THE FIX EXPOSED — a clip can bind every bone and still hold a pose

With the naming fixed, 9 clips bind bones and animate nothing. Eight are bind-pose character exports
(`Y_BOT`, `LOLA_B_STYPEREK`, `PASSIVE_MARKER_MAN`, `PALADIN_J_NORDSTROM`, `PUMPKINHULK_L_SHAW`,
`CH06/CH24/CH44_NONPBR`) — Mixamo's own reference models, correctly inert.

**The ninth is a real move: `HURRICANE_KICK`.** Measured at source: every bone reads a span of exactly
0 on all three axes except the hips, which sweep ~180° on all three. A frozen body spinning in place.
It is untouched by any change in this arc — it is canonical `mixamorig*` and always resolved — so this
is a pre-existing defect in the source capture.

It matters because `HURRICANE_KICK` is the **first** alias for both `attack_2` and `attack_rk`, and
`FighterMesh` resolves a state by first alias whose *name* is present, never checking for motion. So
heavy kick has been a spinning statue. **Alias order deliberately left alone** — which move a state
plays is the owner's call, not a bug fix. The sync now warns on every build, naming any clip that binds
bones but holds a pose, so this class cannot go quiet again.

### Still open

- `HURRICANE_KICK` needs a re-capture, or `attack_2`/`attack_rk` need a different first alias.
- `SHELBYIKRIG_ARREGLADO` uses a third convention again (`Foot_L`, `BreastL`, `RingFinger_R002`);
  one clip, left unmapped rather than guessed at.
- 770 clip files in the checkout are still absent from `index.json` and unreachable by the game.
- `ZONE_SLIDE_IN_TEST` is indexed with no file behind it.

## 2026-09-18 — 50 clips animated nothing because of a colon in the bone names

The previous entry left 110 of 201 indexed clips building ZERO tracks. Measured what skeleton they
actually use, rather than assuming they were all foreign rigs:

    "mixamorig:"  49 clips   Maya/FBX namespace separator
    "mixamorig9"   1 clip    Mixamo's auto-number for a second rig
    "J_Hips" rig  59 clips   a different skeleton (VRoid-style body + F_ facial bones)
    other          1 clip    SHELBYIKRIG_ARREGLADO

**50 of them were Mixamo all along.** `QUATERNION_BONE_NAMES` is an exact-match set, so
`mixamorig:Hips` matched nothing and every bone was filtered out. The 49 `mixamorig:` clips are not
incidental — they are the project's own content: the whole `ZONE_` ring-transition set (slide in/out,
over the top, apron hop, vault, climb, perch, midrope), the `LOCO_`, `STANCE_` and `GUARD_` sets, the
four `TAUNT_` entries, and the owner's own captures — `TIGER_FEINT_KICK`, `JUNGLE_JUICE`,
`TZ_SCOOP_SLAM`, `TZ_TILT_WHIRL_SLAM` and their `__RECV` halves.

`canonicalBoneName` collapses the namespace (`/^mixamorig[0-9:_\-.\s]*(?=[A-Z])/` -> `mixamorig`),
in `scripts/sync-bannon-motion.mjs` and in `BannonMotionBank.makeClip` so a clip arriving by any other
route binds identically.

**Checked for the failure this could cause before applying it:** if one clip held two rigs, collapsing
the namespace would merge an attacker's skeleton onto a receiver's. Measured across the whole bank —
**0 collisions**; no clip has two distinct raw bones landing on the same canonical bone. Canonical
names are returned unchanged (verified against all 22).

    clips building real tracks     91 -> 141
    clips building zero tracks    110 -> 60
    generated cache               2.8 MB -> 4.1 MB (still 10x under the original 44.4 MB)

Verified on the rebuilt clips, counting bones that actually move rather than tracks that merely exist:
`JUNGLE_JUICE` 14 tracks / 14 moving / 2.15 s, `TIGER_FEINT_KICK` 14 / 14 / 4.22 s, `ZONE_OVER_TOP_IN`
17 / 17. `BOXING` (the control, already working) is unchanged at 22 / 22. `CH06_NONPBR` builds 22
tracks with 0 moving over 0.03 s — it is a single-frame reference pose, correctly inert.

### What this does and does not change in play — measured against the real resolver

`FighterMesh` resolves a state by taking the first alias **whose name is present**; it never checks
whether that clip has tracks, so a present-but-empty clip wins and the fighter does nothing. Walking
every entry in `SEMANTIC_STATE_ALIASES` against the bank, exactly one state's first resolvable clip
went from silent to animated:

    crouch -> STANCE_CROUCH   0 -> 17 tracks

The other 49 recovered clips sit behind an alias that already resolved to a working clip. They are now
*available* — a character can equip `TIGER_FEINT_KICK` as a signature, the `ZONE_` transitions can be
driven — where before they were present but empty. That is the honest scope: one state fixed outright,
fifty clips made usable.

### Still open after this pass

- **59 clips on the `J_` rig** (`J_Hips`/`J_Spine1`/`J_Spine2`/`J_Chest`/`J_Neck`/`J_Head` plus `F_`
  facial bones) — all 59 share one skeleton, so one bone map would recover them. That is a semantic
  cross-rig map, not a namespace strip, and a wrong spine correspondence twists the torso, so it wants
  its own pass with the hierarchy verified rather than guessed. Mostly taunts: CROTCHCHOP, CARTWHEEL,
  RAPIDCHESTBEATING, TAUNT, TAU_*.
- 770 clip files in the checkout are still absent from `index.json` and unreachable.

## 2026-09-18 — The repo could not install; the motion cache shipped 40 MB the runtime discards

Four measurements, four fixes. Every CI gate (`npm install` / `typecheck` / `test` / `build`) was red
before this pass, starting with the first one.

**1. `package.json` asked for seven versions that do not exist on npm.** `npm install` and `npm ci`
both died on `@radix-ui/react-alert-dialog@^1.2.12`. Measured against the registry: 1.1.23 is the
*latest published* version — there is no 1.2.x. The same for react-avatar (^1.3.3 → 1.2.6 latest),
react-collapsible (^1.2.12 → 1.1.20), react-dropdown-menu (^2.2.0 → 2.1.24), react-popover (^1.2.3 →
1.1.23), react-toggle-group (^1.3.3 → 1.1.19) and @tanstack/router-plugin (^1.170.0 → 1.168.40).
`package-lock.json` already held the real (latest) versions, which is why the two files disagreed and
`npm ci` refused. Ranges corrected to the published versions; `next` was also in `package.json` but
never in the lockfile, so the lockfile is regenerated with it.

**2. Two copies of three-mesh-bvh, each augmenting `THREE.BufferGeometry`.** drei pins ^0.8.3
(`computeBoundsTree` returns `MeshBVH`), the app uses 0.9.15 (returns `GeometryBVH`). Both global
augmentations merge, so the property has an intersection type no single implementation satisfies —
one TS2322 in `BoneHitboxSystem.ts`. Verified 0.9.15 still exports every symbol drei imports
(`shaderStructs`, `shaderIntersectFunction`, `MeshBVHUniformStruct`, `SAH`, `acceleratedRaycast`) and
deduped with an `overrides` entry. One copy, one augmentation, no cast needed.

**3. Eight share-card tests failed because they read this repo as their fixture.** `injectGrokPwaHead`
defaults `cwd` to `process.cwd()`, so `src/lib/og/site.json` ("Brutal Fist"), `public/og.jpg` and
`public/x-banner.jpg` were picked up as the baked site identity — a test asserting the document title
wins got the branded title instead. The implementation is correct (a game named Brutal Fist *should*
share as Brutal Fist); the tests simply lacked isolation, while the same file already used
`cwd: mkdtempSync(...)` elsewhere. They now read from an empty workspace. No shipping behaviour moved.

**4. The generated motion cache shipped 42.4 MB, of which the runtime reads 2.8 MB.**
`BannonMotionBank.makeClip` builds one QuaternionKeyframeTrack per bone in a 22-name list and ignores
everything else. The source clips also carry a `pose` block (19 IK joint positions, read by nothing —
`MixamoFightingMotionBank`'s `key.pose` is its own authored data, not this) and, on tag and cloth
captures, up to **1003** bone entries for second bodies and cloth rigs the target skeleton does not
have. The sync cached whole files, so ~40 MB of tracks that `makeClip` discards at load went into the
browser bundle.

`scripts/sync-bannon-motion.mjs` now caches exactly what the runtime consumes. **Proven lossless, not
assumed:** the 201 clips were rebuilt through `makeClip`'s exact algorithm from both the full source
and the pruned cache and compared track-by-track — 201/201 identical, 2002 tracks, same names, times,
values and durations. Nothing is deleted; the full clips are untouched in `mhvnsnt/Bannon`.

    client combat chunk   36,476 kB (gzip 4,487 kB)  ->  2,428 kB (gzip 487 kB)
    generated cache       44.4 MB                    ->  2.8 MB
    client build          48.3 s                     ->  2.5 s

The sync also reads a **local `mhvnsnt/Bannon` checkout** when the workspace has one attached
(`BANNON_REPO` or a sibling directory) and falls back to the pinned raw.githubusercontent commit, then
to the existing cache. Local: 1.3 s and no network; a clip listed in `index.json` but absent is now
named instead of reported as a 404.

### Measured and left open, deliberately — do not re-derive

- **110 of the 201 indexed clips build ZERO tracks.** Their source skeletons are not `mixamorig*`
  named (TAUNT, CROTCHCHOP, CARTWHEEL, TAU_*, RAPIDCHESTBEATING…), so every bone is filtered out and
  the clip animates nothing. The sync now warns with the names. This is the next system.
- **770 clip files in the Bannon checkout are not listed in `index.json`** and therefore never reach
  the game at all (973 on disk, 202 indexed).
- `ZONE_SLIDE_IN_TEST` is in `index.json` with no file behind it, in the checkout and at the pinned
  commit alike.
- 73 of 48,048 source rotations (4 clips) omit an Euler component. `THREE.Euler` already defaults a
  missing argument to 0, so this was **not** producing NaN; the cache now writes the 0 explicitly so
  the triple is complete and typed.
- `npx eslint .` reports 114 problems (21 errors). Identical count before and after this pass — all
  pre-existing, and lint is not part of the CI gate.

## 2026-09-16 — Don't touch unrequested axes; raise fighters not FX; un-statue

Historical note from the earlier v8 work. The values in this entry are superseded by the locked v10 project contract in `AGENTS.project.md` / `src/engine/V7OrientationContract.ts`: combat fighter Y is **0**, hit FX worldY is **1.05**, and combat yaw remains P1 **0** / P2 **π**. Do not resurrect the older Y/FX values.

## 2026-09-16 evening — reattach bank clips, Tekken stick, unique arenas

Living-statue: idle auto-play + attack-reset-every-frame were killing punches. Hard-cut other mixer actions on combat/locomotion; lastPlayedTriggerRef only restarts on trigger increment; auto-play idle effect removed. Bank clips still bind-relative (`q_bind * q_src(0)^-1 * q_src(t)`). Mixer indexes SEMANTIC_STATE_ALIASES + COMBAT_STATE_TO_SEMANTIC.

Tekken stick: tap up = jump (after 220ms double-tap window); double-up sidestep −Z (away); double-down +Z (toward cam); f,f dash / hold run; b,b Korean backdash; hold down crouch; air control after jump. Jump Y now actually updates the mesh (was copying the ref before comparing). Training arena locked. Other arenas unique geometry + stage-colored fog (was all `#050508`).

## 2026-09-16 — Brutal Fist Grok v10 export verification

Repository `mhvnsnt/brutalfistgrokversionten` is now the active exported workspace on `main`. The project retains the Bannon GLB roster, PS1/Tekken presentation, native skeletal animation path, and locked combat orientation contract. `vite.config.ts` already provides the Vite compatibility shim for `next/dynamic` and the required `0.0.0.0:8080` preview contract.

Added `.github/workflows/brutal-fist-ci.yml` to verify Node 22 dependency installation, TypeScript, tests, and the production build on pushes and pull requests to `main`. This is verification infrastructure only; no fighter assets, authored skeletal data, yaws, floor placement, FX positions, or presentation values were changed.

## 2026-09-16 — v10 contract cleanup

The first imported historical log entry contained stale v8-era combat Y/FX values. It has been corrected above so future agents do not mistake those historical numbers for the current locked v10 contract.

## 2026-09-16 — Reattach the real Bannon motion bank without moving fighters

The old `SOURCE_REGISTRY.json` referenced `/motion/*.json`, but those files were not actually present in the v10 export. The source clips do exist in the owner-granted `mhvnsnt/Bannon/assets/moves/clips` bank; the index records real durations, 24-key samples, and 52-bone Mixamo motion for clips such as `BOXING`, `HURRICANE_KICK`, `CENTER_BLOCK`, `HIT_REACTION`, `FALLING_FLAT_IMPACT`, `SUPLEX`, and `DWARF_WALK`.

Added `scripts/sync-bannon-motion.mjs` to pull the real owner-granted clip bank at dev/build time and cache it as `src/generated/BannonMotionBank.generated.ts`. This is not a replacement procedural animation system: the source motion is the existing Bannon motion bank.

Added `src/engine/retarget/BannonMotionBank.ts` and wired `animation_bridge/retarget.ts` so the source clips are converted to quaternion tracks, retargeted by bone-name identity, and then applied with the locked bind-relative formula:

`q(t) = q_bind × q_src(0)⁻¹ × q_src(t)`

The correction is local to bone rotation tracks. It does not modify fighter world position, world yaw, scale, floor placement, camera, or FX. Every imported clip is also kept addressable by its exact authored name so character-specific move slots can request their individual clips instead of collapsing everything into one generic attack.

The semantic table already contains aliases for locomotion, punches, kicks, guard, hit reactions, knockdowns, getup, grapples, run/dash/backdash, and several of the Bannon clip names.

## 2026-09-16 — Fix the first-tap directional bug

`src/engine/combat/TekkenInput.ts` had a real edge-case bug: the first `UP` press could be interpreted as a double-tap because the previous-tap timestamp started at `0` and the opening game clock can also be below the 220 ms double-tap threshold. The detector now requires `last > 0` before a second tap can count.

The directional contract remains: single UP = jump, UP+forward/back = directional jump, forward/back can be pressed after takeoff for air control, double-UP = sidestep away from camera, double-DOWN = sidestep toward camera, F,F = dash, hold after F,F = run, B,B = Korean backdash, hold after B,B = fast backward run, and held DOWN = crouch.

## 2026-09-16 — Rocket compatibility surface

Added a minimal Next.js application surface (`app/layout.tsx`, `app/page.tsx`, `next.config.ts`) and the Next.js dependency/scripts while retaining the existing Vite 0.0.0.0:8080 preview as the primary live game path. `app/page.tsx` exposes the existing `src/App.tsx` rather than creating a second game implementation. This is specifically to give Rocket a recognized Next.js + TypeScript project surface without replacing the working PWA architecture.
