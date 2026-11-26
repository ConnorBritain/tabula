// Contextual AI edits: the primary star runs saved defaults. More reveals quick edits and a custom request.
// A captured selection is the only text sent or replaced. Every suggestion still needs Use this.
import { escapeHtml as esc } from '../../core/sheets.js';
import { wordDiff } from '../../core/review.js';
import { aiMark } from '../../core/ai-mark.js';
import { PREFERENCE_LIMIT, resolvePreferences } from '../../core/ai-preferences.js';
import { iconButton } from './icons.js';
import { cleanupPath, cleanableEntries, cleanupMessages, cleanupReview, acceptCleanup, undoCleanup, EDIT_MODES, editDefaults, editTarget, selectionDraft, sourceText } from './cleanup.js';
import { findRoom } from './room.js';
import { askConnectKey } from './ai-connect.js';

const label = (mode) => EDIT_MODES.find((m) => m.id === mode)?.label || 'Clarify';
export const diffHtml = (diff) => (diff || []).map((d) => d.op === 'del' ? `<del><span class="sr-only">removed: </span>${esc(d.text)}</del>` : d.op === 'ins' ? `<ins><span class="sr-only">added: </span>${esc(d.text)}</ins>` : esc(d.text)).join('');
const action = (id, act, text, cls = '', attrs = '') => `<button class="b ${cls}" type="button" data-vact="${act}" data-id="${esc(id)}" data-key="${act}-${esc(id)}"${attrs}>${text}</button>`;

export function cleanupButtonHtml(c, path, mode = 'full') {
  if (!path || path === 'none' || !String(c.comment || '').trim()) return '';
  const title = label(mode) + ' feedback with AI';
  return `<span class="ai-edit-actions" role="group" aria-label="AI feedback edits">${action(c.id, 'clean', aiMark('events', 'edit-' + c.id), 'quiet ai-action ai-edit-star', ` aria-label="${esc(title)}" title="${esc(title)}" aria-haspopup="dialog"`)}${iconButton('chevron-down', 'More AI edits', 'b quiet ai-edit-more', `data-vact="clean-more" data-id="${esc(c.id)}" data-key="clean-more-${esc(c.id)}" aria-haspopup="dialog" title="More AI edits"`)}</span>`;
}

export function selectionToolbarHtml(selection, mode) {
  return `<div class="ai-selection-toolbar" data-ai-selection role="toolbar" aria-label="AI for selected text">${action(selection.id, 'clean-selected', aiMark('events', 'selected-' + selection.id) + esc(label(mode)), 'quiet ai-action', ` aria-label="${esc(label(mode))} selected text with AI"`)}${iconButton('chevron-down', 'More edits for selected text', 'b quiet ai-edit-more', `data-vact="clean-selection-more" data-id="${esc(selection.id)}" aria-haspopup="dialog"`)}</div>`;
}

export function cleanupPanelHtml(st) {
  const id = st.id, scope = st.target.selected ? 'Selected text' : 'Feedback';
  const btn = (act, text, cls = '', attrs = '') => action(id, act, text, cls, attrs);
  let body;
  if (st.status === 'options') {
    body = `<label class="sr-only" for="edit-request-${esc(id)}">Your wording request</label><div class="ai-request-row"><textarea id="edit-request-${esc(id)}" rows="2" maxlength="${PREFERENCE_LIMIT}" data-clean-request data-id="${esc(id)}" data-key="clean-request-${esc(id)}" placeholder="How should this text change?">${esc(st.request)}</textarea>${btn('clean-custom', 'Apply', 'primary')}</div>
      ${st.error ? `<p class="cleanup-err" role="alert">${esc(st.error)}</p>` : ''}
      <div class="ai-quick-edits" role="group" aria-label="Quick edits">${EDIT_MODES.filter((m) => m.id !== 'custom').map((m) => btn('clean-op', esc(m.label), 'small quiet', ` data-mode="${m.id}"`)).join('')}</div>`;
  } else if (st.status === 'busy') {
    body = '<p class="muted" role="status">Preparing an edit…</p>';
  } else if (st.status === 'ready') {
    const original = st.showOriginal === true;
    body = `<div class="seg-track ai-compare" role="tablist" aria-label="Compare edit">${btn('clean-original', 'Original', 'small' + (original ? ' on' : ''), ` role="tab" tabindex="${original ? 0 : -1}" aria-selected="${original}" aria-controls="edit-comparison-${esc(id)}"`)}${btn('clean-suggested', 'Suggested', 'small' + (!original ? ' on' : ''), ` role="tab" tabindex="${original ? -1 : 0}" aria-selected="${!original}" aria-controls="edit-comparison-${esc(id)}"`)}</div>
      <div class="card-text cleanup-diff" id="edit-comparison-${esc(id)}" role="tabpanel" aria-label="${original ? 'Original' : 'Suggested'}">${original ? esc(st.target.text) : st.empty ? 'The AI sent no text. Your comment stays as written.' : st.same ? 'No changes suggested.' : diffHtml(st.diff)}</div>
      <p class="field-help">AI rewrote your words. Check them before you copy.</p>
      <div class="cleanup-btns">${st.empty || st.same ? '' : btn('clean-use', 'Use this', 'primary')}${btn('clean-keep', 'Keep mine', st.empty || st.same ? 'primary' : '')}${btn('clean-go', 'Try again', 'quiet small')}</div>`;
  } else {
    body = `<p class="cleanup-err" role="alert">${esc(st.error || 'The edit did not work. Your comment is safe.')}</p><div class="cleanup-btns">${btn('clean-go', 'Try again', 'primary')}${btn('clean-keep', 'Keep mine', 'quiet')}</div>`;
  }
  return `<div class="cleanup${st.status === 'options' ? ' ai-edit-options' : ''}" data-clean-panel data-id="${esc(id)}" role="dialog" aria-modal="false" aria-labelledby="edit-title-${esc(id)}"><div class="edit-head"><h3 id="edit-title-${esc(id)}">${st.status === 'options' ? 'Edit with AI' : esc(label(st.mode))} <span class="muted">· ${scope}</span></h3>${iconButton('x', 'Close AI editor', 'b quiet edit-close', `data-vact="clean-close" data-id="${esc(id)}"`)}</div>${st.target.selected && st.status !== 'ready' ? `<p class="ai-selected-quote" title="${esc(st.target.text)}">“${esc(st.target.text)}”</p>` : ''}${body}<div class="ai-edit-foot"><span class="field-help">${st.target.selected ? 'Only selected text will change.' : 'Your original stays until you accept.'}</span><a href="#/settings">AI settings</a></div></div>`;
}

export function createCleanup(env, hooks) {
  let st = null, selection = null, controller = null, token = 0;
  const room = () => findRoom(env.rooms(), hooks.roomId());
  const own = env.ai.own;
  const settings = () => env.settings?.() || {};
  const defaults = () => editDefaults(settings().feedbackEdit);
  const path = () => cleanupPath({ gate: env.ai.gate, hasKey: own.hasKey(), hosted: false });
  const draw = (key) => hooks.draw(key);
  const changed = (key) => (hooks.changed || hooks.draw)(key);
  const cancel = () => { token++; controller?.abort(); controller = null; };
  function close(restore = true) {
    const id = st?.id || selection?.id;
    cancel(); st = null; selection = null;
    draw(restore && id ? 'clean-' + id : undefined);
  }
  function begin(id, selected, options = false) {
    if (path() === 'none') return false;
    const e = room()?.entries.find((x) => x.id === id);
    if (!e || !sourceText(e).trim() || e.status === 'noShow') return false;
    if (selected && (selected.id !== id || selected.base !== sourceText(e))) { close(); return false; }
    cancel();
    const prefs = resolvePreferences(settings().aiPreferences, 'feedback');
    const target = editTarget(e, selected);
    st = { id, ...defaults(), status: options ? 'options' : 'idle', style: prefs.style, target, anchor: selected, request: options ? '' : defaults().request };
    selection = null;
    return true;
  }
  async function run() {
    const r = room();
    if (!st || !r || st.status === 'busy' || path() === 'none') return;
    if (st.mode === 'custom' && !st.request.trim()) { st.error = 'Describe the wording change you want.'; st.status = 'options'; draw('clean-request-' + st.id); return; }
    const chosen = st, mine = ++token;
    controller?.abort(); controller = new AbortController();
    const signal = controller.signal;
    st.status = 'busy'; st.error = ''; draw();
    env.ui.announce('Preparing an edit.');
    try {
      if (path() === 'connect' && !(await askConnectKey(env.ui, own))) {
        if (mine === token) { st.status = 'error'; st.error = 'Connect an AI key in Settings to make edits.'; draw(); }
        return;
      }
      if (mine !== token || st !== chosen || room()?.id !== r.id || path() !== 'own') return;
      const entries = cleanableEntries(r, [st.id]).map((e) => ({ ...e }));
      if (!entries.length || sourceText(entries[0]) !== st.target.base) throw new Error('Your comment changed. Select the text again or start a new edit.');
      const range = st.target.selected ? { start: st.target.start, end: st.target.end } : undefined;
      const msg = cleanupMessages(r, hooks.event(r), [st.id], st.mode, { selection: range, request: st.request, preferences: { style: st.style } });
      const drafts = await own.cleanup(env.ai.gate, msg, { signal });
      if (mine !== token || !st) return;
      const draft = drafts[st.id], full = selectionDraft(st.target, draft);
      st = { ...st, status: 'ready', card: cleanupReview(entries, full == null ? {} : { [st.id]: full }).cards[0], empty: full == null, same: typeof draft === 'string' && st.target.text.trim() === draft.trim(), diff: wordDiff(st.target.text, draft || ''), showOriginal: false };
      draw(st.empty || st.same ? 'clean-keep-' + st.id : 'clean-use-' + st.id);
      env.ui.announce('Suggested edit ready.');
    } catch (err) {
      if (mine !== token || !st) return;
      st.status = 'error'; st.error = err.message || 'The edit did not work. Your comment is safe.';
      draw('clean-go-' + st.id);
    }
  }
  function use() {
    const r = room();
    if (!st || st.status !== 'ready' || st.empty || st.same || !r || path() === 'none') return;
    const id = st.id, out = acceptCleanup(r, { cards: [st.card] }, id, env.now());
    if (!out.changed) { st.status = 'error'; st.error = 'Your comment changed after the preview started. Try a new edit.'; draw(); return; }
    env.saveRoom(out.room);
    const inText = sourceText(out.room.entries.find((e) => e.id === id));
    cancel(); st = null; selection = null; changed('copy-' + id);
    env.ui.toast('Edit applied. Copy it again before you paste.', { key: 'clean', action: { label: 'Undo', name: 'Undo: AI edit', run: () => {
      const back = undoCleanup(room(), r, id, inText, env.now());
      if (!back) { env.ui.toast('The comment changed since, so it was not put back.', { key: 'clean' }); return; }
      env.saveRoom(back); changed(); env.ui.toast('Your words are back.', { key: 'clean' });
    } } });
  }
  function position() {
    if ((!st && !selection) || !env.el || typeof window === 'undefined') return;
    const box = env.el.querySelector(st ? '[data-clean-panel]' : '[data-ai-selection]');
    const anchor = st?.anchor || selection;
    const trigger = !anchor && env.el.querySelector(`[data-vact="clean"][data-id="${CSS.escape(st.id)}"]`);
    if (!box || (!anchor && !trigger)) return;
    const a = anchor ? { ...anchor.rect, top: anchor.rect.top - (window.scrollY - anchor.scrollY), bottom: anchor.rect.bottom - (window.scrollY - anchor.scrollY) } : trigger.getBoundingClientRect();
    const b = box.getBoundingClientRect(), gap = 12, below = a.bottom + 8, above = a.top - b.height - 8;
    box.style.left = Math.max(gap, Math.min(anchor ? a.left : a.right - b.width, innerWidth - b.width - gap)) + 'px';
    box.style.top = Math.max(gap, Math.min(anchor && above >= gap ? above : below + b.height <= innerHeight - gap ? below : above, innerHeight - b.height - gap)) + 'px';
  }
  return {
    path, position,
    button(c) { return cleanupButtonHtml(c, path(), defaults().mode); },
    panel() { return st ? cleanupPanelHtml(st) : selection ? selectionToolbarHtml(selection, defaults().mode) : ''; },
    select(value) {
      if (path() === 'none') return;
      if (!value) { if (selection) { selection = null; draw(); } return; }
      const e = room()?.entries.find((x) => x.id === value.id);
      if (!e || sourceText(e) !== value.base) return;
      try { editTarget(e, value); } catch { return; }
      const current = st?.anchor || selection;
      if (current && current.id === value.id && current.start === value.start && current.end === value.end && current.base === value.base) return;
      cancel(); st = null; selection = value; draw();
    },
    input(e) { if (!st || st.status !== 'options' || e.target.dataset.cleanRequest === undefined || e.target.dataset.id !== st.id) return false; st.request = e.target.value.slice(0, PREFERENCE_LIMIT); return true; },
    key(e) {
      if ((st || selection) && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
      if (st?.status === 'ready' && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key) && e.target?.closest?.('[role="tablist"]')) { e.preventDefault(); st.showOriginal = e.key === 'Home' ? true : e.key === 'End' ? false : !st.showOriginal; draw((st.showOriginal ? 'clean-original-' : 'clean-suggested-') + st.id); }
      if (st?.status === 'options' && e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); st.mode = 'custom'; return run(); }
    },
    outside(e) {
      if (!(st || selection) || e.target.closest?.('[data-ai-layer], .ai-edit-actions')) return;
      if (selection && e.target.closest?.('[data-ai-text], textarea[data-vfield="comment"]')) return;
      close(false);
    },
    click(act, el) {
      const id = el.dataset.id;
      if (['clean', 'clean-more', 'clean-selected', 'clean-selection-more'].includes(act)) {
        const selected = act.startsWith('clean-selection') || act === 'clean-selected' ? selection : null;
        if (act === 'clean' && st?.id === id && st.status === 'busy') return;
        if ((act === 'clean-selected' || act === 'clean-selection-more') && !selected) return;
        const more = act.endsWith('more');
        if (!begin(id, selected, more)) return;
        if (more) return draw('clean-request-' + id);
        return run();
      }
      if (!st || st.id !== id) return;
      if (act === 'clean-op' && st.status === 'options' && EDIT_MODES.some((m) => m.id === el.dataset.mode && m.id !== 'custom')) { st.mode = el.dataset.mode; return run(); }
      if (act === 'clean-custom' && st.status === 'options') { st.mode = 'custom'; return run(); }
      if (act === 'clean-go') return run();
      if (act === 'clean-use') return use();
      if (act === 'clean-original' || act === 'clean-suggested') { st.showOriginal = act === 'clean-original'; return draw(act + '-' + id); }
      if (act === 'clean-keep') { env.ui.announce('Kept your words.'); return close(); }
      if (act === 'clean-close') return close();
    },
    closeFor(id) { if (st?.id === id || selection?.id === id) { cancel(); st = null; selection = null; draw(); } },
    reset() { cancel(); st = null; selection = null; },
  };
}
