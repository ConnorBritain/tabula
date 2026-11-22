// Tabula Speech Events: the app's store (step E1). It is kept to the tabulaEvents.* keys (core/store.js refuses any
// other name), so it can never read or write a judge's debate data. A failed save shows one warning toast.
// Every events/js file is an ES module with named exports; only app.js boots the page and imports the screens.
import { createStore } from '../../core/store.js';

export const PREFIX = 'tabulaEvents.';
export const ROOMS_KEY = PREFIX + 'rooms.v1';
export const SETTINGS_KEY = PREFIX + 'settings.v1'; // also named on the theme script tag in index.html

// The store for this page. ui: the page's core/ui.js parts, for the warning toast.
export function createEventsStore(ui, storage) {
  let warned = false;
  return createStore({
    prefixes: [PREFIX],
    storage,
    onSaved: () => { if (warned) { warned = false; ui.dismissToast('storage'); } },
    onFail: () => { if (!warned) { warned = true; ui.toast('This browser is not saving. Keep this tab open until you copy your ballot.', { kind: 'error', key: 'storage' }); } },
  });
}
