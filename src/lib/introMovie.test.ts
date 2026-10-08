/**
 * Intro FMV: the skip / ended / fallback rules. The one invariant: the intro
 * can NEVER keep the viewer from the start screen, and onDone fires once.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  INTRO_PREF_KEY,
  INTRO_SEEN_KEY,
  createGamepadStartEdge,
  createIntroSession,
  decideIntro,
  isSkipKey,
  markIntroSeen,
  parseIntroManifest,
  type IntroEndReason,
  type KeyValueStore,
} from './introMovie.ts';

function memStore(init: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...init };
  return { data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = v; } };
}

function session(opts: { load?: number; stall?: number } = {}) {
  const done: IntroEndReason[] = [];
  let seen = 0;
  const s = createIntroSession({
    onDone: (r) => done.push(r),
    onSeen: () => { seen++; },
    loadTimeoutMs: opts.load ?? 1000,
    stallTimeoutMs: opts.stall ?? 1000,
  });
  s.begin(0);
  return { s, done, seen: () => seen };
}

describe('decideIntro — when to try the intro', () => {
  it('plays on first launch', () => {
    assert.deepEqual(decideIntro({ storage: memStore() }), { play: true, reason: 'first-launch' });
  });
  it('does not play once seen', () => {
    assert.equal(decideIntro({ storage: memStore({ [INTRO_SEEN_KEY]: '1' }) }).play, false);
  });
  it('?intro=1 forces it on even when seen, automated or reduced-motion', () => {
    const d = decideIntro({ search: '?intro=1', storage: memStore({ [INTRO_SEEN_KEY]: '1', [INTRO_PREF_KEY]: 'never' }), webdriver: true, reducedMotion: true });
    assert.deepEqual(d, { play: true, reason: 'query-on' });
  });
  it('?intro=0 forces it off on first launch', () => {
    assert.deepEqual(decideIntro({ search: '?intro=0', storage: memStore() }), { play: false, reason: 'query-off' });
  });
  it('?intro=never / always persist the setting', () => {
    const st = memStore();
    decideIntro({ search: '?intro=never', storage: st });
    assert.equal(st.data[INTRO_PREF_KEY], 'never');
    assert.equal(decideIntro({ storage: st }).reason, 'pref-never');
    decideIntro({ search: '?intro=always', storage: st });
    assert.equal(decideIntro({ storage: memStore({ ...st.data, [INTRO_SEEN_KEY]: '1' }) }).reason, 'pref-always');
  });
  it('skips under automation so existing harnesses land on the title screen', () => {
    assert.deepEqual(decideIntro({ storage: memStore(), webdriver: true }), { play: false, reason: 'automation' });
  });
  it('skips for prefers-reduced-motion', () => {
    assert.equal(decideIntro({ storage: memStore(), reducedMotion: true }).reason, 'reduced-motion');
  });
  it('survives a throwing localStorage (Safari private mode)', () => {
    const bad: KeyValueStore = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
    assert.equal(decideIntro({ storage: bad }).play, true);
    assert.doesNotThrow(() => markIntroSeen(bad));
    assert.doesNotThrow(() => decideIntro({ search: '?intro=never', storage: bad }));
  });
});

describe('parseIntroManifest — no usable manifest means no intro', () => {
  const base = '/brutalfistgrokversionten/intro/';
  it('resolves sources against the deploy base, mp4 first then webm', () => {
    const m = parseIntroManifest({ duration: 60, placeholder: true, sources: [{ file: 'intro.mp4', type: 'video/mp4' }, { file: 'intro.webm', type: 'video/webm' }] }, base);
    assert.ok(m);
    assert.deepEqual(m.sources.map((s) => s.src), [`${base}intro.mp4`, `${base}intro.webm`]);
    assert.equal(m.placeholder, true);
    assert.equal(m.duration, 60);
  });
  it('falls back to the top-level `file` field', () => {
    assert.deepEqual(parseIntroManifest({ file: 'intro.mp4' }, base)?.sources, [{ src: `${base}intro.mp4`, type: 'video/mp4' }]);
  });
  for (const [name, raw] of [
    ['null', null],
    ['a string', 'nope'],
    ['enabled:false', { enabled: false, file: 'intro.mp4' }],
    ['no sources', { sources: [] }],
    ['non-video type', { sources: [{ file: 'x.mp3', type: 'audio/mpeg' }] }],
    ['path traversal', { sources: [{ file: '../../secret.mp4', type: 'video/mp4' }] }],
    ['javascript: url', { sources: [{ file: 'javascript:alert(1)', type: 'video/mp4' }] }],
  ] as const) {
    it(`rejects ${name}`, () => assert.equal(parseIntroManifest(raw, base), null));
  }
});

describe('skip inputs', () => {
  it('Esc and Enter skip; Space and letters do not', () => {
    assert.ok(isSkipKey('Escape'));
    assert.ok(isSkipKey('Enter'));
    assert.ok(!isSkipKey(' '));
    assert.ok(!isSkipKey('a'));
  });
  it('gamepad Start skips on the press edge, not when already held at mount', () => {
    const edge = createGamepadStartEdge();
    const pad = (down: boolean) => [{ index: 0, buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: i === 9 && down })) }];
    assert.equal(edge(pad(true)), false, 'held at mount');
    assert.equal(edge(pad(true)), false, 'still held');
    assert.equal(edge(pad(false)), false, 'released');
    assert.equal(edge(pad(true)), true, 'fresh press');
    assert.equal(edge([null]), false, 'disconnected pad');
  });
  it('a pad that connects with Start already down does not skip until re-pressed', () => {
    const edge = createGamepadStartEdge();
    assert.equal(edge([]), false);
    const down = [{ index: 1, buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: i === 9 })) }];
    assert.equal(edge(down), false);
  });
});

describe('createIntroSession — ended / skip / fallback', () => {
  it('ended hands off once and marks seen', () => {
    const { s, done, seen } = session();
    s.playing(10);
    assert.equal(s.ended(), true);
    assert.equal(s.ended(), false);
    s.skip();
    s.error();
    assert.deepEqual(done, ['ended']);
    assert.equal(seen(), 1);
    assert.equal(s.phase, 'done');
  });
  it('skip after playback started marks seen', () => {
    const { s, done, seen } = session();
    s.progress(3.2, 100);
    s.skip();
    assert.deepEqual(done, ['skip']);
    assert.equal(seen(), 1);
  });
  it('skip before anything played does NOT mark seen', () => {
    const { s, done, seen } = session();
    s.skip();
    assert.deepEqual(done, ['skip']);
    assert.equal(seen(), 0);
  });
  it('a load error falls straight through to the start screen, not seen', () => {
    const { s, done, seen } = session();
    s.error();
    assert.deepEqual(done, ['error']);
    assert.equal(seen(), 0);
  });
  it('missing manifest falls through', () => {
    const { s, done } = session();
    s.noManifest();
    assert.deepEqual(done, ['no-manifest']);
  });
  it('a video that never starts is abandoned by the watchdog', () => {
    const { s, done, seen } = session({ load: 1000 });
    assert.equal(s.tick(900), false);
    assert.equal(s.tick(1001), true);
    assert.deepEqual(done, ['stall']);
    assert.equal(seen(), 0);
  });
  it('a mid-movie stall is abandoned too', () => {
    const { s, done } = session({ stall: 1000 });
    s.playing(0);
    s.progress(1, 500);
    s.progress(2, 1400);
    assert.equal(s.tick(2300), false);
    assert.equal(s.tick(2401), true);
    assert.deepEqual(done, ['stall']);
  });
  it('autoplay refused waits for the gate — no watchdog while blocked', () => {
    const { s, done } = session({ load: 1000 });
    s.autoplayBlocked(10);
    assert.equal(s.phase, 'gate-blocked');
    assert.equal(s.tick(60_000), false);
    assert.deepEqual(done, []);
    s.gateTapped(60_000);
    assert.equal(s.phase, 'loading');
    assert.equal(s.tick(60_500), false);
    s.playing(60_600);
    assert.equal(s.ended(), true);
    assert.deepEqual(done, ['ended']);
  });
  it('skip still works while the gate is up', () => {
    const { s, done } = session();
    s.autoplayBlocked(0);
    s.skip();
    assert.deepEqual(done, ['skip']);
  });
  it('a hidden tab does not count as a stall', () => {
    const { s, done } = session({ stall: 1000 });
    s.playing(0);
    s.hold(5000);
    assert.equal(s.tick(5500), false);
    assert.deepEqual(done, []);
  });
});
