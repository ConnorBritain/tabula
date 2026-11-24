// Speech Events step E4: the Room screen (ARCHITECTURE.md §5 screen 3) with the roster (DESIGN.md §4.1, primitive N7).
// Laptop and iPad: the roster is a left pane; the selected entry fills the main pane. Phone: a row of code pills across
// the top (it scrolls sideways) and a "Roster" button that opens the full rows.
// Each roster row has a menu: Move up, Move down, Move to end (late arrivals), Mark no show and Remove, each with Undo.
// Number keys 1–8 pick an entry; a room over 8 types the number, then Enter (step S4, number-pick.js).
// Step S4 also adds: the row menu's "Cross-entered" (EXPERIENCE.md §3.1, cross-entry.js), the level and panel frame
// under the title (round-frame.js), and the head button that follows the profile layer (Rank, Rate, or straight to
// Review for a comments-only round). The builders at the top are pure (Node tests call them); createRoomScreen does the DOM.
import { escapeHtml as esc } from '../../core/sheets.js';
import { STATUS_LABEL, entryOf, selectEntry, entryAtNumber, nextWaiting, addEntry, rosterAction, findRoom, present, roomEvent } from './room.js';
import { roundLine } from './rooms.js';
import { crossNote } from './cross-entry.js';
import { createNumberPicker, crossEntryAction } from './room-actions.js';
import { frameHtml } from './round-frame.js';
import { rankStageLabel } from './profile-layer.js';

const pill = (word, cls) => `<span class="pill${cls ? ' ' + cls : ''}">${esc(word)}</span>`;
// The status pill in words (DESIGN.md §4.1): Speaking is a solid fill, Done a gray outline.
export const statusPill = (e) => pill(STATUS_LABEL[e.status] || STATUS_LABEL.waiting, { speaking: 'solid', done: 'outline', noShow: 'outline', crossEntered: 'outline' }[e.status] || '');

// The room's title line: event short name and round.
export function roomTitle(room, event) {
  return [event ? event.name : 'Custom event', roundLine(room, false)].filter(Boolean).join(' · ');
}

// One roster row as HTML text. extra(e): optional HTML after the name (the time, from step E5).
// menuOpen: this row's menu is open.
export function rosterRowHtml(room, e, place, menuOpen, extra) {
  const cur = room.current === e.id;
  const n = room.entries.length;
  const noShow = e.status === 'noShow';
  const menu = menuOpen ? `<div class="row-menu" role="group" aria-label="Change ${esc(e.code)}">
      <button class="b small" type="button" data-act="up" data-id="${e.id}" data-key="up-${e.id}"${place === 1 ? ' disabled' : ''}>Move up</button>
      <button class="b small" type="button" data-act="down" data-id="${e.id}" data-key="down-${e.id}"${place === n ? ' disabled' : ''}>Move down</button>
      <button class="b small" type="button" data-act="end" data-id="${e.id}" data-key="end-${e.id}"${place === n ? ' disabled' : ''}>Move to end</button>
      <button class="b small" type="button" data-act="${noShow ? 'show' : 'noshow'}" data-id="${e.id}" data-key="ns-${e.id}">${noShow ? 'Undo no show' : 'Mark no show'}</button>
      ${e.status === 'waiting' ? `<button class="b small" type="button" data-act="cross" data-id="${e.id}" data-key="cross-${e.id}">Cross-entered</button>` : e.status === 'crossEntered' ? `<button class="b small" type="button" data-act="uncross" data-id="${e.id}" data-key="cross-${e.id}">Back in the room</button>` : ''}
      <button class="b small" type="button" data-act="remove" data-id="${e.id}" data-key="remove-${e.id}">Remove</button></div>` : '';
  return `<li class="roster-row${cur ? ' is-current' : ''}${noShow ? ' is-noshow' : ''}">
    <button class="row-pick" type="button" data-act="pick" data-id="${e.id}" data-key="pick-${e.id}"${cur ? ' aria-current="true"' : ''}>
      <span class="row-num" aria-hidden="true">${place}</span>
      <span class="row-main"><span class="code">${esc(e.code)}</span>${e.name ? `<span class="row-name">${esc(e.name)}</span>` : ''}</span>
      ${extra ? extra(e) : ''}${statusPill(e)}</button>
    <button class="iconbtn row-more" type="button" data-act="menu" data-id="${e.id}" data-key="menu-${e.id}" aria-expanded="${menuOpen}" aria-label="Change ${esc(e.code)}">⋯</button>
    ${menu}</li>`;
}

// The full roster as HTML text, plus the phone strip of code pills.
export function rosterHtml(room, menuFor, extra) {
  const done = room.entries.filter((e) => e.status === 'done').length;
  const here = present(room).length;
  const rows = room.entries.map((e, i) => rosterRowHtml(room, e, i + 1, menuFor === e.id, extra)).join('');
  const strip = room.entries.map((e) => `<button class="strip-pill${room.current === e.id ? ' is-current' : ''}" type="button" data-act="pick" data-id="${e.id}"${room.current === e.id ? ' aria-current="true"' : ''}><span class="code">${esc(e.code)}</span> <span class="strip-status">${esc(STATUS_LABEL[e.status] || '')}</span></button>`).join('');
  return `<div class="strip" role="group" aria-label="Speakers">${strip}</div>
    <div class="roster-full" id="roster-full">
      <h2 class="roster-title">Roster <span class="muted">${done} of ${here} done</span></h2>
      <ol class="roster-list">${rows}</ol>
      <button class="b small" type="button" data-act="add" data-key="add-entry">Add entry</button>
    </div>`;
}

// env: { el, ui, data, now, rooms(), saveRoom(room), go(screen, id) }.
// parts: the views that add to this screen (the timer in step E5, the comment sheet in E6). Each may have:
//   rowExtra(room, entry) -> HTML after a roster row's name     stageHtml(room, entry) -> HTML in the main pane
//   mounted(ctx) after the main pane is drawn                    show(ctx) / hide(ctx) when the screen opens / closes
//   run(action, ctx) -> true when it ran a shortcut              stopFor(id) stops that entry's running clock
// ctx: { env, room(), save(room), draw(), drawStage(), drawRoster() } (drawStage and drawRoster redraw one pane only).
export function createRoomScreen(env, parts) {
  const views = parts || [];
  let roomId = null;
  let menuFor = null;
  let rosterOpen = false;
  const numbers = createNumberPicker(); // "type the number, then Enter" in a room over 8 (room-actions.js)
  const $ = (s) => env.el.querySelector(s);
  const room = () => findRoom(env.rooms(), roomId);
  const event = (r) => roomEvent(env.data.events, r);

  function save(next) { env.saveRoom(next); return next; }

  // Draw the roster; keep the focus on the same control (by data-key).
  function drawRoster() {
    const r = room();
    if (!r) return;
    const box = $('#roster');
    const key = box.contains(document.activeElement) && document.activeElement.dataset ? document.activeElement.dataset.key : null;
    box.innerHTML = rosterHtml(r, menuFor, (e) => views.map((v) => (v.rowExtra ? v.rowExtra(r, e) : '')).join(''));
    box.classList.toggle('open', rosterOpen);
    $('#roster-toggle').setAttribute('aria-expanded', String(rosterOpen));
    if (key) {
      // The same control again; if it is gone or off now (Move down on the last row), that row's menu button.
      const el = box.querySelector(`[data-key="${CSS.escape(key)}"]`);
      const id = key.replace(/^[a-z]+-/, '');
      const back = box.querySelector(`[data-key="menu-${CSS.escape(id)}"]`) || box.querySelector(`[data-key="pick-${CSS.escape(r.current || '')}"]`);
      if (el && !el.disabled) el.focus(); else if (back) back.focus();
    }
  }
  function drawStage() {
    const r = room();
    if (!r) return;
    const e = entryOf(r, r.current);
    // Keep the focus (and a text box's cursor) on the same control through the redraw, by its id.
    const stage = $('#stage');
    const had = stage.contains(document.activeElement) && document.activeElement.id ? document.activeElement : null;
    const keep = had && { id: had.id, a: had.selectionStart, b: had.selectionEnd };
    stage.innerHTML = e ? `<div class="stage-head"><h2 class="stage-code" id="stage-code">${esc(e.code)}</h2><span class="muted stage-name" id="stage-name">${esc(e.name || '')}</span>${statusPill(e)}</div>`
      + (crossNote(e) ? `<p class="muted cross-note">${esc(crossNote(e))}</p>` : '')
      + views.map((v) => (v.stageHtml ? v.stageHtml(r, e) : '')).join('')
      + `<div class="stage-foot"><button class="b" type="button" data-act="next" data-key="next">Next speaker</button></div>`
      : '<p class="muted">Add an entry to start.</p>';
    for (const v of views) if (v.mounted) v.mounted(ctx);
    const back = keep && document.getElementById(keep.id);
    if (back && stage.contains(back)) { back.focus(); if (typeof keep.a === 'number' && back.setSelectionRange) back.setSelectionRange(keep.a, keep.b); }
  }
  function draw() { drawRoster(); drawStage(); }

  function pick(id) {
    const r = room();
    if (!r || !entryOf(r, id)) return;
    menuFor = null;
    save(selectEntry(r, id, env.now()));
    draw();
    env.ui.announce(entryOf(room(), id).code + ' picked.');
  }

  // A running timer must stop before its entry moves out of the room (step E5 gives the views a stop hook).
  const stopFor = (id) => { for (const v of views) if (v.stopFor) v.stopFor(id); };

  async function act(action, id) {
    const r = room();
    if (!r) return;
    if (action === 'pick') return pick(id);
    if (action === 'menu') { menuFor = menuFor === id ? null : id; return drawRoster(); }
    if (['up', 'down', 'end', 'noshow', 'show', 'remove'].includes(action)) {
      if (action === 'remove') stopFor(id);
      const res = rosterAction(room(), action, id, env.now());
      if (res.refused) { env.ui.toast(res.refused, { kind: 'error', key: 'roster' }); return; }
      if (!res.undo) return;
      if (action !== 'up' && action !== 'down') menuFor = null;
      save(res.room); draw();
      env.ui.toast(res.message, { action: { label: 'Undo', name: 'Undo: ' + res.message, run: () => { const cur = room(); if (cur) { save(res.undo(cur, env.now())); draw(); } } } });
      return;
    }
    if (action === 'cross' || action === 'uncross') return crossEntryAction(action, id, { env, room, save, draw, closeMenu: () => { menuFor = null; } });
    if (action === 'add') {
      const code = await env.ui.ask({ title: 'Add an entry', body: 'A late entry goes at the end of the roster. You can move it after.', input: { label: 'Entry code', placeholder: 'A12', required: true, emptyError: 'Type the entry code.' }, buttons: [{ label: 'Cancel', value: null }, { label: 'Add', value: 'add', kind: 'primary' }] });
      if (!code) return;
      const res = addEntry(room(), code, '', env.now());
      if (res.error) { env.ui.toast(res.error, { kind: 'error', key: 'add' }); return; }
      save(res.room); draw();
      env.ui.announce(res.entry.code + ' added at place ' + res.entry.order + '.');
      return;
    }
    if (action === 'next') {
      const nx = nextWaiting(r);
      if (!nx) { env.ui.toast('Every speaker has spoken or is a no show. Rank the room when you are ready.', { key: 'next' }); return; }
      return pick(nx.id);
    }
  }

  function onClick(ev) {
    if (ev.target.closest('#roster-toggle')) { rosterOpen = !rosterOpen; drawRoster(); return; }
    const b = ev.target.closest('[data-act]');
    if (b && env.el.contains(b)) act(b.dataset.act, b.dataset.id);
  }

  const ctx = { env, room, save, draw, drawStage, drawRoster };
  const menuOpen = () => roomId !== null && menuFor !== null;
  env.ui.escLayer('row-menu', 40, menuOpen, () => {
    const id = menuFor; menuFor = null; drawRoster();
    const b = $(`[data-key="menu-${CSS.escape(id || '')}"]`); if (b) b.focus();
  });

  return {
    scope: 'room',
    ctx,
    show(id) {
      const r = findRoom(env.rooms(), id);
      if (!r) { env.ui.toast('That room is not on this device.', { key: 'noroom' }); env.go('rooms'); return; }
      roomId = id; menuFor = null; rosterOpen = false; numbers.reset();
      const stageWord = rankStageLabel(r.profile);
      const go = stageWord ? `<a class="b primary" id="go-rank" href="#/rank/${encodeURIComponent(id)}">${stageWord} the room</a>` : `<a class="b primary" id="go-rank" href="#/review/${encodeURIComponent(id)}">Review and copy</a>`;
      // Step S3 (EXPERIENCE.md §1.1): the event pill opens the type page for this round's event.
      const ev = event(r);
      env.el.innerHTML = `<div class="screen-head room-head"><a class="b quiet" href="#/">‹ My day</a>
          <a class="pill md-ev" href="#/type/${encodeURIComponent(r.customEvent ? 'custom' : r.eventId)}" aria-label="${esc('About ' + (ev ? ev.name : 'Custom event'))}">${esc(ev ? ev.short || ev.name : 'Custom')}</a>
          <h1 id="screen-title" tabindex="-1">${esc(roomTitle(r, event(r)))}</h1>
          <button class="b" type="button" id="roster-toggle" aria-controls="roster-full" aria-expanded="false">Roster</button>
          ${go}</div>
        ${frameHtml(r)}
        <div class="room-grid"><nav class="roster" id="roster" aria-label="Roster"></nav><section class="stage" id="stage" aria-labelledby="stage-code"></section></div>`;
      env.el.addEventListener('click', onClick);
      for (const v of views) if (v.show) v.show(ctx);
      draw();
      $('#screen-title').focus();
    },
    hide() {
      env.el.removeEventListener('click', onClick);
      for (const v of views) if (v.hide) v.hide(ctx);
      roomId = null;
    },
    // A shortcut from app.js (core/keys.js matched it in the 'room' scope).
    run(action) {
      const r = room();
      const num = numbers.run(action, r ? r.entries.length : 0);
      if (num.pick) { const e = entryAtNumber(r, num.pick); if (e) pick(e.id); }
      if (num.error) env.ui.toast(num.error, { kind: 'error', key: 'numpick' });
      else if (num.hint) env.ui.toast(num.hint, { key: 'numpick' });
      if (num.mine) return num.handled;
      for (const v of views) if (v.run && v.run(action, ctx)) return true;
      return false;
    },
  };
}
