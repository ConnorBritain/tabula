// The clip queue: every audio clip is kept until its text is back, and texts are applied strictly in order.
// It survives a bad connection: failed clips wait and are retried with growing pauses, and when the
// connection is back the backlog is sent several at a time, then applied in order (mergeOverlap needs the
// clip before). No DOM and no network here: the app passes in send/apply/store, so Node tests can drive it.
(function (root) {
  'use strict';

  const NORMAL_TIMEOUT = 30000; // ms to wait for one clip's text
  const DEGRADED_TIMEOUT = 15000; // shorter while the connection is bad, so a dead request does not block for long
  const SLOW_REPLY = 12000; // one reply slower than this marks the connection as bad
  const BACKOFF = [5000, 10000, 20000, 30000]; // pauses between tries while the connection is bad
  const CATCH_UP_AT = 4; // a backlog over 3: send several at once (shown as "Catching up"; it does not slow the queue)
  const MAX_IN_FLIGHT = 3;
  const MAX_SERVER_FAILS = 5; // a clip the provider keeps answering with a server error (5xx) is let go after this many
  const STORE_TIMEOUT = 3000; // saving a clip on the device may not hold up sending it

  // The pause before the next try. Careful mode starts at the 2nd failure in a row, with 5 s; then 10, 20, 30 s.
  const backoffFor = (fails) => BACKOFF[Math.min(Math.max(fails - 2, 0), BACKOFF.length - 1)];

  // deps: {
  //   send(rec, timeoutMs) -> Promise<text>   rejects with err:
  //       err.retryable === false  this clip will never work (bad audio): let it go
  //       err.hold === true        nothing will work until the judge acts (no key, rejected key): pause, keep all audio
  //       err.status >= 500        the provider answered with an error: counted toward MAX_SERVER_FAILS
  //       otherwise                no connection or a timeout: try again later, as long as it takes
  //   apply(rec, text)                          puts the text into the transcript (called in seq order only)
  //   drop(rec, err)                            a clip that cannot be transcribed
  //   store: { put(rec), del(id) }             where audio waits (IndexedDB in the app); may return promises
  //   onStoreError(rec, err)                    a clip could not be saved on the device (it is still sent)
  //   onChange(state)                           called whenever the visible state changes
  //   setTimeout, clearTimeout, now            injectable for tests
  // }
  function createClipQueue(deps) {
    // Timer defaults are wrapped: a browser's setTimeout called as a method of another object throws "Illegal invocation".
    const d = Object.assign({ setTimeout: (f, ms) => setTimeout(f, ms), clearTimeout: (t) => clearTimeout(t), now: () => Date.now(), onChange() {}, drop() {}, onStoreError() {} }, deps);
    let items = []; // sorted by seq: { rec, status: 'waiting' | 'sending' | 'done', text }
    let inFlight = 0, fails = 0, degraded = false, timer = null, waitUntil = 0, stopped = false, held = '';

    const state = () => ({
      backlog: items.length,
      inFlight,
      degraded,
      fails,
      held, // why the queue is paused for the judge (for example a rejected key), or ''
      catchingUp: !degraded && items.length >= CATCH_UP_AT,
      queuedSec: items.reduce((s, it) => s + (Number(it.rec.seconds) || 0), 0),
      retryInMs: timer !== null ? Math.max(0, waitUntil - d.now()) : 0,
    });
    const changed = () => d.onChange(state());

    function applyReady() {
      while (items.length && items[0].status === 'done') {
        const it = items.shift();
        // One bad apply must not stop the clips behind it.
        try { d.apply(it.rec, it.text); } catch (err) { if (typeof console !== 'undefined') console.error('Applying a clip failed:', err); }
        Promise.resolve(d.store.del(it.rec.id)).catch(() => {});
      }
    }
    function letGo(it, err) {
      items = items.filter((x) => x !== it);
      Promise.resolve(d.store.del(it.rec.id)).catch(() => {});
      try { d.drop(it.rec, err); } catch { /* the queue goes on */ }
      applyReady();
    }
    // Timers are called as plain functions (not as methods of d), and a timer id of 0 still counts as a timer.
    const startTimer = (fn, ms) => { const set = d.setTimeout; return set(fn, ms); };
    const stopTimer = () => { if (timer !== null) { const clear = d.clearTimeout; clear(timer); timer = null; } };
    function wait(ms) {
      if (timer !== null) return;
      waitUntil = d.now() + ms;
      timer = startTimer(() => { timer = null; pump(); }, ms);
    }
    function pump() {
      if (stopped || timer !== null || held) return;
      // While the connection is bad, probe with one clip at a time. Otherwise send one, or several to catch up.
      const limit = degraded ? 1 : items.length >= CATCH_UP_AT ? MAX_IN_FLIGHT : 1;
      for (const it of items) {
        if (inFlight >= limit) break;
        if (it.status !== 'waiting') continue;
        send(it);
      }
      changed();
    }
    async function send(it) {
      it.status = 'sending'; inFlight++;
      const started = d.now();
      let retryLater = false; // after a failure, only the timer may send again (never a tight loop)
      try {
        const text = await d.send(it.rec, degraded ? DEGRADED_TIMEOUT : NORMAL_TIMEOUT);
        if (stopped || !items.includes(it)) return;
        it.status = 'done'; it.text = text || '';
        const slow = d.now() - started > SLOW_REPLY;
        fails = 0;
        degraded = slow; // a slow reply keeps (or starts) the careful mode; a quick one ends it
        applyReady();
      } catch (err) {
        if (stopped || !items.includes(it)) return;
        if (err && err.hold) {
          // Nothing will work until the judge fixes something (a key): pause, keep every clip and its audio.
          it.status = 'waiting';
          held = err.message || 'paused';
          retryLater = true;
        } else if (err && err.retryable === false) {
          // This clip will never work (for example unreadable audio): let it go, keep the rest.
          letGo(it, err);
        } else if (err && err.status >= 500 && (it.serverFails = (it.serverFails || 0) + 1) >= MAX_SERVER_FAILS) {
          // The provider is reachable but keeps failing on this clip: let it go so the clips behind it can land.
          letGo(it, err);
        } else {
          it.status = 'waiting';
          fails++;
          if (fails >= 2) degraded = true;
          retryLater = true;
          wait(degraded ? backoffFor(fails) : 2000);
        }
      } finally {
        inFlight--;
        if (!stopped && !retryLater) pump();
        else if (!stopped) changed();
      }
    }

    return {
      // Queue the clip and save it on the device. Saving is best effort with a time limit: a stuck or full
      // device store must never stop a clip from being sent (the judge is told through onStoreError).
      async add(rec) {
        if (stopped) return;
        items.push({ rec, status: 'waiting', text: '' });
        items.sort((a, b) => a.rec.seq - b.rec.seq);
        pump();
        let t = null;
        const limit = new Promise((_, rej) => { t = startTimer(() => rej(new Error('saving the clip took too long')), STORE_TIMEOUT); });
        try { await Promise.race([Promise.resolve().then(() => d.store.put(rec)), limit]); }
        catch (err) { d.onStoreError(rec, err); }
        finally { const clear = d.clearTimeout; clear(t); }
      },
      // Clips left from before a reload (already in the store): send them again, in order.
      resume(recs) {
        for (const rec of recs) if (!items.some((x) => x.rec.id === rec.id)) items.push({ rec, status: 'waiting', text: '' });
        items.sort((a, b) => a.rec.seq - b.rec.seq);
        pump();
      },
      // Try now instead of waiting out the pause (for example when the browser says it is back online).
      retryNow() { held = ''; stopTimer(); pump(); },
      // Forget everything (new round): the store is cleared by the caller.
      clear() { items = []; fails = 0; degraded = false; held = ''; stopTimer(); changed(); },
      stop() { stopped = true; stopTimer(); },
      state,
      ids: () => items.map((x) => x.rec.id),
    };
  }

  const api = { createClipQueue, backoffFor, NORMAL_TIMEOUT, DEGRADED_TIMEOUT, SLOW_REPLY, CATCH_UP_AT };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ClipQueue = api;
})(typeof window !== 'undefined' ? window : globalThis);
