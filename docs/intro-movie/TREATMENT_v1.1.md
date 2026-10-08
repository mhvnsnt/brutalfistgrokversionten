# Brutal Fist — Game Intro Movie: Treatment & Storyboard

Status: DRAFT v1.1 (creative). v1.1 puts real GLB renders in the S5 roll call; the EDL is unchanged at 840 frames. Owner review required before any external use. Nothing here is published.
Target: 28s rough cut (fits the 20–30s window), 1080p30, 16:9. Plays before the start screen; the same cut doubles as a trailer.
Style: real-time engine renders of our fighters, cut together with early-2000s FMV texture (Tekken 3/4 and SmackDown-era openings). That means crushed blacks, bloom, chromatic fringing, interlace/scanline hints, speed ramps, whip-pans, flash-frame cuts, and hard title slams.

## Canon guardrails (read first)
Source: `/workspace/vten-main-audit/docs/CANON_ARENA_STAGE_ROSTER_LEDGER.md` (updated 2026-09-28).
- No story, bio, or arena canon has been retrieved yet. This treatment **invents no lore**. It has no backstories, rivalries, affiliations, factions, or named locations.
- **Model correction (v1.1):** the ledger's roster table only lists Bannon and Kobra, but `/workspace/vten-main-audit/public/models` has GLBs for **all 11 roster fighters** (checked against the directory listing on 2026-09-28): Bannon, Maime, Cipher, Onyx, Viper, Cain Elias, Hall Nighter, Cody, Echo, Stick Up, and Static. Kobra also has a model (`KOBRA.glb`). Other models in that folder (Brutus, Jager, Pablo, Master Sensei, El Toro de Oro, Edwin Kennedy, Hollow, Titan, Triple XXX, Wreck Patterson, Tyneshia, and others) aren't on the intro roster, so they're left out.
- `VIPER.glb` and `KOBRA.glb` are separate files, so they're treated as separate fighters. Kobra still isn't on the owner's roster list. **OPEN QUESTION:** should Kobra get a nameplate? Until that's answered, Kobra appears only as the unnamed sparring opponent in S6–S11.
- Bios, fighting styles, and story roles are still **UNKNOWN**. The models give us looks, not lore, so the film shows fighters and names only, with no taglines or claims about who they are.
- Arena: an unnamed, generic "fight floor" (dark ring or cage floor with rim light). Swap in the canon stage once stage data exists.

## Story beat (lore-free)
One idea carries it: **"Everyone steps up. One fist is left standing."**
The film moves from the build-up (the crowd, the locker room, hands wrapping), to the roll call (the roster flashes by), to the collision (Bannon's first exchange), to the title slam. It's all mood and escalation, with no plot claims. Story and character specifics come in later cutscenes, once canon is sourced.

## Structure at a glance
| Act | Time | Purpose |
|---|---|---|
| Cold open | 0:00–0:05 | Atmosphere and tension, with the logo sting |
| Roll call | 0:05–0:15 | The roster flashes by, nameplates slam in |
| Collision | 0:15–0:24 | Bannon in-engine action, speed ramps |
| Title | 0:24–0:28 | BRUTAL FIST slam, then "PRESS START" (the in-game version only) |

## Shot-by-shot storyboard
Source key: **ENG** = real-time engine render from the GLB pipeline. **AI** = AI-generated FMV plate, used only for crowd, environment, or abstract texture, never as a canon character's likeness. **GFX** = motion graphics/type.

| # | Time | Dur | Source | Shot | Camera / motion | Post (FMV treatment) | Audio |
|---|---|---|---|---|---|---|---|
| S1 | 0:00.0 | 1.5s | GFX | Black. A studio sting: "TRIPPEDD PRODUCTION STUDIOS" | Static, then a 6-frame flicker-in | Scanlines, slight phosphor glow | Sub-bass hit, reversed cymbal |
| S2 | 0:01.5 | 1.5s | AI | Overhead arena lights click on one by one, with haze | Slow push-in | Heavy bloom, crushed blacks | Light clanks in sync with each bank |
| S3 | 0:03.0 | 2.0s | AI | Crowd silhouettes and fists in the air, backlit, faceless | Handheld, a 2-frame whip at the end | Interlace hint, grain, 12fps step-print | Crowd swell starts, drums enter |
| S4 | 0:05.0 | 1.5s | ENG | **Bannon** close-up: fists rise into guard (idle to stance clip) | Low angle, slow dolly-in | Rim-light bloom, cool grade | Kick drum, VO line 1 |
| S5 | 0:06.5 | 7.5s | ENG + GFX | **Roll call montage:** 10 real GLB renders at about 0.75s each for Maime, Cipher, Onyx, Viper, Cain Elias, Hall Nighter, Cody, Echo, Stick Up, Static (asset table below) | Each cut takes a different angle (tilt-up, whip, orbit snap) | Each character's NAME slams in hard, with a flash frame between cuts | Beat locks here, one name per hit |
| S6 | 0:14.0 | 1.0s | ENG | Bannon vs sparring opponent (Kobra model, unnamed): face-off, both in stance | Wide two-shot, fast 180° orbit | Letterbox bars snap in | Riser |
| S7 | 0:15.0 | 2.0s | ENG | Bannon throws his first strike (active attack clip) | Tracking, speed ramp 100% → 25% → 100% on contact | Impact flash, 2-frame white, chromatic hit | Impact SFX on the ramp |
| S8 | 0:17.0 | 1.5s | ENG | Opponent's hit reaction and knockdown (reaction/knockdown state) | Low ground-level, slow-mo | Motion-blur smear, grain up | Body-drop thud, crowd roar |
| S9 | 0:18.5 | 2.0s | ENG | Grapple/throw exchange (grapple one-shot state, Bannon as attacker) | Orbiting wide, then snap to a medium | Freeze-frame on the peak, with an ink-flash outline | Music drop, VO line 2 |
| S10 | 0:20.5 | 2.0s | AI | Abstract FMV burst: sparks, sweat spray, light streaks (no people) | Macro, fast | Heavy chroma, VHS tracking tear | Swell |
| S11 | 0:22.5 | 1.5s | ENG | Bannon hero pose: opponent down, Bannon stands and faces camera | Slow push-in, low angle | Lens flare, warm-cold split grade | Music cut to silence for 6 frames |
| S12 | 0:24.0 | 2.5s | GFX | **BRUTAL FIST** title slam (metal type, fist impact shockwave) | Z-axis crash-in, camera shake | Flash, bloom bleed, scanlines | Final hit + crowd, VO line 3 |
| S13 | 0:26.5 | 1.5s | GFX | In-game: "PRESS START" blink. Trailer version: studio tag and "COMING SOON" (owner to confirm copy) | Static | Phosphor blink | Hum tail |

Total: 28.0s.

### Roll call rules (S5)
Every roster fighter has a GLB, so **no silhouettes are needed**. The silhouette fallback applies only if a future roster name has no model.
- Each cut is a 22–23 frame ENG shot: a rim-lit hero angle with a short camera move, plus a nameplate slam. Poses can be static (the bind pose, lit and framed), so the rigged versions aren't required. Use a rigged version wherever a stance clip already plays cleanly.
- Nameplate order follows the owner's list. Bannon is held back for S4, since he's the lead.
- Names appear exactly as spelled: Bannon, Maime, Cipher, Onyx, Viper, Cain Elias, Hall Nighter, Cody, Echo, Stick Up, Static.
- Look selection is a default only. The owner picks final outfits.

| Cut | Frames (at 30fps, from 0:06.5) | Fighter | Default GLB | Alternates on disk | Camera move |
|---|---|---|---|---|---|
| S5a | 195–217 | Maime | `MAIME.glb` | `MAIME_tattered.glb`, `*_skinned.glb` | tilt-up from boots |
| S5b | 218–240 | Cipher | `CIPHER_rigged.glb` | `CIPHER.glb`, `CIPHER_feral.glb` | whip-in from right |
| S5c | 241–262 | Onyx | `ONYX.glb` | `ONYX_corset`, `_street`, `_straightjacket` | 30° orbit snap |
| S5d | 263–285 | Viper | `VIPER.glb` | none | low push-in |
| S5e | 286–307 | Cain Elias | `CAIN_ELIAS_ring.glb` | `_gear`, `_godwithin`, `_snakeskin` | crash zoom |
| S5f | 308–330 | Hall Nighter | `HALL_NIGHTER.glb` | none | Dutch-angle roll |
| S5g | 331–352 | Cody | `CODY_gear.glb` | `_sober`, `_stressed`, `_gear_rig28` | tilt-down to face |
| S5h | 353–375 | Echo | `ECHO.glb` | none | whip-in from left |
| S5i | 376–397 | Stick Up | `STICKUP.glb` | none | orbit snap reverse |
| S5j | 398–419 | Static | `STATIC.glb` | `STATIC_alt.glb` | push-in with flicker |

S5 covers frames 195–419 (225 frames). The S4 Bannon close-up uses `BANNON_rigged.glb` or the `BANNON_muscular_*` rig, whichever plays the stance clip cleanly. S6–S11 use a Bannon rig vs `KOBRA.glb`. The total stays at 840 frames.

Evidence: a GLB on disk only shows the model exists. It isn't a render PASS. Each cut is RUNTIME_PENDING until its frames are rendered, reopened, and SHA-256 logged. A model that fails to load or render falls back to a silhouette card in that slot, and the edit timing doesn't change.

## AI FMV plate vs in-engine: the decision rule
**In-engine (ENG):** any shot showing a canon fighter, any combat, and any move from the animation bank. This keeps the characters' likeness and motion honest and lets us reuse the shots later in cutscenes.
**AI FMV plates (AI):** only crowd, lights, haze, abstract impact texture, and establishing mood (S2, S3, S10). Never generate a canon character with AI. It would invent a design and break canon.
**Motion graphics (GFX):** logos, nameplates, the title, and end cards (S1, S12, S13, plus the S5 overlays).

Engine clips this cut needs (all states that exist today, per the ledger): idle/stance, a basic strike, hit reaction, knockdown, and grapple attacker/receiver. **Hurricane Kick is deliberately NOT used**. It's frozen pending re-bake, so it must not show up as a hero move until it's runtime-certified.

AI plate generation notes: 1080p, 16:9, 3–5s clips so we have handles. Prompts should state "no faces, no identifiable people, silhouettes only" for the crowd. Record provenance (tool, prompt, seed, date) in `/workspace/intro-movie/plates/PROVENANCE.md`.

## Music direction
- 28s cue at **140 BPM** (one bar is about 1.71s). It's driving and industrial-rock/breakbeat hybrid in the spirit of turn-of-the-millennium fighting and wrestling openers: distorted guitars, breakbeat drums, and synth stabs.
- Sections: cold-open drone and hits (0–5s), then the drums and a riff groove for the roll call, locked at one name per beat or half-bar (5–14s). A riser comes next (14–15s), then the full band and drop on the throw (18.5s). A 6-frame dead stop at 22.5s leads into the final slam at 24s, and a ringing tail runs to the end.
- Every cut in S5 and S7–S9 lands on a beat. The ffmpeg post should snap cut points to the beat grid.
- Licensing: original score or explicitly licensed stems only. Record the source in provenance. No temp track can ship.

## VO direction
- One gravelly announcer voice in the SmackDown or arcade-announcer register. Three short lines, dry with a slight slapback, and no character dialogue (there's no canon voice yet).
  1. S4 (0:05): "Step into the ring."
  2. S9 (0:18.5): "No rules. No mercy."
  3. S12 (0:24): "BRUTAL… FIST!"
- In-game version: the start screen can reuse line 3 as its attract-loop sting.
- If we use a synthetic voice, log it in provenance. The owner signs off on the final voice.

## FMV post recipe (for the ffmpeg pass)
Apply this per shot type, lighter on ENG and heavier on AI:
- Grade: crushed blacks, lifted cyan shadows, warm highlights.
- Bloom/glow on highlights, and 1–2px chromatic aberration on impacts.
- Film grain plus a subtle scanline or interlace overlay, then a 4:3 safe-area check (key action has to read if someone crops for socials).
- Speed ramps and step-printing (12fps holds) on AI plates and on impact frames.
- 2-frame white flash frames between the roll-call cuts, and a VHS tracking tear on S10 only.

## Deliverables and handoff
- This file: creative spec for the rough cut.
- Rough-cut EDL (for Repo Co Dev): the timings in the storyboard table are the EDL. Frame counts at 30fps are S1=45, S2=45, S3=60, S4=45, S5=225 (10 cuts, 22–23 frames each, see the S5 asset table), S6=30, S7=60, S8=45, S9=60, S10=60, S11=45, S12=75, S13=45 → 840 frames.
- Evidence rule (studio law): the cut is only "rendered" once real frame and MP4 bytes exist and a SHA-256 is recorded. Until then its status is RUNTIME_PENDING.

## Later scope (not in this cut)
Cutscenes, fighter story scenes, and mode-specific scenes all wait on canon (book/source material) and models. Each one will reuse this film's ENG/AI/GFX rule and FMV recipe.

## Open questions for the owner
1. Should Kobra get a roll-call nameplate? Kobra and Viper have separate models, but Kobra isn't on the roster list.
2. Can you provide canon stage/arena reference so the generic fight floor can be replaced?
3. Which outfit or look should each fighter use (defaults are in the S5 table)?
4. What should the trailer end card say ("COMING SOON", a date, platforms)?
5. Where will the music come from (original commission vs licensed library), and should the VO be a real or synthetic voice?
