// Tests for the deployed-host smoke check (events/smoke-host.mjs) and the events security headers (events/_headers).
// Only the pure helpers run here; nothing touches the network. Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  headerProblems, revalidates, swFileList, fileUrls, typeProblem, redirectProblem, checksForensics, requestHeaders, PROD,
} from './smoke-host.mjs';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

/** The headers _headers gives one path: the lines indented under that exact path line. */
function headersFor(path, text = read('_headers')) {
  const out = {};
  let on = false;
  for (const line of text.split('\n')) {
    if (/^\S/.test(line) && !line.startsWith('#')) on = line.trim() === path;
    else if (on && /^\s+\S/.test(line)) { const i = line.indexOf(':'); out[line.slice(0, i).trim()] = line.slice(i + 1).trim(); }
  }
  return out;
}

// Why: the smoke check and the headers file must agree; if _headers drifted from what the check wants, the deployer
// would get a red smoke run on a good deploy, or (worse) a weak header would ship unnoticed.
test('the shipped _headers passes the smoke check header rules', () => {
  assert.deepEqual(headerProblems(headersFor('/*')), []);
});

// Why: the page talks to the AI providers in core/ai.js with the judge's own key. A provider missing from connect-src
// breaks that judge's AI help; an extra host would let the page send data somewhere no judge chose.
test('connect-src allows this site plus exactly the AI hosts core/ai.js calls', () => {
  const csp = headersFor('/*')['Content-Security-Policy'];
  const allowed = csp.match(/connect-src ([^;]+)/)[1].trim().split(/\s+/);
  const ai = read('../core/ai.js');
  // Every https host in core/ai.js except the keyUrl lines (links a judge opens to make a key, not calls).
  const lines = ai.split('\n').filter((l) => !/keyUrl/.test(l)).join('\n');
  const called = [...new Set([...lines.matchAll(/https:\/\/[^/'"`?]+/g)].map((m) => m[0]))].sort();
  assert.ok(called.length >= 5, called.join(' '));
  assert.deepEqual(allowed.filter((h) => h !== "'self'").sort(), called);
  assert.ok(allowed.includes("'self'"));
});

// Why: the events page records no audio; a microphone grant would let any injected script listen in a judging room.
test('the headers turn the microphone off and block framing', () => {
  const h = headersFor('/*');
  assert.match(h['Permissions-Policy'], /microphone=\(\)/);
  assert.match(h['Content-Security-Policy'], /frame-ancestors 'none'/);
});

// Why: if the page or the worker files were cached by the browser, a judge would keep an old release after a fix.
test('the page, sw.js and sw-files.js are no-cache', () => {
  for (const p of ['/', '/index.html', '/sw.js', '/sw-files.js']) assert.equal(headersFor(p)['Cache-Control'], 'no-cache', p);
  assert.ok(revalidates('no-cache') && revalidates('public, max-age=0, must-revalidate'));
  assert.ok(!revalidates('public, max-age=14400') && !revalidates(null));
});

// Why: a smoke check that passed a host missing a header would let a deploy without the CSP look healthy.
test('headerProblems names each missing or weak header', () => {
  assert.deepEqual(headerProblems(new Headers()).length, 5);
  const weak = headerProblems({
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-eval'; frame-ancestors 'none'",
    'Strict-Transport-Security': 'max-age=300', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'microphone=(self)',
  });
  assert.equal(weak.length, 3, weak.join('\n'));
});

// Why: the smoke check must fetch the same URLs the worker caches, or it could pass while the worker install fails.
test('the sw-files list resolves to URLs at the host root', () => {
  const list = swFileList(read('sw-files.js'));
  assert.ok(list.includes('index.html') && list.includes('../core/ui.js'));
  const urls = fileUrls('https://events.tabulaspeech.dev', ['index.html', '../core/ui.js', 'js/app.js']);
  assert.deepEqual(urls, ['https://events.tabulaspeech.dev/index.html', 'https://events.tabulaspeech.dev/core/ui.js', 'https://events.tabulaspeech.dev/js/app.js']);
});

// Why: with the single-page fallback a missing file comes back as the page (200, HTML); the check must call that out.
test('typeProblem flags an HTML reply for a non-HTML file', () => {
  assert.equal(typeProblem('https://h.test/core/ui.js', 'text/javascript'), null);
  assert.match(typeProblem('https://h.test/core/ui.js', 'text/html; charset=utf-8'), /HTML page/);
  assert.equal(typeProblem('https://h.test/', 'text/html'), null);
  assert.match(typeProblem('https://h.test/index.html', 'application/octet-stream'), /expected text\/html/);
});

// Why: old links to the forensics host must land on the same screen; a redirect that dropped the path or query, or
// was temporary, would send judges to the wrong place or keep the old host alive in search.
test('redirectProblem wants a 301 to the same path and query on the events host', () => {
  const from = 'https://forensics.tabulaspeech.com/a/b?x=1';
  assert.equal(redirectProblem(from, 301, PROD + '/a/b?x=1'), null);
  assert.match(redirectProblem(from, 302, PROD + '/a/b?x=1'), /expected 301/);
  assert.match(redirectProblem(from, 301, PROD + '/'), /expected Location/);
  assert.ok(checksForensics(PROD + '/') && !checksForensics('https://events.tabulaspeech.dev'));
});

// Why: staging is behind Access; the token goes in headers only when both parts are set, and never otherwise.
test('requestHeaders sends the Access token only when both parts are set', () => {
  assert.deepEqual(requestHeaders({}), {});
  assert.deepEqual(requestHeaders({ CF_ACCESS_CLIENT_ID: 'a' }), {});
  assert.deepEqual(requestHeaders({ CF_ACCESS_CLIENT_ID: 'a', CF_ACCESS_CLIENT_SECRET: 'b' }), { 'CF-Access-Client-Id': 'a', 'CF-Access-Client-Secret': 'b' });
});
