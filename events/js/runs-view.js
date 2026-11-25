// Speech Events step S5 (docs/events/EXPERIENCE.md §3 F4 row): the Room screen parts of an F4 round (PCC: one entry,
// two runs, Pro then Con under one 10:30 limit). They plug into createRoomScreen as views (room-screen.js names the
// hooks), around the shipped timer card:
//   timer view   the shipped timer card (timer-view.js), with the run split kept in step with the clock (runs.js);
//                its signal track has two pieces (Pro, Con) and the phase row (phase-bar.js) with the "Next: ..." line
//                under it (design build, review §2.7: one control in place of the pills, the line and the cards)
//   cards view   one run card per run (its time, and Done, Now or Not started) and the "Con started" button
// The student's topic is the quote line at the top of the card (quote-view.js, review §2.7 and §2.6).
// The rules are in runs.js. There is no minimum time for a run: a card shows the time and never a warning.
// The builders at the top are pure (Node tests call them); createRunsParts does the DOM.
import { escapeHtml as esc } from '../../core/sheets.js';
import { icon } from './icons.js';
import { clockText, limitOf } from './timer.js';
import { entryOf, updateEntry, roomEvent } from './room.js';
import { createTimerView } from './timer-view.js';
import { eventRuns, runsAt, syncRuns, syncAll, labelOf, resetRunFields, markNextRun, unmarkLastRun, runsPhase, runsBarModel, runsLine } from './runs.js';

// The run cards and the "<next> started" button for one entry ('' for a no show).
export function runCardsHtml(entry, event, now, limit) {
  if (!entry || entry.status === 'noShow') return '';
  const sides = eventRuns(event);
  const runs = runsAt(entry, event, now, limit);
  const { index } = runsPhase(entry, event, now, limit);
  const running = Boolean(entry.timing && entry.timing.run);
  // Color review §6 PCC: one card stands out, with a 2 px edge and a pill: the run on the clock says "Live"; the run to
  // start next says "Next" (before Pro, and after Pro stops). A run with no time yet shows the shared limit, not "–".
  const on = running ? index : index < sides.length ? index + 1 : -1;
  const cards = sides.map((s, i) => {
    const r = runs[i];
    const word = i === on ? (running ? 'Live' : 'Next') : i < index || index === sides.length ? 'Done' : i === index ? 'Stopped' : 'Not started';
    const cls = i === on ? (running ? 'run-word pill live' : 'run-word pill') : 'run-word muted';
    return `<li class="run-card${i === on ? ' is-on' : ''}" data-side="${esc(s.side)}">
      <span class="run-label">${esc(s.label)}</span>
      <span class="run-time" data-run-time="${esc(s.side)}">${r ? clockText(Math.floor(r.ms / 1000)) : 'of ' + clockText(limit)}</span>
      <span class="${cls}" data-run-word="${esc(s.side)}">${esc(word)}</span></li>`;
  }).join('');
  const nextSide = index >= 0 && index < sides.length - 1 ? sides[index + 1] : null;
  // Design build (top 10 #1): while a next run waits, this button is the room's one primary ("Pro done · start Con");
  // the timer's big button steps down (createRunsParts passes yieldsPrimary).
  const btn = nextSide ? `<button class="b primary" type="button" data-ract="next" data-key="run-next">${esc(sides[index].label)} done · start ${esc(nextSide.label)}${icon('arrow-right', 20)}</button>` : '';
  return `<div class="runs" id="runs"><ol class="run-cards" aria-label="Runs">${cards}</ol>
    <p class="field-help">One limit covers every run. Each run shows its own time, with no minimum.</p>
    ${btn ? `<div class="run-btns">${btn}</div>` : ''}</div>`;
}

// A next run waits (its button shows): that button is the room's primary (top 10 #1).
export function nextRunWaits(entry, event, now, limit) {
  if (!entry || entry.status === 'noShow') return false;
  const { index } = runsPhase(entry, event, now, limit);
  return index >= 0 && index < eventRuns(event).length - 1;
}

// The time of each run on a roster row ('' with no time yet).
export const runsRowHtml = (entry, event, now, limit) => {
  const line = runsLine(entry, event, now, limit);
  return line ? `<span class="row-runs muted" data-runs-row="${esc(entry.id)}">${esc(line)}</span>` : '';
};

// The two views for an F4 Room screen: [timer, cards]. app.js passes them (with the quote and comment views) to
// createRoomScreen.
export function createRunsParts() {
  let ctx = null;
  let ticker = null;
  const env = () => ctx.env;
  const room = () => ctx.room();
  const event = () => roomEvent(env().data.events, room());
  const limit = () => limitOf(event());
  const $ = (s) => env().el.querySelector(s);

  const timer = createTimerView({
    syncEntry: (e, ev, now, lim) => syncRuns(e, ev, now, lim),
    resetFields: () => resetRunFields(),
    phasesFor: (e, ev, now, lim) => runsBarModel(e, ev, now, lim),
    yieldsPrimary: (e, ev, now, lim) => nextRunWaits(e, ev, now, lim),
    startWord: (e, ev, now, lim) => (runsPhase(e, ev, now, lim).index === -1 ? 'Start ' + eventRuns(ev)[0].label : ''),
  });

  // While the clock runs, the run times and the roster line follow it (the timer card paints itself, its track and
  // its phase row).
  function paint() {
    const r = room();
    const e = r && entryOf(r, r.current);
    if (!e || !e.timing || !e.timing.run) return;
    const now = env().now();
    for (const run of runsAt(e, event(), now, limit())) {
      const cell = $(`[data-run-time="${CSS.escape(run.side)}"]`);
      if (cell) cell.textContent = clockText(Math.floor(run.ms / 1000));
    }
    const row = $(`[data-runs-row="${CSS.escape(e.id)}"]`);
    if (row) row.textContent = runsLine(e, event(), now, limit());
  }

  // "<next> started": the run on now is fixed at the clock's time; the next starts now. A clock that is stopped
  // starts again, because the next speech has begun. Undo takes the split back.
  function startNext() {
    const r = room();
    const e = r && entryOf(r, r.current);
    if (!e) return;
    const now = env().now();
    const res = markNextRun(e, event(), now, limit());
    if (res.refused) { env().ui.toast(res.refused, { kind: 'error', key: 'runs' }); return; }
    ctx.save(updateEntry(r, e.id, () => res.entry, now));
    const side = res.entry.runs[res.entry.runs.length - 1];
    const label = labelOf(event(), side.side);
    if (!e.timing.run) timer.run('startStop'); else ctx.draw();
    const b = $('[data-tact="startstop"]'); if (b) b.focus();
    const msg = label + ' started for ' + e.code + '.';
    env().ui.toast(msg, { action: { label: 'Undo', name: 'Undo: ' + msg, run: () => {
      const cur = room();
      if (!entryOf(cur, e.id)) return;
      ctx.save(updateEntry(cur, e.id, (x) => unmarkLastRun(x, event(), env().now(), limit()), env().now()));
      ctx.draw();
    } } });
  }

  function onClick(ev) {
    const b = ev.target.closest('[data-ract]');
    if (b && b.dataset.ract === 'next') startNext();
  }

  const cards = {
    rowExtra: (r, e) => runsRowHtml(e, roomEvent(env().data.events, r), env().now(), limit()),
    stageHtml: (r, e) => runCardsHtml(e, roomEvent(env().data.events, r), env().now(), limit()),
    mounted() { const box = $('#runs'); if (box) box.addEventListener('click', onClick); },
    // After the timer view has brought back a saved clock (a reload), the stored runs follow it.
    show(c) {
      ctx = c;
      const r = room();
      const next = syncAll(r, event(), env().now(), limit(), updateEntry);
      if (next !== r) ctx.save(next);
      ticker = setInterval(paint, 500);
    },
    hide() { if (ticker) clearInterval(ticker); ticker = null; },
  };
  return [timer, cards];
}
