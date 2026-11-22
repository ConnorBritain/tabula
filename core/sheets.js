// Shared code for Tabula Debate and Tabula Speech Events (docs/events/LANDING.md §3, step C10): the copy sheet (text
// blocks a judge pastes into the tournament site) and the print sheet, built from a model the app makes. The
// builders return HTML text, so Node tests can compare it exactly; showPrintSheet and removePrintSheet do the DOM.
// Generic words only (core-words.test.mjs). Loaded as described in core/defs.js.

// Exported for app code that builds HTML text (Speech Events lists; step E1).
export const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const e = escapeHtml;
const cls = (c) => (c === undefined ? '' : ` class="${c}"`);

// ---------- the copy sheet ----------
// blocks: [{ id, label, text, words?, note? }], in the order the tournament site asks for them. A block with no text
// shows "Nothing written yet" and no Copy button.
export function copyBlocksHtml(blocks) {
  return (blocks || []).map((b) => `<section class="copy-block" aria-labelledby="cb-h-${b.id}">
    <div class="copy-head"><h3 id="cb-h-${b.id}">${e(b.label)}${b.text && b.words !== undefined ? ` <span class="muted copy-words">${b.words} ${b.words === 1 ? 'word' : 'words'}</span>` : ''}</h3>${b.text ? `<button class="b small" type="button" data-copy-block="${b.id}" aria-label="Copy ${e(b.label)}">Copy</button>` : ''}</div>
    ${b.text ? `<textarea class="copy-text" id="cb-t-${b.id}" readonly rows="${Math.min(8, Math.max(2, b.text.split('\n').length + Math.floor(b.text.length / 70)))}" aria-labelledby="cb-h-${b.id}">${e(b.text)}</textarea>
    ${b.note ? `<p class="field-help copy-note">${e(b.note)}</p>` : ''}
    <p class="copy-fail" id="cb-f-${b.id}" hidden>Press Ctrl+C (⌘C on Mac) to copy.</p>` : '<p class="muted">Nothing written yet</p>'}
  </section>`).join('');
}

// ---------- the print sheet ----------
// sheet: { title, landscape, sections }. A section is one of:
//   { kind: 'facts', items: [[label, value]] }            a list of facts (nothing when empty)
//   { kind: 'lead', title, text }                          a heading and one large line (the result)
//   { kind: 'table', title, cls?, head: [cell], rows: [[cell]] }   cell: { text, cls? }
//   { kind: 'text', title, cls, text }                     a heading and long text; empty text says "Nothing written."
// cls is a class name for the element; on a table or a cell a missing cls writes no class attribute, while a text
// heading always writes one (class="" when missing), as the debate sheet always has. Every text is escaped.
export function printSheetHtml(sheet) {
  const cell = (tag, c) => `<${tag}${cls(c.cls)}>${e(c.text)}</${tag}>`;
  return `<h1>${e(sheet.title)}</h1>` + sheet.sections.map((s) => {
    if (s.kind === 'facts') return s.items.length ? '<dl class="ps-facts">' + s.items.map(([k, v]) => `<div><dt>${e(k)}</dt><dd>${e(v)}</dd></div>`).join('') + '</dl>' : '';
    if (s.kind === 'lead') return `<h2>${e(s.title)}</h2><p class="ps-win">${e(s.text)}</p>`;
    if (s.kind === 'table') return `<h2>${e(s.title)}</h2><table${cls(s.cls)}><thead><tr>${s.head.map((c) => cell('th', c)).join('')}</tr></thead><tbody>${s.rows.map((r) => `<tr>${r.map((c) => cell('td', c)).join('')}</tr>`).join('')}</tbody></table>`;
    return `<h2 class="${s.cls || ''}">${e(s.title)}</h2><div class="ps-text">${e(s.text) || '<span class="muted">Nothing written.</span>'}</div>`;
  }).join('');
}
// The class of the print sheet element (exported so the tests can check it with no DOM).
export const printSheetClass = (sheet) => 'print-sheet' + (sheet.landscape ? ' landscape' : '');

// Put the print sheet on the page (as #print-sheet, with body.printing) for the print window; removePrintSheet takes
// it away again after printing.
export function showPrintSheet(sheet) {
  removePrintSheet();
  const el = document.createElement('div');
  el.id = 'print-sheet'; el.className = printSheetClass(sheet);
  el.innerHTML = printSheetHtml(sheet);
  document.body.append(el); document.body.classList.add('printing');
}
export function removePrintSheet() {
  const old = document.getElementById('print-sheet');
  if (old) old.remove();
  document.body.classList.remove('printing');
}

(globalThis.TabulaCore = globalThis.TabulaCore || {}).sheets = Object.freeze({ escapeHtml, copyBlocksHtml, printSheetHtml, printSheetClass,
  showPrintSheet, removePrintSheet });
