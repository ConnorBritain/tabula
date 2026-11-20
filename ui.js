// Tabula's shared UI parts (spec Slice 0): the toast, the in-app dialog ask(), the one Esc stack and the
// screen-reader announcer. Each is built once here and used by every slice. Loaded by index.html after
// logic.js and before app.js. The rules (which toast to close, which button gets focus, which layer is on top)
// are pure functions in logic.js with unit tests; this file only does the DOM work.
(function (root) {
  'use strict';
  const L = root.PolicyLogic;
  const $ = (s) => document.querySelector(s);

  // ---------- toasts (spec 4.3) ----------
  // toast(msg, { kind: 'info' | 'error', action: { label, run }, key }). Info toasts time out (L.toastMs);
  // errors stay until closed. The same key or text restarts the timer instead of adding a copy. At most 3.
  // Screen readers hear info politely and errors at once, through two permanent live regions.
  const toastList = [];
  function toast(msg, opts) {
    const o = opts || {};
    const kind = o.kind === 'error' ? 'error' : 'info';
    const text = String(msg);
    const region = document.getElementById(kind === 'error' ? 'toasts-alert' : 'toasts-polite');
    if (region) { region.textContent = ''; setTimeout(() => { region.textContent = text; }, 60); }
    const plan = L.toastPlan(toastList.map((t) => ({ key: t.key, msg: t.msg, action: Boolean(t.action) })), { key: o.key || '', msg: text, action: Boolean(o.action) });
    if (plan.reuse >= 0) {
      const same = toastList[plan.reuse];
      same.msg = text; same.el.querySelector('.toast-msg').textContent = text;
      same.ms = L.toastMs(text, same.kind, Boolean(same.action)); toastArm(same);
      return same;
    }
    plan.close.map((i) => toastList[i]).forEach(toastClose);
    const el = document.createElement('div');
    el.className = 'toast' + (kind === 'error' ? ' is-error' : '');
    const t = { el, msg: text, key: o.key || '', kind, action: o.action || null, ms: L.toastMs(text, kind, Boolean(o.action)), timer: null, left: 0, at: 0, hover: false, focus: false };
    if (kind === 'error') { const i = document.createElement('span'); i.className = 'toast-icon'; i.setAttribute('aria-hidden', 'true'); i.textContent = '!'; el.append(i); }
    const m = document.createElement('span'); m.className = 'toast-msg'; m.textContent = text; el.append(m);
    if (t.action) {
      const a = document.createElement('button'); a.type = 'button'; a.className = 'toast-act'; a.textContent = t.action.label;
      a.addEventListener('click', () => { toastClose(t); t.action.run(); });
      el.append(a);
    }
    const x = document.createElement('button'); x.type = 'button'; x.className = 'toast-x'; x.setAttribute('aria-label', 'Dismiss message'); x.textContent = '×';
    x.addEventListener('click', () => toastClose(t));
    el.append(x);
    // The timer waits while the pointer or focus is on the toast; then at least 2 s remain (WCAG 2.2.1).
    const hold = (k, on) => { t[k] = on; if (t.hover || t.focus) toastPause(t); else toastResume(t); };
    el.addEventListener('mouseenter', () => hold('hover', true));
    el.addEventListener('mouseleave', () => hold('hover', false));
    el.addEventListener('focusin', () => hold('focus', true));
    el.addEventListener('focusout', (e) => { if (!el.contains(e.relatedTarget)) hold('focus', false); });
    $('#toasts').append(el); toastList.push(t); toastArm(t);
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
    toastList.splice(i, 1); t.el.remove();
  }
  // Close the toast with this key, if one shows (for example the storage error after a save works again).
  function dismissToast(key) { toastList.filter((t) => t.key === key).forEach(toastClose); }

  // A short message for screen readers only (for example the view-only and recording messages).
  function announce(text) { const r = document.getElementById('sr-status'); if (!r) return; r.textContent = ''; setTimeout(() => { r.textContent = text; }, 60); }

  // ---------- the in-app dialog: ask(opts) -> Promise<value | null> (spec 4.2, S0.3) ----------
  // opts: { title, body (a string or a list of paragraphs), foot, buttons: [{ label, value, kind: 'primary'|'danger'|'plain' }],
  //         cancelValue, focus (the value of the button that gets focus first) }.
  // Esc, × and a click on the dim layer give cancelValue. Focus is trapped and returns to the opener. One at a time.
  let askState = null, askChain = Promise.resolve();
  function ask(opts) { const p = askChain.then(() => askOpen(opts || {})); askChain = p.catch(() => {}); return p; }
  function askOpen(o) {
    return new Promise((resolve) => {
      const wrap = $('#ask'), card = $('#ask-card'), x = $('#ask-x');
      const opener = document.activeElement;
      const buttons = o.buttons && o.buttons.length ? o.buttons.slice(0, 3) : [{ label: 'OK', value: true, kind: 'primary' }];
      const cancelValue = 'cancelValue' in o ? o.cancelValue : null;
      $('#ask-title').textContent = o.title || '';
      const body = $('#ask-body'); body.textContent = '';
      for (const para of [].concat(o.body || [])) { const p = document.createElement('p'); p.textContent = para; body.append(p); }
      $('#ask-foot').textContent = o.foot || '';
      card.setAttribute('role', buttons.some((b) => b.kind === 'danger') ? 'alertdialog' : 'dialog');
      const row = $('#ask-btns'); row.textContent = '';
      const els = buttons.map((b) => {
        const el = document.createElement('button'); el.type = 'button';
        el.className = 'b' + (b.kind === 'primary' ? ' primary' : b.kind === 'danger' ? ' danger' : '');
        el.textContent = b.label; el.addEventListener('click', () => done(b.value)); row.append(el);
        return el;
      });
      // The page behind is not reachable while the dialog is open.
      const behind = [...document.querySelectorAll('header, main, .roundbar, #tr-drawer')];
      const wasInert = behind.map((el) => el.inert);
      behind.forEach((el) => { el.inert = true; });
      const trap = (e) => {
        if (e.key !== 'Tab') return;
        const f = [...card.querySelectorAll('button')];
        e.preventDefault(); f[L.trapNext(f.indexOf(document.activeElement), f.length, e.shiftKey)].focus();
      };
      const onBackdrop = (e) => { if (e.target === wrap) done(cancelValue); };
      const onX = () => done(cancelValue);
      card.addEventListener('keydown', trap); wrap.addEventListener('click', onBackdrop); x.addEventListener('click', onX);
      wrap.hidden = false;
      askState = { close: () => done(cancelValue) };
      els[L.askFirstFocus(buttons, { focus: o.focus, hasFocus: 'focus' in o, cancelValue })].focus();
      function done(v) {
        if (!askState) return;
        card.removeEventListener('keydown', trap); wrap.removeEventListener('click', onBackdrop); x.removeEventListener('click', onX);
        wrap.hidden = true; askState = null;
        behind.forEach((el, i) => { el.inert = wasInert[i]; });
        if (opener && opener.focus && document.contains(opener)) opener.focus();
        resolve(v);
      }
    });
  }
  const askIsOpen = () => Boolean(askState);

  // ---------- one Esc stack (spec S0.4): Esc closes only the top layer ----------
  // Each layer says if it is open and how to close. A higher rank is nearer the top.
  const ESC_LAYERS = [];
  function escLayer(name, rank, isOpen, close) { ESC_LAYERS.push({ name, rank, isOpen, close }); }
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || e.isComposing) return;
    const top = L.escTop(ESC_LAYERS.map((l) => { let open = false; try { open = Boolean(l.isOpen()); } catch {} return { rank: l.rank, open }; }));
    if (top < 0) return;
    e.preventDefault(); e.stopImmediatePropagation();
    ESC_LAYERS[top].close();
  }, true);
  escLayer('ask', 90, askIsOpen, () => askState.close());

  root.TabulaUI = { toast, dismissToast, announce, ask, askIsOpen, escLayer };
})(window);
