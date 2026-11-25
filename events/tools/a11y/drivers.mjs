// The a11y runner's drivers: how to reach each screen in events/tools/a11y/screens.mjs with a Playwright page. Each
// driver starts from an empty device (the runner clears the saved data first) and leaves the page on its screen.
// This file never imports Playwright; run.mjs hands each driver its page. Only the keyboard and clicks a judge would
// use drive the app: no app module is called from here.

const PASTE = '1. A12 Ann Lee\n2. B07 Bo Chan\n3. C33 Cy Diaz\n4. D41 Di Evans';
// Interp: the title and author ride on the line (parse.js reads them into the preview).
const PASTE_INTERP = '1. A12 Ann Lee - The Raven by Edgar Allan Poe\n2. B07 Bo Chan\n3. C33 Cy Diaz';
const PASTE_DUO = '1. A12 Ann Lee & Bo Chan\n2. B07 Cy Diaz & Di Evans\n3. C33 Ed Fox & Flo Gray';

export const ready = (page) => page.waitForSelector('html[data-ready="true"]');
export const settle = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

async function go(page, hash) {
  await page.evaluate((h) => { location.hash = h; }, hash);
  await settle(page);
}

// Set up a room from #/new/<event> and open it. profile: a rules profile id (the Rules select), or none.
export async function newRoom(page, eventId, paste = PASTE, profile = '') {
  await go(page, '#/new/' + eventId);
  await page.waitForSelector('#setup-paste');
  if (profile) await page.selectOption('#setup-profile', profile);
  await page.fill('#setup-paste', paste);
  await page.click('#setup-start');
  await page.waitForSelector('#stage');
  await settle(page);
  return page.evaluate(() => location.hash.split('/')[2]);
}

// Mark each speaker done: pick, start, stop, next. Uses the room's own buttons.
async function hearAll(page) {
  const picks = page.locator('.strip-pill:visible, #roster .row-pick:visible');
  const n = await picks.count();
  for (let i = 0; i < n; i++) {
    await picks.nth(i).click();
    await settle(page);
    const start = page.locator('#stage button:visible', { hasText: /^Start$/ }).first();
    if (await start.count()) { await start.click(); await page.waitForTimeout(1100); }
    const stop = page.locator('#stage button:visible', { hasText: /^Stop$/ }).first();
    if (await stop.count()) await stop.click();
    if (await page.locator('#notes').count()) await page.fill('#notes', 'Clear structure, strong close. Work on eye contact in the middle.');
  }
  await settle(page);
}

export const DRIVERS = {
  async myday(page) {
    // A day with one round started and one card saved for later, so the rows, Up next and the menus show.
    await newRoom(page, 'oo');
    await go(page, '#/');
    await page.waitForSelector('#md-start');
  },
  async 'myday-offline'(page, ctx) {
    await ctx.context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await go(page, '#/');
    await page.waitForSelector('#offline-chip:not([hidden])');
  },
  async picker(page) {
    await go(page, '#/pick');
    await page.waitForSelector('.pk-pick');
  },
  async 'picker-confirm'(page) {
    await go(page, '#/pick');
    await page.locator('.pk-pick').first().click();
    await page.waitForSelector('#confirm:not([hidden]) #cf-room');
  },
  async 'setup-paste'(page) {
    await go(page, '#/new/hi');
    await page.fill('#setup-paste', PASTE);
    await page.locator('#setup-more summary').click();
    await settle(page);
  },
  async 'setup-typed'(page) {
    await go(page, '#/new');
    await page.fill('#setup-paste', 'A12\nB07\nthis line is not a code at all, is it?\nC33');
    await page.click('#setup-start'); // no event picked: the error line shows
    await settle(page);
  },
  async 'room-speech'(page) { await newRoom(page, 'oo'); },
  async 'room-interp'(page) {
    await newRoom(page, 'poi', PASTE_INTERP);
    await page.fill('#piece-title', 'The Raven').catch(() => {});
    await page.fill('#piece-author', 'Edgar Allan Poe').catch(() => {});
  },
  async 'room-duo'(page) { await newRoom(page, 'duo', PASTE_DUO); },
  async 'room-extemp'(page) {
    await newRoom(page, 'usx');
    const q = page.locator('#question, #stage input[id*="question"], #stage textarea[id*="question"]').first();
    if (await q.count()) await q.fill('Will the Fed cut rates before spring?');
  },
  async 'room-impromptu'(page) {
    await newRoom(page, 'imp');
    const start = page.locator('#stage button', { hasText: /prep/i }).first();
    if (await start.count()) await start.click();
    await page.waitForTimeout(50);
  },
  async 'room-roster'(page) {
    await newRoom(page, 'oo');
    if (await page.locator('#roster-toggle').isVisible()) await page.click('#roster-toggle');
    await page.locator('#roster .row-more').first().click();
    await settle(page);
  },
  async rank(page) {
    const id = await newRoom(page, 'oo');
    await hearAll(page);
    await go(page, '#/round/' + id + '/rank');
    await page.waitForSelector('#board');
  },
  async 'rate-points'(page) {
    const id = await newRoom(page, 'oo', PASTE, 'rate-only');
    await hearAll(page);
    await go(page, '#/round/' + id + '/rank');
    await page.waitForSelector('#rate-list');
  },
  async 'rate-words'(page) {
    // No shipped rules profile has a word scale yet (league drafts do), so this run gives the saved round one: the
    // same shape a draft profile file has (rating.words).
    const id = await newRoom(page, 'oo', PASTE, 'rate-only');
    await hearAll(page);
    await page.evaluate((rid) => {
      const key = 'tabulaEvents.rooms.v1';
      const rooms = JSON.parse(localStorage.getItem(key));
      const room = rooms.find((r) => r.id === rid);
      room.profile.rating = { words: ['Superior', 'Excellent', 'Good', 'Fair'] };
      localStorage.setItem(key, JSON.stringify(rooms));
    }, id);
    await page.reload();
    await ready(page);
    await go(page, '#/round/' + id + '/rank');
    await page.waitForSelector('.rate.words');
    await page.locator('.rate-word').first().click();
  },
  async 'rate-rubric'(page) {
    const id = await newRoom(page, 'oo', PASTE, 'rubric-five');
    await hearAll(page);
    await go(page, '#/round/' + id + '/rank');
    await page.waitForSelector('#board, #rate-list');
  },
  async 'review-ranks'(page) {
    const id = await newRoom(page, 'oo');
    await go(page, '#/round/' + id + '/review'); // ranks not done yet: stage 1 shows what blocks the copy
    await page.waitForSelector('#screen-title');
  },
  async 'review-comments'(page) {
    const id = await newRoom(page, 'oo');
    await hearAll(page);
    await go(page, '#/round/' + id + '/rank');
    await page.waitForSelector('#board');
    await go(page, '#/round/' + id + '/review');
    await page.waitForSelector('#screen-title');
    const copy = page.locator('#screen button', { hasText: /Copy ranks/ }).first();
    if (await copy.count()) await copy.click();
    await settle(page);
  },
  async print(page) {
    const id = await newRoom(page, 'oo');
    await hearAll(page);
    await go(page, '#/round/' + id + '/review');
    await page.waitForSelector('#screen-title');
    await page.evaluate(() => { window.print = () => {}; }); // no print dialog in the runner
    await page.locator('[data-vact="print"]').click();
    await page.emulateMedia({ media: 'print' });
    await settle(page);
  },
  async history(page) {
    await newRoom(page, 'oo');
    await newRoom(page, 'hi');
    await go(page, '#/history');
    await page.waitForSelector('#hist-table');
    await page.locator('button[data-more]').first().click();
  },
  async settings(page) {
    await go(page, '#/settings');
    await page.waitForSelector('#set-offline');
    await page.evaluate(() => { for (const d of document.querySelectorAll('#screen details')) d.open = true; });
    await settle(page);
  },
  async keyboard(page) {
    await go(page, '#/settings');
    await page.waitForSelector('.set-keys summary');
    await page.locator('.set-keys summary').click();
    await page.locator('.set-keys').scrollIntoViewIfNeeded();
  },
  async type(page) {
    await newRoom(page, 'hi');
    await go(page, '#/type/hi');
    await page.waitForSelector('#ty-start');
    await page.evaluate(() => { for (const d of document.querySelectorAll('#screen details')) d.open = true; });
    await settle(page);
  },
  async palette(page) {
    await newRoom(page, 'oo');
    await go(page, '#/');
    await page.keyboard.press('Control+k');
    await page.waitForSelector('#palette:not([hidden])');
    await page.keyboard.type('h');
    await settle(page);
  },
  async 'dialog-ask'(page) {
    const id = await newRoom(page, 'oo');
    await go(page, '#/round/' + id + '/rank');
    await page.click('#restart');
    await page.waitForSelector('#ask:not([hidden])');
  },
  async 'dialog-input'(page) {
    await newRoom(page, 'oo');
    await go(page, '#/');
    await page.locator('#screen [data-act="menu"]').first().click();
    await page.locator('#screen [data-act="room"]').first().click();
    await page.waitForSelector('#ask:not([hidden]) #ask-input');
    await page.fill('#ask-input', '');
    await page.press('#ask-input', 'Enter');
    await settle(page); // the empty field shows its error line
  },
  async 'toast-undo'(page) {
    await newRoom(page, 'oo');
    await go(page, '#/history');
    await page.locator('button[data-more]').first().click();
    await page.locator('button[data-del]').first().click();
    if (await page.locator('#ask:not([hidden])').count()) await page.locator('#ask-btns button').last().click();
    await page.waitForSelector('.toasts .toast, #toasts > *');
  },
};
