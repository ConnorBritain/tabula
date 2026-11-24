// Tests for the design build of 2026-11-24, color, icons and hierarchy (docs/design/EVENTS-COLOR-ICON-REVIEW.md; owner
// picks D1 B, D2 A, D3 A, D4 B, D5 A): the control ladder (§5.1), one solid fill per view, status tints with words,
// the room primary that moves with the state, the stopped timer card, the ballot and private zones, the open prompts,
// the sticky ballot footer, the Lucide sprite (§5.3), the one chevron fold style (§5.4) and D5-A on My day.
// Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const CSS = read('./app.css');

// ---------- the control ladder and the repairs (§5.1, §4 "also do now") ----------

// Why: DESIGN.md §1.1 keeps every control neutral; without accent-color the Settings radios and the setup check boxes
// draw in the browser's blue, the one brand-like color a judge sees on a control.
test('radios and check boxes use the neutral accent, not the browser blue', () => {
  assert.match(CSS, /input\[type="radio"\], input\[type="checkbox"\] \{ accent-color: var\(--accent\); \}/);
});

// Why: the review found the Rank, Rate and Review shots with no green mark; OD3 puts the mark in the header of every
// route. If the mark moved into a screen's own markup, the screens that do not draw it would lose the brand.
test('the green header mark sits in the page header, outside the screen area, so every route shows it', () => {
  const html = read('./index.html');
  const header = html.slice(html.indexOf('<header class="bar">'), html.indexOf('</header>'));
  assert.match(header, /class="brand-mark"/);
  assert.doesNotMatch(html.slice(html.indexOf('<div id="screen">')), /brand-mark/);
});

// Why: the ladder says a solid control keeps a visible ring (§5.1 rule 2); a ring with no gap on a dark fill disappears
// for a keyboard judge in dark mode, who then cannot see which button Enter will press.
test('a solid primary gets a panel gap inside its focus ring', () => {
  assert.match(CSS, /button\.b\.primary:focus-visible \{ outline: 2px solid var\(--ring\); outline-offset: 2px; box-shadow: 0 0 0 2px var\(--panel\); \}/);
});
