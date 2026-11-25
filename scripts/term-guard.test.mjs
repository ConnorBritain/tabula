// Tests for the term guard (scripts/term-guard.mjs) and its hook installer.
// Every term here is a made-up word; the real list never enters this repo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { runGuard } from './term-guard.mjs';
import { runHook } from './term-guard-hooks.mjs';
import { installHooks, MARK } from './install-hooks.mjs';

const FAKE = 'quokka ledger';
const CLEAN_ENV = {}; // no CI, no TABULA_* variables

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}

function tempRepo(t, files = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'term-guard-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'user.email', 'test@example.invalid');
  git(dir, 'config', 'user.name', 'test');
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(join(dir, name, '..'), { recursive: true });
    writeFileSync(join(dir, name), text);
  }
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'start', '--allow-empty');
  return dir;
}

// The list sits in the untracked private/ folder, as it does in the real checkout.
function addList(dir, terms, allow) {
  mkdirSync(join(dir, 'private', 'launch'), { recursive: true });
  writeFileSync(join(dir, 'private', 'launch', 'leak-terms.txt'), '# test list\n' + terms.join('\n') + '\n');
  if (allow) writeFileSync(join(dir, 'private', 'launch', 'leak-allow.txt'), allow.join('\n') + '\n');
}

function capture() {
  const lines = [];
  return { log: (s) => lines.push(String(s)), text: () => lines.join('\n') };
}

test('a planted private term in a tracked file fails the guard with file:line', (t) => {
  // Why: this is the whole point of the guard; if it stops failing, stealth text ships in the public repo unnoticed.
  const dir = tempRepo(t, { 'notes/plan.md': 'line one\nOur Quokka Ledger rollout\n' });
  addList(dir, [FAKE]);
  const out = capture();
  const hits = runGuard({ cwd: dir, env: CLEAN_ENV, log: out.log });
  assert.equal(hits, 1);
  assert.match(out.text(), /notes\/plan\.md:2: private term #1/);
});

test('a term inside a longer word is not a hit, and untracked files are not scanned', (t) => {
  // Why: false hits on ordinary words (or on the git-ignored private/ folder) would make every gate red and teach people to ignore it.
  const dir = tempRepo(t, { 'a.md': 'the quokka ledgerbook and xquokka ledger\n' });
  addList(dir, [FAKE]);
  writeFileSync(join(dir, 'untracked.md'), 'quokka ledger\n');
  assert.equal(runGuard({ cwd: dir, env: CLEAN_ENV, log: () => {} }), 0);
});

test('a plural of a term (s or es) is a hit', (t) => {
  // Why: private docs use plural forms as often as singular ones; missing plurals let half the leaks through.
  const dir = tempRepo(t, { 'a.md': 'two quokka ledgers\n' });
  addList(dir, [FAKE]);
  assert.equal(runGuard({ cwd: dir, env: CLEAN_ENV, log: () => {} }), 1);
});

test('with no term list the guard skips with a clear note and passes', (t) => {
  // Why: CI and fresh clones have no private/ folder; a hard failure there would block every public PR.
  const dir = tempRepo(t, { 'a.md': 'quokka ledger\n' });
  const out = capture();
  assert.equal(runGuard({ cwd: dir, env: CLEAN_ENV, log: out.log }), 0);
  assert.match(out.text(), /leak guard skipped: no term list/);
});

test('an allow-list entry path:term lets one owner-approved public use pass', (t) => {
  // Why: some names are public on purpose; without the allow list the owner would have to drop the term and lose the guard everywhere else.
  const dir = tempRepo(t, { 'ok.md': 'quokka ledger\n', 'leak.md': 'quokka ledger\n' });
  addList(dir, [FAKE], ['ok.md:Quokka Ledger']);
  const out = capture();
  assert.equal(runGuard({ cwd: dir, env: CLEAN_ENV, log: out.log }), 1);
  assert.match(out.text(), /leak\.md:1/);
  assert.doesNotMatch(out.text(), /ok\.md/);
});

test('in CI mode the output names the term number, never the term text', (t) => {
  // Why: CI logs on a public repo are public; printing the term would publish the very list the guard protects.
  const dir = tempRepo(t, { 'a.md': 'hello\nquokka ledger here\n' });
  for (const env of [{ CI: 'true', TABULA_LEAK_TERMS_TEXT: 'other\n' + FAKE }, { TABULA_LEAK_TERMS_TEXT: FAKE }]) {
    const out = capture();
    assert.equal(runGuard({ cwd: dir, env, log: out.log }), 1);
    assert.match(out.text(), /a\.md:2: private term #\d/);
    assert.doesNotMatch(out.text(), /quokka/i);
  }
});

test('inside a linked worktree the guard finds the list in the main checkout', (t) => {
  // Why: most work happens in .claude/worktrees/*, which have no private/ folder; the guard must not silently skip there.
  const dir = tempRepo(t, { 'a.md': 'quokka ledger\n' });
  addList(dir, [FAKE]);
  const wt = join(dir, '.claude', 'worktrees', 'w1');
  git(dir, 'worktree', 'add', '-q', '--detach', wt);
  assert.equal(runGuard({ cwd: wt, env: CLEAN_ENV, log: () => {} }), 1);
});

test('the commit-msg hook blocks a message or branch name that holds a term', (t) => {
  // Why: branch names and commit messages are public on the public repo, and the file scan never sees them.
  const dir = tempRepo(t, { 'a.md': 'clean\n' });
  addList(dir, [FAKE]);
  writeFileSync(join(dir, 'MSG'), 'Add the quokka ledger screen\n# a comment line is ignored\n');
  assert.equal(runHook({ name: 'commit-msg', args: ['MSG'], cwd: dir, env: CLEAN_ENV, log: () => {} }), 1);
  writeFileSync(join(dir, 'MSG'), 'Neutral words\n');
  assert.equal(runHook({ name: 'commit-msg', args: ['MSG'], cwd: dir, env: CLEAN_ENV, log: () => {} }), 0);
  git(dir, 'checkout', '-q', '-b', 'claude/quokka-ledger');
  assert.equal(runHook({ name: 'commit-msg', args: ['MSG'], cwd: dir, env: CLEAN_ENV, log: () => {} }), 1);
});

test('the pre-push hook blocks a pushed commit whose message holds a term', (t) => {
  // Why: a message committed with --no-verify would otherwise reach the public remote unchecked.
  const dir = tempRepo(t, { 'a.md': 'clean\n' });
  addList(dir, [FAKE]);
  const base = git(dir, 'rev-parse', 'HEAD').trim();
  git(dir, 'commit', '-q', '--allow-empty', '-m', 'quokka ledger notes');
  const head = git(dir, 'rev-parse', 'HEAD').trim();
  const out = capture();
  const bad = runHook({ name: 'pre-push', cwd: dir, env: CLEAN_ENV, log: out.log, stdin: `refs/heads/main ${head} refs/heads/main ${base}\n` });
  assert.equal(bad, 1);
  assert.match(out.text(), /commit [0-9a-f]{12} message:1/);
});

test('the installer writes the three hooks and never replaces a hook it did not write', (t) => {
  // Why: overwriting someone's own hook silently drops their checks; a missing hook means the guard never runs locally.
  const dir = mkdtempSync(join(tmpdir(), 'term-hooks-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, 'pre-push'), '#!/bin/sh\necho mine\n');
  assert.equal(installHooks({ hooksDir: dir, log: () => {} }), 1);
  assert.equal(readFileSync(join(dir, 'pre-push'), 'utf8'), '#!/bin/sh\necho mine\n');
  for (const name of ['pre-commit', 'commit-msg']) {
    assert.ok(existsSync(join(dir, name)));
    const body = readFileSync(join(dir, name), 'utf8');
    assert.match(body, /scripts\/term-guard-hooks\.mjs/);
    assert.match(body, new RegExp(`"\\$guard" ${name} `));
  }
  assert.equal(installHooks({ hooksDir: dir, force: true, log: () => {} }), 0);
  assert.ok(readFileSync(join(dir, 'pre-push'), 'utf8').includes(MARK));
});

test('TABULA_LEAK_TERMS (a file path) wins over the private folder, and its leak-allow.txt is used', (t) => {
  // Why: a session or script that points the guard at a list must get that list, not a stale one found by accident.
  const dir = tempRepo(t, { 'a.md': 'quokka ledger\nwombat atlas\n' });
  addList(dir, ['wombat atlas']);
  const other = mkdtempSync(join(tmpdir(), 'term-list-'));
  t.after(() => rmSync(other, { recursive: true, force: true }));
  writeFileSync(join(other, 'leak-terms.txt'), FAKE + '\n');
  writeFileSync(join(other, 'leak-allow.txt'), 'a.md:' + FAKE + '\n');
  assert.equal(runGuard({ cwd: dir, env: { TABULA_LEAK_TERMS: join(other, 'leak-terms.txt') }, log: () => {} }), 0);
  writeFileSync(join(other, 'leak-allow.txt'), '');
  assert.equal(runGuard({ cwd: dir, env: { TABULA_LEAK_TERMS: join(other, 'leak-terms.txt') }, log: () => {} }), 1);
});

test('TABULA_LEAK_ALLOW_TEXT lets CI pass an owner-approved use when the list comes from a secret', (t) => {
  // Why: CI has only secrets, no leak-allow.txt; without this an approved public use would turn CI red for good.
  const dir = tempRepo(t, { 'ok.md': 'quokka ledger\n' });
  assert.equal(runGuard({ cwd: dir, env: { TABULA_LEAK_TERMS_TEXT: FAKE }, log: () => {} }), 1);
  assert.equal(runGuard({ cwd: dir, env: { TABULA_LEAK_TERMS_TEXT: FAKE, TABULA_LEAK_ALLOW_TEXT: 'ok.md:' + FAKE }, log: () => {} }), 0);
});

test('in CI mode --out writes no file, so the term text cannot reach a CI artifact', (t) => {
  // Why: a hit file holds raw terms; written in CI it could be uploaded or cached where the public can read it.
  const dir = tempRepo(t, { 'a.md': 'quokka ledger\n' });
  const out = join(dir, 'hits.txt');
  runGuard({ cwd: dir, env: { CI: 'true', TABULA_LEAK_TERMS_TEXT: FAKE }, log: () => {}, out });
  assert.equal(existsSync(out), false);
});

test('the pre-commit hook blocks a branch name that holds a term even when files are clean', (t) => {
  // Why: the branch name is the first public text a push creates; pre-commit is the earliest place to stop it.
  const dir = tempRepo(t, { 'a.md': 'clean\n' });
  addList(dir, [FAKE]);
  assert.equal(runHook({ name: 'pre-commit', cwd: dir, env: CLEAN_ENV, log: () => {} }), 0);
  git(dir, 'checkout', '-q', '-b', 'feature/quokka_ledger');
  assert.equal(runHook({ name: 'pre-commit', cwd: dir, env: CLEAN_ENV, log: () => {} }), 1);
});
