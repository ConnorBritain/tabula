// The real ask() in ui.js, run on a small fake page, for the welcome layout (spec 2.1, docs/design/WELCOME-COPY.md §5).
// welcome-copy.test.mjs stubs ask(); this file checks that ui.js draws "one primary button above quiet rows" and that
// Esc and × give cancelValue. Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const L = require('./logic.js');
const UI_SRC = readFileSync(new URL('./ui.js', import.meta.url), 'utf8');
// ask() itself lives in core/ui.js createUI() since step C3; ui.js calls it. core/ui.js is an ES module with no imports,
// so dropping the "export" words lets it run as a plain script in the same fake page, as the page loads it before ui.js.
const CORE_UI_SRC = readFileSync(new URL('./core/ui.js', import.meta.url), 'utf8').replace(/^export /gm, '');

// A fake element: only what askOpen() and the load-time code in ui.js touch.
class El {
  constructor(doc, tag) {
    this.doc = doc; this.tagName = tag.toUpperCase(); this.children = []; this.attrs = {}; this.listeners = {};
    this.hidden = false; this.style = {}; this.text = ''; this.className = ''; this.value = ''; this.inert = false;
    const self = this;
    this.classList = {
      list: () => self.className.split(/\s+/).filter(Boolean),
      contains: (c) => self.classList.list().includes(c),
      add: (c) => { if (!self.classList.contains(c)) self.className = [...self.classList.list(), c].join(' '); },
      remove: (c) => { self.className = self.classList.list().filter((x) => x !== c).join(' '); },
      toggle: (c, on) => { const want = on === undefined ? !self.classList.contains(c) : Boolean(on); if (want) self.classList.add(c); else self.classList.remove(c); return want; },
    };
  }
  get textContent() { return this.text + this.children.map((c) => c.textContent).join(''); }
  set textContent(v) { this.text = String(v); this.children = []; }
  append(...nodes) { for (const n of nodes) this.children.push(n); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  removeAttribute(k) { delete this.attrs[k]; }
  addEventListener(t, fn) { (this.listeners[t] ||= []).push(fn); }
  removeEventListener(t, fn) { this.listeners[t] = (this.listeners[t] || []).filter((f) => f !== fn); }
  fire(t, ev = {}) { for (const fn of [...(this.listeners[t] || [])]) fn(Object.assign({ target: this, preventDefault() {}, stopImmediatePropagation() {} }, ev)); }
  click() { this.fire('click'); }
  focus() { this.doc.activeElement = this; }
  select() {}
  closest() { return null; }
  // Only 'button, input' is needed (the focus trap in askOpen()): every button or input under this element, in order.
  querySelectorAll(sel) {
    if (sel !== 'button, input') return [];
    const out = [];
    const walk = (el) => { for (const c of el.children) { if (c.tagName === 'BUTTON' || c.tagName === 'INPUT') out.push(c); walk(c); } };
    walk(this);
    return out;
  }
}

// Loads core/ui.js and ui.js on a fresh fake page and gives back TabulaUI, the page and a way to press a key on the document.
function loadUI() {
  const docListeners = {};
  const doc = {
    activeElement: null,
    byId: {},
    createElement(tag) { return new El(doc, tag); },
    querySelector(sel) { return sel.startsWith('#') ? doc.byId[sel.slice(1)] || null : null; },
    querySelectorAll() { return []; },
    getElementById(id) { return doc.byId[id] || null; },
    addEventListener(t, fn) { (docListeners[t] ||= []).push(fn); },
    dispatchEvent() { return true; },
    contains() { return true; },
    documentElement: {},
  };
  doc.body = new El(doc, 'body');
  for (const id of ['ask', 'ask-card', 'ask-x', 'ask-title', 'ask-body', 'ask-field', 'ask-input', 'ask-err', 'ask-label', 'ask-foot', 'ask-btns', 'sr-status']) {
    doc.byId[id] = new El(doc, id === 'ask-input' ? 'input' : id === 'ask-x' ? 'button' : 'div');
  }
  doc.byId.ask.hidden = true;
  const win = {
    PolicyLogic: L, document: doc, setTimeout, clearTimeout, performance,
    CustomEvent: class { constructor(type) { this.type = type; } },
    addEventListener() {}, getComputedStyle: () => ({ getPropertyValue: () => '' }),
    MutationObserver: class { observe() {} disconnect() {} },
    requestAnimationFrame: () => 0, // the tip descriptions sync later; nothing here needs them
  };
  win.window = win;
  vm.createContext(win);
  vm.runInContext(CORE_UI_SRC, win);
  vm.runInContext(UI_SRC, win);
  const key = (k) => { for (const fn of docListeners.keydown || []) fn({ key: k, isComposing: false, target: doc.body, preventDefault() {}, stopImmediatePropagation() {} }); };
  return { UI: win.TabulaUI, doc, key };
}
const tick = () => new Promise((r) => setImmediate(r));

// A choices dialog with a primary and two quiet rows (the revision-1 welcome shape). No live caller passes this shape
// since revision 2 (2026-11-21). The three tests below that use it now guard ask()'s shared choice-card support in
// core/ui.js (the .choice and .has-primary paths), not the welcome. They stay until the owner decides whether to keep
// that support or remove it with its CSS (index.html .choice rules); removing it would delete these assertions.
const WELCOME = {
  title: 'Welcome to Tabula Debate', body: 'Your clock, flow and ballot are ready.', variant: 'choices', cancelValue: 'start',
  buttons: [
    { label: 'Start judging', value: 'start', kind: 'primary' },
    { label: 'Add an automatic flow and a draft ballot', value: 'key', desc: 'Paste a key.' },
    { label: 'Use a subscription you have', value: 'sub', desc: 'Connects to an app.' },
  ],
};

// Why (choice-card support, not the live welcome): if ui.js stops drawing the primary as a real button in a choices
// dialog, any dialog that uses this shape turns its main action into one of several equal cards, the problem the
// owner asked to fix in revision 1.
test('ask() with choices and a primary draws one primary button above quiet .choice rows', async () => {
  const { UI, doc } = loadUI();
  const p = UI.ask(WELCOME); await tick();
  const row = doc.byId['ask-btns'];
  assert.ok(row.classList.contains('choices'), 'the row lost .choices');
  assert.ok(row.classList.contains('has-primary'), 'the row lost .has-primary, so the CSS for quiet rows does not apply');
  const [first, ...rest] = row.children;
  assert.equal(first.className, 'b primary');
  assert.equal(first.textContent, 'Start judging');
  assert.equal(first.children.length, 0, 'the primary button has a card body (strong/span)');
  for (const el of rest) {
    assert.equal(el.className, 'choice');
    assert.equal(el.children[0].tagName, 'STRONG');
  }
  assert.equal(doc.activeElement, first, 'focus does not start on "Start judging"');
  first.click();
  assert.equal(await p, 'start');
});

// Why (choice-card support, not the live welcome): a choices dialog with no primary must keep equal cards; if
// has-primary leaked onto it, its cards would pick up the quiet-row look and lose their weight.
test('ask() with choices and no primary keeps every button an equal card', async () => {
  const { UI, doc } = loadUI();
  const p = UI.ask({ variant: 'choices', buttons: [{ label: 'A', value: 'a', desc: 'x' }, { label: 'B', value: 'b', desc: 'y' }] }); await tick();
  const row = doc.byId['ask-btns'];
  assert.ok(!row.classList.contains('has-primary'));
  assert.deepEqual(row.children.map((el) => el.className), ['choice', 'choice']);
  row.children[1].click();
  assert.equal(await p, 'b');
});

// Why (choice-card support; the live welcome has its own Esc and × test below): × and Esc must give cancelValue in a
// choices dialog; if the wiring in ui.js broke, closing such a dialog would do nothing the caller expects.
test('Esc and × on the welcome resolve with cancelValue', async () => {
  for (const close of ['esc', 'x']) {
    const { UI, doc, key } = loadUI();
    const p = UI.ask(WELCOME); await tick();
    assert.equal(doc.byId.ask.hidden, false, 'the dialog did not open');
    if (close === 'esc') key('Escape'); else doc.byId['ask-x'].click();
    assert.equal(await p, 'start', `${close} did not give cancelValue`);
    assert.equal(doc.byId.ask.hidden, true, `${close} left the dialog open`);
  }
});

// The revision-2 welcome, in the shape js/help.js openWelcome() passes it (WELCOME-COPY.md §7).
const WELCOME_R2 = {
  title: 'Welcome to Tabula Debate', body: 'Your clock, flow and ballot are ready.', variant: 'choices', cancelValue: 'start',
  buttons: [
    { label: 'Start judging', value: 'start', kind: 'primary' },
    { label: 'Set it up', value: 'setup', kind: 'link', desc: 'Want help with your flow and ballot?' },
  ],
};

// Why: a keyboard or screen-reader judge must reach "Set it up" with Tab and use it with Enter; a link drawn as plain
// text or a div would lock them out of the only door to help, and focus must still start on "Start judging".
test('the welcome help line is one quiet line with a real, focusable "Set it up" button', async () => {
  const { UI, doc } = loadUI();
  const p = UI.ask(WELCOME_R2); await tick();
  const row = doc.byId['ask-btns'];
  const [first, line] = row.children;
  assert.equal(row.children.length, 2, 'more than a button and one line');
  assert.equal(first.className, 'b primary');
  assert.equal(line.tagName, 'P', 'the help line is not a plain line');
  assert.equal(line.className, 'ask-aside');
  assert.equal(line.textContent, 'Want help with your flow and ballot? Set it up');
  const link = line.children.find((c) => c.tagName === 'BUTTON');
  assert.ok(link, 'the link is not a <button>, so Tab and Enter do not reach it');
  assert.equal(link.type, 'button');
  assert.equal(link.className, 'linkish');
  assert.equal(link.textContent, 'Set it up');
  assert.equal(doc.activeElement, first, 'focus does not start on "Start judging"');
  // Tab from "Start judging" goes to the link (the dialog's own focus trap), and Shift+Tab goes back.
  const card = doc.byId['ask-card'];
  card.append(row);
  card.fire('keydown', { key: 'Tab', shiftKey: false });
  assert.equal(doc.activeElement, link, 'Tab does not reach "Set it up"');
  card.fire('keydown', { key: 'Tab', shiftKey: true });
  assert.equal(doc.activeElement, first);
  // A native <button type="button"> turns Enter into a click; the click gives 'setup'.
  link.click();
  assert.equal(await p, 'setup');
});

// Why: the live welcome promises that × and Esc do what "Start judging" does; if the wiring in ui.js broke for the
// revision-2 shape, closing the welcome would leave the judge with no Flow and the welcome back again on reload.
test('Esc and × on the revision-2 welcome resolve with "start"', async () => {
  for (const close of ['esc', 'x']) {
    const { UI, doc, key } = loadUI();
    const p = UI.ask(WELCOME_R2); await tick();
    assert.equal(doc.byId.ask.hidden, false, 'the dialog did not open');
    if (close === 'esc') key('Escape'); else doc.byId['ask-x'].click();
    assert.equal(await p, 'start', `${close} did not give "start"`);
    assert.equal(doc.byId.ask.hidden, true, `${close} left the dialog open`);
  }
});

// Why: a 'link' button used to draw as a quiet line only inside the choices variant and silently fell back to a plain
// button elsewhere; a later dialog that asks for a link would then show a heavy button with no desc and no error.
test('a link button draws as a quiet line in a dialog without the choices variant', async () => {
  const { UI, doc } = loadUI();
  const p = UI.ask({ title: 'T', buttons: [{ label: 'OK', value: 'ok', kind: 'primary' }, { label: 'Read more', value: 'more', kind: 'link', desc: 'Not sure?' }] });
  await tick();
  const row = doc.byId['ask-btns'];
  assert.ok(!row.classList.contains('choices'));
  const [first, line] = row.children;
  assert.equal(first.className, 'b primary');
  assert.equal(line.tagName, 'P');
  assert.equal(line.className, 'ask-aside');
  assert.equal(line.textContent, 'Not sure? Read more');
  const link = line.children.find((c) => c.tagName === 'BUTTON');
  assert.equal(link.className, 'linkish');
  link.click();
  assert.equal(await p, 'more');
});
