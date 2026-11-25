// Speech Events step E5: the timer card on the Room screen (DESIGN.md §3, §4.2; primitives N4, N5). It plugs into
// createRoomScreen as a view (see room-screen.js for the hooks). The rules are in timer.js; the clock that starts,
// stops and ticks is core/clock.js createDriver. Only one clock runs in a room: starting a speaker stops the other.
// The builder at the top is pure (Node tests call it); createTimerView does the DOM.
// Step E11 (Impromptu, prep in the room on a shared limit, N6): a second driver (kind 'prep') times prep, the two-step
// bar "Prep" then "Speech" sits above the digits, and "Speech started" stops prep and starts the speech on what is left
// of the shared limit. The rules are in prep.js.
// Design build (docs/design/EVENTS-DESIGN-REVIEW.md §2.4–§2.7, top 10 #1, #2 and #3): the signal track under the
// digits (time-track.js, D2-A) replaces the old "Prep, then Speech" pills: on a prep event the phase row
// (phase-bar.js) sits inside the track's box, so the card has one phase control. A roster row shows the mini track
// (D3-A) and drops its time while the speaker speaks (the card shows it). On a phone the sticky compact bar (OD1 A)
// pins to the top while the big card is out of view: it is a second render of the same face, and its button sends
// the same data-tact action to the same handler. It adds no driver, no tick and no key binding.
import { escapeHtml as esc } from '../../core/sheets.js';
import { icon } from './icons.js';
import { statusPillHtml } from './status-pill.js';
import { roomPrimary, nextTopHtml } from './room-primary.js';
import { phasesHtml } from './phase-bar.js';
import { trackModel, trackHtml, miniTrackHtml, piecesFor, pointsFor, rowTrackHtml } from './time-track.js';
import { createDriver } from '../../core/clock.js';
import {
  limitOf, graceOf, clockText, parseClock, usedAt, timerFace, startLeft, stoppedTiming, adjustTiming, setUsedTiming,
  clearedTiming, resetTiming, restoreRoom, signalPoints, crossedSignal,
} from './timer.js';
import { entryOf, updateEntry, roomEvent } from './room.js';
import {
  hasSharedPrep, prepUsedAt, speechLimit, totalUsedAt, prepPhase, prepStartLeft, stoppedPrep, adjustPrep, resetAll, sharedFace,
  restoreSharedRoom,
} from './prep.js';

// The timer card for one entry as HTML text. face: timerFace(...). The stage shows as a fill of the whole card plus a
// word (DESIGN.md §3); colour never carries the meaning alone.
// The over-grace line inside the card ('' when the flag is off). Design build (top 10 #2): it sits in the card, and
// "Clear over grace" is a quiet button (a rare fix). After a stop the result pill under the digits says it, so the
// line keeps only the clear button.
export const overGraceHtml = (face) => (face.overGrace ? `<div class="timer-flag">${face.stage === 'stopped' && face.used > 0 ? '' : statusPillHtml('err', 'Over grace')}
      <button class="b small quiet" type="button" data-tact="clear">Clear over grace</button></div>` : '');

// The result of a stopped speech (top 10 #2), or null before any time and while the clock runs: 'inside', 'grace'
// or 'over', with the amount past the limit. On a prep event the face's left is of the speech part.
export function stoppedResult(face, grace) {
  if (!face || face.stage !== 'stopped' || !(face.used > 0)) return null;
  const past = -face.left;
  if (past <= 0) return { kind: 'inside', past: 0 };
  return { kind: past <= grace ? 'grace' : 'over', past };
}
const RESULT_PILL = { inside: ['', 'circle-check', () => 'Inside time'], grace: ['caution', 'info', (p) => 'Grace +' + clockText(p)], over: ['err', 'triangle-alert', (p) => 'Over grace +' + clockText(p)] };
// The pill under the digits after a stop ('' otherwise).
export function resultPillHtml(face, grace) {
  const r = stoppedResult(face, grace);
  if (!r) return '';
  const [tone, ic, word] = RESULT_PILL[r.kind];
  return statusPillHtml(tone, word(r.past), ic, 'id="timer-result"');
}
// What the card shows: after a stop the big digits are the final time used (9:20), not the time left (top 10 #2).
export function cardFace(face) {
  return face && face.stage === 'stopped' && face.used > 0 ? Object.assign({}, face, { digits: clockText(face.used), sub: 'used' }) : face;
}

// The phase row of a prep event (DESIGN.md §4.2 "Prep" then "Speech"), as a phase-bar.js model. face: prep.js
// sharedFace(...). Prep shows its time once it has some; it freezes when the speech starts.
export function prepPhaseModel(face) {
  const inSpeech = face.phase === 'speech';
  const current = face.phase === 'ready' ? -1 : !inSpeech ? 0 : face.running || !face.used ? 1 : 2;
  const next = current === -1 ? 'Next: Prep. Tap Start prep when the speaker has the topic.'
    : current === 0 ? 'Next: Speech. Tap Speech started when the speech begins.'
      : current === 2 ? 'Prep and speech are done.' : '';
  return {
    label: 'Prep, then speech',
    phases: [{ id: 'prep', label: 'Prep', time: face.prepUsed ? clockText(face.prepUsed) : '' }, { id: 'speech', label: 'Speech', time: inSpeech && face.used ? clockText(face.used) : '' }],
    current, next,
  };
}

// The track for the card (time-track.js model, plus the phase row HTML). Pure. phasesFor(entry, event, now, limit):
// optional, the phase model of a family with phases of its own (F4 runs.js runsBarModel); a prep event uses
// prepPhaseModel; other events have no phase row.
export function cardTrack(entry, event, face, limit, grace, now, phasesFor) {
  const model = trackModel({ limit, grace, pieces: piecesFor(entry, event, limit, now), points: pointsFor(entry, event, limit, grace, now), running: face.running });
  const pm = phasesFor ? phasesFor(entry, event, now, limit) : face.phase ? prepPhaseModel(face) : null;
  return { model, phases: pm ? phasesHtml(pm, { id: 'card-phases' }) : '' };
}

// The buttons under the card before the speech starts on a prep event: ready, prep running, prep stopped.
function prepButtons(face, primary) {
  if (face.phase === 'ready') return `${bigButton(face, primary)}
      <button class="b" type="button" data-tact="speech">Start speech</button>`;
  return `${bigButton(face, primary)}
      <button class="b" type="button" data-tact="prep">${face.running ? 'Stop prep' : 'Resume prep'}</button>
      ${toolGroup('prep')}
      ${face.running ? '' : resetHtml}`;
}

// The one main button of the card, as { tact, label } (the big button and the sticky bar's button both draw it).
export function mainButton(face) {
  if (face.phase === 'ready') return { tact: 'prep', label: 'Start prep' };
  if (face.phase && face.phase !== 'speech') return { tact: 'speech', label: 'Speech started' };
  return { tact: 'startstop', label: face.running ? 'Stop' : face.used ? 'Resume' : 'Start' };
}

// The play or pause icon of the main button (§5.3): pause while a clock runs, play otherwise.
const goIcon = (face) => icon(face.running ? 'pause' : 'play', 20);
// The big main button of the card (data-key="startstop": the focus and the Space rule find it first). primary: false
// when another step holds the room's one solid fill (top 10 #1: Next speaker after a stop, Rank the room at the end).
const bigButton = (face, primary) => { const b = mainButton(face); return `<button class="b${primary === false ? '' : ' primary'} timer-go" type="button" data-tact="${b.tact}" data-key="startstop">${goIcon(face)}${esc(b.label)}</button>`; };

// −10 s and +10 s in one quiet track (top 10 #8): rare fixes, not peers of the primary. what: 'prep' or 'speech'.
function toolGroup(what) {
  const of = what === 'prep' ? 'the prep time' : 'the time used';
  return `<span class="tool-group" role="group" aria-label="Correct ${of}">
        <button class="b" type="button" data-tact="minus" aria-label="Take 10 seconds off ${of}">−10 s</button>
        <button class="b" type="button" data-tact="plus" aria-label="Add 10 seconds to ${of}">+10 s</button></span>`;
}
// "Reset time" is quiet, with the rotate icon (top 10 #8).
const resetHtml = `<button class="b quiet" type="button" data-tact="reset">${icon('rotate-ccw')}Reset time</button>`;

// The sticky compact bar (OD1 A; review §2.4 change 2): stage word, time, mini track, the main button, and after a
// stop, "Next speaker". It shows only on a narrow screen while the big card is out of view (the CSS and an
// IntersectionObserver turn it on). The digits are hidden from screen readers, as on the card (the word says the stage).
// primary (design build, top 10 #1): which step holds the solid fill, as on the card ('timer' when left out).
export function stickyBarHtml(face, track, primary) {
  const b = mainButton(face);
  const p = primary || 'timer';
  const shown = cardFace(face);
  const next = face.stage === 'stopped' && face.used > 0 ? `<button class="b small${p === 'next' ? ' primary' : ''}" type="button" data-act="next">Next speaker</button>` : '';
  return `<div class="timer-mini stage-${face.stage}" id="timer-mini" role="group" aria-label="Timer">
      <span class="tm-word" id="tm-word">${esc(face.word)}</span>
      <span class="tm-digits" id="tm-digits" aria-hidden="true">${esc(shown.digits)}</span>
      <span class="tm-track" id="tm-track">${track ? miniTrackHtml(track.model) : ''}</span>
      <button class="b small${p === 'timer' ? ' primary' : ''}" type="button" data-tact="${b.tact}">${esc(b.label)}</button>${next}</div>`;
}

// limit: the event's limit (on a prep event, the shared limit for prep and speech). track: cardTrack(...) (optional;
// without it the card has no signal track and no sticky bar).
// opts (design build, top 10 #1; optional): { primary: 'timer' | 'next' | 'rank' | 'other' (room-primary.js; 'other':
// another part of the room holds it, as the F4 run button), nextHtml: the "Next speaker: U2" button }. Left out, the
// big button is the primary, as before.
export function timerHtml(entry, face, limit, grace, track, opts) {
  if (entry.status === 'noShow') return '<p class="muted timer-none">No show. Undo it in the roster menu to time this speaker.</p>';
  const o = opts || {};
  const p = o.primary || 'timer';
  const over = overGraceHtml(face);
  const shared = Boolean(face.phase);
  const shown = cardFace(face);
  const result = resultPillHtml(face, grace);
  const next = p === 'next' && o.nextHtml ? o.nextHtml : '';
  const btns = shared && face.phase !== 'speech' ? prepButtons(face, p === 'timer') : `${next}${bigButton(face, p === 'timer')}
      ${toolGroup('speech')}
      <button class="b" type="button" data-tact="set">Set time</button>
      ${!face.running && face.used ? resetHtml : ''}`;
  return `<div class="timer-box" id="timer-box">
    <div class="timer-card stage-${face.stage}" id="timer-card"${result ? ` data-result="${stoppedResult(face, grace).kind}"` : ''}>
      <p class="timer-word" id="timer-word">${esc(face.word)}</p>
      <p class="timer-digits" id="timer-digits" aria-hidden="true">${esc(shown.digits)}</p>
      <p class="timer-sub" id="timer-sub">${esc(shown.sub)}</p>
      ${result ? `<p class="timer-result">${result}</p>` : ''}
      ${track ? trackHtml(track.model, { id: 'timer-track', phases: track.phases }) : ''}
      <p class="signal-chip" id="signal-chip" hidden></p>
      <p class="timer-limit">Limit ${clockText(limit)}${shared ? ' for prep and speech' : ''} · grace ${clockText(grace)}</p>
      <div id="timer-flagbox">${over}</div>
    </div>
    <div class="timer-btns">
      ${btns}
    </div>${track ? stickyBarHtml(face, track, p) : ''}</div>`;
}

// The time on a roster row (after the code): the time used (on a prep event, prep and speech), once there is some.
export const rowTimeHtml = (entry, used) => (used > 0 || (entry.timing && (entry.timing.run || entry.timing.prepRun)) ? `<span class="row-time" data-time="${esc(entry.id)}">${clockText(used)}</span>` : '');

// The roster row's time while the room is open: none while the speaker speaks (the timer card shows it, and the name
// keeps its room; review §2.4 change 6), else rowTimeHtml.
export const rosterTimeHtml = (entry, used) => (entry.status === 'speaking' ? '' : rowTimeHtml(entry, used));

// The line under a roster row's name (D3-A): the mini track of a speech with time, and "Over grace" in words when the
// flag is on. Nothing while the speaker speaks, for a no show, or before any time. track: time-track.js rowTrackHtml.
export function rowTrackLine(entry, used, track) {
  if (!entry || entry.status === 'speaking' || entry.status === 'noShow' || !(used > 0)) return '';
  const over = entry.timing && entry.timing.overGrace ? ' ' + statusPillHtml('err', 'Over grace', 'triangle-alert') : '';
  return `<span class="row-track">${track}${over}</span>`;
}

// opts (step S5, optional; the F4 run split, runs.js, uses all three):
//   phasesFor(entry, event, now, limit) -> model  the phase row under the track (phase-bar.js model); design build
//   syncEntry(entry, event, now, limit) -> entry   runs after every change this view makes to an entry, so data kept
//                                                 beside the clock (the runs of a PCC entry) follows the clock
//   resetFields(entry) -> { field: value }         more fields that "Reset time" sets (its Undo puts the old ones back)
//   yieldsPrimary(entry, event, now, limit) -> bool another part of the room holds the one primary (design build,
//                                                 top 10 #1; F4: the next run's button), so the big button is secondary
export function createTimerView(opts) {
  const o = opts || {};
  let ctx = null;
  let active = false;
  let runId = null;
  let prepId = null; // the entry whose prep runs (a prep event)
  let prevLeft = null;
  let lastStage = '';
  let chipUntil = 0;
  let lock = null;
  const env = () => ctx.env;
  const room = () => ctx.room();
  const event = () => roomEvent(env().data.events, room());
  // limit(): the event's limit (on a prep event, the shared limit). lim(e): the limit of e's speech part (on a prep
  // event, what prep left of the shared limit; else the limit). face(e): the card for e.
  const limit = () => limitOf(event());
  const shared = () => hasSharedPrep(event());
  const lim = (e, now) => (shared() ? speechLimit(e.timing, now == null ? env().now() : now, limit()) : limit());
  const faceOf = (e, now) => (shared() ? sharedFace(e, limit(), grace(), now) : timerFace(e, limit(), grace(), now));
  const grace = () => graceOf(room());
  const $ = (s) => env().el.querySelector(s);

  // Save one entry's change to the room.
  const sync = (e) => (o.syncEntry && e ? o.syncEntry(e, event(), env().now(), limit()) : e);
  function change(id, fn) { const r = room(); if (r) ctx.save(updateEntry(r, id, (e) => { const n = fn(e); return n === e ? e : sync(n); }, env().now())); }

  // The driver keeps its run on the entry (timing.run), so a reload or a sleeping phone finds it there.
  const driver = createDriver({
    kind: 'speech',
    get: () => { if (!active || !runId) return null; const e = entryOf(room(), runId); return e && e.timing.run ? e.timing.run : null; },
    set: (run) => change(runId, (e) => Object.assign({}, e, { timing: Object.assign({}, e.timing, { run }) })),
    onStart: () => { change(runId, (e) => Object.assign({}, e, { status: 'speaking' })); wake(true); },
    onStop: (run, left) => {
      const id = runId;
      // A stop before a whole second has passed leaves the speaker waiting, with no time (or mid-turn, after prep).
      change(id, (e) => { const timing = stoppedTiming(e.timing, run, left, lim(e), grace(), env().now()); return Object.assign({}, e, { status: timing.usedMs > 0 ? 'done' : timing.prepMs > 0 ? 'speaking' : 'waiting', timing }); });
      runId = null; prevLeft = null; wake(false);
    },
    onTick: tick,
    now: () => (ctx ? env().now() : Date.now()),
  });
  // The prep clock of a prep event (core/clock.js kind 'prep': it stops at 0). Its run is timing.prepRun.
  const prepDriver = createDriver({
    kind: 'prep',
    get: () => { if (!active || !prepId) return null; const e = entryOf(room(), prepId); return e && e.timing.prepRun ? e.timing.prepRun : null; },
    set: (prepRun) => change(prepId, (e) => Object.assign({}, e, { timing: Object.assign({}, e.timing, { prepRun }) })),
    onStart: () => { change(prepId, (e) => Object.assign({}, e, { status: 'speaking' })); wake(true); },
    onStop: (run, left) => {
      change(prepId, (e) => Object.assign({}, e, { timing: stoppedPrep(e.timing, run, left, limit(), env().now()) }));
      prepId = null; wake(false);
    },
    onTick: tick,
    now: () => (ctx ? env().now() : Date.now()),
  });

  // Keep the screen awake while a clock runs (ARCHITECTURE.md §10), where the browser allows it. The browser drops
  // the lock when the tab is hidden, so it is asked for again when the tab comes back.
  let wanted = false;
  async function wake(on) {
    wanted = on;
    try {
      if (on && !lock && navigator.wakeLock) { lock = await navigator.wakeLock.request('screen'); lock.addEventListener('release', () => { lock = null; }); }
      if (!on && lock) { const l = lock; lock = null; await l.release(); }
    } catch { lock = null; }
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && wanted && active) wake(true); });

  // Every tick: the running entry's flags (sticky), its signal, its roster time, and the card when it is on screen.
  function tick() {
    const r = room();
    if (!r) return;
    const now = env().now();
    if (runId) {
      const e = entryOf(r, runId);
      if (!e || !e.timing.run) { runId = null; driver.follow(); return; } // its entry is gone: nothing to tick
      const face = faceOf(e, now);
      if (face.overGrace !== Boolean(e.timing.overGrace) || face.overLimit !== Boolean(e.timing.overLimit)) {
        change(runId, (x) => Object.assign({}, x, { timing: Object.assign({}, x.timing, { overGrace: face.overGrace, overLimit: face.overLimit }) }));
      }
      // The signals count down the time left: on a prep event, of the shared limit (the speech part's own limit).
      const sig = crossedSignal(prevLeft, face.left, signalPoints(lim(e, now), grace()));
      prevLeft = face.left;
      if (sig) showChip(e, sig.label, now);
      rowTime(runId, totalUsedAt(e.timing, now, limit()));
    }
    if (prepId) {
      const e = entryOf(r, prepId);
      if (!e || !e.timing.prepRun) { prepId = null; prepDriver.follow(); return; }
      rowTime(prepId, prepUsedAt(e.timing, now, limit()));
    }
    paint(now);
  }

  function rowTime(id, used) {
    const cell = env().el.querySelector(`[data-time="${CSS.escape(id)}"]`);
    if (cell) cell.textContent = clockText(used);
  }

  function showChip(e, label, now) {
    chipUntil = now + 3000;
    const chip = $('#signal-chip');
    if (chip && room().current === e.id) { chip.textContent = label; chip.hidden = false; }
    env().ui.announce(e.code + ': ' + label);
  }

  // Update the card in place (no redraw, so the notes box keeps its cursor).
  function paint(now) {
    const r = room();
    const e = r && entryOf(r, r.current);
    const card = $('#timer-card');
    if (!e || !card) return;
    const face = faceOf(e, now);
    card.className = 'timer-card stage-' + face.stage;
    $('#timer-word').textContent = face.word;
    $('#timer-digits').textContent = cardFace(face).digits;
    $('#timer-sub').textContent = cardFace(face).sub;
    // The track and the sticky bar follow the same face (no second clock: this is the one tick).
    const track = cardTrack(e, event(), face, limit(), grace(), now, o.phasesFor);
    const tr = $('#timer-track');
    if (tr) tr.outerHTML = trackHtml(track.model, { id: 'timer-track', phases: track.phases });
    const mini = $('#timer-mini');
    if (mini) {
      mini.className = 'timer-mini stage-' + face.stage + (mini.classList.contains('is-on') ? ' is-on' : '');
      $('#tm-word').textContent = face.word;
      $('#tm-digits').textContent = cardFace(face).digits;
      $('#tm-track').innerHTML = miniTrackHtml(track.model);
    }
    const chip = $('#signal-chip');
    if (chip && now >= chipUntil) chip.hidden = true;
    // The flag line changes in place: a redraw of the main pane would take the cursor out of the notes box.
    const flagBox = $('#timer-flagbox');
    if (flagBox && face.overGrace !== Boolean(flagBox.firstElementChild)) flagBox.innerHTML = overGraceHtml(face);
    // Screen readers hear the stage when it changes, not every second.
    if (face.stage !== lastStage && face.running && (face.stage === 'last' || face.stage === 'grace' || face.stage === 'over')) env().ui.announce(e.code + ': ' + face.word.replace(/ \+.*/, ''));
    lastStage = face.stage;
  }

  // The sticky bar shows while the big card is out of view (the CSS shows it on a narrow screen only). One observer
  // at a time; a redraw of the stage makes a new card, so it watches the new one.
  // A redraw keeps the bar on when it was on, so a tap in the bar does not make it blink off and on.
  let seen = null;
  let barOn = false;
  function unwatch() { if (seen) { seen.disconnect(); seen = null; } }
  function watchCard() {
    unwatch();
    const card = $('#timer-card');
    const mini = $('#timer-mini');
    if (!card || !mini || typeof IntersectionObserver !== 'function') return;
    mini.classList.toggle('is-on', barOn);
    seen = new IntersectionObserver((list) => { const it = list[list.length - 1]; barOn = !it.isIntersecting && it.boundingClientRect.top < 0; mini.classList.toggle('is-on', barOn); });
    seen.observe(card);
  }

  // Only one clock runs in a room: stop the one running for another entry (speech or prep), with a toast.
  function stopOther(id) {
    if (runId && runId !== id) {
      const other = runId;
      driver.stop();
      const o = entryOf(room(), other);
      env().ui.toast('Stopped ' + o.code + ' at ' + clockText(totalUsedAt(o.timing, env().now(), limit())) + '.', { key: 'stopped' });
    }
    if (prepId && prepId !== id) {
      const other = prepId;
      prepDriver.stop();
      const o = entryOf(room(), other);
      env().ui.toast('Stopped prep for ' + o.code + ' at ' + clockText(prepUsedAt(o.timing, env().now(), limit())) + '.', { key: 'stopped' });
    }
  }

  function startStop(id) {
    const r = room();
    const e = entryOf(r, id);
    if (!e || e.status === 'noShow') return;
    if (runId === id) { driver.stop(); ctx.draw(); focusGo(); return; }
    stopOther(id);
    // "Speech started" on a prep event: prep stops first; what it used comes off the shared limit.
    if (prepId === id) prepDriver.stop();
    runId = id; prevLeft = null; lastStage = '';
    const cur = entryOf(room(), id);
    driver.start({ kind: 'speech' }, startLeft(cur.timing, env().now(), lim(cur)));
    ctx.draw(); focusGo();
  }
  // Start or stop prep on a prep event. Prep is closed once the speech has time.
  function prepStartStop(id) {
    const e = entryOf(room(), id);
    if (!e || e.status === 'noShow' || !shared()) return;
    if (prepId === id) { prepDriver.stop(); ctx.draw(); focusGo(); return; }
    if (prepPhase(e.timing) === 'speech') return;
    stopOther(id);
    prepId = id;
    const now = env().now();
    const left = prepStartLeft(e.timing, now, limit());
    prepDriver.start({ kind: 'prep', startLeft: left, startedAt: now }, left);
    ctx.draw(); focusGo();
  }
  // Space and the big button: on a prep event before the speech, ready starts prep and prep goes to the speech.
  function mainAction(id) {
    const e = entryOf(room(), id);
    if (e && shared() && prepPhase(e.timing) === 'ready') return prepStartStop(id);
    return startStop(id);
  }
  // After a start or stop the focus goes to the main button. A tap in the sticky bar keeps the focus in the bar, so
  // the page does not jump back up to the big card while the judge writes.
  let fromBar = false;
  // Design build (top 10 #1): after a stop with speakers left, the focus goes to "Next speaker", the room's primary.
  const focusGo = () => {
    const b = fromBar ? $('#timer-mini [data-tact]') : ($('.timer-btns .next-top') || $('[data-tact="startstop"]'));
    if (b) b.focus({ preventScroll: fromBar });
  };

  // The card's buttons, one handler each. e: the entry on screen.
  const correct = (e, delta, t) => {
    // Before the speech on a prep event, the correction is to the prep time.
    const toPrep = shared() && prepPhase(e.timing) !== 'speech';
    change(e.id, (x) => Object.assign({}, x, { timing: toPrep ? adjustPrep(x.timing, delta, env().now(), limit()) : adjustTiming(x.timing, delta, env().now(), lim(x), grace()) }));
    prevLeft = null; // a correction is not a signal moment
    ctx.drawStage(); restoreFocus(t);
  };
  const handlers = {
    startstop: (e) => startStop(e.id),
    speech: (e) => startStop(e.id),
    prep: (e) => prepStartStop(e.id),
    minus: (e) => correct(e, -10, 'minus'),
    plus: (e) => correct(e, 10, 'plus'),
    async set(e) {
      const txt = await env().ui.ask({ title: 'Set the time used', body: 'Type the time ' + e.code + ' has used so far' + (shared() ? ' in the speech (not prep)' : '') + ', for example 4:30.', input: { label: 'Time used (m:ss)', value: clockText(usedAt(e.timing, env().now(), lim(e))), required: true, emptyError: 'Type a time, for example 4:30.' }, buttons: [{ label: 'Cancel', value: null }, { label: 'Set time', value: 'set', kind: 'primary' }] });
      if (txt == null) return;
      const sec = parseClock(txt);
      if (sec == null) { env().ui.toast('Type the time as minutes and seconds, for example 4:30.', { kind: 'error', key: 'settime' }); return; }
      change(e.id, (x) => Object.assign({}, x, { timing: setUsedTiming(x.timing, sec, env().now(), lim(x), grace()) }));
      prevLeft = null;
      ctx.drawStage();
    },
    // Clearing is refused while the clock still shows the speech past grace (the dialog says so): the safe reading of
    // DESIGN.md §4.2, so a flag only goes when the time was really wrong.
    async clear(e) {
      const ok = await env().ui.ask({ title: 'Clear over grace?', body: ['Clear the flag only if the time was wrong.', 'If the clock still shows ' + e.code + ' past grace, the flag stays.'], buttons: [{ label: 'Cancel', value: false }, { label: 'Clear over grace', value: true, kind: 'danger' }], cancelValue: false });
      if (!ok) return;
      change(e.id, (x) => Object.assign({}, x, { timing: clearedTiming(x.timing, env().now(), lim(x), grace()) }));
      const still = entryOf(room(), e.id).timing.overGrace;
      env().ui.toast(still ? e.code + ' is still past grace on the clock, so the flag stays.' : 'Over grace cleared for ' + e.code + '.', { key: 'clear' });
      ctx.draw();
    },
    reset(e) {
      const extra = o.resetFields ? o.resetFields(e) : {};
      const before = Object.assign({ timing: e.timing, status: e.status }, Object.fromEntries(Object.keys(extra).map((k) => [k, e[k]])));
      change(e.id, (x) => Object.assign({}, x, { status: 'waiting', timing: shared() ? resetAll(x.timing) : resetTiming(x.timing) }, extra));
      ctx.draw();
      env().ui.toast('Time reset for ' + e.code + '.', { action: { label: 'Undo', name: 'Undo: reset time for ' + e.code, run: () => { change(e.id, (x) => Object.assign({}, x, before)); ctx.draw(); } } });
    },
  };
  function onClick(ev) {
    const b = ev.target.closest('[data-tact]');
    fromBar = Boolean(b && b.closest('#timer-mini'));
    const r = room();
    const e = r && entryOf(r, r.current);
    if (b && e && handlers[b.dataset.tact]) handlers[b.dataset.tact](e);
  }
  const restoreFocus = (t) => { const b = $(`[data-tact="${t}"]`); if (b) b.focus(); };

  return {
    // The roster row's time.
    rowExtra: (r, e) => rosterTimeHtml(e, totalUsedAt(e.timing, env().now(), limit())),
    rowSub: (r, e) => { const now = env().now(); return rowTrackLine(e, totalUsedAt(e.timing, now, limit()), rowTrackHtml(e, event(), limit(), grace(), now)); },
    stageHtml: (r, e) => {
      const now = env().now();
      const face = faceOf(e, now);
      // Top 10 #1: the room's one primary. A family part may hold it instead (F4: the next run's button).
      const yields = o.yieldsPrimary && o.yieldsPrimary(e, event(), now, limit());
      const primary = yields ? 'other' : roomPrimary(r, e);
      return timerHtml(e, face, limit(), grace(), cardTrack(e, event(), face, limit(), grace(), now, o.phasesFor), { primary, nextHtml: nextTopHtml(r) });
    },
    mounted() { const box = $('#timer-box'); if (box) box.addEventListener('click', onClick); watchCard(); },
    show(c) {
      ctx = c; active = true; runId = null; prepId = null; prevLeft = null; lastStage = ''; fromBar = false;
      // A reload: bring back each saved run (timer.js restoreRoom; on a prep event prep.js restoreSharedRoom, which
      // brings back the prep runs too; only one clock may run).
      const res = shared() ? restoreSharedRoom(room(), env().now(), limit(), grace()) : restoreRoom(room(), env().now(), limit(), grace());
      if (res.room !== room()) ctx.save(res.room);
      runId = res.runId;
      prepId = res.prepId || null;
      for (const n of res.notes) env().ui.toast(n, { kind: 'error', key: 'restore' });
      driver.follow(); prepDriver.follow();
      if (runId || prepId) wake(true);
    },
    // Leave the screen: the tick stops (get() reads nothing while not active); the run stays saved and keeps time.
    hide() { active = false; driver.follow(); prepDriver.follow(); wake(false); unwatch(); barOn = false; },
    stopFor(id) { if (runId === id) driver.stop(); if (prepId === id) prepDriver.stop(); },
    run(action) { if (action !== 'startStop') return false; fromBar = false; const r = room(); if (r && r.current) mainAction(r.current); return true; },
  };
}
