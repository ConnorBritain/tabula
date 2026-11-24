// Speech Events step E9: the piece fields on the Room screen (family F1b interp). It plugs into createRoomScreen as a
// view, under the timer card (design build, review §2.4 change 3: the judge fills them once, so they no longer sit
// above the timer). Once any field has a value, the fields fold into one line ("Office Hours · K. Wu · Edit"); Edit
// opens them again. Interp events get Title and Author; a pair event (Duo) also gets Performer 1 and
// Performer 2 for its one entry. All optional, and every keystroke saves. The rules are in piece.js. The builder at
// the top is pure (Node tests call it); createPieceView does the DOM.
import { escapeHtml as esc } from '../../core/sheets.js';
import { hasPiece, isPair, pairNames, setPieceField } from './piece.js';
import { entryOf, updateEntry, roomEvent } from './room.js';

const field = (id, label, value, hint) => `<label class="field" for="piece-${id}"><span>${esc(label)}</span>
      <input id="piece-${id}" data-pfield="${id}" value="${esc(value)}" autocomplete="off"${hint ? ` placeholder="${esc(hint)}"` : ''}></label>`;

// The groups of fields and whether each is filled: the performers (a pair event; filled when both names are there),
// the title and the author (an event with a piece).
function groups(entry, event) {
  const [a, b] = pairNames(entry.name);
  const out = [];
  if (isPair(event)) out.push({ text: String(a || '').trim() && String(b || '').trim() ? a.trim() + ' & ' + b.trim() : '', html: field('name1', 'Performer 1', a) + field('name2', 'Performer 2', b) });
  if (hasPiece(event)) {
    out.push({ text: String(entry.title || '').trim(), html: field('title', 'Title', entry.title || '') });
    out.push({ text: String(entry.author || '').trim(), html: field('author', 'Author', entry.author || '') });
  }
  return out;
}

// The piece fields for one entry as HTML text ('' for an event with no piece and one performer, or a no show).
// A filled group folds into one line with an Edit button ("Office Hours · K. Wu"); an empty one stays an open field
// under it. editing: the judge tapped Edit, so every field shows.
export function pieceHtml(entry, event, editing) {
  const pair = isPair(event);
  const piece = hasPiece(event);
  if ((!pair && !piece) || !entry || entry.status === 'noShow') return '';
  const gs = groups(entry, event);
  const done = editing ? [] : gs.filter((g) => g.text);
  const open = editing ? gs : gs.filter((g) => !g.text);
  const what = pair ? 'performers and piece' : 'piece';
  const line = done.length ? `<p class="piece-line"><span class="sr-only">${pair ? 'Performers and piece' : 'Piece'}: </span>${esc(done.map((g) => g.text).join(' · '))}
      <button class="b quiet small" type="button" data-pact="edit" data-key="piece-edit" aria-label="Edit the ${what}">Edit</button></p>` : '';
  if (!open.length) return `<div class="piece is-folded" id="piece">${line}</div>`;
  return `<fieldset class="piece" id="piece">
    <legend>${pair ? 'Performers and piece' : 'Piece'} <span class="muted">(optional; stays on this device)</span></legend>
    ${line}<div class="piece-fields">
      ${open.map((g) => g.html).join('')}
    </div></fieldset>`;
}

export function createPieceView() {
  let ctx = null;
  let editing = null; // the entry id whose fields are open for an edit
  const env = () => ctx.env;

  function onClick(ev) {
    if (!ev.target.closest('[data-pact="edit"]')) return;
    const r = ctx.room();
    if (!r) return;
    editing = r.current;
    ctx.drawStage();
    const first = env().el.querySelector('#piece input');
    if (first) first.focus();
  }

  function onInput(ev) {
    const f = ev.target.dataset && ev.target.dataset.pfield;
    const r = ctx.room();
    if (!f || !r || !r.current) return;
    ctx.save(updateEntry(r, r.current, (e) => setPieceField(e, f, ev.target.value), env().now()));
    // A changed name shows at once in the roster and the stage head (one entry, both names).
    if (f === 'name1' || f === 'name2') {
      const e = entryOf(ctx.room(), r.current);
      const head = env().el.querySelector('#stage-name');
      if (head) head.textContent = e.name;
      ctx.drawRoster();
    }
  }

  return {
    // The fields stay open while the judge edits them; they fold at the next redraw for another entry or a fresh show.
    stageHtml: (r, e) => { if (editing && editing !== e.id) editing = null; return pieceHtml(e, roomEvent(env().data.events, r), editing === e.id); },
    mounted() { const box = env().el.querySelector('#piece'); if (box) { box.addEventListener('input', onInput); box.addEventListener('click', onClick); } },
    show(c) { ctx = c; editing = null; },
  };
}
