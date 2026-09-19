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
| 1.7 | **Universal skeleton, and bake every clip onto it offline** | gate shipped (`check-universal-skeleton.mjs`); the BAKE is the next big piece |
| 1.8 | Re-rig the 4 fighters off the skeleton | open — CIPHER_rigged, MAIME, MAIME_tattered, EDWIN_KENNEDY_unchained |
| 1.9 | Candy-wrapper pinch at wrists and knees | open — no twist bones on any rig; fix is dual-quaternion skinning (shader, no re-rig) |
| 1.10 | Clavicles receive nothing from the Schwarzerblitz source | open — derive from the upper arm |
| 1.11 | Same animation work for the owner's OTHER games | open — the bake + limits are written to be portable |

## 2. MOVESETS — unique per character

- Every fighter gets their own moveset, stances and guards. No shared defaults
  where a unique version exists.
- Combos, directional attacks, per-character move lists.
- **A move-library browser the owner can page through**, so he can look at an
  unsorted clip and say what it is and where it goes. Unsorted clips get a
  holding folder rather than being dropped.
- Moveset editing and saving, WWE-style: edit, save, reset to default, copy
  another fighter's set.
- Tekken-style customization: base default set per character plus every unused
  animation available to assign.
- Knockdowns, jumps, get-ups as first-class slots.

## 3. PRESENTATION

- **Preload everything before the select screen** — models and 2D art both.
  Reported: select-screen 2D images do not show at all, and models take a long
  time to appear in select and in the fight.
- **Multiple taunts per character**, usable in match.
- **Pre-match intro**: the fighters should do an idle and a taunt, shown one
  then the other or both together. Right now they stand there like statues.
- Announcer, KO / draw / fight callouts, fighter voices.
- Hit effects, bloom.
- Start menu from the owner's own MP4 (he has made one and will send it).
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
