// Tests for the staged demo of the AI features (?demo=policy or ?demo=ld): the sandbox (assets/demo-boot.js), the
// pure demo logic (logic/demo.js), the sample rounds (demo/*.js) and how the page wires them in. Run with: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const L = require('./logic.js');
const BOOT = require('./assets/demo-boot.js');
const SAMPLES = [require('./demo/policy.js'), require('./demo/ld.js')];
const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');

// A small JSON-schema check for the shapes logic/prompts.js gives the AI (object, array, string, number, integer, enum).
function schemaErrors(schema, v, at = '$') {
  const out = [];
  if (schema.enum && !schema.enum.includes(v)) out.push(at + ' is not one of ' + schema.enum.join(', '));
  if (schema.type === 'object') {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return [at + ' is not an object'];
    for (const k of schema.required || []) if (!(k in v)) out.push(at + '.' + k + ' is missing');
    if (schema.additionalProperties === false) for (const k of Object.keys(v)) if (!(schema.properties || {})[k]) out.push(at + '.' + k + ' is not allowed');
    for (const [k, s] of Object.entries(schema.properties || {})) if (k in v) out.push(...schemaErrors(s, v[k], at + '.' + k));
  } else if (schema.type === 'array') {
    if (!Array.isArray(v)) return [at + ' is not an array'];
    v.forEach((x, i) => out.push(...schemaErrors(schema.items, x, at + '[' + i + ']')));
  } else if (schema.type === 'string' && typeof v !== 'string') out.push(at + ' is not a string');
  else if (schema.type === 'number' && typeof v !== 'number') out.push(at + ' is not a number');
  else if (schema.type === 'integer' && !Number.isInteger(v)) out.push(at + ' is not an integer');
  return out;
}

// Why: the demo URL picks the round. If ?demo=ld opened the Policy round, LD judges would see the wrong format; if a
// normal URL counted as a demo, a judge's real app would start on empty memory storage and seem to lose their round.
test('the demo URL picks the format, and a normal URL is never a demo', () => {
  const opens = (search) => { const p = BOOT.demoParamOf(search); return p == null ? null : L.demoSample(SAMPLES, p).format; };
  assert.equal(opens('?demo=policy'), 'policy-hs');
  assert.equal(opens('?demo'), 'policy-hs');
  assert.equal(opens('?demo=LD'), 'ld');
  assert.equal(opens('?demo=anything'), 'policy-hs');
  for (const s of ['', '?', '?flags=x', '?demo=off', '?demo=0']) assert.equal(BOOT.demoParamOf(s), null, s);
  assert.deepEqual(SAMPLES.map((s) => s.format).sort(), [...L.FORMAT_IDS].sort(), 'every format has a sample round');
  assert.equal(L.demoSample([], 'ld'), null);
});

// A page window to sandbox: a real-looking storage that records every write, and listeners we can fire.
function fakeWindow() {
  const writes = [];
  const realStore = { getItem: () => 'REAL', setItem: (k, v) => writes.push([k, v]), removeItem: (k) => writes.push(['del', k]), key: () => 'k', length: 1 };
  const listeners = [];
  const w = {
    localStorage: realStore, sessionStorage: realStore, indexedDB: { open: () => ({}) },
    fetch: async () => 'network', navigator: { mediaDevices: { getUserMedia: async () => 'mic' } },
    addEventListener: (type, fn) => listeners.push({ type, fn }),
  };
  return { w, writes, listeners };
}

// Why: the demo must never mix with the judge's real rounds, history or ballots. If storage were not swapped, the
// sample round would overwrite the real saved round; if it were swapped but the real one still read, the demo would
// show real student names. Leaving the page must leave nothing, so the swap must be memory only.
test('the sandbox swaps storage for memory: real storage is never read or written', () => {
  const { w, writes } = fakeWindow();
  assert.equal(BOOT.sandbox(w), true);
  assert.equal(w.localStorage.getItem('policyJudge.round.v1'), null, 'the real round is not visible');
  w.localStorage.setItem('policyJudge.round.v1', '{"id":"demo"}');
  w.sessionStorage.setItem('policyJudge.keys.v1', '{}');
  w.localStorage.removeItem('x');
  assert.deepEqual(writes, [], 'nothing reached the real storage');
  assert.equal(w.localStorage.getItem('policyJudge.round.v1'), '{"id":"demo"}');
  assert.equal(w.sessionStorage.getItem('policyJudge.round.v1'), null, 'the two stores are separate');
  assert.equal(w.localStorage.length, 1);
});

// Why: the demo promises no calls to an AI provider or the Tabula server, and it must work signed out and offline.
// A fetch that still worked could send the sample (or anything typed in the demo) out; the mic must stay off too.
test('the sandbox stops the network, the database and the microphone', async () => {
  const { w } = fakeWindow();
  BOOT.sandbox(w);
  await assert.rejects(w.fetch('/api/v1/ai/eval.live'), /no network/);
  for (const C of ['XMLHttpRequest', 'WebSocket', 'EventSource']) assert.throws(() => new w[C]('x'), /no network/, C);
  await assert.rejects(w.navigator.mediaDevices.getUserMedia({ audio: true }));
  assert.equal(w.navigator.sendBeacon('/x', 'y'), false);
  const req = w.indexedDB.open('policyJudge', 2);
  await new Promise((res) => { req.onerror = res; });
});

// Why: a real Tabula tab saving its round fires a "storage" event in the demo tab; the clock code would then copy the
// real round's clocks into the demo. The sandbox's listener must come first and stop the event for every listener.
test('the sandbox stops storage events from other tabs before any other listener', () => {
  const { w, listeners } = fakeWindow();
  BOOT.sandbox(w);
  assert.equal(listeners[0].type, 'storage');
  let stopped = false;
  listeners[0].fn({ stopImmediatePropagation: () => { stopped = true; } });
  assert.ok(stopped);
});

// Why: a sandbox that only half works is worse than none. If the browser refuses the swap, the boot must say so, so the
// page runs as the normal app and the demo never writes its sample round into the judge's real storage.
test('the sandbox reports failure when storage cannot be swapped', () => {
  const w = {};
  Object.defineProperty(w, 'localStorage', { value: {}, configurable: false, writable: false });
  assert.equal(BOOT.sandbox(w), false);
});

// Why: the first script on the page must be the sandbox. Any script before it (the theme or the AI gate) would read
// the judge's real storage before the swap.
test('index.html loads the demo sandbox before every other script', () => {
  const srcs = [...read('index.html').matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(srcs[0], 'assets/demo-boot.js');
  const at = (s) => srcs.indexOf(s);
  for (const f of ['demo/policy.js', 'demo/ld.js']) assert.ok(at(f) > -1 && at(f) < at('js/demo.js'), f + ' loads before js/demo.js');
  assert.ok(at('js/demo.js') < at('js/core.js'), 'the sample round is in storage before js/core.js reads the round');
});

for (const sample of SAMPLES) {
  const fmt = L.getFormat(sample.format);
  const P = L.promptsFor(fmt);

  // Why: the demo runs the saved flow replies through the app's real flow code. A reply in the wrong shape would show
  // an empty or broken AI flow, and a missing speech would leave a hole in the column the demo is meant to show off.
  test(fmt.id + ' sample: every speech the format flows has a transcript and a flow reply in the real AI shape', () => {
    const flowed = fmt.speeches.filter((s) => s.column != null).map((s) => s.id);
    assert.deepEqual(sample.speeches.map((s) => s.id), flowed, 'the speeches, in format order');
    for (const sp of sample.speeches) {
      assert.ok(sp.transcript.split(/\s+/).length >= 40, sp.id + ' has a real transcript');
      assert.deepEqual(schemaErrors(L.LIVE_FLOW_SCHEMA, sp.flow), [], sp.id);
    }
    let flows = [];
    for (const sp of sample.speeches) flows = L.applyLiveFlow(flows, sp.id, L.demoReply(sample, 'flow', { speech: sp.id }));
    const cols = new Set();
    for (const sh of flows) for (const id of Object.keys(sh.parts)) cols.add(L.speechColumn(id, fmt));
    assert.equal(cols.size, fmt.flowColumns.length, 'every flow column has notes');
  });

  // Why: Live Eval and the ballot draft are the features the demo sells. A reply the real code cannot read would show an
  // error at the most important moment of the demo, or a ballot with points out of range or ranks that disagree.
  test(fmt.id + ' sample: the Live Eval and ballot replies fit the format and fill the ballot', () => {
    assert.deepEqual(schemaErrors(P.evalSchema, sample.eval), []);
    assert.deepEqual(sample.eval.feedback.map((f) => f.speaker), fmt.speakerIds);
    assert.deepEqual(schemaErrors(P.ballotSchema, sample.ballot), []);
    assert.deepEqual(L.outOfRangePoints(sample.ballot, L.ptsRange(fmt.ballot.points), fmt), []);
    if (fmt.ballot.speakerRanks) {
      const byPts = [...fmt.speakerIds].sort((a, b) => sample.ballot.points[b] - sample.ballot.points[a]);
      assert.deepEqual(byPts.map((s) => sample.ballot.ranks[s]), byPts.map((_, i) => i + 1), 'ranks agree with points');
    }
    const b = L.applyBallotDraft({ winner: '', pts: {}, ranks: {}, rfd: '', touched: {} }, sample.ballot, { range: L.ptsRange(fmt.ballot.points), format: fmt });
    assert.equal(b.winner, sample.ballot.winner);
    assert.ok(b.rfd.length > 200, 'the decision is drafted');
  });

  // Why: the sample must be fictional (no real people or tournaments) and must say it is a sample on screen.
  // The debaters' names must also match the format's seats, or the ballot draft would name the wrong people.
  test(fmt.id + ' sample: the round is marked as a sample and fills every seat the format has', () => {
    assert.match(sample.round.tournament, /sample/i);
    for (const s of L.speakersOn(fmt, 'aff').concat(L.speakersOn(fmt, 'neg'))) {
      assert.ok(sample.round[s.side][s.slot], s.id + ' has a name');
    }
  });

  // Why: the demo starts on a round the app can open. A seed with an unknown format would make the app start a blank
  // round instead; a seed that showed the welcome or the D2 reset would cover the demo or turn its AI flow off.
  test(fmt.id + ' sample: the seed is a demo round with the demo settings', () => {
    const seed = L.demoSeed(sample, fmt);
    assert.ok(L.formatKnown(seed.round));
    assert.match(seed.round.id, /^demo-/);
    assert.equal(seed.round.topic, sample.round.topic);
    assert.equal(L.shouldShowWelcome({ setupDone: seed.settings.setupDone, hostedPlan: false }), false);
    assert.equal(L.d2Reset(seed.settings), null, 'the one-time reset does not turn Live AI flow off');
    assert.equal(L.liveFlowDefault(seed.settings.liveFlow), true);
    assert.equal(L.needsD2Note({ aiReady: true, shown: seed.settings.d2NoteShown }), false);
  });

  // Why: the steps are the story of the demo. It must show transcription and the AI flow live, then cover the whole
  // round, Live Eval, the ballot and decision drafts, and end on the nudge to try a round.
  test(fmt.id + ' sample: the steps play every speech and end on the nudge', () => {
    const steps = L.demoSteps(sample, fmt);
    assert.equal(steps[0].id, 'intro');
    const live = steps.filter((s) => s.speech).map((s) => s.speech);
    const rest = steps.find((s) => s.id === 'rest').speeches;
    assert.deepEqual(live.concat(rest), sample.speeches.map((s) => s.id));
    assert.deepEqual(steps.slice(-4).map((s) => s.id), ['eval', 'draft', 'decision', 'end']);
    assert.equal(steps[steps.length - 1].title, 'Try your first round for $2');
    for (const s of steps) assert.ok(s.title && s.body, s.id + ' has words');
  });
}

// Why: the app may change what callAI returns (it edits the ballot draft in place). A shared object would make the
// second play of the demo start from the first play's edits, so "Start over" would not really start over.
test('demoReply gives a fresh copy, and nothing for a job the demo does not have', () => {
  const s = SAMPLES[0];
  const a = L.demoReply(s, 'ballot'); a.winner = 'neg';
  assert.equal(L.demoReply(s, 'ballot').winner, 'aff');
  assert.equal(L.demoReply(s, 'lens'), null);
  assert.deepEqual(L.demoReply(s, 'flow', { speech: 'CX-1A' }), { sheets: [] });
  assert.deepEqual(L.transcriptChunks('a b c d e', 2), ['a b', 'c d', 'e']);
});

// Why: buying is not live yet (the owner wants full QA and capacity tests first). The nudge must open the Plans page
// on the site the app runs on, and the buy button must stay off until someone turns its flag on.
test('the nudge opens the Plans page, and the buy button is behind a flag that is off', () => {
  assert.equal(L.flagOn('demoBuy', {}), false);
  assert.equal(L.flagOn('demoBuy', { search: '?flags=demoBuy:on', local: false }), false, 'the website cannot turn it on');
  assert.equal(L.plansUrl('debate.tabulaspeech.com'), 'https://tabulaspeech.com/plans/');
  assert.equal(L.plansUrl('debate.tabulaspeech.dev'), 'https://tabulaspeech.dev/plans/');
  assert.deepEqual(L.demoCtaButtons({ last: true, buyOn: L.flagOn('demoBuy', {}) }), { plans: true, buy: false }, 'the end card, as shipped');
  assert.deepEqual(L.demoCtaButtons({ last: true, buyOn: true }), { plans: true, buy: true });
  assert.deepEqual(L.demoCtaButtons({ last: false, buyOn: true }), { plans: false, buy: false }, 'only on the last step');
  assert.match(read('js/demo.js'), /\$\('#demo-plans'\)\.href = L\.plansUrl\(location\.hostname\)/);
});

// One function's source whose parameters may hold braces (callAI destructures its argument): the body starts at ') {'.
function bodySource(text, head) {
  const at = text.indexOf(head);
  let i = text.indexOf(') {', at) + 2, depth = 0;
  for (; i < text.length; i++) { if (text[i] === '{') depth++; else if (text[i] === '}' && --depth === 0) break; }
  return text.slice(at, i + 1);
}
// callAI from js/ai.js with demoAnswer from js/demo.js, and a fetch that fails the test if anything calls it.
function demoCallAI({ demoOn, sample }) {
  const calls = [];
  const fetch = (url) => { calls.push(url); throw new Error('network called: ' + url); };
  const STOPPED = () => Object.assign(new Error('Stopped.'), { kind: 'stopped' });
  const make = new Function('L', 'demoSample', 'demoOn', 'can', 'useHosted', 'aiReady', 'noAiText', 'fetch', 'STOPPED', 'S', 'DOCS', 'navigator', 'callHosted', 'hostedResult',
    'const DEMO_AI_MS = 0, DEMO_NOT_HERE = "not in the demo";\n' + bodySource(read('js/demo.js'), 'function demoAnswer(') + '\n' + bodySource(read('js/ai.js'), 'async function callAI(') + '\nreturn callAI;');
  const callAI = make(L, sample, demoOn, () => true, () => true, () => true, () => 'no AI', fetch, STOPPED, { aiEngine: 'anthropic' }, [], { onLine: true },
    async () => fetch('/api/v1/ai/eval.live'), (text) => text); // hosted access: the path a signed-in judge would take
  return { callAI, calls };
}

// Why: the core promise of the demo. Even on a device with hosted access and an own key, every AI feature must get the
// saved answer and nothing may reach a provider or the Tabula server (which would spend a real judge's rounds).
test('in the demo, callAI gives the saved answers and never touches the network', async () => {
  const sample = SAMPLES[0];
  const w = demoCallAI({ demoOn: true, sample });
  const flow = await w.callAI({ feature: 'aiFlow', hosted: { job: 'flow', extra: { speech: '1AC' } } });
  assert.equal(flow.sheets[0].sheet, 'Case');
  assert.equal((await w.callAI({ feature: 'liveEval', hosted: { job: 'eval' } })).leaning.side, 'aff');
  assert.equal((await w.callAI({ feature: 'ballotDraft', hosted: { job: 'ballot' } })).winner, 'aff');
  await assert.rejects(w.callAI({ feature: 'analysis', hosted: { job: 'lens' } }), /not in the demo/);
  const ctrl = new AbortController(); ctrl.abort();
  await assert.rejects(w.callAI({ feature: 'ballotDraft', hosted: { job: 'ballot' }, signal: ctrl.signal }), /Stopped/);
  assert.deepEqual(w.calls, []);
  const real = demoCallAI({ demoOn: false, sample });
  await assert.rejects(real.callAI({ feature: 'liveEval', hosted: { job: 'eval' } }));
  assert.ok(real.calls.length > 0, 'outside the demo the same callAI does go to the network (the stub is live)');
});

// Why: in the demo the AI must be the saved answers, before any path that could reach a provider or the server.
// If the demo check came after the hosted or own-key paths, a signed-in judge in the demo could spend real rounds.
test('callAI answers from the demo before any hosted or own-key call', () => {
  const src = read('js/ai.js');
  const body = src.slice(src.indexOf('async function callAI('));
  const demoAt = body.indexOf('if (demoOn) return demoAnswer(');
  assert.ok(demoAt > -1);
  for (const later of ['useHosted(', 'aiReady()', 'fetch(']) assert.ok(demoAt < body.indexOf(later), 'the demo check comes before ' + later);
  for (const f of ['js/demo.js', 'logic/demo.js', 'demo/policy.js', 'demo/ld.js']) assert.doesNotMatch(read(f), /\bfetch\(|https?:\/\//, f + ' makes no calls');
});

// Why: the Help menu is how a judge already in the app finds the demo. It must open in a new tab (so their real round
// stays open), open the demo for their round's format, and go away where the school's AI policy removes all AI.
test('the Help menu link opens the demo for the round\'s format in a new tab, and hides when AI is removed', () => {
  const html = read('index.html');
  const a = /<a role="menuitem" id="demo-link"[^>]*>/.exec(html)[0];
  assert.match(a, /target="_blank"/);
  assert.match(a, /rel="noopener"/);
  assert.match(a, /data-ai="any"/);
  assert.equal(L.demoParamFor(SAMPLES, 'ld'), 'ld');
  assert.equal(L.demoParamFor(SAMPLES, 'policy-hs'), 'policy');
  assert.equal(L.demoParamFor(SAMPLES, 'unknown'), 'policy', 'a format with no sample opens the first demo');
  for (const f of L.FORMAT_IDS) assert.equal(L.demoSample(SAMPLES, L.demoParamFor(SAMPLES, f)).format, f, 'the link and the demo agree for ' + f);
  assert.match(read('js/demo.js'), /a\.href = '\?demo=' \+ L\.demoParamFor\(window\.TabulaDemoRounds, FMT\(\)\.id\)/);
});
