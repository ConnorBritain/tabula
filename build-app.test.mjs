// Tests for the app builder (build-app.mjs). Run with: node --test
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { ALLOW, build, listFiles, versionInfo } from './build-app.mjs';

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

// Why: wrong field names break the shared deploy checks, so nobody can tell which commit is live.
test('writes version.json with sha and builtAt', () => {
  const v = JSON.parse(readFileSync(join(out, 'version.json'), 'utf8'));
  assert.deepEqual(Object.keys(v).sort(), ['builtAt', 'sha']);
  assert.ok(v.sha.length > 0);
  assert.ok(!Number.isNaN(Date.parse(v.builtAt)), 'builtAt is a date');
});

// Why: if BUILD_SHA and BUILD_TIME were ignored, the live version.json would name the wrong commit.
test('BUILD_SHA and BUILD_TIME override version.json', () => {
  const o = build(tmp(), ALLOW, { BUILD_SHA: 'abc123', BUILD_TIME: '2026-01-02T03:04:05Z' });
  assert.deepEqual(JSON.parse(readFileSync(join(o, 'version.json'), 'utf8')), { sha: 'abc123', builtAt: '2026-01-02T03:04:05Z' });
});

// Why: a build with no git must still ship (version.json says "dev"), or the deploy fails.
test('version.json falls back to git, then to "dev", and never throws', () => {
  const v = versionInfo({}, new Date('2026-01-01T00:00:00Z'));
  assert.equal(v.builtAt, '2026-01-01T00:00:00.000Z');
  assert.match(v.sha, /^([0-9a-f]{40}|dev)$/);
  const noGit = spawnSync(process.execPath, ['--input-type=module', '-e',
    `import { versionInfo } from ${JSON.stringify(new URL('./build-app.mjs', import.meta.url).href)}; console.log(versionInfo({}).sha);`],
    { env: { PATH: '/nonexistent' }, encoding: 'utf8' });
  assert.equal(noGit.status, 0, noGit.stderr);
  assert.equal(noGit.stdout.trim(), 'dev');
});

// Why: a cached version.json would show the old commit and make a failed deploy look fine.
test('version.json is served uncached', () => {
  assert.match(readFileSync(join(out, '_headers'), 'utf8'), /\/version\.json\n\s+Cache-Control: no-store/);
});
