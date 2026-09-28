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

## 2026-09-28: OSS unarmed intake (branch grok/per-fighter-movesets, PR #20)

- Ran UAL1/2, KayKit, Mesh2Motion and 208 CMU segments through the #17 intake:
  269 candidates, 141 PASS, 128 REJECT.
- The as-shipped #17 alias path was faithful for 0 clips. Rig-profile maps plus
  a reflection alignment were needed, because the Bannon bind is mirrored.
- Fixed the #17 sourceRest bug (UAL jab error went from 41 deg to 3.6 deg). A
  regression test is added.
- Baked 113 `OSS_*` strike clips. The pool admits 100 of them, so the pool went
  from 35 to 135. `npm run bake` now preserves OSS entries.
- Style families (boxing/karate/spin/knee/brawl) were added to style affinity.
- 27-fighter metrics: 135 distinct clips; overlap average 0.21, max 0.765;
  same-slot same-clip 635 -> 212 of 702. Same 11 fighters: overlap average
  0.53 -> 0.204, max 0.88 -> 0.625.
- Tests: script 242/242; TS 823/825. The 2 failures are pre-existing (directional
  throws real clips; fighter-owned special primary-combo). Typecheck shows the
  5 pre-existing errors only (DirectionalThrowSystem 1, FighterStateMachine 4).
  Build exit 0.
- PWA runtime: UNKNOWN (not browser-run).
