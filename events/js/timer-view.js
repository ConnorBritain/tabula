// Speech Events step E5: the timer card on the Room screen (DESIGN.md §3, §4.2; primitives N4, N5). It plugs into
// createRoomScreen as a view (see room-screen.js for the hooks). The rules are in timer.js; the clock that starts,
// stops and ticks is core/clock.js createDriver. Only one clock runs in a room: starting a speaker stops the other.
// The pure HTML builders are in timer-card-html.js (Node tests call them); createTimerView keeps the state and the DOM.
// Step E11 (Impromptu, prep in the room on a shared limit, N6): a second driver (kind 'prep') times prep, the two-step
// bar "Prep" then "Speech" sits above the digits, and "Speech started" stops prep and starts the speech on what is left
// of the shared limit. The rules are in prep.js.
// Design build (docs/design/EVENTS-DESIGN-REVIEW.md §2.4–§2.7, top 10 #1, #2 and #3): the signal track under the
// digits (time-track.js, D2-A) replaces the old "Prep, then Speech" pills: on a prep event the phase row
// (phase-bar.js) sits inside the track's box, so the card has one phase control. A roster row shows the mini track
// (D3-A) and drops its time while the speaker speaks (the card shows it). On a phone the sticky compact bar (OD1 A)
// pins to the top while the big card is out of view: it is a second render of the same face, and its button sends
// the same data-tact action to the same handler. It adds no driver, no tick and no key binding.
import { roomPrimary, nextTopHtml } from './room-primary.js';
import { trackParts, miniTrackHtml, rowTrackHtml } from './time-track.js';
import { overGraceHtml, cardFace, cardTrack, timerHtml, rosterTimeHtml, rowTrackLine } from './timer-card-html.js';
import { createDriver } from '../../core/clock.js';
import { cueTick, cueMount } from './timer-cue-view.js';
import {
  limitOf, graceOf, clockText, parseClock, usedAt, timerFace, startLeft, stoppedTiming, adjustTiming, setUsedTiming,
  clearedTiming, resetTiming, restoreRoom, signalPoints, crossedSignal,
} from './timer.js';
import { entryOf, updateEntry, roomEvent } from './room.js';
import {
  hasSharedPrep, prepUsedAt, speechLimit, totalUsedAt, prepPhase, prepStartLeft, stoppedPrep, adjustPrep, resetAll, sharedFace,
  restoreSharedRoom,
} from './prep.js';

// The card's signal track, updated in place each tick (cleanup 2026-11-25, accessibility). A rebuild of the track
// (outerHTML) made a new role="img" node with its long aria-label once a second, so a screen reader on the card lost
// its place and could read the whole label again. This keeps the .track and .track-img nodes and writes only the parts
// whose text changed: the label attribute, the bar (decorative, inside the img), the tick labels and the phase row.
// tr: the #timer-track element. parts: time-track.js trackParts(...). The last parts written are kept per element, so
// a redraw (a new element) starts fresh. Returns the names of the parts it wrote (for the tests).
const trackSeen = new WeakMap();
// The phase row's times (phase-bar.js: <span class="phase-time">4:12</span>, clock text only), and the row without them.
const PHASE_TIME = /<span class="phase-time">([^<]*)<\/span>/g;
const phaseTimes = (html) => [...html.matchAll(PHASE_TIME)].map((m) => m[1]);
const noPhaseTimes = (html) => html.replace(PHASE_TIME, '<span class="phase-time"></span>');
export function patchTrack(tr, parts) {
  const img = tr && tr.querySelector('.track-img');
  if (!img) return [];
  const prev = trackSeen.get(tr) || {};
  const wrote = [];
  if (parts.label !== prev.label && img.getAttribute('aria-label') !== parts.label) { img.setAttribute('aria-label', parts.label); wrote.push('label'); }
  const bar = img.querySelector('.track-bar');
  if (parts.bar !== prev.bar && bar) { bar.outerHTML = parts.bar; wrote.push('bar'); }
  const ticks = img.querySelector('.track-ticks');
  if (parts.ticks !== prev.ticks && ticks) { ticks.innerHTML = parts.ticks; wrote.push('ticks'); }
  if (parts.phases !== prev.phases) {
    const ph = tr.querySelector('.phases');
    // A running prep or phase moves only its time: write just the time text, so the step list (an <ol> with a label)
    // is not rebuilt each second either.
    const times = phaseTimes(parts.phases);
    const spans = ph && prev.phases && noPhaseTimes(prev.phases) === noPhaseTimes(parts.phases) ? ph.querySelectorAll('.phase-time') : null;
    if (spans && spans.length === times.length) { spans.forEach((s, i) => { if (s.textContent !== times[i]) s.textContent = times[i]; }); wrote.push('phase times'); }
    else if (ph && parts.phases) ph.outerHTML = parts.phases;
    else if (ph) ph.remove();
    else if (parts.phases) tr.insertAdjacentHTML('beforeend', parts.phases);
    if (!(spans && spans.length === times.length) && (ph || parts.phases)) wrote.push('phases');
  }
  trackSeen.set(tr, parts);
  return wrote;
}

// opts (step S5, optional; the F4 run split, runs.js, uses all three):
//   phasesFor(entry, event, now, limit) -> model  the phase row under the track (phase-bar.js model); design build
//   syncEntry(entry, event, now, limit) -> entry   runs after every change this view makes to an entry, so data kept
//                                                 beside the clock (the runs of a PCC entry) follows the clock
//   resetFields(entry) -> { field: value }         more fields that "Reset time" sets (its Undo puts the old ones back)
//   startWord(entry, event, now, limit) -> string  the main button's word before any time ("Start Pro")
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
      cueTick(env(), r, e, face, lim(e, now), grace()); // the buzz and the one spoken line at a signal point (timer-cue.js)
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
    patchTrack($('#timer-track'), trackParts(track.model, { phases: track.phases }));
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
    // Screen readers hear each signal point once from cueTick (timer-cue-view.js), not every second.
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
      // Top 10 #1: the room's one primary, from the room screen (a family part may hold it: F4's next-run button).
      const primary = ctx.primary ? ctx.primary(r) : roomPrimary(r, e);
      const startWord = o.startWord ? o.startWord(e, event(), now, limit()) : '';
      return timerHtml(e, face, limit(), grace(), cardTrack(e, event(), face, limit(), grace(), now, o.phasesFor), { primary, nextHtml: nextTopHtml(r), startWord });
    },
    mounted() { const box = $('#timer-box'); if (box) box.addEventListener('click', onClick); watchCard(); cueMount(env(), box, room()); },
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
