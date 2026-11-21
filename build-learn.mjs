// Debate Library builder (docs/library/PLAN.md §9).
// Turns docs/library/*.md into static pages in learn/: learn/index.html and learn/<slug>/index.html.
// The app and tabuladebate.com both serve learn/ as it is, so links between Library pages are relative. The top bar
// and footer link out to the sites (absolute), and library.js points the app link back to the app when opened there.
// No dependencies, no inline scripts (the site's CSP blocks them). Run: node build-learn.mjs
import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTracks, loadChecks, trackState, renderCheck, buildTrackPages, renderHomeTracks } from './learn-tracks.mjs';
import { loadApproved, figureHtml, shareImage, placeFigures, PLAIN } from './learn-visuals.mjs';
import { FORMATS } from './docs/library/visuals/slots.mjs';
// "**Plain version.**" at the start of a quote marks the page summary. It sets the summary style; readers do not see it.
const PLAIN_LABEL = new RegExp(`^<p><strong>${PLAIN}\\.?</strong>\\s*`);

const ROOT = dirname(fileURLToPath(import.meta.url));
export const SRC = join(ROOT, 'docs', 'library');
export const OUT = join(ROOT, 'learn');
const SITE = 'https://tabuladebate.com';
// The Library is one site section of tabuladebate.com, and it is also opened from inside the app (PLAN.md §8.1).
// Its top bar and footer copy the site's own (repo tabula-sites, layout.mjs: SITES.debate nav, Sign in, "Open the
// app", LINKS.app). Keep the two in step: a nav change on the site must change SITE_NAV here too (PLAN.md §4).
const APP = 'https://debate.tabulaspeech.com/';
const FAMILY = 'https://tabulaspeech.com';
const SITE_NAV = [['Library', null], ['Coaches', `${SITE}/coaches/`], ['School IT', `${SITE}/school-it/`]];
const MENU_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';

// Reading paths come from docs/library/tracks.json (TRACKS.md §2.9): every track with a pathName is a path.
// This feeds the "Next on your path" box; a test checks that docs/library/index.md lists the steps in the same order.
export const readingPaths = (tracks) => Object.fromEntries(tracks.filter((t) => t.pathName).map((t) => [t.id, { name: t.pathName, steps: t.steps }]));

// ---------- source files ----------

// Pages are Markdown files with front matter. Planning docs, LICENSE.md and *.local.md (private) are never published.
const NOT_PAGES = new Set(['PLAN.md', 'LICENSE.md', 'TRACKS.md', 'READERS.md']);
export function isPageFile(name) {
  return name.endsWith('.md') && !name.endsWith('.local.md') && !NOT_PAGES.has(name);
}

// Front matter: `key: value`, `key: "quoted value"` or `key: [a, b]`. A "# note" after a value is a comment,
// except inside quotes, so a title like "Debate #1" stays whole.
export function parseFrontMatter(text) {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  if (!m) return { meta: null, body: text };
  const meta = {};
  for (const line of m[1].split('\n')) {
    const kv = /^([a-z_]+):\s*(.*)$/.exec(line);
    if (!kv) continue;
    const raw = kv[2];
    const quoted = /^"((?:[^"\\]|\\.)*)"\s*(?:#.*)?$/.exec(raw);
    if (quoted) { meta[kv[1]] = quoted[1].replace(/\\"/g, '"'); continue; }
    const v = raw.replace(/\s+#.*$/, '').trim();
    meta[kv[1]] = /^\[.*\]$/.test(v) ? v.slice(1, -1).split(',').map((x) => x.trim()).filter(Boolean) : v;
  }
  return { meta, body: text.slice(m[0].length) };
}

const REQUIRED = ['title', 'description', 'section', 'updated'];

export function loadPages(dir = SRC) {
  const pages = new Map();
  for (const name of readdirSync(dir).sort()) {
    if (!isPageFile(name)) continue;
    const { meta, body } = parseFrontMatter(readFileSync(join(dir, name), 'utf8'));
    if (!meta || !meta.slug) continue; // no front matter: not a page
    if (meta.slug + '.md' !== name) throw new Error(`${name}: slug "${meta.slug}" must match the file name`);
    if (meta.slug === 'tracks') throw new Error(`${name}: "tracks" is kept for the guided tracks pages`);
    for (const k of REQUIRED) if (!meta[k]) throw new Error(`${name}: front matter needs "${k}"`);
    pages.set(meta.slug, { meta, body });
  }
  return pages;
}

// ---------- Markdown (the small subset the library uses) ----------

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slugify = (s) => s.toLowerCase().replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Where a page lives, relative to another page. A page id is its folder under learn/: 'index' is the home
// (learn/index.html), 'disadvantages' is learn/disadvantages/, 'tracks/judge' is learn/tracks/judge/.
const segments = (id) => (id === 'index' ? [] : id.split('/'));
export function relHref(fromId, toId) {
  const up = '../'.repeat(segments(fromId).length);
  const to = segments(toId).join('/');
  return to ? `${up}${to}/` : (up || './');
}

// Inline Markdown: `code`, [text](url), **bold**, *italic*. Links to unwritten pages become plain text.
export function inline(text, ctx) {
  const codes = [];
  let s = esc(text).replace(/`([^`]+)`/g, (_, c) => `\u0000${codes.push(`<code>${c}</code>`) - 1}\u0000`);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => {
    const local = /^([a-z0-9-]+)\.md(#[a-z0-9-]+)?$/.exec(href);
    if (local) {
      if (!ctx.pages.has(local[1])) { ctx.missing.add(local[1]); return label; }
      return `<a href="${relHref(ctx.slug, local[1])}${local[2] || ''}">${label}</a>`;
    }
    if (/^https?:\/\//.test(href)) return `<a href="${href}" rel="noopener">${label}</a>`;
    throw new Error(`${ctx.slug}: unsupported link target "${href}"`);
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?![*\w])/g, '$1<em>$2</em>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => codes[+i]);
}

const splitRow = (line) => line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
const LIST_ITEM = /^(\s*)([-*]|\d+\.)\s+(.*)$/;
const BLOCK_START = /^(#{1,6}\s|```|>|\||\s*([-*]|\d+\.)\s)/;

// Each block reader takes (lines, i, ctx) and returns { html, next } (next = the first line after the block).
export const fenceHtml = (code) => `<pre class="flow"><code>${esc(code)}</code></pre>`;
function fence(lines, i) {
  const code = [];
  for (i++; i < lines.length && !lines[i].startsWith('```'); i++) code.push(lines[i]);
  return { html: fenceHtml(code.join('\n')), next: i + 1 };
}

function heading(lines, i, ctx) {
  const [, hashes, text] = /^(#{1,6})\s+(.*)$/.exec(lines[i]);
  const html = inline(text, ctx);
  ctx.lastHeading = hashes.length === 1 ? null : text.trim(); // the place name a picture slot can point at
  if (hashes.length === 1) { ctx.h1 = html; return { html: `<h1>${html}</h1>`, next: i + 1 }; }
  if (hashes.length === 2) ctx.section = text;
  let id = slugify(html) || 'section', n = 2; // ids stay unique, so every anchor link lands
  while (ctx.ids.has(id)) id = `${slugify(html)}-${n++}`;
  ctx.ids.add(id);
  return { html: `<h${hashes.length} id="${id}">${html}</h${hashes.length}>`, next: i + 1 };
}

// A blank ">" line starts a new paragraph inside the quote. Lines that start with "- " form a bullet list, so a
// summary can be one lead sentence plus a few short points instead of one long paragraph. This applies to every
// quote on purpose (today only summaries use it). One level only: an indented bullet stops the build.
function quote(lines, i, ctx) {
  const parts = [{ kind: 'p', lines: [] }];
  const last = () => parts[parts.length - 1];
  for (; i < lines.length && lines[i].startsWith('>'); i++) {
    const t = lines[i].replace(/^>\s?/, '').trim();
    if (/^>\s{2,}[-*]\s/.test(lines[i])) throw new Error(`${ctx.slug}: nested lists are not supported in a quote (line ${i + 1}: ${lines[i].trim()})`);
    const item = /^[-*]\s+(.*)$/.exec(t);
    if (item) { if (last().kind !== 'ul') parts.push({ kind: 'ul', lines: [] }); last().lines.push(item[1]); }
    else if (t && last().kind === 'ul' && /^>\s{3,}\S/.test(lines[i])) last().lines[last().lines.length - 1] += ' ' + t; // an indented line continues the point above
    else if (t) { if (last().kind !== 'p') parts.push({ kind: 'p', lines: [] }); last().lines.push(t); }
    else if (last().lines.length) parts.push({ kind: 'p', lines: [] });
  }
  let html = parts.filter((x) => x.lines.length).map((x) => (x.kind === 'ul'
    ? `<ul>${x.lines.map((l) => `<li>${inline(l, ctx)}</li>`).join('')}</ul>`
    : `<p>${inline(x.lines.join(' '), ctx)}</p>`)).join('');
  const plain = PLAIN_LABEL.test(html);
  if (plain) html = html.replace(PLAIN_LABEL, '<p>');
  return { html: `<blockquote${plain ? ' class="plain"' : ''}>${html}</blockquote>`, next: i, kind: plain ? 'plain' : 'other' };
}

function table(lines, i, ctx) {
  const head = splitRow(lines[i]);
  const rows = [];
  for (i += 2; i < lines.length && lines[i].startsWith('|'); i++) rows.push(splitRow(lines[i]));
  const cells = (r, tag) => r.map((c) => `<${tag}>${inline(c, ctx)}</${tag}>`).join('');
  return { html: `<div class="table"><table><thead><tr>${cells(head, 'th')}</tr></thead><tbody>${rows.map((r) => `<tr>${cells(r, 'td')}</tr>`).join('')}</tbody></table></div>`, next: i };
}

// One level of list. An indented line continues the item above it; an indented bullet (a nested list) is not supported.
function list(lines, i, ctx) {
  const ordered = /\d/.test(LIST_ITEM.exec(lines[i])[2]);
  const items = [];
  for (; i < lines.length; i++) {
    const m = LIST_ITEM.exec(lines[i]);
    if (m && m[1]) throw new Error(`${ctx.slug}: nested lists are not supported (line ${i + 1}: ${lines[i].trim()})`);
    if (m && /\d/.test(m[2]) === ordered) items.push(m[3]);
    else if (!m && items.length && /^\s{2,}\S/.test(lines[i])) items[items.length - 1] += ' ' + lines[i].trim();
    else break;
  }
  const kept = ctx.section === 'Related pages' ? items.filter((item) => !deadRelated(item, ctx)) : items;
  const tag = ordered ? 'ol' : 'ul';
  return { html: kept.length ? `<${tag}>${kept.map((x) => `<li>${inline(x, ctx)}</li>`).join('')}</${tag}>` : '', next: i };
}

// In "Related pages", an item whose first link points to an unwritten page is left out (not shown as a dead end).
function deadRelated(item, ctx) {
  const first = /\[[^\]]+\]\(([a-z0-9-]+)\.md\)/.exec(item);
  if (!first || ctx.pages.has(first[1])) return false;
  ctx.missing.add(first[1]);
  return true;
}

function paragraph(lines, i, ctx) {
  const para = [];
  for (; i < lines.length && lines[i].trim() && !BLOCK_START.test(lines[i]); i++) para.push(lines[i].trim());
  if (!para.length) throw new Error(`${ctx.slug}: cannot parse line ${i + 1}: ${lines[i]}`);
  return { html: `<p>${inline(para.join(' '), ctx)}</p>`, next: i };
}

function readerFor(lines, i) {
  const line = lines[i];
  if (line.startsWith('```')) return fence;
  if (/^#{1,6}\s/.test(line)) return heading;
  if (/^#{7,}\s/.test(line)) throw new Error(`unsupported heading level: ${line}`);
  if (line.startsWith('>')) return quote;
  if (line.startsWith('|') && /^\|?\s*:?-{3,}/.test(lines[i + 1] || '')) return table;
  if (LIST_ITEM.test(line)) return list;
  return paragraph;
}

// Block Markdown. Returns { html, h1, blocks }. Each block is { kind: 'heading' | 'plain' | 'other', place, html },
// where place is a ##/### heading's text; learn-visuals.mjs placeFigures() uses the blocks to put pictures in.
export function markdown(body, ctx) {
  ctx.ids = new Set(); ctx.section = ''; ctx.h1 = '';
  const lines = body.split('\n');
  const blocks = [];
  for (let i = 0; i < lines.length;) {
    if (!lines[i].trim()) { i++; continue; }
    const reader = readerFor(lines, i);
    const { html, next, kind } = reader(lines, i, ctx);
    i = next;
    if (!html) continue;
    if (reader === heading) blocks.push({ kind: 'heading', place: ctx.lastHeading, html });
    else blocks.push({ kind: kind || 'other', html });
  }
  return { html: blocks.map((b) => b.html).join('\n'), h1: ctx.h1, blocks };
}

// ---------- page shell ----------

// The next existing page on each reading path that holds this page.
export function nextSteps(slug, pages, paths = readingPaths(loadTracks(SRC))) {
  const res = [];
  for (const p of Object.values(paths)) {
    const at = p.steps.indexOf(slug);
    if (at < 0) continue;
    const next = p.steps.slice(at + 1).find((s) => pages.has(s));
    if (next) res.push({ path: p.name, slug: next, title: pages.get(next).h1Text });
  }
  return res;
}

// "On this page": the page's ## headings, for pages long enough to need it (3 or more).
export function pageToc(html) {
  const items = [...html.matchAll(/<h2 id="([^"]+)">([\s\S]*?)<\/h2>/g)].map((m) => ({ id: m[1], text: stripTags(m[2]) }));
  return items.length >= 3 ? items : [];
}

const stripTags = (s) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');

const pageUrl = (id) => `${SITE}/learn/${id === 'index' ? '' : id + '/'}`;

// Search-engine data (JSON-LD): an Article and its breadcrumb trail. It is data, not a script, so the CSP allows it.
export function jsonLd(slug, page) {
  const { meta } = page, url = pageUrl(slug);
  const crumbs = [{ name: 'Debate Library', url: pageUrl('index') }];
  if (slug.startsWith('tracks/')) crumbs.push({ name: 'Guided tracks', url: pageUrl('tracks') });
  if (slug !== 'index') crumbs.push({ name: page.h1Text, url });
  return [
    { '@context': 'https://schema.org', '@type': 'Article', headline: meta.title, description: meta.description, dateModified: meta.updated, inLanguage: 'en', url,
      author: { '@type': 'Organization', name: 'Pattern Engine LLC' }, publisher: { '@type': 'Organization', name: 'Pattern Engine LLC' }, license: 'https://creativecommons.org/licenses/by-sa/4.0/' },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbs.map((c, n) => ({ '@type': 'ListItem', position: n + 1, name: c.name, item: c.url })) },
  ];
}

// The site's top bar. Brand and nav go to tabuladebate.com; "Open the app" goes to the app's web address, and
// library.js turns it into "Back to the app" (the site root) when the Library is opened from inside the app.
function siteHeader(slug, up, lib) {
  const nav = SITE_NAV.map(([label, href]) => `<a href="${href || lib}"${href ? '' : ` class="here"${slug === 'index' ? ' aria-current="page"' : ''}`}>${label}</a>`).join('');
  const appLink = (cls) => `<a class="${cls}" href="${APP}" data-app="${up}" data-back-label="Back to the app">Open the app</a>`;
  return `<header class="site"><div class="wrap site-in">
  <a class="brand" href="${SITE}/" aria-label="Tabula Debate home"><img class="on-light" src="${up}assets/tabula-mark-black.png" alt="" width="36" height="29"><img class="on-dark" src="${up}assets/tabula-mark-white.png" alt="" width="36" height="29"><span><span class="wordmark">Tabula</span> <span class="product">Debate</span></span></a>
  <nav class="site-nav" aria-label="Main">${nav}</nav>
  <div class="site-end">
    <a class="signin" href="${FAMILY}/signin/">Sign in</a>
    ${appLink('btn primary')}
    <details class="menu"><summary aria-label="Menu">${MENU_ICON}</summary><div class="menu-panel">${nav}<a href="${FAMILY}/signin/">Sign in</a></div></details>
  </div>
</div></header>`;
}

function siteFooter(lib) {
  return `<footer class="site-foot"><div class="wrap">
  <nav class="foot-nav" aria-label="Tabula sites"><a href="${SITE}/">Tabula Debate</a><a href="${lib}">Library</a><a href="${SITE}/coaches/">Coaches</a><a href="${SITE}/school-it/">School IT</a><a href="${FAMILY}/plans/">Plans</a><a href="${FAMILY}/trust/">Your data</a><a href="${FAMILY}/about/">About</a></nav>
  <p>All evidence cards and authors in examples are invented for teaching.</p>
  <p>From the <a href="${lib}">Tabula Debate Library</a>. Text licensed under <a href="https://creativecommons.org/licenses/by-sa/4.0/" rel="noopener">CC BY-SA 4.0</a>. © 2026 Pattern Engine LLC.</p>
  <p>Found a mistake? <a href="https://github.com/ConnorBritain/tabula/issues" rel="noopener">Open an issue</a>.</p>
</div></footer>`;
}

// The meta line goes under the H1. The phone "On this page" list goes under the summary, and under its banner
// picture when there is one (the banner stays right after the summary: STYLE.md §6), so the summary comes first.
export function placeLead(html, metaLine, tocMobile) {
  const withMeta = metaLine ? html.replace('</h1>', `</h1>\n${metaLine}`) : html;
  if (!tocMobile) return withMeta;
  const lead = /<blockquote class="plain">[\s\S]*?<\/blockquote>(\n<figure class="lib-figure lib-figure--hero"[\s\S]*?<\/figure>)?/;
  if (lead.test(withMeta)) return withMeta.replace(lead, (m) => `${m}\n${tocMobile}`);
  return withMeta.replace('</h1>', `</h1>\n${tocMobile}`);
}

// "7 min read · Beginner". The section name is in the breadcrumb, so it is not repeated here.
export function metaText(meta) {
  const level = meta.level ? meta.level[0].toUpperCase() + meta.level.slice(1) : '';
  return [meta.reading_time ? `${meta.reading_time} min read` : '', level].filter(Boolean).map(esc).join(' · ');
}

function shell(slug, page, pages, paths) {
  const { meta } = page;
  const up = '../'.repeat(segments(slug).length + 1); // from the page to the site root
  const lib = relHref(slug, 'index');
  const asset = (f) => (lib === './' ? f : lib + f); // a file in learn/ itself
  const url = pageUrl(slug);
  const ld = jsonLd(slug, page);
  const next = nextSteps(slug, pages, paths);
  const nextBox = next.length ? `<nav class="paths" aria-label="Reading paths"><h2>Next on your path</h2><ul>${next.map((n) => `<li>${esc(n.path)}: <a href="${relHref(slug, n.slug)}">${esc(n.title)}</a></li>`).join('')}</ul></nav>` : '';
  // Article pages get "On this page"; the home page and the track pages are lists already.
  const article = slug !== 'index' && !slug.startsWith('tracks');
  const toc = article ? pageToc(page.html) : [];
  const tocLinks = toc.map((t) => `<li><a href="#${t.id}">${esc(t.text)}</a></li>`).join('');
  const meta2 = slug === 'index' ? '' : metaText(meta);
  const body = placeLead(page.html, meta2 ? `<p class="meta">${meta2}</p>` : '', toc.length ? `<details class="toc-m"><summary>On this page</summary><ul>${tocLinks}</ul></details>` : '');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(meta.title)}</title>
<meta name="description" content="${esc(meta.description)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(meta.title)}">
<meta property="og:description" content="${esc(meta.description)}">
<meta property="og:url" content="${url}">${page.ogImage ? `\n<meta property="og:image" content="${page.ogImage}">` : ''}
<link rel="icon" type="image/png" href="${up}assets/tabula-icon-64.png">
<link rel="preload" href="${up}assets/fonts/InterTight-latin.woff2" as="font" type="font/woff2" crossorigin>
<script src="${up}assets/theme-boot.js"></script>
<link rel="stylesheet" href="${up}assets/tokens.css">
<link rel="stylesheet" href="${asset('learn.css')}">${page.script ? `\n<script src="${asset('check.js')}" defer></script>` : ''}${page.noindex ? '\n<meta name="robots" content="noindex">' : ''}
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
</head>
<body>
<a class="skip" href="#main">Skip to the page</a>
${siteHeader(slug, up, lib)}
<div class="wrap page${toc.length ? ' has-toc' : ''}">
<div class="page-main"${meta.reading_time ? ` data-minutes="${Number(meta.reading_time)}"` : ''}>
${slug === 'index' ? '' : `<nav class="crumbs" aria-label="Breadcrumb"><a href="${lib}">Library</a> › ${slug.startsWith('tracks/') ? `<a href="${relHref(slug, 'tracks')}">Guided tracks</a> › ` : ''}<span>${esc(meta.section || '')}</span></nav>`}
<main id="main">
${body}
</main>
${nextBox}
<aside class="cta"><p><strong>Flow your next round in Tabula, free.</strong> A timer, a flow and a ballot helper for policy debate judges. It runs in your browser and keeps your notes on your computer.</p><a class="btn" href="${APP}" data-app="${up}" data-back-label="Back to the app">Open the app</a></aside>
</div>
${toc.length ? `<nav class="toc" aria-label="On this page"><p class="toc-title">On this page</p><ul>${tocLinks}</ul></nav>` : ''}
</div>
${siteFooter(lib)}
<script src="${asset('library.js')}"></script>
</body>
</html>
`;
}

// ---------- build ----------

const MD = { esc, inline, fenceHtml };
const outPath = (id) => (id === 'index' ? 'index.html' : `${id}/index.html`);

// Returns Map(relative output path -> file text), plus the list of unwritten pages that were linked.
export function buildSite(dir = SRC) {
  const raw = loadPages(dir);
  if (!raw.has('index')) throw new Error('docs/library/index.md (the library home) is missing');
  const missing = new Set();
  const approved = loadApproved(dir); // pictures (docs/library/visuals/), approved slots only
  for (const page of approved.keys()) if (!raw.has(page)) throw new Error(`an approved picture points at "${page}", which is not a library page`);
  for (const [slug, p] of raw) {
    const r = markdown(p.body, { slug, pages: raw, missing });
    const pics = approved.get(slug) || [];
    const root = '../'.repeat(segments(slug).length); // from this page to learn/
    p.html = pics.length ? placeFigures(r.blocks, pics.map((s) => ({ place: s.after_heading, float: Boolean(FORMATS[s.format].float), html: figureHtml(s, root + s.out, esc) })), slug) : r.html;
    const share = shareImage(pics);
    if (share) p.ogImage = `${SITE}/learn/${share.out}`; // read by shell()
    p.h1Text = stripTags(r.h1);
    if (!p.h1Text) throw new Error(`${slug}: needs one "# " heading`);
  }
  // Checks go at the foot of their page (TRACKS.md §3.4). Tracks get their own pages under learn/tracks/.
  const checks = loadChecks(dir, raw);
  for (const [slug, c] of checks) {
    const p = raw.get(slug);
    p.html += '\n' + renderCheck(c, { slug, pages: raw, missing }, MD);
    p.script = true;
  }
  const tracks = loadTracks(dir);
  const states = new Map(tracks.map((t) => [t.id, trackState(t, raw, checks)]));
  const extra = buildTrackPages(tracks, states, raw, { relHref, latest: (slugs) => latest(raw, slugs) }, MD);
  if (tracks.length) raw.get('index').html += '\n' + renderHomeTracks(tracks, states, (id) => relHref('index', id), MD);
  const all = new Map([...raw, ...extra]);
  const files = new Map();
  const paths = readingPaths(tracks);
  for (const [id, p] of all) files.set(outPath(id), shell(id, p, raw, paths));
  files.set('learn.css', readFileSync(join(SRC, 'learn.css'), 'utf8'));
  files.set('library.js', readFileSync(join(SRC, 'library.js'), 'utf8'));
  if ([...all.values()].some((p) => p.script)) files.set('check.js', readFileSync(join(ROOT, 'check.js'), 'utf8'));
  for (const list of approved.values()) for (const s of list) files.set(s.out, readFileSync(s.src)); // binary: a Buffer
  const listed = [...all].filter(([, p]) => !p.noindex); // draft pages stay out of search (the shell adds noindex)
  files.set('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${listed.map(([s, p]) => `  <url><loc>${pageUrl(s)}</loc><lastmod>${p.meta.updated}</lastmod></url>`).join('\n')}\n</urlset>\n`);
  return { files, missing: [...missing].sort(), states };
}

// The newest "updated" date among some pages (all pages by default), for a track page's date.
function latest(pages, slugs) {
  slugs = slugs || [...pages.keys()];
  return slugs.map((s) => pages.get(s).meta.updated).sort().pop();
}

// files: Map(path in learn/ -> string, or a Buffer for a binary image).
export function writeSite(files, out = OUT) {
  if (existsSync(out)) rmSync(out, { recursive: true });
  for (const [rel, text] of files) {
    mkdirSync(dirname(join(out, rel)), { recursive: true });
    writeFileSync(join(out, rel), text);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { files, missing, states } = buildSite();
  writeSite(files);
  const pages = [...files.keys()].filter((f) => f.endsWith('.html')).length;
  console.log(`Built ${pages} pages into learn/.`);
  for (const [id, st] of states) console.log(`Track "${id}": ${st.live ? 'live' : st.ready ? 'built as a draft (checks not reviewed yet)' : 'not built (a step has no page or no check)'}.`);
  if (missing.length) console.log(`${missing.length} linked pages are not written yet, so those links are plain text: ${missing.join(', ')}`);
}
