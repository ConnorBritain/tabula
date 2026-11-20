// Tests for the Debate Library builder (build-learn.mjs). Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { buildSite, markdown, inline, relHref, nextSteps, isPageFile, parseFrontMatter, readingPaths, OUT, SRC } from './build-learn.mjs';
import { loadTracks } from './learn-tracks.mjs';
const PATHS = readingPaths(loadTracks(SRC));

const ROOT = dirname(new URL(import.meta.url).pathname);
const tmpSite = (files) => { const d = mkdtempSync(join(tmpdir(), 'learn-')); for (const [n, t] of Object.entries(files)) writeFileSync(join(d, n), t); writeFileSync(join(d, 'learn.css'), ''); return d; };
const fm = (slug, extra = '') => `---\nslug: ${slug}\ntitle: "T"\ndescription: "D"\nsection: S\nupdated: 2026-01-01\n${extra}---\n`;

const site = buildSite();
const htmlPages = [...site.files].filter(([f]) => f.endsWith('.html'));

// WHY: learn/ is committed and served as-is. If someone edits a page and forgets to rebuild, the site and the app ship old text.
test('learn/ matches a fresh build of docs/library (run: node build-learn.mjs)', () => {
  for (const [rel, text] of site.files) {
    const p = join(OUT, rel);
    assert.ok(existsSync(p), `learn/${rel} is missing`);
    assert.equal(readFileSync(p, 'utf8'), text, `learn/${rel} is out of date`);
  }
  const onDisk = [];
  const walk = (d, pre = '') => { for (const e of readdirSync(d, { withFileTypes: true })) e.isDirectory() ? walk(join(d, e.name), pre + e.name + '/') : onDisk.push(pre + e.name); };
  walk(OUT);
  for (const f of onDisk) assert.ok(site.files.has(f), `learn/${f} is left over from an old build`);
});

// WHY: a judge who clicks a link mid-tournament and gets a "not found" page, or lands at the top instead of the right section, loses trust in the library.
test('every relative link on every built page points to a built file, and every #anchor exists', () => {
  const rootFiles = (rel) => existsSync(join(ROOT, rel));
  for (const [rel, html] of htmlPages) {
    for (const [, href] of html.matchAll(/(?:href|src|srcset)="([^"]+)"/g)) {
      if (/^(https?:|mailto:)/.test(href)) continue;
      const [path, frag] = href.split('#');
      const abs = resolve(dirname(join(OUT, rel)), path || '.');
      if (!abs.startsWith(OUT)) { assert.ok(rootFiles(abs.slice(ROOT.length + 1) || 'index.html'), `learn/${rel}: broken link ${href}`); continue; }
      const inLearn = abs.slice(OUT.length + 1);
      const target = path === '' ? rel : (path.endsWith('/') || inLearn === '' ? join(inLearn, 'index.html') : inLearn);
      assert.ok(site.files.has(target), `learn/${rel}: broken link ${href}`);
      if (frag) assert.ok(site.files.get(target).includes(`id="${frag}"`), `learn/${rel}: no #${frag} on ${target}`);
    }
  }
});

// WHY: drafts link ahead to pages not written yet. Those must show as plain words, never as dead links, and must not fill the "Related pages" list with dead ends.
test('links to unwritten pages become plain text, and their Related pages items are dropped', () => {
  const pages = new Map([['a', {}], ['b', {}]]);
  const ctx = { slug: 'a', pages, missing: new Set() };
  assert.equal(inline('See [B](b.md) and [Later](later.md).', ctx), 'See <a href="../b/">B</a> and Later.');
  const { html } = markdown('## Related pages\n\n- [B](b.md): why.\n- [Later](later.md): soon.\n', ctx);
  assert.match(html, /<li><a href="..\/b\/">B<\/a>: why.<\/li>/);
  assert.doesNotMatch(html, /Later/);
  assert.deepEqual([...ctx.missing], ['later']);
});

// WHY: the reviewer names in *.local.md are private until each person agrees. Publishing them, or the plan, breaks that promise.
test('private and planning files are never published', () => {
  assert.equal(isPageFile('REVIEWERS.local.md'), false);
  assert.equal(isPageFile('PLAN.md'), false);
  assert.equal(isPageFile('LICENSE.md'), false);
  const dir = tmpSite({ 'index.md': fm('index') + '# Home\n', 'secret.local.md': fm('secret') + '# S\n\n- Ann Lee: coach\n', 'PLAN.md': fm('PLAN') + '# Plan\n\nAnn Lee\n' });
  const { files } = buildSite(dir);
  assert.deepEqual([...files.keys()].sort(), ['index.html', 'learn.css', 'sitemap.xml']);
  for (const text of files.values()) assert.ok(!text.includes('Ann Lee'));
  // The real private file, when it exists on this machine, must not leak either.
  for (const f of readdirSync(SRC).filter((x) => x.endsWith('.local.md'))) {
    const names = [...readFileSync(join(SRC, f), 'utf8').matchAll(/^- ([A-Z][a-z]+ [A-Z][a-z]+):/gm)].map((m) => m[1]);
    assert.ok(names.length > 0, `${f}: expected "- First Last:" lines to check`);
    for (const [rel, text] of site.files) for (const name of names) assert.ok(!text.includes(name), `learn/${rel} contains a private name`);
  }
});

// WHY: the site's security rule (CSP) blocks inline scripts. An inline script would break, and loading scripts is not the library's job.
test('built pages hold no runnable script, only JSON-LD data', () => {
  for (const [rel, html] of htmlPages) {
    // Allowed: JSON-LD data, and the one self-hosted check script (TRACKS.md §3.4) at any depth. Nothing inline.
    // CHANGED 2026-11-20 because the owner's spec (SPEC.md V10, Q3: Light / Dark / System theme with no flash) loads the
    // self-hosted assets/theme-boot.js in <head> on all three page types. It is a same-site file, not inline, so the
    // CSP still holds. Old check:
    //   assert.ok(tag === '<script type="application/ld+json">' || /^<script src="(\.\/|(\.\.\/)+)?check\.js" defer>$/.test(tag), `learn/${rel}: ${tag}`);
    for (const [tag] of html.matchAll(/<script\b[^>]*>/g)) assert.ok(tag === '<script type="application/ld+json">' || /^<script src="(\.\/|(\.\.\/)+)?check\.js" defer>$/.test(tag) || /^<script src="(\.\.\/)+assets\/theme-boot\.js">$/.test(tag), `learn/${rel}: ${tag}`);
    for (const [, body] of html.matchAll(/<script src="[^"]*">([\s\S]*?)<\/script>/g)) assert.equal(body, '', `learn/${rel}: a script tag with a src must be empty`);
    for (const [, body] of html.matchAll(/<script src="[^"]*" defer>([\s\S]*?)<\/script>/g)) assert.equal(body, '', `learn/${rel}: a script tag with a src must be empty`);
    assert.doesNotMatch(html, /\son[a-z]+="/, `learn/${rel} has an inline event handler`);
  }
});

// WHY: search results show the title and description. Too long gets cut off; a missing H1 or canonical hurts how the page ranks.
test('every page has a good title, description, one H1 and a canonical URL', () => {
  for (const [rel, html] of htmlPages) {
    const title = /<title>([^<]*)<\/title>/.exec(html)[1].replace(/&amp;/g, '&');
    const desc = /<meta name="description" content="([^"]*)"/.exec(html)[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&');
    assert.ok(title.length > 0 && title.length <= 60, `learn/${rel}: title is ${title.length} chars`);
    assert.ok(desc.length >= 140 && desc.length <= 160, `learn/${rel}: description is ${desc.length} chars`);
    assert.equal((html.match(/<h1>/g) || []).length, 1, `learn/${rel}: needs exactly one H1`);
    assert.match(html, /<link rel="canonical" href="https:\/\/tabuladebate\.com\/learn\/[a-z0-9-/]*">/);
  }
});

// WHY: page text must show as text. If raw HTML in a page ran as code, a typo or a bad paste could break or attack the page.
test('Markdown text is escaped, not run as HTML', () => {
  const ctx = { slug: 'a', pages: new Map(), missing: new Set() };
  assert.equal(inline('<script>x</script> & "q"', ctx), '&lt;script&gt;x&lt;/script&gt; &amp; &quot;q&quot;');
  assert.match(markdown('```\n<b>flow</b>\n```\n', ctx).html, /&lt;b&gt;flow&lt;\/b&gt;/);
});

// WHY: the same files are served at tabuladebate.com/learn/ and inside the app, so links must be relative and right from both depths.
test('relative links are right from the home page and from a topic page', () => {
  assert.equal(relHref('index', 'disadvantages'), 'disadvantages/');
  assert.equal(relHref('disadvantages', 'kritiks'), '../kritiks/');
  assert.equal(relHref('disadvantages', 'index'), '../');
  assert.equal(relHref('index', 'index'), './');
});

// WHY: "Next on your path" must lead to a real page. Pointing a new judge at a page that does not exist yet stops them cold.
test('"next on your path" skips pages that are not written yet', () => {
  const pages = new Map([['disadvantages', { h1Text: 'DA' }], ['counterplans', { h1Text: 'CP' }]]);
  assert.deepEqual(nextSteps('disadvantages', pages), [{ path: 'New debater path', slug: 'counterplans', title: 'CP' }]);
});

// WHY: a page whose file name and slug differ would publish at a URL the plan and other pages do not expect.
test('a page whose slug does not match its file name stops the build', () => {
  const dir = tmpSite({ 'index.md': fm('index') + '# Home\n', 'wrong.md': fm('right') + '# W\n' });
  assert.throws(() => buildSite(dir), /slug "right" must match/);
});

// WHY: a page with no description or date would ship "undefined" to search engines and the sitemap.
test('a page missing required front matter stops the build', () => {
  const dir = tmpSite({ 'index.md': '---\nslug: index\ntitle: "T"\nsection: S\nupdated: 2026-01-01\n---\n# Home\n' });
  assert.throws(() => buildSite(dir), /needs "description"/);
});

// WHY: a "#" inside a quoted title or description must not cut the text, or search results show half a sentence.
test('front matter keeps "#" inside quotes and reads lists', () => {
  assert.deepEqual(parseFrontMatter('---\ntitle: "Debate #1 guide" # note\nsheet: DA # comment\nrelated: [a, b]\n---\n').meta,
    { title: 'Debate #1 guide', sheet: 'DA', related: ['a', 'b'] });
});

// WHY: a nested list would be silently flattened into the wrong meaning. Stopping the build makes the writer fix it.
test('a nested list stops the build instead of being flattened', () => {
  const ctx = { slug: 'a', pages: new Map(), missing: new Set() };
  assert.throws(() => markdown('- one\n  - two\n', ctx), /nested lists/);
  assert.match(markdown('- one\n  wrapped\n', ctx).html, /<li>one wrapped<\/li>/);
});

// WHY: two headings with the same words must get different anchors, or a link to the second lands on the first.
test('heading anchors are unique and quote paragraphs stay apart', () => {
  const ctx = { slug: 'a', pages: new Map(), missing: new Set() };
  const { html } = markdown('## Example\n\n## Example\n\n> one\n>\n> two\n', ctx);
  assert.match(html, /id="example"/);
  assert.match(html, /id="example-2"/);
  assert.match(html, /<blockquote><p>one<\/p><p>two<\/p><\/blockquote>/);
});

// WHY: search engines read the JSON-LD and the sitemap. If either is broken or missing a page, that page may not be found.
test('JSON-LD parses, and the sitemap lists every page with a date', () => {
  const sitemap = site.files.get('sitemap.xml');
  for (const [rel, html] of htmlPages) {
    const ld = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)[1]);
    assert.deepEqual(ld.map((x) => x['@type']), ['Article', 'BreadcrumbList']);
    const loc = 'https://tabuladebate.com/learn/' + (rel === 'index.html' ? '' : rel.replace(/index\.html$/, ''));
    // Draft pages (a track whose checks are not reviewed) carry noindex and stay out of the sitemap.
    if (html.includes('<meta name="robots" content="noindex">')) { assert.ok(!sitemap.includes(`<loc>${loc}</loc>`), `sitemap lists draft ${loc}`); continue; }
    assert.match(sitemap, new RegExp(`<loc>${loc}</loc><lastmod>\\d{4}-\\d{2}-\\d{2}</lastmod>`), `sitemap misses ${loc}`);
  }
});

// WHY: the call to action and the reading-path box are how a reader finds the app and the next page. A build that drops them loses both.
test('built pages carry the call to action, and path pages carry "Next on your path"', () => {
  for (const [rel, html] of htmlPages) assert.match(html, /class="cta"[\s\S]*Flow your next round in Tabula, free\./, `learn/${rel}: no call to action`);
  assert.match(site.files.get('debate-101/index.html'), /Next on your path[\s\S]*New judge path: <a href="..\/first-round-judge\/">/);
});

// WHY: the home page and the "next" box must agree on the order of each path, or a reader gets two different routes.
test("index.md lists each reading path's written pages in the PATHS order", () => {
  const home = readFileSync(join(SRC, 'index.md'), 'utf8');
  const written = new Set(readdirSync(SRC).filter(isPageFile).map((f) => f.slice(0, -3)));
  const sections = { judge: /### I am judging soon[\s\S]*?(?=###)/, novice: /### I am a new debater[\s\S]*?(?=###)/ };
  for (const [key, re] of Object.entries(sections)) {
    const listed = [...re.exec(home)[0].matchAll(/^\d+\..*$/gm)].flatMap((l) => [...l[0].matchAll(/\]\(([a-z0-9-]+)\.md\)/g)].map((m) => m[1]));
    assert.deepEqual(listed, PATHS[key].steps.filter((x) => written.has(x)), `${key} path order differs`);
  }
});

// CHANGED 2026-11-20 because the owner's spec (SPEC.md V0) deletes the copied :root token blocks from learn.css and
// about.html: both now link the one shared file, assets/tokens.css, so there is nothing left to compare. The new test
// below keeps the same goal (library pages look like the app). Old check:
// // WHY: library pages must look like the app in light and dark mode. Copied color tokens drift unless something checks them.
// test('learn.css color tokens match about.html', () => {
//   const tokens = (css, dark) => {
//     const block = dark ? /prefers-color-scheme: dark[\s\S]*?\{[\s\S]*?\{([\s\S]*?)\}/.exec(css)[1] : /:root \{([\s\S]*?)\}/.exec(css)[1];
//     return Object.fromEntries([...block.matchAll(/(--[a-z0-9-]+):\s*(#[0-9a-f]+)/gi)]);
//   };
//   const css = readFileSync(join(SRC, 'learn.css'), 'utf8'), about = readFileSync(join(ROOT, 'about.html'), 'utf8');
//   for (const dark of [false, true]) {
//     const mine = tokens(css, dark), theirs = tokens(about, dark);
//     assert.ok(Object.keys(mine).length > 5);
//     for (const [k, v] of Object.entries(mine)) assert.equal(v, theirs[k], `${dark ? 'dark ' : ''}${k} differs from about.html`);
//   }
// });

// WHY: library pages must look like the app in light and dark mode. A copied token block drifts; one shared file cannot.
test('library pages and About use the one shared token file and keep no copied colours', () => {
  const css = readFileSync(join(SRC, 'learn.css'), 'utf8'), about = readFileSync(join(ROOT, 'about.html'), 'utf8');
  for (const [name, text] of [['learn.css', css], ['about.html', about]]) {
    assert.doesNotMatch(text, /:root\s*(\[[^\]]*\]\s*)?\{/, `${name} has its own :root block`);
    assert.doesNotMatch(text, /--[a-z0-9-]+:\s*#[0-9a-f]{3,8}/i, `${name} defines its own colour token`);
  }
  assert.match(about, /<link rel="stylesheet" href="assets\/tokens\.css">/);
  for (const [rel, html] of htmlPages) assert.match(html, /<link rel="stylesheet" href="(\.\.\/)+assets\/tokens\.css">/, `learn/${rel} links tokens.css`);
});
