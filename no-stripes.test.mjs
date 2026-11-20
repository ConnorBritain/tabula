// Tests for the owner's "no coloured left stripes" rule (2026-11-20). Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('index.html', import.meta.url), 'utf8');

// Why: the owner removed coloured side stripes as a look that reads like generic AI-made UI; if one comes back, the app drifts from the agreed visual system.
test('no element gets a coloured inset or left-border stripe', () => {
  assert.doesNotMatch(html, /box-shadow:\s*inset\s+\d+px\s+0\s+0\s+var\(--(aff|neg|error)[^)]*\)/);
  assert.doesNotMatch(html, /border-left:\s*\d+px\s+solid\s+var\(--(aff|neg|error)[^)]*\)/);
});

// Why: with the stripe gone, the label colour is the only quick side cue on a speech tile; without it judges cannot tell Aff from Neg at a glance.
test('speech tiles show their side in the label text colour', () => {
  assert.match(html, /\.sp\.aff\s*\{[^}]*color:\s*var\(--aff\)/);
  assert.match(html, /\.sp\.neg\s*\{[^}]*color:\s*var\(--neg\)/);
});

// ---- Added 2026-11-20 for the owner-approved stripe plan (docs/design/NO-STRIPES.md, "Yes, apply all"). ----
import { createRequire } from 'node:module';
const { readSource } = createRequire(import.meta.url)('./test-sources.js');
const STYLE = /<style>([\s\S]*?)<\/style>/.exec(html)[1];
const about = readFileSync(new URL('about.html', import.meta.url), 'utf8');
// Every place a style can be written: the app page, About, the library CSS, and all page code (js/*.js, app.js, ui.js, tour.js).
const SOURCES = {
  'index.html': html,
  'about.html': about,
  'docs/library/learn.css': readFileSync(new URL('docs/library/learn.css', import.meta.url), 'utf8'),
  'page code (js/*.js + app.js)': readSource('app.js'),
  'ui.js': readSource('ui.js'),
  'tour.js': readSource('tour.js'),
};

// Split a CSS value on top-level commas (not the commas inside rgb() or var()).
function splitTop(v) {
  const out = []; let depth = 0; let cur = '';
  for (const ch of v) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
  }
  return [...out, cur];
}
// Length tokens from tokens.css (for example --s1: 4px), so a bar written as var(--s1) is measured too.
const LEN = Object.fromEntries([...readFileSync(new URL('assets/tokens.css', import.meta.url), 'utf8').matchAll(/(--[a-z0-9-]+):\s*(-?\d*\.?\d+)px\s*;/g)].map((m) => [m[1], parseFloat(m[2])]));
const px = (t) => {
  const v = /^var\((--[a-z0-9-]+)\)$/.exec(t);
  if (v) return v[1] in LEN ? LEN[v[1]] : null;
  return /^-?\d*\.?\d+(px)?$/.test(t) ? parseFloat(t) : null;
};
// Neutral colours a 1 px side divider may use: the two border tokens, and the system colours of forced-colours mode.
const NEUTRAL_EDGE = /var\(--border(?:-ctl)?\)|\b(?:CanvasText|Canvas|GrayText)\b/;
// The stripes found in one source text: one-sided inset shadows and side borders wider than 1 px.
function stripes(src) {
  const found = [];
  for (const m of src.matchAll(/(?:box-shadow|boxShadow)\s*[:=]\s*['"`]?([^;}"'`]+)/g)) {
    for (const part of splitTop(m[1])) {
      const inset = /\binset\b/.test(part);
      const lens = part.replace(/\binset\b/, '').trim().split(/\s+/).map(px).filter((n) => n !== null);
      if (lens.length < 2 || (lens[0] === 0 && lens[1] === 0)) continue;
      if (inset) found.push('one-sided inset shadow: ' + m[0].trim());
      // An outer shadow with no blur and an offset is a hard bar beside the box (for example 0 3px 0 var(--aff)).
      else if ((lens[2] ?? 0) === 0) found.push('hard outer shadow bar: ' + m[0].trim());
    }
  }
  const side = /(?:border-(?:left|right|top|bottom|inline|block|inline-start|inline-end|block-start|block-end)(?:-width)?|border(?:Left|Right|Top|Bottom)(?:Width)?)\s*[:=]\s*['"`]?([^;}"'`]+)/g;
  for (const m of src.matchAll(side)) {
    const w = m[1].trim().split(/\s+/).map(px).find((n) => n !== null);
    if (w !== undefined && w > 1) found.push('side border over 1 px: ' + m[0].trim());
    else if (w !== undefined && w > 0 && !NEUTRAL_EDGE.test(m[1])) found.push('coloured 1 px side border: ' + m[0].trim());
    if (/\b(thick|medium)\b/.test(m[1])) found.push('side border keyword width: ' + m[0].trim());
  }
  for (const m of src.matchAll(/border-width\s*:\s*([^;}]+)/g)) {
    const ws = m[1].trim().split(/\s+/).map(px);
    if (ws.length > 1 && new Set(ws).size > 1 && ws.some((n) => n > 1)) found.push('uneven border-width: ' + m[0].trim());
  }
  // A gradient with a hard stop (two stops at the same place) paints a bar, for example var(--aff) 4px, transparent 4px.
  for (const m of src.matchAll(/gradient\(((?:[^()]|\([^()]*\))*)\)/g)) {
    const at = splitTop(m[1]).map((stop) => stop.trim().split(/\s+/).slice(1).map(px).filter((n) => n !== null).pop());
    if (at.some((v, i) => i > 0 && v !== undefined && v === at[i - 1])) found.push('hard-stop gradient bar: ' + m[0]);
  }
  // A ::before or ::after with a fill that is thin in one direction only is a bar (a small dot is thin in both).
  for (const m of src.matchAll(/([^{}]*::?(?:before|after)[^{]*)\{([^}]*)\}/g)) {
    if (!/\bbackground(?:-color)?\s*:/.test(m[2])) continue;
    const dim = (k) => { const d = new RegExp('(?:^|[;\\s])' + k + '\\s*:\\s*([^;]+)').exec(m[2]); return d ? px(d[1].trim()) : null; };
    const thinW = (dim('width') ?? 99) <= 4; const thinH = (dim('height') ?? 99) <= 4;
    if (thinW !== thinH) found.push('pseudo-element bar: ' + m[1].trim());
  }
  return found;
}

// Why: the owner ruled that coloured accent bars on one side read as AI-made UI; a new one in any page or in code that builds styles brings the look back.
test('no one-sided inset shadow or side border over 1 px in the app, About, the library or the page code', () => {
  for (const [name, src] of Object.entries(SOURCES)) assert.deepEqual(stripes(src), [], name);
});

// Why: the guard is only useful if it really catches the stripe shapes the owner banned and still lets dividers and full outlines through.
test('the stripe finder catches bars and allows dividers and full outlines', () => {
  for (const bad of ['.x { box-shadow: inset 0 -3px 0 var(--text); }', '.x { box-shadow: inset 3px 0 0 var(--border-ctl); }',
    '.x { border-left: 3px solid var(--aff); }', '.x { border-top: 2px dashed CanvasText; }', "el.style.borderLeft = '4px solid red'",
    '.x { border-width: 0 0 0 3px; }', '.x { box-shadow: var(--shadow-2), inset 0 2px 0 var(--text); }']) {
    assert.ok(stripes(bad).length > 0, bad);
  }
  for (const ok of ['.x { box-shadow: inset 0 0 0 2px var(--text); }', '.x { border-right: 1px solid var(--border); }',
    '.x { border-bottom: 0; }', '.x { border: 3px double #000; }', '.x { box-shadow: 0 6px 18px rgb(0 0 0 / .14); }']) {
    assert.deepEqual(stripes(ok), [], ok);
  }
});

// Why: an underline in an accent colour is a stripe under text; if it comes back, flow marks drift from the one-look rule (fill or full outline).
test('no coloured accent underlines', () => {
  for (const [name, src] of Object.entries(SOURCES)) {
    assert.doesNotMatch(src, /text-decoration[^;}]*underline[^;}]*var\(--/, name);
    assert.doesNotMatch(src, /text-decoration-color\s*:/, name);
  }
});

// Why: D2: without the bar, the 2 px outline and the filled "Now" pill are what tell a judge which column the running speech is in.
test('the current column has a full 2 px outline and a filled Now pill, and no bar under its header', () => {
  assert.doesNotMatch(STYLE, /\.is-current h3\s*\{/);
  // CHANGED 2026-11-20 after the visual review of the first build (the sticky header hid the top edge, and the
  // Viewing border made its header 2 px taller). These assertions were written in the same uncommitted build. Old checks:
  //   assert.match(STYLE, /\.flow \.col\.is-current \{ box-shadow: inset 0 0 0 2px var\(--text\); \}/);
  //   assert.match(STYLE, /\.col-mark\.is-viewing \{ border: 1px solid var\(--border-ctl\); color: var\(--text-2\); \}/);
  assert.match(STYLE, /\.flow \.col\.is-current::after \{ content: ""; position: absolute; inset: 0; z-index: var\(--z-sticky\); pointer-events: none; outline: 2px solid var\(--text\); outline-offset: -2px; \}/);
  assert.match(STYLE, /\.col-mark\.is-now \{ background: var\(--accent\); color: var\(--on-accent\); \}/);
  assert.match(STYLE, /\.col-mark\.is-viewing \{ outline: 1px solid var\(--border-ctl\); outline-offset: -1px; color: var\(--text-2\); \}/);
  assert.match(STYLE, /\.col-mark \{[^}]*border-radius: var\(--r-pill\)/);
  const app = readSource('app.js');
  assert.match(app, /mark\.classList\.toggle\('is-now', i === m\.now\)/);
  assert.match(app, /mark\.classList\.toggle\('is-viewing'/);
  assert.doesNotMatch(app + readSource('logic.js'), /bar under its header|with the bar and outline/, 'comments no longer name the bar');
});

// Why: the visual review found the current-column outline hidden at the top by the sticky header; a three-sided frame reads as two side bars, the look the owner banned.
test('the current-column outline is drawn above the sticky header', () => {
  const after = /\.flow \.col\.is-current::after \{([^}]*)\}/.exec(STYLE)[1];
  const head = /\.flow \.col h3 \{([^}]*)\}/.exec(STYLE)[1];
  assert.match(head, /z-index: var\(--z-sticky\)/);
  assert.match(after, /z-index: var\(--z-sticky\)/, 'same layer, later in the page, so it paints over the header');
  assert.match(after, /pointer-events: none/, 'the frame must not block typing in the column');
  assert.doesNotMatch(STYLE, /\.flow \.col\.is-current \{ box-shadow/, 'no outline left under the header');
  const fc = /@media \(forced-colors: active\) \{([\s\S]*?)\n  \}/.exec(STYLE)[1];
  assert.match(fc, /\.flow \.col\.is-current::after \{ outline-color: Highlight; \}/);
});

// Why: a header that grows (a wrapped title, the Now or Viewing pill, the forced-colours side word) pushed only its own column's text down, so rows across Aff and Neg no longer lined up.
test('flow headers share one row height, so the first text line lines up in every column', () => {
  assert.match(STYLE, /\.flow \{[^}]*grid-template-rows: auto 1fr;/);
  assert.match(STYLE, /\.flow \.col \{[^}]*display: grid; grid-row: span 2; grid-template-rows: subgrid; \}/);
  assert.doesNotMatch(/\.col-mark[^{]*\{[^}]*\}/g.exec(STYLE)[0] + (STYLE.match(/\.col-mark\.is-[a-z]+ \{[^}]*\}/g) || []).join(''), /\bborder:/, 'a pill edge must not add height');
});

// Why: forced colours drop the --accent fill, so "Now" became bare text and looked no stronger than "Viewing".
test('in forced colours the Now pill keeps a filled look', () => {
  const fc = /@media \(forced-colors: active\) \{([\s\S]*?)\n  \}/.exec(STYLE)[1];
  assert.match(fc, /\.col-mark\.is-now \{ forced-color-adjust: none; background: CanvasText; color: Canvas; \}/);
});

// Why: D3: in Windows high contrast the tints are gone; the word "Aff" or "Neg" is then the only side cue, and the 3 px borders it replaced were stripes.
test('forced colours show the side as a word pill, not a top border', () => {
  const fc = /@media \(forced-colors: active\) \{([\s\S]*?)\n  \}/.exec(STYLE)[1];
  assert.doesNotMatch(fc, /border-top: 3px/);
  for (const sel of ['.flow .col.aff h3::after', '.mapsheet .mh.aff::after', '.sp.aff::after', '.mcard.aff::after']) assert.ok(fc.includes(sel), sel);
  assert.match(fc, /::after \{ display: inline-block;[^}]*border: 1px solid CanvasText; border-radius: var\(--r-pill\); font-size: var\(--fs-1\)/);
});

// Why: review of the first build found the finder blind to bars drawn another way; a hard outer shadow, a hard-stop gradient, a thin ::before or a coloured 1 px edge would bring the banned look back unseen.
test('the stripe finder also catches shadow, gradient, pseudo-element and coloured 1 px bars', () => {
  for (const bad of ['.x { box-shadow: 0 3px 0 var(--aff); }', '.x { box-shadow: -4px 0 0 0 var(--neg); }',
    '.x { background: linear-gradient(90deg, var(--aff) 4px, transparent 4px); }',
    '.x::before { content: ""; position: absolute; top: 0; bottom: 0; left: 0; width: 3px; background: var(--aff); }',
    '.x::after { content: ""; height: var(--s1); background: var(--accent); }',
    '.x { border-left: 1px solid var(--aff); }', "el.style.borderTop = '1px solid red'"]) {
    assert.ok(stripes(bad).length > 0, bad);
  }
  for (const ok of ['.x { background: linear-gradient(transparent, var(--panel)); }', '.x { box-shadow: var(--scrim) 0 0 0 9999px; }',
    '.x::after { content: ""; width: 8px; height: 8px; border-radius: 50%; background: var(--error); }',
    '.x { border-top: 1px solid var(--border-ctl); }', '.x { border-top: 1px solid CanvasText; }']) {
    assert.deepEqual(stripes(ok), [], ok);
  }
});

// Why: D4: dropped and weighing marks must keep a look of their own (dropped would match "conceded" otherwise), now as full outlines, not underlines.
test('dropped and weighing flow marks are full outlines', () => {
  assert.match(STYLE, /\.flow-hl \.fm-drop \{ background: var\(--caution-tint\); outline: 1px dashed var\(--caution\); outline-offset: -1px; \}/);
  assert.match(STYLE, /\.flow-hl \.fm-weigh \{ outline: 1px dotted var\(--border-ctl\); outline-offset: -1px; \}/);
  for (const r of STYLE.match(/\.flow-hl[^{]*\{[^}]*\}/g)) assert.doesNotMatch(r, /text-decoration|border-(left|right|top|bottom)/, r);
});

// Why: D5: the confirm button of a danger dialog must look like the strong, final choice; an outline one looks like Cancel and invites a wrong click.
test('the danger button is a solid fill with hover and pressed tokens', () => {
  assert.match(STYLE, /button\.b\.danger \{ background: var\(--danger-fill\); color: var\(--on-danger\); border-color: var\(--danger-fill\); \}/);
  assert.match(STYLE, /button\.b\.danger:hover \{ background: var\(--danger-hover\);/);
  assert.match(STYLE, /button\.b\.danger:active \{ background: var\(--danger-press\);/);
  assert.doesNotMatch(STYLE, /button\.b\.danger \{ color: var\(--error\)/);
  assert.match(STYLE, /button\.b\.danger:disabled/, 'a disabled danger button still looks disabled');
});

// Why: the primary button had no pressed state and a hover written as a raw text colour; tokens keep one look across the app, About and the library.
test('primary buttons use the hover and pressed tokens on every page type', () => {
  assert.match(STYLE, /button\.b\.primary:hover \{ background: var\(--accent-hover\);/);
  assert.match(STYLE, /button\.b\.primary:active \{ background: var\(--accent-press\);/);
  for (const src of [about, SOURCES['docs/library/learn.css']]) {
    assert.match(src, /\.btn\.primary:hover \{ background: var\(--accent-hover\);/);
    assert.match(src, /\.btn\.primary:active \{ background: var\(--accent-press\);/);
    assert.match(src, /\.btn:hover \{ background: var\(--sunk\);/);
  }
});

// Why: D6: one shared quiet button keeps low-priority actions the same everywhere; hand-made copies drift apart in hover and focus.
test('a shared quiet button class is used by the help menu and the Insights edge', () => {
  assert.match(STYLE, /button\.b\.quiet \{ background: none; border-color: transparent; color: var\(--text-2\); \}/);
  assert.match(STYLE, /button\.b\.quiet:hover \{ background: var\(--sunk\);/);
  const menu = html.slice(html.indexOf('id="help-menu"'), html.indexOf('</div>', html.indexOf('id="help-menu"')));
  const items = menu.match(/<button [^>]*role="menuitem"/g) || [];
  assert.ok(items.length >= 4);
  for (const b of items) assert.match(b, /class="b quiet"/, b);
  assert.match(html, /<button class="b quiet ins-edge-btn" type="button" id="ins-show"/);
  assert.doesNotMatch(STYLE, /\.help-menu button \{[^}]*background: none/, 'the menu no longer hand-styles its own text button');
});

// Why: D6 names six hand-made text buttons; the tabs and the toast dismiss must use the one quiet class too, or their hover and focus drift from it.
test('the main tabs, the Decide tabs and the toast dismiss are quiet buttons', () => {
  assert.match(readSource('app.js'), /`<button type="button" class="b quiet" data-tab="\$\{id\}">/);
  const sub = /<nav id="subnav"[^>]*>([\s\S]*?)<\/nav>/.exec(html)[1];
  const tabs = sub.match(/<button[^>]*>/g);
  assert.equal(tabs.length, 3);
  for (const b of tabs) assert.match(b, /class="b quiet"/, b);
  assert.match(readSource('ui.js'), /x\.className = 'b quiet toast-x'/);
  assert.match(STYLE, /nav button\.b\.on, nav button\.b\.on:hover \{ color: var\(--text\); background: var\(--border\); \}/, 'the selected tab keeps its fill');
  assert.match(STYLE, /\.toast button\.b\.quiet \{[^}]*color: inherit;/, 'the dismiss reads on the dark info toast');
  for (const r of ['nav button', '.subnav button', '.toast-x']) assert.doesNotMatch(STYLE, new RegExp(r.replace('.', '\\.') + ' \\{[^}]*background: (none|transparent)'), r + ' is no longer hand-styled');
  assert.doesNotMatch(STYLE, /\.help-menu button\.b \{[^}]*(color|font-weight):/, 'menu items keep the quiet text colour and weight');
});

// Why: the About cards used Aff blue and Neg red for audiences, which tells readers that judges are "Aff"; side colours are data only.
test('About "Who it is for" cards are plain and use no side colour', () => {
  const who = about.match(/\.who[^{]*\{[^}]*\}/g) || [];
  assert.ok(who.length >= 2);
  for (const r of who) assert.doesNotMatch(r, /--aff|--neg|box-shadow/, r);
  assert.match(about, /\.who div \{ background: var\(--panel\); border: 1px solid var\(--border\); border-radius: var\(--r-xl\); padding: var\(--s4\); \}/);
});
