// Debate formats as data (docs/architecture/ARCHITECTURE.md §9): the format files in formats/, which format a round
// uses, and the small facts every other part reads from a format (speech, column, speaker, prep clocks).
// The rest of the logic takes the format as an argument or reads it from the round it is given. Nothing here reads
// page state, so the code can later move to core/ as it is.
// One part of logic.js (pure logic, no DOM). logic.js joins the parts into one API; index.html loads the parts first,
// and the format files (formats/*.js) before this part.
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;

  // Every format version ever published, oldest first. A version is never removed: a saved round renders with the
  // version it was judged under. formats.test.js checks that each file here exists and that none is ever dropped.
  const FILES = ['policy-hs.v1', 'ld.v1', 'pf.v1'];
  const loaded = isNode ? FILES.map((f) => require('../formats/' + f + '.js')) : (root.TabulaFormats || []);

  // The shared registry (core/defs.js, an ES module): the page runs it before this file; Node requires it.
  const { createRegistry, defKey, deepFreeze } = isNode ? require('../core/defs.js') : root.TabulaCore.defs;

  // ---------- coin-flip order (order: 'coinFlip') ----------
  // In some formats (PF) a coin flip picks which side speaks first. Such a file names each speech's and flow column's
  // team ('first' or 'second') instead of its side, and a speech's debater by name box (slot) instead of by id.
  // The round stores the side that speaks first (round.firstSide: 'aff' or 'neg'); seat() fills in the side, the
  // debater and the "{side}" word in each label for that order. A file with no order field is "fixed": every speech
  // already names its side and debater, and seat() is never called for it.
  const SIDES = ['aff', 'neg'];
  const DEFAULT_FIRST_SIDE = 'aff';
  const isCoinFlip = (f) => Boolean(f) && f.order === 'coinFlip';
  // 'aff' or 'neg' from a round's stored value; anything else (a round saved before it was stored) is the default.
  const firstSideOf = (round) => (round && SIDES.includes(round.firstSide) ? round.firstSide : DEFAULT_FIRST_SIDE);
  function seat(f, firstSide) {
    const sideOfTeam = (team) => (team === 'first' ? firstSide : SIDES.find((x) => x !== firstSide));
    const word = (label, side) => String(label).split('{side}').join(f.sides[side].label);
    const speeches = f.speeches.map((s) => {
      if (!s.team) return s;
      const side = sideOfTeam(s.team);
      const sp = f.speakers.find((x) => x.side === side && x.slot === s.slot);
      return Object.assign({}, s, { side, speaker: sp.id, label: word(s.label, side) });
    });
    const flowColumns = f.flowColumns.map((c) => (c.team ? Object.assign({}, c, { side: sideOfTeam(c.team), label: word(c.label, sideOfTeam(c.team)) }) : c));
    return Object.assign({}, f, { speeches, flowColumns, firstSide });
  }

  // ---------- rows with more than one debater (crossfire) ----------
  // A crossfire row lists its debaters (speakers: two, or all four in a grand crossfire) instead of one speaker.
  // Its side comes from them: one side when all are on it, else 'both' (a row that belongs to neither side's colour).
  function rowSide(f, s) {
    if (!s.speakers) return s.side;
    const sides = new Set(s.speakers.map((id) => (f.speakers.find((x) => x.id === id) || {}).side));
    return sides.size === 1 ? [...sides][0] : 'both';
  }

  // A format file, ready to use, with the derived lists the code needs. The registry freezes it. The file itself
  // stays plain data. A coin-flip format is seated with the default first side; formatOf seats it for each round.
  function prepare(file, firstSide = DEFAULT_FIRST_SIDE) {
    const f = isCoinFlip(file) ? seat(file, firstSide) : file;
    const speeches = f.speeches.map((s) => Object.assign({}, s, s.speakers ? { side: rowSide(f, s) } : {}, { minutes: s.seconds / 60 }));
    return Object.assign({}, f, {
      key: defKey(f.id, f.version),
      speeches,
      // The speeches the flow and the Round Map use, in order (CX and crossfire are not flowed).
      flowSpeeches: speeches.filter((s) => s.column != null).map((s) => s.id),
      speakerIds: f.speakers.map((s) => s.id),
    }, isCoinFlip(file) ? { seatFile: file } : {});
  }

  // The formats a judge can pick for a new round, in the owner's order (policy today, then LD, then PF).
  const FORMAT_IDS = ['policy-hs', 'ld', 'pf'];
  const DEFAULT_FORMAT_ID = 'policy-hs';
  // A round saved before formats existed has no format: it was a policy round under the first policy file.
  const OLD_ROUND = { format: 'policy-hs', formatVersion: 1 };
  // Every format version, frozen. A round that names no known format falls back to OLD_ROUND's format.
  const REGISTRY = createRegistry(loaded, { prepare: (f) => prepare(f), fallback: { id: OLD_ROUND.format, version: OLD_ROUND.formatVersion } });

  // getFormat('ld') -> the newest LD; getFormat('ld', 1) -> LD version 1; null when unknown.
  const getFormat = (id, version) => REGISTRY.get(id, version);
  // The format a round was judged under. A round with no format is an old policy round (policy-hs v1).
  // roundKey fills in a round with no format (an old policy round); the registry fallback covers an unknown format.
  const roundKey = (r) => [r.format == null ? OLD_ROUND.format : r.format, r.formatVersion == null ? OLD_ROUND.formatVersion : r.formatVersion];
  const findFormat = (r) => getFormat(...roundKey(r));
  // Does this copy of the app have the round's format? false for a file from a newer Tabula. The page checks this
  // where a round comes in (a round file, the saved round), so formatOf never meets an unknown format there.
  const formatKnown = (round) => Boolean(findFormat(round || {}));
  // A coin-flip format seated for the other first side, made once per format version and kept (frozen like the rest).
  const seated = new Map();
  function seatedFor(fmt, firstSide) {
    if (firstSide === fmt.firstSide) return fmt;
    const k = fmt.key + ':' + firstSide;
    if (!seated.has(k)) seated.set(k, deepFreeze(prepare(fmt.seatFile, firstSide)));
    return seated.get(k);
  }
  // The round's format. An unknown one falls back to policy-hs v1, so a pure function never breaks on bad data.
  // A coin-flip format comes seated for the round's first side.
  function formatOf(round) {
    const fmt = REGISTRY.resolve(...roundKey(round || {}));
    return isCoinFlip(fmt) ? seatedFor(fmt, firstSideOf(round)) : fmt;
  }
  // The fields a round record stores for its format. A coin-flip round also stores which side speaks first.
  const formatFields = (fmt) => Object.assign({ format: fmt.id, formatVersion: fmt.version }, isCoinFlip(fmt) ? { firstSide: fmt.firstSide } : {});
  // A format id from the address (?format=ld). '' when there is none or it is not one a judge can pick.
  function formatFromSearch(search) {
    try { const id = new URLSearchParams(String(search || '')).get('format') || ''; return FORMAT_IDS.includes(id) ? id : ''; }
    catch { return ''; }
  }

  // ---------- facts read from a format ----------
  const speechOf = (fmt, id) => fmt.speeches.find((s) => s.id === id) || null;
  // Which flow column a speech writes to. CX is not flowed.
  function columnOf(fmt, id) { const s = speechOf(fmt, id); return s && s.column != null ? s.column : null; }
  const speakerOf = (fmt, id) => fmt.speakers.find((s) => s.id === id) || null;
  // The debaters a speech row has: its one speaker, or every debater of a crossfire row.
  const speechSpeakers = (fmt, s) => (s.speakers || [s.speaker]).map((id) => speakerOf(fmt, id)).filter(Boolean);
  // The word for a side on screen ('Aff', 'Pro'); a crossfire row's 'both' reads 'Both'.
  const sideLabel = (fmt, side) => (fmt.sides[side] ? fmt.sides[side].label : side === 'both' ? 'Both' : '');
  const speakersOn = (fmt, side) => fmt.speakers.filter((s) => s.side === side);
  // The word that stands in for a debater's name in AI text.
  const speakerTag = (sp) => sp.tag || sp.id;
  // The debater's name as typed in Round setup ('' when none).
  const speakerName = (round, sp) => String((((round || {})[sp.side]) || {})[sp.slot] || '');
  // The prep clocks: one per side (perTeam) or one per debater (perDebater). id keys round.prepLeft and
  // round.prepRun.side; side picks the colour and the clock on screen (each format so far has one clock per side).
  function prepClocks(fmt) {
    if (fmt.prep.mode === 'perDebater') return fmt.speakers.map((s) => ({ id: s.id, side: s.side, label: fmt.sides[s.side].label }));
    return ['aff', 'neg'].map((side) => ({ id: side, side, label: fmt.sides[side].label }));
  }
  // Full prep for every clock: { aff: 480, neg: 480 } or { Aff: 240, Neg: 240 }.
  const fullPrep = (fmt, seconds) => Object.fromEntries(prepClocks(fmt).map((c) => [c.id, seconds]));

  // ---------- example wording per format ----------
  // Hints and examples in shared places (the Resolution box, the ballot box, the reading level, the live flow) that
  // name things only one format has ("plan", "the 1A"). They are copy, not rules, so they live here and not in the
  // format files: a published format file never changes, and a new hint must not need a new format version.
  // Policy keeps the exact words judges and the AI had before formats. A format with no entry gets plain wording.
  const COPY = {
    'policy-hs': {
      topicHint: 'Resolved: The United States federal government should…',
      ballotExample: 'Example: I\'m voting aff on the perm. 2N was the best speaker. Be kind to the 1A.',
      argExample: 'e.g. No link — plan is cheap',
      flowBriefExamples: '"Perm do both", "No link — plan is cheap"',
      readingJudge: 'college policy judge',
      readingExample: 'the link, meaning why the plan causes the problem',
    },
    ld: {
      topicHint: 'Resolved: A just government ought to…',
      ballotExample: 'Example: I\'m voting neg on framework. The Neg was the better speaker. Be kind to the Aff.',
      argExample: 'e.g. Util fails — no link to the criterion',
      flowBriefExamples: '"Util outweighs", "No link to the criterion"',
      readingJudge: 'Lincoln-Douglas judge',
      readingExample: 'the criterion, meaning the test for which side better meets the value',
    },
    pf: {
      topicHint: 'Resolved: The United States should…',
      ballotExample: 'Example: I\'m voting Pro on the weighing. Pro 1 was the best speaker. Be kind to Con 2.',
      argExample: 'e.g. Delink — fares are a small share',
      flowBriefExamples: '"Turn: crowding = more riders", "No warrant"',
      readingJudge: 'Public Forum judge',
      readingExample: 'the weighing, meaning why one impact matters more than another',
    },
  };
  function formatCopy(fmt) {
    const own = COPY[fmt.id];
    if (own) return own;
    const first = fmt.speakers[0].label;
    return {
      topicHint: 'Resolved: …',
      ballotExample: 'Example: I\'m voting aff. ' + first + ' was the best speaker. Be kind to the ' + first + '.',
      argExample: 'e.g. No link',
      flowBriefExamples: '"No link", "Extend the impact"',
      readingJudge: fmt.ai.abbr + ' judge',
      readingExample: 'the burden, meaning what a side must prove to win',
    };
  }

  const api = { FORMAT_FILES: FILES, FORMAT_IDS, DEFAULT_FORMAT_ID, OLD_ROUND, getFormat, formatOf, formatKnown, formatFields,
    formatFromSearch, speechOf, columnOf, speakerOf, speechSpeakers, sideLabel, isCoinFlip, speakersOn, speakerTag, speakerName, prepClocks, fullPrep, formatCopy,
    POLICY: getFormat('policy-hs', 1) };
  if (isNode) module.exports = api;
  else (root.PolicyLogicParts = root.PolicyLogicParts || {}).format = api;
})(typeof window !== 'undefined' ? window : globalThis);
