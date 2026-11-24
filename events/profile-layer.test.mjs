// Tests for step S4 "Profile layer and elims" (docs/events/EXPERIENCE.md §2.4, §2.5, §2.6, §3, §3.1, §3.2, §8.5):
// the v2 profile files, the profile layer (ranks all / topN / off, rubric, critiqueOnly, maxEntries), level and panel,
// the F2 cross-ex in elims, the draw gap, cross-entry status, and the number-then-Enter pick. Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { loadEventData } from './js/data.js';
import { createRoom, addEntry, setupError, entryCap, nextWaiting, present, updateEntry, MAX_ENTRIES, STATUS_LABEL } from './js/room.js';
import { openBoard, withRanks, withRating } from './js/board.js';
import { layerOf, stagesOf, rankStageLabel, shownRank, layerProblems, rubricTotal, stepRubric, withRubric, rubricOf } from './js/profile-layer.js';
import { ranksBlock, checklist, markCopied, statusText, cards, copyAllText, printModel } from './js/ballot.js';
import { stages, mount, rankModel } from './js/room-workspace.js';
import { boardHtml, problemsHtml } from './js/rank-screen.js';
import { rateListHtml } from './js/rate-screen.js';
import { rubricHtml } from './js/rubric-view.js';
import { ranksStageHtml, cardHtml } from './js/review-screen.js';
import { frameLine, frameHtml, overtimeNote, panelOf, makePanel, PANEL_OVERTIME_NOTE } from './js/round-frame.js';
import { markCrossEntered, clearCrossEntered, crossNote } from './js/cross-entry.js';
import { cxOn, cxLimit, askerOf, setAsker, setSchool, sameSchoolWarning, startCx, stopCx, cxUsed, phases, waitingLine } from './js/cross-ex.js';
import { crossExHtml } from './js/cross-ex-view.js';
import { digitOf, pressDigit, pressEnter } from './js/number-pick.js';
import { keymap } from './js/keys.js';
import { keyMatches } from '../core/keys.js';
import { withSetting, drawGapOf } from './js/settings.js';
import { migrateSettings } from './js/migrate.js';
import { profileChoices, shapeChoices, setupHtml } from './js/setup-screen.js';
import { rosterHtml } from './js/room-screen.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const readJson = (p) => JSON.parse(read(p));
const DATA = await loadEventData(async (p) => readJson(p));
const PUB = readJson('published.json');
let n = 0;
const makeId = (p) => p + (++n);
const codes = (k) => Array.from({ length: k }, (_, i) => ({ code: 'A' + (i + 1) }));
const mk = (eventId, profileId, k, extra) => createRoom(Object.assign({ event: DATA.events.get(eventId), profile: DATA.profiles.get(profileId), entries: codes(k), round: 'Round 1', now: 1000, makeId }, extra));
const ranked = (room) => openBoard(room, 2000).room;

// ---------- the v2 profile files ----------

const V1_KEYS = ['id', 'version', 'name', 'rating', 'ratingNoTies', 'rankRatingRule', 'overtime', 'biasNote', 'source'];
const LAYER_KEYS = ['ranks', 'topN', 'rubric', 'critiqueOnly', 'maxEntries', 'elim', 'group'];
const V2 = readdirSync(new URL('profiles/v2/', import.meta.url)).filter((f) => f.endsWith('.json')).map((f) => ({ f, d: readJson('profiles/v2/' + f) }));

// Why: a v2 profile field the app does not understand would silently judge a round under the wrong ballot shape;
// the v1 schema test only covers events/profiles/*.json, so the v2 folder needs its own gate.
test('every v2 profile file has the v1 fields plus only known profile-layer fields, with valid values', () => {
  assert.ok(V2.length >= 5, 'the S4 presets are on disk');
  for (const { f, d } of V2) {
    for (const k of V1_KEYS) assert.ok(k in d, f + ' lacks ' + k);
    for (const k of Object.keys(d)) assert.ok(V1_KEYS.includes(k) || LAYER_KEYS.includes(k), f + ': unknown field ' + k);
    assert.equal(f, `${d.id}.v${d.version}.json`, f + ': the file name is how an old room finds its rules');
    assert.ok(['all', 'topN', 'off'].includes(d.ranks), f + ' ranks (a v2 profile always names its ranks mode)');
    if (d.ranks === 'topN') assert.ok(Number.isInteger(d.topN) && d.topN >= 1, f + ' topN');
    if ('rubric' in d) { assert.ok(Array.isArray(d.rubric) && d.rubric.length); assert.equal(rubricOf(d).length, d.rubric.length, f + ': every rubric row is valid'); }
    if ('critiqueOnly' in d) assert.equal(typeof d.critiqueOnly, 'boolean', f);
    if ('maxEntries' in d) assert.equal(entryCap(d), d.maxEntries, f + ': maxEntries is inside 1 to 30');
    if ('elim' in d) assert.equal(typeof d.elim.cx, 'boolean', f + ' elim.cx');
    if ('group' in d) assert.equal(d.group, 'shape', f + ': the only picker group is "shape" (a Tabula ballot shape)');
    if (d.ranks === 'off' && !d.critiqueOnly) assert.ok(d.rating !== 'none' || (d.rubric || []).length, f + ': Rate needs a scale or a rubric');
    assert.match(d.source, /\b20\d\d-\d\d\b/, f + ': names a season');
    assert.match(d.source, /not verified/i, f + ': a Tabula preset says it is not a verified league rule');
    assert.ok(PUB.profiles.includes('v2/' + f), f + ' is on the published list, so it can never be deleted');
  }
});

// Why: a v1 profile must judge exactly as before S4; if the layer read a missing field as "off" or "critique only",
// every saved room would lose its Rank stage.
test('a profile with no layer fields keeps the v1 behaviour: Rank, all ranks, no rubric, cap 8', () => {
  for (const id of ['nsda-district', 'nsda-invitational', 'custom']) {
    const p = DATA.profiles.get(id);
    assert.deepEqual(layerOf(p), { ranks: 'all', topN: null, rubric: [], critiqueOnly: false, maxEntries: MAX_ENTRIES }, id);
    assert.deepEqual(stagesOf(p), ['judge', 'rank', 'review']);
    assert.equal(rankStageLabel(p), 'Rank');
  }
  assert.equal(layerOf({ ranks: 'topN' }).ranks, 'all', 'topN with no valid N is all, never a board with no ranks');
  assert.equal(layerOf({ ranks: 'nonsense' }).ranks, 'all');
});

// ---------- room size ----------

// Why: elim finals hold more than 8 (§2.5); a profile cap of 12 must let a 12-entry final start and grow, and
// still stop at 12, or a judge cannot judge the room at all (or a typo makes a 40-row roster).
test('a profile with a larger cap holds that many entries in setup, createRoom and Add entry', () => {
  const big = DATA.profiles.get('elim-large');
  assert.equal(entryCap(big), 12);
  const twelve = { entries: codes(12), check: [] };
  assert.equal(setupError(twelve, 'ix', entryCap(big)), '');
  assert.match(setupError({ entries: codes(13), check: [] }, 'ix', entryCap(big)), /at most 12/);
  assert.match(setupError(twelve, 'ix'), /at most 8/, 'with no cap given, setup keeps the default of 8');
  const r = mk('ix', 'elim-large', 11);
  const res = addEntry(r, 'Z9', '', 3000, 'z');
  assert.equal(res.error, '');
  assert.equal(res.room.entries.length, 12);
  assert.match(addEntry(res.room, 'Z10', '', 3001, 'y').error, /at most 12/);
  assert.throws(() => mk('ix', 'elim-large', 13), /at most 12/);
  assert.equal(entryCap({ maxEntries: 99 }), MAX_ENTRIES, 'a cap past the Tabula limit is not trusted');
});

// Why: "1 to 8 picks a speaker" cannot reach place 12; without the type-then-Enter fallback a keyboard judge
// cannot pick the last speakers of a large final, and Enter must not steal a button press when nothing was typed.
test('in a room over 8 the judge types the number, then Enter; 8 or fewer still pick at once', () => {
  assert.deepEqual([digitOf('pick3'), digitOf('num9'), digitOf('num0'), digitOf('numEnter')], [3, 9, 0, null]);
  assert.deepEqual(pressDigit('', 3, 6), { buf: '', pick: 3 });
  assert.deepEqual(pressDigit('', 9, 6), { buf: '', pick: null }, 'no place 9 in a room of 6');
  let s = pressDigit('', 1, 12);
  assert.deepEqual(s, { buf: '1', pick: null }, 'past 8 a digit waits');
  s = pressDigit(s.buf, 2, 12);
  assert.deepEqual(pressEnter(s.buf, 12), { buf: '', pick: 12, error: '' });
  assert.match(pressEnter('13', 12).error, /No speaker at place 13/);
  assert.deepEqual(pressEnter('', 12), { buf: '', pick: null, error: '' }, 'Enter with nothing typed does nothing');
  const ctx = { scopes: ['room'], focus: 'none' };
  const key = (k, extra) => Object.assign({ code: k, key: k, meta: false, ctrl: false, alt: false, shift: false }, extra);
  assert.equal(keymap.keyAction(key('9'), ctx), 'num9');
  assert.equal(keymap.keyAction(key('Enter'), ctx), 'numEnter');
  assert.equal(keymap.keyAction(key('Enter'), { scopes: ['room'], focus: 'text' }), null, 'Enter in a text box stays in the box');
  assert.equal(keyMatches({ keys: { other: 'Enter' } }, key('Enter', { meta: true })), false, 'a bare Enter shortcut never fires on ⌘ Enter');
  assert.equal(keyMatches({ keys: { other: 'Meta+Enter' } }, key('Enter', { meta: true })), true, 'Meta+Enter keeps working');
});

// ---------- the profile layer on Rank and Review ----------

// Why: under "top 3" the tab room expects ranks only for the best three; copying ranks 4 to 6 would enter ranks the
// rules do not give, and the judge must see on the board where the line falls.
test('topN: the board orders everyone, the ballot ranks only the top N and says "Not in top N" for the rest', () => {
  const r = ranked(mk('oo', 'top-three', 5));
  assert.deepEqual(layerProblems(r), [], 'a full board is ready');
  const b = ranksBlock(r);
  assert.deepEqual(b.rows.map((x) => x.rank), ['1', '2', '3', '', '']);
  assert.match(b.text.split('\n')[3], /^A4\tNot in top 3\tOver time: No$/);
  assert.equal(cards(r)[4].rank, '');
  assert.equal(shownRank('2', r.profile), '2');
  const html = boardHtml(r, { tapMode: false, limit: 600, now: 3000 });
  assert.equal((html.match(/Not in top 3/g) || []).length, 2);
});

// Why: ranks 'off' means the judge must never be asked for an order (§2.4: Rank becomes Rate); the copy must hold
// ratings only, and missing ratings must stop the copy like missing ranks do.
test('ranks off: the round opens the Rate screen, needs a rating for each entry, and copies ratings with no rank', () => {
  let r = mk('hi', 'rate-only', 3);
  assert.equal(rankStageLabel(r.profile), 'Rate');
  assert.deepEqual(layerProblems(r), ['Give A1 a rating.', 'Give A2 a rating.', 'Give A3 a rating.']);
  r = withRating(withRating(withRating(r, r.entries[0].id, '9', 1), r.entries[1].id, '7', 1), r.entries[2].id, '11', 1);
  assert.deepEqual(layerProblems(r), ['A3: Use a number from 1 to 10.']);
  r = withRating(r, r.entries[2].id, '4', 1);
  assert.deepEqual(layerProblems(r), []);
  const b = ranksBlock(r);
  assert.equal(b.ranked, false);
  assert.equal(b.text.split('\n')[0], 'A1\tRating 9\tOver time: No');
  assert.equal(checklist(r)[0].label, '3 of 3 rated');
  assert.match(ranksStageHtml(r), /Ratings to submit/);
  assert.doesNotMatch(ranksStageHtml(r), /<th>Rank<\/th>/);
  assert.doesNotMatch(cardHtml(cards(r)[0], false), /No rank/, 'a Rate card says nothing of a rank');
  assert.match(copyAllText(r, null), /\nRatings\n/);
  // The router: stage 'rank' draws the Rate screen, so the address stays #/round/<id>/rank.
  const shown = [];
  const fake = (name) => ({ show: () => shown.push(name), hide() {} });
  const env = { el: {}, roomScreens: { judge: fake('judge'), rank: fake('rank'), rate: fake('rate'), review: fake('review') } };
  mount(env.el, env, r, 'rank')();
  mount(env.el, env, mk('hi', 'nsda-district', 3), 'rank')();
  assert.deepEqual(shown, ['rate', 'rank']);
  assert.match(rateListHtml(r, { limit: 600, now: 1 }), /data-ract="plus"/);
});

// Why: a rubric ballot is scored per criterion (§2.4: a grid of steppers); a missing criterion must stop the copy,
// the steppers must stay inside the range, and the copy must carry each score so the tab room gets all of them.
test('rubric: steppers stay in range, every criterion is needed, and the copy carries each score and the total', () => {
  let r = mk('dec', 'rubric-five', 2);
  const rub = layerOf(r.profile).rubric;
  assert.equal(rub.length, 5);
  assert.equal(stepRubric('', 1, rub[0]), 3, 'an empty box starts near the middle');
  assert.equal(stepRubric(5, 1, rub[0]), 5, 'never past max');
  assert.equal(stepRubric(1, -1, rub[0]), 1, 'never under min');
  assert.match(layerProblems(r)[0], /^Score A1 on Content, Organization, Delivery, Language, Overall\.$/);
  for (const e of r.entries) for (const c of rub) r = withRubric(r, e.id, c.id, 4, 1);
  r = withRubric(r, r.entries[1].id, 'overall', 'x', 1);
  assert.deepEqual(layerProblems(r), ['A2, Overall: Use a whole number from 1 to 5.']);
  r = withRubric(r, r.entries[1].id, 'overall', 2, 1);
  assert.deepEqual(layerProblems(r), []);
  assert.equal(rubricTotal(r.entries[1], rub), 18);
  assert.match(ranksBlock(r).text.split('\n')[1], /^A2\tContent 4\tOrganization 4\tDelivery 4\tLanguage 4\tOverall 2\tTotal 18 of 25\tOver time: No$/);
  const html = rubricHtml(r.entries[0], rub);
  assert.equal((html.match(/data-rub="plus"/g) || []).length, 5);
  assert.match(html, /Total 20 of 25/);
  assert.ok(printModel(r, DATA.events.get('dec'), 600).sections[1].head.some((h) => h.text === 'Rubric'));
});

// Why: a comments-only ballot (§2.4: critiqueOnly skips Rank) has nothing to rank; if the app still demanded ranks,
// the round could never reach "Copied" and the judge would think the ballot is unfinished.
test('critiqueOnly: no Rank stage, no ranks to copy, and the round is done when every comment is copied', () => {
  let r = mk('poi', 'comments-only', 2);
  assert.deepEqual(stages(r), ['judge', 'review']);
  assert.equal(rankModel(r), null);
  assert.equal(rankStageLabel(r.profile), '');
  assert.deepEqual(layerProblems(r), []);
  assert.equal(statusText(r), 'Comments open');
  assert.deepEqual(checklist(r).map((c) => c.label), ['0 of 2 comments']);
  assert.match(ranksStageHtml(r), /comments only/);
  assert.doesNotMatch(copyAllText(r, null), /\nRanks\n/);
  assert.match(rosterHtml(r, null), /A1/);
  for (const e of r.entries) r = updateEntry(r, e.id, (x) => Object.assign({}, x, { comment: 'Clear voice. Next time slow the ending.' }), 1);
  r = markCopied(r, r.entries[0].id, 5);
  assert.equal(r.state, 'review');
  r = markCopied(r, r.entries[1].id, 6);
  assert.equal(r.state, 'done', 'done with no ranks copied');
});

// ---------- level and panel ----------

// Why: elims and panels change what the judge must do (§2.6, §3.2); the frame must say so, and under a panel the
// overtime note must show, or a judge flags overtime alone that the panel should agree on first.
test('level and panel: the round keeps them, the frame shows them, and a panel adds the overtime note', () => {
  const pre = mk('oo', 'nsda-district', 3);
  assert.equal(pre.level, 'prelim');
  assert.equal(frameLine(pre), '', 'a prelim with one judge looks as before S4');
  assert.equal(frameHtml(pre), '');
  assert.equal(makePanel('1', 'x'), null, 'one judge is not a panel');
  const el = mk('oo', 'nsda-district', 3, { level: 'elim', panel: makePanel('3', 'Seats 1 to 3') });
  assert.equal(el.level, 'elim');
  assert.deepEqual(panelOf(el), { size: 3, note: 'Seats 1 to 3' });
  assert.equal(frameLine(el), 'Elim · Panel of 3 · Seats 1 to 3');
  assert.equal(overtimeNote(el), PANEL_OVERTIME_NOTE);
  assert.equal(PANEL_OVERTIME_NOTE, 'Panel: agree on overtime before you flag.');
  assert.equal(mk('oo', 'nsda-district', 1, { level: 'final' }).level, 'prelim', 'an unknown level is a prelim');
  // On the board, an over-grace row under a panel carries the note.
  let r = ranked(el);
  r = updateEntry(r, r.entries[1].id, (x) => Object.assign({}, x, { timing: Object.assign({}, x.timing, { overGrace: true, usedMs: 700000 }) }), 1);
  assert.match(boardHtml(r, { tapMode: false, limit: 600, now: 1 }), /Panel: agree on overtime before you flag\./);
  assert.match(problemsHtml(r), /Ready/, 'an over-grace entry at rank 2 is fine: the note is a reminder, not a block');
});

// ---------- cross-entry ----------

// Why: a cross-entered student is late, not absent (§3.1); marking them a no show would drop them from the ballot,
// and Next speaker must still come back to them after the others.
test('cross-entered: not a no show, stays on the board, and Next speaker comes back to it last', () => {
  let r = mk('oo', 'nsda-district', 3);
  const [a, b, c] = r.entries.map((e) => e.id);
  const res = markCrossEntered(r, b, 'In 204 for IX', 2);
  assert.equal(res.prev, 'waiting');
  r = res.room;
  assert.equal(r.entries[1].status, 'crossEntered');
  assert.equal(STATUS_LABEL.crossEntered, 'Cross-entered: speaks later');
  assert.equal(crossNote(r.entries[1]), 'In 204 for IX');
  assert.equal(present(r).length, 3, 'still on the board');
  assert.equal(nextWaiting(r).id, c, 'the waiting speaker goes first');
  r = updateEntry(updateEntry(r, a, (x) => Object.assign({}, x, { status: 'done' }), 3), c, (x) => Object.assign({}, x, { status: 'done' }), 3);
  assert.equal(nextWaiting(r).id, b, 'then the cross-entered one');
  assert.match(markCrossEntered(r, a, '', 4).refused, /not waiting/);
  r = clearCrossEntered(r, b, 5);
  assert.equal(r.entries[1].status, 'waiting');
  assert.equal('crossEntry' in r.entries[1], false);
  assert.match(rosterHtml(markCrossEntered(r, b, '', 6).room, b), /Cross-entered: speaks later[\s\S]*Back in the room/);
});

// ---------- the F2 cross-ex in elims ----------

// Why: §3.2 puts the extemp cross-ex in elims only; showing it in prelims or for non-extemp events would add a phase
// the rules do not have, and a same-school pair must be flagged before the questions start.
test('cross-ex shows only for F2 in elims with a cx profile; it chains the askers and warns on the same school', () => {
  const ix = DATA.events.get('ix');
  let r = mk('ix', 'elim-large', 3, { level: 'elim' });
  assert.equal(cxOn(r, ix), true);
  assert.equal(cxOn(mk('ix', 'elim-large', 3), ix), false, 'not in a prelim');
  assert.equal(cxOn(mk('ix', 'nsda-district', 3, { level: 'elim' }), ix), false, 'not without elim.cx in the rules');
  assert.equal(cxOn(mk('oo', 'elim-large', 3, { level: 'elim' }), DATA.events.get('oo')), false, 'not for an F1 event');
  assert.equal(cxLimit(r.profile), null, 'no cross-ex length is invented');
  const [a, b, c] = r.entries.map((e) => e.id);
  assert.equal(askerOf(r, b).id, a, 'asked by the speaker before');
  assert.equal(askerOf(r, a).id, c, 'the first speaker is asked by the last');
  r = setAsker(r, a, b, 1);
  assert.equal(askerOf(r, a).id, b);
  r = setSchool(setSchool(r, a, 'North High', 1), b, ' north  high ', 1);
  assert.match(sameSchoolWarning(r, a), /^Same school: A2 would ask A1\./);
  assert.equal(sameSchoolWarning(r, c), '');
  assert.match(crossExHtml(r, r.entries[0], ix, 1), /Q: asked by[\s\S]*Same school/);
  assert.equal(crossExHtml(mk('ix', 'elim-large', 3), r.entries[0], ix, 1), '', 'no part in a prelim');
  // The clock: one clock at a time for a speaker.
  const speaking = updateEntry(r, a, (x) => Object.assign({}, x, { timing: Object.assign({}, x.timing, { run: { endAt: 9e9, startLeft: 420 } }) }), 1);
  assert.match(startCx(speaking, a, 10).refused, /Stop the speech clock/);
  r = startCx(r, a, 10000).room;
  assert.equal(cxUsed(r.entries[0], 70000), 60000);
  r = stopCx(r, a, 100000);
  assert.equal(cxUsed(r.entries[0], 999999), 90000, 'a stopped clock does not grow');
  const done = updateEntry(r, a, (x) => Object.assign({}, x, { timing: Object.assign({}, x.timing, { usedMs: 400000 }) }), 1);
  assert.deepEqual(phases(done.entries[0], 420, null, 1).list.map((p) => p.state), ['done', 'done']);
  assert.deepEqual(phases(r.entries[1], 420, null, 1).list.map((p) => p.state), ['now', 'next']);
});

// Why: the draw gap is not confirmed (§3), so it is the judge's setting; a wrong or stuck "waiting" line would tell
// a judge to wait when the next speaker is already due.
test('the F2 waiting line follows the draw gap setting and goes away when the gap is over or a clock runs', () => {
  const ix = DATA.events.get('ix');
  let r = mk('ix', 'nsda-district', 2);
  const [a] = r.entries.map((e) => e.id);
  assert.equal(waitingLine(r, ix, 0, 7), '', 'no line before anyone speaks');
  r = updateEntry(r, a, (x) => Object.assign({}, x, { status: 'done', timing: Object.assign({}, x.timing, { usedMs: 400000, runs: [{ kind: 'speech', startedAt: 0, stoppedAt: 60000 }] }) }), 1);
  r = Object.assign({}, r, { current: r.entries[1].id });
  assert.equal(waitingLine(r, ix, 60000 + 30000, 7), 'Waiting for next speaker · about 7 min');
  assert.equal(waitingLine(r, ix, 60000 + 4 * 60000, 10), 'Waiting for next speaker · about 6 min');
  assert.equal(waitingLine(r, ix, 60000 + 7 * 60000, 7), '', 'the gap is over');
  const running = updateEntry(r, r.entries[1].id, (x) => Object.assign({}, x, { timing: Object.assign({}, x.timing, { run: { endAt: 9e9, startLeft: 420 } }) }), 1);
  assert.equal(waitingLine(running, ix, 90000, 7), '', 'a running clock means the speaker is here');
  assert.equal(waitingLine(r, DATA.events.get('oo'), 90000, 7), '', 'only extemp events draw outside');
  assert.equal(drawGapOf({ drawGapMin: 10 }), 10);
  assert.equal(drawGapOf({ drawGapMin: 8 }), 7, 'an unknown gap reads as 7');
  assert.equal(migrateSettings({}).drawGapMin, 7);
  assert.equal(withSetting({}, 'drawGapMin', 10).drawGapMin, 10);
  assert.equal(withSetting({}, 'drawGapMin', 8).drawGapMin, 7, 'only 7 or 10 can be saved');
});

// ---------- setup ----------

// Why: the presets are only useful if a judge can pick them; they must sit in their own group so the league rules
// stay first, and the level and panel fields must be on the form so §2.6's frame has data.
test('setup lists the ballot shapes in their own group and asks for the level and the panel', () => {
  assert.deepEqual(profileChoices(DATA).map((p) => p.id), ['nsda-district', 'nsda-invitational', 'custom']);
  assert.deepEqual(shapeChoices(DATA).map((p) => p.id), ['top-three', 'rate-only', 'rubric-five', 'comments-only', 'elim-large']);
  const html = setupHtml(DATA);
  assert.match(html, /<optgroup label="League rules">[\s\S]*<optgroup label="Other ballot shapes">[\s\S]*Rate only/);
  assert.match(html, /id="setup-level"[\s\S]*<option value="elim">Elim<\/option>/);
  assert.match(html, /id="setup-panel"[\s\S]*Panel of 5/);
});

// Why: the Room screen trusts the picker's "handled" answer to stop the browser's default; if Enter were claimed with
// nothing typed, a focused button would stop working, and if a typed number were dropped the pick would fail.
test('the number picker claims its keys only when they do something', async () => {
  const { createNumberPicker } = await import('./js/room-actions.js');
  const p = createNumberPicker();
  assert.deepEqual(p.run('numEnter', 12), { mine: true, handled: false, pick: null, hint: '', error: '' }, 'Enter with nothing typed is not claimed');
  assert.equal(p.run('num0', 12).handled, false, 'a lone 0 types nothing');
  assert.equal(p.run('num9', 6).handled, false, '9 in a room of 6 does nothing');
  assert.equal(p.run('pick3', 6).pick, 3, '1–8 still pick at once in a small room');
  const a = p.run('pick1', 12);
  assert.equal(a.handled, true); assert.match(a.hint, /Speaker 1/);
  p.run('pick1', 12);
  assert.equal(p.run('numEnter', 12).pick, 11);
  p.run('pick1', 12); p.run('pick5', 12);
  assert.match(p.run('numEnter', 12).error, /No speaker at place 15/);
  assert.equal(p.run('startStop', 12).mine, false, 'other keys pass through');
});
