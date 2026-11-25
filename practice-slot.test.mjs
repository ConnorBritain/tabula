// The practice slot send sheet in js/judging.js, run on a small fake page with a stub fetch. Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SRC = readFileSync(new URL('./js/judging.js', import.meta.url), 'utf8');
const ROUND = { id: 'round_a', at: 'fixture', format: 'policy',
  aff: [{ id: 'stu_ana', name: 'Ana Aff', getsBallot: true }, { id: 'stu_ben', name: 'Ben Aff', getsBallot: false }],
  neg: [{ id: 'stu_cy', name: 'Cy Neg', getsBallot: true }, { id: 'stu_di', name: 'Di Neg', getsBallot: true }] };
// Values made inside the page's realm, as plain values of this one (deepEqual compares prototypes).
const plain = (x) => JSON.parse(JSON.stringify(x ?? null));
const PROFILE = { displayName: 'J', programs: [{ id: 'prog_north', name: 'North High', role: 'judge' }] };

class El {
  constructor(doc, tag) { this.doc = doc; this.tagName = tag.toUpperCase(); this._html = ''; this.hidden = false; this.textContent = ''; }
  set id(v) { this._id = v; this.doc.ids[v] = this; }
  get id() { return this._id; }
  set innerHTML(v) { this._html = String(v); for (const m of this._html.matchAll(/\bid="([^"]+)"/g)) { const c = new El(this.doc, 'div'); c.id = m[1]; } }
  get innerHTML() { return this._html; }
  append(n) { this.child = n; }
  after(n) { this.next = n; }
  remove() { if (this.doc.ids[this._id] === this) delete this.doc.ids[this._id]; }
  focus() {}
}

// Loads judging.js with the switch as given, a signed-in profile (or none) and a fetch that answers from `replies`.
function load({ on = false, profile = PROFILE, programId = 'prog_north', replies = [], ballot } = {}) {
  const doc = { ids: {}, listeners: {}, addEventListener(t, fn) { (this.listeners[t] ||= []).push(fn); }, querySelectorAll: () => [],
    getElementById(id) { return this.ids[id] || null; }, createElement(tag) { return new El(this, tag); } };
  doc.body = new El(doc, 'body');
  const save = new El(doc, 'button'); save.id = 'b-save';
  const calls = [], dlg = { opened: 0, closed: 0 };
  const ctx = {
    document: doc, acctProfile: profile, console, AbortSignal,
    R: { programId, ballot: ballot || { winner: 'aff', rfd: 'Aff won the case debate.', affFb: 'Good case.', negFb: 'Slow down.', pts: {} } },
    L: { judgingFor: (v) => v, judgingLocked: () => false, judgingOptions: () => [] },
    store: { get: () => null, set() {} }, save() {}, refreshCaps() {},
    escapeHtml: (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])),
    modalDialog: () => ({ open() { dlg.opened++; }, close() { dlg.closed++; }, isOpen: () => dlg.opened > dlg.closed }),
    fetch: async (url, init) => { calls.push({ url, init, body: JSON.parse(init.body) }); const r = replies.shift() || { status: 500, body: null }; return { status: r.status, json: async () => r.body }; },
  };
  const src = (on ? SRC.replace('const PRACTICE_SLOT_ON = false;', 'const PRACTICE_SLOT_ON = true;') : SRC)
    + '\nglobalThis.T = { get slot() { return slot; }, renderPracticeSlot, openSlotSheet, slotOpenRound, slotSend, slotNotNow, slotToggleTheme, slotBallot, slotSheetHtml };';
  vm.runInNewContext(src, ctx);
  const card = () => doc.ids['slot-card'].innerHTML;
  return { T: ctx.T, doc, calls, dlg, card };
}

// Why: if the switch were on by default, every judge would see a send button and could post ballots before the server is open.
test('hidden by default: the switch is off, no button is drawn, the sheet does not open, nothing is called', () => {
  assert.match(SRC, /^const PRACTICE_SLOT_ON = false;$/m);
  assert.equal((SRC.match(/PRACTICE_SLOT_ON/g) || []).length, 2, 'one switch, read in one place');
  const { T, doc, calls, dlg } = load();
  T.renderPracticeSlot(); T.openSlotSheet();
  assert.equal(doc.getElementById('slot-btn'), null);
  assert.equal(doc.getElementById('slot-sheet'), null);
  assert.equal(dlg.opened, 0); assert.equal(calls.length, 0);
});

// Why: with the switch on, the button must still stay away from judges who are signed out or judging for no team.
test('shown only when the switch is on, the judge is signed in and judging for a team', () => {
  const on = load({ on: true }); on.T.renderPracticeSlot();
  assert.equal(on.doc.getElementById('b-save').next, on.doc.getElementById('slot-btn'), 'after Save to History');
  assert.equal(on.doc.getElementById('slot-btn').textContent, 'Practice slot');
  const noTeam = load({ on: true, programId: null }); noTeam.T.renderPracticeSlot();
  assert.equal(noTeam.doc.getElementById('slot-btn'), null);
  const out = load({ on: true, profile: null }); out.T.renderPracticeSlot();
  assert.equal(out.doc.getElementById('slot-btn'), null);
});

// Why: a wrong URL or body means the judge can never open the round, and the names are how they check it is the right one.
test('code entry calls open for the team and shows both teams by name', async () => {
  const { T, calls, card } = load({ on: true, replies: [{ status: 200, body: ROUND }] });
  T.openSlotSheet();
  assert.match(card(), /Judging for North High/);
  T.slot.code = 'KQXWMRTZ';
  await T.slotOpenRound();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/api/v1/practice/slots/open');
  assert.equal(calls[0].init.method, 'POST');
  assert.deepEqual(calls[0].body, { programId: 'prog_north', code: 'KQXWMRTZ' });
  for (const n of ['Ana Aff', 'Ben Aff', 'Cy Neg', 'Di Neg']) assert.match(card(), new RegExp(n));
  assert.match(card(), /Ben Aff<\/strong> <span class="muted">\(no practice ballot\)/);
  assert.match(card(), />Send to both teams</); assert.match(card(), />Not now</);
  assert.match(card(), /data-slot-code [^>]*readonly>/, 'the opened code is the one the ballot sends');
});

// Why: a short code must not burn one of the judge's limited tries on the server.
test('a code that is not 8 characters is not sent', async () => {
  const { T, calls, card } = load({ on: true });
  T.openSlotSheet(); T.slot.code = 'ABC'; await T.slotOpenRound();
  assert.equal(calls.length, 0); assert.match(card(), /8 characters/);
});

// Why: the judge's name must reach students only when the judge chose it; and only the ballot fields may leave the device.
test('name hidden unless toggled; the ballot body holds only the contract fields', async () => {
  const { T, calls, card } = load({ on: true, replies: [{ status: 200, body: ROUND }, { status: 200, body: { ok: true, sentTo: ['stu_ana', 'stu_cy', 'stu_di'], leftOut: ['stu_ben'] } }] });
  T.openSlotSheet(); T.slot.code = 'KQXWMRTZ'; await T.slotOpenRound();
  assert.match(card(), /<input type="checkbox" data-slot-name> Show my name/, 'unchecked at first');
  assert.equal(T.slotBallot().body.showName, false);
  T.slot.pts.stu_ana = '28.5';
  await T.slotSend();
  const sent = calls[1];
  assert.equal(sent.url, '/api/v1/practice/slots/round_a/ballot');
  assert.deepEqual(Object.keys(sent.body).sort(), ['code', 'comments', 'points', 'programId', 'rfd', 'showName', 'themes', 'winner']);
  assert.deepEqual(sent.body, { programId: 'prog_north', code: 'KQXWMRTZ', winner: 'aff', points: { stu_ana: 28.5 }, rfd: 'Aff won the case debate.', comments: { aff: 'Good case.', neg: 'Slow down.' }, themes: {}, showName: false });
  assert.match(card(), /Sent to: Ana Aff, Cy Neg, Di Neg\./);
  assert.match(card(), /Not sent to: Ben Aff\. They do not get practice ballots\./);
  const t = load({ on: true, replies: [{ status: 200, body: ROUND }] });
  t.T.openSlotSheet(); t.T.slot.code = 'KQXWMRTZ'; await t.T.slotOpenRound();
  t.T.slot.showName = true;
  assert.equal(t.T.slotBallot().body.showName, true);
});

// Why: the server refuses more than 4 themes; the sheet must stop at 4 so the judge never loses a ballot to bad_themes.
test('0 to 4 theme chips per student', async () => {
  const { T, card } = load({ on: true, replies: [{ status: 200, body: ROUND }] });
  T.openSlotSheet(); T.slot.code = 'KQXWMRTZ'; await T.slotOpenRound();
  assert.deepEqual(plain(T.slotBallot().body.themes), {}, '0 is allowed');
  for (const th of ['too_fast', 'time_use', 'cx_use', 'conduct', 'strong']) T.slotToggleTheme('stu_ana', th);
  assert.deepEqual(plain(T.slot.themes.stu_ana), ['too_fast', 'time_use', 'cx_use', 'conduct']);
  T.slotToggleTheme('stu_cy', 'not_a_theme');
  assert.deepEqual(plain(T.slot.themes.stu_cy || []), []);
  T.slotToggleTheme('stu_ana', 'time_use');
  assert.deepEqual(plain(T.slot.themes.stu_ana), ['too_fast', 'cx_use', 'conduct']);
  assert.deepEqual(plain(T.slotBallot().body.themes), { stu_ana: ['too_fast', 'cx_use', 'conduct'] });
  assert.match(T.slotSheetHtml(), /aria-pressed="true" data-slot-theme="too_fast" data-slot-for="stu_ana">Too fast</);
});

// Why: sending is per round and never automatic; "Not now" must close the sheet without posting a ballot.
test('"Not now" sends nothing', async () => {
  const { T, calls, dlg } = load({ on: true, replies: [{ status: 200, body: ROUND }] });
  T.openSlotSheet(); T.slot.code = 'KQXWMRTZ'; await T.slotOpenRound();
  T.slotNotNow();
  assert.equal(dlg.closed, 1);
  assert.equal(calls.length, 1, 'only the open call');
  assert.ok(!calls.some((c) => c.url.endsWith('/ballot')));
});

// Why: a judge who sees no reason after a refused code or a second send keeps retrying or thinks the ballot went out.
test('409, 404 and 429 show a clear message', async () => {
  const cases = [[404, 'no_such_round', /No round has that code/], [429, 'too_many_tries', /Too many tries/], [409, 'already_judged', /already has a ballot\. Nothing was sent/]];
  for (const [status, error, re] of cases) {
    const { T, card } = load({ on: true, replies: [{ status, body: { error } }] });
    T.openSlotSheet(); T.slot.code = 'KQXWMRTZ'; await T.slotOpenRound();
    assert.match(card(), re, String(status));
    assert.equal(T.slot.round, null);
  }
  const { T, card } = load({ on: true, replies: [{ status: 200, body: ROUND }, { status: 409, body: { error: 'already_judged' } }] });
  T.openSlotSheet(); T.slot.code = 'KQXWMRTZ'; await T.slotOpenRound(); await T.slotSend();
  assert.match(card(), /already has a ballot\. Nothing was sent/);
  assert.equal(T.slot.sent, null);
});

// Why: when the server has writes closed, the judge must get a short neutral line, not a raw error or server detail.
test('writes closed (403) shows a short neutral message', async () => {
  const { T, card } = load({ on: true, replies: [{ status: 200, body: ROUND }, { status: 403, body: { error: 'closed', detail: 'internal' } }] });
  T.openSlotSheet(); T.slot.code = 'KQXWMRTZ'; await T.slotOpenRound(); await T.slotSend();
  assert.match(card(), /Sending is not available right now\./);
  assert.doesNotMatch(card(), /internal/);
  assert.equal(T.slot.sent, null);
});
