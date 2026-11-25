// Keep the screen awake while a Congress session is open. A chamber can run three hours, and a phone or Chromebook
// that dims and locks between speeches loses the judge's place. Where the browser has no screen wake lock, or says
// no, nothing happens and nothing throws. The browser drops the lock when the tab is hidden, so it is asked for again
// when the tab comes back. (The room timer has its own copy of this in events/js/timer-view.js.)
// keepAwake({ nav, doc }) -> release(): call it when the judge leaves the session.
export function keepAwake({ nav = globalThis.navigator, doc = globalThis.document } = {}) {
  let lock = null;
  let wanted = true;
  let asking = false;
  async function ask() {
    if (!wanted || lock || asking) return;
    asking = true;
    try {
      const wl = nav && nav.wakeLock;
      if (!wl || typeof wl.request !== 'function') return;
      const got = await wl.request('screen');
      if (!got) return;
      if (!wanted) { await drop(got); return; } // the judge left while the browser was answering
      lock = got;
      if (typeof got.addEventListener === 'function') got.addEventListener('release', () => { if (lock === got) lock = null; });
    } catch { lock = null; } finally { asking = false; }
  }
  async function drop(l) { try { if (l && typeof l.release === 'function') await l.release(); } catch { /* already gone */ } }
  function letGo() { const l = lock; lock = null; return drop(l); }
  const onVisibility = () => {
    if (!doc) return;
    if (doc.visibilityState === 'hidden') letGo();
    else if (doc.visibilityState === 'visible') ask();
  };
  try { if (doc && typeof doc.addEventListener === 'function') doc.addEventListener('visibilitychange', onVisibility); } catch { /* no document */ }
  ask();
  return function release() {
    wanted = false;
    try { if (doc && typeof doc.removeEventListener === 'function') doc.removeEventListener('visibilitychange', onVisibility); } catch { /* no document */ }
    return letGo();
  };
}
