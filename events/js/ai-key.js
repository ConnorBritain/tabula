// Speech Events step E13: the judge's own AI key (docs/events/LANDING.md §4.1; ARCHITECTURE.md §7, §11). It keeps the
// key, picks a cheap model from the provider's live list, and makes the one clean-up call. Hosted AI is step E14.
//
// Why here and not debate's js/ai.js callAI: the events page must not load debate files, and callAI also runs the
// hosted path, the subscription helper, the demo and debate's name swap. The shared parts it needs (providers, model
// picks, requests, replies, the key store) are already in core/ai.js; this file is only the events glue around them.
//
// No DOM. fetch, the two stores and online() are passed in, so Node tests run it with a fake provider.
import { PROVIDERS, detectProvider, modelsRequest, modelIds, pickModel, chatModels, retryOnce404, createKeyStore, outputCap } from '../../core/ai.js';
import { FEATURE, cleanupRequest, readCleanupReply } from './cleanup.js';
import { PREFIX } from './store.js';

export const KEYS_KEY = PREFIX + 'aiKeys.v1';
export const MODELS_KEY = PREFIX + 'aiModels.v1';
// A clean-up reply is a few short comments. The cap stops a runaway reply from billing the judge for thousands of tokens.
export const CAPS = Object.freeze({ routine: 2000 });
const TIMEOUT_MS = 60000;

// One error with plain words for the judge (DESIGN.md §1: say what happened and what to do). kind: 'offline' |
// 'rejected' | 'busy' | 'noModel' | 'reply' | 'failed'. The provider's own words go to the console only.
export function aiError(kind, provider) {
  const name = PROVIDERS[provider] ? PROVIDERS[provider].short : 'The AI';
  const words = {
    offline: 'You are offline. Clean-up needs the internet. Your comment is safe.',
    rejected: name + ' did not accept the key. Forget it, then connect a new one.',
    busy: name + ' is busy or out of credit. Try again in a minute.',
    noModel: 'This ' + name + ' key has no low-cost model that can do this. Try a key from another company.',
    reply: name + ' sent a reply Tabula could not read. Try again.',
    failed: 'The clean-up did not work. Your comment is safe. Try again.',
  };
  return Object.assign(new Error(words[kind] || words.failed), { kind });
}
// The error kind for an HTTP status from a provider. The debate app maps statuses in logic/rules.js classifyAIError with its
// own, longer list; a shared status-to-kind rule (no words) is a candidate for core/ai.js when E14 adds hosted calls.
export const statusKind = (status) => (status === 401 || status === 403 ? 'rejected' : status === 429 || status >= 500 ? 'busy' : 'failed');

// o: { local (the events store), session (a store over sessionStorage), fetch, online () -> boolean, policy (core/policy.js) }.
export function createOwnKey(o) {
  const keyStore = createKeyStore({ name: KEYS_KEY, local: o.local, session: o.session });
  let keys = keyStore.load();
  // One key at a time: the first saved provider.
  const provider = () => Object.keys(PROVIDERS).find((p) => keys[p]) || null;
  const models = () => o.local.get(MODELS_KEY, {}) || {};

  async function send(req) {
    try { return await o.fetch(req.url, Object.assign({}, req.init, { signal: AbortSignal.timeout(TIMEOUT_MS) })); }
    catch (err) { console.warn('AI call failed:', err); throw aiError(o.online() ? 'failed' : 'offline'); }
  }

  // The provider's live model list, and the cheap routine model from it (core/ai.js pickModel: never a premium one).
  async function listModels(p, key) {
    const res = await send(modelsRequest(p, key));
    if (!res.ok) throw aiError(statusKind(res.status), p);
    const ids = modelIds(p, await res.json().catch(() => ({})));
    const id = pickModel(p, ids, 'ai');
    if (!id) { console.warn('No low-cost chat model in the list:', chatModels(p, ids)); throw aiError('noModel', p); }
    return id;
  }
  function saveModel(p, id) { const m = models(); if (id) m[p] = id; else delete m[p]; o.local.set(MODELS_KEY, m); }
  async function modelFor(p) { const m = models()[p]; if (m) return m; const id = await listModels(p, keys[p]); saveModel(p, id); return id; }

  return Object.freeze({
    provider,
    hasKey: () => Boolean(provider()),
    providerName: () => (provider() ? PROVIDERS[provider()].name : ''),
    remembered: () => keyStore.hasSaved(),
    // Checks a pasted key against the provider (its model list), then keeps it. Returns the provider id.
    // remember: keep it on this device; else only in this tab (ARCHITECTURE.md §11: not remembered by default).
    async connect(raw, remember) {
      const key = String(raw || '').trim();
      const p = detectProvider(key);
      if (!p) throw Object.assign(new Error('This does not look like an API key from Anthropic, OpenAI, Google, xAI or OpenRouter.'), { kind: 'format' });
      if (!o.online()) throw aiError('offline');
      const id = await listModels(p, key);
      keys = { [p]: key };
      if (!keyStore.save(keys, remember)) throw Object.assign(new Error('This browser did not save the key.'), { kind: 'failed' });
      saveModel(p, id);
      return p;
    },
    forget() { keys = {}; keyStore.save({}, false); o.local.del(MODELS_KEY); },
    // The clean-up call. gate: the AI gate for this screen, checked again here so no path can call with the feature off
    // (AI-POLICY.md §3b R4). msg: cleanupMessages(...). Returns the drafts { [entryId]: text }.
    async cleanup(gate, msg) {
      if (!gate || !o.policy.canUse(gate, FEATURE)) throw aiError('failed');
      const p = provider();
      if (!p) throw aiError('rejected');
      if (!o.online()) throw aiError('offline', p);
      // A retired model (404) is forgotten and picked again once.
      const res = await retryOnce404(async () => send(cleanupRequest(p, msg, { key: keys[p], model: await modelFor(p), maxTokens: outputCap('routine', CAPS) })), () => saveModel(p, null));
      if (!res.ok) { console.warn('AI call:', res.status, await res.text().catch(() => '')); throw aiError(statusKind(res.status), p); }
      const json = await res.json().catch(() => null);
      try { return readCleanupReply(p, json, msg); }
      catch (err) { console.warn('AI reply:', err); throw aiError('reply', p); }
    },
  });
}

