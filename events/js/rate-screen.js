// Speech Events step S4 (docs/events/EXPERIENCE.md §2.4): the Rate screen. A rules profile with ranks: 'off' turns
// the Rank stage into Rate: each entry gets a rating (the profile's scale) and/or rubric scores, with no order. The
// round-type router opens it for the 'rank' stage of such a round (room-workspace.js), so the address stays
// #/round/<id>/rank. The rules are in profile-layer.js and rank.js; this file draws them.
// The builders at the top are pure (Node tests call them); createRateScreen does the DOM.
import { escapeHtml as esc } from '../../core/sheets.js';
import { ratingScale, ratingError, ratingTies, overtimeRow } from './rank.js';
import { boardCtx, ratingsOf, withRating, stepRating } from './board.js';
import { layerOf, layerProblems } from './profile-layer.js';
import { ratingHtml } from './rank-screen.js';
import { rubricHtml, rubricClick, rubricInput } from './rubric-view.js';
import { entryOf, findRoom, present, roomEvent } from './room.js';
import { roundLine } from './rooms.js';
import { limitOf, clockText } from './timer.js';
import { totalUsedAt } from './prep.js';
import { setReason } from './comments.js';
import { overtimeNote } from './round-frame.js';

// The list of entries to rate, in speaking order, as HTML text. view: { limit, now }.
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
    return `<li class="rate-row" data-row="${esc(e.id)}">
      <span class="board-main"><span class="code">${esc(e.code)}</span>${e.name ? `<span class="row-name">${esc(e.name)}</span>` : ''}
        <span class="board-meta">${used ? clockText(used) : 'No time'}${ot.pill ? ` <span class="pill err">${esc(ot.pill)}</span>` : ''}</span>
        ${ot.pill && panel ? `<span class="board-note">${esc(panel)}</span>` : ''}</span>
      ${scale.kind !== 'none' ? `<span class="board-rate">${ratingHtml(e, ratings[e.id], scale, err)}</span>` : ''}
      ${rubricHtml(e, rubric)}
    </li>`;
  }).join('');
  return `<ul class="rate-list" id="rate-list" aria-label="Ratings, in speaking order">${rows}</ul>`;
}

// The checklist under the list, from profile-layer.js layerProblems.
export function rateProblemsHtml(room) {
  const list = layerProblems(room);
  return list.length ? `<div class="problems" role="status"><h2>Before you review</h2><ul>${list.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></div>`
    : '<p class="problems ok" role="status"><span class="pill outline">Ready</span> Every speaker is rated.</p>';
}

// env: { el, ui, data, now, rooms(), saveRoom(room), go(screen, id) }.
export function createRateScreen(env) {
  let roomId = null;
  const $ = (s) => env.el.querySelector(s);
  const room = () => findRoom(env.rooms(), roomId);
  const event = (r) => roomEvent(env.data.events, r);
  const save = (r) => { env.saveRoom(r); return r; };

  function draw(focusKey) {
    const r = room();
    if (!r) return;
    $('#rate-box').innerHTML = rateListHtml(r, { limit: limitOf(event(r)), now: env.now() });
    $('#problems').innerHTML = rateProblemsHtml(r);
    if (focusKey) { const el = $(`[data-key="${CSS.escape(focusKey)}"]`); if (el && !el.disabled) el.focus(); }
  }

  function onClick(ev) {
    const r = room();
    if (!r) return;
    const rb = ev.target.closest('[data-rub]');
    if (rb) { const res = rubricClick(rb, r, layerOf(r.profile).rubric, env.now()); if (res) { save(res.room); draw(res.focusKey); } return; }
    const b = ev.target.closest('[data-ract]');
    if (!b || b.dataset.ract === 'num') return;
    const id = b.dataset.id;
    const scale = ratingScale(r.profile);
    if (b.dataset.ract === 'word') { save(withRating(r, id, entryOf(r, id).rating === b.dataset.value ? '' : b.dataset.value, env.now())); draw(); return; }
    if (b.dataset.ract === 'minus' || b.dataset.ract === 'plus') {
      save(withRating(r, id, String(stepRating(entryOf(r, id).rating ?? '', b.dataset.ract === 'minus' ? -1 : 1, scale)), env.now()));
      draw(b.dataset.ract + '-' + id);
    }
  }
  // Typing: saved on every change; errors show when the box is left.
  function onInput(ev) {
    const r = room();
    if (!r) return;
    if (ev.target.dataset.ract === 'num') { save(withRating(r, ev.target.dataset.id, ev.target.value.trim(), env.now())); return; }
    const next = rubricInput(ev.target, r, env.now());
    if (next) save(next);
  }
  function onChange(ev) { if (ev.target.dataset.ract === 'num' || ev.target.dataset.rub === 'num') draw(); }

  return {
    scope: 'rank',
    show(id) {
      const r = findRoom(env.rooms(), id);
      if (!r) { env.ui.toast('That room is not on this device.', { key: 'noroom' }); env.go('rooms'); return; }
      roomId = id;
      if (r.state === 'judging') save(Object.assign({}, r, { state: 'ranking', updatedAt: env.now() }));
      const ev = event(r);
      env.el.innerHTML = `<div class="screen-head"><a class="b quiet" href="#/room/${encodeURIComponent(id)}">‹ Room</a>
          <h1 id="screen-title" tabindex="-1">Rate · ${esc([ev ? ev.short : 'Custom', roundLine(r, false)].filter(Boolean).join(' · '))}</h1></div>
        <p class="bias">${esc(r.profile.biasNote || 'Judge the performance, not the person.')}</p>
        <p class="muted board-help">These rules have no ranks. Rate each speaker on their own.</p>
        <div id="rate-box"></div>
        <div id="problems"></div>
        <label class="field" for="rank-reason"><span>Notes for the whole room <span class="muted">(optional)</span></span></label>
        <textarea id="rank-reason" rows="3">${esc(r.reasonForRank || '')}</textarea>
        <div class="rank-foot"><a class="b primary" id="go-review" href="#/review/${encodeURIComponent(id)}">Review and copy</a></div>`;
      env.el.addEventListener('click', onClick);
      env.el.addEventListener('input', onInput);
      env.el.addEventListener('change', onChange);
      $('#rank-reason').addEventListener('input', (e) => save(setReason(room(), e.target.value, env.now())));
      draw();
      $('#screen-title').focus();
    },
    hide() {
      for (const [t, f] of [['click', onClick], ['input', onInput], ['change', onChange]]) env.el.removeEventListener(t, f);
      roomId = null;
    },
  };
}
