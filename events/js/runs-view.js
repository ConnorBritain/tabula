// Speech Events step S5 (docs/events/EXPERIENCE.md §3 F4 row): the Room screen parts of an F4 round (PCC: one entry,
// two runs, Pro then Con under one 10:30 limit). They plug into createRoomScreen as views (room-screen.js names the
// hooks), around the shipped timer card:
//   head view    the student's topic field, the phase bar (phase-bar.js) and its "Next: ..." line
//   timer view   the shipped timer card (timer-view.js), with the run split kept in step with the clock (runs.js)
//   cards view   one run card per run (its time, and Done, Now or Not started) and the "Con started" button
// The rules are in runs.js. There is no minimum time for a run: a card shows the time and never a warning.
// The builders at the top are pure (Node tests call them); createRunsParts does the DOM.
import { escapeHtml as esc } from '../../core/sheets.js';
import { clockText, limitOf } from './timer.js';
import { entryOf, updateEntry, roomEvent } from './room.js';
import { createTimerView } from './timer-view.js';
import { phasesHtml } from './phase-bar.js';
import { eventRuns, runsAt, syncRuns, syncAll, labelOf, resetRunFields, markNextRun, unmarkLastRun, runsPhase, runsBarModel, runsLine, setTopic, TOPIC_MAX } from './runs.js';

const BAR_ID = 'runs-bar';

// The topic field and the phase bar for one entry ('' for a no show).
export function runsHeadHtml(entry, event, now, limit) {
  if (!entry || entry.status === 'noShow') return '';
  const t = event && event.topic ? event.topic : {};
  return `<div class="runs-head" id="runs-head">
    <label class="field runs-topic" for="run-topic"><span>${esc(t.label || 'Topic')} <span class="muted">(the student's pick; stays on this device)</span></span>
      <input id="run-topic" data-rfield="topic" value="${esc(entry.topic || '')}" maxlength="${TOPIC_MAX}" autocomplete="off"${t.hint ? ` aria-describedby="run-topic-hint"` : ''}></label>
    ${t.hint ? `<p class="field-help" id="run-topic-hint">${esc(t.hint)}</p>` : ''}
    ${phasesHtml(runsBarModel(entry, event, now, limit), { id: BAR_ID })}</div>`;
}

// The run cards and the "<next> started" button for one entry ('' for a no show).
export function runCardsHtml(entry, event, now, limit) {
  if (!entry || entry.status === 'noShow') return '';
  const sides = eventRuns(event);
  const runs = runsAt(entry, event, now, limit);
  const { index } = runsPhase(entry, event, now, limit);
  const cards = sides.map((s, i) => {
    const r = runs[i];
    const word = i < index ? 'Done' : i === index ? 'Now' : 'Not started';
    return `<li class="run-card${i === index ? ' is-on' : ''}" data-side="${esc(s.side)}">
      <span class="run-label">${esc(s.label)}</span>
      <span class="run-time" data-run-time="${esc(s.side)}">${r ? clockText(Math.floor(r.ms / 1000)) : '–'}</span>
      <span class="run-word muted" data-run-word="${esc(s.side)}">${esc(word)}</span></li>`;
  }).join('');
  const nextSide = index >= 0 && index < sides.length - 1 ? sides[index + 1] : null;
  const btn = nextSide ? `<button class="b primary" type="button" data-ract="next" data-key="run-next">${esc(nextSide.label)} started</button>` : '';
  return `<div class="runs" id="runs"><ol class="run-cards" aria-label="Runs">${cards}</ol>
    <p class="field-help">One limit covers every run. Each run shows its own time, with no minimum.</p>
    ${btn ? `<div class="run-btns">${btn}</div>` : ''}</div>`;
}

// The time of each run on a roster row ('' with no time yet).
export const runsRowHtml = (entry, event, now, limit) => {
  const line = runsLine(entry, event, now, limit);
  return line ? `<span class="row-runs muted" data-runs-row="${esc(entry.id)}">${esc(line)}</span>` : '';
};

// The three views for an F4 Room screen: [head, timer, cards]. app.js passes them (with the comment view) to
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
  });

  // While the clock runs, the phase bar, the run times and the roster line follow it (the timer card paints itself).
  function paint() {
    const r = room();
    const e = r && entryOf(r, r.current);
    if (!e || !e.timing || !e.timing.run) return;
    const now = env().now();
    const bar = $('#' + BAR_ID);
    if (bar) bar.outerHTML = phasesHtml(runsBarModel(e, event(), now, limit()), { id: BAR_ID });
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

  function onInput(ev) {
    if (!ev.target.dataset || ev.target.dataset.rfield !== 'topic') return;
    const r = room();
    if (r && r.current) ctx.save(updateEntry(r, r.current, (e) => setTopic(e, ev.target.value), env().now()));
  }
  function onClick(ev) {
    const b = ev.target.closest('[data-ract]');
    if (b && b.dataset.ract === 'next') startNext();
  }

  const head = {
    stageHtml: (r, e) => runsHeadHtml(e, roomEvent(env().data.events, r), env().now(), limit()),
    mounted() { const box = $('#runs-head'); if (box) box.addEventListener('input', onInput); },
    show(c) { ctx = c; },
  };
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
  return [head, timer, cards];
}
