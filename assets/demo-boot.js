// The demo sandbox (the staged demo of the AI features, ?demo=policy or ?demo=ld). It is the first script on the page,
// so it runs before any code can read or write browser storage. In a demo page load it:
// - swaps localStorage and sessionStorage for empty stores in memory: the demo never sees the judge's real rounds,
//   history, settings or keys, and leaves nothing behind (close or leave the page and it is gone);
// - turns off the browser database (IndexedDB), where real docs and audio clips live;
// - stops every network call (fetch, XMLHttpRequest, WebSocket, EventSource, sendBeacon): the demo never calls an AI
//   provider or the Tabula server, and works offline;
// - turns off the microphone (the demo plays a recorded sample round);
// - stops "storage" events, so a real Tabula tab saving its round cannot reach into the demo.
// If storage cannot be swapped, it stops: the page then runs as the normal app (window.TabulaDemo stays null), and
// the demo never runs on real storage.
// It must be a file, not an inline script: the security rule only runs scripts from this site (script-src 'self').
(function (root) {
  'use strict';

  // The ?demo= value of a URL, lower case ('' for ?demo alone), or null when the URL is not a demo. Which sample round
  // a value opens is data: each demo/*.js file names its own value (logic/demo.js demoSample).
  function demoParamOf(search) {
    const q = new URLSearchParams(String(search || ''));
    if (!q.has('demo')) return null;
    const v = String(q.get('demo') || '').trim().toLowerCase();
    return v === 'off' || v === '0' || v === 'false' ? null : v;
  }

  // A Storage in memory with the same methods as localStorage. Values are kept as strings, as the browser does.
  function memoryStorage() {
    const map = new Map();
    return {
      get length() { return map.size; },
      key(i) { return [...map.keys()][i] ?? null; },
      getItem(k) { return map.has(String(k)) ? map.get(String(k)) : null; },
      setItem(k, v) { map.set(String(k), String(v)); },
      removeItem(k) { map.delete(String(k)); },
      clear() { map.clear(); },
    };
  }

  const NO_NETWORK = 'The demo makes no network calls.';
  // Swaps the page's storage, database, network and microphone. Returns true only if storage is really swapped.
  function sandbox(w) {
    const put = (obj, name, value) => Object.defineProperty(obj, name, { value, configurable: true, writable: true });
    const local = memoryStorage(), session = memoryStorage();
    try { put(w, 'localStorage', local); put(w, 'sessionStorage', session); } catch (e) { return false; }
    if (w.localStorage !== local || w.sessionStorage !== session) return false;
    // A database open always fails, as when the browser blocks storage; the app already handles that.
    const failedOpen = () => {
      const req = { result: null, error: new Error('The demo keeps nothing.') };
      setTimeout(() => { if (typeof req.onerror === 'function') req.onerror({ target: req }); }, 0);
      return req;
    };
    try { put(w, 'indexedDB', { open: failedOpen, deleteDatabase: failedOpen }); } catch (e) { /* the app also copes with no database */ }
    const refuse = function () { throw new Error(NO_NETWORK); };
    put(w, 'fetch', () => Promise.reject(new TypeError(NO_NETWORK)));
    put(w, 'XMLHttpRequest', refuse);
    put(w, 'WebSocket', refuse);
    put(w, 'EventSource', refuse);
    const nav = w.navigator;
    if (nav) {
      try { put(nav, 'sendBeacon', () => false); } catch (e) { /* not on every browser */ }
      if (nav.mediaDevices) {
        try { put(nav.mediaDevices, 'getUserMedia', () => Promise.reject(new Error('The demo does not use the microphone.'))); } catch (e) { /* ignore */ }
      }
    }
    // Registered first, so it runs before any other listener and stops the event for all of them.
    if (w.addEventListener) w.addEventListener('storage', (e) => e.stopImmediatePropagation(), true);
    return true;
  }

  const api = { demoParamOf, memoryStorage, sandbox };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  const param = demoParamOf(root.location && root.location.search);
  let demo = null;
  if (param != null && sandbox(root)) {
    demo = Object.freeze({ param });
    root.document.documentElement.setAttribute('data-demo', param || 'on');
  }
  Object.defineProperty(root, 'TabulaDemo', { value: demo, configurable: false, writable: false });
})(typeof window !== 'undefined' ? window : globalThis);
