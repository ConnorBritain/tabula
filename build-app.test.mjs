// Tests for the app builder (build-app.mjs). Run with: node --test
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { ALLOW, MODES, build, listFiles, versionInfo } from './build-app.mjs';

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

const SHA = 'a'.repeat(40);

// Why: wrong field names break the shared deploy checks, so nobody can tell which commit is live.
test('writes version.json with sha, builtAt and mode', () => {
  const v = JSON.parse(readFileSync(join(out, 'version.json'), 'utf8'));
  assert.deepEqual(Object.keys(v).sort(), ['builtAt', 'mode', 'sha']);
  assert.match(v.sha, /^([0-9a-f]{40}|unknown)$/);
  assert.ok(!Number.isNaN(Date.parse(v.builtAt)), 'builtAt is a date');
  assert.ok(MODES.includes(v.mode));
});

// Why: if BUILD_SHA, BUILD_TIME and BUILD_MODE were ignored, the live version.json would name the wrong commit or host.
test('BUILD_SHA, BUILD_TIME and BUILD_MODE set version.json', () => {
  const o = build(tmp(), ALLOW, { BUILD_SHA: SHA.toUpperCase(), BUILD_TIME: '2026-01-02T03:04:05Z', BUILD_MODE: 'staging' });
  assert.deepEqual(JSON.parse(readFileSync(join(o, 'version.json'), 'utf8')), { sha: SHA, builtAt: '2026-01-02T03:04:05Z', mode: 'staging' });
});

// Why: a short or "-dirty" sha would not match the commit the other hosts report, so a bad BUILD_SHA must not be shipped as is.
test('a BUILD_SHA that is not 40 hex is not used, and says so', () => {
  for (const bad of ['abc123', SHA + '-dirty', 'unknown']) {
    const { version, warnings } = versionInfo({ BUILD_SHA: bad });
    assert.notEqual(version.sha, bad);
    assert.match(version.sha, /^([0-9a-f]{40}|unknown)$/);
    assert.ok(warnings.some((w) => w.includes('not a 40-hex')), bad);
  }
});

// Why: a build with no git must still pass the normal gates (version.json says "unknown"), but a deploy must never ship "unknown" silently.
test('with no git: "unknown" and a warning; with --strict: a failed build', () => {
  const mod = JSON.stringify(new URL('./build-app.mjs', import.meta.url).href);
  const run = (code) => spawnSync(process.execPath, ['--input-type=module', '-e', `import { versionInfo, build, ALLOW } from ${mod}; ${code}`],
    { env: { PATH: '/nonexistent' }, encoding: 'utf8' });
  const plain = run('const r = versionInfo({}); console.log(JSON.stringify(r));');
  assert.equal(plain.status, 0, plain.stderr);
  const r = JSON.parse(plain.stdout);
  assert.equal(r.version.sha, 'unknown');
  assert.equal(r.version.mode, 'local');
  assert.ok(r.warnings.length > 0);
  const strict = run(`build(${JSON.stringify(tmp())}, ALLOW, {}, { strict: true });`);
  assert.notEqual(strict.status, 0);
  assert.match(strict.stderr, /--strict: no commit id/);
  const ok = run(`build(${JSON.stringify(tmp())}, ALLOW, { BUILD_SHA: '${SHA}', BUILD_MODE: 'prod' }, { strict: true }); console.log('built');`);
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /built/);
});

// Why: an unknown mode would make the shared checks misread which host they are looking at.
test('an unknown BUILD_MODE falls back to "local" with a warning', () => {
  const { version, warnings } = versionInfo({ BUILD_SHA: SHA, BUILD_MODE: 'production' });
  assert.equal(version.mode, 'local');
  assert.ok(warnings.some((w) => w.includes('BUILD_MODE')));
});

// Why: a cached version.json would show the old commit and make a failed deploy look fine.
test('version.json is served uncached', () => {
  assert.match(readFileSync(join(out, '_headers'), 'utf8'), /\/version\.json\n\s+Cache-Control: no-store/);
});
