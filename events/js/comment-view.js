// Speech Events step E6: the comment sheet on the Room screen (DESIGN.md §4.3; primitives N10, N11). It plugs into
// createRoomScreen as a view, under the timer card. Every keystroke saves (no Save button), so a reload loses
// nothing. The rules are in comments.js. The builder at the top is pure (Node tests call it).
import { escapeHtml as esc } from '../../core/sheets.js';
import { KINDS, KIND_TITLE, tagKey, checkLabel, tapChip, toggleCheck, applyInput } from './comments.js';
import { entryOf, updateEntry, roomEvent } from './room.js';
import { icon } from './icons.js';
import { foldSummaryHtml, foldValueHtml } from './fold.js';
import { ranksShown } from './profile-layer.js';

// One chip and one rule check as HTML text (the sheet draws them, and a tap redraws just that button). A chip that is
// on gets a check and a 2 px edge, never the solid fill (§5.1 toggle chip). A rule check is a row with a flag button:
// flagged, it gets the caution tint, a full edge and the word "Flagged" (top 10 #3; a flag is not an error).
export const chipHtml = (t, kind, on) => `<button class="chip${on ? ' on' : ''}" type="button" data-cact="chip" data-kind="${kind}" data-tag="${esc(t.id)}" aria-pressed="${on}" title="${esc(t[kind])}">${on ? icon('check') : ''}${esc(t.label)}</button>`;
export const checkHtml = (c, flag) => `<button class="chk${flag ? ' flag' : ''}" type="button" data-cact="check" data-check="${esc(c)}" aria-pressed="${flag}"><span>${esc(checkLabel(c))}</span><span class="chk-state">${flag ? icon('flag', 14) + 'Flagged' : icon('flag', 14) + 'Flag'}</span></button>`;
// Put a new button in place of the old one and keep the focus on it.
function swap(old, html) { const t = document.createElement('template'); t.innerHTML = html; const n = t.content.firstElementChild; old.replaceWith(n); n.focus(); }

// The title icon of each chip row (§5.3 "Row title icons"): Strengths and To work on.
const KIND_ICON = Object.freeze({ strength: 'thumbs-up', toWork: 'arrow-up-right' });
// How many prompts show before "Show all" (D3-A).
export const PROMPTS_SHOWN = 3;

// "Things to comment on" (owner D3 A): always open, a short plain list above the comments box, which points to it with
// aria-describedby. Three prompts show; a quiet "Show all (N)" opens the rest in place. all: the judge opened them.
export function promptsHtml(prompts, all) {
  if (!prompts.length) return '';
  const shown = all ? prompts : prompts.slice(0, PROMPTS_SHOWN);
  const more = !all && prompts.length > PROMPTS_SHOWN ? `<button class="b small quiet prompts-more" type="button" data-cact="prompts-all" aria-controls="prompts-list">Show all (${prompts.length})${icon('chevron-down')}</button>` : '';
  return `<div class="prompts" id="prompts"><p class="chip-title" id="prompts-title">Things to comment on</p>
      <ul id="prompts-list" aria-labelledby="prompts-title">${shown.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>${more}</div>`;
}

// The comment sheet for one entry as HTML text. event: the room's event file (tags, checks and prompts).
// Top 10 #3: two named zones. "On the ballot" (the speech-bubble icon) holds the chips, the prompts and the comments;
// "Just for you" (the lock icon) holds the rule checks and the private note. The zone headings replace the old bracket
// hints, so "goes to the student" and "only for me" never look alike. view: { promptsAll, narrow } (optional; narrow:
// a phone, where the rule checks start as a closed fold "Rule checks · none flagged", §5.4).
// The reason for rank is not here: it is one room-level field (reasonFootHtml), not part of a speaker's card (D3-A).
export function sheetHtml(room, entry, event, view) {
  if (entry.status === 'noShow') return '';
  const v = view || {};
  const tags = (event && event.tags) || [];
  // A Custom event (step E12) has no chips: no empty "Strengths" and "To work on" rows.
  const chips = !tags.length ? '' : KINDS.map((kind) => `<div class="chip-group" role="group" aria-labelledby="chips-${kind}">
      <p class="chip-title" id="chips-${kind}">${icon(KIND_ICON[kind])}${KIND_TITLE[kind]}</p>
      <div class="chips">${tags.map((t) => chipHtml(t, kind, (entry.tags || []).includes(tagKey(kind, t.id)))).join('')}</div></div>`).join('');
  const checks = ((event && event.checks) || []).map((c) => checkHtml(c, (entry.checks || {})[c] === 'flag')).join('');
  const flags = ((event && event.checks) || []).filter((c) => (entry.checks || {})[c] === 'flag').length;
  const prompts = promptsHtml((event && event.prompts) || [], v.promptsAll);
  // The drawn question (step E10) moved to the top of the card, above the timer (design build, review §2.5:
  // quote-view.js), so the sheet no longer has its own field.
  return `<div class="sheet" id="sheet">
    <section class="zone zone-ballot" aria-labelledby="zone-ballot">
      <h3 class="zone-h" id="zone-ballot">${icon('message-square')}On the ballot</h3>
      ${chips}
      ${prompts}
      <label class="field sheet-notes" for="notes"><span>Comments for ${esc(entry.code)}</span></label>
      <textarea id="notes" rows="7" data-cfield="notes" spellcheck="true"${prompts ? ' aria-describedby="prompts-list"' : ''}>${esc(entry.notes || '')}</textarea>
    </section>
    <section class="zone zone-private" aria-labelledby="zone-private">
      <h3 class="zone-h" id="zone-private">${icon('lock')}Just for you <span class="muted">never on the ballot</span></h3>
      ${checks ? `<details class="chk-group fold"${!v.narrow || flags ? ' open' : ''}>${foldSummaryHtml('<span id="chk-title">Rule checks</span>', foldValueHtml(flags ? flags + ' flagged' : 'none flagged'))}<p class="field-help">Flags go in your private note.</p><div class="chks" role="group" aria-labelledby="chk-title">${checks}</div></details>` : ''}
      <label class="field" for="private-note"><span>Private note</span></label>
      <textarea id="private-note" rows="2" data-cfield="private">${esc(entry.privateNote || '')}</textarea>
    </section>
  </div>`;
}

// The room-level reason for rank (owner D3 A): a quiet "+ Add reason for rank" that opens the box and moves the focus
// into it. Once the box has text it stays open. Hidden when the rules have no ranks (a Rate round has its own field on
// the Rate screen; a comments-only round has none). open: the judge opened it in this visit.
export function reasonFootHtml(room, open) {
  if (!ranksShown(room.profile)) return '';
  const text = String(room.reasonForRank || '');
  if (!open && !text.trim()) return `<button class="b quiet" type="button" data-cact="reason-open" data-key="reason-open">${icon('plus')}Add reason for rank</button>`;
  return `<label class="field" for="reason"><span>Reason for rank <span class="muted">whole room</span></span></label>
    <textarea id="reason" rows="3" data-cfield="reason">${esc(text)}</textarea>`;
}

export function createCommentView() {
  let ctx = null;
  let promptsAll = false; // "Show all" opened in this room visit
  let reasonOpen = false; // "+ Add reason for rank" opened in this room visit
  const env = () => ctx.env;
  const room = () => ctx.room();
  const event = (r) => roomEvent(env().data.events, r);
  const $ = (s) => env().el.querySelector(s);
  const change = (id, fn) => { const r = room(); if (r) ctx.save(updateEntry(r, id, fn, env().now())); };

  function onInput(ev) {
    const f = ev.target.dataset && ev.target.dataset.cfield;
    const r = room();
    if (f && r) ctx.save(applyInput(r, f, ev.target.value, env().now()));
  }

  function onClick(ev) {
    const b = ev.target.closest('[data-cact]');
    const r = room();
    if (!b || !r) return;
    if (b.dataset.cact === 'prompts-all') {
      promptsAll = true;
      const box = $('#prompts'); const t = document.createElement('template');
      t.innerHTML = promptsHtml(((event(r) || {}).prompts) || [], true);
      if (box) { box.replaceWith(t.content.firstElementChild); const li = $('#prompts-list li:nth-child(' + (PROMPTS_SHOWN + 1) + ')'); if (li) { li.tabIndex = -1; li.focus(); } }
      return;
    }
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
  // The room-level reason for rank (D3-A): the button opens the box and moves the focus into it.
  function onFootClick(ev) {
    const b = ev.target.closest('[data-cact="reason-open"]');
    const r = room();
    if (!b || !r) return;
    reasonOpen = true;
    const foot = $('#room-foot-reason');
    if (foot) foot.innerHTML = reasonFootHtml(r, true);
    const box = $('#reason'); if (box) box.focus();
  }
  // Remember where the cursor was in the notes box, for the chips (a chip tap moves the focus to the chip).
  const keepCursor = (ev) => { if (ev.target.id === 'notes') ev.target.dataset.cursor = String(ev.target.selectionStart); };

  return {
    stageHtml: (r, e) => sheetHtml(r, e, event(r), { promptsAll, narrow: typeof matchMedia === 'function' && matchMedia('(max-width: 820px)').matches }),
    // The room-level part under the roster and the stage (room-screen.js footHtml hook).
    footHtml: (r) => `<div class="room-foot-reason" id="room-foot-reason">${reasonFootHtml(r, reasonOpen)}</div>`,
    footMounted() {
      const foot = $('#room-foot-reason');
      if (!foot) return;
      foot.addEventListener('click', onFootClick);
      foot.addEventListener('input', onInput);
    },
    mounted() {
      const box = $('#sheet');
      if (!box) return;
      box.addEventListener('input', onInput);
      box.addEventListener('click', onClick);
      for (const t of ['keyup', 'mouseup', 'touchend', 'select', 'input', 'blur']) box.addEventListener(t, keepCursor, true);
    },
    show(c) { ctx = c; promptsAll = false; reasonOpen = false; },
  };
}
