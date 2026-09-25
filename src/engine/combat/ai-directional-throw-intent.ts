/**
 * Pure AI directional-throw intent selection.
 *
 * The arena remains responsible for range/state validation and opening the
 * authoritative FighterStateMachine throw-break transaction. This module only
 * decides which directional throw the character wants to attempt.
 */
export type AIDirectionalThrowContext = {
  distance: number;
  distZ: number;
  cycle: number;
  powerStyle: boolean;
  evasiveStyle: boolean;
};

export type AIDirectionalThrowId =
  | 'forward_throw'
  | 'backward_throw'
  | 'side_throw_left'
  | 'side_throw_right';

export function selectAIDirectionalThrowId(
  context: AIDirectionalThrowContext,
): AIDirectionalThrowId | null {
  const { distance, distZ, cycle, powerStyle, evasiveStyle } = context;

  if (distance > 1.35) return null;

  // Keep directional throws occasional so the AI still has ordinary attacks.
  const throwCycle =
    cycle === 4 ||
    (powerStyle && cycle === 2);

  if (!throwCycle) return null;

  // A lateral gap gives the AI a reason to use a side throw. The side is
  // deterministic from the opponent's relative Z position, so the same
  // situation is reproducible in probes and replays.
  if (distZ >= 0.65) {
    return evasiveStyle
      ? 'side_throw_left'
      : 'side_throw_right';
  }

  // Power/wrestling characters use the heavier backward throw occasionally;
  // other styles default to the standard forward throw.
  if (powerStyle && cycle === 2) return 'backward_throw';
  return 'forward_throw';
}
