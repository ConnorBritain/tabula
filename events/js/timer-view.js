// Speech Events step E5: the timer card on the Room screen (DESIGN.md §3, §4.2; primitives N4, N5). It plugs into
// createRoomScreen as a view (see room-screen.js for the hooks). The rules are in timer.js; the clock that starts,
// stops and ticks is core/clock.js createDriver. Only one clock runs in a room: starting a speaker stops the other.
// The builder at the top is pure (Node tests call it); createTimerView does the DOM.
import { escapeHtml as esc } from '../../core/sheets.js';
import { createDriver } from '../../core/clock.js';
import {
  limitOf, graceOf, clockText, parseClock, usedAt, timerFace, startLeft, stoppedTiming, adjustTiming, setUsedTiming,
  clearedTiming, resetTiming, restoreRoom, signalPoints, crossedSignal,
} from './timer.js';
import { entryOf, updateEntry, roomEvent } from './room.js';

// The timer card for one entry as HTML text. face: timerFace(...). The stage shows as a fill of the whole card plus a
// word (DESIGN.md §3); colour never carries the meaning alone.
// The over-grace line under the card ('' when the flag is off).
export const overGraceHtml = (face) => (face.overGrace ? `<div class="timer-flag"><span class="pill err">Over grace</span>
      <button class="b small" type="button" data-tact="clear">Clear over grace</button></div>` : '');

export function timerHtml(entry, face, limit, grace) {
  if (entry.status === 'noShow') return '<p class="muted timer-none">No show. Undo it in the roster menu to time this speaker.</p>';
  const over = overGraceHtml(face);
  return `<div class="timer-box" id="timer-box">
    <div class="timer-card stage-${face.stage}" id="timer-card">
      <p class="timer-word" id="timer-word">${esc(face.word)}</p>
      <p class="timer-digits" id="timer-digits" aria-hidden="true">${esc(face.digits)}</p>
      <p class="timer-sub" id="timer-sub">${esc(face.sub)}</p>
      <p class="signal-chip" id="signal-chip" hidden></p>
      <p class="timer-limit">Limit ${clockText(limit)} · grace ${clockText(grace)}</p>
    </div>
    <div id="timer-flagbox">${over}</div>
    <div class="timer-btns">
      <button class="b primary timer-go" type="button" data-tact="startstop" data-key="startstop">${face.running ? 'Stop' : face.used ? 'Resume' : 'Start'}</button>
      <button class="b" type="button" data-tact="minus" aria-label="Take 10 seconds off the time used">−10 s</button>
      <button class="b" type="button" data-tact="plus" aria-label="Add 10 seconds to the time used">+10 s</button>
      <button class="b" type="button" data-tact="set">Set time</button>
      ${!face.running && face.used ? '<button class="b quiet" type="button" data-tact="reset">Reset time</button>' : ''}
    </div></div>`;
}

// The time on a roster row (after the code): the time used, once there is some.
export const rowTimeHtml = (entry, used) => (used > 0 || (entry.timing && entry.timing.run) ? `<span class="row-time" data-time="${esc(entry.id)}">${clockText(used)}</span>` : '');

export function createTimerView() {
  let ctx = null;
  let active = false;
  let runId = null;
  let prevLeft = null;
  let lastStage = '';
  let chipUntil = 0;
  let lock = null;
  const env = () => ctx.env;
  const room = () => ctx.room();
  const limit = () => limitOf(roomEvent(env().data.events, room()));
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
      // A stop before a whole second has passed leaves the speaker waiting, with no time.
      change(id, (e) => { const timing = stoppedTiming(e.timing, run, left, limit(), grace(), env().now()); return Object.assign({}, e, { status: timing.usedMs > 0 ? 'done' : 'waiting', timing }); });
      runId = null; prevLeft = null; wake(false);
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
      const face = timerFace(e, limit(), grace(), now);
      if (face.overGrace !== Boolean(e.timing.overGrace) || face.overLimit !== Boolean(e.timing.overLimit)) {
        change(runId, (x) => Object.assign({}, x, { timing: Object.assign({}, x.timing, { overGrace: face.overGrace, overLimit: face.overLimit }) }));
      }
      const sig = crossedSignal(prevLeft, face.left, signalPoints(limit(), grace()));
      prevLeft = face.left;
      if (sig) showChip(e, sig.label, now);
      const cell = env().el.querySelector(`[data-time="${CSS.escape(runId)}"]`);
      if (cell) cell.textContent = clockText(face.used);
    }
    paint(now);
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
    const face = timerFace(e, limit(), grace(), now);
    card.className = 'timer-card stage-' + face.stage;
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

  function startStop(id) {
    const r = room();
    const e = entryOf(r, id);
    if (!e || e.status === 'noShow') return;
    if (runId === id) { driver.stop(); ctx.draw(); focusGo(); return; }
    if (runId) {
      const other = entryOf(r, runId);
      driver.stop();
      env().ui.toast('Stopped ' + other.code + ' at ' + clockText(usedAt(entryOf(room(), other.id).timing, env().now(), limit())) + '.', { key: 'stopped' });
    }
    runId = id; prevLeft = null; lastStage = '';
    driver.start({ kind: 'speech' }, startLeft(entryOf(room(), id).timing, env().now(), limit()));
    ctx.draw(); focusGo();
  }
  const focusGo = () => { const b = $('[data-tact="startstop"]'); if (b) b.focus(); };

  // The card's buttons, one handler each. e: the entry on screen.
  const correct = (e, delta, t) => {
    change(e.id, (x) => Object.assign({}, x, { timing: adjustTiming(x.timing, delta, env().now(), limit(), grace()) }));
    prevLeft = null; // a correction is not a signal moment
    ctx.drawStage(); restoreFocus(t);
  };
  const handlers = {
    startstop: (e) => startStop(e.id),
    minus: (e) => correct(e, -10, 'minus'),
    plus: (e) => correct(e, 10, 'plus'),
    async set(e) {
      const txt = await env().ui.ask({ title: 'Set the time used', body: 'Type the time ' + e.code + ' has used so far, for example 4:30.', input: { label: 'Time used (m:ss)', value: clockText(usedAt(e.timing, env().now(), limit())), required: true, emptyError: 'Type a time, for example 4:30.' }, buttons: [{ label: 'Cancel', value: null }, { label: 'Set time', value: 'set', kind: 'primary' }] });
      if (txt == null) return;
      const sec = parseClock(txt);
      if (sec == null) { env().ui.toast('Type the time as minutes and seconds, for example 4:30.', { kind: 'error', key: 'settime' }); return; }
      change(e.id, (x) => Object.assign({}, x, { timing: setUsedTiming(x.timing, sec, env().now(), limit(), grace()) }));
      prevLeft = null;
      ctx.drawStage();
    },
    // Clearing is refused while the clock still shows the speech past grace (the dialog says so): the safe reading of
    // DESIGN.md §4.2, so a flag only goes when the time was really wrong.
    async clear(e) {
      const ok = await env().ui.ask({ title: 'Clear over grace?', body: ['Clear the flag only if the time was wrong.', 'If the clock still shows ' + e.code + ' past grace, the flag stays.'], buttons: [{ label: 'Cancel', value: false }, { label: 'Clear over grace', value: true, kind: 'danger' }], cancelValue: false });
      if (!ok) return;
      change(e.id, (x) => Object.assign({}, x, { timing: clearedTiming(x.timing, env().now(), limit(), grace()) }));
      const still = entryOf(room(), e.id).timing.overGrace;
      env().ui.toast(still ? e.code + ' is still past grace on the clock, so the flag stays.' : 'Over grace cleared for ' + e.code + '.', { key: 'clear' });
      ctx.draw();
    },
    reset(e) {
      const before = { timing: e.timing, status: e.status };
      change(e.id, (x) => Object.assign({}, x, { status: 'waiting', timing: resetTiming(x.timing) }));
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
    rowExtra: (r, e) => rowTimeHtml(e, usedAt(e.timing, env().now(), limit())),
    stageHtml: (r, e) => timerHtml(e, timerFace(e, limit(), grace(), env().now()), limit(), grace()),
    mounted() { const box = $('#timer-box'); if (box) box.addEventListener('click', onClick); },
    show(c) {
      ctx = c; active = true; runId = null; prevLeft = null; lastStage = '';
      // A reload: bring back each saved run (timer.js restoreRoom; only one clock may run).
      const res = restoreRoom(room(), env().now(), limit(), grace());
      if (res.room !== room()) ctx.save(res.room);
      runId = res.runId;
      for (const n of res.notes) env().ui.toast(n, { kind: 'error', key: 'restore' });
      driver.follow();
      if (runId) wake(true);
    },
    // Leave the screen: the tick stops (get() reads nothing while not active); the run stays saved and keeps time.
    hide() { active = false; driver.follow(); wake(false); },
    stopFor(id) { if (runId === id) driver.stop(); },
    run(action) { if (action !== 'startStop') return false; const r = room(); if (r && r.current) startStop(r.current); return true; },
  };
}
