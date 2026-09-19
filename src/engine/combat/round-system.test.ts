import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_ROUNDS_TO_WIN, MAX_ROUNDS, announcementFor, createRoundState,
  isMatchPoint, openingAnnouncement, resolveRound, scoreLine,
  type RoundState, type RoundWinner,
} from './RoundSystem.ts';

/** Play a sequence of round winners through the system. */
function play(winners: RoundWinner[], roundsToWin = DEFAULT_ROUNDS_TO_WIN) {
  let state = createRoundState(roundsToWin);
  const calls: string[] = [openingAnnouncement(state) ?? '(none)'];
  let last = null as ReturnType<typeof resolveRound> | null;
  for (const w of winners) {
    last = resolveRound(state, w, 'KO');
    state = last.state;
    if (last.nextAnnouncement) calls.push(last.nextAnnouncement);
    if (last.matchOver) break;
  }
  return { state, calls, outcome: last! };
}

describe('a match is best of three', () => {
  it('starts at round 1 with nothing won', () => {
    const s = createRoundState();
    assert.deepEqual([s.round, s.p1Wins, s.p2Wins], [1, 0, 0]);
    assert.equal(openingAnnouncement(s), 'round1');
  });

  it('two straight wins ends it 2-0 in two rounds', () => {
    const { outcome, state } = play(['p1', 'p1']);
    assert.equal(outcome.matchOver, true);
    assert.equal(outcome.matchWinner, 'p1');
    assert.equal(state.history.length, 2);
    assert.equal(scoreLine(state), '2 - 0');
  });

  it('one each goes to a third round, and the third decides it', () => {
    const { outcome, state, calls } = play(['p1', 'p2', 'p2']);
    assert.equal(outcome.matchOver, true);
    assert.equal(outcome.matchWinner, 'p2');
    assert.equal(state.history.length, 3);
    // Round 3 is match point for both, so it is announced as the final round.
    assert.deepEqual(calls, ['round1', 'finalRound', 'finalRound']);
  });

  it('the match does not end early while it is still live', () => {
    const { outcome } = play(['p1']);
    assert.equal(outcome.matchOver, false);
    assert.equal(outcome.matchWinner, null);
    assert.equal(outcome.state.round, 2);
  });
});

describe('the announcer is told the right line', () => {
  it('round 1 announces as round 1', () => {
    assert.equal(announcementFor(1, false), 'round1');
  });

  it('round 2 announces as round 2, not round 1', () => {
    // The shipped code fired 'round1' literally for every round.
    assert.equal(announcementFor(2, false), 'round2');
    assert.equal(announcementFor(3, false), 'round3');
  });

  it('match point replaces the number with FINAL ROUND', () => {
    assert.equal(announcementFor(2, true), 'finalRound');
    assert.equal(announcementFor(3, true), 'finalRound');
  });

  it('match point is true as soon as either player can take it', () => {
    assert.equal(isMatchPoint(createRoundState()), false);
    const afterOne = resolveRound(createRoundState(), 'p1', 'KO').state;
    assert.equal(isMatchPoint(afterOne), true, '1-0 in a best of three is match point');
  });

  it('nothing is announced once the match is over', () => {
    const { outcome } = play(['p1', 'p1']);
    assert.equal(outcome.nextAnnouncement, null);
  });
});

describe('draws burn a round and award nothing', () => {
  it('a draw advances the round without moving the score', () => {
    const out = resolveRound(createRoundState(), 'draw', 'TIMEOUT');
    assert.equal(out.matchOver, false);
    assert.deepEqual([out.state.p1Wins, out.state.p2Wins], [0, 0]);
    assert.equal(out.state.round, 2);
    assert.equal(out.state.history.length, 1, 'the round still counts as played');
  });

  it('a best of three can reach 1-1 with a decider still to come', () => {
    const { state, outcome } = play(['p1', 'draw', 'p2']);
    assert.equal(outcome.matchOver, false, '1-1 after three played is not decided');
    assert.equal(scoreLine(state), '1 - 1');
    assert.equal(state.round, 4);
  });

  it('a run of draws cannot play forever', () => {
    const { state, outcome } = play(['draw', 'draw', 'draw', 'draw', 'draw']);
    assert.equal(outcome.matchOver, true, `stopped at ${state.history.length} rounds`);
    assert.equal(state.history.length, MAX_ROUNDS);
    assert.equal(outcome.matchWinner, 'draw', 'nobody led, so the match is drawn');
  });

  it('at the ceiling the lead takes it', () => {
    const { outcome } = play(['p1', 'draw', 'draw', 'draw', 'draw']);
    assert.equal(outcome.matchOver, true);
    assert.equal(outcome.matchWinner, 'p1');
  });
});

describe('it is pure', () => {
  it('resolveRound never mutates the state it is given', () => {
    const before = createRoundState();
    const snapshot = JSON.stringify(before);
    resolveRound(before, 'p1', 'KO');
    assert.equal(JSON.stringify(before), snapshot);
  });

  it('history records every round with its condition', () => {
    let s: RoundState = createRoundState();
    s = resolveRound(s, 'p1', 'PERFECT').state;
    s = resolveRound(s, 'p2', 'TIMEOUT').state;
    assert.deepEqual(s.history, [
      { round: 1, winner: 'p1', condition: 'PERFECT' },
      { round: 2, winner: 'p2', condition: 'TIMEOUT' },
    ]);
  });

  it('a single-round match is still supported', () => {
    const { outcome } = play(['p1'], 1);
    assert.equal(outcome.matchOver, true);
    assert.equal(outcome.matchWinner, 'p1');
  });
});
