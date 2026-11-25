// Comment kit: the screen parts. Sentence starters above a comment box, and under it the performance note and the
// length note. Two mounts, each one call from the screen that owns the box:
//   mountCommentKit(sheet, def, entryId)   the comment sheet on the Room screen (comment-view.js mounted)
//   mountReasonKit(box, def, key)          the reason for rank on the Rank screen (rank-screen.js show)
// The kit adds its parts around the box after the screen draws it. A starter tap writes into the box and sends an
// input event, so the screen saves the text the same way as typing (no second save path). Nothing is ever put in
// the box without a tap. The builders at the top are pure (Node tests call them).
import { escapeHtml as esc } from '../../core/sheets.js';
import { icon } from '../js/icons.js';
import { foldSummaryHtml } from '../js/fold.js';
import { STARTER_TITLE, startersFor, insertStarter, settledHits, hitWords, hitKeys, NOTE_TEXT, lengthNote } from './kit.js';

// One row of starters. Each chip shows the starter with "…" (the judge writes the rest).
export function starterRowHtml(def, kind, idp) {
  const list = startersFor(def, kind);
  if (!list.length) return '';
  const id = idp + '-' + kind;
  return `<div class="chip-group kit-row" role="group" aria-labelledby="${esc(id)}">
      <p class="chip-title" id="${esc(id)}">${esc(STARTER_TITLE[kind])}</p>
      <div class="chips">${list.map((s, i) => `<button class="chip kit-chip" type="button" data-kit-kind="${esc(kind)}" data-kit-i="${i}" aria-label="Start a sentence: ${esc(s)}">${esc(s)}…</button>`).join('')}</div></div>`;
}

// The starters for the comment sheet: a fold "Sentence starters" with a Strength row and a To work on row.
export function sheetStartersHtml(def, open) {
  const rows = ['strength', 'toWork'].map((k) => starterRowHtml(def, k, 'kit')).join('');
  if (!rows) return '';
  return `<details class="fold kit-starters"${open ? ' open' : ''}>${foldSummaryHtml('Sentence starters', '<span class="fold-value muted">tap one, then finish it</span>')}
      <div class="kit-rows" style="display:grid;gap:var(--s2);margin-top:var(--s2)">${rows}</div></details>`;
}

// The calm note under the box. text: the box text; hits: the hits to name. '' when there are none.
export function noteHtml(text, hits) {
  if (!hits.length) return '';
  const list = hitWords(text, hits).map((w) => '“' + esc(w) + '”').join(', ');
  return `<p style="margin:0;display:flex;gap:var(--s2);align-items:flex-start">${icon('info')}<span>${esc(NOTE_TEXT)}</span></p>
    <p class="muted" style="margin:var(--s1) 0 0">Words to check: ${list}</p>
    <div style="display:flex;flex-wrap:wrap;gap:var(--s2);margin-top:var(--s2)"><button class="b small" type="button" data-kit-act="edit">Edit</button><button class="b small quiet" type="button" data-kit-act="keep">Keep</button></div>`;
}

const NOTE_STYLE = 'margin-top:var(--s2);padding:var(--s2) var(--s3);border:1px solid var(--border-ctl);border-radius:var(--r-md);background:var(--sunk);font-size:var(--fs-2);color:var(--text)';

// "Keep" per comment: the hit words the judge chose to keep, by box key. The note comes back only for a new word.
// It lives for the page visit (memory only); a reload asks again.
const kept = new Map();
let startersOpen = true; // the fold, for this page visit

// Attach the kit to one text box. key: the "Keep" key; startersBefore: the element the starters go in front of (the
// box's label), else the box; startersHtml: the starters ('' for none).
function attach(box, def, key, startersBefore, startersHtml) {
  if (!box || box.dataset.kit) return;
  box.dataset.kit = '1';
  const doc = box.ownerDocument;
  const make = (html) => { const t = doc.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const starters = startersHtml ? make(startersHtml) : null;
  if (starters) (startersBefore || box).before(starters);
  const nid = (box.id || 'box') + '-kit-note';
  const note = make(`<div class="kit-note" id="${esc(nid)}" hidden style="${NOTE_STYLE}"></div>`);
  const live = make(`<p class="sr-only" role="status" aria-live="polite"></p>`);
  const count = make(`<p class="field-help kit-count" hidden></p>`);
  box.after(note, live, count);

  let shown = []; // the hits the note names now
  function update(done) {
    const text = box.value;
    const hits = settledHits(text, done);
    const keys = hitKeys(hits);
    const keep = new Set(kept.get(key) || []);
    const show = keys.some((k) => !keep.has(k));
    const was = !note.hidden;
    shown = show ? hits : [];
    // Redraw only when the words change: a blur comes just before a tap on Edit or Keep, and a redraw then would
    // swap the button under the judge's finger and lose the tap.
    const html = show ? noteHtml(text, hits) : '';
    if (show && html !== note.dataset.html) { note.innerHTML = html; note.dataset.html = html; }
    note.hidden = !show;
    if (show && !was) live.textContent = 'Check this comment. ' + NOTE_TEXT;
    if (!show && was) live.textContent = '';
    const len = lengthNote(text);
    count.textContent = len;
    count.hidden = !len;
  }

  function onStarter(ev) {
    const b = ev.target.closest('[data-kit-i]');
    if (!b) return;
    const s = startersFor(def, b.dataset.kitKind)[Number(b.dataset.kitI)];
    if (!s) return;
    // Where the cursor was when the box lost focus (the comment sheet keeps data-cursor; the kit keeps its own), else
    // the end of the text when the box was not used yet.
    const mark = box.dataset.cursor !== undefined ? box.dataset.cursor : box.dataset.kitCursor;
    const at = mark !== undefined ? Number(mark) : box.value.length;
    const res = insertStarter(box.value, s, at);
    box.value = res.text;
    box.focus();
    box.setSelectionRange(res.cursor, res.cursor);
    box.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function onNote(ev) {
    const b = ev.target.closest('[data-kit-act]');
    if (!b) return;
    if (b.dataset.kitAct === 'keep') {
      kept.set(key, [...new Set([...(kept.get(key) || []), ...hitKeys(shown)])]);
      update(true);
      box.focus();
      return;
    }
    const h = shown[0];
    box.focus();
    if (h) box.setSelectionRange(h.start, h.end);
  }

  if (starters) {
    starters.addEventListener('click', onStarter);
    starters.addEventListener('toggle', () => { startersOpen = starters.open; });
  }
  note.addEventListener('click', onNote);
  box.addEventListener('input', () => update(false));
  box.addEventListener('blur', () => { box.dataset.kitCursor = String(box.selectionStart); update(true); });
  update(true);
}

// The comment sheet (comment-view.js). sheet: the #sheet element; def: the room's event file; entryId: the speaker.
export function mountCommentKit(sheet, def, entryId) {
  if (!sheet) return;
  const box = sheet.querySelector('#notes');
  if (!box) return;
  attach(box, def, 'notes:' + (entryId || ''), sheet.querySelector('label[for="notes"]'), sheetStartersHtml(def, startersOpen));
}

// The reason for rank (rank-screen.js). box: the reason text box; key: one per room.
export function mountReasonKit(box, def, key) {
  if (!box) return;
  const row = starterRowHtml(def, 'reason', 'kit-reason');
  attach(box, def, 'reason:' + (key || ''), box.ownerDocument.querySelector(`label[for="${box.id}"]`), row ? `<div class="kit-starters" style="margin-bottom:var(--s2)">${row}</div>` : '');
}
