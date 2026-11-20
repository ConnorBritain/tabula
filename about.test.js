// Run with: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// CHANGED 2026-11-20 because the owner approved the module split: the page code is now js/*.js plus app.js, and the
// logic is logic/*.js plus logic.js. readSource('app.js') / readSource('logic.js') read every file of the group, so the
// checks below cover the same code as before. Old line:
//   const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
const { readSource: read } = require('./test-sources.js');
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

// Why: if the privacy text and the app drift apart, the page misleads judges about where their keys are kept.
// CHANGED 2026-11-20 because the owner approved D1 in docs/design/SPEC.md §2.6 ("keys are not remembered by default";
// Q-3: a key that is not remembered lives in this tab only). Old checks:
//   assert.match(about, /Remember keys/);
//   assert.match(read('app.js'), /S\.rememberKeys \?\?= true;/); // app code lives in app.js
test('About privacy text matches how the app stores keys', () => {
  assert.match(about, /plain text/);
  assert.match(about, /Remember this key/);
  assert.match(about, /until you close the tab/);
  assert.match(index, /id="remember-keys"/);
  assert.match(read('app.js'), /S\.rememberKeys = L\.resolveRememberKeys\(/); // app code lives in app.js
});

// Why: the subscription route only works on a Mac with the local helper; promising it without that condition sends Windows judges into a dead end.
test('About page states the condition for using a subscription', () => {
  assert.match(about, /subscription \(on a Mac, through a small helper/);
});

// ---- Added 2026-11-20 for the owner's About page fix ("1": remove the button and the empty box, add a real picture of the app). ----
const aboutStyle = /<style>([\s\S]*?)<\/style>/.exec(about)[1];
const hero = /<div class="hero">([\s\S]*?)\n  <\/div>\n\n  <section/.exec(about)[1];

// Why: the owner asked why a large button named a person; the About page must never again show a personal GitHub button or a "screenshot goes here" box.
test('About hero has no personal GitHub button and no placeholder box', () => {
  assert.doesNotMatch(about, /Connor on GitHub/);
  assert.doesNotMatch(hero, /class="btn[^"]*"[^>]*href="https:\/\/github\.com/);
  assert.doesNotMatch(about, /class="shot"|Screenshot placeholder|goes here/i);
  assert.doesNotMatch(aboutStyle, /\.shot\b/);
  // The founder story and its GitHub link in the body text stay.
  assert.match(about, /<h2 id="about-me">Who made it<\/h2>/);
  assert.match(about, /Find me on GitHub at <a href="https:\/\/github\.com\/ConnorBritain"/);
});

// Why: the picture is the only view of the app a visitor gets before opening it; with no label a screen-reader user hears nothing, and with the wrong name visitors cannot tell which product it is.
test('About hero shows a labelled picture of Tabula Debate during a round', () => {
  const pic = /<div class="app" role="img" aria-label="([^"]+)" data-brand-aria="([^"]+)">([\s\S]*?)<figcaption>/.exec(hero);
  assert.ok(pic, 'the picture is one role="img" element with a label from the brand template');
  assert.match(pic[1], /^Tabula Debate during an example round/);
  assert.match(pic[2], /^\{name\} during an example round/);
  const body = pic[3];
  assert.match(body, /<span class="wm-family">Tabula<\/span> <span class="wm-product" data-brand-product>Debate<\/span>/);
  for (const s of ['1AC', '1NC', '2AC', 'Block', '1AR']) assert.match(body, new RegExp('<h3>' + s + '</h3>'), s + ' column');
  assert.match(body, /<span class="on">Case<\/span>/);
  // CHANGED 2026-11-20 because the review found the example round impossible (2AC on the clock with Block and 1AR already flowed). Old check: assert.match(body, /class="big">4:12</);
  assert.match(body, /class="big">2:48</);
  // CHANGED 2026-11-20 for the same reason. Old check: assert.match(body, /class="sp a on">2AC/);
  assert.match(body, /class="sp a on">1AR/);
  assert.doesNotMatch(body, /\bvs\.?\b|@|Connor|England/, 'no names or contact details in the example');
});

// Why: judges know the speech order; a picture where the clock, the current tile and the flowed columns disagree shows a round that cannot happen and makes the product look careless.
test('About picture shows one possible moment of a round', () => {
  const body = /<div class="app" role="img"[^>]*>([\s\S]*?)<figcaption>/.exec(hero)[1];
  const order = ['1AC', 'CX 1A', '1NC', 'CX 1N', '2AC', 'CX 2A', '2NC', 'CX 2N', '1NR', '1AR', '2NR', '2AR'];
  const tiles = [...body.matchAll(/<span class="sp ([an])( done| on)?">([^<]+)<small>/g)].map((m) => ({ name: m[3], state: (m[2] || '').trim() }));
  assert.deepEqual(tiles.map((t) => t.name), order, 'the speech list is in the real order');
  const cur = tiles.findIndex((t) => t.state === 'on');
  assert.ok(cur >= 0 && tiles.filter((t) => t.state === 'on').length === 1, 'exactly one current speech');
  tiles.forEach((t, i) => assert.equal(t.state, i < cur ? 'done' : i === cur ? 'on' : '', t.name + ' state matches its place before or after the current speech'));
  const now = /<span class="now"><b>([^<]+)<\/b>/.exec(body)[1];
  assert.equal(now, tiles[cur].name, 'the clock runs the current speech');
  // Flowed columns: Block stands for 2NC and 1NR together. No column may be later than the current speech.
  const colSpeech = { '1AC': '1AC', '1NC': '1NC', '2AC': '2AC', 'Block': '1NR', '1AR': '1AR', '2NR': '2NR', '2AR': '2AR' };
  const cols = [...body.matchAll(/<div class="app-col [an]"><h3>([^<]+)<\/h3>/g)].map((m) => m[1]);
  for (const c of cols) assert.ok(order.indexOf(colSpeech[c]) <= cur, c + ' column is not later than the current speech ' + now);
});

// Why: the speech list and two columns hide on a phone; a label that names them tells a screen-reader user about parts that are not on their screen.
test('About picture label names only what shows at every width', () => {
  const label = /<div class="app" role="img" aria-label="([^"]+)"/.exec(hero)[1];
  assert.doesNotMatch(label, /speech list|five|columns from/i);
  assert.match(label, /Case sheet/);
  assert.match(label, /2:48 in the 1AR/);
});

// Why: the picture must follow the token system so it works in light, dark and print; a raw colour breaks one of the three themes.
test('the About page picture uses tokens only and the side colours of the app', () => {
  const rules = aboutStyle.split('\n').filter((l) => /^\s*\.(app|sp|pic)\b|@container/.test(l)).join('\n');
  assert.ok(rules.length > 500, 'found the picture rules');
  assert.doesNotMatch(rules, /#[0-9a-f]{3,8}\b|rgb\(|hsl\(/i);
  assert.match(rules, /\.app-col\.a h3 \{ background: var\(--aff-tint\); color: var\(--aff\); \}/);
  assert.match(rules, /\.app-col\.n h3 \{ background: var\(--neg-tint\); color: var\(--neg\); \}/);
});

// Why: most visitors open the About page on a phone; a five-column picture at 375 px would scroll the page sideways.
test('the About page picture steps down to fit a phone', () => {
  assert.match(aboutStyle, /\.app \{[^}]*container-type: inline-size;[^}]*overflow: hidden;/);
  assert.match(aboutStyle, /@container \(max-width: 639\.98px\) \{[^\n]*\.app-side \{ display: none; \}/);
  assert.match(aboutStyle, /@container \(max-width: 459\.98px\) \{[\s\S]*?\.app-cols \{ grid-template-columns: repeat\(3, minmax\(0, 1fr\)\); \}/);
});

// Why: the owner asked for the product name to show; a button that says only "Tabula" leaves visitors unsure which Tabula app they open.
test('every "Open" link on the About page names Tabula Debate and comes from the brand template', () => {
  const opens = [...about.matchAll(/<a [^>]*href="\.\/"[^>]*>([^<]+)<\/a>/g)];
  assert.equal(opens.length, 3, 'header, hero and footer');
  for (const m of opens) {
    assert.equal(m[1], 'Open Tabula Debate');
    assert.match(m[0], /data-brand-text="Open \{name\}"/);
  }
  assert.doesNotMatch(about, />Open Tabula</);
});

// Why: the help menu is how judges reach the About page; it must use the same product name as the page title.
test('the help menu item reads "About Tabula Debate" from the brand template', () => {
  assert.match(index, /<a role="menuitem" href="about\.html"[^>]*aria-label="About Tabula Debate \(opens a new tab\)" data-brand-aria="About \{name\} \(opens a new tab\)" data-brand-text="About \{name\}">About Tabula Debate<\/a>/);
});
