// Keep the screen awake, where the browser allows it. A judge's phone or laptop that dims in the middle of a speech
// hides the clock from the judge (and, in the speaker view, from the speaker). The room timer and the speaker view
// both use this one helper.
//
// createWakeLock({ nav, doc }) -> { request(), release(), held(), dispose() }
//   request()  ask for the screen lock and keep asking each time the tab comes back into view
//   release()  let the lock go and stop asking
//   held()     true while the browser holds a lock for us
//   dispose()  release, and stop listening to the page (call it when the owner goes away for good)
// nav and doc default to the page's navigator and document. Where the browser has no screen wake lock, or says no,
// nothing happens and nothing throws. The browser drops the lock when the tab is hidden, so it is asked for again when
// the tab is visible.
export function createWakeLock({ nav = globalThis.navigator, doc = globalThis.document } = {}) {
  let lock = null;
  let wanted = false;
  let asking = false;
  let listening = false;

  async function drop(l) { try { if (l && typeof l.release === 'function') await l.release(); } catch { /* already gone */ } }
  async function ask() {
    if (!wanted || lock || asking) return;
    asking = true;
    try {
      const wl = nav && nav.wakeLock;
      if (!wl || typeof wl.request !== 'function') return;
      const got = await wl.request('screen');
      if (!got) return;
      if (!wanted) { await drop(got); return; } // released while the browser was answering
      lock = got;
      if (typeof got.addEventListener === 'function') got.addEventListener('release', () => { if (lock === got) lock = null; });
    } catch { lock = null; } finally { asking = false; }
  }
  function letGo() { const l = lock; lock = null; return drop(l); }
  const onVisibility = () => {
    if (!doc) return;
    if (doc.visibilityState === 'hidden') letGo();
    else if (doc.visibilityState === 'visible') ask();
  };
  function listen(on) {
    if (on === listening) return;
    try {
      if (doc && typeof doc.addEventListener === 'function') {
        if (on) doc.addEventListener('visibilitychange', onVisibility); else doc.removeEventListener('visibilitychange', onVisibility);
      }
      listening = on;
    } catch { /* no document */ }
  }

  return Object.freeze({
    request() { wanted = true; listen(true); return ask(); },
    release() { wanted = false; listen(false); return letGo(); },
    held: () => Boolean(lock),
    dispose() { wanted = false; listen(false); return letGo(); },
  });
}
