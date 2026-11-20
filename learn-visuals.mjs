// Approved pictures for the Debate Library (docs/library/visuals/). build-learn.mjs calls this.
// A slot's picture is shown only when status.json says "approved" and its file exists in docs/library/images/.
import { statSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { FORMATS, MAX_BYTES, loadSlots, loadStatus } from './docs/library/visuals/slots.mjs';

export const PLAIN = 'Plain version'; // the special after_heading value: right after the page summary (marked **Plain version.** in the Markdown)

// Map(page -> [slot]) of approved slots, in priority order. Each gets src (the file) and out (its path in learn/).
// A broken approved slot stops the build: a missing or oversized file, an unknown format, or no alt text.
export function loadApproved(dir) {
  const vdir = join(dir, 'visuals');
  const status = loadStatus(vdir);
  const out = new Map();
  for (const s of loadSlots(vdir)) {
    if ((status[s.id] || {}).status !== 'approved') continue;
    const src = join(dir, s.file);
    if (!existsSync(src)) throw new Error(`${s.id}: approved, but docs/library/${s.file} does not exist`);
    if (statSync(src).size > MAX_BYTES) throw new Error(`${s.id}: docs/library/${s.file} is over ${MAX_BYTES / 1024} KB`);
    if (!FORMATS[s.format]) throw new Error(`${s.id}: unknown format "${s.format}"`);
    if (!s.alt) throw new Error(`${s.id}: an approved picture needs alt text`);
    if (!out.has(s.page)) out.set(s.page, []);
    out.get(s.page).push({ ...s, src, out: `img/${basename(s.file)}` });
  }
  for (const list of out.values()) list.sort((a, b) => a.priority - b.priority);
  return out;
}

// The <figure> for one slot. `href` is the image path relative to the page. The class sets the layout per
// format (learn.css): a full-width banner card, a narrower inline card, or a small spot with no card.
export function figureHtml(slot, href, esc) {
  const [w, h] = FORMATS[slot.format].out;
  const cap = slot.caption ? `<figcaption>${esc(slot.caption)}</figcaption>` : '';
  return `<figure class="lib-figure lib-figure--${slot.format}"><img src="${href}" alt="${esc(slot.alt)}" width="${w}" height="${h}" loading="lazy" decoding="async">${cap}</figure>`;
}

// Puts figures into a page's blocks (from markdown()). A figure goes right after the page summary, or after the
// first block under its heading (right after the heading if another heading comes first, or at the page end).
// A floating figure ({ float: true }, the spot format) goes right after its heading, so text flows beside it.
// A place that is missing, used twice, or matched by two headings stops the build, so no picture vanishes silently.
export function placeFigures(blocks, figures, slug) {
  const byPlace = new Map();
  const floats = new Set();
  for (const f of figures) {
    if (byPlace.has(f.place)) throw new Error(`${slug}: two approved pictures share the place "${f.place}"`);
    byPlace.set(f.place, f.html);
    if (f.float) floats.add(f.place);
  }
  const placed = new Set();
  const out = [];
  const put = (key) => {
    if (placed.has(key)) throw new Error(`${slug}: the picture place "${key}" matches more than once`);
    placed.add(key); out.push(byPlace.get(key));
  };
  let pending = null;
  for (const b of blocks) {
    if (pending && b.kind === 'heading') { put(pending); pending = null; }
    out.push(b.html);
    if (pending) { put(pending); pending = null; }
    else if (b.kind === 'heading' && b.place !== PLAIN && byPlace.has(b.place)) { if (floats.has(b.place)) put(b.place); else pending = b.place; }
    if (b.kind === 'plain' && byPlace.has(PLAIN)) put(PLAIN);
  }
  if (pending) put(pending);
  for (const key of byPlace.keys()) if (!placed.has(key)) throw new Error(`${slug}: no place "${key}" for its picture`);
  return out.join('\n');
}

// The page's share picture: a banner or inline picture first (a small spot only if there is nothing else), never
// an SVG diagram; lowest priority number first.
export function shareImage(slots) {
  const pics = slots.filter((s) => s.kind === 'illustration');
  return pics.find((s) => !FORMATS[s.format].float) || pics[0] || null;
}
