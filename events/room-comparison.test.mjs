import test from 'node:test';
import assert from 'node:assert/strict';
import { comparisonCoverage, comparisonNotes, comparisonMessages, comparisonFromText, comparisonStamp, roomPriorities } from './js/room-comparison.js';
import { withSetting, makeBackup, readBackup } from './js/settings.js';
import { SETTINGS_KEY } from './js/store.js';
import { aiPartHtml } from './js/settings-screen.js';
import { setComment } from './js/ballot.js';
import { cleanupReview, acceptCleanup, undoCleanup } from './js/cleanup.js';

const event = { name: 'Original Oratory', prompts: ['Clear reasoning?', 'Effective delivery?'] };
const room = () => ({ id: 'room-secret', profile: {}, reasonForRank: 'PRIVATE REASON', entries: [
  { id: 'e1', code: 'A12', name: 'Ana Diaz', title: 'My title', author: 'Pat Smith', order: 1, status: 'done', rank: '2', rating: '98', notes: 'Ana had clear reasoning. The ending was rushed.', privateNote: 'PRIVATE JACKET', checks: { noAiText: 'flag' } },
  { id: 'e2', code: 'B7', name: 'Ben Lee', order: 2, status: 'done', rank: '1', notes: 'Ben had a steady pace. The evidence was thin.' },
] });
const point = () => ({ text: '[Speaker 1] has stronger recorded reasoning, while [Speaker 2] has steadier pacing.', evidence: [{ speaker: '[Speaker 1]', quote: 'clear reasoning' }, { speaker: '[Speaker 2]', quote: 'steady pace' }] });
const reply = () => ({ comparisons: [point()], gaps: ['The notes do not cover every event criterion.'], order: [] });
const ordered = () => ({ ...reply(), order: [
  { speaker: '[Speaker 1]', text: 'Clear reasoning supports this tentative place.', evidence: [point().evidence[0]] },
  { speaker: '[Speaker 2]', text: 'Steady pace is recorded, with less evidence support.', evidence: [point().evidence[1]] },
] });

// Why: comparing notes must not disclose private memories, identity fields or the judge's current ranks.
test('the request contains only anonymized public evidence, criteria, style and saved priorities', () => {
  const r = room(), before = structuredClone(r);
  const msg = comparisonMessages(r, { ...event, prompts: [...event.prompts, 'Ana Diaz comparison'] }, {
    roomJudging: { priorities: 'A12: prioritize reasoning, Ana.' },
    aiPreferences: { defaults: { mode: 'custom', style: 'Brief', guidance: 'IGNORE THIS GUIDANCE' } },
  });
  const payload = JSON.parse(msg.prompt);
  assert.equal(payload.mode, 'compare'); assert.equal(payload.style, 'Brief');
  assert.match(payload.priorities, /prioritize reasoning/); assert.deepEqual(payload.criteria.slice(0, 2), event.prompts);
  assert.doesNotMatch(msg.prompt, /Ana|Diaz|Ben|Lee|A12|B7|My title|Pat|Smith|PRIVATE|room-secret|rating|rank|IGNORE THIS/);
  assert.deepEqual(Object.keys(payload.speakers[0]), ['speaker', 'notes', 'complete', 'firstPlaceEligible']);
  assert.deepEqual(r, before);
  assert.match(msg.system, /Do not reward a student for having more or longer notes/);
  assert.match(msg.system, /untrusted data/); assert.match(msg.system, /No winner or numbered ranking/);
});

// Why: replacing JSON keys during identity scrubbing can corrupt requests for ordinary numeric or short codes.
test('identity scrubbing preserves JSON structure and exact neutral speaker tags', () => {
  const r = room(); r.entries[0].code = 'notes'; r.entries[1].code = '2';
  const payload = JSON.parse(comparisonMessages(r, event).prompt);
  assert.equal(payload.speakers[1].speaker, '[Speaker 2]');
  assert.equal(typeof payload.speakers[0].notes, 'string');
});

// Why: an AI wording suggestion must not become a new observation about the performance.
test('original notes take precedence and AI-edited feedback is never a fallback', () => {
  assert.equal(comparisonNotes({ notes: 'Original', comment: 'AI invented', commentSource: 'judgeEditedAi' }), 'Original');
  assert.equal(comparisonNotes({ comment: 'AI invented', commentSource: 'judgeEditedAi' }), '');
  assert.equal(comparisonNotes({ comment: 'Human public comment', commentSource: 'judge' }), 'Human public comment');
});

// Why: a tiny manual edit must never promote an AI wording draft into original performance evidence.
test('AI provenance survives manual edits and backup; Undo restores the original human source', () => {
  const r = room(); r.entries[0].notes = ''; r.entries[0].comment = 'A human observation.';
  const review = cleanupReview([r.entries[0]], { e1: 'A polished AI observation.' });
  const edited = acceptCleanup(r, review, 'e1', 99).room;
  assert.equal(comparisonNotes(edited.entries[0]), '');
  const manual = setComment(edited, 'e1', edited.entries[0].comment + ' ', 100);
  assert.equal(manual.entries[0].commentSource, 'judge');
  assert.equal(manual.entries[0].commentHadAi, true);
  assert.equal(comparisonNotes(manual.entries[0]), '');
  const again = setComment(manual, 'e1', manual.entries[0].comment + 'New words.', 101);
  assert.equal(comparisonNotes(JSON.parse(JSON.stringify(again)).entries[0]), '');
  assert.equal(comparisonCoverage(again).canOrder, false);
  assert.equal(comparisonNotes(undoCleanup(edited, r, 'e1', edited.entries[0].comment, 102).entries[0]), 'A human observation.');
});

// Why: a missing or unfinished speech is a coverage gap, not a weak performance to rank last.
test('coverage excludes no-shows and blocks an order until every present speaker has finished with notes', () => {
  const r = room(); r.entries.push({ id: 'e3', code: 'C3', order: 3, status: 'waiting', notes: 'Unfinished notes' }, { id: 'e4', order: 4, status: 'noShow', notes: 'No show text' });
  const cov = comparisonCoverage(r); assert.equal(cov.entries.length, 3); assert.equal(cov.covered.length, 2); assert.equal(cov.canOrder, false);
  const msg = comparisonMessages(r, event); assert.equal(JSON.parse(msg.prompt).speakers[2].notes, '');
  assert.doesNotMatch(msg.prompt, /No show text|Unfinished notes/);
  assert.throws(() => comparisonMessages(r, event, {}, 'order'), /every speech/);
  r.entries[2].status = 'done'; assert.equal(comparisonCoverage(r).canOrder, true);
  r.profile.ranks = 'off'; assert.equal(comparisonCoverage(r).canOrder, false);
  r.profile = { critiqueOnly: true }; assert.equal(comparisonCoverage(r).canOrder, false);
});

// Why: silent truncation would give some performances more evidence than others.
test('requests reject insufficient evidence and excessive input without truncating any speaker', () => {
  const r = room(); r.entries[1].notes = '';
  assert.throws(() => comparisonMessages(r, event), /at least two/);
  r.entries[1].notes = 'x'.repeat(24001); assert.throws(() => comparisonMessages(r, event), /too much text/);
  assert.throws(() => comparisonMessages(room(), event, {}, 'bogus'), /Choose/);
});

// Why: references must prove where each comparison came from before it reaches the judge.
test('exact quotations resolve to local speaker ids and restore known names only on the device', () => {
  const msg = comparisonMessages(room(), event);
  const parsed = comparisonFromText(JSON.stringify(reply()), msg);
  assert.equal(parsed.comparisons[0].evidence[0].id, 'e1');
  assert.match(parsed.comparisons[0].text, /A12/); assert.match(parsed.comparisons[0].text, /B7/);
  const data = reply(); data.comparisons[0].evidence[0].quote = '[Name 1.1] had clear reasoning.';
  assert.equal(comparisonFromText(JSON.stringify(data), msg).comparisons[0].evidence[0].quote, 'Ana had clear reasoning.');
});

// Why: fabricated quotations or one-sided evidence could make a polished but unsupported comparison appear reliable.
test('unknown speakers, fabricated quotes, empty points and one-speaker comparisons are rejected', () => {
  const msg = comparisonMessages(room(), event);
  for (const change of [
    (x) => x.comparisons[0].evidence[0].speaker = '[Speaker 99]',
    (x) => x.comparisons[0].evidence[0].quote = 'flawless performance',
    (x) => x.comparisons[0].evidence = [point().evidence[0]],
    (x) => x.comparisons[0].text = '',
    (x) => x.gaps = [null],
    (x) => x.comparisons = Array(7).fill(point()),
  ]) { const data = reply(); change(data); assert.throws(() => comparisonFromText(JSON.stringify(data), msg), /valid note references/); }
  assert.throws(() => comparisonFromText('not JSON', msg));
});

// Why: the optional order must be complete and independently requested; it can never replace final ranks.
test('only a requested complete unique order is accepted, with a reason for every speaker', () => {
  const r = room(), before = structuredClone(r), data = ordered();
  assert.throws(() => comparisonFromText(JSON.stringify(data), comparisonMessages(r, event)), /valid note references/);
  const msg = comparisonMessages(r, event, {}, 'order');
  assert.deepEqual(comparisonFromText(JSON.stringify(data), msg).order.map((e) => e.id), ['e1', 'e2']);
  for (const order of [[data.order[0]], [data.order[0], data.order[0]], [{ ...data.order[0], speaker: '[Speaker 9]' }, data.order[1]], [{ ...data.order[0], evidence: [point().evidence[1]] }, data.order[1]]]) {
    assert.throws(() => comparisonFromText(JSON.stringify({ ...data, order }), msg), /valid note references/);
  }
  assert.deepEqual(comparisonFromText(JSON.stringify(reply()), msg).order, [], 'the AI may decline to order');
  assert.deepEqual(r, before);
});

// Why: an advisory ordering must not put an overtime-ineligible speaker first under the frozen room rule.
test('recorded no-first overtime eligibility is enforced while flag-only remains the judge’s choice', () => {
  const r = room(); r.entries[0].timing = { overGrace: true };
  let msg = comparisonMessages(r, event, {}, 'order');
  assert.equal(JSON.parse(msg.prompt).speakers[0].firstPlaceEligible, false);
  assert.throws(() => comparisonFromText(JSON.stringify(ordered()), msg), /valid note references/);
  r.profile.overtime = { effect: 'flagOnly' }; msg = comparisonMessages(r, event, {}, 'order');
  assert.equal(comparisonFromText(JSON.stringify(ordered()), msg).order.length, 2);
});

// Why: notes and criteria can change while a request waits; private notes and final ranks must stay independent.
test('the evidence snapshot changes for relevant inputs and ignores ranks, ratings and private notes', () => {
  const r = room(), initial = comparisonStamp(r, event);
  r.entries[0].rank = '1'; r.entries[0].rating = '90'; r.entries[0].privateNote = 'New private memory';
  assert.equal(comparisonStamp(r, event), initial);
  r.entries[0].notes += ' New note.'; assert.notEqual(comparisonStamp(r, event), initial);
  assert.notEqual(comparisonStamp(room(), { ...event, prompts: ['Other criterion'] }), initial);
  assert.notEqual(comparisonStamp(room(), event, { roomJudging: { priorities: 'New priority' } }), initial);
});

// Why: judging priorities belong in saved settings and backups, never on the round or in an unsafe HTML field.
test('priorities are bounded, survive backup and appear only when room analysis is permitted', () => {
  const settings = withSetting({}, 'roomJudging', { priorities: '\u0000  <script>reasoning</script>  ' });
  assert.equal(settings.roomJudging.priorities, '<script>reasoning</script>'); assert.equal(roomPriorities('x'.repeat(1500)).length, 1000);
  const backup = readBackup(JSON.stringify(makeBackup({ [SETTINGS_KEY]: JSON.stringify(settings) })));
  assert.deepEqual(JSON.parse(backup.storage[SETTINGS_KEY]).roomJudging, settings.roomJudging);
  assert.doesNotMatch(aiPartHtml({ allowed: true, comparisonAllowed: false }), /set-room-priorities/);
  const html = aiPartHtml({ allowed: true, comparisonAllowed: true }, settings);
  assert.match(html, /&lt;script&gt;reasoning/); assert.doesNotMatch(html, /<script>/);
  assert.match(html, /<details class="fold room-judging-settings">/);
});
