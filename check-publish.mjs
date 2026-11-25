// Pre-publish gate (PLAN step 11): fails while public pages still hold placeholders.
// Run with: node check-publish.mjs   (expected to fail until Connor fills in his details)
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runGuard } from './scripts/term-guard.mjs';

// The Debate Library pages built into learn/ by build-learn.mjs are public pages too.
const learnDir = new URL('learn/', import.meta.url);
if (!existsSync(learnDir)) { console.log('learn/ is missing. Run: node build-learn.mjs'); process.exit(1); }
const learnPages = readdirSync(learnDir, { recursive: true }).filter((f) => f.endsWith('.html')).map((f) => 'learn/' + f);
const PAGES = ['about.html', ...learnPages];
let bad = 0;
for (const page of PAGES) {
  readFileSync(new URL(page, import.meta.url), 'utf8').split('\n').forEach((line, i) => {
    if (/class="[^"]*\btodo\b|TODO:|href="#"|aria-disabled="true"/.test(line)) { bad++; console.log(`${page}:${i + 1}: ${line.trim()}`); }
  });
}
// The security rule must not ship while the app still loads scripts from other sites (step A3).
const headers = readFileSync(new URL('_headers', import.meta.url), 'utf8');
if (/DO NOT DEPLOY/.test(headers)) { bad++; console.log('_headers: still marked DO NOT DEPLOY (finish step A3: self-host the remote libraries)'); }
// The page code is split into js/*.js plus app.js (the module split before Slice 5), so every part is checked.
const appParts = readdirSync(new URL('js/', import.meta.url)).filter((f) => f.endsWith('.js')).map((f) => 'js/' + f);
for (const f of ['index.html', 'app.js', ...appParts, 'about.html', 'learn/check.js']) {
  for (const m of readFileSync(new URL(f, import.meta.url), 'utf8').matchAll(/(?:\bsrc\s*=\s*|\.src\s*=\s*|import\(\s*)['"`](https?:\/\/[^'"`]+)/g)) { bad++; console.log(`${f}: loads a remote script: ${m[1]}`); }
}
// Private terms (a private list, never in this repo) must not appear in any tracked file.
bad += runGuard({ cwd: fileURLToPath(new URL('.', import.meta.url)) });
if (bad) { console.log(`\n${bad} problem(s) must be fixed before publishing.`); process.exit(1); }
console.log('All publish checks pass. Ready to publish.');
