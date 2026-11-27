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
import { downloadFile } from '../../core/store.js';
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
import { dataRecoveryHtml, downloadRecoveryCopy } from './data-recovery-view.js';
import { timerCueSettingsHtml, timerCueSettingChange, canVibrate } from './timer-cue-view.js';
import { LIFETIME_KEY, AUTO_DELETE_DAYS, autoDeleteDaysOf, lifetimeValue, autoDeleteHelp, autoDeletePaused, deviceSummaryText, backupSummary, backupSummaryRows, pendingPutBack, putBackRemoved, forgetRemoved, finishLifetimeRecovery, removedText, AUTO_DELETE_TOAST_KEY } from './lifetime.js';

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
  let saved;
  try { saved = env.store.snapshot(PREFIX); }
  catch { env.ui.toast('A complete backup could not be read. No file was made.', { kind: 'error', key: 'backup' }); return false; }
  const file = makeBackup(saved, { includeKeys: Boolean(includeKeys), now, release: currentRelease() });
  downloadFile(backupName(now), JSON.stringify(file, null, 2), 'application/json');
  env.store.set(BACKUP_AT_KEY, at);
  env.ui.toast('The backup file is in your downloads.', { key: 'backup' });
}

// ---------- Data: how long the data stays (lifetime.js) ----------
// The auto-delete choices: Off, then 7, 30 and 90 days.
export const AUTO_DELETE_CHOICES = Object.freeze([{ id: '0', label: 'Off' }].concat(AUTO_DELETE_DAYS.map((n) => ({ id: String(n), label: n + ' days' }))));

// The Check a backup result as HTML text. check: null, { pending }, { error }, or
// { rows (lifetime.js backupSummaryRows), here (what this device holds now, in words) }.
export function checkHtml(check) {
  if (!check) return '';
  if (check.pending) return `<div class="problems" id="set-check" role="region" aria-labelledby="set-check-h"><h3 id="set-check-h" tabindex="-1">Reading backup…</h3><button class="b" type="button" id="set-check-close">Cancel</button></div>`;
  if (check.error) {
    return `<div class="problems" id="set-check" role="region" aria-labelledby="set-check-h"><h3 id="set-check-h" tabindex="-1">${statusPillHtml('err', 'Not restored', 'triangle-alert')} This file cannot be restored</h3>
      <p>${esc(check.error)}</p><p class="field-help">Nothing on this device changed.</p>
      <div class="set-row"><button class="b" type="button" id="set-check-close">Close</button></div></div>`;
  }
  const rows = check.rows.map((r) => `<div class="ks-row"><dt>${esc(r.label)}</dt><dd>${esc(r.value)}</dd></div>`).join('');
  return `<div class="problems" id="set-check" role="region" aria-labelledby="set-check-h"><h3 id="set-check-h" tabindex="-1">This backup holds</h3>
    <dl class="ks-list">${rows}</dl>
    <p class="field-help">Nothing changes until you tap Restore. Restore replaces every round and setting on this device${check.here ? ' (now: ' + esc(check.here) + ')' : ''}.</p>
    <div class="set-row"><button class="b" type="button" id="set-check-restore">Restore</button><button class="b" type="button" id="set-check-close">Close</button></div></div>`;
}

// Is the page running as an installed app? (core/install-hint.js, shared with Tabula Debate; false where the browser
// cannot say.)
const installed = () => isStandalone();

// The whole screen as HTML text. v: { settings, ai, keys (keySheetHtml), offline ({ text } or null while checking),
// kept (keptText's line, or null while checking), release (the release id), autoDelete (0, 7, 30 or 90),
// autoPaused (auto-delete waits for the clock), putBack (lifetime.js pendingPutBack), check (checkHtml's value), recovery }.
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
  ${timerCueSettingsHtml(s, Boolean(v.vibrate))}
  ${aiPartHtml(v.ai, s)}
  <section class="set-part set-keys" aria-labelledby="set-keys-h"><details class="fold">${foldSummaryHtml('<h2 id="set-keys-h">Keyboard</h2>')}${v.keys}</details></section>
  <section class="set-part" aria-labelledby="set-off-h"><h2 id="set-off-h">Ready for offline</h2>
    <p id="set-offline" role="status">${offlineHtml(v.offline)}</p>
    <button class="b" type="button" id="set-offline-check">Check again</button>
  </section>
  <section class="set-part" aria-labelledby="set-data-h"><h2 id="set-data-h">Data</h2>
    <p class="field-help">Your rounds stay on this device. A backup lets you keep or move them.</p>
    <p class="field-help" id="set-other-tabs">Events uses one tab at a time. After an update, close or reload every other Events tab before you use these data controls. This keeps an older tab from changing the same saved data.</p>
    <p id="set-kept" role="status">${esc(v.kept || 'Checking…')}</p>
    <div class="set-row"><button class="b" type="button" id="set-backup">Download backup</button>
      <label class="tick"><input type="checkbox" id="set-backup-keys"> Include my AI key</label></div>
    <div class="set-row"><button class="b" type="button" id="set-restore-btn">Check a backup</button>
      <input type="file" id="set-restore" accept=".json,application/json" hidden></div>
    <p class="field-help">See what a backup file holds before you restore it.</p>
    ${checkHtml(v.check)}
    <h3 id="set-auto-h">Auto-delete old rounds</h3>
    <fieldset class="radios set-auto-options" aria-labelledby="set-auto-h" aria-describedby="set-auto-help">${radios('set-auto', AUTO_DELETE_CHOICES, String(v.autoDelete || 0))}</fieldset>
    <p class="field-help" id="set-auto-help">${esc(autoDeleteHelp(v.autoDelete || 0, !v.autoPaused))}</p>
    ${v.putBack ? `<div class="set-row"><span>${esc(removedText(v.putBack.rounds, v.putBack.chambers).replace(/ removed\.$/, ' removed when the app started.'))}</span><button class="b" type="button" id="set-putback">Put them back</button></div>` : ''}
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
  let checkNo = 0;
  let recovery = null; // A refused Undo can still be retried in this tab. An interrupted write also has a durable journal.
  let checked = null; // Check a backup: pending, error, or { rows, here, backup } while the result shows

  // The tab-only AI key lives in sessionStorage under the same prefix (page-ai.js), so Clear this device clears it too.
  const sessionStorage = globalThis.sessionStorage;
  env.store.journal.useSessionStorage(sessionStorage);
  const mac = () => isMacPlatform(globalThis.navigator && (navigator.userAgentData ? navigator.userAgentData.platform : navigator.platform));
  const aiView = () => {
    const P = globalThis.TabulaCore.policy;
    const own = env.ai.own;
    return { allowed: P.setupAllowed(env.ai.gate), feedbackAllowed: P.canUse(env.ai.gate, 'ballotDraft'), comparisonAllowed: P.canUse(env.ai.gate, 'analysis'), connected: own.hasKey(), providerName: own.providerName() };
  };

  function draw(focusSel) {
    if (!env.store.writer.isHeld()) return;
    const pendingRecovery = env.store.journal.state();
    if (recovery || pendingRecovery.blocked) {
      env.el.innerHTML = dataRecoveryHtml(Object.assign({}, pendingRecovery, { durable: Boolean(env.store.journal.recoveryCopy()), intent: pendingRecovery.blocked ? pendingRecovery.intent : recovery ? 'undo' : pendingRecovery.intent }), Boolean(env.store.journal.recoveryCopy() || recovery?.saved));
      $('#set-recovery-h')?.focus();
      return;
    }
    env.el.innerHTML = settingsHtml({ settings: env.settings(), ai: aiView(), keys: keySheetHtml(keymap.shortcutRows(mac(), true)), offline, kept, release: currentRelease(), vibrate: canVibrate(),
      autoDelete: autoDeleteDaysOf(env.store.get(LIFETIME_KEY, null)), autoPaused: autoDeletePaused(env.store, env.now()), putBack: pendingPutBack(), check: checked });
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

  // A partial read is not a safe original snapshot. Stop before writing or removing any data.
  function readBeforeChange() {
    try { return { saved: env.store.snapshot(PREFIX), session: env.store.journal.sessionSnapshot() }; }
    catch {
      if (env.store.journal.state().blocked) draw('#set-recovery-h');
      env.ui.toast('The complete device data could not be read. Nothing changed. Try again when storage is available.', { kind: 'error', key: 'restore' });
      return null;
    }
  }

  // The journal protects both stores before a destructive write. Session-only keys stay in sessionStorage.
  function writeSnapshot(saved, session, intent = 'change') {
    env.store.journal.write(saved, { sessionItems: session, intent });
    if (env.ai.own.reloadFromStore) env.ai.own.reloadFromStore();
  }
  function rollback(saved, session) {
    // The transaction itself already attempted rollback. Never start another write over an unresolved journal.
    return env.store.journal.matches(saved, session);
  }
  function keepRecovery(saved, session, complete = null) {
    if (!recovery) recovery = { saved, session, complete };
    draw('#set-recovery-h');
    env.ui.dismissToast('restore');
    env.ui.toast(env.store.journal.recoveryCopy() ? 'The data change did not finish. A recovery copy is saved on this device. Recover it before another change.' : 'The change did not start. Keep this tab open to retry or download the original copy.', { kind: 'error', key: 'restore' });
  }
  function blockPendingRecovery() {
    if (!env.store.writer.isHeld()) return true;
    if (!recovery && !env.store.journal.state().blocked) return false;
    draw('#set-recovery-h');
    env.ui.toast('Recover the saved copy before you change the data on this device.', { kind: 'error', key: 'restore' });
    return true;
  }
  function recover() {
    if (!recovery && !env.store.journal.state().blocked) return;
    let result;
    if (!env.store.journal.state().blocked && recovery) {
      try { writeSnapshot(recovery.saved, recovery.session, 'undo'); result = { ok: true, phase: 'after' }; }
      catch { result = { ok: false }; }
    } else result = env.store.journal.recover({ retryUndo: true });
    if (!result.ok) {
      draw('#set-recovery-h');
      env.ui.toast('Recovery did not finish. The saved copy remains on this device.', { kind: 'error', key: 'restore' });
      return;
    }
    completeRecovery(result);
  }
  function completeRecovery(result) {
    const pending = recovery;
    recovery = null; checked = null; checkNo++;
    finishLifetimeRecovery(result);
    if (env.ai.own.reloadFromStore) env.ai.own.reloadFromStore();
    if (result.phase === 'after' && pending?.complete) { pending.complete(); if (shown) draw('#screen-title'); return; }
    env.reload();
    if (shown) draw('#screen-title');
    env.ui.dismissToast('restore');
    env.ui.toast(result.phase === 'after' ? 'Your last change is saved.' : 'Your original data is back.', { key: 'restore' });
  }
  function downloadRecovery() {
    if (downloadRecoveryCopy(env.store.journal, env.now(), recovery?.saved)) env.ui.toast('The recovery backup file is in your downloads.', { key: 'backup' });
  }


  // Clear this device: every tabulaEvents.* value in this browser (localStorage and this tab's sessionStorage). The
  // store's prefix guard (core/store.js) means it can never touch Tabula Debate's keys. The toast's Undo puts it all
  // back while the tab is open; once the tab closes, the data is gone.
  // from: 'saved' or 'skipped' when Wrap up the season leads here (the backup step is done, or skipped on purpose), so
  // the dialog says so and does not offer the backup again.
  async function clearDevice(from) {
    if (blockPendingRecovery()) return;
    const wrap = from === 'saved' || from === 'skipped';
    const pick = await env.ui.ask({
      title: 'Clear this device?',
      body: wrap
        ? ['This removes ' + CLEAR_WHAT, from === 'saved' ? 'Your backup is saved. Use Check a backup to restore it on any device.' : 'You skipped the backup. Once this tab closes, your rounds cannot come back.', 'Tabula Debate data on this browser is not touched.']
        : ['This removes ' + CLEAR_WHAT, 'Download a backup first if you want to keep them. Tabula Debate data on this browser is not touched.'],
      buttons: wrap
        ? [{ label: 'Cancel', value: null }, { label: 'Clear this device', value: 'clear', kind: 'danger' }]
        : [{ label: 'Cancel', value: null }, { label: 'Download backup first', value: 'backup' }, { label: 'Clear this device', value: 'clear', kind: 'danger' }],
      cancelValue: null,
    });
    if (blockPendingRecovery()) return;
    if (pick === 'backup') { backup(); return; }
    if (pick !== 'clear') return;
    const prior = readBeforeChange();
    if (!prior) return;
    const before = prior.saved, beforeTab = prior.session;
    const hadKey = KEYS_KEY in before || KEYS_KEY in beforeTab;
    try {
      writeSnapshot({}, {});
    } catch (err) {
      console.error('Speech Events: Clear this device did not finish.', err);
      if (!rollback(before, beforeTab)) { keepRecovery(before, beforeTab, err.committed ? finishClear : null); return; }
      env.ui.toast('Clearing did not finish. Your data is as it was. Try again.', { kind: 'error', key: 'clear' });
      return;
    }
    finishClear();
    function finishClear() {
      env.ai.own.forget({ memoryOnly: true }); // Persistence is committed; clear only the runtime key.
      recovery = null; checked = null; checkNo++;
      forgetRemoved(); // Only a successful clear discards the pending auto-delete recovery.
      env.ui.dismissToast(AUTO_DELETE_TOAST_KEY);
      env.reload(); // the theme, the header and the screen read the empty data (the theme goes back to the default)
      // A prior same-key message has no current action; replace it with this operation's fresh Undo.
      env.ui.dismissToast('clear');
      env.ui.toast('Speech Events data is gone from this browser.', { key: 'clear', action: { label: 'Undo', name: 'Undo: clear this device', run: () => {
        if (blockPendingRecovery()) return;
        env.ui.dismissToast('clear');
        try { writeSnapshot(before, beforeTab, 'undo'); }
        catch (err) { console.error('Speech Events: the data did not go back.', err); keepRecovery(before, beforeTab); return; }
        // The AI key is read once when the page loads, so a page that had one reloads to pick it up again.
        if (hadKey && globalThis.location) { globalThis.location.reload(); return; }
        env.reload();
        env.ui.toast('Your data is back.', { key: 'clear' });
      } } });
    }
  }

  // Wrap up the season: save a backup, ask whether it saved, then offer Clear this device. It never clears unless the
  // backup step is done or the judge skips it on purpose; Cancel at any step changes nothing.
  async function wrapUp() {
    if (blockPendingRecovery()) return;
    const first = await env.ui.ask({
      title: 'Wrap up the season',
      body: ['First, save a backup. It holds every round, comment and setting, so you can restore them later.', 'Then you can clear this device.'],
      buttons: [{ label: 'Cancel', value: null }, { label: 'Skip the backup', value: 'skip' }, { label: 'Download backup', value: 'backup', kind: 'primary' }],
      cancelValue: null,
    });
    if (blockPendingRecovery()) return;
    if (first === 'skip') return clearDevice('skipped');
    if (first !== 'backup') return;
    for (;;) {
      if (backup() === false) return;
      const saved = await env.ui.ask({
        title: 'Did the backup save?',
        body: ['Look in your downloads for ' + backupName(new Date(env.now()).toISOString()) + '.',
          $('#set-backup-keys') && $('#set-backup-keys').checked ? 'Your AI key is in the file. Keep the file private.' : 'Your AI key is not in the file. Clearing this device removes it.',
          'Move the file off this device (email it to yourself or copy it to a drive) before you clear.'],
        buttons: [{ label: 'Cancel', value: null }, { label: 'Download again', value: 'again' }, { label: 'Yes, it saved', value: 'saved', kind: 'primary' }],
        cancelValue: null,
      });
      if (blockPendingRecovery()) return;
      if (saved === 'saved') return clearDevice('saved');
      if (saved !== 'again') return;
    }
  }

  // What this device holds now, in words, for the Check a backup result.
  const hereText = () => deviceSummaryText(backupSummary({ storage: env.store.snapshot(PREFIX) }));

  // Check a backup: read the file and show what it holds. Nothing is written here; Restore does that.
  async function checkFile(input) {
    const file = input.files && input.files[0];
    input.value = '';
    if (!file) return;
    const no = ++checkNo;
    checked = { pending: true }; draw('#set-check-h');
    let text;
    try { text = await file.text(); }
    catch {
      if (no !== checkNo || !shown) return;
      checked = { error: 'This file could not be read. Pick the backup file again.' }; draw('#set-check-h'); return;
    }
    if (no !== checkNo || !shown) return;
    try { const b = readBackup(text); checked = { backup: b, rows: backupSummaryRows(backupSummary(b)), here: hereText() }; }
    catch (err) { checked = { error: err.message }; }
    draw('#set-check-h');
  }

  // Restore the checked backup, after one confirm (it replaces everything, like Clear this device). Undo in the toast
  // puts this device back as it was while the tab is open.
  async function restoreChecked() {
    const b = checked && checked.backup;
    if (!b || recovery || env.store.journal.state().blocked) return;
    const ok = await env.ui.ask({
      title: 'Restore this backup?',
      body: ['It replaces every round and setting on this device (now: ' + hereText() + ').', 'You can undo it while this tab is open.'],
      buttons: [{ label: 'Cancel', value: false }, { label: 'Replace my data', value: true, kind: 'danger' }],
      cancelValue: false,
    });
    if (blockPendingRecovery()) return;
    if (!ok || !checked || checked.backup !== b) return; // Cancel, or the judge closed or changed the check meanwhile
    const prior = readBeforeChange();
    if (!prior) return;
    const before = prior.saved, beforeTab = prior.session;
    const sessionItems = Object.assign({}, beforeTab);
    if (b.includesKeys && KEYS_KEY in b.storage) delete sessionItems[KEYS_KEY];
    const items = restoreItems(before, b);
    items[BACKUP_AT_KEY] = JSON.stringify(env.now());
    // The device keeps its own auto-delete choice: an old file with auto-delete on must not remove the rounds it brings.
    if (LIFETIME_KEY in before) items[LIFETIME_KEY] = before[LIFETIME_KEY]; else delete items[LIFETIME_KEY];
    try { writeSnapshot(items, sessionItems); }
    catch (err) {
      console.error('Speech Events: the restore did not finish.', err);
      if (!rollback(before, beforeTab)) { keepRecovery(before, beforeTab, err.committed ? finishRestore : null); return; }
      env.ui.toast('The restore did not finish. Your data is as it was.', { kind: 'error', key: 'restore' });
      return;
    }
    finishRestore();
    function finishRestore() {
      checked = null; checkNo++; recovery = null;
      forgetRemoved();
      env.ui.dismissToast(AUTO_DELETE_TOAST_KEY);
      env.reload();
      // The AI key is read once when the page loads, so an Undo that changes the key reloads the page.
      const keyChanged = before[KEYS_KEY] !== items[KEYS_KEY];
      // A prior same-key message has no current action; replace it with this operation's fresh Undo.
      env.ui.dismissToast('restore');
      env.ui.toast('Backup restored.', { key: 'restore', action: { label: 'Undo', name: 'Undo: restore backup', run: () => {
        if (blockPendingRecovery()) return;
        env.ui.dismissToast('restore');
        try { writeSnapshot(before, beforeTab, 'undo'); }
        catch (err) { console.error('Speech Events: the data did not go back.', err); keepRecovery(before, beforeTab); return; }
        if (keyChanged && globalThis.location) { globalThis.location.reload(); return; }
        env.reload();
        env.ui.toast('Your data is as it was before the restore.', { key: 'restore' });
      } } });
    }
  }

  async function onClick(e) {
    const id = e.target.id;
    if (id === 'set-offline-check') return check();
    if (id === 'set-backup') return backup();
    if (id === 'set-restore-btn') return $('#set-restore').click();
    if (id === 'set-clear') return clearDevice();
    if (id === 'set-wrap') return wrapUp();
    if (id === 'set-putback') { if (putBackRemoved({ store: env.store, ui: env.ui, refresh: () => env.reload() })) draw('input[name="set-auto"]:checked'); return; }
    if (id === 'set-check-restore') return restoreChecked();
    if (id === 'set-check-close') { checkNo++; checked = null; draw('#set-restore-btn'); return; }
    if (id === 'set-recover') return recover();
    if (id === 'set-recovery-backup') return downloadRecovery();
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
    if (t.id === 'set-restore') return checkFile(t);
    if (t.name === 'set-auto') {
      const val = lifetimeValue(t.value);
      if (!env.store.set(LIFETIME_KEY, val)) return;
      if ($('#set-auto-help')) $('#set-auto-help').textContent = autoDeleteHelp(val.days, !autoDeletePaused(env.store, env.now()));
      env.ui.toast(val.days ? 'Auto-delete is on: ' + val.days + ' days after the round.' : 'Auto-delete is off.', { key: 'auto' });
    }
    timerCueSettingChange(env, t);
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
    finishRecovery(result) {
      if (!recovery) return false;
      completeRecovery(result);
      return true;
    },
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
      shown = false; checkNo++; checked = null;
      env.el.removeEventListener('click', onClick);
      env.el.removeEventListener('change', onChange);
      env.el.removeEventListener('input', onInput);
    },
  };
}
