// Transcription text and audio math: the transcription hint, clip joins, WAV encoding, levels and the mic test.
// One part of logic.js (pure logic, no DOM). logic.js joins the parts into one API; index.html loads the parts first.
(function (root) {
  'use strict';

  const part = (name) => (typeof module !== 'undefined' && module.exports ? require('./' + name + '.js') : root.PolicyLogicParts[name]);
  const F = part('format');

  // ---------- live transcription (OpenAI) ----------
  // A short vocabulary hint helps the speech model spell debate words. It comes from the format file (ai.transcribeHint).
  // Deprecated alias: the policy hint under its old name (old callers and tests). Page code passes the round's format.
  const TRANSCRIBE_HINT = F.POLICY.ai.transcribeHint;

  // The model reads only the end of the prompt, so pass a short tail of what came before.
  // fmt: the round's format (policy-hs when not given).
  function buildTranscribePrompt(prevText, fmt) {
    const hint = (fmt || F.POLICY).ai.transcribeHint;
    const tail = (prevText || '').slice(-300);
    return tail ? hint + ' ' + tail : hint;
  }

  // On silence the model sometimes repeats the vocabulary hint instead of words. true when the text holds the start of
  // the format's hint ("policy debate. Terms:", "Lincoln-Douglas debate. Terms:"), so the page drops it.
  function isHintEcho(text, fmt) {
    const hint = (fmt || F.POLICY).ai.transcribeHint;
    const start = hint.slice(0, hint.indexOf('Terms:') + 'Terms:'.length).replace(/^High school /, '');
    return String(text || '').includes(start);
  }

  function appendChunk(prev, chunk) {
    const a = (prev || '').trim();
    const b = (chunk || '').trim();
    if (!b) return a;
    return a ? a + ' ' + b : b;
  }

  // ---------- gap-free audio clips ----------
  // Turns raw mic samples (-1..1) into a 16-bit mono WAV file the transcription API accepts.
  function encodeWav(samples, sampleRate) {
    const n = samples.length;
    const buf = new ArrayBuffer(44 + n * 2);
    const v = new DataView(buf);
    const str = (o, t) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
    str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE');
    str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    str(36, 'data'); v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) {
      const x = Math.max(-1, Math.min(1, samples[i]));
      v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true);
    }
    return buf;
  }

  // Loudness of a clip. Near-zero means silence, which the speech model tends to "hear" words in.
  function rms(samples) {
    if (!samples || !samples.length) return 0;
    let sum = 0;
    for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
    return Math.sqrt(sum / samples.length);
  }

  // Clips overlap by about a second, so the start of a new clip repeats the end of the last one.
  // Remove the repeated words: the longest run (2 to 15 words) that ends the old text and starts the new.
  function mergeOverlap(prevText, nextText) {
    const norm = (w) => w.toLowerCase().replace(/[^a-z0-9']/g, '');
    const prev = (prevText || '').trim().split(/\s+/).filter(Boolean).slice(-15).map(norm);
    const nextWords = (nextText || '').trim().split(/\s+/).filter(Boolean);
    const next = nextWords.map(norm);
    for (let k = Math.min(15, prev.length, next.length); k >= 2; k--) {
      let same = true;
      for (let i = 0; i < k; i++) if (prev[prev.length - k + i] !== next[i]) { same = false; break; }
      if (same) return nextWords.slice(k).join(' ');
    }
    return nextWords.join(' ');
  }

  // ---------- audio: room vs Zoom, mic choice, level ----------
  // In the room: let the browser cancel echo, cut room hum and even out loud and soft voices.
  // Zoom / speakers: turn all of that off, because those filters treat speaker sound as noise.
  const AUDIO_MODES = { room: 'In the room', zoom: 'Zoom or speakers' };
  function micConstraints(mode, deviceId) {
    const room = mode !== 'zoom';
    const audio = { echoCancellation: room, noiseSuppression: room, autoGainControl: room };
    if (deviceId) audio.deviceId = { exact: deviceId };
    return { audio };
  }

  // Turns a loudness value (RMS, 0..1) into a meter width and a plain-words verdict.
  function levelInfo(rms) {
    const r = Number(rms) || 0;
    const db = r > 0 ? 20 * Math.log10(r) : -100;
    const pct = Math.max(0, Math.min(100, Math.round(((db + 60) / 60) * 100)));
    if (r < 0.003) return { pct, level: 'silent', label: 'No sound' };
    if (r < 0.015) return { pct, level: 'quiet', label: 'Too quiet' };
    if (r > 0.5) return { pct, level: 'loud', label: 'Very loud' };
    return { pct, level: 'good', label: 'Good' };
  }

  // A mic test result from loudness samples taken while someone talks.
  function micTestVerdict(samples) {
    const xs = (samples || []).filter((x) => typeof x === 'number');
    if (!xs.length) return { ok: false, text: 'No sound reached the app. Check that the right microphone is picked and allowed.' };
    const sorted = xs.slice().sort((a, b) => a - b);
    const loud = sorted[Math.floor(sorted.length * 0.9)];
    const info = levelInfo(loud);
    if (info.level === 'silent') return { ok: false, text: 'No sound reached the app. Check that the right microphone is picked and allowed.' };
    if (info.level === 'quiet') return { ok: false, text: 'Too quiet. Move the laptop closer to the speaker, or point the mic toward the podium.' };
    if (info.level === 'loud') return { ok: true, text: 'Very loud, but usable. If words come out wrong, move the laptop back a little.' };
    return { ok: true, text: 'Good. The mic hears speech clearly.' };
  }

  // The round bar warns when recording has produced no new words for 30 seconds (any engine),
  // with advice that fits where the round is.
  function stallWarning(o) {
    const { startedAt, lastTextAt, now, mode } = o || {};
    if (!startedAt || now - Math.max(startedAt, lastTextAt || 0) <= 30000) return '';
    return mode === 'zoom'
      ? 'No new text for 30+ s. Check the Zoom volume and that headphones are off.'
      : 'No new text for 30+ s. Move the laptop closer to the speaker, or check the mic in Settings.';
  }

  // The recording status next to Transcribe (CHANGED 2026-11-20, owner: the long line "trails off next to
  // transcribe ... Can it just say 'Ready'"). One ladder gives the short word, its tone and the full sentence, so the
  // word and its tip can never disagree. The word shows; the full sentence is the word's tip and is read out.
  // o: { problem (text), problemKind ('no-key' | 'mic-blocked' | 'mic-lost' | 'offline' | other), held (text),
  //   degraded, catchingUp, finishing, retryInMs, mins (e.g. "2.5 min"), backlog, on, wanted, engine, stall (text),
  //   ago (seconds since the last text, or null) }.
  // A word that needs the judge to act names the fix ("Mic blocked", "Key needed"); its tone is error.
  const REC_PROBLEM_WORD = { 'no-key': 'Key needed', 'mic-blocked': 'Mic blocked', 'mic-lost': 'Mic lost', offline: 'Offline' };
  function recStatus(o) {
    const x = o || {};
    const kept = ' of audio waiting, kept on this device only';
    if (x.problem) return { word: REC_PROBLEM_WORD[x.problemKind] || 'Not transcribing', tone: 'error', full: 'Not transcribing: ' + x.problem };
    if (x.held) return { word: 'Upload paused', tone: 'error',
      full: 'Paused: ' + String(x.held).replace(/\.+$/, '') + '. ' + (x.backlog ? x.mins + ' of audio is kept on this device until it is fixed.' : '') };
    if (x.degraded) return { word: 'Retrying', tone: 'caution',
      full: 'Connection trouble: recording safely. ' + x.mins + kept + (x.retryInMs ? '. Trying again in ' + Math.ceil(x.retryInMs / 1000) + ' s.' : '.') };
    if (x.catchingUp) return { word: 'Catching up', tone: 'caution', full: 'Catching up: ' + x.mins + kept + '.' };
    if (x.finishing) return { word: 'Finishing', tone: 'quiet', full: 'Finishing the transcript: ' + x.mins + kept + '.' };
    if (!x.on) return { word: 'Off', tone: 'quiet', full: 'Transcribe is off. Tick the box to record.' };
    if (!x.wanted) return { word: 'Ready', tone: 'quiet', full: 'Ready. Recording starts when the speech clock starts.' };
    if (x.stall) return { word: 'Check mic', tone: 'caution', full: 'Recording (' + x.engine + '). ' + x.stall };
    return { word: 'Recording', tone: 'ok',
      full: 'Recording (' + x.engine + ')' + (x.ago != null ? ' \u00b7 last text ' + x.ago + ' s ago' : ' \u00b7 waiting for first text\u2026') };
  }

  const api = { TRANSCRIBE_HINT, buildTranscribePrompt, isHintEcho, appendChunk, encodeWav, rms, mergeOverlap, AUDIO_MODES,
    micConstraints, levelInfo, micTestVerdict, stallWarning, recStatus, REC_PROBLEM_WORD };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.PolicyLogicParts = root.PolicyLogicParts || {}).audio = api;
})(typeof window !== 'undefined' ? window : globalThis);
