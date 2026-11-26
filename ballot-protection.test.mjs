import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const L = require('./logic.js');
const { parseHtml } = require('./test-html.js');
const source = readFileSync(new URL('./js/decide.js', import.meta.url), 'utf8');
const controls = source.slice(source.indexOf('const ranksOn ='), source.indexOf('function renderBallot()'));

function setup(ballot = {}, format = 'policy-hs') {
  const tags = new Map();
  const events = {};
  const ctx = {
    TabulaCore: { 'ai-mark': require('./core/ai-mark.js') },
    L, R: { ballot: { pts: {}, ranks: {}, ...ballot } }, FMT: () => L.getFormat(format, 1),
    escapeHtml: (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'),
    save() {}, renderDraftPanel() {}, toast(message) { ctx.notice = message; },
    undoToast(message, action, undo, restored) { ctx.undoNotice = { message, action, undo, restored }; },
    document: {
      activeElement: { dataset: {} },
      addEventListener(name, fn) { events[name] = fn; },
      querySelectorAll() { return [...tags.values()]; },
      querySelector(selector) {
        const key = selector.match(/data-protect="([^"]+)"/)[1];
        return { focus() { ctx.document.activeElement = { dataset: { protect: key } }; } };
      },
    },
  };
  vm.createContext(ctx);
  vm.runInContext(controls, ctx);
  return { ctx, events, tags, button: (key) => parseHtml(ctx.tagHtml(key)).children[0] };
}

// Why: a disappearing control hides permission and prevents a judge from protecting a field again.
test('empty, AI-filled and protected fields always have an accessible icon button', () => {
  for (const ballot of [{}, { winner: 'aff', aiFilled: { winner: true } }, { winner: 'aff', touched: { winner: true } }]) {
    const { button } = setup(ballot);
    const b = button('winner');
    const locked = Boolean(ballot.touched);
    assert.equal(b.tag, 'button');
    assert.equal(b.attrs['aria-label'], 'Protect the winner from AI');
    assert.equal(b.attrs['aria-pressed'], String(locked));
    assert.equal(b.attrs['data-ai'], 'ballotDraft');
    assert.match(b.attrs['data-tip'], locked ? /Protected from AI/ : /AI editing allowed/);
    assert.equal(b.children[0].attrs.class, locked ? 'lock' : 'ai-sparkle');
    assert.equal(b.children[0].attrs['aria-hidden'], 'true');
  }
});

// Why: granting AI permission must never erase the winner or change any typed text.
test('clicking the icon twice unlocks and relocks without changing ballot values', () => {
  const { ctx, events, button } = setup({ winner: 'aff', rfd: 'My decision', touched: { winner: true } });
  const click = () => events.click({ target: { closest: () => ({ dataset: { protect: 'winner' } }) } });
  click();
  assert.equal(button('winner').attrs['aria-pressed'], 'false');
  assert.equal(ctx.undoNotice.message, 'The AI may now change the winner.');
  click();
  assert.equal(button('winner').attrs['aria-pressed'], 'true');
  assert.equal(ctx.undoNotice.message, 'The AI cannot change the winner.');
  assert.equal(ctx.R.ballot.winner, 'aff');
  assert.equal(ctx.R.ballot.rfd, 'My decision');
});

// Why: a speaker-row lock must protect both points and rank without affecting another speaker.
test('a row toggle changes permission for its fields only', () => {
  const { ctx } = setup({ pts: { '1A': '29' }, ranks: { '1A': 1 }, touched: { 'pts.2A': true } });
  ctx.toggleBallotProtection('row.1A');
  assert.equal(ctx.R.ballot.touched['pts.1A'], true);
  assert.equal(ctx.R.ballot.touched['ranks.1A'], true);
  ctx.toggleBallotProtection('row.1A');
  assert.equal(ctx.R.ballot.touched['pts.1A'], undefined);
  assert.equal(ctx.R.ballot.touched['ranks.1A'], undefined);
  assert.equal(ctx.R.ballot.touched['pts.2A'], true);
  assert.equal(ctx.R.ballot.pts['1A'], '29');
  assert.equal(ctx.R.ballot.ranks['1A'], 1);
});

// Why: a format without ranks must not acquire hidden rank permissions when the judge locks points.
test('LD and PF row locks respect the format and side labels', () => {
  for (const format of ['ld', 'pf']) {
    const { ctx, button } = setup({}, format);
    const id = ctx.FMT().speakerIds[0];
    ctx.toggleBallotProtection('row.' + id);
    assert.deepEqual(Object.keys(ctx.R.ballot.touched), ['pts.' + id]);
    assert.match(button('row.' + id).attrs['aria-label'], / points from AI$/);
    assert.doesNotMatch(button('row.' + id).attrs['aria-label'], /rank/);
  }
  assert.equal(setup({}, 'pf').button('negFb').attrs['aria-label'], 'Protect the Con comments from AI');
});

// Why: Undo on a permission switch must preserve edits made elsewhere while the notification was visible.
test('Undo restores the previous permission and AI origin without removing a later edit', () => {
  const { ctx } = setup({ rfd: 'AI text', aiFilled: { rfd: true } });
  ctx.toggleBallotProtection('rfd');
  ctx.R.ballot = L.markFields(ctx.R.ballot, ['affFb'], 'yours');
  ctx.R.ballot.affFb = 'Later edit';
  ctx.undoNotice.undo();
  assert.equal(ctx.R.ballot.touched.rfd, undefined);
  assert.equal(ctx.R.ballot.aiFilled.rfd, true);
  assert.equal(ctx.R.ballot.touched.affFb, true);
  assert.equal(ctx.R.ballot.affFb, 'Later edit');
  ctx.toggleBallotProtection('rfd');
  ctx.toggleBallotProtection('rfd');
  ctx.undoNotice.undo();
  assert.equal(ctx.R.ballot.touched.rfd, true);
});

// Why: Undo must never give AI permission to replace text the judge typed after a lock change.
test('Undo leaves a later edit to the same field protected', () => {
  const { ctx } = setup({ rfd: 'Original text' });
  ctx.toggleBallotProtection('rfd');
  ctx.R.ballot.rfd = 'Newer typed text';
  ctx.R.ballot = L.markFields(ctx.R.ballot, ['rfd'], 'yours');
  assert.equal(ctx.undoNotice.undo(), false);
  assert.equal(L.fieldState(ctx.R.ballot, 'rfd'), 'yours');
  assert.equal(ctx.R.ballot.rfd, 'Newer typed text');
  assert.equal(ctx.notice, 'Kept your newer edits protected.');
});

// Why: Undo of a lock must restore the pending draft choice unless the judge has made another choice since.
test('Undo restores the review choice without discarding later review changes', () => {
  const { ctx } = setup();
  ctx.R.ballotReview = L.reviewFromDraft(ctx.R.ballot, { rfd: 'AI decision' }, { picks: ['rfd'] });
  ctx.toggleBallotProtection('rfd');
  ctx.undoNotice.undo();
  assert.equal(ctx.R.ballotReview.cards[0].choice, 'insert');
  ctx.toggleBallotProtection('rfd');
  ctx.R.ballotReview.cards[0].choice = 'ai';
  ctx.undoNotice.undo();
  assert.equal(ctx.R.ballotReview.cards[0].choice, 'ai');
});

// Why: protecting an empty field must prevent auto fill and a pending draft from inserting into it.
test('a new lock stops both pending review insertion and automatic refill', () => {
  const { ctx } = setup();
  const draft = { rfd: 'AI decision' };
  ctx.R.ballotReview = L.reviewFromDraft(ctx.R.ballot, draft, { picks: ['rfd'] });
  assert.equal(ctx.R.ballotReview.cards[0].choice, 'insert');
  ctx.toggleBallotProtection('rfd');
  assert.equal(ctx.R.ballotReview.cards[0].choice, 'keep');
  assert.equal(ctx.R.ballotReview.cards[0].state, 'yours');
  assert.equal(L.applyReview(ctx.R.ballot, ctx.R.ballotReview, true).ballot.rfd, undefined);
  assert.ok(!L.autoRefillPlan(ctx.R.ballot, draft).write.includes('rfd'));
  ctx.toggleBallotProtection('rfd');
  assert.ok(L.autoRefillPlan(ctx.R.ballot, draft).write.includes('rfd'));
});

// Why: replacing an icon must not drop keyboard focus and send the next key to an unrelated control.
test('redrawing permission icons keeps focus on the same control', () => {
  const { ctx, tags } = setup();
  let html = '';
  tags.set('winner', {
    dataset: { tag: 'winner' },
    get innerHTML() { return html; },
    set innerHTML(value) { html = value; ctx.document.activeElement = { dataset: {} }; },
  });
  ctx.document.activeElement = { dataset: { protect: 'winner' } };
  ctx.toggleBallotProtection('winner');
  assert.equal(ctx.document.activeElement.dataset.protect, 'winner');
  assert.match(tags.get('winner').innerHTML, /aria-pressed="true"/);
});

// Why: a second lock revokes an earlier replacement choice, so Accept all cannot overwrite protected text.
test('relocking a field resets a pending explicit AI choice', () => {
  const { ctx } = setup({ rfd: 'My decision', touched: { rfd: true } });
  ctx.R.ballotReview = L.reviewFromDraft(ctx.R.ballot, { rfd: 'AI decision' }, { picks: ['rfd'] });
  ctx.toggleBallotProtection('rfd');
  ctx.R.ballotReview.cards[0].choice = 'ai';
  ctx.toggleBallotProtection('rfd');
  assert.equal(ctx.R.ballotReview.cards[0].choice, 'keep');
  assert.equal(L.applyReview(ctx.R.ballot, ctx.R.ballotReview, true).ballot.rfd, 'My decision');
});

// Why: a points review covers all rows, but locking one more speaker must revoke a prior replacement choice.
test('locking another speaker resets the combined points review', () => {
  const { ctx } = setup({ pts: { '1A': '29', '2A': '28' }, touched: { 'pts.1A': true } });
  ctx.R.ballotReview = L.reviewFromDraft(ctx.R.ballot, { points: { '1A': 27, '2A': 27 } }, { picks: ['pts'] });
  ctx.R.ballotReview.cards[0].choice = 'ai';
  ctx.toggleBallotProtection('row.2A');
  assert.equal(ctx.R.ballotReview.cards[0].choice, 'keep');
  assert.equal(L.applyReview(ctx.R.ballot, ctx.R.ballotReview, true).ballot.pts['2A'], '28');
});
