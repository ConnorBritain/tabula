// Security headers for the hosted app (security audit 2026-11-24, ASVS 5.0 Level 1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const headers = readFileSync(new URL('./_headers', import.meta.url), 'utf8');

// Why: judges' API keys live on this origin. Without HSTS a first visit over plain HTTP can be downgraded and the page
// swapped for one that reads the keys (ASVS 3.4.1). The apex HSTS does not cover this subdomain.
test('the app sends HSTS for a year and refuses framing', () => {
  assert.match(headers, /^\s+Strict-Transport-Security: max-age=31536000$/m);
  assert.match(headers, /^\s+X-Frame-Options: DENY$/m);
  assert.match(headers, /frame-ancestors 'none'/);
});

// Why: the CSP is the main guard for the keys in this page. A new script source, eval or a wildcard would let any
// injected or third-party script read a judge's key.
test('the CSP allows scripts only from this site, with no eval and no wildcard', () => {
  const csp = headers.match(/Content-Security-Policy: ([^\n]+)/)[1];
  assert.match(csp, /script-src 'self';/);
  assert.ok(!/unsafe-eval|\*/.test(csp));
  assert.match(csp, /object-src 'none'/);
});
