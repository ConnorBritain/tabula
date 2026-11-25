// Why: if the judge card page leaks what a coach types (into the QR code, the URL, storage or the network), misses its required lines, or is not cached, a tournament prints a card that breaks the privacy promise or does not open offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { APP_URL, MAX_LEN, AFFILIATION_LINE, cardLine, appQrSvg } from './kit.js';
import { encodeQr, qrSvg } from './qr.js';
import { aboutHtml } from '../js/settings-screen.js';
import { pageFiles } from '../build-sw.mjs';
import { ALLOW } from '../../build-events.mjs';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const html = read('./index.html');
const js = read('./kit.js');
const css = read('./kit.css');

test('the QR code holds the app link and nothing else', () => {
  assert.equal(APP_URL, 'https://events.tabulaspeech.com/');
  assert.equal(appQrSvg(), qrSvg(encodeQr(APP_URL, { level: 'M' }), 'QR code for ' + APP_URL));
  assert.equal(appQrSvg.length, 0, 'appQrSvg takes no input, so typed text cannot reach the code');
  // The only encodeQr call in the page code is the one with APP_URL.
  assert.deepEqual([...js.matchAll(/encodeQr\(([^,)]*)/g)].map((m) => m[1]), ['APP_URL']);
});

test('typed text is never sent, saved or put in the URL', () => {
  for (const re of [/\bfetch\s*\(/, /XMLHttpRequest/, /sendBeacon/, /WebSocket/, /EventSource/, /localStorage/, /sessionStorage/, /indexedDB/, /document\.cookie/, /\blocation\b/, /history\.(push|replace)State/, /\bimport\s*\(/]) {
    assert.doesNotMatch(js, re, 'kit.js uses ' + re);
  }
  assert.doesNotMatch(read('./qr.js'), /\bfetch\s*\(|localStorage|\bimport\s*\(/);
  // No form: Enter in a field cannot submit the text into the address bar.
  assert.doesNotMatch(html, /<form\b/);
  for (const m of html.matchAll(/<input\b[^>]*>/g)) {
    if (/type="text"/.test(m[0])) {
      assert.doesNotMatch(m[0], /\bname=/, 'a text field has no name');
      assert.match(m[0], /autocomplete="off"/, 'the browser does not keep the typed text');
      assert.match(m[0], new RegExp('maxlength="' + MAX_LEN + '"'));
    }
  }
  // Typed text goes in with textContent, never as HTML.
  assert.doesNotMatch(js, /innerHTML\s*=(?!\s*svg;)/);
});

test('a typed line is trimmed to one short line', () => {
  assert.equal(cardLine('  Spring   Invitational\n2027 '), 'Spring Invitational 2027');
  assert.equal(cardLine(null), '');
  assert.equal(cardLine('   '), '');
  assert.equal(cardLine('x'.repeat(200)).length, MAX_LEN);
});

test('the card has the app name, the mark, the link, five steps and the two required lines', () => {
  assert.match(html, /<span class="kc-app">Tabula Speech Events<\/span>/);
  assert.match(html, /class="kc-mark"[^>]*><use href="#kit-mark"\/>/);
  assert.match(html, /<figcaption class="kc-url" aria-hidden="true">events\.tabulaspeech\.com<\/figcaption>/);
  const steps = /<ol class="kc-steps">([\s\S]*?)<\/ol>/.exec(html)[1].match(/<li>[^<]+<\/li>/g);
  assert.equal(steps.length, 5);
  assert.match(steps[0], /Scan/);
  assert.match(steps[1], /Open/);
  assert.match(steps[2], /^<li>Optional: add it to your home screen/);
  assert.match(steps[3], /paste .*codes/);
  assert.match(steps[4], /copy the ranks into the tournament's online ballot/);
  assert.match(html, /<p>Your rounds are stored on this device\.<\/p>/);
  assert.equal(AFFILIATION_LINE, 'Tabula is not affiliated with the NSDA.');
  assert.match(html, /<footer class="kc-foot">[\s\S]*<p data-kit="affiliation"><\/p>[\s\S]*<\/footer>/);
  assert.match(js, /\[data-kit="affiliation"\]'\)\.textContent = AFFILIATION_LINE;/);
  assert.doesNotMatch(html, /store nothing/i);
});

test('the mark is the app header mark, and the brand greens appear only in it', () => {
  const app = read('../index.html');
  const paths = (src) => [...src.matchAll(/<path fill="([^"]+)" fill-rule="evenodd" d="([^"]+)"\/>/g)].map((m) => m[1] + m[2]);
  const mark = /<symbol id="kit-mark" viewBox="13 2 956 785">([\s\S]*?)<\/symbol>/.exec(html)[1];
  assert.deepEqual(paths(mark), paths(/<svg class="brand-mark"[^>]*>([\s\S]*?)<\/svg>/.exec(app)[1]));
  const outside = html.replace(mark, '') + css + js;
  assert.doesNotMatch(outside, /#1e7a55|#5ec796/i, 'a brand green outside the mark');
});

test('the page runs no inline script, loads only files from this site and sets no inline style', () => {
  for (const m of html.matchAll(/<script\b([^>]*)>/g)) assert.match(m[1], /\bsrc="/, 'an inline script would break the security rule');
  for (const m of html.matchAll(/\b(?:src|href)="([^"]+)"/g)) assert.doesNotMatch(m[1], /^(?:[a-z]+:)?\/\//i, 'remote file: ' + m[1]);
  assert.doesNotMatch(html, /\sstyle="/);
  assert.doesNotMatch(css, /@import|url\(/, 'no remote or extra files from the CSS');
});

test('print is black on white, with no dark page background', () => {
  const print = /@media print \{([\s\S]*)\}\s*$/.exec(css)[1];
  assert.match(print, /html, body \{ background: #fff !important; color: #000 !important; \}/);
  assert.match(print, /\.kit-card, \.kit-card \* \{ color: #000 !important; \}/);
  assert.match(print, /\.kit-card \{ background: #fff;/);
  assert.match(print, /\.kit-noprint, \.skip \{ display: none !important; \}/);
  assert.match(appQrSvg(), /<rect width="\d+" height="\d+" fill="#fff"\/><path fill="#000"/);
});

test('one card and two cards each fit a US Letter and an A4 page', () => {
  const print = /@media print \{([\s\S]*)\}\s*$/.exec(css)[1];
  const inch = (re) => Number(re.exec(print)[1]);
  const margin = inch(/@page \{ margin: ([\d.]+)in; \}/);
  const width = inch(/\.kit-card \{[^}]*width: ([\d.]+)in;/);
  const twoHeight = inch(/\.two-up \.kit-card \{[^}]*height: ([\d.]+)in;/);
  const gap = inch(/\.kit-sheet \{ gap: ([\d.]+)in; \}/);
  for (const [w, h] of [[8.5, 11], [8.27, 11.69]]) {
    assert.ok(width <= w - 2 * margin, 'the card is narrower than the page');
    assert.ok(2 * twoHeight + gap <= h - 2 * margin, 'two cards and the gap fit the page height');
  }
});

test('Settings, About links to the card, and the page is in the offline cache and the build', async () => {
  assert.match(aboutHtml('r1'), /<a id="set-kit" href="kit\/index\.html">Print a judge card<\/a>/);
  const files = await pageFiles();
  for (const f of ['events/kit/index.html', 'events/kit/kit.js', 'events/kit/kit.css', 'events/kit/qr.js']) assert.ok(files.includes(f), f + ' is cached');
  for (const f of ['events/kit/index.html', 'events/kit/kit.css', 'events/kit/kit.js', 'events/kit/qr.js']) assert.ok(ALLOW.includes(f), 'the build ships ' + f);
  assert.ok(!ALLOW.some((n) => /^events\/kit\/.*\.test\./.test(n) || n === 'events/kit'), 'only the page files ship');
});

test('the card styles have no stripes: no one-sided border and no inset shadow', () => {
  assert.doesNotMatch(css, /border-(?:left|right|top|bottom|inline|block)[\w-]*\s*:/);
  assert.doesNotMatch(css, /box-shadow[^;]*\binset\b/);
  assert.doesNotMatch(css, /#1e7a55|#5ec796/i);
});
