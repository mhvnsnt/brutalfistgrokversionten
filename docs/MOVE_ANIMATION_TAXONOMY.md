# Bannon move-animation taxonomy

This classification layer uses fighting-game conventions as reference concepts, not imported game assets, movesets, or animation data.

## Position first
Every move gets a required starting-position family before a button family:
- neutral — standing/ready.
- crouch — crouched/ducked body.
- rising — upward/while-rising strike; grounded start with upward attack.
- airborne — attacker is off the floor during the attack.
- backward — retreating/back-step/backward attack.
- spin — committed axial rotation/turning body.
- sidestep — lateral displacement/sidewalk-derived attack.
- grounded-low — grounded low-contact attack.
- grapple-initiate — attacker controls opponent; never a strike.
- grapple-receiver — victim half of a grapple; never an attack.
- reaction — victim responding to hit/throw.
- taunt — non-combat presentation; never an attack slot.
- locomotion — walk/run/dash/turn.
- neutral/idle — idle, stance and transitions.

## Attack family second
- punch
- kick
- knee
- elbow
- hammer
- launcher
- low
- overhead
- throw
- special
- taunt

A clip can have both dimensions, such as crouch + kick, rising + punch, airborne + kick, or spin + kick.

## Receiver behavior is part of the move
A strike is visually complete only when the viewer can inspect attacker, contact/active window, victim reaction, pushback/rotation/launch, and recovery.
A grapple is initiator, contact/hold, receiver/throw victim, release/landing, and recovery.
If the receiver half is unknown, the viewer marks it UNKNOWN rather than silently treating a generic reaction as a confirmed pair.

## Certification
- STATIC_SAFE — measured bake constraints pass.
- RUNTIME_PENDING — static constraints pass but PWA playback is not visually certified.
- RUNTIME_GOOD — real PWA playback confirmed body motion/contact.
- BROKEN — measured or runtime evidence shows incorrect deformation, placement, timing, or pairing.
- UNKNOWN — insufficient evidence.

UNKNOWN is never PASS.

## Reference boundary
The project may study documented fighting-game structure such as neutral/crouch/air/rising/side/back states, reaction matrices, pushback, rotation, throws and victim-specific reactions. It does not copy proprietary game assets, animations, sounds, textures, code or move data.

Schwarzerblitz is used as an open-source engine architecture reference. Its public README describes the engine as BSD-3-Clause while separately stating that included characters, stage and music have different restrictions. Bannon therefore keeps provenance/license data per motion and only imports motion whose own source registry permits it.