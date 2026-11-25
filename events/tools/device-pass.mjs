// Speech Events emulated device pass. Opt-in: it needs a browser, so it is NOT part of `node --test`.
// Run from the repo root:   node events/tools/device-pass.mjs [--devices=iphone,android] [--themes=light] [--out=DIR]
//
// It serves the repo root on 127.0.0.1, opens /events/ with each device profile (events/tools/device-profiles.mjs) in
// the light and the dark theme, and walks one speech room and one Congress chamber the way a judge would:
// setup -> time -> rank -> copy -> reload -> offline reload. On every screen it records console errors, uncaught
// errors, sideways page scroll, tap targets under 44x44 CSS px, text that does not fit its box, and a full-page
// screenshot. Output goes to events/tools/out/ (gitignored): screenshots, findings.json and summary.md.
// It uses the Playwright that is already installed on the machine. It never installs a browser.
// The checklist this backs up is docs/events/DEVICE-CHECK.md.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';
import { SCREENS, THEMES, pickProfiles, engineFor } from './device-profiles.mjs';
import { measurePage, judge, summarize, markdownTable } from './device-checks.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v ?? '1']));
const OUT = args.out || fileURLToPath(new URL('out/', import.meta.url));


let pw;
try { pw = createRequire(import.meta.url)('playwright'); } catch {
  console.error('Playwright is not installed here. This pass is opt-in; the unit tests still run with node --test.');
  process.exit(2);
}

function installedEngines() {
  const out = [];
  for (const name of ['chromium', 'webkit', 'firefox']) {
    try { const p = pw[name].executablePath(); if (p && existsSync(p)) out.push(name); } catch { /* not installed */ }
  }
  return out;
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SIX = '101 Avery Lin\n102 Jordan Park\n103 Sam Ortiz\n104 Riley Chen\n105 Morgan Diaz\n106 Casey Patel';
const EIGHT = ['201', '202', '203', '204', '205', '206', '207', '208'].join('\n');

// A page call that has no time limit of its own (evaluate) gets one here.
const within = (promise, ms, what) => Promise.race([promise, new Promise((_, no) => setTimeout(() => no(new Error(`${what} took over ${ms / 1000} s`)), ms).unref())]);

async function walk(browser, engine, profile, theme, server, log, trace) {
  const tag = { device: profile.id, theme };
  const dir = `${OUT}${profile.id}-${theme}/`;
  mkdirSync(dir, { recursive: true });
  const ctxOpts = { ...profile.context, colorScheme: theme, serviceWorkers: 'allow' };
  if (engine === 'firefox') { delete ctxOpts.isMobile; }
  const ctx = await browser.newContext(ctxOpts);
  if (engine === 'chromium') await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: server.url });
  await ctx.clock.install(); // fake time: a 4-minute speech or a 1-hour PO term takes a moment, not minutes
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  let pending = [];
  page.on('console', (m) => { if (m.type() === 'error') pending.push({ problem: 'console error', detail: m.text().slice(0, 200) }); });
  page.on('pageerror', (e) => pending.push({ problem: 'uncaught exception', detail: String(e.message).slice(0, 200) }));
  let n = 0;
  const covered = trace.covered;
  const base = server.url + '/events/';
  const hash = () => page.evaluate(() => location.hash);
  const go = async (h) => { await page.evaluate((x) => { location.hash = x; }, h); await sleep(350); };
  const settle = async () => { await page.waitForLoadState('load'); await sleep(350); };
  const note = (screen, problem, detail) => log.push({ screen, ...tag, problem, detail });
  // One screen: measure it, judge it, screenshot it, and pin any console errors since the last screen to it.
  const shot = async (screen) => {
    await sleep(200);
    trace.step = `measure ${screen}`;
    const found = judge(await within(page.evaluate(measurePage), 15000, 'measuring the page'));
    for (const f of [...pending, ...found]) note(f.header ? 'Header (every screen)' : screen, f.problem, f.detail);
    pending = [];
    n++;
    trace.step = `screenshot ${screen}`;
    await page.screenshot({ path: `${dir}${String(n).padStart(2, '0')}-${slug(screen)}.png`, fullPage: true, animations: 'disabled', timeout: 20000 });
    covered.push(screen);
  };
  // A step a judge depends on: when it fails, it is a finding, and the walk goes on.
  const check = async (screen, what, fn) => {
    trace.step = `check ${what}`;
    try { const ok = await within(fn(), 20000, what); if (!ok) note(screen, 'step failed', what); } catch (e) { note(screen, 'step failed', `${what}: ${String(e.message).split('\n')[0].slice(0, 160)}`); }
  };
  // A clipboard read can wait forever for page focus, so it gets its own time limit.
  const clipboard = async () => engine === 'chromium'
    ? page.evaluate(() => Promise.race([navigator.clipboard.readText(), new Promise((_, no) => setTimeout(() => no(new Error('clipboard read timed out')), 3000))]))
    : null;
  const click = (sel) => { trace.step = `click ${sel}`; return page.click(sel, { timeout: 4000 }); };

  // --- Speech room ----------------------------------------------------------------------------------------------
  await page.goto(base); await settle();
  await check('My day', 'the offline worker installs', async () => page.evaluate(() => Promise.race([navigator.serviceWorker.ready.then(() => true), new Promise((r) => setTimeout(() => r(false), 8000))])));
  await page.reload(); await settle(); // the second load is the one the offline cache serves from (Settings says so)
  await shot('My day');
  await go('#/pick'); await shot('Picker');
  await go('#/type/hi'); await shot('Type page');
  await go('#/new/hi');
  await page.fill('#setup-paste', SIX); await page.fill('#setup-round', '2'); await page.fill('#setup-tournament', 'Winter Invitational');
  await shot('Room setup');
  await click('#setup-start'); await sleep(500);
  const roomId = (await hash()).split('/')[2];
  for (let i = 0; i < 6; i++) {
    const before = await page.textContent('.timer, [class*=timer]').catch(() => '');
    await click('[data-tact=startstop]');
    await page.clock.fastForward(i === 2 ? '10:45' : '04:30'); await sleep(250);
    if (i === 0) {
      await check('Room: interp (HI)', 'the timer counts while running', async () => (await page.textContent('.timer, [class*=timer]').catch(() => '')) !== before);
      await shot('Room: interp (HI)');
    }
    await click('[data-tact=startstop]'); await sleep(150);
    await page.fill('#notes', `Clear characters and strong pops. Work on the intro, speaker ${i + 1}.`);
    if (i < 5) { await click('[data-act=next]'); await sleep(250); }
  }
  await click('#go-rank'); await sleep(400);
  await click('[data-ract=down] >> nth=0'); await sleep(200);
  await shot('Rank');
  await click('#go-review'); await sleep(400);
  await shot('Review and copy');
  if (engine === 'chromium') {
    await check('Review and copy', 'Copy ranks puts the ranks on the clipboard', async () => { await click('[data-what=ranks]'); await sleep(300); return /101/.test(await clipboard()); });
    await check('Review and copy', 'Copy comment puts the comment on the clipboard', async () => { await click('[data-vact=copy]:not([data-what=ranks]) >> nth=0'); await sleep(300); return /Clear characters/.test(await clipboard()); });
  } else note('Review and copy', 'not checked', `clipboard read is not available on ${engine}`);
  await page.reload(); await settle();
  await check('Review and copy', 'ranks are still there after a reload', async () => /101/.test(await page.textContent('#screen')) && /Copy ranks/.test(await page.textContent('#screen')));
  await ctx.setOffline(true);
  await page.reload().catch(() => {}); await settle();
  await check('Review offline', 'the review screen loads offline', async () => /Copy ranks/.test(await page.textContent('#screen').catch(() => '')));
  await check('Review offline', 'the offline chip shows', async () => page.isVisible('#offline-chip'));
  await shot('Review offline');
  await go(`#/round/${roomId}`);
  await check('Review offline', 'the room screen loads offline', async () => /Next speaker|Rank the room/.test(await page.textContent('#screen').catch(() => '')));
  pending = pending.filter((p) => !/ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(p.detail)); // the network is off on purpose
  await ctx.setOffline(false);

  for (const [ev, screen] of [['oo', 'Room: public address (OO)'], ['usx', 'Room: limited prep (USX)'], ['pcc', 'Room: Pro Con Challenge (PCC)']]) {
    await go('#/new/' + ev); await page.fill('#setup-paste', SIX); await click('#setup-start'); await sleep(500);
    await check(screen, 'the room opens', async () => /^#\/round\//.test(await hash()));
    await shot(screen);
  }
  await go('#/new/hi'); await page.selectOption('#setup-profile', 'rate-only'); await page.fill('#setup-paste', SIX);
  await click('#setup-start'); await sleep(500);
  await go(`#/round/${(await hash()).split('/')[2]}/rank`); await shot('Rate');
  await go('#/history'); await shot('History');
  await go('#/settings'); await shot('Settings');
  await page.keyboard.press(profile.context.userAgent.includes('Mac') || profile.context.userAgent.includes('iPhone') ? 'Meta+k' : 'Control+k'); await sleep(300);
  await check('Palette', 'the palette opens with the keyboard shortcut', async () => page.isVisible('#palette'));
  if (!(await page.isVisible('#palette'))) { await page.keyboard.press('Control+k'); await sleep(300); }
  await shot('Palette');
  await page.keyboard.press('Escape'); await sleep(200);

  // --- Congress chamber -----------------------------------------------------------------------------------------
  await go('#/chamber/new');
  await page.fill('#cg-tournament', 'Winter Invitational'); await page.fill('#cg-room', '204');
  await page.fill('#cg-paste', EIGHT); await page.fill('#cg-docket', 'A Bill to Fund High-Speed Rail\nA Resolution on Water Rights');
  await shot('Congress setup');
  await click('#cg-create'); await sleep(500);
  const chamberId = (await hash()).split('/')[2];
  for (let i = 0; i < 4; i++) {
    await click('[data-cact=next]'); await sleep(200);
    await click(`[data-cact=pick] >> nth=${i + 1}`); await sleep(200);
    await page.clock.fastForward('03:00'); await sleep(150);
    await click(`[data-cact=points][data-value="${5 + (i % 3)}"]`);
    await page.fill('#cg-comment', `Good clash with the last speaker. Speech ${i + 1}.`);
    if (i === 0) await shot('Congress log');
    await click('[data-cact=end]'); await sleep(150);
    if (await page.isVisible('[data-cact=close]')) { await click('[data-cact=close]'); await sleep(150); }
  }
  await click('[data-cact=po-choose]'); await sleep(200);
  await click('[data-cact=po-start] >> nth=0');
  // The chamber's 1-second tick must see the new term once before the hour passes (that first look is its baseline).
  await sleep(1500);
  await page.clock.fastForward('01:01:00'); await sleep(400);
  await check('Congress PO hour', 'the PO hour asks for a score after one hour',
    async () => page.waitForSelector('[data-cact=po-score]', { timeout: 3000 }).then(() => true, () => false));
  await shot('Congress PO hour');
  if (await page.isVisible('[data-cact=po-score]')) { await click('[data-cact=po-score][data-value="7"]'); await sleep(200); }
  await go(`#/round/${chamberId}/rank`);
  for (let i = 0; i < 8; i++) { await click('.cg-poolrow:not(.on) >> nth=0').catch(() => {}); await sleep(120); }
  await shot('Congress rank');
  await go(`#/round/${chamberId}/review`);
  await shot('Congress review');
  if (engine === 'chromium') {
    await check('Congress review', 'Copy ranks puts the chamber ranks on the clipboard', async () => { await click('[data-cact=copy][data-id=ranks]'); await sleep(300); return /20\d/.test(await clipboard()); });
    await check('Congress review', 'Copy puts one speech on the clipboard', async () => { await click('[data-cact=copy]:not([data-id=ranks]) >> nth=0'); await sleep(300); return /Good clash/.test(await clipboard()); });
  }
  await page.reload(); await settle();
  await check('Congress review', 'the chamber is still there after a reload', async () => /Good clash/.test(await page.textContent('#screen')));
  await ctx.setOffline(true);
  await page.reload().catch(() => {}); await settle();
  await check('Congress offline', 'the chamber loads offline', async () => /Good clash/.test(await page.textContent('#screen').catch(() => '')));
  await shot('Congress offline');
  pending = pending.filter((p) => !/ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(p.detail));
  await ctx.setOffline(false);
  await go('#/chamber'); await shot('Congress chambers');
  await go('#/'); await shot('My day (with rounds)');
  await ctx.close();
  return covered;
}

async function main() {
  const profiles = pickProfiles(args.devices);
  const themes = args.themes ? args.themes.split(',').filter((t) => THEMES.includes(t)) : [...THEMES];
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  const installed = installedEngines();
  const commit = (() => { try { return execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], { cwd: ROOT }).toString().trim(); } catch { return 'unknown'; } })();
  const server = await serve(ROOT);
  const log = [];
  const runs = [];
  const browsers = {};
  try {
    for (const profile of profiles) {
      const engine = engineFor(profile, installed);
      browsers[engine] ||= await pw[engine].launch();
      for (const theme of themes) {
        process.stdout.write(`${profile.id} ${theme} (${engine}) ... `);
        const t0 = Date.now();
        let covered = [];
        // One stuck step must not stall the whole pass: each walk gets 5 minutes.
        const trace = { step: 'start', covered: [] };
        const limit = new Promise((_, no) => setTimeout(() => no(new Error('walk took over 5 minutes')), 300000).unref());
        try { covered = await Promise.race([walk(browsers[engine], engine, profile, theme, server, log, trace), limit]); } catch (e) {
          log.push({ screen: 'walk', device: profile.id, theme, problem: 'walk stopped', detail: `at "${trace.step}": ${String(e.message).split('\n')[0].slice(0, 200)}` });
        }
        covered = trace.covered;
        runs.push({ device: profile.id, name: profile.name, theme, engine, wanted: profile.engine, screens: covered.length });
        console.log(`${covered.length} screens, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
      }
    }
  } finally {
    for (const b of Object.values(browsers)) await b.close();
    await server.close();
  }
  const rows = summarize(log, SCREENS);
  const runTable = '| Device | Profile | Theme | Engine | Screens |\n|---|---|---|---|---|\n' +
    runs.map((r) => `| ${r.device} | ${r.name} | ${r.theme} | ${r.engine}${r.engine !== r.wanted ? ` (wanted ${r.wanted}: not installed)` : ''} | ${r.screens} |`).join('\n');
  const md = `# Emulated device pass\n\nCommit: ${commit}\n\n${runTable}\n\n## Findings\n\n${markdownTable(rows)}\n`;
  writeFileSync(OUT + 'findings.json', JSON.stringify({ commit, runs, findings: log }, null, 2));
  writeFileSync(OUT + 'summary.md', md);
  console.log('\n' + md);
  console.log(`Screenshots and findings: ${OUT}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
