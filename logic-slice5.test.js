// Tests for the Slice 5 logic (shell and reach). Spec: docs/design/SPEC.md §3.5 and §6.1. Run with: node --test
// chipText and studyResult are tested in keys.test.js, as §6.1 lists them there.
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('./logic.js');

// Why: the tip tells the judge when the speech ends; "ends at" on an over-time speech would say time is left when none is.
test('chipTip: ends at, or ended at when over time', () => {
  assert.equal(L.chipTip('10:42', false), 'Back to Flow · ends at 10:42');
  assert.equal(L.chipTip('10:42', true), 'Back to Flow · ended at 10:42');
});

// Why: a chip name that changes every second floods a screen reader during the round; one that never changes goes stale.
test('chipNameDue: at most every 15 s, and at once when the chip appears or changes kind', () => {
  assert.equal(L.CHIP_NAME_MS, 15000);
  assert.equal(L.chipNameDue(0, 1000, false), true, 'first time');
  assert.equal(L.chipNameDue(1000, 15999, false), false);
  assert.equal(L.chipNameDue(1000, 16000, false), true);
  assert.equal(L.chipNameDue(1000, 2000, true), true, 'appeared or changed from speech to prep');
});

// Why: the offline note must say "Offline" while there is no network and "Back online" only once it returns; a stuck
// note makes the judge think AI is broken, and no note leaves them guessing why AI waits.
test('netNote: Offline, Back online, then nothing; the tip says what still works', () => {
  assert.equal(L.netNote(false, true), 'Offline');
  assert.equal(L.netNote(false, false), 'Offline');
  assert.equal(L.netNote(true, false), 'Back online');
  assert.equal(L.netNote(true, true), '');
  assert.equal(L.NET_TIP, 'No internet. Clock, flow and ballot still work. AI waits until you are back online.');
});

// Why: on a phone the speech line is the only place that names the speech, its side and its speaker.
test('speechLine: "1NC · Neg · 1N · 8 min", and CX rows by their short name', () => {
  assert.equal(L.speechLine('1NC'), '1NC · Neg · 1N · 8 min');
  assert.equal(L.speechLine('2AR'), '2AR · Aff · 2A · 5 min');
  assert.equal(L.speechLine('CX-1A'), 'CX 1A · Aff · 1A · 3 min');
  assert.equal(L.speechLine('nope'), '');
});

// Why: colour never carries meaning alone (colour rule 5); the word under the clock is how a judge knows it runs or is over.
test('clockStatus: Running, Paused, Over time', () => {
  assert.equal(L.clockStatus(true, 100), 'Running');
  assert.equal(L.clockStatus(false, 100), 'Paused');
  assert.equal(L.clockStatus(true, 0), 'Over time');
  assert.equal(L.clockStatus(true, -12), 'Over time');
  assert.equal(L.clockStatus(false, -12), 'Over time');
  assert.equal(L.clockStatus(true, 0.4), 'Running', '0.4 s left shows 0:01, so it is not over yet');
});

// Why: starting prep pauses the running speech; the line warns the judge before they tap.
test('prepPausesLine: "Pauses the 1NC" while a speech runs, else nothing', () => {
  assert.equal(L.prepPausesLine('1NC'), 'Pauses the 1NC');
  assert.equal(L.prepPausesLine('CX-2N'), 'Pauses the CX 2N');
  assert.equal(L.prepPausesLine(''), '');
  assert.equal(L.prepPausesLine(null), '');
});

// Why: Previous at 1AC and Next at 2AR must say why they do nothing, or the phone judge taps again and again.
test('stepSpeechState: the reason at each end, else the index to go to', () => {
  assert.deepEqual(L.stepSpeechState(0, -1), { disabled: true, reason: 'Already at 1AC' });
  assert.deepEqual(L.stepSpeechState(11, 1), { disabled: true, reason: 'Already at 2AR' });
  assert.deepEqual(L.stepSpeechState(4, 1), { disabled: false, reason: '', to: 5 });
  assert.deepEqual(L.stepSpeechState(4, -1), { disabled: false, reason: '', to: 3 });
});

// Why: study mode must never turn on by itself (Part 6.3); a stray mark would show a timing card to real judges.
test('studyOn: only ?study=1', () => {
  assert.equal(L.studyOn('?study=1'), true);
  assert.equal(L.studyOn('?a=2&study=1'), true);
  assert.equal(L.studyOn(''), false);
  assert.equal(L.studyOn('?study=0'), false);
  assert.equal(L.studyOn('?study=true'), false);
  assert.equal(L.studyOn(undefined), false);
});

// Why: the time to start runs from the first view to the first 1AC Start; moving either mark later would change the result.
test('studyMark: the first view and the first 1AC Start are kept; later events do not move them', () => {
  let m = L.studyMark({}, { type: 'view', at: 1000 });
  assert.deepEqual(m, { firstView: 1000 });
  m = L.studyMark(m, { type: 'view', at: 5000 });
  assert.equal(m.firstView, 1000, 'a reload does not restart the timer');
  m = L.studyMark(m, { type: 'start', at: 9000, speechId: '1NC' });
  assert.equal(m.firstStart, undefined, 'only a 1AC Start counts');
  m = L.studyMark(m, { type: 'start', at: 48000, speechId: '1AC' });
  assert.equal(m.firstStart, 48000);
  m = L.studyMark(m, { type: 'start', at: 90000, speechId: '1AC' });
  assert.equal(m.firstStart, 48000, 'a second Start does not move it');
  assert.deepEqual(L.studyMark({}, { type: 'start', at: 5, speechId: '1AC' }), {}, 'no start mark without a view mark');
  assert.deepEqual(L.studyMark({ firstView: 1 }, null), { firstView: 1 });
});
