// The AI gate static test (platform phase 1B; docs/design/AI-POLICY.md §3e, the server API contracts
// §5). It reads the code as text and uses fixed lists, so it gives no false alarms. Each check is a pure function,
// and each has its own negative case that must make it fail. Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const read = (f) => readFileSync(new URL(f, import.meta.url), 'utf8');
const { parseHtml, walk, byId, ancestorsAndSelf } = require('./test-html.js');
const L = require('./logic.js');
const T = require('./tour.js');
const K = require('./keys.js');
const HTML = read('index.html');
const FIXTURE = JSON.parse(read('fixtures/platform-v2.json'));

// The AI controls, by feature (AI-POLICY §3c, with today's ids). A new AI control must be added here.
const AI_IDS = {
  transcription: ['rec-on', 'rb-meter', 'tr-toggle', 'tr-drawer', 'rec-strip', 'audio-card', 'cv-rec-on', 'chunk-sec', 'transcript-big'],
  aiFlow: ['live-flow'],
  liveEval: ['insights', 'insights-body', 'ins-show', 'tab-eval', 'auto-eval', 'eval-go', 'eval-body'],
  analysis: ['lens-card', 'lens-go', 'impact-card', 'impact-go', 'map-go'],
  ballotDraft: ['draft-open', 'draft-panel', 'auto-ballot', 'dp-go', 'ballot-input'],
  any: ['writing-card', 'writing-settings', 'mini-rec', 'paradigm-pick'],
};
// The Connect AI surfaces: each must sit under data-ai-setup (CONTRACTS §5 rule 1).
const SETUP_IDS = ['ins-cta', 'conn-card', 'key-paste', 'key-connect', 'prov-list', 'remember-keys', 'remember-help', 'ai-engine', 'tr-engine', 'sub-box', 'sub-body', 'backup-keys', 'show-welcome'];
// Every network or start call site, and the gate call it must make before its first fetch (R4).
const CALL_SITES = [
  ['js/insights.js', 'scheduleEval', "can('liveEval')"], ['js/insights.js', 'runEval', "can('liveEval')"],
  ['js/insights.js', 'runTool', "can('analysis')"],
  ['js/decide.js', 'runDraft', "can('ballotDraft')"], ['js/decide.js', 'runAutoRefill', "can('ballotDraft')"],
  ['js/flow.js', 'scheduleFlow', "can('aiFlow')"], ['js/flow.js', 'mapDocsNow', "can('aiFlow')"],
  ['js/docs.js', 'reflowForDocs', "can('aiFlow')"],
  ['js/recording.js', 'wantRec', "can('transcription')"], ['js/recording.js', 'startRec', "can('transcription')"],
  ['js/recording.js', 'transcribeClip', "can('transcription')"],
  ['js/ai.js', 'callAI', 'can(feature)'],
  ['js/settings.js', 'connectKey', 'canSetup()'], ['js/settings.js', 'checkHelper', 'canSetup()'],
  ['js/help.js', 'openWelcome', 'showSetup()'], ['js/help.js', 'maybeD2Note', "can('liveEval')"],
];
const GATE_WORDS = [...L.APP_FEATURES, 'any'];

// ---------- the checks (pure; each returns a list of problems) ----------

const gatedBy = (node) => ancestorsAndSelf(node).find((n) => 'data-ai' in n.attrs || 'data-ai-setup' in n.attrs) || null;

// 1. Every AI id has data-ai with its feature, on itself or an ancestor.
function untaggedIds(html, ids) {
  const root = parseHtml(html), out = [];
  for (const [f, list] of Object.entries(ids)) {
    for (const id of list) {
      const n = byId(root, id);
      if (!n) { out.push(id + ': not in the page (update the list)'); continue; }
      if (!ancestorsAndSelf(n).some((x) => x.attrs['data-ai'] === f)) out.push(id + ': no data-ai="' + f + '" on it or an ancestor');
    }
  }
  return out;
}
// 2. Every data-ai value is a known gate word; every data-ai-setup value is '' or 'invite'.
function unknownKeys(sources) {
  const out = [];
  for (const [f, src] of Object.entries(sources)) {
    for (const m of src.matchAll(/data-ai="([^"]*)"/g)) if (!GATE_WORDS.includes(m[1])) out.push(f + ': data-ai="' + m[1] + '"');
    for (const m of src.matchAll(/data-ai-setup="([^"]*)"/g)) if (!['', 'invite'].includes(m[1])) out.push(f + ': data-ai-setup="' + m[1] + '"');
  }
  return out;
}
// The body of a top-level function (by name), braces matched.
function functionBody(src, name) {
  const m = new RegExp('(?:async\\s+)?function\\s+' + name + '\\s*\\(').exec(src);
  if (!m) return null;
  const open = src.indexOf('{', src.indexOf(')', m.index));
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(open, i + 1);
  }
  return null;
}
const FIRST_CALL = /\bfetch\(|\bcallAI\(|\bwithModel\(|\btranscribeRequest\(|\bscheduleFlow\(|\bSpeechRecognition\b|getUserMedia\(|\bask\(/;
// 3. Each call site calls its gate, and before its first fetch or start.
function lateOrMissingGates(sources, sites) {
  const out = [];
  for (const [file, fn, gate] of sites) {
    const body = functionBody(sources[file] || '', fn);
    if (!body) { out.push(file + ' ' + fn + ': not found'); continue; }
    const at = body.indexOf(gate);
    const first = body.search(FIRST_CALL);
    if (at < 0) out.push(file + ' ' + fn + ': no ' + gate);
    else if (first >= 0 && first < at) out.push(file + ' ' + fn + ': ' + gate + ' comes after its first call');
  }
  return out;
}
// 4. A tour step on an AI part has `feature`; a palette row or shortcut on an AI part has `feature`.
function untaggedListItems(html, tours, commands, registry) {
  const root = parseHtml(html), out = [];
  const nodeFor = (sel) => {
    if (sel.startsWith('#')) return byId(root, sel.slice(1).split(/[\s.]/)[0]);
    if (sel.startsWith('.')) { const c = sel.slice(1).split(/[\s.]/)[0]; for (const n of walk(root)) if ((n.attrs.class || '').split(/\s+/).includes(c)) return n; }
    return null;
  };
  for (const [name, tour] of Object.entries(tours)) {
    for (const st of tour.steps) {
      const n = nodeFor(st.target);
      if (n && gatedBy(n) && !st.feature) out.push('tour ' + name + ': step "' + st.title + '" is on an AI part and has no feature');
    }
  }
  for (const c of commands) if ((c.ai || c.tab === 'eval' || c.id === 'transcript' || c.key === 'pane.insights') && !c.feature) out.push('palette: ' + c.id + ' has no feature');
  for (const e of registry) if (e.action === 'insights' && !e.feature) out.push('shortcut: ' + e.id + ' has no feature');
  return out;
}
// 5. Connect AI surfaces: static ones sit under data-ai-setup; built ones go through showSetup().
function ungatedSetup(html, ids, sources) {
  const root = parseHtml(html), out = [];
  for (const id of ids) {
    const n = byId(root, id);
    if (!n) out.push(id + ': not in the page');
    else if (!ancestorsAndSelf(n).some((x) => 'data-ai-setup' in x.attrs)) out.push(id + ': no data-ai-setup on it or an ancestor');
  }
  for (const [f, src] of Object.entries(sources)) {
    src.split('\n').forEach((line, i) => {
      if (/^\s*\/\//.test(line) || !/['"`][^'"`]*Connect AI/.test(line)) return;
      if (!/showSetup\(\)|noAiHtml\(/.test(line)) out.push(f + ':' + (i + 1) + ': a "Connect AI" text not behind showSetup()');
    });
  }
  return out;
}

// ---------- the real code ----------
const APP_SOURCES = Object.fromEntries(['js/core.js', 'js/insights.js', 'js/decide.js', 'js/flow.js', 'js/docs.js', 'js/recording.js', 'js/ai.js', 'js/settings.js', 'js/help.js', 'js/palette.js'].map((f) => [f, read(f)]));

// Why: an AI control with no data-ai stays on screen when a school hides AI, so a student sees a tool they may not use.
test('every AI control has data-ai with its feature', () => { assert.deepEqual(untaggedIds(HTML, AI_IDS), []); });
// Why: a data-ai word the CSS does not know is never hidden, so a misspelt key leaves the tool showing.
test('every data-ai and data-ai-setup value is known', () => { assert.deepEqual(unknownKeys({ 'index.html': HTML, ...APP_SOURCES }), []); });
// Why: a call site without its gate (or with it after the fetch) spends credits and sends round data for a tool that is off.
test('every AI call site checks the gate before its first fetch or start', () => { assert.deepEqual(lateOrMissingGates(APP_SOURCES, CALL_SITES), []); });
// Why: a tour step, palette row or shortcut on a removed part names a tool the person cannot have (R3).
test('tour steps, palette rows and shortcuts on AI parts carry a feature', () => {
  assert.deepEqual(untaggedListItems(HTML, T.TOURS, K.COMMANDS, K.REGISTRY), []);
});
// Why: an ungated Connect AI surface invites a person whose school hides AI to bring their own key: a taunt.
test('every Connect AI surface is behind data-ai-setup or showSetup()', () => { assert.deepEqual(ungatedSetup(HTML, SETUP_IDS, APP_SOURCES), []); });
// Why: the Insights invite is built in code (#ins-cta); if its mode ignores the gate, a hidden role sees "Connect AI" on Flow.
test('the Insights mode and its Connect AI row follow the gate', () => {
  const core = APP_SOURCES['js/core.js'];
  assert.match(core, /L\.insightsMode\(\{ allowed: can\('liveEval'\), setup: showSetup\(\),/);
  assert.match(core, /\$\('#ins-cta'\)\.hidden = mode !== 'edge-connect';/);
});
// Why: CONTRACTS §4. The app must use only keys the server's contract file has; a key it invents is never sent, so its tool
// would vanish for everyone.
test('every gate key in the code is in the contract fixture file', () => {
  const used = new Set();
  for (const src of [HTML, ...Object.values(APP_SOURCES), read('tour.js'), read('keys.js')]) {
    for (const m of src.matchAll(/data-ai="([^"]+)"|\bcan\('([^']+)'\)|\bfeature: '([^']+)'/g)) used.add(m[1] || m[2] || m[3]);
  }
  for (const k of used) if (k !== 'any' && k !== 'setup') assert.ok(FIXTURE.features.includes(k), k + ' is not in fixtures/platform-v2.json');
});

// Why: CONTRACTS §4. The gate's own key lists must match the contract: a key the debate judge edition does not have
// could never be granted, so its control would stay hidden for everyone.
test('the gate\'s key lists match the contract file', () => {
  assert.deepEqual(L.FEATURE_KEYS, FIXTURE.features);
  for (const k of L.APP_FEATURES) assert.ok(FIXTURE.products.debate.judge.includes(k), k + ' is not a debate judge feature');
  assert.equal(FIXTURE.v, 2);
  for (const [name, fx] of Object.entries(FIXTURE.fixtures)) assert.ok(L.parseCaps(fx.record), name + ' does not parse as a v2 debate record');
});
// Why: if the CSS lost a rule, data-ai-off would name a feature and the page would still show it.
test('the CSS hides each gate word', () => {
  for (const f of GATE_WORDS) assert.ok(HTML.includes(`html[data-ai-off~="${f}"] [data-ai="${f}"]`), f);
  assert.ok(HTML.includes('html[data-ai-off~="setup"] [data-ai-setup]'));
  assert.ok(HTML.includes('html[data-ai-off~="invite"] [data-ai-setup="invite"]'));
});
// Why: the gate must be drawn before the first paint, or a removed tool flashes on screen for a moment.
test('logic/caps.js and assets/caps-boot.js load in <head>, before the page body', () => {
  const head = HTML.slice(0, HTML.indexOf('<body'));
  assert.ok(head.indexOf('<script src="logic/caps.js"></script>') > -1 && head.indexOf('<script src="assets/caps-boot.js"></script>') > head.indexOf('logic/caps.js'));
});

// ---------- negative cases: each check must be able to fail ----------

// Why: a check that cannot fail proves nothing; an untagged id must be reported.
test('negative: an untagged AI id fails check 1', () => {
  assert.equal(untaggedIds('<div><button id="eval-go">Run</button></div>', { liveEval: ['eval-go'] }).length, 1);
  assert.equal(untaggedIds('<div data-ai="analysis"><button id="eval-go">Run</button></div>', { liveEval: ['eval-go'] }).length, 1, 'the wrong feature');
  assert.equal(untaggedIds('<div data-ai="liveEval"><button id="eval-go">Run</button></div>', { liveEval: ['eval-go'] }).length, 0);
});
// Why: a check that cannot fail proves nothing; an unknown key must be reported.
test('negative: an unknown data-ai key fails check 2', () => {
  assert.equal(unknownKeys({ x: '<div data-ai="liveEvl"></div>' }).length, 1);
  assert.equal(unknownKeys({ x: '<div data-ai-setup="always"></div>' }).length, 1);
});
// Why: a check that cannot fail proves nothing; a missing gate, and a gate after the fetch, must both be reported.
test('negative: a missing gate, and can() after the fetch, fail check 3', () => {
  const site = [['f.js', 'runEval', "can('liveEval')"]];
  assert.equal(lateOrMissingGates({ 'f.js': 'async function runEval() { await callAI({}); }' }, site).length, 1, 'missing');
  assert.match(lateOrMissingGates({ 'f.js': "async function runEval() { const r = await fetch('/x'); if (!can('liveEval')) return; }" }, site)[0], /after its first call/);
  assert.equal(lateOrMissingGates({ 'f.js': "async function runEval() { if (!can('liveEval')) return; await fetch('/x'); }" }, site).length, 0);
});
// Why: a check that cannot fail proves nothing; an untagged tour step, palette row and shortcut must be reported.
test('negative: an untagged tour step, palette row or shortcut fails check 4', () => {
  const html = '<section id="tab-eval" data-ai="liveEval"></section>';
  assert.equal(untaggedListItems(html, { t: { steps: [{ target: '#tab-eval', title: 'Live Eval' }] } }, [], []).length, 1);
  assert.equal(untaggedListItems(html, {}, [{ id: 'go.eval', tab: 'eval' }], []).length, 1);
  assert.equal(untaggedListItems(html, {}, [], [{ id: 'pane.insights', action: 'insights' }]).length, 1);
});
// Why: a check that cannot fail proves nothing; an ungated Connect AI surface, static or built, must be reported.
test('negative: an ungated Connect AI surface fails check 5', () => {
  assert.equal(ungatedSetup('<div id="conn-card"></div>', ['conn-card'], {}).length, 1);
  assert.equal(ungatedSetup('', [], { 'x.js': "el.innerHTML = '<button>Connect AI</button>';" }).length, 1);
  assert.equal(ungatedSetup('', [], { 'x.js': "el.innerHTML = showSetup() ? '<button>Connect AI</button>' : '';" }).length, 0);
});
