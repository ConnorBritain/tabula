// Speech Events step S2 (docs/events/EXPERIENCE.md §7, §8.5, §9): the Settings screen, #/settings. Only the parts that
// work today: Mode, Theme, Connect AI, the keyboard sheet, Ready for offline, and Data (backup and restore).
// Deferred (EXPERIENCE.md §11.1): league pack and default profile, defaults for each type, F2 draw gap and ranks-due
// minutes (S3, S4), Congress scale defaults (S6), Shared device (S8).
// The rules are in settings.js; the builders at the top are pure (Node tests call them); createSettingsScreen does the
// DOM.
import { escapeHtml as esc } from '../../core/sheets.js';
import { downloadFile } from '../../core/store.js';
import { isMacPlatform } from '../../core/keys.js';
import { MODES, THEMES, withSetting, makeBackup, backupName, readBackup, restoreItems } from './settings.js';
import { PREFIX } from './store.js';
import { keymap } from './keys.js';
import { checkOffline } from './offline.js';
import { askConnectKey, askForgetKey } from './ai-connect.js';

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
    ? `<p>Connected: ${esc(ai.providerName)}. Clean-up on the Review screen uses this key.</p><button class="b" type="button" id="set-ai-forget">Forget my key</button>`
    : `<p class="field-help">Clean-up on the Review screen can use your own API key. The key stays in this browser.</p><button class="b" type="button" id="set-ai-connect">Connect AI</button>`;
  return `<section class="set-part" aria-labelledby="set-ai-h"><h2 id="set-ai-h">AI clean-up</h2>${body}</section>`;
}

// The whole screen as HTML text. v: { settings, ai, keys (keySheetHtml), offline ({ text } or null while checking) }.
export function settingsHtml(v) {
  const s = v.settings;
  return `<div class="screen-head"><h1 id="screen-title" tabindex="-1">Settings</h1></div>
  <section class="set-part" aria-labelledby="set-mode-h"><h2 id="set-mode-h">Mode</h2>
    <fieldset class="radios"><legend class="sr-only">Mode</legend>${radios('set-mode', MODES, s.mode)}</fieldset>
    <label class="tick"><input type="checkbox" id="set-modemenu"${s.showModeMenu ? ' checked' : ''}> Show the mode menu in the header</label>
    <p class="field-help">Coach and Student screens come in a later version. For now, the mode only shows the mode menu.</p>
  </section>
  <section class="set-part" aria-labelledby="set-theme-h"><h2 id="set-theme-h">Theme</h2>
    <fieldset class="radios"><legend class="sr-only">Theme</legend>${radios('set-theme', THEMES, s.theme)}</fieldset>
  </section>
  ${aiPartHtml(v.ai)}
  <section class="set-part" aria-labelledby="set-keys-h"><h2 id="set-keys-h">Keyboard</h2>${v.keys}</section>
  <section class="set-part" aria-labelledby="set-off-h"><h2 id="set-off-h">Ready for offline</h2>
    <p id="set-offline" role="status">${esc(v.offline ? v.offline.text : 'Checking…')}</p>
    <button class="b" type="button" id="set-offline-check">Check again</button>
  </section>
  <section class="set-part" aria-labelledby="set-data-h"><h2 id="set-data-h">Data</h2>
    <p class="field-help">Your rounds stay on this device. A backup is one file you can keep or move to another device.</p>
    <div class="set-row"><button class="b" type="button" id="set-backup">Download backup</button>
      <label class="tick"><input type="checkbox" id="set-backup-keys"> Include my AI key</label></div>
    <div class="set-row"><button class="b" type="button" id="set-restore-btn">Restore from a backup</button>
      <input type="file" id="set-restore" accept=".json,application/json" hidden></div>
  </section>`;
}

// env: { el, ui, now, store, settings(), saveSettings(s), ai, reload() }.
export function createSettingsScreen(env) {
  const $ = (s) => env.el.querySelector(s);
  let offline = null;
  let shown = false;
  const mac = () => isMacPlatform(globalThis.navigator && (navigator.userAgentData ? navigator.userAgentData.platform : navigator.platform));
  const aiView = () => {
    const P = globalThis.TabulaCore.policy;
    const own = env.ai.own;
    return { allowed: P.setupAllowed(env.ai.gate), connected: own.hasKey(), providerName: own.providerName() };
  };

  function draw(focusSel) {
    env.el.innerHTML = settingsHtml({ settings: env.settings(), ai: aiView(), keys: keySheetHtml(keymap.shortcutRows(mac(), true)), offline });
    const f = focusSel && $(focusSel);
    if (f) f.focus();
  }

  async function check() {
    offline = null;
    if ($('#set-offline')) $('#set-offline').textContent = 'Checking…';
    const res = await checkOffline();
    if (!shown) return;
    offline = res;
    if ($('#set-offline')) $('#set-offline').textContent = res.text;
  }

  function backup() {
    const now = new Date(env.now()).toISOString();
    const file = makeBackup(env.store.snapshot(PREFIX), { includeKeys: $('#set-backup-keys').checked, now });
    downloadFile(backupName(now), JSON.stringify(file, null, 2), 'application/json');
    env.ui.toast('The backup file is in your downloads.', { key: 'backup' });
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
    env.reload();
    env.ui.toast('Backup restored.', { key: 'restore' });
  }

  async function onClick(e) {
    const id = e.target.id;
    if (id === 'set-offline-check') return check();
    if (id === 'set-backup') return backup();
    if (id === 'set-restore-btn') return $('#set-restore').click();
    if (id === 'set-ai-connect') { if (await askConnectKey(env.ui, env.ai.own)) draw('#set-ai-forget'); return; }
    if (id === 'set-ai-forget') { if (await askForgetKey(env.ui, env.ai.own)) { draw('#set-ai-connect'); env.ui.toast('Your AI key is gone from this browser.', { key: 'ai' }); } }
  }
  function onChange(e) {
    const t = e.target;
    if (t.name === 'set-mode') env.saveSettings(withSetting(env.settings(), 'mode', t.value));
    if (t.id === 'set-modemenu') env.saveSettings(withSetting(env.settings(), 'showModeMenu', t.checked));
    if (t.name === 'set-theme') {
      env.saveSettings(withSetting(env.settings(), 'theme', t.value));
      if (globalThis.TabulaTheme) globalThis.TabulaTheme.set(t.value);
    }
    if (t.id === 'set-restore') restore(t);
  }

  return {
    scope: 'settings',
    show() {
      shown = true;
      env.el.addEventListener('click', onClick);
      env.el.addEventListener('change', onChange);
      draw('#screen-title');
      check();
    },
    hide() {
      shown = false;
      env.el.removeEventListener('click', onClick);
      env.el.removeEventListener('change', onChange);
    },
  };
}
