// Speech Events cleanup 2 (2026-11-25), after the design build's architecture review: the timer card split
// (js/timer-card-html.js), the track updated in place each tick (js/timer-view.js patchTrack), every pill through
// js/status-pill.js, one CSS block for the pills, and the small nits. Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { signalPoints } from './js/timer.js';
import * as timeTrack from './js/time-track.js';
import * as statusPill from './js/status-pill.js';
import { patchTrack } from './js/timer-view.js';
import { ICONS } from './js/icons.js';

const { trackModel, trackHtml, trackParts } = timeTrack;
const { statusPillHtml, eventPillHtml } = statusPill;
const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const noComments = (src) => src.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');

// A running speech at `sec` seconds used, as the card's track parts.
const partsAt = (sec, phases) => trackParts(trackModel({ limit: 600, grace: 30, pieces: [{ sec }], points: signalPoints(600, 30), running: true }), { phases });

// A small stand-in for the #timer-track element: it records each write, and a replaced child is a new object, as in
// a browser. The img node is the role="img" element a screen reader sits on.
function fakeTrack(parts) {
  const log = [];
  const t = { phases: parts.phases ? { html: parts.phases } : null };
  const mk = (name, html) => ({ html, set outerHTML(h) { log.push(name); t[name] = mk(name, h); } });
  t.bar = mk('bar', parts.bar);
  t.ticks = { html: parts.ticks, set innerHTML(h) { log.push('ticks'); this.html = h; } };
  t.img = {
    label: parts.label,
    getAttribute: (k) => (k === 'aria-label' ? t.img.label : null),
    setAttribute: (k, v) => { log.push('set ' + k); t.img.label = v; },
    querySelector: (s) => (s === '.track-bar' ? t.bar : s === '.track-ticks' ? t.ticks : null),
  };
  const el = {
    querySelector: (s) => (s === '.track-img' ? t.img : s === '.phases' && t.phases ? {
      set outerHTML(h) { log.push('phases'); t.phases = { html: h }; },
      remove() { log.push('phases gone'); t.phases = null; },
    } : null),
    insertAdjacentHTML: (where, h) => { log.push('phases added'); t.phases = { html: h }; },
    set outerHTML(h) { log.push('track replaced'); },
  };
  return { el, t, log };
}

// Why: the old tick rebuilt the whole track with outerHTML once a second, so the role="img" node and its long
// aria-label were new every second. A screen reader on the card lost its place and could read the whole budget again,
// every second, while the judge listens to a speech. If this regresses, the timer card is noisy for blind judges.
test('the track tick keeps its role="img" node and writes only the parts that changed', () => {
  const first = partsAt(100);
  const { el, t, log } = fakeTrack(first);
  const img = t.img;
  patchTrack(el, first); // the first paint after a draw: nothing is known yet, so it may write; the label is the same
  assert.ok(!log.includes('set aria-label'), 'the same label is not written again');
  log.length = 0;
  assert.deepEqual(patchTrack(el, partsAt(100)), [], 'the same parts again: no write at all');
  assert.deepEqual(log, []);
  const next = partsAt(101);
  assert.notEqual(next.label, first.label, 'the label says the time used, so one second later it differs');
  assert.deepEqual(patchTrack(el, next).sort(), ['bar', 'label']);
  assert.equal(t.img, img, 'the role="img" node is the same object after the tick');
  assert.equal(t.img.label, next.label);
  assert.ok(!log.includes('track replaced'), 'the track box is never rebuilt');
});

// Why: a phase row (prep, then speech; PCC's Pro, then Con) changes only at a phase step or when its time moves; a
// rebuild every tick would also reset what a screen reader reads in the step list. If the patch dropped or doubled
// the row, the judge would lose the "Next: ..." line.
test('the track tick rewrites the phase row only when its HTML changes, and keeps one row', () => {
  const a = partsAt(100, '<div class="phases" id="card-phases">A</div>');
  const { el, t, log } = fakeTrack(a);
  patchTrack(el, a);
  log.length = 0;
  patchTrack(el, partsAt(100, a.phases));
  assert.ok(!log.some((l) => l.startsWith('phases')), 'same phase row: not touched');
  patchTrack(el, partsAt(100, '<div class="phases" id="card-phases">B</div>'));
  assert.deepEqual(log, ['phases']);
  assert.match(t.phases.html, />B</);
});

// Why: the split must not change what the card looks like: trackHtml is now built from trackParts, and the tick
// writes the same parts. If they drifted, the first draw and the ticks would show two different tracks.
test('trackHtml is the parts put together, so a draw and a tick show the same track', () => {
  const p = partsAt(250, '<div class="phases">x</div>');
  const html = trackHtml(trackModel({ limit: 600, grace: 30, pieces: [{ sec: 250 }], points: signalPoints(600, 30), running: true }), { id: 'timer-track', phases: p.phases });
  assert.ok(html.includes(p.bar) && html.includes(p.ticks) && html.includes(p.phases));
  assert.ok(html.startsWith('<div class="track" id="timer-track"><div class="track-img" role="img" aria-label="'));
});

// Why: the paint step is the one place that ran the rebuild; if a later edit put the outerHTML rebuild back, the
// noise for screen readers would come back with no other test failing.
test('the timer view paints the track through patchTrack, not with an outerHTML rebuild', () => {
  const src = noComments(read('./js/timer-view.js'));
  assert.match(src, /patchTrack\(\$\('#timer-track'\), trackParts\(/);
  assert.doesNotMatch(src, /tr\.outerHTML|outerHTML = trackHtml/);
});

// Why: the split put the card's HTML in a module of its own so the tests and the view share one pure builder. If it
// grew a clock, a DOM call or the ballot footer, the "one clock driver" rule (OD1) and the "no footer on the Room"
// rule would break where the old source checks of timer-view.js no longer look.
test('timer-card-html.js is pure: no driver, no tick, no DOM, no ballot footer', () => {
  const src = noComments(read('./js/timer-card-html.js'));
  assert.doesNotMatch(src, /createDriver|setInterval|requestAnimationFrame|document\.|querySelector|addEventListener/);
  assert.doesNotMatch(src, /ballot-foot/);
  assert.equal((read('./js/timer-view.js').match(/createDriver\(/g) || []).length, 2, 'the two drivers stay in the view');
});

// Why: pill markup typed by hand in many files drifted (an event pill had two copies with different attributes);
// with one helper, a change to the pill look or its rules is made once. If a hand-made pill comes back, it can miss
// the tone rules (green for done only, red for errors only).
test('every pill in events/js and events/congress comes from status-pill.js', () => {
  const files = ['round-frame.js', 'picker-screen.js', 'setup-screen.js', 'myday-screen.js', 'type-screen.js', 'room-screen.js', 'timer-view.js', 'timer-card-html.js']
    .map((f) => './js/' + f).concat(['./congress/views.js', './congress/chamber-screen.js']);
  for (const f of files) assert.doesNotMatch(read(f), /class="pill[ "]/, f + ' types pill markup by hand');
  assert.doesNotMatch(read('./js/myday-screen.js') + read('./js/room-screen.js'), /<a class="pill md-ev"/, 'one event pill helper');
});

// Why: the helper had to grow a class and a link form to replace the hand-made pills without a change on screen; if
// it put the classes in another order or dropped the link, the picker chips and the event pill would change.
test('statusPillHtml: the cls and tag options give the same markup the screens used before', () => {
  assert.equal(statusPillHtml('outline', '10:00', '', { cls: 'pk-chip' }), '<span class="pill outline pk-chip">10:00</span>');
  assert.equal(statusPillHtml('', 'Congress', '', { cls: 'md-ev' }), '<span class="pill md-ev">Congress</span>');
  assert.equal(statusPillHtml('err', 'x', '', 'id="a"'), '<span class="pill err" id="a">x</span>', 'the old attrs text still works');
  assert.equal(statusPillHtml('bogus', 'x'), '<span class="pill">x</span>', 'an unknown tone is the default pill');
  assert.equal(eventPillHtml('hi', 'Humorous Interpretation', 'HI', true),
    '<a class="pill md-ev" href="#/type/hi" title="Humorous Interpretation" aria-label="About Humorous Interpretation">HI</a>');
  assert.equal(eventPillHtml('custom', 'Custom event', 'Custom'), '<a class="pill md-ev" href="#/type/custom" aria-label="About Custom event">Custom</a>');
});

// Why: the review asked to drop the "calendar" and "cloud-off" icons as unused, but events/index.html draws them (the
// My day nav link and the offline chip). If one were dropped, that link and the offline warning would lose their icon
// with no error.
test('every icon events/index.html points to is in the sprite', () => {
  const used = [...read('./index.html').matchAll(/href="#i-([a-z-]+)"/g)].map((m) => m[1]);
  assert.ok(used.includes('calendar') && used.includes('cloud-off'));
  for (const name of used) assert.ok(ICONS[name], name + ' is drawn by index.html');
});

// Why: TONES and overShown were exported but only used inside their files; an export is a promise other files may
// lean on, so a private rule could not change without a search of the whole app.
test('TONES and overShown are private to their modules', () => {
  assert.equal(statusPill.TONES, undefined);
  assert.equal(timeTrack.overShown, undefined);
});

// Why: the pill rules were spread over five places in app.css, so a tone could be changed in one place and beaten by
// a later rule in another. One block makes the cascade order plain.
test('app.css: the .pill and .pill.<tone> rules and the .timer-flag rules sit in one block', () => {
  const lines = read('./app.css').split('\n');
  const at = lines.map((l, i) => (/^\.pill(\.[a-z-]+)? \{|^(\.timer-card )?\.timer-flag \{/.test(l) ? i : -1)).filter((i) => i >= 0);
  assert.equal(at.length, 9, 'pill, five tones, pk-chip, and two flag rules');
  assert.equal(at[at.length - 1] - at[0], at.length, 'one run of lines (one comment line inside)');
  assert.match(lines[at[0]], /gap: var\(--s1\)/, 'the late .pill { gap } rule is in the base rule now');
});

// Why: core/ is shared by every Tabula app and must stay events-agnostic; a comment that names one app invites
// app rules into the shared tokens.
test('core/tokens.css does not name Speech Events', () => {
  assert.doesNotMatch(read('../core/tokens.css'), /Speech Events|EVENTS-COLOR-ICON-REVIEW/);
});
