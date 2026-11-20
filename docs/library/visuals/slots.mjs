// One loader for the picture slot data (docs/library/visuals/). Used by build-prompt.mjs, check-session.mjs and
// the library builder (learn-visuals.mjs), so a change to the slot format is made in one place.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const VISUALS = dirname(fileURLToPath(import.meta.url));
// Picture formats (STYLE.md §6). gen = the size to ask the image tool for; out = the web copy in the repo.
// hero: a wide banner after the Plain version box, cropped from 3:2 to 2:1. inline: a 3:2 picture in a section.
// spot: a small square picture with no card. diagram: an SVG drawn as code (out is its viewBox size).
// The on-page widths live in docs/library/learn.css (.lib-figure--*); keep them in step with these.
export const FORMATS = {
  hero: { gen: [1536, 1024], out: [1536, 768] },
  inline: { gen: [1536, 1024], out: [1200, 800] },
  spot: { gen: [1024, 1024], out: [480, 480], float: true },
  diagram: { out: [1200, 800] },
};
export const MAX_BYTES = 400 * 1024; // per web copy; the full-size originals live in the archive, not the repo
// Where process-image.mjs keeps the full-size originals: outside the repo, on a big drive. Set per computer in the
// git-ignored visuals/local.json ({ "archive": "/path" }) or the TABULA_IMAGE_ARCHIVE variable; never in the repo.
export function archiveDir(dir = VISUALS) {
  if (process.env.TABULA_IMAGE_ARCHIVE) return process.env.TABULA_IMAGE_ARCHIVE;
  const p = join(dir, 'local.json');
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')).archive || null : null;
}
export const STATUSES = ['todo', 'draft', 'skipped', 'approved'];

// Every slot from slots/*.json, in file order, with _file (the section file it came from).
export function loadSlots(dir = VISUALS) {
  const sdir = join(dir, 'slots');
  if (!existsSync(sdir)) return [];
  return readdirSync(sdir).filter((f) => f.endsWith('.json')).sort()
    .flatMap((f) => JSON.parse(readFileSync(join(sdir, f), 'utf8')).slots.map((s) => ({ ...s, _file: f })));
}

// The status ledger: { slotId: { status, note } }. Empty when there is no status.json.
export function loadStatus(dir = VISUALS) {
  const p = join(dir, 'status.json');
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')).slots : {};
}
