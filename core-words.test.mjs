// Tests for core/: shared code for Tabula Debate and Tabula Speech Events (docs/events/LANDING.md §3, step C0).
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

// Product words that must never appear in core/ (docs/events/ARCHITECTURE.md §8). Debate: the sides, the flow, the
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

// Why: classic files read core/ ES modules with require(), which needs Node 22.12 or newer. On an older Node every
// test that loads logic/ fails with a confusing error; this test names the real cause first.
test('Node is new enough to require() a core/ ES module (22.12 or newer)', () => {
  const [major, minor] = process.versions.node.split('.').map(Number);
  assert.ok(major > 22 || (major === 22 && minor >= 12), 'Node ' + process.versions.node + ' is too old: core/ needs Node 22.12 or newer');
});

// Why: classic scripts read core/ through globalThis.TabulaCore in the page and through require() in Node. If the two
// differ, the tests pass on code the page does not run.
test('each core/ file gives the same functions to import, require() and globalThis.TabulaCore', async () => {
  for (const f of CORE) {
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
test('index.html loads every core/ file as a module before the classic scripts, which all use defer', () => {
  const at = (src) => scripts.findIndex((s) => s.src === src);
  for (const f of CORE) {
    assert.ok(at(f) > -1, f + ' is not loaded by index.html');
    assert.ok(isModule(scripts[at(f)]), f + ' must load with type="module"');
  }
  const lastCore = Math.max(...CORE.map(at));
  for (const s of scripts) {
    if (isModule(s) || !read(s.src).includes('TabulaCore')) continue;
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
  for (const f of CORE) assert.ok(list.includes("'" + f.slice('core/'.length, -3) + "'"), f + ' is not in bridge.mjs FILES');
  const { ALLOW } = await import('./build-app.mjs');
  assert.ok(ALLOW.includes('core'), 'build-app.mjs ALLOW does not include core');
});
