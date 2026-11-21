// Shared places that must follow the round's format (ARCHITECTURE.md §9): the History table and its exports, study
// mode, the hints and AI wording that used to name policy-only things, and page code that must pass the format in.
// Run with: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('./logic.js');
const { readSource } = require('./test-sources.js');

const LD = L.getFormat('ld', 1);
const POLICY = L.getFormat('policy-hs', 1);
const POLICY_WORDS = /\b(plan|policy|federal|perm|1AC|2NR|1A|2N)\b/i;

const policyRound = { tournament: 'T', roundName: 'R1', judge: 'J', topic: 'X', aff: { team: 'Lake AB', d1: 'a1', d2: 'a2' },
  neg: { team: 'Hill CD', d1: 'n1', d2: 'n2' }, ballot: { winner: 'aff', pts: { '1A': 28.5, '2A': 28, '1N': 27.5, '2N': 27 }, ranks: { '1A': 1, '2A': 2, '1N': 3, '2N': 4 }, rfd: 'Case.' } };
const ldRound = { format: 'ld', formatVersion: 1, tournament: 'T', roundName: 'R2', judge: 'J', topic: 'Y', aff: { team: 'Lake AB', d1: 'Ann Lee', d2: '' },
  neg: { team: 'Hill CD', d1: 'Cy Ro', d2: '' }, ballot: { winner: 'neg', pts: { Aff: '28.4', Neg: '28.7' }, ranks: {}, rfd: 'Framework.' } };
const range = { min: 25, max: 30 };

// ---------- History ----------

// Why: coaches keep spreadsheets built on the old CSV. If a policy-only export moved or renamed a column, every
// formula and pasted sheet built on it would silently read the wrong numbers.
test('History export: a policy-only history keeps the old columns in the old places, with Format at the end', () => {
  const e = L.savedBallotEntry(policyRound, 'now', range);
  const t = L.historyTable([e, L.ballotRow(policyRound, 'then')]);
  assert.deepEqual(t.header, [...L.BALLOT_HEADER, 'Format']);
  assert.deepEqual(t.rows[0], [...L.savedBallotRow(e), 'Policy (CX)']);
  assert.equal(t.rows[1][t.header.indexOf('Format')], 'Policy (CX)', 'an old entry with no format is a policy ballot');
  assert.deepEqual(L.historyColumns(t).map((i) => t.header[i]), L.LOG_COLUMNS.map((i) => L.BALLOT_HEADER[i]));
});

// Why: an LD ballot has two debaters and no ranks. Under "1A pts" / "1N pts" a coach reads LD points as a policy
// speaker's, and empty rank columns suggest a missing rank.
test('History export: LD rows use the LD speaker labels and have no rank columns', () => {
  const t = L.historyTable([L.savedBallotEntry(ldRound, 'now', range)]);
  assert.deepEqual(t.header, ['Saved at', 'Tournament', 'Round', 'Judge', 'Topic', 'Aff team', 'Aff', 'Aff pts', 'Neg team', 'Neg', 'Neg pts',
    'Winner', 'Winning team', 'RFD', 'Format']);
  const col = (n) => t.rows[0][t.header.indexOf(n)];
  assert.deepEqual([col('Aff'), col('Aff pts'), col('Neg'), col('Neg pts'), col('Winner'), col('Winning team'), col('Format')],
    ['Ann Lee', '28.4', 'Cy Ro', '28.7', 'NEG', 'Hill CD', 'Lincoln-Douglas (LD)']);
  assert.deepEqual(L.historyColumns(t).map((i) => t.header[i]), ['Saved at', 'Round', 'Aff team', 'Neg team', 'Winner', 'Aff pts', 'Neg pts']);
});

// Why: a judge who judged both formats downloads one file. Each row must keep its points in its own format's columns
// and say its format, or a sort or filter in the spreadsheet mixes LD and policy points.
test('History export: a mixed history is one table; each row fills only its own format\'s columns', () => {
  const t = L.historyTable([L.savedBallotEntry(policyRound, 'a', range), L.savedBallotEntry(ldRound, 'b', range)]);
  const col = (r, n) => t.rows[r][t.header.indexOf(n)];
  assert.equal(new Set(t.header).size, t.header.length, 'no column name twice');
  assert.ok(t.header.indexOf('2A rank') < t.header.indexOf('Aff') && t.header.indexOf('Aff pts') < t.header.indexOf('Neg team'), 'each speaker sits under its side');
  assert.deepEqual([col(0, '1A pts'), col(0, 'Aff pts'), col(0, 'Format')], [28.5, '', 'Policy (CX)']);
  assert.deepEqual([col(1, '1A pts'), col(1, '1N pts'), col(1, 'Aff pts'), col(1, 'Neg pts'), col(1, 'Format')], ['', '', '28.4', '28.7', 'Lincoln-Douglas (LD)']);
  assert.ok(t.rows.every((r) => r.length === t.header.length));
  assert.deepEqual(L.historyColumns(t).map((i) => t.header[i]),
    ['Saved at', 'Round', 'Aff team', 'Neg team', 'Winner', '1A pts', '2A pts', 'Aff pts', '1N pts', '2N pts', 'Neg pts', 'Format']);
  assert.equal(L.toCSV([t.header, ...t.rows]).split('\r\n').length, 3, 'one header line and one line per ballot');
});

// Why: a ballot saved by a newer Tabula (a format this copy does not have) must not be passed off as a policy ballot.
// Labeled "Policy (CX)", a coach would file it with policy rounds and trust points that may sit in the wrong columns.
// And with the Format column hidden, a policy + unknown history would hide the true label on the History page.
test('History export: a ballot in an unknown format is labeled by its id and version, and the page shows Format', () => {
  const e = L.savedBallotEntry(policyRound, 'later', range);
  Object.assign(e[L.BALLOT_HEADER.length], { format: 'pf', formatVersion: 2 });
  const t = L.historyTable([L.savedBallotEntry(policyRound, 'a', range), e]);
  const col = (r, n) => t.rows[r][t.header.indexOf(n)];
  assert.equal(col(0, 'Format'), 'Policy (CX)');
  assert.equal(col(1, 'Format'), 'pf v2');
  assert.ok(L.historyColumns(t).map((i) => t.header[i]).includes('Format'), 'the History page shows the Format column');
  const noVersion = L.savedBallotEntry(policyRound, 'later', range);
  Object.assign(noVersion[L.BALLOT_HEADER.length], { format: 'pf', formatVersion: undefined });
  assert.equal(L.historyTable([noVersion]).rows[0][t.header.indexOf('Format')], 'pf', 'no version: the id alone');
});

// Why: a saved ballot in a format this copy does not have prints through the policy fallback. Without a note, the
// paper ballot shows 1A/2A/1N/2N rows as if it were a policy round, and a coach or tab room trusts the wrong labels.
test('Print: a saved ballot in an unknown format says so on the sheet; a known format adds no note', () => {
  const e = L.savedBallotEntry(policyRound, 'later', range);
  Object.assign(e[L.BALLOT_HEADER.length], { format: 'pf', formatVersion: 2 });
  const facts = (round) => L.printModel(round, { range }).sections.find((s) => s.kind === 'facts').items;
  const note = facts(L.savedBallotView(e).round).find(([k]) => k === 'Format');
  assert.ok(note, 'the sheet has a Format line');
  assert.equal(note[1], 'pf v2: not in this copy of Tabula. Points show in policy speaker places, as saved.');
  Object.assign(e[L.BALLOT_HEADER.length], { formatVersion: undefined });
  assert.match(facts(L.savedBallotView(e).round).find(([k]) => k === 'Format')[1], /^pf: not in this copy/, 'no version: the id alone');
  assert.equal(facts(L.savedBallotView(L.savedBallotEntry(ldRound, 'a', range)).round).find(([k]) => k === 'Format'), undefined);
  assert.equal(facts(policyRound).find(([k]) => k === 'Format'), undefined);
});

// ---------- study mode ----------

// Why: study mode times the first view to the first Start for the five-judge test. In an LD round there is no 1AC, so
// a hard-coded "1AC" would never stop the timer and the test would show no result.
test('study mode starts on the first speech of the round\'s format', () => {
  let m = L.studyMark({}, { type: 'view', at: 1000 }, LD);
  m = L.studyMark(m, { type: 'start', at: 5000, speechId: '1AC' }, LD);
  assert.equal(m.firstStart, undefined, '1AC is not an LD speech');
  m = L.studyMark(m, { type: 'start', at: 48000, speechId: 'AC' }, LD);
  assert.deepEqual([m.firstStart, m.firstSpeech], [48000, 'AC']);
  assert.match(L.studyResult(m).copy, /from first view to the first AC Start\.$/);
  const p = L.studyMark(L.studyMark({}, { type: 'view', at: 1 }, POLICY), { type: 'start', at: 9000, speechId: '1AC' }, POLICY);
  assert.match(L.studyResult(p).copy, /the first 1AC Start\.$/);
  assert.match(readSource('app.js'), /L\.studyMark\(before, \{ type: 'start', at: Date\.now\(\), speechId \}, FMT\(\)\)/);
});

// ---------- wording in shared places ----------

// Why: the Resolution box, the ballot box and the argument editor show their hint in every round. Policy words there
// ("federal government", "plan", "the 1A") tell an LD judge the app is not for them.
test('the hints in shared boxes follow the format; policy keeps its old hints', () => {
  const ld = L.formatCopy(LD);
  for (const k of ['topicHint', 'ballotExample', 'argExample', 'flowBriefExamples', 'readingJudge', 'readingExample']) {
    assert.ok(ld[k] && !POLICY_WORDS.test(ld[k]), 'LD ' + k + ': ' + ld[k]);
  }
  assert.equal(L.formatCopy(POLICY).topicHint, 'Resolved: The United States federal government should…');
  const pf = Object.assign({}, LD, { id: 'pf', ai: Object.assign({}, LD.ai, { abbr: 'PF' }), speakers: [{ id: '1P', label: '1st Pro', side: 'aff', slot: 'd1' }] });
  assert.match(L.formatCopy(pf).ballotExample, /Be kind to the 1st Pro\./, 'a format with no wording gets plain hints from its own data');
  const setup = readSource('js/formatsetup.js');
  for (const box of ["document.querySelector('[data-bind=\"topic\"]').placeholder = copy.topicHint", "$('#ballot-input').placeholder = copy.ballotExample",
    "$('#ne-label').placeholder = copy.argExample"]) assert.ok(setup.includes(box), box);
});

// Why: the reading level is added to every AI prompt. Telling the AI it writes for a "college policy judge" and to
// explain "the plan" makes LD feedback use policy words; policy judges must get the exact text they had.
test('the reading level and live flow wording follow the format; policy text is unchanged', () => {
  for (const lv of ['expert', 'plain']) {
    assert.doesNotMatch(L.readingGuide(lv, LD), POLICY_WORDS, lv);
    assert.equal(L.readingGuide(lv, POLICY), L.READING_LEVELS[lv].guide);
  }
  assert.match(L.readingGuide('plain', LD), /not "the Aff debater"/);
  assert.equal(L.readingGuide('nonsense', LD), L.readingLevels(LD).expert.guide);
  assert.doesNotMatch(L.promptsFor(LD).liveFlowSystem, /\bplan\b/);
  assert.equal(L.promptsFor(POLICY).liveFlowSystem, L.LIVE_FLOW_SYSTEM);
  const app = readSource('app.js');
  const calls = app.match(/L\.readingGuide\([^\n]*/g) || [];
  assert.ok(calls.length >= 2 && calls.every((c) => /^L\.readingGuide\([\w.]+(\(\))?, FMT\(\)\)/.test(c)), 'every page call passes the round\'s format');
});

// Why: on silence the speech model sometimes returns the vocabulary hint. Only the policy hint was dropped, so in LD
// the hint text would land in the transcript and go to the AI as if a debater said it.
test('a transcript that echoes the format\'s hint is dropped in every format', () => {
  assert.ok(L.isHintEcho(LD.ai.transcribeHint, LD));
  assert.ok(L.isHintEcho('Lincoln-Douglas debate. Terms: affirmative', LD));
  assert.ok(L.isHintEcho('policy debate. Terms: affirmative', POLICY));
  assert.equal(L.isHintEcho('My value is morality and my criterion is', LD), false);
  assert.match(readSource('app.js'), /if \(L\.isHintEcho\(text, FMT\(\)\)\) text = '';/);
});

// ---------- page code reads the round's format ----------

// Why: the History table and the exports must use the format-aware table. Page code still reading the stored
// policy layout would put LD points back under "1A pts" with no test noticing.
test('History page code uses historyTable, not the stored policy layout', () => {
  const app = readSource('app.js');
  for (const name of ['BALLOT_HEADER', 'LOG_COLUMNS', 'savedBallotRow']) assert.doesNotMatch(app, new RegExp('\\bL\\.' + name + '\\b'), 'page code uses L.' + name);
  assert.match(app, /L\.historyTable\(store\.get\(LOG, \[\]\)\)/);
  assert.match(app, /download\('tabula_ballots\.csv'/);
});
