'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('./logic.js');
const { atomicFlow: A, flowReconcile: AI } = L;
const fmt = L.getFormat('policy-hs');
const setup = (overrides = {}) => {
  const round = { id: 'round-1', flows: [{ name: 'Case', cells: {} }], transcripts: {}, ...overrides };
  const flow = A.migrate(round);
  return { round, flow, sheet: flow.sheets[0], group: flow.sheets[0].groups[0] };
};
const add = (flow, group, speech, title) => A.addItem(flow, group, speech, { title });
const quote = 'The grid runs without diesel when the new line opens.';
const otherQuote = 'The rate will fall because the new line brings in more power.';
const item = (title, fields = {}) => ({ title, sheet: 'Case', group: 'General', excerpt: quote, ...fields });
const capture = (round, speech = '1AC', docs = []) => AI.capture(round, docs, speech, fmt);

// Keep old flow notes and edited AI cells visible while avoiding a guess about the shared block's speaker.
test('migration keeps old manual rows, unknown block speech, and both known block speeches', () => {
  const { round, flow, group } = setup({
    flows: [{ name: 'Case', cells: { 0: 'Plan\n\nSolvency', 3: 'Handwritten block note' } }],
    aiFlows: [{ name: 'DA', parts: { '2NC': { brief: 'Link', standard: 'New link', detailed: 'New link warrant' }, '1NR': 'Impact defense', '1NC': 'Forget this' }, edits: { 1: { text: 'My edit' } } }],
  });
  assert.equal(group.rows.length, 3);
  assert.equal(flow.items.find((e) => e.title === 'Handwritten block note').speech, null);
  assert.equal(flow.items.find((e) => e.title === 'My edit').source, 'manual');
  assert.ok(!flow.items.some((e) => e.title === 'Forget this'));
  assert.equal(A.textOf(A.byTime(flow, '2NC')[0], 'detailed'), 'New link warrant');
  assert.equal(A.byTime(flow, '1NR')[0].title, 'Impact defense');
  assert.equal(A.migrate(round), flow);
});

// A response must remain a single entry when it answers arguments on several sheets.
test('links can span sheets while groups can move without changing the spoken order', () => {
  const { flow, group, sheet } = setup();
  const da = A.addSheet(flow, 'DA').groups[0];
  const link = add(flow, da, '1NC', 'Link');
  const other = A.addGroup(sheet, 'Other');
  const plan = add(flow, other, '1AC', 'Plan');
  const reply = add(flow, group, '2AC', 'No link');
  const turn = add(flow, group, '2AC', 'Turn');
  reply.spoken = 50; turn.spoken = 10;
  A.setLinks(flow, reply, [plan.id, link.id], fmt);
  assert.deepEqual(reply.links, [plan.id, link.id]);
  assert.equal(reply.row, plan.row);
  assert.equal(A.live(flow).filter((e) => e.title === reply.title).length, 1);
  assert.ok(A.moveGroup(sheet, other.id, -1));
  assert.deepEqual(A.byTime(flow, '2AC').map((e) => e.title), ['Turn', 'No link']);
  assert.ok(A.removeItem(link));
  assert.ok(A.restoreItem(link));
  assert.ok(reply.links.includes(link.id));
});

// Retain what a speaker read even when that card is extended or deleted from a later speech.
test('moves act on one occurrence and extensions keep separate notes', () => {
  const { flow, group } = setup();
  const original = add(flow, group, '1AC', 'Plan');
  assert.equal(A.moveItem(flow, original, group, '2AC', null, undefined, fmt), null);
  A.setStatus(original, 'read');
  original.spoken = 31;
  const extension = A.moveItem(flow, original, group, '2AC', original.row, undefined, fmt);
  assert.equal(extension.card, original.card);
  assert.equal(extension.from, original.id);
  assert.equal(extension.status, 'unconfirmed');
  A.updateItem(extension, { title: 'Plan', notes: 'Answer to the DA' });
  assert.equal(original.notes, '');
  assert.equal(original.spoken, 31);
  assert.ok(A.removeItem(original));
  assert.deepEqual(A.live(flow), [extension]);
  assert.ok(A.restoreItem(original));
  A.setStatus(extension, 'unread');
  assert.equal(A.moveItem(flow, extension, group, '1AR', null, undefined, fmt), extension);
  assert.equal(extension.speech, '1AR');
});

// Preserve cards the transcript missed and avoid extra copies when an upload repeats.
test('document imports stay unconfirmed and keep distinct cards with the same citation', () => {
  const { round, flow } = setup();
  const doc = { id: 'file-1', name: 'plan.md', speech: '1AC', kind: 'text',
    data: '# Setup\n## Solvency - Smith 24\n' + quote + '\n\n## Cost - Smith 24\n' + otherQuote };
  const entries = AI.importDoc(flow, doc, fmt);
  assert.deepEqual(entries.map((e) => [e.title, e.author, e.date, e.status]), [
    ['Solvency', 'Smith', '24', 'unconfirmed'], ['Cost', 'Smith', '24', 'unconfirmed'],
  ]);
  assert.deepEqual(AI.importDoc(flow, { ...doc, id: 'duplicate' }, fmt), []);
  AI.reconcile(flow, { items: [] }, capture(round, '1AC', [doc]), fmt, 'auto', true);
  assert.deepEqual(A.live(flow), entries);
  A.removeItem(entries[0]);
  assert.deepEqual(AI.importDoc(flow, doc, fmt), []);
});

// A name or citation in a transcript is weak evidence and must not count as reading the argument.
test('confirmation requires evidence in the transcript beyond the tag and citation', () => {
  const { round, flow, group } = setup({ transcripts: { '1AC': 'Solvency Smith 24. ' + quote } });
  const entry = A.addItem(flow, group, '1AC', { title: 'Solvency', author: 'Smith', date: '24', notes: quote });
  const snapshot = capture(round);
  const reply = (excerpt) => ({ items: [item('Solvency', { match: entry.id, author: 'Smith', date: '24', excerpt })] });
  for (const excerpt of ['Solvency Smith 24', 'This argument was read but these words are invented.']) {
    assert.deepEqual(AI.reconcile(flow, reply(excerpt), snapshot, fmt, 'auto', true), []);
    assert.equal(entry.status, 'unconfirmed');
  }
  const [token] = AI.reconcile(flow, reply(quote), snapshot, fmt, 'auto', true);
  assert.equal(entry.status, 'read');
  assert.equal(entry.spoken, 'Solvency Smith 24. '.length);
  assert.ok(AI.undoMatch(flow, token));
  assert.equal(entry.status, 'unconfirmed');
  assert.equal(entry.spoken, undefined);
  AI.reconcile(flow, reply(quote), capture(round), fmt, 'auto', true);
  assert.equal(entry.status, 'unconfirmed', 'Undo blocks the same match from being applied again');
});

// An in-flight pass must respect later edits, moves, removals and the device's matching setting.
test('AI respects Approve and Off and does not recreate moved or removed occurrences', () => {
  const { round, flow, group, sheet } = setup({ transcripts: { '1AC': quote + ' ' + otherQuote } });
  const manual = add(flow, group, '1AC', 'Solvency');
  const otherGroup = A.addGroup(sheet, 'Next');
  const data = { items: [item('Solvency', { match: manual.id })] };
  AI.reconcile(flow, data, capture(round), fmt, 'off', true);
  assert.equal(flow.suggestions.length, 0);
  AI.reconcile(flow, data, capture(round), fmt, 'approve', true);
  assert.equal(manual.status, 'unconfirmed');
  assert.equal(flow.suggestions[0].kind, 'match');
  const before = capture(round);
  A.updateItem(manual, { title: 'My shorthand', notes: 'Edited during the call' });
  AI.reconcile(flow, data, before, fmt, 'auto', true);
  assert.equal(manual.title, 'My shorthand');
  assert.equal(manual.status, 'unconfirmed');
  A.setStatus(manual, 'unread');
  A.moveItem(flow, manual, otherGroup, '2AC', null, undefined, fmt);
  A.removeItem(manual);
  AI.reconcile(flow, data, capture(round), fmt, 'auto', true);
  assert.equal(A.live(flow).length, 0);
});

// Repeated passes and speech-end correction cannot duplicate an argument or move a judge's rows.
test('transcript order comes from where the words occur and a correction waits for review', () => {
  const transcript = otherQuote + ' ' + quote;
  const { round, flow } = setup({ transcripts: { '1AC': transcript } });
  const data = { items: [item('Solvency'), item('Cost', { excerpt: otherQuote })] };
  AI.reconcile(flow, data, capture(round), fmt, 'auto', false);
  AI.reconcile(flow, data, capture(round), fmt, 'auto', true);
  assert.equal(A.live(flow).length, 2);
  assert.deepEqual(A.byTime(flow, '1AC').map((e) => e.title), ['Cost', 'Solvency']);
  const [first] = A.live(flow);
  const row = first.row;
  const correction = { items: [item('Solvency', { match: first.id, excerpt: 'Cost drops once stores can buy all their power together.' })] };
  round.transcripts['1AC'] = correction.items[0].excerpt + ' ' + transcript;
  AI.reconcile(flow, correction, capture(round), fmt, 'auto', true);
  assert.equal(first.spoken, otherQuote.length + 1);
  assert.equal(first.row, row);
  const proposal = flow.suggestions.find((s) => s.kind === 'order');
  assert.ok(proposal, 'the alternate excerpt is offered before changing the order');
  const applied = AI.resolve(flow, proposal, fmt, [], round.transcripts['1AC']);
  assert.ok(applied);
  assert.equal(first.spoken, 0);
  assert.equal(first.row, row);
});

// Prevent a result based on another set of words or documents from being applied to the current round.
test('source validation rejects replacements and rewrites and accepts a transcript append', () => {
  const { round } = setup({ transcripts: { '1AC': quote } });
  const doc = { id: 'f', name: 'same.txt', speech: '1AC', kind: 'text', data: quote };
  const snapshot = capture(round, '1AC', [doc]);
  round.transcripts['1AC'] += ' ' + otherQuote;
  assert.ok(AI.current(snapshot, round, [doc], fmt));
  assert.ok(!AI.current(snapshot, { ...round, id: 'round-2' }, [doc], fmt));
  assert.ok(!AI.current(snapshot, round, [{ ...doc, speech: '2AC' }], fmt));
  assert.ok(!AI.current(snapshot, round, [{ ...doc, data: 'Different file' }], fmt));
  round.transcripts['1AC'] = otherQuote;
  assert.ok(!AI.current(snapshot, round, [doc], fmt));
});

// Saved flows must keep identities and unconfirmed document status when opened for judging or AI.
test('round files preserve occurrence links and remap file IDs while only live entries reach judging tools', () => {
  const { round, flow, group } = setup({ started: true });
  const doc = { id: 'f', roundId: round.id, name: 'plan.txt', side: 'aff', speech: '1AC', kind: 'text', data: 'Skipped warrant' };
  const [draft] = AI.importDoc(flow, doc, fmt);
  const manual = add(flow, group, '2AC', 'Human answer');
  A.setLinks(flow, manual, [draft.id], fmt);
  const gone = add(flow, group, '2AC', 'Removed warrant');
  A.removeItem(gone);
  const { round: opened } = L.parseRoundFile(JSON.stringify(L.buildRoundFile(round, [doc])), 'open');
  assert.equal(A.byId(opened.itemFlow.items, draft.id).document, 'open:f');
  assert.deepEqual(A.byId(opened.itemFlow.items, manual.id).links, [draft.id]);
  assert.equal(A.byId(opened.itemFlow.items, gone.id).removed, true);
  const input = L.buildJudgePrompt(opened, [doc]);
  assert.match(input, /Human answer/);
  assert.match(input, /Skipped warrant \[document, read not confirmed\]/);
  assert.doesNotMatch(input, /Removed warrant/);
  assert.deepEqual(L.speechesSoFar(opened), []);
  assert.ok(L.roundHasContent(opened, []));
  assert.match(L.hostedState('ballot', opened, []).flow, /Human answer/);
  assert.match(L.printModel(opened, { flow: true }).sections.find((s) => s.kind === 'flow').cols[0].text, /Skipped warrant/);
});

// A model can cite valid words for the wrong ID. The status must stay uncertain until the judge checks the match.
test('an unrelated excerpt attached to a manual ID can only be proposed', () => {
  const { round, flow, group } = setup({ transcripts: { '1AC': otherQuote } });
  const manual = A.addItem(flow, group, '1AC', { title: 'Lead paint', notes: 'Peeling paint puts children at risk of poisoning.' });
  const data = { items: [item('Lead paint', { match: manual.id, excerpt: otherQuote })] };
  AI.reconcile(flow, data, capture(round), fmt, 'auto', true);
  assert.equal(manual.status, 'unconfirmed');
  assert.equal(flow.suggestions[0].item, manual.id);
});

// Two equal-looking tags can represent different cards, but one spoken occurrence cannot confirm both.
test('choosing an ambiguous match assigns the quote to only one card', () => {
  const { round, flow, group } = setup({ transcripts: { '1AC': quote } });
  const a = add(flow, group, '1AC', 'Solvency');
  const b = add(flow, group, '1AC', 'Solvency');
  AI.reconcile(flow, { items: [item('Solvency')] }, capture(round), fmt, 'approve', true);
  const [one, two] = flow.suggestions;
  assert.ok(one && two);
  assert.ok(AI.resolve(flow, one, fmt, [], quote));
  assert.equal(AI.resolve(flow, two, fmt, [], quote), null);
  assert.equal([a, b].filter((e) => e.status === 'read').length, 1);
});

// Identical words at different transcript positions can represent two separate occurrences.
test('the repetition number preserves two spoken positions across refreshes', () => {
  const { round, flow } = setup({ transcripts: { '1AC': quote + ' ' + quote } });
  const data = { items: [item('Solvency', { occurrence: 1 }), item('Solvency', { occurrence: 2 })] };
  AI.reconcile(flow, data, capture(round), fmt, 'auto', false);
  AI.reconcile(flow, data, capture(round), fmt, 'auto', false);
  assert.equal(A.live(flow).length, 2);
  assert.deepEqual(A.byTime(flow, '1AC').map((e) => e.spoken), [0, quote.length + 1]);
});

// Hosted users get the same safe matching path when the v1 reply includes occurrence metadata.
test('hosted flow passes entry IDs and applies proof from a compatible detail line', () => {
  const { round, flow, group } = setup({ transcripts: { '2AC': quote } });
  const earlier = add(flow, group, '1NC', 'Diesel reliance');
  const doc = { id: 'doc', name: '2AC.md', kind: 'text', speech: '2AC', data: '# General\n## Solvency\n' + quote };
  const [draft] = AI.importDoc(flow, doc, fmt);
  const state = L.hostedState('flow', round, [doc], { speech: '2AC' });
  assert.ok(state.flow.includes(draft.id));
  assert.ok(state.flow.includes(earlier.id));
  assert.match(state.notes, /FLOW_ITEM/);
  const result = { sheets: [{ sheet: 'Case', standard: '1. Solvency', brief: 'Solvency',
    detailed: '1. Solvency: no diesel.\tFLOW_ITEM ' + JSON.stringify({ excerpt: quote, match: draft.id, targets: [earlier.id] }) }] };
  AI.reconcile(flow, result, capture(round, '2AC', [doc]), fmt, 'auto', true);
  assert.deepEqual(A.byTime(flow, '2AC'), [draft]);
  assert.equal(draft.status, 'read');
  const links = flow.suggestions.find((s) => s.kind === 'links');
  assert.ok(AI.resolve(flow, links, fmt, [earlier.id], quote));
  assert.deepEqual(draft.links, [earlier.id]);
});

// Moving a document must keep the flow tidy and protect entries that a judge already worked on.
test('document reassignment moves untouched entries and retains a manually edited one', () => {
  const { flow } = setup();
  const doc = { id: 'doc', name: 'notes.md', kind: 'text', speech: '1AC', data: '## Solvency\n' + quote + '\n\n## Cost\n' + otherQuote };
  const [unchanged, edited] = AI.importDoc(flow, doc, fmt);
  A.updateItem(edited, { title: 'My cost edit' });
  AI.reassignDocument(flow, { ...doc, speech: '1NC' }, '1AC', fmt);
  assert.equal(unchanged.speech, '1NC');
  assert.equal(edited.speech, '1AC');
  assert.equal(edited.title, 'My cost edit');
  assert.deepEqual(A.byTime(flow, '1NC').map((e) => e.title).sort(), ['Cost', 'Solvency']);
  AI.reassignDocument(flow, { ...doc, speech: '2AC' }, '1NC', fmt);
  assert.equal(unchanged.speech, '2AC');
  assert.equal(A.byTime(flow, '1NC').length, 0);
});

// Why: a PDF import must stay a file marker so its text does not become round data or hosted AI input.
test('PDF flow imports keep a marker and never materialize PDF-only content', () => {
  const { round, flow } = setup();
  const body = 'The private PDF text belongs only in its document.';
  const pdf = { id: 'pdf-doc', name: 'Marked evidence.pdf', kind: 'pdf', speech: '1AC', data: 'fixture', extractedText: body };
  const [marker] = AI.importDoc(flow, pdf, fmt);
  assert.equal(marker.title, pdf.name);
  assert.equal(marker.placeholder, true);
  AI.reconcile(flow, { items: [item('PDF-only argument', { excerpt: '', document: pdf.name, docExcerpt: body, notes: body })] },
    capture(round, '1AC', [pdf]), fmt, 'auto', true);
  assert.deepEqual(A.live(flow), [marker]);
  for (const value of [round, L.hostedState('flow', round, [pdf], { speech: '1AC' }), L.hostedState('eval', round, [pdf])]) {
    assert.ok(!JSON.stringify(value).includes(body));
  }
});

// Why: removing a file must erase untouched imported text without discarding entries the judge has worked on.
test('file removal drops untouched imported text and lets an explicit reimport restore it', () => {
  const { round, flow } = setup();
  const body = 'File-only argument detail that the judge never used.';
  const file = { id: 'remove-doc', roundId: round.id, name: 'Speech.md', kind: 'text', speech: '1AC',
    data: '## Untouched\n' + body + '\n\n## Edited\nKeep this part.' };
  const [untouched, edited] = AI.importDoc(flow, file, fmt);
  A.updateItem(edited, { title: 'My edited entry' });
  AI.reassignDocument(flow, { ...file, speech: '' }, file.speech, fmt);
  assert.ok(untouched.sourceDetached);
  AI.removeDocument(flow, file.id);
  assert.deepEqual(A.live(flow), [edited]);
  assert.equal(edited.document, undefined);
  assert.ok(!JSON.stringify(L.buildRoundFile(round, [])).includes(body));
  const added = AI.importDoc(flow, { ...file, id: 'restore-doc' }, fmt);
  assert.deepEqual(added.map((entry) => [entry.title, entry.status]), [['Untouched', 'unconfirmed']]);
  assert.deepEqual(A.live(flow), [edited, ...added]);
});

// A bad saved item record must leave its original data available and keep the legacy renderer usable.
test('unsupported flows are not replaced by migration', () => {
  const { round, flow } = setup();
  flow.suggestions.push(null);
  assert.equal(A.migrate(round), null);
  assert.equal(round.itemFlow, flow);
  assert.deepEqual(flow.suggestions, [null]);
});

// An extended document stays unconfirmed in its new speech until supported by what was read.
test('the next speech keeps the document source and independent read status of an extension', () => {
  const { round, flow, group } = setup();
  const doc = { id: 'f', name: 'case.txt', speech: '1AC', kind: 'text', data: 'Plan evidence' };
  const [original] = AI.importDoc(flow, doc, fmt);
  A.setStatus(original, 'read');
  const next = A.moveItem(flow, original, group, '2AC', original.row, undefined, fmt);
  assert.equal(next.origin, 'document');
  assert.equal(next.status, 'unconfirmed');
  assert.match(L.buildJudgePrompt(round, [doc]), /\[2AC\]\nPlan evidence \[document, read not confirmed\]/);
  assert.deepEqual(L.speechesSoFar(round), ['1AC']);
});

// A short but complete analytic belongs in the flow even when the speaker uses only a few words.
test('a short transcript analytic is retained with its spoken position', () => {
  const short = 'Emissions are already falling fast.';
  const { round, flow } = setup({ transcripts: { '1AC': short } });
  AI.reconcile(flow, { items: [item('No link', { excerpt: short })] }, capture(round), fmt, 'approve', true);
  assert.equal(A.live(flow).length, 1);
  assert.equal(A.live(flow)[0].spoken, 0);
  assert.equal(A.live(flow)[0].status, 'read');
});

// A model's shorter paraphrase of a tag cannot turn reading the original tag into reading the card.
test('a full title quoted without its warrant never confirms a read', () => {
  const title = 'Building a nationwide electric grid lowers wholesale energy prices';
  const { round, flow, group } = setup({ transcripts: { '1AC': title } });
  const manual = add(flow, group, '1AC', title);
  AI.reconcile(flow, { items: [item('Lower costs', { match: manual.id, excerpt: title, occurrence: 1 })] }, capture(round), fmt, 'auto', true);
  assert.equal(manual.status, 'unconfirmed');
  assert.deepEqual(flow.suggestions, []);
});

// A removed card must stay removed when an AI pass changes its tag but still quotes the same file passage.
test('document proof identifies a removed card through a changed AI title', () => {
  const { round, flow } = setup();
  const doc = { id: 'f', name: 'plan.md', kind: 'text', speech: '1AC', data: '## Replace lead pipes\n' + quote };
  const [removed] = AI.importDoc(flow, doc, fmt);
  A.removeItem(removed);
  AI.reconcile(flow, { items: [item('New title from AI', { document: doc.name, docExcerpt: quote, excerpt: '' })] },
    capture(round, '1AC', [doc]), fmt, 'auto', true);
  assert.deepEqual(A.live(flow), []);
});
