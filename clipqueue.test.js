// Run with: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const { createClipQueue, backoffFor, DEGRADED_TIMEOUT, NORMAL_TIMEOUT } = require('./clipqueue.js');

// A fake clock: timers run when time is moved forward, with promise jobs flushed in between.
function fakeClock() {
  let now = 0, id = 0;
  const timers = new Map();
  const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
  return {
    now: () => now,
    setTimeout: (fn, ms) => { const t = ++id; timers.set(t, { at: now + ms, fn }); return t; },
    clearTimeout: (t) => timers.delete(t),
    async advance(ms) {
      const end = now + ms;
      for (;;) {
        await flush();
        const next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > end) break;
        now = next[1].at; timers.delete(next[0]); next[1].fn();
      }
      now = end; await flush();
    },
  };
}

// A queue wired to a fake "provider": online() decides if a send works; each reply takes `latency` ms.
function harness({ latency = 1000 } = {}) {
  const clock = fakeClock();
  const store = new Map(), applied = [], dropped = [], sent = [];
  let online = true, lat = latency, fatal = new Set();
  const q = createClipQueue({
    now: clock.now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
    store: { put: (r) => { store.set(r.id, r); }, del: (id) => { store.delete(id); } },
    send: (rec, timeoutMs) => new Promise((resolve, reject) => {
      sent.push({ seq: rec.seq, timeoutMs, at: clock.now() });
      if (fatal.has(rec.seq)) return clock.setTimeout(() => reject(Object.assign(new Error('bad audio'), { retryable: false })), 10);
      if (!online) return clock.setTimeout(() => reject(Object.assign(new Error('offline'), { retryable: true })), 50);
      clock.setTimeout(() => (lat > timeoutMs ? reject(Object.assign(new Error('timeout'), { retryable: true })) : resolve('text ' + rec.seq)), Math.min(lat, timeoutMs));
    }),
    apply: (rec, text) => applied.push(text),
    drop: (rec, err) => dropped.push(rec.seq + ':' + err.message),
  });
  const clip = (seq) => ({ id: 'c' + seq, seq, seconds: 8 });
  return { clock, q, store, applied, dropped, sent, clip, setOnline: (v) => { online = v; }, setLatency: (v) => { lat = v; }, fatal };
}

// Why: this is B1's done check. A judge's Wi-Fi drops for two minutes mid-speech; before, every clip in that gap was lost for good.
test('two minutes offline mid-speech: no clip is lost, text arrives in order, no audio is left', async () => {
  const h = harness();
  let seq = 0;
  const speak = async (seconds) => { for (let t = 0; t < seconds; t += 8) { await h.q.add(h.clip(++seq)); await h.clock.advance(8000); } };
  await speak(40); // online
  h.setOnline(false);
  await speak(120); // two minutes offline, still recording
  assert.ok(h.q.state().degraded, 'the queue knows the connection is bad');
  assert.ok(h.q.state().backlog >= 14, 'the offline clips are kept: ' + h.q.state().backlog);
  assert.ok(h.store.size >= 14, 'and saved in the store, not just in memory');
  h.setOnline(true);
  await speak(16);
  await h.clock.advance(60000); // time to catch up
  assert.deepEqual(h.applied, Array.from({ length: seq }, (_, i) => 'text ' + (i + 1)), 'every clip, in order');
  assert.equal(h.q.state().backlog, 0);
  assert.equal(h.store.size, 0, 'no audio left on the device');
  assert.equal(h.q.state().degraded, false, 'back to normal');
});

// Why: catching up one clip at a time after an outage would leave the transcript minutes behind the speech.
test('a backlog is sent several at a time, but texts are still applied strictly in order', async () => {
  const h = harness({ latency: 3000 });
  h.setOnline(false);
  for (let s = 1; s <= 6; s++) await h.q.add(h.clip(s));
  await h.clock.advance(1000);
  h.setOnline(true);
  h.q.retryNow();
  await h.clock.advance(10);
  assert.equal(h.q.state().inFlight, 1, 'first one clip tests the connection');
  await h.clock.advance(3000); // that clip's text is back: the connection works again
  assert.ok(h.q.state().inFlight >= 2 && h.q.state().inFlight <= 3, 'then the backlog goes 2-3 at once: ' + h.q.state().inFlight);
  await h.clock.advance(30000);
  assert.deepEqual(h.applied, ['text 1', 'text 2', 'text 3', 'text 4', 'text 5', 'text 6']);
});

// Why: while the connection is bad, hammering the provider wastes the judge's battery and quota; the pauses must grow, and a dead request must not block for 30 s.
test('a bad connection backs off 5, 10, 20, 30 s and uses the short timeout', async () => {
  assert.deepEqual([1, 2, 3, 4, 5, 9].map(backoffFor), [5000, 5000, 10000, 20000, 30000, 30000]);
  const h = harness();
  h.setOnline(false);
  await h.q.add(h.clip(1));
  await h.clock.advance(120000);
  const gaps = h.sent.slice(1).map((s, i) => s.at - h.sent[i].at);
  const careful = gaps.slice(1); // the first gap is the quick 2 s retry before careful mode
  assert.ok(careful.every((g, i) => i === 0 || g >= careful[i - 1]), 'pauses never shrink while offline: ' + gaps.join(','));
  assert.ok(Math.max(...gaps) <= 30050, 'never more than 30 s between tries');
  // 2 s quick retry, then careful mode: 5, 10, 20, 30 s (each try also takes the 50 ms the fake offline reply needs).
  assert.deepEqual(gaps.slice(0, 5).map((g) => Math.round(g / 1000)), [2, 5, 10, 20, 30]);
  assert.equal(h.sent.at(-1).timeoutMs, DEGRADED_TIMEOUT);
  assert.equal(h.sent[0].timeoutMs, NORMAL_TIMEOUT);
});

// Why: one slow reply is the first sign of a weak connection; switching to careful mode early keeps clips from piling up behind dead requests.
test('one reply slower than 12 s starts careful mode; a quick reply ends it', async () => {
  const h = harness({ latency: 13000 });
  await h.q.add(h.clip(1));
  await h.clock.advance(14000);
  assert.equal(h.q.state().degraded, true);
  h.setLatency(500);
  await h.q.add(h.clip(2));
  await h.clock.advance(2000);
  assert.equal(h.q.state().degraded, false);
  assert.deepEqual(h.applied, ['text 1', 'text 2']);
});

// Why: a clip that can never work (unreadable audio, rejected key) must not block every clip behind it forever.
test('a clip that cannot be transcribed is let go, and the rest still arrive in order', async () => {
  const h = harness();
  h.fatal.add(2);
  for (let s = 1; s <= 3; s++) await h.q.add(h.clip(s));
  await h.clock.advance(10000);
  assert.deepEqual(h.applied, ['text 1', 'text 3']);
  assert.deepEqual(h.dropped, ['2:bad audio']);
  assert.equal(h.store.size, 0);
});

// Why: a page reload during a speech must not throw away the clips that were waiting to be sent.
test('clips left from before a reload are sent again, in order', async () => {
  const h = harness();
  h.q.resume([h.clip(5), h.clip(3), h.clip(4)]);
  await h.clock.advance(20000);
  assert.deepEqual(h.applied, ['text 3', 'text 4', 'text 5']);
});

// Why: starting a new round must drop the old round's waiting audio, not send it into the new round.
test('clear forgets every waiting clip', async () => {
  const h = harness();
  h.setOnline(false);
  for (let s = 1; s <= 3; s++) await h.q.add(h.clip(s));
  await h.clock.advance(1000);
  h.q.clear();
  h.setOnline(true);
  await h.clock.advance(60000);
  assert.deepEqual(h.applied, []);
  assert.equal(h.q.state().backlog, 0);
});

// Why: a browser throws "Illegal invocation" when setTimeout is called as a method of another object; that crash once made the queue resend a failing clip in a tight loop, hammering the provider.
test('a failing clip is never resent in a tight loop, even if the timer misbehaves', async () => {
  const sends = [];
  const q = createClipQueue({
    store: { put() {}, del() {} },
    send: () => { sends.push(Date.now()); return Promise.reject(Object.assign(new Error('offline'), { retryable: true })); },
    apply() {},
    setTimeout: function () { if (this !== undefined && this !== globalThis) throw new TypeError('Illegal invocation'); return 0; },
  });
  await q.add({ id: 'a', seq: 1, seconds: 8 });
  await new Promise((r) => setTimeout(r, 50));
  q.stop();
  assert.ok(sends.length <= 2, 'sent ' + sends.length + ' times in 50 ms');
});

// Why: with the default timers (no test clock) the queue must still wait between tries in a real browser or Node.
test('the default timers work when none are passed in', async () => {
  let sends = 0;
  const q = createClipQueue({ store: { put() {}, del() {} }, send: () => { sends++; return Promise.reject(Object.assign(new Error('x'), { retryable: true })); }, apply() {} });
  await q.add({ id: 'a', seq: 1, seconds: 8 });
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(sends, 1, 'one try, then a 2 s pause');
  assert.ok(q.state().retryInMs > 1000);
  q.stop();
});

// Why: a stuck or full device store (another old tab, no space) must never stop the judge's speech from being transcribed.
test('a clip is still sent when saving it on the device hangs or fails', async () => {
  const clock = fakeClock(); const applied = [], storeErrors = [];
  const q = createClipQueue({
    now: clock.now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
    store: { put: (r) => (r.seq === 1 ? new Promise(() => {}) : Promise.reject(new Error('quota'))), del() {} },
    send: (rec) => Promise.resolve('text ' + rec.seq), apply: (rec, text) => applied.push(text),
    onStoreError: (rec, err) => storeErrors.push(rec.seq + ':' + err.message),
  });
  q.add({ id: 'a', seq: 1, seconds: 8 }); q.add({ id: 'b', seq: 2, seconds: 8 });
  await clock.advance(5000);
  assert.deepEqual(applied, ['text 1', 'text 2']);
  assert.deepEqual(storeErrors.sort(), ['1:saving the clip took too long', '2:quota']);
});

// Why: a missing or rejected key is fixable in a minute; deleting the speech's audio meanwhile would lose it for good.
test('a key problem pauses the queue and keeps every clip until retryNow', async () => {
  let keyOk = false;
  const clock = fakeClock(); const applied = [], dropped = [], store = new Map();
  const q = createClipQueue({
    now: clock.now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
    store: { put: (r) => { store.set(r.id, r); }, del: (id) => { store.delete(id); } },
    send: (rec) => (keyOk ? Promise.resolve('text ' + rec.seq) : Promise.reject(Object.assign(new Error('this key was rejected'), { hold: true }))),
    apply: (rec, text) => applied.push(text), drop: (rec) => dropped.push(rec.seq),
  });
  for (let s = 1; s <= 3; s++) await q.add({ id: 'c' + s, seq: s, seconds: 8 });
  await clock.advance(120000);
  assert.equal(q.state().held, 'this key was rejected');
  assert.equal(q.state().backlog, 3); assert.equal(store.size, 3); assert.deepEqual(dropped, []);
  keyOk = true; q.retryNow();
  await clock.advance(10000);
  assert.deepEqual(applied, ['text 1', 'text 2', 'text 3']);
  assert.equal(store.size, 0); assert.equal(q.state().held, '');
});

// Why: a clip the provider can reach but keeps failing on must not block every later clip forever (strict order would stall the whole speech).
test('a clip that keeps getting server errors is let go after 5 tries; the rest land', async () => {
  const clock = fakeClock(); const applied = [], dropped = [];
  let tries = 0;
  const q = createClipQueue({
    now: clock.now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, store: { put() {}, del() {} },
    send: (rec) => (rec.seq === 1 ? (tries++, Promise.reject(Object.assign(new Error('500'), { status: 500 }))) : Promise.resolve('text ' + rec.seq)),
    apply: (rec, text) => applied.push(text), drop: (rec) => dropped.push(rec.seq),
  });
  await q.add({ id: 'a', seq: 1, seconds: 8 }); await q.add({ id: 'b', seq: 2, seconds: 8 });
  await clock.advance(300000);
  assert.equal(tries, 5); assert.deepEqual(dropped, [1]); assert.deepEqual(applied, ['text 2']);
});

// Why: a network outage is not a bad clip; even 10 minutes offline must never cause a clip to be given up.
test('no connection never uses up a clip\'s tries', async () => {
  const h = harness();
  h.setOnline(false);
  await h.q.add(h.clip(1));
  await h.clock.advance(600000);
  h.setOnline(true); h.q.retryNow();
  await h.clock.advance(5000);
  assert.deepEqual(h.applied, ['text 1']); assert.deepEqual(h.dropped, []);
});

// Why: a bug in applying one clip's text must not leave every later clip unapplied.
test('a failing apply does not stop the clips behind it', async () => {
  const clock = fakeClock(); const applied = [];
  const err = console.error; console.error = () => {};
  const q = createClipQueue({
    now: clock.now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, store: { put() {}, del() {} },
    send: (rec) => Promise.resolve('text ' + rec.seq),
    apply: (rec, text) => { if (rec.seq === 1) throw new Error('boom'); applied.push(text); },
  });
  for (let s = 1; s <= 3; s++) await q.add({ id: 'c' + s, seq: s, seconds: 8 });
  await clock.advance(10000);
  console.error = err;
  assert.deepEqual(applied, ['text 2', 'text 3']);
});

// Why: a clip dropped while others are in flight during catch-up must not break the order of the rest.
test('a bad clip during catch-up is let go and the others still apply in order', async () => {
  const h = harness({ latency: 2000 });
  h.fatal.add(3);
  h.setOnline(false);
  for (let s = 1; s <= 6; s++) await h.q.add(h.clip(s));
  await h.clock.advance(1000);
  h.setOnline(true); h.q.retryNow();
  await h.clock.advance(30000);
  assert.deepEqual(h.applied, ['text 1', 'text 2', 'text 4', 'text 5', 'text 6']);
  assert.deepEqual(h.dropped, ['3:bad audio']);
});

// Why: after stop (page leaving), no timer may fire another send.
test('stop ends all sending', async () => {
  const h = harness();
  h.setOnline(false);
  await h.q.add(h.clip(1));
  await h.clock.advance(3000);
  const n = h.sent.length;
  h.q.stop();
  await h.clock.advance(120000);
  assert.equal(h.sent.length, n);
});
