// Speech Events step E7: the Rank screen (ARCHITECTURE.md §5 screen 5; DESIGN.md §4.5 rank board, §4.6 ratings;
// primitives N8, N3, N9). The rules all come from events/js/rank.js through board.js; this file draws them.
// Three ways to move, for access (DESIGN.md §4.5): drag the handle, "Tap in order", or the Up and Down buttons
// (Alt+Up and Alt+Down on a focused row). A refused move changes nothing and says why.
// The builders at the top are pure (Node tests call them); createRankScreen does the DOM.
import { escapeHtml as esc } from '../../core/sheets.js';
import {
  orderOf, moveTo, moveUp, moveDown, tapRank, nextRank, overtimeRow, ratingScale, ratingError, rankRatingConflicts,
  ratingFix, ratingTies, RANK_RATING_ROW, graceLineText,
} from './rank.js';
import { boardCtx, ranksOf, ratingsOf, withRanks, withRating, openBoard, fillRest, restoreRanks } from './board.js';
import { attachDrag } from './rank-drag.js';
import { entryOf, findRoom, roomEvent } from './room.js';
import { roundLine } from './rooms.js';
import { limitOf, clockText } from './timer.js';
import { totalUsedAt } from './prep.js';
import { setReason, ballotComment, firstSentence } from './comments.js';
import { pieceLine } from './piece.js';
import { layerOf, layerProblems, notRankedText, cutLineText } from './profile-layer.js';
import { ratingHtml, rubricHtml, scoreClick, scoreInput, scoreKey, isScoreBox } from './score-view.js';
import { overtimeNote } from './round-frame.js';

// What a row shows of the judge's words: the piece (F1: "“Title” by Author") and the comment's first sentence
// (comments.js firstSentence). A tap on the comment line opens the whole comment in a sheet.
function rowWordsHtml(e) {
  const piece = pieceLine(e);
  const first = firstSentence(ballotComment(e));
  return (piece ? `<span class="board-piece">${esc(piece)}</span>` : '')
    + (first ? `<button class="board-comment" type="button" data-ract="note" data-id="${esc(e.id)}" data-key="note-${esc(e.id)}"><span class="sr-only">Read the comment for ${esc(e.code)}: </span>${esc(first)}</button>` : '');
}

// The board as HTML text. view: { tapMode, limit, now }.
// Step S4 (profile layer): under ranks 'topN' the board still orders everyone and a labelled line falls under rank N
// (the rows past it say "Not in top N" to a screen reader); a profile rubric adds its grid to each row; under a panel
// an over-grace row says to agree with the panel first.
export function boardHtml(room, view) {
  const ctx = boardCtx(room);
  const ranks = ranksOf(room), ratings = ratingsOf(room);
  const scale = ratingScale(room.profile);
  const order = orderOf(ranks, ctx);
  const conflicts = rankRatingConflicts(ranks, ratings, ctx);
  const tied = new Set(ratingTies(ratings, ctx).flatMap((t) => t.ids));
  const next = view.tapMode ? nextRank(ranks, ctx) : null;
  const n = order.length;
  const layer = layerOf(room.profile);
  const panel = overtimeNote(room);
  const cut = layer.ranks === 'topN' ? layer.topN : null;
  const cutLine = cutLineText(room.profile, n);
  const graceLine = graceLineText(ctx);
  const rows = order.map((id, i) => {
    const e = entryOf(room, id);
    const ot = overtimeRow(id, ctx);
    const rank = ranks[id];
    const conflict = conflicts.find((c) => c.id === id);
    const fix = conflict ? ratingFix(id, ranks, ratings, ctx) : null;
    const err = ratingError(ratings[id], scale) || (tied.has(id) ? 'Another speaker has this rating.' : '');
    const used = totalUsedAt(e.timing, view.now, view.limit); // on a prep event (E11), prep and speech
    const main = view.tapMode
      ? `<button class="tap-pick" type="button" data-ract="tap" data-id="${id}" data-key="tap-${id}">${rank ? 'Rank ' + esc(rank) + ' · tap to clear' : next ? 'Tap to rank ' + next : ''}</button>`
      : `<button class="b small" type="button" data-ract="up" data-id="${id}" data-key="up-${id}" aria-label="Move ${esc(e.code)} up"${i === 0 ? ' disabled' : ''}>↑</button>
         <button class="b small" type="button" data-ract="down" data-id="${id}" data-key="down-${id}" aria-label="Move ${esc(e.code)} down"${i === n - 1 ? ' disabled' : ''}>↓</button>
         <span class="drag" data-drag="${id}" aria-hidden="true" title="Drag to move">⠿</span>`;
    const below = cut && i >= cut;
    return `<li class="board-row${below ? ' below-cut' : ''}" data-row="${id}" tabindex="-1" aria-label="${esc(e.code)}, ${below ? esc(notRankedText(room.profile)) + ', place ' + esc(rank || i + 1) : 'rank ' + esc(rank || 'none')}">
      <span class="board-rank" aria-hidden="true">${esc(rank || '–')}</span>
      <span class="board-main"><span class="code">${esc(e.code)}</span>${e.name ? `<span class="row-name">${esc(e.name)}</span>` : ''}
        <span class="board-meta">${used ? clockText(used) : 'No time'}${ot.pill ? ` <span class="pill err">${esc(ot.pill)}</span>` : ''}</span>
        ${rowWordsHtml(e)}
        ${ot.note ? `<span class="board-note">${esc(ot.note)}</span>` : ''}${ot.pill && panel ? `<span class="board-note">${esc(panel)}</span>` : ''}
        ${conflict ? `<span class="board-note">${esc(RANK_RATING_ROW)}${fix != null ? ` <button class="b small" type="button" data-ract="fix" data-id="${id}" data-value="${esc(fix)}">Fix: ${esc(fix)}</button>` : ''}</span>` : ''}</span>
      <span class="board-moves">${main}</span>
      ${scale.kind !== 'none' ? `<span class="board-rate">${ratingHtml(e, ratings[id], scale, err)}</span>` : ''}
      ${rubricHtml(e, layer.rubric)}
      ${i === 0 && graceLine ? `<span class="board-line grace-line">${esc(graceLine)}</span>` : ''}${cut && i === cut - 1 && cutLine ? `<span class="board-line cut-line">${esc(cutLine)}</span>` : ''}
    </li>`;
  }).join('');
  return `<ol class="board${view.tapMode ? ' tapping' : ''}" id="board" aria-label="Ranks, best first">${rows}</ol>`;
}

// The checklist under the board ("Before you review"), from rank.js checkBoard (with the rubric scores, step S4:
// profile-layer.js layerProblems).
export function problemsHtml(room) {
  const list = layerProblems(room);
  return list.length ? `<div class="problems" role="status"><h2>Before you review</h2><ul>${list.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></div>`
    : '<p class="problems ok" role="status"><span class="pill outline">Ready</span> Every speaker has a rank' + (ratingScale(room.profile).kind === 'none' ? '.' : ' and a rating.') + '</p>';
}

// env: { el, ui, data, now, rooms(), saveRoom(room), go(screen, id) }.
export function createRankScreen(env) {
  let roomId = null;
  let tapMode = false;
  let detachDrag = null;
  const $ = (s) => env.el.querySelector(s);
  const room = () => findRoom(env.rooms(), roomId);
  const event = (r) => roomEvent(env.data.events, r);
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
    const sc = scoreClick(ev.target, room(), env.now()); // a rating word, a rating − or +, or a rubric stepper
    if (sc) { save(sc.room); draw(sc.focusKey); return; }
    const b = ev.target.closest('[data-ract]');
    if (!b || b.dataset.ract === 'num') return;
    const id = b.dataset.id;
    const r = room();
    const act = b.dataset.ract;
    if (act === 'up' || act === 'down') return move(id, act);
    if (act === 'note') return showComment(id);
    if (act === 'tap') {
      const ranks = ranksOf(r);
      const ctx = boardCtx(r);
      const res = ranks[id] ? tapRank(ranks, id, '', ctx) : tapRank(ranks, id, nextRank(ranks, ctx), ctx);
      apply(res, id, 'tap-' + id);
      if (!nextRank(ranksOf(room()), boardCtx(room()))) { tapMode = false; draw(); env.ui.announce('Every speaker has a rank.'); $('#tap-toggle').focus(); }
      return;
    }
    if (act === 'fix') {
      setRating(id, b.dataset.value);
      draw();
      env.ui.announce('Rating for ' + entryOf(room(), id).code + ' set to ' + b.dataset.value + '.');
    }
  }

  // The whole comment of one row in a sheet (the row shows its first sentence). The room is where the judge edits it.
  function showComment(id) {
    const e = entryOf(room(), id);
    if (!e) return;
    const text = ballotComment(e).trim();
    env.ui.ask({ title: 'Comment for ' + e.code + (e.name ? ' · ' + e.name : ''), body: text ? text.split(/\n+/) : ['No comment yet.'], buttons: [{ label: 'Close', value: true, kind: 'primary' }], cancelValue: true });
  }

  // Typing a rating: saved on every change; the error shows when the box is left (not while the judge types).
  function onInput(ev) { const next = scoreInput(ev.target, room(), env.now()); if (next) save(next); }
  function onChange(ev) { if (isScoreBox(ev.target)) draw(); }

  // Alt+Up and Alt+Down move the row that has focus (the row or any control in it).
  function onKey(ev) {
    const sk = scoreKey(ev, room(), env.now()); // arrows and digits on a row of number buttons (score-view.js)
    if (sk) { ev.preventDefault(); if (sk.room !== room()) save(sk.room); draw(sk.focusKey); return; }
    if (!ev.altKey || ev.ctrlKey || ev.metaKey || (ev.key !== 'ArrowUp' && ev.key !== 'ArrowDown')) return;
    const row = ev.target.closest('[data-row]');
    if (!row || tapMode) return;
    ev.preventDefault();
    move(row.dataset.row, ev.key === 'ArrowUp' ? 'up' : 'down');
  }

  // Drag by the handle (rank-drag.js reports the new place; rank.js moveTo may refuse it).
  function onDrop(id, place) {
    const r = room();
    const res = moveTo(ranksOf(r), id, place, boardCtx(r));
    if (res.moved || res.refused) apply(res, id, 'up-' + id);
  }

  // "Tap in order" starts from an empty board, so the first tap is rank 1 (with Undo). Leaving it early gives the
  // speakers still without a rank the free ranks in speaking order (board.js fillRest).
  function startTap() {
    const before = room();
    tapMode = true;
    save(withRanks(before, {}, env.now()));
    draw();
    env.ui.toast('Tap the speakers from best to last.', { action: { label: 'Undo', name: 'Undo: tap in order', run: () => { tapMode = false; save(restoreRanks(room(), before, env.now())); draw(); } } });
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
    env.ui.toast('Ranks back in speaking order.', { action: { label: 'Undo', name: 'Undo: start the ranks again', run: () => { save(restoreRanks(room(), before, env.now())); draw(); } } });
  }

  return {
    scope: 'rank',
    show(id) {
      const r0 = findRoom(env.rooms(), id);
      if (!r0) { env.ui.toast('That room is not on this device.', { key: 'noroom' }); env.go('rooms'); return; }
      roomId = id; tapMode = false;
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
        <p class="muted board-help">Best first. Drag the handle, use the arrows, or press Alt+Up and Alt+Down on a row.${layerOf(r.profile).ranks === 'topN' ? ' Only the top ' + layerOf(r.profile).topN + ' get a rank on the ballot. Put the rest in any order.' : ''}</p>
        <div id="board-box"></div>
        <div id="problems"></div>
        <label class="field" for="rank-reason"><span>Reason for rank <span class="muted">(whole room)</span></span></label>
        <textarea id="rank-reason" rows="3">${esc(r.reasonForRank || '')}</textarea>
        <div class="rank-foot"><a class="b primary" id="go-review" href="#/review/${encodeURIComponent(id)}">Review and copy</a></div>`;
      env.el.addEventListener('click', onClick);
      env.el.addEventListener('input', onInput);
      env.el.addEventListener('change', onChange);
      env.el.addEventListener('keydown', onKey);
      detachDrag = attachDrag($('#board-box'), { enabled: () => !tapMode, onDrop });
      $('#rank-reason').addEventListener('input', (e) => save(setReason(room(), e.target.value, env.now())));
      draw();
      if (opened.started) env.ui.announce('The ranks start in speaking order.');
      $('#screen-title').focus();
    },
    hide() {
      for (const [t, f] of [['click', onClick], ['input', onInput], ['change', onChange], ['keydown', onKey]]) env.el.removeEventListener(t, f);
      if (detachDrag) detachDrag();
      roomId = null;
    },
  };
}
