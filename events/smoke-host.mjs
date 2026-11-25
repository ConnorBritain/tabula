// Smoke check for a deployed Speech Events host. Run it after a deploy (it uses the network):
//   node events/smoke-host.mjs https://events.tabulaspeech.dev
//   node events/smoke-host.mjs https://events.tabulaspeech.com
// It checks: the page answers 200 at / with the security headers; sw.js, sw-files.js and every file in the
// deployed sw-files.js answer 200 with no redirect and the right kind of content; and, for the production host,
// that forensics.tabulaspeech.com answers 301 to the same path and query on events.tabulaspeech.com.
// Staging is behind Cloudflare Access: set CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET (an Access service
// token) and they are sent as headers. Their values are never printed.
// Exit code 0 = all good, 1 = a problem (each one is printed).
// The pure helpers below are unit-tested in smoke-host.test.mjs; only main() touches the network.
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

export const PROD = 'https://events.tabulaspeech.com';
export const FORENSICS = 'https://forensics.tabulaspeech.com';

// Each security header the page must have, with a test for its value.
export const REQUIRED_HEADERS = {
  'content-security-policy': (v) => /\bdefault-src 'self'/.test(v) && /\bscript-src 'self'(;|$)/.test(v) && /\bframe-ancestors 'none'/.test(v) && !/unsafe-eval/.test(v),
  'strict-transport-security': (v) => /max-age=31536000/.test(v) && /includeSubDomains/i.test(v),
  'x-content-type-options': (v) => v.trim().toLowerCase() === 'nosniff',
  'referrer-policy': (v) => v.trim().toLowerCase() === 'no-referrer',
  'permissions-policy': (v) => /microphone=\(\)/.test(v),
};

/** Problems with a response's security headers. headers: a Headers object or a plain object (any key case). */
export function headerProblems(headers) {
  const get = (k) => (typeof headers.get === 'function' ? headers.get(k) : Object.entries(headers).find(([n]) => n.toLowerCase() === k)?.[1]);
  const out = [];
  for (const [name, ok] of Object.entries(REQUIRED_HEADERS)) {
    const v = get(name);
    if (v == null) out.push(`missing header ${name}`);
    else if (!ok(v)) out.push(`bad header ${name}: ${v}`);
  }
  return out;
}

/** True when a Cache-Control value makes the browser check with the host before it uses a copy. */
export const revalidates = (v) => /\bno-cache\b|\bno-store\b|\bmax-age=0\b/.test(v || '');

/** The file list in a sw-files.js source, read the way the worker reads it. */
export function swFileList(source) {
  const self = {};
  vm.runInNewContext(source, { self });
  if (!Array.isArray(self.TABULA_EVENTS_FILES)) throw new Error('sw-files.js: no TABULA_EVENTS_FILES list');
  return Array.from(self.TABULA_EVENTS_FILES, String); // a plain array of this realm, not the sandbox's
}

/** The URL of each sw-files entry on a host (entries are relative to /sw.js). */
export const fileUrls = (base, list) => list.map((p) => new URL(p, new URL('/sw.js', base)).href);

/** The content type a file must be served with: an HTML page for .html, anything but HTML for the rest. */
export function typeProblem(url, contentType) {
  const html = /^text\/html\b/i.test(contentType || '');
  return new URL(url).pathname.endsWith('.html') || new URL(url).pathname === '/'
    ? (html ? null : `${url}: expected text/html, got ${contentType}`)
    : (html ? `${url}: got an HTML page (a missing file?)` : null);
}

/** Problems with the forensics redirect: status must be 301 and Location the same path and query on PROD. */
export function redirectProblem(from, status, location) {
  const u = new URL(from);
  const want = PROD + u.pathname + u.search;
  if (status !== 301) return `${from}: expected 301, got ${status}`;
  if (location !== want) return `${from}: expected Location ${want}, got ${location}`;
  return null;
}

/** Whether to check the forensics redirect: only when smoke-testing the production host. */
export const checksForensics = (base) => new URL(base).origin === PROD;

/** Request headers for a check: the Access service token when the environment has one. */
export function requestHeaders(env = process.env) {
  return env.CF_ACCESS_CLIENT_ID && env.CF_ACCESS_CLIENT_SECRET
    ? { 'CF-Access-Client-Id': env.CF_ACCESS_CLIENT_ID, 'CF-Access-Client-Secret': env.CF_ACCESS_CLIENT_SECRET }
    : {};
}

async function main(base) {
  if (!base || !/^https:\/\//.test(base)) { console.log('Usage: node events/smoke-host.mjs https://<host>'); return 1; }
  const headers = requestHeaders();
  const get = (url) => fetch(url, { headers, redirect: 'manual' });
  const problems = [];
  const page = await get(new URL('/', base).href);
  if (page.status !== 200) problems.push(`/: expected 200, got ${page.status}${page.status === 302 ? ' (Access login: set the service token)' : ''}`);
  else {
    problems.push(...headerProblems(page.headers).map((p) => '/: ' + p));
    const t = typeProblem(new URL('/', base).href, page.headers.get('content-type')); if (t) problems.push(t);
  }
  for (const p of ['/', '/index.html', '/sw.js', '/sw-files.js']) {
    const r = p === '/' ? page : await get(new URL(p, base).href);
    if (r.status === 200 && !revalidates(r.headers.get('cache-control'))) problems.push(`${p}: Cache-Control must be no-cache, got ${r.headers.get('cache-control')}`);
  }
  const swFiles = await get(new URL('/sw-files.js', base).href);
  let list = [];
  if (swFiles.status !== 200) problems.push(`/sw-files.js: expected 200, got ${swFiles.status}`);
  else list = swFileList(await swFiles.text());
  for (const url of fileUrls(base, ['sw.js', ...list])) {
    const r = await get(url);
    if (r.status !== 200) problems.push(`${url}: expected 200, got ${r.status}`);
    else { const t = typeProblem(url, r.headers.get('content-type')); if (t) problems.push(t); }
    await r.arrayBuffer().catch(() => {});
  }
  if (checksForensics(base)) {
    const from = FORENSICS + '/smoke/check?from=smoke-host';
    const r = await fetch(from, { redirect: 'manual' });
    const p = redirectProblem(from, r.status, r.headers.get('location')); if (p) problems.push(p);
  } else console.log(`(forensics redirect not checked: it is checked only against ${PROD})`);
  for (const p of problems) console.log('PROBLEM ' + p);
  console.log(problems.length ? `\n${problems.length} problem(s) on ${base}.` : `All smoke checks pass on ${base} (${list.length} cached files).`);
  return problems.length ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exitCode = await main(process.argv[2]);
