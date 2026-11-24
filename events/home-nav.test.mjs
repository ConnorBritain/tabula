// Tests for the "Home and navigation" design build (docs/design/EVENTS-DESIGN-REVIEW.md §2.1–§2.3, §2.11–§2.15, §3
// items 4, 9 and 10, §4 OD2 and OD3, §5 bugs 2, 3, 4, 7 and 9). Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { loadEventData } from './js/data.js';
import { createRoom } from './js/room.js';
import { dayOf } from './js/rooms.js';
import { makeDay, makeCard, cardStatus, mydayModel, duePill, roomText, upNextItem, withStandby } from './js/cards.js';
import { mydayHtml, itemView } from './js/myday-screen.js';
import { setupHtml, previewHtml, eventChoices } from './js/setup-screen.js';
import { parseRoom } from './js/parse.js';
import { paletteRows, GROUP_ORDER } from './js/palette.js';
import { historyRows, historyColumns } from './js/history.js';
import { historyTableHtml } from './js/history-screen.js';
import { pickerListHtml } from './js/picker-screen.js';
import { pickerRows, pickerSections } from './js/picker.js';
import { setupHtml as chamberSetupHtml } from './congress/chamber-screen.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const DATA = await loadEventData(async (p) => JSON.parse(read(p)));
const NOW = new Date(2026, 10, 24, 14, 0, 0).getTime();
let n = 0;
const mk = (p) => p + 'hn' + (++n);
const DAY = makeDay({ date: dayOf(NOW), now: NOW - 3600000, makeId: () => 'd1' });
const card = (eventId, over) => Object.assign(makeCard({ day: DAY, event: DATA.events.get(eventId), round: 'Round 1', now: NOW - 1000, makeId: mk }), over || {});
function round(eventId, profileId, over) {
  const r = createRoom({ event: DATA.events.get(eventId), profile: DATA.profiles.get(profileId), entries: [{ code: 'A1' }, { code: 'B2' }], round: 'Round 1', now: NOW - 1800000, makeId: mk });
  return Object.assign(r, over || {});
}

// ---------- bug 9: a copied round must not say "Judging" ----------

// Why: a judge who sees "Judging" on a round they already copied goes back into it, or thinks the ballot never left;
// a copied round must read as copied, whatever an old card or an old record says.
test('bug 9: a copied round is never "Judging", even when its card says judging', () => {
  const said = card('oo', { status: 'judging' });
  const copied = round('oo', 'rate-only', { state: 'done', copiedAt: NOW - 60000, ranksCopiedAt: NOW - 120000 });
  assert.notEqual(cardStatus(said, copied), 'judging', 'copied with the ranks mark');
  const oldCopied = round('oo', 'rate-only', { state: 'done', copiedAt: NOW - 60000 }); // copied before ranksCopiedAt existed (E8)
  assert.notEqual(cardStatus(said, oldCopied), 'judging', 'copied, from a record with no ranks mark');
});

// ---------- My day: "Up next", compact rows, the "⋯" menu, ranks due in words, the room as typed ----------
function spoken(r, stop) {
  return Object.assign({}, r, { entries: r.entries.map((e) => Object.assign({}, e, { status: 'done', timing: Object.assign({}, e.timing, { usedMs: 60000, runs: [{ kind: 'speech', startedAt: stop - 120000, stoppedAt: stop }] }) })) });
}

// Why: a judge typed "Room 214"; "Room Room 214" looks broken and makes them doubt the room they are walking to.
test('bug 3: the room shows as typed, with "Room" added only to a bare number', () => {
  assert.equal(roomText('Room 214'), 'Room 214');
  assert.equal(roomText('214'), 'Room 214');
  assert.equal(roomText(' 12b '), 'Room 12b');
  assert.equal(roomText('Library'), 'Library');
  assert.equal(roomText(''), '');
  assert.equal(roomText(null), '');
  const v = itemView({ card: card('hi', { roomLabel: 'Room 214' }), round: null, status: 'notStarted', word: 'Not started', due: null }, DATA.events);
  assert.doesNotMatch(v.meta, /Room Room/);
  assert.match(v.meta, /Room 214/);
});

// Why: "Ranks due in 1:39" read as code, and as 1 hour 39 or 1 minute 39; a late ballot must look late in words, not
// only in a color.
test('ranks due is a pill in words: minutes, caution at 2 minutes, then late', () => {
  assert.deepEqual(duePill(NOW + 7 * 60000 + 20000, NOW), { text: 'Ranks due in 8 min', tone: '' });
  assert.deepEqual(duePill(NOW + 3 * 60000, NOW), { text: 'Ranks due in 3 min', tone: '' });
  assert.deepEqual(duePill(NOW + 2 * 60000, NOW), { text: 'Ranks due in 2 min', tone: 'caution' });
  assert.deepEqual(duePill(NOW + 10000, NOW), { text: 'Ranks due in 1 min', tone: 'caution' });
  assert.deepEqual(duePill(NOW - 20000, NOW), { text: 'Ranks due now', tone: 'late' });
  assert.deepEqual(duePill(NOW - 3 * 60000 - 5000, NOW), { text: 'Ranks 3 min late', tone: 'late' });
  assert.equal(duePill(null, NOW), null);
  for (const p of [duePill(NOW + 60000, NOW), duePill(NOW - 600000, NOW)]) assert.doesNotMatch(p.text, /\d:\d/, 'no clock digits');
});

// Why: with three flights the home must answer "which room now?" in one glance; the round being judged wins over a
// later one, and with nothing being judged the next round to start is the one to show.
test('Up next is the round being judged, else a copied one, else the first later round', () => {
  const r1 = round('hi', 'nsda-district'), r2 = round('oo', 'nsda-district', { ranksCopiedAt: 5, state: 'review' });
  const judging = card('hi', { roundId: r1.id }), copied = card('oo', { roundId: r2.id, createdAt: NOW - 5000 }), later = card('di');
  const m = mydayModel({ day: DAY, cards: [copied, judging, later], rounds: [r1, r2], now: NOW });
  assert.equal(upNextItem(m).card.id, judging.id);
  const m2 = mydayModel({ day: DAY, cards: [copied, later], rounds: [r2], now: NOW });
  assert.equal(upNextItem(m2).card.id, copied.id);
  const m3 = mydayModel({ day: DAY, cards: [later, card('hi', { createdAt: NOW })], rounds: [], now: NOW });
  assert.equal(upNextItem(m3).card.id, later.id);
  assert.equal(upNextItem(mydayModel({ day: DAY, cards: [], rounds: [], now: NOW })), null);
});

// Why: the Up next card must be the one big target with one primary button, and it must not also show again as a row,
// or the judge sees two copies of one round and wonders which is real.
test('My day draws one Up next card with one primary step, and the other rounds as compact rows', () => {
  const r1 = round('hi', 'nsda-district', { entries: round('hi', 'nsda-district').entries.map((e, i) => Object.assign({}, e, { status: i === 0 ? 'done' : 'waiting' })) });
  const judging = card('hi', { roundId: r1.id, roomLabel: '214' }), later = card('di', { round: 'Round 3' });
  const m = mydayModel({ day: DAY, cards: [judging, later], rounds: [r1], now: NOW });
  const html = mydayHtml(m, DAY, DATA.events, NOW, []);
  assert.equal((html.match(/class="md-next-card"/g) || []).length, 1);
  assert.equal((html.match(/data-item="c:/g) || []).length, 2, 'each round once: the card, and one row');
  assert.match(html, /class="b primary md-go" href="#\/round\/[^"]+">Continue</);
  assert.equal((html.match(/class="b primary/g) || []).length, 1, 'one primary button on the screen');
  assert.match(html, /1 of 2 done/);
  assert.match(html, /Room 214/);
  assert.match(html, /class="md-row"[^>]*>[\s\S]*?href="#\/start\/c/, 'the later row opens its start');
});

// Why: "Cancel round" sat next to "Open" and was easy to tap by mistake on a phone; it must live behind "⋯", last.
test('Change room and Cancel round live in the "⋯" menu, closed until opened, with Cancel last', () => {
  const later = card('di');
  const m = mydayModel({ day: DAY, cards: [card('hi'), later], rounds: [], now: NOW });
  const shut = mydayHtml(m, DAY, DATA.events, NOW, []);
  assert.doesNotMatch(shut, /data-act="cancel"|data-act="room"/, 'no rare step until the menu opens');
  // CHANGED 2026-11-24 because the owner approved EVENTS-COLOR-ICON-REVIEW.md (§5.3: Lucide icons replace the text marks). Old line:
  //   assert.match(shut, /data-act="menu" aria-expanded="false" aria-label="More for DI Round 1">⋯</);
  assert.match(shut, /data-act="menu" aria-expanded="false" aria-label="More for DI Round 1"><svg class="i i-20" aria-hidden="true" focusable="false"><use href="#i-ellipsis"\/><\/svg></);
  const open = mydayHtml(m, DAY, DATA.events, NOW, [], 'c:' + later.id);
  assert.match(open, /aria-expanded="true"/);
  assert.match(open, /data-act="room">Change room<\/button>\s*<button[^>]*data-act="cancel">Cancel round<\/button><\/div>/, 'Cancel is the last item');
  assert.equal((open.match(/data-act="cancel"/g) || []).length, 1, 'only the opened item shows its menu');
  const done = mydayModel({ day: withStandby(DAY, false, NOW), cards: [card('hi', { status: 'cancelled' })], rounds: [], now: NOW });
  assert.doesNotMatch(mydayHtml(done, DAY, DATA.events, NOW, []), /data-act="menu"/, 'a cancelled round has nothing to change');
});

// Why: the countdown pill is what tells a judge their ballot is late; it must show on the round being judged.
test('the ranks-due pill shows on Up next once every speaker has spoken', () => {
  const r = spoken(round('hi', 'nsda-district'), NOW - 60000);
  const m = mydayModel({ day: DAY, cards: [card('hi', { roundId: r.id })], rounds: [r], now: NOW, ranksDueMin: 10 });
  assert.match(mydayHtml(m, DAY, DATA.events, NOW, []), /<span class="pill md-due" data-due="\d+">Ranks due in 9 min<\/span>/);
});

// ---------- OD3 A: the green Speech Events mark, in the header only ----------

// Why: OD3 allows the brand green in one place only; if it leaked into a button, pill or outline, color would start to
// carry meaning in the chrome, which DESIGN.md §3 and BRAND.md §7 forbid.
test('OD3: the header shows the green mark next to the name, and the greens appear nowhere else in the app', () => {
  const html = read('index.html');
  const bar = html.slice(html.indexOf('<header class="bar">'), html.indexOf('</header>'));
  assert.match(bar, /<a class="brand" href="#\/"><svg class="brand-mark"[^>]*aria-hidden="true"[^>]*>[\s\S]*fill="#1e7a55"[\s\S]*fill="#5ec796"[\s\S]*fill="currentColor"[\s\S]*<\/svg><span>Tabula Speech Events<\/span><\/a>/);
  const outside = html.replace(bar, '');
  assert.doesNotMatch(outside, /#1e7a55|#5ec796/i, 'no green outside the header');
  const files = ['app.css', 'congress/congress.css', ...readdirSync(new URL('./js/', import.meta.url)).filter((f) => f.endsWith('.js')).map((f) => 'js/' + f),
    ...readdirSync(new URL('./congress/', import.meta.url)).filter((f) => f.endsWith('.js')).map((f) => 'congress/' + f)];
  for (const f of files) assert.doesNotMatch(read(f), /#1e7a55|#5ec796/i, f + ' uses no brand green');
});

// ---------- setup: live preview beside the paste box, rare fields under a disclosure ----------

// Why: the judge must see each parsed entry and the doubtful lines while pasting, before the round starts; a parse
// mistake found after the first speaker is a wrong ballot.
test('setup: the preview counts the entries and the lines to check, and shows each name and title', () => {
  const p = parseRoom('Code\tName\tTitle\nA12\tAna Lee\tThe Raven\nB07\tBo Ng\tIf\n???');
  const html = previewHtml(p);
  assert.match(html, /<p class="muted pv-count">2 entries found( · \d+ to check)?<\/p>/);
  assert.match(html, /<span class="code">A12<\/span> <span class="pv-name">Ana Lee<\/span> <span class="muted pv-title">The Raven<\/span>/);
  const k = parseRoom('A12\nB07 C33 x').check.length;
  assert.ok(k > 0);
  assert.match(previewHtml(parseRoom('A12\nB07 C33 x')), new RegExp('<h3>Check these \\(' + k + '\\)</h3>'));
  assert.match(previewHtml(parseRoom('')), /Paste the room and each entry shows here/);
});

// Why: level, judges and panel note are rare; on the form's first screen they pushed the paste box below the fold.
test('setup: Level, Judges in the room and Panel note sit in a closed "Elim or panel?" disclosure, and the preview sits beside the paste box', () => {
  const html = setupHtml(DATA);
  const more = html.slice(html.indexOf('<details class="setup-more" id="setup-more">'), html.indexOf('</details>'));
  assert.match(more, /<summary>Elim or panel\?<\/summary>/);
  for (const id of ['setup-level', 'setup-panel', 'setup-panel-note']) assert.match(more, new RegExp('id="' + id + '"'), id + ' is in the disclosure');
  assert.doesNotMatch(more, /<details[^>]* open/, 'closed for a prelim');
  assert.match(html, /<div class="setup-paste-area">\s*<div class="setup-paste-col">[\s\S]*id="setup-paste"[\s\S]*<\/div>\s*<div class="preview" id="setup-preview"/);
});

// ---------- bug 4: the palette shows each group once ----------

// Why: "Go to" and "New" showed twice, so a judge scanning for a command read the list twice; the rounds of the day
// are the common pick, so they come first.
test('bug 4: palette groups each show once, in a fixed order with Rounds first, and a round row names its room and state', () => {
  const r = round('hi', 'nsda-district', { roomLabel: '214', state: 'ranking' });
  const rows = paletteRows({ events: DATA.events, choices: eventChoices(DATA), rooms: [r], undo: 'Undo: delete R1' });
  const runs = rows.map((x) => x.group).filter((g, i, a) => g !== a[i - 1]);
  assert.deepEqual(runs, GROUP_ORDER.filter((g) => runs.includes(g)), 'one run per group, in order');
  assert.deepEqual(runs, ['Undo', 'Rounds', 'Go to', 'New', 'Guide']);
  assert.ok(rows.some((x) => x.id === 'go-chambers' && x.group === 'Go to'));
  assert.equal(rows.find((x) => x.id === 'open-' + r.id).hint, 'Room 214 · Ranking');
});

// ---------- History: row menu, state pills ----------

// Why: "Delete" was the loudest word on every row; one slip on a phone deletes a ballot. It must sit behind "⋯".
test('History: Delete sits in a hidden "⋯" menu, the state is a pill, and Comments open is a pill only when true', () => {
  const open = round('hi', 'nsda-district', { ranksCopiedAt: 1, state: 'review' }), done = round('oo', 'nsda-district', { state: 'done', ranksCopiedAt: 1 });
  const rows = historyRows([open, done], DATA.events);
  const cols = historyColumns(rows, {});
  assert.ok(!cols.some((c) => c.key === 'commentsOpen'), 'no Comments open column');
  const html = historyTableHtml(rows, cols);
  // CHANGED 2026-11-24 because the owner approved EVENTS-COLOR-ICON-REVIEW.md (§5.3: Lucide icons replace the text marks). Old line:
  //   assert.match(html, /<button class="iconbtn hist-more-btn" type="button" data-more aria-expanded="false" aria-label="More for HI Round 1 from [^"]+">⋯<\/button><div class="hist-menu" role="group" aria-label="[^"]+" hidden><button[^>]*data-del=/);
  assert.match(html, /<button class="iconbtn hist-more-btn" type="button" data-more aria-expanded="false" aria-label="More for HI Round 1 from [^"]+"><svg class="i i-20" aria-hidden="true" focusable="false"><use href="#i-ellipsis"\/><\/svg><\/button><div class="hist-menu" role="group" aria-label="[^"]+" hidden><button[^>]*data-del=/);
  assert.equal((html.match(/>Comments open</g) || []).length, 1, 'only the open round has the pill');
  assert.match(html, /<span class="pill solid">Review<\/span> <span class="pill">Comments open<\/span>/);
  assert.match(html, /<span class="pill outline">Copied<\/span>/);
});

// ---------- picker: "Guide" button, readable chips ----------

// Why: an italic "i" with no word did not tell a first-time parent it opens the Guide; all-caps mono chips read as code.
test('picker: each row has a "Guide" text button and plain grey chips, Congress too', () => {
  const html = pickerListHtml(pickerSections(pickerRows(DATA), [], ''));
  assert.doesNotMatch(html, />i<\/a>/);
  // CHANGED 2026-11-24 because the owner approved EVENTS-COLOR-ICON-REVIEW.md (§5.3: Lucide icons replace the text marks). Old line:
  //   assert.match(html, /<a class="b small quiet pk-guide" href="#\/type\/hi" aria-label="Guide for Humorous Interpretation">Guide<\/a>/);
  assert.match(html, /<a class="b small quiet pk-guide" href="#\/type\/hi" aria-label="Guide for Humorous Interpretation"><svg class="i i-16" aria-hidden="true" focusable="false"><use href="#i-book-open"\/><\/svg>Guide<\/a>/);
  assert.match(html, /<span class="pill outline pk-chip">Rank<\/span><span class="pill outline pk-chip">Title<\/span><span class="pill outline pk-chip">10:00<\/span>/);
  assert.doesNotMatch(html, /POINTS\/SPEECH|TIMER /);
  assert.match(html, /pk-chip">Points per speech</);
});

// ---------- bug 7: Congress setup layout ----------

// Why: radios above their words and a "Role" label with no control made the chamber form look broken and unclear.
test('bug 7: House or Senate is a segmented pair with each word on its option, and Role is one line with its space', () => {
  const html = chamberSetupHtml({});
  assert.match(html, /<label class="seg-opt"><input type="radio" name="cg-house" value="house" checked><span>House<\/span><\/label><label class="seg-opt"><input type="radio" name="cg-house" value="senate"><span>Senate<\/span><\/label>/);
  assert.match(html, /<p class="cg-role"><span class="cg-role-k">Role:<\/span> Scorer <span class="muted">\(parliamentarian tools come later\)<\/span><\/p>/);
  assert.doesNotMatch(html, /<span>Role<\/span>/, 'no label without a control');
});
