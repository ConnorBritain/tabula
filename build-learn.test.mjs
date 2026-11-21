// Tests for the Debate Library builder (build-learn.mjs). Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { buildSite, markdown, inline, relHref, nextSteps, isPageFile, parseFrontMatter, readingPaths, metaText, placeLead, OUT, SRC } from './build-learn.mjs';
import { loadTracks } from './learn-tracks.mjs';
import { renderPathCards } from './learn-home.mjs';
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
    // CHANGED (pictures): images are binary, so a Buffer is compared byte for byte; text files as before.
    // Was: assert.equal(readFileSync(p, 'utf8'), text, `learn/${rel} is out of date`);
    if (Buffer.isBuffer(text)) assert.ok(readFileSync(p).equals(text), `learn/${rel} is out of date`);
    else assert.equal(readFileSync(p, 'utf8'), text, `learn/${rel} is out of date`);
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

// WHY: READERS.md is the writers' map of who reads each page; publishing it would put an internal planning doc on the public site.
test('the reader map is a planning doc, not a page', () => {
  assert.equal(isPageFile('READERS.md'), false);
});

// WHY: writers size each page's words to the reader READERS.md names for it; a page missing from the map gets written for no one in particular.
test('every library page is named in the reader map', () => {
  const map = readFileSync(join(SRC, 'READERS.md'), 'utf8');
  for (const f of readdirSync(SRC).filter(isPageFile)) {
    const slug = f.slice(0, -3);
    assert.ok(map.includes('`' + slug + '`'), `${slug} is not in docs/library/READERS.md`);
  }
});

// WHY: the reviewer names in *.local.md are private until each person agrees. Publishing them, or the plan, breaks that promise.
test('private and planning files are never published', () => {
  assert.equal(isPageFile('REVIEWERS.local.md'), false);
  assert.equal(isPageFile('PLAN.md'), false);
  assert.equal(isPageFile('LICENSE.md'), false);
  const dir = tmpSite({ 'index.md': fm('index') + '# Home\n', 'secret.local.md': fm('secret') + '# S\n\n- Ann Lee: coach\n', 'PLAN.md': fm('PLAN') + '# Plan\n\nAnn Lee\n' });
  const { files } = buildSite(dir);
  // CHANGED 2026-11-20 because the owner asked for a reading helper and an in-app "Back to the app" link (Library
  // redesign); both live in one self-hosted file, library.js, which every build now writes. Old check:
  //   assert.deepEqual([...files.keys()].sort(), ['index.html', 'learn.css', 'sitemap.xml']);
  assert.deepEqual([...files.keys()].sort(), ['index.html', 'learn.css', 'library.js', 'sitemap.xml']);
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
    // CHANGED 2026-11-20 because the owner asked for a reading helper (progress, minutes left, jump to a section) and an
    // in-app "Back to the app" link: one self-hosted learn/library.js at the end of each page. Still no inline script.
    // Old check:
    //   for (const [tag] of html.matchAll(/<script\b[^>]*>/g)) assert.ok(tag === '<script type="application/ld+json">' || /^<script src="(\.\/|(\.\.\/)+)?check\.js" defer>$/.test(tag) || /^<script src="(\.\.\/)+assets\/theme-boot\.js">$/.test(tag), `learn/${rel}: ${tag}`);
    for (const [tag] of html.matchAll(/<script\b[^>]*>/g)) assert.ok(tag === '<script type="application/ld+json">' || /^<script src="(\.\/|(\.\.\/)+)?check\.js" defer>$/.test(tag) || /^<script src="(\.\.\/)+assets\/theme-boot\.js">$/.test(tag) || /^<script src="(\.\/|(\.\.\/)+)?library\.js">$/.test(tag), `learn/${rel}: ${tag}`);
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

// WHY: writers mark the summary with "**Plain version.**", but readers should see only the summary; a visible label repeats on all 78 pages and looks like boilerplate.
test('the Plain version marker sets the summary style but is not shown on the page', () => {
  const ctx = { slug: 'a', pages: new Map(), missing: new Set() };
  const { html, blocks } = markdown('> **Plain version.** A short summary.\n>\n> More.\n', ctx);
  assert.match(html, /<blockquote class="plain"><p>A short summary\.<\/p><p>More\.<\/p><\/blockquote>/);
  assert.doesNotMatch(html, /Plain version/);
  assert.equal(blocks[0].kind, 'plain');
});

// WHY: a summary written as one long paragraph reads as a wall of text; the lead sentence plus short points must
// render as a real list, or the summary falls back to the run-on block readers skip.
test('a summary can be a lead sentence followed by a bullet list', () => {
  const ctx = { slug: 'a', pages: new Map(), missing: new Set() };
  const { html } = markdown('> **Plain version.** The lead.\n>\n> - **One:** first point.\n> - **Two:** second point,\n>   carried on.\n', ctx);
  assert.equal(html, '<blockquote class="plain"><p>The lead.</p><ul><li><strong>One:</strong> first point.</li><li><strong>Two:</strong> second point, carried on.</li></ul></blockquote>');
  assert.throws(() => markdown('> **Plain version.** L.\n>\n> - One.\n>   - Nested.\n', ctx), /nested lists are not supported/, 'a nested point would be silently flattened');
});

// WHY: without this gate, a page summary can quietly slide back into one long paragraph (or grow a fifth point) and
// nothing fails; hurried readers then skip the one part written for them.
test('every page summary is one short lead sentence plus at most four points', () => {
  for (const [rel, html] of htmlPages) {
    const box = /<blockquote class="plain">([\s\S]*?)<\/blockquote>/.exec(html);
    if (!box) continue;
    const m = /^<p>([\s\S]*?)<\/p>(?:<ul>((?:<li>[\s\S]*?<\/li>){1,4})<\/ul>)?$/.exec(box[1]);
    assert.ok(m, `learn/${rel}: the summary must be one lead paragraph, then at most one list of 1 to 4 points`);
    const words = m[1].replace(/<[^>]+>/g, '').split(/\s+/).filter(Boolean).length;
    assert.ok(words <= 30, `learn/${rel}: the summary's lead is ${words} words (30 at most)`);
  }
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

// WHY: the Library is part of tabuladebate.com and is also opened from the app. Without the site's top bar and a real
// app link, a reader who lands from search has no way back to the app or on to the rest of the site.
test('every page has the site top bar, a link to the app, and the site footer links', () => {
  for (const [rel, html] of htmlPages) {
    const top = /<header class="site">[\s\S]*?<\/header>/.exec(html)?.[0] || '';
    assert.match(top, /href="https:\/\/tabuladebate\.com\/"/, `learn/${rel}: brand does not go to the site home`);
    assert.match(top, />Coaches<\/a>/, `learn/${rel}: no site nav`);
    assert.match(top, /href="https:\/\/debate\.tabulaspeech\.com\/" data-app="(\.\.\/)+" data-back-label="Back to the app">Open the app</, `learn/${rel}: no app link (or no in-app way back)`);
    assert.doesNotMatch(top, /Debate Library/, `learn/${rel}: the top bar repeats the Library name`);
    assert.match(html, /<nav class="foot-nav"[\s\S]*?tabulaspeech\.com\/plans\//, `learn/${rel}: no site links in the footer`);
  }
});

// WHY: long pages need "On this page" so a reader can jump to the part they came for; the list must point at real headings.
test('long article pages get an "On this page" list that links to their sections', () => {
  const html = site.files.get('disadvantages/index.html');
  const toc = /<nav class="toc"[\s\S]*?<\/nav>/.exec(html)?.[0] || '';
  const ids = [...toc.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
  assert.ok(ids.length >= 3, 'no On this page list');
  for (const id of ids) assert.match(html, new RegExp(`<h2 id="${id}">`), `On this page points at a missing heading: ${id}`);
  assert.doesNotMatch(site.files.get('index.html'), /class="toc"/, 'the home page should not get an On this page list');
});

// WHY: the reading helper (library.js) builds its progress, minutes left and section list from these hooks; if the
// builder drops one, readers lose their place-keeping silently ("N min left" turns into a bare percent, or nothing).
test('long pages carry the hooks the reading helper needs and load library.js', () => {
  const html = site.files.get('disadvantages/index.html');
  assert.match(html, /<div class="page-main" data-minutes="\d+">/);
  assert.match(html, /<nav class="toc" aria-label="On this page"><p class="toc-title">On this page<\/p><ul>/);
  assert.match(html, /<script src="\.\.\/library\.js"><\/script>\n<\/body>/);
  const js = readFileSync(join(SRC, 'library.js'), 'utf8');
  for (const hook of ["'nav.toc'", "'.page-main'", 'dataset.minutes', "'.toc-title'", "'a[data-app]'"]) assert.ok(js.includes(hook), `library.js no longer reads ${hook}`);
});

// WHY: a new judge or debater picks a path on the home page; if the choices blur into one long list, or a choice
// points at a missing section, readers start in the wrong place or give up before the first page.
test('the home page offers each path as a card, and the judge path links to its guided track', () => {
  const home = site.files.get('index.html');
  const picks = [...home.matchAll(/<a class="path-pick" href="#([^"]+)">/g)].map((m) => m[1]);
  assert.ok(picks.length >= 3, 'fewer than three path choices');
  for (const id of picks) assert.match(home, new RegExp(`<section class="path-card" aria-labelledby="${id}"><h3 id="${id}">`), `choice #${id} has no card`);
  assert.match(home, /<section class="path-card" aria-labelledby="i-am-judging-soon[^"]*">[\s\S]*?<a href="tracks\/judge\/">Take it as a guided track<\/a>[\s\S]*?<\/section>/);
  assert.match(home, /<span class="path-pick-meta">About 30 minutes · 6 pages<\/span>/, 'the judge choice should say how long and how many pages');
  const debater = /<section class="path-card" aria-labelledby="i-am-a-new-debater[^"]*">[\s\S]*?<\/section>/.exec(home)[0];
  assert.doesNotMatch(debater, /class="path-track"/, 'a path whose track is not built must not link to it or promise it');
  assert.doesNotMatch(home, /coming/i, 'the home page must not promise unbuilt tracks');
});

// WHY: the home page's path cards are rebuilt from index.md; an intro line under "Pick your path" must not vanish, a
// branch list must not claim a page count, and a broken heading must stop the build instead of losing a path.
test('path cards keep intro text, count only numbered paths, and reject a malformed heading', () => {
  const html = '<h2 id="pick-your-path">Pick your path</h2>\n<p>Intro.</p>\n<h3 id="a">New (about 5 minutes)</h3><ol><li><a href="x/">X</a></li><li><a href="y/">Y</a></li></ol>\n<h3 id="b">Old hand</h3><ul><li><a href="z/">Z</a></li></ul>\n<h2 id="next">Next</h2>';
  const tracks = [{ id: 't', steps: ['x', 'y'] }, { id: 'u', steps: ['x'] }];
  const out = renderPathCards(html, tracks, new Map([['t', { ready: true }], ['u', { ready: true }]]), (id) => id + '/');
  assert.match(out, /<\/h2>\s*<p>Intro\.<\/p>\s*<nav class="path-chooser"/);
  assert.match(out, /<span class="path-pick-meta">About 5 minutes · 2 pages<\/span>/);
  assert.match(out, /<a class="path-pick" href="#b"><span class="path-pick-name">Old hand<\/span><span class="path-pick-meta"><\/span>/);
  assert.equal((out.match(/Take it as a guided track/g) || []).length, 1, 'only the exact-match track links, once');
  assert.match(out, /<a href="tracks\/t\/">Take it as a guided track/);
  assert.throws(() => renderPathCards('<h2 id="pick-your-path">P</h2><h3 class="x">Bad</h3><h2 id="n">N</h2>', [], new Map(), String), /expected a "### " path heading/);
});

// WHY: the top bar already names the site; a breadcrumb or meta line that repeats "Debate Library" or the section is
// clutter a reader must skip on every page.
test('the breadcrumb starts at "Library" and the meta line is just read time and level', () => {
  const html = site.files.get('disadvantages/index.html');
  assert.match(html, /<nav class="crumbs" aria-label="Breadcrumb"><a href="..\/">Library<\/a> ›/);
  assert.match(html, /<\/h1>\n<p class="meta">\d+ min read · Beginner<\/p>/);
  assert.equal(metaText({ reading_time: 7, level: 'intermediate', section: 'Disadvantages' }), '7 min read · Intermediate');
});

// WHY: the summary is the page's whole point for a reader who stops early, and the banner picture belongs to it; a
// list or control wedged in before them pushes the answer down.
test('the phone "On this page" list comes after the summary and its banner picture', () => {
  const lead = '<h1>T</h1>\n<blockquote class="plain"><p>S.</p></blockquote>\n<figure class="lib-figure lib-figure--hero"><img src="a"></figure>\n<h2 id="x">X</h2>';
  assert.equal(placeLead(lead, '<p class="meta">M</p>', '<details class="toc-m"></details>'),
    '<h1>T</h1>\n<p class="meta">M</p>\n<blockquote class="plain"><p>S.</p></blockquote>\n<figure class="lib-figure lib-figure--hero"><img src="a"></figure>\n<details class="toc-m"></details>\n<h2 id="x">X</h2>');
  assert.equal(placeLead('<h1>T</h1>\n<p>P</p>', '', ''), '<h1>T</h1>\n<p>P</p>', 'no meta and no list leaves the page alone');
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
