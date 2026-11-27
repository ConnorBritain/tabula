// One Events page may use saved device data at a time. The browser owns the cross-page lock; no storage key can steal it.
export const WRITER_LOCK = 'tabula-speech-events-device-writer-v1';
export class EventsWriterError extends Error {
  constructor() { super('Use the Events tab that is already open, or close it and retry here.'); this.name = 'EventsWriterError'; this.code = 'writer_required'; }
}

export function createEventsWriter({ locks = () => globalThis.navigator?.locks, onLost = () => {} } = {}) {
  const listeners = new Set();
  const notifyLost = () => { onLost(); for (const listener of listeners) listener(); };
  let status = 'idle', held = false, pending = null, releaseLock = null, epoch = 0;
  function state() { return { status, held }; }
  function assertHeld() { if (!held) throw new EventsWriterError(); }
  function release() {
    const wasHeld = held;
    held = false; epoch++; status = 'lost';
    const end = releaseLock; releaseLock = null;
    if (end) end();
    if (wasHeld) notifyLost();
  }
  function acquire() {
    if (held) return Promise.resolve(state());
    if (pending) return pending;
    let manager, requestMethod;
    try { manager = locks(); requestMethod = manager?.request; } catch { status = 'unavailable'; return Promise.resolve(state()); }
    if (typeof requestMethod !== 'function') { status = 'unavailable'; return Promise.resolve(state()); }
    const requestEpoch = epoch;
    status = 'waiting';
    let ready;
    const acquired = new Promise((resolve) => { ready = resolve; });
    const finish = () => { const value = state(); pending = null; ready(value); };
    pending = acquired;
    try {
      const request = requestMethod.call(manager, WRITER_LOCK, { mode: 'exclusive', ifAvailable: true }, (lock) => {
        if (!lock || requestEpoch !== epoch) { if (requestEpoch === epoch) status = 'waiting'; finish(); return; }
        held = true; status = 'held';
        const lifetime = new Promise((resolve) => { releaseLock = resolve; });
        finish();
        return lifetime;
      });
      Promise.resolve(request).then(() => {
        if (requestEpoch !== epoch) return;
        if (held) { held = false; status = 'lost'; releaseLock = null; notifyLost(); }
      }, () => {
        if (requestEpoch !== epoch) { finish(); return; }
        const wasHeld = held;
        held = false; releaseLock = null; status = 'unavailable';
        if (wasHeld) notifyLost();
        finish();
      });
    } catch { held = false; status = 'unavailable'; finish(); }
    return acquired;
  }
  return Object.freeze({ state, isHeld: () => held, assertHeld, acquire, release, onLost(listener) { listeners.add(listener); return () => listeners.delete(listener); } });
}

// Every production Events store and journal uses this page's same lease unless a caller supplies another lease.
export const eventsWriter = createEventsWriter();
