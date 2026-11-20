// Run with: node --test
// The keyboard map (keys.js). Spec: docs/design/SPEC.md §1.3, §1.5, §4.1 and §6.1.
const test = require('node:test');
const assert = require('node:assert/strict');
const K = require('./keys.js');

const SPACE = { code: 'Space', key: ' ' };
const CMD_ENTER = { code: 'Enter', key: 'Enter', meta: true };
const CTRL_ENTER = { code: 'Enter', key: 'Enter', ctrl: true };
const flow = (over) => Object.assign({ place: 'flow', focus: 'none', modal: false, singleKeysOn: true }, over);
const act = (ev, ctx) => K.clockKeyAction(Object.assign({}, ev, flow(ctx)));

// Why: Space is the judge's main clock key; if it fails with nothing focused, the judge loses speech time.
test('clockKeyAction: Space with nothing focused, on Flow, toggles', () => {
  assert.equal(act(SPACE), 'toggle');
});

// Why: Space on a focused checkbox or button must do its native job (Q6), or keyboard users cannot tick boxes.
test('clockKeyAction: Space with focus on a control gives null', () => {
  assert.equal(act(SPACE, { focus: 'control' }), null);
});

// Why: Space in a flow column must type a space, never start or stop the clock.
test('clockKeyAction: Space with focus in text gives null', () => {
  assert.equal(act(SPACE, { focus: 'text' }), null);
});

// Why: the clock lives on Flow only (Q6); Space on Decide must scroll or press buttons as normal.
test('clockKeyAction: Space on Decide gives null', () => {
  assert.equal(act(SPACE, { place: 'decide' }), null);
});

// Why: a Space under an open dialog would start the clock behind the judge's back.
test('clockKeyAction: Space with a modal open gives null', () => {
  assert.equal(act(SPACE, { modal: true }), null);
});

// Why: a held Space key would flick the clock on and off many times a second.
test('clockKeyAction: Space with repeat gives null', () => {
  assert.equal(act(Object.assign({ repeat: true }, SPACE)), null);
});

// Why: WCAG 2.1.4 needs a way to turn one-key shortcuts off; the off switch must also silence Space.
test('clockKeyAction: Space with singleKeysOn false gives null', () => {
  assert.equal(act(SPACE, { singleKeysOn: false }), null);
});

// Why: ⌘ Enter is the only way to run the clock while typing in a column (Q6).
test('clockKeyAction: ⌘ Enter with focus in text, on Flow, toggles', () => {
  assert.equal(act(CMD_ENTER, { focus: 'text' }), 'toggle');
});

// Why: Windows and Chromebook judges use Ctrl+Enter; it must work the same way.
test('clockKeyAction: Ctrl+Enter with focus in text, on Flow, toggles', () => {
  assert.equal(act(CTRL_ENTER, { focus: 'text' }), 'toggle');
});

// Why: off Flow the clock key must do nothing (Q6), so ⌘ Enter in a Round form never starts a speech.
test('clockKeyAction: ⌘ Enter on Round gives null', () => {
  assert.equal(act(CMD_ENTER, { place: 'setup', focus: 'text' }), null);
});

// Why: Enter that ends an input-method word (Chinese, Japanese) must not also start the clock.
test('clockKeyAction: ⌘ Enter while composing gives null', () => {
  assert.equal(act(Object.assign({ composing: true }, CMD_ENTER), { focus: 'text' }), null);
});

// Why: Shift+Space or Alt+Space has other jobs; only a plain Space runs the clock.
test('clockKeyAction: Space with a modifier gives null', () => {
  for (const m of ['meta', 'ctrl', 'alt', 'shift']) assert.equal(act(Object.assign({ [m]: true }, SPACE)), null, m);
});

// Why: [ must open the speeches pane from the grid, but type "[" inside a column.
test('speechesKeyAction: [ on Flow toggles; in text gives null; ⌘\\ works while typing; off Flow gives null', () => {
  const sk = (ev, ctx) => K.speechesKeyAction(Object.assign({}, ev, flow(ctx)));
  assert.equal(sk({ key: '[', code: 'BracketLeft' }), 'toggle');
  assert.equal(sk({ key: '[', code: 'BracketLeft' }, { focus: 'control' }), 'toggle');
  assert.equal(sk({ key: '[', code: 'BracketLeft' }, { focus: 'text' }), null);
  assert.equal(sk({ key: '[', code: 'BracketLeft' }, { singleKeysOn: false }), null);
  assert.equal(sk({ key: '\\', code: 'Backslash', ctrl: true }, { focus: 'text' }), 'toggle');
  assert.equal(sk({ key: '\\', code: 'Backslash', meta: true }, { focus: 'text' }), 'toggle');
  assert.equal(sk({ key: '[', code: 'BracketLeft' }, { place: 'decide' }), null);
  assert.equal(sk({ key: '[', code: 'BracketLeft' }, { modal: true }), null);
});

// Why: single-character keys match the character the layout makes, so AltGr layouts can still type "[".
test('matchKey: [ with AltGr or Shift matches; with Ctrl or plain Alt it does not', () => {
  assert.equal(K.matchKey({ key: '[', altGraph: true, alt: true, ctrl: false }, flow()), 'pane.speeches');
  assert.equal(K.matchKey({ key: '[', shift: true }, flow()), 'pane.speeches');
  assert.equal(K.matchKey({ key: '[', ctrl: true }, flow()), null);
  assert.equal(K.matchKey({ key: '[', alt: true }, flow()), null);
});

// Why: the shortcut sheet and palette read the registry; an entry with no label or no key set shows as blank.
test('registry: every entry has an id, a label, a group and both key sets', () => {
  const ids = new Set();
  for (const e of K.REGISTRY) {
    assert.ok(e.id && !ids.has(e.id), 'unique id ' + e.id); ids.add(e.id);
    assert.ok(e.label && e.group, e.id + ' has a label and a group');
    assert.ok(e.keys && e.keys.mac && e.keys.other, e.id + ' has mac and other keys');
    assert.ok(['flow', 'global'].includes(e.scope), e.id + ' has a known scope');
  }
});

// Why: two entries on one key in one scope would make one of them unreachable.
test('registry: no two entries in one scope share a key', () => {
  for (const os of ['mac', 'other']) {
    const seen = new Map();
    for (const e of K.REGISTRY) {
      const k = e.scope + '|' + e.keys[os];
      assert.ok(!seen.has(k), e.id + ' clashes with ' + seen.get(k) + ' on ' + os);
      seen.set(k, e.id);
    }
  }
});

// Why: a shortcut on a browser key (Ctrl+T, Ctrl+Tab) or an AltGr/Option key would either never fire or block typing.
test('registry: no entry uses a reserved key (spec 4.1)', () => {
  for (const e of K.REGISTRY) {
    assert.equal(K.isReservedCombo(e.keys.mac, 'mac'), false, e.id + ' mac');
    assert.equal(K.isReservedCombo(e.keys.other, 'other'), false, e.id + ' other');
  }
  // The reserved test itself must catch the keys the spec names.
  for (const c of ['Control+Alt+K', 'Control+PageDown', 'Control+Tab', 'Control+1', 'Control+T', 'Control+W', 'Control+D']) assert.equal(K.isReservedCombo(c, 'other'), true, c);
  assert.equal(K.isReservedCombo('Alt+K', 'mac'), true);
  assert.equal(K.isReservedCombo('Meta+W', 'mac'), true);
});

// Why: Space and the single keys must never fire inside a text box, so focusKind must call every typing box "text".
test('focusKind: body is none; inputs, textareas, selects and editable areas are text; buttons and checkboxes are controls', () => {
  assert.equal(K.focusKind(null), 'none');
  assert.equal(K.focusKind({ tagName: 'BODY' }), 'none');
  assert.equal(K.focusKind({ tagName: 'TEXTAREA' }), 'text');
  assert.equal(K.focusKind({ tagName: 'INPUT', type: 'text' }), 'text');
  assert.equal(K.focusKind({ tagName: 'INPUT', type: 'number' }), 'text');
  assert.equal(K.focusKind({ tagName: 'INPUT' }), 'text');
  assert.equal(K.focusKind({ tagName: 'SELECT' }), 'text');
  assert.equal(K.focusKind({ tagName: 'DIV', isContentEditable: true }), 'text');
  assert.equal(K.focusKind({ tagName: 'INPUT', type: 'checkbox' }), 'control');
  assert.equal(K.focusKind({ tagName: 'BUTTON' }), 'control');
  assert.equal(K.focusKind({ tagName: 'A' }), 'control');
});

// Why: the tooltip is the main place a judge learns the keys; the wrong key name on Windows teaches a key that fails.
test('startTip and speechesTip: Mac and other copy, and the single-key-off copy', () => {
  assert.equal(K.startTip(true, true), 'Start or pause (Space, or ⌘ Enter while typing)');
  assert.equal(K.startTip(false, true), 'Start or pause (Space, or Ctrl+Enter while typing)');
  assert.equal(K.startTip(true, false), 'Start or pause (⌘ Enter)');
  assert.equal(K.startTip(false, false), 'Start or pause (Ctrl+Enter)');
  assert.equal(K.speechesTip(true, true), 'Show speeches ([ or ⌘\\)');
  assert.equal(K.speechesTip(false, true), 'Show speeches ([ or Ctrl+\\)');
  assert.equal(K.isMacPlatform('MacIntel'), true);
  assert.equal(K.isMacPlatform('Win32'), false);
});

// Why: a guard only. If the old blur-to-steal-Space line comes back, checkboxes break and the caret is lost (Q6).
// The real protection is focusKind and the clockKeyAction focus cases above; this regex cannot catch other forms.
test('app.js (guard): the key handler no longer calls el.blur()', () => {
  const app = require('node:fs').readFileSync(require('node:path').join(__dirname, 'app.js'), 'utf8');
  assert.equal(/el\.blur\(\)/.test(app), false);
});

// Why: app.js runs keys only through keyAction; if keyAction and the spec 6.1 rules split, tests would pass on code the page never runs.
test('keyAction: gives the action of the matched entry, and clockKeyAction / speechesKeyAction agree with it', () => {
  assert.equal(K.keyAction({ code: 'Space', key: ' ' }, flow()), 'clock');
  assert.equal(K.keyAction({ key: 'Enter', meta: true }, flow({ focus: 'text' })), 'clock');
  assert.equal(K.keyAction({ key: '[' }, flow()), 'speeches');
  assert.equal(K.keyAction({ key: '\\', ctrl: true }, flow({ focus: 'text' })), 'speeches');
  assert.equal(K.keyAction({ key: 'Escape' }, flow()), null); // the Esc stack owns Esc
  assert.equal(K.keyAction({ code: 'Space', key: ' ' }, flow({ focus: 'text' })), null);
  const x = Object.assign({ key: '[' }, flow());
  assert.equal(K.speechesKeyAction(x), 'toggle');
  assert.equal(K.clockKeyAction(x), null);
});

// Why: an entry with no known action would match a key and then do nothing, so the judge's key press is lost.
test('registry: every entry names an action app.js knows', () => {
  for (const e of K.REGISTRY) assert.ok(['clock', 'speeches', 'close'].includes(e.action), e.id + ' action ' + e.action);
});

// Why: a second path from key to action in app.js (the old ACTION table) could drift from the tested keyAction.
test('app.js (guard): the key handler uses K.keyAction and no separate action table', () => {
  const app = require('node:fs').readFileSync(require('node:path').join(__dirname, 'app.js'), 'utf8');
  assert.ok(/K\.keyAction\(/.test(app));
  assert.equal(/K\.ACTION\b/.test(app), false);
});
