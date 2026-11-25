// Tests for the design build of 2026-11-24, color, icons and hierarchy (docs/design/EVENTS-COLOR-ICON-REVIEW.md; owner
// picks D1 B, D2 A, D3 A, D4 B, D5 A): the control ladder (§5.1), one solid fill per view, status tints with words,
// the room primary that moves with the state, the stopped timer card, the ballot and private zones, the open prompts,
// the sticky ballot footer, the Lucide sprite (§5.3), the one chevron fold style (§5.4) and D5-A on My day.
// Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { ICONS, ICON_ONLY, icon, iconButton, spriteHtml } from './js/icons.js';
import { loadEventData } from './js/data.js';
import { createRoom, updateEntry } from './js/room.js';
import { dayOf } from './js/rooms.js';
import { openBoard, withRanks, withRating } from './js/board.js';
import { setNotes } from './js/comments.js';
import { markCopied, cards } from './js/ballot.js';
import { makeDay, makeCard, mydayModel } from './js/cards.js';
import { mydayHtml, roundPill } from './js/myday-screen.js';
import { historyRows, historyColumns } from './js/history.js';
import { historyTableHtml } from './js/history-screen.js';
import { ranksStageHtml, commentsStageHtml, nextCopy } from './js/review-screen.js';
import { rosterRowHtml, statusPill } from './js/room-screen.js';
import { problemsHtml } from './js/rank-screen.js';
import { problemTarget, rateRowPill, ballotProgress, ballotFootHtml } from './js/ballot-status.js';
import { offlineHtml } from './js/settings-screen.js';
import { ratingScale } from './js/rank.js';
import { roomPrimary, goRankHtml, nextTopHtml } from './js/room-primary.js';
import { timerHtml, cardTrack, stickyBarHtml, stoppedResult } from './js/timer-view.js';
import { timerFace } from './js/timer.js';
import { sharedFace } from './js/prep.js';
import { runCardsHtml, nextRunWaits } from './js/runs-view.js';
import { sheetHtml, reasonFootHtml, promptsHtml, PROMPTS_SHOWN } from './js/comment-view.js';
import { checklist } from './js/ballot.js';
import { setupHtml, previewHtml, levelSummary } from './js/setup-screen.js';
import { parseRoom } from './js/parse.js';
import { settingsHtml } from './js/settings-screen.js';
import { foldSummaryHtml } from './js/fold.js';
import { toggleCheck } from './js/comments.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const CSS = read('./app.css');
const DATA = await loadEventData(async (p) => JSON.parse(read(p)));
const prof = (id) => JSON.parse(JSON.stringify(DATA.profiles.get(id)));
const NOW = new Date(2026, 10, 24, 14, 0, 0).getTime();
let n = 0;
const makeId = (p) => p + 'ci' + (++n);
const room = (eventId, profileId, codes, extra) => createRoom(Object.assign({ event: DATA.events.get(eventId), profile: prof(profileId || 'nsda-district'), entries: (codes || ['A1', 'B2', 'C3']).map((code) => ({ code })), round: 'Round 1', now: NOW - 1800000, makeId }, extra || {}));
const idOf = (r, code) => r.entries.find((e) => e.code === code).id;
const withEntry = (r, code, fn) => updateEntry(r, idOf(r, code), fn, NOW);
// The solid shapes in a piece of HTML: every element whose class makes it the solid primary fill.
const primaries = (html) => (html.match(/class="[^"]*\bprimary\b[^"]*"/g) || []).length;

// ---------- the control ladder and the repairs (§5.1, §4 "also do now") ----------

// Why: DESIGN.md §1.1 keeps every control neutral; without accent-color the Settings radios and the setup check boxes
// draw in the browser's blue, the one brand-like color a judge sees on a control.
test('radios and check boxes use the neutral accent, not the browser blue', () => {
  assert.match(CSS, /input\[type="radio"\], input\[type="checkbox"\] \{ accent-color: var\(--accent\); \}/);
});

// Why: the review found the Rank, Rate and Review shots with no green mark; OD3 puts the mark in the header of every
// route. If the mark moved into a screen's own markup, the screens that do not draw it would lose the brand.
test('the green header mark sits in the page header, outside the screen area, so every route shows it', () => {
  const html = read('./index.html');
  const header = html.slice(html.indexOf('<header class="bar">'), html.indexOf('</header>'));
  assert.match(header, /class="brand-mark"/);
  assert.doesNotMatch(html.slice(html.indexOf('<div id="screen">')), /brand-mark/);
});

// Why: the ladder says a solid control keeps a visible ring (§5.1 rule 2); a ring with no gap on a dark fill disappears
// for a keyboard judge in dark mode, who then cannot see which button Enter will press.
test('a solid primary gets a panel gap inside its focus ring', () => {
  assert.match(CSS, /button\.b\.primary:focus-visible \{ outline: 2px solid var\(--ring\); outline-offset: 2px; box-shadow: 0 0 0 2px var\(--panel\); \}/);
});

// ---------- the Lucide sprite (§5.3, the four Tier-1 icon tests) ----------

// Every page source that draws markup: the events modules, the Congress modules and the page shell.
const SOURCES = [
  ...readdirSync(new URL('./js/', import.meta.url)).filter((f) => f.endsWith('.js')).map((f) => ['js/' + f, read('./js/' + f)]),
  ...readdirSync(new URL('./congress/', import.meta.url)).filter((f) => f.endsWith('.js')).map((f) => ['congress/' + f, read('./congress/' + f)]),
  ['index.html', read('./index.html')],
];
// Every <svg class="i ..."> tag in a piece of HTML text.
const iconTags = (html) => html.match(/<svg class="i\b[^>]*>/g) || [];

// Why (test 1): an icon sits next to a word that already says what it means; an icon a screen reader can reach reads
// as "image" or as its path, so a blind judge hears noise on every button.
test('icons: every svg.i is aria-hidden, from icon() and in the page shell', () => {
  for (const name of Object.keys(ICONS)) for (const size of [14, 16, 20]) assert.match(icon(name, size), /^<svg class="i i-\d+" aria-hidden="true" focusable="false">/);
  for (const [f, src] of SOURCES) {
    if (f === 'js/icons.js') continue;
    for (const tag of iconTags(src)) assert.match(tag, /aria-hidden="true"/, f + ': ' + tag);
    // Outside icons.js and the static page shell, icons come only from icon(), never a hand-written tag.
    if (f !== 'index.html') assert.equal(iconTags(src).length, 0, f + ' writes an <svg class="i"> by hand; use icon()');
  }
  assert.match(spriteHtml(), /^<svg id="icon-sprite"[^>]* aria-hidden="true"/);
});

// Why (test 2): an icon with no word is a guess for most judges; the review allows only six well-known ones (back,
// more, close, drag, rank up, rank down), and each must have a spoken name or a screen reader says "button".
test('icons: an icon-only button has an aria-label and uses one of the six allowed icons', () => {
  assert.deepEqual([...ICON_ONLY].sort(), ['chevron-down', 'chevron-left', 'chevron-up', 'ellipsis', 'grip-vertical', 'x']);
  for (const name of ICON_ONLY) {
    const html = iconButton(name, 'More for HI Round 1', 'iconbtn', 'data-act="menu"');
    assert.match(html, /^<button class="iconbtn" type="button" data-act="menu" aria-label="More for HI Round 1"><svg class="i i-20"/);
    assert.match(html, /aria-label="More for HI Round 1"/);
    assert.match(html, new RegExp('#i-' + name + '"'));
  }
  // A name off the list draws the label as a word instead of a lone icon.
  assert.equal(iconButton('copy', 'Copy all', 'b'), '<button class="b" type="button" aria-label="Copy all">Copy all</button>');
  // In the code: the "⋯" menus and the rank moves go through iconButton, never a hand-written lone icon.
  for (const f of ['js/myday-screen.js', 'js/room-screen.js', 'js/history-screen.js']) assert.match(read('./' + f), /iconButton\('ellipsis'/, f);
  assert.match(read('./js/rank-screen.js'), /iconButton\('chevron-up'[\s\S]*iconButton\('chevron-down'/);
  // In the code: a button whose only content is an icon (no word beside it) has an aria-label, and the icon is allowed.
  for (const [f, src] of SOURCES) {
    for (const m of src.matchAll(/<button\b([^>]*)>\s*\$\{icon\('([a-z-]+)'[^}]*\}\s*<\/button>/g)) {
      assert.match(m[1], /aria-label="/, f + ': an icon-only button without aria-label: ' + m[0]);
      assert.ok(ICON_ONLY.includes(m[2]), f + ': "' + m[2] + '" may not stand alone on a button');
    }
  }
});

// Why (test 3): a name the sprite does not hold draws nothing; a judge then sees a button with a gap where the cue was,
// and no error ever says so.
test('icons: every icon name the code uses and every #i-* reference exists in the sprite', () => {
  const sprite = spriteHtml();
  let seen = 0;
  for (const [f, src] of SOURCES) {
    for (const m of src.matchAll(/\bicon(?:Button)?\('([a-z-]+)'/g)) { seen++; assert.ok(m[1] in ICONS, f + ': no icon "' + m[1] + '"'); }
    for (const m of src.matchAll(/href="#i-([a-z-]+)"/g)) { seen++; assert.ok(sprite.includes('id="i-' + m[1] + '"'), f + ': no symbol i-' + m[1]); }
  }
  assert.ok(seen > 20, 'the screens use the sprite');
  // And no symbol ships unused (every judge downloads the sprite). Names may come from maps ('live', 'circle-dashed')
  // or a choice (running ? 'pause' : 'play'), so any quoted use counts. "x" stays for the six-icon allowlist.
  const used = SOURCES.filter(([f]) => f !== 'js/icons.js').map(([, src]) => src).join('\n');
  for (const name of Object.keys(ICONS)) if (name !== 'x') assert.ok(used.includes("'" + name + "'") || used.includes('#i-' + name + '"'), 'unused icon: ' + name);
  assert.equal(icon('no-such-icon'), '');
});

// Why (test 4): DESIGN.md §1.1 and BRAND.md §7 keep brand color off controls; an icon with its own hex would put a
// fixed color in the chrome that ignores the dark theme and could look like a status.
test('icons: no icon has a hard-coded color; they draw in currentColor', () => {
  for (const [name, body] of Object.entries(ICONS)) {
    assert.doesNotMatch(body, /#[0-9a-f]{3,8}\b|rgb|hsl|(?:fill|stroke)="(?!none)/i, name);
  }
  assert.match(CSS, /svg\.i \{[^}]*fill: none; stroke: currentColor;/);
});

// Why: the review's open risk — on a dead school Wi-Fi the service worker serves only the files it listed; if the
// sprite module were not listed, every icon on every screen would vanish offline.
test('icons: the sprite module is a static import the service worker caches', () => {
  assert.match(read('./js/app.js'), /^import \{ mountSprite \} from '\.\/icons\.js';$/m);
  assert.match(read('./sw-files.js'), /"js\/icons\.js"/);
});

// ---------- one solid fill per view (top 10 #4) and status tints with words (D2-A) ----------

// Why: the review's root finding — one dark fill did seven jobs, so the eye could not find the next step. Only the
// primary action and the D4-B number cells may be solid; any other rule that paints the solid fill brings it back.
test('fill budget: only the primary, the number cells, the signal card and data bars paint the solid fill', () => {
  const ALLOWED = [/^(a|button)\.b\.primary(:hover|:active)?$/, /^\.pick\.on$/, /^\.rate-word\.on$/, /^\.cg-cell\.on$/, /^\.signal-chip$/, /^\.track-fill$/];
  for (const file of ['./app.css', './congress/congress.css']) {
    const css = read(file).replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (!/background:\s*var\(--(text|accent|accent-hover|accent-press)\)/.test(m[2])) continue;
      for (const sel of m[1].split(',').map((x) => x.trim()).filter(Boolean)) {
        assert.ok(ALLOWED.some((re) => re.test(sel)), `${file}: "${sel}" paints the solid fill`);
      }
    }
  }
});

// Why: My day showed 9 solid shapes (Continue and 8 "Judging" pills), so the one step that matters did not stand out.
// With many rounds in progress the screen must still have exactly one solid shape: the Up next card's main button.
test('My day: many rounds in progress, one solid shape; status pills are tints with a word and an icon', () => {
  const DAY = makeDay({ date: dayOf(NOW), now: NOW - 3600000, makeId: () => 'd1' });
  const rounds = [], list = [];
  for (const ev of ['hi', 'di', 'oo', 'poi', 'inf', 'dec']) {
    const r = room(ev, 'nsda-district');
    const c = Object.assign(makeCard({ day: DAY, event: DATA.events.get(ev), round: 'Round 1', now: NOW - 1000, makeId }), { roundId: r.id, status: 'judging' });
    rounds.push(Object.assign(r, { cardId: c.id, state: 'judging' })); list.push(c);
  }
  const html = mydayHtml(mydayModel({ day: DAY, cards: list, rounds, now: NOW }), DAY, DATA.events, NOW, []);
  assert.equal(primaries(html), 1, 'one solid shape');
  assert.doesNotMatch(html, /pill solid/);
  assert.match(html, /<span class="pill live"><svg class="i i-14"[^>]*><use href="#i-circle-dashed"\/><\/svg>Judging<\/span>/);
  assert.match(roundPill({ status: 'submitted', word: 'Submitted' }), /^<span class="pill ok"><svg class="i i-14"[^>]*><use href="#i-circle-check"\/><\/svg>Submitted<\/span>$/);
});

// Why: Review HI had 5 equal solid buttons; a judge could not tell which copy came next, and a missed copy means a
// comment that never reaches the student. Exactly one copy step is solid, and it walks: ranks, each comment, reason.
test('Review: only the next copy step is solid, and copied steps go quiet with "Copied"', () => {
  let r = openBoard(room('hi', 'nsda-district', ['A12', 'B07']), NOW).room;
  r = withRanks(r, { [idOf(r, 'A12')]: '1', [idOf(r, 'B07')]: '2' }, NOW);
  for (const code of ['A12', 'B07']) r = withEntry(r, code, (e) => setNotes(e, code + ' was clear.'));
  r = Object.assign({}, r, { reasonForRank: 'A12 was clearer.' });
  const view = (x) => ranksStageHtml(x) + commentsStageHtml(x, { order: 'speaking', editing: null });
  const step = (x) => nextCopy(x, cards(x, 'speaking'));
  assert.equal(step(r), 'ranks');
  assert.equal(primaries(view(r)), 1);
  assert.match(view(r), /class="b primary" type="button" data-vact="copy" data-what="ranks"/);
  r = markCopied(r, 'ranks', NOW);
  assert.equal(step(r), idOf(r, 'A12'));
  assert.equal(primaries(view(r)), 1);
  assert.match(view(r), /id="ranks-state"><svg[^>]*><use href="#i-circle-check"\/><\/svg>Copied<\/span>/);
  assert.match(view(r), new RegExp('class="b primary" type="button" data-vact="copy" data-what="' + idOf(r, 'A12') + '"'));
  r = markCopied(markCopied(r, idOf(r, 'A12'), NOW), idOf(r, 'B07'), NOW);
  assert.equal(step(r), 'reason');
  assert.match(view(r), /class="b quiet" type="button" data-vact="copy" data-what="[^"]+" data-key="copy-[^"]+"><svg[^>]*><use href="#i-check"\/><\/svg>Copied</);
  r = markCopied(r, 'reason', NOW);
  assert.equal(step(r), '');
  assert.equal(primaries(view(r)), 0, 'all copied: nothing left to press');
  assert.match(commentsStageHtml(r, { order: 'speaking', editing: null }), /class="order-toggle seg-track"/);
});

// Why: on Review OO the blocker sat under the table as a plain card with an outlined button, so judges tried to copy
// first. A blocked copy says "Not ready" in caution above the table, and its way back is the one primary.
test('Review: a blocked copy is a caution "Not ready" above the table, Back to Rate is the one primary, missing ratings say so', () => {
  let r = room('oo', 'rate-only', ['A12', 'B07']);
  r = withRating(r, idOf(r, 'A12'), '8', NOW);
  r = withEntry(r, 'A12', (e) => setNotes(e, 'Clear.'));
  const html = ranksStageHtml(r) + commentsStageHtml(r, { order: 'speaking', editing: null });
  assert.equal(primaries(html), 1);
  assert.ok(html.indexOf('Not ready') < html.indexOf('<table'), 'the blocker comes before the table');
  assert.match(html, /<div class="problems caution" role="status"><h3><span class="pill caution">[\s\S]*?Not ready<\/span>/);
  assert.match(html, /<a class="b primary" href="#\/rank\/[^"]+"><svg[^>]*><use href="#i-chevron-left"\/><\/svg>Back to Rate<\/a>/);
  assert.match(html, /<span class="pill caution">No rating<\/span>/);
});

// Why: on the roster "Done" and "Waiting" looked alike, so the judge could not see who is next; but a green "Done"
// beside "Over grace" would read as "all fine". The current row needs a word, because a tint alone is 1.06:1 in dark.
test('roster: Done is green with a check, Done over grace keeps a neutral check, Speaking is a tint, the current row says Now', () => {
  let r = room('hi', 'nsda-district', ['A1', 'B2', 'C3']);
  r = withEntry(r, 'A1', (e) => Object.assign({}, e, { status: 'done', timing: Object.assign({}, e.timing, { usedMs: 500000 }) }));
  r = withEntry(r, 'B2', (e) => Object.assign({}, e, { status: 'done', timing: Object.assign({}, e.timing, { usedMs: 700000, overGrace: true }) }));
  r = withEntry(r, 'C3', (e) => Object.assign({}, e, { status: 'speaking' }));
  const e = (code) => r.entries.find((x) => x.code === code);
  assert.match(statusPill(e('A1')), /^<span class="pill ok"><svg[^>]*><use href="#i-circle-check"\/><\/svg>Done<\/span>$/);
  assert.match(statusPill(e('B2')), /^<span class="pill"><svg[^>]*><use href="#i-check"\/><\/svg>Done<\/span>$/);
  assert.match(statusPill(e('C3')), /^<span class="pill live"><svg[^>]*><use href="#i-circle-play"\/><\/svg>Speaking<\/span>$/);
  const cur = Object.assign({}, r, { current: e('C3').id });
  assert.match(rosterRowHtml(cur, e('C3'), 3, false), /<span class="pill" data-now>Now<\/span>/);
  assert.doesNotMatch(rosterRowHtml(cur, e('A1'), 1, false), /data-now/);
  // "Now" sits on its own line after the status, outside the name block, so the name keeps its width.
  assert.match(rosterRowHtml(cur, e('C3'), 3, false), /Speaking<\/span><span class="row-now"><span class="pill" data-now>Now<\/span><\/span><\/button>/);
  assert.match(CSS, /\.row-now \{ order: 10; flex-basis: 100%;/);
});

// Why: "Before you review" listed problems as plain text far from the rows; on a long board the judge scrolled to
// hunt for "B07". Each named speaker jumps to its row, and the whole box is a caution panel with a word.
test('Rank: "Before you review" is a caution list whose items jump to the named row; Ready is green with a check', () => {
  const r = openBoard(room('hi', 'nsda-invitational', ['A12', 'A120']), NOW).room;
  const open = problemsHtml(r);
  assert.match(open, /^<div class="problems caution" role="status"><h2><span class="pill caution">/);
  assert.match(open, /data-jump="[^"]+"/);
  assert.equal(problemTarget(r, 'Give A120 a rating.'), idOf(r, 'A120'), 'A12 never matches inside A120');
  assert.equal(problemTarget(r, 'Give A12 a rating.'), idOf(r, 'A12'));
  assert.equal(problemTarget(r, 'Add the speakers in this room.'), null);
  // A district HI board opens fully ranked in speaking order and has no rating scale: it is ready.
  const ready = problemsHtml(openBoard(room('hi', 'nsda-district', ['A1', 'B2']), NOW).room);
  assert.match(ready, /^<p class="problems ok" role="status"><span class="pill ok"><svg[^>]*><use href="#i-circle-check"\/><\/svg>Ready<\/span> Every speaker has a rank/);
});

// Why: on Rate and Rubric every row looked the same whether it was scored or not; the judge had to read each number
// to find the gap. A row pill says "Rated 8" or "Not rated", and a rubric row says how many parts are scored.
test('Rate and Rubric rows: a progress pill in words', () => {
  const scale = ratingScale(prof('rate-only'));
  assert.match(rateRowPill({ id: 'x' }, '8', scale, []), /pill ok"><svg[^>]*>.*?<\/svg>Rated 8</);
  assert.match(rateRowPill({ id: 'x' }, '', scale, []), /pill caution"><svg[^>]*>.*?<\/svg>Not rated</);
  const rubric = [{ id: 'v', label: 'Voice', min: 1, max: 5 }, { id: 'b', label: 'Body', min: 1, max: 5 }, { id: 'c', label: 'Choice', min: 1, max: 5 }];
  assert.match(rateRowPill({ rubric: { v: 4, b: 3 } }, null, null, rubric), />7 \/ 15 · 2 of 3</);
  assert.match(rateRowPill({ rubric: { v: 4, b: 3, c: 5 } }, null, null, rubric), /pill ok"><svg[^>]*>.*?<\/svg>All scored · 12 \/ 15</);
  assert.equal(rateRowPill({}, null, { kind: 'none' }, []), '');
});

// Why: History dark showed 8 solid state pills; a list of past rounds has no next step, so it has no solid shape, and
// a fully copied round reads as done in green.
test('History: no solid state pills; Copied is green, in progress is a tint, Comments open is a caution word', () => {
  const a = Object.assign(room('hi', 'nsda-district'), { state: 'review', ranksCopiedAt: 1 });
  const b = Object.assign(room('oo', 'nsda-district'), { state: 'done', ranksCopiedAt: 1 });
  const rows = historyRows([a, b], DATA.events);
  const html = historyTableHtml(rows, historyColumns(rows, {}));
  assert.equal(primaries(html), 0);
  assert.doesNotMatch(html, /pill solid/);
  assert.match(html, /<span class="pill ok"><svg[^>]*><use href="#i-circle-check"\/><\/svg>Copied<\/span>/);
  assert.match(html, /<span class="pill live">[\s\S]*?Review<\/span> <span class="pill caution">Comments open<\/span>/);
});

// Why: "Ready for offline" was a plain sentence; at a school with no Wi-Fi, a judge must see at a glance whether the
// app will open. Ready is green with a word (the owner's D2 reading); anything else is a caution "Not ready".
test('Settings: the offline state is a pill in words', () => {
  assert.match(offlineHtml({ ready: true, text: 'Ready for offline.' }), /^<span class="pill ok">[\s\S]*Ready offline<\/span> Ready for offline\.$/);
  assert.match(offlineHtml({ ready: false, text: 'Not ready yet.' }), /^<span class="pill caution">[\s\S]*Not ready<\/span> Not ready yet\.$/);
  assert.equal(offlineHtml(null), 'Checking…');
});

// ---------- the room primary moves with the state (top 10 #1), the stopped card (#2), the tool group (#8) ----------

const T = 1_800_000_000_000;
const doneE = (e, sec, extra) => Object.assign({}, e, { status: 'done', timing: Object.assign({}, e.timing, { run: null, usedMs: sec * 1000 }, extra || {}) });
const runningE = (e, used, limit) => Object.assign({}, e, { status: 'speaking', timing: Object.assign({}, e.timing, { run: { kind: 'speech', endAt: T + (limit - used) * 1000, startLeft: limit - used } }) });
// The solid shapes of the card itself (the sticky bar is a second render of the same step, shown only while the card is
// out of view, so it is counted on its own).
const cardPrimaries = (html) => primaries(html.slice(0, html.indexOf('id="timer-mini"') < 0 ? html.length : html.indexOf('id="timer-mini"')));
function cardFor(r, e, event, limit, opts) {
  const face = timerFace(e, limit, 30, T);
  return timerHtml(e, face, limit, 30, cardTrack(e, event, face, limit, 30, T), Object.assign({ primary: roomPrimary(r, e), nextHtml: nextTopHtml(r) }, opts || {}));
}

// Why: the review found the two loudest buttons (Resume, Rank the room) were the wrong next steps and "Next speaker"
// the weakest. The fill must follow the work, or the judge taps Resume on a speaker who is already done.
test('room primary: Start or Stop while the speaker is up, Next speaker after the stop, Rank the room when nobody waits', () => {
  let r = room('hi', 'nsda-district', ['A1', 'B2']);
  const a = () => r.entries.find((x) => x.code === 'A1');
  assert.equal(roomPrimary(r, a()), 'timer', 'waiting: Start');
  r = withEntry(r, 'A1', (e) => runningE(e, 60, 600));
  assert.equal(roomPrimary(r, a()), 'timer', 'speaking: Stop');
  r = withEntry(r, 'A1', (e) => doneE(e, 500));
  assert.equal(roomPrimary(r, a()), 'next', 'stopped with B2 waiting');
  r = withEntry(r, 'B2', (e) => Object.assign({}, e, { status: 'noShow' }));
  assert.equal(roomPrimary(r, a()), 'rank', 'nobody waits');
  assert.equal(roomPrimary(r, r.entries.find((x) => x.code === 'B2')), 'rank', 'a no show on screen with nobody waiting');
  assert.equal(roomPrimary(room('hi'), null), 'next', 'no speaker on screen, speakers waiting');
});

// Why: one solid shape per state. Two would put the judge back where the review started: unsure which to press.
test('room primary: the card and the header together hold exactly one solid shape in each state', () => {
  const ev = DATA.events.get('hi');
  let r = Object.assign(room('hi', 'nsda-district', ['A1', 'B2', 'C3']), {});
  r = Object.assign({}, r, { current: idOf(r, 'A1') });
  const a = () => r.entries.find((x) => x.code === 'A1');
  const total = () => cardPrimaries(cardFor(r, a(), ev, 600)) + primaries(goRankHtml(r, roomPrimary(r, a())));
  assert.equal(total(), 1, 'waiting');
  assert.match(cardFor(r, a(), ev, 600), /class="b primary timer-go"[^>]*><svg[^>]*><use href="#i-play"\/><\/svg>Start</);
  assert.match(goRankHtml(r, 'timer'), /^<a class="b" id="go-rank" href="#\/rank\/[^"]+"><svg[^>]*><use href="#i-list-ordered"\/><\/svg>Rank the room <span class="muted">· 0 of 3<\/span><\/a>$/);
  r = withEntry(r, 'A1', (e) => runningE(e, 60, 600));
  assert.equal(total(), 1, 'speaking');
  assert.match(cardFor(r, a(), ev, 600), /class="b primary timer-go"[^>]*><svg[^>]*><use href="#i-pause"\/><\/svg>Stop</);
  r = withEntry(r, 'A1', (e) => doneE(e, 500));
  const stopped = cardFor(r, a(), ev, 600);
  assert.equal(total(), 1, 'stopped, speakers left');
  assert.match(stopped, /class="b timer-go"[^>]*><svg[^>]*>.*?<\/svg>Resume</, 'Resume steps down');
  assert.match(stopped, /<button class="b primary next-top" type="button" data-act="next" data-key="next">Next speaker: B2<svg/);
  assert.ok(stopped.indexOf('next-top') < stopped.indexOf('timer-go'), 'Next speaker comes first, right under the timer, before Resume and the tools');
  r = withEntry(withEntry(r, 'B2', (e) => doneE(e, 400)), 'C3', (e) => doneE(e, 450));
  assert.equal(cardPrimaries(cardFor(r, a(), ev, 600)), 0, 'all done: nothing solid on the card');
  assert.match(goRankHtml(r, roomPrimary(r, a())), /^<a class="b primary" id="go-rank"[^>]*><svg class="i i-20"[^>]*><use href="#i-list-ordered"\/><\/svg>Rank the room<\/a>$/);
  // The sticky bar follows the same step: its Next speaker is solid after the stop, never both buttons.
  const bar = stickyBarHtml(timerFace(doneE(a(), 500), 600, 30, T), null, 'next');
  assert.equal(primaries(bar), 1);
  assert.match(bar, /class="b small primary" type="button" data-act="next">Next speaker</);
});

// Why: the review's open risk — the primary changes style during work in every family. IMP prep, PCC's second run and
// USX must each keep one solid step, or prep and the run button compete with the clock.
test('room primary: IMP prep, PCC runs and USX each keep one solid step', () => {
  // IMP: prep running is the speaker's turn, so the big button ("Speech started") holds it.
  const imp = DATA.events.get('imp');
  let ri = room('imp', 'nsda-district', ['A1', 'B2']);
  const ie = Object.assign({}, ri.entries[0], { status: 'speaking', timing: { run: null, runs: [], usedMs: 0, prepRun: { kind: 'prep', endAt: T + 300_000, startLeft: 420 } } });
  ri = Object.assign({}, ri, { entries: [ie, ri.entries[1]] });
  const sf = sharedFace(ie, 420, 30, T);
  const impHtml = timerHtml(ie, sf, 420, 30, cardTrack(ie, imp, sf, 420, 30, T), { primary: roomPrimary(ri, ie), nextHtml: nextTopHtml(ri) });
  assert.equal(cardPrimaries(impHtml), 1);
  assert.match(impHtml, /class="b primary timer-go" type="button" data-tact="speech"/);
  // PCC: while the next run waits, the run button holds it and the clock steps down.
  const pcc = DATA.events.get('pcc');
  const rp = room('pcc', 'nsda-invitational', ['A1']);
  const pe = runningE(rp.entries[0], 200, 630);
  assert.equal(nextRunWaits(pe, pcc, T, 630), true);
  const pf = timerFace(pe, 630, 30, T);
  const pccCard = timerHtml(pe, pf, 630, 30, cardTrack(pe, pcc, pf, 630, 30, T), { primary: 'other' });
  const pccHtml = pccCard + runCardsHtml(pe, pcc, T, 630);
  assert.equal(cardPrimaries(pccCard), 0, 'the clock steps down');
  assert.equal(primaries(runCardsHtml(pe, pcc, T, 630)), 1, 'the run button holds it');
  assert.match(pccHtml, /class="b primary" type="button" data-ract="next"[^>]*>Pro done · start Con/);
  assert.equal(nextRunWaits(rp.entries[0], pcc, T, 630), false, 'before Pro starts the clock holds it');
  // USX: one speaker done, the next waits: "Next speaker: U2".
  const usx = DATA.events.get('usx');
  let ru = room('usx', 'nsda-district', ['U1', 'U2']);
  ru = Object.assign(withEntry(ru, 'U1', (e) => doneE(e, 420)), { current: idOf(ru, 'U1') });
  const u1 = ru.entries.find((x) => x.code === 'U1');
  const usxHtml = cardFor(ru, u1, usx, 420);
  assert.equal(cardPrimaries(usxHtml), 1);
  assert.match(usxHtml, />Next speaker: U2</);
});

// Why: after Stop the over state went away and the card hid in dark mode (--sunk on --panel is 1.06:1); the judge lost
// the one fact the ballot needs. The stopped card keeps the final time, a word pill and its tint.
test('stopped card: final time used, a result pill in words, the tint stays, and inside time has a full edge', () => {
  const e0 = room('hi').entries[0];
  const html = (sec) => { const e = doneE(e0, sec); return timerHtml(e, timerFace(e, 600, 30, T), 600, 30); };
  assert.deepEqual([590, 612, 740].map((sec) => stoppedResult(timerFace(doneE(e0, sec), 600, 30, T), 30).kind), ['inside', 'grace', 'over']);
  assert.match(html(560), /id="timer-digits" aria-hidden="true">9:20</);
  assert.match(html(560), /id="timer-sub">used</);
  assert.match(html(560), /data-result="inside"[\s\S]*<span class="pill" id="timer-result"><svg[^>]*><use href="#i-circle-check"\/><\/svg>Inside time<\/span>/);
  assert.match(html(612), /data-result="grace"[\s\S]*<span class="pill caution" id="timer-result">[\s\S]*?Grace \+0:12<\/span>/);
  assert.match(html(740), /data-result="over"[\s\S]*<span class="pill err" id="timer-result">[\s\S]*?Over grace \+2:20<\/span>/);
  assert.equal(stoppedResult(timerFace(e0, 600, 30, T), 30), null, 'no result before any time');
  assert.match(CSS, /\.timer-card\.stage-stopped \{ background: var\(--panel\); border: 1px solid var\(--border-ctl\); \}/);
  assert.match(CSS, /\.timer-card\.stage-stopped\[data-result="over"\] \{ background: var\(--error-tint\); border: 2px solid var\(--error\); \}/);
  // "Clear over grace" moved into the card, quiet.
  const over = doneE(e0, 740, { overGrace: true });
  const card = timerHtml(over, timerFace(over, 600, 30, T), 600, 30);
  assert.ok(card.indexOf('data-tact="clear"') < card.indexOf('class="timer-btns"'), 'inside the card');
  assert.match(card, /<button class="b small quiet" type="button" data-tact="clear">Clear over grace<\/button>/);
});

// Why: 4 or 5 controls of the same weight sat next to the primary, so rare fixes looked like the next step. The ±10 s
// fixes share one quiet track, Reset is quiet with an icon, and Set time stays in view (DESIGN.md's fix for a late start).
test('timer tools: ±10 s in one quiet track, Reset time quiet with an icon, Set time in view', () => {
  const e = doneE(room('hi').entries[0], 300);
  const html = timerHtml(e, timerFace(e, 600, 30, T), 600, 30);
  assert.match(html, /<span class="tool-group" role="group" aria-label="Correct the time used">\s*<button class="b" type="button" data-tact="minus"[^>]*>−10 s<\/button>\s*<button class="b" type="button" data-tact="plus"[^>]*>\+10 s<\/button><\/span>/);
  assert.match(html, /<button class="b quiet" type="button" data-tact="reset"><svg[^>]*><use href="#i-rotate-ccw"\/><\/svg>Reset time<\/button>/);
  assert.match(html, /data-tact="set">Set time</);
});

// ---------- ballot and private zones (top 10 #3), prompts open and the room-level reason (D3-A) ----------

// Why: "goes to the student" against "only for me" is the most costly mistake on the screen, and only grey bracket text
// told them apart. A judge who types a private remark into the ballot box sends it to a teenager.
test('sheet zones: On the ballot holds chips, prompts and comments; Just for you holds rule checks and the private note', () => {
  const OO = DATA.events.get('oo');
  const r = room('oo', 'nsda-district', ['A1']);
  const html = sheetHtml(r, r.entries[0], OO);
  const ballot = html.slice(html.indexOf('zone-ballot'), html.indexOf('zone-private'));
  const priv = html.slice(html.indexOf('zone-private'));
  assert.match(ballot, /<h3 class="zone-h" id="zone-ballot"><svg[^>]*><use href="#i-message-square"\/><\/svg>On the ballot<\/h3>/);
  assert.match(ballot, /data-cact="chip"/);
  assert.match(ballot, /<textarea id="notes"/);
  assert.doesNotMatch(ballot, /private-note|data-cact="check"/);
  assert.match(priv, /<h3 class="zone-h" id="zone-private"><svg[^>]*><use href="#i-lock"\/><\/svg>Just for you <span class="muted">never on the ballot<\/span><\/h3>/);
  assert.match(priv, /data-cact="check"[\s\S]*<textarea id="private-note"/);
  assert.match(priv, /Flags go in your private note\./);
  assert.doesNotMatch(html, /\(go on the ballot\)|\(only for you; never on the ballot\)/, 'the zone headings replace the bracket hints');
  // A flagged check is caution, with a word, not the error color.
  const flagged = sheetHtml(r, toggleCheck(r.entries[0], OO.checks[0]), OO);
  assert.match(flagged, /<button class="chk flag"[^>]*><span>[^<]+<\/span><span class="chk-state"><svg[^>]*><use href="#i-flag"\/><\/svg>Flagged<\/span><\/button>/);
  assert.match(CSS, /\.chk\.flag \{ background: var\(--caution-tint\); border-color: var\(--caution\); \}/);
  assert.doesNotMatch(CSS, /\.chk\.flag \{[^}]*--error/);
});

// Why: the prompts help with the act of writing, but behind a sideways triangle most lay judges never opened them. They
// sit open above the box (three, then "Show all"), and the box points to them for a screen reader.
test('prompts: open above the comments box, three then "Show all (N)", linked with aria-describedby', () => {
  const OO = DATA.events.get('oo');
  const r = room('oo', 'nsda-district', ['A1']);
  const html = sheetHtml(r, r.entries[0], OO);
  const ballotZone = html.slice(html.indexOf('zone-ballot'), html.indexOf('zone-private'));
  assert.doesNotMatch(ballotZone, /<details|<summary/, 'the prompts are not a fold');
  assert.ok(html.indexOf('id="prompts"') < html.indexOf('<textarea id="notes"'), 'above the box');
  assert.match(html, /<textarea id="notes"[^>]*aria-describedby="prompts-list"/);
  const many = ['One', 'Two', 'Three', 'Four', 'Five', 'Six'];
  const short = promptsHtml(many, false);
  assert.equal((short.match(/<li>/g) || []).length, PROMPTS_SHOWN);
  assert.match(short, /data-cact="prompts-all" aria-controls="prompts-list">Show all \(6\)/);
  const all = promptsHtml(many, true);
  assert.equal((all.match(/<li>/g) || []).length, 6);
  assert.doesNotMatch(all, /Show all/);
  assert.doesNotMatch(promptsHtml(['One', 'Two'], false), /Show all/, 'nothing hidden, no button');
  assert.equal(promptsHtml([], false), '');
  const custom = sheetHtml(r, r.entries[0], Object.assign({}, OO, { prompts: [] }));
  assert.doesNotMatch(custom, /aria-describedby/, 'no prompts, no link to them');
});

// Why: a whole-room field inside one speaker's card confused judges (and showed on events with no ranks). It is one
// quiet room-level button that opens the box; once written it stays open, and rules without ranks never show it.
test('reason for rank: a room-level "+ Add reason for rank", open once written, hidden without ranks', () => {
  const r = room('hi', 'nsda-district', ['A1']);
  assert.doesNotMatch(sheetHtml(r, r.entries[0], DATA.events.get('hi')), /reason/i, 'not in the speaker sheet');
  assert.equal(reasonFootHtml(r, false), '<button class="b quiet" type="button" data-cact="reason-open" data-key="reason-open"><svg class="i i-16" aria-hidden="true" focusable="false"><use href="#i-plus"/></svg>Add reason for rank</button>');
  assert.match(reasonFootHtml(r, true), /<textarea id="reason" rows="3" data-cfield="reason"><\/textarea>/);
  assert.match(reasonFootHtml(Object.assign({}, r, { reasonForRank: 'A1 was clearest.' }), false), /<textarea id="reason"[^>]*>A1 was clearest\.<\/textarea>/);
  assert.equal(reasonFootHtml(room('oo', 'rate-only'), true), '', 'a Rate round has its own field on the Rate screen');
  const crit = Object.assign(prof('nsda-district'), { critiqueOnly: true });
  assert.equal(reasonFootHtml(room('poi', 'nsda-district', ['A1'], { profile: crit }), true), '', 'comments only: no ranks, no reason');
  // The room screen draws the room-level part under the grid, not inside the stage.
  const src = read('./js/room-screen.js');
  assert.match(src, /<div class="room-grid">[\s\S]*?<\/div>\n\s*<div class="room-foot" id="room-foot"><\/div>/);
});

// Why: the Review OO checklist said "Notes for the room" while the card said "Reason for rank"; a judge then hunted for
// a second field. One word, from the profile, in both places.
test('Review: the checklist and the card use the same word for the whole-room note', () => {
  const rate = Object.assign(room('oo', 'rate-only'), { reasonForRank: 'All clear.' });
  // CHANGED 2026-11-24 because the owner approved COPY-TRIM-AUDIT.md §1 (E27, rule W3). Old line:
  //   assert.ok(checklist(rate).some((c) => c.label === 'Notes for the room written'));
  assert.ok(checklist(rate).some((c) => c.label === 'Room notes written'));
  // CHANGED 2026-11-24 because the owner approved COPY-TRIM-AUDIT.md §1 (E27, rule W3). Old line:
  //   assert.match(commentsStageHtml(rate, { order: 'speaking', editing: null }), /<span>Notes for the room<\/span>/);
  assert.match(commentsStageHtml(rate, { order: 'speaking', editing: null }), /<span>Room notes<\/span>/);
  const ranked = Object.assign(room('hi', 'nsda-district'), { reasonForRank: 'A1 first.' });
  assert.ok(checklist(ranked).some((c) => c.label === 'Reason for rank written'));
  assert.match(commentsStageHtml(ranked, { order: 'speaking', editing: null }), /<span>Reason for rank<\/span>/);
});

// ---------- the sticky ballot footer (top 10 #6, D4 B) ----------

// Why: the primary was small, far right, at the end of a long page, and looked like a selected rating. A judge on a
// phone scrolled past 15 rubric rows to find it. It pins to the bottom with the progress in words, and while work is
// open a tap goes to the first open row instead of a Review screen that would block the copy.
test('ballot footer: the progress word and one primary; while work is open it points at the first open row', () => {
  let r = room('oo', 'rate-only', ['A12', 'B07', 'C33']);
  r = withRating(r, idOf(r, 'A12'), '8', NOW);
  const open = ballotProgress(r, 'rate');
  assert.equal(open.word, '1 of 3 rated');
  assert.equal(open.open, idOf(r, 'B07'), 'the first row still to rate');
  const html = ballotFootHtml(r, 'rate');
  assert.equal(primaries(html), 1);
  assert.match(html, /<span class="bf-progress" id="bf-progress" role="status"><svg[^>]*><use href="#i-circle"\/><\/svg>1 of 3 rated<\/span>/);
  assert.match(html, new RegExp('<a class="b primary" id="go-review" href="#/review/' + r.id + '" data-open="' + idOf(r, 'B07') + '">Review and copy<svg'));
  r = withRating(withRating(r, idOf(r, 'B07'), '6', NOW), idOf(r, 'C33'), '9', NOW);
  assert.deepEqual(ballotProgress(r, 'rate'), { word: 'All rated', open: null });
  assert.doesNotMatch(ballotFootHtml(r, 'rate'), /data-open/, 'all done: the button goes to Review');
  const ranked = openBoard(room('hi', 'nsda-district', ['A1', 'B2']), NOW).room;
  assert.deepEqual(ballotProgress(ranked, 'rank'), { word: 'All ranked', open: null });
  // A rubric counts speakers with every part scored.
  const rub = Object.assign(prof('nsda-district'), { rubric: [{ id: 'v', label: 'Voice', min: 1, max: 5 }, { id: 'b', label: 'Body', min: 1, max: 5 }] });
  let rr = openBoard(room('di', 'nsda-district', ['A1', 'B2'], { profile: rub }), NOW).room;
  rr = withEntry(rr, 'A1', (e) => Object.assign({}, e, { rubric: { v: 4, b: 5 } }));
  assert.equal(ballotProgress(rr, 'rank').word, '1 of 2 scored');
  assert.equal(ballotProgress(rr, 'rank').open, idOf(rr, 'B2'));
});

// Why: OD1 — the footer must never show at the same time as the phone timer bar, or two pinned bars cover the comment
// box. They live on different screens: the footer on Rank and Rate only, the timer bar on the Room only.
test('ballot footer: only Rank and Rate draw it, the Room never does, and it pins with a full edge', () => {
  for (const f of ['./js/rank-screen.js', './js/rate-screen.js']) {
    const src = read(f);
    assert.match(src, /<div class="ballot-foot" id="ballot-foot"><\/div>/, f);
    assert.doesNotMatch(src, /timer-mini/, f);
  }
  for (const f of ['./js/room-screen.js', './js/timer-view.js']) assert.doesNotMatch(read(f), /ballot-foot/, f);
  assert.match(CSS, /\.ballot-foot \{ position: sticky; bottom: 0; z-index: var\(--z-sticky\);[^}]*border: 1px solid var\(--border-ctl\);/);
});

// ---------- one chevron fold style (§5.4, top 10 #9) ----------

// Why: the owner asked whether the sideways triangles told judges a row opens; "Elim or panel?" showed no marker at
// all (a flex summary hides it). Every fold now has one cue: a chevron that points down at the end of a full row.
test('folds: every details in the app is a fold row with a down chevron; a right chevron never marks a fold', () => {
  // fold.js builds the summary (its comments name the tags), so it is checked by its output.
  assert.match(foldSummaryHtml('X'), /^<summary class="fold-row"><span class="fold-label">X<\/span><svg class="i i-20"[^>]*><use href="#i-chevron-down"\/><\/svg><\/summary>$/);
  for (const [f, src] of SOURCES) {
    if (f === 'js/fold.js') continue;
    for (const m of src.matchAll(/<details\b[^>]*>/g)) assert.match(m[0], /class="[^"]*\bfold\b/, f + ': ' + m[0]);
    for (const m of src.matchAll(/<summary\b[^>]*>/g)) assert.equal(m[0], '<summary class="fold-row">', f + ': ' + m[0]);
    assert.doesNotMatch(src, /<summary[^]*?icon\('chevron-right'/, f + ': a right chevron in a summary');
  }
  assert.match(CSS, /details\.fold > summary \{ list-style: none; \}/);
  assert.match(CSS, /details\.fold > summary::-webkit-details-marker \{ display: none; \}/);
  assert.match(CSS, /details\.fold\[open\] > \.fold-row > svg\.i \{ transform: rotate\(180deg\); \}/);
  assert.match(CSS, /\.fold-row \{ display: flex; align-items: center; gap: var\(--s2\); min-height: 44px;[^}]*border: 1px solid var\(--border-ctl\);/);
  assert.doesNotMatch(CSS, /\.setup-more > summary \{[^}]*display: flex/, 'the old flex summary that hid the marker is gone');
  // The turn is cut under reduced motion by the one global rule.
  assert.match(read('../core/tokens.css'), /@media \(prefers-reduced-motion: reduce\) \{\n  \*, \*::before, \*::after \{[^}]*transition-duration: 0s !important;/);
});

// Why: a closed fold must still say what is set inside it, or a judge cannot tell an elim from a prelim without opening
// it; and a lost pasted line must be named in words, not as a bare count.
test('folds: "Elim or panel?" shows its value, "Lines left out" a caution count, Settings Keyboard is closed and off on touch', () => {
  assert.equal(levelSummary('prelim', '1'), 'Prelim · Only me');
  assert.equal(levelSummary('elim', '3'), 'Elim · Panel of 3');
  assert.match(setupHtml(DATA), /<details class="setup-more fold" id="setup-more"><summary class="fold-row"><span class="fold-label">Elim or panel\?<\/span><span class="fold-value muted" id="setup-more-value">Prelim · Only me<\/span>/);
  const parsed = parseRoom('Round 1 Room 214\nA12 Ava\nB07 Ben', { max: 8 });
  assert.match(previewHtml(parsed), /<details class="skipped fold"><summary class="fold-row"><span class="fold-label">Lines left out<\/span><span class="pill caution">1 left out<\/span>/);
  const set = settingsHtml({ settings: {}, ai: { on: false }, keys: '<dl class="ks-list"></dl>', offline: null });
  assert.match(set, /<section class="set-part set-keys" aria-labelledby="set-keys-h"><details class="fold"><summary class="fold-row"><span class="fold-label"><h2 id="set-keys-h">Keyboard<\/h2><\/span>/);
  assert.doesNotMatch(set, /<details class="fold" open>/, 'closed');
  assert.match(CSS, /@media \(hover: none\) and \(pointer: coarse\) \{ \.set-keys \{ display: none; \} \}/);
});

// Why: on a phone the rule checks pushed the private note far down; they start as one closed row that says how many
// are flagged, and open on their own once a flag is set, so a flag is never hidden.
test('folds: rule checks are closed on a phone until a flag is set, and open on a laptop', () => {
  const OO = DATA.events.get('oo');
  const r = room('oo', 'nsda-district', ['A1']);
  const phone = sheetHtml(r, r.entries[0], OO, { narrow: true });
  assert.match(phone, /<details class="chk-group fold"><summary class="fold-row"><span class="fold-label"><span id="chk-title">Rule checks<\/span><\/span><span class="fold-value muted">none flagged<\/span>/);
  const flagged = sheetHtml(r, toggleCheck(r.entries[0], OO.checks[0]), OO, { narrow: true });
  assert.match(flagged, /<details class="chk-group fold" open>[\s\S]*?>1 flagged</);
  assert.match(sheetHtml(r, r.entries[0], OO, { narrow: false }), /<details class="chk-group fold" open>/);
});

// ---------- D5-A: "I submitted in Tabroom" on My day ----------

// Why: 8 outlined "I submitted in Tabroom" buttons competed with Continue on rows where the ballot was not finished; a
// judge could mark a round submitted by mistake. Owner D5 A (reverses change 2 in §2.1 of the last review): the button
// stays on the Up next card and on rows whose ranks are in, and waits in ⋯ on rows still judging.
test('D5-A: on rows still judging the submit button moves into ⋯; Up next and ranks-in rows keep it', () => {
  const DAY = makeDay({ date: dayOf(NOW), now: NOW - 3600000, makeId: () => 'd1' });
  const make = (ev, over) => {
    const r = Object.assign(room(ev, 'nsda-district'), over || {});
    const c = Object.assign(makeCard({ day: DAY, event: DATA.events.get(ev), round: 'Round 1', now: NOW - 1000, makeId }), { roundId: r.id, status: 'judging' });
    r.cardId = c.id;
    return [r, c];
  };
  const [ra, ca] = make('hi', { state: 'judging' });
  const [rb, cb] = make('di', { state: 'judging' });
  const [rc, cc] = make('oo', { state: 'review', ranksCopiedAt: NOW - 1000 });
  const m = mydayModel({ day: DAY, cards: [ca, cb, cc], rounds: [ra, rb, rc], now: NOW });
  const html = mydayHtml(m, DAY, DATA.events, NOW, []);
  const next = html.slice(html.indexOf('class="md-next-card"'), html.indexOf('</section>'));
  // CHANGED 2026-11-24 because the owner approved COPY-TRIM-AUDIT.md §1 (E45, DESIGN.md rule 9). Old line:
  //   assert.match(next, /data-act="submit">I submitted in Tabroom/, 'Up next keeps it');
  assert.match(next, /data-act="submit">Mark submitted/, 'Up next keeps it');
  const rows = [...html.matchAll(/<li class="md-row"[^>]*aria-label="([^"]+)">([\s\S]*?)<\/li>/g)];
  const judging = rows.filter((x) => /Judging$/.test(x[1]));
  const ranksIn = rows.filter((x) => /Ranks copied/.test(x[1]));
  assert.ok(judging.length && ranksIn.length, 'both kinds of row are drawn');
  for (const x of judging) assert.doesNotMatch(x[2], /data-act="submit"/, x[1] + ': not on the row');
  // CHANGED 2026-11-24 because the owner approved COPY-TRIM-AUDIT.md §1 (E45, DESIGN.md rule 9). Old line:
  //   for (const x of ranksIn) assert.match(x[2], /data-act="submit">I submitted in Tabroom/, x[1] + ': on the row');
  for (const x of ranksIn) assert.match(x[2], /data-act="submit">Mark submitted/, x[1] + ': on the row');
  // Opened, a judging row's menu lists it first, with Cancel last.
  const key = judging[0][0].match(/data-item="([^"]+)"/)[1];
  const open = mydayHtml(m, DAY, DATA.events, NOW, [], key);
  const row = open.slice(open.indexOf('data-item="' + key + '"'));
  // CHANGED 2026-11-24 because the owner approved COPY-TRIM-AUDIT.md §1 (E45, DESIGN.md rule 9). Old line:
  //   assert.match(row.slice(0, row.indexOf('</li>')), /<div class="md-menu"[^>]*>\s*<button class="b small" type="button" data-act="submit">I submitted in Tabroom<\/button>\s*<button[^>]*data-act="room">Change room<\/button>\s*<button class="b small quiet danger-text md-cancel" type="button" data-act="cancel">Cancel round<\/button><\/div>/);
  assert.match(row.slice(0, row.indexOf('</li>')), /<div class="md-menu"[^>]*>\s*<button class="b small" type="button" data-act="submit">Mark submitted<\/button>\s*<button[^>]*data-act="room">Change room<\/button>\s*<button class="b small quiet danger-text md-cancel" type="button" data-act="cancel">Cancel round<\/button><\/div>/);
});

// Why: §5.1 sets 44 px targets on a phone; a 28 px "Edit" or "Show all" next to other controls is a mis-tap that opens
// the wrong card in the middle of a round.
test('phone targets: every button, small ones too, is at least 44 px under 820 px; the primary is 48 px', () => {
  assert.match(CSS, /@media \(max-width: 820px\) \{\n  a\.b, button\.b, a\.b\.small, button\.b\.small, \.timer-btns \.b \{ min-height: 44px; \}/);
  assert.match(CSS, /  a\.b\.primary, button\.b\.primary, \.timer-btns \.b\.primary \{ min-height: 48px; \}/);
});
