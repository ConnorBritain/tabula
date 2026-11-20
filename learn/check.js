// Debate Library checks and track progress (docs/library/TRACKS.md §3.4, §4). Copied to learn/check.js by build-learn.mjs.
// License: AGPL-3.0, like the app (this is code, not library text).
// Safety: the library shares its site with the app, which keeps API keys in this browser. So this script reads and
// writes ONLY its own key, never builds HTML from stored or imported text, and works when storage is blocked.
(function () {
  'use strict';
  const KEY = 'tabula.learn.v1';
  const SLUG = /^[a-z0-9-]{1,60}$/;
  const DATE = /^\d{4}-\d{2}-\d{2}$/;

  // ---------- pure helpers (tested in node) ----------

  // Keep only the shape we expect: { steps: { slug: { v, done } }, tracks: { id: { done } } }. Anything else is dropped.
  function clean(data) {
    const out = { steps: {}, tracks: {} };
    if (!data || typeof data !== 'object') return out;
    for (const [slug, s] of Object.entries(data.steps || {})) {
      if (SLUG.test(slug) && s && Number.isInteger(s.v) && s.v > 0 && s.v < 1000 && typeof s.done === 'string' && DATE.test(s.done)) out.steps[slug] = { v: s.v, done: s.done };
    }
    for (const [id, t] of Object.entries(data.tracks || {})) {
      if (SLUG.test(id) && t && typeof t.done === 'string' && DATE.test(t.done)) out.tracks[id] = { done: t.done };
    }
    return out;
  }
  // A question is right when the chosen set equals the right set (order does not matter).
  function isRight(keys, chosen) {
    return keys.length === chosen.length && keys.every((k, i) => k === chosen[i]);
  }
  function progress(steps, store) {
    const done = steps.filter((s) => store.steps[s]);
    return { done: done.length, total: steps.length, next: steps.find((s) => !store.steps[s]) || null };
  }
  // Today's date in the reader's own time zone (not UTC), as YYYY-MM-DD.
  const today = () => { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };

  // Storage. Every call can fail (private mode, blocked storage), so each one is wrapped and has a safe fallback.
  // `box` is localStorage in the browser, or a stand-in in tests.
  function storage(box) {
    return {
      load() { try { return clean(JSON.parse(box().getItem(KEY) || '{}')); } catch { return clean(null); } },
      save(store) { try { box().setItem(KEY, JSON.stringify(clean(store))); return true; } catch { return false; } },
      clear() { try { box().removeItem(KEY); return true; } catch { return false; } },
    };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { clean, isRight, progress, today, storage, KEY };
  if (typeof document === 'undefined') return;

  const store_ = storage(() => window.localStorage);
  const load = store_.load, save = store_.save;
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  // ---------- a check at the foot of a page ----------

  function setupCheck(section) {
    const slug = section.dataset.check;
    const version = Number(section.dataset.version);
    const status = section.querySelector('.check-status');
    const questions = [...section.querySelectorAll('.q')].map((q, n) => (q.classList.contains('self') ? setupSelf(q, n) : setupChoice(q, n)));
    const actions = section.querySelector('.check-actions');
    actions.hidden = false;
    const before = load().steps[slug];
    if (before) status.textContent = `You finished this check on ${before.done}.${before.v < version ? ' The page was updated since then, so you may want to review it.' : ''}`;
    actions.querySelector('[data-act="grade"]').addEventListener('click', () => {
      const results = questions.map((q) => q.grade());
      const right = results.filter(Boolean).length;
      if (right === results.length) {
        const store = load();
        store.steps[slug] = { v: version, done: today() };
        const saved = save(store);
        status.textContent = `All ${right} right. This step is done.${saved ? '' : ' (Your browser blocks saving, so this is not remembered.)'}`;
      } else {
        status.textContent = `${right} of ${results.length} right. Read the "why" under each question, then try again.`;
      }
    });
  }

  function setupChoice(q, n) {
    const list = q.querySelector('.choices');
    const details = q.querySelector('details');
    const why = details.querySelector('.why');
    const multi = q.dataset.multi === '1';
    const fs = el('fieldset', 'choices-form');
    const legend = el('legend', 'visually-hidden', q.querySelector('.prompt').textContent);
    fs.append(legend);
    const inputs = [...list.children].map((li, i) => {
      const label = el('label', 'choice');
      const input = el('input');
      input.type = multi ? 'checkbox' : 'radio';
      input.name = `q${n}-${q.closest('.check').dataset.check}`;
      input.value = String(i);
      const mark = el('span', 'mark');
      const text = el('span');
      while (li.firstChild) text.append(li.firstChild); // move the built choice text (not rebuilt from strings)
      label.append(input, text, mark);
      fs.append(label);
      return { input, mark, key: li.dataset.key === '1' };
    });
    if (multi) fs.append(el('p', 'hint', 'Pick all that apply.'));
    list.replaceWith(fs);
    const whyBox = el('div', 'why-box');
    whyBox.hidden = true;
    whyBox.append(why);
    details.replaceWith(whyBox);
    return {
      grade() {
        const keys = inputs.map((x, i) => (x.key ? i : -1)).filter((i) => i >= 0);
        const chosen = inputs.map((x, i) => (x.input.checked ? i : -1)).filter((i) => i >= 0);
        const ok = isRight(keys, chosen);
        for (const x of inputs) {
          const wrongPick = x.input.checked && !x.key;
          const missed = !x.input.checked && x.key && multi;
          x.mark.textContent = x.input.checked && x.key ? ' ✓ Right' : wrongPick ? ' ✗ Not this one' : missed ? ' ✗ You missed this one' : '';
          x.mark.className = 'mark' + (x.input.checked && x.key ? ' ok' : wrongPick || missed ? ' bad' : '');
        }
        whyBox.hidden = false;
        q.classList.toggle('is-right', ok);
        q.classList.toggle('is-wrong', !ok);
        return ok;
      },
    };
  }

  // A writing task: a text box that is never saved, then a model answer and a checklist to tick.
  function setupSelf(q, n) {
    const details = q.querySelector('details');
    const box = el('div', 'self-form');
    const label = el('label', null, 'Your answer (it stays on this page and is not saved)');
    const area = el('textarea');
    area.rows = 4;
    area.id = `self-${n}`;
    label.htmlFor = area.id;
    const compare = el('button', 'btn', 'Compare with a model answer');
    compare.type = 'button';
    const reveal = el('div', 'self-reveal');
    reveal.hidden = true;
    while (details.firstChild) { const c = details.firstChild; if (c.tagName === 'SUMMARY') c.remove(); else reveal.append(c); }
    const items = [...reveal.querySelectorAll('.checklist li')].map((li) => {
      const lab = el('label', 'choice');
      const cb = el('input');
      cb.type = 'checkbox';
      const text = el('span');
      while (li.firstChild) text.append(li.firstChild);
      lab.append(cb, text);
      li.append(lab);
      return cb;
    });
    compare.addEventListener('click', () => { reveal.hidden = false; });
    box.append(label, area, compare, reveal);
    details.replaceWith(box);
    window.addEventListener('pagehide', () => { area.value = ''; });
    return {
      grade() {
        reveal.hidden = false;
        const ok = items.every((cb) => cb.checked);
        q.classList.toggle('is-right', ok);
        q.classList.toggle('is-wrong', !ok);
        return ok;
      },
    };
  }

  // ---------- a track page ----------

  function setupTrack(section) {
    const id = section.dataset.track;
    const steps = section.dataset.steps.split(' ');
    const line = section.querySelector('.track-progress');
    const resume = section.querySelector('.resume');
    const certTools = document.querySelector('.cert-tools');
    const store = load();
    const p = progress(steps, store);
    for (const li of section.querySelectorAll('[data-step]')) {
      const s = store.steps[li.dataset.step];
      li.querySelector('.tick').textContent = s ? `✓ Done ${s.done}` : '';
      li.classList.toggle('done', Boolean(s));
    }
    line.hidden = false;
    line.textContent = p.done === p.total ? `All ${p.total} steps done. Well done.` : `${p.done} of ${p.total} steps done.`;
    resume.hidden = !p.next;
    if (certTools) certTools.hidden = Boolean(p.next);
    if (p.next) {
      const a = resume.querySelector('a');
      const target = section.querySelector(`[data-step="${p.next}"] a`);
      a.href = target.getAttribute('href');
      a.textContent = p.done ? `Resume: ${target.textContent}` : `Start: ${target.textContent}`;
    } else if (!store.tracks[id]) {
      store.tracks[id] = { done: today() };
      save(store);
    }
  }

  function printCertificate() {
    const cert = document.querySelector('.cert');
    const name = document.querySelector('[data-cert-name]').value.trim();
    const id = document.querySelector('[data-track]').dataset.track;
    cert.querySelector('[data-cert-out]').textContent = name || 'A Tabula learner';
    cert.querySelector('[data-cert-date]').textContent = `Finished ${(load().tracks[id] || {}).done || today()}`;
    cert.hidden = false;
    document.body.classList.add('printing-cert');
    const done = () => { document.body.classList.remove('printing-cert'); cert.hidden = true; window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    window.print();
  }

  // ---------- progress tools: save to a file, load from a file, clear ----------

  function setupTools(box) {
    const status = box.querySelector('.tools-status');
    const nojs = box.querySelector('.nojs-note');
    if (nojs) nojs.hidden = true;
    box.querySelector('.tools').hidden = false;
    const print = box.querySelector('[data-act="print"]');
    if (print) print.addEventListener('click', printCertificate);
    box.querySelector('[data-act="export"]').addEventListener('click', () => {
      const url = URL.createObjectURL(new Blob([JSON.stringify(load(), null, 2)], { type: 'application/json' }));
      const a = el('a');
      a.href = url;
      a.download = `tabula-learning-progress-${today()}.json`;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      status.textContent = 'Saved a progress file. Load it on another device to carry on there.';
    });
    box.querySelector('[data-act="import"]').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      if (file.size > 100000) { status.textContent = 'That file is too big to be a progress file.'; return; }
      let incoming;
      try { incoming = clean(JSON.parse(await file.text())); } catch { status.textContent = 'That file is not a progress file.'; return; }
      const store = load();
      for (const [k, v] of Object.entries(incoming.steps)) if (!store.steps[k] || store.steps[k].v < v.v) store.steps[k] = v;
      for (const [k, v] of Object.entries(incoming.tracks)) if (!store.tracks[k]) store.tracks[k] = v;
      status.textContent = save(store) ? `Loaded ${Object.keys(incoming.steps).length} finished steps.` : 'Your browser blocks saving, so the progress could not be loaded.';
      refresh();
    });
    box.querySelector('[data-act="clear"]').addEventListener('click', () => {
      if (!window.confirm('Clear all your Debate Library progress in this browser? This cannot be undone.')) return;
      status.textContent = store_.clear() ? 'Your progress is cleared.' : 'Your browser blocks storage, so there was nothing saved to clear.';
      refresh();
    });
  }

  function refresh() {
    const t = document.querySelector('[data-track]');
    if (t) setupTrack(t);
  }

  function start() {
    for (const s of document.querySelectorAll('section.check[data-check]')) setupCheck(s);
    const tools = document.querySelector('.progress-tools');
    if (tools) setupTools(tools);
    refresh();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
