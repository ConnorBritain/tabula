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
import { problemTarget, rateRowPill } from './js/ballot-status.js';
import { offlineHtml } from './js/settings-screen.js';
import { ratingScale } from './js/rank.js';

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
    const html = iconButton(name, 'More for HI Round 1', 'class="iconbtn"');
    assert.match(html, /aria-label="More for HI Round 1"/);
    assert.match(html, new RegExp('#i-' + name + '"'));
  }
  // A name off the list draws the label as a word instead of a lone icon.
  assert.equal(iconButton('copy', 'Copy all'), '<button type="button"  aria-label="Copy all">Copy all</button>');
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
