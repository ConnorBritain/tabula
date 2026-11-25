// Tabula Speech Events: when a new release may start (the update gate). The service worker (events/sw.js) installs a
// new release in the background, then waits. It takes over only when this page asks, and the page asks only when the
// judge presses Reload in the notice. The notice shows only when no round is open and no clock runs, in this tab or
// in another open tab of the app. So a judge in the middle of a round never sees the page change under them.
//
//   decideUpdate(state)  the decision. Pure: everything it needs is passed in.
//   pageBusy(page)       which screens and saved clocks count as "busy". Pure.
//   watchUpdates(...)    the browser part: reads the worker registration, shows or hides the notice, asks the worker
//                        to take over, and reloads this tab once it has. It sends nothing off the device.
//
// The first install is not gated: no release runs the page yet, so the worker starts at once (events/sw.js).

// The decisions. 'activate': start now (first install only). 'offer': show the notice; Reload starts it. 'wait': a new
// release is ready, but a round is open or a clock runs, so show nothing. 'none': no new release is ready.
export const DECISIONS = Object.freeze({ ACTIVATE: 'activate', OFFER: 'offer', WAIT: 'wait', NONE: 'none' });

/**
 * May the new release start now? s: { firstInstall (no worker runs this page yet), waiting (a new release is installed
 * and waits), roundOpen (this tab shows a round, a chamber, or a setup form), timerRunning (a saved clock runs),
 * otherBusy (another open tab of the app said it is busy), offline (the network is off) }.
 * Offline does not block: a waiting release is complete in its own cache, so it starts with no network.
 */
export function decideUpdate(s) {
  const o = s || {};
  if (o.firstInstall) return DECISIONS.ACTIVATE;
  if (!o.waiting) return DECISIONS.NONE;
  if (o.roundOpen || o.timerRunning || o.otherBusy) return DECISIONS.WAIT;
  return DECISIONS.OFFER;
}

/** True when the update may start now (the first install, or the judge may reload into it). */
export const mayStartUpdate = (s) => {
  const d = decideUpdate(s);
  return d === DECISIONS.ACTIVATE || d === DECISIONS.OFFER;
};

// The screens with nothing typed that a reload could lose. Every other screen is busy: a round and its stages, a
// Congress chamber, and the setup form. An unknown screen is busy too.
export const QUIET_SCREENS = Object.freeze(['rooms', 'history', 'settings', 'pick', 'type']);

const runs = (x) => Boolean(x && typeof x === 'object' && x.run);

/** True when a saved clock runs: a speech, prep or cross-ex clock in a room, or a live Congress speech. */
export function clockRunning(rooms, congress) {
  for (const room of Array.isArray(rooms) ? rooms : []) {
    for (const e of (room && Array.isArray(room.entries)) ? room.entries : []) {
      if (!e) continue;
      const t = e.timing;
      if (runs(t) || (t && t.prepRun) || runs(e.cx)) return true;
    }
  }
  const sessions = congress && Array.isArray(congress.sessions) ? congress.sessions : [];
  return sessions.some((s) => Boolean(s && s.live));
}

/** page: { screen (parseRoute's screen), rooms (the saved rooms), congress (the saved Congress value) }. */
export function pageBusy(page) {
  const p = page || {};
  return { roundOpen: !QUIET_SCREENS.includes(p.screen), timerRunning: clockRunning(p.rooms, p.congress) };
}

// ---------- the browser part ----------
export const NOTICE_TEXT = 'Update ready. It starts when you reload.';
export const START_MESSAGE = 'start-update'; // the message events/sw.js waits for
const CHANNEL = 'tabula-events-update'; // other tabs of this app on this device; nothing leaves the browser
const ASK_MS = 300; // how long to wait for another tab to say it is busy

/**
 * Watch for a new release and offer it when the page is quiet. regPromise: the promise registerOffline returns.
 * busy(): { roundOpen, timerRunning } for this tab now (pageBusy). deps (for tests): { win, doc, nav, Channel }.
 * Returns { check() } (check again now), or null where the browser has no workers.
 */
export function watchUpdates(regPromise, busy, deps = {}) {
  const win = deps.win || globalThis.window;
  const doc = deps.doc || globalThis.document;
  const nav = deps.nav || globalThis.navigator;
  if (!win || !doc || !nav || !nav.serviceWorker || !regPromise) return null;
  const Channel = 'Channel' in deps ? deps.Channel : globalThis.BroadcastChannel;
  const sw = nav.serviceWorker;
  let reg = null;
  let asked = false; // this tab asked the worker to take over, so this tab reloads when it does
  let replaced = false; // a newer release took over (asked from another tab); this tab still runs the old one
  let note = null;

  const local = () => { try { return busy() || {}; } catch { return { roundOpen: true }; } };
  const isBusy = () => { const b = local(); return Boolean(b.roundOpen || b.timerRunning); };

  // Other tabs: answer "busy?" when this tab is busy, and ask the others before the update starts.
  const channel = typeof Channel === 'function' ? new Channel(CHANNEL) : null;
  const busyReplies = new Set(); // the ids of the questions another tab answered "busy"
  if (channel) {
    channel.onmessage = (ev) => {
      const m = ev && ev.data;
      if (m && m.type === 'busy?' && isBusy()) channel.postMessage({ type: 'busy', id: m.id });
      if (m && m.type === 'busy') busyReplies.add(m.id);
    };
  }
  const othersBusy = () => new Promise((resolve) => {
    if (!channel) { resolve(false); return; }
    const id = Math.random().toString(36).slice(2);
    channel.postMessage({ type: 'busy?', id });
    win.setTimeout(() => { const answer = busyReplies.has(id); busyReplies.delete(id); resolve(answer); }, ASK_MS);
  });

  const state = (otherBusy) => Object.assign({}, local(), {
    firstInstall: false, // the worker starts a first install itself; this page runs under a release already
    waiting: Boolean((reg && reg.waiting && sw.controller) || replaced),
    otherBusy: Boolean(otherBusy),
    offline: nav.onLine === false,
  });

  function hide() { if (note) { note.remove(); note = null; } }
  function show() {
    if (note) return;
    note = doc.createElement('div');
    note.className = 'md-note update-note';
    note.setAttribute('role', 'status');
    Object.assign(note.style, { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 12px', marginBottom: '16px' });
    const text = doc.createElement('span');
    text.textContent = NOTICE_TEXT;
    const btn = doc.createElement('button');
    btn.className = 'b';
    btn.type = 'button';
    btn.textContent = 'Reload';
    btn.addEventListener('click', start);
    note.append(text, btn);
    const main = doc.getElementById('main');
    if (main) main.prepend(note); else doc.body.prepend(note);
  }

  // Show or hide the notice for the page as it is now. The notice never starts the update by itself.
  function check() {
    if (decideUpdate(state(false)) === DECISIONS.OFFER) show(); else hide();
  }

  // The judge pressed Reload: check again (this tab and the others), then start the new release and reload this tab.
  async function start() {
    if (decideUpdate(state(await othersBusy())) !== DECISIONS.OFFER) { hide(); return; }
    if (replaced || !reg || !reg.waiting) { win.location.reload(); return; }
    asked = true;
    reg.waiting.postMessage({ type: START_MESSAGE });
  }

  sw.addEventListener('controllerchange', () => {
    if (asked) { win.location.reload(); return; } // only the tab that asked reloads, and it asked from a quiet screen
    replaced = true; // another tab started it: offer a reload here too, but only when this tab is quiet
    check();
  });
  for (const type of ['hashchange', 'storage', 'focus']) win.addEventListener(type, check);
  doc.addEventListener('visibilitychange', check);

  Promise.resolve(regPromise).then((r) => {
    if (!r) return;
    reg = r;
    // A release found later: check once it has installed (it then waits).
    r.addEventListener('updatefound', () => {
      const w = r.installing;
      if (w) w.addEventListener('statechange', () => { if (w.state === 'installed') check(); });
    });
    check();
  }).catch(() => {});
  return { check, start };
}
