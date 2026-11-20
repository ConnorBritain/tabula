// Run with: node --test
// Slice 1 (round safety) pure functions. Spec: docs/design/SPEC.md §3.1 and §6.1.
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('./logic.js');

const NOW = 1_700_000_000_000;

// Why: a judge who reloads mid-speech must get the same clock back, or the debaters lose (or gain) speech time.
test('restoreRun: 3:00 left and a reload 20 s later gives 160 s, still running', () => {
  const run = { id: '2AC', endAt: NOW + 180_000 };
  const r = L.restoreRun(run, NOW + 20_000);
  assert.equal(r.state, 'running');
  assert.equal(r.id, '2AC');
  assert.equal(r.left, 160);
  assert.equal(r.endAt, run.endAt);
});

// Why: a speech that went past 0:00 while the tab was closed must show the real overtime, not reset to 0:00.
test('restoreRun: an endAt 2 min in the past gives -120 s, still running', () => {
  const r = L.restoreRun({ id: '1NC', endAt: NOW - 120_000 }, NOW);
  assert.equal(r.state, 'running');
  assert.equal(r.left, -120);
});

// Why: a clock left for hours must not show -3:00:00; it stops at -9:59, the same limit as on screen.
test('restoreRun: 15 min in the past gives paused at -599 (over-limit)', () => {
  const r = L.restoreRun({ id: '1NC', endAt: NOW - 15 * 60_000 }, NOW);
  assert.deepEqual(r, { state: 'paused', id: '1NC', left: -599, reason: 'over-limit' });
});

// Why: a device clock moved back would otherwise give a speech more time than it has (12 min on an 8 min speech).
test('restoreRun: an endAt with 12 min left on an 8 min speech gives 480 s, reason clock-moved, endAt reset', () => {
  const r = L.restoreRun({ id: '2AC', endAt: NOW + 12 * 60_000 }, NOW);
  assert.equal(r.state, 'running');
  assert.equal(r.left, 480);
  assert.equal(r.reason, 'clock-moved');
  assert.equal(r.endAt, NOW + 480_000);
});

// Why: a broken or old saved round must load as "no clock running", never crash the page or start a ghost clock.
test('restoreRun: null, a broken run, or an id that is not a speech gives none', () => {
  assert.deepEqual(L.restoreRun(null, NOW), { state: 'none' });
  assert.deepEqual(L.restoreRun(undefined, NOW), { state: 'none' });
  assert.deepEqual(L.restoreRun({ id: '2AC' }, NOW), { state: 'none' });
  assert.deepEqual(L.restoreRun({ id: '2AC', endAt: 'soon' }, NOW), { state: 'none' });
  assert.deepEqual(L.restoreRun({ id: '2AC', endAt: NaN }, NOW), { state: 'none' });
  assert.deepEqual(L.restoreRun({ id: '9AC', endAt: NOW + 1000 }, NOW), { state: 'none' });
});

// Why: the CX clock is 3 min; the clock-moved clamp must use the right speech length, not a fixed 8 min.
test('restoreRun: a CX speech clamps to 180 s', () => {
  const r = L.restoreRun({ id: 'CX-1A', endAt: NOW + 5 * 60_000 }, NOW);
  assert.equal(r.left, 180);
  assert.equal(r.reason, 'clock-moved');
});

// Why: prep time is real time a team is owed; a reload must not refill it or lose it.
test('restorePrep: running prep comes back with its time; ran-out prep comes back at 0', () => {
  assert.deepEqual(L.restorePrep({ side: 'aff', endAt: NOW + 90_000 }, NOW, 480), { state: 'running', side: 'aff', left: 90, endAt: NOW + 90_000 });
  assert.deepEqual(L.restorePrep({ side: 'neg', endAt: NOW - 1000 }, NOW, 480), { state: 'paused', side: 'neg', left: 0, reason: 'ran-out' });
});

// Why: a moved device clock or a damaged file must never give a team more prep than the round allows.
test('restorePrep: more than the round prep is clamped; a broken prep run gives none', () => {
  const r = L.restorePrep({ side: 'aff', endAt: NOW + 20 * 60_000 }, NOW, 480);
  assert.equal(r.left, 480);
  assert.equal(r.reason, 'clock-moved');
  assert.deepEqual(L.restorePrep({ side: 'both', endAt: NOW }, NOW, 480), { state: 'none' });
  assert.deepEqual(L.restorePrep(null, NOW, 480), { state: 'none' });
});

// Why: two clocks running at once would charge a team prep during a speech; prep wins and the speech pauses.
test('restoreClocks: both running gives prep running and the speech paused at its time', () => {
  const out = L.restoreClocks({ id: '2AC', endAt: NOW + 100_000 }, { side: 'neg', endAt: NOW + 60_000 }, NOW, 480);
  assert.equal(out.prep.state, 'running');
  assert.equal(out.speech.state, 'paused');
  assert.equal(out.speech.left, 100);
  assert.equal(out.speech.id, '2AC');
});

// Why: a late beep 40 s after 0:00 (after sleep or a reload) startles the room and tells the judge nothing.
test('beepDecision: beep at 0:00, skip when more than 5 s late, nothing when done or not yet at 0:00', () => {
  assert.equal(L.beepDecision(0, false), 'beep');
  assert.equal(L.beepDecision(-4.9, false), 'beep');
  assert.equal(L.beepDecision(-5, false), 'skip');
  assert.equal(L.beepDecision(-60, false), 'skip');
  assert.equal(L.beepDecision(-1, true), null);
  assert.equal(L.beepDecision(3, false), null);
});

// Why: "full" and "blocked" need different advice; the wrong one sends the judge to fix the wrong thing.
test('storageErrorKind: QuotaExceededError is full; SecurityError is blocked', () => {
  assert.equal(L.storageErrorKind({ name: 'QuotaExceededError' }), 'full');
  assert.equal(L.storageErrorKind({ name: 'NS_ERROR_DOM_QUOTA_REACHED' }), 'full');
  assert.equal(L.storageErrorKind({ name: 'SecurityError' }), 'blocked');
  assert.equal(L.storageErrorKind(undefined), 'blocked');
});

// Why: with two tabs open, the older clock must never overwrite a newer Start, or one tab shows a wrong clock.
test('clockUnitIsNewer: only a newer savedAt wins', () => {
  assert.equal(L.clockUnitIsNewer({ savedAt: 10 }, { savedAt: 11 }), true);
  assert.equal(L.clockUnitIsNewer({ savedAt: 11 }, { savedAt: 11 }), false);
  assert.equal(L.clockUnitIsNewer({ savedAt: 12 }, { savedAt: 11 }), false);
  assert.equal(L.clockUnitIsNewer({}, { savedAt: 1 }), true);
  assert.equal(L.clockUnitIsNewer({ savedAt: 1 }, null), false);
});

// Why: while looking back at an earlier speech, the judge must always see which speech the clock is timing.
test('viewingLabel: the 4 cases (other speech, same speech, nothing running, CX viewed)', () => {
  assert.deepEqual(L.viewingLabel('1NC', '2AC'), { text: 'Viewing 1NC · 2AC running', back: 'Back to 2AC', sr: 'Viewing 1NC. 2AC is still running.' });
  assert.equal(L.viewingLabel('2AC', '2AC'), null);
  assert.equal(L.viewingLabel('1NC', null), null);
  assert.equal(L.viewingLabel('CX-1A', '2AC').text, 'Viewing CX 1A · 2AC running');
});

// Why: a toast that vanishes before it is read (or an error that times out) means the judge misses a problem.
test('toastMs: 20 chars 4000, 100 chars 7000, 400 chars 10000, error 0, with an action 10000', () => {
  assert.equal(L.toastMs('x'.repeat(20), 'info', false), 4000);
  assert.equal(L.toastMs('x'.repeat(100), 'info', false), 7000);
  assert.equal(L.toastMs('x'.repeat(400), 'info', false), 10000);
  assert.equal(L.toastMs('x'.repeat(20), 'error', false), 0);
  assert.equal(L.toastMs('x'.repeat(20), 'info', true), 10000);
});

// Why: below 1440 px an inline speeches pane squeezes the 7 flow columns until the grid scrolls sideways.
test('leftPaneMode: overlay from 820 to 1439, inline or hidden at 1440+, stacked under 820', () => {
  assert.equal(L.leftPaneMode(1366, false), 'overlay-closed');
  assert.equal(L.leftPaneMode(1180, false), 'overlay-closed');
  assert.equal(L.leftPaneMode(820, false), 'overlay-closed');
  assert.equal(L.leftPaneMode(1439, true), 'overlay-closed');
  assert.equal(L.leftPaneMode(1440, false), 'inline');
  assert.equal(L.leftPaneMode(1440, true), 'hidden');
  assert.equal(L.leftPaneMode(819, false), 'stacked');
  assert.equal(L.leftPaneMode(700, false), 'stacked');
  assert.equal(L.leftPaneMode(375, false), 'stacked');
});

// Why: recording minors without a notice breaks the owner's consent rule (Q19); a second notice every round nags.
test('needsRecNotice: true until the judge chose Record on this device', () => {
  assert.equal(L.needsRecNotice({}), true);
  assert.equal(L.needsRecNotice(undefined), true);
  assert.equal(L.needsRecNotice({ recConsentAt: 0 }), true);
  assert.equal(L.needsRecNotice({ recConsentAt: 1_700_000_000_000 }), false);
});

// Why: the strip is how a judge knows the mic is on; a wrong or missing state hides live recording.
test('recStripState: off, starting, recording, offline per engine, stopped by a reload, narrow button', () => {
  assert.deepEqual(L.recStripState({ recWanted: false }), { hidden: true });
  assert.equal(L.recStripState({ recWanted: true, live: false }).text, 'Starting microphone…');
  const on = L.recStripState({ recWanted: true, live: true, speechId: '2AC', online: true, engine: 'openai' });
  assert.equal(on.text, 'Recording · 2AC');
  assert.equal(on.button, 'stop');
  assert.equal(on.buttonLabel, 'Stop recording');
  assert.equal(L.recStripState({ recWanted: true, live: true, speechId: '2AC', online: false, engine: 'openai' }).text, 'Recording · 2AC · text waits for the internet');
  assert.equal(L.recStripState({ recWanted: true, live: true, speechId: '2AC', online: false, engine: 'browser' }).text, 'Recording · 2AC · no text while offline');
  const reload = L.recStripState({ recWanted: false, stoppedByReload: true });
  assert.equal(reload.button, 'resume');
  assert.equal(reload.buttonLabel, 'Resume recording');
  assert.match(reload.text, /^Recording stopped when the page reloaded\./);
  assert.equal(L.recStripState({ recWanted: true, live: true, speechId: '2AC', narrow: true }).buttonLabel, 'Stop');
});

// Why: a resumed speech with 30 s left whose device clock moves back 2 min would silently give the speaker extra time.
test('restoreRun: with startLeft, more time than the clock had at start gives clock-moved and the full time', () => {
  const r = L.restoreRun({ id: '2AC', endAt: NOW + 150_000, startLeft: 30 }, NOW);
  assert.equal(r.state, 'running');
  assert.equal(r.reason, 'clock-moved');
  assert.equal(r.left, 480);
  assert.equal(r.endAt, NOW + 480_000);
});

// Why: normal rounding between the save and the reload must not trip the clock-moved reset and wipe the judge's time.
test('restoreRun: with startLeft, a time up to 2 s over startLeft still runs as saved', () => {
  const r = L.restoreRun({ id: '2AC', endAt: NOW + 31_000, startLeft: 30 }, NOW);
  assert.equal(r.state, 'running');
  assert.equal(r.reason, undefined);
  assert.equal(r.left, 31);
});

// Why: the speech length the app passes in is the cap; if restoreClocks drops it, a shorter round format would not be checked.
test('restoreClocks: passes the speech length on to restoreRun', () => {
  const out = L.restoreClocks({ id: '2AC', endAt: NOW + 400_000 }, null, NOW, 480, 300);
  assert.equal(out.speech.reason, 'clock-moved');
  assert.equal(out.speech.left, 300);
});

// Why: a clock over time but under 10 minutes must keep running (the judge decides when to stop), not pause.
test('restoreRun: an endAt 9 min 50 s in the past still runs at -590 s', () => {
  const r = L.restoreRun({ id: '1NC', endAt: NOW - 590_000 }, NOW);
  assert.equal(r.state, 'running');
  assert.equal(r.left, -590);
});

// Why: with the round open in two tabs, both would beep at 0:00; the second tab must see the first tab's beep.
test('beepedElsewhere: true only for the same run (id and endAt) saved with beeped', () => {
  const run = { id: '2AC', endAt: NOW };
  assert.equal(L.beepedElsewhere({ run: { id: '2AC', endAt: NOW, beeped: true } }, run), true);
  assert.equal(L.beepedElsewhere({ run: { id: '2AC', endAt: NOW, beeped: false } }, run), false);
  assert.equal(L.beepedElsewhere({ run: { id: '2AC', endAt: NOW + 1, beeped: true } }, run), false);
  assert.equal(L.beepedElsewhere({ run: { id: '1NC', endAt: NOW, beeped: true } }, run), false);
  assert.equal(L.beepedElsewhere({ run: null }, run), false);
  assert.equal(L.beepedElsewhere(null, run), false);
});
