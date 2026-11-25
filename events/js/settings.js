// Speech Events step S2 (docs/events/EXPERIENCE.md §1.1, §7, §8.5): the device settings and the backup file. Pure: no
// DOM, no storage, no clock. settings-screen.js draws the Settings screen; app.js saves.
//
// Step S4 adds drawGapMin, the F2 draw gap (7 or 10 minutes; DRAW_GAPS and drawGapOf below).
// Deferred to later steps (EXPERIENCE.md §11.1), so not here yet: the league pack and default profile, the defaults
// for each type (signals, grace), the Congress scale defaults (S6), and Shared device (S8).
// Step S3 adds ranksDueMin (1 to 60 minutes) and recentEvents (up to 5 public event ids, for the picker).
// Step S4 adds drawGapMin (the F2 draw gap, 7 or 10 minutes).
import { buildBackup, parseBackup } from '../../core/store.js';
import { PREFIX, ROOMS_KEY, SETTINGS_KEY, DAYS_KEY, CARDS_KEY } from './store.js';
import { KEYS_KEY } from './ai-key.js';
import { migrateRooms, migrateSettings, migrateDays, migrateCards, RANKS_DUE_DEFAULT } from './migrate.js';

// The F2 draw gaps in minutes (step S4, EXPERIENCE.md §3: 7 or 10, not confirmed, so the judge picks) and the gap of a
// settings record (an unknown value reads as the first, the migration default).
export const DRAW_GAPS = Object.freeze([7, 10]);
export const drawGapOf = (settings) => (settings && DRAW_GAPS.includes(settings.drawGapMin) ? settings.drawGapMin : DRAW_GAPS[0]);

// The app name in a backup file. A file with another name (a Tabula Debate backup) is refused.
export const BACKUP_APP = 'tabula-events';
// The app name debate writes in its own backup files (core/store.js buildBackup's default).
const DEBATE_APP = 'tabula';

export const MODES = Object.freeze([
  { id: 'judge', label: 'Judge' },
  { id: 'coach', label: 'Coach' },
  { id: 'student', label: 'Student' },
]);
export const THEMES = Object.freeze([
  { id: 'system', label: 'Match this device' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
]);

export const RANKS_DUE_MAX = 60;
export const RECENT_MAX = 5;
// A good ranks-due value: a whole number of minutes from 1 to 60.
export const validRanksDue = (v) => Number.isInteger(v) && v >= 1 && v <= RANKS_DUE_MAX;
// The ranks-due minutes to use: the setting when it is good, else 10 (a bad value from an old backup never breaks
// the countdown).
export function ranksDueMinOf(settings) {
  const v = migrateSettings(settings).ranksDueMin;
  return validRanksDue(v) ? v : RANKS_DUE_DEFAULT;
}
// The recent events with one more at the front (no doubles, at most 5).
export const withRecentEvent = (settings, eventId) => {
  const s = migrateSettings(settings);
  const old = Array.isArray(s.recentEvents) ? s.recentEvents.filter((x) => typeof x === 'string' && x !== eventId) : [];
  return withSetting(s, 'recentEvents', [eventId].concat(old).slice(0, RECENT_MAX));
};

// Does the header show the mode menu? Only when a saved mode is Coach or Student (§1.1: a parent who judges once never
// sees it). Copy trim E46: Settings has no Mode part until those screens ship, so the old "Show the mode menu" switch is
// gone and no longer counts; a judge left in Coach or Student uses this menu to go back to Judge, and then it hides.
export const modeMenuShown = (settings) => migrateSettings(settings).mode !== 'judge';

// The settings with one change. A value that is not on the list is refused (the settings come back unchanged), so a
// bad value from the page can never be saved.
export function withSetting(settings, key, value) {
  const s = migrateSettings(settings);
  if (key === 'mode' && !MODES.some((m) => m.id === value)) return s;
  if (key === 'theme' && !THEMES.some((t) => t.id === value)) return s;
  // showModeMenu is retired (copy trim E46): still accepted so old backups load, but modeMenuShown no longer reads it.
  if (key === 'showModeMenu' && typeof value !== 'boolean') return s;
  if (key === 'ranksDueMin' && !validRanksDue(value)) return s;
  if (key === 'recentEvents' && !(Array.isArray(value) && value.length <= RECENT_MAX && value.every((x) => typeof x === 'string' && /^[a-z0-9-]{1,20}$/.test(x)))) return s;
  if (key === 'drawGapMin' && !DRAW_GAPS.includes(value)) return s;
  if (!['mode', 'theme', 'showModeMenu', 'ranksDueMin', 'recentEvents', 'drawGapMin'].includes(key)) return s;
  return Object.assign({}, s, { [key]: Array.isArray(value) ? value.slice() : value });
}

// ---------- the backup file ----------
// saved: { name: rawString } for every tabulaEvents.* value (store.snapshot(PREFIX)). The AI key stays out unless
// includeKeys: a backup file is easy to share by mistake.
// release: the release id of the page that made the file (releaseId below), so a problem with a backup can be traced
// to the version that wrote it. It is left out when not known; readBackup never needs it (older files have none).
export const makeBackup = (saved, { includeKeys = false, now, release } = {}) =>
  buildBackup(saved, { prefix: PREFIX, app: BACKUP_APP, secretKeys: [KEYS_KEY], includeSecrets: includeKeys, now,
    extra: typeof release === 'string' && release ? { release } : {} });

// The file name for a backup made at an ISO time.
export const backupName = (iso) => 'tabula-speech-events-backup-' + String(iso || '').slice(0, 10) + '.json';

const parseJson = (raw) => { try { return { ok: true, value: JSON.parse(raw) }; } catch { return { ok: false }; } };

// Read a backup file and say plainly what is wrong with it. Returns { storage, exportedAt, includesKeys, rounds }.
// The rounds and settings in it go through the read-time migration, so an old backup restores in today's shape with
// no change to what it held. A Tabula Debate backup is refused by name, so the judge knows where to open it.
export function readBackup(text) {
  const head = parseJson(text);
  if (head.ok && head.value && head.value.kind === 'backup' && head.value.app === DEBATE_APP) {
    throw new Error('This is a Tabula Debate backup. Restore it in Tabula Debate, not here.');
  }
  if (head.ok && head.value && head.value.kind === 'backup' && head.value.app !== BACKUP_APP) {
    throw new Error('This backup is from another app. Speech Events can restore only its own backups.');
  }
  const b = parseBackup(text, { prefix: PREFIX, app: BACKUP_APP });
  const storage = Object.assign({}, b.storage);
  let rounds = 0;
  if (ROOMS_KEY in storage) {
    const r = parseJson(storage[ROOMS_KEY]);
    if (!r.ok || !Array.isArray(r.value)) throw new Error('The rounds in this backup are damaged, so nothing was restored.');
    const list = migrateRooms(r.value);
    rounds = list.length;
    storage[ROOMS_KEY] = JSON.stringify(list);
  }
  // Step S3: days and cards come back in today's shape too. A list that is damaged is refused, like the rounds.
  for (const [key, mig, what] of [[DAYS_KEY, migrateDays, 'days'], [CARDS_KEY, migrateCards, 'ballot cards']]) {
    if (!(key in storage)) continue;
    const r = parseJson(storage[key]);
    if (!r.ok || !Array.isArray(r.value)) throw new Error('The ' + what + ' in this backup are damaged, so nothing was restored.');
    storage[key] = JSON.stringify(mig(r.value));
  }
  if (SETTINGS_KEY in storage) {
    const s = parseJson(storage[SETTINGS_KEY]);
    storage[SETTINGS_KEY] = JSON.stringify(migrateSettings(s.ok ? s.value : {}));
  }
  const release = typeof b.file.release === 'string' && RELEASE_TEXT.test(b.file.release) ? b.file.release : '';
  return { storage, exportedAt: typeof b.exportedAt === 'string' ? b.exportedAt : '', includesKeys: b.includesKeys, rounds, release };
}

// What restore writes: the backup's values. A backup made without the AI key keeps the key this device has now, so
// restoring never signs the judge out of their AI by surprise. current: store.snapshot(PREFIX).
export function restoreItems(current, backup) {
  const items = Object.assign({}, backup.storage);
  // A file can say it includes keys and still hold none (the key lived only in this tab). Keep the device's key then too.
  const hasKey = backup.includesKeys && typeof items[KEYS_KEY] === 'string';
  if (!hasKey && current && typeof current[KEYS_KEY] === 'string') items[KEYS_KEY] = current[KEYS_KEY];
  return items;
}

// ---------- data safety ----------
// The Settings line for storageKept's answer (store.js). installed: the page runs as an installed app (Safari keeps an
// installed app's data even when the browser says 'may-clear').
export function keptText(state, installed) {
  if (state === 'kept') return 'This browser keeps your rounds.';
  if (installed) return 'The app is installed, so this browser keeps your rounds longer. A backup is still the safest copy.';
  return 'This browser may clear your rounds if you do not open the app for a while. Install it or download a backup.';
}

// The latest time any round or ballot card changed (ms), or 0 when there are none. Rounds carry updatedAt; a card
// changes when it is made, submitted or cancelled.
export function lastChangeAt(rounds, cards) {
  let t = 0;
  const take = (v) => { if (Number.isFinite(v) && v > t) t = v; };
  for (const r of Array.isArray(rounds) ? rounds : []) if (r && typeof r === 'object') { take(r.createdAt); take(r.updatedAt); }
  for (const c of Array.isArray(cards) ? cards : []) if (c && typeof c === 'object') { take(c.createdAt); take(c.submittedAt); take(c.cancelledAt); }
  return t;
}

// Does My day show the "download a backup" reminder? Only when the judging day is over and something changed since the
// last backup. The day is over when today has ballots, none of them is still to judge (Now or Later today), the judge
// is not on standby for another ballot, and no Congress chamber is in use.
// v: { model (cards.js mydayModel), chambers (today's Congress chambers), lastChange (lastChangeAt), lastBackupAt
// (ms or null), dismissedAt (the lastChange value the judge said "Not now" to, or null) }.
export function backupReminderDue(v) {
  const o = v || {};
  const m = o.model;
  if (!m || !Array.isArray(m.items) || !m.items.length || !Array.isArray(m.sections)) return false;
  const left = m.sections.filter((s) => s.id === 'now' || s.id === 'later').reduce((n, s) => n + s.items.length, 0);
  if (left || m.standby || (Array.isArray(o.chambers) && o.chambers.length)) return false;
  const changed = Number.isFinite(o.lastChange) ? o.lastChange : 0;
  if (!changed) return false;
  if (o.dismissedAt === changed) return false;
  return !(Number.isFinite(o.lastBackupAt) && o.lastBackupAt >= changed);
}

// What "Clear this device" removes, for the confirm dialog: every saved value under tabulaEvents.*, in plain words.
export const CLEAR_WHAT = 'every round, ballot card, comment, Congress session and setting in Speech Events on this browser, and your AI key if you saved one here.';

// ---------- release id and feedback ----------
// The service worker's cache is named 'tabula-events-' + the release hash (events/sw.js, events/sw-files.js).
const CACHE_NAME = /^tabula-events-([0-9a-f]{7,})$/;
const DAY = /^\d{4}-\d{2}-\d{2}/;
// What a release id can look like (releaseId's output). Anything else is not treated as one.
const RELEASE_TEXT = /^[0-9a-z +-]{1,40}$/;

// A short, readable name for the release this page runs. v: { version (the parsed version.json, { sha, builtAt }, or
// null when it could not be read), cacheName (the worker's cache name, or null) }.
//   version.json read:  the first 7 characters of the commit and the build day, e.g. "1a2b3c4 2026-11-25".
//   not read (offline): the worker's release hash, e.g. "offline 387a7ee".
//   neither:            "unknown".
export function releaseId(v) {
  const o = v || {};
  const ver = o.version && typeof o.version === 'object' ? o.version : null;
  const sha = ver && typeof ver.sha === 'string' && /^[0-9a-f]{7,40}(-dirty)?$/.test(ver.sha) ? ver.sha : '';
  const day = ver && typeof ver.builtAt === 'string' && DAY.test(ver.builtAt) ? ver.builtAt.slice(0, 10) : '';
  if (sha || day) return [sha ? sha.slice(0, 7) + (sha.endsWith('-dirty') ? '+' : '') : 'build', day].filter(Boolean).join(' ');
  const m = typeof o.cacheName === 'string' && CACHE_NAME.exec(o.cacheName);
  return m ? 'offline ' + m[1].slice(0, 7) : 'unknown';
}

// The device and browser family from a user agent string, in a few fixed words (e.g. "iPhone Safari"). Only words
// from these lists come out, never the raw string, so nothing else about the device goes into an email.
export function browserFamily(ua) {
  const s = typeof ua === 'string' ? ua : '';
  const device = /iPhone|iPod/.test(s) ? 'iPhone' : /iPad/.test(s) ? 'iPad' : /Android/.test(s) ? 'Android'
    : /CrOS/.test(s) ? 'Chromebook' : /Macintosh|Mac OS X/.test(s) ? 'Mac' : /Windows/.test(s) ? 'Windows'
      : /Linux/.test(s) ? 'Linux' : '';
  const browser = /EdgiOS|Edg(e|A)?\//.test(s) ? 'Edge' : /FxiOS|Firefox\//.test(s) ? 'Firefox'
    : /SamsungBrowser\//.test(s) ? 'Samsung Internet' : /CriOS|Chrome\/|Chromium\//.test(s) ? 'Chrome'
      : /Safari\//.test(s) ? 'Safari' : '';
  return [device, browser].filter(Boolean).join(' ') || 'Unknown browser';
}

export const FEEDBACK_TO = 'support@tabulaspeech.com';
export const FEEDBACK_SUBJECT = 'Speech Events feedback';
export const KNOWN_ISSUES_URL = 'https://tabulaforensics.com/known-issues/';

// The "Send feedback" email link. It takes only the release id and the user agent: no rounds, names or settings can
// reach it. The body starts with blank lines for the judge's words, then the reminder, the release and the browser.
// Nothing is sent: the judge's own email app opens and the judge decides.
export function feedbackMailto(v) {
  const o = v || {};
  const release = typeof o.release === 'string' && RELEASE_TEXT.test(o.release) ? o.release : 'unknown';
  const body = ['', '', '', '', 'Please do not include student names.', 'Release: ' + release, 'Browser: ' + browserFamily(o.ua)].join('\n');
  return 'mailto:' + FEEDBACK_TO + '?subject=' + encodeURIComponent(FEEDBACK_SUBJECT) + '&body=' + encodeURIComponent(body);
}

(globalThis.TabulaEvents = globalThis.TabulaEvents || {}).settings = Object.freeze({ keptText, lastChangeAt, backupReminderDue, CLEAR_WHAT, BACKUP_APP, MODES, THEMES, RANKS_DUE_MAX, RECENT_MAX, DRAW_GAPS, drawGapOf, validRanksDue, ranksDueMinOf, withRecentEvent, modeMenuShown, withSetting,
  makeBackup, backupName, readBackup, restoreItems, releaseId, browserFamily, feedbackMailto, FEEDBACK_TO, FEEDBACK_SUBJECT, KNOWN_ISSUES_URL });
