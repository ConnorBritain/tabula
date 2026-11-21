// The History table on a phone (owner request of 2026-11-20: "fix the History table scrolling on phones").
// The table scrolls inside its own .scroll box. Its header has an sr-only "Actions" label (position: absolute);
// if .scroll is not a positioned box, that label escapes the box and widens the whole page. Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const HTML = fs.readFileSync(new URL('./index.html', import.meta.url), 'utf8');

// Why: if .scroll loses its position, the History page widens to about 486 px on a 375 px phone and the whole page
// scrolls sideways again. This checks the CSS text only (no layout engine in node); the browser check is in the commit.
test('.scroll is a positioned box, so absolute children stay inside its overflow', () => {
  const rules = [...HTML.matchAll(/(?:^|[\s,}])\.scroll\s*\{([^}]*)\}/g)].map((m) => m[1]);
  assert.ok(rules.length >= 1, 'the .scroll rule exists');
  assert.match(rules[0], /overflow-x:\s*auto/);
  assert.match(rules[0], /position:\s*relative/);
  for (const r of rules.slice(1)) assert.doesNotMatch(r, /position:\s*static/, 'no later .scroll rule undoes the position');
});

// Why: if the History table moves out of its .scroll box, the wide table itself pushes the phone page sideways.
test('the History table sits inside a .scroll box', () => {
  assert.match(HTML, /class="scroll"[^>]*>\s*<table[^>]*id="log-table"/);
});
