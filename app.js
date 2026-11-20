// Tabula app: everything that runs in the page. Loaded as a module by index.html after logic.js, providers.js and tour.js.
// It lives in its own file so the Content-Security-Policy can forbid inline scripts.
// Tabula running on this computer (through the local helper), not on the website.
const LOCAL_ORIGIN = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
const L = window.PolicyLogic;
const K = window.TabulaKeys;
const IS_MAC = K.isMacPlatform(navigator.platform || navigator.userAgent);
const $ = (s) => document.querySelector(s);
const STORE = 'policyJudge.round.v1', LOG = 'policyJudge.log.v1', KEY = 'policyJudge.key';

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
    ? "This browser's storage for Tabula is full, so new changes are not saved. Delete old saved ballots in Ballots, or go to Round and use Save round file (.tab)."
    : 'This browser is not saving. A refresh will lose the clock and your flow. To keep a copy, go to Round and use Save round file (.tab).', { kind: 'error', key: 'storage' });
}

// The shared toast, dialog, Esc stack and announcer live in ui.js (spec Slice 0).
const { toast, dismissToast, announce, ask, askIsOpen, escLayer, modalDialog } = window.TabulaUI;

// ---------- shortcuts (keys.js registry; spec 4.1, 1.3, 1.5) ----------
// A dialog (the welcome is one), the tour or the node editor turns shortcuts off.
function modalOpen() { return askIsOpen() || !$('#node-editor').hidden || Boolean(tourState) || !$('#print-dialog').hidden || !$('#copy-sheet').hidden; }
document.addEventListener('keydown', (e) => {
  const ae = document.activeElement;
  const act = K.keyAction(
    { code: e.code, key: e.key, meta: e.metaKey, ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey, altGraph: Boolean(e.getModifierState && e.getModifierState('AltGraph')), repeat: e.repeat, composing: e.isComposing || e.keyCode === 229 },
    { place: PLACE_OF[R.tab] || 'setup', tab: R.tab, focus: K.focusKind(ae && { tagName: ae.tagName, type: ae.type, isContentEditable: ae.isContentEditable }), modal: modalOpen(), singleKeysOn: S.singleKeys !== false });
  if (act === 'clock') { e.preventDefault(); toggleClock(); }
  else if (act === 'speeches') { e.preventDefault(); toggleSpeechesPane(ae); }
  else if (act === 'print') { e.preventDefault(); openPrintDialog(); } // ⌘P on the Ballot: Tabula's print dialog (spec 4.10)
});

// Prep per team for a new round: the judge's last choice, else the NSDA 8 minutes.
function prepDefault() {
  const m = Number((store.get('policyJudge.settings.v1', {}) || {}).prepMin);
  return Number.isFinite(m) && m >= 0 && m <= 20 ? m * 60 : L.DEFAULT_PREP_SECONDS;
}
// prev: the round being replaced. Its points range carries over to the new round (spec 4.7); the first round ever uses 25–30.
function freshRound(prev) {
  return {
    ptsRange: prev && prev.ptsRange ? L.ptsRange(prev.ptsRange) : { ...L.DEFAULT_PTS_RANGE },
    tournament: '', roundName: '', judge: '', topic: '',
    aff: { team: '', d1: '', d2: '' }, neg: { team: '', d1: '', d2: '' },
    prepSeconds: prepDefault(),
    prepLeft: { aff: prepDefault(), neg: prepDefault() },
    flows: L.DEFAULT_FLOWS.map((name) => ({ name, cells: {} })),
    transcripts: {}, timeLeft: {}, aiFlows: [], aiFlowAt: 0, flowView: 'mine',
    ai: { paradigm: 'policymaker', notes: '', evidence: '', output: '' },
    ballot: { winner: '', pts: {}, ranks: {}, rfd: '', touched: {}, aiFilled: {} },
    id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())), cur: 0, flowIdx: 0, tab: 'flow',
    // The clocks (spec 1.1). run = the running speech { id, endAt, beeped, rec }; prepRun = { side, endAt }.
    // savedAt stamps the clock fields as one unit, so a second tab can tell which clock is newer.
    run: null, prepRun: null, savedAt: 0,
  };
}
let R = Object.assign(freshRound(), store.get(STORE, {}));
R.ptsRange = L.ptsRange(R.ptsRange); // a round saved before Slice 4 has none: 25–30
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
// The internal id 'log' stays (old backups and the tour use it); the nav says Ballots (spec 2.5, Q12).
const PLACES = [['flow', 'Flow'], ['setup', 'Round'], ['decide', 'Decide'], ['log', 'Ballots']];
// Decide has three tabs (spec 4.0): Live Eval, Analysis, Ballot. An old saved 'draft' tab opens the Ballot (L.decideTab).
const PLACE_OF = { setup: 'setup', timer: 'flow', flow: 'flow', eval: 'decide', analysis: 'decide', ballot: 'decide', log: 'log', ai: 'ai' };
function showTab(id) {
  if (id === 'decide') id = R.lastDecide || 'eval';
  if (id === 'timer') id = 'flow';
  id = L.decideTab(id);
  if (!PLACE_OF[id]) id = 'setup';
  const place = PLACE_OF[id];
  R.tab = id; if (place === 'decide') R.lastDecide = id; save();
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
  if (id === 'flow') { renderFlow(); renderInsights(); }
  if (id === 'eval') renderEval();
  if (id === 'analysis') renderAnalysis();
}
$('#nav').innerHTML = PLACES.map(([id, t]) => `<button data-tab="${id}">${t}</button>`).join('');
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
  // Insights (V9, Q8): the open pane, or a 32 px edge. With no AI it folds to one "Connect AI" link.
  const mode = insightsMode();
  ws.classList.toggle('ins-folded', mode !== 'open'); // not 'ins-edge': that is the strip's own class
  $('#insights').dataset.mode = mode;
  $('#ins-connect').hidden = mode !== 'edge-connect';
  $('#ins-show').hidden = mode !== 'edge-show';
  const btn = $('#speeches-btn');
  btn.hidden = !(overlay || S.hideLeft);
  btn.setAttribute('aria-expanded', String(overlay ? leftOpen : !S.hideLeft));
  btn.dataset.tip = K.speechesTip(IS_MAC, S.singleKeys !== false);
}
const insightsMode = () => L.insightsMode({ aiReady: aiReady(), hideRight: Boolean(S.hideRight) });
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
addEventListener('resize', () => { applyPanes(); renderRecStrip(); }); // cheap class toggles, so no frame wait (frames pause in hidden tabs)
// The pane mode changes at 1440 and 820 px; listen to those breakpoints too (some zoom and emulation changes fire no resize).
for (const q of ['(min-width: 1440px)', '(min-width: 820px)']) matchMedia(q).addEventListener('change', () => { applyPanes(); renderRecStrip(); });

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
  if (!L.BALLOT_FIELDS.includes(f)) return;
  const was = L.fieldState(R.ballot, f);
  R.ballot = L.markFields(R.ballot, [f], 'yours');
  R.ballotUndo = null; // "Undo the last insert" lasts until the next edit (spec 4.5)
  if (R.ballotReview) R.ballotReview = L.staleReviewCards(R.ballotReview, R.ballot);
  if (was !== 'yours' || R.ballotReview) renderBallotTags();
}

$('#prep-min').value = Math.round(R.prepSeconds / 60);
$('#prep-min').addEventListener('change', (e) => {
  const m = Math.max(0, Math.min(20, Number(e.target.value) || 0));
  const used = R.prepRun || R.prepLeft.aff < R.prepSeconds || R.prepLeft.neg < R.prepSeconds;
  stopPrep();
  const before = { prepSeconds: R.prepSeconds, prepLeft: { ...R.prepLeft }, prepMin: S.prepMin };
  setPrep(m * 60, { aff: m * 60, neg: m * 60 }, m);
  // Prep already in use: the change is made, and Undo gives each team its time back (spec 2.4 #1).
  if (used) undoToast('Prep set to ' + m + ' min for each team.', 'prep time change', () => setPrep(before.prepSeconds, before.prepLeft, before.prepMin), 'Prep time restored.');
});
function setPrep(seconds, left, min) {
  stopPrep(); R.prepSeconds = seconds; R.prepLeft = left; saveClocks(); renderPrep();
  $('#prep-min').value = Math.round(seconds / 60);
  S.prepMin = min; saveSettings(); renderPrepPresets();
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
  R = Object.assign(freshRound(), opened.round, { tab: 'flow', started: true, run: null, prepRun: null }); // a saved file never brings a clock back
  save();
  docStore.clearRound(oldId).finally(() => location.reload());
});
$('#new-round').addEventListener('click', async () => {
  const ok = await ask({
    title: 'Start a new round?',
    body: 'This clears the flow, clocks, docs and any audio not yet transcribed. Saved ballots stay in Ballots.',
    buttons: [{ label: 'Cancel', value: false, kind: 'plain' }, { label: 'Clear and start new', value: true, kind: 'danger' }], cancelValue: false,
  });
  if (!ok) return;
  resetting = true; stopAll();
  CQ.clear(); clipStore.clear().catch(() => {}); // the old round's waiting audio is deleted now
  const oldId = R.id;
  R = freshRound(R); save();
  docStore.clearRound(oldId).finally(() => location.reload());
});

// ---------- speech timer ----------
// R.cur is the speech on screen (the viewed one). R.run is the speech the clock times (spec 1.2).
// R.run is saved with the round, and time comes from the wall clock, so the clock survives a reload,
// a crash or a sleeping device (spec 1.1). Pause writes R.timeLeft.
const sp = () => L.SPEECHES[R.cur];
const speechIdx = (id) => L.SPEECHES.findIndex((s) => s.id === id);
const runSp = () => (R.run && L.SPEECHES[speechIdx(R.run.id)]) || sp();
const fullTime = (s) => s.minutes * 60;
const leftFor = (s) => (R.timeLeft[s.id] ?? fullTime(s));
let tick = null;
// The clock fields are written as one unit with one time stamp (a second tab takes the newer unit).
function saveClocks() { R.savedAt = Date.now(); save(); }
function startTick() { clearInterval(tick); tick = setInterval(renderClock, 200); }
function stopTick() { clearInterval(tick); tick = null; }

function renderSpeeches() {
  const runId = R.run && R.run.id;
  markFlowColumns();
  $('#speech-list').innerHTML = L.SPEECHES.map((s, i) => {
    const isRun = s.id === runId;
    const done = R.timeLeft[s.id] != null && R.timeLeft[s.id] < fullTime(s);
    const hasTr = (R.transcripts[s.id] || '').trim() ? ' · has transcript' : '';
    const short = L.shortSpeech(s.id);
    const info = isRun ? '<small class="sp-run">Running</small>' : '<small>' + (done ? L.formatClock(Math.ceil(leftFor(s))) + ' left' : s.minutes + ' min') + '</small>';
    return `<button class="sp ${s.side} ${i === R.cur ? 'on' : ''}${isRun ? ' run' : ''}" data-i="${i}" data-tip="${s.label} · ${s.side === 'aff' ? 'Aff' : 'Neg'}${hasTr}"${isRun ? ` aria-label="${s.label}, running"` : ''}${i === R.cur ? ' aria-current="true"' : ''}>${short}${hasTr ? '<i class="sp-dot" aria-label="has transcript"></i>' : ''}${info}</button>`;
  }).join('');
}
function renderClock() {
  const s = runSp();
  const left = R.run ? (R.run.endAt - Date.now()) / 1000 : leftFor(s);
  // A running clock stops by itself at -9:59 (the same rule as after a reload).
  if (R.run && left <= L.OVER_LIMIT) {
    const id = R.run.id;
    pauseSpeech();
    toast('The ' + L.shortSpeech(id) + ' clock went 10 minutes over. It is paused at -9:59.', { kind: 'error', key: 'over-limit' });
    return;
  }
  const shown = Math.ceil(left);
  const c = $('#clock');
  c.textContent = L.formatClock(shown);
  c.classList.toggle('low', shown <= 30 && shown > 0);
  c.classList.toggle('over', shown <= 0);
  $('#cur-label').innerHTML = `<span class="${s.side}">${s.label}</span> <span class="muted">${s.speaker} · ${s.minutes} min</span>`;
  $('#t-start').textContent = R.run ? 'Pause' : (leftFor(s) < fullTime(s) ? 'Resume' : 'Start');
  $('#mini-speech').textContent = `${s.label} ${L.formatClock(shown)}`;
  // The 0:00 beep plays once; more than 5 s late (after sleep or a reload) it is skipped.
  if (R.run) {
    const b = L.beepDecision(left, R.run.beeped);
    if (b) {
      // Another tab on this round may have beeped first: it saved beeped with the same run.
      const first = b === 'beep' && !L.beepedElsewhere(store.get(STORE, null), R.run);
      R.run.beeped = true; save(); if (first) beepOnce(R.run);
    }
  }
  renderViewChip();
}
// "Viewing 1NC · 2AC running" with [Back to 2AC] while the judge looks at another speech.
function renderViewChip() {
  const lab = L.viewingLabel(sp().id, R.run && R.run.id);
  const chip = $('#view-chip');
  chip.hidden = !lab;
  if (!lab) { chip.dataset.sr = ''; return; }
  if (chip.dataset.sr === lab.sr) return;
  chip.dataset.sr = lab.sr;
  $('#view-text').textContent = lab.text; $('#view-back').textContent = lab.back;
  announce(lab.sr);
}
// A tile click only changes the view. While a clock runs, it keeps running (and recording) for R.run.id.
function selectSpeech(i) {
  R.cur = i; save();
  renderSpeeches(); renderClock(); renderTranscript();
}
function backToRunning() { if (R.run) selectSpeech(speechIdx(R.run.id)); }
function startSpeech() {
  stopPrep();
  if (!R.started) { R.started = true; save(); renderStart(); }
  const s = sp();
  const left = leftFor(s);
  R.run = { id: s.id, endAt: Date.now() + left * 1000, startLeft: left, beeped: left <= 0, rec: false };
  recStoppedByReload = false;
  saveClocks(); startTick(); renderClock(); renderSpeeches();
  if ($('#rec-on').checked) wantRec();
  renderRecStrip();
}
function pauseSpeech() {
  if (!R.run) return;
  const s = runSp();
  R.timeLeft[s.id] = Math.max(L.OVER_LIMIT, (R.run.endAt - Date.now()) / 1000);
  R.run = null; stopTick();
  R.cur = speechIdx(s.id); // Q-5: pausing while viewing returns the view to the running speech
  saveClocks();
  const wasBrowserRec = recWanted && activeEngine === 'browser';
  recStoppedByReload = false;
  stopRec(); renderClock(); renderSpeeches(); renderTranscript(); renderRecStrip();
  if (wasBrowserRec) scheduleFlow(s.id, true);
  maybeD2Note();
}
function toggleClock() { if (R.run) pauseSpeech(); else startSpeech(); }
$('#speech-list').addEventListener('click', (e) => { const b = e.target.closest('.sp'); if (b) selectSpeech(Number(b.dataset.i)); });
$('#view-back').addEventListener('click', backToRunning);
$('#t-start').addEventListener('click', toggleClock);
// Reset and Next speech act on the running speech if one runs (pausing first returns the view to it); else on the viewed speech.
$('#t-reset').addEventListener('click', () => { pauseSpeech(); delete R.timeLeft[sp().id]; saveClocks(); renderClock(); renderSpeeches(); });
$('#t-next').addEventListener('click', () => { pauseSpeech(); selectSpeech(Math.min(L.SPEECHES.length - 1, R.cur + 1)); });
// The device slept or the tab was hidden: the wall clock moved on, so redraw at once.
document.addEventListener('visibilitychange', () => { if (!document.hidden) { renderClock(); renderPrep(); } });

// Two tabs on one round both reach 0:00 within one tick, and a localStorage write reaches the other tab a little
// late. A Web Lock is shared by all tabs at once: the first tab takes it and beeps; the lock is held for 10 s, so the
// other tab finds it taken and stays quiet (after 5 s beepDecision skips the beep anyway).
function beepOnce(run) {
  if (!navigator.locks) return beep();
  navigator.locks.request('tabula-beep-' + run.id + '-' + run.endAt, { ifAvailable: true }, (lock) => {
    if (!lock) return;
    beep();
    return new Promise((r) => setTimeout(r, 10000));
  }).catch(beep);
}
let audioCtx;
function beep() {
  try {
    audioCtx ??= new AudioContext();
    [0, 0.35, 0.7].forEach((t) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(audioCtx.destination);
      g.gain.setValueAtTime(0.2, audioCtx.currentTime + t);
      o.start(audioCtx.currentTime + t); o.stop(audioCtx.currentTime + t + 0.2);
    });
  } catch {}
}

// ---------- prep ----------
// R.prepRun = { side, endAt } is saved with the round, like the speech clock (spec 1.1b).
let prepTick = null;
function startPrepTick() { clearInterval(prepTick); prepTick = setInterval(renderPrep, 200); }
function renderPrep() {
  for (const side of ['aff', 'neg']) {
    const pr = R.prepRun;
    const mine = pr && pr.side === side;
    const left = mine ? (pr.endAt - Date.now()) / 1000 : R.prepLeft[side];
    const el = $('#prep-' + side);
    el.textContent = L.formatClock(Math.max(0, Math.ceil(left)));
    tone(el, left <= 0 ? 'error' : '');
    document.querySelector(`[data-prep="${side}"]`).textContent = mine ? 'Stop' : 'Start';
    if (mine && left <= 0) { stopPrep(); beep(); }
  }
}
function stopPrep() {
  if (!R.prepRun) return;
  R.prepLeft[R.prepRun.side] = Math.max(0, (R.prepRun.endAt - Date.now()) / 1000);
  clearInterval(prepTick); prepTick = null; R.prepRun = null; saveClocks(); renderPrep();
}
document.querySelectorAll('[data-prep]').forEach((b) => b.addEventListener('click', () => {
  const side = b.dataset.prep;
  if (R.prepRun && R.prepRun.side === side) return stopPrep();
  stopPrep(); pauseSpeech();
  if (R.prepLeft[side] <= 0) return toast(side.toUpperCase() + ' has no prep left');
  R.prepRun = { side, endAt: Date.now() + R.prepLeft[side] * 1000 };
  saveClocks(); startPrepTick(); renderPrep();
}));
function stopAll() { pauseSpeech(); stopPrep(); }

// ---------- the clocks after a reload, a crash or sleep (spec 1.1) ----------
// Nothing pauses on unload any more: the saved endAt is the truth, and the clock keeps "running" while closed.
function restoreClocksOnLoad() {
  const had = Boolean(R.run || R.prepRun), hadRec = Boolean(R.run && R.run.rec);
  const runSpeech = R.run && L.SPEECHES.find((x) => x.id === R.run.id);
  const { speech: rs, prep: rp } = L.restoreClocks(R.run, R.prepRun, Date.now(), R.prepSeconds, runSpeech ? fullTime(runSpeech) : undefined);
  const name = rs.id ? L.shortSpeech(rs.id) : '';
  if (rs.state === 'running') {
    R.run = Object.assign({}, R.run, { endAt: rs.endAt }, rs.reason === 'clock-moved' ? { startLeft: rs.left } : {});
    startTick();
    if (rs.reason === 'clock-moved') toast('The device clock changed. The ' + name + ' clock is set back to its full time. Check it before you continue.', { kind: 'error', key: 'clock' });
    else toast('The ' + name + ' clock kept running while the page reloaded.', { key: 'clock' });
    // The mic does not restart by itself (browsers need a click first); the strip offers "Resume recording".
    if (hadRec) recStoppedByReload = true;
  } else {
    if (rs.state === 'paused') {
      R.timeLeft[rs.id] = rs.left;
      if (rs.reason === 'over-limit') toast('The ' + name + ' clock ran more than 10 minutes over while Tabula was closed. It is paused at -9:59.', { kind: 'error', key: 'clock' });
    }
    R.run = null;
  }
  if (rp.state === 'running') { R.prepRun = { side: rp.side, endAt: rp.endAt }; startPrepTick(); }
  else {
    if (rp.state === 'paused') { R.prepLeft[rp.side] = 0; toast((rp.side === 'aff' ? 'Aff' : 'Neg') + ' prep ran out while the page reloaded.'); }
    R.prepRun = null;
  }
  if (had) saveClocks();
}
// A second tab on the same round: the clock unit with the newer savedAt wins, so only one clock runs.
// Flow text is not merged (the newest write wins).
let otherTabWarned = false;
addEventListener('storage', (e) => {
  if (e.key !== STORE || !e.newValue) return;
  let inc; try { inc = JSON.parse(e.newValue); } catch { return; }
  if (!inc || inc.id !== R.id || !L.clockUnitIsNewer(R, inc)) return;
  R.run = inc.run || null; R.prepRun = inc.prepRun || null;
  R.timeLeft = inc.timeLeft || {}; R.prepLeft = inc.prepLeft || R.prepLeft; R.savedAt = inc.savedAt;
  if (R.run) startTick(); else stopTick();
  if (R.prepRun) startPrepTick(); else { clearInterval(prepTick); prepTick = null; }
  // This tab's mic belonged to a clock that no longer runs here.
  if (recWanted && (!R.run || R.run.id !== recSpeechId)) stopRec();
  renderClock(); renderPrep(); renderSpeeches(); renderRecStrip();
  if (!otherTabWarned) {
    otherTabWarned = true;
    const noKey = !S.rememberKeys && !Object.keys(keys).length ? ' This tab has no AI key. Paste it here too, or turn on Remember this key in Settings.' : '';
    toast('Tabula is open in another tab. Use one tab per round. The newest change wins.' + noKey, { key: 'other-tab' });
  }
});

// ---------- settings (kept across rounds) ----------
const SETTINGS = 'policyJudge.settings.v1', OAKEY = 'policyJudge.openaiKey';
const S = Object.assign({ engine: 'openai', chunkSec: 8 }, store.get(SETTINGS, {}));
delete S.model; // an old, unused transcription default
const saveSettings = () => (restoring ? false : store.set(SETTINGS, S));
// No paid AI call runs by itself (spec 2.7, D2): only an explicit true turns on Live Eval or Live AI flow.
// Q-2: the old defaults turned both on without a choice, so they are turned off once for everyone (a one-time note says so).
(() => { const reset = L.d2Reset(S); if (reset) { Object.assign(S, reset); saveSettings(); } })();
S.liveFlow = L.liveFlowDefault(S.liveFlow);
S.autoEval = L.autoEvalDefault(S.autoEval);

// ---------- transcription ----------
// Two engines:
//  - 'openai': the mic is recorded in short clips; each clip goes to OpenAI's
//    transcription API. Better accuracy, about one clip behind live.
//  - 'browser': the browser's own speech-to-text (free, weaker).
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null, recWanted = false, recSpeechId = null;
let recGen = 0, resetting = false;
let mic = null, clipRec = null, clipTimer = null;
// The "Recording" strip (spec 1.6): recLive = the mic (or browser speech service) has really started;
// recStoppedByReload = the clock came back running after a reload, but the mic did not (browsers need a click).
let recLive = false, recStoppedByReload = false, recNoticeOpen = false;

// A big, plain status line under the clock, so a judge always knows if audio is being captured.
let recProblem = '', lastTextAt = 0;
function setRecStatus() {
  const el = $('#rec-status');
  if (!el) return;
  if (recProblem) { tone(el, 'error'); el.textContent = 'Not transcribing: ' + recProblem; return; }
  // Clips waiting for a better connection: say so plainly, and that the audio stays on this device.
  const q = CQ.state();
  if (q.held) { tone(el, 'error'); el.textContent = 'Paused: ' + q.held.replace(/\.+$/, '') + '. ' + (q.backlog ? clipMinutes(q) + ' of audio is kept on this device until it is fixed.' : ''); return; }
  if (q.degraded) { tone(el, 'caution'); el.textContent = 'Connection trouble: recording safely. ' + clipMinutes(q) + ' of audio waiting, kept on this device only' + (q.retryInMs ? '. Trying again in ' + Math.ceil(q.retryInMs / 1000) + ' s.' : '.'); return; }
  if (q.catchingUp) { tone(el, 'caution'); el.textContent = 'Catching up: ' + clipMinutes(q) + ' of audio waiting, kept on this device only.'; return; }
  if (!recWanted && q.backlog) { tone(el, 'quiet'); el.textContent = 'Finishing the transcript: ' + clipMinutes(q) + ' of audio waiting, kept on this device only.'; return; }
  if (!$('#rec-on').checked) { tone(el, 'quiet'); el.textContent = 'Transcribe is off. Tick the box to record.'; return; }
  if (!recWanted) { tone(el, 'quiet'); el.textContent = 'Ready. Recording starts when the speech clock starts.'; return; }
  const ago = lastTextAt ? Math.round((Date.now() - lastTextAt) / 1000) : null;
  const engine = activeEngine === 'browser' ? 'browser' : P.PROVIDERS[activeEngine].short;
  const stall = L.stallWarning({ startedAt: recStartedAt, lastTextAt, now: Date.now(), mode: S.audioMode });
  if (stall) { tone(el, 'caution'); el.textContent = 'Recording (' + engine + '). ' + stall; return; }
  tone(el, 'ok');
  el.textContent = 'Recording (' + engine + ')' + (ago != null ? ' · last text ' + ago + ' s ago' : ' · waiting for first text…');
}
setInterval(() => { setRecStatus(); renderRecStrip(); }, 1000);
// Remember the Transcribe box across refreshes (it was resetting to off).
$('#rec-on').checked = S.recOn !== false;
$('#rec-on').addEventListener('change', (e) => {
  S.recOn = e.target.checked; saveSettings(); recProblem = ''; setRecStatus();
  // Ticking it while the clock runs starts recording right away; unticking stops it.
  if (R.run && e.target.checked && !recWanted) wantRec();
  if (!e.target.checked && recWanted) userStopRec();
  renderRecStrip();
});

// ---------- recording notice and "Recording" strip (spec 1.6, Q19) ----------
const MIC_BLOCKED = "The microphone is blocked. Allow it in your browser's site settings, then tick Transcribe again.";
const OFFLINE_SR = 'You are offline. Your browser\'s speech service needs the internet, so words spoken now do not become text. The clock and flow still work.';
// Recording would start now. The first time on this device, a plain notice asks first. The clock is
// already running; only the mic waits for the choice.
async function wantRec() {
  if (L.needsRecNotice(S)) {
    if (recNoticeOpen) return;
    recNoticeOpen = true;
    const v = await ask({
      title: 'Before Tabula records',
      body: [
        "When the speech clock runs, Tabula records from this device's microphone. It turns the speech into text for your flow.",
        'Audio stays on this device until its text comes back. Then Tabula deletes it.',
        "To make the text, the audio goes to the speech service you chose in Settings. With the free option, that is your browser's own service.",
        "Tell the debaters before you record. Follow your tournament's rules.",
      ],
      foot: 'You can change this later in Settings, under Audio.',
      buttons: [{ label: "Don't record", value: 'no', kind: 'plain' }, { label: 'Record', value: 'yes', kind: 'primary' }],
      cancelValue: 'no',
      focus: 'yes', // Q-6: the owner chose "Record" for first focus
    });
    recNoticeOpen = false;
    if (v !== 'yes') {
      $('#rec-on').checked = false; S.recOn = false; saveSettings(); setRecStatus(); renderRecStrip();
      toast('Recording is off. Tick Transcribe in the round bar to record.');
      return;
    }
    S.recConsentAt = Date.now(); saveSettings(); renderRecNotice();
    if (!R.run || !$('#rec-on').checked || recWanted) return; // the clock was paused while the notice was open
  }
  startRec();
}
// The judge stopped recording (strip button or Transcribe unticked). The clock keeps going.
function userStopRec() {
  stopRec();
  if (R.run) { R.run.rec = false; save(); }
  setRecStatus(); renderRecStrip();
}
function renderRecStrip() {
  const strip = $('#rec-strip'); if (!strip) return;
  const st = L.recStripState({ recWanted, live: recLive, stoppedByReload: recStoppedByReload && Boolean(R.run), speechId: recWanted ? recSpeechId : (R.run && R.run.id), online: navigator.onLine, engine: activeEngine, narrow: innerWidth < 820 });
  if (strip.hidden !== Boolean(st.hidden)) { strip.hidden = Boolean(st.hidden); measureHeader(); }
  if (st.hidden) return;
  const text = $('#rec-strip-text');
  const want = (st.dot ? '● ' : '') + st.text;
  if (text.dataset.v !== want) {
    text.dataset.v = want; text.textContent = '';
    if (st.dot) { const d = document.createElement('span'); d.setAttribute('aria-hidden', 'true'); d.textContent = '● '; text.append(d); }
    text.append(st.text);
  }
  const b = $('#rec-strip-btn'); b.textContent = st.buttonLabel; b.dataset.act = st.button;
}
$('#rec-strip-btn').addEventListener('click', (e) => {
  if (e.currentTarget.dataset.act === 'resume') {
    recStoppedByReload = false;
    $('#rec-on').checked = true; S.recOn = true; saveSettings();
    if (R.run) wantRec();
    renderRecStrip();
    return;
  }
  $('#rec-on').checked = false; S.recOn = false; saveSettings();
  userStopRec();
});
// Offline: the strip says what happens to the words. The free browser service loses them, so say so once.
addEventListener('offline', () => { renderRecStrip(); if (recWanted && activeEngine === 'browser') toast(OFFLINE_SR, { kind: 'error', key: 'offline-sr' }); });
addEventListener('online', () => renderRecStrip());
function renderRecNotice() {
  const el = $('#rec-notice-status'); if (!el) return;
  el.textContent = S.recConsentAt ? 'You chose Record on this device. The notice will not show again.' : 'The notice shows before the next recording.';
}
$('#rec-notice-reset').addEventListener('click', () => { delete S.recConsentAt; saveSettings(); renderRecNotice(); toast('The recording notice will show before the next recording.'); });
// The mic went live: say so to screen readers, and remember it with the running clock (for the reload notice).
function markRecLive() {
  if (recLive || !recWanted) return;
  recLive = true;
  if (R.run && R.run.id === recSpeechId) { R.run.rec = true; save(); }
  announce('Recording started for ' + L.shortSpeech(recSpeechId) + '.');
  renderRecStrip();
}

// The (?) note next to the transcript title: how transcription works right now, in short lines.
// extra = a transcription problem to show (AI flow problems are shown with the AI flow, not here).
function setRecNote(extra) {
  const eng = S.trEngine;
  const lines = [];
  if (eng !== 'browser' && P.PROVIDERS[eng]) {
    lines.push('<b>Transcription: ' + escapeHtml(P.PROVIDERS[eng].short) + '</b>, a new clip every ' + S.chunkSec + ' s.');
    lines.push('Audio stays on this device only until its text is back.');
  } else if (SR) {
    lines.push('<b>Transcription: free browser kind.</b>');
    lines.push("The browser sends the audio to its own speech service. It misses words in fast speech.");
    lines.push('For better text, connect a key that can transcribe in Settings.');
  } else {
    lines.push('<b>No transcription in this browser.</b> Connect a key that can transcribe in Settings.');
  }
  lines.push('Live AI flow: ' + (S.liveFlow ? 'on' : 'off') + '.');
  if (extra) lines.push('<span class="tip-problem">' + escapeHtml(extra) + '</span>');
  $('#rec-note').innerHTML = lines.map((l) => '<span class="tip-line">' + l + '</span>').join('');
  // A transcription problem puts a small dot on the drawer's (?) and on the round-bar Transcript button (V8).
  // The words are in the bubble and in the round-bar status line; screen readers hear them on the button too.
  document.querySelector('.tr-drawer-head .tip').classList.toggle('warn', Boolean(extra));
  $('#tr-toggle').classList.toggle('warn', Boolean(extra));
  $('#tr-problem-sr').textContent = extra ? ' (transcription problem)' : '';
}

let activeEngine = 'browser', recStartedAt = 0;
function startRec() {
  if (testing) testAbort = true; // a speech starting ends the mic test
  recWanted = true; recSpeechId = runSp().id; recGen++; recProblem = ''; recStartedAt = Date.now(); recLive = false; recStoppedByReload = false;
  activeEngine = S.trEngine || 'browser';
  // The chosen engine has no key (for example after a refresh)? Use the free browser engine instead of failing silently.
  if (activeEngine !== 'browser' && !keys[activeEngine]) {
    if (SR) { toast('No ' + P.PROVIDERS[activeEngine].short + ' key, so using the free browser transcription.'); activeEngine = 'browser'; }
    else { recWanted = false; recProblem = 'the ' + P.PROVIDERS[activeEngine].short + ' key is not connected in this tab. Connect it in Settings.'; renderRecBadge(); setRecStatus(); return; }
  }
  if (activeEngine !== 'browser') startOpenAIRec(); else startBrowserRec();
  if (activeEngine === 'browser' && !navigator.onLine) toast(OFFLINE_SR, { kind: 'error', key: 'offline-sr' });
  renderRecBadge(); setRecStatus(); renderRecStrip();
}
function stopRec() {
  if (recWanted || recLive) announce('Recording stopped.');
  recWanted = false; recLive = false;
  if (rec) { try { rec.stop(); } catch {} rec = null; }
  clearTimeout(clipTimer);
  if (clipRec && clipRec.state !== 'inactive') clipRec.stop();
  clipRec = null;
  stopStream();
  if (mic) { mic.getTracks().forEach((t) => t.stop()); mic = null; }
  meterShow(false);
  renderRecBadge(); renderRecStrip();
}
// ---------- live level meter (round bar) ----------
let meterAt = 0;
function meterShow(on) { const m = document.getElementById('rb-meter'); if (m) m.hidden = !on; }
function meterFeed(samples) {
  const now = performance.now();
  if (now - meterAt < 100) return; // about 10 updates a second
  meterAt = now;
  const info = L.levelInfo(L.rms(samples));
  const m = document.getElementById('rb-meter'); if (!m) return;
  m.hidden = false;
  m.firstElementChild.style.width = info.pct + '%';
  m.dataset.level = info.level;
  m.dataset.tip = 'Mic level: ' + info.label;
  m.setAttribute('aria-label', 'Mic level: ' + info.label);
}
function renderRecBadge() {
  const q = CQ.state();
  const queue = !q.backlog ? '' : q.held ? '· paused ' : q.degraded ? '· connection trouble, ' + clipMinutes(q) + ' queued ' : '· transcribing… ';
  $('#mini-rec').textContent = queue.replace(/^· /, '') + (flowBusy ? (queue ? '· ' : '') + 'AI flowing…' : ''); // the "Recording" strip shows the mic
  // Paused clips (for example no key) can be thrown away by the judge.
  const btn = document.getElementById('discard-audio'); if (btn) btn.hidden = !(q.held && q.backlog);
}

function startBrowserRec() {
  if (!SR) { toast('No browser speech-to-text here'); return; }
  rec = new SR(); rec.continuous = true; rec.interimResults = true; rec.lang = 'en-US';
  rec.onresult = (ev) => {
    let base = R.transcripts[recSpeechId] || '';
    let interim = '';
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const r = ev.results[i];
      if (r.isFinal) base = L.appendChunk(base, r[0].transcript);
      else interim += r[0].transcript;
    }
    R.transcripts[recSpeechId] = base; save(); lastTextAt = Date.now();
    if (sp().id === recSpeechId) setTranscriptView(base + (interim ? ' ' + interim : ''));
    scheduleFlow(recSpeechId, false);
  };
  rec.onstart = () => markRecLive();
  rec.onerror = (ev) => {
    if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') { recWanted = false; recLive = false; recProblem = 'the microphone is blocked. Click the mic icon in the address bar and allow it.'; setRecStatus(); renderRecStrip(); toast(MIC_BLOCKED, { kind: 'error', key: 'mic' }); }
    else if (ev.error === 'network') { recProblem = 'browser transcription needs internet.'; setRecStatus(); }
  };
  rec.onend = () => { if (recWanted) { try { rec.start(); } catch {} } else renderRecBadge(); };
  try { rec.start(); } catch {}
}

// Opens the chosen microphone with the filters that fit the room (see Settings → Audio).
// If the chosen mic is unplugged, it falls back to the default mic and says so.
async function openMic() {
  try { return await navigator.mediaDevices.getUserMedia(L.micConstraints(S.audioMode, S.micId)); }
  catch (err) {
    if (S.micId && (err.name === 'OverconstrainedError' || err.name === 'NotFoundError')) {
      toast('The chosen microphone was not found, so the default microphone is used.');
      S.micId = ''; saveSettings(); // forget it, so this does not repeat every speech
      return navigator.mediaDevices.getUserMedia(L.micConstraints(S.audioMode, ''));
    }
    throw err;
  }
}
async function startOpenAIRec() {
  const gen = recGen;
  let got;
  try {
    got = mic || await openMic();
  } catch (err) {
    recWanted = false; recLive = false; renderRecBadge();
    recProblem = 'the microphone is blocked or busy (' + (err && err.name || 'error') + '). Click the mic icon in the address bar and allow it.';
    setRecStatus(); renderRecStrip();
    if (err && (err.name === 'NotAllowedError' || err.name === 'SecurityError')) toast(MIC_BLOCKED, { kind: 'error', key: 'mic' });
    return;
  }
  // The judge may have paused (or paused and restarted) while the mic was opening.
  // A mic opened for a cancelled start is closed, so it never stays live.
  if (gen !== recGen || !recWanted) { if (got !== mic) got.getTracks().forEach((t) => t.stop()); return; }
  if (mic && mic !== got) mic.getTracks().forEach((t) => t.stop());
  mic = got;
  markRecLive();
  const track = mic.getAudioTracks()[0];
  if (track) track.onended = () => { meterShow(false); if (recWanted) { recProblem = 'the microphone was disconnected. Pause and start the clock again.'; setRecStatus(); } };
  if (window.AudioWorkletNode) {
    try { await startStream(recSpeechId, gen); return; }
    catch (err) { console.warn('Gap-free recording failed, using clips instead:', err); }
  }
  recordClip(recSpeechId);
}

// ---------- gap-free recording ----------
// One unbroken audio stream. Every few seconds we cut a WAV clip from it.
// Each clip starts with the last second of the one before, so no word falls in a gap;
// the repeated words are removed again with mergeOverlap.
const OVERLAP_SEC = 1, SILENCE_RMS = 0.0015;
// The audio tap is tap.js (a file, so the page's security rule allows it).
let stream = null;
async function startStream(speechId, gen) {
  let ctx, src;
  try { ctx = new AudioContext({ sampleRate: 16000 }); src = ctx.createMediaStreamSource(mic); }
  catch { if (ctx) ctx.close().catch(() => {}); ctx = new AudioContext(); src = ctx.createMediaStreamSource(mic); }
  const sess = { speechId, ctx, src, node: null, sr: ctx.sampleRate, pending: [], pendingLen: 0, fresh: 0, first: true, got: 0 };
  try {
    await ctx.audioWorklet.addModule('tap.js');
    if (gen !== recGen || !recWanted) { ctx.close().catch(() => {}); return; }
    const node = new AudioWorkletNode(ctx, 'tap');
    sess.node = node;
    node.port.onmessage = (e) => {
      if (stream !== sess) return;
      sess.got += e.data.length;
      meterFeed(e.data);
      sess.pending.push(e.data); sess.pendingLen += e.data.length; sess.fresh += e.data.length;
      if (sess.fresh >= S.chunkSec * sess.sr) cutClip(sess, false);
    };
    src.connect(node);
    node.connect(ctx.destination); // the node outputs silence; this just keeps the audio graph running
    stream = sess; // set before any await, so a pause right now still closes it
    if (ctx.state !== 'running') await ctx.resume().catch(() => {});
    if (stream !== sess) return; // paused while resuming; stopStream already closed it
    if (ctx.state !== 'running') throw new Error('audio engine did not start (' + ctx.state + ')');
  } catch (err) {
    if (stream === sess) stream = null;
    ctx.close().catch(() => {});
    throw err;
  }
  // Watchdog: if no audio arrives in 3 s, drop this stream and record in clips instead.
  setTimeout(() => {
    if (stream !== sess || sess.got > 0 || !recWanted) return;
    stream = null;
    try { sess.src.disconnect(); sess.node.disconnect(); } catch {}
    ctx.close().catch(() => {});
    console.warn('No audio from the stream, falling back to clips');
    recordClip(speechId);
  }, 3000);
}
function cutClip(sess, isFinal) {
  const all = new Float32Array(sess.pendingLen);
  let p = 0;
  for (const x of sess.pending) { all.set(x, p); p += x.length; }
  const newSamples = sess.fresh;
  sess.fresh = 0;
  const keep = Math.min(all.length, Math.round(OVERLAP_SEC * sess.sr));
  const tail = all.slice(all.length - keep);
  sess.pending = [tail]; sess.pendingLen = tail.length;
  const overlap = !sess.first;
  sess.first = false;
  // Skip clips that are almost all overlap or silence (the model invents words in silence).
  if ((!isFinal && newSamples < 0.3 * sess.sr) || newSamples === 0 || L.rms(all) < SILENCE_RMS) { if (isFinal) scheduleFlow(sess.speechId, true); return; }
  queueClip(new Blob([L.encodeWav(all, sess.sr)], { type: 'audio/wav' }), sess.speechId, isFinal, overlap, all.length / sess.sr);
}
function stopStream() {
  const sess = stream;
  if (!sess) return;
  stream = null;
  cutClip(sess, true);
  try { if (sess.node) { sess.node.port.onmessage = null; sess.node.disconnect(); } sess.src.disconnect(); } catch {}
  sess.ctx.close().catch(() => {});
}

// Each clip is a full recording (stop + restart), so OpenAI gets a valid audio file every time.
function recordClip(speechId) {
  const parts = [], startedAt = Date.now();
  const r = new MediaRecorder(mic);
  r.ondataavailable = (e) => { if (e.data && e.data.size) parts.push(e.data); };
  r.onstop = () => {
    const isFinal = !recWanted || recSpeechId !== speechId;
    const blob = new Blob(parts, { type: r.mimeType || 'audio/webm' });
    if (blob.size > 3000) queueClip(blob, speechId, isFinal, false, (Date.now() - startedAt) / 1000);
    else if (isFinal) scheduleFlow(speechId, true);
    if (!recWanted && mic) { mic.getTracks().forEach((t) => t.stop()); mic = null; }
  };
  r.start();
  clipRec = r;
  clipTimer = setTimeout(() => {
    if (!recWanted || clipRec !== r) return;
    r.stop();
    recordClip(speechId);
  }, S.chunkSec * 1000);
}

// ---------- the clip queue (see clipqueue.js) ----------
// Each clip is saved on this device (IndexedDB) before it is sent, and deleted as soon as its text is back.
// A bad connection never loses a clip: clips wait, are retried with growing pauses, and the texts are
// applied strictly in order when the connection returns. Audio never goes into a backup or a .tab file.
let trError = false, clipCounter = 0;
const clipMinutes = (q) => { const m = q.queuedSec / 60; return m < 1 ? Math.max(1, Math.round(q.queuedSec)) + ' s' : (Math.round(m * 10) / 10) + ' min'; };
let storeWarned = false;
const CQ = window.ClipQueue.createClipQueue({
  store: { put: (rec) => clipStore.put(rec), del: (id) => clipStore.del(id).catch(() => {}) },
  onStoreError() {
    if (storeWarned) return; storeWarned = true;
    toast('Audio could not be saved on this device. Transcription goes on, but a reload now could lose waiting clips.');
  },
  // The transcript so far is read when a clip is sent. While several clips go at once (catching up), the later
  // ones see a little less context; their order is still right, because texts are applied in order.
  send: (rec, timeoutMs) => transcribeClip(rec.blob, R.transcripts[rec.speechId] || '', timeoutMs, rec.engine),
  apply(rec, text) {
    if (resetting || rec.roundId !== R.id) return;
    // Remember applied clips (by id) with the transcript, so a reload never applies one twice.
    // Ids, not times: a computer clock that is wrong or corrected must never make real clips look applied.
    R.appliedClips = (R.appliedClips || []).concat(rec.id).slice(-200);
    // On silence the model sometimes repeats the vocabulary hint. Drop that.
    if (text.includes('policy debate. Terms:')) text = '';
    if (text) {
      if (rec.overlap) text = L.mergeOverlap(R.transcripts[rec.speechId], text);
      R.transcripts[rec.speechId] = L.appendChunk(R.transcripts[rec.speechId], text);
      lastTextAt = Date.now();
      if (sp().id === rec.speechId) setTranscriptView(R.transcripts[rec.speechId]);
      renderSpeeches();
    }
    save(); // the text and the applied-clip list are saved together
    if (trError) { trError = false; setRecNote(''); recProblem = ''; }
    // The last clip of a speech forces one final flow pass.
    scheduleFlow(rec.speechId, rec.isFinal);
  },
  drop(rec, err) {
    trError = true;
    setRecNote(L.AI_ERROR_PREFIX.transcript + ' ' + err.message);
    recProblem = err.message;
    setRecStatus();
    scheduleFlow(rec.speechId, rec.isFinal);
  },
  onChange() { renderRecBadge(); setRecStatus(); },
});
addEventListener('online', () => {
  CQ.retryNow();
  // Automatic AI calls resume only for features the judge turned on (spec 2.3, D2).
  if (S.liveFlow) pumpFlow(); else flowPending.clear();
  if (evalWaitsOnline) { evalWaitsOnline = false; if (S.autoEval) scheduleEval(); }
  if (fillWaitsOnline) { fillWaitsOnline = false; if (S.autoBallot) runAutoRefill(); }
});
document.getElementById('discard-audio').addEventListener('click', async () => {
  const ok = await ask({
    title: 'Delete the waiting audio?',
    body: clipMinutes(CQ.state()) + ' of audio is not transcribed yet. If you delete it, those words never reach the transcript.',
    buttons: [{ label: 'Keep it', value: false, kind: 'plain' }, { label: 'Delete audio', value: true, kind: 'danger' }], cancelValue: false,
  });
  if (!ok) return;
  CQ.clear(); clipStore.clear().catch(() => {}); recProblem = ''; setRecStatus(); renderRecBadge();
});
function queueClip(blob, speechId, isFinal, overlap, seconds) {
  // seq orders clips across reloads too: time first, then a counter for clips cut in the same millisecond.
  const seq = Date.now() * 1000 + (clipCounter++ % 1000);
  CQ.add({ id: R.id + ':' + seq, roundId: R.id, speechId, seq, blob, isFinal, overlap: Boolean(overlap), seconds: seconds || S.chunkSec, engine: activeEngine, at: Date.now() });
}

function blobToBase64(blob) {
  return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1] || ''); fr.onerror = () => rej(fr.error); fr.readAsDataURL(blob); });
}
// Sends one audio clip to the chosen provider and returns the words.
// Errors say if trying again could help (err.retryable): a timeout or a lost connection can; a rejected key cannot.
async function transcribeClip(blob, prevText, timeoutMs = 30000, engine = activeEngine) {
  const eng = engine;
  const fail = (msg, retryable) => Object.assign(new Error(msg), { retryable });
  // No key, or a rejected key: pause and keep the audio (err.hold) until the judge fixes it.
  if (!keys[eng] && eng !== 'browser') throw Object.assign(fail('The ' + ((P.PROVIDERS[eng] || {}).short || eng) + ' key is not connected in this tab. Connect it in Settings.', false), { hold: true });
  const key = keys[eng];
  const ext = /wav/.test(blob.type) ? 'wav' : /mp4/.test(blob.type) ? 'mp4' : /ogg/.test(blob.type) ? 'ogg' : 'webm';
  if (eng !== 'openai' && eng !== 'xai' && eng !== 'google') throw fail('This AI provider cannot transcribe. Choose another in Settings.', false);
  const audio = eng === 'google' ? await blobToBase64(blob) : null;
  let res;
  try {
    res = await withModel(eng, 'transcribe', (model) => {
      const { url, init } = transcribeRequest(eng, key, model, blob, ext, audio, prevText);
      // A stuck request must not block the clips after it, so give up after the queue's time limit.
      return fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    });
  } catch (err) {
    // A timeout or no connection (fetch network failures are TypeErrors): the clip is kept and tried again.
    throw asAIError(err, eng);
  }
  const j = await res.json().catch(() => ({}));
  // Rejected key: pause and keep the audio (hold). Busy or broken for a moment (408, 429, 5xx): try again.
  // Anything else (400, 413...: bad audio): this clip will not work.
  if (!res.ok) throw httpAIError(res.status, j, eng);
  if (eng === 'google') return P.parseAIResponse('google', j).trim();
  return (j.text || '').trim();
}
// The transcription request for one clip.
function transcribeRequest(eng, key, model, blob, ext, audio, prevText) {
  let url, init;
  if (eng === 'openai' || eng === 'xai') {
    const fd = new FormData();
    fd.append('file', blob, 'clip.' + ext);
    fd.append('model', model);
    if (eng === 'openai') { fd.append('language', 'en'); fd.append('prompt', L.buildTranscribePrompt(prevText)); }
    url = eng === 'openai' ? 'https://api.openai.com/v1/audio/transcriptions' : 'https://api.x.ai/v1/stt';
    init = { method: 'POST', headers: { Authorization: 'Bearer ' + key }, body: fd };
  } else {
    const body = {
      contents: [{ role: 'user', parts: [
        { text: 'Transcribe this audio clip from a high school policy debate word for word. Return only the spoken words, with no notes. If it is silent, return nothing. ' + L.buildTranscribePrompt(prevText) },
        { inline_data: { mime_type: 'audio/' + (ext === 'mp4' ? 'mp4' : ext), data: audio } },
      ] }],
    };
    url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent';
    init = { method: 'POST', headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
  }
  return { url, init };
}

// ---------- live AI flow (Claude) ----------
// While a speech runs, Claude re-flows it about every 30 s from the transcript.
// Only one request runs at a time; extra triggers wait for the next turn.
// Pending passes are kept per speech. A forced pass (end of speech) is never dropped;
// normal passes wait so Claude runs at most once every 30 s.
let flowBusy = false, lastFlowAt = 0, flowTimer = null, lastFlowErr = '';
const flowPending = new Map(); // speechId -> force
const FLOW_EVERY_MS = 30000;
function hasFlowSource(speechId) {
  return Boolean((R.transcripts[speechId] || '').trim()) || DOCS.some((d) => L.docSpeech(d) === speechId);
}
function scheduleFlow(speechId, force) {
  if (resetting || !S.liveFlow || L.speechColumn(speechId) == null || !aiReady()) return false;
  if (!hasFlowSource(speechId)) return false;
  flowPending.set(speechId, Boolean(flowPending.get(speechId) || force));
  pumpFlow();
  return true;
}
function pumpFlow() {
  if (flowBusy || !flowPending.size || resetting) return;
  if (navigator.onLine === false) return; // offline: passes wait; the 'online' event resumes them (spec 2.3)
  for (const id of [...flowPending.keys()]) if (!hasFlowSource(id)) flowPending.delete(id);
  if (!flowPending.size) return;
  const forced = [...flowPending].find(([, f]) => f);
  if (forced) { flowPending.delete(forced[0]); return runFlow(forced[0], true); }
  const wait = FLOW_EVERY_MS - (Date.now() - lastFlowAt);
  if (wait <= 0) { const id = flowPending.keys().next().value; flowPending.delete(id); return runFlow(id, false); }
  clearTimeout(flowTimer); flowTimer = setTimeout(pumpFlow, wait);
}
let flowRunningId = null;
async function runFlow(speechId, forced) {
  flowBusy = true; flowRunningId = speechId; lastFlowAt = Date.now(); renderRecBadge();
  try {
    const data = await callAI({ system: L.LIVE_FLOW_SYSTEM, prompt: L.buildLiveFlowPrompt(R, speechId, DOCS), note: L.DOC_FLOW_NOTE, schema: L.LIVE_FLOW_SCHEMA, effort: 'low', kind: 'flow', docs: L.docsForSpeech(DOCS, speechId) });
    if (resetting) return;
    // The docs for this speech may have been removed while Claude was working. Then drop the result.
    if (!hasFlowSource(speechId)) return;
    R.aiFlows = L.applyLiveFlow(R.aiFlows, speechId, data);
    R.aiFlowAt = Date.now(); save(); lastFlowErr = '';
    // A forced pass is the end-of-speech (or doc) pass: refresh the Live Eval after it.
    if (forced && S.autoEval) scheduleEvalSoon();
    if (forced && S.autoBallot) scheduleBallotSoon();
    if (R.tab === 'flow' && R.flowView === 'ai') redrawAIFlowSafely();
  } catch (err) {
    // Shown with the AI flow (its status line and a toast), not in the transcription note.
    if (err.kind === 'offline') { flowPending.set(speechId, Boolean(flowPending.get(speechId) || forced)); return; } // tried again when online
    if (err.status === 413 || /too long|too large|exceed/i.test(err.raw || '')) {
      S.liveFlow = false; saveSettings(); $('#live-flow').checked = false; flowPending.clear();
      toast('Live AI flow turned off: the docs and transcript are too big. Remove a doc, then turn it back on.');
    } else if (err.message !== lastFlowErr) toast(L.AI_ERROR_PREFIX.flow + ' ' + err.message);
    lastFlowErr = err.message || String(err) || 'unknown error';
    console.warn('AI flow failed:', err);
  } finally {
    flowBusy = false; flowRunningId = null; renderRecBadge();
    pumpFlow();
  }
}

// The transcript lives only in the drawer above the round bar (V8, Q7). It shows the speech on screen (the viewed
// one, spec 1.2); live words still go to the running speech's transcript.
function renderTranscript() {
  $('#tr-drawer-label').textContent = sp().label;
  setTranscriptView(R.transcripts[sp().id] || '');
}
function setTranscriptView(text) {
  const el = $('#transcript-big');
  if (el.value === text) return;
  // Keep the view at the newest words, unless the judge scrolled up to read.
  const atEnd = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  el.value = text;
  if (atEnd && document.activeElement !== el) el.scrollTop = el.scrollHeight;
}
$('#transcript-big').addEventListener('input', (e) => { R.transcripts[sp().id] = e.target.value; save(); });
function showDrawer(on) {
  S.trDrawer = on; saveSettings();
  $('#tr-drawer').hidden = !on;
  $('#tr-toggle').setAttribute('aria-expanded', String(on));
  $('#tr-toggle').classList.toggle('on', on);
  document.body.classList.toggle('drawer-open', on);
  if (on) { const t = $('#transcript-big'); t.scrollTop = t.scrollHeight; }
}
$('#tr-toggle').addEventListener('click', () => showDrawer($('#tr-drawer').hidden));
$('#tr-drawer-close').addEventListener('click', () => showDrawer(false));
escLayer('drawer', 30, () => !$('#tr-drawer').hidden, () => showDrawer(false));
// The drawer sits just above the round bar, which can wrap to two lines on narrow screens.
new ResizeObserver(([en]) => document.documentElement.style.setProperty('--rb-h', Math.ceil(en.target.getBoundingClientRect().height) + 'px')).observe(document.querySelector('.roundbar'));
// The sticky header grows when the "Recording" strip shows; the panes and the overlay sit below it.
// Measured on resize and right after the strip changes (resize observers wait for a paint, which a hidden tab skips).
function measureHeader() { document.documentElement.style.setProperty('--header-h', Math.ceil(document.querySelector('header').getBoundingClientRect().height) + 'px'); }
new ResizeObserver(measureHeader).observe(document.querySelector('header'));

// ---------- flow ----------
// A round nobody has touched opens on a calm start screen instead of an empty flow.
function renderStart() {
  const on = L.isRoundEmpty(R) && !R.started;
  $('#tab-flow').classList.toggle('starting', on);
  $('#start-panel').hidden = !on;
}
$('#start-new').addEventListener('click', () => { R.started = true; save(); showTab('setup'); });
$('#start-flow').addEventListener('click', () => { R.started = true; save(); renderFlow(); });
function renderFlow() {
  renderStart();
  if (R.flowView === 'ai') return renderAIFlow();
  const f = R.flows[R.flowIdx] || R.flows[0];
  $('#flow-tabs').innerHTML = viewToggle() + R.flows.map((x, i) => sheetTab(x.name, `data-i="${i}"`, i === R.flowIdx)).join('')
    + '<button data-act="add">+ Sheet</button><button data-act="rename">Rename</button>'
    // With one sheet left, Delete stays focusable but says why it does nothing (spec 2.4 #7).
    + (R.flows.length < 2 ? `<button data-act="del" aria-disabled="true" aria-describedby="one-sheet-why" data-tip="${ONE_SHEET}">Delete</button><span class="sr-only" id="one-sheet-why">${ONE_SHEET}</span>` : '<button data-act="del">Delete</button>')
    + sheetLearnLink(f && f.name);
  $('#flow').innerHTML = L.FLOW_COLUMNS.map((c, i) => `<div class="col ${c.side}"><h3><span>${c.label}</span><span class="col-mark"></span></h3><div class="flow-cell"><div class="flow-hl" aria-hidden="true"></div><textarea data-col="${i}" spellcheck="false" aria-label="${c.label} column, sheet ${escapeHtml(f.name)}">${escapeHtml((f.cells || {})[i] || '')}</textarea></div></div>`).join('');
  markFlowColumns();
  paintAllFlowMarks();
}
// The running speech's column gets a bar under its header, a "Now" label and a thin outline; a different column
// the judge is looking at says "Viewing" (V7, spec 1.2). Only classes and labels change, so the caret stays put.
function markFlowColumns() {
  const m = L.flowMarks(R.run ? R.run.id : null, sp().id);
  document.querySelectorAll('#flow .col').forEach((col, i) => {
    col.classList.toggle('is-current', i === m.current);
    const mark = col.querySelector('.col-mark');
    if (mark) mark.textContent = i === m.now ? 'Now' : i === m.viewing ? 'Viewing' : '';
    const ta = col.querySelector('textarea');
    if (ta) ta.placeholder = i === m.current ? 'Type here' : '';
  });
}
// A link from the open sheet to its Debate Library page (for example DA -> learn/disadvantages/). A real link, not a
// tooltip, so keyboard and screen-reader users can reach it. Sheets with no page (for example "Notes") show nothing.
function sheetLearnLink(name) {
  const p = L.sheetPage(name);
  return p ? `<a class="sheet-learn" href="learn/${p.slug}/" target="_blank" rel="noopener" aria-label="Learn about ${p.topic} in the Debate Library (opens a new tab)" data-tip="Learn about ${p.topic}">ⓘ Learn</a>` : '';
}
function viewToggle() {
  return `<button data-view="mine" class="${R.flowView !== 'ai' ? 'on' : ''}">My flow</button><button data-view="ai" class="${R.flowView === 'ai' ? 'on' : ''}">AI flow</button><span class="tab-gap"></span>`;
}
let aiIdx = 0;
function agoText(t) {
  if (!t) return 'never';
  const sec = Math.round((Date.now() - t) / 1000);
  return sec < 90 ? sec + ' s ago' : Math.round(sec / 60) + ' min ago';
}
function flowStatusHtml() {
  if (flowBusy) return busyHtml('AI is flowing… (10–30 s)');
  if (!aiReady()) return noAiHtml();
  if (navigator.onLine === false) return '<span class="is-quiet">' + escapeHtml(L.AI_ERROR_PREFIX.flow + ' ' + L.aiErrorText('offline')) + '</span>';
  if (lastFlowErr) return '<span class="is-error">' + escapeHtml(L.AI_ERROR_PREFIX.flow + ' ' + lastFlowErr) + '</span>';
  if (!S.liveFlow) return '<span class="is-quiet">Live AI flow is off. Each update is a paid AI call. <button class="linkish" type="button" data-tab-go="ai">Turn it on in Settings</button></span>';
  return '';
}
// Keep the status line and "updated" time fresh without redrawing the flow.
setInterval(() => {
  if (R.tab !== 'flow' || R.flowView !== 'ai') return;
  const st = document.getElementById('ai-flow-status');
  const html = flowStatusHtml();
  if (st && st.innerHTML !== html) st.innerHTML = html;
  const ag = document.getElementById('ai-flow-ago'); if (ag) ag.textContent = 'Updated ' + agoText(R.aiFlowAt) + '.';
}, 1000);
function mapDocsNow() {
  if (!aiReady()) return toast(L.NO_AI);
  if (!S.liveFlow) { S.liveFlow = true; saveSettings(); $('#live-flow').checked = true; toast('Turned Live AI flow on.'); }
  const speeches = [...new Set(DOCS.map((d) => L.docSpeech(d)).filter((sp) => sp && L.speechColumn(sp) != null))];
  if (!speeches.length) return toast(DOCS.length ? 'Your docs are all set to "Context only". Pick a speech for each doc in Round.' : 'No docs yet. Add them in Round or in the Flow workspace.');
  lastFlowErr = '';
  // Skip a speech Claude is already working on, so one click never sends it twice.
  const started = speeches.filter((sp) => sp !== flowRunningId && scheduleFlow(sp, true));
  const running = speeches.includes(flowRunningId) ? ' (' + flowRunningId + ' is already in progress)' : '';
  toast(started.length ? 'Mapping docs onto ' + started.join(', ') + running + '. One AI call per speech, one at a time.' : 'Nothing new to map' + running + '.');
}
function renderAIFlow() {
  const sheets = R.aiFlows || [];
  aiIdx = Math.min(aiIdx, Math.max(0, sheets.length - 1));
  const level = L.FLOW_LEVELS.includes(R.flowLevel) ? R.flowLevel : 'standard';
  const ago = agoText(R.aiFlowAt);
  $('#flow-tabs').innerHTML = viewToggle() + sheets.map((x, i) => sheetTab(x.name, `data-ai="${i}"`, i === aiIdx)).join('')
    + '<span class="tab-gap"></span>' + L.FLOW_LEVELS.map((lv) => `<button data-level="${lv}" class="${lv === level ? 'on' : ''}">${lv[0].toUpperCase() + lv.slice(1)}</button>`).join('')
    + '<span class="tab-gap"></span><button data-act="map-docs">Map docs to flow now</button>'
    + `<span class="muted" style="margin-left:var(--s2)" id="ai-flow-ago">Updated ${ago}.</span>` + sheetLearnLink((sheets[aiIdx] || {}).name)
    + `<div id="ai-flow-status">${flowStatusHtml()}</div>`;
  const sh = sheets[aiIdx];
  // Every cell can be edited. An edited cell keeps the judge's text; if the AI writes something newer
  // underneath, a small bar offers "Use AI" or "Keep mine".
  $('#flow').innerHTML = sh
    ? L.FLOW_COLUMNS.map((c, i) => {
      const ed = sh.edits && sh.edits[i];
      const behind = L.editIsBehind(sh, i);
      return `<div class="col ${c.side}"><h3><span>${c.label}</span>${ed ? '<span class="chip con" data-tip="You edited this cell. AI updates will not overwrite it.">Edited</span>' : ''}<span class="col-mark"></span></h3>`
        + (behind ? `<div class="aibar">AI has a newer version. <button data-ai-use="${i}">Use AI</button><button data-ai-keep="${i}">Keep mine</button></div>` : ed ? `<div class="aibar quiet"><button data-ai-use="${i}">Undo my edit</button></div>` : '')
        + `<div class="flow-cell"><div class="flow-hl" aria-hidden="true"></div><textarea data-aicol="${i}" spellcheck="false" aria-label="${c.label} column, sheet ${escapeHtml(sh.name)}">${escapeHtml(L.flowCellText(sh, i, level))}</textarea></div></div>`;
    }).join('')
    : '<p class="muted flow-empty">No AI flow yet. Click "Map docs to flow now" to flow your docs, or tick "Transcribe" in the round bar and start a speech. Needs AI connected and Live AI flow on (in Settings).</p>';
  markFlowColumns();
  paintAllFlowMarks();
}
$('#flow-tabs').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.view) { R.flowView = b.dataset.view; save(); return renderFlow(); }
  if (b.dataset.ai != null) { aiIdx = Number(b.dataset.ai); return renderFlow(); }
  if (b.dataset.level) { R.flowLevel = b.dataset.level; save(); return renderFlow(); }
  if (b.dataset.act === 'map-docs') return mapDocsNow();
  if (b.dataset.i != null) R.flowIdx = Number(b.dataset.i);
  else if (b.dataset.act === 'add') return addSheet();
  else if (b.dataset.act === 'rename') return renameSheet();
  else if (b.dataset.act === 'del') return deleteSheet();
  save(); renderFlow();
});
// Sheet names come from the in-app dialog (spec 2.4 #5, #6); a deleted sheet has an Undo (#7).
// renderFlow() redraws the tab row, so focus goes back to a tab (the new or current sheet, or the clicked action).
function focusFlowTab(sel) { const el = $('#flow-tabs ' + sel) || $('#flow-tabs button.on[data-i]'); if (el) el.focus(); }
const SHEET_INPUT = { label: 'Sheet name', placeholder: 'For example: DA, Cap K, T', maxLength: 40, emptyError: 'Type a name.' };
async function addSheet() {
  const n = await ask({ title: 'New sheet', input: SHEET_INPUT, buttons: [{ label: 'Cancel', value: null, kind: 'plain' }, { label: 'Add sheet', kind: 'primary' }] });
  if (!n) return;
  R.flows.push({ name: n, cells: {} }); R.flowIdx = R.flows.length - 1; save(); renderFlow(); focusFlowTab('button.on[data-i]');
}
async function renameSheet() {
  const f = R.flows[R.flowIdx]; if (!f) return;
  const n = await ask({ title: 'Rename sheet', input: Object.assign({}, SHEET_INPUT, { value: f.name }), buttons: [{ label: 'Cancel', value: null, kind: 'plain' }, { label: 'Save', kind: 'primary' }] });
  if (!n || !R.flows.includes(f)) return;
  f.name = n; save(); renderFlow(); focusFlowTab('[data-act="rename"]');
}
const ONE_SHEET = 'A round needs at least one sheet.';
function deleteSheet() {
  if (R.flows.length < 2) return toast(ONE_SHEET);
  const { list, undo } = L.removeAt(R.flows, R.flowIdx);
  if (!undo) return;
  const wasIdx = R.flowIdx;
  R.flows = list; R.flowIdx = Math.min(wasIdx, list.length - 1); save(); renderFlow(); focusFlowTab('[data-act="del"]');
  const token = Object.assign({ roundId: R.id }, undo);
  undoToast('Sheet "' + undo.item.name + '" deleted.', 'delete sheet ' + undo.item.name, () => {
    // A new round may have started since the delete; the sheet never goes into a different round.
    const back = L.undoSheetDelete(R, token);
    if (!back) { toast('A new round started, so the sheet cannot come back.'); return false; }
    R.flows = back.flows; R.flowIdx = back.flowIdx; save(); if (R.tab === 'flow') renderFlow();
  }, 'Sheet "' + undo.item.name + '" restored.');
}
// Option B (Q-8): the mark layer. Behind each flow textarea sits a mirror (.flow-hl) with the same font, padding,
// wrapping and scroll position. It shows the same text, see-through, with a light shade on typed marks such as
// "ext", "*" or "L/T" (L.flowMarkTokens). The textarea stays on top, so the caret, selection, undo and screen
// readers work as before, and the saved flow is still plain text. One div per line, and a keystroke repaints only
// the lines that changed, so a column of thousands of lines stays fast.
const flowMarkLines = new WeakMap();
function paintFlowMarks(ta) {
  const hl = ta.previousElementSibling;
  if (!hl || !hl.classList.contains('flow-hl')) return;
  const lines = ta.value.split('\n');
  const old = flowMarkLines.get(ta);
  if (!old || hl.childElementCount !== old.length) {
    hl.innerHTML = lines.map((ln) => '<div>' + L.flowMarkHtml(ln) + '</div>').join('');
  } else {
    const d = L.flowLinesChanged(old, lines);
    const kids = hl.children;
    const before = kids[d.oldTo] || null;
    for (let i = d.oldTo - 1; i >= d.from; i--) kids[i].remove();
    if (d.newTo > d.from) {
      const html = lines.slice(d.from, d.newTo).map((ln) => '<div>' + L.flowMarkHtml(ln) + '</div>').join('');
      if (before) before.insertAdjacentHTML('beforebegin', html); else hl.insertAdjacentHTML('beforeend', html);
    }
  }
  flowMarkLines.set(ta, lines);
  hl.scrollTop = ta.scrollTop;
}
function paintAllFlowMarks() { document.querySelectorAll('#flow .flow-cell textarea').forEach(paintFlowMarks); }
// Scroll does not bubble, so listen in the capture phase. A resize or a new font size reflows both the same way.
$('#flow').addEventListener('scroll', (e) => {
  const ta = e.target;
  if (ta.tagName === 'TEXTAREA' && ta.previousElementSibling && ta.previousElementSibling.classList.contains('flow-hl')) ta.previousElementSibling.scrollTop = ta.scrollTop;
}, true);
$('#flow').addEventListener('input', (e) => {
  if (e.target.tagName === 'TEXTAREA') paintFlowMarks(e.target);
  const aicol = e.target.dataset.aicol;
  if (aicol != null) {
    const sh = (R.aiFlows || [])[aiIdx]; if (!sh) return;
    const wasEdited = Boolean(sh.edits && sh.edits[aicol]);
    (sh.edits ??= {})[aicol] = { text: e.target.value, base: (sh.edits[aicol] && sh.edits[aicol].base) ?? L.aiFlowCell(sh, Number(aicol), 'standard') };
    save();
    if (!wasEdited) { const h = e.target.closest('.col').querySelector('h3'); if (h && !h.querySelector('.chip')) h.querySelector('.col-mark').insertAdjacentHTML('beforebegin', '<span class="chip con" data-tip="You edited this cell. AI updates will not overwrite it.">Edited</span>'); }
    return;
  }
  const col = e.target.dataset.col; if (col == null) return;
  (R.flows[R.flowIdx].cells ??= {})[col] = e.target.value; save();
});
$('#flow').addEventListener('click', (e) => {
  const use = e.target.dataset.aiUse, keep = e.target.dataset.aiKeep;
  const sh = (R.aiFlows || [])[aiIdx]; if (!sh || (use == null && keep == null)) return;
  if (use != null) delete sh.edits[use];
  if (keep != null) sh.edits[keep].base = L.aiFlowCell(sh, Number(keep), 'standard');
  save(); renderFlow();
});
// Do not redraw the AI flow under the judge's cursor; redraw when they leave the cell instead.
let flowRedrawPending = false;
function redrawAIFlowSafely() {
  if (document.activeElement && document.activeElement.dataset && document.activeElement.dataset.aicol != null) { flowRedrawPending = true; return; }
  renderFlow();
}
$('#flow').addEventListener('focusout', () => { if (flowRedrawPending) { flowRedrawPending = false; setTimeout(renderFlow, 0); } });
// A sheet tab: the short name on the tab, the full argument name on a long hover (data-tip) and for screen readers.
function sheetTab(name, attr, on) {
  const { short, full } = L.sheetLabel(name);
  return `<button ${attr} class="${on ? 'on' : ''}"${full ? ` data-tip="${escapeHtml(full)}" aria-label="${escapeHtml(full)}"` : ''}>${escapeHtml(short)}</button>`;
}
// Label tips (data-tip) and help bubbles (?) are one module in ui.js (V11, spec 4.4).
// Status colour comes only from the .is-error / .is-caution / .is-ok classes (spec colour rule 4). .is-quiet is not a
// status colour: it is the one class for calm, muted status text (offline, busy, no AI), here and in rendered HTML.
// kind: 'error' | 'caution' | 'ok' | 'quiet' | '' (none). The words beside the colour always carry the meaning.
function tone(el, kind) {
  el.classList.remove('is-error', 'is-caution', 'is-ok', 'is-quiet');
  if (kind) el.classList.add('is-' + kind);
}
function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

// ---------- round documents ----------
// Docs can be large (PDFs), so they live in IndexedDB, not localStorage.
// If IndexedDB is not available, they are kept in memory for this page only.
let DOCS = [];
const docStore = {
  db: null,
  opening: null,
  async open() {
    if (this.db) return this.db;
    // One open request at a time; every caller waits for the same one.
    this.opening ??= new Promise((res, rej) => {
      const r = indexedDB.open('policyJudge', 2);
      // Version 2 adds 'clips': audio waiting to be transcribed (deleted once its text is back).
      r.onupgradeneeded = () => { const db = r.result; for (const name of ['docs', 'clips']) if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' }); };
      r.onsuccess = () => {
        const db = r.result;
        // A newer Tabula in another tab needs to update the database: step aside so it is not stuck.
        db.onversionchange = () => { db.close(); if (this.db === db) this.db = null; toast('Tabula was updated in another tab. Reload this tab.'); };
        this.db = db; res(db);
      };
      r.onerror = () => rej(r.error);
      // An older Tabula tab still has the database open. Keep waiting (the update finishes when it closes);
      // each storage step (storageStep) still gives up after 3 s, so the app does not freeze meanwhile.
      r.onblocked = () => toast('Close other Tabula tabs or windows to finish an update.');
    }).finally(() => { this.opening = null; });
    return this.opening;
  },
  async tx(mode, fn) { return storageStep('docs', mode, fn); },
  async list(roundId) { return ((await this.tx('readonly', (st) => st.getAll())) || []).filter((d) => d.roundId === roundId); },
  put(doc) { if (restoring) return Promise.resolve(); return this.tx('readwrite', (st) => st.put(doc)); }, // no stray writes during a restore
  del(id) { return this.tx('readwrite', (st) => st.delete(id)); },
  async clearRound(roundId) { try { for (const d of await this.list(roundId)) await this.del(d.id); } catch {} },
};

// One storage step on a store of the app's database. Never let a stuck browser database freeze the app:
// the whole step (opening included) must finish in 3 s.
async function storageStep(name, mode, fn) {
  let timer;
  const timeout = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('storage timed out')), 3000); });
  const work = (async () => {
    const db = await docStore.open();
    return new Promise((res, rej) => {
      const t = db.transaction(name, mode); const req = fn(t.objectStore(name));
      t.oncomplete = () => res(req && req.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('storage aborted'));
    });
  })();
  try { return await Promise.race([work, timeout]); } finally { clearTimeout(timer); }
}
// Audio clips waiting for their text. Same database as the docs, its own store, never in a backup.
const clipStore = {
  tx(mode, fn) { return storageStep('clips', mode, fn); },
  put(rec) { return this.tx('readwrite', (st) => st.put(rec)); },
  del(id) { return this.tx('readwrite', (st) => st.delete(id)); },
  all() { return this.tx('readonly', (st) => st.getAll()).then((x) => x || []); },
  clear() { return this.tx('readwrite', (st) => st.clear()); },
};
// On start: audio from other rounds is deleted; this round's waiting clips (a reload mid-speech) are sent again.
async function resumeClips() {
  try {
    const all = await clipStore.all();
    for (const c of all) if (c.roundId !== R.id) await clipStore.del(c.id);
    // Clips already applied (a reload between applying and deleting) are deleted, never applied twice.
    const applied = new Set(R.appliedClips || []);
    for (const c of all) if (c.roundId === R.id && applied.has(c.id)) await clipStore.del(c.id);
    const mine = all.filter((c) => c.roundId === R.id && !applied.has(c.id));
    if (mine.length) { CQ.resume(mine); toast(mine.length + ' audio clip' + (mine.length > 1 ? 's' : '') + ' from before the reload are being transcribed.'); }
  } catch { /* storage unavailable: nothing to resume */ }
}
function fileToBase64(file) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result).split(',')[1] || '');
    fr.onerror = () => rej(fr.error);
    fr.readAsDataURL(file);
  });
}
let mammothReady = null;
function loadMammoth() {
  mammothReady ??= new Promise((res, rej) => {
    const el = document.createElement('script');
    el.src = 'vendor/mammoth-1.6.0.browser.min.js';
    el.integrity = 'sha512-sG5Q7boJL+ft/weuz6Mmi9XBD+bEzE9AI2FMP4YMFxp3FpTFUQSQQm5K5cSgJCyed6bWs3W8f8h0lp36lHXhQA=='; el.crossOrigin = 'anonymous';
    el.onload = () => res(window.mammoth); el.onerror = () => { mammothReady = null; rej(new Error('could not load the Word reader (needs internet)')); };
    document.head.append(el);
  });
  return mammothReady;
}
async function readDoc(file) {
  const name = file.name;
  if (/\.pdf$/i.test(name) || file.type === 'application/pdf') return { kind: 'pdf', data: await fileToBase64(file) };
  if (/\.docx$/i.test(name)) {
    const m = await loadMammoth();
    let out;
    try { out = await m.extractRawText({ arrayBuffer: await file.arrayBuffer() }); }
    catch { throw new Error('could not read this Word file. Try saving it as PDF'); }
    return { kind: 'text', data: out.value || '' };
  }
  if (/\.doc$/i.test(name)) throw new Error('old .doc files are not supported. Save it as .docx or PDF');
  return { kind: 'text', data: await file.text() };
}
// Claude takes up to 32 MB per request, and base64 makes PDFs about 1/3 bigger.
const MAX_DOC_BYTES = 15 * 1024 * 1024;
const MAX_TEXT_CHARS = 400000;
function docBytes(d) { return d.kind === 'pdf' ? Math.round(d.data.length * 0.75) : d.data.length; }
const FLOW_SPEECHES = ['1AC', '1NC', '2AC', '2NC', '1NR', '1AR', '2NR', '2AR'];
function speechPicker(d) {
  const cur = L.docSpeech(d);
  return `<select data-doc-speech="${d.id}" class="w-auto" aria-label="Speech for ${escapeHtml(d.name || 'this doc')}" data-tip="Which speech this doc belongs to. It is mapped onto that speech's flow column.">`
    + `<option value=""${cur === '' ? ' selected' : ''}>Context only</option>`
    + FLOW_SPEECHES.map((sp) => `<option${sp === cur ? ' selected' : ''}>${sp}</option>`).join('') + '</select>';
}
// Re-flow a speech after its docs change. If nothing is left to flow it from, clear its AI notes.
function reflowForDocs(speechId) {
  if (!speechId) return;
  const hasSource = (R.transcripts[speechId] || '').trim() || DOCS.some((d) => L.docSpeech(d) === speechId);
  if (hasSource) scheduleFlow(speechId, true);
  else { R.aiFlows = L.applyLiveFlow(R.aiFlows, speechId, { sheets: [] }); save(); if (R.tab === 'flow') renderFlow(); }
}
function renderDocs() {
  const total = DOCS.reduce((n, d) => n + docBytes(d), 0);
  document.querySelectorAll('.doc-count').forEach((el) => { el.textContent = DOCS.length ? DOCS.length + ' (' + DOCS.map((d) => L.DOC_SIDES[d.side] + ': ' + d.name).join(', ') + ')' : 'none'; });
  $('#doc-list').innerHTML = DOCS.length
    ? DOCS.map((d) => `<tr><td class="${d.side === 'aff' ? 'aff' : d.side === 'neg' ? 'neg' : ''}">${L.DOC_SIDES[d.side]}</td><td>${escapeHtml(d.name)}</td><td>${speechPicker(d)}</td><td class="muted">${d.kind === 'pdf' ? 'PDF' : 'text'} · ${Math.max(1, Math.round(docBytes(d) / 1024))} KB</td><td><button class="b" data-doc-del="${d.id}">Remove</button></td></tr>`).join('')
      + `<tr><td colspan="5" class="muted">Total ${Math.round(total / 1024)} KB${total > MAX_DOC_BYTES ? ' — too big; remove some docs' : ''}</td></tr>`
    : '<tr><td class="muted">No documents yet.</td></tr>';
}
// One upload path for every place a doc can be added (Setup, Timer, Flow, drag and drop).
// Returns the docs that were added (a file that fails is left out).
async function addDocFiles(files, side, statusEl, speech) {
  const added = [];
  for (const file of files) {
    if (!/\.(pdf|docx|txt|md)$/i.test(file.name)) { statusEl.textContent = file.name + ': only PDF, .docx, .txt or .md files'; continue; }
    statusEl.textContent = 'Reading ' + file.name + '…';
    try {
      const { kind, data } = await readDoc(file);
      if (!data.trim()) throw new Error('no text found');
      const doc = { id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random())), roundId: R.id, name: file.name, side, kind, data, addedAt: Date.now() };
      if (speech !== undefined) doc.speech = speech;
      if (DOCS.reduce((n, d) => n + docBytes(d), 0) + docBytes(doc) > MAX_DOC_BYTES) throw new Error('too big. Keep all docs under 15 MB');
      const textChars = DOCS.concat([doc]).filter((d) => d.kind !== 'pdf').reduce((n, d) => n + d.data.length, 0);
      if (textChars > MAX_TEXT_CHARS) throw new Error('too much text. Keep Word/text docs under about 400,000 characters in total');
      DOCS.push(doc); added.push(doc);
      renderDocs();
      const sp = L.docSpeech(doc);
      statusEl.textContent = 'Added ' + file.name + ' (' + L.DOC_SIDES[side] + (sp ? ', mapped to ' + sp : '') + ')';
      if (sp) {
        if (S.liveFlow && aiReady()) scheduleFlow(sp, true);
        else statusEl.textContent += '. Connect AI and turn on Live AI flow to map it onto the flow.';
      }
      docStore.put(doc).catch(() => toast(file.name + ' is kept for this page only. It will be gone after a refresh.'));
    } catch (err) {
      statusEl.textContent = file.name + ': ' + err.message;
    }
    renderDocs();
  }
  return added;
}
// ---------- SpeechDrop import ----------
// The judge types the room code; Tabula lists the files (through the local helper), the judge ticks
// the ones to add, and each is guessed onto a speech from its name. New uploads are checked every 30 s.
// The list is drawn again only when the files change, and the judge's ticks and speech choices live in SD.picks,
// so a 30-second check never undoes what the judge picked.
const SD = { files: [], seen: new Set(), fresh: new Set(), loaded: false, timer: null, busy: false, adding: false, picks: {} };
const sdState = () => (R.speechDrop ??= { code: '', imported: {} });
// A file is known by its slot and its name together, so a reused slot never looks already added.
const sdKey = (f) => f.i + ':' + f.name;
const sdSpeeches = [['', 'Context only']].concat(L.MAP_SPEECHES.map((id) => [id, id]));
const SD_BOX = `<h3 class="sd-h">From SpeechDrop</h3>
<div class="sd-box">
  <div class="row sd-row"><input class="sd-code" placeholder="SpeechDrop code or link" aria-label="SpeechDrop room code" autocomplete="off" spellcheck="false"><button class="b sd-get">Get files</button></div>
  <p class="muted sd-status" role="status" aria-live="polite"></p>
  <div class="sd-list"></div>
</div>`;
// One box in the Round docs card and one in the Flow left pane, built from the same template.
// On the website there is no helper to ask SpeechDrop, so the boxes stay hidden there.
document.querySelectorAll('.sd-mount').forEach((m) => { m.hidden = !LOCAL_ORIGIN; if (LOCAL_ORIGIN) m.innerHTML = SD_BOX; });
function sdStatus(msg) { document.querySelectorAll('.sd-status').forEach((el) => { el.textContent = msg; }); }
function sdPick(i) { return (SD.picks[i] ??= { checked: false, speech: L.guessSpeech((SD.files.find((f) => f.i === i) || {}).name) }); }
function renderSdList() {
  const st = sdState();
  document.querySelectorAll('.sd-box').forEach((box) => {
    const inp = box.querySelector('.sd-code');
    if (document.activeElement !== inp) inp.value = st.code || '';
    box.querySelector('.sd-list').innerHTML = !SD.files.length ? '' : SD.files.map((f) => {
      const done = st.imported[sdKey(f)], p = sdPick(f.i);
      return `<label class="sd-file${done ? ' sd-done' : ''}"><input type="checkbox" data-sd-i="${f.i}"${p.checked && !done ? ' checked' : ''}${done ? ' disabled' : ''}>
        <span class="sd-name" data-tip="${escapeHtml(f.name)}">${escapeHtml(f.name)}${done ? ' · added' : SD.fresh.has(sdKey(f)) ? '<span class="sd-new">new</span>' : ''}</span>
        <select data-sd-speech="${f.i}" aria-label="Speech for ${escapeHtml(f.name)}"${done ? ' disabled' : ''}>${sdSpeeches.map(([v, t]) => `<option value="${v}"${v === p.speech ? ' selected' : ''}>${t}</option>`).join('')}</select></label>`;
    }).join('') + '<div class="sd-actions"><button class="b primary sd-add">Add selected</button><span class="muted">Checks for new files every 30 s.</span></div>';
  });
}
async function sdApi(path, ms) {
  const r = await fetch('/api/speechdrop/' + path, { headers: { 'X-Tabula': '1' }, signal: AbortSignal.timeout(ms) });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || 'the helper said ' + r.status); }
  return r;
}
async function sdFetchList(quiet) {
  const code = sdState().code;
  if (!code || !LOCAL_ORIGIN) return;
  if (SD.busy) { SD.again = SD.again === undefined ? quiet : SD.again && quiet; return; } // runs right after the current check
  SD.busy = true;
  try {
    const j = await (await sdApi(encodeURIComponent(code), 20000)).json();
    if (sdState().code !== code) return; // the judge typed another code while this was on its way
    const fresh = SD.loaded ? j.files.filter((f) => !SD.seen.has(sdKey(f))).map(sdKey) : [];
    const changed = !SD.loaded || fresh.length || j.files.length !== SD.files.length;
    j.files.forEach((f) => SD.seen.add(sdKey(f)));
    fresh.forEach((i) => SD.fresh.add(i));
    SD.files = j.files; SD.loaded = true;
    if (changed) renderSdList();
    const n = fresh.length;
    if (n) { sdStatus(n + ' new file' + (n > 1 ? 's' : '') + ' in SpeechDrop.'); if (quiet) toast(n + ' new file' + (n > 1 ? 's' : '') + ' in SpeechDrop'); }
    else if (!quiet) sdStatus(j.files.length ? j.files.length + ' file' + (j.files.length > 1 ? 's' : '') + ' in room ' + code + '.' : 'The room is empty so far. Tabula checks again every 30 s.');
  } catch (err) {
    if (!quiet) sdStatus('Could not get the files: ' + (err.name === 'TimeoutError' ? 'the helper did not answer' : err.message) + '.');
  } finally {
    SD.busy = false;
    // A check asked for while this one ran (for example a newly typed code) runs now, loudly if either asked loudly.
    if (SD.again !== undefined) { const q = SD.again; SD.again = undefined; sdFetchList(q); }
  }
}
function sdWatch() {
  clearInterval(SD.timer);
  if (sdState().code && LOCAL_ORIGIN) SD.timer = setInterval(() => { if (!document.hidden) sdFetchList(true); }, 30000);
}
async function sdAdd() {
  if (SD.adding) return;
  const st = sdState(), code = st.code;
  const picked = SD.files.filter((f) => !st.imported[sdKey(f)] && sdPick(f.i).checked);
  if (!picked.length) return sdStatus('Tick the files you want first.');
  SD.adding = true;
  const status = { set textContent(v) { sdStatus(v); } }; // addDocFiles reports progress through this
  try {
    for (const f of picked) {
      const speech = sdPick(f.i).speech;
      sdStatus('Getting ' + f.name + '…');
      try {
        const file = new File([await (await sdApi(encodeURIComponent(code) + '/file/' + f.i, 90000)).blob()], f.name);
        const added = await addDocFiles([file], L.speechSide(speech), status, speech);
        if (added.length && sdState().code === code) { st.imported[sdKey(f)] = true; SD.fresh.delete(sdKey(f)); save(); }
      } catch (err) { sdStatus(f.name + ': ' + err.message); }
    }
  } finally { SD.adding = false; renderSdList(); }
}
document.addEventListener('change', (e) => {
  const t = e.target;
  if (!t.dataset) return;
  // Update the pick and the same control in the other box, without redrawing (so keyboard focus stays put).
  if (t.dataset.sdI != null) {
    sdPick(Number(t.dataset.sdI)).checked = t.checked;
    document.querySelectorAll(`[data-sd-i="${t.dataset.sdI}"]`).forEach((c) => { if (c !== t) c.checked = t.checked; });
  }
  if (t.dataset.sdSpeech != null) {
    sdPick(Number(t.dataset.sdSpeech)).speech = t.value;
    document.querySelectorAll(`[data-sd-speech="${t.dataset.sdSpeech}"]`).forEach((c) => { if (c !== t) c.value = t.value; });
  }
});
document.addEventListener('click', (e) => {
  const get = e.target.closest && e.target.closest('.sd-get');
  if (get) {
    const code = L.parseSpeechDropCode(get.closest('.sd-box').querySelector('.sd-code').value);
    if (!code) return sdStatus('Type the room code from SpeechDrop (letters and numbers), or paste its link.');
    const st = sdState();
    if (code !== st.code) { st.code = code; st.imported = {}; Object.assign(SD, { files: [], seen: new Set(), fresh: new Set(), loaded: false, picks: {} }); save(); renderSdList(); }
    sdStatus('Looking in room ' + code + '…'); sdFetchList(false); sdWatch();
  }
  if (e.target.closest && e.target.closest('.sd-add')) sdAdd();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('sd-code')) e.target.closest('.sd-box').querySelector('.sd-get').click(); });

$('#doc-file').addEventListener('change', (e) => {
  const files = [...e.target.files]; e.target.value = '';
  addDocFiles(files, $('#doc-side').value, $('#doc-status'));
});
document.querySelectorAll('.doc-quick').forEach((inp) => inp.addEventListener('change', (e) => {
  const bar = e.target.closest('.docbar');
  const files = [...e.target.files]; e.target.value = '';
  const side = bar.querySelector('.doc-quick-side').value;
  addDocFiles(files, side, bar.querySelector('.doc-quick-status'), timerSpeechFor(bar, side));
}));
// In the Flow workspace, a doc for the side that is speaking maps to the current speech.
// The only doc bar outside Round lives in the Flow workspace's left pane (#tab-timer).
function timerSpeechFor(bar, side) {
  if (!bar.closest('#tab-timer')) return undefined;
  const cur = runSp(); // the speech the clock times, not one the judge is only looking back at
  return cur.side === side && L.speechColumn(cur.id) != null ? cur.id : undefined;
}
// Drag and drop: the side comes from the picker on the tab you are on.
document.addEventListener('dragover', (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
document.addEventListener('drop', (e) => {
  if (!e.dataTransfer || !e.dataTransfer.files.length) return;
  e.preventDefault();
  const tab = document.querySelector('section.tab.on');
  const bar = tab && tab.querySelector('.docbar');
  const side = bar ? bar.querySelector('.doc-quick-side').value : $('#doc-side').value;
  // Tabs without a doc bar show the result as a pop-up message instead.
  const status = bar ? bar.querySelector('.doc-quick-status') : { set textContent(v) { toast(v); } };
  addDocFiles([...e.dataTransfer.files], side, status, bar ? timerSpeechFor(bar, side) : undefined);
});
$('#doc-list').addEventListener('change', (e) => {
  const id = e.target.dataset.docSpeech; if (!id) return;
  const d = DOCS.find((x) => x.id === id); if (!d) return;
  const old = L.docSpeech(d);
  d.speech = e.target.value;
  docStore.put(d).catch(() => {});
  renderDocs();
  reflowForDocs(old); reflowForDocs(d.speech);
  if (d.speech && !S.liveFlow) toast('Turn on "Live AI flow" in Settings to map docs onto the flow.');
});
$('#doc-list').addEventListener('click', async (e) => {
  const id = e.target.dataset.docDel; if (!id) return;
  const gone = DOCS.find((d) => d.id === id);
  DOCS = DOCS.filter((d) => d.id !== id);
  try { await docStore.del(id); } catch {}
  renderDocs();
  if (gone) reflowForDocs(L.docSpeech(gone));
});
docStore.open().then(async () => {
  const all = (await docStore.tx('readonly', (st) => st.getAll())) || [];
  // Remove docs left over from older rounds.
  for (const d of all) if (d.roundId !== R.id) { try { await docStore.del(d.id); } catch {} }
  DOCS = all.filter((d) => d.roundId === R.id).sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));
  renderDocs();
}).catch(() => renderDocs());

// ---------- reading level: "How the AI writes" (spec 4.9, Q15) ----------
// Results are saved per reading level, so switching is instant and does not re-ask the AI.
// One rule: this round's choice (R.reading, set in Round setup), else the device default (S.readLevel, in Settings).
S.readLevel ??= 'expert';
const lvl = () => L.readingFor(R.reading, S.readLevel);
R.byLevel ??= {};
(() => { // move results saved by older versions into the "expert" box
  const ex = (R.byLevel.expert ??= {});
  if (R.liveEval && !ex.liveEval) ex.liveEval = R.liveEval;
  if (R.ai && R.ai.output && !ex.output) ex.output = R.ai.output;
  if (R.analysis && R.analysis.impacts && !ex.impacts) ex.impacts = R.analysis.impacts;
  delete R.liveEval; if (R.ai) delete R.ai.output; if (R.analysis) delete R.analysis.impacts;
})();
const LV = (level) => (R.byLevel[level || lvl()] ??= {});
function renderReadLevel() {
  const device = L.readingFor(null, S.readLevel);
  document.querySelectorAll('[data-read]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.read === (b.dataset.readScope === 'device' ? device : lvl()))));
  const st = $('#dp-style'); if (st) st.textContent = 'Writing style: ' + L.READING_LEVELS[lvl()].label + '. Change it in Round setup.';
}
document.addEventListener('click', (e) => {
  const b = e.target.closest && e.target.closest('[data-read]');
  if (!b) return;
  if (b.dataset.readScope === 'device') { S.readLevel = b.dataset.read; saveSettings(); }
  else { R.reading = b.dataset.read; save(); }
  renderReadLevel();
  if (R.tab === 'eval') renderEval();
  if (R.tab === 'analysis') renderAnalysis();
});

// ---------- AI connections ----------
// Keys are kept per provider. With "Remember" on they are saved in this browser (localStorage). With it off, the
// default for new installs (spec 2.6, D1), they live in this tab only (sessionStorage, Q-3): a refresh keeps them,
// and closing the tab forgets them.
const P = window.Providers;
const KEYS = 'policyJudge.keys.v1';
const tabStore = {
  get(k, d) { try { const raw = sessionStorage.getItem(k); return raw ? JSON.parse(raw) : d; } catch { return d; } },
  set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
  del(k) { try { sessionStorage.removeItem(k); } catch {} },
};
// A saved choice wins. With none, a judge who already has keys on disk keeps them, so no current user loses a key.
S.rememberKeys = L.resolveRememberKeys(S.rememberKeys, Object.keys(store.get(KEYS, {}) || {}).length > 0 || Boolean(store.get(KEY, '')) || Boolean(store.get(OAKEY, '')));
const keys = Object.assign({}, tabStore.get(KEYS, {}), store.get(KEYS, {}));
// Move keys saved by older versions of the app.
(() => { const a = store.get(KEY, '') || tabStore.get(KEY, ''), o = store.get(OAKEY, '') || tabStore.get(OAKEY, ''); if (a && !keys.anthropic) keys.anthropic = a; if (o && !keys.openai) keys.openai = o; })();
S.models = P.cleanSavedModels(S.models); // older versions saved premium or retired models
S.modelChoice ??= {}; // models the judge picked in Settings (these win over automatic picks)
S.modelLists ??= {}; // each provider's chat models, for the picker
S.helper = {};
// With several keys and no choice yet, take the first connected provider in alphabetical order (no favorite).
if (!S.aiEngine) S.aiEngine = ['anthropic', 'google', 'openai', 'openrouter', 'xai'].find((p) => keys[p]) || '';
if (!S.trEngine) S.trEngine = S.engine === 'openai' && keys.openai ? 'openai' : 'browser';
// Old single-key entries are removed only once the keys are safely saved in the new place.
function saveKeys() {
  if (restoring) return;
  const dropTab = () => { tabStore.del(KEY); tabStore.del(OAKEY); };
  if (S.rememberKeys) { if (store.set(KEYS, keys)) { store.del(KEY); store.del(OAKEY); tabStore.del(KEYS); dropTab(); } }
  else { tabStore.set(KEYS, keys); dropTab(); store.del(KEYS); store.del(KEY); store.del(OAKEY); }
}
saveKeys();
const aiReady = () => {
  const e = S.aiEngine;
  if (!e) return false;
  if (P.SUBSCRIPTIONS[e]) return Boolean(S.helper[e]);
  return Boolean(keys[e]);
};
// The "No AI" line (L.NO_AI) is muted, with a button to Settings (spec 2.2).
const noAiHtml = (extra, label) => '<span class="is-quiet">' + escapeHtml(L.NO_AI) + ' <button class="linkish" type="button" data-tab-go="ai">' + escapeHtml(label || 'Open Settings') + '</button>' + (extra ? ' ' + escapeHtml(extra) : '') + '</span>';
// An AI error line: orange, except "offline", which is muted (it is not the judge's fault, spec 2.3).
const errColor = (msg) => (msg === L.aiErrorText('offline') ? 'quiet' : 'error'); // a tone() name: offline is calm, not an error
// A loading line: muted, with a small spinner, never green (spec 2.3).
const busyHtml = (text) => '<span class="is-quiet"><span class="spin" aria-hidden="true"></span>' + escapeHtml(text) + '</span>';
// An Undo toast (spec 2.4, 4.3). The change is already made; Undo puts it back. The button is named "Undo: {what}".
// undo() returns false when it could not put the change back (it shows its own toast then).
function undoToast(msg, what, undo, doneMsg) {
  toast(msg, { action: { label: 'Undo', name: 'Undo: ' + what, run: () => { if (undo() !== false) toast(doneMsg || 'Restored.'); } } });
}

let claudeClient = null, claudeClientKey = '';
async function getClaude() {
  if (claudeClient && claudeClientKey === keys.anthropic) return claudeClient;
  const { default: Anthropic } = await import('./vendor/anthropic-sdk-0.137.0.bundle.mjs');
  claudeClient = new Anthropic({ apiKey: keys.anthropic, dangerouslyAllowBrowser: true });
  claudeClientKey = keys.anthropic;
  return claudeClient;
}

// Reads the provider's live model list once, and remembers the best model for each job.
async function modelFor(provider, purpose) {
  // Gemini transcribes with its routine model, so it follows the judge's routine choice.
  const chosen = (S.modelChoice[provider] || {})[purpose] || (provider === 'google' && purpose === 'transcribe' ? (S.modelChoice.google || {}).ai : '');
  if (chosen) return chosen;
  const saved = (S.models[provider] || {})[purpose];
  if (saved) return saved;
  const req = P.modelsRequest(provider, keys[provider]);
  let res;
  try { res = await fetch(req.url, { ...req.init, signal: AbortSignal.timeout(15000) }); }
  catch (err) { throw asAIError(err, provider); }
  // A busy or broken provider may work again soon (retryable); a rejected key will not (hold).
  if (!res.ok) throw httpAIError(res.status, await res.json().catch(() => ({})), provider);
  const ids = P.modelIds(provider, await res.json());
  S.modelLists[provider] = P.chatModels(provider, ids);
  const id = P.pickModel(provider, ids, purpose);
  if (!id) throw Object.assign(new Error(P.chatModels(provider, ids).some(P.isPremium)
    ? 'This key only has premium models, which cost much more. To use one anyway, choose it in Settings under ' + P.PROVIDERS[provider].name + '.'
    : 'This ' + P.PROVIDERS[provider].name + ' key has no model that can do this. Test the key in Settings.'), { retryable: false, kind: 'noModel' });
  (S.models[provider] ??= {})[purpose] = id; saveSettings();
  return id;
}
// Forgets a model the provider retired, so the next call picks again. A model the judge chose is forgotten too, with a note.
function forgetModel(provider, purpose) {
  if ((S.modelChoice[provider] || {})[purpose]) { delete S.modelChoice[provider][purpose]; toast('The model you chose for ' + P.PROVIDERS[provider].name + ' was retired, so Tabula picked a new one.'); }
  delete (S.models[provider] || {})[purpose];
  saveSettings();
}
// Runs one model call with a fresh pick if the saved model was retired (404).
const withModel = (provider, purpose, run) => P.retryOnce404(async () => run(await modelFor(provider, purpose)), () => forgetModel(provider, purpose));

// One error for every failed AI or transcription call (spec 2.3): the kind comes from L.classifyAIError and the
// words from L.aiErrorText. The provider's own words go to the console only. info: { status, name, message, stop, helper }.
const providerName = (eng) => (P.PROVIDERS[eng] ? P.PROVIDERS[eng].short : P.SUBSCRIPTIONS[eng] ? P.SUBSCRIPTIONS[eng].plan : '');
function aiError(info, eng) {
  const i = info || {};
  const kind = L.classifyAIError(Object.assign({ online: navigator.onLine }, i));
  if (i.message) console.warn('AI call failed (' + kind + '):', i.message);
  return Object.assign(new Error(L.aiErrorText(kind, { provider: providerName(eng), status: i.status })), {
    kind, status: i.status, raw: i.message || '',
    retryable: ['offline', 'noReply', 'timeout', 'busy'].includes(kind),
    hold: kind === 'keyRejected', // a rejected key will not work until the judge fixes it
  });
}
// An error reply from a provider. Some providers say "invalid key" with a 400; that is a rejected key too.
function httpAIError(status, body, eng) {
  const raw = body && body.error;
  const message = typeof raw === 'string' ? raw : (raw && raw.message) || JSON.stringify(body || {}).slice(0, 300);
  const bad = /invalid.*key|api key not valid|incorrect api key/i.test(message);
  return aiError({ status: bad ? 401 : status, message }, eng);
}
// A thrown error from fetch or the SDK, as the classifier's input. Errors that already have a kind pass through.
function asAIError(err, eng, extra) {
  if (err && err.kind) return err;
  const name = err && err.name || '';
  const n = /Timeout/.test(name) ? 'TimeoutError' : /APIConnection/.test(name) ? 'TypeError' : name;
  return aiError(Object.assign({ status: err && err.status, name: n, message: err && err.message }, extra), eng);
}

// Text docs with students' names swapped for positions. PDFs go as they are (their text cannot be edited here).
// File names are swapped too ("Smith 1NC.docx" is a name the AI would see in the doc list).
const anonDocs = (docs) => docs.map((d) => ({ ...d, name: L.anonymize(d.name, R), data: d.kind === 'pdf' ? d.data : L.anonymize(d.data, R) }));
// One way to ask the AI for anything. schema = JSON Schema for a JSON reply, or null for plain text.
// kind = 'flow' | 'routine' | 'ballot' | 'decision': sets the output cap; ballot and decision use the mid-tier ("deep") model.
// docs = only the docs this call needs. The live flow sends one speech's docs; Live Eval, analysis, ballot and
// decision judge the whole round, so they keep the default (all of them).
// signal: an AbortSignal from a Stop button (spec 4.5). It is joined to each call's own timeout with AbortSignal.any.
// Where AbortSignal.any is missing, the call is not cut, but its late reply is thrown away (the caller sees 'stopped').
const STOPPED = () => Object.assign(new Error('Stopped.'), { kind: 'stopped' });
function withStop(signal, ms) {
  const t = AbortSignal.timeout(ms);
  if (!signal) return t;
  return typeof AbortSignal.any === 'function' ? AbortSignal.any([signal, t]) : t;
}
async function callAI({ system, prompt, note, schema, effort = 'medium', reading, kind = 'routine', docs = DOCS, signal }) {
  if (signal && signal.aborted) throw STOPPED();
  const eng = S.aiEngine;
  if (!aiReady()) throw Object.assign(new Error(L.NO_AI), { kind: 'noAI' });
  // Offline: show the offline text and make no call (spec 2.3).
  if (navigator.onLine === false) throw aiError({ online: false }, eng);
  const maxTokens = P.outputCap(kind);
  const purpose = kind === 'ballot' || kind === 'decision' ? 'deep' : 'ai';
  // Reading level: the same analysis, worded for an expert judge or in plain words.
  if (reading) system = system + '\n\n' + L.readingGuide(reading);
  // Students' names are swapped for positions (1A, 2N...) in everything typed or transcribed, and in text docs,
  // before it goes to the AI; names come back in the reply. PDFs are sent as they are (their text cannot be edited here).
  system = L.anonymize(system, R); prompt = L.anonymize(prompt, R);
  docs = anonDocs(docs);
  let text;
  // Every failure becomes one classified error (spec 2.3); errors that already have a kind pass through.
  try {
    if (eng === 'anthropic') {
      const client = await getClaude();
      const msg = await withModel('anthropic', purpose, (model) => {
        const params = P.claudeParams(model, {
          max_tokens: maxTokens, thinking: { type: 'adaptive' }, output_config: { effort },
          system, messages: [{ role: 'user', content: L.buildUserContent(docs, prompt, note) }],
        });
        if (schema) params.output_config.format = { type: 'json_schema', schema };
        return client.beta.messages.create(params, signal ? { signal } : undefined);
      });
      if (msg.stop_reason === 'refusal' || msg.stop_reason === 'max_tokens') throw aiError({ stop: msg.stop_reason }, eng);
      text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    } else if (P.SUBSCRIPTIONS[eng]) {
      // The subscription helper has no per-token bill, so it gets no output cap.
      const docText = P.docsAsText(docs, L.docTitle);
      const res = await fetch('/api/ai', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ engine: eng, system, prompt: (docText ? docText + '\n\n' + (note || L.DOC_NOTE) + '\n\n' : '') + prompt, schema, model: eng === 'codex-cli' ? (S.codexModel || '') : undefined }),
        signal: withStop(signal, 300000),
      });
      const j = await res.json().catch(() => ({}));
      // A helper 4xx or 5xx goes through the normal rules (401/403 = "rejected", 5xx = "busy"), named by the plan.
      // That can blame the plan when the helper itself failed; accepted for now (see L.classifyAIError).
      if (!res.ok) throw aiError({ status: res.status, message: j.error || 'the helper said ' + res.status, helper: true }, eng);
      text = j.text || '';
    } else {
      const res = await withModel(eng, purpose, (model) => {
        const req = P.buildAIRequest(eng, { key: keys[eng], model, system, prompt, docs, schema, title: L.docTitle, note: note || L.DOC_NOTE, maxTokens });
        return fetch(req.url, { ...req.init, signal: withStop(signal, 240000) });
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw httpAIError(res.status, j, eng);
      text = P.parseAIResponse(eng, j);
    }
    if (signal && signal.aborted) throw STOPPED(); // a late reply after Stop is thrown away
    return L.deanonymize(schema ? P.extractJson(text) : text, R);
  } catch (err) {
    if (signal && signal.aborted) throw STOPPED();
    throw asAIError(err, eng, P.SUBSCRIPTIONS[eng] ? { helper: true } : {});
  }
}

// ---------- connections UI ----------
const aOrAn = (w) => (/^[AEIOU]/i.test(w) ? 'an ' : 'a ') + w;
function capText(p) { return '<span class="cap">Does: <b>AI tools</b>' + (p.transcribe ? ' · <b>Transcription</b>' : ' · <i>no transcription</i>') + (p.pdf ? '' : ' · <i>reads text docs only, not PDFs</i>') + '</span>'; }
// Model picker for one provider: Auto (the cheap pick) or any chat model on the key, with premium ones marked.
function modelPicker(id) {
  const e = escapeHtml;
  const list = S.modelLists[id] || [];
  const auto = S.models[id] || {};
  const choice = S.modelChoice[id] || {};
  if (!list.length) return '<div class="cap" style="margin-top:4px">Click Test to load the list of models you can choose from.</div>';
  const sel = (purpose, label, autoId = auto[purpose] || P.pickModel(id, list, purpose)) => `<label class="model-pick">${label}
      <select data-model-pick="${id}" data-purpose="${purpose}">
        <option value="">Auto${autoId ? ': ' + e(autoId) : ''}</option>
        ${list.map((m) => `<option value="${e(m)}"${choice[purpose] === m ? ' selected' : ''}>${e(m)}${P.isPremium(m) ? ' (premium: costs much more)' : ''}</option>`).join('')}
      </select></label>`;
  return `<div class="row model-picks">${sel('ai', 'Routine (flow, Live Eval, analysis)')}${sel('deep', 'Ballot and decision')}</div>
    ${auto.transcribe ? `<div class="cap">Transcription: ${e(auto.transcribe)}</div>` : ''}`;
}
document.addEventListener('change', (ev) => {
  const t = ev.target.closest && ev.target.closest('[data-model-pick]'); if (!t) return;
  const id = t.dataset.modelPick, purpose = t.dataset.purpose;
  S.modelChoice[id] ??= {};
  if (t.value) S.modelChoice[id][purpose] = t.value; else delete S.modelChoice[id][purpose];
  saveSettings();
  if (P.isPremium(t.value)) toast('Premium models cost about 20 to 50 times more per round. Auto picks a cheaper model.');
});
function renderConnections() {
  const e = escapeHtml;
  $('#prov-list').innerHTML = Object.entries(P.PROVIDERS).map(([id, p]) => {
    const on = Boolean(keys[id]);
    const models = S.models[id] || {};
    return `<div class="prov">
      <div class="prov-head">
        <strong>${e(p.name)}</strong>
        <span class="pill ${on ? 'ok-pill' : ''}">${on ? (S.rememberKeys ? 'Connected' : 'Ready (this visit only)') : 'Not set up'}</span>
        ${capText(p)}
        <span class="grow"></span>
        ${on ? `<button class="b" data-prov-test="${id}">Test</button><button class="b" data-prov-del="${id}">Remove</button>` : ''}
      </div>
      ${on ? modelPicker(id) : ''}
      ${on ? '' : `<details style="margin-top:4px"><summary class="muted" style="cursor:pointer">How to get ${e(aOrAn(p.short))} key</summary>
        <ol>${p.steps.map((x) => '<li>' + e(x) + '</li>').join('')}</ol>
        <p class="muted" style="margin:var(--s2) 0 0">${e(p.cost)} <a href="${p.keyUrl}" target="_blank" rel="noopener">Open the ${e(p.short)} key page ↗</a></p></details>`}
    </div>`;
  }).join('');
  const opts = P.engineOptions(keys, S.helper);
  const aiSel = $('#ai-engine'), trSel = $('#tr-engine');
  aiSel.innerHTML = (opts.ai.length ? '' : '<option value="">Nothing connected yet</option>') + opts.ai.map((o) => `<option value="${o.id}">${e(o.label)}</option>`).join('');
  if (!opts.ai.some((o) => o.id === S.aiEngine)) S.aiEngine = opts.ai.length ? opts.ai[0].id : '';
  aiSel.value = S.aiEngine;
  trSel.innerHTML = opts.tr.map((o) => `<option value="${o.id}">${e(o.label)}</option>`).join('');
  if (!opts.tr.some((o) => o.id === S.trEngine)) S.trEngine = 'browser';
  trSel.value = S.trEngine;
  $('#remember-keys').checked = S.rememberKeys;
  renderSubscriptions();
  saveSettings();
  setTimeout(maybeD2Note, 0);
  aiChanged();
}
// Insights switches between its edge and the open pane with no reload when AI connects or goes (V9).
function aiChanged() { applyPanes(); renderInsights(); if (R.tab === 'eval') renderEvalStatus(); if (R.tab === 'analysis') renderAnalysis(); if (R.tab === 'ballot') renderDraftPanel(); }
async function connectKey(raw) {
  const key = String(raw || '').trim();
  const msg = $('#key-msg');
  const id = P.detectProvider(key);
  if (!key) { tone(msg, 'error'); msg.textContent = 'Paste a key first.'; return; }
  if (!id) { tone(msg, 'error'); msg.textContent = 'This does not look like a key from ' + Object.values(P.PROVIDERS).map((x) => x.short + ' (' + x.prefix + '…)').join(', ').replace(/, ([^,]*)$/, ' or $1') + '. Check that you copied all of it.'; return; }
  const p = P.PROVIDERS[id];
  tone(msg, 'quiet'); msg.textContent = 'Looks like ' + aOrAn(p.name) + ' key. Checking it…';
  $('#key-connect').disabled = true;
  try {
    const req = P.modelsRequest(id, key);
    let res;
    try { res = await fetch(req.url, { ...req.init, signal: AbortSignal.timeout(15000) }); }
    catch (err) { throw asAIError(err, id); }
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw httpAIError(res.status, j, id);
    const ids = P.modelIds(id, j);
    S.models[id] = { ai: P.pickModel(id, ids, 'ai') || undefined, deep: P.pickModel(id, ids, 'deep') || undefined };
    S.modelLists[id] = P.chatModels(id, ids);
    // Forget choices that are no longer on this key, so the picker and the calls agree.
    for (const [purpose, m] of Object.entries(S.modelChoice[id] || {})) if (!S.modelLists[id].includes(m)) delete S.modelChoice[id][purpose];
    if (p.transcribe && id !== 'google') S.models[id].transcribe = P.pickModel(id, ids, 'transcribe') || undefined;
    keys[id] = key; saveKeys();
    if (!aiReady()) S.aiEngine = id;
    if (S.trEngine === 'browser' && p.transcribe) S.trEngine = id;
    $('#key-paste').value = '';
    tone(msg, 'ok');
    msg.textContent = 'Connected ' + p.name + (p.transcribe ? ' — it can do AI tools and transcription.' : ' — it does AI tools. Transcription stays the free browser kind.');
    renderConnections(); setRecNote(''); setRecStatus();
    CQ.retryNow(); // clips paused for a missing or rejected key can go now
  } catch (err) {
    tone(msg, 'error');
    msg.textContent = 'Could not connect ' + p.name + '. ' + (err.message || err);
  } finally { $('#key-connect').disabled = false; }
}
$('#key-connect').addEventListener('click', () => connectKey($('#key-paste').value));
$('#key-paste').addEventListener('keydown', (e) => { if (e.key === 'Enter') connectKey($('#key-paste').value); });
$('#key-paste').addEventListener('input', (e) => {
  const id = P.detectProvider(e.target.value);
  const m = $('#key-msg'); tone(m, 'quiet');
  m.textContent = id ? 'Looks like ' + aOrAn(P.PROVIDERS[id].name) + ' key. Click Connect.' : '';
});
$('#prov-list').addEventListener('click', (e) => {
  const del = e.target.dataset.provDel, tst = e.target.dataset.provTest;
  if (del) removeKey(del);
  if (tst) connectKey(keys[tst]);
});
async function removeKey(id) {
  const name = P.PROVIDERS[id].short;
  const ok = await ask({
    title: 'Remove the ' + name + ' key?',
    body: 'Tabula forgets this key on this computer. To use ' + name + ' again, paste the key again.',
    buttons: [{ label: 'Cancel', value: false, kind: 'plain' }, { label: 'Remove key', value: true, kind: 'danger' }], cancelValue: false,
  });
  if (!ok) return;
  delete keys[id]; delete S.models[id]; delete S.modelChoice[id]; delete S.modelLists[id]; saveKeys(); renderConnections(); setRecNote('');
}
$('#ai-engine').addEventListener('change', (e) => { S.aiEngine = e.target.value; subShown = ''; saveSettings(); renderSubscriptions(); aiChanged(); });
$('#tr-engine').addEventListener('change', (e) => { S.trEngine = e.target.value; saveSettings(); setRecNote(''); });
$('#remember-keys').addEventListener('change', (e) => {
  S.rememberKeys = e.target.checked; saveKeys(); saveSettings(); renderConnections();
  if (Object.keys(keys).length) toast(S.rememberKeys ? 'Key saved on this computer.' : 'Keys removed from this computer. They work until you close this tab.');
});

// Subscriptions: the local helper (bridge.mjs) runs the Claude Code or Codex app already signed in on this Mac.
// The helper runs from the folder Tabula was downloaded to, so the command is relative to that folder.
const HELPER_CMD = 'node bridge.mjs';

async function checkHelper() {
  subShown = ''; // show what is true now, not an old click
  // The helper only exists on the judge's own computer. On the hosted site there is nothing to ask.
  if (!LOCAL_ORIGIN) { S.helper = {}; renderConnections(); return; }
  try {
    const r = await fetch('/api/health', { signal: AbortSignal.timeout(3000) });
    const j = r.ok ? await r.json() : {};
    S.helper = { 'claude-cli': Boolean(j.claude), 'codex-cli': Boolean(j.codex) };
  } catch { S.helper = {}; }
  renderConnections();
}
// "Use your AI subscription": a ChatGPT button and a Claude button. A button that is ready (the local helper
// found the signed-in app) switches the AI tools to it; one that is not ready shows the steps for that app only.
let subShown = '';
function renderSubscriptions() {
  const h = S.helper || {};
  document.querySelectorAll('.sub-btn').forEach((b) => {
    b.setAttribute('aria-pressed', String(S.aiEngine === b.dataset.sub));
    b.disabled = !LOCAL_ORIGIN;
  });
  const body = $('#sub-body');
  if (!LOCAL_ORIGIN) { body.innerHTML = '<p style="margin:0">Subscriptions work only in the downloadable version of Tabula, through a small helper on your computer. On this website, connect an API key above.</p>'; return; }
  const id = subShown || (P.SUBSCRIPTIONS[S.aiEngine] ? S.aiEngine : '');
  if (!id) { body.innerHTML = ''; return; }
  // The app and plan names come from providers.js; they show only in this Settings section (copy rules, spec 4.5).
  const s = P.SUBSCRIPTIONS[id], app = escapeHtml(s.via), plan = escapeHtml(s.plan);
  if (h[id]) {
    body.innerHTML = `<p style="margin:0">${S.aiEngine === id ? '<b>In use:</b> ' : ''}your ${plan} plan, through the ${app} app on this computer. Each answer takes 10–30 s. PDFs are not read on this path; save docs as .docx or text. Transcription stays separate.</p>`
      + (id === 'codex-cli' ? `<div style="margin-top:var(--s2)"><label for="codex-model">Model (optional; leave empty to use your ${app} setting)</label><input id="codex-model" value="${escapeHtml(S.codexModel || '')}" placeholder="a model your ${plan} plan includes"></div>` : '');
    return;
  }
  body.innerHTML = `<ol style="margin:0;padding-left:20px">
      <li>Install the ${app} app and sign in once in Terminal: <code>${escapeHtml(s.cmd)}</code></li>
      <li>Start Tabula with its helper: <code>${escapeHtml(HELPER_CMD)}</code> (in the Tabula folder) <button class="b small" id="copy-helper">Copy</button></li>
      <li>Open <code>http://localhost:8765</code> again, then <button class="b small" id="recheck-helper">Check again</button></li></ol>`;
}
document.addEventListener('click', (e) => {
  const b = e.target.closest && e.target.closest('.sub-btn'); if (!b) return;
  const id = b.dataset.sub;
  subShown = id;
  if ((S.helper || {})[id]) { S.aiEngine = id; saveSettings(); renderConnections(); toast('AI tools now use your ' + P.SUBSCRIPTIONS[id].plan + ' plan.'); }
  else renderSubscriptions();
});
document.addEventListener('change', (e) => { if (e.target.id === 'codex-model') { S.codexModel = e.target.value.trim(); saveSettings(); } });
document.addEventListener('click', (e) => {
  if (e.target.id === 'copy-helper') copyToast(HELPER_CMD);
  if (e.target.id === 'recheck-helper') checkHelper();
});

// ---------- audio settings ----------
// Existing users were on Zoom-style settings, so they keep them; new users start "in the room".
S.audioMode ??= S.setupDone ? 'zoom' : 'room';
function renderAudio() {
  document.querySelectorAll('[data-audio]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.audio === S.audioMode)));
  $('#audio-mode-help').textContent = S.audioMode === 'zoom'
    ? 'For rounds you hear through your speakers (Zoom, Meet). Filters are off, so the speaker sound is not muted. Do not wear headphones.'
    : 'For rounds in a classroom. The browser removes echo and room hum and evens out loud and soft voices.';
}
async function listMics() {
  const sel = $('#mic-pick');
  let devices = [];
  try { devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput'); } catch {}
  const named = devices.some((d) => d.label);
  sel.innerHTML = '<option value="">Default microphone</option>' + devices.filter((d) => d.deviceId && d.deviceId !== 'default')
    .map((d, i) => `<option value="${escapeHtml(d.deviceId)}">${escapeHtml(d.label || 'Microphone ' + (i + 1))}</option>`).join('');
  if (!named && devices.length) sel.insertAdjacentHTML('beforeend', '<option disabled>Run the mic test once to see the names</option>');
  const named2 = devices.some((d) => d.label); // ids are only stable once the mic is allowed
  if (S.micId && named2 && !devices.some((d) => d.deviceId === S.micId)) { S.micId = ''; saveSettings(); }
  sel.value = devices.some((d) => d.deviceId === S.micId) ? S.micId : '';
}
document.addEventListener('click', (e) => {
  const b = e.target.closest && e.target.closest('[data-audio]'); if (!b) return;
  S.audioMode = b.dataset.audio; saveSettings(); renderAudio();
  if (recWanted) toast('The new audio mode starts with the next speech.');
});
$('#mic-pick').addEventListener('change', (e) => { S.micId = e.target.value; saveSettings(); if (recWanted) toast('The new microphone starts with the next speech.'); });
$('#mic-refresh').addEventListener('click', listMics);
if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) navigator.mediaDevices.addEventListener('devicechange', listMics);
// 5-second mic test: listen, show the level, then say in plain words whether it is good enough.
let testing = false, testAbort = false;
$('#mic-test').addEventListener('click', async () => {
  if (testing) return;
  if (recWanted) return toast('Pause the speech clock first. The mic is in use.');
  testing = true;
  const btn = $('#mic-test'), out = $('#mic-test-result'), meter = $('#test-meter');
  btn.disabled = true; tone(out, 'quiet'); out.textContent = 'Listening… talk normally from where the speaker stands.';
  let stream, ctx;
  const samples = [];
  try {
    stream = await openMic();
    ctx = new AudioContext();
    const an = ctx.createAnalyser(); an.fftSize = 2048;
    ctx.createMediaStreamSource(stream).connect(an);
    const buf = new Float32Array(an.fftSize);
    meter.hidden = false;
    const t0 = performance.now();
    await new Promise((resolve) => {
      // A timer, not animation frames, so the test still ends if the tab is in the background.
      const iv = setInterval(() => {
        an.getFloatTimeDomainData(buf);
        const r = L.rms(buf); samples.push(r);
        const info = L.levelInfo(r);
        meter.firstElementChild.style.width = info.pct + '%'; meter.dataset.level = info.level;
        if (testAbort || performance.now() - t0 >= 5000) { clearInterval(iv); resolve(); }
      }, 100);
    });
    if (testAbort) { tone(out, 'quiet'); out.textContent = 'Mic test stopped because a speech started.'; }
    else {
      const v = L.micTestVerdict(samples);
      tone(out, v.ok ? 'ok' : 'caution');
      out.textContent = v.text;
    }
    listMics(); // names show up once the mic has been allowed
  } catch (err) {
    tone(out, 'error');
    out.textContent = 'Mic test failed: ' + (err && err.name === 'NotAllowedError' ? 'the microphone is blocked. Click the mic icon in the address bar and allow it.' : (err && err.message) || err);
  } finally {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    if (ctx) ctx.close().catch(() => {});
    meter.hidden = true; btn.disabled = false; testing = false; testAbort = false;
  }
});

// ---------- guided tours ----------
// A dimmed screen with one part lit up and a short card beside it. Next/Back/Skip, arrow keys, Esc.
const TOURS = window.Tours;
let tourState = null; // { name, i, returnFocus, place, hideLeft, hideRight }
function tourStart(name) {
  if (name === 'page') name = TOURS.PLACE_TOUR[PLACE_OF[R.tab] || 'setup'] || 'main';
  const tour = TOURS.TOURS[name]; if (!tour) return;
  if (askIsOpen() || !$('#node-editor').hidden) return; // never on top of another dialog
  closeHelpMenu(); $('#tour-offer').hidden = true;
  // Remember where the judge was and how the panes were, so the tour leaves everything as it found it.
  tourState = { name, i: 0, returnFocus: document.activeElement, place: R.tab, hideLeft: Boolean(S.hideLeft), hideRight: Boolean(S.hideRight) };
  $('#tour').hidden = false;
  for (const el of document.querySelectorAll('header, main, .roundbar')) el.inert = true; // the page behind is not reachable
  tourShow();
}
function tourShow() {
  const tour = TOURS.TOURS[tourState.name];
  const step = tour.steps[tourState.i];
  if (step.place) showTab(step.place);
  // A step inside a hidden pane opens that pane.
  if (step.target === '#speech-list' || step.target === '#tab-timer') {
    if (isOverlay()) { if (!leftOpen) { leftOpen = true; applyPanes(); } } // below 1440 px the pane is an overlay
    else if (S.hideLeft) { S.hideLeft = false; applyPanes(); }
  } else if (leftOpen) { leftOpen = false; applyPanes(); }
  if (step.target === '#insights' && S.hideRight) { S.hideRight = false; applyPanes(); }
  $('#tour-count').textContent = tour.title + ' · ' + (tourState.i + 1) + ' of ' + tour.steps.length;
  $('#tour-dots').innerHTML = tour.steps.map((_, k) => '<i class="' + (k === tourState.i ? 'on' : k < tourState.i ? 'done' : '') + '"></i>').join('');
  $('#tour-title').textContent = step.title;
  $('#tour-body').textContent = step.body;
  $('#tour-back').disabled = tourState.i === 0;
  $('#tour-next').textContent = tourState.i === tour.steps.length - 1 ? 'Done' : 'Next';
  const el = document.querySelector(step.target);
  if (el && el.scrollIntoView && !el.closest('.roundbar') && !el.closest('header')) el.scrollIntoView({ block: 'center', behavior: 'instant' });
  setTimeout(() => { tourPlace(); $('#tour-next').focus(); }, 0); // a plain timer: animation frames pause in background tabs
}
function tourPlace() {
  if (!tourState) return;
  const step = TOURS.TOURS[tourState.name].steps[tourState.i];
  const el = document.querySelector(step.target);
  const spot = $('#tour-spot'), card = $('#tour-card');
  const view = { w: innerWidth, h: innerHeight };
  let r = el ? el.getBoundingClientRect() : null;
  if (!r || (!r.width && !r.height)) r = { top: view.h / 2, left: view.w / 2, width: 0, height: 0 };
  const pad = 6;
  const box = { top: Math.max(4, r.top - pad), left: Math.max(4, r.left - pad), width: Math.min(r.width + pad * 2, view.w - 8), height: Math.min(r.height + pad * 2, view.h - 8) };
  Object.assign(spot.style, { top: box.top + 'px', left: box.left + 'px', width: box.width + 'px', height: box.height + 'px' });
  const pos = TOURS.placeCard(box, { w: card.offsetWidth, h: card.offsetHeight }, view);
  card.style.top = pos.top + 'px'; card.style.left = pos.left + 'px';
}
function tourEnd(finished) {
  if (!tourState) return;
  const st = tourState; tourState = null;
  $('#tour').hidden = true;
  for (const el of document.querySelectorAll('header, main, .roundbar')) el.inert = false;
  S.hideLeft = st.hideLeft; S.hideRight = st.hideRight; leftOpen = false; applyPanes();
  if (st.name === 'main') S.tourDone = true;
  saveSettings();
  if (st.place) showTab(st.place); // back to where the judge was
  if (st.returnFocus && st.returnFocus.focus) st.returnFocus.focus();
}
function tourGo(d) {
  const steps = TOURS.TOURS[tourState.name].steps, n = steps.length;
  let i = tourState.i + d;
  // With no AI, Insights is folded to its "Connect AI" edge, so its step has nothing to show: skip it (V9).
  while (i >= 0 && i < n && steps[i].target === '#insights' && insightsMode() === 'edge-connect') i += d;
  if (i >= n) return tourEnd(true);
  if (i < 0) return;
  tourState.i = i; tourShow();
}
$('#tour-next').addEventListener('click', () => tourGo(1));
$('#tour-back').addEventListener('click', () => tourGo(-1));
$('#tour-skip').addEventListener('click', () => tourEnd(false));
addEventListener('resize', () => { if (tourState) tourPlace(); });
// Keep the light on its target when anything scrolls.
let tourScrollT = null;
addEventListener('scroll', () => { if (tourState && !tourScrollT) tourScrollT = setTimeout(() => { tourScrollT = null; tourPlace(); }, 50); }, true);
document.addEventListener('keydown', (e) => {
  if (!tourState) return;
  if (e.key === 'ArrowRight') { e.preventDefault(); e.stopImmediatePropagation(); tourGo(1); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopImmediatePropagation(); tourGo(-1); }
  else if (e.key === 'Tab') { // keep focus inside the tour card
    const f = [...$('#tour-card').querySelectorAll('button:not([disabled])')];
    const i = f.indexOf(document.activeElement);
    e.preventDefault(); f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
  }
}, true);
escLayer('tour', 100, () => Boolean(tourState), () => tourEnd(false)); // Esc ends the tour
// The ? menu
function closeHelpMenu() { $('#help-menu').hidden = true; $('#help-btn').setAttribute('aria-expanded', 'false'); }
$('#help-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  const open = $('#help-menu').hidden;
  $('#help-menu').hidden = !open; $('#help-btn').setAttribute('aria-expanded', String(open));
  if (open) $('#help-menu button').focus();
});
$('#help-menu').addEventListener('click', (e) => { const b = e.target.closest('[data-tour]'); if (b) tourStart(b.dataset.tour); });
document.addEventListener('click', (e) => { if (!$('#help-menu').hidden && !e.target.closest('.help-wrap')) closeHelpMenu(); });
escLayer('help-menu', 60, () => !$('#help-menu').hidden, () => { closeHelpMenu(); $('#help-btn').focus(); });
// The gentle offer after the welcome screen (never on top of a dialog).
function offerTour() { if (!S.tourDone && !S.tourOffered) { S.tourOffered = true; saveSettings(); $('#tour-offer').hidden = false; } }
$('#tour-offer-go').addEventListener('click', () => tourStart('main'));
$('#tour-offer-no').addEventListener('click', () => { $('#tour-offer').hidden = true; toast('You can take the tour any time from the ? menu.'); });

// ---------- welcome (spec 2.1, Q11): free users only, built on the shared dialog ask() ----------
// Paid-plan users (2.8, not built yet) never see it: hosted AI just works.
const hostedPlan = L.hasHostedPlan();
if (hostedPlan && !S.setupDone) { S.setupDone = true; saveSettings(); }
$('#show-welcome').hidden = hostedPlan;
async function openWelcome() {
  const choices = [{ label: 'Connect an AI key', desc: 'Paste a key from any AI provider. Step-by-step help is included.', value: 'key' }];
  if (LOCAL_ORIGIN) choices.push({ label: 'Use an AI app you pay for', desc: 'Uses an AI app you already pay for on this computer. Needs one Terminal command.', value: 'sub' });
  choices.push({ label: 'Start without AI', desc: 'You can connect AI later in Settings.', value: 'skip' });
  // × or Esc means "Start without AI" without the skip page. A click on the dim layer does nothing.
  const v = await ask({ title: 'Welcome to Tabula', body: 'The clock, flow and ballot work without AI. AI can add a transcript, an AI flow and feedback.', buttons: choices, variant: 'choices', backdrop: false, cancelValue: 'none' });
  if (v === 'skip') {
    const go = await ask({
      title: 'Start without AI',
      body: ['You get the clock, prep timers, flow sheets and the ballot.', 'To add AI later, open Settings (the gear button).'],
      buttons: [{ label: 'Back', value: 'back', kind: 'plain' }, { label: 'Start flowing', value: 'go', kind: 'primary' }], cancelValue: 'back',
    });
    return go === 'go' ? startWithoutAI() : openWelcome();
  }
  if (v !== 'key' && v !== 'sub') return startWithoutAI();
  S.setupDone = true; saveSettings(); showTab('ai'); setTimeout(offerTour, 400);
  if (v === 'key') setTimeout(() => $('#key-paste').focus(), 0);
  else setTimeout(() => { $('#sub-box').scrollIntoView({ block: 'center' }); const btn = $('#sub-box .sub-btn:not([disabled])'); if (btn) btn.focus(); }, 0);
}
function startWithoutAI() {
  S.setupDone = true; S.aiSkipped = true; saveSettings();
  showTab('flow'); setTimeout(offerTour, 400);
}
$('#show-welcome').addEventListener('click', () => openWelcome());

$('#chunk-sec').value = S.chunkSec; $('#live-flow').checked = S.liveFlow;
$('#chunk-sec').addEventListener('change', (e) => { S.chunkSec = Math.max(4, Math.min(30, Number(e.target.value) || 8)); e.target.value = S.chunkSec; saveSettings(); setRecNote(''); });
$('#live-flow').addEventListener('change', (e) => { S.liveFlow = e.target.checked; saveSettings(); setRecNote(''); });
// The one-time note (spec 2.7, Q-2, Q-4): the first time AI is ready, say that the paid live updates are off and
// where to turn them on. It waits while a clock runs, so it never covers the round.
let booted = false;
async function maybeD2Note() {
  if (!booted || !L.needsD2Note({ aiReady: aiReady(), shown: S.d2NoteShown, clockRunning: Boolean(R.run) })) return;
  S.d2NoteShown = true; saveSettings();
  const v = await ask({
    title: 'Live updates are off',
    body: ['Live Eval and Live AI flow can update during the round. They are off, because each update is a paid AI call.', 'Turn Live Eval on in Decide → Live Eval. Turn Live AI flow on in Settings.'],
    buttons: [{ label: 'Keep them off', value: 'off', kind: 'plain' }, { label: 'Turn on Live AI flow', value: 'flow', kind: 'plain' }, { label: 'Turn on Live Eval', value: 'eval', kind: 'plain' }],
    cancelValue: 'off', focus: 'off',
  });
  if (v === 'eval') { S.autoEval = true; $('#auto-eval').checked = true; saveSettings(); toast('Live Eval now updates after each speech. Each update is one AI call.'); }
  if (v === 'flow') { S.liveFlow = true; $('#live-flow').checked = true; saveSettings(); setRecNote(''); toast('Live AI flow is on. It makes one AI call about every 30 s during a speech.'); }
}
setRecNote('');

// ---------- live eval ----------
let evalBusy = false, evalAgain = false, evalErr = '', evalSoonTimer = null;
// Auto updates wait 20 s after the last flow pass, so mapping several docs at once costs one eval, not one each.
// Offline, the automatic update waits and runs when the internet is back, but only if Live Eval is still on (D2).
let evalWaitsOnline = false;
function scheduleEvalSoon() {
  clearTimeout(evalSoonTimer);
  evalSoonTimer = setTimeout(() => { if (!S.autoEval) return; if (navigator.onLine === false) { evalWaitsOnline = true; return; } scheduleEval(); }, 20000);
}
function scheduleEval() {
  if (!aiReady() || resetting) return;
  if (evalBusy) { evalAgain = true; return; }
  runEval();
}
async function runEval() {
  const level = lvl();
  evalBusy = true; evalErr = ''; renderEvalStatus();
  try {
    const data = await callAI({ system: L.EVAL_SYSTEM, prompt: L.buildEvalPrompt(R, DOCS), schema: L.EVAL_SCHEMA, effort: 'medium', reading: level });
    if (resetting) return;
    LV(level).liveEval = { data, at: Date.now(), through: L.speechesSoFar(R) };
    save();
    if (R.tab === 'eval') renderEval();
  } catch (err) {
    evalErr = (err && err.message) || String(err) || 'unknown error';
    console.warn('Live eval failed:', err);
    if (R.tab !== 'eval') toast(L.AI_ERROR_PREFIX.eval + ' ' + evalErr);
  } finally {
    evalBusy = false; renderEvalStatus(); renderInsights();
    if (evalAgain && !resetting) { evalAgain = false; runEval(); }
  }
}
// Live Eval states (spec 4.13): Run when nothing is saved, Update when something is. Status colour comes from classes.
function renderEvalStatus() {
  const el = $('#eval-status'); if (!el) return;
  const ev = LV().liveEval;
  const go = $('#eval-go');
  go.textContent = L.runVerb(Boolean(ev));
  const empty = !L.roundHasContent(R, DOCS);
  go.disabled = evalBusy || !aiReady() || empty;
  tone(el);
  if (evalBusy) el.innerHTML = busyHtml('Updating… usually 20–60 seconds');
  else if (!aiReady()) el.innerHTML = noAiHtml('', 'Connect AI');
  else if (empty && !ev) el.innerHTML = '<span class="is-quiet">Nothing to read yet. Start the 1AC first.</span>';
  else if (evalErr) { tone(el, errColor(evalErr)); el.textContent = L.AI_ERROR_PREFIX.eval + ' ' + evalErr; }
  else el.textContent = '';
  const stale = ev ? L.outOfDateText(ev.through, R) : '';
  $('#eval-meta').innerHTML = ev ? escapeHtml('Last updated ' + agoText(ev.at) + ', through ' + ((ev.through || []).length ? ev.through[ev.through.length - 1] : 'no speeches') + '.')
    + (stale ? ' <span class="pill is-caution">' + escapeHtml(stale) + '</span>' : '') : '';
}
setInterval(() => { if (R.tab === 'eval') renderEvalStatus(); }, 5000);
const sideClass = (x) => (x === 'aff' ? 'aff' : x === 'neg' ? 'neg' : '');
const sideLabel = (x) => ({ aff: 'Aff', neg: 'Neg', even: 'Even', unclear: 'Unclear', 'toss-up': 'Toss-up' }[x] || x);
// The small Live Eval summary in the Flow workspace (V9). With no AI the pane is folded to its edge, so it stays empty.
// States: empty ("No read of the round yet."), loading ("Updating…"), error (the aiErrorText line and Try again),
// offline (the offline line; Update is off and the line says why).
function renderInsights() {
  const box = document.getElementById('insights-body'); if (!box) return;
  if (!aiReady()) { box.textContent = ''; return; }
  const e = escapeHtml;
  const entry = LV().liveEval, ev = entry && entry.data;
  const offline = navigator.onLine === false;
  let msg = '';
  if (evalBusy) msg = busyHtml('Updating…');
  else if (offline) msg = '<span class="is-quiet">' + e(L.aiErrorText('offline')) + '</span>';
  else if (evalErr) msg = '<span class="is-error">' + e(evalErr) + '</span>';
  const why = evalBusy || offline ? ' aria-describedby="ins-msg"' : '';
  const action = evalErr && !evalBusy && !offline
    ? '<button class="b small" id="ins-update">Try again</button>'
    : `<button class="b small" id="ins-update"${evalBusy || offline ? ' disabled' : ''}${why}>${ev ? 'Update' : 'Update (one AI call)'}</button>`;
  const open = '<button class="b small" data-tab-go="eval">Open Live Eval</button>';
  const status = msg ? `<p class="ins-msg" id="ins-msg">${msg}</p>` : '';
  if (!ev) {
    box.innerHTML = (status || '<p class="muted ins-msg">No read of the round yet.</p>') + `<div class="row">${action}${open}</div>`;
    return;
  }
  const lean = ev.leaning || {};
  box.innerHTML = `<div class="ins-lean ${sideClass(lean.side)}">Leaning ${e(sideLabel(lean.side))}${lean.side === 'aff' && R.aff.team ? ' (' + e(R.aff.team) + ')' : lean.side === 'neg' && R.neg.team ? ' (' + e(R.neg.team) + ')' : ''}</div>
    <p class="muted ins-meta">${e(lean.confidence || '')} confidence · ${e(agoText(entry.at))}</p>
    <p class="ins-why">${e(lean.why || '')}</p>
    <h3 class="ins-h">Listen for next</h3>
    <ul class="ins-list">${(ev.watch_for || []).slice(0, 4).map((w) => '<li>' + e(w) + '</li>').join('')}</ul>
    ${status}<div class="row mt-3">${action}${open}</div>`;
}
addEventListener('online', () => renderInsights());
addEventListener('offline', () => renderInsights());
document.addEventListener('click', (e) => {
  if (e.target.id === 'ins-update') { scheduleEval(); setTimeout(renderInsights, 0); }
  const go = e.target.closest && e.target.closest('[data-tab-go]');
  if (go) showTab(go.dataset.tabGo);
});
function renderEval() {
  renderEvalStatus();
  const ev = LV().liveEval && LV().liveEval.data;
  if (!ev) { $('#eval-body').innerHTML = ''; return; }
  const e = escapeHtml;
  const lean = ev.leaning || {};
  const team = lean.side === 'aff' ? R.aff.team : lean.side === 'neg' ? R.neg.team : '';
  const issues = ev.key_issues || [];
  const tally = L.issueTally(issues);
  const total = Math.max(1, tally.aff + tally.even + tally.neg);
  // The paired bar: Aff on the left, Even in the middle, Neg on the right. The words carry the meaning, not the colours.
  const bar = `<div class="tally" role="img" aria-label="${e(tally.text)}"><div class="tally-bar" aria-hidden="true">`
    + [['aff', tally.aff], ['even', tally.even], ['neg', tally.neg]].filter(([, n]) => n).map(([k, n]) => `<span class="tally-${k}" data-w="${Math.round((n / total) * 100)}"></span>`).join('')
    + `</div><p class="tally-text">${e(tally.text)}</p></div>`;
  const fb = (ev.feedback || []).map((f) => `<div class="card fb-card">
      <div class="row fb-head"><strong class="${String(f.speaker || '').endsWith('A') ? 'aff' : 'neg'}">${e(f.speaker)} ${e(nameOf(f.speaker) !== f.speaker ? '· ' + nameOf(f.speaker) : '')}</strong><span class="muted">Points so far: ${e(f.points)}</span></div>
      <p class="fb-line">${e(f.so_far)}</p>
      <p class="fb-line"><span class="fb-label">Did well:</span> ${e(f.strength)}</p>
      <p class="fb-line"><span class="fb-label">To work on:</span> ${e(f.fix)}</p></div>`).join('');
  $('#eval-body').innerHTML = `
    <div class="card">
      <div class="lean ${sideClass(lean.side)}">Leaning: ${e(sideLabel(lean.side))}${team ? ' (' + e(team) + ')' : ''} <span class="pill">${e(lean.confidence || '')} confidence</span></div>
      <p class="card-text">${e(lean.why || '')}</p>
    </div>
    <div class="card"><h2>State of the round</h2><p class="card-text">${e(ev.summary || '')}</p></div>
    <div class="card"><h2>Key issues</h2>${issues.length ? bar : ''}<div class="scroll"><table>
      <thead><tr><th>Issue</th><th>Ahead</th><th>Why</th></tr></thead>
      <tbody>${issues.map((k) => `<tr><td>${e(k.issue)}</td><td><span class="pill ${sideClass(k.ahead)}">${e(sideLabel(k.ahead))}</span></td><td>${e(k.note)}</td></tr>`).join('')}</tbody>
    </table></div></div>
    <div class="card"><h2>Listen for next</h2><ul class="plain-list">${(ev.watch_for || []).map((w) => '<li>' + e(w) + '</li>').join('')}</ul></div>
    <div class="grid">
      <div class="card"><h2 class="aff">Aff needs to</h2><p class="card-text">${e(ev.aff_needs || '')}</p></div>
      <div class="card"><h2 class="neg">Neg needs to</h2><p class="card-text">${e(ev.neg_needs || '')}</p></div>
    </div>
    <div class="card"><div class="row card-head"><h2>Feedback so far</h2><button class="b" id="eval-to-ballot" type="button">Use this feedback on the ballot</button></div>
      <div class="grid fb-grid">${fb}</div></div>`;
  // Widths come from data-w through a class-free style property (no inline style attribute in the markup).
  document.querySelectorAll('#eval-body .tally-bar span').forEach((el) => el.style.setProperty('--w', el.dataset.w + '%'));
}
$('#eval-go').addEventListener('click', () => {
  if (!aiReady()) return toast(L.NO_AI);
  scheduleEval();
});
$('#auto-eval').checked = S.autoEval; // off unless the judge turned it on (spec 2.7, D2)
$('#auto-eval').addEventListener('change', (e) => { S.autoEval = e.target.checked; saveSettings(); });
// "Use this feedback on the ballot" opens the draft panel with the feedback option on (spec 4.13). No AI call here.
document.addEventListener('click', (e) => {
  if (e.target.id !== 'eval-to-ballot') return;
  draftUi.feedback = true;
  showTab('ballot'); openDraftPanel(e.target);
});

// ---------- analysis: paradigm lens, impact calculus, round map ----------
// Results are cached in R.analysis and only recomputed when the judge clicks a button.
R.analysis ??= { lens: {}, impacts: null, map: null };
R.analysis.lens ??= {};
R.ai.customParadigm = S.customParadigm || R.ai.customParadigm || '';
const busy = { lens: false, impacts: false, map: false };
const errs = { lens: '', impacts: '', map: '' };

async function askClaude(task, schema, opts) {
  return callAI({ system: L.ANALYSIS_SYSTEM, prompt: L.buildAnalysisPrompt(R, DOCS, task, opts), schema, effort: 'medium', reading: schema === L.MAP_SCHEMA ? null : lvl() });
}
async function runTool(name, task, schema, opts, store) {
  if (!aiReady()) return toast(L.NO_AI);
  if (busy[name]) return toast('Still working on the last one. Try again when it finishes.');
  busy[name] = true; errs[name] = ''; renderAnalysis();
  try {
    const data = await askClaude(task, schema, opts);
    if (resetting) return;
    store({ data, at: Date.now(), through: L.speechesSoFar(R) });
    save();
  } catch (err) {
    errs[name] = (err && err.message) || String(err) || 'unknown error';
    console.warn(name + ' failed:', err);
  } finally {
    busy[name] = false;
    if (R.tab === 'analysis') renderAnalysis();
  }
}
function cacheNote(entry) {
  if (!entry) return '';
  const now = L.speechesSoFar(R);
  const newer = now.filter((id) => !(entry.through || []).includes(id));
  return '<span class="muted">Saved ' + agoText(entry.at) + ', through ' + escapeHtml((entry.through || []).slice(-1)[0] || 'no speeches') + '.</span>'
    + (newer.length ? ' <span class="pill is-caution">' + escapeHtml(L.outOfDateText(entry.through, R)) + ' Click Update.</span>' : '');
}
function statusLine(el, name, entry, idle) {
  if (busy[name]) { tone(el); el.innerHTML = busyHtml('Working… usually 20–60 seconds'); }
  else if (!aiReady()) { tone(el); el.innerHTML = noAiHtml('', 'Connect AI'); }
  else if (errs[name]) { tone(el, errColor(errs[name])); el.textContent = L.AI_ERROR_PREFIX.analysis + ' ' + errs[name]; }
  else { tone(el); el.innerHTML = entry ? cacheNote(entry) : '<span class="muted">' + idle + '</span>'; }
}
function currentLensKey() { return L.lensKey($('#lens-pick').value, S.customParadigm) + (lvl() === 'expert' ? '' : '|' + lvl()); }
function renderLensPicker() {
  const sel = $('#lens-pick');
  const cur = sel.value || R.lensPick || R.ai.paradigm || 'policymaker';
  sel.innerHTML = Object.keys(L.PARADIGM_LABELS).map((k) => {
    const has = R.analysis.lens[L.lensKey(k, S.customParadigm) + (lvl() === 'expert' ? '' : '|' + lvl())] ? ' (saved)' : '';
    const yours = k === (R.ai.paradigm || 'policymaker') ? ' (yours)' : ''; // the paradigm set in Settings (spec 4.9)
    return `<option value="${k}">${escapeHtml(L.PARADIGM_LABELS[k])}${yours}${has}</option>`;
  }).join('');
  sel.value = cur;
}
// "Round at a glance" (spec 4.14): prep used and the key moments from the Round Map. No AI call.
function renderGlance() {
  const e = escapeHtml;
  const p = L.prepUsed(R);
  $('#glance-prep').innerHTML = p.any ? `<p class="glance-line"><span class="aff">${e(p.aff.text)}</span></p><p class="glance-line"><span class="neg">${e(p.neg.text)}</span></p>` : '<p class="muted glance-line">No prep used yet.</p>';
  const km = L.keyMoments(R.analysis.map && R.analysis.map.data);
  $('#glance-moments').innerHTML = km.length
    ? '<ul class="plain-list">' + km.map((k) => `<li><span class="${sideClass(k.side)}">${e(k.speech)}</span> ${e(k.label)} <span class="chip ${k.status === 'dropped' ? 'drop' : 'con'}">${k.status === 'dropped' ? 'Dropped' : 'Conceded'}</span></li>`).join('') + '</ul>'
    : '<p class="muted glance-line">' + (R.analysis.map && R.analysis.map.data && R.analysis.map.data.nodes.length ? 'No dropped or conceded arguments on the Round Map.' : 'Key moments show here after you run the Round Map.') + '</p>';
}
function renderAnalysis() {
  const e = escapeHtml;
  renderGlance();
  renderLensPicker();
  // Never overwrite the paradigm box while the judge is typing in it.
  if (document.activeElement !== $('#lens-custom')) $('#lens-custom').value = S.customParadigm || '';
  if ($('#lens-pick').value === 'custom') $('#lens-custom-box').open = true;
  // Lens
  const lens = R.analysis.lens[currentLensKey()];
  $('#lens-go').textContent = L.runVerb(Boolean(lens));
  $('#lens-go').disabled = busy.lens;
  statusLine($('#lens-status'), 'lens', lens, 'Not weighed under this paradigm yet. Click Run.');
  if ($('#lens-pick').value === 'custom' && !(S.customParadigm || '').trim()) $('#lens-status').innerHTML = '<span class="is-caution">Paste your paradigm below first.</span>';
  const d = lens && lens.data;
  $('#lens-out').innerHTML = d ? `
    <div class="lean ${sideClass(d.winner)}">${e(sideLabel(d.winner))}${d.winner === 'aff' && R.aff.team ? ' (' + e(R.aff.team) + ')' : d.winner === 'neg' && R.neg.team ? ' (' + e(R.neg.team) + ')' : ''} <span class="pill">${e(d.confidence)} confidence</span></div>
    <p>${e(d.rfd)}</p>
    <h2 class="sub-h">What decides it here</h2><ul class="plain-list">${(d.deciding_factors || []).map((x) => '<li>' + e(x) + '</li>').join('')}</ul>
    <h2 class="sub-h">How this paradigm changes the call</h2><p class="card-text">${e(d.lens_effect)}</p>` : '';
  // Impacts
  const imp = LV().impacts;
  $('#impact-go').disabled = busy.impacts;
  $('#impact-go').textContent = L.runVerb(Boolean(imp));
  statusLine($('#impact-status'), 'impacts', imp, 'Not run yet. Click Run.');
  const id = imp && imp.data;
  $('#impact-out').innerHTML = id ? `
    <div class="lean small ${sideClass(id.net)}">Net: ${e(sideLabel(id.net))} outweighs</div>
    <div class="mt-2"><table class="impact-table">
      <thead><tr><th>Impact</th><th>Side</th><th>Magnitude</th><th>Probability</th><th>Timeframe</th><th>Reversible?</th><th>Status</th></tr></thead>
      <tbody>${(id.impacts || []).map((x) => `<tr><td data-label="Impact"><strong>${e(x.impact)}</strong><div class="muted">${e(x.note)}</div></td><td data-label="Side"><span class="pill ${sideClass(x.side)}">${e(sideLabel(x.side))}</span></td><td data-label="Magnitude">${e(x.magnitude)}</td><td data-label="Probability">${e(x.probability)}</td><td data-label="Timeframe">${e(x.timeframe)}</td><td data-label="Reversible?">${e(x.reversibility)}</td><td data-label="Status">${e(x.status)}</td></tr>`).join('')}</tbody>
    </table></div>
    <h2 class="sub-h">Weighing the debaters did</h2><p class="card-text">${e(id.weighing_done)}</p>
    <h2 class="sub-h">Comparison</h2><p class="card-text">${e(id.comparison)}</p>` : '';
  // Map
  const map = R.analysis.map;
  $('#map-go').disabled = busy.map;
  $('#map-go').textContent = L.runVerb(Boolean(map));
  statusLine($('#map-status'), 'map', map, 'Not drawn yet. Click Run.');
  const view = R.mapView === 'diagram' ? 'diagram' : 'sheet';
  document.querySelectorAll('[data-mapview]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mapview === view)));
  if (!(map && map.data)) { $('#map-out').innerHTML = '<p class="muted">No map yet. Click "+ Argument" to draw one by hand, or Run to let the AI map the round.</p>'; lastMapCode = ''; return; }
  if (view === 'diagram') drawMap(map.data);
  else { lastMapCode = ''; mapSeq++; $('#map-out').innerHTML = mapSheetHtml(map.data); } // mapSeq++ stops a late diagram from covering the sheet
}
const KIND_MARK = { answers: '↩ answers', turns: '↻ turns', extends: '→ extends', concedes: '= concedes' };
function mapSheetHtml(data) {
  const e = escapeHtml;
  const lay = L.layoutMap(data, L.speechesSoFar(R));
  if (!lay.rows.length) return '<p class="muted">No arguments yet. Click "+ Argument" to start, or Draw to let the AI map the round.</p>';
  const cols = lay.columns;
  const sideOf = (sp) => (/A[CR]$/.test(sp) ? 'aff' : 'neg');
  const card = (c) => {
    if (c.ghost) return `<div class="mcard ghost">${e(c.label)}</div>`;
    const chip = c.status === 'dropped' ? '<span class="chip drop">Dropped</span>'
      : c.status === 'extended' ? '<span class="chip ext">Extended</span>'
      : c.status === 'conceded' ? '<span class="chip con">Conceded</span>' : '';
    return `<button class="mcard ${c.side} ${c.status === 'dropped' ? 'dropped' : c.status === 'conceded' ? 'conceded' : ''}" data-node="${e(c.id)}" data-tip="Click to edit">`
      + (c.kind ? `<div class="mk">${e(KIND_MARK[c.kind] || c.kind)}</div>` : '')
      + `<span class="lbl">${e(c.label)}</span>${chip}</button>`;
  };
  return `<div class="mapsheet" style="grid-template-columns: repeat(${cols.length}, minmax(160px, 1fr))">`
    + cols.map((sp, i) => `<div class="mh ${sideOf(sp)}${i === cols.length - 1 ? ' last' : ''}">${e(sp)}</div>`).join('')
    + lay.rows.map((r) => `<div class="mrow" data-tip="${e(r.title)}">`
      + cols.map((sp, i) => `<div class="mc${i === cols.length - 1 ? ' last' : ''}">${(r.cells[sp] || []).map(card).join('')}<button class="madd" data-add-speech="${sp}" data-add-row="${e(r.root)}" aria-label="Add an argument in ${sp} on this row">+</button></div>`).join('')
      + '</div>').join('')
    + '</div>';
}
document.addEventListener('click', (ev) => {
  const b = ev.target.closest && ev.target.closest('[data-mapview]');
  if (!b) return;
  R.mapView = b.dataset.mapview; save(); renderAnalysis();
});
$('#lens-pick').addEventListener('change', (ev) => { R.lensPick = ev.target.value; save(); renderAnalysis(); });
$('#lens-custom').addEventListener('change', (ev) => {
  S.customParadigm = ev.target.value; saveSettings();
  // Keep only the saved answer for the current paradigm text; drop answers for old versions of it.
  const keep = L.lensKey('custom', S.customParadigm);
  for (const k of Object.keys(R.analysis.lens)) if (k.startsWith('custom:') && k.split('|')[0] !== keep) delete R.analysis.lens[k];
  R.ai.customParadigm = S.customParadigm; save();
  renderAnalysis();
});
$('#lens-go').addEventListener('click', () => {
  const key = $('#lens-pick').value;
  if (key === 'custom' && !(S.customParadigm || '').trim()) { $('#lens-custom-box').open = true; return toast('Paste your paradigm first.'); }
  const k = currentLensKey();
  runTool('lens', L.LENS_TASK, L.LENS_SCHEMA, { paradigm: L.paradigmText(key, S.customParadigm) }, (v) => { R.analysis.lens[k] = v; });
});
$('#impact-go').addEventListener('click', () => { const box = LV(); runTool('impacts', L.IMPACT_TASK, L.IMPACT_SCHEMA, null, (v) => { box.impacts = v; }); });
$('#map-go').addEventListener('click', () => runTool('map', L.MAP_TASK, L.MAP_SCHEMA, null, (v) => {
  // Keep everything the judge drew or edited by hand.
  R.analysis.map = { ...v, data: L.mergeMap(R.analysis.map && R.analysis.map.data, v.data) };
}));
$('#map-copy').addEventListener('click', () => {
  if (!R.analysis.map) return toast('Draw the map first.');
  copyToast(L.buildMermaid(R.analysis.map.data));
});

// Mermaid is loaded only when a map is drawn (pinned version, integrity-checked).
let mermaidReady = null, mapSeq = 0, lastMapCode = '';
function loadMermaid() {
  mermaidReady ??= new Promise((res, rej) => {
    const el = document.createElement('script');
    el.src = 'vendor/mermaid-10.9.1.min.js';
    el.integrity = 'sha384-WmdflGW9aGfoBdHc4rRyWzYuAjEmDwMdGdiPNacbwfGKxBW/SO6guzuQ76qjnSlr'; el.crossOrigin = 'anonymous';
    el.onload = () => { mermaidTheme(); res(window.mermaid); };
    el.onerror = () => { mermaidReady = null; rej(new Error('could not load the diagram library (needs internet)')); };
    document.head.append(el);
  });
  return mermaidReady;
}
// The map drawing follows the app theme (V10). If a map is on screen when the theme changes, it is drawn again at once.
function mermaidTheme() {
  const dark = document.documentElement.dataset.theme === 'dark';
  window.mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: dark ? 'dark' : 'default', flowchart: { useMaxWidth: false } });
}
window.TabulaTheme.onChange(() => {
  if (!window.mermaid || !lastMapCode) return;
  mermaidTheme(); lastMapCode = '';
  if (R.analysis && R.analysis.map && R.analysis.map.data) drawMap(R.analysis.map.data);
});
async function drawMap(data) {
  const code = L.buildMermaid(data);
  if (code === lastMapCode && $('#map-out').querySelector('svg')) return; // already drawn
  lastMapCode = code;
  const seq = ++mapSeq;
  try {
    const m = await loadMermaid();
    const { svg } = await m.render('roundmap' + seq, code);
    if (seq === mapSeq) $('#map-out').innerHTML = svg;
  } catch (err) {
    if (seq === mapSeq) $('#map-out').innerHTML = '<p class="muted">Could not draw the map: ' + escapeHtml(err.message || String(err)) + '. Use "Copy Mermaid code" and paste it into mermaid.live.</p>';
    lastMapCode = '';
  }
}

// ---------- hand-editing the round map ----------
// Cards the judge makes are marked user; AI cards the judge changes are marked edited. Both survive AI redraws.
let neState = null;
function mapDataEnsure() {
  if (!R.analysis.map) R.analysis.map = { data: { nodes: [], edges: [] }, at: Date.now(), through: L.speechesSoFar(R) };
  return R.analysis.map.data;
}
function openNodeEditor(opts) {
  const data = mapDataEnsure();
  const node = opts.id ? data.nodes.find((n) => String(n.id) === String(opts.id)) : null;
  // Default speech for a new card: the one given, else the latest speech so far that has a flow column, else 1AC.
  let speech = node ? node.speech : opts.speech;
  if (!speech) speech = L.speechesSoFar(R).filter((x) => L.MAP_SPEECHES.includes(x)).pop() || '1AC';
  const out = node ? data.edges.find((x) => String(x.from) === String(node.id)) : null;
  neState = { id: node ? node.id : null };
  $('#ne-title').textContent = node ? 'Edit argument' : 'New argument';
  $('#ne-label').value = node ? node.label : '';
  $('#ne-speech').innerHTML = L.MAP_SPEECHES.map((x) => `<option${x === speech ? ' selected' : ''}>${x}</option>`).join('');
  $('#ne-status').value = node ? node.status : 'open';
  $('#ne-kind').value = out ? out.kind : 'answers';
  const others = data.nodes.filter((n) => !node || String(n.id) !== String(node.id));
  const target = out ? String(out.to) : opts.target ? String(opts.target) : '';
  $('#ne-target').innerHTML = '<option value="">Nothing (a new argument)</option>'
    + others.map((n) => `<option value="${escapeHtml(n.id)}"${String(n.id) === target ? ' selected' : ''}>${escapeHtml(n.speech + ': ' + n.label)}</option>`).join('');
  $('#ne-delete').hidden = !node;
  $('#node-editor').hidden = false;
  setTimeout(() => $('#ne-label').focus(), 0);
}
function closeNodeEditor() { $('#node-editor').hidden = true; neState = null; }
function edgeKey(e) { return e.from + '>' + e.to; }
$('#ne-save').addEventListener('click', () => {
  const data = mapDataEnsure();
  const label = $('#ne-label').value.trim();
  if (!label) { $('#ne-label').focus(); return toast('Type the argument first.'); }
  let node = neState.id ? data.nodes.find((n) => String(n.id) === String(neState.id)) : null;
  if (!node) { node = { id: 'u' + Date.now().toString(36), user: true }; data.nodes.push(node); }
  else if (!node.user) { if (!node.edited) node.aiLabel = node.label; node.edited = true; }
  node.label = label; node.speech = $('#ne-speech').value; node.status = $('#ne-status').value;
  // Replace this card's outgoing link. Remember AI links the judge removed, so a redraw does not restore them.
  data.removedEdges ??= [];
  for (const x of data.edges.filter((x) => String(x.from) === String(node.id))) if (!x.user) data.removedEdges.push(edgeKey(x));
  data.edges = data.edges.filter((x) => String(x.from) !== String(node.id));
  const to = $('#ne-target').value;
  if (to) data.edges.push({ from: node.id, to, kind: $('#ne-kind').value, user: true });
  save(); closeNodeEditor(); renderAnalysis();
});
// Delete closes the editor first, then offers Undo (spec 2.4 #10).
$('#ne-delete').addEventListener('click', () => {
  const data = mapDataEnsure();
  const node = data.nodes.find((n) => String(n.id) === String(neState.id));
  if (!node) return;
  const before = JSON.parse(JSON.stringify({ nodes: data.nodes, edges: data.edges, removedNodes: data.removedNodes || [] }));
  if (!node.user) (data.removedNodes ??= []).push({ id: String(node.id), key: node.speech + '|' + String(node.aiLabel || node.label).trim().toLowerCase() });
  data.nodes = data.nodes.filter((n) => n !== node);
  data.edges = data.edges.filter((x) => String(x.from) !== String(node.id) && String(x.to) !== String(node.id));
  save(); closeNodeEditor(); renderAnalysis();
  undoToast('Removed "' + node.label + '" from the map.', 'remove ' + node.label, () => {
    Object.assign(mapDataEnsure(), before); save(); renderAnalysis();
  });
});
$('#ne-cancel').addEventListener('click', closeNodeEditor);
$('#node-editor').addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'ne-label') $('#ne-save').click(); });
escLayer('node-editor', 70, () => !$('#node-editor').hidden, () => closeNodeEditor());
$('#map-add').addEventListener('click', () => openNodeEditor({}));
$('#map-out').addEventListener('click', (e) => {
  const card = e.target.closest('[data-node]');
  if (card) return openNodeEditor({ id: card.dataset.node });
  const add = e.target.closest('[data-add-speech]');
  if (add) {
    // A new card in a row answers the latest card in an earlier speech on that row.
    const data = mapDataEnsure();
    const lay = L.layoutMap(data, L.speechesSoFar(R));
    const row = lay.rows.find((r) => r.root === add.dataset.addRow);
    const sp = add.dataset.addSpeech;
    let target = '';
    if (row) for (const col of lay.columns) { if (L.MAP_SPEECHES.indexOf(col) >= L.MAP_SPEECHES.indexOf(sp)) break; const c = (row.cells[col] || []).filter((x) => !x.ghost); if (c.length) target = c[c.length - 1].id; }
    openNodeEditor({ speech: sp, target });
  }
});

// ---------- Draft with AI: the panel, the review, Stop and Undo (spec 4.3–4.6, Q9) ----------
// The panel opens from its button (or the palette, Slice 5). A draft writes nothing at first: it becomes a review
// (R.ballotReview, kept across a reload), and only "Insert selected" or "Accept all" changes the ballot.
const BALLOT_SYSTEM = () => L.JUDGE_SYSTEM.split('\n\nReply in this exact structure')[0] + '\n\n' + L.POINTS_GUIDE;
const ptsRangeNow = () => L.ptsRange(R.ptsRange);
const groupById = (id) => L.DRAFT_GROUPS.find((g) => g.id === id);
const draftUi = { open: false, picks: null, feedback: false, busy: false, busyText: '', ctrl: null, err: '', stopped: false, idx: 0 };
let fillSoonTimer = null, fillWaitsOnline = false;
const wideBallot = matchMedia('(min-width: 1280px)'), narrowBallot = matchMedia('(max-width: 819.98px)');
const evalFeedback = () => (LV().liveEval && LV().liveEval.data && LV().liveEval.data.feedback) || [];
// ai.notes from the old Decision draft tab moves into the note box once (spec 4.3). ai.evidence stays in the prompt.
if (R.ai && (R.ai.notes || '').trim()) { R.ballotInput = ((R.ballotInput || '').trim() ? R.ballotInput.trim() + '\n' : '') + R.ai.notes.trim(); R.ai.notes = ''; save(); }

function defaultPicks() { return new Set(L.DRAFT_GROUPS.filter((g) => L.fieldState(R.ballot, g.fields) !== 'yours').map((g) => g.id)); }
function openDraftPanel(opener) {
  if (!draftUi.open) draftUi.picks = defaultPicks();
  draftUi.open = true; draftUi.opener = opener || $('#draft-open');
  $('#draft-panel').hidden = false;
  $('#ballot-layout').classList.add('panel-open');
  $('#draft-open').setAttribute('aria-expanded', 'true');
  renderDraftPanel();
  const head = R.ballotReview ? $('#rv-title') : $('#draft-title');
  if (head) head.focus();
}
function closeDraftPanel(restoreFocus = true) {
  if (!draftUi.open) return;
  const inside = $('#draft-panel').contains(document.activeElement);
  draftUi.open = false;
  $('#draft-panel').hidden = true;
  $('#ballot-layout').classList.remove('panel-open');
  $('#draft-open').setAttribute('aria-expanded', 'false');
  if (restoreFocus && inside) $('#draft-open').focus();
}
// Esc closes the panel and does not stop a call (spec 4.3).
escLayer('draft-panel', 45, () => draftUi.open, () => closeDraftPanel());
$('#draft-open').addEventListener('click', (e) => (draftUi.open ? closeDraftPanel() : openDraftPanel(e.currentTarget)));
$('#draft-close').addEventListener('click', () => closeDraftPanel());
for (const q of [wideBallot, narrowBallot]) q.addEventListener('change', () => { if (R.tab === 'ballot') renderDraftPanel(); });

function renderDraftButton() {
  const b = $('#draft-open'); if (!b) return;
  b.textContent = R.ballotReview ? 'Draft ready' : 'Draft with AI';
}
const STATE_TEXT = {
  empty: 'Nothing to draft from yet. The AI needs at least one speech, flow or doc.',
  nothing: 'Pick at least one thing to draft.',
  stopped: 'Stopped. Nothing on the ballot changed.',
};
function draftState() {
  return L.draftPanelState({ busy: draftUi.busy, aiReady: aiReady(), offline: navigator.onLine === false, hasContent: L.roundHasContent(R, DOCS), picked: (draftUi.picks || defaultPicks()).size, error: draftUi.err, stopped: draftUi.stopped });
}
function renderDraftPanel() {
  renderDraftButton();
  if (!draftUi.open) return;
  $('#draft-close').textContent = narrowBallot.matches ? 'Done' : 'Close';
  const review = R.ballotReview;
  $('#dp-compose').hidden = Boolean(review);
  $('#dp-review').hidden = !review;
  if (review) return renderReview();
  renderReadLevel();
  const picks = draftUi.picks || (draftUi.picks = defaultPicks());
  const box = $('#dp-picks');
  const keep = box.querySelector('legend').outerHTML;
  const focusId = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.pick : null;
  box.innerHTML = keep + L.DRAFT_GROUPS.map((g) => {
    const yours = L.fieldState(R.ballot, g.fields) === 'yours';
    return `<label class="row check-row"><input type="checkbox" data-pick="${g.id}"${picks.has(g.id) ? ' checked' : ''}> ${escapeHtml(g.label)}${yours ? ' <span class="muted">(yours)</span>' : ''}</label>`;
  }).join('');
  if (focusId) { const el = box.querySelector(`[data-pick="${focusId}"]`); if (el) el.focus(); }
  const fb = $('#dp-feedback');
  const hasFb = evalFeedback().length > 0;
  fb.disabled = !hasFb; fb.checked = hasFb && draftUi.feedback;
  fb.parentElement.lastChild.textContent = hasFb ? ' Use Live Eval feedback for the comments' : ' Use Live Eval feedback for the comments (run Live Eval first)';
  const st = draftState();
  const el = $('#dp-status');
  tone(el);
  if (st === 'loading') el.innerHTML = busyHtml(draftUi.busyText || 'Drafting… usually 20–60 seconds');
  else if (st === 'noAI') el.innerHTML = '<span class="is-quiet">Connect AI to draft the ballot. The ballot works by hand either way. <button class="linkish" type="button" data-tab-go="ai">Connect AI</button></span>';
  else if (st === 'offline') { tone(el, 'quiet'); el.textContent = L.AI_ERROR_PREFIX.ballot + ' ' + L.aiErrorText('offline'); }
  else if (st === 'error') { tone(el, errColor(draftUi.err)); el.innerHTML = escapeHtml(L.AI_ERROR_PREFIX.ballot + ' ' + draftUi.err) + ' <button class="b small" type="button" id="dp-retry">Try again</button>'; }
  else if (STATE_TEXT[st]) { tone(el, 'quiet'); el.textContent = STATE_TEXT[st]; }
  else el.textContent = '';
  const go = $('#dp-go');
  go.textContent = draftUi.busy ? 'Stop' : 'Draft';
  go.classList.toggle('primary', !draftUi.busy);
  const blocked = ['noAI', 'offline', 'empty', 'nothing'].includes(st);
  go.disabled = !draftUi.busy && blocked;
  go.setAttribute('aria-describedby', blocked ? 'dp-cost dp-status' : 'dp-cost');
  $('#dp-undo').hidden = !R.ballotUndo;
  $('#auto-ballot').checked = Boolean(S.autoBallot);
  const d = LV().ballotDraft && LV().ballotDraft.data;
  $('#dp-why-body').textContent = d ? 'AI confidence: ' + d.confidence + '\n' + (d.points_reasoning || '') : 'Draft the ballot first. The AI\'s reasons for the points show here.';
}
document.addEventListener('change', (e) => {
  const p = e.target.dataset && e.target.dataset.pick;
  if (p) { draftUi.picks ??= defaultPicks(); if (e.target.checked) draftUi.picks.add(p); else draftUi.picks.delete(p); draftUi.stopped = false; renderDraftPanel(); }
  if (e.target.id === 'dp-feedback') draftUi.feedback = e.target.checked;
});
$('#auto-ballot').addEventListener('change', (e) => { S.autoBallot = e.target.checked; saveSettings(); });

// One AI call for a draft. picks: group ids. redraft: { fields, previous } for [Redo this]. Returns the draft or null.
async function runDraft({ picks, redraft, text }) {
  if (draftUi.busy) return null;
  const level = lvl();
  const fields = picks.flatMap((id) => groupById(id).fields);
  const ctrl = new AbortController();
  Object.assign(draftUi, { busy: true, busyText: text || '', ctrl, err: '', stopped: false });
  renderDraftPanel();
  try {
    const data = await callAI({
      system: BALLOT_SYSTEM(),
      prompt: L.buildBallotPrompt(R, DOCS, R.ballotInput || '', { only: fields, redraft, range: ptsRangeNow(), liveEvalFeedback: draftUi.feedback ? evalFeedback() : null }),
      schema: L.BALLOT_SCHEMA, effort: 'high', reading: level, kind: 'ballot', signal: ctrl.signal,
    });
    if (resetting) return null;
    LV(level).ballotDraft = { data, at: Date.now(), through: L.speechesSoFar(R) };
    return data;
  } catch (err) {
    if (err && err.kind === 'stopped') draftUi.stopped = true;
    else { draftUi.err = (err && err.message) || String(err); console.warn('Ballot draft failed:', err); }
    return null;
  } finally {
    draftUi.busy = false; draftUi.ctrl = null; draftUi.busyText = '';
    save(); renderDraftPanel();
  }
}
async function startDraft() {
  if (draftUi.busy) { draftUi.ctrl && draftUi.ctrl.abort(); return; } // the button is [Stop] while a call runs
  if (draftState() !== 'ready' && draftState() !== 'error' && draftState() !== 'stopped') return;
  const picks = L.DRAFT_GROUPS.map((g) => g.id).filter((id) => (draftUi.picks || defaultPicks()).has(id));
  const data = await runDraft({ picks });
  if (!data) return;
  R.ballotReview = L.reviewFromDraft(R.ballot, data, { picks, range: ptsRangeNow(), through: L.speechesSoFar(R), at: Date.now() });
  draftUi.idx = 0; save(); renderDraftPanel();
  const h = $('#rv-title'); if (h && draftUi.open) h.focus();
}
$('#dp-go').addEventListener('click', startDraft);
document.addEventListener('click', (e) => { if (e.target.id === 'dp-retry') startDraft(); });
// ⌘↵ / Ctrl+↵ in the note box runs Draft; in the review it runs Insert selected (spec 4.1, 4.3).
$('#draft-panel').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || !(e.metaKey || e.ctrlKey) || e.isComposing) return;
  if (R.ballotReview) { e.preventDefault(); insertReview(false); }
  else if (e.target.id === 'ballot-input') { e.preventDefault(); startDraft(); }
});
$('#dp-prompt').addEventListener('click', async () => {
  const fields = L.DRAFT_GROUPS.filter((g) => (draftUi.picks || defaultPicks()).has(g.id)).flatMap((g) => g.fields);
  const textDocs = DOCS.filter((d) => d.kind !== 'pdf').map((d) => '=== ' + L.docTitle(d) + ' ===\n' + d.data).join('\n\n');
  const pdfs = DOCS.filter((d) => d.kind === 'pdf').map((d) => d.name);
  const text = L.anonymize(BALLOT_SYSTEM() + '\n\n' + L.readingGuide(lvl()) + '\n\n' + (textDocs ? textDocs + '\n\n' + L.DOC_NOTE + '\n\n' : '')
    + L.buildBallotPrompt(R, DOCS, R.ballotInput || '', { only: fields, range: ptsRangeNow(), liveEvalFeedback: draftUi.feedback ? evalFeedback() : null }), R);
  const ok = await copy(text);
  toast(ok ? (pdfs.length ? 'Prompt copied. Attach these PDFs by hand: ' + pdfs.join(', ') : 'Prompt copied. Paste it into any AI chat.') : 'Copy did not work in this browser.');
});
// Undo the last insert (or auto refill): one step, until the next edit (spec 4.5).
function undoLastInsert() {
  if (!R.ballotUndo) return false;
  R.ballot = R.ballotUndo; R.ballotUndo = null;
  if (R.ballotReview) R.ballotReview = L.staleReviewCards(R.ballotReview, R.ballot);
  save(); renderBallot();
}
$('#dp-undo').addEventListener('click', () => { if (undoLastInsert() !== false) toast('Ballot put back.'); });
function insertedToast(n) {
  undoToast('AI text added to ' + n + (n === 1 ? ' field.' : ' fields.'), 'AI text added', undoLastInsert, 'Ballot put back.');
}

// ----- the review (spec 4.4) -----
const diffHtml = (diff) => diff.map((d) => d.op === 'del' ? `<del><span class="sr-only">removed: </span>${escapeHtml(d.text)}</del>` : d.op === 'ins' ? `<ins><span class="sr-only">added: </span>${escapeHtml(d.text)}</ins>` : escapeHtml(d.text)).join('');
const winText = (w) => (w === 'aff' ? 'Aff' : w === 'neg' ? 'Neg' : '–');
function cardBody(c) {
  const e = escapeHtml;
  if (c.id === 'winner') return `<table class="rv-table"><thead><tr><th scope="col">Now</th><th scope="col">AI</th></tr></thead><tbody><tr><td>${winText(c.base.winner)}</td><td>${winText(c.after.winner)}</td></tr></tbody></table>`;
  if (c.id === 'pts') {
    const rows = L.SPEAKERS.map((s) => {
      const now = [c.base['pts.' + s], c.base['ranks.' + s] ? 'rank ' + c.base['ranks.' + s] : ''].filter((x) => x !== '' && x != null).join(', ') || '–';
      const ai = [c.after['pts.' + s], c.after['ranks.' + s] ? 'rank ' + c.after['ranks.' + s] : ''].filter((x) => x !== '' && x != null).join(', ') || '–';
      return `<tr><th scope="row" class="${s.endsWith('A') ? 'aff' : 'neg'}">${s}</th><td>${e(now)}</td><td>${e(ai)}</td></tr>`;
    }).join('');
    const r = R.ballotReview.range;
    const bad = (c.outOfRange || []).map((x) => `<p class="is-caution rv-note">${x.speaker}: The AI gave ${x.value}, which is outside ${r.min}–${r.max}. Set this one by hand.</p>`).join('');
    return `<table class="rv-table"><thead><tr><th scope="col">Speaker</th><th scope="col">Now</th><th scope="col">AI</th></tr></thead><tbody>${rows}</tbody></table>${bad}`;
  }
  if (c.state === 'yours' && c.diff) return `<div class="rv-text rv-diff">${diffHtml(c.diff)}</div>`;
  return `<div class="rv-text">${e(c.after[c.id] || '') || '<span class="muted">The AI wrote nothing here.</span>'}</div>`;
}
function cardChoice(c) {
  if (c.empty) return '<p class="muted rv-none">Nothing to insert.</p>';
  if (c.state === 'yours') {
    return `<fieldset class="rv-choice"><legend class="sr-only">${escapeHtml(c.label)}</legend>`
      + `<label class="row check-row"><input type="radio" name="rv-${c.id}" data-rv-choice="${c.id}" value="keep"${c.choice !== 'ai' ? ' checked' : ''}> Keep mine</label>`
      + `<label class="row check-row"><input type="radio" name="rv-${c.id}" data-rv-choice="${c.id}" value="ai"${c.choice === 'ai' ? ' checked' : ''}> Use AI text</label></fieldset>`;
  }
  return `<label class="row check-row"><input type="checkbox" data-rv-choice="${c.id}"${c.choice !== 'skip' ? ' checked' : ''}> Insert this</label>`;
}
function renderReview() {
  const rv = R.ballotReview;
  const box = $('#dp-review');
  const narrow = narrowBallot.matches;
  const n = rv.cards.length;
  draftUi.idx = Math.max(0, Math.min(draftUi.idx, n - 1));
  const active = document.activeElement;
  const keepFocus = active && box.contains(active) ? (active.id || (active.dataset.rvChoice ? 'c:' + active.dataset.rvChoice + ':' + active.value : active.dataset.rvRedo ? 'r:' + active.dataset.rvRedo : '')) : '';
  const stale = L.speechEndedSince(rv, R);
  const st = draftState();
  const busy = st === 'loading';
  box.innerHTML = `<div class="rv-head"><h3 id="rv-title" tabindex="-1">Review the draft</h3>
      <p class="muted">Check AI text before you use it. Nothing changes on the ballot until you insert it.</p></div>
    ${stale ? `<p class="warn rv-stale">A speech ended after this draft. <button class="b small" type="button" id="rv-redo-all" aria-describedby="rv-cost"${busy ? ' disabled' : ''}>Redo all</button></p>` : ''}
    <p class="status-line" id="rv-status" role="status" aria-live="polite">${busy ? busyHtml(draftUi.busyText || 'Drafting…') : draftUi.err ? '<span class="is-error">' + escapeHtml(L.AI_ERROR_PREFIX.ballot + ' ' + draftUi.err) + '</span>' : draftUi.stopped ? '<span class="is-quiet">' + STATE_TEXT.stopped + '</span>' : ''}</p>
    ${narrow && n > 1 ? `<div class="rv-pager"><button class="b small" type="button" id="rv-prev"${draftUi.idx === 0 ? ' disabled' : ''}>Previous</button><p class="rv-count" aria-live="polite">${draftUi.idx + 1} of ${n}: ${escapeHtml(rv.cards[draftUi.idx].label)}</p><button class="b small" type="button" id="rv-next"${draftUi.idx === n - 1 ? ' disabled' : ''}>Next</button></div>` : ''}
    ${rv.cards.map((c, i) => `<section class="rv-card${i === draftUi.idx ? ' rv-current' : ''}" aria-labelledby="rv-h-${c.id}">
      <div class="rv-card-head"><h4 id="rv-h-${c.id}">${escapeHtml(c.label)}</h4>${c.changed ? '<span class="pill is-caution">Changed since the draft</span>' : ''}${c.state === 'yours' ? '<span class="b-tag-ai">Yours</span>' : ''}</div>
      ${cardBody(c)}
      <div class="rv-card-foot">${cardChoice(c)}<button class="b small" type="button" data-rv-redo="${c.id}" aria-describedby="rv-cost"${busy ? ' disabled' : ''}>Redo this</button></div>
    </section>`).join('')}
    <p class="muted rv-cost" id="rv-cost">Redo is one AI call.</p>
    <div class="rv-foot"><button class="b primary" type="button" id="rv-insert" aria-keyshortcuts="Meta+Enter Control+Enter">Insert selected</button><button class="b" type="button" id="rv-accept">Accept all</button><button class="b" type="button" id="rv-discard">Discard draft</button>${busy ? '<button class="b" type="button" id="rv-stop">Stop</button>' : ''}</div>`;
  if (keepFocus) {
    const [k, id, v] = keepFocus.split(':');
    const el = k === 'c' ? box.querySelector(`[data-rv-choice="${id}"]${v && v !== 'on' ? `[value="${v}"]` : ''}`) : k === 'r' ? box.querySelector(`[data-rv-redo="${id}"]`) : document.getElementById(keepFocus);
    if (el) el.focus();
  }
}
$('#dp-review').addEventListener('change', (e) => {
  const id = e.target.dataset.rvChoice; if (!id) return;
  const c = R.ballotReview.cards.find((x) => x.id === id);
  c.choice = e.target.type === 'checkbox' ? (e.target.checked ? 'insert' : 'skip') : e.target.value;
  save();
});
$('#dp-review').addEventListener('click', async (e) => {
  const t = e.target.closest('button'); if (!t) return;
  if (t.id === 'rv-insert') return insertReview(false);
  if (t.id === 'rv-accept') return insertReview(true);
  if (t.id === 'rv-stop' && draftUi.ctrl) return draftUi.ctrl.abort();
  if (t.id === 'rv-prev' || t.id === 'rv-next') { draftUi.idx += t.id === 'rv-next' ? 1 : -1; renderReview(); const b = $('#' + t.id); if (b && !b.disabled) b.focus(); else $('#rv-title').focus(); return; }
  if (t.id === 'rv-discard') {
    const before = R.ballotReview;
    R.ballotReview = null; save(); renderDraftPanel(); $('#draft-title').focus();
    undoToast('Draft discarded. The ballot did not change.', 'discard draft', () => { R.ballotReview = before; save(); renderDraftPanel(); }, 'Draft back for review.');
    return;
  }
  if (t.id === 'rv-redo-all') {
    const picks = R.ballotReview.picks;
    const data = await runDraft({ picks, text: 'Drafting again… usually 20–60 seconds' });
    if (data) { R.ballotReview = L.reviewFromDraft(R.ballot, data, { picks, range: ptsRangeNow(), through: L.speechesSoFar(R), at: Date.now() }); save(); renderDraftPanel(); }
    return;
  }
  const redo = t.dataset.rvRedo;
  if (redo) {
    const old = R.ballotReview.cards.find((x) => x.id === redo);
    const data = await runDraft({ picks: [redo], redraft: { fields: old.fields.filter((f) => !f.startsWith('ranks.')), previous: old.id === 'pts' ? {} : { [redo]: old.after[redo] } }, text: 'Redrafting ' + old.label.toLowerCase() + '…' });
    if (!data || !R.ballotReview) return;
    const fresh = L.reviewFromDraft(R.ballot, data, { picks: [redo], range: ptsRangeNow() }).cards[0];
    R.ballotReview.cards = R.ballotReview.cards.map((x) => (x.id === redo ? fresh : x));
    save(); renderDraftPanel();
    const b = $(`[data-rv-redo="${redo}"]`); if (b) b.focus();
  }
});
function insertReview(all) {
  const rv = R.ballotReview; if (!rv) return;
  const before = L.ballotSnapshot(R.ballot);
  const res = L.applyReview(R.ballot, rv, all);
  R.ballotReview = null;
  if (res.count) { R.ballot = res.ballot; R.ballotUndo = before; }
  save(); renderBallot(); renderDraftPanel();
  if ($('#draft-title') && draftUi.open) $('#draft-title').focus();
  if (res.count) insertedToast(res.count); else toast('Nothing was inserted. The ballot did not change.');
}

// ----- auto refill (spec 4.6): off by default (D2). Never on an empty round, offline, with no AI, or while a review waits.
function scheduleBallotSoon() {
  clearTimeout(fillSoonTimer);
  fillSoonTimer = setTimeout(() => {
    if (!S.autoBallot || !aiReady() || resetting) return;
    if (navigator.onLine === false) { fillWaitsOnline = true; return; } // runs when online, if still on (spec 2.3, D2)
    runAutoRefill();
  }, 25000);
}
async function runAutoRefill() {
  if (!S.autoBallot || !aiReady() || draftUi.busy || R.ballotReview || navigator.onLine === false || !L.roundHasContent(R, DOCS)) return;
  const picks = L.DRAFT_GROUPS.map((g) => g.id);
  const data = await runDraft({ picks, text: 'Refilling after the speech…' });
  if (!data || R.ballotReview) return;
  const plan = L.autoRefillPlan(R.ballot, data, ptsRangeNow());
  if (plan.write.length) {
    const before = L.ballotSnapshot(R.ballot);
    R.ballot = L.applyBallotDraft(R.ballot, data, { only: plan.write, range: ptsRangeNow(), mark: 'ai' });
    R.ballotUndo = before;
    const groups = new Set(plan.write.map((f) => (f.includes('.') ? 'row.' + f.split('.')[1] : f)));
    insertedToast(groups.size);
  }
  if (plan.review.length) {
    R.ballotReview = L.reviewFromDraft(R.ballot, data, { picks: plan.review, range: ptsRangeNow(), through: L.speechesSoFar(R), at: Date.now() });
    toast('The AI would change text it wrote before. Review it in Draft with AI.');
  }
  save(); if (R.tab === 'ballot') renderBallot(); else renderDraftButton();
}

// ---------- backup and restore ----------
function readAllStorage() {
  const out = {};
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('policyJudge.')) out[k] = localStorage.getItem(k); } } catch {}
  return out;
}
async function readAllDocs() {
  try { return (await docStore.tx('readonly', (st) => st.getAll())) || []; } catch { return DOCS.slice(); }
}
const stamp = () => { const d = new Date(), p = (n) => String(n).padStart(2, '0'); return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()); }; // local time
async function downloadBackup(includeKeys, label) {
  save(); saveSettings();
  const all = readAllStorage();
  if (includeKeys && !S.rememberKeys && Object.keys(keys).length) all[KEYS] = JSON.stringify(keys); // keys kept for this tab only
  const backup = L.buildBackup(all, await readAllDocs(), { includeKeys });
  download('tabula-' + (label || 'backup') + '-' + stamp() + '.json', JSON.stringify(backup), 'application/json');
  S.lastBackupAt = Date.now(); saveSettings(); renderBackup();
}
function renderBackup() {
  const el = $('#backup-last'); if (!el) return;
  el.textContent = S.lastBackupAt ? 'Last backup: ' + agoText(S.lastBackupAt) + '.' : 'No backup yet.';
}
$('#backup-go').addEventListener('click', () => downloadBackup($('#backup-keys').checked));
$('#restore-file').addEventListener('change', async (e) => {
  const file = e.target.files[0]; e.target.value = '';
  if (!file) return;
  const st = $('#backup-status');
  let b;
  try { b = L.parseBackup(await file.text()); }
  catch (err) { tone(st, 'error'); st.textContent = 'Could not restore: ' + String(err.message || err); return; }
  const sum = L.backupSummary(b);
  const when = b.exportedAt ? new Date(b.exportedAt).toLocaleString() : 'an unknown time';
  const hasKeys = b.includesKeys && [KEYS, KEY, OAKEY].some((k) => b.storage[k] != null);
  // One dialog (spec 2.4 #13, #14), with the large-file note in it.
  const ok = await ask({
    title: 'Restore the backup from ' + when + '?',
    body: 'This replaces everything in this browser. Tabula downloads a copy of your current data first.',
    list: ['Round: ' + sum.round, 'Saved ballots: ' + sum.ballots, 'Documents: ' + sum.docs, L.restoreKeysLine(hasKeys, S.rememberKeys)],
    foot: file.size > 60 * 1024 * 1024 ? 'This file is large (' + Math.round(file.size / 1048576) + ' MB), so it may take a while.' : '',
    buttons: [{ label: 'Cancel', value: false, kind: 'plain' }, { label: 'Restore', value: true, kind: 'danger' }], cancelValue: false,
  });
  if (!ok) return;
  // 1. Safety copy of the current data (with keys) before anything changes.
  await downloadBackup(true, 'before-restore');
  resetting = true; stopAll(); restoring = true;
  CQ.clear(); await clipStore.clear().catch(() => {}); // waiting audio never carries over into restored data
  // 2. Snapshot everything, so any failure below puts the old data back exactly.
  const oldStorage = readAllStorage();
  const oldDocs = await readAllDocs();
  // This tab's own key entries (Remember off keeps keys in sessionStorage, Q-3), so a failure can put them back too.
  const TAB_KEY_NAMES = [KEYS, KEY, OAKEY];
  const oldTab = {};
  for (const k of TAB_KEY_NAMES) { try { const v = sessionStorage.getItem(k); if (v != null) oldTab[k] = v; } catch {} }
  const writeTabKeys = (entries) => {
    for (const k of TAB_KEY_NAMES) { try { sessionStorage.removeItem(k); } catch {} }
    for (const [k, v] of Object.entries(entries)) sessionStorage.setItem(k, v); // a failure here runs the rollback below
  };
  const writeStorage = (entries) => {
    for (const k of Object.keys(readAllStorage())) localStorage.removeItem(k);
    for (const [k, v] of Object.entries(entries)) localStorage.setItem(k, v);
  };
  const writeDocs = (docs) => docStore.tx('readwrite', (store2) => { store2.clear(); let last = null; for (const d of docs) last = store2.put(d); return last; });
  try {
    // Docs first, in one all-or-nothing step.
    await writeDocs(b.docs);
    // Then the saved data. Keys stay as they are unless the backup carries its own.
    const entries = Object.assign({}, b.storage);
    if (!hasKeys) for (const k of [KEYS, KEY, OAKEY]) if (oldStorage[k] != null) entries[k] = oldStorage[k];
    // With Remember off, the backup's keys go to this tab only, never to localStorage (spec 2.6, Q-3).
    const split = L.splitRestoreKeys(entries, S.rememberKeys, SETTINGS);
    writeStorage(split.local);
    writeTabKeys(L.restoreTabKeys(oldTab, split.session, hasKeys));
  } catch (err) {
    // Put the old data back, this tab's keys included.
    try { writeStorage(oldStorage); } catch {}
    try { writeTabKeys(oldTab); } catch {}
    try { await writeDocs(oldDocs); } catch {}
    resetting = false; restoring = false;
    tone(st, 'error');
    st.textContent = 'Restore failed, and your previous data was put back: ' + String(err.message || err);
    return;
  }
  tone(st, 'ok'); st.textContent = 'Restored. Reloading…';
  setTimeout(() => location.reload(), 1500);
});

// ---------- ballot (spec 4.1, 4.2, 4.7, 4.8, 4.12, and the narrow ballot 4.15 / 5.6c) ----------
const nameOf = (s) => ({ '1A': R.aff.d1, '2A': R.aff.d2, '1N': R.neg.d1, '2N': R.neg.d2 }[s]) || s;
const LOCK_SVG = '<svg class="lock" viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/></svg>';
// One tag per field group: the winner, each speaker row (points and rank), the RFD and each team's comments.
const TAG_GROUPS = Object.assign({ winner: ['winner'], rfd: ['rfd'], affFb: ['affFb'], negFb: ['negFb'] }, Object.fromEntries(L.SPEAKERS.map((s) => ['row.' + s, ['pts.' + s, 'ranks.' + s]])));
function tagHtml(key) {
  const st = L.fieldState(R.ballot, TAG_GROUPS[key]);
  if (st === 'yours') return `<button type="button" class="b-tag-btn" data-unlock="${key}" aria-label="Yours: ${escapeHtml(L.fieldLabel(key))}. Unlock it for the AI" data-tip="The AI will not change this. Click to let it.">${LOCK_SVG}Yours</button>`;
  if (st === 'ai') return '<span class="b-tag-ai">AI draft</span>';
  return '';
}
function renderBallotTags() {
  document.querySelectorAll('#tab-ballot [data-tag]').forEach((el) => { const h = tagHtml(el.dataset.tag); if (el.innerHTML !== h) el.innerHTML = h; });
  renderDraftPanel();
}
// "Yours" is a button: it unlocks the field at once, with an Undo toast and no dialog (spec 4.2).
document.addEventListener('click', (e) => {
  const b = e.target.closest && e.target.closest('[data-unlock]'); if (!b) return;
  const key = b.dataset.unlock, fields = TAG_GROUPS[key];
  const before = { touched: Object.assign({}, R.ballot.touched), aiFilled: Object.assign({}, R.ballot.aiFilled) };
  R.ballot = L.markFields(R.ballot, fields, 'free'); save(); renderBallotTags();
  const to = key === 'winner' ? document.querySelector('input[name="winner"]:checked') || document.querySelector('input[name="winner"]')
    : key.startsWith('row.') ? document.querySelector(`[data-bind="ballot.pts.${key.slice(4)}"]`) : document.querySelector(`[data-bind="ballot.${key}"]`);
  if (to) to.focus();
  undoToast('The AI may now change ' + L.fieldLabel(key) + '.', 'unlock ' + L.fieldLabel(key), () => { Object.assign(R.ballot, before); save(); renderBallotTags(); }, 'It is yours again.');
});

function renderBallot() {
  const r = ptsRangeNow();
  $('#ballot-title').textContent = 'Ballot' + (R.roundName ? ' · ' + R.roundName : '');
  $('#w-aff').textContent = R.aff.team ? '(' + R.aff.team + ')' : '';
  $('#w-neg').textContent = R.neg.team ? '(' + R.neg.team + ')' : '';
  $('#fb-aff-code').textContent = R.aff.team ? '(' + R.aff.team + ')' : '';
  $('#fb-neg-code').textContent = R.neg.team ? '(' + R.neg.team + ')' : '';
  document.querySelectorAll('input[name="winner"]').forEach((x) => { x.checked = x.value === R.ballot.winner; });
  $('#pts-head').textContent = 'Points (' + r.min + '–' + r.max + ')';
  $('#pts-body').innerHTML = L.SPEAKERS.map((s) => {
    const side = s.endsWith('A') ? 'aff' : 'neg';
    const nm = nameOf(s) !== s ? nameOf(s) : '';
    return `<tr data-speaker="${s}">
    <th scope="row" class="sp-cell ${side}"><strong>${s}</strong>${nm ? ' <span class="muted">' + escapeHtml(nm) + '</span>' : ''}</th>
    <td class="pts-cell"><div class="stepper"><button type="button" class="step" data-step="-1" data-sp="${s}" aria-label="Lower ${s} points by 0.1">−</button><input type="number" inputmode="decimal" min="${r.min}" max="${r.max}" step="0.1" data-bind="ballot.pts.${s}" aria-label="${s} points"><button type="button" class="step" data-step="1" data-sp="${s}" aria-label="Raise ${s} points by 0.1">+</button></div></td>
    ${[1, 2, 3, 4].map((k) => `<td class="rank-cell"><input type="radio" name="rank-${s}" value="${k}" data-rank="${s}" aria-label="${s}, rank ${k}"></td>`).join('')}
    <td class="rank-sel-cell"><label class="sr-only" for="rank-sel-${s}">${s} rank</label><select id="rank-sel-${s}" data-rank-sel="${s}"><option value="">Rank</option><option value="1">1 (best)</option><option value="2">2</option><option value="3">3</option><option value="4">4</option></select></td>
    <td class="tag-cell"><span class="b-tag" data-tag="row.${s}"></span></td>
  </tr>`;
  }).join('');
  bindAll(); syncRanks(); renderBallotTags(); renderBallotCheck(true); renderSaveStatus();
}
function syncRanks() {
  const rk = R.ballot.ranks || {};
  document.querySelectorAll('[data-rank]').forEach((x) => { x.checked = String(rk[x.dataset.rank] ?? '') === x.value; });
  document.querySelectorAll('[data-rank-sel]').forEach((x) => { x.value = String(rk[x.dataset.rankSel] ?? ''); });
}
// Picking a rank another speaker has moves it, with a message (spec 4.8). The radio grid and the narrow select share it.
function applyRank(speaker, value) {
  const m = L.moveRank(R.ballot.ranks, speaker, value);
  R.ballot.ranks = m.ranks;
  markTouched('ranks.' + speaker); save(); syncRanks(); renderBallotCheck();
  if (m.message) toast(m.message, { key: 'rank-moved' });
}
document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.name === 'winner') { R.ballot.winner = t.value; markTouched('winner'); save(); renderBallotCheck(); return; }
  if (t.dataset && t.dataset.rank) return applyRank(t.dataset.rank, t.value);
  if (t.dataset && t.dataset.rankSel) return applyRank(t.dataset.rankSel, t.value);
  if (t.dataset && (t.dataset.bind || '').startsWith('ballot')) renderBallotCheck();
});
// − and + step the points by 0.1 inside the range (spec 4.8).
document.addEventListener('click', (e) => {
  const b = e.target.closest && e.target.closest('[data-step]'); if (!b) return;
  const s = b.dataset.sp, input = document.querySelector(`[data-bind="ballot.pts.${s}"]`);
  const v = L.stepPoints(input.value, Number(b.dataset.step), ptsRangeNow());
  input.value = v; R.ballot.pts[s] = String(v); markTouched('pts.' + s); save(); renderBallotCheck();
});
// The check box is role="status": it changes at most once a second so a screen reader is not flooded (spec 4.8).
let checkAt = 0, checkTimer = null;
function renderBallotCheck(now) {
  const p = R.ballot.pts || {};
  const sum = (a, b) => (p[a] !== undefined && p[a] !== '' && p[b] !== undefined && p[b] !== '' ? (Number(p[a]) + Number(p[b])).toFixed(1) : '–');
  $('#sum-aff').textContent = 'Aff ' + sum('1A', '2A');
  $('#sum-neg').textContent = 'Neg ' + sum('1N', '2N');
  $('#ranks-set').textContent = 'Ranks: ' + L.ranksSet(R.ballot) + ' of 4 set.';
  const wait = 1000 - (Date.now() - checkAt);
  if (now === true || wait <= 0) return drawBallotCheck();
  if (!checkTimer) checkTimer = setTimeout(drawBallotCheck, wait);
}
function drawBallotCheck() {
  clearTimeout(checkTimer); checkTimer = null; checkAt = Date.now();
  const issues = L.checkBallot(R.ballot, { range: ptsRangeNow() });
  const html = issues.length
    ? `<div class="warn"><strong>Check before you submit:</strong><ul>${issues.map((i) => '<li>' + escapeHtml(i) + '</li>').join('')}</ul></div>`
    : '<p class="good">Ballot looks complete.</p>';
  if ($('#ballot-check').innerHTML !== html) $('#ballot-check').innerHTML = html;
}
function renderSaveStatus() {
  const el = $('#save-status'); if (!el) return;
  const t = lastSave.err === 'full' ? "Not saved: this browser's storage is full"
    : lastSave.err ? 'Not saved: this browser is blocking storage'
      : lastSave.at ? 'Saved in this browser · ' + new Date(lastSave.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
  el.textContent = t;
  el.classList.toggle('is-error', Boolean(lastSave.err));
}

// ----- Save to Ballots (spec 4.12) -----
function storeLog(list) { try { localStorage.setItem(LOG, JSON.stringify(list)); return ''; } catch (err) { return L.storageErrorKind(err); } }
$('#b-save').addEventListener('click', async () => {
  const issues = L.checkBallot(R.ballot, { range: ptsRangeNow() });
  if (issues.length) {
    // "Fix it" gets first focus and goes to the first field with a problem; there is no danger button (spec 2.4 #15).
    const v = await ask({
      title: issues.length === 1 ? 'Save with 1 problem?' : 'Save with ' + issues.length + ' problems?',
      list: issues,
      buttons: [{ label: 'Save anyway', value: 'save', kind: 'plain' }, { label: 'Fix it', value: 'fix', kind: 'primary' }], cancelValue: 'fix',
    });
    if (v !== 'save') return focusBallotProblem();
  }
  const log = store.get(LOG, []);
  const entry = L.savedBallotEntry(R, new Date().toLocaleString(), ptsRangeNow());
  const last = log[log.length - 1];
  if (last && JSON.stringify(last.slice(1)) === JSON.stringify(entry.slice(1))) return toast('Already in Ballots.');
  log.push(entry);
  const err = storeLog(log);
  if (err === 'full') return toast("Not saved: this browser's storage is full. Delete old saved ballots, or use Print / PDF to keep a copy.", { kind: 'error' });
  if (err) return toast('Not saved: this browser is blocking storage. Use Print / PDF to keep a copy.', { kind: 'error' });
  // Offer a backup when there is none from the last 2 hours (spec 2.4 #16).
  if (!S.lastBackupAt || Date.now() - S.lastBackupAt > 2 * 3600 * 1000) toast('Saved to Ballots. Your data lives only in this browser.', { action: { label: 'Download backup', run: () => downloadBackup(false) } });
  else toast('Saved to Ballots.');
});
// The first ballot field with a problem: the winner, then points, then ranks, then the RFD.
function focusBallotProblem() {
  const b = R.ballot, p = b.pts || {}, r = b.ranks || {}, rg = ptsRangeNow();
  const bad = (v) => v === undefined || v === '' || Number(v) < rg.min || Number(v) > rg.max;
  const narrow = narrowBallot.matches;
  const el = !b.winner ? document.querySelector('input[name="winner"]')
    : document.querySelector(L.SPEAKERS.map((s) => (bad(p[s]) ? `[data-bind="ballot.pts.${s}"]` : '')).filter(Boolean)[0] || 'x-none')
    || document.querySelector(L.SPEAKERS.map((s) => (!r[s] ? (narrow ? `[data-rank-sel="${s}"]` : `[data-rank="${s}"]`) : '')).filter(Boolean)[0] || 'x-none')
    || document.querySelector('[data-bind="ballot.rfd"]');
  if (el) { el.scrollIntoView({ block: 'center' }); el.focus(); }
}

// ----- Copy for the tournament ballot (spec 4.11) -----
const copyDlg = modalDialog($('#copy-sheet'), $('#copy-card'), { name: 'copy', rank: 85 });
let copyBlocks = [];
function openCopySheet() {
  copyBlocks = L.tournamentBlocks(R);
  const n = L.checkBallot(R.ballot, { range: ptsRangeNow() }).length;
  $('#copy-warn').hidden = !n;
  $('#copy-warn').textContent = n ? 'This ballot has ' + n + (n === 1 ? ' problem' : ' problems') + '. Fix them first, or copy anyway.' : '';
  $('#copy-blocks').innerHTML = copyBlocks.map((b) => `<section class="copy-block" aria-labelledby="cb-h-${b.id}">
    <div class="copy-head"><h3 id="cb-h-${b.id}">${escapeHtml(b.label)}</h3>${b.text ? `<button class="b small" type="button" data-copy-block="${b.id}" aria-label="Copy ${escapeHtml(b.label)}">Copy</button>` : ''}</div>
    ${b.text ? `<textarea class="copy-text" id="cb-t-${b.id}" readonly rows="${Math.min(8, Math.max(2, b.text.split('\n').length + Math.floor(b.text.length / 70)))}" aria-labelledby="cb-h-${b.id}">${escapeHtml(b.text)}</textarea>
    <p class="copy-fail" id="cb-f-${b.id}" hidden>Press Ctrl+C (⌘C on Mac) to copy.</p>` : '<p class="muted">Nothing written yet</p>'}
  </section>`).join('');
  copyDlg.open($('#copy-blocks [data-copy-block]') || $('#copy-done'));
}
$('#copy-btn').addEventListener('click', openCopySheet);
$('#copy-x').addEventListener('click', () => copyDlg.close());
$('#copy-done').addEventListener('click', () => copyDlg.close());
$('#copy-blocks').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-copy-block]'); if (!btn) return;
  const b = copyBlocks.find((x) => x.id === btn.dataset.copyBlock);
  if (await copy(b.text)) {
    btn.textContent = '✓ Copied'; announce(b.label + ' copied.');
    setTimeout(() => { if (document.contains(btn)) btn.textContent = 'Copy'; }, 2000);
  } else {
    // Copy failed: select the text so the judge can copy it by hand.
    const ta = $('#cb-t-' + b.id); $('#cb-f-' + b.id).hidden = false; ta.focus(); ta.select();
  }
});

// ----- Print / PDF (spec 4.10, Q20) -----
// The dialog builds #print-sheet from L.printModel, so long text prints in full, and removes it after printing.
const printDlg = modalDialog($('#print-dialog'), $('#print-card'), { name: 'print', rank: 85 });
let printSaved = null; // a saved ballot from Ballots, or null for the round on screen
function openPrintDialog(saved) {
  if (typeof window.print !== 'function') return toast('Printing is not available in this browser. Use Copy for the tournament ballot instead.', { kind: 'error' });
  printSaved = saved || null;
  $('#print-extras').hidden = Boolean(saved);
  $('#print-saved-note').hidden = !saved;
  syncOrient();
  printDlg.open($('#print-go'));
}
function syncOrient() { const land = !printSaved && $('#print-flow').checked; document.querySelector(`input[name="print-orient"][value="${land ? 'landscape' : 'portrait'}"]`).checked = true; }
$('#print-flow').addEventListener('change', syncOrient); // Landscape when the flow is included
$('#print-btn').addEventListener('click', () => openPrintDialog());
$('#print-x').addEventListener('click', () => printDlg.close());
$('#print-cancel').addEventListener('click', () => printDlg.close());
function currentPrintModel(opts) {
  const o = opts || {};
  const lens = R.analysis.lens[L.lensKey(R.ai.paradigm || 'policymaker', S.customParadigm) + (lvl() === 'expert' ? '' : '|' + lvl())];
  const imp = LV().impacts && LV().impacts.data;
  const km = L.keyMoments(R.analysis.map && R.analysis.map.data).map((k) => k.text).join('\n');
  return L.printModel(R, { ...o, range: ptsRangeNow(), liveEval: LV().liveEval && LV().liveEval.data,
    analysis: [['Paradigm Lens', lens && lens.data ? lens.data.rfd : ''], ['Impact Calculus', imp ? [imp.weighing_done, imp.comparison].filter(Boolean).join('\n\n') : ''], ['Key moments', km]] });
}
function buildPrintSheet(model) {
  const e = escapeHtml;
  removePrintSheet();
  const el = document.createElement('div');
  el.id = 'print-sheet'; el.className = 'print-sheet' + (model.orientation === 'landscape' ? ' landscape' : '');
  el.innerHTML = `<h1>${e(model.title)}</h1>` + model.sections.map((s) => {
    if (s.kind === 'facts') return s.items.length ? '<dl class="ps-facts">' + s.items.map(([k, v]) => `<div><dt>${e(k)}</dt><dd>${e(v)}</dd></div>`).join('') + '</dl>' : '';
    if (s.kind === 'winner') return `<h2>${e(s.title)}</h2><p class="ps-win">${e(s.text)}</p>`;
    if (s.kind === 'speakers') return `<h2>${e(s.title)}</h2><table><thead><tr><th>Speaker</th><th>Name</th><th>Points</th><th>Rank</th></tr></thead><tbody>${s.rows.map((r) => `<tr><td class="${r.side}">${r.speaker}</td><td>${e(r.name)}</td><td>${e(r.pts)}</td><td>${e(r.rank)}</td></tr>`).join('')}</tbody></table>`;
    if (s.kind === 'flow') return `<h2>${e(s.title)}</h2><table class="ps-flow"><thead><tr>${s.cols.map((c) => `<th class="${c.side}">${e(c.label)}</th>`).join('')}</tr></thead><tbody><tr>${s.cols.map((c) => `<td class="${c.side}">${e(c.text)}</td>`).join('')}</tr></tbody></table>`;
    return `<h2 class="${s.side || ''}">${e(s.title)}</h2><div class="ps-text">${e(s.text) || '<span class="muted">Nothing written.</span>'}</div>`;
  }).join('');
  document.body.append(el); document.body.classList.add('printing');
}
function removePrintSheet() { const old = $('#print-sheet'); if (old) old.remove(); document.body.classList.remove('printing'); }
$('#print-go').addEventListener('click', () => {
  const orientation = document.querySelector('input[name="print-orient"]:checked').value;
  const model = printSaved ? L.printModel(printSaved.round, { range: printSaved.ptsRange, orientation })
    : currentPrintModel({ flow: $('#print-flow').checked, transcripts: $('#print-tr').checked, aiNotes: $('#print-ai').checked, orientation });
  printDlg.close();
  buildPrintSheet(model);
  // A frame later, so the dialog is gone and focus is back before the print window opens.
  setTimeout(() => {
    try { window.print(); } catch { removePrintSheet(); toast('Printing is not available in this browser. Use Copy for the tournament ballot instead.', { kind: 'error' }); }
  }, 50);
});
// The browser's own Print menu still prints the full ballot (the sheet is built just before, then removed).
addEventListener('beforeprint', () => { if (!$('#print-sheet')) buildPrintSheet(currentPrintModel({})); });
addEventListener('afterprint', () => removePrintSheet());

// ---------- log (Ballots) ----------
function renderLog() {
  const log = store.get(LOG, []);
  if (!log.length) { $('#log-table').innerHTML = '<tr><td class="muted">No saved ballots yet. Save one from Decide → Ballot.</td></tr>'; return; }
  const cols = L.LOG_COLUMNS;
  $('#log-table').innerHTML = '<tr>' + cols.map((i) => `<th>${L.BALLOT_HEADER[i]}</th>`).join('') + '<th><span class="sr-only">Actions</span></th></tr>'
    + log.map((r, n) => '<tr>' + cols.map((i) => `<td>${escapeHtml(r[i] ?? '')}</td>`).join('')
      + `<td class="log-acts"><button class="b small" type="button" data-print-log="${n}" aria-label="Print the saved ballot from ${escapeHtml(r[0] || 'an unknown date')}">Print</button><button class="iconbtn" type="button" data-del="${n}" aria-label="Delete saved ballot from ${escapeHtml(r[0] || 'an unknown date')}">×</button></td></tr>`).join('');
}
$('#log-table').addEventListener('click', (e) => {
  const pr = e.target.closest('[data-print-log]');
  if (pr) { const entry = store.get(LOG, [])[Number(pr.dataset.printLog)]; if (entry) openPrintDialog(L.savedBallotView(entry)); return; }
  const btn = e.target.closest('[data-del]'); if (!btn) return;
  const { list, undo } = L.removeAt(store.get(LOG, []), Number(btn.dataset.del));
  if (!undo) return;
  store.set(LOG, list); renderLog();
  undoToast('Saved ballot deleted.', 'delete saved ballot', () => { store.set(LOG, L.restoreAt(store.get(LOG, []), undo.index, undo.item)); renderLog(); }, 'Saved ballot restored.');
});
// The spreadsheet exports live here (spec 4.1 [A]); each saved ballot gives its row without the extra data at the end.
$('#log-tsv').addEventListener('click', () => copyToast(L.toTSV([L.BALLOT_HEADER, ...store.get(LOG, []).map(L.savedBallotRow)])));
$('#log-csv').addEventListener('click', () => download('policy_ballots.csv', L.toCSV([L.BALLOT_HEADER, ...store.get(LOG, []).map(L.savedBallotRow)])));

// ---------- theme (V10, Q3) ----------
// Light / Dark / System in Settings, System by default. assets/theme-boot.js drew the saved theme before the page
// painted; a change here draws at once and is saved with the other settings (other open tabs follow).
function renderTheme() {
  const v = S.theme === 'light' || S.theme === 'dark' ? S.theme : 'system';
  document.querySelectorAll('input[name="theme"]').forEach((r) => { r.checked = r.value === v; });
}
document.addEventListener('change', (e) => {
  if (e.target.name !== 'theme') return;
  S.theme = e.target.value; saveSettings(); window.TabulaTheme.set(S.theme);
});

// ---------- start ----------
restoreClocksOnLoad();
bindAll(); renderSpeeches(); renderClock(); renderPrep(); renderTranscript(); renderRecStrip(); renderRecNotice(); renderTheme();
$('#t-start').dataset.tip = K.startTip(IS_MAC, S.singleKeys !== false);
renderConnections(); checkHelper(); renderReadLevel(); renderRange(); applyPanes(); renderAudio(); listMics();
showTab(R.tab || 'flow'); renderPrepPresets(); showDrawer(Boolean(S.trDrawer)); resumeClips();
renderSdList(); if (sdState().code) { sdFetchList(true); sdWatch(); } // resume watching this round's SpeechDrop room
booted = true;
if (L.shouldShowWelcome({ setupDone: S.setupDone, hostedPlan })) openWelcome();
else maybeD2Note();

