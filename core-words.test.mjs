// Tests for core/: shared code for Tabula Debate and Tabula Speech Events.
// Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const read = (f) => readFileSync(new URL(f, import.meta.url), 'utf8');
const CORE = readdirSync(new URL('core/', import.meta.url)).filter((f) => f.endsWith('.js') && !/\.test\./.test(f)).map((f) => 'core/' + f);
const HTML = read('index.html');
const scripts = [...HTML.matchAll(/<script\b([^>]*)>/g)].map((m) => ({ attrs: m[1], src: (/\bsrc="([^"]+)"/.exec(m[1]) || [])[1] })).filter((s) => s.src);
const isModule = (s) => /type="module"/.test(s.attrs);
// Head files: plain scripts that must run in <head> before the first paint (core/policy.js, the AI gate).
// Every other core/ .js file is an ES module. A head file says so in its header ("A head file:").
const HEAD = CORE.filter((f) => /^\/\/ A head file:/m.test(read(f)));
const MODULES = CORE.filter((f) => !HEAD.includes(f));

// Product words that must never appear in core/ (shared code stays product-neutral). Debate: the sides, the flow, the
// speech IDs. Speech Events: room and entry. Generic words such as rank, points and feature are allowed.
const BANNED = ['aff', 'affirmative', 'neg', 'flow', 'flows', '1ac', '1nc', '2ac', '2nc', '1nr', '2nr', '1ar', '2ar', 'room', 'rooms', 'entry', 'entries'];

// Split text into lower-case words, also at camelCase joins, so "flowSpeeches" gives "flow" but "negative" stays one word.
function words(text) {
  return text.split(/[^A-Za-z0-9]+/).flatMap((w) => w.split(/(?<=[a-z])(?=[A-Z])/)).map((w) => w.toLowerCase()).filter(Boolean);
}
const bannedIn = (text) => [...new Set(words(text).filter((w) => BANNED.includes(w)))];

// Why: the word check is the only guard that keeps debate and events ideas out of shared code; if it stops finding a
// planted word, product words leak into core/ unseen and the second app inherits debate's shape.
test('the word check finds planted product words, also inside camelCase names', () => {
  assert.deepEqual(bannedIn('const flowSpeeches = 1;'), ['flow']);
  assert.deepEqual(bannedIn('// the 2NR may not'), ['2nr']);
  assert.deepEqual(bannedIn('function moveRoomEntry() {}'), ['room', 'entry']);
  assert.deepEqual(bannedIn('aff and neg'), ['aff', 'neg']);
  assert.deepEqual(bannedIn('a negative number can overflow; rank the items'), []);
});

// Why: core/ is shared by both apps. A product word here means product logic leaked in, so a change for one app can break the other.
test('core/ uses no product word', () => {
  assert.ok(CORE.length > 0, 'core/ has no files');
  for (const f of CORE) assert.deepEqual(bannedIn(read(f)), [], f + ' uses a product word');
});

// Why: a debate side colour in the shared tokens would give the second app a blue and red it has no meaning for, and
// would let shared styles start to depend on debate sides.
test('core/tokens.css uses no product word, and the side colours stay in assets/tokens.css', () => {
  assert.deepEqual(bannedIn(read('core/tokens.css')), [], 'core/tokens.css uses a product word');
  assert.doesNotMatch(read('core/tokens.css'), /--(aff|neg)\b/, 'a side colour token is in core/tokens.css');
  assert.match(read('assets/tokens.css'), /^@import url\('\.\.\/core\/tokens\.css'\);$/m);
  assert.match(read('assets/tokens.css'), /--aff:/);
});

// Why: classic files read core/ ES modules with require(), which needs Node 22.12 or newer. On an older Node every
// test that loads logic/ fails with a confusing error; this test names the real cause first.
test('Node is new enough to require() a core/ ES module (22.12 or newer)', () => {
  const [major, minor] = process.versions.node.split('.').map(Number);
  assert.ok(major > 22 || (major === 22 && minor >= 12), 'Node ' + process.versions.node + ' is too old: core/ needs Node 22.12 or newer');
});

// Why: classic scripts read core/ through globalThis.TabulaCore in the page and through require() in Node. If the two
// differ, the tests pass on code the page does not run.
test('each core/ module gives the same functions to import, require() and globalThis.TabulaCore', async () => {
  for (const f of MODULES) {
    const name = f.slice('core/'.length, -3);
    const viaImport = await import('./' + f);
    const viaRequire = require('./' + f);
    const viaGlobal = globalThis.TabulaCore && globalThis.TabulaCore[name];
    assert.ok(viaGlobal, f + ' does not set globalThis.TabulaCore.' + name);
    assert.deepEqual(Object.keys(viaGlobal).sort(), Object.keys(viaImport).sort(), f + ': global and exports differ');
    for (const k of Object.keys(viaImport)) {
      assert.equal(viaGlobal[k], viaImport[k], f + ' ' + k + ': global is not the exported function');
      assert.equal(viaRequire[k], viaImport[k], f + ' ' + k + ': require() is not the exported function');
    }
  }
});

// Why: a classic script runs before a module unless it has defer. A classic script that reads TabulaCore and runs too
// early finds it undefined, and the page stops loading.
test('index.html loads every core/ module before the classic scripts, which all use defer', () => {
  const at = (src) => scripts.findIndex((s) => s.src === src);
  for (const f of MODULES) {
    assert.ok(at(f) > -1, f + ' is not loaded by index.html');
    assert.ok(isModule(scripts[at(f)]), f + ' must load with type="module"');
  }
  const lastCore = Math.max(...MODULES.map(at));
  // A script that names TabulaCore only as TabulaCore.<head file> (TabulaCore.policy) may run in <head>. Any other use
  // of TabulaCore keeps the strict rule: it must load after the modules, with defer.
  const headRefs = HEAD.map((f) => 'TabulaCore.' + f.slice('core/'.length, -3));
  const otherUse = (src) => headRefs.reduce((t, ref) => t.split(ref).join(''), read(src)).includes('TabulaCore');
  for (const s of scripts) {
    if (isModule(s) || HEAD.includes(s.src) || !otherUse(s.src)) continue;
    assert.match(s.attrs, /\bdefer\b/, s.src + ' reads TabulaCore, so it must load with defer');
    assert.ok(scripts.indexOf(s) > lastCore, s.src + ' reads TabulaCore but loads before core/');
  }
  for (const s of scripts.slice(lastCore + 1)) {
    if (!isModule(s)) assert.match(s.attrs, /\bdefer\b/, s.src + ' loads after core/ without defer, so it runs before core/');
  }
});

// Why: the local helper (bridge.mjs) serves only listed files, and the hosted build copies only allowed folders.
// A core/ file missing from either one breaks the page there.
test('the local helper serves every core/ file and the hosted build ships core/', async () => {
  const bridge = read('bridge.mjs');
  const list = (/for \(const f of \[([^\]]*)\]\) FILES\['\/core\/'/.exec(bridge) || [])[1] || '';
  for (const f of MODULES) assert.ok(list.includes("'" + f.slice('core/'.length, -3) + "'"), f + ' is not in bridge.mjs FILES');
  for (const f of HEAD) assert.ok(bridge.includes("FILES['/" + f + "'] = '" + f + "'"), f + ' is not in bridge.mjs FILES');
  const { ALLOW } = await import('./build-app.mjs');
  assert.ok(ALLOW.includes('core'), 'build-app.mjs ALLOW does not include core');
});

// Why: the AI gate must hide removed AI tools before the first paint. A head file that turned into a module, or loaded
// after its reader, would let a removed tool flash on screen, or leave logic/caps.js with no gate at all.
test('head files: plain scripts with no import or export, loaded in <head> before their readers, giving one global', () => {
  assert.deepEqual(HEAD, ['core/policy.js'], 'the head files are the ones the plan names (step C11)');
  const headEnd = HTML.indexOf('</head>');
  for (const f of HEAD) {
    const src = read(f);
    assert.doesNotMatch(src, /^\s*(import|export)\b/m, f + ' must stay a plain script');
    const tag = '<script src="' + f + '"></script>';
    assert.ok(HTML.indexOf(tag) > -1 && HTML.indexOf(tag) < headEnd, f + ' must load with a plain <script> in <head>');
    const name = f.slice('core/'.length, -3);
    for (const s of scripts) if (s.src !== f && read(s.src).includes('TabulaCore.' + name)) {
      assert.ok(scripts.indexOf(s) > scripts.findIndex((x) => x.src === f), s.src + ' reads TabulaCore.' + name + ' before ' + f + ' loads');
    }
    require('./' + f);
    assert.ok(globalThis.TabulaCore && globalThis.TabulaCore[name], f + ' does not set globalThis.TabulaCore.' + name);
  }
});
