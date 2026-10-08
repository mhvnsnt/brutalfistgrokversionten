# God Within research (for the Brutal Fist intro FMV)

Researched 2026-09-28 (CT). The sources were:
- **Bannon repo:** `https://github.com/mhvnsnt/Bannon` at `d575dd6` (main, 2026-09-28 12:56 CT), cloned read-only at `/workspace/ref-repos/Bannon`.
- **Brutal Fist repo:** `brutalfistgrokversionten` at `db752c8` (main, 2026-09-28 15:11 CT), read at `/workspace/vten-main-audit`.

Studio law applies: donor-first, no invented lore or geometry, and UNKNOWN is never PASS. The owner's framing takes precedence over anything in these files.

## 0. Owner framing (Sep 28, round 2)
God Within **isn't really a mode** in the power-up sense. It's an **alternate-universe, ontological reference**, the counterpart to Tekken's Devil Within, and it will come over to Brutal Fist later as its own separate mode. Anything in the Bannon repo that frames it as a gauge or transformation is older scaffolding, and the owner's framing overrides it.

## 1. How the Bannon repo defines God Within (grounded, with paths)
| Aspect | What the files say | Path |
|---|---|---|
| Canon status | A "parallel, LESS-canon RPG side-mode". Its premise: "Solaris Justice dies -> BANNON born, 'The Broken Architect'" | `BANNON_v150.html` ~L22883 (`OTTR.godWithin`) |
| Story frame | A "New Game Plus story mode (design canon)... Devil-Within-style, canon-adjacent". It replays the shape of Book 3 Ch.31–40 with Onyx (game-only) *shaping* Maime | `canon/godwithin/GOD_WITHIN_mode.md` |
| Book source | *Off The Top Rope Book 7: The God Within (Act 3.5 & New Game Plus)*, which covers the God Mode OS overlay, the Ontology Skill Tree, Acts 2/3/3.5/5, and the Epilogue | `Off The Top Rope Book 7_ The God Within (Act 3.5 & New Game Plus).txt` |
| Ontology | The world runs on numerology and astrology as "a literal personality OS". God Within progression runs through the **ten sephirot of the Tree of Life**. **Kether (The Crown) contains "The God Within"**: "you no longer fight the physics engine, you DICTATE it", which lets you rewrite glitched "static" entities back into human form | `canon/godwithin/ontology_skill_tree.md`, Book 7 |
| Ontology in code | Keter is described as "The highest state. Often associated with the 'God Within' mode threshold. Unknowable momentum." | `src/daemon/OntologicalKnowledgeBase.cpp` L44–48 |
| Personas | One man with three physics states: Marquis (baseline), Bannon (mask), and Maime (paint, feral). It's a state-machine swap on physics multipliers, not three characters | `native/include/bannon_persona.h`, `canon/godwithin/GOD_WITHIN_mode.md` |
| "God Within variants" | Only a few entities know the God Mode OS is running: Bannon/Marquis/Maime, Onyx, Zero Point, and "secretly the 'God Within' variants of Trap Shinobi, Stick-Up, Combs, Kennedy" | `canon/godwithin/GOD_WITHIN_mode.md`, Book 7 |
| Non-canon stable | Onyx (game-only, "uncomputable" Life Path) and her stable CIPHER, ECHO, HOLLOW, and STATIC, all "off the numerology engine" | `canon/godwithin/noncanon_roster.md` |
| Roam / RPG scaffolding | A roam mode (`window.BANNON_GODWITHIN`), GAS "Cosmic/Mental Alignment", and a consequence AI | `docs/GOD_WITHIN_mode.md`, `unreal/Source/BannonCore/*/BannonGodWithinGAS.*`, `native/include/bannon_universe.h`, `app/src/main/cpp/universe/GodWithinConsequenceAI.cpp` |
| Older "transformation" scaffold (**superseded by the owner**) | A `resonanceGauge` that fills to 100 and calls `triggerTransformation()`, which applies a ×3.5 impulse multiplier ("TEKKEN-STYLE BRAWLER OVERRIDE"). The Unreal "endgame" unlocks low-gravity and time-dilation modifiers at max cosmic alignment | `src/engine/GodWithinStateMachine.{h,cpp}`, `unreal/Source/BannonCore/*/BannonGodWithinEndgame.*`, `AGENTS.md` L286/487/556 |
| Enforcer attire (owner's source filename) | "Cain Elias attire 4 (**The God within enforcer appearance attire**).glb" becomes `CAIN_ELIAS_godwithin.glb` | `tools/drive_sync/manifest.json`, and in vten `src/data/bannonGlbSourceInventory.ts` |
| Wreck Patterson attire (owner's source filename) | "wreck Patterson attire 4 (**god within demon reaching out of shirt hold sword give him extra limb, appears in god within mode possessed by CIPHER** In an appearance in this attire).glb". `BANNON_v150.html` calls it the "God-Within demon shirt" | `tools/drive_sync/manifest.json`, `BANNON_v150.html` ~L15318–15320 |
| Dialogue | Each of the roughly 30 characters has an identical `god_within` pair ("I feel the power of the divine flowing through me!" / "This vessel is no longer human. It is ascending."). This is **templated filler, not character canon** | `assets/dialogue/character_lines.json` |

### Devil Within
Every "Devil Within" hit in the Bannon repo refers to the **Tekken 5 mode, used as a design influence**: the radar map, over-the-shoulder roaming, and "Devil Within juggles" on the Geburah/Maime branch. **No in-universe "Devil Within" state or character is defined anywhere.** The owner's "Devil Within counterpart" framing is new owner canon and isn't in the files.
Paths: `canon/godwithin/GOD_WITHIN_mode.md`, `canon/godwithin/ontology_skill_tree.md`, Book 7 L2 and L20, `roadmap/Evolution_Tracker.md` (v1.1.6), `docs/mocap_accuracy_plan.md` L44, `MANIFEST.md` L85.

### Related metaphysical material (grounded)
- **Numerology/astrology as the world's OS.** Characters carry Life Path numbers and astrological placements (cast tables in the Book 2 and Book 3 texts, and `canon/00_cast_and_world.md`). Onyx's stable is defined as being outside that OS.
- **Corruption / Purity / Autonomy / Trust** meters drive branching (Book 7, `HEY_CLAUDE_READ_ME_FIRST.md`, `src/engine/GodWithinCampaign.*`).
- **"The Bastard"** is a future sibling playthrough that attaches to God Within once five episodes exist. It's concept only (`docs/design/THE-BASTARD-GOD-WITHIN-MODE-INTEGRATION.md`).

## 2. How God Within looks
### Grounded in files
| Cue | Source | Note |
|---|---|---|
| **Screen distortion (Reality Check pass):** wave warp, RGB split (chromatic aberration), a 30% color drain toward luma, and local inversion at max intensity. It auto-decays | `BANNON_v150.html` ~L18614–18636, and the original in `BANNON_BRICKS.js` (Brick 2, "Reality Check" GLSL). `docs/bannonengine2_integration.md` L29 describes it as "God Within / 'The Anchor' distortion moments" | This is the **only coded God Within visual.** It's a post pass on the whole frame, not a character look |
| Title-card transitions: "glitches, typewriter fogs, ash dissolves" | `roadmap/Evolution_Tracker.md` (Patch v1.1.6) | Changelog text only. No asset was found |
| Maime-state UI: a "bruised red tint" on screen. "Grey static" crawls up a body as someone slips into the feral state and turns to "white ash" when they're purified. Onyx "dissolv[es] into raw code" | Book 7 | These are story/state visuals around God Within, not a God Within look |
| Static-entity tell: STATIC "flickers/glitches only near Onyx or Maime" | `canon/godwithin/noncanon_roster.md` | A render hook keyed to proximity |
| Voice: "heavy echo/distortion" for Reality Check lines. Tyneshia "drops into a lower, slower register during God Within moments" | `server/VoiceMapper.ts` L371, L443–449, `BANNON_CONTEXT.md` L107 | Audio, not visual |
| UI chrome: Cinzel serif for "God Within / ceremonial". The daemon toggle is gold `#ffd36a` when on and violet `#c9a3ff` when off. A 👁️ icon is on the menu button | `BANNON_v150.html` L650, L1478, L20737 | Menu styling, not a character look |
| Cain Elias God Within attire | Owner filename (see §1) and the vten GLB (see §3) | A tactical "enforcer" outfit, with **no glow** |
| Wreck Patterson God Within attire | Owner filename (see §1) and the vten GLB | A demon graphic reaching out of the shirt. The owner wants a sword and an extra limb, possessed by CIPHER |

### UNKNOWN (nothing in either repo defines these)
- **Eye glow of any kind** (color, intensity, snap-open behavior). No God Within file mentions eyes, glow, halo, or emissive. **UNKNOWN.**
- **Aura / body glow / particles.** "Aura Resonance" in `BannonOntologicalTreeCore.cpp` is a mass-scaling stat, not a visual. `docs/EXTERNAL_REFS.md` 4c mentions "God-Within particle/war-room framing" from a reference remix, but gives no spec. **UNKNOWN.**
- **A God Within color palette.** The only gold-on-black text is flavor copy for the BANNON Underground Championship promotion ("gold on black, where the god within is forged", `BANNON_v150.html` ~L43160), which is about a promotion, not the state. **UNKNOWN** as a character look.
- **Any in-universe "Devil Within" look.** **UNKNOWN.**

## 3. Does Brutal Fist already have God Within visuals? (`/workspace/vten-main-audit`)
The GLBs are identical, byte for byte, to the Bannon copies (same size and same sha256 prefix). All of them are Tripo meshes re-rigged to **58 Mixamo joints**, one mesh, one PBR material, three WebP textures (base, metallic-roughness, normal), **no morph targets, no emissive factor or texture, no animations**, and meshopt-compressed by glTF-Transform v4.4.2. I decoded them and did a quick software projection of the textured mesh.

| GLB | sha256 (prefix) | Tris | Emissive | What it shows (vs base attire) |
|---|---|---|---|---|
| `CAIN_ELIAS_ring.glb` | b07c0241f05c | 18,000 | none | Long black coat, red hair |
| `CAIN_ELIAS_godwithin.glb` | 5c24ecafcaf5 | 18,000 | **none** | Black tactical vest, camo cargo pants, combat boots, tattoo sleeves, red hair. Eyes are plain texture, with **no glow, no eyelid shape keys, and no emissive** |
| `WRECK_PATTERSON.glb` | d05a2ea2440b | 18,000 | none | Black tank, cargo pants |
| `WRECK_PATTERSON_godwithin.glb` | 304d6434aa90 | 17,998 | **none** | Graphic tank whose white demon/reaper print has **geometry protruding from the chest** (the "demon reaching out of shirt"), cargo shorts, bright arm sleeves. **No sword or extra limb is modeled** |

- **Brutal Fist code:** the only God Within references are the roster entries (`src/data/bannonGlbRoster.ts` L42, L100) and the source inventory (`src/data/bannonGlbSourceInventory.ts`). There's **no God Within shader, VFX, mode, or state in vten.**
- **Material differences:** the God Within GLBs differ from the base attires only in their baked albedo, meaning the outfit. The metallic/roughness texture averages are similar (Cain ring vs godwithin: metal ~8/6, rough ~106/99). Nothing is emissive.
- **Polycount flag:** every GLB checked is **decimated to about 18k tris**. The treatment's "high-poly, un-decimated" requirement **can't be met from the repo GLBs.** The un-decimated Tripo sources (`assets/models/incoming/...` in the Drive manifest) aren't in either checkout. **UNKNOWN**/owner to supply.

## 4. Pablo: Golden Bull and Black Reign
### What `PABLO_goldenbull.glb` is
- **Rig and type:** a **humanoid Pablo attire, not a bull shape.** It has the same 58-joint Mixamo skin as `PABLO.glb` and is the same height (about 1.95 m bbox). It's human-headed and bald.
- **Materials:** one Tripo material with WebP textures and no emissive. It's a **black bodysuit with gold/tan tribal stripes**, black gloves and boots, and **gold/black/white face paint**. A **silver bull-skull emblem with red eyes is modeled on the chest**, and it sticks out from the torso. Its metallic-roughness texture is glossier (rough avg ~36) and somewhat metallic (~55), where base Pablo is ~83/113 and Black Reign is ~33/17. sha256 prefix `b550231c6e06`, 18,000 tris.
- **Owner source filename:** "Pablo (the Golden Bull attire, not to be confused with El Toro de oro, those are two different characters) attire 2 gold.glb" (`tools/rigready/bank_map.json`, `bannonGlbSourceInventory.ts` L43).
- **Code comment:** "PABLO 'The Minotaur' — ... HUMAN-HEADED (the bull head belongs to El Toro de Oro). Attires: painted, a 'Golden Bull' set, and a Black Reign set" (`BANNON_v150.html` ~L15302–15306). The bio says he "wears the Golden Bull colors when he wants to be feared."

### Lore (Bannon books)
- **Golden Bull** is Pablo's **persona and costume**, not a transformation. It includes a Golden Bull mask, a robe of sewn replica belts and golden feathers, and later a suit with the mask's mirror shards replaced by polished gold plating (Book 5 `Level 99 (1).txt` ~L7395, `Level 99 Pt. 2.txt` ~L1252–1255).
- **Black Reign** happens when the mask gets ripped off. He wears **half-face black/white paint**, a black long-bob wig, and later a vinyl bodysuit, and becomes "The Abstract". "The Bull is dead. The Minotaur is dead." (`Level 99 Pt. 2.txt` ~L1388–1400, L2050–2058). See also `PABLO_blackreign.glb`, which is black with white slashes.
- **Collision warning:** in vten, "Golden Bull" is **also El Toro de Oro's role label** (`src/data/bannonRoster.ts` L715, payback "Golden Goring"), and `EL_TORO_DE_ORO.glb` exists. The owner has said explicitly that they're two different characters. Don't cast El Toro in B5.

### Transformation, VFX, or special?
There's **no Golden Bull or Black Reign transformation, VFX, or special anywhere** in Bannon or vten. Pablo's vten payback is "Bull Rush" (`bannonRoster.ts` L617, signature `bf_bull_rush`, L636), but it has **no move-catalog entry and no motion file**. `JOHNSONRUNNINGTACKLE.json` is the nearest real charge clip.

## 5. What this means for the FMV
- Treat God Within as **ontological/alternate-universe framing**, not a power-up. The only grounded treatment is the **Reality Check distortion** (wave warp, RGB split, color drain), used sparingly, plus the God Within attire GLB itself.
- An **eye glow is a placeholder.** It has no canon look, so if it's used it must be flagged as a stand-in until the owner defines it.
