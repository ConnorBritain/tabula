// Tests for the accessibility and keyboard pass on the Congress screens (docs/events/CONGRESS-REVIEW.md §5): list
// roles on the speaker and PO pickers, named Copy buttons on Review, where the keyboard focus lands after a PO hour
// score, the timer tick that must not move the focus, and Esc in the speaker search.
// Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseRoom } from './js/parse.js';
import { congressProfile } from './congress/profiles.js';
import { createChamber, newSession } from './congress/chamber.js';
import { startSpeech, endSpeech } from './congress/speech.js';
import { startTerm, setHourScore, HOUR_MS } from './congress/po.js';
import { pickerHtml, poCardHtml, reviewHtml, poFocusKey } from './congress/views.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
let n = 0;
const makeId = (p) => p + (++n);
const DIST = congressProfile('nsda-district');
const codes = (k) => Array.from({ length: k }, (_, i) => String(1001 + i));
function setup(k = 6) {
  const chamber = createChamber({ entries: parseRoom(codes(k).join('\n')).entries, docket: ['A Bill to Fund Rail'], house: 'house', profile: DIST, now: 0, makeId });
  const made = newSession(chamber, [], { now: 0, makeId });
  return { c: made.chamber, s: made.session };
}
const keysIn = (html) => [...html.matchAll(/data-key="([^"]+)"/g)].map((m) => m[1]);

// Why: role="listitem" on a button hides that it is a button, so a screen-reader judge hears a list row they cannot
// press and cannot give a student the floor or start a PO term (axe: aria-allowed-role).
test('the speaker picker and the PO chooser are real lists of buttons, with no role on the buttons', () => {
  const { c, s } = setup();
  for (const html of [pickerHtml(c, s, ''), poCardHtml(c, s, 0, true)]) {
    assert.doesNotMatch(html, /role="listitem"/);
    assert.doesNotMatch(html, /<button[^>]*\brole=/);
    assert.match(html, /<ul class="cg-pick-list"[^>]*>(<li><button [^>]*>.*?<\/button><\/li>)+<\/ul>/s);
  }
  assert.match(pickerHtml(c, s, 'zzz'), /<ul class="cg-pick-list"><li class="muted">No present legislator matches\.<\/li><\/ul>/, 'an empty search is still a valid list');
});

// Why: Review had a row of buttons all named "Copy"; a screen-reader judge could not tell which speech they were about
// to paste into the online ballot, and could paste the wrong student's comment.
test('each Copy button on Review names the speech or PO hour it copies', () => {
  let { c, s } = setup();
  s = startSpeech(s, c.legislators[0].id, { now: 0, makeId });
  s = endSpeech(s, 180000);
  s = startSpeech(s, c.legislators[1].id, { now: 200000, makeId });
  s = endSpeech(s, 380000);
  const html = reviewHtml(c, s, 400000);
  const textOf = (id) => { const m = html.match(new RegExp(`id="${id}"[^>]*>([^<]*)<`)); return m ? m[1] : null; };
  const names = [...html.matchAll(/data-cact="copy" data-id="(?!ranks)[^"]+"[^>]*aria-labelledby="([^"]+)"/g)].map((m) => m[1].split(' ').map(textOf).join(' '));
  assert.equal(names.length, 2);
  assert.ok(names.every((x) => x.startsWith('Copy ')), names.join(' | '));
  assert.notEqual(names[0], names[1]);
  assert.match(names[0], /1001/);
  assert.match(names[1], /1002/);
});

// Why: after a PO hour score the focus fell to the page title, so a keyboard judge had to Tab through the whole log
// again to check or change the score they just gave.
test('after a PO hour score the focus key is that hour\'s Change button, and after Change the first score button', () => {
  let { c, s } = setup();
  s = startTerm(s, c.legislators[0].id, 0);
  const now = HOUR_MS + 1000;
  const due = poCardHtml(c, s, now, false);
  const first = poFocusKey('po-clear', 0, 1, DIST.poScale);
  assert.ok(keysIn(due).includes(first), 'the first score button of the hour is on the card: ' + first);
  s = setHourScore(s, 0, 1, 6, now);
  const scored = poCardHtml(c, s, now, false);
  assert.ok(keysIn(scored).includes(poFocusKey('po-score', 0, 1)), 'the Change button of the hour is on the card');
  assert.equal(poFocusKey('other', 0, 1, DIST.poScale), null);
});

// Why: the session screen redraws once each full PO hour; it used to move the focus to the page title mid-task, and
// a focus key that matched nothing left the focus nowhere, so a keyboard judge lost their place in a live chamber.
test('a draw never leaves the focus nowhere, and the timer tick keeps it where it was', () => {
  const src = read('./congress/session-screen.js');
  assert.match(src, /function draw\(focusKey, keep\)/);
  assert.match(src, /if \(target\) target\.focus\(\); else if \(!keep\) el\.querySelector\('#screen-title'\)\.focus/, 'a missing key falls back to the title');
  assert.match(src, /const inside = Boolean\(a && el\.contains\(a\)\);/);
  assert.match(src, /draw\(inside && a\.dataset\.key \? a\.dataset\.key : null, !inside\)/, 'the tick redraw puts the focus back on the same control, or the title; focus outside the screen is left alone');
  assert.equal((src.match(/return draw\(\);/g) || []).length, 0, 'no action redraws without saying where the focus goes');
});

// Why: the speaker picker opens in place of "Next speech"; without Esc a keyboard judge who opened it by mistake had to
// Tab to Cancel, and the shared Esc stack does not know this panel.
test('Esc in the speaker search closes the picker the same way as Cancel', () => {
  const src = read('./congress/session-screen.js');
  assert.match(src, /ev\.target\.id === 'cg-search' && ev\.key === 'Escape'[\s\S]{0,200}\[data-cact="cancel-pick"\][\s\S]{0,80}act\(cancel\)/);
  assert.match(src, /case 'cancel-pick': view\.picking = false; return draw\('next'\);/, 'Cancel puts the focus back on Next speech');
});
