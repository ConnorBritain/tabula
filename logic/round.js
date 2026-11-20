// The round itself: the speeches, flow columns and sheet names, paradigms, the clock format, CSV and TSV,
// the ballot row and its check, and the speaker points range.
// One part of logic.js (pure logic, no DOM). logic.js joins the parts into one API; index.html loads the parts first.
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

  const BALLOT_FIELDS = ['winner', 'pts.1A', 'pts.2A', 'pts.1N', 'pts.2N', 'ranks.1A', 'ranks.2A', 'ranks.1N', 'ranks.2N', 'rfd', 'affFb', 'negFb'];
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

  const MAP_SPEECHES = ['1AC', '1NC', '2AC', '2NC', '1NR', '1AR', '2NR', '2AR'];
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

  const api = { SPEECHES, FLOW_COLUMNS, DEFAULT_FLOWS, sheetLabel, SHEET_PAGES, sheetPage, DEFAULT_PREP_SECONDS,
    SPEAKERS, PARADIGMS, PARADIGM_LABELS, paradigmText, hashText, lensKey, formatClock, sheetSafe, csvCell, toCSV,
    toTSV, BALLOT_HEADER, ballotRow, num, checkBallot, parseDecision, parseRfd, LOG_COLUMNS, BALLOT_FIELDS,
    speechesSoFar, MAP_SPEECHES, DEFAULT_PTS_RANGE, ptsRange, rangeError, isDefaultRange };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.PolicyLogicParts = root.PolicyLogicParts || {}).round = api;
})(typeof window !== 'undefined' ? window : globalThis);
