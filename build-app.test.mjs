// Tests for the app builder (build-app.mjs). Run with: node --test
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
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

// Why: anyone checking which version is live reads version.json;
// without it, or with a wrong sha, a stale or wrong deploy goes unseen.
test('ships version.json with this commit and the build time', async () => {
  const { execFileSync } = await import('node:child_process');
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', cwd: new URL('.', import.meta.url) }).trim();
  const v = JSON.parse(readFileSync(join(out, 'version.json'), 'utf8'));
  assert.deepEqual(Object.keys(v), ['sha', 'builtAt', 'mode']);
  assert.match(v.sha, new RegExp(`^${head}(-dirty)?$`));
  assert.ok(!Number.isNaN(Date.parse(v.builtAt)));
});

// Why: if version.json were cached for long, it would name the old commit after a deploy, and a
// check would flag a good release or pass a bad one.
test('caches version.json for a short time only', () => {
  const rule = readFileSync(join(out, '_headers'), 'utf8').match(/^\/version\.json\n((?: {2}.+\n)+)/m);
  assert.ok(rule, 'has a /version.json rule');
  const age = Number(rule[1].match(/Cache-Control: public, max-age=(\d+)\n/)?.[1]);
  assert.ok(age > 0 && age <= 300, `max-age ${age} is at most 5 minutes`);
});

const SHA = 'a'.repeat(40);

// Why: if BUILD_SHA, BUILD_TIME and the mode were ignored, version.json would name the wrong commit or host.
test('BUILD_SHA, BUILD_TIME and BUILD_MODE set version.json', () => {
  const o = build(tmp(), ALLOW, { BUILD_SHA: SHA.toUpperCase(), BUILD_TIME: '2026-01-02T03:04:05Z', BUILD_MODE: 'staging' });
  assert.deepEqual(JSON.parse(readFileSync(join(o, 'version.json'), 'utf8')), { sha: SHA, builtAt: '2026-01-02T03:04:05Z', mode: 'staging' });
  assert.ok(MODES.includes(JSON.parse(readFileSync(join(out, 'version.json'), 'utf8')).mode), 'a normal build has a mode too');
});

// Why: a deploy that ships "-dirty", "unknown" or a short sha cannot be matched to one commit; it must warn, and fail when strict.
test('a sha that is not exactly one commit warns, and fails a strict build', () => {
  for (const sha of [SHA + '-dirty', 'unknown']) {
    const plain = versionInfo({ BUILD_MODE: 'prod' }, new Date(), { sha });
    assert.equal(plain.version.sha, sha, 'a normal build still writes it');
    assert.ok(plain.warnings.some((w) => w.includes('not exactly one commit')), sha);
  }
  for (const bad of ['abc123', SHA + '-dirty']) {
    const r = versionInfo({ BUILD_SHA: bad, BUILD_MODE: 'prod' }, new Date(), { sha: SHA });
    assert.equal(r.version.sha, SHA, 'an unusable BUILD_SHA is not used');
    assert.ok(r.warnings.some((w) => w.includes('not a 40-hex')));
  }
  assert.throws(() => build(tmp(), ALLOW, { BUILD_SHA: 'abc123', BUILD_MODE: 'prod' }, { strict: true }), /--strict: BUILD_SHA "abc123"/);
  assert.equal(versionInfo({ BUILD_SHA: SHA, BUILD_MODE: 'prod' }, new Date(), { strict: true }).warnings.length, 0, 'a clean deploy has no warnings');
});

// Why: a strict build with no mode, an unknown mode or a bad time would publish a misleading version.json.
test('strict needs a mode; unknown modes and bad times are not used', () => {
  assert.ok(versionInfo({ BUILD_SHA: SHA }, new Date(), { strict: true }).warnings.some((w) => w.startsWith('no mode')));
  assert.equal(versionInfo({ BUILD_SHA: SHA }).warnings.length, 0, 'a normal build may leave the mode unset');
  const m = versionInfo({ BUILD_SHA: SHA, BUILD_MODE: 'production' });
  assert.equal(m.version.mode, 'local'); assert.ok(m.warnings.length);
  const t = versionInfo({ BUILD_SHA: SHA, BUILD_TIME: 'yesterday' }, new Date('2026-01-01T00:00:00Z'));
  assert.equal(t.version.builtAt, '2026-01-01T00:00:00.000Z'); assert.ok(t.warnings.length);
});

// Why: a deploy that is not strict would ship "-dirty", "unknown" or the wrong mode with only a line in the log.
test('each deploy build in wrangler.app.jsonc is strict and names its mode', () => {
  const cfg = JSON.parse(readFileSync(new URL('./wrangler.app.jsonc', import.meta.url), 'utf8').replace(/^\s*\/\/.*$/gm, ''));
  assert.match(cfg.build.command, /&& node build-app\.mjs --strict --mode=prod$/);
  assert.match(cfg.env.staging.build.command, /&& node build-app\.mjs --strict --mode=staging$/);
});
