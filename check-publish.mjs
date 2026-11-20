// Pre-publish gate (PLAN step 11): fails while public pages still hold placeholders.
// Run with: node check-publish.mjs   (expected to fail until Connor fills in his details)
import { readFileSync } from 'node:fs';

const PAGES = ['about.html'];
let bad = 0;
for (const page of PAGES) {
  readFileSync(new URL(page, import.meta.url), 'utf8').split('\n').forEach((line, i) => {
    if (/class="[^"]*\btodo\b|TODO:|href="#"|aria-disabled="true"/.test(line)) { bad++; console.log(`${page}:${i + 1}: ${line.trim()}`); }
  });
}
// The security rule must not ship while the app still loads scripts from other sites (step A3).
const headers = readFileSync(new URL('_headers', import.meta.url), 'utf8');
if (/DO NOT DEPLOY/.test(headers)) { bad++; console.log('_headers: still marked DO NOT DEPLOY (finish step A3: self-host the remote libraries)'); }
for (const f of ['index.html', 'app.js', 'about.html']) {
  for (const m of readFileSync(new URL(f, import.meta.url), 'utf8').matchAll(/(?:\bsrc\s*=\s*|\.src\s*=\s*|import\(\s*)['"`](https?:\/\/[^'"`]+)/g)) { bad++; console.log(`${f}: loads a remote script: ${m[1]}`); }
}
if (bad) { console.log(`\n${bad} problem(s) must be fixed before publishing.`); process.exit(1); }
console.log('All publish checks pass. Ready to publish.');
