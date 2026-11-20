// Tabula app: everything that runs in the page. Loaded as a module by index.html after logic.js, providers.js and tour.js.
// It lives in its own file so the Content-Security-Policy can forbid inline scripts.
// Tabula running on this computer (through the local helper), not on the website.
const LOCAL_ORIGIN = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
const L = window.PolicyLogic;
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
    try { localStorage.setItem(k, JSON.stringify(v)); return true; }
    catch { toast('Warning: this browser is NOT saving. Copy your flow somewhere safe.'); return false; }
  },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};

// Prep per team for a new round: the judge's last choice, else the NSDA 8 minutes.
function prepDefault() {
  const m = Number((store.get('policyJudge.settings.v1', {}) || {}).prepMin);
  return Number.isFinite(m) && m >= 0 && m <= 20 ? m * 60 : L.DEFAULT_PREP_SECONDS;
}
function freshRound() {
  return {
    tournament: '', roundName: '', judge: '', topic: '',
    aff: { team: '', d1: '', d2: '' }, neg: { team: '', d1: '', d2: '' },
    prepSeconds: prepDefault(),
    prepLeft: { aff: prepDefault(), neg: prepDefault() },
    flows: L.DEFAULT_FLOWS.map((name) => ({ name, cells: {} })),
    transcripts: {}, timeLeft: {}, aiFlows: [], aiFlowAt: 0, flowView: 'mine',
    ai: { paradigm: 'policymaker', notes: '', evidence: '', output: '' },
    ballot: { winner: '', pts: {}, ranks: {}, rfd: '' },
    id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())), cur: 0, flowIdx: 0, tab: 'flow',
  };
}
let R = Object.assign(freshRound(), store.get(STORE, {}));
R.id ??= String(Date.now());
// Save at once so the round id is fixed before any doc is tied to it.
store.set(STORE, R);
// While a backup is being restored, nothing may write the old in-memory data back.
let restoring = false;
const save = () => (restoring ? false : store.set(STORE, R));

function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('on'), 1800); }
const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
function setPath(o, p, v) { const ks = p.split('.'); const last = ks.pop(); ks.reduce((a, k) => (a[k] ??= {}), o)[last] = v; }
async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast('Copied'); }
  catch { const ta = document.createElement('textarea'); ta.value = text; document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove(); toast('Copied'); }
}
function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: type || 'text/csv' }));
  a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}
const safeName = (s) => (s || 'round').replace(/[^\w-]+/g, '_');

// ---------- tabs ----------
// Four places plus Settings. Each place shows one or more of the old sections.
const PLACES = [['flow', 'Flow'], ['setup', 'Round'], ['decide', 'Decide'], ['log', 'Library']];
const PLACE_OF = { setup: 'setup', timer: 'flow', flow: 'flow', eval: 'decide', analysis: 'decide', ballot: 'decide', draft: 'decide', log: 'log', ai: 'ai' };
function showTab(id) {
  if (id === 'decide') id = R.lastDecide || 'eval';
  if (id === 'timer') id = 'flow';
  if (!PLACE_OF[id]) id = 'setup';
  const place = PLACE_OF[id];
  R.tab = id; if (place === 'decide') R.lastDecide = id; save();
  const shown = place === 'flow' ? ['tab-timer', 'tab-flow'] : ['tab-' + id];
  document.querySelectorAll('section.tab').forEach((s) => s.classList.toggle('on', shown.includes(s.id)));
  $('#workspace').classList.toggle('on', place === 'flow');
  $('#subnav').hidden = place !== 'decide';
  document.querySelectorAll('#subnav button').forEach((b) => b.classList.toggle('on', b.dataset.tab === id));
  document.querySelectorAll('#nav button').forEach((b) => { const on = b.dataset.tab === place; b.classList.toggle('on', on); if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  if (place === 'ai') $('#settings-btn').setAttribute('aria-current', 'page'); else $('#settings-btn').removeAttribute('aria-current');
  if (id === 'ballot') renderBallot();
  if (id === 'log') { renderLog(); renderBackup(); }
  if (id === 'flow') { renderFlow(); renderInsights(); }
  if (id === 'eval') renderEval();
  if (id === 'analysis') renderAnalysis();
}
$('#nav').setAttribute('aria-label', 'Sections');
$('#nav').innerHTML = PLACES.map(([id, t]) => `<button data-tab="${id}">${t}</button>`).join('');
document.querySelector('.brand').addEventListener('click', (e) => { e.preventDefault(); showTab('flow'); });
$('#nav').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) showTab(b.dataset.tab); });
$('#subnav').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) showTab(b.dataset.tab); });
$('#settings-btn').addEventListener('click', () => showTab('ai'));
// Side panes in the Flow workspace can be hidden; the choice is remembered.
function applyPanes() {
  $('#workspace').classList.toggle('no-left', Boolean(S.hideLeft));
  $('#workspace').classList.toggle('no-right', Boolean(S.hideRight));
}
document.addEventListener('click', (e) => {
  const b = e.target.closest && e.target.closest('[data-pane]'); if (!b) return;
  if (b.dataset.pane === 'left') S.hideLeft = !S.hideLeft; else S.hideRight = !S.hideRight;
  saveSettings(); applyPanes();
});

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
// A ballot field the judge types into is theirs: the AI ballot filler will not overwrite it.
function markTouched(path) {
  if (!path.startsWith('ballot.')) return;
  const f = path.slice(7);
  if (L.BALLOT_FIELDS.includes(f)) (R.ballot.touched ??= {})[f] = true;
}

$('#prep-min').value = Math.round(R.prepSeconds / 60);
$('#prep-min').addEventListener('change', (e) => {
  const m = Math.max(0, Math.min(20, Number(e.target.value) || 0));
  const used = prepRun || R.prepLeft.aff < R.prepSeconds || R.prepLeft.neg < R.prepSeconds;
  if (used && !confirm('Prep is already in use. Reset both teams to ' + m + ' minutes?')) { e.target.value = Math.round(R.prepSeconds / 60); return; }
  stopPrep(); R.prepSeconds = m * 60; R.prepLeft = { aff: m * 60, neg: m * 60 }; save(); renderPrep();
  S.prepMin = m; saveSettings(); renderPrepPresets();
});
function renderPrepPresets() { document.querySelectorAll('[data-prep-min]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.prepMin) * 60 === R.prepSeconds))); }
document.addEventListener('click', (e) => {
  const b = e.target.closest && e.target.closest('[data-prep-min]'); if (!b) return;
  $('#prep-min').value = b.dataset.prepMin; $('#prep-min').dispatchEvent(new Event('change'));
});
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
    if (!confirm('Open "' + file.name + '"?\n\nIt replaces the round on screen. The current round downloads as a .tab file first, so nothing is lost.')) return;
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
  const oldId = R.id;
  R = Object.assign(freshRound(), opened.round, { tab: 'flow', started: true });
  save();
  docStore.clearRound(oldId).finally(() => location.reload());
});
$('#new-round').addEventListener('click', () => {
  if (!confirm('Clear this round? Saved ballots in the Log stay.')) return;
  resetting = true; stopAll();
  const oldId = R.id;
  R = freshRound(); save();
  docStore.clearRound(oldId).finally(() => location.reload());
});

// ---------- speech timer ----------
const sp = () => L.SPEECHES[R.cur];
const fullTime = (s) => s.minutes * 60;
const leftFor = (s) => (R.timeLeft[s.id] ?? fullTime(s));
let running = null; // { endAt }
let tick = null;

function renderSpeeches() {
  $('#speech-list').innerHTML = L.SPEECHES.map((s, i) => {
    const done = R.timeLeft[s.id] != null && R.timeLeft[s.id] < fullTime(s);
    const hasTr = (R.transcripts[s.id] || '').trim() ? ' · transcript' : '';
    const short = s.id.replace('CX-', 'CX ');
    const info = done ? L.formatClock(Math.ceil(leftFor(s))) + ' left' : s.minutes + ' min';
    return `<button class="sp ${s.side} ${i === R.cur ? 'on' : ''}" data-i="${i}" title="${s.label} · ${s.side.toUpperCase()}${hasTr}"${i === R.cur ? ' aria-current="true"' : ''}>${short}${hasTr ? '<i class="sp-dot" aria-label="has transcript"></i>' : ''}<small>${info}</small></button>`;
  }).join('');
}
function renderClock() {
  const s = sp();
  const left = running ? (running.endAt - Date.now()) / 1000 : leftFor(s);
  const shown = Math.ceil(left);
  const c = $('#clock');
  c.textContent = L.formatClock(shown);
  c.classList.toggle('low', shown <= 30 && shown > 0);
  c.classList.toggle('over', shown <= 0);
  $('#cur-label').innerHTML = `<span class="${s.side}">${s.label}</span> <span class="muted">${s.speaker} · ${s.minutes} min</span>`;
  $('#t-start').textContent = running ? 'Pause' : (leftFor(s) < fullTime(s) ? 'Resume' : 'Start');
  $('#mini-speech').textContent = `${s.label} ${L.formatClock(shown)}`;
  if (running && left <= 0 && !running.beeped) { running.beeped = true; beep(); }
}
function selectSpeech(i) {
  pauseSpeech();
  R.cur = i; save();
  renderSpeeches(); renderClock(); renderTranscript();
}
function startSpeech() {
  stopPrep();
  if (!R.started) { R.started = true; save(); renderStart(); }
  running = { endAt: Date.now() + leftFor(sp()) * 1000 };
  tick = setInterval(renderClock, 200);
  renderClock();
  if ($('#rec-on').checked) startRec();
}
function pauseSpeech() {
  if (!running) return;
  R.timeLeft[sp().id] = Math.max(-599, (running.endAt - Date.now()) / 1000);
  running = null; clearInterval(tick); save();
  const wasBrowserRec = recWanted && activeEngine === 'browser';
  stopRec(); renderClock(); renderSpeeches();
  if (wasBrowserRec) scheduleFlow(sp().id, true);
}
$('#speech-list').addEventListener('click', (e) => { const b = e.target.closest('.sp'); if (b) selectSpeech(Number(b.dataset.i)); });
$('#t-start').addEventListener('click', () => (running ? pauseSpeech() : startSpeech()));
$('#t-reset').addEventListener('click', () => { pauseSpeech(); delete R.timeLeft[sp().id]; save(); renderClock(); renderSpeeches(); });
$('#t-next').addEventListener('click', () => selectSpeech(Math.min(L.SPEECHES.length - 1, R.cur + 1)));
document.addEventListener('keydown', (e) => {
  if (e.code !== 'Space' || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
  if (!$('#welcome').hidden || !$('#node-editor').hidden || tourState) return;
  // Let Space type in text boxes. Anywhere else on this tab (even on a just-clicked
  // button or the Transcribe checkbox) Space must start or pause the clock, not "click" again.
  const el = document.activeElement;
  const typing = el && (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.tagName === 'SUMMARY' || el.tagName === 'A' || el.isContentEditable || (el.tagName === 'INPUT' && !['checkbox', 'radio', 'button'].includes(el.type)));
  if (typing) return;
  e.preventDefault();
  if (el && el.blur) el.blur();
  running ? pauseSpeech() : startSpeech();
});

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
let prepRun = null; // { side, endAt, h }
function renderPrep() {
  for (const side of ['aff', 'neg']) {
    const left = prepRun && prepRun.side === side ? (prepRun.endAt - Date.now()) / 1000 : R.prepLeft[side];
    const el = $('#prep-' + side);
    el.textContent = L.formatClock(Math.max(0, Math.ceil(left)));
    el.style.color = left <= 0 ? 'var(--danger)' : '';
    document.querySelector(`[data-prep="${side}"]`).textContent = prepRun && prepRun.side === side ? 'Stop' : 'Start';
    if (prepRun && prepRun.side === side && left <= 0) { stopPrep(); beep(); }
  }
}
function stopPrep() {
  if (!prepRun) return;
  R.prepLeft[prepRun.side] = Math.max(0, (prepRun.endAt - Date.now()) / 1000);
  clearInterval(prepRun.h); prepRun = null; save(); renderPrep();
}
document.querySelectorAll('[data-prep]').forEach((b) => b.addEventListener('click', () => {
  const side = b.dataset.prep;
  if (prepRun && prepRun.side === side) return stopPrep();
  stopPrep(); pauseSpeech();
  if (R.prepLeft[side] <= 0) return toast(side.toUpperCase() + ' has no prep left');
  prepRun = { side, endAt: Date.now() + R.prepLeft[side] * 1000, h: setInterval(renderPrep, 200) };
  renderPrep();
}));
function stopAll() { pauseSpeech(); stopPrep(); }

// ---------- settings (kept across rounds) ----------
const SETTINGS = 'policyJudge.settings.v1', OAKEY = 'policyJudge.openaiKey';
const S = Object.assign({ engine: 'openai', chunkSec: 8, liveFlow: true }, store.get(SETTINGS, {}));
delete S.model; // an old, unused transcription default
const saveSettings = () => (restoring ? false : store.set(SETTINGS, S));

// ---------- transcription ----------
// Two engines:
//  - 'openai': the mic is recorded in short clips; each clip goes to OpenAI's
//    transcription API. Better accuracy, about one clip behind live.
//  - 'browser': the browser's own speech-to-text (free, weaker).
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null, recWanted = false, recSpeechId = null;
let recGen = 0, resetting = false;
let mic = null, clipRec = null, clipTimer = null, clipQueue = Promise.resolve(), clipsPending = 0;

// A big, plain status line under the clock, so a judge always knows if audio is being captured.
let recProblem = '', lastTextAt = 0;
function setRecStatus() {
  const el = $('#rec-status');
  if (!el) return;
  if (recProblem) { el.style.color = 'var(--danger)'; el.textContent = 'Not transcribing: ' + recProblem; return; }
  if (!$('#rec-on').checked) { el.style.color = 'var(--muted)'; el.textContent = 'Transcribe is off. Tick the box to record.'; return; }
  if (!recWanted) { el.style.color = 'var(--muted)'; el.textContent = 'Ready. Recording starts when the speech clock starts.'; return; }
  const ago = lastTextAt ? Math.round((Date.now() - lastTextAt) / 1000) : null;
  const engine = activeEngine === 'browser' ? 'browser' : P.PROVIDERS[activeEngine].short;
  const stall = L.stallWarning({ startedAt: recStartedAt, lastTextAt, now: Date.now(), mode: S.audioMode });
  if (stall) { el.style.color = 'var(--warn)'; el.textContent = 'Recording (' + engine + '). ' + stall; return; }
  el.style.color = 'var(--ok)';
  el.textContent = 'Recording (' + engine + ')' + (ago != null ? ' · last text ' + ago + ' s ago' : ' · waiting for first text…');
}
setInterval(setRecStatus, 1000);
// Remember the Transcribe box across refreshes (it was resetting to off).
$('#rec-on').checked = S.recOn !== false;
$('#rec-on').addEventListener('change', (e) => {
  S.recOn = e.target.checked; saveSettings(); recProblem = ''; setRecStatus();
  // Ticking it while the clock runs starts recording right away; unticking stops it.
  if (running && e.target.checked && !recWanted) startRec();
  if (!e.target.checked && recWanted) stopRec();
});

function setRecNote(extra) {
  const eng = S.trEngine;
  const base = eng !== 'browser' && P.PROVIDERS[eng]
    ? P.PROVIDERS[eng].name + ' transcription, a new clip every ' + S.chunkSec + ' s.'
    : (SR ? 'Browser speech-to-text (Chrome sends audio to Google). Free but weak on fast speech. Connect Gemini, OpenAI or Grok in "AI + Keys" for better text.' : 'This browser has no speech-to-text. Connect Gemini, OpenAI or Grok in "AI + Keys".');
  $('#rec-note').textContent = base + (S.liveFlow ? ' Live AI flow is on.' : '') + (extra ? ' — ' + extra : '');
  // A problem (extra) lights up the (?) next to the transcript title, so it is not missed.
  document.querySelector('.tr-head .tip').classList.toggle('warn', Boolean(extra));
}

let activeEngine = 'browser', recStartedAt = 0;
function startRec() {
  if (testing) testAbort = true; // a speech starting ends the mic test
  recWanted = true; recSpeechId = sp().id; recGen++; recProblem = ''; recStartedAt = Date.now();
  activeEngine = S.trEngine || 'browser';
  // The chosen engine has no key (for example after a refresh)? Use the free browser engine instead of failing silently.
  if (activeEngine !== 'browser' && !keys[activeEngine]) {
    if (SR) { toast('No ' + P.PROVIDERS[activeEngine].short + ' key, so using the free browser transcription.'); activeEngine = 'browser'; }
    else { recWanted = false; recProblem = 'no key for ' + P.PROVIDERS[activeEngine].name + '. Connect it in "AI + Keys".'; renderRecBadge(); setRecStatus(); return; }
  }
  if (activeEngine !== 'browser') startOpenAIRec(); else startBrowserRec();
  renderRecBadge(); setRecStatus();
}
function stopRec() {
  recWanted = false;
  if (rec) { try { rec.stop(); } catch {} rec = null; }
  clearTimeout(clipTimer);
  if (clipRec && clipRec.state !== 'inactive') clipRec.stop();
  clipRec = null;
  stopStream();
  if (mic) { mic.getTracks().forEach((t) => t.stop()); mic = null; }
  meterShow(false);
  renderRecBadge();
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
  m.title = 'Mic level: ' + info.label;
  m.setAttribute('aria-label', 'Mic level: ' + info.label);
}
function renderRecBadge() {
  $('#mini-rec').innerHTML = (recWanted ? '<span class="rec-dot"></span>REC ' : '') + (clipsPending ? '· transcribing… ' : '') + (flowBusy ? '· AI flowing…' : '');
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
  rec.onerror = (ev) => {
    if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') { recWanted = false; recProblem = 'the microphone is blocked. Click the mic icon in the address bar and allow it.'; setRecStatus(); }
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
    recWanted = false; renderRecBadge();
    recProblem = 'the microphone is blocked or busy (' + (err && err.name || 'error') + '). Click the mic icon in the address bar and allow it.';
    setRecStatus(); return;
  }
  // The judge may have paused (or paused and restarted) while the mic was opening.
  // A mic opened for a cancelled start is closed, so it never stays live.
  if (gen !== recGen || !recWanted) { if (got !== mic) got.getTracks().forEach((t) => t.stop()); return; }
  if (mic && mic !== got) mic.getTracks().forEach((t) => t.stop());
  mic = got;
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
  queueClip(new Blob([L.encodeWav(all, sess.sr)], { type: 'audio/wav' }), sess.speechId, isFinal, overlap);
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
  const parts = [];
  const r = new MediaRecorder(mic);
  r.ondataavailable = (e) => { if (e.data && e.data.size) parts.push(e.data); };
  r.onstop = () => {
    const isFinal = !recWanted || recSpeechId !== speechId;
    const blob = new Blob(parts, { type: r.mimeType || 'audio/webm' });
    if (blob.size > 3000) queueClip(blob, speechId, isFinal);
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

// Clips are sent one at a time, so text always lands in order.
let trError = false;
function queueClip(blob, speechId, isFinal, overlap) {
  clipsPending++; renderRecBadge();
  clipQueue = clipQueue.then(async () => {
    try {
      let text = await transcribeClip(blob, R.transcripts[speechId] || '');
      if (resetting) return;
      // On silence the model sometimes repeats the vocabulary hint. Drop that.
      if (text.includes('policy debate. Terms:')) text = '';
      if (text) {
        if (overlap) text = L.mergeOverlap(R.transcripts[speechId], text);
        R.transcripts[speechId] = L.appendChunk(R.transcripts[speechId], text); save();
        lastTextAt = Date.now();
        if (sp().id === speechId) setTranscriptView(R.transcripts[speechId]);
        renderSpeeches();
      }
      if (trError) { trError = false; setRecNote(''); recProblem = ''; }
    } catch (err) {
      trError = true;
      setRecNote('transcription error: ' + err.message);
      recProblem = 'OpenAI error: ' + err.message;
      setRecStatus();
    } finally {
      clipsPending--; renderRecBadge();
      // The last clip of a speech forces one final flow pass.
      scheduleFlow(speechId, isFinal);
    }
  });
}

function blobToBase64(blob) {
  return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1] || ''); fr.onerror = () => rej(fr.error); fr.readAsDataURL(blob); });
}
// Sends one audio clip to the chosen provider and returns the words.
async function transcribeClip(blob, prevText) {
  const eng = activeEngine;
  const key = keys[eng];
  const ext = /wav/.test(blob.type) ? 'wav' : /mp4/.test(blob.type) ? 'mp4' : /ogg/.test(blob.type) ? 'ogg' : 'webm';
  if (eng !== 'openai' && eng !== 'xai' && eng !== 'google') throw new Error('this engine cannot transcribe');
  const audio = eng === 'google' ? await blobToBase64(blob) : null;
  let res;
  try {
    res = await withModel(eng, 'transcribe', (model) => {
      const { url, init } = transcribeRequest(eng, key, model, blob, ext, audio, prevText);
      // A stuck request must not block every clip after it, so give up after 30 s.
      return fetch(url, { ...init, signal: AbortSignal.timeout(30000) });
    });
  } catch (err) {
    if (err && err.name === 'TimeoutError') throw new Error('no reply in 30 s; skipped one clip');
    if (err && !(err instanceof TypeError)) throw err; // a real error with its own message (fetch network failures are TypeErrors)
    // Some error replies carry no browser (CORS) header, so a bad key can look like a network failure.
    throw new Error('no reply. Check the ' + P.PROVIDERS[eng].short + ' key and the internet connection');
  }
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(friendlyError(res.status, j));
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
    setRecNote('AI flow error: ' + err.message);
    if (err.status === 413 || /too long|too large|exceed/i.test(err.message || '')) {
      S.liveFlow = false; saveSettings(); $('#live-flow').checked = false; flowPending.clear();
      toast('Live AI flow turned off: the docs + transcript are too big. Remove a doc, then turn it back on.');
    } else if (err.message !== lastFlowErr) toast('AI flow failed: ' + err.message);
    lastFlowErr = err.message || String(err) || 'unknown error';
    console.warn('AI flow failed:', err);
  } finally {
    flowBusy = false; flowRunningId = null; renderRecBadge();
    pumpFlow();
  }
}

function renderTranscript() {
  $('#tr-label').textContent = sp().label;
  $('#tr-drawer-label').textContent = sp().label;
  setTranscriptView(R.transcripts[sp().id] || '');
}
// The transcript shows in two places: the left pane and the big drawer above the round bar. Both stay in sync.
function setTranscriptView(text) {
  for (const el of [$('#transcript'), $('#transcript-big')]) {
    if (el.value === text) continue;
    // Keep the view at the newest words, unless the judge scrolled up to read.
    const atEnd = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    el.value = text;
    if (atEnd && document.activeElement !== el) el.scrollTop = el.scrollHeight;
  }
}
for (const id of ['#transcript', '#transcript-big']) {
  $(id).addEventListener('input', (e) => { R.transcripts[sp().id] = e.target.value; save(); setTranscriptView(e.target.value); });
}
function showDrawer(on) {
  S.trDrawer = on; saveSettings();
  $('#tr-drawer').hidden = !on;
  $('#tr-toggle').setAttribute('aria-expanded', String(on));
  $('#tr-toggle').classList.toggle('on', on);
  document.body.classList.toggle('drawer-open', on);
  if (on) { const t = $('#transcript-big'); t.scrollTop = t.scrollHeight; }
}
$('#tr-toggle').addEventListener('click', () => showDrawer($('#tr-drawer').hidden));
// The (?) next to the transcript title: a click opens or closes it; hovering opens it only after 2 s,
// so passing over it with the mouse does not cover the transcript.
(() => {
  const wrap = document.querySelector('.tr-head .tip-wrap'), btn = wrap.querySelector('.tip');
  let timer = null, pinned = false;
  const set = (on) => { wrap.classList.toggle('open', on); btn.setAttribute('aria-expanded', String(on)); };
  wrap.addEventListener('mouseenter', () => { if (!pinned) timer = setTimeout(() => set(true), 2000); });
  wrap.addEventListener('mouseleave', () => { clearTimeout(timer); if (!pinned) set(false); });
  btn.addEventListener('click', () => {
    clearTimeout(timer);
    const open = wrap.classList.contains('open');
    pinned = !open || !pinned; // closed -> open and stay; open from hover -> stay; open and pinned -> close
    set(pinned);
  });
  document.addEventListener('click', (e) => { if (pinned && !wrap.contains(e.target)) { pinned = false; set(false); } });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && wrap.classList.contains('open')) { pinned = false; set(false); } });
})();
$('#tr-drawer-close').addEventListener('click', () => showDrawer(false));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#tr-drawer').hidden && !tourState) showDrawer(false); });
// The drawer sits just above the round bar, which can wrap to two lines on narrow screens.
new ResizeObserver(([en]) => document.documentElement.style.setProperty('--rb-h', Math.ceil(en.target.getBoundingClientRect().height) + 'px')).observe(document.querySelector('.roundbar'));

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
    + '<button data-act="add">+ Sheet</button><button data-act="rename">Rename</button><button data-act="del">Delete</button>';
  $('#flow').innerHTML = L.FLOW_COLUMNS.map((c, i) => `<div class="col ${c.side}"><h3>${c.label}</h3><textarea data-col="${i}" spellcheck="false">${escapeHtml((f.cells || {})[i] || '')}</textarea></div>`).join('');
}
function viewToggle() {
  return `<button data-view="mine" class="${R.flowView !== 'ai' ? 'on' : ''}">My flow</button><button data-view="ai" class="${R.flowView === 'ai' ? 'on' : ''}">AI flow</button><span style="width:12px"></span>`;
}
let aiIdx = 0;
function agoText(t) {
  if (!t) return 'never';
  const sec = Math.round((Date.now() - t) / 1000);
  return sec < 90 ? sec + ' s ago' : Math.round(sec / 60) + ' min ago';
}
function flowStatusHtml() {
  if (flowBusy) return '<span style="color:var(--ok)">AI is flowing… (10–30 s)</span>';
  if (lastFlowErr) return '<span style="color:var(--danger)">Last AI flow failed: ' + escapeHtml(lastFlowErr) + '</span>';
  if (!aiReady()) return '<span style="color:var(--danger)">No AI is set up. Open "AI + Keys" to connect one.</span>';
  if (!S.liveFlow) return '<span style="color:var(--danger)">Live AI flow is off. Tick it in "AI + Keys".</span>';
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
  if (!aiReady()) return toast('No AI is set up. Open "AI + Keys" to connect one.');
  if (!S.liveFlow) { S.liveFlow = true; saveSettings(); $('#live-flow').checked = true; toast('Turned Live AI flow on.'); }
  const speeches = [...new Set(DOCS.map((d) => L.docSpeech(d)).filter((sp) => sp && L.speechColumn(sp) != null))];
  if (!speeches.length) return toast(DOCS.length ? 'Your docs are all set to "Context only". Pick a speech for each doc on the Setup tab.' : 'No docs yet. Add them in Round or in the Flow workspace.');
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
    + '<span style="width:12px"></span>' + L.FLOW_LEVELS.map((lv) => `<button data-level="${lv}" class="${lv === level ? 'on' : ''}">${lv[0].toUpperCase() + lv.slice(1)}</button>`).join('')
    + '<span style="width:12px"></span><button data-act="map-docs">Map docs to flow now</button>'
    + `<span class="muted" style="margin-left:var(--s2)" id="ai-flow-ago">Updated ${ago}.</span>`
    + `<div id="ai-flow-status" style="flex-basis:100%;font-weight:600;margin-top:var(--s1)">${flowStatusHtml()}</div>`;
  const sh = sheets[aiIdx];
  // Every cell can be edited. An edited cell keeps the judge's text; if the AI writes something newer
  // underneath, a small bar offers "Use AI" or "Keep mine".
  $('#flow').innerHTML = sh
    ? L.FLOW_COLUMNS.map((c, i) => {
      const ed = sh.edits && sh.edits[i];
      const behind = L.editIsBehind(sh, i);
      return `<div class="col ${c.side}"><h3>${c.label}${ed ? ' <span class="chip con" title="You edited this cell. AI updates will not overwrite it.">Edited</span>' : ''}</h3>`
        + (behind ? `<div class="aibar">AI has a newer version. <button data-ai-use="${i}">Use AI</button><button data-ai-keep="${i}">Keep mine</button></div>` : ed ? `<div class="aibar quiet"><button data-ai-use="${i}">Undo my edit</button></div>` : '')
        + `<textarea data-aicol="${i}" spellcheck="false" aria-label="${c.label} column, ${escapeHtml(sh.name)}">${escapeHtml(L.flowCellText(sh, i, level))}</textarea></div>`;
    }).join('')
    : '<p class="muted" style="grid-column:1/-1">No AI flow yet. Click "Map docs to flow now" to flow your docs, or tick "Transcribe" in the round bar and start a speech. Needs AI connected and Live AI flow on (in "AI + Keys").</p>';
}
$('#flow-tabs').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.view) { R.flowView = b.dataset.view; save(); return renderFlow(); }
  if (b.dataset.ai != null) { aiIdx = Number(b.dataset.ai); return renderFlow(); }
  if (b.dataset.level) { R.flowLevel = b.dataset.level; save(); return renderFlow(); }
  if (b.dataset.act === 'map-docs') return mapDocsNow();
  if (b.dataset.i != null) R.flowIdx = Number(b.dataset.i);
  else if (b.dataset.act === 'add') { const n = prompt('Sheet name (e.g. Econ DA, Cap K, Spending T)'); if (!n) return; R.flows.push({ name: n, cells: {} }); R.flowIdx = R.flows.length - 1; }
  else if (b.dataset.act === 'rename') { const n = prompt('New name', R.flows[R.flowIdx].name); if (!n) return; R.flows[R.flowIdx].name = n; }
  else if (b.dataset.act === 'del') { if (R.flows.length < 2 || !confirm('Delete sheet "' + R.flows[R.flowIdx].name + '"?')) return; R.flows.splice(R.flowIdx, 1); R.flowIdx = 0; }
  save(); renderFlow();
});
$('#flow').addEventListener('input', (e) => {
  const aicol = e.target.dataset.aicol;
  if (aicol != null) {
    const sh = (R.aiFlows || [])[aiIdx]; if (!sh) return;
    const wasEdited = Boolean(sh.edits && sh.edits[aicol]);
    (sh.edits ??= {})[aicol] = { text: e.target.value, base: (sh.edits[aicol] && sh.edits[aicol].base) ?? L.aiFlowCell(sh, Number(aicol), 'standard') };
    save();
    if (!wasEdited) { const h = e.target.parentElement.querySelector('h3'); if (h && !h.querySelector('.chip')) h.insertAdjacentHTML('beforeend', ' <span class="chip con">Edited</span>'); }
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
// Long-hover tips: any element with data-tip shows it after 1 s of hovering (or at once on keyboard focus).
(() => {
  const tip = document.createElement('div'); tip.className = 'hover-tip'; tip.setAttribute('role', 'tooltip'); tip.hidden = true;
  document.body.appendChild(tip);
  let timer = null, cur = null;
  const show = (el) => {
    tip.textContent = el.dataset.tip; tip.hidden = false;
    const r = el.getBoundingClientRect(), w = tip.offsetWidth;
    tip.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px';
    tip.style.top = (r.bottom + 6) + 'px';
  };
  const hide = () => { clearTimeout(timer); timer = null; cur = null; tip.hidden = true; };
  document.addEventListener('mouseover', (e) => {
    const el = e.target.closest && e.target.closest('[data-tip]');
    if (el === cur) return;
    hide();
    if (el) { cur = el; timer = setTimeout(() => show(el), 1000); }
  });
  document.addEventListener('focusin', (e) => { const el = e.target.closest && e.target.closest('[data-tip]'); if (el && e.target.matches(':focus-visible')) { cur = el; show(el); } });
  for (const ev of ['focusout', 'mousedown', 'scroll', 'keydown']) document.addEventListener(ev, hide, true);
})();
function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

// ---------- round documents ----------
// Docs can be large (PDFs), so they live in IndexedDB, not localStorage.
// If IndexedDB is not available, they are kept in memory for this page only.
let DOCS = [];
const docStore = {
  db: null,
  async open() {
    if (this.db) return this.db;
    this.db = await new Promise((res, rej) => {
      const r = indexedDB.open('policyJudge', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('docs', { keyPath: 'id' });
      let failed = false;
      r.onsuccess = () => { if (failed) r.result.close(); else res(r.result); };
      r.onerror = () => { failed = true; rej(r.error); };
      r.onblocked = () => { failed = true; rej(new Error('storage blocked')); };
    }).catch((e) => { this.db = null; throw e; });
    return this.db;
  },
  async tx(mode, fn) {
    // Never let a stuck browser database freeze the app: the whole step must finish in 3 s.
    let timer;
    const timeout = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('storage timed out')), 3000); });
    const work = (async () => {
      const db = await this.open();
      return new Promise((res, rej) => {
        const t = db.transaction('docs', mode); const req = fn(t.objectStore('docs'));
        t.oncomplete = () => res(req && req.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('storage aborted'));
      });
    })();
    try { return await Promise.race([work, timeout]); } finally { clearTimeout(timer); }
  },
  async list(roundId) { return ((await this.tx('readonly', (st) => st.getAll())) || []).filter((d) => d.roundId === roundId); },
  put(doc) { if (restoring) return Promise.resolve(); return this.tx('readwrite', (st) => st.put(doc)); }, // no stray writes during a restore
  del(id) { return this.tx('readwrite', (st) => st.delete(id)); },
  async clearRound(roundId) { try { for (const d of await this.list(roundId)) await this.del(d.id); } catch {} },
};

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
  return `<select data-doc-speech="${d.id}" style="width:auto" title="Which speech this doc belongs to. It is mapped onto that speech's flow column.">`
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
        <span class="sd-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}${done ? ' · added' : SD.fresh.has(sdKey(f)) ? '<span class="sd-new">new</span>' : ''}</span>
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
  const cur = sp();
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
  if (d.speech && !S.liveFlow) toast('Turn on "Live AI flow" in AI + Keys to map docs onto the flow.');
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

// ---------- AI decision ----------
// ---------- reading level ----------
// Results are saved per reading level, so switching is instant and does not re-ask the AI.
S.readLevel ??= 'expert';
const lvl = () => (L.READING_LEVELS[S.readLevel] ? S.readLevel : 'expert');
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
  document.querySelectorAll('[data-read]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.read === lvl())));
}
document.addEventListener('click', (e) => {
  const b = e.target.closest && e.target.closest('[data-read]');
  if (!b) return;
  S.readLevel = b.dataset.read; saveSettings(); renderReadLevel();
  $('#ai-out').textContent = LV().output || 'No draft at this reading level yet. Click "Generate decision draft".';
  if (R.tab === 'eval') renderEval();
  if (R.tab === 'analysis') renderAnalysis();
});

// ---------- AI connections ----------
// Keys are kept per provider. With "Remember" on (the default) they are saved in this browser.
const P = window.Providers;
const KEYS = 'policyJudge.keys.v1';
S.rememberKeys ??= true;
const keys = Object.assign({}, store.get(KEYS, {}));
// Move keys saved by older versions of the app.
(() => { const a = store.get(KEY, ''), o = store.get(OAKEY, ''); if (a && !keys.anthropic) keys.anthropic = a; if (o && !keys.openai) keys.openai = o; })();
S.models = P.cleanSavedModels(S.models); // older versions saved premium or retired models
S.modelChoice ??= {}; // models the judge picked in Settings (these win over automatic picks)
S.modelLists ??= {}; // each provider's chat models, for the picker
S.helper = {};
// With several keys, start with the best value for the live flow (see evals/live-flow/RESULTS.md).
if (!S.aiEngine) S.aiEngine = ['openai', 'google', 'anthropic', 'xai'].find((p) => keys[p]) || '';
if (!S.trEngine) S.trEngine = S.engine === 'openai' && keys.openai ? 'openai' : 'browser';
// Old single-key entries are removed only once the keys are safely saved in the new place.
function saveKeys() { if (restoring) return; if (S.rememberKeys) { if (store.set(KEYS, keys)) { store.del(KEY); store.del(OAKEY); } } else store.del(KEYS); }
saveKeys();
const aiReady = () => {
  const e = S.aiEngine;
  if (!e) return false;
  if (P.SUBSCRIPTIONS[e]) return Boolean(S.helper[e]);
  return Boolean(keys[e]);
};
const NO_AI = 'No AI is set up. Open "AI + Keys" to connect one.';

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
  const res = await fetch(req.url, req.init);
  if (!res.ok) throw new Error('could not read the model list (' + res.status + ')');
  const ids = P.modelIds(provider, await res.json());
  S.modelLists[provider] = P.chatModels(provider, ids);
  const id = P.pickModel(provider, ids, purpose);
  if (!id) throw new Error(P.chatModels(provider, ids).some(P.isPremium)
    ? 'this key only has premium models, which cost much more. Choose one under Settings → ' + P.PROVIDERS[provider].name + ' if you want it'
    : 'no suitable ' + purpose + ' model found for ' + P.PROVIDERS[provider].name);
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

function friendlyError(status, body) {
  const raw = body && body.error;
  const msg = typeof raw === 'string' ? raw : (raw && raw.message) || '';
  if (status === 401 || status === 403 || /invalid.*key|api key not valid|incorrect api key/i.test(msg)) return 'this key was rejected. Copy it again, or create a new one.';
  if (status === 429 && /quota|credit|billing|balance/i.test(msg)) return 'the key works but has no credit. Add credit under Billing on the provider\'s site.';
  if (status === 429) return 'too many requests right now. Wait a moment and try again.';
  if (status === 404) return 'the model was not found. Pick another one under Settings, or click Test to refresh the list.';
  return status + ' ' + String(msg || JSON.stringify(body || {})).slice(0, 200);
}

// Text docs with students' names swapped for positions. PDFs go as they are (their text cannot be edited here).
// File names are swapped too ("Smith 1NC.docx" is a name the AI would see in the doc list).
const anonDocs = (docs) => docs.map((d) => ({ ...d, name: L.anonymize(d.name, R), data: d.kind === 'pdf' ? d.data : L.anonymize(d.data, R) }));
// One way to ask the AI for anything. schema = JSON Schema for a JSON reply, or null for plain text.
// kind = 'flow' | 'routine' | 'ballot' | 'decision': sets the output cap; ballot and decision use the mid-tier ("deep") model.
// docs = only the docs this call needs. The live flow sends one speech's docs; Live Eval, analysis, ballot and
// decision judge the whole round, so they keep the default (all of them).
async function callAI({ system, prompt, note, schema, effort = 'medium', reading, kind = 'routine', docs = DOCS }) {
  const maxTokens = P.outputCap(kind);
  const purpose = kind === 'ballot' || kind === 'decision' ? 'deep' : 'ai';
  const eng = S.aiEngine;
  if (!aiReady()) throw new Error(NO_AI);
  // Reading level: the same analysis, worded for an expert judge or in plain words.
  if (reading) system = system + '\n\n' + L.readingGuide(reading);
  // Students' names are swapped for positions (1A, 2N...) in everything typed or transcribed, and in text docs,
  // before it goes to the AI; names come back in the reply. PDFs are sent as they are (their text cannot be edited here).
  system = L.anonymize(system, R); prompt = L.anonymize(prompt, R);
  docs = anonDocs(docs);
  let text;
  if (eng === 'anthropic') {
    const client = await getClaude();
    const msg = await withModel('anthropic', purpose, (model) => {
      const params = P.claudeParams(model, {
        max_tokens: maxTokens, thinking: { type: 'adaptive' }, output_config: { effort },
        system, messages: [{ role: 'user', content: L.buildUserContent(docs, prompt, note) }],
      });
      if (schema) params.output_config.format = { type: 'json_schema', schema };
      return client.beta.messages.create(params);
    });
    if (msg.stop_reason === 'refusal') throw new Error('Claude declined this request');
    if (msg.stop_reason === 'max_tokens') throw new Error('the reply was cut off. Try again');
    text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  } else if (P.SUBSCRIPTIONS[eng]) {
    // The subscription helper has no per-token bill, so it gets no output cap.
    const docText = P.docsAsText(docs, L.docTitle);
    const res = await fetch('/api/ai', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ engine: eng, system, prompt: (docText ? docText + '\n\n' + (note || L.DOC_NOTE) + '\n\n' : '') + prompt, schema, model: eng === 'codex-cli' ? (S.codexModel || '') : undefined }),
      signal: AbortSignal.timeout(300000),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || ('the helper said ' + res.status));
    text = j.text || '';
  } else {
    const res = await withModel(eng, purpose, (model) => {
      const req = P.buildAIRequest(eng, { key: keys[eng], model, system, prompt, docs, schema, title: L.docTitle, note: note || L.DOC_NOTE, maxTokens });
      return fetch(req.url, { ...req.init, signal: AbortSignal.timeout(240000) });
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(friendlyError(res.status, j));
    text = P.parseAIResponse(eng, j);
  }
  return L.deanonymize(schema ? P.extractJson(text) : text, R);
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
        <span class="pill ${on ? 'ok-pill' : ''}">${on ? 'Connected' : 'Not set up'}</span>
        ${capText(p)}
        <span style="flex:1"></span>
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
}
async function connectKey(raw) {
  const key = String(raw || '').trim();
  const msg = $('#key-msg');
  const id = P.detectProvider(key);
  if (!key) { msg.style.color = 'var(--danger)'; msg.textContent = 'Paste a key first.'; return; }
  if (!id) { msg.style.color = 'var(--danger)'; msg.textContent = 'This does not look like a key from Google (AIza…), OpenAI (sk-…), Anthropic (sk-ant-…) or xAI (xai-…). Check that you copied all of it.'; return; }
  const p = P.PROVIDERS[id];
  msg.style.color = 'var(--muted)'; msg.textContent = 'Looks like ' + aOrAn(p.name) + ' key. Checking it…';
  $('#key-connect').disabled = true;
  try {
    const req = P.modelsRequest(id, key);
    let res;
    try { res = await fetch(req.url, { ...req.init, signal: AbortSignal.timeout(15000) }); }
    catch { throw new Error('no reply. A rejected key can look like this too: copy it again, and check your internet.'); }
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(friendlyError(res.status, j));
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
    msg.style.color = 'var(--ok)';
    msg.textContent = 'Connected ' + p.name + (p.transcribe ? ' — it can do AI tools and transcription.' : ' — it does AI tools. Transcription stays the free browser kind.');
    renderConnections(); setRecNote(''); setRecStatus();
  } catch (err) {
    msg.style.color = 'var(--danger)';
    msg.textContent = 'Could not connect ' + p.name + ': ' + (err.message || err);
  } finally { $('#key-connect').disabled = false; }
}
$('#key-connect').addEventListener('click', () => connectKey($('#key-paste').value));
$('#key-paste').addEventListener('keydown', (e) => { if (e.key === 'Enter') connectKey($('#key-paste').value); });
$('#key-paste').addEventListener('input', (e) => {
  const id = P.detectProvider(e.target.value);
  const m = $('#key-msg'); m.style.color = 'var(--muted)';
  m.textContent = id ? 'Looks like ' + aOrAn(P.PROVIDERS[id].name) + ' key. Click Connect.' : '';
});
$('#prov-list').addEventListener('click', (e) => {
  const del = e.target.dataset.provDel, tst = e.target.dataset.provTest;
  if (del) { if (!confirm('Remove the ' + P.PROVIDERS[del].name + ' key from this computer?')) return; delete keys[del]; delete S.models[del]; delete S.modelChoice[del]; delete S.modelLists[del]; saveKeys(); renderConnections(); setRecNote(''); }
  if (tst) connectKey(keys[tst]);
});
$('#ai-engine').addEventListener('change', (e) => { S.aiEngine = e.target.value; saveSettings(); });
$('#tr-engine').addEventListener('change', (e) => { S.trEngine = e.target.value; saveSettings(); setRecNote(''); });
$('#remember-keys').addEventListener('change', (e) => { S.rememberKeys = e.target.checked; saveKeys(); saveSettings(); });

// Subscriptions: the local helper (bridge.mjs) runs the Claude Code or Codex app already signed in on this Mac.
// The helper runs from the folder Tabula was downloaded to, so the command is relative to that folder.
const HELPER_CMD = 'node bridge.mjs';

async function checkHelper() {
  // The helper only exists on the judge's own computer. On the hosted site there is nothing to ask.
  if (!LOCAL_ORIGIN) { S.helper = {}; renderConnections(); return; }
  try {
    const r = await fetch('/api/health', { signal: AbortSignal.timeout(3000) });
    const j = r.ok ? await r.json() : {};
    S.helper = { 'claude-cli': Boolean(j.claude), 'codex-cli': Boolean(j.codex) };
  } catch { S.helper = {}; }
  renderConnections();
}
function renderSubscriptions() {
  if (!LOCAL_ORIGIN) {
    $('#sub-body').innerHTML = '<p style="margin:0">A Claude or ChatGPT plan works only in the downloadable version of Tabula, on a Mac, through a small helper app. On this website, connect an API key above instead.</p>';
    return;
  }
  const h = S.helper || {};
  const running = h['claude-cli'] || h['codex-cli'];
  $('#sub-body').innerHTML = running
    ? 'Helper running. ' + [h['claude-cli'] ? 'Claude subscription (Claude Code)' : '', h['codex-cli'] ? 'ChatGPT subscription (Codex)' : ''].filter(Boolean).join(' and ') + ' found. Pick it under "AI tools use" above. Each answer takes 10–30 s. PDFs are not read on this path; save docs as .docx or text.'
      + (h['codex-cli'] ? `<div style="margin-top:var(--s2)"><label for="codex-model">Codex model (optional; leave empty to use your Codex setting)</label><input id="codex-model" value="${escapeHtml(S.codexModel || '')}" placeholder="a model your ChatGPT plan includes"></div>` : '')
    : `<p style="margin:0 0 var(--s2)">A ChatGPT Plus or Claude Pro plan cannot be used by a web page directly. This app can use it through the official Claude Code or Codex app that is already signed in on this Mac.</p>
       <ol style="margin:0 0 var(--s2);padding-left:20px"><li>Sign in once in Terminal with <code>claude</code> (Claude) or <code>codex</code> (ChatGPT).</li>
       <li>Start this app with the helper instead of the plain server: <code>${escapeHtml(HELPER_CMD)}</code> (in the Tabula folder) <button class="b" id="copy-helper">Copy</button></li>
       <li>Open <code>http://localhost:8765</code> again and click <button class="b" id="recheck-helper">Check again</button></li></ol>
       <p style="margin:0">Transcription stays the free browser kind on this path.</p>`;
}
document.addEventListener('change', (e) => { if (e.target.id === 'codex-model') { S.codexModel = e.target.value.trim(); saveSettings(); } });
document.addEventListener('click', (e) => {
  if (e.target.id === 'copy-helper') copy(HELPER_CMD);
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
  btn.disabled = true; out.style.color = 'var(--muted)'; out.textContent = 'Listening… talk normally from where the speaker stands.';
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
    if (testAbort) { out.style.color = 'var(--muted)'; out.textContent = 'Mic test stopped because a speech started.'; }
    else {
      const v = L.micTestVerdict(samples);
      out.style.color = v.ok ? 'var(--ok)' : 'var(--warn)';
      out.textContent = v.text;
    }
    listMics(); // names show up once the mic has been allowed
  } catch (err) {
    out.style.color = 'var(--danger)';
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
  if (!$('#welcome').hidden || !$('#node-editor').hidden) return; // never on top of another dialog
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
  if ((step.target === '#speech-list' || step.target === '#tab-timer') && S.hideLeft) { S.hideLeft = false; applyPanes(); }
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
  S.hideLeft = st.hideLeft; S.hideRight = st.hideRight; applyPanes();
  if (st.name === 'main') S.tourDone = true;
  saveSettings();
  if (st.place) showTab(st.place); // back to where the judge was
  if (st.returnFocus && st.returnFocus.focus) st.returnFocus.focus();
}
function tourGo(d) {
  const n = TOURS.TOURS[tourState.name].steps.length;
  const i = tourState.i + d;
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
  if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); tourEnd(false); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); e.stopImmediatePropagation(); tourGo(1); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopImmediatePropagation(); tourGo(-1); }
  else if (e.key === 'Tab') { // keep focus inside the tour card
    const f = [...$('#tour-card').querySelectorAll('button:not([disabled])')];
    const i = f.indexOf(document.activeElement);
    e.preventDefault(); f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
  }
}, true);
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
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#help-menu').hidden) { closeHelpMenu(); $('#help-btn').focus(); } });
// The gentle offer after the welcome screen (never on top of a dialog).
function offerTour() { if (!S.tourDone && !S.tourOffered) { S.tourOffered = true; saveSettings(); $('#tour-offer').hidden = false; } }
$('#tour-offer-go').addEventListener('click', () => tourStart('main'));
$('#tour-offer-no').addEventListener('click', () => { $('#tour-offer').hidden = true; toast('You can take the tour any time from the ? button.'); });

// ---------- welcome screen ----------
function showWelcome(on) {
  $('#welcome').hidden = !on;
  $('#skip-box').hidden = true; $('#welcome-choices').hidden = false;
  if (on) setTimeout(() => $('#welcome .choice').focus(), 0);
}
$('#welcome-choices').addEventListener('click', (e) => {
  const c = e.target.closest('[data-choice]'); if (!c) return;
  if (c.dataset.choice === 'skip') { $('#welcome-choices').hidden = true; $('#skip-box').hidden = false; $('#skip-ack').focus(); return; }
  S.setupDone = true; saveSettings(); showWelcome(false); showTab('ai'); setTimeout(offerTour, 400);
  if (c.dataset.choice === 'key') setTimeout(() => $('#key-paste').focus(), 0);
  else { $('#sub-box').open = true; setTimeout(() => $('#sub-box').scrollIntoView({ block: 'center' }), 0); }
});
$('#skip-ack').addEventListener('change', (e) => { $('#skip-go').disabled = !e.target.checked; });
$('#skip-go').addEventListener('click', () => { S.setupDone = true; S.aiSkipped = true; saveSettings(); showWelcome(false); showTab('setup'); setTimeout(offerTour, 400); });
$('#skip-back').addEventListener('click', () => showWelcome(true));
$('#show-welcome').addEventListener('click', () => showWelcome(true));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#welcome').hidden && S.setupDone) showWelcome(false); });

$('#chunk-sec').value = S.chunkSec; $('#live-flow').checked = S.liveFlow;
$('#chunk-sec').addEventListener('change', (e) => { S.chunkSec = Math.max(4, Math.min(30, Number(e.target.value) || 8)); e.target.value = S.chunkSec; saveSettings(); setRecNote(''); });
$('#live-flow').addEventListener('change', (e) => { S.liveFlow = e.target.checked; saveSettings(); setRecNote(''); });
setRecNote('');
$('#ai-out').textContent = LV().output || 'No draft yet.';
$('#ai-copy-prompt').addEventListener('click', () => {
  const textDocs = DOCS.filter((d) => d.kind !== 'pdf').map((d) => '=== ' + L.docTitle(d) + ' ===\n' + d.data).join('\n\n');
  const pdfs = DOCS.filter((d) => d.kind === 'pdf').map((d) => d.name);
  copy(L.anonymize(L.JUDGE_SYSTEM + '\n\n' + (textDocs ? textDocs + '\n\n' : '') + (DOCS.length ? L.DOC_NOTE + '\n\n' : '') + L.buildJudgePrompt(R, DOCS), R));
  if (pdfs.length) toast('Copied. Attach these PDFs by hand: ' + pdfs.join(', '));
});

$('#ai-go').addEventListener('click', async () => {
  if (!aiReady()) return toast(NO_AI + ' Or use "Copy prompt instead".');
  const btn = $('#ai-go'), status = $('#ai-status'), out = $('#ai-out');
  btn.disabled = true; status.textContent = 'Starting…'; out.textContent = '';
  const level = lvl(), box = LV(level); // a draft belongs to the reading level it was asked for
  try {
    if (S.aiEngine !== 'anthropic') {
      status.textContent = 'Thinking with ' + $('#ai-engine').selectedOptions[0].textContent + '… (can take a minute)';
      const text = await callAI({ system: L.JUDGE_SYSTEM, prompt: L.buildJudgePrompt(R, DOCS), note: L.DOC_NOTE, schema: null, effort: 'high', reading: level, kind: 'decision' });
      out.textContent = text; box.output = text; save();
      status.textContent = 'Done. Read it, then decide.';
      return;
    }
    const client = await getClaude();
    status.textContent = 'Thinking… (can take a minute)';
    const msg = await withModel('anthropic', 'deep', (model) => {
      out.textContent = '';
      const stream = client.beta.messages.stream(P.claudeParams(model, {
        max_tokens: P.outputCap('decision'),
        thinking: { type: 'adaptive' },
        output_config: { effort: 'high' },
        system: L.JUDGE_SYSTEM + '\n\n' + L.readingGuide(level),
        messages: [{ role: 'user', content: L.buildUserContent(anonDocs(DOCS), L.anonymize(L.buildJudgePrompt(R, DOCS), R)) }],
      }));
      let raw = '';
      stream.on('text', (t) => { raw += t; out.textContent = L.deanonymize(raw, R); }); // names back in, live
      return stream.finalMessage();
    });
    if (msg.stop_reason === 'refusal') {
      status.textContent = 'Claude declined this request. Decide by hand, or edit the input and try again.';
    } else {
      const text = L.deanonymize(msg.content.filter((b) => b.type === 'text').map((b) => b.text).join(''), R);
      out.textContent = text;
      box.output = text; save();
      status.textContent = msg.stop_reason === 'max_tokens' ? 'Done, but the reply was cut off at the length limit. Use it as a start, or click again.' : 'Done. Read it, then decide.';
    }
  } catch (err) {
    status.textContent = 'Error: ' + (err && err.message ? err.message : String(err));
  } finally { btn.disabled = false; }
});
$('#ai-use').addEventListener('click', () => {
  const text = LV().output || '';
  if (!text) return toast('No draft yet');
  const w = L.parseDecision(text);
  if (w) R.ballot.winner = w;
  R.ballot.rfd = L.parseRfd(text);
  const fb = L.parseFeedback(text);
  R.ballot.affFb = fb.aff;
  R.ballot.negFb = fb.neg;
  Object.assign((R.ballot.touched ??= {}), { winner: Boolean(w), rfd: true, affFb: true, negFb: true });
  save(); bindAll(); showTab('ballot'); toast('Copied to ballot. Edit it in your own words.');
});

// ---------- live eval ----------
let evalBusy = false, evalAgain = false, evalErr = '', evalSoonTimer = null;
// Auto updates wait 20 s after the last flow pass, so mapping several docs at once costs one eval, not one each.
function scheduleEvalSoon() {
  clearTimeout(evalSoonTimer);
  evalSoonTimer = setTimeout(scheduleEval, 20000);
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
    if (R.tab !== 'eval') toast('Live Eval failed: ' + evalErr);
  } finally {
    evalBusy = false; renderEvalStatus(); renderInsights();
    if (evalAgain && !resetting) { evalAgain = false; runEval(); }
  }
}
function renderEvalStatus() {
  const el = $('#eval-status'); if (!el) return;
  $('#eval-go').disabled = evalBusy;
  if (evalBusy) { el.style.color = 'var(--ok)'; el.textContent = 'Updating… (20–60 s)'; }
  else if (evalErr) { el.style.color = 'var(--danger)'; el.textContent = 'Last update failed: ' + evalErr; }
  else if (!aiReady()) { el.style.color = 'var(--danger)'; el.textContent = 'No AI is set up. Open "AI + Keys" to connect one.'; }
  else el.textContent = '';
  const ev = LV().liveEval;
  const now = L.speechesSoFar(R);
  const newer = ev ? now.filter((id) => !(ev.through || []).includes(id)) : [];
  $('#eval-meta').innerHTML = ev ? escapeHtml('Last updated ' + agoText(ev.at) + ', through ' + ((ev.through || []).length ? ev.through[ev.through.length - 1] : 'no speeches') + '.')
    + (newer.length ? ' <span class="pill" style="color:var(--warn)">Out of date: ' + escapeHtml(newer.join(', ')) + ' happened since. Click Update now.</span>' : '') : '';
}
setInterval(() => { if (R.tab === 'eval') renderEvalStatus(); }, 5000);
const sideClass = (x) => (x === 'aff' ? 'aff' : x === 'neg' ? 'neg' : '');
const sideLabel = (x) => ({ aff: 'Aff', neg: 'Neg', even: 'Even', unclear: 'Unclear', 'toss-up': 'Toss-up' }[x] || x);
// The small Live Eval summary in the Flow workspace.
function renderInsights() {
  const box = document.getElementById('insights-body'); if (!box) return;
  const e = escapeHtml;
  const entry = LV().liveEval, ev = entry && entry.data;
  const btn = aiReady() ? `<button class="b small" id="ins-update"${evalBusy ? ' disabled' : ''}>${evalBusy ? 'Updating…' : 'Update'}</button>` : '';
  const open = '<button class="b small" data-tab-go="eval">Open Live Eval</button>';
  if (!ev) {
    box.innerHTML = `<p class="muted" style="margin:0 0 var(--s2)">${aiReady() ? 'No read of the round yet. It updates after each speech, or now:' : 'Connect AI in Settings to get a live read of the round here.'}</p><div class="row">${btn}${open}</div>`;
    return;
  }
  const lean = ev.leaning || {};
  box.innerHTML = `<div class="ins-lean ${sideClass(lean.side)}">Leaning ${e(sideLabel(lean.side))}${lean.side === 'aff' && R.aff.team ? ' (' + e(R.aff.team) + ')' : lean.side === 'neg' && R.neg.team ? ' (' + e(R.neg.team) + ')' : ''}</div>
    <p class="muted" style="margin:2px 0 var(--s2)">${e(lean.confidence || '')} confidence · ${e(agoText(entry.at))}</p>
    <p style="margin:0 0 var(--s2);font-size:var(--fs-sm)">${e(lean.why || '')}</p>
    <h2 style="font-size:var(--fs-sm);margin:var(--s3) 0 0">Listen for next</h2>
    <ul class="ins-list">${(ev.watch_for || []).slice(0, 4).map((w) => '<li>' + e(w) + '</li>').join('')}</ul>
    <div class="row" style="margin-top:var(--s3)">${btn}${open}</div>`;
}
document.addEventListener('click', (e) => {
  if (e.target.id === 'ins-update') { scheduleEval(); setTimeout(renderInsights, 0); }
  const go = e.target.closest && e.target.closest('[data-tab-go]');
  if (go) showTab(go.dataset.tabGo);
});
function renderEval() {
  renderEvalStatus();
  const ev = LV().liveEval && LV().liveEval.data;
  if (!ev) { $('#eval-body').innerHTML = '<div class="card muted">No eval yet. Click "Update now".</div>'; return; }
  const e = escapeHtml;
  const lean = ev.leaning || {};
  const team = lean.side === 'aff' ? R.aff.team : lean.side === 'neg' ? R.neg.team : '';
  const fb = (ev.feedback || []).map((f) => `<div class="card" style="margin:0">
      <div class="row" style="justify-content:space-between"><strong class="${String(f.speaker || '').endsWith('A') ? 'aff' : 'neg'}">${e(f.speaker)} ${e(nameOf(f.speaker) !== f.speaker ? '· ' + nameOf(f.speaker) : '')}</strong><span class="muted">Points so far: ${e(f.points)}</span></div>
      <p style="margin:var(--s2) 0">${e(f.so_far)}</p>
      <p style="margin:var(--s1) 0"><span class="good">+</span> ${e(f.strength)}</p>
      <p style="margin:var(--s1) 0"><span class="neg">Fix:</span> ${e(f.fix)}</p></div>`).join('');
  $('#eval-body').innerHTML = `
    <div class="card">
      <div class="lean ${sideClass(lean.side)}">Leaning: ${e(sideLabel(lean.side))}${team ? ' (' + e(team) + ')' : ''} <span class="pill">${e(lean.confidence || '')} confidence</span></div>
      <p style="margin:var(--s2) 0 0">${e(lean.why || '')}</p>
    </div>
    <div class="card"><h2>State of the round</h2><p style="margin:0">${e(ev.summary || '')}</p></div>
    <div class="card"><h2>Key issues</h2><div class="scroll"><table>
      <thead><tr><th>Issue</th><th>Ahead</th><th>Why</th></tr></thead>
      <tbody>${(ev.key_issues || []).map((k) => `<tr><td>${e(k.issue)}</td><td><span class="pill ${sideClass(k.ahead)}">${e(sideLabel(k.ahead))}</span></td><td>${e(k.note)}</td></tr>`).join('')}</tbody>
    </table></div></div>
    <div class="card"><h2>Listen for next</h2><ul style="margin:0;padding-left:20px">${(ev.watch_for || []).map((w) => '<li>' + e(w) + '</li>').join('')}</ul></div>
    <div class="grid">
      <div class="card"><h2 class="aff">Aff needs to</h2><p style="margin:0">${e(ev.aff_needs || '')}</p></div>
      <div class="card"><h2 class="neg">Neg needs to</h2><p style="margin:0">${e(ev.neg_needs || '')}</p></div>
    </div>
    <div class="card"><div class="row" style="justify-content:space-between"><h2 style="margin:0">Feedback so far</h2><button class="b" id="eval-to-ballot">Copy feedback to ballot</button></div>
      <div class="grid" style="margin-top:var(--s3)">${fb}</div></div>`;
}
$('#eval-go').addEventListener('click', () => {
  if (!aiReady()) return toast('No AI is set up. Open "AI + Keys" to connect one.');
  scheduleEval();
});
$('#auto-eval').checked = S.autoEval !== false;
S.autoEval = $('#auto-eval').checked;
$('#auto-eval').addEventListener('change', (e) => { S.autoEval = e.target.checked; saveSettings(); });
document.addEventListener('click', (e) => {
  if (e.target.id !== 'eval-to-ballot') return;
  const fb = (LV().liveEval && LV().liveEval.data && LV().liveEval.data.feedback) || [];
  if (((R.ballot.affFb || '').trim() || (R.ballot.negFb || '').trim()) && !confirm('Replace the comments already in the Aff/Neg boxes on the Ballot tab?')) return;
  const join = (side) => fb.filter((f) => String(f.speaker || '').endsWith(side) && !/^not yet/i.test(f.points || ''))
    .map((f) => f.speaker + ': ' + f.so_far + ' Strength: ' + f.strength + ' Fix: ' + f.fix).join('\n');
  R.ballot.affFb = join('A'); R.ballot.negFb = join('N'); save(); bindAll();
  toast('Copied into the Aff and Neg comment boxes on the Ballot tab.');
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
  if (!aiReady()) return toast('No AI is set up. Open "AI + Keys" to connect one.');
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
    + (newer.length ? ' <span class="pill" style="color:var(--warn)">Out of date: ' + escapeHtml(newer.join(', ')) + ' since. Click Refresh.</span>' : '');
}
function statusLine(el, name, entry, idle) {
  if (busy[name]) { el.style.color = 'var(--ok)'; el.innerHTML = 'Working… (20–60 s)'; }
  else if (errs[name]) { el.style.color = 'var(--danger)'; el.textContent = 'Failed: ' + errs[name]; }
  else if (!aiReady()) { el.style.color = 'var(--danger)'; el.textContent = 'No AI is set up. Open "AI + Keys" to connect one.'; }
  else { el.style.color = ''; el.innerHTML = entry ? cacheNote(entry) : '<span class="muted">' + idle + '</span>'; }
}
function currentLensKey() { return L.lensKey($('#lens-pick').value, S.customParadigm) + (lvl() === 'expert' ? '' : '|' + lvl()); }
function renderLensPicker() {
  const sel = $('#lens-pick');
  const cur = sel.value || R.lensPick || R.ai.paradigm || 'policymaker';
  sel.innerHTML = Object.keys(L.PARADIGM_LABELS).map((k) => {
    const has = R.analysis.lens[L.lensKey(k, S.customParadigm) + (lvl() === 'expert' ? '' : '|' + lvl())] ? ' (saved)' : '';
    return `<option value="${k}">${escapeHtml(L.PARADIGM_LABELS[k])}${has}</option>`;
  }).join('');
  sel.value = cur;
}
function renderAnalysis() {
  const e = escapeHtml;
  renderLensPicker();
  // Never overwrite the paradigm box while the judge is typing in it.
  if (document.activeElement !== $('#lens-custom')) $('#lens-custom').value = S.customParadigm || '';
  if ($('#lens-pick').value === 'custom') $('#lens-custom-box').open = true;
  // Lens
  const lens = R.analysis.lens[currentLensKey()];
  $('#lens-go').textContent = lens ? 'Refresh' : 'Weigh';
  $('#lens-go').disabled = busy.lens;
  statusLine($('#lens-status'), 'lens', lens, 'Not weighed under this paradigm yet. Click Weigh.');
  if ($('#lens-pick').value === 'custom' && !(S.customParadigm || '').trim()) $('#lens-status').innerHTML = '<span style="color:var(--warn)">Paste your Tabroom paradigm below first.</span>';
  const d = lens && lens.data;
  $('#lens-out').innerHTML = d ? `
    <div class="lean ${sideClass(d.winner)}">${e(sideLabel(d.winner))}${d.winner === 'aff' && R.aff.team ? ' (' + e(R.aff.team) + ')' : d.winner === 'neg' && R.neg.team ? ' (' + e(R.neg.team) + ')' : ''} <span class="pill">${e(d.confidence)} confidence</span></div>
    <p>${e(d.rfd)}</p>
    <h2 style="margin-top:var(--s3)">What decides it here</h2><ul style="margin:0;padding-left:20px">${(d.deciding_factors || []).map((x) => '<li>' + e(x) + '</li>').join('')}</ul>
    <h2 style="margin-top:var(--s3)">How this paradigm changes the call</h2><p style="margin:0">${e(d.lens_effect)}</p>` : '';
  // Impacts
  const imp = LV().impacts;
  $('#impact-go').disabled = busy.impacts;
  $('#impact-go').textContent = imp ? 'Refresh' : 'Run';
  statusLine($('#impact-status'), 'impacts', imp, 'Not run yet. Click Run.');
  const id = imp && imp.data;
  $('#impact-out').innerHTML = id ? `
    <div class="lean ${sideClass(id.net)}" style="font-size:var(--fs-md)">Net: ${e(sideLabel(id.net))} outweighs</div>
    <div class="scroll" style="margin-top:var(--s2)"><table>
      <thead><tr><th>Impact</th><th>Side</th><th>Magnitude</th><th>Probability</th><th>Timeframe</th><th>Reversible?</th><th>Status</th></tr></thead>
      <tbody>${(id.impacts || []).map((x) => `<tr><td><strong>${e(x.impact)}</strong><div class="muted">${e(x.note)}</div></td><td><span class="pill ${sideClass(x.side)}">${e(sideLabel(x.side))}</span></td><td>${e(x.magnitude)}</td><td>${e(x.probability)}</td><td>${e(x.timeframe)}</td><td>${e(x.reversibility)}</td><td>${e(x.status)}</td></tr>`).join('')}</tbody>
    </table></div>
    <h2 style="margin-top:var(--s3)">Weighing the debaters did</h2><p style="margin:0">${e(id.weighing_done)}</p>
    <h2 style="margin-top:var(--s3)">Comparison</h2><p style="margin:0">${e(id.comparison)}</p>` : '';
  // Map
  const map = R.analysis.map;
  $('#map-go').disabled = busy.map;
  $('#map-go').textContent = map ? 'Refresh' : 'Draw';
  statusLine($('#map-status'), 'map', map, 'Not drawn yet. Click Draw.');
  const view = R.mapView === 'diagram' ? 'diagram' : 'sheet';
  document.querySelectorAll('[data-mapview]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mapview === view)));
  if (!(map && map.data)) { $('#map-out').innerHTML = '<p class="muted">No map yet. Click "+ Argument" to draw one by hand, or Draw to let the AI map the round.</p>'; lastMapCode = ''; return; }
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
    return `<button class="mcard ${c.side} ${c.status === 'dropped' ? 'dropped' : c.status === 'conceded' ? 'conceded' : ''}" data-node="${e(c.id)}" title="Click to edit">`
      + (c.kind ? `<div class="mk">${e(KIND_MARK[c.kind] || c.kind)}</div>` : '')
      + `<span class="lbl">${e(c.label)}</span>${chip}</button>`;
  };
  return `<div class="mapsheet" style="grid-template-columns: repeat(${cols.length}, minmax(160px, 1fr))">`
    + cols.map((sp, i) => `<div class="mh ${sideOf(sp)}${i === cols.length - 1 ? ' last' : ''}">${e(sp)}</div>`).join('')
    + lay.rows.map((r) => `<div class="mrow" title="${e(r.title)}">`
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
  if (key === 'custom' && !(S.customParadigm || '').trim()) { $('#lens-custom-box').open = true; return toast('Paste your Tabroom paradigm first.'); }
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
  copy(L.buildMermaid(R.analysis.map.data));
});

// Mermaid is loaded only when a map is drawn (pinned version, integrity-checked).
let mermaidReady = null, mapSeq = 0, lastMapCode = '';
function loadMermaid() {
  mermaidReady ??= new Promise((res, rej) => {
    const el = document.createElement('script');
    el.src = 'vendor/mermaid-10.9.1.min.js';
    el.integrity = 'sha384-WmdflGW9aGfoBdHc4rRyWzYuAjEmDwMdGdiPNacbwfGKxBW/SO6guzuQ76qjnSlr'; el.crossOrigin = 'anonymous';
    el.onload = () => {
      const dark = matchMedia('(prefers-color-scheme: dark)').matches;
      window.mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: dark ? 'dark' : 'default', flowchart: { useMaxWidth: false } });
      res(window.mermaid);
    };
    el.onerror = () => { mermaidReady = null; rej(new Error('could not load the diagram library (needs internet)')); };
    document.head.append(el);
  });
  return mermaidReady;
}
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
$('#ne-delete').addEventListener('click', () => {
  const data = mapDataEnsure();
  const node = data.nodes.find((n) => String(n.id) === String(neState.id));
  if (!node || !confirm('Delete "' + node.label + '"?')) return;
  if (!node.user) (data.removedNodes ??= []).push({ id: String(node.id), key: node.speech + '|' + String(node.aiLabel || node.label).trim().toLowerCase() });
  data.nodes = data.nodes.filter((n) => n !== node);
  data.edges = data.edges.filter((x) => String(x.from) !== String(node.id) && String(x.to) !== String(node.id));
  save(); closeNodeEditor(); renderAnalysis();
});
$('#ne-cancel').addEventListener('click', closeNodeEditor);
$('#node-editor').addEventListener('keydown', (e) => { if (e.key === 'Escape') closeNodeEditor(); if (e.key === 'Enter' && e.target.id === 'ne-label') $('#ne-save').click(); });
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

// ---------- AI ballot filler ----------
let fillBusy = false, fillErr = '', fillSoonTimer = null;
function scheduleBallotSoon() { clearTimeout(fillSoonTimer); fillSoonTimer = setTimeout(() => { if (S.autoBallot && aiReady() && !resetting) runBallotFill(false, true); }, 25000); }
async function runBallotFill(override, auto) {
  if (!aiReady()) return toast(NO_AI);
  if (fillBusy) return toast('Still filling the ballot. Wait a moment.');
  const level = lvl();
  fillBusy = true; fillErr = ''; renderFiller();
  try {
    const data = await callAI({ system: L.JUDGE_SYSTEM.split('\n\nReply in this exact structure')[0] + '\n\n' + L.POINTS_GUIDE, prompt: L.buildBallotPrompt(R, DOCS, R.ballotInput || ''), schema: L.BALLOT_SCHEMA, effort: 'high', reading: level, kind: 'ballot' });
    if (resetting) return;
    LV(level).ballotDraft = { data, at: Date.now(), through: L.speechesSoFar(R) };
    if (!auto) R.ballotUndo = JSON.parse(JSON.stringify(R.ballot)); // one step of undo, for fills the judge asked for
    const touched = override ? {} : R.ballot.touched || {};
    R.ballot = L.applyBallotDraft(R.ballot, data, { override });
    R.ballot.touched = touched;
    save();
    if (R.tab === 'ballot') renderBallot();
  } catch (err) {
    fillErr = (err && err.message) || String(err);
  } finally { fillBusy = false; renderFiller(); }
}
function renderFiller() {
  const st = $('#fill-status'); if (!st) return;
  $('#fill-go').disabled = fillBusy; $('#fill-redo').disabled = fillBusy;
  const d = LV().ballotDraft;
  if (fillBusy) { st.style.color = 'var(--ok)'; st.textContent = 'Filling… (20–60 s)'; }
  else if (fillErr) { st.style.color = 'var(--danger)'; st.textContent = 'Failed: ' + fillErr; }
  else if (!aiReady()) { st.style.color = 'var(--muted)'; st.textContent = 'Connect AI in "AI + Keys" to use this. The ballot below works by hand either way.'; }
  else { st.style.color = 'var(--muted)'; st.textContent = d ? 'Last filled ' + agoText(d.at) + ', through ' + ((d.through || []).slice(-1)[0] || 'no speeches') + '.' : ''; }
  $('#fill-why').textContent = d && d.data ? 'AI confidence: ' + d.data.confidence + '\n' + (d.data.points_reasoning || '') : '';
  const locked = Object.keys(R.ballot.touched || {}).filter((k) => R.ballot.touched[k]).length;
  $('#fill-unlock').hidden = !locked;
  $('#fill-unlock').textContent = 'Let the AI refill my ' + locked + ' typed field' + (locked === 1 ? '' : 's') + ' too';
  $('#auto-ballot').checked = Boolean(S.autoBallot);
  $('#fill-undo').hidden = !R.ballotUndo;
}
$('#fill-go').addEventListener('click', () => runBallotFill(false));
// "Redo with my input": the judge's note may need to change fields they typed (e.g. "I'm voting neg"). Ask first.
$('#fill-redo').addEventListener('click', () => {
  if (!(R.ballotInput || '').trim()) { $('#ballot-input').focus(); return toast('Type your note for the AI first.'); }
  const locked = Object.values(R.ballot.touched || {}).some(Boolean);
  const override = locked && confirm('Your note may need to change fields you typed yourself. Let the AI change them this time? (You can undo it.)');
  runBallotFill(override);
});
$('#fill-undo').addEventListener('click', () => { if (!R.ballotUndo) return; R.ballot = R.ballotUndo; R.ballotUndo = null; save(); renderBallot(); toast('Ballot put back as it was before the last fill.'); });
$('#fill-unlock').addEventListener('click', () => {
  if (!confirm('Let the AI change the fields you typed the next time it fills the ballot?')) return;
  R.ballot.touched = {}; save(); renderBallot();
});
$('#auto-ballot').addEventListener('change', (e) => { S.autoBallot = e.target.checked; saveSettings(); });

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
  const backup = L.buildBackup(readAllStorage(), await readAllDocs(), { includeKeys });
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
  if (file.size > 60 * 1024 * 1024 && !confirm('This backup is large (' + Math.round(file.size / 1048576) + ' MB). Restoring it may be slow. Continue?')) return;
  let b;
  try { b = L.parseBackup(await file.text()); }
  catch (err) { st.style.color = 'var(--danger)'; st.textContent = 'Could not restore: ' + String(err.message || err); return; }
  const sum = L.backupSummary(b);
  const when = b.exportedAt ? new Date(b.exportedAt).toLocaleString() : 'an unknown time';
  if (!confirm('Restore this backup from ' + when + '?\n\nRound: ' + sum.round + '\nSaved ballots: ' + sum.ballots + '\nDocuments: ' + sum.docs + '\nAPI keys: ' + (sum.keys ? 'included' : 'not included (your current keys stay)') + '\n\nThis replaces what is in this browser now. A copy of your current data downloads first. Check your Downloads folder for it.')) return;
  // 1. Safety copy of the current data (with keys) before anything changes.
  await downloadBackup(true, 'before-restore');
  resetting = true; stopAll(); restoring = true;
  // 2. Snapshot everything, so any failure below puts the old data back exactly.
  const oldStorage = readAllStorage();
  const oldDocs = await readAllDocs();
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
    if (!b.includesKeys) for (const k of [KEYS, KEY, OAKEY]) if (oldStorage[k] != null) entries[k] = oldStorage[k];
    writeStorage(entries);
  } catch (err) {
    // Put the old data back.
    try { writeStorage(oldStorage); } catch {}
    try { await writeDocs(oldDocs); } catch {}
    resetting = false; restoring = false;
    st.style.color = 'var(--danger)';
    st.textContent = 'Restore failed, and your previous data was put back: ' + String(err.message || err);
    return;
  }
  st.style.color = 'var(--ok)'; st.textContent = 'Restored. Reloading…';
  setTimeout(() => location.reload(), 1500);
});

// ---------- ballot ----------
const nameOf = (s) => ({ '1A': R.aff.d1, '2A': R.aff.d2, '1N': R.neg.d1, '2N': R.neg.d2 }[s]) || s;
function renderBallot() {
  $('#ballot-title').textContent = 'Ballot' + (R.roundName ? ' — ' + R.roundName : '');
  $('#w-aff').textContent = R.aff.team ? '(' + R.aff.team + ')' : '';
  $('#w-neg').textContent = R.neg.team ? '(' + R.neg.team + ')' : '';
  $('#fb-aff-code').textContent = R.aff.team ? '(' + R.aff.team + ')' : '';
  $('#fb-neg-code').textContent = R.neg.team ? '(' + R.neg.team + ')' : '';
  document.querySelectorAll('input[name="winner"]').forEach((r) => { r.checked = r.value === R.ballot.winner; });
  $('#pts-body').innerHTML = L.SPEAKERS.map((s) => `<tr>
    <td class="${s.includes('A') ? 'aff' : 'neg'}"><strong>${s}</strong></td>
    <td>${escapeHtml(nameOf(s))}</td>
    <td><input type="number" min="25" max="30" step="0.1" data-bind="ballot.pts.${s}"></td>
    <td><select data-bind="ballot.ranks.${s}"><option value=""></option><option>1</option><option>2</option><option>3</option><option>4</option></select></td>
  </tr>`).join('');
  bindAll(); renderBallotCheck(); renderFiller();
  // Fields the judge typed get a thin mark, so it is clear which ones the AI will leave alone.
  const t = R.ballot.touched || {};
  document.querySelectorAll('#tab-ballot [data-bind^="ballot."]').forEach((el) => { const f = el.dataset.bind.slice(7); el.classList.toggle('touched', Boolean(t[f])); el.title = t[f] ? 'You set this. The AI ballot filler will not change it.' : ''; });
}
function renderBallotCheck() {
  const p = R.ballot.pts || {};
  const sum = (a, b) => (p[a] !== undefined && p[a] !== '' && p[b] !== undefined && p[b] !== '' ? (Number(p[a]) + Number(p[b])).toFixed(1) : '–');
  $('#sum-aff').textContent = 'Aff ' + sum('1A', '2A');
  $('#sum-neg').textContent = 'Neg ' + sum('1N', '2N');
  const issues = L.checkBallot(R.ballot);
  $('#ballot-check').innerHTML = issues.length
    ? `<div class="warn"><strong>Check before you submit:</strong><ul>${issues.map((i) => '<li>' + escapeHtml(i) + '</li>').join('')}</ul></div>`
    : '<p class="good">Ballot looks complete.</p>';
}
document.addEventListener('change', (e) => {
  if (e.target.name === 'winner') { R.ballot.winner = e.target.value; (R.ballot.touched ??= {}).winner = true; save(); renderBallotCheck(); }
  if (e.target.dataset && (e.target.dataset.bind || '').startsWith('ballot')) renderBallotCheck();
});
document.addEventListener('click', (e) => {
  const btn = e.target.closest && e.target.closest('[data-copy]');
  const path = btn && btn.dataset.copy;
  if (!path) return;
  e.preventDefault();
  const text = getPath(R, path) || '';
  if (!text.trim()) return toast('Nothing to copy yet');
  copy(text);
});
$('#b-tsv').addEventListener('click', () => copy(L.toTSV([L.ballotRow(R, new Date().toLocaleString())])));
$('#b-csv').addEventListener('click', () => download(safeName(R.roundName) + '_ballot.csv', L.toCSV([L.BALLOT_HEADER, L.ballotRow(R, new Date().toLocaleString())])));
$('#b-save').addEventListener('click', () => {
  const issues = L.checkBallot(R.ballot);
  if (issues.length && !confirm('The ballot has ' + issues.length + ' issue(s). Save anyway?')) return;
  const log = store.get(LOG, []);
  const row = L.ballotRow(R, new Date().toLocaleString());
  const last = log[log.length - 1];
  if (last && JSON.stringify(last.slice(1)) === JSON.stringify(row.slice(1))) return toast('Already saved');
  log.push(row);
  if (store.set(LOG, log)) {
    toast('Saved to log');
    // Offer a backup when there is none from the last 2 hours.
    if (!S.lastBackupAt || Date.now() - S.lastBackupAt > 2 * 3600 * 1000) {
      setTimeout(() => { if (confirm('Ballot saved. Download a backup of everything now? (Recommended: your data lives only in this browser.)')) downloadBackup(false); }, 50);
    }
  }
});

// ---------- log ----------
function renderLog() {
  const log = store.get(LOG, []);
  if (!log.length) { $('#log-table').innerHTML = '<tr><td class="muted">No saved ballots yet.</td></tr>'; return; }
  const cols = L.LOG_COLUMNS;
  $('#log-table').innerHTML = '<tr>' + cols.map((i) => `<th>${L.BALLOT_HEADER[i]}</th>`).join('') + '<th></th></tr>'
    + log.map((r, n) => '<tr>' + cols.map((i) => `<td>${escapeHtml(r[i] ?? '')}</td>`).join('') + `<td><button class="b" data-del="${n}">Delete</button></td></tr>`).join('');
}
$('#log-table').addEventListener('click', (e) => {
  const n = e.target.dataset.del; if (n == null) return;
  if (!confirm('Delete this saved ballot?')) return;
  const log = store.get(LOG, []); log.splice(Number(n), 1); store.set(LOG, log); renderLog();
});
$('#log-tsv').addEventListener('click', () => copy(L.toTSV([L.BALLOT_HEADER, ...store.get(LOG, [])])));
$('#log-csv').addEventListener('click', () => download('policy_ballots.csv', L.toCSV([L.BALLOT_HEADER, ...store.get(LOG, [])])));

// ---------- start ----------
bindAll(); renderSpeeches(); renderClock(); renderPrep(); renderTranscript();
renderConnections(); checkHelper(); renderReadLevel(); applyPanes(); renderAudio(); listMics();
showTab(R.tab || 'flow'); renderPrepPresets(); showDrawer(Boolean(S.trDrawer));
renderSdList(); if (sdState().code) { sdFetchList(true); sdWatch(); } // resume watching this round's SpeechDrop room
if (!S.setupDone) showWelcome(true);
window.addEventListener('beforeunload', () => { if (running) pauseSpeech(); stopPrep(); });

$('#print-btn').addEventListener('click', () => window.print());
