# Dev Production Log — 2026-09-28

- User requested continued combat/animation work, aggressive open-source intake, and a universal pipeline so new animations work across differently rigged models.
- Implemented universal animation intake and model-aware recovery on PR #17: canonical bone aliases, source-rest to target-bind conversion, explicit rest tracks for missing joints, multi-body rejection, non-finite/frozen gates, receiver metadata, and recovery against the actual target fighter rig.
- Typecheck, tests, imported-data audit, Next compatibility build, production build and Rocket production build passed on CI before the real Chromium playtest stage.
- Real PWA playtest reached the actual browser combat stage; CI was still running that playtest at the time of this log update, so runtime certification is not claimed yet.
- Grapple animation state is now a true one-shot with dedicated crossfade timing on main (5b43bdb8c4ec0909f0adc0f895b341f58bb494fb).
- Added the canon/arena/stage/roster ledger. It records Bannon and Kobra as current project fighters and reserves explicit MODEL NEEDED slots for additional book-canon characters rather than inventing missing models or lore.
- Arena/stage names and exact specifications were not promoted to canon in this pass because the accessible GitHub search did not expose authoritative source data. Unknown remains UNKNOWN.
- Hurricane Kick is tracked for dedicated recovery: it must be reintroduced as a rotating/root-motion special and runtime-certified, not silently mapped to a normal kick.
- Open-source queue explicitly includes Quaternius Universal Animation Library 1 and 2, with root-motion/in-place distinctions preserved and license/provenance gates.


## Continuation pass — 2026-09-28 13:14 CDT

- Merged PR #18 (611332e): combat animation startup is now arena-first. Required combat owners and explicit paired receivers load before the rest of the baked bank; remaining clips hydrate in the background. This directly addresses the measured real-playtest startup bottleneck where the arena was reached with 0 rigs at roughly 2.3 fps while the full baked corpus was loading.
- Merged PR #19 (924fdd4): canon/arena/stage/roster ledger and production rules are now on main, including MODEL_NEEDED placeholders for book-canon characters and UNKNOWN gates for unverified stage facts.
- Production law remains: static gates can reject bad work, but they cannot promote runtime animation to PASS. Runtime PWA evidence is still required.
- Next repair lane: rerun the real Chromium PWA gate against the arena-first loader, isolate the remaining runtime failure from its captured evidence, then restore Hurricane Kick as an actual rotating/root-motion special and certify it in-browser.
- Grapples remain two-body events: attacker and receiver roles must be paired; receiver reactions cannot fall back to unrelated solo attack clips.
- Open-source animation intake remains bulk-oriented but fail-closed: source -> retarget -> bake -> measure -> runtime PWA test -> promotion. No unverified clip is promoted merely because its filename/reach resembles an attack.


## Combat startup correction — 2026-09-28

- Found a concrete reason the first arena-first loader could still be effectively a full-bank preload: the 455-entry manifest has only 6 explicit `owns` clips, while semantic labels cover 444 entries, largely because 249 clips are labelled `idle`. Treating every required semantic as core therefore selected 444 clips.
- Corrected `selectCoreBakedNames` so startup loads the 6 authoritative owners plus at most one measured candidate per required semantic, with non-UAL/project material preferred and ordinary grounded/full-body clips preferred. Grapple owners additionally pull their paired receiver clips.
- Static manifest replay now selects **20 core clips out of 455**, instead of 444, while preserving attacker/receiver pairing. The remaining bank stays available for background hydration.
- This is a startup/performance correction only; it does not certify any animation visually. Runtime PWA evidence remains mandatory.


## User gameplay test → throw/grapple repair pass — 2026-09-28

The owner personally tested the current PWA and reported that animation quality is improving but still has broad visible failures: walking/forward/back movement, jumping, misplaced/out-of-context clips, grapples whose attacker/receiver halves do not read as the same move, and some throws/moves ending the match too quickly. Forward/back throws were specifically called out for excessive damage and premature match termination.

Concrete implementation findings from that report:

- Directional throws were only opening the defender's break transaction. The attacker was **not actually entering a directional throw animation state**, so the visible attacker could remain on its previous punch/idle animation.
- The directional throw catalog was using generic `heavyAttack` / `knockdown` animation labels rather than the measured grapple clips.
- Forward input plus throw buttons was incorrectly routed into the old side-throw branch, while the `backward` input field was effectively ignored.
- Receiver playback for explicit directional pairs used a zero-duration override, which could release the receiver after the minimum timeout instead of the receiver clip's authored duration.
- Directional throws now have explicit grab/commit/receiver clips:
  - forward: `THROWSTART → KNEETHROW → KNEETHROWREACTION`
  - backward: `RENZOTHROW → RENZOTHROW → RENZOTHROWREACTION`
  - side families use `GRAFTHROW → GRAFTHROWREACTION`
- Directional throws now enter the FSM's real `CommandThrow`/grapple path, switch from grab to commit animation after a successful catch, and force the receiver's paired clip for its measured duration.
- Forward/back input selection is now directional rather than silently becoming a side throw.
- Throw damage was reduced from the previous 180/200 directional values to 120/140, and the generic command throw was reduced from 220 to 160, in direct response to the owner's gameplay report that these interactions were ending matches too quickly.
- Added regression coverage for directional input selection, real grab/commit/receiver clips, receiver pairing, and the new damage bounds.

Important: these are implementation corrections, not a claim that all animation problems are solved. The next gate is the real PWA/Chromium run, followed by systematic locomotion/jump/clip-placement and grapple contact validation.


### Follow-up timing correction — 2026-09-28

- Directional throw commits now carry measured attacker durations as well as receiver durations.
- The FSM keeps the attacker in the directional throw commit for the full authored clip when that exceeds the ordinary recovery window. This specifically prevents long backward/side grapple clips from being cut at ~0.5–0.7s.
- This follows the production law: do not speed a long authored grapple into a twitch and do not let the combat clock pull the animation off-screen before the paired performance finishes.


### Follow-up body-contact + side-throw contract — 2026-09-28

- Found another concrete grapple seam: `defenderPositionOffset` existed in the directional throw catalog but had no runtime reader. Correct attacker/receiver clips could therefore play while the two roots remained at ordinary combat spacing, making a throw read as two unrelated performances or visibly pass through the opponent.
- Directional throw commit now applies the catalog's measured receiver offset in world space, using the attacker's current facing, and writes the resulting position back through `LocomotionSystem.setPosition()` plus the arena refs/state. This is a contact/alignment correction, not a visual fake: the receiver is placed at the declared throw relationship before the paired reaction begins.
- `side_throw_right` was missing its required measured `commitDuration` and `receiverDuration` fields. Those are now explicitly `1.7083s` and `1.375s`, matching the paired `GRAFTHROW/GRAFTHROWREACTION` family and preventing the right-side path from depending on an incomplete timing contract.
- Added regression assertions for side-throw timing and forward/back receiver offsets.
- Current commits on main for this pass: `0ecff3b` (side-throw timing), `3caae34` (runtime body alignment), `71693b7` (regression coverage).
- Runtime certification is still UNKNOWN until the real PWA/Chromium playtest observes the attacker clip, receiver clip, contact spacing, full-duration playback, and damage outcome together.


### Locomotion + per-fighter animation ownership pass — 2026-09-28

- User gameplay report added three concrete requirements to the active repair lane: holding Down must remain a true crouch stance; jumping must drive both the authored jump animation and the world-space jump arc; and fighters must no longer collapse onto one generic base moveset.
- Found that `LocomotionSystem` already contained a real jump arc (`beginJump` / `airborneY`) but the arena never called `beginJump()`. The FSM could enter `Jumping` while the fighter stayed at ground Y. Arena wiring now starts/re-arms the locomotion jump from the same resolved input for both P1 and P2.
- Found that `CharacterMoveSetSystem` and roster `defaultMoveSet` data existed, but normal base attacks and stance playback did not consume those per-fighter slots. The FSM now accepts canonical per-fighter animation choices, uses them for light/heavy/kick/crouch attacks, and exposes fighter-specific motion clips for idle/walk/crouch/guard fallback. Arena binds each fighter's roster move-set slots at match initialization.
- The generic semantic resolver remains the fallback when an owned animation is unavailable or rejected by measured clip gates; this avoids silently playing an unverified clip just because a fighter owns a move ID.
- Runtime certification remains UNKNOWN until the real PWA playtest verifies held crouch, jump arc + jump clip, directional attacks, and distinct fighter animation ownership together.


### Per-fighter special-animation ownership pass — 2026-09-28

- Continued the animation identity repair instead of treating different move IDs as sufficient. The roster has character-specific move IDs and signatures, but ordinary special playback was still sending `special.move.animation` directly to the mesh, bypassing the fighter's owned signature animation slot.
- Special playback now preserves the combat definition (input, frame data, hitbox, damage, cancel behavior) while allowing a fighter-owned signature animation to supply the visual clip for signature/finisher-style specials.
- Normal attack slots already added in the previous pass remain separate from generic semantic state: the FSM selects the fighter's move-set clip while `FighterMesh` continues to use the semantic state for combat timing/root-motion. This prevents changing a clip from changing what the move mechanically is.
- The remaining animation work is intentionally not being declared solved: several roster slots still point at shared generic IDs such as `bf_idle`, `bf_walk_fwd`, `bf_crouch`, and `bf_jab`. Those are legitimate fallback definitions, but they are not evidence of unique authored animations. The production law remains source → retarget → bake → measure → runtime test → promote.
- Runtime status remains UNKNOWN until PWA playtesting verifies held crouch, jump, movement, distinct fighter attacks/signatures, and full animation completion on actual rigs.


### Initial-match animation ownership correction + regression locks — 2026-09-28

- Found a concrete lifecycle bug in the previous per-fighter animation pass: resetForRound() installed each fighter's CharacterMoveSet clip map, but the initial match construction recreated both FighterStateMachine instances without installing those maps. The first playable round could therefore fall back to the shared semantic bank until a round transition.
- Fixed the initial match path so P1 and P2 receive their own roster-derived animation slots immediately after their FSMs are constructed. This applies to idle, walk forward/back, crouch, guard, base attacks, kicks, combos, counters, grapple/throw, knockdown, wakeup, hit reaction, KO, and signature slots.
- Added direct FSM regression coverage proving a fighter-owned light-attack clip is actually selected and that a fighter-owned crouch clip persists while Down remains held and clears after release.
- Changes are on main: 183ffb7f1eeca96f8fbd6fecfc231f5a10d030a8 (initial-match ownership) and 2c6c740c49645b617d31e8d8b3efc37d3a56b1dd (regression tests).
- GitHub reports no workflow run for the latest test commit, so CI is UNKNOWN, not green. Local execution could not be performed in this environment because outbound GitHub network access is unavailable.
- Runtime PWA certification remains UNKNOWN. The next required evidence is an actual browser/mobile playtest confirming: held Down crouch, immediate jump + visible vertical arc, fighter-specific attacks/signatures on the first round, correct directional movement, and no attack clip being overwritten by locomotion state.


### Jump + limb aerial routing pass — 2026-09-28

- Found a concrete input-order bug: jump was evaluated after the grounded LP/RP/LK/RK branches. A simultaneous Up + limb therefore became a standing attack even though the locomotion jump arc had already been armed.
- Added explicit `jumpAttack` routing for jump + punch/kick input. The aerial move keeps its own startup/active/recovery/hitbox data while using the fighter-owned light/heavy clip slot for visual individuality; the FSM motion identity remains `jumpAttack` so the renderer does not confuse the clip with a grounded punch.
- Added regression coverage proving Up + LP enters `jumpAttack`, `Attacking`, and the authored `Jumping Light` move rather than a grounded jab.
- Main commits: `63b128af133a8e6957cf5c68c7cc62f665bd9091` (implementation), `e1df64e3489dac680ef90dc7d3f6e576d4a1ebc4` (test).
- Runtime/browser certification remains UNKNOWN; this pass specifically closes the input-routing seam, not the claim that every aerial clip is visually correct on every rig.


## 2026-09-28 — Aerial attack playback lock/timing correction

- Fixed `FighterMesh` so `jumpAttack` is treated as a real attack state by the visual animation layer instead of falling through the ordinary locomotion path.
- Added the aerial attack window to the same authored-clip hold/reconciliation path used by grounded attacks, with a dedicated 0.65s aerial presentation window.
- This prevents a fighter-specific aerial clip from being immediately treated like a normal jump/locomotion clip and being cut or blended away before the authored attack motion can read.
- Existing `AIR_LIGHT_MOVE` / `AIR_HEAVY_MOVE` frame data remains authoritative for combat timing; this change is visual playback synchronization only.
- **CI:** UNKNOWN until a GitHub Actions run is attached to commit `6164fd0362512adf86a4b65a5a18d1bd9e8e1b56`.
- **Runtime PWA/browser:** UNKNOWN until an actual match verifies jump, aerial strike, landing, contact, and fighter-specific clip playback together.
- **Promotion rule:** do not mark aerial clips PASS from static code alone.


### Airborne PR26 integration correction — 2026-09-28

- CI on the first PR26 revision exposed four integration regressions rather than a problem with the airborne routing itself.
- Corrected the ordering so aerial input is not pre-empted by the generic special resolver.
- Corrected fighter-owned special presentation so the selected authored clip is retained on the active MoveWindow, which is the renderer's authoritative active-clip path.
- Corrected attack start handling so non-aerial authored fighter clips can drive presentation without destroying semantic combat state; aerial attacks deliberately retain `jumpAttack` as the semantic state.
- Latest correction commit: `e332d22e282e0a0d20820ff4a1f25f124282261a`.
- GitHub Actions run #435 is attached to this revision and is currently pending. No CI/PWA PASS is claimed until its actual tests and browser stages complete.


### Fighter-owned special presentation pass — 2026-09-28

- Continued directly on `main` in `mhvnsnt/brutalfistgrokversionten`; this pass did not switch to another repository.
- Found that the previous fighter-owned clip routing covered ordinary attacks and signature/finisher specials, but the shared `quick_combo` / `power_surge` path could still fall back to the same generic semantic clip for every fighter.
- `clipForSpecial()` now routes shared combo/surge specials through the fighter's `primaryCombo` clip when one is owned, counter/reversal specials through `counter`, and throw/grapple/suplex-named specials through `primaryThrow`. Signature/finisher routing remains highest priority.
- Combat semantics remain unchanged: input sequence, frame data, hitbox, damage, and cancel behavior still come from the shared special definition; only the visual clip is fighter-owned.
- Added a deterministic regression test proving a shared combo definition can resolve to a fighter-owned primary-combo clip.
- Main commits: `a997500e` (implementation), `d8823489` (regression test).
- CI/runtime PWA visual certification is still UNKNOWN until the browser playtest observes the resulting clips on real Bannon/Kobra rigs.


### Full roster individuality expansion — 2026-09-28

- User clarified the real problem: the sameness is not limited to specials; the entire combat/roster layer needs Tekken-style character-specific attacks and gameplay, and more open-source animation must be pulled in when the existing bank is insufficient.
- Confirmed the existing roster already contains many different move IDs, but the runtime only exposed a small generic semantic attack surface. This meant distinct roster data could collapse back to generic LP/RP/LK/RK behavior.
- Added directional move slots to CharacterMoveSet: forward LP/RP/LK/RK, back LP/RP/LK/RK, and down-forward light/heavy branches.
- Added separate fighter move-ID storage in FighterStateMachine so gameplay data cannot be confused with animation clip names.
- Directional branches now resolve the selected catalog move's startup, active/recovery, damage, hitstun, pushback and hitbox data while retaining a stable semantic combat state for renderer/collision handling.
- Bound those move IDs and clips during both initial match creation and round/match resets.
- Added regression coverage for a fighter-owned directional catalog move and for distinct directional identities between roster members.
- Added persistent backlog at docs/PRODUCTION_GAPS.md so future animation, roster, input, grapple, open-source and PWA-certification gaps remain tracked.
- Expanded docs/OPEN_SOURCE_ANIMATION_INTAKE.md with KayKit Character Animations as a CC0 candidate source and with the larger per-character move-graph target.
- Main implementation sequence: 6241232f (directional slots), 1075d7d9 (slot library), 1644acfe (catalog frame-data resolution), 1092e552 (directional kick slots), 85ff8149 (directional input routing), cbd013ff (fighter-specific synthesized defaults), fd216f68 (separate move IDs from clips), e7dc4f36 (initial-match binding cleanup), 42054a30 (reset binding), c68b7584 + 17667bac (tests), 389cf2c1 (open-source intake update), a0192d18 (persistent gaps).
- CI/browser runtime certification is still UNKNOWN; no GitHub Actions workflow run was attached to the latest test commits when checked.


### PWA intro / canon-stage / grapple handoff — 2026-09-28

- Repo Co Dev is building the real 60-second intro renderer on a separate branch: tap-to-start gate for browser audio autoplay permission, Skip control, Esc/Enter/Start keyboard equivalents, clean handoff to the existing start screen, and a missing-video fallback straight to the start screen. The actual rough-cut video is intentionally not added to main until the owner's media pass is ready.
- Owner production is supplying music, arena backgrounds, the Great Banyan Tree environment, fighter placement marks, and the Cyborg Stick-Up stand-in. Stand-ins remain clearly labeled and unpublished until the real captures/models exist.
- PR #23 (grok/canon-stages-and-grapple-pairs) contains 8 canon graybox stages and 8 Bannon grapple/aerial capture imports with provenance. It remains a draft and is currently based on the pre-typecheck-fix main, so it is not merged yet.
- Merged PR #22 (grok/fix-main-typecheck) into main as 6fd4c07d32348c7427b380771bea8ebc6040dd0d; this removes the pre-existing TypeScript errors in CharacterMoveSetSystem, DirectionalThrowSystem, and FighterStateMachine without changing intended runtime behavior.
- PR #20 (grok/per-fighter-movesets) contains the larger style-driven 27-fighter moveset/OSS intake pass: measured style profiles, generated move windows/strings, 113 baked OSS strike candidates, and 141/269 intake passes. It remains a draft and is based on the earlier main, so it must be reconciled with current main before promotion.
- Runtime rule remains unchanged: static tests/builds and intake measurements do not equal PWA visual certification. Intro playback, audio unlock, skip/handoff, stage rendering, grapples, and per-fighter move individuality remain UNKNOWN until observed in the browser/PWA.


### PWA intro gate wired on main — 2026-09-28

- Added `src/components/IntroVideoGate.tsx` and wired it into `src/App.tsx` before `TitleScreen`.
- The gate uses `/intro/brutal-fist-intro.mp4` as the production media path, waits for a user gesture before calling `video.play()` with sound enabled, supports TAP TO START, Enter/Space/S, Escape, gamepad Start (button 9), an on-screen SKIP button after playback begins, and `ended` handoff to the existing title/start screen.
- Missing or unloadable intro media calls the same completion path, so the PWA falls through directly to the existing start screen instead of trapping the player on a blank/video error state.
- This is the shell for Repo Co Dev's separate rough-cut renderer; the actual 60-second media file is intentionally not fabricated or committed here.
- Runtime status: UNKNOWN until the PWA is opened with the real media file and the browser observes audio unlock, playback, skip, natural completion, and missing-file fallback.


### PR20/PR23 non-destructive reconciliation completed — 2026-09-28

- PR #20 and PR #23 were not force-merged from their old `db752c8` base. Two fresh reconciliation branches were created from current `main`.
- PR #24 reconciled the PR23 stage/blockout + named-grapple work onto current main and merged as `a8e8d6a375b3fd20e0c7f5c15e214876312b0949`.
- PR #25 reconciled the PR20 per-fighter style/move-window/OSS intake work onto current main and merged as `90cca08a568caa19ba2f9bb0aca87d773b8f83c9`.
- Original PR #20 and PR #23 were closed as superseded, preserving their history while removing the stale merge targets.
- The reconciled pass preserves the current main intro/typecheck work rather than resetting files to the old PR base.
- Added `docs/NAMED_GRAPPLE_TECHNICAL_MAP.md` to make technical move definitions and capture gaps explicit. Cody Buster remains UNKNOWN rather than being guessed; Titan Fall is documented as a throat-grab chokeslam; Hall Street Justice is documented as a street-fight combo ending in a knee; Getbackk is the F5-style fireman's-carry tornado slam; Chainsnatcher is the jumping double-knee backstabber and its current knee-bash pair remains a stand-in.
- Owner footage for Getbackk and Chainsnatcher can be captured with Bannon's `tools/mocap/video_to_clip.py --two`, producing attacker + receiver halves from one take. Runtime certification of the newly reconciled assets remains UNKNOWN until the PWA is exercised.


### Airborne / dive attack routing — 2026-09-28

- Added `src/engine/combat/AirborneDiveSystem.ts` as the explicit airborne routing layer. Up/jump creates the airborne window; the attack press selects neutral, forward, or back airborne routing.
- Fixed the existing FSM behavior so an attack can be pressed **after** the jump edge while the fighter is still airborne. Previously the jump-attack branch required `resolvedInput.jump` and therefore effectively required attack on the jump frame.
- Added facing-relative command semantics: neutral airborne attack = 8, forward + up = 9, back + up = 7. These are routing commands, not claims that an exact named animation exists.
- Added stage-dive metadata to `StageConfig` and registered initial launch points for the dojo upper edge, wrestling-ring ropes, steel-cage top, industrial upper catwalk, and sky-crane edge. Traversal/render runtime still requires browser/PWA evidence before this is called VERIFIED.
- Named elbow drops, moonsaults, and other diving signatures remain authored-motion slots; no generic clip is being mislabeled as one.
- Added regression coverage for delayed mid-air attack, directional airborne attack, stage-origin falling attack, and grounded rejection.
- Getbackk and Chainsnatcher remain exact-capture jobs: owner footage should enter through `video_to_clip.py --two` as attacker + receiver pairs. No stand-in was promoted to exact.
- Runtime/CI status remains UNKNOWN until the branch is built/tested and the PWA is exercised with the actual media/assets.


### Airborne PR #26 promoted to main — 2026-09-28

- PR #26 was merged non-destructively with a normal merge commit: `618451e2767bcdf967f38e6f60e749a90e06db10`.
- The merge preserves the full PR history and does not reset or rewrite `main`.
- The promoted work includes delayed airborne attack input, neutral/forward/back airborne routing, stage-dive launch metadata, regression coverage, and the fighter-owned presentation integration corrections.
- The branch had no current CI status attached at merge time; therefore the merge is a source-control promotion, **not** a claim of CI or PWA certification.
- Next gate is deployment/browser verification on `main`; any runtime issue will be fixed with a new follow-up commit/PR so this merged history remains intact.


## GitHub Pages PWA deployment hardening — 2026-09-28

- Inspected the live deployment path on `main` rather than treating the PR merge as a PWA verification.
- Confirmed `.github/workflows/pages.yml` is the repository's GitHub Pages PWA publisher and triggers on pushes to `main`.
- Hardened the workflow with `actions/configure-pages@v5` and upgraded `actions/upload-pages-artifact` to `@v4`, matching the current GitHub Pages custom-workflow deployment pattern.
- Commit: `6b4589b705da76bb7ce9235febbac789232d1c05`.
- The workflow still builds the Vite bundle with the repository base path, stamps the service-worker cache generation, creates `404.html`, runs `verify-pwa-build.mjs`, uploads `dist`, and deploys through the `github-pages` environment.
- IMPORTANT: GitHub connector access available in this session does not expose the push-triggered Pages run/deployment result, and web access could not open the private/live deployment endpoint. Therefore runtime/PWA visual status remains UNKNOWN rather than being called PASS.
- Next runtime gate: obtain the actual Pages deployment URL/run result, then browser-test the Brutal Fist match flow (including the current canon Bannon/Kobra roster pairing) on the newly deployed generation before calling the PWA verified.


## Locomotion + knockdown correction pass — 2026-09-28

- Owner runtime report promoted to P0: ordinary walking was visually reading as hyper-speed skating, and P2 AI pursuit made both bodies translate together across the arena when P1 retreated.
- Root cause found in the current architecture: programmatic locomotion was using a 1.72 m/s walk tier while P2 AI continuously requested forward pursuit whenever outside its preferred gap. That made a player retreat and AI pursuit look like one sliding pair. Walk/run/backdash were not sufficiently separated in the browser feel.
- Tuned locomotion tiers on main to deliberate walk 1.15 m/s, dash/run 3.2 m/s, backdash 2.7 m/s, sidestep 1.0 m/s; matched the unknown-clip animation playback fallback to 1.15 m/s.
- Changed P2 pursuit to short approach pulses with a larger neutral band instead of continuously chasing the player. This preserves approach behavior without gluing both fighters together across the stage.
- Added an authored `Smackdown` reaction to the canonical heavy-kick move so an ordinary playable attack now has an explicit grounded knockdown path instead of relying only on imported moves that may not be selected by the basic controls.
- Updated the locomotion pace regression to enforce the new deliberate-walk contract and a clearly distinct dash tier.
- IMPORTANT: these are source-level fixes; PWA/browser visual status remains UNKNOWN until the deployed generation is actually played. Do not call the walk, knockdown, or animation PASS from tests alone.


### Project identity correction — 2026-09-28

- **Brutal Fist is the active game in this repository (mhvnsnt/brutalfistgrokversionten).** Bannon is a separate game/project. The two share canon, characters, assets, footage, and other production resources where appropriate, but they are not the same game and must not be described as interchangeable.
- “Make Bannon playable” is therefore not the project objective for this repo. The objective here is to make **Brutal Fist** playable and complete its own PWA/game flow. Bannon-derived material is treated as shared source/canon/asset input, not as a rename of the game.
- Future production logs, PWA checks, animation work, combat work, stages, roster work, and open-source intake for this repository will be labeled **Brutal Fist** unless a Bannon asset/source is specifically being referenced.
- Current deployment evidence: GitHub Pages run 36489445419 built and deployed main commit 7c70faba6b27aeb2946bc860437beda3a796ec47 successfully. This proves the new bundle reached the Pages deployment pipeline; it does **not** by itself prove that an already-installed phone PWA has refreshed to that generation. The service worker uses commit-stamped cache generations and controller-change/update checks, so the remaining gate is actual device/browser observation of the deployed Brutal Fist build.
