// Tests for the Debate Library image prompt library (docs/library/visuals/). Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadSlots, buildPrompt, templateBlock } from './docs/library/visuals/build-prompt.mjs';
import { checkFiles, webpSize } from './docs/library/visuals/check-session.mjs';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { buildSite, isPageFile } from './build-learn.mjs';
import { placeFigures, shareImage } from './learn-visuals.mjs';
import { FORMATS } from './docs/library/visuals/slots.mjs';

const LIB = 'docs/library';
const V = join(LIB, 'visuals');
const slots = loadSlots();
const status = JSON.parse(readFileSync(join(V, 'status.json'), 'utf8')).slots;
const exempt = JSON.parse(readFileSync(join(V, 'exempt.json'), 'utf8')).pages;
const pages = readdirSync(LIB).filter(isPageFile).map((f) => f.slice(0, -3));
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
    // CHANGED (formats): slots name a layout format instead of an aspect ratio. Was: assert.ok(['3:2', '1:1'].includes(s.aspect), ...)
    assert.ok(s.kind === 'diagram' ? s.format === 'diagram' : ['hero', 'inline', 'spot'].includes(s.format), `${s.id}: format`);
    assert.ok(s.alt && s.alt.length >= 20 && s.alt.length <= 200, `${s.id}: alt must be 20-200 characters`);
    // CHANGED (formats): the repo keeps a small WebP web copy; full-size originals go to the archive. Was: ... 'svg' : 'png' ...
    assert.equal(s.file, `images/${s.id}.${s.kind === 'diagram' ? 'svg' : 'webp'}`, `${s.id}: file name`);
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
  // CHANGED (formats): web copies are WebP now, so the PNG reader was removed as dead code. Was: assert.deepEqual(pngSize(png), [1536, 1024]); ...
  for (const f of readdirSync(join(LIB, 'images')).filter((x) => x.endsWith('.webp'))) {
    const s = slots.find((x) => `${x.id}.webp` === f);
    if (s) assert.deepEqual(webpSize(readFileSync(join(LIB, 'images', f))), FORMATS[s.format].out, `${f}: a real cwebp (VP8) file reads at its format's size`);
  }
  const webp = Buffer.alloc(30); webp.write('RIFF', 0, 'latin1'); webp.write('WEBPVP8X', 8, 'latin1'); webp.writeUIntLE(1535, 24, 3); webp.writeUIntLE(767, 27, 3);
  assert.deepEqual(webpSize(webp), [1536, 768]);
  assert.equal(webpSize(png), null);
  const fake = { id: 'x', kind: 'illustration', format: 'hero', file: 'images/does-not-exist.webp' };
  assert.match(checkFiles([fake], { x: { status: 'draft', note: '' } })[0], /does not exist/);
  assert.match(checkFiles([fake], { x: { status: 'skipped', note: '' } })[0], /skipped without a note/);
});

// Why: anchors and images need their folder in git, or a fresh checkout has nowhere for the session to save them.
test('the images and anchors folders exist', () => {
  assert.ok(existsSync(join(LIB, 'images', '_anchors', '.gitkeep')));
});

// ---------- the builder shows approved pictures (build-learn.mjs + learn-visuals.mjs) ----------

const PNG = (() => { const b = Buffer.alloc(32); b.write('\x89PNG', 0, 'latin1'); b.writeUInt32BE(1536, 16); b.writeUInt32BE(1024, 20); return b; })();
const fm = (slug) => `---\nslug: ${slug}\ntitle: "T"\ndescription: "D"\nsection: S\nupdated: 2026-01-01\n---\n`;
function fixture(slotList, statuses, page = '# Page\n\n> **Plain version.** Short.\n\n## Parts\n\nFirst para.\n\nSecond para.\n\n## Empty\n\n### Child\n\nChild text.\n', home = '# Home\n\nHi.\n') {
  const d = mkdtempSync(join(tmpdir(), 'vis-'));
  writeFileSync(join(d, 'index.md'), fm('index') + home);
  writeFileSync(join(d, 'topic.md'), fm('topic') + page);
  mkdirSync(join(d, 'visuals', 'slots'), { recursive: true });
  mkdirSync(join(d, 'images'));
  writeFileSync(join(d, 'visuals', 'slots', 'x.json'), JSON.stringify({ section: 'S', slots: slotList }));
  writeFileSync(join(d, 'visuals', 'status.json'), JSON.stringify({ slots: statuses }));
  for (const s of slotList) writeFileSync(join(d, s.file), PNG);
  return d;
}
const slot = (id, after, extra = {}) => ({ id, page: 'topic', kind: 'illustration', after_heading: after, priority: 1, format: 'hero', alt: `Alt text for ${id} picture`, caption: `Cap ${id}`, file: `images/${id}.webp`, ...extra });

// Why: a picture must sit where the slot says (after the Plain version box, or after the first block under its heading), or it breaks the reading flow.
test('approved pictures are placed after the Plain version box and after the first block under a heading', () => {
  const d = fixture([slot('a', 'Plain version'), slot('b', 'Parts', { priority: 2 }), slot('c', 'Empty', { priority: 2 })], { a: { status: 'approved' }, b: { status: 'approved' }, c: { status: 'approved' } });
  const html = buildSite(d).files.get('topic/index.html');
  // CHANGED (formats): the figure carries its format class and the format's web size. Was: class="lib-figure" ... a.png ... height="1024"
  assert.match(html, /<\/blockquote>\n<figure class="lib-figure lib-figure--hero"><img src="\.\.\/img\/a\.webp" alt="Alt text for a picture" width="1536" height="768" loading="lazy" decoding="async"><figcaption>Cap a<\/figcaption><\/figure>/);
  assert.match(html, /<p>First para\.<\/p>\n<figure class="lib-figure lib-figure--hero"><img src="\.\.\/img\/b\.webp"/);
  assert.match(html, /<h2 id="empty">Empty<\/h2>\n<figure class="lib-figure lib-figure--hero"><img src="\.\.\/img\/c\.webp"[^\n]*\n<h3/, 'a heading followed by a sub-heading gets the picture right after it');
});

// Why: only pictures the owner approved may go public; drafts and skipped images must never appear on a page.
test('draft pictures are not shown, and approved ones are copied and used as the share image', () => {
  const d = fixture([slot('a', 'Plain version'), slot('b', 'Parts')], { a: { status: 'draft' }, b: { status: 'approved' } });
  const { files } = buildSite(d);
  const html = files.get('topic/index.html');
  assert.doesNotMatch(html, /img\/a\.webp/);
  assert.ok(Buffer.isBuffer(files.get('img/b.webp')) && files.get('img/b.webp').equals(PNG), 'the approved image is copied byte for byte');
  assert.ok(!files.has('img/a.webp'));
  assert.match(html, /<meta property="og:image" content="https:\/\/tabuladebate\.com\/learn\/img\/b\.webp">/);
});

// Why: if a page heading is renamed, an approved picture must stop the build instead of silently vanishing.
test('an approved picture whose place is missing stops the build', () => {
  const d = fixture([slot('a', 'Renamed heading')], { a: { status: 'approved' } });
  assert.throws(() => buildSite(d), /no place "Renamed heading"/);
});

// Why: the edge cases of placement must not lose or nest a picture: a heading at the page end, a list as the first block, a repeated heading, or two pictures in one place.
test('placement handles the page end, list blocks, repeated headings and shared places', () => {
  const h = (place) => ({ kind: 'heading', place, html: `<h2>${place}</h2>` });
  const o = (x) => ({ kind: 'other', html: x });
  assert.equal(placeFigures([o('<p>a</p>'), h('End')], [{ place: 'End', html: '<figure>F</figure>' }], 's'), '<p>a</p>\n<h2>End</h2>\n<figure>F</figure>');
  assert.equal(placeFigures([h('L'), o('<ul><li>x</li></ul>'), o('<p>b</p>')], [{ place: 'L', html: '<figure>F</figure>' }], 's'), '<h2>L</h2>\n<ul><li>x</li></ul>\n<figure>F</figure>\n<p>b</p>');
  assert.throws(() => placeFigures([h('X'), o('<p>1</p>'), h('X'), o('<p>2</p>')], [{ place: 'X', html: 'F' }], 's'), /matches more than once/);
  assert.throws(() => placeFigures([h('X')], [{ place: 'X', html: 'F' }, { place: 'X', html: 'G' }], 's'), /share the place/);
  assert.equal(placeFigures([h('S'), o('<table>t</table>'), o('<p>c</p>')], [{ place: 'S', float: true, html: '<figure>F</figure>' }], 's'), '<h2>S</h2>\n<figure>F</figure>\n<table>t</table>\n<p>c</p>', 'a floating spot goes right after its heading, so text flows beside it');
});

// Why: the share image must be a real picture (never an SVG diagram), and a picture on the home page must use the right path.
test('og:image skips diagrams, and the home page uses img/ with no ../', () => {
  const d = fixture([slot('a', 'Plain version', { kind: 'diagram', format: 'diagram', file: 'images/a.svg', diagram_spec: 'x' })], { a: { status: 'approved' } });
  const html = buildSite(d).files.get('topic/index.html');
  assert.match(html, /img\/a\.svg/);
  assert.doesNotMatch(html, /og:image/, 'a page with only a diagram has no share image');
  const h = fixture([slot('h', 'Plain version', { page: 'index' })], { h: { status: 'approved' } }, undefined, '# Home\n\n> **Plain version.** Hi.\n');
  assert.match(buildSite(h).files.get('index.html'), /<img src="img\/h\.webp"/);
});

// Why: a skipped picture, or one for a page that does not exist, must never reach the site, and a typo must not pass silently.
test('skipped pictures are not shown, and an approved picture for an unknown page stops the build', () => {
  const d = fixture([slot('a', 'Plain version')], { a: { status: 'skipped', note: 'no' } });
  assert.doesNotMatch(buildSite(d).files.get('topic/index.html'), /<figure/);
  const t = fixture([slot('a', 'Plain version', { page: 'nope' })], { a: { status: 'approved' } });
  assert.throws(() => buildSite(t), /not a library page/);
});

// Why: each format has its own layout; a spot picture must get the small no-card layout, and a hero must be cropped to a banner, or pages look uneven.
test('each format gets its class and web size, and process-image crops the centre to the format shape', async () => {
  const d = fixture([slot('a', 'Plain version', { format: 'spot' }), slot('b', 'Parts', { format: 'inline', priority: 2 })], { a: { status: 'approved' }, b: { status: 'approved' } });
  const html = buildSite(d).files.get('topic/index.html');
  assert.match(html, /<figure class="lib-figure lib-figure--spot"><img src="\.\.\/img\/a\.webp"[^>]*width="480" height="480"/);
  assert.match(html, /<figure class="lib-figure lib-figure--inline"><img src="\.\.\/img\/b\.webp"[^>]*width="1200" height="800"/);
  const { cropBox } = await import('./docs/library/visuals/process-image.mjs');
  assert.deepEqual(cropBox([1536, 1024], [1536, 768]), [1536, 768], 'a 3:2 original is cropped top and bottom to a 2:1 banner');
  assert.deepEqual(cropBox([1254, 1254], [1200, 800]), [1254, 836], 'a square original is cropped to 3:2');
  assert.deepEqual(cropBox([1536, 1024], [480, 480]), [1024, 1024], 'a 3:2 original is cropped at the sides to a square');
});

// Why: every prompt must ask the image tool for the right shape; a banner prompt without the middle-band rule gets its subject cut off by the crop.
test('each format asks for the right size, and banners keep shapes in the middle band', () => {
  const t = templateBlock();
  const pick = (f) => slots.find((s) => s.kind === 'illustration' && s.format === f);
  assert.match(buildPrompt(pick('hero'), t), /3:2 image \(1536×1024\)[\s\S]*middle band/);
  assert.match(buildPrompt(pick('inline'), t), /3:2 image \(1536×1024\), plain white background, PNG\.$/);
  assert.match(buildPrompt(pick('spot'), t), /1:1 image \(1024×1024\)/);
});

// Why: a shared link should show a real banner, not a tiny spot picture, when the page has both.
test('the share image prefers a banner or inline picture over a spot', () => {
  const a = { id: 'a', kind: 'illustration', format: 'spot', priority: 1 };
  const b = { id: 'b', kind: 'illustration', format: 'hero', priority: 2 };
  assert.equal(shareImage([a, b]).id, 'b');
  assert.equal(shareImage([a]).id, 'a', 'a spot is used when it is the only picture');
  assert.equal(shareImage([{ id: 'd', kind: 'diagram', format: 'diagram' }]), null);
});
