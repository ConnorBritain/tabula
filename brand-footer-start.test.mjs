// Checks for the owner's 2026-11-20 request: the product name "Tabula Debate" by the mark, the "© <year> Tabula
// Speech" footer, the start panel's two primary buttons with the file link under them, and the Connect AI prompt.
// Run with: node --test. The look at each width is checked in the browser (see the change report).
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const { readSource: read } = createRequire(import.meta.url)('./test-sources.js');
const HTML = read('index.html');
const STYLE = /<style>([\s\S]*?)<\/style>/.exec(HTML)[1];
const ABOUT = read('about.html');
const APP = read('app.js');
const BRAND = read('assets/brand.js');

// A tiny fake page: just enough of querySelectorAll, textContent and attributes for assets/brand.js.
function fakePage(nodes) {
  const els = nodes.map((n) => ({ ...n, attrs: { ...n.attrs }, getAttribute(k) { return this.attrs[k]; }, setAttribute(k, v) { this.attrs[k] = v; } }));
  const has = (el, sel) => { const k = /^\[([\w-]+)/.exec(sel)[1]; return k in el.attrs; };
  return { els, document: { querySelectorAll: (sel) => els.filter((el) => has(el, sel)) } };
}
function runBrand(page, year) {
  const RealDate = Date;
  const win = { document: page.document, Date: class extends RealDate { constructor(...a) { super(...(a.length ? a : [`${year}-03-01T12:00:00`])); } } };
  win.window = win;
  vm.runInNewContext(BRAND, win);
  return win;
}

// Why: the owner asked for a copyright year that turns over by itself; a fixed year reads as an abandoned app on 1 January.
test('brand.js writes the device clock year into every [data-year]', () => {
  const page = fakePage([{ attrs: { 'data-year': '' }, textContent: '2026' }, { attrs: { 'data-year': '' }, textContent: '2026' }]);
  runBrand(page, 2027);
  assert.deepEqual(page.els.map((e) => e.textContent), ['2027', '2027']);
});

// Why: the product name lives in one constant so a later Tabula Speech Events app changes one word; if the fill breaks, the header, title and labels disagree.
test('brand.js fills the product word, text templates and aria-label templates from one name', () => {
  const page = fakePage([
    { attrs: { 'data-brand-product': '' }, textContent: 'x' },
    { attrs: { 'data-brand-text': 'About {name}' }, textContent: 'x' },
    { attrs: { 'data-brand-text': '{parent}' }, textContent: 'x' },
    { attrs: { 'data-brand-aria': '{name}: go to Flow' }, textContent: '' },
  ]);
  const win = runBrand(page, 2026);
  assert.equal(win.TabulaBrand.NAME, 'Tabula Debate');
  assert.equal(page.els[0].textContent, 'Debate');
  assert.equal(page.els[1].textContent, 'About Tabula Debate');
  assert.equal(page.els[2].textContent, 'Tabula Speech');
  assert.equal(page.els[3].attrs['aria-label'], 'Tabula Debate: go to Flow');
});

// Why: the static words are what a judge sees before the script runs (or if it fails); a bare "Tabula" there is the exact confusion the owner reported.
test('the app header, title and brand link name say "Tabula Debate" in the markup', () => {
  assert.match(HTML, /<title data-brand-text="\{name\}">Tabula Debate<\/title>/);
  assert.match(HTML, /<a class="brand" href="#" aria-label="Tabula Debate: go to Flow" data-brand-aria="\{name\}: go to Flow"/);
  assert.match(HTML, /<span class="wordmark"><span class="wm-family">Tabula<\/span> <span class="wm-product" data-brand-product>Debate<\/span><\/span>/);
  assert.match(HTML, /<script defer src="assets\/brand\.js"><\/script>/);
});

// Why: hiding only the product word would leave a bare "Tabula" in the header, the thing the owner asked to end.
test('no rule hides the product word alone; the wordmark hides only on a phone-width header', () => {
  assert.doesNotMatch(STYLE, /\.wm-product\s*\{[^}]*display:\s*none/);
  const hides = [...STYLE.matchAll(/([^{}]*)\{([^{}]*)\}/g)].filter((m) => /\.wordmark\s*$/.test(m[1].trim()) && /display:\s*none/.test(m[2]));
  assert.deepEqual(hides.map((m) => m[1].trim()), ['.hrow .wordmark', '.hrow:has(> .clock-chip:not([hidden])) .wordmark']);
  assert.match(STYLE, /@media \(max-width: 359\.98px\) \{ \.hrow \.wordmark \{ display: none; \} \}/, 'always the mark alone under 360 px');
  assert.match(STYLE, /@media \(max-width: 479\.98px\) \{ \.hrow:has\(> \.clock-chip:not\(\[hidden\]\)\) \.wordmark \{ display: none; \} \}/, 'under 480 px only while the clock chip shows');
});

// Why: the owner asked to drop "Made by Connor England" from the app footer and show the parent brand's copyright.
test('the app footer reads "About Tabula Debate · © <year> Tabula Speech"', () => {
  const foot = /<p class="app-foot noprint">([\s\S]*?)<\/p>/.exec(HTML)[1];
  assert.doesNotMatch(foot, /Made by/);
  assert.match(foot, /<a href="about\.html"[^>]*>About Tabula Debate<\/a> · © <span data-year>2026<\/span> <span data-brand-text="\{parent\}">Tabula Speech<\/span>/);
});

// Why: Stripe needs the legal seller on the public page; dropping "Made by" must not drop Pattern Engine LLC, and the year must update like the app's.
test('the About footer reads "© <year> Tabula Speech · Pattern Engine LLC" and loads brand.js', () => {
  const foot = /<footer>([\s\S]*?)<\/footer>/.exec(ABOUT)[1];
  assert.doesNotMatch(foot, /Made by/);
  assert.match(foot, /© <span data-year>2026<\/span> <span data-brand-text="\{parent\}">Tabula Speech<\/span> · <a href="https:\/\/patternengine\.ai" rel="noopener">Pattern Engine LLC<\/a>/);
  assert.match(ABOUT, /<title data-brand-text="About \{name\}">About Tabula Debate<\/title>/);
  assert.match(ABOUT, /<span class="wm-family">Tabula<\/span> <span class="wm-product" data-brand-product>Debate<\/span>/);
  assert.match(ABOUT, /<script defer src="assets\/brand\.js"><\/script>/);
});

// Why: the owner wants the two real starts to be the primary buttons; a third button in the row makes the file picker compete with them.
test('the start panel has two buttons in its row and the file link under it', () => {
  const panel = /<div class="start-panel" id="start-panel" hidden>([\s\S]*?)\n  <\/div>/.exec(HTML)[1];
  const row = /<div class="start-actions">([\s\S]*?)<\/div>/.exec(panel)[1];
  const btns = row.match(/<(button|label)\b[^>]*>/g);
  assert.equal(btns.length, 2);
  assert.match(btns[0], /class="b primary" id="start-new"/);
  assert.match(btns[1], /class="b" id="start-flow"/);
  assert.ok(panel.indexOf('id="start-open"') > panel.indexOf('</div>'), 'the file link comes after the button row');
});

// Why: a <label> is not in the Tab order, so a keyboard judge could not open a saved round; a real button is reached by Tab and pressed by Enter and Space.
test('"Open a round file (.tab)" is a real button that opens the file picker', () => {
  assert.match(HTML, /<p class="start-alt">Have a saved round\? <button class="linkish" id="start-open" type="button" aria-controls="round-open">Open a round file \(\.tab\)<\/button><\/p>/);
  assert.match(APP, /\$\('#start-open'\)\.addEventListener\('click', \(\) => \$\('#round-open'\)\.click\(\)\);/);
});

// Why: AI-POLICY.md forbids an AI prompt or an empty prompt box when AI is ready or hidden; hiding only the button would leave the reason line on screen.
test('the Connect AI prompt is one row, hidden as a whole outside the no-AI edge', () => {
  // CHANGED 2026-11-20 because the design review asked for the AI-POLICY §3d.1 marker data-ai="liveEval" on the row.
  // Old check: /<div class="ins-cta" id="ins-cta"><span class="ins-cta-text">Live insights need AI\.<\/span>.../
  // CHANGED 2026-11-20 (platform 1B): the row also carries data-ai-setup="invite", so the CSS gate hides it before the first paint
  // when no Connect AI invite may show (CONTRACTS §5 rule 1).
  assert.match(HTML, /<div class="ins-cta" id="ins-cta" data-ai="liveEval" data-ai-setup="invite"><span class="ins-cta-text">Live insights need AI\.<\/span><button class="b small ins-edge-btn" type="button" id="ins-connect" data-tab-go="ai"/);
  assert.match(APP, /\$\('#ins-cta'\)\.hidden = mode !== 'edge-connect';/);
  assert.doesNotMatch(APP, /\$\('#ins-connect'\)\.hidden/, 'the button alone is never the thing hidden');
  assert.match(STYLE, /#insights \.ins-cta\[hidden\], #insights \.ins-cta-text \{ display: none; \}/, 'display: contents must not beat the hidden attribute');
});

// Why: the owner called the underlined link under a full-width line inelegant; a one-sided rule is also a stripe (SPEC colour rule 8).
test('the narrow Insights edge has no rule above it, and the prompt is edged on all four sides', () => {
  for (const [, body] of STYLE.matchAll(/#insights \.ins-edge \{([^}]*)\}/g)) assert.doesNotMatch(body, /border-top/);
  const cta = /@media \(max-width: 1180px\) \{\s*#insights \.ins-cta \{([^}]*)\}/.exec(STYLE)[1];
  assert.match(cta, /border: 1px solid var\(--border\)/);
  assert.match(cta, /background: var\(--sunk\)/);
  assert.doesNotMatch(HTML, /id="ins-connect"[^>]*linkish|linkish[^>]*id="ins-connect"/);
});

// ---- Behaviour checks: run the real page code against a small fake DOM (review fix, 2026-11-20). ----
// Cut one top-level function out of a source file by matching its braces, so the test runs the shipped code.
function cutFunction(src, name) {
  const start = src.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} is in the source`);
  let depth = 0;
  for (let i = src.indexOf('{', start); i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(start, i + 1);
  }
  throw new Error(`no end for ${name}`);
}
// A fake element store keyed by selector: each element records clicks and listeners, and keeps hidden and dataset.
function fakeDom() {
  const els = {};
  const el = () => ({ hidden: false, dataset: {}, clicks: 0, on: {}, attrs: {},
    classList: { set: new Set(), toggle(c, on) { if (on) this.set.add(c); else this.set.delete(c); } },
    setAttribute(k, v) { this.attrs[k] = v; },
    addEventListener(t, fn) { (this.on[t] ||= []).push(fn); },
    click() { this.clicks++; (this.on.click || []).forEach((fn) => fn({ preventDefault() {} })); } });
  const $ = (sel) => (els[sel] ||= el());
  return { $, els };
}
const CORE = read('js/core.js');
const FLOW = read('js/flow.js');

// Why: AI-POLICY.md forbids an AI prompt when AI is ready; if applyPanes stopped hiding the whole row, a judge with AI would still see "Live insights need AI." and a stray box.
test('applyPanes shows the Connect AI row only in the no-AI edge, and hides it as a whole otherwise', () => {
  const src = cutFunction(CORE, 'applyPanes');
  for (const mode of ['open', 'edge-show', 'edge-connect']) {
    const { $ } = fakeDom();
    const ctx = { $, S: { hideLeft: false }, leftOpen: false, isOverlay: () => false, insightsMode: () => mode,
      K: { speechesTip: () => '' }, IS_MAC: true };
    vm.runInNewContext(`${src}; applyPanes();`, ctx);
    assert.equal($('#ins-cta').hidden, mode !== 'edge-connect', `#ins-cta in ${mode}`);
    assert.equal($('#ins-connect').hidden, false, 'the button itself is never the thing hidden');
    assert.equal($('#ins-show').hidden, mode !== 'edge-show', `#ins-show in ${mode}`);
    assert.equal($('#insights').dataset.mode, mode);
  }
});

// Why: if the start panel's file link stops reaching the hidden input, a judge cannot reopen a saved round from the first screen.
test('clicking "Open a round file (.tab)" on the start panel clicks the hidden file input', () => {
  const line = FLOW.split('\n').find((l) => l.startsWith("$('#start-open').addEventListener("));
  assert.ok(line, 'the start-open handler is wired at top level in flow.js');
  const { $ } = fakeDom();
  vm.runInNewContext(line, { $ });
  assert.equal($('#round-open').clicks, 0);
  $('#start-open').click();
  assert.equal($('#round-open').clicks, 1);
});

// Why: Round setup's open control was a <label>, which Tab skips; a keyboard-only judge could not open a .tab file from Round setup.
test('Round setup\'s "Open round file…" is a real button that clicks the hidden file input', () => {
  assert.match(HTML, /<button class="b" id="setup-open" type="button" aria-controls="round-open">Open round file…<\/button>/);
  assert.doesNotMatch(HTML, /<label for="round-open"/, 'no label stands in for a button');
  const line = CORE.split('\n').find((l) => l.startsWith("$('#setup-open').addEventListener("));
  assert.ok(line, 'the setup-open handler is wired at top level in core.js');
  const { $ } = fakeDom();
  vm.runInNewContext(line, { $ });
  $('#setup-open').click();
  assert.equal($('#round-open').clicks, 1);
});

// Why: on a 320-375 px phone the two-word name pushed the About page's "Open Tabula" button onto two lines; the narrow rule keeps both on one row.
test('the About page header steps the wordmark down under 420 px and keeps the full name', () => {
  const style = /<style>([\s\S]*?)<\/style>/.exec(ABOUT)[1];
  const narrow = /@media \(max-width: 419\.98px\) \{([\s\S]*?)\n  \}/.exec(style);
  assert.ok(narrow, 'a narrow header rule exists');
  assert.match(narrow[1], /\.wordmark \{ font-size: var\(--fs-3\); \}/);
  assert.doesNotMatch(narrow[1], /display:\s*none/, 'the name shrinks; it does not disappear');
});

// Why: the owner dropped the "Made by" byline; the page description shown in search results must not keep it.
test('the About page description names the product and has no byline', () => {
  const desc = /<meta name="description" content="([^"]*)">/.exec(ABOUT)[1];
  assert.match(desc, /^Tabula Debate /);
  assert.doesNotMatch(desc, /Made by|made by/);
});

// Why: the HTML holds the product name twice (static fallback and template); if they drift, a judge with a slow or blocked script sees one name and everyone else another.
test('every data-brand-* static text and aria-label already equals what brand.js would write', () => {
  const { TabulaBrand } = runBrand(fakePage([]), 2026);
  const unesc = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"');
  let n = 0;
  for (const [name, src] of [['index.html', HTML], ['about.html', ABOUT]]) {
    for (const m of src.matchAll(/<(\w+)\b([^>]*\bdata-brand-text="([^"]*)"[^>]*)>([^<]*)</g)) {
      assert.equal(unesc(m[4]), TabulaBrand.fill(unesc(m[3])), name + ': text of ' + m[3]); n++;
    }
    for (const m of src.matchAll(/<\w+\b[^>]*>/g)) {
      const tpl = /\bdata-brand-aria="([^"]*)"/.exec(m[0]);
      if (!tpl) continue;
      const aria = /\baria-label="([^"]*)"/.exec(m[0]);
      assert.ok(aria, name + ': a data-brand-aria element has a static aria-label');
      assert.equal(unesc(aria[1]), TabulaBrand.fill(unesc(tpl[1])), name + ': aria-label of ' + tpl[1]); n++;
    }
    for (const m of src.matchAll(/<span class="wm-product" data-brand-product>([^<]*)</g)) { assert.equal(m[1], TabulaBrand.PRODUCT, name + ': product word'); n++; }
  }
  assert.ok(n >= 10, 'the check found the brand slots (found ' + n + ')');
});
