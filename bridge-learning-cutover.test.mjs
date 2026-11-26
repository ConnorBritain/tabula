import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const routes = require('./logic/learning-routes.js');
const dir = fileURLToPath(new URL('.', import.meta.url));
let bridge, base;

async function sparePort() {
  const server = http.createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function stopBridge() {
  if (!bridge?.pid || bridge.exitCode !== null || bridge.signalCode !== null) return;
  const child = bridge;
  const exited = once(child, 'exit');
  child.kill();
  const timer = setTimeout(() => child.kill('SIGKILL'), 2000);
  try { await exited; } finally { clearTimeout(timer); }
}

async function startBridge(port) {
  bridge = spawn(process.execPath, ['bridge.mjs'], {
    cwd: dir, env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    let output = '', portBusy = false;
    const timer = setTimeout(() => finish(new Error('bridge did not start within 10 seconds')), 10000);
    const finish = (error) => {
      clearTimeout(timer);
      bridge.stdout.off('data', onOutput);
      bridge.stderr.off('data', onErrorOutput);
      bridge.off('error', onError);
      bridge.off('exit', onExit);
      error ? reject(error) : resolve();
    };
    const onOutput = (data) => {
      output += String(data);
      if (output.includes('Tabula running at http://localhost:' + port)) finish();
    };
    const onErrorOutput = (data) => { if (String(data).includes('EADDRINUSE')) portBusy = true; };
    const onError = (error) => finish(error);
    const onExit = (code, signal) => finish(Object.assign(new Error(`bridge exited before startup (${code ?? signal})`), { portBusy }));
    bridge.stdout.on('data', onOutput);
    bridge.stderr.on('data', onErrorOutput);
    bridge.once('error', onError);
    bridge.once('exit', onExit);
  });
}

test.before(async () => {
  assert.equal(routes.enabled, true, 'these checks require the shipped learning cutover');
  assert.equal(routes.releaseReady, true, 'the public library must be ready before redirecting readers');
  for (let attempt = 0; attempt < 3; attempt++) {
    const port = await sparePort();
    try {
      await startBridge(port);
      base = `http://127.0.0.1:${port}`;
      return;
    } catch (error) {
      await stopBridge();
      if (!error.portBusy || attempt === 2) throw error;
    }
  }
});
test.after(stopBridge);

const get = (path) => fetch(base + path, { redirect: 'manual', signal: AbortSignal.timeout(5000) });

async function checkAliases(aliases) {
  for (const [from, target] of aliases) {
    for (const slash of ['', '/']) {
      for (const query of ['', '?from=old%20library&step=1']) {
        const response = await get(from + slash + query);
        assert.equal(response.status, 301, from + slash + query);
        assert.equal(response.headers.get('location'), 'https://tabulaspeech.com' + target + query);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        await response.arrayBuffer();
      }
    }
  }
}

// Why: old article links must reach their matching public lessons without dropping a reader's query or contacting that host.
test('the real helper redirects every pinned article alias with either slash form and query', async () => {
  assert.equal(routes.legacy.disadvantages, '/learn/debate/policy/disadvantages/');
  assert.equal(routes.legacy['ballot-and-rfd'], '/learn/debate/policy/ballot-and-rfd/');
  await checkAliases(Object.entries(routes.legacy).map(([slug, target]) => [`/learn/${slug}`, target]));
});

// Why: shared course links and library roots must keep their intended destination when readers open an old bookmark.
test('the real helper redirects course aliases and roots with either slash form and query', async () => {
  assert.deepEqual(routes.oldTracks, {
    judge: '/learn/tracks/policy-track-judge/', novice: '/learn/tracks/policy-track-novice/',
    kritik: '/learn/tracks/policy-track-kritik/', theory: '/learn/tracks/policy-track-theory/',
    judging: '/learn/tracks/policy-track-judging/',
  });
  await checkAliases([
    ['/learn', '/learn/'], ['/learn/tracks', '/learn/tracks/'],
    ...Object.entries(routes.oldTracks).map(([id, target]) => [`/learn/tracks/${id}`, target]),
  ]);
});

// Why: an unknown lesson must show a missing page instead of silently sending the reader to unrelated material.
test('unknown article and course paths stay 404 after cutover', async () => {
  for (const path of ['/learn/no-such-lesson', '/learn/tracks/no-such-course', '/learn/disadvantages/extra', '/learn/learn.css']) {
    for (const suffix of ['', '/', '?from=bookmark']) {
      const response = await get(path + suffix);
      assert.equal(response.status, 404, path + suffix);
      assert.equal(response.headers.get('location'), null);
      await response.arrayBuffer();
    }
  }
});

// Why: a crafted learning URL must not expose helper source or files outside the public learning routes.
test('raw and encoded traversal paths stay 404 after cutover', async () => {
  for (const path of ['/learn/../bridge.mjs', '/learn/%2e%2e/bridge.mjs', '/learn/..%2fbridge.mjs']) {
    const response = await new Promise((resolve, reject) => {
      const request = http.get({ hostname: '127.0.0.1', port: new URL(base).port, path }, (res) => {
        res.resume();
        res.on('end', () => resolve({ status: res.statusCode, location: res.headers.location }));
        res.on('error', reject);
      });
      request.setTimeout(5000, () => request.destroy(new Error('raw request timed out')));
      request.on('error', reject);
    });
    assert.equal(response.status, 404, path);
    assert.equal(response.location, undefined);
  }
});

// Why: old-origin progress must remain exportable after learning pages move to a different host.
test('the progress exporter remains a local 200 page and script outside learn', async () => {
  const bare = await get('/learning-progress');
  assert.equal(bare.status, 301);
  assert.equal(bare.headers.get('location'), '/learning-progress/');
  await bare.arrayBuffer();
  const page = await get('/learning-progress/');
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type'), /^text\/html/);
  const html = await page.text();
  assert.match(html, /<h1>Save your old learning progress<\/h1>/);
  assert.match(html, /src="\/learning-progress\/export\.js"/);
  assert.match(html, /href="https:\/\/tabulaspeech\.com\/learn\/progress\/"/);
  const script = await get('/learning-progress/export.js');
  assert.equal(script.status, 200);
  assert.match(script.headers.get('content-type'), /^text\/javascript/);
  assert.match(await script.text(), /tabula\.learn\.v1/);
});
