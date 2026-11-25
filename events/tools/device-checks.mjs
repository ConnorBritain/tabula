// The layout checks for the device pass. Two halves:
//   measurePage: runs IN the browser (page.evaluate), reads raw sizes, and returns plain data. It judges nothing.
//   the judges below: pure functions that turn those sizes into findings. Node tests call them with made-up sizes
//   (events/device-pass.test.mjs), so the rules are tested without a browser.

export const MIN_TARGET = 44; // CSS px. The size a finger can hit without hitting the control next to it.
const SLACK = 1; // px. Sub-pixel rounding is not a problem.

/**
 * Runs in the page. Returns { page, targets, boxes } with raw sizes only.
 * page:    { scrollWidth, clientWidth } of the document.
 * targets: each visible control in the header and the screen: { label, tag, width, height, inline }.
 *          A radio or checkbox that is hidden behind its label is measured by the label (that is what a finger hits).
 * boxes:   each visible element that holds its own text: { label, right, boxRight, width, scrollWidth, clientWidth,
 *          scrolls, clips, hiddenBox (visually hidden, for screen readers), inScroller (inside a sideways scroller),
 *          viewport }.
 * This function is sent to the browser as source text, so it must not use anything from outside its own body.
 */
export function measurePage() {
  const short = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 50);
  const nameOf = (el) => short(el.getAttribute('aria-label') || el.innerText || el.value || el.placeholder || el.title || el.id || el.tagName);
  const shown = (el) => {
    if (!el.isConnected || el.closest('[hidden]')) return false;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const roots = [document.querySelector('header.bar'), document.querySelector('#screen'),
    ...[...document.querySelectorAll('.overlay')].filter((o) => !o.hidden)].filter(Boolean);
  const seen = new Set();
  const targets = [];
  for (const root of roots) {
    for (let el of root.querySelectorAll('button, a[href], input, select, textarea, [role="button"], summary')) {
      if (el.type === 'hidden') continue;
      if ((el.type === 'radio' || el.type === 'checkbox') && el.closest('label')) el = el.closest('label');
      if (seen.has(el) || !shown(el)) continue;
      seen.add(el);
      const r = el.getBoundingClientRect();
      if (r.width <= 2 && r.height <= 2) continue; // a visually hidden control (sr-only): not a tap target
      const cs = getComputedStyle(el);
      // A link inside running text is sized by the line of text; the inline exception in WCAG 2.5.8 covers it.
      const inline = el.tagName === 'A' && cs.display === 'inline' && !!el.closest('p, li, td, small');
      targets.push({ label: nameOf(el), tag: el.tagName.toLowerCase(), header: !!el.closest('header.bar'), width: Math.round(r.width * 10) / 10, height: Math.round(r.height * 10) / 10, inline });
    }
  }
  const boxes = [];
  const vw = document.documentElement.clientWidth;
  for (const root of roots) {
    for (const el of root.querySelectorAll('*')) {
      if (!shown(el)) continue;
      const own = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim());
      if (!own.length) continue;
      const r = el.getBoundingClientRect();
      let right = r.left;
      for (const n of own) {
        const range = document.createRange();
        range.selectNodeContents(n);
        for (const rr of range.getClientRects()) right = Math.max(right, rr.right);
      }
      const cs = getComputedStyle(el);
      // Visually hidden text (the sr-only pattern: a box of 2 px or less that clips what it holds, or inside one) is
      // for screen readers only. A tiny box that lets its content show (overflow visible, no clip) does not count.
      let hiddenBox = false;
      for (let a = el; a && a !== document.body; a = a.parentElement) {
        const ar = a.getBoundingClientRect();
        const acs = getComputedStyle(a);
        const clipsAll = /rect\(0(px)?,? 0(px)?,? 0(px)?,? 0(px)?\)/.test(acs.clip) || (acs.clipPath && acs.clipPath !== 'none');
        if ((ar.width <= 2 || ar.height <= 2) && (clipsAll || /(hidden|clip)/.test(acs.overflow))) { hiddenBox = true; break; }
      }
      // Inside a box that really scrolls sideways (a strip of speakers, a wide table): off-screen text is reachable.
      // A wrapper that is set to scroll but has nothing to scroll does not count.
      let inScroller = false;
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        if (/(auto|scroll)/.test(getComputedStyle(a).overflowX) && a.scrollWidth > a.clientWidth + 1) { inScroller = true; break; }
      }
      const scrolls = /(auto|scroll)/.test(cs.overflowX);
      const clips = /(hidden|clip)/.test(cs.overflowX) || cs.textOverflow === 'ellipsis';
      boxes.push({ label: short(el.innerText || el.textContent) || el.tagName, tag: el.tagName.toLowerCase(), header: !!el.closest('header.bar'), right: Math.round(right), boxRight: Math.round(r.right),
        width: Math.round(r.width), scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, scrolls, clips, hiddenBox, inScroller, viewport: vw });
    }
  }
  return { page: { scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }, targets, boxes };
}

/** Page-level sideways scroll: the page is wider than the screen. Returns the extra width in px (0 when none). */
export function pageOverflow({ scrollWidth, clientWidth }) {
  const extra = scrollWidth - clientWidth;
  return extra > SLACK ? extra : 0;
}

/** Controls smaller than min x min CSS px, skipping inline text links. Each: { label, tag, width, height }. */
export function smallTargets(targets, min = MIN_TARGET) {
  return targets.filter((t) => !t.inline && (t.width < min - 0.5 || t.height < min - 0.5))
    .map(({ label, tag, width, height, header }) => ({ label, tag, width, height, header: !!header }));
}

/**
 * Text that does not fit its box. Two kinds:
 *   'clipped':  the box hides what does not fit (overflow hidden or an ellipsis) and its content is wider than the box;
 *   'spills':   the text runs past the right edge of its box, or past the right edge of the screen.
 * Not problems: a box that scrolls on purpose (overflow auto or scroll); visually hidden text (screen readers only);
 * text past the screen edge inside a sideways scroller (a finger can scroll to it).
 */
export function overflowingText(boxes) {
  const out = [];
  for (const b of boxes) {
    if (b.scrolls || b.hiddenBox) continue;
    if (b.clips && b.scrollWidth > b.clientWidth + SLACK) out.push({ label: b.label, tag: b.tag, header: !!b.header, kind: 'clipped', by: b.scrollWidth - b.clientWidth });
    else if (!b.inScroller && b.right > b.viewport + SLACK) out.push({ label: b.label, tag: b.tag, header: !!b.header, kind: 'spills', by: b.right - b.viewport });
    else if (!b.clips && b.right > b.boxRight + SLACK) out.push({ label: b.label, tag: b.tag, header: !!b.header, kind: 'spills', by: b.right - b.boxRight });
  }
  return out;
}

/** All layout findings for one measured screen: [{ problem, detail, header }]. header: true when the finding is in
 * the app header, which is the same on every screen (the walk files those under one row, not 23). */
export function judge(measured, min = MIN_TARGET) {
  const found = [];
  const extra = pageOverflow(measured.page);
  if (extra) found.push({ problem: 'page scrolls sideways', detail: `${extra} px wider than the screen` });
  for (const t of smallTargets(measured.targets, min)) found.push({ problem: `tap target under ${min}x${min}`, detail: `${t.tag} "${t.label}" ${t.width}x${t.height}`, header: t.header });
  for (const o of overflowingText(measured.boxes)) found.push({ problem: o.kind === 'clipped' ? 'text cut off' : 'text overflows its box', detail: `${o.tag} "${o.label}" by ${o.by} px`, header: o.header });
  return found;
}

/**
 * Groups raw findings ({ screen, device, theme, problem, detail }) into table rows: one row for each screen and
 * problem, listing the devices and themes it showed on and up to 3 example details. Sorted by screen order, then problem.
 */
export function summarize(findings, screenOrder = []) {
  const rows = new Map();
  for (const f of findings) {
    const key = f.screen + '\u0000' + f.problem;
    if (!rows.has(key)) rows.set(key, { screen: f.screen, problem: f.problem, devices: new Set(), themes: new Set(), examples: new Set(), count: 0 });
    const r = rows.get(key);
    r.devices.add(f.device); r.themes.add(f.theme); r.count++;
    if (f.detail && r.examples.size < 3) r.examples.add(f.detail);
  }
  const pos = (s) => { const i = screenOrder.indexOf(s); return i < 0 ? screenOrder.length : i; };
  return [...rows.values()]
    .map((r) => ({ screen: r.screen, problem: r.problem, devices: [...r.devices].sort(), themes: [...r.themes].sort(), examples: [...r.examples], count: r.count }))
    .sort((a, b) => pos(a.screen) - pos(b.screen) || a.screen.localeCompare(b.screen) || a.problem.localeCompare(b.problem));
}

const cell = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');

/** A Markdown table of summarize() rows. */
export function markdownTable(rows) {
  const head = '| Screen | Devices | Theme | Problem | Examples |\n|---|---|---|---|---|';
  if (!rows.length) return head + '\n| (none) | | | | |';
  return head + '\n' + rows.map((r) => `| ${cell(r.screen)} | ${cell(r.devices.join(', '))} | ${cell(r.themes.join(', '))} | ${cell(r.problem)} | ${cell(r.examples.join('; '))} |`).join('\n');
}
