// The app footer links to the app's source code. Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Why: the AGPL requires that users of the hosted app can find its source.
test('the app footer links to the source code', () => {
  const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
  const foot = (/<p class="app-foot[^"]*">([\s\S]*?)<\/p>/.exec(html) || [])[1] || '';
  assert.ok(foot.includes('<a href="https://github.com/TabulaSpeech/tabula" target="_blank" rel="noopener">Source code (AGPL)</a>'), 'footer: ' + foot);
});
