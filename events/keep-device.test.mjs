// Tests for keeping the judge's device copy safe: the shared core files wired into Speech Events, the "may delete"
// banner and the "Add to Home Screen" sheet on My day, the backup reminder on Congress-only days, the "Save as PDF"
// last step on the Review screen, the version.json header and the new style sheet. Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pageFiles } from './build-sw.mjs';
import { ALLOW } from '../build-events.mjs';
import { askToKeepOnce, storageKept, PERSIST_ASKED_KEY } from './js/store.js';
import { storageKept as coreStorageKept } from '../core/keep-data.js';
import { lastChangeAt, backupReminderDue, eventsDayOver, congressDay } from './js/settings.js';
import { INSTALL_HINT_KEY, KEEP_BANNER_KEY, sheetDue, bannerDue, keepBannerHtml, installSheetHtml } from './js/install-sheet.js';
import { installHint } from '../core/install-hint.js';
import { mydayHtml } from './js/myday-screen.js';
import { makeDay, makeCard, submitCard, mydayModel, withStandby } from './js/cards.js';
import { dayOf } from './js/rooms.js';
import { loadEventData } from './js/data.js';
import { createRoom, updateEntry } from './js/room.js';
import { openBoard, withRanks } from './js/board.js';
import { setNotes, setPrivateNote } from './js/comments.js';
import { cards, markCopied, printModel } from './js/ballot.js';
import { saveStageHtml, nextCopy, summaryHtml } from './js/review-screen.js';
import { printSheetHtml } from '../core/sheets.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const NOW = new Date(2026, 10, 14, 17, 0).getTime();
const TODAY = dayOf(NOW);
const IPHONE = { ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1', platform: 'iPhone', maxTouchPoints: 5 };
const ANDROID = { ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.6312.99 Mobile Safari/537.36', platform: 'Linux armv81', maxTouchPoints: 5 };

// ---------- the version.json header ----------

// Why: a stale version.json makes Settings show the old release after a deploy, so a judge who reports a problem names the wrong build, and a fix looks like it never shipped.
test('events/_headers never lets a browser or proxy store version.json', () => {
  const h = read('_headers');
  const rule = /^\/version\.json\n((?:[ \t]+.*\n?)+)/m.exec(h);
  assert.ok(rule, 'a /version.json rule');
  assert.match(rule[1], /^\s+Cache-Control: no-cache, no-store, max-age=0, must-revalidate\s*$/m);
  assert.doesNotMatch(rule[1], /^\s+Cache-Control: no-cache\s*$/m, 'the old no-cache-only value');
  assert.equal(rule[1].match(/Cache-Control/g).length, 1, 'one Cache-Control line');
});

// ---------- the new style sheet ships ----------

// Why: a style sheet the page links but the offline cache or the build leaves out shows the banner and the sheet unstyled with no internet at a tournament.
test('install.css is linked from the page, cached offline and shipped by the build', async () => {
  assert.match(read('index.html'), /<link rel="stylesheet" href="install\.css">/);
  assert.ok((await pageFiles()).includes('events/install.css'), 'in the offline cache list');
  assert.match(read('sw-files.js'), /"install\.css"/, 'in the generated sw-files.js');
  assert.ok(ALLOW.includes('events/install.css'), 'in the build allowlist');
  assert.doesNotMatch(read('install.css'), /#[0-9a-f]{3,8}\b/i, 'colors come from the shared tokens');
});

// ---------- the store wrappers ----------

// Why: other events files import these from store.js; if the move to core/ changed the key, every judge would be asked to keep the data again, and a backup restore would lose the "asked" mark.
test('store.js still asks once under tabulaEvents.persistAsked.v1, through core/keep-data.js', async () => {
  const m = new Map();
  const store = { get: (k, d) => (m.has(k) ? m.get(k) : d), set: (k, v) => { m.set(k, v); return true; } };
  const nav = { storage: { persisted: async () => false, persist: async () => true } };
  assert.equal(PERSIST_ASKED_KEY, 'tabulaEvents.persistAsked.v1');
  assert.equal(await askToKeepOnce(store, () => 42, nav), 'kept');
  assert.equal(m.get(PERSIST_ASKED_KEY), 42);
  assert.equal(await askToKeepOnce(store, () => 43, nav), 'asked-before');
  assert.equal(await storageKept(nav), await coreStorageKept(nav));
  assert.match(read('js/store.js'), /from '\.\.\/\.\.\/core\/keep-data\.js'/);
});

// ---------- the "may delete" banner ----------

// Why: a warning on every visit teaches judges to ignore it; no warning when the browser really may delete the data loses a tournament's ballots. 'unknown' is not a reason to alarm a parent judge.
test('the banner shows only on a real "may-clear" answer, not installed, not dismissed today', () => {
  const base = { kept: 'may-clear', standalone: false, dismissedDay: null, now: NOW };
  assert.equal(bannerDue(base), true);
  assert.equal(bannerDue({ ...base, kept: 'unknown' }), false);
  assert.equal(bannerDue({ ...base, kept: 'kept' }), false);
  assert.equal(bannerDue({ ...base, standalone: true }), false, 'an installed app keeps its data');
  assert.equal(bannerDue({ ...base, dismissedDay: TODAY }), false, 'dismissed today');
  assert.equal(bannerDue({ ...base, dismissedDay: dayOf(NOW - 86400e3) }), true, 'back the next day');
  assert.match(KEEP_BANNER_KEY, /^tabulaEvents\./);
});

// Why: the banner must give the judge a way out of the risk (a backup) and, on iPhone, the steps to keep the data.
test('the banner says it plainly and offers Download a backup, How to keep it and Not today', () => {
  const html = keepBannerHtml(true);
  assert.match(html, /<section class="md-keep" aria-labelledby="md-keep-h">/);
  assert.match(html, /may delete your saved rounds/);
  assert.match(html, /id="md-keep-backup">Download a backup</);
  assert.match(html, /id="md-keep-how">How to keep it</);
  assert.match(html, /id="md-keep-later">Not today</);
  assert.doesNotMatch(keepBannerHtml(false), /md-keep-how/, 'no hint for this browser: no "How to keep it"');
  const m = mydayModel({ day: null, cards: [], rounds: [], now: NOW, ranksDueMin: 10 });
  const page = mydayHtml(m, null, new Map(), NOW, [], null, false, html);
  assert.ok(page.indexOf('md-keep') < page.indexOf('md-empty'), 'the banner is at the top of My day');
  assert.doesNotMatch(mydayHtml(m, null, new Map(), NOW, [], null, false), /md-keep/);
});

// ---------- the "Add to Home Screen" sheet ----------

// Why: Safari on iPhone deletes the data after about 7 days without a visit; the sheet is the judge's warning. It must not nag (at most once a day, never after "Don't show again") and must not show where it cannot help.
test('the sheet opens by itself only on iPhone and iPad Safari, once a day, until "Don\'t show again"', () => {
  const hint = installHint(IPHONE);
  const base = { hint, standalone: false, pref: null, now: NOW };
  assert.equal(sheetDue(base), true);
  assert.equal(sheetDue({ ...base, standalone: true }), false, 'already on the Home Screen');
  assert.equal(sheetDue({ ...base, hint: null }), false, 'iPhone Chrome or an in-app browser');
  assert.equal(sheetDue({ ...base, hint: installHint(ANDROID) }), false, 'Android is not opened by itself');
  assert.equal(sheetDue({ ...base, pref: { snoozedDay: TODAY, never: false } }), false, 'closed today');
  assert.equal(sheetDue({ ...base, pref: { snoozedDay: dayOf(NOW - 86400e3), never: false } }), true, 'back the next day');
  assert.equal(sheetDue({ ...base, pref: { snoozedDay: null, never: true } }), false, '"Don\'t show again"');
  assert.match(INSTALL_HINT_KEY, /^tabulaEvents\./);
});

// Why: a lay parent judge follows these words on a phone in a hallway; the steps and the 7-day reason must be there, in an ordered list, and a judge with rounds saved must learn that the Home Screen app starts with its own copy.
test('the sheet holds the 3 Safari steps, the 7-day reason, and the backup note when rounds are saved', () => {
  const hint = installHint(IPHONE);
  const html = installSheetHtml(hint, { hasWork: false, auto: true });
  assert.match(html, /<h2 id="ins-title">Add Speech Events to your Home Screen<\/h2>/);
  assert.match(html, /<div id="ins-body">/);
  assert.equal((html.match(/<li>/g) || []).length, 3);
  assert.match(html, /<ol class="ins-steps"><li>Tap the Share button/);
  assert.match(html, /about 7 days/);
  assert.match(html, /data-ins="never">Don't show again</);
  assert.match(html, /aria-label="Close"/);
  assert.doesNotMatch(html, /Rounds already saved/);
  const withWork = installSheetHtml(hint, { hasWork: true, auto: false });
  assert.match(withWork, /Rounds already saved here stay in Safari/);
  assert.match(withWork, /data-ins="backup">Download a backup</);
  assert.doesNotMatch(withWork, /data-ins="never"/, 'opened by the judge: no "Don\'t show again"');
});

// Why: a dialog without a role, a label, focus moving in and back, and Esc leaves a screen-reader user stuck behind an invisible sheet. The sheet is built on core/ui.js modalDialog, which traps focus, returns it, and closes on Esc.
test('the sheet is a labelled modal dialog built on modalDialog (focus in and back, Esc closes)', () => {
  const src = read('js/install-sheet.js');
  assert.match(src, /setAttribute\('role', 'dialog'\)/);
  assert.match(src, /setAttribute\('aria-modal', 'true'\)/);
  assert.match(src, /setAttribute\('aria-labelledby', 'ins-title'\)/);
  assert.match(src, /env\.ui\.modalDialog\(wrap, card,/);
  assert.match(src, /dialog\.open\(card\.querySelector\('\.ask-btns \.primary'\)\)/, 'focus moves to the sheet\'s main button');
  assert.match(read('../core/ui.js'), /escLayer\(o\.name \|\| 'modal'/, 'modalDialog registers Esc');
});

// ---------- the backup reminder on Congress-only days ----------

const sess = (over) => Object.assign({ id: 's1', chamberId: 'ch1', number: 1, startedAt: NOW - 3 * 3600e3, speeches: [], poTerms: [], ranks: [], recency: [] }, over);
const congress = (sessions, chamberAt = NOW - 4 * 3600e3) => ({ v: 1, chambers: [{ id: 'ch1', house: 'house', tournament: 'Fall Classic', createdAt: chamberAt, legislators: [], docket: [], sessionIds: sessions.map((s) => s.id) }], sessions, prefs: {} });
const emptyModel = () => mydayModel({ day: null, cards: [], rounds: [], now: NOW, ranksDueMin: 10 });

// Why: a Congress judge's ranks and speech scores live only on this device too; before this change a Congress-only day never got the reminder, so those ballots had no nudge to a backup.
test('a Congress-only day gets the reminder once every session today is handed in', () => {
  const open = congress([sess({})]);
  const done = congress([sess({ copiedAt: NOW - 3600e3 })]);
  assert.deepEqual(congressDay(open, NOW).map((c) => c.open), [true]);
  assert.deepEqual(congressDay(done, NOW).map((c) => c.open), [false]);
  const due = (state) => backupReminderDue({ model: emptyModel(), chambers: congressDay(state, NOW), lastChange: lastChangeAt([], [], state), lastBackupAt: null, dismissedAt: null });
  assert.equal(due(open), false, 'a session still open');
  assert.equal(due(done), true, 'ranks copied: the day is over');
  assert.equal(due(congress([sess({ submittedAt: NOW - 3600e3 })])), true, 'marked submitted counts too');
  assert.equal(due(congress([])), false, 'a chamber made today with no session yet is still open');
  assert.equal(due(congress([sess({ copiedAt: NOW - 3600e3 }), sess({ id: 's2', number: 2, startedAt: NOW - 1800e3 })])), false, 'a second session still open');
  assert.equal(backupReminderDue({ model: emptyModel(), chambers: congressDay(done, NOW), lastChange: lastChangeAt([], [], done), lastBackupAt: NOW - 3600e3 }), false, 'a backup since the hand-in');
});

// Why: the reminder must still wait while a speech ballot is to judge or the judge is on standby, even if Congress is done.
test('the day is not over while a ballot is left or the judge is on standby, whatever Congress says', () => {
  const day = makeDay({ date: TODAY, now: NOW - 9 * 3600e3, makeId: () => 'd1' });
  const card = makeCard({ day, event: 'oo', tournament: 'Fall Classic', round: 'Round 1', now: NOW - 8 * 3600e3, makeId: () => 'c1' });
  const done = congressDay(congress([sess({ copiedAt: NOW - 3600e3 })]), NOW);
  assert.equal(eventsDayOver({ model: mydayModel({ day, cards: [card], rounds: [], now: NOW, ranksDueMin: 10 }), chambers: done }), false, 'a ballot still to start');
  assert.equal(eventsDayOver({ model: mydayModel({ day, cards: [submitCard(card, NOW - 60e3)], rounds: [], now: NOW, ranksDueMin: 10 }), chambers: done }), true, 'ballot submitted and Congress handed in');
  assert.equal(eventsDayOver({ model: mydayModel({ day: withStandby(day, true, NOW), cards: [], rounds: [], now: NOW, ranksDueMin: 10 }), chambers: done }), false, 'on standby');
  assert.equal(eventsDayOver({ model: emptyModel(), chambers: [] }), false, 'nothing today');
  assert.equal(eventsDayOver({ model: emptyModel(), chambers: [{ id: 'x', label: 'House' }] }), false, 'a chamber with no open flag counts as open');
});

// Why: "Not now" and "backed up" compare against the last change; if Congress changes did not count, a judge who backed up before the last session would never be reminded about it.
test('lastChangeAt counts Congress time stamps (session start, ranks copied, submitted)', () => {
  assert.equal(lastChangeAt([], [], congress([sess({})])), NOW - 3 * 3600e3);
  assert.equal(lastChangeAt([], [], congress([sess({ copiedAt: NOW - 3600e3, submittedAt: NOW - 1800e3 })])), NOW - 1800e3);
  assert.equal(lastChangeAt([{ updatedAt: NOW }], [], congress([sess({})])), NOW, 'rounds still count');
  assert.equal(lastChangeAt([], [], null), 0);
  assert.equal(lastChangeAt([], [], { chambers: 'x', sessions: [null, 5] }), 0, 'damaged values read as nothing');
});

// Why: My day must read the Congress state for the reminder; if it fell back to labels only, Congress days lose it again.
test('My day reads the Congress state for the reminder', () => {
  const src = read('js/myday-screen.js');
  assert.match(src, /congressDay\(cong, env\.now\(\)\)/);
  assert.match(src, /lastChangeAt\(rounds, cards, cong\)/);
});

// ---------- Save as PDF, the last step on the Review screen ----------

const DATA = await loadEventData(async (p) => JSON.parse(read(p)));
const EXP = DATA.events.get('exp');
const prof = (id) => JSON.parse(JSON.stringify(DATA.profiles.get(id)));
function judged() {
  let r = openBoard(createRoom({ event: EXP, profile: prof('nsda-district'), entries: [{ code: 'A12', name: 'Sam Rivera' }, { code: 'B07', name: 'Jo Park' }], round: 'Round 2', tournament: 'Fall Classic', now: 1 }), 2).room;
  const id = (code) => r.entries.find((e) => e.code === code).id;
  r = withRanks(r, { [id('A12')]: '1', [id('B07')]: '2' }, 3);
  for (const code of ['A12', 'B07']) r = updateEntry(r, id(code), (e) => setNotes(e, code + ': strong open.'), 4);
  return Object.assign({}, r, { reasonForRank: 'A12 had the clearest close.' });
}

// Why: after the ranks and comments are copied, the judge's last chance to keep a copy is the PDF; it must be the one clear next step then, and not compete with a copy step before that.
test('"Save as PDF" is the last stage and the primary button only once everything is copied', () => {
  let r = judged();
  const before = saveStageHtml(r, nextCopy(r, cards(r, 'speaking')));
  assert.match(before, /<h2 id="stage-save">3\. Save a copy<\/h2>/);
  assert.match(before, /<button class="b" type="button" data-vact="print" data-key="print-save">[\s\S]*Save as PDF<\/button>/);
  r = markCopied(r, 'ranks', 5);
  for (const c of cards(r, 'speaking')) r = markCopied(r, c.id, 6);
  r = markCopied(r, 'reason', 7);
  assert.equal(nextCopy(r, cards(r, 'speaking')), '');
  const after = saveStageHtml(r, '');
  assert.match(after, /<button class="b primary" type="button" data-vact="print"/);
  assert.match(after, /All copied\./);
  assert.match(after, /choose "Save as PDF"/);
  assert.match(summaryHtml(r), /Print \/ PDF/, 'the toolbar button stays');
});

// Why: a ballot left on a shared computer must not expose student names or the judge's private note.
test('the print sheet holds codes and the judge\'s words, not student names or private notes', () => {
  const privateNote = 'PRIVATE_NOTE_PDF_SENTINEL';
  let r = judged();
  r = updateEntry(r, r.entries[0].id, (e) => setPrivateNote(e, privateNote), 5);
  const html = printSheetHtml(printModel(r, EXP, 300));
  assert.match(html, /A12/);
  assert.match(html, /A12: strong open\./);
  assert.match(html, /A12 had the clearest close\./);
  assert.doesNotMatch(html, /Sam Rivera|Jo Park/);
  assert.doesNotMatch(html, /PRIVATE_NOTE_PDF_SENTINEL/);
  assert.doesNotMatch(html, /tabulaEvents|apiKey|sk-/);
});

// Why: on iPhone the storage answer arrives while the sheet is open; redrawing then removed the element focus returns to, so a screen-reader judge was dropped on the page body when the sheet closed.
test('My day waits for the sheet to close before redrawing, then focuses the title', () => {
  const src = read('js/myday-screen.js');
  assert.match(src, /if \(sheet\.isOpen\(\)\) \{ redrawAfterSheet = true; return; \}/);
  assert.match(src, /redrawAfterSheet = false;\s*draw\(null\);/, 'draw(null) focuses #screen-title');
  assert.match(read('js/install-sheet.js'), /onClose: \(\) => \{ snooze\(\); if \(afterClose\) afterClose\(\); \}/);
});

// Why: telling a judge "All copied." when nothing was copied could send them home without handing in a ballot.
test('"All copied." shows only after something was copied', () => {
  const r = judged();
  const blank = Object.assign({}, r, { ranksCopiedAt: null, reasonCopiedAt: null, entries: r.entries.map((e) => Object.assign({}, e, { commentCopiedAt: null })) });
  assert.doesNotMatch(saveStageHtml(blank, ''), /All copied/);
  assert.match(saveStageHtml(markCopied(r, 'ranks', 5), ''), /All copied/);
});
