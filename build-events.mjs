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
// Run: node build-events.mjs [outDir]
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = dirname(fileURLToPath(import.meta.url));

// Repo paths (files or folders) the events page needs. Each lands at outPath(path).
export const ALLOW = [
  'events/_headers', 'events/index.html', 'events/app.css', 'events/sw.js', 'events/sw-files.js', 'events/published.json',
  'events/js', 'events/congress', 'events/defs', 'events/profiles', 'events/prompts',
  'core',
  'assets/theme-boot.js', 'assets/fonts',
];

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

export function build(out = join(ROOT, 'dist', 'events'), allow = ALLOW) {
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  for (const name of allow) {
    const src = join(ROOT, name);
    if (!existsSync(src)) throw new Error(`build-events: allowed file is missing: ${name}`);
    cpSync(src, join(out, outPath(name)), {
      recursive: true,
      filter: (p) => !BLOCK.some((re) => re.test(posix(relative(ROOT, p)))),
    });
  }
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

/** Every output path the page links to or the worker caches that the output does not have. */
export function missingRefs(out) {
  const need = [
    ...pageRefs(readFileSync(join(out, 'index.html'), 'utf8')),
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
