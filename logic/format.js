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
  const FILES = ['policy-hs.v1', 'ld.v1'];
  const loaded = isNode ? FILES.map((f) => require('../formats/' + f + '.js')) : (root.TabulaFormats || []);

  // A format file, ready to use: frozen, with the derived lists the code needs. The file itself stays plain data.
  function prepare(f) {
    const speeches = f.speeches.map((s) => Object.freeze(Object.assign({}, s, { minutes: s.seconds / 60 })));
    return deepFreeze(Object.assign({}, f, {
      key: f.id + '@' + f.version,
      speeches,
      // The speeches the flow and the Round Map use, in order (CX is not flowed).
      flowSpeeches: speeches.filter((s) => s.column != null).map((s) => s.id),
      speakerIds: f.speakers.map((s) => s.id),
    }));
  }
  // deepFreeze is shared code in core/defs.js (an ES module). The page runs it before this file; Node requires it.
  const { deepFreeze } = isNode ? require('../core/defs.js') : root.TabulaCore.defs;

  const BY_KEY = {};
  for (const f of loaded) BY_KEY[f.id + '@' + f.version] = prepare(f);
  // The newest version of each format. A new round uses it.
  const LATEST = {};
  for (const f of Object.values(BY_KEY)) if (!LATEST[f.id] || LATEST[f.id].version < f.version) LATEST[f.id] = f;

  // The formats a judge can pick for a new round, in the owner's order (policy today, then LD).
  const FORMAT_IDS = ['policy-hs', 'ld'];
  const DEFAULT_FORMAT_ID = 'policy-hs';
  // A round saved before formats existed has no format: it was a policy round under the first policy file.
  const OLD_ROUND = { format: 'policy-hs', formatVersion: 1 };

  // getFormat('ld') -> the newest LD; getFormat('ld', 1) -> LD version 1; null when unknown.
  function getFormat(id, version) {
    if (version == null) return LATEST[id] || null;
    return BY_KEY[id + '@' + Number(version)] || null;
  }
  // The format a round was judged under. A round with no format is an old policy round (policy-hs v1).
  const findFormat = (r) => getFormat(r.format == null ? OLD_ROUND.format : r.format, r.formatVersion == null ? OLD_ROUND.formatVersion : r.formatVersion);
  // Does this copy of the app have the round's format? false for a file from a newer Tabula. The page checks this
  // where a round comes in (a round file, the saved round), so formatOf never meets an unknown format there.
  const formatKnown = (round) => Boolean(findFormat(round || {}));
  // The round's format. An unknown one falls back to policy-hs v1, so a pure function never breaks on bad data.
  function formatOf(round) { return findFormat(round || {}) || BY_KEY[OLD_ROUND.format + '@' + OLD_ROUND.formatVersion]; }
  // The fields a round record stores for its format.
  const formatFields = (fmt) => ({ format: fmt.id, formatVersion: fmt.version });
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
    formatFromSearch, speechOf, columnOf, speakerOf, speakersOn, speakerTag, speakerName, prepClocks, fullPrep, formatCopy,
    POLICY: getFormat('policy-hs', 1) };
  if (isNode) module.exports = api;
  else (root.PolicyLogicParts = root.PolicyLogicParts || {}).format = api;
})(typeof window !== 'undefined' ? window : globalThis);
