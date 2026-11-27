// Tests for step E6 (docs/events/LANDING.md §4.1): the comment sheet rules (events/js/comments.js) and the sheet
// builder (events/js/comment-view.js). Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadEventData } from './js/data.js';
import { createRoom, updateEntry } from './js/room.js';
import {
  CHECK_LABELS, checkLabel, flagLine, ballotComment, insertSentence, removeSentence, tapChip, toggleCheck, setNotes, setPrivateNote,
  applyInput,
} from './js/comments.js';
import { sourceText } from './js/cleanup.js';
import { sheetHtml, reasonFootHtml } from './js/comment-view.js';
import { createEventsStore as makeEventsStore, ROOMS_KEY } from './js/store.js';

import { heldWriter } from './fixtures/held-writer.mjs';
const createEventsStore = (ui, storage, opts = {}) => makeEventsStore(ui, storage, { ...opts, writer: heldWriter });

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const DATA = await loadEventData(async (p) => JSON.parse(read(p)));
const OO = DATA.events.get('oo');
const room1 = () => createRoom({ event: OO, profile: DATA.profiles.get('nsda-district'), entries: [{ code: 'A12' }, { code: 'B07' }], now: 1 });
const thesis = OO.tags.find((t) => t.id === 'thesis');

// Why: a rule-check flag is the judge's private memory (EVENTS.md §7); if it leaked into the ballot text a student
// would read an accusation ("Flag: No sign of AI-written text") the judge never chose to write (LANDING.md E6).
test('a flag goes in the private note and never reaches the ballot comment unless the judge writes it', () => {
  let e = room1().entries[0];
  e = setNotes(e, 'Strong opening.');
  for (const c of OO.checks) e = toggleCheck(e, c);
  assert.equal(ballotComment(e), 'Strong opening.');
  for (const c of OO.checks) assert.ok(!ballotComment(e).includes(checkLabel(c)), c);
  assert.equal(e.privateNote.split('\n').length, OO.checks.length);
  assert.ok(e.privateNote.includes(flagLine('noAiText')));
  e = toggleCheck(e, 'noAiText');
  assert.ok(!e.privateNote.includes(flagLine('noAiText')), 'Flag → OK takes the line back out');
  assert.equal(e.checks.noAiText, undefined);
  const withBlank = toggleCheck(setPrivateNote(room1().entries[0], 'line one\n\nline three'), 'memorized');
  assert.equal(toggleCheck(withBlank, 'memorized').privateNote, 'line one\n\nline three', 'a check tap leaves the judge\'s own lines, blank ones too');
  const typed = setNotes(e, 'I could not tell if this was memorized.');
  assert.equal(ballotComment(typed), 'I could not tell if this was memorized.', 'what the judge writes is what goes');
  assert.equal(ballotComment(Object.assign({}, typed, { comment: 'Edited on review.' })), 'Edited on review.', 'the Review edit wins');
  // CHANGED in the E6 review fix: one ballot-text rule for the app (cleanup.js sourceText). Old line:
  //   assert.equal(ballotComment(Object.assign({}, typed, { comment: '' })), '', 'an emptied Review comment stays empty');
  assert.equal(ballotComment(Object.assign({}, typed, { comment: '  ' })), typed.notes, 'a blank Review comment falls back to the notes');
  assert.equal(sourceText, ballotComment, 'the AI clean-up reads the same rule');
});

// Why: the comment sheet autosaves with no Save button (DESIGN.md §4.3); if a keystroke did not reach storage, a
// reload (or a phone that drops the tab) would lose the judge's notes (LANDING.md E6).
test('notes, the private note and the reason for rank survive a reload through the store', () => {
  const m = new Map();
  const box = { get length() { return m.size; }, key: (i) => [...m.keys()][i], getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  const ui = { toast() {}, dismissToast() {} };
  const s1 = createEventsStore(ui, box);
  let r = room1();
  const id = r.entries[0].id;
  r = updateEntry(r, id, (e) => setPrivateNote(setNotes(e, 'Clear thesis.'), 'blue jacket'), 2);
  r = Object.assign({}, r, { reasonForRank: 'A12 had the clearest structure.' });
  s1.set(ROOMS_KEY, [r]);
  const s2 = createEventsStore(ui, box); // a new page load
  const back = s2.get(ROOMS_KEY, [])[0];
  assert.equal(back.entries[0].notes, 'Clear thesis.');
  assert.equal(back.entries[0].privateNote, 'blue jacket');
  assert.equal(back.reasonForRank, 'A12 had the clearest structure.');
  // The keystroke path the sheet runs on every input event (comment-view.js onInput saves what applyInput returns).
  let typed = applyInput(r, 'notes', 'Clear thesis. Good pace.', 3);
  typed = applyInput(typed, 'private', 'blue jacket, 3rd', 4);
  typed = applyInput(typed, 'reason', 'Structure decided it.', 5);
  s1.set(ROOMS_KEY, [typed]);
  const again = createEventsStore(ui, box).get(ROOMS_KEY, [])[0];
  assert.deepEqual([again.entries[0].notes, again.entries[0].privateNote, again.reasonForRank], ['Clear thesis. Good pace.', 'blue jacket, 3rd', 'Structure decided it.']);
  assert.equal(again.entries[1].notes, '', 'only the current speaker\'s notes change');
  assert.equal(applyInput(typed, 'nope', 'x', 6), typed, 'an unknown field changes nothing');
});

// Why: a chip must add an editable sentence where the judge is typing, and a second tap must take back only a
// sentence the judge has not changed; deleting edited words would lose the judge's writing.
test('chips insert their sentence at the cursor and a second tap takes it back only when unchanged', () => {
  let e = setNotes(room1().entries[0], 'Good pace.');
  const on = tapChip(e, thesis, 'strength', 0);
  assert.equal(on.entry.notes, thesis.strength + ' Good pace.');
  assert.deepEqual(on.entry.tags, ['strength:thesis']);
  assert.equal(on.cursor, thesis.strength.length);
  const off = tapChip(on.entry, thesis, 'strength', 0);
  assert.equal(off.entry.notes, 'Good pace.');
  assert.deepEqual(off.entry.tags, []);
  const edited = setNotes(on.entry, 'Your main point was clear, mostly. Good pace.');
  assert.equal(tapChip(edited, thesis, 'strength', 0).entry.notes, 'Your main point was clear, mostly. Good pace.', 'edited text stays');
  const work = tapChip(setNotes(e, 'Good pace.'), thesis, 'toWork', 10);
  assert.equal(work.entry.notes, 'Good pace. ' + thesis.toWork);
  assert.deepEqual(insertSentence('', 'Hi.', 5), { text: 'Hi.', cursor: 3 });
  assert.equal(insertSentence('A.\n', 'B.', 3).text, 'A.\nB.', 'no extra space after a line break');
  assert.equal(removeSentence('x', ''), 'x');
});

// Why: the sheet must show only this event's chips and checks, in words, and label the private note as never on the
// ballot; a lay judge who thought the private note was shared might write less, or write the wrong thing in it.
test('the sheet shows the event\'s chips, checks with OK or Flag, the private note and the reason for rank', () => {
  let r = room1();
  const id = r.entries[0].id;
  r = updateEntry(r, id, (e) => toggleCheck(tapChip(e, thesis, 'strength').entry, 'quoteLimit'), 2);
  const html = sheetHtml(r, r.entries[0], OO);
  assert.match(html, />Strengths</); assert.match(html, />To work on</);
  assert.equal((html.match(/data-cact="chip"/g) || []).length, OO.tags.length * 2);
  // CHANGED 2026-11-24 because the owner approved EVENTS-COLOR-ICON-REVIEW.md (§5.1: a chip that is on gets a leading check). Old line:
  //   assert.match(html, /aria-pressed="true" title="[^"]*">Thesis</);
  assert.match(html, /aria-pressed="true" title="[^"]*"><svg class="i i-16" aria-hidden="true" focusable="false"><use href="#i-check"\/><\/svg>Thesis</);
  assert.equal((html.match(/data-cact="check"/g) || []).length, OO.checks.length);
  // CHANGED 2026-11-24 because the owner approved EVENTS-COLOR-ICON-REVIEW.md (top 10 #3: a flagged rule check says Flagged with a flag icon). Old line:
  //   assert.match(html, /Quoting looked within the limit<\/span><span class="pill err">Flag</);
  assert.match(html, /Quoting looked within the limit<\/span><span class="chk-state"><svg class="i i-14" aria-hidden="true" focusable="false"><use href="#i-flag"\/><\/svg>Flagged</);
  // CHANGED 2026-11-24 because the owner approved EVENTS-COLOR-ICON-REVIEW.md (top 10 #3: the nested OK pill goes; each row has a flag button). Old line:
  //   assert.match(html, /No visual aids<\/span><span class="pill outline">OK</);
  assert.match(html, /No visual aids<\/span><span class="chk-state"><svg class="i i-14" aria-hidden="true" focusable="false"><use href="#i-flag"\/><\/svg>Flag</);
  assert.match(html, /never on the ballot/);
  // CHANGED 2026-11-24 because the owner approved EVENTS-COLOR-ICON-REVIEW.md (D3-A: the reason for rank leaves the speaker sheet for one room-level field). Old line:
  //   assert.match(html, /Reason for rank/);
  assert.match(reasonFootHtml(r, true), /Reason for rank/);
  assert.equal(sheetHtml(r, Object.assign({}, r.entries[1], { status: 'noShow' }), OO), '', 'no sheet for a no-show');
  assert.ok(!sheetHtml(r, Object.assign({}, r.entries[1], { notes: '</textarea><b>x' }), OO).includes('</textarea><b>x'), 'notes are escaped');
  for (const ev of DATA.events.keys().map((k) => DATA.events.get(k.split('@')[0]))) for (const c of ev.checks) assert.ok(CHECK_LABELS[c], ev.id + ' check ' + c + ' has a label');
});
