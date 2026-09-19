/**
 * ROUND SYSTEM — best-of-N matches, the way Tekken and Schwarzerblitz run them.
 *
 * WHAT WAS THERE: nothing. Both places that recorded a result wrote
 * `round: 1` literally and called `setRoundResults([result])`, REPLACING the
 * array rather than appending, then went straight to the victory cinematic. So
 * every match was exactly one round — which is also why the announcer's
 * `round2`, `round3` and `finalRound` lines had no callers and every round
 * announced as "Round 1".
 *
 * This module owns the decisions and nothing else: no React, no audio, no
 * timers. It answers "who won that round", "is the match over", "what should
 * the announcer say", and it is exhaustively testable because of that.
 *
 * DRAWS COUNT AS A ROUND PLAYED AND AWARD NOTHING. That is the fighting-game
 * convention: a double KO or a timeout at equal health burns a round without
 * moving either player toward the match, so a best-of-3 can end 1-1 with a
 * third round still to play.
 */

export type RoundWinner = 'p1' | 'p2' | 'draw';
export type RoundCondition = 'KO' | 'TIMEOUT' | 'PERFECT';

/** How many round wins takes the match. 2 = best of three, the genre default. */
export const DEFAULT_ROUNDS_TO_WIN = 2;
/** A hard ceiling so a run of draws cannot play forever. */
export const MAX_ROUNDS = 5;

export interface RoundState {
  /** The round about to be played, 1-based. */
  round: number;
  p1Wins: number;
  p2Wins: number;
  roundsToWin: number;
  /** Finished rounds, oldest first. */
  history: Array<{ round: number; winner: RoundWinner; condition: RoundCondition }>;
}

export function createRoundState(roundsToWin = DEFAULT_ROUNDS_TO_WIN): RoundState {
  return { round: 1, p1Wins: 0, p2Wins: 0, roundsToWin, history: [] };
}

export interface RoundOutcome {
  state: RoundState;
  /** True when the match is decided and the post-match screen should show. */
  matchOver: boolean;
  /** Who took the MATCH, once it is over. */
  matchWinner: RoundWinner | null;
  /** The announcer line for the round that is about to start, if any. */
  nextAnnouncement: 'round1' | 'round2' | 'round3' | 'finalRound' | null;
}

/** The announcer line for a round, given whether it decides the match. */
export function announcementFor(round: number, isMatchPoint: boolean): RoundOutcome['nextAnnouncement'] {
  // "Final Round" replaces the number when the next round can end it — which
  // is how Tekken calls it, and why the line exists at all.
  if (isMatchPoint) return 'finalRound';
  if (round === 1) return 'round1';
  if (round === 2) return 'round2';
  if (round === 3) return 'round3';
  return null;
}

/**
 * Is the round about to be played a decider? True when EITHER player can take
 * the match by winning it. A 1-0 lead in a best-of-3 is not match point for
 * the trailing player, but it is for the leader, and the call fires either way.
 */
export function isMatchPoint(state: RoundState): boolean {
  return (
    state.p1Wins + 1 >= state.roundsToWin ||
    state.p2Wins + 1 >= state.roundsToWin
  );
}

/**
 * Record a finished round and work out what happens next.
 * Pure: returns a new state, never mutates the one passed in.
 */
export function resolveRound(
  state: RoundState,
  winner: RoundWinner,
  condition: RoundCondition,
): RoundOutcome {
  const p1Wins = state.p1Wins + (winner === 'p1' ? 1 : 0);
  const p2Wins = state.p2Wins + (winner === 'p2' ? 1 : 0);
  const history = [...state.history, { round: state.round, winner, condition }];

  const decided = p1Wins >= state.roundsToWin || p2Wins >= state.roundsToWin;
  // A run of draws must not play forever; at the ceiling the lead decides it,
  // and a tie at the ceiling is a drawn match.
  const exhausted = history.length >= MAX_ROUNDS;
  const matchOver = decided || exhausted;

  let matchWinner: RoundWinner | null = null;
  if (matchOver) {
    if (p1Wins > p2Wins) matchWinner = 'p1';
    else if (p2Wins > p1Wins) matchWinner = 'p2';
    else matchWinner = 'draw';
  }

  const next: RoundState = {
    round: matchOver ? state.round : state.round + 1,
    p1Wins,
    p2Wins,
    roundsToWin: state.roundsToWin,
    history,
  };

  return {
    state: next,
    matchOver,
    matchWinner,
    nextAnnouncement: matchOver ? null : announcementFor(next.round, isMatchPoint(next)),
  };
}

/** The line to announce at the very start of a match. */
export function openingAnnouncement(state: RoundState): RoundOutcome['nextAnnouncement'] {
  return announcementFor(state.round, isMatchPoint(state));
}

/** "1 - 0" for the HUD. */
export function scoreLine(state: RoundState): string {
  return `${state.p1Wins} - ${state.p2Wins}`;
}
