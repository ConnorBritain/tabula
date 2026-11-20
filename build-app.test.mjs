// Tests for the app builder (build-app.mjs). Run with: node --test
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ALLOW, build, listFiles } from './build-app.mjs';

const tmp = () => join(mkdtempSync(join(tmpdir(), 'app-')), 'app');
let out;
let files;
before(() => {
  out = build(tmp());
  files = listFiles(out);
});

// Why: the app host is public. If the business plan, private notes, evals or plans
// shipped, prices, margins and student speech would be on the open web.
test('ships no private, planning, eval or test files', () => {
  const bad = files.filter((f) => /BUSINESS-PLAN|^private\/|^evals\/|^docs\/|PLAN\.md|\.test\.m?js$|\.local\.|(^|\/)\./.test(f));
  assert.deepEqual(bad, []);
});

// Why: allowed folders hold notes meant for this repo only (README files). The block
// rule must drop them, or internal notes go public whenever a folder gains one.
test('drops README notes inside allowed folders', () => {
  assert.equal(files.filter((f) => /(^|\/)README\.md$/.test(f)).length, 0);
  assert.ok(!files.includes('vendor/README.md'));
});

// Why: a page that loads a file the build left out is broken for every judge; the
// build must stop, not ship it.
test('refuses to build when a linked file is left out', () => {
  assert.throws(() => build(tmp(), ALLOW.filter((n) => n !== 'logic')), /not in the output: .*logic\//);
});

// Why: the CSP header is what keeps judges' API keys safe from outside scripts.
// Without _headers in the output, the live app would run with no CSP.
test('ships the security headers file', () => {
  assert.match(readFileSync(join(out, '_headers'), 'utf8'), /Content-Security-Policy: default-src 'self'; script-src 'self'/);
});
