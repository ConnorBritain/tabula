// Tabula Debate's UI parts (spec Slice 0). The toast, the in-app dialog ask(), the one Esc stack and the screen-reader
// announcer are shared code in core/ui.js; this file builds them once for the debate page (with debate's BEHIND list)
// and adds the tips, which still use debate's #flow-tabs. Loaded by index.html after logic.js and before app.js.
(function (root) {
  'use strict';
  const L = root.PolicyLogic;
  const $ = (s) => document.querySelector(s);

  // The toast, ask(), the Esc stack, the announcer and modalDialog are shared code in core/ui.js. Debate gives it the
  // parts of its page that a dialog makes inert.
  // The parts of the page a modal makes inert (ask, modalDialog and the palette). One list, so a new side panel is added once.
  const BEHIND = 'header, main, .roundbar, #tr-drawer, #keys-sheet, #study-card';
  const { toast, dismissToast, pendingUndo, announce, ask, askIsOpen, escLayer, modalDialog } = root.TabulaCore.ui.createUI({ behind: BEHIND });

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
  const kindOf = (el) => (el.closest('#flow-tabs') && el.matches('[data-i], [data-ai-sheet]') ? 'sheet' : 'label');
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
    // A tip that is open follows its data-tip too (the recording status tip counts seconds while it is open).
    if (lt.el && !label.hidden && lt.el.dataset.tip && label.textContent !== lt.el.dataset.tip) label.textContent = lt.el.dataset.tip;
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
