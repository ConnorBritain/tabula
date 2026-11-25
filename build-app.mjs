// App builder for debate.tabulaspeech.com (docs/architecture/MARKETING-SITE.md §6.1).
// Copies an ALLOWLIST of the app's public files into dist/app/. A new file in the repo
// root (a plan, a test, private notes) never ships unless someone adds it here.
// Then it checks that every local file index.html and about.html link to is in the output.
// It also writes version.json: the commit this build came from, so anyone can check which version is live.
// Run: node build-app.mjs [outDir]
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));

// Files and folders the app page needs, plus the public pages it links to.
export const ALLOW = [
  '_headers', 'index.html', 'about.html', 'sw.js', 'manifest.webmanifest',
  'app.js', 'logic.js', 'providers.js', 'keys.js', 'clipqueue.js', 'tap.js', 'tour.js', 'ui.js',
  'js', 'logic', 'formats', 'core', 'demo', 'assets', 'vendor', 'learn',
];

// Never ship these, even inside an allowed folder.
// core/package.json only tells Node that core/ holds ES modules; the page does not need it.
const BLOCK = [/\.test\.(m?js)$/, /(^|\/)README\.md$/, /\.local\./, /(^|\/)\./, /^core\/package\.json$/];

/**
 * The commit this repo is at. A tree with uncommitted changes gets "-dirty", because the
 * build is then not exactly that commit. No git (a copy of the files) reads "unknown".
 */
function gitSha(dir = ROOT) {
  const git = (...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  try { return git('rev-parse', 'HEAD') + (git('status', '--porcelain') ? '-dirty' : ''); } catch { return 'unknown'; }
}

export function build(out = join(ROOT, 'dist', 'app'), allow = ALLOW) {
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  for (const name of allow) {
    const src = join(ROOT, name);
    if (!existsSync(src)) throw new Error(`build-app: allowed file is missing: ${name}`);
    cpSync(src, join(out, name), {
      recursive: true,
      filter: (p) => !BLOCK.some((re) => re.test(relative(ROOT, p).split('\\').join('/'))),
    });
  }
  // The same build serves production and staging, so there is no mode field. _headers caches it for a minute only.
  writeFileSync(join(out, 'version.json'), JSON.stringify({ sha: gitSha(), builtAt: new Date().toISOString() }) + '\n');
  writeWorker(out);
  const missing = missingRefs(out);
  if (missing.length) throw new Error(`build-app: a shipped page links to files that are not in the output: ${missing.join(', ')}`);
  return out;
}

/**
 * Local src/href targets in index.html and about.html that the output does not
 * have. It does not follow JS imports or the learn/ pages (build-learn.mjs owns those).
 */
export function missingRefs(out) {
  const html = ['index.html', 'about.html'].map((f) => readFileSync(join(out, f), 'utf8')).join('\n');
  const refs = [...html.matchAll(/\b(?:src|href)=["']([^"'#:?]+)["']/g)].map((m) => m[1]);
  return refs.filter((r) => {
    const p = join(out, r);
    return !(existsSync(p) && (statSync(p).isFile() || existsSync(join(p, 'index.html'))));
  });
}

// Shipped files the service worker does not cache. learn/ is its own set of pages (build-learn.mjs).
// The AI SDK only runs with AI, which needs the network anyway. The diagram library (3 MB) draws the
// optional map view; judging a round does not need it, and offline the map says it needs the internet.
// sw.js, _headers and version.json are for the host and the browser, not the page.
export const NOT_CACHED = [/^learn\//, /^vendor\/mermaid-/, /^vendor\/anthropic-sdk-/, /^sw\.js$/, /^_headers$/, /^version\.json$/];

/** The files the service worker caches: every shipped file the app needs to open and judge a round. */
export function shellFiles(out) {
  return listFiles(out).filter((f) => !NOT_CACHED.some((re) => re.test(f))).sort();
}

/**
 * The cache release name: the sha from version.json plus a hash of the cached files. So each deploy gets a
 * new cache, and so does a build whose sha says "unknown" or "-dirty" when any cached file changed.
 */
export function releaseName(out, files, sha) {
  const h = createHash('sha256');
  for (const f of files) h.update(f + '\0').update(readFileSync(join(out, f))).update('\0');
  return (String(sha).replace(/[^0-9A-Za-z._-]/g, '') || 'unknown') + '-' + h.digest('hex').slice(0, 12);
}

/** Puts the release (named from the built version.json) and its file list at the top of the shipped sw.js. */
function writeWorker(out) {
  const { sha } = JSON.parse(readFileSync(join(out, 'version.json'), 'utf8'));
  const files = shellFiles(out);
  const head = 'self.TABULA_APP_RELEASE = ' + JSON.stringify(releaseName(out, files, sha)) + ';\n'
    + 'self.TABULA_APP_FILES = ' + JSON.stringify(files) + ';\n';
  writeFileSync(join(out, 'sw.js'), head + readFileSync(join(out, 'sw.js'), 'utf8'));
}

/** Every file path in the output, relative and with forward slashes. */
export function listFiles(dir, base = dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? listFiles(p, base) : [relative(base, p).split('\\').join('/')];
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = build(process.argv[2]);
  console.log(`build-app: ${listFiles(out).length} files in ${relative(ROOT, out) || out}`);
}
