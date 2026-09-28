# Open-source unarmed intake (CC0 + CMU) through the #17 universal pipeline

Status: **intake-measured, statically gated, runtime UNKNOWN.** Nothing here has been
watched in the PWA. PASS below means the clip passed the #17 intake, the bake's
joint-limit/hinge constraint chain, a fidelity check against its own source and
the category gates. It is not visual certification.

Tool: `tools/anim-intake/cc0_unarmed_intake.ts`
Output: `tools/anim-intake/cc0-unarmed-intake.json`, one record per clip with
provenance, sha256, licence class, both pipeline paths, the measurements and the reasons.

```
node --experimental-strip-types --import ./scripts/register-ts-resolve.mjs \
  tools/anim-intake/cc0_unarmed_intake.ts --bake        # staging: /workspace/oss-anim-staging
node --experimental-strip-types --import ./scripts/register-ts-resolve.mjs \
  tools/moves/build_style_movesets.mjs --write --families
node scripts/pack-motion-zstd.mjs
```

## Sources and licence classes

| Source | Licence class | Rig |
|---|---|---|
| Quaternius UAL1 / UAL2 (free Standard tier) | CC0-1.0 | 65-joint UE-mannequin style |
| KayKit Character Animations 1.1 | CC0-1.0 | 23-joint (no neck/clavicle/fingers) |
| Mesh2Motion human | CC0-1.0 (animations; code MIT, not used) | 66-joint UE style, lowercase `head` |
| CMU mocap (cgspeed BVH to GLB segments) | **CMU-free-use (not CC0)**, owner-approved | 31-joint, skeleton-only, metres |

Every baked clip carries `provenance.license` and the source file and sha256 (the
BVH sha256 for CMU). `oss-intake-pool.test.ts` enforces that on every `OSS_*` entry.

## What the pipeline got wrong, found by measuring (fixed)

1. **#17 source rest was only honoured for the 17 canonical bones.** Every other
   bone (Spine1, clavicles, toes, fingers) fell back to "frame 0 = bind", which
   snapped the first frame to bind. LeftShoulder and LeftArm also both resolve to
   canonical `LUpperArm`, so the arm's rest landed on the clavicle. A UAL jab
   that converts at 3.6 deg effector error came out of `normalizeUniversalAnimation`
   at 41 deg. Fix in `UniversalAnimationPipeline.ts`: an exact target-name match
   wins, and the canonical alias is only a fallback. There is a regression test in
   `UniversalAnimationPipeline.test.ts`. Runtime callers are unaffected: the only
   runtime caller, `recoverBannonEulerClip`, passes Bannon names whose rest is
   already frame 0.
2. **Bannon's skeleton is mirror-handed** relative to UAL, KayKit, Mesh2Motion and
   CMU. It faces +X with its LEFT side at +Z (see `scripts/audit-fighter-facing.mjs`).
   A rotation cannot align them, so the tool builds the rest alignment from anatomy
   (up = pelvis to head, forward = toes, left = shoulders). The result is a
   reflection (det -1).
3. **The as-shipped #17 path is not usable for these rigs.** The alias layer
   resolves 6-9 of 23-65 source bones (pelvis, head, hands and feet only; no
   arms, legs or spine), and local deltas are applied across different bone
   axes. Its mean effector error was 15-160 deg on every clip, so **0 of
   269 passed as-shipped**. The tool's rig-profile path is an explicit
   per-rig bone map plus a world-space rest conversion (world delta, then a
   swing onto the source bone direction). It feeds the SAME
   `normalizeUniversalAnimation()` for rest fills and the verdict.
4. `normalizeUniversalAnimation()` reads the target rest from the LIVE bone
   quaternions. Callers must reset the rig to bind first. The tool does, and the
   hazard is documented in the tool.

## Gates (all measured on Bannon after the #17 call and the bake constraints)

- **faithful**: effector direction error mean<=12 deg and max<=40 deg vs source-on-own-skeleton
- **punch**: handOut>=0.19H (StrikeClipPool reach floor 0.35 m at 1.8 m) and travel>=0.08H (static-guard floor), dur<=2.2s, torso min>=0.65
- **kick**: foot reach>=0.33H against per-frame OR opening facing, dur<=2.2s
- **knee**: knee rises to >=-0.06H of hips and >=0.15H forward
- **hitReact**: torso min>=0.5, end>=0.8, dur<=1.2s
- **knockdown**: starts upright, ends height<=0.5H with torso<=0.5 (lying), upright-to-floor<=1.2s
- **wakeup**: starts height<=0.55H, ends >=0.85H upright, dur<=2.5s
- **dodge**: source root travel >=0.12H; lateral dominant = sidestep; dur<=1.2s
- **Semantic refusals:** weapon blocks (prop held), KayKit skeleton-monster set,
  zombie, running strafes, feet-first slides.
- **Whole-body outcome is measured first:** a "hit reaction" that ends lying is
  classified as a knockdown, not a hitstun.
- **Knockdown slot:** the fall must be under 1.2 s (a controlled lie-down is refused).

## Results: 269 candidates, 141 PASS, 128 REJECT

By filed category: {"knockdown": {"candidates": 18, "pass": 5}, "hit-react": {"candidates": 9, "pass": 3}, "strike-punch": {"candidates": 108, "pass": 97}, "dodge/sidestep": {"candidates": 72, "pass": 16}, "block": {"candidates": 7, "pass": 1}, "wakeup": {"candidates": 15, "pass": 3}, "strike-kick": {"candidates": 19, "pass": 13}, "knee": {"candidates": 3, "pass": 3}, "grapple/throw": {"candidates": 18, "pass": 0}}

**Baked into the strike bank:** 113 strike clips (punch/kick/knee
PASS only, as `public/motion/baked/OSS_*.json`, stamped `intake: oss-universal-intake`).
Hit reactions, knockdowns, wakeups, dodges and blocks that passed are recorded in
the JSON but **not baked**. Those slots are owned by other systems. Wiring them in
is future work; until then they are UNKNOWN at runtime.

**Strike pool: 35 to 135 clips.** `StrikeClipPool`'s own refusal and reach gates
decide admission. It admitted 100 of the 113 baked clips and refused 13 (no-reach 9,
turned-away 2, inverted 2). There is a knee admission rule (kneeReach >= 0.2,
counted as a kick). The 3 CMU knees currently get in through foot reach.

### CC0 clips (every candidate)

| Pack | Clip | Filed | Measured | #17 verdict | As-shipped err (deg) | Rig-profile err mean/max (deg) | Result | Reasons |
|---|---|---|---|---|---|---|---|---|
| ual-1 | Death01 | knockdown | knockdown/lands-lying | PARTIAL | 119.5 | 12.7/56.7 | **REJECT** | retarget not faithful: effector error mean 12.7 deg, max 56.7 deg (gate mean<=12, max<=40) |
| ual-1 | Hit_Chest | hit-react | hit-react/standing | PARTIAL | 160.5 | 2.9/8.7 | **PASS** |  |
| ual-1 | Hit_Head | hit-react | hit-react/standing | PARTIAL | 163.5 | 2.8/8.3 | **REJECT** | no measurable recoil (head moves 0.039H < 0.04H) |
| ual-1 | Punch_Cross | strike-punch | strike-punch/long | PARTIAL | 132.8 | 7.3/45.4 | **REJECT** | retarget not faithful: effector error mean 7.3 deg, max 45.4 deg (gate mean<=12, max<=40) |
| ual-1 | Punch_Jab | strike-punch | strike-punch/short | PARTIAL | 136.5 | 8.4/29.7 | **PASS** |  |
| ual-1 | Roll | dodge/sidestep | roll | PARTIAL | 132.1 | 10.7/54.9 | **REJECT** | retarget not faithful: effector error mean 10.7 deg, max 54.9 deg (gate mean<=12, max<=40) |
| ual-2 | Hit_Knockback | hit-react | falls-over | PARTIAL | 93.6 | 9.4/56 | **REJECT** | retarget not faithful: effector error mean 9.4 deg, max 56 deg (gate mean<=12, max<=40); measured falls-over: torso min -0.082, end 0.014 |
| ual-2 | Idle_Shield_Break | block | block/guard-up | PARTIAL | 151.7 | 4.3/22.3 | **REJECT** | weapon block (shield/sword guard): the pose holds a prop the fighters do not carry |
| ual-2 | Idle_Shield_Loop | block | block/guard-up | PARTIAL | 151.7 | 3.7/8.8 | **REJECT** | weapon block (shield/sword guard): the pose holds a prop the fighters do not carry |
| ual-2 | LayToIdle | wakeup | wakeup/floor-to-stand | PARTIAL | 129.1 | 6.2/30.8 | **PASS** |  |
| ual-2 | Melee_Hook | strike-punch | strike-punch/long | PARTIAL | 123.2 | 10.6/48.1 | **REJECT** | retarget not faithful: effector error mean 10.6 deg, max 48.1 deg (gate mean<=12, max<=40); torso drops to 0.601 (not a standing strike) |
| ual-2 | Melee_Hook_Rec | strike-punch | no-reach | PARTIAL | 130.5 | 7.3/26.9 | **REJECT** | hand reach 0.18H / travel 0.391H below the punch gate (reach>=0.19H ~0.35 m, travel>=0.08H) |
| ual-2 | Slide_Exit | dodge/sidestep | wakeup/floor-to-stand | PARTIAL | 106.6 | 13.8/46.5 | **REJECT** | retarget not faithful: effector error mean 13.8 deg, max 46.5 deg (gate mean<=12, max<=40); feet-first floor slide (running-slide set), not a fighting evasion |
| ual-2 | Slide_Loop | dodge/sidestep | in-place (no measurable root travel; direction not certifiable) | PARTIAL | 71.9 | 15.2/46.5 | **REJECT** | retarget not faithful: effector error mean 15.2 deg, max 46.5 deg (gate mean<=12, max<=40); no source root travel: cannot certify dodge direction; too long for a sidestep/dodge (2s > 1.2s); feet-first floor slide (running-slide set), not a fighting evasion |
| ual-2 | Slide_Start | dodge/sidestep | in-place (no measurable root travel; direction not certifiable) | PARTIAL | 84.7 | 13.8/48.1 | **REJECT** | retarget not faithful: effector error mean 13.8 deg, max 48.1 deg (gate mean<=12, max<=40); no source root travel: cannot certify dodge direction; feet-first floor slide (running-slide set), not a fighting evasion |
| ual-2 | Sword_Block | block | block/guard-up | PARTIAL | 149.5 | 4.8/23.1 | **REJECT** | weapon block (shield/sword guard): the pose holds a prop the fighters do not carry |
| kaykit-CA | Melee_Unarmed_Kick | strike-kick | strike-kick/front-or-round | PARTIAL | 43.4 | 6.7/21.7 | **PASS** |  |
| kaykit-CA | Melee_Unarmed_Punch | strike-punch | strike-punch/long | PARTIAL | 41.9 | 7.7/46.1 | **REJECT** | retarget not faithful: effector error mean 7.7 deg, max 46.1 deg (gate mean<=12, max<=40) |
| kaykit-CA | Melee_Unarmed_Smash | strike-punch | strike-punch/short | PARTIAL | 56.4 | 7.7/28.8 | **REJECT** | too long for a strike slot (3.467s > 2.2s); torso drops to 0.056 (not a standing strike) |
| kaykit-CA | Melee_Block | block | block/guard-up | PARTIAL | 29.1 | 5.5/14.4 | **REJECT** | weapon block (shield/sword guard): the pose holds a prop the fighters do not carry |
| kaykit-CA | Melee_Block_Hit | block | block/guard-up | PARTIAL | 25.7 | 5.5/14.1 | **REJECT** | weapon block (shield/sword guard): the pose holds a prop the fighters do not carry |
| kaykit-CA | Melee_Blocking | block | block/guard-up | PARTIAL | 27.6 | 5.7/14.9 | **REJECT** | weapon block (shield/sword guard): the pose holds a prop the fighters do not carry |
| kaykit-CA | Melee_Unarmed_Attack_Kick | strike-kick | strike-kick/front-or-round | PARTIAL | 36.7 | 7.2/23.1 | **PASS** |  |
| kaykit-CA | Melee_Unarmed_Attack_Punch_A | strike-punch | strike-punch/short | PARTIAL | 35.9 | 8/26 | **PASS** |  |
| kaykit-CA | Death_A | knockdown | knockdown/lands-lying | PARTIAL | 48.3 | 4.3/8.4 | **PASS** |  |
| kaykit-CA | Death_B | knockdown | knockdown/lands-lying | PARTIAL | 40.9 | 5.4/16 | **PASS** |  |
| kaykit-CA | Hit_A | hit-react | hit-react/standing | PARTIAL | 14.7 | 3.7/5.7 | **PASS** |  |
| kaykit-CA | Hit_B | hit-react | hit-react/standing | PARTIAL | 22.5 | 5.6/13.3 | **PASS** |  |
| kaykit-CA | Spawn_Ground | wakeup | wakeup/floor-to-stand | PARTIAL | 28.8 | 7.8/131.5 | **REJECT** | retarget not faithful: effector error mean 7.8 deg, max 131.5 deg (gate mean<=12, max<=40) |
| kaykit-CA | Dodge_Backward | dodge/sidestep | dash/back | PARTIAL | 32.2 | 5.3/14.2 | **PASS** |  |
| kaykit-CA | Dodge_Forward | dodge/sidestep | dash/forward | PARTIAL | 28.5 | 8/29.2 | **PASS** |  |
| kaykit-CA | Dodge_Left | dodge/sidestep | sidestep/left | PARTIAL | 27.6 | 6.3/13.6 | **PASS** |  |
| kaykit-CA | Dodge_Right | dodge/sidestep | sidestep/right | PARTIAL | 33.3 | 6.2/13.7 | **PASS** |  |
| kaykit-CA | Running_Strafe_Left | dodge/sidestep | in-place (no measurable root travel; direction not certifiable) | PARTIAL | 34.1 | 9.7/45.8 | **REJECT** | retarget not faithful: effector error mean 9.7 deg, max 45.8 deg (gate mean<=12, max<=40); no source root travel: cannot certify dodge direction; locomotion strafe cycle, not a Tekken sidestep |
| kaykit-CA | Running_Strafe_Right | dodge/sidestep | in-place (no measurable root travel; direction not certifiable) | PARTIAL | 35.4 | 9.3/46.3 | **REJECT** | retarget not faithful: effector error mean 9.3 deg, max 46.3 deg (gate mean<=12, max<=40); no source root travel: cannot certify dodge direction; locomotion strafe cycle, not a Tekken sidestep |
| kaykit-CA | Lie_Down | knockdown | knockdown/lands-lying | PARTIAL | 67.2 | 9.1/39.2 | **PASS** |  |
| kaykit-CA | Lie_Idle | knockdown | lying-hold | PARTIAL | 144 | 9/16.5 | **REJECT** | measured lying-hold: start torso -0.017, end height 0.265H |
| kaykit-CA | Lie_StandUp | wakeup | wakeup/floor-to-stand | PARTIAL | 82.2 | 8.8/30.6 | **PASS** |  |
| kaykit-CA | Sit_Floor_StandUp | wakeup | wakeup/floor-to-stand | PARTIAL | 21 | 7.4/32.9 | **PASS** |  |
| kaykit-CA | Skeletons_Awaken_Floor | wakeup | not-a-floor-wakeup | PARTIAL | 58.2 | 10.4/75.3 | **REJECT** | retarget not faithful: effector error mean 10.4 deg, max 75.3 deg (gate mean<=12, max<=40); measured not-a-floor-wakeup: start height 0.194H, end height 0.779H, end torso 0.909; stylised skeleton-monster performance (semantic mismatch for human fighters) |
| kaykit-CA | Skeletons_Awaken_Floor_Long | wakeup | not-a-floor-wakeup | PARTIAL | 52.2 | 9.3/80.8 | **REJECT** | retarget not faithful: effector error mean 9.3 deg, max 80.8 deg (gate mean<=12, max<=40); measured not-a-floor-wakeup: start height 0.194H, end height 0.779H, end torso 0.909; too long for a wakeup (3.833s > 2.5s); stylised skeleton-monster performance (semantic mismatch for human fighters) |
| kaykit-CA | Skeletons_Death | knockdown | ends-crouched (torso upright) | PARTIAL | 78.3 | 12.4/26.6 | **REJECT** | retarget not faithful: effector error mean 12.4 deg, max 26.6 deg (gate mean<=12, max<=40); measured ends-crouched (torso upright): start torso 0.909, end height 0.296H; stylised skeleton-monster performance (semantic mismatch for human fighters) |
| kaykit-CA | Skeletons_Death_Resurrect | wakeup | not-a-floor-wakeup | PARTIAL | 65.8 | 9.6/26.7 | **REJECT** | measured not-a-floor-wakeup: start height 0.296H, end height 0.779H, end torso 0.909; too long for a wakeup (2.7s > 2.5s); stylised skeleton-monster performance (semantic mismatch for human fighters) |
| kaykit-CA | Skeletons_Spawn_Ground | wakeup | not-a-floor-wakeup | PARTIAL | 44.5 | 7.9/40.3 | **REJECT** | retarget not faithful: effector error mean 7.9 deg, max 40.3 deg (gate mean<=12, max<=40); measured not-a-floor-wakeup: start height 1.154H, end height 0.984H, end torso 0.997; too long for a wakeup (3.567s > 2.5s); stylised skeleton-monster performance (semantic mismatch for human fighters) |
| mesh2motion | Attack_Ground_Pound | strike-punch | strike-punch/short | PARTIAL | 135.7 | 8/36 | **REJECT** | too long for a strike slot (2.708s > 2.2s); torso drops to 0.366 (not a standing strike) |
| mesh2motion | Death_A | knockdown | knockdown/lands-lying | PARTIAL | 131.8 | 7.6/20.2 | **REJECT** | controlled lie-down, not a knockdown: upright-to-floor takes 1.425s (> 1.2s) |
| mesh2motion | Death_B | knockdown | knockdown/lands-lying | PARTIAL | 114.7 | 9.5/64.5 | **REJECT** | retarget not faithful: effector error mean 9.5 deg, max 64.5 deg (gate mean<=12, max<=40) |
| mesh2motion | Death_C | knockdown | knockdown/lands-lying | PARTIAL | 103.3 | 8.7/20.5 | **PASS** |  |
| mesh2motion | Defend | block | block/guard-up | PARTIAL | 132.2 | 7/17.2 | **PASS** |  |
| mesh2motion | Dizzy | hit-react | hit-react/standing | PARTIAL | 142.1 | 8.5/20.8 | **REJECT** | too long for a hitstun reaction (2.417s > 1.2s); loop/stagger use only |
| mesh2motion | Dodge_back | dodge/sidestep | dash/back | PARTIAL | 154.7 | 6.8/22.6 | **PASS** |  |
| mesh2motion | Dodge_left | dodge/sidestep | sidestep/left | PARTIAL | 134.5 | 6.8/18.4 | **PASS** |  |
| mesh2motion | Dodge_right | dodge/sidestep | sidestep/right | PARTIAL | 136.3 | 7.3/19.9 | **PASS** |  |
| mesh2motion | Fighting Left Jab | strike-punch | strike-punch/long | PARTIAL | 140.1 | 6.6/29.8 | **PASS** |  |
| mesh2motion | Fighting Right Jab | strike-punch | strike-punch/short | PARTIAL | 142.6 | 5.2/19 | **PASS** |  |
| mesh2motion | Idle Hurt | hit-react | hit-react/standing | PARTIAL | 154.2 | 6.7/17.1 | **REJECT** | too long for a hitstun reaction (1.667s > 1.2s); loop/stagger use only; no measurable recoil (head moves 0.013H < 0.04H) |
| mesh2motion | Strafe_left | dodge/sidestep | in-place (no measurable root travel; direction not certifiable) | PARTIAL | 162.3 | 4.7/11.3 | **REJECT** | no source root travel: cannot certify dodge direction; locomotion strafe cycle, not a Tekken sidestep |
| mesh2motion | Strafe_right | dodge/sidestep | in-place (no measurable root travel; direction not certifiable) | PARTIAL | 159.8 | 4.5/11.3 | **REJECT** | no source root travel: cannot certify dodge direction; locomotion strafe cycle, not a Tekken sidestep |
| mesh2motion | Zombie_Rise | wakeup | not-a-floor-wakeup | PARTIAL | 114.8 | 10.5/36.3 | **REJECT** | measured not-a-floor-wakeup: start height 0.14H, end height 0.847H, end torso 0.853; too long for a wakeup (3.375s > 2.5s); zombie performance (semantic mismatch) |
| mesh2motion | Death_D | knockdown | knockdown/lands-lying | PARTIAL | 125 | 10.6/58.1 | **REJECT** | retarget not faithful: effector error mean 10.6 deg, max 58.1 deg (gate mean<=12, max<=40) |
| mesh2motion | Kick_Breach | strike-kick | strike-kick/front-or-round | PARTIAL | 143.4 | 9/30.5 | **PASS** |  |

### CMU subset (208 segments, per the lead's list)

Selection: 135_07 Mawashigeri, 135_11 Yokogeri, spin kicks 87_01/88_06/90_05-07,
the 3 real knees in 86_06 (frames 6219/6464/6710), subject 14 boxing, and every
unpaired sidestep, knockdown and wakeup. Excluded: the 135_01/02 kata knee lifts
and 86_05. PAIRED captures are recorded as REJECTED_MULTI_BODY (grapple-only).

| Filed | Candidates | Pass | Top reject reasons |
|---|---|---|---|
| strike-punch | 98 | 93 | body turns # deg (facing lost) (3); hand reach #H / travel #H below the punch gate (reach>=#H ~# (2) |
| dodge/sidestep | 57 | 9 | retarget not faithful: effector error mean # deg, max # deg  (44); too long for a sidestep/dodge (#s > #s) (29); no source root travel: cannot certify dodge direction (7) |
| knockdown | 8 | 1 | measured lying#hold: start torso #, end height #H (4); measured does#not#reach#floor: start torso #, end height #H (2); retarget not faithful: effector error mean # deg, max # deg  (1) |
| wakeup | 6 | 0 | measured not#a#floor#wakeup: start height #H, end height #H, (5); too long for a wakeup (#s > #s) (4); retarget not faithful: effector error mean # deg, max # deg  (3) |
| knee | 3 | 3 |  |
| strike-kick | 16 | 10 | foot reach #H (per#frame #H, opening facing #H) below the ki (6); retarget not faithful: effector error mean # deg, max # deg  (4) |
| grapple/throw | 18 | 0 | paired two#person capture: ## refuses multi#body clips for s (18) |
| hit-react | 2 | 0 | paired two#person capture: ## refuses multi#body clips for s (2) |

The Yokogeri side kicks mostly fail reach against the opening facing, because the
kata kicks go to the performer's side. Re-facing them would be authoring, not intake.
Most CMU sidesteps fail on length (the segment includes the settle, over 1.2 s)
or on fidelity after the joint constraints.

## Style families (movesets regenerated)

`FighterStyleProfiles.FAMILY_AFFINITY` gives each archetype a pull toward a clip
family. Families: `bank` (original), `boxing` (CMU 14, UAL, M2M jabs), `karate`
(CMU 135), `spin` (CMU 87/88/90), `knee` (CMU 86_06), `brawl` (KayKit, M2M
door-breach kick). Grappler and powerhouse pull knees and brawl; speed pulls
boxing and spin; martial pulls karate and spin. Per-fighter `familyBias`: Static
gets karate +3 and spin +1 ("spinning attacks"); Viper gets spin +1.5.

Clip families per fighter (slots counted over directional + neutral):

| Fighter | Families |
|---|---|
| bannon | bank 22, brawl 7, knee 3 |
| maime | boxing 11, bank 9, karate 9, spin 3 |
| onyx | bank 22, brawl 7, boxing 3 |
| cain_elias | bank 14, boxing 12, knee 4, brawl 2 |
| stick_up | boxing 13, bank 12, karate 4, spin 3 |
| cipher | boxing 12, bank 10, karate 8, spin 2 |
| echo | boxing 13, bank 11, karate 5, spin 3 |
| cody | bank 16, boxing 10, brawl 6 |
| hall_nighter | bank 17, boxing 10, knee 3, brawl 2 |
| static | boxing 15, karate 10, bank 6, spin 1 |
| viper | bank 14, boxing 13, spin 2, karate 2, knee 1 |
| kobra | boxing 13, bank 13, knee 4, spin 1, karate 1 |
| aaron_ruben | bank 19, boxing 10, knee 2, brawl 1 |
| hollow | bank 17, boxing 13, karate 1, knee 1 |
| edwin_kennedy | bank 20, boxing 8, brawl 4 |
| pablo | bank 19, boxing 8, brawl 5 |
| tyneshia | bank 13, boxing 13, knee 4, brawl 2 |
| triple_xxx | boxing 14, bank 11, karate 4, spin 3 |
| el_toro_de_oro | bank 21, boxing 7, brawl 2, spin 2 |
| stan_combs | boxing 15, bank 15, knee 2 |
| brutus | bank 20, brawl 6, boxing 6 |
| titan | bank 17, boxing 8, brawl 4, knee 3 |
| master_sensei | boxing 14, karate 9, bank 9 |
| wreck_patterson | boxing 12, bank 11, knee 6, brawl 3 |
| jager | bank 15, boxing 13, karate 4 |
| finxsse | boxing 16, bank 13, knee 3 |
| tarzanian_devil | boxing 14, bank 14, spin 2, karate 2 |

## Still open / honest limits

- Runtime (PWA) behaviour: **UNKNOWN.** Not run in a browser.
- The fidelity check compares limb directions against the source. It cannot see
  mesh penetration, fist shape (KayKit has no fingers, so hands stay open), foot
  sliding or timing feel.
- Root travel is dropped (engine-owned). Dodge direction is certified from source
  root motion (or the pack's root-motion twin), not played.
- The passing reactions, knockdowns, wakeups and sidesteps are not wired into their
  slots.
- A full `npm run bake` keeps `OSS_*` files and their index entries (the bake now
  skips them in its sweep and carries them forward). Rerun the intake with
  `--bake` after changing the gates.
