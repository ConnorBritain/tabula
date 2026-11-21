// No Insights update before the round has something to read (owner note of 2026-11-20: "how can you drive updates
// when the round hasn't been started or set up?"). Spec: docs/design/SPEC.md V9 and 4.13. Run with: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const L = require('./logic.js');
const { readSource } = require('./test-sources.js');
const { fnSource } = require('./test-fn-source.js');

const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
const INS = read('js/insights.js');

// Why: a judge on a fresh screen could spend the round's AI on an empty round that has nothing to read.
test('insightsReady is false on a fresh, unstarted round, even with a stray doc or flow text', () => {
  assert.equal(L.insightsReady({}), false);
  assert.equal(L.insightsReady({ started: false, transcripts: { '1AC': 'words' } }, [{ id: 'd' }]), false);
  assert.equal(L.insightsReady({ started: true, transcripts: {}, flows: [{ cells: {} }], timeLeft: {} }, []), false);
});

// Why: once the first speech clock runs, the judge must be able to ask for a read without waiting for words.
test('insightsReady turns true when a speech clock runs or has run, or words exist', () => {
  assert.equal(L.insightsReady({ started: true, run: { id: '1AC' } }, []), true);
  assert.equal(L.insightsReady({ started: true, timeLeft: { '1AC': 400 } }, []), true);
  assert.equal(L.insightsReady({ started: true, transcripts: { '1AC': 'text' } }, []), true);
  assert.equal(L.insightsReady({ started: true, flows: [{ cells: { a: 'T: no link' } }] }, []), true);
});

// Why: if only the button hides, the auto path (Live Eval after each speech, the reconnect retry) could still spend AI
// on an empty round; the real scheduleEval must refuse to start a run until the round is ready.
test('scheduleEval runs no Live Eval while insightsReady is false, and runs one once it is true', () => {
  const make = new Function('aiReady', 'L', 'R', 'DOCS', 'runEval',
    'let resetting = false, evalBusy = false, evalAgain = false;\n' + fnSource(INS, 'scheduleEval') + '\nreturn scheduleEval;');
  let runs = 0;
  const run = () => { runs++; };
  make(() => true, L, { started: false }, [], run)();
  make(() => true, L, { started: true }, [], run)(); // started, but nothing to read yet
  assert.equal(runs, 0, 'no run before the round has something to read');
  make(() => true, L, { started: true, run: { id: '1AC' } }, [], run)();
  assert.equal(runs, 1, 'one run once a speech clock runs');
});

// Why: a new Live Eval caller that skips scheduleEval would bypass the guard and spend AI on an empty round.
test('runEval is only started from scheduleEval or from its own "again" loop', () => {
  const APP = readSource('app.js');
  const callers = [...APP.matchAll(/\brunEval\(\)/g)]
    .filter((m) => APP.slice(m.index - 9, m.index) !== 'function ') // not the definition itself
    .map((m) => { const before = APP.slice(0, m.index); const fns = [...before.matchAll(/function (\w+)\(/g)]; return fns[fns.length - 1][1]; });
  assert.ok(callers.length >= 2, 'found the callers');
  for (const name of callers) assert.ok(['scheduleEval', 'runEval'].includes(name), 'runEval() called from ' + name);
});

// Why: if Insights showed Update before the round is ready, the judge would click it and nothing would happen.
test('Insights and the Live Eval tab show one waiting line until the round is ready, and the clock start shows Update', () => {
  assert.match(INS, /const INS_WAIT = 'Insights start after the first speech\.';/);
  assert.match(fnSource(INS, 'renderInsights'), /if \(!L\.insightsReady\(R, DOCS\)\) \{ box\.innerHTML = '<p class="muted ins-msg" id="ins-wait">' \+ INS_WAIT/);
  assert.match(fnSource(INS, 'renderEvalStatus'), /const empty = !L\.insightsReady\(R, DOCS\);/);
  assert.match(fnSource(read('js/clock.js'), 'startSpeech'), /syncInsightsReady\(\)/);
  assert.doesNotMatch(INS, /setInterval\([^\n]*insightsReady/, 'no extra poller for the ready state');
});
