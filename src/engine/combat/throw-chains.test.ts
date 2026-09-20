// `.ts` extensions on purpose — the repo's runner resolves them literally.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CHAIN_BREAK_WINDOW, SOURCE_FPS, THROW_BREAK_WINDOW, activeChainLink,
  attemptThrowBreak, chainWindowOpen, openThrowBreak, throwMove, throwMoves,
  throwStarters, tickThrowBreak,
} from './ThrowChains.ts';

describe('capture grapples read off the imported data', () => {
  it('finds the throws, and separates starters from follow-ups', () => {
    const all = throwMoves();
    assert.ok(all.length >= 5, `expected the 5 Throw-height moves, got ${all.length}`);
    const starters = throwStarters();
    assert.ok(starters.length >= 1, 'no throw can be started at all');
    assert.ok(starters.length < all.length, 'nothing is marked FOLLOWUP_ONLY — the chain is lost');
  });

  it('resolves the Customer_Service chain that the engine never read', () => {
    const t = throwMove('chara_tutor', '12');
    assert.ok(t, 'chara_tutor/12 did not resolve');
    assert.equal(t.followupOnly, false, 'the chain starter must be startable');
    assert.ok(t.chain.length >= 1, 'the starter has no follow-up — there is no chain');
    assert.deepEqual(t.chain[0].frames, [0, 8], 'the authored window is 0-8 frames');
  });

  it('converts frame windows to seconds once, at the edge', () => {
    const t = throwMove('chara_tutor', '12');
    assert.ok(t);
    const link = t.chain[0];
    assert.equal(link.from, 0);
    assert.ok(Math.abs(link.to - 8 / SOURCE_FPS) < 1e-9, 'eight frames is 0.133s at 60fps');
  });

  it('the chain window is tight — a chain you cannot drop is a cutscene', () => {
    const t = throwMove('chara_tutor', '12');
    assert.ok(t);
    const link = t.chain[0];
    assert.ok(link.to - link.from < 0.2, 'the window is too generous to be a read');
    assert.equal(chainWindowOpen(link, 0.05), true);
    assert.equal(chainWindowOpen(link, 0.5), false, 'the window never closed');
    assert.ok(activeChainLink(t, 0.05));
    assert.equal(activeChainLink(t, 0.9), null);
  });
});

describe('throw breaks — which did not exist at all', () => {
  it('opens a window the defender can actually react in', () => {
    const s = openThrowBreak(0);
    assert.equal(s.remaining, THROW_BREAK_WINDOW);
    assert.ok(THROW_BREAK_WINDOW > 0.25, 'too short to be a reaction rather than a guess');
  });

  it('a chain throw is harder to escape than the initial grab', () => {
    assert.ok(CHAIN_BREAK_WINDOW < THROW_BREAK_WINDOW);
    assert.equal(openThrowBreak(1).remaining, CHAIN_BREAK_WINDOW);
  });

  it('breaks inside the window and refuses outside it', () => {
    const s = openThrowBreak(0);
    tickThrowBreak(s, 0.1);
    assert.equal(attemptThrowBreak(s), true, 'a break inside the window failed');

    const late = openThrowBreak(0);
    while (tickThrowBreak(late, 1 / 60)) { /* run the window out */ }
    assert.equal(attemptThrowBreak(late), false, 'a throw was broken after it committed');
  });

  it('cannot be broken twice', () => {
    const s = openThrowBreak(0);
    assert.equal(attemptThrowBreak(s), true);
    assert.equal(attemptThrowBreak(s), false);
  });

  it('the window closes on its own', () => {
    const s = openThrowBreak(0);
    let open = true;
    let t = 0;
    for (let i = 0; i < 200 && open; i++) { open = tickThrowBreak(s, 1 / 60); t += 1 / 60; }
    assert.equal(open, false, 'the break window never closed — the throw never commits');
    assert.ok(Math.abs(t - THROW_BREAK_WINDOW) < 0.05);
  });
});
