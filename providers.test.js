// Run with: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('./providers.js');
const title = (d) => d.side.toUpperCase() + ' doc: ' + d.name;

// Why: laypeople paste a key without knowing which company it is from; a wrong guess sends it to the wrong provider.
test('detects the provider from the start of a pasted key', () => {
  assert.equal(P.detectProvider('sk-ant-api03-abc'), 'anthropic');
  assert.equal(P.detectProvider('  sk-proj-abc  '), 'openai');
  assert.equal(P.detectProvider('sk-abc'), 'openai');
  assert.equal(P.detectProvider('xai-abc'), 'xai');
  assert.equal(P.detectProvider('AIzaSyabc'), 'google');
  assert.equal(P.detectProvider('hello'), null);
});

// Why: the setup screen must not offer a provider for a job it cannot do (Claude cannot transcribe).
test('capability table: who does AI and who does transcription', () => {
  assert.equal(P.PROVIDERS.anthropic.transcribe, false);
  for (const id of ['google', 'openai', 'xai']) assert.equal(P.PROVIDERS[id].transcribe, true);
  for (const id of Object.keys(P.PROVIDERS)) {
    assert.equal(P.PROVIDERS[id].ai, true);
    assert.ok(P.PROVIDERS[id].keyUrl.startsWith('https://'));
    assert.ok(P.PROVIDERS[id].steps.length >= 3, id + ' has step-by-step help');
  }
  const o = P.engineOptions({ anthropic: 'k', google: 'k' }, { 'claude-cli': true });
  assert.deepEqual(o.ai.map((x) => x.id), ['google', 'anthropic', 'claude-cli']);
  assert.deepEqual(o.tr.map((x) => x.id), ['browser', 'google']);
});

// Why: hard-coded model names break when providers rename models; picking from the live list must choose a chat model.
// CHANGED in step A2 (cost fixes): the default 'ai' pick was the flagship ('gpt-6.2-astra'); it is now the cheap model,
// because a flagship default cost a judge about $19 a round. The old expectation was:
//   assert.equal(P.pickModel('openai', [...same list...]), 'gpt-6.2-astra');
test('picks a chat model from the live list and skips image, voice and embedding models', () => {
  assert.equal(P.pickModel('openai', ['text-embedding-3', 'gpt-6.2-mini', 'gpt-6.2-astra', 'gpt-4o', 'gpt-transcribe']), 'gpt-6.2-mini');
  assert.equal(P.pickModel('xai', ['grok-4.6', 'grok-4.7', 'grok-4.20-0309-reasoning', 'grok-imagine-image-2.0', 'grok-voice-transcribe-2.0']), 'grok-4.7');
  assert.equal(P.pickModel('google', ['models/text-embedding-004', 'models/gemini-3.8-flash-lite', 'models/gemini-3.8-flash']), 'gemini-3.8-flash');
  assert.equal(P.pickModel('openai', ['gpt-4o-transcribe', 'gpt-transcribe', 'whisper-1'], 'transcribe'), 'gpt-transcribe');
  assert.equal(P.pickModel('xai', ['grok-4.7', 'grok-voice-transcribe-2.0'], 'transcribe'), 'grok-voice-transcribe-2.0');
  assert.equal(P.pickModel('openai', ['whisper-1'], 'transcribe'), 'whisper-1');
});

// Why: each provider wants a different request shape; a wrong shape means every flow update fails.
test('builds OpenAI, xAI and Gemini requests with docs and a JSON schema', () => {
  const docs = [{ name: 'aff.pdf', side: 'aff', kind: 'pdf', data: 'QUJD' }, { name: '1NC.txt', side: 'neg', kind: 'text', data: 'T shell' }];
  const schema = { type: 'object', properties: { a: { type: 'string' } }, required: ['a'], additionalProperties: false };
  const base = { key: 'K', model: 'M', system: 'SYS', prompt: 'PROMPT', docs, schema, title, note: 'NOTE' };

  const o = P.buildAIRequest('openai', base);
  const ob = JSON.parse(o.init.body);
  assert.equal(o.url, 'https://api.openai.com/v1/responses');
  assert.equal(o.init.headers.Authorization, 'Bearer K');
  assert.equal(ob.instructions, 'SYS');
  assert.deepEqual(ob.input[0].content[0], { type: 'input_file', filename: 'aff.pdf', file_data: 'data:application/pdf;base64,QUJD' });
  assert.ok(ob.input[0].content.at(-1).text.startsWith('NOTE'));
  assert.deepEqual(ob.text.format, { type: 'json_schema', name: 'reply', schema, strict: true });

  const x = JSON.parse(P.buildAIRequest('xai', base).init.body);
  assert.equal(x.messages[0].content, 'SYS');
  assert.ok(x.messages[1].content.includes('T shell'));
  assert.ok(x.messages[1].content.includes('not included: aff.pdf'), 'Grok cannot read PDFs, so the judge is told');
  assert.equal(x.response_format.json_schema.strict, true);

  const g = P.buildAIRequest('google', base);
  const gb = JSON.parse(g.init.body);
  assert.ok(g.url.endsWith('/models/M:generateContent'));
  assert.equal(g.init.headers['x-goog-api-key'], 'K');
  assert.deepEqual(gb.contents[0].parts[1], { inline_data: { mime_type: 'application/pdf', data: 'QUJD' } });
  assert.ok(gb.contents[0].parts.at(-1).text.includes('"required":["a"]'), 'schema is in the prompt');
  assert.equal(gb.generationConfig.responseMimeType, 'application/json');

  const plain = JSON.parse(P.buildAIRequest('openai', { ...base, schema: null }).init.body);
  assert.equal(plain.text, undefined, 'no schema means a plain-text reply');
});

// Why: a cut-off or refused reply must say so, not show a confusing JSON error.
test('reads replies and reports cut-offs and refusals in plain words', () => {
  assert.equal(P.parseAIResponse('openai', { output: [{ type: 'message', content: [{ type: 'output_text', text: '{"a":1}' }] }] }), '{"a":1}');
  assert.throws(() => P.parseAIResponse('openai', { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } }), /cut off/);
  assert.equal(P.parseAIResponse('xai', { choices: [{ message: { content: 'hi' }, finish_reason: 'stop' }] }), 'hi');
  assert.throws(() => P.parseAIResponse('xai', { choices: [{ message: { content: '' }, finish_reason: 'length' }] }), /cut off/);
  assert.equal(P.parseAIResponse('google', { candidates: [{ content: { parts: [{ text: 'a' }, { text: 'b' }] }, finishReason: 'STOP' }] }), 'ab');
  assert.throws(() => P.parseAIResponse('google', { candidates: [{ finishReason: 'SAFETY' }] }), /declined/);
  assert.deepEqual(P.extractJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(P.extractJson('Sure: {"a":2} done'), { a: 2 });
  assert.throws(() => P.extractJson('no json'), /not valid JSON/);
});

// Why: a flagship default (Opus, Astra) costs a judge about 50 times more per round than a small model; the default must be the cheap one.
test('the default AI model is the cheap one for every provider, never a premium model', () => {
  const claude = ['claude-opus-5-5', 'claude-fable-5-2', 'claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-haiku-4-5', 'claude-mythos-5-2'];
  assert.equal(P.pickModel('anthropic', claude, 'ai'), 'claude-haiku-5-5');
  assert.equal(P.pickModel('openai', ['gpt-6.2-astra', 'gpt-6.2-sol', 'gpt-6-luna'], 'ai'), 'gpt-6-luna');
  assert.equal(P.pickModel('google', ['gemini-3.8-pro', 'gemini-3.8-flash'], 'ai'), 'gemini-3.8-flash');
  assert.equal(P.pickModel('xai', ['grok-4.7', 'grok-4.7-fast'], 'ai'), 'grok-4.7-fast');
  for (const p of ['anthropic', 'openai', 'google', 'xai']) assert.ok(!P.isPremium(P.pickModel(p, claude.concat(['gpt-6.2-astra', 'gpt-6-luna', 'gemini-3.8-flash', 'grok-4.7-fast']), 'ai') || ''), p);
});

// Why: the ballot and the decision need a stronger model than the live flow, but still not a premium one that costs dollars per click.
test('the deep model is mid-tier (Sonnet, Sol, Pro), never premium', () => {
  assert.equal(P.pickModel('anthropic', ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-sonnet-5', 'claude-haiku-5-5'], 'deep'), 'claude-sonnet-5-5');
  assert.equal(P.pickModel('openai', ['gpt-6.2-astra', 'gpt-6.2-sol', 'gpt-6-luna'], 'deep'), 'gpt-6.2-sol');
  assert.equal(P.pickModel('google', ['gemini-3.8-pro', 'gemini-3.8-flash'], 'deep'), 'gemini-3.8-pro');
  assert.ok(!P.isPremium(P.pickModel('anthropic', ['claude-opus-5-5', 'claude-haiku-5-5'], 'deep')), 'falls back to a cheap model, not Opus');
  assert.equal(P.pickModel('anthropic', ['claude-opus-5-5'], 'ai'), null, 'a premium model is never picked automatically');
  assert.equal(P.pickModel('google', ['gemini-3.8-pro', 'gemini-3.8-flash'], 'transcribe'), 'gemini-3.8-flash', 'Gemini transcribes with its cheap model');
});

// Why: a saved model the provider retires (gpt-4o-transcribe shuts down in Feb 2027) silently stops all transcription mid-season.
test('transcription never defaults to a deprecated model, and saved old picks are dropped', () => {
  assert.equal(P.pickModel('openai', ['gpt-4o-transcribe', 'gpt-4o-mini-transcribe', 'whisper-1'], 'transcribe'), 'whisper-1');
  assert.ok(P.isDeprecated('gpt-4o-transcribe') && P.isDeprecated('gpt-4o-mini-transcribe') && !P.isDeprecated('gpt-transcribe'));
  const fixed = P.cleanSavedModels({ openai: { ai: 'gpt-6.2-astra', transcribe: 'gpt-4o-transcribe' }, anthropic: { ai: 'claude-haiku-5-5', deep: 'claude-sonnet-5-5' }, google: { ai: 'gemini-3.8-pro' } });
  assert.deepEqual(fixed, { openai: {}, anthropic: { ai: 'claude-haiku-5-5', deep: 'claude-sonnet-5-5' }, google: {} });
});

// Why: without an output cap one runaway reply can bill tens of thousands of tokens; every call must carry a cap.
test('every AI call kind has an output cap: 8k for routine, ballot and decision, 6k for the live flow', () => {
  assert.equal(P.outputCap('decision'), 8000);
  assert.equal(P.outputCap('ballot'), 8000);
  assert.equal(P.outputCap('routine'), 8000);
  assert.equal(P.outputCap('flow'), 6000);
  assert.equal(P.outputCap('anything-else'), 8000);
  const docs = [];
  const base = { key: 'K', model: 'M', system: 'S', prompt: 'P', docs, schema: null, title: (d) => d.name, maxTokens: 4321 };
  assert.equal(JSON.parse(P.buildAIRequest('openai', base).init.body).max_output_tokens, 4321);
  assert.equal(JSON.parse(P.buildAIRequest('xai', base).init.body).max_tokens, 4321);
  assert.equal(JSON.parse(P.buildAIRequest('google', base).init.body).generationConfig.maxOutputTokens, 4321);
});

// Why: Haiku has no server-side refusal fallback; sending the fallback beta to it fails every routine call.
test('Claude requests ask for refusal fallbacks only on models that have them', () => {
  const h = P.claudeParams('claude-haiku-5-5', { max_tokens: 10 });
  assert.equal(h.model, 'claude-haiku-5-5');
  assert.equal(h.max_tokens, 10);
  assert.equal(h.betas, undefined);
  assert.equal(h.fallbacks, undefined);
  const s = P.claudeParams('claude-sonnet-5-5', {});
  assert.deepEqual(s.betas, ['server-side-fallback-2026-07-01']);
  assert.equal(s.fallbacks, 'default');
});

// Why: providers retire models mid-season; without one retry with a fresh pick, every call fails until the judge reconnects.
test('a retired model (404) is forgotten and the call is retried once, never more', async () => {
  let calls = 0, forgot = 0;
  const thrown = await P.retryOnce404(async () => { calls++; if (calls === 1) { const e = new Error('gone'); e.status = 404; throw e; } return 'ok'; }, () => forgot++);
  assert.equal(thrown, 'ok'); assert.equal(calls, 2); assert.equal(forgot, 1);
  calls = 0; forgot = 0;
  const res = await P.retryOnce404(async () => { calls++; return { status: 404 }; }, () => forgot++);
  assert.equal(res.status, 404, 'a second 404 is returned, not retried again'); assert.equal(calls, 2); assert.equal(forgot, 1);
  calls = 0; forgot = 0;
  await assert.rejects(P.retryOnce404(async () => { calls++; const e = new Error('bad key'); e.status = 401; throw e; }, () => forgot++), /bad key/);
  assert.equal(calls, 1); assert.equal(forgot, 0);
});

// Why: the Settings picker lists these; an image or voice model in the list would fail every call when chosen.
test('the model picker lists only chat models, newest first', () => {
  assert.deepEqual(P.chatModels('openai', ['text-embedding-3', 'gpt-6-luna', 'gpt-6.2-sol', 'gpt-transcribe', 'dall-e-3']), ['gpt-6.2-sol', 'gpt-6-luna']);
});

// Why: a dated snapshot id (claude-haiku-4-5-20251001) once out-ranked the newer model, so judges got an older, pricier pick.
test('a date stamp in a model id does not make an old model look newer', () => {
  assert.equal(P.pickModel('anthropic', ['claude-haiku-4-5-20251001', 'claude-haiku-5-5', 'claude-sonnet-4-5-20250929', 'claude-sonnet-5-5'], 'ai'), 'claude-haiku-5-5');
  assert.equal(P.pickModel('anthropic', ['claude-sonnet-4-5-20250929', 'claude-sonnet-5-5', 'claude-haiku-5-5'], 'deep'), 'claude-sonnet-5-5');
  assert.equal(P.chatModels('anthropic', ['claude-haiku-4-5-20251001', 'claude-haiku-5-5'])[0], 'claude-haiku-5-5');
});

// Why: an OpenRouter key also starts with "sk-"; read as an OpenAI key, every call would go to the wrong company and fail.
test('an OpenRouter key is told apart from an OpenAI key', () => {
  assert.equal(P.detectProvider('sk-or-v1-abc123'), 'openrouter');
  assert.equal(P.detectProvider('sk-proj-abc123'), 'openai');
  assert.equal(P.PROVIDERS.openrouter.transcribe, false, 'OpenRouter has no transcription endpoint');
});

// Why: OpenRouter lists hundreds of models, many of them batch-only, aliases or image models; picking one of those would fail every call.
test('OpenRouter: picks a usable chat model and builds a chat request', () => {
  const ids = ['~anthropic/claude-haiku-latest', 'anthropic/claude-haiku-5.5:batch', 'anthropic/claude-opus-5.5', 'anthropic/claude-haiku-5.5', 'google/gemini-3.1-flash-image', 'openai/gpt-oss-120b'];
  const pick = P.pickModel('openrouter', ids, 'ai');
  assert.ok(!/[:~]|image|opus/.test(pick), 'picked ' + pick);
  assert.ok(P.chatModels('openrouter', ids).every((id) => !/[:~]|image/.test(id)));
  const req = P.buildAIRequest('openrouter', { key: 'K', model: 'anthropic/claude-haiku-5.5', system: 'S', prompt: 'P', docs: [], schema: { type: 'object' }, title: (d) => d.name, maxTokens: 900 });
  assert.equal(req.url, 'https://openrouter.ai/api/v1/chat/completions');
  const body = JSON.parse(req.init.body);
  assert.equal(body.model, 'anthropic/claude-haiku-5.5');
  assert.equal(body.max_tokens, 900);
  assert.equal(body.response_format.type, 'json_schema');
  assert.equal(P.parseAIResponse('openrouter', { choices: [{ message: { content: 'hi' } }] }), 'hi');
  assert.equal(P.modelsRequest('openrouter', 'K').url, 'https://openrouter.ai/api/v1/models');
  assert.equal(P.pickModel('openrouter', ['anthropic/claude-opus-5.5', 'anthropic/claude-sonnet-5.5', 'anthropic/claude-haiku-5.5'], 'deep'), 'anthropic/claude-sonnet-5.5', 'deep tier is mid-tier, never premium');
});

// Why: the owner decided the app must not advertise one model or company over another; a "best value" line coming back would break that promise to judges.
test('user-facing copy does not favor one model or company', () => {
  const fs = require('node:fs'), path = require('node:path');
  for (const f of ['index.html', 'app.js', 'providers.js', 'core/ai.js', 'README.md']) {
    assert.doesNotMatch(fs.readFileSync(path.join(__dirname, f), 'utf8'), /best value|cheapest|cents a round|GPT-6 Luna/i, f);
  }
});

// Why: "gemini" contains "mini", and "-pro" models are mid or top price; on OpenRouter either would be picked for routine calls and cost a judge far more.
test('OpenRouter routine pick never lands on a Pro model', () => {
  assert.equal(P.pickModel('openrouter', ['google/gemini-3.1-pro', 'openai/gpt-5.5-pro', 'openai/gpt-6-luna'], 'ai'), 'openai/gpt-6-luna');
  assert.ok(!/pro/.test(P.pickModel('openrouter', ['google/gemini-3.1-pro', 'openai/gpt-5.5-pro', 'google/gemini-3.8-flash'], 'ai')));
  assert.notEqual(P.pickModel('openrouter', ['openai/gpt-5.5-pro', 'anthropic/claude-sonnet-5.5'], 'deep'), 'openai/gpt-5.5-pro');
  assert.equal(P.pickModel('openrouter', ['google/gemini-2.5-flash-lite', 'google/gemini-3.8-flash'], 'ai'), 'google/gemini-3.8-flash', '"lite" models are skipped, as for Gemini keys');
  const body = JSON.parse(P.buildAIRequest('openrouter', { key: 'K', model: 'm', system: 'S', prompt: 'P', docs: [], schema: { type: 'object' }, title: (d) => d.name }).init.body);
  assert.deepEqual(body.provider, { require_parameters: true }, 'only hosts that support structured replies');
});
