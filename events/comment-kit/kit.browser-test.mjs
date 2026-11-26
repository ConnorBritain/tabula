import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { serve } from '../tools/a11y/serve.mjs';
import { newRoom, ready } from '../tools/a11y/drivers.mjs';

let server, browser;
before(async () => {
  server = await serve(fileURLToPath(new URL('../../', import.meta.url)));
  const { chromium } = createRequire(import.meta.url)('playwright');
  browser = await chromium.launch();
});
after(async () => {
  if (browser) await browser.close();
  if (server) await server.close();
});

async function inRoom(run, options = {}) {
  const context = await browser.newContext(options);
  try {
    const page = await context.newPage();
    await page.goto(server.url + '/events/');
    await ready(page);
    await newRoom(page, 'oo', 'A12');
    await page.clock.install();
    await page.clock.pauseAt(new Date(Date.now() + 1000));
    await run(page);
  } finally { await context.close(); }
}

// Why: a warning about an old comment must not interrupt a judge who has moved to another screen.
test('leaving Room before the blur check does not announce its detached comment', async () => {
  await inRoom(async (page) => {
    await page.locator('#notes').fill('ugly');
    await page.locator('#nav-settings').click();
    await page.locator('#set-backup').waitFor();
    await page.clock.runFor(500);
    assert.doesNotMatch(await page.locator('#sr-status').innerText(), /Check this comment/);
  });
});

// Why: returning to an unfinished word must keep the check quiet until the judge finishes that word.
test('refocusing cancels the pending blur check while later completed text still gets a note', async () => {
  await inRoom(async (page) => {
    const notes = page.locator('#notes');
    await notes.fill('ugly');
    await page.locator('#screen-title').focus();
    await page.clock.runFor(100);
    await notes.focus();
    await page.clock.runFor(500);
    assert.equal(await page.locator('#notes-kit-note:visible').count(), 0);
    assert.doesNotMatch(await page.locator('#sr-status').innerText(), /Check this comment/);
    await notes.fill('ugly.');
    await page.clock.runFor(70);
    assert.equal(await page.locator('#notes-kit-note:visible').count(), 1);
    assert.match(await page.locator('#sr-status').innerText(), /Check this comment/);
  });
});

// Why: even an already queued screen-reader message becomes stale when its comment leaves the page.
test('leaving Room before the live message does not announce its detached comment', async () => {
  await inRoom(async (page) => {
    await page.locator('#notes').fill('ugly.');
    await page.locator('#nav-settings').click();
    await page.locator('#set-backup').waitFor();
    await page.clock.runFor(100);
    assert.doesNotMatch(await page.locator('#sr-status').innerText(), /Check this comment/);
  });
});

// Why: cancelling a queued warning must not silence that same warning when the judge leaves the comment later.
test('a cancelled message can announce the unchanged word on a later valid blur', async () => {
  await inRoom(async (page) => {
    const notes = page.locator('#notes');
    await notes.fill('ugly.');
    await page.locator('#screen-title').focus();
    await notes.focus();
    await page.clock.runFor(100);
    assert.doesNotMatch(await page.locator('#sr-status').innerText(), /Check this comment/);
    await page.locator('#screen-title').focus();
    await page.clock.runFor(500);
    assert.equal(await notes.inputValue(), 'ugly.');
    assert.equal(await page.locator('#notes-kit-note:visible').count(), 1);
    assert.match(await page.locator('#sr-status').innerText(), /Check this comment/);
  });
});

async function focusedStarter(page, kind, index) {
  const view = await page.evaluate(() => {
    const button = document.activeElement;
    const strip = button.closest('.chips');
    const b = button.getBoundingClientRect(), s = strip.getBoundingClientRect();
    const left = s.left + strip.clientLeft;
    const text = document.createRange();
    text.selectNodeContents(button);
    return { kind: button.dataset.kitKind, index: Number(button.dataset.kitI), left: b.left, right: b.right, top: b.top, bottom: b.bottom, clipLeft: left, clipRight: left + strip.clientWidth,
      textRects: [...text.getClientRects()].map((r) => ({ left: r.left, right: r.right, top: r.top, bottom: r.bottom })) };
  });
  assert.equal(view.kind, kind);
  assert.equal(view.index, index);
  assert.ok(view.left >= view.clipLeft - 1 && view.right <= view.clipRight + 1, 'The focused starter must be fully readable: ' + JSON.stringify(view));
  assert.ok(view.textRects.length > 0 && view.textRects.every((r) => r.left >= view.left - 1 && r.right <= view.right + 1 && r.top >= view.top - 1 && r.bottom <= view.bottom + 1), 'The complete starter label must fit inside its button: ' + JSON.stringify(view));
}

async function walkStarters(page, kind) {
  const buttons = page.locator(`[data-kit-kind="${kind}"]`);
  const count = await buttons.count();
  assert.ok(count > 1);
  await buttons.first().focus();
  await focusedStarter(page, kind, 0);
  for (let i = 1; i < count; i++) {
    await page.keyboard.press('Tab');
    await focusedStarter(page, kind, i);
  }
  for (let i = count - 2; i >= 0; i--) {
    await page.keyboard.press('Shift+Tab');
    await focusedStarter(page, kind, i);
  }
  await page.keyboard.press('Tab');
  await focusedStarter(page, kind, 1);
}

for (const viewport of [{ width: 390, height: 667 }, { width: 1366, height: 768 }]) for (const wideFont of [false, true]) {
  // Why: a keyboard judge cannot choose a useful starter if focus moves to a clipped label or insertion loses the writing cursor.
  test(`focused starters stay readable and activate at ${viewport.width} pixels${wideFont ? ' with a wide fallback font' : ''}`, async () => {
    await inRoom(async (page) => {
      if (wideFont) {
        await page.addStyleTag({ content: '.kit-chip { font-family: monospace; }' });
        const shortLines = await page.locator('[data-kit-kind="strength"]').nth(1).evaluate((button) => {
          const range = document.createRange(); range.selectNodeContents(button); return range.getClientRects().length;
        });
        assert.equal(shortLines, 1, 'A short starter keeps its single-line shape.');
      }
      const notes = page.locator('#notes');
      await notes.fill('Clear open. Clear close.');
      await notes.evaluate((box) => box.setSelectionRange(12, 12));
      await walkStarters(page, 'strength');
      await page.keyboard.press('Enter');
      assert.equal(await notes.inputValue(), 'Clear open. Your best example was  Clear close.');
      assert.equal(await notes.evaluate((box) => document.activeElement === box && box.selectionStart === box.selectionEnd), true);
      await page.keyboard.type('the first example.');
      assert.equal(await notes.inputValue(), 'Clear open. Your best example was the first example. Clear close.');

      await notes.evaluate((box) => box.setSelectionRange(box.value.length, box.value.length));
      await walkStarters(page, 'toWork');
      await page.keyboard.press('Enter');
      assert.match(await notes.inputValue(), /Try adding a source for $/);
      assert.equal(await notes.evaluate((box) => document.activeElement === box && box.selectionStart === box.selectionEnd), true);

      const y = await page.evaluate(() => scrollY);
      await page.locator('[data-kit-kind="strength"]').first().evaluate((button) => button.focus({ preventScroll: true }));
      await focusedStarter(page, 'strength', 0);
      assert.equal(await page.evaluate(() => scrollY), y, 'Refocusing reveals only the horizontal strip.');

      await page.locator('[data-cact="reason-open"]').click();
      const reason = page.locator('#reason');
      await reason.fill('A12 had the clearer close.');
      await reason.evaluate((box) => box.setSelectionRange(box.value.length, box.value.length));
      await walkStarters(page, 'reason');
      await page.keyboard.press('Enter');
      assert.equal(await reason.inputValue(), 'A12 had the clearer close. What set you apart was ');
      assert.equal(await reason.evaluate((box) => document.activeElement === box && box.selectionStart === box.selectionEnd), true);
    }, { viewport });
  });
}
