// Term guard: fails when a word from a private term list shows up in a public, tracked file,
// in a commit message, or in a branch name. The list itself never lives in this repo.
//
// Where the list comes from, first match wins:
//   1. env TABULA_LEAK_TERMS       path to a list file
//   2. env TABULA_LEAK_TERMS_TEXT  the list itself, one term per line (for a CI secret)
//   3. private/launch/leak-terms.txt under this checkout
//   4. the same path under the main checkout (found with git rev-parse --git-common-dir),
//      so the guard also works inside .claude/worktrees/*
// No list found: the guard prints a note and passes.
//
// List format: one term per line; blank lines and lines that start with # are ignored.
// A term matches case-insensitively when no letter, digit or _ touches either end of it.
// Term numbers in the output count terms only (comments and blank lines are skipped), from 1.
//
// Allow list: leak-allow.txt next to the list file (or env TABULA_LEAK_ALLOW_TEXT with a text list).
// Each line is path:term, for a public use the owner approved.
//
// When CI is set, or the list came from TABULA_LEAK_TERMS_TEXT, the output gives the term
// number only, never the term text, so a CI log cannot leak the list.
//
// CLI:
//   node scripts/term-guard.mjs                     scan tracked files
//   node scripts/term-guard.mjs --out <file>        also write every hit as file:line:term
//   (--out is refused in hidden/CI mode, so the term text never lands in a CI file)
// Git hooks live in scripts/term-guard-hooks.mjs; scripts/install-hooks.mjs installs them.
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const LIST_PATH = join('private', 'launch', 'leak-terms.txt');
const ALLOW_NAME = 'leak-allow.txt';

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });
}

export function repoRoot(cwd) {
  return git(cwd, ['rev-parse', '--show-toplevel']).trim();
}

export function parseList(text) {
  return text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
}

export function parseAllow(text) {
  const allow = new Set();
  for (const line of parseList(text)) {
    const i = line.indexOf(':');
    if (i > 0) allow.add(line.slice(0, i).trim() + '\0' + line.slice(i + 1).trim().toLowerCase());
  }
  return allow;
}

function readIf(path) {
  return path && existsSync(path) ? readFileSync(path, 'utf8') : null;
}

// Returns { terms, allow, source, hidden } or null when no list is found.
export function loadTerms({ root, env = process.env, log = console.log }) {
  let text = null, source = null, allowText = null, fromSecret = false;
  if (env.TABULA_LEAK_TERMS) {
    text = readIf(env.TABULA_LEAK_TERMS);
    if (text != null) { source = env.TABULA_LEAK_TERMS; allowText = readIf(join(dirname(env.TABULA_LEAK_TERMS), ALLOW_NAME)); }
    else log(`leak guard: TABULA_LEAK_TERMS file not found (${env.TABULA_LEAK_TERMS}); trying the next source`);
  }
  if (text == null && env.TABULA_LEAK_TERMS_TEXT) {
    text = env.TABULA_LEAK_TERMS_TEXT; source = 'env TABULA_LEAK_TERMS_TEXT'; fromSecret = true;
  }
  if (text == null) {
    const candidates = [join(root, LIST_PATH)];
    try {
      let common = git(root, ['rev-parse', '--git-common-dir']).trim();
      if (!isAbsolute(common)) common = resolve(root, common);
      candidates.push(join(dirname(common), LIST_PATH));
    } catch { /* not a git checkout: only the local path counts */ }
    for (const p of candidates) {
      text = readIf(p);
      if (text != null) { source = p; allowText = readIf(join(dirname(p), ALLOW_NAME)); break; }
    }
  }
  if (text == null) return null;
  if (env.TABULA_LEAK_ALLOW_TEXT) allowText = (allowText ? allowText + '\n' : '') + env.TABULA_LEAK_ALLOW_TEXT;
  const terms = parseList(text);
  return { terms, allow: parseAllow(allowText || ''), source, hidden: fromSecret || Boolean(env.CI) };
}

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

export function compile(terms) {
  return terms.map((term, i) => ({
    index: i + 1,
    term,
    lower: term.toLowerCase(),
    re: new RegExp(`(?<![A-Za-z0-9_])${escapeRe(term)}(?:e?s)?(?![A-Za-z0-9_])`, 'i'),
  }));
}

// Every hit of every term in one text. line is 1-based.
export function findInText(text, compiled) {
  const hits = [];
  const lines = text.split('\n');
  for (let n = 0; n < lines.length; n++) {
    const lower = lines[n].toLowerCase();
    for (const c of compiled) {
      if (lower.includes(c.lower) && c.re.test(lines[n])) hits.push({ line: n + 1, index: c.index, term: c.term });
    }
  }
  return hits;
}

function isBinary(buf) {
  return buf.subarray(0, 8000).includes(0);
}

// Scans every tracked file (git ls-files): its path (reported as line 0) and its text.
export function scanTracked({ root, terms, allow }) {
  const compiled = compile(terms);
  const files = git(root, ['ls-files', '-z']).split('\0').filter(Boolean);
  const hits = [];
  const allowed = (file, h) => allow.has(file + '\0' + h.term.toLowerCase());
  for (const file of files) {
    for (const h of findInText(file, compiled)) if (!allowed(file, h)) hits.push({ file, line: 0, index: h.index, term: h.term });
    const path = join(root, file);
    if (!existsSync(path)) continue; // deleted in the work tree, not yet committed
    let buf;
    try { buf = readFileSync(path); } catch { continue; } // a directory (submodule) or unreadable link
    if (isBinary(buf)) continue;
    for (const h of findInText(buf.toString('utf8'), compiled)) if (!allowed(file, h)) hits.push({ file, ...h });
  }
  return hits;
}

export function formatHit(hit, hidden) {
  const where = hit.line === 0 ? `${hit.file}:0 (file name)` : `${hit.file}:${hit.line}`;
  return hidden ? `${where}: private term #${hit.index}` : `${where}: private term #${hit.index} "${hit.term}"`;
}

// Checks one short text (a commit message or a branch name). Returns hits with file set to label.
export function checkText(label, text, list) {
  return findInText(text, compile(list.terms)).map((h) => ({ file: label, ...h }));
}

// The check-publish entry point. Returns the number of problems found (0 when skipped).
export function runGuard({ cwd, env = process.env, log = console.log, out = null }) {
  const root = repoRoot(cwd);
  const list = loadTerms({ root, env, log });
  if (!list) { log('leak guard skipped: no term list (set TABULA_LEAK_TERMS or add private/launch/leak-terms.txt)'); return 0; }
  const hits = scanTracked({ root, terms: list.terms, allow: list.allow });
  for (const h of hits) log(formatHit(h, list.hidden));
  if (out && list.hidden) log('leak guard: --out ignored in CI mode (it would write the term text)');
  else if (out) writeFileSync(out, hits.map((h) => `${h.file}:${h.line}:${h.term}`).join('\n') + (hits.length ? '\n' : ''));
  log(hits.length
    ? `leak guard: ${hits.length} private term hit(s) in tracked files. Move the text to private/, or add an owner-approved path:term line to ${ALLOW_NAME}.`
    : `leak guard: no private terms in ${list.terms.length ? 'tracked files' : 'tracked files (the list is empty)'}.`);
  return hits.length;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const o = process.argv.indexOf('--out');
  const out = o >= 0 ? resolve(process.argv[o + 1]) : null;
  process.exit(runGuard({ cwd: dirname(fileURLToPath(import.meta.url)), out }) ? 1 : 0);
}
