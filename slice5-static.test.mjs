// Static checks for Slice 5 (shell and reach): the markup and wiring that unit tests cannot reach.
// Spec: docs/design/SPEC.md §3.5. Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const { readSource } = createRequire(import.meta.url)('./test-sources.js');
const HTML = readFileSync(new URL('index.html', import.meta.url), 'utf8');
const APP = readSource('app.js');
const STYLE = HTML.slice(HTML.indexOf('<style>'), HTML.indexOf('</style>'));
const between = (a, b) => HTML.slice(HTML.indexOf(a), HTML.indexOf(b, HTML.indexOf(a)));
const header = between('<header>', '</header>');

// Why: the top bar order is how a judge finds things in every place; a moved item breaks the tour and the habit (5.1).
test('5.1 top bar: brand to Flow · nav · spacer · chip · offline note · ? · gear, then the recording strip row', () => {
  assert.match(header, /class="brand"[^>]*data-tab-link="flow"/);
  const order = ['class="brand"', 'id="nav"', 'class="spacer"', 'id="clock-chip"', 'id="net-note"', 'id="help-btn"', 'id="settings-btn"', 'id="rec-strip"'];
  const at = order.map((s) => header.indexOf(s));
  at.forEach((i, k) => assert.ok(i > -1 && (k === 0 || i > at[k - 1]), order[k] + ' is out of order'));
  assert.match(header, /id="net-note" role="status"/);
  assert.doesNotMatch(header, /data-read=/, 'the Expert/Plain switch stays out of the header (4.9)');
  assert.match(STYLE, /\.hrow \{[^}]*flex-wrap: nowrap;/, 'one row; it wraps only in the narrow layout');
});

// Why: a help item that does nothing, or a hint paragraph, is noise in the one menu new judges open (5.3, Q12).
test('5.3 the ? menu: the items in order, two separators, no hint paragraph', () => {
  const menu = between('id="help-menu"', '</div>');
  const items = [...menu.matchAll(/role="menuitem"[^>]*>([^<]+)/g)].map((m) => m[1].trim());
  // CHANGED 2026-11-20 because the owner asked for the product name to show. Old check:
  //   assert.deepEqual(items, ['Take the full tour', 'Tour this page', 'Search and commands', 'Keyboard shortcuts', 'Debate library', 'About Tabula']);
  assert.deepEqual(items, ['Take the full tour', 'Tour this page', 'Search and commands', 'Keyboard shortcuts', 'Debate library', 'About Tabula Debate']);
  assert.equal((menu.match(/<hr class="help-sep">/g) || []).length, 2);
  assert.doesNotMatch(menu, /<p\b/);
  assert.match(APP, /openPalette\(\$\('#help-btn'\)\)/, 'Search and commands opens the palette');
  assert.match(APP, /toggleKeysSheet\(true, \$\('#help-btn'\)\)/, 'Keyboard shortcuts opens the sheet');
  for (const k of ["'ArrowDown'", "'ArrowUp'", "'Home'", "'End'", "'Tab'"]) assert.ok(APP.includes("e.key === " + k), 'menu key ' + k);
});

// Why: the round bar off Flow takes 76 px from Decide and History (Q-1); the chip replaces it there.
test('5.2 the round bar shows only on Flow, scoped by body[data-place]', () => {
  assert.match(STYLE, /body:not\(\[data-place="flow"\]\) \.roundbar \{ display: none; \}/);
  assert.match(APP, /document\.body\.dataset\.place = place;/);
  assert.match(APP, /L\.chipText\(/);
});

// Why: the study script and the tour quote this copy; a changed placeholder or hint makes a judge look for words that are not there.
test('5.4 palette: combobox, placeholder, footer and no-match copy', () => {
  const p = between('id="palette"', '<footer class="roundbar');
  assert.match(p, /role="combobox"[^>]*aria-controls="pal-list"/);
  assert.match(p, /placeholder="Search commands, sheets and speeches"/);
  assert.match(p, /↑↓ to move · ↵ to run · Esc to close/);
  assert.match(p, /No match\. Try "sheet", "prep" or a speech like "2AC"\./);
  assert.match(p, /id="pal-count" role="status" aria-live="polite"/);
  assert.match(APP, /setAttribute\('aria-activedescendant'/);
  assert.match(STYLE, /\.palette \{[^}]*width: min\(560px, 100%\);/);
  assert.match(STYLE, /\.overlay\.palette-wrap \{[^}]*padding-top: calc\(2 \* var\(--s7\)\);/, '96 px from the top');
});

// Why: every AI row must go through one helper, so a later program setting can hide them all from one place.
test('5.4 AI rows: one visibility helper', () => {
  assert.equal((APP.match(/aiAllowed:/g) || []).length, 1);
  assert.match(APP, /aiAllowed: aiCommandsAllowed\(\)/);
  assert.match(APP, /function aiCommandsAllowed\(\)/);
});

// Why: the sheet is the WCAG 2.1.4 switch; the label and help copy must name the keys it turns off (5.5).
test('5.5 shortcut sheet: title, search, no-match copy and the single-key switch in the sheet and in Settings', () => {
  const sh = between('id="keys-sheet"', '</aside>');
  assert.match(sh, />Keyboard shortcuts</);
  assert.match(sh, /placeholder="Search shortcuts"/);
  assert.match(APP, /'No shortcut matches\. Try the palette: '/);
  const label = 'Single-key shortcuts (Space, [, ], \\, ?)';
  assert.equal(HTML.split(label).length - 1, 2, 'the switch is in the sheet and in Settings');
  assert.equal(HTML.split('Turn off if you use voice control or the keys get in your way. ⌘ Enter still starts and pauses the clock.').length - 1, 2);
  assert.match(STYLE, /\.keys-sheet \{[^}]*z-index: var\(--z-drawer\);/);
});

// Why: the phone judge's clock must be the same clock as the round bar; two code paths drift apart (5.6b).
test('5.6b the clock renders into both places through one renderClockInto(el)', () => {
  assert.match(APP, /renderClockInto\(\$\('#clock'\), shown\);/);
  assert.match(APP, /renderClockInto\(\$\('#cv-clock'\), shown\);/);
  assert.ok(HTML.includes('Flowing needs a bigger screen. Use a tablet in landscape or a laptop to flow. Your clock and ballot work here.'));
  assert.match(HTML, /data-prep="aff" aria-label="Start Aff prep"/);
  assert.match(STYLE, /@media \(max-width: 819\.98px\) \{[^@]*#workspace, #workspace\.on \{ display: none; \}/);
});

// Why: the Slice 5 styles must use tokens only; a raw colour or z-index forks the visual system and the dark theme.
test('Slice 5 styles use tokens: no raw colours and no raw z-index', () => {
  const block = STYLE.slice(STYLE.indexOf('/* ----- Slice 5: shell and reach ----- */'), STYLE.indexOf('/* The print sheet (4.10)'));
  assert.ok(block.length > 1000);
  assert.doesNotMatch(block, /#[0-9a-f]{3,8}\b/i);
  assert.doesNotMatch(block, /rgb\(|hsl\(/);
  for (const m of block.matchAll(/z-index:\s*([^;]+);/g)) assert.match(m[1], /^var\(--z-/, m[0]);
});

// Why: study mode must send nothing and run only with ?study=1 (Part 6.3); a fetch here would leak test timings.
test('5.7 study mode: off unless ?study=1, local marks only, hooked into startSpeech', () => {
  const study = readFileSync(new URL('js/study.js', import.meta.url), 'utf8');
  assert.match(study, /L\.studyOn\(location\.search\)/);
  assert.doesNotMatch(study, /fetch\(|XMLHttpRequest|sendBeacon|WebSocket/);
  assert.match(APP, /studyStart\(s\.id\)/);
});

// Why: a COMMANDS row with no runner shows in the palette but does nothing when a judge picks it (architecture review, Slice 5).
test('5.4 every palette command has a runner: a tab on its COMMANDS row or an entry in PALETTE_RUN', async () => {
  const K = createRequire(import.meta.url)('./keys.js');
  const PAL = readFileSync(new URL('js/palette.js', import.meta.url), 'utf8');
  const block = PAL.slice(PAL.indexOf('const PALETTE_RUN = {'), PAL.indexOf('\n};', PAL.indexOf('const PALETTE_RUN = {')));
  assert.ok(block.length > 30, 'PALETTE_RUN is in js/palette.js');
  const keys = new Set([...block.matchAll(/^  (?:'([^']+)'|(\w+)):/gm)].map((m) => m[1] || m[2]));
  const dead = K.COMMANDS.filter((c) => !c.tab && !keys.has(c.id)).map((c) => c.id);
  assert.deepEqual(dead, [], 'commands with no runner');
  const extra = [...keys].filter((k) => !K.COMMANDS.some((c) => c.id === k));
  assert.deepEqual(extra, [], 'runners with no command');
  K.COMMANDS.filter((c) => c.tab).forEach((c) => assert.ok(!keys.has(c.id), c.id + ' has a tab and a runner; keep one'));
  assert.doesNotMatch(PAL, /'go\.flow': 'flow'/, 'the Go to tabs live on the COMMANDS rows, not in a second map');
});

// Why: the corner chip is the only clock a judge sees off Flow; without the colour change the last 30 s and overtime go unnoticed (5.2).
test('5.2 the chip turns caution in the last 30 s and error when over, after the base rule that sets its colour', () => {
  const base = STYLE.indexOf('.clock-chip {');
  const caution = STYLE.search(/\.clock-chip\.is-caution \{ color: var\(--caution\); \}/);
  const error = STYLE.search(/\.clock-chip\.is-error \{ color: var\(--error\); \}/);
  assert.ok(base > -1 && caution > base && error > base, 'the tone rules must follow .clock-chip, or its color: var(--text) wins');
});

// Why: a side panel left off the inert list stays reachable behind a modal, so Tab walks out of the dialog (4.2).
test('one inert list: ask, modalDialog and the palette share TabulaUI.BEHIND', () => {
  const UI = readFileSync(new URL('ui.js', import.meta.url), 'utf8');
  const PAL = readFileSync(new URL('js/palette.js', import.meta.url), 'utf8');
  assert.match(UI, /const BEHIND = 'header, main, \.roundbar, #tr-drawer, #keys-sheet, #study-card';/);
  assert.equal((UI.match(/querySelectorAll\(BEHIND\)/g) || []).length, 2);
  assert.match(PAL, /querySelectorAll\(window\.TabulaUI\.BEHIND \+ ', #tour-offer'\)/);
  assert.doesNotMatch(PAL, /setInterval\(/, 'the Undo row follows the tabula:toasts event, not a poll');
  assert.match(PAL, /addEventListener\('tabula:toasts'/);
});

// Why: on a phone the first-run tour offer sat on the full-screen sheet's single-key switch, so a judge could not turn single keys off (5.5).
test('5.5 the full-screen sheet hides the tour offer under 820 px', () => {
  assert.match(STYLE, /body:has\(#keys-sheet:not\(\[hidden\]\)\) \.tour-offer \{ display: none; \}/);
});
