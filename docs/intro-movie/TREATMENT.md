# Brutal Fist — Game Intro FMV: TREATMENT v2

Status: **DRAFT v2 (rev. round 2, 2026-09-28 CT)**, built on `DIRECTOR_BLUEPRINT.md` (owner, 2026-09-28 3:32 PM CT), which supersedes v1.1 on story and shots. v1.1 is archived at `TREATMENT_v1.1.md`. Round-2 owner decisions are logged in §10b, and the God Within research is in `GOD_WITHIN_RESEARCH.md`. Nothing here is published.
Format: **1800 frames = 60.0s at 30fps**, 1080p, 16:9. High-poly, un-decimated GLBs. The structure follows the Tekken 5 intro, and the editing follows SmackDown: Here Comes the Pain.
Ending: smash cut to black, a 1.0s hold, the bass drop, then the video's `onEnded` hands off to the live engine start screen (see Handoff).

Every asset status below comes from the repo on the shared box (`/workspace/vten-main-audit`), checked 2026-09-28. The sources are `public/models/`, `public/motion/` (plus `baked/`), `src/data/stageCatalog.ts`, `src/data/bannonGlbRoster.ts`, `src/data/bannonRoster.ts`, `src/engine/BrutalFistMoveCatalog.ts`, and `src/engine/combat/GrapplePairing.ts`. A file existing isn't a render PASS. Every shot stays RUNTIME_PENDING until its frames are rendered, reopened, and SHA-256 logged.

---

## 1. Beat grid (music lock)
- **120 BPM.** One beat is **15 frames** and one bar (4/4) is **60 frames**, so every cut below lands on a multiple of 15.
- **Snare frames** (backbeat on beats 2 and 4) are the frames where `f mod 30 = 15`, meaning 315, 345, 375, and so on. **Every impact lands on a snare frame.**
- Sections:
  - 0–299: slow, moody intro. Drone, clean or detuned guitar, sparse hits, no backbeat.
  - **300: riff drop.** Full nu-metal/industrial band from here to 1199.
  - 1200–1649: halftime breakdown (snare on beat 3 only, at `f mod 60 = 30`) under the face-off and slow-mo charge.
  - 1650–1754: rebuild. **Frame 1754 is total silence.**
  - 1755–1784: black and silence.
  - **1785: bass drop.**
  - 1800: start screen.

## 2. EDL (1800 frames)
Source key: **ENG** is an engine render. **AI** is an AI FMV plate, limited to environments, crowds, and extras, never a named character. **BLK** is a blockout set built for the engine. **GFX** is type and graphics. **COMP** is the background smash-cut composite.

| # | In | Out | Frames | Time | Source | Shot | Beat / post |
|---|---|---|---|---|---|---|---|
| **TENSION DROP** |||||||
| T1 | 0 | 74 | 75 | 0:00.0 | AI | Black Swamp (Sector 7): fog, a boot sinks into the mud (owner of the boot unseen) | Drone in, VHS grain, crushed blacks |
| T2 | 75 | 164 | 90 | 0:02.5 | ENG + BLK | Cody (Stressed) panicking in the Executive Corridor, looking back and backing away | Handheld jitter, sickly fluorescent grade |
| T3 | 165 | 254 | 90 | 0:05.5 | ENG + BLK | Equipment Lock-Up. Extreme close-up of Cain Elias in his **God Within enforcer attire** (`CAIN_ELIAS_godwithin.glb`) as his eyes snap open. God Within is an **alternate-universe, ontological state, not a power-up**: the frame should feel like reality slipping, not a character charging up | **Grounded:** a short **Reality Check distortion** hit on 240 (wave warp, RGB split, slight color drain; per Bannon `BANNON_v150.html` Reality Check pass). **Eye glow is UNKNOWN in canon.** A subtle emissive eye ramp may be used only as a **PLACEHOLDER (flagged stand-in)** until the owner defines the look |
| T4 | 255 | 299 | 45 | 0:08.5 | ENG | (v1 alt, optional) Low angle of Edwin Kennedy and Stan Combs, a corporate stare-down | Riser into the drop |
| **IGNITION** |||||||
| I1 | 300 | 374 | 75 | 0:10.0 | ENG + BLK | **Riff drops on 300.** JPCW Arena (Tokyo): Bannon (muscular) waist-locks Stick-Up (**normal `STICKUP.glb` look, not Cyborg**) and lifts (Deadlift German) | Low angle, speed ramp to 40% at the peak |
| I2 | 375 | 419 | 45 | 0:12.5 | ENG | **Impact at 375 (snare):** bridge and slam | 2-frame white flash, VHS tracking tear, camera shake |
| I3 | 420 | 449 | 30 | 0:14.0 | ENG | Bannon roar close-up, a plain power moment (no named state; the owner struck "Beast Mode") | Red push, chromatic fringe |
| **ROSTER BLITZ: background smash-cut** |||||||
| B1 | 450 | 539 | 90 | 0:15.0 | COMP | Maime (Tattered) slips a punch and throws an elbow into the lens. Lands in the Training Grid | Arena swaps on 465 and 495. Elbow hits the lens on 525 |
| B2 | 540 | 629 | 90 | 0:18.0 | COMP | Finxsse throws the Chainsnatcher on a goon. Lands in Club Onyx (Miami) | Swaps 555, 585. Impact 615 |
| B3 | 630 | 734 | 105 | 0:21.0 | COMP | Edwin Kennedy points and Titan chokeslams a goon through a podium. Lands at the Presidential Debate (Kennedy Center) | Swaps 645, 675. Impact 705, wood splinters |
| B4 | 735 | 824 | 90 | 0:24.5 | COMP | Cipher dives off the top rope in the Void Ring and shrinks mid-air to Feral at 0.75 scale | Swap to Feral on a flash frame at 780. Impact 795 |
| B5 | 825 | 914 | 90 | 0:27.5 | COMP | Pablo shifts to Golden Bull and charges through a pillar. Lands in the Aztec Temple. Golden Bull is a **humanoid attire/persona** (`PABLO_goldenbull.glb`), not a bull-shaped form (see §3b options) | Flash-frame attire swap at 855 (recommended option a). Impact 885 |
| B6 | 915 | 1019 | 105 | 0:30.5 | COMP | Tyneshia's "Hall Street Justice" combo ending in a knee. Lands in the Parking Lot | Combo hits on 945 and 975, knee on 1005 |
| B7 | 1020 | 1109 | 90 | 0:34.0 | COMP | (v1 extra) Onyx (Straightjacket) throws Kobra through a chain-link fence in Urban Night | Swap 1035, 1065. Impact 1095 |
| B8 | 1110 | 1199 | 90 | 0:37.0 | COMP | (v1 extra) Titan (Unmasked) chokes Brutus into the "Titan Fall" | Swap 1125, 1155. Impact 1185, bass hit |
| **CORE CONFLICT: Great Banyan Tree (Sector 7)** |||||||
| C1 | 1200 | 1319 | 120 | 0:40.0 | ENG + BLK + AI | Wide 60×60m, three factions. AWE on the left (Bannon, Maime, Tyneshia, Aaron Ruben). Corporate on the right (Stan Combs, Cain Elias in God Within enforcer attire, **Stick-Up in Cyborg attire: STAND-IN** until the owner's model exists), with **Finxsse on the far side, directly across from Bannon**. **Onyx's chaos faction (Onyx, Static, Hollow, Cipher, Echo) stands apart in the shadows, deeper behind the roots** and belongs to neither side | Halftime starts, slow crane down. The chaos faction stays still and silent, and Onyx plays it ominous and calm. No Theory, and no hint of the Theory dynamic |
| C2 | 1320 | 1439 | 120 | 0:44.0 | ENG | Push-in on Bannon vs Finxsse ("sellout vs avenger"), with alternating eyeline close-ups cut on 1350, 1380, 1410 | Low sub, no hits |
| C3 | 1440 | 1649 | 210 | 0:48.0 | ENG + BLK | Slow-mo charge across the roots, low tracking, alternating cuts every 30 frames on the halftime snare. If Stick-Up is visible anywhere in the Banyan Tree scene (C1–C3), he's in Cyborg attire (stand-in) | 50% speed, then 25% on the last 60 frames |
| **MATCH-CUT and END** |||||||
| M1 | 1650 | 1709 | 60 | 0:55.0 | ENG | Bannon's Flying Headbutt: takeoff and airborne, **camera dead center** | Rebuild riser |
| M2 | 1710 | 1754 | 45 | 0:57.0 | ENG | Match-cut to Finxsse catching him mid-air for the Getbackk counter. Bannon holds the same screen position | **Frame 1754 is silent.** Impact is never shown |
| M3 | 1755 | 1784 | 30 | 0:58.5 | GFX | **Smash to black** (1.0s hold) | Silence |
| M4 | 1785 | 1799 | 15 | 0:59.5 | GFX | Black. **The bass drop hits on 1785** | Drop sustains into the start screen |
| END | 1800 | — | — | 1:00.0 | live | `<video>` fires `onEnded` and the live engine start screen takes over | Start-screen music picks up the drop tail |

Checksum: 75+90+90+45 + 75+45+30 + 90+90+105+90+90+105+90+90 + 120+120+210 + 60+45+30+15 = **1800 frames**.

### Background smash-cut technique (B1–B8)
Render each fighter from a **locked camera** as an **RGBA PNG sequence** (transparent background), so the fighter holds the same screen position. Composite over arena plates in ffmpeg, **swapping the plate on each snare frame** listed above. The final plate in each segment is the fighter's own canon arena, where the impact lands. The in-between swaps cycle the other arenas (Training Grid, Urban Night, Club Onyx, Void Ring, Aztec Temple, Parking Lot, Kennedy Center, JPCW). Add a 1-frame white flash on each swap.

## 3. Per-shot asset table: characters and attire to GLBs
Paths are relative to `/workspace/vten-main-audit/public/models/`. Every GLB below exists on disk, and `bannonGlbRoster.ts` lists it as skinned with playableGate PASS (that's the roster's static gate, not a visual PASS).

| Shot | Character | Attire called for | GLB | Status |
|---|---|---|---|---|
| T2 | Cody | Stressed | `CODY_stressed.glb` | OK |
| T3, C1 | Cain Elias | God Within (enforcer attire) | `CAIN_ELIAS_godwithin.glb` | OK as the attire. The owner's source file is "Cain Elias attire 4 (The God within enforcer appearance attire)": a black tactical vest, camo cargos, and boots. The GLB has **no emissive and no morph targets/eyelid shape keys**, so the eye *snap* has to be a cut or hand-keyed and the **eye glow is UNKNOWN**. An emissive eye ramp is a **PLACEHOLDER (flagged stand-in)**. The only grounded God Within visual is the Reality Check screen distortion |
| T4 | Edwin Kennedy | suit | `EDWIN_KENNEDY.glb` ("Mustached Mogul") | OK as the suited look (owner to confirm) |
| T4, C1 | Stan Combs | suit (T4) | `STAN_COMBS_gear.glb` ("Ring Gear") | **MODEL_MISSING for a suit attire.** Ring Gear is the stand-in |
| I1–I3, C1–C3, M1 | Bannon | muscular build | `BANNON_muscular_skinned.glb` (rigs: `_rig28`, `_rigready`, `_rigged`) | OK. Pick the rig that plays cleanly |
| I1–I2 | Stick-Up | **normal look** | `STICKUP.glb` | OK. Owner decision: normal look everywhere outside the Banyan Tree |
| C1–C3 (Banyan Tree only) | Stick-Up | **Cyborg** (Terminator-style) | none | **MODEL_MISSING (owner to build in 3D).** **STAND-IN:** `STICKUP.glb` plus a post/VFX cyborg treatment (exposed-metal half-face overlay, red eye emissive). This must be flagged as a stand-in on every frame and in the render log. Canon grounding: Cyborg Stick-Up is book canon (Bannon Book 1 coda, Book 2 "Cyborg File" vignettes with "visible cybernetic modifications"). The half-face and red eye are the owner's Terminator-style direction, not a book spec |
| B1, C1 | Maime | Tattered | `MAIME_tattered_skinned.glb` (or `MAIME_tattered.glb`) | OK |
| B2, C2, M2 | Finxsse | NPC | `NPC_FINXSSE.glb` | OK |
| B2, B3 | Goon / debate victim | generic | `wrestler_base.glb` / `wrestler_base_rig28.glb` | OK as a generic extra. No canon identity |
| B3 | Edwin Kennedy | Mustached Mogul | `EDWIN_KENNEDY.glb` | OK |
| B3 | Titan | default (masked) | `TITAN.glb` | OK |
| B4 | Cipher | normal, then Feral at 0.75 | `CIPHER_rigged.glb` then `CIPHER_feral.glb`, scaled to 0.75 | OK. These are two GLBs, so the shrink is a flash-frame swap, not a morph |
| B5 | Pablo | base, then Golden Bull | `PABLO.glb` ("Minotaur Painted") then `PABLO_goldenbull.glb` | OK. Flash-frame swap (option a, recommended). `PABLO_goldenbull.glb` is a **humanoid** Pablo attire with the same 58-joint Mixamo rig: a black bodysuit with gold stripes, gold/black/white face paint, a silver bull-skull chest emblem with red eyes, and no emissive. It's **not a bull shape.** Don't use `EL_TORO_DE_ORO.glb` (a different character, even though vten labels him "Golden Bull") |
| B6, C1 | Tyneshia | Hall Street (B6), Gear (C1) | `TYNESHIA_street.glb` ("Hall Street / Casual") and `TYNESHIA.glb` | **OK. Tyneshia is NOT missing** |
| B7 | Onyx | Straightjacket | `ONYX_straightjacket.glb` | OK |
| B7 | Kobra | default | `KOBRA.glb` | OK |
| B8 | Titan | Unmasked | `TITAN_unmasked.glb` | **OK. Titan is NOT missing** (`TITAN.glb` and `TITAN_white.glb` are also on disk) |
| B8 | Brutus | default | `BRUTUS.glb` | OK |
| C1 | Aaron Ruben | default | `AARON_RUBEN.glb` | OK |
| C1 | Onyx | default (chaos-faction leader) | `ONYX.glb` (rigs: `_rig28`, `_rigready`, `_skinned`) | OK. Alternate attires: `ONYX_corset`, `ONYX_street` |
| C1 | Static | default | `STATIC.glb` (alternate: `STATIC_alt.glb`) | OK |
| C1 | Hollow | default | `HOLLOW.glb` | OK |
| C1 | Cipher | default | `CIPHER.glb` (also `CIPHER_feral`, `CIPHER_minion`, `CIPHER_rigged`) | OK |
| C1 | Echo | default | `ECHO.glb` | OK |
| (none) | Theory | (not in this cut) | none in the repo | **MODEL_MISSING in the game repo.** The owner has two Tripo attires, but they aren't imported. She's left out of the FMV on purpose |
| (unused) | Wreck Patterson | — | `WRECK_PATTERSON*.glb` (including `_godwithin`) | **NOT missing.** Four GLBs are on disk, but the blueprint doesn't cast him in a shot. `_godwithin` is the "demon reaching out of shirt" attire (the demon print has protruding geometry, but no sword or extra limb is modeled yet). He's available as a God Within alt for T3 if the owner wants |

**MODEL_MISSING summary:** Stan Combs (suit attire) and Stick-Up (Cyborg attire, **owner to build**, with the stand-in described above). That's it. Tyneshia, Titan, and Wreck Patterson all have GLBs.

**Polycount flag:** every repo GLB I inspected (Cain, Wreck, Pablo, and Stick-Up variants) is **decimated to about 18k tris** (glTF-Transform, meshopt). The "high-poly, un-decimated" target needs the owner's original Tripo sources (`assets/models/incoming/...` per the Drive manifest), which aren't in either checkout. **UNKNOWN until supplied.** The repo GLBs work for the rough cut.

### 3b. B5 Golden Bull: options (owner to choose)
Grounding: in the Bannon books, Golden Bull is Pablo's **persona and costume** (a Golden Bull mask, gold paint, later gold plating). It isn't a transformation, and there's no Golden Bull or Black Reign VFX, special, or transform in either repo. Pablo's "Bull Rush" payback has no catalog entry and no clip. `PABLO_goldenbull.glb` is a humanoid attire on the same rig as `PABLO.glb`.
- **(a) Flash-frame swap to `PABLO_goldenbull.glb`**: a white flash at 855, with base Pablo before it and Golden Bull attire after, into the charge (`JOHNSONRUNNINGTACKLE`). It uses an existing, owner-made, rigged asset, and it matches how B4 (Cipher to Feral) already works.
- **(b) Gold rage VFX/grade on base Pablo**: a gold grade, rim light, and heat haze on `PABLO.glb`. This invents a look that has no canon source, so it would be flagged as a stand-in.
- **(c) Owner builds a dedicated bull-transform model or special**: the most spectacular option, but it's new geometry that only the owner can author. MODEL_MISSING, and it blocks the final.
- **Recommendation: (a).** It's donor-first (a real, owner-authored asset with the same rig and the same scale), it needs no invented geometry or lore, it reads clearly as "Pablo goes Golden Bull" at FMV speed, and it matches the book framing of Golden Bull as a persona and attire rather than a monster form. A light 2–3 frame gold flash tint on the swap frame is allowed as finishing, but no sustained gold aura. Option (c) can replace it later if the owner builds a transform.

## 4. Arenas: what exists vs what's needed
Only two stages are in the game: `training-grid` and `urban-night` (`src/data/stageCatalog.ts`, `TrainingStage.tsx`, `UrbanNightStage.tsx`). No other canon arena name appears anywhere in the repo.

| Arena | In repo? | Plan | Why |
|---|---|---|---|
| Training Grid | **EXISTS** | Engine stage | B1 landing and smash-cut plate |
| Urban Night | **EXISTS** | Engine stage | B7, and a smash-cut plate |
| Black Swamp (Sector 7) | MISSING | **AI plate** | No named character in shot |
| Executive Corridor | MISSING | **Blockout** (with an AI plate for the far end) | Cody moves in depth and needs parallax |
| Equipment Lock-Up | MISSING | **AI plate backplate**, defocused | Extreme close-up, so the background is soft |
| JPCW Arena (Tokyo) | MISSING | **Blockout ring and floor**, with an AI plate for the crowd and jumbotron | The suplex needs real floor contact |
| Club Onyx (Miami) | MISSING | **AI plate** | Smash-cut background only |
| Presidential Debate (Kennedy Center) | MISSING | **AI plate stage**, plus a **blockout podium prop** that breaks | The podium has to shatter on 705 |
| Void Ring | MISSING | **Blockout ring** in a black void, rim-lit | The dive needs ropes and a turnbuckle. No ring asset was found in the repo |
| Aztec Temple | MISSING | **AI plate**, plus a **blockout pillar** that breaks | Pillar destruction on 885 |
| Parking Lot | MISSING | **AI plate** | Smash-cut background only |
| Great Banyan Tree (Sector 7) | MISSING | **Blockout 60×60m root floor**, with an AI matte plate for the canopy and sky | The biggest build item. Hero wide shot and slow-mo run across the roots |

AI plate rules: no named characters and no faces on extras. Log tool, prompt, seed, and date in `plates/PROVENANCE.md`.

## 5. Named moves: real clip or MISSING_CLIP
Clips live in `public/motion/`. Important: per `GrapplePairing.ts`, **GERMANSUPLEX and CHOKESLAM are victim-side halves only**, so the deliverer half was never imported.

| Move | Shot | Clip status | Stand-in for the rough cut |
|---|---|---|---|
| **Deadlift German Suplex** (Bannon on Stick-Up) | I1–I2 | **MISSING_CLIP.** No deadlift variant exists. `GERMANSUPLEX.json` and `POPUPGERMANSUPLEX.json` exist but are receiver halves | Stick-Up plays `GERMANSUPLEX` as the receiver. Bannon's deliverer half is missing, so hand-key it or frame the shot to hide Bannon's body |
| **Chainsnatcher** (Finxsse) | B2 | **MISSING_CLIP.** There's a catalog entry (`bf_chainsnatcher`, aliases include `backstabber`), but no motion file | A jump-knee proxy (`GRAFKNEEASSAULT` / `DEFAULTJUMPKICK`) into a victim fall. Must be flagged as a stand-in |
| **Getbackk** (Finxsse counter) | M2 | **MISSING_CLIP.** There's a catalog entry (`bf_getbackk`, fireman-carry tornado slam), but no motion file | **`TZ_TILT_WHIRL_SLAM` plus `TZ_TILT_WHIRL_SLAM__RECV`**. It's a real two-body pair, and only the catch and rotation are shown before the black |
| **Flying Headbutt** (Bannon) | M1 | **MISSING_CLIP.** "headbutt" only shows up as a category word in `MoveLibrary.ts` | `BIG_JUMP` / `ASSISTEDDIVSENTON`, using the airborne portion only |
| **Hall Street Justice** (Tyneshia) | B6 | **MISSING_CLIP.** The roster references `bf_hall_street_justice`, but the move catalog has no entry and there's no motion | `GRAFPUNCHCOMBO`, then `ILLEGAL_KNEE` |
| Titan Fall (Titan, v1 extra) | B8 | **MISSING_CLIP.** The roster ID `bf_titan_fall` has no entry and no motion | `POWERBOMBWHIP` (singles) |
| Chokeslam (Titan, B3) | B3 | Receiver half only (`CHOKESLAM.json`) | The victim plays `CHOKESLAM`. Titan's lift is hand-keyed or framed out |
| Chain-link fence throw (Onyx, B7) | B7 | `FENCETHROW.json` / `FENCETHROW_002.json` **exist**. Which half they are is **UNKNOWN** | Verify in the Move Library before relying on it |
| Slip and elbow (Maime, B1) | B1 | `CORKSCREW_EVADE.json` and `ILLEGAL_ELBOW_PUNCH.json` **exist** | Real clips |
| Golden Bull charge (Pablo, B5) | B5 | `JOHNSONRUNNINGTACKLE.json` **exists**. Pablo's "Bull Rush" (`bf_bull_rush`) has **no catalog entry and no clip** | Real clip as a stand-in for the charge |
| Top-rope dive (Cipher, B4) | B4 | `ZONE_PERCH_POSE`, `ZONE_DROP_*`, and `BIG_JUMP` **exist** | Real clips |
| Roar / power moment (Bannon, I3) | I3 | `RAPIDCHESTBEATING` / `TAUNT_FLEX` **exist** | Real clips. Post is only a red push and chromatic fringe, with no named state (the owner struck "Beast Mode") |

**MISSING_CLIP summary:** Deadlift German (deliverer), Chainsnatcher, Getbackk, Flying Headbutt, Hall Street Justice, Titan Fall, and the Chokeslam deliverer half. Hurricane Kick is still frozen and isn't used.

## 6. Music and VO
- **Music status:** a generated placeholder, `music/intro_placeholder_v1.wav` (plus `.mp3`, a listen MP4, and `PROVENANCE.md`), is in `/workspace/intro-movie/music/`. It's procedural synthesis, with no samples and no AI model per its provenance. **The owner will approve or reject it.** Until then it's a timing placeholder, not the final music.
- **Music spec:** a heavy industrial/nu-metal instrumental at 120 BPM (drop-tuned guitars, industrial percussion, synth bass). It's slow and moody for 0–10s, the riff drops on frame 300, it goes halftime at 40s, there's one frame of silence at 1754, a 1s black hold, and the bass drop at 1785. Every impact lands on a snare frame. Use an original commission or licensed stems only, and record provenance.
- **VO:** none. The blueprint doesn't call for it, and the music and SFX carry the cut.
- **SFX:** body slams, wood and stone breaks (podium, pillar), fence rattle, crowd swells (JPCW only), and a Reality Check distortion hit (T3).

## 7. FMV finishing (ffmpeg)
2003-era FMV look: crushed blacks, bloom, 1–2px chromatic aberration on impacts, grain, subtle interlace, and 2-frame white flashes on impacts and smash-cut swaps. Add a VHS tracking tear at 375 only, speed ramps as noted in the EDL, and letterbox bars from C1 onward. Keep the look lighter on engine shots and heavier on AI plates.

## 8. PWA handoff (for the build)
- Preload the start screen under the `<video>`. On `onEnded`, swap visibility with no gap. The drop audio is baked into the video, and the start-screen music starts on the drop tail.
- **Browser autoplay policy:** unmuted video won't autoplay without a user gesture. Either show a "tap to begin" gate first, or autoplay muted and unmute on the first tap. Add a skip-on-any-input handler that jumps straight to the start screen.
- The same file doubles as the trailer. The trailer export should replace the live start screen with a baked start-screen still or logo card.

## 9. Build list (what must exist before a final)
1. Clips: Deadlift German (deliverer), Chainsnatcher, Getbackk (the paired aerial catch), Flying Headbutt, Hall Street Justice, Titan Fall, and the Chokeslam deliverer half.
2. Attires: Stan Combs suit, Stick-Up Cyborg (Terminator-style, **owner building it in 3D**). Also the un-decimated source GLBs if the high-poly target stands.
3. Sets: Great Banyan Tree blockout, JPCW ring, Void Ring, and Executive Corridor, plus the breakable podium and pillar props.
4. AI plates: Black Swamp, Lock-Up, Club Onyx, Kennedy Center, Aztec Temple, Parking Lot, JPCW crowd, and the Banyan canopy.
5. Visual definitions from the owner: the God Within look (eyes, glow, and so on are UNKNOWN in canon; only the Reality Check distortion is grounded) and the B5 Golden Bull option pick (§3b). Beast Mode was struck.

## 10. Owner decisions (Sep 28)
- Finxsse stands on the side opposite Bannon in C1, because he's a flip-flopper.
- Onyx leads a third, separate dark faction (Static, Hollow, Cipher, Echo, Onyx). It stands apart from both AWE and Corporate/JPCW and sits outside the normal book and canon order.
- Theory, Onyx's future partner, has no in-game model, so she stays out of this FMV. Onyx shows none of the Theory dynamic.
- The v1 extras (T4, B7, B8) stay in.
- The black hold stays at 1.0s (1755–1784) after the near-miss, then the bass drop hits.

## 10b. Owner decisions (Sep 28, round 2)
- **Stick-Up:** Cyborg attire **only in the Banyan Tree scenes** (C1–C3, and anywhere else he appears in that scene). Everywhere else, including I1–I2, he uses his normal `STICKUP.glb` look. The owner will build a Terminator-style cyborg Stick-Up model in 3D, so it stays **MODEL_MISSING (owner to build)**. Until then the **stand-in** is the default model plus a post/VFX cyborg treatment (an exposed-metal half-face overlay and a red eye emissive), **clearly flagged as a stand-in.**
- **"Beast Mode" struck.** The owner doesn't use the term. It came from the blueprint's Ignition line. I3 stays as a plain Bannon roar power moment (red push, chromatic fringe) with no named state.
- **God Within** is an alternate-universe, ontological reference (the counterpart to Devil Within), **not a power-up mode**. It will come over to Brutal Fist later as a separate mode. T3/C1 now use only grounded cues: the God Within enforcer attire GLB and the Bannon Reality Check distortion. **Eye glow is UNKNOWN**, and any eye-glow fallback is a flagged placeholder. See `GOD_WITHIN_RESEARCH.md`.
- **Golden Bull (B5):** options (a) through (c) are in §3b. The recommendation is (a), a flash-frame swap to `PABLO_goldenbull.glb`. The owner picks.
- **Music:** a generated placeholder track is at `/workspace/intro-movie/music/intro_placeholder_v1.*`. The owner will approve or reject it.

## 11. Remaining open questions
- **Music:** does the owner approve or reject `intro_placeholder_v1`? If he rejects it, will the replacement be a commission, licensed stems, or another generated pass?
- **God Within look:** should there be an eye glow at all (and if so, what color and behavior), or only the Reality Check distortion? This stays UNKNOWN until the owner defines it.
- **B5 Golden Bull:** confirm option (a), or choose (b) or (c).
- **Cyborg Stick-Up model:** when will the owner's model land? Until it does, C1–C3 use the flagged stand-in.
- **High-poly sources:** can the owner supply the un-decimated Tripo GLBs, or is the 18k-tri repo set acceptable?
