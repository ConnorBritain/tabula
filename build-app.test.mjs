// Tests for the app builder (build-app.mjs). Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { build, listFiles } from './build-app.mjs';

const out = build(join(mkdtempSync(join(tmpdir(), 'app-')), 'app'));
const files = listFiles(out);

// Why: the app host is public. If the business plan, private notes, evals or plans
// shipped, prices, margins and student speech would be on the open web.
test('ships no private, planning, eval or test files', () => {
  const bad = files.filter((f) => /BUSINESS-PLAN|^private\/|^evals\/|^docs\/|PLAN\.md|\.test\.m?js$|\.local\.|(^|\/)\./.test(f));
  assert.deepEqual(bad, []);
});

// Why: a file index.html loads but the build left out would break the live app
// for every judge; the build must refuse, not ship a broken page.
test('ships every local file index.html loads', () => {
  for (const f of ['index.html', 'app.js', 'js/core.js', 'logic/round.js', 'vendor/anthropic-sdk-0.137.0.bundle.mjs', 'assets/tokens.css']) {
    assert.ok(files.includes(f), f);
  }
});

// Why: the CSP header is what keeps judges' API keys safe from outside scripts.
// Without _headers in the output, the live app would run with no CSP.
test('ships the security headers file', () => {
  assert.match(readFileSync(join(out, '_headers'), 'utf8'), /Content-Security-Policy: default-src 'self'; script-src 'self'/);
});
