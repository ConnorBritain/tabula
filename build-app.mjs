// App builder for debate.tabulaspeech.com (docs/architecture/MARKETING-SITE.md §6.1).
// Copies an ALLOWLIST of the app's public files into dist/app/. A new file in the repo
// root (a plan, a test, private notes) never ships unless someone adds it here.
// Then it checks that every local file index.html and about.html link to is in the output.
// It also writes version.json ({ sha, builtAt }) so anyone can see which commit is live.
// Run: node build-app.mjs [outDir]
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));

// Files and folders the app page needs, plus the public pages it links to.
export const ALLOW = [
  '_headers', 'index.html', 'about.html',
  'app.js', 'logic.js', 'providers.js', 'keys.js', 'clipqueue.js', 'tap.js', 'tour.js', 'ui.js',
  'js', 'logic', 'formats', 'core', 'demo', 'assets', 'vendor', 'learn',
];

// Never ship these, even inside an allowed folder.
// core/package.json only tells Node that core/ holds ES modules; the page does not need it.
const BLOCK = [/\.test\.(m?js)$/, /(^|\/)README\.md$/, /\.local\./, /(^|\/)\./, /^core\/package\.json$/];

/**
 * What version.json says: { sha, builtAt }. Other Tabula services use the same field
 * names, so one deploy check can read them all.
 * BUILD_SHA and BUILD_TIME override; else `git rev-parse HEAD` and the clock; else "dev".
 * It never throws: a missing git must not stop a deploy.
 */
export function versionInfo(env = process.env, now = new Date()) {
  let sha = (env.BUILD_SHA || '').trim();
  if (!sha) {
    try {
      sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    } catch { sha = ''; }
  }
  const builtAt = (env.BUILD_TIME || '').trim() || now.toISOString();
  return { sha: sha || 'dev', builtAt };
}

export function build(out = join(ROOT, 'dist', 'app'), allow = ALLOW, env = process.env) {
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
  writeFileSync(join(out, 'version.json'), JSON.stringify(versionInfo(env)) + '\n');
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
