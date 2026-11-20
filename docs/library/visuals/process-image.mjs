// Turns one full-size original from the image tool into the web copy for its slot (STYLE.md §6).
//   node docs/library/visuals/process-image.mjs <slot id> <original image (PNG, WebP or JPEG)>
// 1. Copies the original to the archive (set in the git-ignored visuals/local.json), so the repo stays small.
//    It stops if the archive folder is missing, so nothing large lands on the internal disk.
// 2. Crops the centre to the slot format's shape (hero: 2:1 banner), resizes to the web size, and saves
//    docs/library/images/<slot id>.webp with cwebp. Needs macOS sips and cwebp (brew install webp).
import { copyFileSync, existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { VISUALS, FORMATS, MAX_BYTES, archiveDir, loadSlots } from './slots.mjs';

const run = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8' });
const dims = (file) => { const o = run('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', file]); return [+/pixelWidth: (\d+)/.exec(o)[1], +/pixelHeight: (\d+)/.exec(o)[1]]; };

// The centre crop (w, h) of a src image that has the target aspect ratio.
export function cropBox([sw, sh], [tw, th]) {
  return sw * th > tw * sh ? [Math.round(sh * tw / th), sh] : [sw, Math.round(sw * th / tw)];
}

export function processImage(id, original) {
  const slot = loadSlots().find((s) => s.id === id);
  if (!slot) throw new Error(`No slot "${id}"`);
  if (slot.kind !== 'illustration') throw new Error(`${id}: only illustration slots have a web copy`);
  for (const tool of ['sips', 'cwebp']) {
    try { execFileSync('which', [tool], { stdio: 'ignore' }); } catch { throw new Error(`${tool} is missing (macOS only; for cwebp run: brew install webp)`); }
  }
  const out = FORMATS[slot.format].out;
  // The archive folder must already exist (for example on a mounted drive). It is never created here, so an
  // unmounted drive cannot silently turn into a folder on the internal disk.
  const archive = archiveDir();
  if (!archive) throw new Error('No archive set. Put { "archive": "/path/on/big/drive" } in docs/library/visuals/local.json (git-ignored).');
  if (!existsSync(archive)) throw new Error(`The archive folder ${archive} does not exist. Is the drive mounted?`);
  const kept = join(archive, `${id}${extname(original).toLowerCase()}`);
  if (resolve(kept) !== resolve(original)) copyFileSync(original, kept);
  const tmp = mkdtempSync(join(tmpdir(), 'tabula-img-'));
  try {
    const png = join(tmp, 'work.png');
    run('sips', ['-s', 'format', 'png', original, '--out', png]);
    const [cw, ch] = cropBox(dims(png), out);
    run('sips', ['--cropToHeightWidth', String(ch), String(cw), png, '--out', png]);
    run('sips', ['--resampleHeightWidth', String(out[1]), String(out[0]), png, '--out', png]);
    const dest = join(VISUALS, '..', slot.file);
    run('cwebp', ['-quiet', '-q', '82', '-m', '6', png, '-o', dest]);
    const size = statSync(dest).size;
    if (size > MAX_BYTES) throw new Error(`${id}: the web copy is ${Math.round(size / 1024)} KB, over the ${MAX_BYTES / 1024} KB limit`);
    return { dest, size, out };
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [id, original] = process.argv.slice(2);
  if (!id || !original || !existsSync(original)) { console.error('Usage: node docs/library/visuals/process-image.mjs <slot id> <original image>'); process.exit(1); }
  const r = processImage(id, original);
  console.log(`Saved docs/library/${loadSlots().find((s) => s.id === id).file} (${r.out.join('x')}, ${Math.round(r.size / 1024)} KB). Set its status to "draft" in status.json.`);
}
