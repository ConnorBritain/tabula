// Tests for how the app links to the Debate Library (docs/library/PLAN.md §8). Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { parseFrontMatter, isPageFile, SRC } from './build-learn.mjs';

const L = createRequire(import.meta.url)('./logic.js');

// Why: the flow's "Learn" button must open the page for the sheet the judge is on. A wrong map sends a judge reading about CPs to the K page.
test('each kind of sheet maps to its library page, and other sheets map to none', () => {
  const slug = (n) => (L.sheetPage(n) || {}).slug || null;
  assert.equal(slug('Case'), 'affirmative-case');
  assert.equal(slug('Adv 2'), 'affirmative-case');
  assert.equal(slug('T'), 'topicality');
  assert.equal(slug('Topicality - Substantial'), 'topicality');
  assert.equal(slug('DA 1'), 'disadvantages');
  assert.equal(slug('CP'), 'counterplans');
  assert.equal(slug('K'), 'kritiks');
  assert.equal(slug('FW'), 'framework');
  assert.equal(slug('Notes'), null);
  assert.equal(slug('Trade'), null, '"T" must not match the start of an ordinary word');
  assert.equal(slug('Case turns'), null, 'a neg sheet of case turns is not the aff case page');
  assert.equal(L.sheetPage('DA 1').topic, 'Disadvantages');
});

// Why: the map in logic.js and the "sheet:" lines in the library pages are two copies of one fact. If they drift, a button opens a missing or wrong page.
test('every library page that names a sheet is the page that sheet links to, and that page exists', () => {
  const named = {};
  for (const f of readdirSync(SRC).filter(isPageFile)) {
    const { meta } = parseFrontMatter(readFileSync(new URL(`docs/library/${f}`, import.meta.url), 'utf8'));
    if (meta && meta.sheet) named[meta.sheet] = meta.slug;
  }
  assert.deepEqual(named, Object.fromEntries(Object.entries(L.SHEET_PAGES).map(([k, v]) => [k, v.slug])));
  for (const { slug } of Object.values(L.SHEET_PAGES)) assert.ok(existsSync(new URL(`learn/${slug}/index.html`, import.meta.url)), `learn/${slug}/ is not built`);
});

// Why: new judges look for help under the ? button; if the library link is missing or points to the wrong place, they never find the guides.
// CHANGED 2026-11-19 at the owner's request ("it was better when everything was under the question mark"): the library
// moved from its own top-bar button into the ? menu. The old check was:
//   /<a class="iconbtn libbtn" id="library-btn" href="([^"]+)"...>i<\/a>\s*<div class="help-wrap">/ (a button right before ?)
test('the ? help menu has a Debate library link to the built library home', () => {
  const html = readFileSync(new URL('index.html', import.meta.url), 'utf8');
  const menu = html.slice(html.indexOf('id="help-menu"'), html.indexOf('</div>', html.indexOf('id="help-menu"')));
  const btn = /<a role="menuitem" id="library-link" href="([^"]+)"[^>]*>Debate library<\/a>/.exec(menu);
  assert.ok(btn, 'the library link must be inside the ? help menu');
  assert.equal(btn[1], 'learn/');
  assert.ok(existsSync(new URL('learn/index.html', import.meta.url)), 'learn/ is not built (run: node build-learn.mjs)');
});
