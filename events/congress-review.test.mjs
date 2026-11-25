// Tests for the Congress screen review fixes (docs/events/CONGRESS-REVIEW.md): the open rule facts the judge sets at
// setup, the beta label, statuses kept by earlier sessions, grouped tie notes, unscored-speech warnings, the Review
// card text, the safer Enter pick, the overview's primary action, and the Undo on Next item and End term.
// Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseRoom } from './js/parse.js';
import { congressProfile, poScaleChoices, rankPoolChoices } from './congress/profiles.js';
import { createChamber, newSession, setStatus, closeSession, frozenProfile, sessionsToClose, setSubmitted, markDebated, reopenItem } from './congress/chamber.js';
import { startSpeech, endSpeech, updateSpeech, legislatorLines } from './congress/speech.js';
import { startTerm, endTerm, reopenTerm, setHourScore, HOUR_MS } from './congress/po.js';
import { rankPool, toggleRank, rankModel } from './congress/rank.js';
import { reviewBlocks, unscoredSpeeches, unscoredLine } from './congress/review.js';
import { BETA_LINE, CHECK_RULE, barHtml, rankHtml, reviewHtml, poCardHtml, gridHtml, statsText, enterPick } from './congress/views.js';
import { setupHtml, listHtml, overviewHtml, openFactsHtml, profileNote, statusChange } from './congress/chamber-screen.js';
import { migrateCongress, withChamber, withSession, findChamber, findSession } from './congress/store.js';
import { pickerListHtml } from './js/picker-screen.js';
import { pickerRows, pickerSections } from './js/picker.js';
import { loadEventData } from './js/data.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
let n = 0;
const makeId = (p) => p + (++n);
const DIST = congressProfile('nsda-district');
const LC = congressProfile('nsda-last-chance');
const codes = (k) => Array.from({ length: k }, (_, i) => String(1001 + i));
function chamberOf(k, profile = DIST, open) {
  return createChamber({ entries: parseRoom(codes(k).join('\n')).entries, docket: ['A Bill to Fund Rail'], house: 'house', profile, open, now: 0, makeId });
}
const speak = (s, c, i, at, patch) => {
  let x = startSpeech(s, c.legislators[i].id, { now: at, makeId });
  const id = x.live.speechId;
  x = endSpeech(x, at + 180000);
  return patch ? updateSpeech(x, id, patch) : x;
};
const primaries = (html) => (html.match(/class="b primary/g) || []).length;

// ---------- open rule facts ----------

// Why: a silent PO range or rank pool means a judge at a tournament with the other rule hands in wrong PO points or ranks.
test('setup offers the unverified PO range and rank pool as choices, with "Check your tournament\'s rule"', () => {
  assert.deepEqual(poScaleChoices(DIST).map((s) => s.min + '-' + s.max), ['4-8', '1-8'], 'the rules\' range first, then the manual\'s other reading');
  assert.deepEqual(rankPoolChoices(DIST), ['present', 'spokeOrPresided']);
  assert.deepEqual(poScaleChoices(LC), [], 'Last Chance: the PO range is confirmed, so no choice');
  assert.deepEqual(rankPoolChoices(LC), [], 'Last Chance: the rank pool is confirmed, so no choice');
  assert.deepEqual(poScaleChoices(congressProfile('tfa')), [], 'the parliamentarian scores the PO: nothing for the scorer to set');
  const html = openFactsHtml(DIST);
  assert.ok(html.includes(CHECK_RULE));
  assert.match(html, /id="cg-po-scale"><option value="4-8" selected>4 to 8<\/option><option value="1-8">1 to 8<\/option>/);
  assert.match(html, /id="cg-rank-pool"><option value="present" selected>Every present legislator<\/option><option value="spokeOrPresided">Only those who spoke or presided<\/option>/);
  assert.equal(openFactsHtml(LC), '');
  assert.match(setupHtml({}), /id="cg-open"/);
  assert.ok(profileNote(DIST).endsWith(CHECK_RULE), 'the rules line says to check, not "the tab room"');
  // The defaults the owner chose: PO 4 to 8 for each full hour, and every present legislator can be ranked.
  assert.deepEqual({ ...chamberOf(8).profile.poScale }, { min: 4, max: 8 });
  assert.equal(chamberOf(8).profile.rankPool, 'present');
  assert.equal(congressProfile('nsda-nationals').rankPool, 'present');
});

// Why: if the chamber dropped the pick, the PO buttons and rank pool would fall back to the default mid-session.
test('the chamber keeps the judge\'s PO range and rank pool, and ignores a value that was never offered', () => {
  const c = chamberOf(10, DIST, { poScale: { min: 1, max: 8 }, rankPool: 'spokeOrPresided' });
  assert.deepEqual({ ...c.profile.poScale }, { min: 1, max: 8 });
  assert.equal(c.profile.rankPool, 'spokeOrPresided');
  assert.deepEqual([...c.profile.picked], ['poScale', 'rankPool']);
  const odd = frozenProfile(DIST, null, { poScale: { min: 2, max: 9 }, rankPool: 'everyone' });
  assert.deepEqual({ ...odd.poScale }, { min: 4, max: 8 });
  assert.equal(odd.rankPool, 'present');
  assert.equal(odd.picked, undefined);
  assert.equal(frozenProfile(LC, null, { rankPool: 'present' }).rankPool, 'spokeOrPresided', 'a confirmed value cannot be changed');
  // The PO card uses the picked range, and the rank pool follows the picked rule.
  let s = startTerm(newSession(c, [], { now: 0, makeId }).session, c.legislators[0].id, 0);
  const po = poCardHtml(c, s, HOUR_MS + 1, false);
  assert.match(po, /data-value="1"[^>]*>1<\/button>/);
  assert.ok(po.includes(CHECK_RULE));
  s = speak(s, c, 1, 0, { points: 5 });
  assert.deepEqual(rankPool(c, s).map((x) => x.legislator.code), ['1002', '1001'], 'only the speaker and the PO');
  const st = withSession(withChamber(migrateCongress(null), c), s);
  assert.match(overviewHtml(st, c), /Set at setup: PO points 1 to 8; who can be ranked: only those who spoke or presided\./);
  assert.ok(rankHtml(c, s, HOUR_MS + 1).includes(CHECK_RULE));
});

// ---------- beta label ----------

// Why: Congress scoring is new; a judge who opens it must see that it is a beta and check the totals before handing in.
test('every Congress screen shows the Beta tag, and setup, the list and Review say to check the totals', () => {
  assert.equal(BETA_LINE, 'Congress scoring is new. Check the totals before you hand in your ballot.');
  const c = chamberOf(8);
  const s = newSession(c, [], { now: 0, makeId }).session;
  const st = withSession(withChamber(migrateCongress(null), c), s);
  for (const [name, html] of [['setup', setupHtml({})], ['list', listHtml(st)]]) {
    assert.match(html, /<h1[^>]*>[^<]*<span class="pill outline cg-beta">Beta<\/span><\/h1>/, name);
    assert.ok(html.includes(BETA_LINE), name);
  }
  assert.match(barHtml(c, s, 'log', 0), /cg-beta">Beta</);
  assert.match(overviewHtml(st, c), /<h1[^>]*>[^<]*<span class="pill outline cg-beta">Beta<\/span><\/h1>/);
  assert.ok(reviewHtml(c, s, 0).includes(BETA_LINE));
});

// Why: the picker is where a judge first opens Congress; without the tag they start a chamber not knowing it is new.
test('the picker\'s Congress row carries the Beta tag', async () => {
  const data = await loadEventData(async (p) => JSON.parse(read('./' + p)));
  const html = pickerListHtml(pickerSections(pickerRows(data), [], ''));
  assert.match(html, /<span class="pk-name">Congressional Debate <span class="muted">Congress<\/span> <span class="pill outline">Beta<\/span><\/span>/);
  assert.equal((html.match(/>Beta</g) || []).length, 1, 'only the Congress row');
});

// ---------- statuses ----------

// Why: marking a student absent for session 2 must not empty a slot on session 1's ballot (screen order: mark, then start).
test('marking someone absent before the next session leaves earlier and submitted ballots as they were', () => {
  const c = chamberOf(10);
  let s1 = newSession(c, [], { now: 0, makeId }).session;
  for (let i = 0; i < 8; i++) s1 = toggleRank(c, s1, c.legislators[i].id);
  let st = withSession(withChamber(migrateCongress(null), c), s1);
  const who = c.legislators[0].id;
  // Session 1 is the latest and still open: someone who leaves now leaves it too.
  let open = statusChange(st, c.id, who, 'left', 1);
  assert.equal(rankModel(findChamber(open, c.id), findSession(open, s1.id)).complete, false, 'the open session follows the change');
  // Once session 1 is submitted, the change no longer reaches it.
  st = withSession(st, Object.assign({}, s1, { submittedAt: 5 }));
  st = statusChange(st, c.id, who, 'absent', 6);
  const c2 = findChamber(st, c.id);
  const kept = findSession(st, s1.id);
  assert.equal(rankModel(c2, kept).complete, true, 'session 1 still has its full top 8');
  assert.deepEqual(rankModel(c2, kept).gone, []);
  const s2 = newSession(c2, [kept], { now: 7, makeId }).session;
  assert.ok(!rankPool(c2, s2).some((x) => x.legislator.id === who), 'session 2 uses the new status');
  // A later change after session 2 starts: session 1 (earlier) keeps its copy even if it were not submitted.
  st = withSession(st, s2);
  st = statusChange(st, c.id, who, 'present', 8);
  assert.equal(findSession(st, s1.id).statuses[who], 'present', 'the copy taken before the absence');
  assert.equal(closeSession(kept, c2), kept, 'closing twice keeps the first copy');
  assert.doesNotMatch(gridHtml(c2, kept, null), /is-out/);
  assert.deepEqual(sessionsToClose([{ number: 1 }, { number: 2 }]).map((x) => x.number), [1]);
  assert.deepEqual(sessionsToClose([{ number: 1 }, { number: 2, submittedAt: 3 }]).map((x) => x.number), [1, 2]);
});

// Why: after "Mark submitted" then Undo, the latest session stayed frozen, so a student who left stayed rankable.
test('taking back "submitted" on the latest session makes it follow the chamber again; an earlier one keeps its copy', () => {
  const c = chamberOf(10);
  let s = newSession(c, [], { now: 0, makeId }).session;
  s = setSubmitted(s, c, true, 5, true);
  assert.equal(s.submittedAt, 5);
  assert.ok(s.statuses);
  const back = setSubmitted(s, c, false, 6, true);
  assert.equal(back.submittedAt, null);
  assert.equal('statuses' in back, false);
  const left = setStatus(c, c.legislators[0].id, 'left', 7);
  assert.ok(!rankPool(left, back).some((x) => x.legislator.id === c.legislators[0].id), 'the student who left is out');
  assert.ok(setSubmitted(s, c, false, 6, false).statuses, 'an earlier session keeps its copy');
  // The picker and the PO list of an earlier session use its own statuses.
  const st = statusChange(withSession(withChamber(migrateCongress(null), c), s), c.id, c.legislators[1].id, 'absent', 8);
  assert.ok(enterPick(findChamber(st, c.id), findSession(st, s.id), c.legislators[1].code), 'still pickable in the submitted session');
  assert.match(poCardHtml(findChamber(st, c.id), findSession(st, s.id), 9, true), new RegExp('data-id="' + c.legislators[1].id + '"'));
});

// ---------- rank notes and unscored speeches ----------

// Why: a 6-way tie printed 15 pair lines that pushed the pool off the phone screen; one line per group says the same.
test('a points tie among ranked legislators is one line per group', () => {
  const c = chamberOf(10);
  let s = newSession(c, [], { now: 0, makeId }).session;
  for (let i = 0; i < 8; i++) s = speak(s, c, i, i * 300000, { points: i < 6 ? 5 : 7 - (i - 6) });
  for (let i = 0; i < 8; i++) s = toggleRank(c, s, c.legislators[i].id);
  const m = rankModel(c, s);
  assert.equal(m.ties.length, 1);
  assert.equal(m.ties[0].length, 6);
  const html = rankHtml(c, s, 0);
  assert.equal((html.match(/have the same points\./g) || []).length, 1);
  assert.match(html, /1001, 1002, 1003, 1004, 1005 and 1006 have the same points\./);
});

// Why: an empty point box read as 0 and Review copied "No points" silently, so a ballot could go in missing a score.
test('speeches with no points are named on Rank and Review, but a capped, off-floor or live speech is not', () => {
  const c = chamberOf(10);
  let s = newSession(c, [], { now: 0, makeId }).session;
  s = speak(s, c, 0, 0, { points: 6 });
  s = speak(s, c, 1, 300000);
  s = speak(s, c, 2, 600000, { penalty: 'offFloor' });
  s = startSpeech(s, c.legislators[3].id, { now: 900000, makeId });
  const list = unscoredSpeeches(c, s);
  assert.deepEqual(list.map((x) => x.code), ['1002']);
  assert.equal(unscoredLine(list), '1 speech has no points yet: 1002 (speech 1).');
  assert.ok(rankHtml(c, s, 0).includes('1 speech has no points yet'));
  assert.ok(reviewHtml(c, s, 0).includes('1 speech has no points yet'));
  assert.match(rankHtml(c, s, 0), /1 speech · 0 points · 1 not scored/);
  const line = legislatorLines(c, s)[1];
  assert.equal(statsText(line, c.profile), '1 speech · 0 points · 1 not scored');
  assert.equal(statsText(legislatorLines(c, s)[0], c.profile), '1 speech · 6 points · avg 6');
  // UIL scores only the first five speeches; the sixth is not "missing".
  const u = chamberOf(4, congressProfile('uil'));
  let us = newSession(u, [], { now: 0, makeId }).session;
  for (let i = 0; i < 6; i++) us = speak(us, u, 0, i * 300000, i < 5 ? { points: 4 } : null);
  assert.deepEqual(unscoredSpeeches(u, us), []);
  assert.doesNotMatch(statsText(legislatorLines(u, us)[0], u.profile), /not scored/);
  // Ranks only: no points, so nothing is missing.
  const r = chamberOf(4, congressProfile('ncfl'));
  assert.deepEqual(unscoredSpeeches(r, speak(newSession(r, [], { now: 0, makeId }).session, r, 0, 0)), []);
});

// ---------- Review ----------

// Why: a doubled title line doubled a 45-speech Review; Copy must still put the title line first for the ballot row.
test('a Review card shows its title once; Copy still gives the title then the notes', () => {
  const c = chamberOf(8);
  let s = newSession(c, [], { now: 0, makeId }).session;
  s = speak(s, c, 0, 0, { points: 7, comment: 'Strong clash.' });
  const b = reviewBlocks(c, s)[0];
  assert.equal(b.text, b.title + '\n' + b.detail);
  assert.match(b.detail, /Strong clash\.$/);
  const html = reviewHtml(c, s, 0);
  assert.equal(html.split(b.title).length - 1, 1, 'the title appears once on the page');
});

// ---------- picker ----------

// Why: "1" then Enter gave the floor to the first of many codes with a 1, so the wrong student got the speech.
test('Enter in the picker takes an exact code or the only match, never the first of many', () => {
  const c = chamberOf(20);
  const s = newSession(c, [], { now: 0, makeId }).session;
  assert.equal(enterPick(c, s, '1'), null);
  assert.equal(enterPick(c, s, '100'), null, '1001 to 1009 all match');
  assert.equal(enterPick(c, s, '1012').code, '1012');
  assert.equal(enterPick(c, s, '1020').code, '1020');
  assert.equal(enterPick(c, s, '020').code, '1020', 'the only match');
  assert.equal(enterPick(c, s, ''), null);
  const out = setStatus(c, c.legislators[11].id, 'absent', 1);
  assert.equal(enterPick(out, s, '1012'), null, 'an absent student is not in the picker');
});

// ---------- overview ----------

// Why: one stray tap on "Start session 2" opened a new ballot while session 1 was still open.
test('the overview\'s primary opens the open session; Start is primary only once it is submitted', () => {
  const c0 = chamberOf(8);
  const made = newSession(c0, [], { now: 0, makeId });
  const st = withSession(withChamber(migrateCongress(null), made.chamber), made.session);
  let html = overviewHtml(st, made.chamber);
  assert.equal(primaries(html), 1);
  assert.match(html, /<a class="b primary" href="#\/round\/[^"]+\/log">Open session 1<\/a><button class="b" type="button" data-chact="session"/);
  const done = withSession(st, Object.assign({}, made.session, { submittedAt: 5 }));
  html = overviewHtml(done, made.chamber);
  assert.equal(primaries(html), 1);
  assert.match(html, /<button class="b primary" type="button" data-chact="session"[^>]*>.*Start session 2/);
  assert.doesNotMatch(html, /Open session/);
});

// ---------- undo ----------

// Why: without Undo a slip marks a bill debated or restarts PO hours; a whole-copy Undo would wipe later changes.
test('Undo for Next item reopens only that item; Undo for End term reopens the term and keeps its scores', () => {
  const c = chamberOf(8);
  const s = newSession(c, [], { now: 0, makeId }).session;
  const other = Object.assign({}, c, { docket: c.docket.concat({ id: 'it-x', title: 'Second', debatedInSession: 4 }) });
  const moved = markDebated(other, s.itemId, s.number);
  assert.equal(moved.docket[0].debatedInSession, 1);
  const back = reopenItem(moved, Object.assign({}, s, { itemId: null }), s.itemId);
  assert.equal(back.session.itemId, s.itemId);
  assert.equal('debatedInSession' in back.chamber.docket[0], false);
  assert.equal(back.chamber.docket[1].debatedInSession, 4, 'another item is left alone');
  let p = startTerm(s, c.legislators[0].id, 0);
  p = endTerm(p, 2 * HOUR_MS + 5);
  p = setHourScore(p, 0, 2, 7, 2 * HOUR_MS + 6);
  const again = reopenTerm(p);
  assert.equal(again.poTerms[0].endedAt, null);
  assert.equal(again.poTerms[0].partHour, false);
  assert.deepEqual(again.poTerms[0].hourScores, [{ hour: 2, points: 7 }], 'a score given after End term is kept');
  assert.equal(reopenTerm(again), again, 'an open term is left alone');
});

// ---------- the page wiring ----------

// Why: the pure helpers above only protect the judge if the page calls them; these lines are the page's wiring.
test('the session page wires Undo, the Enter pick and the submitted copy to the tested helpers', () => {
  const src = read('./congress/session-screen.js');
  assert.match(src, /const back = reopenItem\(cur\.c, cur\.s, before\)/);
  assert.match(src, /save\(reopenTerm\(cur\)\)/);
  assert.match(src, /enterPick\(c, s, q\)/);
  assert.match(src, /save\(setSubmitted\(s, c, !was, now, latest\(\)\)\)/);
  assert.match(src, /save\(setSubmitted\(cur\.s, cur\.c, false, env\.now\(\), latest\(\)\)\)/);
  const cs = read('./congress/chamber-screen.js');
  assert.match(cs, /io\.write\(statusChange\(io\.read\(\), id, sel\.dataset\.status, sel\.value, env\.now\(\)\)\)/);
  assert.match(cs, /for \(const old of earlier\) next = withSession\(next, closeSession\(old, c\)\);/);
  assert.match(read('./congress/congress.css'), /\.cg-cell \{ min-width: 2\.75rem; min-height: 2\.75rem;/, 'speech boxes are 44 px tap targets');
});
