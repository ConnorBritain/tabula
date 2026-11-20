// AI provider layer: what each provider can do, how to get a key, and how to build and read requests.
// Pure functions only (no DOM, no network), so Node tests can load it.
(function (root) {
  'use strict';

  // Plain-language setup help, shown inside the app. Keep steps short; links go to each provider's own key page.
  const PROVIDERS = {
    google: {
      name: 'Google Gemini', short: 'Gemini', prefix: 'AIza', ai: true, transcribe: true, pdf: true,
      keyUrl: 'https://aistudio.google.com/apikey',
      cost: 'Use a key with billing turned on: free-tier data may be used by Google.',
      steps: ['Open Google AI Studio and sign in with any Google account.', 'Click "Create API key".', 'Copy the key. It starts with AIza.', 'Paste it in the box above and click Connect.'],
    },
    openai: {
      name: 'OpenAI', short: 'OpenAI', prefix: 'sk-', ai: true, transcribe: true, pdf: true,
      keyUrl: 'https://platform.openai.com/api-keys',
      cost: 'Pay as you go. Add a few dollars of credit under Billing first. A ChatGPT Plus plan does not include this.',
      steps: ['Open the OpenAI API keys page and sign in.', 'Add credit under Settings → Billing (needed before keys work).', 'Click "Create new secret key" and copy it. It starts with sk-.', 'Paste it in the box above and click Connect.'],
    },
    anthropic: {
      name: 'Anthropic Claude', short: 'Claude', prefix: 'sk-ant-', ai: true, transcribe: false, pdf: true,
      keyUrl: 'https://console.anthropic.com/settings/keys',
      cost: 'Pay as you go. Buy credit under Billing first. A Claude Pro plan does not include this. No transcription: pair it with a key that transcribes, or use the free browser kind.',
      steps: ['Open the Anthropic Console and sign in.', 'Buy credit under Billing (needed before keys work).', 'Click "Create Key" and copy it. It starts with sk-ant-.', 'Paste it in the box above and click Connect.'],
    },
    xai: {
      name: 'xAI Grok', short: 'Grok', prefix: 'xai-', ai: true, transcribe: true, pdf: false,
      keyUrl: 'https://console.x.ai',
      cost: 'Pay as you go. Add credit in the xAI console first.',
      steps: ['Open the xAI console and sign in.', 'Add credit under Billing.', 'Open "API Keys", create a key and copy it. It starts with xai-.', 'Paste it in the box above and click Connect.'],
    },
    openrouter: {
      name: 'OpenRouter', short: 'OpenRouter', prefix: 'sk-or-', ai: true, transcribe: false, pdf: false,
      keyUrl: 'https://openrouter.ai/keys',
      cost: 'One key reaches models from many companies. Pay as you go: add credit first. No transcription: pair it with another key, or use the free browser kind.',
      steps: ['Open OpenRouter and sign in.', 'Add credit under Credits.', 'Open "Keys", create a key and copy it. It starts with sk-or-.', 'Paste it in the box above and click Connect.'],
    },
  };

  // Subscriptions run through the official app already logged in on this computer, via the local helper.
  const SUBSCRIPTIONS = {
    'claude-cli': { name: 'Claude subscription', via: 'Claude Code', ai: true, transcribe: false },
    'codex-cli': { name: 'ChatGPT subscription', via: 'Codex', ai: true, transcribe: false },
  };

  // Guess the provider from the first letters of a pasted key. Order matters: sk-ant- before sk-.
  function detectProvider(key) {
    const k = String(key || '').trim();
    if (k.startsWith('sk-ant-')) return 'anthropic';
    if (k.startsWith('sk-or-')) return 'openrouter'; // before OpenAI: both start with sk-
    if (k.startsWith('xai-')) return 'xai';
    if (k.startsWith('AIza')) return 'google';
    if (k.startsWith('sk-')) return 'openai';
    return null;
  }

  // Model ids change often, so we read each provider's live list and pick from it.
  const SKIP = /(embed|tts|image|imagine|dall|realtime|audio|moderation|search|vision-preview|voice|whisper|transcribe|davinci|babbage|instruct|aqa|learnlm|gemma|banana|veo|lyria|computer)/i;
  function versionScore(id) {
    // A date stamp (claude-haiku-4-5-20251001) is not a version number, so drop it first.
    const m = String(id).replace(/[-.@]\d{6,}/g, '').match(/(\d+)(?:[.-](\d+))?(?:[.-](\d+))?/);
    return m ? (+m[1]) * 1e6 + (+(m[2] || 0)) * 1e3 + (+(m[3] || 0)) : 0;
  }
  // Cost rules for bring-your-own-key use. A round makes dozens of AI calls, so the model choice sets the bill:
  // Opus for every call was about $19 a round; a small model is about $0.25.
  // 'ai'   = every routine call (live flow, Live Eval, analysis): the small, cheap model.
  // 'deep' = the ballot filler and the decision draft: a mid-tier model.
  // Premium models are picked only when the judge chooses one in Settings.
  // These name patterns are a heuristic for live model lists. Hosted AI (plan step C1) must use an explicit
  // server-side model map with prices instead of extending them.
  const PREMIUM = /(opus|fable|mythos|astra|ultra)/i;
  const TIER = {
    ai: { anthropic: /haiku/i, openai: /luna|mini/i, google: /flash/i, xai: /fast|mini/i, openrouter: /\b(haiku|luna|flash|mini)\b/i },
    deep: { anthropic: /sonnet/i, openai: /\bsol\b/i, google: /\bpro\b/i, xai: /^grok-[\d.]+$/i, openrouter: /sonnet|\bsol\b|gemini-[\d.]+-pro\b/i },
  };
  // Transcription models the provider has retired or announced for shutdown.
  const DEPRECATED = /^gpt-4o(-mini)?-transcribe$/i;
  const isPremium = (id) => PREMIUM.test(String(id));
  const isDeprecated = (id) => DEPRECATED.test(String(id));
  const newest = (a, b) => versionScore(b) - versionScore(a);
  // The chat models on a live list (no image, voice, embedding or dated snapshot models), newest first.
  function chatModels(provider, ids) {
    const list = (ids || []).map(String).map((s) => s.replace(/^models\//, ''));
    let pool = list.filter((id) => !SKIP.test(id));
    if (provider === 'openai') pool = pool.filter((id) => /^(gpt|o\d)/i.test(id) && !/nano|preview|search|chat-latest|codex|\d{4}-\d{2}-\d{2}/i.test(id));
    if (provider === 'google') pool = pool.filter((id) => /^gemini/i.test(id) && !/lite|preview|exp|tuning|thinking|nano/i.test(id));
    if (provider === 'xai') pool = pool.filter((id) => /^grok/i.test(id) && !/non-reasoning|code|-\d{4}/i.test(id));
    // OpenRouter: "vendor/model" ids; skip batch-only (:batch), moving aliases (~...) and media models.
    // "-pro" OpenAI-style models are top-price there, so they are never picked automatically.
    if (provider === 'openrouter') pool = pool.filter((id) => id.includes('/') && !/[:~]|image|audio|vision|embed|guard|lite|(gpt|o\d)[\w.-]*-pro\b/i.test(id));
    if (!pool.length) pool = list.filter((id) => !SKIP.test(id));
    return pool.sort(newest);
  }
  function pickModel(provider, ids, purpose) {
    const list = (ids || []).map(String).map((s) => s.replace(/^models\//, ''));
    // Gemini transcribes with its routine chat model.
    if (purpose === 'transcribe' && provider === 'google') purpose = 'ai';
    if (purpose === 'transcribe') {
      const tr = list.filter((id) => /transcribe/i.test(id) && !/diarize/i.test(id) && !isDeprecated(id));
      const plain = tr.filter((id) => !/mini/i.test(id));
      return (plain.sort(newest)[0] || tr.sort(newest)[0]) || (list.includes('whisper-1') ? 'whisper-1' : null);
    }
    const pool = chatModels(provider, list).filter((id) => !isPremium(id));
    const tiers = purpose === 'deep' ? [TIER.deep[provider], TIER.ai[provider]] : [TIER.ai[provider]];
    for (const want of tiers) { const hit = want && pool.find((id) => want.test(id)); if (hit) return hit; }
    return pool[0] || null; // null when the list has only premium models: the judge must choose one on purpose
  }
  // Drops saved automatic picks that break the cost rules: a premium model, a retired transcriber,
  // or a mid-tier model saved for routine calls by an older version.
  function cleanSavedModels(models) {
    const out = {};
    for (const [prov, m] of Object.entries(models || {})) {
      out[prov] = {};
      for (const [purpose, id] of Object.entries(m || {})) {
        if (!id) continue;
        if (purpose === 'transcribe' ? isDeprecated(id) : isPremium(id)) continue;
        if (purpose === 'ai' && TIER.deep[prov] && TIER.deep[prov].test(id) && !(TIER.ai[prov] && TIER.ai[prov].test(id))) continue;
        out[prov][purpose] = id;
      }
    }
    return out;
  }
  // Output cap per kind of call, so one runaway reply cannot bill tens of thousands of tokens.
  // Thinking counts toward the cap. 'flow' is above the plan's 4k because thinking stays on until step B3.
  const OUTPUT_CAP = { flow: 6000, routine: 8000, ballot: 8000, decision: 8000 };
  const outputCap = (kind) => OUTPUT_CAP[kind] || OUTPUT_CAP.routine;
  // Claude request settings. Server-side refusal fallbacks exist for Sonnet and larger models; Haiku has none.
  const supportsFallback = (model) => !/haiku/i.test(String(model));
  function claudeParams(model, params) {
    const p = Object.assign({ model }, params);
    if (supportsFallback(model)) { p.betas = ['server-side-fallback-2026-07-01']; p.fallbacks = 'default'; }
    return p;
  }
  // Runs a model call; if the model is retired (404), forgets it and runs once more with a fresh pick.
  // run() may throw an error with .status or return a response with .status.
  async function retryOnce404(run, forget) {
    const is404 = (x) => Boolean(x) && x.status === 404;
    try { const r = await run(); if (!is404(r)) return r; }
    catch (err) { if (!is404(err)) throw err; }
    forget();
    return run();
  }

  function modelsRequest(provider, key) {
    if (provider === 'google') return { url: 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', init: { headers: { 'x-goog-api-key': key } } };
    if (provider === 'openai') return { url: 'https://api.openai.com/v1/models', init: { headers: { Authorization: 'Bearer ' + key } } };
    if (provider === 'xai') return { url: 'https://api.x.ai/v1/models', init: { headers: { Authorization: 'Bearer ' + key } } };
    if (provider === 'openrouter') return { url: 'https://openrouter.ai/api/v1/models', init: { headers: { Authorization: 'Bearer ' + key } } };
    if (provider === 'anthropic') return { url: 'https://api.anthropic.com/v1/models', init: { headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' } } };
    return null;
  }
  function modelIds(provider, json) {
    if (provider === 'google') return ((json && json.models) || []).filter((m) => !m.supportedGenerationMethods || m.supportedGenerationMethods.includes('generateContent')).map((m) => String(m.name || '').replace(/^models\//, ''));
    return ((json && json.data) || []).map((m) => m.id);
  }

  // Docs as plain text, for providers or paths that cannot read PDFs.
  function docsAsText(docs, title) {
    const parts = [];
    const skipped = [];
    for (const d of docs || []) {
      if (!d || !d.data) continue;
      if (d.kind === 'pdf') { skipped.push(d.name); continue; }
      parts.push('=== ' + title(d) + ' ===\n' + d.data);
    }
    if (skipped.length) parts.push('(PDF docs not readable by this AI, so not included: ' + skipped.join(', ') + '. The judge can save them as text or .docx.)');
    return parts.join('\n\n');
  }

  // Builds a request for OpenAI, Google or xAI. Anthropic uses its own SDK in the page.
  // schema = JSON Schema for a JSON reply, or null for plain text.
  function buildAIRequest(provider, o) {
    const { key, model, system, prompt, docs, schema, title, note } = o;
    const maxTokens = o.maxTokens || outputCap('routine');
    const head = (note && (docs || []).length ? note + '\n\n' : '');
    if (provider === 'openai') {
      const content = [];
      for (const d of docs || []) {
        if (!d || !d.data) continue;
        if (d.kind === 'pdf') content.push({ type: 'input_file', filename: d.name, file_data: 'data:application/pdf;base64,' + d.data });
        else content.push({ type: 'input_text', text: '=== ' + title(d) + ' ===\n' + d.data });
      }
      content.push({ type: 'input_text', text: head + prompt });
      const body = { model, instructions: system, input: [{ role: 'user', content }], max_output_tokens: maxTokens };
      if (schema) body.text = { format: { type: 'json_schema', name: 'reply', schema, strict: true } };
      return { url: 'https://api.openai.com/v1/responses', init: { method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) } };
    }
    if (provider === 'xai' || provider === 'openrouter') {
      // Both use the OpenAI-style chat format. Docs go as text (PDFs are listed, not read).
      const docText = docsAsText(docs, title);
      const body = { model, max_tokens: maxTokens, messages: [{ role: 'system', content: system }, { role: 'user', content: (docText ? docText + '\n\n' : '') + head + prompt }] };
      if (schema) body.response_format = { type: 'json_schema', json_schema: { name: 'reply', schema, strict: true } };
      // OpenRouter: route only to hosts that support the reply format the app asks for.
      if (schema && provider === 'openrouter') body.provider = { require_parameters: true };
      const url = provider === 'xai' ? 'https://api.x.ai/v1/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions';
      return { url, init: { method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) } };
    }
    if (provider === 'google') {
      const parts = [];
      for (const d of docs || []) {
        if (!d || !d.data) continue;
        if (d.kind === 'pdf') { parts.push({ text: '=== ' + title(d) + ' (PDF below) ===' }); parts.push({ inline_data: { mime_type: 'application/pdf', data: d.data } }); }
        else parts.push({ text: '=== ' + title(d) + ' ===\n' + d.data });
      }
      parts.push({ text: head + prompt + (schema ? '\n\nReply with only a JSON object that matches this JSON Schema:\n' + JSON.stringify(schema) : '') });
      const body = { systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts }], generationConfig: { maxOutputTokens: maxTokens } };
      if (schema) body.generationConfig.responseMimeType = 'application/json';
      return { url: 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent', init: { method: 'POST', headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) } };
    }
    throw new Error('unknown provider ' + provider);
  }

  // Reads the text out of a reply, and says plainly when the reply was cut off or refused.
  function parseAIResponse(provider, json) {
    const j = json || {};
    if (provider === 'openai') {
      if (j.status === 'incomplete') throw new Error('the reply was cut off (' + ((j.incomplete_details || {}).reason || 'incomplete') + ')');
      if (typeof j.output_text === 'string' && j.output_text) return j.output_text;
      const out = [];
      for (const item of j.output || []) for (const c of item.content || []) {
        if (c.type === 'refusal') throw new Error('the AI declined this request');
        if (c.type === 'output_text' && c.text) out.push(c.text);
      }
      return out.join('');
    }
    if (provider === 'xai' || provider === 'openrouter') {
      const ch = (j.choices || [])[0] || {};
      if (ch.finish_reason === 'length') throw new Error('the reply was cut off');
      if (ch.message && ch.message.refusal) throw new Error('the AI declined this request');
      return (ch.message && ch.message.content) || '';
    }
    if (provider === 'google') {
      const c = (j.candidates || [])[0];
      if (!c) throw new Error('no reply' + (j.promptFeedback && j.promptFeedback.blockReason ? ' (blocked: ' + j.promptFeedback.blockReason + ')' : ''));
      if (c.finishReason === 'MAX_TOKENS') throw new Error('the reply was cut off');
      if (c.finishReason === 'SAFETY') throw new Error('the AI declined this request');
      return ((c.content && c.content.parts) || []).map((p) => p.text || '').join('');
    }
    throw new Error('unknown provider ' + provider);
  }

  // Pulls a JSON object out of a reply, even if it is wrapped in a code fence.
  function extractJson(text) {
    const t = String(text || '').trim();
    try { return JSON.parse(t); } catch {}
    const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) { try { return JSON.parse(fence[1]); } catch {} }
    const a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1));
    throw new Error('the reply was not valid JSON');
  }

  // Which engines can do which job, given the connected keys and whether the local helper is running.
  function engineOptions(keys, helper) {
    const k = keys || {};
    const ai = [], tr = [{ id: 'browser', label: 'Browser (free, built into Chrome)' }];
    for (const [id, p] of Object.entries(PROVIDERS)) {
      if (!k[id]) continue;
      if (p.ai) ai.push({ id, label: p.name });
      if (p.transcribe) tr.push({ id, label: p.name });
    }
    for (const [id, s] of Object.entries(SUBSCRIPTIONS)) if (helper && helper[id]) ai.push({ id, label: s.name + ' (via ' + s.via + ')' });
    return { ai, tr };
  }

  const api = { PROVIDERS, SUBSCRIPTIONS, detectProvider, pickModel, chatModels, isPremium, isDeprecated, cleanSavedModels, outputCap, claudeParams, retryOnce404, modelsRequest, modelIds, docsAsText, buildAIRequest, parseAIResponse, extractJson, engineOptions };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Providers = api;
})(typeof window !== 'undefined' ? window : globalThis);
