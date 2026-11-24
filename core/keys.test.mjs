// Tests for the shared keyboard rules and palette search, core/keys.js (docs/events/LANDING.md §3, step C5).
// Run with: node --test. Debate's own shortcuts and commands keep their tests in keys.test.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as core from './keys.js';

const require = createRequire(import.meta.url);
const K = require('../keys.js');
const CORE_SRC = readFileSync(new URL('keys.js', import.meta.url), 'utf8');
const space = { code: 'Space', key: ' ' };
const idle = { focus: 'none', singleKeysOn: true };

// Why: each app owns its commands. If a debate command lived in core/, the second app would run debate actions on its
// own keys, and a debate change could break it.
test('core/keys.js names none of debate\'s shortcuts or palette commands', () => {
  const ids = [...K.REGISTRY.map((e) => e.id), ...K.REGISTRY.map((e) => e.action), ...K.COMMANDS.map((c) => c.id)];
  for (const id of new Set(ids)) for (const q of ["'", '"', '`']) assert.ok(!CORE_SRC.includes(q + id + q), 'core/keys.js names ' + id);
});

// Why: a scope is how one shortcut works on one part of a page only; if the shared rule ignored scopes, Space would
// start a clock on a page where Space must do something else.
test('a keymap runs a scoped shortcut only while the app says its scope is showing, and a global one always', () => {
  const map = core.createKeymap([
    { id: 'a', action: 'timer', label: 'A', group: 'G', scope: 'clockArea', keys: { mac: 'Space', other: 'Space' }, single: true, noFocus: true },
    { id: 'b', action: 'help', label: 'B', group: 'G', scope: 'global', keys: { mac: '?', other: '?' }, single: true, noFocus: true },
  ]);
  assert.equal(map.keyAction(space, Object.assign({ scopes: [] }, idle)), null);
  assert.equal(map.keyAction(space, Object.assign({ scopes: ['clockArea'] }, idle)), 'timer');
  assert.equal(map.keyAction({ key: '?' }, Object.assign({ scopes: [] }, idle)), 'help');
  assert.equal(map.keyAction({ key: '?' }, Object.assign({ scopes: [] }, idle, { singleKeysOn: false })), null, 'the single-key switch still wins');
});

// Why: a shortcut whose scope the app never names must stay off; running it by default would fire it on every page.
test('an unknown scope is off, and a missing scopes list does not throw', () => {
  const map = core.createKeymap([{ id: 'a', action: 'x', label: 'A', group: 'G', scope: 'nowhere', keys: { mac: '?', other: '?' }, single: true }]);
  assert.equal(map.keyAction({ key: '?' }, idle), null);
  assert.equal(map.keyAction({ key: '?' }, Object.assign({ scopes: ['elsewhere'] }, idle)), null);
});

// Why: two apps on one machine must not share one list; a second app's keymap that saw debate's shortcuts would run
// debate actions there.
test('two keymaps keep their own shortcuts', () => {
  const other = core.createKeymap([]);
  assert.equal(other.keyAction(space, Object.assign({ scopes: ['flow'] }, idle)), null);
  assert.equal(K.keyAction(space, Object.assign({ place: 'flow' }, idle)), 'clock');
});

// Why: a judge reads these names on the shortcut sheet and in the palette; a wrong name sends them to the wrong key.
test('key names read right on Mac and elsewhere', () => {
  assert.equal(core.formatKeys('Meta+k', true), '⌘K');
  assert.equal(core.formatKeys('Meta+k', false), 'Ctrl+K');
  assert.equal(core.formatKeys('Meta+Enter', true), '⌘ Enter');
  assert.equal(core.formatKeys('Escape', false), 'Esc');
});

// Why: the palette must put the row a judge means first; a weak match above a prefix match makes Enter run the wrong command.
test('palette search: prefix, then word, then alias, then fuzzy, and an empty query keeps every row', () => {
  const rows = [{ label: 'Open file', alias: [] }, { label: 'Close the file', alias: [] }, { label: 'Print', alias: ['pdf'] }, { label: 'Fold sheets', alias: [] }];
  assert.deepEqual(core.searchCommands('', rows).length, 4);
  assert.deepEqual(core.searchCommands('file', rows).map((r) => r.label), ['Open file', 'Close the file']);
  assert.deepEqual(core.searchCommands('pdf', rows).map((r) => r.label), ['Print']);
  assert.deepEqual(core.searchCommands('fs', rows).map((r) => r.label), ['Fold sheets']);
  assert.deepEqual(core.searchCommands('op', rows).map((r) => r.label)[0], 'Open file');
});

// Why: debate's tests check these rules through TabulaKeys; a second copy there would let the tests pass on code the
// shared module does not run.
test('TabulaKeys gives the very same shared functions as core/keys.js', () => {
  for (const k of ['parseCombo', 'isReservedCombo', 'focusKind', 'keyMatches', 'isMacPlatform', 'formatKeys', 'searchCommands']) assert.equal(K[k], core[k], k);
  assert.equal(K.entryKeys, core.shortcutKeys);
});

// Why: a bare Enter shortcut (Speech Events picks speaker 12 by "1, 2, Enter") must fire on Enter alone; if it also
// fired on ⌘/Ctrl/Shift+Enter it would steal combos such as debate's Meta+Enter, and if it never fired the pick fails.
test('a bare Enter shortcut matches Enter alone, and modifier combos keep their own path', () => {
  const bare = { keys: { other: 'Enter', mac: 'Enter' } };
  const combo = { keys: { other: 'Meta+Enter', mac: 'Meta+Enter' } };
  const ev = (extra) => Object.assign({ code: 'Enter', key: 'Enter', meta: false, ctrl: false, alt: false, shift: false }, extra);
  assert.equal(core.keyMatches(bare, ev()), true);
  for (const m of ['meta', 'ctrl', 'alt', 'shift']) assert.equal(core.keyMatches(bare, ev({ [m]: true })), false, 'bare Enter with ' + m);
  assert.equal(core.keyMatches(combo, ev({ meta: true })), true, 'Meta+Enter still matches ⌘ Enter');
  assert.equal(core.keyMatches(combo, ev({ ctrl: true })), true, 'and Ctrl+Enter');
  assert.equal(core.keyMatches(combo, ev()), false, 'Meta+Enter never fires on Enter alone');
});
