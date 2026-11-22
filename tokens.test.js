// Tests for the token files (core/tokens.css, imported by assets/tokens.css, the one file every page links) and the theme boot script (spec Part 2, V0, V10). Run with: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const L = require('./logic.js');

const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
// The tokens a page gets: core/tokens.css (shared, step C4), then assets/tokens.css (debate's side colours), which
// imports the core file first.
const CSS_PARTS = [read('core/tokens.css'), read('assets/tokens.css')];

// The custom properties inside the first rule whose selector matches, in each file, as one { name: value }.
// Each file has one block per theme, so the first match per file is the whole block.
function block(parts, selectorRe) {
  const out = {};
  for (const css of parts) {
    const m = selectorRe.exec(css);
    if (!m) continue;
    const start = css.indexOf('{', m.index) + 1;
    const body = css.slice(start, css.indexOf('}', start));
    for (const x of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) out[x[1]] = x[2].trim();
  }
  assert.ok(Object.keys(out).length, 'no block for ' + selectorRe);
  return out;
}
const LIGHT = block(CSS_PARTS, /^:root \{/m);
const DARK = block(CSS_PARTS, /^:root\[data-theme="dark"\] \{/m);
const DARK_NO_JS = block(CSS_PARTS, /:root:not\(\[data-theme\]\) \{/);
const PRINT = block(CSS_PARTS, /:root\[data-theme\], :root:not\(\[data-theme\]\) \{/);
const isColour = (v) => /#[0-9a-f]{3,8}\b/i.test(v);
const colours = (b) => Object.fromEntries(Object.entries(b).filter(([, v]) => isColour(v)));

// WCAG 2 relative luminance and contrast ratio.
function hex(v) {
  let h = /#([0-9a-f]{3,8})\b/i.exec(v)[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}
const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = (v) => { const [r, g, b] = hex(v).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// Why: a light colour with no dark value leaves a white box or black text on the dark theme, which a judge reads at night.
test('every light colour token has a dark value', () => {
  const light = colours(LIGHT);
  assert.ok(Object.keys(light).length >= 26, 'the light block holds the colour tokens');
  for (const k of Object.keys(light)) assert.ok(k in DARK, k + ' has no dark value');
});

// Why: the dark values are written twice (chosen theme, and a no-script page on a dark device); if the copies drift, the library looks different from the app.
test('the no-script dark block equals the chosen dark block', () => {
  assert.deepEqual(DARK_NO_JS, DARK);
});

// Why: colour rule 7: print is always light, so a ballot printed from dark mode is readable on paper.
test('print uses the light colour values', () => {
  for (const [k, v] of Object.entries(colours(LIGHT))) assert.equal(PRINT[k], v, 'print ' + k);
});

// Why: these pairs carry the round (Aff/Neg text, errors, control edges, the focus ring); under the minimum, judges with low vision or in a bright room cannot read them (WCAG 1.4.3, 1.4.11).
test('every Part 2 contrast pair passes in light and dark', () => {
  const pairs = [
    ['--aff', '--panel', 4.5], ['--aff', '--aff-tint', 4.5], ['--neg', '--panel', 4.5], ['--neg', '--neg-tint', 4.5],
    ['--text-3', '--canvas', 4.5], ['--error', '--panel', 4.5], ['--error', '--error-tint', 4.5], ['--caution', '--caution-tint', 4.5],
    ['--border-ctl', '--panel', 3], ['--border-ctl', '--canvas', 3], ['--ring', '--panel', 3],
  ];
  for (const [name, set] of [['light', LIGHT], ['dark', DARK]]) {
    for (const [fg, bg, min] of pairs) {
      const r = ratio(set[fg], set[bg]);
      assert.ok(r >= min, `${name}: ${fg} on ${bg} is ${r.toFixed(2)}, needs ${min}`);
    }
  }
});

// Why: the button kinds (docs/design/NO-STRIPES.md §5) put text on new fills; under the minimum, a judge cannot read "Delete audio" or the primary label on hover or press (WCAG 1.4.3, 1.4.11).
test('every button token pair passes in light and dark', () => {
  const pairs = [
    ['--on-accent', '--accent', 4.5], ['--on-accent', '--accent-hover', 4.5], ['--on-accent', '--accent-press', 4.5],
    ['--on-danger', '--danger-fill', 4.5], ['--on-danger', '--danger-hover', 4.5], ['--on-danger', '--danger-press', 4.5],
    ['--danger-fill', '--panel', 3], ['--danger-fill', '--canvas', 3],
    ['--text-2', '--canvas', 4.5], ['--text-2', '--panel', 4.5], ['--text', '--sunk', 4.5], ['--text', '--border', 4.5],
    ['--on-accent', '--text', 4.5],
  ];
  for (const [name, set] of [['light', LIGHT], ['dark', DARK], ['print', PRINT]]) {
    for (const [fg, bg, min] of pairs) {
      assert.ok(set[fg] && set[bg], `${name}: ${fg} and ${bg} are defined`);
      const r = ratio(set[fg], set[bg]);
      assert.ok(r >= min, `${name}: ${fg} on ${bg} is ${r.toFixed(2)}, needs ${min}`);
    }
  }
});

// Why: the contrast test is only as good as its maths; a wrong formula would pass every pair.
test('the contrast helper matches known WCAG ratios', () => {
  assert.equal(Math.round(ratio('#000', '#fff') * 100) / 100, 21);
  assert.equal(Math.round(ratio('#777', '#fff') * 100) / 100, 4.48);
});

// Why: Part 2 says there is no 12 px size and no text under 13 px; a smaller step in the scale invites unreadable text.
test('the type scale starts at 13 px and has no 12 px step', () => {
  for (const k of ['--fs-1', '--fs-2', '--fs-3', '--fs-4', '--fs-5', '--fs-grid']) {
    const px = parseFloat(LIGHT[k]);
    assert.ok(px >= 13, k + ' is ' + LIGHT[k]);
  }
  assert.equal(LIGHT['--fs-1'], '13px');
  assert.equal(LIGHT['--lh-grid'], '20px');
});

// Run assets/theme-boot.js against a fake page: the saved setting, the device setting, and what it writes.
function boot(setting, prefersDark) {
  const attrs = {};
  const win = {
    localStorage: { getItem: () => (setting == null ? null : JSON.stringify({ theme: setting })) },
    matchMedia: () => ({ matches: prefersDark, addEventListener() {} }),
    addEventListener() {},
    document: { documentElement: { getAttribute: (k) => attrs[k] ?? null, setAttribute: (k, v) => { attrs[k] = v; } } },
  };
  win.window = win;
  vm.runInNewContext(read('assets/theme-boot.js'), win);
  return { theme: attrs['data-theme'], api: win.TabulaTheme };
}

// Why: theme-boot.js runs before logic.js loads, so it carries its own copy of the rule; if the two disagree, the page flashes to the other theme once the app starts.
test('theme-boot.js draws the same theme as L.resolveTheme, before the page paints', () => {
  for (const setting of ['system', 'light', 'dark', null]) {
    for (const dark of [false, true]) {
      const { theme, api } = boot(setting, dark);
      assert.equal(theme, L.resolveTheme(setting || 'system', dark), `setting ${setting}, device dark ${dark}`);
      assert.equal(api.resolve(setting, dark), L.resolveTheme(setting, dark));
    }
  }
});

// Why: a broken saved setting (old or hand-edited storage) must fall back to System, not crash the page before it draws.
test('theme-boot.js survives unreadable storage', () => {
  const attrs = {};
  const win = {
    localStorage: { getItem: () => '{not json' }, matchMedia: () => ({ matches: true, addEventListener() {} }), addEventListener() {},
    document: { documentElement: { getAttribute: (k) => attrs[k] ?? null, setAttribute: (k, v) => { attrs[k] = v; } } },
  };
  win.window = win;
  vm.runInNewContext(read('assets/theme-boot.js'), win);
  assert.equal(attrs['data-theme'], 'dark');
  assert.equal(win.TabulaTheme.set('light'), 'light');
  assert.equal(attrs['data-theme'], 'light');
});

// Why: the theme script must block in <head> before any style loads; loaded later (or async), dark-mode judges see a white flash on every load.
test('every page type loads theme-boot.js first in <head>, then tokens.css', () => {
  const learn = fs.readdirSync(path.join(__dirname, 'learn'), { recursive: true }).filter((f) => f.endsWith('.html')).map((f) => 'learn/' + f);
  assert.ok(learn.length > 10, 'the library is built');
  for (const f of ['index.html', 'about.html', ...learn]) {
    const html = read(f);
    const head = html.slice(0, html.indexOf('</head>'));
    const bootAt = head.search(/<script src="[^"]*assets\/theme-boot\.js"><\/script>/);
    const tokensAt = head.search(/<link rel="stylesheet" href="[^"]*assets\/tokens\.css">/);
    const firstStyle = head.search(/<style>|<link rel="stylesheet"/);
    assert.ok(bootAt > 0, f + ': theme-boot.js in <head>');
    assert.ok(tokensAt > bootAt && firstStyle > bootAt, f + ': theme-boot.js comes before any style');
  }
});
