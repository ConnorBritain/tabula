// Tabula Speech Events: the app's store (step E1). It is kept to the tabulaEvents.* keys (core/store.js refuses any
// other name), so it can never read or write a judge's debate data. A failed save shows one warning toast.
// Every events/js file is an ES module with named exports; only app.js boots the page and imports the screens.
import { createStore } from '../../core/store.js';
import { storageKept as coreStorageKept, askToKeepOnce as coreAskToKeepOnce } from '../../core/keep-data.js';

export const PREFIX = 'tabulaEvents.';
export const ROOMS_KEY = PREFIX + 'rooms.v1';
export const SETTINGS_KEY = PREFIX + 'settings.v1'; // also named on the theme script tag in index.html
// Step S3 (EXPERIENCE.md §8.3): the judge's days and ballot cards (events/js/cards.js).
export const DAYS_KEY = PREFIX + 'days.v1';
export const CARDS_KEY = PREFIX + 'cards.v1';
// Data safety: when this device last downloaded a backup (a time in ms, nothing else), and when the app last asked the
// browser to keep its saved data (navigator.storage.persist), so it asks once, not on every round.
export const BACKUP_AT_KEY = PREFIX + 'backupAt.v1';
export const PERSIST_ASKED_KEY = PREFIX + 'persistAsked.v1';
// The keys that hold a judge's work. The first good save of one of them is the moment to ask the browser to keep the
// data: by then there is something worth keeping, and the page has finished loading.
const WORK_KEYS = Object.freeze([ROOMS_KEY, CARDS_KEY, PREFIX + 'congress.v1']);

// ---------- keeping the data (navigator.storage.persist) ----------
// The rules are shared with Tabula Debate (core/keep-data.js). These two stay here so every events file keeps its import.

/** Does this browser keep the saved data? Resolves to 'kept', 'may-clear' or 'unknown' (no API, or it failed). */
export const storageKept = (nav = globalThis.navigator) => coreStorageKept(nav);

/**
 * Ask the browser once to keep the saved data. store: the events store; now(): the clock. The ask is saved under
 * PERSIST_ASKED_KEY. Resolves to 'kept', 'may-clear', 'unknown', or 'asked-before'.
 */
export const askToKeepOnce = (store, now, nav = globalThis.navigator) => coreAskToKeepOnce(store, PERSIST_ASKED_KEY, now, nav);

// The store for this page. ui: the page's core/ui.js parts, for the warning toast.
// opts: { nav (navigator, for tests), now (the clock) }. The first good save of a judge's work asks the browser to keep
// the data (askToKeepOnce); the answer shows in Settings, not as a pop-up.
export function createEventsStore(ui, storage, opts = {}) {
  let warned = false;
  let asking = false;
  const now = opts.now || (() => Date.now());
  const inner = createStore({
    prefixes: [PREFIX],
    storage,
    onSaved: () => { if (warned) { warned = false; ui.dismissToast('storage'); } },
    onFail: () => { if (!warned) { warned = true; ui.toast('This browser is not saving. Keep this tab open until you copy your ballot.', { kind: 'error', key: 'storage' }); } },
  });
  return Object.freeze(Object.assign({}, inner, {
    set(k, v) {
      const ok = inner.set(k, v);
      if (ok && !asking && WORK_KEYS.includes(k)) {
        asking = true;
        askToKeepOnce(inner, now, 'nav' in opts ? opts.nav : globalThis.navigator).catch(() => {});
      }
      return ok;
    },
  }));
}
