// Run with: node --test
// The shared UI rules behind ui.js (spec Slice 0: 4.2 dialog, 4.3 toasts, S0.4 Esc stack). The rules are pure
// functions in logic.js; ui.js only does the DOM work.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const L = require('./logic.js');

// Why: Esc must close only the top layer; closing two at once (a dialog and the tour under it) loses the judge's place.
test('escTop: picks the open layer with the highest rank, ignores closed ones, and gives -1 when none is open', () => {
  const layers = [{ rank: 40, open: true }, { rank: 100, open: false }, { rank: 90, open: true }, { rank: 30, open: true }];
  assert.equal(L.escTop(layers), 2);
  assert.equal(L.escTop([{ rank: 40, open: false }]), -1);
  assert.equal(L.escTop([]), -1);
  assert.equal(L.escTop(undefined), -1);
});

// Why: several tip layers share one rank; on a tie the first one must win so one Esc closes exactly one tip.
test('escTop: on a tie the layer added first wins', () => {
  assert.equal(L.escTop([{ rank: 50, open: false }, { rank: 50, open: true }, { rank: 50, open: true }]), 1);
});

// Why: the same message on every keystroke (a storage error) must not stack copies over the judge's flow.
test('toastPlan: the same key or the same text reuses that toast and closes nothing', () => {
  const list = [{ key: 'storage', msg: 'old text', action: false }, { key: '', msg: 'Saved', action: false }];
  assert.deepEqual(L.toastPlan(list, { key: 'storage', msg: 'new text', action: false }), { reuse: 0, close: [] });
  assert.deepEqual(L.toastPlan(list, { key: '', msg: 'Saved', action: false }), { reuse: 1, close: [] });
});

// Why: more than 3 toasts cover the round bar; the oldest must go first so the newest news shows.
test('toastPlan: at most 3 toasts, so a fourth closes the oldest', () => {
  const list = [{ msg: 'a' }, { msg: 'b' }, { msg: 'c' }];
  assert.equal(L.TOAST_MAX, 3);
  assert.deepEqual(L.toastPlan(list, { msg: 'd' }), { reuse: -1, close: [0] });
  assert.deepEqual(L.toastPlan([{ msg: 'a' }, { msg: 'b' }], { msg: 'c' }), { reuse: -1, close: [] });
});

// Why: two Undo buttons at once make the judge guess which change each one undoes.
test('toastPlan: a toast with an action closes any other toast with an action, and that counts toward the limit', () => {
  const list = [{ msg: 'a', action: true }, { msg: 'b' }, { msg: 'c' }];
  assert.deepEqual(L.toastPlan(list, { msg: 'd', action: true }), { reuse: -1, close: [0] });
  assert.deepEqual(L.toastPlan(list, { msg: 'd', action: false }), { reuse: -1, close: [0] });
  assert.deepEqual(L.toastPlan([{ msg: 'a' }, { msg: 'b', action: true }, { msg: 'c' }], { msg: 'd', action: true }), { reuse: -1, close: [1] });
});

// Why: first focus decides what Enter does; on a delete dialog it must land on the safe button, not on Delete.
test('askFirstFocus: an asked-for button wins; else cancel in a danger dialog; else primary; else the first', () => {
  const rec = [{ value: false, kind: 'plain' }, { value: true, kind: 'primary' }];
  assert.equal(L.askFirstFocus(rec, { hasFocus: true, focus: true }), 1); // Q-6: "Record" first
  assert.equal(L.askFirstFocus(rec, { hasFocus: true, focus: false }), 0);
  const del = [{ value: 'del', kind: 'danger' }, { value: null, kind: 'plain' }];
  assert.equal(L.askFirstFocus(del, { cancelValue: null }), 1);
  assert.equal(L.askFirstFocus(rec, {}), 1);
  assert.equal(L.askFirstFocus([{ value: 1 }, { value: 2 }], {}), 0);
  assert.equal(L.askFirstFocus(rec, { hasFocus: true, focus: 'missing' }), 1);
});

// Why: a focus trap that lets Tab leave the dialog lets the judge act on the page behind a question they have not answered.
test('trapNext: Tab and Shift+Tab wrap inside the dialog; focus outside goes to the first or last button', () => {
  assert.equal(L.trapNext(0, 3, false), 1);
  assert.equal(L.trapNext(2, 3, false), 0);
  assert.equal(L.trapNext(0, 3, true), 2);
  assert.equal(L.trapNext(-1, 3, false), 0);
  assert.equal(L.trapNext(-1, 3, true), 2);
  assert.equal(L.trapNext(0, 0, false), -1);
});

// Why: app.js uses toast, ask and the Esc stack from ui.js; if ui.js loads after app.js (or the helper does not serve it),
// the page stops at the first toast.
test('index.html loads ui.js after logic.js and before app.js, and the local helper serves it', () => {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const at = (f) => html.search(new RegExp('<script\\b[^>]*\\bsrc="' + f.replace('.', '\\.') + '"'));
  assert.ok(at('ui.js') > at('logic.js') && at('logic.js') >= 0, 'ui.js after logic.js');
  assert.ok(at('ui.js') < html.indexOf('src="app.js"'), 'ui.js before app.js');
  assert.ok(/'\/ui\.js': 'ui\.js'/.test(fs.readFileSync(path.join(__dirname, 'bridge.mjs'), 'utf8')), 'bridge FILES lists /ui.js');
});

// Why: a radio group with one Tab stop per option makes a keyboard judge Tab through every choice in the print dialog; the platform rule is one stop, arrows inside.
test('modalDialog: a radio group is one Tab stop in the focus trap', () => {
  const ui = fs.readFileSync(path.join(__dirname, 'ui.js'), 'utf8');
  const start = ui.indexOf('function modalDialog(');
  const body = ui.slice(start, ui.indexOf('\n  }\n', start));
  assert.match(body, /const oneStop = /, 'the trap has a radio-group rule');
  assert.match(body, /el\.checked \|\| \(!group\.some\(\(r\) => r\.checked\) && group\[0\] === el\)/, 'only the checked radio, or the first when none is');
  assert.match(body, /const focusables = \(\) => [^\n]*&& oneStop\(el\)\)/, 'the Tab list uses the rule');
});
