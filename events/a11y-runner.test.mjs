// Tests for the a11y runner's pure plan (events/tools/a11y/screens.mjs and the driver list). The runner itself needs a
// browser, so it is opt-in (docs/events/A11Y.md); these tests keep its plan honest under `node --test`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SCREENS, THEMES, SIZES, NARROW, BLOCKING, matrix, pickScreens, summarize, screenTable } from './tools/a11y/screens.mjs';
import { DRIVERS } from './tools/a11y/drivers.mjs';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

// Why: a screen in the list with no driver (or a driver for no screen) means a judge's screen is silently never checked.
test('every screen in the plan has a driver, and every driver is in the plan', () => {
  assert.deepEqual(Object.keys(DRIVERS).sort(), SCREENS.map((s) => s.id).sort());
  assert.equal(new Set(SCREENS.map((s) => s.id)).size, SCREENS.length, 'screen ids are unique');
});

// Why: the pass must cover each room family a judge meets and each ballot step; dropping one hides its failures.
test('the plan walks every non-Congress screen type the pass promises', () => {
  const ids = SCREENS.map((s) => s.id);
  for (const id of ['myday', 'picker', 'picker-confirm', 'setup-paste', 'setup-typed', 'room-speech', 'room-interp', 'room-duo',
    'room-extemp', 'room-impromptu', 'rank', 'rate-points', 'rate-words', 'review-ranks', 'review-comments', 'print',
    'history', 'settings', 'keyboard', 'type', 'palette', 'dialog-ask', 'dialog-input', 'toast-undo']) assert.ok(ids.includes(id), id);
  assert.ok(!ids.some((id) => /congress|chamber/.test(id)), 'Congress has its own pass');
});

// Why: a judge uses a phone and a laptop, in light or dark; a matrix that skips one hides contrast and reflow failures.
test('the matrix is every screen in light and dark at phone and laptop size', () => {
  assert.deepEqual(THEMES, ['light', 'dark']);
  assert.deepEqual(SIZES.map((s) => [s.width, s.height]), [[390, 844], [1366, 768]]);
  assert.equal(NARROW.width, 360);
  const m = matrix();
  assert.equal(m.length, SCREENS.length * 4);
  assert.equal(new Set(m.map((r) => r.screen + r.theme + r.size)).size, m.length);
});

// Why: a typo in --only must stop the run, not quietly check nothing and print "0 failed".
test('pickScreens keeps the named screens and refuses unknown ones', () => {
  assert.equal(pickScreens('').length, SCREENS.length);
  assert.deepEqual(pickScreens('rank, type').map((s) => s.id), ['rank', 'type']);
  assert.throws(() => pickScreens('rank,nope'), /Unknown screen: nope/);
});

// Why: the summary is the pass/fail line; if it miscounts, a serious failure ships while the run says it passed.
test('summarize fails a run on serious, critical, a page error or a sideways scroll, not on moderate or minor', () => {
  const v = (id, impact, n = 1) => ({ id, impact, nodes: Array.from({ length: n }, () => ({})) });
  const s = summarize([
    { screen: 'a', theme: 'light', size: 'phone', violations: [v('color-contrast', 'serious', 2), v('region', 'moderate')] },
    { screen: 'b', theme: 'dark', size: 'phone', violations: [v('region', 'moderate')] },
    { screen: 'c', theme: 'dark', size: 'laptop', violations: [], overflow: 120 },
    { screen: 'd', theme: 'dark', size: 'laptop', violations: [v('aria-roles', 'critical')], error: '' },
    { screen: 'e', theme: 'light', size: 'laptop', violations: [], error: 'timeout' },
    { screen: 'f', theme: 'light', size: 'laptop', violations: [v('x', 'minor')] },
  ]);
  assert.equal(s.runs, 6);
  assert.equal(s.failed, 4);
  assert.deepEqual(s.byImpact, { critical: 1, serious: 2, moderate: 2, minor: 1 });
  assert.deepEqual(s.rules.map((r) => r.id), ['aria-roles', 'color-contrast', 'region', 'x']);
  assert.deepEqual(s.rules.find((r) => r.id === 'region').where, ['a', 'b']);
  assert.deepEqual(s.overflow, ['c · dark · laptop (120 px)']);
  assert.deepEqual(s.errors, ['e · light · laptop: timeout']);
  assert.deepEqual(BLOCKING, ['serious', 'critical']);
});

// Why: the A11Y.md table is the record reviewers read; a cell that says "pass" over a failure misleads them.
test('screenTable writes one row per screen with a cell per size and theme', () => {
  const rows = screenTable([
    { screen: 'rank', theme: 'light', size: 'phone', violations: [] },
    { screen: 'rank', theme: 'dark', size: 'phone', violations: [{ id: 'c', impact: 'serious', nodes: [{}] }] },
    { screen: 'rank', theme: 'light', size: 'laptop', violations: [{ id: 'r', impact: 'moderate', nodes: [{}] }] },
    { screen: 'rank', theme: 'dark', size: 'laptop', violations: [], overflow: 9 },
  ]);
  assert.deepEqual(rows, ['| Rank board | pass | 1 serious | pass (1 moderate or minor) | scrolls sideways |']);
});

// Why: axe must be pinned and kept out of git and out of the app; a moving version changes results between runs, and
// axe in the app would ship a test tool to every judge.
test('axe-core is pinned, git-ignored, and never loaded by the app', () => {
  assert.match(read('./tools/a11y/run.mjs'), /export const AXE_VERSION = '\d+\.\d+\.\d+';/);
  assert.match(read('./tools/a11y/.gitignore'), /^\.deps\/$/m);
  assert.match(read('./tools/a11y/.gitignore'), /^out\/$/m);
  assert.doesNotMatch(read('./index.html'), /axe/i);
  assert.doesNotMatch(read('./sw-files.js'), /tools\/a11y|axe/);
});
