// Tests for the Slice 4 logic (Decide and ballot). Spec: docs/design/SPEC.md §3.4 and §6.1. Run with: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('./logic.js');

const draft = () => ({
  winner: 'neg', confidence: 'medium',
  points: { '1A': 27.04, '2A': 28.66, '1N': 29.1, '2N': 27.5 }, ranks: { '1A': 4, '2A': 2, '1N': 1, '2N': 3 },
  rfd: 'The neg wins on the DA.', aff_comments: 'AFF NOTES', neg_comments: 'NEG NOTES', points_reasoning: 'why',
});

// Why: the tag on each field is the judge's only proof the AI will leave it alone; a wrong state means the AI overwrites what they signed.
test('fieldState: yours wins, then ai, then empty, for one field and for a speaker row', () => {
  const b = { winner: 'aff', rfd: '', pts: { '1A': 28 }, ranks: { '1A': '' }, touched: { 'pts.1A': true }, aiFilled: { winner: true } };
  assert.equal(L.fieldState(b, 'winner'), 'ai');
  assert.equal(L.fieldState(b, 'rfd'), 'empty');
  assert.equal(L.fieldState(b, 'pts.1A'), 'yours');
  assert.equal(L.fieldState(b, ['pts.1A', 'ranks.1A']), 'yours', 'a row is yours when one of its fields is');
  assert.equal(L.fieldState(b, ['pts.2A', 'ranks.2A']), 'empty');
  assert.equal(L.fieldState({ rfd: 'old fill, no sets' }, 'rfd'), 'ai', 'an old AI fill with no sets saved is still the AI\'s');
});

// Why: an edit must lock the field, an auto refill must not, and Unlock must free it; a lost move silently changes who owns a field.
test('markFields: the touched / aiFilled move for yours, ai and free, without changing the old ballot', () => {
  const b0 = { rfd: 'x', touched: {}, aiFilled: { rfd: true } };
  const y = L.markFields(b0, ['rfd'], 'yours');
  assert.deepEqual([y.touched.rfd, y.aiFilled.rfd], [true, undefined]);
  assert.deepEqual(b0.aiFilled, { rfd: true }, 'the old ballot is not changed');
  const a = L.markFields(y, ['rfd'], 'ai');
  assert.deepEqual([a.touched.rfd, a.aiFilled.rfd], [undefined, true]);
  const f = L.markFields(y, ['rfd'], 'free');
  assert.equal(f.touched.rfd, undefined);
  assert.equal(L.fieldState(f, 'rfd'), 'ai');
});

// Why: Undo puts back a copy; if the copy shared objects with the live ballot, later edits would change the "before" too and Undo would restore nothing.
test('ballotSnapshot: a deep copy that later edits never reach', () => {
  const b = { pts: { '1A': 28 }, touched: { rfd: true } };
  const s = L.ballotSnapshot(b);
  b.pts['1A'] = 30; b.touched.rfd = false;
  assert.equal(s.pts['1A'], 28);
  assert.equal(s.touched.rfd, true);
});

// Why: Draft on an empty round wastes a paid call on a made-up ballot; any speech, flow note or doc is enough to start.
test('roundHasContent: transcript, flow cell, AI flow or doc counts; an empty round does not', () => {
  assert.equal(L.roundHasContent({ transcripts: {}, flows: [{ cells: {} }], aiFlows: [] }, []), false);
  assert.equal(L.roundHasContent({ transcripts: { '1AC': ' hi ' } }, []), true);
  assert.equal(L.roundHasContent({ flows: [{ cells: { 0: 'Adv 1' } }] }, []), true);
  assert.equal(L.roundHasContent({ aiFlows: [{ parts: { '1AC': {} } }] }, []), true);
  assert.equal(L.roundHasContent({}, [{ name: 'aff.pdf' }]), true);
  assert.equal(L.roundHasContent({ transcripts: { '1AC': '   ' } }, []), false, 'blank text is not content');
});

// Why: each panel state has its own words and a disabled Draft; the wrong order would show "Pick at least one" to a judge with no AI.
test('draftPanelState: loading, then no AI, offline, empty round, nothing picked, error, stopped, ready', () => {
  const ok = { aiReady: true, hasContent: true, picked: 2 };
  assert.equal(L.draftPanelState({ ...ok, busy: true, aiReady: false }), 'loading');
  assert.equal(L.draftPanelState({ ...ok, aiReady: false, offline: true }), 'noAI');
  assert.equal(L.draftPanelState({ ...ok, offline: true }), 'offline');
  assert.equal(L.draftPanelState({ ...ok, hasContent: false }), 'empty');
  assert.equal(L.draftPanelState({ ...ok, picked: 0 }), 'nothing');
  assert.equal(L.draftPanelState({ ...ok, error: 'x' }), 'error');
  assert.equal(L.draftPanelState({ ...ok, stopped: true }), 'stopped');
  assert.equal(L.draftPanelState(ok), 'ready');
});

// Why: a range other than 25–30 that the AI never hears gives points the tournament rejects; feedback the judge asked for must reach the comments.
test('buildBallotPrompt: range line only off 25–30, the picked fields, the redo note and the Live Eval feedback', () => {
  const r = { aff: {}, neg: {}, ballot: {} };
  assert.ok(!L.buildBallotPrompt(r, [], '').includes('This tournament uses'), 'no line for the default range');
  const p = L.buildBallotPrompt(r, [], '', {
    range: { min: 20, max: 30 }, only: ['rfd', 'pts.1A'],
    redraft: { fields: ['rfd'], previous: { rfd: 'Old RFD text' } },
    liveEvalFeedback: [{ speaker: '1A', so_far: 'Clear.', strength: 'Signposting', fix: 'Weigh', points: '28' }, { speaker: '2N', points: 'not yet' }],
  });
  assert.ok(p.includes('This tournament uses 20–30. Map the scale above onto that range.'));
  assert.ok(p.includes('THE JUDGE WANTS NEW TEXT FOR: the reason for decision, 1A points.'));
  assert.ok(p.includes('REDO: the judge asked for a different version of the reason for decision.'));
  assert.ok(p.includes('Your last version of the reason for decision: Old RFD text'));
  assert.ok(p.includes('1A: Clear. Did well: Signposting To work on: Weigh'));
  assert.ok(!p.includes('2N:'), 'a debater who has not spoken gives no feedback line');
  assert.ok(p.indexOf('LIVE EVAL FEEDBACK') < p.indexOf('ROUND INFO'), 'the extras come before the round text');
});

// Why: the review inserts only what the judge chose; writing an unpicked field or an out-of-range score puts text on the ballot no one approved.
test('applyBallotDraft: opts.only writes exactly those fields, even a yours one, and marks them', () => {
  const ballot = { winner: 'aff', rfd: 'MINE', pts: {}, ranks: {}, touched: { rfd: true } };
  const b = L.applyBallotDraft(ballot, draft(), { only: ['rfd', 'affFb'], mark: 'yours' });
  assert.equal(b.rfd, 'The neg wins on the DA.', 'the judge chose "Use AI text" for their RFD');
  assert.equal(b.affFb, 'AFF NOTES');
  assert.equal(b.winner, 'aff', 'winner was not picked');
  assert.equal(b.negFb, undefined);
  assert.deepEqual([b.touched.rfd, b.touched.affFb], [true, true], 'inserted fields become yours');
});

// Why: an AI score outside the tournament's range would be rejected by the tab room; it is never inserted (4.4).
test('applyBallotDraft: opts.range never writes AI points outside the range, and auto refill marks ai', () => {
  const c = L.applyBallotDraft({ pts: {}, ranks: {} }, draft(), { range: { min: 28, max: 30 }, mark: 'ai' });
  assert.equal(c.pts['1A'], undefined);
  assert.equal(c.pts['2N'], undefined);
  assert.equal(c.pts['2A'], 28.7);
  assert.equal(c.aiFilled['pts.2A'], true);
  assert.equal(c.aiFilled['pts.1A'], undefined, 'a field not written is not marked');
  assert.equal(L.applyBallotDraft({ touched: { rfd: true }, rfd: 'mine' }, draft()).rfd, 'mine', 'without only the lock still holds');
});

// Why: the judge reads the diff to see what the AI wants to change in their text; a wrong diff hides a changed word.
test('wordDiff: keeps same words, marks removed and added words, and handles empty sides', () => {
  const d = L.wordDiff('The aff wins on the perm.', 'The neg wins on the DA.');
  assert.deepEqual(d.map((x) => x.op), ['same', 'del', 'ins', 'same', 'del', 'ins']);
  assert.equal(d.filter((x) => x.op !== 'ins').map((x) => x.text).join(''), 'The aff wins on the perm.', 'old text comes back from same + del');
  assert.equal(d.filter((x) => x.op !== 'del').map((x) => x.text).join(''), 'The neg wins on the DA.', 'new text comes back from same + ins');
  assert.deepEqual(L.wordDiff('', 'new'), [{ op: 'ins', text: 'new' }]);
  assert.deepEqual(L.wordDiff('old', ''), [{ op: 'del', text: 'old' }]);
});

// Why: the review must never default to overwriting a "Yours" field; Insert on empty and AI fields saves clicks.
test('reviewFromDraft: one card per pick, yours on Keep mine with a diff, others on Insert, out-of-range points listed', () => {
  const ballot = { winner: '', rfd: 'My RFD', pts: {}, ranks: {}, touched: { rfd: true } };
  const rv = L.reviewFromDraft(ballot, draft(), { picks: ['winner', 'pts', 'rfd'], range: { min: 28, max: 30 }, through: ['1AC'], at: 5 });
  assert.deepEqual(rv.cards.map((c) => c.id), ['winner', 'pts', 'rfd']);
  const [w, p, r] = rv.cards;
  assert.deepEqual([w.state, w.choice, w.after.winner], ['empty', 'insert', 'neg']);
  assert.deepEqual(p.outOfRange, [{ speaker: '1A', value: 27 }, { speaker: '2N', value: 27.5 }]);
  assert.deepEqual([r.state, r.choice], ['yours', 'keep']);
  assert.ok(r.diff.some((x) => x.op === 'del') && r.diff.some((x) => x.op === 'ins'));
  assert.deepEqual(rv.through, ['1AC']);
  assert.deepEqual(L.reviewInsertFields(rv), ['winner', ...L.PTS_FIELDS], 'Keep mine is not inserted');
  assert.deepEqual(L.reviewInsertFields(rv, true), ['winner', ...L.PTS_FIELDS], 'Accept all never flips Keep mine');
});

// Why: a judge who edits a field during the review must not lose that edit to an old AI suggestion (4.4).
test('staleReviewCards: an edited field shows Changed, gets a new diff and goes back to Keep mine', () => {
  const ballot = { rfd: '', pts: {}, ranks: {} };
  const rv = L.reviewFromDraft(ballot, draft(), { picks: ['rfd', 'affFb'] });
  assert.equal(rv.cards[0].choice, 'insert');
  const after = L.staleReviewCards(rv, { rfd: 'I typed this', pts: {}, ranks: {} });
  const c = after.cards[0];
  assert.deepEqual([c.changed, c.choice, c.state, c.base.rfd], [true, 'keep', 'yours', 'I typed this']);
  assert.ok(c.diff.length > 0);
  assert.equal(after.cards[1].changed, false, 'an untouched card stays as it was');
  assert.equal(rv.cards[0].changed, false, 'the old review is not changed');
});

// Why: a draft made before the 2NR is stale after it; the review must say so and offer Redo all.
test('speechEndedSince: true only when a new speech happened after the draft', () => {
  const rv = { through: ['1AC'] };
  assert.equal(L.speechEndedSince(rv, { transcripts: { '1AC': 'x' } }), false);
  assert.equal(L.speechEndedSince(rv, { transcripts: { '1AC': 'x', '1NC': 'y' } }), true);
  assert.equal(L.speechEndedSince(null, {}), false);
});

// Why: the range drives the check; a typed range that breaks the rules must give the spec's words, not a silent default.
test('ptsRange and rangeError: default 25–30, whole numbers 0–100, low below high', () => {
  assert.deepEqual(L.ptsRange(undefined), { min: 25, max: 30 });
  assert.deepEqual(L.ptsRange({ min: 20, max: 30 }), { min: 20, max: 30 });
  assert.deepEqual(L.ptsRange({ min: 30, max: 30 }), { min: 25, max: 30 });
  assert.equal(L.rangeError(25, 30), '');
  assert.equal(L.rangeError(30, 25), 'The lowest score must be less than the highest.');
  assert.equal(L.rangeError('', 30), 'Use a number from 0 to 100.');
  assert.equal(L.rangeError(25.5, 30), 'Use a number from 0 to 100.');
  assert.equal(L.rangeError(0, 101), 'Use a number from 0 to 100.');
});

// Why: points typed before a range change stay as typed but must be flagged; old saved ballots have no range, so no false alarms.
test('checkBallot: range, out-of-range points, missing ranks, and no range check for old saved ballots', () => {
  const b = { winner: 'aff', pts: { '1A': 24.5, '2A': 28.7, '1N': 28.2, '2N': 28.4 }, ranks: { '1A': 2, '2A': 1, '1N': '', '2N': 3 }, rfd: 'x' };
  const issues = L.checkBallot(b, { range: { min: 25, max: 30 } });
  assert.ok(issues.includes('1A has 24.5, outside 25–30.'));
  assert.ok(issues.includes('Give 1N a rank.'));
  assert.ok(!L.checkBallot(b, { range: { min: 20, max: 30 } }).some((m) => m.includes('outside')), 'inside 20–30');
  assert.ok(!L.checkBallot(b, { range: null }).some((m) => m.includes('outside')), 'an old saved ballot gets no range check');
  assert.equal(L.ranksSet(b), 3);
});

// Why: two speakers with one rank get the ballot bounced; picking a used rank must move it and say who lost it (4.8).
test('moveRank: picking a used rank moves it and names both speakers', () => {
  const m = L.moveRank({ '1A': '1', '2A': '2' }, '2A', 1);
  assert.deepEqual(m.ranks, { '1A': '', '2A': '1' });
  assert.equal(m.message, 'Rank 1 moved from 1A to 2A.');
  const n = L.moveRank({ '1A': '1' }, '2N', '3');
  assert.deepEqual([n.ranks['2N'], n.message, n.moved], ['3', '', null]);
  assert.equal(L.moveRank({ '1A': '1' }, '1A', '').ranks['1A'], '', 'clearing a rank moves nothing');
});

// Why: the − and + buttons must never step past the tournament's range or leave float noise like 28.300000000000001.
test('stepPoints: steps of 0.1 inside the range; an empty box starts near the top', () => {
  assert.equal(L.stepPoints('28.2', 1), 28.3);
  assert.equal(L.stepPoints(30, 1), 30);
  assert.equal(L.stepPoints(25, -1), 25);
  assert.equal(L.stepPoints('', 1), 28);
  assert.equal(L.stepPoints('', 1, { min: 70, max: 80 }), 76);
});

// Why: print must hold the whole ballot and only the extras the judge ticked; a print with the flow in portrait cuts off columns.
test('printModel: ballot always, flow, transcripts and AI notes only when asked, landscape with the flow', () => {
  const r = { roundName: 'R3', tournament: 'T', aff: { team: 'A', d1: 'Ann' }, neg: { team: 'N' },
    ballot: { winner: 'aff', pts: { '1A': 28 }, ranks: { '1A': 1 }, rfd: 'Long RFD '.repeat(200), affFb: 'a', negFb: 'n' },
    flows: [{ name: 'Case', cells: { 0: 'Adv 1' } }, { name: 'Empty', cells: {} }], transcripts: { '1AC': 'words' } };
  const plain = L.printModel(r, { range: { min: 25, max: 30 } });
  assert.equal(plain.orientation, 'portrait');
  assert.deepEqual(plain.sections.map((s) => s.kind), ['facts', 'winner', 'speakers', 'text', 'text', 'text']);
  assert.equal(plain.sections[1].text, 'Aff (A) wins');
  assert.equal(plain.sections[2].title, 'Points (25–30) and ranks');
  assert.equal(plain.sections[3].text, r.ballot.rfd, 'the RFD prints in full');
  const all = L.printModel(r, { flow: true, transcripts: true, aiNotes: true, liveEval: { summary: 'S' }, analysis: [['Round Map', ''], ['Impact Calculus', 'I']] });
  assert.equal(all.orientation, 'landscape');
  assert.deepEqual(all.sections.filter((s) => s.kind === 'flow').map((s) => s.title), ['Flow: Case'], 'an empty sheet is left out');
  assert.ok(all.sections.some((s) => s.title === 'Transcript: 1AC'));
  assert.deepEqual(all.sections.filter((s) => (s.title || '').startsWith('AI notes')).map((s) => s.title), ['AI notes: Live Eval', 'AI notes: Impact Calculus']);
  assert.equal(L.printModel(r, { range: null }).sections[2].title, 'Points and ranks', 'an old saved ballot prints with no range');
});

// Why: each block is pasted into one box on the tournament site; a wrong order or a missing name sends text to the wrong box.
test('tournamentBlocks: Decision, RFD, Aff and Neg comments, with an empty text when nothing is written', () => {
  const r = { aff: { team: 'Lincoln AB', d1: 'Ann', d2: '' }, neg: { team: 'NHS', d1: '', d2: '' }, ballot: { winner: 'aff', pts: { '1A': 28.5, '2N': 27 }, ranks: { '1A': 1 }, rfd: ' RFD ' } };
  const b = L.tournamentBlocks(r);
  assert.deepEqual(b.map((x) => x.label), ['Decision', 'Reason for decision', 'Aff comments', 'Neg comments']);
  assert.equal(b[0].text, 'Aff (Lincoln AB) wins.\n1A Ann: 28.5 points, rank 1\n2N: 27 points');
  assert.equal(b[1].text, 'RFD');
  assert.equal(b[2].text, '');
});

// Why: saved ballots must keep their own range and comments, and old rows with neither must still open (no crash, no range check).
test('savedBallotEntry / savedBallotView / savedBallotRow: new entries keep the range; old rows open with none', () => {
  const r = { tournament: 'T', roundName: 'R1', judge: 'J', topic: 'X', aff: { team: 'A', d1: 'a1', d2: 'a2' }, neg: { team: 'N', d1: 'n1', d2: 'n2' },
    ballot: { winner: 'neg', pts: { '1A': 28 }, ranks: { '1A': 2 }, rfd: 'R', affFb: 'af', negFb: 'nf' } };
  const e = L.savedBallotEntry(r, 'now', { min: 20, max: 30 });
  assert.equal(L.savedBallotRow(e).length, L.BALLOT_HEADER.length, 'the spreadsheet row has no extra cell');
  const v = L.savedBallotView(e);
  assert.deepEqual(v.ptsRange, { min: 20, max: 30 });
  assert.deepEqual([v.round.ballot.winner, v.round.ballot.pts['1A'], v.round.ballot.affFb, v.round.aff.d2], ['neg', 28, 'af', 'a2']);
  const old = L.savedBallotView(L.ballotRow(r, 'then'));
  assert.equal(old.ptsRange, null);
  assert.equal(old.round.ballot.affFb, '');
});

// Why: "Prep used" is the judge's record for a prep dispute; a wrong sign or a missing total misleads them.
test('prepUsed: used of total for each team, never negative or above the total', () => {
  const p = L.prepUsed({ prepSeconds: 480, prepLeft: { aff: 290, neg: 480 } });
  assert.equal(p.aff.text, 'Aff used 3:10 of 8:00');
  assert.equal(p.neg.text, 'Neg used 0:00 of 8:00');
  assert.equal(p.any, true);
  assert.equal(L.prepUsed({ prepSeconds: 300, prepLeft: { aff: 400, neg: -20 } }).neg.used, 300);
  assert.equal(L.prepUsed({ prepSeconds: 300, prepLeft: { aff: 400, neg: -20 } }).aff.used, 0);
  assert.equal(L.prepUsed({ prepSeconds: 300, prepLeft: { aff: 300, neg: 300 } }).any, false);
});

// Why: key moments are the drops and concessions that decide rounds; anything else there is noise in the judge's RFD notes.
test('keyMoments: only dropped and conceded map nodes, in speech order', () => {
  const k = L.keyMoments({ nodes: [
    { speech: '2AC', label: 'Perm', status: 'dropped' }, { speech: '1AC', label: 'Adv 1', status: 'extended' },
    { speech: '1NC', label: 'DA link', status: 'conceded' }] });
  assert.deepEqual(k.map((x) => x.text), ['1NC: DA link (conceded)', '2AC: Perm (dropped)']);
  assert.equal(k[0].side, 'neg');
  assert.deepEqual(L.keyMoments(null), []);
});

// Why: the summary bar is read as a whole sentence by screen readers and must count each side right (4.13).
test('issueTally and outOfDateText: the paired bar text and the out-of-date line', () => {
  const t = L.issueTally([{ ahead: 'aff' }, { ahead: 'aff' }, { ahead: 'neg' }, { ahead: 'even' }, { ahead: 'unclear' }]);
  assert.equal(t.text, 'Aff ahead on 2 · Even 1 · Neg ahead on 1');
  assert.equal(L.outOfDateText(['1AC'], { transcripts: { '1AC': 'a', '1AR': 'b', '2NR': 'c' } }), 'Out of date: 1AR and 2NR happened since.');
  assert.equal(L.outOfDateText(['1AC'], { transcripts: { '1AC': 'a' } }), '');
  assert.equal(L.andList(['1AC', '1NC', '2AC']), '1AC, 1NC and 2AC');
});

// Why: Q15 puts this round's writing choice over the device default; the wrong order makes the AI write in the level the judge did not pick.
test('readingFor, runVerb and decideTab', () => {
  assert.equal(L.readingFor('plain', 'expert'), 'plain');
  assert.equal(L.readingFor(undefined, 'plain'), 'plain');
  assert.equal(L.readingFor('odd', undefined), 'expert');
  assert.equal(L.runVerb(false), 'Run');
  assert.equal(L.runVerb(true), 'Update');
  assert.equal(L.decideTab('draft'), 'ballot', 'a saved Decision draft tab opens the Ballot');
  assert.equal(L.decideTab('eval'), 'eval');
});

// Why: Blank slate is the Q15 wording; the old label "Tabula rasa" clashes with the app's own name.
test('the tabula paradigm label reads "Blank slate (tabula rasa)"', () => {
  assert.equal(L.PARADIGM_LABELS.tabula, 'Blank slate (tabula rasa)');
});

// Why: Insert must write only what the judge chose, never a "Keep mine" card or an out-of-range score, and inserted text becomes theirs.
test('applyReview: writes chosen cards as yours, skips Keep mine and out-of-range points, counts cards', () => {
  const ballot = { winner: '', rfd: 'Mine', pts: {}, ranks: {}, touched: { rfd: true } };
  const rv = L.reviewFromDraft(ballot, draft(), { picks: ['winner', 'pts', 'rfd', 'affFb'], range: { min: 28, max: 30 } });
  rv.cards[3].choice = 'skip';
  const r = L.applyReview(ballot, rv, false);
  assert.equal(r.ballot.winner, 'neg');
  assert.equal(r.ballot.rfd, 'Mine', 'Keep mine stays');
  assert.equal(r.ballot.pts['1A'], undefined, '27 is outside 28–30');
  assert.equal(r.ballot.pts['2A'], 28.7);
  assert.equal(r.ballot.affFb, undefined, 'an unticked card is not inserted');
  assert.equal(r.count, 2);
  assert.equal(r.ballot.touched.winner, true);
  const all = L.applyReview(ballot, rv, true);
  assert.equal(all.ballot.affFb, 'AFF NOTES', 'Accept all takes unticked cards');
  assert.equal(all.ballot.rfd, 'Mine', 'Accept all never flips Keep mine');
});

// Why: "the AI never overwrites Yours" must hold even when an edit path skips staleReviewCards (Undo, a non-ballot path); else Insert wipes typed text.
test('applyReview: skips a field the judge changed or made theirs after the card was made', () => {
  const ballot = { winner: '', rfd: '', affFb: '', pts: {}, ranks: {} };
  const rv = L.reviewFromDraft(ballot, draft(), { picks: ['winner', 'rfd', 'affFb'] });
  assert.deepEqual(rv.cards.map((c) => c.choice), ['insert', 'insert', 'insert']);
  // The review was not refreshed: rfd now holds new typed text, and affFb was marked yours with the same (empty) text.
  const now = { winner: '', rfd: 'I typed this', affFb: '', pts: {}, ranks: {}, touched: { rfd: true, affFb: true } };
  const r = L.applyReview(now, rv, true);
  assert.equal(r.ballot.rfd, 'I typed this', 'changed since the card');
  assert.equal(r.ballot.affFb, '', 'became yours after a card that was not');
  assert.equal(r.ballot.winner, 'neg', 'an untouched field is still inserted');
  assert.deepEqual([r.count, r.fields], [1, ['winner']]);
  // A card that was already yours, set by the judge to "Use AI text", may still replace their text.
  const mine = { rfd: 'Mine', pts: {}, ranks: {}, touched: { rfd: true } };
  const rv2 = L.reviewFromDraft(mine, draft(), { picks: ['rfd'] });
  rv2.cards[0].choice = 'ai';
  assert.equal(L.applyReview(mine, rv2, false).ballot.rfd, 'The neg wins on the DA.');
});

// Why: a ticked "Insert this" on a card with no AI text promises a change that never happens, and the judge trusts the wrong ballot.
test('reviewFromDraft: a card with no AI text starts unticked and marked empty', () => {
  const d = Object.assign(draft(), { neg_comments: '' });
  const rv = L.reviewFromDraft({ pts: {}, ranks: {} }, d, { picks: ['affFb', 'negFb'] });
  assert.deepEqual(rv.cards.map((c) => [c.id, c.empty, c.choice]), [['affFb', false, 'insert'], ['negFb', true, 'keep']]);
  assert.deepEqual(L.reviewInsertFields(rv, true), ['affFb'], 'Accept all does not take an empty card');
});

// Why: D2 and 4.6: an automatic refill may fill blanks, must ask before changing AI text, and must never touch the judge's text.
test('autoRefillPlan: empty fields are written, changed AI fields go to review, yours are never touched', () => {
  const ballot = { winner: 'aff', rfd: 'Old AI RFD', affFb: 'Mine', pts: { '1A': 28 }, ranks: {}, touched: { affFb: true }, aiFilled: { winner: true, rfd: true, 'pts.1A': true } };
  const plan = L.autoRefillPlan(ballot, draft(), { min: 25, max: 30 });
  assert.ok(plan.write.includes('negFb') && plan.write.includes('pts.2A') && plan.write.includes('ranks.1A'));
  assert.ok(!plan.write.includes('affFb') && !plan.write.includes('rfd') && !plan.write.includes('winner'));
  assert.deepEqual(plan.review, ['winner', 'pts', 'rfd']);
  const same = L.autoRefillPlan({ rfd: 'The neg wins on the DA.', aiFilled: { rfd: true } }, draft());
  assert.ok(!same.review.includes('rfd'), 'an AI field the draft does not change needs no review');
});

// ---------- Option B (Q-8): flow mark shading ----------
const marks = (t) => L.flowMarkTokens(t).map((k) => [k.kind, t.slice(k.start, k.end)]);

// Why: the shade is the judge's quick cue for a dropped, conceded, extended or turned argument; a missed mark hides a drop they flowed.
test('flowMarkTokens: finds each mark kind from the shorthand list', () => {
  assert.deepEqual(marks('ext N/U'), [['extend', 'ext']]);
  assert.deepEqual(marks('Ext IL *dropped in 1AR'), [['extend', 'Ext'], ['drop', '*dropped']]);
  assert.deepEqual(marks('(no answer)'), [['drop', 'no answer']]);
  assert.deepEqual(marks('* IL'), [['drop', '*']]);
  assert.deepEqual(marks('*IL'), [['drop', '*']], 'a star at the start of a word marks only the star');
  assert.deepEqual(marks('conc. turned, DA TC'), [['concede', 'conc'], ['turn', 'turned'], ['turn', 'TC']]);
  assert.deepEqual(marks('L/T: plan saves $; I/T; Case O/W'), [['turn', 'L/T'], ['turn', 'I/T'], ['weigh', 'O/W']]);
  assert.deepEqual(marks('conceded DROPPED Extend'), [['concede', 'conceded'], ['drop', 'DROPPED'], ['extend', 'Extend']]);
});

// Why: shading parts of ordinary words ("text", "context", "turnout") would put noise all over the flow and teach the judge to ignore it.
test('flowMarkTokens: only whole tokens; short capital codes need capitals', () => {
  assert.deepEqual(marks('text context next extra turnout dropship'), []);
  assert.deepEqual(marks('ct dt tc'), [], 'lower-case two-letter codes are ordinary notes');
  assert.deepEqual(marks('a*b 2*3 IL*'), [], 'a star inside or after a word is not a drop mark');
  assert.deepEqual(marks('ext*'), [['extend', 'ext']], 'a trailing star does not stop the word before it');
  assert.deepEqual(marks('N/U U/T'), [], 'other slash codes are not marks');
  assert.deepEqual(marks(''), []);
  assert.deepEqual(marks(null), []);
});

// Why: a mark that runs across a line break would break the per-line repaint and shade the wrong row in the mirror.
test('flowMarkTokens: a mark never crosses a line break, and tokens are in order with no overlap', () => {
  assert.deepEqual(marks('no\nanswer'), []);
  assert.deepEqual(marks('no \t answer'), [['drop', 'no \t answer']]);
  const t = 'ext ext\n*dropped conc\nO/W';
  const ks = L.flowMarkTokens(t);
  for (let i = 0; i < ks.length; i++) {
    assert.ok(!t.slice(ks[i].start, ks[i].end).includes('\n'));
    if (i) assert.ok(ks[i].start >= ks[i - 1].end);
  }
});

// Why: the mirror must hold exactly the textarea's characters; one extra or missing character shifts every shade after it, and raw "<" would inject markup.
test('flowMarkHtml: same text as the input once the tags are taken out, and HTML is escaped', () => {
  const t = 'a <b>&amp; ext "q" \'s\' *IL  two  spaces';
  const html = L.flowMarkHtml(t);
  assert.ok(!html.includes('<b>'));
  const back = html.replace(/<span class="fm-[a-z]+">|<\/span>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  assert.equal(back, t);
  assert.equal(L.flowMarkHtml('ext'), '<span class="fm-extend">ext</span>');
  assert.ok(L.FLOW_MARK_KINDS.every((k) => k.kind && k.label && k.tokens.length), 'every kind has a label and tokens for the legend');
});

// Why: a wrong changed-line range leaves stale shades on the screen or repaints the whole column on every keystroke.
test('flowLinesChanged: the smallest changed range for typing, a new line, a deleted line and a paste', () => {
  assert.deepEqual(L.flowLinesChanged(['a', 'b', 'c'], ['a', 'bx', 'c']), { from: 1, oldTo: 2, newTo: 2 });
  assert.deepEqual(L.flowLinesChanged(['a', 'b'], ['a', 'b', '']), { from: 2, oldTo: 2, newTo: 3 });
  assert.deepEqual(L.flowLinesChanged(['a', 'b', 'c'], ['a', 'c']), { from: 1, oldTo: 2, newTo: 1 });
  assert.deepEqual(L.flowLinesChanged(['a'], ['x', 'y', 'a']), { from: 0, oldTo: 0, newTo: 2 });
  assert.deepEqual(L.flowLinesChanged(['a', 'a'], ['a', 'a']), { from: 2, oldTo: 2, newTo: 2 });
  assert.deepEqual(L.flowLinesChanged(['a', 'a'], ['a', 'a', 'a']), { from: 2, oldTo: 2, newTo: 3 }, 'repeated lines still give a valid range');
});

// Why: a keystroke in a long column must not wait on a full repaint; slow typing on the flow loses arguments during a fast speech.
test('flowMarkHtml + flowLinesChanged: one keystroke in a 4,000-line column touches one line', () => {
  const lines = Array.from({ length: 4000 }, (_, i) => '#' + i + ' ext L/T: plan saves $ b/c conc *dropped 1AR O/W');
  const next = lines.slice(); next[2000] += 'x';
  const d = L.flowLinesChanged(lines, next);
  assert.deepEqual([d.from, d.oldTo, d.newTo], [2000, 2001, 2001]);
  const t0 = Date.now();
  for (let i = 0; i < 100; i++) L.flowMarkHtml(next[2000]);
  assert.ok(Date.now() - t0 < 200, 'painting one line is cheap');
});
