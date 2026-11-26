// Speech Events step E8: the Review and copy screen (ARCHITECTURE.md §5 screen 6; DESIGN.md §4.4, §4.7; N11, N12).
// Stage 1 "Ranks to submit": the ranks and ratings, one Copy ranks button (the tab room wants these first).
// Stage 2: one card per entry with its comment and its own Copy comment button, then the reason for rank. Copy all
// (one block) and Print / PDF (core/sheets.js print sheet). The rules are in ballot.js. Step E13 adds "Clean up" on each
// card (cleanup-view.js), built only when the AI gate allows it.
// Last, "Save a copy": Save as PDF, the one main step once everything is copied.
// The builders at the top are pure (Node tests call them); createReviewScreen does the DOM.
import { escapeHtml as esc, showPrintSheet, removePrintSheet } from '../../core/sheets.js';
import { icon } from './icons.js';
import { statusPillHtml } from './status-pill.js';
import { ranksBlock, ranksProblems, cards, checklist, statusText, markCopied, setComment, setReasonReview, copyAllText, printModel, hasRanksStage, rubricLine } from './ballot.js';
import { findRoom, roomEvent } from './room.js';
import { roundLine } from './rooms.js';
import { limitOf } from './timer.js';
import { trackFeedbackSelection } from './edit-selection.js';
import { createCleanup } from './cleanup-view.js';
import { createRoomComparison } from './room-comparison-view.js';
import { rankStageLabel, ranksShown, layerOf, notRankedText, reasonLabel } from './profile-layer.js';
import { OVER_GRACE_PILL } from './rank.js';
import { mountReviewKit } from '../comment-kit/kit-view.js';

// A met check is a check circle, an open one an empty circle (§5.3: icons, not the "✓" and "○" characters); the word
// and the hidden "(not yet)" carry the meaning.
// The one next copy step on the Review screen (top 10 #4: one solid fill per view): the ranks first, then each comment
// card in the order shown, then the reason for rank. Returns 'ranks', a card id, 'reason', or '' when all is copied
// (or the ranks are blocked: then the blocker's "Back to Rank" is the primary). Pure: list is the cards as shown.
export function nextCopy(room, list) {
  if (hasRanksStage(room) && ranksProblems(room).length) return '';
  if (hasRanksStage(room) && !room.ranksCopiedAt) return 'ranks';
  const card = list.find((c) => c.comment.trim() && !c.copied);
  if (card) return card.id;
  if (String(room.reasonForRank || '').trim() && !room.reasonCopiedAt) return 'reason';
  return '';
}
// A copy button's class: the next step is the primary; a copied one is quiet; the rest are secondary.
const copyClass = (what, copied, next) => (copied ? 'b quiet' : what === next ? 'b primary' : 'b');

const done = (ok, label) => `<li class="${ok ? 'is-ok' : ''}">${icon(ok ? 'circle-check' : 'circle')} ${esc(label)}${ok ? '' : ' <span class="sr-only">(not yet)</span>'}</li>`;
// A copy button (§5.3): the copy icon and the word; once copied it goes quiet with a check and "Copied" (top 10 #4:
// only the next copy step keeps the solid fill).
export const copyLabel = (copied, word) => (copied ? `${icon('check')}Copied` : `${icon('copy')}${esc(word)}`);

// Stage 1 as HTML text: a narrow card shaped like the online ballot (design review 2026-11-24 §2.10, top 10 #7): the
// code, rank, rating and rubric of each entry, and an "Over grace" pill only when it is true. The card's header holds
// the copy button and the copy state. Step S4 (profile layer): under ranks 'off' it is "Ratings to submit" with no
// Rank column; a rubric adds a column; under critiqueOnly there is nothing to submit, so there is no stage at all
// (bug 6; the summary says the rules are comments only).
export function ranksStageHtml(room) {
  if (!hasRanksStage(room)) return '';
  const { rows, rated, ranked, rubric } = ranksBlock(room);
  const problems = ranksProblems(room);
  const sent = Boolean(room.ranksCopiedAt);
  const word = ranked ? 'ranks' : 'ratings';
  const back = ranked ? 'Rank' : 'Rate';
  // A top-N ballot: the rows past N say "Not in top N", as the copied text does, not a bare dash.
  const notRanked = layerOf(room.profile).ranks === 'topN' ? notRankedText(room.profile) : '';
  const overCell = (r) => (r.overTime ? statusPillHtml('err', OVER_GRACE_PILL) : '<span class="sr-only">No</span>');
  const table = `<table class="ranks-table"><thead><tr><th>Code</th>${ranked ? '<th>Rank</th>' : ''}${rated ? '<th>Rating</th>' : ''}${rubric ? '<th>Rubric</th>' : ''}<th>Over time</th></tr></thead><tbody>${rows.map((r) => `<tr><td class="code">${esc(r.code)}</td>${ranked ? `<td class="preview-rank">${r.rank ? esc(r.rank) : notRanked ? `<span class="muted preview-out">${esc(notRanked)}</span>` : '–'}</td>` : ''}${rated ? `<td>${r.rating ? esc(r.rating) : statusPillHtml('caution', 'No rating')}</td>` : ''}${rubric ? `<td>${esc(rubricLine(r.rubric))}</td>` : ''}<td>${overCell(r)}</td></tr>`).join('')}</tbody></table>`;
  const copyBtn = problems.length ? ''
    : `<button class="${sent ? 'b quiet' : 'b primary'}" type="button" data-vact="copy" data-what="ranks" data-key="copy-ranks">${copyLabel(false, sent ? 'Copy ' + word + ' again' : 'Copy ' + word)}</button>`;
  // Top 10 #7: a blocked copy says "Not ready" in a caution box above the table, and "Back to Rank" (or Rate) is the
  // screen's one primary.
  const fix = problems.length
    ? `<div class="problems caution" role="status"><h3>${statusPillHtml('caution', 'Not ready', 'triangle-alert')} Fix these before you copy the ${word}</h3><ul>${problems.map((p) => `<li>${esc(p)}</li>`).join('')}</ul><a class="b primary" href="#/rank/${encodeURIComponent(room.id)}">${icon('chevron-left')}Back to ${back}</a></div>` : '';
  return `<section class="review-stage ballot-preview" aria-labelledby="stage1">
    <div class="preview-head"><h2 id="stage1">1. ${ranked ? 'Ranks' : 'Ratings'} to submit</h2>
      ${sent ? statusPillHtml('ok', 'Copied', 'circle-check', 'id="ranks-state"') : statusPillHtml('caution', 'Not sent', 'circle', 'id="ranks-state"')}${copyBtn}</div>
    <p class="muted">Enter ranks first. Ranks lock on submit. Comments stay open.</p>
    ${fix}${table}</section>`;
}

// One comment card as HTML text. editing: the card shows its edit box. ai: { button, panel } for clean-up (E13), or
// nothing (AI off: no button and no empty space).
export function cardHtml(c, editing, ai, next) {
  const a = ai || { button: '', panel: '' };
  const body = editing
    ? `<label class="sr-only" for="edit-${c.id}">Comment for ${esc(c.code)}</label><textarea id="edit-${c.id}" class="card-edit" data-vfield="comment" data-id="${c.id}" rows="6">${esc(c.comment)}</textarea>`
    : `<div class="card-text"${a.button ? ` data-ai-text="${esc(c.id)}"` : ''}>${c.comment ? esc(c.comment) : '<span class="muted">No comment yet.</span>'}</div>`;
  return `<li class="card" data-card="${c.id}">
    <div class="card-head"><span class="code">${esc(c.code)}</span><span class="muted">${[c.ranked === false ? '' : c.rank ? 'Rank ' + esc(c.rank) : 'No rank', c.rating ? 'Rating ' + esc(c.rating) : ''].filter(Boolean).join(' · ')}</span>
      ${a.button}<button class="b small quiet" type="button" data-vact="edit" data-id="${c.id}" data-key="edit-${c.id}" aria-expanded="${editing}">${editing ? 'Done' : icon('pencil') + 'Edit'}</button></div>
    ${c.name || c.piece ? `<p class="card-piece">${[c.name, c.piece].filter(Boolean).map(esc).join(' · ')}</p>` : ''}
    ${c.question ? `<p class="card-question"><span class="muted">Question:</span> ${esc(c.question)}</p>` : ''}
    ${c.topic ? `<p class="card-question card-topic"><span class="muted">Topic:</span> ${esc(c.topic)}</p>` : ''}
    ${c.runs ? `<p class="card-question card-runs"><span class="muted">Runs:</span> ${esc(c.runs)}</p>` : ''}
    ${body}${a.panel}
    <ul class="critique" aria-label="Comment check for ${esc(c.code)}">${c.critique.map((k) => done(k.ok, k.label)).join('')}</ul>
    ${c.comment.trim() ? `<button class="${copyClass(c.id, c.copied, next === undefined ? c.id : next)}" type="button" data-vact="copy" data-what="${c.id}" data-key="copy-${c.id}">${copyLabel(c.copied, 'Copy comment')}</button>` : ''}
  </li>`;
}

// Stage 2 and the tools as HTML text. view: { order, editing, ai (optional: (card, editing) -> { button, panel }),
// event (optional: the room's event file, for the PCC run labels) }.
export function commentsStageHtml(room, view) {
  const ranked = ranksShown(room.profile);
  // No ranks (ranks 'off' or comments only, bug 6): no rank order to sort by, so the cards keep speaking order.
  const list = cards(room, ranked ? view.order : 'speaking', view.event);
  const reason = String(room.reasonForRank || '');
  const reasonEditing = view.editing === 'reason';
  const reasonTitle = reasonLabel(room.profile); // the same word as the checklist (§4 repair)
  // Comments only: no reason for rank either, unless one was written before the rules changed (it still copies).
  const showReason = hasRanksStage(room) || reason.trim() || reasonEditing;
  const next = nextCopy(room, list);
  const toggle = ranked ? `<div class="order-toggle seg-track" role="group" aria-label="Card order">
      <button class="b small${view.order === 'speaking' ? ' on' : ''}" type="button" data-vact="order" data-order="speaking" data-key="order-speaking" aria-pressed="${view.order === 'speaking'}">Speaking order</button>
      <button class="b small${view.order === 'rank' ? ' on' : ''}" type="button" data-vact="order" data-order="rank" data-key="order-rank" aria-pressed="${view.order === 'rank'}">Rank order</button></div>` : '';
  return `<section class="review-stage" aria-labelledby="stage2"><h2 id="stage2" tabindex="-1">${hasRanksStage(room) ? '2. ' : ''}Comments</h2>
    ${toggle}
    <ol class="cards">${list.map((c) => cardHtml(c, view.editing === c.id, view.ai && view.ai(c, view.editing === c.id), next)).join('')}</ol>
    ${showReason ? `<div class="card reason-card"><div class="card-head"><span>${reasonTitle}</span>
      <button class="b small quiet" type="button" data-vact="edit" data-id="reason" data-key="edit-reason" aria-expanded="${reasonEditing}">${reasonEditing ? 'Done' : icon('pencil') + 'Edit'}</button></div>
      ${reasonEditing ? `<label class="sr-only" for="edit-reason-box">${reasonTitle}</label><textarea id="edit-reason-box" class="card-edit" data-vfield="reason" rows="4">${esc(reason)}</textarea>` : `<div class="card-text">${reason.trim() ? esc(reason) : `<span class="muted">No ${reasonTitle.toLowerCase()} yet.</span>`}</div>`}
      ${reason.trim() ? `<button class="${copyClass('reason', room.reasonCopiedAt, next)}" type="button" data-vact="copy" data-what="reason" data-key="copy-reason">${copyLabel(room.reasonCopiedAt, 'Copy reason')}</button>` : ''}</div>` : ''}
  </section>`;
}

// The top of the screen: the status pill and the checklist in words.
// One toolbar row (design review §2.10): the status, the checklist, then Copy all and Print / PDF. The ranks have
// their own copy button in the ballot preview card.
export function summaryHtml(room) {
  return `<div class="review-summary">${room.state === 'done' ? statusPillHtml('ok', statusText(room), 'circle-check', 'id="review-status"') : statusPillHtml('live', statusText(room), '', 'id="review-status"')}
    <ul class="checklist">${checklist(room).map((c) => done(c.ok, c.label)).join('')}</ul>
    <div class="review-tools" role="group" aria-label="Copy and print the whole ballot"><button class="b quiet" type="button" data-vact="copyall" data-key="copyall">${icon('copy')}Copy all</button>
      <button class="b quiet" type="button" data-vact="print" data-key="print">${icon('printer')}Print / PDF</button></div></div>
    ${hasRanksStage(room) ? '' : '<p class="muted review-note">Comments only. No ranks to submit.</p>'}`;
}

// The last step on the screen: save the ballot as a PDF (the core/sheets.js print sheet: the codes and what the judge
// entered). It becomes the one primary button once every copy step is done (nextCopy says ''), so after the ranks and
// comments are copied the judge sees one clear next step. The rounds live only on this device; a PDF is a copy that
// lasts. next: nextCopy(room, cards as shown).
export function saveStageHtml(room, next) {
  const ready = next === '' && !(hasRanksStage(room) && ranksProblems(room).length);
  // "All copied." only when something was copied (a room with nothing typed has nothing to copy).
  const copied = Boolean(room.ranksCopiedAt || room.reasonCopiedAt || (room.entries || []).some((e) => e && e.commentCopiedAt));
  return `<section class="review-stage review-save" aria-labelledby="stage-save"><h2 id="stage-save">${hasRanksStage(room) ? '3. ' : ''}Save a copy</h2>
    <p class="muted">${ready && copied ? 'All copied. ' : ''}Your ballot is saved only on this device. Save it as a PDF to keep a copy: in the print window, choose "Save as PDF".</p>
    <button class="b${ready ? ' primary' : ''}" type="button" data-vact="print" data-key="print-save">${icon('printer')}Save as PDF</button></section>`;
}

// core/sheets.js copyBlocksHtml is not used here: its blocks have one generic Copy button and a read-only box, while
// DESIGN.md §4.7 asks for cards with Edit, a "Copied" state and the critique list.
// Copy text to the clipboard. Returns true when it worked. A browser that refuses the clipboard API gets the older
// select-and-copy way; if that fails too, the caller tells the judge to press Ctrl+C.
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {}
  try {
    const t = document.createElement('textarea');
    t.value = text; t.setAttribute('readonly', ''); t.className = 'sr-only';
    document.body.append(t); t.select();
    const ok = document.execCommand('copy');
    t.remove();
    return ok;
  } catch { return false; }
}

// env: { el, ui, data, now, rooms(), saveRoom(room), go(screen, id) }.
export function createReviewScreen(env) {
  let roomId = null;
  let view = { order: 'speaking', editing: null };
  let stopSelection = null;
  const $ = (s) => env.el.querySelector(s);
  const room = () => findRoom(env.rooms(), roomId);
  const event = (r) => roomEvent(env.data.events, r);
  const save = (r) => { env.saveRoom(r); return r; };
  // "Clean up my comments" (E13). Only with env.ai: a page with no AI part has no clean-up at all.
  const cleanup = env.ai ? createCleanup(env, { roomId: () => roomId, event: (r) => event(r), draw: (k) => drawEditor(k), changed: (k) => { view.editing = null; draw(k); } }) : null;
  const comparison = env.ai ? createRoomComparison(env, { roomId: () => roomId, event, draw: (key) => drawComparison(key), beforeRun: () => cleanup?.reset() }) : null;
  const viewNow = () => Object.assign({}, view, { ai: cleanup ? (c) => ({ button: cleanup.button(c), panel: '' }) : null, event: event(room()) });

  function drawEditor(focusKey) {
    const layer = $('#review-ai-layer');
    if (!layer) return;
    layer.innerHTML = cleanup ? cleanup.panel() : '';
    if (focusKey) { const el = document.getElementById(focusKey) || $(`[data-key="${CSS.escape(focusKey)}"]`); if (el) el.focus(); }
    if (cleanup) cleanup.position();
  }

  function drawComparison(focusKey) {
    const action = $('#review-compare-action'), panel = $('#review-room-comparison');
    if (action) action.innerHTML = comparison ? comparison.button() : '';
    if (panel) panel.innerHTML = comparison ? comparison.panel() : '';
    drawEditor();
    if (focusKey) {
      const el = document.getElementById(focusKey) || $(`[data-key="${CSS.escape(focusKey)}"]`);
      if (el) el.focus();
    }
  }

  function draw(focusKey) {
    const r = room();
    if (!r) return;
    $('#review-top').innerHTML = summaryHtml(r);
    $('#review-ranks').innerHTML = ranksStageHtml(r);
    $('#review-comments').innerHTML = commentsStageHtml(r, viewNow());
    $('#review-save').innerHTML = saveStageHtml(r, nextCopy(r, cards(r, view.order, event(r))));
    if (comparison) { comparison.invalidate(); drawComparison(); }
    // An element with that id first (the edit box), else the control with that data-key.
    if (focusKey) { const el = document.getElementById(focusKey) || $(`[data-key="${CSS.escape(focusKey)}"]`); if (el) el.focus(); }
    drawEditor();
  }

  async function copy(what) {
    const r = room();
    let text = '';
    if (what === 'ranks') {
      if (ranksProblems(r).length) { draw(); return; } // the board changed since the screen was drawn
      text = ranksBlock(r).text;
    }
    else if (what === 'reason') text = String(r.reasonForRank || '').trim();
    else { const c = cards(r, 'speaking').find((x) => x.id === what); text = c ? c.comment : ''; }
    if (!text) return;
    if (!(await copyText(text))) { env.ui.toast('This browser blocked copying. Select the text and press Ctrl+C (⌘C on Mac).', { kind: 'error', key: 'copy' }); return; }
    save(markCopied(room(), what, env.now()));
    draw('copy-' + what);
    env.ui.announce(what === 'ranks' ? 'Ranks copied.' : 'Copied.');
  }

  async function onClick(ev) {
    const b = ev.target.closest('[data-vact]');
    if (!b) { if (cleanup) cleanup.outside(ev); return; }
    const act = b.dataset.vact;
    if (act.startsWith('room-')) return comparison && comparison.click(act, b);
    if (act.startsWith('clean')) { comparison?.close(false); return cleanup && cleanup.click(act, b); }
    if (cleanup) cleanup.outside(ev);
    if (act === 'copy') return copy(b.dataset.what);
    if (act === 'order') { view.order = b.dataset.order; return draw('order-' + view.order); }
    if (act === 'edit') {
      const id = b.dataset.id;
      view.editing = view.editing === id ? null : id;
      if (cleanup && view.editing) cleanup.closeFor(id);
      // Open: the focus goes into the edit box. Done: back to the Edit button (data-key edit-<id>).
      draw(view.editing === 'reason' ? 'edit-reason-box' : 'edit-' + id);
      return;
    }
    if (act === 'copyall') {
      const r = room();
      if (await copyText(copyAllText(r, event(r)))) env.ui.toast('All copied.', { key: 'copy' });
      else env.ui.toast('This browser blocked copying. Select the text and press Ctrl+C (⌘C on Mac).', { kind: 'error', key: 'copy' });
      return;
    }
    if (act === 'print') {
      const r = room();
      showPrintSheet(printModel(r, event(r), limitOf(event(r))));
      window.print();
    }
  }

  // Editing a comment or the reason: saved on every keystroke; a changed text must be copied again (ballot.js).
  function onInput(ev) {
    if (cleanup && cleanup.input(ev)) return;
    const f = ev.target.dataset.vfield;
    const r = room();
    if (!f || !r) return;
    if (cleanup && f === 'comment') cleanup.closeFor(ev.target.dataset.id);
    save(f === 'reason' ? setReasonReview(r, ev.target.value, env.now()) : setComment(r, ev.target.dataset.id, ev.target.value, env.now()));
    comparison?.invalidate();
    $('#review-top').innerHTML = summaryHtml(room());
    // The card's check list and Copy button change in place (the copy mark is gone now); the edit box keeps focus.
    const id = f === 'reason' ? 'reason' : ev.target.dataset.id;
    const old = f === 'reason' ? env.el.querySelector('.reason-card') : env.el.querySelector(`[data-card="${CSS.escape(id)}"]`);
    if (!old) return;
    const fresh = document.createElement('template');
    // No ai part for a card in edit mode: clean-up is closed while the judge edits (cleanup-view.js view()).
    const list = cards(room(), view.order, event(room()));
    const next = nextCopy(room(), list);
    fresh.innerHTML = f === 'reason' ? commentsStageHtml(room(), viewNow()) : cardHtml(list.find((c) => c.id === id), true, null, next);
    const src = f === 'reason' ? fresh.content.querySelector('.reason-card') : fresh.content.firstElementChild;
    for (const sel of ['.critique', '[data-vact="copy"]']) {
      const a = old.querySelector(sel), b = src.querySelector(sel);
      if (a && b) a.replaceWith(b); else if (a) a.remove(); else if (b) old.append(b);
    }
    // An edit can change which copy step is next: keep one primary on the screen (top 10 #4).
    for (const btn of env.el.querySelectorAll('[data-vact="copy"]')) if (!btn.classList.contains('quiet')) btn.className = btn.dataset.what === next ? 'b primary' : 'b';
    $('#review-save').innerHTML = saveStageHtml(room(), next);
  }

  const afterPrint = () => removePrintSheet();
  const onKey = (ev) => { if (comparison) comparison.key(ev); if (!ev.defaultPrevented && cleanup) cleanup.key(ev); };
  const onPosition = () => { if (cleanup) cleanup.position(); };

  return {
    scope: 'review',
    show(id) {
      const r = findRoom(env.rooms(), id);
      if (!r) { env.ui.toast('That room is not on this device.', { key: 'noroom' }); env.go('rooms'); return; }
      roomId = id; view = { order: 'speaking', editing: null };
      if (cleanup) cleanup.reset();
      if (comparison) comparison.reset();
      const ev = event(r);
      const back = hasRanksStage(r) ? `<a class="b quiet back" href="#/rank/${encodeURIComponent(id)}">${icon('chevron-left')}${rankStageLabel(r.profile)}</a>` : `<a class="b quiet back" href="#/room/${encodeURIComponent(id)}">${icon('chevron-left')}Room</a>`;
      env.el.innerHTML = `<div class="screen-head">${back}
          <h1 id="screen-title" tabindex="-1">Review · ${esc([ev ? ev.short : 'Custom', roundLine(r, false)].filter(Boolean).join(' · '))}</h1><span id="review-compare-action"></span></div>
        <div id="review-room-comparison"></div><div id="review-top"></div><div id="review-ranks"></div><div id="review-comments"></div><div id="review-save"></div><div id="review-ai-layer" data-ai-layer></div>`;
      env.el.addEventListener('click', onClick);
      env.el.addEventListener('input', onInput);
      env.el.addEventListener('keydown', onKey);
      env.el.addEventListener('toggle', onPosition, true);
      window.addEventListener('resize', onPosition);
      window.addEventListener('scroll', onPosition, true);
      window.addEventListener('afterprint', afterPrint);
      mountReviewKit($('#review-comments'), id); // performance check and length note on the edit boxes
      if (cleanup && cleanup.path() !== 'none') stopSelection = trackFeedbackSelection(env.el, (value) => cleanup.select(value));
      draw();
      $('#screen-title').focus();
    },
    hide() {
      env.el.removeEventListener('click', onClick);
      env.el.removeEventListener('input', onInput);
      env.el.removeEventListener('keydown', onKey);
      env.el.removeEventListener('toggle', onPosition, true);
      window.removeEventListener('resize', onPosition);
      window.removeEventListener('scroll', onPosition, true);
      window.removeEventListener('afterprint', afterPrint);
      if (stopSelection) stopSelection(); stopSelection = null;
      removePrintSheet();
      if (cleanup) cleanup.reset();
      if (comparison) comparison.reset();
      roomId = null;
    },
  };
}
