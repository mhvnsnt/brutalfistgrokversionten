# BRUTAL FIST — the owner's backlog

Everything he has asked for, written down so he does not have to hold it in his
head. He has said more than once "there was something else I keep trying to
remember" — that is what this file is for. Add to it, never silently drop from
it, and note the measurement when something is finished.

Ordered by his own priority: **animations correct on the rigs first**, then
movesets, then arenas and presentation.

---

## 1. ANIMATION — the blocker for everything else

| | item | state |
|---|---|---|
| 1.1 | Fighters stuck in T-pose mid-fight | **done** — every bank carries its own rest (`75f9eb4`) |
| 1.2 | Punches travelling sideways instead of at the opponent | **done** — jab now travels 0.35 m forward (`75f9eb4`) |
| 1.3 | Spinning kick missing | **done** — `HURRICANE_KICK` was frozen by hip-yaw zeroing (`55f41ea`) |
| 1.4 | "Same move for every button" | **done** — the attack slots held 1.7–4.2 s Mixamo demo loops; real single strikes now (`bc3c067`) |
| 1.5 | Neck twisting "like an owl" | **done** — 111° head twist clamped to 35° (`452ce19`) |
| 1.6 | Idle body twisted up | **done** — 171° of axial roll on both thighs, clamped (`cbe0939`) |
| 1.7 | **Universal skeleton, and bake every clip onto it offline** | **done** — 366 clips resolved onto the one 58-joint rig at build time; the runtime does no retargeting at all |
| 1.15 | Feet not planted, "wobbly ragdoll", leaning on the toes | **done** — every clip lifted both feet 21-32 cm off the floor, the idle included. Floor lock baked in: idle/stance 23.3 -> 3.4 cm, block 22.9 -> 3.4, BOXING 25.3 -> 0.0, walk 0.0 |
| 1.16 | Some clips go THROUGH the floor | OPEN — 3 of 8 sampled (attack_rk -25 cm, walk_forward -7 cm, attack_1 -4 cm). The bake deliberately does not raise these: it is a different defect and lifting would hide it. |
| 1.12 | Elbows/knees bending both ways and sideways | **done** — 646 hinge tracks were off-axis; a wrong-side fold is reflected, not clamped |
| 1.13 | Idle was a Mixamo shadowboxing loop | **done** — the idle is an authored fighting stance now |
| 1.14 | **The Bannon Mixamo bank is clamped on EVERY frame** | PARTLY ADDRESSED by the bake — the corrections now happen once, offline, and are counted and gated. Still worth a convention fix at source. Measured on BOXING: RightShoulder and LeftShoulder sit at 35/25 with a RANGE OF 0, and both forearm twists at 12 with range 0 — every frame saturated against the ceiling, which reads as a stiff, pinned arm. GRAFQUICKJAB, from Schwarzerblitz, measures 0/0 and is untouched. The constraints are papering over a convention problem in that bank rather than fixing it. Those clips hold no combat slot any more, so nothing in a fight depends on them — but they are wrong, and the bake is where they get fixed properly. |
| 1.8 | Re-rig the 4 fighters off the skeleton | open — CIPHER_rigged, MAIME, MAIME_tattered, EDWIN_KENNEDY_unchained |
| 1.9 | Candy-wrapper pinch at wrists and knees | open — no twist bones on any rig; fix is dual-quaternion skinning (shader, no re-rig) |
| 1.10 | Clavicles receive nothing from the Schwarzerblitz source | open — derive from the upper arm |
| 1.11 | Same animation work for the owner's OTHER games | open — the bake + limits are written to be portable |

## 2. MOVESETS — unique per character

- Every fighter gets their own moveset, stances and guards. No shared defaults
  where a unique version exists.
- Combos, directional attacks, per-character move lists.
- **done** — an animation is not interrupted unless the move authorises it.
  Schwarzerblitz's own `#CANCEL_INTO` / `#FOLLOWUP` frame windows drive it;
  133 moves carry them and nothing read them before.
- **done** — a buffered follow-up plays the special it earned instead of the
  generic jab.
- **A move-library browser the owner can page through**, so he can look at an
  unsorted clip and say what it is and where it goes. Unsorted clips get a
  holding folder rather than being dropped.
- Moveset editing and saving, WWE-style: edit, save, reset to default, copy
  another fighter's set.
- Tekken-style customization: base default set per character plus every unused
  animation available to assign.
- Knockdowns, jumps, get-ups as first-class slots.

## 3. PRESENTATION

- The PWA not updating is **fixed**: the Pages workflow only builds on `main`
  and `main` was 14 commits behind, so nothing had deployed; and the service
  worker's cache version was a constant, so no deploy ever purged a cache.
- **Preload everything before the select screen** — models and 2D art both.
  The 2D images not showing is **fixed** (`<img src>` was not going through
  the deploy-base resolver, so every portrait 404'd on the PWA). The PRELOAD
  itself is still open: models should be resident before the select screen,
  not fetched when a match starts.
- **Multiple taunts per character**, usable in match.
- **Pre-match intro**: the fighters should do an idle and a taunt, shown one
  then the other or both together. Right now they stand there like statues.
- Announcer, KO / draw / fight callouts, fighter voices.
- Hit effects, bloom.
- **done** — start menu from the owner's own MP4. 23.7 MB source baked to a
  7.3 MB h264 + VP9 pair with the audio split out, a poster frame, and
  muted autoplay so a phone will actually run it.
- Fonts and UI that do not read as generic.

## 4. ARENAS

- Flesh the stages out. The owner has described what he wants per arena more
  than once and will go into more detail.

## 5. MODES AND STORY

- How Tekken, Mortal Kombat, Street Fighter, King of Fighters, Virtua Fighter
  and Schwarzerblitz build cutscenes and story modes — then ours.

---

## Standing rules from the owner

- **No guesses. Measure it, render it, look at it.** A passing metric is not a
  passing model — ask whether the metric can even express the failure.
- Pull from every repo he owns: the other Brutal Fist versions,
  SchwarzerblitzEngine, NightSkyEngine, Bannon, the Tekken 3 work. He has
  granted use of all of it.
- Real wrestler and fighter names are reference, not a naming proposal. Take
  the reference; name the asset for the motion.
- Never delete generated content — clips, variants, models — without asking.
