# Bannon Production Missing / Needed List

This is the persistent cross-agent checklist. Add new concrete missing work here instead of relying on chat history. Items are promoted only from measured repository/runtime evidence or explicit production requirements.

## P0 — Current animation follow-through

### Latest verified code gates
- [x] Production PWA GitHub Actions workflow added on `main` (`.github/workflows/bannon-pwa.yml`).
- [x] Grapple runtime now distinguishes a real/baked two-body pair from a duration-based stand-in; stand-ins cannot be certified as real pairs.
- [x] Regression coverage added for certified vs stand-in grapple pairing.
- [ ] CI execution result still needs to appear for the workflow; until then, no build/test/PWA PASS is claimed.
- [x] CI now installs Chromium, serves the production `dist`, and runs a browser runtime smoke (`scripts/verify-pwa-runtime.mjs`) after build/typecheck/test/PWA verification. This proves the built shell mounts in a real browser; it does not replace visual animation certification.


- [x] Grounded resolver now has a dedicated evidence lane so SUPINE/PRONEROTATION/roll/get-up clips are not rejected by standing-only gates.
- [x] Wire the shipped Schwarzerblitz grounded recovery clips: SUPINE/PRONEROTATION, ROLLOUT/ROLLOUTRIGHT, LAZORBACKROLL/LAZORFORWARDROLL, WAKEUPANIMATION, KIP_UP/CORKSCREW_KIP_UP.
- [x] Add `PRONE_HOLD`, a derived static hold from the measured first frame of the real `PRONEROTATION` source, so no-input face-down recovery does not loop a roll.
- [x] Prevent WakeupAttack from silently falling through to a standing jab/heavy when no real grounded attack clip exists.
- [x] Fix runtime ownership bug where the stale attackClip prop could overwrite crouch/locomotion/grounded receiver presentation; attack overrides now require an actual attack state and a runtime-certified clip.
- [x] Add a measured runtime-certified baseline lane for core crouch, walk, sidestep, punches, kicks, and grounded recovery clips. Unverified OSS/style-intake clips remain available for rehabilitation but no longer silently replace the playable baseline.
- [ ] Runtime-certify the new grounded states on multiple fighters in the PWA: face-up, face-down/prone, stay-down, forward/back/side roll, quickstand, backrise, kip-up, and wake attack.
- [ ] Import/certify actual grounded attack clips for SupineReversal / wake-up kick behavior. The current Schwarzerblitz move graph names faceRun2/flyingKick/lowAttack1, but those corresponding clips are not present in the 455-clip baked bank; do not substitute a standing attack.
- [ ] Runtime-certify the new wakeup/jump state routing on multiple fighters; code routing is updated but this is not a visual PASS until the PWA is exercised.
- [ ] Exercise real two-body grapples with different fighter pairs and record deliverer/receiver clip IDs, source, synchronized duration, and contact alignment.
- [ ] Promote only exact/owner/baked grapple pairs to named moves; keep stand-ins visibly/provenance-marked until the matching receiver is captured.
- [ ] Audit suspicious low-motion clips such as HURRICANE_KICK instead of assuming static measurements mean the clip is broken; inspect semantic/body-role/runtime evidence together.
- [ ] Continue repairing isolated limb-axis spikes before joint-limit enforcement, then remeasure chain coherence after the repair.

## P0 — Runtime certification

- [ ] Run the current PWA runtime certification pass on real fighter pairs and record visual results. Static tests and browser smoke are not visual PASS.
- [x] Production CI browser smoke is wired into `main` so runtime mount/page errors fail the gate instead of silently passing a build artifact.
- [ ] Verify the neutral LP/RP/LK/RK baseline remains intact after every animation-bank promotion.
- [ ] Verify walk/run/strafe transitions do not leave stacked locomotion actions or ghost poses.
- [ ] Certify airborne jump/dive arcs in the PWA, including neutral/back/directional variants.
- [ ] Certify hit reactions, knockdowns, wakeups, crouch attacks, and recovery transitions on multiple fighters.
- [ ] Certify camera/framing and fighter contact during attacks and grapples.

## P0 — Animation orientation / joint-frame rehabilitation

- [ ] Audit and repair limb-direction failures where the clip moves but the local joint frame sends the limb through the wrong axis.
- [ ] Treat source/target joint-axis conventions separately from ordinary animation motion; do not “fix” a real authored pose with a global body rotation.
- [ ] Reject ambiguous retarget aliases. A Shoulder/UpperArm collapse must never send two source tracks into one target property, because Three.js blends duplicate property tracks.
- [ ] Use the open-source SkeletonUtils retarget path as the CC0/foreign-rig reference lane where a source skeleton is available, and do not apply the generic bind-relative conversion twice.
- [ ] Add measured limb-chain gates for upper-arm/forearm/knee/hip orientation and preserve intentional acrobatics/capoeira/uprock poses when their geometry is internally coherent.
- [ ] Specifically certify GINGA_FORWARD/BACKWARD/SIDEWAYS, CAPOEIRA variants, BROOKLYN_UPROCK, and BREAKDANCE_UPROCK_TO_GROUND after the new orientation path.

## P0 — Animation corpus rehabilitation

- [ ] Rehabilitate the full baked corpus, not only the currently known-good handful. Each clip needs: finite data, canonical skeleton binding, rest-pose correctness, motion-role classification, body-role classification, strike/contact measurements where applicable, and runtime certification.
- [ ] Do not blanket-re-rig healthy models or attire. Audit each model/attire first and preserve healthy assets.
- [ ] Keep the 21–25 cm residual model-offset group as a measured continuum; do not automatically classify it as NEEDS RE-RIG.
- [ ] Reject frozen/statue clips and wrong-body-role clips from combat ownership rather than silently assigning them to attacks.
- [ ] Keep root-motion and in-place variants distinct; never substitute one for the other without an explicit movement policy.
- [ ] Use working CC0 animation as rebake/reference material for broken clips, while preserving Bannon-specific authored identity.

## P0 — Open-source animation intake

- [ ] Keep Quaternius UAL1 and UAL2 intake reproducible and license-traceable.
- [ ] Index every physically present source asset and its inferred motion roles.
- [ ] Run the bulk intake -> classification -> canonical bake -> continuity gate as one repeatable lane.
- [ ] Expand the CC0 source pool when it materially improves a missing motion family; do not add assets without provenance/license metadata.
- [ ] Prefer official/openly redistributable source packages; do not silently import restricted/proprietary animation packs.
- [x] Add Kenney Animated Characters 3 (CC0) to reproducible source intake as a compatibility/reference lane; do not let its small idle/jump/run set replace Bannon-authored combat clips.
- [ ] Add a selective CMU mocap conversion lane for boxing, kicks, walks/runs, jumps, getting-up, acrobatics and motion transitions. CMU permits use in commercially-sold products but prohibits reselling the motion data itself; converted clips must retain the source terms/acknowledgement.
- [ ] Evaluate Mesh2Motion as an MIT tooling + CC0-animation lane for browser-side/custom retargeting, but only promote exported motion after the same canonical bake and PWA certification gates.
- [ ] Evaluate Styloo's CC0 Robot Character (11 animations, including walk/jump/attack/grab) as a motion/reference source; adapt only animation data that can be legally and technically separated from the source rig.
- [ ] Evaluate KungFuAthlete as a research/reference source for high-dynamic fist, ground, jump, flip and recovery motion; verify dataset redistribution terms before shipping any extracted motion.
- [ ] Keep LAFAN1 as a non-shipping research/reference lane unless its CC BY-NC-ND terms are compatible with the intended Bannon distribution; never silently copy its motion into the shipping corpus.

## P0 — Runtime animation stability

- [ ] Keep authored/per-fighter semantic routing ahead of the certified fallback lane; fallback clips must never flatten fighter individuality.
- [ ] Treat locomotion as a single pose owner: stop stale walk/strafe/idle actions at locomotion handoffs so no double/ghost body can appear.
- [ ] Treat explicit attack clips as authoritative only while the published state is an attack (or a real grapple receiver), preventing stale attack props from overwriting movement.
- [ ] Replay the already-selected clip after integrity recovery; never re-resolve a different semantic clip during the recovery path.
- [ ] Include the FighterMesh runtime-routing contract in CI so these invariants cannot silently disappear.

## P0 — Grapple pairs

- [ ] Attach real two-body grapple pairs to different fighters so the deliverer and receiver are both visible in the PWA.
- [ ] Keep deliverer/receiver roles explicit; receiver clips must never become solo attacks.
- [ ] Finish incomplete named grapples such as Getbackk/Chainsnatcher receiver-pair work rather than substituting generic victims.
- [ ] Expand real pair coverage across throws, command throws, slams, German/suplex, powerbomb, pumphandle, and other authored Bannon grapples.
- [ ] Use certified working pair motion to repair broken pair captures where skeleton/pose semantics match.
- [ ] Add regression coverage whenever a named pair is promoted.

## P1 — Fighter individuality

- [ ] Bind per-fighter movesets to biography/fighting style/skill identity.
- [ ] Ensure directional/special style clips can differ by fighter without overriding certified neutral basics.
- [ ] Expand each fighter beyond the current small set of visibly reliable attacks.
- [ ] Give distinct fighters meaningful attack, defense, movement, grapple, and finisher identities.

## P1 — Combat infrastructure

- [ ] Reconcile the bell-to-bell match-flow gaps documented in the Tekken reference audit.
- [ ] Add complete frame-data fields for generated moves: startup, active, recovery, on-hit, on-block, hit level, punishability, and cancel/chain windows.
- [ ] Complete throw-break rules and directional/wrong-button behavior.
- [ ] Ensure pause state actually gates timers/gameplay.
- [ ] Wire heat/rage/armor/spend systems only where their authored gameplay contracts are defined.
- [ ] Expand wall/floor/contact behavior and ensure damage reaches the intended opponent consistently.

## P1 — Roster / assets

- [ ] Preserve existing Bannon names, bios, styles, and authored GLB assets.
- [ ] Add missing canon characters from the books when their GLB assets are supplied.
- [ ] Continue auditing attire variants independently; do not assume a character-wide universal correction.
- [ ] Keep canonical 58-joint skeleton compatibility as the shipping target where the asset actually supports it.

## P1 — PWA delivery

- [ ] Keep `main` as the playable integration target.
- [ ] Require build/typecheck/test/PWA verification before calling a pass certified.
- [ ] Resolve or intentionally close stale Rocket PRs only after their changes are reconciled non-destructively with current `main`.
- [ ] Keep the PWA preview route usable on mobile.

## Working rules

1. UNKNOWN is never PASS.
2. Measurements are evidence; they are not a substitute for runtime visual certification.
3. Never replace a known-good neutral attack merely because a larger style corpus exists.
4. Never use a receiver/team capture as a solo attack.
5. Never apply a universal model/attire transform without an audit.
6. Prefer reversible, non-destructive changes and keep authored Bannon assets intact.
7. Every new production request that materially affects the game belongs on this list.

## Current automation

The repository currently contains a bulk animation lane:
`npm run animation:bulk-repair`

It is intended to run CC0 intake, source indexing, measured classification, canonical baking, and continuity gating. Its output still requires the PWA visual certification gate before a clip is considered shipping-quality.


## Runtime regression guard — 2026-09-28
- **Ghost-body / duplicate-mixer investigation:** the Claude runtime path for `FighterMesh.tsx` and `LocomotionSystem.ts` is currently identical on `main`; do not introduce a second global animation authority over it.
- **Surgical fix applied:** when a fighter scene/GLB is replaced, the previous normalized `AnimationMixer` is now explicitly stopped and reset during effect cleanup. This prevents an obsolete mixer from continuing to evaluate a retired clone alongside the live fighter, which can present as a double/ghost body.
- **Verification still required:** browser/PWA runtime evidence must confirm one live mixer per fighter, no persistent multi-action owner after settle, and no duplicate visible fighter clone. Static TypeScript/tests are not visual certification.
