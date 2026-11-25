// Speech Events: how long the data stays (Settings → Data). Three parts:
//   1. Auto-delete old rounds. Off by default. When on, a round goes 7, 30 or 90 days after the round, and only when it
//      is marked submitted and its comments are closed (cards.js cardStatus 'done'). A Congress chamber goes only when
//      every session in it is marked submitted. It runs once at app start (app.js), with Undo in a toast while the tab
//      is open.
//   2. Check a backup: what a backup file holds (days, rounds, chambers, release id, date), read before any restore.
//   3. Wrap up the season: the words of the flow in settings-screen.js (backup, confirm, then Clear this device).
// The rules at the top are pure (no DOM, no storage, no clock: the caller passes `now`). autoDeleteAtStart does the
// store reads and writes and the toast; Node tests drive it with stand-ins.
import { PREFIX, ROOMS_KEY, CARDS_KEY, DAYS_KEY } from './store.js';
import { migrateRooms, migrateCards } from './migrate.js';
import { cardStatus } from './cards.js';
import { KEYS_KEY } from './ai-key.js';
import { dayOf } from './rooms.js';
import { CONGRESS_KEY, migrateCongress } from '../congress/store.js';

// The setting lives in its own key, so it goes into a backup and Clear this device removes it, like every
// tabulaEvents.* value. The saved value: { days: 0 | 7 | 30 | 90 } (0 is off).
export const LIFETIME_KEY = PREFIX + 'lifetime.v1';
export const AUTO_DELETE_DAYS = Object.freeze([7, 30, 90]);
export const AUTO_DELETE_TOAST_KEY = 'auto-delete';

const isRecord = (x) => Boolean(x) && typeof x === 'object' && !Array.isArray(x);
const list = (x) => (Array.isArray(x) ? x : []);
const nums = (...xs) => xs.filter(Number.isFinite);

/** The auto-delete days from the saved value: 7, 30 or 90, else 0 (off). A bad value from an old backup reads as off. */
export const autoDeleteDaysOf = (saved) => (isRecord(saved) && AUTO_DELETE_DAYS.includes(saved.days) ? saved.days : 0);
/** The value to save for a choice ('0', '7', '30', '90' from the radios, or a number). Anything else saves off. */
export const lifetimeValue = (choice) => ({ days: autoDeleteDaysOf({ days: Number(choice) }) });

// Whole local calendar days from the day of time `from` to the day of time `to` (negative when `from` is later). It
// counts dates, not hours, so a daylight saving change never moves the line by a day.
export function calendarDays(from, to) {
  const utc = (t) => { const [y, m, d] = dayOf(t).split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((utc(to) - utc(from)) / 86400000);
}

// ---------- which rounds may go ----------
// The time a round was last touched: the latest of its own times and the submit time of its cards.
const roundTime = (round, cards) => Math.max(...nums(round.createdAt, round.updatedAt, round.ranksCopiedAt), ...cards.map((c) => c.submittedAt).filter(Number.isFinite));

// May this round go? Only when at least one card holds it, and every card that holds it (a cancelled card aside) is
// done: marked submitted with the comments closed. A round with no card (from before My day) is never marked submitted,
// so it stays.
function roundDone(round, cards) {
  const live = cards.filter((c) => c.status !== 'cancelled');
  return live.length > 0 && live.every((c) => cardStatus(c, round) === 'done');
}

// May this chamber go? Only when it has a session and every session is marked submitted.
const chamberClosed = (sessions) => sessions.length > 0 && sessions.every((s) => Number.isFinite(s.submittedAt));
const chamberTime = (c, sessions) => Math.max(...nums(c.createdAt, c.updatedAt), ...sessions.flatMap((s) => nums(s.createdAt, s.updatedAt, s.submittedAt, s.copiedAt)));

/**
 * What auto-delete removes. v: { rooms (saved list), cards (saved list), congress (saved value), days (0, 7, 30 or 90),
 * now }. Returns { roundIds, cardIds, chamberIds, sessionIds, clockOk }.
 * Nothing goes when days is 0, or when the clock reads earlier than a time in the data (the device clock was set back,
 * so the ages cannot be trusted). A record without a good time stays.
 */
export function pickOld(v) {
  const out = { roundIds: [], cardIds: [], chamberIds: [], sessionIds: [], clockOk: true };
  const days = AUTO_DELETE_DAYS.includes(v.days) ? v.days : 0;
  const now = v.now;
  if (!days || !Number.isFinite(now)) return out;
  const rooms = migrateRooms(v.rooms).filter((r) => isRecord(r) && r.id);
  const cards = migrateCards(v.cards).filter((c) => isRecord(c) && c.id);
  const cg = migrateCongress(v.congress);
  const chambers = cg.chambers.filter((c) => isRecord(c) && c.id);
  const sessions = cg.sessions.filter((s) => isRecord(s) && s.id);
  // A clock set back reads earlier than the newest time saved. Then no age is safe to trust: delete nothing.
  // The same times the ages use (roundTime, chamberTime), plus each card's own time.
  const times = [...rooms.flatMap((r) => nums(r.createdAt, r.updatedAt, r.ranksCopiedAt)), ...cards.flatMap((c) => nums(c.createdAt, c.submittedAt)),
    ...chambers.flatMap((c) => nums(c.createdAt, c.updatedAt)), ...sessions.flatMap((s) => nums(s.createdAt, s.updatedAt, s.submittedAt, s.copiedAt))];
  if (times.some((t) => t > now)) { out.clockOk = false; return out; }
  const old = (t) => Number.isFinite(t) && calendarDays(t, now) >= days;
  for (const r of rooms) {
    const held = cards.filter((c) => c.roundId === r.id);
    if (!roundDone(r, held) || !old(roundTime(r, held))) continue;
    out.roundIds.push(r.id);
    out.cardIds.push(...held.map((c) => c.id));
  }
  for (const c of chambers) {
    const own = sessions.filter((s) => s.chamberId === c.id);
    if (!chamberClosed(own) || !old(chamberTime(c, own))) continue;
    out.chamberIds.push(c.id);
    out.sessionIds.push(...own.map((s) => s.id));
  }
  return out;
}

// ---------- removing and putting back ----------
const without = (arr, ids) => list(arr).filter((x) => !(isRecord(x) && ids.includes(x.id)));
const taken = (arr, ids) => list(arr).filter((x) => isRecord(x) && ids.includes(x.id));
// Put records back that are not in the list now (by id), so a round made since the delete is kept.
const withBack = (arr, back) => { const have = new Set(list(arr).filter(isRecord).map((x) => x.id)); return list(arr).concat(back.filter((x) => !have.has(x.id))); };

/**
 * The saved values with the picked records gone, and what was taken (for Undo). saved: { rooms, cards, congress } as
 * read from the store (the records keep their own shape; only whole records go). pick: pickOld's result.
 */
export function removeOld(saved, pick) {
  const cg = isRecord(saved.congress) ? saved.congress : null;
  const removed = {
    rooms: taken(saved.rooms, pick.roundIds), cards: taken(saved.cards, pick.cardIds),
    chambers: cg ? taken(cg.chambers, pick.chamberIds) : [], sessions: cg ? taken(cg.sessions, pick.sessionIds) : [],
  };
  const next = {
    rooms: without(saved.rooms, pick.roundIds), cards: without(saved.cards, pick.cardIds),
    congress: cg ? Object.assign({}, cg, { chambers: without(cg.chambers, pick.chamberIds), sessions: without(cg.sessions, pick.sessionIds) }) : saved.congress,
  };
  return { next, removed };
}

/** Undo: the saved values now, with the removed records back. Records made or changed since stay as they are. */
export function putBack(saved, removed) {
  const cg = isRecord(saved.congress) ? saved.congress : { v: 1, chambers: [], sessions: [], prefs: {} };
  return {
    rooms: withBack(saved.rooms, removed.rooms), cards: withBack(saved.cards, removed.cards),
    congress: removed.chambers.length || removed.sessions.length
      ? Object.assign({}, cg, { chambers: withBack(cg.chambers, removed.chambers), sessions: withBack(cg.sessions, removed.sessions) }) : saved.congress,
  };
}

const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
/** The toast line: "3 old rounds removed." or "2 old rounds and 1 Congress chamber removed." */
export function removedText(rounds, chambers) {
  const parts = [];
  if (rounds) parts.push(plural(rounds, 'old round', 'old rounds'));
  if (chambers) parts.push(plural(chambers, rounds ? 'Congress chamber' : 'old Congress chamber', rounds ? 'Congress chambers' : 'old Congress chambers'));
  return parts.length ? parts.join(' and ') + ' removed.' : '';
}

/** The help line under the choices. days: 0, 7, 30 or 90. clockOk: false when pickOld found a saved time later than
 * the device clock, so auto-delete waits; the line then says so. */
export function autoDeleteHelp(days, clockOk = true) {
  if (!days) return 'Off. Rounds stay on this device until you delete them.';
  const rule = 'When the app starts, it removes rounds ' + days + ' days after the round. It keeps a round not yet marked submitted, a round with comments open, and a Congress chamber still open.';
  return clockOk ? rule : rule + ' Paused now: a saved round has a time later than this device\'s clock. Check the date and time on this device.';
}

/** What this device holds now, in words ("4 rounds, 1 Congress chamber"). sum: backupSummary's result. */
export const deviceSummaryText = (sum) => plural(sum.rounds, 'round', 'rounds') + (sum.chambers ? ', ' + plural(sum.chambers, 'Congress chamber', 'Congress chambers') : '');

/** Is auto-delete paused by the clock check right now? store: the events store; now: the time. */
export function autoDeletePaused(store, now) {
  const days = autoDeleteDaysOf(store.get(LIFETIME_KEY, null));
  return Boolean(days) && !pickOld(Object.assign({ days, now }, readSaved(store))).clockOk;
}

// ---------- the start-up run ----------
// What the last run removed, kept in memory for this tab only. The toast's Undo lasts 10 seconds (core/ui.js), so
// Settings → Data also offers "Put them back" until the tab closes. Clear this device and a restore forget it
// (settings-screen.js), so rounds never come back onto a device the judge just cleared or replaced.
let lastRemoved = null; // { removed, keys, rounds, chambers }

const FIELD = Object.freeze({ [ROOMS_KEY]: 'rooms', [CARDS_KEY]: 'cards', [CONGRESS_KEY]: 'congress' });
function readSaved(store) { return { rooms: store.get(ROOMS_KEY, []), cards: store.get(CARDS_KEY, []), congress: store.get(CONGRESS_KEY, null) }; }
// The keys a pick changes. Only these are written, so a value auto-delete has no reason to touch is never rewritten.
const keysOf = (pick) => [].concat(pick.roundIds.length ? [ROOMS_KEY] : [], pick.cardIds.length ? [CARDS_KEY] : [],
  pick.chamberIds.length || pick.sessionIds.length ? [CONGRESS_KEY] : []);
// Save the keys from `saved`, all or nothing: when one save fails, the keys already saved go back to their old values.
function writeKeys(store, keys, saved) {
  const old = readSaved(store);
  const done = [];
  for (const k of keys) {
    if (store.set(k, saved[FIELD[k]])) { done.push(k); continue; }
    for (const d of done) store.set(d, old[FIELD[d]]);
    return false;
  }
  return true;
}
const backText = (r) => (r.rounds + r.chambers === 1 ? (r.rounds ? 'The round is back.' : 'The Congress chamber is back.') : 'The removed rounds are back.');

/** What the last run removed and can still put back in this tab: { rounds, chambers }, or null. */
export const pendingPutBack = () => (lastRemoved ? { rounds: lastRemoved.rounds, chambers: lastRemoved.chambers } : null);
/** Forget what the last run removed (after Clear this device or a restore). */
export function forgetRemoved() { lastRemoved = null; }

/**
 * Put back what the last run removed (the toast's Undo and Settings' "Put them back"). Records made or changed since
 * stay as they are. deps: { store, ui, refresh() }. Returns true when they are back. A failed save keeps them in
 * memory, so the judge can try again.
 */
export function putBackRemoved({ store, ui, refresh }) {
  const r = lastRemoved;
  if (!r) return false;
  ui.dismissToast(AUTO_DELETE_TOAST_KEY);
  if (!writeKeys(store, r.keys, putBack(readSaved(store), r.removed))) {
    ui.toast('The rounds did not come back. The device storage is full or blocked. Try again in Settings, Data.', { kind: 'error', key: AUTO_DELETE_TOAST_KEY });
    return false;
  }
  lastRemoved = null;
  if (refresh) refresh();
  ui.toast(backText(r), { key: AUTO_DELETE_TOAST_KEY });
  return true;
}

/**
 * Run auto-delete once (app start). deps: { store (the events store), ui: { toast, dismissToast }, now(),
 * refresh() (redraw the screen that shows, after an Undo) }. Returns the number of rounds and chambers removed.
 * With the setting off, it reads one value and does nothing else. A save that fails puts the old values back.
 */
export function autoDeleteAtStart(deps) {
  // The page must always start: a fault here is logged and nothing more is removed.
  try { return runAutoDelete(deps); } catch (err) { console.error('Speech Events: auto-delete did not run.', err); return 0; }
}
function runAutoDelete({ store, ui, now, refresh }) {
  const days = autoDeleteDaysOf(store.get(LIFETIME_KEY, null));
  if (!days) return 0;
  const before = readSaved(store);
  const pick = pickOld(Object.assign({ days, now: now() }, before));
  const count = pick.roundIds.length + pick.chamberIds.length;
  if (!count) return 0;
  const keys = keysOf(pick);
  const { next, removed } = removeOld(before, pick);
  lastRemoved = { removed, keys, rounds: pick.roundIds.length, chambers: pick.chamberIds.length };
  if (!writeKeys(store, keys, next)) {
    // writeKeys put the old values back. If even that did not hold, the removed records are still in memory: offer them.
    console.error('Speech Events: auto-delete did not save, so nothing was removed.');
    if (putBackRemoved({ store, ui: { toast() {}, dismissToast() {} } })) return 0;
    ui.toast('Auto-delete did not finish. Put the rounds back now.', { kind: 'error', key: AUTO_DELETE_TOAST_KEY,
      action: { label: 'Put back', name: 'Put back the removed rounds', run: () => putBackRemoved({ store, ui, refresh }) } });
    return 0;
  }
  const what = removedText(pick.roundIds.length, pick.chamberIds.length);
  ui.dismissToast(AUTO_DELETE_TOAST_KEY);
  ui.toast(what, { key: AUTO_DELETE_TOAST_KEY, action: { label: 'Undo', name: 'Undo: ' + what.replace(/\.$/, ''), run: () => putBackRemoved({ store, ui, refresh }) } });
  return count;
}

// ---------- check a backup ----------
const parseList = (raw) => { try { const v = JSON.parse(raw); return Array.isArray(v) ? v : []; } catch { return []; } };
const parseValue = (raw) => { try { return JSON.parse(raw); } catch { return null; } };

/**
 * What a backup holds, for the judge to read before a restore. b: settings.js readBackup's result (it has already
 * refused a bad or foreign file). Returns { days, rounds, chambers, sessions, autoDelete, release, date, includesKeys }.
 */
export function backupSummary(b) {
  const s = (b && b.storage) || {};
  const cg = CONGRESS_KEY in s ? migrateCongress(parseValue(s[CONGRESS_KEY])) : { chambers: [], sessions: [] };
  return {
    days: DAYS_KEY in s ? parseList(s[DAYS_KEY]).length : 0,
    rounds: Number.isInteger(b && b.rounds) ? b.rounds : (ROOMS_KEY in s ? parseList(s[ROOMS_KEY]).length : 0),
    chambers: cg.chambers.filter(isRecord).length,
    sessions: cg.sessions.filter(isRecord).length,
    autoDelete: LIFETIME_KEY in s ? autoDeleteDaysOf(parseValue(s[LIFETIME_KEY])) : 0,
    release: (b && b.release) || '',
    date: (b && typeof b.exportedAt === 'string' && /^\d{4}-\d{2}-\d{2}/.test(b.exportedAt)) ? b.exportedAt.slice(0, 10) : '',
    includesKeys: Boolean(b && b.includesKeys && typeof s[KEYS_KEY] === 'string'),
  };
}

/** The lines the check shows, in plain words: [{ label, value }]. */
export function backupSummaryRows(sum) {
  return [
    { label: 'Saved on', value: sum.date || 'Not named in the file' },
    { label: 'Release', value: sum.release || 'Not named in the file' },
    { label: 'Days', value: String(sum.days) },
    { label: 'Rounds', value: String(sum.rounds) },
    { label: 'Congress chambers', value: sum.chambers + (sum.sessions ? ' (' + plural(sum.sessions, 'session', 'sessions') + ')' : '') },
    { label: 'Your AI key', value: sum.includesKeys ? 'In the file' : 'Not in the file' },
    { label: 'Auto-delete in the file', value: (sum.autoDelete ? sum.autoDelete + ' days' : 'Off') + ' (this device keeps its own choice)' },
  ];
}

(globalThis.TabulaEvents = globalThis.TabulaEvents || {}).lifetime = Object.freeze({ LIFETIME_KEY, AUTO_DELETE_DAYS, AUTO_DELETE_TOAST_KEY,
  autoDeleteDaysOf, lifetimeValue, calendarDays, pickOld, removeOld, putBack, removedText, autoDeleteHelp, deviceSummaryText, autoDeletePaused, autoDeleteAtStart, pendingPutBack, forgetRemoved, putBackRemoved, backupSummary, backupSummaryRows });
