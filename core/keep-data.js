// Keeping a judge's saved data on this device. Shared by Tabula Debate and Speech Events: each app passes its own store
// and key, and works out for itself when its day is over. Nothing here touches the DOM.
//
// Browsers (Safari above all) may clear a site's saved data when the site is not used for a while, unless the browser
// agrees to keep it or the app is on the Home Screen. A backup file is the copy that survives either way.
// None of these functions throw: a browser without the storage API reads 'unknown'.

/** Does this browser keep the saved data? Resolves to 'kept', 'may-clear' or 'unknown' (no API, or it failed). */
export async function storageKept(nav = globalThis.navigator) {
  try {
    if (!nav || !nav.storage || typeof nav.storage.persisted !== 'function') return 'unknown';
    return (await nav.storage.persisted()) ? 'kept' : 'may-clear';
  } catch { return 'unknown'; }
}

/**
 * Ask the browser once to keep the saved data.
 * store: { get(key, fallback), set(key, value) }; key: where the time of the ask is saved; now: the clock (a function
 * that returns ms, or a number).
 * Resolves to 'kept', 'may-clear', 'unknown', or 'asked-before' (an earlier call asked, so this one does not).
 * The ask is saved before the browser answers, so two quick saves never ask twice.
 */
export async function askToKeepOnce(store, key, now, nav = globalThis.navigator) {
  if (store.get(key, null) !== null) return 'asked-before';
  if (!nav || !nav.storage || typeof nav.storage.persist !== 'function') return 'unknown';
  store.set(key, typeof now === 'function' ? now() : now);
  try {
    if (typeof nav.storage.persisted === 'function' && await nav.storage.persisted()) return 'kept';
    return (await nav.storage.persist()) ? 'kept' : 'may-clear';
  } catch { return 'unknown'; }
}

/**
 * Is it time to remind the judge to download a backup? Pure.
 * dayOver: the app says the judging day is over; lastChange: the latest change to the judge's work (ms, 0 for none);
 * lastBackupAt: when this device last made a backup (ms or null); dismissedAt: the lastChange value the judge said
 * "Not now" to (or null), so the reminder stays away until something else changes.
 */
export function backupDue(v) {
  const o = v || {};
  if (!o.dayOver) return false;
  const changed = Number.isFinite(o.lastChange) ? o.lastChange : 0;
  if (changed <= 0) return false;
  if (o.dismissedAt === changed) return false;
  return !(Number.isFinite(o.lastBackupAt) && o.lastBackupAt >= changed);
}

(globalThis.TabulaCore = globalThis.TabulaCore || {})['keep-data'] = Object.freeze({ storageKept, askToKeepOnce, backupDue });
