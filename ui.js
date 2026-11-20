// Tabula's shared UI parts (spec Slice 0): the toast, the in-app dialog ask(), the one Esc stack and the
// screen-reader announcer. Each is built once here and used by every slice. Loaded by index.html after
// logic.js and before app.js. The rules (which toast to close, which button gets focus, which layer is on top)
// are pure functions in logic.js with unit tests; this file only does the DOM work.
(function (root) {
  'use strict';
  const L = root.PolicyLogic;
  const $ = (s) => document.querySelector(s);

  // ---------- toasts (spec 4.3) ----------
  // toast(msg, { kind: 'info' | 'error', action: { label, name (the button's accessible name, e.g. "Undo: delete sheet"), run }, key }). Info toasts time out (L.toastMs);
  // errors stay until closed. The same key or text restarts the timer instead of adding a copy. At most 3.
  // Screen readers hear info politely and errors at once, through two permanent live regions.
  const toastList = [];
  // The parts of the page a modal makes inert (ask, modalDialog and the palette). One list, so a new side panel is added once.
  const BEHIND = 'header, main, .roundbar, #tr-drawer, #keys-sheet, #study-card';
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
      if (t.action.name) a.setAttribute('aria-label', t.action.name);
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
    toastList.splice(i, 1); t.el.remove(); toastsChanged();
  }
  // Close the toast with this key, if one shows (for example the storage error after a save works again).
  function dismissToast(key) { toastList.filter((t) => t.key === key).forEach(toastClose); }
  // The Undo that waits now, for the palette row "Undo: {what}" (spec 4.3, 5.4): { name, run } or null.
  // Only one Undo waits at a time (L.toastPlan). run() closes its toast and undoes, like the toast's own button.
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
  //         buttons: [{ label, value, kind: 'primary'|'danger'|'plain', desc }], cancelValue,
  //         focus (the value of the button that gets focus first), backdrop (false: a click on the dim layer does nothing),
  //         variant ('choices': buttons with a desc show as large choice cards, as on the welcome) }.
  // With an input, the primary button resolves with the typed text (trimmed); other buttons resolve with their value.
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
      const els = buttons.map((b) => {
        const el = document.createElement('button'); el.type = 'button';
        if (choices) {
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
        const st = L.askInputState(input.value, inp);
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
        done(b.value);
      }
      const onInput = () => { const st = check(); if (st && st.ok) showErr(''); };
      const onEnter = (e) => {
        if (e.key !== 'Enter' || e.isComposing || primaryIdx < 0) return;
        e.preventDefault(); pick(buttons[primaryIdx]);
      };
      // The page behind is not reachable while the dialog is open.
      const behind = [...document.querySelectorAll(BEHIND)];
      const wasInert = behind.map((el) => el.inert);
      behind.forEach((el) => { el.inert = true; });
      const trap = (e) => {
        if (e.key !== 'Tab') return;
        const f = [...card.querySelectorAll('button, input')].filter((el) => !el.closest('[hidden]'));
        e.preventDefault(); f[L.trapNext(f.indexOf(document.activeElement), f.length, e.shiftKey)].focus();
      };
      const onBackdrop = (e) => { if (e.target === wrap && o.backdrop !== false) done(cancelValue); };
      const onX = () => done(cancelValue);
      card.addEventListener('keydown', trap); wrap.addEventListener('click', onBackdrop); x.addEventListener('click', onX);
      if (inp) { input.addEventListener('input', onInput); input.addEventListener('keydown', onEnter); }
      check();
      wrap.hidden = false;
      askState = { close: () => done(cancelValue) };
      if (inp) { input.focus(); input.select(); }
      else els[L.askFirstFocus(buttons, { focus: o.focus, hasFocus: 'focus' in o, cancelValue })].focus();
      function done(v) {
        if (!askState) return;
        card.removeEventListener('keydown', trap); wrap.removeEventListener('click', onBackdrop); x.removeEventListener('click', onX);
        input.removeEventListener('input', onInput); input.removeEventListener('keydown', onEnter);
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
  // rank may be a function, for two side panels that close in the order they opened (Slice 5: the transcript drawer
  // and the shortcut sheet, spec 5.5).
  function escLayer(name, rank, isOpen, close) { ESC_LAYERS.push({ name, rank, isOpen, close }); }
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || e.isComposing) return;
    const top = L.escTop(ESC_LAYERS.map((l) => { let open = false; try { open = Boolean(l.isOpen()); } catch {} return { rank: typeof l.rank === 'function' ? l.rank() : l.rank, open }; }));
    if (top < 0) return;
    e.preventDefault(); e.stopImmediatePropagation();
    ESC_LAYERS[top].close();
  }, true);
  escLayer('ask', 90, askIsOpen, () => askState.close());

  // ---------- a dialog with its own markup (Slice 4: Print / PDF and Copy for the tournament ballot) ----------
  // The same rules as ask(): the page behind is inert, Tab stays inside, Esc / × / the dim layer close it, and focus
  // goes back to the opener. modalDialog(wrap, card, { rank, onClose }) -> { open(focusEl), close(), isOpen() }.
  function modalDialog(wrap, card, opts) {
    const o = opts || {};
    let opener = null, wasInert = [], behind = [];
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
      e.preventDefault(); f[L.trapNext(f.indexOf(document.activeElement), f.length, e.shiftKey)].focus();
    };
    const onBackdrop = (e) => { if (e.target === wrap) close(); };
    function open(focusEl) {
      if (isOpen()) return;
      opener = document.activeElement;
      behind = [...document.querySelectorAll(BEHIND)];
      wasInert = behind.map((el) => el.inert);
      behind.forEach((el) => { el.inert = true; });
      wrap.hidden = false;
      card.addEventListener('keydown', trap); wrap.addEventListener('mousedown', onBackdrop);
      const first = focusEl || focusables()[0];
      if (first) first.focus();
    }
    function close() {
      if (!isOpen()) return;
      wrap.hidden = true;
      card.removeEventListener('keydown', trap); wrap.removeEventListener('mousedown', onBackdrop);
      behind.forEach((el, i) => { el.inert = wasInert[i]; });
      if (o.onClose) o.onClose();
      if (opener && opener.focus && document.contains(opener)) opener.focus();
    }
    escLayer(o.name || 'modal', o.rank || 85, isOpen, close);
    return { open, close, isOpen };
  }

  // ---------- tips: one module for label tips and help bubbles (spec 4.4, V11) ----------
  // Label tip: any element with data-tip="…". It shows after L.tipDelay (1 s on sheet tabs, 0.5 s on the rest), at once
  // on keyboard focus, and after a 500 ms long press on touch. It hides on mouse-out, blur, scroll, a key press or Esc.
  // The pointer may move onto the tip (WCAG 1.4.13): leaving the target waits a moment before the tip goes.
  // Help bubble: a .tip-wrap holding a .tip button and its .tip-box. It opens on a 0.5 s hover or a click; a click
  // pins it; a second click, a click outside or Esc closes it. Both use one look (.tip-box) and one placement rule.
  // No tip is ever the only way to learn something: every control has a visible name or an aria-label.
  const label = document.createElement('div');
  label.className = 'tip-box'; label.id = 'tip-label'; label.setAttribute('role', 'tooltip'); label.hidden = true;
  document.body.append(label);
  const rbH = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--rb-h')) || 0;
  function place(box, target) {
    const r = target.getBoundingClientRect();
    box.style.left = '0px'; box.style.top = '0px';
    const pos = L.tipPlace({ top: r.top, left: r.left, width: r.width, height: r.height }, { w: box.offsetWidth, h: box.offsetHeight }, { w: innerWidth, h: innerHeight, bottomInset: rbH() });
    box.style.left = pos.left + 'px'; box.style.top = pos.top + 'px';
  }
  const tipOf = (t) => (t && t.closest ? t.closest('[data-tip]') : null);
  const kindOf = (el) => (el.closest('#flow-tabs') && el.matches('[data-i], [data-ai]') ? 'sheet' : 'label');
  const lt = { el: null, timer: 0, hideTimer: 0 };
  function showLabel(el) {
    if (!el.isConnected || !el.dataset.tip) return;
    lt.el = el; label.textContent = el.dataset.tip; label.hidden = false; place(label, el);
  }
  function hideLabel() { clearTimeout(lt.timer); clearTimeout(lt.hideTimer); lt.el = null; label.hidden = true; }
  function armLabel(el) { clearTimeout(lt.timer); lt.el = el; lt.timer = setTimeout(() => showLabel(el), L.tipDelay(kindOf(el))); }
  document.addEventListener('mouseover', (e) => {
    if (label.contains(e.target)) { clearTimeout(lt.hideTimer); return; }
    const el = tipOf(e.target);
    if (el && el === lt.el) { clearTimeout(lt.hideTimer); return; }
    if (!label.hidden) { clearTimeout(lt.hideTimer); lt.hideTimer = setTimeout(() => { hideLabel(); if (el) armLabel(el); }, 150); return; }
    hideLabel();
    if (el && el.dataset.tip) armLabel(el);
  });
  // Esc time is read on window, before the Esc stack on document stops the event.
  let escAt = -Infinity;
  addEventListener('keydown', (e) => { if (e.key === 'Escape') escAt = performance.now(); }, true);
  document.addEventListener('focusin', (e) => {
    const el = tipOf(e.target);
    if (el && L.tipOnFocus(e.target.matches(':focus-visible'), performance.now() - escAt)) { hideLabel(); showLabel(el); }
  });
  for (const ev of ['focusout', 'mousedown', 'scroll', 'keydown']) document.addEventListener(ev, (e) => { if (ev === 'keydown' && e.key === 'Escape') return; hideLabel(); }, true);
  // Touch: a 500 ms long press shows the label tip. Only the click that ends that press is eaten (L.pressStep).
  let press = 0, ps = L.pressStep(null, 'cancel');
  const step = (ev) => { ps = L.pressStep(ps, ev); return ps; };
  document.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    step('down'); clearTimeout(press); hideLabel();
    const el = tipOf(e.target); if (!el) { step('cancel'); return; }
    press = setTimeout(() => { step('fire'); showLabel(el); }, 500);
  }, true);
  document.addEventListener('pointermove', (e) => { if (e.pointerType === 'touch' && Math.abs(e.movementX) + Math.abs(e.movementY) > 6 && ps.timer) { clearTimeout(press); step('move'); } }, true);
  document.addEventListener('pointerup', (e) => { if (e.pointerType === 'touch') { clearTimeout(press); step('up'); } }, true);
  document.addEventListener('pointercancel', (e) => { if (e.pointerType === 'touch') { clearTimeout(press); step('cancel'); } }, true);
  // A long press on Android gives contextmenu and no click: drop the eat so the next tap goes through.
  document.addEventListener('contextmenu', () => { if (ps.eat) step('cancel'); }, true);
  document.addEventListener('click', (e) => { if (step('click').eatNow) { e.preventDefault(); e.stopPropagation(); } }, true);

  // Screen readers: a label tip that adds words to the control's name is tied to it with aria-describedby
  // (spec 4.4). Each such control points at its own hidden copy of the tip text, so the words are there before
  // any tip shows. The copies follow data-tip and aria-label changes made by app.js.
  const descBox = document.createElement('div');
  descBox.id = 'tip-descs'; descBox.hidden = true;
  document.body.append(descBox);
  const descOf = new Map(); let descN = 0, descQueued = false;
  const nameOf = (el) => el.getAttribute('aria-label') || el.textContent || '';
  function setDescribedBy(el, id, on) {
    const ids = (el.getAttribute('aria-describedby') || '').split(/\s+/).filter((x) => x && x !== id);
    if (on) ids.push(id);
    if (ids.length) el.setAttribute('aria-describedby', ids.join(' ')); else el.removeAttribute('aria-describedby');
  }
  function syncDescs() {
    descQueued = false;
    for (const [el, span] of descOf) if (!el.isConnected || !el.dataset.tip || !L.tipAddsWords(nameOf(el), el.dataset.tip)) {
      if (el.isConnected) setDescribedBy(el, span.id, false);
      span.remove(); descOf.delete(el);
    }
    for (const el of document.querySelectorAll('[data-tip]')) {
      if (!L.tipAddsWords(nameOf(el), el.dataset.tip)) continue;
      let span = descOf.get(el);
      if (!span) { span = document.createElement('span'); span.id = 'tip-desc-' + (++descN); descBox.append(span); descOf.set(el, span); }
      if (span.textContent !== el.dataset.tip) span.textContent = el.dataset.tip;
      setDescribedBy(el, span.id, true);
    }
  }
  const queueDescs = () => { if (!descQueued) { descQueued = true; requestAnimationFrame(syncDescs); } };
  new MutationObserver((list) => { if (list.some((m) => !descBox.contains(m.target))) queueDescs(); })
    .observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-tip', 'aria-label'] });
  queueDescs();

  // Help bubbles.
  let pinned = null, hovered = null, bubbleTimer = 0;
  const partsOf = (wrap) => ({ btn: wrap.querySelector('.tip'), box: wrap.querySelector('.tip-box') });
  function setBubble(wrap, on) {
    const { btn, box } = partsOf(wrap);
    if (!btn || !box) return;
    box.hidden = !on; btn.setAttribute('aria-expanded', String(on));
    if (on) place(box, btn);
  }
  const isOpen = (wrap) => wrap && partsOf(wrap).btn.getAttribute('aria-expanded') === 'true';
  document.addEventListener('mouseover', (e) => {
    const wrap = e.target.closest && e.target.closest('.tip-wrap');
    if (wrap === hovered) return;
    clearTimeout(bubbleTimer);
    if (hovered && hovered !== pinned) setBubble(hovered, false);
    hovered = wrap;
    if (wrap && wrap !== pinned) bubbleTimer = setTimeout(() => setBubble(wrap, true), L.tipDelay('help'));
  });
  document.addEventListener('click', (e) => {
    const btn = e.target.closest && e.target.closest('.tip-wrap > .tip');
    if (!btn) {
      if (pinned && !pinned.contains(e.target)) { setBubble(pinned, false); pinned = null; }
      return;
    }
    const wrap = btn.parentElement;
    clearTimeout(bubbleTimer);
    if (pinned && pinned !== wrap) { setBubble(pinned, false); pinned = null; }
    if (pinned === wrap) { pinned = null; setBubble(wrap, false); } // open and pinned: a second click closes it
    else { pinned = wrap; setBubble(wrap, true); } // closed, or open from a hover: it opens and stays
  });
  const reflow = () => { if (pinned) setBubble(pinned, true); };
  addEventListener('resize', reflow); document.addEventListener('scroll', reflow, true);
  // Esc closes a tip without moving focus or closing the layer under it.
  escLayer('tip', 95, () => !label.hidden || isOpen(pinned) || isOpen(hovered), () => {
    hideLabel();
    for (const w of [pinned, hovered]) if (w) setBubble(w, false);
    pinned = null;
  });

  root.TabulaUI = { BEHIND, toast, dismissToast, pendingUndo, announce, ask, askIsOpen, escLayer, modalDialog };
})(window);
