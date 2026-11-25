// Tests for the Congress fixes found by the device check (docs/events/DEVICE-CHECK.md, CONGRESS-REVIEW.md §6): the
// screen stays awake during a session, the PO hour prompt shows while the judge types a comment, the timer reads
// "0:00" at the limit, and the points chips are big enough to tap. No browser: small fakes stand in for the page.
// Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseRoom } from './js/parse.js';
import { congressProfile } from './congress/profiles.js';
import { createChamber, newSession } from './congress/chamber.js';
import { startSpeech, endSpeech, clockText } from './congress/speech.js';
import { timerHtml } from './congress/views.js';
import { startTerm, HOUR_MS } from './congress/po.js';
import { congressIO, withChamber, withSession } from './congress/store.js';
import { keepAwake } from './congress/wake.js';
import { mountSession } from './congress/session-screen.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const tickOnce = () => new Promise((r) => setImmediate(r));
const MIN = 60000;

// ---------- wake lock ----------

// A fake navigator.wakeLock and document: counts what was asked for and lets the test hide and show the tab.
function fakeWake({ refuse = false } = {}) {
  const locks = [];
  const nav = { wakeLock: { request: async (kind) => {
    if (refuse) throw new Error('NotAllowedError');
    const l = { kind, released: false, on: {}, addEventListener(t, f) { this.on[t] = f; }, async release() { this.released = true; if (this.on.release) this.on.release(); } };
    locks.push(l);
    return l;
  } } };
  const listeners = {};
  const doc = { visibilityState: 'visible', addEventListener(t, f) { listeners[t] = f; }, removeEventListener(t, f) { if (listeners[t] === f) delete listeners[t]; } };
  const setVisible = (v) => { doc.visibilityState = v ? 'visible' : 'hidden'; if (listeners.visibilitychange) listeners.visibilitychange(); };
  const held = () => locks.filter((l) => !l.released).length;
  return { nav, doc, locks, listeners, setVisible, held };
}

// Why: a Congress chamber runs up to three hours; if the phone or Chromebook dims and locks between speeches, the judge
// loses the timer and their place, and may miss a speech or a PO hour on the ballot.
test('a Congress session keeps the screen awake, lets go when the judge leaves, and asks again when the tab comes back', async () => {
  const w = fakeWake();
  const release = keepAwake({ nav: w.nav, doc: w.doc });
  await tickOnce();
  assert.equal(w.held(), 1, 'the screen is kept awake while the session is open');
  assert.equal(w.locks[0].kind, 'screen');

  w.setVisible(false);
  await tickOnce();
  assert.equal(w.held(), 0, 'a hidden tab lets the lock go');
  w.setVisible(true);
  await tickOnce();
  assert.equal(w.held(), 1, 'the lock is asked for again when the tab is shown');
  assert.equal(w.locks.length, 2);

  // The browser can drop the lock on its own (battery saver); showing the tab again asks again.
  await w.locks[1].release();
  w.setVisible(true);
  await tickOnce();
  assert.equal(w.held(), 1);

  await release();
  assert.equal(w.held(), 0, 'leaving the session lets the lock go');
  assert.equal(w.listeners.visibilitychange, undefined, 'and stops listening, so a later tab switch asks for nothing');
});

// Why: an older phone or a browser that says no must still run the chamber; a throw here would leave a blank screen
// in the middle of a session.
test('no wake lock, or a refused one, never throws', async () => {
  const refused = fakeWake({ refuse: true });
  const r1 = keepAwake({ nav: refused.nav, doc: refused.doc });
  await tickOnce();
  await assert.doesNotReject(r1());
  const r2 = keepAwake({ nav: {}, doc: { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} } });
  await assert.doesNotReject(r2());
  const r3 = keepAwake({ nav: undefined, doc: undefined });
  await assert.doesNotReject(r3());
});

// Why: a judge who taps Rank or leaves the chamber before the browser answers must not leave a lock behind that keeps
// the screen on and drains the battery for the rest of the day.
test('leaving before the browser answers lets the late lock go', async () => {
  const w = fakeWake();
  const release = keepAwake({ nav: w.nav, doc: w.doc });
  release();
  await tickOnce(); await tickOnce();
  assert.equal(w.held(), 0);
});

// Why: without this wiring the helper exists but the session screen never calls it, and the screen still sleeps.
test('the session screen asks for the wake lock on open and lets it go on leave', () => {
  const src = read('./congress/session-screen.js');
  assert.match(src, /const releaseWake = keepAwake\(\);/);
  assert.match(src, /return function unmount\(\) \{\n\s+releaseWake\(\);/);
});

// ---------- the PO hour prompt while the judge types ----------

// A fake page around mountSession: enough of the DOM for the Log stage, the comment box that keeps the focus, and the
// PO card the tick may redraw.
function rig(chamber, session, now0) {
  const data = {};
  const store = { get: (k, d) => (k in data ? data[k] : d), set: (k, v) => { data[k] = v; } };
  const io = congressIO(store);
  io.write(withSession(withChamber({ v: 1, chambers: [], sessions: [], prefs: {} }, chamber), session));
  let now = now0;
  const doc = { activeElement: null, visibilityState: 'visible', addEventListener() {}, removeEventListener() {} };
  const comment = { id: 'cg-comment', dataset: { cfield: 'comment', key: 'comment' }, value: '', focus() { doc.activeElement = comment; } };
  const title = { id: 'screen-title', dataset: {}, focus() { doc.activeElement = title; } };
  const po = { writes: [], set outerHTML(v) { this.writes.push(v); } };
  const listeners = {};
  const el = {
    fullDraws: 0,
    html: '',
    set innerHTML(v) { this.fullDraws++; this.html = v; },
    get innerHTML() { return this.html; },
    querySelector(sel) {
      if (sel === '.cg-po') return po;
      if (sel === '#screen-title') return title;
      if (sel === '#cg-comment' || sel === '[data-key="comment"]') return this.html.includes('id="cg-comment"') ? comment : null;
      return null;
    },
    contains: (x) => x === comment || x === title || Boolean(x && x.inside),
    addEventListener(t, f) { listeners[t] = f; },
    removeEventListener(t) { delete listeners[t]; },
  };
  let tick = null;
  const saved = { document: globalThis.document, window: globalThis.window, CSS: globalThis.CSS, setInterval: globalThis.setInterval, clearInterval: globalThis.clearInterval };
  globalThis.document = doc;
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  globalThis.CSS = { escape: (s) => s };
  globalThis.setInterval = (f) => { tick = f; return 1; };
  globalThis.clearInterval = () => {};
  const env = { store, now: () => now, ui: { toast() {}, announce() {} } };
  const unmount = mountSession(el, env, session.id, 'log');
  const restore = () => { unmount(); Object.assign(globalThis, saved); };
  const fire = (type, target) => listeners[type]({ target });
  return { el, doc, comment, po, io, tick: () => tick(), at: (t) => { now = t; }, fire, restore };
}

// Why: the session redraw for a new PO hour was skipped while the comment box had focus, so a judge typing a comment as
// the hour passed never saw "Score the PO's hour" until a later tap, and could hand in a ballot with a PO hour missing.
test('in screen order: typing a comment as a PO hour passes shows the prompt now, and keeps the typing and the focus', () => {
  let n = 0;
  const makeId = (p) => p + (++n);
  const DIST = congressProfile('nsda-district');
  const chamber0 = createChamber({ entries: parseRoom('1001\n1002\n1003\n1004').entries, docket: ['A Bill to Fund Rail'], house: 'house', profile: DIST, now: 0, makeId });
  const made = newSession(chamber0, [], { now: 0, makeId });
  const c = made.chamber;
  let s = startTerm(made.session, c.legislators[0].id, 0); // 1001 presides from minute 0
  s = startSpeech(s, c.legislators[1].id, { now: 50 * MIN, makeId }); // 1002 speaks at minute 50
  const speechId = s.live.speechId;
  s = endSpeech(s, 53 * MIN);

  // 1. Minute 55: the Log opens; the first tick only notes the hour count.
  const r = rig(c, s, 55 * MIN);
  try {
    r.tick();
    const drawsAtOpen = r.el.fullDraws;
    assert.doesNotMatch(r.el.html, /1st hour as PO/, 'no PO hour is due yet');

    // 2. The judge taps 1002's speech box: the comment box opens with the focus in it.
    r.fire('click', { closest: () => ({ dataset: { cact: 'select', id: speechId }, disabled: false, inside: true }) });
    assert.equal(r.doc.activeElement, r.comment, 'the focus is in the comment box');

    // 3. The judge types.
    r.comment.value = 'Strong refutation of the cost claim';
    r.fire('input', r.comment);
    const drawsWhileTyping = r.el.fullDraws;
    assert.ok(drawsWhileTyping > drawsAtOpen);

    // 4. The hour passes while the focus is still in the comment box.
    r.at(HOUR_MS + 5000);
    r.tick();
    assert.equal(r.po.writes.length, 1, 'the PO card is redrawn at once');
    assert.match(r.po.writes[0], /Score 1001’s 1st hour as PO/, 'the PO score prompt shows');
    assert.match(r.po.writes[0], /data-cact="po-score" data-term="0" data-hour="1"/, 'with its score buttons');
    assert.equal(r.el.fullDraws, drawsWhileTyping, 'the rest of the screen is not redrawn');
    assert.equal(r.doc.activeElement, r.comment, 'the focus stays in the comment box');
    assert.equal(r.comment.value, 'Strong refutation of the cost claim', 'the typing is kept');

    // 5. The next tick in the same hour draws nothing more.
    r.at(HOUR_MS + 6000);
    r.tick();
    assert.equal(r.po.writes.length, 1);

    // 6. The judge leaves the box: the comment is saved.
    r.fire('focusout', r.comment);
    const saved = r.io.read().sessions[0].speeches.find((x) => x.id === speechId);
    assert.equal(saved.comment, 'Strong refutation of the cost claim');
  } finally {
    r.restore();
  }
});

// ---------- timer sign ----------

// Why: "−0:00" at the limit reads as "over time" to a lay judge, who may then penalize a speaker who finished on time.
test('the speech timer reads 0:00 at the limit, and the minus starts only past it', () => {
  assert.equal(clockText(0), '0:00');
  assert.equal(clockText(-1), '0:00');
  assert.equal(clockText(-999), '0:00');
  assert.equal(clockText(-1000), '−0:01');
  assert.equal(clockText(-12000), '−0:12');
  assert.equal(clockText(-61000), '−1:01');
  assert.equal(clockText(500), '0:00');
  assert.equal(clockText(171000), '2:51');
  assert.equal(clockText(-0), '0:00');
});

// Why: a red "over" card with "0:00" on it tells a lay judge two different things in the same second, and they may
// mark a speaker over time who finished on time.
test('the timer card turns to over-time at the same moment the minus shows', () => {
  let n = 0;
  const makeId = (p) => p + (++n);
  const c = createChamber({ entries: parseRoom('1001\n1002').entries, docket: ['A Bill'], house: 'house', profile: congressProfile('nsda-district'), now: 0, makeId });
  const s = startSpeech(newSession(c, [], { now: 0, makeId }).session, c.legislators[0].id, { now: 0, makeId });
  const at = (ms) => timerHtml(s, ms, 30000);
  const limit = 3 * MIN;
  for (const past of [0, 1, 999]) {
    assert.doesNotMatch(at(limit + past), /stage-over/, past + ' ms past');
    assert.match(at(limit + past), />0:00</);
  }
  assert.match(at(limit + 1000), /stage-over/);
  assert.match(at(limit + 1000), />−0:01</);
});

// ---------- tap targets ----------

// Why: the points and PO score chips sat at 40 px; on a phone a judge tapping fast hit the next number and gave a
// speaker the wrong points.
test('points and PO score chips are at least 44 px, and no later rule makes them smaller', () => {
  const css = read('./congress/congress.css');
  const rules = [...css.matchAll(/([^{}]*\.cg-pt\b[^{}]*)\{([^}]*)\}/g)];
  assert.ok(rules.length >= 1, 'a .cg-pt rule exists');
  const px = (v) => { const m = /^([\d.]+)(px|rem)$/.exec(v.trim()); return m ? Number(m[1]) * (m[2] === 'rem' ? 16 : 1) : NaN; };
  let w = 0, h = 0;
  for (const [, , body] of rules) {
    const mw = /min-width:\s*([^;]+);/.exec(body), mh = /min-height:\s*([^;]+);/.exec(body);
    if (mw) w = px(mw[1]);
    if (mh) h = px(mh[1]);
    assert.doesNotMatch(body, /(?:^|[^-])(?:width|height):/, 'no fixed width or height on the chips');
  }
  assert.ok(w >= 44, 'min-width ' + w);
  assert.ok(h >= 44, 'min-height ' + h);
});
