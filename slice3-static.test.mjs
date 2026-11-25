// Static checks for Slice 3 (visual system and Flow look). Spec: docs/design/SPEC.md §3.3. Run with: node --test
// These tests read the source files as text. The browser checks (widths, themes, tips) are in the manual checklist (§6.2).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

// CHANGED 2026-11-20 because the owner approved the module split: the page code is now js/*.js plus app.js, and the
// logic is logic/*.js plus logic.js. readSource('app.js') / readSource('logic.js') read every file of the group, so the
// checks below cover the same code as before. Old line:
//   const read = (f) => readFileSync(new URL(f, import.meta.url), 'utf8');
const { readSource: read } = createRequire(import.meta.url)('./test-sources.js');
const HTML = read('index.html');
const STYLE = /<style>([\s\S]*?)<\/style>/.exec(HTML)[1];
const APP = read('app.js');

// Why: a raw z-index number sits outside the layer map (V4), so a new pop-up can land under the toast or over a dialog.
test('no raw z-index numbers in the page or the library styles', () => {
  for (const [f, src] of [['index.html', HTML], ['learn.css', read('docs/library/learn.css')], ['about.html', read('about.html')]]) {
    assert.deepEqual(src.match(/z-index:\s*-?[0-9]/g), null, f);
  }
});

// Why: an old token name (for example --danger) no longer exists, so anything still using it draws with no colour at all (V0).
test('no old token names are left anywhere', () => {
  const old = /var\(--(bg|ink|ink-2|muted|line|line-2|danger|danger-bg|warn|warn-bg|ok-bg|aff-bg|neg-bg|aff-line|neg-line|r1|r2|r3|h-ctl|h-ctl-lg|fs|fs-xs|fs-sm|fs-md|fs-lg|fs-xl)\)/g;
  for (const f of ['index.html', 'app.js', 'ui.js', 'about.html', 'docs/library/learn.css']) assert.deepEqual(read(f).match(old), null, f);
});

// Why: the three copied token blocks drifted apart once already; only the token files (core/tokens.css, through assets/tokens.css) may define tokens (V0).
test('index.html keeps no :root token block and links tokens.css', () => {
  assert.doesNotMatch(STYLE, /:root\s*(\[[^\]]*\]|:not\([^)]*\))?\s*\{/);
  assert.match(HTML, /<link rel="stylesheet" href="assets\/tokens\.css">/);
});

// Why: status colour set from script skips the theme and can carry meaning by colour alone; it comes only from .is-* classes (V3, colour rule 4).
test('app.js sets no inline colour', () => {
  assert.equal((APP.match(/\.style\.color/g) || []).length, 0);
  assert.doesNotMatch(APP, /style="color:/);
});

// Why: two copies of the transcript drifted and split the judge's attention; Q7 keeps it only in the drawer (V8).
test('the left-pane transcript is gone from the page and the app', () => {
  for (const [f, src] of [['index.html', HTML], ['app.js', APP]]) {
    assert.doesNotMatch(src, /#transcript(?![-\w])|id="transcript"|tr-label|transcript-block/, f);
  }
  assert.match(HTML, /<section class="tab pane pane-left" id="tab-timer" aria-label="Speeches and docs">/);
  assert.match(HTML, /aria-label="Hide the speeches pane"/);
  // CHANGED (copy trim audit 2026-11-24: the transcript placeholder copy was cut; same check, new words). Old line:
  // assert.match(HTML, /placeholder="Words from the speech show here while the clock runs\. You can type or fix them\."/);
  assert.match(HTML, /placeholder="Speech text shows here\. You can edit it\."/);
  // The (?) about transcription and its problem dot moved into the drawer header.
  assert.match(HTML, /<div class="tr-drawer-head">[\s\S]*?aria-controls="rec-note"[\s\S]*?<\/div>/);
});

// Why: guessed heights (64, 76, 92, 132, 140, 148 px) put toasts and panes behind a round bar that wrapped to two lines (V2).
test('gaps above the round bar use --rb-h, not guessed pixels', () => {
  assert.doesNotMatch(STYLE, /var\(--rb-h,/, 'no guessed fallback inside var()');
  assert.doesNotMatch(STYLE, /(bottom|padding-bottom)\s*:\s*(64|76|92|132|140|148)px/);
  assert.doesNotMatch(STYLE, /box-shadow:\s*0/, 'no raw box-shadow values');
  assert.match(STYLE, /100dvh/);
});

// Why: a fixed pixel size outside the type scale breaks the 13 / 14 / 16 px rules (V1) and the 200% zoom check.
test('every font size in the page style uses the type scale', () => {
  const raw = [...STYLE.matchAll(/font-size\s*:\s*([^;}]+)/g)].map((m) => m[1].trim()).filter((v) => !/^var\(--fs-/.test(v) && v !== 'inherit');
  assert.deepEqual(raw, []);
  const fonts = [...STYLE.matchAll(/\bfont\s*:\s*([^;}]+)/g)].map((m) => m[1].trim()).filter((v) => v !== 'inherit' && !/var\(--fs-|var\(--fs-grid\)/.test(v));
  assert.deepEqual(fonts, []);
});

// Why: D3 and Q2: forms and reading text are 16 px, dense areas 14 px, tiles 13 px; the grid is 13/14 px on a laptop and 16 px on touch (Q-9) so iPad Safari does not zoom.
test('the type rules from V1 and V7 are in the page style', () => {
  assert.match(STYLE, /body \{[^}]*font: var\(--fs-3\)\/var\(--lh-read\) var\(--font-sans\)/);
  assert.match(STYLE, /input, select, textarea \{[^}]*font-size: var\(--fs-3\)/);
  assert.match(STYLE, /nav button \{[^}]*font-size: var\(--fs-2\)/);
  assert.match(STYLE, /\.sp \{[^}]*font-size: var\(--fs-1\)/);
  assert.match(STYLE, /\.tr-drawer textarea \{[^}]*font-size: var\(--fs-3\)/);
  assert.match(STYLE, /#tab-flow \{ container: flow \/ inline-size; \}/);
  assert.match(STYLE, /@container flow \(min-width: 840px\) \{ \.flow \{ --fs-grid: var\(--fs-2\); \} \}/);
  assert.match(STYLE, /@media \(pointer: coarse\) \{ \.flow \{ --fs-grid: var\(--fs-3\); \} \}/);
  assert.match(STYLE, /\.flow textarea \{[^}]*font: var\(--fs-grid\)\/var\(--lh-grid\) var\(--font-mono\)/);
  assert.doesNotMatch(HTML, /maximum-scale|user-scalable/, 'zoom is never locked');
});

// Why: Q1: only the flow grid is raised; a shadow on a side pane or on the 1.5 overlay competes with the grid for attention.
test('only the flow grid uses --shadow-1, and the panes are flat', () => {
  const uses = [...STYLE.matchAll(/([^{}]+)\{[^}]*var\(--shadow-1\)/g)].map((m) => m[1].trim());
  assert.deepEqual(uses, ['.flow']);
  const pane = /\.pane-left, \.pane-right \{([^}]*)\}/.exec(STYLE)[1];
  assert.doesNotMatch(pane, /background|border:|box-shadow/);
  assert.match(STYLE, /#workspace \.pane-left \{[^}]*box-shadow: none/);
});

// Why: targets under 24 px fail WCAG 2.5.8 and are easy to miss on a touchpad mid-round (V2).
test('small controls have a 24 px hit area', () => {
  for (const sel of [/\.tip \{[^}]*width: var\(--hit-min\); height: var\(--hit-min\)/, /\.aibar button \{[^}]*min-height: var\(--hit-min\)/, /\.madd \{[^}]*min-height: var\(--hit-min\)/]) assert.match(STYLE, sel);
});

// Why: V12: motion must stop for judges who ask for less of it, and Windows high-contrast users must still tell Aff from Neg and find the current column.
test('reduced motion and forced colours are handled', () => {
  // The global rule moved with the shared tokens to core/tokens.css; assets/tokens.css imports it.
  assert.match(read('core/tokens.css'), /@media \(prefers-reduced-motion: reduce\) \{\s*\*, \*::before, \*::after/);
  const fc = /@media \(forced-colors: active\) \{([\s\S]*?)\n  \}/.exec(STYLE)[1];
  // CHANGED 2026-11-20 because the owner approved docs/design/NO-STRIPES.md (D3: the side shows as a word, not a
  // 3 px top border). Old check:
  //   assert.match(fc, /\.aff[^{]*\{ border-top: 3px solid CanvasText; \}/);
  //   assert.match(fc, /\.neg[^{]*\{ border-top: 3px dashed CanvasText; \}/);
  // CHANGED 2026-11-22 because PF names its sides Pro and Con: the word comes from the round's format
  // (js/formatsetup.js sets --aff-word and --neg-word), with "Aff" and "Neg" as the fallback. Old check:
  //   assert.match(fc, /\.aff::after[^{]*\{ content: "Aff"; \}/);
  //   assert.match(fc, /\.neg::after[^{]*\{ content: "Neg"; \}/);
  assert.match(fc, /\.aff::after[^{]*\{ content: var\(--aff-word, "Aff"\); \}/);
  assert.match(fc, /\.neg::after[^{]*\{ content: var\(--neg-word, "Neg"\); \}/);
  assert.match(fc, /is-current \{ outline: 2px solid Highlight/);
});

// Why: Q3: the theme choice lives in Settings as plain radio buttons, System first and by default.
test('Settings has the Appearance card with Theme: System, Light, Dark', () => {
  const card = /<div class="card" id="appearance-card">([\s\S]*?)<\/fieldset>/.exec(HTML)[1];
  assert.match(card, /<h2>Appearance<\/h2>/);
  assert.match(card, /<legend>Theme<\/legend>/);
  assert.deepEqual([...card.matchAll(/type="radio" name="theme" value="(\w+)"/g)].map((m) => m[1]), ['system', 'light', 'dark']);
  assert.match(HTML, /System follows your device setting\./);
});

// Why: logos drawn for the wrong theme vanish (a black mark on a dark page); the swap follows the app's theme, not only the device (V10).
test('logos swap with the theme class, not a device-only <picture>', () => {
  for (const f of ['index.html', 'about.html', 'build-learn.mjs']) {
    const src = read(f);
    assert.doesNotMatch(src, /<source srcset="[^"]*tabula-mark-white/, f);
    assert.match(src, /class="(start-mark )?on-dark"/, f);
  }
});

// Why: the Connect AI edge is vertical text; without a full name a screen reader says only "Connect AI" with no hint of where it goes (V9).
test('the Insights edge has its Connect AI link and its Insights button', () => {
  assert.match(HTML, /data-tab-go="ai" aria-label="Connect AI in Settings to get live insights">Connect AI<\/button>/);
  assert.match(HTML, /id="ins-show" data-pane="right"/);
  assert.doesNotMatch(HTML, /id="show-right"/, 'the old Show insights button is replaced by the edge');
});

// Why: V11 copy: the Transcript button and the speech tiles say what they do and which side each speech is.
test('tip copy for the Transcript button and the speech tiles', () => {
  assert.match(HTML, /id="tr-toggle"[^>]*data-tip="Show or hide the transcript"/);
  // The side word comes from the round's format ('Aff' in policy and LD, 'Pro' in PF, 'Both' for a crossfire row).
  assert.match(APP, /data-tip="\$\{s\.label\} · \$\{L\.sideLabel\(FMT\(\), s\.side\)\}\$\{hasTr\}"/);
  assert.match(APP, /' · has transcript'/);
});

// Why: one tooltip module (V11): two copies of the hover code drifted in delay and look.
test('one tip module: no .hover-tip or .tip-pop left', () => {
  for (const f of ['index.html', 'app.js', 'ui.js']) assert.doesNotMatch(read(f), /hover-tip|tip-pop/, f);
  assert.match(read('ui.js'), /L\.tipDelay\(/);
});

// Why: a state class on #workspace that is also another element's class pulls that element's rules onto the whole
// workspace; with no AI the Flow grid then draws on Round, Decide, History and Settings and breaks the phone width.
test('the classes app.js toggles on #workspace are not the class of any element in the page', () => {
  const toggled = [...APP.matchAll(/\bws\.classList\.toggle\('([\w-]+)'/g)].map((m) => m[1]);
  assert.ok(toggled.includes('ins-folded'), 'the Insights fold class is toggled on the workspace');
  const body = HTML.slice(HTML.indexOf('<body'));
  const used = new Set([...body.matchAll(/\sclass="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/)));
  for (const c of toggled) assert.ok(!used.has(c), `"${c}" is toggled on #workspace and is also an element class`);
  // The edge strip rules are scoped to #insights, so no workspace class can pick them up.
  for (const [rule] of STYLE.matchAll(/[^{}]*\.ins-edge\s*\{/g)) assert.match(rule, /#insights \.ins-edge\s*\{|\[data-mode="open"\] \.ins-edge/, rule.trim());
});

// Why: a screen reader user hears the accessible name, not the tip; if the two differ, sighted and blind users are told different things.
// CHANGED 2026-11-20 because the owner chose the spec (SPEC.md 5.1: the gear keeps aria-label="Settings" and the tip "Settings")
// over this test's extra rule. Old check (the last line):
//   assert.match(name, /theme/);
test('the Settings button name says what the tip says', () => {
  const tag = /<button[^>]*id="settings-btn"[^>]*>/.exec(HTML)[0];
  const name = /aria-label="([^"]*)"/.exec(tag)[1], tip = /data-tip="([^"]*)"/.exec(tag)[1];
  assert.equal(name, tip);
  assert.equal(name, 'Settings');
});

// Why: tips that add words were title="" before; without aria-describedby screen readers lose those words (spec 4.4).
// A lost long-press click must not cancel the next tap (Start), and a tip must not pop up over what Esc uncovered.
test('the tip module wires aria-describedby, the long-press state and the Esc focus rule from logic.js', () => {
  const UI = read('ui.js');
  assert.match(UI, /L\.tipAddsWords\(/);
  assert.match(UI, /setAttribute\('aria-describedby'/);
  assert.match(UI, /L\.pressStep\(/);
  assert.match(UI, /addEventListener\('contextmenu'/);
  assert.match(UI, /L\.tipOnFocus\(/);
  assert.doesNotMatch(UI, /eatClick/, 'the old flag that was never reset is gone');
});

// Why: two classes for the same muted text drift apart; offline then looks different in two places (colour rule 4).
test('one class for quiet status text', () => {
  assert.doesNotMatch(HTML + APP, /ai-quiet/);
  assert.match(STYLE, /\.is-quiet \{ color: var\(--text-3\);/);
});
