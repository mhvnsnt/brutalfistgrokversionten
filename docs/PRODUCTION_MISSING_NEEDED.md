# Bannon Production Missing / Needed List

This is the persistent cross-agent checklist. Add new concrete missing work here instead of relying on chat history. Items are promoted only from measured repository/runtime evidence or explicit production requirements.

## P0 — Runtime certification

- [ ] Run the current PWA runtime certification pass on real fighter pairs and record visual results. Static tests are not visual PASS.
- [ ] Verify the neutral LP/RP/LK/RK baseline remains intact after every animation-bank promotion.
- [ ] Verify walk/run/strafe transitions do not leave stacked locomotion actions or ghost poses.
- [ ] Certify airborne jump/dive arcs in the PWA, including neutral/back/directional variants.
- [ ] Certify hit reactions, knockdowns, wakeups, crouch attacks, and recovery transitions on multiple fighters.
- [ ] Certify camera/framing and fighter contact during attacks and grapples.

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
