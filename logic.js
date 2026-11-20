// Pure logic for the policy judge app. No DOM here, so Node tests can load it.
(function (root) {
  'use strict';

  // NSDA high school policy format. CX pairs follow the usual order:
  // 2N asks 1A, 1A asks 1N, 1N asks 2A, 2A asks 2N.
  const SPEECHES = [
    { id: '1AC', label: '1AC', side: 'aff', minutes: 8, speaker: '1A' },
    { id: 'CX-1A', label: 'CX of 1A (2N asks)', side: 'aff', minutes: 3, speaker: '1A' },
    { id: '1NC', label: '1NC', side: 'neg', minutes: 8, speaker: '1N' },
    { id: 'CX-1N', label: 'CX of 1N (1A asks)', side: 'neg', minutes: 3, speaker: '1N' },
    { id: '2AC', label: '2AC', side: 'aff', minutes: 8, speaker: '2A' },
    { id: 'CX-2A', label: 'CX of 2A (1N asks)', side: 'aff', minutes: 3, speaker: '2A' },
    { id: '2NC', label: '2NC', side: 'neg', minutes: 8, speaker: '2N' },
    { id: 'CX-2N', label: 'CX of 2N (2A asks)', side: 'neg', minutes: 3, speaker: '2N' },
    { id: '1NR', label: '1NR', side: 'neg', minutes: 5, speaker: '1N' },
    { id: '1AR', label: '1AR', side: 'aff', minutes: 5, speaker: '1A' },
    { id: '2NR', label: '2NR', side: 'neg', minutes: 5, speaker: '2N' },
    { id: '2AR', label: '2AR', side: 'aff', minutes: 5, speaker: '2A' },
  ];

  // Flow columns. The 2NC and 1NR share one column ("the block").
  const FLOW_COLUMNS = [
    { label: '1AC', side: 'aff' },
    { label: '1NC', side: 'neg' },
    { label: '2AC', side: 'aff' },
    { label: 'Block (2NC / 1NR)', side: 'neg' },
    { label: '1AR', side: 'aff' },
    { label: '2NR', side: 'neg' },
    { label: '2AR', side: 'aff' },
  ];

  const DEFAULT_FLOWS = ['Case', 'T', 'DA 1', 'CP', 'K'];
  // Sheet tabs use the short names debaters write on paper; the full name shows on a long hover.
  const ARG_TYPES = { T: 'Topicality', DA: 'Disadvantage', CP: 'Counterplan', K: 'Kritik', FW: 'Framework' };
  const LONG_TO_SHORT = { topicality: 'T', disadvantage: 'DA', counterplan: 'CP', kritik: 'K', critique: 'K', framework: 'FW' };
  // "Topicality" -> { short: 'T', full: 'Topicality' }; "DA - Econ" -> { short: 'DA - Econ', full: 'Disadvantage: Econ' }.
  function sheetLabel(name) {
    const n = String(name || '').trim();
    const long = n.match(/^(topicality|disadvantage|counterplan|kritik|critique|framework)\b(.*)$/i);
    const short = long ? LONG_TO_SHORT[long[1].toLowerCase()] + long[2] : n;
    const p = short.match(/^(T|DA|CP|K|FW)(?![A-Za-z])(.*)$/);
    if (!p) return { short, full: '' };
    const rest = p[2].replace(/^\s*[-:–]\s*/, ': ').replace(/^\s+/, ' ');
    return { short, full: ARG_TYPES[p[1]] + rest };
  }
  // The Debate Library page that explains each kind of sheet (learn/<slug>/), and how a link names it.
  // A test checks that every library page's "sheet:" front matter matches this table, so the two never drift.
  const SHEET_PAGES = {
    Case: { slug: 'affirmative-case', topic: 'the Affirmative Case' },
    T: { slug: 'topicality', topic: 'Topicality' },
    DA: { slug: 'disadvantages', topic: 'Disadvantages' },
    CP: { slug: 'counterplans', topic: 'Counterplans' },
    K: { slug: 'kritiks', topic: 'Kritiks' },
    FW: { slug: 'framework', topic: 'Framework' },
  };
  const SHEET_KEY = new RegExp('^(' + Object.keys(SHEET_PAGES).filter((k) => k !== 'Case').join('|') + ')(?![A-Za-z])');
  // "DA - Econ" -> the DA page; "Case" or "Adv 1" -> the affirmative case page; "Case turns", "Notes" -> null.
  function sheetPage(name) {
    const short = sheetLabel(name).short;
    if (/^(case|adv|advantage)\b(?!\s*(turns?|neg|defense)\b)/i.test(short)) return SHEET_PAGES.Case;
    const m = short.match(SHEET_KEY);
    return m ? SHEET_PAGES[m[1]] : null;
  }
  const DEFAULT_PREP_SECONDS = 8 * 60;
  const SPEAKERS = ['1A', '2A', '1N', '2N'];

  const PARADIGMS = {
    lay: 'Lay / stock issues judge. Decide on Harms, Inherency, Solvency, Topicality and Significance (stock issues). The affirmative must win every stock issue. Weigh clarity and persuasion. Ignore jargon the debaters did not explain.',
    policymaker: 'Policymaker judge. Compare the world of the plan against the status quo or a counterplan. Weigh impacts by magnitude, probability and timeframe. Topicality and theory are voting issues only if the negative goes for them and wins them.',
    tabula: 'Tabula rasa (tab) judge. Use only the arguments made in the round. Use the framework the debaters set. Dropped arguments are true. Do not insert your own arguments.',
    tech: 'Technical (tech over truth) flow judge. Decide from the flow. Dropped arguments are conceded. New arguments in rebuttals do not count. Evaluate kritiks, counterplans, theory and topicality on the flow.',
    critical: 'Critical (K-friendly) judge. Framework comes first: decide which lens the round is judged through, then evaluate kritiks, their links, alternatives and the role of the ballot. Policy impacts matter only as far as the winning framework lets them.',
    games: 'Games / skills judge. Debate is a competitive game with fair rules. Fairness and education impacts on topicality and theory are weighed seriously; procedural arguments come before substance when they are won.',
  };

  const PARADIGM_LABELS = {
    lay: 'Lay / stock issues', policymaker: 'Policymaker', tabula: 'Blank slate (tabula rasa)', tech: 'Tech over truth',
    critical: 'Critical (K-friendly)', games: 'Games / skills', custom: 'My own paradigm',
  };

  // The paradigm text to judge by. "custom" uses the judge's own pasted Tabroom paradigm.
  function paradigmText(key, customText) {
    if (key === 'custom') {
      const t = (customText || '').trim();
      return t ? "The judge's own paradigm, from Tabroom. Weigh the round exactly as it says:\n" + t : PARADIGMS.policymaker;
    }
    return PARADIGMS[key] || PARADIGMS.policymaker;
  }

  // A short, stable fingerprint of text, so a changed custom paradigm gets its own cached result.
  function hashText(text) {
    let h = 5381;
    const t = String(text || '');
    for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }

  function lensKey(key, customText) {
    return key === 'custom' ? 'custom:' + hashText((customText || '').trim()) : key;
  }

  function formatClock(totalSeconds) {
    const s = Math.abs(Math.trunc(totalSeconds));
    const neg = totalSeconds < 0 && s > 0;
    const m = Math.floor(s / 60);
    const r = s % 60;
    return (neg ? '-' : '') + m + ':' + String(r).padStart(2, '0');
  }

  // Text that starts with = + - @ runs as a formula in Sheets. A leading ' keeps it text.
  function sheetSafe(value) {
    if (value == null) return '';
    if (typeof value === 'number') return String(value);
    const v = String(value);
    return /^[=+\-@]/.test(v) ? "'" + v : v;
  }

  function csvCell(value) {
    const v = sheetSafe(value);
    return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }

  function toCSV(rows) {
    return rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
  }

  // Google Sheets pastes tab-separated text into separate cells.
  // Tabs and new lines inside a value would split cells, so flatten them.
  function toTSV(rows) {
    return rows
      .map((r) => r.map((v) => sheetSafe(v).replace(/[\t\r\n]+/g, ' ')).join('\t'))
      .join('\n');
  }

  const BALLOT_HEADER = [
    'Saved at', 'Tournament', 'Round', 'Judge', 'Topic',
    'Aff team', '1A', '1A pts', '1A rank', '2A', '2A pts', '2A rank',
    'Neg team', '1N', '1N pts', '1N rank', '2N', '2N pts', '2N rank',
    'Winner', 'Winning team', 'RFD',
  ];

  function ballotRow(round, savedAt) {
    const b = round.ballot || {};
    const pts = b.pts || {};
    const ranks = b.ranks || {};
    const winTeam = b.winner === 'aff' ? round.aff.team : b.winner === 'neg' ? round.neg.team : '';
    return [
      savedAt || '', round.tournament, round.roundName, round.judge, round.topic,
      round.aff.team, round.aff.d1, pts['1A'], ranks['1A'], round.aff.d2, pts['2A'], ranks['2A'],
      round.neg.team, round.neg.d1, pts['1N'], ranks['1N'], round.neg.d2, pts['2N'], ranks['2N'],
      (b.winner || '').toUpperCase(), winTeam, b.rfd,
    ].map((v) => (v == null ? '' : v));
  }

  function num(v) {
    if (v === '' || v == null) return NaN;
    return Number(v);
  }

  // Returns a list of problems a tab room would bounce the ballot for.
  // Slice 4 (4.7, 4.8): opts.range { min, max } is the round's points range (opts.minPts / maxPts still work);
  // opts.range === null is an old saved ballot with no range, so points get no range check. Points outside the range
  // stay as typed and are flagged as "1A has 24.5, outside 25–30." A missing rank is flagged per speaker.
  function checkBallot(ballot, opts) {
    const op = opts || {};
    const noRange = op.range === null;
    const rr = op.range ? ptsRange(op.range) : { min: op.minPts ?? 25, max: op.maxPts ?? 30 };
    const o = { minPts: rr.min, maxPts: rr.max };
    const out = [];
    const b = ballot || {};
    const pts = b.pts || {};
    const ranks = b.ranks || {};
    if (b.winner !== 'aff' && b.winner !== 'neg') out.push('Pick a winner.');
    for (const s of SPEAKERS) {
      const p = num(pts[s]);
      if (Number.isNaN(p)) out.push('Give ' + s + ' speaker points.');
      else if (!noRange && (p < o.minPts || p > o.maxPts)) out.push(s + ' has ' + p + ', outside ' + o.minPts + '–' + o.maxPts + '.');
    }
    for (const s of SPEAKERS) if (ranks[s] == null || String(ranks[s]).trim() === '') out.push('Give ' + s + ' a rank.');
    const affSum = num(pts['1A']) + num(pts['2A']);
    const negSum = num(pts['1N']) + num(pts['2N']);
    if (!Number.isNaN(affSum) && !Number.isNaN(negSum)) {
      if (b.winner === 'aff' && affSum < negSum) out.push('Low-point win: the Aff wins with fewer points. Check that you meant this.');
      if (b.winner === 'neg' && negSum < affSum) out.push('Low-point win: the Neg wins with fewer points. Check that you meant this.');
    }
    const rankVals = SPEAKERS.map((s) => num(ranks[s])).filter((n) => !Number.isNaN(n));
    if (rankVals.length === 4) {
      const sorted = rankVals.slice().sort((a, b) => a - b);
      if (sorted.join(',') !== '1,2,3,4') out.push('Ranks must use 1, 2, 3 and 4 once each.');
      for (const s of SPEAKERS) {
        for (const t of SPEAKERS) {
          if (num(ranks[s]) < num(ranks[t]) && num(pts[s]) < num(pts[t])) {
            out.push(s + ' ranks above ' + t + ' but has fewer points.');
          }
        }
      }
    }
    const allPts = SPEAKERS.map((s) => num(pts[s])).filter((n) => !Number.isNaN(n));
    if (allPts.length === 4 && Math.max(...allPts) - Math.min(...allPts) < 0.4) {
      out.push('All four speakers are within 0.4 points. Spread them so the points say who did better.');
    }
    if (!b.rfd || !String(b.rfd).trim()) out.push('Write a reason for decision (RFD).');
    return out;
  }

  function parseDecision(text) {
    const m = /DECISION:\s*\**\s*(AFF|NEG)/i.exec(text || '');
    return m ? m[1].toLowerCase() : null;
  }

  // Pulls the RFD section out of an AI draft. Falls back to the whole text.
  function parseRfd(text) {
    const m = /RFD:\s*([\s\S]*?)(?:\n\s*KEY CLASH:|$)/i.exec(text || '');
    return (m ? m[1] : text || '').trim();
  }

  // Columns shown in the Log table, picked by header name, not position.
  const LOG_COLUMNS = ['Saved at', 'Round', 'Aff team', 'Neg team', 'Winner', '1A pts', '2A pts', '1N pts', '2N pts']
    .map((name) => BALLOT_HEADER.indexOf(name));

  function buildJudgePrompt(round, docs, opts) {
    const lines = [];
    const ai = round.ai || {};
    lines.push('ROUND INFO');
    lines.push('Tournament: ' + (round.tournament || '-') + ' | Round: ' + (round.roundName || '-'));
    lines.push('Resolution: ' + (round.topic || '-'));
    // Students are named only by position (1A, 2A, 1N, 2N). Names never go to an AI provider.
    lines.push('Aff: speakers 1A and 2A. Neg: speakers 1N and 2N.');
    lines.push('');
    lines.push('JUDGE PARADIGM');
    lines.push(opts && opts.paradigm ? opts.paradigm : paradigmText(ai.paradigm, ai.customParadigm));
    if (ai.notes && ai.notes.trim()) lines.push('Extra judge notes: ' + ai.notes.trim());
    lines.push('');
    lines.push('TRANSCRIPTS (machine speech-to-text; expect errors and gaps)');
    let any = false;
    for (const sp of SPEECHES) {
      const t = (round.transcripts || {})[sp.id];
      const head = '--- ' + sp.label + ' (' + sp.side.toUpperCase() + ', ' + sp.speaker + ') ---';
      if (t && t.trim()) {
        any = true;
        lines.push(head);
        lines.push(t.trim());
      } else {
        // No transcript, but a speech doc: debaters usually read their doc, so the doc is the speech.
        const mine = (docs || []).filter((d) => docSpeech(d) === sp.id).map((d) => d.name);
        if (mine.length) {
          any = true;
          lines.push(head);
          lines.push('(No transcript. Treat the speech doc as what was said: ' + mine.join(', ') + '.)');
        }
      }
    }
    if (!any) lines.push('(none recorded)');
    lines.push('');
    lines.push("JUDGE'S FLOW (the human judge's own notes; trust these over the transcript when they conflict)");
    let anyFlow = false;
    for (const f of round.flows || []) {
      const cols = FLOW_COLUMNS.map((c, i) => [c.label, (f.cells || {})[i]]).filter(([, v]) => v && v.trim());
      if (!cols.length) continue;
      anyFlow = true;
      lines.push('### Sheet: ' + f.name);
      for (const [label, v] of cols) lines.push('[' + label + ']\n' + v.trim());
    }
    if (!anyFlow) lines.push('(empty)');
    const aiSheets = (round.aiFlows || []).map((sh) => {
      const cols = FLOW_COLUMNS.map((c, i) => [c.label + (sh.edits && sh.edits[i] ? ' (edited by the judge)' : ''), flowCellText(sh, i, 'detailed')]).filter(([, v]) => v);
      return cols.length ? '### Sheet: ' + sh.name + '\n' + cols.map(([l, v]) => '[' + l + ']\n' + v).join('\n') : '';
    }).filter(Boolean);
    if (aiSheets.length) {
      lines.push('');
      lines.push('AI FLOW (machine-made from the transcript during the round; less reliable than the judge\'s flow)');
      lines.push(aiSheets.join('\n'));
    }
    if (ai.evidence && ai.evidence.trim()) {
      lines.push('');
      lines.push('EVIDENCE / SPEECH DOCS PROVIDED');
      lines.push(ai.evidence.trim());
    }
    return lines.join('\n');
  }

  // Points that cluster within a few tenths tell debaters nothing. This scale spreads them.
  const POINTS_GUIDE = 'Speaker points must mean something, so use the full range: '
    + '29.5-30.0 outstanding (a top speaker at a big tournament); 29.0-29.4 excellent; 28.5-28.9 strong; '
    + '28.0-28.4 solid, about average; 27.5-27.9 below average; 27.0-27.4 weak; 26.0-26.9 serious problems; '
    + 'below 26 only for rudeness or not giving a speech. '
    + 'Spread the four debaters by how well each one did: separate speakers who were not equally good by at least 0.3-0.5, '
    + 'and in most rounds the best and worst speaker should be 1.0 or more apart. Never put everyone within a few tenths.';

  const JUDGE_SYSTEM = [
    'You help a human judge decide a high school policy (CX) debate round.',
    'The human makes the final call. Your job is a clear, fair draft.',
    'Judge only the arguments in the round, under the given paradigm.',
    'Track each argument from first speech to last. Note drops. New arguments in the 2NR or 2AR do not count; the 1AR may answer new arguments from the block.',
    'Say where the transcript is unclear instead of guessing.',
    '',
    'Reply in this exact structure, in plain text with short headings:',
    'DECISION: AFF or DECISION: NEG   (first line, nothing before it)',
    'CONFIDENCE: low / medium / high',
    'RFD: 4–8 sentences a coach can read on a ballot. Name the arguments that decided it.',
    'KEY CLASH: one line per main argument: who won it and why.',
    'DROPS: arguments one side conceded.',
    'FEEDBACK: one short paragraph for each debater (1A, 2A, 1N, 2N): one strength, one thing to fix.',
    'SUGGESTED POINTS: 1A, 2A, 1N, 2N, each with a 3-6 word reason (the judge sets the final points).',
    '',
    POINTS_GUIDE,
  ].join('\n');

  // Splits the AI draft's FEEDBACK section into Aff (1A, 2A) and Neg (1N, 2N) comments,
  // to paste into the per-team boxes on Tabroom.
  function parseFeedback(text) {
    const m = /FEEDBACK:\s*([\s\S]*?)(?:\n\s*SUGGESTED POINTS:|$)/i.exec(text || '');
    const out = { aff: [], neg: [] };
    if (!m) return { aff: '', neg: '' };
    let cur = null;
    for (const line of m[1].split('\n')) {
      const who = /^\s*[-*•]?\s*\**\s*(1A|2A|1N|2N)\b/i.exec(line);
      if (who) cur = who[1].toUpperCase().endsWith('A') ? 'aff' : 'neg';
      if (cur && line.trim()) out[cur].push(line.trim());
    }
    return { aff: out.aff.join('\n'), neg: out.neg.join('\n') };
  }

  // ---------- live transcription (OpenAI) ----------
  // A short vocabulary hint helps the speech model spell debate words.
  const TRANSCRIBE_HINT = 'High school policy debate. Terms: affirmative, negative, 1AC, 1NC, 2AC, 2NC, 1NR, 1AR, 2NR, 2AR, '
    + 'cross-ex, plan text, inherency, harms, solvency, advantage, topicality, T, interpretation, violation, '
    + 'counterplan, CP, disad, DA, uniqueness, link, internal link, impact, kritik, K, alternative, perm, '
    + 'framework, condo, extend, turn, card, tag, status quo, USFG.';

  // The model reads only the end of the prompt, so pass a short tail of what came before.
  function buildTranscribePrompt(prevText) {
    const tail = (prevText || '').slice(-300);
    return tail ? TRANSCRIBE_HINT + ' ' + tail : TRANSCRIBE_HINT;
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

  // ---------- live AI flow (Claude) ----------
  // Which flow column a speech writes to. CX is not flowed.
  const SPEECH_TO_COLUMN = { '1AC': 0, '1NC': 1, '2AC': 2, '2NC': 3, '1NR': 3, '1AR': 4, '2NR': 5, '2AR': 6 };
  function speechColumn(speechId) {
    return Object.prototype.hasOwnProperty.call(SPEECH_TO_COLUMN, speechId) ? SPEECH_TO_COLUMN[speechId] : null;
  }

  // Detail levels for the AI flow. One Claude call writes all three, so switching is instant.
  const FLOW_LEVELS = ['brief', 'standard', 'detailed'];

  // A speech's notes on a sheet are { brief, standard, detailed }.
  // Older saved rounds stored one plain string; treat that as every level.
  function partText(part, level) {
    if (!part) return '';
    if (typeof part === 'string') return part.trim();
    const lv = FLOW_LEVELS.includes(level) ? level : 'standard';
    return String(part[lv] || part.standard || part.detailed || part.brief || '').trim();
  }

  // AI sheets store notes per speech, so the 1NR never overwrites the 2NC in the shared block column.
  function aiFlowCell(sheet, col, level) {
    const ids = Object.keys(SPEECH_TO_COLUMN).filter((id) => SPEECH_TO_COLUMN[id] === col);
    const filled = ids.filter((id) => partText(sheet.parts && sheet.parts[id], level));
    if (filled.length === 1) return partText(sheet.parts[filled[0]], level);
    return filled.map((id) => id + ':\n' + partText(sheet.parts[id], level)).join('\n\n');
  }

  // Claude returns the full notes for the current speech each time.
  // So replace this speech's notes on every sheet; never append.
  function applyLiveFlow(aiFlows, speechId, result) {
    // Judge edits (sheet.edits) are carried over untouched: the AI never overwrites them.
    const flows = (aiFlows || []).map((s) => ({ name: s.name, parts: Object.assign({}, s.parts), ...(s.edits ? { edits: Object.assign({}, s.edits) } : {}) }));
    for (const s of flows) delete s.parts[speechId];
    for (const item of (result && result.sheets) || []) {
      const name = String(item.sheet || '').trim();
      // Older replies had one "notes" field; use it for any level that is missing.
      const fallback = String(item.notes || item.standard || '').trim();
      const part = {};
      for (const lv of FLOW_LEVELS) part[lv] = String(item[lv] || fallback).trim();
      if (!name || !FLOW_LEVELS.some((lv) => part[lv])) continue;
      let sheet = flows.find((s) => s.name.toLowerCase() === name.toLowerCase());
      if (!sheet) { sheet = { name, parts: {} }; flows.push(sheet); }
      sheet.parts[speechId] = part;
    }
    return flows.filter((s) => Object.values(s.parts).some((v) => partText(v, 'standard')) || Object.keys(s.edits || {}).length);
  }

  // What a flow cell shows: the judge's own edit if there is one, otherwise the AI's notes.
  function flowCellText(sheet, col, level) {
    const ed = sheet && sheet.edits && sheet.edits[col];
    return ed ? String(ed.text || '') : aiFlowCell(sheet, col, level);
  }

  // An edited cell is "behind" when the AI has written something new under it since the judge edited it.
  function editIsBehind(sheet, col) {
    const ed = sheet && sheet.edits && sheet.edits[col];
    return Boolean(ed) && aiFlowCell(sheet, col, 'standard') !== (ed.base || '');
  }

  // Keeps the judge's map work when the AI redraws the map: nodes and links the judge made or edited stay;
  // the AI's new nodes and links are added around them.
  function mergeMap(oldMap, freshMap) {
    const old = oldMap || { nodes: [], edges: [] };
    const fresh = freshMap || { nodes: [], edges: [] };
    const norm = (t) => String(t || '').trim().toLowerCase();
    const mine = (old.nodes || []).filter((n) => n.user || n.edited);
    const mineById = new Map(mine.map((n) => [String(n.id), n]));
    // Deleted cards: old saves list ids; newer saves list speech + original text, so a new AI card that
    // happens to reuse an id is not hidden by mistake.
    const goneIds = new Set((old.removedNodes || []).filter((x) => typeof x === 'string'));
    const goneKeys = new Set((old.removedNodes || []).filter((x) => x && typeof x === 'object').map((x) => x.key));
    // The AI reuses short ids ("a1") on every draw. A fresh node with a kept node's id is the same card only
    // if it is in the same speech and (when known) has the text the judge started from; otherwise it gets a new id.
    const idMap = new Map();
    const taken = new Set(mine.map((n) => String(n.id)));
    const added = [];
    for (const n of fresh.nodes || []) {
      const id = String(n.id);
      if (goneIds.has(id) || goneKeys.has(n.speech + '|' + norm(n.label))) { idMap.set(id, null); continue; }
      const kept = mineById.get(id);
      if (kept && kept.speech === n.speech && (!kept.aiLabel || norm(kept.aiLabel) === norm(n.label))) { idMap.set(id, id); continue; }
      let nid = id, k = 2;
      while (taken.has(nid)) nid = id + '_ai' + k++;
      taken.add(nid); idMap.set(id, nid);
      added.push(nid === id ? n : Object.assign({}, n, { id: nid }));
    }
    const nodes = mine.concat(added);
    const ids = new Set(nodes.map((n) => String(n.id)));
    const key = (e) => e.from + '>' + e.to;
    const myEdges = (old.edges || []).filter((e) => e.user);
    const myKeys = new Set(myEdges.map(key));
    const removed = new Set(old.removedEdges || []);
    const freshEdges = (fresh.edges || []).map((e) => Object.assign({}, e, { from: idMap.get(String(e.from)), to: idMap.get(String(e.to)) }))
      .filter((e) => e.from && e.to && !myKeys.has(key(e)) && !removed.has(key(e)));
    const edges = myEdges.concat(freshEdges).filter((e) => ids.has(String(e.from)) && ids.has(String(e.to)));
    return { nodes, edges, removedEdges: [...removed], removedNodes: old.removedNodes || [] };
  }


  const LIVE_FLOW_SCHEMA = {
    type: 'object',
    properties: {
      sheets: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            sheet: { type: 'string' },
            brief: { type: 'string' },
            standard: { type: 'string' },
            detailed: { type: 'string' },
          },
          required: ['sheet', 'brief', 'standard', 'detailed'],
          additionalProperties: false,
        },
      },
    },
    required: ['sheets'],
    additionalProperties: false,
  };

  const LIVE_FLOW_SYSTEM = [
    'You flow a high school policy debate for a judge, live, from a speech-to-text transcript.',
    'Flow only the CURRENT speech. Earlier speeches are already flowed and given for context.',
    'For each sheet, write the same arguments at three levels of detail:',
    '- brief: the big picture only. One short line per position or main answer (e.g. "Perm do both", "No link — plan is cheap"). No authors.',
    '- standard: normal flow shorthand. One line per argument, numbered, short tag, author + year if a card is read.',
    '- detailed: one entry per argument, numbered: the tag, author + year, then the warrant (why it is true, the key evidence) in one or two lines, and which earlier argument it answers.',
    'All three levels must cover the same arguments in the same order; only the depth changes.',
    'Put each argument on the sheet it answers. Use an existing sheet name exactly when the argument answers that sheet.',
    'Put the 1AC on a sheet named "Case". A new off-case position gets a new sheet named like "DA - Econ", "CP - States", "K - Cap" or "T - Substantial".',
    'Return every sheet this speech has touched so far, with the FULL notes for this speech on that sheet (they replace earlier notes for this speech).',
    'The transcript has errors and the speech may be unfinished. Mark unclear parts with "??".',
    'If documents are listed for the CURRENT speech and there is no transcript, treat the documents as the speech (debaters usually read their doc): flow every argument and card in them, in order, and end each line with " [doc]".',
    'If there is a transcript, use it first. Add arguments from the current speech\'s documents that the transcript does not cover, ending each with " [doc?]" (in the doc, not heard; a gap in the transcript or a skipped card).',
    'Do not invent arguments beyond the transcript and the current speech\'s documents. Never flow a document listed for another speech into this one.',
  ].join('\n');

  function buildLiveFlowPrompt(round, speechId, docs) {
    const col = speechColumn(speechId);
    const sp = SPEECHES.find((s) => s.id === speechId);
    const lines = [];
    lines.push('Resolution: ' + (round.topic || '-'));
    lines.push('');
    lines.push('FLOW SO FAR (earlier speeches):');
    let any = false;
    for (const sheet of round.aiFlows || []) {
      const cols = [];
      for (let c = 0; c < FLOW_COLUMNS.length; c++) {
        const parts = Object.assign({}, sheet.parts);
        delete parts[speechId];
        const edited = sheet.edits && sheet.edits[c] && c !== col;
        const text = edited ? sheet.edits[c].text + ' (edited by the judge; trust this)' : aiFlowCell({ parts }, c, 'standard');
        if (text) cols.push('[' + FLOW_COLUMNS[c].label + ']\n' + text);
      }
      if (!cols.length) continue;
      any = true;
      lines.push('### ' + sheet.name);
      lines.push(cols.join('\n'));
    }
    if (!any) lines.push('(nothing yet)');
    lines.push('');
    lines.push('CURRENT SPEECH: ' + speechId + ' (' + (sp ? sp.side.toUpperCase() : '?') + ') → flow column "' + (col == null ? '?' : FLOW_COLUMNS[col].label) + '"');
    const mine = (docs || []).filter((d) => docSpeech(d) === speechId).map((d) => d.name);
    lines.push('DOCUMENTS FOR THIS SPEECH: ' + (mine.length ? mine.join(', ') : '(none)'));
    lines.push('TRANSCRIPT SO FAR:');
    lines.push(((round.transcripts || {})[speechId] || '').trim() || '(empty)');
    return lines.join('\n');
  }

  // ---------- SpeechDrop (speechdrop.net) ----------
  // Debaters share speech docs in a SpeechDrop room. The judge types the room code; Tabula lists the files.
  // A room code, from what the judge types or pastes: "abc123", or a link like https://speechdrop.net/abc123.
  function parseSpeechDropCode(input) {
    const t = String(input || '').trim();
    const m = t.match(/^(?:https?:\/\/)?(?:www\.)?speechdrop\.net\/([A-Za-z0-9_-]{1,40})\/?(?:[?#].*)?$/i) || t.match(/^([A-Za-z0-9_-]{1,40})$/);
    return m ? m[1] : '';
  }
  // The room's file list: SpeechDrop keeps a slot per upload (null once deleted); the slot number finds the file.
  function speechDropFiles(index) {
    return (Array.isArray(index) ? index : [])
      .map((e, i) => (e && typeof e.name === 'string' ? { i, name: e.name, ctime: Number(e.ctime) || 0 } : null))
      .filter(Boolean);
  }
  // A guess at which speech a file belongs to, from its name ("Lake AB 1NC v2.docx" -> 1NC). '' = context only.
  function guessSpeech(fileName) {
    const n = String(fileName || '').replace(/\.[a-z0-9]+$/i, '');
    const m = n.match(/(?:^|[^A-Za-z0-9])([12])\s?(AC|NC|NR|AR)(?=$|[^A-Za-z])/i);
    if (m) return m[1] + m[2].toUpperCase();
    if (/\bblock\b/i.test(n)) return '2NC';
    return '';
  }
  // The side a speech belongs to (for the doc's Aff/Neg tag).
  const speechSide = (speechId) => ((SPEECHES.find((s) => s.id === speechId) || {}).side || 'other');

  // ---------- names out of AI prompts ----------
  // Debaters are minors. Their names and team codes are swapped for positions before any text goes to an AI,
  // and swapped back in the AI's reply, so the judge still reads names on screen.
  function nameSwaps(round) {
    const r = round || {};
    const out = [];
    const add = (name, tag) => {
      const n = String(name || '').trim();
      if (n.length < 2) return;
      out.push([n, tag]);
      const parts = n.split(/\s+/);
      if (parts.length > 1) for (const p of parts) if (p.length >= 3) out.push([p, tag]); // "Ann Lee" -> also "Ann", "Lee"
    };
    add(r.aff && r.aff.d1, '1A'); add(r.aff && r.aff.d2, '2A'); add(r.neg && r.neg.d1, '1N'); add(r.neg && r.neg.d2, '2N');
    add(r.aff && r.aff.team, 'the Aff team'); add(r.neg && r.neg.team, 'the Neg team');
    return out.sort((a, b) => b[0].length - a[0].length);
  }
  const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Names match only when written as a name: as typed, capitalized, or in capitals ("Will", "WILL"),
  // so a debater named Will or Grace does not turn every "will" or "grace" in a speech into "1A".
  function anonymize(text, round) {
    const forms = (n) => [...new Set([n, n.charAt(0).toUpperCase() + n.slice(1), n.toUpperCase()])];
    return nameSwaps(round).reduce((t, [name, tag]) => forms(name).reduce((u, f) => u.replace(new RegExp('(^|[^\\p{L}\\p{N}])' + reEsc(f) + '(?=$|[^\\p{L}\\p{N}])', 'gu'), (m, pre) => pre + tag), t), String(text == null ? '' : text));
  }
  // Puts names back in a reply (any mix of objects, lists and text). Keys stay as they are ('1A' points keys).
  function deanonymize(value, round) {
    const r = round || {};
    const back = [['the Aff team', r.aff && r.aff.team], ['the Neg team', r.neg && r.neg.team], ['1A', r.aff && r.aff.d1], ['2A', r.aff && r.aff.d2], ['1N', r.neg && r.neg.d1], ['2N', r.neg && r.neg.d2]]
      .filter(([, n]) => String(n || '').trim()).map(([tag, n]) => [tag, String(n).trim()]);
    // A replacer function, so a name with "$" in it is inserted as written.
    const fix = (t) => back.reduce((s, [tag, name]) => s.replace(new RegExp('(^|[^\\p{L}\\p{N}])' + reEsc(tag) + '(?=$|[^\\p{L}\\p{N}])', 'gu'), (m, pre) => pre + name), t);
    const walk = (v) => (typeof v === 'string' ? fix(v) : Array.isArray(v) ? v.map(walk) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)])) : v);
    return back.length ? walk(value) : value;
  }

  // Docs from a file (a backup or a .tab round): only entries with an id, a name and their data.
  function cleanDocs(list) {
    return (Array.isArray(list) ? list : []).filter((d) => d && typeof d.id === 'string' && typeof d.name === 'string' && typeof d.data === 'string');
  }

  // ---------- round files (.tab) ----------
  // One round in one file: setup, timers, transcripts, flows, analysis, ballot, and its docs.
  // A .tab file is JSON; the name tells people (and their computer) it is a Tabula round.
  const ROUND_FILE_KIND = 'tabula-round';
  // A round with nothing in it yet: no names, no transcript, no flow notes, no clock used.
  function isRoundEmpty(r) {
    if (!r) return true;
    const people = [r.tournament, r.roundName, r.aff && r.aff.team, r.aff && r.aff.d1, r.aff && r.aff.d2, r.neg && r.neg.team, r.neg && r.neg.d1, r.neg && r.neg.d2];
    if (people.some((x) => String(x || '').trim())) return false;
    if (Object.values(r.transcripts || {}).some((t) => String(t || '').trim())) return false;
    if ((r.aiFlows || []).length) return false;
    if ((r.flows || []).some((f) => Object.values(f.cells || {}).some((c) => String(c || '').trim()))) return false;
    if (Object.keys(r.timeLeft || {}).length) return false;
    if (r.ballot && r.ballot.winner) return false;
    return true;
  }
  function buildRoundFile(round, docs, savedAt) {
    return { app: 'tabula', kind: ROUND_FILE_KIND, version: 1, savedAt: savedAt || new Date().toISOString(), round, docs: (docs || []).filter((d) => d && d.roundId === round.id) };
  }
  // Reads a .tab file. The round gets a new id (newId), and its docs move to that id,
  // so opening the same file twice never mixes two rounds' docs.
  function parseRoundFile(text, newId) {
    let f;
    try { f = JSON.parse(text); } catch { throw new Error('this is not a Tabula round file'); }
    if (!f || f.app !== 'tabula' || f.kind !== ROUND_FILE_KIND) throw new Error(f && f.kind === 'backup' ? 'this is a full backup. Open it under Library → Back up your work' : 'this is not a Tabula round file');
    if (!(f.version >= 1)) throw new Error('this round file has no version');
    if (f.version > 1) throw new Error('this round file is from a newer Tabula. Update the app first');
    const r = f.round;
    if (!r || typeof r !== 'object' || typeof r.transcripts !== 'object' || !Array.isArray(r.flows)) throw new Error('the round in this file is damaged');
    // Only well-formed parts come in; the app fills anything missing with its defaults.
    const obj = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x : {});
    const str = (x) => (typeof x === 'string' ? x : '');
    const team = (t) => ({ team: str(obj(t).team), d1: str(obj(t).d1), d2: str(obj(t).d2) });
    const num = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : undefined);
    // Unknown keys are kept (newer app versions add fields), except ones that could change object prototypes.
    const safe = Object.fromEntries(Object.entries(r).filter(([k]) => !['__proto__', 'constructor', 'prototype'].includes(k)));
    const round = Object.assign({}, safe, {
      id: newId,
      tournament: str(r.tournament), roundName: str(r.roundName), judge: str(r.judge), topic: str(r.topic),
      aff: team(r.aff), neg: team(r.neg),
      transcripts: Object.fromEntries(Object.entries(obj(r.transcripts)).filter(([, v]) => typeof v === 'string')),
      flows: r.flows.filter((s) => s && typeof s.name === 'string').map((s) => ({ name: s.name, cells: obj(s.cells) })),
      aiFlows: Array.isArray(r.aiFlows) ? r.aiFlows.filter((s) => s && typeof s.name === 'string') : [],
      timeLeft: Object.fromEntries(Object.entries(obj(r.timeLeft)).filter(([, v]) => num(v) != null)),
      ballot: Object.assign({ winner: '', pts: {}, ranks: {}, rfd: '' }, obj(r.ballot)),
    });
    for (const k of ['prepSeconds', 'cur', 'flowIdx']) if (num(r[k]) == null) delete round[k];
    if (r.prepLeft != null && (num(obj(r.prepLeft).aff) == null || num(obj(r.prepLeft).neg) == null)) delete round.prepLeft;
    const docs = cleanDocs(f.docs).map((d) => Object.assign({}, d, { id: newId + ':' + d.id, roundId: newId }));
    return { round, docs, savedAt: f.savedAt || '' };
  }
  // A file name people can recognize in Downloads: tournament, round, and the two teams.
  function roundFileName(r, date) {
    const bits = [r.tournament, r.roundName, [r.aff && r.aff.team, r.neg && r.neg.team].filter(Boolean).join(' vs ')].map((x) => String(x || '').trim()).filter(Boolean);
    const base = (bits.join(' - ') || 'round ' + (date || '')).replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
    return (base || 'round') + '.tab';
  }

  // ---------- backup and restore ----------
  // One file holds everything the app keeps in the browser, so it can be saved or moved to another computer.
  const BACKUP_PREFIX = 'policyJudge.';
  const KEYS_ENTRY = 'policyJudge.keys.v1';
  const OLD_KEY_ENTRIES = ['policyJudge.key', 'policyJudge.openaiKey'];

  // storage: { name: rawString } for every browser storage entry. docs: the round documents.
  function buildBackup(storage, docs, opts) {
    const o = opts || {};
    const entries = {};
    for (const [k, v] of Object.entries(storage || {})) {
      if (!k.startsWith(BACKUP_PREFIX)) continue;
      // API keys stay out unless the judge asks for them: a backup file is easy to share by mistake.
      if (!o.includeKeys && (k === KEYS_ENTRY || OLD_KEY_ENTRIES.includes(k))) continue;
      entries[k] = v;
    }
    return { app: 'tabula', kind: 'backup', version: 1, exportedAt: o.now || new Date().toISOString(), includesKeys: Boolean(o.includeKeys), storage: entries, docs: docs || [] };
  }

  // Reads a backup file and says plainly what is wrong with it, if anything.
  function parseBackup(text) {
    let j;
    try { j = JSON.parse(text); } catch { throw new Error('This file is not a Tabula backup (it is not JSON).'); }
    if (!j || j.app !== 'tabula' || j.kind !== 'backup') throw new Error('This file is not a Tabula backup.');
    if (j.version !== 1) throw new Error('This backup is from a newer version of Tabula. Update the app first.');
    if (!j.storage || typeof j.storage !== 'object') throw new Error('This backup has no saved data in it.');
    const storage = {};
    for (const [k, v] of Object.entries(j.storage)) if (k.startsWith(BACKUP_PREFIX) && typeof v === 'string') storage[k] = v;
    const docs = cleanDocs(j.docs);
    return { storage, docs, exportedAt: j.exportedAt || '', includesKeys: Boolean(j.includesKeys) };
  }

  // A short summary for the "are you sure" message.
  function backupSummary(b) {
    let round = {}, log = [];
    try { round = JSON.parse(b.storage['policyJudge.round.v1'] || '{}') || {}; } catch {}
    try { log = JSON.parse(b.storage['policyJudge.log.v1'] || '[]') || []; } catch {}
    const name = [round.tournament, round.roundName].filter(Boolean).join(' — ') || 'unnamed round';
    return { round: name, ballots: Array.isArray(log) ? log.length : 0, docs: (b.docs || []).length, keys: b.includesKeys };
  }

  // ---------- ballot filler ----------
  const PT = { type: 'number' };
  const RK = { type: 'integer', enum: [1, 2, 3, 4] };
  const BALLOT_SCHEMA = {
    type: 'object',
    properties: {
      winner: { type: 'string', enum: ['aff', 'neg'] },
      confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
      points: { type: 'object', properties: { '1A': PT, '2A': PT, '1N': PT, '2N': PT }, required: ['1A', '2A', '1N', '2N'], additionalProperties: false },
      ranks: { type: 'object', properties: { '1A': RK, '2A': RK, '1N': RK, '2N': RK }, required: ['1A', '2A', '1N', '2N'], additionalProperties: false },
      rfd: { type: 'string' },
      aff_comments: { type: 'string' },
      neg_comments: { type: 'string' },
      points_reasoning: { type: 'string' },
    },
    required: ['winner', 'confidence', 'points', 'ranks', 'rfd', 'aff_comments', 'neg_comments', 'points_reasoning'],
    additionalProperties: false,
  };

  const BALLOT_TASK = [
    'Fill in the ballot for this round as of now.',
    '- winner and confidence.',
    '- points for 1A, 2A, 1N, 2N (one decimal place) and ranks 1-4 (1 = best). Ranks must use 1, 2, 3 and 4 once each and must agree with the points (higher points, better rank).',
    '- rfd: the reason for decision for everyone in the round, 4-8 sentences, naming the arguments that decided it.',
    '- aff_comments / neg_comments: comments for each team, one short paragraph per debater with one strength and one thing to fix.',
    '- points_reasoning: one line per debater on why they got those points.',
    'If the round is unfinished, fill it as if it ended now and say so in the RFD.',
  ].join('\n');

  const BALLOT_FIELDS = ['winner', 'pts.1A', 'pts.2A', 'pts.1N', 'pts.2N', 'ranks.1A', 'ranks.2A', 'ranks.1N', 'ranks.2N', 'rfd', 'affFb', 'negFb'];

  // Slice 4 (4.3) opts: only (the fields the judge picked; the AI still fills every field), redraft
  // ({ fields, previous } for [Redo this]), range (the points range) and liveEvalFeedback (the Live Eval feedback list).
  function buildBallotPrompt(round, docs, judgeInput, opts) {
    const o = opts || {};
    const b = round.ballot || {};
    const touched = b.touched || {};
    const kept = BALLOT_FIELDS.filter((f) => touched[f]).map((f) => {
      const [a, k] = f.split('.');
      const v = k ? (b[a] || {})[k] : b[f];
      return f + ' = ' + (typeof v === 'string' && v.length > 300 ? v.slice(0, 300) + '…' : v);
    });
    const lines = [BALLOT_TASK, '', POINTS_GUIDE];
    const range = ptsRange(o.range);
    if (!isDefaultRange(range)) lines.push('', 'This tournament uses ' + range.min + '–' + range.max + '. Map the scale above onto that range.');
    if (kept.length) lines.push('', 'THE JUDGE ALREADY SET THESE BY HAND. Keep them, and make the rest agree with them:', ...kept);
    if (judgeInput && judgeInput.trim()) lines.push('', "THE JUDGE'S OWN INPUT. Weigh it heavily; where it conflicts with your read, follow the judge:", judgeInput.trim());
    if (o.only && o.only.length) lines.push('', 'THE JUDGE WANTS NEW TEXT FOR: ' + o.only.map(fieldLabel).join(', ') + '. Still fill every field.');
    if (o.redraft && o.redraft.fields && o.redraft.fields.length) {
      lines.push('', 'REDO: the judge asked for a different version of ' + o.redraft.fields.map(fieldLabel).join(', ') + '.');
      for (const [f, v] of Object.entries(o.redraft.previous || {})) if (v != null && String(v).trim()) lines.push('Your last version of ' + fieldLabel(f) + ': ' + String(v).slice(0, 600));
    }
    const fb = feedbackLines(o.liveEvalFeedback);
    if (fb.length) lines.push('', 'LIVE EVAL FEEDBACK. Use it for the Aff and Neg comments:', ...fb);
    lines.push('', buildJudgePrompt(round, docs));
    return lines.join('\n');
  }

  // Puts an AI ballot draft into the ballot, but never over a field the judge typed by hand.
  // With override (the judge asked for it, e.g. "Redo with my input"), it may change hand-set fields too.
  // Slice 4 (4.4, 4.6) opts.only: write exactly these fields (the judge chose them in the review, so a "yours" field
  // in the list is written). opts.range: AI points outside it are never written. opts.mark: 'yours' (an insert) or
  // 'ai' (an auto refill) for the fields written.
  function applyBallotDraft(ballot, draft, opts) {
    const o = opts || {};
    let b = JSON.parse(JSON.stringify(ballot || {}));
    const touched = o.only ? {} : o.override ? {} : b.touched || {};
    b.pts ??= {}; b.ranks ??= {};
    const bad = new Set(o.range ? outOfRangePoints(draft, o.range).map((x) => 'pts.' + x.speaker) : []);
    const allow = o.only ? new Set(o.only) : null;
    const written = [];
    for (const field of BALLOT_FIELDS) {
      if (allow && !allow.has(field)) continue;
      if (touched[field] || bad.has(field)) continue;
      const value = draftValue(draft, field);
      if (value === undefined || value === null || value === '') continue;
      const [a, k] = field.split('.');
      if (k) b[a][k] = value; else b[a] = value;
      written.push(field);
    }
    if (o.mark) b = markFields(b, written, o.mark);
    return b;
  }

  // ---------- reading level ----------
  // The same analysis, written for two readers. Only the wording changes, never the verdict.
  const READING_LEVELS = {
    expert: { label: 'Expert', guide: 'READING LEVEL: expert. Write for an experienced college policy judge. Precise, technical debate vocabulary and shorthand are fine.' },
    plain: { label: 'Plain', guide: 'READING LEVEL: plain (Feynman style). Write so a first-year high school debater and their parent can follow it on one read. '
      + 'Use short sentences and everyday words. When you must use a debate term, explain it in a few plain words the first time '
      + '(for example: "the link, meaning why the plan causes the problem"). Prefer one concrete example over abstract wording. '
      + 'Talk to debaters directly and kindly in feedback ("you", not "the 1A"). Keep the same substance, verdict and points; only the wording gets simpler.' },
  };
  function readingGuide(level) { return (READING_LEVELS[level] || READING_LEVELS.expert).guide; }

  // ---------- live evaluation (mid-round) ----------
  // Speeches that have happened: they have a transcript, used clock time, or AI flow notes.
  function speechesSoFar(round) {
    const r = round || {};
    const flowIds = new Set();
    for (const sh of r.aiFlows || []) for (const id of Object.keys(sh.parts || {})) flowIds.add(id);
    return SPEECHES.filter((s) => {
      const t = ((r.transcripts || {})[s.id] || '').trim();
      const left = (r.timeLeft || {})[s.id];
      return t || (left != null && left < s.minutes * 60) || flowIds.has(s.id);
    }).map((s) => s.id);
  }

  function nextSpeech(round) {
    const done = speechesSoFar(round);
    if (!done.length) return SPEECHES[0].id;
    const last = SPEECHES.findIndex((s) => s.id === done[done.length - 1]);
    return last + 1 < SPEECHES.length ? SPEECHES[last + 1].id : null;
  }

  const EVAL_SYSTEM = [
    'You help a human judge follow a high school policy (CX) debate WHILE it is happening.',
    'The round may be unfinished. Judge only what has been said so far, under the given paradigm, and say what could still change.',
    'Remember the norms: the 2NR and 2AR cannot make new arguments; dropped arguments are conceded; the block (2NC + 1NR) splits the neg\'s positions.',
    'Transcripts are machine speech-to-text with errors. A speech with no transcript but a speech doc: treat the doc as what was said. In the AI flow, [doc] lines come from the speech doc; [doc?] lines are in the doc but were not heard.',
    'Be concrete: name the arguments, cards and speeches. Keep each item short enough to read in a few seconds.',
  ].join('\n');

  const EVAL_SPEAKER = {
    type: 'object',
    properties: {
      speaker: { type: 'string', enum: ['1A', '2A', '1N', '2N'] },
      so_far: { type: 'string' },
      strength: { type: 'string' },
      fix: { type: 'string' },
      points: { type: 'string' },
    },
    required: ['speaker', 'so_far', 'strength', 'fix', 'points'],
    additionalProperties: false,
  };

  const EVAL_SCHEMA = {
    type: 'object',
    properties: {
      leaning: {
        type: 'object',
        properties: {
          side: { type: 'string', enum: ['aff', 'neg', 'toss-up'] },
          confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
          why: { type: 'string' },
        },
        required: ['side', 'confidence', 'why'],
        additionalProperties: false,
      },
      summary: { type: 'string' },
      key_issues: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            issue: { type: 'string' },
            ahead: { type: 'string', enum: ['aff', 'neg', 'even', 'unclear'] },
            note: { type: 'string' },
          },
          required: ['issue', 'ahead', 'note'],
          additionalProperties: false,
        },
      },
      watch_for: { type: 'array', items: { type: 'string' } },
      aff_needs: { type: 'string' },
      neg_needs: { type: 'string' },
      feedback: { type: 'array', items: EVAL_SPEAKER },
    },
    required: ['leaning', 'summary', 'key_issues', 'watch_for', 'aff_needs', 'neg_needs', 'feedback'],
    additionalProperties: false,
  };

  function buildEvalPrompt(round, docs) {
    const done = speechesSoFar(round);
    const next = nextSpeech(round);
    const lines = [];
    lines.push('SPEECHES SO FAR: ' + (done.length ? done.join(', ') : '(none yet)'));
    lines.push('NEXT SPEECH: ' + (next || '(round is over)'));
    lines.push('');
    lines.push('Give a mid-round evaluation as of now:');
    lines.push('- leaning: who would win if the round ended now, how sure you are, and why (2-3 sentences).');
    lines.push('- summary: the state of the round in 3-5 sentences.');
    lines.push('- key_issues: the 3-6 arguments that matter most; who is ahead on each; one line on why.');
    lines.push('- watch_for: 3-6 specific things the judge should listen for in the coming speeches (drops, new arguments, extensions, weighing).');
    lines.push('- aff_needs / neg_needs: what each side must do in its remaining speeches to win.');
    lines.push('- feedback: one entry per debater (1A, 2A, 1N, 2N) on their speeches so far: what they did, one strength, one fix, and points so far (or "not yet" if they have not spoken).');
    lines.push(POINTS_GUIDE);
    lines.push('');
    lines.push(buildJudgePrompt(round, docs));
    return lines.join('\n');
  }

  // ---------- analysis: round map, impact calculus, paradigm lens ----------
  const ANALYSIS_SYSTEM = [
    'You analyse a high school policy (CX) debate for a human judge, from transcripts, flows and speech docs. The round may be unfinished.',
    'Use only what is in the round. Transcripts are machine speech-to-text with errors. With no transcript, a speech doc stands in for the speech.',
    'Be concrete and short: name arguments, cards and speeches.',
  ].join('\n');

  const MAP_SPEECHES = ['1AC', '1NC', '2AC', '2NC', '1NR', '1AR', '2NR', '2AR'];
  const MAP_SCHEMA = {
    type: 'object',
    properties: {
      nodes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            speech: { type: 'string', enum: MAP_SPEECHES },
            label: { type: 'string' },
            status: { type: 'string', enum: ['answered', 'extended', 'dropped', 'conceded', 'open'] },
          },
          required: ['id', 'speech', 'label', 'status'],
          additionalProperties: false,
        },
      },
      edges: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            from: { type: 'string' },
            to: { type: 'string' },
            kind: { type: 'string', enum: ['answers', 'extends', 'turns', 'concedes'] },
          },
          required: ['from', 'to', 'kind'],
          additionalProperties: false,
        },
      },
    },
    required: ['nodes', 'edges'],
    additionalProperties: false,
  };

  const MAP_TASK = [
    'Map the argument flow of the round as a graph.',
    '- nodes: one per argument as it appears in a speech (a later speech extending or answering it gets its own node). id: short unique id like "a1". label: 2-7 words. speech: where it was made.',
    '- status: "dropped" if the other side never answered it in a later speech; "conceded" if they agreed with it; "extended" if its own side carried it into a later speech; "answered" if it was responded to; "open" if the round has not reached a response yet.',
    '- edges: from the later node to the earlier node it responds to. kind: "answers" (a response), "turns" (a turn), "extends" (same side carries it forward), "concedes".',
    'Keep it readable: at most about 40 nodes; group small cards into one node.',
  ].join('\n');

  const IMPACT_SCHEMA = {
    type: 'object',
    properties: {
      impacts: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            impact: { type: 'string' },
            side: { type: 'string', enum: ['aff', 'neg'] },
            magnitude: { type: 'string' },
            probability: { type: 'string' },
            timeframe: { type: 'string' },
            reversibility: { type: 'string' },
            status: { type: 'string', enum: ['extended', 'contested', 'dropped', 'conceded', 'not yet extended'] },
            note: { type: 'string' },
          },
          required: ['impact', 'side', 'magnitude', 'probability', 'timeframe', 'reversibility', 'status', 'note'],
          additionalProperties: false,
        },
      },
      weighing_done: { type: 'string' },
      comparison: { type: 'string' },
      net: { type: 'string', enum: ['aff', 'neg', 'even'] },
    },
    required: ['impacts', 'weighing_done', 'comparison', 'net'],
    additionalProperties: false,
  };

  const IMPACT_TASK = [
    'Do impact calculus for the round so far.',
    '- impacts: every terminal impact either side has read (advantages, disads, kritik impacts, turns). For each: magnitude, probability, timeframe and reversibility in a few words each, based on the evidence and arguments in the round; its status; one line of note.',
    '- weighing_done: what weighing the debaters themselves did (or "none yet").',
    '- comparison: 3-5 sentences comparing the biggest impacts against each other, using the debaters\' weighing first.',
    '- net: whose impacts outweigh right now.',
  ].join('\n');

  const LENS_SCHEMA = {
    type: 'object',
    properties: {
      winner: { type: 'string', enum: ['aff', 'neg', 'toss-up'] },
      confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
      rfd: { type: 'string' },
      deciding_factors: { type: 'array', items: { type: 'string' } },
      lens_effect: { type: 'string' },
    },
    required: ['winner', 'confidence', 'rfd', 'deciding_factors', 'lens_effect'],
    additionalProperties: false,
  };

  const LENS_TASK = [
    'Weigh the round strictly under the JUDGE PARADIGM below, as if you were that judge.',
    '- winner and confidence, as of now.',
    '- rfd: 4-6 sentences, in the voice of that judge.',
    '- deciding_factors: the 2-5 things that decide it under this paradigm.',
    '- lens_effect: how this paradigm changes the result or the reasoning compared with a neutral read of the flow.',
  ].join('\n');

  function buildAnalysisPrompt(round, docs, task, opts) {
    const done = speechesSoFar(round);
    return 'SPEECHES SO FAR: ' + (done.length ? done.join(', ') : '(none yet)') + '\n\n' + task + '\n\n' + buildJudgePrompt(round, docs, opts);
  }

  // Builds Mermaid code from the map ourselves, so model text can never break or inject into the diagram.
  function buildMermaid(map) {
    const nodes = (map && map.nodes) || [];
    const edges = (map && map.edges) || [];
    const safeId = (id) => 'n_' + String(id).replace(/[^A-Za-z0-9_]/g, '_');
    const label = (t) => {
      const clean = String(t || '').replace(/[\r\n]+/g, ' ').replace(/["`]/g, "'").replace(/[<>{}\[\]|#;]/g, ' ').replace(/\s+/g, ' ').trim();
      return clean.length > 60 ? clean.slice(0, 57) + '...' : clean;
    };
    const sideOf = (sp) => (/A[CR]$/.test(sp) ? 'aff' : 'neg');
    const known = new Set();
    // Original id -> diagram id. Ids that clean up to the same text ("a-b", "a.b") get a suffix, so no node is lost.
    const idMap = new Map();
    const idFor = (orig) => {
      const key = String(orig);
      if (idMap.has(key)) return idMap.get(key);
      let id = safeId(key), n = 2;
      while ([...idMap.values()].includes(id)) id = safeId(key) + '_' + n++;
      idMap.set(key, id);
      return id;
    };
    // Arrows point from a later answer back to what it answers, so lay out right-to-left: the 1AC ends up on the left.
    const out = ['flowchart RL'];
    const groups = [];
    for (const sp of MAP_SPEECHES) {
      const inSp = nodes.filter((n) => n.speech === sp);
      if (!inSp.length) continue;
      out.push('  subgraph S_' + sp + '["' + sp + '"]');
      groups.push('S_' + sp);
      out.push('    direction TB');
      for (const n of inSp) {
        if (idMap.has(String(n.id))) continue; // same node listed twice
        const id = idFor(n.id);
        known.add(id);
        const cls = n.status === 'dropped' ? 'dropped' : n.status === 'conceded' ? 'conceded' : sideOf(sp);
        out.push('    ' + id + '["' + label(n.label) + (n.status === 'dropped' ? ' (dropped)' : '') + '"]:::' + cls);
      }
      out.push('  end');
    }
    const arrow = { answers: '-->|answers|', turns: '-.->|turns|', extends: '==>|extends|', concedes: '-->|concedes|' };
    for (const e of edges) {
      const a = idMap.get(String(e.from)), b = idMap.get(String(e.to));
      if (!a || !b || !Object.prototype.hasOwnProperty.call(arrow, e.kind)) continue;
      out.push('  ' + a + ' ' + arrow[e.kind] + ' ' + b);
    }
    for (const g of groups) out.push('  style ' + g + ' fill:transparent,stroke:#cfd4da,stroke-width:1px');
    out.push('  classDef aff fill:#ebf2fd,stroke:#1d5bc4,color:#123a7a');
    out.push('  classDef neg fill:#fdeeed,stroke:#b4231b,color:#6e140f');
    out.push('  classDef dropped fill:#fff6dc,stroke:#8a5a00,stroke-width:2px,stroke-dasharray:5 3,color:#5c3c00');
    out.push('  classDef conceded fill:#eeeeee,stroke:#777,stroke-dasharray:2 2,color:#333');
    return out.join('\n');
  }

  // Lays the map out like a flow sheet: one column per speech, one row per argument thread.
  // A thread is an argument plus everything that answers, turns or extends it, followed back to its root.
  // A dropped argument gets a "No answer" ghost in the next speech of the other side, if that speech has happened.
  function layoutMap(map, doneSpeeches) {
    const nodes = ((map && map.nodes) || []).filter((n) => n && MAP_SPEECHES.includes(n.speech));
    const edges = (map && map.edges) || [];
    const byId = new Map();
    for (const n of nodes) if (!byId.has(String(n.id))) byId.set(String(n.id), n);
    const order = (sp) => MAP_SPEECHES.indexOf(sp);
    const sideOf = (sp) => (/A[CR]$/.test(sp) ? 'aff' : 'neg');
    const KINDS = ['answers', 'turns', 'extends', 'concedes'];
    const parent = new Map(); // node id -> { to, kind }
    for (const e of edges) {
      const from = String(e.from), to = String(e.to);
      if (!byId.has(from) || !byId.has(to) || from === to || parent.has(from) || !KINDS.includes(e.kind)) continue;
      parent.set(from, { to, kind: e.kind });
    }
    // Follow answers back to the original argument. If bad data makes a loop, every node in the loop
    // shares one root: the one from the earliest speech, so the loop stays on a single row.
    const rootOf = (id) => {
      const path = [];
      let cur = id;
      while (parent.has(cur) && !path.includes(cur)) { path.push(cur); cur = parent.get(cur).to; }
      if (!path.includes(cur)) return cur;
      const loop = path.slice(path.indexOf(cur));
      return loop.sort((a, b) => order(byId.get(a).speech) - order(byId.get(b).speech) || (a < b ? -1 : 1))[0];
    };
    const rows = new Map();
    const ordered = [...byId.values()].sort((a, b) => order(a.speech) - order(b.speech));
    for (const n of ordered) {
      const id = String(n.id);
      const root = byId.get(rootOf(id)) || n;
      const rk = String(root.id);
      if (!rows.has(rk)) rows.set(rk, { root: rk, title: root.label, side: sideOf(root.speech), cells: {} });
      const row = rows.get(rk);
      (row.cells[n.speech] ??= []).push({
        id, label: n.label, status: n.status, side: sideOf(n.speech),
        kind: parent.has(id) ? parent.get(id).kind : null,
      });
    }
    const done = new Set(doneSpeeches || []);
    for (const row of rows.values()) {
      for (const sp of MAP_SPEECHES) {
        for (const c of row.cells[sp] || []) {
          if (c.status !== 'dropped' || c.ghost) continue;
          const next = MAP_SPEECHES.slice(order(sp) + 1).find((x) => sideOf(x) !== c.side && done.has(x));
          if (next && !(row.cells[next] || []).length) row.cells[next] = [{ ghost: true, label: 'No answer', side: sideOf(next) }];
        }
      }
    }
    const used = MAP_SPEECHES.filter((sp) => done.has(sp) || [...rows.values()].some((r) => (r.cells[sp] || []).length));
    return { columns: used, rows: [...rows.values()] };
  }

  // ---------- round documents (speech docs, case files) ----------
  const DOC_SIDES = { aff: 'AFF', neg: 'NEG', other: 'OTHER' };
  const DOC_NOTE = 'Speech documents from the debaters are attached above. Use them to read card tags, authors and evidence text. '
    + 'When a speech has no transcript, treat its speech doc as what was said: debaters usually read their doc. '
    + 'When a speech has a transcript, the transcript wins; a card in the doc that the transcript does not show may have been skipped, and it does not count unless the judge\'s own flow shows it. '
    + 'AI flow lines marked [doc] come from the speech doc; [doc?] (used only when a transcript exists) means it is in the doc but was not heard in the transcript, so do not score a [doc?] line unless the judge\'s own flow shows that argument.';

  // Which speech a doc belongs to. If the judge has not picked one: Aff docs go to the 1AC, Neg docs to the 1NC.
  function docSpeech(doc) {
    if (doc && doc.speech !== undefined) return doc.speech;
    return doc && doc.side === 'aff' ? '1AC' : doc && doc.side === 'neg' ? '1NC' : '';
  }
  // The docs one speech needs (the live flow sends only these, to keep each 30-second pass cheap).
  function docsForSpeech(docs, speechId) {
    return (docs || []).filter((d) => docSpeech(d) === speechId);
  }

  const DOC_FLOW_NOTE = 'Speech documents from the debaters are attached above. Each is listed with the speech it belongs to. '
    + 'If the current speech has no transcript, the speech doc IS the speech: flow all of it and mark those lines [doc]. Use the docs also to get card tags and authors right.';

  function docTitle(doc) {
    const sp = docSpeech(doc);
    return (DOC_SIDES[doc.side] || 'OTHER') + ' doc' + (sp ? ' for ' + sp : '') + ': ' + doc.name;
  }

  // Turns stored docs into Claude content blocks. PDFs go as native document blocks;
  // Word and text files go as text. The last block gets a cache mark so repeat calls
  // during the round reuse the docs instead of paying for them again.
  function buildDocBlocks(docs) {
    const blocks = [];
    for (const d of docs || []) {
      if (!d || !d.data) continue;
      if (d.kind === 'pdf') {
        blocks.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: d.data }, title: docTitle(d) });
      } else {
        blocks.push({ type: 'text', text: '=== ' + docTitle(d) + ' ===\n' + d.data });
      }
    }
    if (blocks.length) blocks[blocks.length - 1] = Object.assign({}, blocks[blocks.length - 1], { cache_control: { type: 'ephemeral' } });
    return blocks;
  }

  function buildUserContent(docs, promptText, note) {
    const blocks = buildDocBlocks(docs);
    if (!blocks.length) return promptText;
    return blocks.concat([{ type: 'text', text: (note || DOC_NOTE) + '\n\n' + promptText }]);
  }

  // ---------- Slice 1: round safety (docs/design/SPEC.md §3.1) ----------
  // A running clock stops by itself at -9:59 (599 s over), on screen and after a reload.
  const OVER_LIMIT = -599;
  const speechById = (id) => SPEECHES.find((s) => s.id === id) || null;

  // 1.1 The speech clock after a reload, a crash or sleep. run = { id, endAt, ... } as saved with the round.
  // Time always comes from the wall clock, so a closed tab keeps "running".
  function restoreRun(run, now, speechLength) {
    if (!run || typeof run !== 'object') return { state: 'none' };
    const s = speechById(run.id);
    if (!s || typeof run.endAt !== 'number' || !Number.isFinite(run.endAt) || !Number.isFinite(now)) return { state: 'none' };
    const len = Number.isFinite(speechLength) ? speechLength : s.minutes * 60;
    const left = (run.endAt - now) / 1000;
    // run.startLeft is the time left when the clock was started (a resumed speech has less than the full time).
    // More time than that, or than the speech has, means the device clock was moved back. 2 s allows for rounding.
    const cap = Number.isFinite(run.startLeft) ? Math.min(len, run.startLeft + 2) : len;
    // Start again from the full time (spec 1.1: the judge is told to check it).
    if (left > cap) return { state: 'running', id: s.id, left: len, endAt: now + len * 1000, reason: 'clock-moved' };
    if (left < OVER_LIMIT) return { state: 'paused', id: s.id, left: OVER_LIMIT, reason: 'over-limit' };
    return { state: 'running', id: s.id, left, endAt: run.endAt };
  }

  // 1.1b A prep clock after a reload. prepRun = { side, endAt }. maxSeconds = the round's prep per team.
  function restorePrep(prepRun, now, maxSeconds) {
    if (!prepRun || typeof prepRun !== 'object') return { state: 'none' };
    if (!['aff', 'neg'].includes(prepRun.side) || typeof prepRun.endAt !== 'number' || !Number.isFinite(prepRun.endAt) || !Number.isFinite(now)) return { state: 'none' };
    const left = (prepRun.endAt - now) / 1000;
    if (left <= 0) return { state: 'paused', side: prepRun.side, left: 0, reason: 'ran-out' };
    if (Number.isFinite(maxSeconds) && left > maxSeconds) return { state: 'running', side: prepRun.side, left: maxSeconds, endAt: now + maxSeconds * 1000, reason: 'clock-moved' };
    return { state: 'running', side: prepRun.side, left, endAt: prepRun.endAt };
  }

  // Both clocks at once. Only one may run: a prep start always pauses the speech, so prep wins
  // and the speech is paused at its restored time (a damaged file or a race can save both).
  function restoreClocks(run, prepRun, now, maxPrepSeconds, speechLength) {
    let speech = restoreRun(run, now, speechLength);
    const prep = restorePrep(prepRun, now, maxPrepSeconds);
    if (speech.state === 'running' && prep.state === 'running') speech = { state: 'paused', id: speech.id, left: speech.left, reason: 'prep-running' };
    return { speech, prep };
  }

  // The 0:00 beep plays once. It is skipped (but marked as done) when the page wakes or reloads more than 5 s late.
  // Returns 'beep', 'skip' (mark it done, no sound) or null (nothing to do).
  function beepDecision(left, beeped) {
    if (beeped || !(left <= 0)) return null;
    return left > -5 ? 'beep' : 'skip';
  }

  // A failed localStorage write: 'full' (the quota is used up) or 'blocked' (the browser refuses storage).
  function storageErrorKind(err) {
    const name = err && err.name;
    const code = err && err.code;
    if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' || code === 22 || code === 1014) return 'full';
    return 'blocked';
  }

  // Two tabs on one round: the clock fields (run, prepRun, timeLeft, prepLeft) are one unit with one savedAt.
  // The unit with the newer savedAt wins. Returns true when the incoming unit should replace ours.
  function clockUnitIsNewer(ours, incoming) {
    if (!incoming || typeof incoming !== 'object') return false;
    const a = Number((ours && ours.savedAt) || 0), b = Number(incoming.savedAt || 0);
    return Number.isFinite(b) && b > a;
  }

  // 1.2 View only. The short name of a speech on a label: "1NC", "CX 1A".
  const shortSpeech = (id) => String(id).replace('CX-', 'CX ');
  // The label while the judge looks at one speech and another one's clock runs. null when not viewing.
  function viewingLabel(viewedId, runningId) {
    if (!runningId || !viewedId || viewedId === runningId) return null;
    const v = shortSpeech(viewedId), r = shortSpeech(runningId);
    return { text: 'Viewing ' + v + ' · ' + r + ' running', back: 'Back to ' + r, sr: 'Viewing ' + v + '. ' + r + ' is still running.' };
  }

  // 1.4 How long a toast stays (ms). 0 means it stays until it is closed.
  function toastMs(text, kind, hasAction) {
    if (kind === 'error') return 0;
    if (hasAction) return 10000;
    const n = String(text || '').length;
    return Math.min(10000, Math.max(4000, 1000 + 60 * n));
  }

  // 1.5 How the speeches pane works at this window width (spec 1.5 table).
  function leftPaneMode(width, hideLeft) {
    if (width >= 1440) return hideLeft ? 'hidden' : 'inline';
    if (width >= 820) return 'overlay-closed';
    return 'stacked';
  }

  // 1.6 The recording notice shows the first time on this device that recording would start.
  function needsRecNotice(settings) {
    const s = settings || {};
    return !s.recConsentAt;
  }
  // 1.6 The "Recording" strip in the header. Returns { hidden } or { text, button } (button: 'stop' or 'resume').
  // st: { recWanted, live, stoppedByReload, speechId, online, engine ('browser' or a provider id), narrow }
  function recStripState(st) {
    const s = st || {};
    if (s.stoppedByReload && !s.recWanted) return { text: 'Recording stopped when the page reloaded. Words spoken since then were not recorded.', button: 'resume', buttonLabel: 'Resume recording' };
    if (!s.recWanted) return { hidden: true };
    if (!s.live) return { text: 'Starting microphone…', button: 'stop', buttonLabel: s.narrow ? 'Stop' : 'Stop recording' };
    let text = 'Recording · ' + shortSpeech(s.speechId || '');
    if (s.online === false) text += s.engine === 'browser' ? ' · no text while offline' : ' · text waits for the internet';
    return { text, dot: true, button: 'stop', buttonLabel: s.narrow ? 'Stop' : 'Stop recording' };
  }

  // Has the stored copy of the round already beeped for this same run? A second tab on the round reads it
  // before it beeps, so two open tabs give one beep, not two.
  function beepedElsewhere(stored, run) {
    const o = stored && stored.run;
    return Boolean(o && run && o.id === run.id && o.endAt === run.endAt && o.beeped);
  }

  // ---------- Slice 2: copy and dialogs (docs/design/SPEC.md §3.2) ----------
  // The one "no AI" line (spec 2.2). Every place that needs AI says exactly this.
  const NO_AI = 'No AI is connected. Connect one in Settings.';

  // The paid plan (spec 2.8) is not built yet, so no one has it. When it ships, this reads the plan state.
  function hasHostedPlan() { return false; }
  // The first-time welcome shows only to free users who have not finished it (spec 2.1, Q11).
  function shouldShowWelcome(o) {
    const s = o || {};
    return !s.hostedPlan && !s.setupDone;
  }

  // One classifier for every failed AI or transcription call (spec 2.3). The rules run in this order.
  // e: { status, name, message, online, stop: 'refusal' | 'max_tokens', helper: true when the call went to the local helper }.
  const QUOTA_RE = /quota|credit|billing|balance|insufficient/i;
  function classifyAIError(e) {
    const x = e || {};
    const status = Number(x.status) || 0;
    if (x.online === false) return 'offline';
    if (x.name === 'TimeoutError') return 'timeout';
    // A fetch that never got a reply throws a TypeError. To the local helper that means the helper is down (rule 8).
    // So helper calls (helper: true, only the /api/ai call in app.js callAI) skip rule 3. Without this, spec order
    // would make every helper failure "noReply" and rule 8 could never fire. Helper 4xx and 5xx replies still use
    // rules 4 to 6 (for example a 5xx from the helper is "busy"); that is a known trade-off.
    if (x.name === 'TypeError' && !x.helper) return 'noReply';
    if (status === 401 || status === 403) return 'keyRejected';
    if (status === 429 && QUOTA_RE.test(String(x.message || ''))) return 'noCredit';
    if (status === 429 || status === 408 || (status >= 500 && status < 600)) return 'busy';
    if (status === 404) return 'modelGone';
    if (x.stop === 'refusal') return 'refused';
    if (x.stop === 'max_tokens') return 'cutOff';
    if (x.helper && (x.name === 'TypeError' || status === 0)) return 'helperDown';
    return 'other';
  }
  // The text for each kind. {provider} is the provider of the judge's own key; it is the only name copy may hold.
  const AI_ERROR_TEXT = {
    offline: 'You are offline. AI and transcription will start again when the internet is back. Your flow is saved on this device.',
    noReply: 'No reply from {provider}. Check your internet. If the internet works, test the key in Settings.',
    timeout: 'The AI took too long to answer. Try again.',
    keyRejected: 'The {provider} key was rejected. Paste it again in Settings, or make a new key.',
    noCredit: "The {provider} key works, but its account has no credit. Add credit on the provider's site.",
    busy: 'The AI service is busy. Wait a moment and try again.',
    modelGone: 'That AI model is no longer offered. Tabula will pick another. Try again.',
    refused: 'The AI would not answer this request. Decide by hand, or change the input and try again.',
    cutOff: "The AI's reply was cut off. Try again.",
    helperDown: 'The helper on this computer is not running. In the Tabula folder, run node bridge.mjs, then try again.',
    other: 'The AI call failed{status}. Try again. If it keeps failing, test the key in Settings.',
  };
  function aiErrorText(kind, opts) {
    const o = opts || {};
    const t = AI_ERROR_TEXT[kind] || AI_ERROR_TEXT.other;
    const status = Number(o.status) ? ' (error ' + Number(o.status) + ')' : '';
    return t.replace('{provider}', o.provider || 'the AI provider').replace('{status}', status);
  }
  // Each feature puts its name in front of the error text.
  const AI_ERROR_PREFIX = { flow: 'AI flow:', eval: 'Live Eval:', analysis: 'Analysis:', ballot: 'Ballot draft:', transcript: 'Transcript:', decision: 'Decision draft:' };

  // Shared Undo helpers (spec 2.4). removeAt never changes the list it gets.
  // Returns { list, undo: { index, item } }; restoreAt(list, undo.index, undo.item) puts the item back in its place.
  function removeAt(list, i) {
    const l = Array.isArray(list) ? list.slice() : [];
    if (!(i >= 0 && i < l.length)) return { list: l, undo: null };
    const [item] = l.splice(i, 1);
    return { list: l, undo: { index: i, item } };
  }
  function restoreAt(list, i, item) {
    const l = Array.isArray(list) ? list.slice() : [];
    l.splice(Math.max(0, Math.min(Number(i) || 0, l.length)), 0, item);
    return l;
  }

  // The text box in ask() (spec 4.2): is the typed text good enough for the primary button?
  // opts: { required (default true), maxLength, emptyError }. Returns { ok, text, error }.
  function askInputState(raw, opts) {
    const o = opts || {};
    let text = String(raw == null ? '' : raw).trim();
    if (o.maxLength > 0) text = text.slice(0, o.maxLength);
    if (o.required !== false && !text) return { ok: false, text, error: o.emptyError || 'Type something first.' };
    return { ok: true, text, error: '' };
  }

  // Keys are not remembered by default (spec 2.6, D1). A saved choice wins. With no saved choice, a judge who
  // already has stored keys keeps them (they came from the old default), so no current user loses a key.
  function resolveRememberKeys(saved, hasStoredKeys) {
    if (typeof saved === 'boolean') return saved;
    return Boolean(hasStoredKeys);
  }
  // Restoring a backup that holds keys (spec 2.6, Q-3). entries: the backup's storage { name: raw string }.
  // Returns { local, session }. With Remember off, the keys go to this tab only (session), never to localStorage.
  // The restored settings take this browser's Remember choice, so the next load keeps the keys where they are.
  function splitRestoreKeys(entries, remember, settingsEntry) {
    const local = Object.assign({}, entries || {});
    const session = {};
    const names = [KEYS_ENTRY, ...OLD_KEY_ENTRIES].filter((k) => k in local);
    if (!names.length) return { local, session };
    if (settingsEntry && local[settingsEntry]) {
      try { const s = JSON.parse(local[settingsEntry]) || {}; s.rememberKeys = Boolean(remember); local[settingsEntry] = JSON.stringify(s); } catch {}
    }
    if (!remember) for (const k of names) { session[k] = local[k]; delete local[k]; }
    return { local, session };
  }
  // The keys line in the restore dialog.
  function restoreKeysLine(included, remember) {
    if (!included) return 'API keys: not included. Your current keys stay.';
    return remember ? 'API keys: included.' : 'API keys: included. Kept for this visit only, because Remember is off.';
  }

  // Restore, step 2 (spec 2.6, Q-3): the key entries this tab holds after a restore. All old tab key entries are
  // removed first, then these are written. A backup with keys replaces the tab's keys, so a provider that is not in
  // the backup is not left connected. A backup without keys keeps the tab's own keys ("Your current keys stay").
  function restoreTabKeys(oldTab, session, backupHasKeys) {
    return backupHasKeys ? Object.assign({}, session || {}) : Object.assign({}, oldTab || {}, session || {});
  }

  // Undo for a deleted sheet (spec 2.4). undo = { roundId, index, item } from the delete. The sheet comes back only
  // into the round it was deleted from; returns { flows, flowIdx }, or null when the round changed in the meantime.
  function undoSheetDelete(round, undo) {
    if (!round || !undo || !undo.item || !undo.roundId || round.id !== undo.roundId) return null;
    const flows = restoreAt(round.flows, undo.index, undo.item);
    return { flows, flowIdx: flows.indexOf(undo.item) };
  }

  // No paid AI call runs by itself (spec 2.7, D2). Only an explicit true turns these on.
  function autoEvalDefault(saved) { return saved === true; }
  function liveFlowDefault(saved) { return saved === true; }
  // Q-2: the old defaults turned both on without a choice, so they are turned off once for everyone.
  // Returns the settings fields to change, or null when this already ran.
  function d2Reset(settings) {
    const s = settings || {};
    if (s.d2Reset) return null;
    return { autoEval: false, liveFlow: false, d2Reset: true };
  }
  // The one-time note about Live Eval and Live AI flow: the first time AI is ready, never while a clock runs.
  function needsD2Note(o) {
    const s = o || {};
    return Boolean(s.aiReady) && !s.shown && !s.clockRunning;
  }

  // ---------- Slice 0: shared UI rules (spec 4.2, 4.3, S0.4). ui.js does the DOM; these decide. ----------
  // The Esc stack: the index of the open layer with the highest rank, or -1. layers: [{ rank, open }].
  // On a tie the layer added first wins. Esc closes only that one layer.
  function escTop(layers) {
    let top = -1;
    (layers || []).forEach((l, i) => { if (l && l.open && (top < 0 || l.rank > layers[top].rank)) top = i; });
    return top;
  }
  // What a new toast does to the list. list: [{ key, msg, action }] oldest first; t: { key, msg, action }.
  // Returns { reuse: index or -1, close: [indexes to close, in order] }.
  // Rules (spec 4.3): the same key or text restarts that toast; only one toast with an action (Undo) at a time;
  // at most 3 toasts, so the oldest goes first.
  const TOAST_MAX = 3;
  function toastPlan(list, t) {
    const l = list || [];
    const reuse = l.findIndex((x) => (t.key && x.key === t.key) || x.msg === t.msg);
    if (reuse >= 0) return { reuse, close: [] };
    const close = [];
    if (t.action) l.forEach((x, i) => { if (x.action) close.push(i); });
    let left = l.length - close.length;
    for (let i = 0; i < l.length && left >= TOAST_MAX; i++) if (!close.includes(i)) { close.push(i); left--; }
    return { reuse: -1, close: close.sort((a, b) => a - b) };
  }
  // The dialog button that gets focus first. buttons: [{ value, kind }]; opts: { focus, hasFocus, cancelValue }.
  // An asked-for button wins; else the safe (cancel) button in a dialog with a danger button; else the primary one; else the first.
  function askFirstFocus(buttons, opts) {
    const b = buttons || [], o = opts || {};
    const idx = (pred) => b.findIndex(pred);
    let i = o.hasFocus ? idx((x) => x.value === o.focus) : -1;
    if (i < 0 && b.some((x) => x.kind === 'danger')) i = idx((x) => x.value === o.cancelValue);
    if (i < 0) i = idx((x) => x.kind === 'primary');
    return i < 0 ? 0 : i;
  }
  // The focus trap: the button Tab (or Shift+Tab) goes to. Focus outside the list goes to the first (or last).
  function trapNext(i, n, back) {
    if (!(n > 0)) return -1;
    if (i < 0) return back ? n - 1 : 0;
    return (i + (back ? -1 : 1) + n) % n;
  }

  // ---------- Slice 3: visual system and Flow look ----------
  // V9 (Q8) How the Insights pane shows. No AI wins over the judge's own hide choice: a pane with nothing in it
  // folds to a thin edge with one "Connect AI" link. 'edge-connect' | 'edge-show' (the judge hid it) | 'open'.
  function insightsMode(o) {
    const x = o || {};
    if (!x.aiReady) return 'edge-connect';
    return x.hideRight ? 'edge-show' : 'open';
  }
  // V10 (Q3) The theme to draw: the judge's setting ('system' | 'light' | 'dark'), else the device setting.
  // assets/theme-boot.js has the same rule (it runs before this file loads); a test keeps the two equal.
  function resolveTheme(setting, prefersDark) {
    if (setting === 'light' || setting === 'dark') return setting;
    return prefersDark ? 'dark' : 'light';
  }
  // V11 (spec 4.4) How long the pointer rests before a tip shows: 1 s on sheet tabs (they are passed over all
  // the time while flowing), 0.5 s for every other label tip and help bubble.
  const TIP_DELAY_MS = 500, SHEET_TIP_DELAY_MS = 1000;
  function tipDelay(kind) { return kind === 'sheet' ? SHEET_TIP_DELAY_MS : TIP_DELAY_MS; }
  // V11 (spec 4.4) Where a tip goes: centred below its target; flipped above when it would cross the top of the
  // round bar (view.bottomInset = --rb-h); always 8 px inside the viewport. target: a rect; tip: { w, h }.
  function tipPlace(target, tip, view) {
    const m = 8, gap = 6;
    const bottom = view.h - (view.bottomInset || 0);
    let top = target.top + target.height + gap, side = 'below';
    if (top + tip.h > bottom - m) {
      const above = target.top - gap - tip.h;
      if (above >= m) { top = above; side = 'above'; } else top = Math.max(m, bottom - m - tip.h);
    }
    const left = Math.max(m, Math.min(target.left + target.width / 2 - tip.w / 2, view.w - tip.w - m));
    return { top, left, side };
  }
  // V11 (spec 4.4) aria-describedby points at a tip only when the tip adds words to the control's name. A tip that
  // only repeats the name would make a screen reader say it twice. Case, spacing and end punctuation do not count.
  function tipAddsWords(name, tip) {
    const norm = (x) => String(x == null ? '' : x).toLowerCase().replace(/\s+/g, ' ').replace(/[\s.:;,!?\u2026]+$/, '').trim();
    const n = norm(name), t = norm(tip);
    if (!t) return false;
    return !n.includes(t);
  }
  // V11 (spec 4.4) Touch long press. One step of the press state: { timer, eat } in, the next state out.
  // ev: 'down' (a new touch starts), 'fire' (the 500 ms timer showed the tip), 'move' (the finger moved), 'up',
  // 'cancel' (pointercancel or contextmenu), 'click' (out: eatNow says whether to cancel this click).
  // Only the one click that ends the long press is eaten. A new touch always starts clean, so a lost click
  // (Android gives contextmenu and no click) can never cancel the next real tap, for example on Start.
  function pressStep(state, ev) {
    const st = { timer: Boolean(state && state.timer), eat: Boolean(state && state.eat) };
    if (ev === 'down') return { timer: true, eat: false, eatNow: false };
    if (ev === 'fire') return st.timer ? { timer: false, eat: true, eatNow: false } : { ...st, eatNow: false };
    if (ev === 'move' || ev === 'up') return { timer: false, eat: st.eat, eatNow: false };
    if (ev === 'cancel') return { timer: false, eat: false, eatNow: false };
    if (ev === 'click') return { timer: false, eat: false, eatNow: st.eat };
    return { ...st, eatNow: false };
  }
  // V11 (spec 4.4) A tip shows at once on keyboard focus, but not when the code moved focus back after Esc
  // (closing a pane returns focus to its button). The tip would cover what Esc just uncovered.
  const ESC_FOCUS_QUIET_MS = 300;
  function tipOnFocus(focusVisible, msSinceEsc) {
    return Boolean(focusVisible) && !(msSinceEsc >= 0 && msSinceEsc < ESC_FOCUS_QUIET_MS);
  }
  // V7 Which flow columns get the "Now" and "Viewing" marks. runId: the speech the clock times (or null);
  // curId: the speech on screen. CX speeches have no column. Returns column indexes or null:
  // current = the column with the bar and outline (the running speech, else the one on screen),
  // now = the running column (only while a clock runs), viewing = a different column the judge looks at.
  function flowMarks(runId, curId) {
    const runCol = runId ? speechColumn(runId) : null;
    const curCol = curId ? speechColumn(curId) : null;
    const current = runId ? runCol : curCol;
    const viewing = runId && curCol != null && curCol !== runCol ? curCol : null;
    return { current: current == null ? null : current, now: runId && runCol != null ? runCol : null, viewing };
  }

  // ---------- Slice 4: Decide and ballot (docs/design/SPEC.md §3.4) ----------
  // 4.7 (Q10) The speaker points range is a Round setup setting. 25–30 when nothing is set.
  const DEFAULT_PTS_RANGE = { min: 25, max: 30 };
  function ptsRange(r) {
    const min = Number(r && r.min), max = Number(r && r.max);
    if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max > 100 || min >= max) return { ...DEFAULT_PTS_RANGE };
    return { min, max };
  }
  // The error for a range the judge typed, or '' when it is fine.
  function rangeError(min, max) {
    const ok = (v) => v !== '' && v != null && Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 100;
    if (!ok(min) || !ok(max)) return 'Use a number from 0 to 100.';
    if (Number(min) >= Number(max)) return 'The lowest score must be less than the highest.';
    return '';
  }
  const isDefaultRange = (r) => r.min === DEFAULT_PTS_RANGE.min && r.max === DEFAULT_PTS_RANGE.max;

  // 4.2 Field groups. Fields are the BALLOT_FIELDS paths. The picker in the draft panel has five groups; the tags on
  // the ballot have one per speaker row (points and rank together).
  const PTS_FIELDS = SPEAKERS.flatMap((s) => ['pts.' + s, 'ranks.' + s]);
  const DRAFT_GROUPS = [
    { id: 'winner', label: 'Winner', fields: ['winner'] },
    { id: 'pts', label: 'Points and ranks', fields: PTS_FIELDS },
    { id: 'rfd', label: 'Reason for decision', fields: ['rfd'] },
    { id: 'affFb', label: 'Aff comments', fields: ['affFb'] },
    { id: 'negFb', label: 'Neg comments', fields: ['negFb'] },
  ];
  const FIELD_LABELS = { winner: 'the winner', rfd: 'the reason for decision', affFb: 'the Aff comments', negFb: 'the Neg comments' };
  function fieldLabel(f) {
    if (FIELD_LABELS[f]) return FIELD_LABELS[f];
    const [a, s] = String(f).split('.');
    if (a === 'row') return s + ' points and rank';
    return s + (a === 'pts' ? ' points' : ' rank');
  }
  function fieldValue(ballot, f) {
    const b = ballot || {};
    const [a, k] = String(f).split('.');
    return k ? (b[a] || {})[k] : b[a];
  }
  const isEmptyValue = (v) => v == null || String(v).trim() === '';
  // One state per field: 'yours' (the judge typed it; the AI will not change it), 'empty', or 'ai' (an AI draft, or
  // a value the AI may change). For a list of fields: yours if any is yours, else ai if any has a value, else empty.
  function fieldState(ballot, fields) {
    const b = ballot || {};
    const list = [].concat(fields);
    const one = (f) => ((b.touched || {})[f] ? 'yours' : isEmptyValue(fieldValue(b, f)) ? 'empty' : 'ai');
    const states = list.map(one);
    if (states.includes('yours')) return 'yours';
    return states.includes('ai') ? 'ai' : 'empty';
  }
  // Moves fields between the two sets. kind: 'yours' (an edit or an insert), 'ai' (an auto refill), 'free' (unlock).
  // Returns a new ballot; the old one is not changed.
  function markFields(ballot, fields, kind) {
    const b = ballotSnapshot(ballot);
    b.touched = Object.assign({}, b.touched); b.aiFilled = Object.assign({}, b.aiFilled);
    for (const f of [].concat(fields)) {
      if (kind === 'yours') { b.touched[f] = true; delete b.aiFilled[f]; }
      else if (kind === 'ai') { b.aiFilled[f] = true; delete b.touched[f]; }
      else delete b.touched[f];
    }
    return b;
  }
  // A deep copy of the ballot for Undo; later edits never reach the copy.
  function ballotSnapshot(ballot) { return JSON.parse(JSON.stringify(ballot || {})); }

  // 4.3 Is there anything to draft from? At least one speech, flow note or doc.
  function roundHasContent(round, docs) {
    const r = round || {};
    if ((docs || []).length) return true;
    if (Object.values(r.transcripts || {}).some((t) => String(t || '').trim())) return true;
    if ((r.flows || []).some((f) => Object.values(f.cells || {}).some((c) => String(c || '').trim()))) return true;
    return (r.aiFlows || []).some((sh) => Object.keys(sh.parts || {}).length > 0);
  }
  // Which state the draft panel shows (4.3 table). busy wins, then the reasons Draft cannot run.
  function draftPanelState(o) {
    const x = o || {};
    if (x.busy) return 'loading';
    if (!x.aiReady) return 'noAI';
    if (x.offline) return 'offline';
    if (!x.hasContent) return 'empty';
    if (!x.picked) return 'nothing';
    if (x.error) return 'error';
    if (x.stopped) return 'stopped';
    return 'ready';
  }
  // Feedback from the Live Eval, as prompt lines for the comments (4.3, 4.13).
  function feedbackLines(feedback) {
    return (feedback || []).filter((f) => f && f.speaker && !/^not yet/i.test(f.points || ''))
      .map((f) => f.speaker + ': ' + (f.so_far || '') + ' Did well: ' + (f.strength || '') + ' To work on: ' + (f.fix || ''));
  }
  // AI points outside the range: these are never inserted (4.4).
  function outOfRangePoints(draft, range) {
    const r = ptsRange(range);
    const pts = (draft && draft.points) || {};
    return SPEAKERS.filter((s) => typeof pts[s] === 'number' && (pts[s] < r.min || pts[s] > r.max)).map((s) => ({ speaker: s, value: Math.round(pts[s] * 10) / 10 }));
  }
  // The value the AI draft has for one field, in ballot form (points to one decimal, ranks as text).
  function draftValue(draft, f) {
    const d = draft || {};
    const [a, k] = String(f).split('.');
    if (a === 'pts') { const n = (d.points || {})[k]; return typeof n === 'number' && isFinite(n) ? Math.round(n * 10) / 10 : undefined; }
    if (a === 'ranks') { const n = (d.ranks || {})[k]; return n != null ? String(n) : undefined; }
    return { winner: d.winner, rfd: d.rfd, affFb: d.aff_comments, negFb: d.neg_comments }[a];
  }
  // 4.4 A word diff for a "Yours" card: same / del / ins runs. Whitespace stays with its word.
  function wordDiff(a, b) {
    const ta = String(a || '').match(/\S+\s*|\s+/g) || [], tb = String(b || '').match(/\S+\s*|\s+/g) || [];
    const n = ta.length, m = tb.length;
    const norm = (t) => t.trim();
    const out = [];
    const push = (op, text) => { const last = out[out.length - 1]; if (last && last.op === op) last.text += text; else out.push({ op, text }); };
    // Very long texts: no word-by-word diff (it would be slow); show the old text removed and the new one added.
    if (n * m > 4000000) { if (n) push('del', ta.join('')); if (m) push('ins', tb.join('')); return out; }
    const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = norm(ta[i]) === norm(tb[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (norm(ta[i]) === norm(tb[j])) { push('same', tb[j]); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) push('del', ta[i++]);
      else push('ins', tb[j++]);
    }
    while (i < n) push('del', ta[i++]);
    while (j < m) push('ins', tb[j++]);
    return out;
  }

  // 4.4 The review: one card per picked group. A "yours" card starts on "Keep mine"; others start on "Insert this".
  // Each card remembers the ballot values it was made against (base), so an edit during the review shows.
  function reviewCard(ballot, draft, group, range) {
    const state = fieldState(ballot, group.fields);
    const base = Object.fromEntries(group.fields.map((f) => [f, fieldValue(ballot, f) ?? '']));
    const after = Object.fromEntries(group.fields.map((f) => [f, draftValue(draft, f) ?? '']));
    // A card with no AI text has nothing to insert, so it does not start ticked ("empty": the panel shows no choice).
    const empty = group.fields.every((f) => isEmptyValue(after[f]));
    const card = { id: group.id, label: group.label, fields: group.fields.slice(), state, base, after, choice: state === 'yours' || empty ? 'keep' : 'insert', changed: false, empty };
    if (group.id === 'pts') card.outOfRange = outOfRangePoints(draft, range);
    if (['rfd', 'affFb', 'negFb'].includes(group.id) && state === 'yours') card.diff = wordDiff(base[group.id], after[group.id]);
    return card;
  }
  function reviewFromDraft(ballot, draft, opts) {
    const o = opts || {};
    const picks = o.picks || DRAFT_GROUPS.map((g) => g.id);
    const range = ptsRange(o.range);
    const cards = DRAFT_GROUPS.filter((g) => picks.includes(g.id)).map((g) => reviewCard(ballot, draft, g, range));
    return { at: o.at || 0, through: (o.through || []).slice(), range, picks: picks.slice(), draft, cards };
  }
  // A field the judge changed while the review waits: the card says "Changed since the draft", gets a fresh diff
  // against the new text, and goes back to "Keep mine" (the judge's newer text wins until they choose).
  function staleReviewCards(review, ballot) {
    if (!review) return review;
    const cards = review.cards.map((c) => {
      const now = Object.fromEntries(c.fields.map((f) => [f, fieldValue(ballot, f) ?? '']));
      const moved = c.fields.some((f) => String(now[f]) !== String(c.base[f]));
      if (!moved) return c;
      const n = Object.assign({}, c, { base: now, changed: true, state: 'yours', choice: 'keep' });
      if (['rfd', 'affFb', 'negFb'].includes(c.id)) n.diff = wordDiff(now[c.id], c.after[c.id]);
      return n;
    });
    return Object.assign({}, review, { cards });
  }
  // Does an insert take this card? all = "Accept all": every card that is not on "Keep mine".
  const reviewTakes = (c, all) => c.choice !== 'keep' && (all || c.choice !== 'skip');
  // The fields an insert writes.
  function reviewInsertFields(review, all) {
    return ((review && review.cards) || []).filter((c) => reviewTakes(c, all)).flatMap((c) => c.fields);
  }
  // 4.4 Insert from the review: the chosen cards' AI text goes into the ballot and becomes "yours". AI points outside
  // the range are skipped. all = "Accept all" (never flips "Keep mine"). Returns { ballot, fields, count } (count = cards).
  // "Review never overwrites Yours" is checked here too, not only by staleReviewCards: a field whose text changed
  // since the card was made, or that became "yours" after a card that was not, is skipped. Only a card that was
  // already "yours" and that the judge set to "Use AI text" may replace the judge's text.
  function applyReview(ballot, review, all) {
    let b = ballotSnapshot(ballot);
    b.pts ??= {}; b.ranks ??= {};
    const fields = [];
    let count = 0;
    for (const c of (review && review.cards) || []) {
      if (!reviewTakes(c, all)) continue;
      const bad = new Set((c.outOfRange || []).map((x) => 'pts.' + x.speaker));
      let wrote = false;
      for (const f of c.fields) {
        const v = c.after[f];
        if (bad.has(f) || isEmptyValue(v)) continue;
        if (String(fieldValue(ballot, f) ?? '') !== String((c.base || {})[f] ?? '')) continue; // changed since the card
        if (c.state !== 'yours' && fieldState(ballot, f) === 'yours') continue; // became "yours" after the card
        const [a, k] = f.split('.');
        if (k) b[a][k] = v; else b[a] = v;
        fields.push(f); wrote = true;
      }
      if (wrote) count++;
    }
    b = markFields(b, fields, 'yours');
    return { ballot: b, fields, count };
  }
  // 4.6 Auto refill: empty fields are written at once (as AI text); an AI field with a value the draft would change
  // goes to review; a "yours" field is never touched. Returns { write: [fields], review: [group ids] }.
  function autoRefillPlan(ballot, draft, range) {
    const bad = new Set(outOfRangePoints(draft, range).map((x) => 'pts.' + x.speaker));
    const write = BALLOT_FIELDS.filter((f) => fieldState(ballot, f) === 'empty' && !bad.has(f) && !isEmptyValue(draftValue(draft, f)));
    const review = DRAFT_GROUPS.filter((g) => g.fields.some((f) => fieldState(ballot, f) === 'ai' && !isEmptyValue(draftValue(draft, f)) && String(draftValue(draft, f)) !== String(fieldValue(ballot, f)))).map((g) => g.id);
    return { write, review };
  }
  // Did a speech end after this draft? (the review then offers [Redo all]).
  function speechEndedSince(review, round) {
    if (!review) return false;
    const now = speechesSoFar(round);
    return now.some((id) => !(review.through || []).includes(id));
  }

  const ranksSet = (ballot) => SPEAKERS.filter((s) => !isEmptyValue(((ballot || {}).ranks || {})[s])).length;

  // 4.8 Picking a rank another speaker has moves it: that speaker loses it. Returns the new ranks and the message.
  function moveRank(ranks, speaker, rank) {
    const out = Object.assign({}, ranks || {});
    const r = rank == null || rank === '' ? '' : String(rank);
    let moved = null;
    if (r) for (const s of SPEAKERS) if (s !== speaker && String(out[s] ?? '') === r) { out[s] = ''; moved = { rank: r, from: s, to: speaker }; }
    out[speaker] = r;
    return { ranks: out, moved, message: moved ? 'Rank ' + moved.rank + ' moved from ' + moved.from + ' to ' + moved.to + '.' : '' };
  }
  // 4.8 The − and + buttons: steps of 0.1 inside the range. An empty box starts near the top of the range.
  function stepPoints(value, dir, range) {
    const r = ptsRange(range);
    const v = num(value);
    if (Number.isNaN(v)) return Math.round(r.min + (r.max - r.min) * 0.6);
    const next = Math.round((v + (dir < 0 ? -0.1 : 0.1)) * 10) / 10;
    return Math.min(r.max, Math.max(r.min, next));
  }

  // 4.12 A saved ballot: the spreadsheet row, plus one object at the end with what the row has no column for
  // (the range and the comments). Old saved ballots have no object: they show with no range check.
  function savedBallotEntry(round, savedAt, range) {
    const b = round.ballot || {};
    return ballotRow(round, savedAt).concat([{ ptsRange: ptsRange(range), affFb: b.affFb || '', negFb: b.negFb || '' }]);
  }
  const savedBallotRow = (entry) => (entry || []).slice(0, BALLOT_HEADER.length);
  function savedBallotView(entry) {
    const e = entry || [];
    const meta = e.length > BALLOT_HEADER.length && e[BALLOT_HEADER.length] && typeof e[BALLOT_HEADER.length] === 'object' ? e[BALLOT_HEADER.length] : null;
    const col = (name) => e[BALLOT_HEADER.indexOf(name)] ?? '';
    const pts = {}, ranks = {};
    for (const s of SPEAKERS) { pts[s] = col(s + ' pts'); ranks[s] = col(s + ' rank'); }
    return {
      savedAt: col('Saved at'),
      round: { tournament: col('Tournament'), roundName: col('Round'), judge: col('Judge'), topic: col('Topic'),
        aff: { team: col('Aff team'), d1: col('1A'), d2: col('2A') }, neg: { team: col('Neg team'), d1: col('1N'), d2: col('2N') },
        ballot: { winner: String(col('Winner')).toLowerCase(), pts, ranks, rfd: col('RFD'), affFb: meta ? meta.affFb : '', negFb: meta ? meta.negFb : '' } },
      ptsRange: meta ? ptsRange(meta.ptsRange) : null,
    };
  }

  // 4.11 The four blocks a judge pastes into the tournament's ballot site.
  const speakerName = (round, s) => (({ '1A': (round.aff || {}).d1, '2A': (round.aff || {}).d2, '1N': (round.neg || {}).d1, '2N': (round.neg || {}).d2 })[s]) || '';
  function decisionText(round) {
    const b = round.ballot || {};
    const lines = [];
    if (b.winner === 'aff' || b.winner === 'neg') {
      const team = b.winner === 'aff' ? (round.aff || {}).team : (round.neg || {}).team;
      lines.push((b.winner === 'aff' ? 'Aff' : 'Neg') + (team ? ' (' + team + ')' : '') + ' wins.');
    }
    for (const s of SPEAKERS) {
      const p = (b.pts || {})[s], r = (b.ranks || {})[s];
      if (isEmptyValue(p) && isEmptyValue(r)) continue;
      const nm = speakerName(round, s);
      lines.push(s + (nm ? ' ' + nm : '') + ': ' + (isEmptyValue(p) ? 'no points' : p + ' points') + (isEmptyValue(r) ? '' : ', rank ' + r));
    }
    return lines.join('\n');
  }
  function tournamentBlocks(round) {
    const b = (round && round.ballot) || {};
    return [
      { id: 'decision', label: 'Decision', text: decisionText(round || {}) },
      { id: 'rfd', label: 'Reason for decision', text: String(b.rfd || '').trim() },
      { id: 'affFb', label: 'Aff comments', text: String(b.affFb || '').trim() },
      { id: 'negFb', label: 'Neg comments', text: String(b.negFb || '').trim() },
    ];
  }

  // 4.10 What the print sheet holds. Long text prints in full (the sheet is built from data, not the boxes on screen).
  // opts: { flow, transcripts, aiNotes, range (null = no range), liveEval, analysis }.
  function printModel(round, opts) {
    const o = opts || {};
    const r = round || {};
    const b = r.ballot || {};
    const range = o.range === null ? null : ptsRange(o.range);
    const title = ['Ballot', r.roundName].filter(Boolean).join(' · ');
    const sections = [];
    sections.push({ kind: 'facts', items: [['Tournament', r.tournament || ''], ['Round', r.roundName || ''], ['Judge', r.judge || ''], ['Resolution', r.topic || '']].filter(([, v]) => v) });
    const team = b.winner === 'aff' ? (r.aff || {}).team : b.winner === 'neg' ? (r.neg || {}).team : '';
    sections.push({ kind: 'winner', title: 'Decision', text: b.winner === 'aff' || b.winner === 'neg' ? (b.winner === 'aff' ? 'Aff' : 'Neg') + (team ? ' (' + team + ')' : '') + ' wins' : 'No winner picked' });
    sections.push({ kind: 'speakers', title: range ? 'Points (' + range.min + '–' + range.max + ') and ranks' : 'Points and ranks',
      rows: SPEAKERS.map((s) => ({ speaker: s, side: s.endsWith('A') ? 'aff' : 'neg', name: speakerName(r, s), pts: (b.pts || {})[s] ?? '', rank: (b.ranks || {})[s] ?? '' })) });
    sections.push({ kind: 'text', title: 'Reason for decision', text: String(b.rfd || '') });
    sections.push({ kind: 'text', title: 'Aff comments' + ((r.aff || {}).team ? ' (' + r.aff.team + ')' : ''), side: 'aff', text: String(b.affFb || '') });
    sections.push({ kind: 'text', title: 'Neg comments' + ((r.neg || {}).team ? ' (' + r.neg.team + ')' : ''), side: 'neg', text: String(b.negFb || '') });
    if (o.flow) {
      for (const f of r.flows || []) {
        const cols = FLOW_COLUMNS.map((c, i) => ({ label: c.label, side: c.side, text: String((f.cells || {})[i] || '') }));
        if (cols.some((c) => c.text.trim())) sections.push({ kind: 'flow', title: 'Flow: ' + f.name, cols });
      }
    }
    if (o.transcripts) {
      for (const s of SPEECHES) {
        const t = String((r.transcripts || {})[s.id] || '').trim();
        if (t) sections.push({ kind: 'text', title: 'Transcript: ' + s.label, side: s.side, text: t });
      }
    }
    if (o.aiNotes) {
      const ev = o.liveEval;
      if (ev && ev.summary) sections.push({ kind: 'text', title: 'AI notes: Live Eval', text: ev.summary + (ev.leaning && ev.leaning.why ? '\n\n' + ev.leaning.why : '') });
      for (const [name, text] of o.analysis || []) if (text) sections.push({ kind: 'text', title: 'AI notes: ' + name, text });
    }
    return { title, orientation: o.flow ? 'landscape' : (o.orientation === 'landscape' ? 'landscape' : 'portrait'), sections };
  }

  // 4.14 Prep used by each team, from the round's prep fields.
  function prepUsed(round) {
    const r = round || {};
    const total = Math.max(0, Math.round(Number(r.prepSeconds) || 0));
    const out = {};
    for (const side of ['aff', 'neg']) {
      const left = Number((r.prepLeft || {})[side]);
      const used = Number.isFinite(left) ? Math.max(0, Math.min(total, Math.round(total - left))) : 0;
      out[side] = { used, total, text: (side === 'aff' ? 'Aff' : 'Neg') + ' used ' + formatClock(used) + ' of ' + formatClock(total) };
    }
    out.any = out.aff.used > 0 || out.neg.used > 0;
    return out;
  }
  // 4.14 Key moments from the Round Map: only dropped and conceded arguments, in speech order.
  function keyMoments(map) {
    const nodes = ((map && map.nodes) || []).filter((n) => n && (n.status === 'dropped' || n.status === 'conceded'));
    const at = (s) => { const i = MAP_SPEECHES.indexOf(s); return i < 0 ? 99 : i; };
    return nodes.slice().sort((a, b) => at(a.speech) - at(b.speech))
      .map((n) => ({ speech: n.speech, label: n.label, status: n.status, side: speechSide(n.speech), text: n.speech + ': ' + n.label + ' (' + n.status + ')' }));
  }
  // 4.13 The paired summary bar under the key issues.
  function issueTally(issues) {
    const t = { aff: 0, even: 0, neg: 0 };
    for (const k of issues || []) if (k && t[k.ahead] != null) t[k.ahead]++;
    t.text = 'Aff ahead on ' + t.aff + ' · Even ' + t.even + ' · Neg ahead on ' + t.neg;
    return t;
  }
  // "1AR", "1AR and 2NR", "1AC, 1NC and 2AC".
  function andList(items) {
    const x = (items || []).filter(Boolean);
    return x.length < 2 ? (x[0] || '') : x.slice(0, -1).join(', ') + ' and ' + x[x.length - 1];
  }
  // 4.13 "Out of date: 1AR and 2NR happened since." or '' when nothing is newer.
  function outOfDateText(through, round) {
    const newer = speechesSoFar(round).filter((id) => !(through || []).includes(id));
    return newer.length ? 'Out of date: ' + andList(newer) + ' happened since.' : '';
  }
  // 4.13 / 4.14 The verb pair: Run when nothing is saved, Update when something is.
  const runVerb = (hasSaved) => (hasSaved ? 'Update' : 'Run');
  // 4.9 (Q15) Which reading level applies: this round's choice, else the device default.
  function readingFor(roundReading, deviceReading) {
    const ok = (v) => v === 'expert' || v === 'plain';
    return ok(roundReading) ? roundReading : ok(deviceReading) ? deviceReading : 'expert';
  }
  // 4.0 A saved Decide tab from before Slice 4: 'draft' opens the Ballot.
  const decideTab = (tab) => (tab === 'draft' ? 'ballot' : tab);

  // Option B (Q-8): flow mark shading. The flow stays plain text; app.js paints a mirror layer behind each flow
  // textarea, and these marks get a light shade there. Tokens come from docs/library/flow-shorthand.md and the
  // Round Map statuses (dropped, conceded, extended). A mark is a whole token: "ext" shades, "text" does not.
  // Words match in any case; the short capital codes (DT, TC, CT) match only in capitals, so "ct" in a note does not.
  const FLOW_MARK_KINDS = [
    { kind: 'drop', label: 'Dropped', tokens: ['*', '*dropped', 'dropped', 'drop', 'drops', 'no answer', 'no ans'] },
    { kind: 'concede', label: 'Conceded', tokens: ['conceded', 'concedes', 'concede', 'conc'] },
    { kind: 'extend', label: 'Extended', tokens: ['extended', 'extends', 'extend', 'ext'] },
    { kind: 'turn', label: 'Turned', tokens: ['turned', 'turns', 'turn', 'L/T', 'I/T', 'DT', 'TC', 'CT'] },
    { kind: 'weigh', label: 'Outweighs', tokens: ['O/W', 'outweighs'] },
  ];
  const FM_CAPS = new Set(['DT', 'TC', 'CT']);
  const FM_KIND = {};
  FLOW_MARK_KINDS.forEach((k) => k.tokens.forEach((t) => { if (t[0] !== '*') FM_KIND[t.toLowerCase()] = k.kind; }));
  const fmEsc = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  const FM_WORDS = Object.keys(FM_KIND).sort((a, b) => b.length - a.length).map((t) => fmEsc(t).replace(/ /g, '[ \\t]+'));
  // Left edge: not after a letter, digit, _, / or *. Right edge: not before a letter, digit, _ or /.
  // A star is a drop mark at the start of a token ("*IL", "* L"), with or without "dropped" after it.
  const FM_RE = new RegExp('(?<![\\p{L}\\p{N}_/*])(?:(\\*+(?:(?:dropped|drop)(?![\\p{L}\\p{N}_/]))?)|(?:' + FM_WORDS.join('|') + ')(?![\\p{L}\\p{N}_/]))', 'giu');
  // flowMarkTokens(text) -> [{ start, end, kind }], in order, never overlapping. Pure: it never changes the text.
  function flowMarkTokens(text) {
    const s = String(text == null ? '' : text), out = [];
    FM_RE.lastIndex = 0;
    let m;
    while ((m = FM_RE.exec(s))) {
      const t = m[0];
      const kind = m[1] ? 'drop' : FM_KIND[t.toLowerCase().replace(/[ \t]+/g, ' ')];
      if (!kind) continue;
      if (FM_CAPS.has(t.toUpperCase()) && t !== t.toUpperCase()) continue;
      out.push({ start: m.index, end: m.index + t.length, kind });
    }
    return out;
  }
  const fmHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // flowMarkHtml(text) -> the mirror's HTML for one line (or any text): the same characters, HTML-escaped, with
  // <span class="fm-KIND"> around marks. Marks never cross a line break, so each line can be painted on its own.
  function flowMarkHtml(text) {
    const s = String(text == null ? '' : text);
    let html = '', at = 0;
    for (const t of flowMarkTokens(s)) {
      html += fmHtml(s.slice(at, t.start)) + '<span class="fm-' + t.kind + '">' + fmHtml(s.slice(t.start, t.end)) + '</span>';
      at = t.end;
    }
    return html + fmHtml(s.slice(at));
  }
  // flowLinesChanged(oldLines, newLines) -> { from, oldTo, newTo }: lines [from, oldTo) of the old list became lines
  // [from, newTo) of the new one, and every line outside that range is the same. A keystroke in a long column then
  // repaints one line, not thousands.
  function flowLinesChanged(a, b) {
    let from = 0;
    const min = Math.min(a.length, b.length);
    while (from < min && a[from] === b[from]) from++;
    let ea = a.length, eb = b.length;
    while (ea > from && eb > from && a[ea - 1] === b[eb - 1]) { ea--; eb--; }
    return { from, oldTo: ea, newTo: eb };
  }

  const api = {
    SPEECHES, FLOW_COLUMNS, DEFAULT_FLOWS, sheetLabel, SHEET_PAGES, sheetPage, DEFAULT_PREP_SECONDS, SPEAKERS, PARADIGMS,
    BALLOT_HEADER, JUDGE_SYSTEM, POINTS_GUIDE,
    LOG_COLUMNS,
    formatClock, sheetSafe, csvCell, toCSV, toTSV, ballotRow, checkBallot, parseDecision, parseRfd, parseFeedback, buildJudgePrompt,
    TRANSCRIBE_HINT, buildTranscribePrompt, appendChunk, AUDIO_MODES, micConstraints, levelInfo, micTestVerdict, stallWarning, encodeWav, rms, mergeOverlap,
    PARADIGM_LABELS, paradigmText, hashText, lensKey,
    ANALYSIS_SYSTEM, MAP_SPEECHES, MAP_SCHEMA, MAP_TASK, IMPACT_SCHEMA, IMPACT_TASK, LENS_SCHEMA, LENS_TASK, buildAnalysisPrompt, buildMermaid, layoutMap,
    buildBackup, parseBackup, backupSummary,
    READING_LEVELS, readingGuide, BALLOT_SCHEMA, BALLOT_TASK, BALLOT_FIELDS, buildBallotPrompt, applyBallotDraft,
    speechesSoFar, nextSpeech, EVAL_SYSTEM, EVAL_SCHEMA, buildEvalPrompt,
    DOC_SIDES, DOC_NOTE, DOC_FLOW_NOTE, docSpeech, docsForSpeech, parseSpeechDropCode, speechDropFiles, guessSpeech, speechSide, anonymize, deanonymize, isRoundEmpty, buildRoundFile, parseRoundFile, roundFileName, docTitle, buildDocBlocks, buildUserContent,
    speechColumn, FLOW_LEVELS, partText, aiFlowCell, flowCellText, editIsBehind, mergeMap, applyLiveFlow, LIVE_FLOW_SCHEMA, LIVE_FLOW_SYSTEM, buildLiveFlowPrompt,
    // Slice 1: round safety
    OVER_LIMIT, restoreRun, restorePrep, restoreClocks, beepDecision, storageErrorKind, clockUnitIsNewer, shortSpeech, viewingLabel, toastMs, leftPaneMode, needsRecNotice, recStripState, beepedElsewhere,
    // Slice 2: copy and dialogs
    NO_AI, hasHostedPlan, shouldShowWelcome, classifyAIError, AI_ERROR_TEXT, aiErrorText, AI_ERROR_PREFIX, removeAt, restoreAt, askInputState,
    resolveRememberKeys, splitRestoreKeys, restoreKeysLine, restoreTabKeys, undoSheetDelete, autoEvalDefault, liveFlowDefault, d2Reset, needsD2Note,
    // Slice 0: shared UI rules
    escTop, toastPlan, TOAST_MAX, askFirstFocus, trapNext,
    // Slice 3: visual system and Flow look
    insightsMode, resolveTheme, TIP_DELAY_MS, SHEET_TIP_DELAY_MS, tipDelay, tipPlace, flowMarks, tipAddsWords, pressStep, ESC_FOCUS_QUIET_MS, tipOnFocus,
    // Slice 4: Decide and ballot
    DEFAULT_PTS_RANGE, ptsRange, rangeError, PTS_FIELDS, DRAFT_GROUPS, fieldLabel, fieldValue, fieldState, markFields, ballotSnapshot,
    roundHasContent, draftPanelState, feedbackLines, outOfRangePoints, draftValue, wordDiff, reviewFromDraft, staleReviewCards, reviewInsertFields, applyReview, autoRefillPlan,
    speechEndedSince, ranksSet, moveRank, stepPoints, savedBallotEntry, savedBallotRow, savedBallotView, decisionText, tournamentBlocks, printModel,
    prepUsed, keyMoments, issueTally, andList, outOfDateText, runVerb, readingFor, decideTab,
    // Slice 4, Option B (Q-8): flow mark shading
    FLOW_MARK_KINDS, flowMarkTokens, flowMarkHtml, flowLinesChanged,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PolicyLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
