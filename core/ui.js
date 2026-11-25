// Shared code for Tabula Debate and Tabula Speech Events (docs/events/LANDING.md §3, step C3): the toast, the in-app
// dialog ask(), the one Esc stack, the screen-reader announcer and modalDialog for a dialog with its own markup.
// Generic words only (core-words.test.mjs). Loaded as described in core/defs.js.
// The rules (which toast to close, which button gets focus, which layer is on top) are pure functions with unit tests
// (logic.test.js reads them through PolicyLogic). createUI() does the DOM work, and only when an app calls it, so Node
// can load this file.

// ---------- pure rules (spec 4.2, 4.3, S0.4) ----------
// The Esc stack: the index of the open layer with the highest rank, or -1. layers: [{ rank, open }].
// On a tie the layer added first wins. Esc closes only that one layer.
export function escTop(layers) {
  let top = -1;
  (layers || []).forEach((l, i) => { if (l && l.open && (top < 0 || l.rank > layers[top].rank)) top = i; });
  return top;
}
// What a new toast does to the list. list: [{ key, msg, action }] oldest first; t: { key, msg, action }.
// Returns { reuse: index or -1, close: [indexes to close, in order] }.
// Rules (spec 4.3): the same key or text restarts that toast; only one toast with an action (Undo) at a time;
// at most 3 toasts, so the oldest goes first.
export const TOAST_MAX = 3;
export function toastPlan(list, t) {
  const l = list || [];
  const reuse = l.findIndex((x) => (t.key && x.key === t.key) || x.msg === t.msg);
  if (reuse >= 0) return { reuse, close: [] };
  const close = [];
  if (t.action) l.forEach((x, i) => { if (x.action) close.push(i); });
  let left = l.length - close.length;
  for (let i = 0; i < l.length && left >= TOAST_MAX; i++) if (!close.includes(i)) { close.push(i); left--; }
  return { reuse: -1, close: close.sort((a, b) => a - b) };
}
// The dialog button that gets focus first. buttons: [{ value, kind }]; opts: { focus, hasFocus, cancelValue }.
// An asked-for button wins; else the safe (cancel) button in a dialog with a danger button; else the primary one; else the first.
export function askFirstFocus(buttons, opts) {
  const b = buttons || [], o = opts || {};
  const idx = (pred) => b.findIndex(pred);
  let i = o.hasFocus ? idx((x) => x.value === o.focus) : -1;
  if (i < 0 && b.some((x) => x.kind === 'danger')) i = idx((x) => x.value === o.cancelValue);
  if (i < 0) i = idx((x) => x.kind === 'primary');
  return i < 0 ? 0 : i;
}
// The focus trap: the button Tab (or Shift+Tab) goes to. Focus outside the list goes to the first (or last).
export function trapNext(i, n, back) {
  if (!(n > 0)) return -1;
  if (i < 0) return back ? n - 1 : 0;
  return (i + (back ? -1 : 1) + n) % n;
}

// 1.4 How long a toast stays (ms). 0 means it stays until it is closed.
export function toastMs(text, kind, hasAction) {
  if (kind === 'error') return 0;
  if (hasAction) return 10000;
  const n = String(text || '').length;
  return Math.min(10000, Math.max(4000, 1000 + 60 * n));
}

// Keyboard path to a toast's action (WCAG 2.1.1). The toasts sit at the end of the page, so plain Tab order would reach
// an Undo last. Instead the newest toast with an action acts as if it came right after the place the focus was when it
// appeared (its origin), without trapping focus:
//   Tab at the origin            -> the toast's first button (the action)
//   Shift+Tab on its first button -> back to the origin
//   Tab on its last button        -> the next stop after the origin
// s: { atOrigin, inToast: index of the focused toast button or -1, count: buttons in the toast, back }.
// Returns 'toast' | 'origin' | 'after' | null (null: the browser's own Tab).
export function toastTab(s) {
  const o = s || {};
  if (!(o.count > 0)) return null;
  if (o.inToast < 0) return o.atOrigin && !o.back ? 'toast' : null;
  if (o.back && o.inToast === 0) return 'origin';
  if (!o.back && o.inToast === o.count - 1) return 'after';
  return null;
}
// What a screen reader hears for a toast (WCAG 4.1.3): the message, and for a toast with an action, how to reach it.
export function toastSpoken(text, actionLabel) {
  return actionLabel ? String(text) + ' ' + actionLabel + ': press Tab.' : String(text);
}

// The text box in ask() (spec 4.2): is the typed text good enough for the primary button?
// opts: { required (default true), maxLength, emptyError }. Returns { ok, text, error }.
export function askInputState(raw, opts) {
  const o = opts || {};
  let text = String(raw == null ? '' : raw).trim();
  if (o.maxLength > 0) text = text.slice(0, o.maxLength);
  if (o.required !== false && !text) return { ok: false, text, error: o.emptyError || 'Type something first.' };
  return { ok: true, text, error: '' };
}

// ---------- the page parts ----------
// createUI({ behind }) builds the toast, ask, Esc stack and modalDialog for one page. A second call throws: it would add
// a second Esc listener and a second ask layer, so one Esc would close two things.
// behind: a CSS selector for the parts of the page a dialog makes inert (the app's own layout, so it is passed in).
// The page must have #toasts, #toasts-polite, #toasts-alert, #sr-status and the #ask dialog markup, and the toast, ask
// and .b button styles (they move to shared CSS in step C4). A toast coming or going fires 'tabula:toasts' on document.
let made = false;
export function createUI({ behind }) {
  if (typeof behind !== 'string' || !behind) throw new Error('createUI needs a behind selector');
  if (made) throw new Error('createUI was already called on this page');
  made = true;
  const $ = (s) => document.querySelector(s);

  // ---------- toasts (spec 4.3) ----------
  // toast(msg, { kind: 'info' | 'error', action: { label, name (the button's accessible name, e.g. "Undo: delete sheet"), run }, key }). Info toasts time out (toastMs);
  // errors stay until closed. The same key or text restarts the timer instead of adding a copy. At most 3.
  // Screen readers hear info politely and errors at once, through two permanent live regions.
  const toastList = [];
  function toast(msg, opts) {
    const o = opts || {};
    const kind = o.kind === 'error' ? 'error' : 'info';
    const text = String(msg);
    const region = document.getElementById(kind === 'error' ? 'toasts-alert' : 'toasts-polite');
    const spoken = toastSpoken(text, o.action ? o.action.label : '');
    if (region) { region.textContent = ''; setTimeout(() => { region.textContent = spoken; }, 60); }
    const plan = toastPlan(toastList.map((t) => ({ key: t.key, msg: t.msg, action: Boolean(t.action) })), { key: o.key || '', msg: text, action: Boolean(o.action) });
    if (plan.reuse >= 0) {
      const same = toastList[plan.reuse];
      same.msg = text; same.el.querySelector('.toast-msg').textContent = text;
      same.ms = toastMs(text, same.kind, Boolean(same.action)); toastArm(same);
      return same;
    }
    plan.close.map((i) => toastList[i]).forEach(toastClose);
    const el = document.createElement('div');
    el.className = 'toast' + (kind === 'error' ? ' is-error' : '');
    const t = { el, msg: text, key: o.key || '', kind, action: o.action || null, ms: toastMs(text, kind, Boolean(o.action)), timer: null, left: 0, at: 0, hover: false, focus: false,
      origin: document.activeElement || null };
    if (kind === 'error') { const i = document.createElement('span'); i.className = 'toast-icon'; i.setAttribute('aria-hidden', 'true'); i.textContent = '!'; el.append(i); }
    const m = document.createElement('span'); m.className = 'toast-msg'; m.textContent = text; el.append(m);
    if (t.action) {
      const a = document.createElement('button'); a.type = 'button'; a.className = 'toast-act'; a.textContent = t.action.label;
      if (t.action.name) a.setAttribute('aria-label', t.action.name);
      a.addEventListener('click', () => { toastClose(t); t.action.run(); });
      el.append(a);
    }
    const x = document.createElement('button'); x.type = 'button'; x.className = 'b quiet toast-x'; x.setAttribute('aria-label', 'Dismiss message'); x.textContent = '×';
    x.addEventListener('click', () => toastClose(t));
    el.append(x);
    // The timer waits while the pointer or focus is on the toast; then at least 2 s remain (WCAG 2.2.1).
    const hold = (k, on) => { t[k] = on; if (t.hover || t.focus) toastPause(t); else toastResume(t); };
    el.addEventListener('mouseenter', () => hold('hover', true));
    el.addEventListener('mouseleave', () => hold('hover', false));
    el.addEventListener('focusin', () => hold('focus', true));
    el.addEventListener('focusout', (e) => { if (!el.contains(e.relatedTarget)) hold('focus', false); });
    $('#toasts').append(el); toastList.push(t); toastArm(t); toastsChanged();
    return t;
  }
  function toastArm(t) {
    clearTimeout(t.timer); t.timer = null;
    if (!t.ms) return;
    t.left = t.ms; t.at = Date.now();
    if (!t.hover && !t.focus) t.timer = setTimeout(() => toastClose(t), t.left);
  }
  function toastPause(t) {
    if (!t.ms || !t.timer) return;
    clearTimeout(t.timer); t.timer = null; t.left = Math.max(0, t.left - (Date.now() - t.at));
  }
  function toastResume(t) {
    if (!t.ms || t.timer) return;
    t.left = Math.max(2000, t.left); t.at = Date.now();
    t.timer = setTimeout(() => toastClose(t), t.left);
  }
  function toastClose(t) {
    clearTimeout(t.timer);
    const i = toastList.indexOf(t); if (i < 0) return;
    // Focus never falls to the page body when its toast goes: it goes back to where it was when the toast appeared.
    const hadFocus = t.el.contains(document.activeElement);
    toastList.splice(i, 1); t.el.remove(); toastsChanged();
    if (hadFocus) focusBack(t.origin);
  }
  const usable = (el) => Boolean(el && el.isConnected !== false && typeof el.focus === 'function' && !(el.closest && el.closest('[inert],[hidden]')));
  function focusBack(el) { if (usable(el)) el.focus(); }
  // The toast whose action the keyboard path leads to: the newest one with an action.
  const actionToast = () => { for (let i = toastList.length - 1; i >= 0; i--) if (toastList[i].action) return toastList[i]; return null; };
  const toastButtons = (t) => Array.from(t.el.querySelectorAll('button'));
  // The next Tab stop after el in page order, outside the toasts; null lets the browser choose.
  const TABBABLE = 'a[href], button, input, select, textarea, summary, [tabindex], [contenteditable="true"]';
  function stopAfter(el) {
    if (!el || !el.compareDocumentPosition) return null;
    const box = $('#toasts');
    for (const c of document.querySelectorAll(TABBABLE)) {
      if (box && box.contains(c)) continue;
      if (c.disabled || c.tabIndex < 0 || !usable(c) || (c.getClientRects && !c.getClientRects().length)) continue;
      if (el.compareDocumentPosition(c) & 4 /* Node.DOCUMENT_POSITION_FOLLOWING */ && !el.contains(c)) return c;
    }
    return null;
  }
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab' || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const t = actionToast(); if (!t) return;
    const btns = toastButtons(t);
    const active = document.activeElement;
    const atOrigin = active === t.origin || (!t.origin || t.origin === document.body) && (!active || active === document.body);
    const step = toastTab({ atOrigin, inToast: btns.indexOf(active), count: btns.length, back: e.shiftKey });
    const target = step === 'toast' ? btns[0] : step === 'origin' ? (usable(t.origin) ? t.origin : null) : step === 'after' ? stopAfter(t.origin) : null;
    if (!target) return;
    e.preventDefault(); target.focus();
  });
  // Close the toast with this key, if one shows (for example the storage error after a save works again).
  function dismissToast(key) { toastList.filter((t) => t.key === key).forEach(toastClose); }
  // The Undo that waits now, for the palette row "Undo: {what}" (spec 4.3, 5.4): { name, run } or null.
  // Only one Undo waits at a time (toastPlan). run() closes its toast and undoes, like the toast's own button.
  // A toast came or went: the palette listens, so its Undo row follows without polling.
  function toastsChanged() { document.dispatchEvent(new CustomEvent('tabula:toasts')); }
  function pendingUndo() {
    const t = toastList.find((x) => x.action && /^Undo: /.test(x.action.name || ''));
    return t ? { name: t.action.name, run: () => { toastClose(t); t.action.run(); } } : null;
  }

  // A short message for screen readers only (for example the view-only and recording messages).
  function announce(text) { const r = document.getElementById('sr-status'); if (!r) return; r.textContent = ''; setTimeout(() => { r.textContent = text; }, 60); }

  // ---------- the in-app dialog: ask(opts) -> Promise<value | null> (spec 4.2, S0.3, extended in Slice 2) ----------
  // opts: { title, body (a string or a list of paragraphs), list (lines shown as a list), foot,
  //         input: { label, value, placeholder, maxLength, required, emptyError },
  //         buttons: [{ label, value, kind: 'primary'|'danger'|'plain'|'link', desc }], cancelValue,
  //         focus (the value of the button that gets focus first), backdrop (false: a click on the dim layer does nothing),
  //         variant ('choices': buttons with a desc show as large choice cards),
  //         radios: { legend, name, options: [{ value, label }], value } (one pick shown under the body) }.
  // A 'link' button shows as a quiet line, its desc then a text link (the welcome's help line), in every variant.
  // With an input, the primary button resolves with the typed text (trimmed); other buttons resolve with their value.
  // With radios, a button other than the cancel one resolves with { value, choice } (choice: the picked radio's value);
  // cancel still gives cancelValue, so a caller tests the cancel case first.
  // Esc, × and a click on the dim layer give cancelValue. Focus is trapped and returns to the opener. One at a time.
  let askState = null, askChain = Promise.resolve();
  function ask(opts) { const p = askChain.then(() => askOpen(opts || {})); askChain = p.catch(() => {}); return p; }
  function askOpen(o) {
    return new Promise((resolve) => {
      const wrap = $('#ask'), card = $('#ask-card'), x = $('#ask-x');
      const opener = document.activeElement;
      const buttons = o.buttons && o.buttons.length ? o.buttons.slice(0, 3) : [{ label: 'OK', value: true, kind: 'primary' }];
      const cancelValue = 'cancelValue' in o ? o.cancelValue : null;
      const choices = o.variant === 'choices';
      card.classList.toggle('ask-choices', choices);
      $('#ask-title').textContent = o.title || '';
      const body = $('#ask-body'); body.textContent = '';
      for (const para of [].concat(o.body || [])) { const p = document.createElement('p'); p.textContent = para; body.append(p); }
      if (o.list && o.list.length) {
        const ul = document.createElement('ul'); ul.className = 'ask-list';
        for (const line of o.list) { const li = document.createElement('li'); li.textContent = line; ul.append(li); }
        body.append(ul);
      }
      // The radio group: one pick the caller gets back with the button (the format for a new round).
      const rad = o.radios && o.radios.options && o.radios.options.length ? o.radios : null;
      const radioEls = [];
      if (rad) {
        const fs = document.createElement('fieldset'); fs.className = 'ask-radios';
        const lg = document.createElement('legend'); lg.textContent = rad.legend || ''; fs.append(lg);
        for (const opt of rad.options) {
          const lab = document.createElement('label'); lab.className = 'ask-radio';
          const r = document.createElement('input'); r.type = 'radio'; r.name = rad.name || 'ask-radio'; r.value = opt.value;
          r.checked = opt.value === rad.value;
          const t = document.createElement('span'); t.textContent = opt.label;
          lab.append(r, t); fs.append(lab); radioEls.push(r);
        }
        body.append(fs);
      }
      const choiceOf = () => { const on = radioEls.find((r) => r.checked); return on ? on.value : rad.value; };
      // The text box: label, field and an inline error line under it.
      const field = $('#ask-field'), input = $('#ask-input'), err = $('#ask-err');
      const inp = o.input || null;
      field.hidden = !inp;
      card.classList.toggle('has-input', Boolean(inp));
      if (inp) {
        $('#ask-label').textContent = inp.label || '';
        input.value = inp.value || ''; input.placeholder = inp.placeholder || '';
        if (inp.maxLength > 0) input.maxLength = inp.maxLength; else input.removeAttribute('maxlength');
        err.textContent = ''; input.removeAttribute('aria-invalid');
      }
      $('#ask-foot').textContent = o.foot || '';
      card.setAttribute('role', buttons.some((b) => b.kind === 'danger') ? 'alertdialog' : 'dialog');
      const row = $('#ask-btns'); row.textContent = '';
      row.classList.toggle('choices', choices);
      // Choices with one primary button: that button renders as a plain primary button and the other choices are
      // quieter rows under it (the welcome, spec 2.1). Without a primary, every choice is an equal card.
      row.classList.toggle('has-primary', choices && buttons.some((b) => b.kind === 'primary'));
      const els = buttons.map((b) => {
        const el = document.createElement('button'); el.type = 'button';
        if (b.kind === 'link') {
          // A quiet line with an inline text link (the welcome's help line, spec 2.1): desc is the plain text before
          // the link. The link is a real button, so Tab reaches it and Enter works. It does not depend on the variant,
          // so a 'link' button never falls back to a plain button with no error.
          const line = document.createElement('p'); line.className = 'ask-aside';
          if (b.desc) { const t = document.createElement('span'); t.textContent = b.desc + ' '; line.append(t); }
          el.className = 'linkish'; el.textContent = b.label;
          el.addEventListener('click', () => pick(b));
          line.append(el); row.append(line);
          return el;
        }
        if (choices && b.kind !== 'primary') {
          el.className = 'choice';
          const strong = document.createElement('strong'); strong.textContent = b.label; el.append(strong);
          if (b.desc) { const d = document.createElement('span'); d.textContent = b.desc; el.append(d); }
        } else {
          el.className = 'b' + (b.kind === 'primary' ? ' primary' : b.kind === 'danger' ? ' danger' : '');
          el.textContent = b.label;
        }
        el.addEventListener('click', () => pick(b));
        row.append(el);
        return el;
      });
      const primaryIdx = buttons.findIndex((b) => b.kind === 'primary');
      // The primary button waits for the text: aria-disabled (still focusable, so its reason can be read).
      const check = () => {
        if (!inp || primaryIdx < 0) return null;
        const st = askInputState(input.value, inp);
        els[primaryIdx].setAttribute('aria-disabled', String(!st.ok));
        return st;
      };
      const showErr = (msg) => { err.textContent = msg; if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid'); };
      function pick(b) {
        if (inp && b.kind === 'primary') {
          const st = check();
          if (!st.ok) { showErr(st.error); input.focus(); return; }
          return done(st.text);
        }
        done(rad && b.value !== cancelValue ? { value: b.value, choice: choiceOf() } : b.value);
      }
      const onInput = () => { const st = check(); if (st && st.ok) showErr(''); };
      const onEnter = (e) => {
        if (e.key !== 'Enter' || e.isComposing || primaryIdx < 0) return;
        e.preventDefault(); pick(buttons[primaryIdx]);
      };
      // The page behind is not reachable while the dialog is open.
      const behindEls = [...document.querySelectorAll(behind)];
      const wasInert = behindEls.map((el) => el.inert);
      behindEls.forEach((el) => { el.inert = true; });
      const trap = (e) => {
        if (e.key !== 'Tab') return;
        // A radio group is one Tab stop (the picked radio), as in a native form; arrow keys move inside it.
        const f = [...card.querySelectorAll('button, input')].filter((el) => !el.closest('[hidden]') && (el.type !== 'radio' || el.checked));
        e.preventDefault(); f[trapNext(f.indexOf(document.activeElement), f.length, e.shiftKey)].focus();
      };
      const onBackdrop = (e) => { if (e.target === wrap && o.backdrop !== false) done(cancelValue); };
      const onX = () => done(cancelValue);
      card.addEventListener('keydown', trap); wrap.addEventListener('click', onBackdrop); x.addEventListener('click', onX);
      if (inp) { input.addEventListener('input', onInput); input.addEventListener('keydown', onEnter); }
      check();
      wrap.hidden = false;
      askState = { close: () => done(cancelValue) };
      if (inp) { input.focus(); input.select(); }
      else els[askFirstFocus(buttons, { focus: o.focus, hasFocus: 'focus' in o, cancelValue })].focus();
      function done(v) {
        if (!askState) return;
        card.removeEventListener('keydown', trap); wrap.removeEventListener('click', onBackdrop); x.removeEventListener('click', onX);
        input.removeEventListener('input', onInput); input.removeEventListener('keydown', onEnter);
        wrap.hidden = true; askState = null;
        behindEls.forEach((el, i) => { el.inert = wasInert[i]; });
        if (opener && opener.focus && document.contains(opener)) opener.focus();
        resolve(v);
      }
    });
  }
  const askIsOpen = () => Boolean(askState);

  // ---------- one Esc stack (spec S0.4): Esc closes only the top layer ----------
  // Each layer says if it is open and how to close. A higher rank is nearer the top.
  const ESC_LAYERS = [];
  // rank may be a function, for two side panels that close in the order they opened (Slice 5: the transcript drawer
  // and the shortcut sheet, spec 5.5).
  function escLayer(name, rank, isOpen, close) { ESC_LAYERS.push({ name, rank, isOpen, close }); }
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || e.isComposing) return;
    const top = escTop(ESC_LAYERS.map((l) => { let open = false; try { open = Boolean(l.isOpen()); } catch {} return { rank: typeof l.rank === 'function' ? l.rank() : l.rank, open }; }));
    if (top < 0) return;
    e.preventDefault(); e.stopImmediatePropagation();
    ESC_LAYERS[top].close();
  }, true);
  escLayer('ask', 90, askIsOpen, () => askState.close());
  // Esc on a toast that has focus closes that toast. It never runs the toast's action (Esc on an Undo toast keeps the
  // change). Lowest rank: any open dialog or panel closes first.
  const focusedToast = () => toastList.find((t) => t.el.contains(document.activeElement)) || null;
  escLayer('toast', 1, () => Boolean(focusedToast()), () => { const t = focusedToast(); if (t) toastClose(t); });

  // ---------- a dialog with its own markup (Slice 4: Print / PDF and Copy for the tournament ballot) ----------
  // The same rules as ask(): the page behind is inert, Tab stays inside, Esc / × / the dim layer close it, and focus
  // goes back to the opener. modalDialog(wrap, card, { rank, onClose }) -> { open(focusEl), close(), isOpen() }.
  function modalDialog(wrap, card, opts) {
    const o = opts || {};
    let opener = null, wasInert = [], behindEls = [];
    const isOpen = () => !wrap.hidden;
    // A radio group is one Tab stop (arrow keys move inside it): keep only its checked radio, or its first when none is.
    const oneStop = (el) => el.type !== 'radio' || !el.name || (() => {
      const group = [...card.querySelectorAll('input[type="radio"]')].filter((r) => r.name === el.name);
      return el.checked || (!group.some((r) => r.checked) && group[0] === el);
    })();
    const focusables = () => [...card.querySelectorAll('button, input, select, textarea, a[href], summary')].filter((el) => !el.disabled && !el.closest('[hidden]') && el.offsetParent !== null && oneStop(el));
    const trap = (e) => {
      if (e.key !== 'Tab') return;
      const f = focusables(); if (!f.length) return;
      e.preventDefault(); f[trapNext(f.indexOf(document.activeElement), f.length, e.shiftKey)].focus();
    };
    const onBackdrop = (e) => { if (e.target === wrap) close(); };
    function open(focusEl) {
      if (isOpen()) return;
      opener = document.activeElement;
      behindEls = [...document.querySelectorAll(behind)];
      wasInert = behindEls.map((el) => el.inert);
      behindEls.forEach((el) => { el.inert = true; });
      wrap.hidden = false;
      card.addEventListener('keydown', trap); wrap.addEventListener('mousedown', onBackdrop);
      const first = focusEl || focusables()[0];
      if (first) first.focus();
    }
    function close() {
      if (!isOpen()) return;
      wrap.hidden = true;
      card.removeEventListener('keydown', trap); wrap.removeEventListener('mousedown', onBackdrop);
      behindEls.forEach((el, i) => { el.inert = wasInert[i]; });
      if (o.onClose) o.onClose();
      if (opener && opener.focus && document.contains(opener)) opener.focus();
    }
    escLayer(o.name || 'modal', o.rank || 85, isOpen, close);
    return { open, close, isOpen };
  }

  return Object.freeze({ toast, dismissToast, pendingUndo, announce, ask, askIsOpen, escLayer, modalDialog });
}

(globalThis.TabulaCore = globalThis.TabulaCore || {}).ui = Object.freeze({ escTop, TOAST_MAX, toastPlan, toastMs, toastTab, toastSpoken, askFirstFocus, trapNext, askInputState, createUI });
