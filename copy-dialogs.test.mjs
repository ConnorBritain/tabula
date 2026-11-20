// Static checks for Slice 2 (copy and dialogs). Spec: docs/design/SPEC.md §3.2, §4.5 and §6.1. Run with: node --test
// These tests read the source files as text. Two §6.1 checks belong to Slice 3 and are not here yet:
// "no title= in index.html except on <iframe> and SVG <title>" and "no font-size under 13 px" (LATER: Slice 3, V0/V11).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const read = (f) => readFileSync(new URL(f, import.meta.url), 'utf8');
const P = createRequire(import.meta.url)('./providers.js');
const JS_FILES = ['app.js', 'ui.js', 'tour.js', 'keys.js', 'logic.js', 'providers.js', 'clipqueue.js'];

// The string literals of a JS file (quotes and template text, not comments or code). A small scanner: it follows
// comments, strings, templates with ${...} and regex literals, which is enough for this repo's plain JS.
function jsStrings(src) {
  const out = [];
  let i = 0, buf = '';
  const stack = []; // template nesting: each entry is the brace depth where a ${ started
  let depth = 0, prev = '';
  const regexOk = () => !prev || /[(,=:[!&|?{};+\-*%<>~^]$/.test(prev) || /\b(return|typeof|case|in|of|delete|void|throw|new)$/.test(prev);
  while (i < src.length) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') { i = src.indexOf('*/', i + 2); i = i < 0 ? src.length : i + 2; continue; }
    if (c === '"' || c === "'") {
      buf = ''; i++;
      while (i < src.length && src[i] !== c) { if (src[i] === '\\') { buf += src[i + 1]; i += 2; continue; } buf += src[i++]; }
      out.push(buf); i++; prev = 'x'; continue;
    }
    if (c === '`' || (c === '}' && stack.length && stack[stack.length - 1] === depth)) {
      if (c === '}') stack.pop();
      buf = ''; i++;
      while (i < src.length) {
        if (src[i] === '\\') { buf += src[i + 1]; i += 2; continue; }
        if (src[i] === '`') { i++; break; }
        if (src[i] === '$' && src[i + 1] === '{') { stack.push(depth); i += 2; break; }
        buf += src[i++];
      }
      out.push(buf);
      prev = 'x'; continue;
    }
    if (c === '/' && regexOk()) {
      i++; let cls = false;
      while (i < src.length && (src[i] !== '/' || cls)) { if (src[i] === '\\') i++; else if (src[i] === '[') cls = true; else if (src[i] === ']') cls = false; i++; }
      i++; while (/[a-z]/i.test(src[i] || '')) i++;
      prev = 'x'; continue;
    }
    if (c === '{') depth++;
    if (c === '}') depth--;
    if (!/\s/.test(c)) { const m = /^[A-Za-z_$][\w$]*/.exec(src.slice(i)); if (m) { prev = m[0]; i += m[0].length; continue; } prev = c; }
    i++;
  }
  return out;
}
// The markup of an element with this id (from its start tag to its matching end tag), found by counting tags.
function elementById(html, id) {
  const start = html.indexOf(`id="${id}"`);
  if (start < 0) return '';
  const open = html.lastIndexOf('<', start);
  const tag = /^<([a-z0-9]+)/i.exec(html.slice(open))[1];
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi');
  re.lastIndex = open;
  let n = 0, m;
  while ((m = re.exec(html))) { n += m[1] ? -1 : 1; if (n === 0) return html.slice(open, re.lastIndex); }
  return html.slice(open);
}
// What a judge can read in index.html: no style, script or comments. Attribute values stay (aria-label, placeholder...).
const htmlText = (html) => html.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<!--[\s\S]*?-->/g, '');

// Why: a native confirm()/prompt()/alert() freezes the clock tab, cannot be styled or read well by screen readers, and skips the Undo path; one slipping back in breaks every dialog rule (spec 2.4).
test('no native confirm, prompt or alert in any JS file', () => {
  for (const f of JS_FILES) {
    const hits = read(f).split('\n').map((l, n) => [n + 1, l]).filter(([, l]) => /\b(window\.)?(confirm|prompt|alert)\s*\(/.test(l));
    assert.deepEqual(hits, [], f + ' still calls a native pop-up');
  }
});

// Why: a stale place name sends a judge looking for a tab that no longer exists ("AI + Keys", "the Log"), mid-round.
test('no stale place names remain in the app, the tour or the page', () => {
  const stale = ['AI + Keys', 'Setup tab', 'Analysis tab', 'Save to log', 'Saved to log', 'in the Log'];
  for (const f of ['app.js', 'tour.js', 'index.html']) {
    const src = read(f);
    for (const s of stale) assert.ok(!src.includes(s), `${f} still says "${s}"`);
  }
});

// Why: the old welcome pushed one vendor as "Recommended" and made a checkbox gate the free path; both went against Q11 and the no-favorites rule.
test('the welcome has no "I understand", no "Recommended." and no skip checkbox', () => {
  for (const f of ['app.js', 'index.html']) {
    const src = read(f);
    assert.ok(!src.includes('I understand'), f + ': "I understand"');
    assert.ok(!src.includes('Recommended.'), f + ': "Recommended."');
    assert.ok(!src.includes('skip-ack'), f + ': skip-ack');
  }
});

// Why: an error that blames one vendor by name is wrong for every judge on another provider; all AI errors come from aiErrorText (spec 2.3).
test('the old vendor error strings are gone', () => {
  const app = read('app.js');
  assert.ok(!app.includes('Claude declined'));
  assert.ok(!app.includes('Check the AI key in Settings'));
  assert.ok(!app.includes('function friendlyError'), 'friendlyError was replaced by the one classifier');
});

// Why: judges and the tour call saved ballots "Ballots" (Q12); a nav that still says "Library" clashes with the Debate library under ?.
test('PLACES says Ballots, not Library, and the nav landmark is "Main"', () => {
  const app = read('app.js');
  const places = /const PLACES = (\[[^\n]*\]);/.exec(app);
  assert.ok(places, 'PLACES is defined on one line');
  assert.match(places[1], /\['log', 'Ballots'\]/);
  assert.ok(!places[1].includes('Library'));
  assert.match(read('index.html'), /<nav id="nav" aria-label="Main">/);
  assert.ok(!app.includes("setAttribute('aria-label', 'Sections')"), 'the JS label "Sections" is gone');
});

// Why: one shared "No AI" line keeps every surface saying the same thing; a second copy drifts (spec 2.2).
test('"No AI is connected" is written exactly once in the source', () => {
  const n = ['app.js', 'ui.js', 'tour.js', 'logic.js', 'index.html'].reduce((sum, f) => sum + (read(f).match(/No AI is connected/g) || []).length, 0);
  assert.equal(n, 1);
});

// Why: no model or company may be favoured in copy (spec 4.5). The only names allowed are the provider of the judge's own
// key (read from providers.js at run time), the Settings provider picker (filled from providers.js) and, by the owner's
// request, the "Use your AI subscription" section in Settings (#sub-box). Everything else must stay neutral.
test('no vendor names in app, tour or page copy outside the allowed Settings parts', () => {
  const fixed = ['Anthropic', 'Claude', 'OpenAI', 'ChatGPT', 'GPT', 'Codex', 'Google', 'Gemini', 'Groq', 'Mistral', 'Deepgram', 'AssemblyAI', 'Whisper', 'Tabroom'];
  const fromProviders = [...Object.values(P.PROVIDERS).flatMap((p) => [p.name, p.short]), ...Object.values(P.SUBSCRIPTIONS).flatMap((s) => [s.name, s.plan, s.via])];
  const names = [...new Set([...fixed, ...fromProviders])];
  const words = new RegExp('\\b(' + names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b');
  for (const f of ['app.js', 'tour.js', 'ui.js']) {
    for (const s of jsStrings(read(f))) assert.ok(!words.test(s), `${f}: a string names a vendor: "${s.slice(0, 120)}"`);
  }
  // index.html: the subscription section is the one exempt part, by its id. The provider picker (#prov-list,
  // #ai-engine, #tr-engine) is empty in the markup; app.js fills it from providers.js.
  const html = read('index.html');
  const sub = elementById(html, 'sub-box');
  assert.ok(sub.includes('data-sub="claude-cli"') && sub.includes('data-sub="codex-cli"'), 'the exempt part is the subscription section');
  const rest = htmlText(html.replace(sub, ''));
  const hit = words.exec(rest);
  assert.equal(hit && rest.slice(Math.max(0, hit.index - 60), hit.index + 40), null, 'index.html names a vendor outside #sub-box');
});

// Why: the vendor test above is only as good as its string scanner; if the scanner silently found nothing, the test would always pass.
test('the string scanner finds real strings and skips comments, regexes and code', () => {
  const src = "// Claude in a comment\nconst a = 'one', b = \"two\"; /* OpenAI */ const r = /Gemini/i; const t = `x${a}y${`in`}z`; const Codex = 1;";
  assert.deepEqual(jsStrings(src), ['one', 'two', 'x', 'y', 'in', 'z']);
  assert.ok(jsStrings(read('app.js')).length > 500, 'app.js has many strings');
});
