// App builder for debate.tabulaspeech.com (docs/architecture/MARKETING-SITE.md §6.1).
// Copies an ALLOWLIST of the app's public files into dist/app/. A new file in the repo
// root (a plan, a test, private notes) never ships unless someone adds it here.
// Then it checks that every local file index.html loads is in the output.
// Run: node build-app.mjs [outDir]
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));

// Files and folders the app page needs, plus the public pages it links to.
export const ALLOW = [
  '_headers', 'index.html', 'about.html',
  'app.js', 'logic.js', 'providers.js', 'keys.js', 'clipqueue.js', 'tap.js', 'tour.js', 'ui.js',
  'js', 'logic', 'assets', 'vendor', 'learn',
];

// Never ship these, even inside an allowed folder.
const BLOCK = [/\.test\.(m?js)$/, /(^|\/)README\.md$/, /\.local\./, /(^|\/)\./];

export function build(out = join(ROOT, 'dist', 'app')) {
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  for (const name of ALLOW) {
    const src = join(ROOT, name);
    if (!existsSync(src)) throw new Error(`build-app: allowed file is missing: ${name}`);
    cpSync(src, join(out, name), {
      recursive: true,
      filter: (p) => !BLOCK.some((re) => re.test(relative(ROOT, p).split('\\').join('/'))),
    });
  }
  const missing = missingRefs(out);
  if (missing.length) throw new Error(`build-app: index.html loads files that are not in the output: ${missing.join(', ')}`);
  return out;
}

/** Local src/href targets in index.html that the output does not have. */
export function missingRefs(out) {
  const html = readFileSync(join(out, 'index.html'), 'utf8');
  const refs = [...html.matchAll(/\b(?:src|href)="([^"#:?]+)"/g)].map((m) => m[1]);
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
