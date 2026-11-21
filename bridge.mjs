#!/usr/bin/env node
// Tabula local server + subscription helper.
//
//   node bridge.mjs            (then open http://localhost:8765)
//
// It serves the app, like the plain Python server, and adds two routes:
//   GET  /api/health  -> which signed-in apps are on this Mac: { claude: bool, codex: bool }
//   POST /api/ai      -> { engine: 'claude-cli' | 'codex-cli', system, prompt, schema? } -> { text }
// The AI work runs through the official Claude Code or Codex app, so it uses the subscription
// that app is signed in with. Nothing here stores keys. It only listens on this computer (127.0.0.1).

import http from 'node:http';
import { spawn, execFile } from 'node:child_process';
import { readFile, writeFile, mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8765);
const FILES = { '/': 'index.html', '/index.html': 'index.html', '/logic.js': 'logic.js', '/keys.js': 'keys.js', '/ui.js': 'ui.js', '/providers.js': 'providers.js', '/tour.js': 'tour.js', '/app.js': 'app.js', '/tap.js': 'tap.js', '/clipqueue.js': 'clipqueue.js', '/about': 'about.html', '/about.html': 'about.html' };
for (const f of ['tabula-mark-black.webp', 'tabula-mark-white.webp', 'tabula-wordmark-black.webp', 'tabula-wordmark-white.webp', 'tabula-mark-black.png', 'tabula-mark-white.png', 'tabula-icon-64.png', 'fonts/InterTight-latin.woff2', 'fonts/InterTight-Italic-latin.woff2', 'tokens.css', 'theme-boot.js', 'brand.js', 'caps-boot.js']) FILES['/assets/' + f] = 'assets/' + f;
// The page code and the pure logic are split by job into js/ and logic/ (the files index.html loads in order).
for (const f of ['core', 'caps', 'clock', 'recording', 'flow', 'docs', 'ai', 'settings', 'help', 'insights', 'decide', 'shell', 'palette', 'study', 'judging', 'account']) FILES['/js/' + f + '.js'] = 'js/' + f + '.js';
for (const f of ['round', 'audio', 'flow', 'files', 'rules', 'decide', 'prompts', 'shell', 'account', 'caps', 'hosted']) FILES['/logic/' + f + '.js'] = 'logic/' + f + '.js';
for (const f of ['mammoth-1.6.0.browser.min.js', 'mermaid-10.9.1.min.js', 'anthropic-sdk-0.137.0.bundle.mjs']) FILES['/vendor/' + f] = 'vendor/' + f;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.css': 'text/css; charset=utf-8', '.xml': 'application/xml; charset=utf-8' };
// The Debate Library (built by build-learn.mjs) is a folder of static pages, so it is served by path, not from FILES.
// Only files inside learn/ with a known type are served. A page URL without its trailing slash is redirected,
// because the pages use relative links that need it.
const LEARN = path.join(ROOT, 'learn');
const LEARN_TYPES = new Set(['.html', '.css', '.js', '.xml', '.png', '.webp']); // only what build-learn.mjs makes
const isLearnPath = (p) => p === '/learn' || p.startsWith('/learn/');
async function learnFile(pathname) {
  let rel;
  try { rel = decodeURIComponent(pathname.slice('/learn'.length)); } catch { return { status: 400 }; }
  if (rel === '') return { redirect: '/learn/' };
  const file = path.resolve(LEARN, '.' + (rel.endsWith('/') ? rel + 'index.html' : rel));
  if (!file.startsWith(LEARN + path.sep)) return { status: 404 };
  if (!path.extname(file)) return (await stat(file).catch(() => null))?.isDirectory() ? { redirect: pathname + '/' } : { status: 404 };
  if (!LEARN_TYPES.has(path.extname(file))) return { status: 404 };
  const type = TYPES[path.extname(file)];
  const body = await readFile(file).catch(() => null);
  return body ? { body, type } : { status: 404 };
}
const MAX_BODY = 30 * 1024 * 1024;
const L = createRequire(import.meta.url)('./logic.js');
// The same security rule (CSP) the hosted site sends (from _headers), so local testing blocks what the site blocks.
const CSP = await readFile(path.join(ROOT, '_headers'), 'utf8').then((t) => (t.match(/Content-Security-Policy: (.+)/) || [])[1] || '').catch(() => '');
// SPEECHDROP_URL / SPEECHDROP_MEDIA: test-only overrides (bridge.test.mjs points them at a fake SpeechDrop on this computer).
const SPEECHDROP = process.env.SPEECHDROP_URL || 'https://speechdrop.net/';
const MAX_DOC = 25 * 1024 * 1024;
let mediaUrl = process.env.SPEECHDROP_MEDIA || null; // where SpeechDrop keeps files; read once from a room page
const TIMEOUT_MS = 5 * 60 * 1000;

function which(cmd) {
  return new Promise((res) => execFile('/bin/sh', ['-lc', 'command -v ' + cmd], (err, out) => res(err ? null : out.trim() || null)));
}

// Runs a command with text on stdin; resolves with stdout. Kills it if it runs too long.
function run(cmd, args, input, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: opts.cwd || tmpdir(), env: process.env, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', err = '';
    const timer = setTimeout(() => { child.kill('SIGTERM'); reject(new Error('the AI app took longer than 5 minutes')); }, TIMEOUT_MS);
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else reject(new Error((err || out || 'exit ' + code).trim().split('\n').slice(-3).join(' ').slice(0, 400)));
    });
    child.stdin.end(input);
  });
}

async function askClaude(bin, { system, prompt, schema }) {
  // No tools, no MCP servers, no user/project settings or hooks: this call only writes text.
  const args = ['-p', '--output-format', 'json', '--system-prompt', system || '', '--tools', '', '--strict-mcp-config', '--setting-sources', ''];
  if (schema) args.push('--json-schema', JSON.stringify(schema));
  const raw = await run(bin, args, prompt);
  let j;
  try { j = JSON.parse(raw); } catch { return raw.trim(); }
  if (j.is_error) throw new Error(String(j.result || 'Claude Code reported an error'));
  if (schema && j.structured_output) return JSON.stringify(j.structured_output);
  return String(j.result ?? '');
}

async function askCodex(bin, { system, prompt, schema, model }) {
  const dir = await mkdtemp(path.join(tmpdir(), 'policy-judge-'));
  try {
    const outFile = path.join(dir, 'last.txt');
    const args = ['exec', '--skip-git-repo-check', '--sandbox', 'read-only', '--ephemeral', '-o', outFile];
    if (model && /^[A-Za-z0-9][\w.:-]{0,79}$/.test(model)) args.push('-m', model); // a model name never starts with a dash
    if (schema) { const sf = path.join(dir, 'schema.json'); await writeFile(sf, JSON.stringify(schema)); args.push('--output-schema', sf); }
    args.push('-');
    try {
      await run(bin, args, (system ? system + '\n\n' : '') + prompt, { cwd: dir });
    } catch (err) {
      const m = String(err.message).match(/The '([^']+)' model is not supported when using Codex with a ChatGPT account/);
      if (m) throw new Error('Your Codex settings use the model "' + m[1] + '", which a ChatGPT plan cannot use. In "AI + Keys", type a model your plan includes in the "Codex model" box, or run codex in Terminal and pick one with /model.');
      throw err;
    }
    return (await readFile(outFile, 'utf8')).trim();
  } finally { await rm(dir, { recursive: true, force: true }); }
}

// ---------- SpeechDrop ----------
// Every request: no redirects followed (a redirect could point this helper at your own network), a time limit,
// and errors turned into a plain message with a fitting status.
async function sdFetch(u, ms) {
  try { return { r: await fetch(u, { redirect: 'error', signal: AbortSignal.timeout(ms) }) }; }
  catch (err) { return err && err.name === 'TimeoutError' ? { error: 'SpeechDrop did not answer in time', status: 504 } : { error: 'could not reach SpeechDrop', status: 502 }; }
}
async function speechDropList(code) {
  const { r, error, status } = await sdFetch(SPEECHDROP + code + '/index', 15000);
  if (error) return { error, status };
  if (r.status === 404) return { error: 'no SpeechDrop room has that code', status: 404 };
  if (!r.ok) return { error: 'SpeechDrop answered ' + r.status, status: 502 };
  let index;
  try { index = await r.json(); } catch { return { error: 'SpeechDrop sent a list Tabula cannot read', status: 502 }; }
  return { body: { code, files: L.speechDropFiles(index) } };
}
// Where SpeechDrop keeps files: read from a room page (only a speechdrop.net address is trusted).
// A guess is used when the page does not say, but never kept, so the next download looks again.
async function findMediaUrl(code) {
  if (mediaUrl) return mediaUrl;
  const { r } = await sdFetch(SPEECHDROP + code, 15000);
  const page = r && r.ok ? await r.text().catch(() => '') : '';
  const m = page.match(/mediaUrl["']?\s*[:=]\s*["'](https:\/\/[^"']+\/)["']/);
  if (m && /^https:\/\/([a-z0-9-]+\.)*speechdrop\.net\//.test(m[1])) return (mediaUrl = m[1]);
  console.warn('SpeechDrop: no file address on the room page; trying the usual one');
  return 'https://media.speechdrop.net/uploads/';
}
async function speechDropFile(code, i) {
  // The list is read again because the file's name (part of its address) lives there.
  const list = await speechDropList(code);
  if (list.error) return list;
  const f = list.body.files.find((x) => x.i === i);
  if (!f) return { error: 'that file is no longer in the room', status: 404 };
  const base = await findMediaUrl(code);
  const { r, error, status } = await sdFetch(base + code + '/' + f.i + '/' + encodeURIComponent(f.name), 60000);
  if (error) return { error, status };
  if (r.status === 404) { if (base === mediaUrl) mediaUrl = process.env.SPEECHDROP_MEDIA || null; return { error: 'SpeechDrop could not find that file', status: 404 }; }
  if (!r.ok) return { error: 'SpeechDrop file answered ' + r.status, status: 502 };
  if (Number(r.headers.get('content-length')) > MAX_DOC) return { error: 'that file is over 25 MB', status: 413 };
  // Count the bytes as they arrive, so a file with no stated size still stops at the cap.
  const parts = []; let size = 0;
  try {
    for await (const chunk of r.body) {
      size += chunk.length;
      if (size > MAX_DOC) { r.body.cancel().catch(() => {}); return { error: 'that file is over 25 MB', status: 413 }; }
      parts.push(chunk);
    }
  } catch (err) { // the download broke off or ran out of time part way
    return err && err.name === 'TimeoutError' ? { error: 'SpeechDrop did not answer in time', status: 504 } : { error: 'the download from SpeechDrop broke off', status: 502 };
  }
  // A non-JSON type makes send() write the raw bytes.
  return { body: Buffer.concat(parts), type: 'application/octet-stream' };
}

function send(res, status, body, type = 'application/json') {
  const headers = { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  if (CSP && /^text\/html/.test(type)) headers['Content-Security-Policy'] = CSP;
  res.writeHead(status, headers);
  res.end(type === 'application/json' ? JSON.stringify(body) : body);
}

const bins = { claude: await which('claude'), codex: await which('codex') };

// Only this app, on this port, may use the API. Checking Host blocks DNS-rebinding tricks;
// checking Origin blocks other websites and other local dev servers.
const OK_HOSTS = new Set(['localhost:' + PORT, '127.0.0.1:' + PORT]);
const OK_ORIGINS = new Set(['http://localhost:' + PORT, 'http://127.0.0.1:' + PORT]);
let active = 0;
const MAX_ACTIVE = 2;

const server = http.createServer(async (req, res) => {
  if (!OK_HOSTS.has(String(req.headers.host || ''))) return send(res, 403, { error: 'forbidden host' });
  const origin = req.headers.origin;
  if (origin && !OK_ORIGINS.has(origin)) return send(res, 403, { error: 'forbidden origin' });
  const url = new URL(req.url, 'http://localhost');
  try {
    if (req.method === 'GET' && url.pathname === '/api/health') return send(res, 200, { claude: Boolean(bins.claude), codex: Boolean(bins.codex) });
    if (req.method === 'POST' && url.pathname === '/api/ai') {
      // A real page from this app always sends its Origin and JSON.
      if (!origin || !/^application\/json/.test(String(req.headers['content-type'] || ''))) return send(res, 403, { error: 'forbidden' });
      if (active >= MAX_ACTIVE) return send(res, 429, { error: 'busy with other AI requests; try again in a moment' });
      let size = 0; const chunks = [];
      for await (const c of req) { size += c.length; if (size > MAX_BODY) return send(res, 413, { error: 'request too large' }); chunks.push(c); }
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
      active++;
      res.on('close', () => { active--; });
      if (body.engine === 'claude-cli') {
        if (!bins.claude) return send(res, 400, { error: 'Claude Code is not installed on this Mac' });
        return send(res, 200, { text: await askClaude(bins.claude, body) });
      }
      if (body.engine === 'codex-cli') {
        if (!bins.codex) return send(res, 400, { error: 'Codex is not installed on this Mac' });
        return send(res, 200, { text: await askCodex(bins.codex, body) });
      }
      return send(res, 400, { error: 'unknown engine' });
    }
    // SpeechDrop: list a room's files, and fetch one. The page cannot ask speechdrop.net itself
    // (the browser blocks reading another site's answers), so this helper asks for it.
    const sd = url.pathname.match(/^\/api\/speechdrop\/([^/]+)(?:\/file\/(\d{1,4}))?$/);
    if (req.method === 'GET' && sd) {
      // Other websites cannot add this header without the browser first sending a preflight (OPTIONS), and this
      // helper sends no CORS headers and answers no OPTIONS request, so the browser refuses. Together with the Host
      // check above, that keeps other sites out. Adding CORS headers here would open this route: do not.
      if (req.headers['x-tabula'] !== '1') return send(res, 403, { error: 'forbidden' });
      let code = '';
      try { code = L.parseSpeechDropCode(decodeURIComponent(sd[1])); } catch { /* a broken %-escape */ }
      if (!code) return send(res, 400, { error: 'that is not a SpeechDrop room code' });
      const out = sd[2] == null ? await speechDropList(code) : await speechDropFile(code, Number(sd[2]));
      return out.error ? send(res, out.status, { error: out.error }) : send(res, 200, out.body, out.type);
    }
    if (req.method === 'GET' && isLearnPath(url.pathname)) {
      const r = await learnFile(url.pathname);
      if (r.redirect) { res.writeHead(301, { Location: r.redirect, 'Cache-Control': 'no-store' }); return res.end(); }
      return r.body ? send(res, 200, r.body, r.type) : send(res, r.status, { error: 'not found' });
    }
    if (req.method === 'GET' && FILES[url.pathname]) {
      const file = FILES[url.pathname];
      return send(res, 200, await readFile(path.join(ROOT, file)), TYPES[path.extname(file)]);
    }
    return send(res, 404, { error: 'not found' });
  } catch (err) {
    return send(res, 500, { error: String((err && err.message) || err) });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('Tabula running at http://localhost:' + PORT);
  console.log('Subscriptions found: Claude Code ' + (bins.claude ? 'yes' : 'no') + ', Codex ' + (bins.codex ? 'yes' : 'no'));
});
