// Run with: node --test
// Starts the real local helper (bridge.mjs) on a spare port, pointed at a fake SpeechDrop on this computer.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('.', import.meta.url));
const BIG = 26 * 1024 * 1024;
let fake, bridge, base;

// A fake SpeechDrop: room "room1" has two files (slot 1 was deleted) and one file over the 25 MB cap.
function startFake() {
  return new Promise((resolve) => {
    fake = http.createServer((req, res) => {
      if (req.url === '/room1/index') { res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify([{ name: 'A 1AC.txt', ctime: 1 }, null, { name: 'big.pdf', ctime: 2 }])); }
      if (req.url === '/media/room1/0/A%201AC.txt') return res.end('plan text');
      if (req.url === '/media/room1/2/big.pdf') return res.end(Buffer.alloc(BIG));
      if (req.url === '/hop/index') { res.statusCode = 302; res.setHeader('Location', 'http://127.0.0.1:1/secret'); return res.end(); }
      res.statusCode = 404; res.end('{}');
    }).listen(0, '127.0.0.1', () => resolve(fake.address().port));
  });
}
function startBridge(port, fakePort) {
  return new Promise((resolve, reject) => {
    bridge = spawn(process.execPath, ['bridge.mjs'], {
      cwd: dir,
      env: { ...process.env, PORT: String(port), SPEECHDROP_URL: `http://127.0.0.1:${fakePort}/`, SPEECHDROP_MEDIA: `http://127.0.0.1:${fakePort}/media/` },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    bridge.stdout.on('data', (d) => { if (/running at/.test(String(d))) resolve(); });
    bridge.on('exit', (c) => reject(new Error('bridge exited ' + c)));
    setTimeout(() => reject(new Error('bridge did not start')), 10000);
  });
}
const get = (path, headers = {}) => fetch(base + path, { headers });

test.before(async () => {
  const fakePort = await startFake();
  const port = 20000 + Math.floor(Math.random() * 20000);
  base = `http://127.0.0.1:${port}`;
  await startBridge(port, fakePort);
});
test.after(() => { if (bridge) bridge.kill(); if (fake) fake.close(); });

// Why: the helper fetches other sites for the page; without these guards any website a judge visits could use it to read SpeechDrop rooms or probe the network.
test('the SpeechDrop route refuses requests that are not from Tabula, and bad codes', async () => {
  assert.equal((await get('/api/speechdrop/room1')).status, 403, 'no X-Tabula header');
  assert.equal((await get('/api/speechdrop/room1', { 'X-Tabula': '1', Origin: 'https://evil.example' })).status, 403, 'foreign origin');
  assert.equal((await get('/api/speechdrop/bad..code', { 'X-Tabula': '1' })).status, 400);
  assert.equal((await get('/api/speechdrop/nope', { 'X-Tabula': '1' })).status, 404);
});

// Why: this is the whole import: the judge must see the room's files and get the exact file they ticked.
test('lists a room and downloads a file by its slot', async () => {
  const list = await (await get('/api/speechdrop/room1', { 'X-Tabula': '1' })).json();
  assert.deepEqual(list.files.map((f) => [f.i, f.name]), [[0, 'A 1AC.txt'], [2, 'big.pdf']]);
  const f = await get('/api/speechdrop/room1/file/0', { 'X-Tabula': '1' });
  assert.equal(f.status, 200);
  assert.equal(await f.text(), 'plan text');
  assert.equal((await get('/api/speechdrop/room1/file/1', { 'X-Tabula': '1' })).status, 404, 'a deleted slot');
});

// Why: a huge upload in a room must not fill the judge's browser storage or freeze the app.
test('refuses a file over 25 MB', async () => {
  assert.equal((await get('/api/speechdrop/room1/file/2', { 'X-Tabula': '1' })).status, 413);
});

// Why: the page loads its libraries from the helper; a missing file or a wrong type breaks Word import, the map or Claude, and the page must carry the same security rule as the hosted site.
test('serves the self-hosted libraries as scripts, and the page with its security rule', async () => {
  for (const f of ['vendor/mammoth-1.6.0.browser.min.js', 'vendor/mermaid-10.9.1.min.js', 'vendor/anthropic-sdk-0.137.0.bundle.mjs', 'tap.js', 'app.js']) {
    const r = await get('/' + f);
    assert.equal(r.status, 200, f);
    assert.match(r.headers.get('content-type'), /^text\/javascript/, f);
    await r.arrayBuffer();
  }
  const page = await get('/');
  assert.match(page.headers.get('content-security-policy') || '', /script-src 'self';/);
  await page.text();
});

// Why: a redirect from SpeechDrop could point the helper at the judge's own network; the helper must not follow it.
test('does not follow redirects', async () => {
  const r = await get('/api/speechdrop/hop', { 'X-Tabula': '1' });
  assert.equal(r.status, 502);
  assert.match((await r.json()).error, /could not reach SpeechDrop/);
});

// Why: a broken link pasted into the code box must get a plain "not a code" answer, not crash the helper's request.
test('a broken %-escape in the code is refused, not a crash', async () => {
  assert.equal((await get('/api/speechdrop/%E0%A4%A', { 'X-Tabula': '1' })).status, 400);
});
