// App builder for debate.tabulaspeech.com.
// Copies an ALLOWLIST of the app's public files into dist/app/. A new file in the repo
// root (a plan, a test, private notes) never ships unless someone adds it here.
// Then it checks that every local file index.html and about.html link to is in the output.
// It also writes version.json: the commit this build came from, so anyone can check which version is live.
// Run: node build-app.mjs [outDir] [--strict] [--mode=prod|staging|local]
// A deploy build (wrangler.app.jsonc) runs with --strict and its mode; see versionInfo.
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
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
 * The commit this repo is at. A tree with uncommitted changes gets "-dirty", because the
 * build is then not exactly that commit. No git (a copy of the files) reads "unknown".
 */
function gitSha(dir = ROOT) {
  const git = (...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  try { return git('rev-parse', 'HEAD') + (git('status', '--porcelain') ? '-dirty' : ''); } catch { return 'unknown'; }
}

const SHA40 = /^[0-9a-f]{40}$/;
export const MODES = ['prod', 'staging', 'local'];

/**
 * What version.json says: { sha, builtAt, mode }, the same fields as the other Tabula hosts.
 *   sha:     BUILD_SHA if it is a full 40-hex commit id, else gitSha() (which may end "-dirty" or read "unknown").
 *   builtAt: BUILD_TIME if it is a date, else the clock.
 *   mode:    BUILD_MODE ("prod", "staging" or "local"), else "local".
 * Anything a deploy must not ship comes back in `warnings`: a sha that is not exactly one commit
 * ("-dirty", "unknown"), an unusable BUILD_SHA, BUILD_MODE or BUILD_TIME, and (strict only) no mode.
 * It never throws, so a normal build never fails for these. A strict build fails on any warning.
 */
export function versionInfo(env = process.env, now = new Date(), { strict = false, sha: gitValue } = {}) {
  const warnings = [];
  const given = (env.BUILD_SHA || '').trim().toLowerCase();
  if (given && !SHA40.test(given)) warnings.push(`BUILD_SHA "${given}" is not a 40-hex commit id; using git instead`);
  const sha = SHA40.test(given) ? given : (gitValue ?? gitSha());
  if (!SHA40.test(sha)) warnings.push(`version.json would say sha "${sha}", which is not exactly one commit (build from a clean git checkout, or set BUILD_SHA)`);
  let mode = (env.BUILD_MODE || '').trim();
  if (!mode) { if (strict) warnings.push('no mode (a deploy build must pass --mode=prod or --mode=staging)'); mode = 'local'; }
  if (!MODES.includes(mode)) { warnings.push(`mode "${mode}" is not one of ${MODES.join(', ')}; using "local"`); mode = 'local'; }
  let builtAt = (env.BUILD_TIME || '').trim();
  if (builtAt && Number.isNaN(Date.parse(builtAt))) { warnings.push(`BUILD_TIME "${builtAt}" is not a date; using the clock`); builtAt = ''; }
  return { version: { sha, builtAt: builtAt || now.toISOString(), mode }, warnings };
}

export function build(out = join(ROOT, 'dist', 'app'), allow = ALLOW, env = process.env, { strict = false } = {}) {
  const { version, warnings } = versionInfo(env, new Date(), { strict });
  if (strict && warnings.length) throw new Error('build-app --strict: ' + warnings.join('; '));
  for (const w of warnings) console.warn('build-app: warning: ' + w);
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
  // The deploy build names its mode (wrangler.app.jsonc: --mode=prod or --mode=staging). _headers caches it for a minute only.
  writeFileSync(join(out, 'version.json'), JSON.stringify(version) + '\n');
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
  const args = process.argv.slice(2);
  for (const a of args) if (a.startsWith('--') && a !== '--strict' && !a.startsWith('--mode=')) console.warn('build-app: warning: unknown option ' + a);
  const strict = args.includes('--strict') || process.env.BUILD_STRICT === '1';
  // --mode=prod is the same as BUILD_MODE=prod, and works in every shell.
  const modeArg = args.find((a) => a.startsWith('--mode='));
  const env = modeArg ? { ...process.env, BUILD_MODE: modeArg.slice('--mode='.length) } : process.env;
  let out;
  try { out = build(args.find((a) => !a.startsWith('--')), ALLOW, env, { strict }); }
  catch (err) { console.error(err.message); process.exit(1); }
  console.log(`build-app: ${listFiles(out).length} files in ${relative(ROOT, out) || out}`);
}
