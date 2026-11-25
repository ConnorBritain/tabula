// Speech Events step S2 (docs/events/EXPERIENCE.md §7): the History screen, #/history. One row per round, a filter by
// event type and by tournament, Copy as TSV and Download CSV (codes only unless the judge ticks the box), and Delete
// with Undo. The rules are in history.js; the builders at the top are pure (Node tests call them); createHistoryScreen
// does the DOM.
import { escapeHtml as esc } from '../../core/sheets.js';
import { icon, iconButton } from './icons.js';
import { statusPillHtml } from './status-pill.js';
import { downloadFile } from '../../core/store.js';
import { historyRows, filterChoices, filterRows, historyColumns, exportTable, toTSV, toCSV, csvName } from './history.js';
import { dayOf } from './rooms.js';
import { routeHash } from './routes.js';

const option = (value, label, picked) => `<option value="${esc(value)}"${value === picked ? ' selected' : ''}>${esc(label)}</option>`;

// The state as the same kind of pill My day uses (design review §2.11), with "Comments open" as a second pill only
// when it is true. A word always goes with the look.
// Top 10 #4, D2-A: in-progress states are a quiet tint, a fully copied round is green with a check; never solid.
const STATE_PILL = Object.freeze({ Judging: ['live', 'circle-dashed'], Ranking: ['live', 'list-ordered'], Review: ['live', 'copy'], Copied: ['ok', 'circle-check'] });
const stateHtml = (row) => { const [tone, ic] = STATE_PILL[row.state] || ['', '']; return statusPillHtml(tone, row.state, ic) + (row.commentsOpen ? ' ' + statusPillHtml('caution', 'Comments open') : ''); };

// One cell of the table as HTML text. The round cell opens the round (and so does a click anywhere on the row).
function cellHtml(row, key) {
  if (key === 'round') return `<a href="${esc(routeHash('round', row.id))}">${esc(row.round || 'Untitled round')}</a>`;
  if (key === 'state') return stateHtml(row);
  // Step S3: the event opens its type page (Guide, Rules, Rounds).
  if (key === 'event' && /^[a-z0-9-]{1,20}$/.test(row.eventId || '')) return `<a href="${esc(routeHash('type', row.eventId))}">${esc(row.event)}</a>`;
  return esc(row[key]);
}

// The quiet "⋯" row menu (design review §2.11): Delete lives in it, not on the row. The menu is in the page but hidden
// until "⋯" opens it, so a keyboard judge reaches Delete only on purpose. Delete still has Undo.
function moreHtml(r) {
  const name = r.event + ' ' + (r.round || 'round') + ' from ' + r.date;
  return iconButton('ellipsis', 'More for ' + name, 'iconbtn hist-more-btn', 'data-more aria-expanded="false"')
    + `<div class="hist-menu" role="group" aria-label="${esc('More for ' + name)}" hidden><button class="b small quiet" type="button" data-del="${esc(r.id)}" aria-label="${esc('Delete ' + name)}">Delete</button></div>`;
}

// The table as HTML text. rows: historyRows(...) after the filter; columns: historyColumns(...).
export function historyTableHtml(rows, columns) {
  if (!rows.length) return '<p class="muted" id="hist-empty">No rounds match. Rounds you judge show here.</p>';
  return `<table class="hist-table"><caption class="sr-only">Your rounds, newest first</caption>
    <thead><tr>${columns.map((c) => `<th scope="col">${esc(c.label)}</th>`).join('')}<th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
    <tbody>${rows.map((r) => `<tr data-id="${esc(r.id)}">${columns.map((c) => `<td data-col="${c.key}">${cellHtml(r, c.key)}</td>`).join('')}`
      + `<td class="hist-more">${moreHtml(r)}</td></tr>`).join('')}</tbody>
  </table>`;
}

// The whole screen as HTML text. filter: { eventId, tournament }.
export function historyHtml(allRows, filter) {
  const f = filter || {};
  const ch = filterChoices(allRows);
  const rows = filterRows(allRows, f);
  return `<div class="screen-head"><h1 id="screen-title" tabindex="-1">History</h1></div>
  <div class="hist-tools">
    <label class="field"><span>Event</span><select id="hist-event">${option('', 'All events', f.eventId || '')}${ch.events.map((e) => option(e.id, e.label, f.eventId)).join('')}</select></label>
    <label class="field"><span>Tournament</span><select id="hist-tour">${option('', 'All tournaments', f.tournament || '')}${ch.tournaments.map((t) => option(t, t, f.tournament)).join('')}</select></label>
  </div>
  <div class="hist-export">
    <button class="b" type="button" id="hist-tsv">${icon('copy')}Copy as TSV</button>
    <button class="b" type="button" id="hist-csv">${icon('download')}Download CSV</button>
    <label class="tick"><input type="checkbox" id="hist-private"> Include names and comments</label>
  </div>
  <p class="field-help">The copy and the file hold the rounds shown, with entry codes only. Names and comments go in only when you tick the box.</p>
  <p class="muted" id="hist-count" role="status">${rows.length} ${rows.length === 1 ? 'round' : 'rounds'}</p>
  <div class="hist-wrap" id="hist-table">${historyTableHtml(rows, historyColumns(rows, f))}</div>`;
}

// env: { el, ui, data, now, rooms(), deleteRound(id, after) }.
export function createHistoryScreen(env) {
  let filter = { eventId: '', tournament: '' };
  const $ = (s) => env.el.querySelector(s);
  const allRows = () => historyRows(env.rooms(), env.data.events);

  function draw(focusSel) {
    const rows = allRows();
    // A filter value no round has any more (the last one was deleted) falls back to all.
    const ch = filterChoices(rows);
    if (filter.eventId && !ch.events.some((e) => e.id === filter.eventId)) filter.eventId = '';
    if (filter.tournament && !ch.tournaments.includes(filter.tournament)) filter.tournament = '';
    env.el.innerHTML = historyHtml(rows, filter);
    const f = focusSel && $(focusSel);
    if (f) f.focus();
  }

  // The export table for the rounds shown now.
  function table() {
    const ids = filterRows(allRows(), filter).map((r) => r.id);
    const withPrivate = $('#hist-private').checked;
    return exportTable(env.rooms(), env.data.events, ids, { names: withPrivate, comments: withPrivate });
  }

  async function copyTsv() {
    const t = table();
    if (t.length < 2) { env.ui.toast('There is nothing to copy yet.', { key: 'hist' }); return; }
    try {
      await navigator.clipboard.writeText(toTSV(t));
      env.ui.toast('Copied ' + (t.length - 1) + (t.length === 2 ? ' line' : ' lines') + '. Paste them into a spreadsheet.', { key: 'hist' });
    } catch (err) {
      console.warn('Speech Events: the copy did not work.', err);
      env.ui.toast('The copy did not work in this browser. Use Download CSV.', { kind: 'error', key: 'hist' });
    }
  }
  function downloadCsv() {
    const t = table();
    if (t.length < 2) { env.ui.toast('There is nothing to download yet.', { key: 'hist' }); return; }
    downloadFile(csvName(dayOf(env.now())), toCSV(t), 'text/csv');
    env.ui.toast('The CSV file is in your downloads.', { key: 'hist' });
  }

  let showing = false;

  // Open or close a row's "⋯" menu in place (no redraw, so focus and the scroll stay). One menu is open at a time.
  function setMenu(btn, open) {
    for (const b of env.el.querySelectorAll('button[data-more][aria-expanded="true"]')) if (b !== btn) { b.setAttribute('aria-expanded', 'false'); b.nextElementSibling.hidden = true; }
    btn.setAttribute('aria-expanded', String(open));
    btn.nextElementSibling.hidden = !open;
    if (open) btn.nextElementSibling.querySelector('button').focus();
  }
  const openMenuBtn = () => env.el.querySelector('button[data-more][aria-expanded="true"]');

  function onClick(e) {
    const more = e.target.closest('button[data-more]');
    if (more) { setMenu(more, more.getAttribute('aria-expanded') !== 'true'); return; }
    const del = e.target.closest('button[data-del]');
    if (del) {
      // Focus goes to the next row's "⋯" button (or the title), so a keyboard judge keeps their place.
      // The place is found by position, not by putting the round id in a CSS selector: ids can come from a backup
      // file, and a quote in one would make querySelector throw.
      const at = Math.max(0, [...env.el.querySelectorAll('button[data-del]')].indexOf(del));
      // The Undo toast stays up for a while; if the judge has left History, Undo must not draw History over the new screen.
      env.deleteRound(del.dataset.del, () => {
        if (!showing) return;
        draw();
        const left = [...env.el.querySelectorAll('button[data-more]')];
        const f = left[Math.min(at, left.length - 1)] || $('#screen-title');
        if (f) f.focus();
      });
      return;
    }
    if (e.target.id === 'hist-tsv') copyTsv();
    if (e.target.id === 'hist-csv') downloadCsv();
    // A click on the row itself (not on a link, a button or a box) opens the round. The round link stays the keyboard path.
    const row = e.target.closest && e.target.closest('tr[data-id]');
    if (row && !e.target.closest('a, button, input, select, label')) location.hash = routeHash('round', row.dataset.id);
  }
  function onChange(e) {
    if (e.target.id === 'hist-event') { filter.eventId = e.target.value; draw('#hist-event'); }
    if (e.target.id === 'hist-tour') { filter.tournament = e.target.value; draw('#hist-tour'); }
  }

  // Esc closes an open row menu and puts focus back on its "⋯".
  if (env.ui && env.ui.escLayer) env.ui.escLayer('hist-menu', 40, () => showing && Boolean(openMenuBtn()), () => { const b = openMenuBtn(); if (b) { setMenu(b, false); b.focus(); } });

  return {
    scope: 'history',
    show() {
      showing = true;
      env.el.addEventListener('click', onClick);
      env.el.addEventListener('change', onChange);
      draw('#screen-title');
    },
    hide() {
      showing = false;
      env.el.removeEventListener('click', onClick);
      env.el.removeEventListener('change', onChange);
    },
    // After a delete's Undo, the list redraws in place.
    refresh() { draw(); },
  };
}
