// Speech Events step E7: the Rank screen (ARCHITECTURE.md §5 screen 5; DESIGN.md §4.5 rank board, §4.6 ratings;
// primitives N8, N3, N9). The rules all come from events/js/rank.js through board.js; this file draws them.
// Three ways to move, for access (DESIGN.md §4.5): drag the handle, "Tap in order", or the Up and Down buttons
// (Alt+Up and Alt+Down on a focused row). A refused move changes nothing and says why.
// The builders at the top are pure (Node tests call them); createRankScreen does the DOM.
import { escapeHtml as esc } from '../../core/sheets.js';
import {
  orderOf, moveTo, moveUp, moveDown, tapRank, nextRank, overtimeRow, ratingScale, ratingError, rankRatingConflicts,
  ratingFix, ratingTies, checkBoard, RANK_RATING_ROW,
} from './rank.js';
import { boardCtx, ranksOf, ratingsOf, withRanks, withRating, openBoard, fillRest, stepRating } from './board.js';
import { entryOf, findRoom } from './room.js';
import { roundLine } from './rooms.js';
import { limitOf, usedAt, clockText } from './timer.js';
import { setReason } from './comments.js';

// The rating control of one row as HTML text ('' when the profile has no rating).
export function ratingHtml(e, value, scale, err) {
  if (scale.kind === 'none') return '';
  const label = 'Rating for ' + e.code;
  const errHtml = `<p class="rate-err" id="rate-err-${e.id}">${esc(err)}</p>`;
  if (scale.kind === 'words') {
    return `<div class="rate words" role="group" aria-label="${esc(label)}">${scale.words.map((w) => `<button class="rate-word${w === value ? ' on' : ''}" type="button" data-ract="word" data-id="${e.id}" data-value="${esc(w)}" aria-pressed="${w === value}">${esc(w)}</button>`).join('')}</div>${errHtml}`;
  }
  return `<div class="rate points"><button class="b small" type="button" data-ract="minus" data-id="${e.id}" aria-label="Lower the rating for ${esc(e.code)}"${value !== '' && Number(value) <= scale.min ? ' disabled' : ''}>−</button>
    <input class="rate-num" id="rate-${e.id}" data-ract="num" data-id="${e.id}" inputmode="decimal" autocomplete="off" value="${esc(value)}" aria-label="${esc(label)}, ${scale.min} to ${scale.max}" aria-describedby="rate-err-${e.id}"${err ? ' aria-invalid="true"' : ''}>
    <button class="b small" type="button" data-ract="plus" data-id="${e.id}" aria-label="Raise the rating for ${esc(e.code)}"${value !== '' && Number(value) >= scale.max ? ' disabled' : ''}>+</button></div>${errHtml}`;
}

// The board as HTML text. view: { tapMode, limit, now }.
export function boardHtml(room, view) {
  const ctx = boardCtx(room);
  const ranks = ranksOf(room), ratings = ratingsOf(room);
  const scale = ratingScale(room.profile);
  const order = orderOf(ranks, ctx);
  const conflicts = rankRatingConflicts(ranks, ratings, ctx);
  const tied = new Set(ratingTies(ratings, ctx).flatMap((t) => t.ids));
  const next = view.tapMode ? nextRank(ranks, ctx) : null;
  const n = order.length;
  const rows = order.map((id, i) => {
    const e = entryOf(room, id);
    const ot = overtimeRow(id, ctx);
    const rank = ranks[id];
    const conflict = conflicts.find((c) => c.id === id);
    const fix = conflict ? ratingFix(id, ranks, ratings, ctx) : null;
    const err = ratingError(ratings[id], scale) || (tied.has(id) ? 'Another speaker has this rating.' : '');
    const used = usedAt(e.timing, view.now, view.limit);
    const main = view.tapMode
      ? `<button class="tap-pick" type="button" data-ract="tap" data-id="${id}" data-key="tap-${id}">${rank ? 'Rank ' + esc(rank) + ' · tap to clear' : next ? 'Tap to rank ' + next : ''}</button>`
      : `<button class="b small" type="button" data-ract="up" data-id="${id}" data-key="up-${id}" aria-label="Move ${esc(e.code)} up"${i === 0 ? ' disabled' : ''}>↑</button>
         <button class="b small" type="button" data-ract="down" data-id="${id}" data-key="down-${id}" aria-label="Move ${esc(e.code)} down"${i === n - 1 ? ' disabled' : ''}>↓</button>
         <span class="drag" data-drag="${id}" aria-hidden="true" title="Drag to move">⠿</span>`;
    return `<li class="board-row" data-row="${id}" tabindex="-1" aria-label="${esc(e.code)}, rank ${esc(rank || 'none')}">
      <span class="board-rank" aria-hidden="true">${esc(rank || '–')}</span>
      <span class="board-main"><span class="code">${esc(e.code)}</span>${e.name ? `<span class="row-name">${esc(e.name)}</span>` : ''}
        <span class="board-meta">${used ? clockText(used) : 'No time'}${ot.pill ? ` <span class="pill err">${esc(ot.pill)}</span>` : ''}</span>
        ${ot.note ? `<span class="board-note">${esc(ot.note)}</span>` : ''}
        ${conflict ? `<span class="board-note">${esc(RANK_RATING_ROW)}${fix != null ? ` <button class="b small" type="button" data-ract="fix" data-id="${id}" data-value="${esc(fix)}">Fix: ${esc(fix)}</button>` : ''}</span>` : ''}</span>
      <span class="board-moves">${main}</span>
      ${scale.kind !== 'none' ? `<span class="board-rate">${ratingHtml(e, ratings[id], scale, err)}</span>` : ''}
    </li>`;
  }).join('');
  return `<ol class="board${view.tapMode ? ' tapping' : ''}" id="board" aria-label="Ranks, best first">${rows}</ol>`;
}

// The checklist under the board ("Before you review"), from rank.js checkBoard.
export function problemsHtml(room) {
  const list = checkBoard({ ranks: ranksOf(room), ratings: ratingsOf(room) }, boardCtx(room));
  return list.length ? `<div class="problems" role="status"><h2>Before you review</h2><ul>${list.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></div>`
    : '<p class="problems ok" role="status"><span class="pill outline">Ready</span> Every speaker has a rank' + (ratingScale(room.profile).kind === 'none' ? '.' : ' and a rating.') + '</p>';
}

// env: { el, ui, data, now, rooms(), saveRoom(room), go(screen, id) }.
export function createRankScreen(env) {
  let roomId = null;
  let tapMode = false;
  let drag = null;
  const $ = (s) => env.el.querySelector(s);
  const room = () => findRoom(env.rooms(), roomId);
  const event = (r) => env.data.events.get(r.eventId, r.eventVersion);
  const save = (r) => { env.saveRoom(r); return r; };

  function draw(focusKey) {
    const r = room();
    if (!r) return;
    $('#board-box').innerHTML = boardHtml(r, { tapMode, limit: limitOf(event(r)), now: env.now() });
    $('#problems').innerHTML = problemsHtml(r);
    $('#tap-toggle').textContent = tapMode ? 'Done tapping' : 'Tap in order';
    $('#tap-toggle').setAttribute('aria-pressed', String(tapMode));
    $('#tap-help').hidden = !tapMode;
    if (focusKey) { const el = $(`[data-key="${CSS.escape(focusKey)}"]`); if (el && !el.disabled) el.focus(); else { const row = $(`[data-row="${CSS.escape(focusKey.replace(/^[a-z]+-/, ''))}"]`); if (row) row.focus(); } }
  }

  // Apply a board move from rank.js: save it, or say why it was refused (DESIGN.md §4.5: nothing moves silently).
  function apply(res, id, focusKey) {
    const r = room();
    if (res.refused) {
      env.ui.toast(res.message, { kind: 'error', key: 'rank' });
      draw(focusKey);
      return false;
    }
    save(withRanks(r, res.ranks, env.now()));
    draw(focusKey);
    const e = entryOf(room(), id);
    if (e) env.ui.announce(e.code + (e.rank ? ' is rank ' + e.rank + '.' : ' has no rank.'));
    return true;
  }

  function move(id, kind) {
    const r = room();
    const ctx = boardCtx(r);
    const res = kind === 'up' ? moveUp(ranksOf(r), id, ctx) : moveDown(ranksOf(r), id, ctx);
    if (res.moved || res.refused === 'over-grace-first' || res.refused === 'not-full') apply(res, id, kind + '-' + id);
  }

  function setRating(id, value) {
    save(withRating(room(), id, value, env.now()));
  }

  function onClick(ev) {
    if (ev.target.closest('#tap-toggle')) return tapMode ? endTap() : startTap();
    if (ev.target.closest('#restart')) return restart();
    const b = ev.target.closest('[data-ract]');
    if (!b || b.dataset.ract === 'num') return;
    const id = b.dataset.id;
    const r = room();
    const scale = ratingScale(r.profile);
    const act = b.dataset.ract;
    if (act === 'up' || act === 'down') return move(id, act);
    if (act === 'tap') {
      const ranks = ranksOf(r);
      const ctx = boardCtx(r);
      const res = ranks[id] ? tapRank(ranks, id, '', ctx) : tapRank(ranks, id, nextRank(ranks, ctx), ctx);
      apply(res, id, 'tap-' + id);
      if (!nextRank(ranksOf(room()), boardCtx(room()))) { tapMode = false; draw(); env.ui.announce('Every speaker has a rank.'); $('#tap-toggle').focus(); }
      return;
    }
    if (act === 'word') { setRating(id, entryOf(r, id).rating === b.dataset.value ? '' : b.dataset.value); return draw(); }
    if (act === 'minus' || act === 'plus') { setRating(id, String(stepRating(entryOf(r, id).rating ?? '', act === 'minus' ? -1 : 1, scale))); draw(act + '-' + id); const inp = $(`#rate-${CSS.escape(id)}`); if (inp && document.activeElement !== inp) $(`[data-ract="${act}"][data-id="${CSS.escape(id)}"]`)?.focus(); return; }
    if (act === 'fix') { setRating(id, b.dataset.value); draw(); env.ui.announce('Rating for ' + entryOf(room(), id).code + ' set to ' + b.dataset.value + '.'); }
  }

  // Typing a rating: saved on every change; the error shows when the box is left (not while the judge types).
  function onInput(ev) { if (ev.target.dataset.ract === 'num') setRating(ev.target.dataset.id, ev.target.value.trim()); }
  function onChange(ev) { if (ev.target.dataset.ract === 'num') draw(); }

  // Alt+Up and Alt+Down move the row that has focus (the row or any control in it).
  function onKey(ev) {
    if (!ev.altKey || ev.ctrlKey || ev.metaKey || (ev.key !== 'ArrowUp' && ev.key !== 'ArrowDown')) return;
    const row = ev.target.closest('[data-row]');
    if (!row || tapMode) return;
    ev.preventDefault();
    move(row.dataset.row, ev.key === 'ArrowUp' ? 'up' : 'down');
  }

  // Drag by the handle (pointer events, so it works with a finger too). The row under the pointer gets a full outline.
  function onDown(ev) {
    const h = ev.target.closest('[data-drag]');
    if (!h || tapMode) return;
    ev.preventDefault();
    drag = { id: h.dataset.drag, to: null };
    h.setPointerCapture(ev.pointerId);
    $(`[data-row="${CSS.escape(drag.id)}"]`).classList.add('dragging');
  }
  function onMove(ev) {
    if (!drag) return;
    // The new place counts the rows without the one being dragged: it goes before the first row whose middle is
    // below the pointer, or last.
    const rows = [...env.el.querySelectorAll('[data-row]')].filter((row) => row.dataset.row !== drag.id);
    let at = rows.findIndex((row) => { const b = row.getBoundingClientRect(); return ev.clientY < b.top + b.height / 2; });
    if (at < 0) at = rows.length;
    drag.to = at + 1;
    rows.forEach((row, i) => row.classList.toggle('drop-here', i === Math.min(at, rows.length - 1)));
  }
  function onUp() {
    if (!drag) return;
    const { id, to } = drag;
    drag = null;
    env.el.querySelectorAll('.dragging, .drop-here').forEach((x) => x.classList.remove('dragging', 'drop-here'));
    if (!to) return;
    const r = room();
    const res = moveTo(ranksOf(r), id, to, boardCtx(r));
    if (res.moved || res.refused) apply(res, id, 'up-' + id);
  }

  // "Tap in order" starts from an empty board, so the first tap is rank 1 (with Undo). Leaving it early gives the
  // speakers still without a rank the free ranks in speaking order (board.js fillRest).
  function startTap() {
    const before = room();
    tapMode = true;
    save(withRanks(before, {}, env.now()));
    draw();
    env.ui.toast('Tap the speakers from best to last.', { action: { label: 'Undo', name: 'Undo: tap in order', run: () => { tapMode = false; save(Object.assign({}, room(), { entries: before.entries })); draw(); } } });
  }
  function endTap() {
    const r = room();
    const ranks = ranksOf(r);
    const ctx = boardCtx(r);
    tapMode = false;
    if (nextRank(ranks, ctx)) { save(withRanks(r, fillRest(ranks, ctx), env.now())); env.ui.announce('The speakers you did not tap keep speaking order after the others.'); }
    draw();
  }

  async function restart() {
    const ok = await env.ui.ask({ title: 'Start the ranks again?', body: 'Every speaker goes back to speaking order, 1 to ' + boardCtx(room()).ids.length + '. Ratings stay.', buttons: [{ label: 'Cancel', value: false }, { label: 'Start again', value: true, kind: 'danger' }], cancelValue: false });
    if (!ok) return;
    const before = room();
    const cleared = withRanks(before, {}, env.now());
    save(openBoard(cleared, env.now()).room);
    draw();
    env.ui.toast('Ranks back in speaking order.', { action: { label: 'Undo', name: 'Undo: start the ranks again', run: () => { save(Object.assign({}, room(), { entries: before.entries })); draw(); } } });
  }

  return {
    scope: 'rank',
    show(id) {
      const r0 = findRoom(env.rooms(), id);
      if (!r0) { env.ui.toast('That room is not on this device.', { key: 'noroom' }); env.go('rooms'); return; }
      roomId = id; tapMode = false; drag = null;
      const opened = openBoard(r0, env.now());
      if (opened.room !== r0) save(opened.room);
      const r = room();
      const ev = event(r);
      env.el.innerHTML = `<div class="screen-head"><a class="b quiet" href="#/room/${encodeURIComponent(id)}">‹ Room</a>
          <h1 id="screen-title" tabindex="-1">Rank · ${esc([ev ? ev.short : 'Custom', roundLine(r, false)].filter(Boolean).join(' · '))}</h1></div>
        <p class="bias">${esc(r.profile.biasNote || 'Judge the performance, not the person.')}</p>
        <div class="board-tools"><button class="b" type="button" id="tap-toggle" aria-pressed="false">Tap in order</button>
          <button class="b quiet" type="button" id="restart">Start again</button></div>
        <p class="muted" id="tap-help" hidden>Tap the speakers from best to last. Tap a ranked speaker again to take the rank off.</p>
        <p class="muted board-help">Best first. Drag the handle, use the arrows, or press Alt+Up and Alt+Down on a row.</p>
        <div id="board-box"></div>
        <div id="problems"></div>
        <label class="field" for="rank-reason"><span>Reason for rank <span class="muted">(whole room)</span></span></label>
        <textarea id="rank-reason" rows="3">${esc(r.reasonForRank || '')}</textarea>`;
      env.el.addEventListener('click', onClick);
      env.el.addEventListener('input', onInput);
      env.el.addEventListener('change', onChange);
      env.el.addEventListener('keydown', onKey);
      env.el.addEventListener('pointerdown', onDown);
      env.el.addEventListener('pointermove', onMove);
      env.el.addEventListener('pointerup', onUp);
      env.el.addEventListener('pointercancel', onUp);
      $('#rank-reason').addEventListener('input', (e) => save(setReason(room(), e.target.value, env.now())));
      draw();
      if (opened.started) env.ui.announce('The ranks start in speaking order.');
      $('#screen-title').focus();
    },
    hide() {
      for (const [t, f] of [['click', onClick], ['input', onInput], ['change', onChange], ['keydown', onKey], ['pointerdown', onDown], ['pointermove', onMove], ['pointerup', onUp], ['pointercancel', onUp]]) env.el.removeEventListener(t, f);
      roomId = null;
    },
  };
}
