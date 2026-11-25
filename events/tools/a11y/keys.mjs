// The Speech Events keyboard walk (opt-in, like run.mjs; it needs the preinstalled Playwright Chromium). For one room
// of each family it goes setup -> time -> notes -> rank -> copy with the keyboard only, and on each screen it Tabs
// through every stop to check: each stop shows a focus ring, Tab never gets stuck (no trap), and Esc closes each
// dialog and gives focus back. It prints the notes that docs/events/A11Y.md records.
//   node events/tools/a11y/keys.mjs               laptop size (1366 x 768)
//   node events/tools/a11y/keys.mjs --phone       phone size (390 x 844)
// Exit code 0 = no problem found, 1 = a problem (each is printed).
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { serve } from './serve.mjs';
import { ready, settle } from './drivers.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
export const FAMILIES = Object.freeze([
  { event: 'oo', label: 'Individual speech (OO)' },
  { event: 'poi', label: 'Interp with title and author (POI)' },
  { event: 'duo', label: 'Duo' },
  { event: 'usx', label: 'Extemp with a question (USX)' },
  { event: 'imp', label: 'Impromptu with prep (IMP)' },
]);
const MAX_STOPS = 160;

// What has focus, in words, and whether it shows a ring (an outline or a box-shadow ring).
const focusInfo = (page) => page.evaluate(() => {
  const a = document.activeElement;
  if (!a || a === document.body || a === document.documentElement) return null;
  // A ring is an outline, or a box-shadow that the element does not have when it is not focused (a static shadow is
  // not a focus ring). Blur and focus again: the last input was a key, so Chromium keeps :focus-visible.
  const look = (e) => { const c = getComputedStyle(e); return { ol: c.outlineStyle !== 'none' && parseFloat(c.outlineWidth) > 0, sh: c.boxShadow, olc: c.outlineStyle + c.outlineWidth + c.outlineColor }; };
  const on = look(a);
  a.blur();
  const off = look(a);
  a.focus({ preventScroll: true });
  const ring = (on.ol && on.olc !== off.olc) || (on.sh !== 'none' && on.sh !== off.sh);
  const name = (a.getAttribute('aria-label') || a.labels?.[0]?.textContent || a.textContent || a.placeholder || a.id || a.tagName).trim().replace(/\s+/g, ' ').slice(0, 40);
  const r = a.getBoundingClientRect();
  return { key: a.tagName + '#' + a.id + '|' + name + '|' + Math.round(r.top + scrollY) + ',' + Math.round(r.left), name, tag: a.tagName.toLowerCase(), ring, shown: r.width > 0 && r.height > 0 };
});

// Tab through the page from the top. Returns { stops, noRing: [names], hidden: [names], trapped }.
export async function tabWalk(page) {
  await page.evaluate(() => { document.activeElement && document.activeElement.blur && document.activeElement.blur(); window.focus(); });
  await page.evaluate(() => { const m = document.querySelector('.skip'); if (m) { m.focus(); m.blur(); } });
  const seen = [];
  const noRing = [], hidden = [];
  let trapped = false;
  for (let i = 0; i < MAX_STOPS; i++) {
    await page.keyboard.press('Tab');
    const f = await focusInfo(page);
    if (!f) { if (seen.length) break; continue; }
    if (seen.length && f.key === seen[0]) break; // wrapped to the first stop: the walk is done
    if (seen.includes(f.key)) { trapped = seen.indexOf(f.key) > 0; break; }
    seen.push(f.key);
    if (!f.ring) noRing.push(f.name);
    if (!f.shown) hidden.push(f.name);
    if (i === MAX_STOPS - 1) trapped = true;
  }
  return { stops: seen.length, noRing, hidden, trapped, order: seen.map((k) => k.split('|')[1]) };
}

const hashOf = (page) => page.evaluate(() => location.hash);
const activeName = (page) => page.evaluate(() => { const a = document.activeElement; return a ? (a.id || a.getAttribute('aria-label') || a.textContent || '').trim().slice(0, 40) : ''; });

// Press Tab until the focused element matches sel (a CSS selector). Returns true when found.
async function tabTo(page, sel, max = MAX_STOPS) {
  for (let i = 0; i < max; i++) {
    if (await page.evaluate((s) => Boolean(document.activeElement && document.activeElement.matches(s)), sel)) return true;
    await page.keyboard.press('Tab');
  }
  return false;
}

async function oneFamily(page, base, fam, problems, notes) {
  const say = (s) => notes.push(fam.event + ': ' + s);
  const bad = (s) => { problems.push(fam.event + ': ' + s); say('PROBLEM ' + s); };
  await page.goto(base + '/events/'); await ready(page);
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }); await page.reload(); await ready(page);

  // Setup: from My day by keyboard (Start a round -> picker -> the event -> confirm sheet -> setup).
  if (!(await tabTo(page, '#md-start'))) bad('My day: Tab never reached Start a round');
  await page.keyboard.press('Enter'); await page.waitForSelector('#pk-search');
  await page.keyboard.press('Tab'); // the search box (focus starts on the title)
  if (!(await tabTo(page, '#pk-search'))) bad('picker: Tab never reached Search');
  await page.keyboard.type(fam.event === 'usx' ? 'united states' : fam.event === 'imp' ? 'impromptu' : fam.event === 'poi' ? 'program oral' : fam.event === 'duo' ? 'duo' : 'original oratory');
  await settle(page);
  if (!(await tabTo(page, '.pk-pick'))) bad('picker: Tab never reached an event');
  await page.keyboard.press('Enter');
  await page.waitForSelector('#confirm:not([hidden])');
  say('confirm sheet opens with focus on ' + await activeName(page));
  await page.keyboard.press('Escape'); await settle(page);
  if (await page.locator('#confirm:not([hidden])').count()) bad('confirm sheet: Esc did not close it');
  else say('Esc closes the confirm sheet; focus back on ' + await activeName(page));
  await page.keyboard.press('Enter'); await page.waitForSelector('#confirm:not([hidden])');
  await page.keyboard.type('204');
  if (!(await tabTo(page, '[data-cf="start"]', 30))) bad('confirm sheet: Tab never reached Paste the room');
  await page.keyboard.press('Enter');
  await page.waitForSelector('#setup-paste');
  say('setup opens with focus on ' + await activeName(page));
  const setupWalk = await tabWalk(page);
  report('setup', setupWalk, bad, say);
  await page.focus('#setup-paste');
  await page.keyboard.type(fam.event === 'duo' ? '1. A12 Ann & Bo\n2. B07 Cy & Di\n3. C33 Ed & Flo' : '1. A12 Ann Lee\n2. B07 Bo Chan\n3. C33 Cy Diaz');
  if (!(await tabTo(page, '#setup-start', 40))) bad('setup: Tab never reached Start room');
  await page.keyboard.press('Enter');
  await page.waitForSelector('#stage');
  say('room opens with focus on ' + await activeName(page));
  report('room', await tabWalk(page), bad, say);

  // Time: with nothing focused, Space starts and stops the clock; digits pick a speaker (the keyboard sheet's keys).
  for (let i = 1; i <= 3; i++) {
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.keyboard.press(String(i)); await settle(page);
    const cur = await page.evaluate(() => (document.querySelector('#stage-code') || {}).textContent || '');
    if (!['A12', 'B07', 'C33'].includes(cur.trim()) || cur.trim() !== ['A12', 'B07', 'C33'][i - 1]) bad('key ' + i + ' did not pick speaker ' + i + ' (stage shows ' + cur + ')');
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    if (fam.event === 'imp') {
      // Impromptu: Space runs the prep clock first; the speech starts with its own button.
      await page.keyboard.press('Space'); await page.waitForTimeout(300);
      await page.evaluate(() => document.querySelector('#stage-code').setAttribute('tabindex', '-1'));
      await page.focus('#stage-code');
      if (!(await tabTo(page, '#stage button.primary', 30)) || !/Speech started/.test(await activeName(page))) bad('impromptu: Tab never reached Speech started');
      else await page.keyboard.press('Enter');
      await page.evaluate(() => document.activeElement && document.activeElement.blur());
    } else {
      await page.keyboard.press('Space');
    }
    await page.waitForTimeout(1100);
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.keyboard.press('Space'); await settle(page);
    const status = (await page.evaluate(() => (document.querySelector('#stage .pill') || {}).textContent || '')).trim();
    if (status !== 'Done') bad('speaker ' + i + ': Space did not stop the clock (status "' + status + '")');
    else if (i === 1) say('Space started and stopped the clock; status now "Done"');
    // Notes: Tab to the comment box and type.
    await page.focus('#stage-code').catch(() => {});
    if (!(await tabTo(page, '#notes', 60))) bad('room: Tab never reached the comment box');
    else await page.keyboard.type('Clear structure. Work on pace.');
  }
  // Rank: the Rank the room link, then the board's move buttons by keyboard.
  await page.evaluate(() => document.querySelector('#main').focus());
  if (!(await tabTo(page, '#go-rank'))) bad('room: Tab never reached Rank the room');
  await page.keyboard.press('Enter');
  await page.waitForSelector('#board, #rate-list');
  say('rank opens with focus on ' + await activeName(page));
  report('rank', await tabWalk(page), bad, say);
  await page.evaluate(() => document.querySelector('#main').focus());
  if (await tabTo(page, '[data-ract="down"]:not([disabled])', 80)) {
    const before = await activeName(page);
    await page.keyboard.press('Enter'); await settle(page);
    const after = await activeName(page);
    if (!/down/i.test(after)) bad('rank: after Move down, focus went to "' + after + '" (was "' + before + '")');
    else say('Move down by Enter; focus stays on ' + after);
  } else bad('rank: Tab never reached a Move down button');
  // The restart dialog: Esc closes it and focus comes back.
  await page.evaluate(() => document.querySelector('#main').focus());
  if (!(await tabTo(page, '#restart', 80))) bad('rank: Tab never reached Start again');
  await page.keyboard.press('Enter');
  await page.waitForSelector('#ask:not([hidden])');
  await page.keyboard.press('Escape'); await settle(page);
  if (await page.locator('#ask:not([hidden])').count()) bad('rank: Esc did not close Start again?');
  else if (await activeName(page) !== 'restart') bad('rank: after Esc, focus is on "' + await activeName(page) + '", not Start again');
  else say('Esc closes "Start the ranks again?"; focus back on Start again');
  // Copy: the review screen, Copy ranks by keyboard.
  await page.evaluate(() => document.querySelector('#main').focus());
  if (!(await tabTo(page, '#go-review', 80))) bad('rank: Tab never reached Review and copy');
  await page.keyboard.press('Enter');
  await page.waitForSelector('[data-vact="print"]');
  await settle(page);
  say('review opens with focus on ' + await activeName(page));
  report('review', await tabWalk(page), bad, say);
  await page.evaluate(() => document.querySelector('#main').focus());
  if (await tabTo(page, '[data-key="ranks"], button.primary', 80)) {
    await page.keyboard.press('Enter'); await settle(page);
    const f = await page.evaluate(() => { const a = document.activeElement; return a && a.matches('button') ? a.textContent.trim() : ''; });
    if (!/Cop/.test(f)) bad('review: after Copy ranks, focus left the copy button ("' + f + '")');
    else say('copy by Enter: focus stays on the copy button, now "' + f + '"');
  } else bad('review: Tab never reached a copy button');
  // The palette: Ctrl+K opens, Esc closes and gives focus back.
  const opener = await page.evaluate(() => { const a = document.activeElement; return a ? a.outerHTML.slice(0, 80) : ''; });
  await page.keyboard.press('Control+k');
  if (!(await page.locator('#palette:not([hidden])').count())) bad('Ctrl+K did not open the palette');
  await page.keyboard.press('Escape'); await settle(page);
  if (await page.locator('#palette:not([hidden])').count()) bad('Esc did not close the palette');
  else if (await page.evaluate(() => { const a = document.activeElement; return a ? a.outerHTML.slice(0, 80) : ''; }) !== opener) bad('Esc on the palette did not give focus back');
  else say('Ctrl+K opens the palette; Esc closes it and gives focus back');
  say('end at ' + await hashOf(page));
}

// The room keys from the keyboard sheet that a 3-speaker room never uses: 4 to 8 in an 8-speaker room, and in a room
// over 8 the place number then Enter (9, 0 and Enter).
async function bigRoomKeys(page, base, problems, notes) {
  const bad = (s) => { problems.push('keys: ' + s); notes.push('keys: PROBLEM ' + s); };
  const codes = Array.from({ length: 10 }, (_, i) => 'S' + (i + 1));
  const make = async (n, profile) => {
    await page.goto(base + '/events/#/new/oo'); await ready(page);
    await page.waitForSelector('#setup-paste');
    if (profile) await page.selectOption('#setup-profile', profile);
    await page.fill('#setup-paste', codes.slice(0, n).map((c, i) => (i + 1) + '. ' + c).join('\n'));
    await page.click('#setup-start'); await page.waitForSelector('#stage'); await settle(page);
  };
  const press = async (...keys) => { await page.evaluate(() => document.activeElement && document.activeElement.blur()); for (const k of keys) await page.keyboard.press(k); await settle(page); };
  const shown = () => page.evaluate(() => ((document.querySelector('#stage-code') || {}).textContent || '').trim());
  await page.goto(base + '/events/'); await ready(page);
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await make(8);
  for (let n = 4; n <= 8; n++) { await press(String(n)); if (await shown() !== 'S' + n) bad('key ' + n + ' did not pick speaker ' + n + ' in an 8-speaker room'); }
  await make(10, 'elim-large');
  await press('9', 'Enter'); if (await shown() !== 'S9') bad('9 then Enter did not pick speaker 9 in a 10-speaker room');
  await press('1', '0', 'Enter'); if (await shown() !== 'S10') bad('1, 0, Enter did not pick speaker 10');
  await press('4', 'Enter'); if (await shown() !== 'S4') bad('4 then Enter did not pick speaker 4 in a 10-speaker room');
  notes.push('keys: 4 to 8 pick in an 8-speaker room; in a 10-speaker room 9 Enter, 1 0 Enter and 4 Enter pick 9, 10 and 4');
}

function report(where, w, bad, say) {
  say(`${where}: ${w.stops} Tab stops, ` + (w.trapped ? 'TRAPPED' : 'no trap') + (w.noRing.length ? ', no ring on: ' + w.noRing.join('; ') : ', every stop shows a ring'));
  if (w.trapped) bad(where + ': Tab is trapped');
  if (w.noRing.length) bad(where + ': no focus ring on ' + w.noRing.join('; '));
  if (w.hidden.length) bad(where + ': focus lands on something not shown: ' + w.hidden.join('; '));
}

export async function main(argv = process.argv.slice(2)) {
  const phone = argv.includes('--phone');
  const only = (argv.find((a) => a.startsWith('--only=')) || '').slice(7);
  const ids = only ? only.split(',').map((x) => x.trim()).filter(Boolean) : FAMILIES.map((f) => f.event);
  const unknown = ids.filter((id) => !FAMILIES.some((f) => f.event === id));
  if (unknown.length) throw new Error('Unknown family: ' + unknown.join(', '));
  const { chromium } = createRequire(import.meta.url)('playwright');
  const server = await serve(ROOT);
  const browser = await chromium.launch();
  const problems = [], notes = [];
  let walked = 0;
  try {
    for (const fam of FAMILIES.filter((f) => ids.includes(f.event))) {
      walked++;
      const context = await browser.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1366, height: 768 } });
      context.setDefaultTimeout(8000);
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      const page = await context.newPage();
      try { await oneFamily(page, server.url, fam, problems, notes); } catch (e) { problems.push(fam.event + ': stopped: ' + String(e.message || e).split('\n')[0]); }
      await context.close();
    }
    const context = await browser.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1366, height: 768 } });
    context.setDefaultTimeout(8000);
    const page = await context.newPage();
    try { await bigRoomKeys(page, server.url, problems, notes); } catch (e) { problems.push('keys: stopped: ' + String(e.message || e).split('\n')[0]); }
    await context.close();
  } finally { await browser.close(); await server.close(); }
  for (const n of notes) console.log(n);
  console.log('\n' + (problems.length ? problems.length + ' problem(s):\n  ' + problems.join('\n  ') : 'No keyboard problem found.'));
  if (!walked) { console.log('Nothing was walked.'); return 1; }
  return problems.length ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((c) => { process.exitCode = c; }, (e) => { console.error(e); process.exitCode = 1; });
}
