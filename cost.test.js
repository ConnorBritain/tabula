// Run with: node --test
// Cost rules that live in the app page (index.html and app.js). The model-picking rules are tested in providers.test.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
const index = read('index.html');
const app = read('app.js'); // the page's code (moved out of index.html so the CSP can forbid inline scripts)
const L = require('./logic.js');

// Why: the app once sent every request to Opus, about $19 a round on a judge's own key; no default path may name a premium model again.
test('the app hard-codes no premium or deprecated model', () => {
  for (const f of ['index.html', 'app.js', 'providers.js', 'logic.js', 'bridge.mjs']) {
    assert.doesNotMatch(read(f), /claude-(opus|fable|mythos)/, f);
    assert.doesNotMatch(read(f), /['"]gpt-4o(-mini)?-transcribe['"]/, f);
  }
});

// Why: the live flow runs every 30 s; sending every doc for the round on each pass multiplies its cost by the number of docs.
test('the live flow sends only the docs for its own speech', () => {
  const docs = [
    { name: 'aff.pdf', side: 'aff' },                  // no speech set: belongs to the 1AC
    { name: '1NC.docx', side: 'neg' },                 // belongs to the 1NC
    { name: '2AC blocks', side: 'aff', speech: '2AC' },
    { name: 'context', side: 'aff', speech: '' },      // context only: on no speech
  ];
  assert.deepEqual(L.docsForSpeech(docs, '1AC').map((d) => d.name), ['aff.pdf']);
  assert.deepEqual(L.docsForSpeech(docs, '2AC').map((d) => d.name), ['2AC blocks']);
  assert.deepEqual(L.docsForSpeech(docs, '2NR'), []);
  // The live-flow call in the app uses this helper (not all DOCS).
  assert.match(app, /buildLiveFlowPrompt\(R, speechId, DOCS\)[^\n]*docs: L\.docsForSpeech\(DOCS, speechId\)/);
});

// Why: student names must never reach an AI provider; a later edit that skips the name swap in one call path would leak them with every unit test still green.
test('every AI call path swaps names out before sending', () => {
  const start = app.indexOf('async function callAI(');
  const callAI = app.slice(start, app.indexOf('\n}\n', start));
  assert.match(callAI, /system = L\.anonymize\(system, R\); prompt = L\.anonymize\(prompt, R\);/);
  assert.match(callAI, /return L\.deanonymize\(/);
  assert.match(callAI, /docs = anonDocs\(docs\);/, 'text docs in callAI');
  assert.match(app, /const anonDocs = \(docs\) => docs\.map\(\(d\) => \(\{ \.\.\.d, name: L\.anonymize\(d\.name, R\)/, 'doc file names are swapped too, PDFs included');
  assert.match(app, /buildUserContent\(anonDocs\(DOCS\), L\.anonymize\(L\.buildJudgePrompt\(R, DOCS\), R\)\)/, 'decision stream');
  assert.match(app, /copy\(L\.anonymize\(L\.JUDGE_SYSTEM/, 'copy prompt');
  // Only callAI and the decision stream talk to Claude directly; a new direct call must also swap names.
  assert.equal((app.match(/messages\.(create|stream)\(/g) || []).length, 2);
});

// Why: the security rule (CSP) forbids inline scripts; an inline script or onclick= would silently stop working on the hosted site.
test('the pages have no inline scripts or inline event handlers', () => {
  for (const f of ['index.html', 'about.html']) {
    const html = read(f);
    assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/i, f + ' has an inline <script>');
    assert.doesNotMatch(html, /\son[a-z]+\s*=\s*["']/i, f + ' has an inline event handler');
  }
});

// Why: a personal folder path in shipped files leaks the developer's computer layout and breaks for every other user.
test('no personal file path in shipped files', () => {
  for (const f of ['index.html', 'app.js', 'about.html', 'logic.js', 'providers.js', 'tour.js', 'bridge.mjs', 'README.md']) {
    assert.doesNotMatch(read(f), /\/Users\/|\/home\/[a-z]/, f);
  }
});

// Why: a script from another site can read every key a judge pasted; no new remote script may sneak in, and the known ones must go.
test('the app loads no scripts from other sites', () => {
  const found = new Set();
  for (const f of ['index.html', 'app.js', 'about.html']) {
    const src = read(f);
    for (const m of src.matchAll(/(?:\bsrc\s*=\s*|\.src\s*=\s*|import\(\s*)['"`](https?:\/\/[^'"`]+)['"`]/g)) found.add(m[1]);
  }
  assert.deepEqual([...found], [], 'step A3 self-hosted every library in vendor/; load new ones from there too');
});

// Why: the security rule must let the app reach every AI provider it calls, and nothing else; a missing host silently breaks that provider on the hosted site.
test('the security rule allows exactly the AI hosts the app calls', () => {
  const csp = read('_headers').match(/Content-Security-Policy: (.+)/)[1];
  const directive = (name) => (csp.match(new RegExp('(?:^|; )' + name + ' ([^;]+)')) || [])[1].split(' ');
  const called = new Set();
  for (const f of ['app.js', 'providers.js']) for (const m of read(f).matchAll(/['"`](https:\/\/(?:api\.[a-z0-9.-]+|generativelanguage\.googleapis\.com|openrouter\.ai))\//g)) called.add(m[1]);
  assert.deepEqual(directive('connect-src').filter((h) => h.startsWith('https://')).sort(), [...called].sort());
  assert.deepEqual(directive('script-src'), ["'self'"], 'scripts only from this site (no blob:, no inline)');
  assert.match(app, /audioWorklet\.addModule\('tap\.js'\)/, 'the audio tap is a file, which script-src allows');
});

// Why: opening a .tab file must never lose the judge's current round; the old round may go only after the new one is safely stored.
test('opening a round file stores the new docs before it replaces or clears anything', () => {
  const h = app.slice(app.indexOf("$('#round-open').addEventListener"), app.indexOf("$('#new-round').addEventListener"));
  const at = (s) => { const i = h.indexOf(s); assert.ok(i >= 0, 'missing: ' + s); return i; };
  assert.ok(at('saveRoundFile(true)') < at('docStore.put(d)'), 'safety copy first');
  assert.ok(at('docStore.put(d)') < at('stopAll()'), 'docs stored before the clocks stop');
  assert.ok(at('stopAll()') < at('R = Object.assign(freshRound()'), 'then the round is replaced');
  assert.ok(at('R = Object.assign(freshRound()') < at('docStore.clearRound(oldId)'), 'old docs cleared last');
});

// Why: every library the app asks for must exist in vendor/, or Word import, the map or Claude silently break (bridge.test.mjs checks the helper serves them).
test('every vendored library the app loads exists', () => {
  const refs = [...app.matchAll(/['"]\.?\/?(vendor\/[^'"]+)['"]/g)].map((m) => m[1]);
  assert.ok(refs.length > 0);
  for (const r of refs) assert.ok(fs.existsSync(path.join(__dirname, r)), r + ' is missing');
});

// Why: a self-hosted library swapped or edited by mistake (or by an attacker) would run next to judges' keys; it must match the fingerprint recorded when it was downloaded.
test('vendored libraries match their recorded SHA-256', () => {
  const crypto = require('node:crypto');
  const rows = [...read('vendor/README.md').matchAll(/\| `([^`]+)` \|[^|]+\|[^|]+\| `([0-9a-f]{64})` \|/g)];
  assert.ok(rows.length >= 3, 'every vendored file is listed');
  for (const [, file, sha] of rows) {
    const got = crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, 'vendor', file))).digest('hex');
    assert.equal(got, sha, file);
  }
});
