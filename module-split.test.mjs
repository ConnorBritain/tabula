// Checks for the module split (owner-approved before Slice 5): app.js became js/*.js plus a short app.js entry, and
// logic.js became logic/*.js plus a logic.js facade. Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const read = (f) => readFileSync(new URL(f, import.meta.url), 'utf8');
const { APP_FILES, LOGIC_FILES } = require('./test-sources.js');
const HTML = read('index.html');
const BRIDGE = read('bridge.mjs');
const onDisk = (dir) => readdirSync(new URL(dir + '/', import.meta.url)).filter((f) => f.endsWith('.js')).map((f) => dir + '/' + f);
const scripts = [...HTML.matchAll(/<script\b([^>]*)>/g)].map((m) => ({ attrs: m[1], src: (/\bsrc="([^"]+)"/.exec(m[1]) || [])[1] })).filter((s) => s.src);

// Why: a part that index.html does not load leaves its functions undefined, so the page breaks at the first call into it.
test('every file in js/ and logic/ is loaded by index.html', () => {
  const loaded = scripts.map((s) => s.src);
  for (const f of [...onDisk('js'), ...onDisk('logic')]) assert.ok(loaded.includes(f), f + ' is not loaded by index.html');
});

// Why: the local helper serves only whitelisted files; a part missing from FILES is a 404 and a broken page on this computer.
test('every part is in the local helper whitelist', () => {
  assert.match(BRIDGE, /FILES\['\/js\/' \+ f \+ '\.js'\] = 'js\/' \+ f \+ '\.js'/);
  assert.match(BRIDGE, /FILES\['\/logic\/' \+ f \+ '\.js'\] = 'logic\/' \+ f \+ '\.js'/);
  const list = (dir) => (new RegExp("for \\(const f of \\[([^\\]]*)\\]\\) FILES\\['/" + dir + "/'").exec(BRIDGE) || [])[1] || '';
  for (const dir of ['js', 'logic']) for (const f of onDisk(dir)) assert.ok(list(dir).includes("'" + f.slice(dir.length + 1, -3) + "'"), f + ' is not in bridge.mjs FILES');
});

// Why: the parts depend on load order. The logic parts must run before logic.js joins them, and the page parts (defer)
// must run after every plain script and before the app.js module that starts the page.
test('index.html loads the logic parts, then logic.js, then the page parts with defer, then the app.js module last', () => {
  const at = (src) => scripts.findIndex((s) => s.src === src);
  for (const f of LOGIC_FILES.slice(0, -1)) assert.ok(at(f) < at('logic.js'), f + ' loads after logic.js');
  const lastPlain = Math.max(...scripts.filter((s) => !/\bdefer\b|type="module"/.test(s.attrs)).map((s) => at(s.src)));
  for (const f of APP_FILES.slice(0, -1)) {
    const s = scripts[at(f)];
    assert.match(s.attrs, /\bdefer\b/, f + ' must load with defer');
    assert.ok(at(f) > lastPlain && at(f) < at('app.js'), f + ' loads out of order');
  }
  assert.equal(scripts[scripts.length - 1].src, 'app.js');
  assert.match(scripts[scripts.length - 1].attrs, /type="module"/);
});

// Why: a logic part that reads a part loaded after it gets undefined in the page (and a require cycle in Node).
test('a logic part only uses parts that load before it (no cycles)', () => {
  const order = LOGIC_FILES.slice(0, -1).map((f) => f.slice('logic/'.length, -3));
  for (const [i, name] of order.entries()) {
    for (const m of read('logic/' + name + '.js').matchAll(/part\('([a-z]+)'\)/g)) {
      assert.ok(order.indexOf(m[1]) > -1 && order.indexOf(m[1]) < i, `logic/${name}.js uses ${m[1]}, which does not load before it`);
    }
  }
});

// Why: the page (window.PolicyLogic) and the tests (require) must get the same API, or tests pass on logic the page does not run.
test('loading the logic files as the page does gives the same API as require("./logic.js")', () => {
  const win = {};
  win.window = win;
  vm.createContext(win);
  // The page loads the format files (data the logic parts read) before the logic parts.
  const formatFiles = scripts.map((x) => x.src).filter((src) => src.startsWith('formats/'));
  for (const f of [...formatFiles, ...LOGIC_FILES]) vm.runInContext(read(f), win, { filename: f });
  const viaRequire = require('./logic.js');
  assert.deepEqual(Object.keys(win.PolicyLogic), Object.keys(viaRequire));
  for (const k of Object.keys(viaRequire)) {
    if (typeof viaRequire[k] === 'function') assert.equal(String(win.PolicyLogic[k]), String(viaRequire[k]), k);
  }
});

// Why: app.js was a module, so its code ran in strict mode. A page part without 'use strict' would run in sloppy mode,
// where some mistakes fail silently instead of throwing, so the code would not behave as it did before the split.
test('every page part runs in strict mode', () => {
  for (const f of APP_FILES.slice(0, -1)) assert.match(read(f), /^(?:\/\/[^\n]*\n)*'use strict';\n/, f + ' does not start with use strict');
});

// Why: a guard only. The page parts share one global scope, so two parts declaring the same top-level name stop a part from
// loading at all. This catches the usual forms (a declaration at the start of a line), not every form.
test('no two page parts declare the same top-level name', () => {
  const seen = {};
  for (const f of APP_FILES) {
    for (const m of read(f).matchAll(/^(?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm)) {
      assert.ok(!seen[m[1]], `${m[1]} is declared in ${seen[m[1]]} and ${f}`);
      seen[m[1]] = f;
    }
  }
});
