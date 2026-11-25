// Tests for step E12 (docs/events/LANDING.md §4.1): the Custom event form (events/js/custom.js, setup-screen.js) and a
// Custom room's own limit and grace. Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadEventData } from './js/data.js';
import { parseRoom } from './js/parse.js';
import { createRoom, roomEvent, setupError, CUSTOM_EVENT } from './js/room.js';
import { customError, customEvent, withGrace, parseGrace } from './js/custom.js';
import { setupHtml } from './js/setup-screen.js';
import { limitOf, graceOf, timerFace, signalPoints } from './js/timer.js';
import { timerHtml } from './js/timer-view.js';
import { roomTitle } from './js/room-screen.js';
import { roomRow } from './js/rooms.js';
import { sheetHtml } from './js/comment-view.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const DATA = await loadEventData(async (p) => JSON.parse(read(p)));
const district = DATA.profiles.get('nsda-district');
// A Custom room as the setup screen makes it: "MS Prose", 7:00, 15 s grace, NSDA district rules.
function customRoom() {
  const form = { name: 'MS Prose', limit: '7:00', grace: '15' };
  assert.equal(customError(form), '');
  return createRoom({ event: customEvent(form), profile: withGrace(district, form.grace), entries: parseRoom('1. A12\n2. B07').entries, round: 'Round 1', now: 1 });
}

// Why: the LANDING.md E12 done-check. A Custom room has no event file to look up later, so if it did not carry its own
// limit and grace, a reload would time the speaker against no limit (or another event's) and set the wrong
// over-grace flag, which can block a rank.
test('a Custom room saves its own limit and grace and reopens with them', () => {
  const saved = JSON.stringify([customRoom()]);           // what the store writes
  const r = JSON.parse(saved)[0];                          // what a reload reads
  const event = roomEvent(DATA.events, r);
  assert.equal(r.eventId, CUSTOM_EVENT);
  assert.equal(limitOf(event), 420);
  assert.equal(graceOf(r), 15);
  assert.match(timerHtml(r.entries[0], timerFace(r.entries[0], 420, 15, 1), limitOf(event), graceOf(r)), /Limit 7:00 · grace 0:15/);
  assert.equal(roomTitle(r, event), 'MS Prose · Round 1');
  assert.equal(roomRow(r, DATA.events).name, 'MS Prose');
  assert.equal(r.profile.overtime.effect, 'noFirst', 'the rest of the picked rules stay');
  assert.equal(district.overtime.grace, 30, 'the shared profile is not changed');
  assert.ok(signalPoints(limitOf(event), graceOf(r)).length > 0, 'the signal chips work for any limit');
});

// Why: a typo in the form must stop at setup with a plain reason; a room started with no limit or a grace of "30
// minutes" would mark every speaker over time.
test('the form refuses a missing or odd limit and grace, and names the fix', () => {
  assert.match(customError({ limit: '', grace: '30' }), /time limit/);
  assert.match(customError({ limit: '0:10', grace: '30' }), /0:30 to 60:00/);
  assert.match(customError({ limit: '61:00', grace: '30' }), /0:30 to 60:00/);
  assert.match(customError({ limit: '5:00', grace: '' }), /whole seconds/);
  assert.match(customError({ limit: '5:00', grace: '1:00' }), /whole seconds/);
  assert.match(customError({ limit: '5:00', grace: '301' }), /0 to 300/);
  assert.equal(customError({ limit: '5', grace: '0' }), '', '5 means 5 minutes; 0 means no grace');
  assert.equal(parseGrace(' 20 '), 20);
  assert.equal(customEvent({ name: '  ', limit: '5:00' }).name, 'Custom event', 'a blank name gets the plain one');
});

// Why: the judge must find the Custom event in the picker and see its fields start at the rules' own grace; a hidden
// or empty form would leave local-event judges with no way to set the time.
test('setup offers the Custom event, with its fields hidden until picked', () => {
  const html = setupHtml(DATA);
  // CHANGED 2026-11-24 because the owner approved COPY-TRIM-AUDIT.md §1 (E41). Old line:
  //   assert.match(html, /<option value="custom">Custom event \(set the time\)<\/option>/);
  assert.match(html, /<option value="custom">Custom event<\/option>/);
  assert.match(html, /<fieldset class="setup-custom" id="setup-custom" hidden>/);
  assert.match(html, /id="custom-grace" autocomplete="off" inputmode="numeric" value="30"/);
  assert.equal(setupError(parseRoom('A12'), CUSTOM_EVENT), '', 'Custom passes the event check');
});

// Why: a Custom event has no chips; empty "Strengths" and "To work on" rows would look broken to a lay judge.
test('the comment sheet of a Custom room has no empty chip rows', () => {
  const r = customRoom();
  const html = sheetHtml(r, r.entries[0], roomEvent(DATA.events, r));
  assert.doesNotMatch(html, /chip-group/);
  assert.match(html, /id="notes"/);
});
