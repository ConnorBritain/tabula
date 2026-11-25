// Tests for core/install-hint.js: which "add to Home Screen" steps a judge sees on their browser.
// Run with: node --test
//
// Why: a missing install hint can cost a judge saved ballots, and steps the browser does not have can make the judge give up.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installHint, isStandalone } from './install-hint.js';

const UA = {
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  ipadSafari: 'Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
  macSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/123.0.6312.52 Mobile/15E148 Safari/604.1',
  iphoneFirefox: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/124.0 Mobile/15E148 Safari/605.1.15',
  iphoneEdge: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 EdgiOS/123.0.2420.56 Mobile/15E148 Safari/605.1.15',
  iphoneFacebook: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/455.0.0.36.111]',
  iphoneInstagram: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 325.0.0.35.91',
  iphoneGoogleApp: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/311.0.622735097 Mobile/15E148 Safari/604.1',
  iphoneWebView: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  androidChrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.6312.99 Mobile Safari/537.36',
  androidWebView: 'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/123.0.6312.99 Mobile Safari/537.36',
  androidSamsung: 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/117.0.0.0 Mobile Safari/537.36',
  androidFirefox: 'Mozilla/5.0 (Android 14; Mobile; rv:124.0) Gecko/124.0 Firefox/124.0',
  winChrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  winEdge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 Edg/123.0.2420.65',
  winFirefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
  chromebook: 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
};

// [name, input, expected kind or null]
const TABLE = [
  ['iPhone Safari', { ua: UA.iphoneSafari, platform: 'iPhone', maxTouchPoints: 5 }, 'ios-safari'],
  ['iPad Safari (mobile UA)', { ua: UA.ipadSafari, platform: 'iPad', maxTouchPoints: 5 }, 'ios-safari'],
  ['iPad Safari (desktop UA, MacIntel + touch)', { ua: UA.macSafari, platform: 'MacIntel', maxTouchPoints: 5 }, 'ios-safari'],
  ['Mac Safari (no touch)', { ua: UA.macSafari, platform: 'MacIntel', maxTouchPoints: 0 }, 'desktop'],
  ['iPhone Chrome', { ua: UA.iphoneChrome, platform: 'iPhone', maxTouchPoints: 5 }, null],
  ['iPhone Firefox', { ua: UA.iphoneFirefox, platform: 'iPhone', maxTouchPoints: 5 }, null],
  ['iPhone Edge', { ua: UA.iphoneEdge, platform: 'iPhone', maxTouchPoints: 5 }, null],
  ['iPhone Facebook app', { ua: UA.iphoneFacebook, platform: 'iPhone', maxTouchPoints: 5 }, null],
  ['iPhone Instagram app', { ua: UA.iphoneInstagram, platform: 'iPhone', maxTouchPoints: 5 }, null],
  ['iPhone Google app', { ua: UA.iphoneGoogleApp, platform: 'iPhone', maxTouchPoints: 5 }, null],
  ['iPhone web view', { ua: UA.iphoneWebView, platform: 'iPhone', maxTouchPoints: 5 }, null],
  ['iPad Chrome (desktop UA with CriOS)', { ua: UA.macSafari.replace('Version/', 'CriOS/123.0 Version/'), platform: 'MacIntel', maxTouchPoints: 5 }, null],
  ['Android Chrome', { ua: UA.androidChrome, platform: 'Linux armv81', maxTouchPoints: 5 }, 'android-chrome'],
  ['Android web view', { ua: UA.androidWebView, platform: 'Linux armv81', maxTouchPoints: 5 }, null],
  ['Android Samsung Internet', { ua: UA.androidSamsung, platform: 'Linux armv81', maxTouchPoints: 5 }, null],
  ['Android Firefox', { ua: UA.androidFirefox, platform: 'Linux armv81', maxTouchPoints: 5 }, null],
  ['Windows Chrome', { ua: UA.winChrome, platform: 'Win32', maxTouchPoints: 0 }, 'desktop'],
  ['Windows Edge', { ua: UA.winEdge, platform: 'Win32', maxTouchPoints: 0 }, 'desktop'],
  ['Windows Firefox', { ua: UA.winFirefox, platform: 'Win32', maxTouchPoints: 0 }, null],
  ['Chromebook', { ua: UA.chromebook, platform: 'Linux x86_64', maxTouchPoints: 10 }, 'desktop'],
  ['no user agent', { ua: '' }, null],
];

for (const [name, input, kind] of TABLE) {
  // Why: wrong install steps can make a judge give up and leave saved ballots at risk of deletion.
  test(`installHint: ${name} -> ${kind}`, () => {
    const h = installHint(input);
    assert.equal(h ? h.kind : null, kind);
    if (h) {
      assert.ok(Array.isArray(h.steps) && h.steps.length >= 2 && h.steps.length <= 3, 'two or three short steps');
      assert.ok(h.steps.every((s) => typeof s === 'string' && s.length > 0 && s.length <= 100), 'each step is short');
      assert.equal(typeof h.why, 'string');
    }
  });
}

// Why: an app already on the Home Screen keeps its data; telling the judge to add it again is noise they learn to ignore.
test('installHint gives nothing when the app is already standalone, on any browser', () => {
  for (const [, input] of TABLE) assert.equal(installHint({ ...input, standalone: true }), null);
  assert.equal(installHint(null), null);
  assert.equal(installHint(), null);
});

// Why: the iPhone sheet is the judge's only warning about the 7-day rule; the steps must name the real Safari buttons.
test('the iPhone Safari hint names the Share button, Add to Home Screen and Add, and the 7-day reason', () => {
  const h = installHint({ ua: UA.iphoneSafari, platform: 'iPhone', maxTouchPoints: 5 });
  assert.equal(h.steps.length, 3);
  assert.match(h.steps[0], /Share/);
  assert.match(h.steps[1], /"Add to Home Screen"/);
  assert.match(h.steps[2], /"Add"/);
  assert.match(h.why, /about 7 days/);
  assert.match(h.why, /Home Screen keeps it/);
});

// Why: if standalone is misread, the sheet shows inside the Home Screen app (or never shows in Safari).
test('isStandalone reads display-mode and navigator.standalone, and never throws', () => {
  const win = (mm, standalone) => ({ matchMedia: () => ({ matches: mm }), navigator: { standalone } });
  assert.equal(isStandalone(win(true, undefined)), true);
  assert.equal(isStandalone(win(false, true)), true, 'iOS Home Screen app');
  assert.equal(isStandalone(win(false, false)), false);
  assert.equal(isStandalone(win(false, 'yes')), false, 'only a real true counts');
  assert.equal(isStandalone({ navigator: {} }), false, 'no matchMedia');
  assert.equal(isStandalone({ matchMedia: () => { throw new Error('x'); } }), false);
  assert.equal(isStandalone(null), false);
});
