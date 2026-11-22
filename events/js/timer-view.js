// Speech Events step E5: the timer card on the Room screen (DESIGN.md §3, §4.2; primitives N4, N5). It plugs into
// createRoomScreen as a view (see room-screen.js for the hooks). The rules are in timer.js; the clock that starts,
// stops and ticks is core/clock.js createDriver. Only one clock runs in a room: starting a speaker stops the other.
// The builder at the top is pure (Node tests call it); createTimerView does the DOM.
// Step E11 (Impromptu, prep in the room on a shared limit, N6): a second driver (kind 'prep') times prep, the two-step
// bar "Prep" then "Speech" sits above the digits, and "Speech started" stops prep and starts the speech on what is left
// of the shared limit. The rules are in prep.js.
import { escapeHtml as esc } from '../../core/sheets.js';
import { createDriver } from '../../core/clock.js';
import {
  limitOf, graceOf, clockText, parseClock, usedAt, timerFace, startLeft, stoppedTiming, adjustTiming, setUsedTiming,
  clearedTiming, resetTiming, restoreRoom, signalPoints, crossedSignal,
} from './timer.js';
import { entryOf, updateEntry } from './room.js';
import {
  hasSharedPrep, prepUsedAt, speechLimit, totalUsedAt, prepPhase, prepStartLeft, stoppedPrep, adjustPrep, resetAll, sharedFace,
  restoreSharedRoom,
} from './prep.js';

// The timer card for one entry as HTML text. face: timerFace(...). The stage shows as a fill of the whole card plus a
// word (DESIGN.md §3); colour never carries the meaning alone.
// The over-grace line under the card ('' when the flag is off).
export const overGraceHtml = (face) => (face.overGrace ? `<div class="timer-flag"><span class="pill err">Over grace</span>
      <button class="b small" type="button" data-tact="clear">Clear over grace</button></div>` : '');

// The two-step bar of a prep event (DESIGN.md §4.2), in words: the step on now is marked, a step done shows its time.
// face: prep.js sharedFace(...).
export function phaseBarHtml(face) {
  const inSpeech = face.phase === 'speech';
  const prep = 'Prep' + (face.prepUsed ? ' ' + clockText(face.prepUsed) : '');
  const step = (label, on, done) => `<li class="${on ? 'on' : done ? 'done' : ''}"${on ? ' aria-current="step"' : ''}>${esc(label)}</li>`;
  return `<ol class="phase-bar" id="phase-bar" aria-label="Prep, then speech">${step(prep, !inSpeech && face.phase !== 'ready', inSpeech)}${step('Speech', inSpeech, false)}</ol>`;
}

// The buttons under the card before the speech starts on a prep event: ready, prep running, prep stopped.
function prepButtons(face) {
  if (face.phase === 'ready') return `<button class="b primary timer-go" type="button" data-tact="prep" data-key="startstop">Start prep</button>
      <button class="b" type="button" data-tact="speech">Start speech</button>`;
  return `<button class="b primary timer-go" type="button" data-tact="speech" data-key="startstop">Speech started</button>
      <button class="b" type="button" data-tact="prep">${face.running ? 'Stop prep' : 'Resume prep'}</button>
      <button class="b" type="button" data-tact="minus" aria-label="Take 10 seconds off the prep time">−10 s</button>
      <button class="b" type="button" data-tact="plus" aria-label="Add 10 seconds to the prep time">+10 s</button>
      ${face.running ? '' : '<button class="b quiet" type="button" data-tact="reset">Reset time</button>'}`;
}

// limit: the event's limit (on a prep event, the shared limit for prep and speech).
export function timerHtml(entry, face, limit, grace) {
  if (entry.status === 'noShow') return '<p class="muted timer-none">No show. Undo it in the roster menu to time this speaker.</p>';
  const over = overGraceHtml(face);
  const shared = Boolean(face.phase);
  const btns = shared && face.phase !== 'speech' ? prepButtons(face) : `<button class="b primary timer-go" type="button" data-tact="startstop" data-key="startstop">${face.running ? 'Stop' : face.used ? 'Resume' : 'Start'}</button>
      <button class="b" type="button" data-tact="minus" aria-label="Take 10 seconds off the time used">−10 s</button>
      <button class="b" type="button" data-tact="plus" aria-label="Add 10 seconds to the time used">+10 s</button>
      <button class="b" type="button" data-tact="set">Set time</button>
      ${!face.running && face.used ? '<button class="b quiet" type="button" data-tact="reset">Reset time</button>' : ''}`;
  return `<div class="timer-box" id="timer-box">
    <div class="timer-card stage-${face.stage}" id="timer-card">
      ${shared ? phaseBarHtml(face) : ''}
      <p class="timer-word" id="timer-word">${esc(face.word)}</p>
      <p class="timer-digits" id="timer-digits" aria-hidden="true">${esc(face.digits)}</p>
      <p class="timer-sub" id="timer-sub">${esc(face.sub)}</p>
      <p class="signal-chip" id="signal-chip" hidden></p>
      <p class="timer-limit">Limit ${clockText(limit)}${shared ? ' for prep and speech' : ''} · grace ${clockText(grace)}</p>
    </div>
    <div id="timer-flagbox">${over}</div>
    <div class="timer-btns">
      ${btns}
    </div></div>`;
}

// The time on a roster row (after the code): the time used (on a prep event, prep and speech), once there is some.
export const rowTimeHtml = (entry, used) => (used > 0 || (entry.timing && (entry.timing.run || entry.timing.prepRun)) ? `<span class="row-time" data-time="${esc(entry.id)}">${clockText(used)}</span>` : '');

export function createTimerView() {
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
  const event = () => env().data.events.get(room().eventId, room().eventVersion);
  // limit(): the event's limit (on a prep event, the shared limit). lim(e): the limit of e's speech part (on a prep
  // event, what prep left of the shared limit; else the limit). face(e): the card for e.
  const limit = () => limitOf(event());
  const shared = () => hasSharedPrep(event());
  const lim = (e, now) => (shared() ? speechLimit(e.timing, now == null ? env().now() : now, limit()) : limit());
  const faceOf = (e, now) => (shared() ? sharedFace(e, limit(), grace(), now) : timerFace(e, limit(), grace(), now));
  const grace = () => graceOf(room());
  const $ = (s) => env().el.querySelector(s);

  // Save one entry's change to the room.
  function change(id, fn) { const r = room(); if (r) ctx.save(updateEntry(r, id, fn, env().now())); }

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
    const bar = $('#phase-bar');
    if (bar && face.phase) bar.outerHTML = phaseBarHtml(face);
    $('#timer-word').textContent = face.word;
    $('#timer-digits').textContent = face.digits;
    $('#timer-sub').textContent = face.sub;
    const chip = $('#signal-chip');
    if (chip && now >= chipUntil) chip.hidden = true;
    // The flag line changes in place: a redraw of the main pane would take the cursor out of the notes box.
    const flagBox = $('#timer-flagbox');
    if (flagBox && face.overGrace !== Boolean(flagBox.firstElementChild)) flagBox.innerHTML = overGraceHtml(face);
    // Screen readers hear the stage when it changes, not every second.
    if (face.stage !== lastStage && face.running && (face.stage === 'last' || face.stage === 'grace' || face.stage === 'over')) env().ui.announce(e.code + ': ' + face.word.replace(/ \+.*/, ''));
    lastStage = face.stage;
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
  const focusGo = () => { const b = $('[data-tact="startstop"]'); if (b) b.focus(); };

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
      const before = { timing: e.timing, status: e.status };
      change(e.id, (x) => Object.assign({}, x, { status: 'waiting', timing: shared() ? resetAll(x.timing) : resetTiming(x.timing) }));
      ctx.draw();
      env().ui.toast('Time reset for ' + e.code + '.', { action: { label: 'Undo', name: 'Undo: reset time for ' + e.code, run: () => { change(e.id, (x) => Object.assign({}, x, before)); ctx.draw(); } } });
    },
  };
  function onClick(ev) {
    const b = ev.target.closest('[data-tact]');
    const r = room();
    const e = r && entryOf(r, r.current);
    if (b && e && handlers[b.dataset.tact]) handlers[b.dataset.tact](e);
  }
  const restoreFocus = (t) => { const b = $(`[data-tact="${t}"]`); if (b) b.focus(); };

  return {
    // The roster row's time.
    rowExtra: (r, e) => rowTimeHtml(e, totalUsedAt(e.timing, env().now(), limit())),
    stageHtml: (r, e) => timerHtml(e, faceOf(e, env().now()), limit(), grace()),
    mounted() { const box = $('#timer-box'); if (box) box.addEventListener('click', onClick); },
    show(c) {
      ctx = c; active = true; runId = null; prepId = null; prevLeft = null; lastStage = '';
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
    hide() { active = false; driver.follow(); prepDriver.follow(); wake(false); },
    stopFor(id) { if (runId === id) driver.stop(); if (prepId === id) prepDriver.stop(); },
    run(action) { if (action !== 'startStop') return false; const r = room(); if (r && r.current) mainAction(r.current); return true; },
  };
}
