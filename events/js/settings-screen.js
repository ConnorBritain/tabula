// Speech Events step S2 (docs/events/EXPERIENCE.md §7, §8.5, §9): the Settings screen, #/settings. Only the parts that
// work today: Mode, Theme, Ranks due (step S3, the minutes after the last speaker, §5.3), the extemp draw gap (step
// S4), Connect AI, the keyboard sheet, Ready for offline, and Data (whether the browser keeps the data, backup, Check a
// backup before a restore, Auto-delete old rounds, Wrap up the season, and Clear this device; lifetime.js has the
// rules), and About (the release id, Send feedback, known issues and the link to the source code).
// Deferred (EXPERIENCE.md §11.1): league pack and default profile, defaults for each type, Congress scale defaults
// (S6), Shared device (S8).
// The rules are in settings.js; the builders at the top are pure (Node tests call them); createSettingsScreen does the
// DOM.
import { escapeHtml as esc } from '../../core/sheets.js';
import { statusPillHtml } from './status-pill.js';
import { foldSummaryHtml } from './fold.js';
import { createStore, downloadFile } from '../../core/store.js';
import { isMacPlatform } from '../../core/keys.js';
import { THEMES, RANKS_DUE_MAX, DRAW_GAPS, withSetting, validRanksDue, ranksDueMinOf, makeBackup, backupName, readBackup, restoreItems, keptText, CLEAR_WHAT, releaseId, feedbackMailto, KNOWN_ISSUES_URL } from './settings.js';
import { PREFIX, BACKUP_AT_KEY, storageKept } from './store.js';
import { KEYS_KEY } from './ai-key.js';
import { keymap } from './keys.js';
import { checkOffline, CACHE_PREFIX } from './offline.js';
import { askConnectKey, askForgetKey } from './ai-connect.js';
import { LIFETIME_KEY, AUTO_DELETE_DAYS, autoDeleteDaysOf, lifetimeValue, autoDeleteHelp, backupSummary, backupSummaryRows } from './lifetime.js';

const radios = (name, list, picked) => list.map((x) => `<label class="radio"><input type="radio" name="${name}" value="${esc(x.id)}"${x.id === picked ? ' checked' : ''}> ${esc(x.label)}</label>`).join('');

// The keyboard sheet as HTML text. groups: keymap.shortcutRows(mac, ...).
export function keySheetHtml(groups) {
  return groups.map((g) => `<h3>${esc(g.group)}</h3><dl class="ks-list">${g.rows.map((r) => `<div class="ks-row"><dt>${esc(r.label)}</dt><dd><kbd>${esc(r.keys)}</kbd></dd></div>`).join('')}</dl>`).join('');
}

// The AI part as HTML text. ai: { allowed (the gate lets the judge set up a key), connected, providerName }. With AI
// setup not allowed, the part is not built at all (AI-POLICY.md §3: removed means gone).
export function aiPartHtml(ai) {
  if (!ai || !ai.allowed) return '';
  const body = ai.connected
    ? `<p>Connected: ${esc(ai.providerName)}.</p><button class="b" type="button" id="set-ai-forget">Forget my key</button>`
    : `<p class="field-help">Use your own AI key for Clean-up. The key stays in this browser.</p><button class="b" type="button" id="set-ai-connect">Connect AI</button>`;
  return `<section class="set-part" aria-labelledby="set-ai-h"><h2 id="set-ai-h">AI clean-up</h2>${body}</section>`;
}

// The offline state (D2-A, under the owner's reading of DESIGN.md §1.2: the app files are saved, so the work is done):
// "Ready offline" is green with a check, anything else a caution "Not ready", then the plain sentence.
export const offlineHtml = (res) => (!res ? 'Checking…'
  : (res.ready ? statusPillHtml('ok', 'Ready offline', 'circle-check') : statusPillHtml('caution', 'Not ready', 'triangle-alert')) + ' ' + esc(res.text));

// ---------- the release id ----------
// The build writes version.json ({ sha, builtAt }) at the root of the host; the service worker never caches it, and
// _headers says no-cache, so a read always shows what is live. Offline, or when the file cannot be read (the page run
// from the repo), the worker's cache name stands in. The page looks once at load and again each time Settings opens.
let release = null;
let pending = null;

/** The release id found so far, or 'unknown' before the first lookup ends. */
export const currentRelease = () => release || 'unknown';

/**
 * Find the release id. Never throws, and the fetch gives up after 4 seconds. deps (for tests): { fetch, caches,
 * online() }. Resolves to the id and keeps it for currentRelease.
 */
export function lookupRelease(deps) {
  if (pending && !deps) return pending;
  const d = Object.assign({
    fetch: globalThis.fetch && ((u, i) => globalThis.fetch(u, i)),
    caches: globalThis.caches,
    online: () => !globalThis.navigator || globalThis.navigator.onLine !== false,
  }, deps);
  const run = (async () => {
    let version = null;
    if (d.fetch && d.online()) {
      try {
        const init = { cache: 'no-store' };
        if (globalThis.AbortSignal && AbortSignal.timeout) init.signal = AbortSignal.timeout(4000);
        const res = await d.fetch(new URL('../version.json', import.meta.url).href, init);
        if (res && res.ok) version = await res.json();
      } catch { version = null; }
    }
    let cacheName = null;
    if (releaseId({ version }) === 'unknown' && d.caches) {
      try { cacheName = (await d.caches.keys()).find((k) => k.startsWith(CACHE_PREFIX)) || null; } catch { cacheName = null; }
    }
    release = releaseId({ version, cacheName });
    return release;
  })();
  if (!deps) { pending = run; run.finally(() => { pending = null; }); }
  return run;
}

// Look it up once when the page loads (not in Node tests), so a backup made from My day carries it too. It only reads
// a file from this same site; it sends nothing about the judge or the device.
if (typeof document === 'object' && document) lookupRelease();

// The About part as HTML text. rel: the release id.
export function aboutHtml(rel) {
  return `<section class="set-part" aria-labelledby="set-about-h"><h2 id="set-about-h">About</h2>
    <p>Release: <span id="set-release">${esc(rel)}</span></p>
    <p><a id="set-feedback" href="${esc(feedbackMailto({ release: rel, ua: globalThis.navigator && globalThis.navigator.userAgent }))}">Send feedback</a>
      · <a href="${esc(KNOWN_ISSUES_URL)}" rel="noopener">Known issues</a></p>
    <p class="field-help">Send feedback opens your email app. Nothing is sent until you send it.</p>
    <p><a href="https://github.com/TabulaSpeech/tabula" rel="noopener">Source code (AGPL)</a></p>
  </section>`;
}

// Download a backup of every tabulaEvents.* value and note the time (BACKUP_AT_KEY), so My day knows the data is safe.
// env: { store, ui, now() }. includeKeys: put the AI key in the file. Settings and the My day reminder both use it.
export function downloadBackup(env, includeKeys) {
  const at = env.now();
  const now = new Date(at).toISOString();
  const file = makeBackup(env.store.snapshot(PREFIX), { includeKeys: Boolean(includeKeys), now, release: currentRelease() });
  downloadFile(backupName(now), JSON.stringify(file, null, 2), 'application/json');
  env.store.set(BACKUP_AT_KEY, at);
  env.ui.toast('The backup file is in your downloads.', { key: 'backup' });
}

// ---------- Data: how long the data stays (lifetime.js) ----------
// The auto-delete choices: Off, then 7, 30 and 90 days.
export const AUTO_DELETE_CHOICES = Object.freeze([{ id: '0', label: 'Off' }].concat(AUTO_DELETE_DAYS.map((n) => ({ id: String(n), label: n + ' days' }))));

// The Check a backup result as HTML text. check: null (nothing picked), { error } (a plain error), or
// { rows (lifetime.js backupSummaryRows), here (what this device holds now, in words) }.
export function checkHtml(check) {
  if (!check) return '';
  if (check.error) {
    return `<div class="problems" id="set-check" role="alert"><h3 id="set-check-h" tabindex="-1">${statusPillHtml('err', 'Not restored', 'triangle-alert')} This file cannot be restored</h3>
      <p>${esc(check.error)}</p><p class="field-help">Nothing on this device changed.</p>
      <div class="set-row"><button class="b" type="button" id="set-check-close">Close</button></div></div>`;
  }
  const rows = check.rows.map((r) => `<div class="ks-row"><dt>${esc(r.label)}</dt><dd>${esc(r.value)}</dd></div>`).join('');
  return `<div class="problems" id="set-check" role="region" aria-labelledby="set-check-h"><h3 id="set-check-h" tabindex="-1">This backup holds</h3>
    <dl class="ks-list">${rows}</dl>
    <p class="field-help">Nothing changes until you tap Restore. Restore replaces every round and setting on this device${check.here ? ' (now: ' + esc(check.here) + ')' : ''}.</p>
    <div class="set-row"><button class="b" type="button" id="set-check-restore">Restore</button><button class="b" type="button" id="set-check-close">Close</button></div></div>`;
}

// Is the page running as an installed app? (Page only; false where the browser cannot say.)
const installed = () => {
  try { return Boolean((globalThis.matchMedia && globalThis.matchMedia('(display-mode: standalone)').matches) || (globalThis.navigator && globalThis.navigator.standalone)); }
  catch { return false; }
};

// The whole screen as HTML text. v: { settings, ai, keys (keySheetHtml), offline ({ text } or null while checking),
// kept (keptText's line, or null while checking), release (the release id), autoDelete (0, 7, 30 or 90),
// check (checkHtml's value) }.
export function settingsHtml(v) {
  const s = v.settings;
  return `<div class="screen-head"><h1 id="screen-title" tabindex="-1">Settings</h1></div>
  <section class="set-part" aria-labelledby="set-theme-h"><h2 id="set-theme-h">Theme</h2>
    <fieldset class="radios"><legend class="sr-only">Theme</legend>${radios('set-theme', THEMES, s.theme)}</fieldset>
  </section>
  <section class="set-part" aria-labelledby="set-due-h"><h2 id="set-due-h">Ranks due</h2>
    <label class="field set-due"><span>Minutes after the last speaker</span><input id="set-due" type="number" inputmode="numeric" min="1" max="${RANKS_DUE_MAX}" step="1" value="${esc(ranksDueMinOf(s))}"></label>
    <p class="field-help">My day counts down to this time.</p>
  </section>
  <section class="set-part" aria-labelledby="set-gap-h"><h2 id="set-gap-h">Extemp draw gap</h2>
    <fieldset class="radios"><legend class="sr-only">Extemp draw gap</legend>${radios('set-gap', DRAW_GAPS.map((n) => ({ id: String(n), label: n + ' minutes' })), String(s.drawGapMin))}</fieldset>
    <p class="field-help">How long the room shows "Waiting for next speaker" between Extemp speakers.</p>
  </section>
  ${aiPartHtml(v.ai)}
  <section class="set-part set-keys" aria-labelledby="set-keys-h"><details class="fold">${foldSummaryHtml('<h2 id="set-keys-h">Keyboard</h2>')}${v.keys}</details></section>
  <section class="set-part" aria-labelledby="set-off-h"><h2 id="set-off-h">Ready for offline</h2>
    <p id="set-offline" role="status">${offlineHtml(v.offline)}</p>
    <button class="b" type="button" id="set-offline-check">Check again</button>
  </section>
  <section class="set-part" aria-labelledby="set-data-h"><h2 id="set-data-h">Data</h2>
    <p class="field-help">Your rounds stay on this device. A backup lets you keep or move them.</p>
    <p id="set-kept" role="status">${esc(v.kept || 'Checking…')}</p>
    <div class="set-row"><button class="b" type="button" id="set-backup">Download backup</button>
      <label class="tick"><input type="checkbox" id="set-backup-keys"> Include my AI key</label></div>
    <div class="set-row"><button class="b" type="button" id="set-restore-btn">Check a backup</button>
      <input type="file" id="set-restore" accept=".json,application/json" hidden></div>
    <p class="field-help">See what a backup file holds before you restore it.</p>
    ${checkHtml(v.check)}
    <h3 id="set-auto-h">Auto-delete old rounds</h3>
    <fieldset class="radios"><legend class="sr-only">Auto-delete old rounds</legend>${radios('set-auto', AUTO_DELETE_CHOICES, String(v.autoDelete || 0))}</fieldset>
    <p class="field-help" id="set-auto-help">${esc(autoDeleteHelp(v.autoDelete || 0))}</p>
    <h3>Wrap up the season</h3>
    <p class="field-help">Save a backup, check that it saved, then clear this device.</p>
    <div class="set-row"><button class="b" type="button" id="set-wrap">Wrap up the season</button></div>
    <h3>Shared computer?</h3>
    <p class="field-help">Clear this device when you are done, so the next person cannot see your rounds.</p>
    <div class="set-row"><button class="b" type="button" id="set-clear">Clear this device</button></div>
  </section>
  ${aboutHtml(v.release || 'unknown')}`;
}

// env: { el, ui, now, store, settings(), saveSettings(s), ai, reload() }.
export function createSettingsScreen(env) {
  const $ = (s) => env.el.querySelector(s);
  let offline = null;
  let kept = null;
  let shown = false;
  let checked = null; // Check a backup: { error } or { rows, here, backup } while the result shows

  // The tab-only AI key lives in sessionStorage under the same prefix (page-ai.js), so Clear this device clears it too.
  const tab = createStore({ prefixes: [PREFIX], storage: globalThis.sessionStorage });
  const mac = () => isMacPlatform(globalThis.navigator && (navigator.userAgentData ? navigator.userAgentData.platform : navigator.platform));
  const aiView = () => {
    const P = globalThis.TabulaCore.policy;
    const own = env.ai.own;
    return { allowed: P.setupAllowed(env.ai.gate), connected: own.hasKey(), providerName: own.providerName() };
  };

  function draw(focusSel) {
    env.el.innerHTML = settingsHtml({ settings: env.settings(), ai: aiView(), keys: keySheetHtml(keymap.shortcutRows(mac(), true)), offline, kept, release: currentRelease(),
      autoDelete: autoDeleteDaysOf(env.store.get(LIFETIME_KEY, null)), check: checked });
    const f = focusSel && $(focusSel);
    if (f) f.focus();
  }

  async function check() {
    offline = null;
    if ($('#set-offline')) $('#set-offline').textContent = 'Checking…';
    const res = await checkOffline();
    if (!shown) return;
    offline = res;
    if ($('#set-offline')) $('#set-offline').innerHTML = offlineHtml(res);
  }

  async function checkKept() {
    const state = await storageKept();
    if (!shown) return;
    kept = keptText(state, installed());
    if ($('#set-kept')) $('#set-kept').textContent = kept;
  }

  // Fill in the release id when the lookup ends; the screen never waits for it.
  async function showRelease() {
    const rel = await lookupRelease();
    if (!shown) return;
    if ($('#set-release')) $('#set-release').textContent = rel;
    if ($('#set-feedback')) $('#set-feedback').href = feedbackMailto({ release: rel, ua: globalThis.navigator && globalThis.navigator.userAgent });
  }

  const backup = () => downloadBackup(env, $('#set-backup-keys') && $('#set-backup-keys').checked);

  // Clear this device: every tabulaEvents.* value in this browser (localStorage and this tab's sessionStorage). The
  // store's prefix guard (core/store.js) means it can never touch Tabula Debate's keys. The toast's Undo puts it all
  // back while the tab is open; once the tab closes, the data is gone.
  // from: 'saved' or 'skipped' when Wrap up the season leads here (the backup step is done, or skipped on purpose), so
  // the dialog says so and does not offer the backup again.
  async function clearDevice(from) {
    const wrap = from === 'saved' || from === 'skipped';
    const pick = await env.ui.ask({
      title: 'Clear this device?',
      body: wrap
        ? ['This removes ' + CLEAR_WHAT, from === 'saved' ? 'Your backup is saved. Check a backup restores it on any device.' : 'You skipped the backup. Once this tab closes, your rounds cannot come back.', 'Tabula Debate data on this browser is not touched.']
        : ['This removes ' + CLEAR_WHAT, 'Download a backup first if you want to keep them. Tabula Debate data on this browser is not touched.'],
      buttons: wrap
        ? [{ label: 'Cancel', value: null }, { label: 'Clear this device', value: 'clear', kind: 'danger' }]
        : [{ label: 'Cancel', value: null }, { label: 'Download backup first', value: 'backup' }, { label: 'Clear this device', value: 'clear', kind: 'danger' }],
      cancelValue: null,
    });
    if (pick === 'backup') { backup(); return; }
    if (pick !== 'clear') return;
    const before = env.store.snapshot(PREFIX);
    const beforeTab = tab.snapshot(PREFIX);
    const hadKey = KEYS_KEY in before || KEYS_KEY in beforeTab;
    try {
      env.ai.own.forget(); // the key in memory goes too, not only the saved copy
      env.store.replaceAll(PREFIX, {});
      tab.replaceAll(PREFIX, {});
    } catch (err) {
      console.error('Speech Events: Clear this device did not finish.', err);
      try { env.store.replaceAll(PREFIX, before); tab.replaceAll(PREFIX, beforeTab); } catch (err2) { console.error('Speech Events: the old data did not go back.', err2); }
      env.ui.toast('Clearing did not finish. Reload the page and try again.', { kind: 'error', key: 'clear' });
      return;
    }
    env.reload(); // the theme, the header and the screen read the empty data (the theme goes back to the default)
    env.ui.toast('Speech Events data is gone from this browser.', { key: 'clear', action: { label: 'Undo', name: 'Undo: clear this device', run: () => {
      env.ui.dismissToast('clear');
      try { env.store.replaceAll(PREFIX, before); tab.replaceAll(PREFIX, beforeTab); }
      catch (err) { console.error('Speech Events: the data did not go back.', err); env.ui.toast('Your data did not come back. The device storage is full or blocked.', { kind: 'error', key: 'clear' }); return; }
      // The AI key is read once when the page loads, so a page that had one reloads to pick it up again.
      if (hadKey && globalThis.location) { globalThis.location.reload(); return; }
      env.reload();
      env.ui.toast('Your data is back.', { key: 'clear' });
    } } });
  }

  // Wrap up the season: save a backup, ask whether it saved, then offer Clear this device. It never clears unless the
  // backup step is done or the judge skips it on purpose; Cancel at any step changes nothing.
  async function wrapUp() {
    const first = await env.ui.ask({
      title: 'Wrap up the season',
      body: ['First, save a backup. It holds every round, comment and setting, so you can restore them later.', 'Then you can clear this device.'],
      buttons: [{ label: 'Cancel', value: null }, { label: 'Skip the backup', value: 'skip' }, { label: 'Download backup', value: 'backup', kind: 'primary' }],
      cancelValue: null,
    });
    if (first === 'skip') return clearDevice('skipped');
    if (first !== 'backup') return;
    for (;;) {
      backup();
      const saved = await env.ui.ask({
        title: 'Did the backup save?',
        body: ['Look in your downloads for ' + backupName(new Date(env.now()).toISOString()) + '.', 'Move it off this device (email it to yourself or copy it to a drive) before you clear.'],
        buttons: [{ label: 'Cancel', value: null }, { label: 'Download again', value: 'again' }, { label: 'Yes, it saved', value: 'saved', kind: 'primary' }],
        cancelValue: null,
      });
      if (saved === 'saved') return clearDevice('saved');
      if (saved !== 'again') return;
    }
  }

  // What this device holds now, in words, for the Check a backup result.
  function hereText() {
    const sum = backupSummary({ storage: env.store.snapshot(PREFIX) });
    return sum.rounds + (sum.rounds === 1 ? ' round' : ' rounds') + (sum.chambers ? ', ' + sum.chambers + (sum.chambers === 1 ? ' Congress chamber' : ' Congress chambers') : '');
  }

  // Check a backup: read the file and show what it holds. Nothing is written here; Restore does that.
  async function checkFile(input) {
    const file = input.files && input.files[0];
    input.value = '';
    if (!file) return;
    let text;
    try { text = await file.text(); }
    catch { checked = { error: 'This file could not be read. Pick the backup file again.' }; draw('#set-check-h'); return; }
    try { const b = readBackup(text); checked = { backup: b, rows: backupSummaryRows(backupSummary(b)), here: hereText() }; }
    catch (err) { checked = { error: err.message }; }
    draw('#set-check-h');
  }

  // Restore the checked backup. Undo in the toast puts this device back as it was while the tab is open.
  function restoreChecked() {
    const b = checked && checked.backup;
    if (!b) return;
    const before = env.store.snapshot(PREFIX);
    const items = restoreItems(before, b);
    try { env.store.replaceAll(PREFIX, items); }
    catch (err) {
      console.error('Speech Events: the restore did not finish.', err);
      try { env.store.replaceAll(PREFIX, before); } catch (err2) { console.error('Speech Events: the old data did not go back.', err2); }
      env.ui.toast('The restore did not finish. Your data is as it was.', { kind: 'error', key: 'restore' });
      return;
    }
    checked = null;
    env.store.set(BACKUP_AT_KEY, env.now()); // everything on the device now is in the file the judge just chose
    env.reload();
    // The AI key is read once when the page loads, so an Undo that changes the key reloads the page.
    const keyChanged = before[KEYS_KEY] !== items[KEYS_KEY];
    env.ui.toast('Backup restored.', { key: 'restore', action: { label: 'Undo', name: 'Undo: restore backup', run: () => {
      env.ui.dismissToast('restore');
      try { env.store.replaceAll(PREFIX, before); }
      catch (err) { console.error('Speech Events: the data did not go back.', err); env.ui.toast('Your data did not come back. The device storage is full or blocked.', { kind: 'error', key: 'restore' }); return; }
      if (keyChanged && globalThis.location) { globalThis.location.reload(); return; }
      env.reload();
      env.ui.toast('Your data is as it was before the restore.', { key: 'restore' });
    } } });
  }

  async function onClick(e) {
    const id = e.target.id;
    if (id === 'set-offline-check') return check();
    if (id === 'set-backup') return backup();
    if (id === 'set-restore-btn') return $('#set-restore').click();
    if (id === 'set-clear') return clearDevice();
    if (id === 'set-wrap') return wrapUp();
    if (id === 'set-check-restore') return restoreChecked();
    if (id === 'set-check-close') { checked = null; draw('#set-restore-btn'); return; }
    if (id === 'set-ai-connect') { if (await askConnectKey(env.ui, env.ai.own)) draw('#set-ai-forget'); return; }
    if (id === 'set-ai-forget') { if (await askForgetKey(env.ui, env.ai.own)) { draw('#set-ai-connect'); env.ui.toast('Your AI key is gone from this browser.', { key: 'ai' }); } }
  }
  function onChange(e) {
    const t = e.target;
    if (t.id === 'set-due') {
      const n = Number(t.value);
      if (validRanksDue(n)) { env.saveSettings(withSetting(env.settings(), 'ranksDueMin', n)); env.ui.toast('Ranks are due ' + n + ' min after the last speaker.', { key: 'due' }); }
      else { t.value = String(ranksDueMinOf(env.settings())); env.ui.toast('Type a whole number of minutes from 1 to ' + RANKS_DUE_MAX + '.', { kind: 'error', key: 'due' }); }
    }
    if (t.name === 'set-gap') env.saveSettings(withSetting(env.settings(), 'drawGapMin', Number(t.value)));
    if (t.name === 'set-theme') {
      env.saveSettings(withSetting(env.settings(), 'theme', t.value));
      if (globalThis.TabulaTheme) globalThis.TabulaTheme.set(t.value);
    }
    if (t.id === 'set-restore') checkFile(t);
    if (t.name === 'set-auto') {
      const val = lifetimeValue(t.value);
      if (!env.store.set(LIFETIME_KEY, val)) return;
      if ($('#set-auto-help')) $('#set-auto-help').textContent = autoDeleteHelp(val.days);
      env.ui.toast(val.days ? 'Auto-delete is on: ' + val.days + ' days after the round.' : 'Auto-delete is off.', { key: 'auto' });
    }
  }

  return {
    scope: 'settings',
    show() {
      shown = true;
      env.el.addEventListener('click', onClick);
      env.el.addEventListener('change', onChange);
      draw('#screen-title');
      check();
      checkKept();
      showRelease();
    },
    hide() {
      shown = false;
      env.el.removeEventListener('click', onClick);
      env.el.removeEventListener('change', onChange);
    },
  };
}
