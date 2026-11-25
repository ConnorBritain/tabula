// The AI gate on the page, per fixture record (platform phase 1B, per the server's plan).
// It builds the page tree from index.html, takes the words the gate writes to <html data-ai-off>, and works out what
// the CSS in index.html leaves visible (the "CSS hides each gate word" check in ai-gate.test.mjs keeps the two equal).
// Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const read = (f) => readFileSync(new URL(f, import.meta.url), 'utf8');
const { parseHtml, walk, byId, ancestorsAndSelf } = require('./test-html.js');
const L = require('./logic.js');
const HTML = read('index.html');
const ROOT = parseHtml(HTML);
// The server API's contract file (made by the real resolver): fixtures.<name> = { note, record }.
const FIX = Object.fromEntries(Object.entries(JSON.parse(read('fixtures/platform-v2.json')).fixtures).map(([k, v]) => [k, v.record]));
const NOW = 1795300000000;
const P = FIX['judge-self'].subject.programId;

// The gate for a fixture: the round judges for the fixture's school, as ?caps=<fixture> does on the page.
const gateOf = (name, over) => {
  const record = L.parseCaps(FIX[name]);
  return L.gateFor(Object.assign({ record, programId: record.subject.programId, now: NOW, profile: null }, over));
};
// What the CSS hides: a node with data-ai whose word is off, or data-ai-setup when setup (or, for invites, invite) is off.
function hiddenBy(node, off) {
  return ancestorsAndSelf(node).some((n) => (n.attrs['data-ai'] != null && off.includes(n.attrs['data-ai']))
    || ('data-ai-setup' in n.attrs && (off.includes('setup') || (n.attrs['data-ai-setup'] === 'invite' && off.includes('invite')))));
}
const visible = (id, off) => !hiddenBy(byId(ROOT, id), off);
const gatedNodes = () => [...walk(ROOT)].filter((n) => 'data-ai' in n.attrs || 'data-ai-setup' in n.attrs);
const AI_IDS = ['tab-eval', 'insights', 'eval-go', 'lens-go', 'impact-go', 'map-go', 'draft-open', 'draft-panel', 'rec-on', 'tr-toggle', 'tr-drawer', 'audio-card', 'live-flow', 'writing-card', 'writing-settings', 'cv-rec-on'];

for (const name of ['coach-hidden', 'student-judge-off', 'student-clerk-no-pool', 'managed-expired']) {
  // Why: for a hidden role nothing about AI may show and nothing may call out (R1, R4); one leftover control is a taunt
  // to a student, and one call spends the school's money on a tool it turned off.
  test(`${name}: no [data-ai] or [data-ai-setup] node is visible, and can() is false for every feature`, () => {
    const g = gateOf(name), off = L.offTokens(g, false);
    for (const n of gatedNodes()) assert.ok(hiddenBy(n, off), (n.attrs.id || n.tag) + ' is visible');
    for (const f of L.APP_FEATURES) assert.equal(L.canUse(g, f), false, f);
    assert.equal(L.showSetupFor(g, false), false);
    assert.equal(L.insightsMode({ allowed: L.canUse(g, 'liveEval'), setup: L.showSetupFor(g, false), aiReady: false }), 'none');
  });
}

// Why: a judge who pays with their own key and has none yet must see the Connect AI card, or they can never turn AI on.
test('judge-self with no key: #conn-card is visible, and so is the AI', () => {
  const off = L.offTokens(gateOf('judge-self'), false);
  assert.ok(visible('conn-card', off));
  assert.ok(visible('ins-cta', off), 'the Insights invite');
  for (const id of AI_IDS) assert.ok(visible(id, off), id);
});

// Why: when the school pays, the AI controls must show and the key card must not; a key card there asks the judge to pay twice.
test('judge-pool: the AI controls are visible and #conn-card is not', () => {
  const g = gateOf('judge-pool'), off = L.offTokens(g, false);
  for (const id of AI_IDS) assert.ok(visible(id, off), id);
  for (const id of ['conn-card', 'sub-box', 'backup-keys', 'ins-cta']) assert.ok(!visible(id, off), id);
  // Known gap until the hosted AI caller exists (PLAN.md §10): school-paid AI has no engine on the device yet, so with
  // no own key Insights has nothing to run and folds to 'none' instead of a Connect AI edge.
  assert.equal(L.insightsMode({ allowed: true, setup: L.showSetupFor(g, false), aiReady: false }), 'none');
});

// Why: a managed account has no picker, so its own round must follow its school's record: AI the school allows
// (here, own AI for a managed coach) must show with its key card; hiding it would take tools the school gave.
test('managed-allowed: the allowed AI and its key card show in the account\'s own round', () => {
  const off = L.offTokens(L.gateFor({ record: L.parseCaps(FIX['managed-allowed']), programId: null, now: NOW, profile: null }), false);
  for (const id of AI_IDS) assert.ok(visible(id, off), id);
  assert.ok(visible('conn-card', off));
});

// Why: a managed record that allows only some tools must show those and remove the rest.
test('a managed record with some tools: only those show, and no key card', () => {
  const record = L.parseCaps({ ...FIX['managed-allowed'], features: { aiFlow: { payer: 'program' }, transcription: { payer: 'program' } }, aiSetup: false });
  const off = L.offTokens(L.gateFor({ record, programId: null, now: NOW, profile: null }), false);
  for (const id of ['rec-on', 'tr-toggle', 'live-flow']) assert.ok(visible(id, off), id);
  for (const id of ['tab-eval', 'insights', 'lens-go', 'draft-open', 'conn-card', 'ins-cta']) assert.ok(!visible(id, off), id);
});

// Why: the server's gate rule fails closed. A new device whose fetch fails, judging for a school as a coach, must show no AI until a
// record arrives; it only removes, so the round itself never waits.
test('new device, fetch fails, judging for a school as coach: all AI is hidden', () => {
  const g = L.gateFor({ record: null, programId: P, now: NOW, profile: { programs: [{ id: P, name: 'Lincoln HS Debate', role: 'coach' }] } });
  const off = L.offTokens(g, false);
  for (const n of gatedNodes()) assert.ok(hiddenBy(n, off), (n.attrs.id || n.tag) + ' is visible');
});

// Why: R2 and R5. With all AI off the page must close the gaps: the flow takes the full width at 1366x768, Decide keeps
// more than one tab (or none), and no card is left empty.
test('coach-hidden at 1366x768: full-width grid, no lone tab, no empty card', () => {
  const off = L.offTokens(gateOf('coach-hidden'), false);
  // 1366 px is in the 820-1439 px band, where #workspace sets its own columns.
  const band = HTML.slice(HTML.indexOf('@media (min-width: 820px) and (max-width: 1439.98px)'));
  assert.match(band.slice(0, band.indexOf('\n  }')), /#workspace\.ins-none \{ grid-template-columns: minmax\(0, 1fr\); \}/);
  // Insights mode 'none' also comes from "allowed but no invite may show", so the pane hides by the mode, not only by data-ai.
  assert.ok(HTML.includes('.workspace.ins-none .pane-right { display: none !important; }'));
  const tabs = byId(ROOT, 'subnav').children.filter((b) => !hiddenBy(b, off));
  assert.ok(tabs.length !== 1, 'Decide has ' + tabs.length + ' tab');
  for (const n of walk(ROOT)) {
    if (!(n.attrs.class || '').split(/\s+/).includes('card') || hiddenBy(n, off)) continue;
    const kids = n.children.filter((c) => !/^h[1-6]$/.test(c.tag) && !hiddenBy(c, off));
    assert.ok(kids.length > 0, (n.attrs.id || 'a card') + ' is left with only its heading');
  }
});

// Why: assets/caps-boot.js draws the gate before the first paint from the caches; if it disagreed with the app, a removed
// tool would flash on screen, or an allowed one would blink in late.
test('caps-boot.js writes the same data-ai-off words as the app, from the cached record and round', () => {
  const run = (store, search = '') => {
    const attrs = {};
    const win = { location: { search }, URLSearchParams, localStorage: { getItem: (k) => (k in store ? store[k] : null) }, document: { documentElement: { setAttribute: (k, v) => { attrs[k] = v; } } } };
    win.window = win;
    vm.createContext(win);
    // The page's <head> order: the shared gate (core/policy.js, step C11), then logic/caps.js, then caps-boot.js.
    vm.runInContext(read('core/policy.js'), win);
    vm.runInContext(read('logic/caps.js'), win);
    vm.runInContext(read('assets/caps-boot.js'), win);
    return attrs['data-ai-off'];
  };
  const fresh = { ...FIX['coach-hidden'], expiresAt: Date.now() + 86400000 };
  assert.equal(run({ 'tabula.caps.v2': JSON.stringify(fresh), 'policyJudge.round.v1': JSON.stringify({ programId: P }) }),
    [...L.APP_FEATURES, 'any', 'setup', 'invite'].join(' '));
  assert.equal(run({}), '', 'signed out, no key: today\'s app, with its Connect AI invites');
  assert.equal(run({ 'policyJudge.keys.v1': JSON.stringify({ openai: 'sk-x' }) }), 'invite', 'a key: no invite, the rest stays');
  assert.equal(run({}, '?ai=off'), [...L.APP_FEATURES, 'any', 'setup', 'invite'].join(' '));
  assert.equal(run({ 'tabula.caps.v2': '{broken' }), '', 'a broken cache is no record');
});
