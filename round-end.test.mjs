// The round's end in Debate: the Save as PDF step after Save to History, and the day-end backup reminder.
// Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const L = require('./logic.js');
const read = (f) => readFileSync(new URL(f, import.meta.url), 'utf8');
const H = 3600 * 1000;
const day = (y, m, d, h) => new Date(y, m - 1, d, h).getTime();

// Why: a judge who never backs up loses every saved ballot when the browser clears its data; the reminder must come once the judging is over, and never while they are still judging.
test('backupReminderDue: due after a quiet spell or on a new day, never before a save, after a backup or after "Not now"', () => {
  const saved = day(2026, 3, 7, 15);
  const due = (o) => L.backupReminderDue(Object.assign({ lastSavedAt: saved, lastBackupAt: null, dismissedAt: null }, o));
  assert.equal(due({ now: saved + 30 * 60 * 1000 }), false, 'still judging: 30 minutes after the last save');
  assert.equal(due({ now: saved + 2 * H }), true, '2 hours after the last save');
  assert.equal(due({ now: day(2026, 3, 8, 7) }), true, 'the next morning');
  assert.equal(due({ now: day(2026, 3, 8, 0) + 1, lastSavedAt: day(2026, 3, 7, 23) }), true, 'past midnight counts as a new day');
  assert.equal(due({ now: saved + 3 * H, lastBackupAt: saved + 1 }), false, 'a backup after the last save');
  assert.equal(due({ now: saved + 3 * H, lastBackupAt: saved - 1 }), true, 'a backup before the last save');
  assert.equal(due({ now: saved + 3 * H, dismissedAt: saved }), false, '"Not now" for this save');
  assert.equal(due({ now: saved + 3 * H, dismissedAt: saved - 5 }), true, '"Not now" was for an older save');
  assert.equal(L.backupReminderDue({ lastSavedAt: null, now: saved }), false, 'nothing saved yet');
  assert.equal(L.backupReminderDue(), false);
});

// Why: the Debate rule must keep the shape of the shared backup rule (dayOver, lastChange, lastBackupAt, dismissedAt), so Debate can switch to it without changing behaviour.
test('backupDue and backupDayOver: the two parts of the reminder', () => {
  assert.equal(L.backupDue({ dayOver: true, lastChange: 10, lastBackupAt: null, dismissedAt: null }), true);
  assert.equal(L.backupDue({ dayOver: false, lastChange: 10 }), false);
  assert.equal(L.backupDue({ dayOver: true, lastChange: 10, lastBackupAt: 10 }), false, 'a backup at the same moment as the change counts');
  assert.equal(L.backupDue({ dayOver: true, lastChange: 10, lastBackupAt: 9 }), true);
  assert.equal(L.backupDue({ dayOver: true, lastChange: 10, dismissedAt: 10 }), false);
  assert.equal(L.backupDue({ dayOver: true, lastChange: null }), false);
  const saved = day(2026, 3, 7, 15);
  assert.equal(L.backupDayOver(saved, saved + 2 * H - 1), false);
  assert.equal(L.backupDayOver(saved, saved + 2 * H), true);
  assert.equal(L.backupDayOver(null, saved), false);
});

// Why: "a new day" is the judge's own calendar day; checked in UTC, a judge west of Greenwich would get the reminder in the evening, mid-tournament.
test('a new day is the device\'s local day, not UTC', () => {
  const code = `const L = require(${JSON.stringify(new URL('./logic.js', import.meta.url).pathname)});
    const saved = new Date(2026, 2, 7, 15).getTime(), evening = new Date(2026, 2, 7, 16, 30).getTime(), morning = new Date(2026, 2, 8, 6).getTime();
    console.log(JSON.stringify([L.backupDayOver(saved, evening), L.backupDayOver(new Date(2026, 2, 7, 23).getTime(), morning)]));`;
  for (const tz of ['America/Los_Angeles', 'Asia/Tokyo', 'UTC']) {
    const r = spawnSync(process.execPath, ['-e', code], { env: { ...process.env, TZ: tz }, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(JSON.parse(r.stdout), [false, true], tz);
  }
});

// Why: a judge who restores a backup on a new computer would otherwise be told at once to back up what they just restored.
test('a restored backup counts as the last backup', () => {
  const at = '2026-03-07T20:00:00.000Z', t = Date.parse(at);
  assert.equal(JSON.parse(L.stampRestoredBackup(JSON.stringify({ lastSavedAt: t - 5, theme: 'dark' }), at)).lastBackupAt, t);
  assert.equal(JSON.parse(L.stampRestoredBackup(JSON.stringify({ lastBackupAt: t + 9 }), at)).lastBackupAt, t + 9, 'a later backup time stays');
  assert.equal(L.stampRestoredBackup('not json', at), 'not json');
  assert.equal(L.stampRestoredBackup('{"a":1}', ''), '{"a":1}', 'no export time: unchanged');
  assert.match(read('js/decide.js'), /entries\[SETTINGS\] = L\.stampRestoredBackup\(entries\[SETTINGS\], b\.exportedAt\)/);
  assert.match(read('js/decide.js'), /S\.lastBackupAt = Date\.now\(\); save\(\); saveSettings\(\);\s*let backup;\s*try \{\s*const all = readAllStorage\(\);/, 'the backup time is in the file itself');
});

// Why: the reminder is only useful if the History screen shows it with a working button and a way to quiet it; a missing id would throw at load and break the page.
test('History shows the reminder with Download backup and Not now; the app wires them and records each save', () => {
  const html = read('index.html');
  const card = html.slice(html.indexOf('id="backup-card"'), html.indexOf('id="backup-last"'));
  assert.match(card, /<p class="sr-only" id="backup-due-status" role="status"><\/p>\s*<div class="backup-due row" id="backup-due" hidden>/, 'a permanent live region, so the reminder is announced');
  assert.match(card, /id="backup-due-go">Download backup<\/button>/);
  assert.match(card, /id="backup-due-no">Not now<\/button>/);
  const js = read('js/decide.js');
  assert.match(js, /\$\('#backup-due-go'\)\.addEventListener\('click', \(\) => downloadBackup\(false\)\)/);
  assert.match(js, /\$\('#backup-due-no'\)\.addEventListener\('click', \(\) => \{ S\.backupDismissedAt = S\.lastSavedAt;/);
  assert.match(js, /S\.lastSavedAt = Date\.now\(\); saveSettings\(\); renderBackup\(\);/, 'Save to History records the time');
  assert.match(js, /if \(!show && due\.contains\(document\.activeElement\)\) \$\('#backup-go'\)\.focus\(\);\s*due\.hidden = !show;/, 'focus moves to Download backup before the line hides');
  assert.match(js, /if \(backupDue\(\) && S\.backupToastFor !== S\.lastSavedAt\) \{\s*S\.backupToastFor = S\.lastSavedAt;/, 'the toast on opening shows once per save');
});

// Why: voice-control users say what they see; a toast button whose spoken name does not start with its visible words cannot be clicked by voice (WCAG 2.5.3).
test('the new toast buttons keep their visible words at the start of their names', () => {
  const js = read('js/decide.js');
  for (const [label, name] of [...js.matchAll(/label: '([^']+)', name: '([^']+)'/g)].map((m) => [m[1], m[2]])) assert.ok(name.startsWith(label), name + ' does not start with ' + label);
  assert.match(js, /label: 'Save as PDF', name: 'Save as PDF: this ballot'/);
  assert.match(js, /label: 'Download backup', name: 'Download backup now'/);
});

// Why: the end of a round is when a judge wants a copy of the ballot; Save to History must offer the PDF step right there (the print dialog says how to save a PDF).
test('Save to History offers Save as PDF, which opens the print dialog', () => {
  const js = read('js/decide.js');
  assert.match(js, /toast\('Saved to History\.', \{ action: \{ label: 'Save as PDF', name: 'Save as PDF: this ballot', run: \(\) => openPrintDialog\(\) \} \}\)/);
  assert.match(read('index.html'), /id="print-help">To get a PDF, choose "Save as PDF" in the print window\.<\/p>/);
});
