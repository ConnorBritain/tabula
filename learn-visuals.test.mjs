// Tests for the Debate Library image prompt library (docs/library/visuals/). Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadSlots, buildPrompt, templateBlock } from './docs/library/visuals/build-prompt.mjs';
import { checkFiles, pngSize } from './docs/library/visuals/check-session.mjs';

const LIB = 'docs/library';
const V = join(LIB, 'visuals');
const slots = loadSlots();
const status = JSON.parse(readFileSync(join(V, 'status.json'), 'utf8')).slots;
const exempt = JSON.parse(readFileSync(join(V, 'exempt.json'), 'utf8')).pages;
const pages = readdirSync(LIB).filter((f) => f.endsWith('.md') && !f.endsWith('.local.md') && !['PLAN.md', 'LICENSE.md', 'TRACKS.md'].includes(f)).map((f) => f.slice(0, -3));
const md = (p) => readFileSync(join(LIB, `${p}.md`), 'utf8');

// Why: a picture is placed after a named heading. If the heading is missing or appears twice, the picture lands in the wrong place or silently disappears.
test('every slot points at a real page and exactly one place on it', () => {
  for (const s of slots) {
    assert.ok(pages.includes(s.page), `${s.id}: no page "${s.page}"`);
    if (s.after_heading === 'Plain version') {
      assert.match(md(s.page), /^> \*\*Plain version\.?\*\*/m, `${s.id}: page has no Plain version box`);
    } else {
      const hits = [...md(s.page).matchAll(/^#{2,3} (.+)$/gm)].filter((m) => m[1].trim() === s.after_heading).length;
      assert.equal(hits, 1, `${s.id}: heading "${s.after_heading}" found ${hits} times`);
    }
  }
});

// Why: the image agent and the builder rely on these fields; a missing one means a bad prompt or a broken page.
test('every slot has a unique id and the fields its kind needs', () => {
  const ids = new Set();
  const places = new Set();
  for (const s of slots) {
    assert.ok(!ids.has(s.id), `duplicate id ${s.id}`); ids.add(s.id);
    const place = `${s.page}|${s.after_heading}`;
    assert.ok(!places.has(place), `${s.id}: two slots at the same place`); places.add(place);
    assert.ok(['illustration', 'diagram'].includes(s.kind), `${s.id}: kind`);
    assert.ok([1, 2, 3].includes(s.priority), `${s.id}: priority`);
    assert.ok(['3:2', '1:1'].includes(s.aspect), `${s.id}: aspect`);
    assert.ok(s.alt && s.alt.length >= 20 && s.alt.length <= 200, `${s.id}: alt must be 20-200 characters`);
    assert.equal(s.file, `images/${s.id}.${s.kind === 'diagram' ? 'svg' : 'png'}`, `${s.id}: file name`);
    if (s.kind === 'diagram') assert.ok(s.diagram_spec, `${s.id}: diagram_spec`);
    else for (const k of ['purpose', 'subject', 'composition', 'colors']) assert.ok(s[k], `${s.id}: ${k}`);
    assert.ok(!('status' in s) && !('note' in s), `${s.id}: status lives in status.json, not in the slot`);
  }
});

// Why: the owner asked for pictures across every library page; a new page must get a slot or a written reason for having none.
test('every library page has a slot or is listed in exempt.json with a reason', () => {
  const withSlots = new Set(slots.map((s) => s.page));
  for (const p of pages) assert.ok(withSlots.has(p) || exempt[p], `${p}: no slot and not exempt`);
  for (const [p, why] of Object.entries(exempt)) {
    assert.ok(pages.includes(p), `exempt.json: no page "${p}"`);
    assert.ok(!withSlots.has(p), `exempt.json: "${p}" has slots, so it should not be exempt`);
    assert.ok(why.length > 10, `exempt.json: "${p}" needs a reason`);
  }
});

// Why: the session works only from the ledger; a slot missing from it is never made, and a made image without a file breaks the page.
test('status.json covers every slot and every draft has a valid image', () => {
  assert.deepEqual(checkFiles(slots, status), []);
});

// Why: the prompt builder is how every image stays on-brand; a leftover {field} or a missing no-text rule produces off-brand art.
test('every illustration prompt fills the template fully and keeps the fixed rules', () => {
  const t = templateBlock();
  for (const s of slots.filter((x) => x.kind === 'illustration')) {
    const p = buildPrompt(s, t);
    assert.doesNotMatch(p, /\{[a-z_.]+\}/, `${s.id}: unfilled field`);
    assert.match(p, /^Flat vector illustration in the style of the attached reference mark/, `${s.id}: style block`);
    assert.match(p, /No text of any kind/, `${s.id}: no-text rule`);
    assert.equal(/means the affirmative side/.test(p), /#0055b8|#f2232d/i.test(s.colors) && !/no blue or red/i.test(s.colors), `${s.id}: side rule only when blue or red is used`);
  }
});

// Why: the checker must reject a file that is not a real PNG of the right shape, or a wrong image could be approved.
test('the session checker reads PNG sizes and rejects non-PNGs', () => {
  const png = Buffer.alloc(24); png.write('\x89PNG', 0, 'latin1'); png.writeUInt32BE(1536, 16); png.writeUInt32BE(1024, 20);
  assert.deepEqual(pngSize(png), [1536, 1024]);
  assert.equal(pngSize(Buffer.from('not a png at all, really')), null);
  const fake = { id: 'x', kind: 'illustration', aspect: '3:2', file: 'images/does-not-exist.png' };
  assert.match(checkFiles([fake], { x: { status: 'draft', note: '' } })[0], /does not exist/);
  assert.match(checkFiles([fake], { x: { status: 'skipped', note: '' } })[0], /skipped without a note/);
});

// Why: anchors and images need their folder in git, or a fresh checkout has nowhere for the session to save them.
test('the images and anchors folders exist', () => {
  assert.ok(existsSync(join(LIB, 'images', '_anchors', '.gitkeep')));
});
