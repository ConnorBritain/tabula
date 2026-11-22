// Speech Events step E13: the page wiring for AI (app.js calls it once). It reads the browser (location, sessionStorage,
// fetch, navigator) so that events/js/ai-key.js stays free of them and Node tests can run it with a fake provider.
import { createStore } from '../../core/store.js';
import { createOwnKey } from './ai-key.js';
import { PREFIX } from './store.js';

// The page's AI part (app.js): the gate, made once at app start (AI-POLICY.md §6a), and the own key. The gate has no
// server record yet (the events capabilities fetch comes with the platform), so it is the solo app; ?ai=off is the dev
// switch that proves the no-AI look (AI-POLICY.md §3e). core/policy.js is a head file, so it is on globalThis.
// store: the events store (localStorage). The tab-only key goes in a store over sessionStorage.
export function createPageAI(store) {
  const policy = globalThis.TabulaCore.policy;
  const off = new URLSearchParams(location.search).get('ai') === 'off';
  const session = createStore({ prefixes: [PREFIX], storage: globalThis.sessionStorage });
  const own = createOwnKey({ local: store, session, fetch: (url, init) => fetch(url, init), online: () => navigator.onLine !== false, policy });
  return Object.freeze({ gate: policy.gateFor({ record: null, now: Date.now(), off }), own });
}
