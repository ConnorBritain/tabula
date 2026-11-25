// The Speech Events a11y runner (opt-in; not part of `node --test`, which has no browser). It serves the repo root on
// this computer, opens /events/ in Playwright's Chromium, walks every screen in screens.mjs in light and dark at phone
// and laptop size, and runs axe-core on each. It also fails a screen that scrolls sideways.
//
// One-time setup (axe-core is pinned and lives only in the git-ignored .deps folder; the app never loads it):
//   npm install --prefix events/tools/a11y/.deps axe-core@4.10.2 --no-save --no-package-lock
// Run (from the repo root):
//   node events/tools/a11y/run.mjs                        every screen, light and dark, phone and laptop
//   node events/tools/a11y/run.mjs --only=rank,type       some screens
//   node events/tools/a11y/run.mjs --sizes=narrow         the 360 px phone only (also: phone, laptop)
//   node events/tools/a11y/run.mjs --table                also print the table for docs/events/A11Y.md
//   node events/tools/a11y/run.mjs --shots                also save a full-page screenshot of each run in out/
// Results go to events/tools/a11y/out/results.json (git-ignored). Exit code 0 = no serious or critical violation, no
// page error and no sideways scroll; 1 = at least one (each is printed).
import { createRequire } from 'node:module';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { SCREENS, THEMES, SIZES, NARROW, BLOCKING, pickScreens, summarize, screenTable } from './screens.mjs';
import { DRIVERS, ready } from './drivers.mjs';
import { serve } from './serve.mjs';

export const AXE_VERSION = '4.10.2';
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../..');
const AXE_PATH = join(HERE, '.deps/node_modules/axe-core/axe.min.js');
// The WCAG 2.2 A and AA rules, and axe's best practices (reported, and they fail only when serious or critical).
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

function args(argv) {
  const out = {};
  for (const a of argv) { const m = /^--([a-z]+)(?:=(.*))?$/.exec(a); if (m) out[m[1]] = m[2] === undefined ? true : m[2]; }
  return out;
}

async function axeSource() {
  let src;
  try { src = await readFile(AXE_PATH, 'utf8'); } catch {
    throw new Error('axe-core is not installed. Run: npm install --prefix events/tools/a11y/.deps axe-core@' + AXE_VERSION + ' --no-save --no-package-lock');
  }
  const pkg = JSON.parse(await readFile(join(HERE, '.deps/node_modules/axe-core/package.json'), 'utf8'));
  if (pkg.version !== AXE_VERSION) throw new Error('axe-core ' + pkg.version + ' is installed; the runner is pinned to ' + AXE_VERSION + '.');
  return src;
}

// One screen in one theme and size: a fresh device, the driver, then axe and the sideways-scroll check.
async function runOne(browser, base, axe, screen, theme, size, shots) {
  const context = await browser.newContext({ viewport: { width: size.width, height: size.height }, colorScheme: theme });
  context.setDefaultTimeout(8000);
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e.message || e)));
  const out = { screen: screen.id, theme, size: size.id, violations: [], overflow: 0, error: '' };
  try {
    await page.goto(base + '/events/');
    await ready(page);
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.reload();
    await ready(page);
    await DRIVERS[screen.id](page, { context, base });
    await page.addScriptTag({ content: axe });
    const res = await page.evaluate((tags) => globalThis.axe.run(document, { runOnly: { type: 'tag', values: tags }, resultTypes: ['violations'] }), TAGS);
    out.violations = res.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.map((n) => ({ target: n.target.join(' '), html: n.html.slice(0, 200), why: n.failureSummary })) }));
    if (shots) await page.screenshot({ path: join(HERE, 'out', `${screen.id}-${theme}-${size.id}.png`), fullPage: true });
    if (screen.id !== 'print') out.overflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - window.innerWidth));
    if (out.overflow <= 1) out.overflow = 0;
    if (pageErrors.length) out.error = pageErrors.join(' | ');
  } catch (e) {
    out.error = String(e.message || e).split('\n')[0];
  }
  await context.close();
  return out;
}

export async function main(argv = process.argv.slice(2)) {
  const a = args(argv);
  const screens = pickScreens(a.only);
  const all = [...SIZES, NARROW];
  const sizes = a.sizes ? String(a.sizes).split(',').map((id) => all.find((s) => s.id === id) || (() => { throw new Error('Unknown size: ' + id); })()) : SIZES;
  const themes = a.themes ? String(a.themes).split(',').filter((t) => THEMES.includes(t)) : THEMES;
  const axe = await axeSource();
  const { chromium } = createRequire(import.meta.url)('playwright'); // the preinstalled Playwright; never installed here
  await mkdir(join(HERE, 'out'), { recursive: true });
  const server = await serve(ROOT);
  const browser = await chromium.launch();
  const results = [];
  try {
    // A self-check first: axe must find a known fault (an image with no text), or a "0 violations" run means nothing.
    const probe = await browser.newPage();
    await probe.setContent('<!doctype html><html lang="en"><title>t</title><main><img src="x.png"></main></html>');
    await probe.addScriptTag({ content: axe });
    const found = await probe.evaluate(() => globalThis.axe.run(document, { runOnly: { type: 'rule', values: ['image-alt'] } }).then((r) => r.violations.length));
    await probe.close();
    if (!found) throw new Error('Self-check failed: axe did not find a known fault.');
    console.log('self-check: axe ' + AXE_VERSION + ' finds a known fault');
    for (const size of sizes) for (const theme of themes) for (const s of screens) {
      const r = await runOne(browser, server.url, axe, s, theme, size, Boolean(a.shots));
      results.push(r);
      const blocking = r.violations.filter((v) => BLOCKING.includes(v.impact));
      const mark = r.error || r.overflow || blocking.length ? 'FAIL' : 'ok  ';
      console.log(`${mark} ${s.id.padEnd(16)} ${theme.padEnd(5)} ${size.id.padEnd(6)}` + (r.violations.length ? '  ' + r.violations.map((v) => v.id + ':' + v.impact + '×' + v.nodes.length).join(' ') : '') + (r.overflow ? '  scrolls sideways ' + r.overflow + ' px' : '') + (r.error ? '  error: ' + r.error : ''));
      for (const v of blocking) for (const n of v.nodes.slice(0, 3)) console.log('       ' + v.id + ' at ' + n.target + '\n         ' + (n.why || '').split('\n').join('\n         '));
    }
  } finally {
    await browser.close();
    await server.close();
  }
  const sum = summarize(results);
  await mkdir(join(HERE, 'out'), { recursive: true });
  await writeFile(join(HERE, 'out/results.json'), JSON.stringify({ axe: AXE_VERSION, results, summary: sum }, null, 2));
  console.log(`\naxe-core ${AXE_VERSION}: ${sum.runs} runs, ${sum.failed} failed. critical ${sum.byImpact.critical}, serious ${sum.byImpact.serious}, moderate ${sum.byImpact.moderate}, minor ${sum.byImpact.minor}.`);
  for (const r of sum.rules) console.log(`  ${r.impact.padEnd(8)} ${r.id} ×${r.count}: ${r.where.join(', ')}`);
  for (const o of sum.overflow) console.log('  scrolls sideways: ' + o);
  for (const e of sum.errors) console.log('  error: ' + e);
  if (a.table) console.log('\n' + screenTable(results, screens, themes, sizes).join('\n'));
  return sum.failed ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((code) => { process.exitCode = code; }, (e) => { console.error(e.message || e); process.exitCode = 1; });
}
