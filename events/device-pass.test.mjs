// The device pass helpers (events/tools/): the device list and the layout judges. Run with: node --test
// These need no browser. The pass itself (events/tools/device-pass.mjs) is opt-in and not run here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PROFILES, THEMES, SCREENS, pickProfiles, engineFor } from './tools/device-profiles.mjs';
import { MIN_TARGET, pageOverflow, smallTargets, overflowingText, judge, summarize, markdownTable } from './tools/device-checks.mjs';

const box = (o) => ({ label: 'x', tag: 'span', right: 100, boxRight: 100, width: 100, scrollWidth: 100, clientWidth: 100,
  scrolls: false, clips: false, hiddenBox: false, inScroller: false, viewport: 390, ...o });

// Why: if a device type drops off the list, nobody checks the screens judges see on it (a school Chromebook, an iPad).
test('the pass covers the five judge device types, in light and dark', () => {
  assert.deepEqual(PROFILES.map((p) => p.id), ['iphone', 'android', 'chromebook', 'ipad', 'windows']);
  assert.deepEqual([...THEMES], ['light', 'dark']);
});

// Why: a wrong size or touch setting means the pass looks at a screen no judge has, and misses real layout bugs.
test('each profile matches its device: phones are narrow with touch, laptops are wide without it', () => {
  for (const p of PROFILES) {
    const c = p.context;
    assert.ok(c.viewport.width > 0 && c.viewport.height > 0 && c.deviceScaleFactor >= 1 && c.userAgent, p.id);
    if (p.phone) assert.ok(c.viewport.width <= 430 && c.hasTouch && c.isMobile, `${p.id} is a phone`);
  }
  const by = Object.fromEntries(PROFILES.map((p) => [p.id, p.context]));
  assert.deepEqual([by.chromebook.viewport.width, by.chromebook.viewport.height, by.chromebook.hasTouch], [1366, 768, false]);
  assert.deepEqual([by.windows.viewport.width, by.windows.viewport.height], [1920, 1080]);
  assert.match(by.windows.userAgent, /Edg\//);
  assert.match(by.iphone.userAgent, /iPhone/);
  assert.match(by.chromebook.userAgent, /CrOS/);
  assert.ok(by.ipad.hasTouch && by.ipad.viewport.width >= 768);
});

// Why: a typo in --devices must stop the run, not quietly skip a device and report it as passed.
test('pickProfiles keeps list order, defaults to all, and refuses an unknown device', () => {
  assert.equal(pickProfiles('').length, 5);
  assert.deepEqual(pickProfiles('ipad,iphone').map((p) => p.id), ['iphone', 'ipad']);
  assert.throws(() => pickProfiles('iphone,nokia'), /Unknown device: nokia/);
});

// Why: when WebKit is missing the pass must say it ran Safari profiles on Chromium, not claim a Safari result.
test('engineFor falls back to Chromium when the wanted engine is not installed', () => {
  const iphone = PROFILES.find((p) => p.id === 'iphone');
  assert.equal(engineFor(iphone, ['chromium', 'webkit']), 'webkit');
  assert.equal(engineFor(iphone, ['chromium']), 'chromium');
});

// Why: a page wider than the phone makes the judge scroll sideways to reach Copy or Next speaker mid-round.
test('pageOverflow reports a page wider than the screen, and ignores a rounding pixel', () => {
  assert.equal(pageOverflow({ scrollWidth: 486, clientWidth: 390 }), 96);
  assert.equal(pageOverflow({ scrollWidth: 391, clientWidth: 390 }), 0);
  assert.equal(pageOverflow({ scrollWidth: 390, clientWidth: 390 }), 0);
});

// Why: a control smaller than a fingertip makes a judge tap the wrong speaker or the wrong rank on a phone.
test('smallTargets flags controls under 44x44 and skips links inside running text', () => {
  assert.equal(MIN_TARGET, 44);
  const found = smallTargets([
    { label: 'Start', tag: 'button', width: 120, height: 44 },
    { label: 'Up', tag: 'button', width: 32, height: 44 },
    { label: 'Search', tag: 'input', width: 300, height: 40 },
    { label: 'History', tag: 'a', width: 50, height: 18, inline: true },
    { label: 'Almost', tag: 'button', width: 43.6, height: 44 },
  ]);
  assert.deepEqual(found.map((t) => t.label), ['Up', 'Search']);
});

// Why: text that is cut off or runs over its neighbor can hide a speaker code, a rank or a rule from the judge.
test('overflowingText finds clipped and spilled text', () => {
  const found = overflowingText([
    box({ label: 'fits' }),
    box({ label: 'clipped', clips: true, scrollWidth: 180, clientWidth: 100 }),
    box({ label: 'runs over its box', right: 150, boxRight: 100 }),
    box({ label: 'past the screen edge', right: 460, boxRight: 460 }),
  ]);
  assert.deepEqual(found.map((f) => [f.label, f.kind, f.by]), [['clipped', 'clipped', 80], ['runs over its box', 'spills', 50], ['past the screen edge', 'spills', 70]]);
});

// Why: false alarms bury the real bugs; screen-reader-only text and a sideways strip of speakers are fine on purpose.
test('overflowingText ignores scroll boxes, screen-reader-only text and text inside a sideways scroller', () => {
  assert.deepEqual(overflowingText([
    box({ label: 'scrolls', scrolls: true, scrollWidth: 400 }),
    box({ label: 'sr-only', hiddenBox: true, clips: true, scrollWidth: 160, clientWidth: 1 }),
    box({ label: 'in the strip', inScroller: true, right: 600, boxRight: 600 }),
  ]), []);
  // Inside a scroller, text that runs over its own box is still a problem.
  assert.equal(overflowingText([box({ inScroller: true, right: 650, boxRight: 600 })]).length, 1);
});

// Why: the header is the same on every screen; filing it 23 times would hide the screen-specific findings.
test('judge returns every kind of finding and marks header findings', () => {
  const found = judge({
    page: { scrollWidth: 500, clientWidth: 390 },
    targets: [{ label: 'Brand', tag: 'a', width: 30, height: 25, header: true }],
    boxes: [box({ label: 'Settings', tag: 'a', right: 480, boxRight: 480, header: true })],
  });
  assert.deepEqual(found.map((f) => [f.problem, !!f.header]), [['page scrolls sideways', false], ['tap target under 44x44', true], ['text overflows its box', true]]);
});

// Why: the summary table is what gets fixes assigned; a lost device or theme hides who sees the bug.
test('summarize groups findings by screen and problem, keeps devices and themes, and sorts by walk order', () => {
  const rows = summarize([
    { screen: 'Rank', device: 'iphone', theme: 'light', problem: 'p', detail: 'a' },
    { screen: 'Rank', device: 'android', theme: 'dark', problem: 'p', detail: 'b' },
    { screen: 'My day', device: 'iphone', theme: 'light', problem: 'q', detail: 'c' },
  ], ['My day', 'Rank']);
  assert.deepEqual(rows.map((r) => [r.screen, r.devices.join(), r.themes.join(), r.count]), [['My day', 'iphone', 'light', 1], ['Rank', 'android,iphone', 'dark,light', 2]]);
  const md = markdownTable(rows);
  assert.match(md, /^\| Screen \| Devices \| Theme \| Problem \| Examples \|/);
  assert.match(md, /\| Rank \| android, iphone \| dark, light \| p \| a; b \|/);
  assert.match(markdownTable([]), /\(none\)/);
});

// Why: if the walk drops a screen type, its phone layout goes unchecked and a judge finds the bug mid-round.
test('the walk lists every screen type a judge meets, Congress included', () => {
  for (const s of ['My day', 'Picker', 'Room setup', 'Rank', 'Rate', 'Review and copy', 'History', 'Settings', 'Palette', 'Type page',
    'Congress setup', 'Congress log', 'Congress PO hour', 'Congress rank', 'Congress review']) assert.ok(SCREENS.includes(s), s);
  assert.ok(SCREENS.filter((s) => s.startsWith('Room: ')).length >= 3, 'a room screen for each family');
  const walk = readFileSync(new URL('./tools/device-pass.mjs', import.meta.url), 'utf8');
  for (const s of SCREENS.filter((x) => x !== 'Header (every screen)')) assert.ok(walk.includes(`'${s}'`), `device-pass.mjs walks ${s}`);
});

// Why: screenshots are large; committing them would bloat the public repo on every run.
test('the pass output folder is gitignored', () => {
  assert.match(readFileSync(new URL('./tools/.gitignore', import.meta.url), 'utf8'), /^out\/$/m);
});

// Why: the device tools serve files and drive a browser; shipped to the judge site, they would be dead weight at best.
test('the events build never copies events/tools', async () => {
  const { ALLOW } = await import('../build-events.mjs');
  for (const name of ALLOW) assert.ok(!/^events\/tools(\/|$)/.test(name) && name !== 'events', `build-events.mjs ALLOW ships ${name}`);
});

// Why: the pass serves the repo folder; it must not crash on a bad address or hand out .git or files above the repo.
test('the local server serves app files only: no dotfiles, no paths above the root, no crash on bad encoding', async () => {
  const { serve } = await import('./tools/serve.mjs');
  const root = new URL('../', import.meta.url).pathname;
  const s = await serve(root);
  try {
    const get = async (path) => (await fetch(s.url + path)).status;
    assert.equal(await get('/events/index.html'), 200);
    assert.equal(await get('/%E0%A4%A'), 400);
    assert.equal(await get('/.git/config'), 404);
    assert.notEqual(await get('/..%2f..%2fetc%2fpasswd'), 200);
    assert.equal(await get('/events/no-such-file.js'), 404);
  } finally { await s.close(); }
});
