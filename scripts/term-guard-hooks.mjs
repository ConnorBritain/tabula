// Git hooks for the term guard (scripts/term-guard.mjs). Installed by scripts/install-hooks.mjs.
//   node scripts/term-guard-hooks.mjs pre-commit      scan tracked files + branch name
//   node scripts/term-guard-hooks.mjs commit-msg <f>  commit message + branch name
//   node scripts/term-guard-hooks.mjs pre-push        scan + pushed branch names + messages of pushed commits (refs on stdin)
// Branch names and commit messages are public on the public repo, and the file scan never sees them.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { repoRoot, loadTerms, checkText, formatHit, runGuard } from './term-guard.mjs';

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });
}

function currentBranch(root) {
  try { return git(root, ['symbolic-ref', '--quiet', '--short', 'HEAD']).trim(); } catch { return ''; }
}

// Branch names use - _ / where prose uses spaces, so a branch is checked as written and with those read as spaces.
export function checkBranch(name, list) {
  const spaced = name.replace(/[-_/]+/g, ' ');
  const hits = checkText('branch name', name, list);
  for (const h of checkText('branch name', spaced, list)) if (!hits.some((x) => x.index === h.index)) hits.push(h);
  return hits;
}

function reportText(hits, list, log) {
  for (const h of hits) log(formatHit(h, list.hidden));
  return hits.length;
}

// Git hooks. Returns the number of problems found.
export function runHook({ name, args = [], cwd, env = process.env, log = console.log, stdin = '' }) {
  const root = repoRoot(cwd);
  const list = loadTerms({ root, env, log });
  if (!list) { log('leak guard skipped: no term list'); return 0; }
  let bad = 0;
  if (name === 'pre-commit') {
    bad += runGuard({ cwd: root, env, log });
    bad += reportText(checkBranch(currentBranch(root), list), list, log);
  } else if (name === 'commit-msg') {
    const msg = readFileSync(resolve(root, args[0]), 'utf8').split('\n').filter((l) => !l.startsWith('#')).join('\n');
    bad += reportText(checkText('commit message', msg, list), list, log);
    bad += reportText(checkBranch(currentBranch(root), list), list, log);
  } else if (name === 'pre-push') {
    bad += runGuard({ cwd: root, env, log });
    const ZERO = /^0+$/;
    for (const line of stdin.split('\n').filter(Boolean)) {
      const [localRef, localSha, remoteRef, remoteSha] = line.split(/\s+/);
      if (!localSha || ZERO.test(localSha)) continue; // a branch delete pushes no new text
      for (const ref of [localRef, remoteRef]) bad += reportText(checkBranch(ref.replace(/^refs\/heads\//, ''), list), list, log);
      const range = ZERO.test(remoteSha || '0') ? [localSha, '--not', '--remotes'] : [`${remoteSha}..${localSha}`];
      let messages = '';
      try { messages = git(root, ['log', '--format=%H%n%B%x00', ...range]); } catch { /* unknown remote sha: skip messages */ }
      for (const entry of messages.split('\0').map((s) => s.trim()).filter(Boolean)) {
        const [sha, ...body] = entry.split('\n');
        bad += reportText(checkText(`commit ${sha.slice(0, 12)} message`, body.join('\n'), list), list, log);
      }
    }
  } else {
    log(`term guard: unknown hook ${name}`);
    return 1;
  }
  if (bad) log(`leak guard: ${name} blocked (${bad} hit(s)). Use neutral words.`);
  return bad;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [name, ...args] = process.argv.slice(2);
  const stdin = name === 'pre-push' ? readFileSync(0, 'utf8') : '';
  process.exit(runHook({ name, args, cwd: process.cwd(), stdin }) ? 1 : 0);
}
