// Debate formats as data (docs/architecture/ARCHITECTURE.md §9): the format files, the schema they follow, rounds
// that carry their format, and the LD format. Run with: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const L = require('./logic.js');
const { readSource } = require('./test-sources.js');

const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
const LD = L.getFormat('ld', 1);
const POLICY = L.getFormat('policy-hs', 1);

// ---------- the files ----------

// Every format version ever published. Add a line when a version ships; never remove one.
const PUBLISHED = ['policy-hs.v1', 'ld.v1', 'pf.v1'];

// Why: a saved round renders with the format version it was judged under. A deleted version file would make every
// old round in that version open as policy, with the wrong speeches, columns and ballot.
test('every published format version file still exists and is loaded', () => {
  const html = read('index.html');
  const bridge = read('bridge.mjs');
  for (const f of PUBLISHED) {
    assert.ok(fs.existsSync(path.join(__dirname, 'formats', f + '.js')), 'formats/' + f + '.js is missing');
    assert.ok(L.FORMAT_FILES.includes(f), f + ' is not in logic/format.js FORMAT_FILES');
    assert.ok(new RegExp('<script\\b[^>]*\\bsrc="formats/' + f.replace('.', '\\.') + '\\.js"').test(html), 'index.html does not load formats/' + f + '.js');
    assert.ok(bridge.includes("'" + f + "'"), f + ' is not in the local helper whitelist (bridge.mjs)');
    const [id, v] = f.split('.v');
    assert.ok(L.getFormat(id, Number(v)), f + ' does not load as ' + id + ' version ' + v);
  }
});

// Why: logic/format.js loads only the files in FORMAT_FILES. A published file missing there would load in the page
// (index.html) but not in Node or the server's copy, so the two would disagree about which formats exist.
test('FORMAT_FILES lists exactly the published versions, and every pickable format is one of them', () => {
  assert.deepEqual(L.FORMAT_FILES, PUBLISHED);
  for (const id of L.FORMAT_IDS) assert.ok(L.getFormat(id), id + ' is pickable but has no format file');
});

// Why: the screen shows one prep clock per side and finds it by side (js/clock.js prepClockOn). A format with two
// clocks on one side would silently hide the second clock, so such a format needs new screen code first.
test('every format has exactly one prep clock per side', () => {
  for (const f of PUBLISHED) {
    const [id, v] = f.split('.v');
    const clocks = L.prepClocks(L.getFormat(id, Number(v)));
    assert.deepEqual(clocks.map((c) => c.side).sort(), ['aff', 'neg'], f);
  }
});

// Why: a format file on disk that is not in the published list could be edited or deleted with no test noticing.
test('every format file on disk is in the published list, under its own id and version', () => {
  const onDisk = fs.readdirSync(path.join(__dirname, 'formats')).filter((f) => f.endsWith('.js') && !f.endsWith('.test.js')).map((f) => f.slice(0, -3));
  assert.deepEqual(onDisk.slice().sort(), PUBLISHED.slice().sort());
  for (const f of onDisk) {
    const data = require('./formats/' + f + '.js');
    assert.equal(data.id + '.v' + data.version, f, 'the file name must match its id and version');
  }
});

// Why: the hosted app ships only allowlisted folders. Without formats/ the page would load no format and break.
test('the app build ships the formats folder', () => {
  assert.match(read('build-app.mjs'), /'formats'/);
});

// ---------- the schema (built from policy-hs and ld only) ----------
const TOP = ['id', 'version', 'name', 'level', 'sides', 'speakers', 'speeches', 'flowColumns', 'defaultSheets', 'prep', 'ballot', 'timesNote', 'ai'];
// Fields only some formats have. order: 'coinFlip' (PF) names teams, not sides; a file without it is in fixed order.
const OPTIONAL = ['order'];
const AI = ['kind', 'abbr', 'transcribeHint', 'rules', 'evalNorms', 'flowSheets', 'pointsSpread'];
const str = (v) => typeof v === 'string' && v.trim().length > 0;

// Why: the app reads these fields without checks. A missing field, a duplicate speech id, a speech with no column or a
// speaker that does not exist breaks the clock, the flow grid or the ballot for every round in that format.
test('every format file follows the schema', () => {
  for (const f of PUBLISHED) {
    const x = require('./formats/' + f + '.js');
    assert.deepEqual(Object.keys(x).filter((k) => !OPTIONAL.includes(k)).sort(), TOP.slice().sort(), f + ': top-level fields');
    assert.ok(x.order === undefined || x.order === 'coinFlip', f + ': order');
    assert.ok(str(x.id) && Number.isInteger(x.version) && x.version >= 1 && str(x.name) && x.level === 'hs', f + ': identity');
    assert.deepEqual(Object.keys(x.sides), ['aff', 'neg'], f + ': sides');
    for (const s of Object.values(x.sides)) assert.ok(str(s.label) && str(s.name), f + ': side labels');
    const speakerIds = x.speakers.map((s) => s.id);
    assert.equal(new Set(speakerIds).size, speakerIds.length, f + ': speaker ids unique');
    for (const s of x.speakers) {
      assert.ok(str(s.id) && str(s.label) && ['aff', 'neg'].includes(s.side) && ['d1', 'd2'].includes(s.slot), f + ': speaker ' + s.id);
      assert.equal(x.speakers.filter((t) => t.side === s.side && t.slot === s.slot).length, 1, f + ': one debater per name box');
    }
    const ids = x.speeches.map((s) => s.id);
    assert.equal(new Set(ids).size, ids.length, f + ': speech ids unique');
    // A coin-flip file names teams; its speeches are checked as seated for each first side (the order a round uses).
    const views = x.order === 'coinFlip' ? ['aff', 'neg'].map((side) => L.formatOf({ format: x.id, formatVersion: x.version, firstSide: side })) : [x];
    for (const v of views) for (const s of v.speeches) {
      assert.ok(str(s.id) && str(s.label) && Number.isInteger(s.seconds) && s.seconds > 0, f + ': speech ' + s.id);
      assert.ok(['speech', 'cx', 'crossfire'].includes(s.kind), f + ': ' + s.id + ' kind');
      if (s.kind === 'crossfire') {
        assert.ok(Array.isArray(s.speakers) && s.speakers.length >= 2 && s.speakers.every((id) => speakerIds.includes(id)), f + ': ' + s.id + ' lists real debaters');
        assert.equal(s.column, null, f + ': crossfire is not flowed');
        continue;
      }
      assert.doesNotMatch(s.label, /\{side\}/, f + ': ' + s.id + ' label has no unfilled {side}');
      if (x.order === 'coinFlip') assert.ok(['first', 'second'].includes(s.team) && ['d1', 'd2'].includes(s.slot), f + ': ' + s.id + ' names its team and name box');
      const sp = x.speakers.find((t) => t.id === s.speaker);
      assert.ok(sp, f + ': ' + s.id + ' names a speaker that does not exist');
      assert.equal(sp.side, s.side, f + ': ' + s.id + ' is on its speaker\'s side');
      if (s.kind === 'cx') assert.equal(s.column, null, f + ': CX is not flowed');
      else {
        assert.ok(Number.isInteger(s.column) && s.column >= 0 && s.column < v.flowColumns.length, f + ': ' + s.id + ' maps to a flow column');
        assert.equal(v.flowColumns[s.column].side, s.side, f + ': ' + s.id + ' fills a column of its own side');
      }
    }
    for (const v of views) v.flowColumns.forEach((c, i) => {
      assert.ok(str(c.label) && ['aff', 'neg'].includes(c.side), f + ': column ' + i);
      assert.ok(x.speeches.some((s) => s.column === i), f + ': column ' + c.label + ' has a speech');
    });
    assert.ok(x.defaultSheets.length > 0 && x.defaultSheets.every(str), f + ': default sheets');
    assert.ok(Number.isInteger(x.prep.seconds) && x.prep.seconds > 0 && ['perTeam', 'perDebater'].includes(x.prep.mode), f + ': prep');
    assert.ok(Number.isInteger(x.ballot.points.min) && x.ballot.points.max > x.ballot.points.min && typeof x.ballot.speakerRanks === 'boolean', f + ': ballot');
    assert.deepEqual(Object.keys(x.ai).sort(), AI.slice().sort(), f + ': ai fields');
    for (const k of AI) assert.ok(str(x.ai[k]), f + ': ai.' + k);
  }
});

// Why: the clock times every speech from the file. A wrong number gives debaters the wrong time in a real round.
test('the speech and prep times add up to the NSDA rules', () => {
  const total = (fmt) => fmt.speeches.reduce((t, s) => t + s.seconds, 0) / 60;
  assert.equal(total(POLICY), 8 * 4 + 3 * 4 + 5 * 4);
  assert.deepEqual(LD.speeches.map((s) => s.id + ' ' + s.minutes), ['AC 6', 'CX-AC 3', 'NC 7', 'CX-NC 3', '1AR 4', 'NR 6', '2AR 3']);
  assert.equal(total(LD), 32);
  assert.deepEqual([POLICY.prep.seconds, POLICY.prep.mode], [480, 'perTeam']);
  assert.deepEqual([LD.prep.seconds, LD.prep.mode], [240, 'perDebater']);
});

// Why: no policy judge may see a change. The old constants now come from the policy file and must be what they were.
test('the policy file gives the same lists as the old constants', () => {
  assert.deepEqual(L.SPEECHES.map((s) => [s.id, s.label, s.side, s.minutes, s.speaker]), [
    ['1AC', '1AC', 'aff', 8, '1A'], ['CX-1A', 'CX of 1A (2N asks)', 'aff', 3, '1A'], ['1NC', '1NC', 'neg', 8, '1N'],
    ['CX-1N', 'CX of 1N (1A asks)', 'neg', 3, '1N'], ['2AC', '2AC', 'aff', 8, '2A'], ['CX-2A', 'CX of 2A (1N asks)', 'aff', 3, '2A'],
    ['2NC', '2NC', 'neg', 8, '2N'], ['CX-2N', 'CX of 2N (2A asks)', 'neg', 3, '2N'], ['1NR', '1NR', 'neg', 5, '1N'],
    ['1AR', '1AR', 'aff', 5, '1A'], ['2NR', '2NR', 'neg', 5, '2N'], ['2AR', '2AR', 'aff', 5, '2A']]);
  assert.deepEqual(L.DEFAULT_FLOWS, ['Case', 'T', 'DA 1', 'CP', 'K']);
  assert.deepEqual(L.SPEAKERS, ['1A', '2A', '1N', '2N']);
  assert.deepEqual(L.MAP_SPEECHES, ['1AC', '1NC', '2AC', '2NC', '1NR', '1AR', '2NR', '2AR']);
  assert.deepEqual(['1AC', '1NC', '2AC', '2NC', '1NR', '1AR', '2NR', '2AR', 'CX-1A'].map((id) => L.speechColumn(id)), [0, 1, 2, 3, 3, 4, 5, 6, null]);
  assert.match(L.TRANSCRIBE_HINT, /^High school policy debate\. Terms: affirmative, negative, 1AC/);
});

// ---------- rounds carry their format ----------

// Why: every round saved before formats existed is a policy round. If it loaded as anything else (or as a later policy
// version), its clocks, flow columns and ballot would not match what was judged.
test('a round with no format is policy-hs version 1', () => {
  assert.equal(L.formatOf({}).key, 'policy-hs@1');
  assert.equal(L.formatOf(null).key, 'policy-hs@1');
  assert.deepEqual(L.OLD_ROUND, { format: 'policy-hs', formatVersion: 1 });
  assert.equal(L.formatOf({ format: 'ld', formatVersion: 1 }).key, 'ld@1');
  assert.deepEqual(L.formatFields(LD), { format: 'ld', formatVersion: 1 });
});

// Why: a round file from a newer Tabula names a format this copy lacks. Opening it as policy would show the wrong
// speeches and could save a wrong ballot; it must be refused with a "reload" message instead.
test('a round file with an unknown format or version is refused; a known one keeps its format', () => {
  const file = (round) => JSON.stringify({ app: 'tabula', kind: 'tabula-round', version: 1, round: Object.assign({ transcripts: {}, flows: [] }, round), docs: [] });
  assert.equal(L.formatKnown({ format: 'ld', formatVersion: 99 }), false);
  assert.equal(L.formatKnown({ format: 'parli' }), false);
  assert.throws(() => L.parseRoundFile(file({ format: 'ld', formatVersion: 99 }), 'n'), /Reload the app/);
  assert.throws(() => L.parseRoundFile(file({ format: 'parli', formatVersion: 1 }), 'n'), /Reload the app/);
  const ok = L.parseRoundFile(file({ format: 'ld', formatVersion: 1, prepSeconds: 240, prepLeft: { Aff: 200, Neg: 240 } }), 'n').round;
  assert.deepEqual([ok.format, ok.formatVersion, ok.prepLeft], ['ld', 1, { Aff: 200, Neg: 240 }]);
  const old = L.parseRoundFile(file({ prepLeft: { aff: 100, neg: 480 } }), 'n').round;
  assert.deepEqual([old.format, old.prepLeft], [undefined, { aff: 100, neg: 480 }], 'an old file keeps no format field and loads as policy');
});

// Why: the page loads the saved round and round files; a new round must start in the format the judge picked, and an
// old saved round must get policy-hs v1, not the newest policy version.
test('the page stamps new rounds with their format and old saved rounds with policy-hs v1', () => {
  const app = readSource('app.js');
  assert.match(app, /\.\.\.L\.formatFields\(f\)/, 'freshRound stores format and formatVersion');
  assert.match(app, /Object\.assign\(freshRound\(\), storedRound \? L\.OLD_ROUND : \{\}, storedRound \|\| \{\}\)/);
  assert.match(app, /if \(!L\.formatKnown\(R\)\)/, 'a saved round in an unknown format is not opened as policy');
});

// Why: the AI server builds the rules text from its own copy of the format files. The client must name the round's
// format and version on every hosted call, and must not be able to send another round's format.
test('hosted AI calls send the round\'s format and version, never rules text', () => {
  const body = L.hostedAiBody({ id: 'r', format: 'ld', formatVersion: 1 }, { callId: 'c', format: 'policy-hs', formatVersion: 7 });
  assert.equal(body.format, 'ld');
  assert.equal(body.formatVersion, 1);
  assert.ok(!JSON.stringify(body).includes(LD.ai.rules), 'no rules text in the body');
  assert.deepEqual([L.hostedAiBody({ id: 'r' }, {}).format, L.hostedAiBody({ id: 'r' }, {}).formatVersion], ['policy-hs', 1]);
});

// Why: a ?format=ld link from the site or a coach must open LD; anything else must be ignored, not crash the page.
test('the ?format= link picks only a known format', () => {
  assert.equal(L.formatFromSearch('?format=ld'), 'ld');
  assert.equal(L.formatFromSearch('?study=1&format=policy-hs'), 'policy-hs');
  assert.equal(L.formatFromSearch('?format=parli'), '');
  assert.equal(L.formatFromSearch(''), '');
  assert.match(readSource('app.js'), /L\.formatFromSearch\(location\.search\)/);
});

// Why: the refactor's point is that page code passes the round's format in. A page part still reading the policy
// constants would show policy speeches, columns or debaters in an LD round.
test('page code reads the round\'s format, not the policy constants', () => {
  const app = readSource('app.js');
  for (const name of ['SPEECHES', 'FLOW_COLUMNS', 'DEFAULT_FLOWS', 'MAP_SPEECHES', 'SPEAKERS', 'DEFAULT_PREP_SECONDS', 'TRANSCRIBE_HINT',
    'JUDGE_SYSTEM', 'POINTS_GUIDE', 'LIVE_FLOW_SYSTEM', 'EVAL_SYSTEM', 'EVAL_SCHEMA', 'ANALYSIS_SYSTEM', 'MAP_SCHEMA', 'BALLOT_SCHEMA',
    'BALLOT_TASK', 'BALLOT_FIELDS', 'PTS_FIELDS', 'DRAFT_GROUPS']) {
    assert.doesNotMatch(app, new RegExp('\\bL\\.' + name + '\\b'), 'page code uses L.' + name);
  }
});

// ---------- LD ----------
const ldRound = (extra) => Object.assign({ id: 'r', format: 'ld', formatVersion: 1, tournament: 'T', roundName: 'R2', topic: 'Res',
  aff: { team: 'Lake AB', d1: 'Ann Lee', d2: '' }, neg: { team: 'Hill CD', d1: 'Cy Ro', d2: '' },
  transcripts: {}, flows: [], aiFlows: [], timeLeft: {}, prepSeconds: 240, prepLeft: { Aff: 240, Neg: 240 },
  ballot: { winner: 'neg', pts: { Aff: '28.4', Neg: '28.7' }, ranks: {}, rfd: 'Framework.' } }, extra);

// Why: LD ballots have two debaters and no speaker ranks. Policy's rank and four-speaker checks would block every LD
// ballot from looking complete.
test('LD: the ballot check has no ranks and names the two debaters', () => {
  assert.deepEqual(L.checkBallot(ldRound().ballot, { range: { min: 25, max: 30 }, format: LD }), []);
  assert.deepEqual(L.checkBallot({ winner: 'aff', pts: { Aff: '27', Neg: '29' }, rfd: '' }, { format: LD }),
    ['Low-point win: the Aff wins with fewer points. Check that you meant this.', 'Write a reason for decision (RFD).']);
  assert.deepEqual(L.checkBallot({ winner: 'aff', pts: { Aff: '24' }, rfd: 'x' }, { range: { min: 25, max: 30 }, format: LD }),
    ['Aff has 24, outside 25–30.', 'Give Neg speaker points.']);
  assert.deepEqual(L.ballotFields(LD), ['winner', 'pts.Aff', 'pts.Neg', 'rfd', 'affFb', 'negFb']);
  assert.deepEqual(L.draftGroups(LD)[1], { id: 'pts', label: 'Points', fields: ['pts.Aff', 'pts.Neg'] });
});

// Why: History keeps the old column layout. An LD ballot must land in the first debater's columns and open again as LD,
// or the History table and its CSV lose the LD points.
test('LD: a saved ballot keeps the format and opens again with its points', () => {
  const entry = L.savedBallotEntry(ldRound(), 'now', { min: 25, max: 30 });
  const row = L.savedBallotRow(entry);
  const col = (name) => row[L.BALLOT_HEADER.indexOf(name)];
  assert.deepEqual([col('1A'), col('1A pts'), col('1N'), col('1N pts'), col('2A pts'), col('2N pts')], ['Ann Lee', '28.4', 'Cy Ro', '28.7', '', '']);
  const view = L.savedBallotView(entry);
  assert.deepEqual([view.round.format, view.round.ballot.pts], ['ld', { Aff: '28.4', Neg: '28.7' }]);
  assert.equal(L.decisionText(view.round), 'Neg (Hill CD) wins.\nAff Ann Lee: 28.4 points\nNeg Cy Ro: 28.7 points');
  const print = L.printModel(view.round, { range: view.ptsRange }).sections.find((s) => s.kind === 'speakers');
  assert.deepEqual([print.title, print.ranks, print.rows.map((r) => r.speaker)], ['Points (25–30)', false, ['Aff', 'Neg']]);
});

// Why: the AI must judge an LD round by LD rules (framework first, no new arguments in the NR or 2AR) and fill an LD
// ballot. Policy prompts would ask for four debaters and ranks the LD ballot cannot hold.
test('LD: the AI prompts and schemas are keyed by format', () => {
  const P = L.promptsFor(LD);
  assert.match(P.judgeSystem, /Lincoln-Douglas \(LD\) debate round/);
  assert.ok(P.judgeSystem.includes(LD.ai.rules));
  assert.doesNotMatch(P.judgeSystem, /\b(1A|2A|1N|2N)\b|policy|2NR/);
  assert.match(P.judgeSystem, /FEEDBACK: one short paragraph for each debater \(Aff debater, Neg debater\)/);
  assert.deepEqual(Object.keys(P.ballotSchema.properties.points.properties), ['Aff', 'Neg']);
  assert.equal(P.ballotSchema.properties.ranks, undefined);
  assert.ok(!P.ballotSchema.required.includes('ranks'));
  assert.deepEqual(P.evalSchema.properties.feedback.items.properties.speaker.enum, ['Aff', 'Neg']);
  assert.deepEqual(P.mapSchema.properties.nodes.items.properties.speech.enum, ['AC', 'NC', '1AR', 'NR', '2AR']);
  assert.ok(P.liveFlowSystem.includes(LD.ai.flowSheets));
  const r = ldRound({ transcripts: { AC: 'my value is morality' } });
  const judge = L.buildJudgePrompt(r, []);
  assert.match(judge, /Aff: one debater, the Aff debater\. Neg: one debater, the Neg debater\./);
  assert.match(judge, /--- AC \(AFF, Aff debater\) ---/);
  assert.match(L.buildBallotPrompt(r, [], ''), /points for Aff, Neg \(one decimal place\)\./);
  assert.equal(L.nextSpeech(r), 'CX-AC');
  assert.match(L.buildTranscribePrompt('', LD), /^High school Lincoln-Douglas debate/);
  assert.equal(L.promptsFor(LD), L.promptsFor(LD), 'one prompt set per format version');
});

// Why: names never reach an AI. In LD the name becomes "Aff debater"; a plain "Aff" tag would turn every "Aff" in
// the AI's reply into the student's name.
test('LD: names are swapped for "Aff debater" and "Neg debater" and back', () => {
  const r = ldRound();
  assert.equal(L.anonymize('Ann Lee asked Cy Ro', r), 'Aff debater asked Neg debater');
  assert.equal(L.deanonymize('The Aff debater won; the Aff was clear.', r), 'The Ann Lee won; the Aff was clear.');
  assert.deepEqual(L.parseFeedback('FEEDBACK:\nAff debater: good framing\nNeg debater: extend more\nSUGGESTED POINTS:', LD), { aff: 'Aff debater: good framing', neg: 'Neg debater: extend more' });
});

// Why: LD prep is per debater. The prep clocks must be keyed by debater, survive a reload under that key, and reject a
// policy side key, or the restored clock would run on the wrong debater.
test('LD: prep is one clock per debater, restored after a reload', () => {
  assert.deepEqual(L.prepClocks(LD), [{ id: 'Aff', side: 'aff', label: 'Aff' }, { id: 'Neg', side: 'neg', label: 'Neg' }]);
  assert.deepEqual(L.prepClocks(POLICY).map((c) => c.id), ['aff', 'neg']);
  assert.deepEqual(L.fullPrep(LD, 240), { Aff: 240, Neg: 240 });
  const now = 1000000;
  const c = L.restoreClocks(null, { side: 'Neg', endAt: now + 100000 }, now, 240, undefined, LD);
  assert.deepEqual([c.prep.state, c.prep.side, c.prep.left], ['running', 'Neg', 100]);
  assert.equal(L.restoreClocks(null, { side: 'neg', endAt: now + 1000 }, now, 240, undefined, LD).prep.state, 'none');
  assert.equal(L.restoreRun({ id: 'NC', endAt: now + 1000 }, now, undefined, LD).state, 'running');
  assert.equal(L.restoreRun({ id: 'NC', endAt: now + 1000 }, now).state, 'none', 'NC is not a policy speech');
  const used = L.prepUsed(ldRound({ prepLeft: { Aff: 180, Neg: 240 } }));
  assert.deepEqual([used.aff.text, used.neg.used, used.any], ['Aff used 1:00 of 4:00', 0, true]);
});

// Why: the clock view, the flow and the docs read speeches by format. Wrong ids would put a doc or the Now mark on the
// wrong column, or say "Already at 1AC" in an LD round.
test('LD: speeches, columns, docs and the clock view lines', () => {
  assert.equal(L.speechLine('NC', LD), 'NC · Neg · 7 min');
  assert.equal(L.speechLine('1NC'), '1NC · Neg · 1N · 8 min');
  assert.deepEqual(L.stepSpeechState(0, -1, LD), { disabled: true, reason: 'Already at AC' });
  assert.deepEqual(L.stepSpeechState(6, 1, LD), { disabled: true, reason: 'Already at 2AR' });
  assert.deepEqual(L.flowMarks('NR', '1AR', LD), { current: 3, now: 3, viewing: 2 });
  assert.equal(L.docSpeech({ side: 'aff' }, LD), 'AC');
  assert.equal(L.docSpeech({ side: 'neg' }, LD), 'NC');
  assert.equal(L.guessSpeech('Lake AB NC v2.docx', LD), 'NC');
  assert.equal(L.guessSpeech('Smith 1AR.pdf', LD), '1AR');
  assert.equal(L.guessSpeech('block.docx', LD), '', 'the policy block alias is not an LD speech');
  assert.equal(L.speechesSoFar(ldRound({ timeLeft: { AC: 100, '1NC': 10 } })).join(), 'AC');
  const cell = L.aiFlowCell({ parts: { NR: { standard: 'x' } } }, 3, 'standard', LD);
  assert.equal(cell, 'x');
  const lay = L.layoutMap({ nodes: [{ id: 'a', speech: 'AC', label: 'V' }, { id: 'b', speech: 'NC', label: 'C', status: 'dropped' }], edges: [{ from: 'b', to: 'a', kind: 'answers' }] }, ['AC', 'NC'], LD);
  assert.deepEqual(lay.columns, ['AC', 'NC']);
  assert.deepEqual(lay.rows[0].cells.NC.map((c) => c.side), ['neg']);
});

// Why: a page part that calls a helper no part declares throws when it runs, so that view breaks for every judge.
// nameOf was removed from js/decide.js; the Live Eval feedback must not still call it, and its colour must come from
// the format (an LD 'Aff' id does not end in 'A').
test('Live Eval feedback reads the debater from the format', () => {
  const app = readSource('app.js');
  assert.doesNotMatch(app, /\bnameOf\(/);
  assert.doesNotMatch(app, /endsWith\('A'\)/);
  assert.match(app, /const fbSide = \(id\) => \(fbSp\(id\) \|\| \{\}\)\.side/);
});

// Why: the Round setup screen is where a judge picks LD. Without the pick, the id it reads, and the boxes it relabels,
// there is no way to start an LD round from inside the app.
test('Round setup has the format pick and relabels the prep and name boxes', () => {
  const html = read('index.html');
  // CHANGED 2026-11-24 because the owner approved radio cards for the format pick (docs/design/FORMAT-PICK.md §3). Old check:
  //   assert.match(html, /<select id="format-pick"/);
  assert.match(html, /<fieldset class="format-pick" id="format-pick"[^>]*>\s*<legend>Format<\/legend>\s*<div class="fmt-cards" id="format-cards">/);
  assert.match(html, /id="prep-min-label"/);
  assert.match(html, /id="times-note"/);
  const app = readSource('app.js');
  assert.match(app, /function renderFormatSetup\(\)/);
  assert.match(app, /fmt\.prep\.mode === 'perDebater' \? 'Prep per debater \(minutes\)'/);
});
