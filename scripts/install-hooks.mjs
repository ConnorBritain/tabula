// Installs git hooks that run the term guard (scripts/term-guard-hooks.mjs):
//   pre-commit  scans tracked files and checks the branch name
//   commit-msg  checks the commit message and the branch name
//   pre-push    scans tracked files, checks pushed branch names and pushed commit messages
// Run: node scripts/install-hooks.mjs [--hooks-dir <dir>] [--force]
// Without --hooks-dir it uses git's hooks folder (shared by every worktree of this repo).
// Each hook finds the guard in the tree it runs in, so an older branch without the guard just skips.
// It never replaces a hook it did not write unless --force is given.
import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MARK = '# installed by scripts/install-hooks.mjs (term guard)';
export const HOOKS = ['pre-commit', 'commit-msg', 'pre-push'];

export function hookBody(name) {
  return `#!/bin/sh
${MARK}
root=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
guard="$root/scripts/term-guard-hooks.mjs"
if [ ! -f "$guard" ]; then echo "term guard: not in this tree, skipped"; exit 0; fi
exec node "$guard" ${name} "$@"
`;
}

export function installHooks({ hooksDir, force = false, log = console.log }) {
  mkdirSync(hooksDir, { recursive: true });
  let refused = 0;
  for (const name of HOOKS) {
    const path = join(hooksDir, name);
    if (existsSync(path) && !readFileSync(path, 'utf8').includes(MARK) && !force) {
      log(`${path}: a hook is already there; left as is (use --force to replace it)`);
      refused++;
      continue;
    }
    writeFileSync(path, hookBody(name));
    chmodSync(path, 0o755);
    log(`${path}: installed`);
  }
  return refused;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const i = argv.indexOf('--hooks-dir');
  const here = dirname(fileURLToPath(import.meta.url));
  const hooksDir = i >= 0
    ? resolve(argv[i + 1])
    : resolve(here, execFileSync('git', ['rev-parse', '--git-path', 'hooks'], { cwd: here, encoding: 'utf8' }).trim());
  process.exit(installHooks({ hooksDir, force: argv.includes('--force') }) ? 1 : 0);
}
