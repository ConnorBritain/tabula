// Speech Events step S2 (docs/events/EXPERIENCE.md §7, §8.5, §9): the Settings screen, #/settings. Only the parts that
// work today: Mode, Theme, Ranks due (step S3, the minutes after the last speaker, §5.3), the extemp draw gap (step
// S4), Connect AI, the keyboard sheet, Ready for offline, and Data (whether the browser keeps the data, backup, restore,
// and Clear this device), and About (the release id, Send feedback, known issues and the link to the source code).
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
import { isStandalone } from '../../core/install-hint.js';
import { KEYS_KEY } from './ai-key.js';
import { keymap } from './keys.js';
import { checkOffline, CACHE_PREFIX } from './offline.js';
import { askConnectKey, askForgetKey } from './ai-connect.js';
import { mountTipsPart } from './help/help-view.js';
import { EDIT_MODES, editDefaults } from './edit-options.js';
import { PREFERENCE_LIMIT, cleanPreferenceText as roomPriorities } from '../../core/ai-preferences.js';
import { preferencesHtml, bindPreferences } from '../../core/ai-preferences.js';

const FEEDBACK_SCOPE = [{ id: 'defaults', label: 'Feedback', guidance: false }];

const radios = (name, list, picked) => list.map((x) => `<label class="radio"><input type="radio" name="${name}" value="${esc(x.id)}"${x.id === picked ? ' checked' : ''}> ${esc(x.label)}</label>`).join('');

// The keyboard sheet as HTML text. groups: keymap.shortcutRows(mac, ...).
export function keySheetHtml(groups) {
  return groups.map((g) => `<h3>${esc(g.group)}</h3><dl class="ks-list">${g.rows.map((r) => `<div class="ks-row"><dt>${esc(r.label)}</dt><dd><kbd>${esc(r.keys)}</kbd></dd></div>`).join('')}</dl>`).join('');
}

// The AI part as HTML text. ai: { allowed (the gate lets the judge set up a key), connected, providerName }. With AI
// setup not allowed, the part is not built at all (AI-POLICY.md §3: removed means gone).
export function aiPartHtml(ai, settings = {}) {
  if (!ai || !ai.allowed) return '';
  const edit = editDefaults(settings.feedbackEdit);
  const defaults = `<div class="edit-defaults"><label class="field" for="set-edit-default">Default AI edit<select id="set-edit-default">${EDIT_MODES.map((m) => `<option value="${m.id}"${edit.mode === m.id ? ' selected' : ''}>${esc(m.label)}</option>`).join('')}</select></label>
    <div id="set-edit-request-wrap"${edit.mode === 'custom' ? '' : ' hidden'}><label class="field" for="set-edit-request">Saved wording request<textarea id="set-edit-request" rows="3" maxlength="${PREFERENCE_LIMIT}">${esc(edit.request)}</textarea></label></div>
    <p class="field-help">The star runs this edit using your saved feedback style. Your words stay until you accept the suggestion.</p><p class="field-help" id="set-edit-status" role="status"></p><details class="fold">${foldSummaryHtml('About AI editing')}<p class="field-help">Your words go to the AI provider you connect with your own key. Known codes, names, titles and authors are swapped out first. A name you wrote only in your notes is sent as you wrote it. Other private details in your request or preferences are sent as written.</p></details></div>`;
  const body = ai.connected
    ? `<p>Connected: ${esc(ai.providerName)}.</p><button class="b" type="button" id="set-ai-forget">Forget my key</button>`
    : `<p class="field-help">Use your own AI key to edit feedback. The key stays in this browser.</p><button class="b" type="button" id="set-ai-connect">Connect AI</button>`;
  const judging = ai.comparisonAllowed === true ? `<details class="fold room-judging-settings">${foldSummaryHtml('Room comparison')}<label class="field" for="set-room-priorities">Judging priorities<textarea id="set-room-priorities" rows="3" maxlength="${PREFERENCE_LIMIT}" placeholder="For example: Give clear reasoning more weight than polish.">${esc(roomPriorities(settings.roomJudging?.priorities))}</textarea></label><p class="field-help">Optional. Compare the room follows the event criteria first. These priorities guide the comparison, not feedback wording. Your final ranks stay yours.</p><p class="field-help">Only use AI review where the tournament permits it. Public notes and these priorities go to your connected provider. Known names and codes are replaced first. Private notes stay on this device.</p><p class="field-help" id="set-room-status" role="status"></p></details>` : '';
  return `<section class="set-part" aria-labelledby="set-ai-h"><h2 id="set-ai-h">AI editing</h2>${body}${ai.feedbackAllowed === false ? '' : defaults}<div id="event-ai-preferences">${ai.feedbackAllowed === false ? '' : preferencesHtml({ id: 'event-pref', scopes: FEEDBACK_SCOPE, title: 'Feedback preferences', summary: foldSummaryHtml })}</div>${judging}</section>`;
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
    <p><a id="set-kit" href="kit/index.html">Print a judge card</a></p>
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

// Is the page running as an installed app? (core/install-hint.js, shared with Tabula Debate; false where the browser
// cannot say.)
const installed = () => isStandalone();

// The whole screen as HTML text. v: { settings, ai, keys (keySheetHtml), offline ({ text } or null while checking),
// kept (keptText's line, or null while checking), release (the release id) }.
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
  ${aiPartHtml(v.ai, s)}
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
    <div class="set-row"><button class="b" type="button" id="set-restore-btn">Restore from a backup</button>
      <input type="file" id="set-restore" accept=".json,application/json" hidden></div>
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
  // The tab-only AI key lives in sessionStorage under the same prefix (page-ai.js), so Clear this device clears it too.
  const tab = createStore({ prefixes: [PREFIX], storage: globalThis.sessionStorage });
  const mac = () => isMacPlatform(globalThis.navigator && (navigator.userAgentData ? navigator.userAgentData.platform : navigator.platform));
  const aiView = () => {
    const P = globalThis.TabulaCore.policy;
    const own = env.ai.own;
    return { allowed: P.setupAllowed(env.ai.gate), feedbackAllowed: P.canUse(env.ai.gate, 'ballotDraft'), comparisonAllowed: P.canUse(env.ai.gate, 'analysis'), connected: own.hasKey(), providerName: own.providerName() };
  };

  function draw(focusSel) {
    env.el.innerHTML = settingsHtml({ settings: env.settings(), ai: aiView(), keys: keySheetHtml(keymap.shortcutRows(mac(), true)), offline, kept, release: currentRelease() });
    mountTipsPart(env, env.el);
    const preferences = $('#event-ai-preferences');
    if (preferences && aiView().feedbackAllowed) bindPreferences(preferences, {
      scopes: FEEDBACK_SCOPE, read: () => env.settings().aiPreferences,
      write: (value) => env.saveSettings(withSetting(env.settings(), 'aiPreferences', value)),
    });
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
  async function clearDevice() {
    const pick = await env.ui.ask({
      title: 'Clear this device?',
      body: ['This removes ' + CLEAR_WHAT, 'Download a backup first if you want to keep them. Tabula Debate data on this browser is not touched.'],
      buttons: [{ label: 'Cancel', value: null }, { label: 'Download backup first', value: 'backup' }, { label: 'Clear this device', value: 'clear', kind: 'danger' }],
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

  async function restore(input) {
    const file = input.files && input.files[0];
    input.value = '';
    if (!file) return;
    let b;
    try { b = readBackup(await file.text()); }
    catch (err) { env.ui.toast(err.message, { kind: 'error', key: 'restore' }); return; }
    const when = b.exportedAt ? b.exportedAt.slice(0, 10) : 'an unknown day';
    const ok = await env.ui.ask({
      title: 'Restore this backup?',
      body: ['It has ' + b.rounds + (b.rounds === 1 ? ' round' : ' rounds') + ', saved on ' + when + '.', 'It replaces every round and setting on this device. Download a backup first if you want to keep them.'],
      buttons: [{ label: 'Cancel', value: false }, { label: 'Replace my data', value: true, kind: 'danger' }],
      cancelValue: false,
    });
    if (!ok) return;
    const before = env.store.snapshot(PREFIX);
    try { env.store.replaceAll(PREFIX, restoreItems(before, b)); }
    catch (err) {
      console.error('Speech Events: the restore did not finish.', err);
      try { env.store.replaceAll(PREFIX, before); } catch (err2) { console.error('Speech Events: the old data did not go back.', err2); }
      env.ui.toast('The restore did not finish. Your data is as it was.', { kind: 'error', key: 'restore' });
      return;
    }
    env.store.set(BACKUP_AT_KEY, env.now()); // everything on the device now is in the file the judge just chose
    env.reload();
    env.ui.toast('Backup restored.', { key: 'restore' });
  }

  async function onClick(e) {
    const id = e.target.id;
    if (id === 'set-offline-check') return check();
    if (id === 'set-backup') return backup();
    if (id === 'set-restore-btn') return $('#set-restore').click();
    if (id === 'set-clear') return clearDevice();
    if (id === 'set-ai-connect') { if (await askConnectKey(env.ui, env.ai.own)) draw('#set-ai-forget'); return; }
    if (id === 'set-ai-forget') { if (await askForgetKey(env.ui, env.ai.own)) { draw('#set-ai-connect'); env.ui.toast('Your AI key is gone from this browser.', { key: 'ai' }); } }
  }
  function onChange(e) {
    const t = e.target;
    if (t.id === 'set-edit-default') {
      const old = editDefaults(env.settings().feedbackEdit);
      // A blank custom default starts with a useful wording request that can be changed below.
      const request = old.request || 'Use short, direct sentences.';
      const ok = env.saveSettings(withSetting(env.settings(), 'feedbackEdit', { mode: t.value, request }));
      $('#set-edit-request-wrap').hidden = t.value !== 'custom';
      $('#set-edit-request').value = request;
      $('#set-edit-status').textContent = ok === false ? 'Could not save. Try again.' : 'Saved.';
    }
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
    if (t.id === 'set-restore') restore(t);
  }

  const onInput = (e) => {
    if (e.target.id === 'set-room-priorities') {
      const P = globalThis.TabulaCore.policy;
      if (!P.canUse(env.ai.gate, 'analysis') || !P.setupAllowed(env.ai.gate)) return;
      const ok = env.saveSettings(withSetting(env.settings(), 'roomJudging', { priorities: e.target.value }));
      $('#set-room-status').textContent = ok === false ? 'Could not save. Try again.' : 'Saved.';
      return;
    }
    if (e.target.id !== 'set-edit-request') return;
    const value = { mode: $('#set-edit-default').value, request: e.target.value };
    const ok = env.saveSettings(withSetting(env.settings(), 'feedbackEdit', value));
    $('#set-edit-status').textContent = ok === false ? 'Could not save. Try again.' : value.request.trim() ? 'Saved.' : 'Add a request. Until then, the star uses Clarify.';
  };
  return {
    scope: 'settings',
    show() {
      shown = true;
      env.el.addEventListener('click', onClick);
      env.el.addEventListener('change', onChange);
      env.el.addEventListener('input', onInput);
      draw('#screen-title');
      check();
      checkKept();
      showRelease();
    },
    hide() {
      shown = false;
      env.el.removeEventListener('click', onClick);
      env.el.removeEventListener('change', onChange);
      env.el.removeEventListener('input', onInput);
    },
  };
}
