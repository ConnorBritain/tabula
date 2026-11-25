// Library page script. Copied to learn/library.js by build-learn.mjs and loaded at the end of every page.
// The pages work without it; it adds three things.

// 1. The app link. The same learn/ folder is served by tabuladebate.com and by the app (bridge.mjs, PLAN.md §8.1).
//    The markup links to the app's web address, which is right on the website. Inside the app, the app is the
//    site root, so the link goes back there ("Back to the app") and the reader never leaves the running app.
(() => {
  // The website and its local preview (port 8782).
  const onSite = /(^|\.)tabuladebate\.com$/.test(location.hostname) || location.port === '8782';
  if (onSite) return;
  for (const a of document.querySelectorAll('a[data-app]')) {
    a.href = a.dataset.app;
    if (a.dataset.backLabel) a.textContent = a.dataset.backLabel;
  }
})();

// 2. The phone menu closes on Escape or a click outside it.
(() => {
  const menu = document.querySelector('details.menu');
  if (!menu) return;
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.open) { menu.open = false; menu.querySelector('summary').focus(); } });
  document.addEventListener('click', (e) => { if (menu.open && !menu.contains(e.target)) menu.open = false; });
})();

// 3. Reading helper for long pages.
// It works from the page's "On this page" list (nav.toc), which the builder writes. Without this script the page
// still works: the list shows on wide screens, and the fold-out list shows on phones.
// It adds: the current section and progress in the side list, and a floating button that opens the section list,
// with progress and minutes left (the pattern of reading apps such as Apple Books and Kindle).
(() => {
  const toc = document.querySelector('nav.toc');
  const main = document.querySelector('.page-main');
  if (!toc || !main) return;
  const links = [...toc.querySelectorAll('a[href^="#"]')];
  const heads = links.map((a) => document.getElementById(a.getAttribute('href').slice(1))).filter(Boolean);
  if (!links.length || heads.length !== links.length) return; // leave the plain lists in place
  document.documentElement.classList.add('has-reader'); // only now: this hides the fold-out list (learn.css)
  const minutes = Number(main.dataset.minutes) || 0;
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; };

  // Side list: a progress line and the minutes left, under its title.
  const sideBar = el('div', 'rd-bar'); const sideFill = el('div', 'rd-fill'); sideBar.append(sideFill);
  const sideLeft = el('p', 'rd-left');
  toc.querySelector('.toc-title').after(sideBar, sideLeft);

  // Floating button and its panel.
  const btn = el('button', 'rd-pill'); btn.type = 'button';
  btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-controls', 'rd-panel');
  const pct = el('span', 'rd-pct'); const label = el('span', 'rd-label'); const sec = el('span', 'rd-sec'); const left = el('span', 'rd-time');
  label.append(sec, left);
  const icon = el('span', 'rd-icon'); // a list icon, so the bar reads as something to tap
  icon.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/></svg>';
  btn.append(pct, label, icon);
  const panel = el('div', 'rd-panel'); panel.id = 'rd-panel'; panel.hidden = true;
  // A disclosure, not a dialog: the button says it is expanded and which panel it controls; focus is not trapped.
  panel.setAttribute('aria-labelledby', 'rd-title');
  const head = el('div', 'rd-head'); const title = el('p', 'rd-title', 'On this page'); title.id = 'rd-title';
  const close = el('button', 'rd-close', 'Close'); close.type = 'button';
  head.append(title, close);
  const pBar = el('div', 'rd-bar'); const pFill = el('div', 'rd-fill'); pBar.append(pFill);
  const pLeft = el('p', 'rd-left');
  const list = el('ol', 'rd-list');
  const panelLinks = links.map((a) => { const li = el('li'); const c = el('a', '', a.textContent); c.href = a.hash; li.append(c); list.append(li); return c; });
  panel.append(head, pBar, pLeft, list);
  document.body.append(btn, panel);

  const open = () => { panel.hidden = false; btn.setAttribute('aria-expanded', 'true'); (panelLinks.find((a) => a.getAttribute('aria-current')) || panelLinks[0]).focus(); };
  const shut = (focus) => { if (panel.hidden) return; panel.hidden = true; btn.setAttribute('aria-expanded', 'false'); if (focus) btn.focus(); };
  btn.addEventListener('click', () => (panel.hidden ? open() : shut(true)));
  close.addEventListener('click', () => shut(true));
  panelLinks.forEach((a) => a.addEventListener('click', () => shut(false)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') shut(true); });
  document.addEventListener('click', (e) => { if (!panel.hidden && !panel.contains(e.target) && !btn.contains(e.target)) shut(false); });
  panel.addEventListener('focusout', (e) => { if (e.relatedTarget && !panel.contains(e.relatedTarget) && e.relatedTarget !== btn) shut(false); });

  let queued = false;
  function update() {
    queued = false;
    const top = main.getBoundingClientRect().top + scrollY;
    const span = Math.max(1, main.offsetHeight - innerHeight);
    const done = Math.min(1, Math.max(0, (scrollY - top) / span));
    const p = Math.round(done * 100);
    let at = -1;
    heads.forEach((h, i) => { if (h.getBoundingClientRect().top < 120) at = i; });
    const leftText = done >= 0.99 ? 'Finished' : minutes ? `${Math.max(1, Math.ceil(minutes * (1 - done)))} min left` : `${p}% read`;
    sideFill.style.width = pFill.style.width = `${p}%`;
    sideLeft.textContent = pLeft.textContent = leftText;
    pct.textContent = `${p}%`;
    sec.textContent = at >= 0 ? heads[at].textContent : 'On this page';
    left.textContent = leftText;
    [links, panelLinks].forEach((set) => set.forEach((a, i) => {
      if (i === at) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
      a.classList.toggle('rd-done', i < at);
    }));
    const show = scrollY > 320 || !panel.hidden;
    btn.classList.toggle('rd-show', show);
    btn.inert = !show; // a hidden button is out of the tab order and the accessibility tree
  }
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue);
  update();
})();

// 4. Library home: the path choices work as tabs, so one path shows at a time and its name is not repeated.
//    Without the script, the choices are jump links and every path shows as its own card.
(() => {
  const bar = document.querySelector('.path-chooser');
  if (!bar) return;
  const tabs = [...bar.querySelectorAll('a.path-pick')];
  const panels = tabs.map((t) => document.getElementById(t.getAttribute('href').slice(1))?.closest('.path-card'));
  if (!tabs.length || panels.some((p) => !p)) return; // leave the plain cards in place
  bar.setAttribute('role', 'tablist');
  tabs.forEach((t, i) => {
    const key = t.getAttribute('href').slice(1);
    t.id = `tab-${key}`;
    panels[i].id = `panel-${key}`;
    t.setAttribute('role', 'tab');
    t.setAttribute('aria-controls', panels[i].id);
    panels[i].setAttribute('role', 'tabpanel');
    panels[i].setAttribute('aria-labelledby', t.id);
  });
  document.documentElement.classList.add('has-path-tabs'); // only now: this hides each card's own heading (learn.css)
  const select = (n, focus) => {
    tabs.forEach((t, i) => {
      t.setAttribute('aria-selected', String(i === n));
      t.tabIndex = i === n ? 0 : -1;
      panels[i].hidden = i !== n;
    });
    if (focus) tabs[n].focus();
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', (e) => { e.preventDefault(); select(i); history.replaceState(null, '', t.getAttribute('href')); });
    t.addEventListener('keydown', (e) => {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      const to = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : step ? (i + step + tabs.length) % tabs.length : -1;
      if (to >= 0) { e.preventDefault(); select(to, true); }
    });
  });
  const fromHash = () => tabs.findIndex((t) => t.getAttribute('href') === location.hash);
  select(Math.max(0, fromHash()));
  addEventListener('hashchange', () => { const n = fromHash(); if (n >= 0) select(n); }); // back/forward and in-page links
})();
