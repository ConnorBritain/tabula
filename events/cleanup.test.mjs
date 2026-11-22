// Tests for "Clean up my comments", events/js/cleanup.js (docs/events/LANDING.md §4.1 step E13). Run with: node --test
// No real AI call: replies are written by hand in the providers' reply shapes.
import test from 'node:test';
import assert from 'node:assert/strict';
import '../core/policy.js';
import * as C from './js/cleanup.js';
import { CLEANUP_PROMPT } from './prompts/cleanup.v1.js';

const P = globalThis.TabulaCore.policy;
const NOW = 1_800_000_000_000;
const record = (features, extra = {}) => ({ v: 2, product: 'events', edition: '', subject: { role: 'coach', programId: 'p1', managed: false }, features, aiSetup: true, account: { plan: '', hosted: false }, issuedAt: NOW - 1, expiresAt: NOW + 60000, ...extra });
const gate = (rec, programId = 'p1') => P.gateFor({ record: rec, programId, now: NOW, profile: { programs: [] } });
const SOLO = P.gateFor({ now: NOW });

const room = () => ({
  id: 'r1', eventId: 'duo', profile: {},
  entries: [
    { id: 'e1', code: 'A12', name: 'Maria Lopez', title: 'Our Town', author: 'Thornton Wilder', order: 1, status: 'done', notes: '', comment: 'maria was great but A12 rushed the end. better than A14.', commentSource: 'judge' },
    { id: 'e2', code: 'A14', name: 'Ben Li & Ana Diaz', order: 2, status: 'done', notes: 'ben + ana - focus drifted, nice energy', comment: '', commentSource: 'judge' },
    { id: 'e3', code: 'A1', order: 3, status: 'noShow', notes: 'no show', comment: '' },
    { id: 'e4', code: 'B7', order: 4, status: 'done', notes: '', comment: '' },
  ],
});
const EVENT = { id: 'duo', version: 1, name: 'Duo Interpretation' };
const reply = (msg, texts) => JSON.stringify({ comments: msg.sent.map((x, i) => ({ speaker: x.speaker, text: texts[i] })) });

// ---------- the button ----------

// Why: AI-POLICY §0 says policy removes; if the button showed (even greyed) with ballotDraft off, a school that banned AI would still see an AI tool in the room.
test('the button is gone when the gate turns the feature off', () => {
  assert.equal(C.cleanupPath({ gate: gate(record({})), hasKey: true }), 'none');
  assert.equal(C.showCleanupButton({ gate: gate(record({})), hasKey: true }), false);
  assert.equal(C.cleanupPath({ gate: P.gateFor({ off: true }), hasKey: true }), 'none');
  assert.equal(C.cleanupPath({ gate: undefined, hasKey: true }), 'none');
});

// Why: the gate must key on the contract feature ballotDraft (ARCHITECTURE §7); keying on another name would show the button to a school that turned clean-up off, or hide it from one that allowed it.
test('the gate reads the ballotDraft feature key', () => {
  assert.equal(C.FEATURE, 'ballotDraft');
  assert.equal(C.TASK, 'events.cleanup');
  assert.equal(C.cleanupPath({ gate: gate(record({ ballotDraft: { payer: 'self' } })), hasKey: true }), 'own');
  assert.equal(C.cleanupPath({ gate: gate(record({ aiFlow: { payer: 'self' } })), hasKey: true }), 'none');
});

// Why: a solo judge with a key must get the own-key path, and one with no key gets the Connect invite; otherwise E13's own-key feature is unreachable or shows a button that cannot work.
test('a solo judge gets own key, or the Connect invite with no key', () => {
  assert.equal(C.cleanupPath({ gate: SOLO, hasKey: true }), 'own');
  assert.equal(C.cleanupPath({ gate: SOLO, hasKey: false }), 'connect');
});

// Why: a record that forbids key setup (aiSetup false) would make a "connect" button lead to a settings page the policy hides.
test('no Connect invite when the policy hides key setup', () => {
  const g = gate(record({ ballotDraft: { payer: 'self' } }, { aiSetup: false }));
  assert.equal(C.cleanupPath({ gate: g, hasKey: false }), 'none');
});

// Why: R6 and Q7 put hosted clean-up off by default for middle school rooms (some students are under 13); sending their comments through the Worker without the judge's choice breaks that promise.
test('hosted clean-up is off by default for middle school, on by opt-in', () => {
  assert.equal(C.hostedAllowed({ level: 'high' }), true);
  assert.equal(C.hostedAllowed({ level: 'middle' }), false);
  assert.equal(C.hostedAllowed({ level: 'middle', hostedOptIn: true }), true);
  assert.equal(C.hostedAllowed({ level: 'middle', hostedOptIn: 'yes' }), false);
  const paid = gate(record({ ballotDraft: { payer: 'program' } }, { aiSetup: false, account: { plan: 'school', hosted: true } }));
  assert.equal(C.cleanupPath({ gate: paid, level: 'high' }), 'hosted');
  assert.equal(C.cleanupPath({ gate: paid, level: 'middle' }), 'none');
  assert.equal(C.cleanupPath({ gate: paid, level: 'middle', hostedOptIn: true }), 'hosted');
  assert.equal(C.cleanupPath({ gate: SOLO, hosted: true, hasKey: true, level: 'middle' }), 'own');
});

// Why: the middle school rule needs a level; if levelOf ignored the room profile, a middle school room built with Custom rules (Q11) would default to hosted.
test('the level comes from the event file or the room profile', () => {
  assert.equal(C.levelOf({ profile: {} }, {}), 'high');
  assert.equal(C.levelOf({ profile: { level: 'middle' } }, {}), 'middle');
  assert.equal(C.levelOf({ profile: {} }, { level: 'middle' }), 'middle');
});

// ---------- scrubbing ----------

// Why: R6 and Q7 promise no codes, names, titles or authors leave the device; one leaked code ties a minor's comment to a tournament record at the AI provider.
test('the prompt holds no code, name, title or author from the room', () => {
  const msg = C.cleanupMessages(room(), EVENT);
  const all = msg.system + '\n' + msg.prompt;
  for (const v of ['A12', 'A14', 'B7', 'Maria', 'maria', 'Lopez', 'Ben', 'ben', 'Ana', 'ana', 'Diaz', 'Our Town', 'Thornton', 'Wilder']) {
    assert.ok(!new RegExp('(^|[^\\p{L}\\p{N}])' + v + '(?=$|[^\\p{L}\\p{N}])', 'u').test(all), v + ' leaked');
  }
  assert.match(msg.prompt, /\[Speaker 1\]/);
  assert.match(msg.prompt, /\[Speaker 2\]/, 'another entry\'s code in a comment is scrubbed too');
  assert.deepEqual(C.leaks(msg.prompt, msg.swaps), []);
});

// Why: a short code (for example "1") must not match the digit inside a tag already put in; that would nest tags and break the restore.
test('a short code never breaks a tag already in the text', () => {
  const r = { entries: [{ id: 'a', code: 'Speaker', order: 1 }, { id: 'b', code: '1', order: 2 }] };
  const sw = C.scrubMap(r);
  const s = C.scrub('Speaker did well; 1 was slow.', sw);
  assert.equal(s, '[Speaker 1] did well; [Speaker 2] was slow.');
  assert.equal(C.restore(s, sw), 'Speaker did well; 1 was slow.');
  assert.deepEqual(C.leaks(s, sw), []);
});

// Why: the judge reads the clean text with the real codes and names; if restore missed a tag, the ballot would say "[Speaker 2]" instead of the student's code.
test('restore puts codes and names back, with or without brackets', () => {
  const sw = C.scrubMap(room());
  assert.equal(C.restore('[Speaker 1] and [Name 1.1] were clear. Speaker 2 drifted.', sw), 'A12 and Maria were clear. A14 drifted.');
  assert.equal(C.restore('Speaker 10 is not a tag here.', sw), 'Speaker 10 is not a tag here.');
  const r = { entries: [{ id: 'x', code: 'C$1', order: 1 }] };
  assert.equal(C.restore('[Speaker 1]', C.scrubMap(r)), 'C$1', 'a "$" in a value is kept as typed');
});

// Why: a whole-word match only; scrubbing "Ana" inside "banana" would change the judge's words for no privacy gain and the AI would see a broken sentence.
test('scrub swaps whole words only', () => {
  const sw = C.scrubMap(room());
  assert.equal(C.scrub('banana Ana BEN', sw), 'banana [Name 2.3] [Name 2.1]');
});

// Why: rule-check flags and no-show rooms must not reach the AI (LANDING E6: a flag never reaches the student comment unless the judge writes it).
test('only the judge\'s own words for real entries are sent', () => {
  const r = room();
  r.entries[0].checks = { memorized: { state: 'flag', note: 'SECRET FLAG' } };
  const msg = C.cleanupMessages(r, EVENT);
  assert.deepEqual(msg.sent.map((x) => x.id), ['e1', 'e2'], 'no-show and empty entries are not sent');
  assert.ok(!msg.prompt.includes('SECRET FLAG'));
  assert.ok(msg.prompt.includes('focus drifted'), 'notes are used when the comment is empty');
  assert.deepEqual(C.cleanupMessages(r, EVENT, 'e2').sent.map((x) => x.id), ['e2'], 'one speaker at a time');
});

// ---------- the prompt (R7) ----------

// Why: R7: the AI may only rephrase; if these rules leave the prompt, the AI can add harsh or biased lines about a minor, or comment on looks, voice type or identity.
test('the prompt forbids new judgments, ranking, and comments on looks, voice type or identity', () => {
  const s = CLEANUP_PROMPT.system;
  assert.match(s, /Rephrase only what the judge wrote/);
  assert.match(s, /Never add a judgment/);
  assert.match(s, /Never rank, rate or compare/);
  assert.match(s, /how a student looks/);
  assert.match(s, /type or pitch of their voice/);
  assert.match(s, /who they are \(race, ethnicity, gender/);
  assert.match(s, /Copy each one exactly/);
  const msg = C.cleanupMessages(room(), EVENT);
  assert.equal(msg.system, s, 'the module sends the prompt file\'s text, not a copy');
});

// ---------- request and reply ----------

// Why: own-key calls go through core/ai.js; a request that dropped the system prompt or the JSON schema would let the AI write free text that no longer follows R7 or cannot be read back.
test('the own-key request carries the system prompt and the reply schema', () => {
  const msg = C.cleanupMessages(room(), EVENT);
  const req = C.cleanupRequest('openai', msg, { key: 'sk-test', model: 'gpt-x-mini', maxTokens: 1500 });
  const body = JSON.parse(req.init.body);
  assert.equal(req.url, 'https://api.openai.com/v1/responses');
  assert.equal(body.instructions, msg.system);
  assert.equal(body.max_output_tokens, 1500);
  assert.equal(body.text.format.type, 'json_schema');
  assert.ok(!req.init.body.includes('Maria'));
});

// Why: the reply must map back to the right entry with real codes; a mix-up would put one student's comments on another student's ballot.
test('the reply maps to entries, with names back in; invented speakers are dropped', () => {
  const msg = C.cleanupMessages(room(), EVENT);
  const json = { choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ comments: [
    { speaker: 'Speaker 2', text: '[Name 2.1] and [Name 2.3], your focus drifted.' },
    { speaker: '[Speaker 1]', text: '[Name 1.1], you rushed the end.' },
    { speaker: '[Speaker 9]', text: 'Made up.' },
  ] }) } }] };
  const d = C.readCleanupReply('xai', json, msg);
  assert.deepEqual(d, { e1: 'Maria, you rushed the end.', e2: 'Ben and Ana, your focus drifted.' });
});

// Why: a cut-off or refused reply must surface as an error, not as an empty draft the judge might accept as "nothing to fix".
test('a cut-off reply is an error', () => {
  const msg = C.cleanupMessages(room(), EVENT);
  assert.throws(() => C.readCleanupReply('xai', { choices: [{ finish_reason: 'length', message: { content: '{' } }] }, msg), /cut off/);
});

// ---------- review ----------

// Why: R7 says the judge must accept; if a card started on "insert", one tap on Accept would put AI text on a minor's ballot unseen.
test('one card per performer, each starts on "Keep mine" with a word diff', () => {
  const r = room();
  const msg = C.cleanupMessages(r, EVENT);
  const sent = r.entries.filter((e) => msg.sent.some((x) => x.id === e.id));
  const drafts = C.draftsFromText(reply(msg, ['[Name 1.1], you rushed the end.', '']), msg);
  const rev = C.cleanupReview(sent, drafts);
  assert.equal(rev.cards.length, 2);
  assert.deepEqual(rev.cards.map((c) => c.choice), ['keep', 'keep']);
  assert.ok(rev.cards[0].diff.some((p) => p.op === 'ins'));
  assert.equal(rev.cards[1].empty, true, 'an empty draft has nothing to insert');
  assert.deepEqual(C.applyCleanup(sent, rev).changed, [], 'nothing applies until the judge chooses');
});

// Why: only the card the judge chose may change; writing others, or overwriting a comment edited during review, loses the judge's own words.
test('apply writes only chosen cards, marks the source, and skips edited comments', () => {
  const r = room();
  const sent = [r.entries[0], r.entries[1]];
  const rev0 = C.cleanupReview(sent, { e1: 'Maria, you rushed the end.', e2: 'Your focus drifted.' });
  const rev = C.setChoice(rev0, 'e1', 'insert');
  const out = C.applyCleanup(sent, rev);
  assert.deepEqual(out.changed, ['e1']);
  assert.equal(out.entries[0].comment, 'Maria, you rushed the end.');
  assert.equal(out.entries[0].commentSource, 'judgeEditedAi');
  assert.equal(out.entries[1].comment, '', 'the unchosen card is not written');
  assert.equal(sent[0].comment, r.entries[0].comment, 'the old list is not changed');
  const edited = [Object.assign({}, sent[0], { comment: 'my new words' }), sent[1]];
  assert.deepEqual(C.applyCleanup(edited, rev).changed, [], 'an edit during review wins');
  const fresh = C.refreshReview(rev, edited);
  assert.equal(fresh.cards[0].changed, true);
  assert.equal(fresh.cards[0].choice, 'keep');
});

// Why: a card with no AI text must not flip to insert; it would write nothing and still mark the comment as AI-edited.
test('setChoice does not set insert on an empty card', () => {
  const sent = [room().entries[0]];
  const rev = C.setChoice(C.cleanupReview(sent, {}), 'e1', 'insert');
  assert.equal(rev.cards[0].choice, 'keep');
  assert.throws(() => C.setChoice(rev, 'e1', 'all'));
});

// Why: the Review screen reads the module from the global, like core/*.js; a missing global breaks the page with no test failing.
test('the module sets globalThis.TabulaEvents.cleanup', () => {
  assert.equal(globalThis.TabulaEvents.cleanup.cleanupPath, C.cleanupPath);
  assert.ok(Object.isFrozen(globalThis.TabulaEvents.cleanup));
});
