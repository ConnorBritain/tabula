// Library page script. Copied to learn/library.js by build-learn.mjs and loaded at the end of every page.
// The pages work without it; it adds three things.

// 1. The app link. The same learn/ folder is served by tabuladebate.com and by the app (bridge.mjs, PLAN.md §8.1).
//    The markup links to the app's web address, which is right on the website. Inside the app, the app is the
//    site root, so the link goes back there ("Back to the app") and the reader never leaves the running app.
(() => {
  // The website and its local preview (port 8782, tabula-sites serve.mjs; see docs/marketing/SITES.md).
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
  label.append(sec, left); btn.append(pct, label);
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
