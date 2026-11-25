// Page rules from Slices 0 to 3: round safety, copy and dialogs, the shared UI rules, and the visual system.
// One part of logic.js (pure logic, no DOM). logic.js joins the parts into one API; index.html loads the parts first.
(function (root) {
  'use strict';
  const part = (name) => (typeof module !== 'undefined' && module.exports ? require('./' + name + '.js') : root.PolicyLogicParts[name]);
  const F = part('format');
  const { speechColumn } = part('flow');
  const { KEYS_ENTRY, OLD_KEY_ENTRIES } = part('files');
  // The shared UI rules (core/ui.js, an ES module): the page runs it before this file; Node requires it.
  const { escTop, TOAST_MAX, toastPlan, askFirstFocus, trapNext, toastMs, askInputState } = typeof module !== 'undefined' && module.exports ? require('../core/ui.js') : root.TabulaCore.ui;
  // The shared clock math (core/clock.js, an ES module): the page runs it before this file; Node requires it.
  const { OVER_LIMIT, restoreTimer, prepWins, beepDecision, leftAt } = typeof module !== 'undefined' && module.exports ? require('../core/clock.js') : root.TabulaCore.clock;

  // ---------- Slice 1: round safety (docs/design/SPEC.md §3.1) ----------
  // The clock math (OVER_LIMIT, restoreTimer, prepWins, beepDecision) is shared code in core/clock.js.
  // These wrappers find the speech or the prep clock in the round's format and pass its length in.

  // 1.1 The speech clock after a reload, a crash or sleep. run = { id, endAt, ... } as saved with the round.
  // fmt: the round's format (policy-hs when not given).
  function restoreRun(run, now, speechLength, fmt) {
    if (!run || typeof run !== 'object') return { state: 'none' };
    const s = F.speechOf(fmt || F.POLICY, run.id);
    if (!s) return { state: 'none' };
    const len = Number.isFinite(speechLength) ? speechLength : s.minutes * 60;
    const r = restoreTimer(run, now, { length: len, kind: 'speech' });
    return r.state === 'none' ? r : Object.assign({ id: s.id }, r);
  }

  // 1.1b A prep clock after a reload. prepRun = { side, endAt }: side is the prep clock's id (a side for prep per team,
  // a debater for prep per debater; F.prepClocks). maxSeconds = the round's prep per clock. clockIds: the format's
  // prep clock ids (the two sides when not given).
  function restorePrep(prepRun, now, maxSeconds, clockIds) {
    if (!prepRun || typeof prepRun !== 'object') return { state: 'none' };
    if (!(clockIds || ['aff', 'neg']).includes(prepRun.side)) return { state: 'none' };
    const r = restoreTimer(prepRun, now, { length: maxSeconds, kind: 'prep' });
    return r.state === 'none' ? r : Object.assign({ side: prepRun.side }, r);
  }

  // Both clocks at once. Only one may run: prep wins (core/clock.js prepWins).
  function restoreClocks(run, prepRun, now, maxPrepSeconds, speechLength, fmt) {
    const speech = restoreRun(run, now, speechLength, fmt);
    const prep = restorePrep(prepRun, now, maxPrepSeconds, fmt ? F.prepClocks(fmt).map((c) => c.id) : undefined);
    const won = prepWins(speech, prep);
    return { speech: won === speech ? speech : Object.assign({ id: speech.id }, won), prep };
  }

  // A failed localStorage write: 'full' (the quota is used up) or 'blocked' (the browser refuses storage).
  function storageErrorKind(err) {
    const name = err && err.name;
    const code = err && err.code;
    if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' || code === 22 || code === 1014) return 'full';
    return 'blocked';
  }

  // Two tabs on one round: the clock fields (run, prepRun, timeLeft, prepLeft) are one unit with one savedAt.
  // The unit with the newer savedAt wins. Returns true when the incoming unit should replace ours.
  function clockUnitIsNewer(ours, incoming) {
    if (!incoming || typeof incoming !== 'object') return false;
    const a = Number((ours && ours.savedAt) || 0), b = Number(incoming.savedAt || 0);
    return Number.isFinite(b) && b > a;
  }

  // 1.2 View only. The short name of a speech on a label: "1NC", "CX 1A".
  const shortSpeech = (id) => String(id).replace('CX-', 'CX ');
  // The label while the judge looks at one speech and another one's clock runs. null when not viewing.
  function viewingLabel(viewedId, runningId) {
    if (!runningId || !viewedId || viewedId === runningId) return null;
    const v = shortSpeech(viewedId), r = shortSpeech(runningId);
    return { text: 'Viewing ' + v + ' · ' + r + ' running', back: 'Back to ' + r, sr: 'Viewing ' + v + '. ' + r + ' is still running.' };
  }

  // 1.5 How the speeches pane works at this window width (spec 1.5 table).
  function leftPaneMode(width, hideLeft) {
    if (width >= 1440) return hideLeft ? 'hidden' : 'inline';
    if (width >= 820) return 'overlay-closed';
    return 'stacked';
  }

  // 1.6 The recording notice shows the first time on this device that recording would start.
  function needsRecNotice(settings) {
    const s = settings || {};
    return !s.recConsentAt;
  }
  // 1.6 The "Recording" strip in the header. Returns { hidden } or { text, button } (button: 'stop' or 'resume').
  // st: { recWanted, live, stoppedByReload, speechId, online, engine ('browser' or a provider id), narrow }
  function recStripState(st) {
    const s = st || {};
    if (s.stoppedByReload && !s.recWanted) return { text: 'Recording stopped when the page reloaded. Words spoken since then were not recorded.', button: 'resume', buttonLabel: 'Resume recording' };
    if (!s.recWanted) return { hidden: true };
    if (!s.live) return { text: 'Starting microphone…', button: 'stop', buttonLabel: s.narrow ? 'Stop' : 'Stop recording' };
    let text = 'Recording · ' + shortSpeech(s.speechId || '');
    if (s.online === false) text += s.engine === 'browser' ? ' · no text while offline' : ' · text waits for the internet';
    return { text, dot: true, button: 'stop', buttonLabel: s.narrow ? 'Stop' : 'Stop recording' };
  }

  // Has the stored copy of the round already beeped for this same run? A second tab on the round reads it
  // before it beeps, so two open tabs give one beep, not two.
  function beepedElsewhere(stored, run) {
    const o = stored && stored.run;
    return Boolean(o && run && o.id === run.id && o.endAt === run.endAt && o.beeped);
  }

  // ---------- Slice 2: copy and dialogs (docs/design/SPEC.md §3.2) ----------
  // The one "no AI" line (spec 2.2). Every place that needs AI says exactly this.
  const NO_AI = 'No AI is connected. Connect one in Settings.';

  // The first-time welcome shows only to free users who have not finished it (spec 2.1, Q11). hostedPlan: the
  // capabilities gate says AI runs without a key (L.hasHostedPlan, logic/hosted.js).
  function shouldShowWelcome(o) {
    const s = o || {};
    return !s.hostedPlan && !s.setupDone;
  }

  // One classifier for every failed AI or transcription call (spec 2.3). The rules run in this order.
  // e: { status, name, message, online, stop: 'refusal' | 'max_tokens', helper: true when the call went to the local helper }.
  const QUOTA_RE = /quota|credit|billing|balance|insufficient/i;
  function classifyAIError(e) {
    const x = e || {};
    const status = Number(x.status) || 0;
    if (x.online === false) return 'offline';
    if (x.name === 'TimeoutError') return 'timeout';
    // A fetch that never got a reply throws a TypeError. To the local helper that means the helper is down (rule 8).
    // So helper calls (helper: true, only the /api/ai call in app.js callAI) skip rule 3. Without this, spec order
    // would make every helper failure "noReply" and rule 8 could never fire. Helper 4xx and 5xx replies still use
    // rules 4 to 6 (for example a 5xx from the helper is "busy"); that is a known trade-off.
    if (x.name === 'TypeError' && !x.helper) return 'noReply';
    if (status === 401 || status === 403) return 'keyRejected';
    if (status === 429 && QUOTA_RE.test(String(x.message || ''))) return 'noCredit';
    if (status === 429 || status === 408 || (status >= 500 && status < 600)) return 'busy';
    if (status === 404) return 'modelGone';
    if (x.stop === 'refusal') return 'refused';
    if (x.stop === 'max_tokens') return 'cutOff';
    if (x.helper && (x.name === 'TypeError' || status === 0)) return 'helperDown';
    return 'other';
  }
  // The text for each kind. {provider} is the provider of the judge's own key; it is the only name copy may hold.
  const AI_ERROR_TEXT = {
    offline: 'You are offline. AI and transcription will start again when the internet is back. Your flow is saved on this device.',
    noReply: 'No reply from {provider}. Check your internet. If the internet works, test the key in Settings.',
    timeout: 'The AI took too long to answer. Try again.',
    keyRejected: 'The {provider} key was rejected. Paste it again in Settings, or make a new key.',
    noCredit: "The {provider} key works, but its account has no credit. Add credit on the provider's site.",
    busy: 'The AI service is busy. Wait a moment and try again.',
    modelGone: 'That AI model is no longer offered. Tabula will pick another. Try again.',
    refused: 'The AI would not answer this request. Decide by hand, or change the input and try again.',
    cutOff: "The AI's reply was cut off. Try again.",
    helperDown: 'The helper on this computer is not running. In the Tabula folder, run node bridge.mjs, then try again.',
    other: 'The AI did not answer{status}. Try again. If it keeps failing, test the key in Settings.', // CHANGED 2026-11-20: was "The AI call failed" (owner: no "call" jargon)
  };
  function aiErrorText(kind, opts) {
    const o = opts || {};
    const t = AI_ERROR_TEXT[kind] || AI_ERROR_TEXT.other;
    const status = Number(o.status) ? ' (error ' + Number(o.status) + ')' : '';
    return t.replace('{provider}', o.provider || 'the AI provider').replace('{status}', status);
  }
  // Each feature puts its name in front of the error text.
  const AI_ERROR_PREFIX = { flow: 'AI flow:', eval: 'Live Eval:', analysis: 'Analysis:', ballot: 'Ballot draft:', transcript: 'Transcript:', decision: 'Decision draft:' };

  // Shared Undo helpers (spec 2.4). removeAt never changes the list it gets.
  // Returns { list, undo: { index, item } }; restoreAt(list, undo.index, undo.item) puts the item back in its place.
  function removeAt(list, i) {
    const l = Array.isArray(list) ? list.slice() : [];
    if (!(i >= 0 && i < l.length)) return { list: l, undo: null };
    const [item] = l.splice(i, 1);
    return { list: l, undo: { index: i, item } };
  }
  function restoreAt(list, i, item) {
    const l = Array.isArray(list) ? list.slice() : [];
    l.splice(Math.max(0, Math.min(Number(i) || 0, l.length)), 0, item);
    return l;
  }

  // Keys are not remembered by default (spec 2.6, D1). A saved choice wins. With no saved choice, a judge who
  // already has stored keys keeps them (they came from the old default), so no current user loses a key.
  function resolveRememberKeys(saved, hasStoredKeys) {
    if (typeof saved === 'boolean') return saved;
    return Boolean(hasStoredKeys);
  }
  // Restoring a backup that holds keys (spec 2.6, Q-3). entries: the backup's storage { name: raw string }.
  // Returns { local, session }. With Remember off, the keys go to this tab only (session), never to localStorage.
  // The restored settings take this browser's Remember choice, so the next load keeps the keys where they are.
  function splitRestoreKeys(entries, remember, settingsEntry) {
    const local = Object.assign({}, entries || {});
    const session = {};
    const names = [KEYS_ENTRY, ...OLD_KEY_ENTRIES].filter((k) => k in local);
    if (!names.length) return { local, session };
    if (settingsEntry && local[settingsEntry]) {
      try { const s = JSON.parse(local[settingsEntry]) || {}; s.rememberKeys = Boolean(remember); local[settingsEntry] = JSON.stringify(s); } catch {}
    }
    if (!remember) for (const k of names) { session[k] = local[k]; delete local[k]; }
    return { local, session };
  }
  // The keys line in the restore dialog.
  function restoreKeysLine(included, remember) {
    if (!included) return 'API keys: not included. Your current keys stay.';
    return remember ? 'API keys: included.' : 'API keys: included. Kept for this visit only, because Remember is off.';
  }

  // Restore, step 2 (spec 2.6, Q-3): the key entries this tab holds after a restore. All old tab key entries are
  // removed first, then these are written. A backup with keys replaces the tab's keys, so a provider that is not in
  // the backup is not left connected. A backup without keys keeps the tab's own keys ("Your current keys stay").
  function restoreTabKeys(oldTab, session, backupHasKeys) {
    return backupHasKeys ? Object.assign({}, session || {}) : Object.assign({}, oldTab || {}, session || {});
  }

  // Undo for a deleted sheet (spec 2.4). undo = { roundId, index, item } from the delete. The sheet comes back only
  // into the round it was deleted from; returns { flows, flowIdx }, or null when the round changed in the meantime.
  function undoSheetDelete(round, undo) {
    if (!round || !undo || !undo.item || !undo.roundId || round.id !== undo.roundId) return null;
    const flows = restoreAt(round.flows, undo.index, undo.item);
    return { flows, flowIdx: flows.indexOf(undo.item) };
  }

  // No paid AI call runs by itself (spec 2.7, D2). Only an explicit true turns these on.
  function autoEvalDefault(saved) { return saved === true; }
  function liveFlowDefault(saved) { return saved === true; }
  // Q-2: the old defaults turned both on without a choice, so they are turned off once for everyone.
  // Returns the settings fields to change, or null when this already ran.
  function d2Reset(settings) {
    const s = settings || {};
    if (s.d2Reset) return null;
    return { autoEval: false, liveFlow: false, d2Reset: true };
  }
  // The one-time note about Live Eval and Live AI flow: the first time AI is ready, never while a clock runs.
  function needsD2Note(o) {
    const s = o || {};
    return Boolean(s.aiReady) && !s.shown && !s.clockRunning;
  }

  // ---------- Slice 3: visual system and Flow look ----------
  // V9 (Q8) How the Insights pane shows. No AI wins over the judge's own hide choice: a pane with nothing in it
  // folds to a thin edge with one "Connect AI" link. 'edge-connect' | 'edge-show' (the judge hid it) | 'open'.
  // allowed: can('liveEval') (platform 1B); false gives 'none': no pane, no edge, the grid takes the width.
  // setup: showSetup(); false (the Connect AI invite may not show) also gives 'none' when AI is not ready.
  function insightsMode(o) {
    const x = o || {};
    if (x.allowed === false) return 'none';
    if (!x.aiReady) return x.setup === false ? 'none' : 'edge-connect';
    return x.hideRight ? 'edge-show' : 'open';
  }
  // V10 (Q3) The theme to draw: the judge's setting ('system' | 'light' | 'dark'), else the device setting.
  // assets/theme-boot.js has the same rule (it runs before this file loads); a test keeps the two equal.
  function resolveTheme(setting, prefersDark) {
    if (setting === 'light' || setting === 'dark') return setting;
    return prefersDark ? 'dark' : 'light';
  }
  // V11 (spec 4.4) How long the pointer rests before a tip shows: 1 s on sheet tabs (they are passed over all
  // the time while flowing), 0.5 s for every other label tip and help bubble.
  const TIP_DELAY_MS = 500, SHEET_TIP_DELAY_MS = 1000;
  function tipDelay(kind) { return kind === 'sheet' ? SHEET_TIP_DELAY_MS : TIP_DELAY_MS; }
  // V11 (spec 4.4) Where a tip goes: centred below its target; flipped above when it would cross the top of the
  // round bar (view.bottomInset = --rb-h); always 8 px inside the viewport. target: a rect; tip: { w, h }.
  function tipPlace(target, tip, view) {
    const m = 8, gap = 6;
    const bottom = view.h - (view.bottomInset || 0);
    let top = target.top + target.height + gap, side = 'below';
    if (top + tip.h > bottom - m) {
      const above = target.top - gap - tip.h;
      if (above >= m) { top = above; side = 'above'; } else top = Math.max(m, bottom - m - tip.h);
    }
    const left = Math.max(m, Math.min(target.left + target.width / 2 - tip.w / 2, view.w - tip.w - m));
    return { top, left, side };
  }
  // V11 (spec 4.4) aria-describedby points at a tip only when the tip adds words to the control's name. A tip that
  // only repeats the name would make a screen reader say it twice. Case, spacing and end punctuation do not count.
  function tipAddsWords(name, tip) {
    const norm = (x) => String(x == null ? '' : x).toLowerCase().replace(/\s+/g, ' ').replace(/[\s.:;,!?\u2026]+$/, '').trim();
    const n = norm(name), t = norm(tip);
    if (!t) return false;
    return !n.includes(t);
  }
  // V11 (spec 4.4) Touch long press. One step of the press state: { timer, eat } in, the next state out.
  // ev: 'down' (a new touch starts), 'fire' (the 500 ms timer showed the tip), 'move' (the finger moved), 'up',
  // 'cancel' (pointercancel or contextmenu), 'click' (out: eatNow says whether to cancel this click).
  // Only the one click that ends the long press is eaten. A new touch always starts clean, so a lost click
  // (Android gives contextmenu and no click) can never cancel the next real tap, for example on Start.
  function pressStep(state, ev) {
    const st = { timer: Boolean(state && state.timer), eat: Boolean(state && state.eat) };
    if (ev === 'down') return { timer: true, eat: false, eatNow: false };
    if (ev === 'fire') return st.timer ? { timer: false, eat: true, eatNow: false } : { ...st, eatNow: false };
    if (ev === 'move' || ev === 'up') return { timer: false, eat: st.eat, eatNow: false };
    if (ev === 'cancel') return { timer: false, eat: false, eatNow: false };
    if (ev === 'click') return { timer: false, eat: false, eatNow: st.eat };
    return { ...st, eatNow: false };
  }
  // V11 (spec 4.4) A tip shows at once on keyboard focus, but not when the code moved focus back after Esc
  // (closing a pane returns focus to its button). The tip would cover what Esc just uncovered.
  const ESC_FOCUS_QUIET_MS = 300;
  function tipOnFocus(focusVisible, msSinceEsc) {
    return Boolean(focusVisible) && !(msSinceEsc >= 0 && msSinceEsc < ESC_FOCUS_QUIET_MS);
  }
  // V7 Which flow columns get the "Now" and "Viewing" marks. runId: the speech the clock times (or null);
  // curId: the speech on screen. CX speeches have no column. Returns column indexes or null:
  // current = the column with the 2 px outline (the running speech, else the one on screen),
  // now = the running column (only while a clock runs), viewing = a different column the judge looks at.
  function flowMarks(runId, curId, fmt) {
    const runCol = runId ? speechColumn(runId, fmt) : null;
    const curCol = curId ? speechColumn(curId, fmt) : null;
    const current = runId ? runCol : curCol;
    const viewing = runId && curCol != null && curCol !== runCol ? curCol : null;
    return { current: current == null ? null : current, now: runId && runCol != null ? runCol : null, viewing };
  }

  const api = { OVER_LIMIT, leftAt, restoreRun, restorePrep, restoreClocks, beepDecision, storageErrorKind, clockUnitIsNewer,
    shortSpeech, viewingLabel, toastMs, leftPaneMode, needsRecNotice, recStripState, beepedElsewhere, NO_AI,
    shouldShowWelcome, classifyAIError, AI_ERROR_TEXT, aiErrorText, AI_ERROR_PREFIX, removeAt,
    restoreAt, askInputState, resolveRememberKeys, splitRestoreKeys, restoreKeysLine, restoreTabKeys,
    undoSheetDelete, autoEvalDefault, liveFlowDefault, d2Reset, needsD2Note, escTop, TOAST_MAX, toastPlan,
    askFirstFocus, trapNext, insightsMode, resolveTheme, TIP_DELAY_MS, SHEET_TIP_DELAY_MS, tipDelay, tipPlace,
    tipAddsWords, pressStep, ESC_FOCUS_QUIET_MS, tipOnFocus, flowMarks };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.PolicyLogicParts = root.PolicyLogicParts || {}).rules = api;
})(typeof window !== 'undefined' ? window : globalThis);
