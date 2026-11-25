// Tests for the Speech Events builder (build-events.mjs). Run with: node --test
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { ALLOW, OPTIONAL, build, listFiles, outPath, swFiles, pageRefs, manifestLinks, manifestIcons, missingRefs } from './build-events.mjs';
import { ALLOW as APP_ALLOW } from './build-app.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const tmp = () => join(mkdtempSync(join(tmpdir(), 'events-')), 'events');
let out;
let files;
let cached;
before(() => {
  out = build(tmp());
  files = listFiles(out);
  cached = swFiles(readFileSync(join(out, 'sw-files.js'), 'utf8')).map((p) => new URL(p, 'https://h.invalid/sw.js').pathname.slice(1));
});

// Why: the host serves the page at /; without index.html at the root of the output, judges opening the events site would get no page at all.
test('the page is index.html at the root of the output, with its core and assets beside it', () => {
  for (const f of ['index.html', 'sw.js', 'sw-files.js', '_headers', 'core/ui.js', 'assets/theme-boot.js', 'js/app.js']) assert.ok(files.includes(f), f);
  assert.equal(outPath('events/js/app.js'), 'js/app.js');
  assert.equal(outPath('core/ui.js'), 'core/ui.js');
});

// Why: the page links ../core/ and ../assets/; if any of those links did not land on a shipped file at the host root, the page would load without its styles or scripts and a judge could not score a round.
test('every file index.html links to is in the output', () => {
  const refs = pageRefs(readFileSync(join(out, 'index.html'), 'utf8'));
  assert.ok(refs.includes('core/policy.js') && refs.includes('assets/theme-boot.js'), refs.join(', '));
  assert.deepEqual(refs.filter((r) => !files.includes(r)), []);
});

// Why: the service worker installs a release only if every listed file loads; one missing file means the page never works offline, so a judge in a room with no signal loses the tool.
test('every file sw-files.js lists is in the output', () => {
  assert.ok(cached.length > 50);
  assert.deepEqual(cached.filter((f) => !files.includes(f)), []);
});

// Why: the host is public. Only what the page loads may ship; anything else (drafts of unpublished league rules, tests, notes, dev scripts) would go on the open web the moment someone added it to an allowed folder.
test('ships only the files the page loads, plus the worker files, the headers and the font licence', () => {
  const extras = new Set(['sw.js', 'sw-files.js', '_headers', 'assets/fonts/LICENSE.txt']);
  // The install manifest the page links, and every icon it names (some are read only at install, so not cached).
  const html = readFileSync(join(out, 'index.html'), 'utf8');
  for (const m of manifestLinks(html)) { extras.add(m); for (const i of manifestIcons(readFileSync(join(out, m), 'utf8'), m)) extras.add(i); }
  assert.deepEqual(files.filter((f) => !cached.includes(f) && !extras.has(f)), []);
});

// Why: test and dev files have no place on a live host and some hold sample student text; they must never ship.
test('ships no tests, READMEs, dotfiles, dev scripts, prototype or fixtures', () => {
  const bad = files.filter((f) => /\.test\.m?js$|(^|\/)README\.md$|(^|\/)\.|\.local\.|\.mjs$|^prototype\/|^fixtures\/|^profiles\/drafts\/|^core\/package\.json$/.test(f));
  assert.deepEqual(bad, []);
  assert.ok(!ALLOW.some((n) => /^events\/(prototype|fixtures)(\/|$)/.test(n)), 'ALLOW names the prototype or fixtures');
});

// Why: the events host must stay its own product; if debate app files shipped there, judges would see the wrong tool and the debate app's settings could clash with the events page on one host.
test('ships no debate-only app files', () => {
  // Names both apps use (_headers, index.html, core/, assets/, js/) are checked by source below, not by name.
  const shared = ['_headers', 'index.html', 'core', 'assets', 'js'];
  const debateOnly = APP_ALLOW.filter((n) => !shared.includes(n));
  assert.deepEqual(files.filter((f) => debateOnly.some((n) => f === n || f.startsWith(n + '/'))), []);
  // Every shipped js/ file is the events page's own (events/js/), never the debate app's root js/.
  assert.deepEqual(files.filter((f) => f.startsWith('js/') && !existsSync(join(ROOT, 'events', f))), []);
  assert.match(readFileSync(join(out, 'index.html'), 'utf8'), /<title>Tabula Speech Events<\/title>/);
  for (const f of ['about.html', 'app.js', 'logic.js', 'providers.js', 'tour.js', 'assets/tokens.css', 'assets/brand.js']) assert.ok(!files.includes(f), f);
});

// Why: a page that needs a file the build left out is broken for every judge; the build must stop, not ship it.
test('refuses to build when a needed file is left out', () => {
  assert.throws(() => build(tmp(), ALLOW.filter((n) => n !== 'assets/fonts')), /not in the output: .*assets\/fonts\//);
  assert.throws(() => build(tmp(), ALLOW.filter((n) => n !== 'events/congress')), /not in the output: .*congress\//);
});

// Why: the CSP header is what keeps judges' own API keys safe from outside scripts; without _headers at the output root, the live events page would run with no CSP.
test('ships the security headers file at the root', () => {
  const h = readFileSync(join(out, '_headers'), 'utf8');
  assert.match(h, /Content-Security-Policy: default-src 'self'; script-src 'self';/);
  assert.match(h, /Strict-Transport-Security: max-age=31536000; includeSubDomains/);
});

// Why: an installed app shows the icons its manifest names; if one were left out of the build, judges who add the page to their home screen would get a blank or broken icon.
test('reads the manifest the page links and the icons it names, relative to the manifest', () => {
  const html = '<link rel="stylesheet" href="app.css"><link rel="manifest" href="manifest.webmanifest"><link href="x.json" rel="manifest">';
  assert.deepEqual(manifestLinks(html), ['manifest.webmanifest', 'x.json']);
  const json = JSON.stringify({ icons: [{ src: 'icons/a.png' }, { src: '../b.png' }, { src: 'https://cdn.test/c.png' }, {}] });
  assert.deepEqual(manifestIcons(json, 'manifest.webmanifest'), ['icons/a.png', 'b.png']);
  assert.deepEqual(manifestIcons(json, 'm/manifest.json'), ['m/icons/a.png', 'b.png']);
  // Every icon the shipped manifest names (when the page has one) is in the output.
  for (const m of manifestLinks(readFileSync(join(out, 'index.html'), 'utf8'))) {
    assert.ok(files.includes(m), m);
    assert.deepEqual(manifestIcons(readFileSync(join(out, m), 'utf8'), m).filter((i) => !files.includes(i)), []);
  }
});

// Why: the manifest and icons are optional only while the page does not link them; once it does, a build without them must fail rather than ship a broken install.
test('optional paths are only the manifest and its icons', () => {
  assert.deepEqual([...OPTIONAL].sort(), ['events/icons', 'events/manifest.webmanifest']);
  for (const o of OPTIONAL) assert.ok(ALLOW.includes(o), o);
});

// Why: if the page links a manifest, or the manifest names an icon, that the output lacks, the build must stop; otherwise a judge's installed app would break.
test('the missing-file check reports a linked manifest or a manifest icon that is not in the output', () => {
  const dir = mkdtempSync(join(tmpdir(), 'events-refs-'));
  writeFileSync(join(dir, 'index.html'), '<link rel="manifest" href="manifest.webmanifest">');
  writeFileSync(join(dir, 'sw-files.js'), 'self.TABULA_EVENTS_FILES = ["index.html"];');
  assert.deepEqual(missingRefs(dir), ['manifest.webmanifest']);
  writeFileSync(join(dir, 'manifest.webmanifest'), JSON.stringify({ icons: [{ src: 'icons/a.png' }, { src: 'icons/b.png' }] }));
  mkdirSync(join(dir, 'icons'));
  writeFileSync(join(dir, 'icons', 'a.png'), '');
  assert.deepEqual(missingRefs(dir), ['icons/b.png']);
  writeFileSync(join(dir, 'icons', 'b.png'), '');
  assert.deepEqual(missingRefs(dir), []);
});
