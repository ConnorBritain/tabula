// Run with: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('./logic.js');

const good = () => ({
  winner: 'aff',
  pts: { '1A': 28.5, '2A': 28.7, '1N': 28.2, '2N': 28.4 },
  ranks: { '1A': 2, '2A': 1, '1N': 4, '2N': 3 },
  rfd: 'Aff wins on solvency.',
});

// Why: a wrong speech order or time makes the judge cut debaters off early or late in a real round.
test('format matches NSDA 8-3-5 policy order', () => {
  assert.deepEqual(L.SPEECHES.map((s) => s.id),
    ['1AC', 'CX-1A', '1NC', 'CX-1N', '2AC', 'CX-2A', '2NC', 'CX-2N', '1NR', '1AR', '2NR', '2AR']);
  assert.deepEqual(L.SPEECHES.map((s) => s.minutes), [8, 3, 8, 3, 8, 3, 8, 3, 5, 5, 5, 5]);
  assert.equal(L.DEFAULT_PREP_SECONDS, 480);
});

// Why: the judge reads the clock at a glance; a bad format shows the wrong time left.
test('clock shows m:ss and marks overtime', () => {
  assert.equal(L.formatClock(480), '8:00');
  assert.equal(L.formatClock(65), '1:05');
  assert.equal(L.formatClock(0), '0:00');
  assert.equal(L.formatClock(-7), '-0:07');
});

// Why: a complete ballot must not show false alarms, or the judge learns to ignore warnings.
test('a complete, consistent ballot has no issues', () => {
  assert.deepEqual(L.checkBallot(good()), []);
});

// Why: tab rooms reject or question low-point wins; the judge must see it before submitting.
test('flags a low-point win', () => {
  const b = good(); b.winner = 'neg';
  assert.ok(L.checkBallot(b).some((m) => m.startsWith('Low-point win')));
});

// Why: duplicate ranks or ranks that disagree with points get the ballot sent back.
test('flags bad ranks and rank/point mismatch', () => {
  const dup = good(); dup.ranks['1N'] = 1;
  assert.ok(L.checkBallot(dup).some((m) => m.includes('1, 2, 3 and 4')));
  const flip = good(); flip.ranks = { '1A': 1, '2A': 2, '1N': 4, '2N': 3 };
  assert.ok(L.checkBallot(flip).some((m) => m.includes('1A ranks above 2A')));
});

// Why: missing winner, points or RFD means an incomplete ballot reaches the tab room.
test('flags missing winner, points, out-of-range points and empty RFD', () => {
  const issues = L.checkBallot({ pts: { '1A': 31 }, ranks: {}, rfd: ' ' });
  assert.ok(issues.includes('Pick a winner.'));
  // CHANGED 2026-11-20 because the owner's spec 4.7 sets the out-of-range message to "1A has 31, outside 25–30.".
  // Old check: assert.ok(issues.some((m) => m.startsWith('1A points (31)')));
  assert.ok(issues.includes('1A has 31, outside 25–30.'));
  assert.ok(issues.includes('Give 2N speaker points.'));
  assert.ok(issues.some((m) => m.includes('RFD')));
});

// Why: an RFD with commas or line breaks would split into wrong cells in Sheets or CSV.
test('CSV quotes and TSV flattens risky text', () => {
  assert.equal(L.toCSV([['a,b', 'say "hi"', 'x\ny']]), '"a,b","say ""hi""","x\ny"');
  assert.equal(L.toTSV([['a\tb', 'line1\nline2']]), 'a b\tline1 line2');
});

// Why: the Sheets row must line up with the header, or results land in the wrong columns.
test('ballot row lines up with the header', () => {
  const round = {
    tournament: 'T', roundName: 'R1', judge: 'J', topic: 'Res',
    aff: { team: 'AFF A', d1: 'Ann', d2: 'Bo' }, neg: { team: 'NEG B', d1: 'Cy', d2: 'Di' },
    ballot: good(),
  };
  const row = L.ballotRow(round, 'now');
  assert.equal(row.length, L.BALLOT_HEADER.length);
  assert.equal(row[L.BALLOT_HEADER.indexOf('Winning team')], 'AFF A');
  assert.equal(row[L.BALLOT_HEADER.indexOf('2N pts')], 28.4);
});

// Why: "Use as RFD" picks the winner from this line; a miss would leave the wrong team checked.
test('parses the AI decision line', () => {
  assert.equal(L.parseDecision('DECISION: NEG\nRFD: ...'), 'neg');
  assert.equal(L.parseDecision('**DECISION:** AFF'), 'aff');
  assert.equal(L.parseDecision('no verdict here'), null);
});

// Why: the AI can only judge what the prompt holds; dropped flow or transcripts give a blind decision.
test('judge prompt includes transcripts, flow and paradigm', () => {
  const round = {
    topic: 'Res', aff: { team: 'A' }, neg: { team: 'N' },
    transcripts: { '1AC': 'plan text', '2NR': 'extend the DA' },
    flows: [{ name: 'DA 1', cells: { 1: 'Link: spending', 5: 'DA outweighs' } }],
    ai: { paradigm: 'lay', evidence: 'card text' },
  };
  const p = L.buildJudgePrompt(round);
  for (const s of ['plan text', 'extend the DA', 'Sheet: DA 1', 'Link: spending', '[2NR]', 'stock issues', 'card text']) {
    assert.ok(p.includes(s), 'missing: ' + s);
  }
});

// Why: a swapped CX pairing sends the wrong debater up to ask questions in a real round.
test('CX periods name the right questioner and the speech being examined', () => {
  const cx = L.SPEECHES.filter((s) => s.id.startsWith('CX-'));
  assert.deepEqual(cx.map((s) => [s.id, s.speaker, s.side, s.label]), [
    ['CX-1A', '1A', 'aff', 'CX of 1A (2N asks)'],
    ['CX-1N', '1N', 'neg', 'CX of 1N (1A asks)'],
    ['CX-2A', '2A', 'aff', 'CX of 2A (1N asks)'],
    ['CX-2N', '2N', 'neg', 'CX of 2N (2A asks)'],
  ]);
  assert.deepEqual(L.SPEECHES.map((s) => s.side),
    ['aff', 'aff', 'neg', 'neg', 'aff', 'aff', 'neg', 'neg', 'neg', 'aff', 'neg', 'aff']);
});

// Why: if flow columns shift, the judge writes the 2NR in the 2AR column and the AI reads the wrong speech.
test('flow columns follow speech order with the 2NC/1NR block shared', () => {
  assert.deepEqual(L.FLOW_COLUMNS.map((c) => c.label + ':' + c.side),
    ['1AC:aff', '1NC:neg', '2AC:aff', 'Block (2NC / 1NR):neg', '1AR:aff', '2NR:neg', '2AR:aff']);
});

// Why: a string sort passes bad ranks like 1.5 or 10, so a wrong ballot reaches the tab room.
test('rank check rejects non-integer and out-of-range ranks', () => {
  const half = good(); half.ranks = { '1A': 1.5, '2A': 1, '1N': 4, '2N': 3 };
  assert.ok(L.checkBallot(half).some((m) => m.includes('1, 2, 3 and 4')));
  const ten = good(); ten.ranks = { '1A': 10, '2A': 1, '1N': 4, '2N': 3 };
  assert.ok(L.checkBallot(ten).some((m) => m.includes('1, 2, 3 and 4')));
});

// Why: "-0:00" on the clock looks like overtime when the speech has time left.
test('clock does not show a minus sign for less than one second over', () => {
  assert.equal(L.formatClock(-0.5), '0:00');
});

// Why: an RFD that starts with "-" or "=" turns into a formula error when pasted into Sheets.
test('Sheets output keeps text that looks like a formula as text', () => {
  assert.equal(L.toTSV([['- dropped T', '=1+1', 28.5]]), "'- dropped T\t'=1+1\t28.5");
  assert.equal(L.toCSV([['@x']]), "'@x");
});

// Why: "Use as RFD" fills the ballot; a bad parse pastes clash notes or nothing into the RFD.
test('pulls only the RFD section from an AI draft', () => {
  const t = 'DECISION: AFF\nCONFIDENCE: high\nRFD: Aff wins solvency.\nThe DA has no link.\nKEY CLASH: DA - aff';
  assert.equal(L.parseRfd(t), 'Aff wins solvency.\nThe DA has no link.');
  assert.equal(L.parseRfd('no headings'), 'no headings');
});

// Why: the Log table must show the named columns even if the header order changes later.
test('log columns map to the named header fields', () => {
  assert.deepEqual(L.LOG_COLUMNS.map((i) => L.BALLOT_HEADER[i]),
    ['Saved at', 'Round', 'Aff team', 'Neg team', 'Winner', '1A pts', '2A pts', '1N pts', '2N pts']);
});

// Why: if a speech maps to the wrong flow column, the AI writes the 2AR's answers under the 2NR.
test('each speech feeds the right flow column; CX feeds none', () => {
  assert.equal(L.speechColumn('1AC'), 0);
  assert.equal(L.speechColumn('2NC'), 3);
  assert.equal(L.speechColumn('1NR'), 3);
  assert.equal(L.speechColumn('2AR'), 6);
  assert.equal(L.speechColumn('CX-1A'), null);
});

// Why: Claude re-flows the whole speech each time; appending would double every argument.
test('a live flow update replaces this speech\'s notes and keeps other speeches', () => {
  let f = L.applyLiveFlow([], '1NC', { sheets: [{ sheet: 'DA - Econ', notes: '1. Uniq' }, { sheet: 'Case', notes: '1. No solv' }] });
  f = L.applyLiveFlow(f, '1NC', { sheets: [{ sheet: 'da - econ', notes: '1. Uniq\n2. Link' }] });
  const da = f.find((s) => s.name === 'DA - Econ');
  // Shape changed: notes now hold three detail levels; an old single-notes reply fills all three.
  assert.deepEqual(da.parts['1NC'], { brief: '1. Uniq\n2. Link', standard: '1. Uniq\n2. Link', detailed: '1. Uniq\n2. Link' });
  assert.equal(f.find((s) => s.name === 'Case'), undefined, 'sheet the speech no longer touches is dropped when empty');
  f = L.applyLiveFlow(f, '2AC', { sheets: [{ sheet: 'DA - Econ', notes: '1. N/U' }] });
  assert.deepEqual(f.find((s) => s.name === 'DA - Econ').parts['1NC'], { brief: '1. Uniq\n2. Link', standard: '1. Uniq\n2. Link', detailed: '1. Uniq\n2. Link' });
});

// Why: the 1NR must not wipe the 2NC in the shared block column, or the judge loses half the block.
test('block column shows both 2NC and 1NR notes', () => {
  const sheet = { name: 'K', parts: { '2NC': 'Alt solves', '1NR': 'Perm fails' } };
  assert.equal(L.aiFlowCell(sheet, 3), '2NC:\nAlt solves\n\n1NR:\nPerm fails');
  assert.equal(L.aiFlowCell({ parts: { '2NC': 'Alt solves' } }, 3), 'Alt solves');
});

// Why: the model must see the speech so far and the prior flow, or it repeats or misplaces arguments.
test('live flow prompt has the prior flow, not the current speech\'s old notes, plus the transcript', () => {
  const round = {
    topic: 'Res',
    transcripts: { '2AC': 'no link they say' },
    aiFlows: [{ name: 'DA - Econ', parts: { '1NC': 'Link: spending', '2AC': 'OLD NOTES' } }],
  };
  const p = L.buildLiveFlowPrompt(round, '2AC');
  assert.ok(p.includes('Link: spending'));
  assert.ok(!p.includes('OLD NOTES'));
  assert.ok(p.includes('no link they say'));
  assert.ok(p.includes('CURRENT SPEECH: 2AC (AFF)'));
});

// Why: the speech model only reads a short prompt; a long one drops the debate vocabulary hint.
test('transcription prompt keeps the vocabulary and only a short tail', () => {
  const p = L.buildTranscribePrompt('x'.repeat(5000) + ' END');
  assert.ok(p.startsWith(L.TRANSCRIBE_HINT));
  assert.ok(p.endsWith(' END'));
  assert.ok(p.length < L.TRANSCRIBE_HINT.length + 310);
  assert.equal(L.appendChunk('a', '  '), 'a');
  assert.equal(L.appendChunk('', ' b '), 'b');
});

// Why: the final decision should see the AI flow too, labeled as less reliable than the judge's flow.
test('judge prompt includes the AI flow, labeled', () => {
  const p = L.buildJudgePrompt({ aff: {}, neg: {}, aiFlows: [{ name: 'CP - States', parts: { '1NC': 'Text: 50 states' } }] });
  assert.ok(p.includes('AI FLOW'));
  assert.ok(p.includes('CP - States'));
  assert.ok(p.includes('Text: 50 states'));
});

// Why: if the tail is cut wrong, the speech model loses the words right before the clip and misspells names.
test('transcription prompt tail is exactly the last 300 characters', () => {
  const prev = 'a'.repeat(400) + 'b'.repeat(300);
  assert.equal(L.buildTranscribePrompt(prev), L.TRANSCRIBE_HINT + ' ' + 'b'.repeat(300));
  assert.equal(L.buildTranscribePrompt(''), L.TRANSCRIBE_HINT);
});

// Why: on the first speech the model must be told the flow is empty, not handed stale notes.
test('live flow prompt says when nothing is flowed yet', () => {
  const p = L.buildLiveFlowPrompt({ topic: 'Res', transcripts: { '1AC': 'plan' }, aiFlows: [] }, '1AC');
  assert.ok(p.includes('(nothing yet)'));
});

// Why: while the 1NR is flowed, the 2NC notes in the shared block must stay visible, and the 1NR's own old notes must not.
test('live flow prompt in the block shows the 2NC but hides the 1NR\'s old notes', () => {
  const round = {
    transcripts: { '1NR': 'perm fails' },
    aiFlows: [{ name: 'K - Cap', parts: { '2NC': 'Alt solves', '1NR': 'STALE 1NR' } }],
  };
  const p = L.buildLiveFlowPrompt(round, '1NR');
  assert.ok(p.includes('Alt solves'));
  assert.ok(!p.includes('STALE 1NR'));
});

// Why: if PDFs are sent in the wrong shape, Claude rejects the request and the judge gets no flow or decision.
test('round docs become PDF document blocks or text blocks, with one cache mark at the end', () => {
  const blocks = L.buildDocBlocks([
    { name: 'THE aff.pdf', side: 'aff', kind: 'pdf', data: 'QUJD' },
    { name: '1NC.docx', side: 'neg', kind: 'text', data: 'T - Substantial' },
    { name: 'empty', side: 'neg', kind: 'text', data: '' },
  ]);
  assert.equal(blocks.length, 2);
  assert.deepEqual(blocks[0], { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: 'QUJD' }, title: 'AFF doc for 1AC: THE aff.pdf' }); // title now names the speech the doc maps to
  assert.equal(blocks[1].type, 'text');
  assert.ok(blocks[1].text.startsWith('=== NEG doc for 1NC: 1NC.docx ===\nT - Substantial'));
  assert.deepEqual(blocks[1].cache_control, { type: 'ephemeral' });
  assert.equal(blocks[0].cache_control, undefined);
});

// Why: with no docs the request must stay a plain prompt; with docs, Claude must be told unread cards do not count.
test('user content is plain text without docs and docs-then-prompt with them', () => {
  assert.equal(L.buildUserContent([], 'PROMPT'), 'PROMPT');
  const c = L.buildUserContent([{ name: 'a', side: 'aff', kind: 'text', data: 'x' }], 'PROMPT');
  assert.equal(c.length, 2);
  assert.ok(c[1].text.includes('does not count'));
  assert.ok(c[1].text.endsWith('PROMPT'));
});

// Why: one Claude call must fill all three levels, or switching views shows stale or empty notes.
test('a live flow update stores brief, standard and detailed notes separately', () => {
  const f = L.applyLiveFlow([], '2AC', { sheets: [{ sheet: 'DA - Econ', brief: 'No link', standard: '1. No link - Smith 24', detailed: '1. No link - Smith 24: plan is cheap, answers 1NC link' }] });
  const sh = f[0];
  assert.equal(L.aiFlowCell(sh, 2, 'brief'), 'No link');
  assert.equal(L.aiFlowCell(sh, 2, 'standard'), '1. No link - Smith 24');
  assert.equal(L.aiFlowCell(sh, 2, 'detailed'), '1. No link - Smith 24: plan is cheap, answers 1NC link');
});

// Why: a round already in progress saved plain-string notes; after the update they must still show.
test('old plain-string notes still show at every level', () => {
  const sh = { name: 'Case', parts: { '1AC': 'Plan: fund X' } };
  for (const lv of L.FLOW_LEVELS) assert.equal(L.aiFlowCell(sh, 0, lv), 'Plan: fund X');
});

// Why: the schema must force all three levels, or Claude may skip the detailed view.
test('live flow schema requires all three levels', () => {
  assert.deepEqual(L.LIVE_FLOW_SCHEMA.properties.sheets.items.required, ['sheet', 'brief', 'standard', 'detailed']);
});

// Why: the decision should read the most detailed AI flow; the live prompt should stay compact.
test('decision uses detailed notes and the live prompt uses standard notes', () => {
  const aiFlows = [{ name: 'K', parts: { '1NC': { brief: 'BRIEF', standard: 'STANDARD', detailed: 'DETAILED' } } }];
  assert.ok(L.buildJudgePrompt({ aff: {}, neg: {}, aiFlows }).includes('DETAILED'));
  const live = L.buildLiveFlowPrompt({ transcripts: { '2AC': 'x' }, aiFlows }, '2AC');
  assert.ok(live.includes('STANDARD') && !live.includes('DETAILED'));
});

// Why: Tabroom has one comment box per team; mixing Neg advice into the Aff box sends it to the wrong students.
test('AI feedback splits into Aff (1A/2A) and Neg (1N/2N) comments', () => {
  const t = 'RFD: x\nFEEDBACK:\n1A: Clear 1AC.\nKeep it up.\n**2A** — answer the perm.\n- 1N: Good shell.\n2N: Extend the link.\nSUGGESTED POINTS: 1A 28.5';
  const fb = L.parseFeedback(t);
  assert.equal(fb.aff, '1A: Clear 1AC.\nKeep it up.\n**2A** — answer the perm.');
  assert.equal(fb.neg, '- 1N: Good shell.\n2N: Extend the link.');
  assert.deepEqual(L.parseFeedback('no feedback here'), { aff: '', neg: '' });
});

// Why: a bad WAV header makes OpenAI reject every clip, so nothing is transcribed.
test('WAV encoder writes a valid 16-bit mono header and clamps samples', () => {
  const buf = L.encodeWav(new Float32Array([0, 1, -1, 2]), 16000);
  const v = new DataView(buf);
  const tag = (o) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
  assert.equal(buf.byteLength, 44 + 8);
  assert.equal(tag(0), 'RIFF'); assert.equal(tag(8), 'WAVE'); assert.equal(tag(36), 'data');
  assert.equal(v.getUint16(22, true), 1);
  assert.equal(v.getUint32(24, true), 16000);
  assert.equal(v.getUint16(34, true), 16);
  assert.equal(v.getInt16(46, true), 32767);
  assert.equal(v.getInt16(48, true), -32768);
  assert.equal(v.getInt16(50, true), 32767, 'values above 1 are clamped, not wrapped');
});

// Why: the 1-second overlap must not print the same words twice in the transcript.
test('overlap merge drops words repeated at the clip boundary', () => {
  assert.equal(L.mergeOverlap('the plan solves warming', 'Solves warming. Next, the disad'), 'Next, the disad');
  assert.equal(L.mergeOverlap('extend the link', 'impact turns the case'), 'impact turns the case');
  assert.equal(L.mergeOverlap('', 'first words'), 'first words');
  assert.equal(L.mergeOverlap('one two', 'two three'), 'two three', 'a single shared word is too weak a match to drop');
});

// Why: silent clips make the speech model invent words; they must be detectable.
test('loudness is near zero for silence and higher for sound', () => {
  assert.equal(L.rms(new Float32Array(100)), 0);
  assert.ok(Math.abs(L.rms(new Float32Array([0.5, -0.5])) - 0.5) < 1e-9);
});

// Why: docs must land on the right speech, or the 1NC's off-case shows up in the 1AC column.
test('docs map to a speech: picked speech first, else Aff to 1AC and Neg to 1NC', () => {
  assert.equal(L.docSpeech({ side: 'aff' }), '1AC');
  assert.equal(L.docSpeech({ side: 'neg' }), '1NC');
  assert.equal(L.docSpeech({ side: 'other' }), '');
  assert.equal(L.docSpeech({ side: 'neg', speech: '2NC' }), '2NC');
  assert.equal(L.docSpeech({ side: 'aff', speech: '' }), '', 'an explicit "no speech" choice is kept');
});

// Why: when the transcript is thin, Claude must know which docs belong to this speech so it can flow from them.
test('live flow prompt lists only this speech\'s docs', () => {
  const docs = [{ name: 'THE aff.pdf', side: 'aff' }, { name: 'neg 1NC.docx', side: 'neg' }, { name: '2AC blocks', side: 'aff', speech: '2AC' }];
  const p1 = L.buildLiveFlowPrompt({ transcripts: {}, aiFlows: [] }, '1AC', docs);
  assert.ok(p1.includes('DOCUMENTS FOR THIS SPEECH: THE aff.pdf'));
  assert.ok(!p1.includes('neg 1NC.docx'));
  const p2 = L.buildLiveFlowPrompt({ transcripts: {}, aiFlows: [] }, '1AR', docs);
  assert.ok(p2.includes('DOCUMENTS FOR THIS SPEECH: (none)'));
});

// Why: the flow call must tell Claude to fill gaps from docs and mark them; the decision call must still say unread cards do not count.
test('flow calls use the doc-fill note; the decision keeps the unread-cards rule', () => {
  const docs = [{ name: 'a', side: 'aff', kind: 'text', data: 'x' }];
  const flow = L.buildUserContent(docs, 'P', L.DOC_FLOW_NOTE);
  assert.ok(flow[1].text.includes('[doc]'));
  const decision = L.buildUserContent(docs, 'P');
  assert.ok(decision[1].text.includes('does not count'));
  assert.ok(L.LIVE_FLOW_SYSTEM.includes('[doc]'));
});

// Why: the eval must know where the round is, or it judges the 1AC as if the whole round were over.
test('speeches so far come from transcripts, used clock time or AI flow notes; next speech follows the last one', () => {
  const round = {
    transcripts: { '1AC': 'plan' },
    timeLeft: { 'CX-1A': 100, '1NC': 480 },
    aiFlows: [{ name: 'DA', parts: { '1NC': { standard: 'link' } } }],
  };
  assert.deepEqual(L.speechesSoFar(round), ['1AC', 'CX-1A', '1NC']);
  assert.equal(L.nextSpeech(round), 'CX-1N');
  assert.equal(L.nextSpeech({}), '1AC');
  assert.equal(L.nextSpeech({ transcripts: { '2AR': 'vote aff' } }), null);
});

// Why: the eval prompt must say what has happened and what comes next, and still carry the flow and transcripts.
test('eval prompt names the speeches so far, the next speech, and includes the round data', () => {
  const p = L.buildEvalPrompt({ aff: {}, neg: {}, transcripts: { '1AC': 'we affirm' } });
  assert.ok(p.includes('SPEECHES SO FAR: 1AC'));
  assert.ok(p.includes('NEXT SPEECH: CX-1A'));
  assert.ok(p.includes('we affirm'));
});

// Why: the Live Eval tab draws these fields; a missing one leaves a blank section mid-round.
test('eval schema requires leaning, issues, watch list, needs and per-debater feedback', () => {
  assert.deepEqual(L.EVAL_SCHEMA.required, ['leaning', 'summary', 'key_issues', 'watch_for', 'aff_needs', 'neg_needs', 'feedback']);
  assert.deepEqual(L.EVAL_SCHEMA.properties.leaning.properties.side.enum, ['aff', 'neg', 'toss-up']);
  assert.deepEqual(L.EVAL_SCHEMA.properties.feedback.items.properties.speaker.enum, ['1A', '2A', '1N', '2N']);
});

// Why: points bunched within a few tenths tell debaters nothing; the judge should be nudged to spread them.
test('ballot warns when all four speakers are within 0.4 points', () => {
  const b = good(); b.pts = { '1A': 28.5, '2A': 28.6, '1N': 28.4, '2N': 28.5 };
  b.ranks = { '1A': 2, '2A': 1, '1N': 4, '2N': 3 };
  assert.ok(L.checkBallot(b).some((m) => m.includes('within 0.4')));
  assert.ok(!L.checkBallot(good()).some((m) => m.includes('within 0.4')), 'a 0.5 spread is fine');
});

// Why: the AI must be told to use the full point range, or it keeps suggesting 28.3 / 28.4 / 28.5 for everyone.
test('AI decision and Live Eval both carry the wide point scale', () => {
  assert.ok(L.JUDGE_SYSTEM.includes(L.POINTS_GUIDE));
  assert.ok(L.POINTS_GUIDE.includes('1.0 or more apart'));
  assert.ok(L.buildEvalPrompt({ aff: {}, neg: {} }).includes(L.POINTS_GUIDE));
});

// Why: with no transcript, the speech doc is usually the speech; the decision must not treat that speech as missing.
test('judge prompt treats a speech doc as the speech when there is no transcript', () => {
  const docs = [{ name: '2AC.docx', side: 'aff', speech: '2AC' }];
  const p = L.buildJudgePrompt({ aff: {}, neg: {}, transcripts: { '1AC': 'plan' } }, docs);
  assert.ok(p.includes('--- 2AC (AFF, 2A) ---'));
  assert.ok(p.includes('Treat the speech doc as what was said: 2AC.docx'));
  const withTr = L.buildJudgePrompt({ aff: {}, neg: {}, transcripts: { '2AC': 'we said this' } }, docs);
  assert.ok(!withTr.includes('Treat the speech doc as what was said'), 'a real transcript wins');
  assert.ok(L.LIVE_FLOW_SYSTEM.includes('treat the documents as the speech'));
});

// Why: if the "no transcript means the doc is the speech" rule is lost, the decision treats doc-only speeches as empty.
test('decision note says the doc is the speech when there is no transcript, and how [doc?] is scored', () => {
  assert.ok(L.DOC_NOTE.includes('When a speech has no transcript, treat its speech doc as what was said'));
  assert.ok(L.DOC_NOTE.includes('do not score a [doc?] line unless the judge\'s own flow shows that argument'));
});

// Why: model text goes into the diagram; quotes or brackets in a label must not break the Mermaid code or inject syntax.
test('Mermaid builder escapes labels, colours by side, marks drops, and skips edges to unknown nodes', () => {
  const code = L.buildMermaid({
    nodes: [
      { id: 'a1', speech: '1AC', label: 'Adv 1 "Econ" [growth]', status: 'extended' },
      { id: 'n-1', speech: '1NC', label: 'Spending DA', status: 'dropped' },
      { id: 'a2', speech: '2AC', label: 'No link', status: 'answered' },
    ],
    edges: [
      { from: 'a2', to: 'n-1', kind: 'answers' },
      { from: 'zz', to: 'a1', kind: 'answers' },
      { from: 'a2', to: 'a1', kind: 'bogus' },
    ],
  });
  assert.ok(code.startsWith('flowchart RL'), 'right-to-left so arrows to earlier speeches put the 1AC on the left');
  assert.ok(code.includes('style S_1AC fill:transparent'), 'speech groups are neutral, so yellow only means dropped');
  assert.ok(code.includes('n_a1["Adv 1 \'Econ\' growth"]:::aff'));
  assert.ok(!/\[growth\]/.test(code), 'square brackets from labels are removed');
  assert.ok(code.includes('n_n_1["Spending DA (dropped)"]:::dropped'));
  assert.ok(code.includes('n_a2 -->|answers| n_n_1'));
  assert.ok(!code.includes('n_zz'), 'edges to unknown nodes are skipped');
  assert.equal((code.match(/-->|==>|-\.->/g) || []).length, 1, 'only the one valid edge is drawn');
  assert.ok(code.indexOf('S_1AC') < code.indexOf('S_1NC') && code.indexOf('S_1NC') < code.indexOf('S_2AC'), 'speeches in round order');
});

// Why: swapping to "My Tabroom paradigm" must weigh by the judge's own text, and a changed text must not reuse an old cached result.
test('custom paradigm uses the pasted text and gets its own cache key', () => {
  assert.ok(L.paradigmText('custom', 'I am a K hack.').includes('I am a K hack.'));
  assert.equal(L.paradigmText('custom', '  '), L.PARADIGMS.policymaker, 'empty custom text falls back');
  assert.equal(L.paradigmText('lay'), L.PARADIGMS.lay);
  assert.equal(L.lensKey('tech'), 'tech');
  assert.equal(L.lensKey('custom', 'abc'), L.lensKey('custom', ' abc '));
  assert.notEqual(L.lensKey('custom', 'abc'), L.lensKey('custom', 'abd'));
});

// Why: the lens must actually judge under the chosen paradigm, not the one picked for the main decision.
test('lens prompt overrides the round paradigm with the chosen one', () => {
  const round = { aff: {}, neg: {}, ai: { paradigm: 'lay' }, transcripts: { '1AC': 'plan' } };
  const p = L.buildAnalysisPrompt(round, [], L.LENS_TASK, { paradigm: L.paradigmText('critical') });
  assert.ok(p.includes(L.PARADIGMS.critical));
  assert.ok(!p.includes(L.PARADIGMS.lay));
  assert.ok(p.startsWith('SPEECHES SO FAR: 1AC'));
});

// Why: the Analysis tab draws these fields; a missing one leaves a hole in the table.
test('impact and lens schemas require the fields the tab shows', () => {
  assert.deepEqual(L.IMPACT_SCHEMA.required, ['impacts', 'weighing_done', 'comparison', 'net']);
  assert.deepEqual(L.IMPACT_SCHEMA.properties.impacts.items.required, ['impact', 'side', 'magnitude', 'probability', 'timeframe', 'reversibility', 'status', 'note']);
  assert.deepEqual(L.LENS_SCHEMA.required, ['winner', 'confidence', 'rfd', 'deciding_factors', 'lens_effect']);
  assert.deepEqual(L.MAP_SCHEMA.properties.edges.items.properties.kind.enum, ['answers', 'extends', 'turns', 'concedes']);
});

// Why: two arguments whose ids clean up to the same text must both appear, or one silently vanishes from the map.
test('Mermaid builder keeps nodes whose ids collide after cleaning, and edges go to the right one', () => {
  const code = L.buildMermaid({
    nodes: [
      { id: 'a-b', speech: '1AC', label: 'First', status: 'answered' },
      { id: 'a.b', speech: '1AC', label: 'Second', status: 'answered' },
      { id: 'x', speech: '1NC', label: 'Reply', status: 'open' },
    ],
    edges: [{ from: 'x', to: 'a.b', kind: 'answers' }],
  });
  assert.ok(code.includes('n_a_b["First"]'));
  assert.ok(code.includes('n_a_b_2["Second"]'));
  assert.ok(code.includes('n_x -->|answers| n_a_b_2'), 'the edge goes to the second node, not the first');
});

// Why: an odd edge kind from the model (like "constructor") must be ignored, not turned into broken diagram code.
test('Mermaid builder ignores edge kinds that are not real arrow types', () => {
  const nodes = [{ id: 'a', speech: '1AC', label: 'A', status: 'open' }, { id: 'b', speech: '1NC', label: 'B', status: 'open' }];
  for (const kind of ['constructor', '__proto__', 'toString']) {
    const code = L.buildMermaid({ nodes, edges: [{ from: 'b', to: 'a', kind }] });
    assert.ok(!code.includes('n_b '), kind + ' must not produce an edge');
  }
});

// Why: the flow-sheet map must keep each argument and its answers on one row, or the judge cannot see what answered what.
test('map layout groups an argument and its answers into one row, in speech columns', () => {
  const lay = L.layoutMap({
    nodes: [
      { id: 'a1', speech: '1AC', label: 'Adv 1 Econ', status: 'extended' },
      { id: 'n1', speech: '1NC', label: 'Spending DA', status: 'answered' },
      { id: 'n2', speech: '1NC', label: 'No solvency', status: 'answered' },
      { id: 'b1', speech: '2AC', label: 'No link', status: 'open' },
      { id: 'b2', speech: '2AC', label: 'Solvency ext', status: 'open' },
    ],
    edges: [
      { from: 'n2', to: 'a1', kind: 'answers' },
      { from: 'b2', to: 'n2', kind: 'extends' },
      { from: 'b1', to: 'n1', kind: 'answers' },
    ],
  }, ['1AC', 'CX-1A', '1NC', '2AC']);
  assert.deepEqual(lay.columns, ['1AC', '1NC', '2AC']);
  assert.equal(lay.rows.length, 2);
  const econ = lay.rows.find((r) => r.title === 'Adv 1 Econ');
  assert.equal(econ.side, 'aff');
  assert.deepEqual(Object.keys(econ.cells), ['1AC', '1NC', '2AC']);
  assert.equal(econ.cells['1NC'][0].kind, 'answers');
  assert.equal(econ.cells['2AC'][0].kind, 'extends');
  const da = lay.rows.find((r) => r.title === 'Spending DA');
  assert.equal(da.side, 'neg');
  assert.equal(da.cells['2AC'][0].label, 'No link');
});

// Why: a drop is the most important thing on a flow; the map must show the empty spot where the answer should be.
test('a dropped argument gets a "No answer" ghost in the next speech of the other side, only if that speech happened', () => {
  const map = { nodes: [{ id: 't', speech: '1NC', label: 'T - Substantial', status: 'dropped' }], edges: [] };
  const after = L.layoutMap(map, ['1AC', '1NC', '2AC']);
  assert.deepEqual(after.rows[0].cells['2AC'], [{ ghost: true, label: 'No answer', side: 'aff' }]);
  const before = L.layoutMap(map, ['1AC', '1NC']);
  assert.equal(before.rows[0].cells['2AC'], undefined, 'no ghost before the 2AC has happened');
});

// Why: bad model data (cycles, edges to missing nodes, odd kinds) must not hang the page or misplace cards.
test('map layout survives cycles, missing nodes and odd edge kinds', () => {
  const lay = L.layoutMap({
    nodes: [{ id: 'x', speech: '1AC', label: 'X', status: 'open' }, { id: 'y', speech: '1NC', label: 'Y', status: 'open' }, { id: 'z', speech: '9ZZ', label: 'bad speech', status: 'open' }],
    edges: [{ from: 'x', to: 'y', kind: 'answers' }, { from: 'y', to: 'x', kind: 'answers' }, { from: 'y', to: 'nope', kind: 'answers' }, { from: 'x', to: 'y', kind: 'constructor' }],
  }, []);
  const cards = lay.rows.flatMap((r) => Object.values(r.cells).flat());
  assert.equal(cards.length, 2, 'both real nodes placed once; the bad-speech node is dropped');
});

// Why: a loop in bad model data must stay on one row, titled by its earliest argument, not split into two rows.
test('map layout keeps a loop of answers on one row rooted at the earliest speech', () => {
  const lay = L.layoutMap({
    nodes: [{ id: 'b', speech: '1NC', label: 'Later', status: 'open' }, { id: 'a', speech: '1AC', label: 'Earlier', status: 'open' }],
    edges: [{ from: 'a', to: 'b', kind: 'answers' }, { from: 'b', to: 'a', kind: 'answers' }],
  }, []);
  assert.equal(lay.rows.length, 1);
  assert.equal(lay.rows[0].title, 'Earlier');
  assert.equal(lay.rows[0].side, 'aff');
});

// Why: the judge's own corrections must survive every AI update, or fixing the AI flow is pointless.
test('judge edits on the AI flow survive AI updates and win over AI notes', () => {
  let f = L.applyLiveFlow([], '1NC', { sheets: [{ sheet: 'DA', brief: 'b', standard: 'AI v1', detailed: 'd' }] });
  f[0].edits = { 1: { text: 'MY NOTES', base: 'AI v1' } };
  assert.equal(L.flowCellText(f[0], 1, 'standard'), 'MY NOTES');
  assert.equal(L.editIsBehind(f[0], 1), false);
  f = L.applyLiveFlow(f, '1NC', { sheets: [{ sheet: 'DA', brief: 'b', standard: 'AI v2', detailed: 'd' }] });
  assert.equal(L.flowCellText(f[0], 1, 'standard'), 'MY NOTES', 'the edit stays after the AI rewrites the speech');
  assert.equal(L.editIsBehind(f[0], 1), true, 'the judge is told the AI has something newer');
  const kept = L.applyLiveFlow([{ name: 'K', parts: {}, edits: { 0: { text: 'hand note', base: '' } } }], '1AC', { sheets: [] });
  assert.equal(kept.length, 1, 'a sheet with only judge edits is not dropped');
});

// Why: the AI must see the judge's corrections, and the decision must use them.
test('prompts use judge edits over AI notes', () => {
  const aiFlows = [{ name: 'DA', parts: { '1NC': { brief: 'b', standard: 'AI LINK', detailed: 'AI LINK D' } }, edits: { 1: { text: 'JUDGE LINK', base: 'AI LINK' } } }];
  const live = L.buildLiveFlowPrompt({ transcripts: { '2AC': 'x' }, aiFlows }, '2AC');
  assert.ok(live.includes('JUDGE LINK') && !live.includes('AI LINK'));
  const judge = L.buildJudgePrompt({ aff: {}, neg: {}, aiFlows });
  assert.ok(judge.includes('JUDGE LINK') && judge.includes('edited by the judge'));
});

// Why: a map the judge drew by hand must not be wiped when the AI redraws it.
test('map merge keeps the judge\'s nodes, edits and links, and respects links the judge deleted', () => {
  const old = {
    nodes: [{ id: 'u1', speech: '2AC', label: 'My perm', status: 'open', user: true }, { id: 'a1', speech: '1AC', label: 'Edited adv', status: 'extended', edited: true }, { id: 'n1', speech: '1NC', label: 'old AI', status: 'open' }],
    edges: [{ from: 'u1', to: 'n1', kind: 'answers', user: true }],
    removedEdges: ['n1>a1'],
  };
  const fresh = {
    nodes: [{ id: 'a1', speech: '1AC', label: 'AI adv', status: 'answered' }, { id: 'n1', speech: '1NC', label: 'new AI', status: 'answered' }],
    edges: [{ from: 'n1', to: 'a1', kind: 'answers' }],
  };
  const m = L.mergeMap(old, fresh);
  assert.equal(m.nodes.find((n) => n.id === 'a1').label, 'Edited adv', 'judge edit wins');
  assert.equal(m.nodes.find((n) => n.id === 'n1').label, 'new AI', 'AI updates its own nodes');
  assert.ok(m.nodes.some((n) => n.id === 'u1'), 'judge-made node kept');
  assert.ok(m.edges.some((e) => e.from === 'u1' && e.user), 'judge link kept');
  assert.ok(!m.edges.some((e) => e.from === 'n1' && e.to === 'a1'), 'a link the judge deleted is not brought back');
});

// Why: a card the judge deleted must not come back the next time the AI redraws the map.
test('map merge does not bring back cards the judge deleted', () => {
  const m = L.mergeMap({ nodes: [], edges: [], removedNodes: ['n9'] }, { nodes: [{ id: 'n9', speech: '1NC', label: 'gone', status: 'open' }, { id: 'n1', speech: '1NC', label: 'stays', status: 'open' }], edges: [] });
  assert.deepEqual(m.nodes.map((n) => n.id), ['n1']);
  assert.deepEqual(m.removedNodes, ['n9']);
});

// Why: the plain level exists so students and parents can read the feedback; it must say so, and keep the verdict.
test('reading levels: expert and plain guides, plain keeps the substance', () => {
  assert.deepEqual(Object.keys(L.READING_LEVELS), ['expert', 'plain']);
  assert.ok(L.readingGuide('plain').includes('Keep the same substance, verdict and points'));
  assert.ok(L.readingGuide('plain').includes('explain it in a few plain words'));
  assert.equal(L.readingGuide('nonsense'), L.READING_LEVELS.expert.guide, 'unknown level falls back to expert');
});

// Why: the AI ballot must never overwrite what the judge typed; the judge signs the ballot, not the AI.
test('ballot draft fills only fields the judge did not touch', () => {
  const ballot = { winner: 'neg', pts: { '1A': 28.9 }, ranks: {}, rfd: 'MY RFD', touched: { winner: true, 'pts.1A': true, rfd: true } };
  const draft = { winner: 'aff', points: { '1A': 27.04, '2A': 28.66, '1N': 29.1, '2N': 27.5 }, ranks: { '1A': 4, '2A': 2, '1N': 1, '2N': 3 }, rfd: 'AI RFD', aff_comments: 'AFF', neg_comments: 'NEG' };
  const b = L.applyBallotDraft(ballot, draft);
  assert.equal(b.winner, 'neg');
  assert.equal(b.pts['1A'], 28.9);
  assert.equal(b.rfd, 'MY RFD');
  assert.equal(b.pts['2A'], 28.7, 'points are rounded to one decimal');
  assert.equal(b.ranks['1N'], '1');
  assert.equal(b.affFb, 'AFF');
  assert.equal(ballot.pts['2A'], undefined, 'the original ballot object is not changed');
});

// Why: the judge's own direction must reach the AI, and hand-set fields must be named so the draft agrees with them.
test('ballot prompt carries the judge\'s input, the hand-set fields and the point scale', () => {
  const p = L.buildBallotPrompt({ aff: {}, neg: {}, ballot: { winner: 'aff', pts: { '2N': 29.2 }, touched: { winner: true, 'pts.2N': true } } }, [], '2N was the best speaker.');
  assert.ok(p.includes("THE JUDGE'S OWN INPUT"));
  assert.ok(p.includes('2N was the best speaker.'));
  assert.ok(p.includes('winner = aff') && p.includes('pts.2N = 29.2'));
  assert.ok(p.includes(L.POINTS_GUIDE));
  assert.deepEqual(L.BALLOT_SCHEMA.required, ['winner', 'confidence', 'points', 'ranks', 'rfd', 'aff_comments', 'neg_comments', 'points_reasoning']);
});

// Why: when the judge asks the AI to redo the ballot with a note like "I'm voting neg", the note must be able to change hand-set fields.
test('ballot draft with override may change hand-set fields', () => {
  const ballot = { winner: 'aff', rfd: 'old', pts: {}, ranks: {}, touched: { winner: true, rfd: true } };
  const b = L.applyBallotDraft(ballot, { winner: 'neg', rfd: 'new' }, { override: true });
  assert.equal(b.winner, 'neg');
  assert.equal(b.rfd, 'new');
  assert.equal(L.applyBallotDraft(ballot, { winner: 'neg' }).winner, 'aff', 'without override the lock holds');
});

// Why: the AI reuses short ids like "a1" on every redraw; a new, different argument must not merge into the judge's edited card.
test('map merge gives a colliding new AI card its own id and keeps the judge\'s card', () => {
  const old = { nodes: [{ id: 'a1', speech: '1AC', label: 'My adv', aiLabel: 'Adv 1', status: 'open', edited: true }], edges: [] };
  const fresh = { nodes: [{ id: 'a1', speech: '1NC', label: 'Spending DA', status: 'open' }, { id: 'b1', speech: '2AC', label: 'No link', status: 'open' }], edges: [{ from: 'b1', to: 'a1', kind: 'answers' }] };
  const m = L.mergeMap(old, fresh);
  assert.equal(m.nodes.find((n) => n.id === 'a1').label, 'My adv');
  const da = m.nodes.find((n) => n.label === 'Spending DA');
  assert.equal(da.id, 'a1_ai2');
  assert.ok(m.edges.some((e) => e.from === 'b1' && e.to === 'a1_ai2'), 'the answer points at the DA, not at the judge\'s card');
});

// Why: deleting an AI card must hide that argument, not every future card that happens to reuse its id.
test('a deleted card is matched by speech and text, not by a reused id', () => {
  const old = { nodes: [], edges: [], removedNodes: [{ id: 'n1', key: '1nc|t - substantial'.replace('1nc', '1NC') }] };
  const m = L.mergeMap(old, { nodes: [{ id: 'n1', speech: '1NC', label: 'Spending DA', status: 'open' }, { id: 'n2', speech: '1NC', label: 'T - Substantial', status: 'open' }], edges: [] });
  assert.deepEqual(m.nodes.map((n) => n.label), ['Spending DA']);
});

// Why: a backup must hold every saved round, ballot and doc, or the judge loses work when moving computers.
test('backup holds all app data and docs, and leaves out API keys unless asked', () => {
  const storage = {
    'policyJudge.round.v1': '{"roundName":"R4","tournament":"State"}',
    'policyJudge.log.v1': '[["a"],["b"]]',
    'policyJudge.settings.v1': '{}',
    'policyJudge.keys.v1': '{"google":"AIzaSECRET"}',
    'policyJudge.key': '"sk-ant-old"',
    'otherApp.thing': 'x',
  };
  const docs = [{ id: 'd1', name: 'aff.pdf', data: 'QUJD', kind: 'pdf', side: 'aff' }];
  const b = L.buildBackup(storage, docs, { now: 'T' });
  assert.deepEqual(Object.keys(b.storage).sort(), ['policyJudge.log.v1', 'policyJudge.round.v1', 'policyJudge.settings.v1']);
  assert.equal(b.includesKeys, false);
  assert.equal(b.docs.length, 1);
  const withKeys = L.buildBackup(storage, docs, { includeKeys: true });
  assert.ok(withKeys.storage['policyJudge.keys.v1'].includes('AIzaSECRET'));
  assert.ok(!('otherApp.thing' in withKeys.storage), 'only Tabula data is saved');
});

// Why: restoring must round-trip exactly, and a wrong file must be refused with a plain reason, not half-loaded.
test('backup round-trips and wrong files are refused', () => {
  const b = L.buildBackup({ 'policyJudge.round.v1': '{"roundName":"R4","tournament":"State"}', 'policyJudge.log.v1': '[[1],[2],[3]]' }, [{ id: 'd1', name: 'x.txt', data: 'hi' }]);
  const back = L.parseBackup(JSON.stringify(b));
  assert.deepEqual(back.storage, b.storage);
  assert.equal(back.docs.length, 1);
  assert.deepEqual(L.backupSummary(back), { round: 'State — R4', ballots: 3, docs: 1, keys: false });
  assert.throws(() => L.parseBackup('nope'), /not JSON/);
  assert.throws(() => L.parseBackup('{"app":"other"}'), /not a Tabula backup/);
  assert.throws(() => L.parseBackup(JSON.stringify({ ...b, version: 2 })), /newer version/);
  const sneaky = L.parseBackup(JSON.stringify({ ...b, storage: { ...b.storage, 'evil.key': 'x' }, docs: [{ id: 1 }] }));
  assert.ok(!('evil.key' in sneaky.storage), 'entries that are not Tabula data are ignored');
  assert.equal(sneaky.docs.length, 0, 'malformed docs are dropped');
});

// Why: a restored doc must come back byte for byte, or the AI reads a broken case file.
test('backup round-trip keeps document contents exactly', () => {
  const doc = { id: 'd1', roundId: 'r1', name: 'aff.pdf', side: 'aff', kind: 'pdf', data: 'JVBERi0xLjQK', speech: '1AC', addedAt: 5 };
  const back = L.parseBackup(JSON.stringify(L.buildBackup({}, [doc])));
  assert.deepEqual(back.docs[0], doc);
});

// Why: in a classroom the browser's echo and noise filters help; on Zoom through speakers they mute the speaker. The wrong setting loses words.
test('mic settings: filters on in the room, off for Zoom, and the chosen mic is used', () => {
  assert.deepEqual(L.micConstraints('room'), { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  assert.deepEqual(L.micConstraints('zoom', 'abc'), { audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, deviceId: { exact: 'abc' } } });
});

// Why: the meter and the mic test must tell a judge plainly when the laptop is too far away or the mic is wrong.
test('level meter and mic test give plain verdicts', () => {
  assert.equal(L.levelInfo(0).level, 'silent');
  assert.equal(L.levelInfo(0.008).level, 'quiet');
  assert.equal(L.levelInfo(0.05).level, 'good');
  assert.equal(L.levelInfo(0.8).level, 'loud');
  assert.ok(L.levelInfo(0.05).pct > L.levelInfo(0.008).pct, 'louder fills more of the meter');
  assert.equal(L.micTestVerdict([]).ok, false);
  assert.match(L.micTestVerdict(Array(20).fill(0.006)).text, /Too quiet/);
  assert.equal(L.micTestVerdict([0.001, 0.04, 0.06, 0.05, 0.07, 0.05, 0.04, 0.06, 0.05, 0.05]).ok, true);
});

// Why: a silent recorder must be noticed mid-speech, with advice that fits the room; wrong advice wastes the judge's time.
test('stall warning after 30 s without new text, worded for the room or for Zoom', () => {
  assert.equal(L.stallWarning({ startedAt: 1000, lastTextAt: 0, now: 25000, mode: 'room' }), '');
  assert.match(L.stallWarning({ startedAt: 1000, lastTextAt: 0, now: 40000, mode: 'room' }), /closer to the speaker/);
  assert.match(L.stallWarning({ startedAt: 1000, lastTextAt: 0, now: 40000, mode: 'zoom' }), /Zoom volume/);
  assert.equal(L.stallWarning({ startedAt: 1000, lastTextAt: 39000, now: 40000, mode: 'room' }), '', 'recent text means no warning');
  assert.equal(L.stallWarning({ startedAt: 0, now: 99999 }), '', 'not recording means no warning');
});

// Why: a judge who opens Tabula to an empty round should see "start or open a round", not a half-filled setup form; a used round must never be treated as empty.
test('isRoundEmpty is true only for a round nobody has touched', () => {
  const r = { tournament: '', roundName: '', aff: { team: '', d1: '', d2: '' }, neg: { team: '', d1: '', d2: '' }, transcripts: {}, aiFlows: [], flows: [{ name: 'Case', cells: {} }], timeLeft: {}, ballot: { winner: '' } };
  assert.equal(L.isRoundEmpty(r), true);
  assert.equal(L.isRoundEmpty({ ...r, aff: { team: 'Lake A', d1: '', d2: '' } }), false);
  assert.equal(L.isRoundEmpty({ ...r, transcripts: { '1AC': 'Thank you judge' } }), false);
  assert.equal(L.isRoundEmpty({ ...r, transcripts: { '1AC': '   ' } }), true);
  assert.equal(L.isRoundEmpty({ ...r, flows: [{ name: 'Case', cells: { '0:0': 'Adv 1' } }] }), false);
  assert.equal(L.isRoundEmpty({ ...r, timeLeft: { '1AC': 300 } }), false);
});

// Why: a .tab file is how a judge moves a round to another computer or reopens it later; anything lost or mixed up in the trip loses the flow.
test('a round survives the trip through a .tab file, with its docs, under a new id', () => {
  const round = { id: 'old', tournament: 'KS Open', roundName: 'R3', aff: { team: 'Lake AB' }, neg: { team: 'Hill CD' }, transcripts: { '1AC': 'words' }, flows: [{ name: 'Case', cells: { a: 'b' } }] };
  const docs = [{ id: 'd1', roundId: 'old', name: 'aff.pdf', data: 'QUJD' }, { id: 'd2', roundId: 'other', name: 'x.txt', data: 'x' }];
  const file = L.buildRoundFile(round, docs, '2026-11-19T00:00:00Z');
  assert.equal(file.docs.length, 1, 'only this round\'s docs go in the file');
  const back = L.parseRoundFile(JSON.stringify(file), 'new');
  assert.equal(back.round.id, 'new');
  assert.deepEqual(back.round.transcripts, round.transcripts);
  assert.deepEqual(back.round.flows, round.flows);
  assert.deepEqual(back.docs.map((d) => [d.id, d.roundId, d.name]), [['new:d1', 'new', 'aff.pdf']]);
  assert.equal(L.roundFileName(round), 'KS Open - R3 - Lake AB vs Hill CD.tab');
  assert.equal(L.roundFileName({ tournament: 'a/b:c' }), 'a b c.tab');
  assert.equal(L.roundFileName({}, '2026-11-19'), 'round 2026-11-19.tab');
});

// Why: opening the wrong file must fail with a plain reason, never replace the judge's round with garbage.
test('a wrong or damaged file is refused with a plain reason', () => {
  assert.throws(() => L.parseRoundFile('not json', 'n'), /not a Tabula round file/);
  assert.throws(() => L.parseRoundFile(JSON.stringify({ app: 'tabula', kind: 'backup' }), 'n'), /full backup/);
  assert.throws(() => L.parseRoundFile(JSON.stringify({ app: 'tabula', kind: 'tabula-round', version: 2, round: {} }), 'n'), /newer Tabula/);
  assert.throws(() => L.parseRoundFile(JSON.stringify({ app: 'tabula', kind: 'tabula-round', version: 1, round: { transcripts: {} } }), 'n'), /damaged/);
});

// Why: debaters are minors; their names must never reach an AI provider, but the judge must still read names in the AI's ballot comments.
test('names are swapped for positions in AI prompts and swapped back in replies', () => {
  const round = { aff: { team: 'Lake AB', d1: 'Ann Lee', d2: 'Bo' }, neg: { team: 'Hill CD', d1: 'Cy', d2: 'Dina Ruiz' } };
  const sent = L.anonymize('Ann said Lake AB wins; Lee extended. Dina Ruiz and Bo clashed. Cyprus is not Cy. annual review.', round);
  assert.equal(sent, '1A said the Aff team wins; 1A extended. 2N and 2A clashed. Cyprus is not 1N. annual review.');
  const p = L.buildJudgePrompt({ ...round, transcripts: { '1AC': 'x' } });
  for (const n of ['Ann', 'Lee', 'Bo ', 'Lake AB', 'Hill CD', 'Dina']) assert.ok(!p.includes(n), 'prompt leaks ' + n);
  const reply = L.deanonymize({ rfd: '1A and 2N were best; the Neg team dropped the DA. The 1AR was late.', pts: { '1A': 29 } }, round);
  assert.equal(reply.rfd, 'Ann Lee and Dina Ruiz were best; Hill CD dropped the DA. The 1AR was late.');
  assert.deepEqual(Object.keys(reply.pts), ['1A'], 'keys are not renamed');
  assert.equal(L.deanonymize('1A spoke', { aff: {}, neg: {} }), '1A spoke', 'no names set: nothing changes');
});

// Why: a debater named Will or Grace must not turn every "will" or "grace" in a speech into "1A"; that would garble the transcript the AI judges.
test('a name that is also a common word is swapped only where it is written as a name', () => {
  const round = { aff: { d1: 'Will', d2: 'Grace Park' }, neg: {} };
  assert.equal(L.anonymize('Will said we will win by the grace of the plan. WILL. Park.', round), '1A said we will win by the grace of the plan. 1A. 2A.');
});

// Why: a team name with "$" in it (or "$1") once came back garbled in the ballot; names must come back exactly as typed.
test('names with special characters come back exactly', () => {
  assert.equal(L.deanonymize('the Aff team won', { aff: { team: 'Cash $1 & Co' }, neg: {} }), 'Cash $1 & Co won');
  assert.equal(L.anonymize('A$AP said', { aff: { d1: 'A$AP' }, neg: {} }), '1A said');
});

// Why: a hand-edited or damaged .tab file must not put broken values into the app (a missing team or a text clock would crash the round on screen).
test('a .tab file with bad parts opens with only its good parts', () => {
  const file = { app: 'tabula', kind: 'tabula-round', version: 1, round: {
    transcripts: { '1AC': 'ok', '2AC': 7 }, flows: [{ name: 'Case', cells: { a: 'b' } }, 'junk'],
    aff: 'nope', neg: { team: 5, d1: 'Cy' }, timeLeft: { '1AC': 'x', '1NC': 120 }, prepLeft: { aff: 'x' }, cur: 'two', ballot: null,
  }, docs: [{ id: 'd', name: 'a.txt', data: 'hi' }, { id: 'e', name: 'b.txt' }, { id: 7, name: 'c', data: 'x' }] };
  const { round, docs } = L.parseRoundFile(JSON.stringify(file), 'N');
  assert.deepEqual(round.transcripts, { '1AC': 'ok' });
  assert.deepEqual(round.flows, [{ name: 'Case', cells: { a: 'b' } }]);
  assert.deepEqual(round.aff, { team: '', d1: '', d2: '' });
  assert.deepEqual(round.neg, { team: '', d1: 'Cy', d2: '' });
  assert.deepEqual(round.timeLeft, { '1NC': 120 });
  assert.equal(round.prepLeft, undefined);
  assert.equal(round.cur, undefined);
  assert.equal(round.ballot.winner, '');
  assert.deepEqual(docs.map((d) => d.id), ['N:d']);
});

// Why: a .tab file is untrusted input; a "__proto__" key must not change how the app's objects behave.
test('a .tab file cannot slip in a prototype key', () => {
  const text = '{"app":"tabula","kind":"tabula-round","version":1,"round":{"transcripts":{},"flows":[],"__proto__":{"polluted":true},"extra":1}}';
  const { round } = L.parseRoundFile(text, 'N');
  assert.equal(round.polluted, undefined);
  assert.equal({}.polluted, undefined);
  assert.equal(Object.getPrototypeOf(round), Object.prototype);
  assert.equal(round.extra, 1, 'unknown plain fields are kept');
});

// Why: judges paste whatever SpeechDrop shows them (a code or the full link); a wrong code fetches nothing, and a sloppy one could reach another address.
test('reads a SpeechDrop room code from a code or a link, and nothing else', () => {
  assert.equal(L.parseSpeechDropCode('abc123'), 'abc123');
  assert.equal(L.parseSpeechDropCode('  https://speechdrop.net/Ab-9_x/  '), 'Ab-9_x');
  assert.equal(L.parseSpeechDropCode('speechdrop.net/abc123?x=1'), 'abc123');
  assert.equal(L.parseSpeechDropCode('https://evil.example/abc123'), '');
  assert.equal(L.parseSpeechDropCode('abc/../x'), '');
  assert.equal(L.parseSpeechDropCode(''), '');
});

// Why: SpeechDrop keeps an empty slot for each deleted file; the slot number is how a file is fetched, so skipping a slot must not shift the others.
test('reads the room file list and keeps each file at its slot', () => {
  assert.deepEqual(L.speechDropFiles([{ name: '1AC.docx', ctime: 5 }, null, { name: '1NC.pdf', ctime: 9 }, { bad: 1 }]), [
    { i: 0, name: '1AC.docx', ctime: 5 }, { i: 2, name: '1NC.pdf', ctime: 9 }]);
  assert.deepEqual(L.speechDropFiles('nope'), []);
});

// Why: a doc mapped to the wrong speech puts arguments in the wrong flow column; when unsure the guess must be "context only", not a wrong speech.
test('guesses the speech from the file name, or leaves it as context', () => {
  assert.equal(L.guessSpeech('Lake AB 1NC v2.docx'), '1NC');
  assert.equal(L.guessSpeech('2ac-blocks.pdf'), '2AC');
  assert.equal(L.guessSpeech('Hill CD 1 AR.docx'), '1AR');
  assert.equal(L.guessSpeech('Neg block.docx'), '2NC');
  assert.equal(L.guessSpeech('Healthcare aff.docx'), '');
  assert.equal(L.guessSpeech('1ACT test prep.pdf'), '', 'not a speech name');
  assert.equal(L.speechSide('1NC'), 'neg');
  assert.equal(L.speechSide(''), 'other');
});

// Why: tabs must be short like a paper flow, but a new judge must still be able to learn what "CP" or "K" means; a wrong expansion teaches the wrong thing.
test('sheet tabs show short names, with the full argument name for the hover', () => {
  assert.deepEqual(L.sheetLabel('Topicality'), { short: 'T', full: 'Topicality' });
  assert.deepEqual(L.sheetLabel('T'), { short: 'T', full: 'Topicality' });
  assert.deepEqual(L.sheetLabel('DA 1'), { short: 'DA 1', full: 'Disadvantage 1' });
  assert.deepEqual(L.sheetLabel('CP - States'), { short: 'CP - States', full: 'Counterplan: States' });
  assert.deepEqual(L.sheetLabel('K - Cap'), { short: 'K - Cap', full: 'Kritik: Cap' });
  assert.deepEqual(L.sheetLabel('Kritik'), { short: 'K', full: 'Kritik' });
  assert.deepEqual(L.sheetLabel('Case'), { short: 'Case', full: '' });
  assert.deepEqual(L.sheetLabel('Kansas'), { short: 'Kansas', full: '' }, 'a word that only starts with K is not a Kritik');
  assert.deepEqual(L.sheetLabel('Topicality - Substantial'), { short: 'T - Substantial', full: 'Topicality: Substantial' });
});
