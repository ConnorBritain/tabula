// Speech Events step S2 (docs/events/EXPERIENCE.md §7): the palette, "Search and commands" (⌘K / Ctrl+K). A modal
// combobox over the page. The rows are pure (palette.js paletteRows); the search is core/keys.js searchCommands. This
// file draws the list in #palette (index.html) and runs the row the judge picks.
// The dialog rules (the page behind is inert, Tab stays inside, Esc and a click outside close it, focus goes back to
// where it was) are core/ui.js modalDialog's.
import { escapeHtml as esc } from '../../core/sheets.js';
import { searchCommands } from '../../core/keys.js';

// The list as HTML text. shown: the rows that match, in order; active: the index of the picked row; grouped: draw the
// group names (an empty search).
export function paletteListHtml(shown, active, grouped) {
  let html = '', last = '';
  shown.forEach((r, i) => {
    if (grouped && r.group !== last) {
      if (last) html += '</div>';
      html += `<div role="group" aria-labelledby="pal-g-${i}"><p class="pal-group" id="pal-g-${i}" role="presentation">${esc(r.group)}</p>`;
      last = r.group;
    }
    html += `<div class="pal-row${i === active ? ' is-active' : ''}" role="option" id="pal-o-${i}" data-i="${i}" aria-selected="${i === active}">`
      + `<span class="pal-label">${esc(r.label)}</span>${grouped ? '' : `<span class="pal-grp-name">${esc(r.group)}</span>`}</div>`;
  });
  if (grouped && last) html += '</div>';
  return html;
}

// env: { ui }. rows(): the rows for now (paletteRows(...)); run(row): what a picked row does.
export function createPalette(env, rows, run) {
  const $ = (s) => document.querySelector(s);
  const wrap = $('#palette'), card = $('#palette-card'), input = $('#pal-input'), list = $('#pal-list');
  let all = [], shown = [], active = 0;
  const dialog = env.ui.modalDialog(wrap, card, { name: 'palette', rank: 88 });

  function draw() {
    const q = input.value;
    shown = searchCommands(q, all);
    active = Math.max(0, Math.min(active, shown.length - 1));
    list.innerHTML = paletteListHtml(shown, active, !q.trim());
    $('#pal-empty').hidden = shown.length > 0;
    if (shown.length) { input.setAttribute('aria-activedescendant', 'pal-o-' + active); const el = $('#pal-o-' + active); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' }); }
    else input.removeAttribute('aria-activedescendant');
  }
  function pick(i) {
    const row = shown[i];
    if (!row) return;
    dialog.close();
    run(row);
  }
  input.addEventListener('input', () => { active = 0; draw(); });
  input.addEventListener('keydown', (e) => {
    if (e.isComposing) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (shown.length) { active = (active + (e.key === 'ArrowDown' ? 1 : -1) + shown.length) % shown.length; draw(); } }
    else if (e.key === 'Enter') { e.preventDefault(); pick(active); }
  });
  list.addEventListener('click', (e) => { const r = e.target.closest('.pal-row'); if (r) pick(Number(r.dataset.i)); });
  // Step S3 (S2 follow-up): a toast came or went while the palette is open, so the Undo row follows it (it never
  // offers an Undo whose toast is gone). core/ui.js fires 'tabula:toasts'.
  document.addEventListener('tabula:toasts', () => { if (dialog.isOpen()) { all = rows(); draw(); } });

  return Object.freeze({
    isOpen: dialog.isOpen,
    open() {
      if (dialog.isOpen() || env.ui.askIsOpen()) return;
      all = rows(); input.value = ''; active = 0;
      draw();
      dialog.open(input);
    },
    close: dialog.close,
  });
}
