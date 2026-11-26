import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { routeSnapshot, snapshotScript } from './scripts/sync-learning-routes.mjs';
import { learningRedirects } from './scripts/learning-redirects.mjs';
import { learningExportPage } from './scripts/learning-export-page.mjs';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const require = createRequire(import.meta.url);
const artifact = { version: 1, articles: { 'policy-disadvantages': { path: '/learn/debate/policy/disadvantages/', title: 'Disadvantages', event: 'policy' } }, legacy: { disadvantages: '/learn/debate/policy/disadvantages/' }, tracks: { 'policy-track-judge': { path: '/learn/tracks/policy-track-judge/' } }, legacyProgress: { tracks: { judge: 'policy-track-judge' } } };

// Why: unfinished courses must not take over links from the working policy library.
test('route snapshots refuse cutover without explicit library release readiness', () => {
  assert.equal(routeSnapshot(artifact).enabled, false);
  assert.throws(() => routeSnapshot(artifact, { cutover: true }), /release-ready/);
  assert.equal(routeSnapshot({ ...artifact, releaseReady: true }, { cutover: true }).enabled, true);
});

// Why: a malformed artifact could send a judge to an unrelated host or an unsafe URL.
test('route snapshots reject paths outside the canonical learning hierarchy', () => {
  assert.throws(() => routeSnapshot({ ...artifact, legacy: { disadvantages: 'https://unrelated.example/' } }), /alias/);
  assert.throws(() => routeSnapshot({ ...artifact, articles: { bad: { path: '/learn/../signin/' } } }), /article/);
});

// Why: metadata must be pinned without executing article titles as script.
test('snapshot source quotes data and retains a reproducible source digest', () => {
  const snapshot = routeSnapshot(artifact);
  assert.match(snapshot.sourceDigest, /^[a-f0-9]{64}$/);
  assert.equal(routeSnapshot(artifact).sourceDigest, snapshot.sourceDigest);
  const module = { exports: {} };
  Function('module', snapshotScript(snapshot))(module);
  assert.deepEqual(module.exports, snapshot);
  assert.equal(snapshot.oldTracks.judge, '/learn/tracks/policy-track-judge/');
});

// Why: switching format must not teach an LD or PF judge to use a policy-specific ballot.
test('new public links follow the active format while legacy installations retain their local links', () => {
  const L = require('./logic/learning.js');
  const round = require('./logic.js');
  assert.equal(L.learningLink(round.formatOf({}).id, null, { enabled: true }).href, 'https://tabulaspeech.com/learn/debate/policy/');
  assert.equal(L.learningLink('pf', { slug: 'disadvantages', topic: 'Disadvantages' }, { enabled: false }).href, 'learn/disadvantages/');
  assert.equal(L.learningLink('policy-hs', { slug: 'disadvantages' }, { enabled: true }).href, 'https://tabulaspeech.com/learn/debate/policy/disadvantages/');
  assert.equal(L.learningLink('pf', { slug: 'disadvantages' }, { enabled: true }).href, 'https://tabulaspeech.com/learn/debate/public-forum/');
  assert.equal(L.learningLink('ld', null, { enabled: true, mode: 'staging' }).href, 'https://tabulaspeech.dev/learn/debate/lincoln-douglas/');
  assert.equal(L.learningLink('unknown', null, { enabled: true }).href, 'https://tabulaspeech.com/learn/debate/');
});

// Why: old shared links must reach the same lesson directly, without swallowing unknown URLs.
test('app compatibility redirects are exact, staged, and disabled until release', () => {
  assert.equal(learningRedirects(routeSnapshot(artifact)), '');
  const pinned = routeSnapshot({ ...artifact, releaseReady: true }, { cutover: true });
  const rules = learningRedirects(pinned, 'staging');
  assert.ok(rules.includes('/learn/disadvantages/ https://tabulaspeech.dev/learn/debate/policy/disadvantages/ 301\n'));
  assert.ok(rules.includes('/learn/tracks/judge https://tabulaspeech.dev/learn/tracks/policy-track-judge/ 301\n'));
  assert.doesNotMatch(rules, /\*|unknown|tabulaspeech\.com/);
  assert.throws(() => learningRedirects({ ...pinned, releaseReady: false }), /unfinished release/);
});

// Why: the local helper must preserve known shared links without redirecting arbitrary paths.
test('the helper resolves only exact known aliases after cutover', () => {
  const L = require('./logic/learning.js');
  assert.equal(L.legacyLearningPath('/learn/disadvantages/', { enabled: false }), null);
  assert.equal(L.legacyLearningPath('/learn/disadvantages/', { enabled: true }), '/learn/debate/policy/disadvantages/');
  assert.equal(L.legacyLearningPath('/learn/unknown/', { enabled: true }), null);
  assert.equal(L.legacyLearningPath('/learn/../signin/', { enabled: true }), null);
  assert.equal(L.legacyLearningPath('/learn/tracks/judge', { enabled: true }), '/learn/tracks/policy-track-judge/');
});

// Why: a different host cannot read old app-origin browser storage after the learning redirect.
test('the dedicated old-origin exporter reads only the learning key and filters unrelated values', () => {
  const keys = [], buttons = {}, downloads = [];
  const button = { hidden: true, addEventListener(name, fn) { buttons[name] = fn; } };
  const status = { textContent: '' };
  const doc = { querySelector(selector) { return selector.includes('data-export-policy') ? button : status; }, createElement() { return { click() {}, remove() {} }; }, body: { append() {} } };
  const legacy = { steps: { 'first-round-judge': { v: 1, done: '2026-11-20', unrelated: 'discard' }, unknown: { v: -1, done: 'bad' } }, tracks: {}, other: 'discard' };
  runInNewContext(readFileSync(new URL('./vendor/learning-export.js', import.meta.url), 'utf8'), { document: doc, localStorage: { getItem(key) { keys.push(key); return JSON.stringify(legacy); } }, Blob: class { constructor(parts) { downloads.push(parts.join('')); } }, URL: { createObjectURL() { return 'blob:fixture'; }, revokeObjectURL() {} }, setTimeout(fn) { fn(); } });
  buttons.click();
  assert.deepEqual(keys, ['tabula.learn.v1']);
  assert.deepEqual(JSON.parse(downloads[0]), { steps: { 'first-round-judge': { v: 1, done: '2026-11-20' } }, tracks: {} });
  assert.match(learningExportPage(), /src="\/learning-progress\/export\.js"/);
  assert.doesNotMatch(learningExportPage(), /src="\/learn\//);
  assert.match(learningExportPage('staging'), /href="https:\/\/tabulaspeech\.dev\/learn\/progress\/"/);
  assert.doesNotMatch(learningExportPage('staging'), /tabulaspeech\.com/);
});
