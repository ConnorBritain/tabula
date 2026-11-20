// Prints the finished image prompt for one illustration slot (docs/library/visuals/TEMPLATE.md).
// The template block in TEMPLATE.md is the single source; this script only fills it in.
// Usage: node docs/library/visuals/build-prompt.mjs <slot id>     (prints one prompt)
//        node docs/library/visuals/build-prompt.mjs --all         (prints every todo illustration prompt)
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const SIZES = { '3:2': '1536×1024', '1:1': '1024×1024' };
const SIDE_RULE = ' Blue #0055b8 means the affirmative side and red #f2232d means the negative side; use them only as stated here, never as decoration.';

export function loadSlots(dir = DIR) {
  return readdirSync(join(dir, 'slots')).filter((f) => f.endsWith('.json')).sort()
    .flatMap((f) => JSON.parse(readFileSync(join(dir, 'slots', f), 'utf8')).slots.map((s) => ({ ...s, _file: f })));
}

// The first ``` block in TEMPLATE.md, with the [n NAME] part headings removed.
export function templateBlock(dir = DIR) {
  const m = /```\n([\s\S]*?)```/.exec(readFileSync(join(dir, 'TEMPLATE.md'), 'utf8'));
  if (!m) throw new Error('TEMPLATE.md has no template block');
  return m[1];
}

const flat = (t) => t.replace(/\s*\n\s*/g, ' ').trim();

export function buildPrompt(slot, template = templateBlock()) {
  if (slot.kind !== 'illustration') throw new Error(`${slot.id}: only illustration slots get an image prompt`);
  if (!SIZES[slot.aspect]) throw new Error(`${slot.id}: aspect must be 3:2 or 1:1`);
  const sided = /#0055b8|#f2232d/i.test(slot.colors) && !/no blue or red/i.test(slot.colors);
  const fill = {
    'slot.subject': slot.subject, 'slot.composition': slot.composition, 'slot.colors': slot.colors,
    'slot.avoid': slot.avoid || '', side_rule: sided ? SIDE_RULE : '', aspect: slot.aspect, size: SIZES[slot.aspect],
  };
  const parts = template.split(/^\[\d [A-Z ]+\]\n/m).slice(1).map((p) => flat(p.replace(/\{([a-z_.]+)\}/g, (_, k) => {
    if (!(k in fill)) throw new Error(`${slot.id}: unknown template field {${k}}`);
    return fill[k];
  })));
  if (parts.length !== 6) throw new Error(`template must have 6 parts, has ${parts.length}`);
  return parts.join('\n\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = process.argv[2];
  const slots = loadSlots();
  if (arg === '--all') {
    const status = JSON.parse(readFileSync(join(DIR, 'status.json'), 'utf8')).slots;
    for (const s of slots.filter((x) => x.kind === 'illustration' && (status[x.id] || {}).status === 'todo')) console.log(`=== ${s.id} -> docs/library/${s.file}\n${buildPrompt(s)}\n`);
  } else {
    const s = slots.find((x) => x.id === arg);
    if (!s) { console.error(`No slot "${arg}". Usage: node docs/library/visuals/build-prompt.mjs <slot id> | --all`); process.exit(1); }
    console.log(buildPrompt(s));
  }
}
