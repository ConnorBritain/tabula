// The palette, "Search and commands" (Slice 5, spec 5.4, Q13). ⌘K / Ctrl+K, or the ? menu.
// The commands, their labels, the disabled rules and the search order are pure code in keys.js (COMMANDS,
// buildCommands, searchCommands); this file only draws the list and runs what the judge picks.
// One part of the page code (see app.js for the load order). The parts are classic scripts that share one global
// scope, so a part can use what any part declares; code that runs at load only uses parts that load before it.
'use strict';

// AI rows (Draft with AI, Switch to AI flow) show only when this says yes. Today it always does. It is the one place a
// later program setting (designed in docs/design/AI-POLICY.md, not built) can hide them, so no row has its own check.
function aiCommandsAllowed() { return L.APP_FEATURES.some(can); }

const pal = { opener: null, caret: null, rows: [], shown: [], active: 0, behind: [], wasInert: [], countTimer: 0 };
const palOpen = () => !$('#palette').hidden;
function paletteContext() {
  return {
    place: PLACE_OF[R.tab] || 'setup', cur: R.cur, running: Boolean(R.run), runId: R.run ? R.run.id : '',
    prep: R.prepRun ? prepClockById(R.prepRun.side).side : '', drawerOpen: !$('#tr-drawer').hidden, flowView: R.flowView,
    sheets: R.flows.map((f) => f.name), sheetIdx: R.flowIdx,
    speechesShown: isOverlay() ? leftOpen : !S.hideLeft, insights: insightsMode(), narrow: narrowNow(),
    online: navigator.onLine !== false, undo: (pendingUndo() || {}).name || '', aiAllowed: aiCommandsAllowed(), can: gateHas,
    speeches: FMT().speeches.map((s) => ({ id: s.id, label: s.label })),
  };
}
// opener: where focus goes back to (the ? button when opened from the menu). ⌘K while open closes it.
function openPalette(opener) {
  if (palOpen()) return closePalette(true);
  // Never over the tour, the welcome or another dialog (spec 5.4).
  if (askIsOpen() || tourState || !$('#node-editor').hidden || !$('#print-dialog').hidden || !$('#copy-sheet').hidden) return;
  const ae = document.activeElement;
  pal.opener = opener || (ae && ae !== document.body ? ae : null);
  pal.caret = null;
  try { if (ae && typeof ae.selectionStart === 'number') pal.caret = { el: ae, start: ae.selectionStart, end: ae.selectionEnd }; } catch {}
  pal.rows = K.buildCommands(paletteContext());
  $('#pal-input').value = '';
  pal.active = 0;
  renderPalette();
  // The page under it (the speeches overlay, the drawer and the sheet stay open) cannot be reached while it is open.
  pal.behind = [...document.querySelectorAll(window.TabulaUI.BEHIND + ', #tour-offer')];
  pal.wasInert = pal.behind.map((el) => el.inert);
  pal.behind.forEach((el) => { el.inert = true; });
  $('#palette').hidden = false;
  $('#pal-input').focus();
}
// restore: put focus and the caret back where they were (Esc, ⌘K, a click outside). A command that runs may move focus.
function closePalette(restore) {
  if (!palOpen()) return;
  $('#palette').hidden = true;
  pal.behind.forEach((el, i) => { el.inert = pal.wasInert[i]; });
  $('#pal-input').removeAttribute('aria-activedescendant');
  if (!restore) return;
  const back = pal.opener;
  if (back && document.contains(back) && back.focus) {
    back.focus();
    if (pal.caret && pal.caret.el === back) { try { back.setSelectionRange(pal.caret.start, pal.caret.end); } catch {} }
  } else if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
}
function renderPalette() {
  const q = $('#pal-input').value;
  pal.shown = K.searchCommands(q, pal.rows);
  pal.active = Math.max(0, Math.min(pal.active, pal.shown.length - 1));
  const e = escapeHtml, grouped = !q.trim();
  let html = '', last = '';
  pal.shown.forEach((r, i) => {
    if (grouped && r.group !== last) {
      if (last) html += '</div>';
      const gid = 'pal-g-' + i;
      html += `<div role="group" aria-labelledby="${gid}"><p class="pal-group" id="${gid}" role="presentation">${e(r.group)}</p>`;
      last = r.group;
    }
    const entry = r.keyId && K.REGISTRY.find((x) => x.id === r.keyId);
    const keys = entry ? `<kbd class="kbd" aria-hidden="true">${e(K.entryKeys(entry, IS_MAC))}</kbd>` : '';
    html += `<div class="pal-row${i === pal.active ? ' is-active' : ''}" role="option" id="pal-o-${i}" data-i="${i}" aria-selected="${i === pal.active}"${r.disabled ? ' aria-disabled="true"' : ''}>`
      + `<span class="pal-label">${e(r.label)}${r.note ? ' <span class="pal-note">' + e(r.note) + '</span>' : ''}</span>`
      + (grouped ? '' : `<span class="pal-grp-name">${e(r.group)}</span>`) + keys + '</div>';
  });
  if (grouped && last) html += '</div>';
  $('#pal-list').innerHTML = html;
  $('#pal-empty').hidden = pal.shown.length > 0;
  setPaletteActive(pal.active, false);
  // A polite count, a moment after typing stops (spec 5.4).
  clearTimeout(pal.countTimer);
  pal.countTimer = setTimeout(() => { $('#pal-count').textContent = pal.shown.length ? pal.shown.length + (pal.shown.length === 1 ? ' result' : ' results') : 'No match'; }, 400);
}
function setPaletteActive(i, scroll = true) {
  const n = pal.shown.length;
  const input = $('#pal-input');
  if (!n) { input.removeAttribute('aria-activedescendant'); return; }
  pal.active = (i + n) % n;
  document.querySelectorAll('#pal-list .pal-row').forEach((el) => {
    const on = Number(el.dataset.i) === pal.active;
    el.classList.toggle('is-active', on); el.setAttribute('aria-selected', String(on));
    if (on && scroll) el.scrollIntoView({ block: 'nearest' });
  });
  input.setAttribute('aria-activedescendant', 'pal-o-' + pal.active);
}
// While it is open, the rows follow the round: going offline, an Undo toast that comes or goes.
let palRefresh = 0;
function renderPaletteSoon() {
  if (!palOpen() || palRefresh) return;
  palRefresh = setTimeout(() => { palRefresh = 0; if (!palOpen()) return; pal.rows = K.buildCommands(paletteContext()); renderPalette(); }, 0);
}
document.addEventListener('tabula:toasts', () => { if (palOpen() && Boolean(pendingUndo()) !== pal.rows.some((r) => r.id === 'undo')) renderPaletteSoon(); });

// The palette rows switch the flow back to My flow before a sheet command (an AI flow sheet cannot be edited).
function paletteMine() { if (R.flowView === 'ai') { R.flowView = 'mine'; save(); renderFlow(); } }
// What each palette row does, by its keys.js COMMANDS id. A "Go to" row needs no entry: its COMMANDS row names its tab.
// slice5-static.test.mjs fails if a COMMANDS id has neither a tab nor an entry here, so a new command cannot be a dead row.
const PALETTE_RUN = {
  'open.library': () => window.open('learn/', '_blank', 'noopener'),
  'open.about': () => window.open('about.html', '_blank', 'noopener'),
  'clock.toggle': toggleClock,
  'speech.next': () => stepSpeech(1),
  'speech.prev': () => stepSpeech(-1),
  'speech.go': (row) => selectSpeech(row.arg), // view only, like a tile (spec 1.2)
  'clock.reset': resetSpeechClock,
  'prep.aff': () => togglePrep('aff'),
  'prep.neg': () => togglePrep('neg'),
  transcript: () => showDrawer($('#tr-drawer').hidden),
  'sheet.go': (row) => { paletteMine(); R.flowIdx = row.arg; save(); renderFlow(); },
  'sheet.next': () => { paletteMine(); R.flowIdx = (R.flowIdx + 1) % R.flows.length; save(); renderFlow(); },
  'sheet.prev': () => { paletteMine(); R.flowIdx = (R.flowIdx - 1 + R.flows.length) % R.flows.length; save(); renderFlow(); },
  'sheet.new': () => { paletteMine(); addSheet(); },
  'sheet.rename': () => { paletteMine(); renameSheet(); },
  'sheet.dup': () => { paletteMine(); duplicateSheet(); },
  'sheet.del': () => { paletteMine(); deleteSheet(); },
  'flow.view': () => { R.flowView = R.flowView === 'ai' ? 'mine' : 'ai'; save(); renderFlow(); },
  'pane.speeches': () => toggleSpeechesPane(),
  'pane.insights': toggleInsights,
  'pane.focus': toggleFocusMode,
  'round.new': () => $('#new-round').click(),
  'round.save': () => saveRoundFile(false),
  'round.open': () => $('#round-open').click(),
  'ballot.draft': () => { showTab('ballot'); openDraftPanel(); }, // it only opens the panel; no AI call
  'ballot.print': () => openPrintDialog(),
  'ballot.copy': openCopySheet,
  'ballot.save': () => $('#b-save').click(),
  undo: () => { const u = pendingUndo(); if (u) u.run(); },
  'help.keys': () => toggleKeysSheet(true),
  'help.tour': () => tourStart('main'),
  'help.pagetour': () => tourStart('page'),
};
function runPaletteRow(row) {
  if (!row) return;
  if (row.disabled) { announce(row.label + ' ' + row.note.replace(/^· /, '')); return; }
  closePalette(true);
  const cmd = K.COMMANDS.find((c) => c.id === row.id);
  if (cmd.flow && (PLACE_OF[R.tab] || 'setup') !== 'flow') showTab('flow');
  if (cmd.tab) return showTab(cmd.tab);
  const run = PALETTE_RUN[row.id];
  if (run) run(row);
}

$('#pal-input').addEventListener('input', () => { pal.active = 0; renderPalette(); });
$('#pal-input').addEventListener('keydown', (e) => {
  if (e.isComposing) return;
  if (e.key === 'ArrowDown') { e.preventDefault(); setPaletteActive(pal.active + 1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); setPaletteActive(pal.active - 1); }
  else if (e.key === 'Enter') { e.preventDefault(); runPaletteRow(pal.shown[pal.active]); }
  else if (e.key === 'Tab') e.preventDefault(); // the search box is the one stop in the palette
  else if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') { e.preventDefault(); e.stopPropagation(); closePalette(true); }
});
$('#pal-list').addEventListener('mousemove', (e) => { const r = e.target.closest('.pal-row'); if (r && Number(r.dataset.i) !== pal.active) setPaletteActive(Number(r.dataset.i), false); });
$('#pal-list').addEventListener('mousedown', (e) => e.preventDefault()); // keep focus (and the caret) in the search box
$('#pal-list').addEventListener('click', (e) => { const r = e.target.closest('.pal-row'); if (r) runPaletteRow(pal.shown[Number(r.dataset.i)]); });
$('#palette').addEventListener('mousedown', (e) => { if (e.target === $('#palette')) { e.preventDefault(); closePalette(true); } });
// Esc first clears the search, then closes the palette (spec 5.4).
escLayer('palette', 88, palOpen, () => {
  if ($('#pal-input').value) { $('#pal-input').value = ''; pal.active = 0; renderPalette(); }
  else closePalette(true);
});
