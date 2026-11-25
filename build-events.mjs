// Speech Events builder for its own host (events.tabulaspeech.com; staging events.tabulaspeech.dev).
// Copies an ALLOWLIST of the files the events page needs into dist/events/. A new file (a draft, a test, a note)
// never ships unless someone adds it here. See wrangler.events.jsonc for the host and docs/events/DEPLOY.md.
//
// Layout: the page sits at the ROOT of its host, so events/index.html becomes /index.html (served at /).
// The page's ../core/ and ../assets/ links then resolve to /core/ and /assets/: a browser never goes above the
// root of a host, so "../core/ui.js" from "/" is "/core/ui.js". No source file is rewritten.
//   events/<x>  ->  /<x>          (the page, its js/, congress/, data, sw.js, sw-files.js, _headers)
//   core/<x>    ->  /core/<x>
//   assets/<x>  ->  /assets/<x>   (only theme-boot.js and the fonts)
// The service worker (sw.js, at /sw.js) names its files relative to itself, so its "../core/ui.js" is /core/ui.js too.
//
// After the copy it checks that every local file index.html links to, and every file in sw-files.js (what the
// service worker caches), is in the output. A missing cached file would make the worker's install fail for everyone.
// It also writes version.json, { sha, builtAt }, the same shape the debate build writes: the commit this build came
// from, so anyone (and Settings, About) can see which version is live. The service worker does not cache it.
// Run: node build-events.mjs [outDir]
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = dirname(fileURLToPath(import.meta.url));

// Repo paths (files or folders) the events page needs. Each lands at outPath(path).
export const ALLOW = [
  'events/_headers', 'events/index.html', 'events/app.css', 'events/sw.js', 'events/sw-files.js', 'events/published.json',
  'events/js', 'events/congress', 'events/defs', 'events/profiles', 'events/prompts',
  'events/comment-kit/kit.js', 'events/comment-kit/kit-view.js', 'events/comment-kit/kit-data.js', 'events/comment-kit/kit.css',
  'core',
  'assets/theme-boot.js', 'assets/fonts',
  'events/manifest.webmanifest', 'events/icons',
];

// Allowed paths that may not exist yet (the install manifest and its icons). They are copied when present. Whether
// they are needed is checked the same way as every other file: if the page links them, they must be in the output.
export const OPTIONAL = new Set(['events/manifest.webmanifest', 'events/icons']);

// Never ship these, even inside an allowed folder. Paths are repo paths with forward slashes.
// core/package.json only tells Node that core/ holds ES modules; the page does not need it.
// events/profiles/drafts/ holds league profiles that are not published yet; the page does not load them.
const BLOCK = [
  /\.test\.(m?js)$/, /(^|\/)README\.md$/, /\.local\./, /(^|\/)\./, /^core\/package\.json$/,
  /^events\/profiles\/drafts(\/|$)/, /^events\/(prototype|fixtures)(\/|$)/, /\.mjs$/,
];

/** Where a repo path lands in the output: events/ moves to the root, everything else keeps its path. */
export const outPath = (path) => (path.startsWith('events/') ? path.slice('events/'.length) : path);

const posix = (p) => p.split('\\').join('/');

/**
 * The commit this repo is at, "-dirty" when there are uncommitted changes, "unknown" with no git (a copy of the files).
 * The same rule as build-app.mjs; copied, not shared, so the debate build is not touched.
 */
export function gitSha(dir = ROOT) {
  const git = (...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  try { return git('rev-parse', 'HEAD') + (git('status', '--porcelain') ? '-dirty' : ''); } catch { return 'unknown'; }
}

export function build(out = join(ROOT, 'dist', 'events'), allow = ALLOW) {
  // core/ is shared with the debate app: ship only the core files the events page loads (the service worker list),
  // so a core file only the debate app uses never ships here.
  const coreUsed = new Set(swFiles(readFileSync(join(ROOT, 'events', 'sw-files.js'), 'utf8'))
    .map((p) => toOut(p, 'sw.js')).filter((p) => p.startsWith('core/')));
  const skip = (path) => BLOCK.some((re) => re.test(path)) || (/^core\/.+\.[a-z0-9]+$/i.test(path) && !coreUsed.has(path));
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  for (const name of allow) {
    const src = join(ROOT, name);
    if (!existsSync(src)) {
      if (OPTIONAL.has(name)) continue;
      throw new Error(`build-events: allowed file is missing: ${name}`);
    }
    cpSync(src, join(out, outPath(name)), {
      recursive: true,
      filter: (p) => !skip(posix(relative(ROOT, p))),
    });
  }
  // One build serves production and staging, so there is no mode field. _headers says no-cache for it.
  writeFileSync(join(out, 'version.json'), JSON.stringify({ sha: gitSha(), builtAt: new Date().toISOString() }) + '\n');
  const missing = missingRefs(out);
  if (missing.length) throw new Error(`build-events: the page or the service worker needs files that are not in the output: ${missing.join(', ')}`);
  return out;
}

// Resolve a reference the way a browser does on this host: relative to the file that holds it, never above the root.
const HOST = 'https://host.invalid/';
const toOut = (ref, from) => { const u = new URL(ref, new URL(from, HOST)); return decodeURIComponent(u.pathname).slice(1); };

/** The file list in a sw-files.js source (paths relative to sw.js), read the way the worker reads it. */
export function swFiles(source) {
  const self = {};
  vm.runInNewContext(source, { self });
  if (!Array.isArray(self.TABULA_EVENTS_FILES)) throw new Error('sw-files.js: no TABULA_EVENTS_FILES list');
  return Array.from(self.TABULA_EVENTS_FILES, String); // a plain array of this realm, not the sandbox's
}

/** Local src/href targets in index.html (resolved from /), as output paths. */
export function pageRefs(html) {
  const refs = [...html.matchAll(/<(?:script|link)\b[^>]*?\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]);
  return refs.filter((r) => !/^[a-z][a-z0-9+.-]*:|^\/\/|^#/i.test(r)).map((r) => toOut(r, 'index.html'));
}

/** The output paths of the web manifests index.html links (rel="manifest"). */
export function manifestLinks(html) {
  const tags = html.match(/<link\b[^>]*>/gi) || [];
  return tags.filter((t) => /\brel\s*=\s*["']manifest["']/i.test(t))
    .map((t) => (t.match(/\bhref\s*=\s*["']([^"']+)["']/i) || [])[1]).filter(Boolean).map((r) => toOut(r, 'index.html'));
}

/** The icon files a web manifest names, as output paths (each src is relative to the manifest). */
export function manifestIcons(json, manifestPath) {
  const m = JSON.parse(json);
  return (m.icons || []).map((i) => i && i.src).filter((r) => r && !/^[a-z][a-z0-9+.-]*:|^\/\//i.test(r)).map((r) => toOut(r, manifestPath));
}

/** Every output path the page links to, its manifest names, or the worker caches, that the output does not have. */
export function missingRefs(out) {
  const html = readFileSync(join(out, 'index.html'), 'utf8');
  const manifests = manifestLinks(html);
  const icons = manifests.filter((m) => existsSync(join(out, m))).flatMap((m) => manifestIcons(readFileSync(join(out, m), 'utf8'), m));
  const need = [
    ...pageRefs(html),
    ...icons,
    ...swFiles(readFileSync(join(out, 'sw-files.js'), 'utf8')).map((p) => toOut(p, 'sw.js')),
  ];
  return [...new Set(need)].filter((p) => { const f = join(out, p); return !(existsSync(f) && statSync(f).isFile()); });
}

/** Every file path in the output, relative and with forward slashes. */
export function listFiles(dir, base = dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? listFiles(p, base) : [posix(relative(base, p))];
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = build(process.argv[2]);
  console.log(`build-events: ${listFiles(out).length} files in ${relative(ROOT, out) || out}`);
}
