// Shared by startup quarantine and Settings. This view reads only a verified journal copy, never partial live data.
import { escapeHtml as esc } from '../../core/sheets.js';
import { downloadFile } from '../../core/store.js';
import { makeBackup, backupName } from './settings.js';

export function dataRecoveryHtml(info, canDownload = true) {
  const committed = info.phase === 'after';
  const undo = info.intent === 'undo';
  const durable = info.durable !== false;
  const title = committed ? 'Finish your saved change' : undo ? 'Finish Undo' : 'Recover device data';
  const text = committed ? 'Your last change was saved. Recovery cleanup must finish before you make another change.'
    : undo ? 'Undo did not finish. The data from before Undo is protected. The older copy you requested is also saved. Put it back to finish Undo.'
      : 'The last change did not finish. A recovery copy is saved on this device. Recover it before you make another change.';
  const issue = info.error === 'session_journal_missing' ? 'The recovery copy for this tab is missing. The key from this tab cannot be recovered here. Download the original device backup before you close this tab.'
    : info.error ? 'The browser cannot read or finish the recovery copy now. Check that storage is available, then retry.' : '';
  return `<section class="set-part" id="set-recovery" aria-labelledby="set-recovery-h"><h1 id="set-recovery-h" tabindex="-1">${esc(title)}</h1>
    <p>${esc(durable ? text : 'The change could not finish. Keep this tab open until you recover or download the original copy.')}</p>${issue ? `<p>${esc(issue)}</p>` : ''}
    <div class="set-row"><button class="b" type="button" id="set-recover">${committed ? 'Finish recovery' : 'Put original data back'}</button>
    ${canDownload ? '<button class="b" type="button" id="set-recovery-backup">Download original backup</button>' : ''}</div>
    <p class="field-help">${durable ? 'Recovery survives a reload.' : 'A new recovery copy could not be verified on this device. Keep this tab open.'} The downloaded copy does not include AI keys. A key kept only in a closed tab stays forgotten.</p></section>`;
}
export function downloadRecoveryCopy(journal, now = Date.now(), fallback = null) {
  const saved = journal.recoveryCopy() || fallback;
  if (!saved) return false;
  const at = new Date(now).toISOString();
  const file = makeBackup(saved, { now: at, includeKeys: false });
  downloadFile(backupName(at), JSON.stringify(file, null, 2), 'application/json');
  return true;
}
export function createDataRecoveryView({ el, journal, ui, onRecovered }) {
  const click = (event) => {
    if (event.target.id === 'set-recovery-backup') downloadRecoveryCopy(journal);
    if (event.target.id !== 'set-recover') return;
    const result = journal.recover({ retryUndo: true });
    if (result.ok) { hide(); onRecovered(result); }
    else { show(); ui.toast('Recovery did not finish. The saved recovery copy is still on this device.', { kind: 'error', key: 'restore' }); }
  };
  function show() {
    el.innerHTML = dataRecoveryHtml(Object.assign({}, journal.state(), { durable: Boolean(journal.recoveryCopy()) }), Boolean(journal.recoveryCopy()));
    el.removeEventListener('click', click); el.addEventListener('click', click);
    el.querySelector('#set-recovery-h')?.focus();
  }
  function hide() { el.removeEventListener('click', click); }
  return { scope: 'recovery', show, hide };
}
