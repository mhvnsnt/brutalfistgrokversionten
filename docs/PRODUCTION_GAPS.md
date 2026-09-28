# Brutal Fist Production Gaps / Required Work

Updated: 2026-09-28

This is the persistent backlog for the fighting-game production pass. New animation/gameplay gaps reported during testing belong here instead of being forgotten between agent sessions.

## P0 — Character individuality

- [x] Separate fighter-owned animation clips from generic semantic states.
- [x] Add directional fighter-owned move slots.
- [x] Make directional roster moves use catalog frame data instead of changing only the animation.
- [ ] Expand every fighter from the current small slot set into a full authored move graph: standing LP/RP/LK/RK, forward attacks, back attacks, down-forward attacks, while-standing attacks, crouch attacks, launchers, homing/side-step attacks, airborne attacks, strings, counters, throws and signature moves.
- [ ] Ensure every canonical fighter has a validated identity set rather than merely inheriting the same fallback clips.
- [ ] Produce a roster diversity report showing duplicate move IDs/clips across fighters and the remaining intentional/shared moves.

## P0 — Animation quantity and quality

- [ ] Intake and measure Quaternius UAL1 Standard + Root Motion variants.
- [ ] Intake and measure Quaternius UAL2 Standard + Root Motion variants.
- [ ] Intake KayKit Character Animations CC0 source bank for additional humanoid combat/movement candidates.
- [ ] Retarget/bake validated candidates onto the Bannon skeleton families.
- [ ] Add enough validated punches, elbows, chops, hooks, knees, kicks, launchers, sweeps, evasions, aerials and stance transitions that fighters do not collapse into the same small set.
- [ ] Keep reaction/victim/team-capture animations out of attacker slots.
- [ ] Keep rotating/root-motion specials on dedicated handling.
- [ ] Runtime-certify clips on at least two contrasting Bannon fighters before promotion.

## P0 — Input/combat behavior

- [ ] Verify Down-held crouch visually persists in the PWA.
- [ ] Verify jump start/airborne/landing as a complete authored sequence.
- [ ] Verify forward/back + each button selects the intended directional move.
- [ ] Add sidestep + attack branches.
- [ ] Add while-standing / rising attack branches.
- [ ] Add launcher/juggle routes that preserve airborne state.
- [ ] Verify attack hitboxes, damage, hitstun and recovery use the selected character move's data.
- [ ] Verify throws do not terminate matches from excessive repeated damage.
- [ ] Verify attacker/receiver grapple clips remain synchronized through full authored duration.

## P1 — Open-source integration

- [ ] Create a checked-in source-bank manifest with exact pack/version/hash/license.
- [ ] Add a machine-readable candidate manifest for UAL1/UAL2/KayKit clips.
- [ ] Run semantic measurements before promotion; UNKNOWN remains UNKNOWN.
- [ ] Build automated duplicate/diversity reports by fighter and move slot.
- [ ] Add runtime Move Viewer support for attacker + receiver and directional branches.

## P1 — PWA certification

- [ ] Browser-test Bannon vs Kobra with directional move coverage.
- [ ] Browser-test two fighters with deliberately different move identities.
- [ ] Browser-test crouch, jump, aerial, launcher, grapple, knockdown and wakeup as complete sequences.
- [ ] Record actual PWA evidence before declaring animation fixes PASS.

## Current status law

Static routing/tests prove code paths. They do not prove that a clip visually reads correctly on the actual GLB in the PWA. Runtime certification remains UNKNOWN until observed and measured.

- P0 locomotion feel/runtime: deliberate walk must be materially slower than run/backdash; eliminate arena-wide skating, distinguish player movement from AI pursuit, and prevent the AI from continuously translating with a retreating player.
- P0 knockdown/reaction: at least one ordinary canonical heavy attack must demonstrably produce a grounded knockdown, with a real fall clip and wakeup path; distinguish hitstun, crumple, launch/juggle, smackdown, knockdown and wakeup rather than collapsing them into one flinch.
