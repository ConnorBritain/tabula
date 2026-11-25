// Why: if the gate breaks, a new release can take over or reload the page in the middle of a round, and the judge loses the clock or what they typed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { decideUpdate, mayStartUpdate, DECISIONS, pageBusy, clockRunning, QUIET_SCREENS, watchUpdates, NOTICE_TEXT, START_MESSAGE } from './js/update-gate.js';
import { lookupRelease } from './js/settings-screen.js';

const ROOT = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), 'utf8');

// ---------- the decision ----------

test('a running timer holds the update back and shows nothing', () => {
  assert.equal(decideUpdate({ waiting: true, timerRunning: true }), DECISIONS.WAIT);
  assert.equal(mayStartUpdate({ waiting: true, timerRunning: true }), false);
});

test('an open round holds the update back and shows nothing', () => {
  assert.equal(decideUpdate({ waiting: true, roundOpen: true }), DECISIONS.WAIT);
  assert.equal(decideUpdate({ waiting: true, otherBusy: true }), DECISIONS.WAIT, 'a round open in another tab holds it too');
  assert.equal(mayStartUpdate({ waiting: true, roundOpen: true }), false);
});

test('with no round open and no clock running, the notice is offered; the update never starts by itself', () => {
  assert.equal(decideUpdate({ waiting: true, roundOpen: false, timerRunning: false }), DECISIONS.OFFER);
  assert.equal(mayStartUpdate({ waiting: true }), true);
  assert.equal(decideUpdate({ waiting: false }), DECISIONS.NONE, 'nothing to offer without a waiting release');
  assert.equal(decideUpdate(), DECISIONS.NONE);
});

test('offline does not block a quiet page (the waiting release is complete in its cache), and does not unblock a round', () => {
  assert.equal(decideUpdate({ waiting: true, offline: true }), DECISIONS.OFFER);
  assert.equal(decideUpdate({ waiting: true, offline: true, roundOpen: true }), DECISIONS.WAIT);
  assert.equal(decideUpdate({ waiting: true, offline: true, timerRunning: true }), DECISIONS.WAIT);
});

test('the first install starts at once, even on a busy page', () => {
  assert.equal(decideUpdate({ firstInstall: true }), DECISIONS.ACTIVATE);
  assert.equal(decideUpdate({ firstInstall: true, roundOpen: true, timerRunning: true }), DECISIONS.ACTIVATE);
  assert.equal(mayStartUpdate({ firstInstall: true, roundOpen: true }), true);
});

// ---------- what counts as busy ----------

test('a round, a chamber, the setup form and an unknown screen are busy; My day, History and Settings are quiet', () => {
  for (const screen of ['round', 'room', 'rank', 'review', 'chamber', 'setup', 'start', 'nope', undefined]) {
    assert.equal(pageBusy({ screen }).roundOpen, true, String(screen));
  }
  for (const screen of QUIET_SCREENS) assert.equal(pageBusy({ screen }).roundOpen, false, screen);
  assert.ok(QUIET_SCREENS.includes('rooms') && QUIET_SCREENS.includes('settings') && QUIET_SCREENS.includes('history'));
});

test('a speech, prep or cross-ex clock, or a live Congress speech, counts as a running timer on any screen', () => {
  const room = (entry) => [{ entries: [{ timing: { run: null, runs: [] } }, entry] }];
  assert.equal(clockRunning(room({ timing: { run: null } }), null), false);
  assert.equal(clockRunning(room({ timing: { run: { kind: 'speech', endAt: 1 } } })), true);
  assert.equal(clockRunning(room({ timing: { run: null, prepRun: { endAt: 1 } } })), true);
  assert.equal(clockRunning(room({ timing: { run: null }, cx: { run: { startedAt: 1 } } })), true);
  assert.equal(clockRunning([], { sessions: [{ live: null }, { live: { speechId: 's', phase: 'speech', at: 1 } }] }), true);
  assert.equal(clockRunning([], { sessions: [{ live: null }] }), false);
  assert.equal(clockRunning(null, null), false, 'no saved data is quiet');
  assert.equal(clockRunning([null, { entries: [null] }], { sessions: [null] }), false, 'damaged data does not throw');
  assert.equal(pageBusy({ screen: 'rooms', rooms: room({ timing: { run: { endAt: 1 } } }) }).timerRunning, true);
});

// ---------- the worker ----------

function runWorker({ active }) {
  const listeners = {};
  const stores = new Map([['tabula-events-old', new Map()]]);
  let skips = 0;
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const m = stores.get(name);
      return { async addAll(reqs) { for (const r of reqs) m.set(r.url, 'x'); }, async match(k) { return m.get(k); } };
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); },
  };
  class Request { constructor(url) { this.url = String(url); } }
  const self = {
    location: new URL('https://events.example/events/sw.js'),
    registration: { active: active ? {} : null },
    addEventListener: (type, fn) => { listeners[type] = fn; },
    skipWaiting: async () => { skips++; },
  };
  const ctx = vm.createContext({ self, caches, Request, URL, Set, Promise, fetch: async () => 'net' });
  ctx.importScripts = () => vm.runInContext(read('events/sw-files.js'), ctx);
  vm.runInContext(read('events/sw.js'), ctx);
  const fire = async (type, data) => {
    let until;
    listeners[type]({ data, waitUntil: (p) => { until = p; } });
    await until;
  };
  return { fire, stores, skips: () => skips, release: ctx.self.TABULA_EVENTS_RELEASE };
}

test('the worker: a first install takes over at once; an update waits, keeps the old cache, and starts only when asked', async () => {
  const first = runWorker({ active: false });
  await first.fire('install');
  assert.equal(first.skips(), 1, 'first install starts at once');

  const next = runWorker({ active: true });
  await next.fire('install');
  assert.equal(next.skips(), 0, 'an update does not take over by itself');
  assert.ok(next.stores.has('tabula-events-old'), 'the running release keeps its cache while the new one waits');
  await next.fire('message', { type: 'something-else' });
  await next.fire('message', null);
  assert.equal(next.skips(), 0, 'other messages are ignored');
  await next.fire('message', { type: START_MESSAGE });
  assert.equal(next.skips(), 1, 'the page asked: the new release takes over');
});

// Why this test sits here: while a release waits, two tabula-events-* caches exist. Browsers list caches in the order
// they were made, so the offline release id must still name the older one, which runs the page.
test('the offline release id names the running release while a newer one waits', async () => {
  const caches = { async keys() { return ['other-app', 'tabula-events-1111111aaaa', 'tabula-events-2222222bbbb']; } };
  assert.equal(await lookupRelease({ fetch: null, caches, online: () => false }), 'offline 1111111');
});

// ---------- the page part ----------

function fakePage({ busy = { roundOpen: false, timerRunning: false }, waiting = true, controller = true, Channel = null } = {}) {
  const winL = {}, docL = {}, swL = {}, regL = {};
  const posted = [];
  let reloads = 0;
  const el = (tag) => {
    const e = { tag, style: {}, attrs: {}, kids: [], listeners: {}, parent: null,
      setAttribute(k, v) { this.attrs[k] = v; },
      append(...k) { for (const c of k) { c.parent = this; this.kids.push(c); } },
      prepend(c) { c.parent = this; this.kids.unshift(c); },
      remove() { if (this.parent) this.parent.kids = this.parent.kids.filter((x) => x !== this); this.parent = null; },
      addEventListener(t, f) { this.listeners[t] = f; } };
    return e;
  };
  const main = el('main');
  const doc = { body: el('body'), createElement: el, getElementById: (id) => (id === 'main' ? main : null), addEventListener: (t, f) => { docL[t] = f; } };
  const timers = [];
  const win = { addEventListener: (t, f) => { winL[t] = f; }, setTimeout: (f) => timers.push(f), location: { reload: () => { reloads++; } } };
  const reg = { waiting: waiting ? { postMessage: (m) => posted.push(m) } : null, installing: null, addEventListener: (t, f) => { regL[t] = f; } };
  const nav = { onLine: true, serviceWorker: { controller: controller ? {} : null, addEventListener: (t, f) => { swL[t] = f; } } };
  const state = { busy };
  const gate = watchUpdates(Promise.resolve(reg), () => state.busy, { win, doc, nav, Channel });
  const note = () => main.kids.find((k) => k.className && k.className.includes('update-note')) || null;
  const flushTimers = () => { while (timers.length) timers.shift()(); };
  return { gate, state, note, posted, reloads: () => reloads, winL, swL, reg, nav, flushTimers, settle: () => new Promise((r) => setTimeout(r, 0)) };
}

test('the page shows the calm notice with a Reload button only when a release waits and the page is quiet', async () => {
  const p = fakePage();
  await p.settle();
  const n = p.note();
  assert.ok(n, 'the notice shows');
  assert.equal(n.attrs.role, 'status');
  assert.equal(n.kids[0].textContent, NOTICE_TEXT);
  assert.equal(n.kids[1].textContent, 'Reload');
  assert.ok(!/primary/.test(n.kids[1].className), 'a plain button: no brand fill');
  assert.equal(p.posted.length, 0, 'showing the notice does not start the update');
  assert.equal(p.reloads(), 0);

  p.state.busy = { roundOpen: true };
  p.winL.hashchange();
  assert.equal(p.note(), null, 'opening a round hides it');
  p.state.busy = { roundOpen: false, timerRunning: true };
  p.winL.hashchange();
  assert.equal(p.note(), null, 'a clock running on My day keeps it hidden');
  p.state.busy = { roundOpen: false, timerRunning: false };
  p.winL.hashchange();
  assert.ok(p.note(), 'back on a quiet screen it shows again');
});

test('the page shows nothing during a round, with no waiting release, or on a first install', async () => {
  const inRound = fakePage({ busy: { roundOpen: true } });
  await inRound.settle();
  assert.equal(inRound.note(), null);
  const none = fakePage({ waiting: false });
  await none.settle();
  assert.equal(none.note(), null);
  const first = fakePage({ controller: false });
  await first.settle();
  assert.equal(first.note(), null, 'no release runs the page yet, so there is nothing to reload into');
});

test('Reload asks the worker to take over, and this tab reloads only after it has', async () => {
  const p = fakePage();
  await p.settle();
  await p.gate.start();
  assert.deepEqual(p.posted, [{ type: START_MESSAGE }]);
  assert.equal(p.reloads(), 0, 'no reload before the new release runs');
  p.swL.controllerchange();
  assert.equal(p.reloads(), 1);
});

test('Reload re-checks first: a round opened since the notice showed stops it, and nothing reloads', async () => {
  const p = fakePage();
  await p.settle();
  p.state.busy = { roundOpen: true };
  await p.gate.start();
  assert.deepEqual(p.posted, []);
  assert.equal(p.reloads(), 0);
  assert.equal(p.note(), null);
});

test('a round open in another tab stops the update; a tab that did not ask never reloads by itself', async () => {
  // Two tabs on one channel: tab B is in a round.
  const tabs = [];
  class Channel {
    constructor() { this.onmessage = null; tabs.push(this); }
    postMessage(data) { for (const t of tabs) if (t !== this && t.onmessage) t.onmessage({ data }); }
  }
  const a = fakePage({ Channel });
  const b = fakePage({ Channel, busy: { roundOpen: true } });
  await a.settle();
  const asking = a.gate.start();
  a.flushTimers();
  await asking;
  assert.deepEqual(a.posted, [], 'tab B said it is busy, so tab A does not start the update');

  // Tab B leaves the round; tab A starts the update. Tab B is told the worker changed but must not reload.
  b.state.busy = { roundOpen: true, timerRunning: true };
  b.swL.controllerchange();
  assert.equal(b.reloads(), 0, 'a busy tab is never reloaded');
  assert.equal(b.note(), null);
  b.state.busy = { roundOpen: false, timerRunning: false };
  b.winL.hashchange();
  assert.ok(b.note(), 'once quiet, tab B offers the reload');
  assert.equal(b.reloads(), 0, 'and still waits for the judge');
  const again = b.gate.start();
  b.flushTimers();
  await again;
  assert.equal(b.reloads(), 1, 'Reload in tab B now just reloads into the new release');
});

test('the page part does nothing in a browser with no workers', () => {
  assert.equal(watchUpdates(Promise.resolve(null), () => ({}), { win: {}, doc: {}, nav: {} }), null);
});
