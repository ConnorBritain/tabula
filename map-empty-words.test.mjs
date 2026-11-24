// Static checks for the Debate map empty states (copy trim audit D4/D5, docs/design/COPY-TRIM-AUDIT.md).
// Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const HTML = readFileSync(new URL('index.html', import.meta.url), 'utf8');
const INSIGHTS = readFileSync(new URL('js/insights.js', import.meta.url), 'utf8');

// Why: a judge mid-round who reads "click Draw" looks for a button that does not exist and loses time.
test('map empty lines name only buttons that exist', () => {
  assert.match(HTML, /id="map-add"[^>]*>\+ Argument</);
  assert.match(HTML, /id="map-go"[^>]*>Run</);
  assert.ok(INSIGHTS.includes("'<p class=\"muted\">No map yet. Click + Argument, or Run.</p>'"));
  assert.doesNotMatch(INSIGHTS, /\bDraw to let\b/);
});

// Why: once a map is saved the AI button reads "Update" (runVerb), so a line that says "Run" there sends the judge to the wrong word.
test('the no-arguments line uses the saved-map button word', () => {
  assert.ok(INSIGHTS.includes("'<p class=\"muted\">No arguments yet. Click + Argument, or Update.</p>'"));
  assert.match(INSIGHTS, /\$\('#map-go'\)\.textContent = L\.runVerb\(Boolean\(map\)\);/);
});
