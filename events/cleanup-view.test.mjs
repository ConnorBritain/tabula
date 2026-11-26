import test from 'node:test';
import assert from 'node:assert/strict';
import '../core/policy.js';
import { cleanupButtonHtml, cleanupPanelHtml, diffHtml, createCleanup } from './js/cleanup-view.js';
import { cardHtml, commentsStageHtml, createReviewScreen } from './js/review-screen.js';
import { cards } from './js/ballot.js';
const P = globalThis.TabulaCore.policy, NOW = 1_800_000_000_000;
const SOLO = P.gateFor({ now: NOW }), BANNED = P.gateFor({ now: NOW, off: true });
const SCHOOL_BANNED = P.gateFor({ record: { v: 2, product: 'events', edition: '', subject: { role: 'coach', programId: 'p1', managed: false }, features: {}, aiSetup: true, account: { plan: '', hosted: false }, issuedAt: NOW - 1, expiresAt: NOW + 60000 }, programId: 'p1', now: NOW, profile: { programs: [] } });
const ROOM = () => ({ id: 'r1', eventId: 'oo', eventVersion: 1, state: 'review', ranksCopiedAt: 1, profile: {}, entries: [
  { id: 'e1', code: 'A12', name: 'Maria Lopez', order: 1, status: 'done', rank: 1, notes: '', comment: 'maria realy rushed the end', commentSource: 'judge', commentCopiedAt: 7 },
  { id: 'e2', code: 'B7', order: 2, status: 'done', rank: 2, notes: '', comment: '', commentSource: 'judge' },
] });
function page({ gate = SOLO, hasKey = true, draft = 'Maria, you rushed the end.', fail = null, settings = {}, connectAnswer = true } = {}) {
  let rooms = [ROOM()], release;
  const log = { draws: [], toasts: [], calls: 0, asks: [] };
  const own = { hasKey: () => hasKey, providerName: () => 'OpenAI', async cleanup(g, msg, opts) {
    log.calls++; log.msg = msg; log.signal = opts.signal;
    if (!P.canUse(g, 'ballotDraft')) throw new Error('off');
    await new Promise((r) => { release = r; });
    if (fail) throw new Error(fail);
    return { [msg.sent[0].id]: draft };
  }, async connect() { hasKey = true; return 'openai'; } };
  const env = { now: () => 99, rooms: () => rooms, settings: () => settings, saveRoom: (r) => { rooms = rooms.map((x) => x.id === r.id ? r : x); }, ui: { toast: (m, o) => log.toasts.push({ m, o }), announce() {}, ask: async (o) => { log.asks.push(o.title); return !connectAnswer ? null : o.input ? 'sk-fake-test' : 'tab'; } }, ai: { gate, own } };
  const c = createCleanup(env, { roomId: () => 'r1', event: () => ({ name: 'Original Oratory' }), draw: (k) => log.draws.push(k) });
  const el = (id = 'e1', extra = {}) => ({ dataset: { id, ...extra } });
  return { c, env, log, el, card: (id = 'e1') => cards(rooms[0], 'speaking').find((x) => x.id === id), room: () => rooms[0], answer: () => release?.(), tick: () => new Promise((r) => setTimeout(r, 0)), click: (act, extra) => c.click(act, el('e1', extra)) };
}
const selected = (p, start = 6, end = 11) => ({ id: 'e1', start, end, base: p.room().entries[0].comment, rect: { left: 20, right: 90, top: 200, bottom: 220 }, scrollY: 0 });

// Why: school policy must remove AI controls entirely and prevent even indirect requests.
test('AI off has no button, selection toolbar, dialog or request', async () => {
  for (const gate of [BANNED, SCHOOL_BANNED]) {
  const p = page({ gate }), c = p.card();
  assert.equal(p.c.path(), 'none'); assert.equal(p.c.button(c), ''); assert.equal(p.c.panel(), '');
  assert.equal(cardHtml(c, false, { button: p.c.button(c), panel: '' }), cardHtml(c, false));
  assert.equal(cleanupButtonHtml(c, 'none'), '');
  p.c.select(selected(p)); await p.click('clean'); await p.click('clean-more');
  assert.equal(p.c.panel(), ''); assert.equal(p.log.calls, 0);
  assert.doesNotMatch(commentsStageHtml(p.room(), { order: 'speaking', ai: () => ({ button: '', panel: '' }) }), /data-ai-text|data-vact="clean/);
  }
});

// Why: the default edit must take one action, while empty feedback must not offer a dead command.
test('compact primary star runs immediately using saved operation and style', async () => {
  const p = page({ settings: { feedbackEdit: { mode: 'concise' }, aiPreferences: { defaults: { mode: 'custom', style: 'Brief', guidance: 'Do not send this' } } } });
  assert.match(p.c.button(p.card()), /aria-label="Shorten feedback with AI"/);
  assert.match(p.c.button(p.card()), /More AI edits/);
  assert.doesNotMatch(p.c.button(p.card()), />Edit with AI</);
  assert.equal(p.c.button(p.card('e2')), '');
  p.click('clean');
  assert.equal(p.log.calls, 1); assert.equal(p.log.msg.mode, 'concise');
  assert.match(p.log.msg.prompt, /Brief/); assert.doesNotMatch(p.log.msg.prompt, /Do not send this/);
  assert.match(p.c.panel(), /Preparing an edit/); assert.doesNotMatch(p.c.panel(), /Preview changes|<select/);
  p.answer(); await p.tick();
});

// Why: a routine edit must remain a suggestion until the judge accepts it, with a complete Undo path.
test('reply alone changes nothing; accept clears copy status and Undo restores only this comment', async () => {
  const p = page(); p.click('clean'); p.answer(); await p.tick();
  assert.equal(p.room().entries[0].comment, ROOM().entries[0].comment);
  const panel = p.c.panel();
  assert.match(panel, /<del><span class="sr-only">removed: <\/span>maria realy <\/del>/);
  assert.match(panel, /<ins><span class="sr-only">added: <\/span>Maria, you <\/ins>/);
  assert.match(panel, /AI rewrote your words\. Check them before you copy\./);
  assert.match(panel, />Use this<[^]*>Keep mine<[^]*>Try again</);
  p.click('clean-original'); assert.match(p.c.panel(), />maria realy rushed the end<\/div>/);
  p.click('clean-suggested'); assert.match(p.c.panel(), /<ins>/);
  p.click('clean-use');
  assert.deepEqual([p.room().entries[0].comment, p.room().entries[0].commentSource, p.room().entries[0].commentCopiedAt], ['Maria, you rushed the end.', 'judgeEditedAi', null]);
  assert.deepEqual(p.room().entries[1], ROOM().entries[1]); assert.equal(p.c.panel(), ''); assert.equal(p.log.draws.at(-1), 'copy-e1');
  const undo = p.log.toasts.at(-1).o.action;
  assert.equal(undo.label, 'Undo');
  undo.run();
  assert.deepEqual([p.room().entries[0].comment, p.room().entries[0].commentCopiedAt], [ROOM().entries[0].comment, 7]);
});

// Why: alternate operations should stay out of the main screen and run directly when chosen.
test('More opens only a custom field and quick actions; a quick action sends in one click', async () => {
  const p = page(); p.click('clean-more');
  assert.equal(p.log.calls, 0); assert.equal(p.log.asks.length, 0);
  assert.match(p.c.panel(), /How should this text change/);
  assert.match(p.c.panel(), /Quick edits/); assert.doesNotMatch(p.c.panel(), /<select|Preview changes|Saved feedback style|Privacy and connection/);
  p.click('clean-op', { mode: 'spelling' }); assert.equal(p.log.msg.mode, 'spelling'); assert.equal(p.log.calls, 1);
  p.answer(); await p.tick();
});

// Why: custom wording must not connect a key or send a request before a request is present.
test('custom request validates first and sends bounded user instructions only after Apply', async () => {
  const p = page({ hasKey: false }); p.click('clean-more'); await p.click('clean-custom');
  assert.equal(p.log.calls, 0); assert.equal(p.log.asks.length, 0); assert.match(p.c.panel(), /Describe the wording change/);
  p.c.input({ target: { dataset: { cleanRequest: '', id: 'e1' }, value: 'Use short sentences' } });
  p.click('clean-custom'); await p.tick(); await p.tick();
  assert.deepEqual(p.log.asks, ['Connect your AI key', 'Keep the key after you close this tab?']);
  assert.match(p.log.msg.prompt, /Use short sentences/); assert.doesNotMatch(p.log.msg.system, /Use short sentences/);
  p.answer(); await p.tick();
});

// Why: connection is an exceptional first-run step, not a prerequisite for choosing alternate edits.
test('primary action connects on demand and a canceled connection sends nothing', async () => {
  const p = page({ hasKey: false, connectAnswer: false }); await p.click('clean');
  assert.equal(p.log.calls, 0); assert.match(p.c.panel(), /Connect an AI key in Settings/);
});

// Why: selection editing must never send or replace text outside the highlighted range.
test('selection toolbar uses saved default and replaces only the captured excerpt', async () => {
  const p = page({ draft: 'really', settings: { feedbackEdit: { mode: 'spelling' } } });
  p.c.select(selected(p)); assert.equal(p.log.calls, 0);
  assert.match(p.c.panel(), /AI for selected text/); assert.match(p.c.panel(), /Fix spelling selected text with AI/);
  p.click('clean-selected');
  assert.doesNotMatch(p.log.msg.prompt, /rushed the end/); assert.match(p.log.msg.prompt, /realy/);
  p.answer(); await p.tick();
  assert.match(p.c.panel(), /Only selected text will change/);
  assert.equal(p.room().entries[0].comment, ROOM().entries[0].comment);
  p.click('clean-use'); assert.equal(p.room().entries[0].comment, 'maria really rushed the end');
  p.log.toasts.at(-1).o.action.run(); assert.equal(p.room().entries[0].comment, ROOM().entries[0].comment);
});

// Why: the custom and quick edit paths must retain the selection when the toolbar takes focus.
test('selection More preserves the excerpt through a custom request', async () => {
  const p = page({ draft: 'really' }); p.c.select(selected(p)); p.click('clean-selection-more');
  p.c.select(null); p.c.input({ target: { dataset: { cleanRequest: '', id: 'e1' }, value: 'Fix the spelling' } });
  p.click('clean-custom'); assert.match(p.log.msg.prompt, /Fix the spelling/); assert.doesNotMatch(p.log.msg.prompt, /rushed the end/);
  p.answer(); await p.tick(); p.click('clean-use'); assert.equal(p.room().entries[0].comment, 'maria really rushed the end');
});

// Why: edits made while a suggestion is pending or ready must always win over the older AI result.
test('changed source and stale selection are never overwritten or sent as a full comment', async () => {
  const p = page(); p.click('clean'); p.answer(); await p.tick();
  p.room().entries[0].comment = 'my newer words'; p.click('clean-use');
  assert.equal(p.room().entries[0].comment, 'my newer words'); assert.match(p.c.panel(), /changed after the preview/);
  const q = page(); const stale = selected(q); q.room().entries[0].comment = 'Changed'; q.c.select(stale); q.click('clean-selected');
  assert.equal(q.log.calls, 0); assert.equal(q.c.panel(), '');
});

// Why: canceling or leaving must abort paid work and must not reopen a late suggestion.
test('Escape, outside, editing, reset and Keep mine leave the original intact', async () => {
  for (const act of ['escape', 'outside', 'edit', 'reset', 'keep']) {
    const p = page(); p.click('clean'); const signal = p.log.signal;
    if (act === 'escape') p.c.key({ key: 'Escape', preventDefault() {}, stopPropagation() {} });
    if (act === 'outside') p.c.outside({ target: { closest: () => null } });
    if (act === 'edit') p.c.closeFor('e1');
    if (act === 'reset') p.c.reset();
    if (act === 'keep') { p.answer(); await p.tick(); p.click('clean-keep'); }
    assert.equal(signal.aborted, true, act); p.answer(); await p.tick();
    assert.equal(p.c.panel(), '', act); assert.equal(p.room().entries[0].comment, ROOM().entries[0].comment, act);
  }
});

// Why: failure, missing output and unchanged output must never blank or silently replace a comment.
test('error and empty/unchanged results keep the original and provide a way forward', async () => {
  const p = page({ fail: 'The provider is busy.' }); p.click('clean'); p.answer(); await p.tick();
  assert.match(p.c.panel(), /role="alert">The provider is busy/); assert.match(p.c.panel(), /Try again/); assert.match(p.c.panel(), /AI settings/);
  for (const draft of ['', ROOM().entries[0].comment]) {
    const q = page({ draft }); q.click('clean'); q.answer(); await q.tick();
    assert.doesNotMatch(q.c.panel(), /data-vact="clean-use"/); assert.match(q.c.panel(), /Keep mine/);
    assert.equal(q.room().entries[0].comment, ROOM().entries[0].comment);
  }
});

// Why: text in comments, requests and AI output must never become active HTML around the judge's key.
test('typed text and AI text are escaped', async () => {
  assert.equal(diffHtml([{ op: 'same', text: '<b>' }, { op: 'ins', text: '<img>' }]), '&lt;b&gt;<ins><span class="sr-only">added: </span>&lt;img&gt;</ins>');
  const p = page({ draft: '<script>x</script>' }); p.click('clean'); p.answer(); await p.tick();
  assert.doesNotMatch(p.c.panel(), /<script>/); assert.match(p.c.panel(), /&lt;script&gt;/);
});

// Why: saved custom defaults must run as user wording data without reopening a request form.
test('the primary action runs a saved custom request directly', async () => {
  const p = page({ settings: { feedbackEdit: { mode: 'custom', request: 'Use plain language' } } });
  p.click('clean'); assert.equal(p.log.calls, 1); assert.equal(p.log.msg.mode, 'custom');
  assert.match(p.log.msg.prompt, /Use plain language/); assert.doesNotMatch(p.log.msg.system, /Use plain language/);
  p.answer(); await p.tick();
});

// Why: floating controls must not recreate the selected textarea, and expanding content must stay inside the viewport.
test('Review updates only the editor layer and removes selection listeners on exit', async () => {
  const names = ['window', 'document', 'CSS', 'innerWidth', 'innerHeight'];
  const before = new Map(names.map((n) => [n, Object.getOwnPropertyDescriptor(globalThis, n)]));
  const handlers = new Map(), docHandlers = new Map(), winHandlers = new Map(), nodes = new Map(), stageHandlers = new Map();
  const node = (id) => { if (!nodes.has(id)) nodes.set(id, { writes: 0, value: '', set innerHTML(v) { this.writes++; this.value = v; }, focus() {}, addEventListener: (n, f) => stageHandlers.set(id + ':' + n, f) }); return nodes.get(id); };
  let height = 250;
  const box = { style: {}, getBoundingClientRect: () => ({ width: 366, height }) };
  const root = { innerHTML: '', querySelector: (s) => s === '[data-clean-panel]' ? box : s.startsWith('[data-vact=') ? { getBoundingClientRect: () => ({ top: 400, bottom: 444, right: 300 }) } : node(s), contains: () => true, addEventListener: (n, f) => handlers.set(n, f), removeEventListener: (n) => handlers.delete(n) };
  try {
    Object.assign(globalThis, { window: { scrollY: 0, getSelection: () => null, addEventListener: (n, f) => winHandlers.set(n, f), removeEventListener: (n) => winHandlers.delete(n) }, document: { activeElement: null, getElementById: () => null, body: { classList: { remove() {} } }, addEventListener: (n, f) => docHandlers.set(n, f), removeEventListener: (n) => docHandlers.delete(n) }, CSS: { escape: (s) => s }, innerWidth: 390, innerHeight: 844 });
    const p = page({ hasKey: false }), screen = createReviewScreen({ ...p.env, el: root, data: { events: new Map() } });
    screen.show('r1'); const count = node('#review-comments').writes;
    assert.equal(typeof stageHandlers.get('#review-comments:focusin'), 'function', 'Review keeps the comment-kit focus hook after AI controls are integrated');
    await handlers.get('click')({ target: { closest: () => ({ dataset: { vact: 'clean-more', id: 'e1' } }) } });
    assert.equal(node('#review-comments').writes, count, 'opening AI options preserves the actual text nodes');
    assert.match(node('#review-ai-layer').value, /Quick edits/);
    height = 620; handlers.get('toggle')();
    assert.ok(Number.parseFloat(box.style.top) >= 12);
    assert.ok(Number.parseFloat(box.style.top) + height <= innerHeight - 12);
    screen.hide(); assert.equal(handlers.size, 0); assert.equal(docHandlers.size, 0); assert.equal(winHandlers.size, 0);
  } finally { for (const [n, value] of before) { if (value) Object.defineProperty(globalThis, n, value); else delete globalThis[n]; } }
});

// Why: comparison tabs must remain usable from the keyboard without losing focus into the page.
test('comparison tabs support arrows, Home and End with one tab stop', async () => {
  const p = page(); p.click('clean'); p.answer(); await p.tick();
  const key = (value) => p.c.key({ key: value, target: { closest: () => ({}) }, preventDefault() {} });
  key('ArrowLeft'); assert.equal(p.log.draws.at(-1), 'clean-original-e1');
  assert.match(p.c.panel(), /tabindex="0" aria-selected="true"[^>]*>Original/);
  key('End'); assert.equal(p.log.draws.at(-1), 'clean-suggested-e1');
  key('Home'); assert.equal(p.log.draws.at(-1), 'clean-original-e1');
});
