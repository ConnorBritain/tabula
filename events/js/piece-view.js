// Speech Events step E9: the piece fields on the Room screen (family F1b interp). It plugs into createRoomScreen as a
// view, above the timer card. Interp events get Title and Author; a pair event (Duo) also gets Performer 1 and
// Performer 2 for its one entry. All optional, and every keystroke saves. The rules are in piece.js. The builder at
// the top is pure (Node tests call it); createPieceView does the DOM.
import { escapeHtml as esc } from '../../core/sheets.js';
import { hasPiece, isPair, pairNames, setPieceField } from './piece.js';
import { entryOf, updateEntry, roomEvent } from './room.js';

const field = (id, label, value, hint) => `<label class="field" for="piece-${id}"><span>${esc(label)}</span>
      <input id="piece-${id}" data-pfield="${id}" value="${esc(value)}" autocomplete="off"${hint ? ` placeholder="${esc(hint)}"` : ''}></label>`;

// The piece fields for one entry as HTML text ('' for an event with no piece and one performer, or a no show).
export function pieceHtml(entry, event) {
  const pair = isPair(event);
  const piece = hasPiece(event);
  if ((!pair && !piece) || !entry || entry.status === 'noShow') return '';
  const [a, b] = pairNames(entry.name);
  return `<fieldset class="piece" id="piece">
    <legend>${pair ? 'Performers and piece' : 'Piece'} <span class="muted">(optional; stays on this device)</span></legend>
    <div class="piece-fields">
      ${pair ? field('name1', 'Performer 1', a) + field('name2', 'Performer 2', b) : ''}
      ${piece ? field('title', 'Title', entry.title || '') + field('author', 'Author', entry.author || '') : ''}
    </div></fieldset>`;
}

export function createPieceView() {
  let ctx = null;
  const env = () => ctx.env;

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
    stageHtml: (r, e) => pieceHtml(e, roomEvent(env().data.events, r)),
    mounted() { const box = env().el.querySelector('#piece'); if (box) box.addEventListener('input', onInput); },
    show(c) { ctx = c; },
  };
}
