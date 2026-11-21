// Recording and transcription: the Recording strip and notice, the level meter, the mic, gap-free clips,
// the clip queue and the transcription requests.
// One part of the page code (see app.js for the load order). The parts are classic scripts that share one global
// scope, so a part can use what any part declares; code that runs at load only uses parts that load before it.
'use strict';

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

// The status next to Transcribe: one short word, so it never trails off (L.recStatus is the one ladder for the word,
// its tone and the full sentence). The full sentence is the word's tip (data-tip; ui.js ties it to the word with
// aria-describedby). Both status spans have tabindex="0" in index.html, so keyboard users reach the tip.
// recProblemKind names the problem for the word ('no-key', 'mic-blocked', 'mic-lost', 'offline'); set it with recProblem.
let recProblem = '', recProblemKind = '', lastTextAt = 0;
const recStall = () => L.stallWarning({ startedAt: recStartedAt, lastTextAt, now: Date.now(), mode: S.audioMode });
// Paint one status span. In the error tone the full sentence is also inside the span (sr-only), so the live region
// reads it out without focus: "Mic blocked. Not transcribing: the microphone is blocked…". The span is only rebuilt
// when the word or that sentence changes, so the live region does not speak every second.
function paintRecStatus(el, st) {
  tone(el, st.tone);
  const said = st.tone === 'error' ? st.full : '';
  if (el.dataset.word !== st.word || el.dataset.said !== said) {
    el.dataset.word = st.word; el.dataset.said = said;
    el.textContent = st.word;
    if (said) { const sr = document.createElement('span'); sr.className = 'sr-only'; sr.textContent = '. ' + said; el.append(sr); }
  }
  if (el.dataset.tip !== st.full) el.dataset.tip = st.full;
}
function setRecStatus() {
  const el = $('#rec-status');
  if (!el) return;
  const q = CQ.state();
  const stall = recWanted ? recStall() : '';
  const st = L.recStatus({ problem: recProblem, problemKind: recProblemKind, held: q.held, degraded: q.degraded,
    catchingUp: q.catchingUp, finishing: !recWanted && Boolean(q.backlog), retryInMs: q.retryInMs, backlog: q.backlog,
    mins: clipMinutes(q), on: $('#rec-on').checked, wanted: recWanted, stall,
    engine: activeEngine === 'browser' ? 'browser' : P.PROVIDERS[activeEngine].short,
    ago: lastTextAt ? Math.round((Date.now() - lastTextAt) / 1000) : null });
  paintRecStatus(el, st);
  // The narrow clock view shows the same box and word (spec 5.6b).
  const box = $('#cv-rec-on'), line = $('#cv-rec-status');
  if (box.checked !== $('#rec-on').checked) box.checked = $('#rec-on').checked;
  paintRecStatus(line, st);
  line.className = el.className.replace('rb-status', 'cv-rec-line');
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

// The narrow clock view's Transcribe box is a mirror of the round bar's one: one setting, one status line.
$('#cv-rec-on').addEventListener('change', (e) => {
  $('#rec-on').checked = e.target.checked;
  $('#rec-on').dispatchEvent(new Event('change'));
});

// ---------- recording notice and "Recording" strip (spec 1.6, Q19) ----------
const MIC_BLOCKED = "The microphone is blocked. Allow it in your browser's site settings, then tick Transcribe again.";
const OFFLINE_SR = 'You are offline. Your browser\'s speech service needs the internet, so words spoken now do not become text. The clock and flow still work.';
// Recording would start now. The first time on this device, a plain notice asks first. The clock is
// already running; only the mic waits for the choice.
async function wantRec() {
  if (!can('transcription')) return;
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
  if (!can('transcription')) return;
  if (testing) testAbort = true; // a speech starting ends the mic test
  recWanted = true; recSpeechId = runSp().id; recGen++; recProblem = ''; recStartedAt = Date.now(); recLive = false; recStoppedByReload = false;
  activeEngine = S.trEngine || 'browser';
  // The chosen engine has no key (for example after a refresh)? Use the free browser engine instead of failing silently.
  if (activeEngine !== 'browser' && !keys[activeEngine]) {
    if (SR) { toast('No ' + P.PROVIDERS[activeEngine].short + ' key, so using the free browser transcription.'); activeEngine = 'browser'; }
    else { recWanted = false; recProblem = 'the ' + P.PROVIDERS[activeEngine].short + ' key is not connected in this tab. Connect it in Settings.'; recProblemKind = 'no-key'; renderRecBadge(); setRecStatus(); return; }
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
    if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') { recWanted = false; recLive = false; recProblem = 'the microphone is blocked. Click the mic icon in the address bar and allow it.'; recProblemKind = 'mic-blocked'; setRecStatus(); renderRecStrip(); toast(MIC_BLOCKED, { kind: 'error', key: 'mic' }); }
    else if (ev.error === 'network') { recProblem = 'browser transcription needs internet.'; recProblemKind = 'offline'; setRecStatus(); }
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
    recProblem = 'the microphone is blocked or busy (' + (err && err.name || 'error') + '). Click the mic icon in the address bar and allow it.'; recProblemKind = 'mic-blocked';
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
  if (track) track.onended = () => { meterShow(false); if (recWanted) { recProblem = 'the microphone was disconnected. Pause and start the clock again.'; recProblemKind = 'mic-lost'; setRecStatus(); } };
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
    recProblem = err.message; recProblemKind = 'service';
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
  if (!can('transcription')) throw Object.assign(new Error(''), { hold: true, retryable: false }); // keep the audio, send nothing
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
    if (eng === 'openai') { fd.append('language', 'en'); fd.append('prompt', L.buildTranscribePrompt(prevText, FMT())); }
    url = eng === 'openai' ? 'https://api.openai.com/v1/audio/transcriptions' : 'https://api.x.ai/v1/stt';
    init = { method: 'POST', headers: { Authorization: 'Bearer ' + key }, body: fd };
  } else {
    const body = {
      contents: [{ role: 'user', parts: [
        { text: 'Transcribe this audio clip from a ' + FMT().ai.kind + ' debate word for word. Return only the spoken words, with no notes. If it is silent, return nothing. ' + L.buildTranscribePrompt(prevText, FMT()) },
        { inline_data: { mime_type: 'audio/' + (ext === 'mp4' ? 'mp4' : ext), data: audio } },
      ] }],
    };
    url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent';
    init = { method: 'POST', headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
  }
  return { url, init };
}
