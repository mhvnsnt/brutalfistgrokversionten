# Universal Animation Intake Contract

Every new animation enters one path:

1. Resolve source bone names through the canonical alias layer.
2. Convert source-rest orientation into the fighter's bind pose.
3. Explicitly fill unmentioned target bones with their target rest pose.
4. Refuse multi-performer captures for solo moves.
5. Refuse non-finite and frozen clips.
6. Certify grounded/airborne state, facing, strike reach, joint limits, contact, timing and receiver/attacker role.
7. Promote only certified output into a combat slot.

Different packs can fail for different reasons: bone count/naming, bind/rest convention, missing tracks, source body count, semantic role, receiver halves, facing/rotation, or authored root motion. A universal skeleton solves identity; it does not invent missing information or turn a two-person recording into a solo move.

PARTIAL means safe retargeting with explicit rest fills, not visual certification. UNKNOWN is never PASS.
