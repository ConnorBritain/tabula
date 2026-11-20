// Prints the finished image prompt for one illustration slot (docs/library/visuals/TEMPLATE.md).
// The template block in TEMPLATE.md is the single source; this script only fills it in.
// Usage: node docs/library/visuals/build-prompt.mjs <slot id>     (prints one prompt)
//        node docs/library/visuals/build-prompt.mjs --all         (prints every todo illustration prompt)
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VISUALS as DIR, FORMATS, loadSlots, loadStatus } from './slots.mjs';

export { loadSlots };
// The last prompt part, per format: what to ask the image tool for (TEMPLATE.md part 6).
// The sizes come from FORMATS (slots.mjs); only the per-format advice is written here.
const ADVICE = {
  hero: ' It will be cropped to a wide 2:1 banner, so keep every shape inside the middle band: leave the top 15% and the bottom 15% plain white.',
  inline: '',
  spot: ' One compact object or small group in the centre, with a wide white margin on all sides; it is shown small, so keep shapes bold and simple.',
};
const ratio = ([w, h]) => (w === h ? '1:1' : w * 2 === h * 3 ? '3:2' : `${w}:${h}`);
const OUTPUT = Object.fromEntries(Object.entries(ADVICE).map(([f, advice]) => {
  const g = FORMATS[f].gen;
  return [f, `${ratio(g)} image (${g[0]}×${g[1]}), plain white background, PNG.${advice}`];
}));
const SIDE_RULE = ' Blue #0055b8 means the affirmative side and red #f2232d means the negative side; use them only as stated here, never as decoration.';

// The first ``` block in TEMPLATE.md, with the [n NAME] part headings removed.
export function templateBlock(dir = DIR) {
  const m = /```\n([\s\S]*?)```/.exec(readFileSync(join(dir, 'TEMPLATE.md'), 'utf8'));
  if (!m) throw new Error('TEMPLATE.md has no template block');
  return m[1];
}

const flat = (t) => t.replace(/\s*\n\s*/g, ' ').trim();

export function buildPrompt(slot, template = templateBlock()) {
  if (slot.kind !== 'illustration') throw new Error(`${slot.id}: only illustration slots get an image prompt`);
  if (!OUTPUT[slot.format]) throw new Error(`${slot.id}: format "${slot.format}" has no image prompt (only ${Object.keys(OUTPUT).join(', ')} do)`);
  const sided = /#0055b8|#f2232d/i.test(slot.colors) && !/no blue or red/i.test(slot.colors);
  const fill = {
    'slot.subject': slot.subject, 'slot.composition': slot.composition, 'slot.colors': slot.colors,
    'slot.avoid': slot.avoid || '', side_rule: sided ? SIDE_RULE : '', output: OUTPUT[slot.format],
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
    const status = loadStatus();
    for (const s of slots.filter((x) => x.kind === 'illustration' && (status[x.id] || {}).status === 'todo')) console.log(`=== ${s.id} -> docs/library/${s.file}\n${buildPrompt(s)}\n`);
  } else {
    const s = slots.find((x) => x.id === arg);
    if (!s) { console.error(`No slot "${arg}". Usage: node docs/library/visuals/build-prompt.mjs <slot id> | --all`); process.exit(1); }
    console.log(buildPrompt(s));
  }
}
