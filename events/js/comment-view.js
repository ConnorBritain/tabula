// Speech Events step E6: the comment sheet on the Room screen (DESIGN.md §4.3; primitives N10, N11). It plugs into
// createRoomScreen as a view, under the timer card. Every keystroke saves (no Save button), so a reload loses
// nothing. The rules are in comments.js. The builder at the top is pure (Node tests call it).
import { escapeHtml as esc } from '../../core/sheets.js';
import { KINDS, KIND_TITLE, tagKey, checkLabel, tapChip, toggleCheck, applyInput } from './comments.js';
import { entryOf, updateEntry, roomEvent } from './room.js';
import { asksQuestion, setQuestion, QUESTION_MAX } from './question.js';

// One chip and one rule check as HTML text (the sheet draws them, and a tap redraws just that button).
export const chipHtml = (t, kind, on) => `<button class="chip${on ? ' on' : ''}" type="button" data-cact="chip" data-kind="${kind}" data-tag="${esc(t.id)}" aria-pressed="${on}" title="${esc(t[kind])}">${esc(t.label)}</button>`;
export const checkHtml = (c, flag) => `<button class="chk${flag ? ' flag' : ''}" type="button" data-cact="check" data-check="${esc(c)}" aria-pressed="${flag}"><span>${esc(checkLabel(c))}</span><span class="pill${flag ? ' err' : ' outline'}">${flag ? 'Flag' : 'OK'}</span></button>`;
// Put a new button in place of the old one and keep the focus on it.
function swap(old, html) { const t = document.createElement('template'); t.innerHTML = html; const n = t.content.firstElementChild; old.replaceWith(n); n.focus(); }

// The comment sheet for one entry as HTML text. event: the room's event file (tags, checks and prompts).
export function sheetHtml(room, entry, event) {
  if (entry.status === 'noShow') return '';
  const tags = (event && event.tags) || [];
  // A Custom event (step E12) has no chips: no empty "Strengths" and "To work on" rows.
  const chips = !tags.length ? '' : KINDS.map((kind) => `<div class="chip-group" role="group" aria-labelledby="chips-${kind}">
      <p class="chip-title" id="chips-${kind}">${KIND_TITLE[kind]}</p>
      <div class="chips">${tags.map((t) => chipHtml(t, kind, (entry.tags || []).includes(tagKey(kind, t.id)))).join('')}</div></div>`).join('');
  const checks = ((event && event.checks) || []).map((c) => checkHtml(c, (entry.checks || {})[c] === 'flag')).join('');
  const prompts = ((event && event.prompts) || []).map((p) => `<li>${esc(p)}</li>`).join('');
  // The drawn question (step E10, extemp events): one line at the top of the sheet (MODELS.md §4.2).
  const question = asksQuestion(event) ? `<label class="field sheet-question" for="question"><span>Question drawn <span class="muted">(stays on this device)</span></span>
      <input id="question" data-cfield="question" maxlength="${QUESTION_MAX}" autocomplete="off" value="${esc(entry.question || '')}"></label>` : '';
  return `<div class="sheet" id="sheet">
    ${question}${chips}
    ${checks ? `<div class="chk-group" role="group" aria-labelledby="chk-title"><p class="chip-title" id="chk-title">Rule checks <span class="muted">(tap to flag; a flag goes in your private note)</span></p><div class="chks">${checks}</div></div>` : ''}
    <label class="field sheet-notes" for="notes"><span>Comments for ${esc(entry.code)} <span class="muted">(go on the ballot)</span></span></label>
    <textarea id="notes" rows="7" data-cfield="notes" spellcheck="true">${esc(entry.notes || '')}</textarea>
    ${prompts ? `<details class="prompts"><summary>Things to comment on</summary><ul>${prompts}</ul></details>` : ''}
    <label class="field" for="private-note"><span>Private note <span class="muted">(only for you; never on the ballot)</span></span></label>
    <textarea id="private-note" rows="2" data-cfield="private">${esc(entry.privateNote || '')}</textarea>
    <details class="reason"${room.reasonForRank ? ' open' : ''}><summary>Reason for rank <span class="muted">(whole room)</span></summary>
      <label class="sr-only" for="reason">Reason for rank</label>
      <textarea id="reason" rows="3" data-cfield="reason">${esc(room.reasonForRank || '')}</textarea></details>
  </div>`;
}

export function createCommentView() {
  let ctx = null;
  const env = () => ctx.env;
  const room = () => ctx.room();
  const event = (r) => roomEvent(env().data.events, r);
  const $ = (s) => env().el.querySelector(s);
  const change = (id, fn) => { const r = room(); if (r) ctx.save(updateEntry(r, id, fn, env().now())); };

  function onInput(ev) {
    const f = ev.target.dataset && ev.target.dataset.cfield;
    const r = room();
    if (f === 'question' && r) ctx.save(setQuestion(r, ev.target.value, env().now()));
    else if (f && r) ctx.save(applyInput(r, f, ev.target.value, env().now()));
  }

  function onClick(ev) {
    const b = ev.target.closest('[data-cact]');
    const r = room();
    if (!b || !r) return;
    const e = entryOf(r, r.current);
    if (!e) return;
    if (b.dataset.cact === 'chip') {
      const ev0 = event(r);
      const tag = ((ev0 && ev0.tags) || []).find((t) => t.id === b.dataset.tag);
      if (!tag) return;
      const box = $('#notes');
      // The cursor of the notes box, or its end when the box was not used yet.
      const at = box && box.dataset.cursor !== undefined ? Number(box.dataset.cursor) : (e.notes || '').length;
      const res = tapChip(e, tag, b.dataset.kind, at);
      change(e.id, () => res.entry);
      if (box) { box.value = res.entry.notes; box.dataset.cursor = String(res.cursor); }
      swap(b, chipHtml(tag, b.dataset.kind, res.on));
      return;
    }
    if (b.dataset.cact === 'check') {
      const next = toggleCheck(e, b.dataset.check);
      change(e.id, () => next);
      const flag = next.checks[b.dataset.check] === 'flag';
      swap(b, checkHtml(b.dataset.check, flag));
      const priv = $('#private-note'); if (priv) priv.value = next.privateNote;
      env().ui.announce(checkLabel(b.dataset.check) + (flag ? ': flagged, in your private note.' : ': OK.'));
    }
  }
  // Remember where the cursor was in the notes box, for the chips (a chip tap moves the focus to the chip).
  const keepCursor = (ev) => { if (ev.target.id === 'notes') ev.target.dataset.cursor = String(ev.target.selectionStart); };

  return {
    stageHtml: (r, e) => sheetHtml(r, e, event(r)),
    mounted() {
      const box = $('#sheet');
      if (!box) return;
      box.addEventListener('input', onInput);
      box.addEventListener('click', onClick);
      for (const t of ['keyup', 'mouseup', 'touchend', 'select', 'input', 'blur']) box.addEventListener(t, keepCursor, true);
    },
    show(c) { ctx = c; },
  };
}
