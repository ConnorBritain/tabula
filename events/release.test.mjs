// Tests for the release id, the backup's release field and the "Send feedback" link (events/js/settings.js and
// events/js/settings-screen.js). Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { releaseId, browserFamily, feedbackMailto, makeBackup, readBackup, FEEDBACK_TO, FEEDBACK_SUBJECT, KNOWN_ISSUES_URL } from './js/settings.js';
import { aboutHtml, lookupRelease, settingsHtml } from './js/settings-screen.js';
import { ROOMS_KEY, SETTINGS_KEY, CARDS_KEY } from './js/store.js';

const SHA = '1a2b3c4d5e6f7a8b9c0d1a2b3c4d5e6f7a8b9c0d';
const VERSION = { sha: SHA, builtAt: '2026-11-25T10:20:30.000Z' };
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

// A device that has judged a few rounds: student names, codes, comments, a room and an AI key.
const SAVED = {
  [ROOMS_KEY]: JSON.stringify([{ id: 'r1', room: 'Room 214', round: 'Round 2', speakers: [{ code: 'A12', name: 'Jordan Rivera' }], comments: 'Strong hook, slow middle.' }]),
  [CARDS_KEY]: JSON.stringify([{ id: 'c1', room: 'Library B', entries: ['Priya Shah'] }]),
  [SETTINGS_KEY]: JSON.stringify({ theme: 'dark', recentEvents: ['oi', 'ext'] }),
};
const PRIVATE = ['Room 214', 'Round 2', 'A12', 'Jordan', 'Rivera', 'Strong hook', 'Library B', 'Priya', 'Shah', 'dark', 'r1', 'c1'];

const bodyOf = (href) => decodeURIComponent(new URL(href).searchParams.get('body'));

// Why: the release id is what a judge reads out or emails when something breaks; if it were wrong or blank, the team could not tell which version the judge had.
test('the release id is the short commit and the build day, or the offline release, or "unknown"', () => {
  assert.equal(releaseId({ version: VERSION }), '1a2b3c4 2026-11-25');
  assert.equal(releaseId({ version: { sha: SHA + '-dirty', builtAt: VERSION.builtAt } }), '1a2b3c4+ 2026-11-25');
  assert.equal(releaseId({ version: { sha: 'unknown', builtAt: VERSION.builtAt } }), 'build 2026-11-25');
  // Offline (no version.json): the service worker's cache name stands in.
  assert.equal(releaseId({ version: null, cacheName: 'tabula-events-387a7eeffda54dda' }), 'offline 387a7ee');
  assert.equal(releaseId({ version: VERSION, cacheName: 'tabula-events-387a7eeffda54dda' }), '1a2b3c4 2026-11-25');
  // Anything odd reads as unknown, never as text from the file.
  assert.equal(releaseId({ version: { sha: '<b>x</b>', builtAt: 'soon' } }), 'unknown');
  assert.equal(releaseId({ cacheName: 'other-cache' }), 'unknown');
  assert.equal(releaseId(null), 'unknown');
});

// Why: Settings must never hang on the release id; offline (a judge in a room with no signal) it must still show the offline release, and a broken file must not break the screen.
test('the lookup reads version.json past the cache, and falls back to the worker cache name', async () => {
  const caches = { keys: async () => ['other', 'tabula-events-387a7eeffda54dda'] };
  let asked = null;
  const fetchOk = async (url, init) => { asked = { url, init }; return { ok: true, json: async () => VERSION }; };
  assert.equal(await lookupRelease({ fetch: fetchOk, caches, online: () => true }), '1a2b3c4 2026-11-25');
  assert.equal(asked.init.cache, 'no-store');
  // Read relative to the module (events/js/), so it is the events folder's version.json: /version.json on the events
  // host, /events/version.json in the repo, never the debate app's /version.json.
  assert.equal(asked.url, new URL('./version.json', import.meta.url).href);
  // Offline: no fetch at all.
  const never = async () => { throw new Error('fetched while offline'); };
  assert.equal(await lookupRelease({ fetch: never, caches, online: () => false }), 'offline 387a7ee');
  // A failed or missing file, and a cache that cannot be read.
  assert.equal(await lookupRelease({ fetch: never, caches, online: () => true }), 'offline 387a7ee');
  assert.equal(await lookupRelease({ fetch: async () => ({ ok: false }), caches, online: () => true }), 'offline 387a7ee');
  assert.equal(await lookupRelease({ fetch: never, caches: { keys: async () => { throw new Error('no'); } }, online: () => true }), 'unknown');
  assert.equal(await lookupRelease({ fetch: null, caches: null, online: () => true }), 'unknown');
});

// Why: a backup that names its release lets the team trace a bad file to the version that wrote it; and a judge's older backup without the field must still restore, or their rounds would be lost.
test('the backup file names the release, and backups without it still restore', () => {
  const file = makeBackup(SAVED, { now: '2026-11-25T00:00:00.000Z', release: '1a2b3c4 2026-11-25' });
  assert.equal(file.release, '1a2b3c4 2026-11-25');
  const back = readBackup(JSON.stringify(file));
  assert.equal(back.release, '1a2b3c4 2026-11-25');
  assert.equal(back.rounds, 1);
  const old = makeBackup(SAVED, { now: '2026-11-25T00:00:00.000Z' });
  assert.ok(!('release' in old));
  const oldBack = readBackup(JSON.stringify(old));
  assert.equal(oldBack.release, '');
  assert.equal(oldBack.rounds, 1);
});

// Why: the feedback email goes from the judge's own email app to an outside inbox; it must name the browser in a few fixed words, never the raw device string.
test('the browser family is a few fixed words', () => {
  assert.equal(browserFamily(IPHONE), 'iPhone Safari');
  assert.equal(browserFamily('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1'), 'iPhone Chrome');
  assert.equal(browserFamily('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36'), 'Android Chrome');
  assert.equal(browserFamily('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 Edg/126.0'), 'Windows Edge');
  assert.equal(browserFamily('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15'), 'Mac Safari');
  assert.equal(browserFamily('Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'), 'Chromebook Chrome');
  assert.equal(browserFamily('Mozilla/5.0 (Windows NT 10.0; rv:128.0) Gecko/20100101 Firefox/128.0'), 'Windows Firefox');
  assert.equal(browserFamily('secret-device-name/1.0'), 'Unknown browser');
  assert.equal(browserFamily(undefined), 'Unknown browser');
});

// Why: a feedback email that carried a student's name, a room or a comment would send minors' data to an outside inbox; the body must hold only the release, the browser family, the reminder and space to write.
test('the feedback email holds only the release id, the browser family and the reminder, even beside a full store', () => {
  // Hand it the whole device store too: the link must take nothing from it.
  const href = feedbackMailto({ release: '1a2b3c4 2026-11-25', ua: IPHONE, store: SAVED, rooms: JSON.parse(SAVED[ROOMS_KEY]) });
  const u = new URL(href);
  assert.equal(u.protocol, 'mailto:');
  assert.equal(u.pathname, FEEDBACK_TO);
  assert.equal(decodeURIComponent(u.searchParams.get('subject')), FEEDBACK_SUBJECT);
  assert.deepEqual([...u.searchParams.keys()].sort(), ['body', 'subject']);
  assert.equal(bodyOf(href), '\n\n\n\nPlease do not include student names.\nRelease: 1a2b3c4 2026-11-25\nBrowser: iPhone Safari');
  for (const p of PRIVATE) assert.ok(!decodeURIComponent(href).includes(p), p);
  // A release value that is not a release id (text from somewhere else) is replaced, not copied.
  assert.match(bodyOf(feedbackMailto({ release: 'Jordan Rivera, Room 214' })), /Release: unknown\n/);
});

// Why: judges find feedback and known issues in Settings, About; if the links went missing or the Settings screen held store data in them, judges could not report problems safely.
test('Settings, About shows the release id, Send feedback, Known issues and the source code link', () => {
  const html = aboutHtml('1a2b3c4 2026-11-25');
  assert.match(html, /Release: <span id="set-release">1a2b3c4 2026-11-25<\/span>/);
  assert.match(html, /<a id="set-feedback" href="mailto:support@tabulaspeech\.com\?subject=Speech%20Events%20feedback&amp;body=[^"]+">Send feedback<\/a>/);
  assert.ok(html.includes(`<a href="${KNOWN_ISSUES_URL}" rel="noopener">Known issues</a>`));
  assert.match(html, /Source code \(AGPL\)/);
  const screen = settingsHtml({ settings: JSON.parse(SAVED[SETTINGS_KEY]), ai: null, keys: '', offline: null, kept: null, release: 'offline 387a7ee', rooms: JSON.parse(SAVED[ROOMS_KEY]) });
  assert.match(screen, /id="set-release">offline 387a7ee</);
  const mail = decodeURIComponent(screen.match(/id="set-feedback" href="([^"]+)"/)[1].replace(/&amp;/g, '&'));
  for (const p of PRIVATE) assert.ok(!mail.includes(p), p);
  // Before the lookup ends, the screen still draws.
  assert.match(settingsHtml({ settings: {}, ai: null, keys: '', offline: null, kept: null }), /id="set-release">unknown</);
});
