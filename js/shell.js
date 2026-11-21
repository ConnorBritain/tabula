// Shell (Slice 5): the offline note and the corner chip in the top bar, the shortcut sheet, and the single-key switch.
// One part of the page code (see app.js for the load order). The parts are classic scripts that share one global
// scope, so a part can use what any part declares; code that runs at load only uses parts that load before it.
'use strict';

// ---------- offline note (spec 5.1) ----------
// "Offline" with a tip while there is no network; "Back online" for a few seconds when it returns. role="status",
// so a screen reader hears each change. Focusable only while it shows, so keyboard users can read the tip.
let netWas = true, netTimer = 0;
function renderNetNote() {
  const online = navigator.onLine !== false;
  const text = L.netNote(online, netWas);
  netWas = online;
  const el = $('#net-note');
  clearTimeout(netTimer);
  el.innerHTML = text ? '<span class="net-dot" aria-hidden="true"></span><span class="net-text">' + text + '</span>' : '';
  if (text === 'Offline') { el.dataset.tip = L.NET_TIP; el.tabIndex = 0; }
  else { delete el.dataset.tip; el.removeAttribute('tabindex'); }
  if (text === 'Back online') netTimer = setTimeout(() => { el.textContent = ''; }, 4000);
  renderPaletteSoon();
}
addEventListener('online', renderNetNote);
addEventListener('offline', renderNetNote);

// ---------- corner chip (spec 5.2, Q-1) ----------
// Off Flow, while a speech or prep clock runs, the chip shows "1AR · 2:41". A click goes back to Flow and to Start.
// Its accessible name updates at most every 15 s (L.chipNameDue); one message plays when it appears.
const chipState = { kind: '', nameAt: 0 };
const clockTime = (ms) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
function renderChip() {
  const chip = $('#clock-chip');
  const onFlow = (PLACE_OF[R.tab] || 'setup') === 'flow';
  const run = R.run ? { id: R.run.id, left: (R.run.endAt - Date.now()) / 1000 } : null;
  const prep = R.prepRun ? { side: prepClockById(R.prepRun.side).side, left: (R.prepRun.endAt - Date.now()) / 1000 } : null;
  const st = L.chipText({ onFlow, run, prep, format: FMT() });
  if (!st) {
    if (!chip.hidden) { chip.hidden = true; chipState.kind = ''; chipState.nameAt = 0; }
    return;
  }
  const appeared = chip.hidden || chipState.kind !== st.kind;
  chip.hidden = false;
  chip.dataset.side = st.side;
  if ($('#clock-chip-text').textContent !== st.text) $('#clock-chip-text').textContent = st.text;
  tone(chip, st.tone);
  const endAt = R.run ? R.run.endAt : R.prepRun.endAt;
  const tip = L.chipTip(clockTime(endAt), st.tone === 'error');
  if (chip.dataset.tip !== tip) chip.dataset.tip = tip;
  const now = Date.now();
  if (L.chipNameDue(chipState.nameAt, now, appeared)) {
    chip.setAttribute('aria-label', st.text + '. Back to Flow');
    chipState.nameAt = now;
  }
  if (appeared) announce(st.said);
  chipState.kind = st.kind;
}
$('#clock-chip').addEventListener('click', () => {
  showTab('flow');
  // The narrow layout shows the clock view's Start; wider ones the round bar's.
  const start = narrowNow() ? $('#cv-start') : $('#t-start');
  setTimeout(() => start.focus(), 0);
});

// ---------- the shortcut sheet (spec 5.5) ----------
// A non-modal panel on the right, built from the key registry. It can be open with the transcript drawer; Esc closes
// whichever opened last. In the narrow layout it is full screen, with [Done].
let ksOpener = null;
const ksOpen = () => !$('#keys-sheet').hidden;
function renderKeysSheet() {
  const q = $('#ks-search').value;
  const groups = K.shortcutRows(IS_MAC, S.singleKeys !== false, q, gateHas);
  const e = escapeHtml;
  $('#ks-list').innerHTML = groups.map((g) => '<h3>' + e(g.group) + '</h3><dl>' + g.rows.map((r) =>
    `<div class="ks-row${r.off ? ' off' : ''}"><dt>${e(r.label)}</dt><dd><kbd class="kbd">${e(r.keys)}</kbd>${r.off ? '<span class="ks-off">off</span>' : ''}</dd></div>`).join('') + '</dl>').join('');
  const none = !groups.length;
  $('#ks-empty').hidden = !none;
  $('#ks-empty').textContent = none ? 'No shortcut matches. Try the palette: ' + K.formatKeys(IS_MAC ? 'Meta+k' : 'Control+k', IS_MAC) + '.' : '';
}
// open: true / false, or leave it out to toggle. opener: where focus goes back to on close.
function toggleKeysSheet(open, opener) {
  const want = open == null ? !ksOpen() : Boolean(open);
  if (want === ksOpen()) { if (want) $('#ks-title').focus(); return; }
  if (want) {
    ksOpener = opener || document.activeElement;
    layerOpened('keys');
    $('#ks-search').value = '';
    renderKeysSheet();
    $('#keys-sheet').hidden = false;
    $('#ks-title').focus();
  } else {
    const inside = $('#keys-sheet').contains(document.activeElement);
    $('#keys-sheet').hidden = true;
    if (inside && ksOpener && document.contains(ksOpener) && ksOpener.offsetParent !== null) ksOpener.focus();
    else if (inside) document.activeElement.blur();
  }
}
$('#ks-close').addEventListener('click', () => toggleKeysSheet(false));
$('#ks-search').addEventListener('input', renderKeysSheet);
escLayer('keys-sheet', () => 30 + layerRank('keys'), ksOpen, () => toggleKeysSheet(false));
// Any other "Show keyboard shortcuts" button (Settings) opens the sheet too.
document.addEventListener('click', (e) => {
  const b = e.target.closest && e.target.closest('[data-help="keys"]');
  if (b && !b.closest('#help-menu')) toggleKeysSheet(true, b);
});

// ---------- the single-key switch (spec 5.5, WCAG 2.1.4) ----------
// On by default. Off turns off Space, [, ], \ and ?; ⌘ Enter / Ctrl+Enter still runs the clock. The same switch shows
// in the sheet's footer and in Settings.
function renderSingleKeys() {
  const on = S.singleKeys !== false;
  document.querySelectorAll('[data-single-keys]').forEach((b) => { b.checked = on; });
  $('#t-start').dataset.tip = K.startTip(IS_MAC, on);
  $('#speeches-btn').dataset.tip = K.speechesTip(IS_MAC, on);
  if (ksOpen()) renderKeysSheet();
}
document.addEventListener('change', (e) => {
  if (!e.target.matches || !e.target.matches('[data-single-keys]')) return;
  S.singleKeys = e.target.checked; saveSettings(); renderSingleKeys();
  toast(e.target.checked ? 'Single-key shortcuts are on.' : 'Single-key shortcuts are off. ' + K.formatKeys(IS_MAC ? 'Meta+Enter' : 'Control+Enter', IS_MAC) + ' still starts and pauses the clock.', { key: 'single-keys' });
});
