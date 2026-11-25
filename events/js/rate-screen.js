// Speech Events step S4 (docs/events/EXPERIENCE.md §2.4): the Rate screen. A rules profile with ranks: 'off' turns
// the Rank stage into Rate: each entry gets a rating (the profile's scale) and/or rubric scores, with no order. The
// round-type router opens it for the 'rank' stage of such a round (room-workspace.js), so the address stays
// #/round/<id>/rank. The rules are in profile-layer.js and rank.js; this file draws them.
// The builders at the top are pure (Node tests call them); createRateScreen does the DOM.
import { escapeHtml as esc } from '../../core/sheets.js';
import { statusPillHtml } from './status-pill.js';
import { icon } from './icons.js';
import { problemsListHtml, readyHtml, rateRowPill, ballotFootHtml, firstOpenRubric } from './ballot-status.js';
import { ballotNavClick, rubricToggle } from './ballot-nav.js';
import { ratingScale, ratingError, ratingTies, overtimeRow } from './rank.js';
import { boardCtx, ratingsOf } from './board.js';
import { layerOf, layerProblems } from './profile-layer.js';
import { ratingHtml, rubricHtml, scoreClick, scoreInput, scoreKey, isScoreBox } from './score-view.js';
import { findRoom, present, roomEvent } from './room.js';
import { roundLine } from './rooms.js';
import { limitOf, clockText } from './timer.js';
import { totalUsedAt } from './prep.js';
import { setReason } from './comments.js';
import { overtimeNote } from './round-frame.js';

// The list of entries to rate, in speaking order, as HTML text. view: { limit, now, openRub (the open rubric block) }.
export function rateListHtml(room, view) {
  const ctx = boardCtx(room);
  const scale = ratingScale(room.profile);
  const ratings = ratingsOf(room);
  const tied = new Set(ratingTies(ratings, ctx).flatMap((t) => t.ids));
  const rubric = layerOf(room.profile).rubric;
  const panel = overtimeNote(room);
  const rows = present(room).map((e) => {
    const ot = overtimeRow(e.id, ctx);
    const used = totalUsedAt(e.timing, view.now, view.limit);
    const err = ratingError(ratings[e.id], scale) || (tied.has(e.id) ? 'Another speaker has this rating.' : '');
    return `<li class="rate-row" data-row="${esc(e.id)}" tabindex="-1">
      <span class="board-main"><span class="code">${esc(e.code)}</span>${e.name ? `<span class="row-name">${esc(e.name)}</span>` : ''}
        <span class="board-meta">${used ? clockText(used) : 'No time'}${ot.pill ? ' ' + statusPillHtml('err', ot.pill) : ''}</span>
        ${ot.pill && panel ? `<span class="board-note">${esc(panel)}</span>` : ''}${rateRowPill(e, ratings[e.id], scale, rubric)}</span>
      ${scale.kind !== 'none' ? `<span class="board-rate">${ratingHtml(e, ratings[e.id], scale, err)}</span>` : ''}
      ${rubricHtml(e, rubric, rubric.length ? { open: view.openRub === e.id } : null)}
    </li>`;
  }).join('');
  return `<ul class="rate-list" id="rate-list" aria-label="Ratings, in speaking order">${rows}</ul>`;
}

// The checklist under the list, from profile-layer.js layerProblems.
export function rateProblemsHtml(room) {
  const list = layerProblems(room);
  return list.length ? problemsListHtml(room, list) : readyHtml('Every speaker is rated.');
}

// env: { el, ui, data, now, rooms(), saveRoom(room), go(screen, id) }.
export function createRateScreen(env) {
  let roomId = null;
  let openRub = null; // the open rubric block (§5.4)
  const onToggle = (ev) => { openRub = rubricToggle(env.el, ev, openRub); };
  const $ = (s) => env.el.querySelector(s);
  const room = () => findRoom(env.rooms(), roomId);
  const event = (r) => roomEvent(env.data.events, r);
  const save = (r) => { env.saveRoom(r); return r; };

  function draw(focusKey) {
    const r = room();
    if (!r) return;
    $('#rate-box').innerHTML = rateListHtml(r, { limit: limitOf(event(r)), now: env.now(), openRub });
    $('#problems').innerHTML = rateProblemsHtml(r);
    $('#ballot-foot').innerHTML = ballotFootHtml(r, 'rate'); // the sticky footer (top 10 #6) follows every change
    if (focusKey) { const el = $(`[data-key="${CSS.escape(focusKey)}"]`); if (el && !el.disabled) el.focus(); }
  }

  // The score controls work as on the Rank screen (score-view.js); typing saves on every change, and the error shows
  // when the box is left.
  function onClick(ev) {
    if (ballotNavClick(env.el, ev, env.ui.announce)) return; // a "Before you review" item, or the footer while work is open
    const res = scoreClick(ev.target, room(), env.now()); if (res) { save(res.room); draw(res.focusKey); }
  }
  function onInput(ev) { const next = scoreInput(ev.target, room(), env.now()); if (next) save(next); }
  function onChange(ev) { if (isScoreBox(ev.target)) draw(); }
  // The arrow, Home, End and digit keys on a row of number buttons (score-view.js scoreKey).
  function onKey(ev) { const r = room(); const res = scoreKey(ev, r, env.now()); if (!res) return; ev.preventDefault(); if (res.room !== r) save(res.room); draw(res.focusKey); }

  return {
    scope: 'rank',
    show(id) {
      const r = findRoom(env.rooms(), id);
      if (!r) { env.ui.toast('That room is not on this device.', { key: 'noroom' }); env.go('rooms'); return; }
      roomId = id;
      openRub = firstOpenRubric(present(r), layerOf(r.profile).rubric);
      if (r.state === 'judging') save(Object.assign({}, r, { state: 'ranking', updatedAt: env.now() }));
      const ev = event(r);
      env.el.innerHTML = `<div class="screen-head"><a class="b quiet back" href="#/room/${encodeURIComponent(id)}">${icon('chevron-left')}Room</a>
          <h1 id="screen-title" tabindex="-1">Rate · ${esc([ev ? ev.short : 'Custom', roundLine(r, false)].filter(Boolean).join(' · '))}</h1></div>
        <p class="bias">${esc(r.profile.biasNote || 'Judge the performance, not the person.')}</p>
        <p class="muted board-help">These rules have no ranks. Rate each speaker on their own.</p>
        <div id="rate-box"></div>
        <div id="problems"></div>
        <label class="field" for="rank-reason"><span>Notes for the whole room <span class="muted">(optional)</span></span></label>
        <textarea id="rank-reason" rows="3">${esc(r.reasonForRank || '')}</textarea>
        <div class="ballot-foot" id="ballot-foot"></div>`;
      env.el.addEventListener('click', onClick);
      env.el.addEventListener('input', onInput);
      env.el.addEventListener('change', onChange);
      env.el.addEventListener('keydown', onKey);
      env.el.addEventListener('toggle', onToggle, true);
      $('#rank-reason').addEventListener('input', (e) => save(setReason(room(), e.target.value, env.now())));
      draw();
      $('#screen-title').focus();
    },
    hide() {
      for (const [t, f] of [['click', onClick], ['input', onInput], ['change', onChange], ['keydown', onKey]]) env.el.removeEventListener(t, f);
      env.el.removeEventListener('toggle', onToggle, true);
      roomId = null;
    },
  };
}
