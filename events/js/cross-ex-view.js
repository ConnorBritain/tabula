// Speech Events step S4: the F2 (extemp) parts on the Room screen (docs/events/EXPERIENCE.md §3, §3.2). It plugs into
// createRoomScreen as a view, under the timer card (room-screen.js names the hooks):
//   - "Waiting for next speaker · about 7 min" between speakers (the draw gap setting), every F2 round;
//   - in an elim round whose profile turns on cross-ex: the phase bar (Speak, then Cross-ex), "Q: speaker X" with a
//     pick, the speaker's school (optional), the same-school warning, and the cross-ex clock.
// Design build (review §2.5 change 3): before the speech stops, the block is closed: only the phase row (Speak now,
// Cross-ex next) and one line, so the 7-minute speech has one clock on screen. It opens when the speech stops with
// time (or once cross-ex has time). The phase row is phase-bar.js, the one phase renderer (no pills of its own).
// The rules are in cross-ex.js. The builders at the top are pure (Node tests call them); createCrossExView does the DOM.
import { escapeHtml as esc } from '../../core/sheets.js';
import { clockText, limitOf } from './timer.js';
import { entryOf, present, roomEvent } from './room.js';
import {
  cxOn, cxLimit, askerOf, setAsker, setSchool, sameSchoolWarning, cxUsed, cxRunning, startCx, stopCx, resetCx, phases,
} from './cross-ex.js';
import { waitingLine } from './draw-gap.js';
import { phasesHtml } from './phase-bar.js';
import { drawGapOf } from './settings.js';

const secs = (ms) => Math.floor(ms / 1000);

// The cross-ex digits and word: counts up; with a limit, "over" past it.
export function cxFace(entry, limitSec, now) {
  const used = secs(cxUsed(entry, now));
  const over = Boolean(limitSec) && used > limitSec;
  return { digits: clockText(used) + (limitSec ? ' / ' + clockText(limitSec) : ''), over, running: cxRunning(entry), used };
}

// Is the cross-ex block open? Once the speech has stopped with time, or once cross-ex has time or runs.
export function cxOpen(entry, now) {
  const t = (entry && entry.timing) || {};
  return ((t.usedMs || 0) > 0 && !t.run) || cxUsed(entry, now) > 0 || cxRunning(entry);
}

// The phase row model (phase-bar.js) from cross-ex.js phases(...). closed: the block is not open yet, so the line
// says when it opens.
export function cxPhaseModel(ph, closed) {
  const at = ph.list.findIndex((p) => p.state === 'now');
  const cx = ph.list[1];
  return {
    label: 'Speak, then cross-ex',
    phases: ph.list.map((p) => ({ id: p.id, label: p.label })),
    current: at < 0 ? ph.list.length : at,
    next: closed ? 'Next: ' + cx.label + '. It opens when the speech stops.' : ph.nextLine,
  };
}

// The cross-ex part for one entry as HTML text ('' when cross-ex is off or the entry is a no show).
export function crossExHtml(room, entry, event, now) {
  if (!cxOn(room, event) || !entry || entry.status === 'noShow') return '';
  const lim = cxLimit(room.profile);
  const ph = phases(entry, limitOf(event), lim, now);
  if (!cxOpen(entry, now)) {
    return `<fieldset class="crossex is-closed" id="crossex"><legend>Cross-ex <span class="muted">(elim round)</span></legend>
    ${phasesHtml(cxPhaseModel(ph, true), { id: 'cx-phases' })}</fieldset>`;
  }
  const asker = askerOf(room, entry.id);
  const others = present(room).filter((x) => x.id !== entry.id);
  const warn = sameSchoolWarning(room, entry.id);
  const face = cxFace(entry, lim, now);
  // Design build (top 10 #1): the cross-ex clock is secondary; the speaker timer's step keeps the room's one primary.
  return `<fieldset class="crossex" id="crossex"><legend>Cross-ex <span class="muted">(elim round)</span></legend>
    ${phasesHtml(cxPhaseModel(ph, false), { id: 'cx-phases' })}
    <div class="cx-fields">
      <label class="field"><span>Q: asked by</span><select id="cx-asker" data-cxfield="asker">${others.map((o) => `<option value="${esc(o.id)}"${asker && asker.id === o.id ? ' selected' : ''}>Speaker ${esc(o.code)}</option>`).join('')}</select></label>
      <label class="field"><span>School of ${esc(entry.code)} <span class="muted">(optional)</span></span><input id="cx-school" data-cxfield="school" autocomplete="off" maxlength="60" value="${esc(entry.school || '')}"></label>
    </div>
    ${warn ? `<p class="cx-warn" id="cx-warn" role="status">${esc(warn)}</p>` : ''}
    <div class="cx-clock${face.over ? ' over' : ''}"><span class="cx-digits" id="cx-digits">${esc(face.digits)}</span>${face.over ? ' <span class="pill err">Over</span>' : ''}
      <button class="b" type="button" data-cxact="startstop" data-key="cx-startstop">${face.running ? 'Stop cross-ex' : face.used ? 'Resume cross-ex' : 'Start cross-ex'}</button>
      ${!face.running && face.used ? '<button class="b quiet" type="button" data-cxact="reset" data-key="cx-reset">Reset</button>' : ''}</div>
    ${lim ? '' : '<p class="field-help">The cross-ex length is not set in these rules. Follow the tab room.</p>'}
  </fieldset>`;
}

// The waiting line as HTML text ('' when it does not show).
export const waitingHtml = (line) => (line ? `<p class="waiting-line muted" id="waiting-line" role="status">${esc(line)}</p>` : '');

export function createCrossExView() {
  let ctx = null;
  let tick = null;
  const env = () => ctx.env;
  const event = (r) => roomEvent(env().data.events, r);
  const gap = () => drawGapOf(env().settings ? env().settings() : null);

  function stopTick() { if (tick) { clearInterval(tick); tick = null; } }
  // While the cross-ex clock runs, or the waiting line shows, the digits redraw once a second.
  function startTick() {
    stopTick();
    tick = setInterval(() => {
      const r = ctx && ctx.room();
      if (!r) return stopTick();
      const e = entryOf(r, r.current);
      const d = env().el.querySelector('#cx-digits');
      if (d && e) d.textContent = cxFace(e, cxLimit(r.profile), env().now()).digits;
      const w = env().el.querySelector('#waiting-line');
      if (w) { const line = waitingLine(r, event(r), env().now(), gap()); if (line) w.textContent = line; else w.remove(); }
    }, 1000);
  }

  function onClick(ev) {
    const b = ev.target.closest('[data-cxact]');
    const r = ctx.room();
    if (!b || !r || !r.current) return;
    const now = env().now();
    if (b.dataset.cxact === 'startstop') {
      const e = entryOf(r, r.current);
      if (cxRunning(e)) { ctx.save(stopCx(r, e.id, now)); env().ui.announce('Cross-ex stopped.'); }
      else {
        const res = startCx(r, e.id, now);
        if (res.refused) { env().ui.toast(res.refused, { kind: 'error', key: 'cx' }); return; }
        ctx.save(res.room); env().ui.announce('Cross-ex started.');
      }
    }
    if (b.dataset.cxact === 'reset') {
      const before = entryOf(r, r.current);
      ctx.save(resetCx(r, r.current, now));
      env().ui.toast('Cross-ex time reset.', { action: { label: 'Undo', name: 'Undo: reset cross-ex', run: () => {
        const cur = ctx.room(); if (!cur) return;
        ctx.save(Object.assign({}, cur, { entries: cur.entries.map((x) => (x.id === before.id ? Object.assign({}, x, { cx: before.cx }) : x)) }));
        ctx.drawStage();
      } } });
    }
    ctx.drawStage();
  }

  function onChange(ev) {
    const f = ev.target.dataset && ev.target.dataset.cxfield;
    const r = ctx.room();
    if (!f || !r || !r.current) return;
    if (f === 'asker') { ctx.save(setAsker(r, r.current, ev.target.value, env().now())); ctx.drawStage(); }
  }
  function onInput(ev) {
    if (!(ev.target.dataset && ev.target.dataset.cxfield === 'school')) return;
    const r = ctx.room();
    if (!r || !r.current) return;
    ctx.save(setSchool(r, r.current, ev.target.value, env().now()));
    // The warning line follows the school as the judge types; the box keeps its focus (room-screen keeps it by id).
    const warn = sameSchoolWarning(ctx.room(), r.current);
    const had = env().el.querySelector('#cx-warn');
    if (Boolean(warn) !== Boolean(had) || (had && !had.textContent.includes(warn))) ctx.drawStage();
  }

  return {
    stageHtml(r, e) {
      const now = env().now();
      return waitingHtml(waitingLine(r, event(r), now, gap())) + crossExHtml(r, e, event(r), now);
    },
    mounted() {
      const r = ctx.room();
      const e = r && entryOf(r, r.current);
      const box = env().el.querySelector('#crossex');
      if (box) { box.addEventListener('click', onClick); box.addEventListener('change', onChange); box.addEventListener('input', onInput); }
      if ((e && cxRunning(e)) || env().el.querySelector('#waiting-line')) startTick(); else stopTick();
    },
    show(c) { ctx = c; },
    hide() { stopTick(); },
    // Removing an entry stops its clock first (room-screen.js): the cross-ex time is kept as stopped.
    stopFor(id) { const r = ctx && ctx.room(); if (r && entryOf(r, id) && cxRunning(entryOf(r, id))) ctx.save(stopCx(r, id, env().now())); },
  };
}
