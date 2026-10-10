# Tekken as Design Inspiration for Brutal Fist

*Studied 2026-10-10 via match-video coverage, guides, design analyses, developer interviews, and wiki documentation. No live play (Tekken can't run in a browser). Ordered by impact ÷ implementation cost for a small indie team.*

Brutal Fist is a 3D fighter — Tekken is the closest living relative. These are the transferable systems, not the lore.

## Tier S — Do these first (cheap, transformative)

**1. Low-health slow-motion on decisive blows (Tekken 7's "super slow motion").**
When both fighters are low on health and trade blows, Tekken 7 drops into super slow motion. Harada's stated goal: so *spectators* feel the tide turn — "viewers can feel the same excitement as the player." Trigger a timescale dip on round-ending trades and low-HP comebacks. Hours of implementation, massive clip/stream value.

**2. Gravity-scaled juggles with an explicit ender decision.**
Tekken's grammar: every juggle hit pushes the opponent further away and damage scales per hit. The standard structure is Launcher → filler → bound → **ender, chosen for okizeme vs. wall carry vs. raw damage** ("the wall is strong"). Add the scaling so juggles self-terminate (no infinites), and make the ender a real positional choice every time.

**3. Movement IS the defense (the single biggest Tekken lesson).**
Sidestep evades linear attacks. Sidewalk circles the opponent continuously. Backdash creates whiff-punish spacing but has vulnerable recovery that must be canceled. Steal: a true sidestep with evasion frames, cancelable into attacks (including character-specific sidestep attacks), and snappy cancel windows. Stiff movement is what killed Tekken 6's Scenario Campaign — "like the polygons are filled with helium."

**4. The wall as a weapon.**
In Tekken, position is damage: wallsplat a foe and you get guaranteed follow-ups (about 3 extra hits per splat, one splat per wall per combo). Make stage walls combo surfaces and let skilled play carry juggles into them. Static geometry becomes part of the moveset.

**5. Hitstop, scaled hit sparks, impact sound.**
Freeze a few frames on launcher/heavy hits, scale spark size and sound pitch with damage, tiny camera punch-in on counter-hits. Tekken 3's hit audio is still praised 30 years later. Cheap, proven.

## Tier A — High impact, moderate work

**6. Stage breaks as round punctuation.**
Floor breaks (spike → floor shatters → combo continues below), balcony breaks (through a railing into a lower arena). Rules to steal: breaks are *earned* by specific spike/slam moves, not random — and Tekken 7 deliberately removed extra damage from floor breaks. The reward is spectacle and positional reset, not power creep.

**7. A real wakeup game (okizeme).**
Staying down means you *can't be relaunched*. Spring kicks and getup kicks are punishable. Tech rolls go in chosen directions. The ground should be a decision point, not dead time.

**8. Stances as cheap roster multiplication.**
Eddy's handstand: more range and speed on kicks, but he cannot sidestep at all. Alternate modes that change available attacks *and* trade-offs. Instead of N fully distinct fighters, build fewer bodies with stance toggles — a moveset remix with an explicit weakness is far cheaper than new skeletons.

**9. Character-specific movement identity (the Mishima wavedash).**
The wavedash gives the Mishima clan a unique *movement* tool. Lesson: differentiate characters through how they move, not just how they hit. One fighter slides through, one shoulder-charges with armor, one backdashes into a strike. Movement identity reads instantly and costs less than moveset identity.

**10. Asymmetric defense (resist the universal parry).**
Tekken deliberately does not give everyone the same defense: Paul/Nina/Asuka catch punches and kicks (but can be chickened), King catches kicks only (uncounterable), Jin's parry merely negates block stun, Marduk's reversal leads to a mount. Give the roster *different* defensive answers — one parries, one dodge-counters, one armors through, one grabs. Asymmetry is replayability; a single universal parry is a solved system.

**11. Chain throws as the grappler fantasy (King's multi-throw).**
An escalating input chain where each link is a branch — slam into the wall, piledriver for burst, toss for carry. The *threat* of the chain forces respect. This is the grappler's entire identity without new tech.

## Tier B — Boss design

**12. Bosses transform mid-fight (Kazumi, True Ogre).**
Kazumi shifts into devil form after losing the first round — new wings, new sweeping attacks, plus a tiger companion forcing two-threat tracking. Rule: at an HP threshold, the boss must visibly change and invalidate the player's current reads. Contrast Jinpachi (Tekken 5), remembered for cheapness (health-regain, paralysis combos) — transformative difficulty, not unfair difficulty.

**13. The boss that steals your moves (Ogre, Mokujin).**
Ogre's style is a composite of fighters it defeated. Mokujin randomly mimics the roster. A boss that uses the player's own signature moves is cheap to build (reuse the player animation set, retimed), psychologically nasty, and teaches the player their own kit's weaknesses. Highest feel-per-dollar boss trick available.

## What Tekken teaches that the arcade lineage does not

1. **Movement as the primary defensive system** — not just positioning, but sidestep/backdash/sidewalk as *the* defense.
2. **A real high/low/throw mixup grammar** — highs ducked, mids unduckable, lows blocked low, throws unblockable. The block button becomes a decision.
3. **Gravity-scaled juggles as a resource** — combos with opportunity cost (oki vs. wall carry vs. damage), not just longer strings.
4. **The environment as combo geometry** — walls and floors as weapons, not boundaries.
5. **Asymmetric tools over symmetric verbs** — differentiation through exclusive mechanics, cheaper than new art.
6. **Okizeme** — the ground as a decision point.
7. **Spectator-oriented drama engineering** — slow-mo and comeback cues designed for the viewer. Most valuable lesson for an indie that markets through clips.
