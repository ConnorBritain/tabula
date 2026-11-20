// Checks the image session's work (docs/library/visuals/KICKOFF.md). Run after each batch, and before you commit:
//   node docs/library/visuals/check-session.mjs
// It fails if the session changed anything outside docs/library/images/ and docs/library/visuals/status.json,
// set any slot to "approved" (only the owner may), or left a draft without a valid image file.
// Commit the library before a session starts, so git can show what the session changed.
import { readFileSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VISUALS as DIR, FORMATS, MAX_BYTES, STATUSES, loadSlots, loadStatus } from './slots.mjs';

const LIB = join(DIR, '..');
const ROOT = join(LIB, '..', '..');

// WebP width and height (VP8X, VP8 or VP8L), or null if the file is not a WebP.
export function webpSize(buf) {
  if (buf.length < 30 || buf.toString('latin1', 0, 4) !== 'RIFF' || buf.toString('latin1', 8, 12) !== 'WEBP') return null;
  const kind = buf.toString('latin1', 12, 16);
  if (kind === 'VP8X') return [1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3)];
  if (kind === 'VP8 ') return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
  if (kind === 'VP8L') { const b = buf.readUInt32LE(21); return [1 + (b & 0x3fff), 1 + ((b >> 14) & 0x3fff)]; }
  return null;
}

// Problems with the status ledger and image files (no git needed).
export function checkFiles(slots = loadSlots(), status = loadStatus()) {
  const bad = [];
  const ids = new Set(slots.map((s) => s.id));
  for (const id of Object.keys(status)) if (!ids.has(id)) bad.push(`status.json: "${id}" is not a slot`);
  for (const s of slots) {
    const st = status[s.id];
    if (!st) { bad.push(`${s.id}: missing from status.json`); continue; }
    if (!STATUSES.includes(st.status)) bad.push(`${s.id}: bad status "${st.status}"`);
    if (st.status === 'skipped' && !st.note) bad.push(`${s.id}: skipped without a note saying why`);
    if (st.status !== 'draft' && st.status !== 'approved') continue;
    const path = join(LIB, s.file);
    if (!existsSync(path)) { bad.push(`${s.id}: ${st.status} but docs/library/${s.file} does not exist`); continue; }
    if (statSync(path).size > MAX_BYTES) bad.push(`${s.id}: image is over ${MAX_BYTES / 1024} KB`);
    if (s.kind === 'illustration') {
      const size = webpSize(readFileSync(path));
      const want = (FORMATS[s.format] || {}).out;
      if (!size) bad.push(`${s.id}: docs/library/${s.file} is not a WebP (run process-image.mjs on the original)`);
      else if (!want || size[0] !== want[0] || size[1] !== want[1]) bad.push(`${s.id}: image is ${size.join('x')}, expected ${want ? want.join('x') : '?'} for format "${s.format}" (run process-image.mjs)`);
    }
  }
  return bad;
}

// Problems with what changed since the last commit (needs git).
function checkGit() {
  const bad = [];
  const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const changed = git('status', '--porcelain', '--untracked-files=all', '--', 'docs/library').split('\n').filter(Boolean).map((l) => l.slice(3).replace(/^"|"$/g, ''));
  const allowed = (p) => p.startsWith('docs/library/images/') || p === 'docs/library/visuals/status.json';
  for (const p of changed) if (!allowed(p)) bad.push(`changed outside the session's area: ${p}`);
  let before = {};
  try { before = JSON.parse(git('show', 'HEAD:docs/library/visuals/status.json')).slots; } catch { console.log('Note: status.json is not committed yet, so the "approved" check is skipped.'); }
  const now = loadStatus();
  for (const [id, st] of Object.entries(now)) if (st.status === 'approved' && (before[id] || {}).status !== 'approved') bad.push(`${id}: set to "approved" since the last commit (only the owner may do this; if you did, ignore this line)`);
  return bad;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const bad = [...checkFiles(), ...checkGit()];
  if (bad.length) { console.log(bad.join('\n')); console.log(`\n${bad.length} problem(s).`); process.exit(1); }
  console.log('Image session check: all good.');
}
