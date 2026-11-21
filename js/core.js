// Core page state: storage, the shortcut handler, the saved round (R), tabs, side panes, form binding,
// the speaker points range and round files (.tab).
// One part of the page code (see app.js for the load order). The parts are classic scripts that share one global
// scope, so a part can use what any part declares; code that runs at load only uses parts that load before it.
'use strict';

// Tabula running on this computer (through the local helper), not on the website.
const LOCAL_ORIGIN = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
const L = window.PolicyLogic;
const K = window.TabulaKeys;
const IS_MAC = K.isMacPlatform(navigator.platform || navigator.userAgent);
const $ = (s) => document.querySelector(s);
const STORE = L.STORE_KEYS.round, LOG = 'policyJudge.log.v1', KEY = 'policyJudge.key';
// Feature flags (logic/flags.js). A flagged part starts hidden in index.html and shows only when its flag is on.
const flagOn = (name) => L.flagOn(name, { search: location.search, local: LOCAL_ORIGIN });
document.querySelectorAll('[data-flag]').forEach((el) => { if (flagOn(el.dataset.flag)) el.hidden = false; });

// ---------- storage (never trust it to exist) ----------
const store = {
  get(k, d) {
    let raw = null;
    try { raw = localStorage.getItem(k); return raw ? JSON.parse(raw) : d; }
    catch { try { if (raw) localStorage.setItem(k + '.corrupt-backup', raw); } catch {} return d; }
  },
  set(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); if (storageWarned) { storageWarned = ''; dismissToast('storage'); } return true; }
    catch (err) { storageFailed(err); return false; }
  },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};
// A failed save shows one error toast (key 'storage'), not one per keystroke. The clock still runs in memory.
let storageWarned = '';
function storageFailed(err) {
  const kind = L.storageErrorKind(err);
  if (storageWarned === kind) return;
  storageWarned = kind;
  toast(kind === 'full'
    ? "This browser's storage for Tabula is full, so new changes are not saved. Delete old saved ballots in History, or go to Round and use Save round file (.tab)."
    : 'This browser is not saving. A refresh will lose the clock and your flow. To keep a copy, go to Round and use Save round file (.tab).', { kind: 'error', key: 'storage' });
}

// The shared toast, dialog, Esc stack and announcer live in ui.js (spec Slice 0).
const { toast, dismissToast, pendingUndo, announce, ask, askIsOpen, escLayer, modalDialog } = window.TabulaUI;
// Side panels that can be open together (the transcript drawer and the shortcut sheet) close with Esc in the
// order they opened, newest first (spec 5.5). layerRank gives a small extra rank to the newer one.
const layerSeq = {}; let layerCount = 0;
function layerOpened(name) { layerSeq[name] = ++layerCount; }
const layerRank = (name) => (layerSeq[name] || 0) / 1e6;

// ---------- shortcuts (keys.js registry; spec 4.1, 1.3, 1.5) ----------
// A dialog (the welcome is one), the tour or the node editor turns shortcuts off.
function modalOpen() { return askIsOpen() || !$('#node-editor').hidden || Boolean(tourState) || !$('#print-dialog').hidden || !$('#copy-sheet').hidden || !$('#palette').hidden; }
// The narrow layout (under 820 px, Q-10): the palette opens from the ? menu only there (spec 5.4).
const narrowNow = () => innerWidth < 820;
document.addEventListener('keydown', (e) => {
  const ae = document.activeElement;
  const act = K.keyAction(
    { code: e.code, key: e.key, meta: e.metaKey, ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey, altGraph: Boolean(e.getModifierState && e.getModifierState('AltGraph')), repeat: e.repeat, composing: e.isComposing || e.keyCode === 229 },
    { place: PLACE_OF[R.tab] || 'setup', tab: R.tab, focus: K.focusKind(ae && { tagName: ae.tagName, type: ae.type, isContentEditable: ae.isContentEditable }), modal: modalOpen(), singleKeysOn: S.singleKeys !== false, narrow: narrowNow() });
  if (act === 'clock') { e.preventDefault(); toggleClock(); }
  else if (act === 'speeches') { e.preventDefault(); toggleSpeechesPane(ae); }
  else if (act === 'print') { e.preventDefault(); openPrintDialog(); } // ⌘P on the Ballot: Tabula's print dialog (spec 4.10)
  else if (act === 'palette') { e.preventDefault(); openPalette(); } // ⌘K (spec 5.4); the palette closes itself on ⌘K
  else if (act === 'shortcuts') { e.preventDefault(); toggleKeysSheet(); } // ? (spec 5.5)
  else if (act === 'insights') { e.preventDefault(); toggleInsights(); } // ] (spec 4.1)
  else if (act === 'focus') { e.preventDefault(); toggleFocusMode(); } // \ (spec 4.1)
});

// The round's format (formats/*.js through logic/format.js). Page code reads speeches, flow columns, debaters and prep
// clocks from it and passes it into the logic; the logic never reads R. A round keeps its format for its whole life.
const FMT = () => L.formatOf(R);
// The judge's last prep choice per format, in minutes. Policy keeps its old setting name (prepMin), so no judge loses it.
const prepMinSaved = (s, fmt) => (fmt.id === 'policy-hs' ? s.prepMin : (s.prepMinFor || {})[fmt.id]);
// Prep per clock for a new round: the judge's last choice for this format, else the format's own time (NSDA: 8 minutes
// per team in policy, 4 per debater in LD).
function prepDefault(fmt) {
  const m = Number(prepMinSaved(store.get('policyJudge.settings.v1', {}) || {}, fmt) ?? NaN);
  return Number.isFinite(m) && m >= 0 && m <= 20 ? m * 60 : fmt.prep.seconds;
}
// prev: the round being replaced. Its points range carries over to the new round (spec 4.7); the first round ever uses
// the format's range (25–30). fmt: the new round's format; when not given, prev's format, else policy.
function freshRound(prev, fmt) {
  const f = fmt || (prev ? L.formatOf(prev) : L.getFormat(L.DEFAULT_FORMAT_ID));
  const prep = prepDefault(f);
  return {
    ...L.formatFields(f),
    ptsRange: prev && prev.ptsRange ? L.ptsRange(prev.ptsRange) : L.ptsRange(f.ballot.points),
    tournament: '', roundName: '', judge: '', topic: '', room: '', start: '', flight: '',
    aff: { team: '', d1: '', d2: '' }, neg: { team: '', d1: '', d2: '' },
    prepSeconds: prep,
    prepLeft: L.fullPrep(f, prep),
    flows: f.defaultSheets.map((name) => ({ name, cells: {} })),
    transcripts: {}, timeLeft: {}, aiFlows: [], aiFlowAt: 0, flowView: 'mine',
    ai: { paradigm: 'policymaker', notes: '', evidence: '', output: '' },
    ballot: { winner: '', pts: {}, ranks: {}, rfd: '', touched: {}, aiFilled: {} },
    id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())), cur: 0, flowIdx: 0, tab: 'flow',
    programId: null, // "Judging for": the school whose AI policy and credits apply (js/judging.js); null = Just me
    // The clocks (spec 1.1). run = the running speech { id, endAt, beeped, rec }; prepRun = { side, endAt }.
    // savedAt stamps the clock fields as one unit, so a second tab can tell which clock is newer.
    run: null, prepRun: null, savedAt: 0,
  };
}
// A saved round with no format is from before formats: it loads as policy-hs version 1 (L.OLD_ROUND).
const storedRound = store.get(STORE, null);
let R = Object.assign(freshRound(), storedRound ? L.OLD_ROUND : {}, storedRound || {});
if (!L.formatKnown(R)) {
  // A round from a newer Tabula (a format or version this copy does not have). Keep a copy, then start clean.
  store.set(STORE + '.unknown-format-backup', R);
  R = freshRound();
  setTimeout(() => toast('The saved round uses a debate format this copy of Tabula does not have, so a new round was started. Reload the page to get the newest Tabula; a copy of the old round is kept in this browser.', { kind: 'error', key: 'format' }));
}
R.ptsRange = L.ptsRange(R.ptsRange); // a round saved before Slice 4 has none: 25–30
// The defaults above are policy's. A round in another format whose prep fields are missing or damaged gets that
// format's prep clocks at full time.
function fitPrepToFormat() {
  const clocks = L.prepClocks(FMT());
  if (!Number.isFinite(R.prepSeconds)) R.prepSeconds = prepDefault(FMT());
  if (!clocks.every((c) => Number.isFinite((R.prepLeft || {})[c.id]))) R.prepLeft = L.fullPrep(FMT(), R.prepSeconds);
}
fitPrepToFormat();
R.id ??= String(Date.now());
// Save at once so the round id is fixed before any doc is tied to it.
const bootSaved = store.set(STORE, R);
// While a backup is being restored, nothing may write the old in-memory data back.
let restoring = false;
// The ballot bar shows if the last save worked (spec 4.1): the time, or why it did not.
let lastSave = bootSaved ? { at: Date.now(), err: '' } : { at: 0, err: storageWarned || 'blocked' };
const save = () => {
  if (restoring) return false;
  const ok = store.set(STORE, R);
  lastSave = ok ? { at: Date.now(), err: '' } : { at: lastSave.at, err: storageWarned || 'blocked' };
  if (R.tab === 'ballot') renderSaveStatus();
  return ok;
};

const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
function setPath(o, p, v) { const ks = p.split('.'); const last = ks.pop(); ks.reduce((a, k) => (a[k] ??= {}), o)[last] = v; }
// Copies text. Returns true or false; the caller gives the feedback (spec 4.11).
async function copy(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    try { const ta = document.createElement('textarea'); ta.value = text; document.body.append(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return Boolean(ok); }
    catch { return false; }
  }
}
// The plain callers: a toast either way.
async function copyToast(text) { toast((await copy(text)) ? 'Copied' : 'Copy did not work in this browser. Select the text and press Ctrl+C (⌘C on Mac).'); }
function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: type || 'text/csv' }));
  a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}
const safeName = (s) => (s || 'round').replace(/[^\w-]+/g, '_');

// ---------- tabs ----------
// Four places plus Settings. Each place shows one or more of the old sections.
// The internal id 'log' stays (old backups and the tour use it); the nav says History (spec 2.5; the owner renamed it from Ballots on 2026-11-20).
const PLACES = [['flow', 'Flow'], ['setup', 'Round'], ['decide', 'Decide'], ['log', 'History']];
// Decide has three tabs (spec 4.0): Live Eval, Analysis, Ballot. An old saved 'draft' tab opens the Ballot (L.decideTab).
const PLACE_OF = { setup: 'setup', timer: 'flow', flow: 'flow', eval: 'decide', analysis: 'decide', ballot: 'decide', log: 'log', ai: 'ai' };
function showTab(id) {
  if (id === 'decide') id = R.lastDecide || 'eval';
  if (id === 'timer') id = 'flow';
  id = L.decideTab(id);
  if (id === 'eval' && !can('liveEval')) id = 'ballot'; // a removed tab never opens (Analysis stays: its glance and hand map need no AI)
  if (!PLACE_OF[id]) id = 'setup';
  const place = PLACE_OF[id];
  R.tab = id; if (place === 'decide') R.lastDecide = id; save();
  document.body.dataset.place = place; measureRoundBar(); // scopes the round bar to Flow (spec 5.2, Q-1)
  const shown = place === 'flow' ? ['tab-timer', 'tab-flow'] : ['tab-' + id];
  document.querySelectorAll('section.tab').forEach((s) => s.classList.toggle('on', shown.includes(s.id)));
  $('#workspace').classList.toggle('on', place === 'flow');
  $('#subnav').hidden = place !== 'decide';
  document.querySelectorAll('#subnav button').forEach((b) => { const on = b.dataset.tab === id; b.classList.toggle('on', on); if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  if (id !== 'ballot') closeDraftPanel(false);
  document.querySelectorAll('#nav button').forEach((b) => { const on = b.dataset.tab === place; b.classList.toggle('on', on); if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  if (place === 'ai') $('#settings-btn').setAttribute('aria-current', 'page'); else $('#settings-btn').removeAttribute('aria-current');
  if (id === 'ballot') renderBallot();
  if (id === 'log') { renderLog(); renderBackup(); }
  if (id === 'setup') renderJudging(); // a speech may have run since: the school is then set for the round
  if (id === 'flow') { renderFlow(); renderInsights(); }
  if (id === 'eval') renderEval();
  if (id === 'analysis') renderAnalysis();
  renderChip();
}
$('#nav').innerHTML = PLACES.map(([id, t]) => `<button type="button" class="b quiet" data-tab="${id}">${t}</button>`).join('');
document.querySelector('.brand').addEventListener('click', (e) => { e.preventDefault(); showTab('flow'); });
$('#nav').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) showTab(b.dataset.tab); });
$('#subnav').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) showTab(b.dataset.tab); });
$('#settings-btn').addEventListener('click', () => showTab('ai'));
// Side panes in the Flow workspace. At 1440 px and up the speeches pane is inline and can be hidden (remembered).
// From 820 to 1439 px it is a flat overlay over the grid that starts closed, so the 7 columns never reflow
// (spec 1.5, Q4). It is not modal: no focus trap. Under 820 px the panes stack.
let leftOpen = false, leftOpener = null;
const paneMode = () => L.leftPaneMode(innerWidth, Boolean(S.hideLeft));
const isOverlay = () => paneMode().startsWith('overlay');
function applyPanes() {
  const overlay = isOverlay();
  if (!overlay) leftOpen = false;
  const ws = $('#workspace');
  ws.classList.toggle('no-left', !overlay && Boolean(S.hideLeft));
  ws.classList.toggle('left-open', overlay && leftOpen);
  // Insights (V9, Q8): the open pane, or a 32 px edge. With no AI it folds to the Connect AI prompt: the whole row
  // (reason and button) is hidden in every other mode, so no empty box or AI prompt is left when AI is ready.
  const mode = insightsMode();
  ws.classList.toggle('ins-folded', mode !== 'open' && mode !== 'none'); // not 'ins-edge': that is the strip's own class
  ws.classList.toggle('ins-none', mode === 'none'); // the AI gate removed Insights: the grid takes the width
  $('#insights').dataset.mode = mode;
  $('#ins-cta').hidden = mode !== 'edge-connect';
  $('#ins-show').hidden = mode !== 'edge-show';
  const btn = $('#speeches-btn');
  btn.hidden = !(overlay || S.hideLeft);
  btn.setAttribute('aria-expanded', String(overlay ? leftOpen : !S.hideLeft));
  btn.dataset.tip = K.speechesTip(IS_MAC, S.singleKeys !== false);
}
const insightsMode = () => L.insightsMode({ allowed: can('liveEval'), setup: showSetup(), aiReady: aiReady(), hideRight: Boolean(S.hideRight) });
function focusSpeechTile() { const t = $('#speech-list .sp.run') || $('#speech-list .sp.on'); if (t) t.focus(); }
function openSpeeches(from) {
  leftOpener = from && from !== document.body && !from.closest('#tab-timer') ? from : null;
  leftOpen = true; applyPanes(); focusSpeechTile();
}
// restoreFocus: false when the judge clicked somewhere else (focus goes where they clicked).
function closeSpeeches(restoreFocus = true) {
  if (!leftOpen) return;
  const hadFocus = $('#tab-timer').contains(document.activeElement);
  leftOpen = false; applyPanes();
  if (!restoreFocus) return;
  if (leftOpener && document.contains(leftOpener) && !leftOpener.hidden) leftOpener.focus();
  else if (hadFocus && document.activeElement.blur) document.activeElement.blur(); // back to "nothing focused", so Space still runs the clock
}
function toggleSpeechesPane(from) {
  if (isOverlay()) return leftOpen ? closeSpeeches() : openSpeeches(from);
  S.hideLeft = !S.hideLeft; saveSettings(); applyPanes();
  if (!S.hideLeft) focusSpeechTile();
}
$('#speeches-btn').addEventListener('click', (e) => toggleSpeechesPane(e.currentTarget));
// ] shows or hides Insights (open / edge). With no AI it is folded to "Connect AI", so the key does nothing (spec 4.1).
function toggleInsights() {
  if (insightsMode() === 'edge-connect' || insightsMode() === 'none') return false;
  S.hideRight = !S.hideRight; saveSettings(); applyPanes();
  return true;
}
// \ is focus mode: both panes hide. Pressed again (or with a pane hidden by focus mode), both come back.
function toggleFocusMode() {
  const overlay = isOverlay();
  const leftShown = overlay ? leftOpen : !S.hideLeft;
  const rightShown = insightsMode() === 'open';
  if (leftShown || rightShown) {
    if (overlay) closeSpeeches(false); else S.hideLeft = true;
    S.hideRight = true;
  } else { S.hideLeft = false; S.hideRight = false; }
  saveSettings(); applyPanes();
}
document.addEventListener('click', (e) => {
  const b = e.target.closest && e.target.closest('[data-pane]'); if (!b) return;
  if (b.dataset.pane === 'left') { if (isOverlay()) return closeSpeeches(); S.hideLeft = !S.hideLeft; }
  else S.hideRight = !S.hideRight;
  saveSettings(); applyPanes();
  // Showing or hiding Insights moves focus to the control that stays (the Hide button or the edge).
  if (b.dataset.pane === 'right') { const to = S.hideRight ? $('#ins-show') : $('#insights [data-pane="right"]'); if (to && !to.hidden) to.focus(); }
});
// A click in the grid closes the overlay; a click in the round bar or on a speech tile does not.
document.addEventListener('pointerdown', (e) => {
  if (!leftOpen || !e.target.closest) return;
  if (e.target.closest('#tab-timer') || e.target.closest('#speeches-btn')) return;
  if (e.target.closest('#workspace')) closeSpeeches(false);
});
escLayer('speeches', 40, () => leftOpen, () => closeSpeeches());
addEventListener('resize', () => { applyPanes(); renderRecStrip(); measureRoundBar(); }); // cheap class toggles, so no frame wait (frames pause in hidden tabs)
// The pane mode changes at 1440 and 820 px; listen to those breakpoints too (some zoom and emulation changes fire no resize).
for (const q of ['(min-width: 1440px)', '(min-width: 820px)']) matchMedia(q).addEventListener('change', () => { applyPanes(); renderRecStrip(); measureRoundBar(); });

// ---------- simple two-way binding ----------
function bindAll() {
  document.querySelectorAll('[data-bind]').forEach((el) => {
    el.value = getPath(R, el.dataset.bind) ?? '';
  });
}
document.addEventListener('input', (e) => {
  const p = e.target.dataset && e.target.dataset.bind;
  if (!p) return;
  setPath(R, p, e.target.value); markTouched(p); save();
  if (p.startsWith('ballot') || p.startsWith('aff') || p.startsWith('neg')) renderBallotCheck();
});
document.addEventListener('change', (e) => { if (e.target.dataset && e.target.dataset.bind) { setPath(R, e.target.dataset.bind, e.target.value); markTouched(e.target.dataset.bind); save(); } });
// A ballot field the judge types into is theirs: the AI will not change it (spec 4.2). path: 'ballot.rfd' or a field.
function markTouched(path) {
  const f = path.startsWith('ballot.') ? path.slice(7) : path;
  if (!L.ballotFields(FMT()).includes(f)) return;
  const was = L.fieldState(R.ballot, f);
  R.ballot = L.markFields(R.ballot, [f], 'yours');
  R.ballotUndo = null; // "Undo the last insert" lasts until the next edit (spec 4.5)
  if (R.ballotReview) R.ballotReview = L.staleReviewCards(R.ballotReview, R.ballot);
  if (was !== 'yours' || R.ballotReview) renderBallotTags();
}

$('#prep-min').value = Math.round(R.prepSeconds / 60);
// "each team" (prep per team) or "each debater" (prep per debater).
const prepWho = () => (FMT().prep.mode === 'perDebater' ? 'each debater' : 'each team');
$('#prep-min').addEventListener('change', (e) => {
  const m = Math.max(0, Math.min(20, Number(e.target.value) || 0));
  const used = R.prepRun || L.prepClocks(FMT()).some((c) => R.prepLeft[c.id] < R.prepSeconds);
  stopPrep();
  const before = { prepSeconds: R.prepSeconds, prepLeft: { ...R.prepLeft }, prepMin: prepMinSaved(S, FMT()) };
  setPrep(m * 60, L.fullPrep(FMT(), m * 60), m);
  // Prep already in use: the change is made, and Undo gives each team its time back (spec 2.4 #1).
  if (used) undoToast('Prep set to ' + m + ' min for ' + prepWho() + '.', 'prep time change', () => setPrep(before.prepSeconds, before.prepLeft, before.prepMin), 'Prep time restored.');
});
function setPrep(seconds, left, min) {
  stopPrep(); R.prepSeconds = seconds; R.prepLeft = left; saveClocks(); renderPrep();
  $('#prep-min').value = Math.round(seconds / 60);
  if (FMT().id === 'policy-hs') S.prepMin = min; else (S.prepMinFor ??= {})[FMT().id] = min;
  saveSettings(); renderPrepPresets();
}
function renderPrepPresets() { document.querySelectorAll('[data-prep-min]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.prepMin) * 60 === R.prepSeconds))); }
document.addEventListener('click', (e) => {
  const b = e.target.closest && e.target.closest('[data-prep-min]'); if (!b) return;
  $('#prep-min').value = b.dataset.prepMin; $('#prep-min').dispatchEvent(new Event('change'));
});
// ---------- speaker points range (spec 4.7, Q10): this round only, in Round setup ----------
function renderRange() {
  const r = L.ptsRange(R.ptsRange);
  if (document.activeElement !== $('#pts-min')) $('#pts-min').value = r.min;
  if (document.activeElement !== $('#pts-max')) $('#pts-max').value = r.max;
}
function rangeInput() {
  const lo = $('#pts-min').value, hi = $('#pts-max').value;
  const err = L.rangeError(lo, hi);
  $('#range-err').textContent = err;
  // A box that is not a whole number from 0 to 100 is marked; "lowest must be less" marks both.
  const badNum = (v) => L.rangeError(v, 100) !== '' && L.rangeError(0, v) !== '';
  const order = err && !badNum(lo) && !badNum(hi);
  for (const [el, v] of [[$('#pts-min'), lo], [$('#pts-max'), hi]]) {
    if (err && (order || badNum(v))) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
  }
  if (err) return;
  R.ptsRange = { min: Number(lo), max: Number(hi) }; save();
}
$('#pts-min').addEventListener('input', rangeInput);
$('#pts-max').addEventListener('input', rangeInput);
// Leaving a box with a bad value puts the saved range back, so the boxes never disagree with the ballot.
for (const id of ['#pts-min', '#pts-max']) $(id).addEventListener('change', () => { if ($('#range-err').textContent) return; renderRange(); });

// ---------- round files (.tab) ----------
async function saveRoundFile(strict) {
  save();
  let docs = [];
  try { docs = await docStore.list(R.id); }
  catch (err) { if (strict) throw err; toast('Docs could not be read, so the file holds the round without them.'); }
  download(L.roundFileName(R, stamp()), JSON.stringify(L.buildRoundFile(R, docs)), 'application/json');
}
$('#round-save').addEventListener('click', () => saveRoundFile(false));
// Round setup's "Open round file…" is a real button (it was a <label>, which Tab skips), so a keyboard judge can
// reach it and press it with Enter or Space. It opens the hidden file input's picker, as the start panel's link does.
$('#setup-open').addEventListener('click', () => $('#round-open').click());
$('#round-open').addEventListener('change', async (e) => {
  const file = e.target.files[0]; e.target.value = '';
  if (!file) return;
  let opened;
  try { opened = L.parseRoundFile(await file.text(), crypto.randomUUID ? crypto.randomUUID() : String(Date.now())); }
  catch (err) { toast('Could not open it: ' + (err.message || err)); return; }
  // A round with docs but no names yet still counts as work worth keeping.
  const oldDocs = await docStore.list(R.id).catch(() => []);
  if (!L.isRoundEmpty(R) || oldDocs.length) {
    const ok = await ask({
      title: 'Open ' + file.name + '?',
      body: 'It replaces the round on screen. Tabula downloads the current round first, so you keep a copy.',
      buttons: [{ label: 'Cancel', value: false, kind: 'plain' }, { label: 'Open round', value: true, kind: 'primary' }], cancelValue: false,
    });
    if (!ok) return;
    try { await saveRoundFile(true); }
    catch { toast('The current round could not be saved first, so nothing was changed.'); return; }
  }
  // 1. Store the new round's docs. If that fails, take them out again and change nothing.
  try { for (const d of opened.docs) await docStore.put(d); }
  catch {
    for (const d of opened.docs) await docStore.del(d.id).catch(() => {});
    toast('The docs in this file could not be stored in this browser, so nothing was changed.');
    return;
  }
  // 2. Only now stop the clocks, replace the round, then drop the old round's docs.
  stopAll(); resetting = true;
  CQ.clear(); await clipStore.clear().catch(() => {}); // the old round's waiting audio is deleted now
  const oldId = R.id;
  R = Object.assign(freshRound(), opened.round, { tab: 'flow', started: true, run: null, prepRun: null, programId: null }); // a saved file never brings a clock back, nor another judge's school
  fitPrepToFormat(); // the file's round keeps its own format (none = an old policy round; unknown ones were refused)
  save();
  docStore.clearRound(oldId).finally(() => location.reload());
});
// Clears the round and starts a new one in fmt (the same format when not given), then reloads the page.
function startNewRound(fmt) {
  resetting = true; stopAll();
  CQ.clear(); clipStore.clear().catch(() => {}); // the old round's waiting audio is deleted now
  const oldId = R.id;
  R = freshRound(R, fmt); save();
  docStore.clearRound(oldId).finally(() => location.reload());
}
const NEW_ROUND_BODY = 'This clears the flow, clocks, docs and any audio not yet transcribed. Saved ballots stay in History.';
$('#new-round').addEventListener('click', async () => {
  const ok = await ask({
    title: 'Start a new round?',
    body: NEW_ROUND_BODY,
    buttons: [{ label: 'Cancel', value: false, kind: 'plain' }, { label: 'Clear and start new', value: true, kind: 'danger' }], cancelValue: false,
  });
  if (!ok) return;
  startNewRound();
});
