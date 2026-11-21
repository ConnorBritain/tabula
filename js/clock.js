// Clocks: the speech timer, prep, the clocks after a reload or sleep, a second tab on the same round,
// and the settings object (S).
// One part of the page code (see app.js for the load order). The parts are classic scripts that share one global
// scope, so a part can use what any part declares; code that runs at load only uses parts that load before it.
'use strict';

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
  renderClockViewSpeeches();
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
  // One clock, drawn into both places: the round bar and the narrow clock view (spec 5.6b).
  renderClockInto($('#clock'), shown);
  renderClockInto($('#cv-clock'), shown);
  $('#cur-label').innerHTML = `<span class="${s.side}">${s.label}</span> <span class="muted">${s.speaker} · ${s.minutes} min</span>`;
  const verb = R.run ? 'Pause' : (leftFor(s) < fullTime(s) ? 'Resume' : 'Start');
  $('#t-start').textContent = verb;
  renderClockView(s, shown, verb);
  renderChip();
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
// The clock face: the time, and the last-30-s and over-time looks (the words beside it carry the meaning).
function renderClockInto(el, shown) {
  if (!el) return;
  el.textContent = L.formatClock(shown);
  el.classList.toggle('low', shown <= 30 && shown > 0);
  el.classList.toggle('over', shown <= 0);
}
// The narrow clock view (spec 5.6b): the speech line, the clock and its status word, the big Start / Pause / Resume
// button, Previous / Next speech with their reasons at the ends, and the 4×3 speech grid. Cheap: text and attributes.
function renderClockView(s, shown, verb) {
  $('#cv-speech').textContent = L.speechLine(s.id);
  $('#cv-status').textContent = L.clockStatus(Boolean(R.run), shown);
  $('#cv-start').textContent = verb;
  // "Pauses the 1NC" under the prep cards while a speech runs: a prep start pauses it.
  const pauses = L.prepPausesLine(R.run && R.run.id);
  if ($('#cv-pauses').textContent !== pauses) $('#cv-pauses').textContent = pauses;
  for (const [id, dir] of [['#cv-prev', -1], ['#cv-next', 1]]) {
    const st = L.stepSpeechState(R.cur, dir), b = $(id);
    if (st.disabled) { b.setAttribute('aria-disabled', 'true'); b.dataset.tip = st.reason; }
    else { b.removeAttribute('aria-disabled'); delete b.dataset.tip; }
  }
}
function renderClockViewSpeeches() {
  const runId = R.run && R.run.id;
  $('#cv-speech-list').innerHTML = L.SPEECHES.map((x, i) => {
    const isRun = x.id === runId;
    const name = L.shortSpeech(x.id);
    return `<button type="button" class="sp ${x.side} ${i === R.cur ? 'on' : ''}${isRun ? ' run' : ''}" data-i="${i}" aria-label="${x.label}${isRun ? ', running' : ''}"${i === R.cur ? ' aria-current="true"' : ''}>${name}</button>`;
  }).join('');
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
  studyStart(s.id); // study mode (5.7): the first 1AC Start, by any method; does nothing unless ?study=1
  recStoppedByReload = false;
  saveClocks(); startTick(); renderClock(); renderSpeeches();
  if ($('#rec-on').checked) wantRec();
  renderRecStrip(); syncInsightsReady(); // the round now has something to read
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
// The clock view's tiles only change the view, like the pane's tiles (spec 1.2, 5.6b).
$('#cv-speech-list').addEventListener('click', (e) => { const b = e.target.closest('.sp'); if (b) selectSpeech(Number(b.dataset.i)); });
$('#view-back').addEventListener('click', backToRunning);
$('#t-start').addEventListener('click', toggleClock);
$('#cv-start').addEventListener('click', toggleClock);
// Reset and Next speech act on the running speech if one runs (pausing first returns the view to it); else on the viewed speech.
function resetSpeechClock() { pauseSpeech(); delete R.timeLeft[sp().id]; saveClocks(); renderClock(); renderSpeeches(); }
function stepSpeech(dir) {
  const st = L.stepSpeechState(R.cur, dir);
  if (st.disabled) return false;
  pauseSpeech(); selectSpeech(Math.max(0, Math.min(L.SPEECHES.length - 1, R.cur + dir)));
  return true;
}
$('#t-reset').addEventListener('click', resetSpeechClock);
$('#t-next').addEventListener('click', () => { pauseSpeech(); selectSpeech(Math.min(L.SPEECHES.length - 1, R.cur + 1)); });
// The clock view's Previous / Next speech say why at the ends (aria-disabled keeps them focusable, so the tip is read).
$('#cv-prev').addEventListener('click', () => { if (!stepSpeech(-1)) toast(L.stepSpeechState(R.cur, -1).reason + '.'); });
$('#cv-next').addEventListener('click', () => { if (!stepSpeech(1)) toast(L.stepSpeechState(R.cur, 1).reason + '.'); });
// The clock view's Reset gives an Undo toast (spec 5.6b): the speech gets its time back.
$('#cv-reset').addEventListener('click', () => {
  // The speech it resets and the time it had: the running one (pausing returns the view to it), else the viewed one.
  const s = runSp();
  const before = R.run ? Math.max(L.OVER_LIMIT, (R.run.endAt - Date.now()) / 1000) : R.timeLeft[s.id];
  resetSpeechClock();
  undoToast(L.shortSpeech(s.id) + ' clock reset.', 'reset ' + L.shortSpeech(s.id) + ' clock', () => {
    if (R.run && R.run.id === s.id) return false;
    if (before == null) delete R.timeLeft[s.id]; else R.timeLeft[s.id] = before;
    saveClocks(); renderClock(); renderSpeeches();
  }, L.shortSpeech(s.id) + ' clock restored.');
});
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
    // The round bar and the narrow clock view show the same prep clocks (spec 5.6b).
    for (const el of [$('#prep-' + side), $('#cv-prep-' + side)]) {
      el.textContent = L.formatClock(Math.max(0, Math.ceil(left)));
      tone(el, left <= 0 ? 'error' : '');
    }
    const name = side === 'aff' ? 'Aff' : 'Neg';
    document.querySelectorAll(`[data-prep="${side}"]`).forEach((b) => {
      b.textContent = mine ? 'Stop' : 'Start';
      if (b.closest('#clock-view')) b.setAttribute('aria-label', (mine ? 'Stop ' : 'Start ') + name + ' prep');
    });
    if (mine && left <= 0) { stopPrep(); beep(); }
  }
  renderChip();
}
function stopPrep() {
  if (!R.prepRun) return;
  R.prepLeft[R.prepRun.side] = Math.max(0, (R.prepRun.endAt - Date.now()) / 1000);
  clearInterval(prepTick); prepTick = null; R.prepRun = null; saveClocks(); renderPrep();
}
function togglePrep(side) {
  if (R.prepRun && R.prepRun.side === side) return stopPrep();
  stopPrep(); pauseSpeech();
  if (R.prepLeft[side] <= 0) return toast(side.toUpperCase() + ' has no prep left');
  R.prepRun = { side, endAt: Date.now() + R.prepLeft[side] * 1000 };
  saveClocks(); startPrepTick(); renderPrep();
}
document.querySelectorAll('[data-prep]').forEach((b) => b.addEventListener('click', () => togglePrep(b.dataset.prep)));
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
