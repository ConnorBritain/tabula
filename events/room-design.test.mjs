// Tests for the design build, Room and timer session (2026-11-24; docs/design/EVENTS-DESIGN-REVIEW.md §2.4–§2.7,
// top 10 #1, #2, #3 and #8, bug 1): the time track (js/time-track.js), the signal track and the sticky compact bar on
// the timer card (js/timer-view.js), the roster and rank row tracks, the quote line (js/quote-view.js), the folded
// piece line, the closed cross-ex block and the elim pills. Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadEventData } from './js/data.js';
import { createRoom, updateEntry, entryOf } from './js/room.js';
import { limitOf, timerFace, signalPoints } from './js/timer.js';
import { sharedFace } from './js/prep.js';
import { markNextRun, syncRuns, runsBarModel } from './js/runs.js';
import { trackModel, trackHtml, miniTrackHtml, piecesFor, tickLabel, zoneAt, trackLabel, overShown } from './js/time-track.js';
import { timerHtml, cardTrack, mainButton, stickyBarHtml, rosterTimeHtml, rowTrackLine } from './js/timer-view.js';
import { rosterRowHtml } from './js/room-screen.js';
import { boardHtml } from './js/rank-screen.js';
import { quoteKind, quoteHtml, rowQuoteHtml, ROW_QUOTE_MAX } from './js/quote-view.js';
import { shortText } from './js/question.js';
import { pieceHtml } from './js/piece-view.js';
import { crossExHtml } from './js/cross-ex-view.js';
import { frameHtml, makePanel, PANEL_FRAME_LINE } from './js/round-frame.js';
import { withRanks } from './js/board.js';
import { guideModel } from './js/guide.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const DATA = await loadEventData(async (p) => JSON.parse(read(p)));
const ev = (id) => DATA.events.get(id);
const prof = (id) => JSON.parse(JSON.stringify(DATA.profiles.get(id)));
let n = 0;
const makeId = (p) => p + (++n);
const room = (eventId, profileId, codes, extra) => createRoom(Object.assign({ event: ev(eventId), profile: prof(profileId || 'nsda-district'), entries: (codes || ['A1', 'B2', 'C3']).map((code) => ({ code })), round: 'R1', now: 1, makeId }, extra || {}));
const T = 1_800_000_000_000;
const done = (e, sec, over) => Object.assign({}, e, { status: 'done', timing: Object.assign({}, e.timing, { usedMs: sec * 1000, overGrace: Boolean(over), overLimit: false }) });
const running = (e, used, limit, now) => Object.assign({}, e, { status: 'speaking', timing: Object.assign({}, e.timing, { run: { kind: 'speech', endAt: now + (limit - used) * 1000, startLeft: limit - used } }) });
const pct = (html, cls) => Number((new RegExp('class="' + cls + '" style="left:([\\d.]+)%').exec(html) || [])[1]);

// ---------- the time track (D2-A, D3-A) ----------

// Why: the track is the event's own time budget; if the zones or the tick places were wrong, the judge would raise a
// signal card at the wrong moment or read a speech inside grace as over.
test('the track: speech, grace and over zones, a tick at each signal point, and the now dot at the time used', () => {
  const m = trackModel({ limit: 600, grace: 30, pieces: [{ sec: 300 }], points: signalPoints(600, 30) });
  assert.equal(m.span, 600 + 30 + overShown(30));
  assert.deepEqual(m.zones.map((z) => [z.kind, z.from, z.to]), [['speech', 0, 600], ['grace', 600, 630], ['over', 630, 660]]);
  assert.deepEqual(m.ticks.map((t) => t.pos), [300, 360, 420, 480, 540, 570, 600, 630], 'Show 5 at 5:00 used … grace end at 10:30');
  assert.deepEqual(m.ticks.map((t) => t.label), ['5', '4', '3', '2', '1', '0:30', '0', '+0:30']);
  assert.equal(m.now, 300);
  const html = trackHtml(m, { id: 'timer-track' });
  assert.equal(pct(html, 'track-now z-speech'), 45.45, '300 of 660 seconds');
  assert.match(html, /role="img" aria-label="Time track: 10:00 limit, then 0:30 grace\. Signals at 5 min left, .*time, end of grace\. 5:00 used\."/);
  // Labels: whole minutes and 0 only, so "0:30" and "+0:30" never sit on top of "0".
  assert.deepEqual([...html.matchAll(/class="track-tlabel"[^>]*>([^<]*)</g)].map((x) => x[1]), ['5', '4', '3', '2', '1', '0']);
  assert.equal((html.match(/class="track-tick"/g) || []).length, 8, 'every signal point keeps its tick');
  assert.deepEqual([tickLabel(120), tickLabel(30), tickLabel(0), tickLabel(-15)], ['2', '0:30', '0', '+0:15']);
});

// Why: an over-grace speech must not look like a 7:30 speech (review §2.4, the row says only "Done" today); and a
// time far past the end must not draw the dot off the track or past the row's edge.
test('the track: over grace reads as over, a long time pins to the end, and an empty track has no dot', () => {
  const over = trackModel({ limit: 600, grace: 30, pieces: [{ sec: 661 }] });
  assert.equal(zoneAt(over, 661), 'over');
  assert.equal(zoneAt(over, 615), 'grace');
  assert.equal(zoneAt(over, 450), 'speech');
  assert.match(miniTrackHtml(over), /class="track track-mini z-over"/);
  assert.match(trackLabel(over), /11:01 used, over grace\./);
  const far = trackModel({ limit: 600, grace: 30, pieces: [{ sec: 900 }] });
  assert.equal(far.now, far.span);
  assert.equal(far.past, true);
  assert.equal(pct(miniTrackHtml(far), 'track-now z-over'), 100);
  const empty = trackModel({ limit: 600, grace: 30, pieces: [{ sec: 0 }] });
  assert.equal(empty.now, null);
  assert.doesNotMatch(miniTrackHtml(empty), /track-now|track-fill/);
  assert.match(miniTrackHtml(empty), /is-empty/);
  assert.match(miniTrackHtml(over), /aria-hidden="true"/, 'the row says the time in words; the mini track is not read twice');
});

// Why: the same function feeds the timer card, the roster row and the rank row; if prep or a PCC run were left out,
// the IMP track would hide the prep the judge must see and the PCC track would not show the Pro and Con split.
test('the track pieces follow the family: prep then speech (IMP), one piece per run (PCC), one piece (others)', () => {
  const imp = ev('imp');
  const e = Object.assign({}, room('imp').entries[0], { timing: { run: null, runs: [], usedMs: 250_000, prepMs: 130_000 } });
  assert.deepEqual(piecesFor(e, imp, limitOf(imp), T), [{ sec: 130, kind: 'prep' }, { sec: 250 }]);
  const pcc = ev('pcc');
  const L = limitOf(pcc);
  const base = room('pcc', 'nsda-invitational', ['A1']).entries[0];
  const pro = syncRuns(running(base, 60, L, 70_000), pcc, 70_000, L);
  const con = markNextRun(pro, pcc, 70_000, L).entry;
  assert.deepEqual(piecesFor(con, pcc, L, 80_000), [{ sec: 60, kind: 'used' }, { sec: 10, kind: 'alt' }]);
  const hi = ev('hi');
  assert.deepEqual(piecesFor(done(room('hi').entries[0], 596), hi, limitOf(hi), T), [{ sec: 596 }]);
});

// ---------- the timer card: signal track, one phase control ----------

// Why: review §2.6 and §2.7: there must be one phase control on the card; two (pills and a bar) told the judge the
// same thing twice and pushed the clock down. The phase row now sits inside the track's box.
test('the card has the track and at most one phase row: none for HI, Prep then Speech for IMP, Pro then Con for PCC', () => {
  const hi = ev('hi');
  const he = room('hi').entries[0];
  const hf = timerFace(he, 600, 30, T);
  const hh = timerHtml(he, hf, 600, 30, cardTrack(he, hi, hf, 600, 30, T));
  assert.match(hh, /id="timer-track"/);
  assert.doesNotMatch(hh, /phase-steps|phase-bar/);
  const imp = ev('imp');
  const ie = Object.assign({}, room('imp').entries[0], { timing: { run: null, runs: [], usedMs: 0, prepMs: 45_000 } });
  const iface = sharedFace(ie, 420, 30, T);
  const ih = timerHtml(ie, iface, 420, 30, cardTrack(ie, imp, iface, 420, 30, T));
  assert.equal((ih.match(/class="phase-steps"/g) || []).length, 1);
  assert.match(ih, /id="timer-track"[\s\S]*aria-label="Prep, then speech"/, 'the phase row is inside the track box');
  assert.match(ih, /track-fill f-prep/, 'prep is the first piece of the shared track');
  const pcc = ev('pcc');
  const pe = room('pcc', 'nsda-invitational', ['A1']).entries[0];
  const pf = timerFace(pe, 630, 30, T);
  const ph = timerHtml(pe, pf, 630, 30, cardTrack(pe, pcc, pf, 630, 30, T, runsBarModel));
  assert.equal((ph.match(/class="phase-steps"/g) || []).length, 1);
  assert.match(ph, /aria-label="Pro, then Con"/);
  assert.match(ph, /class="phase-next">Next: Pro\./);
});

// ---------- the sticky compact bar (OD1 A) ----------

// Why: OD1's acceptance rule: the bar is a second render of the same state. Its one button must send the same action
// as the big button in every phase, or a tap in the bar would start prep when the big card says "Speech started".
test('sticky bar: its button sends the same action as the big button for F1, IMP (prep, then speech) and PCC', () => {
  const big = (html) => /class="b primary timer-go" type="button" data-tact="([a-z]+)"[^>]*>([^<]+)</.exec(html).slice(1);
  const bar = (html) => /id="timer-mini"[\s\S]*?data-tact="([a-z]+)">([^<]+)</.exec(html).slice(1);
  const cases = [];
  const hi = ev('hi');
  const he = room('hi').entries[0];
  cases.push([he, timerFace(he, 600, 30, T), hi, 600]);
  cases.push([running(he, 120, 600, T), timerFace(running(he, 120, 600, T), 600, 30, T), hi, 600]);
  const imp = ev('imp');
  const ie = room('imp').entries[0];
  for (const timing of [{ run: null, runs: [], usedMs: 0 }, { run: null, runs: [], usedMs: 0, prepRun: { kind: 'prep', endAt: T + 300_000, startLeft: 420 } }, { run: null, runs: [], usedMs: 90_000, prepMs: 60_000 }]) {
    const x = Object.assign({}, ie, { timing });
    cases.push([x, sharedFace(x, 420, 30, T), imp, 420]);
  }
  const pcc = ev('pcc');
  const pe = room('pcc', 'nsda-invitational', ['A1']).entries[0];
  cases.push([running(pe, 200, 630, T), timerFace(running(pe, 200, 630, T), 630, 30, T), pcc, 630]);
  const seen = new Set();
  for (const [e, face, event, lim] of cases) {
    const html = timerHtml(e, face, lim, 30, cardTrack(e, event, face, lim, 30, T));
    assert.deepEqual(bar(html), big(html), face.word);
    assert.deepEqual(bar(html), [mainButton(face).tact, mainButton(face).label]);
    seen.add(mainButton(face).tact);
  }
  assert.deepEqual([...seen].sort(), ['prep', 'speech', 'startstop'], 'every phase of the button was checked');
});

// Why: the bar must add no clock and no key: a second driver, tick or Space binding would let two clocks run or a
// Space press count twice (review §2.4 risk "Med"). The bar's button has no data-key, so the focus and the Space
// rule still find the big button first.
test('sticky bar: no new driver, tick or key in the code, no data-key on its button, and Next speaker after a stop', () => {
  const src = read('js/timer-view.js');
  assert.equal((src.match(/createDriver\(/g) || []).length, 2, 'the speech driver and the prep driver, as before');
  assert.doesNotMatch(src, /setInterval|requestAnimationFrame|addEventListener\('keydown'/);
  const keys = read('js/keys.js');
  assert.equal((keys.match(/action: 'startStop'/g) || []).length, 1, 'Space stays the one startStop entry');
  const e = done(room('hi').entries[0], 300);
  const face = timerFace(e, 600, 30, T);
  const html = stickyBarHtml(face, cardTrack(e, ev('hi'), face, 600, 30, T));
  assert.doesNotMatch(html, /data-key=/);
  assert.match(html, /data-act="next">Next speaker</);
  assert.match(html, /id="tm-digits" aria-hidden="true"/);
  assert.doesNotMatch(stickyBarHtml(timerFace(room('hi').entries[0], 600, 30, T), null), /Next speaker/, 'no Next before any time');
  assert.doesNotMatch(timerHtml(e, face, 600, 30), /timer-mini/, 'no track given: no bar');
  // In the card: the big button comes before the bar (so a lookup of [data-tact="startstop"] finds the big one), and
  // the bar sits inside #timer-box, so the one click handler on the box serves both buttons.
  const card = timerHtml(e, face, 600, 30, cardTrack(e, ev('hi'), face, 600, 30, T));
  assert.ok(card.indexOf('class="b primary timer-go"') < card.indexOf('id="timer-mini"'));
  assert.ok(card.startsWith('<div class="timer-box" id="timer-box">') && card.trimEnd().endsWith('</div></div>') && card.indexOf('id="timer-mini"') > 0);
  assert.equal((card.match(/data-key="startstop"/g) || []).length, 1, 'one button owns the startstop key');
  // The CSS shows it only on a narrow screen and only while the big card is out of view (the .is-on class).
  const css = read('app.css');
  assert.match(css, /\n\.timer-mini \{ display: none; \}/);
  assert.match(css, /@media \(max-width: 820px\) \{\n  \.timer-mini\.is-on \{ display: flex;/);
});

// ---------- roster and rank rows (D3-A, review §2.4 changes 5 and 6) ----------

// Why: a speaking row that also shows a time truncates the name ("Ava Bro…"), and an over-grace row must say so in
// words next to its track, or C33 and F21 still look the same.
test('roster row: no time while speaking, the mini track and "Over grace" under the name once there is time', () => {
  const r = room('hi');
  const speaking = Object.assign({}, r.entries[0], { status: 'speaking' });
  assert.equal(rosterTimeHtml(speaking, 42), '');
  assert.match(rosterTimeHtml(done(r.entries[0], 596), 596), />9:56</);
  const over = done(r.entries[1], 661, true);
  const line = rowTrackLine(over, 661, '<span class="track track-mini z-over"></span>');
  // CHANGED 2026-11-24 because the owner approved EVENTS-COLOR-ICON-REVIEW.md (D2-A status tints with words and icons; top 10 #4: no solid status pills). Old line:
  //   assert.match(line, /track-mini z-over[\s\S]*<span class="pill err">Over grace<\/span>/);
  assert.match(line, /track-mini z-over[\s\S]*<span class="pill err"><svg class="i i-14" aria-hidden="true" focusable="false"><use href="#i-triangle-alert"\/><\/svg>Over grace<\/span>/);
  assert.equal(rowTrackLine(speaking, 42, 'x'), '');
  assert.equal(rowTrackLine(done(r.entries[2], 0), 0, 'x'), '', 'no time: no track');
  const row = rosterRowHtml(r, over, 2, false, () => '<span class="row-time">11:01</span>', () => line);
  assert.match(row, /<span class="row-main">[^]*?class="row-track"[^]*?Over grace<\/span><\/span><\/span>\s*<span class="row-time">/, 'the line sits inside the name block, before the time');
});

// Why: the rank board is where the judge compares speakers; the same mini track there lets an over-grace speech be
// seen before the judge tries to rank it first.
test('rank board rows show the same mini track, over grace in the over zone', () => {
  let r = room('hi');
  r = updateEntry(r, r.entries[0].id, (e) => done(e, 596), 1);
  r = updateEntry(r, r.entries[1].id, (e) => done(e, 661, true), 1);
  r = withRanks(r, {});
  const html = boardHtml(r, { tapMode: false, limit: 600, event: ev('hi'), now: 1 });
  assert.match(html, /A1[\s\S]*?track-mini z-speech/);
  assert.match(html, /B2[\s\S]*?track-mini z-over/);
  assert.equal((html.match(/track-mini/g) || []).length, 2, 'C3 has no time and no track');
});

// ---------- the quote line (review §2.5, §2.6, §2.7; top 10 #8) ----------

// Why: the question (extemp) or topic (IMP, PCC) is what the judge compares at rank time; it must be at the top of the
// card and in the roster, and an event with neither must show no empty field.
test('quote line: question for USX, topic for IMP and PCC, nothing for HI; filled shows a quote, empty a field', () => {
  assert.equal(quoteKind(ev('usx')).field, 'question');
  assert.equal(quoteKind(ev('imp')).field, 'topic');
  assert.equal(quoteKind(ev('pcc')).field, 'topic');
  assert.equal(quoteKind(ev('hi')), null);
  const e = room('usx').entries[0];
  assert.match(quoteHtml(e, ev('usx'), false), /id="question"[^>]*placeholder="The question the speaker drew"/);
  const q = Object.assign({}, e, { question: 'Is the <b>Fed</b> done?' });
  assert.match(quoteHtml(q, ev('usx'), false), /class="quote-line"><span class="sr-only">Question drawn: <\/span>“Is the &lt;b&gt;Fed&lt;\/b&gt; done\?”/);
  assert.match(quoteHtml(q, ev('usx'), false), /data-qact="edit"/);
  assert.equal(quoteHtml(Object.assign({}, q, { status: 'noShow' }), ev('usx'), false), '');
  const topic = Object.assign({}, room('imp').entries[0], { topic: 'A penny saved is a penny earned' });
  assert.match(rowQuoteHtml(topic, ev('imp')), /class="row-quote"[^>]*>“A penny saved is a penny earned”/);
  assert.match(quoteHtml(room('pcc', 'nsda-invitational', ['A1']).entries[0], ev('pcc'), false), /placeholder="The student's topic"/);
  assert.doesNotMatch(quoteHtml(room('pcc', 'nsda-invitational', ['A1']).entries[0], ev('pcc'), false), /field-help/, 'the long help text went to the Guide');
  assert.equal(guideModel(ev('pcc'), prof('nsda-district')).topic, ev('pcc').topic.hint, 'the Guide now holds that help text');
  assert.equal(guideModel(ev('hi'), prof('nsda-district')).topic, '');
  // The quote view comes first in both room screens, so the line sits above the timer (review §2.5 change 1).
  const app = read('js/app.js');
  assert.match(app, /judge: createRoomScreen\(env, \[createQuoteView\(\), createTimerView\(\), createPieceView\(\),/);
  assert.match(app, /judge: createRoomScreen\(env, \[createQuoteView\(\), \.\.\.createRunsParts\(\),/);
});

// Why: a roster row has little room; a long question must show its first words with "…", never a word cut in half
// and never the whole page-long paste.
test('shortText keeps whole words and adds "…"', () => {
  assert.equal(shortText('Is the Fed done?', 48), 'Is the Fed done?');
  assert.equal(shortText('Should the US expand its role in the Arctic Council given new shipping lanes?', ROW_QUOTE_MAX), 'Should the US expand its role in the Arctic…');
  assert.equal(shortText('Supercalifragilistic', 5), 'Super…');
  assert.equal(shortText('  a   b  ', 10), 'a b');
  assert.equal(shortText(null, 10), '');
});

// ---------- piece fields, cross-ex, elim pills ----------

// Why: the judge fills the piece once, at the intro (review §2.4 change 3); filled fields that stay open push the
// comment box down for the whole speech, and an empty field that folded away could not be filled.
test('piece fields: filled ones fold into one line with Edit, empty ones stay open, Edit opens all', () => {
  const di = ev('di');
  const e = Object.assign({}, room('di').entries[0], { title: 'Office Hours', author: 'K. Wu' });
  const folded = pieceHtml(e, di, false);
  assert.match(folded, /class="piece is-folded"[\s\S]*Office Hours · K\. Wu[\s\S]*data-pact="edit"/);
  assert.doesNotMatch(folded, /<input/);
  const half = pieceHtml(Object.assign({}, e, { author: '' }), di, false);
  assert.match(half, /Office Hours/);
  assert.match(half, /id="piece-author"/);
  assert.doesNotMatch(half, /id="piece-title"/);
  assert.match(pieceHtml(e, di, true), /id="piece-title"[\s\S]*id="piece-author"/);
});

// Why: review §2.5 change 3: the cross-ex block doubles the controls during the 7-minute speech; it must stay closed
// (one phase row and one line) until the speech stops, and it uses the shared phase renderer, not pills of its own.
test('cross-ex is closed during the speech and opens after it, with the shared phase row', () => {
  const ix = ev('ix');
  let r = room('ix', 'elim-large', ['A1', 'B2', 'C3'], { level: 'elim' });
  const a = r.entries[0].id;
  const closed = crossExHtml(r, entryOf(r, a), ix, 1);
  assert.match(closed, /class="crossex is-closed"/);
  assert.match(closed, /It opens when the speech stops\./);
  assert.doesNotMatch(closed, /cx-asker|Start cross-ex/);
  r = updateEntry(r, a, (x) => Object.assign({}, x, { timing: Object.assign({}, x.timing, { usedMs: 300_000 }) }), 1);
  const open = crossExHtml(r, entryOf(r, a), ix, 1);
  assert.match(open, /id="cx-phases"[\s\S]*class="phase is-done" data-phase="speak"[\s\S]*Start cross-ex/);
  assert.doesNotMatch(open + closed, /class="phase-bar"/);
});

// Why: review §2.5 change 2: "Elim · Panel of 3 · 3 judges Panel: agree…" repeated the number and ran two sentences
// together; the facts must read at a glance as pills, with one plain sentence.
test('elim frame: the facts as pills and one sentence under them', () => {
  const r = room('ix', 'elim-large', ['A1', 'B2', 'C3'], { level: 'elim', panel: makePanel('3', 'Seats 1 to 3') });
  const html = frameHtml(r);
  assert.match(html, /<span class="pill outline">Elim<\/span> <span class="pill outline">Panel of 3<\/span> <span class="muted round-frame-note">Seats 1 to 3<\/span>/);
  assert.match(html, new RegExp('<p class="muted round-frame-line">' + PANEL_FRAME_LINE.replace('.', '\\.') + '</p>'));
  assert.equal((html.match(/3/g) || []).length, 2, '"Panel of 3" and "Seats 1 to 3" only');
  assert.equal(frameHtml(room('ix')), '');
});

// ---------- bug 1: the phone room fits the screen ----------

// Why: bug 1 (review §5): at 390 px the page was 408 px wide, so it slid sideways under the judge's thumb. The cause is
// grid items (the chip rows) that keep their min-content width; these rules let them shrink and scroll in their row.
// Limit: Node has no layout, so this guards that the rules stay. The width itself was measured in the browser at 390 px
// (scrollWidth 390 with the rules, 408 with them turned off) for HI, USX, IMP and PCC, room and rank, light and dark.
test('bug 1: the room CSS lets the stage and sheet children shrink and keeps text boxes inside the screen', () => {
  const css = read('app.css');
  assert.match(css, /\.stage > \*, \.sheet > \*, \.chip-group, \.chk-group \{ min-width: 0; \}/);
  assert.match(css, /\.stage textarea, \.stage input, \.stage select \{ max-width: 100%; \}/);
  assert.match(css, /\.chips \{ flex-wrap: nowrap; overflow-x: auto;/, 'the chips still scroll inside their own row');
});
