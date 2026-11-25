// Speech Events step E13: "Clean up my comments" on the Review screen (docs/events/DESIGN.md §4.9; ARCHITECTURE.md §7;
// LANDING.md §4.1). One speaker at a time, only on a tap. The judge picks "Full clean-up" or "Spelling only", sees
// their own words above the clean version with a word diff, and chooses "Use this", "Keep mine" or "Try again". Nothing
// changes until "Use this"; Undo is in a toast. With AI off by policy, none of this is built: no button, no hole.
//
// The HTML builders at the top are pure (Node tests call them). createCleanup does the clicks, the dialogs and the call;
// the rules are in cleanup.js and the key in ai-key.js.
import { escapeHtml as esc } from '../../core/sheets.js';
import { cleanupPath, cleanableEntries, cleanupMessages, cleanupReview, acceptCleanup, undoCleanup } from './cleanup.js';
import { findRoom } from './room.js';
import { askConnectKey, askForgetKey } from './ai-connect.js';

const MODE_LABELS = { full: 'Full clean-up', spelling: 'Spelling only' };

// The word diff as HTML: removed words struck through, added words marked, each with words for a screen reader.
export const diffHtml = (diff) => (diff || []).map((d) => (d.op === 'del' ? `<del><span class="sr-only">removed: </span>${esc(d.text)}</del>`
  : d.op === 'ins' ? `<ins><span class="sr-only">added: </span>${esc(d.text)}</ins>` : esc(d.text))).join('');

// The "Clean up" button on a card. Empty when the path is 'none' (AI off: the button is not built) or there is no text.
export function cleanupButtonHtml(c, path, open) {
  if (path === 'none' || !path || !String(c.comment || '').trim()) return '';
  return `<button class="b small quiet" type="button" data-vact="clean" data-id="${esc(c.id)}" data-key="clean-${esc(c.id)}" aria-expanded="${Boolean(open)}" aria-controls="clean-${esc(c.id)}">Clean up</button>`;
}

// The panel under a card's text. st: { id, mode, status ('idle'|'busy'|'ready'|'error'), card (the review card),
// error, errorKind, providerName }. c: the Review card (code, comment).
export function cleanupPanelHtml(c, st) {
  const btn = (act, label, extra = '') => `<button class="b${extra}" type="button" data-vact="${act}" data-id="${esc(c.id)}" data-key="${act}-${esc(c.id)}">${label}</button>`;
  const modes = `<div class="order-toggle seg-track" role="group" aria-label="How much to change">${['full', 'spelling'].map((m) =>
    `<button class="b small${st.mode === m ? ' on' : ''}" type="button" data-vact="clean-mode" data-mode="${m}" data-id="${esc(c.id)}" data-key="clean-mode-${m}" aria-pressed="${st.mode === m}"${st.status === 'busy' ? ' disabled' : ''}>${MODE_LABELS[m]}</button>`).join('')}</div>`;
  let body = '';
  if (st.status === 'idle') {
    body = `<p class="muted cleanup-note">Your words go to ${esc(st.providerName || 'the AI')} with your own key. Codes, and the names, titles and authors you typed in setup, are swapped out first. A name you wrote only in your notes is sent as you wrote it.</p>
      <div class="cleanup-btns">${btn('clean-go', 'Clean up', ' primary')}${btn('clean-close', 'Cancel', ' quiet')}${btn('clean-forget', 'Forget my key', ' quiet small')}</div>`;
  } else if (st.status === 'busy') {
    body = `<p class="muted" role="status">Cleaning up…</p><div class="cleanup-btns">${btn('clean-close', 'Cancel', ' quiet')}</div>`;
  } else if (st.status === 'error') {
    // A rejected key: the judge needs a way to a new one, so "Forget my key" shows here too.
    body = `<p class="cleanup-err" role="alert">${esc(st.error)}</p><div class="cleanup-btns">${btn('clean-go', 'Try again', ' primary')}${btn('clean-close', 'Close', ' quiet')}${st.errorKind === 'rejected' ? btn('clean-forget', 'Forget my key', ' quiet small') : ''}</div>`;
  } else if (st.status === 'ready') {
    const card = st.card;
    const before = card.base[card.fields[0]];
    const after = card.after[card.fields[0]];
    const same = !card.empty && String(before).trim() === String(after).trim();
    const result = card.empty ? '<p class="muted">The AI sent back no text for this speaker. Keep your words, or try again.</p>'
      : same ? '<p class="muted">No changes needed. Your words are already clean.</p>'
      : `<h4 class="cleanup-h">Clean version</h4><div class="card-text cleanup-diff">${diffHtml(card.diff)}</div>
        <p class="muted cleanup-note">AI rewrote your words. Check them before you copy.</p>`;
    body = `<h4 class="cleanup-h">Your words</h4><div class="card-text">${esc(before)}</div>${result}
      <div class="cleanup-btns">${card.empty || same ? '' : btn('clean-use', 'Use this', ' primary')}${btn('clean-keep', 'Keep mine', card.empty || same ? ' primary' : '')}${btn('clean-go', 'Try again', ' quiet')}</div>`;
  }
  return `<div class="cleanup" id="clean-${esc(c.id)}" role="region" aria-label="Clean up the comment for ${esc(c.code)}">${modes}${body}</div>`;
}

// env: the Review screen's env ({ ui, now, rooms, saveRoom, data, ai: { gate, own } }). hooks: { roomId(), event(room),
// draw(focusKey) }. Returns { path(), view(c) -> { button, panel }, click(act, el), reset() }.
export function createCleanup(env, hooks) {
  const P = globalThis.TabulaCore.policy;
  let st = null; // the open panel, or null
  let token = 0; // a reply for an older request is thrown away
  const room = () => findRoom(env.rooms(), hooks.roomId());
  const own = env.ai.own;
  // The path is worked out at each draw from the gate made at app start (AI-POLICY.md §6a: never mid-session).
  // hosted: false until E14 builds the hosted path.
  const path = () => cleanupPath({ gate: env.ai.gate, hasKey: own.hasKey(), hosted: false });

  function close(focusKey) { token++; const id = st && st.id; st = null; hooks.draw(focusKey || (id ? 'clean-' + id : undefined)); }
  function open(id) { token++; st = { id, mode: 'full', status: 'idle', providerName: own.providerName() }; hooks.draw('clean-go-' + id); }

  // The Connect AI invite (path 'connect'): paste a key, then choose where it is kept (ai-connect.js, shared with
  // Settings). Not remembered unless chosen.
  async function connect(id) {
    if (!(await askConnectKey(env.ui, own))) return;
    if (path() === 'own') open(id); else hooks.draw('clean-' + id);
  }

  async function run() {
    const r = room();
    if (!st || !r || path() !== 'own') return;
    const id = st.id;
    const mine = ++token;
    const entries = cleanableEntries(r, [id]);
    if (!entries.length) { close(); return; }
    st = Object.assign({}, st, { status: 'busy', error: '' });
    hooks.draw();
    env.ui.announce('Cleaning up.');
    try {
      const msg = cleanupMessages(r, hooks.event(r), [id], st.mode);
      const drafts = await own.cleanup(env.ai.gate, msg);
      if (mine !== token || !st) return;
      const card = cleanupReview(entries, drafts).cards[0];
      st = Object.assign({}, st, { status: 'ready', card });
      hooks.draw(card.empty || String(card.base[card.fields[0]]).trim() === String(card.after[card.fields[0]]).trim() ? 'clean-keep-' + id : 'clean-use-' + id);
      env.ui.announce('Clean version ready.');
    } catch (err) {
      if (mine !== token || !st) return;
      st = Object.assign({}, st, { status: 'error', error: err.message || 'The clean-up did not work. Your comment is safe.', errorKind: err.kind || '' });
      hooks.draw('clean-go-' + id);
    }
  }

  function use() {
    const r = room();
    if (!st || st.status !== 'ready' || !r) return;
    const id = st.id;
    const out = acceptCleanup(r, { cards: [st.card] }, id, env.now());
    if (!out.changed) {
      st = Object.assign({}, st, { status: 'error', error: 'Your comment changed after the clean-up started. Try again.' });
      hooks.draw('clean-go-' + id);
      return;
    }
    env.saveRoom(out.room);
    const inText = out.room.entries.find((e) => e.id === id).comment;
    token++; st = null;
    hooks.draw('copy-' + id);
    // Undo puts the old entry and room state back, only if the comment is still the clean version.
    env.ui.toast('Clean version in. Copy it again before you paste.', { key: 'clean', action: { label: 'Undo', name: 'Undo: clean-up', run: () => {
      const back = undoCleanup(room(), r, id, inText, env.now());
      if (!back) { env.ui.toast('The comment changed since, so it was not put back.', { key: 'clean' }); return; }
      env.saveRoom(back);
      hooks.draw();
      env.ui.toast('Your words are back.', { key: 'clean' });
    } } });
  }

  async function forget() {
    if (!(await askForgetKey(env.ui, own))) return;
    const id = st && st.id;
    token++; st = null;
    hooks.draw(id ? 'clean-' + id : undefined);
    env.ui.toast('Your AI key is gone from this browser.', { key: 'ai' });
  }

  return {
    path,
    // The button and panel for one card ('' when AI is off). editing: the card's edit box is open (no clean-up then).
    view(c, editing) {
      const p = path();
      if (p === 'none' || editing) return { button: '', panel: '' };
      const isOpen = Boolean(st && st.id === c.id);
      return { button: cleanupButtonHtml(c, p, isOpen), panel: isOpen ? cleanupPanelHtml(c, st) : '' };
    },
    click(act, el) {
      const id = el.dataset.id;
      if (act === 'clean') { if (st && st.id === id) return close(); if (path() === 'connect') return connect(id); if (path() === 'own') return open(id); return; }
      if (!st || st.id !== id) return;
      if (act === 'clean-mode') { st = Object.assign({}, st, { mode: el.dataset.mode, status: 'idle', card: null }); token++; return hooks.draw('clean-mode-' + el.dataset.mode); }
      if (act === 'clean-go') return run();
      if (act === 'clean-use') return use();
      if (act === 'clean-keep') { env.ui.announce('Kept your words.'); return close(); }
      if (act === 'clean-close') return close();
      if (act === 'clean-forget') return forget();
    },
    // An edit on this card closes its panel (the edit wins; a card made before it could not go in anyway).
    closeFor(id) { if (st && st.id === id) { token++; st = null; } },
    reset() { token++; st = null; },
  };
}
