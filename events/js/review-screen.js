// Speech Events step E8: the Review and copy screen (ARCHITECTURE.md §5 screen 6; DESIGN.md §4.4, §4.7; N11, N12).
// Stage 1 "Ranks to submit": the ranks and ratings, one Copy ranks button (the tab room wants these first).
// Stage 2: one card per entry with its comment and its own Copy comment button, then the reason for rank. Copy all
// (one block) and Print / PDF (core/sheets.js print sheet). The rules are in ballot.js.
// The builders at the top are pure (Node tests call them); createReviewScreen does the DOM.
import { escapeHtml as esc, showPrintSheet, removePrintSheet } from '../../core/sheets.js';
import { ranksBlock, ranksProblems, cards, checklist, statusText, markCopied, setComment, setReasonReview, copyAllText, printModel } from './ballot.js';
import { findRoom } from './room.js';
import { roundLine } from './rooms.js';
import { limitOf } from './timer.js';

const done = (ok, label) => `<li class="${ok ? 'is-ok' : ''}"><span aria-hidden="true">${ok ? '✓' : '○'}</span> ${esc(label)}${ok ? '' : ' <span class="sr-only">(not yet)</span>'}</li>`;

// Stage 1 as HTML text.
export function ranksStageHtml(room) {
  const { rows, rated } = ranksBlock(room);
  const problems = ranksProblems(room);
  const sent = Boolean(room.ranksCopiedAt);
  const table = `<table class="ranks-table"><thead><tr><th>Code</th><th>Rank</th>${rated ? '<th>Rating</th>' : ''}<th>Over time</th></tr></thead><tbody>${rows.map((r) => `<tr><td class="code">${esc(r.code)}</td><td>${esc(r.rank || '–')}</td>${rated ? `<td>${esc(r.rating || '–')}</td>` : ''}<td>${r.overTime ? 'Yes' : 'No'}</td></tr>`).join('')}</tbody></table>`;
  const block = problems.length
    ? `<div class="problems"><h3>Fix these before you copy the ranks</h3><ul>${problems.map((p) => `<li>${esc(p)}</li>`).join('')}</ul><a class="b" href="#/rank/${encodeURIComponent(room.id)}">Back to Rank</a></div>`
    : `<button class="b primary" type="button" data-vact="copy" data-what="ranks" data-key="copy-ranks">${sent ? '✓ Copied. Copy ranks again' : 'Copy ranks'}</button>`;
  return `<section class="review-stage" aria-labelledby="stage1"><h2 id="stage1">1. Ranks to submit</h2>
    <p class="muted">Enter these in the online ballot first. Most sites lock ranks when you submit, but keep comments open.</p>
    ${table}${block}</section>`;
}

// One comment card as HTML text. editing: the card shows its edit box.
export function cardHtml(c, editing) {
  const body = editing
    ? `<label class="sr-only" for="edit-${c.id}">Comment for ${esc(c.code)}</label><textarea id="edit-${c.id}" class="card-edit" data-vfield="comment" data-id="${c.id}" rows="6">${esc(c.comment)}</textarea>`
    : `<div class="card-text">${c.comment ? esc(c.comment) : '<span class="muted">No comment yet.</span>'}</div>`;
  return `<li class="card" data-card="${c.id}">
    <div class="card-head"><span class="code">${esc(c.code)}</span><span class="muted">${c.rank ? 'Rank ' + esc(c.rank) : 'No rank'}${c.rating ? ' · Rating ' + esc(c.rating) : ''}</span>
      <button class="b small quiet" type="button" data-vact="edit" data-id="${c.id}" data-key="edit-${c.id}" aria-expanded="${editing}">${editing ? 'Done' : 'Edit'}</button></div>
    ${c.question ? `<p class="card-question"><span class="muted">Question:</span> ${esc(c.question)}</p>` : ''}
    ${body}
    <ul class="critique" aria-label="Comment check for ${esc(c.code)}">${c.critique.map((k) => done(k.ok, k.label)).join('')}</ul>
    ${c.comment.trim() ? `<button class="b${c.copied ? '' : ' primary'}" type="button" data-vact="copy" data-what="${c.id}" data-key="copy-${c.id}">${c.copied ? '✓ Copied' : 'Copy comment'}</button>` : ''}
  </li>`;
}

// Stage 2 and the tools as HTML text. view: { order, editing }.
export function commentsStageHtml(room, view) {
  const list = cards(room, view.order);
  const reason = String(room.reasonForRank || '');
  const reasonEditing = view.editing === 'reason';
  return `<section class="review-stage" aria-labelledby="stage2"><h2 id="stage2" tabindex="-1">2. Comments</h2>
    <div class="order-toggle" role="group" aria-label="Card order">
      <button class="b small${view.order === 'speaking' ? ' on' : ''}" type="button" data-vact="order" data-order="speaking" data-key="order-speaking" aria-pressed="${view.order === 'speaking'}">Speaking order</button>
      <button class="b small${view.order === 'rank' ? ' on' : ''}" type="button" data-vact="order" data-order="rank" data-key="order-rank" aria-pressed="${view.order === 'rank'}">Rank order</button></div>
    <ol class="cards">${list.map((c) => cardHtml(c, view.editing === c.id)).join('')}</ol>
    <div class="card reason-card"><div class="card-head"><span>Reason for rank</span>
      <button class="b small quiet" type="button" data-vact="edit" data-id="reason" data-key="edit-reason" aria-expanded="${reasonEditing}">${reasonEditing ? 'Done' : 'Edit'}</button></div>
      ${reasonEditing ? `<label class="sr-only" for="edit-reason-box">Reason for rank</label><textarea id="edit-reason-box" class="card-edit" data-vfield="reason" rows="4">${esc(reason)}</textarea>` : `<div class="card-text">${reason.trim() ? esc(reason) : '<span class="muted">No reason for rank yet.</span>'}</div>`}
      ${reason.trim() ? `<button class="b${room.reasonCopiedAt ? '' : ' primary'}" type="button" data-vact="copy" data-what="reason" data-key="copy-reason">${room.reasonCopiedAt ? '✓ Copied' : 'Copy reason'}</button>` : ''}</div>
  </section>`;
}

// The top of the screen: the status pill and the checklist in words.
export function summaryHtml(room) {
  return `<div class="review-summary"><span class="pill${room.state === 'done' ? ' solid' : ''}" id="review-status">${esc(statusText(room))}</span>
    <ul class="checklist">${checklist(room).map((c) => done(c.ok, c.label)).join('')}</ul>
    <div class="review-tools"><button class="b" type="button" data-vact="copyall" data-key="copyall">Copy all</button>
      <button class="b" type="button" data-vact="print" data-key="print">Print / PDF</button></div></div>`;
}

// core/sheets.js copyBlocksHtml is not used here: its blocks have one generic Copy button and a read-only box, while
// DESIGN.md §4.7 asks for cards with Edit, a "Copied" state and the critique list.
// Copy text to the clipboard. Returns true when it worked. A browser that refuses the clipboard API gets the older
// select-and-copy way; if that fails too, the caller tells the judge to press Ctrl+C.
async function copyText(text) {
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
  const $ = (s) => env.el.querySelector(s);
  const room = () => findRoom(env.rooms(), roomId);
  const event = (r) => env.data.events.get(r.eventId, r.eventVersion);
  const save = (r) => { env.saveRoom(r); return r; };

  function draw(focusKey) {
    const r = room();
    if (!r) return;
    $('#review-top').innerHTML = summaryHtml(r);
    $('#review-ranks').innerHTML = ranksStageHtml(r);
    $('#review-comments').innerHTML = commentsStageHtml(r, view);
    // An element with that id first (the edit box), else the control with that data-key.
    if (focusKey) { const el = document.getElementById(focusKey) || $(`[data-key="${CSS.escape(focusKey)}"]`); if (el) el.focus(); }
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
    env.ui.announce(what === 'ranks' ? 'Ranks copied. Paste them into the online ballot.' : 'Copied.');
  }

  async function onClick(ev) {
    const b = ev.target.closest('[data-vact]');
    if (!b) return;
    const act = b.dataset.vact;
    if (act === 'copy') return copy(b.dataset.what);
    if (act === 'order') { view.order = b.dataset.order; return draw('order-' + view.order); }
    if (act === 'edit') {
      const id = b.dataset.id;
      view.editing = view.editing === id ? null : id;
      // Open: the focus goes into the edit box. Done: back to the Edit button (data-key edit-<id>).
      draw(view.editing === 'reason' ? 'edit-reason-box' : 'edit-' + id);
      return;
    }
    if (act === 'copyall') {
      const r = room();
      if (await copyText(copyAllText(r, event(r)))) env.ui.toast('Everything copied as one block.', { key: 'copy' });
      else env.ui.toast('This browser blocked copying.', { kind: 'error', key: 'copy' });
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
    const f = ev.target.dataset.vfield;
    const r = room();
    if (!f || !r) return;
    save(f === 'reason' ? setReasonReview(r, ev.target.value, env.now()) : setComment(r, ev.target.dataset.id, ev.target.value, env.now()));
    $('#review-top').innerHTML = summaryHtml(room());
    // The card's check list and Copy button change in place (the copy mark is gone now); the edit box keeps focus.
    const id = f === 'reason' ? 'reason' : ev.target.dataset.id;
    const old = f === 'reason' ? env.el.querySelector('.reason-card') : env.el.querySelector(`[data-card="${CSS.escape(id)}"]`);
    if (!old) return;
    const fresh = document.createElement('template');
    fresh.innerHTML = f === 'reason' ? commentsStageHtml(room(), view) : cardHtml(cards(room(), view.order).find((c) => c.id === id), true);
    const src = f === 'reason' ? fresh.content.querySelector('.reason-card') : fresh.content.firstElementChild;
    for (const sel of ['.critique', '[data-vact="copy"]']) {
      const a = old.querySelector(sel), b = src.querySelector(sel);
      if (a && b) a.replaceWith(b); else if (a) a.remove(); else if (b) old.append(b);
    }
  }

  const afterPrint = () => removePrintSheet();

  return {
    scope: 'review',
    show(id) {
      const r = findRoom(env.rooms(), id);
      if (!r) { env.ui.toast('That room is not on this device.', { key: 'noroom' }); env.go('rooms'); return; }
      roomId = id; view = { order: 'speaking', editing: null };
      const ev = event(r);
      env.el.innerHTML = `<div class="screen-head"><a class="b quiet" href="#/rank/${encodeURIComponent(id)}">‹ Rank</a>
          <h1 id="screen-title" tabindex="-1">Review · ${esc([ev ? ev.short : 'Custom', roundLine(r, false)].filter(Boolean).join(' · '))}</h1></div>
        <div id="review-top"></div><div id="review-ranks"></div><div id="review-comments"></div>`;
      env.el.addEventListener('click', onClick);
      env.el.addEventListener('input', onInput);
      window.addEventListener('afterprint', afterPrint);
      draw();
      $('#screen-title').focus();
    },
    hide() {
      env.el.removeEventListener('click', onClick);
      env.el.removeEventListener('input', onInput);
      window.removeEventListener('afterprint', afterPrint);
      removePrintSheet();
      roomId = null;
    },
  };
}
