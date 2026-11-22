// Speech Events step E6: the comment sheet on the Room screen (DESIGN.md §4.3; primitives N10, N11). It plugs into
// createRoomScreen as a view, under the timer card. Every keystroke saves (no Save button), so a reload loses
// nothing. The rules are in comments.js. The builder at the top is pure (Node tests call it).
import { escapeHtml as esc } from '../../core/sheets.js';
import { KINDS, KIND_TITLE, tagKey, checkLabel, tapChip, toggleCheck, setNotes, setPrivateNote } from './comments.js';
import { entryOf, updateEntry } from './room.js';

// The comment sheet for one entry as HTML text. event: the room's event file (tags, checks and prompts).
export function sheetHtml(room, entry, event) {
  if (entry.status === 'noShow') return '';
  const tags = (event && event.tags) || [];
  const chips = KINDS.map((kind) => `<div class="chip-group" role="group" aria-labelledby="chips-${kind}">
      <p class="chip-title" id="chips-${kind}">${KIND_TITLE[kind]}</p>
      <div class="chips">${tags.map((t) => { const on = (entry.tags || []).includes(tagKey(kind, t.id)); return `<button class="chip${on ? ' on' : ''}" type="button" data-cact="chip" data-kind="${kind}" data-tag="${esc(t.id)}" aria-pressed="${on}" title="${esc(t[kind])}">${esc(t.label)}</button>`; }).join('')}</div></div>`).join('');
  const checks = ((event && event.checks) || []).map((c) => { const flag = (entry.checks || {})[c] === 'flag'; return `<button class="chk${flag ? ' flag' : ''}" type="button" data-cact="check" data-check="${esc(c)}" aria-pressed="${flag}"><span>${esc(checkLabel(c))}</span><span class="pill${flag ? ' err' : ' outline'}">${flag ? 'Flag' : 'OK'}</span></button>`; }).join('');
  const prompts = ((event && event.prompts) || []).map((p) => `<li>${esc(p)}</li>`).join('');
  return `<div class="sheet" id="sheet">
    ${chips}
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
  const event = (r) => env().data.events.get(r.eventId, r.eventVersion);
  const $ = (s) => env().el.querySelector(s);
  const change = (id, fn) => { const r = room(); if (r) ctx.save(updateEntry(r, id, fn, env().now())); };

  function onInput(ev) {
    const f = ev.target.dataset && ev.target.dataset.cfield;
    const r = room();
    if (!f || !r) return;
    if (f === 'reason') { ctx.save(Object.assign({}, r, { reasonForRank: ev.target.value, updatedAt: env().now() })); return; }
    change(r.current, (e) => (f === 'notes' ? setNotes(e, ev.target.value) : setPrivateNote(e, ev.target.value)));
  }

  function onClick(ev) {
    const b = ev.target.closest('[data-cact]');
    const r = room();
    if (!b || !r) return;
    const e = entryOf(r, r.current);
    if (!e) return;
    if (b.dataset.cact === 'chip') {
      const tag = (event(r).tags || []).find((t) => t.id === b.dataset.tag);
      if (!tag) return;
      const box = $('#notes');
      // The cursor of the notes box, or its end when the box was not used yet.
      const at = box && box.dataset.cursor !== undefined ? Number(box.dataset.cursor) : (e.notes || '').length;
      const res = tapChip(e, tag, b.dataset.kind, at);
      change(e.id, () => res.entry);
      if (box) { box.value = res.entry.notes; box.dataset.cursor = String(res.cursor); }
      b.classList.toggle('on', res.on); b.setAttribute('aria-pressed', String(res.on));
      return;
    }
    if (b.dataset.cact === 'check') {
      const next = toggleCheck(e, b.dataset.check);
      change(e.id, () => next);
      const flag = next.checks[b.dataset.check] === 'flag';
      b.classList.toggle('flag', flag); b.setAttribute('aria-pressed', String(flag));
      const pill = b.querySelector('.pill'); pill.textContent = flag ? 'Flag' : 'OK'; pill.className = 'pill ' + (flag ? 'err' : 'outline');
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
      for (const t of ['keyup', 'mouseup', 'select', 'blur']) box.addEventListener(t, keepCursor, true);
    },
    show(c) { ctx = c; },
  };
}
