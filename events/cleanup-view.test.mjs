// Tests for "Clean up my comments" on the Review screen, events/js/cleanup-view.js (docs/events/LANDING.md §4.1 step
// E13; DESIGN.md §4.9). Run with: node --test. The HTML builders and the click flow run with a fake page (no DOM, no
// network): the own key is a stand-in that returns a fixed draft.
import test from 'node:test';
import assert from 'node:assert/strict';
import '../core/policy.js';
import { cleanupButtonHtml, cleanupPanelHtml, diffHtml, createCleanup } from './js/cleanup-view.js';
import { cardHtml, commentsStageHtml } from './js/review-screen.js';
import { cards } from './js/ballot.js';
import { cleanableEntries, cleanupReview } from './js/cleanup.js';

const P = globalThis.TabulaCore.policy;
const NOW = 1_800_000_000_000;
const SOLO = P.gateFor({ now: NOW });
const record = (features) => ({ v: 2, product: 'events', edition: '', subject: { role: 'coach', programId: 'p1', managed: false }, features, aiSetup: true, account: { plan: '', hosted: false }, issuedAt: NOW - 1, expiresAt: NOW + 60000 });
const BANNED = P.gateFor({ record: record({}), programId: 'p1', now: NOW, profile: { programs: [] } });

const ROOM = () => ({
  id: 'r1', eventId: 'oo', eventVersion: 1, state: 'review', ranksCopiedAt: 1, profile: {},
  entries: [
    { id: 'e1', code: 'A12', name: 'Maria Lopez', order: 1, status: 'done', rank: 1, notes: '', comment: 'maria realy rushed the end', commentSource: 'judge', commentCopiedAt: 7 },
    { id: 'e2', code: 'B7', order: 2, status: 'done', rank: 2, notes: '', comment: '', commentSource: 'judge' },
  ],
});

// A fake page around createCleanup: the store, toasts, asks and draws are recorded.
function page({ gate = SOLO, hasKey = true, draft = 'Maria, you rushed the end.', fail = null } = {}) {
  let rooms = [ROOM()];
  const log = { draws: [], toasts: [], calls: 0, asks: [] };
  let release = null;
  const own = {
    hasKey: () => hasKey, providerName: () => 'OpenAI',
    async cleanup(g, msg) {
      log.calls++;
      log.msg = msg;
      if (!P.canUse(g, 'ballotDraft')) throw new Error('off');
      await new Promise((r) => { release = r; });
      if (fail) throw Object.assign(new Error(fail), { kind: 'rejected' });
      return { [msg.sent[0].id]: draft };
    },
    async connect() { hasKey = true; return 'openai'; },
    forget() { hasKey = false; },
  };
  const env = {
    now: () => 99, rooms: () => rooms, saveRoom: (r) => { rooms = rooms.map((x) => (x.id === r.id ? r : x)); },
    ui: { toast: (m, o) => log.toasts.push({ m, o }), announce() {}, ask: async (o) => { log.asks.push(o.title); return o.input ? 'sk-fake-test' : 'tab'; } },
    ai: { gate, own },
  };
  const c = createCleanup(env, { roomId: () => 'r1', event: () => ({ name: 'Original Oratory' }), draw: (k) => log.draws.push(k) });
  const el = (id, extra = {}) => ({ dataset: Object.assign({ id }, extra) });
  const card = (id) => cards(rooms[0], 'speaking').find((x) => x.id === id);
  return { c, log, el, card, room: () => rooms[0], answer: () => release && release(), tick: () => new Promise((r) => setTimeout(r, 0)) };
}

// Why: AI-POLICY §3b R1 and R2, and the E13 done rule: with AI off the button is gone, not greyed, and the card has no
// empty space where it was. A disabled or hidden-but-present button would tell a school's judges about a banned tool.
test('with AI off the card has no clean-up button and is the same as a card with no AI part', () => {
  const p = page({ gate: BANNED });
  const c = p.card('e1');
  assert.equal(p.c.path(), 'none');
  assert.deepEqual(p.c.view(c, false), { button: '', panel: '' });
  assert.equal(cardHtml(c, false, p.c.view(c, false)), cardHtml(c, false), 'no hole: the same HTML as before E13');
  assert.equal(cleanupButtonHtml(c, 'none'), '');
  const html = commentsStageHtml(p.room(), { order: 'speaking', editing: null, ai: (x, e) => p.c.view(x, e) });
  assert.doesNotMatch(html, /Clean up|data-vact="clean|disabled|AI/);
  assert.equal(commentsStageHtml(p.room(), { order: 'speaking', editing: null, ai: null }), commentsStageHtml(p.room(), { order: 'speaking', editing: null }));
});

// Why: the button is the only way in; it must show for a judge who may use AI (own key or the Connect invite), and
// not on a card with no words to clean or while the judge is editing that card.
test('the button shows when AI is allowed and there are words, and not while editing', () => {
  const p = page();
  assert.equal(p.c.path(), 'own');
  assert.match(p.c.view(p.card('e1'), false).button, /data-vact="clean" data-id="e1"[^>]*aria-expanded="false"/);
  assert.equal(p.c.view(p.card('e2'), false).button, '', 'no text, no button');
  assert.equal(p.c.view(p.card('e1'), true).button, '', 'not while the edit box is open');
  assert.equal(page({ hasKey: false }).c.path(), 'connect');
  assert.match(cardHtml(p.card('e1'), false, p.c.view(p.card('e1'), false)), /Clean up<\/button><button class="b small quiet" type="button" data-vact="edit"/);
});

// Why: the core E13 rule: the judge must review the word diff and accept it before any text changes. If the comment
// changed on the reply, or before "Use this", AI text would reach a minor's ballot unseen.
test('nothing changes until "Use this"; then only that comment, with its copy mark gone and Undo offered', async () => {
  const p = page();
  p.c.click('clean', p.el('e1'));
  assert.match(p.c.view(p.card('e1'), false).panel, /Your words go to OpenAI with your own key\.[\s\S]*A name you wrote only in your notes is sent as you wrote it\./, 'the screen says free text can still hold a name (ARCHITECTURE §6.4)');
  assert.equal(p.log.calls, 0, 'opening the panel sends nothing (runs only on a tap)');
  p.c.click('clean-go', p.el('e1'));
  assert.match(p.c.view(p.card('e1'), false).panel, /Cleaning up…/);
  p.answer(); await p.tick();
  assert.equal(p.room().entries[0].comment, 'maria realy rushed the end', 'the reply alone changes nothing');
  const panel = p.c.view(p.card('e1'), false).panel;
  assert.match(panel, /Your words<\/h4><div class="card-text">maria realy rushed the end<\/div>/);
  assert.match(panel, /<del><span class="sr-only">removed: <\/span>maria realy <\/del>/);
  assert.match(panel, /<ins><span class="sr-only">added: <\/span>Maria, you <\/ins>/);
  assert.match(panel, /AI rewrote your words\. Check them before you copy\./);
  assert.match(panel, />Use this<[\s\S]*>Keep mine<[\s\S]*>Try again</);
  p.c.click('clean-use', p.el('e1'));
  const e = p.room().entries[0];
  assert.deepEqual([e.comment, e.commentSource, e.commentCopiedAt], ['Maria, you rushed the end.', 'judgeEditedAi', null]);
  assert.deepEqual(p.room().entries[1], ROOM().entries[1], 'the other speaker is untouched');
  assert.equal(p.c.view(p.card('e1'), false).panel, '', 'the panel closes');
  assert.equal(p.log.draws.at(-1), 'copy-e1', 'focus goes to Copy comment');
  const undo = p.log.toasts.at(-1).o.action;
  assert.equal(undo.label, 'Undo');
  undo.run();
  assert.deepEqual([p.room().entries[0].comment, p.room().entries[0].commentCopiedAt], ['maria realy rushed the end', 7], 'Undo puts the judge\'s words and copy mark back');
});

// Why: "Keep mine" and Cancel must leave the judge's words as they are, and a reply that comes after Cancel must not
// open a draft the judge already walked away from.
test('Keep mine and Cancel change nothing; a late reply after Cancel is dropped', async () => {
  const p = page();
  p.c.click('clean', p.el('e1'));
  p.c.click('clean-go', p.el('e1'));
  p.answer(); await p.tick();
  p.c.click('clean-keep', p.el('e1'));
  assert.equal(p.room().entries[0].comment, 'maria realy rushed the end');
  assert.equal(p.c.view(p.card('e1'), false).panel, '');
  p.c.click('clean', p.el('e1'));
  p.c.click('clean-go', p.el('e1'));
  p.c.click('clean-close', p.el('e1'));
  p.answer(); await p.tick();
  assert.equal(p.c.view(p.card('e1'), false).panel, '', 'no draft opens after Cancel');
  assert.equal(p.room().entries[0].comment, 'maria realy rushed the end');
});

// Why: if the judge edits the comment while the AI works, "Use this" must not replace the newer words.
test('a comment edited before "Use this" is not overwritten', async () => {
  const p = page();
  p.c.click('clean', p.el('e1'));
  p.c.click('clean-go', p.el('e1'));
  p.answer(); await p.tick();
  const r = p.room();
  r.entries[0] = Object.assign({}, r.entries[0], { comment: 'my newer words' });
  p.c.click('clean-use', p.el('e1'));
  assert.equal(p.room().entries[0].comment, 'my newer words');
  assert.match(p.c.view(p.card('e1'), false).panel, /Your comment changed after the clean-up started/);
});

// Why: DESIGN §4.9's two modes must send different instructions; the mode the judge sees picked must be the one sent.
test('the mode toggle picks the prompt that is sent', async () => {
  const p = page();
  p.c.click('clean', p.el('e1'));
  assert.match(p.c.view(p.card('e1'), false).panel, /data-mode="full"[^>]*aria-pressed="true"/);
  p.c.click('clean-mode', p.el('e1', { mode: 'spelling' }));
  assert.match(p.c.view(p.card('e1'), false).panel, /data-mode="spelling"[^>]*aria-pressed="true"/);
  p.c.click('clean-go', p.el('e1'));
  assert.equal(p.log.msg.mode, 'spelling');
  p.answer(); await p.tick();
});

// Why: a failed call must say so in plain words, keep the comment, and give a way forward (try again, or a new key when
// the key was rejected); a silent failure would leave the judge waiting at the tournament.
test('an error shows plain words, Try again, and Forget my key for a rejected key', async () => {
  const p = page({ fail: 'OpenAI did not accept the key. Forget it, then connect a new one.' });
  p.c.click('clean', p.el('e1'));
  p.c.click('clean-go', p.el('e1'));
  p.answer(); await p.tick();
  const panel = p.c.view(p.card('e1'), false).panel;
  assert.match(panel, /role="alert">OpenAI did not accept the key/);
  assert.match(panel, /data-vact="clean-go"[^>]*>Try again</);
  assert.match(panel, /data-vact="clean-forget"/);
  assert.equal(p.room().entries[0].comment, 'maria realy rushed the end');
});

// Why: with no key, the button must lead to the Connect AI invite and then to the panel; a dead button would be a
// broken promise, and sending before a key is kept would fail.
test('with no key, Clean up asks for a key first, then opens the panel', async () => {
  const p = page({ hasKey: false });
  p.c.click('clean', p.el('e1'));
  await p.tick(); await p.tick(); await p.tick();
  assert.deepEqual(p.log.asks, ['Connect your AI key', 'Keep the key after you close this tab?']);
  assert.equal(p.c.path(), 'own');
  assert.match(p.c.view(p.card('e1'), false).panel, /data-vact="clean-go"/);
  assert.equal(p.log.calls, 0);
});

// Why: card text and AI text are shown as HTML; an unescaped "<" in a comment or a reply could run code in the page
// that holds the judge's API key.
test('typed text and AI text are escaped', () => {
  assert.equal(diffHtml([{ op: 'same', text: '<b>' }, { op: 'ins', text: '<img>' }]), '&lt;b&gt;<ins><span class="sr-only">added: </span>&lt;img&gt;</ins>');
  const sent = cleanableEntries(ROOM(), ['e1']);
  const card = cleanupReview(sent, { e1: '<script>x</script>' }).cards[0];
  const html = cleanupPanelHtml({ id: 'e1', code: '<A12>' }, { id: 'e1', mode: 'full', status: 'ready', card });
  assert.doesNotMatch(html, /<script>|<A12>/);
});

// Why: when the AI returns the same words or no words, "Use this" would do nothing or blank the comment; the panel
// must offer only "Keep mine" then.
test('no "Use this" when the draft is empty or the same as the judge\'s words', () => {
  const sent = cleanableEntries(ROOM(), ['e1']);
  for (const draft of [{}, { e1: 'maria realy rushed the end' }]) {
    const card = cleanupReview(sent, draft).cards[0];
    const html = cleanupPanelHtml({ id: 'e1', code: 'A12' }, { id: 'e1', mode: 'full', status: 'ready', card });
    assert.doesNotMatch(html, /clean-use/);
    assert.match(html, /b primary"[^>]*data-vact="clean-keep"/);
  }
});
