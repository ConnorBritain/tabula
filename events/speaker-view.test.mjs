// Tests for the speaker view (events/js/speaker-view.js), its hook in the room timer (events/js/timer-view.js) and the
// shared screen wake lock (events/js/wake-lock.js). No browser: the DOM parts run on small stand-ins.
// Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { timerFace, signalPoints } from './js/timer.js';
import { sharedFace } from './js/prep.js';
import { speakerPhase, speakerModel, showSpeakerButton, speakerViewHtml, createSpeakerView } from './js/speaker-view.js';
import { createWakeLock } from './js/wake-lock.js';
import { createTimerView } from './js/timer-view.js';

const read = (f) => readFileSync(new URL(f, import.meta.url), 'utf8');
const noComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const L = 300, G = 30; // 5:00 limit, 0:30 grace
const T0 = 1_800_000_000_000;
const fresh = () => ({ run: null, runs: [], usedMs: 0, overLimit: false, overGrace: false });
// An entry whose clock runs with `left` seconds left at T0.
const running = (left) => ({ id: 'a', code: 'A12', status: 'speaking', timing: Object.assign(fresh(), { run: { kind: 'speech', endAt: T0 + left * 1000, startLeft: L } }) });
const modelAt = (left) => speakerModel(timerFace(running(left), L, G, T0), { points: signalPoints(L, G), grace: G, code: 'A12' });

// ---------- small stand-ins for the page ----------
class El {
  constructor(doc, tag) { this.doc = doc; this.tagName = String(tag || 'div').toUpperCase(); this.attrs = {}; this.listeners = {}; this.parts = new Map(); this.html = ''; this.text = ''; this.className = ''; this.removed = false; this.parent = null; this.writes = 0; this.inert = false; }
  set innerHTML(v) { this.html = String(v); this.writes++; }
  get innerHTML() { return this.html; }
  set textContent(v) { this.text = String(v); this.writes++; }
  get textContent() { return this.text; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  addEventListener(t, fn) { (this.listeners[t] ||= []).push(fn); }
  removeEventListener(t, fn) { this.listeners[t] = (this.listeners[t] || []).filter((f) => f !== fn); }
  fire(t, ev = {}) { const e = Object.assign({ target: this, defaultPrevented: false, preventDefault() { e.defaultPrevented = true; }, stopPropagation() {} }, ev); for (const fn of [...(this.listeners[t] || [])]) fn(e); return e; }
  // One stand-in child per selector, made on first ask (enough for the view's few fixed parts).
  querySelector(sel) { if (!this.parts.has(sel)) { const c = new El(this.doc, 'span'); const m = /^\[data-sv="(\w+)"\]$/.exec(sel); if (m) { c.tagName = 'BUTTON'; c.attrs['data-sv'] = m[1]; } this.parts.set(sel, c); } return this.parts.get(sel); }
  closest(sel) { if (sel === 'button' && this.tagName === 'BUTTON') return this; if (sel === '[data-sv]' && 'data-sv' in this.attrs) return this; return null; }
  appendChild(c) { c.parent = this; c.removed = false; this.doc.added.push(c); return c; }
  remove() { this.removed = true; }
  focus() { this.doc.activeElement = this; }
}
function fakeDoc({ full = true } = {}) {
  const doc = { created: 0, added: [], activeElement: null, listeners: {}, visibilityState: 'visible', fullscreenElement: null, fullscreenEnabled: full, exited: 0 };
  doc.createElement = (tag) => { doc.created++; const el = new El(doc, tag); if (full) el.requestFullscreen = () => { doc.fullscreenElement = el; return Promise.resolve(); }; return el; };
  doc.exitFullscreen = () => { doc.exited++; doc.fullscreenElement = null; return Promise.resolve(); };
  doc.addEventListener = (t, fn) => { (doc.listeners[t] ||= []).push(fn); };
  doc.removeEventListener = (t, fn) => { doc.listeners[t] = (doc.listeners[t] || []).filter((f) => f !== fn); };
  doc.fire = (t, ev = {}) => { const e = Object.assign({ target: doc.body, defaultPrevented: false, stopped: false, preventDefault() { e.defaultPrevented = true; }, stopPropagation() { e.stopped = true; } }, ev); for (const fn of [...(doc.listeners[t] || [])]) fn(e); return e; };
  doc.body = new El(doc, 'body');
  doc.main = new El(doc, 'main'); // the page behind (header, main)
  doc.querySelectorAll = () => [doc.main];
  return doc;
}
function fakeNav() {
  const nav = { asked: 0, released: 0, wakeLock: null };
  nav.wakeLock = { request: async () => { nav.asked++; const s = { listeners: [], addEventListener(t, fn) { s.listeners.push(fn); }, release: async () => { nav.released++; for (const fn of s.listeners) fn(); } }; return s; } };
  return nav;
}
const flush = () => new Promise((r) => setTimeout(r, 0));

// ---------- the view model ----------

// Why: the speaker reads the digits from across the room; a wrong time or sign tells them to stop early or run long.
test('the digits count down, then up after the limit, from the same face the card shows', () => {
  assert.equal(modelAt(272).digits, '4:32');
  assert.equal(modelAt(272).sub, 'left');
  assert.equal(modelAt(-12).digits, '+0:12');
  assert.equal(modelAt(-12).sub, 'over the limit');
  const card = timerFace(running(272), L, G, T0);
  assert.equal(modelAt(272).digits, card.digits, 'the speaker sees what the judge sees');
});

// Why: colour alone fails a colour-blind speaker and a washed-out projector; each phase must also say itself in words.
test('each phase has words and a pill tone: time left, the last signal passed, grace, over time', () => {
  const words = (left) => modelAt(left).phase.word;
  assert.equal(words(290), 'Time left');
  assert.equal(words(170), '3:00 left');
  assert.equal(words(45), '1:00 left');
  assert.equal(words(20), '0:30 left');
  assert.equal(words(0), 'Time');
  assert.equal(words(-5), 'Grace');
  assert.equal(words(-31), 'Over time');
  assert.equal(modelAt(170).phase.tone, 'live');
  assert.equal(modelAt(45).phase.tone, 'caution');
  assert.equal(modelAt(-5).phase.tone, 'caution');
  assert.equal(modelAt(-31).phase.tone, 'err');
  for (const left of [290, 45, -5, -31]) assert.notEqual(modelAt(left).phase.tone, 'ok', 'green is for finished work only (status pill rules)');
});

// Why: the live region must speak when the phase changes, not every second, or a screen-reader user hears nothing else.
test('the phase key only changes at a phase or signal boundary', () => {
  assert.equal(modelAt(170).phase.key, modelAt(125).phase.key, '2:50 and 2:05 are the same phase');
  assert.notEqual(modelAt(125).phase.key, modelAt(119).phase.key, 'passing the 2:00 signal is a new phase');
});

// Why: before the start, after a stop and during prep the speaker must not see a running phase.
test('ready, stopped and prep read as such, with the right button word', () => {
  const ready = speakerModel(timerFace({ id: 'a', status: 'waiting', timing: fresh() }, L, G, T0), { points: signalPoints(L, G), grace: G });
  assert.equal(ready.phase.word, 'Ready');
  assert.equal(ready.button.label, 'Start');
  assert.equal(ready.digits, '5:00');
  const stopped = speakerModel(timerFace({ id: 'a', status: 'done', timing: Object.assign(fresh(), { usedMs: 200_000 }) }, L, G, T0), { points: signalPoints(L, G), grace: G });
  assert.equal(stopped.phase.word, 'Stopped');
  assert.equal(stopped.digits, '3:20', 'after a stop the digits are the time used, as on the card');
  assert.equal(stopped.button.label, 'Resume');
  assert.equal(modelAt(100).button.label, 'Stop');
  const prep = speakerModel(sharedFace({ id: 'a', status: 'speaking', timing: Object.assign(fresh(), { prepRun: { kind: 'prep', endAt: T0 + 400_000 } }) }, 420, G, T0), { grace: G });
  assert.equal(prep.phase.word, 'Prep');
});

// Why: the pill must come from the one pill builder, so the speaker view follows the same tint and icon rules.
test('the view draws its pill through status-pill.js and has the dialog parts a screen reader needs', () => {
  const html = speakerViewHtml(modelAt(45), '');
  assert.match(html, /class="pill caution"/);
  assert.match(html, /role="timer"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /Back to judge view/);
  assert.doesNotMatch(noComments(read('./js/speaker-view.js')), /class="pill/, 'no hand-made pill');
  assert.match(read('./js/speaker-view.js'), /from '\.\/status-pill\.js'/);
});

// ---------- off by default ----------

// Why: a judge who never asks for it must see the room exactly as before; a view that opens itself would show the speaker the clock against the judge's choice.
test('the room timer draws no speaker view until the judge asks, and the button shows only while a speaker is up', () => {
  const doc = fakeDoc();
  const prev = globalThis.document;
  globalThis.document = doc;
  try {
    const t = rig();
    const html = t.view.stageHtml(t.room(), t.room().entries[0]);
    assert.match(html, /data-sv="open"/, 'the button is on the card');
    assert.doesNotMatch(html, /speaker-view|sv-digits/, 'the view itself is not drawn');
    t.view.mounted();
    assert.equal(doc.created, 0, 'nothing is added to the page');
    assert.equal(doc.added.length, 0);
    assert.equal(showSpeakerButton({ status: 'noShow' }, { stage: 'ready' }), false);
    assert.equal(showSpeakerButton({ status: 'done' }, { stage: 'stopped', running: false }), false);
    assert.equal(showSpeakerButton({ status: 'speaking' }, { stage: 'speaking', running: true }), true);
    // Asked: the button's click opens it.
    t.el.querySelector('[data-sv="open"]').fire('click');
    assert.equal(doc.added.length, 1);
    assert.match(doc.added[0].className, /speaker-view/);
    t.view.hide();
  } finally { globalThis.document = prev; }
});

// ---------- one clock ----------

// A timer view on stand-ins: one room with two entries on a custom 5:00 event, a clock you move by hand.
function rig() {
  let now = T0;
  let room = { id: 'r1', eventId: 'x', customEvent: { name: 'Test', timing: { limit: L } }, current: 'a', entries: [
    { id: 'a', code: 'A12', status: 'waiting', order: 1, timing: fresh() },
    { id: 'b', code: 'B07', status: 'waiting', order: 2, timing: fresh() }] };
  const el = new El(fakeDoc(), 'main');
  el.querySelector = ((orig) => (sel) => (sel === '[data-sv="open"]' ? orig.call(el, sel) : null))(el.querySelector);
  const layers = [];
  const env = { el, now: () => now, data: { events: null }, ui: { announce() {}, toast() {}, ask: async () => null, escLayer: (...a) => layers.push(a) } };
  const ctx = { env, room: () => room, save: (r) => { room = r; return r; }, draw() {}, drawStage() {}, drawRoster() {}, primary: () => 'timer' };
  const view = createTimerView();
  view.show(ctx);
  return { view, el, room: () => room, tick: (ms) => { now += ms; }, layers };
}

// Why: two clocks for one speech drift apart; the speaker and the judge would see different times and the ballot would record the judge's.
test('the speaker view uses the room timer\'s one driver: no second interval, the same saved run', () => {
  const doc = fakeDoc();
  const prevDoc = globalThis.document, prevSet = globalThis.setInterval, prevClear = globalThis.clearInterval;
  const live = new Set();
  let made = 0;
  globalThis.document = doc;
  globalThis.setInterval = () => { made++; const id = made; live.add(id); return id; };
  globalThis.clearInterval = (id) => { live.delete(id); };
  try {
    const t = rig();
    t.view.mounted();
    t.el.querySelector('[data-sv="open"]').fire('click');
    const sv = doc.added[0];
    assert.equal(live.size, 0, 'opening the view starts no clock');
    sv.fire('click', { target: sv.querySelector('[data-sv="main"]') }); // Start, from the speaker view
    assert.equal(live.size, 1, 'one interval: the room driver');
    assert.ok(t.room().entries[0].timing.run, 'the run is saved on the entry, as a start from the card saves it');
    t.tick(65_000);
    t.view.run('startStop'); // Stop, from the room's own shortcut
    assert.equal(live.size, 0, 'the same driver stopped');
    assert.equal(t.room().entries[0].timing.usedMs, 65_000);
    assert.equal(made, 1, 'only one interval was ever made');
    assert.doesNotMatch(noComments(read('./js/speaker-view.js')), /setInterval|setTimeout|requestAnimationFrame|createDriver/, 'the view has no clock of its own');
    t.view.hide();
  } finally { globalThis.document = prevDoc; globalThis.setInterval = prevSet; globalThis.clearInterval = prevClear; }
});

// Why: if the open view stops following the room tick, the speaker sees frozen digits while the judge's clock runs on.
test('the open speaker view follows the room timer\'s tick', () => {
  const doc = fakeDoc();
  const prevDoc = globalThis.document, prevSet = globalThis.setInterval, prevClear = globalThis.clearInterval;
  let tickFn = null;
  const prevCss = globalThis.CSS;
  globalThis.CSS = { escape: (x) => String(x) }; // the tick looks up the roster row by id
  globalThis.document = doc;
  globalThis.setInterval = (fn) => { tickFn = fn; return 1; };
  globalThis.clearInterval = () => {};
  try {
    const t = rig();
    t.view.mounted();
    t.el.querySelector('[data-sv="open"]').fire('click');
    const sv = doc.added[0];
    sv.fire('click', { target: sv.querySelector('[data-sv="main"]') }); // Start
    assert.equal(typeof tickFn, 'function', 'the room driver ticks');
    t.tick(65_000);
    tickFn();
    assert.equal(sv.querySelector('#sv-digits').textContent, '3:55', '5:00 limit, 1:05 used');
    t.tick(10_000);
    tickFn();
    assert.equal(sv.querySelector('#sv-digits').textContent, '3:45');
    t.view.hide();
  } finally { globalThis.CSS = prevCss; globalThis.document = prevDoc; globalThis.setInterval = prevSet; globalThis.clearInterval = prevClear; }
});

// ---------- Esc, Space, fullscreen, focus ----------

// Why: a judge who cannot get back to the ballot mid-round (or who shows the speaker the notes) is stuck in front of the room; Esc and the Back button must always return.
test('Esc, Back and leaving full screen return to the judge view and give the focus back', async () => {
  for (const how of ['esc', 'back', 'layer', 'fullscreen']) {
    const doc = fakeDoc();
    const nav = fakeNav();
    let closed = 0, mains = 0;
    const layers = [];
    const sv = createSpeakerView({ doc, nav, onMain: () => { mains++; }, onClose: () => { closed++; }, escLayer: (...a) => layers.push(a) });
    assert.equal(sv.isOpen(), false);
    sv.open(modelAt(200), '');
    const root = doc.added[0];
    assert.equal(sv.isOpen(), true);
    assert.equal(doc.activeElement, root.querySelector('[data-sv="main"]'), 'the focus moves in, to the big button');
    assert.equal(doc.fullscreenElement, root, 'full screen where the browser has it');
    await flush();
    assert.equal(nav.asked, 1, 'the screen stays awake');
    assert.equal(doc.main.inert, true, 'the page behind is inert while the view is open');
    if (how === 'esc') doc.fire('keydown', { key: 'Escape', target: root });
    if (how === 'back') root.fire('click', { target: root.querySelector('[data-sv="back"]') });
    if (how === 'layer') { assert.equal(layers[0][2](), true); layers[0][3](); } // the page's Esc stack
    if (how === 'fullscreen') { doc.fullscreenElement = null; doc.fire('fullscreenchange'); }
    assert.equal(sv.isOpen(), false, how);
    assert.equal(root.removed, true, how);
    assert.equal(closed, 1, how + ': onClose puts the focus back on the card');
    assert.equal(doc.fullscreenElement, null, how);
    await flush();
    assert.equal(nav.released, 1, how + ': the wake lock is let go');
    assert.equal(doc.main.inert, false, how + ': the page behind is back');
    assert.equal((doc.listeners.keydown || []).length, 0, how + ': no key listener left behind');
    assert.equal(mains, 0);
  }
});

// Why: a judge starts and stops with Space; Space on Back must still mean Back, not start the clock behind it.
test('Space starts or stops, except on a button, where it presses that button', () => {
  const doc = fakeDoc();
  let mains = 0;
  const sv = createSpeakerView({ doc, nav: {}, onMain: () => { mains++; } });
  sv.open(modelAt(200), '');
  const root = doc.added[0];
  assert.equal(root.getAttribute('tabindex'), '-1', 'a tap inside keeps the focus in the view');
  const ev = doc.fire('keydown', { key: ' ', target: root });
  assert.equal(mains, 1);
  assert.equal(ev.defaultPrevented, true);
  doc.fire('keydown', { key: ' ', target: root.querySelector('[data-sv="back"]') });
  assert.equal(mains, 1, 'native Space on a button');
  doc.fire('keydown', { key: 'Tab', target: root });
  doc.fire('keydown', { key: 'Tab', target: root });
  assert.equal(doc.activeElement, root.querySelector('[data-sv="main"]'), 'Tab stays inside the view');
  sv.close();
});

// Why: a number key that reaches the room behind picks another speaker, and the big Start then times the wrong one.
test('keys pressed with the focus on the page body stay in the view', () => {
  const doc = fakeDoc();
  let mains = 0;
  const sv = createSpeakerView({ doc, nav: {}, onMain: () => { mains++; } });
  sv.open(modelAt(200), '');
  const one = doc.fire('keydown', { key: '1', target: doc.body });
  assert.equal(one.stopped, true, 'a number key does not reach the room shortcuts');
  const k = doc.fire('keydown', { key: 'k', ctrlKey: true, target: doc.body });
  assert.equal(k.stopped, true, 'nor the palette');
  doc.fire('keydown', { key: ' ', target: doc.body });
  assert.equal(mains, 1, 'Space on the body is Start / Stop');
  doc.fire('keydown', { key: 'Tab', target: doc.body });
  assert.equal(doc.activeElement, doc.added[0].querySelector('[data-sv="back"]'), 'Tab from the body comes back into the view');
  sv.close();
  const after = doc.fire('keydown', { key: '1', target: doc.body });
  assert.equal(after.stopped, false, 'closed: the room shortcuts work again');
});

// Why: if the current speaker changes, a title with the old code tells the room the wrong name.
test('the title follows the current entry', () => {
  const doc = fakeDoc();
  const sv = createSpeakerView({ doc, nav: {} });
  sv.open(modelAt(200), '');
  const next = Object.assign({}, modelAt(200), { code: 'B07' });
  sv.update(next);
  assert.match(doc.added[0].querySelector('#sv-title').innerHTML, /B07/);
  sv.close();
});

// Why: an iPhone has no element full screen; the view must still open and cover the page, not fail.
test('without the Fullscreen API the view still opens as an overlay', () => {
  const doc = fakeDoc({ full: false });
  const sv = createSpeakerView({ doc, nav: {} });
  sv.open(modelAt(200), '');
  assert.equal(sv.isOpen(), true);
  assert.equal(doc.fullscreenElement, null);
  sv.close();
  assert.equal(doc.exited, 0);
});

// Why: a screen reader that hears "4:31, 4:30, 4:29" each second cannot hear the judge or anything else.
test('the live region is written only when the phase changes', () => {
  const doc = fakeDoc();
  const sv = createSpeakerView({ doc, nav: {} });
  sv.open(modelAt(200), '');
  const live = doc.added[0].querySelector('#sv-live');
  const digits = doc.added[0].querySelector('#sv-digits');
  sv.update(modelAt(199)); sv.update(modelAt(198)); sv.update(modelAt(190));
  assert.equal(live.writes, 0, 'same phase: silent');
  assert.equal(digits.textContent, '3:10');
  sv.update(modelAt(175)); // past the 3:00 signal
  assert.equal(live.textContent, '3:00 left');
  assert.equal(live.writes, 1);
  sv.close();
});

// ---------- the wake lock helper ----------

// Why: a phone that dims mid-speech hides the clock from the judge and the speaker.
test('the wake lock asks, re-asks when the tab comes back, and lets go on release', async () => {
  const doc = fakeDoc();
  const nav = fakeNav();
  const w = createWakeLock({ nav, doc });
  await w.request();
  assert.equal(nav.asked, 1);
  assert.equal(w.held(), true);
  doc.visibilityState = 'hidden'; doc.fire('visibilitychange'); await flush();
  assert.equal(w.held(), false, 'hidden tab: let go (the browser drops it anyway)');
  doc.visibilityState = 'visible'; doc.fire('visibilitychange'); await flush();
  assert.equal(nav.asked, 2, 'back in view: asked again');
  await w.release();
  assert.equal(w.held(), false);
  doc.fire('visibilitychange'); await flush();
  assert.equal(nav.asked, 2, 'released: no more asking');
});

// Why: a browser with no wake lock, or one that says no, must never break the timer.
test('the wake lock never throws: no API, a refusal, no document', async () => {
  await createWakeLock({ nav: {}, doc: fakeDoc() }).request();
  const w = createWakeLock({ nav: { wakeLock: { request: async () => { throw new Error('NotAllowedError'); } } }, doc: fakeDoc() });
  await w.request();
  assert.equal(w.held(), false);
  await createWakeLock({ nav: fakeNav(), doc: undefined }).request();
  await w.release(); await w.dispose();
});

// Why: two copies of the wake lock code drift; the room timer must use the shared helper.
test('the room timer uses the shared wake lock helper, not its own copy', () => {
  const src = noComments(read('./js/timer-view.js'));
  assert.match(src, /from '\.\/wake-lock\.js'/);
  assert.doesNotMatch(src, /navigator\.wakeLock/);
});
