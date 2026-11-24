// Tests for the design build of 2026-11-24, color, icons and hierarchy (docs/design/EVENTS-COLOR-ICON-REVIEW.md; owner
// picks D1 B, D2 A, D3 A, D4 B, D5 A): the control ladder (§5.1), one solid fill per view, status tints with words,
// the room primary that moves with the state, the stopped timer card, the ballot and private zones, the open prompts,
// the sticky ballot footer, the Lucide sprite (§5.3), the one chevron fold style (§5.4) and D5-A on My day.
// Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { ICONS, ICON_ONLY, icon, iconButton, spriteHtml } from './js/icons.js';

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

// ---------- the Lucide sprite (§5.3, the four Tier-1 icon tests) ----------

// Every page source that draws markup: the events modules, the Congress modules and the page shell.
const SOURCES = [
  ...readdirSync(new URL('./js/', import.meta.url)).filter((f) => f.endsWith('.js')).map((f) => ['js/' + f, read('./js/' + f)]),
  ...readdirSync(new URL('./congress/', import.meta.url)).filter((f) => f.endsWith('.js')).map((f) => ['congress/' + f, read('./congress/' + f)]),
  ['index.html', read('./index.html')],
];
// Every <svg class="i ..."> tag in a piece of HTML text.
const iconTags = (html) => html.match(/<svg class="i\b[^>]*>/g) || [];

// Why (test 1): an icon sits next to a word that already says what it means; an icon a screen reader can reach reads
// as "image" or as its path, so a blind judge hears noise on every button.
test('icons: every svg.i is aria-hidden, from icon() and in the page shell', () => {
  for (const name of Object.keys(ICONS)) for (const size of [14, 16, 20]) assert.match(icon(name, size), /^<svg class="i i-\d+" aria-hidden="true" focusable="false">/);
  for (const [f, src] of SOURCES) {
    if (f === 'js/icons.js') continue;
    for (const tag of iconTags(src)) assert.match(tag, /aria-hidden="true"/, f + ': ' + tag);
    // Outside icons.js and the static page shell, icons come only from icon(), never a hand-written tag.
    if (f !== 'index.html') assert.equal(iconTags(src).length, 0, f + ' writes an <svg class="i"> by hand; use icon()');
  }
  assert.match(spriteHtml(), /^<svg id="icon-sprite"[^>]* aria-hidden="true"/);
});

// Why (test 2): an icon with no word is a guess for most judges; the review allows only six well-known ones (back,
// more, close, drag, rank up, rank down), and each must have a spoken name or a screen reader says "button".
test('icons: an icon-only button has an aria-label and uses one of the six allowed icons', () => {
  assert.deepEqual([...ICON_ONLY].sort(), ['chevron-down', 'chevron-left', 'chevron-up', 'ellipsis', 'grip-vertical', 'x']);
  for (const name of ICON_ONLY) {
    const html = iconButton(name, 'More for HI Round 1', 'class="iconbtn"');
    assert.match(html, /aria-label="More for HI Round 1"/);
    assert.match(html, new RegExp('#i-' + name + '"'));
  }
  // A name off the list draws the label as a word instead of a lone icon.
  assert.equal(iconButton('copy', 'Copy all'), '<button type="button"  aria-label="Copy all">Copy all</button>');
  // In the code: a button whose only content is an icon (no word beside it) has an aria-label, and the icon is allowed.
  for (const [f, src] of SOURCES) {
    for (const m of src.matchAll(/<button\b([^>]*)>\s*\$\{icon\('([a-z-]+)'[^}]*\}\s*<\/button>/g)) {
      assert.match(m[1], /aria-label="/, f + ': an icon-only button without aria-label: ' + m[0]);
      assert.ok(ICON_ONLY.includes(m[2]), f + ': "' + m[2] + '" may not stand alone on a button');
    }
  }
});

// Why (test 3): a name the sprite does not hold draws nothing; a judge then sees a button with a gap where the cue was,
// and no error ever says so.
test('icons: every icon name the code uses and every #i-* reference exists in the sprite', () => {
  const sprite = spriteHtml();
  let seen = 0;
  for (const [f, src] of SOURCES) {
    for (const m of src.matchAll(/\bicon(?:Button)?\('([a-z-]+)'/g)) { seen++; assert.ok(m[1] in ICONS, f + ': no icon "' + m[1] + '"'); }
    for (const m of src.matchAll(/href="#i-([a-z-]+)"/g)) { seen++; assert.ok(sprite.includes('id="i-' + m[1] + '"'), f + ': no symbol i-' + m[1]); }
  }
  assert.ok(seen > 20, 'the screens use the sprite');
  assert.equal(icon('no-such-icon'), '');
});

// Why (test 4): DESIGN.md §1.1 and BRAND.md §7 keep brand color off controls; an icon with its own hex would put a
// fixed color in the chrome that ignores the dark theme and could look like a status.
test('icons: no icon has a hard-coded color; they draw in currentColor', () => {
  for (const [name, body] of Object.entries(ICONS)) {
    assert.doesNotMatch(body, /#[0-9a-f]{3,8}\b|rgb|hsl|(?:fill|stroke)="(?!none)/i, name);
  }
  assert.match(CSS, /svg\.i \{[^}]*fill: none; stroke: currentColor;/);
});

// Why: the review's open risk — on a dead school Wi-Fi the service worker serves only the files it listed; if the
// sprite module were not listed, every icon on every screen would vanish offline.
test('icons: the sprite module is a static import the service worker caches', () => {
  assert.match(read('./js/app.js'), /^import \{ mountSprite \} from '\.\/icons\.js';$/m);
  assert.match(read('./sw-files.js'), /"js\/icons\.js"/);
});
