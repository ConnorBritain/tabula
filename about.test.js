// Run with: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
const about = read('about.html');
const bridge = read('bridge.mjs');
const index = read('index.html');

// The bridge's FILES map and asset list, read from its source (bridge.mjs starts a server, so it is not imported).
const FILES = Object.fromEntries([...bridge.match(/const FILES = \{([^}]*)\}/)[1].matchAll(/'([^']+)':\s*'([^']+)'/g)].map((m) => [m[1], m[2]]));
const ASSETS = [...bridge.match(/for \(const f of \[([^\]]*)\]\)/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);

// Local links and assets on a page (not http, not #anchors).
const localRefs = (html) => [...html.matchAll(/(?:href|src|srcset)="([^"]+)"/g)]
  .map((m) => m[1]).filter((u) => !/^(https?:|#|mailto:)/.test(u));

// The bridge serves a path only if it is in its FILES list (as a path, or as an asset name).
const served = (ref) => {
  const p = '/' + ref.replace(/^\.\//, '');
  if (p.startsWith('/assets/')) return ASSETS.includes(p.slice('/assets/'.length));
  return p in FILES;
};

// Why: the bridge refuses any file not on its list, so a new logo or font on the About page would show as a broken image.
test('every local file the About page uses is served by the bridge', () => {
  const refs = localRefs(about);
  assert.ok(refs.length >= 4, 'found the page links');
  for (const r of refs) assert.ok(served(r), r + ' is not in the bridge FILES list');
  assert.equal(FILES['/about'], 'about.html');
  assert.equal(FILES['/about.html'], 'about.html');
});

// Why: judges reach the About page only through the app; a broken link hides who made Tabula and how to support it.
test('the app links to the About page from the help menu and the footer', () => {
  const links = index.match(/href="about\.html"/g) || [];
  assert.ok(links.length >= 2, 'help menu and footer both link to about.html');
});

// Why: the user required the Pattern Engine LLC credit and the GitHub link; a later rewrite of the page could drop them without anyone noticing.
test('About page credits Pattern Engine LLC and links the GitHub profile', () => {
  assert.match(about, /Pattern Engine LLC/);
  assert.match(about, /https:\/\/github\.com\/ConnorBritain/);
});

// Why: a placeholder link that looks real sends visitors nowhere; placeholders must not be clickable.
test('About page has no dead "#" links', () => {
  assert.doesNotMatch(about, /href="#"/);
});

// Why: the app saves keys as plain text by default; if the privacy text and the app drift apart, the page misleads judges about their keys.
test('About privacy text matches how the app stores keys', () => {
  assert.match(about, /plain text/);
  assert.match(about, /Remember keys/);
  assert.match(index, /id="remember-keys"/);
  assert.match(read('app.js'), /S\.rememberKeys \?\?= true;/); // app code lives in app.js
});

// Why: the subscription route only works on a Mac with the local helper; promising it without that condition sends Windows judges into a dead end.
test('About page states the condition for using a subscription', () => {
  assert.match(about, /subscription \(on a Mac, through a small helper/);
});
