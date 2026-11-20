// Run with: node --test
// Slice 2 (copy and dialogs) pure functions. Spec: docs/design/SPEC.md §3.2 and §6.1.
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('./logic.js');
const P = require('./providers.js');

// ---------- 2.1 welcome ----------

// Why: a free judge who never finished setup must get the welcome, or they start with no idea AI is optional.
test('shouldShowWelcome: a free judge who has not finished setup sees it; after setup they do not', () => {
  assert.equal(L.shouldShowWelcome({ setupDone: false, hostedPlan: false }), true);
  assert.equal(L.shouldShowWelcome({ setupDone: undefined, hostedPlan: false }), true);
  assert.equal(L.shouldShowWelcome({ setupDone: true, hostedPlan: false }), false);
  assert.equal(L.shouldShowWelcome(undefined), true);
});

// Why: paid-plan judges get hosted AI with no keys (Q11); showing them a key screen would be a dead end.
test('shouldShowWelcome: a hosted plan never shows it, and no one has a hosted plan yet', () => {
  assert.equal(L.shouldShowWelcome({ setupDone: false, hostedPlan: true }), false);
  assert.equal(L.hasHostedPlan(), false);
});

// ---------- 2.3 one error classifier ----------

// Why: blaming the key when the judge is simply offline sends them to delete a good key mid-round.
test('classifyAIError: offline wins over everything, even a 401', () => {
  assert.equal(L.classifyAIError({ online: false, status: 401 }), 'offline');
  assert.equal(L.classifyAIError({ online: false, name: 'TypeError' }), 'offline');
});

// Why: a slow reply is not a bad key; the judge should just try again.
test('classifyAIError: a TimeoutError is timeout', () => {
  assert.equal(L.classifyAIError({ online: true, name: 'TimeoutError' }), 'timeout');
});

// Why: a fetch TypeError while online means no reply came back; calling it a rejected key is the old, wrong message.
test('classifyAIError: a TypeError while online is noReply, never keyRejected', () => {
  assert.equal(L.classifyAIError({ online: true, name: 'TypeError' }), 'noReply');
  assert.notEqual(L.classifyAIError({ online: true, name: 'TypeError', message: 'Failed to fetch' }), 'keyRejected');
});

// Why: only a 401 or 403 proves the key is bad; then the judge must paste it again.
test('classifyAIError: 401 and 403 are keyRejected', () => {
  assert.equal(L.classifyAIError({ online: true, status: 401 }), 'keyRejected');
  assert.equal(L.classifyAIError({ online: true, status: 403 }), 'keyRejected');
});

// Why: "no credit" needs a trip to the provider's billing page; "busy" needs only a wait. Mixing them wastes the judge's time.
test('classifyAIError: a 429 about quota is noCredit; other 429s, 408 and 5xx are busy', () => {
  assert.equal(L.classifyAIError({ online: true, status: 429, message: 'You exceeded your current quota' }), 'noCredit');
  assert.equal(L.classifyAIError({ online: true, status: 429, message: 'credit balance is too low' }), 'noCredit');
  assert.equal(L.classifyAIError({ online: true, status: 429, message: 'rate limit' }), 'busy');
  assert.equal(L.classifyAIError({ online: true, status: 408 }), 'busy');
  assert.equal(L.classifyAIError({ online: true, status: 500 }), 'busy');
  assert.equal(L.classifyAIError({ online: true, status: 503 }), 'busy');
});

// Why: a retired model is fixed by picking another, not by changing the key.
test('classifyAIError: 404 is modelGone', () => {
  assert.equal(L.classifyAIError({ online: true, status: 404 }), 'modelGone');
});

// Why: a refusal and a cut-off reply need different next steps (decide by hand vs. try again).
test('classifyAIError: a refusal is refused; a max-tokens stop is cutOff', () => {
  assert.equal(L.classifyAIError({ online: true, stop: 'refusal' }), 'refused');
  assert.equal(L.classifyAIError({ online: true, stop: 'max_tokens' }), 'cutOff');
});

// Why: when the local helper is not running, the fix is one Terminal command, not the internet or a key.
test('classifyAIError: a failed fetch to the helper is helperDown', () => {
  assert.equal(L.classifyAIError({ online: true, name: 'TypeError', helper: true }), 'helperDown');
  assert.equal(L.classifyAIError({ online: true, helper: true }), 'helperDown');
});

// Why: anything unknown still needs a plain message, not a raw provider dump.
test('classifyAIError: anything else is other', () => {
  assert.equal(L.classifyAIError({ online: true, status: 400 }), 'other');
  assert.equal(L.classifyAIError({}), 'other');
  assert.equal(L.classifyAIError(undefined), 'other');
});

// Why: every kind must have its own text; a missing one would show "undefined" to the judge.
test('aiErrorText: each kind has its own text, and {provider} is filled in', () => {
  const kinds = ['offline', 'noReply', 'timeout', 'keyRejected', 'noCredit', 'busy', 'modelGone', 'refused', 'cutOff', 'helperDown', 'other'];
  assert.deepEqual(Object.keys(L.AI_ERROR_TEXT).sort(), kinds.slice().sort());
  assert.equal(new Set(kinds.map((k) => L.aiErrorText(k))).size, kinds.length);
  assert.equal(L.aiErrorText('keyRejected', { provider: 'Grok' }), 'The Grok key was rejected. Paste it again in Settings, or make a new key.');
  assert.match(L.aiErrorText('noReply'), /^No reply from the AI provider\./);
  assert.equal(L.aiErrorText('other', { status: 500 }), 'The AI call failed (error 500). Try again. If it keeps failing, test the key in Settings.');
  assert.equal(L.aiErrorText('other'), 'The AI call failed. Try again. If it keeps failing, test the key in Settings.');
  assert.equal(L.aiErrorText('no-such-kind'), L.aiErrorText('other'));
});

// Why: copy names no company except the judge's own provider (spec 4.5); an error text with a vendor name favours one, and a missing full stop reads as cut off.
test('aiErrorText: every text ends with "." and names no vendor unless {provider} is given', () => {
  const vendors = ['Anthropic', 'Claude', 'OpenAI', 'ChatGPT', 'GPT', 'Codex', 'Google', 'Gemini', 'Groq', 'Mistral', 'Deepgram', 'AssemblyAI', 'Whisper', 'Tabroom',
    ...Object.values(P.PROVIDERS).flatMap((p) => [p.name, p.short])];
  const re = new RegExp('\\b(' + vendors.join('|') + ')\\b');
  for (const kind of Object.keys(L.AI_ERROR_TEXT)) {
    for (const status of [undefined, 500]) {
      const t = L.aiErrorText(kind, { status });
      assert.ok(t.endsWith('.'), kind + ' ends with a full stop: ' + t);
      assert.ok(!re.test(t), kind + ' names a vendor: ' + t);
      assert.ok(!t.includes('{'), kind + ' has an unfilled placeholder: ' + t);
    }
  }
});

// Why: each feature's error must say which feature failed, or the judge cannot tell the flow from the ballot.
test('AI_ERROR_PREFIX names each AI feature', () => {
  assert.deepEqual(L.AI_ERROR_PREFIX, { flow: 'AI flow:', eval: 'Live Eval:', analysis: 'Analysis:', ballot: 'Ballot draft:', transcript: 'Transcript:', decision: 'Decision draft:' });
});

// ---------- 2.2 one "No AI" line ----------

// Why: the no-AI line must point to the real place name (Settings) and stay one sentence pair everywhere.
test('NO_AI names Settings and ends with a full stop', () => {
  assert.equal(L.NO_AI, 'No AI is connected. Connect one in Settings.');
});

// ---------- 2.4 Undo helpers ----------

// Why: Undo must put a deleted sheet or saved ballot back in the same place; a moved item breaks the judge's order.
test('removeAt then restoreAt gives back the same list for the first, middle and last item', () => {
  const list = ['a', 'b', 'c', 'd'];
  for (const i of [0, 2, 3]) {
    const { list: shorter, undo } = L.removeAt(list, i);
    assert.equal(shorter.length, 3);
    assert.equal(undo.index, i);
    assert.equal(undo.item, list[i]);
    assert.deepEqual(L.restoreAt(shorter, undo.index, undo.item), list);
  }
  assert.deepEqual(list, ['a', 'b', 'c', 'd'], 'removeAt does not change the list it gets');
});

// Why: a stale index (the list changed since) must never throw or drop the restored item.
test('removeAt with a bad index removes nothing; restoreAt clamps the index', () => {
  assert.deepEqual(L.removeAt(['a'], 5), { list: ['a'], undo: null });
  assert.deepEqual(L.removeAt(null, 0), { list: [], undo: null });
  assert.deepEqual(L.restoreAt(['a'], 9, 'z'), ['a', 'z']);
  assert.deepEqual(L.restoreAt(['a'], -3, 'z'), ['z', 'a']);
});

// ---------- 4.2 ask() text box ----------

// Why: a blank sheet name makes an unlabelled tab; the dialog must refuse it with a plain reason.
test('askInputState: blank is refused with the given reason; text is trimmed and cut to maxLength', () => {
  const opts = { maxLength: 40, emptyError: 'Type a name.' };
  assert.deepEqual(L.askInputState('   ', opts), { ok: false, text: '', error: 'Type a name.' });
  assert.deepEqual(L.askInputState('  Econ DA ', opts), { ok: true, text: 'Econ DA', error: '' });
  assert.equal(L.askInputState('x'.repeat(60), opts).text.length, 40);
  assert.equal(L.askInputState('', { required: false }).ok, true);
  assert.equal(L.askInputState(undefined, {}).error, 'Type something first.');
});

// ---------- 2.6 keys are not remembered by default ----------

// Why: a new judge on a shared school computer must not leave a paid key behind (D1), and no current judge may lose a key on upgrade.
test('resolveRememberKeys: 4 cases', () => {
  assert.equal(L.resolveRememberKeys(undefined, false), false, 'new install: off');
  assert.equal(L.resolveRememberKeys(undefined, true), true, 'upgrade with stored keys: on, so no key is lost');
  assert.equal(L.resolveRememberKeys(false, true), false, 'a saved choice wins');
  assert.equal(L.resolveRememberKeys(true, false), true, 'a saved choice wins');
});

// Why: restoring a backup with keys while Remember is off must not write the keys to disk behind the judge's back (Q-3).
test('splitRestoreKeys: with Remember off, keys go to this tab and the restored settings say Remember is off', () => {
  const entries = {
    'policyJudge.keys.v1': '{"openai":"sk-test-0000"}', 'policyJudge.key': '"sk-ant-test-0000"',
    'policyJudge.settings.v1': '{"rememberKeys":true,"chunkSec":8}', 'policyJudge.round.v1': '{}',
  };
  const { local, session } = L.splitRestoreKeys(entries, false, 'policyJudge.settings.v1');
  assert.deepEqual(Object.keys(session).sort(), ['policyJudge.key', 'policyJudge.keys.v1']);
  assert.ok(!('policyJudge.keys.v1' in local) && !('policyJudge.key' in local));
  assert.equal(JSON.parse(local['policyJudge.settings.v1']).rememberKeys, false);
  assert.equal(JSON.parse(local['policyJudge.settings.v1']).chunkSec, 8);
  assert.equal(local['policyJudge.round.v1'], '{}');
  assert.ok('policyJudge.keys.v1' in entries, 'the input is not changed');
});

// Why: with Remember on, restored keys must stay on disk, or the judge loses them at the next tab close.
test('splitRestoreKeys: with Remember on, keys stay local; a backup without keys is left alone', () => {
  const entries = { 'policyJudge.keys.v1': '{"openai":"sk-test-0000"}', 'policyJudge.settings.v1': '{"rememberKeys":false}' };
  const on = L.splitRestoreKeys(entries, true, 'policyJudge.settings.v1');
  assert.deepEqual(on.session, {});
  assert.equal(on.local['policyJudge.keys.v1'], entries['policyJudge.keys.v1']);
  assert.equal(JSON.parse(on.local['policyJudge.settings.v1']).rememberKeys, true);
  const none = L.splitRestoreKeys({ 'policyJudge.settings.v1': '{"rememberKeys":true}' }, false, 'policyJudge.settings.v1');
  assert.deepEqual(none, { local: { 'policyJudge.settings.v1': '{"rememberKeys":true}' }, session: {} });
});

// Why: the restore dialog must say truthfully where restored keys will live.
test('restoreKeysLine: the three lines', () => {
  assert.equal(L.restoreKeysLine(true, false), 'API keys: included. Kept for this visit only, because Remember is off.');
  assert.equal(L.restoreKeysLine(true, true), 'API keys: included.');
  assert.equal(L.restoreKeysLine(false, true), 'API keys: not included. Your current keys stay.');
  assert.equal(L.restoreKeysLine(false, false), 'API keys: not included. Your current keys stay.');
});

// ---------- 2.7 no paid AI call runs by itself ----------

// Why: a missing setting must never mean "on", or a judge pays for AI calls they never asked for (D2).
test('autoEvalDefault and liveFlowDefault: undefined is false; only true is true', () => {
  for (const f of [L.autoEvalDefault, L.liveFlowDefault]) {
    assert.equal(f(undefined), false);
    assert.equal(f(null), false);
    assert.equal(f(false), false);
    assert.equal(f('true'), false);
    assert.equal(f(true), true);
  }
});

// Why: old "on" values came from the old default, not a choice (Q-2); the reset must run once, then respect what the judge picks.
test('d2Reset: turns both off once, then never again', () => {
  assert.deepEqual(L.d2Reset({ autoEval: true, liveFlow: true }), { autoEval: false, liveFlow: false, d2Reset: true });
  assert.deepEqual(L.d2Reset(undefined), { autoEval: false, liveFlow: false, d2Reset: true });
  assert.equal(L.d2Reset({ d2Reset: true, autoEval: true, liveFlow: true }), null);
});

// Why: the note must show once, when AI first works, and never cover a running clock.
test('needsD2Note: only when AI is ready, not shown yet, and no clock runs', () => {
  assert.equal(L.needsD2Note({ aiReady: true, shown: false, clockRunning: false }), true);
  assert.equal(L.needsD2Note({ aiReady: false, shown: false, clockRunning: false }), false);
  assert.equal(L.needsD2Note({ aiReady: true, shown: true, clockRunning: false }), false);
  assert.equal(L.needsD2Note({ aiReady: true, shown: false, clockRunning: true }), false);
  assert.equal(L.needsD2Note(undefined), false);
});

// ---------- review fixes (2026-11-20) ----------

// Why: a restored backup must replace the tab's keys; a stale tab key for a provider the backup lacks would keep paying that provider.
test('restoreTabKeys: a backup with keys replaces every tab key; a provider not in the backup is not kept', () => {
  const oldTab = { 'policyJudge.keys.v1': '{"openai":"sk-test-0000"}', 'policyJudge.key': '"sk-ant-test-0000"' };
  const session = { 'policyJudge.keys.v1': '{"xai":"xai-test-0000"}' };
  assert.deepEqual(L.restoreTabKeys(oldTab, session, true), { 'policyJudge.keys.v1': '{"xai":"xai-test-0000"}' });
  assert.deepEqual(L.restoreTabKeys(oldTab, {}, true), {}, 'a keys backup with no tab entries leaves the tab with none');
  assert.deepEqual(oldTab['policyJudge.key'], '"sk-ant-test-0000"', 'the old entries object is not changed');
});

// Why: the restore dialog promises "Your current keys stay" for a backup without keys; dropping them would cut the judge off mid-tournament.
test('restoreTabKeys: a backup without keys keeps the tab keys, and moved local keys win', () => {
  const oldTab = { 'policyJudge.keys.v1': '{"openai":"sk-test-0000"}' };
  assert.deepEqual(L.restoreTabKeys(oldTab, {}, false), oldTab);
  assert.deepEqual(L.restoreTabKeys(oldTab, { 'policyJudge.keys.v1': '{"google":"AIza-test"}' }, false), { 'policyJudge.keys.v1': '{"google":"AIza-test"}' });
  assert.deepEqual(L.restoreTabKeys(undefined, undefined, false), {});
});

// Why: Undo after a new round started would drop an old round's sheet, with its flow notes, into the new round.
test('undoSheetDelete: the sheet comes back only into the round it was deleted from', () => {
  const sheet = { name: 'DA', cells: { a: 1 } };
  const round = { id: 'r1', flows: [{ name: 'T' }, { name: 'K' }] };
  const back = L.undoSheetDelete(round, { roundId: 'r1', index: 1, item: sheet });
  assert.deepEqual(back.flows.map((f) => f.name), ['T', 'DA', 'K']);
  assert.equal(back.flowIdx, 1);
  assert.equal(round.flows.length, 2, 'the round is not changed in place');
  assert.equal(L.undoSheetDelete({ id: 'r2', flows: [] }, { roundId: 'r1', index: 0, item: sheet }), null);
  assert.equal(L.undoSheetDelete(round, { index: 0, item: sheet }), null, 'no round id means no restore');
  assert.equal(L.undoSheetDelete(round, null), null);
});

// Why: if the list got shorter since the delete, the restored sheet must still be the selected one, or the judge edits the wrong sheet.
test('undoSheetDelete: an index past the end clamps, and flowIdx points at the restored sheet', () => {
  const sheet = { name: 'CP' };
  const back = L.undoSheetDelete({ id: 'r1', flows: [{ name: 'T' }] }, { roundId: 'r1', index: 5, item: sheet });
  assert.equal(back.flows[back.flowIdx], sheet);
  assert.equal(back.flowIdx, 1);
});
