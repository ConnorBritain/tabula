// Checks the image session's work (docs/library/visuals/KICKOFF.md). Run after each batch, and before you commit:
//   node docs/library/visuals/check-session.mjs
// It fails if the session changed anything outside docs/library/images/ and docs/library/visuals/status.json,
// set any slot to "approved" (only the owner may), or left a draft without a valid image file.
// Commit the library before a session starts, so git can show what the session changed.
import { readFileSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSlots } from './build-prompt.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const LIB = join(DIR, '..');
const ROOT = join(LIB, '..', '..');
const MAX_BYTES = 1.5 * 1024 * 1024; // revisit once the Phase A anchors show real file sizes
const SIZES = { '3:2': [1536, 1024], '1:1': [1024, 1024] };

// PNG width and height from the IHDR chunk, or null if the file is not a PNG.
export function pngSize(buf) {
  if (buf.length < 24 || buf.toString('latin1', 1, 4) !== 'PNG') return null;
  return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
}

// Problems with the status ledger and image files (no git needed).
export function checkFiles(slots = loadSlots(), status = JSON.parse(readFileSync(join(DIR, 'status.json'), 'utf8')).slots) {
  const bad = [];
  const ids = new Set(slots.map((s) => s.id));
  for (const id of Object.keys(status)) if (!ids.has(id)) bad.push(`status.json: "${id}" is not a slot`);
  for (const s of slots) {
    const st = status[s.id];
    if (!st) { bad.push(`${s.id}: missing from status.json`); continue; }
    if (!['todo', 'draft', 'skipped', 'approved'].includes(st.status)) bad.push(`${s.id}: bad status "${st.status}"`);
    if (st.status === 'skipped' && !st.note) bad.push(`${s.id}: skipped without a note saying why`);
    if (st.status !== 'draft' && st.status !== 'approved') continue;
    const path = join(LIB, s.file);
    if (!existsSync(path)) { bad.push(`${s.id}: ${st.status} but docs/library/${s.file} does not exist`); continue; }
    if (statSync(path).size > MAX_BYTES) bad.push(`${s.id}: image is over ${MAX_BYTES / 1048576} MB`);
    if (s.kind === 'illustration') {
      const size = pngSize(readFileSync(path));
      if (!size) bad.push(`${s.id}: docs/library/${s.file} is not a PNG`);
      else if (size[0] * SIZES[s.aspect][1] !== size[1] * SIZES[s.aspect][0]) bad.push(`${s.id}: image is ${size.join('x')}, expected aspect ${s.aspect}`);
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
  const now = JSON.parse(readFileSync(join(DIR, 'status.json'), 'utf8')).slots;
  for (const [id, st] of Object.entries(now)) if (st.status === 'approved' && (before[id] || {}).status !== 'approved') bad.push(`${id}: set to "approved" since the last commit (only the owner may do this; if you did, ignore this line)`);
  return bad;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const bad = [...checkFiles(), ...checkGit()];
  if (bad.length) { console.log(bad.join('\n')); console.log(`\n${bad.length} problem(s).`); process.exit(1); }
  console.log('Image session check: all good.');
}
