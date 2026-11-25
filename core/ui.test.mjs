// Tests for the shared toast, dialog and Esc code, core/ui.js (docs/events/LANDING.md §3, step C3). Run with: node --test
// The rules themselves (toastPlan, askFirstFocus, escTop and the rest) keep their unit tests in logic.test.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as core from './ui.js';

const require = createRequire(import.meta.url);
const read = (f) => readFileSync(new URL(f, import.meta.url), 'utf8');

// Why: the dialogs lock the page behind them. A debate layout name inside core/ would lock the wrong parts (or none)
// on the Speech Events page, so a keyboard judge could Tab out of a dialog there.
test('core/ui.js names no part of the debate page; debate passes its own list in', () => {
  const UI = read('../ui.js');
  const list = /const BEHIND = '([^']+)'/.exec(UI)[1].split(',').map((s) => s.trim());
  const CORE = read('ui.js');
  for (const sel of [...list.filter((s) => /^[#.]/.test(s)), '#flow-tabs']) assert.ok(!CORE.includes(sel), 'core/ui.js names ' + sel);
  assert.throws(() => core.createUI({}), /behind selector/);
});

// Why: a second createUI on one page adds a second Esc listener, so one Esc press would close two layers at once.
test('createUI runs once per page; a second call throws', () => {
  const had = 'document' in globalThis;
  const old = globalThis.document;
  globalThis.document = { addEventListener() {}, querySelector: () => null };
  try {
    core.createUI({ behind: 'main' });
    assert.throws(() => core.createUI({ behind: 'main' }), /already called/);
  } finally {
    if (had) globalThis.document = old; else delete globalThis.document;
  }
});

// Why: debate's tests check the rules through PolicyLogic. If PolicyLogic kept its own copy, those tests would pass
// on code the shared dialogs do not run.
test('PolicyLogic gives the very same rule functions as core/ui.js', () => {
  const L = require('../logic.js');
  for (const k of ['escTop', 'toastPlan', 'askFirstFocus', 'trapNext', 'toastMs', 'askInputState']) assert.equal(L[k], core[k], k);
  assert.equal(L.TOAST_MAX, core.TOAST_MAX);
});

// Why: ask() hides its text box with the hidden attribute; if a display rule beats it, a plain dialog shown after a
// text dialog (the events "Keep the key?" question) still shows the last typed text, an API key included.
test('ui.css: the ask() text box stays hidden when ask() has no input', () => {
  const css = readFileSync(new URL('ui.css', import.meta.url), 'utf8');
  assert.match(css, /\.ask-field \{ display: grid;/);
  assert.match(css, /\.ask-field\[hidden\] \{ display: none; \}/);
});

// ---------- keyboard path to a toast (WCAG 2.1.1, 4.1.3) ----------
// Why: an Undo that keyboard users reach only after every other control on the page is, for them, no Undo at all.
test('toastTab: Tab at the origin goes to the toast; Shift+Tab goes back; Tab past its last button continues after the origin', () => {
  assert.equal(core.toastTab({ atOrigin: true, inToast: -1, count: 2, back: false }), 'toast');
  assert.equal(core.toastTab({ atOrigin: true, inToast: -1, count: 2, back: true }), null, 'Shift+Tab at the origin keeps its own job');
  assert.equal(core.toastTab({ atOrigin: false, inToast: -1, count: 2, back: false }), null, 'focus moved on: the browser order again');
  assert.equal(core.toastTab({ inToast: 0, count: 2, back: false }), null, 'Undo to × is plain Tab');
  assert.equal(core.toastTab({ inToast: 0, count: 2, back: true }), 'origin');
  assert.equal(core.toastTab({ inToast: 1, count: 2, back: false }), 'after');
  assert.equal(core.toastTab({ atOrigin: true, inToast: -1, count: 0 }), null, 'no toast, no change');
});

// Why: a screen reader user hears the message from the live region but not that an Undo exists or how to reach it (WCAG 4.1.3).
test('toastSpoken names the action and the key for it', () => {
  assert.equal(core.toastSpoken('Sheet deleted.', 'Undo'), 'Sheet deleted. Undo: press Tab.');
  assert.equal(core.toastSpoken('Saved.', ''), 'Saved.');
});

// A small fake page: a tree of elements in document order, enough for createUI's toast code.
function fakePage() {
  const docL = {};
  const doc = { activeElement: null, body: null, listeners: docL };
  class N {
    constructor(tag, id) { this.tagName = tag.toUpperCase(); this.id = id || ''; this.children = []; this.parent = null; this.attrs = {}; this.listeners = {};
      this.className = ''; this.textContent = ''; this.disabled = false; this.tabIndex = ['BUTTON', 'INPUT', 'A'].includes(this.tagName) ? 0 : -1; }
    get isConnected() { let n = this; while (n.parent) n = n.parent; return n === doc.body; }
    append(...c) { for (const x of c) { x.parent = this; this.children.push(x); } }
    remove() { if (this.parent) { this.parent.children = this.parent.children.filter((x) => x !== this); this.parent = null; } }
    contains(n) { for (let x = n; x; x = x.parent) if (x === this) return true; return false; }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    getAttribute(k) { return this.attrs[k] ?? null; }
    addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }
    fire(t, e = {}) { for (const f of this.listeners[t] || []) f(Object.assign({ target: this }, e)); }
    focus() { const was = doc.activeElement; doc.activeElement = this; if (was && was !== this) was.fire('focusout', { relatedTarget: this }); this.fire('focusin'); }
    closest() { return null; }
    getClientRects() { return [1]; }
    all() { return this.children.flatMap((c) => [c, ...c.all()]); }
    querySelectorAll(sel) { return this.all().filter((n) => (sel === 'button' ? n.tagName === 'BUTTON' : ['BUTTON', 'INPUT', 'A'].includes(n.tagName))); }
    compareDocumentPosition(o) { const order = doc.body.all(); return order.indexOf(o) > order.indexOf(this) ? 4 : 2; }
    click() { this.fire('click'); }
  }
  doc.body = new N('body');
  const before = new N('button', 'before'), del = new N('button', 'delete'), after = new N('button', 'after');
  const toasts = new N('div', 'toasts');
  doc.body.append(before, del, after, toasts, new N('div', 'toasts-polite'), new N('div', 'toasts-alert'));
  Object.assign(doc, {
    createElement: (t) => new N(t),
    getElementById: (id) => doc.body.all().find((n) => n.id === id) || null,
    querySelector: (s) => (s.startsWith('#') ? doc.getElementById(s.slice(1)) : null),
    querySelectorAll: (s) => doc.body.querySelectorAll(s),
    addEventListener: (t, f) => (docL[t] ||= []).push(f),
    dispatchEvent() {},
  });
  // A key press on the page: the Esc stack listens in the capture phase, the Tab path in the bubble phase; both are on document.
  const press = (key, shift = false) => {
    const e = { key, shiftKey: shift, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, stopImmediatePropagation() {} };
    for (const f of docL.keydown || []) f(e);
    return e;
  };
  return { doc, before, del, after, press };
}

// Why: the real toast must behave as the rules say on a page: Undo is the next Tab stop, focus is never trapped, and Esc closes the toast without undoing.
test('createUI toast: Tab reaches Undo next, Shift+Tab and the last button lead back into the page, Esc closes without undoing', async () => {
  const page = fakePage();
  const keep = { document: globalThis.document, CustomEvent: globalThis.CustomEvent };
  globalThis.document = page.doc; globalThis.CustomEvent = class { constructor(t) { this.type = t; } };
  // A fresh copy of the module, so this page's createUI is not the one the earlier test already used.
  const ui = await import('./ui.js?toast-page');
  try {
    const UI = ui.createUI({ behind: 'main' });
    let undone = 0;
    page.del.focus();
    const t = UI.toast('Sheet deleted.', { action: { label: 'Undo', name: 'Undo: delete sheet', run: () => { undone++; } } });
    const [undo, x] = t.el.children.filter((n) => n.tagName === 'BUTTON');
    let e = page.press('Tab');
    assert.equal(page.doc.activeElement, undo, 'Tab from where the judge was goes to Undo');
    assert.ok(e.defaultPrevented);
    e = page.press('Tab');
    assert.equal(e.defaultPrevented, false, 'Undo to × is the browser\'s own Tab');
    x.focus();
    page.press('Tab');
    assert.equal(page.doc.activeElement, page.after, 'Tab past the toast continues after the origin, not at the end of the page');
    undo.focus();
    page.press('Tab', true);
    assert.equal(page.doc.activeElement, page.del, 'Shift+Tab from Undo goes back to the origin');
    undo.focus();
    page.press('Escape');
    assert.equal(undone, 0, 'Esc never runs the action');
    assert.equal(t.el.parent, null, 'Esc closed the toast');
    assert.equal(page.doc.activeElement, page.del, 'focus goes back to where it was');
    const plain = UI.toast('Saved.');
    page.del.focus();
    page.press('Escape');
    assert.ok(plain.el.parent, 'Esc with focus outside a toast leaves the toast alone');
    assert.equal(page.doc.getElementById('toasts-polite').textContent, '', 'the live region fills after a short gap');
    await new Promise((ok) => setTimeout(ok, 100));
    assert.equal(page.doc.getElementById('toasts-polite').textContent, 'Saved.');
    plain.el.children.find((n) => n.tagName === 'BUTTON').click(); // × closes it, which also stops its timer
  } finally {
    globalThis.document = keep.document; globalThis.CustomEvent = keep.CustomEvent;
    if (keep.document === undefined) delete globalThis.document;
    if (keep.CustomEvent === undefined) delete globalThis.CustomEvent;
  }
});
