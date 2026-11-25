// Public Forum (PF) and the two format-file fields it brought (ARCHITECTURE.md §9): coin-flip order
// (order: 'coinFlip', round.firstSide) and crossfire rows that list their debaters. Run with: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const L = require('./logic.js');
const { readSource } = require('./test-sources.js');
const { snapshot } = require('./fixtures/format-snapshot.js');

const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
const PF = L.getFormat('pf', 1);
const proFirst = L.formatOf({ format: 'pf', formatVersion: 1, firstSide: 'aff' });
const conFirst = L.formatOf({ format: 'pf', formatVersion: 1, firstSide: 'neg' });
const pfRound = (extra) => Object.assign({ id: 'r', format: 'pf', formatVersion: 1, firstSide: 'aff', tournament: 'T', roundName: 'R3', topic: 'Res',
  aff: { team: 'Ash RT', d1: 'Rhea Tam', d2: 'Theo Var' }, neg: { team: 'Pine LO', d1: 'Lena Oko', d2: 'Oren Hal' },
  transcripts: {}, flows: [], aiFlows: [], timeLeft: {}, prepSeconds: 180, prepLeft: { aff: 180, neg: 180 },
  ballot: { winner: 'aff', pts: { Pro1: '28.7', Pro2: '28.4', Con1: '28.5', Con2: '28.2' }, ranks: {}, rfd: 'Jobs.' } }, extra);

// ---------- policy and LD did not change ----------

// Why: coin-flip order and crossfire rows went into shared code that every policy and LD round runs through. If any
// speech, column, clock line, ballot word or AI prompt moved, policy and LD judges would see a change nobody approved.
test('policy and LD rounds give exactly what they gave before PF (fixtures/format-baseline.json)', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(snapshot(L))), JSON.parse(read('fixtures/format-baseline.json')));
});

// ---------- the PF file ----------

// Why: the clock times every speech from the file. A wrong time or order gives PF debaters the wrong time in a real
// round, and a wrong debater on a speech puts the transcript and the points under the wrong student.
test('PF: NSDA times, order, debaters and prep (FORMATS.md §2)', () => {
  assert.deepEqual(proFirst.speeches.map((s) => s.id + ' ' + s.minutes), ['Const1 4', 'Const2 4', 'CF1 3', 'Reb1 4', 'Reb2 4', 'CF2 3',
    'Sum1 3', 'Sum2 3', 'GCF 3', 'FF1 2', 'FF2 2']);
  assert.deepEqual(proFirst.speeches.filter((s) => s.kind === 'speech').map((s) => s.speaker),
    ['Pro1', 'Con1', 'Pro2', 'Con2', 'Pro1', 'Con1', 'Pro2', 'Con2']);
  assert.deepEqual([PF.prep.seconds, PF.prep.mode], [180, 'perTeam']);
  assert.deepEqual(L.prepClocks(PF).map((c) => c.id + ' ' + c.label), ['aff Pro', 'neg Con']);
  assert.equal(PF.ballot.speakerRanks, false, 'FORMATS.md §2: win/loss and points, no ranks');
  assert.deepEqual(PF.defaultSheets, ['Pro case', 'Con case']);
});

// Why: a judge must be able to pick PF for a new round, from the Format pick or from a coach's ?format=pf link.
test('PF: a judge can pick it, and ?format=pf opens it', () => {
  assert.ok(L.FORMAT_IDS.includes('pf'));
  assert.equal(L.formatFromSearch('?format=pf'), 'pf');
  assert.equal(L.formatKnown({ format: 'pf', formatVersion: 1 }), true);
});

// ---------- coin-flip order ----------

// Why: in PF the coin flip decides who speaks first. If the order did not follow the round's choice, half of all
// rounds would show the Con's speeches as the Pro's, with the wrong colours, columns and debaters.
test('coin flip: each speech place takes the side, debater and label of the team that speaks there', () => {
  const view = (f) => f.speeches.map((s) => [s.id, s.side, s.speaker || '', s.label]);
  assert.deepEqual(view(proFirst).slice(0, 4), [['Const1', 'aff', 'Pro1', 'Pro Constructive'], ['Const2', 'neg', 'Con1', 'Con Constructive'],
    ['CF1', 'both', '', 'Crossfire (first speakers)'], ['Reb1', 'aff', 'Pro2', 'Pro Rebuttal']]);
  assert.deepEqual(view(conFirst).slice(0, 4), [['Const1', 'neg', 'Con1', 'Con Constructive'], ['Const2', 'aff', 'Pro1', 'Pro Constructive'],
    ['CF1', 'both', '', 'Crossfire (first speakers)'], ['Reb1', 'neg', 'Con2', 'Con Rebuttal']]);
  assert.deepEqual(conFirst.flowColumns.map((c) => c.side + ' ' + c.label).slice(0, 2), ['neg Con Constructive', 'aff Pro Constructive']);
  assert.deepEqual(conFirst.speeches.map((s) => s.id), proFirst.speeches.map((s) => s.id), 'the speech ids keep their places');
  assert.deepEqual(L.docSpeech({ side: 'aff' }, conFirst), 'Const2', 'a Pro doc goes to the Pro constructive');
  assert.equal(L.speechLine('Const1', conFirst), 'Const1 · Con · Con1 · 4 min');
});

// Why: the order is part of the round. It must be stored with the round, survive a reload, a round file and a saved
// ballot, and a round with no stored choice (or a damaged one) must still open with a safe default instead of breaking.
test('coin flip: the round stores who speaks first; a missing or bad value means Pro first', () => {
  assert.deepEqual(L.formatFields(conFirst), { format: 'pf', formatVersion: 1, firstSide: 'neg' });
  assert.deepEqual(L.formatFields(PF), { format: 'pf', formatVersion: 1, firstSide: 'aff' }, 'a new round stores the default');
  assert.equal(L.formatOf({ format: 'pf', formatVersion: 1 }).firstSide, 'aff');
  assert.equal(L.formatOf({ format: 'pf', formatVersion: 1, firstSide: 'sideways' }).firstSide, 'aff');
  assert.equal(L.formatOf(pfRound({ firstSide: 'neg' })), L.formatOf(pfRound({ firstSide: 'neg' })), 'one seated format per order');
  assert.ok(Object.isFrozen(conFirst) && Object.isFrozen(conFirst.speeches[0]));
  const file = JSON.stringify({ app: 'tabula', kind: 'tabula-round', version: 1, round: pfRound({ firstSide: 'neg' }), docs: [] });
  assert.equal(L.parseRoundFile(file, 'n').round.firstSide, 'neg');
  const saved = L.savedBallotView(L.savedBallotEntry(pfRound({ firstSide: 'neg' }), 'now', { min: 25, max: 30 }));
  assert.equal(L.formatOf(saved.round).firstSide, 'neg');
  assert.equal(L.hostedAiBody(pfRound({ firstSide: 'neg' }), { callId: 'c' }).firstSide, 'neg', 'the server gets the order too');
});

// Why: changing who speaks first after speeches were timed, recorded or flowed moves that work to the other side.
// The page must ask first in that case, and must not nag when only names are typed (names belong to a side).
test('coin flip: the order counts as in use once speech work exists, not for names alone', () => {
  assert.equal(L.orderInUse(pfRound()), false);
  assert.equal(L.orderInUse(null), false);
  assert.equal(L.orderInUse(pfRound({ transcripts: { Const1: 'hi' } })), true);
  assert.equal(L.orderInUse(pfRound({ timeLeft: { CF1: 100 } })), true);
  assert.equal(L.orderInUse(pfRound({ flows: [{ name: 'Pro case', cells: { 0: 'C1' } }] })), true);
  assert.equal(L.orderInUse(pfRound({ run: { id: 'Const1', endAt: 1 } })), true);
  assert.equal(L.orderInUse(pfRound({ aiFlows: [{ name: 'Pro case', parts: {} }] })), true);
});

// ---------- crossfire rows ----------

// Why: a crossfire has both teams' debaters at once (all four in grand crossfire). A row with one speaker would put
// it on one side's colour, credit one debater, and the AI would read only one side as speaking.
test('crossfire rows list their debaters, belong to both sides, and are timed but not flowed', () => {
  const cf = (id) => proFirst.speeches.find((s) => s.id === id);
  assert.deepEqual(L.speechSpeakers(proFirst, cf('CF1')).map((s) => s.id), ['Pro1', 'Con1']);
  assert.deepEqual(L.speechSpeakers(proFirst, cf('CF2')).map((s) => s.id), ['Pro2', 'Con2']);
  assert.deepEqual(L.speechSpeakers(proFirst, cf('GCF')).map((s) => s.id), ['Pro1', 'Pro2', 'Con1', 'Con2']);
  assert.deepEqual(['CF1', 'CF2', 'GCF'].map((id) => [cf(id).side, cf(id).column, cf(id).kind]), [['both', null, 'crossfire'], ['both', null, 'crossfire'], ['both', null, 'crossfire']]);
  assert.deepEqual(proFirst.flowSpeeches, ['Const1', 'Const2', 'Reb1', 'Reb2', 'Sum1', 'Sum2', 'FF1', 'FF2']);
  assert.equal(L.speechLine('GCF', proFirst), 'GCF · Both · 3 min');
  assert.equal(L.sideLabel(proFirst, 'both'), 'Both');
  const judge = L.buildJudgePrompt(pfRound({ transcripts: { CF1: 'you said jobs' } }), []);
  assert.match(judge, /--- Crossfire \(first speakers\) \(BOTH, Pro first speaker & Con first speaker\) ---/);
  assert.equal(L.chipText({ onFlow: false, run: { id: 'GCF', left: 50 }, prep: null, format: proFirst }).side, 'both');
});

// Why: a policy CX row still names the one debater being asked; the shared helper must not change that.
test('a one-speaker row keeps its one debater', () => {
  const pol = L.getFormat('policy-hs', 1);
  assert.deepEqual(L.speechSpeakers(pol, pol.speeches[1]).map((s) => s.id), ['1A']);
});

// ---------- ballot, AI and words ----------

// Why: a PF ballot says Pro and Con. "Aff wins" on a PF ballot, in the copy blocks or on the print sheet would be the
// wrong words on the record a judge pastes into the tournament site.
test('PF: the ballot, copy blocks, print sheet and checks say Pro and Con', () => {
  const r = pfRound();
  assert.match(L.decisionText(r), /^Pro \(Ash RT\) wins\.\nPro 1 Rhea Tam: 28\.7 points\n/);
  assert.deepEqual(L.tournamentBlocks(r).map((b) => b.label), ['Decision', 'Reason for decision', 'Pro comments', 'Con comments']);
  assert.deepEqual(L.draftGroups(PF).slice(3).map((g) => g.label), ['Pro comments', 'Con comments']);
  assert.equal(L.fieldLabel('negFb', PF), 'the Con comments');
  const print = L.printModel(r, { range: { min: 25, max: 30 } });
  assert.equal(print.sections.find((s) => s.kind === 'winner').text, 'Pro (Ash RT) wins');
  assert.deepEqual(print.sections.find((s) => s.kind === 'speakers').rows.map((x) => x.speaker), ['Pro 1', 'Pro 2', 'Con 1', 'Con 2']);
  assert.deepEqual(L.checkBallot(r.ballot, { range: { min: 25, max: 30 }, format: PF }), []);
  assert.match(L.checkBallot({ winner: 'aff', pts: { Pro1: '26', Pro2: '26', Con1: '29', Con2: '29' }, rfd: 'x' }, { format: PF })[0], /^Low-point win: the Pro wins/);
  assert.equal(L.issueTally([{ ahead: 'aff' }, { ahead: 'neg' }], PF).text, 'Pro ahead on 1 · Even 0 · Con ahead on 1');
});

// Why: the AI must judge a PF round by PF rules and fill a four-debater ballot with no ranks; it is told that Pro is
// written AFF in the data, or its DECISION line and the leaning would be read as the wrong side.
test('PF: the AI prompts and schemas are keyed by the format', () => {
  const P = L.promptsFor(PF);
  assert.match(P.judgeSystem, /Public Forum \(PF\) debate round/);
  assert.ok(P.judgeSystem.includes(PF.ai.rules));
  assert.match(PF.ai.rules, /Pro side is called AFF and the Con side is called NEG/);
  assert.deepEqual(Object.keys(P.ballotSchema.properties.points.properties), ['Pro1', 'Pro2', 'Con1', 'Con2']);
  assert.equal(P.ballotSchema.properties.ranks, undefined);
  assert.ok(!P.ballotSchema.required.includes('ranks'));
  assert.deepEqual(P.mapSchema.properties.nodes.items.properties.speech.enum, proFirst.flowSpeeches);
  assert.match(L.buildJudgePrompt(pfRound(), []), /Pro: speakers Pro first speaker and Pro second speaker\. Con: speakers Con first speaker and Con second speaker\./);
  assert.equal(L.anonymize('Rhea Tam asked Oren Hal', pfRound()), 'Pro first speaker asked Con second speaker');
});

// ---------- the page ----------

// Why: Round setup is where a judge enters the coin flip. Without the pick, or if it changed a started round without
// asking, a judge could not set the order, or could move recorded speeches to the other side by one stray click.
test('Round setup has the "Speaks first" pick; a change asks first once speech work exists', () => {
  assert.match(read('index.html'), /<div class="format-row" id="first-side-row" hidden>[\s\S]*?<select id="first-side"/);
  const app = readSource('app.js');
  assert.match(app, /async function switchFirstSide\(side\)/);
  assert.match(app, /if \(L\.orderInUse\(R\)\) \{\s*const ok = await ask\(/);
  assert.match(app, /R\.firstSide = side;\s*save\(\);/);
  assert.match(app, /\$\('#first-side-row'\)\.hidden = !L\.isCoinFlip\(fmt\)/);
});

// Why: the page's fixed text ("Aff prep", "Aff wins", "Affirmative") must follow the format, or a PF judge reads
// Aff and Neg next to Pro and Con speeches.
test('the side words in the page text follow the format', () => {
  const html = read('index.html');
  for (const hook of ['data-side-word="aff" data-side-after=" prep"', 'data-side-word="neg" data-side-after=" wins"', 'data-side-name="aff"']) assert.ok(html.includes(hook), hook);
  assert.match(readSource('app.js'), /function renderSideWords\(fmt\)/);
});

// Why: PF behaviour is data first: it comes from the format file's fields, so the next coin-flip or
// crossfire format needs no new code. A check on the PF id in code would make PF a special case.
test('no code checks for the PF format by id', () => {
  const inDir = (d) => fs.readdirSync(path.join(__dirname, d)).filter((f) => /\.m?js$/.test(f) && !/\.test\./.test(f)).map((f) => d + '/' + f);
  for (const f of ['logic.js', ...inDir('logic'), ...inDir('js'), ...inDir('core')]) {
    const src = read(f);
    assert.doesNotMatch(src, /\.id === 'pf'|=== 'pf'|'pf' ===|\bformat === 'pf'/, f);
  }
});
