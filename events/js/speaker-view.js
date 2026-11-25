// The speaker view: a full-screen face of the room timer that the judge can turn toward the speaker. It is off until
// the judge taps "Speaker view" on the timer card; nothing is saved about it, and it closes when the judge leaves the
// room. It shows big digits (time left, then time over), the phase in words and as a tinted pill ("Time left",
// "1:00 left", "Grace", "Over time"), the signal track, and one big Start / Stop button.
//
// It has no clock of its own. The room timer (timer-view.js) owns the one driver and the one tick; on each tick it
// hands this view a fresh model (speakerModel) and the view writes it into the page. Start / Stop here calls the
// timer view's own main action.
//
// The top of this file is pure (Node tests call it). createSpeakerView does the DOM: a dialog over the page, the
// Fullscreen API where the browser has it (else the dialog simply covers the viewport), a screen wake lock while it is
// open, Space and Esc, and focus in and back out.
import { escapeHtml as esc } from '../../core/sheets.js';
import { icon } from './icons.js';
import { statusPillHtml } from './status-pill.js';
import { cardFace, mainButton } from './timer-card-html.js';
import { clockText } from './timer.js';
import { createWakeLock } from './wake-lock.js';

// The phase in words, for the speaker. face: timer.js timerFace or prep.js sharedFace. points: timer.js signalPoints
// for the speech (seconds left at each signal). grace: seconds.
// Returns { key, word, tone, icon }: key changes only when the phase or the last signal passed changes (the live
// region speaks then, not each second); tone is a status-pill tone (status-pill.js), so colour follows the pill rules
// and the word always says the same thing.
export function speakerPhase(face, points, grace) {
  const f = face || {};
  if (f.stage === 'ready') return { key: 'ready', word: 'Ready', tone: '', icon: 'circle' };
  if (f.stage === 'prep') return { key: 'prep', word: 'Prep', tone: 'live', icon: 'circle-play' };
  if (f.stage === 'stopped') return f.phase && f.phase !== 'speech'
    ? { key: 'prep-stopped', word: 'Prep stopped', tone: '', icon: 'pause' }
    : { key: 'stopped', word: 'Stopped', tone: '', icon: 'pause' };
  const left = Number(f.left) || 0;
  const g = Math.max(0, Number(grace) || 0);
  if (left < -g) return { key: 'over', word: 'Over time', tone: 'err', icon: 'triangle-alert' };
  if (left < 0) return { key: 'grace', word: 'Grace', tone: 'caution', icon: 'info' };
  // The last signal passed: the smallest signal point at or above the time left (only the points inside the limit).
  let at = null;
  for (const p of Array.isArray(points) ? points : []) if (p.at >= 0 && left <= p.at && (at === null || p.at < at)) at = p.at;
  if (at === 0) return { key: 'sig-0', word: 'Time', tone: 'caution', icon: 'info' };
  if (at !== null) return { key: 'sig-' + at, word: clockText(at) + ' left', tone: at <= 60 ? 'caution' : 'live', icon: at <= 60 ? 'info' : 'circle-play' };
  return { key: 'speaking', word: 'Time left', tone: 'live', icon: 'circle-play' };
}

// Everything the speaker view shows, from the same face the timer card shows. opts: { points, grace, startWord, code }.
// Returns { stage, digits, sub, phase, button: { label, running }, code }.
export function speakerModel(face, opts) {
  const o = opts || {};
  const f = face || {};
  const shown = cardFace(f) || {};
  const b = mainButton(f, o.startWord);
  return {
    stage: String(f.stage || 'ready'),
    digits: String(shown.digits || '0:00'),
    sub: String(shown.sub || ''),
    phase: speakerPhase(f, o.points, o.grace),
    button: { label: b.label, running: Boolean(f.running) },
    code: String(o.code || ''),
  };
}

// The "Speaker view" button on the timer card: only while a speaker is up (ready to start, or the clock is in use).
// entry: the current entry; face: its timer face.
export function showSpeakerButton(entry, face) {
  if (!entry || !face || entry.status === 'noShow' || entry.status === 'crossEntered') return false;
  return Boolean(face.running) || face.stage === 'ready' || face.stage === 'prep' || entry.status === 'speaking';
}
export const speakerButtonHtml = () => `<p class="speaker-open"><button class="b quiet" type="button" data-sv="open" aria-haspopup="dialog">Speaker view</button></p>`;

// The pieces that change on each update, as HTML text.
export const phaseHtml = (m) => statusPillHtml(m.phase.tone, m.phase.word, m.phase.icon);
export const goHtml = (m) => `${icon(m.button.running ? 'pause' : 'play', 28)}${esc(m.button.label)}`;

// The whole view as HTML text. track: time-track.js trackHtml(...) with id "sv-track", or ''.
export function speakerViewHtml(m, track) {
  return `<div class="sv-top">
      <h2 class="sv-title" id="sv-title"><span class="sr-only">Speaker view: </span>${esc(m.code)}</h2>
      <button class="b sv-back" type="button" data-sv="back">${icon('chevron-left')}Back to judge view</button>
    </div>
    <div class="sv-main">
      <p class="sv-phase" id="sv-phase">${phaseHtml(m)}</p>
      <p class="sv-digits" id="sv-digits" role="timer" aria-describedby="sv-sub">${esc(m.digits)}</p>
      <p class="sv-sub" id="sv-sub">${esc(m.sub)}</p>
      ${track || ''}
    </div>
    <div class="sv-foot">
      <button class="b primary sv-go" type="button" data-sv="main">${goHtml(m)}</button>
      <p class="sv-hint">Space starts or stops. Esc goes back.</p>
    </div>
    <p class="sr-only" id="sv-live" aria-live="polite" aria-atomic="true"></p>`;
}

// The DOM part. opts:
//   onMain()     Start / Stop (the timer view's own main action)
//   onClose()    after the view closes (the timer view puts the focus back on the card)
//   doc, nav     the page's document and navigator (tests pass stand-ins)
//   host         where the dialog goes (document.body when left out)
//   escLayer     core/ui.js escLayer, so Esc closes this before anything under it (optional)
// Returns { open(model, track), update(model), close(), isOpen(), focusMain(), trackEl() }.
export function createSpeakerView(opts) {
  const o = opts || {};
  const doc = () => o.doc || globalThis.document;
  const awake = createWakeLock({ nav: o.nav || globalThis.navigator, doc: o.doc || globalThis.document });
  let root = null;
  let shown = null; // the last model written
  let wentFull = false;
  const q = (s) => (root ? root.querySelector(s) : null);

  function onKey(ev) {
    if (!root) return;
    const key = ev.key;
    if (key === 'Escape' && !ev.isComposing) { ev.preventDefault(); close(); }
    else if (key === ' ' || key === 'Spacebar') {
      // On a button, Space keeps its native job (it presses that button). Anywhere else in the view it is Start / Stop.
      const onButton = ev.target && typeof ev.target.closest === 'function' && ev.target.closest('button');
      if (!onButton) { ev.preventDefault(); if (o.onMain) o.onMain(); }
    } else if (key === 'Tab') {
      // Keep Tab inside the view: Back, then the big button.
      const list = [q('[data-sv="back"]'), q('[data-sv="main"]')].filter(Boolean);
      const at = list.indexOf(doc().activeElement);
      const next = ev.shiftKey ? (at <= 0 ? list[list.length - 1] : list[at - 1]) : (at === -1 || at === list.length - 1 ? list[0] : list[at + 1]);
      if (next) { ev.preventDefault(); next.focus(); }
    }
    // Room shortcuts (number keys, Space on the card) must not reach the page behind.
    if (typeof ev.stopPropagation === 'function') ev.stopPropagation();
  }
  function onClick(ev) {
    const b = ev.target && typeof ev.target.closest === 'function' ? ev.target.closest('[data-sv]') : null;
    if (!b) return;
    const act = b.getAttribute('data-sv');
    if (act === 'back') close();
    else if (act === 'main' && o.onMain) o.onMain();
  }
  // Leaving full screen (the browser's own Esc or gesture) goes back to the judge view too.
  function onFull() {
    const d = doc();
    const full = d && (d.fullscreenElement || d.webkitFullscreenElement);
    if (root && wentFull && !full) { wentFull = false; close(); }
  }

  function goFull() {
    const d = doc();
    const ask = root.requestFullscreen || root.webkitRequestFullscreen;
    if (typeof ask !== 'function' || (d && d.fullscreenEnabled === false)) return;
    try {
      const p = ask.call(root);
      wentFull = true;
      if (p && typeof p.then === 'function') p.then(() => { wentFull = true; }, () => { wentFull = false; });
    } catch { wentFull = false; }
  }
  function leaveFull() {
    const d = doc();
    if (!d) return;
    const full = d.fullscreenElement || d.webkitFullscreenElement;
    if (!full || full !== root) return;
    const exit = d.exitFullscreen || d.webkitExitFullscreen;
    try { const p = typeof exit === 'function' ? exit.call(d) : null; if (p && typeof p.catch === 'function') p.catch(() => {}); } catch { /* already out */ }
  }

  function open(model, track) {
    const d = doc();
    if (root || !d) return;
    root = d.createElement('div');
    root.className = 'speaker-view stage-' + model.stage;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'sv-title');
    root.innerHTML = speakerViewHtml(model, track);
    shown = model;
    root.addEventListener('keydown', onKey);
    root.addEventListener('click', onClick);
    (o.host || d.body).appendChild(root);
    try { d.addEventListener('fullscreenchange', onFull); d.addEventListener('webkitfullscreenchange', onFull); } catch { /* no events */ }
    goFull();
    awake.request();
    focusMain();
  }

  function update(model) {
    if (!root || !model) return;
    const cls = 'speaker-view stage-' + model.stage;
    if (root.className !== cls) root.className = cls;
    const dg = q('#sv-digits'); if (dg && dg.textContent !== model.digits) dg.textContent = model.digits;
    const sb = q('#sv-sub'); if (sb && sb.textContent !== model.sub) sb.textContent = model.sub;
    if (!shown || shown.phase.key !== model.phase.key) {
      const ph = q('#sv-phase'); if (ph) ph.innerHTML = phaseHtml(model);
      // The live region speaks when the phase changes, never on each second.
      const live = q('#sv-live'); if (live) live.textContent = model.phase.word;
    }
    if (!shown || shown.button.label !== model.button.label || shown.button.running !== model.button.running) {
      const go = q('[data-sv="main"]'); if (go) go.innerHTML = goHtml(model);
    }
    shown = model;
  }

  function close() {
    if (!root) return;
    const d = doc();
    leaveFull();
    try { d.removeEventListener('fullscreenchange', onFull); d.removeEventListener('webkitfullscreenchange', onFull); } catch { /* no events */ }
    root.removeEventListener('keydown', onKey);
    root.removeEventListener('click', onClick);
    root.remove();
    root = null; shown = null; wentFull = false;
    awake.release();
    if (o.onClose) o.onClose();
  }

  function focusMain() { const b = q('[data-sv="main"]'); if (b) b.focus(); }

  if (typeof o.escLayer === 'function') o.escLayer('speaker-view', 80, () => Boolean(root), close);

  return Object.freeze({ open, update, close, isOpen: () => Boolean(root), focusMain, trackEl: () => q('#sv-track') });
}
