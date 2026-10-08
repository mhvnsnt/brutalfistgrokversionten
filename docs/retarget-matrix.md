# Universal retarget matrix

Generated 9/28/2026, 4:04:51 PM CT by `scripts/retarget-matrix.mjs` (full). Machine-readable: `retarget-matrix.json` (clip × fighter → verdict + reasons).

Status law: PASS means every measured check passed on a headless FK + skinning evaluation. It is NOT visual/PWA certification — that stays UNKNOWN until a browser run confirms it. UNMAPPABLE and MISSING_CLIP are shown as failures, never faked.

Checks per cell: requiredBones, noNaN, duration, limbLengths, noFlips, feet, effectors, deforms.

## Totals

870 clips × 69 fighter rigs = 60030 cells.

| PASS | FAIL | UNMAPPABLE | MISSING_CLIP |
|---|---|---|---|
| 53732 | 2158 | 4140 | 0 |

## Top failure reasons

| cells | reason |
|---|---|
| 3174 | UNMAPPABLE: SOURCE_RIG_UNAVAILABLE: N-joint "Root" rig; no rest skeleton ships with this bank |
| 1620 | FAIL: effectors: pN Infinity max Infinity deg |
| 483 | FAIL: deforms: SOURCE_NO_MOTION: source never rotates a mapped joint more |
| 69 | UNMAPPABLE: SOURCE_RIG_UNAVAILABLE: N-joint "Cartwheel" rig; no rest skeleton ships with this |
| 69 | UNMAPPABLE: SOURCE_RIG_UNAVAILABLE: N-joint "CrotchChop" rig; no rest skeleton ships with this |
| 69 | UNMAPPABLE: SOURCE_RIG_UNAVAILABLE: N-joint "RapidChestBeating" rig; no rest skeleton ships wi |
| 69 | UNMAPPABLE: SOURCE_RIG_UNAVAILABLE: N-joint "LipBottomN_L" rig; no rest skeleton ships with th |
| 69 | UNMAPPABLE: SOURCE_RIG_UNAVAILABLE: N-joint "SpinningArmsSpread" rig; no rest skeleton ships w |
| 69 | UNMAPPABLE: SOURCE_RIG_UNAVAILABLE: N-joint "Taunt" rig; no rest skeleton ships with this bank |
| 69 | UNMAPPABLE: SOURCE_RIG_UNAVAILABLE: N-joint "TauntN" rig; no rest skeleton ships with this ban |
| 69 | UNMAPPABLE: SOURCE_RIG_UNAVAILABLE: N-joint "Taunt_KofiKingston" rig; no rest skeleton ships w |
| 69 | UNMAPPABLE: SOURCE_RIG_UNAVAILABLE: N-joint "Tau_ButtSlap" rig; no rest skeleton ships with th |
| 69 | UNMAPPABLE: SOURCE_RIG_UNAVAILABLE: N-joint "Tau_Diva" rig; no rest skeleton ships with this b |
| 69 | UNMAPPABLE: SOURCE_RIG_UNAVAILABLE: N-joint "Tau_GameOver" rig; no rest skeleton ships with th |
| 69 | UNMAPPABLE: SOURCE_RIG_UNAVAILABLE: N-joint "Tau_GeneralFemale" rig; no rest skeleton ships wi |
| 69 | UNMAPPABLE: SOURCE_RIG_UNAVAILABLE: N-joint "Tau_HEADCRACK" rig; no rest skeleton ships with t |
| 69 | UNMAPPABLE: SOURCE_RIG_UNAVAILABLE: N-joint "WBTC" rig; no rest skeleton ships with this bank |
| 67 | FAIL: effectors: pN N max N deg |
| 2 | FAIL: feet: N samples sinking |
| 2 | FAIL: noFlips |

## By clip family

| family | PASS | FAIL | UNMAPPABLE | MISSING_CLIP | pass rate |
|---|---|---|---|---|---|
| baked:bannon | 13400 | 400 | 0 | 0 | 97.1% |
| baked:schwarzerblitz | 11122 | 332 | 0 | 0 | 97.1% |
| baked:ual1 | 3082 | 92 | 0 | 0 | 97.1% |
| baked:ual2 | 2881 | 86 | 0 | 0 | 97.1% |
| cmu:block | 201 | 6 | 0 | 0 | 97.1% |
| cmu:dodge/sidestep | 201 | 6 | 0 | 0 | 97.1% |
| cmu:knee | 201 | 6 | 0 | 0 | 97.1% |
| cmu:knockdown | 134 | 4 | 0 | 0 | 97.1% |
| cmu:strike-kick | 402 | 12 | 0 | 0 | 97.1% |
| cmu:strike-punch | 402 | 12 | 0 | 0 | 97.1% |
| cmu:wakeup | 134 | 4 | 0 | 0 | 97.1% |
| euler:Cartwheel-rig | 0 | 0 | 69 | 0 | 0.0% |
| euler:CrotchChop-rig | 0 | 0 | 69 | 0 | 0.0% |
| euler:LipBottom1_L-rig | 0 | 0 | 69 | 0 | 0.0% |
| euler:RapidChestBeating-rig | 0 | 0 | 69 | 0 | 0.0% |
| euler:Root-rig | 0 | 0 | 3174 | 0 | 0.0% |
| euler:SpinningArmsSpread-rig | 0 | 0 | 69 | 0 | 0.0% |
| euler:Tau_ButtSlap-rig | 0 | 0 | 69 | 0 | 0.0% |
| euler:Tau_Diva-rig | 0 | 0 | 69 | 0 | 0.0% |
| euler:Tau_GameOver-rig | 0 | 0 | 69 | 0 | 0.0% |
| euler:Tau_GeneralFemale-rig | 0 | 0 | 69 | 0 | 0.0% |
| euler:Tau_HEADCRACK-rig | 0 | 0 | 69 | 0 | 0.0% |
| euler:Taunt-rig | 0 | 0 | 69 | 0 | 0.0% |
| euler:Taunt2-rig | 0 | 0 | 69 | 0 | 0.0% |
| euler:Taunt_KofiKingston-rig | 0 | 0 | 69 | 0 | 0.0% |
| euler:WBTC-rig | 0 | 0 | 69 | 0 | 0.0% |
| euler:mixamo-space | 9378 | 351 | 0 | 0 | 96.4% |
| glb-embedded | 0 | 69 | 0 | 0 | 0.0% |
| kaykit/Rig_Large_CombatMelee | 1005 | 99 | 0 | 0 | 91.0% |
| kaykit/Rig_Medium_CombatMelee | 1407 | 111 | 0 | 0 | 92.7% |
| kaykit/Rig_Medium_General | 938 | 97 | 0 | 0 | 90.6% |
| kaykit/Rig_Medium_MovementBasic | 670 | 89 | 0 | 0 | 88.3% |
| mesh2motion-base | 1474 | 44 | 0 | 0 | 97.1% |
| mesh2motion-mocap | 1072 | 32 | 0 | 0 | 97.1% |
| ual1 | 2814 | 153 | 0 | 0 | 94.8% |
| ual2 | 2814 | 153 | 0 | 0 | 94.8% |

## By fighter rig

| fighter | joints | map coverage | spine | neck | clav | toes | fingers | handedness | PASS | FAIL | UNMAPPABLE | MISSING | pass rate |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| AARON_RUBEN | 58 | 1 | 3 | 1 | 2 | 2 | 30 | mirrored | 802 | 8 | 60 | 0 | 92.2% |
| BANNON_muscular_rig28 | 58 | 1 | 3 | 1 | 2 | 2 | 30 | mirrored | 802 | 8 | 60 | 0 | 92.2% |
| BANNON_muscular_skinned | 58 | 1 | 3 | 1 | 2 | 2 | 30 | mirrored | 802 | 8 | 60 | 0 | 92.2% |
| BANNON_rigged | 58 | 1 | 3 | 1 | 2 | 2 | 30 | mirrored | 802 | 8 | 60 | 0 | 92.2% |
| BRUTUS | 58 | 1 | 3 | 1 | 2 | 2 | 30 | mirrored | 802 | 8 | 60 | 0 | 92.2% |
| CAIN_ELIAS_gear | 58 | 1 | 3 | 1 | 2 | 2 | 30 | mirrored | 802 | 8 | 60 | 0 | 92.2% |
| CAIN_ELIAS_godwithin | 58 | 1 | 3 | 1 | 2 | 2 | 30 | mirrored | 802 | 8 | 60 | 0 | 92.2% |
| CAIN_ELIAS_ring | 58 | 1 | 3 | 1 | 2 | 2 | 30 | mirrored | 802 | 8 | 60 | 0 | 92.2% |
| CAIN_ELIAS_snakeskin | 58 | 1 | 3 | 1 | 2 | 2 | 30 | mirrored | 802 | 8 | 60 | 0 | 92.2% |
| CIPHER | 58 | 1 | 3 | 1 | 2 | 2 | 30 | mirrored | 802 | 8 | 60 | 0 | 92.2% |
| CIPHER_feral | 58 | 1 | 3 | 1 | 2 | 2 | 30 | mirrored | 802 | 8 | 60 | 0 | 92.2% |
| CIPHER_minion | 58 | 1 | 3 | 1 | 2 | 2 | 30 | mirrored | 802 | 8 | 60 | 0 | 92.2% |
| CIPHER_rigged | 52 | 1 | 3 | 1 | 2 | 2 | 30 | mirrored | 802 | 8 | 60 | 0 | 92.2% |
| CIPHER_rigged_rig28 | 58 | 1 | 3 | 1 | 2 | 2 | 30 | mirrored | 802 | 8 | 60 | 0 | 92.2% |
| CODY_gear_rig28 | 58 | 1 | 3 | 1 | 2 | 2 | 30 | mirrored | 802 | 8 | 60 | 0 | 92.2% |
| CODY_gear_skinned | 58 | 1 | 3 | 1 | 2 | 2 | 30 | mirrored | 802 | 8 | 60 | 0 | 92.2% |
| CODY_sober | 58 | 1 | 3 | 1 | 2 | 2 | 30 | mirrored | 802 | 8 | 60 | 0 | 92.2% |
| CODY_stressed | 58 | 1 | 3 | 1 | 2 | 2 | 30 | mirrored | 802 | 8 | 60 | 0 | 92.2% |
| ECHO | 58 | 1 | 3 | 1 | 2 | 2 | 30 | mirrored | 802 | 8 | 60 | 0 | 92.2% |
| EDWIN_KENNEDY | 58 | 1 | 3 | 1 | 2 | 2 | 30 | mirrored | 802 | 8 | 60 | 0 | 92.2% |
| EDWIN_KENNEDY_unchained | 46 | 0.8 | 1 | 1 | 0 | 0 | 30 | mirrored | 802 | 8 | 60 | 0 | 92.2% |
| EDWIN_KENNEDY_unchained_rig28 | 58 | 1 | 3 | 1 | 2 | 2 | 30 | mirrored | 802 | 8 | 60 | 0 | 92.2% |
| EL_TORO_DE_ORO | 58 | 1 | 3 | 1 | 2 | 2 | 30 | mirrored | 802 | 8 | 60 | 0 | 92.2% |
| HALL_NIGHTER | 58 | 1 | 3 | 1 | 2 | 2 | 30 | mirrored | 802 | 8 | 60 | 0 | 92.2% |
| HOLLOW | 58 | 1 | 3 | 1 | 2 | 2 | 30 | mirrored | 802 | 8 | 60 | 0 | 92.2% |
| JAGER | 58 | 1 | 3 | 1 | 2 | 2 | 30 | mirrored | 802 | 8 | 60 | 0 | 92.2% |
| JAGER_beard | 58 | 1 | 3 | 1 | 2 | 2 | 30 | mirrored | 802 | 8 | 60 | 0 | 92.2% |
| KOBRA | 58 | 1 | 3 | 1 | 2 | 2 | 30 | mirrored | 802 | 8 | 60 | 0 | 92.2% |
| MAIME_skinned | 58 | 1 | 3 | 1 | 2 | 2 | 30 | mirrored | 802 | 8 | 60 | 0 | 92.2% |
| MAIME_skinned_severed_orig | 22 | 1 | 3 | 1 | 2 | 2 | 0 | mirrored | 0 | 810 | 60 | 0 | 0.0% |
| MAIME_tattered_skinned | 58 | 1 | 3 | 1 | 2 | 2 | 30 | mirrored | 802 | 8 | 60 | 0 | 92.2% |
| MAIME_tattered_skinned_severed_orig | 22 | 1 | 3 | 1 | 2 | 2 | 0 | mirrored | 0 | 810 | 60 | 0 | 0.0% |
| MASTER_SENSEI | 58 | 1 | 3 | 1 | 2 | 2 | 30 | mirrored | 802 | 8 | 60 | 0 | 92.2% |
| MASTER_SENSEI_rose | 58 | 1 | 3 | 1 | 2 | 2 | 30 | mirrored | 802 | 8 | 60 | 0 | 92.2% |
| NPC_FINXSSE | 58 | 1 | 3 | 1 | 2 | 2 | 30 | mirrored | 802 | 8 | 60 | 0 | 92.2% |
| ONYX_corset_rig28 | 58 | 1 | 3 | 1 | 2 | 2 | 30 | mirrored | 802 | 8 | 60 | 0 | 92.2% |
| ONYX_corset_skinned | 58 | 1 | 3 | 1 | 2 | 2 | 30 | mirrored | 802 | 8 | 60 | 0 | 92.2% |
| ONYX_rig28 | 58 | 1 | 3 | 1 | 2 | 2 | 30 | mirrored | 802 | 8 | 60 | 0 | 92.2% |
| ONYX_skinned | 58 | 1 | 3 | 1 | 2 | 2 | 30 | mirrored | 802 | 8 | 60 | 0 | 92.2% |
| ONYX_straightjacket | 58 | 1 | 3 | 1 | 2 | 2 | 30 | mirrored | 802 | 8 | 60 | 0 | 92.2% |
| ONYX_street | 58 | 1 | 3 | 1 | 2 | 2 | 30 | mirrored | 802 | 8 | 60 | 0 | 92.2% |
| PABLO | 58 | 1 | 3 | 1 | 2 | 2 | 30 | mirrored | 802 | 8 | 60 | 0 | 92.2% |
| PABLO_blackreign | 58 | 1 | 3 | 1 | 2 | 2 | 30 | mirrored | 802 | 8 | 60 | 0 | 92.2% |
| PABLO_goldenbull | 58 | 1 | 3 | 1 | 2 | 2 | 30 | mirrored | 802 | 8 | 60 | 0 | 92.2% |
| STAN_COMBS_gear | 58 | 1 | 3 | 1 | 2 | 2 | 30 | mirrored | 802 | 8 | 60 | 0 | 92.2% |
| STATIC | 58 | 1 | 3 | 1 | 2 | 2 | 30 | mirrored | 802 | 8 | 60 | 0 | 92.2% |
| STATIC_alt | 58 | 1 | 3 | 1 | 2 | 2 | 30 | mirrored | 802 | 8 | 60 | 0 | 92.2% |
| STICKUP | 58 | 1 | 3 | 1 | 2 | 2 | 30 | mirrored | 802 | 8 | 60 | 0 | 92.2% |
| TARZANIAN_DEVIL_dec_rig28 | 58 | 1 | 3 | 1 | 2 | 2 | 30 | mirrored | 802 | 8 | 60 | 0 | 92.2% |
| TARZANIAN_DEVIL_skinned | 58 | 1 | 3 | 1 | 2 | 2 | 30 | mirrored | 802 | 8 | 60 | 0 | 92.2% |
| TITAN | 58 | 1 | 3 | 1 | 2 | 2 | 30 | mirrored | 802 | 8 | 60 | 0 | 92.2% |
| TITAN_unmasked | 58 | 1 | 3 | 1 | 2 | 2 | 30 | mirrored | 802 | 8 | 60 | 0 | 92.2% |
| TITAN_white | 58 | 1 | 3 | 1 | 2 | 2 | 30 | mirrored | 802 | 8 | 60 | 0 | 92.2% |
| TRIPLE_XXX | 58 | 1 | 3 | 1 | 2 | 2 | 30 | mirrored | 802 | 8 | 60 | 0 | 92.2% |
| TRIPLE_XXX_suit | 58 | 1 | 3 | 1 | 2 | 2 | 30 | mirrored | 802 | 8 | 60 | 0 | 92.2% |
| TRIPLE_XXX_tights | 58 | 1 | 3 | 1 | 2 | 2 | 30 | mirrored | 802 | 8 | 60 | 0 | 92.2% |
| TRIPLE_XXX_trunks | 58 | 1 | 3 | 1 | 2 | 2 | 30 | mirrored | 802 | 8 | 60 | 0 | 92.2% |
| TYNESHIA | 58 | 1 | 3 | 1 | 2 | 2 | 30 | mirrored | 802 | 8 | 60 | 0 | 92.2% |
| TYNESHIA_street | 58 | 1 | 3 | 1 | 2 | 2 | 30 | mirrored | 802 | 8 | 60 | 0 | 92.2% |
| VIPER | 58 | 1 | 3 | 1 | 2 | 2 | 30 | mirrored | 802 | 8 | 60 | 0 | 92.2% |
| WRECK_PATTERSON | 58 | 1 | 3 | 1 | 2 | 2 | 30 | mirrored | 802 | 8 | 60 | 0 | 92.2% |
| WRECK_PATTERSON_attire2 | 58 | 1 | 3 | 1 | 2 | 2 | 30 | mirrored | 802 | 8 | 60 | 0 | 92.2% |
| WRECK_PATTERSON_attire3 | 58 | 1 | 3 | 1 | 2 | 2 | 30 | mirrored | 802 | 8 | 60 | 0 | 92.2% |
| WRECK_PATTERSON_godwithin | 58 | 1 | 3 | 1 | 2 | 2 | 30 | mirrored | 802 | 8 | 60 | 0 | 92.2% |
| wrestler_base | 49 | 0.9 | 2 | 1 | 2 | 0 | 30 | mirrored | 801 | 9 | 60 | 0 | 92.1% |
| wrestler_base_rig28 | 58 | 1 | 3 | 1 | 2 | 2 | 30 | mirrored | 802 | 8 | 60 | 0 | 92.2% |
| xbot | 65 | 1 | 3 | 1 | 2 | 2 | 30 | right-handed | 802 | 8 | 60 | 0 | 92.2% |
| EXT_KayKit_Knight | 23 | 0.85 | 2 | 0 | 0 | 2 | 0 | right-handed | 801 | 9 | 60 | 0 | 92.1% |
| EXT_UAL2_Mannequin_F | 65 | 1 | 3 | 1 | 2 | 2 | 30 | right-handed | 802 | 8 | 60 | 0 | 92.2% |

## Source rigs (bone-map coverage)

| source | joints | coverage | missing required | spine | neck | clav | toes | fingers | handedness | detection |
|---|---|---|---|---|---|---|---|---|---|---|
| source:canonical | 58 | 1 | - | 3 | 1 | 2 | 2 | 30 | mirrored | name |
| source:glb:xbot | 65 | 1 | - | 3 | 1 | 2 | 2 | 30 | right-handed | name |
| source:ual1 | 65 | 1 | - | 3 | 1 | 2 | 2 | 30 | right-handed | name |
| source:ual2 | 65 | 1 | - | 3 | 1 | 2 | 2 | 30 | right-handed | name |
| source:kaykit:Rig_Medium/Rig_Medium_CombatMelee.glb | 23 | 0.85 | - | 2 | 0 | 0 | 2 | 0 | right-handed | name |
| source:kaykit:Rig_Medium/Rig_Medium_MovementBasic.glb | 23 | 0.85 | - | 2 | 0 | 0 | 2 | 0 | right-handed | name |
| source:kaykit:Rig_Medium/Rig_Medium_General.glb | 23 | 0.85 | - | 2 | 0 | 0 | 2 | 0 | right-handed | name |
| source:kaykit:Rig_Large/Rig_Large_CombatMelee.glb | 23 | 0.85 | - | 2 | 0 | 0 | 2 | 0 | right-handed | name |
| source:m2m | 66 | 1 | - | 3 | 1 | 2 | 2 | 30 | right-handed | name |
| source:m2m-base | 66 | 1 | - | 3 | 1 | 2 | 2 | 30 | right-handed | name |
| source:cmu (31-joint BVH) | 39 | 1 | - | 3 | 2 | 2 | 2 | 4 | right-handed | name |

## GLBs not treated as fighter rigs

- BANNON: NO_SKINNED_MESH (static mesh, not a fighter rig)
- BANNON_muscular: NO_SKINNED_MESH (static mesh, not a fighter rig)
- BANNON_muscular_rigready: NO_SKINNED_MESH (static mesh, not a fighter rig)
- CODY_gear: NO_SKINNED_MESH (static mesh, not a fighter rig)
- CODY_gear_rigready: NO_SKINNED_MESH (static mesh, not a fighter rig)
- MAIME: NO_SKINNED_MESH (static mesh, not a fighter rig)
- MAIME_tattered: NO_SKINNED_MESH (static mesh, not a fighter rig)
- ONYX: NO_SKINNED_MESH (static mesh, not a fighter rig)
- ONYX_corset: NO_SKINNED_MESH (static mesh, not a fighter rig)
- ONYX_corset_rigready: NO_SKINNED_MESH (static mesh, not a fighter rig)
- ONYX_rigready: NO_SKINNED_MESH (static mesh, not a fighter rig)
- TARZANIAN_DEVIL_dec: NO_SKINNED_MESH (static mesh, not a fighter rig)

## External sample

- ual1: 43 clip(s) from `<staging>/quaternius-ual-1/extracted/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb`
- ual2: 43 clip(s) from `<staging>/quaternius-ual-2/extracted/Universal Animation Library 2[Standard]/Unreal-Godot/UAL2_Standard.glb`
- kaykit/Rig_Medium_CombatMelee: 22 clip(s) from `<staging>/kaykit-character-animations/extracted/KayKit_Character_Animations_1.1/Animations/gltf/Rig_Medium/Rig_Medium_CombatMelee.glb`
- kaykit/Rig_Medium_MovementBasic: 11 clip(s) from `<staging>/kaykit-character-animations/extracted/KayKit_Character_Animations_1.1/Animations/gltf/Rig_Medium/Rig_Medium_MovementBasic.glb`
- kaykit/Rig_Medium_General: 15 clip(s) from `<staging>/kaykit-character-animations/extracted/KayKit_Character_Animations_1.1/Animations/gltf/Rig_Medium/Rig_Medium_General.glb`
- kaykit/Rig_Large_CombatMelee: 16 clip(s) from `<staging>/kaykit-character-animations/extracted/KayKit_Character_Animations_1.1/Animations/gltf/Rig_Large/Rig_Large_CombatMelee.glb`
- mesh2motion-mocap: 16 clip(s) from `<staging>/mesh2motion/files/human-mocap-animations.glb`
- mesh2motion-base: 22 clip(s) from `<staging>/mesh2motion/files/human-base-animations.glb`
- cmu: 25 clip(s) from `<staging>/cmu-segments/glb`

Third-party sources are read from the staging directory only; none are committed. CMU segments are CMU-free-use (not CC0).
