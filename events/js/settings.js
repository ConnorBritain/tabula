// Speech Events step S2 (docs/events/EXPERIENCE.md §1.1, §7, §8.5): the device settings and the backup file. Pure: no
// DOM, no storage, no clock. settings-screen.js draws the Settings screen; app.js saves.
//
// Step S4 adds drawGapMin, the F2 draw gap (7 or 10 minutes; cross-ex.js DRAW_GAPS).
// Deferred to later steps (EXPERIENCE.md §11.1), so not here yet: the league pack and default profile, the defaults
// for each type (signals, grace), ranks-due minutes (S3), the Congress scale defaults (S6), and Shared device (S8).
import { buildBackup, parseBackup } from '../../core/store.js';
import { PREFIX, ROOMS_KEY, SETTINGS_KEY } from './store.js';
import { KEYS_KEY } from './ai-key.js';
import { migrateRooms, migrateSettings } from './migrate.js';

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

// Does the header show the mode menu? Only after someone picks Coach or Student, or turns the menu on (§1.1: a parent
// who judges once never sees it).
export const modeMenuShown = (settings) => {
  const s = migrateSettings(settings);
  return s.mode !== 'judge' || s.showModeMenu === true;
};

// The settings with one change. A value that is not on the list is refused (the settings come back unchanged), so a
// bad value from the page can never be saved.
export function withSetting(settings, key, value) {
  const s = migrateSettings(settings);
  if (key === 'mode' && !MODES.some((m) => m.id === value)) return s;
  if (key === 'theme' && !THEMES.some((t) => t.id === value)) return s;
  if (key === 'showModeMenu' && typeof value !== 'boolean') return s;
  if (key === 'drawGapMin' && !DRAW_GAPS.includes(value)) return s;
  if (!['mode', 'theme', 'showModeMenu', 'drawGapMin'].includes(key)) return s;
  return Object.assign({}, s, { [key]: value });
}

// ---------- the backup file ----------
// saved: { name: rawString } for every tabulaEvents.* value (store.snapshot(PREFIX)). The AI key stays out unless
// includeKeys: a backup file is easy to share by mistake.
export const makeBackup = (saved, { includeKeys = false, now } = {}) =>
  buildBackup(saved, { prefix: PREFIX, app: BACKUP_APP, secretKeys: [KEYS_KEY], includeSecrets: includeKeys, now });

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
  if (SETTINGS_KEY in storage) {
    const s = parseJson(storage[SETTINGS_KEY]);
    storage[SETTINGS_KEY] = JSON.stringify(migrateSettings(s.ok ? s.value : {}));
  }
  return { storage, exportedAt: typeof b.exportedAt === 'string' ? b.exportedAt : '', includesKeys: b.includesKeys, rounds };
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

(globalThis.TabulaEvents = globalThis.TabulaEvents || {}).settings = Object.freeze({ BACKUP_APP, MODES, THEMES, DRAW_GAPS, drawGapOf, modeMenuShown, withSetting,
  makeBackup, backupName, readBackup, restoreItems });
